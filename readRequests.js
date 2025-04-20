const { getSheetsApi } = require('./googleSheetService');
async function readPendingFromSheet(spreadsheetId, sheetName, range) {
  const sheets = await getSheetsApi();
  const fullRange = `${sheetName}!${range}`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: fullRange });
  const rows = res.data.values;
  if (!rows || rows.length === 0) return [];
  const header = rows[0];
  const processIdx = header.indexOf('Process');
  if (processIdx === -1) return [];
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[processIdx] === 'Pending') result.push({ rowIndex: i + 1, rowData: row });
  }
  return result;
}
async function readAllPendingRequests(spreadsheetId) {
  const COMPANY_SHEET = 'Pending Company Request';
  const EP_SHEET = 'Pending EP Request';
  const DELE_SHEET = 'Pending Dele Request';
  const RANGE = 'A1:Z100';
  const company = await readPendingFromSheet(spreadsheetId, COMPANY_SHEET, RANGE);
  const ep = await readPendingFromSheet(spreadsheetId, EP_SHEET, RANGE);
  const dele = await readPendingFromSheet(spreadsheetId, DELE_SHEET, RANGE);
  const companyRecords = company.map(r => ({ ...r, sheetName: COMPANY_SHEET }));
  const epRecords = ep.map(r => ({ ...r, sheetName: EP_SHEET }));
  const deleRecords = dele.map(r => ({ ...r, sheetName: DELE_SHEET }));
  return { companyRecords, epRecords, deleRecords };
}
module.exports = { readAllPendingRequests };
