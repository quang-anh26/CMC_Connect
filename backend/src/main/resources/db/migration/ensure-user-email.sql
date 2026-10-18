-- Them cot email cho USERS (idempotent: chay lai nhieu lan van an toan).
IF OBJECT_ID(N'dbo.USERS', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.USERS', N'email') IS NULL
    ALTER TABLE dbo.USERS ADD email VARCHAR(255) NULL;

-- Cho phep 1 email tao nhieu tai khoan: xoa chi muc UNIQUE cu (neu co) va thay bang chi muc thuong.
IF OBJECT_ID(N'dbo.USERS', N'U') IS NOT NULL
   AND EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE name = N'UX_users_email'
         AND object_id = OBJECT_ID(N'dbo.USERS')
   )
    DROP INDEX UX_users_email ON dbo.USERS;

-- Dung EXEC vi cot email co the vua moi duoc them trong cung batch.
IF OBJECT_ID(N'dbo.USERS', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.USERS', N'email') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE name = N'IX_users_email'
         AND object_id = OBJECT_ID(N'dbo.USERS')
   )
    EXEC(N'CREATE INDEX IX_users_email ON dbo.USERS(email) WHERE email IS NOT NULL');
