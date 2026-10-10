const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { QRCodeSVG } = require('qrcode.react');
const { toWords } = require('number-to-words');

const outputDir = path.join('C:', 'Users', 'user', 'Desktop', 'demo invoice');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Format Currency
function fc(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format Number to Words in INR
function safeToWords(n) {
  try {
    const v = Math.floor(Number(n) || 0);
    return (toWords(v) + ' RUPEES ONLY').toUpperCase();
  } catch (_) {
    return '';
  }
}

// Generate SVG QR Code
function getQrSvg(value, size = 76) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(QRCodeSVG, {
      value: value || 'upi://pay?pa=demoenterprise@upi',
      size: size,
      level: 'M'
    })
  );
}

// Demo Seller / Business Details (Strictly Demo)
const seller = {
  name: 'DEMO ENTERPRISES PVT. LTD.',
  address: 'Plot No. 104, Industrial Area, Phase-I, Okhla\nNew Delhi - 110020, India',
  gstin: '07AAAAA0000A1Z5',
  pan: 'AAAAA0000A',
  phone: '+91 98765 43210',
  email: 'contact@demoenterprises.in',
  website: 'www.demoenterprises.in',
  drug_license: 'DL-20B/123456 & DL-21B/123457',
  bank: 'HDFC Bank Ltd',
  branch: 'Connaught Place Branch, New Delhi',
  acc: '50200012345678',
  ifsc: 'HDFC0001234',
  upi: 'demoenterprise@hdfcbank',
  state: 'Delhi (07)',
  forCo: 'For DEMO ENTERPRISES PVT. LTD.'
};

// Demo Buyer / Customer Details (Strictly Demo)
const buyer = {
  name: 'TECHSOLUTIONS RETAIL TRADERS',
  address: 'Shop No. 18, Commercial Plaza, Mall Road\nGurugram, Haryana - 122001, India',
  gstin: '06BBBBB0000B1Z6',
  pan: 'BBBBB0000B',
  phone: '+91 91234 56789',
  drug_license: 'DL-20B/987654',
  state: 'Haryana (06)',
  placeOfSupply: 'Haryana (06)'
};

// Demo Invoice Meta
const invoiceMeta = {
  invoiceNo: 'INV-DEMO-2026-001',
  invoiceDate: '10-Oct-2026',
  dueDate: '25-Oct-2026',
  poNo: 'PO-DEMO-9942',
  poDate: '08-Oct-2026',
  eWayNo: 'EWB-8921-7823-9012'
};

// Demo Products / Items
const items = [
  {
    name: 'Wireless Bluetooth Ergonomic Keyboard',
    hsn: '8471',
    qty: 2,
    unit: 'Pcs',
    mrp: 2499,
    price: 1800,
    disc: 5,
    gstPct: 18,
    sku: 'KB-WL-01',
    subLines: ['Model: ProType-X', 'Color: Matte Black', '1 Year Warranty']
  },
  {
    name: '24-Inch IPS Full HD Gaming Monitor',
    hsn: '8528',
    qty: 1,
    unit: 'Pcs',
    mrp: 14500,
    price: 10500,
    disc: 0,
    gstPct: 18,
    sku: 'MON-24-IPS',
    serial: 'SN-DEMO-8839201',
    batch: 'BATCH-2026-Q3',
    mfg: '15-Aug-2026',
    exp: 'N/A',
    subLines: ['Serial/IMEI: SN-DEMO-8839201', '3 Years Replacement Warranty']
  },
  {
    name: '65W GaN Multi-Port Fast Charger Adapter',
    hsn: '8504',
    qty: 4,
    unit: 'Pcs',
    mrp: 1999,
    price: 1250,
    disc: 10,
    gstPct: 18,
    sku: 'CHG-GAN-65',
    serial: 'SN-DEMO-4412093',
    batch: 'BAT-GAN-65W',
    mfg: '01-Sep-2026',
    exp: '31-Aug-2029',
    subLines: ['Batch: BAT-GAN-65W', 'Mfg: 01-Sep-2026 | Exp: 31-Aug-2029']
  },
  {
    name: 'Cat-7 High-Speed Shielded Ethernet Cable (5m)',
    hsn: '8544',
    qty: 5,
    unit: 'Pcs',
    mrp: 699,
    price: 380,
    disc: 0,
    gstPct: 18,
    sku: 'CBL-CAT7-5M',
    subLines: ['Length: 5 Meters', 'Gold Plated Connectors']
  }
];

// Calculations
const calculatedItems = items.map((it, idx) => {
  const taxable = it.qty * it.price * (1 - (it.disc || 0) / 100);
  const gstAmt = taxable * (it.gstPct / 100);
  const total = taxable + gstAmt;
  return {
    ...it,
    sno: idx + 1,
    taxable,
    gstAmt,
    total
  };
});

const totalTaxable = calculatedItems.reduce((acc, it) => acc + it.taxable, 0);
const totalTax = calculatedItems.reduce((acc, it) => acc + it.gstAmt, 0);
const grandTotal = Math.round(totalTaxable + totalTax);
const totalQty = calculatedItems.reduce((acc, it) => acc + it.qty, 0);
const cgstTotal = totalTax / 2;
const sgstTotal = totalTax / 2;

// HSN Summary Map
const hsnMap = {};
calculatedItems.forEach(it => {
  if (!hsnMap[it.hsn]) {
    hsnMap[it.hsn] = { hsn: it.hsn, taxable: 0, cgst: 0, sgst: 0, totalTax: 0, pct: it.gstPct };
  }
  hsnMap[it.hsn].taxable += it.taxable;
  hsnMap[it.hsn].cgst += it.gstAmt / 2;
  hsnMap[it.hsn].sgst += it.gstAmt / 2;
  hsnMap[it.hsn].totalTax += it.gstAmt;
});
const hsnRows = Object.values(hsnMap);

// Common Shared Styles
const baseStyles = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; }
  @page { margin: 0; }
`;

// ============================================================================
// TEMPLATE 01: Modern Clean A4 (Emerald Bordered + IGST/CGST Columns)
// ============================================================================
function generateTemplate01Html() {
  const pCol = '#0d5c4b';
  const dark = '#094034';
  const lb = '#f0fdf4';
  const b = `1px solid ${pCol}`;
  const qrSvg = getQrSvg(`upi://pay?pa=${seller.upi}&pn=${encodeURIComponent(seller.name)}&am=${grandTotal}&cu=INR`, 64);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Template 01 - Modern Clean</title>
  <style>
    ${baseStyles}
    .page { width: 210mm; min-height: 297mm; max-height: 297mm; padding: 8mm; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <div class="page">
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <div>
          <div style="font-size: 18px; font-weight: bold; color: ${dark}; margin-bottom: 2px;">${seller.name}</div>
          <div style="font-size: 10.5px; line-height: 1.25; color: #333;">${seller.address.replace(/\n/g, '<br>')}</div>
          <div style="font-size: 10px; color: #444; margin-top: 1px;">Phone: ${seller.phone} | Email: ${seller.email}</div>
        </div>
        <div style="text-align: right; font-size: 10.5px;">
          <div><b>Customer:</b> ${buyer.name}</div>
          <div><b>Phone:</b> ${buyer.phone}</div>
          <div style="font-size: 9px; color: #666; margin-top: 2px;">Page 1 of 1</div>
        </div>
      </div>

      <!-- Title Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; border: ${b}; border-bottom: none; padding: 3px 6px; font-weight: bold; font-size: 11.5px; background: #fff;">
        <div>GSTIN : ${seller.gstin} | DL: ${seller.drug_license}</div>
        <div style="font-size: 13px; color: ${dark}; letter-spacing: 0.5px;">TAX INVOICE</div>
        <div>ORIGINAL FOR RECIPIENT</div>
      </div>

      <!-- 2-Column Details Grid -->
      <div style="display: grid; grid-template-columns: 1.4fr 1fr; border: ${b}; font-size: 10px;">
        <div style="padding: 3px 6px; border-right: ${b};">
          <div style="font-weight: bold; text-align: center; background: ${lb}; margin: -3px -6px 3px; padding: 2px; border-bottom: ${b};">Details of Buyer | Billed to :</div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 85px; font-weight: bold;">Name:</span><span>${buyer.name}</span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 85px; font-weight: bold;">Address:</span><span>${buyer.address.replace(/\n/g, ', ')}</span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 85px; font-weight: bold;">Phone:</span><span>${buyer.phone}</span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 85px; font-weight: bold;">GSTIN:</span><span><b>${buyer.gstin}</b></span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 85px; font-weight: bold;">Place of Supply:</span><span>${buyer.placeOfSupply}</span></div>
        </div>
        <div style="padding: 3px 6px;">
          <div style="font-weight: bold; text-align: center; background: ${lb}; margin: -3px -6px 3px; padding: 2px; border-bottom: ${b};">Invoice Details :</div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 75px; font-weight: bold;">Invoice No:</span><span><b>${invoiceMeta.invoiceNo}</b></span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 75px; font-weight: bold;">Invoice Date:</span><span>${invoiceMeta.invoiceDate}</span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 75px; font-weight: bold;">Due Date:</span><span>${invoiceMeta.dueDate}</span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 75px; font-weight: bold;">P.O. No:</span><span>${invoiceMeta.poNo} (${invoiceMeta.poDate})</span></div>
          <div style="display: flex; margin-bottom: 1px;"><span style="width: 75px; font-weight: bold;">E-Way Bill:</span><span>${invoiceMeta.eWayNo}</span></div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="border: ${b}; border-top: none; font-size: 10px; margin-top: 0; flex: 1;">
        <thead>
          <tr style="background: ${lb};">
            <th style="border: ${b}; border-top: none; padding: 4px; width: 30px; text-align: center;">Sr.</th>
            <th style="border: ${b}; border-top: none; padding: 4px; text-align: left;">Name of Product / Service</th>
            <th style="border: ${b}; border-top: none; padding: 4px; width: 55px; text-align: center;">HSN/SAC</th>
            <th style="border: ${b}; border-top: none; padding: 4px; width: 40px; text-align: center;">Qty</th>
            <th style="border: ${b}; border-top: none; padding: 4px; width: 65px; text-align: right;">Rate (₹)</th>
            <th style="border: ${b}; border-top: none; padding: 4px; width: 50px; text-align: right;">Disc%</th>
            <th style="border: ${b}; border-top: none; padding: 4px; width: 50px; text-align: right;">GST%</th>
            <th style="border: ${b}; border-top: none; padding: 4px; width: 80px; text-align: right;">Taxable (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${calculatedItems.map(it => `
            <tr>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; text-align: center; vertical-align: top;">${it.sno}</td>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; vertical-align: top;">
                <div style="font-weight: bold; color: #111;">${it.name}</div>
                ${it.subLines.map(sl => `<div style="font-size: 8.5px; color: #555; margin-top: 1px;">• ${sl}</div>`).join('')}
              </td>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; text-align: center; vertical-align: top;">${it.hsn}</td>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; text-align: center; vertical-align: top; font-weight: bold;">${it.qty}</td>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; text-align: right; vertical-align: top;">${fc(it.price)}</td>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; text-align: right; vertical-align: top;">${it.disc ? it.disc + '%' : '0%'}</td>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; text-align: right; vertical-align: top;">${it.gstPct}%</td>
              <td style="border-left: ${b}; border-right: ${b}; padding: 4px; text-align: right; vertical-align: top; font-weight: bold;">${fc(it.taxable)}</td>
            </tr>
          `).join('')}
          <!-- Filler empty space to extend column borders -->
          <tr style="height: 50px;">
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
          </tr>
          <!-- Subtotals & Taxes -->
          <tr style="border-top: ${b}; font-size: 10px;">
            <td colspan="3" style="border-right: ${b}; padding: 3px 6px;"></td>
            <td style="text-align: center; border-right: ${b}; padding: 3px; font-weight: bold;">${totalQty}</td>
            <td colspan="3" style="text-align: right; border-right: ${b}; padding: 3px 6px; font-weight: bold;">CGST Tax (9%)</td>
            <td style="text-align: right; padding: 3px 6px; font-weight: bold;">${fc(cgstTotal)}</td>
          </tr>
          <tr style="font-size: 10px;">
            <td colspan="3" style="border-right: ${b}; padding: 3px 6px;"></td>
            <td style="border-right: ${b};"></td>
            <td colspan="3" style="text-align: right; border-right: ${b}; padding: 3px 6px; font-weight: bold;">SGST Tax (9%)</td>
            <td style="text-align: right; padding: 3px 6px; font-weight: bold;">${fc(sgstTotal)}</td>
          </tr>
          <tr style="border-top: ${b}; background: ${lb}; font-weight: bold; font-size: 11px;">
            <td colspan="3" style="border-right: ${b}; padding: 4px 6px; text-align: right;">Total Taxable: ₹ ${fc(totalTaxable)}</td>
            <td style="text-align: center; border-right: ${b}; padding: 4px 6px;">${totalQty}</td>
            <td colspan="3" style="text-align: right; border-right: ${b}; padding: 4px 6px;">Grand Total</td>
            <td style="text-align: right; padding: 4px 6px; font-size: 12px; color: ${dark};">₹ ${fc(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Amount in Words -->
      <div style="border: ${b}; border-top: none; padding: 3px 6px; font-size: 10px;">
        <span style="font-weight: bold;">Total in words: </span>
        <span style="font-weight: bold; color: ${dark};">${safeToWords(grandTotal)}</span>
      </div>

      <!-- HSN Summary Table -->
      <table style="border: ${b}; border-top: none; font-size: 9.5px; text-align: center;">
        <thead>
          <tr style="background: ${lb};">
            <th rowspan="2" style="border: ${b}; border-top: none; padding: 2px;">HSN / SAC</th>
            <th rowspan="2" style="border: ${b}; border-top: none; padding: 2px;">Taxable Value (₹)</th>
            <th colspan="2" style="border: ${b}; border-top: none; padding: 2px;">CGST</th>
            <th colspan="2" style="border: ${b}; border-top: none; padding: 2px;">SGST</th>
            <th rowspan="2" style="border: ${b}; border-top: none; padding: 2px;">Total Tax (₹)</th>
          </tr>
          <tr style="background: ${lb};">
            <th style="border: ${b}; padding: 1px;">Rate%</th>
            <th style="border: ${b}; padding: 1px;">Amount (₹)</th>
            <th style="border: ${b}; padding: 1px;">Rate%</th>
            <th style="border: ${b}; padding: 1px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${hsnRows.map(h => `
            <tr>
              <td style="border: ${b}; padding: 2px;">${h.hsn}</td>
              <td style="border: ${b}; padding: 2px; text-align: right;">${fc(h.taxable)}</td>
              <td style="border: ${b}; padding: 2px;">9%</td>
              <td style="border: ${b}; padding: 2px; text-align: right;">${fc(h.cgst)}</td>
              <td style="border: ${b}; padding: 2px;">9%</td>
              <td style="border: ${b}; padding: 2px; text-align: right;">${fc(h.sgst)}</td>
              <td style="border: ${b}; padding: 2px; text-align: right;">${fc(h.totalTax)}</td>
            </tr>
          `).join('')}
          <tr style="font-weight: bold; background: ${lb};">
            <td style="border: ${b}; padding: 2px;">Total</td>
            <td style="border: ${b}; padding: 2px; text-align: right;">${fc(totalTaxable)}</td>
            <td style="border: ${b}; padding: 2px;"></td>
            <td style="border: ${b}; padding: 2px; text-align: right;">${fc(cgstTotal)}</td>
            <td style="border: ${b}; padding: 2px;"></td>
            <td style="border: ${b}; padding: 2px; text-align: right;">${fc(sgstTotal)}</td>
            <td style="border: ${b}; padding: 2px; text-align: right;">${fc(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Bank Details & Signature Block -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; border: ${b}; border-top: none; font-size: 9.5px;">
        <div style="border-right: ${b}; display: flex; flex-direction: column;">
          <div style="font-weight: bold; text-align: center; background: ${lb}; padding: 1.5px; border-bottom: ${b};">Bank Details &amp; Payment</div>
          <div style="display: flex; padding: 4px; flex: 1; align-items: center;">
            <div style="flex: 1; line-height: 1.45;">
              <div><b>Bank Name:</b> ${seller.bank}</div>
              <div><b>Branch:</b> ${seller.branch}</div>
              <div><b>Account No:</b> ${seller.acc}</div>
              <div><b>IFSC Code:</b> ${seller.ifsc}</div>
              <div><b>UPI ID:</b> ${seller.upi}</div>
            </div>
            <div style="width: 85px; text-align: center; border-left: 1px dashed ${pCol}; padding-left: 6px;">
              ${qrSvg}
              <div style="font-size: 7.5px; font-weight: bold; color: ${dark}; margin-top: 1px;">Scan &amp; Pay UPI</div>
            </div>
          </div>
        </div>
        <div style="padding: 4px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="font-weight: bold; background: ${lb}; padding: 1.5px; border-bottom: ${b}; margin: -4px -4px 4px;">
            Certified genuine invoice
          </div>
          <div>
            <div style="font-size: 9px; font-weight: bold; color: #222;">${seller.forCo}</div>
            <div style="height: 34px;"></div>
            <div style="font-weight: bold; border-top: 1px solid #aaa; padding-top: 2px; font-size: 9px;">Authorised Signatory</div>
          </div>
        </div>
      </div>

      <!-- Terms & Conditions -->
      <div style="border: ${b}; border-top: none; font-size: 9px;">
        <div style="font-weight: bold; text-align: center; background: ${lb}; padding: 1px; border-bottom: ${b};">Terms &amp; Conditions</div>
        <div style="padding: 2px 6px; line-height: 1.35; color: #333;">
          1. Goods once sold will not be taken back or exchanged unless defective.<br>
          2. Payment is due within 15 days of invoice date. All disputes subject to Delhi jurisdiction only.
        </div>
      </div>

      <!-- Social / Footer Strip -->
      <div style="border: ${b}; border-top: none; background: ${lb}; padding: 2px 6px; font-size: 8.5px; display: flex; justify-content: space-between; align-items: center;">
        <span><b>Web:</b> ${seller.website} | <b>Email:</b> ${seller.email}</span>
        <span style="font-style: italic; color: ${dark};">Thank you for your business! • Generated by InvoCentric</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// TEMPLATE 02: Corporate Bordered A4 (Forest Line Top + IGST)
// ============================================================================
function generateTemplate02Html() {
  const pFor = '#166534';
  const lb = '#f0fdf4';
  const b = `1px solid ${pFor}`;
  const qrSvg = getQrSvg(`upi://pay?pa=${seller.upi}&pn=${encodeURIComponent(seller.name)}&am=${grandTotal}&cu=INR`, 64);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Template 02 - Corporate Forest Line</title>
  <style>
    ${baseStyles}
    .page { width: 210mm; min-height: 297mm; max-height: 297mm; padding: 8mm; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <div class="page">
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Forest Top Header with Thick Accent Line -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid ${pFor}; padding-bottom: 5px; margin-bottom: 5px;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: ${pFor}; letter-spacing: 0.5px;">TAX INVOICE</div>
          <div style="font-size: 16px; font-weight: bold; margin: 2px 0; color: #111;">${seller.name}</div>
          <div style="font-size: 10.5px; line-height: 1.3; color: #333;">
            <b>GSTIN:</b> ${seller.gstin} | <b>DL:</b> ${seller.drug_license}<br>
            ${seller.address.replace(/\n/g, ', ')}<br>
            <b>Phone:</b> ${seller.phone} | <b>Email:</b> ${seller.email}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 9.5px; font-weight: bold; color: ${pFor}; border: 1px solid ${pFor}; padding: 2px 8px; border-radius: 4px; display: inline-block;">
            ORIGINAL FOR RECIPIENT
          </div>
          <div style="font-size: 9px; color: #666; margin-top: 4px;">Page 1 of 1</div>
        </div>
      </div>

      <!-- 3-Column Meta Grid -->
      <div style="display: grid; grid-template-columns: 1.2fr 1.2fr 1fr; gap: 8px; border-bottom: 2px solid ${pFor}; padding-bottom: 6px; margin-bottom: 6px; font-size: 10px;">
        <div>
          <b style="color: ${pFor}; display: block; border-bottom: 1px solid #ddd; margin-bottom: 3px; padding-bottom: 1px;">Customer Details:</b>
          <div style="font-weight: bold; font-size: 11px;">${buyer.name}</div>
          <div>${buyer.address.replace(/\n/g, ', ')}</div>
          <div><b>GSTIN:</b> ${buyer.gstin}</div>
          <div><b>State:</b> ${buyer.state}</div>
        </div>
        <div>
          <b style="color: ${pFor}; display: block; border-bottom: 1px solid #ddd; margin-bottom: 3px; padding-bottom: 1px;">Shipping Address:</b>
          <div style="font-weight: bold; font-size: 11px;">${buyer.name}</div>
          <div>${buyer.address.replace(/\n/g, ', ')}</div>
          <div><b>State:</b> ${buyer.state}</div>
          <div><b>Place of Supply:</b> ${buyer.placeOfSupply}</div>
        </div>
        <div>
          <b style="color: ${pFor}; display: block; border-bottom: 1px solid #ddd; margin-bottom: 3px; padding-bottom: 1px;">Invoice Details:</b>
          <div style="display: flex; justify-content: space-between;"><span>Invoice #:</span><b>${invoiceMeta.invoiceNo}</b></div>
          <div style="display: flex; justify-content: space-between;"><span>Invoice Date:</span><b>${invoiceMeta.invoiceDate}</b></div>
          <div style="display: flex; justify-content: space-between;"><span>Due Date:</span><b>${invoiceMeta.dueDate}</b></div>
          <div style="display: flex; justify-content: space-between;"><span>P.O. No.:</span><b>${invoiceMeta.poNo}</b></div>
          <div style="display: flex; justify-content: space-between;"><span>E-Way No.:</span><b>${invoiceMeta.eWayNo}</b></div>
        </div>
      </div>

      <!-- Table with Forest Header -->
      <table style="border: ${b}; font-size: 10px; flex: 1;">
        <thead>
          <tr style="background: ${pFor}; color: #fff;">
            <th style="padding: 4px 6px; text-align: center; width: 32px;">Sr.No.</th>
            <th style="padding: 4px 6px; text-align: left;">Name of Product / Service</th>
            <th style="padding: 4px 6px; text-align: center; width: 60px;">HSN/SAC</th>
            <th style="padding: 4px 6px; text-align: center; width: 45px;">Qty</th>
            <th style="padding: 4px 6px; text-align: right; width: 70px;">Rate (₹)</th>
            <th style="padding: 4px 6px; text-align: right; width: 50px;">Disc%</th>
            <th style="padding: 4px 6px; text-align: right; width: 50px;">GST%</th>
            <th style="padding: 4px 6px; text-align: right; width: 85px;">Taxable (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${calculatedItems.map(it => `
            <tr>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; text-align: center; vertical-align: top;">${it.sno}</td>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; vertical-align: top;">
                <div style="font-weight: bold; color: #111;">${it.name}</div>
                ${it.subLines.map(sl => `<div style="font-size: 8.5px; color: #555; margin-top: 1px;">${sl}</div>`).join('')}
              </td>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; text-align: center; vertical-align: top;">${it.hsn}</td>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; text-align: center; vertical-align: top; font-weight: bold;">${it.qty}</td>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; text-align: right; vertical-align: top;">${fc(it.price)}</td>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; text-align: right; vertical-align: top;">${it.disc ? it.disc + '%' : '0%'}</td>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; text-align: right; vertical-align: top;">${it.gstPct}%</td>
              <td style="padding: 4px 6px; border-left: ${b}; border-right: ${b}; text-align: right; vertical-align: top; font-weight: bold;">${fc(it.taxable)}</td>
            </tr>
          `).join('')}
          <!-- Spacer -->
          <tr style="height: 50px;">
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
            <td style="border-left: ${b}; border-right: ${b};"></td>
          </tr>
          <!-- Totals -->
          <tr style="border-top: ${b}; font-size: 10px;">
            <td colspan="3" style="border-right: ${b};"></td>
            <td style="text-align: center; border-right: ${b}; padding: 3px; font-weight: bold;">${totalQty}</td>
            <td colspan="3" style="text-align: right; border-right: ${b}; padding: 3px 6px; font-weight: bold;">CGST Tax (9%)</td>
            <td style="text-align: right; padding: 3px 6px; font-weight: bold;">${fc(cgstTotal)}</td>
          </tr>
          <tr style="font-size: 10px;">
            <td colspan="3" style="border-right: ${b};"></td>
            <td style="border-right: ${b};"></td>
            <td colspan="3" style="text-align: right; border-right: ${b}; padding: 3px 6px; font-weight: bold;">SGST Tax (9%)</td>
            <td style="text-align: right; padding: 3px 6px; font-weight: bold;">${fc(sgstTotal)}</td>
          </tr>
          <tr style="border-top: ${b}; background: ${lb}; font-weight: bold; font-size: 11px;">
            <td colspan="3" style="border-right: ${b}; padding: 4px 6px; text-align: right;">Total Taxable Value: ₹ ${fc(totalTaxable)}</td>
            <td style="text-align: center; border-right: ${b}; padding: 4px 6px;">${totalQty}</td>
            <td colspan="3" style="text-align: right; border-right: ${b}; padding: 4px 6px; color: ${pFor};">Grand Total</td>
            <td style="text-align: right; padding: 4px 6px; font-size: 12px; color: ${pFor};">₹ ${fc(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Words & Bank Grid -->
      <div style="border: ${b}; border-top: none; padding: 3px 6px; font-size: 10px;">
        <b>Amount in words:</b> <span style="color: ${pFor}; font-weight: bold;">${safeToWords(grandTotal)}</span>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; border: ${b}; border-top: none; font-size: 9.5px;">
        <div style="padding: 5px; border-right: ${b}; display: flex; justify-content: space-between; align-items: center;">
          <div style="line-height: 1.45;">
            <b style="color: ${pFor}; display: block; margin-bottom: 2px;">Bank &amp; Payment Details:</b>
            <div><b>Bank:</b> ${seller.bank} | <b>Branch:</b> ${seller.branch}</div>
            <div><b>A/C No:</b> ${seller.acc} | <b>IFSC:</b> ${seller.ifsc}</div>
            <div><b>UPI ID:</b> ${seller.upi}</div>
          </div>
          <div style="text-align: center; margin-left: 8px;">
            ${qrSvg}
            <div style="font-size: 7.5px; font-weight: bold; color: ${pFor};">Scan with UPI</div>
          </div>
        </div>
        <div style="padding: 5px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="font-weight: bold; font-size: 9.5px; color: #111;">${seller.forCo}</div>
          <div style="height: 30px;"></div>
          <div style="font-weight: bold; border-top: 1px solid #aaa; padding-top: 2px; font-size: 9px;">Authorised Signatory</div>
        </div>
      </div>

      <!-- Terms -->
      <div style="border: ${b}; border-top: none; padding: 3px 6px; font-size: 8.5px; line-height: 1.35; background: #fafafa;">
        <b>Terms &amp; Conditions:</b> 1. Interest @ 18% p.a. will be charged if bill is not paid within due date. 2. Subject to Delhi jurisdiction only.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// TEMPLATE 03: Wholesale & Pharma Detailed A4 (Supplier B2B with Batch/Serial)
// ============================================================================
function generateTemplate03Html() {
  const headerBlue = '#1e5eb8';
  const borderGray = '#cbd5e1';
  const b = `1px solid ${borderGray}`;
  const qrSvg = getQrSvg(`upi://pay?pa=${seller.upi}&pn=${encodeURIComponent(seller.name)}&am=${grandTotal}&cu=INR`, 64);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Template 03 - Wholesale & Pharma Detailed</title>
  <style>
    ${baseStyles}
    .page { width: 210mm; min-height: 297mm; max-height: 297mm; padding: 8mm; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <div class="page">
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Modern Blue Header Bar -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid ${headerBlue}; padding-bottom: 6px; margin-bottom: 8px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 900; color: ${headerBlue}; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
            TAX INVOICE
          </h1>
          <div style="font-size: 10px; color: #64748b; font-weight: bold; margin-top: 2px;">WHOLESALE, PHARMA &amp; B2B COMPLIANT</div>
        </div>
        <div style="text-align: right; font-size: 10.5px; line-height: 1.35;">
          <div><span style="font-weight: bold; color: #475569;">Invoice No:</span> <span style="font-weight: 900; color: #0f172a;">${invoiceMeta.invoiceNo}</span></div>
          <div><span style="font-weight: bold; color: #475569;">Date:</span> ${invoiceMeta.invoiceDate}</div>
          <div><span style="font-weight: bold; color: #475569;">PO Number:</span> ${invoiceMeta.poNo}</div>
          <div style="font-size: 9px; color: #64748b;">Page 1 of 1</div>
        </div>
      </div>

      <!-- 2-Column B2B Party Cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; font-size: 10px;">
        <div style="padding: 6px 10px; background: #f8fafc; border-radius: 6px; border: ${b};">
          <div style="font-weight: 800; font-size: 10px; color: ${headerBlue}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            FROM (SUPPLIER / DISTRIBUTOR):
          </div>
          <div style="font-weight: 800; font-size: 12px; color: #0f172a; margin-bottom: 1px;">${seller.name}</div>
          <div style="color: #475569; line-height: 1.3;">${seller.address.replace(/\n/g, ', ')}</div>
          <div style="color: #475569; margin-top: 2px;"><b>Email:</b> ${seller.email} | <b>Tel:</b> ${seller.phone}</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">GSTIN: ${seller.gstin}</div>
          <div style="font-weight: bold; color: #0f172a;">Drug Lic (DL): ${seller.drug_license}</div>
        </div>

        <div style="padding: 6px 10px; background: #f8fafc; border-radius: 6px; border: ${b};">
          <div style="font-weight: 800; font-size: 10px; color: ${headerBlue}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            BILL TO (BUYER / HOSPITAL / RETAILER):
          </div>
          <div style="font-weight: 800; font-size: 12px; color: #0f172a; margin-bottom: 1px;">${buyer.name}</div>
          <div style="color: #475569; line-height: 1.3;">${buyer.address.replace(/\n/g, ', ')}</div>
          <div style="color: #475569; margin-top: 2px;"><b>Phone:</b> ${buyer.phone} | <b>State:</b> ${buyer.state}</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">GSTIN: ${buyer.gstin}</div>
          <div style="font-weight: bold; color: #0f172a;">Drug Lic (DL): ${buyer.drug_license}</div>
        </div>
      </div>

      <!-- Items Table with Dedicated Serial / Batch Column -->
      <table style="border: ${b}; font-size: 9.5px; flex: 1;">
        <thead>
          <tr style="background: ${headerBlue}; color: #ffffff;">
            <th style="padding: 5px 4px; text-align: center; width: 28px;">S.N.</th>
            <th style="padding: 5px 6px; text-align: left;">Item Description</th>
            <th style="padding: 5px 6px; text-align: left; width: 130px; background: #164e96;">Serial / Batch No.</th>
            <th style="padding: 5px 4px; text-align: center; width: 45px;">HSN</th>
            <th style="padding: 5px 4px; text-align: center; width: 35px;">Qty</th>
            <th style="padding: 5px 6px; text-align: right; width: 60px;">MRP</th>
            <th style="padding: 5px 6px; text-align: right; width: 65px;">Rate (₹)</th>
            <th style="padding: 5px 4px; text-align: center; width: 40px;">Disc%</th>
            <th style="padding: 5px 4px; text-align: center; width: 40px;">Tax%</th>
            <th style="padding: 5px 6px; text-align: right; width: 80px;">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${calculatedItems.map(it => {
            const serialBatchDisplay = it.serial ? it.serial : (it.batch ? `${it.batch} (Exp: ${it.exp})` : '---');
            return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="text-align: center; padding: 4px; vertical-align: top;">${it.sno}</td>
                <td style="padding: 4px 6px; vertical-align: top;">
                  <div style="font-weight: bold; color: #0f172a;">${it.name}</div>
                  ${it.subLines.map(sl => `<div style="font-size: 8px; color: #64748b;">${sl}</div>`).join('')}
                </td>
                <td style="padding: 4px 6px; vertical-align: top; font-family: monospace; font-weight: bold; color: #1e3a8a; background: #f8fafc;">
                  ${serialBatchDisplay}
                </td>
                <td style="text-align: center; padding: 4px; vertical-align: top;">${it.hsn}</td>
                <td style="text-align: center; padding: 4px; vertical-align: top; font-weight: bold;">${it.qty}</td>
                <td style="text-align: right; padding: 4px 6px; vertical-align: top; color: #64748b;">${fc(it.mrp)}</td>
                <td style="text-align: right; padding: 4px 6px; vertical-align: top;">${fc(it.price)}</td>
                <td style="text-align: center; padding: 4px; vertical-align: top;">${it.disc ? it.disc + '%' : '0%'}</td>
                <td style="text-align: center; padding: 4px; vertical-align: top;">${it.gstPct}%</td>
                <td style="text-align: right; padding: 4px 6px; vertical-align: top; font-weight: bold;">${fc(it.total)}</td>
              </tr>
            `;
          }).join('')}
          <!-- Spacer -->
          <tr style="height: 40px;"><td colspan="10"></td></tr>
        </tbody>
      </table>

      <!-- Bottom Summary & Bank Grid -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; margin-top: 6px; font-size: 9.5px; border-top: ${b}; padding-top: 6px;">
        <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: ${b}; display: flex; justify-content: space-between; align-items: center;">
          <div style="line-height: 1.45;">
            <div style="font-weight: 800; color: ${headerBlue}; margin-bottom: 2px;">PAYMENT &amp; BANK DETAILS</div>
            <div><b>Bank Name:</b> ${seller.bank}</div>
            <div><b>Account No:</b> ${seller.acc} | <b>IFSC:</b> ${seller.ifsc}</div>
            <div><b>Branch:</b> ${seller.branch}</div>
            <div><b>UPI ID:</b> ${seller.upi}</div>
          </div>
          <div style="text-align: center; margin-left: 8px;">
            ${qrSvg}
            <div style="font-size: 7px; font-weight: bold; color: ${headerBlue};">Scan UPI</div>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: ${b}; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>Taxable Subtotal:</span><span>₹ ${fc(totalTaxable)}</span></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>CGST (9%):</span><span>₹ ${fc(cgstTotal)}</span></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>SGST (9%):</span><span>₹ ${fc(sgstTotal)}</span></div>
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px; color: ${headerBlue}; border-top: 1.5px solid ${headerBlue}; padding-top: 3px; margin-top: 3px;">
            <span>Grand Total:</span><span>₹ ${fc(grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- Amount in Words & Signatory -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 9px;">
        <div style="max-width: 65%;">
          <div><b>Amount in words:</b> <span style="font-weight: bold; color: ${headerBlue};">${safeToWords(grandTotal)}</span></div>
          <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Subject to terms &amp; conditions on reverse. Certified that particulars are true and correct.</div>
        </div>
        <div style="text-align: center; width: 150px;">
          <div style="font-weight: bold; font-size: 8.5px;">${seller.forCo}</div>
          <div style="height: 25px;"></div>
          <div style="font-weight: bold; border-top: 1px solid #94a3b8; padding-top: 1px; font-size: 8.5px;">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// TEMPLATE 04: POS Thermal Receipt 3-Inch (80mm Roll)
// ============================================================================
function generateTemplate04Html() {
  const qrSvg = getQrSvg(`upi://pay?pa=${seller.upi}&pn=${encodeURIComponent(seller.name)}&am=${grandTotal}&cu=INR`, 90);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Template 04 - POS Thermal 3 Inch</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; background: #fff; font-family: 'Courier New', Courier, monospace; color: #000; font-weight: 600; font-size: 11px; line-height: 1.35; }
    .receipt { width: 80mm; margin: 0 auto; padding: 5mm; text-align: center; }
    .dashed { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; }
    @page { size: 80mm auto; margin: 0; }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">${seller.name}</div>
    <div style="font-size: 10px; margin-top: 2px;">${seller.address.replace(/\n/g, '<br>')}</div>
    <div style="font-size: 10px;">TEL: ${seller.phone}</div>
    <div style="font-size: 10px;">GSTIN: ${seller.gstin}</div>
    <div style="font-size: 10px;">DL NO: ${seller.drug_license}</div>

    <div class="dashed"></div>

    <div style="font-size: 12px; font-weight: 900; text-transform: uppercase;">* TAX INVOICE *</div>

    <div style="text-align: left; font-size: 10.5px; margin-top: 4px;">
      <div class="row"><span>BILL TO:</span><span><b>${buyer.name}</b></span></div>
      <div class="row"><span>MOBILE:</span><span>${buyer.phone}</span></div>
      <div class="row"><span>GSTIN:</span><span>${buyer.gstin}</span></div>
      <div class="row"><span>INV NO:</span><span><b>#${invoiceMeta.invoiceNo}</b></span></div>
      <div class="row"><span>DATE:</span><span>${invoiceMeta.invoiceDate}</span></div>
    </div>

    <div class="dashed"></div>

    <!-- Items Header -->
    <div class="row" style="font-weight: 900; font-size: 11px;">
      <span style="text-align: left; flex: 1;">ITEM</span>
      <span style="width: 40px; text-align: center;">QTY</span>
      <span style="width: 70px; text-align: right;">AMT(₹)</span>
    </div>
    <div class="dashed" style="margin: 4px 0;"></div>

    <!-- Items List -->
    <div style="text-align: left; font-size: 10.5px;">
      ${calculatedItems.map((it, idx) => `
        <div style="margin-bottom: 5px;">
          <div class="row" style="font-weight: bold;">
            <span style="flex: 1; padding-right: 2px;">${idx + 1}. ${it.name}</span>
            <span style="width: 40px; text-align: center;">${it.qty}</span>
            <span style="width: 70px; text-align: right;">₹${fc(it.total)}</span>
          </div>
          <div style="font-style: italic; font-size: 9.5px; color: #333; padding-left: 12px;">
            ${it.qty} x ₹${fc(it.price)} (+${it.gstPct}% GST)
          </div>
          ${it.subLines.map(sl => `<div style="font-size: 8.5px; color: #555; padding-left: 12px;">• ${sl}</div>`).join('')}
        </div>
      `).join('')}
    </div>

    <div class="dashed"></div>

    <!-- Totals Breakup -->
    <div style="text-align: left; font-size: 11px;">
      <div class="row"><span>SUBTOTAL:</span><span>₹${fc(totalTaxable)}</span></div>
      <div class="row"><span>CGST (9%):</span><span>₹${fc(cgstTotal)}</span></div>
      <div class="row"><span>SGST (9%):</span><span>₹${fc(sgstTotal)}</span></div>
      <div class="row" style="font-size: 13px; font-weight: 900; margin-top: 4px;">
        <span>GRAND TOTAL:</span><span>₹${fc(grandTotal)}</span>
      </div>
    </div>

    <div class="dashed"></div>

    <!-- Bank & UPI -->
    <div style="text-align: left; font-size: 9.5px;">
      <div><b>BANK:</b> ${seller.bank}</div>
      <div><b>A/C:</b> ${seller.acc} | <b>IFSC:</b> ${seller.ifsc}</div>
    </div>

    <div style="margin: 8px 0;">
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px;">SCAN TO PAY WITH UPI</div>
      ${qrSvg}
      <div style="font-size: 9px; margin-top: 2px;">${seller.upi}</div>
    </div>

    <div class="dashed"></div>

    <div style="font-size: 11px; font-weight: bold;">*** THANK YOU! VISIT AGAIN ***</div>
    <div style="font-size: 8.5px; font-style: italic; color: #555; margin-top: 3px;">
      powered by invocentric • instant compliant invoicing
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// TEMPLATE 05: POS Thermal Receipt 2-Inch (58mm Roll)
// ============================================================================
function generateTemplate05Html() {
  const qrSvg = getQrSvg(`upi://pay?pa=${seller.upi}&pn=${encodeURIComponent(seller.name)}&am=${grandTotal}&cu=INR`, 70);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Template 05 - POS Thermal 2 Inch</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; background: #fff; font-family: 'Courier New', Courier, monospace; color: #000; font-weight: 600; font-size: 9px; line-height: 1.3; }
    .receipt { width: 58mm; margin: 0 auto; padding: 3mm; text-align: center; }
    .dashed { border-top: 1px dashed #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; }
    @page { size: 58mm auto; margin: 0; }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div style="font-size: 11px; font-weight: 900; text-transform: uppercase;">${seller.name}</div>
    <div style="font-size: 8.5px;">${seller.address.replace(/\n/g, ', ')}</div>
    <div style="font-size: 8.5px;">TEL: ${seller.phone}</div>
    <div style="font-size: 8.5px;">GSTIN: ${seller.gstin}</div>

    <div class="dashed"></div>

    <div style="font-size: 10px; font-weight: 900;">* TAX INVOICE *</div>

    <div style="text-align: left; font-size: 8.5px; margin-top: 2px;">
      <div class="row"><span>TO:</span><span><b>${buyer.name}</b></span></div>
      <div class="row"><span>INV:</span><span><b>#${invoiceMeta.invoiceNo}</b></span></div>
      <div class="row"><span>DATE:</span><span>${invoiceMeta.invoiceDate}</span></div>
    </div>

    <div class="dashed"></div>

    <!-- Items Header -->
    <div class="row" style="font-weight: 900; font-size: 9px;">
      <span style="text-align: left; flex: 1;">ITEM</span>
      <span style="width: 25px; text-align: center;">Q</span>
      <span style="width: 48px; text-align: right;">AMT</span>
    </div>
    <div class="dashed" style="margin: 2px 0;"></div>

    <!-- Items List -->
    <div style="text-align: left; font-size: 8.5px;">
      ${calculatedItems.map((it, idx) => `
        <div style="margin-bottom: 3px;">
          <div class="row" style="font-weight: bold;">
            <span style="flex: 1; padding-right: 2px;">${idx + 1}.${it.name}</span>
            <span style="width: 25px; text-align: center;">${it.qty}</span>
            <span style="width: 48px; text-align: right;">₹${fc(it.total)}</span>
          </div>
          <div style="font-size: 8px; color: #444; padding-left: 6px;">
            ${it.qty}x₹${fc(it.price)} (+${it.gstPct}%)
          </div>
        </div>
      `).join('')}
    </div>

    <div class="dashed"></div>

    <!-- Totals -->
    <div style="text-align: left; font-size: 9px;">
      <div class="row"><span>SUBTOTAL:</span><span>₹${fc(totalTaxable)}</span></div>
      <div class="row"><span>TAX (GST):</span><span>₹${fc(totalTax)}</span></div>
      <div class="row" style="font-size: 11px; font-weight: 900; margin-top: 2px;">
        <span>TOTAL:</span><span>₹${fc(grandTotal)}</span>
      </div>
    </div>

    <div class="dashed"></div>

    <div style="margin: 4px 0;">
      <div style="font-size: 8px; font-weight: bold; margin-bottom: 2px;">SCAN TO PAY UPI</div>
      ${qrSvg}
      <div style="font-size: 7.5px; margin-top: 1px;">${seller.upi}</div>
    </div>

    <div class="dashed"></div>

    <div style="font-size: 9.5px; font-weight: bold;">*** THANK YOU ***</div>
    <div style="font-size: 7.5px; font-style: italic; color: #555; margin-top: 2px;">
      powered by invocentric
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// TEMPLATE 06: Nexus Enterprise Pro (A4)
// ============================================================================
function generateTemplate06Html() {
  const brandBlue = '#1a3673';
  const qrSvg = getQrSvg(`upi://pay?pa=${seller.upi}&pn=${encodeURIComponent(seller.name)}&am=${grandTotal}&cu=INR`, 64);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Template 06 - Nexus Enterprise Pro</title>
  <style>
    ${baseStyles}
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #0f172a; }
    .page { width: 210mm; min-height: 297mm; max-height: 297mm; padding: 10mm; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; font-size: 10.5px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <div class="page">
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Top Enterprise Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 900; color: ${brandBlue}; text-transform: uppercase; margin: 0 0 2px 0; letter-spacing: -0.3px;">
            ${seller.name}
          </h1>
          <div style="font-size: 10px; color: #475569; line-height: 1.35;">
            ${seller.address.replace(/\n/g, '<br>')}<br>
            <b>Email:</b> ${seller.email} | <b>Phone:</b> ${seller.phone}<br>
            <b>GSTIN:</b> ${seller.gstin} | <b>DL:</b> ${seller.drug_license}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 26px; font-weight: 900; color: ${brandBlue}; text-transform: uppercase; letter-spacing: 0.8px; line-height: 1;">
            TAX INVOICE
          </div>
          <div style="font-size: 9.5px; color: #64748b; font-weight: 600; margin-top: 4px;">
            ORIGINAL FOR RECIPIENT
          </div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Page 1 of 1</div>
        </div>
      </div>

      <!-- 3-Column Enterprise Party Grid -->
      <div style="display: grid; grid-template-columns: 1.15fr 1.15fr 1fr; gap: 14px; margin-bottom: 14px; font-size: 10px;">
        <!-- Column 1: BILL TO -->
        <div style="background: #f8fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 10.5px; font-weight: 800; color: ${brandBlue}; text-transform: uppercase; margin-bottom: 4px;">
            BILL TO:
          </div>
          <div style="font-weight: 700; font-size: 11px; color: #0f172a; margin-bottom: 1px;">${buyer.name}</div>
          <div style="color: #475569; line-height: 1.35;">${buyer.address.replace(/\n/g, '<br>')}</div>
          <div style="color: #334155; margin-top: 2px;"><b>Tax ID / GSTIN:</b> ${buyer.gstin}</div>
          <div style="color: #334155;"><b>Phone:</b> ${buyer.phone}</div>
        </div>

        <!-- Column 2: SHIP TO -->
        <div style="background: #f8fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 10.5px; font-weight: 800; color: ${brandBlue}; text-transform: uppercase; margin-bottom: 4px;">
            SHIP TO:
          </div>
          <div style="font-weight: 700; font-size: 11px; color: #0f172a; margin-bottom: 1px;">${buyer.name}</div>
          <div style="color: #475569; line-height: 1.35;">${buyer.address.replace(/\n/g, '<br>')}</div>
          <div style="color: #334155; margin-top: 2px;"><b>State:</b> ${buyer.state}</div>
          <div style="color: #334155;"><b>Place of Supply:</b> ${buyer.placeOfSupply}</div>
        </div>

        <!-- Column 3: INVOICE DETAILS -->
        <div style="background: #f8fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 10.5px; font-weight: 800; color: ${brandBlue}; text-transform: uppercase; margin-bottom: 4px;">
            INVOICE DETAILS:
          </div>
          <div style="line-height: 1.45; color: #334155;">
            <div><span style="font-weight: bold;">Invoice No:</span> <span style="font-weight: 800; color: #0f172a;">${invoiceMeta.invoiceNo}</span></div>
            <div><span style="font-weight: bold;">Date:</span> ${invoiceMeta.invoiceDate}</div>
            <div><span style="font-weight: bold;">Due Date:</span> ${invoiceMeta.dueDate}</div>
            <div><span style="font-weight: bold;">PO Number:</span> ${invoiceMeta.poNo}</div>
            <div><span style="font-weight: bold;">Terms:</span> Net 15 Days</div>
          </div>
        </div>
      </div>

      <!-- 10-Column Data Table -->
      <table style="border-collapse: collapse; font-size: 9.5px; flex: 1;">
        <thead>
          <tr style="background: ${brandBlue}; color: #ffffff;">
            <th style="padding: 6px 4px; text-align: center; width: 30px;">S/N</th>
            <th style="padding: 6px 6px; text-align: center; width: 85px;">Product Code</th>
            <th style="padding: 6px 6px; text-align: center; width: 60px;">HSN/SAC</th>
            <th style="padding: 6px 8px; text-align: left;">Item Description &amp; Details</th>
            <th style="padding: 6px 4px; text-align: center; width: 35px;">Qty</th>
            <th style="padding: 6px 4px; text-align: center; width: 35px;">Unit</th>
            <th style="padding: 6px 6px; text-align: right; width: 68px;">Rate (₹)</th>
            <th style="padding: 6px 4px; text-align: center; width: 42px;">Tax %</th>
            <th style="padding: 6px 6px; text-align: right; width: 55px;">Disc</th>
            <th style="padding: 6px 8px; text-align: right; width: 80px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${calculatedItems.map((it, idx) => {
            const isEven = idx % 2 === 1;
            const rowBg = isEven ? '#f8fafc' : '#ffffff';
            const discVal = it.qty * it.price * ((it.disc || 0) / 100);
            return `
              <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                <td style="text-align: center; padding: 6px 4px; vertical-align: top;">${it.sno}</td>
                <td style="text-align: center; padding: 6px; vertical-align: top; font-weight: bold; color: #475569;">${it.sku}</td>
                <td style="text-align: center; padding: 6px; vertical-align: top;">${it.hsn}</td>
                <td style="padding: 6px 8px; vertical-align: top;">
                  <div style="font-weight: 700; color: #0f172a;">${it.name}</div>
                  ${it.subLines.map(sl => `<div style="font-size: 8px; color: #64748b; margin-top: 1px;">${sl}</div>`).join('')}
                </td>
                <td style="text-align: center; padding: 6px 4px; vertical-align: top; font-weight: bold;">${it.qty}</td>
                <td style="text-align: center; padding: 6px 4px; vertical-align: top; color: #64748b;">${it.unit}</td>
                <td style="text-align: right; padding: 6px; vertical-align: top;">${fc(it.price)}</td>
                <td style="text-align: center; padding: 6px 4px; vertical-align: top;">${it.gstPct}%</td>
                <td style="text-align: right; padding: 6px; vertical-align: top;">${fc(discVal)}</td>
                <td style="text-align: right; padding: 6px 8px; vertical-align: top; font-weight: 700; color: #0f172a;">${fc(it.total)}</td>
              </tr>
            `;
          }).join('')}
          <tr style="height: 40px;"><td colspan="10"></td></tr>
        </tbody>
      </table>

      <!-- Bottom Totals & Signatures -->
      <div style="margin-top: auto; padding-top: 10px;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
          <div style="width: 260px; font-size: 10px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #334155;">
              <span style="font-weight: bold;">Gross Taxable Subtotal:</span>
              <span style="font-weight: bold;">₹ ${fc(totalTaxable)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #334155;">
              <span style="font-weight: bold;">CGST (9%):</span>
              <span style="font-weight: bold;">+₹ ${fc(cgstTotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #334155;">
              <span style="font-weight: bold;">SGST (9%):</span>
              <span style="font-weight: bold;">+₹ ${fc(sgstTotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; margin-top: 4px; border-top: 1.5px solid ${brandBlue}; border-bottom: 2px solid ${brandBlue}; font-size: 13px; font-weight: 900; color: ${brandBlue};">
              <span>Grand Total:</span>
              <span>₹ ${fc(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 20px;">
          <div style="flex: 1;">
            <div style="font-size: 10px; font-weight: 800; color: ${brandBlue}; margin-bottom: 3px;">
              Terms &amp; Declarations:
            </div>
            <ol style="margin: 0; padding-left: 14px; font-size: 8.5px; color: #475569; line-height: 1.4;">
              <li>Goods once sold will not be returned without authorized authorization.</li>
              <li>Warranty claims are processed as per original equipment manufacturer policies.</li>
              <li>Please reference invoice number ${invoiceMeta.invoiceNo} on all electronic fund transfers.</li>
            </ol>
            <div style="margin-top: 6px; padding: 4px 8px; background: #f1f5f9; border-radius: 4px; font-size: 8.5px; color: #334155; display: inline-block;">
              <b>Bank:</b> ${seller.bank} | <b>A/C:</b> ${seller.acc} | <b>IFSC:</b> ${seller.ifsc}
            </div>
          </div>

          <div style="display: flex; align-items: flex-end; gap: 14px;">
            <div style="text-align: center;">
              ${qrSvg}
              <div style="font-size: 7.5px; color: #64748b; font-weight: bold; margin-top: 2px;">UPI QR Pay</div>
            </div>
            <div style="width: 150px; text-align: center;">
              <div style="height: 35px;"></div>
              <div style="border-top: 1.5px solid ${brandBlue}; padding-top: 2px; font-weight: 700; font-size: 9.5px; color: ${brandBlue};">
                Authorized Signatory
              </div>
              <div style="font-size: 8px; color: #64748b;">${seller.name}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// MAIN GENERATOR EXECUTOR
// ============================================================================
async function run() {
  console.log('🚀 Starting Demo Invoices PDF Generation...');
  console.log('📁 Destination folder:', outputDir);

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const templates = [
    {
      id: 'template_01',
      filename: 'Template_01_Modern_Clean_A4.pdf',
      html: generateTemplate01Html(),
      pdfOptions: { format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } }
    },
    {
      id: 'template_02',
      filename: 'Template_02_Corporate_Bordered_A4.pdf',
      html: generateTemplate02Html(),
      pdfOptions: { format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } }
    },
    {
      id: 'template_03',
      filename: 'Template_03_Wholesale_Pharma_B2B_A4.pdf',
      html: generateTemplate03Html(),
      pdfOptions: { format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } }
    },
    {
      id: 'template_04',
      filename: 'Template_04_POS_Thermal_3Inch_80mm.pdf',
      html: generateTemplate04Html(),
      pdfOptions: { width: '80mm', height: '220mm', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } }
    },
    {
      id: 'template_05',
      filename: 'Template_05_POS_Thermal_2Inch_58mm.pdf',
      html: generateTemplate05Html(),
      pdfOptions: { width: '58mm', height: '190mm', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } }
    },
    {
      id: 'template_06',
      filename: 'Template_06_Nexus_Enterprise_Pro_A4.pdf',
      html: generateTemplate06Html(),
      pdfOptions: { format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } }
    }
  ];

  const publicPdfDir = path.join(__dirname, '..', 'public', 'demo-invoices');
  const publicImgDir = path.join(__dirname, '..', 'public', 'templates');
  if (!fs.existsSync(publicPdfDir)) fs.mkdirSync(publicPdfDir, { recursive: true });
  if (!fs.existsSync(publicImgDir)) fs.mkdirSync(publicImgDir, { recursive: true });

  for (const tpl of templates) {
    const isPOS = tpl.id === 'template_04' || tpl.id === 'template_05';
    const page = await browser.newPage({
      deviceScaleFactor: 2
    });
    await page.setViewportSize({
      width: isPOS ? (tpl.id === 'template_04' ? 420 : 340) : 950,
      height: isPOS ? 950 : 1350
    });

    await page.setContent(tpl.html, { waitUntil: 'load' });
    
    // Save PDF to desktop folder
    const desktopPath = path.join(outputDir, tpl.filename);
    await page.pdf({
      path: desktopPath,
      ...tpl.pdfOptions
    });

    // Save PDF to public folder
    const publicPdfPath = path.join(publicPdfDir, tpl.filename);
    fs.copyFileSync(desktopPath, publicPdfPath);
    console.log(`✅ Generated PDF: ${tpl.filename}`);

    // Take high-resolution preview screenshot
    const selector = isPOS ? '.receipt' : '.page';
    const el = await page.$(selector);
    if (el) {
      await el.screenshot({
        path: path.join(publicImgDir, `${tpl.id}.png`),
        type: 'png'
      });
      console.log(`🖼️ Captured Preview: ${tpl.id}.png`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\n🎉 All 6 demo invoice PDFs & preview images have been successfully generated!');
}

run().catch(err => {
  console.error('❌ Error generating PDFs:', err);
  process.exit(1);
});
