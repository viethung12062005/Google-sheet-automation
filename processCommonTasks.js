// processCommonTasks.js
const {validateFormData, checkCheckbox, typeTextByIndex, selectDropdownOption, clickButtonWithLabel, delay } = require('./formHandlers');

// Hàm kiểm tra dữ liệu bắt buộc
function validateData(formData, requiredFields) {
  let isValid = true;
  requiredFields.forEach(field => {
    if (!formData[field] || formData[field].toString().trim() === "") {
      console.error(`Validation error: Trường "${field}" không được để trống.`);
      isValid = false;
    }
  });
  return isValid;
}

async function processCommonTasks(page, requestType) {
  // Các dữ liệu mặc định cho Common Tasks (bạn có thể truyền vào từ nguồn khác nếu cần)
  const formData = {
    name: 'Trần Việt Hưng',
    email: 'viethung3905@aiesec.net',
    location: 'HN',
    requestType: requestType // requestType được truyền từ main hoặc từ data sheet
  };
  
  // Danh sách các trường bắt buộc
  const requiredFields = ['name', 'email', 'location', 'requestType'];
  
  if (!validateData(formData, requiredFields)) {
    throw new Error("Dữ liệu required của Common Tasks chưa được điền đầy đủ.");
  }
  
  // Thực hiện các bước trên form Common
  await checkCheckbox(page, "viethung3905@aiesec.net");
  await delay(500);
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 0, formData.name);
  await delay(500);
  await selectDropdownOption(page, 0, formData.location);
  await delay(500);
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 1, formData.email);
  await delay(500);
  await selectDropdownOption(page, 1, formData.requestType);
}

module.exports = { processCommonTasks };
