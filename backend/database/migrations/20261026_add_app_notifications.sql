/* Safe additive migration for CMC Talk notification records. Does not drop or alter existing data. */
IF OBJECT_ID('dbo.APP_NOTIFICATION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.APP_NOTIFICATION (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        recipient_id BIGINT NOT NULL,
        actor_id BIGINT NULL,
        type NVARCHAR(40) NOT NULL,
        reference_type NVARCHAR(40) NULL,
        reference_id BIGINT NULL,
        message NVARCHAR(700) NOT NULL,
        is_read BIT NOT NULL CONSTRAINT DF_app_notification_is_read DEFAULT 0,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_app_notification_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_app_notification_recipient FOREIGN KEY (recipient_id) REFERENCES dbo.USERS(user_id),
        CONSTRAINT FK_app_notification_actor FOREIGN KEY (actor_id) REFERENCES dbo.USERS(user_id)
    );
    CREATE INDEX IX_app_notification_recipient_created ON dbo.APP_NOTIFICATION(recipient_id, created_at DESC);
    CREATE INDEX IX_app_notification_recipient_read ON dbo.APP_NOTIFICATION(recipient_id, is_read);
END;
