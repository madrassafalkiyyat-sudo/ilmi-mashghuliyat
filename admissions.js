/* =====================================================================
   داخلہ جات (Admissions hub — Phase 2)
   ---------------------------------------------------------------------
   - ملکی ڈیٹا admissions-data.js سے، غیر ملکی (بنیادی) foreign-basic.js
     سے، خبریں admissions-news.js سے — کوئی رقم/تاریخ گھڑی نہیں گئی،
     خالی خانہ دکھایا ہی نہیں جاتا — صرف وہ معلومات نظر آتی ہیں جو واقعی موجود ہیں۔
   - غیر ملکی مکمل تفصیل (پروگرام، اہلیت، فیس) سرکاری پیجز سے تحقیق میں
     ہے؛ مکمل ہوتے ہی یہی فائل امیر ڈیٹا سے بدل جائے گی۔
   - آخری تاریخوں کی پٹی دستی (manual) اسکرول ہے — کوئی آٹو ٹکر نہیں۔
   - واٹس ایپ نمبر/گروپ صرف اپلائی مرحلے (تفصیل + اپلائی فارم) میں ہیں —
     داخلہ/معلومات اسکرینوں پر کبھی نہیں۔
   - ایپ بیرونی یونیورسٹی فارم کی تصدیق نہیں کر سکتی — اپلائی ریکارڈ
     «خود اعلان کردہ» (self-declared) ہوتا ہے، یہ بات UI میں صاف لکھی ہے۔
   ===================================================================== */
(function () {
  'use strict';
  var DATA = window.ADMISSIONS_DATA;
  var FOREIGN = window.FOREIGN_DATA;
  var NEWS = window.ADMISSIONS_NEWS;
  var SCRIPT_URL = window.ADMISSIONS_SCRIPT_URL || '';
  var WA_NUMBER = window.ADMISSIONS_WHATSAPP_NUMBER || '';
  var WA_GROUP = window.ADMISSIONS_WHATSAPP_GROUP_URL || '';
  var PREP_URL = window.ADMISSIONS_TEST_PREP_URL || '';
  var state = { disc: null, level: 'تمام', current: null, pk: [], foreign: [], scope: 'pk', section: null };
  var SECTIONS = [
    ['unis', '🎓 یونیورسٹیز داخلے'],
    ['scholarships', '🎓 سکالرشپس'],
    ['jobs', '💼 ملازمتیں و مواقع'],
    ['calendar', '📅 داخلہ کیلنڈر'],
    ['tests', '📝 انٹری ٹیسٹ کی معلومات']
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function isUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
  }
  function link(u, label) {
    if (!isUrl(u)) return '';
    return '<a href="' + esc(u.trim()) + '" target="_blank" rel="noopener" ' +
      'style="color:var(--c-primary-700);font-weight:bold">' + esc(label) + '</a>';
  }
  /* فارم ساتھی (Part F): اپلائی/فارم نوعیت کے لنک سیدھے باہر جانے کی بجائے
     ایپ کے اندر Muse رہنما میں کھلتے ہیں — مرکزی اسکرپٹ کا ffRegister/ffGo
     استعمال ہوتا ہے؛ دستیاب نہ ہو تو پرانا براہ راست لنک ہی رہتا ہے۔ */
  function ffAnchor(opts, label, style, cls) {
    if (!isUrl(opts.url)) return '';
    /* class کا اصول (Part 5 درستی، مفتی 2026-10-31): 'btn' صرف اس وقت
       جب کالر نے class دیا ہی نہ ہو۔ کالر نے '' دیا ہو تو اس کا مطلب
       ہے «میرا اپنا اسٹائل کافی ہے» — پہلے '' بھی 'btn' بن جاتا تھا،
       جس سے پراسپیکٹس/ٹیسٹ لنک کو .btn کا گہرا سبز پس منظر ملتا اور
       اسی کا اپنا گہرا سبز متن اس پر ناقابلِ مطالعہ ہو جاتا تھا۔ */
    var c = (cls === undefined || cls === null) ? 'btn' : cls;
    if (typeof window !== 'undefined' && window.ffRegister) {
      var k = window.ffRegister(opts);
      return '<a class="' + c + '" style="' + (style || '') + '" href="#" onclick="ffGo(\'' + k + '\');return false">' + label + '</a>';
    }
    return '<a class="' + c + '" style="' + (style || '') + '" href="' + esc(opts.url) + '" target="_blank" rel="noopener">' + label + '</a>';
  }
  function val(v) {
    return (v && String(v).trim()) ? esc(v) : '';
  }
  function row(label, html) {
    if (!html) return '';
    return '<p style="margin:4px 0"><b>' + esc(label) + ':</b> ' + html + '</p>';
  }
  function el(id) { return document.getElementById(id); }

  function chip(label, active, onclick) {
    var bg = active ? 'var(--c-primary-700)' : 'var(--c-card)';
    var fg = active ? '#fff' : 'var(--c-ink)';
    return '<button type="button" onclick="' + onclick + '" style="display:inline-block;width:auto;margin:2px;padding:6px 14px;border-radius:999px;border:1px solid var(--c-border);background:' + bg + ';color:' + fg + ';font-family:inherit;font-size:17px;cursor:pointer">' + esc(label) + '</button>';
  }

  function discOf(u) {
    if (u.disciplines && u.disciplines.length) return u.disciplines.join('، ');
    if (u.attributes && u.attributes['بی ایس پروگرامز']) return u.attributes['بی ایس پروگرامز'];
    return '';
  }

  /* شعبہ وار ترتیب (Mufti 2026-10-29): ملکی/غیر ملکی چننے پر پہلے صرف
     شعبہ جات کے چھوٹے بٹن نظر آتے ہیں؛ کسی شعبے پر کلک ہو تو اس کی
     یونیورسٹیز + لیول فلٹر کھلتے ہیں۔ */
  function renderChips() {
    var discs = ['تمام'].concat(DATA.disciplines || []);
    var levels = ['تمام', 'BS', 'MS/MPhil', 'PhD'];
    el('adm-disc').innerHTML = discs.map(function (d) {
      return chip(d, state.disc === d, "admSetDisc('" + d + "')");
    }).join('');
    var showLevel = !!state.disc;
    el('adm-level').innerHTML = showLevel ? levels.map(function (l) {
      return chip(l, state.level === l, "admSetLevel('" + l + "')");
    }).join('') : '';
    var lh = el('adm-level-head'); if (lh) lh.style.display = showLevel ? '' : 'none';
  }

  function curList() {
    return state.scope === 'foreign' ? state.foreign : state.pk;
  }

  function filtered() {
    return curList().filter(function (u) {
      var dok = state.disc === 'تمام' || (u.disciplines || []).indexOf(state.disc) !== -1;
      var lok = state.level === 'تمام' || u.level === state.level;
      return dok && lok;
    });
  }

  /* زیلی بٹنز (Mufti 2026-10-29): یونیورسٹیز داخلے کے اندر دو واضح بٹن —
     ملکی یونیورسٹیز / غیر ملکی یونیورسٹیز — چھوٹی گولیوں کی جگہ */
  function renderScope() {
    function sub(label, active, onclick) {
      return '<button type="button" onclick="' + onclick + '" style="flex:1;padding:12px 8px;border-radius:12px;border:1px solid ' + (active ? 'var(--c-gold-500)' : 'var(--c-border)') + ';background:' + (active ? 'var(--c-gold-100)' : 'var(--c-card)') + ';font-family:inherit;font-size:17px;font-weight:bold;cursor:pointer">' + label + '</button>';
    }
    el('adm-scope').innerHTML = '<div style="display:flex;gap:10px">' +
      sub('🇵🇰 ملکی یونیورسٹیز', state.scope === 'pk', "admSetScope('pk')") +
      sub('🌍 غیر ملکی یونیورسٹیز', state.scope === 'foreign', "admSetScope('foreign')") + '</div>';
  }

  window.admSetScope = function (s) {
    state.scope = s; state.disc = null; state.level = 'تمام';
    renderScope(); renderChips(); renderList();
  };

  function renderList() {
    if (!state.disc) {
      el('adm-count').textContent = '';
      el('adm-list').innerHTML =
        '<div style="border:1px dashed var(--c-border);border-radius:12px;padding:12px;background:var(--c-card)">' +
        '<p class="small" style="margin:0">اوپر کسی شعبے پر کلک کریں تو اس کی یونیورسٹیز یہاں کھلیں گی — «تمام» پر کلک کریں تو پوری فہرست کھلے گی۔</p></div>';
      return;
    }
    var list = filtered();
    var groups = [], byName = {};
    list.forEach(function (u) {
      if (!byName[u.name]) { byName[u.name] = { name: u.name, entries: [] }; groups.push(byName[u.name]); }
      byName[u.name].entries.push(u);
    });
    window.__admGroups = groups;
    el('adm-count').textContent = groups.length + ' یونیورسٹیز ملیں';
    if (!groups.length) {
      el('adm-list').innerHTML =
        '<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;background:var(--c-card)">' +
        '<p style="margin:0"><b>اس انتخاب کے لیے کوئی اندراج نہیں ملا۔</b></p>' +
        '<p class="small" style="margin:6px 0 0">شعبہ جات یا لیول بدل کر دیکھیں، یا «تمام» چن کر پوری فہرست دیکھیں۔ ' +
        'فیس/اہلیت کی حتمی تصدیق ہمیشہ یونیورسٹی کی سرکاری ویب سائٹ سے کریں۔</p></div>';
      return;
    }
    var note = '';
    if (state.scope === 'foreign') {
      note = '<div style="border:1px solid var(--c-gold-500);border-radius:12px;padding:10px;margin:8px 0;background:var(--c-gold-100)">' +
        '<p class="small" style="margin:0">غیر ملکی یونیورسٹیز کی تفصیل: 19 یونیورسٹیز کے پروگرامز/فیکلٹیز سرکاری پیجز سے آ گئے ہیں؛ ' +
        'صرف المصطفی کی مکمل تفصیل ابھی تحقیق میں ہے (اس کی سرکاری سائٹ پر پروگرام لسٹ نہیں ملی) — اس کا سرکاری لنک یہاں موجود ہے۔</p></div>';
    }
    el('adm-list').innerHTML = note + groups.map(function (g, gi) {
      var first = g.entries[0];
      var levels = [];
      var discs = [];
      g.entries.forEach(function (e) {
        if (e.level && levels.indexOf(e.level) < 0) levels.push(e.level);
        (e.disciplines || []).forEach(function (d) { if (discs.indexOf(d) < 0) discs.push(d); });
      });
      var meta = [first.sector, first.city].filter(Boolean).join(' • ');
      return '<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;margin:8px 0;background:var(--c-card)">' +
        '<p style="margin:0;font-weight:bold;font-size:1.05em">' + esc(g.name) + '</p>' +
        (meta ? '<p class="small" style="margin:2px 0">' + esc(meta) + '</p>' : '') +
        (levels.length ? '<p class="small" style="margin:2px 0">' + esc(levels.join(' • ')) + '</p>' : '') +
        (discs.length ? '<p class="small" style="margin:2px 0">' + esc(discs.join('، ')) + '</p>' : '') +
        '<p class="small" style="margin:2px 0">' + g.entries.length + ' پروگرامز</p>' +
        '<button class="btn" style="margin-top:8px" onclick="admShowUni(' + gi + ')">تفصیل دیکھیں</button></div>';
    }).join('');
  }

  window.admSetDisc = function (d) { state.disc = d; renderChips(); renderList(); };
  window.admSetLevel = function (l) { state.level = l; renderChips(); renderList(); };

  window.admShowUni = function (gi) {
    var g = window.__admGroups && window.__admGroups[gi];
    if (!g) return;
    var entries = g.entries;
    var first = entries[0];
    state.current = { name: g.name, level: '', disciplines: [] };
    var pick = function (f) {
      for (var k = 0; k < entries.length; k++) if (entries[k][f]) return entries[k][f];
      return '';
    };
    var pickAttr = function (k) {
      for (var k2 = 0; k2 < entries.length; k2++) {
        if (entries[k2].attributes && entries[k2].attributes[k]) return entries[k2].attributes[k];
      }
      return '';
    };
    var html = '<h1 style="font-size:1.25em">' + esc(g.name) + '</h1>';
    html += '<p class="small" style="margin:0 0 8px">' +
      [first.sector, first.city, (first.country && first.country !== 'پاکستان') ? first.country : ''].filter(Boolean).map(esc).join(' • ') + '</p>';
    html += '<div class="divider"></div>';
    html += row('فون', val(pick('phone')));
    html += row('آن لائن سہولت', val(pick('onlineFacility')));
    html += row('داخلہ (سال میں)', val(pick('admissionFrequency')));
    var levelOrder = { 'بی ایس': 0, 'ایم ایس / ایم فل': 1, 'پی ایچ ڈی': 2 };
    var sorted = entries.slice().sort(function (a, b) {
      var la = (levelOrder[a.level] === undefined) ? 9 : levelOrder[a.level];
      var lb = (levelOrder[b.level] === undefined) ? 9 : levelOrder[b.level];
      return la - lb;
    });
    sorted.forEach(function (u) {
      html += '<div style="border:1px solid var(--c-border);border-radius:12px;padding:10px;margin:10px 0;background:var(--c-card)">';
      html += '<p style="margin:0;font-weight:bold">' + [u.level, discOf(u)].filter(Boolean).map(esc).join(' • ') + '</p>';
      html += row('شعبے / پروگرامز', val(u.fields || (u.attributes && u.attributes['بی ایس پروگرامز'])));
      html += row('دورانیہ', val(u.duration));
      html += row('اہلیت', val(u.eligibility));
      html += row('کلاس ایام', val(u.classDays));
      html += row('کلاس اوقات', val(u.classTimings));
      html += row('داخلہ تاریخ', val(u.admissionDates));
      html += row('انٹری ٹیسٹ زبان', val(u.testLanguage));
      html += row('انٹری ٹیسٹ نوع', val(u.testType));
      html += row('ٹیسٹ معلومات / مواد', u.testLink ? ffAnchor({ title: g.name + ' — انٹری ٹیسٹ', url: String(u.testLink).trim().replace(/ /g, '%20'), sourceLabel: 'انٹری ٹیسٹ' }, '📝 ' + esc(u.testLinkLabel || 'ٹیسٹ معلومات / مواد'), 'color:var(--c-primary-700);font-weight:bold', '') : '');
      var pl = row('شعبہ کا صفحہ', link(u.deptLink, 'شعبہ کا صفحہ')) +
        row('فیس نوٹیفیکیشن', link(u.feeLink, 'فیس نوٹیفیکیشن'));
      if (pl) html += '<div style="margin-top:6px">' + pl + '</div>';
      html += '</div>';
    });
    var seenContacts = {};
    var allContacts = [];
    entries.forEach(function (u) {
      (u.contacts || []).forEach(function (c) {
        var key = (c.person || '') + '|' + (c.number || '');
        if (!seenContacts[key]) { seenContacts[key] = true; allContacts.push(c); }
      });
    });
    if (allContacts.length) {
      html += '<p style="margin:8px 0 2px"><b>رابطہ افراد (شیٹ کے مطابق):</b></p>';
      allContacts.forEach(function (c) {
        html += '<p style="margin:2px 0">' + esc(c.person || '—') +
          (c.number ? ' — ' + esc(c.number) : '') + '</p>';
      });
    }
    var seenAttrs = {};
    entries.forEach(function (u) {
      if (!u.attributes) return;
      Object.keys(u.attributes).forEach(function (k) {
        if (k === 'بی ایس پروگرامز' || k === 'داخلہ فارم / پورٹل' || seenAttrs[k]) return;
        seenAttrs[k] = true;
        var v = u.attributes[k];
        html += row(k, isUrl(v) ? link(v, 'لنک کھولیں') : val(v));
      });
    });
    var linksHtml = row('ویب سائٹ', link(pick('website'), 'یونیورسٹی ویب سائٹ')) +
      row('داخلہ فارم / پورٹل', link(pickAttr('داخلہ فارم / پورٹل'), 'لنک کھولیں')) +
      row('سکالرشپ تفصیل', link(pick('scholarshipLink'), 'سکالرشپ تفصیل')) +
      row('فیس بک', link(pick('facebook'), 'فیس بک پیج')) +
      row('داخلہ ویڈیو', link(pick('videoLink'), 'داخلہ ویڈیو'));
    if (linksHtml) {
      html += '<div class="divider"></div><p style="margin:0 0 4px"><b>سرکاری لنکس</b></p>' + linksHtml;
    }
    html += '<p class="small" style="margin:8px 0 0">فیس کی رقم فیس نوٹیفیکیشن یا یونیورسٹی ویب سائٹ سے تصدیق کریں۔</p>';
    var applyUrl = pickAttr('داخلہ فارم / پورٹل') || pick('deptLink') || pick('website');
    var applyNote = pickAttr('داخلہ فارم / پورٹل')
      ? 'داخلہ فارم / پورٹل کھلے گا۔'
      : (pick('deptLink')
        ? 'شعبہ کا صفحہ کھلے گا — ایڈمیشن فارم وہیں ملے گا۔'
        : 'یونیورسٹی کی ویب سائٹ کھلے گی — ایڈمیشن فارم وہیں تلاش کریں۔');
    html += '<div style="margin:14px 0;padding:12px;border:1px solid var(--c-gold-500);border-radius:12px;background:var(--c-gold-100)">' +
      '<p style="margin:0 0 4px;font-weight:bold">📝 اپلائی کریں</p>' +
      '<p class="small" style="margin:0 0 10px">' + esc(applyNote) + '</p>';
    if (isUrl(applyUrl)) {
      html += ffAnchor({ title: g.name + ' — ایڈمیشن فارم', url: applyUrl.trim(), sourceLabel: 'یونیورسٹی داخلہ جات' }, '📝 Muse کے ساتھ ایڈمیشن فارم بھریں', 'display:block;text-align:center;text-decoration:none;padding:12px', 'btn goldb');
    }
    html += '<div style="margin-top:12px;border-top:1px dashed var(--c-gold-500);padding-top:10px">' +
      '<p style="margin:0 0 6px"><b>اپلائی میں مدد چاہیے؟</b></p>';
    if (WA_NUMBER) {
      html += '<a class="btn" style="display:block;text-align:center;text-decoration:none;margin:4px 0" href="https://wa.me/' + WA_NUMBER + '" target="_blank" rel="noopener">📱 واٹس ایپ پر مدد لیں</a>';
    }
    if (WA_GROUP) {
      html += '<a class="btn" style="display:block;text-align:center;text-decoration:none;margin:4px 0" href="' + esc(WA_GROUP) + '" target="_blank" rel="noopener">👥 واٹس ایپ گروپ جوائن کریں</a>';
    }
    html += '</div></div>';
    html += '<button class="btn goldb" style="margin-top:12px" onclick="admApplyFromDetail()">✅ میں نے اپلائی کر دیا — ریکارڈ درج کریں</button>' +
      '<p class="small" style="margin:6px 0 0">یہ ریکارڈ خود اعلان کردہ ہو گا — ' +
      'یونیورسٹی کا بیرونی فارم ایپ خود تصدیق نہیں کر سکتی۔</p>';
    el('adm-detail').innerHTML = html;
    go('admissions-detail');
  };

  window.admApplyFromDetail = function () {
    var u = state.current;
    if (!u) { go('admissions'); return; }
    var sel = el('ap-university');
    if (sel) sel.value = u.name;
    var lv = el('ap-level'); if (lv) lv.value = u.level || '';
    var dc = el('ap-discipline');
    if (dc) dc.value = (u.disciplines && u.disciplines[0]) || '';
    var pr = el('ap-program');
    if (pr) pr.value = [u.level, discOf(u)].filter(Boolean).join(' — ');
    go('admissions-apply');
  };

  function fillUniversitySelects() {
    var all = state.pk.concat(state.foreign);
    var seen = {}, uniq = [];
    all.forEach(function (u) { if (!seen[u.name]) { seen[u.name] = true; uniq.push(u); } });
    var opts = '<option value="">ابھی منتخب نہیں کی</option>' +
      uniq.map(function (u) {
        return '<option value="' + esc(u.name) + '">' + esc(u.name) + '</option>';
      }).join('');
    var a = el('af-university'); if (a) a.innerHTML = opts;
    var b = el('ap-university');
    if (b) b.innerHTML = '<option value="">— یونیورسٹی چنیں —</option>' +
      uniq.map(function (u) {
        return '<option value="' + esc(u.name) + '">' + esc(u.name) + '</option>';
      }).join('');
  }

  /* ---- PROFILE AUTOFILL (Part 7): لاگ ان طالب علم کے اپنے فارم
     (اپلائی تصدیق + آسان رجسٹریشن) اس کے علمی مشغولیت پروفائل سے خود
     بھر جائیں۔ اصول: جو خانہ طالب علم اس وزٹ میں خود چھیڑ چکا ہو
     (dirty) یا جس میں پہلے سے کچھ لکھا ہو، اسے کبھی نہیں چھوا جاتا۔
     مہمان (guest) کو فارم آج کی طرح خالی ملتا ہے۔ ---- */
  var ADM_PREFILL_BOUND = false;
  var ADM_EASY_FIELDS_DIRTY = false;
  function admProfileValue(u, keys) {
    if (!u) return '';
    var p = (u.profile && typeof u.profile === 'object') ? u.profile : {};
    for (var i = 0; i < keys.length; i++) {
      var v = u[keys[i]];
      if (typeof v === 'string' && v.trim()) return v.trim();
      v = p[keys[i]];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  }
  function admSetPrefill(id, value) {
    var e = el(id);
    if (!e || !value) return;
    if (e.dataset && e.dataset.admDirty === '1') return; // طالب علم خود لکھ چکا ہے
    if (e.value) return; // پہلے سے بھرا ہوا (مثلاً تفصیل سے آیا ہوا) نہ چھیڑیں
    if (e.tagName === 'SELECT' && e.options) {
      var found = false;
      for (var i = 0; i < e.options.length; i++) if (e.options[i].value === value) { found = true; break; }
      if (!found) return;
    }
    e.value = value;
  }
  function admBindPrefillDirty() {
    if (ADM_PREFILL_BOUND) return;
    ADM_PREFILL_BOUND = true;
    ['ap-name', 'ap-cnic', 'ap-mobile', 'ap-email', 'ap-university', 'ap-program', 'ap-level', 'ap-discipline',
     'af-gmail', 'af-name', 'af-madrasa', 'af-occupation', 'af-whatsapp', 'af-email', 'af-degrees', 'af-university'
    ].forEach(function (id) {
      var e = el(id);
      if (!e) return;
      var mark = function () { e.dataset.admDirty = '1'; };
      e.addEventListener('input', mark);
      e.addEventListener('change', mark);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.adm-f-check'), function (c) {
      c.addEventListener('change', function () { ADM_EASY_FIELDS_DIRTY = true; });
    });
  }
  window.admPrefillApplyForm = function () {
    var u = (typeof currentUser === 'function') ? currentUser() : null;
    if (!u) return; // مہمان: خالی فارم
    admBindPrefillDirty();
    admSetPrefill('ap-name', admProfileValue(u, ['name']));
    admSetPrefill('ap-cnic', admProfileValue(u, ['cnic']));
    admSetPrefill('ap-mobile', admProfileValue(u, ['mobile', 'whatsapp']));
    admSetPrefill('ap-email', admProfileValue(u, ['email']));
    admSetPrefill('ap-university', admProfileValue(u, ['uni', 'university']));
    admSetPrefill('ap-program', admProfileValue(u, ['degree']));
    admSetPrefill('ap-discipline', admProfileValue(u, ['dept']));
    var deg = admProfileValue(u, ['degree']);
    var lvl = /ph\.?d|پی ایچ ڈی/i.test(deg) ? 'PhD' : /(m\.?phil|ms|ایم فل)/i.test(deg) ? 'MS/MPhil' : /\bbs\b|بی ایس/i.test(deg) ? 'BS' : '';
    admSetPrefill('ap-level', lvl);
  };
  window.admPrefillEasyForm = function () {
    var u = (typeof currentUser === 'function') ? currentUser() : null;
    if (!u) return;
    admBindPrefillDirty();
    admSetPrefill('af-gmail', admProfileValue(u, ['email']));
    admSetPrefill('af-name', admProfileValue(u, ['name']));
    admSetPrefill('af-madrasa', admProfileValue(u, ['madrasa']));
    admSetPrefill('af-whatsapp', admProfileValue(u, ['whatsapp', 'mobile']));
    var alt = (u.profile && typeof u.profile.email === 'string') ? u.profile.email.trim() : '';
    if (alt && alt !== (u.email || '')) admSetPrefill('af-email', alt);
    admSetPrefill('af-degrees', admProfileValue(u, ['degree']));
    admSetPrefill('af-university', admProfileValue(u, ['uni', 'university']));
    if (!ADM_EASY_FIELDS_DIRTY) {
      var dept = admProfileValue(u, ['dept']);
      var map = [[/islamic|اسلامی/i, 'اسلامک سٹڈیز'], [/arab|عربی/i, 'عربی'], [/bank|بینک/i, 'اسلامک بینکنگ'], [/education|تعلیم/i, 'ایجوکیشن'], [/psych|نفسیات/i, 'سائیکالوجی']];
      for (var i = 0; i < map.length; i++) {
        if (map[i][0].test(dept)) {
          Array.prototype.forEach.call(document.querySelectorAll('.adm-f-check'), function (c) {
            if (c.value === map[i][1] && !c.checked) c.checked = true;
          });
          break;
        }
      }
    }
  };

  /* ---- Phase 2 sections: strip, scholarships, jobs, calendar, tests ---- */

  function newsItems() {
    return (NEWS && NEWS.items) || [];
  }

  function catLabel(c) {
    return c === 'scholarship' ? '🎓 سکالرشپ' : c === 'job' ? '💼 ملازمت' :
      c === 'admission' ? '📢 داخلہ' : c === 'conference' ? '🎤 کانفرنس' : '📰 خبر';
  }

  /* ڈیزائن شدہ کور — index.html کے newsCoverHtml کا عکس (مفتی 2026-10-31): صرف وہ
     سکالرشپ جس کا آفیشل پوسٹر (img) نہ ملا ہو۔ آفیشل پوسٹر ہمیشہ پہلے؛ جو سکالرشپ
     بعد میں تصدیق شدہ آفیشل پوسٹر پا لے وہ خودکار اصل پوسٹر پر چلی جاتی ہے۔
     کور ایپ کا اپنا ڈیزائن ہے — آفیشل اشتہار کی نقل نہیں۔ */
  function coverDeadline(it) {
    var d = String(it.deadlineText || it.deadline || '').trim();
    if (!d) return '';
    if (d.indexOf('آخری تاریخ') === -1) d = 'آخری تاریخ: ' + d;
    return d;
  }
  function coverHtml(it) {
    var dl = coverDeadline(it);
    return '<div class="nd-cover" role="img" aria-label="' + esc(it.title || 'سکالرشپ') + '">' +
      '<div class="cv-eyebrow">🎓 سکالرشپ</div>' +
      '<div class="cv-title">' + esc(it.title || '') + '</div>' +
      (dl ? '<span class="cv-chip">⏰ ' + esc(dl) + '</span>' : '') +
      '<div class="cv-mark">علمی مشغولیت</div></div>';
  }

  function newsCard(it) {
    var body = '<p style="margin:0;font-weight:bold">' + esc(it.title) + '</p>' +
      '<p class="small" style="margin:4px 0">' + catLabel(it.cat) + ' • ' + esc(it.org || '') +
      (it.deadlineText ? ' • ' + esc(it.deadlineText) : '') + '</p>';
    if (it.details) body += '<p class="small" style="margin:4px 0">' + esc(it.details) + '</p>';
    if (isUrl(it.link)) body += ffAnchor({ title: it.title, url: it.link.trim(), sourceLabel: 'داخلہ جات — ' + catLabel(it.cat) }, '📝 Muse کے ساتھ کھولیں', 'display:inline-block;text-align:center;text-decoration:none;margin-top:6px;padding:8px 16px');
    var h = '<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;margin:8px 0;background:var(--c-card)">';
    // سرکاری پوسٹر (Part A-addendum, Mufti 2026-10-31): مرکزی خبر کی تفصیل
    // والا ہی اصول و لے آؤٹ — .nd-flex: فون پر پوسٹر اوپر، ڈیسک ٹاپ پر متن کے
    // پہلو میں کالم؛ خراب تصویر خود خاموشی سے ہٹ جاتی ہے، کوئی پلیس ہولڈر نہیں۔
    if (it.img) {
      h += '<div class="nd-flex"><div class="nd-poster"><img src="' + esc(it.img) + '" alt="' + esc(it.title || '') + '" loading="lazy" onerror="var p=this.closest(\'.nd-poster\');if(p)p.remove();" style="display:block;width:100%;border:1px solid var(--c-border);border-radius:10px"></div><div class="nd-text">' + body + '</div></div>';
    } else if (it.cat === 'scholarship') {
      // آفیشل پوسٹر نہ ملنے والی سکالرشپ: اسی پوسٹر خانے میں ایپ کا ڈیزائن شدہ کور
      h += '<div class="nd-flex"><div class="nd-poster">' + coverHtml(it) + '</div><div class="nd-text">' + body + '</div></div>';
    } else {
      h += body;
    }
    return h + '</div>';
  }

  /* مربع ٹائلز (Mufti 2026-10-29): اوپر نیچے کی بجائے 3 کالم × 2 قطاریں،
     ساتھ ساتھ — جگہ کم گھیرتے ہیں؛ نیچے والے جملے (سب ٹائٹل) حذف۔ */
  function renderSecButtons() {
    el('adm-sections').innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:560px;margin:0 auto">' +
      SECTIONS.map(function (s) {
        var open = state.section === s[0];
        var parts = s[1].split(' ');
        var emoji = parts[0];
        var title = parts.slice(1).join(' ');
        return '<button type="button" onclick="admSection(\'' + s[0] + '\')" style="aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px 6px;border-radius:16px;border:1px solid ' + (open ? 'var(--c-gold-500)' : 'var(--c-border)') + ';background:' + (open ? 'var(--c-gold-100)' : 'var(--c-card)') + ';font-family:inherit;cursor:pointer;text-align:center">' +
          '<span style="font-size:26px;line-height:1">' + esc(emoji) + '</span>' +
          '<span style="display:block;font-size:16px;font-weight:bold;line-height:1.4">' + esc(title) + '</span>' +
          '<span style="font-size:14px;line-height:1">' + (open ? '⌃' : '⌄') + '</span></button>';
      }).join('') + '</div>';
  }

  /* سیکشن فل اسکرین (Mufti 2026-10-29): بٹن پر کلک ہو تو ہب کی باقی چیزیں
     (پٹی، ٹائلز، تعارف، رجسٹریشن بٹن) غائب — صرف اس سیکشن کا انٹرفیس نظر آتا
     ہے، نیچے اسکرول کر کے نہیں کھلتا۔ واپسی سیکشن کے «ہب پر واپس» بٹن سے۔ */
  window.admSection = function (sec) {
    state.section = (sec === state.section) ? null : sec;
    renderSecButtons();
    var hub = (state.section === null);
    ['adm-strip', 'adm-sections', 'adm-hub-intro', 'adm-hub-foot', 'adm-hub-switch', 'adm-hub-help'].forEach(function (id) {
      var e = el(id);
      if (e) e.style.display = hub ? '' : 'none';
    });
    SECTIONS.forEach(function (s) {
      var d = el('adm-sec-' + s[0]);
      if (d) d.style.display = (s[0] === state.section) ? '' : 'none';
    });
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  };

  /* آخری تاریخوں کی پٹی — ایک ہی قطار، ہر خبر ایک لائن (Mufti 2026-10-29):
     بڑے کارڈز کی جگہ باریک پٹی: لیبل + کونوں پر ایرو بٹن + اسکرول ہونے والی
     ایک لائنی چپس۔ ایرو scrollIntoView سے چلتے ہیں (RTL میں scrollLeft کی
     علامت براؤزر بہ براؤزر بدلتی ہے، اس لیے اس پر بھروسہ نہیں)؛ انگلی سے
     سوائپ بھی ویسے ہی کام کرتا ہے۔ کوئی آٹو حرکت نہیں۔ */
  function renderStrip() {
    var box = el('adm-strip');
    if (!box) return;
    var dated = newsItems().filter(function (it) { return it.deadline; })
      .sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; });
    if (!dated.length) { box.style.display = 'none'; return; }
    var chips = dated.map(function (it) {
      var label = catLabel(it.cat) + ' ' + it.title + ' • آخری تاریخ: ' + (it.deadlineText || it.deadline);
      var clickable = isUrl(it.link);
      return '<div class="adm-strip-chip" data-link="' + (clickable ? esc(it.link.trim()) : '') + '" title="' + esc(label) + '" style="display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;border:1px solid var(--c-border);border-radius:20px;padding:6px 12px;margin:2px;background:var(--c-card);font-size:13px;cursor:' + (clickable ? 'pointer' : 'default') + '">' + esc(label) + '</div>';
    }).join('');
    box.innerHTML = '<div style="display:flex;align-items:center;gap:6px">' +
      '<b style="white-space:nowrap;font-size:13px">⏰ آخری تاریخیں:</b>' +
      '<button type="button" id="adm-strip-prev" aria-label="پچھلی خبریں" style="flex:none;width:30px;height:30px;border-radius:50%;border:1px solid var(--c-border);background:var(--c-card);font-size:16px;line-height:1;cursor:pointer">›</button>' +
      '<div id="adm-strip-track" style="flex:1;overflow-x:auto;white-space:nowrap;scroll-behavior:smooth">' + chips + '</div>' +
      '<button type="button" id="adm-strip-next" aria-label="اگلی خبریں" style="flex:none;width:30px;height:30px;border-radius:50%;border:1px solid var(--c-border);background:var(--c-card);font-size:16px;line-height:1;cursor:pointer">‹</button>' +
      '</div>';
    var track = document.getElementById('adm-strip-track');
    var items = track ? track.querySelectorAll('.adm-strip-chip') : [];
    var idx = 0;
    function goTo(i) {
      if (!items.length) return;
      idx = Math.max(0, Math.min(items.length - 1, i));
      items[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    var prev = document.getElementById('adm-strip-prev');
    var next = document.getElementById('adm-strip-next');
    if (prev) prev.addEventListener('click', function () { goTo(idx - 1); });
    if (next) next.addEventListener('click', function () { goTo(idx + 1); });
    if (track) track.addEventListener('scroll', function () {
      var tr = track.getBoundingClientRect(), best = 0, bestD = 1e9;
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        var d = Math.abs((r.left + r.right) / 2 - (tr.left + tr.right) / 2);
        if (d < bestD) { bestD = d; best = i; }
      }
      idx = best;
    }, { passive: true });
    for (var j = 0; j < items.length; j++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          var u = chip.getAttribute('data-link');
          if (u) window.open(u, '_blank', 'noopener');
        });
      })(items[j]);
    }
  }

  function renderNewsSections() {
    var sch = newsItems().filter(function (it) { return it.cat === 'scholarship' || it.cat === 'conference'; });
    var jobs = newsItems().filter(function (it) { return it.cat === 'job'; });
    var sEl = el('adm-sec-scholarships');
    if (sEl) {
      sEl.innerHTML = '<button class="btn" style="margin-bottom:10px" onclick="admSection(null)">→ ہب پر واپس</button>' +
        '<p style="margin:8px 0"><b>🎓 سکالرشپس</b></p>' +
        (window.helpBtn ? window.helpBtn('general') : '') +
        (sch.length ? sch.map(newsCard).join('') : '<p class="small">ابھی کوئی تصدیق شدہ سکالرشپ خبر نہیں — نئی خبریں تصدیق کے بعد یہیں آئیں گی۔</p>') +
        '<p class="small" style="margin-top:8px">فلی فنڈڈ کانفرنسز کے اعلانات بھی تصدیق کے بعد اسی ڈبے میں آئیں گے۔</p>';
    }
    var jEl = el('adm-sec-jobs');
    if (jEl) {
      jEl.innerHTML = '<button class="btn" style="margin-bottom:10px" onclick="admSection(null)">→ ہب پر واپس</button>' +
        '<p style="margin:8px 0"><b>💼 ملازمتیں و مواقع</b></p>' +
        (window.helpBtn ? window.helpBtn('jobs') : '') +
        (jobs.length ? jobs.map(newsCard).join('') : '<p class="small">ابھی کوئی تصدیق شدہ ملازمت خبر نہیں — نئی خبریں تصدیق کے بعد یہیں آئیں گی۔</p>') +
        '<p class="small" style="margin-top:8px">یہ وہی طرز کی خبریں ہیں جو علمی مشغولیت ایپ کے اندر بھی آتی ہیں — یہاں فہرست شدہ یونیورسٹیز سے متعلقہ خبریں دکھائی جاتی ہیں۔</p>';
    }
  }

  function renderCalendar() {
    var cEl = el('adm-sec-calendar');
    if (!cEl) return;
    var seen = {};
    var names = [];
    state.pk.concat(state.foreign).forEach(function (u) {
      if (u.name && !seen[u.name]) { seen[u.name] = u; names.push(u); }
    });
    function matchNews(u) {
      return newsItems().filter(function (it) { return it.deadline; }).filter(function (it) {
        var o = it.org || '';
        return (o && u.name && (o.indexOf(u.name) !== -1 || u.name.indexOf(o) !== -1));
      })[0];
    }
    /* ہر یونیورسٹی کا داخلہ کیلنڈر بٹن (Mufti 2026-10-29): «کوئی اعلان نہیں»
       والی سطر ہر یونیورسٹی پر دہرانا بند — اب ہر قطار میں یونیورسٹی کے اپنے
       داخلہ صفحے کا بٹن ہوتا ہے (داخلہ پورٹل > شعبہ صفحہ > ویب سائٹ)، چاہے
       وہاں اس وقت کوئی نیا اعلان نہ ہو۔ آخری تاریخ صرف وہاں دکھائی جاتی ہے
       جہاں واقعی تصدیق شدہ اعلان موجود ہو۔ */
    var allEntries = state.pk.concat(state.foreign);
    function calendarUrl(name) {
      var portal = '', dept = '', web = '';
      allEntries.forEach(function (e) {
        if (e.name !== name) return;
        var at = e.attributes || {};
        if (!portal && at['داخلہ فارم / پورٹل'] && isUrl(at['داخلہ فارم / پورٹل'])) portal = at['داخلہ فارم / پورٹل'].trim();
        if (!dept && e.deptLink && isUrl(e.deptLink)) dept = e.deptLink.trim();
        if (!web && e.website && isUrl(e.website)) web = e.website.trim();
      });
      return portal || dept || web;
    }
    var rows = names.map(function (u) {
      var n = matchNews(u);
      return { u: u, n: n, url: calendarUrl(u.name) };
    });
    rows.sort(function (a, b) { return (a.n ? 0 : 1) - (b.n ? 0 : 1); });
    cEl.innerHTML = '<button class="btn" style="margin-bottom:10px" onclick="admSection(null)">→ ہب پر واپس</button>' +
      '<p style="margin:8px 0"><b>📅 داخلہ کیلنڈر</b></p>' +
      (window.helpBtn ? window.helpBtn('general') : '') +
      '<p class="small" style="margin:0 0 8px">ہر یونیورسٹی کا داخلہ شیڈول (سال میں کتنی مرتبہ) + اس کے اپنے داخلہ صفحے کا بٹن — ' +
      'وہاں اس وقت کوئی نیا اعلان نہ ہو تو بھی وہی سرکاری صفحہ چیک کریں۔ تصدیق شدہ آخری تاریخ صرف وہاں لکھی جاتی ہے جہاں اعلان موجود ہو۔</p>' +
      rows.map(function (r) {
        return '<div style="border:1px solid var(--c-border);border-radius:12px;padding:10px;margin:8px 0;background:var(--c-card)">' +
          '<p style="margin:0;font-weight:bold">' + esc(r.u.name) +
          (r.u.country && r.u.country !== 'پاکستان' ? ' (' + esc(r.u.country) + ')' : '') + '</p>' +
          (r.u.admissionFrequency ? '<p class="small" style="margin:4px 0">داخلہ (سال میں): ' + esc(r.u.admissionFrequency) + '</p>' : '') +
          (r.n ? '<p class="small" style="margin:4px 0">⏰ ' + esc(r.n.title) + ' — ' + esc(r.n.deadlineText || r.n.deadline) +
            (isUrl(r.n.link) ? ' <a style="color:var(--c-primary-700);font-weight:bold" href="' + esc(r.n.link.trim()) + '" target="_blank" rel="noopener">لنک ←</a>' : '') + '</p>' : '') +
          (r.url ? '<p style="margin:6px 0 0"><a style="display:inline-block;padding:6px 14px;border-radius:20px;background:var(--c-gold-100);border:1px solid var(--c-gold-500);font-weight:bold;color:var(--c-primary-700);text-decoration:none" href="' + esc(r.url) + '" target="_blank" rel="noopener">📅 داخلہ کیلنڈر / اعلانات ←</a></p>' : '') +
          '</div>';
      }).join('');
  }

  function renderTests() {
    var tEl = el('adm-sec-tests');
    if (!tEl) return;
    var rows = state.pk.concat(state.foreign).filter(function (u) {
      return (u.testLanguage && String(u.testLanguage).trim()) || (u.testType && String(u.testType).trim()) ||
        (u.testLink && String(u.testLink).trim());
    });
    tEl.innerHTML = '<button class="btn" style="margin-bottom:10px" onclick="admSection(null)">→ ہب پر واپس</button>' +
      '<p style="margin:8px 0"><b>📝 انٹری ٹیسٹ کی معلومات</b></p>' +
      (window.helpBtn ? window.helpBtn('test') : '') +
      '<p class="small" style="margin:0 0 8px">کون سی یونیورسٹی کا انٹری ٹیسٹ کس زبان میں اور کس نوع کا ہوتا ہے (شیٹ / سرکاری ذرائع کے مطابق)۔ ' +
      'تیاری کا مواد نیچے دیے گئے فولڈر میں موجود ہے۔</p>' +
      (PREP_URL ? '<div style="border:1px solid var(--c-gold-500);border-radius:12px;padding:10px;margin:8px 0;background:var(--c-gold-100)">' +
        '<p style="margin:0;font-weight:bold">📚 انٹری ٹیسٹ تیاری کا مواد</p>' +
        '<p class="small" style="margin:4px 0">اسلامیات انٹری ٹیسٹ کی کتب، کیپسول، گائیڈز اور پاسٹ پیپرز کا فولڈر — تیاری کی کتابیں یہیں سے حاصل کریں۔</p>' +
        '<p style="margin:6px 0 0"><a style="display:inline-block;padding:6px 14px;border-radius:20px;background:var(--c-card);border:1px solid var(--c-gold-500);font-weight:bold;color:var(--c-primary-700);text-decoration:none" href="' + esc(PREP_URL) + '" target="_blank" rel="noopener">📚 تیاری کا مواد کھولیں ←</a></p></div>' : '') +
      (rows.length ? rows.map(function (u) {
        return '<div style="border:1px solid var(--c-border);border-radius:12px;padding:10px;margin:8px 0;background:var(--c-card)">' +
          '<p style="margin:0;font-weight:bold">' + esc(u.name) + (u.level ? ' — ' + esc(u.level) : '') + '</p>' +
          '<p class="small" style="margin:4px 0">' + [u.testLanguage ? 'زبان: ' + esc(u.testLanguage) : '', u.testType ? 'نوع: ' + esc(u.testType) : ''].filter(Boolean).join(' • ') + '</p>' +
          (u.testLink ? '<p style="margin:6px 0 0">' + ffAnchor({ title: u.name + ' — انٹری ٹیسٹ', url: String(u.testLink).trim().replace(/ /g, '%20'), sourceLabel: 'انٹری ٹیسٹ' }, '📝 ' + esc(u.testLinkLabel || 'ٹیسٹ معلومات / مواد') + ' ←', 'display:inline-block;padding:6px 14px;border-radius:20px;background:var(--c-gold-100);border:1px solid var(--c-gold-500);font-weight:bold;color:var(--c-primary-700);text-decoration:none', '') + '</p>' : '') + '</div>';
      }).join('') : '<p class="small">ابھی کوئی انٹری ٹیسٹ معلومات درج نہیں۔</p>');
  }

  function readFilesAsBase64(input) {
    var files = Array.prototype.slice.call(input.files || []);
    var total = files.reduce(function (s, f) { return s + f.size; }, 0);
    if (total > 15 * 1024 * 1024) return Promise.reject(new Error('فائلیں 15MB سے زیادہ ہیں — چھوٹی فائلیں چنیں۔'));
    return Promise.all(files.map(function (f) {
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () {
          res({ name: f.name, mimeType: f.type || 'application/octet-stream',
            base64: String(r.result).split(',')[1] || '' });
        };
        r.onerror = function () { rej(new Error('فائل پڑھنے میں مسئلہ: ' + f.name)); };
        r.readAsDataURL(f);
      });
    }));
  }

  function postForm(payload, msgEl) {
    if (!SCRIPT_URL) {
      msgEl.textContent = 'آن لائن جمع کرانا ابھی فعال نہیں ہوا — براہ کرم کچھ دیر بعد دوبارہ کوشش کریں۔';
      return Promise.resolve(false);
    }
    msgEl.textContent = 'جمع ہو رہا ہے — چند لمحے انتظار کریں…';
    return fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) {
        msgEl.textContent = '✅ محفوظ ہو گیا — شکریہ!';
        return true;
      }
      msgEl.textContent = 'مسئلہ ہوا: ' + ((j && j.error) || 'نامعلوم خرابی') + ' — دوبارہ کوشش کریں۔';
      return false;
    }).catch(function (e) {
      msgEl.textContent = 'رابطہ نہیں ہو سکا: ' + (e && e.message ? e.message : e) + ' — دوبارہ کوشش کریں۔';
      return false;
    });
  }

  window.admSubmitEasy = function () {
    var msg = el('af-msg');
    var gmail = (el('af-gmail').value || '').trim();
    var name = (el('af-name').value || '').trim();
    if (!gmail || !name) { msg.textContent = 'جی میل اور نام دونوں لکھیں۔'; return; }
    var fields = Array.prototype.slice.call(
      document.querySelectorAll('.adm-f-check:checked')).map(function (c) { return c.value; });
    postForm({
      action: 'candidate',
      gmail: gmail, name: name,
      madrasa: el('af-madrasa').value || '',
      occupation: el('af-occupation').value || '',
      whatsapp: el('af-whatsapp').value || '',
      email: el('af-email').value || '',
      pastDegrees: el('af-degrees').value || '',
      desiredFields: fields,
      universityChosen: el('af-university').value || ''
    }, msg);
  };

  window.admSubmitApply = function () {
    var msg = el('ap-msg');
    var name = (el('ap-name').value || '').trim();
    var cnic = (el('ap-cnic').value || '').trim();
    var mobile = (el('ap-mobile').value || '').trim();
    var email = (el('ap-email').value || '').trim();
    var uni = el('ap-university').value || '';
    var prog = (el('ap-program').value || '').trim();
    if (!name || !cnic || !mobile || !email || !uni || !prog) {
      msg.textContent = 'نام، شناختی کارڈ، موبائل، ای میل، یونیورسٹی اور پروگرام سب لکھیں۔';
      return;
    }
    msg.textContent = 'فائلیں تیار ہو رہی ہیں…';
    var proofP = readFilesAsBase64(el('ap-proof'));
    var docsP = readFilesAsBase64(el('ap-docs'));
    Promise.all([proofP, docsP]).then(function (arr) {
      var proof = arr[0], docs = arr[1];
      return postForm({
        action: 'application',
        name: name, cnic: cnic, mobile: mobile, email: email,
        university: uni, program: prog,
        level: el('ap-level').value || '',
        discipline: el('ap-discipline').value || '',
        proofNames: proof.map(function (f) { return f.name; }),
        files: proof.concat(docs)
      }, msg);
    }).catch(function (e) {
      msg.textContent = e && e.message ? e.message : String(e);
    });
  };

  /* Init — runs at parse time; scripts sit at end of body so views exist. */
  try {
    if (!DATA || !DATA.universities) {
      var h = el('adm-list');
      if (h) h.innerHTML = '<p>داخلہ ڈیٹا لوڈ نہیں ہوا — بعد میں دوبارہ کوشش کریں۔</p>';
      return;
    }
    state.pk = DATA.universities.filter(function (u) { return u.country === 'پاکستان'; });
    state.foreign = (FOREIGN && FOREIGN.universities) || [];
    renderScope();
    renderChips();
    renderList();
    renderSecButtons();
    renderStrip();
    renderNewsSections();
    renderCalendar();
    renderTests();
    admSection(null);
    fillUniversitySelects();
    if (window.admPrefillApplyForm) window.admPrefillApplyForm();
    if (window.admPrefillEasyForm) window.admPrefillEasyForm();
    if (!SCRIPT_URL) {
      var n1 = el('af-note');
      if (n1) n1.textContent = 'نوٹ: آن لائن جمع کرانا ابھی فعال نہیں ہوا — فارم بھر کر رکھیں، فعال ہوتے ہی جمع ہو جائے گا۔';
      var n2 = el('ap-note');
      if (n2) n2.textContent = 'نوٹ: آن لائن جمع کرانا ابھی فعال نہیں ہوا — اپلائی کے بعد یہ فارم فعال ہوتے ہی بھر دیں، یا واٹس ایپ پر رابطہ کریں۔';
    }
    /* Apply-stage help inside the apply form (number + group, apply stage only). */
    var hp = el('ap-help');
    if (hp) {
      var h = '';
      if (WA_NUMBER) h += '<p style="margin:0 0 6px"><b>اپلائی میں مدد چاہیے؟</b></p>' +
        '<a class="btn" style="display:block;text-align:center;text-decoration:none;margin:4px 0" href="https://wa.me/' + WA_NUMBER + '" target="_blank" rel="noopener">📱 واٹس ایپ پر مدد لیں</a>';
      if (WA_GROUP) h += '<a class="btn" style="display:block;text-align:center;text-decoration:none;margin:4px 0" href="' + esc(WA_GROUP) + '" target="_blank" rel="noopener">👥 واٹس ایپ گروپ جوائن کریں</a>';
      hp.innerHTML = h;
    }
  } catch (e) { /* never break the main app over the admissions hub */ }
})();
