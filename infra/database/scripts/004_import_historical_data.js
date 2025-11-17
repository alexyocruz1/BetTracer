/**
 * BetTracer Historical Data Import Script
 * 
 * This script imports historical bets, legs, and reference items from CSV files.
 * 
 * Usage:
 *   1. Set your Supabase credentials in backend/.env file:
 *      - SUPABASE_URL
 *      - SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *      - IMPORT_USER_ID (optional, or update USER_ID in script)
 *   2. Run: node 004_import_historical_data.js
 * 
 * Requirements:
 *   - Node.js
 *   - @supabase/supabase-js package (install: npm install @supabase/supabase-js)
 *   - CSV files: mainBets.csv, legs.csv, references.csv in the project root
 */

const fs = require('fs');
const path = require('path');

// Add backend node_modules to the require path
const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (fs.existsSync(backendNodeModules)) {
  // Prepend backend node_modules to module search paths
  const Module = require('module');
  const originalResolveLookupPaths = Module._resolveLookupPaths;
  Module._resolveLookupPaths = function(request, parent) {
    const paths = originalResolveLookupPaths.apply(this, arguments);
    if (paths) {
      paths.push(backendNodeModules);
    }
    return paths;
  };
}

// Try to require from backend node_modules first
let createClient;
try {
  const supabasePath = path.join(backendNodeModules, '@supabase/supabase-js');
  createClient = require(supabasePath).createClient;
} catch (e) {
  // Fallback to normal require
  createClient = require('@supabase/supabase-js').createClient;
}

require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env') });

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.IMPORT_USER_ID || 'YOUR_USER_ID_HERE'; // Replace with actual user ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
  process.exit(1);
}

if (USER_ID === 'YOUR_USER_ID_HERE') {
  console.error('Error: Please set IMPORT_USER_ID environment variable or update USER_ID in the script');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper function to parse CSV
function parseCSV(filePath, hasHeaders = true) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  let headers;
  let dataStartIndex;
  
  if (hasHeaders) {
    headers = lines[0].split('\t').map(h => h.trim());
    dataStartIndex = 1;
  } else {
    // For files without headers, use positional indices
    dataStartIndex = 0;
  }
  
  return lines.slice(dataStartIndex).map((line, lineIndex) => {
    const values = line.split('\t');
    const obj = {};
    
    if (hasHeaders) {
      headers.forEach((header, index) => {
        obj[header] = values[index]?.trim() || '';
      });
    } else {
      // For mainBets.csv: Date, Bet ID, Type, Legs, Stake, American Odds, Decimal Odds, State, ?, Profit/Loss, Cumulative Profit, Responsible
      // For legs.csv: Main Bet ID, League, Home Team, Away Team, Category, Bet Type, American Odds, Decimal Odds, Result State, ?, Responsible
      if (filePath.includes('mainBets.csv')) {
        obj['Date'] = values[0]?.trim() || '';
        obj['Bet ID'] = values[1]?.trim() || '';
        obj['Type'] = values[2]?.trim() || '';
        obj['Legs'] = values[3]?.trim() || '';
        obj['Stake'] = values[4]?.trim() || '';
        obj['American Odds'] = values[5]?.trim() || '';
        obj['Decimal Odds'] = values[6]?.trim() || '';
        obj['State'] = values[7]?.trim() || '';
        obj['Profit/Loss'] = values[9]?.trim() || '';
        obj['Cumulative Profit'] = values[10]?.trim() || '';
        obj['Responsible'] = values[11]?.trim() || '';
      } else if (filePath.includes('legs.csv')) {
        obj['Main Bet ID'] = values[0]?.trim() || '';
        obj['League'] = values[1]?.trim() || '';
        obj['Home Team'] = values[2]?.trim() || '';
        obj['Away Team'] = values[3]?.trim() || '';
        obj['Category'] = values[4]?.trim() || '';
        obj['Bet Type'] = values[5]?.trim() || '';
        obj['American Odds'] = values[6]?.trim() || '';
        obj['Decimal Odds'] = values[7]?.trim() || '';
        obj['Result State'] = values[8]?.trim() || '';
        obj['Responsible'] = values[10]?.trim() || '';
      } else {
        // For references.csv, use headers
        const refHeaders = ['Responsible', 'League / Country', 'Team', 'Bet Type', 'Bet Category'];
        refHeaders.forEach((header, index) => {
          obj[header] = values[index]?.trim() || '';
        });
      }
    }
    
    return obj;
  });
}

// Helper function to get or create reference item
async function getOrCreateReferenceItem(kind, name) {
  // Try to find existing item (case-insensitive)
  const { data: existing } = await supabase
    .from('reference_items')
    .select('id')
    .eq('kind', kind)
    .ilike('name', name)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new item
  const { data, error } = await supabase
    .from('reference_items')
    .insert({ kind, name, metadata: {} })
    .select('id')
    .single();

  if (error) {
    console.error(`Error creating reference item ${kind}:${name}:`, error);
    throw error;
  }

  return data.id;
}

// Helper function to parse date
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  
  // Format: "October 1, 2025"
  const parts = dateStr.trim().split(' ');
  if (parts.length < 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  
  const month = parts[0];
  const day = parts[1];
  const year = parts[2];
  
  const monthMap = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };
  
  if (!monthMap[month]) {
    throw new Error(`Invalid month: ${month} in date ${dateStr}`);
  }
  
  const dayNum = day.replace(',', '');
  return `${year}-${monthMap[month]}-${dayNum.padStart(2, '0')}T12:00:00Z`;
}

// Helper function to parse state
function parseState(state) {
  const stateMap = {
    'Win': 'won',
    'Loss': 'lost',
    'win': 'won',
    'loss': 'lost'
  };
  return stateMap[state] || state.toLowerCase();
}

// Helper function to parse currency
function parseCurrency(value) {
  return parseFloat(value.replace('$', '').replace(',', ''));
}

async function importData() {
  console.log('Starting data import...');
  console.log(`User ID: ${USER_ID}`);

  // Parse CSV files
  console.log('Parsing CSV files...');
  const mainBetsPath = path.join(__dirname, '../../../mainBets.csv');
  const legsPath = path.join(__dirname, '../../../legs.csv');
  const referencesPath = path.join(__dirname, '../../../references.csv');
  
  const mainBetsData = parseCSV(mainBetsPath, false);
  const legsData = parseCSV(legsPath, false);
  const referencesData = parseCSV(referencesPath, true);

  console.log(`Found ${mainBetsData.length} main bets`);
  console.log(`Found ${legsData.length} legs`);
  console.log(`Found ${referencesData.length} reference items`);

  // Create a map to store reference item IDs
  const referenceMap = new Map();

  // First, create all reference items
  console.log('\nCreating reference items...');
  
  // Collect all unique reference items
  const leagues = new Set();
  const teams = new Set();
  const betTypes = new Set();
  const categories = new Set();
  const responsibles = new Set();

  // From legs data
  legsData.forEach(leg => {
    if (leg['League']) leagues.add(leg['League']);
    if (leg['Home Team']) teams.add(leg['Home Team']);
    if (leg['Away Team']) teams.add(leg['Away Team']);
    if (leg['Bet Type']) betTypes.add(leg['Bet Type']);
    if (leg['Category']) categories.add(leg['Category']);
    if (leg['Responsible']) responsibles.add(leg['Responsible']);
  });

  // From references data
  referencesData.forEach(ref => {
    if (ref['League / Country']) leagues.add(ref['League / Country']);
    if (ref['Team']) teams.add(ref['Team']);
    if (ref['Bet Type']) betTypes.add(ref['Bet Type']);
    if (ref['Bet Category']) categories.add(ref['Bet Category']);
    if (ref['Responsible']) responsibles.add(ref['Responsible']);
  });

  // Create reference items
  for (const name of responsibles) {
    if (name) {
      const id = await getOrCreateReferenceItem('responsible', name);
      referenceMap.set(`responsible:${name}`, id);
    }
  }

  for (const name of leagues) {
    if (name) {
      const id = await getOrCreateReferenceItem('league', name);
      referenceMap.set(`league:${name}`, id);
    }
  }

  for (const name of teams) {
    if (name) {
      const id = await getOrCreateReferenceItem('team', name);
      referenceMap.set(`team:${name}`, id);
    }
  }

  for (const name of betTypes) {
    if (name) {
      const id = await getOrCreateReferenceItem('bet_type', name);
      referenceMap.set(`bet_type:${name}`, id);
    }
  }

  for (const name of categories) {
    if (name) {
      const id = await getOrCreateReferenceItem('category', name);
      referenceMap.set(`category:${name}`, id);
    }
  }

  console.log(`Created ${referenceMap.size} reference items`);

  // Create main bets
  console.log('\nCreating main bets...');
  const betIdMap = new Map(); // Maps CSV bet ID to database UUID

  for (const bet of mainBetsData) {
    // Skip empty rows
    if (!bet['Date'] || !bet['Bet ID']) {
      console.warn('Skipping row with missing Date or Bet ID:', bet);
      continue;
    }
    
    try {
      const date = parseDate(bet['Date']);
      const stake = parseCurrency(bet['Stake']);
      const odds = parseFloat(bet['Decimal Odds']);
      const state = parseState(bet['State']);
      const profitLoss = parseCurrency(bet['Profit/Loss']);
      const cumulativeProfit = parseCurrency(bet['Cumulative Profit']);

      const { data, error } = await supabase
        .from('main_bets')
        .insert({
          user_id: USER_ID,
          date: date,
          stake: stake,
          odds: odds,
          state: state,
          profit_loss: profitLoss,
          cumulative_profit: cumulativeProfit,
          notes: null
        })
        .select('id')
        .single();

      if (error) {
        console.error(`Error creating bet ${bet['Bet ID']}:`, error);
        continue;
      }

      betIdMap.set(bet['Bet ID'], data.id);
      console.log(`Created bet ${bet['Bet ID']} -> ${data.id}`);
    } catch (error) {
      console.error(`Error processing bet ${bet['Bet ID']}:`, error.message);
      console.error('Bet data:', bet);
      continue;
    }
  }

  console.log(`Created ${betIdMap.size} main bets`);

  // Create legs
  console.log('\nCreating legs...');
  let legCount = 0;

  for (const leg of legsData) {
    const mainBetId = betIdMap.get(leg['Main Bet ID']);
    if (!mainBetId) {
      console.warn(`Skipping leg - main bet ${leg['Main Bet ID']} not found`);
      continue;
    }

    const leagueId = leg['League'] ? referenceMap.get(`league:${leg['League']}`) : null;
    const homeTeamId = leg['Home Team'] ? referenceMap.get(`team:${leg['Home Team']}`) : null;
    const awayTeamId = leg['Away Team'] ? referenceMap.get(`team:${leg['Away Team']}`) : null;
    const betTypeId = leg['Bet Type'] ? referenceMap.get(`bet_type:${leg['Bet Type']}`) : null;
    const categoryId = leg['Category'] ? referenceMap.get(`category:${leg['Category']}`) : null;
    const responsibleId = leg['Responsible'] ? referenceMap.get(`responsible:${leg['Responsible']}`) : null;

    const odd = parseFloat(leg['Decimal Odds']);
    const resultState = parseState(leg['Result State']);

    const { error } = await supabase
      .from('legs')
      .insert({
        main_bet_id: mainBetId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        league_id: leagueId,
        bet_type_id: betTypeId,
        category_id: categoryId,
        responsible_id: responsibleId,
        odd: odd,
        result_state: resultState,
        notes: null
      });

    if (error) {
      console.error(`Error creating leg for bet ${leg['Main Bet ID']}:`, error);
      continue;
    }

    legCount++;
  }

  console.log(`Created ${legCount} legs`);
  console.log('\nImport completed successfully!');
}

// Run the import
importData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

