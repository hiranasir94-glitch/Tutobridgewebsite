/* Shared header/footer + Supabase helper for Tutobridge sub-pages. */
(function () {
  var LOGO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 18h19"/><path d="M4.5 18c0-5.5 3.4-9 7.5-9s7.5 3.5 7.5 9"/><path d="M8 18v-5M12 18V9M16 18v-5"/><circle cx="12" cy="5" r="1.6" fill="#111"/></svg>';
  var NAV = [
    ['/tutors/', 'Find a Tutor', 'tutors'],
    ['/notice-board/', 'Notice Board', 'notice'],
    ['/tools/', 'Latest AI tools', 'tools'],
    ['/#faq', 'FAQ', 'faq'],
    ['/app/#/login', 'Log in', 'login']
  ];
  var page = document.body.getAttribute('data-page') || '';
  var nav = NAV.map(function (n) {
    var cls = (n[2] === page ? 'on' : '') + (n[2] === 'login' ? ' login' : '') + (n[2] === 'faq' ? ' faq' : '');
    return '<a class="' + cls.trim() + '" href="' + n[0] + '">' + n[1] + '</a>';
  }).join('');
  var h = document.getElementById('site-header');
  if (h) h.outerHTML = '<header class="tnav"><div class="wrap"><div class="row1"><a class="brand" href="/"><i>' + LOGO + '</i>Tutobridge</a>' +
    '<nav class="mnav d-only">' + nav + '</nav></div><nav class="mnav m-only">' + nav + '</nav></div></header>' +
    '<style>@media(min-width:900px){.m-only{display:none!important}}@media(max-width:899px){.d-only{display:none!important}}</style>';
  var f = document.getElementById('site-footer');
  if (f) f.outerHTML = '<footer class="pfoot"><div class="wrap"><a href="/">Home</a><a href="/tutors/">Find a Tutor</a><a href="/notice-board/">Notice Board</a><a href="/tools/">Latest AI tools</a><a href="/tools/lesson-planner/">Lesson Planner</a><a href="/app/#/signup/teacher">Register as a teacher</a><span>support@tutobridge.com</span><span class="cp">© 2026 Tutobridge</span></div></footer>';
})();

window.TB = {
  URL: 'https://kdgyxgytcphnmsnvxdiz.supabase.co',
  KEY: 'sb_publishable_5mo3bWfClhII0ymU2asdDg_Shpsc6fh',
  /* Verified teachers, public-safe fields only (first name + initial, subjects, rating). */
  teachers: function () {
    return fetch(this.URL + '/rest/v1/rpc/public_teacher_cards', {
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
