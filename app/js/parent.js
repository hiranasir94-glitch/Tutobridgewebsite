'use strict';
/* Parent side: search board, filters, map, featured online teachers, teacher details, booking, tuition requests. */

const LAHORE = [31.5204, 74.3587];

/* ------------------------------------------------------------------ map helper (Leaflet + OpenStreetMap) */
function makeMap(el, center) {
  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView(center || LAHORE, center ? 13 : 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
  setTimeout(() => map.invalidateSize(), 150);
  return map;
}
function pin(kind, emoji) {
  return L.divIcon({ className: '', html: `<div class="mpin ${kind}"><span>${emoji}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
}
function fitTo(map, points, me) {
  const all = points.slice();
  if (me) all.push(me);
  if (all.length > 1) map.fitBounds(all, { padding: [30, 30], maxZoom: 14 });
  else if (all.length === 1) map.setView(all[0], 13);
}

/* ------------------------------------------------------------------ sample teachers (shown only while none are verified) */
const SAMPLES = [
  { id: 's1', name: 'Ayesha Malik', subjects: ['Mathematics', 'Physics'], curricula: ['O Levels', 'A Levels'], qualifications: ['MPhil Physics - GCU Lahore'], years_experience: 8, neighborhoods: ['DHA', 'Cantt'], teaching_modes: ['online', 'private_home'], available_at_student_home: true, rate_type: 'per_month', rate_amount: 25000, is_star_teacher: true, rating_avg: 4.9, reviews_count: 38, is_immediately_available: true, expertise_categories: ['high_school', 'higher_secondary'], bio_description: 'Patient, exam-focused teaching with weekly progress notes for parents.' },
  { id: 's2', name: 'Usman Tariq', subjects: ['English', 'Urdu'], curricula: ['Primary', 'Matric/FSc'], qualifications: ['MA English - Punjab University'], years_experience: 5, neighborhoods: ['Johar Town', 'Wapda Town'], teaching_modes: ['home_academy'], available_at_teacher_home: true, rate_type: 'per_month', rate_amount: 12000, rating_avg: 4.6, reviews_count: 14, expertise_categories: ['primary', 'middle_school'], bio_description: 'Small-group reading and writing classes at my academy.' },
  { id: 's3', name: 'Hira Shah', subjects: ['Science', 'Biology', 'Chemistry'], curricula: ['IB', 'O Levels'], qualifications: ['BS Biochemistry - LUMS'], years_experience: 4, neighborhoods: ['Gulberg', 'Model Town'], teaching_modes: ['online', 'private_home'], available_at_student_home: true, rate_type: 'per_day', rate_amount: 2500, rating_avg: 4.8, reviews_count: 21, is_immediately_available: true, expertise_categories: ['high_school', 'university_test_prep'], bio_description: 'MDCAT and IB Biology prep with past-paper practice.' },
  { id: 's4', name: 'Qari Bilal Ahmed', subjects: ['Islamiat'], curricula: ['Primary'], qualifications: ['Hifz & Tajweed - Jamia Naeemia'], years_experience: 12, neighborhoods: ['Jubilee Town', 'Bahria Town'], teaching_modes: ['online', 'private_home'], available_at_student_home: true, rate_type: 'per_month', rate_amount: 8000, rating_avg: 5, reviews_count: 52, expertise_categories: ['quran_nazra'], bio_description: 'Nazra and Tajweed for children, gentle and consistent.' },
].map((t) => ({ ...t, sample: true, profiles: { full_name: t.name, avatar_url: null } }));

/* ------------------------------------------------------------------ teacher card */
function modesOf(t) {
  const m = [];
  if (t.available_at_school) m.push('At School');
  for (const tm of TEACH_MODES) if ((t.teaching_modes || []).includes(tm.db)) m.push(tm.badge);
  return m;
}
function feeLine(t) {
  if (t.rate_amount && t.rate_type) return `${pkr(t.rate_amount)} / ${RATE_TYPES[t.rate_type]?.unit || 'month'}`;
  if (t.available_at_school && t.estimated_monthly_salary) return `School post: ${pkr(t.estimated_monthly_salary)} / month expected`;
  return '';
}
function badges(t) {
  return [
    t.is_star_teacher ? '<span class="pill ink">★ Star Teacher</span>' : '',
    t.sample ? '<span class="pill out">Sample</span>' : '<span class="pill lime">✓ Verified</span>',
    t.is_immediately_available ? '<span class="pill out">● Available now</span>' : '',
  ].join('');
}
function teacherCard(t, i = 0) {
  const name = t.profiles?.full_name || 'Teacher';
  const rating = t.reviews_count ? `★ ${Number(t.rating_avg).toFixed(1)} (${t.reviews_count})` : 'New teacher';
  const dist = t.distance_km != null ? ` · ${Number(t.distance_km)} km away` : '';
  const fee = feeLine(t);
  return `<article class="card ${t.is_star_teacher ? 'star' : ''} st" style="--i:${Math.min(i, 8)}">
    <div class="tc-top">${avatar(name, t.profiles?.avatar_url, 58)}
      <div class="grow"><p class="tc-name">${esc(name)}</p><div class="tc-meta">${esc(rating)}${esc(dist)} · ${esc(t.years_experience || 0)} yrs experience</div>
      <div class="pills" style="margin-top:7px">${badges(t)}</div></div></div>
    <div class="tc-line"><i>📚</i><span>${esc((t.subjects || []).join(', '))}</span></div>
    <div class="tc-line"><i>🎓</i><span>${esc((t.curricula || []).join(', '))}</span></div>
    ${(t.qualifications || []).length ? `<div class="tc-line"><i>🏅</i><span>${esc(t.qualifications[0])}${t.qualifications.length > 1 ? ` +${t.qualifications.length - 1} more` : ''}</span></div>` : ''}
    <div class="tc-line"><i>📍</i><span>Covers ${esc((t.neighborhoods || []).join(', '))}</span></div>
    <div class="pills" style="margin-top:9px">${modesOf(t).map((m) => `<span class="pill out">${esc(m)}</span>`).join('')}</div>
    ${fee ? `<div class="fee">${esc(fee)}</div>` : ''}
    <div class="tc-actions"><button class="btn out sm" data-t="view" data-id="${esc(t.id)}">Profile</button>
      <button class="btn out sm" data-t="connect" data-id="${esc(t.id)}">💬 Connect</button>
      <button class="btn sm" data-t="book" data-id="${esc(t.id)}">Book a Trial</button></div>
  </article>`;
}

/* ------------------------------------------------------------------ search board */
const PF = { modes: new Set(), cats: new Set(), school: false, now: false, q: '' };
const pfAny = () => PF.modes.size || PF.cats.size || PF.school || PF.now;
let BOARD = { list: [], byId: {}, featured: [], sample: false };

async function loadBoard() {
  let q = sb.from('teacher_profiles').select('*, profiles!inner(full_name, avatar_url)').eq('verification_status', 'verified').eq('is_accepting_students', true);
  if (PF.now) q = q.eq('is_immediately_available', true);
  if (PF.cats.size) q = q.overlaps('expertise_categories', [...PF.cats]);
  const modes = [...PF.modes];
  if (PF.school && modes.length) q = q.or(`available_at_school.eq.true,teaching_modes.ov.{${modes.join(',')}}`);
  else if (PF.school) q = q.eq('available_at_school', true);
  else if (modes.length) q = q.overlaps('teaching_modes', modes);
  const { data, error } = await q.order('is_immediately_available', { ascending: false }).order('is_star_teacher', { ascending: false }).order('rating_avg', { ascending: false });
  if (error) throw error;
  // Distances come from the database, rounded, so teachers' exact positions never reach the browser.
  const km = {};
  const d = await sb.rpc('nearby_teacher_distances');
  if (!d.error) for (const r of d.data || []) km[r.teacher_id] = Number(r.distance_km);
  const list = (data || []).map((t) => ({ ...t, distance_km: km[t.id] ?? null }));
  if (Object.keys(km).length) list.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
  return list;
}
async function loadFeatured() {
  const { data } = await sb.from('teacher_profiles').select('*, profiles!inner(full_name, avatar_url)').eq('verification_status', 'verified').eq('is_accepting_students', true)
    .overlaps('teaching_modes', ['online']).order('is_immediately_available', { ascending: false }).order('rating_avg', { ascending: false }).limit(12);
  return data || [];
}
function textFilter(list) {
  const words = PF.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((t) => {
    const hay = [t.profiles?.full_name, ...(t.subjects || []), ...(t.curricula || []), ...(t.neighborhoods || []), ...(t.qualifications || []),
      ...(t.expertise_categories || []).map((s) => EXPERTISE.find((x) => x.slug === s)?.label || '')].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

function renderParentHome() {
  const p = S.profile;
  const where = p.current_location_label || p.city || 'Lahore';
  const a = view(`
    <div class="row st"><div class="grow"><h1>Salam, ${esc(firstName(p.full_name))} 👋</h1><div class="muted" style="font-weight:700">📍 Teachers near ${esc(where)}</div></div></div>
    <section class="card st" style="--i:1;margin-top:14px">
      <div class="row wrap" style="margin-bottom:10px"><b class="grow">Teachers &amp; tuition centers near you</b><button class="btn out sm" data-p="post">📌 Post a request</button></div>
      <div id="pmap" class="map"></div><div class="small muted" style="margin-top:6px">Locations shown are approximate.</div>
    </section>
    <input class="inp st" style="--i:2" id="q" placeholder="Search by subject, grade, curriculum, or teacher name..." value="${esc(PF.q)}">
    <div class="chips st" style="--i:3;margin-top:12px" id="quick">${QUICK.map((c) => `<button class="chip ${PF.cats.size === c.slugs.length && c.slugs.every((s) => PF.cats.has(s)) ? 'on' : ''}" data-quick="${c.label}">${c.icon} ${c.label}</button>`).join('')}</div>
    <div id="filters" class="st" style="--i:4"></div>
    <div id="featured"></div>
    <div id="hints"></div>
    <div class="sec" id="results-top"><h2>Teachers</h2><span class="small muted" id="count"></span></div>
    <div id="results"><div class="spin"></div></div>`);

  const drawFilters = () => {
    $('#filters', a).innerHTML = `<div class="chips" style="margin-top:4px">
      <button class="chip ${PF.now ? 'on' : ''}" data-f="now">● Available Now</button>
      ${TEACH_MODES.map((m) => `<button class="chip ${PF.modes.has(m.db) ? 'on' : ''}" data-f="mode" data-v="${m.db}">${m.label}</button>`).join('')}
      <button class="chip ${PF.school ? 'on' : ''}" data-f="school">At School</button></div>
      <div class="small muted" style="font-weight:800;margin:6px 0 4px">Grade level / specialty</div>
      <div class="chips">${EXPERTISE.map((c) => `<button class="chip ${PF.cats.has(c.slug) ? 'on' : ''}" data-f="cat" data-v="${c.slug}" title="${esc(c.hint || c.label)}">${c.short}</button>`).join('')}</div>
      ${pfAny() ? '<button class="link" data-f="clear">✕ Clear filters</button>' : ''}`;
    $$('#quick .chip', a).forEach((b) => { const c = QUICK.find((x) => x.label === b.dataset.quick); b.classList.toggle('on', PF.cats.size === c.slugs.length && c.slugs.every((s) => PF.cats.has(s))); });
  };
  const drawResults = () => {
    const shown = textFilter(BOARD.list);
    $('#count', a).textContent = BOARD.sample ? 'Sample profiles' : `${shown.length} found`;
    $('#results', a).innerHTML = shown.length
      ? `<div class="tgrid">${shown.map(teacherCard).join('')}</div>`
      : `<div class="empty"><b>✏️ No teachers match yet</b><span class="muted">${pfAny() ? 'Try removing a filter.' : 'Try another subject or area.'}</span></div>`;
  };
  const drawFeatured = () => {
    const list = BOARD.sample ? SAMPLES.filter((t) => t.teaching_modes.includes('online')) : BOARD.featured;
    $('#featured', a).innerHTML = (!pfAny() && list.length) ? `<div class="sec"><h3>💻 Featured online teachers</h3><button class="link" data-p="seeonline">See all</button></div>
      <div class="carousel">${list.map((t) => `<div class="card ${t.is_star_teacher ? 'star' : ''}"><div class="row">${avatar(t.profiles?.full_name, t.profiles?.avatar_url, 44)}<div class="grow"><b>${esc(t.profiles?.full_name)}</b>
        <div class="small muted">${esc((t.subjects || []).slice(0, 2).join(', '))}</div></div></div>
        <div class="pills" style="margin:8px 0">${t.is_immediately_available ? '<span class="pill lime">● Available now</span>' : ''}${t.reviews_count ? `<span class="pill">★ ${Number(t.rating_avg).toFixed(1)}</span>` : ''}</div>
        <button class="btn sm full" data-t="connect" data-id="${esc(t.id)}">💬 Connect</button></div>`).join('')}</div>` : '';
  };
  const reload = async (scroll) => {
    $('#results', a).innerHTML = '<div class="spin"></div>';
    try {
      const real = await loadBoard();
      BOARD.sample = !real.length && !pfAny();
      BOARD.list = BOARD.sample ? SAMPLES : real;
      BOARD.byId = Object.fromEntries([...BOARD.list, ...BOARD.featured, ...SAMPLES].map((t) => [t.id, t]));
      const hasDist = real.some((t) => t.distance_km != null);
      $('#hints', a).innerHTML = BOARD.sample
        ? '<div class="hint">ℹ️ No verified teachers yet. These are sample profiles so you can see how the board will look.</div>'
        : (!hasDist && real.length ? '<div class="hint">📍 Save your current location in Account › Address to see teachers sorted by distance.</div>' : '');
      drawFeatured();
      drawResults();
      if (scroll) $('#results-top', a).scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      $('#results', a).innerHTML = `<p>${esc(errText(e))}</p>`;
    }
  };

  drawFilters();
  loadFeatured().then((f) => { BOARD.featured = f; f.forEach((t) => (BOARD.byId[t.id] = t)); drawFeatured(); });
  reload(false);
  drawParentMap($('#pmap', a));

  $('#q', a).addEventListener('input', (e) => { PF.q = e.target.value; drawResults(); });
  a.addEventListener('click', (e) => {
    const quick = e.target.closest('[data-quick]');
    if (quick) {
      const c = QUICK.find((x) => x.label === quick.dataset.quick);
      const on = PF.cats.size === c.slugs.length && c.slugs.every((s) => PF.cats.has(s));
      PF.cats = new Set(on ? [] : c.slugs);
      drawFilters(); reload(!on); return;
    }
    const f = e.target.closest('[data-f]');
    if (f) {
      const k = f.dataset.f, v = f.dataset.v;
      if (k === 'now') PF.now = !PF.now;
      else if (k === 'school') PF.school = !PF.school;
      else if (k === 'mode') PF.modes.has(v) ? PF.modes.delete(v) : PF.modes.add(v);
      else if (k === 'cat') PF.cats.has(v) ? PF.cats.delete(v) : PF.cats.add(v);
      else if (k === 'clear') { PF.modes.clear(); PF.cats.clear(); PF.school = false; PF.now = false; }
      drawFilters(); reload(false); return;
    }
    const pp = e.target.closest('[data-p]');
    if (pp?.dataset.p === 'post') openRequestSheet();
    if (pp?.dataset.p === 'seeonline') { PF.modes = new Set(['online']); drawFilters(); reload(true); }
  });
}

/* teacher actions (cards, carousel, map popups, detail sheet) */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  const t = BOARD.byId[b.dataset.id];
  if (!t) return;
  if (b.dataset.t === 'view') openTeacherSheet(t);
  if (b.dataset.t === 'connect') connectTo(t, b);
  if (b.dataset.t === 'book') openBookingSheet(t);
});
const SAMPLE_MSG = 'This is a sample profile. Real teachers will appear here once they are verified.';
async function connectTo(t, btn) {
  if (t.sample) return toast(SAMPLE_MSG);
  setBusy(btn, true, 'Opening...');
  const { data, error } = await sb.rpc('start_conversation', { p_teacher_id: t.id });
  setBusy(btn, false);
  if (error) return toast(errText(error), true);
  closeOverlay();
  go('#/chat/' + data);
}

function openTeacherSheet(t) {
  const name = t.profiles?.full_name || 'Teacher';
  const exp = (t.expertise_categories || []).map((s) => EXPERTISE.find((x) => x.slug === s)?.short).filter(Boolean);
  openSheet(`<div class="row" style="padding-right:40px">${avatar(name, t.profiles?.avatar_url, 72)}<div class="grow"><h2>${esc(name)}</h2>
      <div class="muted small">${t.reviews_count ? `★ ${Number(t.rating_avg).toFixed(1)} from ${t.reviews_count} reviews` : 'New teacher'} · ${esc(t.years_experience || 0)} yrs experience${t.distance_km != null ? ` · ${t.distance_km} km away` : ''}</div>
      <div class="pills" style="margin-top:6px">${badges(t)}</div></div></div>
    ${t.bio_description ? `<h3>About</h3><p style="line-height:1.55;margin:0">${esc(t.bio_description)}</p>` : ''}
    <h3>Qualifications</h3>${(t.qualifications || []).map((q) => `<div class="tc-line"><i>🏅</i><span>${esc(q)}</span></div>`).join('') || '<span class="muted">Not listed</span>'}
    <h3>Teaches</h3><div class="pills">${(t.subjects || []).map((s) => `<span class="pill">${esc(s)}</span>`).join('')}</div>
    <div class="pills" style="margin-top:6px">${(t.curricula || []).map((s) => `<span class="pill out">${esc(s)}</span>`).join('')}</div>
    ${exp.length ? `<h3>Levels &amp; specialties</h3><div class="pills">${exp.map((s) => `<span class="pill out">${esc(s)}</span>`).join('')}</div>` : ''}
    <h3>Where &amp; fees</h3><div class="pills">${modesOf(t).map((m) => `<span class="pill out">${esc(m)}</span>`).join('')}</div>
    ${feeLine(t) ? `<div class="fee">${esc(feeLine(t))}</div>` : ''}
    <div class="tc-line"><i>📍</i><span>Covers ${esc((t.neighborhoods || []).join(', '))}</span></div>
    <div class="row" style="margin-top:18px"><button class="btn out grow" data-t="connect" data-id="${esc(t.id)}">💬 Connect</button><button class="btn grow" data-t="book" data-id="${esc(t.id)}">Book a Trial</button></div>
    <p class="small muted">Connect opens a private chat. Book a Trial sends a formal request; your phone number and address are shared only if the teacher accepts.</p>`);
}

function openBookingSheet(t) {
  if (t.sample) return toast(SAMPLE_MSG);
  const name = t.profiles?.full_name || 'Teacher';
  const modes = [t.available_at_school && 'at_school', t.available_at_student_home && 'at_student_home', t.available_at_teacher_home && 'at_teacher_home', (t.teaching_modes || []).includes('online') && 'online'].filter(Boolean);
  const sh = openSheet(`<h2 style="padding-right:40px">Request ${esc(name)}</h2><p class="muted small">Send a trial lesson request. ${esc(firstName(name))} can accept or decline.</p>
    <form id="bk" novalidate style="margin-top:14px">
      <label class="f"><span>Student's grade</span><input class="inp" name="grade" placeholder="e.g. Grade 8 or O Levels"></label>
      <label class="f"><span>Subject</span><select class="inp" name="subject"><option value="">Choose a subject</option>${(t.subjects || []).map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
      <label class="f"><span>Where</span><select class="inp" name="mode">${modes.map((m) => `<option value="${m}">${BOOKING_MODES[m].label}</option>`).join('')}</select></label>
      <label class="f"><span>Your neighbourhood</span><select class="inp" name="hood"><option value="">Choose (optional)</option>${(t.neighborhoods || []).map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>
      <label class="f"><span>Preferred days and time</span><input class="inp" name="schedule" placeholder="e.g. Mon and Wed, 5 pm"></label>
      <label class="f"><span>Notes (optional)</span><textarea class="inp" name="notes" maxlength="500"></textarea></label>
      <button class="btn full" id="send">Send request</button></form>`);
  $('#bk', sh).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const checks = [[f.grade, f.grade.value.trim() ? '' : 'Enter the grade'], [f.subject, f.subject.value ? '' : 'Choose a subject'], [f.schedule, f.schedule.value.trim() ? '' : 'Suggest a schedule']];
    checks.forEach(([i, m]) => fieldError(i, m));
    if (checks.some(([, m]) => m)) return;
    const b = $('#send', sh);
    setBusy(b, true, 'Sending...');
    const { error } = await sb.from('bookings').insert({
      parent_id: S.profile.id, teacher_id: t.id, student_grade: f.grade.value.trim(), subject: f.subject.value, teaching_mode: f.mode.value,
      neighborhood: f.hood.value || null, proposed_schedule: f.schedule.value.trim(), notes: f.notes.value.trim() || null,
    });
    setBusy(b, false);
    if (error) return toast(errText(error), true);
    closeOverlay();
    toast(`Request sent to ${name}. You will be contacted once they accept.`);
  };
}

async function openRequestSheet() {
  const hasLoc = S.profile.current_lat != null;
  const sh = openSheet(`<h2 style="padding-right:40px">Post a tuition request</h2>
    <p class="muted small">Nearby teachers see your first name, the subject and your approximate area. Your address and phone number stay private.</p>
    ${hasLoc ? '' : '<div class="hint">📍 Save your current location in Account › Address so teachers can see your request on their map.</div>'}
    <h3>Subject</h3>${chipGroup('subj', SUBJECTS, [], { single: true })}
    <h3>Curriculum (optional)</h3>${chipGroup('curr', CURRICULA, [], { single: true })}
    <label class="f" style="margin-top:14px"><span>Class / grade (optional)</span><input class="inp" name="grade" maxlength="60" placeholder="e.g. Grade 9"></label>
    <label class="f"><span>Note (optional)</span><textarea class="inp" name="note" maxlength="300" placeholder="Preferred timing, mode, anything else"></textarea></label>
    <button class="btn full" id="post">Post request</button>
    <div id="open"></div>`);
  const drawOpen = async () => {
    const { data } = await sb.from('tuition_requests').select('id, subject, grade, created_at').eq('status', 'open').order('created_at', { ascending: false });
    $('#open', sh).innerHTML = (data || []).length ? `<h3>Your open requests</h3>${data.map((r) => `<div class="row" style="padding:8px 0;border-bottom:1.5px solid var(--line)"><span class="grow"><b>${esc(r.subject)}</b>${r.grade ? ` · ${esc(r.grade)}` : ''}<br><span class="small muted">Posted ${fmtTime(r.created_at)}</span></span><button class="btn out sm" data-close-req="${r.id}">Close</button></div>`).join('')}` : '';
  };
  drawOpen();
  sh.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-close-req]');
    if (!c) return;
    setBusy(c, true, '...');
    const { error } = await sb.from('tuition_requests').update({ status: 'closed' }).eq('id', c.dataset.closeReq);
    if (error) { setBusy(c, false); return toast(errText(error), true); }
    drawOpen();
  });
  $('#post', sh).onclick = async () => {
    const subject = readChips(sh, 'subj')[0];
    if (!subject) return toast('Choose a subject first.', true);
    const b = $('#post', sh);
    setBusy(b, true, 'Posting...');
    const { error } = await sb.from('tuition_requests').insert({
      parent_id: S.profile.id, subject, curriculum: readChips(sh, 'curr')[0] || null,
      grade: $('[name=grade]', sh).value.trim() || null, note: $('[name=note]', sh).value.trim() || null,
    });
    setBusy(b, false);
    if (error) return toast(/row-level security/i.test(error.message) ? 'You can have up to 3 open requests. Close one first.' : errText(error), true);
    closeOverlay();
    toast('Request posted. Teachers nearby can now see it.');
  };
}

async function drawParentMap(el) {
  const p = S.profile;
  const me = p.current_lat != null ? [p.current_lat, p.current_lng] : null;
  const map = makeMap(el, me);
  if (me) L.marker(me, { icon: pin('me', '•') }).addTo(map).bindPopup('<b>You</b>');
  const { data, error } = await sb.rpc('map_teachers');
  if (error) return;
  const pts = [];
  for (const r of data || []) {
    if (r.lat == null) continue;
    const ll = [Number(r.lat), Number(r.lng)];
    pts.push(ll);
    BOARD.byId[r.teacher_id] = BOARD.byId[r.teacher_id] || { id: r.teacher_id, profiles: { full_name: r.name }, subjects: r.subjects, curricula: r.curricula, is_star_teacher: r.is_star, rating_avg: r.rating };
    L.marker(ll, { icon: pin('', r.kind === 'centre' ? '🏫' : r.is_star ? '★' : '🎓') }).addTo(map).bindPopup(
      `<b>${esc(r.name)}</b>${r.is_star ? ' ★' : ''}<br><span class="small">${r.kind === 'centre' ? 'Tuition center / home academy' : 'Teacher'}${r.distance_km != null ? ` · ${r.distance_km} km` : ''}</span>
       <br><span class="small">${esc((r.subjects || []).join(', '))}</span><br><span class="small muted">Location shown is approximate.</span>
       <button class="btn" data-t="connect" data-id="${esc(r.teacher_id)}">💬 Connect</button>`);
  }
  fitTo(map, pts, me);
}

ROUTES.home = () => {
  const r = S.profile.role;
  if (r === 'teacher') return renderTeacherDashboard();
  if (r === 'admin') return renderAdmin();
  return renderParentHome();
};
