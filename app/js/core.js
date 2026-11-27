'use strict';
/* Tutobridge web app — core: config, shared data, helpers, routing, auth screens.
   Talks to the same Supabase project as the mobile app. Row-level security in the database decides what each
   user can read and change, so nothing here is trusted for access control. */

const SUPABASE_URL = 'https://kdgyxgytcphnmsnvxdiz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5mo3bWfClhII0ymU2asdDg_Shpsc6fh'; // publishable (client-side) key
const SUPPORT_EMAIL = 'support@tutobridge.com';
const APP_URL = location.origin + '/app/';

// Read before the client starts: it consumes the tokens in a password-reset link and clears them from the URL.
const OPENED_RESET_LINK = /type=recovery/.test(location.hash + location.search);

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/* ------------------------------------------------------------------ shared data (mirrors the mobile app) */
const SUBJECTS = ['Mathematics', 'English', 'Urdu', 'Science', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Islamiat', 'Art & Crafts'];
const CURRICULA = ['Montessori/Early Years', 'Primary', 'Matric/FSc', 'O Levels', 'A Levels', 'IB'];
const HOODS = ['DHA', 'Gulberg', 'Johar Town', 'Jubilee Town', 'Model Town', 'Bahria Town', 'Cantt', 'Garden Town', 'Wapda Town'];
const TEACH_MODES = [ // teacher_profiles.teaching_modes
  { db: 'online', label: 'Online', badge: 'Online' },
  { db: 'home_academy', label: 'Home Academy / Tuition Center', badge: 'Home Academy' },
  { db: 'private_home', label: 'Private Home Tuition', badge: 'Private Home Tuition' },
];
const BOOKING_MODES = { // bookings.teaching_mode
  at_school: { label: 'At School', icon: '🏫' },
  at_student_home: { label: "At Student's Home", icon: '🏠' },
  at_teacher_home: { label: "At Teacher's Home", icon: '🚪' },
  online: { label: 'Online', icon: '💻' },
};
const EXPERTISE = [
  { slug: 'early_years', label: 'Early Years', short: 'Early Years', hint: 'Pre-K / Montessori / Kindergarten' },
  { slug: 'primary', label: 'Primary / Elementary (Grades 1–5)', short: 'Primary', hint: 'Foundational Math, English, Science, Urdu' },
  { slug: 'middle_school', label: 'Middle School (Grades 6–8)', short: 'Middle School', hint: 'Pre-Algebra, General Science, Languages, Social Studies' },
  { slug: 'high_school', label: 'High School / O-Levels / Matric (Grades 9–10)', short: 'O-Levels / Matric', hint: 'Physics, Chemistry, Biology, Accounting, Computer Science, Add Math' },
  { slug: 'higher_secondary', label: 'Higher Secondary / A-Levels / FSc / IB (Grades 11–12)', short: 'A-Levels / FSc / IB', hint: 'Specialized exam prep and university-track subjects' },
  { slug: 'university_test_prep', label: 'University & Test Prep', short: 'Test Prep', hint: 'Undergraduate courses, SAT, GRE, IELTS, MDCAT, ECAT' },
  { slug: 'quran_nazra', label: 'Quran / Nazra', short: 'Quran / Nazra' },
  { slug: 'sports', label: 'Sports', short: 'Sports' },
  { slug: 'aitchison_prep', label: 'Aitchison Preparatory', short: 'Aitchison Prep' },
];
const QUICK = [
  { label: 'Early Years', icon: '🧸', slugs: ['early_years'] },
  { label: 'Primary', icon: '🎒', slugs: ['primary'] },
  { label: 'Middle School', icon: '📘', slugs: ['middle_school'] },
  { label: 'O / A Levels', icon: '🎓', slugs: ['high_school', 'higher_secondary'] },
  { label: 'Aitchison Prep', icon: '🏛️', slugs: ['aitchison_prep'] },
  { label: 'Quran / Nazra', icon: '📖', slugs: ['quran_nazra'] },
  { label: 'Test Prep', icon: '📝', slugs: ['university_test_prep'] },
  { label: 'Sports', icon: '⚽', slugs: ['sports'] },
];
const RATE_TYPES = { per_day: { label: 'Per Day', unit: 'day' }, per_month: { label: 'Per Month', unit: 'month' } };

/* ------------------------------------------------------------------ state */
const S = {
  session: null,
  profile: null, // row from get_my_profile()
  teacher: null, // own teacher_profiles row (teachers only)
  channels: [], // realtime channels owned by the current screen
  recovering: OPENED_RESET_LINK, // opened a password-reset link
};

/* ------------------------------------------------------------------ helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function errText(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'That email and password do not match. Try again or reset your password.';
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Could not reach Tutobridge. Check your internet connection.';
  return m;
}
function toast(msg, bad = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), bad ? 6000 : 4000);
}
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}
function avatar(name, url, size = 48) {
  const st = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px`;
  if (url) return `<span class="av" style="${st}"><img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  return `<span class="av" style="${st}">${esc(initials(name))}</span>`;
}
function pkr(n) {
  return n == null || n === '' ? '' : 'PKR ' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}
function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function isPkMobile(raw) { return /^(\+92|92|0)3\d{9}$/.test(String(raw || '').replace(/[\s-]/g, '')); }
function toIntl(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return '92' + d.slice(1);
  return '92' + d;
}
function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim()); }
function num(v) { const n = parseFloat(String(v ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : null; }
function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || 'Please wait...'; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
function fieldError(input, msg) {
  if (!input) return;
  input.classList.toggle('bad', !!msg);
  let e = input.parentElement.querySelector('.err');
  if (msg) {
    if (!e) { e = document.createElement('div'); e.className = 'err'; input.insertAdjacentElement('afterend', e); }
    e.textContent = '⚠ ' + msg;
  } else if (e) e.remove();
}
function chipGroup(name, options, selected, { single = false, labels = null } = {}) {
  return `<div class="chips wrap" data-chips="${esc(name)}" data-single="${single ? 1 : 0}">${options
    .map((o, i) => `<button type="button" class="chip ${selected.includes(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(labels ? labels[i] : o)}</button>`)
    .join('')}</div>`;
}
function readChips(root, name) {
  return $$(`[data-chips="${name}"] .chip.on`, root).map((b) => b.dataset.v);
}
// Toggle behaviour for every chip group rendered by chipGroup().
document.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-chips] .chip');
  if (!chip) return;
  const group = chip.closest('[data-chips]');
  if (group.dataset.single === '1') {
    const was = chip.classList.contains('on');
    $$('.chip', group).forEach((c) => c.classList.remove('on'));
    if (!was) chip.classList.add('on');
  } else chip.classList.toggle('on');
  group.dispatchEvent(new CustomEvent('chips', { bubbles: true }));
});

/* ------------------------------------------------------------------ location input (GPS + optional label lookup) */
function locationField(id, { label = 'Current location', value = '', lat = null, lng = null } = {}) {
  return `<div class="f" data-loc="${id}" data-lat="${lat ?? ''}" data-lng="${lng ?? ''}" style="margin-bottom:14px">
    <label class="f" style="margin-bottom:6px"><span>${esc(label)}</span>
      <input class="inp" name="${id}_label" maxlength="200" placeholder="e.g. Gulberg III, Lahore" value="${esc(value)}"></label>
    <div class="row wrap"><button type="button" class="btn out sm" data-locate="${id}">📍 Use Current Location</button>
      <span class="small muted" data-locmsg>${lat != null ? '✓ Location saved' : 'Optional. Used to show approximate distances.'}</span></div>
  </div>`;
}
function readLocation(root, id) {
  const box = $(`[data-loc="${id}"]`, root);
  if (!box) return { label: '', lat: null, lng: null };
  const lat = box.dataset.lat === '' ? null : Number(box.dataset.lat);
  const lng = box.dataset.lng === '' ? null : Number(box.dataset.lng);
  return { label: $('input', box).value.trim(), lat, lng };
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-locate]');
  if (!b) return;
  const box = b.closest('[data-loc]');
  const msg = $('[data-locmsg]', box);
  if (!navigator.geolocation) { msg.textContent = 'Location is not available in this browser. Type it instead.'; return; }
  setBusy(b, true, 'Finding you...');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    box.dataset.lat = lat; box.dataset.lng = lng;
    let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=15&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } });
      const j = await r.json();
      const a = j.address || {};
      const parts = [...new Set([a.suburb || a.neighbourhood || a.quarter || a.residential, a.city || a.town || a.county].filter(Boolean))];
      if (parts.length) label = parts.join(', ');
    } catch (_) { /* coordinates are used as the label instead */ }
    const input = $('input', box);
    if (!input.value.trim() || /^-?\d+\.\d+, -?\d+\.\d+$/.test(input.value.trim())) input.value = label;
    msg.textContent = '✓ Location saved. You can edit the label.';
    setBusy(b, false);
  }, (err) => {
    msg.textContent = err.code === 1 ? 'Location permission was denied. You can type your location instead.' : 'Could not get your location. Try again or type it.';
    setBusy(b, false);
  }, { enableHighAccuracy: true, timeout: 15000 });
});

/* ------------------------------------------------------------------ overlays */
function closeOverlay() { const o = $('#over'); o.className = ''; o.innerHTML = ''; document.body.style.overflow = ''; }
function openSheet(html, { onMount } = {}) {
  const o = $('#over');
  o.innerHTML = `<div class="scrim" data-close-over></div><div class="sheet" role="dialog" aria-modal="true"><button class="x" data-close-over aria-label="Close">✕</button>${html}</div>`;
  o.className = 'open';
  document.body.style.overflow = 'hidden';
  if (onMount) onMount($('.sheet', o));
  return $('.sheet', o);
}
function confirmBox(title, body, okLabel = 'Confirm', cancelLabel = 'Cancel') {
  return new Promise((resolve) => {
    const sh = openSheet(`<h2 style="padding-right:40px">${esc(title)}</h2><p class="muted" style="white-space:pre-line">${esc(body)}</p>
      <div class="row" style="margin-top:18px"><button class="btn out grow" data-no>${esc(cancelLabel)}</button><button class="btn grow" data-yes>${esc(okLabel)}</button></div>`);
    $('[data-yes]', sh).onclick = () => { closeOverlay(); resolve(true); };
    $('[data-no]', sh).onclick = () => { closeOverlay(); resolve(false); };
    $$('[data-close-over]').forEach((x) => x.addEventListener('click', () => resolve(false), { once: true }));
  });
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-close-over]')) closeOverlay(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#over').classList.contains('open')) closeOverlay(); });

async function signOut() {
  if (!(await confirmBox('Log out?', 'You can log back in any time with your email and password.', 'Log out', 'Stay'))) return;
  await sb.auth.signOut();
  location.hash = '#/';
}

/* ------------------------------------------------------------------ routing */
const ROUTES = {}; // name -> render(params) ; filled in by the other files
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function clearChannels() { S.channels.forEach((c) => sb.removeChannel(c)); S.channels = []; }
function view(html) { const a = $('#app'); a.innerHTML = `<div class="screen">${html}</div>`; window.scrollTo(0, 0); return a; }
function loading() { $('#app').innerHTML = '<div class="spin"></div>'; }

function renderNav() {
  const nav = $('#nav');
  const r = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'home';
  if (!S.session || !S.profile) {
    nav.innerHTML = `<a class="nb" href="/">Website</a><a class="nb ${r === 'login' ? 'on' : ''}" href="#/login">Log in</a>`;
    return;
  }
  const role = S.profile.role;
  const homeLabel = role === 'teacher' ? 'Dashboard' : role === 'admin' ? 'Review' : 'Search';
  const homeIcon = role === 'teacher' ? '📋' : role === 'admin' ? '🛡️' : '🔍';
  nav.innerHTML = `<a class="nb ${['home', ''].includes(r) ? 'on' : ''}" href="#/home">${homeIcon}<span class="tx">${homeLabel}</span></a>
    ${role !== 'admin' ? `<a class="nb ${['chats', 'chat'].includes(r) ? 'on' : ''}" href="#/chats">💬<span class="tx">Chats</span></a>` : ''}
    <button class="nb" data-a="drawer">${avatar(S.profile.full_name, S.profile.avatar_url, 28)}<span class="tx">Account</span></button>`;
}

async function loadMe() {
  const { data, error } = await sb.rpc('get_my_profile');
  if (error) throw error;
  if (!data || !data.length) throw new Error('Your profile was not found. Please log out and sign up again.');
  S.profile = data[0];
  if (S.profile.role === 'teacher') {
    const t = await sb.from('teacher_profiles').select('*').eq('id', S.profile.id).maybeSingle();
    if (t.error) throw t.error;
    S.teacher = t.data;
  } else S.teacher = null;
}
function onboardingComplete(t) {
  if (!t) return false;
  const modes = [t.available_at_school, t.available_at_student_home, t.available_at_teacher_home, (t.teaching_modes || []).includes('online')].filter(Boolean).length;
  return (t.qualifications || []).length && (t.subjects || []).length && (t.curricula || []).length && (t.neighborhoods || []).length && modes > 0;
}

const PUBLIC = new Set(['', 'welcome', 'login', 'signup', 'forgot', 'help', 'terms']);
async function route() {
  clearChannels();
  closeOverlay();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  let name = parts[0] || '';
  const params = parts.slice(1).map(decodeURIComponent);

  if (S.recovering && S.session) { renderNav(); return ROUTES.reset(); }

  if (!S.session) {
    S.profile = null;
    renderNav();
    if (!PUBLIC.has(name)) name = 'welcome';
    return (ROUTES[name] || ROUTES.welcome)(params);
  }
  if (!S.profile) {
    loading();
    try { await loadMe(); } catch (e) {
      renderNav();
      return view(`<div class="narrow center" style="padding:40px 0"><div style="font-size:44px">☁️</div><p>${esc(errText(e))}</p>
        <button class="btn" data-a="reload">Try again</button> <button class="btn out" data-a="signout-now">Log out</button></div>`);
    }
  }
  renderNav();
  if (['', 'welcome', 'login', 'signup', 'forgot'].includes(name)) name = 'home';
  if (S.profile.role === 'teacher' && !onboardingComplete(S.teacher) && !['help', 'terms'].includes(name)) name = 'onboarding';
  const fn = ROUTES[name] || ROUTES.home;
  try { await fn(params); } catch (e) { console.error(e); view(`<div class="narrow center" style="padding:40px 0"><p>${esc(errText(e))}</p><button class="btn" data-a="reload">Try again</button></div>`); }
  renderNav();
}
window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]');
  if (!a) return;
  const act = a.dataset.a;
  if (act === 'reload') { S.profile = null; route(); }
  else if (act === 'signout-now') sb.auth.signOut().then(() => go('#/'));
  else if (act === 'signout') signOut();
  else if (act === 'drawer') openDrawer();
  else if (act === 'go') go(a.dataset.v);
});

/* ------------------------------------------------------------------ account drawer */
function openDrawer() {
  const p = S.profile;
  if (!p) return;
  const isT = p.role === 'teacher';
  const items = [
    p.role !== 'admin' && ['💬', 'Chats', `Your conversations with ${isT ? 'parents' : 'teachers'}`, '#/chats'],
    isT && ['✏️', 'Edit profile & rates', 'Subjects, teaching modes, fees and documents', '#/edit'],
    ['🏠', 'Address', 'Current and saved addresses', '#/address'],
    p.role !== 'admin' && ['⭐', 'Subscription', 'Plans and pricing', '#/plans'],
    ['❓', 'General', 'Help Center and FAQs', '#/help'],
    ['📄', 'Terms and Policies', 'Terms of Service and Privacy Policy', '#/terms'],
  ].filter(Boolean);
  const o = $('#over');
  o.innerHTML = `<div class="scrim" data-close-over></div><aside class="drawer">
    <div class="dh">${avatar(p.full_name, p.avatar_url, 58)}<div class="grow"><b style="font-size:18px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.full_name)}</b>
      <span class="pill" style="background:#fff;margin-top:6px">${isT ? 'Teacher' : p.role === 'admin' ? 'Admin' : 'Parent / Student'}</span></div></div>
    <div class="dl">${items.map(([ic, t, s, h]) => `<button class="mcard" data-a="go" data-v="${h}"><span class="ic">${ic}</span><span class="grow"><b>${t}</b><small>${s}</small></span>›</button>`).join('')}</div>
    <div style="padding:14px"><button class="btn out full" data-a="signout">↩ Log out</button></div></aside>`;
  o.className = 'open';
}

/* ------------------------------------------------------------------ auth screens */
ROUTES.welcome = () => {
  view(`<div class="hero">
    <div class="st"><span class="pill lime">📍 Lahore</span>
      <h1>Find a trusted tutor <em>right in your neighbourhood.</em></h1>
      <p class="muted" style="font-size:17px;line-height:1.55">Search verified teachers near you, chat first, then book a trial lesson. Teachers: get found by families nearby and manage requests in one place.</p>
      <div class="row wrap" style="margin-top:6px"><span class="pill out">✓ Verified teachers</span><span class="pill out">💬 Chat before you commit</span><span class="pill out">🔒 Address kept private</span></div>
    </div>
    <div class="wcards st" style="--i:2">
      <button class="wcard lime" data-a="go" data-v="#/signup/parent"><b>I'm a parent or student →</b><span>Find teachers near you and book a trial.</span></button>
      <button class="wcard" data-a="go" data-v="#/signup/teacher"><b>I'm a teacher →</b><span>Create your profile and start receiving requests.</span></button>
      <p class="center" style="margin:6px 0 0">Already have an account? <a href="#/login" style="font-weight:800">Log in</a></p>
    </div></div>`);
};

ROUTES.login = () => {
  const a = view(`<div class="narrow" style="padding-top:20px">
    <h1 class="st">Welcome back</h1><p class="muted st" style="--i:1">Log in to continue to Tutobridge.</p>
    <form id="f" class="st" style="--i:2;margin-top:18px" novalidate>
      <label class="f"><span>Email</span><input class="inp" name="email" type="email" autocomplete="email"></label>
      <label class="f"><span>Password</span><input class="inp" name="password" type="password" autocomplete="current-password"></label>
      <button class="btn full" id="go">Log in</button>
      <p class="center"><a href="#/forgot" style="font-weight:800">Forgot password?</a></p>
      <p class="center muted">New here? <a href="#/signup/parent" style="font-weight:800">Sign up as a parent</a> · <a href="#/signup/teacher" style="font-weight:800">Register as a teacher</a></p>
    </form></div>`);
  $('#f', a).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = f.email.value.trim();
    fieldError(f.email, isEmail(email) ? '' : 'Enter a valid email address');
    fieldError(f.password, f.password.value ? '' : 'Enter your password');
    if (!isEmail(email) || !f.password.value) return;
    const b = $('#go', a);
    setBusy(b, true, 'Logging in...');
    const { error } = await sb.auth.signInWithPassword({ email, password: f.password.value });
    setBusy(b, false);
    if (error) return toast(errText(error), true);
    go('#/home');
  };
};

ROUTES.signup = ([role]) => {
  const isT = role === 'teacher';
  const a = view(`<div class="narrow">
    <button class="back" data-a="go" data-v="#/">← Back</button>
    <h1 class="st">${isT ? 'Register as a Teacher' : 'Parent / Student Sign Up'}</h1>
    <p class="muted st" style="--i:1">${isT ? 'Create your teacher account. You will add your subjects and rates next.' : 'Create an account to find teachers near you.'}</p>
    <form id="f" class="st" style="--i:2;margin-top:16px" novalidate>
      <label class="f"><span>Full name</span><input class="inp" name="name" autocomplete="name"></label>
      <label class="f"><span>${isT ? 'Phone / WhatsApp number' : 'Phone number'}</span><input class="inp" name="phone" type="tel" placeholder="03XX XXXXXXX" autocomplete="tel"></label>
      <label class="f"><span>${isT ? 'Current Address' : 'Residential / Street Address'}</span><textarea class="inp" name="address" maxlength="300" placeholder="House, street, area, city" autocomplete="street-address"></textarea></label>
      ${locationField('loc')}
      <label class="f"><span>Email</span><input class="inp" name="email" type="email" autocomplete="email"></label>
      <label class="f"><span>Password</span><input class="inp" name="password" type="password" autocomplete="new-password"><div class="help">At least 8 characters</div></label>
      <p class="small muted">By creating an account you agree to the <a href="#/terms">Terms and Privacy Policy</a>.</p>
      <button class="btn full" id="go">${isT ? 'Create Teacher Account' : 'Create Account'}</button>
      <p class="center muted">Already have an account? <a href="#/login" style="font-weight:800">Log in</a></p>
    </form></div>`);
  $('#f', a).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const checks = [
      [f.name, f.name.value.trim().length >= 2 ? '' : 'Enter your name'],
      [f.phone, isPkMobile(f.phone.value) ? '' : 'Enter a Pakistani mobile number like 0300 1234567'],
      [f.address, f.address.value.trim().length >= 8 ? '' : 'Enter your full address'],
      [f.email, isEmail(f.email.value) ? '' : 'Enter a valid email address'],
      [f.password, f.password.value.length >= 8 ? '' : 'Use at least 8 characters'],
    ];
    checks.forEach(([i, m]) => fieldError(i, m));
    if (checks.some(([, m]) => m)) return toast('Please fix the highlighted fields.', true);
    const loc = readLocation(a, 'loc');
    const b = $('#go', a);
    setBusy(b, true, 'Creating your account...');
    const { data, error } = await sb.auth.signUp({
      email: f.email.value.trim(),
      password: f.password.value,
      options: {
        emailRedirectTo: APP_URL,
        data: {
          role: isT ? 'teacher' : 'parent',
          full_name: f.name.value.trim(),
          phone_number: f.phone.value.trim(),
          address: f.address.value.trim(),
          current_location_label: loc.label,
          ...(loc.lat != null ? { current_lat: loc.lat, current_lng: loc.lng } : {}),
        },
      },
    });
    setBusy(b, false);
    if (error) return toast(errText(error), true);
    if (!data.session) {
      view(`<div class="narrow center" style="padding:40px 0"><div style="font-size:52px">📬</div><h1>Check your email</h1>
        <p class="muted">We sent a confirmation link to <b>${esc(f.email.value.trim())}</b>. Open it to activate your account, then log in.</p>
        <a class="btn" href="#/login">Go to log in</a></div>`);
    } else go('#/home');
  };
};

ROUTES.forgot = () => {
  const a = view(`<div class="narrow" style="padding-top:20px">
    <button class="back" data-a="go" data-v="#/login">← Back to log in</button>
    <h1>Forgot your password?</h1><p class="muted">Enter your email and we'll send you a link to set a new one.</p>
    <form id="f" novalidate style="margin-top:16px"><label class="f"><span>Email</span><input class="inp" name="email" type="email" autocomplete="email"></label>
    <button class="btn full" id="go">Send reset link</button></form></div>`);
  $('#f', a).onsubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    fieldError(e.target.email, isEmail(email) ? '' : 'Enter a valid email address');
    if (!isEmail(email)) return;
    const b = $('#go', a);
    setBusy(b, true, 'Sending...');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
    setBusy(b, false);
    if (error) return toast(errText(error), true);
    view(`<div class="narrow center" style="padding:40px 0"><div style="font-size:52px">📬</div><h1>Check your email</h1>
      <p class="muted">If an account exists for <b>${esc(email)}</b>, a reset link is on its way. Open it on this device to choose a new password.</p>
      <a class="btn out" href="#/login">Back to log in</a></div>`);
  };
};

ROUTES.reset = () => {
  const a = view(`<div class="narrow" style="padding-top:20px"><h1>Choose a new password</h1><p class="muted">You're signed in from your reset link. Pick a new password to finish.</p>
    <form id="f" novalidate style="margin-top:16px">
      <label class="f"><span>New password</span><input class="inp" name="p1" type="password" autocomplete="new-password"><div class="help">At least 8 characters</div></label>
      <label class="f"><span>Confirm new password</span><input class="inp" name="p2" type="password" autocomplete="new-password"></label>
      <button class="btn full" id="go">Save new password</button></form></div>`);
  $('#f', a).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    fieldError(f.p1, f.p1.value.length >= 8 ? '' : 'Use at least 8 characters');
    fieldError(f.p2, f.p2.value === f.p1.value ? '' : 'The passwords do not match');
    if (f.p1.value.length < 8 || f.p1.value !== f.p2.value) return;
    const b = $('#go', a);
    setBusy(b, true, 'Saving...');
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    setBusy(b, false);
    if (error) return toast(errText(error), true);
    S.recovering = false;
    toast('Password updated. You are logged in.');
    go('#/home');
  };
};

/* ------------------------------------------------------------------ boot */
async function boot() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  sb.auth.onAuthStateChange((event, session) => {
    const had = !!S.session;
    S.session = session;
    if (event === 'PASSWORD_RECOVERY') { S.recovering = true; route(); return; }
    if (event === 'SIGNED_OUT') { S.profile = null; S.teacher = null; S.recovering = false; route(); return; }
    if (event === 'SIGNED_IN' && !had) { S.profile = null; route(); }
  });
  // Old-style links from the homepage (e.g. /app/?role=teacher or ?login) land on the right screen.
  const q = new URLSearchParams(location.search);
  if (!location.hash) {
    if (q.has('login')) location.hash = '#/login';
    else if (q.get('role') === 'teacher') location.hash = '#/signup/teacher';
    else if (q.get('role') === 'parent') location.hash = '#/signup/parent';
  }
  route();
}
window.addEventListener('DOMContentLoaded', boot);
