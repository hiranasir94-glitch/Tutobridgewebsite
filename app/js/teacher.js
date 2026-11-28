'use strict';
/* Teacher side: 4-step profile setup / edit, dashboard, booking requests, requests map. */

/* ------------------------------------------------------------------ onboarding / edit profile */
async function renderOnboarding(isEdit) {
  const p = S.profile;
  const t = S.teacher || {};
  const vr = await sb.from('teacher_verification').select('*').eq('id', p.id).maybeSingle();
  const v = vr.data || {};
  const others = [...(v.other_doc_urls || [])];
  const has = (m) => (t.teaching_modes || []).includes(m);
  const st = {
    step: 0,
    online: has('online'), academy: !!t.available_at_teacher_home, home: !!t.available_at_student_home, school: !!t.available_at_school,
    now: !!t.is_immediately_available, rateType: t.rate_type || 'per_month',
    avatar: null, cnic: null, cnicBack: null, degree: null, extra: [],
  };
  const degrees = (t.qualifications || []).map((q) => { const i = q.indexOf(' - '); return i < 0 ? [q, ''] : [q.slice(0, i), q.slice(i + 3)]; });
  if (!degrees.length) degrees.push(['', '']);
  const TITLES = ['About you', 'Qualifications', 'Teaching & fees', 'Verification'];
  const fmt = (v) => (v == null ? '' : Math.round(v));

  const a = view(`<div class="mid">
    ${isEdit ? '<button class="back" data-a="go" data-v="#/home">← Back to dashboard</button>' : ''}
    <h1>${isEdit ? 'Edit profile &amp; rates' : 'Set up your profile'}</h1>
    <div class="muted" id="stepname"></div><div class="steps" id="steps"></div>
    <form id="ob" novalidate>
      <section data-step="0">
        <div class="photo"><div id="avprev">${avatar(p.full_name, p.avatar_url, 96)}</div>
          <label class="btn out sm" style="cursor:pointer">📷 ${p.avatar_url ? 'Change photo' : 'Add a friendly photo'}<input type="file" accept="image/jpeg,image/png,image/webp" id="avfile" hidden></label></div>
        <label class="f"><span>Full name</span><input class="inp" name="name" value="${esc(p.full_name)}"></label>
        <label class="f"><span>Phone / WhatsApp number</span><input class="inp" name="phone" type="tel" placeholder="03XX XXXXXXX" value="${esc(p.phone_number || '')}"><div class="help">Shared with a parent only after you accept their request</div></label>
        <label class="f"><span>Current Address</span><textarea class="inp" name="address" maxlength="300" placeholder="House, street, area, city">${esc(p.address || '')}</textarea><div class="help">Never shown to parents before you accept a request</div></label>
        ${locationField('loc', { value: p.current_location_label || '', lat: p.current_lat, lng: p.current_lng })}
        <label class="f"><span>Years of teaching experience</span><input class="inp" name="years" type="number" min="0" max="60" value="${esc(t.years_experience ?? '')}"></label>
        <label class="f"><span>About me &amp; teaching style</span><textarea class="inp" name="bio" maxlength="600" placeholder="How you teach, results you're proud of, what students can expect">${esc(t.bio_description || '')}</textarea></label>
      </section>
      <section data-step="1" hidden>
        <h3>Degrees &amp; certifications</h3><div id="degrees"></div>
        <button type="button" class="link" id="adddeg">＋ Add another degree</button>
        <h3>Curricula</h3>${chipGroup('curricula', CURRICULA, t.curricula || [])}
        <h3>Subjects</h3>${chipGroup('subjects', SUBJECTS, t.subjects || [])}
        <h3>Areas of expertise</h3><p class="small muted" style="margin-top:-4px">The levels and specialties you cover. Parents filter by these.</p>
        ${chipGroup('expertise', EXPERTISE.map((e) => e.slug), t.expertise_categories || [], { labels: EXPERTISE.map((e) => e.label) })}
      </section>
      <section data-step="2" hidden>
        <h3>Where do you teach?</h3><p class="muted small" style="margin-top:-4px">Turn on at least one.</p>
        <div class="card"><div class="row"><div class="grow"><b>🏫 At School</b><div class="small muted">School hiring: full-time or part-time posts</div></div><button type="button" class="switch ${st.school ? 'on' : ''}" data-sw="school" aria-label="At School"></button></div>
          <label class="f" id="salbox" style="margin:12px 0 0" ${st.school ? '' : 'hidden'}><span>Estimated monthly salary (PKR)</span><input class="inp" name="salary" inputmode="numeric" value="${fmt(t.estimated_monthly_salary)}"></label></div>
        <div class="card"><b>Teaching mode</b><div class="small muted">Pick one or more.</div>
          <div class="chips wrap" style="margin-top:8px">${TEACH_MODES.map((m) => `<button type="button" class="chip ${st[{ online: 'online', home_academy: 'academy', private_home: 'home' }[m.db]] ? 'on' : ''}" data-mode="${m.db}">${m.label}</button>`).join('')}</div>
          <div class="small muted">Private Home Tuition means you teach at the student's home. Home Academy / Tuition Center means students come to you.</div></div>
        <div class="card"><b>Immediately available?</b><div class="small muted" style="margin-bottom:8px">Parents can filter for teachers who can start right away.</div>
          <div class="seg"><button type="button" data-now="1" class="${st.now ? 'on' : ''}">Yes</button><button type="button" data-now="0" class="${st.now ? '' : 'on'}">No</button></div></div>
        <div class="card" id="feebox"><b>Your tuition fee</b><div style="margin:8px 0 12px" class="seg">${Object.entries(RATE_TYPES).map(([k, v]) => `<button type="button" data-rt="${k}" class="${st.rateType === k ? 'on' : ''}">${v.label}</button>`).join('')}</div>
          <label class="f" style="margin:0"><span id="feelabel"></span><input class="inp" name="rate" inputmode="numeric" value="${fmt(t.rate_amount)}"></label></div>
        <label class="f"><span>Current Salary (PKR per month)</span><input class="inp" name="cursal" inputmode="numeric" value="${fmt(t.current_salary)}"><div class="help">Current or most recent salary. Leave empty if you have not worked as a teacher yet.</div></label>
        <h3>Lahore neighbourhoods you cover</h3>${chipGroup('hoods', HOODS, t.neighborhoods || [])}
      </section>
      <section data-step="3" hidden>
        <h3>Verification</h3><p class="muted small" style="margin-top:-4px">Parents only see verified teachers. Your CNIC number and documents are private to you and our verification team, and are never shown on your profile.</p>
        <label class="f"><span>CNIC number</span><input class="inp" name="cnicno" inputmode="numeric" autocomplete="off" maxlength="15" placeholder="35202-1234567-1" value="${esc(v.cnic_number || '')}"><div class="help">13 digits from your National Identity Card. Dashes are added for you.</div></label>
        <div class="upl"><span style="font-size:24px">🪪</span><div class="grow"><b>CNIC (front)</b><div class="small muted" id="cnicname">${t.cnic_doc_url ? 'Already uploaded' : 'JPG, PNG, WEBP or PDF, under 5 MB'}</div></div><label class="btn out sm" style="cursor:pointer">Choose file<input type="file" id="cnic" accept="image/jpeg,image/png,image/webp,application/pdf"  hidden></label></div>
        <div class="upl"><span style="font-size:24px">🪪</span><div class="grow"><b>CNIC (back)</b><div class="small muted" id="cnicbackname">${v.cnic_back_doc_url ? 'Already uploaded' : 'JPG, PNG, WEBP or PDF, under 5 MB'}</div></div><label class="btn out sm" style="cursor:pointer">Choose file<input type="file" id="cnicback" accept="image/jpeg,image/png,image/webp,application/pdf"  hidden></label></div>
        <div class="upl"><span style="font-size:24px">🎓</span><div class="grow"><b>Highest degree certificate</b><div class="small muted" id="degreename">${t.degree_doc_url ? 'Already uploaded' : 'JPG, PNG, WEBP or PDF, under 5 MB'}</div></div><label class="btn out sm" style="cursor:pointer">Choose file<input type="file" id="degree" accept="image/jpeg,image/png,image/webp,application/pdf"  hidden></label></div>
        <div class="upl"><span style="font-size:24px">📄</span><div class="grow"><b>Other documents <span class="muted small">(optional)</span></b><div class="small muted" id="extraname">Experience letters, teaching certificates, transcripts. Up to 5 files.</div></div><label class="btn out sm" style="cursor:pointer">Choose files<input type="file" id="extra" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden></label></div>
        <div id="extralist"></div>
        <h3>How parents will see you</h3><div id="preview"></div>
        ${isEdit ? '' : '<p class="small muted">After you submit, your status is Pending Verification until our team reviews your documents.</p>'}
      </section>
      <div id="steperr" class="hint hidden"></div>
      <div class="row" style="margin-top:18px"><button type="button" class="btn out" id="prev" style="flex:1">Back</button><button type="button" class="btn" id="next" style="flex:2">Next</button></div>
    </form></div>`);
  const f = $('#ob', a);

  const drawDegrees = () => {
    $('#degrees', a).innerHTML = degrees.map(([d, i], k) => `<div class="grid2" data-deg="${k}" style="align-items:start">
      <label class="f"><span>Degree or certificate</span><input class="inp" data-dt value="${esc(d)}" placeholder="e.g. MPhil HRM"></label>
      <label class="f"><span>Institution ${degrees.length > 1 ? `<button type="button" class="link small" data-deldeg="${k}" style="float:right">Remove</button>` : ''}</span><input class="inp" data-di value="${esc(i)}" placeholder="e.g. Kinnaird College"></label></div>`).join('');
  };
  const syncDegrees = () => $$('[data-deg]', a).forEach((row) => { degrees[+row.dataset.deg] = [$('[data-dt]', row).value, $('[data-di]', row).value]; });
  drawDegrees();
  $('#adddeg', a).onclick = () => { syncDegrees(); degrees.push(['', '']); drawDegrees(); };
  a.addEventListener('click', (e) => { const d = e.target.closest('[data-deldeg]'); if (d) { syncDegrees(); degrees.splice(+d.dataset.deldeg, 1); drawDegrees(); } });

  const needsRate = () => st.online || st.home || st.academy;
  const drawFee = () => { $('#feebox', a).hidden = !needsRate(); $('#feelabel', a).textContent = `Fee ${RATE_TYPES[st.rateType].label.toLowerCase()} (PKR)`; };
  drawFee();
  a.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-sw]');
    if (sw) { st.school = !st.school; sw.classList.toggle('on', st.school); $('#salbox', a).hidden = !st.school; }
    const m = e.target.closest('[data-mode]');
    if (m) { const k = { online: 'online', home_academy: 'academy', private_home: 'home' }[m.dataset.mode]; st[k] = !st[k]; m.classList.toggle('on', st[k]); drawFee(); }
    const n = e.target.closest('[data-now]');
    if (n) { st.now = n.dataset.now === '1'; $$('[data-now]', a).forEach((b) => b.classList.toggle('on', b === n)); }
    const r = e.target.closest('[data-rt]');
    if (r) { st.rateType = r.dataset.rt; $$('[data-rt]', a).forEach((b) => b.classList.toggle('on', b === r)); drawFee(); }
  });
  const pickFile = (input, max, onOk) => input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > max) { toast(`Choose a file under ${max / 1048576} MB.`, true); input.value = ''; return; }
    onOk(file);
  });
  pickFile($('#avfile', a), 2 * 1048576, (file) => { st.avatar = file; $('#avprev', a).innerHTML = avatar(p.full_name, URL.createObjectURL(file), 96); });
  pickFile($('#cnic', a), 5 * 1048576, (file) => { st.cnic = file; $('#cnicname', a).textContent = '✓ ' + file.name; });
  pickFile($('#degree', a), 5 * 1048576, (file) => { st.degree = file; $('#degreename', a).textContent = '✓ ' + file.name; });
  pickFile($('#cnicback', a), 5 * 1048576, (file) => { st.cnicBack = file; $('#cnicbackname', a).textContent = '✓ ' + file.name; });
  const drawExtra = () => {
    $('#extralist', a).innerHTML = [...others.map((path, i) => `<div class="row small" style="margin:4px 0"><span class="grow">📎 ${esc(path.split('/').pop())} <span class="muted">(uploaded)</span></span><button type="button" class="link small" data-delold="${i}">Remove</button></div>`),
      ...st.extra.map((file, i) => `<div class="row small" style="margin:4px 0"><span class="grow">✓ ${esc(file.name)}</span><button type="button" class="link small" data-delnew="${i}">Remove</button></div>`)].join('');
  };
  drawExtra();
  $('#extra', a).addEventListener('change', (e) => {
    for (const file of e.target.files) {
      if (others.length + st.extra.length >= 5) { toast('You can add up to 5 other documents.', true); break; }
      if (file.size > 5 * 1048576) { toast(`${file.name} is over 5 MB.`, true); continue; }
      st.extra.push(file);
    }
    e.target.value = '';
    drawExtra();
  });
  a.addEventListener('click', (e) => {
    const o = e.target.closest('[data-delold]'), n = e.target.closest('[data-delnew]');
    if (o) { others.splice(+o.dataset.delold, 1); drawExtra(); }
    if (n) { st.extra.splice(+n.dataset.delnew, 1); drawExtra(); }
  });
  // CNIC number: digits only, dashes added as 5-7-1.
  const fmtCnic = (raw) => { const d = raw.replace(/\D/g, '').slice(0, 13); return [d.slice(0, 5), d.slice(5, 12), d.slice(12)].filter(Boolean).join('-'); };
  f.cnicno.addEventListener('input', () => { f.cnicno.value = fmtCnic(f.cnicno.value); if (/^\d{5}-\d{7}-\d$/.test(f.cnicno.value)) { fieldError(f.cnicno, ''); $('#steperr', a).classList.add('hidden'); } });

  const validate = (step) => {
    let err = '';
    if (step === 0) {
      const c = [
        [f.name, f.name.value.trim().length >= 2 ? '' : 'Enter your name'],
        [f.phone, isPkMobile(f.phone.value) ? '' : 'Enter a Pakistani mobile number like 0300 1234567'],
        [f.address, f.address.value.trim().length >= 8 ? '' : 'Enter your full address'],
        [f.years, /^\d{1,2}$/.test(f.years.value.trim()) ? '' : 'Enter a number of years (0 if you are just starting)'],
      ];
      c.forEach(([i, m]) => fieldError(i, m));
      if (c.some(([, m]) => m)) err = 'Please fix the highlighted fields.';
    } else if (step === 1) {
      syncDegrees();
      let bad = false;
      $$('[data-deg]', a).forEach((row) => { const dt = $('[data-dt]', row), di = $('[data-di]', row); fieldError(dt, dt.value.trim() ? '' : 'Enter the degree'); fieldError(di, di.value.trim() ? '' : 'Enter the institution'); if (!dt.value.trim() || !di.value.trim()) bad = true; });
      if (bad) err = 'Please fix the highlighted fields.';
      else if (!readChips(a, 'curricula').length) err = 'Choose at least one curriculum.';
      else if (!readChips(a, 'subjects').length) err = 'Choose at least one subject.';
      else if (!readChips(a, 'expertise').length) err = 'Choose at least one area of expertise.';
    } else if (step === 2) {
      const okNum = (v) => { const n = num(v); return n != null && n > 0; };
      fieldError(f.salary, !st.school || okNum(f.salary.value) ? '' : 'Enter an amount in PKR');
      fieldError(f.rate, !needsRate() || okNum(f.rate.value) ? '' : 'Enter an amount in PKR');
      fieldError(f.cursal, !f.cursal.value.trim() || (num(f.cursal.value) ?? -1) >= 0 ? '' : 'Enter a valid amount in PKR');
      if (!st.school && !st.online && !st.home && !st.academy) err = 'Choose at least one teaching mode.';
      else if ((st.school && !okNum(f.salary.value)) || (needsRate() && !okNum(f.rate.value)) || (f.cursal.value.trim() && (num(f.cursal.value) ?? -1) < 0)) err = 'Please fix the highlighted fields.';
      else if (!readChips(a, 'hoods').length) err = 'Choose at least one Lahore neighbourhood.';
    } else if (step === 3) {
      const ok = /^\d{5}-\d{7}-\d$/.test(f.cnicno.value.trim());
      fieldError(f.cnicno, ok ? '' : 'Enter your 13-digit CNIC number, like 35202-1234567-1');
      if (!ok) err = 'Please enter your CNIC number.';
    }
    const box = $('#steperr', a);
    box.classList.toggle('hidden', !err);
    box.textContent = err ? '⚠ ' + err : '';
    return !err;
  };
  const preview = () => {
    syncDegrees();
    const fake = {
      id: 'preview', profiles: { full_name: f.name.value.trim(), avatar_url: st.avatar ? URL.createObjectURL(st.avatar) : p.avatar_url },
      years_experience: f.years.value, subjects: readChips(a, 'subjects'), curricula: readChips(a, 'curricula'), neighborhoods: readChips(a, 'hoods'),
      qualifications: degrees.filter(([d]) => d.trim()).map(([d, i]) => (i.trim() ? `${d.trim()} - ${i.trim()}` : d.trim())),
      teaching_modes: [st.online && 'online', st.academy && 'home_academy', st.home && 'private_home'].filter(Boolean), available_at_school: st.school,
      rate_type: needsRate() ? st.rateType : null, rate_amount: needsRate() ? num(f.rate.value) : null, estimated_monthly_salary: num(f.salary.value),
      is_immediately_available: st.now, is_star_teacher: !!t.is_star_teacher, rating_avg: t.rating_avg, reviews_count: t.reviews_count,
    };
    $('#preview', a).innerHTML = teacherCard(fake).replace(/<div class="tc-actions">[\s\S]*?<\/div>\s*<\/article>/, '</article>');
  };
  const show = (n) => {
    st.step = n;
    $$('[data-step]', a).forEach((s) => (s.hidden = +s.dataset.step !== n));
    $('#steps', a).innerHTML = TITLES.map((_, i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
    $('#stepname', a).textContent = `Step ${n + 1} of 4 · ${TITLES[n]}`;
    $('#prev', a).style.visibility = n === 0 && !isEdit ? 'hidden' : 'visible';
    $('#prev', a).textContent = n === 0 ? 'Cancel' : 'Back';
    $('#next', a).textContent = n === 3 ? (isEdit ? 'Save changes' : 'Submit profile') : 'Next';
    if (n === 3) preview();
    $('#steperr', a).classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  show(0);
  $('#prev', a).onclick = () => (st.step === 0 ? go('#/home') : show(st.step - 1));
  $('#next', a).onclick = async () => {
    if (st.step < 3) { if (validate(st.step)) show(st.step + 1); return; }
    for (let s = 0; s < 4; s++) if (!validate(s)) { show(s); validate(s); return; }
    const b = $('#next', a);
    setBusy(b, true, 'Saving...');
    try {
      const uid = S.profile.id;
      const ext = (file) => (file.name.split('.').pop() || 'jpg').toLowerCase();
      const up = async (bucket, path, file) => {
        const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (error) throw error;
        return path;
      };
      let avatarUrl = null;
      if (st.avatar) {
        await up('avatars', `${uid}/avatar`, st.avatar);
        avatarUrl = sb.storage.from('avatars').getPublicUrl(`${uid}/avatar`).data.publicUrl + `?v=${Date.now()}`;
      }
      const cnicPath = st.cnic ? await up('teacher_documents', `${uid}/cnic.${ext(st.cnic)}`, st.cnic) : null;
      const degreePath = st.degree ? await up('teacher_documents', `${uid}/degree.${ext(st.degree)}`, st.degree) : null;
      const cnicBackPath = st.cnicBack ? await up('teacher_documents', `${uid}/cnic-back.${ext(st.cnicBack)}`, st.cnicBack) : null;
      for (const [i, file] of st.extra.entries()) others.push(await up('teacher_documents', `${uid}/other-${Date.now()}-${i}.${ext(file)}`, file));
      st.extra = [];
      const loc = readLocation(a, 'loc');
      const pr = await sb.from('profiles').update({
        full_name: f.name.value.trim(), phone_number: f.phone.value.trim(), address: f.address.value.trim(),
        current_location_label: loc.label || null, current_lat: loc.lat, current_lng: loc.lng, ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      }).eq('id', uid);
      if (pr.error) throw pr.error;
      syncDegrees();
      // Verification fields are never sent: the database keeps them as they are for teachers.
      const tr = await sb.from('teacher_profiles').upsert({
        id: uid, bio_description: f.bio.value.trim(), years_experience: parseInt(f.years.value.trim(), 10),
        qualifications: degrees.filter(([d]) => d.trim()).map(([d, i]) => (i.trim() ? `${d.trim()} - ${i.trim()}` : d.trim())),
        subjects: readChips(a, 'subjects'), curricula: readChips(a, 'curricula'), neighborhoods: readChips(a, 'hoods'),
        available_at_school: st.school, estimated_monthly_salary: st.school ? num(f.salary.value) : null,
        available_at_student_home: st.home, available_at_teacher_home: st.academy, current_salary: num(f.cursal.value),
        teaching_modes: [st.online && 'online', st.academy && 'home_academy', st.home && 'private_home'].filter(Boolean),
        is_immediately_available: st.now, expertise_categories: readChips(a, 'expertise'),
        rate_type: needsRate() ? st.rateType : null, rate_amount: needsRate() ? num(f.rate.value) : null,
        ...(cnicPath ? { cnic_doc_url: cnicPath } : {}), ...(degreePath ? { degree_doc_url: degreePath } : {}),
      });
      if (tr.error) throw tr.error;
      const vv = await sb.from('teacher_verification').upsert({
        id: uid, cnic_number: f.cnicno.value.trim(), other_doc_urls: others,
        ...(cnicBackPath ? { cnic_back_doc_url: cnicBackPath } : {}),
      });
      if (vv.error) throw vv.error.code === '23505' ? new Error('This CNIC number is already registered with another Tutobridge account. Email ' + SUPPORT_EMAIL + ' if this is a mistake.') : vv.error;
      setSetupSkipped(false);
      await loadMe();
      toast(isEdit ? 'Profile updated.' : 'Profile submitted. We will verify it soon.');
      go('#/home');
    } catch (e) {
      setBusy(b, false);
      toast(errText(e), true);
    }
  };
}
function renderSetupChoice() {
  const first = esc((S.profile.full_name || '').split(' ')[0]);
  view(`<div class="narrow center" style="padding-top:24px">
    <div style="font-size:52px">🎉</div>
    <h1>Welcome to Tutobridge${first ? ', ' + first : ''}!</h1>
    <p class="muted">Set up your teacher profile so parents in Lahore can find you. It takes about 5 minutes.</p>
    <div class="card" style="text-align:left;margin:18px 0">
      <b>You'll need</b>
      <div class="tc-line"><i>📚</i><span>Your subjects, degrees and the areas you teach in</span></div>
      <div class="tc-line"><i>🪪</i><span>Your CNIC number, plus a photo of the front and back of your CNIC</span></div>
      <div class="tc-line"><i>🎓</i><span>Your highest degree certificate, and any experience letters or teaching certificates</span></div>
      <div class="small muted" style="margin-top:8px">Your CNIC and documents are only seen by our verification team.</div>
    </div>
    <button class="btn" style="width:100%" id="now">Set up profile now</button>
    <button class="btn out" style="width:100%;margin-top:10px" id="skip">Skip for now</button>
    <p class="small muted" style="margin-top:10px">If you skip, parents won't see you until your profile is complete and verified.</p>
  </div>`);
  $('#now').onclick = () => go('#/onboarding/form');
  $('#skip').onclick = () => { setSetupSkipped(true); go('#/home'); };
}
function renderSetupReminder() {
  view(`<div class="mid">
    <div class="card st"><div class="row">${avatar(S.profile.full_name, S.profile.avatar_url, 72)}<div class="grow"><h2>${esc(S.profile.full_name)}</h2>
      <div class="pills"><span class="pill">⚠ Profile not set up</span></div></div></div></div>
    <div class="card lime st" style="--i:1"><b>Finish your profile to start getting students</b>
      <p class="small" style="margin:6px 0 12px">Parents can't see you yet. Add your subjects and areas, your CNIC number and your documents, and our team will verify you.</p>
      <button class="btn" data-a="go" data-v="#/onboarding/form">Set up profile now</button></div>
  </div>`);
}
const isSetUp = () => !!S.teacher && onboardingComplete(S.teacher);
ROUTES.onboarding = (params = []) => (isSetUp() ? renderOnboarding(true) : params[0] === 'form' ? renderOnboarding(false) : renderSetupChoice());
ROUTES.edit = () => (S.profile.role !== 'teacher' ? go('#/home') : renderOnboarding(isSetUp()));

/* ------------------------------------------------------------------ dashboard */
async function renderTeacherDashboard() {
  await loadMe();
  if (!isSetUp()) return renderSetupReminder();
  const p = S.profile, t = S.teacher;
  let bookings = [];
  let filter = 'pending';
  const status = t.verification_status === 'verified' ? '<span class="pill lime">✓ Verified Educator</span>'
    : t.verification_status === 'rejected' ? '<span class="pill">⚠ Verification Rejected</span>' : '<span class="pill lime">⏳ Pending Verification</span>';
  const activeModes = [t.available_at_school, t.available_at_student_home, t.available_at_teacher_home, (t.teaching_modes || []).includes('online')].filter(Boolean).length;
  const a = view(`
    <div class="card ${t.is_star_teacher ? 'star' : ''} st"><div class="row">${avatar(p.full_name, p.avatar_url, 72)}<div class="grow"><h2>${esc(p.full_name)}</h2>
      <div class="pills">${t.is_star_teacher ? '<span class="pill ink">★ Star Teacher</span>' : ''}${status}</div>
      ${t.verification_status === 'pending' ? '<div class="small muted" style="margin-top:6px">Parents see your profile once our team verifies it.</div>' : ''}
      ${t.verification_status === 'rejected' ? `<div class="small muted" style="margin-top:6px">Update your documents in Edit profile, or email ${SUPPORT_EMAIL}.</div>` : ''}</div>
      <a class="btn out sm" href="#/edit">✏️ Edit profile &amp; rates</a></div></div>
    <section class="card st" style="--i:1"><div class="row wrap" style="margin-bottom:10px"><b class="grow">Parents looking for teachers near you</b></div>
      ${t.verification_status !== 'verified' ? '<div class="hint">🔒 Requests on the map appear once your profile is verified.</div>' : ''}
      ${p.current_lat == null ? '<div class="hint">📍 Save your current location in Account › Address to see how far each request is.</div>' : ''}
      <div id="tmap" class="map"></div><div class="small muted" style="margin-top:6px">Locations are approximate. Contact details are shared only after a booking is accepted.</div></section>
    <div class="card st ${t.is_accepting_students ? 'lime' : ''}" id="accbox" style="--i:2"><div class="row"><div class="grow"><b>Accepting New Students</b>
      <div class="small" id="accsub">${t.is_accepting_students ? 'Parents can send you requests' : 'Hidden from the parent board for now'}</div></div>
      <button class="switch ${t.is_accepting_students ? 'on' : ''}" id="acc" aria-label="Accepting new students"></button></div></div>
    <div class="stats st" style="--i:3" id="stats"></div>
    <div class="sec"><h2>Parent requests</h2></div>
    <div class="seg" id="tabs"></div>
    <div id="list" style="margin-top:14px"><div class="spin"></div></div>`);

  const count = (s) => bookings.filter((b) => b.status === s).length;
  const drawStats = () => {
    $('#stats', a).innerHTML = [['📩', 'Pending Requests', count('pending')], ['🎓', 'Active Tuitions', count('accepted')],
      ['⭐', 'Star Rating', t.reviews_count ? `${Number(t.rating_avg).toFixed(1)} (${t.reviews_count})` : 'New'], ['🎛️', 'Active Modes', `${activeModes} of 4`]]
      .map(([i, l, v]) => `<div class="stat"><div class="l">${i} ${l}</div><div class="v">${esc(v)}</div></div>`).join('');
    $('#tabs', a).innerHTML = ['pending', 'accepted', 'declined'].map((s) => `<button data-tab="${s}" class="${filter === s ? 'on' : ''}">${s[0].toUpperCase() + s.slice(1)} ${count(s)}</button>`).join('');
  };
  const card = (b) => {
    const m = BOOKING_MODES[b.teaching_mode] || { label: b.teaching_mode, icon: '' };
    const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(b.parent_lat != null ? `${b.parent_lat},${b.parent_lng}` : (b.parent_address || b.parent_location_label || ''));
    return `<div class="card st"><div class="row">${avatar(b.parent_name, null, 44)}<b class="grow" style="font-size:16px">${esc(b.parent_name || 'Parent')}</b><span class="pill">${m.icon} ${esc(m.label)}</span></div>
      <div class="tc-line"><i>📚</i><span>${esc([b.subject, b.student_grade].filter(Boolean).join(' · '))}</span></div>
      ${b.neighborhood ? `<div class="tc-line"><i>📍</i><span>${esc(b.neighborhood)}</span></div>` : ''}
      ${b.proposed_schedule ? `<div class="tc-line"><i>🕒</i><span>${esc(b.proposed_schedule)}</span></div>` : ''}
      ${b.notes ? `<div class="tc-line"><i>📝</i><span>${esc(b.notes)}</span></div>` : ''}
      <div class="small muted" style="margin-top:6px">Received ${fmtTime(b.created_at)}</div>
      ${b.status === 'pending' ? `<div class="row" style="margin-top:12px"><button class="btn out grow" data-dec="${b.id}">Decline</button><button class="btn grow" data-acc="${b.id}">Accept</button></div>` : ''}
      ${b.status === 'accepted' ? `<div class="card lime" style="margin:12px 0 0">
        ${b.parent_phone ? `<div class="row wrap"><b class="grow">📞 ${esc(b.parent_phone)}</b><a class="btn out sm" href="tel:${esc(b.parent_phone.replace(/\s/g, ''))}">Call</a><a class="btn out sm" target="_blank" rel="noopener" href="https://wa.me/${toIntl(b.parent_phone)}">WhatsApp</a></div>` : '<div>This parent did not add a phone number.</div>'}
        ${b.parent_address ? `<div class="tc-line"><i>🏠</i><b>${esc(b.parent_address)}</b></div>` : ''}
        ${b.parent_location_label ? `<div class="tc-line"><i>📍</i><span>Currently near ${esc(b.parent_location_label)}</span></div>` : ''}
        ${(b.parent_address || b.parent_location_label || b.parent_lat != null) ? `<a class="btn out sm" style="margin-top:10px" target="_blank" rel="noopener" href="${maps}">🗺️ Open in Maps</a>` : ''}</div>` : ''}</div>`;
  };
  const drawList = () => {
    const shown = bookings.filter((b) => b.status === filter);
    $('#list', a).innerHTML = shown.length ? shown.map(card).join('')
      : `<div class="empty"><b>📥</b><span class="muted">${filter === 'pending' ? (t.verification_status === 'verified' ? 'No new requests yet. They will appear here as they arrive.' : 'Requests will start once your profile is verified.') : 'Nothing here yet.'}</span></div>`;
    drawStats();
  };
  const loadBookings = async () => {
    const { data, error } = await sb.rpc('teacher_bookings');
    if (error) { $('#list', a).innerHTML = `<p>${esc(errText(error))}</p>`; return; }
    bookings = data || [];
    drawList();
  };
  loadBookings();
  drawStats();
  // New and changed requests arrive live; RLS means a teacher only receives their own rows.
  S.channels.push(sb.channel('bookings-' + p.id).on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `teacher_id=eq.${p.id}` }, loadBookings).subscribe());

  a.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { filter = tab.dataset.tab; drawList(); return; }
    const acc = e.target.closest('[data-acc]'), dec = e.target.closest('[data-dec]');
    if (acc || dec) {
      const b = bookings.find((x) => x.id === (acc || dec).dataset[acc ? 'acc' : 'dec']);
      if (dec && !(await confirmBox('Decline this request?', `${b.parent_name} will be told you are unable to take this tuition.`, 'Decline', 'Keep it'))) return;
      const btn = acc || dec;
      setBusy(btn, true, '...');
      const { error } = await sb.from('bookings').update({ status: acc ? 'accepted' : 'declined' }).eq('id', b.id);
      if (error) { setBusy(btn, false); return toast(errText(error), true); }
      await loadBookings();
      toast(acc ? `Accepted. ${b.parent_name}'s contact details are now visible.` : 'Request declined.');
    }
  });
  $('#acc', a).onclick = async () => {
    const v = !t.is_accepting_students;
    const set = (val) => {
      t.is_accepting_students = val;
      $('#acc', a).classList.toggle('on', val);
      $('#accbox', a).classList.toggle('lime', val);
      $('#accsub', a).textContent = val ? 'Parents can send you requests' : 'Hidden from the parent board for now';
    };
    set(v);
    const { error } = await sb.from('teacher_profiles').update({ is_accepting_students: v }).eq('id', p.id);
    if (error) { set(!v); toast(errText(error), true); }
  };
  drawRequestsMap($('#tmap', a), t.verification_status === 'verified');
}

async function drawRequestsMap(el, verified) {
  const p = S.profile;
  const me = p.current_lat != null ? [p.current_lat, p.current_lng] : null;
  const map = makeMap(el, me);
  if (me) L.marker(me, { icon: pin('me', '•') }).addTo(map).bindPopup('<b>You</b>');
  if (!verified) return;
  const { data, error } = await sb.rpc('map_requests');
  if (error) return;
  const pts = [];
  for (const r of data || []) {
    if (r.lat == null) continue;
    const ll = [Number(r.lat), Number(r.lng)];
    pts.push(ll);
    L.marker(ll, { icon: pin('req', '📌') }).addTo(map).bindPopup(
      `<b>${esc(r.parent_first_name)} needs ${esc(r.subject)}</b><br><span class="small">${esc([r.curriculum, r.grade].filter(Boolean).join(' · '))}${r.distance_km != null ? ` · ${r.distance_km} km` : ''}</span>
       ${r.area ? `<br><span class="small">Area: ${esc(r.area)}</span>` : ''}${r.note ? `<br><i class="small">"${esc(r.note)}"</i>` : ''}
       <br><span class="small muted">Posted ${fmtTime(r.created_at)}</span><button class="btn" data-req="${esc(r.request_id)}">💬 Connect</button>`);
  }
  fitTo(map, pts, me);
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-req]');
  if (!b) return;
  setBusy(b, true, 'Opening...');
  const { data, error } = await sb.rpc('connect_to_request', { p_request_id: b.dataset.req });
  setBusy(b, false);
  if (error) return toast(errText(error), true);
  go('#/chat/' + data);
});
