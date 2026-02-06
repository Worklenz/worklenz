-- Subscription User Counts Queries
-- Date Range: 2025-12-27 to 2026-01-02

-- ============================================
-- NOTE: licensing_user_subscriptions uses event_time (TEXT) instead of created_at
-- ============================================

-- ============================================
-- 1. FREE Users
-- ============================================
-- Count organizations with FREE license type created in the date range
SELECT 
    'FREE' AS subscription_type,
    '2025-12-27 to 2026-01-02' AS date_range,
    COUNT(DISTINCT o.id) AS user_count
FROM organizations o
INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
WHERE slt.key = 'FREE'
  AND o.created_at >= '2025-12-27 00:00:00'::timestamp
  AND o.created_at < '2026-01-03 00:00:00'::timestamp;

-- ============================================
-- 2. TRIAL Users
-- ============================================
-- Count organizations with TRIAL license type who signed up between the range
SELECT 
    'TRIAL' AS subscription_type,
    '2025-12-27 to 2026-01-02' AS date_range,
    COUNT(DISTINCT o.id) AS user_count
FROM organizations o
INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
WHERE slt.key = 'TRIAL'
  AND o.created_at >= '2025-12-27 00:00:00'::timestamp
  AND o.created_at < '2026-01-03 00:00:00'::timestamp;

-- ============================================
-- 3. CUSTOM Users
-- ============================================
-- Count users with CUSTOM license type OR users in licensing_custom_subs created in the range
SELECT 
    'CUSTOM' AS subscription_type,
    '2025-12-27 to 2026-01-02' AS date_range,
    COUNT(DISTINCT user_id) AS user_count
FROM (
    -- Organizations with CUSTOM license type
    SELECT o.user_id
    FROM organizations o
    INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
    WHERE slt.key = 'CUSTOM'
      AND o.created_at >= '2025-12-27 00:00:00'::timestamp
      AND o.created_at < '2026-01-03 00:00:00'::timestamp
    
    UNION
    
    -- Users with custom subscriptions created in the range
    SELECT lcs.user_id
    FROM licensing_custom_subs lcs
    WHERE lcs.created_at >= '2025-12-27 00:00:00'::timestamp
      AND lcs.created_at < '2026-01-03 00:00:00'::timestamp
) AS custom_users;

-- ============================================
-- 4. CREDIT Users
-- ============================================
-- Count users with CREDIT license type OR users in licensing_credit_subs created in the range
SELECT 
    'CREDIT' AS subscription_type,
    '2025-12-27 to 2026-01-02' AS date_range,
    COUNT(DISTINCT user_id) AS user_count
FROM (
    -- Organizations with CREDIT license type
    SELECT o.user_id
    FROM organizations o
    INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
    WHERE slt.key = 'CREDIT'
      AND o.created_at >= '2025-12-27 00:00:00'::timestamp
      AND o.created_at < '2026-01-03 00:00:00'::timestamp
    
    UNION
    
    -- Users with credit subscriptions created in the range
    SELECT lcs.user_id
    FROM licensing_credit_subs lcs
    WHERE lcs.created_at >= '2025-12-27 00:00:00'::timestamp
      AND lcs.created_at < '2026-01-03 00:00:00'::timestamp
) AS credit_users;

-- ============================================
-- 5. PADDLE Users
-- ============================================
-- Count users with Paddle subscriptions created in the range
-- Using licensing_user_subscriptions.event_time (TEXT field converted to timestamp)
SELECT 
    'PADDLE' AS subscription_type,
    '2025-12-27 to 2026-01-02' AS date_range,
    COUNT(DISTINCT lus.user_id) AS user_count
FROM licensing_user_subscriptions lus
WHERE lus.event_time IS NOT NULL
  AND lus.event_time != ''
  AND (lus.event_time::timestamp with time zone) >= '2025-12-27 00:00:00'::timestamp
  AND (lus.event_time::timestamp with time zone) < '2026-01-03 00:00:00'::timestamp
  AND lus.active = TRUE;

-- ============================================
-- 6. LIFE_TIME_DEAL Users
-- ============================================
-- Count users who redeemed lifetime deal coupons in the range
SELECT 
    'LIFE_TIME_DEAL' AS subscription_type,
    '2025-12-27 to 2026-01-02' AS date_range,
    COUNT(DISTINCT lcc.redeemed_by) AS user_count
FROM licensing_coupon_codes lcc
WHERE lcc.is_redeemed = TRUE
  AND lcc.is_refunded = FALSE
  AND (
    (lcc.redeemed_at >= '2025-12-27 00:00:00'::timestamp 
     AND lcc.redeemed_at < '2026-01-03 00:00:00'::timestamp)
    OR
    (lcc.redeemed_at IS NULL 
     AND lcc.created_at >= '2025-12-27 00:00:00'::timestamp 
     AND lcc.created_at < '2026-01-03 00:00:00'::timestamp)
  )
  AND lcc.redeemed_by IS NOT NULL;

-- ============================================
-- COMBINED QUERY - All subscription types in one result
-- ============================================
SELECT 
    subscription_type,
    '2025-12-27 to 2026-01-02' AS date_range,
    user_count
FROM (
    -- FREE
    SELECT 
        'FREE' AS subscription_type,
        COUNT(DISTINCT o.id) AS user_count
    FROM organizations o
    INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
    WHERE slt.key = 'FREE'
      AND o.created_at >= '2025-12-27 00:00:00'::timestamp
      AND o.created_at < '2026-01-03 00:00:00'::timestamp
    
    UNION ALL
    
    -- TRIAL
    SELECT 
        'TRIAL' AS subscription_type,
        COUNT(DISTINCT o.id) AS user_count
    FROM organizations o
    INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
    WHERE slt.key = 'TRIAL'
      AND o.created_at >= '2025-12-27 00:00:00'::timestamp
      AND o.created_at < '2026-01-03 00:00:00'::timestamp
    
    UNION ALL
    
    -- CUSTOM
    SELECT 
        'CUSTOM' AS subscription_type,
        COUNT(DISTINCT user_id) AS user_count
    FROM (
        SELECT o.user_id
        FROM organizations o
        INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
        WHERE slt.key = 'CUSTOM'
          AND o.created_at >= '2025-12-27 00:00:00'::timestamp
          AND o.created_at < '2026-01-03 00:00:00'::timestamp
        UNION
        SELECT lcs.user_id
        FROM licensing_custom_subs lcs
        WHERE lcs.created_at >= '2025-12-27 00:00:00'::timestamp
          AND lcs.created_at < '2026-01-03 00:00:00'::timestamp
    ) AS custom_users
    
    UNION ALL
    
    -- CREDIT
    SELECT 
        'CREDIT' AS subscription_type,
        COUNT(DISTINCT user_id) AS user_count
    FROM (
        SELECT o.user_id
        FROM organizations o
        INNER JOIN sys_license_types slt ON o.license_type_id = slt.id
        WHERE slt.key = 'CREDIT'
          AND o.created_at >= '2025-12-27 00:00:00'::timestamp
          AND o.created_at < '2026-01-03 00:00:00'::timestamp
        UNION
        SELECT lcs.user_id
        FROM licensing_credit_subs lcs
        WHERE lcs.created_at >= '2025-12-27 00:00:00'::timestamp
          AND lcs.created_at < '2026-01-03 00:00:00'::timestamp
    ) AS credit_users
    
    UNION ALL
    
    -- PADDLE (using licensing_user_subscriptions.event_time)
    SELECT 
        'PADDLE' AS subscription_type,
        COUNT(DISTINCT lus.user_id) AS user_count
    FROM licensing_user_subscriptions lus
    WHERE lus.event_time IS NOT NULL
      AND lus.event_time != ''
      AND (lus.event_time::timestamp with time zone) >= '2025-12-27 00:00:00'::timestamp
      AND (lus.event_time::timestamp with time zone) < '2026-01-03 00:00:00'::timestamp
      AND lus.active = TRUE
    
    UNION ALL
    
    -- LIFE_TIME_DEAL
    SELECT 
        'LIFE_TIME_DEAL' AS subscription_type,
        COUNT(DISTINCT lcc.redeemed_by) AS user_count
    FROM licensing_coupon_codes lcc
    WHERE lcc.is_redeemed = TRUE
      AND lcc.is_refunded = FALSE
      AND (
        (lcc.redeemed_at >= '2025-12-27 00:00:00'::timestamp 
         AND lcc.redeemed_at < '2026-01-03 00:00:00'::timestamp)
        OR
        (lcc.redeemed_at IS NULL 
         AND lcc.created_at >= '2025-12-27 00:00:00'::timestamp 
         AND lcc.created_at < '2026-01-03 00:00:00'::timestamp)
      )
      AND lcc.redeemed_by IS NOT NULL
) AS all_counts
ORDER BY subscription_type;

