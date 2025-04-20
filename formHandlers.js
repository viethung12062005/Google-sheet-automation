const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { google } = require('googleapis');

const REQUEST_NEW_COMPANY_INVOICE = "Request new issue VAT Invoice for a company";
const REQUEST_WRONG_COMPANY_INVOICE = "Re-issue VAT Invoice because wrong invoice issued";
const REQUEST_ADJUSTMENT_INVOICE = "Minutes of invoice adjustment sample";
const REQUEST_CANCELLATION_INVOICE = "Minutes of invoice cancellation sample";
const REQUEST_LOST_EP_INVOICE = "Re-issue VAT Invoice because of Invoice lost";
const REQUEST_NEW_EP_INVOICE = "Request new issue VAT Invoice for an individual/EPs/PPs";
const REQUEST_NEW_DELE_INVOICE = "Request new issue VAT Invoice for Delegates";

// Hàm delay tiện ích
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hàm kiểm tra dữ liệu trên form trước khi submit
async function validateFormData(page) {
  const errors = await page.evaluate(() => {
    const errorMessages = [];
    
    // Kiểm tra các trường bắt buộc có thuộc tính required
    const requiredFields = document.querySelectorAll('input[required], select[required], textarea[required]');
    requiredFields.forEach(field => {
      if (!field.value || !field.checkValidity()) {
        const message = field.validationMessage || `Trường ${field.name || field.id || 'n/a'} chưa hợp lệ.`;
        errorMessages.push(message);
      }
    });
    
    // Kiểm tra các element hiển thị lỗi theo custom (ví dụ: class "error-message")
    const customErrorElements = document.querySelectorAll('.error-message');
    customErrorElements.forEach(el => {
      const text = el.innerText.trim();
      if (text.length > 0) {
        errorMessages.push(text);
      }
    });
    
    return errorMessages;
  });
  
  if (errors.length > 0) {
    throw new Error("Lỗi xác thực form: " + errors.join("; "));
  }
}

// Hàm nhập text vào input hoặc textarea theo chỉ số (khi có nhiều phần tử cùng selector)
async function typeTextByIndex(page, selector, index, text, delayTime = 50) {
  await page.waitForSelector(selector, { timeout: 5000 });
  const elements = await page.$$(selector);
  if (elements.length <= index) {
    throw new Error(`Không tìm thấy phần tử với index ${index} cho selector ${selector}`);
  }
  await elements[index].click();
  await elements[index].type(text, { delay: delayTime });
  console.log(`Đã điền text tại index ${index} (${selector}): ${text}`);
}

// Hàm chọn radio button theo aria-label
async function selectRadioOption(page, radioLabel) {
  const selector = (radioLabel === "__other_option__")
    ? `div[role="radio"][data-value="__other_option__"]`
    : `div[role="radio"][aria-label="${radioLabel}"]`;
    
  await page.waitForSelector(selector, { timeout: 5000 });
  const found = await page.evaluate((sel) => {
    const radioOption = document.querySelector(sel);
    if (radioOption) {
      radioOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      radioOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      radioOption.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }
    return false;
  }, selector);

  if (!found) {
    throw new Error(`Không tìm thấy radio button với selector: ${selector}`);
  }
  console.log(`Đã chọn radio button: ${radioLabel}`);
}

// Hàm đánh dấu checkbox theo phần text trong aria-label
async function checkCheckbox(page, labelText) {
  const selector = `div[role="checkbox"][aria-label*="${labelText}"]`;
  await page.waitForSelector(selector, { timeout: 5000 });
  const found = await page.evaluate((sel) => {
    const checkbox = document.querySelector(sel);
    if (checkbox) {
      checkbox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      checkbox.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }
    return false;
  }, selector);
  
  if (!found) {
    throw new Error(`Không tìm thấy checkbox với label chứa: "${labelText}"`);
  }
  console.log(`Đã đánh dấu checkbox với label chứa: "${labelText}"`);
}

// Hàm chọn option trong dropdown dựa trên data-value
async function selectDropdownOption(page, dropdownIndex, optionText) {
  const dropdowns = await page.$$('div[role="listbox"]');
  if (dropdowns.length < dropdownIndex + 1) {
    throw new Error("Không đủ dropdown trên trang.");
  }
  
  await dropdowns[dropdownIndex].evaluate(el => el.scrollIntoView());
  await dropdowns[dropdownIndex].click();
  console.log(`Dropdown thứ ${dropdownIndex + 1} đã được mở.`);
  
  await page.waitForSelector('div.jgvuAb.ybOdnf.cGN2le.t9kgXb.llrsB.iWO5td', { visible: true, timeout: 5000 });
  console.log("Overlay dropdown đã hiển thị.");
  
  const xpath = `//div[@role="option"]//span[normalize-space(text())="${optionText}"]`;
  const optionHandle = await page.evaluateHandle((xp) => {
    const res = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return res.singleNodeValue;
  }, xpath);
  
  const element = await optionHandle.asElement();
  if (!element) {
    throw new Error(`Không tìm thấy phần tử với optionText: "${optionText}"`);
  }
  
  await element.evaluate(el => {
    const optDiv = el.closest('div[role="option"]');
    if (optDiv) {
      optDiv.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
      optDiv.click();
    }
  });
  console.log(`Đã chọn option '${optionText}' thông qua span.`);
}

// Hàm click button theo label
async function clickButtonWithLabel(page, label) {
  await page.waitForSelector('div[role="button"] span.l4V7wb.Fxmcue > span.NPEfkd.RveJvd.snByac', { visible: true, timeout: 5000 });
  const buttons = await page.$$('div[role="button"] span.l4V7wb.Fxmcue > span.NPEfkd.RveJvd.snByac');
  let found = false;
  for (const btn of buttons) {
    const btnText = await (await btn.getProperty('innerText')).jsonValue();
    if (btnText.trim() === label) {
      await btn.click();
      console.log(`Đã click nút ${label}.`);
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(`Không tìm thấy nút có nhãn ${label}.`);
  }
}

// Hàm click phần tử dựa trên selector
async function clickElement(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Không tìm thấy phần tử với selector: ${selector}`);
  }
  await element.click();
  console.log(`Đã click phần tử: ${selector}`);
}

// Hàm helper kiểm tra dữ liệu bắt buộc; nếu có lỗi sẽ ném ra exception
function validateRowData(rowData, requiredIndices, context = "Unknown") {
  requiredIndices.forEach(idx => {
    if (!rowData[idx] || rowData[idx].toString().trim() === "") {
      throw new Error(`[${context}] Lỗi: Trường ở vị trí ${idx} bị rỗng hoặc không hợp lệ. RowData: ${JSON.stringify(rowData)}`);
    }
  });
}

// Hàm xử lý cho Company
async function processCompanyRequest(rowData, page, typeRequest) {
  if (typeRequest !== "") {
    rowData[0] = typeRequest;
  }

  // Kiểm tra dữ liệu bắt buộc cho Company
  const requiredFields = [0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 16];
  validateRowData(rowData, requiredFields, "Company");

  switch (rowData[0]) {
    case REQUEST_NEW_COMPANY_INVOICE: {
      // Điền các checkbox của Legality Checklist
      const checkLabels = [
        "I sent soft copy of contract/MoU of this partnership to legality.aiesecvietnam@gmail.com and got approval.",
        "I finished collecting signature from MCVP Legality for this partnership.",
        "I finished collecting signature from partners for this partnership."
      ];
      for (const label of checkLabels) {
        await page.waitForSelector(`div[role="checkbox"][aria-label*="${label}"]`, { timeout: 5000 });
        const success = await page.evaluate((lbl) => {
          const checkbox = document.querySelector(`div[role="checkbox"][aria-label*="${lbl}"]`);
          if (checkbox) {
            checkbox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            checkbox.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return true;
          }
          return false;
        }, label);
        if (!success) {
          throw new Error(`Lỗi: Không tìm thấy checkbox với label: "${label}".`);
        }
        console.log(`Đánh dấu checkbox với label: "${label}" thành công.`);
      }
      
      // Xử lý Type of partnership: Nếu "Other" thì phải điền thêm thông tin ở rowData[6]
      if (rowData[5] === "Other") {
        if (!rowData[6] || rowData[6].toString().trim() === "") {
          throw new Error("Dữ liệu 'Other' cho Type of partnership nhưng không có thông tin bổ sung ở trường rowData[6].");
        }
        await selectRadioOption(page, "__other_option__");
        await delay(500);
        await typeTextByIndex(page, 'input.Hvn9fb.zHQkBf', 0, rowData[6]);
        await delay(500);
      } else {
        await selectRadioOption(page, rowData[5]);
      }
      
      // Các trường còn lại
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 0, rowData[1]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 1, rowData[2]);
      await delay(500);
      await typeTextByIndex(page, 'textarea.KHxj8b.tL9Q4c', 0, rowData[3]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 2, rowData[4]);
      await delay(500);
      await typeTextByIndex(page, 'textarea.KHxj8b.tL9Q4c', 1, rowData[7]);
      await delay(500);
      
      // Nếu [iGT] có giá trị "Local iGT", chọn dropdown
      if (rowData[5] === "Local iGT") {
        if (!rowData[8] || rowData[8].toString().trim() === "") {
          throw new Error("Dữ liệu 'Local iGT' cho Type of partnership nhưng không có thông tin bổ sung ở trường rowData[8].");
        }
        await selectDropdownOption(page, 0, rowData[8]);
        await delay(500);
      }
      
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 4, rowData[9]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 5, rowData[10]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 6, rowData[11]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 7, rowData[12]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 8, rowData[13]);
      await delay(500);
      
      // Company's/your concerns
      await typeTextByIndex(page, 'textarea.KHxj8b.tL9Q4c', 2, rowData[15]);
      await delay(500);
      
      // Deadline (ngày dạng "yyyy-mm-dd")
      if (rowData[14]) {
        const dateValue = rowData[14];
        await page.waitForSelector('input[type="date"]', { visible: true, timeout: 5000 });
        await page.evaluate((dateVal) => {
          const dateInput = document.querySelector('input[type="date"]');
          if (dateInput) {
            dateInput.value = dateVal;
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const dayInput = document.querySelector('input[name="entry.1465616439_day"]');
          const monthInput = document.querySelector('input[name="entry.1465616439_month"]');
          const yearInput = document.querySelector('input[name="entry.1465616439_year"]');
          if (dayInput && monthInput && yearInput) {
            const d = new Date(dateVal);
            dayInput.value = d.getDate();
            monthInput.value = d.getMonth() + 1;
            yearInput.value = d.getFullYear();
            dayInput.dispatchEvent(new Event('input', { bubbles: true }));
            dayInput.dispatchEvent(new Event('change', { bubbles: true }));
            monthInput.dispatchEvent(new Event('input', { bubbles: true }));
            monthInput.dispatchEvent(new Event('change', { bubbles: true }));
            yearInput.dispatchEvent(new Event('input', { bubbles: true }));
            yearInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, dateValue);
        console.log("Đã điền trường date và cập nhật các trường hidden.");
      } else {
        throw new Error("Không có giá trị cho trường date (rowData[14] undefined).");
      }
      await delay(500);
      
      // Loại hóa đơn
      await selectRadioOption(page, "Only E-invoice");
      await delay(500);
      
      // Link Contract
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 9, rowData[16]);
      await delay(500);
      break;
    }
      
    case REQUEST_WRONG_COMPANY_INVOICE:
      throw new Error("Chưa xử lý trường hợp 'Re-issue invoice because wrong invoice issued'");

      
    case REQUEST_ADJUSTMENT_INVOICE:
      await delay(1000);
      await clickButtonWithLabel(page, "Next");
      await delay(1000);
      await clickButtonWithLabel(page, "Next");
      await delay(1000);
      await clickButtonWithLabel(page, "Next");
      await delay(1000);
      // Xử lý lại như REQUEST_NEW_COMPANY_INVOICE
      await processCompanyRequest(rowData, page, REQUEST_NEW_COMPANY_INVOICE);
      break;
      
    case REQUEST_CANCELLATION_INVOICE:
      await delay(1000);
      await clickButtonWithLabel(page, "Next");
      await delay(1000);
      await clickButtonWithLabel(page, "Next");
      await delay(1000);
      await processCompanyRequest(rowData, page, REQUEST_NEW_COMPANY_INVOICE);
      break;
      
    default:
      throw new Error("Company: Không xác định request type: " + rowData[0]);
  }
}

// Hàm xử lý cho EP
async function processEPRequest(rowData, page, typeRequest) {
  if (typeRequest !== "") {
    rowData[0] = typeRequest;
  }
  // Kiểm tra dữ liệu bắt buộc cho EP
  const requiredFields = [0, 1, 2, 3, 5, 6, 7, 8, 9, 11];
  validateRowData(rowData, requiredFields, "EP");

  switch (rowData[0]) {
    case REQUEST_NEW_EP_INVOICE:
      console.log("Chuyển sang section: Request new issue VAT Invoice for an individual/EPs/PPs");
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 0, rowData[1]);
      await delay(500);
      await typeTextByIndex(page, 'textarea.KHxj8b.tL9Q4c', 0, rowData[2]);
      await delay(500);
      // Xử lý Product: Nếu "Other" thì phải điền thêm thông tin
      if (rowData[3] === "Other") {
        if (!rowData[4] || rowData[4].toString().trim() === "") {
          throw new Error("Dữ liệu 'Other' cho Product nhưng thiếu thông tin bổ sung ở rowData[4]");
        }
        await selectRadioOption(page, "__other_option__");
        await delay(500);
        await typeTextByIndex(page, 'input.Hvn9fb.zHQkBf', 0, rowData[4]);
        await delay(500);
      } else {
        await selectRadioOption(page, rowData[3]);
      }
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 1, rowData[5]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 2, rowData[6]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 3, rowData[7]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 4, rowData[8]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 5, rowData[9]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 6, rowData[11]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 7, "N/A");
      await delay(500);
      break;
      
    case REQUEST_LOST_EP_INVOICE:
      // Xử lý cho trường hợp re-issue invoice do mất hóa đơn
      const required = [10];
      validateRowData(rowData, required, "EP");
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 0, rowData[10]);
      await delay(500);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 1, rowData[1]);
      await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 2, rowData[11]);
      await delay(500);
      await clickButtonWithLabel(page, "Next");
      // Sau khi chuyển section, xử lý như request mới
      await processEPRequest(rowData, page, REQUEST_NEW_EP_INVOICE);
      break;
      
    default:
      throw new Error("EP: Không xác định request type: " + rowData[0]);
  }
}

// Hàm xử lý cho Delegates (chỉ có một loại request)
async function processDeleRequest(rowData, page) {
  // Kiểm tra dữ liệu bắt buộc cho Delegates
  const requiredFields = [0, 1, 2, 3, 5, 6, 7, 8, 9];
  validateRowData(rowData, requiredFields, "Delegates");
  
  console.log("Chuyển sang section: Request new issue VAT Invoice for Delegates");
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 0, rowData[0]);
  await delay(500);
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 1, rowData[1]);
  await delay(500);
  if (rowData[2] === "Other") {
    if (!rowData[3] || rowData[3].toString().trim() === "") {
      throw new Error("Dữ liệu 'Other' cho Type of project trong Delegates nhưng thiếu thông tin bổ sung ở rowData[3]");
    }
    await selectRadioOption(page, "__other_option__");
    await delay(500);
    await typeTextByIndex(page, 'input.Hvn9fb.zHQkBf', 0, rowData[3]);
    await delay(500);
  } else {
    await selectRadioOption(page, rowData[2]);
  }
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 2, rowData[6]);
  await delay(500);
  await selectRadioOption(page, rowData[7].replace('%', ''));
  await delay(500);
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 3, rowData[8]);
  await delay(500);
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 4, rowData[5]);
  await delay(500);
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 5, rowData[4]);
  await delay(500);
  await typeTextByIndex(page, 'input.whsOnd.zHQkBf', 6, rowData[9]);
}

module.exports = {
  delay,
  validateFormData,
  typeTextByIndex,
  selectRadioOption,
  checkCheckbox,
  selectDropdownOption,
  clickButtonWithLabel,
  clickElement,
  processCompanyRequest,
  processEPRequest,
  processDeleRequest
};
