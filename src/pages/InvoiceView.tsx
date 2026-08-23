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
  const items = invoice?.items || [];
  const cur = invoice?.currency || 'INR';

  const itemRows = items.map((i: any) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.price || i.mrp) || 0;
    const disc = Number(i.discount) || 0;
    const gstPct = Number(i.gstPercent || i.gst_rate) || 0;
    const taxable = qty * price * (1 - disc / 100);
    const gstAmt = taxable * gstPct / 100;
    return { ...i, qty, price, disc, gstPct, taxable, gstAmt, total: taxable + gstAmt,
      hsn: i.hsn_code || i.hsn || '---',
      name: i.description || i.name || 'Item',
      subLines: i.subLines || (i.serial_numbers ? i.serial_numbers.map((s: any) => `SR/No: ${s}`) : []) };
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

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || downloading) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      const dataUrl = await toPng(invoiceRef.current, { quality: 1, pixelRatio: 2, backgroundColor: '#fff', fontEmbedCSS: '', skipFonts: true });
      const img = new Image(); img.src = dataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const wMm = isPOS ? 76.2 : 210, hMm = isPOS ? Math.max(50.8, (img.height * 76.2) / img.width) : 297;
      const pdf = new jsPDF({ unit: 'mm', format: isPOS ? [wMm, hMm] : 'a4', orientation: 'portrait', compress: true });
      pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, wMm, hMm, 'F');
      pdf.addImage(dataUrl, 'PNG', 0, 0, wMm, Math.min(hMm, (img.height * wMm) / img.width));
      pdf.save(`Invoice_${invoice?.invoice_number || invoice?.id?.slice(0, 8) || 'doc'}.pdf`);
    } catch (_) { window.print(); } finally { setDownloading(false); }
  };

  const handleShare = async () => {
    const invNum = invoice?.invoice_number || invoice?.id?.slice(0, 8)?.toUpperCase();
    const custName = customer?.name || invoice?.customer_name || 'Customer';
    const shareText = `Dear ${custName}, here is your invoice #${invNum} of ${fc(grandTotal, cur)} from ${sellerInfo?.business_name || 'our store'}. Thank you for your business!`;
    if (navigator.share) { try { await navigator.share({ title: `Invoice #${invNum}`, text: shareText, url: window.location.href }); return; } catch (_) {} }
    const cp = normalizePhoneNumber(customer?.phone || '');
    const enc = encodeURIComponent(shareText);
    setWhatsAppUrlState(`https://wa.me/${cp}?text=${enc}`);
    setWhatsAppWebUrlState(`https://web.whatsapp.com/send?phone=${cp}&text=${enc}`);
    setWhatsAppAppUrlState(`whatsapp://send?phone=${cp}&text=${enc}`);
    setShowWhatsAppModal(true); setCopiedToClipboard(true);
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
  const QRNode = upiUrl ? <QRCodeSVG value={upiUrl} size={80} level="H" /> : <div style={{ width: 80, height: 80, border: '1px dashed #999' }} />;
  const termsText = (invoice.terms || sellerInfo?.default_terms || '').split('\n').filter(Boolean);

  // ── T01: Blue Bordered Classic
  const T01 = () => { const blue='#2f6fb0',dark='#1c4a75',lb='#eaf2fb',b=`1px solid ${blue}`; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:13,color:'#1a1a1a'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          {co.logo&&<img src={co.logo} alt="logo" style={{width:60,height:60,objectFit:'contain'}}/>}
          <div><p style={{fontSize:22,fontWeight:'bold',color:dark,margin:'0 0 4px'}}>{co.name}</p>
            <div style={{fontSize:12,lineHeight:1.4}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/>
          </div>
        </div>
        <div style={{textAlign:'right',fontSize:12}}><div><b>Name</b> : {bu.name}</div><div><b>Phone</b> : {bu.phone}</div></div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:b,borderBottom:'none',padding:'6px 10px',fontWeight:'bold',fontSize:13}}>
        <div>GSTIN : {co.gstin}</div><div style={{fontSize:15,color:dark}}>TAX INVOICE</div><div>ORIGINAL FOR RECIPIENT</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.15fr 1.15fr 1fr',border:b,fontSize:12}}>
        <div style={{padding:'6px 8px',borderRight:b}}>
          <div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-6px -8px 6px',padding:4,borderBottom:b}}>Details of Buyer | Billed to :</div>
          {[['Name',bu.name],['Address',bu.address],['Phone',bu.phone],['GSTIN',bu.gstin],['PAN',bu.pan],['Place of Supply',bu.placeOfSupply]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:75,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1}}>{v}</div></div>))}
        </div>
        <div style={{padding:'6px 8px',borderRight:b}}>
          <div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-6px -8px 6px',padding:4,borderBottom:b}}>Details of Consignee | Shipped to :</div>
          {[['Name',sh.name],['Address',sh.address],['Country',sh.country],['Phone',sh.phone],['GSTIN',sh.gstin],['State',sh.state]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:75,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1}}>{v}</div></div>))}
        </div>
        <div style={{padding:'6px 8px'}}>
          {[['Invoice No.',im.invoiceNo],['Invoice Date',im.invoiceDate],['Due Date',im.dueDate],['P.O. No.',im.poNo],['P.O. Date',im.poDate],['E-Way No.',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:85,flexShrink:0,fontWeight:'bold'}}>{l}</div><div style={{flex:1}}>{v}</div></div>))}
        </div>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize:12}}>
        <thead><tr>{['Sr. No.','Name of Product / Service','HSN / SAC','Qty','Rate','Taxable Value'].map(h=><th key={h} style={{background:lb,border:b,padding:5,fontSize:12}}>{h}</th>)}</tr></thead>
        <tbody>
          {itemRows.map((it:any,idx:number)=>(<tr key={idx}>
            <td style={{textAlign:'center',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{idx+1}</td>
            <td style={{padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}><span style={{fontWeight:'bold'}}>{it.name}</span>{(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontStyle:'italic',fontSize:11,color:'#333'}}>{sl}</span>)}</td>
            <td style={{textAlign:'center',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.hsn}</td>
            <td style={{textAlign:'center',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.qty}</td>
            <td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.price,cur)}</td>
            <td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.taxable,cur)}</td>
          </tr>))}
          <tr><td colSpan={4} style={{padding:5,borderLeft:b,borderRight:b}}></td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b}}><b>{isIgst?'IGST':'CGST/SGST'}</b></td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b}}><b>{fc(totalTaxable,cur)}</b><br/><b>{fc(totalTax,cur)}</b></td></tr>
          <tr style={{fontWeight:'bold'}}><td colSpan={3} style={{padding:5,borderLeft:b,borderRight:b,borderTop:b}}></td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>Total</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>{qtyTotal}</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>₹ {fc(grandTotal,cur)}</td></tr>
        </tbody>
      </table>
      <div style={{border:b,borderTop:'none',padding:'6px 10px',fontSize:12}}>Total in words<br/><b>{safeToWords(grandTotal,cur)}</b></div>
      <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize:12}}>
        <thead><tr><th rowSpan={2} style={{border:b,padding:5,background:lb,textAlign:'center'}}>HSN / SAC</th><th rowSpan={2} style={{border:b,padding:5,background:lb,textAlign:'center'}}>Taxable Value</th><th colSpan={2} style={{border:b,padding:5,background:lb,textAlign:'center'}}>{isIgst?'IGST':'Tax'}</th><th rowSpan={2} style={{border:b,padding:5,background:lb,textAlign:'center'}}>Total</th></tr><tr><th style={{border:b,padding:5,background:lb}}>%</th><th style={{border:b,padding:5,background:lb}}>Amount</th></tr></thead>
        <tbody>{hsnEntries.map(([hsn,d])=>(<tr key={hsn}><td style={{border:b,padding:5}}>{hsn}</td><td style={{border:b,padding:5,textAlign:'right'}}>{fc(d.taxable,cur)}</td><td style={{border:b,padding:5,textAlign:'right'}}>{d.pct}</td><td style={{border:b,padding:5,textAlign:'right'}}>{fc(isIgst?d.igst:d.cgst+d.sgst,cur)}</td><td style={{border:b,padding:5,textAlign:'right'}}>{fc(d.tax,cur)}</td></tr>))}<tr style={{fontWeight:'bold'}}><td style={{border:b,padding:5}}>Total</td><td style={{border:b,padding:5,textAlign:'right'}}>{fc(totalTaxable,cur)}</td><td style={{border:b,padding:5}}></td><td style={{border:b,padding:5,textAlign:'right'}}>{fc(totalTax,cur)}</td><td style={{border:b,padding:5,textAlign:'right'}}>{fc(totalTax,cur)}</td></tr></tbody>
      </table>
      <div style={{border:b,borderTop:'none',padding:'6px 10px',fontSize:12}}>Total Tax in words: <b>{safeToWords(totalTax,cur)}</b></div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',border:b,borderTop:'none',fontSize:12}}>
        <div style={{borderRight:b}}>
          <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:4,borderBottom:b}}>Bank Details</div>
          <div style={{display:'flex'}}>
            <div style={{padding:'6px 8px',flex:1}}>{[['Name',co.bank],['Branch',co.branch],['Acc. Number',co.acc],['IFSC',co.ifsc],['UPI ID',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:3}}><div style={{width:80,fontWeight:'bold',flexShrink:0}}>{l}</div><div>{v}</div></div>))}</div>
            <div style={{width:110,padding:6,textAlign:'center',borderLeft:b}}>{QRNode}<div style={{fontSize:10,marginTop:2}}>Pay using UPI</div></div>
          </div>
        </div>
        <div style={{padding:'6px 8px',textAlign:'center',fontSize:11}}>
          <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:4,borderBottom:b,margin:'-6px -8px 6px'}}>Certified that the particulars given above are true and correct.</div>
          <div style={{fontWeight:'bold',margin:'6px 0'}}>{co.forCo}</div>
          <div style={{height:55}}>{co.sign&&<img src={co.sign} alt="sig" style={{maxHeight:55}}/>}</div>
          <div style={{fontWeight:'bold',marginTop:4,borderTop:'1px solid #ccc',paddingTop:4}}>Authorised Signatory</div>
        </div>
      </div>
      <div style={{border:b,borderTop:'none',fontSize:12}}>
        <div style={{fontWeight:'bold',textAlign:'center',background:lb,padding:4,borderBottom:b}}>Terms and Conditions</div>
        <div style={{padding:'6px 10px'}}>{termsText.map((t:string,i:number)=><div key={i}>{t}</div>)}</div>
      </div>
    </div>
  ); };

  // ── T02: Blue Bordered + per-line IGST + Summary Box
  const T02 = () => { const dark='#1c4a75',lb='#eaf2fb',b='1px solid #2f6fb0'; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:12.5,color:'#1a1a1a'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div style={{display:'flex',gap:12}}>{co.logo&&<img src={co.logo} alt="logo" style={{width:56,height:56,objectFit:'contain'}}/>}<div><p style={{fontSize:20,fontWeight:'bold',color:dark,margin:'0 0 4px'}}>{co.name}</p><div style={{fontSize:12,lineHeight:1.4}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/></div></div>
        <div style={{textAlign:'right',fontSize:12}}><div><b>Name</b> : {bu.name}</div><div><b>Phone</b> : {bu.phone}</div></div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:b,borderBottom:'none',padding:'6px 10px',fontWeight:'bold'}}><div>GSTIN : {co.gstin}</div><div style={{fontSize:15,color:dark}}>TAX INVOICE</div><div>ORIGINAL FOR RECIPIENT</div></div>
      <div style={{display:'grid',gridTemplateColumns:'1.15fr 1.15fr 1fr',border:b,fontSize:12}}>
        <div style={{padding:'6px 8px',borderRight:b}}><div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-6px -8px 6px',padding:4,borderBottom:b}}>Details of Buyer | Billed to :</div>{[['Name',bu.name],['Address',bu.address],['Phone',bu.phone],['GSTIN',bu.gstin],['PAN',bu.pan],['Place of Supply',bu.placeOfSupply]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:80,flexShrink:0,fontWeight:'bold'}}>{l}</div><div>{v}</div></div>))}</div>
        <div style={{padding:'6px 8px',borderRight:b}}><div style={{fontWeight:'bold',textAlign:'center',background:lb,margin:'-6px -8px 6px',padding:4,borderBottom:b}}>Details of Consignee | Shipped to :</div>{[['Name',sh.name],['Address',sh.address],['Country',sh.country],['Phone',sh.phone],['GSTIN',sh.gstin],['State',sh.state]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:80,flexShrink:0,fontWeight:'bold'}}>{l}</div><div>{v}</div></div>))}</div>
        <div style={{padding:'6px 8px'}}>{[['Invoice No.',im.invoiceNo],['Invoice Date',im.invoiceDate],['Due Date',im.dueDate],['P.O. No.',im.poNo],['P.O. Date',im.poDate],['E-Way No.',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:80,flexShrink:0,fontWeight:'bold'}}>{l}</div><div>{v}</div></div>))}</div>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize:12}}>
        <thead><tr>{['Sr.No.','Name of Product / Service','HSN/SAC','Qty','Rate','Taxable Value','IGST','Total'].map(h=><th key={h} style={{background:lb,border:b,padding:5}}>{h}</th>)}</tr></thead>
        <tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{textAlign:'center',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{i+1}</td><td style={{padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}><span style={{fontWeight:'bold'}}>{it.name}</span>{(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontStyle:'italic',fontSize:11}}>{sl}</span>)}</td><td style={{textAlign:'center',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.hsn}</td><td style={{textAlign:'center',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{it.qty}</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.price,cur)}</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.taxable,cur)}</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.gstAmt,cur)}<br/><span style={{fontStyle:'italic',fontSize:11}}>{it.gstPct}%</span></td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderBottom:'1px solid #dce6f0'}}>{fc(it.total,cur)}</td></tr>))}<tr style={{fontWeight:'bold'}}><td colSpan={3} style={{padding:5,borderLeft:b,borderRight:b,borderTop:b}}></td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>Total</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>{qtyTotal}</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>{fc(totalTaxable,cur)}</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>{fc(totalTax,cur)}</td><td style={{textAlign:'right',padding:5,borderLeft:b,borderRight:b,borderTop:b}}>{fc(grandTotal,cur)}</td></tr></tbody>
      </table>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',border:b,borderTop:'none',fontSize:12}}><div style={{padding:8,borderRight:b}}>Total in words<br/><b>{safeToWords(grandTotal,cur)}</b></div><div>{[['Taxable Amount',fc(totalTaxable,cur)],['Add : IGST',fc(totalTax,cur)],['Total Tax',fc(totalTax,cur)],[' Total Amount After Tax',`₹${fc(grandTotal,cur)}`]].map(([l,v])=>(<div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 8px',borderBottom:b}}><span>{l}</span><b>{v}</b></div>))}</div></div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',border:b,borderTop:'none',fontSize:12}}>
        <div style={{borderRight:b,display:'flex'}}><div style={{padding:'6px 8px',flex:1}}><div style={{fontWeight:'bold',marginBottom:4}}>Bank Details</div>{[['Name',co.bank],['Branch',co.branch],['Acc. Number',co.acc],['IFSC',co.ifsc],['UPI ID',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:3}}><div style={{width:80,fontWeight:'bold',flexShrink:0}}>{l}</div><div>{v}</div></div>))}<div style={{fontWeight:'bold',marginTop:8}}>Terms and Conditions</div>{termsText.map((t:string,i:number)=><div key={i}>{t}</div>)}</div><div style={{width:110,padding:6,textAlign:'center',borderLeft:b}}>{QRNode}<div style={{fontSize:10,marginTop:2}}>Pay using UPI</div></div></div>
        <div style={{padding:'6px 8px',textAlign:'center',fontSize:11}}><div>Certified that the particulars given above are true and correct.</div><div style={{fontWeight:'bold',marginTop:6}}>{co.forCo}</div>{co.sign&&<img src={co.sign} alt="sig" style={{maxHeight:40,marginTop:8}}/>}<div style={{fontWeight:'bold',marginTop:30,borderTop:'1px solid #ccc',paddingTop:4}}>Authorised Signatory</div></div>
      </div>
    </div>
  ); };

  // ── T03: Blue Line, Company Left, Logo Right
  const T03 = () => { const blue='#1a73c7',lb='#e9f2fb'; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:12.5}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:`2px solid ${blue}`,paddingBottom:10,marginBottom:10}}>
        <div><div style={{fontSize:20,fontWeight:'bold',color:blue}}>TAX INVOICE</div><div style={{fontSize:17,fontWeight:'bold',margin:'4px 0 2px'}}>{co.name}</div><div><b>GSTIN</b> {co.gstin}</div><div style={{fontSize:12,lineHeight:1.4}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/>{co.phone&&<div><b>Phone:</b> {co.phone}</div>}{co.email&&<div><b>Email:</b> {co.email}</div>}</div>
        <div style={{textAlign:'right'}}><div style={{fontSize:11,fontWeight:'bold'}}>ORIGINAL FOR RECIPIENT</div>{co.logo&&<img src={co.logo} alt="logo" style={{width:60,height:60}}/>}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.2fr 1fr',gap:10,borderBottom:`2px solid ${blue}`,paddingBottom:10,marginBottom:10,fontSize:12}}>
        <div><b style={{display:'block',marginBottom:3}}>Customer Details:</b><div style={{fontWeight:'bold'}}>{bu.name}</div><div>{bu.address}</div><div><b>GSTIN:</b> {bu.gstin}</div><div><b>PAN:</b> {bu.pan}</div><div><b>State:</b> {bu.state}</div><div><b>Place of Supply:</b> {bu.placeOfSupply}</div></div>
        <div><b style={{display:'block',marginBottom:3}}>Shipping address:</b><div style={{fontWeight:'bold'}}>{sh.name}</div><div>{sh.address}</div><div><b>State:</b> {sh.state}</div></div>
        <div>{[['Invoice #:',im.invoiceNo],['Invoice Date:',im.invoiceDate],['P.O. No.:',im.poNo],['P.O. Date:',im.poDate],['E-Way No.:',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{fontWeight:'bold',width:75}}>{l}</div><b>{v}</b></div>))}</div>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Sr.No.','Name of Product / Service','HSN/SAC','Qty','Rate','Taxable Value'].map(h=><th key={h} style={{background:blue,color:'#fff',padding:6,textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'center'}}>{i+1}</td><td style={{padding:6,borderBottom:'1px solid #ddd'}}><span style={{fontWeight:'bold'}}>{it.name}</span>{(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontStyle:'italic',fontSize:11,color:'#333'}}>{sl}</span>)}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.hsn}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.qty}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.price,cur)}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.taxable,cur)}</td></tr>))}</tbody></table>
      <div style={{display:'flex',justifyContent:'flex-end',gap:40,padding:'6px 0',fontWeight:'bold'}}><span>Taxable Amount</span><b>{fc(totalTaxable,cur)}</b></div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:40,padding:'6px 0',fontWeight:'bold'}}><span>Total Amount</span><b>₹ {fc(grandTotal,cur)}</b></div>
      <div style={{fontSize:12,margin:'6px 0'}}>Total Items / Qty : {itemRows.length} / {qtyTotal}<br/>Total amount (in words): <b>{safeToWords(grandTotal,cur)}.</b></div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,marginTop:6}}><thead><tr><th rowSpan={2} style={{border:'1px solid #ccc',padding:5,background:lb}}>HSN/SAC</th><th rowSpan={2} style={{border:'1px solid #ccc',padding:5,background:lb}}>Taxable Value</th><th colSpan={2} style={{border:'1px solid #ccc',padding:5,background:lb}}>{isIgst?'IGST':'Tax'}</th><th rowSpan={2} style={{border:'1px solid #ccc',padding:5,background:lb}}>Total</th></tr><tr><th style={{border:'1px solid #ccc',padding:5,background:lb}}>%</th><th style={{border:'1px solid #ccc',padding:5,background:lb}}>Amount</th></tr></thead><tbody>{hsnEntries.map(([hsn,d])=>(<tr key={hsn}><td style={{border:'1px solid #ccc',padding:5}}>{hsn}</td><td style={{border:'1px solid #ccc',padding:5,textAlign:'right'}}>{fc(d.taxable,cur)}</td><td style={{border:'1px solid #ccc',padding:5,textAlign:'right'}}>{d.pct}</td><td style={{border:'1px solid #ccc',padding:5,textAlign:'right'}}>{fc(isIgst?d.igst:d.tax,cur)}</td><td style={{border:'1px solid #ccc',padding:5,textAlign:'right'}}>{fc(d.tax,cur)}</td></tr>))}<tr style={{fontWeight:'bold'}}><td style={{border:'1px solid #ccc',padding:5}}>Total</td><td style={{border:'1px solid #ccc',padding:5,textAlign:'right'}}>{fc(totalTaxable,cur)}</td><td style={{border:'1px solid #ccc',padding:5}}></td><td style={{border:'1px solid #ccc',padding:5,textAlign:'right'}}>{fc(totalTax,cur)}</td><td style={{border:'1px solid #ccc',padding:5,textAlign:'right'}}>{fc(totalTax,cur)}</td></tr></tbody></table>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr 1fr',gap:14,marginTop:14,fontSize:12,alignItems:'start'}}><div><b>Pay using UPI:</b><br/>{QRNode}</div><div><b>Bank Details:</b>{[['Name:',co.bank],['Branch:',co.branch],['Acc. Number:',co.acc],['IFSC:',co.ifsc],['UPI ID:',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:70,fontWeight:'bold'}}>{l}</div>{v}</div>))}</div><div style={{textAlign:'center'}}><b>{co.forCo}</b><br/>{co.sign?<img src={co.sign} alt="sig" style={{width:60,opacity:0.7}}/>:<div style={{height:50}}/>}<div>Authorised Signatory</div></div></div>
      <div style={{marginTop:14,fontSize:12}}><b>Terms &amp; Condition:</b><br/>{termsText.join('. ')}</div>
    </div>
  ); };

  // ── T04: Blue Line Top + IGST% & Amount columns
  const T04 = () => { const blue='#1a73c7'; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:12.5}}>
      <div style={{display:'flex',justifyContent:'space-between',borderBottom:`2px solid ${blue}`,paddingBottom:10,marginBottom:10}}>
        <div style={{display:'flex',gap:10}}>{co.logo&&<img src={co.logo} alt="logo" style={{width:56,height:56}}/>}<div><div style={{fontSize:19,fontWeight:'bold'}}>{co.name}</div><div style={{fontSize:12,lineHeight:1.4}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/><div><b>GSTIN</b> {co.gstin}</div>{co.phone&&<div><b>Phone</b> {co.phone}</div>}</div></div>
        <div><div style={{fontSize:19,fontWeight:'bold',color:blue,textAlign:'right'}}>TAX INVOICE</div><div style={{textAlign:'right',fontSize:12}}><b>Invoice #:</b> {im.invoiceNo}<br/><b>Invoice Date:</b> {im.invoiceDate}</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.2fr 1fr',gap:10,borderBottom:`2px solid ${blue}`,paddingBottom:10,marginBottom:10,fontSize:12}}><div><div style={{fontWeight:'bold'}}>Customer Details:</div><div style={{fontWeight:'bold'}}>{bu.name}</div><div>{bu.address}</div><div>GSTIN: {bu.gstin}</div><div>PAN: {bu.pan}</div><div>State: {bu.state}</div><div>Place of Supply: {bu.placeOfSupply}</div></div><div><div style={{fontWeight:'bold'}}>Shipping address:</div><div style={{fontWeight:'bold'}}>{sh.name}</div><div>{sh.address}</div><div>State: {sh.state}</div></div><div>{[['P.O. No.:',im.poNo],['P.O. Date:',im.poDate],['E-Way No.:',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:75,fontWeight:'bold'}}>{l}</div>{v}</div>))}</div></div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Sr.No.','Name of Product / Service','HSN/SAC','Rate','Qty','Taxable Value','IGST%','Amount','Total'].map(h=><th key={h} style={{background:blue,color:'#fff',padding:6,textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'center'}}>{i+1}</td><td style={{padding:6,borderBottom:'1px solid #ddd'}}><span style={{fontWeight:'bold'}}>{it.name}</span>{(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontStyle:'italic',fontSize:11,color:'#333'}}>{sl}</span>)}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.hsn}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.price,cur)}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.qty}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.taxable,cur)}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'right'}}>{it.gstPct}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.gstAmt,cur)}</td><td style={{padding:6,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.total,cur)}</td></tr>))}</tbody></table>
      <div style={{display:'flex',justifyContent:'flex-end',gap:40,padding:'4px 0',fontWeight:'bold'}}><span>Taxable Amount</span><b>₹{fc(totalTaxable,cur)}</b></div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:40,padding:'4px 0',fontWeight:'bold'}}><span>Total Amount</span><b>₹{fc(grandTotal,cur)}</b></div>
      <div style={{fontSize:12,margin:'6px 0',display:'flex',justifyContent:'space-between'}}><span>Total Items / Qty : {itemRows.length} / {qtyTotal}</span><span>Total amount (in words): <b>{safeToWords(grandTotal,cur)}.</b></span></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr 1fr',gap:14,marginTop:10,fontSize:12}}><div><b>Pay using UPI:</b><br/>{QRNode}</div><div><b>Bank Details:</b>{[['Name:',co.bank],['Branch:',co.branch],['Acc. Number:',co.acc],['IFSC:',co.ifsc],['UPI ID:',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:70,fontWeight:'bold'}}>{l}</div>{v}</div>))}</div><div style={{textAlign:'center'}}><b>{co.forCo}</b><br/>{co.sign?<img src={co.sign} alt="sig" style={{width:55,opacity:0.7}}/>:<div style={{height:50}}/>}<div>Authorised Signatory</div></div></div>
      <div style={{marginTop:12,fontSize:12}}><b>Terms and Conditions:</b><br/>{termsText.join('. ')}</div>
    </div>
  ); };

  // ── T07: Full Bordered CGST/SGST with footer
  const T07 = () => { const blue='#1a56a0',lb='#eaf2fb',b=`1px solid ${blue}`; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:12,border:b}}>
      <div style={{textAlign:'center',fontWeight:'bold',fontSize:16,color:blue,borderBottom:b,padding:6,position:'relative'}}>TAX INVOICE<span style={{position:'absolute',right:10,top:8,fontSize:11}}>ORIGINAL FOR RECIPIENT</span></div>
      <div style={{display:'grid',gridTemplateColumns:'1.6fr 1fr 1fr',borderBottom:b}}>
        <div style={{padding:'6px 8px',borderRight:b,fontSize:11}}>{co.logo&&<img src={co.logo} alt="logo" style={{width:44,height:44,float:'left',marginRight:8}}/>}<div style={{fontWeight:'bold',fontSize:15}}>{co.name}</div><div dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/><div>GSTIN : {co.gstin}</div></div>
        <div style={{padding:'6px 8px',borderRight:b,fontSize:11}}><div style={{fontWeight:'bold'}}>Invoice No.</div>{im.invoiceNo}<div style={{fontWeight:'bold',marginTop:6}}>P.O. No.</div>{im.poNo}<div style={{fontWeight:'bold',marginTop:6}}>Due Date</div>{im.dueDate}</div>
        <div style={{padding:'6px 8px',fontSize:11}}><div style={{fontWeight:'bold'}}>Invoice Date</div>{im.invoiceDate}<div style={{fontWeight:'bold',marginTop:6}}>P.O. Date</div>{im.poDate}<div style={{fontWeight:'bold',marginTop:6}}>E-Way No.</div>{im.eWayNo}</div>
      </div>
      <div style={{borderBottom:b}}><div style={{padding:'6px 8px',borderBottom:b,fontSize:11}}><span style={{fontWeight:'bold'}}>Details of Buyer | Billed to :</span><br/><span style={{fontWeight:'bold'}}>{bu.name}</span><br/>{bu.address}<br/>GSTIN: {bu.gstin} &nbsp; PAN: {bu.pan}<br/>Place of Supply: {bu.placeOfSupply}</div><div style={{padding:'6px 8px',fontSize:11}}><span style={{fontWeight:'bold'}}>Details of Consignee | Shipped to :</span><br/><span style={{fontWeight:'bold'}}>{sh.name}</span><br/>{sh.address}<br/>Country: {sh.country} &nbsp; State: {sh.state}</div></div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr>{['Sr.No.','Name of Product / Service','HSN/SAC','Qty','Rate','Taxable Value'].map(h=><th key={h} style={{border:b,background:lb,padding:4}}>{h}</th>)}</tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{border:b,padding:4,textAlign:'center'}}>{i+1}</td><td style={{border:b,padding:4,fontWeight:'bold'}}>{it.name}</td><td style={{border:b,padding:4,textAlign:'center'}}>{it.hsn}</td><td style={{border:b,padding:4,textAlign:'center'}}>{it.qty}</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(it.price,cur)}</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(it.taxable,cur)}</td></tr>))}<tr><td colSpan={4} style={{border:b,padding:4}}></td><td style={{border:b,padding:4,textAlign:'right'}}>CGST<br/>SGST</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(cgstTotal,cur)}<br/>{fc(sgstTotal,cur)}</td></tr><tr><td colSpan={3} style={{border:b,padding:4}}></td><td style={{border:b,padding:4,textAlign:'right'}}><b>Total</b></td><td style={{border:b,padding:4,textAlign:'right'}}><b>{qtyTotal}</b></td><td style={{border:b,padding:4,textAlign:'right'}}><b>₹{fc(grandTotal,cur)}</b></td></tr></tbody></table>
      <div style={{borderTop:b,padding:'6px 8px',fontSize:11}}>Total in words<br/><b>{safeToWords(grandTotal,cur).toUpperCase()}</b></div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr><th rowSpan={2} style={{border:b,padding:4}}>HSN/SAC</th><th rowSpan={2} style={{border:b,padding:4}}>Taxable Value</th><th colSpan={2} style={{border:b,padding:4}}>CGST</th><th colSpan={2} style={{border:b,padding:4}}>SGST</th><th rowSpan={2} style={{border:b,padding:4}}>Total</th></tr><tr><th style={{border:b,padding:4}}>%</th><th style={{border:b,padding:4}}>Amount</th><th style={{border:b,padding:4}}>%</th><th style={{border:b,padding:4}}>Amount</th></tr></thead><tbody>{hsnEntries.map(([hsn,d])=>(<tr key={hsn}><td style={{border:b,padding:4}}>{hsn}</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(d.taxable,cur)}</td><td style={{border:b,padding:4,textAlign:'right'}}>{d.pct/2}</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(d.cgst,cur)}</td><td style={{border:b,padding:4,textAlign:'right'}}>{d.pct/2}</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(d.sgst,cur)}</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(d.tax,cur)}</td></tr>))}<tr style={{fontWeight:'bold'}}><td style={{border:b,padding:4}}>Total</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(totalTaxable,cur)}</td><td style={{border:b,padding:4}}></td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(cgstTotal,cur)}</td><td style={{border:b,padding:4}}></td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(sgstTotal,cur)}</td><td style={{border:b,padding:4,textAlign:'right'}}>{fc(totalTax,cur)}</td></tr></tbody></table>
      <div style={{borderTop:b,padding:'6px 8px',fontSize:11}}>Total Tax in words: <b>{safeToWords(totalTax,cur).toUpperCase()}</b></div>
      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',borderTop:b}}><div style={{padding:'6px 8px',fontSize:11,borderRight:b}}><b>Terms and Conditions</b><br/>{termsText.join('. ')}</div><div><div style={{padding:'6px 8px',fontSize:11,display:'flex',justifyContent:'space-between'}}><div><b>Bank Details</b><br/>Name {co.bank}<br/>Branch {co.branch}<br/>Acc. Number {co.acc}<br/>IFSC {co.ifsc}<br/>UPI ID {co.upi}</div><div>{QRNode}<div style={{fontSize:10}}>Pay using UPI</div></div></div><div style={{textAlign:'center',padding:'6px 8px',fontSize:11,borderTop:b}}>{co.forCo}<br/><br/>Authorised Signatory</div></div></div>
    </div>
  ); };

  // ── T08: Company right-aligned, Bill of Supply
  const T08 = () => { const blue='#1a73c7'; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:12}}>
      <div style={{display:'flex',justifyContent:'space-between',borderBottom:`2px solid ${blue}`,paddingBottom:10,marginBottom:10}}><div style={{display:'flex',gap:10}}>{co.logo&&<img src={co.logo} alt="logo" style={{width:56,height:56}}/>}<div></div></div><div style={{textAlign:'right'}}><div style={{fontSize:18,fontWeight:'bold'}}>{co.name}</div><div style={{fontSize:11.5,lineHeight:1.4}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/><div><b>GSTIN</b> {co.gstin}</div></div></div>
      <div style={{fontSize:18,fontWeight:'bold',color:blue,textAlign:'center',borderBottom:`2px solid ${blue}`,paddingBottom:10,marginBottom:10}}>TAX INVOICE</div>
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.2fr 1fr',gap:12,borderBottom:`2px solid ${blue}`,paddingBottom:10,marginBottom:10,fontSize:11.5}}><div><div style={{fontWeight:'bold'}}>Details of Buyer | Billed to :</div><div style={{fontWeight:'bold'}}>{bu.name}</div><div>{bu.address}</div><div>GSTIN: {bu.gstin}</div><div>PAN: {bu.pan}</div><div>State: {bu.state}</div></div><div><div style={{fontWeight:'bold'}}>Details of Consignee | Shipped to :</div><div style={{fontWeight:'bold'}}>{sh.name}</div><div>{sh.address}</div><div>State: {sh.state}</div></div><div>{[['Invoice #:',im.invoiceNo],['Invoice Date:',im.invoiceDate],['Due Date:',im.dueDate]].map(([l,v])=>(<div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><b>{l}</b><span>{v}</span></div>))}</div></div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11.5}}><thead><tr>{['Sr.No.','Name of Product / Service','HSN/SAC','Qty','MRP','Rate','Taxable Value'].map(h=><th key={h} style={{background:blue,color:'#fff',padding:5,textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{padding:5,borderBottom:'1px solid #ddd',textAlign:'center'}}>{i+1}</td><td style={{padding:5,borderBottom:'1px solid #ddd'}}><span style={{fontWeight:'bold'}}>{it.name}</span>{(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontStyle:'italic',fontSize:11}}>{sl}</span>)}</td><td style={{padding:5,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.hsn}</td><td style={{padding:5,borderBottom:'1px solid #ddd',textAlign:'center'}}>{it.qty}</td><td style={{padding:5,borderBottom:'1px solid #ddd',textAlign:'right'}}>0</td><td style={{padding:5,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.price,cur)}</td><td style={{padding:5,borderBottom:'1px solid #ddd',textAlign:'right'}}>{fc(it.taxable,cur)}</td></tr>))}</tbody></table>
      <div style={{display:'flex',justifyContent:'flex-end',gap:40,padding:'3px 0'}}><span>Taxable Amount</span><b style={{marginLeft:8}}>{fc(totalTaxable,cur)}</b></div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:40,padding:'3px 0'}}><span>Total Amount</span><b style={{marginLeft:8}}>₹ {fc(grandTotal,cur)}</b></div>
      <div style={{fontSize:11.5,margin:'6px 0',display:'flex',justifyContent:'space-between'}}><span>Total Items / Qty : {itemRows.length} / {qtyTotal}</span><span>Total amount (in words): <b>{safeToWords(grandTotal,cur).toUpperCase()}.</b></span></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr 1fr',gap:14,marginTop:10,fontSize:11.5}}><div><b>Pay using UPI:</b><br/>{QRNode}</div><div><b>Bank Details:</b>{[['Name:',co.bank],['Branch:',co.branch],['Acc. Number:',co.acc],['IFSC:',co.ifsc],['UPI ID:',co.upi]].map(([l,v])=>(<div key={l} style={{display:'flex',marginBottom:2}}><div style={{width:70,fontWeight:'bold'}}>{l}</div>{v}</div>))}</div><div style={{textAlign:'center'}}><b>{co.forCo}</b><br/>{co.sign?<img src={co.sign} alt="sig" style={{width:50,opacity:0.7}}/>:<div style={{height:45}}/>}<div>Authorised Signatory</div></div></div>
      <div style={{marginTop:10,fontSize:11.5}}><b>Terms and Conditions:</b><br/>{termsText.join('. ')}<div style={{marginTop:6,fontWeight:'bold'}}>Customer Signature</div></div>
      <div style={{marginTop:8,fontSize:11,fontStyle:'italic'}}>Declaration : Composition Taxable Person Not Eligible To Collect Taxes On Supplies</div>
    </div>
  ); };

  // ── T09: Compact Border + IGST Amt + Rightbox Totals
  const T09 = () => { const blue='#1a56a0',lb='#eaf2fb',b=`1px solid ${blue}`; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:11.5,border:b,padding:8}}>
      <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:6}}>{co.logo&&<img src={co.logo} alt="logo" style={{width:44,height:44}}/>}<div><div style={{fontSize:16,fontWeight:'bold'}}>{co.name}</div><div style={{fontSize:11}}>{co.address}</div><div style={{fontSize:11}}><b>Name</b> : {bu.name} | <b>Phone</b> : {bu.phone}</div></div></div>
      <div style={{display:'flex',justifyContent:'space-between',border:b,padding:'4px 8px',fontWeight:'bold'}}><span>GSTIN : {co.gstin}</span><span style={{fontSize:14,color:blue}}>TAX INVOICE</span><span>ORIGINAL FOR RECIPIENT</span></div>
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.2fr 1fr',border:b,borderTop:'none',fontSize:11}}><div style={{padding:'5px 7px',borderRight:b}}><div style={{fontWeight:'bold'}}>Details of Buyer | Billed to :</div><div style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>Name</div>{bu.name}</div><div style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>Address</div>{bu.address}</div><div style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>GSTIN</div>{bu.gstin}</div><div style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>PAN</div>{bu.pan}</div></div><div style={{padding:'5px 7px',borderRight:b}}><div style={{fontWeight:'bold'}}>Details of Consignee | Shipped to :</div><div style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>Name</div>{sh.name}</div><div style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>Address</div>{sh.address}</div><div style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>State</div>{sh.state}</div></div><div style={{padding:'5px 7px'}}>{[['Inv No.',im.invoiceNo],['Date',im.invoiceDate],['Due',im.dueDate],['P.O.No',im.poNo],['E-Way',im.eWayNo]].map(([l,v])=>(<div key={l} style={{display:'flex'}}><div style={{width:60,fontWeight:'bold',flexShrink:0}}>{l}</div>{v}</div>))}</div></div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,border:b,borderTop:'none'}}><thead><tr>{['Sr','Product/Service','HSN','Qty','Rate','IGST Amt','Total'].map(h=><th key={h} style={{border:b,background:lb,padding:3}}>{h}</th>)}</tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'center'}}>{i+1}</td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,fontWeight:'bold'}}>{it.name}</td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'center'}}>{it.hsn}</td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'center'}}>{it.qty}</td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'right'}}>{fc(it.price,cur)}</td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'right'}}>{fc(it.gstAmt,cur)}</td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'right'}}>{fc(it.total,cur)}</td></tr>))}<tr><td colSpan={3} style={{padding:3,borderLeft:b,borderRight:b,borderBottom:b}}></td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:b,textAlign:'right'}}><b>{qtyTotal}</b></td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:b}}></td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:b,textAlign:'right'}}><b>{fc(totalTax,cur)}</b></td><td style={{padding:3,borderLeft:b,borderRight:b,borderBottom:b,textAlign:'right'}}><b>{fc(grandTotal,cur)}</b></td></tr></tbody></table>
      <div style={{border:b,borderTop:'none',padding:'5px 7px',fontSize:11}}>Total in words<br/><b>{safeToWords(grandTotal,cur)}</b></div>
      <div style={{border:b,borderTop:'none'}}>{[['Taxable Amount',fc(totalTaxable,cur)],['Total Tax',fc(totalTax,cur)],[' Total Amount After Tax',`₹${fc(grandTotal,cur)}`]].map(([l,v])=>(<div key={l} style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:b}}><span>{l}</span><b>{v}</b></div>))}</div>
    </div>
  ); };

  // ── T10: Centered Header + table.meta layout
  const T10 = () => { const blue='#1a56a0',lb='#eaf2fb',b=`1px solid ${blue}`; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:11.5,border:b,padding:10}}>
      <div style={{textAlign:'center'}}>{co.logo&&<img src={co.logo} alt="logo" style={{width:50,height:50}}/>}<div style={{fontSize:17,fontWeight:'bold'}}>{co.name}</div><div style={{fontSize:11}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/><div style={{fontSize:11}}><b>Name</b> : {bu.name} | <b>Phone</b> : {bu.phone}</div></div>
      <div style={{display:'flex',justifyContent:'space-between',border:b,padding:'4px 8px',fontWeight:'bold',marginTop:8}}><span>GSTIN : {co.gstin}</span><span style={{fontSize:14,color:blue}}>TAX INVOICE</span><span>ORIGINAL FOR RECIPIENT</span></div>
      <table style={{width:'100%',borderCollapse:'collapse',border:b,borderTop:'none',fontSize:11}}><tbody><tr><td style={{border:b,padding:'4px 7px',width:90,fontWeight:'bold'}}>M/S</td><td style={{border:b,padding:'4px 7px'}}>{bu.name}</td><td style={{border:b,padding:'4px 7px',width:90,fontWeight:'bold'}}>Invoice No.</td><td style={{border:b,padding:'4px 7px'}}>{im.invoiceNo}</td></tr><tr><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>Address</td><td style={{border:b,padding:'4px 7px'}}>{bu.address}</td><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>Invoice Date</td><td style={{border:b,padding:'4px 7px'}}>{im.invoiceDate}</td></tr><tr><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>Phone</td><td style={{border:b,padding:'4px 7px'}}>{bu.phone}</td><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>Due Date</td><td style={{border:b,padding:'4px 7px'}}>{im.dueDate}</td></tr><tr><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>GSTIN</td><td style={{border:b,padding:'4px 7px'}}>{bu.gstin}</td><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>P.O. No.</td><td style={{border:b,padding:'4px 7px'}}>{im.poNo}</td></tr><tr><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>PAN</td><td style={{border:b,padding:'4px 7px'}}>{bu.pan}</td><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>P.O. Date</td><td style={{border:b,padding:'4px 7px'}}>{im.poDate}</td></tr><tr><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>Place of Supply</td><td style={{border:b,padding:'4px 7px'}}>{bu.placeOfSupply}</td><td style={{border:b,padding:'4px 7px',fontWeight:'bold'}}>E-Way No.</td><td style={{border:b,padding:'4px 7px'}}>{im.eWayNo}</td></tr></tbody></table>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,border:b,borderTop:'none'}}><thead><tr>{['Sr.No.','Name of Product/Service','HSN/SAC','Qty','Rate','Total'].map(h=><th key={h} style={{border:b,background:lb,padding:4}}>{h}</th>)}</tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'center'}}>{i+1}</td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`}}><span style={{fontWeight:'bold'}}>{it.name}</span>{(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontStyle:'italic',fontSize:10.5}}>{sl}</span>)}</td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'center'}}>{it.hsn}</td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'center'}}>{it.qty}</td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'right'}}>{fc(it.price,cur)}</td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:`1px solid ${lb}`,textAlign:'right'}}>{fc(it.total,cur)}</td></tr>))}<tr><td colSpan={3} style={{padding:4,borderLeft:b,borderRight:b,borderBottom:b}}></td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:b,textAlign:'right'}}><b>{qtyTotal}</b></td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:b}}></td><td style={{padding:4,borderLeft:b,borderRight:b,borderBottom:b,textAlign:'right'}}><b>₹{fc(grandTotal,cur)}</b></td></tr></tbody></table>
      <div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',border:b,borderTop:'none',fontSize:11}}><div style={{padding:'6px 8px',borderRight:b}}>Total in words<br/><b>{safeToWords(grandTotal,cur)}</b></div><div>{[['Taxable Amount',fc(totalTaxable,cur)],['Add : IGST',fc(totalTax,cur)],['Total Tax',fc(totalTax,cur)],[' Total Amount After Tax',`₹${fc(grandTotal,cur)}`],['GST Payable on Reverse Charge','N.A.']].map(([l,v])=>(<div key={l} style={{display:'flex',justifyContent:'space-between',padding:'3px 8px',borderBottom:b}}><span>{l}</span><b>{v}</b></div>))}</div></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',border:b,borderTop:'none',fontSize:11}}><div style={{padding:8,textAlign:'center'}}>Certified that the particulars given above are true and correct.<br/><b>{co.forCo}</b><br/><br/>Authorised Signatory</div><div style={{padding:8,textAlign:'center'}}>{QRNode}<div>Pay using UPI</div></div></div>
    </div>
  ); };

  // ── T12: All Black Frame / Table Layout
  const T12 = () => { const bd='1px solid #333',lg='#f3f3f3'; return (
    <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:11}}>
      <table style={{width:'100%',borderCollapse:'collapse',border:bd,marginBottom:10}}><tbody><tr><td style={{border:bd,padding:'5px 7px',width:'26%',verticalAlign:'top'}}><div style={{fontWeight:'bold'}}>{co.name}</div><div>{co.address}</div><div><b>Phone:</b> {co.phone}</div><div><b>GSTIN:</b> {co.gstin}</div><div><b>PAN:</b> {co.pan}</div></td><td style={{border:bd,padding:'5px 7px',width:'18%',verticalAlign:'top'}}><div style={{fontWeight:'bold'}}>TAX INVOICE</div><div>Invoice No. {im.invoiceNo}</div><div>Invoice Date {im.invoiceDate}</div><div>Due Date {im.dueDate}</div></td><td style={{border:bd,padding:'5px 7px',width:'28%',verticalAlign:'top'}}><div style={{fontWeight:'bold'}}>To, {bu.name}</div><div>{bu.address}</div><div>Phone: {bu.phone}</div><div>GSTIN: {bu.gstin}</div><div>PAN: {bu.pan}</div><div>Place of Supply: {bu.placeOfSupply}</div></td><td style={{border:bd,padding:'5px 7px',width:'28%',verticalAlign:'top'}}><div style={{fontWeight:'bold'}}>Shipped To, {sh.name}</div><div>{sh.address}</div><div>Phone: {sh.phone}</div><div>GSTIN: {sh.gstin}</div><div>State: {sh.state}</div></td></tr></tbody></table>
      <table style={{width:'100%',borderCollapse:'collapse',border:bd,marginBottom:6}}><thead><tr>{['Sr.No.','Name of Product/Service','HSN/SAC','Qty','Rate','Taxable Value','IGST%','IGST Amt','Total'].map(h=><th key={h} style={{border:bd,background:lg,padding:4}}>{h}</th>)}</tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{border:bd,padding:4,textAlign:'center'}}>{i+1}</td><td style={{border:bd,padding:4}}><span style={{fontWeight:'bold'}}>{it.name}</span>{(it.subLines||[]).map((sl:string,si:number)=><span key={si} style={{display:'block',fontStyle:'italic',fontSize:10}}>{sl}</span>)}</td><td style={{border:bd,padding:4,textAlign:'center'}}>{it.hsn}</td><td style={{border:bd,padding:4,textAlign:'center'}}>{it.qty}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(it.price,cur)}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(it.taxable,cur)}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{it.gstPct}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(it.gstAmt,cur)}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(it.total,cur)}</td></tr>))}<tr><td colSpan={3} style={{border:bd,padding:4}}></td><td style={{border:bd,padding:4,textAlign:'right'}}><b>{qtyTotal}</b></td><td style={{border:bd,padding:4}}></td><td style={{border:bd,padding:4,textAlign:'right'}}><b>{fc(totalTaxable,cur)}</b></td><td colSpan={2} style={{border:bd,padding:4,textAlign:'right'}}><b>{fc(totalTax,cur)}</b></td><td style={{border:bd,padding:4,textAlign:'right'}}><b>{fc(grandTotal,cur)}</b></td></tr></tbody></table>
      <table style={{width:'100%',borderCollapse:'collapse',border:bd,marginBottom:6}}><tbody><tr><td style={{border:bd,padding:'5px 7px'}}>Total in words : <b>{safeToWords(grandTotal,cur).toUpperCase()}</b></td></tr></tbody></table>
      <table style={{width:'100%',borderCollapse:'collapse',border:bd,marginBottom:6}}><thead><tr><th rowSpan={2} style={{border:bd,padding:4}}>HSN/SAC</th><th rowSpan={2} style={{border:bd,padding:4}}>Taxable Value</th><th colSpan={2} style={{border:bd,padding:4}}>IGST</th><th rowSpan={2} style={{border:bd,padding:4}}>Total</th></tr><tr><th style={{border:bd,padding:4}}>%</th><th style={{border:bd,padding:4}}>Amount</th></tr></thead><tbody>{hsnEntries.map(([hsn,d])=>(<tr key={hsn}><td style={{border:bd,padding:4}}>{hsn}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(d.taxable,cur)}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{d.pct}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(isIgst?d.igst:d.tax,cur)}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(d.tax,cur)}</td></tr>))}<tr style={{fontWeight:'bold'}}><td style={{border:bd,padding:4}}>Total</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(totalTaxable,cur)}</td><td style={{border:bd,padding:4}}></td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(totalTax,cur)}</td><td style={{border:bd,padding:4,textAlign:'right'}}>{fc(totalTax,cur)}</td></tr></tbody></table>
      <table style={{width:'100%',borderCollapse:'collapse',border:bd}}><tbody><tr><td style={{border:bd,padding:'5px 7px'}}>Terms and Conditions : {termsText.join(' ')}</td></tr><tr><td style={{border:bd,padding:'5px 7px'}}>Customer Signature</td></tr><tr><td style={{border:bd,padding:'5px 7px'}}><b>Bank:</b> {co.bank} &nbsp; <b>A/c No.:</b> {co.acc} &nbsp; <b>IFSC:</b> {co.ifsc}</td></tr></tbody></table>
      <div style={{display:'flex',justifyContent:'space-between',border:bd,padding:'5px 7px',marginTop:4}}><span>Declaration : Composition Taxable Person Not Eligible To Collect Taxes On Supplies</span><span>Page 1 of 1</span></div>
    </div>
  ); };

  // ── TPOS: POS Thermal Receipt (T14=wide, T15=narrow)
  const TPOS = ({ wide = true }: { wide?: boolean }) => {
    const maxW = wide ? 380 : 340;
    const div = wide ? '===============TAX INVOICE===============' : '=====TAX INVOICE=====';
    const sep = wide ? '========================================' : '===============';
    return (
      <div style={{fontFamily:`'Courier New',monospace`,fontSize:12,maxWidth:maxW,margin:'0 auto',padding:16,textAlign:'center',background:'#fff'}}>
        <div style={{fontWeight:'bold'}}>{co.name}</div>
        <div style={{fontSize:11}} dangerouslySetInnerHTML={{__html:co.address.replace(/\n/g,'<br>')}}/><div style={{fontSize:11}}>{co.phone}</div><div style={{fontSize:11}}>GSTIN : {co.gstin}</div>
        <div style={{margin:'8px 0',letterSpacing:-1,fontSize:11}}>{div}</div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11.5}}><span>INVOICE #: {im.invoiceNo}</span><span>DATE: {im.invoiceDate}</span></div>
        <div style={{margin:'8px 0',letterSpacing:-1,fontSize:11}}>{wide?'================BILLED TO================':'=====BILLED TO====='}</div>
        <div style={{textAlign:'left',fontSize:11}}>Name : {bu.name}<br/>GSTIN : {bu.gstin}<br/>PAN : {bu.pan}</div>
        <div style={{margin:'8px 0',letterSpacing:-1,fontSize:11}}>{sep}</div>
        <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:11,margin:'6px 0'}}><thead><tr><th style={{borderBottom:'1px solid #000',padding:'3px 2px'}}>Items x Qty<br/>HSN<br/>Rate</th><th style={{borderBottom:'1px solid #000',padding:'3px 2px'}}>Taxable<br/>+ GST</th><th style={{borderBottom:'1px solid #000',padding:'3px 2px',textAlign:'right'}}>Total</th></tr></thead><tbody>{itemRows.map((it:any,i:number)=>(<tr key={i}><td style={{padding:'3px 2px',verticalAlign:'top'}}>{it.name} x {it.qty}<span style={{display:'block',fontSize:10}}>HSN : {it.hsn}</span><span style={{display:'block',fontSize:10}}>Rate: {fc(it.price,cur)}</span></td><td style={{padding:'3px 2px',verticalAlign:'top',textAlign:'right'}}>{fc(it.taxable,cur)}<br/>+ {it.gstPct} %</td><td style={{padding:'3px 2px',verticalAlign:'top',textAlign:'right'}}>{fc(it.total,cur)}</td></tr>))}</tbody></table>
        <div style={{margin:'8px 0',letterSpacing:-1,fontSize:11}}>{wide?'================SUMMARY================':'=====SUMMARY====='}</div>
        <div style={{textAlign:'left'}}>{[['Taxable Amount',fc(totalTaxable,cur)],['Add : IGST',fc(totalTax,cur)],['Total Tax',fc(totalTax,cur)],[' Total Amount After Tax',`₹${fc(grandTotal,cur)}`],['GST Payable on Reverse Charge','N.A.']].map(([l,v])=>(<div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:11.5}}><span>{l}</span><span>{v}</span></div>))}</div>
        <div style={{margin:'8px 0',letterSpacing:-1,fontSize:11}}>{sep}</div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11.5}}><span>Grand Total :</span><span>{fc(grandTotal,cur)}</span></div>
        <div style={{margin:'8px 0',letterSpacing:-1,fontSize:11}}>{sep}</div>
        <div style={{marginTop:8}}>{QRNode}<div>Pay using UPI</div></div>
      </div>
    );
  };

  const renderInvoice = () => {
    switch (tpl) {
      case 'template_02': return <T02 />;
      case 'template_03': return <T03 />;
      case 'template_04': return <T04 />;
      case 'template_07': return <T07 />;
      case 'template_08': return <T08 />;
      case 'template_09': return <T09 />;
      case 'template_10': return <T10 />;
      case 'template_12': return <T12 />;
      case 'template_14': return <TPOS wide={true} />;
      case 'template_15': return <TPOS wide={false} />;
      default: return <T01 />;
    }
  };

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
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <button onClick={() => navigate(`/invoices/edit/${invoice.id}`)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"><Edit3 size={15} /><span className="hidden sm:inline">Edit</span></button>
            <button onClick={handleShare} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"><WhatsAppIcon size={15} /><span className="hidden sm:inline">Share</span></button>
            <button onClick={handleDownloadPdf} disabled={downloading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50">{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}<span className="hidden sm:inline">PDF</span></button>
            <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"><Printer size={15} /><span>Print</span></button>
          </div>
        </div>
      </header>
      <main className="w-full max-w-5xl px-2 sm:px-4 mt-4 sm:mt-6 flex justify-center print:max-w-none print:w-full print:p-0 print:m-0 print:block">
        <div ref={invoiceRef} id="invoice-document-canvas" style={{ width:'210mm', minHeight: isPOS ? 'auto' : '297mm', background:'#fff', margin:'0 auto', padding: isPOS ? '10mm 0 0 0' : '8mm', boxSizing:'border-box', display: isPOS ? 'flex' : 'block', justifyContent: isPOS ? 'center' : undefined, alignItems: isPOS ? 'flex-start' : undefined }}>
          {renderInvoice()}
        </div>
      </main>
      <WhatsAppShareModal isOpen={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} whatsAppUrl={whatsAppUrlState} whatsAppWebUrl={whatsAppWebUrlState} whatsAppAppUrl={whatsAppAppUrlState} documentTitle="Invoice" copiedToClipboard={copiedToClipboard} fileName={`Invoice_${invoice?.invoice_number || 'bill'}.pdf`} />
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          *, *:before, *:after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
          body * { visibility: hidden !important; }
          header, nav, aside, footer, button { display: none !important; }
          #invoice-document-canvas, #invoice-document-canvas * { visibility: visible !important; }
          #invoice-document-canvas { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
          table { page-break-inside: auto !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
}