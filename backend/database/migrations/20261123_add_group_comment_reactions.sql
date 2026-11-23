IF OBJECT_ID('dbo.GROUP_COMMENT_REACTIONS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GROUP_COMMENT_REACTIONS (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        comment_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_group_comment_reaction_comment FOREIGN KEY (comment_id)
            REFERENCES dbo.GROUP_COMMENTS(comment_id),
        CONSTRAINT FK_group_comment_reaction_user FOREIGN KEY (user_id)
            REFERENCES dbo.USERS(user_id),
        CONSTRAINT UQ_group_comment_reaction_comment_user UNIQUE (comment_id, user_id)
    );
END;
