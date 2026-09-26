import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { getSecureStorage } from '../utils/cryptoUtils';
import { formatCurrency, cn, normalizePhoneNumber } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { toWords } from 'number-to-words';
import { ArrowLeft, Edit3, Printer, Download, Loader2, X, Sliders, Settings2, Upload, Trash2, Check, FileSpreadsheet, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { WhatsAppShareModal } from '../components/WhatsAppShareModal';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import { dbService } from '../services/dbService';
import { getStoredUserProfile, mergeProfileData } from '../utils/settingsStorage';

const safeToWords = (value: number, currency: string = 'INR'): string => {
  try {
    const v = Math.floor(value);
    if (isFinite(v) && !isNaN(v) && v >= 0) {
      return (toWords(v) + ' ' + (currency === 'INR' ? 'RUPEES' : currency) + ' ONLY').toUpperCase();
    }
  } catch (_) {}
  return '';
};

const fmtDate = (d: any, fmt: string = 'dd-MMM-yyyy'): string => {
  if (!d) return '';
  try {
    if (d?.toDate) return format(d.toDate(), fmt);
    if (typeof d === 'string') {
      const p = parseISO(d);
      if (!isNaN(p.getTime())) return format(p, fmt);
      const q = new Date(d);
      if (!isNaN(q.getTime())) return format(q, fmt);
    }
    if (d instanceof Date && !isNaN(d.getTime())) return format(d, fmt);
  } catch (_) {}
  return String(d);
};

const fc = (n: any, cur = 'INR') => formatCurrency(Number(n) || 0, cur);

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isOfflineMode } = useAuth();
  const [invoice, setInvoice] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppUrlState, setWhatsAppUrlState] = useState('');
  const [whatsAppWebUrlState, setWhatsAppWebUrlState] = useState('');
  const [whatsAppAppUrlState, setWhatsAppAppUrlState] = useState('');
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const autoPrintTriggeredRef = useRef(false);
  const autoShareTriggeredRef = useRef(false);

  const shouldAutoPrint = searchParams.get('print') === 'true' || searchParams.get('pos') === 'true' || searchParams.get('autoPrint') === 'true';
  const shouldAutoShare = searchParams.get('share') === 'true';

  // Responsive Auto-Fit Scaling on Mobile Devices (< 768px) - Hook called unconditionally at top level
  const [fitToScreen, setFitToScreen] = useState(true);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [customZoom, setCustomZoom] = useState<number | null>(null);

  const handleZoomIn = () => {
    setFitToScreen(false);
    setCustomZoom(prev => Math.min(2.2, Number(((prev ?? (fitToScreen ? scaleFactor : 1)) + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    setFitToScreen(false);
    setCustomZoom(prev => Math.max(0.35, Number(((prev ?? (fitToScreen ? scaleFactor : 1)) - 0.15).toFixed(2))));
  };

  const handleResetFit = () => {
    setFitToScreen(true);
    setCustomZoom(null);
  };

  const handleSet100 = () => {
    setFitToScreen(false);
    setCustomZoom(1.0);
  };

  // Two-finger pinch-to-zoom gesture support for Android APK & Mobile
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
      touchStartScaleRef.current = customZoom ?? (fitToScreen ? scaleFactor : 1);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / touchStartDistRef.current;
      const newScale = Math.min(2.5, Math.max(0.35, Number((touchStartScaleRef.current * ratio).toFixed(2))));
      setFitToScreen(false);
      setCustomZoom(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
    }
  };

  useEffect(() => {
    const computeScale = () => {
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      if (screenWidth < 768) {
        // Base sheet width for 210mm A4 is ~794px
        const baseA4WidthPx = 794;
        const padding = 20; // 10px on each side
        const availWidth = Math.max(screenWidth - padding, 280);
        const computed = Math.min(1, availWidth / baseA4WidthPx);
        setScaleFactor(computed);
      } else {
        setScaleFactor(1);
      }
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [pageSize]);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      setLoading(true);
      try {
        const upserts = getSecureStorage('offline_queue_upserts', []);
        const localInvoices = getSecureStorage(`offline_invoices_${user?.uid || 'guest'}`, []);
        let invData: any = null;
        
        // 1. Check offline queue
        const qi = upserts.find((u: any) => u.collection === 'invoices' && u.item.id === id);
        if (qi) invData = qi.item;
        
        // 2. Check local storage
        if (!invData) invData = localInvoices.find((i: any) => i.id === id);
        
        // 3. Check Firestore
        if (!invData) {
          try {
            const snap = await getDoc(doc(db, 'invoices', id));
            if (snap.exists()) invData = { id: snap.id, ...snap.data() };
          } catch (fsErr) {
            console.warn("Firestore invoice fetch error:", fsErr);
          }
        }

        if (invData) {
          setInvoice(invData);

          // Fetch Customer details if present
          if (invData.customer_id) {
            let cust: any = null;
            const qc = upserts.find((u: any) => u.collection === 'customers' && u.item.id === invData.customer_id);
            if (qc) cust = qc.item;
            if (!cust) cust = getSecureStorage(`offline_customers_${user?.uid || 'guest'}`, []).find((c: any) => c.id === invData.customer_id);
            if (!cust) {
              try { const s = await getDoc(doc(db, 'customers', invData.customer_id)); if (s.exists()) cust = { id: s.id, ...s.data() }; } catch (_) {}
            }
            if (cust) setCustomer(cust);
          }

          // Robust multi-layer Fetch for Seller / Business details
          let mergedSeller: any = {};
          
          // Specific profile keys for invData.user_id, user?.uid, or 'guest'
          const candidateUids = [invData.user_id, user?.uid, 'guest'].filter(Boolean) as string[];
          for (const uid of candidateUids) {
            try {
              const cp = getStoredUserProfile(uid);
              if (cp && typeof cp === 'object') {
                mergedSeller = mergeProfileData(mergedSeller, cp);
              }
            } catch (_) {}

            try {
              const cachedUsers = getSecureStorage(`offline_users_${uid}`, []);
              if (Array.isArray(cachedUsers)) {
                const found = cachedUsers.find((u: any) => u.id === uid || u.uid === uid);
                if (found) {
                  mergedSeller = mergeProfileData(mergedSeller, found);
                }
              }
            } catch (_) {}
          }

          // Layer 3: Firestore users document if online
          if (navigator.onLine && !isOfflineMode) {
            for (const uid of candidateUids) {
              try {
                const s = await getDoc(doc(db, 'users', uid));
                if (s.exists()) {
                  mergedSeller = mergeProfileData(mergedSeller, { id: s.id, ...s.data() });
                }
              } catch (_) {}
            }
          }

          // Layer 4: Snapshot from invoice itself if available
          if (invData.seller_info && typeof invData.seller_info === 'object') {
            mergedSeller = mergeProfileData(mergedSeller, invData.seller_info);
          }
          if (invData.upi_id) {
            mergedSeller.upi_id = invData.upi_id;
          }

          if (user && !mergedSeller.business_name) {
            mergedSeller.business_name = user.displayName || 'Business Name';
            if (!mergedSeller.email) mergedSeller.email = user.email || '';
          }

          setSellerInfo(mergedSeller);
        }
      } catch (err) { 
        console.error("Error loading invoice:", err);
      } finally { 
        setLoading(false); 
      }
    }
    fetchData();
  }, [id, user, isOfflineMode]);

  // Letterhead State & Alignment Sliders
  const [useLetterhead, setUseLetterhead] = useState<boolean>(false);
  const [letterheadTop, setLetterheadTop] = useState<number>(55); // Default 55mm (~2.16 in) to clear top letterhead graphics
  const [letterheadBottom, setLetterheadBottom] = useState<number>(35); // Default 35mm (~1.38 in) to clear bottom letterhead footer
  const [letterheadHideHeader, setLetterheadHideHeader] = useState<boolean>(true);
  const [showLetterheadSlider, setShowLetterheadSlider] = useState<boolean>(false);
  const [isSavingLetterhead, setIsSavingLetterhead] = useState<boolean>(false);
  const [letterheadUrl, setLetterheadUrl] = useState<string>('');
  const letterheadFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync letterhead settings from invoice or seller profile
  useEffect(() => {
    if (invoice || sellerInfo) {
      const isEnabled = invoice?.letterhead_enabled !== undefined 
        ? Boolean(invoice.letterhead_enabled) 
        : Boolean(sellerInfo?.letterhead_enabled);
      const rawTop = invoice?.letterhead_top_margin !== undefined 
        ? Number(invoice.letterhead_top_margin) 
        : (sellerInfo?.letterhead_top_margin !== undefined ? Number(sellerInfo.letterhead_top_margin) : 55);
      const rawBottom = invoice?.letterhead_bottom_margin !== undefined 
        ? Number(invoice.letterhead_bottom_margin) 
        : (sellerInfo?.letterhead_bottom_margin !== undefined ? Number(sellerInfo.letterhead_bottom_margin) : 35);
      const hideHeader = invoice?.letterhead_hide_header !== undefined 
        ? Boolean(invoice.letterhead_hide_header) 
        : (sellerInfo?.letterhead_hide_header !== undefined ? Boolean(sellerInfo.letterhead_hide_header) : true);
      const url = invoice?.letterhead_url || sellerInfo?.letterhead_url || '';

      setUseLetterhead(isEnabled);
      // Ensure positive margins when letterhead is active
      setLetterheadTop(rawTop > 0 ? rawTop : 55);
      setLetterheadBottom(rawBottom > 0 ? rawBottom : 35);
      setLetterheadHideHeader(hideHeader);
      setLetterheadUrl(url);
    }
  }, [invoice, sellerInfo]);

  const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Letterhead image should be under 15MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetWidth = 1400;
        const targetHeight = Math.round((img.height / img.width) * 1400);
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setLetterheadUrl(compressed);
          setUseLetterhead(true);
        } else {
          setLetterheadUrl(raw);
          setUseLetterhead(true);
        }
      };
      img.onerror = () => {
        setLetterheadUrl(raw);
        setUseLetterhead(true);
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLetterhead = () => {
    setLetterheadUrl('');
    setUseLetterhead(false);
    if (letterheadFileInputRef.current) {
      letterheadFileInputRef.current.value = '';
    }
  };

  const handleSaveLetterheadOffset = async () => {
    setIsSavingLetterhead(true);
    try {
      const payload = {
        letterhead_enabled: useLetterhead,
        letterhead_top_margin: letterheadTop,
        letterhead_bottom_margin: letterheadBottom,
        letterhead_hide_header: letterheadHideHeader,
        letterhead_url: letterheadUrl,
      };
      if (invoice?.id) {
        await dbService.update('invoices', invoice.id, payload, { offlineMode: isOfflineMode, userId: user?.uid || 'guest' });
      }
      if (user?.uid) {
        await dbService.update('users', user.uid, payload, { offlineMode: isOfflineMode, userId: user.uid });
      }
      alert("✅ Letterhead and alignment settings saved as default!");
      setShowLetterheadSlider(false);
    } catch (err) {
      console.error("Failed to save letterhead offset:", err);
      alert("Failed to save letterhead settings.");
    } finally {
      setIsSavingLetterhead(false);
    }
  };

  // Trigger Auto-Print when navigating with ?print=true or ?pos=true
  useEffect(() => {
    if (!loading && invoice && shouldAutoPrint && !autoPrintTriggeredRef.current) {
      autoPrintTriggeredRef.current = true;
      setHasAutoPrinted(true);
      const timer = setTimeout(() => {
        window.print();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [loading, invoice, shouldAutoPrint]);

  // Trigger Auto-Share when navigating with ?share=true
  useEffect(() => {
    if (!loading && invoice && shouldAutoShare && !autoShareTriggeredRef.current) {
      autoShareTriggeredRef.current = true;
      const timer = setTimeout(() => {
        handleShare();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading, invoice, shouldAutoShare]);

  const rawTpl: string = invoice?.invoice_template || sellerInfo?.invoice_template || 'template_01';
  // Map templates: support the 5 sequential templates and legacy fallbacks
  const legacyMap: Record<string, string> = {
    'template_01': 'template_01', // Template 01 - Blue Bordered + IGST Columns (A4)
    'template_02': 'template_02', // Template 02 - Blue Line Top + IGST Columns (A4)
    'template_03': 'template_03', // Template 03 - Supplier B2B (Dedicated Serial / Batch Column)
    'template_04': 'template_04', // Template 04 - POS Receipt Thermal (3-Inch / 80mm Roll)
    'template_05': 'template_05', // Template 05 - POS Receipt Thermal (2-Inch / 58mm Roll)

    // Legacy fallback mapping
    'template_16': 'template_03',
    'template_14': 'template_04',
    'template_15': 'template_05',
    'tally_prime_gst': 'template_01',
    'gst_classic': 'template_02',
    'modern_blue': 'template_01',
    'compact': 'template_02',
    'minimal': 'template_02',
    'template_07': 'template_01',
    'template_08': 'template_02',
    'template_09': 'template_02',
    'template_10': 'template_02',
    'template_12': 'template_01',
  };
  const tpl: string = legacyMap[rawTpl] || rawTpl;
  const isPOS = tpl === 'template_04' || tpl === 'template_05' || tpl === 'template_14' || tpl === 'template_15';
  const isA5 = !isPOS && pageSize === 'A5';
  const items = invoice?.items || [];
  const cur = invoice?.currency || 'INR';

  // Dynamic column visibility from invoice or fallback to true
  const colVis = {
    size: invoice?.columnVisibility?.size ?? true,
    hsn: invoice?.columnVisibility?.hsn ?? true,
    mrp: invoice?.columnVisibility?.mrp ?? true,
    discount: invoice?.columnVisibility?.discount ?? true,
    gstPercent: invoice?.columnVisibility?.gstPercent ?? true,
  };

  // Section visibility (Show if false or undefined, Hide if true)
  const hideSec = invoice?.hide_sections || {};
  const showSec = {
    bank_details: !hideSec.bank_details,
    upi_qr: !hideSec.upi_qr,
    signature: !hideSec.signature,
    seller_address: !hideSec.seller_address,
    customer_gstin: !hideSec.customer_gstin,
    terms: !hideSec.terms,
    declaration: !hideSec.declaration,
    amount_in_words: !hideSec.amount_in_words,
    hsn_summary: !hideSec.hsn_summary,
    footer: !hideSec.footer,
  };

  const itemRows = items.map((i: any) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.price || i.mrp) || 0;
    const disc = Number(i.discount) || 0;
    const gstPct = Number(i.gstPercent || i.gst_rate) || 0;
    const taxable = qty * price * (1 - disc / 100);
    const gstAmt = taxable * gstPct / 100;

    const subDetails: string[] = [];
    if (i.serial_number) subDetails.push(`Serial No: ${i.serial_number}`);
    if (i.serialNumber && i.serialNumber !== i.serial_number) subDetails.push(`Serial No: ${i.serialNumber}`);
    if (Array.isArray(i.serial_numbers)) {
      i.serial_numbers.forEach((sn: any) => {
        if (sn) subDetails.push(`Serial No: ${sn}`);
      });
    }
    if (i.batch_no || i.batchNumber || i.batch) {
      subDetails.push(`Batch: ${i.batch_no || i.batchNumber || i.batch}`);
    }
    if (i.custom_box) {
      subDetails.push(i.custom_box);
    }
    if (i.expiry_date) {
      subDetails.push(`Exp: ${fmtDate(i.expiry_date)}`);
    }
    if (Array.isArray(i.subLines)) {
      subDetails.push(...i.subLines);
    }

    return {
      ...i,
      qty,
      price,
      disc,
      gstPct,
      taxable,
      gstAmt,
      total: taxable + gstAmt,
      size: i.size || '',
      mrp: Number(i.mrp || 0),
      hsn: i.hsn_code || i.hsn || '---',
      name: i.description || i.name || 'Item',
      subLines: Array.from(new Set(subDetails))
    };
  });

  const totalTaxable = itemRows.reduce((a: number, i: any) => a + i.taxable, 0);
  const totalTax = itemRows.reduce((a: number, i: any) => a + i.gstAmt, 0);
  const grandTotal = Number(invoice?.amount || 0);
  const qtyTotal = itemRows.reduce((a: number, i: any) => a + i.qty, 0);
  const cgstTotal = totalTax / 2, sgstTotal = totalTax / 2;

  const isIgst = Boolean(customer?.state && sellerInfo?.state && customer.state.trim().toLowerCase() !== sellerInfo.state.trim().toLowerCase());
  const calcGst = {
    cgst: isIgst ? 0 : totalTax / 2,
    sgst: isIgst ? 0 : totalTax / 2,
    igst: isIgst ? totalTax : 0
  };

  const hsnMap: Record<string, { taxable: number; cgst: number; sgst: number; igst: number; tax: number; pct: number }> = {};
  itemRows.forEach((i: any) => {
    if (!hsnMap[i.hsn]) hsnMap[i.hsn] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, pct: i.gstPct };
    hsnMap[i.hsn].taxable += i.taxable; hsnMap[i.hsn].tax += i.gstAmt;
    if (isIgst) hsnMap[i.hsn].igst += i.gstAmt;
    else { hsnMap[i.hsn].cgst += i.gstAmt / 2; hsnMap[i.hsn].sgst += i.gstAmt / 2; }
  });
  const hsnEntries = Object.entries(hsnMap);

  const rawUpi = (invoice?.upi_id || sellerInfo?.upi_id || sellerInfo?.upiId || '').trim();
  const upiId = rawUpi.replace(/\s+/g, '');
  const bizNameForUpi = (sellerInfo?.business_name || 'Store').trim();
  const amountForUpi = Number(grandTotal || 0) > 0 ? Number(grandTotal).toFixed(2) : '1.00';
  const calculatedInvNo = invoice?.invoice_number || `INV-${invoice?.id ? invoice.id.slice(0, 6).toUpperCase() : '001'}`;

  let upiUrl: string | null = null;
  if (upiId) {
    if (upiId.startsWith('upi://')) {
      upiUrl = upiId;
    } else {
      upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(bizNameForUpi)}&am=${amountForUpi}&cu=INR&tn=${encodeURIComponent('Invoice ' + calculatedInvNo)}`;
    }
  }

  // Smart Adaptive Chunking:
  const itemPages: any[][] = [];
  if (itemRows.length === 0) {
    itemPages.push([]);
  } else {
    if (isA5) {
      if (itemRows.length <= 5) {
        itemPages.push(itemRows);
      } else {
        itemPages.push(itemRows.slice(0, 7));
        for (let i = 7; i < itemRows.length; i += 4) {
          itemPages.push(itemRows.slice(i, i + 4));
        }
      }
    } else {
      if (itemRows.length <= 12) {
        itemPages.push(itemRows);
      } else {
        itemPages.push(itemRows.slice(0, 14));
        for (let i = 14; i < itemRows.length; i += 7) {
          itemPages.push(itemRows.slice(i, i + 7));
        }
      }
    }
  }
  const totalPages = itemPages.length;

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || downloading) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const pageElements = invoiceRef.current.querySelectorAll('.invoice-page-sheet');
      if (!pageElements || pageElements.length === 0) {
        throw new Error("No page elements found");
      }

      const pdfOrientation = isA5 ? 'landscape' : 'portrait';
      const pdfFormat = isPOS ? [76.2, 180] : (isA5 ? 'a5' : 'a4');
      const pdf = new jsPDF({
        unit: 'mm',
        format: pdfFormat,
        orientation: pdfOrientation,
        compress: true
      });

      for (let i = 0; i < pageElements.length; i++) {
        const el = pageElements[i] as HTMLElement;
        const rect = el.getBoundingClientRect();
        const elWidthPx = rect.width || el.offsetWidth || 320;
        const elHeightPx = rect.height || el.offsetHeight || 600;
        const aspectRatio = elHeightPx / elWidthPx;

        // For POS, roll width is 80mm (tpl 04/14) or 58mm (tpl 05/15), height is dynamically computed to fit all items perfectly
        const pdfWidth = isPOS ? ((tpl === 'template_04' || tpl === 'template_14') ? 80 : 58) : (isA5 ? 210 : 210);
        const pdfHeight = isPOS ? Math.max(pdfWidth * aspectRatio, 100) : (isA5 ? 148 : 297);

        const currentFormat: [number, number] | string = isPOS ? [pdfWidth, pdfHeight] : (isA5 ? 'a5' : 'a4');
        const currentOrientation = isPOS ? 'portrait' : (isA5 ? 'landscape' : 'portrait');

        if (i === 0) {
          // Re-initialize or adjust first page
        }

        const dataUrl = await toPng(el, {
          quality: 1,
          pixelRatio: 3, // High-DPI crystal clear render
          backgroundColor: '#ffffff',
          fontEmbedCSS: '',
          skipFonts: true
        });

        if (i > 0) {
          pdf.addPage(currentFormat, currentOrientation);
        } else if (isPOS) {
          // Delete default first page and add correctly sized dynamic roll page
          pdf.deletePage(1);
          pdf.addPage(currentFormat, currentOrientation);
        }

        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      pdf.save(`Invoice_${invoice?.invoice_number || invoice?.id?.slice(0, 8) || 'doc'}.pdf`);
    } catch (e) {
      console.error("PDF generation fallback:", e);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const invNum = invoice?.invoice_number || invoice?.id?.slice(0, 8)?.toUpperCase();
    const custName = customer?.name || invoice?.customer_name || 'Customer';
    const shareText = `Dear ${custName}, here is your invoice #${invNum} of ${fc(grandTotal, cur)} from ${sellerInfo?.business_name || 'our store'}. Thank you for your business!`;

    // 1. Prepare WhatsApp links & show modal immediately
    const rawPhone = customer?.phone || invoice?.customer_phone || '';
    const cp = normalizePhoneNumber(rawPhone);
    const enc = encodeURIComponent(shareText);
    setWhatsAppUrlState(`https://wa.me/${cp}?text=${enc}`);
    setWhatsAppWebUrlState(`https://web.whatsapp.com/send?phone=${cp}&text=${enc}`);
    setWhatsAppAppUrlState(`whatsapp://send?phone=${cp}&text=${enc}`);
    setShowWhatsAppModal(true);

    // 2. Auto copy rendered Invoice image to Clipboard
    try {
      const { toBlob } = await import('html-to-image');
      const firstPage = invoiceRef.current?.querySelector('.invoice-page-sheet') as HTMLElement;
      if (firstPage && typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
        const blob = await toBlob(firstPage, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true });
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ]);
          setCopiedToClipboard(true);
        }
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopiedToClipboard(true);
      }
    } catch (clipErr) {
      console.warn('Clipboard image write:', clipErr);
      try {
        await navigator.clipboard.writeText(shareText);
        setCopiedToClipboard(true);
      } catch (_) {}
    }

    // 3. Auto download PDF in background
    try {
      await handleDownloadPdf();
    } catch (_) {}
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center gap-3"><Loader2 className="w-8 h-8 text-green-600 animate-spin" /><span className="text-sm font-semibold text-slate-600">Loading invoice…</span></div>;
  if (!invoice) return <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-white p-8 rounded-2xl shadow text-center max-w-sm w-full"><p className="font-bold text-slate-800 mb-4">Invoice Not Found</p><button onClick={() => navigate('/invoices')} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs">Back to Invoices</button></div></div>;

  const invNo = calculatedInvNo;
  const isPaid = invoice.status === 'paid';
  const co = {
    name: sellerInfo?.business_name || '', 
    address: sellerInfo?.address || '',
    gstin: sellerInfo?.gstin || '', 
    phone: sellerInfo?.phone || '',
    email: sellerInfo?.email || '', 
    pan: sellerInfo?.pan || '',
    logo: sellerInfo?.logo_url || '', 
    bank: sellerInfo?.bank_name || '',
    branch: sellerInfo?.bank_branch || '', 
    acc: sellerInfo?.account_number || '',
    ifsc: sellerInfo?.ifsc_code || '', 
    upi: upiId || '',
    sign: sellerInfo?.signature_url || '', 
    forCo: `For ${sellerInfo?.business_name || 'Company'}`,
    instagram: (sellerInfo?.instagram || '').trim(),
    facebook: (sellerInfo?.facebook || '').trim(),
    website: (sellerInfo?.website || '').trim(),
    social_qr_url: (sellerInfo?.social_qr_url || '').trim(),
    social_qr_label: (sellerInfo?.social_qr_label || '').trim(),
  };
  const bu = {
    name: customer?.name || invoice.customer_name || '',
    address: customer?.address || '', phone: customer?.phone || '',
    gstin: customer?.gst_number || '', pan: customer?.pan || '',
    state: customer?.state || '', placeOfSupply: customer?.place_of_supply || customer?.state || '',
    country: 'India',
  };
  const sh = bu;
  const im = {
    invoiceNo: invNo, invoiceDate: fmtDate(invoice.date), dueDate: fmtDate(invoice.due_date),
    poNo: invoice.po_number || '', poDate: fmtDate(invoice.po_date), eWayNo: invoice.e_way_bill || '',
  };

  const hasUpi = Boolean(showSec.upi_qr && upiUrl);
  const hasSocialQr = Boolean(co.social_qr_url);

  const QRNode = (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {hasUpi ? (
        <QRCodeSVG value={upiUrl!} size={isA5 ? 54 : 76} level="M" />
      ) : hasSocialQr ? (
        <img 
          src={co.social_qr_url} 
          alt="QR Code" 
          style={{ width: isA5 ? 54 : 76, height: isA5 ? 54 : 76, objectFit: 'contain' }} 
        />
      ) : (
        <div style={{ 
          width: isA5 ? 54 : 76, 
          height: isA5 ? 54 : 76, 
          border: '1px dashed #cbd5e1', 
          borderRadius: 4, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: 2, 
          textAlign: 'center',
          background: '#f8fafc' 
        }}>
          <span style={{ fontSize: isA5 ? 7 : 8.5, color: '#94a3b8', fontWeight: 'bold', lineHeight: 1.2 }}>
            UPI QR
          </span>
          <span style={{ fontSize: isA5 ? 6 : 7, color: '#94a3b8', marginTop: 2 }}>
            Set UPI in Settings
          </span>
        </div>
      )}
    </div>
  );

  const renderSocialStrip = (borderColor: string, bg: string = '#f8fafc') => {
    const hasSocials = Boolean(co.instagram || co.facebook || co.website || (hasUpi && co.social_qr_url));
    if (!hasSocials) return null;

    return (
      <div style={{ 
        border: `1px solid ${borderColor}`, 
        borderTop: 'none', 
        background: bg, 
        padding: isA5 ? '2.5px 6px' : '4px 8px', 
        fontSize: isA5 ? 7.5 : 9.5, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: 6 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isA5 ? 8 : 12, flexWrap: 'wrap' }}>
          {co.instagram && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontWeight: 'bold', color: '#be185d' }}>Instagram:</span>
              <span>{co.instagram.startsWith('@') ? co.instagram : `@${co.instagram}`}</span>
            </span>
          )}
          {co.facebook && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontWeight: 'bold', color: '#1d4ed8' }}>Facebook:</span>
              <span>{co.facebook}</span>
            </span>
          )}
          {co.website && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontWeight: 'bold', color: '#047857' }}>Web:</span>
              <span>{co.website}</span>
            </span>
          )}
        </div>
        {co.social_qr_url && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <img src={co.social_qr_url} alt="Social QR" style={{ width: isA5 ? 22 : 30, height: isA5 ? 22 : 30, objectFit: 'contain' }} />
            {co.social_qr_label && <span style={{ fontSize: isA5 ? 6.5 : 7.5, color: '#475569', fontWeight: 600 }}>{co.social_qr_label}</span>}
          </div>
        )}
      </div>
    );
  };
  const termsText = (invoice.terms || sellerInfo?.default_terms || '').split('\n').filter(Boolean);
  const isQuotation = invoice?.bill_type === 'QUOTATION' || invoice?.bill_type === 'ESTIMATE' || invoice?.status === 'quotation';
  const defaultTitle = isQuotation 
    ? 'QUOTATION' 
    : (invoice?.bill_type === 'BILL OF SUPPLY' ? 'BILL OF SUPPLY' : (invoice?.bill_type === 'CASH BILL' ? 'CASH BILL' : 'TAX INVOICE'));
  const docTitle = invoice?.invoice_title || defaultTitle;
  const docSubtitle = invoice?.copy_subtitle !== undefined ? invoice.copy_subtitle : (isQuotation ? '' : 'ORIGINAL FOR RECIPIENT');

  // Dynamic column calculations
  const dynamicColCount = 1 + 1 + (colVis.size ? 1 : 0) + (colVis.hsn ? 1 : 0) + 1 + (colVis.mrp ? 1 : 0) + (colVis.discount ? 1 : 0) + (colVis.gstPercent ? 1 : 0) + 1;
  const leftColSpan = 1 + 1 + (colVis.size ? 1 : 0) + (colVis.hsn ? 1 : 0);

  // Helper to calculate starting index of page
  const getStartIndex = (pageIdx: number) => {
    let count = 0;
    for (let i = 0; i < pageIdx; i++) {
      count += itemPages[i].length;
    }
    return count;
  };

  // Template 01 (and default) Page Renderer
  const renderTemplate01Page = (pageItems: any[], pageIdx: number, isLastPage: boolean, startIndex: number) => {
    const blue='#2f6fb0', dark='#1c4a75', lb='#eaf2fb', b=`1px solid ${blue}`;
    return (
      <div className="flex flex-col h-full justify-between" style={{ minHeight: useLetterhead ? 'auto' : (isA5 ? '138mm' : '281mm'), height: useLetterhead ? '100%' : undefined, maxHeight: useLetterhead ? '100%' : undefined, boxSizing: 'border-box', fontFamily:'Arial,Helvetica,sans-serif', fontSize: isA5 ? 9 : 12, color:'#1a1a1a' }}>
        <div style={{ flex: useLetterhead ? 'none' : 1, display: 'flex', flexDirection: 'column' }}>
          {(!useLetterhead || !letterheadHideHeader) ? (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom: isA5 ? 2 : 6}}>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                {co.logo&&<img src={co.logo} alt="logo" style={{width: isA5 ? 32 : 52, height: isA5 ? 32 : 52, objectFit:'contain'}}/>}
                <div><p style={{fontSize: isA5 ? 13 : 19,fontWeight:'bold',color:dark,margin:'0 0 1px'}}>{co.name}</p>
                  {showSec.seller_address && <div style={{fontSize: isA5 ? 8.5 : 11, lineHeight:1.2}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/>}
                </div>
              </div>
              <div style={{textAlign:'right',fontSize: isA5 ? 8.5 : 11}}>
                <div><b>Name</b> : {bu.name}</div>
                <div><b>Phone</b> : {bu.phone}</div>
                <div style={{fontSize: 8.5, color: '#666', marginTop: 1}}>Page {pageIdx + 1} of {totalPages}</div>
              </div>
            </div>
          ) : (
            <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',marginBottom: isA5 ? 2 : 4}}>
              <div style={{fontSize: 8.5, color: '#666'}}>Page {pageIdx + 1} of {totalPages}</div>
            </div>
          )}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:b,borderBottom:'none',padding:'2px 6px',fontWeight:'bold',fontSize: isA5 ? 9 : 11.5}}>
            <div>GSTIN : {co.gstin}</div><div style={{fontSize: isA5 ? 10.5 : 13, color:dark, textTransform:'uppercase'}}>{docTitle}</div><div>{docSubtitle}</div>
          </div>

          {/* Clean 2-column Buyer & Meta Grid */}
          <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',border:b,fontSize: isA5 ? 8.5 : 10.5}}>
            <div style={{padding:'2px 6px',borderRight:b}}>
              <div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-2px -6px 2px',padding:1,borderBottom:b}}>Details of Buyer | Billed to :</div>
              {[
                ['Name',bu.name],
                ['Address',bu.address],
                ['Phone',bu.phone],
                showSec.customer_gstin ? ['GSTIN',bu.gstin] : null,
                ['PAN',bu.pan],
                ['Place of Supply',bu.placeOfSupply]
              ].filter(Boolean).map(([l,v]: any)=>(<div key={l} style={{display:'flex',marginBottom:0.5}}><div style={{width: isA5 ? 70 : 90,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{v}</div></div>))}
            </div>
            <div style={{padding:'2px 6px'}}>
              <div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-2px -6px 2px',padding:1,borderBottom:b}}>{isQuotation ? 'Quotation Details :' : 'Invoice Details :'}</div>
              {[[isQuotation ? 'Quotation No.' : 'Invoice No.',im.invoiceNo],[isQuotation ? 'Quote Date' : 'Invoice Date',im.invoiceDate],['Due Date',im.dueDate],['P.O. No.',im.poNo],['P.O. Date',im.poDate],['E-Way No.',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:0.5}}><div style={{width: isA5 ? 65 : 80,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1}}>{v}</div></div>))}
            </div>
          </div>

          {/* Dynamic Items Table - Clean uninterrupted vertical lines without row dividers */}
          <table style={{width:'100%',flex: useLetterhead ? 'none' : 1,borderCollapse:'collapse',borderLeft:b,borderRight:b,borderBottom:b,fontSize: isA5 ? 8.5 : 10.5}}>
            <thead>
              <tr>
                <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5, width: 30}}>Sr. No.</th>
                <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>Name of Product / Service</th>
                {colVis.size && <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>Size</th>}
                {colVis.hsn && <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>HSN / SAC</th>}
                <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>Qty</th>
                {colVis.mrp && <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>MRP</th>}
                <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>Rate</th>
                {colVis.discount && <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>Disc%</th>}
                {colVis.gstPercent && <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>GST%</th>}
                <th style={{background:lb,borderLeft:b,borderRight:b,borderBottom:b,padding: isA5 ? '2px 3px' : '4px 6px',fontSize: isA5 ? 8.5 : 10.5}}>Taxable Value</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((it:any,idx:number)=>(
                <tr key={idx}>
                  <td style={{textAlign:'center',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{startIndex + idx + 1}</td>
                  <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>
                    <div style={{fontWeight:'bold'}}>{it.name}</div>
                    {(it.subLines||[]).map((sl:string,si:number)=>(
                      <div key={si} style={{display:'block',fontSize: isA5 ? 7.5 : 9.5,color:'#333',marginTop:1,width:'fit-content'}}>
                        {sl}
                      </div>
                    ))}
                  </td>
                  {colVis.size && <td style={{textAlign:'center',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{it.size || '---'}</td>}
                  {colVis.hsn && <td style={{textAlign:'center',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{it.hsn}</td>}
                  <td style={{textAlign:'center',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{it.qty}</td>
                  {colVis.mrp && <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{it.mrp ? fc(it.mrp,cur) : '---'}</td>}
                  <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{fc(it.price,cur)}</td>
                  {colVis.discount && <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{it.disc ? `${it.disc}%` : '0%'}</td>}
                  {colVis.gstPercent && <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{it.gstPct ? `${it.gstPct}%` : '0%'}</td>}
                  <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>{fc(it.taxable,cur)}</td>
                </tr>
              ))}
              {/* Spacer row to let vertical column lines extend continuously only when not using letterhead */}
              {!useLetterhead && (
                <tr>
                  <td style={{borderLeft:b,borderRight:b,height:'100%'}}></td>
                  <td style={{borderLeft:b,borderRight:b}}></td>
                  {colVis.size && <td style={{borderLeft:b,borderRight:b}}></td>}
                  {colVis.hsn && <td style={{borderLeft:b,borderRight:b}}></td>}
                  <td style={{borderLeft:b,borderRight:b}}></td>
                  {colVis.mrp && <td style={{borderLeft:b,borderRight:b}}></td>}
                  <td style={{borderLeft:b,borderRight:b}}></td>
                  {colVis.discount && <td style={{borderLeft:b,borderRight:b}}></td>}
                  {colVis.gstPercent && <td style={{borderLeft:b,borderRight:b}}></td>}
                  <td style={{borderLeft:b,borderRight:b}}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Structured Bottom Section - Total / CGST / SGST exactly on top of Total in Words */}
        {isLastPage ? (
          <div style={{ marginTop: useLetterhead ? 'auto' : 0, paddingTop: useLetterhead ? 8 : 0 }}>
            <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize: isA5 ? 8.5 : 10.5}}>
              <tbody>
                {isIgst ? (
                  <tr>
                    <td colSpan={leftColSpan} style={{padding: isA5 ? '2px 3px' : '3px 6px',borderRight:b}}></td>
                    <td colSpan={dynamicColCount - leftColSpan - 1} style={{textAlign:'right',padding: isA5 ? '2px 3px' : '3px 6px',borderRight:b}}><b>IGST Tax Total</b></td>
                    <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '3px 6px'}}><b>{fc(totalTax,cur)}</b></td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={leftColSpan} style={{padding: isA5 ? '2px 3px' : '2px 6px',borderRight:b}}></td>
                      <td colSpan={dynamicColCount - leftColSpan - 1} style={{textAlign:'right',padding: isA5 ? '2px 3px' : '2px 6px',borderRight:b}}><b>CGST Tax ({hsnEntries[0]?.[1]?.pct ? hsnEntries[0][1].pct / 2 : 0}%)</b></td>
                      <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '2px 6px'}}><b>{fc(cgstTotal,cur)}</b></td>
                    </tr>
                    <tr>
                      <td colSpan={leftColSpan} style={{padding: isA5 ? '2px 3px' : '2px 6px',borderRight:b}}></td>
                      <td colSpan={dynamicColCount - leftColSpan - 1} style={{textAlign:'right',padding: isA5 ? '2px 3px' : '2px 6px',borderRight:b}}><b>SGST Tax ({hsnEntries[0]?.[1]?.pct ? hsnEntries[0][1].pct / 2 : 0}%)</b></td>
                      <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '2px 6px'}}><b>{fc(sgstTotal,cur)}</b></td>
                    </tr>
                  </>
                )}
                <tr style={{fontWeight:'bold',background:lb,borderTop:b}}>
                  <td colSpan={leftColSpan} style={{padding: isA5 ? '2px 3px' : '3px 6px',borderRight:b}}></td>
                  <td style={{textAlign:'center',padding: isA5 ? '2px 3px' : '3px 6px',borderRight:b}}>{qtyTotal}</td>
                  <td colSpan={dynamicColCount - leftColSpan - 2} style={{textAlign:'right',padding: isA5 ? '2px 3px' : '3px 6px',borderRight:b}}>Total</td>
                  <td style={{textAlign:'right',padding: isA5 ? '2px 3px' : '3px 6px'}}>₹ {fc(grandTotal,cur)}</td>
                </tr>
              </tbody>
            </table>

            {showSec.amount_in_words && (
              <div style={{border:b,borderTop:'none',padding:'3px 6px',fontSize: isA5 ? 8.5 : 10.5}}>
                <span style={{fontWeight:'bold'}}>Total in words: </span>
                <span style={{fontWeight:'bold',textTransform:'uppercase', wordBreak:'break-word'}}>{safeToWords(grandTotal,cur)}</span>
              </div>
            )}
            
            {showSec.hsn_summary && (
              <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize: isA5 ? 8 : 10}}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{border:b,padding:1.5,background:lb,textAlign:'center'}}>HSN / SAC</th>
                    <th rowSpan={2} style={{border:b,padding:1.5,background:lb,textAlign:'center'}}>Taxable Value</th>
                    <th colSpan={2} style={{border:b,padding:1.5,background:lb,textAlign:'center'}}>CGST</th>
                    <th colSpan={2} style={{border:b,padding:1.5,background:lb,textAlign:'center'}}>SGST</th>
                    <th rowSpan={2} style={{border:b,padding:1.5,background:lb,textAlign:'center'}}>Total Tax</th>
                  </tr>
                  <tr>
                    <th style={{border:b,padding:1,background:lb}}>%</th>
                    <th style={{border:b,padding:1,background:lb}}>Amount</th>
                    <th style={{border:b,padding:1,background:lb}}>%</th>
                    <th style={{border:b,padding:1,background:lb}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnEntries.map(([hsn,d])=>(
                    <tr key={hsn}>
                      <td style={{border:b,padding:1.5}}>{hsn}</td>
                      <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(d.taxable,cur)}</td>
                      <td style={{border:b,padding:1.5,textAlign:'right'}}>{isIgst ? '0%' : `${d.pct / 2}%`}</td>
                      <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(isIgst ? 0 : d.cgst, cur)}</td>
                      <td style={{border:b,padding:1.5,textAlign:'right'}}>{isIgst ? '0%' : `${d.pct / 2}%`}</td>
                      <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(isIgst ? 0 : d.sgst, cur)}</td>
                      <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(d.tax,cur)}</td>
                    </tr>
                  ))}
                  <tr style={{fontWeight:'bold',background:lb}}>
                    <td style={{border:b,padding:1.5}}>Total</td>
                    <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(totalTaxable,cur)}</td>
                    <td style={{border:b,padding:1.5}}></td>
                    <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(isIgst ? 0 : cgstTotal, cur)}</td>
                    <td style={{border:b,padding:1.5}}></td>
                    <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(isIgst ? 0 : sgstTotal, cur)}</td>
                    <td style={{border:b,padding:1.5,textAlign:'right'}}>{fc(totalTax,cur)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {(showSec.bank_details || showSec.upi_qr || showSec.signature || showSec.declaration) && (
              <div style={{display:'grid',gridTemplateColumns:(showSec.bank_details || showSec.upi_qr) ? ((showSec.signature || showSec.declaration) ? '2fr 1fr' : '1fr') : '1fr',border:b,borderTop:'none',fontSize: isA5 ? 8.5 : 10}}>
                {(showSec.bank_details || showSec.upi_qr) && (
                  <div style={{borderRight:(showSec.signature || showSec.declaration)?b:'none'}}>
                    <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:1,borderBottom:b}}>Bank Details</div>
                    <div style={{display:'flex'}}>
                      {showSec.bank_details && (
                        <div style={{padding:'2px 5px',flex:1}}>{[['Name',co.bank],['Branch',co.branch],['Acc. Number',co.acc],['IFSC',co.ifsc],['UPI ID',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:0.5}}><div style={{width: isA5 ? 55 : 70,fontWeight:'bold',flexShrink:0}}>{l}</div><div>{v}</div></div>))}</div>
                      )}
                      {showSec.upi_qr && (
                        <div style={{width: isA5 ? 65 : 90,padding:2,textAlign:'center',borderLeft:showSec.bank_details?b:'none'}}>{QRNode}<div style={{fontSize:7.5,marginTop:0.5}}>Pay using UPI</div></div>
                      )}
                    </div>
                  </div>
                )}

                {(showSec.signature || showSec.declaration) && (
                  <div style={{padding:'2px 5px',textAlign:'center',fontSize: isA5 ? 8 : 10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                    {showSec.declaration && (
                      <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:1,borderBottom:b,margin:'-2px -5px 2px'}}>
                        {invoice?.declaration_text || sellerInfo?.declaration_text || 'Certified that particulars are true and correct.'}
                      </div>
                    )}
                    {showSec.signature && (
                      <>
                        <div style={{fontWeight:'bold',margin:'1px 0',textAlign:'center'}}>{co.forCo}</div>
                        <div style={{height: isA5 ? 24 : 38, display:'flex', alignItems:'center', justifyContent:'center'}}>
                          {co.sign && <img src={co.sign} alt="sig" style={{maxHeight: isA5 ? 24 : 38, maxWidth:'100%', objectFit:'contain'}}/>}
                        </div>
                        <div style={{fontWeight:'bold',marginTop:1,borderTop:'1px solid #ccc',paddingTop:1,textAlign:'center'}}>Authorised Signatory</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {showSec.terms && (
              <div style={{border:b,borderTop:'none',fontSize: isA5 ? 8 : 10}}>
                <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:1,borderBottom:b}}>Terms and Conditions</div>
                <div style={{padding:'1.5px 5px'}}>{termsText.slice(0, 2).map((t:string,i:number)=><div key={i}>{t}</div>)}</div>
              </div>
            )}

            {renderSocialStrip(blue, lb)}

            {showSec.footer && (invoice.notes || sellerInfo?.footer_notes) && (
              <div style={{border:b,borderTop:'none',fontSize: isA5 ? 8 : 9.5,padding:'2px 5px',textAlign:'center',background:lb}}>
                {invoice.notes || sellerInfo?.footer_notes}
              </div>
            )}
          </div>
        ) : (
          <div style={{textAlign:'right',fontSize:9.5,fontWeight:'bold',padding:3,color:dark,border:b,background:lb,marginTop:'auto'}}>
            Continued on Next Page →
          </div>
        )}
      </div>
    );
  };

  // Template 03 Page Renderer
  const renderTemplate03Page = (pageItems: any[], pageIdx: number, isLastPage: boolean, startIndex: number) => {
    const blue='#1a73c7', lb='#e9f2fb', b=`1px solid ${blue}`;
    return (
      <div className="flex flex-col h-full justify-between" style={{ minHeight: useLetterhead ? 'auto' : (isA5 ? '138mm' : '281mm'), height: useLetterhead ? '100%' : undefined, maxHeight: useLetterhead ? '100%' : undefined, boxSizing: 'border-box', fontFamily:'Arial,Helvetica,sans-serif', fontSize: isA5 ? 9 : 12 }}>
        <div style={{ flex: useLetterhead ? 'none' : 1, display: 'flex', flexDirection: 'column' }}>
          {(!useLetterhead || !letterheadHideHeader) ? (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:`2px solid ${blue}`,paddingBottom:3,marginBottom:3}}>
              <div><div style={{fontSize: isA5 ? 13 : 19,fontWeight:'bold',color:blue, textTransform:'uppercase'}}>{docTitle}</div><div style={{fontSize: isA5 ? 11.5 : 16,fontWeight:'bold',margin:'1px 0'}}>{co.name}</div><div><b>GSTIN</b> {co.gstin}</div>{showSec.seller_address && <div style={{fontSize: isA5 ? 8.5 : 11,lineHeight:1.2}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/>}{co.phone&&<div><b>Phone:</b> {co.phone}</div>}</div>
              <div style={{textAlign:'right'}}><div style={{fontSize:8.5,fontWeight:'bold'}}>{docSubtitle}</div>{co.logo&&<img src={co.logo} alt="logo" style={{width: isA5 ? 32 : 52,height: isA5 ? 32 : 52}}/>}<div style={{fontSize:8.5,color:'#666',marginTop:1}}>Page {pageIdx + 1} of {totalPages}</div></div>
            </div>
          ) : (
            <div style={{display:'flex',justifyContent:'flex-end',paddingBottom:2,marginBottom:2}}>
              <div style={{fontSize:8.5,color:'#666'}}>Page {pageIdx + 1} of {totalPages}</div>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.2fr 1fr',gap:5,borderBottom:`2px solid ${blue}`,paddingBottom:3,marginBottom:3,fontSize: isA5 ? 8.5 : 10.5}}>
            <div><b style={{display:'block',marginBottom:0.5}}>Customer Details:</b><div style={{fontWeight:'bold'}}>{bu.name}</div><div>{bu.address}</div>{showSec.customer_gstin && <div><b>GSTIN:</b> {bu.gstin}</div>}<div><b>State:</b> {bu.state}</div></div>
            <div><b style={{display:'block',marginBottom:0.5}}>Shipping address:</b><div style={{fontWeight:'bold'}}>{sh.name}</div><div>{sh.address}</div><div><b>State:</b> {sh.state}</div></div>
            <div>{[[isQuotation ? 'Quote #:' : 'Invoice #:',im.invoiceNo],[isQuotation ? 'Quote Date:' : 'Invoice Date:',im.invoiceDate],['P.O. No.:',im.poNo],['E-Way No.:',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:0.5}}><div style={{fontWeight:'bold',width: isA5 ? 55 : 70}}>{l}</div><b>{v}</b></div>))}</div>
          </div>
          <table style={{width:'100%',flex: useLetterhead ? 'none' : 1,borderCollapse:'collapse',borderLeft:b,borderRight:b,borderBottom:b,fontSize: isA5 ? 8.5 : 10.5}}>
            <thead>
              <tr>
                <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left', width: 30}}>Sr.No.</th>
                <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>Name of Product / Service</th>
                {colVis.size && <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>Size</th>}
                {colVis.hsn && <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>HSN/SAC</th>}
                <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>Qty</th>
                {colVis.mrp && <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>MRP</th>}
                <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>Rate</th>
                {colVis.discount && <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>Disc%</th>}
                {colVis.gstPercent && <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>GST%</th>}
                <th style={{background:blue,color:'#fff',padding: isA5 ? '2px 3px' : '4px 6px',textAlign:'left'}}>Taxable Value</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((it:any,i:number)=>(
                <tr key={i}>
                  <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'center',verticalAlign:'top'}}>{startIndex + i + 1}</td>
                  <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,verticalAlign:'top'}}>
                    <div style={{fontWeight:'bold'}}>{it.name}</div>
                    {(it.subLines||[]).map((sl:string,si:number)=>(
                      <div key={si} style={{display:'block',fontSize: isA5 ? 7.5 : 9.5,color:'#333',marginTop:1,width:'fit-content'}}>
                        {sl}
                      </div>
                    ))}
                  </td>
                  {colVis.size && <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'center',verticalAlign:'top'}}>{it.size || '---'}</td>}
                  {colVis.hsn && <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'center',verticalAlign:'top'}}>{it.hsn}</td>}
                  <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'center',verticalAlign:'top'}}>{it.qty}</td>
                  {colVis.mrp && <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'right',verticalAlign:'top'}}>{it.mrp ? fc(it.mrp,cur) : '---'}</td>}
                  <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'right',verticalAlign:'top'}}>{fc(it.price,cur)}</td>
                  {colVis.discount && <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'right',verticalAlign:'top'}}>{it.disc ? `${it.disc}%` : '0%'}</td>}
                  {colVis.gstPercent && <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'right',verticalAlign:'top'}}>{it.gstPct ? `${it.gstPct}%` : '0%'}</td>}
                  <td style={{padding: isA5 ? '2px 3px' : '4px 6px',borderLeft:b,borderRight:b,textAlign:'right',verticalAlign:'top'}}>{fc(it.taxable,cur)}</td>
                </tr>
              ))}
              {/* Spacer row only when not using letterhead */}
              {!useLetterhead && (
                <tr>
                  <td style={{borderLeft:b,borderRight:b,height:'100%'}}></td>
                  <td style={{borderLeft:b,borderRight:b}}></td>
                  {colVis.size && <td style={{borderLeft:b,borderRight:b}}></td>}
                  {colVis.hsn && <td style={{borderLeft:b,borderRight:b}}></td>}
                  <td style={{borderLeft:b,borderRight:b}}></td>
                  {colVis.mrp && <td style={{borderLeft:b,borderRight:b}}></td>}
                  <td style={{borderLeft:b,borderRight:b}}></td>
                  {colVis.discount && <td style={{borderLeft:b,borderRight:b}}></td>}
                  {colVis.gstPercent && <td style={{borderLeft:b,borderRight:b}}></td>}
                  <td style={{borderLeft:b,borderRight:b}}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isLastPage ? (
          <div style={{ marginTop: 'auto' }}>
            <div style={{display:'flex',justifyContent:'flex-end',gap:20,padding:'1.5px 0',fontWeight:'bold',fontSize: isA5 ? 8.5 : 11}}><span>Taxable Amount</span><b>{fc(totalTaxable,cur)}</b></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:20,padding:'1.5px 0',fontWeight:'bold',fontSize: isA5 ? 9.5 : 12}}><span>Total Amount</span><b>₹ {fc(grandTotal,cur)}</b></div>
            {showSec.amount_in_words && (
              <div style={{fontSize: isA5 ? 8 : 10.5,margin:'2px 0'}}>
                <b>Total in words:</b> {safeToWords(grandTotal,cur)}.
              </div>
            )}
            {showSec.hsn_summary && (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize: isA5 ? 8 : 10,marginTop:1}}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{border:'1px solid #ccc',padding:1,background:lb}}>HSN/SAC</th>
                    <th rowSpan={2} style={{border:'1px solid #ccc',padding:1,background:lb}}>Taxable Value</th>
                    <th colSpan={2} style={{border:'1px solid #ccc',padding:1,background:lb}}>CGST</th>
                    <th colSpan={2} style={{border:'1px solid #ccc',padding:1,background:lb}}>SGST</th>
                    <th rowSpan={2} style={{border:'1px solid #ccc',padding:1,background:lb}}>Total Tax</th>
                  </tr>
                  <tr>
                    <th style={{border:'1px solid #ccc',padding:1,background:lb}}>%</th>
                    <th style={{border:'1px solid #ccc',padding:1,background:lb}}>Amount</th>
                    <th style={{border:'1px solid #ccc',padding:1,background:lb}}>%</th>
                    <th style={{border:'1px solid #ccc',padding:1,background:lb}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnEntries.map(([hsn,d])=>(
                    <tr key={hsn}>
                      <td style={{border:'1px solid #ccc',padding:1}}>{hsn}</td>
                      <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(d.taxable,cur)}</td>
                      <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{isIgst ? '0%' : `${d.pct / 2}%`}</td>
                      <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(isIgst ? 0 : d.cgst, cur)}</td>
                      <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{isIgst ? '0%' : `${d.pct / 2}%`}</td>
                      <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(isIgst ? 0 : d.sgst, cur)}</td>
                      <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(d.tax,cur)}</td>
                    </tr>
                  ))}
                  <tr style={{fontWeight:'bold'}}>
                    <td style={{border:'1px solid #ccc',padding:1}}>Total</td>
                    <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(totalTaxable,cur)}</td>
                    <td style={{border:'1px solid #ccc',padding:1}}></td>
                    <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(isIgst ? 0 : cgstTotal, cur)}</td>
                    <td style={{border:'1px solid #ccc',padding:1}}></td>
                    <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(isIgst ? 0 : sgstTotal, cur)}</td>
                    <td style={{border:'1px solid #ccc',padding:1,textAlign:'right'}}>{fc(totalTax,cur)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            
            {(showSec.upi_qr || showSec.bank_details || showSec.signature) && (
              <div style={{display:'grid',gridTemplateColumns:showSec.upi_qr?'1fr 1.4fr 1fr':'1.4fr 1fr',gap:5,marginTop:3,fontSize: isA5 ? 8 : 10,alignItems:'start'}}>
                {showSec.upi_qr && <div><b>Pay using UPI:</b><br/>{QRNode}</div>}
                {showSec.bank_details && <div><b>Bank Details:</b>{[['Name:',co.bank],['Branch:',co.branch],['Acc. Number:',co.acc],['IFSC:',co.ifsc],['UPI ID:',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:0.5}}><div style={{width:48,fontWeight:'bold'}}>{l}</div>{v}</div>))}</div>}
                {showSec.signature && <div style={{textAlign:'center'}}><b>{co.forCo}</b><br/>{co.sign?<img src={co.sign} alt="sig" style={{width:38,opacity:0.7}}/>:<div style={{height:24}}/>}<div>Authorised Signatory</div></div>}
              </div>
            )}
            
            {showSec.terms && (
              <div style={{marginTop:2,fontSize: isA5 ? 7.5 : 9.5}}><b>Terms &amp; Condition:</b> {termsText.slice(0, 2).join('. ')}</div>
            )}

            {showSec.declaration && (
              <div style={{marginTop:2,fontSize: isA5 ? 7.5 : 9.5, fontStyle: 'italic', color: '#475569'}}>
                <b>Declaration:</b> {invoice?.declaration_text || sellerInfo?.declaration_text || 'Certified that particulars are true and correct.'}
              </div>
            )}

            {renderSocialStrip(blue, '#ffffff')}

            {showSec.footer && (invoice.notes || sellerInfo?.footer_notes) && (
              <div style={{borderTop:`1px solid ${blue}`, fontSize: isA5 ? 7.5 : 9.5, padding:'2px 4px', textAlign:'center', marginTop: 3, color: '#334155'}}>
                {invoice.notes || sellerInfo?.footer_notes}
              </div>
            )}
          </div>
        ) : (
          <div style={{textAlign:'right',fontSize:9,fontWeight:'bold',padding:3,color:blue,borderTop:`1px solid ${blue}`,marginTop:'auto'}}>
            Continued on Next Page →
          </div>
        )}
      </div>
    );
  };

  // ── POS Thermal Receipt (2-inch / 58mm = T15, 3-inch / 80mm = T14)
  const renderPOS = (is3Inch = true) => {
    // 3-inch roll (80mm total width)
    // 2-inch roll (58mm total width)
    const containerWidth = is3Inch ? '80mm' : '58mm';
    const baseFontSize = is3Inch ? '11px' : '9px';
    const headerTitleSize = is3Inch ? '13px' : '11px';
    const docTitleSize = is3Inch ? '11.5px' : '9.5px';
    const subItalicSize = is3Inch ? '9.5px' : '8px';
    const grandTotalSize = is3Inch ? '12.5px' : '10.5px';
    const qrSize = is3Inch ? 100 : 70;

    const invoiceTitle = docTitle;
    const subtotal = itemRows.reduce((a: number, i: any) => a + (i.qty * i.price), 0);
    const globalDiscount = Number(invoice?.discount) || 0;
    const shippingCharges = Number(invoice?.shipping_charges) || 0;

    return (
      <div 
        className="invoice-page-sheet pos-thermal-receipt" 
        style={{
          fontFamily: `'Roboto Mono', 'Courier New', Consolas, Monaco, monospace`,
          fontWeight: 500,
          fontSize: baseFontSize,
          width: containerWidth,
          maxWidth: containerWidth,
          minWidth: containerWidth,
          margin: '1cm auto',
          border: '1px solid #111827',
          padding: '1cm',
          textAlign: 'center',
          background: '#ffffff',
          color: '#000000',
          lineHeight: '1.4',
          boxSizing: 'border-box',
          letterSpacing: '0.4px'
        }}
      >
        {/* 1. Header: Business Information (Centered Bold) */}
        <div style={{ fontWeight: 700, fontSize: headerTitleSize, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>
          {co.name || 'TAX INVOICE'}
        </div>
        {showSec.seller_address && co.address && (
          <div style={{ fontSize: baseFontSize, marginBottom: '1px' }}>
            {co.address}
          </div>
        )}
        {co.phone && (
          <div style={{ fontSize: baseFontSize }}>
            TEL: {co.phone}
          </div>
        )}
        {co.email && (
          <div style={{ fontSize: baseFontSize }}>
            EMAIL: {co.email}
          </div>
        )}
        {co.gstin && (
          <div style={{ fontSize: baseFontSize }}>
            GSTIN: {co.gstin}
          </div>
        )}

        {/* Dotted / Dashed Separator */}
        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        {/* 2. Document Title */}
        <div style={{ fontWeight: 700, fontSize: docTitleSize, letterSpacing: '0.6px', textTransform: 'uppercase', margin: '3px 0' }}>
          * {invoiceTitle} *
        </div>

        {/* Meta Grid (Key on left, Value on right in monospace) */}
        <div style={{ textAlign: 'left', marginTop: '6px', fontSize: baseFontSize }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontWeight: 700 }}>BILL TO:</span>
            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{bu.name || 'CASH SALE'}</span>
          </div>
          {bu.phone && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontWeight: 700 }}>MOBILE:</span>
              <span>{bu.phone}</span>
            </div>
          )}
          {showSec.customer_gstin && bu.gstin && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontWeight: 700 }}>GSTIN:</span>
              <span>{bu.gstin}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontWeight: 700 }}>INV NO:</span>
            <span>#{im.invoiceNo.replace(/^#/, '')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontWeight: 700 }}>DATE:</span>
            <span>{im.invoiceDate}</span>
          </div>
        </div>

        {/* Dotted / Dashed Separator */}
        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        {/* 3. Items Table Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: baseFontSize, marginBottom: '6px' }}>
          <span style={{ textAlign: 'left', flex: 1 }}>ITEM</span>
          <span style={{ textAlign: 'center', width: is3Inch ? '45px' : '35px' }}>QTY</span>
          <span style={{ textAlign: 'right', width: is3Inch ? '75px' : '55px' }}>AMT</span>
        </div>

        {/* Item Rows matching user image */}
        <div style={{ textAlign: 'left', fontSize: baseFontSize }}>
          {itemRows.map((it: any, i: number) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 700, flex: 1, paddingRight: '2px' }}>
                  {i + 1}. {it.name}
                </span>
                <span style={{ width: is3Inch ? '45px' : '35px', textAlign: 'center', fontWeight: 700 }}>
                  {it.qty}
                </span>
                <span style={{ width: is3Inch ? '75px' : '55px', textAlign: 'right', fontWeight: 700 }}>
                  ₹{Number(it.total || (it.qty * it.price)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {/* Secondary line: italic Qty x Rate */}
              <div style={{ fontStyle: 'italic', fontWeight: 400, fontSize: subItalicSize, color: '#444444', paddingLeft: '10px', marginTop: '1px' }}>
                {it.qty} x ₹{Number(it.price).toFixed(2)}
                {it.gstPct > 0 && ` (+${it.gstPct}% GST)`}
              </div>
              {(it.subLines || []).map((sl: string, si: number) => (
                <div key={si} style={{ fontStyle: 'italic', fontWeight: 400, fontSize: subItalicSize, color: '#666666', paddingLeft: '10px' }}>
                  {sl}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Dotted / Dashed Separator */}
        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        {/* 4. Subtotal & Totals Breakup */}
        <div style={{ textAlign: 'left', fontSize: baseFontSize }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontWeight: 700 }}>SUBTOTAL:</span>
            <span style={{ fontWeight: 700 }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {globalDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 700 }}>DISCOUNT:</span>
              <span style={{ fontWeight: 700 }}>-₹{globalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {totalTax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 700 }}>TAX (GST):</span>
              <span style={{ fontWeight: 700 }}>₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {shippingCharges > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 700 }}>SHIPPING:</span>
              <span style={{ fontWeight: 700 }}>₹{shippingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: grandTotalSize, marginTop: '4px' }}>
            <span>GRAND TOTAL:</span>
            <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Dotted / Dashed Separator */}
        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        {/* Bank Details for POS */}
        {showSec.bank_details && (co.bank || co.acc) && (
          <div style={{ textAlign: 'left', fontSize: subItalicSize, margin: '6px 0' }}>
            {co.bank && <div><span style={{ fontWeight: 700 }}>BANK:</span> {co.bank}</div>}
            {co.acc && <div><span style={{ fontWeight: 700 }}>A/C:</span> {co.acc}</div>}
            {co.ifsc && <div><span style={{ fontWeight: 700 }}>IFSC:</span> {co.ifsc}</div>}
            {co.branch && <div><span style={{ fontWeight: 700 }}>BRANCH:</span> {co.branch}</div>}
          </div>
        )}

        {/* 5. Scan to Pay with UPI */}
        {showSec.upi_qr && upiUrl && (
          <div style={{ margin: '8px 0 6px 0', textAlign: 'center' }}>
            <div style={{ fontSize: subItalicSize, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
              SCAN TO PAY WITH UPI
            </div>
            <div style={{ display: 'inline-block', padding: '3px', background: '#ffffff' }}>
              <QRCodeSVG value={upiUrl} size={qrSize} level="M" />
            </div>
            {upiId && (
              <div style={{ fontSize: subItalicSize, marginTop: '4px', wordBreak: 'break-all' }}>
                {upiId}
              </div>
            )}
          </div>
        )}

        {/* Dotted / Dashed Separator */}
        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        {/* Social Media Handles for POS */}
        {(co.instagram || co.facebook || co.website) && (
          <div style={{ fontSize: subItalicSize, textAlign: 'center', margin: '4px 0', lineHeight: 1.35 }}>
            {co.instagram && <div>IG: {co.instagram.startsWith('@') ? co.instagram : `@${co.instagram}`}</div>}
            {co.facebook && <div>FB: {co.facebook}</div>}
            {co.website && <div>Web: {co.website}</div>}
          </div>
        )}

        {/* 6. Footer: InvoCentric Branding & Visit Again */}
        <div style={{ marginTop: '6px', textAlign: 'center' }}>
          {showSec.footer && (invoice.notes || sellerInfo?.footer_notes) && (
            <div style={{ fontSize: subItalicSize, fontStyle: 'italic', margin: '4px 0', color: '#333333' }}>
              {invoice.notes || sellerInfo?.footer_notes}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: docTitleSize, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            *** THANK YOU! VISIT AGAIN ***
          </div>
          <div style={{ fontStyle: 'italic', fontWeight: 400, fontSize: subItalicSize, color: '#666666', marginTop: '3px' }}>
            powered by invocentric • instant compliant invoicing
          </div>
        </div>
      </div>
    );
  };

  // Template 16 (Supplier B2B Invoice with Dedicated Serial / Batch Column)
  const renderTemplate16Page = (pageItems: any[], pageIdx: number, isLastPage: boolean, startIndex: number) => {
    const headerBlue = '#1e5eb8';
    const borderGray = '#e2e8f0';

    return (
      <div className="flex flex-col h-full justify-between" style={{ minHeight: useLetterhead ? 'auto' : (isA5 ? '138mm' : '281mm'), height: useLetterhead ? '100%' : undefined, maxHeight: useLetterhead ? '100%' : undefined, boxSizing: 'border-box', fontFamily: 'Inter, Arial, sans-serif', fontSize: isA5 ? 9 : 11.5, color: '#0f172a' }}>
        <div style={{ flex: useLetterhead ? 'none' : 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${headerBlue}`, paddingBottom: 10, marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: isA5 ? 18 : 24, fontWeight: 900, color: headerBlue, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                {docTitle}
              </h1>
            </div>

            <div style={{ textAlign: 'right', fontSize: isA5 ? 9 : 11, lineHeight: 1.4 }}>
              <div><span style={{ fontWeight: 700 }}>{isQuotation ? 'Quotation No:' : 'Invoice No:'}</span> <span style={{ fontWeight: 800 }}>{im.invoiceNo}</span></div>
              <div><span style={{ fontWeight: 700 }}>{isQuotation ? 'Quote Date:' : 'Date:'}</span> {im.invoiceDate}</div>
              {im.poNo && <div><span style={{ fontWeight: 700 }}>PO Number:</span> {im.poNo}</div>}
              {im.dueDate && <div><span style={{ fontWeight: 700 }}>Due Date:</span> {im.dueDate}</div>}
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Page {pageIdx + 1} of {totalPages}</div>
            </div>
          </div>

          {/* 2-Column Party Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: (useLetterhead && letterheadHideHeader) ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 14, fontSize: isA5 ? 8.5 : 10.5 }}>
            {(!useLetterhead || !letterheadHideHeader) && (
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: `1px solid ${borderGray}` }}>
                <div style={{ fontWeight: 800, fontSize: isA5 ? 9 : 11, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  FROM (SUPPLIER):
                </div>
                <div style={{ fontWeight: 800, fontSize: isA5 ? 10.5 : 13, color: '#0f172a', marginBottom: 2 }}>
                  {co.name}
                </div>
                {showSec.seller_address && (
                  <div style={{ color: '#475569', lineHeight: 1.3, marginBottom: 2 }} dangerouslySetInnerHTML={{ __html: co.address.replace(/\n/g, '<br>') }} />
                )}
                {co.email && <div style={{ color: '#475569' }}><span style={{ fontWeight: 600 }}>Email:</span> {co.email}</div>}
                {co.gstin && <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 2 }}>GSTIN: {co.gstin}</div>}
              </div>
            )}

            {/* BILL TO (CUSTOMER) */}
            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: `1px solid ${borderGray}` }}>
              <div style={{ fontWeight: 800, fontSize: isA5 ? 9 : 11, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                BILL TO (CUSTOMER):
              </div>
              <div style={{ fontWeight: 800, fontSize: isA5 ? 10.5 : 13, color: '#0f172a', marginBottom: 2 }}>
                {bu.name}
              </div>
              <div style={{ color: '#475569', lineHeight: 1.3, marginBottom: 2 }}>{bu.address}</div>
              {bu.phone && <div style={{ color: '#475569' }}><span style={{ fontWeight: 600 }}>Phone:</span> {bu.phone}</div>}
              {showSec.customer_gstin && bu.gstin && <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 2 }}>GSTIN: {bu.gstin}</div>}
            </div>
          </div>

          {/* Items Table with Dedicated Serial/Batch Column */}
          <table style={{ width: '100%', flex: useLetterhead ? 'none' : 1, borderCollapse: 'collapse', border: `1px solid ${borderGray}`, fontSize: isA5 ? 8.5 : 10.5 }}>
            <thead>
              <tr style={{ background: headerBlue, color: '#ffffff' }}>
                <th style={{ padding: '6px 4px', textAlign: 'center', width: '30px', fontWeight: 700 }}>S.No.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Item Description</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', width: '130px', fontWeight: 700 }}>Serial / Batch No.</th>
                {colVis.size && <th style={{ padding: '6px 6px', textAlign: 'center', width: '50px', fontWeight: 700 }}>Size</th>}
                {colVis.hsn && <th style={{ padding: '6px 6px', textAlign: 'center', width: '60px', fontWeight: 700 }}>HSN</th>}
                <th style={{ padding: '6px 6px', textAlign: 'center', width: '45px', fontWeight: 700 }}>Qty</th>
                {colVis.mrp && <th style={{ padding: '6px 8px', textAlign: 'right', width: '70px', fontWeight: 700 }}>MRP</th>}
                <th style={{ padding: '6px 8px', textAlign: 'right', width: '75px', fontWeight: 700 }}>Rate ({cur === 'INR' ? '₹' : cur})</th>
                {colVis.discount && <th style={{ padding: '6px 6px', textAlign: 'center', width: '50px', fontWeight: 700 }}>Disc%</th>}
                {colVis.gstPercent && <th style={{ padding: '6px 6px', textAlign: 'center', width: '50px', fontWeight: 700 }}>Tax</th>}
                <th style={{ padding: '6px 8px', textAlign: 'right', width: '85px', fontWeight: 700 }}>Total ({cur === 'INR' ? '₹' : cur})</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((it: any, idx: number) => {
                const serialOrBatch = it.serialNumber || it.serial_no || it.batch || (it.serials && it.serials.length > 0 ? it.serials.join(', ') : '---');
                const lineTotal = (it.taxable || 0) + (it.taxAmount || 0);
                return (
                  <tr key={idx} style={{ borderBottom: `1px solid ${borderGray}` }}>
                    <td style={{ textAlign: 'center', padding: '6px 4px', verticalAlign: 'top' }}>{startIndex + idx + 1}</td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.name}</div>
                      {(it.subLines || []).map((sl: string, si: number) => (
                        <div key={si} style={{ fontSize: isA5 ? 7.5 : 9, color: '#64748b', marginTop: 1 }}>{sl}</div>
                      ))}
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>
                      {serialOrBatch}
                    </td>
                    {colVis.size && <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top' }}>{it.size || '---'}</td>}
                    {colVis.hsn && <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top' }}>{it.hsn || '---'}</td>}
                    <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top', fontWeight: 700 }}>{it.qty}</td>
                    {colVis.mrp && <td style={{ textAlign: 'right', padding: '6px 8px', verticalAlign: 'top' }}>{it.mrp ? fc(it.mrp, cur) : '---'}</td>}
                    <td style={{ textAlign: 'right', padding: '6px 8px', verticalAlign: 'top' }}>{fc(it.price, cur)}</td>
                    {colVis.discount && <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top' }}>{it.disc ? `${it.disc}%` : '0%'}</td>}
                    {colVis.gstPercent && <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top' }}>{it.gstPct ? `${it.gstPct}%` : '0%'}</td>}
                    <td style={{ textAlign: 'right', padding: '6px 8px', verticalAlign: 'top', fontWeight: 700 }}>{fc(lineTotal, cur)}</td>
                  </tr>
                );
              })}
              {/* Flexible spacer row only when not using letterhead */}
              {!useLetterhead && (
                <tr>
                  <td colSpan={4 + (colVis.size ? 1 : 0) + (colVis.hsn ? 1 : 0) + (colVis.mrp ? 1 : 0) + (colVis.discount ? 1 : 0) + (colVis.gstPercent ? 1 : 0)} style={{ height: '100%' }}></td>
                </tr>
              )}
            </tbody>
          </table>

        </div>

        {/* Bottom Section */}
        {isLastPage ? (
          <div style={{ marginTop: useLetterhead ? 'auto' : 10, paddingTop: useLetterhead ? 6 : 0 }}>
            {/* Grid for Bank Details and Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 10, alignItems: 'flex-start' }}>
              
              {/* Left Column: Bank Details & UPI QR */}
              <div style={{ fontSize: isA5 ? 8.5 : 10 }}>
                {showSec.bank_details && (co.bank || upiId || co.social_qr_url) && (
                  <div>
                    <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, color: '#0f172a' }}>
                      PAYMENT &amp; BANK DETAILS
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ lineHeight: 1.4, color: '#334155', flex: 1 }}>
                        {co.bank && <div><span style={{ fontWeight: 700 }}>Bank Name:</span> {co.bank}</div>}
                        {co.name && <div><span style={{ fontWeight: 700 }}>Account Name:</span> {co.name}</div>}
                        {co.acc && <div><span style={{ fontWeight: 700 }}>Account Number:</span> {co.acc}</div>}
                        {co.ifsc && <div><span style={{ fontWeight: 700 }}>IFSC Code:</span> {co.ifsc}</div>}
                        {co.branch && <div><span style={{ fontWeight: 700 }}>Branch:</span> {co.branch}</div>}
                        {upiId && <div><span style={{ fontWeight: 700 }}>UPI ID:</span> {upiId}</div>}
                      </div>
                      {showSec.upi_qr && (
                        <div style={{ textAlign: 'center', padding: 3, border: `1px solid ${borderGray}`, borderRadius: 6, background: '#ffffff', flexShrink: 0 }}>
                          {QRNode}
                          <div style={{ fontSize: 7, fontWeight: 700, marginTop: 1, color: '#475569' }}>Pay using UPI</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Tax & Grand Total Summary */}
              <div style={{ textAlign: 'right', fontSize: isA5 ? 9 : 11 }}>
                <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, color: '#0f172a' }}>
                  SUMMARY
                </div>
                <div style={{ display: 'flex', justifySelf: 'end', flexDirection: 'column', gap: 2, width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#475569' }}>Taxable Value:</span>
                    <span style={{ fontWeight: 600 }}>{fc(totalTaxable, cur)}</span>
                  </div>
                  {!isIgst ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#475569' }}>CGST:</span>
                        <span style={{ fontWeight: 600 }}>{fc(calcGst.cgst, cur)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#475569' }}>SGST:</span>
                        <span style={{ fontWeight: 600 }}>{fc(calcGst.sgst, cur)}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#475569' }}>IGST:</span>
                      <span style={{ fontWeight: 600 }}>{fc(calcGst.igst, cur)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${borderGray}`, paddingTop: 4, marginTop: 2, fontSize: isA5 ? 11 : 14, fontWeight: 900, color: '#0f172a' }}>
                    <span>Grand Total:</span>
                    <span>{fc(grandTotal, cur)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Amount in Words */}
            {showSec.amount_in_words && (
              <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: `1px solid ${borderGray}`, marginBottom: 10, fontSize: isA5 ? 8.5 : 10.5 }}>
                <span style={{ fontWeight: 700 }}>Amount in Words: </span>
                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{safeToWords(grandTotal, cur)}</span>
              </div>
            )}

            {/* HSN Summary Table */}
            {showSec.hsn_summary && (
              <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${borderGray}`, fontSize: isA5 ? 8 : 9.5, marginBottom: 10 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th rowSpan={2} style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'center' }}>HSN / SAC</th>
                    <th rowSpan={2} style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'center' }}>Taxable Value</th>
                    <th colSpan={2} style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'center' }}>CGST</th>
                    <th colSpan={2} style={{ border: `1px solid ${borderGray}`, padding: 2, textAlign: 'center' }}>SGST</th>
                    <th rowSpan={2} style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'center' }}>Total Tax</th>
                  </tr>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ border: `1px solid ${borderGray}`, padding: 2 }}>%</th>
                    <th style={{ border: `1px solid ${borderGray}`, padding: 2 }}>Amount</th>
                    <th style={{ border: `1px solid ${borderGray}`, padding: 2 }}>%</th>
                    <th style={{ border: `1px solid ${borderGray}`, padding: 2 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnEntries.map(([hsn, d]) => (
                    <tr key={hsn}>
                      <td style={{ border: `1px solid ${borderGray}`, padding: 3 }}>{hsn}</td>
                      <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(d.taxable, cur)}</td>
                      <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{isIgst ? '0%' : `${d.pct / 2}%`}</td>
                      <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(isIgst ? 0 : d.cgst, cur)}</td>
                      <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{isIgst ? '0%' : `${d.pct / 2}%`}</td>
                      <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(isIgst ? 0 : d.sgst, cur)}</td>
                      <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(d.tax, cur)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                    <td style={{ border: `1px solid ${borderGray}`, padding: 3 }}>Total</td>
                    <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(totalTaxable, cur)}</td>
                    <td style={{ border: `1px solid ${borderGray}`, padding: 3 }}></td>
                    <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(isIgst ? 0 : cgstTotal, cur)}</td>
                    <td style={{ border: `1px solid ${borderGray}`, padding: 3 }}></td>
                    <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(isIgst ? 0 : sgstTotal, cur)}</td>
                    <td style={{ border: `1px solid ${borderGray}`, padding: 3, textAlign: 'right' }}>{fc(totalTax, cur)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* Declaration Box */}
            {showSec.declaration && (
              <div style={{ fontSize: isA5 ? 7.5 : 9, color: '#475569', fontStyle: 'italic', marginBottom: 8, padding: '4px 8px', background: '#f8fafc', borderRadius: 4, border: `1px solid ${borderGray}` }}>
                <b>Declaration:</b> {invoice?.declaration_text || sellerInfo?.declaration_text || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}
              </div>
            )}

            {/* Terms and Signatory Footer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'flex-end', paddingTop: 6 }}>
              {/* Left: Terms & Conditions */}
              <div>
                {showSec.terms && termsText.length > 0 && (
                  <div style={{ fontSize: isA5 ? 8 : 9.5, color: '#334155' }}>
                    <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>TERMS &amp; CONDITIONS:</div>
                    {termsText.slice(0, 3).map((term: string, tIdx: number) => (
                      <div key={tIdx}>{tIdx + 1}. {term}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Authorized Signatory */}
              <div style={{ textAlign: 'right', fontSize: isA5 ? 8.5 : 10 }}>
                {showSec.signature && (
                  <div>
                    <div style={{ height: isA5 ? 28 : 42, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {co.sign && <img src={co.sign} alt="Signature" style={{ maxHeight: isA5 ? 28 : 42, maxWidth: '100%', objectFit: 'contain' }} />}
                    </div>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginTop: 2 }}>Authorized Signatory</div>
                    <div style={{ fontWeight: 700, color: '#475569', fontSize: isA5 ? 7.5 : 9 }}>{co.forCo}</div>
                  </div>
                )}
              </div>
            </div>

            {renderSocialStrip(borderGray, '#f8fafc')}

            {/* Footer Notes */}
            {showSec.footer && (invoice.notes || sellerInfo?.footer_notes) && (
              <div style={{ borderTop: `1px solid ${borderGray}`, fontSize: isA5 ? 7.5 : 9.5, padding: '4px 6px', textAlign: 'center', marginTop: 6, color: '#475569' }}>
                {invoice.notes || sellerInfo?.footer_notes}
              </div>
            )}

          </div>
        ) : (
          <div style={{ textAlign: 'right', fontSize: 9.5, fontWeight: 700, padding: 4, color: headerBlue, marginTop: 'auto' }}>
            Continued on Next Page →
          </div>
        )}
      </div>
    );
  };

  const renderPage = (pageItems: any[], pageIdx: number, isLastPage: boolean) => {
    const startIndex = getStartIndex(pageIdx);
    switch (tpl) {
      case 'template_03':
      case 'template_16':
        return renderTemplate16Page(pageItems, pageIdx, isLastPage, startIndex);
      case 'template_02':
      case 'template_04':
        return renderTemplate03Page(pageItems, pageIdx, isLastPage, startIndex);
      case 'template_01':
      default:
        return renderTemplate01Page(pageItems, pageIdx, isLastPage, startIndex);
    }
  };

  const sheetWidth = isPOS ? 'auto' : '210mm';
  const sheetMinHeight = isPOS ? 'auto' : (isA5 ? '148mm' : '297mm');
  const sheetPadding = isPOS ? '0' : (isA5 ? '4mm 6mm' : '8mm');
  // Mobile scaling wrapper style
  const mobileScaleStyle = isPOS ? {} : {
    transformOrigin: 'top center',
    overflowX: 'auto' as const,
    maxWidth: '100%',
    WebkitOverflowScrolling: 'touch' as any,
  };

  const activeScale = isPOS ? 1 : (fitToScreen ? scaleFactor : (customZoom ?? 1));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pb-24 md:pb-16 pb-safe print:bg-white print:p-0 print:m-0 print:pb-0">
      {/* Top Sticky Header Toolbar */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs print:hidden">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3">
          
          {/* Left: Back button & Invoice Info */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <button 
              onClick={() => navigate('/invoices')} 
              className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0 min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-90 cursor-pointer"
              title="Back to Invoices"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2">
                <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 truncate leading-none">#{invNo}</h1>
                <span className={cn('px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider', isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                  {invoice.status || 'Draft'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate mt-0.5">
                {customer?.name || invoice.customer_name || 'Cash Sale'}
              </p>
            </div>
          </div>

          {/* Center / Right: Page Size & Zoom Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {!isPOS && (
              <>
                {/* A4 vs A5 selector */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shrink-0">
                  <button
                    onClick={() => setPageSize('A4')}
                    className={cn(
                      "px-2 py-1 text-[10px] font-black rounded-md transition-all",
                      pageSize === 'A4' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    A4
                  </button>
                  <button
                    onClick={() => setPageSize('A5')}
                    className={cn(
                      "px-2 py-1 text-[10px] font-black rounded-md transition-all",
                      pageSize === 'A5' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    A5
                  </button>
                </div>

                {/* Mobile & Desktop Fit/Zoom Controls */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shrink-0">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded-md transition-all active:scale-90"
                    title="Zoom Out"
                  >
                    <ZoomOut size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={fitToScreen ? handleSet100 : handleResetFit}
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-black rounded-md transition-all min-w-[34px] text-center",
                      fitToScreen ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-900 shadow-xs"
                    )}
                    title={fitToScreen ? "Currently Fit to Screen (Click for 100%)" : "Click to Fit to Screen"}
                  >
                    {fitToScreen ? "FIT" : `${Math.round(activeScale * 100)}%`}
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded-md transition-all active:scale-90"
                    title="Zoom In"
                  >
                    <ZoomIn size={12} />
                  </button>
                </div>
              </>
            )}

            {/* Letterhead Configuration Button */}
            {!isPOS && (
              <button
                onClick={() => setShowLetterheadSlider(!showLetterheadSlider)}
                className={cn(
                  "inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-2.5 font-bold rounded-xl text-xs transition-colors cursor-pointer active:scale-95 border",
                  useLetterhead
                    ? "bg-green-50 hover:bg-green-100 text-emerald-800 border-green-300 shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                )}
                title="Letterhead Settings & Alignment"
              >
                <FileSpreadsheet size={14} className={useLetterhead ? "text-emerald-700" : "text-slate-500"} />
                <span className="hidden xs:inline text-[11px]">Letterhead</span>
                {useLetterhead && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                )}
              </button>
            )}

            {/* Action Buttons: Edit, WhatsApp Share, PDF, Print (ALWAYS VISIBLE) */}
            <button 
              onClick={() => navigate(`/invoices/edit/${invoice.id}`)} 
              className="inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-colors cursor-pointer active:scale-95"
              title="Edit Invoice"
            >
              <Edit3 size={14} />
              <span className="hidden sm:inline text-[11px]">Edit</span>
            </button>

            <button 
              onClick={handleShare} 
              className="inline-flex items-center justify-center gap-1 h-8 px-2.5 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Share via WhatsApp"
            >
              <WhatsAppIcon size={14} />
              <span className="text-[11px] font-bold">Share</span>
            </button>

            <button 
              onClick={handleDownloadPdf} 
              disabled={downloading} 
              className="inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
              title="Download PDF"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="text-[11px] font-bold">PDF</span>
            </button>

            <button 
              onClick={handlePrint} 
              className="inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer active:scale-95"
              title="Print Invoice"
            >
              <Printer size={14} />
              <span className="hidden xs:inline text-[11px]">Print</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Document Canvas */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full flex-1 px-1 sm:px-4 mt-2 sm:mt-4 flex flex-col items-center print:max-w-none print:w-full print:p-0 print:m-0 print:flex print:items-center print:justify-center overflow-x-auto custom-scrollbar"
        style={{
          touchAction: 'pan-x pan-y pinch-zoom'
        }}
      >
        <div className="w-full overflow-x-auto custom-scrollbar flex justify-center py-2">
          <div 
            ref={invoiceRef} 
            id="invoice-document-canvas" 
            className="flex flex-col items-center gap-4 print:gap-0 print:w-full print:flex print:items-center print:justify-center shrink-0"
            style={{
              width: !isPOS ? `calc(${sheetWidth} * ${activeScale})` : 'auto',
              minWidth: !isPOS ? `calc(${sheetWidth} * ${activeScale})` : 'auto',
              margin: '0 auto'
            }}
          >
            {isPOS ? (
              <div className="w-full flex justify-center print:w-full print:flex print:justify-center print:items-center">
                {renderPOS(tpl === 'template_04' || tpl === 'template_14')}
              </div>
            ) : (
              itemPages.map((pItems, idx) => {
                const sheetHeightStyle = isA5 ? '148mm' : (pageSize === 'A4' ? '297mm' : 'auto');
                return (
                  <div
                    key={idx}
                    className="flex flex-col items-start justify-start"
                    style={{
                      width: `calc(${sheetWidth} * ${activeScale})`,
                      height: activeScale !== 1 ? `calc(${isA5 ? '148mm' : '297mm'} * ${activeScale} + 24px)` : 'auto',
                      marginBottom: activeScale < 1 ? '8px' : '16px',
                      overflow: 'visible',
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        transform: activeScale !== 1 ? `scale(${activeScale})` : 'none',
                        transformOrigin: 'top left',
                        transition: touchStartDistRef.current ? 'none' : 'transform 0.12s ease-out'
                      }}
                    >
                      <div
                        className="invoice-page-sheet shadow-md print:shadow-none"
                        style={{
                          width: sheetWidth,
                          height: sheetHeightStyle,
                          minHeight: sheetMinHeight,
                          maxHeight: isA5 ? '148mm' : (pageSize === 'A4' ? '297mm' : undefined),
                          padding: useLetterhead ? 0 : sheetPadding,
                          background: '#fff',
                          boxSizing: 'border-box',
                          margin: '0 auto 16px auto',
                          pageBreakAfter: idx < totalPages - 1 ? 'always' : 'auto',
                          breakAfter: idx < totalPages - 1 ? 'page' : 'auto',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Letterhead Background Layer */}
                        {useLetterhead && letterheadUrl && (
                          <img
                            src={letterheadUrl}
                            alt="Letterhead Background"
                            className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 print:block"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'fill',
                              zIndex: 0,
                              pointerEvents: 'none',
                              display: 'block'
                            }}
                          />
                        )}

                        <div
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box',
                            paddingTop: useLetterhead ? `${letterheadTop}mm` : 0,
                            paddingBottom: useLetterhead ? `${letterheadBottom}mm` : 0,
                            paddingLeft: useLetterhead ? '10mm' : 0,
                            paddingRight: useLetterhead ? '10mm' : 0,
                          }}
                        >
                          {renderPage(pItems, idx, idx === totalPages - 1)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Floating Mobile Zoom & Pan Helper Pill (For Smartphone & APK invoice inspection) */}
      {!isPOS && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full shadow-2xl border border-slate-700 md:hidden print:hidden">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 text-slate-300 hover:text-white active:scale-90"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          
          <span className="text-[11px] font-mono font-black px-1 text-emerald-300 min-w-[36px] text-center">
            {Math.round(activeScale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 text-slate-300 hover:text-white active:scale-90"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>

          <div className="w-[1px] h-3 bg-slate-700 mx-0.5" />

          <button
            type="button"
            onClick={handleResetFit}
            className={cn(
              "px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider transition-all",
              fitToScreen ? "bg-emerald-500 text-slate-950 font-extrabold" : "text-slate-300 hover:text-white"
            )}
          >
            Fit
          </button>

          <button
            type="button"
            onClick={handleSet100}
            className={cn(
              "px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider transition-all",
              !fitToScreen && Math.round(activeScale * 100) === 100 ? "bg-emerald-500 text-slate-950 font-extrabold" : "text-slate-300 hover:text-white"
            )}
          >
            100%
          </button>
        </div>
      )}

      {/* Accessible Letterhead Settings & Alignment Live Side Panel */}
      {showLetterheadSlider && (
        <div className="fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-white shadow-2xl z-50 border-l border-slate-200 overflow-hidden flex flex-col print:hidden animate-in slide-in-from-right duration-200">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-green-100 flex items-center justify-between bg-green-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-green-100 text-emerald-800 flex items-center justify-center font-bold">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 leading-tight">Letterhead Settings</h3>
                <p className="text-[11px] text-slate-500 font-medium">Live side margin & offset controls</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLetterheadSlider(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Panel Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            {/* Enable Switch */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <div>
                <div className="text-xs font-black text-slate-800 uppercase tracking-wider">Enable Letterhead</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Prints invoice content directly over your letterhead</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLetterhead}
                  onChange={(e) => setUseLetterhead(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#166534]"></div>
              </label>
            </div>

            {/* Letterhead Upload Section */}
            <div className="p-4 bg-green-50/60 border border-green-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Letterhead Image (PNG, JPG, WEBP)</span>
                {letterheadUrl && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded-full border border-green-300">Uploaded</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {letterheadUrl ? (
                  <div className="relative w-16 h-22 bg-white border border-green-200 rounded-xl overflow-hidden shrink-0 shadow-xs">
                    <img src={letterheadUrl} alt="Letterhead Thumbnail" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-22 bg-white border-2 border-dashed border-green-300 rounded-xl flex flex-col items-center justify-center text-slate-400 shrink-0">
                    <Upload size={18} className="text-emerald-700" />
                    <span className="text-[9px] mt-1 font-bold text-slate-500">Optional</span>
                  </div>
                )}

                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#166534] hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
                      <Upload size={13} />
                      <span>{letterheadUrl ? 'Change Image' : 'Upload Image'}</span>
                      <input
                        ref={letterheadFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLetterheadUpload}
                      />
                    </label>
                    {letterheadUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLetterhead}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Remove Letterhead Image"
                      >
                        <Trash2 size={14} />
                        <span className="text-xs">Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    If using pre-printed physical paper sheets, simply adjust the margins below without uploading an image!
                  </p>
                </div>
              </div>
            </div>

            {/* Slider 1: Top Margin / Header Offset (2 in / 50.8 mm) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Header Margin / Upar Se Jagah
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLetterheadTop(Math.max(0, Math.round((letterheadTop - 5) * 10) / 10))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="-5mm"
                  >
                    -
                  </button>
                  <span className="px-2.5 py-1 bg-green-100 text-emerald-900 border border-green-200 rounded-lg text-xs font-extrabold tabular-nums min-w-[65px] text-center">
                    {letterheadTop} mm
                  </span>
                  <button
                    type="button"
                    onClick={() => setLetterheadTop(Math.min(120, Math.round((letterheadTop + 5) * 10) / 10))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="+5mm"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Recommended: 2.16 in = 55 mm</span>
                <button
                  type="button"
                  onClick={() => setLetterheadTop(55)}
                  className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Set 2.16 in (55 mm)
                </button>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-bold text-slate-400">0 mm</span>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="0.5"
                  value={letterheadTop}
                  onChange={(e) => setLetterheadTop(Number(e.target.value))}
                  className="flex-1 accent-[#166534] cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <span className="text-[10px] font-bold text-slate-400">120 mm</span>
              </div>
            </div>

            {/* Slider 2: Bottom Margin / Footer Offset (35 mm) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Footer Margin / Niche Se Jagah
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLetterheadBottom(Math.max(0, Math.round((letterheadBottom - 5) * 10) / 10))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="-5mm"
                  >
                    -
                  </button>
                  <span className="px-2.5 py-1 bg-green-100 text-emerald-900 border border-green-200 rounded-lg text-xs font-extrabold tabular-nums min-w-[65px] text-center">
                    {letterheadBottom} mm
                  </span>
                  <button
                    type="button"
                    onClick={() => setLetterheadBottom(Math.min(80, Math.round((letterheadBottom + 5) * 10) / 10))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="+5mm"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Recommended: 1.38 in = 35 mm</span>
                <button
                  type="button"
                  onClick={() => setLetterheadBottom(35)}
                  className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Set 1.38 in (35 mm)
                </button>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-bold text-slate-400">0 mm</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="0.5"
                  value={letterheadBottom}
                  onChange={(e) => setLetterheadBottom(Number(e.target.value))}
                  className="flex-1 accent-[#166534] cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <span className="text-[10px] font-bold text-slate-400">80 mm</span>
              </div>
            </div>

            {/* Margin Info Card: Side margins */}
            <div className="p-3.5 bg-green-50/50 border border-green-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-slate-800">Side Margins (Dono Saido Me Jagah)</div>
                <div className="text-[11px] text-slate-500">Fixed standard padding on left and right</div>
              </div>
              <span className="px-2.5 py-1 bg-white border border-green-200 text-emerald-800 rounded-lg text-xs font-extrabold">
                14 mm (1.4 cm)
              </span>
            </div>

            {/* Hide Default Header Checkbox */}
            <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <input
                type="checkbox"
                id="lh_hide_hdr"
                checked={letterheadHideHeader}
                onChange={(e) => setLetterheadHideHeader(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer accent-[#166534]"
              />
              <label htmlFor="lh_hide_hdr" className="text-xs text-slate-700 cursor-pointer leading-relaxed">
                <strong className="font-bold text-slate-900 block">Hide standard digital company header</strong>
                Hides business name, logo, and address so it doesn't double-print over your letterhead branding.
              </label>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowLetterheadSlider(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Done
            </button>
            <button
              type="button"
              disabled={isSavingLetterhead}
              onClick={handleSaveLetterheadOffset}
              className="px-4 py-2 bg-[#166534] hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSavingLetterhead ? <Loader2 size={14} className="animate-spin" /> : null}
              <span>Save as Default</span>
            </button>
          </div>
        </div>
      )}

      <WhatsAppShareModal isOpen={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} whatsAppUrl={whatsAppUrlState} whatsAppWebUrl={whatsAppWebUrlState} whatsAppAppUrl={whatsAppAppUrlState} documentTitle="Invoice" copiedToClipboard={copiedToClipboard} fileName={`Invoice_${invoice?.invoice_number || 'bill'}.pdf`} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        @media print {
          @page {
            size: ${isPOS ? 'auto' : (isA5 ? 'A5 landscape' : 'A4 portrait')};
            margin: 0mm;
          }
          *, *:before, *:after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { width: 100% !important; height: auto !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
          body * { visibility: hidden !important; }
          header, nav, aside, footer, button { display: none !important; }
          #invoice-document-canvas, #invoice-document-canvas * { visibility: visible !important; }
          #invoice-document-canvas {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            background: #ffffff !important;
          }
          .pos-thermal-receipt {
            margin: 1cm auto !important;
            border: 1px solid #000000 !important;
            padding: 1cm !important;
            box-sizing: border-box !important;
            display: block !important;
          }
          .invoice-page-sheet {
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            position: relative !important;
            overflow: hidden !important;
          }
          .invoice-page-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
