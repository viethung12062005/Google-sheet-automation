const { getSheetsApi } = require('./googleSheetService');

async function updateProcessStatus(spreadsheetId, sheetName, rowIndex, newStatus) {
  const sheets = await getSheetsApi();
  // Xác định cột "Process" dựa trên tên sheet
  // Với sheet "Pending EP Request" sử dụng cột O, 
  // sheet "Pending Dele Request" sử dụng cột L,
  // sheet "Pending Company Request" sử dụng cột S.
  let processColumn = '';
  if (sheetName === 'Pending EP Request' || sheetName === 'EPRequests') {
    processColumn = 'M';
  } else if (sheetName === 'Pending Dele Request' || sheetName === 'DeleRequests') {
    processColumn = 'L';
  } else if (sheetName === 'Pending Company Request' || sheetName === 'CompanyRequests') {
    processColumn = 'S';
  } else {
    console.warn(`Không xác định cột Process cho sheet: ${sheetName}`);
    processColumn = 'D'; // Mặc định nếu không xác định
  }
  
  const range = `${sheetName}!${processColumn}${rowIndex}`;
  const resource = { values: [[newStatus]] };
  
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource
  });
}

module.exports = { updateProcessStatus };
