/**
 * Script to fix orphaned leg references
 * 
 * This script finds legs that reference reference_items that don't exist,
 * and sets those references to NULL.
 * 
 * Run with: node infra/database/scripts/005_fix_orphaned_leg_references.js
 */

const path = require('path');
const fs = require('fs');

// Try to load dotenv if available
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env') });
} catch (e) {
  // dotenv not available, try to read .env manually
  const envPath = path.join(__dirname, '../../../backend/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

// Try to resolve @supabase/supabase-js from backend/node_modules
let supabaseClient;
try {
  const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
  const supabasePath = path.join(backendNodeModules, '@supabase/supabase-js');
  if (fs.existsSync(supabasePath)) {
    supabaseClient = require(supabasePath);
  } else {
    supabaseClient = require('@supabase/supabase-js');
  }
} catch (e) {
  console.error('Could not find @supabase/supabase-js. Make sure it is installed in backend/node_modules');
  process.exit(1);
}

const { createClient } = supabaseClient;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixOrphanedReferences() {
  console.log('Finding orphaned leg references...\n');

  // Get all legs with their reference IDs
  const { data: legs, error: legsError } = await supabase
    .from('legs')
    .select('id, home_team_id, away_team_id, league_id, bet_type_id, category_id, responsible_id');

  if (legsError) {
    console.error('Error fetching legs:', legsError);
    return;
  }

  console.log(`Found ${legs.length} legs to check\n`);

  // Get all reference items
  const { data: allReferenceItems, error: refError } = await supabase
    .from('reference_items')
    .select('id, kind, name');

  if (refError) {
    console.error('Error fetching reference items:', refError);
    return;
  }

  // Create maps by kind and name for quick lookup
  const refMapById = new Map();
  const refMapByName = new Map(); // key: "kind:name" -> id

  allReferenceItems.forEach(item => {
    refMapById.set(item.id, item);
    const key = `${item.kind}:${item.name.toLowerCase().trim()}`;
    if (!refMapByName.has(key)) {
      refMapByName.set(key, []);
    }
    refMapByName.get(key).push(item);
  });

  console.log(`Found ${allReferenceItems.length} reference items\n`);

  let fixedCount = 0;
  let notFixedCount = 0;
  const updates = [];

  for (const leg of legs) {
    const updatesForLeg = {};
    let needsUpdate = false;

    // Check each reference field
    const fields = [
      { field: 'home_team_id', kind: 'team' },
      { field: 'away_team_id', kind: 'team' },
      { field: 'league_id', kind: 'league' },
      { field: 'bet_type_id', kind: 'bet_type' },
      { field: 'category_id', kind: 'category' },
      { field: 'responsible_id', kind: 'responsible' },
    ];

    for (const { field, kind } of fields) {
      const refId = leg[field];
      if (!refId) continue;

      // Check if reference exists
      if (!refMapById.has(refId)) {
        // Reference doesn't exist - we can't fix it without knowing the name
        // Set it to null
        updatesForLeg[field] = null;
        needsUpdate = true;
        console.log(`Leg ${leg.id}: ${field} ${refId} doesn't exist, setting to null`);
      }
    }

    if (needsUpdate) {
      updates.push({ legId: leg.id, updates: updatesForLeg });
    }
  }

  console.log(`\nFound ${updates.length} legs with orphaned references\n`);

  if (updates.length === 0) {
    console.log('No orphaned references found!');
    return;
  }

  // Apply updates
  console.log('Applying fixes...\n');
  for (const { legId, updates: legUpdates } of updates) {
    const { error } = await supabase
      .from('legs')
      .update(legUpdates)
      .eq('id', legId);

    if (error) {
      console.error(`Error updating leg ${legId}:`, error);
      notFixedCount++;
    } else {
      fixedCount++;
      console.log(`Fixed leg ${legId}`);
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} legs`);
  if (notFixedCount > 0) {
    console.log(`❌ Failed to fix ${notFixedCount} legs`);
  }
  console.log('\nDone!');
}

fixOrphanedReferences()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

