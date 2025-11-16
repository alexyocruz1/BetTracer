-- BetTracer Database Migration
-- Migration: 006_case_insensitive_reference_items
-- Description: Makes reference item names case-insensitive to prevent duplicates

-- ============================================================================
-- ADD CASE-INSENSITIVE UNIQUE CONSTRAINT
-- ============================================================================
-- Create a unique index on (kind, LOWER(name)) to enforce case-insensitive uniqueness
-- This prevents duplicates like "Premier League", "premier league", "PREMIER LEAGUE"

CREATE UNIQUE INDEX IF NOT EXISTS idx_reference_items_kind_name_lower 
ON reference_items (kind, LOWER(name));

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON INDEX idx_reference_items_kind_name_lower IS 
'Ensures case-insensitive uniqueness of reference item names per kind';

