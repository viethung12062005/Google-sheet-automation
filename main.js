const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { readAllPendingRequests } = require('./readRequests');
const { updateProcessStatus } = require('./updateStatus');
const { delay, validateFormData, processCompanyRequest, processEPRequest, processDeleRequest, clickButtonWithLabel, clickElement } = require('./formHandlers');
const { processCommonTasks } = require('./processCommonTasks');

const REQUEST_NEW_COMPANY_INVOICE = "Request new issue VAT Invoice for a company";
const REQUEST_WRONG_COMPANY_INVOICE = "Re-issue VAT Invoice because wrong invoice issued";
const REQUEST_ADJUSTMENT_INVOICE = "Minutes of invoice adjustment sample";
const REQUEST_CANCELLATION_INVOICE = "Minutes of invoice cancellation sample";
const REQUEST_LOST_EP_INVOICE = "Re-issue VAT Invoice because of Invoice lost";
const REQUEST_NEW_EP_INVOICE = "Request new issue VAT Invoice for an individual/EPs/PPs";
const REQUEST_NEW_DELE_INVOICE = "Request new issue VAT Invoice for Delegates";

const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLScxKMvPqo5WnEvz8Bn6J9_wJ3MBdbV-IANGiPo_n0YXEBGA1A/viewform";
const SPREADSHEET_ID = "1XYHrjJxugrI1ILHlIvAqY18kSgM75ei_72kbgJjkUSk";

// Hàm retryOperation sẽ nhận callback có tham số attempt; không load lại trang form trong retry
async function retryOperation(operation, retries = 5, delay = 0) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      console.error(`Attempt ${attempt} thất bại:`, error);
      if (attempt < retries) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Hàm clearForm chỉ thực hiện thao tác xóa dữ liệu có sẵn của form (click vào nút Clear form trong popup)
async function clearForm(page) {
  console.log("Clear form: Thực hiện thao tác xóa dữ liệu form...");
  try {
    clickElement(page,"body");
    await new Promise(resolve => setTimeout(resolve, 1000));
    await clickButtonWithLabel(page, "Clear form");
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Đợi popup xuất hiện và xử lý
    await page.waitForSelector('div[role="alertdialog"]', { visible: true, timeout: 5000 });
    // Sử dụng evaluate để duyệt qua popup và tìm nút chứa text "Clear form"
    await page.evaluate(() => {
      const dialog = document.querySelector('div[role="alertdialog"]');
      if (!dialog) throw new Error("Không tìm thấy alertdialog");
      const buttons = dialog.querySelectorAll('div[role="button"]');
      let found = false;
      buttons.forEach(btn => {
        const span = btn.querySelector('span.l4V7wb.Fxmcue span.NPEfkd.RveJvd.snByac');
        if (span && span.innerText.trim() === "Clear form") {
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          found = true;
        }
      });
      if (!found) {
        throw new Error("Không tìm thấy nút 'Clear form' trong popup.");
      }
    });
    console.log("Đã clear dữ liệu form thông qua popup.");
  
  } catch (error) {
    console.warn("Không xử lý được clear form bằng cách này, thử 'Submit another response'.", error);
    try {
      await clickButtonWithLabel(page, "Submit another response");
      console.log("Đã click 'Submit another response'.");
    } catch (err) {
      console.warn("Không tìm thấy nút 'Submit another response'.", err);
    }
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function main() {
  const { companyRecords, epRecords, deleRecords } = await readAllPendingRequests(SPREADSHEET_ID);
  const totalRequests = companyRecords.length + epRecords.length + deleRecords.length;
  if (totalRequests === 0) {
    console.log("Không có yêu cầu Pending nào.");
    return;
  }
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: './user_data',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Load form một lần cho toàn bộ quá trình xử lý mỗi record
  await page.goto(formUrl, { waitUntil: 'networkidle2' });
  
  console.log("Vui lòng đăng nhập thủ công (nếu cần). Nhấn Enter sau khi hoàn tất...");
  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
  await clearForm(page);
  // Xử lý Company Requests
  for (const record of companyRecords) {
    const { rowIndex, rowData, sheetName } = record;
    console.log(`[Company] Đang xử lý row ${rowIndex} trên sheet ${sheetName}`);
    await page.goto(formUrl, { waitUntil: 'networkidle2' });
    try {
      await retryOperation(async (attempt) => {
        // Mỗi record chỉ load trang form 1 lần; nếu là retry (attempt > 1) clear form và điền lại từ đầu
        if (attempt > 1) {
          await clearForm(page);
        }
        await processCommonTasks(page, rowData[0]);
        await validateFormData(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clickButtonWithLabel(page, "Next");
        await new Promise(resolve => setTimeout(resolve, 3000));
        await processCompanyRequest(rowData, page, rowData[0]);
        await validateFormData(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clickButtonWithLabel(page, "Submit");
      }, 3, 1000);
      await updateProcessStatus(SPREADSHEET_ID, sheetName, rowIndex, 'Sent');
    } catch (error) {
      console.error(`[Company] Lỗi xử lý row ${rowIndex}:`, error);
      await clearForm(page);
    }
  }
  
  // Xử lý EP Requests
  for (const record of epRecords) {
    const { rowIndex, rowData, sheetName } = record;
    console.log(`[EP] Đang xử lý row ${rowIndex} trên sheet ${sheetName}`);
    await page.goto(formUrl, { waitUntil: 'networkidle2' });
    try {
      await retryOperation(async (attempt) => {
        if (attempt > 1) {
          await clearForm(page);
        }
        await processCommonTasks(page, rowData[0]);
        await validateFormData(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clickButtonWithLabel(page, "Next");
        await new Promise(resolve => setTimeout(resolve, 3000));
        await processEPRequest(rowData, page, rowData[0]);
        await validateFormData(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clickButtonWithLabel(page, "Submit");
      }, 3, 1000);
      await updateProcessStatus(SPREADSHEET_ID, sheetName, rowIndex, 'Sent');
    } catch (error) {
      console.error(`[EP] Lỗi xử lý row ${rowIndex}:`, error);
      await clearForm(page);
    }
  }
  
  // Xử lý Delegates Requests
  for (const record of deleRecords) {
    const { rowIndex, rowData, sheetName } = record;
    console.log(`[Delegates] Đang xử lý row ${rowIndex} trên sheet ${sheetName}`);
    await page.goto(formUrl, { waitUntil: 'networkidle2' });
    try {
      await retryOperation(async (attempt) => {
        if (attempt > 1) {
          await clearForm(page);
        }
        await processCommonTasks(page, REQUEST_NEW_DELE_INVOICE);
        await validateFormData(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clickButtonWithLabel(page, "Next");
        await new Promise(resolve => setTimeout(resolve, 3000));
        await processDeleRequest(rowData, page);
        await validateFormData(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clickButtonWithLabel(page, "Submit");
      }, 3, 1000);
      await updateProcessStatus(SPREADSHEET_ID, sheetName, rowIndex, 'Sent');
    } catch (error) {
      console.error(`[Delegates] Lỗi xử lý row ${rowIndex}:`, error);
      await clearForm(page);
    }
  }
  
  console.log("Tất cả yêu cầu đã được xử lý. Đóng trình duyệt...");
  await browser.close();
}

main().catch(error => console.error("Lỗi trong quá trình thực thi:", error));

