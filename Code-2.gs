/**
 * Relive Health Ada — Ambassador tracker API
 *
 * Paste this whole file into Extensions > Apps Script of your Google Sheet.
 * Then set a PASSCODE in Project Settings > Script properties and deploy
 * as a Web app (Execute as: Me, Who has access: Anyone).
 * The website sends the passcode with every request; without it, nothing is returned.
 */

const SHEETS = {
  Ambassadors: ['id', 'name', 'type', 'status', 'code', 'contact', 'joined', 'redeemed', 'createdAt'],
  Leads: ['id', 'name', 'ambassadorId', 'date', 'service', 'stage', 'recurringSince', 'cancelledOn', 'createdAt'],
};
const MAX_LEN = 200;

function doGet() {
  return json_({ ok: true, message: 'Ambassador tracker API is running. Use the website to view data.' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const pass = PropertiesService.getScriptProperties().getProperty('PASSCODE');
    if (!pass) return json_({ ok: false, error: 'No PASSCODE is set yet. Add one in Project Settings > Script properties.' });
    if (String(body.passcode || '') !== pass) return json_({ ok: false, auth: false, error: 'Wrong passcode.' });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      ensureSheets_();
      switch (body.action) {
        case 'list':
          break;
        case 'addAmbassador':
          addRow_('Ambassadors', Object.assign({ redeemed: '0' }, body.row || {}));
          break;
        case 'addLead':
          addRow_('Leads', body.row || {});
          break;
        case 'update':
          updateRow_(sheetName_(body.sheet), String(body.id || ''), body.fields || {});
          break;
        case 'remove':
          removeRow_(sheetName_(body.sheet), String(body.id || ''));
          break;
        case 'redeem':
          redeem_(String(body.id || ''), Number(body.amount));
          break;
        default:
          return json_({ ok: false, error: 'Unknown action.' });
      }
      return json_({ ok: true, ambassadors: readAll_('Ambassadors'), leads: readAll_('Leads') });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

// ---------- helpers ----------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheetName_(name) {
  if (!Object.prototype.hasOwnProperty.call(SHEETS, name)) throw new Error('Unknown sheet.');
  return name;
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    const first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (first.join('') === '') {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
}

// Store everything as plain text so Sheets never turns dates or codes into something else,
// and never lets a typed value run as a formula.
function cleanValue_(v) {
  let s = String(v == null ? '' : v).trim().slice(0, MAX_LEN);
  if (s.charAt(0) === '=') s = "'" + s; // a leading = would make Sheets treat it as a formula
  return s;
}

function writeRow_(sh, rowNumber, values) {
  sh.getRange(rowNumber, 1, 1, values.length).setNumberFormat('@').setValues([values]);
}

function addRow_(name, row) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  const headers = SHEETS[name];
  const values = headers.map(function (h) {
    if (h === 'id') return Utilities.getUuid();
    if (h === 'createdAt') return new Date().toISOString();
    return cleanValue_(row[h]);
  });
  writeRow_(sh, sh.getLastRow() + 1, values);
}

function findRow_(sh, id) {
  if (!id) return -1;
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return -1;
}

function updateRow_(name, id, fields) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  const r = findRow_(sh, id);
  if (r < 0) throw new Error('That entry no longer exists. Refresh the page.');
  const headers = SHEETS[name];
  Object.keys(fields).forEach(function (k) {
    const col = headers.indexOf(k);
    if (col < 1 || k === 'createdAt') return; // never change id or createdAt
    sh.getRange(r, col + 1).setNumberFormat('@').setValue(cleanValue_(fields[k]));
  });
}

function removeRow_(name, id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  const r = findRow_(sh, id);
  if (r > 0) sh.deleteRow(r);
}

function redeem_(id, amount) {
  if (!(amount > 0)) throw new Error('Enter a credit amount above zero.');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ambassadors');
  const r = findRow_(sh, id);
  if (r < 0) throw new Error('That ambassador no longer exists. Refresh the page.');
  const col = SHEETS.Ambassadors.indexOf('redeemed') + 1;
  const current = Number(sh.getRange(r, col).getDisplayValue()) || 0;
  sh.getRange(r, col).setNumberFormat('@').setValue(String(current + Math.round(amount)));
}

function readAll_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  const headers = SHEETS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, headers.length).getDisplayValues();
  return rows
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      const o = {};
      headers.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}
