# Analytics Gap Analysis

Based on the imported historical data and current implementation, here are the missing analytics features:

## ✅ Currently Implemented

### Dashboard
- Total Profit
- Win Rate
- ROI
- Total Bets

### Analytics Page
- Performance by League (charts + table)
- Performance Over Time (profit trend, cumulative profit)
- Daily/Weekly/Monthly breakdowns

### Backend Available (but not used in frontend)
- ✅ `getByResponsible` - Performance by Responsible person

## ❌ Missing Analytics

### 1. **Performance by Responsible** (Backend exists, frontend missing!)
- Backend endpoint: `/api/analytics/by-responsible`
- Should show: Profit, ROI, Win Rate by responsible person
- Useful for: Tracking which account/person performs better

### 2. **Performance by Bet Type**
- Not implemented in backend or frontend
- Should show: Profit, ROI, Win Rate by bet type (Match Goals, Team Win, etc.)
- Useful for: Identifying which bet types are most profitable

### 3. **Performance by Category**
- Not implemented in backend or frontend
- Should show: Profit, ROI, Win Rate by category (Over 2.5 Goals, Both Teams To Score, etc.)
- Useful for: Finding winning betting strategies

### 4. **Performance by Team**
- Not implemented in backend or frontend
- Should show: Profit, ROI, Win Rate by team (home/away)
- Useful for: Identifying teams you bet on successfully

### 5. **Leg-Level Analytics**
- Not implemented
- Should show: 
  - Leg win rate (separate from bet win rate)
  - Most profitable leg types
  - Leg performance by league/bet type
- Useful for: Understanding which individual legs win most often

### 6. **Odds Analysis**
- Not implemented
- Should show:
  - Performance by odds range (e.g., 1.0-1.5, 1.5-2.0, 2.0+)
  - Best odds range for profitability
- Useful for: Finding optimal odds ranges

### 7. **Parlay vs Single Comparison**
- Not implemented (but data exists in CSV: "Type" column)
- Should show: Comparison of Single vs Parlay bets
- Useful for: Understanding which bet structure works better

### 8. **Date Range Filters**
- Not implemented in frontend
- Backend supports startDate/endDate but frontend doesn't use it
- Should allow: Filtering analytics by date range
- Useful for: Analyzing specific time periods

### 9. **Best/Worst Performers**
- Not implemented
- Should show:
  - Top 5 most profitable leagues/teams/bet types
  - Bottom 5 least profitable
- Useful for: Quick insights into what works/doesn't work

### 10. **Streak Analysis**
- Not implemented
- Should show:
  - Current win/loss streak
  - Longest win streak
  - Longest loss streak
- Useful for: Understanding betting patterns

## Priority Recommendations

### High Priority (Implement First)
1. **Performance by Responsible** - Backend exists, just needs frontend
2. **Date Range Filters** - Backend supports it, just needs UI
3. **Performance by Bet Type** - Important for strategy analysis
4. **Performance by Category** - Critical for finding winning patterns

### Medium Priority
5. **Leg-Level Analytics** - Valuable for understanding individual leg performance
6. **Best/Worst Performers** - Quick insights
7. **Odds Analysis** - Useful for optimization

### Low Priority (Nice to Have)
8. **Parlay vs Single** - Requires adding "Type" field to database
9. **Team Performance** - Less critical than bet type/category
10. **Streak Analysis** - Nice to have but not essential

