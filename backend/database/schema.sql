/* =====================================================================
   Real-Time Messaging System - Database Schema (Microsoft SQL Server)
   Matches the 9 JPA entities in backend/src/main/java/.../entity/ exactly.
   This script is provided so you can inspect/run the schema by hand;
   the backend can also auto-create/update it at startup via
   spring.jpa.hibernate.ddl-auto=update (see application.yml). Run this
   file yourself (and set ddl-auto=validate or none) if you prefer full
   control over the schema instead of letting Hibernate manage it.
   ===================================================================== */

IF DB_ID('messaging_db') IS NULL
BEGIN
    CREATE DATABASE messaging_db;
END
GO

USE messaging_db;
GO

/* ---------------------------------------------------------------------
   1. USERS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.USERS', 'U') IS NOT NULL DROP TABLE dbo.USERS;
GO
CREATE TABLE dbo.USERS (
    user_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    username       VARCHAR(50)   NOT NULL,
    password       VARCHAR(255)  NOT NULL,          -- BCrypt hash
    display_name   NVARCHAR(100) NULL,
    avatar         VARCHAR(500)  NULL,
    cover_image    VARCHAR(500)  NULL,
    bio            NVARCHAR(255) NULL,
    education      NVARCHAR(120) NULL,
    location       NVARCHAR(120) NULL,
    relationship_status NVARCHAR(40) NULL,
    birth_date     DATE          NULL,
    role           VARCHAR(20)   NOT NULL DEFAULT 'USER',    -- USER, ADMIN
    status         VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, LOCKED
    is_online      BIT           NOT NULL DEFAULT 0,
    last_seen_at   DATETIME2     NULL,
    created_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_users_username UNIQUE (username)
);
GO
CREATE INDEX IX_users_display_name ON dbo.USERS(display_name);
GO

/* ---------------------------------------------------------------------
   2. FRIEND_REQUEST
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.FRIEND_REQUEST', 'U') IS NOT NULL DROP TABLE dbo.FRIEND_REQUEST;
GO
CREATE TABLE dbo.FRIEND_REQUEST (
    id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    sender_id    BIGINT       NOT NULL,
    receiver_id  BIGINT       NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING, ACCEPTED, REJECTED
    created_at   DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_friendreq_sender   FOREIGN KEY (sender_id)   REFERENCES dbo.USERS(user_id),
    CONSTRAINT FK_friendreq_receiver FOREIGN KEY (receiver_id) REFERENCES dbo.USERS(user_id)
);
GO
CREATE INDEX IX_friendreq_receiver_status ON dbo.FRIEND_REQUEST(receiver_id, status);
CREATE INDEX IX_friendreq_sender_status   ON dbo.FRIEND_REQUEST(sender_id, status);
GO

/* ---------------------------------------------------------------------
   3. CONVERSATION
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CONVERSATION', 'U') IS NOT NULL DROP TABLE dbo.CONVERSATION;
GO
CREATE TABLE dbo.CONVERSATION (
    conversation_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    type            VARCHAR(20)   NOT NULL,       -- PRIVATE, GROUP
    name            NVARCHAR(100) NULL,           -- GROUP only
    avatar          VARCHAR(500)  NULL,           -- GROUP only
    nickname        NVARCHAR(50)  NULL,
    topic           NVARCHAR(255) NULL,
    message_request_accepted BIT  NOT NULL DEFAULT 0,
    message_request_sender_id BIGINT NULL,
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* ---------------------------------------------------------------------
   4. CONVERSATION_MEMBER
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CONVERSATION_MEMBER', 'U') IS NOT NULL DROP TABLE dbo.CONVERSATION_MEMBER;
GO
CREATE TABLE dbo.CONVERSATION_MEMBER (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    conversation_id BIGINT      NOT NULL,
    user_id         BIGINT      NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'MEMBER',  -- ADMIN, MEMBER
    joined_at       DATETIME2   NOT NULL DEFAULT SYSUTCDATETIME(),
    is_archived     BIT         NOT NULL DEFAULT 0,
    nickname        NVARCHAR(50) NULL,
    message_request_pending BIT  NOT NULL DEFAULT 0,
    CONSTRAINT FK_convmember_conversation FOREIGN KEY (conversation_id) REFERENCES dbo.CONVERSATION(conversation_id),
    CONSTRAINT FK_convmember_user         FOREIGN KEY (user_id)         REFERENCES dbo.USERS(user_id),
    CONSTRAINT UQ_convmember_conv_user UNIQUE (conversation_id, user_id)
);
GO
CREATE INDEX IX_convmember_user ON dbo.CONVERSATION_MEMBER(user_id);
GO

/* ---------------------------------------------------------------------
   5. MESSAGE
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.MESSAGE_REACTION', 'U') IS NOT NULL DROP TABLE dbo.MESSAGE_REACTION;
GO
IF OBJECT_ID('dbo.MESSAGE', 'U') IS NOT NULL DROP TABLE dbo.MESSAGE;
GO
CREATE TABLE dbo.MESSAGE (
    message_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    conversation_id      BIGINT        NOT NULL,
    sender_id            BIGINT        NOT NULL,
    content              NVARCHAR(MAX) NULL,
    message_type         VARCHAR(20)   NOT NULL DEFAULT 'TEXT',  -- TEXT, IMAGE, FILE, SYSTEM
    reply_to_message_id  BIGINT        NULL,
    is_deleted           BIT           NOT NULL DEFAULT 0,
    created_at           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_message_conversation FOREIGN KEY (conversation_id)     REFERENCES dbo.CONVERSATION(conversation_id),
    CONSTRAINT FK_message_sender       FOREIGN KEY (sender_id)           REFERENCES dbo.USERS(user_id),
    CONSTRAINT FK_message_reply_to     FOREIGN KEY (reply_to_message_id) REFERENCES dbo.MESSAGE(message_id)
);
GO
-- Primary access pattern: latest N messages of a conversation (history pagination, 20/page)
CREATE INDEX IX_message_conversation_created ON dbo.MESSAGE(conversation_id, created_at DESC);
GO

CREATE TABLE dbo.MESSAGE_REACTION (
    reaction_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    message_id  BIGINT NOT NULL,
    user_id     BIGINT NOT NULL,
    emoji       NVARCHAR(16) NOT NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_reaction_message FOREIGN KEY (message_id) REFERENCES dbo.MESSAGE(message_id),
    CONSTRAINT FK_reaction_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id),
    CONSTRAINT UQ_reaction_message_user UNIQUE (message_id, user_id)
);
GO
CREATE INDEX IX_reaction_message ON dbo.MESSAGE_REACTION(message_id);
GO

/* ---------------------------------------------------------------------
    6. MESSAGE_STATUS  (per-recipient Sent/Delivered/Seen)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.MESSAGE_STATUS', 'U') IS NOT NULL DROP TABLE dbo.MESSAGE_STATUS;
GO
CREATE TABLE dbo.MESSAGE_STATUS (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    message_id  BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'SENT',  -- SENT, DELIVERED, SEEN
    seen_at     DATETIME2   NULL,
    CONSTRAINT FK_msgstatus_message FOREIGN KEY (message_id) REFERENCES dbo.MESSAGE(message_id),
    CONSTRAINT FK_msgstatus_user    FOREIGN KEY (user_id)    REFERENCES dbo.USERS(user_id),
    CONSTRAINT UQ_msgstatus_message_user UNIQUE (message_id, user_id)
);
GO
CREATE INDEX IX_msgstatus_user_status ON dbo.MESSAGE_STATUS(user_id, status);
GO

/* ---------------------------------------------------------------------
   7. ATTACHMENT
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.ATTACHMENT', 'U') IS NOT NULL DROP TABLE dbo.ATTACHMENT;
GO
CREATE TABLE dbo.ATTACHMENT (
    attachment_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    message_id     BIGINT        NOT NULL,
    file_name      NVARCHAR(255) NOT NULL,
    file_url       VARCHAR(1000) NOT NULL,
    file_type      VARCHAR(100)  NULL,
    file_size      BIGINT        NULL,   -- bytes; enforce <=10MB in application layer
    CONSTRAINT FK_attachment_message FOREIGN KEY (message_id) REFERENCES dbo.MESSAGE(message_id)
);
GO

/* ---------------------------------------------------------------------
   8. BLOCK
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.BLOCK', 'U') IS NOT NULL DROP TABLE dbo.BLOCK;
GO
CREATE TABLE dbo.BLOCK (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    blocker_id  BIGINT    NOT NULL,
    blocked_id  BIGINT    NOT NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_block_blocker FOREIGN KEY (blocker_id) REFERENCES dbo.USERS(user_id),
    CONSTRAINT FK_block_blocked FOREIGN KEY (blocked_id) REFERENCES dbo.USERS(user_id),
    CONSTRAINT UQ_block_pair UNIQUE (blocker_id, blocked_id)
);
GO

/* ---------------------------------------------------------------------
   9. REFRESH_TOKEN
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.REFRESH_TOKEN', 'U') IS NOT NULL DROP TABLE dbo.REFRESH_TOKEN;
GO
CREATE TABLE dbo.REFRESH_TOKEN (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    token       VARCHAR(500) NOT NULL,
    expires_at  DATETIME2    NOT NULL,
    revoked     BIT          NOT NULL DEFAULT 0,
    created_at  DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_refreshtoken_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id),
    CONSTRAINT UQ_refreshtoken_token UNIQUE (token)
);
GO
CREATE INDEX IX_refreshtoken_user ON dbo.REFRESH_TOKEN(user_id);
GO

/* ---------------------------------------------------------------------
   10. SOCIAL_POST
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.SOCIAL_POST', 'U') IS NOT NULL DROP TABLE dbo.SOCIAL_POST;
GO
CREATE TABLE dbo.SOCIAL_POST (
    post_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    author_id   BIGINT        NOT NULL,
    shared_post_id BIGINT     NULL,
    content     NVARCHAR(MAX) NOT NULL,
    image_url   VARCHAR(1000) NULL,
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_social_post_author FOREIGN KEY (author_id) REFERENCES dbo.USERS(user_id),
    CONSTRAINT FK_social_post_shared_post FOREIGN KEY (shared_post_id) REFERENCES dbo.SOCIAL_POST(post_id)
);
GO
CREATE INDEX IX_social_post_created ON dbo.SOCIAL_POST(created_at DESC);
GO

/* ---------------------------------------------------------------------
   11. SOCIAL_POST_REACTION
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.SOCIAL_POST_REACTION', 'U') IS NOT NULL DROP TABLE dbo.SOCIAL_POST_REACTION;
GO
CREATE TABLE dbo.SOCIAL_POST_REACTION (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    post_id     BIGINT   NOT NULL,
    user_id     BIGINT   NOT NULL,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'LIKE',
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_social_reaction_post FOREIGN KEY (post_id) REFERENCES dbo.SOCIAL_POST(post_id),
    CONSTRAINT FK_social_reaction_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id),
    CONSTRAINT UQ_social_reaction_post_user UNIQUE (post_id, user_id)
);
GO

/* ---------------------------------------------------------------------
   12. SOCIAL_POST_COMMENT
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.SOCIAL_POST_COMMENT', 'U') IS NOT NULL DROP TABLE dbo.SOCIAL_POST_COMMENT;
GO
CREATE TABLE dbo.SOCIAL_POST_COMMENT (
    comment_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    post_id     BIGINT        NOT NULL,
    author_id   BIGINT        NOT NULL,
    content     NVARCHAR(1000) NOT NULL,
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_social_comment_post FOREIGN KEY (post_id) REFERENCES dbo.SOCIAL_POST(post_id),
    CONSTRAINT FK_social_comment_author FOREIGN KEY (author_id) REFERENCES dbo.USERS(user_id)
);
GO

PRINT 'Schema created successfully: 12 tables including the Kapatalk social feed.';
GO
