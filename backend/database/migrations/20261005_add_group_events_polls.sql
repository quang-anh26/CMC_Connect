USE messaging_db;
GO

IF COL_LENGTH('dbo.GROUP_POSTS', 'post_type') IS NULL
BEGIN
    ALTER TABLE dbo.GROUP_POSTS ADD post_type VARCHAR(20) NOT NULL
        CONSTRAINT DF_group_posts_post_type DEFAULT 'POST';
END;
GO

IF OBJECT_ID('dbo.GROUP_POLLS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_POLLS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        post_id BIGINT NOT NULL UNIQUE,
        ends_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_group_polls_post FOREIGN KEY (post_id) REFERENCES dbo.GROUP_POSTS(post_id)
    );
END;
GO

IF OBJECT_ID('dbo.GROUP_POLL_OPTIONS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_POLL_OPTIONS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        poll_id BIGINT NOT NULL,
        label NVARCHAR(120) NOT NULL,
        CONSTRAINT FK_group_poll_options_poll FOREIGN KEY (poll_id) REFERENCES dbo.GROUP_POLLS(id)
    );
    CREATE INDEX IX_group_poll_options_poll ON dbo.GROUP_POLL_OPTIONS(poll_id, id);
END;
GO

IF OBJECT_ID('dbo.GROUP_POLL_VOTES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_POLL_VOTES (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        poll_id BIGINT NOT NULL,
        option_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_group_poll_votes_poll_user UNIQUE (poll_id, user_id),
        CONSTRAINT FK_group_poll_votes_poll FOREIGN KEY (poll_id) REFERENCES dbo.GROUP_POLLS(id),
        CONSTRAINT FK_group_poll_votes_option FOREIGN KEY (option_id) REFERENCES dbo.GROUP_POLL_OPTIONS(id),
        CONSTRAINT FK_group_poll_votes_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id)
    );
END;
GO

IF OBJECT_ID('dbo.GROUP_EVENTS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_EVENTS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_id BIGINT NOT NULL,
        created_by BIGINT NOT NULL,
        title NVARCHAR(120) NOT NULL,
        description NVARCHAR(2000) NULL,
        location NVARCHAR(200) NULL,
        starts_at DATETIME2 NOT NULL,
        ends_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_group_events_group FOREIGN KEY (group_id) REFERENCES dbo.[GROUPS](group_id),
        CONSTRAINT FK_group_events_creator FOREIGN KEY (created_by) REFERENCES dbo.USERS(user_id)
    );
    CREATE INDEX IX_group_events_group_start ON dbo.GROUP_EVENTS(group_id, starts_at);
END;
GO

IF OBJECT_ID('dbo.GROUP_EVENT_PARTICIPANTS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_EVENT_PARTICIPANTS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        event_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        joined_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_group_event_participants_event_user UNIQUE (event_id, user_id),
        CONSTRAINT FK_group_event_participants_event FOREIGN KEY (event_id) REFERENCES dbo.GROUP_EVENTS(id),
        CONSTRAINT FK_group_event_participants_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id)
    );
END;
GO