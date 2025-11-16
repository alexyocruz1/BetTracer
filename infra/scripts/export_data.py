#!/usr/bin/env python3
"""
BetTracer ETL Script - Export Data for ML Training
Exports bet data from Supabase to CSV for ML model training
"""

import os
import csv
import requests
from datetime import datetime
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

def export_bets_data():
    """Export bets and legs data to CSV for ML training"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("Missing Supabase environment variables")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Fetch all resolved bets with legs
    response = supabase.table('main_bets')\
        .select('*, legs(*)')\
        .in_('state', ['won', 'lost', 'void'])\
        .is_('deleted_at', None)\
        .execute()

    bets = response.data

    # Prepare data for CSV
    csv_data = []
    for bet in bets:
        for leg in bet.get('legs', []):
            csv_data.append({
                'bet_id': bet['id'],
                'user_id': bet['user_id'],
                'date': bet['date'],
                'stake': bet['stake'],
                'odds': bet['odds'],
                'state': bet['state'],
                'profit_loss': bet.get('profit_loss', 0),
                'league_id': leg.get('league_id'),
                'bet_type_id': leg.get('bet_type_id'),
                'category_id': leg.get('category_id'),
                'responsible_id': leg.get('responsible_id'),
                'leg_odd': leg.get('odd'),
                'leg_result_state': leg.get('result_state'),
                'created_at': bet['created_at'],
            })

    # Write to CSV
    output_file = f'data/export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    os.makedirs('data', exist_ok=True)

    with open(output_file, 'w', newline='') as csvfile:
        fieldnames = csv_data[0].keys() if csv_data else []
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_data)

    print(f"Exported {len(csv_data)} records to {output_file}")
    return output_file

if __name__ == '__main__':
    export_bets_data()

