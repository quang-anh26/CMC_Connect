-- Chuyen cac cot chu cua nhom tu VARCHAR sang NVARCHAR de luu duoc tieng Viet co dau day du.
-- Nguyen nhan: Hibernate (ddl-auto update) tao cot String thanh VARCHAR, cac ky tu tieng Viet nam ngoai bang ma cp1252
-- (vi du u co dau hoi, e co dau nang) bi doi thanh dau hoi cham luc ghi. Script chay lai nhieu lan van an toan, chi doi cot dang la VARCHAR.
-- Luu y: du lieu da bi thanh dau hoi cham tu truoc khong the khoi phuc, can nhap lai.

IF OBJECT_ID(N'dbo.GROUPS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUPS') AND c.name = N'name' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUPS ALTER COLUMN name NVARCHAR(100) NOT NULL;

IF OBJECT_ID(N'dbo.GROUPS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUPS') AND c.name = N'category' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUPS ALTER COLUMN category NVARCHAR(80) NULL;

IF OBJECT_ID(N'dbo.GROUP_BANS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUP_BANS') AND c.name = N'reason' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUP_BANS ALTER COLUMN reason NVARCHAR(500) NULL;

IF OBJECT_ID(N'dbo.GROUP_EVENTS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUP_EVENTS') AND c.name = N'title' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUP_EVENTS ALTER COLUMN title NVARCHAR(120) NOT NULL;

IF OBJECT_ID(N'dbo.GROUP_EVENTS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUP_EVENTS') AND c.name = N'location' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUP_EVENTS ALTER COLUMN location NVARCHAR(200) NULL;

IF OBJECT_ID(N'dbo.GROUP_NOTIFICATIONS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUP_NOTIFICATIONS') AND c.name = N'message' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUP_NOTIFICATIONS ALTER COLUMN message NVARCHAR(500) NOT NULL;

IF OBJECT_ID(N'dbo.GROUP_POLL_OPTIONS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUP_POLL_OPTIONS') AND c.name = N'label' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUP_POLL_OPTIONS ALTER COLUMN label NVARCHAR(120) NOT NULL;

IF OBJECT_ID(N'dbo.GROUP_REPORTS', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.GROUP_REPORTS') AND c.name = N'reason' AND ty.name = N'varchar')
    ALTER TABLE dbo.GROUP_REPORTS ALTER COLUMN reason NVARCHAR(500) NOT NULL;
