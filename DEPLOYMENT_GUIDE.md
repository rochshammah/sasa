# JobTradeSasa Deployment Guide

This guide explains how to deploy JobTradeSasa with the frontend on Vercel and the backend on Render.

## Architecture Overview

- **Frontend**: React PWA hosted on Vercel
- **Backend**: Node.js/Express API hosted on Render
- **Database**: PostgreSQL hosted on Render

## Prerequisites

1. GitHub account
2. Vercel account (https://vercel.com)
3. Render account (https://render.com)
4. Git installed locally

## Project Structure

```
jobtradesasa/
├── client/                # Frontend React app
│   ├── src/
│   ├── public/
│   │   ├── manifest.json
│   │   └── service-worker.js
│   └── package.json       # (To be created for separate deployment)
├── server/                # Backend Express API
│   ├── routes.ts
│   ├── storage.ts
│   ├── db.ts
│   └── index.ts
├── shared/               # Shared types and schemas
│   └── schema.ts
├── package.json          # Root package.json
├── vercel.json           # Vercel configuration
└── render.yaml           # Render configuration
```

## Step 1: Prepare Your Repository

### Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Step 2: Deploy Backend to Render

### Option A: Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create:
   - PostgreSQL database (`jobtradesasa-db`)
   - Web service (`jobtradesasa-api`)

### Option B: Manual Setup

1. **Create PostgreSQL Database**
   - Go to Render Dashboard
   - Click "New" → "PostgreSQL"
   - Name: `jobtradesasa-db`
   - Database Name: `jobtradesasa`
   - Region: Oregon (or your preferred region)
   - Plan: Starter (Free tier available)
   - Click "Create Database"
   - **Save the Internal Database URL** (starts with `postgres://`)

2. **Create Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configuration:
     - Name: `jobtradesasa-api`
     - Region: Same as database
     - Branch: `main`
     - Runtime: Node
     - Build Command: `npm install && npm run build`
     - Start Command: `npm run start`
     - Plan: Starter (Free tier available)

3. **Add Environment Variables**
   In the Render service dashboard, add:
   ```
   NODE_ENV=production
   DATABASE_URL=<your-postgres-internal-url>
   JWT_SECRET=<generate-a-secure-random-string>
   SESSION_SECRET=<generate-a-secure-random-string>
   PORT=10000
   ```

   To generate secure secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Wait for deployment to complete
   - **Save the service URL** (e.g., `https://jobtradesasa-api.onrender.com`)

### Database Migration

After deployment, the database will be automatically set up on first run. The application includes:
- Automatic schema synchronization
- Seed data for categories
- All tables and relations

## Step 3: Deploy Frontend to Vercel

### Using Vercel CLI (Recommended for Monorepo)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   # From project root
   vercel
   ```

4. **Configure Build Settings**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `client/dist`
   - Install Command: `npm install`

5. **Add Environment Variables**
   In Vercel project settings:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```

### Using Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - Framework Preset: Vite
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build`
   - Output Directory: `client/dist`
   - Install Command: `npm install`

5. Add Environment Variable:
   - Key: `VITE_API_URL`
   - Value: `https://your-backend-url.onrender.com` (from Step 2)

6. Click "Deploy"

## Step 4: Configure CORS

Update your backend's CORS settings to allow your Vercel domain:

In `server/index.ts`, add (if not already present):

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5000',
    'https://your-vercel-domain.vercel.app'
  ],
  credentials: true
}));
```

## Step 5: Test Your Deployment

1. **Test Backend**
   ```bash
   curl https://your-backend.onrender.com/api/categories
   ```
   Should return a list of categories.

2. **Test Frontend**
   - Visit your Vercel URL
   - Try creating an account
   - Post a test job
   - Verify all features work

## Step 6: Configure Custom Domain (Optional)

### For Frontend (Vercel)
1. Go to your project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### For Backend (Render)
1. Go to service settings
2. Click "Custom Domains"
3. Add your domain
4. Update DNS records as instructed

## Environment Variables Summary

### Backend (Render)
```env
NODE_ENV=production
DATABASE_URL=<render-postgres-url>
JWT_SECRET=<random-secret>
SESSION_SECRET=<random-secret>
PORT=10000
```

### Frontend (Vercel)
```env
VITE_API_URL=https://your-backend.onrender.com
```

## Monitoring & Logs

### Backend Logs (Render)
- Go to service dashboard
- Click "Logs" tab
- View real-time logs

### Frontend Logs (Vercel)
- Go to deployment
- Click on deployment URL
- View function logs and analytics

## Database Management

### Access Database
```bash
# Get connection string from Render dashboard
psql <DATABASE_URL>
```

### Backup Database
Render provides automatic daily backups on paid plans. For manual backup:
```bash
pg_dump <DATABASE_URL> > backup.sql
```

### Restore Database
```bash
psql <DATABASE_URL> < backup.sql
```

## Scaling

### Backend (Render)
- Upgrade to paid plan for:
  - More CPU/RAM
  - No spin-down on free tier
  - Priority support

### Frontend (Vercel)
- Automatically scales
- Consider Pro plan for:
  - Team collaboration
  - Advanced analytics
  - Commercial use

### Database (Render)
- Upgrade plan for:
  - More storage
  - Better performance
  - Point-in-time recovery

## Troubleshooting

### Backend Issues

**Database Connection Error**
- Verify `DATABASE_URL` is correctly set
- Check database is running on Render
- Ensure database and service are in same region

**Build Fails**
- Check Node version compatibility
- Verify all dependencies in `package.json`
- Review build logs in Render

**API Returns 500**
- Check service logs in Render
- Verify environment variables
- Test database connection

### Frontend Issues

**API Calls Fail**
- Verify `VITE_API_URL` is correct
- Check CORS configuration
- Test backend directly with curl

**Build Fails**
- Check build command in Vercel settings
- Verify all environment variables
- Review build logs

**Assets Not Loading**
- Check `vercel.json` routes configuration
- Verify build output directory
- Clear Vercel cache and redeploy

### Database Issues

**Migration Fails**
- Check database permissions
- Verify schema compatibility
- Review migration logs

**Slow Queries**
- Add database indexes
- Optimize queries
- Consider upgrading database plan

## Best Practices

1. **Security**
   - Never commit secrets to Git
   - Use strong JWT secrets
   - Enable HTTPS only
   - Implement rate limiting

2. **Performance**
   - Enable Vercel Edge caching
   - Use CDN for static assets
   - Optimize database queries
   - Implement pagination

3. **Monitoring**
   - Set up error tracking (e.g., Sentry)
   - Monitor API response times
   - Track user analytics
   - Set up uptime monitoring

4. **Maintenance**
   - Regular database backups
   - Keep dependencies updated
   - Monitor security advisories
   - Review error logs regularly

## Support

- **Vercel**: https://vercel.com/support
- **Render**: https://render.com/docs
- **GitHub Issues**: For project-specific issues

## Updating Deployment

### Frontend Updates
```bash
git add .
git commit -m "Update frontend"
git push origin main
```
Vercel will automatically deploy.

### Backend Updates
```bash
git add .
git commit -m "Update backend"
git push origin main
```
Render will automatically deploy.

## Cost Estimate

### Free Tier
- **Vercel**: Unlimited deployments
- **Render**: 
  - Web Service: Free (spins down after inactivity)
  - PostgreSQL: Free tier available (limited storage)

### Paid Plans (Approximate)
- **Vercel Pro**: $20/month per member
- **Render Starter**: $7/month (web service)
- **Render PostgreSQL**: $7/month (starter database)

**Total Minimum Cost**: ~$14/month for full production deployment

## Notes

- Free tier backend spins down after 15 minutes of inactivity on Render
- First request after spin-down may take 30-60 seconds
- Consider paid plan for production use
- Vercel free tier is generous for most applications

---

**Deployment Complete!** 🎉

Your JobTradeSasa marketplace is now live and accessible worldwide.
