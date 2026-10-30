/* ================= API اتصال — MongoDB بیک اینڈ (Firebase کی جگہ) =================
   یہ فائل پرانی Firebase ماڈیول اسکرپٹ کی جگہ لیتی ہے اور بالکل وہی
   `window.__fb` انٹرفیس فراہم کرتی ہے جو مرکزی اسکرپٹ استعمال کرتا ہے
   (signIn/signUp/signOut/upsert/startSubscriptions/...) — اس لیے مرکزی
   اسکرپٹ، تمام اسکرینز اور اردو متن بغیر تبدیلی کے چلتے ہیں؛ صرف ڈیٹا
   کا ذریعہ بدلا ہے: Firestore اسنیپ شاٹس کی جگہ REST + ہر 60 سیکنڈ پولنگ۔
   کوئی Firebase SDK، کوئی apiKey، کوئی projectId یہاں نہیں ہے۔
   ترتیب: config.js (ILMI_API_BASE) -> یہ فائل -> مرکزی اسکرپٹ کا بوٹ۔ */
'use strict';

// ---- API base: window config > localStorage > ?api= override ----
function resolveApiBase() {
  try {
    const params = new URLSearchParams(location.search);
    const q = params.get('api');
    if (q) { try { localStorage.setItem('ilmi_api_base', q.replace(/\/$/, '')); } catch (e) {} }
  } catch (e) {}
  let base = '';
  try { base = localStorage.getItem('ilmi_api_base') || ''; } catch (e) {}
  if (window.ILMI_API_BASE) base = window.ILMI_API_BASE;
  return String(base || '').replace(/\/$/, '');
}
const API_BASE = resolveApiBase();

// ---- tokens (localStorage — وہی ذخیرہ جو ایپ پہلے سے استعمال کرتی ہے) ----
const TK_ACCESS = 'ilmi_access';
const TK_REFRESH = 'ilmi_refresh';
function getAccess() { try { return localStorage.getItem(TK_ACCESS) || ''; } catch (e) { return ''; } }
function getRefresh() { try { return localStorage.getItem(TK_REFRESH) || ''; } catch (e) { return ''; } }
function setTokens(a, r) {
  try {
    if (a) localStorage.setItem(TK_ACCESS, a); else localStorage.removeItem(TK_ACCESS);
    if (r) localStorage.setItem(TK_REFRESH, r); else localStorage.removeItem(TK_REFRESH);
  } catch (e) {}
}
function clearTokens() { setTokens('', ''); }

// ---- fetch helper: backend error shape -> Error with .code (for loginErrText) ----
async function api(path, opts) {
  opts = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && getAccess()) headers.Authorization = 'Bearer ' + getAccess();
  let slowTimer = null;
  try {
    slowTimer = setTimeout(() => {
      // Free-tier cold start: after 8s on the login screen, say so honestly.
      try {
        const el = document.getElementById('login-msg');
        if (el && !el.textContent.includes('جاگ رہا')) {
          el.textContent = 'سرور جاگ رہا ہے — چند لمحے اور انتظار کریں…';
        }
      } catch (e) {}
    }, 8000);
    const res = await fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
      err.code = (data && data.error && data.error.code) || ('http-' + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
  }
}

// ---- doc normalisation: MongoDB _id -> the id/uid fields the UI expects ----
function normDoc(d) {
  if (!d || typeof d !== 'object') return d;
  const o = Object.assign({}, d);
  if (!o.id && o._id) o.id = o._id;
  if (!o.uid && o._id) o.uid = o._id;
  return o;
}
function normList(arr) { return (arr || []).map(normDoc); }

// ---- session state ----
let CURRENT_USER = null;   // /me user doc (after login / boot restore)
let CURRENT_IS_ADMIN = false;
let POLL_TIMER = null;
let POLL_CTX = null;
// Last live-session doc seen via polling (student: /sessions liveSession,
// admin: /settings/session). The UI derives a session's id by hashing
// title|sessionDate|when (see sessionIdOf below) — the bridge needs the
// same doc to route a session-registration write to its endpoint.
let LAST_EVENT_SESSION = null;
// Last polled users docs (uid -> JSON), for diff-based routing of admin
// writes: the UI sends the WHOLE user doc on every change, so the bridge
// must compare against the last polled state to know WHAT changed —
// routing on absolute state would mistake a pre-existing bookAccess=true
// for a new grant, or a student's unchanged status for a decision.
let LAST_USERS = {};

async function fetchMe() {
  const r = await api('/api/users/me', {});
  CURRENT_USER = r.user || null;
  CURRENT_IS_ADMIN = !!r.isAdmin;
  return r;
}

async function ensureMe() {
  if (!CURRENT_USER) {
    try { await fetchMe(); } catch (e) { /* unauthenticated: caller paths fall back */ }
  }
}

// UI-identical session id (main script sessionIdOf): FNV-1a over
// title|sessionDate|when. Must match character-for-character, or a
// bridge-routed registration would name a different session than the
// UI's claim.
function sessionIdOf(s) {
  const raw = ((s && s.title) || '') + '|' + ((s && s.sessionDate) || '') + '|' + ((s && s.when) || '');
  let h1 = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) { h1 ^= raw.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0; }
  return 'sess-' + h1.toString(16);
}

// Wrap window.__applySnapshot (defined by the main script, which loads
// AFTER this bridge) so users snapshots also feed LAST_USERS. Safe to
// call repeatedly; wraps at most once.
function hookSnapshots() {
  try {
    const cur = window.__applySnapshot;
    if (typeof cur === 'function' && !cur.__ilmiHooked) {
      const wrapped = function (k, data) {
        try {
          if (k === 'users' && Array.isArray(data)) {
            for (const d of data) {
              if (d && (d.uid || d.email)) LAST_USERS[d.uid || d.email] = JSON.stringify(d);
            }
          }
        } catch (e) {}
        return cur(k, data);
      };
      wrapped.__ilmiHooked = true;
      window.__applySnapshot = wrapped;
    }
  } catch (e) {}
}

// ---- subscriptions -> initial GET + 60s polling (replaces onSnapshot) ----
function stopSubscriptions() {
  if (POLL_TIMER) { clearInterval(POLL_TIMER); POLL_TIMER = null; }
  POLL_CTX = null;
}

const CONTENT_FEEDS = [
  ['news', 'news'], ['announcements', 'announcements'], ['jobs', 'jobsExtra'],
  ['courses', 'rcoursesExtra'], ['publications', 'publications'],
  ['journals', 'journals'], ['graduates', 'graduates'],
  ['spotlights', 'spotlights'], ['courseContent', 'courseContent'],
  ['sessionAttendees', 'sessionAttendees'],
];
const ADMIN_LISTS = [
  'sessionArchive', 'counselLogs', 'messages', 'competitions', 'transfers',
  'starRequests', 'courseSessions', 'starTeam', 'certificates',
  'starRecommendations', 'attendanceClaims', 'dashboardData',
];

async function pollOnce(ctx) {
  try {
    await ensureFreshAccess();
    if (ctx.isAdmin) {
      const u = await api('/api/admin/users?limit=200', {});
      window.__applySnapshot('users', normList(u.docs));
      const s = await api('/api/admin/settings/session', {});
      if (s.session) { LAST_EVENT_SESSION = s.session; window.__applySnapshot('eventSession', s.session); }
      for (const [coll, key] of CONTENT_FEEDS) {
        try {
          const r = await api('/api/content/' + coll + '?limit=200', {});
          window.__applySnapshot(key, normList(r.docs));
        } catch (e) { /* one feed failing must not kill the rest */ }
      }
      for (const coll of ADMIN_LISTS) {
        try {
          const r = await api('/api/admin/lists/' + coll + '?limit=200', {});
          const key = coll === 'competitions' ? 'compSubs' : coll;
          window.__applySnapshot(key, normList(r.docs));
        } catch (e) {}
      }
      try {
        const sec = await api('/api/admin/secrets', {});
        window.__applySnapshot('sessionSecrets', normList(sec.docs));
      } catch (e) {}
      try {
        const ov = await api('/api/course/admin/overview', {});
        window.__applySnapshot('courseAssignments', normList(ov.assignments));
        window.__applySnapshot('courseSubmissions', normList(ov.submissions));
        window.__applySnapshot('courseOverview', [{ id: 'overview', sessionsSeeded: ov.sessionsSeeded, registered: ov.registered, gaps: ov.gaps || [], plan: ov.plan || [] }]);
      } catch (e) {}
      try {
        const gb = await api('/api/course/admin/gradebook', {});
        window.__applySnapshot('courseGradebook', [Object.assign({ id: 'gradebook' }, gb)]);
      } catch (e) {}
      return;
    }
    // Student: own doc first (pending students stop here — gated feeds
    // stay blocked exactly as the old code did for unapproved accounts).
    const me = await fetchMe();
    window.__applySnapshot('users', [normDoc(me.user)]);
    if (!ctx.approved) return;
    for (const [coll, key] of CONTENT_FEEDS) {
      try {
        const r = await api('/api/content/' + coll + '?limit=200', {});
        window.__applySnapshot(key, normList(r.docs));
      } catch (e) {}
    }
    try {
      const sess = await api('/api/attendance/sessions', {});
      if (sess.liveSession) { LAST_EVENT_SESSION = sess.liveSession; window.__applySnapshot('eventSession', sess.liveSession); }
      if (sess.sessions) window.__applySnapshot('courseSessions', normList(sess.sessions));
    } catch (e) {}
    const own = [
      ['/api/notifications?limit=200', 'notifications'],
      ['/api/users/me/achievements', 'achievements'],
      ['/api/users/me/competitions', 'compSubs'],
      ['/api/users/me/transfers', 'transfers'],
      ['/api/users/me/star-requests', 'starRequests'],
      ['/api/users/me/messages', 'messages'],
      ['/api/users/me/drafts', 'drafts'],
    ];
    for (const [path, key] of own) {
      try {
        const r = await api(path, {});
        window.__applySnapshot(key, normList(r.docs));
      } catch (e) {}
    }
    try {
      const mine = await api('/api/attendance/mine', {});
      window.__applySnapshot('attendanceClaims', normList(mine.claims));
    } catch (e) {}
    try {
      const star = await api('/api/star/members', {});
      window.__applySnapshot('starTeam', normList(star.members));
    } catch (e) {}
    // Idara Sazi course classroom: released assignments + my submissions,
    // my points (+badges), and the course leaderboard.
    try {
      const ca = await api('/api/course/assignments', {});
      window.__applySnapshot('courseAssignments', normList(ca.assignments));
      window.__applySnapshot('courseSubmissions', normList(ca.submissions));
    } catch (e) {}
    try {
      const cp = await api('/api/course/points', {});
      window.__applySnapshot('coursePoints', cp.points ? [Object.assign({}, cp.points, { badges: cp.badges || [] })] : []);
    } catch (e) {}
    try {
      const lb = await api('/api/course/leaderboard', {});
      window.__applySnapshot('courseLeaderboard', lb.leaderboard || []);
    } catch (e) {}
  } catch (e) {
    console.warn('poll failed:', e && e.message);
  }
}

// ---- Idara Sazi course classroom actions (direct API; errors carry the
// server's Urdu message on err.message, exactly like the bridge's api()) ----
window.__courseApi = {
  async submit(id, text, link) {
    return api('/api/course/assignments/' + encodeURIComponent(id) + '/submit', { method: 'POST', body: { text, link } });
  },
  async saveAssignment(doc) {
    const r = await api('/api/course/admin/assignments', { method: 'POST', body: { doc } });
    return r.doc;
  },
  async grade(submissionId, marks, feedback) {
    return api('/api/course/admin/grade', { method: 'POST', body: { submissionId, marks, feedback } });
  },
  async seed() {
    return api('/api/course/admin/seed', { method: 'POST', body: {} });
  },
  async releases() {
    return api('/api/course/admin/releases', { method: 'POST', body: {} });
  },
};

function startSubscriptions(opts) {
  hookSnapshots();
  stopSubscriptions();
  const ctx = { email: opts.email, isAdmin: !!opts.isAdmin, approved: !!opts.approved };
  POLL_CTX = ctx;
  pollOnce(ctx);
  POLL_TIMER = setInterval(() => { if (POLL_CTX) pollOnce(POLL_CTX); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && POLL_CTX) pollOnce(POLL_CTX);
  });
}

// ---- the window.__fb interface (identical method names to the old bridge) ----
window.__fb = {
  online: true,

  async signUp(email, pass, extra) {
    // The registration form's fields + the vision summary travel WITH
    // the register call (2026-10-30 fix): the server stores them at top
    // level and reviews the vision text at submission time. Sending
    // only {email, password} — the old behaviour — created server docs
    // with an empty name and no vision summary, which is exactly what
    // the admin panel then showed («ابھی جمع نہیں ہوا»).
    const body = { email, password: pass };
    if (extra && typeof extra === 'object') {
      for (const k of ['name', 'mobile', 'degree', 'dept', 'madrasa', 'uni', 'country', 'admissionRoute', 'visionSummary']) {
        if (extra[k] !== undefined && extra[k] !== null && extra[k] !== '') body[k] = extra[k];
      }
    }
    const r = await api('/api/auth/register', { method: 'POST', auth: false, body });
    return { uid: (r.user && (r.user.uid || r.user._id)) || '' };
  },

  async signIn(email, pass) {
    const r = await api('/api/auth/login', { method: 'POST', auth: false, body: { email, password: pass } });
    setTokens(r.accessToken, r.refreshToken);
    const me = await fetchMe();
    const userDoc = normDoc(me.user);
    const isAdmin = !!me.isAdmin;
    startSubscriptions({ uid: userDoc.uid, email, isAdmin, approved: userDoc.status === 'approved' });
    return { uid: userDoc.uid, isAdmin, userDoc };
  },

  // Passwordless ADMIN entry (Mufti, 2026-10-30): the server checks the
  // admins collection itself — the client never decides admin-ness, it
  // only learns it from the server's answer (here + /users/me). A
  // non-admin email gets the generic rejection and the login screen
  // falls back to asking for a password. No admin list exists client-side.
  async signInAdmin(email) {
    const r = await api('/api/auth/admin-login', { method: 'POST', auth: false, body: { email } });
    setTokens(r.accessToken, r.refreshToken);
    const me = await fetchMe();
    const userDoc = normDoc(me.user);
    const isAdmin = !!me.isAdmin;
    startSubscriptions({ uid: userDoc.uid, email, isAdmin, approved: userDoc.status === 'approved' });
    return { uid: userDoc.uid, isAdmin, userDoc };
  },

  async signOut() {
    try {
      const rt = getRefresh();
      if (rt) await api('/api/auth/logout', { method: 'POST', auth: false, body: { refreshToken: rt } });
    } catch (e) {}
    clearTokens();
    CURRENT_USER = null;
    CURRENT_IS_ADMIN = false;
    stopSubscriptions();
  },

  async resetPassword(email) {
    // Stores a hashed reset token server-side; delivery needs a provider
    // (see FRONTEND-TODO.md) — the message stays honest about that.
    await api('/api/auth/forgot-password', { method: 'POST', auth: false, body: { email } });
  },

  // Staff email-link flow -> magic-link endpoints (token delivery still
  // needs a provider; see FRONTEND-TODO.md). The link scheme is now
  // ?login=<token> on the Pages address, not the old web.app link.
  async sendStaffLink(email) {
    await api('/api/auth/magic-link', { method: 'POST', auth: false, body: { email } });
  },

  isEmailLink(url) {
    try {
      const u = new URL(url, location.href);
      return !!(u.searchParams.get('login') || u.searchParams.get('reset'));
    } catch (e) { return false; }
  },

  async completeEmailLink(email, url) {
    const u = new URL(url, location.href);
    const token = u.searchParams.get('login') || u.searchParams.get('reset');
    if (!token) { const err = new Error('لنک میں ٹوکن نہیں ملا'); err.code = 'bad-link'; throw err; }
    const r = await api('/api/auth/magic-redeem', { method: 'POST', auth: false, body: { token } });
    setTokens(r.accessToken, r.refreshToken);
    const me = await fetchMe();
    const userDoc = normDoc(me.user);
    const isAdmin = !!me.isAdmin;
    if (isAdmin) startSubscriptions({ uid: userDoc.uid, email: userDoc.email || email, isAdmin: true, approved: userDoc.status === 'approved' });
    return { uid: userDoc.uid, email: userDoc.email || email, isAdmin, userDoc };
  },

  // No enumeration-safe equivalent exists on the API (the old Firebase
  // call leaked account existence too). Returning null makes the caller
  // fall back to its local flag, exactly as the old code did on failure.
  async signInMethods(email) { return null; },

  async updatePassword(newPass) {
    await api('/api/users/me/password', { method: 'POST', body: { password: newPass } });
  },

  async fetchUserDoc(uid) {
    const me = await fetchMe();
    return normDoc(me.user);
  },

  // Re-registration matched by email — THE migration flow (MIGRATION.md).
  // Returns the backend outcome verbatim; the login screen decides what
  // to do next (approved -> normal login; pending -> pending screen;
  // duplicate -> admin message; already_migrated -> normal login).
  async reRegister(email, pass) {
    const r = await api('/api/auth/re-register', { method: 'POST', auth: false, body: { email, password: pass } });
    return r;
  },

  async upsert(collName, id, data) {
    const clean = JSON.parse(JSON.stringify(data || {}));
    if (collName === 'users') {
      // ROUTED, never blindly PATCHed: the UI sends the WHOLE user doc on
      // every change (updateUser -> persistColl -> upsert), so sending it
      // to /me/profile did two harms at once (proven in the preview pass):
      //   (a) admin decisions (approve/reject/incomplete/book-grant) were
      //       silently dropped — status/bookAccess are not profile fields;
      //   (b) an admin's approval OVERWROTE THE ADMIN'S OWN record with
      //       the student's name/profile, because /me/profile patches the
      //       JWT identity, not the doc's owner.
      // Routing below is by WHAT CHANGED (vs the last polled doc), split
      // into own-profile edits, own state transitions, and admin
      // decisions. Anything unrecognised is skipped with a warning —
      // never sent to /me/profile.
      hookSnapshots();
      await ensureMe();
      const myEmail = (CURRENT_USER && CURRENT_USER.email || '').toLowerCase();
      const targetEmail = (clean.email || '').toLowerCase();
      const isSelf = !!CURRENT_USER && (targetEmail === myEmail || id === CURRENT_USER.uid);
      if (isSelf) {
        const body = {};
        if (clean.profile && typeof clean.profile === 'object') body.profile = clean.profile;
        for (const k of ['name', 'uni', 'madrasa', 'degree', 'dept', 'mobile', 'country']) {
          if (clean[k] !== undefined) body[k] = clean[k];
        }
        if (Object.keys(body).length) {
          await api('/api/users/me/profile', { method: 'PATCH', body });
        }
        // Own state transitions (UI writes these onto the user doc).
        if (clean.sessionReg === true && CURRENT_USER.sessionReg !== true) {
          if (LAST_EVENT_SESSION) {
            await api('/api/attendance/register', { method: 'POST', body: { sessionId: sessionIdOf(LAST_EVENT_SESSION) } });
          } else {
            console.warn('sessionReg write without a known live session — registration skipped');
          }
        }
        if (clean.courseReg === true && !CURRENT_USER.courseReg) {
          await api('/api/attendance/course-register', { method: 'POST', body: {} });
        }
        // Vision text (2026-10-30 fix): a changed visionSummary goes to
        // its own endpoint, which stores the text AND applies the
        // auto-verdict (approve / incomplete / borderline) server-side.
        // /me/profile would have silently dropped it — it is not a
        // profile field — which is why logged-in resubmissions never
        // reached the admin panel either. A repeat send of the same
        // text is harmless: the server decides once per text hash.
        if (typeof clean.visionSummary === 'string' && clean.visionSummary.trim().length >= 20
          && clean.visionSummary !== (CURRENT_USER && CURRENT_USER.visionSummary)) {
          try {
            await api('/api/users/me/vision', { method: 'POST', body: { text: clean.visionSummary } });
          } catch (e) {
            console.warn('vision submit failed:', e && e.code);
          }
        }
        return;
      }
      if (CURRENT_IS_ADMIN) {
        let prev = (() => { try { return LAST_USERS[id] ? JSON.parse(LAST_USERS[id]) : (LAST_USERS[targetEmail] ? JSON.parse(LAST_USERS[targetEmail]) : null); } catch (e) { return null; } })();
        if (!prev) {
          // Target not in the last poll snapshot (e.g. registered seconds
          // ago, between polls): refresh the admin list once so the diff
          // below is computed against real state, not guessed.
          try {
            const lu = await api('/api/admin/users?limit=200', {});
            for (const dd of (lu.docs || [])) {
              if (dd && (dd.uid || dd.email)) LAST_USERS[dd.uid || dd.email] = JSON.stringify(dd);
            }
            prev = (() => { try { return LAST_USERS[id] ? JSON.parse(LAST_USERS[id]) : (LAST_USERS[targetEmail] ? JSON.parse(LAST_USERS[targetEmail]) : null); } catch (e) { return null; } })();
          } catch (e) { /* fall through to the no-baseline fallback */ }
        }
        const changed = (field) => {
          if (!prev) return false;
          return JSON.stringify(prev[field]) !== JSON.stringify(clean[field]);
        };
        const adminPath = '/api/admin/users/' + encodeURIComponent(id);
        // Diff-based precedence: only a field that actually changed routes.
        if (changed('status') && clean.status === 'approved') {
          await api(adminPath + '/approve', { method: 'POST', body: {} });
          return;
        }
        if (changed('status') && clean.status === 'rejected') {
          await api(adminPath + '/reject', { method: 'POST', body: {} });
          return;
        }
        if (changed('incomplete') && clean.incomplete && typeof clean.incomplete === 'object') {
          await api(adminPath + '/incomplete', { method: 'POST', body: { reason: clean.incomplete.reason || 'data', note: clean.incomplete.note || '' } });
          return;
        }
        if (changed('incomplete') && clean.incomplete === null) {
          await api(adminPath + '/clear-incomplete', { method: 'POST', body: {} });
          return;
        }
        if (changed('bookAccess') && typeof clean.bookAccess === 'boolean') {
          await api(adminPath + '/book-grant', { method: 'POST', body: { give: clean.bookAccess } });
          return;
        }
        if (!prev) {
          // No polled baseline (should not happen after an admin sign-in,
          // which always polls the users list): fall back to absolute
          // state for decisions only — bookAccess is excluded here because
          // a pre-existing grant would be mistaken for a new one.
          if (clean.status === 'approved') { await api(adminPath + '/approve', { method: 'POST', body: {} }); return; }
          if (clean.status === 'rejected') { await api(adminPath + '/reject', { method: 'POST', body: {} }); return; }
          if (clean.incomplete && typeof clean.incomplete === 'object') { await api(adminPath + '/incomplete', { method: 'POST', body: { reason: clean.incomplete.reason || 'data', note: clean.incomplete.note || '' } }); return; }
          if (clean.incomplete === null) { await api(adminPath + '/clear-incomplete', { method: 'POST', body: {} }); return; }
        }
        console.warn('admin users upsert without a recognised decision — skipped (not sent to /me/profile):', id);
        return;
      }
      console.warn('users upsert for another student from a non-admin context — skipped:', id);
      return;
    }
    if (collName === 'notifications') {
      // Admin-context fan-out (publish, invites, star invites, decision
      // messages) -> the admin notify endpoint (deterministic upsert).
      // NOTE: admin decision endpoints already create a system
      // notification, so a UI decision push lands as a SECOND, detailed
      // message — see PREVIEW-REPORT.md; the polish is to drop the
      // client push in adminApprove/adminReject/adminMarkIncomplete.
      // Own read-state (UI marks own items read on view) -> the read
      // endpoint, so it survives the next poll. Anything else from a
      // student context stays server-owned and is skipped.
      await ensureMe();
      if (CURRENT_IS_ADMIN) {
        if (clean.email && clean.title) {
          await api('/api/admin/notify', { method: 'POST', body: { doc: { id: clean.id || id, email: clean.email, title: clean.title, body: clean.body || '', kind: clean.kind || 'general', date: clean.date } } });
        } else {
          console.warn('admin notification without email/title skipped');
        }
        return;
      }
      if (clean.read === true) {
        await api('/api/notifications/' + encodeURIComponent(clean.id || id) + '/read', { method: 'POST', body: {} });
        return;
      }
      console.warn('notification upsert ignored (server-owned collection):', id);
      return;
    }
    if (collName === 'settings') {
      await api('/api/admin/settings/session', { method: 'PUT', body: { session: clean } });
      return;
    }
    if (collName === 'attendanceClaims') {
      // Old docs carried the typed code; the new API re-verifies it
      // server-side (window + registration + code). No code -> no-op.
      if (clean.sessionId && clean.code) {
        await api('/api/attendance/claim', { method: 'POST', body: { sessionId: clean.sessionId, code: clean.code } });
      } else {
        console.warn('attendanceClaims upsert without code/sessionId ignored (use the claim API)');
      }
      return;
    }
    if (collName === 'drafts') {
      await api('/api/users/me/drafts', { method: 'POST', body: { doc: clean } });
      return;
    }
    if (collName === 'transfers') {
      if (CURRENT_IS_ADMIN) await api('/api/admin/lists/transfers', { method: 'POST', body: { doc: clean } });
      else await api('/api/users/me/transfers', { method: 'POST', body: { doc: clean } });
      return;
    }
    if (collName === 'competitions') {
      if (CURRENT_IS_ADMIN) await api('/api/admin/lists/competitions', { method: 'POST', body: { doc: clean } });
      else await api('/api/users/me/competitions', { method: 'POST', body: { doc: clean } });
      return;
    }
    if (collName === 'messages') {
      if (CURRENT_IS_ADMIN) await api('/api/admin/lists/messages', { method: 'POST', body: { doc: clean } });
      else await api('/api/users/me/messages', { method: 'POST', body: { doc: clean } });
      return;
    }
    if (collName === 'starRecommendations') {
      await api('/api/star/recommend', { method: 'POST', body: { targetEmail: clean.email, note: clean.note || '' } });
      return;
    }
    if (collName === 'starRequests') {
      await api('/api/star/request', { method: 'POST', body: {} });
      return;
    }
    if (['news', 'announcements', 'jobs', 'courses', 'publications', 'journals', 'graduates', 'spotlights', 'courseContent', 'sessionAttendees'].includes(collName)) {
      await api('/api/content/' + collName, { method: 'POST', body: { doc: clean } });
      return;
    }
    if (['sessionArchive', 'counselLogs', 'courseSessions', 'starTeam', 'certificates', 'dashboardData'].includes(collName)) {
      await api('/api/admin/lists/' + collName, { method: 'POST', body: { doc: clean } });
      return;
    }
    // Server-owned or read-only collections (achievements,
    // sessionSecrets, mailQueue, admins): never written from the client.
    // Notifications have their own branch above (admin fan-out + own
    // read-state); everything else here is skipped, never faked.
    console.warn('upsert ignored for server-owned collection:', collName);
  },

  // Delete one admin-list doc (used by the dashboard raw-data form).
  // Same router-level auth as the list POST (requireAuth + requireAdmin).
  async removeFromList(collName, id) {
    await api('/api/admin/lists/' + encodeURIComponent(collName) + '/' + encodeURIComponent(id), { method: 'DELETE' });
  },

  startSubscriptions, stopSubscriptions,
};

// ---- push tokens: VAPID Web Push when configured, else honest no-op ----
// The old Firebase messaging worker is gone. If a VAPID public key is
// configured later (window.ILMI_VAPID_PUBLIC_KEY), this subscribes via
// the Push API and posts the subscription to /api/users/me/push-token.
// Until then it returns { ok:false, reason:'push-not-configured' } and the
// app's existing failure handling + in-app polling cover the bell.
window.__fcmStatus = { ready: false, push: 'not-configured' };
window.__fcmRegister = async function (uid) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported' };
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'perm', perm };
    const vapid = window.ILMI_VAPID_PUBLIC_KEY || '';
    if (!vapid) return { ok: false, reason: 'push-not-configured' };
    const reg = await navigator.serviceWorker.register('push-sw.js');
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapid });
    const token = JSON.stringify(sub);
    let saved = false;
    try {
      await api('/api/users/me/push-token', { method: 'POST', body: { token } });
      saved = true;
    } catch (e) { /* token exists but did not save */ }
    return { ok: true, token, saved, saveError: saved ? '' : 'save failed' };
  } catch (e) {
    return { ok: false, reason: 'error', detail: String((e && e.message) || e).slice(0, 180) };
  }
};
window.__fcmRegisterAdmin = async function (email) {
  const r = await window.__fcmRegister(null);
  if (!r || !r.ok) return r;
  return { ok: true, saved: r.saved, mirrored: false, token: r.token };
};

// ---- re-register panel on the login screen (the migration entry point) ----
function injectReRegisterPanel() {
  try {
    const loginBtn = document.querySelector('button[onclick="doLogin()"]');
    if (!loginBtn || document.getElementById('rereg-panel')) return;
    const wrap = document.createElement('div');
    wrap.id = 'rereg-panel';
    wrap.style.cssText = 'margin:12px 0;padding:12px;border:1px solid var(--c-gold-500,#c9a227);border-radius:12px;background:var(--c-gold-100,#fbf7ea)';
    wrap.innerHTML =
      '<p style="margin:0 0 8px;font-weight:bold">پرانا طالب علم؟ نئی ایپ میں پہلی بار لاگ ان</p>' +
      '<p class="small" style="margin:0 0 10px">اپنی <b>پرانی رجسٹرڈ ای میل</b> اور نیا پاس ورڈ اوپر والے خانوں میں لکھیں، پھر یہ بٹن دبائیں — پرانا ریکارڈ اور ہسٹری خود بحال ہو جائے گی۔</p>' +
      '<button class="btn" type="button" id="rereg-btn">پہلی بار نئی ایپ میں لاگ ان کریں</button>';
    loginBtn.insertAdjacentElement('afterend', wrap);
    document.getElementById('rereg-btn').addEventListener('click', async () => {
      const emailEl = document.getElementById('l-email');
      const passEl = document.getElementById('l-pass');
      const msgEl = document.getElementById('login-msg');
      const email = (emailEl && emailEl.value || '').trim().toLowerCase();
      const pass = (passEl && passEl.value) || '';
      const show = (t, ok) => { if (msgEl) { msgEl.textContent = t; } };
      if (!email || !pass) { show('ای میل اور نیا پاس ورڈ دونوں لکھیں۔', false); return; }
      if (pass.length < 8) { show('نیا پاس ورڈ کم از کم 8 حروف کا ہو۔', false); return; }
      show('دوبارہ رجسٹریشن ہو رہی ہے — چند لمحے انتظار کریں…', true);
      try {
        const r = await window.__fb.reRegister(email, pass);
        if (r.outcome === 'duplicate_email') {
          show('یہ ای میل ایک سے زیادہ ریکارڈز میں ہے — انتظامیہ سے رابطہ کریں۔', false);
          return;
        }
        if (r.outcome === 'already_migrated') {
          show('پاس ورڈ پہلے سے بنا ہوا ہے — سیدھا لاگ ان ہو رہا ہے…', true);
        } else if (r.outcome === 'migrated' && r.status === 'approved') {
          show('پاس ورڈ بن گیا — لاگ ان ہو رہا ہے…', true);
        } else if (r.outcome === 'migrated') {
          show('پاس ورڈ بن گیا — منظوری کے بعد رسائی کھلے گی۔ لاگ ان ہو رہا ہے…', true);
        } else {
          show('درخواست موصول — منظوری کے بعد رسائی کھلے گی۔ لاگ ان ہو رہا ہے…', true);
        }
        // Reuse the normal login path: it routes approved/pending/admin
        // exactly as the app already does.
        if (typeof window.doLoginOnline === 'function') await window.doLoginOnline(email, pass);
      } catch (e) {
        show('دوبارہ رجسٹریشن میں مسئلہ: ' + ((e && e.message) || e), false);
      }
    });
  } catch (e) { /* login view absent — nothing to inject */ }
}

// ---- persistent-session machinery (Mufti, 2026-10-31) ----
// A student who logged in once on a device must never be asked again on
// that device. Tokens already live in localStorage (ilmi_access /
// ilmi_refresh); what changes here is the RESTORE discipline:
//   * the stored refresh token is given up ONLY on the server's
//     definitive word — 401/403 with code 'bad_token' (revoked/expired);
//   * network failures, Render cold starts and proxy 5xx NEVER clear the
//     tokens — boot retries with backoff, then a background loop keeps
//     trying and routes the student in when the server answers;
//   * a localStorage timestamp lock + re-reading the CURRENT stored
//     token after the wait keeps two tabs from rotating against each
//     other (the server's 60s grace absorbs any residual race).
const TAB_ID = 'tab-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
const RLOCK_KEY = 'ilmi_refresh_lock';
function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function acquireRefreshLock() {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    let cur = null;
    try { cur = JSON.parse(localStorage.getItem(RLOCK_KEY) || 'null'); } catch (e) {}
    const now = Date.now();
    if (!cur || !cur.t || (now - cur.t) > 15000 || cur.id === TAB_ID) {
      try { localStorage.setItem(RLOCK_KEY, JSON.stringify({ id: TAB_ID, t: now })); } catch (e) { return false; }
      await sleepMs(120);
      let mine = null;
      try { mine = JSON.parse(localStorage.getItem(RLOCK_KEY) || 'null'); } catch (e) {}
      if (mine && mine.id === TAB_ID) return true;
    }
    await sleepMs(500);
  }
  return false;
}
function releaseRefreshLock() {
  try {
    const cur = JSON.parse(localStorage.getItem(RLOCK_KEY) || 'null');
    if (cur && cur.id === TAB_ID) localStorage.removeItem(RLOCK_KEY);
  } catch (e) {}
}

function isDefinitiveInvalid(e) {
  return !!e && (e.status === 401 || e.status === 403) && e.code === 'bad_token';
}

let REFRESH_INFLIGHT = null;
function refreshStoredSession() {
  if (REFRESH_INFLIGHT) return REFRESH_INFLIGHT;
  REFRESH_INFLIGHT = doRefreshStored().finally(() => { REFRESH_INFLIGHT = null; });
  return REFRESH_INFLIGHT;
}

// One stubborn refresh attempt against the CURRENT stored token.
// Returns {kind:'ok', data} | {kind:'invalid'} | {kind:'network', error}
// | {kind:'none'} (no token stored). Never clears tokens itself — the
// caller decides what a definitive 'invalid' means in its context.
async function doRefreshStored() {
  let rt = getRefresh();
  if (!rt) return { kind: 'none' };
  const locked = await acquireRefreshLock();
  try {
    // Another tab may have rotated while we waited for the lock — always
    // present the token that is stored NOW, not the one we started with.
    const cur = getRefresh();
    if (!cur) return { kind: 'none' };
    rt = cur;
    try {
      const r = await api('/api/auth/refresh', { method: 'POST', auth: false, body: { refreshToken: rt } });
      setTokens(r.accessToken, r.refreshToken);
      return { kind: 'ok', data: r };
    } catch (e) {
      if (isDefinitiveInvalid(e)) {
        // Last chance: storage may have changed between our read and the
        // call (a sibling tab rotated first). A different stored token
        // gets one try before the session is declared dead.
        const cur2 = getRefresh();
        if (cur2 && cur2 !== rt) {
          try {
            const r2 = await api('/api/auth/refresh', { method: 'POST', auth: false, body: { refreshToken: cur2 } });
            setTokens(r2.accessToken, r2.refreshToken);
            return { kind: 'ok', data: r2 };
          } catch (e2) {
            return isDefinitiveInvalid(e2) ? { kind: 'invalid' } : { kind: 'network', error: e2 };
          }
        }
        return { kind: 'invalid' };
      }
      return { kind: 'network', error: e };
    }
  } finally {
    if (locked) releaseRefreshLock();
  }
}

// Shared completion for boot + background restore: fetch the profile,
// start polling, hand the info object to the UI router (via the boot
// promise's resolve at boot, via a window event afterwards).
async function completeRestore(r, resolve) {
  let me = null;
  try { me = await fetchMe(); } catch (e) { me = null; }
  if (!me || !me.user) {
    // The refresh SUCCEEDED — the session is valid — but the profile
    // fetch failed transiently. Keep the session; routeOnline shows the
    // login screen with its honest message instead of signing out.
    const info = { online: true, authed: true, userDoc: null, isAdmin: false };
    if (resolve) resolve(info);
    else { try { window.dispatchEvent(new CustomEvent('ilmi-session-restored', { detail: info })); } catch (e) {} }
    return;
  }
  const userDoc = normDoc(me.user);
  const isAdmin = !!me.isAdmin;
  startSubscriptions({ uid: userDoc.uid, email: userDoc.email, isAdmin, approved: userDoc.status === 'approved' });
  const info = { online: true, authed: true, email: userDoc.email, isAdmin, userDoc };
  if (resolve) resolve(info);
  else { try { window.dispatchEvent(new CustomEvent('ilmi-session-restored', { detail: info })); } catch (e) {} }
}

let BG_RESTORE_TIMER = null;
function startBackgroundRestore(rt0) {
  if (BG_RESTORE_TIMER) return;
  let tries = 0;
  BG_RESTORE_TIMER = setInterval(async () => {
    tries++;
    // Abandon quietly if the session changed under us (manual login or
    // logout in this or another tab changed the stored token), if a
    // session is already live, or after ~9 minutes of trying.
    if (CURRENT_USER || getRefresh() !== rt0 || tries > 12) {
      clearInterval(BG_RESTORE_TIMER); BG_RESTORE_TIMER = null; return;
    }
    const out = await refreshStoredSession();
    if (out.kind === 'ok') {
      clearInterval(BG_RESTORE_TIMER); BG_RESTORE_TIMER = null;
      await completeRestore(out.data, null);
    } else if (out.kind === 'invalid') {
      clearInterval(BG_RESTORE_TIMER); BG_RESTORE_TIMER = null;
      clearTokens();
    }
  }, 45000);
}

// Keep a RUNNING session alive past the access token's hour: when the
// stored access token is expired (or within 2 minutes of it) the 60s
// poll refreshes it silently instead of letting every feed start 401ing.
function accessExpMs() {
  const a = getAccess();
  if (!a) return 0;
  try {
    const seg = a.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const p = JSON.parse(atob(seg));
    return (p.exp || 0) * 1000;
  } catch (e) { return 0; }
}
async function ensureFreshAccess() {
  try {
    if (!getRefresh()) return;
    const exp = accessExpMs();
    if (exp && exp - Date.now() > 120000) return;
    await refreshStoredSession(); // outcome ignored — the poll retries in a minute
  } catch (e) {}
}

// ---- boot: restore session from refresh token, then resolve __fbBoot ----
(async function boot() {
  const resolve = window.__fbResolve || function () {};
  if (!API_BASE) {
    // No backend configured yet: offline demo fallback, same as the old
    // build when Firebase failed to start.
    resolve({ online: false, error: 'API_BASE not configured (see frontend/config.js)' });
    return;
  }
  try {
    injectReRegisterPanel();
  } catch (e) {}
  const rt0 = getRefresh();
  if (!rt0) {
    resolve({ online: true, authed: false });
    return;
  }
  // Stubborn silent restore: paced retries now; if the network/server is
  // still unreachable, the tokens STAY and a background loop keeps
  // restoring quietly — the login screen appears only on a definitive
  // server rejection (or when no token was ever stored).
  let out = null;
  const delays = [0, 4000, 10000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleepMs(delays[i]);
    out = await refreshStoredSession();
    if (out.kind !== 'network') break;
  }
  if (out.kind === 'ok') { await completeRestore(out.data, resolve); return; }
  if (out.kind === 'invalid') {
    clearTokens();
    resolve({ online: true, authed: false });
    return;
  }
  if (out.kind === 'none') { resolve({ online: true, authed: false }); return; }
  resolve({ online: true, authed: false, restorePending: true });
  startBackgroundRestore(rt0);
})();
