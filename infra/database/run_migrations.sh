#!/bin/bash

# BetTracer Database Migration Script
# This script helps run database migrations in Supabase
# Usage: ./run_migrations.sh [migration_file]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
SEEDS_DIR="$SCRIPT_DIR/seeds"

echo -e "${GREEN}BetTracer Database Migration Script${NC}"
echo "=========================================="
echo ""

# Check if migration file is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}No migration file specified. Available migrations:${NC}"
    echo ""
    echo "Migrations:"
    ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sed 's/^/  - /' || echo "  No migrations found"
    echo ""
    echo "Seeds:"
    ls -1 "$SEEDS_DIR"/*.sql 2>/dev/null | sed 's/^/  - /' || echo "  No seeds found"
    echo ""
    echo "Usage: $0 [migration_file.sql]"
    echo "Example: $0 migrations/001_initial_schema.sql"
    exit 1
fi

MIGRATION_FILE="$1"

# Check if file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    # Try relative to migrations directory
    if [ -f "$MIGRATIONS_DIR/$MIGRATION_FILE" ]; then
        MIGRATION_FILE="$MIGRATIONS_DIR/$MIGRATION_FILE"
    # Try relative to seeds directory
    elif [ -f "$SEEDS_DIR/$MIGRATION_FILE" ]; then
        MIGRATION_FILE="$SEEDS_DIR/$MIGRATION_FILE"
    else
        echo -e "${RED}Error: Migration file not found: $1${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Migration file:${NC} $MIGRATION_FILE"
echo ""

# Check if file is readable
if [ ! -r "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Cannot read migration file${NC}"
    exit 1
fi

# Display file contents
echo -e "${YELLOW}Migration SQL:${NC}"
echo "----------------------------------------"
cat "$MIGRATION_FILE"
echo "----------------------------------------"
echo ""

# Instructions
echo -e "${YELLOW}Instructions:${NC}"
echo "1. Copy the SQL above"
echo "2. Go to your Supabase dashboard"
echo "3. Navigate to SQL Editor"
echo "4. Paste the SQL and run it"
echo ""
echo -e "${GREEN}Or use Supabase CLI:${NC}"
echo "supabase db push --file $MIGRATION_FILE"
echo ""

exit 0

