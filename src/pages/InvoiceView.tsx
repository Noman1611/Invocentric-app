import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { getSecureStorage } from '../utils/cryptoUtils';
import { formatCurrency, cn, normalizePhoneNumber } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { toWords } from 'number-to-words';
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { WhatsAppShareModal } from '../components/WhatsAppShareModal';
import { WhatsAppIcon } from '../components/WhatsAppIcon';

const safeToWords = (value: number, currency: string = 'INR'): string => {
  try {
    const valFloor = Math.floor(value);
    if (isFinite(valFloor) && !isNaN(valFloor) && valFloor >= 0) {
      const words = toWords(valFloor);
      const currencyWord = currency === 'INR' ? 'RUPEES' : currency;
      return `${words} ${currencyWord} ONLY`.toUpperCase();
    }
  } catch (err) {
    console.warn("toWords failed in InvoiceView:", err);
  }
  return '';
};

const formatDateSafe = (dateInput: any, fmt: string = 'dd MMM yyyy'): string => {
  if (!dateInput) return 'N/A';
  try {
    if (typeof dateInput === 'object' && dateInput.toDate) {
      return format(dateInput.toDate(), fmt);
    }
    if (typeof dateInput === 'string') {
      const parsed = parseISO(dateInput);
      if (!isNaN(parsed.getTime())) return format(parsed, fmt);
      const d = new Date(dateInput);
      if (!isNaN(d.getTime())) return format(d, fmt);
    }
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      return format(dateInput, fmt);
    }
  } catch (e) {
    // fallback
  }
  return String(dateInput);
};

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOfflineMode } = useAuth();

  const [invoice, setInvoice] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // WhatsApp Share State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppUrlState, setWhatsAppUrlState] = useState('');
  const [whatsAppWebUrlState, setWhatsAppWebUrlState] = useState('');
  const [whatsAppAppUrlState, setWhatsAppAppUrlState] = useState('');
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const invoiceRef = useRef<HTMLDivElement>(null);

  // Load Invoice, Customer & Seller Data
  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      setLoading(true);
      try {
        const upserts = getSecureStorage('offline_queue_upserts', []);
        const localInvoices = getSecureStorage(`offline_invoices_${user?.uid || 'guest'}`, []);
        
        let invData: any = null;
        const queuedInvoice = upserts.find((u: any) => u.collection === "invoices" && u.item.id === id);
        if (queuedInvoice) {
          invData = queuedInvoice.item;
        } else if (isOfflineMode) {
          invData = localInvoices.find((i: any) => i.id === id);
        }
        
        if (!invData && !isOfflineMode) {
          const invDocRef = doc(db, "invoices", id);
          const invSnap = await getDoc(invDocRef);
          if (invSnap.exists()) invData = { id: invSnap.id, ...invSnap.data() };
        }

        if (invData) {
          setInvoice(invData);
          
          // Fetch Customer info
          if (invData.customer_id) {
            let custData: any = null;
            const queuedCust = upserts.find((u: any) => u.collection === "customers" && u.item.id === invData.customer_id);
            if (queuedCust) {
              custData = queuedCust.item;
            } else if (isOfflineMode) {
              const localCustomers = getSecureStorage(`offline_customers_${user?.uid || 'guest'}`, []);
              custData = localCustomers.find((c: any) => c.id === invData.customer_id);
            } else {
              const custDocRef = doc(db, "customers", invData.customer_id);
              const custSnap = await getDoc(custDocRef);
              if (custSnap.exists()) custData = { id: custSnap.id, ...custSnap.data() };
            }
            if (custData) setCustomer(custData);
          }
          
          // Fetch Seller info
          if (invData.user_id) {
            let userData: any = null;
            if (isOfflineMode) {
              const localUsers = getSecureStorage(`offline_users_${user?.uid || 'guest'}`, []);
              userData = localUsers.find((u: any) => u.id === invData.user_id);
              if (!userData && user?.uid === invData.user_id) {
                const cachedProfile = getSecureStorage(`user_profile_${user.uid}`, null);
                if (cachedProfile) {
                  try {
                    userData = { id: user.uid, ...(typeof cachedProfile === 'string' ? JSON.parse(cachedProfile) : cachedProfile) };
                  } catch (e) {
                    userData = { id: user.uid, displayName: user.displayName, email: user.email };
                  }
                } else {
                  userData = { id: user.uid, displayName: user.displayName, email: user.email };
                }
              }
            } else {
              const userDocRef = doc(db, "users", invData.user_id);
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists()) userData = { id: userSnap.id, ...userSnap.data() };
            }
            if (userData) setSellerInfo(userData);
          }
        }
      } catch (error) {
        console.error("Error fetching invoice data:", error);
        handleFirestoreError(error, OperationType.GET, `invoices/${id}`);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, user, isOfflineMode]);

  // Clean items & calculations
  const items = invoice?.items || [];
  const rawSubtotal = items.reduce((acc: number, i: any) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.price || i.mrp) || 0;
    return acc + (qty * price);
  }, 0);

  const itemDiscountsSum = items.reduce((acc: number, i: any) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.price || i.mrp) || 0;
    const disc = Number(i.discount) || 0;
    return acc + (qty * price * (disc / 100));
  }, 0);

  const totalDiscount = (Number(invoice?.discount) || 0) + itemDiscountsSum;

  const totalTax = items.reduce((acc: number, i: any) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.price || i.mrp) || 0;
    const disc = Number(i.discount) || 0;
    const taxable = qty * price * (1 - disc / 100);
    const gstPct = Number(i.gstPercent || i.gst_rate) || 0;
    return acc + (taxable * gstPct / 100);
  }, 0);

  const isIgst = Boolean(
    customer?.state && sellerInfo?.state && customer.state.trim().toLowerCase() !== sellerInfo.state.trim().toLowerCase()
  );

  const hsnSummary = items.reduce((acc: any, i: any) => {
    const code = i.hsn_code || i.hsn || '---';
    const qty = Number(i.quantity) || 0;
    const price = Number(i.price || i.mrp) || 0;
    const disc = Number(i.discount) || 0;
    const taxable = qty * price * (1 - disc / 100);
    const gstPct = Number(i.gstPercent || i.gst_rate) || 0;
    const tax = taxable * gstPct / 100;
    if (!acc[code]) {
      acc[code] = { taxable: 0, tax: 0, gstRate: gstPct, igst: 0, cgst: 0, sgst: 0 };
    }
    acc[code].taxable += taxable;
    acc[code].tax += tax;
    if (isIgst) {
      acc[code].igst += tax;
    } else {
      acc[code].cgst += tax / 2;
      acc[code].sgst += tax / 2;
    }
    return acc;
  }, {});

  const hasGST = totalTax > 0;
  const grandTotal = Number(invoice?.amount || 0);

  // UPI payment QR string
  const upiId = sellerInfo?.upi_id || sellerInfo?.upiId;
  const upiUrl = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(sellerInfo?.business_name || 'Business')}&am=${encodeURIComponent(grandTotal)}&cu=INR` : null;

  // Actions
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || downloading) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const dataUrl = await toPng(invoiceRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        fontEmbedCSS: '',
        skipFonts: true,
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const pdfWidthMm = 210;
      const pdfPageHeightMm = 297;
      const imgHeightMm = (img.height * pdfWidthMm) / img.width;

      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true,
      });

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidthMm, pdfPageHeightMm, 'F');
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidthMm, Math.min(pdfPageHeightMm, imgHeightMm));
      pdf.save(`Invoice_${invoice?.invoice_number || invoice?.id?.slice(0, 8) || 'document'}.pdf`);
    } catch (err) {
      console.error("PDF Download Error:", err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const invNum = invoice?.invoice_number || invoice?.id?.slice(0, 8)?.toUpperCase();
    const custName = customer?.name || invoice?.customer_name || 'Customer';
    const amountStr = formatCurrency(grandTotal, invoice?.currency);
    const shareText = `Dear ${custName}, here is your invoice #${invNum} of ${amountStr} from ${sellerInfo?.business_name || 'our store'}. Thank you for your business!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${invNum}`,
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to WhatsApp modal
      }
    }

    const cleanPhone = normalizePhoneNumber(customer?.phone || '');
    const encodedText = encodeURIComponent(shareText);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    const waWebUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    const waAppUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;

    setWhatsAppUrlState(waUrl);
    setWhatsAppWebUrlState(waWebUrl);
    setWhatsAppAppUrlState(waAppUrl);
    setShowWhatsAppModal(true);
    setCopiedToClipboard(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Opening invoice document...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <p className="text-base font-bold text-slate-800 mb-2">Invoice Not Found</p>
          <p className="text-xs text-slate-500 mb-6">The requested invoice record could not be loaded.</p>
          <button 
            onClick={() => navigate('/invoices')}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  const invoiceNumberDisplay = invoice.invoice_number || `INV-${invoice.id.slice(0, 6).toUpperCase()}`;
  const isPaid = invoice.status === 'paid';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pb-16 print:bg-white print:p-0 print:m-0 print:pb-0">
      
      {/* ── TOP ACTION HEADER (Back, Invoice #, Share, PDF, Print) ── */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          
          {/* Left: Back & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              onClick={() => navigate('/invoices')}
              className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              title="Back to Invoices List"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-black text-slate-900 truncate leading-none">
                  #{invoiceNumberDisplay}
                </h1>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                  isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                )}>
                  {invoice.status || 'Draft'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                {customer?.name || invoice.customer_name || 'Individual Profile'}
              </p>
            </div>
          </div>

          {/* Right: 3 Primary Action Buttons */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Share Button */}
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              title="Share on WhatsApp / Web Share"
            >
              <WhatsAppIcon size={15} />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* PDF Download Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download PDF"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
              title="Print Document"
            >
              <Printer size={15} />
              <span>Print</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN INVOICE DOCUMENT ── */}
      <main className="w-full max-w-4xl px-2 sm:px-4 mt-4 sm:mt-6 flex justify-center print:max-w-none print:w-full print:p-0 print:m-0 print:block">
        <div 
          ref={invoiceRef}
          id="invoice-document-canvas"
          className="w-full bg-white text-slate-900 shadow-xl rounded-none sm:rounded-xl border border-slate-200 p-6 sm:p-8 box-border text-[11.5px] leading-snug flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none print:rounded-none"
          style={{
            maxWidth: '820px',
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          {/* Header: Seller Brand & Meta */}
          <div>
            <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-300">
              <div className="flex gap-3.5 items-start max-w-[60%]">
                {sellerInfo?.logo_url && (
                  <img 
                    src={sellerInfo.logo_url} 
                    alt="Logo" 
                    className="w-14 h-14 object-contain rounded-lg border border-slate-100 shrink-0" 
                  />
                )}
                <div>
                  <h2 className="text-lg sm:text-xl font-black uppercase text-slate-900 tracking-tight leading-tight">
                    {sellerInfo?.business_name || 'Business Name'}
                  </h2>
                  {sellerInfo?.address && (
                    <p className="text-slate-600 text-[10.5px] whitespace-pre-line mt-0.5 leading-relaxed">
                      {sellerInfo.address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-slate-600 mt-0.5 font-medium">
                    {sellerInfo?.phone && <span>Ph: {sellerInfo.phone}</span>}
                    {sellerInfo?.email && <span>Email: {sellerInfo.email}</span>}
                  </div>
                  {sellerInfo?.gstin && (
                    <p className="text-[10.5px] font-bold text-slate-800 mt-0.5">
                      GSTIN: <span className="uppercase">{sellerInfo.gstin}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Document Title & Invoice Details */}
              <div className="text-right shrink-0">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest rounded mb-1.5">
                  TAX INVOICE
                </span>
                <div className="space-y-0.5 text-[10.5px] text-slate-700">
                  <p><span className="text-slate-500 font-medium">Invoice No:</span> <span className="font-bold text-slate-900">#{invoiceNumberDisplay}</span></p>
                  <p><span className="text-slate-500 font-medium">Invoice Date:</span> <span className="font-semibold text-slate-900">{formatDateSafe(invoice.date, 'dd-MMM-yyyy')}</span></p>
                  {invoice.due_date && (
                    <p><span className="text-slate-500 font-medium">Due Date:</span> <span className="font-semibold text-slate-900">{formatDateSafe(invoice.due_date, 'dd-MMM-yyyy')}</span></p>
                  )}
                  {invoice.po_number && (
                    <p><span className="text-slate-500 font-medium">P.O. No:</span> <span className="font-semibold text-slate-900">{invoice.po_number}</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Buyer Details (Billed To) */}
            <div className="grid grid-cols-2 gap-3 py-3 border-b border-slate-300">
              <div className="bg-slate-50/80 p-2.5 rounded border border-slate-200">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  Billed To (Buyer / Customer)
                </p>
                <p className="text-xs font-black text-slate-900 uppercase">
                  {customer?.name || invoice.customer_name || 'Individual Customer'}
                </p>
                {customer?.address && (
                  <p className="text-[10.5px] text-slate-600 whitespace-pre-line mt-0.5">
                    {customer.address}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 text-[10.5px] text-slate-600 mt-0.5 font-medium">
                  {customer?.phone && <span>Ph: {customer.phone}</span>}
                  {customer?.email && <span>Email: {customer.email}</span>}
                </div>
                {customer?.gst_number && (
                  <p className="text-[10.5px] font-bold text-slate-800 mt-0.5">
                    GSTIN: <span className="uppercase">{customer.gst_number}</span>
                  </p>
                )}
              </div>

              <div className="bg-slate-50/80 p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                    Supply Details
                  </p>
                  <p className="text-[10.5px] text-slate-700">
                    <span className="text-slate-500 font-medium">Place of Supply:</span> <span className="font-bold text-slate-900">{customer?.place_of_supply || customer?.state || sellerInfo?.state || 'Local'}</span>
                  </p>
                  <p className="text-[10.5px] text-slate-700 mt-0.5">
                    <span className="text-slate-500 font-medium">Payment Status:</span> <span className={cn("font-bold uppercase", isPaid ? "text-emerald-700" : "text-amber-700")}>{invoice.status || 'Pending'}</span>
                  </p>
                </div>
                {invoice.payment_terms && (
                  <p className="text-[9.5px] text-slate-500 mt-1 font-medium">
                    Terms: {invoice.payment_terms}
                  </p>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-3 border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold text-[10.5px] uppercase tracking-wider border-b border-slate-300">
                    <th className="p-2 text-center w-8 border-r border-slate-300">#</th>
                    <th className="p-2 border-r border-slate-300">Description of Goods / Services</th>
                    <th className="p-2 text-center w-16 border-r border-slate-300">HSN</th>
                    <th className="p-2 text-center w-14 border-r border-slate-300">Qty</th>
                    <th className="p-2 text-right w-20 border-r border-slate-300">Rate</th>
                    {totalDiscount > 0 && <th className="p-2 text-center w-14 border-r border-slate-300">Disc %</th>}
                    {hasGST && <th className="p-2 text-center w-14 border-r border-slate-300">GST %</th>}
                    <th className="p-2 text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10.5px]">
                  {items.map((item: any, idx: number) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.price || item.mrp) || 0;
                    const disc = Number(item.discount) || 0;
                    const gstPct = Number(item.gstPercent || item.gst_rate) || 0;
                    const lineTotal = qty * price * (1 - disc / 100);

                    return (
                      <tr key={idx} className="align-top">
                        <td className="p-2 text-center text-slate-500 font-medium border-r border-slate-300">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                          <div>{item.description || item.name || 'Item'}</div>
                          {item.notes && <div className="text-[9.5px] text-slate-500 font-normal mt-0.5">{item.notes}</div>}
                        </td>
                        <td className="p-2 text-center text-slate-600 border-r border-slate-300">{item.hsn_code || item.hsn || '---'}</td>
                        <td className="p-2 text-center font-bold text-slate-900 border-r border-slate-300">{qty} {item.unit || ''}</td>
                        <td className="p-2 text-right text-slate-700 border-r border-slate-300">{formatCurrency(price, invoice.currency)}</td>
                        {totalDiscount > 0 && <td className="p-2 text-center text-slate-600 border-r border-slate-300">{disc > 0 ? `${disc}%` : '-'}</td>}
                        {hasGST && <td className="p-2 text-center text-slate-600 border-r border-slate-300">{gstPct > 0 ? `${gstPct}%` : '-'}</td>}
                        <td className="p-2 text-right font-black text-slate-900">{formatCurrency(lineTotal, invoice.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculation Totals & Amount in Words */}
            <div className="grid grid-cols-12 gap-3 mt-3">
              <div className="col-span-7 flex flex-col justify-between">
                <div className="bg-slate-50/80 p-2.5 rounded border border-slate-200">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                    Total in Words:
                  </p>
                  <p className="text-[11px] font-black text-slate-900 uppercase mt-0.5">
                    {safeToWords(grandTotal, invoice.currency)}
                  </p>
                </div>

                {/* GST Tax Breakdown Table */}
                {hasGST && (
                  <div className="mt-2 border border-slate-300 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse text-[9.5px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                          <th className="p-1.5 border-r border-slate-300">HSN</th>
                          <th className="p-1.5 text-right border-r border-slate-300">Taxable</th>
                          {isIgst ? (
                            <th className="p-1.5 text-right border-r border-slate-300">IGST</th>
                          ) : (
                            <>
                              <th className="p-1.5 text-right border-r border-slate-300">CGST</th>
                              <th className="p-1.5 text-right border-r border-slate-300">SGST</th>
                            </>
                          )}
                          <th className="p-1.5 text-right">Total Tax</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {Object.entries(hsnSummary).map(([hsn, d]: [string, any]) => (
                          <tr key={hsn}>
                            <td className="p-1 font-medium border-r border-slate-300">{hsn}</td>
                            <td className="p-1 text-right border-r border-slate-300">{formatCurrency(d.taxable, invoice.currency)}</td>
                            {isIgst ? (
                              <td className="p-1 text-right border-r border-slate-300">{formatCurrency(d.tax, invoice.currency)}</td>
                            ) : (
                              <>
                                <td className="p-1 text-right border-r border-slate-300">{formatCurrency(d.tax / 2, invoice.currency)}</td>
                                <td className="p-1 text-right border-r border-slate-300">{formatCurrency(d.tax / 2, invoice.currency)}</td>
                              </>
                            )}
                            <td className="p-1 text-right font-bold">{formatCurrency(d.tax, invoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Totals Summary Box */}
              <div className="col-span-5 bg-slate-50/80 p-3 rounded border border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Sub Total:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(rawSubtotal, invoice.currency)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Discount:</span>
                    <span>-{formatCurrency(totalDiscount, invoice.currency)}</span>
                  </div>
                )}
                {hasGST && (
                  isIgst ? (
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>IGST:</span>
                      <span className="font-semibold text-slate-900">+{formatCurrency(totalTax, invoice.currency)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>CGST:</span>
                        <span className="font-semibold text-slate-900">+{formatCurrency(totalTax / 2, invoice.currency)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>SGST:</span>
                        <span className="font-semibold text-slate-900">+{formatCurrency(totalTax / 2, invoice.currency)}</span>
                      </div>
                    </>
                  )
                )}
                <div className="pt-1.5 border-t-2 border-slate-900 flex justify-between items-baseline text-slate-900">
                  <span className="font-black text-xs">Grand Total:</span>
                  <span className="font-black text-sm">{formatCurrency(grandTotal, invoice.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer: Bank Info, UPI QR, Terms & Signatory */}
          <div className="mt-4 pt-3 border-t-2 border-slate-300">
            <div className="grid grid-cols-12 gap-3 items-end">
              
              {/* Bank Details & Terms */}
              <div className="col-span-7 space-y-1.5">
                {sellerInfo?.bank_name && (
                  <div className="bg-slate-50/80 p-2 rounded border border-slate-200 text-[10px] space-y-0.5">
                    <p className="font-bold text-slate-800 uppercase text-[9.5px]">Bank Details for Payment:</p>
                    <p><span className="text-slate-500 font-medium">Bank:</span> <span className="font-semibold text-slate-900">{sellerInfo.bank_name}</span> | <span className="text-slate-500 font-medium">A/C:</span> <span className="font-bold text-slate-900">{sellerInfo.account_number}</span> | <span className="text-slate-500 font-medium">IFSC:</span> <span className="font-semibold text-slate-900">{sellerInfo.ifsc_code}</span></p>
                  </div>
                )}
                
                {/* Terms & Declaration */}
                <div className="text-[9.5px] text-slate-500 space-y-0.5">
                  <p className="font-bold text-slate-700">Terms & Conditions:</p>
                  <p className="whitespace-pre-line leading-tight">
                    {invoice.terms || sellerInfo?.default_terms || 'Payment is due within the specified period. Goods once sold will not be returned.'}
                  </p>
                  <p className="italic text-slate-400 text-[9px]">
                    Declaration: We declare that this invoice shows the actual price of the goods/services described.
                  </p>
                </div>
              </div>

              {/* UPI QR & Authorized Signatory */}
              <div className="col-span-5 flex flex-col items-end justify-between gap-2">
                {upiUrl && (
                  <div className="flex items-center gap-2 bg-white p-1.5 border border-slate-200 rounded">
                    <QRCodeSVG value={upiUrl} size={44} level="H" />
                    <div className="text-[8.5px] text-slate-600">
                      <p className="font-bold text-slate-900 uppercase">Scan UPI to Pay</p>
                      <p className="truncate max-w-[100px] font-mono">{upiId}</p>
                    </div>
                  </div>
                )}

                <div className="text-right pt-2">
                  <p className="text-[10px] font-bold text-slate-800">
                    For {sellerInfo?.business_name || 'Authorized Company'}
                  </p>
                  <div className="h-10 flex items-center justify-end">
                    {sellerInfo?.signature_url && (
                      <img src={sellerInfo.signature_url} alt="Signature" className="h-8 object-contain" />
                    )}
                  </div>
                  <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider border-t border-slate-300 pt-0.5">
                    Authorized Signatory
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* WhatsApp Share Modal */}
      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        whatsAppUrl={whatsAppUrlState}
        whatsAppWebUrl={whatsAppWebUrlState}
        whatsAppAppUrl={whatsAppAppUrlState}
        documentTitle="Invoice"
        copiedToClipboard={copiedToClipboard}
        fileName={`Invoice_${invoice?.invoice_number || 'bill'}.pdf`}
      />

      {/* Robust Print Stylesheet ensuring 100% 1-Page Fit */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }

          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          /* Hide all app navigation & non-printable elements */
          body * {
            visibility: hidden !important;
          }

          .print\\:hidden,
          [class*="print:hidden"],
          header,
          nav,
          aside,
          footer,
          button,
          .sidebar-container,
          .mobile-nav-container,
          #header-notification-bell,
          #mobile-brand-logo {
            display: none !important;
          }

          /* Unhide and reset document canvas tree */
          #root,
          #root > div,
          main {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-width: 100% !important;
            overflow: visible !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }

          #invoice-document-canvas,
          #invoice-document-canvas * {
            visibility: visible !important;
          }

          #invoice-document-canvas {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          table {
            page-break-inside: auto !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  );
}
