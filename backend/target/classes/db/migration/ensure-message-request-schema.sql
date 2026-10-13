-- Keep existing SQL Server databases compatible with the message-request fields
-- mapped by Conversation and ConversationMember.
IF OBJECT_ID(N'dbo.CONVERSATION', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CONVERSATION', N'message_request_accepted') IS NULL
    ALTER TABLE dbo.CONVERSATION
        ADD message_request_accepted BIT NOT NULL
            CONSTRAINT DF_CONVERSATION_message_request_accepted DEFAULT (0) WITH VALUES;

IF OBJECT_ID(N'dbo.CONVERSATION', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CONVERSATION', N'message_request_sender_id') IS NULL
    ALTER TABLE dbo.CONVERSATION ADD message_request_sender_id BIGINT NULL;

IF OBJECT_ID(N'dbo.CONVERSATION', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CONVERSATION', N'nickname') IS NULL
    ALTER TABLE dbo.CONVERSATION ADD nickname NVARCHAR(50) NULL;

IF OBJECT_ID(N'dbo.CONVERSATION', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CONVERSATION', N'topic') IS NULL
    ALTER TABLE dbo.CONVERSATION ADD topic NVARCHAR(255) NULL;

IF OBJECT_ID(N'dbo.CONVERSATION_MEMBER', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CONVERSATION_MEMBER', N'message_request_pending') IS NULL
    ALTER TABLE dbo.CONVERSATION_MEMBER
        ADD message_request_pending BIT NOT NULL
            CONSTRAINT DF_CONVERSATION_MEMBER_message_request_pending DEFAULT (0) WITH VALUES;

IF OBJECT_ID(N'dbo.CONVERSATION_MEMBER', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CONVERSATION_MEMBER', N'nickname') IS NULL
    ALTER TABLE dbo.CONVERSATION_MEMBER ADD nickname NVARCHAR(50) NULL;
