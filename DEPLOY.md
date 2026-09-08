# 🚀 Deployment Guide — CabinetryWorks

Complete step-by-step guide to host, deploy, and go live with GitHub + Supabase + Vercel.

---

## Prerequisites

- [GitHub](https://github.com) account (free)
- [Supabase](https://supabase.com) account (free tier — sign up with GitHub)
- [Vercel](https://vercel.com) account (free tier — sign up with GitHub)
- [Node.js](https://nodejs.org) 18+ installed locally
- [Bun](https://bun.sh) installed locally (`curl -fsSL https://bun.sh/install | bash`)

---

## Step 1: Push Code to GitHub

### 1.1 Create a new GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `cabinetryworks`
3. Set to **Private** (recommended — contains business logic)
4. Don't add README/.gitignore (already exists)
5. Click **Create repository**

### 1.2 Push your code

```bash
# In your project folder
cd /path/to/cabinetryworks

# Initialize git (if not already)
git init

# Add all files (respects .gitignore)
git add .

# Commit
git commit -m "Initial commit — CabinetryWorks Manufacturing System"

# Set main branch
git branch -M main

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/cabinetryworks.git

# Push
git push -u origin main
```

**What's excluded** (via `.gitignore`):
- `node_modules/` — installed on deploy
- `.next/` — build output
- `db/custom.db` — local SQLite database
- `.env` — environment variables (secrets)
- `dev.log` — log files

---

## Step 2: Set Up Supabase (Database)

### 2.1 Create Supabase project

1. Go to [supabase.com](https://supabase.com) → Sign in with GitHub
2. Click **New Project**
3. Fill in:
   - **Name**: `cabinetryworks`
   - **Database Password**: Choose a strong password — **SAVE THIS** (you'll need it)
   - **Region**: Choose closest to your users
4. Click **Create new project**
5. Wait ~2 minutes for provisioning

### 2.2 Get your connection string

1. Go to **Settings → Database → Connection string**
2. Copy the **URI** (Transaction mode — port 6543):
   ```
   postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
   ```
3. Also copy the **Direct connection** (Session mode — port 5432, for migrations):
   ```
   postgresql://postgres.abcdefgh:YOUR_PASSWORD@db.abcdefgh.supabase.co:5432/postgres
   ```

### 2.3 Update your local .env

Create/update `.env` in your project root:
```bash
DATABASE_URL="postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.abcdefgh:YOUR_PASSWORD@db.abcdefgh.supabase.co:5432/postgres"
```

### 2.4 Push schema to Supabase

```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Push schema to Supabase (creates all tables)
npx prisma db push

# Seed initial data (admin + technician accounts)
bun run prisma/seed.ts

# Optional: seed rich demo data
bun run prisma/seed-rich.ts
```

### 2.5 Verify seed worked

1. Go to Supabase Dashboard → **Table Editor**
2. You should see tables: `User`, `Customer`, `JobOrder`, `InventoryItem`, etc.
3. Check `User` table — should have `admin` and `technician` accounts

---

## Step 3: Deploy to Vercel

### 3.1 Import project

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **Add New → Project**
3. Import your `cabinetryworks` repository

### 3.2 Configure environment variables

Before deploying, add environment variables:

1. Click **Environment Variables**
2. Add each variable:

| Key | Value | Environments |
|-----|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres` | Production, Preview, Development |
| `DIRECT_URL` | `postgresql://postgres.abcdefgh:YOUR_PASSWORD@db.abcdefgh.supabase.co:5432/postgres` | Production, Preview, Development |

### 3.3 Deploy

1. Click **Deploy**
2. Vercel will:
   - Install dependencies (`bun install`)
   - Generate Prisma client (`prisma generate`)
   - Build Next.js (`next build`)
   - Deploy to global CDN
3. Wait ~3-5 minutes for first build
4. You'll get a URL like: `https://cabinetryworks.vercel.app`

### 3.4 Test your live app

1. Open your Vercel URL
2. Log in with: `admin` / `admin123`
3. Verify all features work:
   - Overview dashboard loads
   - Job Orders visible
   - Inventory items load
   - Create a test job order

---

## Step 4: Custom Domain (Optional)

1. Go to Vercel → your project → **Settings → Domains**
2. Add your domain (e.g., `app.yourcompany.com`)
3. Add the DNS records Vercel shows you (at your domain registrar)
4. Wait for DNS propagation (~5-30 minutes)
5. Vercel auto-provisions SSL certificate

---

## Step 5: Set Up Auto-Deploy (CI/CD)

Every `git push` to `main` automatically deploys:

```bash
# Make changes locally
git add .
git commit -m "Added new feature"
git push origin main

# Vercel auto-builds and deploys in ~2-3 minutes
# Preview deployments are created for pull requests
```

---

## Step 6: Database Migrations (Ongoing)

When you change `prisma/schema.prisma`:

```bash
# Create a migration
npx prisma migrate dev --name describe_the_change

# Push to Supabase
npx prisma migrate deploy

# Commit migration files to git
git add prisma/migrations/
git commit -m "Migration: describe the change"
git push
```

---

## Step 7: Backup Strategy

### Supabase Backups (automatic):
- **Free tier**: Daily snapshots (7-day retention)
- **Pro tier ($25/mo)**: Point-in-time recovery (10-second granularity)

### Manual backup:
```bash
# Export database to SQL file
pg_dump "postgresql://postgres.abcdefgh:YOUR_PASSWORD@db.abcdefgh.supabase.co:5432/postgres" > backup.sql

# Restore
psql "postgresql://postgres.abcdefgh:YOUR_PASSWORD@db.abcdefgh.supabase.co:5432/postgres" < backup.sql
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Supabase pooler connection (port 6543) |
| `DIRECT_URL` | ✅ | Supabase direct connection (port 5432, for migrations) |

---

## Default Login Credentials (after seeding)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | SuperAdmin |
| `technician` | `tech123` | Technician |

**⚠️ Change these passwords immediately after first login in production!**

---

## Troubleshooting

### Build fails on Vercel
- Check that `DATABASE_URL` is set in Vercel environment variables
- Check that `prisma generate` runs before `next build` (configured in `vercel.json`)
- Check Vercel build logs for specific errors

### Database connection errors
- Ensure Supabase project is not paused (free tier pauses after 1 week of inactivity)
- Verify connection string has correct password
- Check that IP is not blocked (Supabase allows all IPs by default)

### Login doesn't work after deploy
- Run the seed script: `bun run prisma/seed.ts` against your Supabase database
- Verify users exist in Supabase Table Editor → `User` table

### Prisma migration errors
- Use `npx prisma migrate reset` to start fresh (⚠️ deletes all data)
- Use `npx prisma db push` for quick schema sync without migrations

---

## Cost Summary

| Service | Free Tier | Paid (if needed) |
|---------|-----------|------------------|
| **GitHub** | Unlimited private repos | — |
| **Supabase** | 500MB DB, 50K MAU, 1GB storage | $25/mo (8GB DB, 100K MAU) |
| **Vercel** | 100GB bandwidth, 1000 invocations/day | $20/mo (1TB bandwidth, custom domain) |
| **Total (small business)** | **$0/mo** | **$0-45/mo** |

---

## Quick Reference Commands

```bash
# Local development
bun run dev              # Start dev server
bun run lint             # Check code quality
bun run db:push          # Push schema changes to DB
bun run db:generate      # Regenerate Prisma client
bun run db:seed          # Seed initial data
bun run db:seed:rich     # Seed rich demo data

# Production deployment
git add .                # Stage changes
git commit -m "message"  # Commit
git push origin main     # Push → auto-deploys to Vercel

# Database
npx prisma studio        # Visual database browser
npx prisma migrate dev   # Create + apply migration
npx prisma migrate deploy # Apply migrations to production
```
