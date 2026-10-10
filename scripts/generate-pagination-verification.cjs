const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { QRCodeSVG } = require('qrcode.react');

const outputDir = path.join('C:', 'Users', 'user', 'Desktop', 'demo invoice', 'pagination-test');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const seller = {
  name: 'DEMO ENTERPRISES PVT. LTD.',
  tagline: 'Authorised Wholesale & Retail Electronics Distributor',
  address: 'Plot No. 42, Okhla Industrial Area Phase-III, New Delhi - 110020',
  gstin: '07AAAAA0000A1Z5',
  pan: 'AAAAA0000A',
  phone: '+91 98765 43210',
  email: 'billing@demoenterprises.in',
  bank: 'HDFC BANK LTD',
  branch: 'Okhla Phase-3, New Delhi',
  acc: '50200098765432',
  ifsc: 'HDFC0001234',
  upi: 'demoenterprises@okaxis'
};

const buyer = {
  name: 'TECHSOLUTIONS RETAIL TRADERS',
  address: 'Shop No. 12, Commercial Market, Sector 14, Gurugram, Haryana - 122001',
  gstin: '06BBBBB0000B1Z6',
  pan: 'BBBBB0000B',
  phone: '+91 91234 56789',
  state: 'Haryana (06)'
};

function getQrSvg(value, size = 64) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(QRCodeSVG, { value, size, level: 'M' })
  );
}

// Generate items array with realistic demo product details
function generateItems(count) {
  const catalog = [
    { name: 'Samsung Galaxy A15 5G (8GB/128GB)', hsn: '85171300', price: 14500, gstPct: 18 },
    { name: 'OnePlus Nord CE4 Lite (8GB/128GB)', hsn: '85171300', price: 17999, gstPct: 18 },
    { name: 'Apple 20W USB-C Power Adapter Original', hsn: '85044090', price: 1890, gstPct: 18 },
    { name: 'Sony WH-CH520 Wireless Bluetooth Headphones', hsn: '85183000', price: 4490, gstPct: 18 },
    { name: 'Logitech MK270 Wireless Keyboard & Mouse Combo', hsn: '84716060', price: 1695, gstPct: 18 },
    { name: 'SanDisk Ultra Dual 64GB USB Type-C Flash Drive', hsn: '85235100', price: 799, gstPct: 18 },
    { name: 'Mi 10000mAh Power Bank 3i 18W Fast Charging', hsn: '85044090', price: 1299, gstPct: 18 },
    { name: 'TP-Link Archer C6 AC1200 Dual Band Gigabit Router', hsn: '85176290', price: 2399, gstPct: 18 },
    { name: 'Boat Rockerz 450 Pro Bluetooth On-Ear Headphone', hsn: '85183000', price: 1999, gstPct: 18 },
    { name: 'Dell Pro 15.6 Inch Water Resistant Laptop Backpack', hsn: '42021290', price: 1250, gstPct: 18 }
  ];

  return Array.from({ length: count }, (_, idx) => {
    const base = catalog[idx % catalog.length];
    return {
      name: `${base.name} (Unit #${idx + 1})`,
      hsn: base.hsn,
      qty: 1,
      price: base.price,
      gstPct: base.gstPct,
      taxable: base.price,
      gstAmt: (base.price * base.gstPct) / 100,
      total: base.price * (1 + base.gstPct / 100),
      subLines: [`IMEI / Serial: SN-DEMO-2026-${1000 + idx}`]
    };
  });
}

// Partition items using the exact updated InvoiceView.tsx adaptive algorithm
function partitionItems(items, isA5) {
  const getItemHeight = (it) => {
    const base = isA5 ? 18 : 24;
    const subHeight = isA5 ? 11 : 14;
    const subCount = Array.isArray(it.subLines) ? it.subLines.length : 0;
    const nameLen = (it.name || '').length;
    let extraName = 0;
    if (nameLen > 65) extraName = isA5 ? 16 : 22;
    else if (nameLen > 35) extraName = isA5 ? 8 : 11;
    return base + (subCount * subHeight) + extraName;
  };

  const estBottomSummaryHeight = isA5 ? 175 : 295;
  const maxLastPageHeight = isA5
    ? Math.max(80, Math.floor(525 - 130 - estBottomSummaryHeight))
    : Math.max(180, Math.floor(1060 - 195 - estBottomSummaryHeight));
  const maxNonLastPageHeight = isA5
    ? Math.max(140, Math.floor(525 - 130 - 24))
    : Math.max(300, Math.floor(1060 - 195 - 28));

  const totalHeight = items.reduce((acc, it) => acc + getItemHeight(it), 0);
  if (totalHeight <= maxLastPageHeight) {
    return [items];
  }

  const pages = [];
  let remaining = [...items];

  while (remaining.length > 0) {
    const remHeight = remaining.reduce((acc, it) => acc + getItemHeight(it), 0);
    if (remHeight <= maxLastPageHeight) {
      pages.push(remaining);
      break;
    }

    let currentSlice = [];
    let currentHeight = 0;

    for (let i = 0; i < remaining.length; i++) {
      const it = remaining[i];
      const itH = getItemHeight(it);

      if (currentSlice.length > 0 && currentHeight + itH > maxNonLastPageHeight) {
        break;
      }

      const itemsLeft = remaining.length - (i + 1);
      if (itemsLeft > 0 && itemsLeft < 2 && currentSlice.length >= 2) {
        break;
      }

      currentSlice.push(it);
      currentHeight += itH;
    }

    if (currentSlice.length === 0) {
      currentSlice = [remaining[0]];
    }

    pages.push(currentSlice);
    remaining = remaining.slice(currentSlice.length);
  }

  return pages;
}

// Build complete HTML matching Template 01 (Emerald Bordered) with exact print CSS
function buildInvoiceHtml(items, isA5) {
  const pCol = '#0d5c4b';
  const dark = '#094034';
  const lb = '#f0fdf4';
  const b = `1px solid ${pCol}`;

  const pages = partitionItems(items, isA5);
  const totalPages = pages.length;

  const totalTaxable = items.reduce((sum, it) => sum + it.taxable, 0);
  const totalGst = items.reduce((sum, it) => sum + it.gstAmt, 0);
  const grandTotal = totalTaxable + totalGst;
  const qrSvg = getQrSvg(`upi://pay?pa=${seller.upi}&pn=${encodeURIComponent(seller.name)}&am=${grandTotal.toFixed(2)}&cu=INR`, isA5 ? 52 : 64);

  let startIndex = 0;

  const renderedPagesHtml = pages.map((pageItems, pageIdx) => {
    const isLast = pageIdx === totalPages - 1;
    const currentStart = startIndex;
    startIndex += pageItems.length;

    return `
    <div class="invoice-page-wrapper">
      <div class="invoice-page-sheet">
        <!-- Top Company & Recipient Header -->
        <div style="flex-shrink: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${isA5 ? '2px' : '4px'};">
            <div>
              <div style="font-size: ${isA5 ? '13px' : '17px'}; font-weight: bold; color: ${dark};">${seller.name}</div>
              <div style="font-size: ${isA5 ? '8px' : '10px'}; color: #475569;">${seller.address}</div>
              <div style="font-size: ${isA5 ? '8px' : '10px'}; color: #475569;">Phone: ${seller.phone} | Email: ${seller.email}</div>
            </div>
            <div style="text-align: right; font-size: ${isA5 ? '8px' : '10.5px'};">
              <div><b>Customer:</b> ${buyer.name}</div>
              <div><b>Phone:</b> ${buyer.phone}</div>
              <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">Page ${pageIdx + 1} of ${totalPages}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border: ${b}; border-bottom: none; padding: 2px 6px; font-weight: bold; font-size: ${isA5 ? '8.5px' : '11px'}; background: ${lb};">
            <div>GSTIN: ${seller.gstin}</div>
            <div style="font-size: ${isA5 ? '10px' : '12px'}; color: ${dark}; text-transform: uppercase;">TAX INVOICE</div>
            <div>ORIGINAL FOR RECIPIENT</div>
          </div>

          <div style="display: grid; grid-template-columns: 1.5fr 1fr; border: ${b}; font-size: ${isA5 ? '8px' : '10px'};">
            <div style="padding: 2px 6px; border-right: ${b};">
              <b>Billed To:</b> ${buyer.name}<br>
              ${buyer.address}<br>
              <b>GSTIN:</b> ${buyer.gstin} | <b>State:</b> ${buyer.state}
            </div>
            <div style="padding: 2px 6px;">
              <b>Invoice No:</b> INV-2026-DEMO-001<br>
              <b>Invoice Date:</b> 10-Oct-2026<br>
              <b>Place of Supply:</b> Haryana (06) | <b>Due:</b> Immediate
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
          <table style="width: 100%; flex: 1; border-collapse: collapse; border-left: ${b}; border-right: ${b}; border-bottom: ${b}; font-size: ${isA5 ? '8px' : '10px'};">
            <thead>
              <tr style="background: ${lb}; border-top: ${b}; border-bottom: ${b}; font-weight: bold;">
                <th style="padding: ${isA5 ? '2px' : '4px'}; border-right: ${b}; width: 28px; text-align: center;">#</th>
                <th style="padding: ${isA5 ? '2px' : '4px'}; border-right: ${b}; text-align: left;">Item Description</th>
                <th style="padding: ${isA5 ? '2px' : '4px'}; border-right: ${b}; width: 60px; text-align: center;">HSN</th>
                <th style="padding: ${isA5 ? '2px' : '4px'}; border-right: ${b}; width: 35px; text-align: center;">Qty</th>
                <th style="padding: ${isA5 ? '2px' : '4px'}; border-right: ${b}; width: 65px; text-align: right;">Rate</th>
                <th style="padding: ${isA5 ? '2px' : '4px'}; border-right: ${b}; width: 45px; text-align: center;">GST%</th>
                <th style="padding: ${isA5 ? '2px' : '4px'}; width: 75px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.map((it, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: ${isA5 ? '2px 3px' : '3px 5px'}; border-right: ${b}; text-align: center; vertical-align: top;">${currentStart + idx + 1}</td>
                  <td style="padding: ${isA5 ? '2px 4px' : '3px 6px'}; border-right: ${b}; vertical-align: top;">
                    <div style="font-weight: bold;">${it.name}</div>
                    ${it.subLines.map(sl => `<div style="font-size: ${isA5 ? '7px' : '8.5px'}; color: #64748b;">${sl}</div>`).join('')}
                  </td>
                  <td style="padding: ${isA5 ? '2px' : '3px'}; border-right: ${b}; text-align: center; vertical-align: top;">${it.hsn}</td>
                  <td style="padding: ${isA5 ? '2px' : '3px'}; border-right: ${b}; text-align: center; vertical-align: top; font-weight: bold;">${it.qty}</td>
                  <td style="padding: ${isA5 ? '2px 4px' : '3px 6px'}; border-right: ${b}; text-align: right; vertical-align: top;">₹ ${it.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: ${isA5 ? '2px' : '3px'}; border-right: ${b}; text-align: center; vertical-align: top;">${it.gstPct}%</td>
                  <td style="padding: ${isA5 ? '2px 4px' : '3px 6px'}; text-align: right; vertical-align: top; font-weight: bold;">₹ ${it.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <!-- Spacer Row to extend borders down -->
              <tr style="height: 100%;">
                <td style="border-right: ${b};"></td>
                <td style="border-right: ${b};"></td>
                <td style="border-right: ${b};"></td>
                <td style="border-right: ${b};"></td>
                <td style="border-right: ${b};"></td>
                <td style="border-right: ${b};"></td>
                <td></td>
              </tr>
              ${!isLast ? `
                <tr style="font-weight: bold; background: ${lb}; border-top: ${b};">
                  <td colspan="7" style="text-align: right; padding: ${isA5 ? '2px 4px' : '3px 6px'}; color: ${dark};">
                    Continued on Next Page → [Page ${pageIdx + 1} of ${totalPages}]
                  </td>
                </tr>
              ` : `
                <tr style="font-weight: bold; background: ${lb}; border-top: ${b};">
                  <td colspan="3" style="padding: ${isA5 ? '2px 4px' : '3px 6px'}; border-right: ${b}; text-align: right;">Total Items / Tax Summary:</td>
                  <td style="padding: ${isA5 ? '2px' : '3px'}; border-right: ${b}; text-align: center;">${items.length}</td>
                  <td colspan="2" style="padding: ${isA5 ? '2px 4px' : '3px 6px'}; border-right: ${b}; text-align: right;">Invoice Grand Total:</td>
                  <td style="padding: ${isA5 ? '2px 4px' : '3px 6px'}; text-align: right; color: ${dark}; font-size: ${isA5 ? '9px' : '12px'};">₹ ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        ${isLast ? `
          <!-- Bottom Summary Section -->
          <div style="flex-shrink: 0; margin-top: 0;">
            <div style="border: ${b}; border-top: none; padding: 2px 6px; font-size: ${isA5 ? '7.5px' : '9.5px'}; background: #fafafa;">
              <b>Total in Words:</b> RUPEES ${Math.round(grandTotal).toLocaleString('en-IN').toUpperCase()} ONLY
            </div>

            <!-- Bank & Signatory Grid -->
            <div style="display: grid; grid-template-columns: 1.5fr 1fr; border: ${b}; border-top: none; font-size: ${isA5 ? '7.5px' : '9.5px'};">
              <div style="padding: 3px 6px; border-right: ${b}; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: bold; color: ${dark}; margin-bottom: 2px;">Bank Payment Details:</div>
                  <div>Bank: <b>${seller.bank}</b></div>
                  <div>A/c No: <b>${seller.acc}</b></div>
                  <div>IFSC: <b>${seller.ifsc}</b> | Branch: ${seller.branch}</div>
                  <div>UPI: <b>${seller.upi}</b></div>
                </div>
                <div style="text-align: center; margin-left: 8px;">
                  ${qrSvg}
                  <div style="font-size: 7px; color: #64748b; margin-top: 1px;">Scan & Pay</div>
                </div>
              </div>
              <div style="padding: 3px 6px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-weight: bold;">For ${seller.name}</div>
                <div style="height: ${isA5 ? '22px' : '30px'}; display: flex; align-items: center; justify-content: center; font-style: italic; color: #64748b;">
                  [Authorised Digital Signature]
                </div>
                <div style="border-top: 1px solid #cbd5e1; padding-top: 1px; font-weight: bold; font-size: ${isA5 ? '7px' : '8.5px'};">
                  Authorised Signatory
                </div>
              </div>
            </div>

            <div style="border: ${b}; border-top: none; padding: 2px 6px; font-size: ${isA5 ? '7px' : '8.5px'}; color: #64748b; background: ${lb}; text-align: center;">
              Terms: 1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged after due date.
            </div>
          </div>
        ` : ''}
      </div>
    </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>InvoCentric Test Invoice - ${items.length} Items - ${isA5 ? 'A5' : 'A4'}</title>
  <style>
    @page {
      size: ${isA5 ? 'A5 landscape' : 'A4 portrait'} !important;
      margin: 0mm !important;
    }
    *, *:before, *:after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      font-family: Arial, Helvetica, sans-serif;
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
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
  </style>
</head>
<body>
  <div id="invoice-document-canvas">
    ${renderedPagesHtml}
  </div>
</body>
</html>
  `;
}

function countPdfPages(buffer) {
  const str = buffer.toString('binary');
  const matches = str.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

async function runVerification() {
  console.log("=== INVOICENTRIC PAGINATION & BLANK-PAGE TEST SUITE ===");
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    headless: true
  });

  const testCases = [
    { count: 15, isA5: false, filename: 'Test_15_Items_A4.pdf', label: '15 Entries (A4)' },
    { count: 22, isA5: false, filename: 'Test_22_Items_A4.pdf', label: '22 Entries (A4)' },
    { count: 25, isA5: false, filename: 'Test_25_Items_A4.pdf', label: '25 Entries (A4)' },
    { count: 15, isA5: true, filename: 'Test_15_Items_A5.pdf', label: '15 Entries (A5)' },
    { count: 22, isA5: true, filename: 'Test_22_Items_A5.pdf', label: '22 Entries (A5)' },
    { count: 25, isA5: true, filename: 'Test_25_Items_A5.pdf', label: '25 Entries (A5)' }
  ];

  const results = [];

  for (const tc of testCases) {
    const items = generateItems(tc.count);
    const html = buildInvoiceHtml(items, tc.isA5);
    const pages = partitionItems(items, tc.isA5);
    const expectedPages = pages.length;

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
      format: tc.isA5 ? undefined : 'A4',
      width: tc.isA5 ? '210mm' : undefined,
      height: tc.isA5 ? '148mm' : undefined,
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    const filePath = path.join(outputDir, tc.filename);
    fs.writeFileSync(filePath, pdfBuffer);

    const actualPdfPages = countPdfPages(pdfBuffer);
    const distribution = pages.map((p, idx) => `P${idx + 1}: ${p.length} items`).join(', ');
    const noBlank = actualPdfPages === expectedPages;

    results.push({
      test: tc.label,
      expectedPages,
      actualPages: actualPdfPages,
      distribution,
      noBlankPage: noBlank,
      savedFile: tc.filename,
      sizeKB: Math.round(pdfBuffer.length / 1024)
    });

    await page.close();
  }

  await browser.close();

  console.table(results);

  console.log(`\nAll 6 test invoice PDFs saved directly to desktop folder:`);
  console.log(`"${outputDir}"`);
}

runVerification().catch(console.error);
