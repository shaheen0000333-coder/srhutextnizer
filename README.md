SR Hutextnizer - Ready to Launch
================================

This package includes a full frontend (Tailwind CSS) and a secure Node.js backend preconfigured for OpenAI, Firebase Admin verification, and Stripe Checkout. The package is ready to be customized with your API keys and deployed.

YOUR LAUNCH CONFIGURATION (provided):
- Domain: srhutextnizer.com
- AI Provider: OpenAI
- Currency: USD
- Prices: Pro Monthly $9, Pro Yearly $90
- Support email: sophiakim0000333@gmail.com

Quick start (local test)
------------------------
1. Copy your Firebase service account JSON to server/firebase-service-account.json
2. In server/.env, set:
   - OPENAI_API_KEY
   - FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   - STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PRO, STRIPE_WEBHOOK_SECRET
   - SERVER_URL (https://srhutextnizer.com when deployed)

3. Run with Docker Compose (recommended):
   - docker-compose up --build

4. Open http://localhost:3000/index.html

Deploy
------
- Frontend: Deploy the /frontend folder to Vercel or Netlify (static site).
- Backend: Deploy /server to Render, Heroku, or a VM. Set environment variables in the provider dashboard.
- Configure Stripe webhook to point to: https://<your-server-domain>/webhook and set STRIPE_WEBHOOK_SECRET.

Notes
-----
- Replace placeholders in frontend/assets/app.js: FIREBASE_CONFIG and SERVER_BASE (backend URL).
- This package uses OpenAI Chat Completions endpoint example; ensure your OpenAI account and model access.
- For production scale, replace in-memory usage store with a persistent DB (Postgres / Firestore) and verify tokens + subscription status server-side.

Support
-------
Contact: sophiakim0000333@gmail.com
