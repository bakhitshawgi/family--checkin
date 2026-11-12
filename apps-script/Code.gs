/** @OnlyCurrentDoc */
/**
 * Family prayer check-in – Google Apps Script.
 * Paste into the family sheet: Extensions → Apps Script → replace everything → Save →
 * Deploy → Manage deployments → ✏️ → Version: New version → Deploy (keeps the same URL).
 *
 * Tabs it uses (created automatically):
 *   Log      – every prayer:   Timestamp | Child | Prayer | Marked by
 *   Notes    – parents' notes: Date | Child | Prayer | Note | By | Updated
 *   Tasks    – ID | Created | By | Child | Type | Title | Due | Status | Rating | Updated | Child note
 *   Requests – ID | Created | Child | Text | Audio ID | Status | Decided by | Decided | Reply
 *   Audio    – voice requests, split into chunks: ID | Part | Mime | Data
 *   Profiles – User | Photo | Updated
 *   Visits   – Time | User | Event | IP | City | Region | Country | Device | Browser | User agent  (Dad only)
 */

// Change these passwords before you deploy.
const ACCOUNTS = {
  Yousuf: 'yousuf-CHANGE-ME',
  Eva:    'eva-CHANGE-ME',
  Dad:    'dad-CHANGE-ME',
  Mom:    'mom-CHANGE-ME',
};

const ADMIN = 'Dad';              // can remove wrong prayer entries
const PARENTS = ['Dad', 'Mom'];   // see both children, mark prayers, notes, tasks, decide requests
const KIDS = ['Yousuf', 'Eva'];
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const TASK_TYPES = ['Homework', 'Quran', 'Reading', 'Chores', 'Sports', 'Behaviour', 'Other'];
const TZ = 'America/Toronto';
const UNDO_MINUTES = 15;
const MARK_LIMIT_HOURS = 24;      // a prayer can't be marked more than 24 h after its time started
const CELL = 45000;               // Google Sheets cell limit is 50,000 characters

function doGet(e) { return out_(handle_((e && e.parameter) || {})); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: 'bad', message: 'Bad request.' }); }
  return out_(handle_(p));
}

function handle_(p) {
  const user = p.user;
  if (!user || !ACCOUNTS.hasOwnProperty(user) || ACCOUNTS[user] !== p.pass) {
    Utilities.sleep(800); // slow down guessing
    return { ok: false, error: 'login', message: 'Wrong name or password.' };
  }
  const isAdmin = user === ADMIN, isParent = PARENTS.indexOf(user) >= 0;
  const action = p.action || 'list';
  const bad = m => ({ ok: false, error: 'bad', message: m });

  if (action === 'login') return { ok: true, user: user, admin: isAdmin, viewAll: isParent, kids: KIDS };

  /* ---------- profile photos ---------- */
  if (action === 'photos') {
    const sh = sheet_('Profiles', ['User', 'Photo', 'Updated']), n = sh.getLastRow();
    const photos = {};
    if (n > 1) sh.getRange(2, 1, n - 1, 3).getValues().forEach(r => { if (r[1]) photos[r[0]] = String(r[1]); });
    return { ok: true, photos: photos };
  }
  if (action === 'photo_set') {
    const who = p.who || user;
    if (who !== user && !(isParent && KIDS.indexOf(who) >= 0)) return bad('You can only change your own photo.');
    const img = String(p.photo || '');
    if (img && !/^data:image\/(jpeg|png|webp);base64,/.test(img)) return bad('That is not a picture.');
    if (img.length > CELL) return bad('The picture is too big.');
    return locked_(() => {
      const sh = sheet_('Profiles', ['User', 'Photo', 'Updated']);
      const row = findRow_(sh, 1, who);
      if (!img) { if (row) sh.deleteRow(row); return { ok: true }; }
      if (row) sh.getRange(row, 2, 1, 2).setValues([[img, new Date()]]); else sh.appendRow([who, img, new Date()]);
      return { ok: true };
    });
  }

  /* ---------- notes on a prayer (parents only) ---------- */
  if (action === 'note') {
    if (!isParent) return bad('Only Mom and Dad can write notes.');
    if (KIDS.indexOf(p.child) < 0 || PRAYERS.indexOf(p.prayer) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return bad('Bad note.');
    const text = String(p.note || '').trim().slice(0, 300);
    return locked_(() => {
      const ns = notesSheet_(), last = ns.getLastRow();
      const vals = last < 2 ? [] : ns.getRange(2, 1, last - 1, 3).getValues();
      let row = -1;
      for (let i = 0; i < vals.length; i++) if (dayStr_(vals[i][0]) === p.date && vals[i][1] === p.child && vals[i][2] === p.prayer) { row = i + 2; break; }
      if (!text) { if (row > 0) ns.deleteRow(row); return { ok: true, cleared: true }; }
      const data = [[p.date, p.child, p.prayer, text, user, new Date()]];
      if (row > 0) ns.getRange(row, 1, 1, 6).setValues(data); else ns.appendRow(data[0]);
      return { ok: true, at: Date.now() };
    });
  }

  /* ---------- tasks ---------- */
  const TASK_HEAD = ['ID', 'Created', 'By', 'Child', 'Type', 'Title', 'Due', 'Status', 'Rating', 'Updated', 'Child note'];
  if (action === 'task_save') {                      // parents: create or edit
    if (!isParent) return bad('Only Mom and Dad can create tasks.');
    if (KIDS.indexOf(p.child) < 0) return bad('Choose Yousuf or Eva.');
    const title = String(p.title || '').trim().slice(0, 200);
    if (!title) return bad('Write what the task is.');
    const type = TASK_TYPES.indexOf(p.type) >= 0 ? p.type : 'Other';
    const due = /^\d{4}-\d{2}-\d{2}$/.test(p.due || '') ? p.due : '';
    return locked_(() => {
      const sh = sheet_('Tasks', TASK_HEAD, [1, 7]);
      if (p.id) {
        const row = findRow_(sh, 1, p.id); if (!row) return bad('Task not found.');
        sh.getRange(row, 4, 1, 4).setValues([[p.child, type, title, due]]); sh.getRange(row, 10).setValue(new Date());
        return { ok: true, id: p.id };
      }
      const id = 't' + Date.now().toString(36);
      sh.appendRow([id, new Date(), user, p.child, type, title, due, 'todo', '', new Date(), '']);
      return { ok: true, id: id };
    });
  }
  if (action === 'task_status' || action === 'task_rate' || action === 'task_delete') {
    return locked_(() => {
      const sh = sheet_('Tasks', TASK_HEAD, [1, 7]), row = findRow_(sh, 1, p.id);
      if (!row) return bad('Task not found.');
      const r = sh.getRange(row, 1, 1, 11).getValues()[0];
      if (!isParent && r[3] !== user) return bad('This is not your task.');
      if (action === 'task_delete') { if (!isParent) return bad('Only Mom and Dad can delete tasks.'); sh.deleteRow(row); return { ok: true }; }
      if (action === 'task_rate') {
        if (!isParent) return bad('Only Mom and Dad can rate tasks.');
        if (r[7] === 'todo') return bad('Rate a task after it is done or partly done.');
        const stars = Math.max(0, Math.min(5, Math.round(Number(p.stars) || 0)));
        sh.getRange(row, 9, 1, 2).setValues([[stars || '', new Date()]]);
        return { ok: true };
      }
      const st = ['todo', 'partial', 'done'].indexOf(p.status) >= 0 ? p.status : null;
      if (!st) return bad('Bad status.');
      if (!isParent && r[8]) return bad('This task is already rated.');
      sh.getRange(row, 8).setValue(st); sh.getRange(row, 10).setValue(new Date());
      if (st === 'todo') sh.getRange(row, 9).setValue('');
      if (!isParent && p.note != null) sh.getRange(row, 11).setValue(String(p.note).trim().slice(0, 200));
      return { ok: true };
    });
  }

  /* ---------- requests (children ask, parents decide) ---------- */
  const REQ_HEAD = ['ID', 'Created', 'Child', 'Text', 'Audio ID', 'Status', 'Decided by', 'Decided', 'Reply'];
  if (action === 'request_add') {
    if (KIDS.indexOf(user) < 0) return bad('Only Yousuf and Eva can send requests.');
    const text = String(p.text || '').trim().slice(0, 500);
    const audio = String(p.audio || '');
    if (!text && !audio) return bad('Write or record your request.');
    if (audio && !/^data:audio\/[\w.+-]+(;[\w=.+-]+)*;base64,/.test(audio)) return bad('Bad recording.');
    if (audio.length > CELL * 12) return bad('The recording is too long (keep it under a minute).');
    return locked_(() => {
      const id = 'r' + Date.now().toString(36);
      let audioId = '';
      if (audio) {
        audioId = 'a' + Date.now().toString(36);
        const as = sheet_('Audio', ['ID', 'Part', 'Mime', 'Data']);
        const mime = audio.slice(5, audio.indexOf(';')), data = audio.slice(audio.indexOf('base64,') + 7);
        const rows = [];
        for (let i = 0, part = 0; i < data.length; i += CELL, part++) rows.push([audioId, part, mime, data.slice(i, i + CELL)]);
        as.getRange(as.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
      }
      sheet_('Requests', REQ_HEAD).appendRow([id, new Date(), user, text, audioId, 'pending', '', '', '']);
      return { ok: true, id: id };
    });
  }
  if (action === 'request_decide' || action === 'request_delete') {
    return locked_(() => {
      const sh = sheet_('Requests', REQ_HEAD), row = findRow_(sh, 1, p.id);
      if (!row) return bad('Request not found.');
      const r = sh.getRange(row, 1, 1, 9).getValues()[0];
      if (action === 'request_delete') {
        if (!(isParent || (r[2] === user && r[5] === 'pending'))) return bad('You can only delete your own request before it is answered.');
        if (r[4]) deleteAudio_(r[4]);
        sh.deleteRow(row); return { ok: true };
      }
      if (!isParent) return bad('Only Mom and Dad can answer requests.');
      const st = ['approved', 'declined', 'pending'].indexOf(p.status) >= 0 ? p.status : null;
      if (!st) return bad('Bad answer.');
      sh.getRange(row, 6, 1, 4).setValues([[st, st === 'pending' ? '' : user, st === 'pending' ? '' : new Date(), String(p.reply || '').trim().slice(0, 300)]]);
      return { ok: true };
    });
  }
  if (action === 'audio') {
    const rq = sheet_('Requests', REQ_HEAD), n = rq.getLastRow();
    const owner = n < 2 ? null : rq.getRange(2, 1, n - 1, 5).getValues().find(r => r[4] === p.id);
    if (!owner || !(isParent || owner[2] === user)) return bad('Recording not found.');
    const as = sheet_('Audio', ['ID', 'Part', 'Mime', 'Data']), an = as.getLastRow();
    const parts = an < 2 ? [] : as.getRange(2, 1, an - 1, 4).getValues().filter(r => r[0] === p.id).sort((a, b) => a[1] - b[1]);
    if (!parts.length) return bad('Recording not found.');
    return { ok: true, audio: 'data:' + parts[0][2] + ';base64,' + parts.map(r => r[3]).join('') };
  }

  /* ---------- sign-in activity (only Dad can read it) ---------- */
  const VISIT_HEAD = ['Time', 'User', 'Event', 'IP', 'City', 'Region', 'Country', 'Device', 'Browser', 'User agent'];
  if (action === 'visit') {                          // the page reports each sign-in / app open
    const s = v => String(v || '').slice(0, 120);
    return locked_(() => {
      sheet_('Visits', VISIT_HEAD).appendRow([new Date(), user, p.event === 'login' ? 'Sign-in' : 'Opened', s(p.ip), s(p.city), s(p.region), s(p.country), s(p.device), s(p.browser), String(p.ua || '').slice(0, 300)]);
      return { ok: true };
    });
  }
  if (action === 'visits') {
    if (!isAdmin) return bad('Only Dad can see this.');
    const since = Number(p.since || 0), vs = sheet_('Visits', VISIT_HEAD), vl = vs.getLastRow();
    const from = Math.max(2, vl - 1999);               // newest 2000 at most
    const visits = vl < 2 ? [] : vs.getRange(from, 1, vl - from + 1, 9).getValues()
      .filter(r => r[0] instanceof Date && r[0].getTime() >= since)
      .map(r => [r[0].getTime()].concat(r.slice(1).map(String)));
    return { ok: true, visits: visits };
  }

  /* ---------- prayers ---------- */
  const sh = logSheet_();
  if (action === 'add' || action === 'undo' || action === 'remove') {
    const child = isParent ? p.child : user;         // a child can only act for themselves; parents choose the child
    if (KIDS.indexOf(child) < 0) return bad('Unknown child.');
    if (action !== 'remove' && PRAYERS.indexOf(p.prayer) < 0) return bad('Unknown prayer.');
    if (action === 'remove' && !isAdmin) return bad('Only Dad can remove entries.');
    return locked_(() => {
      if (action === 'add') {
        let at = Date.now();
        if (isParent && p.at) at = Number(p.at);
        const limit = MARK_LIMIT_HOURS * 3600e3;
        if (!(at <= Date.now() + 60e3)) return bad('That time is in the future.');
        if (Date.now() - at > limit) return bad('More than 24 hours have passed. It can no longer be marked.');
        if (p.start && Date.now() - Number(p.start) > limit) return bad('More than 24 hours have passed since this prayer\'s time. It can no longer be marked.');
        sh.appendRow([new Date(at), child, p.prayer, user]);
        return { ok: true, at: at };
      }
      const last = sh.getLastRow();
      if (last < 2) return bad('Nothing to remove.');
      const vals = sh.getRange(2, 1, last - 1, 3).getValues();
      if (action === 'remove') {                       // Dad: remove one exact entry
        const at = Number(p.at);
        for (let i = vals.length - 1; i >= 0; i--) {
          if (vals[i][0] instanceof Date && vals[i][0].getTime() === at && vals[i][1] === child) { sh.deleteRow(i + 2); return { ok: true, removed: at }; }
        }
        return bad('Entry not found.');
      }
      const limit = Date.now() - UNDO_MINUTES * 60000; // undo a recent tap
      for (let i = vals.length - 1; i >= 0; i--) {
        const ts = vals[i][0];
        if (!(ts instanceof Date) || ts.getTime() < limit) break;
        if (vals[i][1] === child && vals[i][2] === p.prayer) { sh.deleteRow(i + 2); return { ok: true, undone: ts.getTime() }; }
      }
      return { ok: false, error: 'undo', message: 'Undo only works within ' + UNDO_MINUTES + ' minutes.' };
    });
  }

  /* ---------- list: everything the page shows ---------- */
  const since = Number(p.since || 0);
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, 4).getValues()
    .filter(r => r[0] instanceof Date && r[0].getTime() >= since && (isParent || r[1] === user))
    .map(r => [r[0].getTime(), String(r[1]), String(r[2]), String(r[3] || r[1])]);
  let notes = [];
  if (isParent) {                                    // notes are only sent to Mom and Dad
    const sinceDay = Utilities.formatDate(new Date(since), TZ, 'yyyy-MM-dd');
    const ns = notesSheet_(), nl = ns.getLastRow();
    notes = nl < 2 ? [] : ns.getRange(2, 1, nl - 1, 6).getValues()
      .map(r => [dayStr_(r[0]), String(r[1]), String(r[2]), String(r[3]), String(r[4]), ms_(r[5])])
      .filter(r => r[0] >= sinceDay);
  }
  const ts = sheet_('Tasks', TASK_HEAD, [1, 7]), tl = ts.getLastRow();
  const tasks = tl < 2 ? [] : ts.getRange(2, 1, tl - 1, 11).getValues()
    .filter(r => r[0] && (isParent || r[3] === user) && (r[7] !== 'done' || ms_(r[9]) >= since))
    .map(r => ({ id: String(r[0]), created: ms_(r[1]), by: String(r[2]), child: String(r[3]), type: String(r[4]), title: String(r[5]),
                 due: dayStr_(r[6]), status: String(r[7] || 'todo'), rating: Number(r[8]) || 0, updated: ms_(r[9]), childNote: String(r[10] || '') }));
  const rs = sheet_('Requests', REQ_HEAD), rl = rs.getLastRow();
  const requests = rl < 2 ? [] : rs.getRange(2, 1, rl - 1, 9).getValues()
    .filter(r => r[0] && (isParent || r[2] === user) && (r[5] === 'pending' || ms_(r[1]) >= since))
    .map(r => ({ id: String(r[0]), created: ms_(r[1]), child: String(r[2]), text: String(r[3]), audio: String(r[4] || ''),
                 status: String(r[5] || 'pending'), decidedBy: String(r[6] || ''), decided: ms_(r[7]), reply: String(r[8] || '') }));
  const pf = sheet_('Profiles', ['User', 'Photo', 'Updated']), pl = pf.getLastRow();
  const photosAt = pl < 2 ? 0 : Math.max.apply(null, pf.getRange(2, 3, pl - 1, 1).getValues().map(r => ms_(r[0])));
  return { ok: true, user: user, admin: isAdmin, viewAll: isParent, rows: rows, notes: notes, tasks: tasks, requests: requests,
           taskTypes: TASK_TYPES, photosAt: photosAt, now: Date.now() };
}

/* ---------- helpers ---------- */
function sheet_(name, head, textCols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    (textCols || []).forEach(c => sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'));
    sh.setFrozenRows(1);
  }
  return sh;
}
function logSheet_() { return sheet_('Log', ['Timestamp', 'Child', 'Prayer', 'Marked by']); }
function notesSheet_() { return sheet_('Notes', ['Date', 'Child', 'Prayer', 'Note', 'By', 'Updated'], [1]); }
function findRow_(sh, col, value) {
  const n = sh.getLastRow(); if (n < 2) return 0;
  const vals = sh.getRange(2, col, n - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return 0;
}
function deleteAudio_(id) {
  const as = sheet_('Audio', ['ID', 'Part', 'Mime', 'Data']);
  for (let r = as.getLastRow(); r >= 2; r--) if (as.getRange(r, 1).getValue() === id) as.deleteRow(r);
}
function locked_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function dayStr_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || ''); }
function ms_(v) { return v instanceof Date ? v.getTime() : 0; }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
