import { getSecureStorage } from "../utils/cryptoUtils";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Download,
  Printer,
  Calendar,
  Phone,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Plus,
  Search,
  ChevronRight,
  Edit2,
  X,
  Check,
  Share2,
  Send,
} from "lucide-react";
import { useCustomers, useInvoices, usePayments } from "../hooks/useData";
import { formatCurrency, cn, normalizePhoneNumber, getWhatsAppShareUrl, getWhatsAppWebUrl, getWhatsAppAppUrl } from "../lib/utils";
import { WhatsAppShareModal } from "../components/WhatsAppShareModal";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import {
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
  subDays,
} from "date-fns";
import { parseDateSafe } from "../utils/dateUtils";
import { Logo } from "../components/Logo";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { dbService } from "../services/dbService";

export default function StatementPage() {
  const { id } = useParams();
  const { user, isOfflineMode } = useAuth();
  const { customers } = useCustomers();
  const { invoices } = useInvoices();
  const [sellerInfo, setSellerInfo] = useState<any>(null);

  useEffect(() => {
    const fetchSellerInfo = async () => {
      if (!user) return;
      try {
        if (isOfflineMode) {
          const cachedProfile = getStoredUserProfile(user.uid) || getSecureStorage(`user_profile_${user.uid}`,
            null,
          );
          if (cachedProfile) {
            setSellerInfo(
              typeof cachedProfile === "string"
                ? JSON.parse(cachedProfile)
                : cachedProfile,
            );
          }
        } else {
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            setSellerInfo(userSnap.data());
          } else {
            const cachedProfile = getStoredUserProfile(user.uid) || getSecureStorage(`user_profile_${user.uid}`,
              null,
            );
            if (cachedProfile) {
              setSellerInfo(
                typeof cachedProfile === "string"
                  ? JSON.parse(cachedProfile)
                  : cachedProfile,
              );
            }
          }
        }
      } catch (err) {
        console.error("Error fetching seller profile:", err);
      }
    };
    fetchSellerInfo();
  }, [user, isOfflineMode]);
  const { payments } = usePayments(id);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [paymentNote, setPaymentNote] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);
  const [generatedPdfFileName, setGeneratedPdfFileName] = useState<string>('');
  const [whatsAppShareText, setWhatsAppShareText] = useState<string>('');
  const [whatsAppUrlState, setWhatsAppUrlState] = useState<string>('');
  const [whatsAppWebUrlState, setWhatsAppWebUrlState] = useState<string>('');
  const [whatsAppAppUrlState, setWhatsAppAppUrlState] = useState<string>('');
  const statementRef = useRef<HTMLDivElement>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    company_name: "",
    gst_number: "",
    email: "",
    phone: "",
    address: "",
  });

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [templateStyle, setTemplateStyle] = useState<"excel" | "thermal">("excel");

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const customer = useMemo(
    () => customers.find((c) => c.id === id),
    [customers, id],
  );

  const customerInvoices = useMemo(
    () => invoices.filter((inv) => inv.customer_id === id),
    [invoices, id],
  );

  const transactions = useMemo(() => {
    const invs = customerInvoices.map((inv) => ({
      id: inv.id,
      date: inv.created_at ? parseDateSafe(inv.created_at) : new Date(),
      type: "invoice",
      description: `Invoice #INV-${inv.id.slice(0, 8).toUpperCase()}`,
      items: inv.items || [],
      debit: inv.amount,
      credit: 0,
      ref: inv.id,
    }));

    const pays = payments.map((p) => ({
      id: p.id,
      date: p.date ? parseDateSafe(p.date) : new Date(),
      type: "payment",
      description: p.note || "Payment Received",
      debit: 0,
      credit: p.amount,
      ref: p.id,
    }));

    return [...invs, ...pays].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
  }, [customerInvoices, payments]);

  const filteredTransactions = useMemo(() => {
    const start = startOfDay(new Date(dateRange.start));
    const end = endOfDay(new Date(dateRange.end));

    return transactions.filter((t) => isWithinInterval(t.date, { start, end }));
  }, [transactions, dateRange]);

  const totals = useMemo(() => {
    const totalInvoiced = transactions.reduce((acc, t) => acc + t.debit, 0);
    const totalPaid = transactions.reduce((acc, t) => acc + t.credit, 0);
    const balance = totalInvoiced - totalPaid;

    return { totalInvoiced, totalPaid, balance };
  }, [transactions]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !paymentAmount) return;

    setIsSubmittingPayment(true);
    try {
      await dbService.add("payments", {
        customer_id: id,
        amount: parseFloat(paymentAmount),
        date: new Date(paymentDate).toISOString(),
        note: paymentNote,
      }, { userId: user.uid });

      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentNote("");
    } catch (error) {
      console.error("Error adding payment:", error);
      handleFirestoreError(error, OperationType.CREATE, "payments");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    setIsSubmittingCustomer(true);
    try {
      await updateDoc(doc(db, "customers", id), {
        name: customerFormData.name,
        company_name: customerFormData.company_name,
        gst_number: customerFormData.gst_number,
        email: customerFormData.email,
        phone: customerFormData.phone,
        address: customerFormData.address,
        updated_at: serverTimestamp(),
      });
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating customer:", error);
      handleFirestoreError(error, OperationType.UPDATE, `customers/${id}`);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const openEditModal = () => {
    if (customer) {
      setCustomerFormData({
        name: customer.name || "",
        company_name: customer.company_name || "",
        gst_number: customer.gst_number || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
      });
      setShowEditModal(true);
    }
  };

  const handlePrint = () => {
    setIsGeneratingDoc(true);
    setTimeout(() => {
      window.print();
      setIsGeneratingDoc(false);
    }, 100);
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!statementRef.current) return null;

    setIsGeneratingDoc(true);
    await new Promise((resolve) => setTimeout(resolve, 300)); // wait for react to render expanded details

    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      const dataUrl = await toPng(statementRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        fontEmbedCSS: "",
        skipFonts: true,
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const isThermal = templateStyle === "thermal";
      const pdfWidthMm = isThermal ? 80 : 210;
      const pdfHeightMm = isThermal ? (img.height * pdfWidthMm) / img.width : 297;

      const pdf = new jsPDF({
        unit: "mm",
        format: isThermal ? [pdfWidthMm, pdfHeightMm] : "a4",
        orientation: "portrait",
        compress: true,
      });

      if (isThermal) {
        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidthMm, pdfHeightMm);
      } else {
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10; // Clean 10mm margins on all sides
        const imgWidth = pdfWidth - margin * 2;
        const imgHeight = (img.height * imgWidth) / img.width;
        const usableHeight = pdfHeight - margin * 2;

        let heightLeft = imgHeight;
        let pageIndex = 0;

        while (heightLeft > 0) {
          if (pageIndex > 0) {
            pdf.addPage();
          }

          const yOffset = margin - pageIndex * usableHeight;
          pdf.addImage(dataUrl, "PNG", margin, yOffset, imgWidth, imgHeight);

          // Draw clean white margins on all sides of every page to mask the sliding canvas cleanly
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pdfWidth, margin, "F"); // Top mask
          pdf.rect(0, pdfHeight - margin, pdfWidth, margin, "F"); // Bottom mask
          pdf.rect(0, 0, margin, pdfHeight, "F"); // Left mask
          pdf.rect(pdfWidth - margin, 0, margin, pdfHeight, "F"); // Right mask

          heightLeft -= usableHeight;
          pageIndex++;
        }
      }

      return pdf.output("blob");
    } catch (err) {
      console.error("PDF Generation Error:", err);
      return null;
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const blob = await generatePdfBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Statement_${customer?.name}_${format(new Date(), "dd_MMM_yyyy")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!customer) return;
    setIsDownloading(true);
    let clipCopied = false;
    try {
      const targetPhone = normalizePhoneNumber(customer.phone || "");
      const fileName = `Statement_${customer.name}_${format(new Date(), "dd_MMM_yyyy")}.pdf`;

      const formattedTransactionsList = filteredTransactions
        .slice(0, 15)
        .map((t) => {
          const dateStr = format(t.date, "dd MMM yyyy");
          const amountStr = formatCurrency(
            t.debit > 0 ? t.debit : t.credit,
            "INR",
          );
          const typeStr = t.debit > 0 ? "DR (+)" : "CR (-)";
          return `📅 ${dateStr} - ${t.description}\n    [${typeStr}] ${amountStr}`;
        })
        .join("\n");

      const extraCount =
        filteredTransactions.length > 15
          ? `\n...and ${filteredTransactions.length - 15} more transactions.`
          : "";

      const bizName = sellerInfo?.business_name || "INVOCENTRIC";
      const bizPhone = sellerInfo?.phone
        ? `\n*Contact:* ${sellerInfo.phone}`
        : "";

      const shareText =
        `*STATEMENT OF ACCOUNT*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Shop:* ${bizName}${bizPhone}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Customer:* ${customer.name}\n` +
        `*Period:* ${format(new Date(dateRange.start), "dd MMM yyyy")} to ${format(new Date(dateRange.end), "dd MMM yyyy")}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `*SUMMARY:*\n` +
        `• Total Invoiced: ${formatCurrency(totals.totalInvoiced, "INR")}\n` +
        `• Total Paid: ${formatCurrency(totals.totalPaid, "INR")}\n` +
        `• *Outstanding Balance: ${formatCurrency(totals.balance, "INR")}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `*RECENT TRANSACTIONS:*\n` +
        `${formattedTransactionsList || "No transactions in this period."}${extraCount}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `Generated via InvoCentric.\n` +
        `Thank you for your business!`;

      const whatsappUrl = getWhatsAppShareUrl(targetPhone, shareText);
      const whatsappWebUrl = getWhatsAppWebUrl(targetPhone, shareText);
      const whatsappAppUrl = getWhatsAppAppUrl(targetPhone, shareText);
      setWhatsAppShareText(shareText);
      setWhatsAppUrlState(whatsappUrl);
      setWhatsAppWebUrlState(whatsappWebUrl);
      setWhatsAppAppUrlState(whatsappAppUrl);
      setGeneratedPdfFileName(fileName);

      // 1. Launch WhatsApp URL immediately
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobileDevice) {
        window.location.href = whatsappUrl;
      } else {
        window.open(whatsappUrl, '_blank');
      }

      setShowWhatsAppModal(true);

      // 2. Generate PDF & download in background
      const blob = await generatePdfBlob();
      if (blob) {
        setGeneratedPdfBlob(blob);
        try {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 3000);
        } catch (dlErr) {
          console.error("Auto download statement PDF failed:", dlErr);
        }
      }

      // Copy statement summary to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(shareText);
          clipCopied = true;
          setCopiedToClipboard(true);
        } catch (clipErr) {
          console.error("Could not copy statement summary to clipboard:", clipErr);
          setCopiedToClipboard(false);
        }
      } else {
        setCopiedToClipboard(false);
      }
    } catch (err) {
      console.error("WhatsApp share failed:", err);
      alert("Failed to share via WhatsApp. Please try printing or downloading.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDirectPdfShare = async () => {
    if (!generatedPdfBlob) return;
    try {
      const fileToShare = new File([generatedPdfBlob], generatedPdfFileName, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
          title: `Statement - ${customer?.name}`,
          text: whatsAppShareText,
        });
      } else {
        alert("Direct PDF sharing is not supported on this browser/device. Please download the PDF or copy the summary.");
      }
    } catch (err: any) {
      const errStr = err?.message?.toLowerCase() || String(err).toLowerCase();
      if (err?.name === 'AbortError' || errStr.includes('share canceled') || errStr.includes('cancelled') || errStr.includes('cancel')) {
        return;
      }
      console.error("Direct PDF share failed:", err);
    }
  };

  useEffect(() => {
    // Auto-trigger share flow if ?share=true query param is present
    const searchParams = new URLSearchParams(window.location.search);
    if (
      searchParams.get("share") === "true" &&
      customer &&
      transactions.length > 0
    ) {
      // Clear the share param to avoid re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, "", newUrl);

      // Delay slightly to ensure fonts/layout are stable
      const timer = setTimeout(() => {
        handleWhatsAppShare();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [customer, transactions]);

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Logo size={48} className="opacity-20" />
        <p className="text-neutral-500 font-bold">
          Select a party to view statement
        </p>
        <Link to="/customers" className="btn-primary">
          Go to Parties
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/customers" className="btn-secondary p-2 rounded-xl">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-neutral-900 leading-none">
                Billing Statement
              </h1>
              <button
                onClick={openEditModal}
                className="text-neutral-400 hover:text-green-600 transition-colors"
                title="Edit Customer"
              >
                <Edit2 size={16} />
              </button>
            </div>
            <p className="text-xs font-bold text-neutral-500 mt-1 uppercase tracking-widest">
              {customer.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={templateStyle}
            onChange={(e) => setTemplateStyle(e.target.value as "excel" | "thermal")}
            className="px-3 py-2 text-xs font-black uppercase tracking-wider bg-white border border-neutral-200 rounded-xl text-neutral-700 shadow-sm hover:border-neutral-300 transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-neutral-400"
          >
            <option value="excel">Standard A4</option>
            <option value="thermal">POS Thermal (80mm)</option>
          </select>

          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="btn-secondary flex items-center gap-2 py-2 text-xs bg-green-50 text-green-700 border-green-100"
          >
            {isDownloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            PDF
          </button>

          <button
            onClick={handleWhatsAppShare}
            disabled={isDownloading}
            className="btn-primary flex items-center gap-2 py-2 text-xs bg-[#25D366] hover:bg-[#128C7E] border-none"
          >
            <WhatsAppIcon size={18} />
            WhatsApp
          </button>

          <button
            onClick={handlePrint}
            className="btn-secondary flex items-center gap-2 py-2 text-xs"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="btn-primary flex items-center gap-2 py-2 text-xs"
          >
            <Plus size={16} />
            Add Payment
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <div className="glass-card p-6 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <TrendingDown size={20} />
            </div>
            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">
              Total Sales
            </span>
          </div>
          <p className="text-2xl font-black text-neutral-900">
            {formatCurrency(totals.totalInvoiced, "INR")}
          </p>
          <p className="text-xs font-bold text-neutral-400 mt-1 uppercase">
            Across all transactions
          </p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">
              Total Received
            </span>
          </div>
          <p className="text-2xl font-black text-neutral-900">
            {formatCurrency(totals.totalPaid, "INR")}
          </p>
          <p className="text-xs font-bold text-neutral-400 mt-1 uppercase">
            Payments recorded
          </p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <Wallet size={20} />
            </div>
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
              Running Balance
            </span>
          </div>
          <p className="text-2xl font-black text-neutral-900">
            {formatCurrency(totals.balance, "INR")}
          </p>
          <p className="text-xs font-bold text-neutral-400 mt-1 uppercase">
            Net amount pending
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-neutral-400" />
            <input
              type="date"
              className="input-field py-1 text-sm bg-transparent border-none focus:ring-0 w-32"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
            />
            <span className="text-neutral-400 font-bold">to</span>
            <input
              type="date"
              className="input-field py-1 text-sm bg-transparent border-none focus:ring-0 w-32"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={14}
            />
            <input
              type="text"
              placeholder="Search description..."
              className="input-field pl-9 py-1 text-sm md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Statement Table */}
      <div
        ref={statementRef}
        className={cn(
          "transition-all duration-200",
          templateStyle === "thermal"
            ? "thermal-statement-container bg-white p-6 border border-dashed border-neutral-300 w-full max-w-[340px] mx-auto text-black font-mono shadow-sm"
            : "glass-card overflow-hidden bg-white print:shadow-none print:border-none p-4 md:p-8"
        )}
        style={{
          fontFamily: templateStyle === "thermal" ? "'JetBrains Mono', Courier, monospace" : undefined,
        }}
      >
        {/* Thermal POS Header */}
        {templateStyle === "thermal" && (
          <div className="relative z-10 w-full flex flex-col text-xs leading-relaxed text-black thermal-printable mb-4">
            {/* Header Section */}
            <div className="text-center mb-4 pb-3 border-b border-dashed border-black">
              <h1 className="text-sm font-black uppercase tracking-tight leading-none mb-1 text-black">
                {sellerInfo?.business_name || "INVOCENTRIC"}
              </h1>
              <div className="space-y-0.5 text-[9px] text-black">
                {sellerInfo?.address && (
                  <p className="font-bold">{sellerInfo.address}</p>
                )}
                {sellerInfo?.phone && (
                  <p className="font-bold">TEL: {sellerInfo.phone}</p>
                )}
                {sellerInfo?.email && (
                  <p className="font-bold">EMAIL: {sellerInfo.email}</p>
                )}
                {sellerInfo?.gstin && (
                  <p className="font-black">GSTIN: {sellerInfo.gstin}</p>
                )}
              </div>
            </div>

            {/* Title & Customer details */}
            <div className="text-center font-bold text-[9px] tracking-widest uppercase mb-3 border-b border-dashed border-black pb-2">
              <span>* CUSTOMER STATEMENT *</span>
              <div className="text-left mt-2 tracking-normal font-medium text-[9px] uppercase space-y-0.5 text-black">
                <div className="flex justify-between font-bold text-[9px] uppercase text-black">
                  <span>CLIENT:</span>
                  <span className="font-black text-black">{customer?.name}</span>
                </div>
                {customer?.phone && (
                  <div className="flex justify-between font-bold text-[9px] uppercase text-black">
                    <span>MOBILE:</span>
                    <span className="tabular-nums font-black">{customer.phone}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[9px] uppercase text-black">
                  <span>PERIOD:</span>
                  <span className="font-black">
                    {format(new Date(dateRange.start), "dd/MM/yy")} - {format(new Date(dateRange.end), "dd/MM/yy")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Standard Printable Header */}
        {templateStyle === "excel" && (
          <div
            className={cn(
              "p-8 border-b-2 border-neutral-900 mb-8",
              isGeneratingDoc ? "block" : "hidden print:block",
            )}
          >
          <div className="flex justify-between items-start">
            <div className="flex gap-4 items-start">
              {sellerInfo?.logo_url ? (
                <img
                  src={sellerInfo.logo_url}
                  alt="Logo"
                  className="h-16 w-auto object-contain mt-1"
                />
              ) : (
                <Logo size={48} className="mt-1" />
              )}
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight text-neutral-900">
                  {sellerInfo?.business_name || "INVOCENTRIC"}
                </h2>
                {sellerInfo?.company_name && (
                  <p className="text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    {sellerInfo.company_name}
                  </p>
                )}
                {sellerInfo?.address && (
                  <p className="text-[10px] text-neutral-500 mt-1 max-w-sm">
                    {sellerInfo.address}
                  </p>
                )}
                {(sellerInfo?.phone || sellerInfo?.email) && (
                  <p className="text-[10px] text-neutral-400 mt-1">
                    {sellerInfo?.phone && (
                      <span>Phone: {sellerInfo.phone}</span>
                    )}
                    {sellerInfo?.phone && sellerInfo?.email && (
                      <span className="mx-2">|</span>
                    )}
                    {sellerInfo?.email && (
                      <span>Email: {sellerInfo.email}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-extrabold uppercase tracking-widest text-neutral-400 mb-2">
                Customer Statement
              </h2>
              <p className="text-xs font-bold uppercase text-neutral-400">
                Statement Period
              </p>
              <p className="text-sm font-black">
                {format(new Date(dateRange.start), "dd MMM yyyy")} -{" "}
                {format(new Date(dateRange.end), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          <div className="mt-12 flex justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-2">
                Statement For
              </p>
              <h3 className="text-xl font-black uppercase">{customer.name}</h3>
              {customer.company_name && (
                <p className="text-sm font-bold text-neutral-500">
                  {customer.company_name}
                </p>
              )}
              {customer.address && (
                <p className="text-xs text-neutral-400 mt-2 max-w-xs">
                  {customer.address}
                </p>
              )}
            </div>
            <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex flex-col justify-center text-right">
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1">
                Total Outstanding
              </p>
              <p className="text-3xl font-black text-neutral-900">
                {formatCurrency(totals.balance, "INR")}
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Thermal POS Table/Body */}
        {templateStyle === "thermal" && (
          <div className="relative z-10 w-full flex flex-col text-xs leading-relaxed text-black thermal-printable">
            {/* Table Header */}
            <div className="mb-2">
              <div className="border-b border-dashed border-black pb-1 mb-1 font-bold text-[9px] uppercase text-black grid grid-cols-12 gap-1 text-left">
                <span className="col-span-3">DATE</span>
                <span className="col-span-5">DESC</span>
                <span className="col-span-4 text-right">AMOUNT</span>
              </div>

              {/* Transactions List */}
              <div className="space-y-1 border-b border-dashed border-black pb-2">
                {filteredTransactions.length === 0 ? (
                  <p className="text-center py-4 text-neutral-500 font-bold uppercase tracking-wider text-[9px]">
                    No transactions found
                  </p>
                ) : (
                  filteredTransactions.map((t) => {
                    const amt = t.type === "invoice" ? t.debit : t.credit;
                    const sign = t.type === "invoice" ? "+" : "-";
                    return (
                      <div key={t.id} className="grid grid-cols-12 gap-1 text-[9px] text-black">
                        <span className="col-span-3 font-bold tabular-nums">
                          {format(t.date, "dd/MM/yy")}
                        </span>
                        <span className="col-span-5 truncate font-medium uppercase">
                          {t.description}
                        </span>
                        <span className={cn(
                          "col-span-4 text-right font-black tabular-nums",
                          t.type === "invoice" ? "text-rose-600" : "text-green-600"
                        )}>
                          {sign}{formatCurrency(amt, "INR")}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Totals Block */}
            <div className="space-y-1 text-right font-black uppercase text-[9px] border-b border-dashed border-black pb-2">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-bold">TOTAL DEBIT (+):</span>
                <span className="tabular-nums">
                  {formatCurrency(
                    filteredTransactions.reduce((acc, t) => acc + t.debit, 0),
                    "INR"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-bold">TOTAL CREDIT (-):</span>
                <span className="tabular-nums">
                  {formatCurrency(
                    filteredTransactions.reduce((acc, t) => acc + t.credit, 0),
                    "INR"
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-black pt-1 text-[10px] font-black">
                <span>BAL OUTSTANDING:</span>
                <span className="tabular-nums text-black">
                  {formatCurrency(totals.balance, "INR")}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[8px] text-neutral-500 mt-4 pt-1 font-bold uppercase tracking-wider">
              <p>Thank you for billing with us</p>
            </div>
          </div>
        )}

        {templateStyle === "excel" && (
          <>
            <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-neutral-300 text-xs text-left">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-300 print:bg-neutral-100">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-700 border border-neutral-300">
                  Date
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-700 border border-neutral-300">
                  Description
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-neutral-700 border border-neutral-300">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-neutral-700 border border-neutral-300">
                  Debit (+)
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-neutral-700 border border-neutral-300">
                  Credit (-)
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-neutral-700 border border-neutral-300">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-neutral-400 font-bold uppercase tracking-widest border border-neutral-300"
                  >
                    No transactions found in this period
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t, i) => {
                  // Calculate balance running forward would be better for a full ledger,
                  // but for a view we can just show the txn amount
                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        onClick={() => t.type === "invoice" && toggleRow(t.id)}
                        className={cn(
                          "group transition-all print:hover:bg-transparent border-b border-neutral-200",
                          i % 2 === 0 ? "bg-white" : "bg-neutral-50/50",
                          t.type === "invoice"
                            ? "cursor-pointer hover:bg-neutral-100/40"
                            : "hover:bg-neutral-100/20",
                        )}
                      >
                        <td className="px-4 py-3 text-xs font-bold text-neutral-900 tabular-nums align-top border border-neutral-200">
                          {format(t.date, "dd MMM yyyy")}
                        </td>
                        <td className="px-4 py-3 align-top border border-neutral-200">
                          <div className="flex items-center gap-2">
                            {t.type === "invoice" && (
                              <motion.div
                                animate={{
                                  rotate: expandedRows.has(t.id) ? 90 : 0,
                                }}
                                className="text-neutral-400 print:hidden"
                              >
                                <ChevronRight size={14} />
                              </motion.div>
                            )}
                            <p className="text-xs font-black text-neutral-900">
                              {t.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center align-top border border-neutral-200">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight",
                              t.type === "invoice"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-green-50 text-green-700",
                            )}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-black text-rose-600 tabular-nums align-top border border-neutral-200">
                          {t.debit > 0 ? formatCurrency(t.debit, "INR") : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-black text-green-600 tabular-nums align-top border border-neutral-200">
                          {t.credit > 0
                            ? `- ${formatCurrency(t.credit, "INR")}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-black text-neutral-900 tabular-nums align-top border border-neutral-200">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-neutral-500 text-[10px] font-medium mr-1">
                              {formatCurrency(
                                filteredTransactions
                                  .slice(0, i + 1)
                                  .reduce(
                                    (acc, curr) =>
                                      acc + (curr.debit - curr.credit),
                                    0,
                                  ),
                                "INR",
                              )}
                            </span>
                            {t.type === "invoice" ? (
                              <Link
                                to={`/invoices/${t.id}`}
                                className="p-1 hover:bg-white rounded border border-transparent hover:border-neutral-200 transition-all print:hidden shadow-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Edit2 size={12} className="text-neutral-500" />
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {t.type === "invoice" &&
                        (expandedRows.has(t.id) || isGeneratingDoc) && (
                          <tr className="bg-neutral-50/20 print:bg-transparent">
                            <td
                              colSpan={6}
                              className="p-4 border border-neutral-200"
                            >
                              <div className="bg-white p-4 print:p-2 print:bg-transparent border border-neutral-300 rounded-lg">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="text-[9px] font-black uppercase text-neutral-500 tracking-widest bg-neutral-100 border-b border-neutral-300">
                                      <th className="py-2 px-3 text-left border border-neutral-200">
                                        Item Description
                                      </th>
                                      <th className="py-2 px-3 text-center hidden sm:table-cell border border-neutral-200">
                                        HSN/SAC
                                      </th>
                                      <th className="py-2 px-3 text-right border border-neutral-200">
                                        Qty
                                      </th>
                                      <th className="py-2 px-3 text-right border border-neutral-200">
                                        Rate
                                      </th>
                                      <th className="py-2 px-3 text-right border border-neutral-200">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(t as any).items?.map(
                                      (item: any, idx: number) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-neutral-200 hover:bg-neutral-50/50"
                                        >
                                          <td className="py-2 px-3 font-bold text-neutral-800 border border-neutral-200">
                                            {item.description}
                                            {item.size && (
                                              <span className="ml-2 text-[9px] font-black text-green-500 bg-green-50 px-1.5 rounded uppercase tracking-tighter">
                                                Size: {item.size}
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center text-neutral-500 font-medium hidden sm:table-cell border border-neutral-200">
                                            {item.hsn || "-"}
                                          </td>
                                          <td className="py-2 px-3 text-right tabular-nums font-medium text-neutral-600 border border-neutral-200">
                                            {item.quantity}
                                          </td>
                                          <td className="py-2 px-3 text-right tabular-nums font-medium text-neutral-600 border border-neutral-200">
                                            {formatCurrency(item.price, "INR")}
                                          </td>
                                          <td className="py-2 px-3 text-right font-black text-neutral-900 tabular-nums border border-neutral-200">
                                            {formatCurrency(
                                              item.quantity * item.price,
                                              "INR",
                                            )}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                                {/* Detail Footer */}
                                {(t as any).subtotal && (
                                  <div className="mt-3 pt-3 flex flex-col items-end gap-1 border-t border-neutral-300">
                                    <div className="flex justify-between w-full max-w-[200px] text-[10px]">
                                      <span className="font-bold text-neutral-500 uppercase">
                                        Subtotal
                                      </span>
                                      <span className="font-bold text-neutral-900 tabular-nums">
                                        {formatCurrency(
                                          (t as any).subtotal,
                                          "INR",
                                        )}
                                      </span>
                                    </div>
                                    {(t as any).tax > 0 && (
                                      <div className="flex justify-between w-full max-w-[200px] text-[10px]">
                                        <span className="font-bold text-neutral-500 uppercase">
                                          Tax
                                        </span>
                                        <span className="font-bold text-neutral-900 tabular-nums">
                                          {formatCurrency(
                                            (t as any).tax,
                                            "INR",
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between w-full max-w-[200px] text-[11px] pt-1">
                                      <span className="font-black text-neutral-900 uppercase tracking-tight">
                                        Invoice Total
                                      </span>
                                      <span className="font-black text-green-600 tabular-nums">
                                        {formatCurrency(t.debit, "INR")}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {filteredTransactions.length > 0 && (
              <tfoot className="bg-neutral-100 font-black print:bg-neutral-100 border-t-2 border-neutral-300">
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-neutral-700 border border-neutral-300"
                  >
                    Period Totals
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-rose-600 border border-neutral-300">
                    {formatCurrency(
                      filteredTransactions.reduce((acc, t) => acc + t.debit, 0),
                      "INR",
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-green-600 border border-neutral-300">
                    -{" "}
                    {formatCurrency(
                      filteredTransactions.reduce(
                        (acc, t) => acc + t.credit,
                        0,
                      ),
                      "INR",
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-neutral-900 border border-neutral-300">
                    {formatCurrency(
                      filteredTransactions.reduce(
                        (acc, t) => acc + (t.debit - t.credit),
                        0,
                      ),
                      "INR",
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Statement Footer Branding */}
        <div className="hidden print:flex justify-between items-center mt-12 pt-6 border-t border-dashed border-neutral-300 text-[10px] text-neutral-400 uppercase tracking-widest font-bold px-4">
          <p>{sellerInfo?.business_name || "Statement of Account"}</p>
          <p>This is a computer generated document</p>
        </div>
          </>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => setShowPaymentModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
          >
            <h2 className="text-2xl font-black text-neutral-900 mb-6 uppercase tracking-tighter">
              Record Payment
            </h2>

            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="label block mb-2">Amount Received (₹)</label>
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/^0+(?=\d)/, "");
                    e.target.value = cleaned;
                    setPaymentAmount(cleaned);
                  }}
                  onFocus={(e) => e.target.select()}
                  className="input-field text-xl font-black py-4"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="label block mb-2">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label block mb-2">Note (Optional)</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="input-field min-h-[80px]"
                  placeholder="e.g. Received via GPay"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary flex-1 py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="btn-primary flex-1 py-3"
                >
                  {isSubmittingPayment ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">
                Edit Customer
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditCustomer} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label block mb-2">Full Name</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="John Doe"
                      value={customerFormData.name}
                      onChange={(e) =>
                        setCustomerFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-2">Company Name</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Acme Corp"
                      value={customerFormData.company_name}
                      onChange={(e) =>
                        setCustomerFormData((prev) => ({
                          ...prev,
                          company_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label block mb-2">GST Number</label>
                    <input
                      type="text"
                      className="input-field uppercase"
                      placeholder="22AAAAA0000A1Z5"
                      value={customerFormData.gst_number}
                      onChange={(e) =>
                        setCustomerFormData((prev) => ({
                          ...prev,
                          gst_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-2">Email Address</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="john@example.com"
                      value={customerFormData.email}
                      onChange={(e) =>
                        setCustomerFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label block mb-2">Phone</label>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="+91 98765 43210"
                      value={customerFormData.phone}
                      onChange={(e) =>
                        setCustomerFormData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-2">Address</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="City, State, Country"
                      value={customerFormData.address}
                      onChange={(e) =>
                        setCustomerFormData((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary flex-1 py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="btn-primary flex-1 py-3"
                >
                  {isSubmittingCustomer ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* WhatsApp Helper Instructions Modal */}
      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        whatsAppUrl={whatsAppUrlState}
        whatsAppWebUrl={whatsAppWebUrlState}
        whatsAppAppUrl={whatsAppAppUrlState}
        documentTitle="Customer Statement"
        copiedToClipboard={copiedToClipboard}
        fileName={generatedPdfFileName || `Statement_${customer?.name || 'Customer'}.pdf`}
        onDirectSharePdf={generatedPdfBlob ? handleDirectPdfShare : undefined}
      />
    </div>
  );
}
