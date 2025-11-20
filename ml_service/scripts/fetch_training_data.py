"""
Fetch training data directly from Supabase.
No manual export needed - runs automatically!
"""
import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def fetch_training_data_from_db():
    """
    Fetch training data directly from Supabase.
    No manual export needed - runs automatically!
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    print("Fetching training data from Supabase...")
    
    # Fetch all completed bets (won/lost, not pending)
    # Use pagination to handle large datasets
    all_bets = []
    page_size = 1000
    offset = 0
    
    while True:
        response = supabase.table("main_bets")\
            .select("*, legs(*)")\
            .in_("state", ["won", "lost"])\
            .is_("deleted_at", "null")\
            .order("date", desc=False)\
            .range(offset, offset + page_size - 1)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            break
            
        all_bets.extend(response.data)
        offset += page_size
        
        if len(response.data) < page_size:
            break
    
    print(f"Fetched {len(all_bets)} bets from database")
    
    # Convert to DataFrame
    data = []
    for bet in all_bets:
        legs = bet.get("legs", [])
        if not legs:
            continue
            
        for leg in legs:
            data.append({
                "bet_id": bet["id"],
                "user_id": bet["user_id"],
                "date": bet["date"],
                "stake": float(bet["stake"]) if bet["stake"] else 0,
                "odds": float(bet["odds"]) if bet["odds"] else 1.0,
                "bet_state": bet["state"],
                "profit_loss": float(bet.get("profit_loss", 0)) if bet.get("profit_loss") else 0,
                "leg_id": leg["id"],
                "leg_odd": float(leg["odd"]) if leg["odd"] else 1.0,
                "leg_result": leg.get("result_state", "pending"),
                "league_id": leg.get("league_id"),
                "bet_type_id": leg.get("bet_type_id"),
                "category_id": leg.get("category_id"),
                "responsible_id": leg.get("responsible_id"),
                "home_team_id": leg.get("home_team_id"),
                "away_team_id": leg.get("away_team_id"),
            })
    
    df = pd.DataFrame(data)
    print(f"Created DataFrame with {len(df)} leg records")
    
    if len(df) == 0:
        print("⚠️  Warning: No training data found. Make sure you have completed bets (won/lost) in your database.")
    
    return df

if __name__ == "__main__":
    df = fetch_training_data_from_db()
    if len(df) > 0:
        # Optionally save to CSV for inspection
        os.makedirs("data", exist_ok=True)
        df.to_csv("data/training_data.csv", index=False)
        print(f"✅ Data saved to data/training_data.csv")
    else:
        print("❌ No data to save")

