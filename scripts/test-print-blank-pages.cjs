const { chromium } = require('playwright');
const fs = require('fs');

async function testPrintBlankPages() {
  console.log("Launching Chrome to test real PDF print output and check for blank pages...");
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    headless: true
  });

  const page = await browser.newPage();
  
  // Create an HTML page with the exact print styles and DOM structure from InvoiceView.tsx
  const generateTestHtml = (itemCount, isA5, tplColor) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page {
      size: ${isA5 ? 'A5 landscape' : 'A4 portrait'} !important;
      margin: 0mm !important;
    }
    *, *:before, *:after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }
    #invoice-document-canvas {
      position: static !important;
      width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      display: block !important;
      background: #ffffff !important;
    }
    .invoice-page-wrapper {
      width: 210mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      height: ${isA5 ? '147mm' : '296mm'} !important;
      max-height: ${isA5 ? '147mm' : '296mm'} !important;
      margin: 0 auto !important;
      padding: 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-sizing: border-box !important;
      display: block !important;
    }
    .invoice-page-wrapper:not(:last-child) {
      page-break-after: always !important;
      break-after: page !important;
    }
    .invoice-page-wrapper:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin-bottom: 0 !important;
    }
    .invoice-page-sheet {
      width: 210mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      height: ${isA5 ? '147mm' : '296mm'} !important;
      min-height: ${isA5 ? '147mm' : '296mm'} !important;
      max-height: ${isA5 ? '147mm' : '296mm'} !important;
      margin: 0 auto !important;
      padding: ${isA5 ? '4mm 6mm' : '8mm'} !important;
      box-shadow: none !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: auto !important;
      break-after: auto !important;
      position: relative !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      font-family: Arial, sans-serif;
      font-size: ${isA5 ? '9px' : '11px'};
    }
  </style>
</head>
<body>
  <div id="invoice-document-canvas">
    <div class="invoice-page-wrapper">
      <div class="invoice-page-sheet" style="border: 1px solid ${tplColor}; display: flex; flex-direction: column;">
        <div style="padding: 10px; background: ${tplColor}; color: white; font-weight: bold; font-size: 14px;">
          INVOICENTRIC DEMO BILL - PAGE 1
        </div>
        <div style="flex: 1; padding: 10px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 4px; text-align: left;">#</th>
                <th style="padding: 4px; text-align: left;">Item Description</th>
                <th style="padding: 4px; text-align: right;">Qty</th>
                <th style="padding: 4px; text-align: right;">Rate</th>
                <th style="padding: 4px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: 20 }, (_, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px;">${i + 1}</td>
                  <td style="padding: 4px;">Premium Office Supply Item Model-${100 + i}</td>
                  <td style="padding: 4px; text-align: right;">1</td>
                  <td style="padding: 4px; text-align: right;">₹ 1,500.00</td>
                  <td style="padding: 4px; text-align: right;">₹ 1,500.00</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="padding: 6px; text-align: right; font-weight: bold; color: ${tplColor};">
          Continued on Next Page → [Page 1 of 2]
        </div>
      </div>
    </div>
    <div class="invoice-page-wrapper">
      <div class="invoice-page-sheet" style="border: 1px solid ${tplColor}; display: flex; flex-direction: column;">
        <div style="padding: 10px; background: ${tplColor}; color: white; font-weight: bold; font-size: 14px;">
          INVOICENTRIC DEMO BILL - PAGE 2 (SUMMARY & TOTALS)
        </div>
        <div style="flex: 1; padding: 10px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${Array.from({ length: 5 }, (_, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px;">${21 + i}</td>
                  <td style="padding: 4px;">Premium Office Supply Item Model-${121 + i}</td>
                  <td style="padding: 4px; text-align: right;">1</td>
                  <td style="padding: 4px; text-align: right;">₹ 1,500.00</td>
                  <td style="padding: 4px; text-align: right;">₹ 1,500.00</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 15px; border-top: 2px solid ${tplColor}; padding-top: 8px; display: flex; justify-content: space-between;">
            <div>
              <b>Bank:</b> HDFC BANK | <b>A/c:</b> 50200012345678 | <b>IFSC:</b> HDFC0001234
            </div>
            <div style="text-align: right;">
              <div><b>Subtotal:</b> ₹ 37,500.00</div>
              <div><b>CGST (9%):</b> ₹ 3,375.00</div>
              <div><b>SGST (9%):</b> ₹ 3,375.00</div>
              <div style="font-size: 16px; font-weight: bold; color: ${tplColor};">Grand Total: ₹ 44,250.00</div>
            </div>
          </div>
        </div>
        <div style="padding: 6px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0;">
          This is a computer generated invoice. No signature required.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

  function countPdfPages(buffer) {
    const str = buffer.toString('binary');
    const matches = str.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 0;
  }

  // Test 1: A4 2-page invoice
  const testA4Html = generateTestHtml(25, false, '#0d5c4b');
  await page.setContent(testA4Html, { waitUntil: 'load' });
  const a4PdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  const a4PageCount = countPdfPages(a4PdfBuffer);
  console.log(`[TEST A4 Print] Total Generated Pages: ${a4PageCount} (Expected: exactly 2, No Blank Page)`);

  // Test 2: A5 2-page invoice
  const testA5Html = generateTestHtml(25, true, '#166534');
  await page.setContent(testA5Html, { waitUntil: 'load' });
  const a5PdfBuffer = await page.pdf({
    width: '210mm',
    height: '148mm',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  const a5PageCount = countPdfPages(a5PdfBuffer);
  console.log(`[TEST A5 Print] Total Generated Pages: ${a5PageCount} (Expected: exactly 2, No Blank Page)`);

  await browser.close();

  if (a4PageCount === 2 && a5PageCount === 2) {
    console.log("SUCCESS! ZERO EXTRA BLANK PAGES GENERATED! Both A4 and A5 print exactly with no trailing blank page.");
  } else {
    console.error("FAILURE: Blank page detected! A4 pages:", a4PageCount, "A5 pages:", a5PageCount);
    process.exit(1);
  }
}

testPrintBlankPages().catch((err) => {
  console.error(err);
  process.exit(1);
});
