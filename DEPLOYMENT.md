# Deployment Guide for Vercel

## Prerequisites
- Vercel account
- Project pushed to GitHub

## Step 1: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Click "Deploy" (it will fail initially - that's expected)

## Step 2: Set up Vercel Postgres

1. In your Vercel project dashboard, go to the "Storage" tab
2. Click "Create Database"
3. Choose "Postgres"
4. Select your preferred region (closest to your users)
5. Click "Create"

## Step 3: Connect Database to Project

1. After creating the database, click "Connect Project"
2. Select your project
3. Vercel will automatically add these environment variables:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL` 
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_USER`
   - `POSTGRES_HOST`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`

## Step 4: Update Environment Variables

1. Go to your project's "Settings" → "Environment Variables"
2. Add your OpenAI API key:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
   - Environment: Production, Preview, Development

3. Add the database URL for Prisma:
   - Name: `DATABASE_URL`
   - Value: Copy the value from `POSTGRES_PRISMA_URL`
   - Environment: Production, Preview, Development

## Step 5: Push Database Schema

### Option A: Using Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Pull environment variables
vercel env pull .env.local

# Push schema to database
npm run db:push
```

### Option B: Manual Connection
1. Copy the `DATABASE_URL` from Vercel dashboard
2. Create `.env.local` file:
   ```
   DATABASE_URL="your-database-url-here"
   ```
3. Run:
   ```bash
   npm run db:push
   ```

## Step 6: Redeploy

1. Go to your Vercel project dashboard
2. Go to "Deployments" tab
3. Click the three dots on the latest deployment
4. Select "Redeploy"

## Troubleshooting

### Database Connection Errors
- Ensure `DATABASE_URL` environment variable is set correctly
- Check that the database is in the same region as your functions

### Prisma Errors
- Make sure `prisma generate` runs during build (check vercel.json)
- Verify schema.prisma syntax is correct

### API Errors
- Check function logs in Vercel dashboard
- Ensure `OPENAI_API_KEY` is set correctly

## Local Development

1. Pull environment variables:
   ```bash
   vercel env pull .env.local
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. View database:
   ```bash
   npm run db:studio
   ```

## Monitoring

- Check function logs: Vercel Dashboard → Functions tab
- Monitor database: Vercel Dashboard → Storage → Your Database → Data Browser 