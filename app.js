(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Choices: [value sent to the AI, label shown]
   * Must match the whitelist in api/generate.js
   * ------------------------------------------------------------------ */
  var POSITIVE = [
    'Enthusiastic', 'Positive', 'Shows initiative', 'Committed', 'Responsible', 'Articulate',
    'Creative', 'Kind and helpful', 'Respectful', 'Focused', 'Thoughtful', 'Mature',
    'Friendly', 'Diligent', 'Curious', 'Collaborative', 'Adaptable', 'Inquisitive'
  ].map(function (v) { return [v, v]; });

  var AREAS = [
    'None', 'Off-task', 'Group work', 'Unfinished homework', 'Interrupts lessons', 'Time management',
    'Participation', 'Organization', 'Punctuality', 'Following instructions', 'Confidence', 'Reading practice'
  ].map(function (v) { return [v, v]; });

  var API_ENDPOINT = '/api/generate';
  var LANGUAGE = 'en'; // comments are always written in English
  var KEY_SETTINGS = 'rc_settings_v1';
  var KEY_HISTORY = 'rc_history_v1';
  var KEY_CODE = 'rc_access_code';
  var SETTING_IDS = ['level', 'tone', 'length', 'variations'];

  /* ------------------------------ helpers ------------------------------ */
  function $(id) { return document.getElementById(id); }

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  var el = {
    form: $('form'), name: $('name'), pronoun: $('pronoun'),
    positives: $('positives'), areas: $('areas'), posCount: $('posCount'),
    notes: $('notes'), notesCount: $('notesCount'),
    formError: $('formError'), generateBtn: $('generateBtn'), resetBtn: $('resetBtn'),
    tabs: $('tabs'), empty: $('empty'), skeleton: $('skeleton'),
    editorWrap: $('editorWrap'), editor: $('editor'), wordCount: $('wordCount'),
    copyBtn: $('copyBtn'), saveBtn: $('saveBtn'), printBtn: $('printBtn'), regenBtn: $('regenBtn'),
    historyBox: $('historyBox'), historyList: $('historyList'), historyCount: $('historyCount'),
    copyAllBtn: $('copyAllBtn'), clearAllBtn: $('clearAllBtn'),
    toast: $('toast'),
    codeDialog: $('codeDialog'), codeForm: $('codeForm'), codeInput: $('codeInput'),
    codeHint: $('codeHint'), codeCancel: $('codeCancel'),
    printName: $('printName'), printText: $('printText')
  };

  var state = {
    versions: [],
    active: 0,
    studentName: '',
    busy: false,
    history: []
  };

  /* ------------------------------ chips ------------------------------ */
  function renderChips(root, items, group) {
    root.innerHTML = '';
    items.forEach(function (item) {
      var label = document.createElement('label');
      label.className = 'chip';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = group;
      input.value = item[0];
      var span = document.createElement('span');
      span.textContent = item[1];
      label.appendChild(input);
      label.appendChild(span);
      root.appendChild(label);
    });
  }

  function checkedValues(root) {
    return Array.prototype.map.call(root.querySelectorAll('input:checked'), function (i) { return i.value; });
  }

  function updatePosCount() {
    var n = checkedValues(el.positives).length;
    el.posCount.textContent = n ? '(' + n + ' selected)' : '';
  }

  el.positives.addEventListener('change', updatePosCount);

  // "None" is exclusive with every other area.
  el.areas.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.type !== 'checkbox') return;
    var boxes = el.areas.querySelectorAll('input');
    if (t.checked && t.value === 'None') {
      Array.prototype.forEach.call(boxes, function (b) { if (b !== t) b.checked = false; });
    } else if (t.checked) {
      Array.prototype.forEach.call(boxes, function (b) { if (b.value === 'None') b.checked = false; });
    }
  });

  /* ------------------------------ settings ------------------------------ */
  function loadSettings() {
    var raw = read(KEY_SETTINGS);
    if (!raw) return;
    try {
      var s = JSON.parse(raw);
      SETTING_IDS.forEach(function (id) {
        var node = $(id);
        if (node && s[id] && node.querySelector('option[value="' + s[id] + '"]')) node.value = s[id];
      });
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    var s = {};
    SETTING_IDS.forEach(function (id) { s[id] = $(id).value; });
    store(KEY_SETTINGS, JSON.stringify(s));
  }

  SETTING_IDS.forEach(function (id) { $(id).addEventListener('change', saveSettings); });

  /* ------------------------------ notes counter ------------------------------ */
  el.notes.addEventListener('input', function () {
    el.notesCount.textContent = String(el.notes.value.length);
  });

  /* ------------------------------ UI helpers ------------------------------ */
  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('is-on'); }, 2200);
  }

  function showError(msg) {
    el.formError.textContent = msg;
    el.formError.hidden = false;
  }
  function clearError() {
    el.formError.hidden = true;
    el.formError.textContent = '';
  }

  function setBusy(on) {
    state.busy = on;
    el.generateBtn.disabled = on;
    el.regenBtn.disabled = on;
    el.generateBtn.classList.toggle('is-loading', on);
    el.generateBtn.querySelector('.btn__label').textContent = on ? 'Writing…' : 'Generate Comment';
    if (on) {
      el.empty.hidden = true;
      el.editorWrap.hidden = true;
      el.tabs.hidden = true;
      el.skeleton.hidden = false;
    } else {
      el.skeleton.hidden = true;
    }
  }

  function countWords(text) {
    var t = (text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function autosize() {
    el.editor.style.height = 'auto';
    el.editor.style.height = Math.max(190, el.editor.scrollHeight + 2) + 'px';
  }

  function updateWordCount() {
    var n = countWords(el.editor.value);
    el.wordCount.textContent = n ? n + (n === 1 ? ' word' : ' words') : '';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function doCopy(text, okMsg) {
    copyText(text).then(
      function () { toast(okMsg || 'Copied ✓'); },
      function () { toast('Could not copy. Please copy it manually.'); }
    );
  }

  /* ------------------------------ result rendering ------------------------------ */
  function renderTabs() {
    el.tabs.innerHTML = '';
    if (state.versions.length < 2) { el.tabs.hidden = true; return; }
    state.versions.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === state.active ? 'true' : 'false');
      b.textContent = 'Version ' + (i + 1);
      b.addEventListener('click', function () { selectVersion(i); });
      el.tabs.appendChild(b);
    });
    el.tabs.hidden = false;
  }

  function selectVersion(i) {
    state.active = i;
    el.editor.value = state.versions[i];
    Array.prototype.forEach.call(el.tabs.children, function (b, idx) {
      b.setAttribute('aria-selected', idx === i ? 'true' : 'false');
    });
    autosize();
    updateWordCount();
  }

  function renderResult() {
    el.empty.hidden = true;
    el.skeleton.hidden = true;
    el.editorWrap.hidden = false;
    renderTabs();
    selectVersion(state.active);
  }

  el.editor.addEventListener('input', function () {
    state.versions[state.active] = el.editor.value;
    autosize();
    updateWordCount();
  });

  /* ------------------------------ form -> payload ------------------------------ */
  function readForm() {
    var name = el.name.value.trim();
    if (!name) { showError('Student name is required.'); el.name.focus(); return null; }
    if (!el.pronoun.value) { showError('Please select a preferred pronoun (He / She / They).'); el.pronoun.focus(); return null; }
    var positives = checkedValues(el.positives);
    if (!positives.length) { showError('Please select at least one positive attribute.'); return null; }

    return {
      name: name,
      pronoun: el.pronoun.value,
      level: $('level').value,
      language: LANGUAGE,
      tone: $('tone').value,
      length: $('length').value,
      variations: parseInt($('variations').value, 10) || 1,
      positives: positives,
      areas: checkedValues(el.areas),
      notes: el.notes.value.trim()
    };
  }

  /* ------------------------------ API ------------------------------ */
  function callApi(payload) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 40000);
    var headers = { 'Content-Type': 'application/json' };
    var code = read(KEY_CODE);
    if (code) headers['x-access-code'] = code;

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: ctrl.signal
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.status === 401) {
          var authErr = new Error('Access code required.');
          authErr.code = 'AUTH';
          throw authErr;
        }
        if (!res.ok || !data || !Array.isArray(data.comments) || !data.comments.length) {
          throw new Error((data && data.error) || 'A server error occurred (' + res.status + ').');
        }
        return data;
      });
    }, function (err) {
      throw new Error(err && err.name === 'AbortError'
        ? 'The request took too long. Please try again.'
        : 'Could not reach the server. Please check your internet connection.');
    }).then(function (data) {
      clearTimeout(timer);
      return data;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function generate() {
    if (state.busy) return;
    clearError();
    var payload = readForm();
    if (!payload) return;

    setBusy(true);
    callApi(payload).then(function (data) {
      state.versions = data.comments.slice();
      state.active = 0;
      state.studentName = payload.name;
      setBusy(false);
      renderResult();
      if (window.matchMedia && window.matchMedia('(max-width: 979px)').matches) {
        el.editorWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }).catch(function (err) {
      setBusy(false);
      if (state.versions.length) renderResult(); else el.empty.hidden = false;
      if (err.code === 'AUTH') {
        var hadCode = !!read(KEY_CODE);
        remove(KEY_CODE);
        askForCode(hadCode);
      } else {
        showError(err.message);
      }
    });
  }

  /* ------------------------------ access code dialog ------------------------------ */
  function askForCode(wrong) {
    el.codeHint.textContent = wrong
      ? 'Wrong access code. Please try again.'
      : 'Enter the access code to use this generator.';
    el.codeInput.value = '';
    if (typeof el.codeDialog.showModal === 'function') {
      el.codeDialog.showModal();
      el.codeInput.focus();
    } else {
      var v = window.prompt(el.codeHint.textContent);
      if (v) { store(KEY_CODE, v.trim()); generate(); }
    }
  }

  el.codeForm.addEventListener('submit', function () {
    var v = el.codeInput.value.trim();
    if (v) {
      store(KEY_CODE, v);
      setTimeout(generate, 0);
    }
  });
  el.codeCancel.addEventListener('click', function () { el.codeDialog.close(); });

  /* ------------------------------ history ------------------------------ */
  function loadHistory() {
    try {
      var raw = read(KEY_HISTORY);
      var arr = raw ? JSON.parse(raw) : [];
      state.history = Array.isArray(arr) ? arr.filter(function (h) { return h && h.name && h.text; }) : [];
    } catch (e) { state.history = []; }
  }

  function persistHistory() { store(KEY_HISTORY, JSON.stringify(state.history)); }

  function mkLink(text, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'link';
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }

  function renderHistory() {
    el.historyList.innerHTML = '';
    var n = state.history.length;
    el.historyBox.hidden = n === 0;
    el.historyCount.textContent = n ? '(' + n + ')' : '';
    state.history.forEach(function (h) {
      var li = document.createElement('li');
      li.className = 'history__item';

      var top = document.createElement('div');
      top.className = 'history__top';
      var nm = document.createElement('span');
      nm.className = 'history__name';
      nm.textContent = h.name;

      var btns = document.createElement('div');
      btns.className = 'history__btns';
      var open = mkLink('Open', function () {
        state.versions = [h.text];
        state.active = 0;
        state.studentName = h.name;
        renderResult();
        el.editorWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      var cp = mkLink('Copy', function () { doCopy(h.text, h.name + "'s comment copied ✓"); });
      var del = mkLink('Delete', function () {
        state.history = state.history.filter(function (x) { return x.id !== h.id; });
        persistHistory();
        renderHistory();
      });
      del.classList.add('link--danger');
      btns.appendChild(open); btns.appendChild(cp); btns.appendChild(del);

      top.appendChild(nm); top.appendChild(btns);
      var sn = document.createElement('p');
      sn.className = 'history__snippet';
      sn.textContent = h.text;
      li.appendChild(top); li.appendChild(sn);
      el.historyList.appendChild(li);
    });
  }

  function saveCurrent() {
    var text = el.editor.value.trim();
    if (!text) { toast('There is no comment to save yet.'); return; }
    var name = state.studentName || 'Student';
    var found = null;
    state.history.forEach(function (h) { if (h.name.toLowerCase() === name.toLowerCase()) found = h; });
    if (found) {
      found.text = text; found.ts = Date.now();
      toast(name + "'s comment updated in the list ✓");
    } else {
      state.history.unshift({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name: name, text: text, ts: Date.now() });
      toast('Saved to list ✓');
    }
    persistHistory();
    renderHistory();
  }

  /* ------------------------------ events ------------------------------ */
  el.form.addEventListener('submit', function (e) { e.preventDefault(); generate(); });
  el.regenBtn.addEventListener('click', generate);

  el.resetBtn.addEventListener('click', function () {
    el.form.reset();
    el.notesCount.textContent = '0';
    clearError();
    updatePosCount();
    loadSettings();
    el.name.focus();
  });

  el.copyBtn.addEventListener('click', function () {
    var t = el.editor.value.trim();
    if (t) doCopy(t, 'Comment copied ✓');
  });
  el.saveBtn.addEventListener('click', saveCurrent);

  el.printBtn.addEventListener('click', function () {
    var t = el.editor.value.trim();
    if (!t) return;
    el.printName.textContent = state.studentName || '';
    el.printText.textContent = t;
    window.print();
  });

  el.copyAllBtn.addEventListener('click', function () {
    var all = state.history.map(function (h) { return h.name + '\n' + h.text; }).join('\n\n');
    if (all) doCopy(all, 'All comments copied ✓');
  });

  el.clearAllBtn.addEventListener('click', function () {
    if (window.confirm('Delete all comments saved on this device?')) {
      state.history = [];
      persistHistory();
      renderHistory();
    }
  });

  window.addEventListener('resize', function () { if (!el.editorWrap.hidden) autosize(); });

  /* ------------------------------ init ------------------------------ */
  renderChips(el.positives, POSITIVE, 'positives');
  renderChips(el.areas, AREAS, 'areas');
  loadSettings();
  loadHistory();
  renderHistory();
  updatePosCount();
})();
