# 🚀 Deployment Guide - ISES Route Assignment System

## 📋 Overview
This is a complete Route Assignment System with backend API and React frontend for managing inspection routes and zones.

## 🏗️ Architecture
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript
- **Database**: PostgreSQL with PostGIS extension
- **Cache**: Redis
- **Real-time**: WebSockets

## 🌐 Deployment Options

### 1. 🚂 Railway (Recommended)
Railway supports the full stack including PostgreSQL + PostGIS and Redis.

**Steps:**
1. Go to [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add PostgreSQL and Redis services
4. Set environment variables (see below)
5. Deploy!

### 2. 🎨 Render
Similar to Railway, supports full stack deployment.

**Steps:**
1. Go to [Render](https://render.com)
2. Create new Web Service from GitHub
3. Add PostgreSQL and Redis services
4. Configure environment variables
5. Deploy!

### 3. ⚡ Vercel (Limited - API only)
Vercel can run the simple API but not the full application with database.

**Steps:**
1. Go to [Vercel](https://vercel.com)
2. Import from GitHub
3. Will deploy the simple server automatically

## 🔧 Environment Variables

Create these environment variables in your deployment platform:

### Required for Full Application:
```env
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1

# Database (PostgreSQL with PostGIS)
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=route_assignment_db
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SSL=true

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
LOG_FORMAT=combined
```

### Optional (Push Notifications):
```env
# Firebase Cloud Messaging
FCM_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
FCM_PROJECT_ID=your-firebase-project-id

# Apple Push Notifications
APNS_KEY_ID=your-apns-key-id
APNS_TEAM_ID=your-apns-team-id
APNS_KEY_PATH=./config/AuthKey_XXXXXXXXXX.p8
APNS_BUNDLE_ID=com.yourcompany.routeassignment
APNS_PRODUCTION=false
```

## 📦 Build Commands

### For Railway/Render:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### For Vercel:
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `dist`

## 🗄️ Database Setup

Your deployment platform should automatically run the database initialization scripts:
1. `database/init.sql` - Creates tables and PostGIS setup
2. `database/seed.sql` - Initial data
3. `database/migrations/*.sql` - Schema updates

## 🔍 Health Checks

The application provides health check endpoints:
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/ready` - Readiness check (includes DB/Redis)

## 🚀 Quick Deploy Links

### Railway:
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/Adriangar333/ISES-APP---4GS)

### Render:
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Adriangar333/ISES-APP---4GS)

### Vercel (Simple API only):
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Adriangar333/ISES-APP---4GS)

## 📱 Features Available After Deployment

- ✅ Excel file processing for coordinates
- ✅ KMZ file processing for zone boundaries
- ✅ Route assignment and optimization
- ✅ Inspector management
- ✅ Real-time monitoring dashboard
- ✅ Push notifications (with proper config)
- ✅ Role-based access control
- ✅ Data export functionality

## 🛠️ Development vs Production

### Development (Local):
- Uses simple server: `npm run dev`
- No database required for basic testing

### Production (Deployed):
- Uses full server with all features
- Requires PostgreSQL + PostGIS and Redis
- All API endpoints available

## 📞 Support

If you need help with deployment, check the logs in your deployment platform or create an issue in the GitHub repository.