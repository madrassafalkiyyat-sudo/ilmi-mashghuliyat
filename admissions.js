/* =====================================================================
   داخلہ جات (Admissions hub — Phase 2)
   ---------------------------------------------------------------------
   - ملکی ڈیٹا admissions-data.js سے، غیر ملکی (بنیادی) foreign-basic.js
     سے، خبریں admissions-news.js سے — کوئی رقم/تاریخ گھڑی نہیں گئی،
     خالی خانے پر «معلومات دستیاب نہیں» لکھا جاتا ہے۔
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
  var state = { disc: 'تمام', level: 'تمام', current: null, pk: [], foreign: [], scope: 'pk', section: 'unis' };
  var SECTIONS = [
    ['unis', '🎓 یونیورسٹیز'],
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
    if (!isUrl(u)) return '<span class="small">معلومات دستیاب نہیں</span>';
    return '<a href="' + esc(u.trim()) + '" target="_blank" rel="noopener" ' +
      'style="color:var(--c-primary-700);font-weight:bold">' + esc(label) + '</a>';
  }
  function val(v) {
    return (v && String(v).trim()) ? esc(v) : '<span class="small">معلومات دستیاب نہیں</span>';
  }
  function row(label, html) {
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

  function renderChips() {
    var discs = ['تمام'].concat(DATA.disciplines || []);
    var levels = ['تمام', 'BS', 'MS/MPhil', 'PhD'];
    el('adm-disc').innerHTML = discs.map(function (d) {
      return chip(d, state.disc === d, "admSetDisc('" + d + "')");
    }).join('');
    el('adm-level').innerHTML = levels.map(function (l) {
      return chip(l, state.level === l, "admSetLevel('" + l + "')");
    }).join('');
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

  function renderScope() {
    el('adm-scope').innerHTML =
      chip('🇵🇰 ملکی', state.scope === 'pk', "admSetScope('pk')") +
      chip('🌍 غیر ملکی', state.scope === 'foreign', "admSetScope('foreign')");
  }

  window.admSetScope = function (s) {
    state.scope = s; renderScope(); renderChips(); renderList();
  };

  function renderList() {
    var list = filtered();
    el('adm-count').textContent = list.length + ' یونیورسٹیز ملیں';
    if (!list.length) {
      el('adm-list').innerHTML =
        '<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;background:var(--c-card)">' +
        '<p style="margin:0"><b>اس انتخاب کی معلومات ابھی شیٹ میں درج نہیں۔</b></p>' +
        '<p class="small" style="margin:6px 0 0">ڈسپلن یا لیول بدل کر دیکھیں، یا «تمام» چن کر پوری فہرست دیکھیں۔ ' +
        'فیس/اہلیت کی حتمی تصدیق ہمیشہ یونیورسٹی کی سرکاری ویب سائٹ سے کریں۔</p></div>';
      return;
    }
    var note = '';
    if (state.scope === 'foreign') {
      note = '<div style="border:1px solid var(--c-gold-500);border-radius:12px;padding:10px;margin:8px 0;background:var(--c-gold-100)">' +
        '<p class="small" style="margin:0">غیر ملکی یونیورسٹیز کی تفصیل: 17 یونیورسٹیز کے پروگرامز، اہلیت اور سرکاری لنکس سرکاری پیجز سے آ گئے ہیں؛ ' +
        '3 یونیورسٹیز (الازہر، المصطفی، استنبول تھیالوجی) کی مکمل تفصیل ابھی تحقیق میں ہے — ان کے سرکاری لنکس یہاں موجود ہیں۔</p></div>';
    }
    el('adm-list').innerHTML = note + list.map(function (u) {
      var i = curList().indexOf(u);
      var meta = [u.sector, u.city, u.level].filter(Boolean).join(' • ');
      var d = discOf(u);
      return '<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;margin:8px 0;background:var(--c-card)">' +
        '<p style="margin:0;font-weight:bold;font-size:1.05em">' + esc(u.name) + '</p>' +
        (meta ? '<p class="small" style="margin:2px 0">' + esc(meta) + '</p>' : '') +
        (d ? '<p class="small" style="margin:2px 0">' + esc(d) + '</p>' : '') +
        '<button class="btn" style="margin-top:8px" onclick="admShow(' + i + ')">تفصیل دیکھیں</button></div>';
    }).join('');
  }

  window.admSetDisc = function (d) { state.disc = d; renderChips(); renderList(); };
  window.admSetLevel = function (l) { state.level = l; renderChips(); renderList(); };

  window.admShow = function (i) {
    var u = curList()[i];
    if (!u) return;
    state.current = u;
    var html = '<h1 style="font-size:1.25em">' + esc(u.name) + '</h1>';
    html += '<p class="small" style="margin:0 0 8px">' +
      [u.sector, u.city, u.level, discOf(u)].filter(Boolean).map(esc).join(' • ') + '</p>';
    html += '<div class="divider"></div>';
    html += row('دورانیہ', val(u.duration));
    html += row('اہلیت', val(u.eligibility));
    html += row('آن لائن سہولت', val(u.onlineFacility));
    html += row('کلاس ایام', val(u.classDays));
    html += row('کلاس اوقات', val(u.classTimings));
    html += row('داخلہ (سال میں)', val(u.admissionFrequency));
    html += row('داخلہ تاریخ', val(u.admissionDates));
    html += row('انٹری ٹیسٹ زبان', val(u.testLanguage));
    html += row('انٹری ٹیسٹ نوع', val(u.testType));
    html += row('شعبے / پروگرامز', val(u.fields || (u.attributes && u.attributes['بی ایس پروگرامز'])));
    html += row('فون', val(u.phone));
    if (u.contacts && u.contacts.length) {
      html += '<p style="margin:8px 0 2px"><b>رابطہ افراد (شیٹ کے مطابق):</b></p>';
      u.contacts.forEach(function (c) {
        html += '<p style="margin:2px 0">' + esc(c.person || '—') +
          (c.number ? ' — ' + esc(c.number) : '') + '</p>';
      });
    }
    if (u.attributes) {
      Object.keys(u.attributes).forEach(function (k) {
        if (k === 'بی ایس پروگرامز') return;
        var v = u.attributes[k];
        html += row(k, isUrl(v) ? link(v, 'لنک کھولیں') : val(v));
      });
    }
    html += '<div class="divider"></div><p style="margin:0 0 4px"><b>سرکاری لنکس</b></p>';
    html += row('ویب سائٹ', link(u.website, 'یونیورسٹی ویب سائٹ'));
    html += row('شعبہ کا صفحہ', link(u.deptLink, 'شعبہ کا صفحہ'));
    html += row('فیس نوٹیفیکیشن', link(u.feeLink, 'فیس نوٹیفیکیشن'));
    html += row('سکالرشپ تفصیل', link(u.scholarshipLink, 'سکالرشپ تفصیل'));
    html += row('فیس بک', link(u.facebook, 'فیس بک پیج'));
    html += row('داخلہ ویڈیو', link(u.videoLink, 'داخلہ ویڈیو'));
    html += '<p class="small" style="margin:8px 0 0">فیس کی رقم شیٹ میں درج نہیں — ' +
      'فیس نوٹیفیکیشن یا یونیورسٹی ویب سائٹ سے تصدیق کریں۔</p>';
    var applyUrl = u.deptLink || u.website;
    var applyNote = u.deptLink
      ? 'شعبہ کا صفحہ کھلے گا — ایڈمیشن فارم وہیں ملے گا۔'
      : 'یونیورسٹی کی ویب سائٹ کھلے گی — ایڈمیشن فارم وہیں تلاش کریں۔';
    html += '<div style="margin:14px 0;padding:12px;border:1px solid var(--c-gold-500);border-radius:12px;background:var(--c-gold-100)">' +
      '<p style="margin:0 0 4px;font-weight:bold">📝 اپلائی کریں</p>' +
      '<p class="small" style="margin:0 0 10px">' + esc(applyNote) + '</p>';
    if (isUrl(applyUrl)) {
      html += '<a class="btn goldb" style="display:block;text-align:center;text-decoration:none;padding:12px" href="' + esc(applyUrl.trim()) + '" target="_blank" rel="noopener">ایڈمیشن فارم کھولیں</a>';
    } else {
      html += '<p class="small">اس یونیورسٹی کا فارم/ویب لنک شیٹ میں درج نہیں۔</p>';
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
    var opts = '<option value="">ابھی منتخب نہیں کی</option>' +
      all.map(function (u) {
        return '<option value="' + esc(u.name) + '">' + esc(u.name) + '</option>';
      }).join('');
    var a = el('af-university'); if (a) a.innerHTML = opts;
    var b = el('ap-university');
    if (b) b.innerHTML = '<option value="">— یونیورسٹی چنیں —</option>' +
      all.map(function (u) {
        return '<option value="' + esc(u.name) + '">' + esc(u.name) + '</option>';
      }).join('');
  }

  /* ---- Phase 2 sections: strip, scholarships, jobs, calendar, tests ---- */

  function newsItems() {
    return (NEWS && NEWS.items) || [];
  }

  function catLabel(c) {
    return c === 'scholarship' ? '🎓 سکالرشپ' : c === 'job' ? '💼 ملازمت' :
      c === 'admission' ? '📢 داخلہ' : c === 'conference' ? '🎤 کانفرنس' : '📰 خبر';
  }

  function newsCard(it) {
    var h = '<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;margin:8px 0;background:var(--c-card)">' +
      '<p style="margin:0;font-weight:bold">' + esc(it.title) + '</p>' +
      '<p class="small" style="margin:4px 0">' + catLabel(it.cat) + ' • ' + esc(it.org || '') +
      (it.deadlineText ? ' • ' + esc(it.deadlineText) : '') + '</p>';
    if (it.details) h += '<p class="small" style="margin:4px 0">' + esc(it.details) + '</p>';
    if (isUrl(it.link)) h += '<a class="btn" style="display:inline-block;text-align:center;text-decoration:none;margin-top:6px;padding:8px 16px" href="' + esc(it.link.trim()) + '" target="_blank" rel="noopener">سرکاری صفحہ کھولیں</a>';
    return h + '</div>';
  }

  function renderSecButtons() {
    el('adm-sections').innerHTML = SECTIONS.map(function (s) {
      return chip(s[1], state.section === s[0], "admSection('" + s[0] + "')");
    }).join('');
  }

  window.admSection = function (sec) {
    state.section = sec;
    renderSecButtons();
    SECTIONS.forEach(function (s) {
      var d = el('adm-sec-' + s[0]);
      if (d) d.style.display = (s[0] === sec) ? '' : 'none';
    });
  };

  function renderStrip() {
    var box = el('adm-strip');
    if (!box) return;
    var dated = newsItems().filter(function (it) { return it.deadline; })
      .sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; });
    if (!dated.length) { box.style.display = 'none'; return; }
    box.innerHTML = '<p style="margin:0 0 6px;white-space:normal"><b>⏰ آخری تاریخیں</b> <span class="small">(دائیں/بائیں اسکرول کریں)</span></p>' +
      dated.map(function (it) {
        return '<div style="display:inline-block;vertical-align:top;width:260px;white-space:normal;border:1px solid var(--c-border);border-radius:10px;padding:10px;margin:2px;background:var(--c-card)">' +
          '<p style="margin:0;font-weight:bold;font-size:16px">' + esc(it.title) + '</p>' +
          '<p class="small" style="margin:4px 0">' + catLabel(it.cat) + ' • ' + esc(it.deadlineText || it.deadline) + '</p>' +
          (isUrl(it.link) ? '<a style="color:var(--c-primary-700);font-weight:bold" href="' + esc(it.link.trim()) + '" target="_blank" rel="noopener">سرکاری صفحہ ←</a>' : '') +
          '</div>';
      }).join('');
  }

  function renderNewsSections() {
    var sch = newsItems().filter(function (it) { return it.cat === 'scholarship' || it.cat === 'conference'; });
    var jobs = newsItems().filter(function (it) { return it.cat === 'job'; });
    var sEl = el('adm-sec-scholarships');
    if (sEl) {
      sEl.innerHTML = '<p style="margin:8px 0"><b>🎓 سکالرشپس</b></p>' +
        (sch.length ? sch.map(newsCard).join('') : '<p class="small">ابھی کوئی تصدیق شدہ سکالرشپ خبر نہیں — نئی خبریں تصدیق کے بعد یہیں آئیں گی۔</p>') +
        '<p class="small" style="margin-top:8px">فلی فنڈڈ کانفرنسز کے اعلانات بھی تصدیق کے بعد اسی ڈبے میں آئیں گے۔</p>';
    }
    var jEl = el('adm-sec-jobs');
    if (jEl) {
      jEl.innerHTML = '<p style="margin:8px 0"><b>💼 ملازمتیں و مواقع</b></p>' +
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
    var rows = names.map(function (u) {
      var n = matchNews(u);
      return { u: u, n: n };
    });
    rows.sort(function (a, b) { return (a.n ? 0 : 1) - (b.n ? 0 : 1); });
    cEl.innerHTML = '<p style="margin:8px 0"><b>📅 داخلہ کیلنڈر</b></p>' +
      '<p class="small" style="margin:0 0 8px">ہر یونیورسٹی کا داخلہ شیڈول (سال میں کتنی مرتبہ) + تصدیق شدہ آخری تاریخ جہاں اعلان موجود ہے۔ ' +
      'داخلہ تاریخیں ہر سائیکل کے ساتھ بدلتی ہیں — نیا اعلان آتے ہی یہیں نظر آئے گا۔</p>' +
      rows.map(function (r) {
        return '<div style="border:1px solid var(--c-border);border-radius:12px;padding:10px;margin:8px 0;background:var(--c-card)">' +
          '<p style="margin:0;font-weight:bold">' + esc(r.u.name) +
          (r.u.country && r.u.country !== 'پاکستان' ? ' (' + esc(r.u.country) + ')' : '') + '</p>' +
          '<p class="small" style="margin:4px 0">داخلہ (سال میں): ' + (r.u.admissionFrequency ? esc(r.u.admissionFrequency) : 'معلومات دستیاب نہیں') + '</p>' +
          (r.n ? '<p class="small" style="margin:4px 0">⏰ ' + esc(r.n.title) + ' — ' + esc(r.n.deadlineText || r.n.deadline) +
            (isUrl(r.n.link) ? ' <a style="color:var(--c-primary-700);font-weight:bold" href="' + esc(r.n.link.trim()) + '" target="_blank" rel="noopener">لنک ←</a>' : '') + '</p>'
            : '<p class="small" style="margin:4px 0">آخری تاریخ: اس وقت کوئی تصدیق شدہ داخلہ اعلان نہیں۔</p>') +
          '</div>';
      }).join('');
  }

  function renderTests() {
    var tEl = el('adm-sec-tests');
    if (!tEl) return;
    var rows = state.pk.concat(state.foreign).filter(function (u) {
      return (u.testLanguage && String(u.testLanguage).trim()) || (u.testType && String(u.testType).trim());
    });
    tEl.innerHTML = '<p style="margin:8px 0"><b>📝 انٹری ٹیسٹ کی معلومات</b></p>' +
      '<p class="small" style="margin:0 0 8px">کون سی یونیورسٹی کا انٹری ٹیسٹ کس زبان میں اور کس نوع کا ہوتا ہے (شیٹ / سرکاری ذرائع کے مطابق)۔ ' +
      'تیاری کا مواد (کتب، کورسز، نمونہ پیپرز) تصدیق کے بعد یہیں شامل ہو گا۔</p>' +
      (rows.length ? rows.map(function (u) {
        return '<div style="border:1px solid var(--c-border);border-radius:12px;padding:10px;margin:8px 0;background:var(--c-card)">' +
          '<p style="margin:0;font-weight:bold">' + esc(u.name) + (u.level ? ' — ' + esc(u.level) : '') + '</p>' +
          '<p class="small" style="margin:4px 0">زبان: ' + val(u.testLanguage) + ' • نوع: ' + val(u.testType) + '</p></div>';
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
    admSection('unis');
    fillUniversitySelects();
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
