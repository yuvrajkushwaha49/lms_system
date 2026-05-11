# Workians LMS - Production Deployment Guide

This guide provides instructions to deploy the Workians LMS SaaS to a production environment using **AWS EC2, RDS (MySQL), and S3**.

## 1. Database Setup (AWS RDS)

1. Navigate to AWS RDS and create a new **MySQL 8.0+** database instance.
2. Select **Production** template, set a master username/password.
3. Make the DB publicly accessible (only if deploying backend externally) OR keep it private in a VPC and deploy EC2 in the same VPC.
4. Copy the RDS Endpoint URL.
5. Connect to the DB using DBeaver/MySQL Workbench and run the generated `schema.sql`.

## 2. Media Storage Setup (AWS S3)

1. Create a new AWS S3 Bucket (e.g. `workians-lms-storage`).
2. Ensure **Block Public Access** is partly enabled (You want S3 objects protected).
3. Setup **CORS Configuration** to allow your frontend domains to upload directly.
4. Create an AWS IAM User, attach `AmazonS3FullAccess` policy, and generate Access Keys.

## 3. Backend Deployment (AWS EC2 - Node.js)

1. Launch an Ubuntu EC2 instance.
2. SSH into the instance and install Node.js and PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```
3. Clone your repository and navigate to `backend/`.
4. Run `npm install`.
5. Create `.env` file and populate production values:
   ```env
   PORT=5000
   DB_HOST=your-rds-endpoint.amazonaws.com
   DB_USER=master_user
   DB_PASSWORD=your_password
   DB_NAME=workians_lms
   JWT_SECRET=production_secret
   JWT_REFRESH_SECRET=production_refresh_secret
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_S3_BUCKET_NAME=workians-lms-storage
   RAZORPAY_KEY_ID=live_key
   RAZORPAY_KEY_SECRET=live_secret
   ```
6. Start the server using PM2:
   ```bash
   pm2 start server.js --name "workians-api"
   pm2 save
   pm2 startup
   ```
7. Configure `nginx` as a reverse proxy to route port 80/443 traffic to your Node.js app on port `5000`.

## 4. Frontend Deployment (Vercel or AWS Amplify)

1. Push your `frontend` code to a GitHub repository.
2. Link the repository to **Vercel** (Recommended for Next.js).
3. Configure the Root Directory inside Vercel to `frontend`.
4. Set the Environment Variables:
   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
   ```
5. Deploy. Vercel will handle the edge caching, CDN routing, and optimized App Router serving.

## 5. Multi-Tenant Routing (Subdomains)

Since Workians LMS uses subdomains (`acme.workians.com`):
1. In your DNS settings (Route53/CloudFlare), set up a Wildcard CNAME `*.workians.com` pointing to your Vercel deployment.
2. Next.js middleware (which we can setup in `frontend/src/middleware.js`) will parse `req.headers.get('host')` to extract the subdomain and proxy requests appropriately.
