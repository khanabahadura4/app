// Google Apps Script (Code.gs)
// Assumes sheet "111", row 1 = headers, column A = Date.
// Column layout (A..AA): Date, Shift, Report No, Buyer, Order No, Batch No,
// Roll, Colour, Fab Type, R.GSM, F.GSM, Req.Dia, F.Dia, Drying, Length,
// Width, Twisting, Qty, Composition, Others, Info, pH, Dry Rubbing,
// Wet Rubbing, CF Wash Sta, CF Wash C.C, C.S  → 27 columns total.

var SHEET_NAME = "111";
var TOTAL_COLUMNS = 27; // A..AA — was 26 before, which cut off the last column (cs)

function doGet(e) {
  var action = e.parameter.action;

  if (action === "getLots") {
    var page = parseInt(e.parameter.page || 1);
    var pageSize = parseInt(e.parameter.pageSize || 2000);
    return jsonOut(getPaginatedLots(page, pageSize));
  }

  if (action === "getSearch") {
    var q = e.parameter.q || "";
    return jsonOut(searchLots(q));
  }

  if (action === "getDetail") {
    var batchNo = e.parameter.batchNo || "";
    return jsonOut(getDetail(batchNo));
  }

  return ContentService.createTextOutput("Lab Test API Working");
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── shared: read + map one raw sheet row into a flat object ─────────────
function mapRow(row, tz) {
  var dateVal = row[0];
  var dateStr = dateVal instanceof Date
    ? Utilities.formatDate(dateVal, tz, "dd-MM-yyyy")
    : (dateVal || "");

  return {
    date: dateStr,
    shift: row[1] || "",
    reportNo: row[2] || "",
    buyer: row[3] || "",
    orderNo: row[4] || "",
    batchNo: row[5] || "",
    roll: row[6] || "",
    colour: row[7] || "",
    fabType: row[8] || "",
    rGsm: row[9] || "",
    fGsm: row[10] || "",
    reqDia: row[11] || "",
    fDia: row[12] || "",
    drying: row[13] || "",
    length: row[14] || "",
    width: row[15] || "",
    twisting: row[16] || "",
    qty: row[17] || "",
    composition: row[18] || "",
    others: row[19] || "",
    info: row[20] || "",
    ph: row[21] || "",
    dryRubbing: row[22] || "",
    wetRubbing: row[23] || "",
    cfWashSt: row[24] || "",
    cfWashCc: row[25] || "",
    cs: row[26] || ""
  };
}

// ─── getLots (paginated, newest first) ────────────────────────────────────
function getPaginatedLots(page, pageSize) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return { status: "error", message: "Sheet 111 not found" };

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { status: "success", data: [], totalPages: 0, currentPage: page, totalRecords: 0 };
  }

  var totalRecords = lastRow - 1;
  var totalPages = Math.ceil(totalRecords / pageSize);

  var startRowFromBottom = (page - 1) * pageSize;
  var endRowFromBottom = page * pageSize;

  var fetchStartRow = Math.max(2, lastRow - endRowFromBottom + 1);
  var numRowsToFetch = Math.min(pageSize, lastRow - fetchStartRow + 1 - startRowFromBottom);

  if (numRowsToFetch <= 0) {
    return { status: "success", data: [], totalPages: totalPages, currentPage: page, totalRecords: totalRecords };
  }

  var range = sheet.getRange(fetchStartRow, 1, Math.max(1, numRowsToFetch), TOTAL_COLUMNS);
  var values = range.getValues();
  values.reverse(); // newest first

  var tz = Session.getScriptTimeZone();
  var result = values.map(function (row) { return mapRow(row, tz); });

  return {
    status: "success",
    data: result,
    totalPages: totalPages,
    currentPage: page,
    totalRecords: totalRecords
  };
}

// ─── getSearch (all rows, every date — matches Batch No / Buyer / Order No) ─
function searchLots(q) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return { status: "error", message: "Sheet 111 not found" };

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { status: "success", data: [] };

  var needle = String(q).toLowerCase().trim();
  if (!needle) return { status: "success", data: [] };

  var range = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS);
  var values = range.getValues();
  var tz = Session.getScriptTimeZone();

  var matches = [];
  for (var i = values.length - 1; i >= 0 && matches.length < 2000; i--) {
    var row = values[i];
    var hay = (String(row[5] || "") + " | " + String(row[3] || "") + " | " + String(row[4] || "")).toLowerCase();
    if (hay.indexOf(needle) !== -1) matches.push(mapRow(row, tz));
  }

  return { status: "success", data: matches };
}

// ─── getDetail (every row for one batch no.) ──────────────────────────────
function getDetail(batchNo) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return { status: "error", message: "Sheet 111 not found" };

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { status: "success", data: [] };

  var b = String(batchNo).toLowerCase().trim();
  var range = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS);
  var values = range.getValues();
  var tz = Session.getScriptTimeZone();

  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][5] || "").toLowerCase().trim() === b) matches.push(mapRow(values[i], tz));
  }

  return { status: "success", data: matches };
}
