/** @OnlyCurrentDoc */
/**
 * Family prayer check-in – Google Apps Script.
 * Paste into the family sheet: Extensions → Apps Script → replace everything → Save →
 * Deploy → Manage deployments → ✏️ → Version: New version → Deploy (keeps the same URL).
 *
 * Tabs it uses (created automatically):
 *   Log      – every prayer:   Timestamp | Child | Prayer | Marked by | Lat | Lng | Place | Type | Mosque name | Mosque address  (no place = Toronto; Type "Jumuah" = Friday Dhuhr prayed as Jumu'ah, "Mosque" = prayed at the mosque)
 *   Notes    – parents' notes: Date | Child | Prayer | Note | By | Updated
 *   Tasks    – ID | Created | By | Child | Type | Title | Due | Status | Rating | Updated | Child note
 *   Requests – ID | Created | Child | Text | Audio ID | Status | Decided by | Decided | Reply
 *   Audio    – voice requests, split into chunks: ID | Part | Mime | Data
 *   Profiles – User | Photo | Updated
 *   Quran    – ID | Created | Child | Surah | Ayahs | Points | Status | Decided by | Decided | Audio ID | Note | Mode | Helper | Link
 *              Status: pending / approved / review (practice more) / known / archived (undone) / refresher (+2 review) / helper (+7)
 *   Visits   – Time | User | Event | IP | City | Region | Country | Device | Browser | User agent  (children only; Dad sees it)
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
// Quran memorization: surahs of up to 20 verses for now. Up to 10 verses = 10 points, 11–20 verses = 15 points.
const SURAHS = { 1: 7, 82: 19, 86: 17, 87: 19, 90: 20, 91: 15, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11, 101: 11,
  102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3, 111: 5, 112: 4, 113: 5, 114: 6 };
const surahPoints_ = n => SURAHS[n] <= 10 ? 10 : 15;
const REVIEW_POINTS = 2, REVIEWS_PER_WEEK = 2;    // reciting a memorized surah again (microphone): 2 points, twice a week per surah
const REVIEW_WEEK_MAX = 10;                       // and at most 10 reviews a week per child (10 × 2 points = $5)
const HELPER_POINTS = 7;                          // helping the other child memorize a surah (after Mom or Dad approves it)
// week key = the Sunday the week starts on (Toronto), e.g. "2026-11-22"
function weekKey_(d) {
  const ymd = Utilities.formatDate(new Date(d), TZ, 'yyyy-MM-dd').split('-').map(Number);
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(Utilities.formatDate(new Date(d), TZ, 'EEE'));
  const sun = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2] - dow));
  return Utilities.formatDate(sun, 'UTC', 'yyyy-MM-dd');
}

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
  const QURAN_HEAD = ['ID', 'Created', 'Child', 'Surah', 'Ayahs', 'Points', 'Status', 'Decided by', 'Decided', 'Audio ID', 'Note', 'Mode', 'Helper', 'Link'];
  const quranSheet_ = () => { const q = sheet_('Quran', QURAN_HEAD);
    if (q.getMaxColumns() < 14) q.insertColumnsAfter(q.getMaxColumns(), 14 - q.getMaxColumns());
    if (q.getRange(1, 13).getValue() === '') q.getRange(1, 13, 1, 2).setValues([['Helper', 'Link']]); return q; };
  // helper bonus rows: Status "helper", Link = the surah record they belong to
  const addHelper_ = (qs, r, by) => {
    const helper = String(r[12] || ''); if (!helper || KIDS.indexOf(helper) < 0 || helper === r[2]) return;
    const qn = qs.getLastRow(), has = qn < 2 ? false : qs.getRange(2, 14, qn - 1, 1).getValues().some(x => x[0] === r[0]);
    if (has) return;
    qs.appendRow(['h' + Date.now().toString(36), new Date(), helper, Number(r[3]), Number(r[4]), HELPER_POINTS, 'helper', by, new Date(), '', 'Helped ' + r[2], 'helper', '', r[0]]);
  };
  const dropHelpers_ = (qs, id) => { for (let i = qs.getLastRow(); i >= 2; i--) if (qs.getRange(i, 14).getValue() === id) qs.deleteRow(i); };
  if (action === 'request_add') {
    if (KIDS.indexOf(user) < 0) return bad('Only Yousuf and Eva can send requests.');
    const text = String(p.text || '').trim().slice(0, 500);
    const audio = normAudio_(p.audio);
    if (!text && !audio) return bad('Write or record your request.');
    if (p.audio && !audio) return bad('Bad recording.');
    if (audio.length > CELL * 60) return bad('The recording is too big (about 2 MB at most).');
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
  /* ---------- Quran memorization ---------- */
  if (action === 'quran_submit') {                   // child: "I memorized this surah" (with a recording, or recited to Dad / Mom)
    if (KIDS.indexOf(user) < 0) return bad('Only Yousuf and Eva can send a recitation.');
    const n = Number(p.surah); if (!SURAHS[n]) return bad('Choose a surah from the list.');
    const audio = normAudio_(p.audio);
    if (p.audio && !audio) return bad('Bad recording.');
    if (audio.length > CELL * 60) return bad('The recording is too big (about 2 MB at most).');
    return locked_(() => {
      const qs = quranSheet_(), qn = qs.getLastRow();
      const open = qn < 2 ? [] : qs.getRange(2, 1, qn - 1, 7).getValues().filter(r => r[2] === user && Number(r[3]) === n && ['pending', 'approved', 'known'].indexOf(r[6]) >= 0);
      if (open.length) return bad(open[0][6] === 'pending' ? 'This surah is already waiting for Mom or Dad.' : 'This surah is already counted.');
      const helper = KIDS.indexOf(p.helper) >= 0 && p.helper !== user ? p.helper : '';
      const id = 'q' + Date.now().toString(36), audioId = audio ? saveAudio_(audio) : '';
      qs.appendRow([id, new Date(), user, n, SURAHS[n], surahPoints_(n), 'pending', '', '', audioId, '', audio ? 'audio' : 'live', helper, '']);
      return { ok: true, id: id };
    });
  }
  if (action === 'quran_review') {                   // child: recites a surah they already memorized – +2, up to twice a week per surah
    if (KIDS.indexOf(user) < 0) return bad('Only Yousuf and Eva can send a review.');
    const n = Number(p.surah); if (!SURAHS[n]) return bad('Choose a surah from the list.');
    const audio = normAudio_(p.audio); if (!audio) return bad('Record yourself reciting the surah first.');
    if (audio.length > CELL * 60) return bad('The recording is too big (about 2 MB at most).');
    return locked_(() => {
      const qs = quranSheet_(), qn = qs.getLastRow(), vals = qn < 2 ? [] : qs.getRange(2, 1, qn - 1, 7).getValues();
      if (!vals.some(r => r[2] === user && Number(r[3]) === n && (r[6] === 'approved' || r[6] === 'known'))) return bad('You can review a surah after Mom or Dad have counted it as memorized.');
      const wk = weekKey_(new Date());
      const done = vals.filter(r => r[2] === user && Number(r[3]) === n && r[6] === 'refresher' && r[1] instanceof Date && weekKey_(r[1]) === wk).length;
      if (done >= REVIEWS_PER_WEEK) return bad('You already reviewed this surah ' + REVIEWS_PER_WEEK + ' times this week. Try another one!');
      const weekAll = vals.filter(r => r[2] === user && r[6] === 'refresher' && r[1] instanceof Date && weekKey_(r[1]) === wk).length;
      if (weekAll >= REVIEW_WEEK_MAX) return bad('You reached this week\'s limit of ' + REVIEW_WEEK_MAX + ' reviews. Great job! More next week (from Sunday).');
      const id = 'r' + Date.now().toString(36), audioId = saveAudio_(audio);
      qs.appendRow([id, new Date(), user, n, SURAHS[n], REVIEW_POINTS, 'refresher', 'auto', new Date(), audioId, '', 'review', '', '']);
      return { ok: true, id: id, left: REVIEWS_PER_WEEK - done - 1 };
    });
  }
  if (action === 'quran_decide' || action === 'quran_mark' || action === 'quran_delete') {
    if (!isParent) return bad('Only Mom and Dad can do this.');
    return locked_(() => {
      const qs = quranSheet_();
      if (action === 'quran_mark') {                 // parent: heard it in person (award) or "already knew it" (no points)
        const n = Number(p.surah); if (!SURAHS[n] || KIDS.indexOf(p.child) < 0) return bad('Choose a child and a surah.');
        const st = p.status === 'known' ? 'known' : 'approved', qn = qs.getLastRow();
        const done = qn < 2 ? [] : qs.getRange(2, 1, qn - 1, 7).getValues().filter(r => r[2] === p.child && Number(r[3]) === n && ['approved', 'known'].indexOf(r[6]) >= 0);
        if (done.length) return bad('This surah is already counted for ' + p.child + '.');
        const id = 'q' + Date.now().toString(36), helper = st === 'approved' && KIDS.indexOf(p.helper) >= 0 && p.helper !== p.child ? p.helper : '';
        const rowv = [id, new Date(), p.child, n, SURAHS[n], st === 'approved' ? surahPoints_(n) : 0, st, user, new Date(), '', String(p.note || '').slice(0, 200), 'live', helper, ''];
        qs.appendRow(rowv); if (helper) addHelper_(qs, rowv, user);
        return { ok: true, id: id };
      }
      const row = findRow_(qs, 1, p.id); if (!row) return bad('Not found.');
      const r = qs.getRange(row, 1, 1, 14).getValues()[0];
      if (action === 'quran_delete') {                // undo: no points; a recording is kept (status "archived"), otherwise the row goes
        dropHelpers_(qs, r[0]);
        const row2 = findRow_(qs, 1, p.id); if (!row2) return { ok: true };
        if (r[9]) { qs.getRange(row2, 6, 1, 4).setValues([[0, 'archived', user, new Date()]]); return { ok: true }; }
        qs.deleteRow(row2); return { ok: true };
      }
      const st = ['approved', 'review', 'known'].indexOf(p.status) >= 0 ? p.status : null; if (!st) return bad('Bad answer.');
      qs.getRange(row, 6, 1, 4).setValues([[st === 'approved' ? surahPoints_(Number(r[3])) : 0, st, user, new Date()]]);
      qs.getRange(row, 11).setValue(String(p.note || '').slice(0, 200));
      if (st === 'approved') addHelper_(qs, r, user); else dropHelpers_(qs, r[0]);   // the helper gets 7 points only when it is approved
      return { ok: true };
    });
  }

  if (action === 'audio') {
    const rq = sheet_('Requests', REQ_HEAD), n = rq.getLastRow();
    let owner = n < 2 ? null : rq.getRange(2, 1, n - 1, 5).getValues().find(r => r[4] === p.id);
    if (!owner) { const qs = sheet_('Quran', QURAN_HEAD), qn = qs.getLastRow();
      const q = qn < 2 ? null : qs.getRange(2, 1, qn - 1, 10).getValues().find(r => r[9] === p.id); if (q) owner = [0, 0, q[2]]; }
    if (!owner || !(isParent || owner[2] === user)) return bad('Recording not found.');
    const as = sheet_('Audio', ['ID', 'Part', 'Mime', 'Data']), an = as.getLastRow();
    const parts = an < 2 ? [] : as.getRange(2, 1, an - 1, 4).getValues().filter(r => r[0] === p.id).sort((a, b) => a[1] - b[1]);
    if (!parts.length) return bad('Recording not found.');
    return { ok: true, audio: 'data:' + parts[0][2] + ';base64,' + parts.map(r => r[3]).join('') };
  }

  /* ---------- sign-in activity (only Dad can read it) ---------- */
  const VISIT_HEAD = ['Time', 'User', 'Event', 'IP', 'City', 'Region', 'Country', 'Device', 'Browser', 'User agent'];
  if (action === 'visit') {                          // the page reports each sign-in / app open – children only
    if (KIDS.indexOf(user) < 0) return { ok: true, skipped: true };
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
      .filter(r => r[0] instanceof Date && r[0].getTime() >= since && KIDS.indexOf(r[1]) >= 0)
      .map(r => [r[0].getTime()].concat(r.slice(1).map(String)));
    return { ok: true, visits: visits };
  }

  /* ---------- change "prayed at the mosque" on an earlier prayer (Mom and Dad) ---------- */
  if (action === 'edit_kind') {                      // Mom and Dad: change a recorded prayer – time (same day), where, mosque
    if (!isParent) return bad('Only Mom and Dad can change this.');
    if (KIDS.indexOf(p.child) < 0 && p.child !== user) return bad('You can only change your own prayers or the children\'s.');
    const at = Number(p.at), newAt = p.newAt ? Number(p.newAt) : at;
    return locked_(() => {
      const lg = logSheet_(), n = lg.getLastRow(); if (n < 2) return bad('Prayer not found.');
      const vals = lg.getRange(2, 1, n - 1, 8).getValues();
      for (let i = vals.length - 1; i >= 0; i--) {
        if (vals[i][0] instanceof Date && vals[i][0].getTime() === at && vals[i][1] === p.child) {
          const day = d => Utilities.formatDate(new Date(d), TZ, 'yyyy-MM-dd');
          if (!(newAt <= Date.now() + 60e3)) return bad('That time is in the future.');
          if (day(newAt) !== day(at)) return bad('The time has to stay on the same day.');
          const friDhuhr = vals[i][2] === 'Dhuhr' && Utilities.formatDate(new Date(newAt), TZ, 'EEE') === 'Fri';
          const kind = p.kind === 'Jumuah' && friDhuhr ? 'Jumuah' : p.kind === 'Mosque' ? 'Mosque' : '';
          const mosque = kind === 'Mosque';
          lg.getRange(i + 2, 1).setValue(new Date(newAt));
          lg.getRange(i + 2, 8, 1, 3).setValues([[kind, mosque ? String(p.mosqueName || '').trim().slice(0, 60) : '', mosque ? String(p.mosqueAddr || '').trim().slice(0, 150) : '']]);
          return { ok: true, at: newAt };
        }
      }
      return bad('Prayer not found.');
    });
  }

  /* ---------- prayers ---------- */
  const sh = logSheet_();
  if (action === 'add' || action === 'undo' || action === 'remove') {
    const child = isParent ? (p.child || user) : user; // a child acts only for themselves; a parent for a child or for themselves
    const ok = KIDS.indexOf(child) >= 0 || child === user || (isAdmin && action === 'remove' && PARENTS.indexOf(child) >= 0);
    if (!ok) return bad('You can only mark your own prayers or the children\'s.');
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
        const lat = Number(p.lat), lng = Number(p.lng);   // place the prayer times were counted for (nearest city, never exact GPS)
        const okLoc = isFinite(lat) && isFinite(lng) && lat !== 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        const jumuah = p.kind === 'Jumuah' && p.prayer === 'Dhuhr' && Utilities.formatDate(new Date(at), TZ, 'EEE') === 'Fri';   // Friday only
        sh.appendRow([new Date(at), child, p.prayer, user, okLoc ? Math.round(lat * 100) / 100 : '', okLoc ? Math.round(lng * 100) / 100 : '', okLoc ? String(p.place || '').slice(0, 60) : '', jumuah ? 'Jumuah' : p.kind === 'Mosque' ? 'Mosque' : '', !jumuah && p.kind === 'Mosque' ? String(p.mosqueName || '').trim().slice(0, 60) : '', !jumuah && p.kind === 'Mosque' ? String(p.mosqueAddr || '').trim().slice(0, 150) : '']);
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
  const logVals = last < 2 ? [] : sh.getRange(2, 1, last - 1, 10).getValues();
  // Brother / sister card for a child: only how many of today's prayers the other child has prayed – no times, no details.
  let siblings = [];
  if (!isParent) {
    const todayStr = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    siblings = KIDS.filter(k => k !== user).map(k => {
      const done = {};
      logVals.forEach(r => { if (r[1] === k && r[0] instanceof Date && PRAYERS.indexOf(r[2]) >= 0 && Utilities.formatDate(r[0], TZ, 'yyyy-MM-dd') === todayStr) done[r[2]] = 1; });
      return { id: k, today: Object.keys(done).length };
    });
  }
  const rows = logVals
    .filter(r => r[0] instanceof Date && r[0].getTime() >= since && (isParent || r[1] === user || KIDS.indexOf(r[1]) >= 0))   // children see each other's prayers (not the parents')
    .map(r => [r[0].getTime(), String(r[1]), String(r[2]), String(r[3] || r[1]), r[4] === '' ? '' : Number(r[4]), r[5] === '' ? '' : Number(r[5]), String(r[6] || ''), String(r[7] || ''), String(r[8] || ''), String(r[9] || '')]);
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
  const qsh = quranSheet_(), ql = qsh.getLastRow();
  const quran = ql < 2 ? [] : qsh.getRange(2, 1, ql - 1, 14).getValues()
    .filter(r => r[0] && (isParent || r[2] === user || KIDS.indexOf(r[2]) >= 0))
    .map(r => ({ id: String(r[0]), created: ms_(r[1]), child: String(r[2]), surah: Number(r[3]), ayahs: Number(r[4]), points: Number(r[5]) || 0,
                 status: String(r[6] || 'pending'), decidedBy: String(r[7] || ''), decided: ms_(r[8]), audio: isParent || r[2] === user ? String(r[9] || '') : '', note: isParent || r[2] === user ? String(r[10] || '') : '', mode: String(r[11] || ''),
                 helper: String(r[12] || ''), link: String(r[13] || '') }));
  return { ok: true, user: user, admin: isAdmin, viewAll: isParent, rows: rows, notes: notes, tasks: tasks, requests: requests, siblings: siblings, quran: quran,
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
function logSheet_() {
  const sh = sheet_('Log', ['Timestamp', 'Child', 'Prayer', 'Marked by', 'Lat', 'Lng', 'Place', 'Type', 'Mosque name', 'Mosque address']);
  if (sh.getMaxColumns() < 10) sh.insertColumnsAfter(sh.getMaxColumns(), 10 - sh.getMaxColumns());
  if (sh.getRange(1, 5).getValue() === '') sh.getRange(1, 5, 1, 3).setValues([['Lat', 'Lng', 'Place']]);
  if (sh.getRange(1, 8).getValue() === '') sh.getRange(1, 8).setValue('Type');
  if (sh.getRange(1, 9).getValue() === '') sh.getRange(1, 9).setValue('Mosque name');
  if (sh.getRange(1, 10).getValue() === '') sh.getRange(1, 10).setValue('Mosque address');   // add the new headers once; old rows stay as they are (= Toronto)
  return sh;
}
function notesSheet_() { return sheet_('Notes', ['Date', 'Child', 'Prayer', 'Note', 'By', 'Updated'], [1]); }
function findRow_(sh, col, value) {
  const n = sh.getLastRow(); if (n < 2) return 0;
  const vals = sh.getRange(2, col, n - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return 0;
}
// any "data:<something>;base64,<data>" becomes "data:audio/<type>;base64,<data>"; returns "" if there is no base64 data
function normAudio_(v) {
  v = String(v || ''); const i = v.indexOf('base64,'); if (!v || i < 0) return '';
  const data = v.slice(i + 7).replace(/\s/g, ''); if (!data || /[^A-Za-z0-9+/=]/.test(data)) return '';
  let mime = (v.slice(5, i).split(';')[0] || '').trim().toLowerCase();
  if (!/^audio\/[a-z0-9.+-]+$/.test(mime)) mime = /webm/.test(v.slice(0, i)) ? 'audio/webm' : 'audio/mp4';
  return 'data:' + mime + ';base64,' + data;
}
function saveAudio_(audio) {
  const audioId = 'a' + Date.now().toString(36);
  const as = sheet_('Audio', ['ID', 'Part', 'Mime', 'Data']);
  const mime = audio.slice(5, audio.indexOf(';')), data = audio.slice(audio.indexOf('base64,') + 7);
  const rows = [];
  for (let i = 0, part = 0; i < data.length; i += CELL, part++) rows.push([audioId, part, mime, data.slice(i, i + CELL)]);
  as.getRange(as.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  return audioId;
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
