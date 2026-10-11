IF COL_LENGTH('dbo.CONVERSATION', 'message_request_accepted') IS NULL
    ALTER TABLE dbo.CONVERSATION ADD message_request_accepted BIT NOT NULL
        CONSTRAINT DF_CONVERSATION_message_request_accepted DEFAULT (0) WITH VALUES;
GO

IF COL_LENGTH('dbo.CONVERSATION_MEMBER', 'message_request_pending') IS NULL
    ALTER TABLE dbo.CONVERSATION_MEMBER ADD message_request_pending BIT NOT NULL
        CONSTRAINT DF_CONVERSATION_MEMBER_message_request_pending DEFAULT (0) WITH VALUES;
GO

IF OBJECT_ID('dbo.MESSAGE_REACTION', 'U') IS NULL
BEGIN
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
    CREATE INDEX IX_reaction_message ON dbo.MESSAGE_REACTION(message_id);
END;
GO

IF COL_LENGTH('dbo.CONVERSATION', 'message_request_sender_id') IS NULL
    ALTER TABLE dbo.CONVERSATION ADD message_request_sender_id BIGINT NULL;
GO

UPDATE c
SET message_request_accepted = 1
FROM dbo.CONVERSATION c
WHERE c.type <> 'PRIVATE'
   OR EXISTS (SELECT 1 FROM dbo.MESSAGE m WHERE m.conversation_id = c.conversation_id)
   OR EXISTS (
       SELECT 1
       FROM dbo.CONVERSATION_MEMBER a
       JOIN dbo.CONVERSATION_MEMBER b ON b.conversation_id = a.conversation_id AND b.user_id <> a.user_id
       JOIN dbo.FRIEND_REQUEST f ON
           (f.sender_id = a.user_id AND f.receiver_id = b.user_id)
           OR (f.sender_id = b.user_id AND f.receiver_id = a.user_id)
       WHERE a.conversation_id = c.conversation_id AND f.status = 'ACCEPTED'
   );
GO