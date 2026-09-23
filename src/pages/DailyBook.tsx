import React, { useState, useMemo, useRef } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  ShoppingBag,
  TrendingDown,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clock,
  Printer,
  Phone,
  Download,
  LoaderCircle,
  FileSpreadsheet,
  Share2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCurrency, getWhatsAppShareUrl, isMobile, openInBrowser } from "../lib/utils";
import { useData, useSettings } from "../hooks/useData";
import { exportToExcel } from "../services/excelService";
import { WhatsAppShareModal } from "../components/WhatsAppShareModal";
import { WhatsAppIcon } from "../components/WhatsAppIcon";

// Helper function to safely extract the local date string (YYYY-MM-DD)
const formatDateString = (dateVal: any): string => {
  if (!dateVal) return "";

  let d: Date;
  if (typeof dateVal.toDate === "function") {
    d = dateVal.toDate();
  } else if (typeof dateVal === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return dateVal;
    }
    if (/^\d{4}-\d{2}-\d{2}T00:00:00/.test(dateVal)) {
      return dateVal.split("T")[0];
    }
    d = new Date(dateVal);
  } else {
    d = new Date(dateVal);
  }

  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateSafe = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (typeof dateVal.toDate === "function") return dateVal.toDate();
  if (dateVal instanceof Date) return dateVal;
  return new Date(dateVal);
};

export default function DailyBook() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const dailyBookPrintRef = useRef<HTMLDivElement>(null);

  // WhatsApp Share Modal States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppShareText, setWhatsAppShareText] = useState("");
  const [whatsAppUrlState, setWhatsAppUrlState] = useState("");
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);
  const [generatedPdfFileName, setGeneratedPdfFileName] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const {
    invoices = [],
    payments = [],
    expenses = [],
    purchases = [],
    customers = [],
  } = useData();
  const { settings } = useSettings();

  const currentDayEvents = useMemo(() => {
    // Sales (Invoices)
    const daySales = invoices.filter((inv) => {
      const formatted = formatDateString(inv.date || inv.created_at);
      return formatted === selectedDate;
    });
    const totalSalesAmount = daySales.reduce(
      (sum, inv) => sum + (inv.amount || 0),
      0,
    );

    // Payments Received
    const dayPayments = payments
      .filter((pay) => {
        const formatted = formatDateString(pay.date);
        return formatted === selectedDate;
      })
      .map((pay) => {
        const cust = customers.find((c: any) => c.id === pay.customer_id);
        return {
          ...pay,
          customer_name: cust ? cust.name : "Walk-in Customer",
        };
      });
    const totalPaymentsReceived = dayPayments.reduce(
      (sum, pay) => sum + (pay.amount || 0),
      0,
    );

    // Purchases
    const dayPurchases = purchases.filter((pur) => {
      const formatted = formatDateString(pur.date);
      return formatted === selectedDate;
    });
    const totalPurchasesAmount = dayPurchases.reduce(
      (sum, pur) => sum + (pur.amount || 0),
      0,
    );

    // Expenses
    const dayExpenses = expenses.filter((exp) => {
      const formatted = formatDateString(exp.date);
      return formatted === selectedDate;
    });
    const totalExpensesAmount = dayExpenses.reduce(
      (sum, exp) => sum + (exp.amount || 0),
      0,
    );

    return {
      sales: {
        total: totalSalesAmount,
        count: daySales.length,
        items: daySales,
      },
      payments: {
        total: totalPaymentsReceived,
        count: dayPayments.length,
        items: dayPayments,
      },
      purchases: {
        total: totalPurchasesAmount,
        count: dayPurchases.length,
        items: dayPurchases,
      },
      expenses: {
        total: totalExpensesAmount,
        count: dayExpenses.length,
        items: dayExpenses,
      },
      netBalance:
        totalPaymentsReceived - totalPurchasesAmount - totalExpensesAmount,
    };
  }, [invoices, payments, expenses, purchases, customers, selectedDate]);

  const {
    sales,
    payments: payStats,
    purchases: purStats,
    expenses: expStats,
    netBalance,
  } = currentDayEvents;

  // Combined chronologically ordered transaction list for Excel day book view
  const allCombinedTransactions = useMemo(() => {
    const list: any[] = [];

    // Receipts / Payments In
    currentDayEvents.payments.items.forEach((p: any) => {
      list.push({
        id: `pay-${p.id}`,
        type: 'PAYMENT_IN',
        typeLabel: 'Receipt',
        party: p.customer_name || 'Walk-in Customer',
        details: p.note || 'Payment Received',
        method: p.method || 'Cash',
        cashIn: p.amount || 0,
        cashOut: 0,
        time: p.created_at ? format(parseDateSafe(p.created_at), 'hh:mm a') : 'Today',
      });
    });

    // Sales
    currentDayEvents.sales.items.forEach((s: any) => {
      list.push({
        id: `sale-${s.id}`,
        type: 'SALE',
        typeLabel: 'Sale Bill',
        party: s.customer_name || 'Customer',
        details: `Invoice #${s.invoice_number}`,
        method: s.status === 'paid' ? 'Paid' : 'Invoice / Unpaid',
        cashIn: s.amount || 0,
        cashOut: 0,
        time: s.created_at ? format(parseDateSafe(s.created_at), 'hh:mm a') : 'Today',
      });
    });

    // Purchases
    currentDayEvents.purchases.items.forEach((pur: any) => {
      list.push({
        id: `pur-${pur.id}`,
        type: 'PURCHASE',
        typeLabel: 'Purchase',
        party: pur.supplier_name || 'Vendor',
        details: pur.description || 'Stock Purchase',
        method: pur.payment_method || 'Cash',
        cashIn: 0,
        cashOut: pur.amount || 0,
        time: pur.created_at ? format(parseDateSafe(pur.created_at), 'hh:mm a') : 'Today',
      });
    });

    // Expenses
    currentDayEvents.expenses.items.forEach((exp: any) => {
      list.push({
        id: `exp-${exp.id}`,
        type: 'EXPENSE',
        typeLabel: 'Expense',
        party: exp.category || 'Expense',
        details: exp.description || 'Business Expense',
        method: 'Cash/Bank',
        cashIn: 0,
        cashOut: exp.amount || 0,
        time: exp.created_at ? format(parseDateSafe(exp.created_at), 'hh:mm a') : 'Today',
      });
    });

    return list;
  }, [currentDayEvents]);

  // Navigation handlers
  const handlePreviousDay = () => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().split("T")[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextDay = () => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d.toISOString().split("T")[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  // PDF Download Handler
  const handleDownloadPDF = async (): Promise<Blob | null> => {
    setIsDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!dailyBookPrintRef.current) {
        throw new Error("Daily Book printable element is not mounted");
      }

      const dataUrl = await toPng(dailyBookPrintRef.current, {
        quality: 1.0,
        pixelRatio: 2.0,
        backgroundColor: "#ffffff",
        fontEmbedCSS: "",
        skipFonts: true,
        style: {
          transform: "none",
          opacity: "1",
          visibility: "visible",
          display: "block",
        },
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const imgWidth = pdfWidth - margin * 2;
      const imgHeight = (img.height * imgWidth) / img.width;

      pdf.addImage(dataUrl, "PNG", margin, margin, imgWidth, imgHeight);

      const fileName = `InvoCentric_Daily_Book_${selectedDate}.pdf`;
      const blob = pdf.output("blob");

      // Auto trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return blob;
    } catch (err) {
      console.error("Failed to generate Daily Book PDF:", err);
      alert("Error generating PDF document.");
      return null;
    } finally {
      setIsDownloading(false);
    }
  };

  // Excel (.xlsx) Download Handler
  const handleExportExcel = () => {
    const rows: any[] = [];

    // Receipts / Payments In
    currentDayEvents.payments.items.forEach((pay: any, idx: number) => {
      rows.push({
        '#': idx + 1,
        'Date': selectedDate,
        'Type': 'Payment Received',
        'Party / Customer': pay.customer_name || 'Walk-in Customer',
        'Particulars / Notes': pay.note || 'Payment In',
        'Payment Method': pay.method || 'Cash',
        'Cash In (+ ₹)': pay.amount || 0,
        'Cash Out (- ₹)': 0,
      });
    });

    // Invoices / Sales
    currentDayEvents.sales.items.forEach((inv: any) => {
      rows.push({
        '#': rows.length + 1,
        'Date': selectedDate,
        'Type': 'Sale Invoice',
        'Party / Customer': inv.customer_name || 'Customer',
        'Particulars / Notes': `Invoice #${inv.invoice_number}`,
        'Payment Method': inv.status === 'paid' ? 'Paid' : 'Unpaid / Credit',
        'Cash In (+ ₹)': inv.amount || 0,
        'Cash Out (- ₹)': 0,
      });
    });

    // Purchases
    currentDayEvents.purchases.items.forEach((pur: any) => {
      rows.push({
        '#': rows.length + 1,
        'Date': selectedDate,
        'Type': 'Purchase',
        'Party / Customer': pur.supplier_name || 'Vendor',
        'Particulars / Notes': pur.description || 'Stock Purchase',
        'Payment Method': pur.payment_method || 'Cash',
        'Cash In (+ ₹)': 0,
        'Cash Out (- ₹)': pur.amount || 0,
      });
    });

    // Expenses
    currentDayEvents.expenses.items.forEach((exp: any) => {
      rows.push({
        '#': rows.length + 1,
        'Date': selectedDate,
        'Type': 'Expense',
        'Party / Customer': exp.category || 'Expense',
        'Particulars / Notes': exp.description || 'Business Expense',
        'Payment Method': 'Cash/Bank',
        'Cash In (+ ₹)': 0,
        'Cash Out (- ₹)': exp.amount || 0,
      });
    });

    // Summary Totals
    rows.push({
      '#': 'SUMMARY',
      'Date': selectedDate,
      'Type': 'GRAND TOTALS',
      'Party / Customer': 'Daily Summary',
      'Particulars / Notes': 'Net Daily Balance Statement',
      'Payment Method': '-',
      'Cash In (+ ₹)': currentDayEvents.payments.total,
      'Cash Out (- ₹)': currentDayEvents.purchases.total + currentDayEvents.expenses.total,
    });

    rows.push({
      '#': 'BALANCE',
      'Date': selectedDate,
      'Type': 'NET CASH FLOW',
      'Party / Customer': 'Final Cash Balance',
      'Particulars / Notes': 'Payments In minus Purchases & Expenses',
      'Payment Method': '-',
      'Cash In (+ ₹)': currentDayEvents.netBalance,
      'Cash Out (- ₹)': 0,
    });

    exportToExcel(rows, `InvoCentric_Daily_Book_${selectedDate}`);
  };

  // WhatsApp Share Handler
  const handleWhatsAppShare = async () => {
    const bizName = settings?.business_name || "INVOCENTRIC";
    const bizPhone = settings?.phone ? `\n*Contact:* ${settings.phone}` : "";

    const shareText =
      `*DAILY CASH BOOK SUMMARY*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Shop:* ${bizName}${bizPhone}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Date:* ${format(parseISO(selectedDate), "dd MMM yyyy")}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*DAILY METRICS:*\n` +
      `• Total Invoiced Sales: ${formatCurrency(currentDayEvents.sales.total, "INR")} (${currentDayEvents.sales.count} bills)\n` +
      `• Total Payments Received: ${formatCurrency(currentDayEvents.payments.total, "INR")}\n` +
      `• Total Purchases Paid: ${formatCurrency(currentDayEvents.purchases.total, "INR")}\n` +
      `• Total Expenses Paid: ${formatCurrency(currentDayEvents.expenses.total, "INR")}\n` +
      `• *Net Cash Flow Balance: ${formatCurrency(currentDayEvents.netBalance, "INR")}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Generated via InvoCentric.\n` +
      `Thank you!`;

    const fileName = `InvoCentric_Daily_Book_${selectedDate}.pdf`;
    const whatsappUrl = getWhatsAppShareUrl("", shareText);

    setWhatsAppShareText(shareText);
    setWhatsAppUrlState(whatsappUrl);
    setGeneratedPdfFileName(fileName);

    // 1. OPEN WHATSAPP IMMEDIATELY without waiting for async image/PDF rendering!
    if (isMobile()) {
      window.location.href = whatsappUrl;
    } else {
      openInBrowser(whatsappUrl);
    }

    setShowWhatsAppModal(true);

    // 2. Perform background text clipboard copy and PDF generation
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopiedToClipboard(true);
      }
    } catch (clipErr) {
      setCopiedToClipboard(false);
    }

    try {
      const pdfBlob = await handleDownloadPDF();
      if (pdfBlob) {
        setGeneratedPdfBlob(pdfBlob);
      }
    } catch (e) {
      console.error("PDF generation failed during share:", e);
    }
  };

  const handleDirectPdfShare = async () => {
    if (!generatedPdfBlob) return;
    try {
      const pdfFile = new File([generatedPdfBlob], generatedPdfFileName, { type: "application/pdf" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Daily Cash Book - ${selectedDate}`,
          text: whatsAppShareText,
        });
      }
    } catch (err) {
      console.error("Direct PDF share failed:", err);
    }
  };

  const handlePrintDailyBook = () => {
    window.print();
  };

  // Human readable date label (e.g. "Today, 25 Jun 2026")
  const formattedHeaderDate = useMemo(() => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const parsedDate = parseISO(selectedDate);
      const isToday = selectedDate === todayStr;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const isYesterday = selectedDate === yesterdayStr;

      let prefix = "";
      if (isToday) prefix = "Today, ";
      else if (isYesterday) prefix = "Yesterday, ";

      return `${prefix}${format(parsedDate, "dd MMMM yyyy")}`;
    } catch (e) {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <>
      <div className="space-y-8 pb-20 max-w-6xl mx-auto print:hidden">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight uppercase">
            Daily Cash Book
          </h1>
          <p className="text-neutral-500 font-bold text-sm mt-1 uppercase tracking-wider">
            {formattedHeaderDate}
          </p>
        </div>

        {/* Date Navigation & Action Buttons Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleToday}
            className="px-4 py-2 text-xs font-black uppercase tracking-wider text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 rounded-xl transition duration-150"
          >
            Today
          </button>

          <div className="flex items-center bg-neutral-50 rounded-xl border border-neutral-200/60 p-1">
            <button
              onClick={handlePreviousDay}
              className="p-1.5 hover:bg-white active:bg-neutral-100 rounded-lg text-neutral-600 hover:text-neutral-900 transition"
              title="Previous Day"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2 px-2">
              <Calendar className="text-neutral-400" size={16} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-none bg-transparent p-0 text-xs font-black uppercase tracking-widest text-neutral-900 focus:ring-0 w-32"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-white active:bg-neutral-100 rounded-lg text-neutral-600 hover:text-neutral-900 transition"
              title="Next Day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={handlePrintDailyBook}
              className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Print Excel-Style Sheet"
            >
              <Printer size={15} />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-green-800 bg-green-50 hover:bg-green-100 border border-green-200/60 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Download PDF Statement"
            >
              {isDownloading ? (
                <LoaderCircle size={15} className="animate-spin text-green-600" />
              ) : (
                <Download size={15} className="text-green-700" />
              )}
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Export Excel Sheet (.xlsx)"
            >
              <FileSpreadsheet size={15} className="text-emerald-700" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[#25D366] hover:bg-[#128C7E] rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Download PDF & Share on WhatsApp"
            >
              <WhatsAppIcon size={16} />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Summary Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                Total Sales
              </p>
              <h3 className="text-2xl font-black text-neutral-900">
                {formatCurrency(sales.total, "INR")}
              </h3>
            </div>
          </div>
          <p className="text-xs font-bold text-neutral-500">
            {sales.count} Invoices created
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
              <CreditCard size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                Payments In
              </p>
              <h3 className="text-2xl font-black text-neutral-900">
                {formatCurrency(payStats.total, "INR")}
              </h3>
            </div>
          </div>
          <p className="text-xs font-bold text-neutral-500">
            {payStats.count} Transactions received
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                Purchases
              </p>
              <h3 className="text-2xl font-black text-neutral-900">
                {formatCurrency(purStats.total, "INR")}
              </h3>
            </div>
          </div>
          <p className="text-xs font-bold text-neutral-500">
            {purStats.count} Purchase records
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                Expenses
              </p>
              <h3 className="text-2xl font-black text-neutral-900">
                {formatCurrency(expStats.total, "INR")}
              </h3>
            </div>
          </div>
          <p className="text-xs font-bold text-neutral-500">
            {expStats.count} Expense records
          </p>
        </div>
      </motion.div>

      {/* Net Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#0f172a] p-8 rounded-[2rem] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg"
      >
        <div>
          <p className="text-xs font-black text-green-300 uppercase tracking-[0.2em] mb-2">
            Net Daily Cash Balance (Payments In - Purchases - Expenses)
          </p>
          <div className="flex items-center gap-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              {formatCurrency(netBalance, "INR")}
            </h2>
            <div
              className={`p-2.5 rounded-2xl ${netBalance >= 0 ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}
            >
              {netBalance >= 0 ? (
                <ArrowUpRight size={28} />
              ) : (
                <ArrowDownRight size={28} />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 border border-white/10"
          >
            <FileSpreadsheet size={16} />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-md"
          >
            <Download size={16} />
            <span>Download PDF</span>
          </button>
        </div>
      </motion.div>

      {/* Excel-Style Structured Table Section */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-green-700" />
              <span>Daily Cash Book Excel Ledger</span>
            </h3>
            <p className="text-xs text-neutral-500 font-bold mt-0.5">
              Structured grid view of all receipts, sales, purchases & expenses for {formattedHeaderDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-bold text-green-800 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 flex items-center gap-1.5"
            >
              <FileSpreadsheet size={14} />
              <span>.XLSX Sheet</span>
            </button>
            <button
              onClick={handlePrintDailyBook}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5"
            >
              <Printer size={14} />
              <span>Print View</span>
            </button>
          </div>
        </div>

        {allCombinedTransactions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
            <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-500">No transactions recorded for {selectedDate}</p>
            <p className="text-xs text-slate-400 mt-1">Select a different date using the calendar above to view historical entries.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card Feed */}
            <div className="block md:hidden divide-y divide-slate-100 space-y-2">
              {allCombinedTransactions.map((tx, idx) => (
                <div key={tx.id} className="p-3.5 bg-slate-50/70 rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        tx.type === 'PAYMENT_IN' ? 'bg-green-100 text-green-800' :
                        tx.type === 'SALE' ? 'bg-blue-100 text-blue-800' :
                        tx.type === 'PURCHASE' ? 'bg-orange-100 text-orange-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {tx.typeLabel}
                      </span>
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[150px]">{tx.party}</span>
                    </div>
                    <span className={`text-xs font-black tabular-nums ${tx.cashIn > 0 ? "text-green-700" : "text-rose-700"}`}>
                      {tx.cashIn > 0 ? `+${formatCurrency(tx.cashIn, "INR")}` : `-${formatCurrency(tx.cashOut, "INR")}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                    <span className="truncate max-w-[180px]">{tx.details}</span>
                    <span className="font-medium text-slate-400">{tx.method}</span>
                  </div>
                </div>
              ))}

              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between mt-3 font-black text-xs">
                <span>NET CASH FLOW:</span>
                <span className={netBalance >= 0 ? "text-green-400" : "text-rose-400"}>
                  {formatCurrency(netBalance, "INR")}
                </span>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-black uppercase text-[10px] tracking-wider border-b border-slate-300">
                    <th className="p-3 border-r border-slate-300 text-center w-12">#</th>
                    <th className="p-3 border-r border-slate-300 w-32">Type</th>
                    <th className="p-3 border-r border-slate-300">Party / Customer / Vendor</th>
                    <th className="p-3 border-r border-slate-300">Particulars / Details</th>
                    <th className="p-3 border-r border-slate-300 text-center w-28">Payment Method</th>
                    <th className="p-3 border-r border-slate-300 text-right w-32 bg-green-50/50 text-green-900">Cash In (+ ₹)</th>
                    <th className="p-3 text-right w-32 bg-rose-50/50 text-rose-900">Cash Out (- ₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allCombinedTransactions.map((tx, idx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50 transition-colors font-medium ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                    >
                      <td className="p-3 border-r border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3 border-r border-slate-200">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          tx.type === 'PAYMENT_IN' ? 'bg-green-100 text-green-800' :
                          tx.type === 'SALE' ? 'bg-blue-100 text-blue-800' :
                          tx.type === 'PURCHASE' ? 'bg-orange-100 text-orange-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {tx.typeLabel}
                        </span>
                      </td>
                      <td className="p-3 border-r border-slate-200 font-bold text-slate-900">{tx.party}</td>
                      <td className="p-3 border-r border-slate-200 text-slate-600">{tx.details}</td>
                      <td className="p-3 border-r border-slate-200 text-center text-slate-600 font-medium">{tx.method}</td>
                      <td className="p-3 border-r border-slate-200 text-right font-black text-green-700 bg-green-50/20">
                        {tx.cashIn > 0 ? `+${formatCurrency(tx.cashIn, "INR")}` : "-"}
                      </td>
                      <td className="p-3 text-right font-black text-rose-700 bg-rose-50/20">
                        {tx.cashOut > 0 ? `-${formatCurrency(tx.cashOut, "INR")}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400 uppercase text-xs">
                    <td colSpan={5} className="p-3 border-r border-slate-300 text-right">
                      TOTAL CASH IN & OUT:
                    </td>
                    <td className="p-3 border-r border-slate-300 text-right text-green-800 font-black text-sm bg-green-100/50">
                      +{formatCurrency(payStats.total, "INR")}
                    </td>
                    <td className="p-3 text-right text-rose-800 font-black text-sm bg-rose-100/50">
                      -{formatCurrency(purStats.total + expStats.total, "INR")}
                    </td>
                  </tr>
                  <tr className="bg-slate-800 text-white font-black uppercase text-xs">
                    <td colSpan={5} className="p-3 text-right tracking-wider">
                      NET CASH FLOW BALANCE:
                    </td>
                    <td colSpan={2} className={`p-3 text-right text-base font-black ${netBalance >= 0 ? "text-green-300" : "text-rose-300"}`}>
                      {formatCurrency(netBalance, "INR")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Category Breakdowns */}
      <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight pt-2">
        Category Breakdown Cards
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales / Invoices */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black text-neutral-500 uppercase tracking-widest">
              Invoices Created
            </h4>
            <span className="text-[10px] font-black bg-neutral-100 px-3 py-1 rounded-lg uppercase">
              {sales.count} Records
            </span>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {sales.items.length === 0 ? (
              <p className="text-sm font-bold text-neutral-400 text-center py-6">
                No sales today
              </p>
            ) : (
              sales.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl hover:bg-neutral-100/70 transition"
                >
                  <div>
                    <p className="text-sm font-black text-neutral-900 uppercase">
                      {item.customer_name || "Customer"}
                    </p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      Invoice #{item.invoice_number}
                    </p>
                  </div>
                  <p className="text-sm font-black text-neutral-900">
                    {formatCurrency(item.amount, "INR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payments In */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black text-neutral-500 uppercase tracking-widest">
              Payments Received
            </h4>
            <span className="text-[10px] font-black bg-neutral-100 px-3 py-1 rounded-lg uppercase">
              {payStats.count} Records
            </span>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {payStats.items.length === 0 ? (
              <p className="text-sm font-bold text-neutral-400 text-center py-6">
                No payments today
              </p>
            ) : (
              payStats.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-green-50/70 text-green-900 rounded-2xl hover:bg-green-50 transition"
                >
                  <div>
                    <p className="text-sm font-black uppercase text-green-900">
                      {item.customer_name}
                    </p>
                    <p className="text-[10px] font-bold text-green-700/70 uppercase tracking-widest">
                      {item.note || "Payment In"} ({item.method || "Cash"})
                    </p>
                  </div>
                  <p className="text-sm font-black">
                    +{formatCurrency(item.amount, "INR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Purchases */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black text-neutral-500 uppercase tracking-widest">
              Purchases
            </h4>
            <span className="text-[10px] font-black bg-neutral-100 px-3 py-1 rounded-lg uppercase">
              {purStats.count} Records
            </span>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {purStats.items.length === 0 ? (
              <p className="text-sm font-bold text-neutral-400 text-center py-6">
                No purchases today
              </p>
            ) : (
              purStats.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-orange-50/70 text-orange-900 rounded-2xl hover:bg-orange-50 transition"
                >
                  <div>
                    <p className="text-sm font-black uppercase">
                      {item.supplier_name || "Vendor"}
                    </p>
                    <div className="flex gap-2 items-center mt-0.5">
                      <p className="text-[10px] font-bold text-orange-700/70 uppercase tracking-widest">
                        {item.description || "Stock Items"}
                      </p>
                      <span
                        className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.status === "Unpaid" ? "bg-red-100 text-red-600 border border-red-200" : "bg-green-100 text-green-600 border border-green-200"}`}
                      >
                        {item.status || "Paid"}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-black">
                    -{formatCurrency(item.amount, "INR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black text-neutral-500 uppercase tracking-widest">
              Expenses
            </h4>
            <span className="text-[10px] font-black bg-neutral-100 px-3 py-1 rounded-lg uppercase">
              {expStats.count} Records
            </span>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {expStats.items.length === 0 ? (
              <p className="text-sm font-bold text-neutral-400 text-center py-6">
                No expenses today
              </p>
            ) : (
              expStats.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-red-50/70 text-red-900 rounded-2xl hover:bg-red-50 transition"
                >
                  <div>
                    <p className="text-sm font-black uppercase">
                      {item.category || "Expense"}
                    </p>
                    <p className="text-[10px] font-bold text-red-700/70 uppercase tracking-widest">
                      {item.description || "Expense"}
                    </p>
                  </div>
                  <p className="text-sm font-black">
                    -{formatCurrency(item.amount, "INR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Printable Container for Excel-style Daily Cash Book PDF & Print */}
      <div className="printable-container">
        <div
          ref={dailyBookPrintRef}
          className="w-[850px] p-10 bg-white text-slate-900 font-sans border border-slate-300 print-inner-container"
        >
          {/* Company Details */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                {settings?.business_name || "InvoCentric Client"}
              </h1>
              {settings?.owner_name && (
                <p className="text-xs text-slate-600 font-bold uppercase tracking-wider mt-1">
                  Proprietor: {settings.owner_name}
                </p>
              )}
              {settings?.address && (
                <p className="text-xs text-slate-600 mt-1 max-w-[400px]">
                  {settings.address}
                </p>
              )}
              {settings?.phone && (
                <p className="text-xs text-slate-700 font-semibold mt-1">
                  Contact: {settings.phone}
                </p>
              )}
              {settings?.gstin && (
                <p className="text-xs text-green-800 font-bold mt-1">
                  GSTIN: {settings.gstin}
                </p>
              )}
            </div>

            <div className="text-right">
              <span className="text-sm font-black text-slate-900 border-2 border-slate-900 bg-white px-4 py-1.5 rounded-md uppercase tracking-widest">
                DAILY CASH BOOK STATEMENT
              </span>
              <p className="text-sm font-black text-slate-900 mt-4">
                Date: {format(parseISO(selectedDate), "dd MMMM yyyy")}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                Generated: {format(new Date(), "dd MMM yyyy, hh:mm a")}
              </p>
            </div>
          </div>

          {/* Daily Totals Cards Grid */}
          <table className="w-full mb-6 excel-table">
            <thead>
              <tr className="bg-slate-200 text-slate-900 text-xs font-black uppercase">
                <th className="p-2.5 border border-slate-400 text-center">Total Invoiced Sales</th>
                <th className="p-2.5 border border-slate-400 text-center">Payments In (+)</th>
                <th className="p-2.5 border border-slate-400 text-center">Purchases (-)</th>
                <th className="p-2.5 border border-slate-400 text-center">Expenses (-)</th>
                <th className="p-2.5 border border-slate-400 text-center bg-slate-300">Net Daily Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-sm font-black text-slate-900 text-center">
                <td className="p-2.5 border border-slate-300">{formatCurrency(sales.total, "INR")}</td>
                <td className="p-2.5 border border-slate-300 text-green-800">+{formatCurrency(payStats.total, "INR")}</td>
                <td className="p-2.5 border border-slate-300 text-amber-800">-{formatCurrency(purStats.total, "INR")}</td>
                <td className="p-2.5 border border-slate-300 text-rose-800">-{formatCurrency(expStats.total, "INR")}</td>
                <td className={`p-2.5 border border-slate-400 bg-slate-100 ${netBalance >= 0 ? "text-green-900" : "text-rose-900"}`}>
                  {formatCurrency(netBalance, "INR")}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Combined Excel Day Book Table */}
          <div className="mb-8">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-400 pb-1">
              DAILY STATEMENT LEDGER
            </h3>
            {allCombinedTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                No transactions recorded for this date.
              </p>
            ) : (
              <table className="w-full excel-table text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-black text-[10px] uppercase">
                    <th className="p-2 border border-slate-400 text-center w-12">#</th>
                    <th className="p-2 border border-slate-400 text-center w-24">Type</th>
                    <th className="p-2 border border-slate-400">Party Name / Particulars</th>
                    <th className="p-2 border border-slate-400">Notes / Details</th>
                    <th className="p-2 border border-slate-400 text-center w-24">Method</th>
                    <th className="p-2 border border-slate-400 text-right w-28">Cash In (+ ₹)</th>
                    <th className="p-2 border border-slate-400 text-right w-28">Cash Out (- ₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {allCombinedTransactions.map((tx, idx) => (
                    <tr
                      key={tx.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                    >
                      <td className="p-2 border border-slate-300 text-center font-bold">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-[9px] uppercase">
                        {tx.typeLabel}
                      </td>
                      <td className="p-2 border border-slate-300 font-bold text-slate-900">{tx.party}</td>
                      <td className="p-2 border border-slate-300 text-slate-600">{tx.details}</td>
                      <td className="p-2 border border-slate-300 text-center text-slate-600">{tx.method}</td>
                      <td className="p-2 border border-slate-300 text-right font-black text-green-800">
                        {tx.cashIn > 0 ? `+${formatCurrency(tx.cashIn, "INR")}` : "-"}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-black text-rose-800">
                        {tx.cashOut > 0 ? `-${formatCurrency(tx.cashOut, "INR")}` : "-"}
                      </td>
                    </tr>
                  ))}
                  {/* Summary Total Row */}
                  <tr className="bg-slate-200 font-black text-slate-900 total-row">
                    <td colSpan={5} className="p-2.5 border border-slate-400 text-right uppercase">
                      GRAND TOTAL:
                    </td>
                    <td className="p-2.5 border border-slate-400 text-right text-green-900 text-sm">
                      +{formatCurrency(payStats.total, "INR")}
                    </td>
                    <td className="p-2.5 border border-slate-400 text-right text-rose-900 text-sm">
                      -{formatCurrency(purStats.total + expStats.total, "INR")}
                    </td>
                  </tr>
                  <tr className="bg-slate-300 font-black text-slate-900">
                    <td colSpan={5} className="p-2.5 border border-slate-400 text-right uppercase">
                      NET CASH BALANCE:
                    </td>
                    <td colSpan={2} className={`p-2.5 border border-slate-400 text-right text-sm ${netBalance >= 0 ? "text-green-950" : "text-rose-950"}`}>
                      {formatCurrency(netBalance, "INR")}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Signatures Footer */}
          <div className="flex justify-between items-end pt-12 mt-8 border-t border-slate-300 text-xs">
            <div>
              <p className="font-bold text-slate-700">Verified By:</p>
              <p className="text-slate-500 mt-8 font-mono">________________________</p>
              <p className="text-[10px] text-slate-400 uppercase mt-1">Accountant / Manager Signature</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-700">Proprietor / Authorized Seal:</p>
              <p className="text-slate-500 mt-8 font-mono">________________________</p>
              <p className="text-[10px] text-slate-400 uppercase mt-1">{settings?.business_name || "Authorized Stamp"}</p>
            </div>
          </div>
        </div>
      </div>

      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        whatsAppUrl={whatsAppUrlState}
        documentTitle="Daily Cash Book"
        copiedToClipboard={copiedToClipboard}
        fileName={generatedPdfFileName || `Daily_Book_${selectedDate}.pdf`}
        onDirectSharePdf={generatedPdfBlob ? handleDirectPdfShare : undefined}
      />
    </>
  );
}
