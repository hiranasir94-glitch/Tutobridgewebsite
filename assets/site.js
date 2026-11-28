/* Shared header/footer + Supabase helper for Tutobridge sub-pages. */
(function () {
  var LOGO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F2A37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 18h19"/><path d="M4.5 18c0-5.5 3.4-9 7.5-9s7.5 3.5 7.5 9"/><path d="M8 18v-5M12 18V9M16 18v-5"/><circle cx="12" cy="5" r="1.6" fill="#1F2A37"/></svg>';
  var NAV = [
    ['/tutors/', 'Find a Tutor', 'tutors', [
      ['/tutors/?mode=online', '💻 Online tutor', 'Classes over video call'],
      ['/tutors/?mode=home', '🏠 Home tutor', 'Tutor comes to your home'],
      ['/academies/', '🏫 Academies / Centers near me', 'Tuition centers on a map']
    ]],
    ['/notice-board/', 'Notice Board', 'notice', [
      ['/notice-board/best-teachers/', '⭐ Best Teachers in Lahore', 'Star Teachers picked by our team'],
      ['/notice-board/', '📅 Upcoming events', 'Expos, fairs and conferences'],
      ['/tools/', '🤖 AI Tool Magazine', 'The latest AI tools for learning'],
      ['/notice-board/best-centers/', '🏆 Best Learning Centers', 'Starred centers, approved by us']
    ]],
    ['/jobs/', 'Jobs', 'jobs', [
      ['/app/#/signup/teacher', '👩‍🏫 Register as a teacher', 'Join free with early access'],
      ['/jobs/', '💼 Work for Tutobridge', 'Open roles in our team'],
      ['/academies/#list', '🏫 Register my Learning Center', 'Get your academy on the map']
    ]],
    ['/subscriptions/', 'Subscriptions', 'subs'],
    ['/#faq', 'FAQ', 'faq'],
    ['/app/#/login', 'Log in', 'login']
  ];
  var page = document.body.getAttribute('data-page') || '';
  var nav = NAV.map(function (n) {
    if (n[3]) {
      var on = ({ tutors: ['tutors', 'academies'], notice: ['notice', 'best-teachers', 'tools', 'best-centers'], jobs: ['jobs'] })[n[2]].indexOf(page) > -1;
      return '<details class="dd"><summary class="' + (on ? 'on' : '') + '">' + n[1] + ' <i>▾</i></summary><div class="ddm">' +
        n[3].map(function (m) { return '<a href="' + m[0] + '"><b>' + m[1] + '</b><span>' + m[2] + '</span></a>'; }).join('') + '</div></details>';
    }
    var cls = (n[2] === page ? 'on' : '') + (n[2] === 'login' ? ' login' : '') + (n[2] === 'faq' ? ' faq' : '');
    return '<a class="' + cls.trim() + '" href="' + n[0] + '">' + n[1] + '</a>';
  }).join('');
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.dd[open]').forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });
  var h = document.getElementById('site-header');
  if (h) h.outerHTML = '<header class="tnav"><div class="wrap"><div class="row1"><a class="brand" href="/"><i>' + LOGO + '</i>Tutobridge</a>' +
    '<nav class="mnav d-only">' + nav + '</nav></div><nav class="mnav m-only">' + nav + '</nav></div></header>' +
    '<style>@media(min-width:900px){.m-only{display:none!important}}@media(max-width:899px){.d-only{display:none!important}}</style>';
  var GROUPS = [[NAV[1][3], ['best-teachers', 'notice', 'tools', 'best-centers']]];
  var hd = document.querySelector('header.tnav');
  GROUPS.forEach(function (g) {
    if (hd && page && g[1].indexOf(page) > -1) hd.insertAdjacentHTML('afterend', '<nav class="subtabs"><div class="wrap">' + g[0].map(function (m, i) {
      return '<a class="' + (g[1][i] === page ? 'on' : '') + '" href="' + m[0] + '">' + m[1] + '</a>'; }).join('') + '</div></nav>');
  });
  var f = document.getElementById('site-footer');
  if (f) f.outerHTML = '<footer class="pfoot"><div class="wrap"><a href="/">Home</a><a href="/tutors/?mode=online">Online tutors</a><a href="/tutors/?mode=home">Home tutors</a><a href="/academies/">Academies / Centers near me</a><a href="/notice-board/best-teachers/">Best Teachers in Lahore</a><a href="/notice-board/">Upcoming events</a><a href="/tools/">AI Tool Magazine</a><a href="/notice-board/best-centers/">Best Learning Centers</a><a href="/jobs/">Work for Tutobridge</a><a href="/academies/#list">Register my Learning Center</a><a href="/subscriptions/">Subscriptions</a><a href="/tools/lesson-planner/">Lesson Planner</a><a href="/app/#/signup/teacher">Register as a teacher</a><span>support@tutobridge.com</span><span class="cp">© 2026 Tutobridge</span></div></footer>';
})();

window.TB = {
  URL: 'https://kdgyxgytcphnmsnvxdiz.supabase.co',
  KEY: 'sb_publishable_5mo3bWfClhII0ymU2asdDg_Shpsc6fh',
  /* Logged-in session saved by the app (/app/), if still valid. */
  session: function () {
    try {
      var j = JSON.parse(localStorage.getItem('sb-kdgyxgytcphnmsnvxdiz-auth-token') || 'null');
      if (j && j.access_token && (!j.expires_at || j.expires_at * 1000 > Date.now() + 30000)) return j;
    } catch (e) { /* storage blocked */ }
    return null;
  },
  authHeaders: function () {
    var s = this.session(), h = { apikey: this.KEY, 'Content-Type': 'application/json' };
    if (s) h.Authorization = 'Bearer ' + s.access_token;
    return h;
  },
  /* Verified teachers, public-safe fields only (first name + initial, subjects, rating). */
  teachers: function () {
    return fetch(this.URL + '/rest/v1/rpc/public_teacher_cards_v2', {
      method: 'POST',
      headers: { apikey: this.KEY, 'Content-Type': 'application/json' },
      body: '{}'
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  },
  esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); },
  stars: function (r, n) {
    r = +r || 0;
    if (!n) return '<span class="pill">New teacher</span>';
    var full = Math.round(r);
    return '<span class="pill lime" title="' + r.toFixed(1) + ' out of 5">' + '★★★★★'.slice(0, full) + '<span style="opacity:.25">' + '★★★★★'.slice(full) + '</span> ' + r.toFixed(1) + ' · ' + n + ' review' + (n === 1 ? '' : 's') + '</span>';
  },
  ini: function (name) { return String(name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
};
