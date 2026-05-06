
# 🦷 SwiftCare Dental Clinic - Production Setup Guide

## 📋 Prerequisites

Before setting up, make sure you have:
- Node.js 18+ installed
- PostgreSQL database (Supabase recommended)
- Git installed
- A Render account for deployment

---

## 🗄️ Database Setup (Supabase)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `swiftcare-dental-clinic`
   - **Database Password**: Generate a secure password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be ready (2-3 minutes)

### Step 2: Get Database Connection Details

1. In your Supabase dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string** section
3. Copy the URI format: `postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:[PORT]/postgres`
4. Save this connection string - you'll need it for the `.env` file

### Step 3: Configure Database Schema

The schema will be created automatically when you run database migrations (see Local Setup section below).

---

## 🔧 Local Development Setup

### Step 1: Clone and Install

```bash
# If you haven't already, clone the project
git clone <your-repo-url>
cd swiftcare-dental-clinic/app

# Install dependencies
yarn install
```

### Step 2: Environment Configuration

Create a `.env` file in the `app` directory:

```bash
# Database
DATABASE_URL="postgresql://postgres:[YOUR-SUPABASE-PASSWORD]@[YOUR-SUPABASE-HOST]:[PORT]/postgres"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-here-at-least-32-characters"

# Application
NODE_ENV="development"
```

**Important**: Replace the placeholders with your actual Supabase credentials.

### Step 3: Database Migration and Seeding

```bash
# Generate Prisma client
yarn prisma generate

# Run database migrations
yarn prisma migrate deploy

# Seed the database with initial data (including your admin account)
yarn prisma db seed
```

### Step 4: Start Development Server

```bash
yarn dev
```

Your app should now be running at `http://localhost:3000`

### Step 5: Login with Your Admin Account

Navigate to the app and login with:
- **Email**: `escletoglenn24@gmail.com`
- **Password**: `P@nc@k3$`

---

## 🚀 Production Deployment (Render)

### Step 1: Prepare for Deployment

1. Make sure all your changes are committed to Git:
```bash
git add .
git commit -m "Production setup complete"
git push origin main
```

### Step 2: Create Render Web Service

1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:

   **Basic Settings:**
   - **Name**: `swiftcare-dental-clinic`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `app`

   **Build & Deploy:**
   - **Build Command**: `yarn install && yarn build`
   - **Start Command**: `yarn start`

### Step 3: Environment Variables

In Render, add these environment variables:

```bash
# Database - Use your Supabase connection string
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres

# NextAuth - Use your domain
NEXTAUTH_URL=https://your-app-name.onrender.com
NEXTAUTH_SECRET=your-super-secret-key-here-at-least-32-characters

# Production
NODE_ENV=production
```

### Step 4: Deploy

1. Click "Create Web Service"
2. Render will automatically deploy your app
3. Wait for the deployment to complete (5-10 minutes)
4. Your app will be available at `https://your-app-name.onrender.com`

### Step 5: Run Database Setup on Production

After the first deployment, you need to set up the database:

1. Go to your Render dashboard
2. Click on your service
3. Go to the "Shell" tab
4. Run these commands:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database
npx prisma db seed
```

---

## 🔐 Security Configuration

### NextAuth Secret

Generate a secure secret for production:

```bash
openssl rand -base64 32
```

Use this value for `NEXTAUTH_SECRET` in production.

### Database Security

1. In Supabase, go to **Settings** → **Database**
2. Under **Connection pooling**, ensure it's enabled
3. Use the pooled connection string for better performance

---

## 📊 Post-Deployment Setup

### Step 1: Verify Admin Access

1. Navigate to your deployed app
2. Login with your admin account:
   - Email: `escletoglenn24@gmail.com`
   - Password: `P@nc@k3$`
3. Verify you can access the admin dashboard

### Step 2: Configure System Settings

1. Go to **Admin** → **Settings**
2. Update clinic information:
   - Clinic name and contact details
   - Business hours
   - Default appointment durations
   - Tax rates (if applicable)

### Step 3: Add Staff and Dentists

1. Go to **Admin** → **Staff Management**
2. Add dentists and staff members
3. Configure their schedules and availability

### Step 4: Set Up Services

1. Go to **Admin** → **Services**
2. Add dental procedures and treatments
3. Set pricing and duration for each service

---

## 🔧 Maintenance Commands

### Update Database Schema

If you make changes to the Prisma schema:

```bash
# Generate new migration
npx prisma migrate dev --name describe-your-change

# Deploy to production
npx prisma migrate deploy
```

### Backup Database

From your local environment:

```bash
# Create backup
npx prisma db push --force-reset
```

### Reset Database (Development Only)

```bash
npx prisma migrate reset
yarn prisma db seed
```

---

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify your DATABASE_URL is correct
   - Check Supabase project status
   - Ensure your IP is whitelisted (if using restrictive settings)

2. **Authentication Not Working**
   - Verify NEXTAUTH_URL matches your domain exactly
   - Check NEXTAUTH_SECRET is set and secure
   - Clear browser cookies and try again

3. **Build Failures on Render**
   - Check build logs for specific errors
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

4. **Prisma Migration Issues**
   - Run `npx prisma generate` after schema changes
   - Use `npx prisma db push` for development iterations
   - Use `npx prisma migrate deploy` for production

### Support

For additional help, check:
- Console logs in your browser developer tools
- Render deployment logs
- Supabase project logs

---

## 📈 Scaling Considerations

As your clinic grows, consider:

1. **Database Performance**
   - Monitor query performance in Supabase
   - Add indexes for frequently queried fields
   - Consider read replicas for reporting

2. **File Storage**
   - Implement cloud storage for patient files
   - Use CDN for static assets

3. **Monitoring**
   - Set up error monitoring (Sentry)
   - Monitor uptime and performance
   - Set up automated backups

---

## 🔄 Updates and Maintenance

### Regular Updates

1. **Monthly Security Updates**
   - Update Node.js dependencies
   - Review and update environment variables
   - Check for Prisma/NextJS updates

2. **Database Maintenance**
   - Monitor database size and performance
   - Regular backups
   - Clean up old data as needed

3. **Feature Updates**
   - Test new features in development
   - Use migration scripts for data changes
   - Deploy during low-traffic periods

---

This guide should get your SwiftCare Dental Clinic up and running in production. The system is now clean of all demo data and ready for real-world use!
