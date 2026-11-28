'use strict';
/* Chats, address book, subscription plans, help center, terms, admin review. */

/* ------------------------------------------------------------------ chats */
ROUTES.chats = async () => {
  let all = null, active = true;
  const isT = S.profile.role === 'teacher';
  const a = view(`<div class="mid"><h1>Chats</h1><div class="seg" id="tabs" style="margin:8px 0 14px"></div><div id="list"><div class="spin"></div></div></div>`);
  const isActive = (c) => Date.now() - new Date(c.last_message_at).getTime() < 30 * 864e5;
  const draw = () => {
    const nA = all.filter(isActive).length;
    $('#tabs', a).innerHTML = `<button data-tab="1" class="${active ? 'on' : ''}">Active ${nA}</button><button data-tab="0" class="${active ? '' : 'on'}">Past ${all.length - nA}</button>`;
    const shown = all.filter((c) => isActive(c) === active);
    $('#list', a).innerHTML = shown.length ? shown.map((c, i) => `<button class="convo st" style="--i:${Math.min(i, 8)}" data-a="go" data-v="#/chat/${c.id}">
        ${avatar(c.other_name, c.other_avatar_url, 48)}<span class="grow"><b style="display:block">${esc(c.other_name)}</b>
        <span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.last_message_preview || 'No messages yet. Say salam!')}</span></span>
        <span class="small muted">${fmtTime(c.last_message_at)}</span></button>`).join('')
      : `<div class="empty"><b>📒</b><span class="muted">${active ? (isT ? 'No active chats yet. Parents who connect with you, and requests you connect to, appear here.' : 'No active chats yet. Tap Connect on a teacher to start one.') : 'No past chats.'}</span>
        ${active && !isT ? '<div style="margin-top:12px"><a class="btn sm" href="#/home">Find a teacher</a></div>' : ''}</div>`;
  };
  const load = async () => {
    const { data, error } = await sb.rpc('my_conversations');
    if (error) { $('#list', a).innerHTML = `<p>${esc(errText(error))}</p>`; return; }
    all = data || [];
    draw();
  };
  a.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t && all) { active = t.dataset.tab === '1'; draw(); } });
  await load();
  // RLS limits delivery to this user's own conversations.
  S.channels.push(sb.channel('chats-list-' + S.profile.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load).subscribe());
};

ROUTES.chat = async ([id]) => {
  if (!id) return go('#/chats');
  const me = S.profile.id;
  const convos = await sb.rpc('my_conversations');
  const c = (convos.data || []).find((x) => x.id === id);
  if (!c) return view(`<div class="narrow center" style="padding:40px 0"><p>This conversation was not found.</p><a class="btn" href="#/chats">Back to chats</a></div>`);
  const a = view(`<div class="mid"><div class="chatwrap">
    <div class="chathead"><button class="back" style="margin:0" data-a="go" data-v="#/chats">←</button>${avatar(c.other_name, c.other_avatar_url, 40)}<b class="grow">${esc(c.other_name)}</b></div>
    <div class="msgs" id="msgs"><div class="spin"></div></div>
    <form class="sendbar" id="send"><textarea class="inp" name="body" maxlength="2000" rows="1" placeholder="Type a message..."></textarea><button class="btn" id="sendbtn" aria-label="Send">Send</button></form>
  </div><p class="small muted center">Keep it safe: never share passwords or bank details in chat.</p></div>`);
  const box = $('#msgs', a);
  const seen = new Set();
  const bubble = (m) => `<div class="bub ${m.sender_id === me ? 'me' : 'them'}" data-id="${m.id}">${esc(m.body)}<time>${fmtTime(m.created_at)}</time></div>`;
  const add = (m) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    $('.empty', box)?.remove();
    box.insertAdjacentHTML('beforeend', bubble(m));
    box.scrollTop = box.scrollHeight;
  };
  const { data, error } = await sb.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(300);
  if (error) { box.innerHTML = `<p>${esc(errText(error))}</p>`; return; }
  box.innerHTML = '';
  (data || []).reverse().forEach(add);
  if (!seen.size) box.innerHTML = `<div class="empty" style="margin:auto"><b>👋 Say salam to ${esc(firstName(c.other_name))}</b><span class="muted">${S.profile.role === 'teacher' ? 'Introduce yourself and ask what the student needs.' : 'Tell them the grade, subject and area you need.'}</span></div>`;
  S.channels.push(sb.channel('chat-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (pl) => add(pl.new)).subscribe());

  const form = $('#send', a), ta = form.body;
  const send = async () => {
    const body = ta.value.trim();
    if (!body) return;
    const b = $('#sendbtn', a);
    setBusy(b, true, '...');
    const { data: row, error: err } = await sb.from('messages').insert({ conversation_id: id, sender_id: me, body }).select().single();
    setBusy(b, false);
    if (err) return toast('Message not sent. ' + errText(err), true);
    ta.value = '';
    ta.style.height = '';
    add(row);
    ta.focus();
  };
  form.onsubmit = (e) => { e.preventDefault(); send(); };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  ta.focus();
};

/* ------------------------------------------------------------------ address book */
ROUTES.address = async () => {
  const a = view(`<div class="mid"><button class="back" data-a="go" data-v="#/home">← Back</button><h1>Address</h1><div id="body"><div class="spin"></div></div></div>`);
  const load = async () => {
    await loadMe();
    const me = S.profile;
    let { data: rows, error } = await sb.from('saved_addresses').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    // The address given at sign-up lives only on the profile; add it to the saved list once.
    const cur = (me.address || '').trim();
    if (cur.length >= 8 && !rows.some((s) => s.address.trim() === cur)) {
      await sb.from('saved_addresses').insert({ user_id: me.id, label: 'Registered address', address: cur, location_label: me.current_location_label, lat: me.current_lat, lng: me.current_lng });
      rows = (await sb.from('saved_addresses').select('*').order('created_at', { ascending: false })).data || [];
    }
    return { me, rows };
  };
  const draw = ({ me, rows }) => {
    const isCur = (s) => s.address.trim() === (me.address || '').trim();
    $('#body', a).innerHTML = `
      <div class="card lime"><div class="small" style="font-weight:800">CURRENT ADDRESS</div><b style="font-size:16px">${esc(me.address || 'Not set yet')}</b>
        ${me.current_location_label ? `<div class="small">📍 Near ${esc(me.current_location_label)}</div>` : ''}
        <div class="small" style="margin-top:6px">${me.current_lat != null ? '✓ Location saved, so distances are shown.' : 'No location saved. Add one below to see distances.'}</div></div>
      <h3>Saved addresses</h3>
      ${rows.length ? rows.map((s) => `<div class="card"><div class="row"><div class="grow"><b>${esc(s.label)}</b> ${isCur(s) ? '<span class="pill lime">Current</span>' : ''}
          <div>${esc(s.address)}</div>${s.location_label ? `<div class="small muted">Near ${esc(s.location_label)}</div>` : ''}</div></div>
        <div class="row" style="margin-top:10px">${isCur(s) ? '' : `<button class="btn sm" data-use="${s.id}">Use this address</button>`}<button class="btn out sm" data-del="${s.id}">Remove</button></div></div>`).join('')
        : '<p class="muted">Nothing saved yet. Add one below.</p>'}
      <h3>Add an address</h3>
      <form id="add" class="card" novalidate>
        <label class="f"><span>Label</span><input class="inp" name="label" maxlength="40" placeholder="e.g. Home, Grandparents, Academy"></label>
        <label class="f"><span>Address</span><textarea class="inp" name="address" maxlength="300" placeholder="House, street, area, city"></textarea></label>
        ${locationField('newloc')}
        <label class="check"><input type="checkbox" name="cur" checked> Make this my current address</label>
        <button class="btn full" id="save">Save address</button></form>`;
  };
  const refresh = async () => { try { draw(await load()); } catch (e) { $('#body', a).innerHTML = `<p>${esc(errText(e))}</p>`; } };
  await refresh();
  a.addEventListener('click', async (e) => {
    const u = e.target.closest('[data-use]'), d = e.target.closest('[data-del]');
    if (u) {
      setBusy(u, true, 'Saving...');
      const { error } = await sb.rpc('use_saved_address', { p_id: u.dataset.use });
      if (error) { setBusy(u, false); return toast(errText(error), true); }
      toast('Current address updated.');
      refresh();
    }
    if (d) {
      if (!(await confirmBox('Remove this address?', 'It will be removed from your saved addresses.', 'Remove', 'Keep it'))) return;
      const { error } = await sb.from('saved_addresses').delete().eq('id', d.dataset.del);
      if (error) return toast(errText(error), true);
      refresh();
    }
  });
  a.addEventListener('submit', async (e) => {
    if (e.target.id !== 'add') return;
    e.preventDefault();
    const f = e.target;
    fieldError(f.label, f.label.value.trim() ? '' : 'Give it a short label');
    fieldError(f.address, f.address.value.trim().length >= 8 ? '' : 'Enter the full address');
    if (!f.label.value.trim() || f.address.value.trim().length < 8) return;
    const loc = readLocation(a, 'newloc');
    const b = $('#save', a);
    setBusy(b, true, 'Saving...');
    const { data: row, error } = await sb.from('saved_addresses').insert({ user_id: S.profile.id, label: f.label.value.trim(), address: f.address.value.trim(), location_label: loc.label || null, lat: loc.lat, lng: loc.lng }).select().single();
    if (!error && f.cur.checked) {
      const r = await sb.rpc('use_saved_address', { p_id: row.id });
      if (r.error) { setBusy(b, false); return toast(errText(r.error), true); }
    }
    setBusy(b, false);
    if (error) return toast(errText(error), true);
    toast('Address saved.');
    refresh();
  });
};

/* ------------------------------------------------------------------ subscription plans */
// PLACEHOLDER PRICES AND BENEFITS, same as the mobile app. No payment provider is connected: a paid plan is recorded as a request.
const PLANS = {
  parent: [
    { id: 'parent_free', name: 'Free', price: 'PKR 0', tag: 'Everything you need to find a teacher', features: ['Search verified teachers near you', 'Chat with up to 3 teachers', 'Send trial booking requests'] },
    { id: 'parent_plus', name: 'Plus', price: 'PKR 499 / month', tag: 'For families comparing several teachers', popular: true, features: ['Everything in Free', 'Unlimited chats with teachers', 'Save and compare shortlisted teachers', 'Priority support'] },
    { id: 'parent_premium', name: 'Premium', price: 'PKR 999 / month', tag: 'We help you find the right fit', features: ['Everything in Plus', 'Personal teacher-matching help', 'Early access to new Star Teachers'] },
  ],
  teacher: [
    { id: 'teacher_free', name: 'Free', price: 'PKR 0', tag: 'Get listed and start receiving requests', features: ['Profile listed once verified', 'Receive booking requests', 'Chat with parents who connect'] },
    { id: 'teacher_pro', name: 'Pro', price: 'PKR 799 / month', tag: 'Be found sooner', popular: true, features: ['Everything in Free', 'Priority placement in search results', 'Profile views and request statistics'] },
    { id: 'teacher_featured', name: 'Featured', price: 'PKR 1,499 / month', tag: 'Stand out on the home screen', features: ['Everything in Pro', 'Featured spot in the home banner', 'Faster verification review'] },
  ],
};
ROUTES.plans = async () => {
  if (S.profile.role === 'teacher') {
    view(`<button class="back" data-a="go" data-v="#/home">← Back</button><h1>Your plan</h1>
      <div class="card star st"><div class="row"><h2 class="grow">Founding Teacher</h2><span class="pill lime">✓ Your plan</span></div>
        <div class="price">Free</div><div class="muted">You have free early access to every teacher feature.</div>
        <div style="margin:12px 0 4px">${['Verified profile that parents in Lahore can find', 'Unlimited trial requests and chats with parents', 'Map of parents looking for teachers near you', 'No fees and no commission on your tuition']
          .map((f) => `<div class="feat">✅ <span>${f}</span></div>`).join('')}</div></div>
      <p class="small muted">If we ever introduce paid options, we will tell you well in advance. Questions? Email ${SUPPORT_EMAIL}.</p>`);
    return;
  }
  const plans = PLANS.parent;
  const a = view(`<button class="back" data-a="go" data-v="#/home">← Back</button><h1>Choose a plan</h1><p class="muted">Upgrade or switch any time.</p><div id="plans"><div class="spin"></div></div>`);
  let cur = { plan_id: plans[0].id, status: 'active' };
  const draw = () => {
    $('#plans', a).innerHTML = `<div class="plans">${plans.map((p, i) => {
      const isCur = p.id === cur.plan_id && cur.status === 'active', req = p.id === cur.plan_id && cur.status === 'pending_payment';
      return `<div class="card ${isCur || p.popular ? 'star' : ''} st" style="--i:${i}"><div class="row"><h2 class="grow">${p.name}</h2>
        ${isCur ? '<span class="pill lime">✓ Your plan</span>' : req ? '<span class="pill lime">⏳ Requested</span>' : p.popular ? '<span class="pill lime">★ Most popular</span>' : ''}</div>
        <div class="price">${p.price}</div><div class="muted">${p.tag}</div><div style="margin:12px 0 16px">${p.features.map((f) => `<div class="feat">✅ <span>${f}</span></div>`).join('')}</div>
        ${isCur ? '<button class="btn out full" disabled>Current plan</button>' : `<button class="btn full" data-plan="${p.id}" ${req ? 'disabled' : ''}>${req ? 'Request received' : p.id.endsWith('_free') ? 'Switch to Free' : 'Select ' + p.name}</button>`}</div>`;
    }).join('')}</div><p class="small muted" style="margin-top:14px">Online payment is not available yet. Choosing a paid plan records a request and our team contacts you to activate it. Lesson fees are agreed directly between parent and teacher.</p>`;
  };
  const { data, error } = await sb.from('subscriptions').select('plan_id, status').maybeSingle();
  if (error) return ($('#plans', a).innerHTML = `<p>${esc(errText(error))}</p>`);
  if (data) cur = data;
  draw();
  a.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-plan]');
    if (!b) return;
    const p = plans.find((x) => x.id === b.dataset.plan);
    const free = p.id.endsWith('_free');
    if (!free && !(await confirmBox(`Request the ${p.name} plan?`, `${p.price}\n\nOnline payment is not available yet. We will record your request and contact you to activate it. You will not be charged now.`, 'Request plan', 'Not now'))) return;
    setBusy(b, true, 'Saving...');
    // Update first, insert if there is no row yet (users may only change plan_id, not user_id, on an existing row).
    let { data: upd, error: err } = await sb.from('subscriptions').update({ plan_id: p.id }).eq('user_id', S.profile.id).select('user_id');
    if (!err && !(upd || []).length) ({ error: err } = await sb.from('subscriptions').insert({ user_id: S.profile.id, plan_id: p.id }));
    if (err) { setBusy(b, false); return toast(errText(err), true); }
    cur = (await sb.from('subscriptions').select('plan_id, status').maybeSingle()).data || cur;
    draw();
    toast(free ? 'You are on the Free plan.' : `${p.name} plan requested. We will be in touch.`);
  });
};

/* ------------------------------------------------------------------ help center */
const FAQS = [
  ['Parents', 'How do I find a teacher near me?', 'Open Search. Teachers close to your saved location appear first, with an approximate distance. Use the search bar or the filters to narrow by subject, grade, curriculum or where the teaching happens.'],
  ['Parents', 'What does Connect do?', 'Connect opens a private chat with that teacher so you can ask questions, share the grade and subject you need, and agree on a time before booking.'],
  ['Parents', 'What is the difference between Connect and Book a Trial?', 'Connect is a conversation. Book a Trial sends the teacher a formal request with grade, subject, place and schedule. They can accept or decline it, and your contact details are shared only after they accept.'],
  ['Parents', 'What is a tuition request?', 'Post a request from the map on your Search page. Verified teachers nearby see your first name, the subject and your approximate area, and can start a chat with you. You can have up to 3 open requests.'],
  ['Parents', 'Where can the lessons happen?', "At school, at your home, at the teacher's home or academy, or online. Each teacher lists the places they offer."],
  ['Parents', 'Who can see my address and phone number?', 'Only a teacher who has accepted your request. Teachers you merely chat with cannot see them.'],
  ['Students', 'Can a student use Tutobridge?', 'Students should use Tutobridge together with a parent or guardian, who creates the account, chats with teachers and books lessons.'],
  ['Students', 'How do I know a teacher is safe?', 'Teachers show a Verified badge only after our team has reviewed their documents. We still recommend that a parent is at home for the first lesson.'],
  ['Students', 'What is a Star Teacher?', 'A Star Teacher has a 4.8+ rating, many parent reviews and verified student results.'],
  ['Teachers', 'Is Tutobridge free for teachers?', 'Yes. Teachers who join now get free early access, with no fees and no commission on your tuition. If we ever introduce paid options, we will tell you well in advance.'],
  ['Teachers', 'How do I get verified?', 'Complete your profile, enter your CNIC number and upload the front and back of your CNIC and your highest degree certificate (experience letters help too). You can skip setup after sign-up and finish it later from your dashboard. Your status shows as Pending until our team reviews them. Parents can find you once you are verified.'],
  ['Teachers', 'How do I set my fees?', 'In your profile choose whether you charge per day or per month and enter the amount for home and online tuition. School positions use an expected monthly salary. You can change these any time from the dashboard.'],
  ['Teachers', 'When do parents see my contact details?', 'Never before you accept a request. Your address is never shown to parents, only the neighbourhoods you cover.'],
  ['Teachers', 'How do I pause new requests?', 'Switch off Accepting New Students on your dashboard. You will be hidden from search until you switch it back on.'],
  ['Everyone', 'How do I change my address?', 'Open Account, then Address. Add a new address or pick a saved one and tap Use this address.'],
  ['Everyone', 'How do I use my current location?', 'When entering an address, tap Use Current Location and allow location access in your browser. You can edit the label afterwards, or type it instead.'],
  ['Everyone', 'How do subscriptions work?', 'Teachers: join now to get free early access. Parents: open Account, then Subscription to compare plans. The Free plan is always available, and paid plans are activated by our team.'],
  ['Everyone', 'How is payment handled?', 'Lesson fees are agreed and paid directly between parent and teacher. Tutobridge does not take payment for lessons.'],
  ['Everyone', 'Can I use the website and the mobile app?', 'Yes. Your account works on both, and your chats, bookings and addresses are the same everywhere.'],
];
ROUTES.help = () => {
  let who = 'All', q = '';
  const a = view(`<div class="mid"><button class="back" data-a="go" data-v="#/home">← Back</button><h1>How can we help?</h1>
    <input class="inp" id="q" placeholder="Search questions..." style="margin:8px 0 10px"><div class="chips" id="who"></div><div id="list" style="margin-top:8px"></div>
    <div class="card soft" style="margin-top:18px"><b>Still need help?</b><p class="muted" style="margin:6px 0 10px">Email us and we'll get back to you.</p><a class="btn sm" href="mailto:${SUPPORT_EMAIL}">✉️ ${SUPPORT_EMAIL}</a></div></div>`);
  const draw = () => {
    $('#who', a).innerHTML = ['All', 'Parents', 'Students', 'Teachers'].map((w) => `<button class="chip ${who === w ? 'on' : ''}" data-who="${w}">${w}</button>`).join('');
    const s = q.trim().toLowerCase();
    const shown = FAQS.filter(([aud, qq, aa]) => (who === 'All' || aud === who || aud === 'Everyone') && (!s || `${qq} ${aa}`.toLowerCase().includes(s)));
    $('#list', a).innerHTML = shown.length ? shown.map(([aud, qq, aa]) => `<details class="q"><summary>${esc(qq)}</summary><p>${esc(aa)}</p><span class="pill out">${aud}</span></details>`).join('') : '<p class="center muted">No answers match. Try different words.</p>';
  };
  draw();
  $('#q', a).oninput = (e) => { q = e.target.value; draw(); };
  a.addEventListener('click', (e) => { const w = e.target.closest('[data-who]'); if (w) { who = w.dataset.who; draw(); } });
};

/* ------------------------------------------------------------------ terms & privacy */
const TERMS = [
  ['1. About Tutobridge', 'Tutobridge helps parents and students in Lahore find and contact tutors and teachers. We provide the platform; the lessons themselves are agreed between you and the teacher.'],
  ['2. Accounts', 'You must give accurate information and keep your password private. Parents and guardians create accounts for children. You are responsible for activity under your account.'],
  ['3. Teachers', "Teachers must provide truthful qualifications and documents. A Verified badge means we reviewed the documents supplied, not that we guarantee any teacher's performance or conduct. We may refuse or remove a teacher at any time."],
  ['4. Lessons and payments', 'Parents and teachers agree the schedule, place and fee between themselves. Tutobridge does not collect payment for lessons and is not a party to that agreement. Subscription plans, where offered, are described on the Subscription page.'],
  ['5. Safety', "Meet in a safe place, keep a responsible adult nearby for children's lessons, and report anything concerning to us straight away. Do not share passwords or financial details in chat."],
  ['6. Messages and conduct', 'Be respectful. Do not harass, threaten, spam or mislead anyone, and do not use Tutobridge for anything unlawful. We may limit or close accounts that break these rules.'],
  ['7. Our responsibility', 'We work to keep the service available and accurate but provide it as is. To the extent the law allows, we are not liable for lessons, advice, or losses arising between users.'],
  ['8. Changes', 'We may update these terms. If a change is significant we will tell you in the app or on the website. Continuing to use Tutobridge means you accept the updated terms.'],
];
const PRIVACY = [
  ['What we collect', 'Your name, phone number, email and password; addresses and location you enter or capture; for teachers, qualifications, experience, fees, a profile photo and verification documents (CNIC and degree); messages you send; booking and tuition requests; your chosen subscription plan; and, for academies listed through our website, the academy details plus the owner name, CNIC number and phone number, which are used only to verify the academy and are never shown publicly; if you apply for a job at Tutobridge, the details and CV link you send us; and, if you ask to hear about paid resources, your name, contact details and interests.'],
  ['How we use it', 'To create your account, show teachers near you, let you chat and book, verify teachers, provide support, keep the service safe, and improve Tutobridge.'],
  ['Location', 'We use your location only when you tap Use Current Location or save an address. It is used to sort teachers by approximate distance. Other users never see your exact coordinates.'],
  ['Who can see what', "Teachers see a parent's phone number, address and location only after accepting that parent's request. Parents never see a teacher's address or exact location, only the neighbourhoods they cover and an approximate distance. Messages are visible only to the two people in the conversation. Verification documents are private to the teacher and our review team."],
  ['Sharing', 'We do not sell your personal data. We use trusted service providers, such as our hosting and database provider, to run Tutobridge. We may disclose information if the law requires it or to protect someone\'s safety.'],
  ['Keeping and deleting data', 'We keep your data while your account is active. You can ask us to delete your account and data at any time using the contact below, and you can remove saved addresses yourself.'],
  ['Children', 'Accounts for children are created and managed by a parent or guardian.'],
  ['Contact', 'Questions or requests about your data: ' + SUPPORT_EMAIL],
];
ROUTES.terms = () => {
  let tab = 'terms';
  const a = view(`<div class="mid"><button class="back" data-a="go" data-v="#/home">← Back</button><h1>Terms and Policies</h1><p class="small muted">Last updated: 26 November 2026</p>
    <div class="seg" id="tabs" style="margin:8px 0 14px"></div><div id="body"></div></div>`);
  const draw = () => {
    $('#tabs', a).innerHTML = `<button data-tab="terms" class="${tab === 'terms' ? 'on' : ''}">Terms of Service</button><button data-tab="privacy" class="${tab === 'privacy' ? 'on' : ''}">Privacy Policy</button>`;
    $('#body', a).innerHTML = (tab === 'terms' ? TERMS : PRIVACY).map(([h, b]) => `<h3>${esc(h)}</h3><p style="line-height:1.6;margin:0">${esc(b)}</p>`).join('');
  };
  draw();
  a.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); } });
};

/* ------------------------------------------------------------------ admin review (admins only; enforced by RLS) */
/* ------------------------------------------------------------------ admin panel */
const ADMIN_TABS = [['overview', '📊 Overview'], ['teachers', '🧑‍🏫 Teachers'], ['users', '👥 Users'], ['bookings', '📅 Bookings'], ['requests', '📝 Requests'], ['academies', '🏫 Academies'], ['jobs', '💼 Jobs'], ['resources', '📚 Resources']];
let ADMIN_TAB = 'overview';
function stat(n, label) { return `<div class="card center"><div style="font-size:30px;font-weight:800">${n}</div><div class="small muted">${label}</div></div>`; }
function table(cols, rows) {
  if (!rows.length) return '<div class="empty"><b>📭</b><span class="muted">Nothing here yet.</span></div>';
  return `<div style="overflow-x:auto"><table class="atable"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const statusPill = (s) => `<span class="pill ${s === 'verified' || s === 'accepted' || s === 'active' ? 'lime' : ''}">${esc(s || '—')}</span>`;

async function renderAdmin() {
  const a = view(`<div class="row wrap" style="justify-content:space-between;align-items:center"><div><h1 style="margin-bottom:4px">Admin panel</h1><p class="muted" style="margin:0">Tutobridge control room</p></div>
    <button class="btn out sm" data-a="refresh-admin">↻ Refresh</button></div>
    <div class="seg" id="atabs" style="margin:16px 0;flex-wrap:wrap">${ADMIN_TABS.map(([k, l]) => `<button data-atab="${k}" class="${ADMIN_TAB === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="apane"><div class="spin"></div></div>`);
  const pane = $('#apane', a);
  const show = async () => {
    $$('[data-atab]', a).forEach((b) => b.classList.toggle('on', b.dataset.atab === ADMIN_TAB));
    pane.innerHTML = '<div class="spin"></div>';
    try { await ADMIN_PANES[ADMIN_TAB](pane); } catch (e) { pane.innerHTML = `<p>${esc(errText(e))}</p>`; }
  };
  a.addEventListener('click', (e) => {
    const t = e.target.closest('[data-atab]');
    if (t) { ADMIN_TAB = t.dataset.atab; show(); }
    if (e.target.closest('[data-a="refresh-admin"]')) show();
    const j = e.target.closest('[data-jump]');
    if (j) { ADMIN_TAB = j.dataset.jump; show(); }
  });
  show();
}

const ADMIN_PANES = {
  async overview(p) {
    const [u, b, r] = await Promise.all([sb.rpc('admin_users'), sb.from('bookings').select('status, created_at'), sb.rpc('admin_requests')]);
    if (u.error) throw u.error; if (b.error) throw b.error; if (r.error) throw r.error;
    const users = u.data || [], bk = b.data || [], rq = r.data || [];
    const week = Date.now() - 7 * 864e5;
    const pending = users.filter((x) => x.role === 'teacher' && x.verification_status === 'pending').length;
    p.innerHTML = `<div class="tgrid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      ${stat(users.length, 'Total users')}${stat(users.filter((x) => x.role === 'parent').length, 'Parents / students')}
      ${stat(users.filter((x) => x.role === 'teacher').length, 'Teachers')}${stat(users.filter((x) => x.verification_status === 'verified').length, 'Verified teachers')}
      ${stat(users.filter((x) => new Date(x.created_at) > week).length, 'New sign-ups (7 days)')}${stat(bk.length, 'Bookings')}
      ${stat(bk.filter((x) => x.status === 'pending').length, 'Bookings waiting')}${stat(rq.filter((x) => x.status === 'open').length, 'Open tuition requests')}</div>
      ${pending ? `<div class="card" style="margin-top:16px;background:#FFD60A"><b>${pending} teacher${pending > 1 ? 's' : ''} waiting for verification.</b> <button class="btn sm" data-jump="teachers" style="margin-left:8px">Review now →</button></div>` : ''}`;
  },
  async teachers(p) { await adminTeachers(p); },
  async users(p) {
    const { data, error } = await sb.rpc('admin_users');
    if (error) throw error;
    let rows = data || [], f = 'all', q = '';
    p.innerHTML = `<div class="row wrap" style="margin-bottom:12px"><input class="inp grow" id="uq" placeholder="Search name, email or phone" style="min-width:200px">
      <div class="seg" id="uf">${['all', 'parent', 'teacher', 'admin'].map((k) => `<button data-uf="${k}" class="${k === 'all' ? 'on' : ''}">${k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div><div id="ut"></div>`;
    const draw = () => {
      const s = q.toLowerCase();
      const shown = rows.filter((x) => (f === 'all' || x.role === f) && (!s || [x.full_name, x.email, x.phone_number].some((v) => String(v || '').toLowerCase().includes(s))));
      $('#ut', p).innerHTML = `<p class="small muted">${shown.length} of ${rows.length} users</p>` + table(['Name', 'Email', 'Phone', 'Role', 'Plan', 'Joined', 'Last login'],
        shown.map((x) => [`<b>${esc(x.full_name)}</b>`, esc(x.email), x.phone_number ? `<a href="https://wa.me/${toIntl(x.phone_number)}" target="_blank" rel="noopener">${esc(x.phone_number)}</a>` : '—',
          esc(x.role) + (x.role === 'teacher' ? ' ' + statusPill(x.verification_status) : ''), x.plan_id ? `${esc(x.plan_id)} ${statusPill(x.plan_status)}` : '—', fmtDate(x.created_at), fmtDate(x.last_sign_in_at)]));
    };
    $('#uq', p).oninput = (e) => { q = e.target.value; draw(); };
    $('#uf', p).onclick = (e) => { const b = e.target.closest('[data-uf]'); if (!b) return; f = b.dataset.uf; $$('[data-uf]', p).forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    draw();
  },
  async bookings(p) {
    const { data, error } = await sb.from('bookings').select('*, parent:profiles!bookings_parent_id_fkey(full_name), teacher:teacher_profiles!bookings_teacher_id_fkey(profiles(full_name))').order('created_at', { ascending: false });
    if (error) throw error;
    p.innerHTML = table(['Date', 'Parent', 'Teacher', 'Subject', 'Grade', 'Mode', 'Schedule', 'Status'], (data || []).map((x) => [fmtDate(x.created_at), esc(x.parent?.full_name || '—'), esc(x.teacher?.profiles?.full_name || '—'),
      esc(x.subject), esc(x.student_grade), esc(BOOKING_MODES[x.teaching_mode]?.label || x.teaching_mode), esc(x.proposed_schedule || '—'), statusPill(x.status)]));
  },
  async requests(p) {
    const { data, error } = await sb.rpc('admin_requests');
    if (error) throw error;
    p.innerHTML = table(['Date', 'Parent', 'Subject', 'Curriculum', 'Grade', 'Note', 'Status'], (data || []).map((x) => [fmtDate(x.created_at), esc(x.parent_name), esc(x.subject), esc(x.curriculum || '—'), esc(x.grade || '—'), esc(x.note || '—'), statusPill(x.status)]));
  },
  async academies(p) {
    let tab = 'pending', rows = [];
    const TEACH = { '1': 'One teacher', '2-5': '2–5 teachers', '6-10': '6–10 teachers', '11-20': '11–20 teachers', '20+': '20+ teachers' };
    p.innerHTML = `<p class="muted">Academies submitted through "List my academy" on the website. Approve to show them on the public Academies map. Use ⭐ to feature a center under Best Learning Centers on the Notice Board. Owner name and CNIC are never shown publicly.</p>
      <div class="seg" id="actabs" style="margin:8px 0 14px"></div><div id="aclist"><div class="spin"></div></div>`;
    const draw = () => {
      const n = (s) => rows.filter((r) => r.status === s).length;
      $('#actabs', p).innerHTML = ['pending', 'approved', 'rejected'].map((s) => `<button data-actab="${s}" class="${tab === s ? 'on' : ''}">${s[0].toUpperCase() + s.slice(1)} ${n(s)}</button>`).join('');
      const shown = rows.filter((r) => r.status === tab);
      $('#aclist', p).innerHTML = shown.length ? `<div class="tgrid">${shown.map((x) => `<div class="card">
        <div class="row"><b class="grow" style="font-size:17px">${x.is_star ? '⭐ ' : ''}${esc(x.academy_name)}</b>${statusPill(x.status)}</div>
        ${x.is_star ? '<span class="pill ink">⭐ Best Learning Center</span>' : x.star_requested ? '<span class="pill lime">⭐ Applied for the star</span>' : ''}
        <div class="small muted">Submitted ${fmtTime(x.created_at)}</div>
        <div class="tc-line"><i>📚</i><span>${esc(x.classes.join(', '))}${x.subjects ? ' · ' + esc(x.subjects) : ''}</span></div>
        <div class="tc-line"><i>👩‍🏫</i><span>${esc(TEACH[x.teachers_count] || x.teachers_count)}</span></div>
        <div class="tc-line"><i>📍</i><span>${esc(x.area)} · ${esc(x.address)} ${x.lat != null ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lng}">(pin)</a>` : ''}</span></div>
        ${x.star_reason ? `<div class="tc-line"><i>💬</i><span><b>Why it stands out:</b> ${esc(x.star_reason)}</span></div>` : ''}
        ${x.website ? `<div class="tc-line"><i>🌐</i><a href="${esc(x.website)}" target="_blank" rel="noopener">${esc(x.website)}</a></div>` : ''}
        <div class="card" style="margin:10px 0 0;background:#FBF8EF"><b>Owner (private)</b>
          <div class="tc-line"><i>👤</i><span>${esc(x.owner_name)}</span></div>
          <div class="tc-line"><i>🪪</i><span>CNIC: <b>${esc(x.owner_cnic)}</b></span></div>
          <div class="tc-line"><i>📞</i><span><a href="tel:${esc(x.owner_phone.replace(/[^0-9+]/g, ''))}">${esc(x.owner_phone)}</a> · <a href="https://wa.me/${toIntl(x.owner_phone)}" target="_blank" rel="noopener">WhatsApp</a> ${x.show_phone ? '· shown to parents' : '· hidden from parents'}</span></div></div>
        <div class="row wrap" style="margin-top:10px">${x.status !== 'approved' ? `<button class="btn sm" data-acset="approved" data-id="${x.id}">✓ Approve</button>` : ''}
          ${x.status !== 'rejected' ? `<button class="btn out sm" data-acset="rejected" data-id="${x.id}">${x.status === 'approved' ? 'Remove from map' : 'Reject'}</button>` : ''}
          ${x.is_star ? `<button class="btn out sm" data-acstar="0" data-id="${x.id}">Remove ⭐ star</button>` : x.status !== 'rejected' ? `<button class="btn sm" data-acstar="1" data-id="${x.id}" style="background:#1F2A37;color:#FFD60A">⭐ Make Best Learning Center</button>` : ''}</div></div>`).join('')}</div>`
        : '<div class="empty"><b>🏫</b><span class="muted">Nothing here.</span></div>';
    };
    const load = async () => {
      const { data, error } = await sb.from('academy_submissions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      rows = data || [];
      draw();
    };
    await load();
    p.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-actab]');
      if (t) { tab = t.dataset.actab; draw(); return; }
      const st = e.target.closest('[data-acstar]');
      if (st) {
        const on = st.dataset.acstar === '1', now = new Date().toISOString();
        if (on && !(await confirmBox('Star this center?', 'It will be approved and shown on the Notice Board under Best Learning Centers, with a ⭐ on the map.', 'Star it'))) return;
        setBusy(st, true, '...');
        const { error } = await sb.from('academy_submissions').update(on ? { is_star: true, starred_at: now, status: 'approved', reviewed_at: now } : { is_star: false, starred_at: null }).eq('id', st.dataset.id);
        if (error) { setBusy(st, false); return toast(errText(error), true); }
        toast(on ? 'Starred. It now shows under Best Learning Centers.' : 'Star removed.');
        return load();
      }
      const b = e.target.closest('[data-acset]');
      if (!b) return;
      setBusy(b, true, '...');
      const { error } = await sb.from('academy_submissions').update({ status: b.dataset.acset, reviewed_at: new Date().toISOString(), ...(b.dataset.acset === 'rejected' ? { is_star: false, starred_at: null } : {}) }).eq('id', b.dataset.id);
      if (error) { setBusy(b, false); return toast(errText(error), true); }
      toast(b.dataset.acset === 'approved' ? 'Approved. It now shows on the Academies map.' : 'Updated.');
      await load();
    });
  },
  async jobs(p) {
    const TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Volunteer'];
    const ST = { new: 'New', shortlisted: 'Shortlisted', rejected: 'Rejected', hired: 'Hired' };
    let jobs = [], apps = [], view = 'jobs', edit = null;
    p.innerHTML = `<p class="muted">Jobs you post here appear on the website at <b>Jobs › Work for Tutobridge</b>. Applications come in below. Only admins can see them.</p>
      <div class="seg" id="jtabs" style="margin:8px 0 14px"></div><div id="jbody"><div class="spin"></div></div>`;
    const load = async () => {
      const [a, b] = await Promise.all([
        sb.from('jobs').select('*').order('created_at', { ascending: false }),
        sb.from('job_applications').select('*').order('created_at', { ascending: false }),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      jobs = a.data || []; apps = b.data || [];
      draw();
    };
    const title = (id) => (jobs.find((j) => j.id === id) || {}).title || 'Deleted job';
    const form = (j = {}) => `<form class="card" id="jform" style="display:grid;gap:10px">
      <b style="font-size:17px">${j.id ? 'Edit job' : 'Post a new job'}</b>
      <label class="f"><span>Job title</span><input class="inp" name="title" maxlength="120" value="${esc(j.title || '')}" placeholder="e.g. Admission Officer"></label>
      <div class="row wrap" style="gap:10px">
        <label class="f grow"><span>Department</span><input class="inp" name="department" maxlength="80" value="${esc(j.department || '')}" placeholder="e.g. Admissions"></label>
        <label class="f grow"><span>Type</span><select class="inp" name="job_type">${TYPES.map((t) => `<option ${t === (j.job_type || 'Full-time') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <div class="row wrap" style="gap:10px">
        <label class="f grow"><span>Location</span><input class="inp" name="location" maxlength="120" value="${esc(j.location || 'Lahore (on-site)')}"></label>
        <label class="f grow"><span>Salary <small class="muted">(optional)</small></span><input class="inp" name="salary" maxlength="120" value="${esc(j.salary || '')}" placeholder="e.g. PKR 50,000–70,000 / month"></label>
      </div>
      <label class="f"><span>About the role</span><textarea class="inp" name="description" rows="4" maxlength="4000">${esc(j.description || '')}</textarea></label>
      <label class="f"><span>What we look for <small class="muted">(one point per line)</small></span><textarea class="inp" name="requirements" rows="4" maxlength="4000">${esc(j.requirements || '')}</textarea></label>
      <label class="row" style="gap:8px;font-weight:700"><input type="checkbox" name="is_open" ${j.is_open === false ? '' : 'checked'}> Show on the website (open for applications)</label>
      <div class="row wrap"><button class="btn" id="jsave">${j.id ? 'Save changes' : 'Post job'}</button><button type="button" class="btn out" data-jcancel>Cancel</button></div></form>`;
    const draw = () => {
      const nNew = apps.filter((a) => a.status === 'new').length;
      $('#jtabs', p).innerHTML = `<button data-jview="jobs" class="${view === 'jobs' ? 'on' : ''}">Jobs ${jobs.length}</button><button data-jview="apps" class="${view === 'apps' ? 'on' : ''}">Applications ${apps.length}${nNew ? ` · ${nNew} new` : ''}</button>`;
      const b = $('#jbody', p);
      if (view === 'jobs') {
        b.innerHTML = (edit ? form(edit === 'new' ? {} : edit) : `<button class="btn" data-jnew style="margin-bottom:12px">＋ Post a new job</button>`) +
          (jobs.length ? `<div class="tgrid">${jobs.map((j) => {
            const n = apps.filter((a) => a.job_id === j.id).length;
            return `<div class="card"><div class="row"><b class="grow" style="font-size:17px">${esc(j.title)}</b><span class="pill ${j.is_open ? 'lime' : ''}">${j.is_open ? 'Open' : 'Closed'}</span></div>
              <div class="small muted">${esc(j.job_type)} · ${esc(j.location)}${j.department ? ' · ' + esc(j.department) : ''}${j.salary ? ' · ' + esc(j.salary) : ''}</div>
              <p class="small" style="margin:8px 0">${esc(j.description.slice(0, 180))}${j.description.length > 180 ? '…' : ''}</p>
              <div class="row wrap"><button class="btn sm" data-jedit="${j.id}">Edit</button><button class="btn out sm" data-jtoggle="${j.id}">${j.is_open ? 'Close job' : 'Reopen'}</button>
              <button class="btn out sm" data-japps="${j.id}">${n} application${n === 1 ? '' : 's'}</button><button class="btn out sm" data-jdel="${j.id}">Delete</button></div></div>`;
          }).join('')}</div>` : '<div class="empty"><b>💼</b><span class="muted">No jobs yet.</span></div>');
        const f = $('#jform', p);
        if (f) f.onsubmit = async (e) => {
          e.preventDefault();
          const v = (n) => f[n].value.trim();
          if (v('title').length < 2) return toast('Enter a job title.', true);
          if (v('description').length < 10) return toast('Write a few lines about the role.', true);
          const row = { title: v('title'), department: v('department') || null, job_type: v('job_type'), location: v('location') || 'Lahore', salary: v('salary') || null,
            description: v('description'), requirements: v('requirements') || null, is_open: f.is_open.checked, updated_at: new Date().toISOString() };
          setBusy($('#jsave', p), true, 'Saving...');
          const { error } = edit === 'new' ? await sb.from('jobs').insert(row) : await sb.from('jobs').update(row).eq('id', edit.id);
          if (error) { setBusy($('#jsave', p), false); return toast(errText(error), true); }
          toast(edit === 'new' ? 'Job posted. It is live on the website.' : 'Job updated.');
          edit = null; await load();
        };
      } else {
        const list = filterJob ? apps.filter((a) => a.job_id === filterJob) : apps;
        b.innerHTML = (filterJob ? `<div class="row" style="margin-bottom:10px"><span class="grow">Showing applications for <b>${esc(title(filterJob))}</b></span><button class="btn out sm" data-jall>Show all</button></div>` : '') +
          (list.length ? `<div class="tgrid">${list.map((a) => `<div class="card">
            <div class="row"><b class="grow" style="font-size:17px">${esc(a.full_name)}</b><span class="pill ${a.status === 'new' ? 'lime' : a.status === 'hired' ? 'ink' : ''}">${ST[a.status]}</span></div>
            <div class="small muted">For <b>${esc(title(a.job_id))}</b> · ${fmtTime(a.created_at)}</div>
            <div class="tc-line"><i>📞</i><span><a href="tel:${esc(a.phone.replace(/[^0-9+]/g, ''))}">${esc(a.phone)}</a> · <a href="https://wa.me/${toIntl(a.phone)}" target="_blank" rel="noopener">WhatsApp</a></span></div>
            ${a.email ? `<div class="tc-line"><i>✉️</i><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></div>` : ''}
            ${a.area ? `<div class="tc-line"><i>📍</i><span>${esc(a.area)}</span></div>` : ''}
            ${a.cv_url ? `<div class="tc-line"><i>📄</i><a href="${esc(a.cv_url)}" target="_blank" rel="noopener">Open CV</a></div>` : ''}
            <div class="small" style="margin-top:6px"><b>Experience:</b> ${esc(a.experience || '—')}</div>
            ${a.message ? `<div class="small" style="margin-top:4px"><b>Why this role:</b> ${esc(a.message)}</div>` : ''}
            <div class="row wrap" style="margin-top:10px">${Object.keys(ST).filter((s) => s !== a.status).map((s) => `<button class="btn ${s === 'shortlisted' || s === 'hired' ? '' : 'out'} sm" data-aset="${s}" data-id="${a.id}">${ST[s]}</button>`).join('')}</div></div>`).join('')}</div>`
            : '<div class="empty"><b>📨</b><span class="muted">No applications yet.</span></div>');
      }
    };
    let filterJob = null;
    await load();
    p.addEventListener('click', async (e) => {
      const t = (s) => e.target.closest(s);
      let b;
      if ((b = t('[data-jview]'))) { view = b.dataset.jview; filterJob = null; edit = null; return draw(); }
      if (t('[data-jnew]')) { edit = 'new'; return draw(); }
      if (t('[data-jcancel]')) { edit = null; return draw(); }
      if (t('[data-jall]')) { filterJob = null; return draw(); }
      if ((b = t('[data-jedit]'))) { edit = jobs.find((j) => j.id === b.dataset.jedit); draw(); return $('#jform', p).scrollIntoView({ behavior: 'smooth' }); }
      if ((b = t('[data-japps]'))) { view = 'apps'; filterJob = b.dataset.japps; return draw(); }
      if ((b = t('[data-jtoggle]'))) {
        const j = jobs.find((x) => x.id === b.dataset.jtoggle);
        setBusy(b, true, '...');
        const { error } = await sb.from('jobs').update({ is_open: !j.is_open, updated_at: new Date().toISOString() }).eq('id', j.id);
        if (error) { setBusy(b, false); return toast(errText(error), true); }
        toast(j.is_open ? 'Job closed. It is hidden from the website.' : 'Job reopened.');
        return load();
      }
      if ((b = t('[data-jdel]'))) {
        if (!(await confirmBox('Delete this job?', 'The job and all its applications will be deleted. To just hide it, use Close job instead.', 'Delete', 'Keep it'))) return;
        const { error } = await sb.from('jobs').delete().eq('id', b.dataset.jdel);
        if (error) return toast(errText(error), true);
        toast('Job deleted.');
        return load();
      }
      if ((b = t('[data-aset]'))) {
        setBusy(b, true, '...');
        const { error } = await sb.from('job_applications').update({ status: b.dataset.aset }).eq('id', b.dataset.id);
        if (error) { setBusy(b, false); return toast(errText(error), true); }
        toast('Updated.');
        return load();
      }
    });
  },
  async resources(p) {
    const ROLE = { teacher: 'Teacher', school: 'School / academy', parent: 'Parent', student: 'Student', other: 'Other' };
    let rows = [], tab = 'new';
    p.innerHTML = `<p class="muted">People who tapped "I'm interested" on the Resources (Paid) page. Contact them when packs are ready.</p><div id="rsum" class="row wrap" style="gap:8px;margin:6px 0 10px"></div>
      <div class="seg" id="rtabs" style="margin:8px 0 14px"></div><div id="rlist"><div class="spin"></div></div>`;
    const draw = () => {
      const count = {};
      rows.forEach((r) => r.interests.forEach((i) => { count[i] = (count[i] || 0) + 1; }));
      $('#rsum', p).innerHTML = Object.keys(count).sort((a, b) => count[b] - count[a]).map((k) => `<span class="pill">${esc(k)}: <b>${count[k]}</b></span>`).join('');
      const nNew = rows.filter((r) => !r.handled).length;
      $('#rtabs', p).innerHTML = `<button data-rtab="new" class="${tab === 'new' ? 'on' : ''}">To contact ${nNew}</button><button data-rtab="done" class="${tab === 'done' ? 'on' : ''}">Contacted ${rows.length - nNew}</button>`;
      const list = rows.filter((r) => (tab === 'new' ? !r.handled : r.handled));
      $('#rlist', p).innerHTML = list.length ? `<div class="tgrid">${list.map((r) => `<div class="card">
        <div class="row"><b class="grow" style="font-size:17px">${esc(r.full_name)}</b><span class="pill">${ROLE[r.role] || r.role}</span></div>
        <div class="small muted">${fmtTime(r.created_at)}</div>
        <div class="tc-line"><i>📞</i><span><a href="tel:${esc(r.phone.replace(/[^0-9+]/g, ''))}">${esc(r.phone)}</a> · <a href="https://wa.me/${toIntl(r.phone)}" target="_blank" rel="noopener">WhatsApp</a></span></div>
        ${r.email ? `<div class="tc-line"><i>✉️</i><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></div>` : ''}
        <div class="pills" style="margin-top:6px">${r.interests.map((i) => `<span class="pill lime">${esc(i)}</span>`).join('')}</div>
        ${r.message ? `<div class="small" style="margin-top:6px"><b>Note:</b> ${esc(r.message)}</div>` : ''}
        <div class="row wrap" style="margin-top:10px"><button class="btn ${r.handled ? 'out' : ''} sm" data-rdone="${r.id}" data-v="${r.handled ? '0' : '1'}">${r.handled ? 'Move back to “To contact”' : '✓ Mark as contacted'}</button><button class="btn out sm" data-rdel="${r.id}">Delete</button></div></div>`).join('')}</div>`
        : '<div class="empty"><b>📚</b><span class="muted">Nothing here yet.</span></div>';
    };
    const load = async () => {
      const { data, error } = await sb.from('resource_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      rows = data || []; draw();
    };
    await load();
    p.addEventListener('click', async (e) => {
      let b;
      if ((b = e.target.closest('[data-rtab]'))) { tab = b.dataset.rtab; return draw(); }
      if ((b = e.target.closest('[data-rdone]'))) {
        setBusy(b, true, '...');
        const { error } = await sb.from('resource_requests').update({ handled: b.dataset.v === '1' }).eq('id', b.dataset.rdone);
        if (error) { setBusy(b, false); return toast(errText(error), true); }
        return load();
      }
      if ((b = e.target.closest('[data-rdel]'))) {
        if (!(await confirmBox('Delete this request?', 'This cannot be undone.', 'Delete', 'Keep it'))) return;
        const { error } = await sb.from('resource_requests').delete().eq('id', b.dataset.rdel);
        if (error) return toast(errText(error), true);
        return load();
      }
    });
  },
};

/* Admin login at tutobridge.com/admin (→ /app/#/admin) */
ROUTES.admin = () => {
  if (S.profile?.role === 'admin') return renderAdmin();
  if (S.session) {
    return view(`<div class="narrow center" style="padding:40px 0"><div style="font-size:48px">🔒</div><h1>Admins only</h1>
      <p class="muted">You're logged in as <b>${esc(S.profile?.full_name || '')}</b>, which is not an admin account.</p>
      <button class="btn" data-a="signout-now">Log out and use an admin account</button> <a class="btn out" href="#/home">Back to the app</a></div>`);
  }
  const a = view(`<div class="narrow" style="padding-top:30px"><div style="font-size:44px">🛡️</div><h1>Admin login</h1><p class="muted">Tutobridge staff only.</p>
    <form id="f" novalidate style="margin-top:16px">
      <label class="f"><span>Email</span><input class="inp" name="email" type="email" autocomplete="username"></label>
      <label class="f"><span>Password</span><input class="inp" name="password" type="password" autocomplete="current-password"></label>
      <button class="btn full" id="go">Log in to admin panel</button></form></div>`);
  $('#f', a).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim();
    if (!isEmail(email) || !f.password.value) return toast('Enter your email and password.', true);
    const b = $('#go', a); setBusy(b, true, 'Logging in...');
    const { error } = await sb.auth.signInWithPassword({ email, password: f.password.value });
    setBusy(b, false);
    if (error) return toast(errText(error), true);
  };
};

async function adminTeachers(a) {
  let tab = 'pending';
  a.innerHTML = `<p class="muted">Verify teachers so parents can find them, and mark Star Teachers.</p>
    <div class="seg" id="tabs" style="margin:8px 0 14px"></div><div id="list"><div class="spin"></div></div>`;
  let rows = [];
  const draw = () => {
    const n = (s) => rows.filter((r) => r.verification_status === s).length;
    $('#tabs', a).innerHTML = ['pending', 'verified', 'rejected'].map((s) => `<button data-tab="${s}" class="${tab === s ? 'on' : ''}">${s[0].toUpperCase() + s.slice(1)} ${n(s)}</button>`).join('');
    const shown = rows.filter((r) => r.verification_status === tab);
    $('#list', a).innerHTML = shown.length ? `<div class="tgrid">${shown.map((t) => `<div class="card ${t.is_star_teacher ? 'star' : ''}">
      <div class="row">${avatar(t.profiles?.full_name, t.profiles?.avatar_url, 52)}<div class="grow"><b>${esc(t.profiles?.full_name)}</b><div class="small muted">${esc(t.years_experience)} yrs · updated ${fmtTime(t.updated_at)}</div></div></div>
      <div class="tc-line"><i>🏅</i><span>${esc((t.qualifications || []).join('; '))}</span></div>
      <div class="tc-line"><i>📚</i><span>${esc((t.subjects || []).join(', '))} · ${esc((t.curricula || []).join(', '))}</span></div>
      <div class="tc-line"><i>📍</i><span>${esc((t.neighborhoods || []).join(', '))}</span></div>
      ${t.bio_description ? `<div class="tc-line"><i>💬</i><span>${esc(t.bio_description)}</span></div>` : ''}
      <div class="tc-line"><i>🪪</i><span>CNIC: ${t.v.cnic_number ? `<b>${esc(t.v.cnic_number)}</b>` : '<span class="muted">not given</span>'}</span></div>
      <div class="row wrap" style="margin-top:10px">${t.cnic_doc_url ? `<button class="btn out sm" data-doc="${esc(t.cnic_doc_url)}">🪪 CNIC</button>` : '<span class="pill">No CNIC</span>'}
        ${t.v.cnic_back_doc_url ? `<button class="btn out sm" data-doc="${esc(t.v.cnic_back_doc_url)}">🪪 CNIC back</button>` : '<span class="pill">No CNIC back</span>'}
        ${t.degree_doc_url ? `<button class="btn out sm" data-doc="${esc(t.degree_doc_url)}">🎓 Degree</button>` : '<span class="pill">No degree</span>'}
        ${(t.v.other_doc_urls || []).map((d, i) => `<button class="btn out sm" data-doc="${esc(d)}">📄 Document ${i + 1}</button>`).join('')}</div>
      <div class="row wrap" style="margin-top:10px">${t.verification_status !== 'verified' ? `<button class="btn sm" data-set="verified" data-id="${t.id}">✓ Verify</button>` : ''}
        ${t.verification_status !== 'rejected' ? `<button class="btn out sm" data-set="rejected" data-id="${t.id}">Reject</button>` : ''}
        ${t.verification_status === 'verified' ? `<button class="btn out sm" data-star="${t.is_star_teacher ? 0 : 1}" data-id="${t.id}">${t.is_star_teacher ? 'Remove ★' : '★ Make Star'}</button>` : ''}</div></div>`).join('')}</div>`
      : '<div class="empty"><b>🎉</b><span class="muted">Nothing here.</span></div>';
  };
  const load = async () => {
    const { data, error } = await sb.from('teacher_profiles').select('*, profiles!inner(full_name, avatar_url)').order('updated_at', { ascending: false });
    if (error) { $('#list', a).innerHTML = `<p>${esc(errText(error))}</p>`; return; }
    const ver = await sb.from('teacher_verification').select('*');
    const byId = Object.fromEntries((ver.data || []).map((x) => [x.id, x]));
    rows = (data || []).map((r) => ({ ...r, v: byId[r.id] || {} }));
    draw();
  };
  await load();
  a.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; draw(); return; }
    const d = e.target.closest('[data-doc]');
    if (d) {
      const w = window.open('', '_blank');
      const { data, error } = await sb.storage.from('teacher_documents').createSignedUrl(d.dataset.doc, 600);
      if (error) { w?.close(); return toast(errText(error), true); }
      if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
      return;
    }
    const s = e.target.closest('[data-set]'), st = e.target.closest('[data-star]');
    if (s || st) {
      const btn = s || st;
      setBusy(btn, true, '...');
      const patch = s ? { verification_status: s.dataset.set } : { is_star_teacher: st.dataset.star === '1' };
      const { error } = await sb.from('teacher_profiles').update(patch).eq('id', btn.dataset.id);
      if (error) { setBusy(btn, false); return toast(errText(error), true); }
      toast('Saved.');
      load();
    }
  });
}
