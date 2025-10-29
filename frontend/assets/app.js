/* assets/app.js - Frontend for SR Hutextnizer (ready-to-launch package)

INSTRUCTIONS:
- Replace FIREBASE_CONFIG with your Firebase project's config.
- Set SERVER_BASE to your deployed backend URL (e.g. 'https://api.srhutextnizer.com')
- Deploy frontend static files (Vercel/Netlify) and backend to Render/Heroku as instructed in README.
*/

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCkLKkeVPqicMVieRipkf0NSxsqbj65_cY",
  authDomain: "sr-hutextnizer.firebaseapp.com",
  projectId: "sr-hutextnizer",
  storageBucket: "sr-hutextnizer.firebasestorage.app",
  messagingSenderId: "255359085929",
  appId: "1:255359085929:web:9b702528fa8322bb1c61f8",
  measurementId: "G-54XD38CEPT"
};

// Server base URL (set after deploying server)
const SERVER_BASE = ""; // e.g., "https://api.srhutextnizer.com"

if (typeof firebase !== 'undefined' && firebase?.initializeApp) {
  try { firebase.initializeApp(FIREBASE_CONFIG); } catch (e) { }
}
const auth = (typeof firebase !== 'undefined') ? firebase.auth() : null;

function el(id){ return document.getElementById(id); }
function countWords(text){ if(!text) return 0; return text.trim().split(/\s+/).filter(Boolean).length; }
function escapeHtml(text){ return (text+'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function updateAuthUI(){
  const user = auth?.currentUser;
  const navLogin = el('navLogin'), navDashboard = el('navDashboard');
  const userStatus = el('userStatus');
  if (navLogin) navLogin.href = user ? 'dashboard.html' : 'login.html';
  if (navDashboard) navDashboard.href = user ? 'dashboard.html' : 'signup.html';
  if (userStatus) userStatus.textContent = user ? `Signed in as ${user.displayName || user.email}` : 'Not signed in';
  const localUser = JSON.parse(localStorage.getItem('sr_user') || 'null');
  const limitSpan = el('limitSpan') || el('dashLimit');
  if (limitSpan) limitSpan.textContent = (localUser && localUser.plan==='pro') ? 'Unlimited' : '10000';
}

if (auth) {
  auth.onAuthStateChanged(user => {
    if (user) {
      localStorage.setItem('sr_user', JSON.stringify({ uid: user.uid, name: user.displayName || user.email, plan: 'free' }));
    } else {
      localStorage.removeItem('sr_user');
    }
    updateAuthUI();
    const dashboardUser = el('dashboardUser');
    if (dashboardUser) dashboardUser.textContent = user ? (user.displayName || user.email) : 'Signed out';
  });
}

// Signup
const signupForm = el('signupForm');
if (signupForm && auth) {
  signupForm.addEventListener('submit', async (e)=> {
    e.preventDefault();
    const name = el('name').value.trim();
    const email = el('email').value.trim();
    const password = el('password').value;
    try {
      const res = await auth.createUserWithEmailAndPassword(email, password);
      await res.user.updateProfile({ displayName: name });
      localStorage.setItem('sr_user', JSON.stringify({ uid: res.user.uid, name, plan: 'free' }));
      window.location.href = 'dashboard.html';
    } catch(err) { alert('Signup error: ' + err.message); }
  });
}

// Login
const loginForm = el('loginForm');
if (loginForm && auth) {
  loginForm.addEventListener('submit', async (e)=> {
    e.preventDefault();
    const email = el('loginEmail').value.trim();
    const password = el('loginPassword').value;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = 'dashboard.html';
    } catch(err) { alert('Login error: ' + err.message); }
  });

  const googleBtn = el('googleSignIn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async (ev)=> {
      ev.preventDefault();
      const provider = new firebase.auth.GoogleAuthProvider();
      try { await auth.signInWithPopup(provider); window.location.href='dashboard.html'; } catch(err) { alert('Google sign-in error: ' + err.message); }
    });
  }
}

// Converter (index)
const inputText = el('inputText');
if (inputText) {
  inputText.addEventListener('input', () => {
    const c = countWords(inputText.value);
    const wc = el('wordCount'); if (wc) wc.textContent = c;
    const localUser = JSON.parse(localStorage.getItem('sr_user') || 'null');
    const limit = (localUser && localUser.plan==='pro') ? Infinity : 10000;
    const limitWarning = el('limitWarning'), humanizeBtn = el('humanizeBtn');
    if (c > limit) { if (limitWarning) limitWarning.classList.remove('hidden'); if (humanizeBtn) humanizeBtn.disabled=true; }
    else { if (limitWarning) limitWarning.classList.add('hidden'); if (humanizeBtn) humanizeBtn.disabled=false; }
  });
}

const humanizeBtn = el('humanizeBtn');
if (humanizeBtn) {
  humanizeBtn.addEventListener('click', async ()=> {
    const localUser = JSON.parse(localStorage.getItem('sr_user') || 'null');
    if (!localUser) { alert('Please sign up or log in to use the converter.'); window.location.href='signup.html'; return; }
    const text = inputText.value.trim();
    if (!text) return alert('Please enter text to humanize.');
    const wc = countWords(text);
    const limit = (localUser.plan==='pro') ? Infinity : 10000;
    if (wc > limit) return alert('Word limit exceeded. Upgrade to Pro.');

    humanizeBtn.disabled=true; humanizeBtn.textContent='Processing...';
    try {
      let idToken = null;
      if (auth && auth.currentUser) idToken = await auth.currentUser.getIdToken();
      const tone = el('toneSelect').value;
      const resp = await fetch((SERVER_BASE||'') + '/api/humanize', {
        method:'POST',
        headers: {
          'Content-Type':'application/json',
          ...(idToken ? { 'Authorization': 'Bearer ' + idToken } : {})
        },
        body: JSON.stringify({ text, tone })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({ error: resp.statusText }));
        throw new Error(err?.error || resp.statusText);
      }
      const payload = await resp.json();
      el('outputPlaceholder').classList.add('hidden');
      const out = el('outputText'); out.classList.remove('hidden'); out.textContent = payload.humanizedText || 'No output';
      const citations = el('citations'), list = el('citationsList');
      if (payload.citations && payload.citations.length) {
        citations.classList.remove('hidden'); list.innerHTML='';
        payload.citations.forEach((c,i)=>{ const li=document.createElement('li'); li.innerHTML=`<a href="${c.uri}" target="_blank">${i+1}. ${c.title||c.uri}</a>`; list.appendChild(li); });
      } else { citations.classList.add('hidden'); }
    } catch(err) { alert('Error: ' + err.message); }
    finally { humanizeBtn.disabled=false; humanizeBtn.textContent='Humanize Text'; }
  });
}

// Dashboard logic
const dashInput = el('dashInput');
if (dashInput) {
  dashInput.addEventListener('input', ()=> { const c = countWords(dashInput.value); const elc = el('dashWordCount'); if (elc) elc.textContent = c; });
}
const dashHumanize = el('dashHumanize');
if (dashHumanize) {
  dashHumanize.addEventListener('click', async ()=> {
    const localUser = JSON.parse(localStorage.getItem('sr_user')||'null');
    if (!localUser) { alert('Please sign in.'); window.location.href='login.html'; return; }
    const text = dashInput.value.trim(); if (!text) return alert('Enter text.');
    dashHumanize.disabled=true; dashHumanize.textContent='Processing...';
    try {
      const idToken = auth && auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const tone = el('dashTone').value;
      const resp = await fetch((SERVER_BASE||'') + '/api/humanize', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(idToken?{'Authorization':'Bearer '+idToken}:{}) },
        body: JSON.stringify({ text, tone })
      });
      if (!resp.ok) throw new Error('Server error');
      const payload = await resp.json();
      const out = el('dashOutput'); out.classList.remove('hidden'); out.textContent = payload.humanizedText || 'No output';
    } catch(err) { alert('Error: ' + err.message); }
    finally { dashHumanize.disabled=false; dashHumanize.textContent='Humanize'; }
  });
}

const saveConv = el('saveConv');
if (saveConv) {
  saveConv.addEventListener('click', () => {
    const input = el('dashInput').value.trim(); const output = el('dashOutput').textContent || '';
    if (!input || !output) return alert('Nothing to save');
    const saved = JSON.parse(localStorage.getItem('sr_saved') || '[]');
    saved.unshift({ id: Date.now(), input, output, date: new Date().toISOString() });
    localStorage.setItem('sr_saved', JSON.stringify(saved));
    renderSaved();
  });
}
function renderSaved() {
  const list = el('savedList'); if(!list) return;
  const saved = JSON.parse(localStorage.getItem('sr_saved') || '[]');
  list.innerHTML = saved.map(s => `<div class="p-3 border rounded"><div class="text-xs text-gray-500">${new Date(s.date).toLocaleString()}</div><div class="mt-1 font-medium">Input</div><div class="text-sm whitespace-pre-wrap">${escapeHtml(s.input)}</div><div class="mt-2 font-medium">Output</div><div class="text-sm whitespace-pre-wrap">${escapeHtml(s.output)}</div></div>`).join('');
}
document.addEventListener('DOMContentLoaded', renderSaved);

const logoutBtn = el('logoutBtn');
if (logoutBtn && auth) logoutBtn.addEventListener('click', async ()=>{ await auth.signOut(); localStorage.removeItem('sr_user'); window.location.href='index.html'; });

const checkoutPro = el('checkoutPro');
if (checkoutPro) checkoutPro.addEventListener('click', async ()=> {
  const localUser = JSON.parse(localStorage.getItem('sr_user') || 'null');
  if (!localUser) { alert('Please sign up or log in to upgrade'); window.location.href='signup.html'; return; }
  try {
    const idToken = auth && auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const resp = await fetch((SERVER_BASE||'') + '/api/checkout', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...(idToken?{'Authorization':'Bearer '+idToken}:{}) },
      body: JSON.stringify({ plan: 'pro' })
    });
    const data = await resp.json();
    if (data.url) window.location.href = data.url; else alert('Checkout session creation failed (demo).');
  } catch(err) { alert('Checkout error: ' + err.message); }
});

updateAuthUI();
