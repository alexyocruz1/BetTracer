Bet Insights — Full Project Documentation (README)

Complete, production-ready guide for building a scalable Bet Tracking & Analytics platform with ML and secure per-user data isolation.
Use this file to onboard your dev team, delegate tasks, and run the project from 0 → 100.

⸻

Table of contents
	1.	Vision & Goals￼
	2.	High-level architecture￼
	3.	Tech choices & rationale (full reasoning)￼
	4.	Database design (schema & SQL)￼
	5.	API design (endpoints & payloads)￼
	6.	Authentication & security (Supabase + RLS)￼
	7.	ML design, data pipeline & deployment￼
	8.	Hosting map (free options explained)￼
	9.	Complete step-by-step roadmap (0 → 100)￼
	10.	Folder structure & env examples￼
	11.	CI / CD, monitoring & ops notes￼
	12.	Team roles & task delegation (detailed)￼
	13.	Deliverables checklist (actionable)￼
	14.	Future improvements & scaling notes￼
	15.	Appendices: SQL snippets, Example payloads, Policies￼

⸻

Vision & Goals

Primary purpose: a secure, multi-user web app to record bets (with multiple legs), update results, produce deep analytics, and power predictive models (ML) that provide actionable insights (probabilities, ROI suggestions, feature importance).

Non-functional goals:
	•	Highly modular and testable (separate frontend, backend, ML service, analytics).
	•	Cloud-native, deployable on free tiers initially.
	•	Production-grade security for per-user data (Row Level Security).
	•	Easy to extend (more metrics, retraining, multi-tenancy).

Key capabilities for MVP:
	•	Create / update MainBet with Legs atomically.
	•	Display user-specific dashboards and KPIs.
	•	Export/import Excel/CSV.
	•	ML predict endpoint returning probability for a bet/leg.

⸻

High-level architecture
+----------------------+            +----------------------+            +------------------+
|  Frontend (Next.js)  | <---HTTPS--|  Backend API         | <---SQL----|  Supabase DB     |
|  (Vercel)            |            |  (Node.js/Express)   |            |  (Postgres + Auth)|
+----------------------+            +----------------------+            +------------------+
         |                                     |
         |                                     |
         v                                     v
  (calls ML predict)                     (calls ML predict)
+----------------------+            +----------------------+
|  ML Service (FastAPI)|            |  Analytics / ETL     |
|  (Render/Colab)      |            |  (Prefect/Colab/dbt) |
+----------------------+            +----------------------+

Architecture decision: Frontend → Backend → Supabase (not direct Frontend → Supabase)

Data flow summary:
	1.	User authenticates via Supabase Auth directly from frontend (email/password).
	2.	Frontend receives JWT token and includes it in API requests to backend (Bearer token).
	3.	Backend validates JWT token via Supabase SDK, extracts user_id.
	4.	User enters bets in frontend → frontend calls backend API (with JWT token).
	5.	Backend validates request, applies business logic, writes main_bets + legs to Supabase (Postgres) in a transaction.
	6.	Backend calls ML service /predict endpoint (if needed) to get probabilities.
	7.	Backend returns response to frontend with data and ML predictions.
	8.	Backend schedules/triggers analytic refresh (ETL) to update summary tables/materialized views.
	9.	ML service trains on historical exports (S3/CSV) and exposes /predict endpoint.

Key architectural decisions:
	•	Frontend uses Supabase Auth client for authentication (no backend auth endpoints).
	•	Backend validates JWT tokens and enforces business logic.
	•	ML service is called only through backend (never directly from frontend).
	•	Backend uses Supabase service_role key for privileged operations (bypasses RLS when needed).
	•	RLS policies ensure users can only access their own data at DB level.

⸻

Tech choices & rationale (full reasoning)

I chose these tools balancing long-term scalability, ecosystem maturity, ML friendliness, and generous free tiers.

Database + Auth: Supabase (Postgres)
	•	Why: Managed Postgres with built-in Auth, Row-Level Security (RLS), REST / GraphQL auto-APIs, storage. Postgres is the gold standard for relational data and ensures complex analytics (joins, window functions) remain performant.
	•	Benefits: RLS makes per-user data isolation straightforward. Service role keys let backend/ETL/ML access data securely.
	•	Alternatives considered: Neon (modern Postgres) — also good, but Supabase wins for integrated Auth + APIs.

Backend API: Node.js + Express (or NestJS)
	•	Why: Rapid development, excellent JS ecosystem, easy integration with frontend, and simple to deploy on Render/Railway. Use supabase-js for direct DB operations if desired or use the Postgres pg client.
	•	ML integration: Node backend can easily call ML service endpoints. Python-based ML often uses FastAPI — the API contract is language-agnostic.
	•	Alternative: Python FastAPI for backend — excellent for analytics-heavy backends. We chose Node for max interoperability with React frontend, but FastAPI is equally valid if team is Python-first.

Frontend: Next.js 13+ (App Router) + React + TypeScript
	•	Why: Best for data-heavy dashboards, server-side rendering for any SEO needs, excellent dev DX, and Vercel hosting (very free-friendly). App Router provides better structure and performance. TypeScript enforces types across API contracts.
	•	Charts: Recharts, Chart.js or Plotly.js — start with Recharts/Chart.js for speed.
	•	State management: React Context for auth, consider Zustand or Redux Toolkit if needed.
	•	Form validation: React Hook Form + Zod for client-side validation.
	•	UI components: Consider shadcn/ui or Tailwind UI for consistent, beautiful UI components.

Machine Learning: Python (scikit-learn, XGBoost, LightGBM), model serving with FastAPI
	•	Why: Python ecosystem is the industry standard for ML. Start with simpler models (logistic regression, random forest, XGBoost), evaluate metrics, then progress. FastAPI is lightweight and ideal for serving models.
	•	Training environment: Google Colab for experiments (free) and use joblib/MLflow for artifact/versioning. Use scheduled training via a pipeline later.

Orchestration & ETL: Prefect / simple cron / dbt (optional)
	•	Why: For nightly aggregate refreshes, data validation, and dataset exports for ML training. Start simple (cron job or npm script) then move to Prefect or Airflow as needed.

Hosting (free-tier first): Vercel (frontend), Render/Railway (backend & ML), Supabase (DB/Auth), Google Colab (training).
	•	Why: All have free tiers sufficient for MVP and small production. Tools are swapable later to AWS/GCP when scaling.

⸻

Database design (schema & SQL)

Design principles:
	•	Use UUIDs for primary keys.
	•	Add user_id (auth.users.id) to main_bets only (legs accessible via main_bet relationship).
	•	Use Supabase auth.users + profiles table (no separate users table).
	•	Keep reference table to normalize teams/leagues/categories.
	•	Maintain created_at / updated_at timestamps.
	•	Support soft deletes with deleted_at column.
	•	Use materialized views or analytics tables for heavy queries.
	•	Add performance indexes for common queries.

Core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reference items for teams, leagues, bet types, etc.
CREATE TABLE reference_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL, -- 'team','league','bet_type','category','responsible'
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(kind, name)
);

-- Main bets table
CREATE TABLE main_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  stake NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  odds NUMERIC(12,6) CHECK (odds > 0),
  profit_loss NUMERIC(12,2),
  state TEXT CHECK (state IN ('pending','won','lost','void')) DEFAULT 'pending',
  cumulative_profit NUMERIC(14,2), -- Per-user cumulative profit over time
  notes TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete support
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Legs table (no user_id - accessed via main_bet relationship)
CREATE TABLE legs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  main_bet_id UUID NOT NULL REFERENCES main_bets(id) ON DELETE CASCADE,
  home_team_id UUID REFERENCES reference_items(id),
  away_team_id UUID REFERENCES reference_items(id),
  league_id UUID REFERENCES reference_items(id),
  bet_type_id UUID REFERENCES reference_items(id),
  category_id UUID REFERENCES reference_items(id),
  responsible_id UUID REFERENCES reference_items(id),
  odd NUMERIC(12,6) NOT NULL CHECK (odd > 0),
  result_state TEXT CHECK (result_state IN ('pending','won','lost','void')) DEFAULT 'pending',
  probability_est NUMERIC(5,4), -- ML predicted probability
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Analytics summary table (daily aggregates)
CREATE TABLE daily_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_stake NUMERIC(14,2),
  total_profit NUMERIC(14,2),
  win_rate NUMERIC(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(date, user_id)
);

-- Performance indexes
CREATE INDEX idx_main_bets_user_date ON main_bets(user_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_main_bets_user_state ON main_bets(user_id, state) WHERE deleted_at IS NULL;
CREATE INDEX idx_legs_main_bet_id ON legs(main_bet_id);
CREATE INDEX idx_legs_league ON legs(league_id) WHERE league_id IS NOT NULL;
CREATE INDEX idx_legs_responsible ON legs(responsible_id) WHERE responsible_id IS NOT NULL;
CREATE INDEX idx_reference_items_kind ON reference_items(kind);
CREATE INDEX idx_daily_summary_user_date ON daily_summary(user_id, date DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_main_bets_updated_at BEFORE UPDATE ON main_bets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legs_updated_at BEFORE UPDATE ON legs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reference_items_updated_at BEFORE UPDATE ON reference_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_summary_updated_at BEFORE UPDATE ON daily_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

Notes:
	•	profiles table extends Supabase auth.users with additional user data.
	•	reference_items reduces duplicated team/league names and eases joins.
	•	user_id only on main_bets; legs accessed via main_bet relationship.
	•	cumulative_profit is per-user cumulative profit over time (calculated when bet state changes).
	•	Soft deletes supported via deleted_at (queries filter WHERE deleted_at IS NULL).
	•	Use materialized views for heavy aggregations then refresh periodically.
	•	Indexes optimize common query patterns (user bets, date ranges, filters).

⸻

API design (endpoints & payloads)

Design RESTful endpoints. Use OpenAPI/Swagger for documentation (FastAPI auto-generates, or Swagger for Node.js).

Authentication: All endpoints protected by JWT; backend validates Supabase JWT tokens from Authorization: Bearer <token> header.
	•	Frontend handles auth via Supabase Auth client (no backend auth endpoints).
	•	Backend middleware validates JWT and extracts user_id from token.

Error response format (standardized):
{
  "error": {
    "code": "ERROR_CODE", // e.g., "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED"
    "message": "Human-readable error message",
    "details": {} // Optional: additional error context
  }
}

Success response format:
{
  "data": {}, // Response data
  "meta": {} // Optional: metadata (pagination, etc.)
}

Bets & Legs

POST /api/bets — Create MainBet + Legs (atomic transaction)
	•	Request headers: Authorization: Bearer <jwt_token>
	•	Request body:
{
  "date": "2025-11-07T18:30:00Z",
  "stake": 50.00,
  "odds": 3.5, // Optional: calculated from legs if not provided
  "state": "pending",
  "notes": "Evening parlays",
  "legs": [
    {
      "home_team_id": "uuid", // Optional
      "away_team_id": "uuid", // Optional
      "league_id": "uuid",
      "bet_type_id": "uuid",
      "category_id": "uuid",
      "responsible_id": "uuid",
      "odd": 1.75,
      "result_state": "pending",
      "notes": "Optional leg notes"
    }
  ]
}
	•	Response: 201 Created
{
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "date": "2025-11-07T18:30:00Z",
    "stake": 50.00,
    "odds": 3.5,
    "state": "pending",
    "profit_loss": null,
    "cumulative_profit": 100.50,
    "notes": "Evening parlays",
    "legs": [...],
    "created_at": "2025-11-07T18:30:00Z",
    "updated_at": "2025-11-07T18:30:00Z"
  }
}

GET /api/bets — List bets (with pagination and filters)
	•	Query params: start_date, end_date, state, league_id, responsible_id, limit (default: 20), offset (default: 0)
	•	Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "date": "2025-11-07T18:30:00Z",
      "stake": 50.00,
      "odds": 3.5,
      "state": "pending",
      "profit_loss": null,
      "cumulative_profit": 100.50,
      "legs_count": 2,
      "created_at": "2025-11-07T18:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}

GET /api/bets/{id} — Get bet details (including legs)
	•	Response: 200 OK
{
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "date": "2025-11-07T18:30:00Z",
    "stake": 50.00,
    "odds": 3.5,
    "state": "pending",
    "profit_loss": null,
    "cumulative_profit": 100.50,
    "notes": "Evening parlays",
    "legs": [
      {
        "id": "uuid",
        "home_team_id": "uuid",
        "away_team_id": "uuid",
        "league_id": "uuid",
        "bet_type_id": "uuid",
        "category_id": "uuid",
        "responsible_id": "uuid",
        "odd": 1.75,
        "result_state": "pending",
        "probability_est": 0.5714,
        "notes": null
      }
    ],
    "created_at": "2025-11-07T18:30:00Z",
    "updated_at": "2025-11-07T18:30:00Z"
  }
}

PATCH /api/bets/{id} — Update bet fields
	•	Request body: Partial update (only fields to update)
{
  "stake": 75.00,
  "notes": "Updated notes"
}
	•	Response: 200 OK (returns updated bet)

PATCH /api/bets/{id}/state — Update bet state and recalculate cumulative profit
	•	Request body:
{
  "state": "won", // or "lost", "void"
  "profit_loss": 125.00 // Optional: calculated if not provided
}
	•	Response: 200 OK (returns updated bet with recalculated cumulative_profit)

DELETE /api/bets/{id} — Soft delete bet
	•	Response: 204 No Content
	•	Sets deleted_at timestamp (bet not actually deleted)

Legs

PUT /api/legs/{id} — Update leg
	•	Request body: Full leg object
	•	Response: 200 OK (returns updated leg)

PATCH /api/legs/{id}/state — Update leg state only
	•	Request body:
{
  "result_state": "won" // or "lost", "void"
}
	•	Response: 200 OK (returns updated leg)

Reference Items

GET /api/reference-items — List reference items (teams, leagues, etc.)
	•	Query params: kind (filter by kind: 'team', 'league', 'bet_type', 'category', 'responsible')
	•	Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "kind": "league",
      "name": "EPL",
      "metadata": {}
    }
  ]
}

POST /api/reference-items — Create reference item (admin only or user-specific)
	•	Request body:
{
  "kind": "league",
  "name": "EPL",
  "metadata": {}
}
	•	Response: 201 Created

Analytics

GET /api/analytics/summary — Get user summary KPIs
	•	Query params: start_date, end_date (optional date range)
	•	Response: 200 OK
{
  "data": {
    "total_stake": 1000.00,
    "total_profit": 250.00,
    "roi": 0.25, // 25%
    "win_rate": 0.65, // 65%
    "total_bets": 50,
    "won_bets": 32,
    "lost_bets": 15,
    "pending_bets": 3,
    "cumulative_profit": 250.00
  }
}

GET /api/analytics/by-league — Get analytics grouped by league
	•	Query params: start_date, end_date
	•	Response: 200 OK
{
  "data": [
    {
      "league_id": "uuid",
      "league_name": "EPL",
      "total_stake": 500.00,
      "total_profit": 150.00,
      "roi": 0.30,
      "win_rate": 0.70,
      "bet_count": 20
    }
  ]
}

GET /api/analytics/by-responsible — Get analytics grouped by responsible person
	•	Query params: start_date, end_date
	•	Response: 200 OK (similar structure to by-league)

GET /api/analytics/time-series — Get time-series data for charts
	•	Query params: granularity (daily, weekly, monthly), start_date, end_date
	•	Response: 200 OK
{
  "data": [
    {
      "date": "2025-11-07",
      "stake": 100.00,
      "profit": 25.00,
      "bet_count": 5
    }
  ]
}

ML / Predictions

POST /api/ml/predict — Get ML predictions for a bet
	•	Request body:
{
  "legs": [
    {
      "league_id": "uuid",
      "bet_type_id": "uuid",
      "category_id": "uuid",
      "responsible_id": "uuid",
      "odd": 1.75
    }
  ],
  "stake": 50.00 // Optional: for stake suggestion
}
	•	Response: 200 OK
{
  "data": {
    "per_leg_probabilities": [0.62, 0.48],
    "combined_probability": 0.2976,
    "suggested_stake": 8.5, // Kelly criterion or other method
    "expected_value": 1.04, // Expected ROI
    "confidence": 0.75 // Model confidence
  }
}
	•	Note: Backend calls ML service internally (not exposed directly to frontend)

⸻

Authentication & security (Supabase + RLS)

Why Supabase Auth?
	•	Integrated with DB (auth.users).
	•	Supports email/password, OAuth providers, and magic links.
	•	You can enforce Row-Level Security (RLS) at DB layer; queries by frontend/users only return permitted rows.
	•	Frontend handles authentication directly with Supabase Auth client.

Implementation steps

1. Enable Auth in Supabase
	•	Turn on email+password authentication in Supabase dashboard.
	•	Configure email templates if needed.
	•	Optionally enable OAuth providers (Google, GitHub, etc.).

2. Create profiles table (extends auth.users)
	•	Already defined in database schema (see Database design section).
	•	Create trigger to automatically create profile when user signs up:

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

3. Enable RLS on all user-owned tables
	•	Enable RLS on main_bets, legs, daily_summary, and profiles:

ALTER TABLE main_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

4. Create RLS policies

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Main bets policies
CREATE POLICY "Users can select own main_bets"
  ON main_bets FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own main_bets"
  ON main_bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own main_bets"
  ON main_bets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own main_bets"
  ON main_bets FOR DELETE
  USING (auth.uid() = user_id);

-- Legs policies (users access via main_bet relationship)
CREATE POLICY "Users can select own legs"
  ON legs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
      AND main_bets.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert own legs"
  ON legs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own legs"
  ON legs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
    )
  );

-- Daily summary policies
CREATE POLICY "Users can select own daily_summary"
  ON daily_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_summary"
  ON daily_summary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reference items: can be public (read-only) or user-specific
CREATE POLICY "Anyone can view reference_items"
  ON reference_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert reference_items"
  ON reference_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

5. Backend JWT validation
	•	Backend middleware validates JWT tokens from Authorization header.
	•	Use Supabase SDK to verify token and extract user_id.
	•	Backend uses service_role key only for privileged operations (bypasses RLS when needed).

Frontend auth integration (Next.js)
	•	Use @supabase/supabase-js client library.
	•	Create Supabase client instance with public anon key.
	•	Handle signup, signin, signout via Supabase Auth methods.
	•	Store session in React context or state management.
	•	Use onAuthStateChange to handle session changes.
	•	Include JWT token in API requests to backend (Authorization: Bearer <token>).
	•	Protect routes with authentication checks.

Security best practices
	•	Never expose service_role key in frontend (backend only).
	•	Use HTTPS for all API calls.
	•	Validate all input on backend (Zod/Joi) to prevent injection and bad data.
	•	Rate-limit API endpoints to prevent abuse.
	•	Use CORS properly (restrict to frontend domain in production).
	•	Sanitize user inputs before storing in database.
	•	Use parameterized queries (Supabase client handles this).
	•	Implement proper error handling (don't expose sensitive info in errors).
	•	Log security events (failed auth attempts, etc.).
	•	Regular security audits and dependency updates.

⸻

ML design, data pipeline & deployment

ML strategy: Global model (trained on all users' data) for MVP. Per-user models can be added later if needed.

ML goals
	•	Predict leg/bet win probability.
	•	Suggest stake or flag over/underpriced odds.
	•	Provide feature importance (what drives wins).
	•	Start with global model, evaluate performance, then consider per-user models if beneficial.

Data preparation (features)
	•	Leg-level features:
	•	odd (numeric)
	•	league (one-hot or embedding)
	•	bet_type, category (encoded)
	•	responsible performance metrics (rolling win rate, ROI last 30 days)
	•	Seasonality: weekday, month
	•	Historical team strength (if available)
	•	MainBet-level features:
	•	num_legs, combined_odds (product), stake, average_leg_odds
	•	Labels:
	•	Leg: win (1) / loss (0)
	•	Bet: if all legs won → win (1), else loss (0)

Model training & validation
	•	Start with simple models: logistic regression, random forest.
	•	Then evaluate boosting (XGBoost / LightGBM).
	•	Evaluate via AUC-ROC, precision-recall, calibration (important with probabilities).
	•	Use cross-validation and holdout set.

Model serving & versioning
	•	Save artifact (joblib or pickle).
	•	Expose via a FastAPI microservice /predict.
	•	Use MLflow for tracking experiments & artifacts if possible.

Training environment
	•	Start in Google Colab for free (data export from Supabase to CSV).
	•	Move to scheduled training via a small server or Prefect/cron job.

Integration plan
	1.	Export aggregated feature dataset from Supabase nightly (CSV to S3 or storage).
	2.	Training job loads CSV, trains model, writes model artifact to S3/MLflow.
	3.	Deploy new model on ML service and update endpoint URL or use model registry.
	4.	Backend calls ML service for predictions; results returned to frontend.

Suggestion: Use a simple baseline model first and measure improvement. ML should be a layer, not the foundation — start with analytics and add predictions when dataset and metrics show value.

⸻

Hosting map (free options explained)

Database & Auth
	•	Supabase (free tier) — 500 MB DB, 1 GB storage, Auth and API. Best as single hosted DB + Auth.

Frontend
	•	Vercel — Perfect for Next.js, automatic GH integration, fast CDN; free for hobby and small projects.

Backend
	•	Render or Railway — Free web service instances good for Node.js / Python. Sleep when idle; good for MVP. Can be swapped to a paid instance later.

ML Service
	•	Render (free) for small FastAPI instance. For training, use Google Colab (free) for iterative experiments.

Why these?
	•	All have easy GitHub integration and generous free tiers that allow you to prototype, test and even small production loads. You can later migrate to AWS/GCP/Azure as needed.

⸻

Complete step-by-step roadmap (0 → 100)

This is a prescriptive, granular plan including commands, checkpoints, and acceptance criteria for each step.

Phase 0 — Planning & repo setup
	•	Create a GitHub repo bet-insights-app. Use monorepo:

    bet-insights-app/
├── frontend/
├── backend/
├── ml_service/
└── infra/   (docker-compose, scripts)

	•	Create README.md (this file), CONTRIBUTING.md, CODEOWNERS.
	•	Create issue templates for tasks and PR templates.

Acceptance: Repo initialized with branches main and develop.

⸻

Phase 1 — Database & foundation
	1.	Create Supabase project; note SUPABASE_URL and SUPABASE_ANON_KEY and service role key.
	2.	Implement SQL schema (tables, indexes, triggers, functions from Database design section).
	3.	Enable RLS and create policies (from Authentication & security section).
	4.	Create trigger for automatic profile creation on user signup.
	5.	Test database constraints and indexes.
	6.	Seed reference_items table with initial data (leagues, bet types, categories, etc.) if needed.

Acceptance: Database schema implemented, RLS policies active, constraints and indexes working, test data can be inserted manually.

⸻

Phase 2 — Backend MVP (CRUD + auth integration)
	1.	Scaffold Node.js project (backend/) with express, dotenv, @supabase/supabase-js, zod for validation, jest for tests, and swagger for API docs.
	2.	Implement JWT validation middleware:
	•	Validate incoming Bearer tokens via Supabase SDK.
	•	Extract user_id from JWT token.
	•	Add error handling middleware.
	3.	Implement endpoints:
	•	POST /api/bets — atomic create (main bet + legs in DB transaction).
	•	GET /api/bets (pagination + filters with standardized response format).
	•	GET /api/bets/{id} — get bet details with legs.
	•	PATCH /api/bets/{id} — update bet fields.
	•	PATCH /api/bets/{id}/state — update state and recalculate cumulative profit.
	•	DELETE /api/bets/{id} — soft delete (set deleted_at).
	•	PUT /api/legs/{id} — update leg.
	•	PATCH /api/legs/{id}/state — update leg state.
	•	GET /api/reference-items — list reference items (with filters).
	•	POST /api/reference-items — create reference item.
	4.	Implement input validation with Zod schemas for all endpoints.
	5.	Implement standardized error responses and success responses with pagination metadata.
	6.	Add unit/integration tests for endpoints.
	7.	Set up OpenAPI/Swagger documentation.

Acceptance: Backend passes tests, protects endpoints (401 without token), validates input, returns standardized responses, API docs available.

⸻

Phase 3 — Frontend MVP (data entry + list)
	1.	Scaffold Next.js 13+ App Router project with TypeScript.
	2.	Set up Supabase client and auth context/provider.
	3.	Implement authentication:
	•	Auth screens (signup/login) with Supabase Auth client.
	•	Protected route middleware.
	•	Session management with React context.
	4.	Implement pages:
	•	Dashboard page (/) — summary KPIs and recent bets.
	•	New Bet page (/bets/new) — dynamic form to add legs (with validation).
	•	Bets List page (/bets) — filters, pagination, sorting.
	•	Bet Detail page (/bets/[id]) — view and update bet, update state, view legs.
	5.	Implement API service layer:
	•	Create API client with axios or fetch.
	•	Include JWT token in all requests (Authorization header).
	•	Handle errors and loading states.
	6.	Implement UI components:
	•	Reusable form components with validation.
	•	Loading states and error handling.
	•	Responsive design (mobile-first).
	•	Optimistic updates for better UX.
	7.	Set up shared TypeScript types between frontend and backend.
	8.	Deploy to Vercel.

Acceptance: A logged-in user can create a bet with legs, view their own bets, update bet state, and see loading/error states. UI is responsive and user-friendly.

⸻

Phase 4 — Analytics & dashboards
	1.	Backend: Implement analytics endpoints:
	•	GET /api/analytics/summary — Win rate, ROI, total profit, total stake, bet counts.
	•	GET /api/analytics/by-league — Profit, ROI, win rate by league.
	•	GET /api/analytics/by-responsible — Profit, ROI, win rate by responsible person.
	•	GET /api/analytics/time-series — Time-series data (daily, weekly, monthly).
	2.	Backend: SQL queries / materialized views to compute:
	•	Win rate, ROI, profit by league/responsible.
	•	Time-series profit, stake, bet counts.
	•	Cache heavy queries (materialized views or scheduled refresh).
	3.	Frontend: Build dashboard UI:
	•	KPI cards: Win rate, ROI, total profit, total stake, cumulative profit.
	•	Charts: Time-series profit chart, win rate over time, ROI by category/league.
	•	Tables: Profit by league, profit by responsible person.
	•	Filters: Date range, league, responsible person.
	4.	Use Recharts or Chart.js for charting.
	5.	Implement loading states and error handling for analytics.

Acceptance: Dashboard shows correct KPIs (win rate, ROI, total profit, profit by league/responsible) and charts (time-series profit, win rate over time, ROI by category) for user's data.

⸻

Phase 5 — ML (iterative)
	1.	Export combined dataset for training.
	2.	Colab notebook:
	•	Clean data, engineer features (one-hot / label encoding).
	•	Train baseline models (logistic regression, RandomForest).
	•	Evaluate metrics and calibrate probabilities (calibration curve).
	3.	Persist best model model.pkl.
	4.	Build ml_service/:
	•	FastAPI app with /predict endpoint reading model from disk.
	5.	Deploy ML service (Render).
	6.	Backend integration: call ML service; display probability on bet creation UI.

Acceptance: ML endpoint returns probability and integration displays it in UI. Model evaluation metrics documented.

⸻

Phase 6 — ETL, retraining & automations
	1.	ETL job to export fresh dataset nightly for retraining.
	2.	Training pipeline (Colab or scheduled server) produces new model versions.
	3.	Use MLflow or simple versioning with timestamps to track models.

Acceptance: Retraining pipeline successfully produces a new model and ML service loads latest artifact.

⸻

Phase 7 — Hardening & scaling
	1.	Add logging (structured logs), errors, and Sentry.
	2.	Add backups for Supabase or export snapshots.
	3.	Add CI pipeline (GitHub Actions) to run tests and deploy.
	4.	Switch to paid plans if uptime required (Render, Vercel).

Acceptance: CI/CD passes, monitoring alerts configured.

⸻

Folder structure & env examples

bet-insights-app/
├── frontend/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── signup/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── bets/
│   │   │   │   ├── page.tsx          # Bets list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx      # New bet
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # Bet detail
│   │   │   └── analytics/
│   │   │       └── page.tsx
│   │   ├── api/                      # API routes (if needed)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # Reusable UI components
│   │   ├── forms/                    # Form components
│   │   ├── charts/                   # Chart components
│   │   └── bets/                     # Bet-specific components
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── client.ts
│   │   └── api/
│   │       └── client.ts
│   ├── contexts/
│   │   └── auth-context.tsx
│   ├── types/                        # TypeScript types
│   │   └── index.ts
│   ├── hooks/                        # Custom React hooks
│   ├── utils/                        # Utility functions
│   ├── .env.local
│   ├── next.config.js
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── bets.ts
│   │   │   ├── legs.ts
│   │   │   ├── analytics.ts
│   │   │   ├── reference-items.ts
│   │   │   └── ml.ts
│   │   ├── controllers/
│   │   │   ├── bets.controller.ts
│   │   │   ├── legs.controller.ts
│   │   │   ├── analytics.controller.ts
│   │   │   └── ml.controller.ts
│   │   ├── services/
│   │   │   ├── bets.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   ├── ml.service.ts
│   │   │   └── supabase.service.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── validation.middleware.ts
│   │   ├── schemas/                  # Zod schemas
│   │   │   ├── bets.schema.ts
│   │   │   ├── legs.schema.ts
│   │   │   └── analytics.schema.ts
│   │   ├── types/                    # TypeScript types
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── errors.ts
│   │   │   └── responses.ts
│   │   └── index.ts
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── ml_service/
│   ├── app.py                        # FastAPI app
│   ├── train.py                      # Training script
│   ├── models/
│   │   └── model.pkl
│   ├── notebooks/                    # Jupyter notebooks
│   ├── requirements.txt
│   └── .env
├── shared/                           # Shared types (optional)
│   └── types/
│       └── index.ts
├── infra/
│   ├── docker-compose.yml
│   └── scripts/
├── .github/
│   └── workflows/
│       └── ci.yml
└── README.md

Example .env (backend)
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_KEY=service-role-secret
ML_API_URL=https://ml-service.onrender.com
PORT=8080

Example .env.local (frontend)
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
NEXT_PUBLIC_BACKEND_URL=https://backend.onrender.com

CI / CD, monitoring & ops notes
	•	CI: GitHub Actions run tests + linter + build. PR -> run unit tests and integration tests.
	•	CD: On merge to main, GitHub Actions deploys backend (Render) and frontend (Vercel).
	•	Monitoring: Start with basic logging and uptime monitoring. Add Sentry for error tracking and Prometheus + Grafana later.
	•	Backups: Schedule DB exports (Supabase offers backups) and store them off-site (S3).
	•	Secrets: Use GitHub Secrets / Render environment variables / Vercel environment variables. Never store service role keys in repo.

⸻

Team roles & task delegation (detailed)

Below are suggested roles with initial tasks split in sprints (2-week cadence).

Product lead / PM
	•	Create issue backlog and milestones.
	•	Prioritize MVP features.
	•	Run weekly standups.

Frontend Developer(s)

Sprint 1
	•	Scaffold Next.js + TypeScript project.
	•	Implement Supabase auth flow (signup/login).
	•	Implement New Bet form (add/remove legs).
Sprint 2
	•	Implement Bets list and detail pages.
	•	Add basic charts on dashboard.
Deliverables: Deployed Vercel app with auth & forms.

Backend Developer(s)

Sprint 1
	•	Scaffold Express app with Supabase client.
	•	Implement POST /bets (atomic transaction).
	•	Implement GET /bets and GET /bets/{id}.
Sprint 2
	•	Implement analytics endpoints.
	•	Add tests and CI integration.
Deliverables: Deployed backend on Render with documented endpoints.

Data Engineer
	•	Design DB schema, RLS policies.
	•	Implement database migrations and seed scripts.
	•	Add indexes, triggers, and materialized views for analytics.
	•	Optimize queries for performance.
Deliverables: Supabase project with schema, RLS enforced, indexes and triggers working.

ML Engineer / Data Scientist

Sprint 1
	•	Create Colab notebook for EDA and baseline model.
	•	Produce model.pkl and evaluation report.
Sprint 2
	•	Build ML FastAPI service and deploy to Render.
	•	Integrate model with backend.
Deliverables: Deployed ML service and integration.

DevOps / Infra
	•	Dockerize services (optional for local).
	•	CI/CD pipelines (GitHub Actions).
	•	Monitoring and backups.

⸻

Deliverables checklist (actionable)
	•	Repo skeleton (frontend/backend/ml/infra) with proper folder structure
	•	Supabase project created + schema migrated (tables, indexes, triggers, RLS policies)
	•	Backend API fully implemented (+ tests, validation, error handling)
	•	Frontend auth & CRUD implemented (Next.js App Router, Supabase Auth)
	•	Dashboard with core KPIs (win rate, ROI, total profit, profit by league/responsible)
	•	Charts implemented (time-series profit, win rate over time, ROI by category)
	•	ML baseline trained (global model) and service deployed
	•	Predict feature integrated in UI (backend calls ML service)
	•	CI pipelines + deployments configured (GitHub Actions)
	•	API documentation published (OpenAPI/Swagger)
	•	TypeScript types shared between frontend and backend
	•	Error handling and validation implemented throughout

⸻

Future improvements & scaling notes
	•	Data warehouse: Move historical data to a data warehouse (BigQuery / Redshift) when dataset grows.
	•	Time-series DB: Use TimescaleDB (Postgres extension) for extremely large time-series analytics.
	•	Model ops: Use MLflow for experiment tracking and model registry.
	•	Multi-tenancy: Introduce org-level separation and billing if SaaS.
	•	Realtime updates: Use websockets or realtime features (Supabase Realtime) for live dashboards.

⸻

Appendices: SQL snippets, Example payloads, Policies

SQL: RLS policies (complete set)

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Main bets policies
CREATE POLICY "Users can select own main_bets"
  ON main_bets FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own main_bets"
  ON main_bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own main_bets"
  ON main_bets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own main_bets"
  ON main_bets FOR DELETE
  USING (auth.uid() = user_id);

-- Legs policies (users access via main_bet relationship, no user_id on legs)
CREATE POLICY "Users can select own legs"
  ON legs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
      AND main_bets.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert own legs"
  ON legs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own legs"
  ON legs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
    )
  );

-- Daily summary policies
CREATE POLICY "Users can select own daily_summary"
  ON daily_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_summary"
  ON daily_summary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reference items policies (public read, authenticated insert)
CREATE POLICY "Anyone can view reference_items"
  ON reference_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert reference_items"
  ON reference_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

Example POST /bets payload
{
  "date": "2025-11-07T18:30:00Z",
  "stake": 100,
  "odds": 3.50,
  "state": "pending",
  "notes": "Weekend parlay",
  "legs": [
    {
      "home_team_id": "uuid-team-1",
      "away_team_id": "uuid-team-2",
      "league_id": "uuid-league-1",
      "bet_type_id": "uuid-type-1",
      "category_id": "uuid-cat-1",
      "responsible_id": "uuid-resp-1",
      "odd": 1.75,
      "result_state": "pending"
    },
    {
      "home_team_id": "uuid-team-3",
      "away_team_id": "uuid-team-4",
      "league_id": "uuid-league-2",
      "bet_type_id": "uuid-type-2",
      "category_id": "uuid-cat-2",
      "responsible_id": "uuid-resp-1",
      "odd": 2.00,
      "result_state": "pending"
    }
  ]
}

ML predict API request / response example

Request
{
  "legs": [
    {"league":"EPL","type":"MatchResult","odd":1.75,"category":"standard","responsible":"alex"},
    {"league":"LaLiga","type":"OverUnder","odd":2.00,"category":"over","responsible":"alex"}
  ],
  "user_id":"user-uuid"
}

Response
{
  "per_leg_probabilities":[0.62,0.48],
  "combined_probability":0.2976,
  "suggested_stake": 8.5
}

⸻

Summary of Key Decisions & Improvements

This section summarizes the key architectural decisions and improvements made to the original plan.

Database Schema Improvements
	•	Removed user_id from legs table (access via main_bet relationship).
	•	Removed separate users table (use auth.users + profiles table).
	•	Added soft delete support (deleted_at column).
	•	Added comprehensive indexes for performance.
	•	Added triggers for automatic updated_at timestamps.
	•	Added check constraints for data validation (stake > 0, odds > 0).
	•	Clarified cumulative_profit as per-user cumulative over time.

Architecture Decisions
	•	Frontend → Backend → Supabase (not direct Frontend → Supabase).
	•	Frontend uses Supabase Auth client directly (no backend auth endpoints).
	•	Backend validates JWT tokens and enforces business logic.
	•	ML service called only through backend (never directly from frontend).
	•	RLS policies ensure users can only access their own data at DB level.

API Design Improvements
	•	Standardized error response format.
	•	Standardized success response format with pagination metadata.
	•	Added comprehensive input validation with Zod.
	•	Added OpenAPI/Swagger documentation.
	•	Removed backend auth endpoints (handled by Supabase Auth).
	•	Added reference-items endpoints for managing teams, leagues, etc.
	•	Added comprehensive analytics endpoints (summary, by-league, by-responsible, time-series).

Frontend Improvements
	•	Next.js 13+ App Router (instead of Pages Router).
	•	Shared TypeScript types between frontend and backend.
	•	React Hook Form + Zod for form validation.
	•	Consider shadcn/ui or Tailwind UI for beautiful UI components.
	•	Responsive design (mobile-first).
	•	Optimistic updates for better UX.
	•	Proper loading states and error handling.

Backend Improvements
	•	Zod for input validation (type-safe).
	•	Standardized error handling middleware.
	•	JWT validation middleware.
	•	Comprehensive test coverage (unit + integration).
	•	OpenAPI/Swagger documentation.
	•	Proper logging and error tracking.

ML Strategy
	•	Global model (trained on all users' data) for MVP.
	•	Per-user models can be added later if beneficial.
	•	Backend calls ML service internally (not exposed directly to frontend).

Data Import
	•	Removed Excel import script (manual data entry for MVP).
	•	Can be added later if needed.

Security Improvements
	•	Comprehensive RLS policies for all tables.
	•	Legs accessed via main_bet relationship (no direct user_id).
	•	Soft deletes prevent accidental data loss.
	•	Input validation on all endpoints.
	•	Proper CORS configuration.
	•	Rate limiting (recommended for production).

Testing & Quality
	•	Unit tests for business logic.
	•	Integration tests for API endpoints.
	•	E2E tests for critical flows (recommended).
	•	CI/CD pipelines with GitHub Actions.
	•	Code linting and formatting.

UI/UX Improvements
	•	Beautiful, modern UI with good UX.
	•	Responsive design (mobile-first).
	•	Loading states and error handling.
	•	Optimistic updates.
	•	Clear error messages.
	•	Accessible components.

This refined plan provides a solid foundation for building a production-ready Bet Tracking & Analytics platform with ML capabilities, secure per-user data isolation, and excellent user experience.