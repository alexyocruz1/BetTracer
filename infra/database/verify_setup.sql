-- BetTracer Database Verification Script
-- Run this script in Supabase SQL Editor to verify database setup

-- ============================================================================
-- VERIFY TABLES
-- ============================================================================
SELECT 
    'Tables' as check_type,
    table_name as item_name,
    'OK' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'reference_items', 'main_bets', 'legs', 'daily_summary')
ORDER BY table_name;

-- ============================================================================
-- VERIFY INDEXES
-- ============================================================================
SELECT 
    'Indexes' as check_type,
    indexname as item_name,
    'OK' as status
FROM pg_indexes 
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================================================
-- VERIFY RLS POLICIES
-- ============================================================================
SELECT 
    'RLS Policies' as check_type,
    tablename || '.' || policyname as item_name,
    'OK' as status
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- VERIFY FUNCTIONS
-- ============================================================================
SELECT 
    'Functions' as check_type,
    routine_name || '(' || 
    COALESCE(
        (SELECT string_agg(parameter_name || ' ' || data_type, ', ')
         FROM information_schema.parameters p
         WHERE p.specific_name = r.specific_name
         AND parameter_mode = 'IN'), 
        ''
    ) || ')' as item_name,
    'OK' as status
FROM information_schema.routines r
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================================
-- VERIFY TRIGGERS
-- ============================================================================
SELECT 
    'Triggers' as check_type,
    event_object_table || '.' || trigger_name as item_name,
    'OK' as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- VERIFY REFERENCE ITEMS SEED DATA
-- ============================================================================
SELECT 
    'Seed Data' as check_type,
    kind || ' (' || COUNT(*) || ' items)' as item_name,
    CASE 
        WHEN COUNT(*) > 0 THEN 'OK'
        ELSE 'MISSING'
    END as status
FROM reference_items
GROUP BY kind
ORDER BY kind;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
    'SUMMARY' as check_type,
    'Total Tables: ' || COUNT(*) as item_name,
    'OK' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'reference_items', 'main_bets', 'legs', 'daily_summary')

UNION ALL

SELECT 
    'SUMMARY' as check_type,
    'Total Indexes: ' || COUNT(*) as item_name,
    'OK' as status
FROM pg_indexes 
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'

UNION ALL

SELECT 
    'SUMMARY' as check_type,
    'Total RLS Policies: ' || COUNT(*) as item_name,
    'OK' as status
FROM pg_policies 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'SUMMARY' as check_type,
    'Total Functions: ' || COUNT(*) as item_name,
    'OK' as status
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'

UNION ALL

SELECT 
    'SUMMARY' as check_type,
    'Total Triggers: ' || COUNT(*) as item_name,
    'OK' as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public'

UNION ALL

SELECT 
    'SUMMARY' as check_type,
    'Total Reference Items: ' || COUNT(*) as item_name,
    CASE 
        WHEN COUNT(*) > 0 THEN 'OK'
        ELSE 'MISSING'
    END as status
FROM reference_items;

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- Tables: 5 (profiles, reference_items, main_bets, legs, daily_summary)
-- Indexes: ~10-12 indexes
-- RLS Policies: ~15-20 policies
-- Functions: 5 functions
-- Triggers: ~7 triggers
-- Reference Items: ~40+ items (12 leagues + 12 bet types + 11 categories + 8 responsible)

