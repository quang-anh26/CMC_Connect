USE messaging_db;
GO

IF OBJECT_ID('dbo.GROUPS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[GROUPS] (
        group_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        owner_id BIGINT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(2000) NULL,
        avatar VARCHAR(500) NULL,
        cover_image VARCHAR(500) NULL,
        category NVARCHAR(80) NULL,
        visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
        post_approval_required BIT NOT NULL DEFAULT 0,
        spam_keywords NVARCHAR(2000) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_groups_owner FOREIGN KEY (owner_id) REFERENCES dbo.USERS(user_id)
    );
    CREATE INDEX IX_groups_visibility_created ON dbo.[GROUPS](visibility, created_at DESC);
END;
GO

IF OBJECT_ID('dbo.GROUP_MEMBERS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_MEMBERS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
        joined_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_group_members_group_user UNIQUE (group_id, user_id),
        CONSTRAINT FK_group_members_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_members_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id)
    );
    CREATE INDEX IX_group_members_user ON dbo.GROUP_MEMBERS(user_id, joined_at DESC);
END;
GO

IF OBJECT_ID('dbo.GROUP_JOIN_REQUESTS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_JOIN_REQUESTS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_group_join_requests_group_user UNIQUE (group_id, user_id),
        CONSTRAINT FK_group_join_requests_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_join_requests_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id)
    );
END;
GO

IF OBJECT_ID('dbo.GROUP_POSTS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_POSTS (
        post_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        author_id BIGINT NOT NULL,
        content NVARCHAR(MAX) NOT NULL DEFAULT '',
        media_url VARCHAR(1000) NULL,
        media_type VARCHAR(20) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
        pinned BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_group_posts_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_posts_author FOREIGN KEY (author_id) REFERENCES dbo.USERS(user_id)
    );
    CREATE INDEX IX_group_posts_group_created ON dbo.GROUP_POSTS(group_id, status, pinned DESC, created_at DESC);
END;
GO

IF OBJECT_ID('dbo.GROUP_COMMENTS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_COMMENTS (
        comment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        post_id BIGINT NOT NULL,
        author_id BIGINT NOT NULL,
        parent_comment_id BIGINT NULL,
        content NVARCHAR(2000) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_group_comments_post FOREIGN KEY (post_id) REFERENCES dbo.GROUP_POSTS(post_id),
        CONSTRAINT FK_group_comments_author FOREIGN KEY (author_id) REFERENCES dbo.USERS(user_id),
        CONSTRAINT FK_group_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES dbo.GROUP_COMMENTS(comment_id)
    );
END;
GO

IF OBJECT_ID('dbo.GROUP_REACTIONS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_REACTIONS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        post_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        reaction_type VARCHAR(20) NOT NULL,
        CONSTRAINT UQ_group_reactions_post_user UNIQUE (post_id, user_id),
        CONSTRAINT FK_group_reactions_post FOREIGN KEY (post_id) REFERENCES dbo.GROUP_POSTS(post_id),
        CONSTRAINT FK_group_reactions_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id)
    );
END;
GO

IF OBJECT_ID('dbo.GROUP_REPORTS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_REPORTS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        reporter_id BIGINT NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target_id BIGINT NOT NULL,
        reason NVARCHAR(500) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_group_reports_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_reports_reporter FOREIGN KEY (reporter_id) REFERENCES dbo.USERS(user_id)
    );
END;
GO

IF OBJECT_ID('dbo.GROUP_BANS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_BANS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        banned_by BIGINT NOT NULL,
        reason NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_group_bans_group_user UNIQUE (group_id, user_id),
        CONSTRAINT FK_group_bans_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_bans_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id),
        CONSTRAINT FK_group_bans_actor FOREIGN KEY (banned_by) REFERENCES dbo.USERS(user_id)
    );
END;
GO

IF OBJECT_ID('dbo.GROUP_NOTIFICATIONS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_NOTIFICATIONS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        actor_id BIGINT NULL,
        type VARCHAR(40) NOT NULL,
        reference_id BIGINT NULL,
        message NVARCHAR(500) NOT NULL,
        is_read BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_group_notifications_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_notifications_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id),
        CONSTRAINT FK_group_notifications_actor FOREIGN KEY (actor_id) REFERENCES dbo.USERS(user_id)
    );
    CREATE INDEX IX_group_notifications_user_created ON dbo.GROUP_NOTIFICATIONS(user_id, created_at DESC);
END;
GO

IF OBJECT_ID('dbo.GROUP_INVITES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_INVITES (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        invitee_id BIGINT NOT NULL,
        invited_by BIGINT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_group_invites_group_user UNIQUE (group_id, invitee_id),
        CONSTRAINT FK_group_invites_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_invites_invitee FOREIGN KEY (invitee_id) REFERENCES dbo.USERS(user_id),
        CONSTRAINT FK_group_invites_actor FOREIGN KEY (invited_by) REFERENCES dbo.USERS(user_id)
    );
END;
GO