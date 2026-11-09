/** @OnlyCurrentDoc */
/**
 * Family prayer check-in – Google Apps Script.
 * Paste into the family sheet: Extensions → Apps Script → replace everything → Save → Deploy.
 * Every tap is stored in the "Log" tab: Timestamp | Child | Prayer.
 * The web page and the sheet's "Tracker" tab do the time / points calculations.
 */

// Change these passwords before you deploy. Each child signs in with their own name + password.
// "Dad" and "Mom" see both children and can mark a prayer for a child. Only Dad can remove old entries.
const ACCOUNTS = {
  Yousuf: 'yousuf-CHANGE-ME',
  Eva:    'eva-CHANGE-ME',
  Dad:    'dad-CHANGE-ME',
  Mom:    'mom-CHANGE-ME',
};

const ADMIN = 'Dad';          // can remove wrong entries
const VIEWERS = ['Dad', 'Mom']; // see both children and can mark prayers for them
const KIDS = ['Yousuf', 'Eva'];
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const LOG_SHEET = 'Log';
const UNDO_MINUTES = 15;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (Object.keys(ACCOUNTS).some(k => /CHANGE-ME/.test(ACCOUNTS[k]))) {
    return out_({ ok: false, error: 'setup', message: 'Set the passwords in the script first.' });
  }
  const user = p.user;
  if (!user || !ACCOUNTS.hasOwnProperty(user) || ACCOUNTS[user] !== p.pass) {
    Utilities.sleep(800); // slow down guessing
    return out_({ ok: false, error: 'login', message: 'Wrong name or password.' });
  }
  const isAdmin = user === ADMIN;
  const seesAll = VIEWERS.indexOf(user) >= 0;
  const sh = logSheet_();
  const action = p.action || 'list';

  if (action === 'login') return out_({ ok: true, user: user, admin: isAdmin, viewAll: seesAll, kids: KIDS });

  if (action === 'add' || action === 'undo' || action === 'remove') {
    const child = seesAll ? p.child : user;          // a child can only act for themselves; parents choose the child
    if (KIDS.indexOf(child) < 0) return out_({ ok: false, error: 'bad', message: 'Unknown child.' });
    if (action !== 'remove' && PRAYERS.indexOf(p.prayer) < 0) return out_({ ok: false, error: 'bad', message: 'Unknown prayer.' });
    if (action === 'remove' && !isAdmin) return out_({ ok: false, error: 'bad', message: 'Only Dad can remove entries.' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (action === 'add') {
        // parents may give the real prayer time (within the last 36 hours); children always use "now"
        let at = Date.now();
        if (seesAll && p.at) {
          const t = Number(p.at);
          if (!(t > Date.now() - 36 * 3600e3 && t <= Date.now() + 60e3)) return out_({ ok: false, error: 'bad', message: 'That time is too far away.' });
          at = t;
        }
        sh.appendRow([new Date(at), child, p.prayer, user]);
        return out_({ ok: true, at: at });
      }
      const last = sh.getLastRow();
      if (last < 2) return out_({ ok: false, error: 'none', message: 'Nothing to remove.' });
      const vals = sh.getRange(2, 1, last - 1, 3).getValues();
      if (action === 'remove') {                       // admin: remove one exact entry
        const at = Number(p.at);
        for (let i = vals.length - 1; i >= 0; i--) {
          if (vals[i][0] instanceof Date && vals[i][0].getTime() === at && vals[i][1] === child) {
            sh.deleteRow(i + 2);
            return out_({ ok: true, removed: at });
          }
        }
        return out_({ ok: false, error: 'none', message: 'Entry not found.' });
      }
      const limit = Date.now() - UNDO_MINUTES * 60000;  // child: undo own tap within 15 minutes
      for (let i = vals.length - 1; i >= 0; i--) {
        const ts = vals[i][0];
        if (!(ts instanceof Date) || ts.getTime() < limit) break;
        if (vals[i][1] === child && vals[i][2] === p.prayer) {
          sh.deleteRow(i + 2);
          return out_({ ok: true, undone: ts.getTime() });
        }
      }
      return out_({ ok: false, error: 'undo', message: 'Undo only works within ' + UNDO_MINUTES + ' minutes.' });
    } finally {
      lock.releaseLock();
    }
  }

  // list: rows since a time (ms). Children only receive their own rows.
  const since = Number(p.since || 0);
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, 4).getValues()
    .filter(r => r[0] instanceof Date && r[0].getTime() >= since && (seesAll || r[1] === user))
    .map(r => [r[0].getTime(), String(r[1]), String(r[2]), String(r[3] || r[1])]);
  return out_({ ok: true, user: user, admin: isAdmin, viewAll: seesAll, rows: rows, now: Date.now() });
}

function logSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(['Timestamp', 'Child', 'Prayer', 'Marked by']);
    sh.getRange('A:A').setNumberFormat('ddd mmm d yyyy, h:mm am/pm');
    sh.setFrozenRows(1);
  }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
