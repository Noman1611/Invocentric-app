import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      setLoading(true);
      try {
        const upserts = getSecureStorage('offline_queue_upserts', []);
        const localInvoices = getSecureStorage(`offline_invoices_${user?.uid || 'guest'}`, []);
        let invData: any = null;
        const qi = upserts.find((u: any) => u.collection === 'invoices' && u.item.id === id);
        if (qi) invData = qi.item;
        else if (isOfflineMode) invData = localInvoices.find((i: any) => i.id === id);
        if (!invData && !isOfflineMode) {
          const snap = await getDoc(doc(db, 'invoices', id));
          if (snap.exists()) invData = { id: snap.id, ...snap.data() };
        }
        if (invData) {
          setInvoice(invData);
          if (invData.customer_id) {
            let cust: any = null;
            const qc = upserts.find((u: any) => u.collection === 'customers' && u.item.id === invData.customer_id);
            if (qc) cust = qc.item;
            else if (isOfflineMode) cust = getSecureStorage(`offline_customers_${user?.uid || 'guest'}`, []).find((c: any) => c.id === invData.customer_id);
            else { const s = await getDoc(doc(db, 'customers', invData.customer_id)); if (s.exists()) cust = { id: s.id, ...s.data() }; }
            if (cust) setCustomer(cust);
          }
          if (invData.user_id) {
            let ud: any = null;
            if (isOfflineMode) {
              ud = getSecureStorage(`offline_users_${user?.uid || 'guest'}`, []).find((u: any) => u.id === invData.user_id);
              if (!ud && user?.uid === invData.user_id) {
                const cp = getSecureStorage(`user_profile_${user.uid}`, null);
                ud = cp ? { id: user.uid, ...(typeof cp === 'string' ? JSON.parse(cp) : cp) } : { id: user.uid, displayName: user.displayName, email: user.email };
              }
            } else { const s = await getDoc(doc(db, 'users', invData.user_id)); if (s.exists()) ud = { id: s.id, ...s.data() }; }
            if (ud) setSellerInfo(ud);
          }
        }
      } catch (err) { handleFirestoreError(err, OperationType.GET, `invoices/${id}`); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [id, user, isOfflineMode]);

  const tpl: string = sellerInfo?.invoice_template || invoice?.invoice_template || 'template_01';
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

  // Chunk items: 10 per page for A4, 7 per page for A5 Horizontal
  const itemsPerPage = isA5 ? 7 : 10;
  const itemPages: any[][] = [];
  if (itemRows.length === 0) {
    itemPages.push([]);
  } else {
    for (let i = 0; i < itemRows.length; i += itemsPerPage) {
      itemPages.push(itemRows.slice(i, i + itemsPerPage));
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
        const dataUrl = await toPng(el, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#fff',
          fontEmbedCSS: '',
          skipFonts: true
        });

        if (i > 0) {
          pdf.addPage(pdfFormat, pdfOrientation);
        }

        const pdfWidth = isPOS ? 76.2 : 210;
        const pdfHeight = isPOS ? 180 : (isA5 ? 148 : 297);

        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      pdf.save(`Invoice_${invoice?.invoice_number || invoice?.id?.slice(0, 8) || 'doc'}.pdf`);
    } catch (e) {
      console.error(e);
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
  const QRNode = upiUrl ? <QRCodeSVG value={upiUrl} size={isA5 ? 55 : 78} level="H" /> : <div style={{ width: isA5 ? 55 : 78, height: isA5 ? 55 : 78, border: '1px dashed #999' }} />;
  const termsText = (invoice.terms || sellerInfo?.default_terms || '').split('\n').filter(Boolean);

  // Dynamic column calculations
  const dynamicColCount = 1 + 1 + (colVis.size ? 1 : 0) + (colVis.hsn ? 1 : 0) + 1 + (colVis.mrp ? 1 : 0) + (colVis.discount ? 1 : 0) + (colVis.gstPercent ? 1 : 0) + 1;
  const leftColSpan = 1 + 1 + (colVis.size ? 1 : 0) + (colVis.hsn ? 1 : 0);

  // Template 01 (and default) Page Renderer
  const renderTemplate01Page = (pageItems: any[], pageIdx: number, isLastPage: boolean, startIndex: number) => {
    const blue='#2f6fb0', dark='#1c4a75', lb='#eaf2fb', b=`1px solid ${blue}`;
    return (
      <div className="flex flex-col justify-between" style={{ minHeight: isA5 ? '138mm' : '281mm', fontFamily:'Arial,Helvetica,sans-serif', fontSize: isA5 ? 10 : 12, color:'#1a1a1a' }}>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom: isA5 ? 4 : 8}}>
            <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
              {co.logo&&<img src={co.logo} alt="logo" style={{width: isA5 ? 38 : 55, height: isA5 ? 38 : 55, objectFit:'contain'}}/>}
              <div><p style={{fontSize: isA5 ? 15 : 20,fontWeight:'bold',color:dark,margin:'0 0 1px'}}>{co.name}</p>
                <div style={{fontSize: isA5 ? 9.5 : 11.5, lineHeight:1.25}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/>
              </div>
            </div>
            <div style={{textAlign:'right',fontSize: isA5 ? 9.5 : 11.5}}>
              <div><b>Name</b> : {bu.name}</div>
              <div><b>Phone</b> : {bu.phone}</div>
              <div style={{fontSize: 9.5, color: '#666', marginTop: 1}}>Page {pageIdx + 1} of {totalPages}</div>
            </div>
          </div>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:b,borderBottom:'none',padding:'3px 8px',fontWeight:'bold',fontSize: isA5 ? 10 : 12}}>
            <div>GSTIN : {co.gstin}</div><div style={{fontSize: isA5 ? 12 : 14, color:dark}}>TAX INVOICE</div><div>ORIGINAL FOR RECIPIENT</div>
          </div>

          {/* Clean 2-column Buyer & Meta Grid */}
          <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',border:b,fontSize: isA5 ? 9.5 : 11}}>
            <div style={{padding:'3px 8px',borderRight:b}}>
              <div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-3px -8px 3px',padding:1.5,borderBottom:b}}>Details of Buyer | Billed to :</div>
              {[['Name',bu.name],['Address',bu.address],['Phone',bu.phone],['GSTIN',bu.gstin],['PAN',bu.pan],['Place of Supply',bu.placeOfSupply]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:1}}><div style={{width: isA5 ? 75 : 95,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{v}</div></div>))}
            </div>
            <div style={{padding:'3px 8px'}}>
              <div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-3px -8px 3px',padding:1.5,borderBottom:b}}>Invoice Details :</div>
              {[['Invoice No.',im.invoiceNo],['Invoice Date',im.invoiceDate],['Due Date',im.dueDate],['P.O. No.',im.poNo],['P.O. Date',im.poDate],['E-Way No.',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:1}}><div style={{width: isA5 ? 70 : 85,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1}}>{v}</div></div>))}
            </div>
          </div>

          {/* Dynamic Items Table */}
          <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize: isA5 ? 9.5 : 11}}>
            <thead>
              <tr>
                <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11, width: 35}}>Sr. No.</th>
                <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>Name of Product / Service</th>
                {colVis.size && <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>Size</th>}
                {colVis.hsn && <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>HSN / SAC</th>}
                <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>Qty</th>
                {colVis.mrp && <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>MRP</th>}
                <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>Rate</th>
                {colVis.discount && <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>Disc%</th>}
                {colVis.gstPercent && <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>GST%</th>}
                <th style={{background:lb,border:b,padding: isA5 ? '2.5px 4px' : '4px 6px',fontSize: isA5 ? 9.5 : 11}}>Taxable Value</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((it:any,idx:number)=>(
                <tr key={idx}>
                  <td style={{textAlign:'center',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{startIndex + idx + 1}</td>
                  <td style={{padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>
                    <span style={{fontWeight:'bold'}}>{it.name}</span>
                    {(it.subLines||[]).map((sl:string,si:number)=>(
                      <span key={si} style={{display:'inline-block',marginRight:8,fontStyle:'italic',fontSize: isA5 ? 8.5 : 10,color:'#444',backgroundColor:'#f0f4f9',padding:'0.5px 4px',borderRadius:2,marginTop:1}}>
                        {sl}
                      </span>
                    ))}
                  </td>
                  {colVis.size && <td style={{textAlign:'center',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.size || '---'}</td>}
                  {colVis.hsn && <td style={{textAlign:'center',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.hsn}</td>}
                  <td style={{textAlign:'center',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.qty}</td>
                  {colVis.mrp && <td style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.mrp ? fc(it.mrp,cur) : '---'}</td>}
                  <td style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.price,cur)}</td>
                  {colVis.discount && <td style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.disc ? `${it.disc}%` : '0%'}</td>}
                  {colVis.gstPercent && <td style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.gstPct ? `${it.gstPct}%` : '0%'}</td>}
                  <td style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '5px 6px',borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.taxable,cur)}</td>
                </tr>
              ))}
              {isLastPage && (
                <>
                  <tr>
                    <td colSpan={leftColSpan} style={{padding: isA5 ? '2.5px 4px' : '4px 6px',borderLeft:b,borderRight:b}}></td>
                    <td colSpan={dynamicColCount - leftColSpan - 1} style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '4px 6px',borderLeft:b,borderRight:b}}><b>{isIgst?'IGST':'CGST/SGST'}</b></td>
                    <td style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '4px 6px',borderLeft:b,borderRight:b}}><b>{fc(totalTaxable,cur)}</b><br/><b>{fc(totalTax,cur)}</b></td>
                  </tr>
                  <tr style={{fontWeight:'bold'}}>
                    <td colSpan={leftColSpan} style={{padding: isA5 ? '2.5px 4px' : '4px 6px',borderLeft:b,borderRight:b,borderTop:b}}></td>
                    <td style={{textAlign:'center',padding: isA5 ? '2.5px 4px' : '4px 6px',borderLeft:b,borderRight:b,borderTop:b}}>{qtyTotal}</td>
                    <td colSpan={dynamicColCount - leftColSpan - 2} style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '4px 6px',borderLeft:b,borderRight:b,borderTop:b}}>Total</td>
                    <td style={{textAlign:'right',padding: isA5 ? '2.5px 4px' : '4px 6px',borderLeft:b,borderRight:b,borderTop:b}}>₹ {fc(grandTotal,cur)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Structured Bottom Section */}
        {isLastPage ? (
          <div style={{ marginTop: 'auto' }}>
            <div style={{border:b,borderTop:'none',padding:'3px 8px',fontSize: isA5 ? 9.5 : 11}}>Total in words<br/><b>{safeToWords(grandTotal,cur)}</b></div>
            <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize: isA5 ? 9 : 11}}>
              <thead><tr><th rowSpan={2} style={{border:b,padding:2,background:lb,textAlign:'center'}}>HSN / SAC</th><th rowSpan={2} style={{border:b,padding:2,background:lb,textAlign:'center'}}>Taxable Value</th><th colSpan={2} style={{border:b,padding:2,background:lb,textAlign:'center'}}>{isIgst?'IGST':'Tax'}</th><th rowSpan={2} style={{border:b,padding:2,background:lb,textAlign:'center'}}>Total</th></tr><tr><th style={{border:b,padding:1.5,background:lb}}>%</th><th style={{border:b,padding:1.5,background:lb}}>Amount</th></tr></thead>
              <tbody>{hsnEntries.map(([hsn,d])=>(<tr key={hsn}><td style={{border:b,padding:2}}>{hsn}</td><td style={{border:b,padding:2,textAlign:'right'}}>{fc(d.taxable,cur)}</td><td style={{border:b,padding:2,textAlign:'right'}}>{d.pct}</td><td style={{border:b,padding:2,textAlign:'right'}}>{fc(isIgst?d.igst:d.cgst+d.sgst,cur)}</td><td style={{border:b,padding:2,textAlign:'right'}}>{fc(d.tax,cur)}</td></tr>))}<tr style={{fontWeight:'bold'}}><td style={{border:b,padding:2}}>Total</td><td style={{border:b,padding:2,textAlign:'right'}}>{fc(totalTaxable,cur)}</td><td style={{border:b,padding:2}}></td><td style={{border:b,padding:2,textAlign:'right'}}>{fc(totalTax,cur)}</td><td style={{border:b,padding:2,textAlign:'right'}}>{fc(totalTax,cur)}</td></tr></tbody>
            </table>
            <div style={{border:b,borderTop:'none',padding:'3px 8px',fontSize: isA5 ? 9.5 : 11}}>Total Tax in words: <b>{safeToWords(totalTax,cur)}</b></div>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',border:b,borderTop:'none',fontSize: isA5 ? 9.5 : 11}}>
              <div style={{borderRight:b}}>
                <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:1.5,borderBottom:b}}>Bank Details</div>
                <div style={{display:'flex'}}>
                  <div style={{padding:'3px 6px',flex:1}}>{[['Name',co.bank],['Branch',co.branch],['Acc. Number',co.acc],['IFSC',co.ifsc],['UPI ID',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:1}}><div style={{width: isA5 ? 60 : 75,fontWeight:'bold',flexShrink:0}}>{l}</div><div>{v}</div></div>))}</div>
                  <div style={{width: isA5 ? 75 : 100,padding:3,textAlign:'center',borderLeft:b}}>{QRNode}<div style={{fontSize:8.5,marginTop:1}}>Pay using UPI</div></div>
                </div>
              </div>
              <div style={{padding:'3px 6px',textAlign:'center',fontSize: isA5 ? 9 : 10.5}}>
                <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:1.5,borderBottom:b,margin:'-3px -6px 3px'}}>Certified that particulars are true and correct.</div>
                <div style={{fontWeight:'bold',margin:'2px 0'}}>{co.forCo}</div>
                <div style={{height: isA5 ? 30 : 45}}>{co.sign&&<img src={co.sign} alt="sig" style={{maxHeight: isA5 ? 30 : 45}}/>}</div>
                <div style={{fontWeight:'bold',marginTop:1,borderTop:'1px solid #ccc',paddingTop:1}}>Authorised Signatory</div>
              </div>
            </div>
            <div style={{border:b,borderTop:'none',fontSize: isA5 ? 9 : 10.5}}>
              <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:1.5,borderBottom:b}}>Terms and Conditions</div>
              <div style={{padding:'2px 6px'}}>{termsText.slice(0, 2).map((t:string,i:number)=><div key={i}>{t}</div>)}</div>
            </div>
          </div>
        ) : (
          <div style={{textAlign:'right',fontSize:10,fontWeight:'bold',padding:4,color:dark,border:b,background:lb,marginTop:'auto'}}>
            Continued on Next Page →
          </div>
        )}
      </div>
    );
  };

  // Template 03 Page Renderer
  const renderTemplate03Page = (pageItems: any[], pageIdx: number, isLastPage: boolean, startIndex: number) => {
    const blue='#1a73c7', lb='#e9f2fb';
    return (
      <div className="flex flex-col justify-between" style={{ minHeight: isA5 ? '138mm' : '281mm', fontFamily:'Arial,Helvetica,sans-serif', fontSize: isA5 ? 10 : 12 }}>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:`2px solid ${blue}`,paddingBottom:4,marginBottom:4}}>
            <div><div style={{fontSize: isA5 ? 15 : 19,fontWeight:'bold',color:blue}}>TAX INVOICE</div><div style={{fontSize: isA5 ? 13 : 16,fontWeight:'bold',margin:'1px 0'}}>{co.name}</div><div><b>GSTIN</b> {co.gstin}</div><div style={{fontSize: isA5 ? 9.5 : 11.5,lineHeight:1.25}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/>{co.phone&&<div><b>Phone:</b> {co.phone}</div>}</div>
            <div style={{textAlign:'right'}}><div style={{fontSize:9.5,fontWeight:'bold'}}>ORIGINAL FOR RECIPIENT</div>{co.logo&&<img src={co.logo} alt="logo" style={{width: isA5 ? 38 : 55,height: isA5 ? 38 : 55}}/>}<div style={{fontSize:9.5,color:'#666',marginTop:1}}>Page {pageIdx + 1} of {totalPages}</div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.2fr 1fr',gap:6,borderBottom:`2px solid ${blue}`,paddingBottom:4,marginBottom:4,fontSize: isA5 ? 9.5 : 11}}>
            <div><b style={{display:'block',marginBottom:1}}>Customer Details:</b><div style={{fontWeight:'bold'}}>{bu.name}</div><div>{bu.address}</div><div><b>GSTIN:</b> {bu.gstin}</div><div><b>State:</b> {bu.state}</div></div>
            <div><b style={{display:'block',marginBottom:1}}>Shipping address:</b><div style={{fontWeight:'bold'}}>{sh.name}</div><div>{sh.address}</div><div><b>State:</b> {sh.state}</div></div>
            <div>{[['Invoice #:',im.invoiceNo],['Invoice Date:',im.invoiceDate],['P.O. No.:',im.poNo],['E-Way No.:',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:1}}><div style={{fontWeight:'bold',width: isA5 ? 60 : 75}}>{l}</div><b>{v}</b></div>))}</div>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize: isA5 ? 9.5 : 11}}>
            <thead>
              <tr>
                <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left', width: 35}}>Sr.No.</th>
                <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>Name of Product / Service</th>
                {colVis.size && <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>Size</th>}
                {colVis.hsn && <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>HSN/SAC</th>}
                <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>Qty</th>
                {colVis.mrp && <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>MRP</th>}
                <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>Rate</th>
                {colVis.discount && <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>Disc%</th>}
                {colVis.gstPercent && <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>GST%</th>}
                <th style={{background:blue,color:'#fff',padding: isA5 ? 2.5 : 5,textAlign:'left'}}>Taxable Value</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((it:any,i:number)=>(
                <tr key={i}>
                  <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'center'}}>{startIndex + i + 1}</td>
                  <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd'}}>
                    <span style={{fontWeight:'bold'}}>{it.name}</span>
                    {(it.subLines||[]).map((sl:string,si:number)=>(
                      <span key={si} style={{display:'inline-block',marginRight:8,fontStyle:'italic',fontSize:8.5,color:'#444',backgroundColor:'#eef4fa',padding:'0.5px 4px',borderRadius:2,marginTop:1}}>
                        {sl}
                      </span>
                    ))}
                  </td>
                  {colVis.size && <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.size || '---'}</td>}
                  {colVis.hsn && <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.hsn}</td>}
                  <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.qty}</td>
                  {colVis.mrp && <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'right'}}>{it.mrp ? fc(it.mrp,cur) : '---'}</td>}
                  <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.price,cur)}</td>
                  {colVis.discount && <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'right'}}>{it.disc ? `${it.disc}%` : '0%'}</td>}
                  {colVis.gstPercent && <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'right'}}>{it.gstPct ? `${it.gstPct}%` : '0%'}</td>}
                  <td style={{padding: isA5 ? 2.5 : 5,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.taxable,cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLastPage ? (
          <div style={{ marginTop: 'auto' }}>
            <div style={{display:'flex',justifyContent:'flex-end',gap:25,padding:'2px 0',fontWeight:'bold',fontSize: isA5 ? 9.5 : 11.5}}><span>Taxable Amount</span><b>{fc(totalTaxable,cur)}</b></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:25,padding:'2px 0',fontWeight:'bold',fontSize: isA5 ? 10.5 : 12.5}}><span>Total Amount</span><b>₹ {fc(grandTotal,cur)}</b></div>
            <div style={{fontSize: isA5 ? 9 : 11,margin:'2px 0'}}>Total Items / Qty : {itemRows.length} / {qtyTotal}<br/>Total amount (in words): <b>{safeToWords(grandTotal,cur)}.</b></div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize: isA5 ? 9 : 10.5,marginTop:2}}><thead><tr><th rowSpan={2} style={{border:'1px solid #ccc',padding:1.5,background:lb}}>HSN/SAC</th><th rowSpan={2} style={{border:'1px solid #ccc',padding:1.5,background:lb}}>Taxable Value</th><th colSpan={2} style={{border:'1px solid #ccc',padding:1.5,background:lb}}>{isIgst?'IGST':'Tax'}</th><th rowSpan={2} style={{border:'1px solid #ccc',padding:1.5,background:lb}}>Total</th></tr><tr><th style={{border:'1px solid #ccc',padding:1.5,background:lb}}>%</th><th style={{border:'1px solid #ccc',padding:1.5,background:lb}}>Amount</th></tr></thead><tbody>{hsnEntries.map(([hsn,d])=>(<tr key={hsn}><td style={{border:'1px solid #ccc',padding:1.5}}>{hsn}</td><td style={{border:'1px solid #ccc',padding:1.5,textAlign:'right'}}>{fc(d.taxable,cur)}</td><td style={{border:'1px solid #ccc',padding:1.5,textAlign:'right'}}>{d.pct}</td><td style={{border:'1px solid #ccc',padding:1.5,textAlign:'right'}}>{fc(isIgst?d.igst:d.tax,cur)}</td><td style={{border:'1px solid #ccc',padding:1.5,textAlign:'right'}}>{fc(d.tax,cur)}</td></tr>))}<tr style={{fontWeight:'bold'}}><td style={{border:'1px solid #ccc',padding:1.5}}>Total</td><td style={{border:'1px solid #ccc',padding:1.5,textAlign:'right'}}>{fc(totalTaxable,cur)}</td><td style={{border:'1px solid #ccc',padding:1.5}}></td><td style={{border:'1px solid #ccc',padding:1.5,textAlign:'right'}}>{fc(totalTax,cur)}</td><td style={{border:'1px solid #ccc',padding:1.5,textAlign:'right'}}>{fc(totalTax,cur)}</td></tr></tbody></table>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr 1fr',gap:6,marginTop:4,fontSize: isA5 ? 9 : 10.5,alignItems:'start'}}><div><b>Pay using UPI:</b><br/>{QRNode}</div><div><b>Bank Details:</b>{[['Name:',co.bank],['Branch:',co.branch],['Acc. Number:',co.acc],['IFSC:',co.ifsc],['UPI ID:',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:1}}><div style={{width:55,fontWeight:'bold'}}>{l}</div>{v}</div>))}</div><div style={{textAlign:'center'}}><b>{co.forCo}</b><br/>{co.sign?<img src={co.sign} alt="sig" style={{width:45,opacity:0.7}}/>:<div style={{height:30}}/>}<div>Authorised Signatory</div></div></div>
            <div style={{marginTop:3,fontSize: isA5 ? 8.5 : 10}}><b>Terms &amp; Condition:</b> {termsText.slice(0, 2).join('. ')}</div>
          </div>
        ) : (
          <div style={{textAlign:'right',fontSize:10,fontWeight:'bold',padding:4,color:blue,borderTop:`1px solid ${blue}`,marginTop:'auto'}}>
            Continued on Next Page →
          </div>
        )}
      </div>
    );
  };

  // ── POS Thermal Receipt (T14=wide, T15=narrow)
  const renderPOS = (wide = true) => {
    const maxW = wide ? 380 : 340;
    const div = wide ? '===============TAX INVOICE===============' : '=====TAX INVOICE=====';
    const sep = wide ? '========================================' : '===============';
    return (
      <div className="invoice-page-sheet" style={{fontFamily:`'Courier New',monospace`,fontSize:12,maxWidth:maxW,width:'100%',margin:'0 auto',padding:12,textAlign:'center',background:'#fff'}}>
        <div style={{fontWeight:'bold'}}>{co.name}</div>
        <div style={{fontSize:11}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/><div style={{fontSize:11}}>{co.phone}</div><div style={{fontSize:11}}>GSTIN : {co.gstin}</div>
        <div style={{margin:'6px 0',letterSpacing:-1,fontSize:11}}>{div}</div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}><span>INVOICE #: {im.invoiceNo}</span><span>DATE: {im.invoiceDate}</span></div>
        <div style={{margin:'6px 0',letterSpacing:-1,fontSize:11}}>{wide?'================BILLED TO================':'=====BILLED TO====='}</div>
        <div style={{textAlign:'left',fontSize:11}}>Name : {bu.name}<br/>GSTIN : {bu.gstin}<br/>PAN : {bu.pan}</div>
        <div style={{margin:'6px 0',letterSpacing:-1,fontSize:11}}>{sep}</div>
        <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:11,margin:'4px 0'}}>
          <thead>
            <tr>
              <th style={{borderBottom:'1px solid #000',padding:'2px'}}>Items x Qty<br/>HSN<br/>Rate</th>
              <th style={{borderBottom:'1px solid #000',padding:'2px'}}>Taxable<br/>+ GST</th>
              <th style={{borderBottom:'1px solid #000',padding:'2px',textAlign:'right'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.map((it:any,i:number)=>(
              <tr key={i}>
                <td style={{padding:'2px',verticalAlign:'top'}}>
                  {it.name} x {it.qty}
                  {(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontSize:9,fontStyle:'italic'}}>{sl}</span>)}
                  {colVis.hsn && <span style={{display:'block',fontSize:10}}>HSN : {it.hsn}</span>}
                  <span style={{display:'block',fontSize:10}}>Rate: {fc(it.price,cur)}</span>
                </td>
                <td style={{padding:'2px',verticalAlign:'top',textAlign:'right'}}>{fc(it.taxable,cur)}<br/>+ {it.gstPct} %</td>
                <td style={{padding:'2px',verticalAlign:'top',textAlign:'right'}}>{fc(it.total,cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{margin:'6px 0',letterSpacing:-1,fontSize:11}}>{wide?'================SUMMARY================':'=====SUMMARY====='}</div>
        <div style={{textAlign:'left'}}>{[['Taxable Amount',fc(totalTaxable,cur)],['Add : IGST',fc(totalTax,cur)],['Total Tax',fc(totalTax,cur)],[' Total Amount After Tax',`₹${fc(grandTotal,cur)}`],['GST Payable on Reverse Charge','N.A.']].map(([l,v])=>(<div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:11}}><span>{l}</span><span>{v}</span></div>))}</div>
        <div style={{margin:'6px 0',letterSpacing:-1,fontSize:11}}>{sep}</div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11.5,fontWeight:'bold'}}><span>Grand Total :</span><span>{fc(grandTotal,cur)}</span></div>
        <div style={{margin:'6px 0',letterSpacing:-1,fontSize:11}}>{sep}</div>
        <div style={{marginTop:6}}>{QRNode}<div style={{fontSize:10}}>Pay using UPI</div></div>
      </div>
    );
  };

  const renderPage = (pageItems: any[], pageIdx: number, isLastPage: boolean, startIndex: number) => {
    switch (tpl) {
      case 'template_03':
        return renderTemplate03Page(pageItems, pageIdx, isLastPage, startIndex);
      default:
        return renderTemplate01Page(pageItems, pageIdx, isLastPage, startIndex);
    }
  };

  const sheetWidth = isPOS ? 'auto' : '210mm';
  const sheetMinHeight = isPOS ? 'auto' : (isA5 ? '148mm' : '297mm');
  const sheetPadding = isPOS ? '0' : (isA5 ? '5mm 8mm' : '8mm');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pb-16 print:bg-white print:p-0 print:m-0 print:pb-0">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={() => navigate('/invoices')} className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0"><ArrowLeft size={19} /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-black text-slate-900 truncate leading-none">#{invNo}</h1>
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider', isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{invoice.status || 'Draft'}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{customer?.name || invoice.customer_name || 'Customer'}</p>
            </div>
          </div>

          {/* Page Size Switcher (A4 vs A5 Horizontal) */}
          {!isPOS && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPageSize('A4')}
                className={cn('px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer', pageSize === 'A4' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900')}
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPageSize('A5')}
                className={cn('px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer', pageSize === 'A5' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900')}
              >
                A5 Horizontal
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <button onClick={() => navigate(`/invoices/edit/${invoice.id}`)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"><Edit3 size={15} /><span className="hidden sm:inline">Edit</span></button>
            <button onClick={handleShare} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"><WhatsAppIcon size={15} /><span className="hidden sm:inline">Share</span></button>
            <button onClick={handleDownloadPdf} disabled={downloading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50">{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}<span className="hidden sm:inline">PDF</span></button>
            <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"><Printer size={15} /><span>Print</span></button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl px-2 sm:px-4 mt-4 sm:mt-6 flex flex-col items-center print:max-w-none print:w-full print:p-0 print:m-0 print:block">
        <div ref={invoiceRef} id="invoice-document-canvas" className="flex flex-col items-center gap-6 print:gap-0 print:block">
          {isPOS ? (
            renderPOS(tpl === 'template_14')
          ) : (
            itemPages.map((pItems, idx) => (
              <div
                key={idx}
                className="invoice-page-sheet shadow-md print:shadow-none"
                style={{
                  width: sheetWidth,
                  minHeight: sheetMinHeight,
                  padding: sheetPadding,
                  background: '#fff',
                  boxSizing: 'border-box',
                  margin: '0 auto 16px auto',
                  pageBreakAfter: idx < totalPages - 1 ? 'always' : 'auto',
                  breakAfter: idx < totalPages - 1 ? 'page' : 'auto',
                  position: 'relative'
                }}
              >
                {renderPage(pItems, idx, idx === totalPages - 1, idx * itemsPerPage)}
              </div>
            ))
          )}
        </div>
      </main>

      <WhatsAppShareModal isOpen={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} whatsAppUrl={whatsAppUrlState} whatsAppWebUrl={whatsAppWebUrlState} whatsAppAppUrl={whatsAppAppUrlState} documentTitle="Invoice" copiedToClipboard={copiedToClipboard} fileName={`Invoice_${invoice?.invoice_number || 'bill'}.pdf`} />
      <style>{`
        @media print {
          @page {
            size: ${isPOS ? '76mm 180mm' : (isA5 ? 'A5 landscape' : 'A4 portrait')};
            margin: 0mm;
          }
          *, *:before, *:after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
          body * { visibility: hidden !important; }
          header, nav, aside, footer, button { display: none !important; }
          #invoice-document-canvas, #invoice-document-canvas * { visibility: visible !important; }
          #invoice-document-canvas {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .invoice-page-sheet {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
