-- Fields added after the initial MESSAGE table was created.
IF OBJECT_ID(N'dbo.MESSAGE', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MESSAGE', N'is_edited') IS NULL
    ALTER TABLE dbo.MESSAGE
        ADD is_edited BIT NOT NULL
            CONSTRAINT DF_MESSAGE_is_edited DEFAULT (0) WITH VALUES;

IF OBJECT_ID(N'dbo.MESSAGE', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MESSAGE', N'edited_at') IS NULL
    ALTER TABLE dbo.MESSAGE ADD edited_at DATETIME2 NULL;

IF OBJECT_ID(N'dbo.MESSAGE', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MESSAGE', N'reaction_type') IS NULL
    ALTER TABLE dbo.MESSAGE ADD reaction_type VARCHAR(32) NULL;
