const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.SERVER_URL || 'https://srhutextnizer.com';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Initialize Firebase Admin if service account present
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  if (!fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    console.error('Firebase service account file not found at', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    process.exit(1);
  }
  const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase Admin initialized');
} else {
  console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_PATH not set. Admin features disabled.');
}

// Simple in-memory store for demo usage (replace with DB in production)
const usage = {};

// Helper: count words
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Middleware to verify Firebase ID token if provided
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid Authorization header' });
  try {
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase admin not initialized' });
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verify error', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/humanize
app.post('/api/humanize', verifyToken, async (req, res) => {
  try {
    const { text, tone } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });
    const uid = req.user.uid;
    const wc = countWords(text);

    // Usage check (demo uses in-memory store)
    const user = usage[uid] || { words: 0, plan: 'free' };
    const freeLimit = 10000;
    if (user.plan !== 'pro' && (user.words + wc) > freeLimit) {
      return res.status(402).json({ error: 'Free monthly limit exceeded' });
    }

    // Increment usage
    user.words = (user.words || 0) + wc;
    usage[uid] = user;

    // Call OpenAI
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    let humanized = null;
    if (OPENAI_KEY) {
      try {
        const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `You are an expert linguistic model. Rephrase the user's text to sound natural and human while preserving meaning. Tone: ${tone || 'natural'}.` },
            { role: 'user', content: text }
          ],
          temperature: 0.7,
          max_tokens: 2000
        }, {
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
          timeout: 60000
        });
        humanized = resp.data?.choices?.[0]?.message?.content || null;
      } catch (err) {
        console.error('OpenAI error', err.response?.data || err.message);
        humanized = text; // fallback echo
      }
    } else {
      // Fallback simple transform
      humanized = text.replace(/\butilize\b/ig, 'use').replace(/\bcommence\b/ig, 'start');
    }

    res.json({ humanizedText: humanized, citations: [] });
  } catch (err) {
    console.error('humanize error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/checkout - creates Stripe Checkout Session
app.post('/api/checkout', verifyToken, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const priceId = process.env.STRIPE_PRICE_ID_PRO;
    if (!priceId) return res.status(500).json({ error: 'STRIPE_PRICE_ID_PRO not set' });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SERVER_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SERVER_URL}/pricing.html`,
      metadata: { firebase_uid: req.user.uid }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('checkout error', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Stripe webhook endpoint (raw body required for signature verification)
app.post('/webhook', bodyParser.raw({ type: '*/*' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    if (!secret) {
      event = JSON.parse(req.body.toString());
    } else {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    }
  } catch (err) {
    console.error('Webhook error', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.firebase_uid;
    console.log('Checkout completed for uid', uid);
    // In production: mark user as pro in DB / Firebase custom claims
  }
  res.json({ received: true });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
