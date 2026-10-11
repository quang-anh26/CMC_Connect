IF OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SOCIAL_POST', N'privacy') IS NULL
    ALTER TABLE dbo.SOCIAL_POST ADD privacy NVARCHAR(20) NOT NULL
        CONSTRAINT DF_social_post_privacy DEFAULT 'PUBLIC';

IF OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SOCIAL_POST', N'view_count') IS NULL
    ALTER TABLE dbo.SOCIAL_POST ADD view_count BIGINT NOT NULL
        CONSTRAINT DF_social_post_view_count DEFAULT 0;

IF OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.SOCIAL_POST', N'media_type') IS NULL
        ALTER TABLE dbo.SOCIAL_POST ADD media_type NVARCHAR(10) NULL;

IF OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.SOCIAL_POST', N'media_type') IS NOT NULL
        UPDATE dbo.SOCIAL_POST SET media_type = CASE
                WHEN LOWER(image_url) LIKE '%.mp4' OR LOWER(image_url) LIKE '%.webm' OR LOWER(image_url) LIKE '%.ogg'
                    OR LOWER(image_url) LIKE '%.mov' OR LOWER(image_url) LIKE '%.m4v' OR LOWER(image_url) LIKE '%.avi'
                    OR LOWER(image_url) LIKE '%.mkv' OR LOWER(image_url) LIKE '%.mpeg' OR LOWER(image_url) LIKE '%.mpg'
                    OR LOWER(image_url) LIKE '%.3gp' THEN 'VIDEO'
                WHEN image_url IS NOT NULL THEN 'IMAGE' ELSE NULL END
                WHERE media_type IS NULL;

IF OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_social_post_media_privacy_created' AND object_id = OBJECT_ID(N'dbo.SOCIAL_POST'))
        CREATE INDEX IX_social_post_media_privacy_created ON dbo.SOCIAL_POST(media_type, privacy, created_at DESC);

IF OBJECT_ID(N'dbo.SOCIAL_POST_COMMENT', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SOCIAL_POST_COMMENT', N'parent_comment_id') IS NULL
    ALTER TABLE dbo.SOCIAL_POST_COMMENT ADD parent_comment_id BIGINT NULL;

IF OBJECT_ID(N'dbo.SOCIAL_POST_COMMENT', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SOCIAL_POST_COMMENT', N'parent_comment_id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_video_comment_parent')
    ALTER TABLE dbo.SOCIAL_POST_COMMENT ADD CONSTRAINT FK_video_comment_parent
        FOREIGN KEY (parent_comment_id) REFERENCES dbo.SOCIAL_POST_COMMENT(comment_id);

IF OBJECT_ID(N'dbo.VIDEO_SAVED', N'U') IS NULL
    AND OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.USERS', N'U') IS NOT NULL
    CREATE TABLE dbo.VIDEO_SAVED (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        post_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_video_saved_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_video_saved_post_user UNIQUE (post_id, user_id),
        CONSTRAINT FK_video_saved_post FOREIGN KEY (post_id) REFERENCES dbo.SOCIAL_POST(post_id),
        CONSTRAINT FK_video_saved_user FOREIGN KEY (user_id) REFERENCES dbo.USERS(user_id)
    );

IF OBJECT_ID(N'dbo.VIDEO_SAVED', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_video_saved_user_created' AND object_id = OBJECT_ID(N'dbo.VIDEO_SAVED'))
    CREATE INDEX IX_video_saved_user_created ON dbo.VIDEO_SAVED(user_id, created_at DESC);

IF OBJECT_ID(N'dbo.VIDEO_FOLLOW', N'U') IS NULL
    AND OBJECT_ID(N'dbo.USERS', N'U') IS NOT NULL
    CREATE TABLE dbo.VIDEO_FOLLOW (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        follower_id BIGINT NOT NULL,
        creator_id BIGINT NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_video_follow_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_video_follow_pair UNIQUE (follower_id, creator_id),
        CONSTRAINT FK_video_follow_follower FOREIGN KEY (follower_id) REFERENCES dbo.USERS(user_id),
        CONSTRAINT FK_video_follow_creator FOREIGN KEY (creator_id) REFERENCES dbo.USERS(user_id)
    );

IF OBJECT_ID(N'dbo.VIDEO_FOLLOW', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_video_follow_creator' AND object_id = OBJECT_ID(N'dbo.VIDEO_FOLLOW'))
    CREATE INDEX IX_video_follow_creator ON dbo.VIDEO_FOLLOW(creator_id, follower_id);

IF OBJECT_ID(N'dbo.VIDEO_REPORT', N'U') IS NULL
    AND OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.USERS', N'U') IS NOT NULL
    CREATE TABLE dbo.VIDEO_REPORT (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        post_id BIGINT NOT NULL,
        reporter_id BIGINT NOT NULL,
        reason NVARCHAR(500) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_video_report_status DEFAULT 'OPEN',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_video_report_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_video_report_post_reporter UNIQUE (post_id, reporter_id),
        CONSTRAINT FK_video_report_post FOREIGN KEY (post_id) REFERENCES dbo.SOCIAL_POST(post_id),
        CONSTRAINT FK_video_report_reporter FOREIGN KEY (reporter_id) REFERENCES dbo.USERS(user_id)
    );

IF OBJECT_ID(N'dbo.VIDEO_REPORT', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_video_report_status_created' AND object_id = OBJECT_ID(N'dbo.VIDEO_REPORT'))
    CREATE INDEX IX_video_report_status_created ON dbo.VIDEO_REPORT(status, created_at);

IF OBJECT_ID(N'dbo.VIDEO_VIEW', N'U') IS NULL
    AND OBJECT_ID(N'dbo.SOCIAL_POST', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.USERS', N'U') IS NOT NULL
    CREATE TABLE dbo.VIDEO_VIEW (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        post_id BIGINT NOT NULL,
        viewer_id BIGINT NOT NULL,
        viewed_on DATE NOT NULL,
        CONSTRAINT UQ_video_view_post_viewer_day UNIQUE (post_id, viewer_id, viewed_on),
        CONSTRAINT FK_video_view_post FOREIGN KEY (post_id) REFERENCES dbo.SOCIAL_POST(post_id),
        CONSTRAINT FK_video_view_viewer FOREIGN KEY (viewer_id) REFERENCES dbo.USERS(user_id)
    );

IF OBJECT_ID(N'dbo.VIDEO_VIEW', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_video_view_post_day' AND object_id = OBJECT_ID(N'dbo.VIDEO_VIEW'))
    CREATE INDEX IX_video_view_post_day ON dbo.VIDEO_VIEW(post_id, viewed_on);
