IF OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MARKETPLACE_LISTINGS', N'category') IS NOT NULL
   AND EXISTS (
       SELECT 1
         FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS')
          AND name = N'category'
          AND user_type_id <> TYPE_ID(N'nvarchar')
   )
   AND EXISTS (
       SELECT 1
         FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS')
          AND name = N'idx_marketplace_category'
   )
    DROP INDEX idx_marketplace_category ON dbo.MARKETPLACE_LISTINGS;

IF OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MARKETPLACE_LISTINGS', N'category') IS NOT NULL
   AND EXISTS (
       SELECT 1
         FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS')
          AND name = N'category'
          AND user_type_id <> TYPE_ID(N'nvarchar')
   )
    ALTER TABLE dbo.MARKETPLACE_LISTINGS
        ALTER COLUMN category NVARCHAR(50) NOT NULL;

IF OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MARKETPLACE_LISTINGS', N'category') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
         FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS')
          AND name = N'idx_marketplace_category'
   )
    CREATE INDEX idx_marketplace_category
        ON dbo.MARKETPLACE_LISTINGS(category);

IF OBJECT_ID(N'dbo.MARKETPLACE_LISTINGS', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.MARKETPLACE_LISTINGS', N'category') IS NOT NULL
    UPDATE dbo.MARKETPLACE_LISTINGS
       SET category = N'Đồ cá nhân'
     WHERE category = N'Ð? cá nhân';
