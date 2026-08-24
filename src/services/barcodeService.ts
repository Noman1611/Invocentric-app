import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';

export type BarcodeType = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'ITF14' | 'pharmacode' | 'codabar';

export interface BarcodeOptions {
  type: BarcodeType;
  value: string;
  width?: number; // bar width in px (1-4)
  height?: number; // bar height in px (30-150)
  displayValue?: boolean;
  text?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  textPosition?: 'bottom' | 'top';
  textMargin?: number;
  background?: string;
  lineColor?: string;
  margin?: number;
}

export interface BarcodeValidationResult {
  isValid: boolean;
  error?: string;
  suggestedValue?: string;
}

export interface LabelProductData {
  id?: string;
  name: string;
  sku?: string;
  barcode: string;
  barcodeType?: BarcodeType;
  price?: number;
  mrp?: number;
  category?: string;
  unit?: string;
  quantity?: number;
}

export interface LabelSheetConfig {
  sheetType: 'a4_24' | 'a4_65' | 'a5_12' | 'thermal_50x25' | 'thermal_50x38' | 'thermal_100x50' | 'custom';
  name: string;
  paperSize: 'A4' | 'A5' | 'thermal' | 'custom';
  pageWidthMm: number;
  pageHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  rows: number;
  gapHorizontalMm: number;
  gapVerticalMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
}

export const PRESET_SHEET_CONFIGS: Record<string, LabelSheetConfig> = {
  a4_24: {
    sheetType: 'a4_24',
    name: 'A4 — 24 Labels (3x8) (70mm × 37mm)',
    paperSize: 'A4',
    pageWidthMm: 210,
    pageHeightMm: 297,
    labelWidthMm: 70,
    labelHeightMm: 37,
    columns: 3,
    rows: 8,
    gapHorizontalMm: 0,
    gapVerticalMm: 0,
    marginTopMm: 0,
    marginBottomMm: 0,
    marginLeftMm: 0,
    marginRightMm: 0,
  },
  a4_65: {
    sheetType: 'a4_65',
    name: 'A4 — 65 Labels (5x13) (38mm × 21.2mm)',
    paperSize: 'A4',
    pageWidthMm: 210,
    pageHeightMm: 297,
    labelWidthMm: 38.1,
    labelHeightMm: 21.2,
    columns: 5,
    rows: 13,
    gapHorizontalMm: 2.5,
    gapVerticalMm: 0,
    marginTopMm: 10.7,
    marginBottomMm: 10.7,
    marginLeftMm: 4.7,
    marginRightMm: 4.7,
  },
  a5_12: {
    sheetType: 'a5_12',
    name: 'A5 — 12 Labels (2x6) (65mm × 32mm)',
    paperSize: 'A5',
    pageWidthMm: 148,
    pageHeightMm: 210,
    labelWidthMm: 65,
    labelHeightMm: 32,
    columns: 2,
    rows: 6,
    gapHorizontalMm: 4,
    gapVerticalMm: 2,
    marginTopMm: 4,
    marginBottomMm: 4,
    marginLeftMm: 7,
    marginRightMm: 7,
  },
  thermal_50x25: {
    sheetType: 'thermal_50x25',
    name: 'Thermal Roll — 50mm × 25mm (Standard)',
    paperSize: 'thermal',
    pageWidthMm: 50,
    pageHeightMm: 25,
    labelWidthMm: 50,
    labelHeightMm: 25,
    columns: 1,
    rows: 1,
    gapHorizontalMm: 0,
    gapVerticalMm: 0,
    marginTopMm: 0,
    marginBottomMm: 0,
    marginLeftMm: 0,
    marginRightMm: 0,
  },
  thermal_50x38: {
    sheetType: 'thermal_50x38',
    name: 'Thermal Roll — 50mm × 38mm (Jewelry / Garment)',
    paperSize: 'thermal',
    pageWidthMm: 50,
    pageHeightMm: 38,
    labelWidthMm: 50,
    labelHeightMm: 38,
    columns: 1,
    rows: 1,
    gapHorizontalMm: 0,
    gapVerticalMm: 0,
    marginTopMm: 0,
    marginBottomMm: 0,
    marginLeftMm: 0,
    marginRightMm: 0,
  },
  thermal_100x50: {
    sheetType: 'thermal_100x50',
    name: 'Thermal Roll — 100mm × 50mm (Shipping / Box)',
    paperSize: 'thermal',
    pageWidthMm: 100,
    pageHeightMm: 50,
    labelWidthMm: 100,
    labelHeightMm: 50,
    columns: 1,
    rows: 1,
    gapHorizontalMm: 0,
    gapVerticalMm: 0,
    marginTopMm: 0,
    marginBottomMm: 0,
    marginLeftMm: 0,
    marginRightMm: 0,
  }
};

/**
 * Calculates EAN-13 / EAN-8 / UPC Checksum digit using standard modulo 10
 */
export function calculateEanChecksum(rawDigits: string): number {
  const len = rawDigits.length;
  let sum = 0;
  for (let i = len - 1; i >= 0; i--) {
    const digit = parseInt(rawDigits[i], 10);
    if (isNaN(digit)) return 0;
    const isOddFromRight = (len - i) % 2 === 1;
    sum += isOddFromRight ? digit * 3 : digit * 1;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Validates barcode format strictly according to format specifications
 */
export function validateBarcode(type: BarcodeType, rawValue: string): BarcodeValidationResult {
  const val = (rawValue || '').trim();

  if (!val) {
    return { isValid: false, error: 'Barcode value cannot be empty.' };
  }

  switch (type) {
    case 'EAN13': {
      if (!/^\d+$/.test(val)) {
        return { isValid: false, error: 'EAN-13 accepts numeric digits only (0-9).' };
      }
      if (val.length === 12) {
        const check = calculateEanChecksum(val);
        return { 
          isValid: true, 
          suggestedValue: val + check 
        };
      }
      if (val.length === 13) {
        const body = val.slice(0, 12);
        const expectedCheck = calculateEanChecksum(body);
        const actualCheck = parseInt(val[12], 10);
        if (expectedCheck !== actualCheck) {
          return { 
            isValid: false, 
            error: `Invalid EAN-13 checksum (expected '${expectedCheck}' at end, got '${actualCheck}').`,
            suggestedValue: body + expectedCheck
          };
        }
        return { isValid: true };
      }
      return { isValid: false, error: 'EAN-13 must be exactly 12 or 13 digits long.' };
    }

    case 'EAN8': {
      if (!/^\d+$/.test(val)) {
        return { isValid: false, error: 'EAN-8 accepts numeric digits only (0-9).' };
      }
      if (val.length === 7) {
        const check = calculateEanChecksum(val);
        return { isValid: true, suggestedValue: val + check };
      }
      if (val.length === 8) {
        const body = val.slice(0, 7);
        const expectedCheck = calculateEanChecksum(body);
        const actualCheck = parseInt(val[7], 10);
        if (expectedCheck !== actualCheck) {
          return { 
            isValid: false, 
            error: `Invalid EAN-8 checksum (expected '${expectedCheck}' at end, got '${actualCheck}').`,
            suggestedValue: body + expectedCheck
          };
        }
        return { isValid: true };
      }
      return { isValid: false, error: 'EAN-8 must be exactly 7 or 8 digits long.' };
    }

    case 'UPC': {
      if (!/^\d+$/.test(val)) {
        return { isValid: false, error: 'UPC-A accepts numeric digits only (0-9).' };
      }
      if (val.length === 11) {
        const check = calculateEanChecksum(val);
        return { isValid: true, suggestedValue: val + check };
      }
      if (val.length === 12) {
        const body = val.slice(0, 11);
        const expectedCheck = calculateEanChecksum(body);
        const actualCheck = parseInt(val[11], 10);
        if (expectedCheck !== actualCheck) {
          return { 
            isValid: false, 
            error: `Invalid UPC checksum (expected '${expectedCheck}' at end, got '${actualCheck}').`,
            suggestedValue: body + expectedCheck
          };
        }
        return { isValid: true };
      }
      return { isValid: false, error: 'UPC-A must be exactly 11 or 12 digits long.' };
    }

    case 'CODE39': {
      if (!/^[0-9A-Z\-.$/+% ]+$/i.test(val)) {
        return { isValid: false, error: 'CODE39 only supports uppercase letters, numbers, and - . $ / + % characters.' };
      }
      return { isValid: true };
    }

    case 'ITF14': {
      if (!/^\d+$/.test(val)) {
        return { isValid: false, error: 'ITF-14 accepts numeric digits only (0-9).' };
      }
      if (val.length === 13) {
        const check = calculateEanChecksum(val);
        return { isValid: true, suggestedValue: val + check };
      }
      if (val.length === 14) {
        return { isValid: true };
      }
      return { isValid: false, error: 'ITF-14 must be 13 or 14 digits.' };
    }

    case 'codabar': {
      if (!/^[A-D]?[0-9\-$:/.+]+[A-D]?$/i.test(val)) {
        return { isValid: false, error: 'CODABAR only accepts digits, -$:/+ and optional start/stop characters (A-D).' };
      }
      return { isValid: true };
    }

    case 'CODE128':
    default: {
      // CODE128 supports standard ASCII characters (32-126)
      return { isValid: true };
    }
  }
}

/**
 * Renders barcode on an SVG element directly using JsBarcode
 */
export function renderBarcodeSvg(svgElement: SVGSVGElement | null, options: BarcodeOptions): boolean {
  if (!svgElement) return false;
  const validation = validateBarcode(options.type, options.value);
  if (!validation.isValid) {
    svgElement.innerHTML = '';
    return false;
  }

  const finalValue = validation.suggestedValue || options.value;
  try {
    JsBarcode(svgElement, finalValue, {
      format: options.type === 'UPC' ? 'UPC' : options.type,
      width: options.width || 2,
      height: options.height || 60,
      displayValue: options.displayValue ?? true,
      text: options.text || undefined,
      fontOptions: 'bold',
      font: 'monospace',
      textAlign: options.textAlign || 'center',
      textPosition: options.textPosition || 'bottom',
      textMargin: options.textMargin ?? 2,
      fontSize: options.fontSize || 14,
      background: options.background || '#ffffff',
      lineColor: options.lineColor || '#000000',
      margin: options.margin ?? 8,
      valid: () => {}
    });
    return true;
  } catch (err) {
    console.error('Barcode render error:', err);
    svgElement.innerHTML = '';
    return false;
  }
}

/**
 * Generates an SVG string representation of the barcode
 */
export function generateBarcodeSvgString(options: BarcodeOptions): string | null {
  if (typeof document === 'undefined') return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const success = renderBarcodeSvg(svg, options);
  if (!success) return null;
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Generates high-res Data URL (PNG) from barcode options
 */
export async function generateBarcodeDataUrl(options: BarcodeOptions, scale: number = 2): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const validation = validateBarcode(options.type, options.value);
  if (!validation.isValid) return null;

  const finalValue = validation.suggestedValue || options.value;
  try {
    JsBarcode(canvas, finalValue, {
      format: options.type === 'UPC' ? 'UPC' : options.type,
      width: (options.width || 2) * scale,
      height: (options.height || 60) * scale,
      displayValue: options.displayValue ?? true,
      text: options.text || undefined,
      fontOptions: 'bold',
      font: 'monospace',
      textAlign: options.textAlign || 'center',
      textPosition: options.textPosition || 'bottom',
      textMargin: (options.textMargin ?? 2) * scale,
      fontSize: (options.fontSize || 14) * scale,
      background: options.background || '#ffffff',
      lineColor: options.lineColor || '#000000',
      margin: (options.margin ?? 8) * scale,
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('generateBarcodeDataUrl failed:', e);
    return null;
  }
}

/**
 * Downloads Barcode as high-res PNG file
 */
export async function downloadBarcodePng(options: BarcodeOptions, filename?: string): Promise<boolean> {
  const dataUrl = await generateBarcodeDataUrl(options, 3);
  if (!dataUrl) return false;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = (filename || `Barcode_${options.value}`).replace(/[^a-z0-9_-]/gi, '_') + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

/**
 * Downloads Barcode as vector SVG file
 */
export function downloadBarcodeSvg(options: BarcodeOptions, filename?: string): boolean {
  const svgStr = generateBarcodeSvgString(options);
  if (!svgStr) return false;
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (filename || `Barcode_${options.value}`).replace(/[^a-z0-9_-]/gi, '_') + '.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Exports single barcode as a clean vector PDF
 */
export async function exportSingleBarcodePdf(
  options: BarcodeOptions,
  productInfo?: { name?: string; price?: number; mrp?: number; sku?: string },
  businessName?: string
): Promise<boolean> {
  const dataUrl = await generateBarcodeDataUrl(options, 4);
  if (!dataUrl) return false;

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [100, 60]
  });

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, 100, 60, 'F');

  let curY = 8;

  if (businessName) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    pdf.text(businessName.toUpperCase(), 50, curY, { align: 'center' });
    curY += 6;
  }

  if (productInfo?.name) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(productInfo.name.slice(0, 30), 50, curY, { align: 'center' });
    curY += 5;
  }

  // Draw Barcode Image
  pdf.addImage(dataUrl, 'PNG', 10, curY, 80, 26, undefined, 'FAST');
  curY += 28;

  if (productInfo?.price) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(22, 101, 52);
    const priceText = `PRICE: Rs. ${productInfo.price}` + (productInfo.mrp ? ` (MRP: Rs. ${productInfo.mrp})` : '');
    pdf.text(priceText, 50, curY, { align: 'center' });
  }

  pdf.save((productInfo?.name || `Barcode_${options.value}`).replace(/[^a-z0-9_-]/gi, '_') + '.pdf');
  return true;
}

/**
 * Copies Barcode to OS clipboard as an image
 */
export async function copyBarcodeToClipboard(options: BarcodeOptions): Promise<boolean> {
  try {
    const dataUrl = await generateBarcodeDataUrl(options, 2);
    if (!dataUrl) return false;

    const res = await fetch(dataUrl);
    const blob = await res.blob();

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Copy to clipboard failed:', err);
    return false;
  }
}
