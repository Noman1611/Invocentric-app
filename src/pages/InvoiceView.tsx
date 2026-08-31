import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { getSecureStorage } from '../utils/cryptoUtils';
import { formatCurrency, cn, normalizePhoneNumber } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { toWords } from 'number-to-words';
import { ArrowLeft, Edit3, Printer, Download, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { WhatsAppShareModal } from '../components/WhatsAppShareModal';
import { WhatsAppIcon } from '../components/WhatsAppIcon';

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

  const shouldAutoPrint = searchParams.get('print') === 'true' || searchParams.get('pos') === 'true' || searchParams.get('autoPrint') === 'true';

  // Responsive Auto-Fit Scaling on Mobile Devices (< 768px) - Hook called unconditionally at top level
  const [fitToScreen, setFitToScreen] = useState(true);
  const [scaleFactor, setScaleFactor] = useState(1);

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

          // Fetch Seller / Business details
          const userIdToFetch = invData.user_id || user?.uid;
          if (userIdToFetch) {
            let ud: any = null;
            const cp = getSecureStorage(`user_profile_${userIdToFetch}`, null);
            if (cp) ud = { id: userIdToFetch, ...(typeof cp === 'string' ? JSON.parse(cp) : cp) };
            if (!ud) {
              try { const s = await getDoc(doc(db, 'users', userIdToFetch)); if (s.exists()) ud = { id: s.id, ...s.data() }; } catch (_) {}
            }
            if (!ud && user) {
              ud = { id: user.uid, business_name: user.displayName || 'Business', email: user.email };
            }
            if (ud) setSellerInfo(ud);
          }
        }
      } catch (err) { 
        console.error("Error loading invoice:", err);
      } finally { 
        setLoading(false); 
      }
    }
    fetchData();
  }, [id, user, isOfflineMode]);

  // Trigger Auto-Print when navigating with ?print=true or ?pos=true
  useEffect(() => {
    if (!loading && invoice && shouldAutoPrint && !hasAutoPrinted) {
      setHasAutoPrinted(true);
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, invoice, shouldAutoPrint, hasAutoPrinted]);

  const rawTpl: string = invoice?.invoice_template || sellerInfo?.invoice_template || 'template_01';
  // Map legacy template IDs to new system
  const legacyMap: Record<string, string> = {
    'tally_prime_gst': 'template_01',
    'gst_classic': 'template_03',
    'modern_blue': 'template_07',
    'compact': 'template_09',
    'minimal': 'template_08',
  };
  const tpl: string = legacyMap[rawTpl] || rawTpl;
  const isPOS = tpl === 'template_14' || tpl === 'template_15';
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

  const hsnMap: Record<string, { taxable: number; cgst: number; sgst: number; igst: number; tax: number; pct: number }> = {};
  itemRows.forEach((i: any) => {
    if (!hsnMap[i.hsn]) hsnMap[i.hsn] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, pct: i.gstPct };
    hsnMap[i.hsn].taxable += i.taxable; hsnMap[i.hsn].tax += i.gstAmt;
    if (isIgst) hsnMap[i.hsn].igst += i.gstAmt;
    else { hsnMap[i.hsn].cgst += i.gstAmt / 2; hsnMap[i.hsn].sgst += i.gstAmt / 2; }
  });
  const hsnEntries = Object.entries(hsnMap);

  const upiId = sellerInfo?.upi_id || sellerInfo?.upiId;
  const upiUrl = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(sellerInfo?.business_name || '')}&am=${grandTotal}&cu=INR` : null;

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

        // For POS, roll width is 80mm (tpl 14) or 58mm (tpl 15), height is dynamically computed to fit all items perfectly
        const pdfWidth = isPOS ? (tpl === 'template_14' ? 80 : 58) : (isA5 ? 210 : 210);
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
    const cp = normalizePhoneNumber(customer?.phone || '');
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

  const invNo = invoice.invoice_number || `INV-${invoice.id.slice(0, 6).toUpperCase()}`;
  const isPaid = invoice.status === 'paid';
  const co = {
    name: sellerInfo?.business_name || '', address: sellerInfo?.address || '',
    gstin: sellerInfo?.gstin || '', phone: sellerInfo?.phone || '',
    email: sellerInfo?.email || '', pan: sellerInfo?.pan || '',
    logo: sellerInfo?.logo_url || '', bank: sellerInfo?.bank_name || '',
    branch: sellerInfo?.bank_branch || '', acc: sellerInfo?.account_number || '',
    ifsc: sellerInfo?.ifsc_code || '', upi: upiId || '',
    sign: sellerInfo?.signature_url || '', forCo: `For ${sellerInfo?.business_name || 'Company'}`,
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
  const QRNode = (showSec.upi_qr && upiUrl) ? <QRCodeSVG value={upiUrl} size={isA5 ? 46 : 75} level="H" /> : <div style={{ width: isA5 ? 46 : 75, height: isA5 ? 46 : 75, border: '1px dashed #999' }} />;
  const termsText = (invoice.terms || sellerInfo?.default_terms || '').split('\n').filter(Boolean);

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
      <div className="flex flex-col h-full justify-between" style={{ minHeight: isA5 ? '138mm' : '281mm', fontFamily:'Arial,Helvetica,sans-serif', fontSize: isA5 ? 9 : 12, color:'#1a1a1a' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:b,borderBottom:'none',padding:'2px 6px',fontWeight:'bold',fontSize: isA5 ? 9 : 11.5}}>
            <div>GSTIN : {co.gstin}</div><div style={{fontSize: isA5 ? 10.5 : 13, color:dark}}>TAX INVOICE</div><div>ORIGINAL FOR RECIPIENT</div>
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
              <div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-2px -6px 2px',padding:1,borderBottom:b}}>Invoice Details :</div>
              {[['Invoice No.',im.invoiceNo],['Invoice Date',im.invoiceDate],['Due Date',im.dueDate],['P.O. No.',im.poNo],['P.O. Date',im.poDate],['E-Way No.',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:0.5}}><div style={{width: isA5 ? 65 : 80,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1}}>{v}</div></div>))}
            </div>
          </div>

          {/* Dynamic Items Table - Clean uninterrupted vertical lines without row dividers */}
          <table style={{width:'100%',flex:1,borderCollapse:'collapse',borderLeft:b,borderRight:b,borderBottom:b,fontSize: isA5 ? 8.5 : 10.5}}>
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
              {/* Spacer row to let vertical column lines extend continuously */}
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
            </tbody>
          </table>
        </div>

        {/* Structured Bottom Section - Total / CGST / SGST exactly on top of Total in Words */}
        {isLastPage ? (
          <div style={{ marginTop: 'auto' }}>
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
                      <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:1,borderBottom:b,margin:'-2px -5px 2px'}}>Certified that particulars are true and correct.</div>
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
      <div className="flex flex-col h-full justify-between" style={{ minHeight: isA5 ? '138mm' : '281mm', fontFamily:'Arial,Helvetica,sans-serif', fontSize: isA5 ? 9 : 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:`2px solid ${blue}`,paddingBottom:3,marginBottom:3}}>
            <div><div style={{fontSize: isA5 ? 13 : 19,fontWeight:'bold',color:blue}}>TAX INVOICE</div><div style={{fontSize: isA5 ? 11.5 : 16,fontWeight:'bold',margin:'1px 0'}}>{co.name}</div><div><b>GSTIN</b> {co.gstin}</div>{showSec.seller_address && <div style={{fontSize: isA5 ? 8.5 : 11,lineHeight:1.2}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/>}{co.phone&&<div><b>Phone:</b> {co.phone}</div>}</div>
            <div style={{textAlign:'right'}}><div style={{fontSize:8.5,fontWeight:'bold'}}>ORIGINAL FOR RECIPIENT</div>{co.logo&&<img src={co.logo} alt="logo" style={{width: isA5 ? 32 : 52,height: isA5 ? 32 : 52}}/>}<div style={{fontSize:8.5,color:'#666',marginTop:1}}>Page {pageIdx + 1} of {totalPages}</div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.2fr 1fr',gap:5,borderBottom:`2px solid ${blue}`,paddingBottom:3,marginBottom:3,fontSize: isA5 ? 8.5 : 10.5}}>
            <div><b style={{display:'block',marginBottom:0.5}}>Customer Details:</b><div style={{fontWeight:'bold'}}>{bu.name}</div><div>{bu.address}</div>{showSec.customer_gstin && <div><b>GSTIN:</b> {bu.gstin}</div>}<div><b>State:</b> {bu.state}</div></div>
            <div><b style={{display:'block',marginBottom:0.5}}>Shipping address:</b><div style={{fontWeight:'bold'}}>{sh.name}</div><div>{sh.address}</div><div><b>State:</b> {sh.state}</div></div>
            <div>{[['Invoice #:',im.invoiceNo],['Invoice Date:',im.invoiceDate],['P.O. No.:',im.poNo],['E-Way No.:',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:0.5}}><div style={{fontWeight:'bold',width: isA5 ? 55 : 70}}>{l}</div><b>{v}</b></div>))}</div>
          </div>
          <table style={{width:'100%',flex:1,borderCollapse:'collapse',borderLeft:b,borderRight:b,borderBottom:b,fontSize: isA5 ? 8.5 : 10.5}}>
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
    // 3-inch roll (80mm total width / ~72mm printable area)
    // 2-inch roll (58mm total width / ~48mm printable area)
    const containerWidth = is3Inch ? '72mm' : '48mm';
    const baseFontSize = is3Inch ? '11.5px' : '9.5px';
    const headerTitleSize = is3Inch ? '14px' : '11.5px';
    const docTitleSize = is3Inch ? '12px' : '10px';
    const subItalicSize = is3Inch ? '10px' : '8.5px';
    const grandTotalSize = is3Inch ? '13px' : '11px';
    const qrSize = is3Inch ? 115 : 85;

    const invoiceTitle = invoice?.invoice_title || 'TAX INVOICE';
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
          margin: '0 auto',
          padding: is3Inch ? '10px 6px' : '6px 3px',
          textAlign: 'center',
          background: '#ffffff',
          color: '#000000',
          lineHeight: '1.4',
          boxSizing: 'border-box',
          letterSpacing: '0.5px'
        }}
      >
        {/* 1. Header: Business Information (Centered Bold) */}
        <div style={{ fontWeight: 700, fontSize: headerTitleSize, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>
          {co.name || 'NOMAN SHAIKH'}
        </div>
        {co.address && (
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
          {bu.gstin && (
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

        {/* 6. Footer: InvoCentric Branding & Visit Again */}
        <div style={{ marginTop: '6px', textAlign: 'center' }}>
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
      <div className="flex flex-col h-full justify-between" style={{ minHeight: isA5 ? '138mm' : '281mm', fontFamily: 'Inter, Arial, sans-serif', fontSize: isA5 ? 9 : 11.5, color: '#0f172a' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${headerBlue}`, paddingBottom: 10, marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: isA5 ? 18 : 24, fontWeight: 900, color: headerBlue, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                {sellerInfo?.business_name ? 'SUPPLIER INVOICE' : 'TAX INVOICE'}
              </h1>
            </div>

            <div style={{ textAlign: 'right', fontSize: isA5 ? 9 : 11, lineHeight: 1.4 }}>
              <div><span style={{ fontWeight: 700 }}>Invoice No:</span> <span style={{ fontWeight: 800 }}>{im.invoiceNo}</span></div>
              <div><span style={{ fontWeight: 700 }}>Date:</span> {im.invoiceDate}</div>
              {im.poNo && <div><span style={{ fontWeight: 700 }}>PO Number:</span> {im.poNo}</div>}
              {im.dueDate && <div><span style={{ fontWeight: 700 }}>Due Date:</span> {im.dueDate}</div>}
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Page {pageIdx + 1} of {totalPages}</div>
            </div>
          </div>

          {/* 2-Column Party Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14, fontSize: isA5 ? 8.5 : 10.5 }}>
            {/* FROM (SUPPLIER) */}
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
          <table style={{ width: '100%', flex: 1, borderCollapse: 'collapse', border: `1px solid ${borderGray}`, fontSize: isA5 ? 8.5 : 10.5 }}>
            <thead>
              <tr style={{ background: headerBlue, color: '#ffffff' }}>
                <th style={{ padding: '6px 4px', textAlign: 'center', width: '30px', fontWeight: 700 }}>S.No.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Item Description</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', width: '130px', fontWeight: 700 }}>Serial / Batch No.</th>
                <th style={{ padding: '6px 6px', textAlign: 'center', width: '60px', fontWeight: 700 }}>HSN</th>
                <th style={{ padding: '6px 6px', textAlign: 'center', width: '45px', fontWeight: 700 }}>Qty</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', width: '75px', fontWeight: 700 }}>Rate ({cur === 'INR' ? '₹' : cur})</th>
                <th style={{ padding: '6px 6px', textAlign: 'center', width: '50px', fontWeight: 700 }}>Tax</th>
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
                    <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top' }}>{it.hsn || '---'}</td>
                    <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top', fontWeight: 700 }}>{it.qty}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', verticalAlign: 'top' }}>{fc(it.price, cur)}</td>
                    <td style={{ textAlign: 'center', padding: '6px 6px', verticalAlign: 'top' }}>{it.gstPct ? `${it.gstPct}%` : '0%'}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', verticalAlign: 'top', fontWeight: 700 }}>{fc(lineTotal, cur)}</td>
                  </tr>
                );
              })}
              {/* Flexible spacer row */}
              <tr>
                <td colSpan={8} style={{ height: '100%' }}></td>
              </tr>
            </tbody>
          </table>

        </div>

        {/* Bottom Section */}
        {isLastPage ? (
          <div style={{ marginTop: 10 }}>
            {/* Grid for Bank Details and Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 10, alignItems: 'flex-start' }}>
              
              {/* Left Column: Bank Details */}
              <div style={{ fontSize: isA5 ? 8.5 : 10 }}>
                {showSec.bank_details && co.bank && (
                  <div>
                    <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, color: '#0f172a' }}>
                      BANK DETAILS
                    </div>
                    <div style={{ lineHeight: 1.4, color: '#334155' }}>
                      <div><span style={{ fontWeight: 700 }}>Bank Name:</span> {co.bank}</div>
                      <div><span style={{ fontWeight: 700 }}>Account Name:</span> {co.name}</div>
                      <div><span style={{ fontWeight: 700 }}>Account Number:</span> {co.acc}</div>
                      {co.ifsc && <div><span style={{ fontWeight: 700 }}>IFSC Code:</span> {co.ifsc}</div>}
                      {co.branch && <div><span style={{ fontWeight: 700 }}>Branch:</span> {co.branch}</div>}
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
      case 'template_16':
        return renderTemplate16Page(pageItems, pageIdx, isLastPage, startIndex);
      case 'template_03':
      case 'template_04':
      case 'template_09':
      case 'template_10':
        return renderTemplate03Page(pageItems, pageIdx, isLastPage, startIndex);
      case 'template_01':
      case 'template_02':
      case 'template_07':
      case 'template_08':
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

  const activeScale = isPOS ? 1 : (fitToScreen ? scaleFactor : 1);

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

                {/* Mobile Fit/Zoom toggle */}
                {scaleFactor < 1 && (
                  <button
                    onClick={() => setFitToScreen(!fitToScreen)}
                    className={cn(
                      "md:hidden h-8 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95",
                      fitToScreen 
                        ? "bg-slate-100 text-slate-700 border-slate-300" 
                        : "bg-emerald-50 text-emerald-700 border-emerald-300"
                    )}
                    title={fitToScreen ? "Switch to 100% Zoom" : "Fit to Phone Screen"}
                  >
                    {fitToScreen ? "Fit" : "100%"}
                  </button>
                )}
              </>
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
      <main className="w-full max-w-5xl px-1 sm:px-4 mt-3 sm:mt-6 flex flex-col items-center print:max-w-none print:w-full print:p-0 print:m-0 print:flex print:items-center print:justify-center overflow-x-auto custom-scrollbar">
        <div className="w-full max-w-full overflow-x-auto custom-scrollbar flex flex-col items-center py-1">
          <div ref={invoiceRef} id="invoice-document-canvas" className="flex flex-col items-center gap-4 print:gap-0 print:w-full print:flex print:items-center print:justify-center shrink-0">
            {isPOS ? (
              <div className="w-full flex justify-center print:w-full print:flex print:justify-center print:items-center">
                {renderPOS(tpl === 'template_14')}
              </div>
            ) : (
              itemPages.map((pItems, idx) => {
                const sheetHeightStyle = isA5 ? '148mm' : (pageSize === 'A4' ? '297mm' : 'auto');
                return (
                  <div
                    key={idx}
                    className="w-full flex flex-col items-center"
                    style={{
                      // Scale container height smoothly so there is no huge empty white gap under scaled document
                      height: activeScale < 1 ? `calc(${isA5 ? '148mm' : '297mm'} * ${activeScale} + 12px)` : 'auto',
                      marginBottom: activeScale < 1 ? '8px' : '0px',
                      overflow: activeScale < 1 ? 'visible' : 'auto'
                    }}
                  >
                    <div
                      style={{
                        transform: activeScale < 1 ? `scale(${activeScale})` : 'none',
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease-in-out'
                      }}
                    >
                      <div
                        className="invoice-page-sheet shadow-md print:shadow-none"
                        style={{
                          width: sheetWidth,
                          height: sheetHeightStyle,
                          minHeight: sheetMinHeight,
                          maxHeight: isA5 ? '148mm' : (pageSize === 'A4' ? '297mm' : undefined),
                          padding: sheetPadding,
                          background: '#fff',
                          boxSizing: 'border-box',
                          margin: '0 auto 16px auto',
                          pageBreakAfter: idx < totalPages - 1 ? 'always' : 'auto',
                          breakAfter: idx < totalPages - 1 ? 'page' : 'auto',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {renderPage(pItems, idx, idx === totalPages - 1)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

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
            margin: 0 auto !important;
            display: block !important;
          }
          .invoice-page-sheet {
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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
