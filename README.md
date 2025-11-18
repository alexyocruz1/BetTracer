# BetTracer - Bet Tracking & Analytics Platform

A secure, multi-user web application to record bets (with multiple legs), update results, produce deep analytics, and power predictive models (ML) that provide actionable insights.

## 🎯 Project Overview

BetTracer is a comprehensive bet tracking platform with:
- **Secure per-user data isolation** (Row-Level Security)
- **Advanced analytics** (KPIs, charts, time-series analysis)
- **ML-powered predictions** (win probability, stake suggestions)
- **Modern, beautiful UI** with excellent UX
- **Scalable architecture** (cloud-native, free-tier friendly)

## 🏗️ Architecture

```
Frontend (Next.js) → Backend (Node.js/Express) → Supabase (Postgres + Auth)
                              ↓
                        ML Service (FastAPI)
```

- **Frontend**: Next.js 13+ (App Router) + React + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (Postgres + Auth + RLS)
- **ML Service**: Python + FastAPI
- **Hosting**: Vercel (frontend), Render (backend & ML), Supabase (DB)

## 📁 Project Structure

```
BetTracer/
├── frontend/          # Next.js frontend application
├── backend/           # Node.js/Express backend API
├── ml_service/        # Python FastAPI ML service
├── infra/             # Infrastructure scripts and configs
└── BetTracerGuide.md  # Complete project documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+
- Supabase account (free tier works)
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BetTracer
   ```

2. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL schema from `BetTracerGuide.md` (Database design section)
   - Note your `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY`

3. **Set up Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your Supabase credentials
   npm run dev
   ```

4. **Set up Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   npm run dev
   ```

5. **Set up ML Service** (optional for MVP)
   ```bash
   cd ml_service
   pip install -r requirements.txt
   # Set up .env with ML service configuration
   uvicorn app:app --reload
   ```

## 📚 Documentation

Complete project documentation is available in [`BetTracerGuide.md`](./BetTracerGuide.md). This includes:
- Database design and schema
- API design and endpoints
- Authentication & security
- ML design and deployment
- Complete step-by-step roadmap
- Team roles and task delegation

## 🛠️ Development

### Running Locally

```bash
# Backend (from backend/)
npm run dev

# Frontend (from frontend/)
npm run dev

# ML Service (from ml_service/)
uvicorn app:app --reload
```

### Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📦 Tech Stack

- **Frontend**: Next.js 13+, React, TypeScript, Tailwind CSS, Recharts
- **Backend**: Node.js, Express, TypeScript, Zod, Supabase
- **Database**: Supabase (Postgres), Row-Level Security
- **ML**: Python, FastAPI, scikit-learn, XGBoost
- **Hosting**: Vercel, Render, Supabase

## 🔒 Security

- Row-Level Security (RLS) for per-user data isolation
- JWT authentication via Supabase Auth
- Input validation with Zod
- Secure API endpoints with proper error handling
- CORS configuration
- Rate limiting (recommended for production)

## 📊 Features

### MVP Features
- ✅ User authentication (signup/login)
- ✅ Create/update bets with multiple legs
- ✅ View bets list with filters and pagination
- ✅ Dashboard with KPIs (win rate, ROI, total profit)
- ✅ Analytics charts (time-series, by league, by responsible)
- ✅ ML predictions (win probability, stake suggestions)
- ✅ Export/import data (Excel/CSV)

### Future Features
- Real-time updates (WebSockets)
- Advanced ML models (per-user models)
- Data warehouse integration
- Multi-tenancy support
- Mobile app

---

Built with ❤️ using modern web technologies.

