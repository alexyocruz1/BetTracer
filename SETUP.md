# BetTracer Setup Guide

This guide will help you set up the BetTracer development environment.

## Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.9+ and pip
- **Supabase account** (free tier works)
- **Git**

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd BetTracer
```

## Step 2: Set Up Supabase

1. **Create a Supabase project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for the project to be ready

2. **Get your Supabase credentials**
   - Go to Project Settings > API
   - Copy your `Project URL` (SUPABASE_URL)
   - Copy your `anon public` key (SUPABASE_ANON_KEY)
   - Copy your `service_role` key (SUPABASE_SERVICE_KEY) - **Keep this secret!**

3. **Run the database schema**
   - Go to SQL Editor in Supabase
   - Copy the SQL from `BetTracerGuide.md` (Database design section)
   - Run the SQL to create tables, indexes, triggers, and RLS policies

## Step 3: Set Up Backend

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The backend should now be running on `http://localhost:8080`

## Step 4: Set Up Frontend

1. **Navigate to frontend directory** (in a new terminal)
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.local.example .env.local
   # Edit .env.local with your Supabase credentials and backend URL
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The frontend should now be running on `http://localhost:3000`

## Step 5: Set Up ML Service (Optional for MVP)

1. **Navigate to ml_service directory**
   ```bash
   cd ml_service
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

5. **Start the ML service**
   ```bash
   uvicorn app:app --reload
   ```

   The ML service should now be running on `http://localhost:8000`

## Step 6: Verify Setup

1. **Check backend health**
   ```bash
   curl http://localhost:8080/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Check ML service health**
   ```bash
   curl http://localhost:8000/health
   ```
   Should return: `{"status":"ok","service":"ml-service"}`

3. **Check frontend**
   - Open `http://localhost:3000` in your browser
   - You should see the BetTracer homepage

## Troubleshooting

### Backend Issues

- **Port already in use**: Change the PORT in `.env`
- **Supabase connection error**: Verify your credentials in `.env`
- **Module not found**: Run `npm install` again

### Frontend Issues

- **Next.js errors**: Delete `.next` folder and restart
- **Supabase connection error**: Verify your credentials in `.env.local`
- **Module not found**: Run `npm install` again

### ML Service Issues

- **Python version**: Ensure you're using Python 3.9+
- **Module not found**: Run `pip install -r requirements.txt` again
- **Port already in use**: Change the port in the uvicorn command

## Next Steps

1. **Read the documentation**: See `BetTracerGuide.md` for complete project documentation
2. **Start development**: Begin with Phase 1 (Database) or Phase 2 (Backend MVP)
3. **Join the team**: Check `CONTRIBUTING.md` for contribution guidelines

## Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code
   - Write tests
   - Update documentation

3. **Test your changes**
   ```bash
   # Backend
   cd backend && npm test

   # Frontend
   cd frontend && npm test

   # ML Service
   cd ml_service && pytest
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Environment Variables Reference

### Backend (.env)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key (keep secret!)
- `PORT`: Backend server port (default: 8080)
- `NODE_ENV`: Environment (development/production)
- `ML_API_URL`: ML service URL (default: http://localhost:8000)
- `CORS_ORIGIN`: Frontend URL for CORS (default: http://localhost:3000)

### Frontend (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL (default: http://localhost:8080)

### ML Service (.env)
- `CORS_ORIGINS`: Comma-separated list of allowed origins
- `MODEL_PATH`: Path to the ML model file
- `API_KEY`: API key for authentication (optional)

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Support

If you encounter any issues, please:
1. Check the troubleshooting section above
2. Search existing issues on GitHub
3. Create a new issue with detailed information

Happy coding! 🚀

