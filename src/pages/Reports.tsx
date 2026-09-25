import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Receipt,
  Eye,
  Printer,
  Phone,
  Lock,
  Building2,
  Mail,
  FileSpreadsheet,
  Send,
  Copy,
  Sparkles,
  X,
  Check,
  Share2,
  FileCode,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  useInvoices,
  usePayments,
  useCustomers,
  useSettings,
  useExpenses,
  usePurchases,
} from "../hooks/useData";
import { formatCurrency, cn, getWhatsAppShareUrl, isMobile, openInBrowser } from "../lib/utils";
import { WhatsAppShareModal } from "../components/WhatsAppShareModal";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  subMonths,
  isSameMonth,
} from "date-fns";
import { parseDateSafe } from "../utils/dateUtils";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Reports() {
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const { expenses = [] } = useExpenses();
  const { purchases = [] } = usePurchases();
  const { isPro, triggerUpgradeModal } = useAuth();

  // CA (Chartered Accountant) Hub States
  const [showCaModal, setShowCaModal] = useState(false);
  const [caPeriod, setCaPeriod] = useState<"this_month" | "last_month" | "this_quarter" | "fy" | "all">("this_month");
  const [caPhone, setCaPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("ca_phone_number") || "";
    }
    return "";
  });
  const [caEmail, setCaEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("ca_email_address") || "";
    }
    return "";
  });
  const [caSuccessMsg, setCaSuccessMsg] = useState<string | null>(null);
  const [caCopied, setCaCopied] = useState(false);

  const [timeRange, setTimeRange] = useState(isPro ? "6m" : "1m");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "ageing">(
    "invoices",
  );
  const [ageingBucketFilter, setAgeingBucketFilter] = useState<"all" | "30" | "60" | "90" | "90+">("all");
  const [isDownloading, setIsDownloading] = useState(false);
  const reportPrintRef = useRef<HTMLDivElement>(null);

  const ageingReport = useMemo(() => {
    const now = new Date().getTime();
    const unpaidInvoices = invoices.filter(inv => (inv.status || '').toLowerCase() !== 'paid');

    const bucket0to30: any[] = [];
    const bucket31to60: any[] = [];
    const bucket61to90: any[] = [];
    const bucket90plus: any[] = [];

    let totalDue = 0;
    let total30 = 0;
    let total60 = 0;
    let total90 = 0;
    let total90plus = 0;

    unpaidInvoices.forEach(inv => {
      const invDate = inv.date ? new Date(inv.date).getTime() : (inv.created_at ? new Date(inv.created_at).getTime() : now);
      const days = Math.max(0, Math.floor((now - invDate) / (1000 * 60 * 60 * 24)));
      const amt = Number(inv.amount || inv.total || 0);
      totalDue += amt;

      const record = {
        ...inv,
        daysOverdue: days,
        amt
      };

      if (days <= 30) {
        bucket0to30.push(record);
        total30 += amt;
      } else if (days <= 60) {
        bucket31to60.push(record);
        total60 += amt;
      } else if (days <= 90) {
        bucket61to90.push(record);
        total90 += amt;
      } else {
        bucket90plus.push(record);
        total90plus += amt;
      }
    });

    return {
      totalDue,
      total30,
      total60,
      total90,
      total90plus,
      totalOverdue: total60 + total90 + total90plus,
      bucket0to30,
      bucket31to60,
      bucket61to90,
      bucket90plus,
      allBuckets: [...bucket90plus, ...bucket61to90, ...bucket31to60, ...bucket0to30]
    };
  }, [invoices]);

  // WhatsApp Share Modal States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppShareText, setWhatsAppShareText] = useState("");
  const [whatsAppUrlState, setWhatsAppUrlState] = useState("");
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);
  const [generatedPdfFileName, setGeneratedPdfFileName] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Overall Statistics for reference
  const overallStats = useMemo(() => {
    const totalSales = invoices.reduce(
      (sum, inv) => sum + (inv.amount || 0),
      0,
    );
    const totalReceived = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balanceDue = totalSales - totalReceived;
    const activeCustomers = customers.length;

    return {
      totalSales,
      totalReceived,
      balanceDue,
      activeCustomers,
    };
  }, [invoices, payments, customers]);

  // Dynamic statistics based on selected time range
  const filteredData = useMemo(() => {
    const end = new Date();
    const monthsToSub = timeRange === "12m" ? 12 : (timeRange === "1m" ? 1 : 6);
    const start = startOfMonth(subMonths(end, monthsToSub - 1));

    const periodInvoices = invoices
      .filter((inv) => {
        const date = parseDateSafe(inv.created_at || inv.createdAt);
        return date >= start && date <= end;
      })
      .sort((a, b) => {
        const dateA = parseDateSafe(a.created_at || a.createdAt);
        const dateB = parseDateSafe(b.created_at || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

    const periodPayments = payments
      .filter((p) => {
        const date = parseDateSafe(p.date);
        return date >= start && date <= end;
      })
      .sort((a, b) => {
        const dateA = parseDateSafe(a.date);
        const dateB = parseDateSafe(b.date);
        return dateB.getTime() - dateA.getTime();
      });

    const periodSales = periodInvoices.reduce(
      (sum, inv) => sum + (inv.amount || 0),
      0,
    );
    const periodCollected = periodPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );
    const periodBalanceDue = periodSales - periodCollected;
    const collectionRate =
      periodSales > 0 ? (periodCollected / periodSales) * 100 : 0;

    return {
      invoices: periodInvoices,
      payments: periodPayments,
      sales: periodSales,
      collected: periodCollected,
      balanceDue: periodBalanceDue,
      collectionRate,
      startDate: start,
      endDate: end,
    };
  }, [invoices, payments, timeRange]);

  // Generate monthly data for charts
  const chartData = useMemo(() => {
    const end = new Date();
    const start = subMonths(end, timeRange === "12m" ? 11 : 5);

    const months = eachMonthOfInterval({ start, end });

    return months.map((month) => {
      const monthInvoices = invoices.filter((inv) => {
        const date = parseDateSafe(inv.created_at || inv.createdAt);
        return isSameMonth(date, month);
      });

      const monthPayments = payments.filter((p) => {
        const date = parseDateSafe(p.date);
        return isSameMonth(date, month);
      });

      return {
        name: format(month, "MMM yy"),
        sales: monthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
        collections: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      };
    });
  }, [invoices, payments, timeRange]);

  // Search filter for lists inside reports tab
  const searchedInvoices = useMemo(() => {
    if (!searchTerm.trim()) return filteredData.invoices;
    const term = searchTerm.toLowerCase();
    return filteredData.invoices.filter((inv) => {
      const customerName = inv.customer_name || inv.customerName || "";
      const invNo = inv.invoice_number || inv.invoiceNumber || inv.id || "";
      return (
        customerName.toLowerCase().includes(term) ||
        invNo.toLowerCase().includes(term)
      );
    });
  }, [filteredData.invoices, searchTerm]);

  const searchedPayments = useMemo(() => {
    if (!searchTerm.trim()) return filteredData.payments;
    const term = searchTerm.toLowerCase();
    return filteredData.payments.filter((p) => {
      const resolvedCust = customers.find(c => c.id === p.customer_id);
      const customerName = p.customer_name || p.customerName || resolvedCust?.name || "Walk-in Customer";
      const method = p.method || "";
      const ref = p.reference || p.transaction_id || "";
      return (
        customerName.toLowerCase().includes(term) ||
        method.toLowerCase().includes(term) ||
        ref.toLowerCase().includes(term)
      );
    });
  }, [filteredData.payments, searchTerm, customers]);

  // Dedicated PDF compiler
  const handleDownloadPDF = async (): Promise<Blob | null> => {
    setIsDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      // Small delay to ensure the offscreen element is painted
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!reportPrintRef.current) {
        throw new Error("Print container reference is missing");
      }

      // Use a robust rendering width to avoid scaling issues
      const dataUrl = await toPng(reportPrintRef.current, {
        quality: 1.0,
        pixelRatio: 2.0, // crisp vectors
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

        // Draw clean white margins on all sides of every page
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin, "F"); // Top mask
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, "F"); // Bottom mask
        pdf.rect(0, 0, margin, pdfHeight, "F"); // Left mask
        pdf.rect(pdfWidth - margin, 0, margin, pdfHeight, "F"); // Right mask

        heightLeft -= usableHeight;
        pageIndex++;
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `InvoCentric_Performance_Report_${timeRange}_${format(new Date(), "dd_MMM_yyyy")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return blob;
    } catch (err) {
      console.error("Failed to generate PDF Report:", err);
      return null;
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportExcel = async () => {
    const { exportToExcel } = await import("../services/excelService");

    const invoiceRows = filteredData.invoices.map((inv: any, idx: number) => ({
      '#': idx + 1,
      'Invoice ID': inv.invoice_number || inv.invoiceNumber || inv.id?.slice(0, 8).toUpperCase(),
      'Customer Name': inv.customer_name || inv.customerName || "Walk-in Client",
      'Date': inv.created_at || inv.createdAt ? format(parseDateSafe(inv.created_at || inv.createdAt), "dd MMM yyyy") : "N/A",
      'Status': (inv.status || "N/A").toUpperCase(),
      'Amount (₹)': inv.amount || 0,
    }));

    const paymentRows = filteredData.payments.map((pay: any, idx: number) => {
      const custName = pay.customer_name || pay.customerName || customers.find((c: any) => c.id === pay.customer_id)?.name || "Walk-in Customer";
      return {
        '#': idx + 1,
        'Customer Name': custName,
        'Payment Date': pay.date ? format(parseDateSafe(pay.date), "dd MMM yyyy") : "N/A",
        'Payment Method': pay.method || "Cash",
        'Reference ID': pay.reference || pay.transaction_id || "-",
        'Amount Collected (₹)': pay.amount || 0,
      };
    });

    const combinedExport = [
      ...invoiceRows.map(r => ({ Category: 'Sales Invoice', ...r })),
      ...paymentRows.map(r => ({ Category: 'Payment Collection', ...r }))
    ];

    exportToExcel(combinedExport, `InvoCentric_Report_Ledger_${timeRange}_${format(new Date(), "dd_MMM_yyyy")}`);
  };

  const handleWhatsAppShare = async () => {
    const bizName = settings?.business_name || "INVOCENTRIC";
    const bizPhone = settings?.phone ? `\n*Contact:* ${settings.phone}` : "";

    const shareText =
      `*BUSINESS PERFORMANCE REPORT*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Shop:* ${bizName}${bizPhone}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Period:* Last ${timeRange === "6m" ? "6 Months" : "12 Months"}\n` +
      `*Report Date:* ${format(new Date(), "dd MMM yyyy")}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*PERFORMANCE METRICS:*\n` +
      `• Total Sales Volume: ${formatCurrency(filteredData.sales, "INR")}\n` +
      `• Total Payments Collected: ${formatCurrency(filteredData.collected, "INR")}\n` +
      `• *Pending Balance Due: ${formatCurrency(filteredData.balanceDue, "INR")}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*ALL-TIME METRICS:*\n` +
      `• All-Time Total Sales: ${formatCurrency(overallStats.totalSales, "INR")}\n` +
      `• All-Time Total Received: ${formatCurrency(overallStats.totalReceived, "INR")}\n` +
      `• *All-Time Outstanding Due: ${formatCurrency(overallStats.balanceDue, "INR")}*\n` +
      `• Active Linked Customers: ${overallStats.activeCustomers}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Generated via InvoCentric.\n` +
      `Thank you!`;

    const fileName = `InvoCentric_Performance_Report_${timeRange}_${format(new Date(), "dd_MMM_yyyy")}.pdf`;
    const whatsappUrl = getWhatsAppShareUrl("", shareText);

    setWhatsAppShareText(shareText);
    setWhatsAppUrlState(whatsappUrl);
    setGeneratedPdfFileName(fileName);

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
          title: "Business Performance Report",
          text: whatsAppShareText,
        });
      }
    } catch (err) {
      console.error("Direct PDF share failed:", err);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  // CA (Chartered Accountant) Filtered Data and Aggregates
  const caFilteredData = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date(2100, 0, 1);
    let label = "All Time";

    if (caPeriod === "this_month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
      label = format(now, "MMMM yyyy");
    } else if (caPeriod === "last_month") {
      const prev = subMonths(now, 1);
      start = startOfMonth(prev);
      end = endOfMonth(prev);
      label = format(prev, "MMMM yyyy");
    } else if (caPeriod === "this_quarter") {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3;
      start = new Date(now.getFullYear(), qStartMonth, 1);
      end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
      label = `Quarter ${Math.floor(m / 3) + 1} (${format(start, "MMM")} - ${format(end, "MMM yyyy")})`;
    } else if (caPeriod === "fy") {
      const yr = now.getFullYear();
      const isPostMarch = now.getMonth() >= 3;
      const fyStartYear = isPostMarch ? yr : yr - 1;
      start = new Date(fyStartYear, 3, 1); // 1st April
      end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59); // 31st March
      label = `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
    }

    const periodInvoices = invoices.filter(inv => {
      const d = parseDateSafe(inv.created_at || inv.createdAt);
      return d >= start && d <= end;
    });

    const periodPurchases = purchases.filter(pur => {
      const d = parseDateSafe(pur.date || pur.created_at);
      return d >= start && d <= end;
    });

    const periodExpenses = expenses.filter(exp => {
      const d = parseDateSafe(exp.date || exp.created_at);
      return d >= start && d <= end;
    });

    const periodPayments = payments.filter(pay => {
      const d = parseDateSafe(pay.date);
      return d >= start && d <= end;
    });

    let totalSalesGross = 0;
    let totalSalesTaxable = 0;
    let totalOutputTax = 0;
    periodInvoices.forEach(inv => {
      const g = Number(inv.amount || inv.total || 0);
      const t = Number(inv.tax || inv.total_tax || 0);
      totalSalesGross += g;
      totalOutputTax += t;
      totalSalesTaxable += Number(inv.subtotal || (g - t) || 0);
    });

    let totalPurchasesGross = 0;
    let totalPurchasesTaxable = 0;
    let totalInputTax = 0;
    periodPurchases.forEach(pur => {
      const g = Number(pur.total || pur.amount || 0);
      const t = Number(pur.tax || 0);
      totalPurchasesGross += g;
      totalInputTax += t;
      totalPurchasesTaxable += Number(pur.subtotal || (g - t) || 0);
    });

    let totalExpenseAmount = 0;
    periodExpenses.forEach(exp => {
      totalExpenseAmount += Number(exp.amount || 0);
    });

    const netGstPayable = Math.max(0, totalOutputTax - totalInputTax);
    const itcBalance = Math.max(0, totalInputTax - totalOutputTax);

    return {
      label,
      invoices: periodInvoices,
      purchases: periodPurchases,
      expenses: periodExpenses,
      payments: periodPayments,
      totalSalesGross,
      totalSalesTaxable,
      totalOutputTax,
      totalPurchasesGross,
      totalPurchasesTaxable,
      totalInputTax,
      totalExpenseAmount,
      netGstPayable,
      itcBalance
    };
  }, [caPeriod, invoices, purchases, expenses, payments]);

  const handleDownloadCaPackage = async () => {
    try {
      const { exportCompleteCaPackage } = await import("../services/excelService");
      const fileName = exportCompleteCaPackage({
        invoices: caFilteredData.invoices,
        purchases: caFilteredData.purchases,
        expenses: caFilteredData.expenses,
        customers,
        payments: caFilteredData.payments,
        businessProfile: {
          businessName: settings?.business_name,
          gstin: settings?.gstin,
          phone: settings?.phone,
          email: settings?.email,
          state: settings?.state
        },
        periodLabel: caFilteredData.label
      });
      setCaSuccessMsg(`Excel package downloaded! 5 audit sheets generated.`);
      setTimeout(() => setCaSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Could not generate CA Excel: ${err?.message || err}`);
    }
  };

  const getCaWhatsAppText = () => {
    const biz = settings?.business_name || "My Business";
    const gstin = settings?.gstin || "Unregistered";
    return `*GST & AUDIT DATA PACKAGE FOR CA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Business:* ${biz}\n` +
      `*GSTIN:* ${gstin}\n` +
      `*Period:* ${caFilteredData.label}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*1. OUTWARD SUPPLIES (GSTR-1 SALES):*\n` +
      `• Invoices Count: ${caFilteredData.invoices.length}\n` +
      `• Taxable Turnover: ${formatCurrency(caFilteredData.totalSalesTaxable, "INR")}\n` +
      `• Output GST: ${formatCurrency(caFilteredData.totalOutputTax, "INR")}\n` +
      `• Gross Sales: ${formatCurrency(caFilteredData.totalSalesGross, "INR")}\n\n` +
      `*2. INWARD SUPPLIES (GSTR-2B PURCHASES):*\n` +
      `• Purchase Bills: ${caFilteredData.purchases.length}\n` +
      `• Taxable Purchases: ${formatCurrency(caFilteredData.totalPurchasesTaxable, "INR")}\n` +
      `• Eligible ITC (Input Tax): ${formatCurrency(caFilteredData.totalInputTax, "INR")}\n` +
      `• Gross Purchases: ${formatCurrency(caFilteredData.totalPurchasesGross, "INR")}\n\n` +
      `*3. TAX POSITION & EXPENSES:*\n` +
      `• Net GST Payable: ${formatCurrency(caFilteredData.netGstPayable, "INR")}\n` +
      `• ITC Available to Carry: ${formatCurrency(caFilteredData.itcBalance, "INR")}\n` +
      `• Indirect Expenses: ${formatCurrency(caFilteredData.totalExpenseAmount, "INR")}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Detailed 5-sheet Excel workbook (Tax Summary, GSTR-1, GSTR-2B, Expenses, Debtors) generated via InvoCentric._`;
  };

  const handleCaWhatsApp = () => {
    if (caPhone && typeof window !== 'undefined') {
      localStorage.setItem("ca_phone_number", caPhone);
    }
    const text = getCaWhatsAppText();
    const url = getWhatsAppShareUrl(caPhone, text);
    if (isMobile()) {
      window.location.href = url;
    } else {
      openInBrowser(url);
    }
  };

  const handleCaEmail = () => {
    if (caEmail && typeof window !== 'undefined') {
      localStorage.setItem("ca_email_address", caEmail);
    }
    const biz = settings?.business_name || "Business";
    const subject = encodeURIComponent(`GST & Financial Audit Data: ${biz} - ${caFilteredData.label}`);
    const body = encodeURIComponent(getCaWhatsAppText().replace(/\*/g, ''));
    openInBrowser(`mailto:${caEmail}?subject=${subject}&body=${body}`);
  };

  const handleCopyCaSummary = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(getCaWhatsAppText());
        setCaCopied(true);
        setTimeout(() => setCaCopied(false), 3000);
      }
    } catch (e) {}
  };

  return (
    <>
      <div className="space-y-8 pb-20 print:hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight uppercase">
            Reports & Analytics
          </h1>
          <p className="text-neutral-500 font-bold text-sm mt-1 uppercase tracking-wider">
            Track your business performance in real-time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-neutral-100 shadow-sm">
            <button
              onClick={() => setTimeRange("1m")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                timeRange === "1m"
                  ? "bg-neutral-900 text-white shadow-lg"
                  : "text-neutral-400 hover:text-neutral-900",
              )}
            >
              This Month
            </button>
            <button
              onClick={() => {
                if (!isPro) {
                  triggerUpgradeModal('Advanced Reports & Filters', [
                    'Analyze your business over 6 months, 12 months, or custom date ranges.',
                    'Compare sales patterns, cash flow trends, and itemized quarterly performance.',
                    'Pristine PDF, Excel, and ledger-based exports for fast GST filing.'
                  ]);
                } else {
                  setTimeRange("6m");
                }
              }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1",
                timeRange === "6m"
                  ? "bg-neutral-900 text-white shadow-lg"
                  : "text-neutral-400 hover:text-neutral-900",
              )}
            >
              <span>6 Months</span>
              {!isPro && <Lock size={10} className="text-amber-500 shrink-0" />}
            </button>
            <button
              onClick={() => {
                if (!isPro) {
                  triggerUpgradeModal('Advanced Reports & Filters', [
                    'Analyze your business over 6 months, 12 months, or custom date ranges.',
                    'Compare sales patterns, cash flow trends, and itemized quarterly performance.',
                    'Pristine PDF, Excel, and ledger-based exports for fast GST filing.'
                  ]);
                } else {
                  setTimeRange("12m");
                }
              }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1",
                timeRange === "12m"
                  ? "bg-neutral-900 text-white shadow-lg"
                  : "text-neutral-400 hover:text-neutral-900",
              )}
            >
              <span>12 Months</span>
              {!isPro && <Lock size={10} className="text-amber-500 shrink-0" />}
            </button>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => {
                if (!isPro) {
                  triggerUpgradeModal('PDF & Excel Exports', [
                    'Print and export clean, branded reports of all your transactions.',
                    'Generate high-quality Excel spreadsheets containing structured tax and ledger info.',
                    'Download beautifully structured accounting PDFs ready for your CA or accountant.'
                  ]);
                } else {
                  handlePrintReport();
                }
              }}
              className="px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Print Excel-Style Report"
            >
              <Printer size={15} />
              <span>Print</span>
              {!isPro && <Lock size={11} className="text-amber-500 shrink-0 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (!isPro) {
                  triggerUpgradeModal('PDF & Excel Exports', [
                    'Print and export clean, branded reports of all your transactions.',
                    'Generate high-quality Excel spreadsheets containing structured tax and ledger info.',
                    'Download beautifully structured accounting PDFs ready for your CA or accountant.'
                  ]);
                } else {
                  handleDownloadPDF();
                }
              }}
              disabled={isDownloading}
              className="px-3.5 py-2 text-xs font-black uppercase tracking-wider text-green-800 bg-green-50 hover:bg-green-100 border border-green-200/60 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Download PDF Report"
            >
              {isDownloading ? (
                <LoaderCircle size={15} className="animate-spin text-green-600" />
              ) : (
                <Download size={15} className="text-green-700" />
              )}
              <span>PDF</span>
              {!isPro && <Lock size={11} className="text-amber-500 shrink-0 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (!isPro) {
                  triggerUpgradeModal('PDF & Excel Exports', [
                    'Print and export clean, branded reports of all your transactions.',
                    'Generate high-quality Excel spreadsheets containing structured tax and ledger info.',
                    'Download beautifully structured accounting PDFs ready for your CA or accountant.'
                  ]);
                } else {
                  handleExportExcel();
                }
              }}
              className="px-3.5 py-2 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Export Excel (.xlsx)"
            >
              <Download size={15} className="text-emerald-700" />
              <span>Excel</span>
              {!isPro && <Lock size={11} className="text-amber-500 shrink-0 ml-0.5" />}
            </button>

            <Link
              to="/accounting-export"
              className="px-3.5 py-2 text-xs font-black uppercase tracking-wider text-green-900 bg-green-50 hover:bg-green-100 border border-green-200/80 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Universal Double-Entry Accounting Export (Tally / QuickBooks / Zoho / SAP)"
            >
              <FileCode size={15} className="text-green-700" />
              <span>Universal ERP</span>
            </Link>

            <button
              onClick={() => setShowCaModal(true)}
              className="px-3.5 py-2 text-xs font-black uppercase tracking-wider text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Send Complete Financial & GST Data to CA"
            >
              <Building2 size={15} className="text-indigo-600" />
              <span>CA Package</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-[#25D366] hover:bg-[#128C7E] rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Share Report on WhatsApp"
            >
              <WhatsAppIcon size={16} />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* CA Audit Hub Highlight Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-4 sm:p-5 text-white border border-indigo-500/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0 shadow-inner">
            <Building2 size={24} className="text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-400/30">
                CA & Tax Audit Hub
              </span>
              <span className="text-[11px] text-indigo-300 hidden sm:inline font-medium">
                GSTR-1 · GSTR-2B · Expenses · Debtors Ledger
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mt-1">
              Send Complete Financial & GST Return Data to CA in 1-Click
            </h3>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Automatically generate multi-sheet Excel workbook and share directly via WhatsApp or Email.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={() => setShowCaModal(true)}
            className="w-full md:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-400 hover:to-emerald-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
          >
            <FileSpreadsheet size={15} />
            <span>Open CA Package</span>
          </button>
        </div>
      </div>

      {/* Stats Grid - Updated to dynamically reflect the selected period */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "Total Sales",
            value: filteredData.sales,
            subLabel: `All-time: ${formatCurrency(overallStats.totalSales, "INR")}`,
            icon: FileText,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Total Collected",
            value: filteredData.collected,
            subLabel: `All-time: ${formatCurrency(overallStats.totalReceived, "INR")}`,
            icon: TrendingUp,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Balance Due",
            value: filteredData.balanceDue,
            subLabel: `All-time: ${formatCurrency(overallStats.balanceDue, "INR")}`,
            icon: DollarSign,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Total Customers",
            value: overallStats.activeCustomers,
            subLabel: "Active accounts linked",
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50",
            isMoney: false,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 bg-white border border-neutral-100 rounded-3xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={stat.color} size={20} />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-green-600 uppercase">
                <ArrowUpRight size={12} />
                Live Sync
              </div>
            </div>
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
              {stat.label}
            </p>
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
              {stat.isMoney === false
                ? stat.value
                : formatCurrency(stat.value, "INR")}
            </h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-2">
              {stat.subLabel}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 glass-card p-8 bg-white border border-neutral-100 rounded-[2.5rem]"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">
                Sales vs Collections
              </h3>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Revenue flow over time
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-600" />
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                  Sales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                  Collections
                </span>
              </div>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#166534" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#15803D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#F1F5F9"
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "20px",
                    border: "none",
                    boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                    padding: "15px",
                  }}
                  itemStyle={{
                    fontSize: "12px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#166534"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                />
                <Area
                  type="monotone"
                  dataKey="collections"
                  stroke="#15803D"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorColl)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right Sidebar in Reports */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-8 bg-neutral-900 text-white rounded-[2.5rem]"
          >
            <h3 className="text-lg font-black uppercase tracking-tight mb-6">
              Payment health
            </h3>
            <div className="space-y-6">
              {[
                {
                  label: "Collected",
                  value: (filteredData.collected / filteredData.sales) * 100,
                  color: "bg-green-500",
                },
                {
                  label: "Outstanding",
                  value: (filteredData.balanceDue / filteredData.sales) * 100,
                  color: "bg-amber-500",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      {item.label}
                    </span>
                    <span className="text-lg font-black tracking-tight">
                      {Math.round(item.value || 0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 1 }}
                      className={cn("h-full rounded-full", item.color)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">
                Your collection rate is healthy. Most payments are being settled
                within 15 days of invoice date.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-8 bg-white border border-neutral-100 rounded-[2.5rem]"
          >
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight mb-4 text-center">
              Export Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 transition-all font-black text-rose-600 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <LoaderCircle
                    size={24}
                    className="animate-spin text-rose-600"
                  />
                ) : (
                  <FileText size={24} />
                )}
                <span className="text-[10px] uppercase tracking-widest">
                  {isDownloading ? "Generatin..." : "PDF"}
                </span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 transition-all font-black text-green-600 cursor-pointer"
              >
                <Download size={24} />
                <span className="text-[10px] uppercase tracking-widest">
                  Excel
                </span>
              </button>

              <button
                onClick={handlePrintReport}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 transition-all font-black text-neutral-800 cursor-pointer"
              >
                <Printer size={24} />
                <span className="text-[10px] uppercase tracking-widest">
                  Print
                </span>
              </button>

              <button
                onClick={handleWhatsAppShare}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 transition-all font-black text-[#128C7E] cursor-pointer"
              >
                <WhatsAppIcon size={24} />
                <span className="text-[10px] uppercase tracking-widest">
                  WhatsApp
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Transaction Details & Audit Lists Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 bg-white border border-neutral-100 rounded-[2.5rem] shadow-sm"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 border-b border-neutral-100 pb-6">
          <div>
            <h2 className="text-xl font-black text-neutral-900 uppercase tracking-tight">
              Transaction Details
            </h2>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mt-1">
              Granular log of all entries during the selected period
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search name, invoice ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-4 py-2.5 w-full sm:w-64 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-semibold focus:outline-none focus:border-neutral-950 focus:bg-white transition-all text-neutral-800 placeholder:text-neutral-400"
              />
            </div>

            {/* Tab toggles */}
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("invoices")}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  activeTab === "invoices"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-700",
                )}
              >
                Invoices ({searchedInvoices.length})
              </button>
              <button
                onClick={() => setActiveTab("payments")}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  activeTab === "payments"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-700",
                )}
              >
                Collections ({searchedPayments.length})
              </button>
              <button
                onClick={() => setActiveTab("ageing")}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "ageing"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-700",
                )}
              >
                <span>Ageing & Recovery</span>
                {ageingReport.allBuckets.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                    {ageingReport.allBuckets.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab contents */}
        <AnimatePresence mode="wait">
          {activeTab === "invoices" ? (
            <motion.div
              key="invoices-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-x-auto"
            >
              {searchedInvoices.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt
                    className="mx-auto text-neutral-300 mb-3"
                    size={36}
                  />
                  <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                    No matching invoice logs
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest">
                    Adjust filters or search queries
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Card Feed */}
                  <div className="block md:hidden divide-y divide-neutral-100">
                    {searchedInvoices.map((inv) => (
                      <div key={inv.id} className="py-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-xs text-neutral-900 block">
                              {inv.invoice_number || inv.invoiceNumber || inv.id?.slice(0, 8).toUpperCase()}
                            </span>
                            <span className="text-xs font-bold text-neutral-800 block mt-0.5">
                              {inv.customer_name || inv.customerName || "Walk-in Client"}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-semibold block mt-0.5">
                              {inv.created_at || inv.createdAt
                                ? format(parseDateSafe(inv.created_at || inv.createdAt), "dd MMM yyyy")
                                : "N/A"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-neutral-900 tabular-nums block">
                              {formatCurrency(inv.amount || 0, inv.currency || "INR")}
                            </span>
                            <span
                              className={cn(
                                "inline-block mt-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded",
                                inv.status === "paid" && "bg-green-50 text-green-700",
                                inv.status === "sent" && "bg-amber-50 text-amber-700",
                                inv.status === "draft" && "bg-slate-100 text-slate-600",
                                inv.status === "overdue" && "bg-rose-50 text-rose-700",
                              )}
                            >
                              {inv.status || "draft"}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <Link
                            to={`/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 active:scale-95 rounded-lg font-black text-[10px] uppercase text-neutral-700"
                          >
                            <Eye size={11} />
                            View
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-100 text-[9px] font-black text-neutral-400 uppercase tracking-widest pb-4">
                          <th className="pb-4 font-black">Invoice Number</th>
                          <th className="pb-4 font-black">Customer Name</th>
                          <th className="pb-4 font-black">Issue Date</th>
                          <th className="pb-4 font-black">Status</th>
                          <th className="pb-4 font-black text-right">Billing Amount</th>
                          <th className="pb-4 font-black text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100/60">
                        {searchedInvoices.map((inv) => (
                          <tr key={inv.id} className="text-xs hover:bg-neutral-50/50 transition-colors">
                            <td className="py-4 font-mono font-bold text-neutral-900">
                              {inv.invoice_number || inv.invoiceNumber || inv.id?.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="py-4 font-bold text-neutral-800">
                              {inv.customer_name || inv.customerName || "Walk-in Client"}
                            </td>
                            <td className="py-4 font-semibold text-neutral-500">
                              {inv.created_at || inv.createdAt
                                ? format(parseDateSafe(inv.created_at || inv.createdAt), "dd MMM yyyy")
                                : "N/A"}
                            </td>
                            <td className="py-4">
                              <span
                                className={cn(
                                  "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg",
                                  inv.status === "paid" && "bg-green-50 text-green-700 border border-green-100",
                                  inv.status === "sent" && "bg-amber-50 text-amber-700 border border-amber-100",
                                  inv.status === "draft" && "bg-slate-100 text-slate-600 border border-slate-200",
                                  inv.status === "overdue" && "bg-rose-50 text-rose-700 border border-rose-100",
                                )}
                              >
                                {inv.status || "draft"}
                              </span>
                            </td>
                            <td className="py-4 text-right font-black text-neutral-900 tabular-nums">
                              {formatCurrency(inv.amount || 0, inv.currency || "INR")}
                            </td>
                            <td className="py-4 text-right">
                              <Link
                                to={`/invoices/${inv.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-950 hover:text-white rounded-lg transition-all font-black text-[10px] uppercase tracking-wider text-neutral-700"
                              >
                                <Eye size={12} />
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="payments-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-x-auto"
            >
              {searchedPayments.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt
                    className="mx-auto text-neutral-300 mb-3"
                    size={36}
                  />
                  <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                    No matching collections logs
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest">
                    Adjust filters or search queries
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Collections Feed */}
                  <div className="block md:hidden divide-y divide-neutral-100">
                    {searchedPayments.map((pay) => (
                      <div key={pay.id} className="py-3.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-neutral-900 block">
                              {pay.customer_name || pay.customerName || "N/A"}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-semibold block mt-0.5">
                              {pay.date ? format(parseDateSafe(pay.date), "dd MMM yyyy") : "N/A"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-green-600 tabular-nums block">
                              +{formatCurrency(pay.amount || 0, "INR")}
                            </span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-neutral-100 text-neutral-600 rounded inline-block mt-0.5">
                              {pay.method || "Cash"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Collections Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-100 text-[9px] font-black text-neutral-400 uppercase tracking-widest pb-4">
                          <th className="pb-4 font-black">Customer Name</th>
                          <th className="pb-4 font-black">Payment Date</th>
                          <th className="pb-4 font-black">Method</th>
                          <th className="pb-4 font-black">Reference ID</th>
                          <th className="pb-4 font-black text-right">Amount Received</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100/60">
                        {searchedPayments.map((pay) => (
                          <tr key={pay.id} className="text-xs hover:bg-neutral-50/50 transition-colors">
                            <td className="py-4 font-bold text-neutral-800">
                              {pay.customer_name || pay.customerName || "N/A"}
                            </td>
                            <td className="py-4 font-semibold text-neutral-500">
                              {pay.date ? format(parseDateSafe(pay.date), "dd MMM yyyy") : "N/A"}
                            </td>
                            <td className="py-4">
                              <span className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-600 rounded-md border border-neutral-200">
                                {pay.method || "Cash"}
                              </span>
                            </td>
                            <td className="py-4 font-mono text-neutral-400">
                              {pay.reference || pay.transaction_id || "-"}
                            </td>
                            <td className="py-4 text-right font-black text-green-600 tabular-nums">
                              +{formatCurrency(pay.amount || 0, "INR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === "ageing" && (
            <motion.div
              key="ageing-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Overdue Ageing Bento Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">
                    Total Receivables
                  </span>
                  <div className="text-xl font-black text-neutral-900">
                    {formatCurrency(ageingReport.totalDue, "INR")}
                  </div>
                  <span className="text-[10px] font-bold text-neutral-500 mt-1 block">
                    {ageingReport.allBuckets.length} unpaid invoices
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block mb-1">
                    1 - 30 Days (Current)
                  </span>
                  <div className="text-xl font-black text-emerald-800">
                    {formatCurrency(ageingReport.total30, "INR")}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 mt-1 block">
                    {ageingReport.bucket0to30.length} invoices
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                  <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider block mb-1">
                    31 - 60 Days Overdue
                  </span>
                  <div className="text-xl font-black text-amber-800">
                    {formatCurrency(ageingReport.total60, "INR")}
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 mt-1 block">
                    {ageingReport.bucket31to60.length} invoices
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                  <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider block mb-1">
                    61+ Days (High Risk)
                  </span>
                  <div className="text-xl font-black text-rose-800">
                    {formatCurrency(ageingReport.total90 + ageingReport.total90plus, "INR")}
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                    {ageingReport.bucket61to90.length + ageingReport.bucket90plus.length} critical invoices
                  </span>
                </div>
              </div>

              {/* Bucket Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { key: 'all', label: 'All Unpaid', count: ageingReport.allBuckets.length },
                  { key: '30', label: '1 - 30 Days', count: ageingReport.bucket0to30.length },
                  { key: '60', label: '31 - 60 Days', count: ageingReport.bucket31to60.length },
                  { key: '90', label: '61 - 90 Days', count: ageingReport.bucket61to90.length },
                  { key: '90+', label: '90+ Days Critical', count: ageingReport.bucket90plus.length }
                ].map(b => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setAgeingBucketFilter(b.key as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                      ageingBucketFilter === b.key
                        ? "bg-neutral-900 text-white shadow-xs"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    )}
                  >
                    {b.label} ({b.count})
                  </button>
                ))}
              </div>

              {/* Overdue Invoices List */}
              {(() => {
                let list = ageingReport.allBuckets;
                if (ageingBucketFilter === '30') list = ageingReport.bucket0to30;
                if (ageingBucketFilter === '60') list = ageingReport.bucket31to60;
                if (ageingBucketFilter === '90') list = ageingReport.bucket61to90;
                if (ageingBucketFilter === '90+') list = ageingReport.bucket90plus;

                if (searchTerm.trim()) {
                  const q = searchTerm.toLowerCase();
                  list = list.filter(inv => 
                    (inv.customer_name || '').toLowerCase().includes(q) ||
                    (inv.invoice_number || '').toLowerCase().includes(q)
                  );
                }

                if (list.length === 0) {
                  return (
                    <div className="py-12 text-center text-neutral-400 font-bold uppercase tracking-wider text-xs">
                      No overdue records found in this bucket.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto border border-neutral-100 rounded-2xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                          <tr>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Invoice #</th>
                            <th className="p-3">Invoice Date</th>
                            <th className="p-3 text-center">Ageing Status</th>
                            <th className="p-3 text-right">Amount Due</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium">
                          {list.map(inv => {
                            const isCritical = inv.daysOverdue > 60;
                            const isWarning = inv.daysOverdue > 30;
                            const customer = customers.find(c => c.id === inv.customer_id);
                            const phone = customer?.phone || inv.customer_phone || '';

                            const handleSendWhatsApp = () => {
                              const cleanPhone = phone.replace(/[^0-9]/g, '');
                              const msg = encodeURIComponent(
                                `Dear ${inv.customer_name || 'Customer'}, gentle reminder from ${settings?.business_name || 'InvoCentric'} regarding Invoice #${inv.invoice_number || 'INV'} for ₹${inv.amt.toLocaleString()} which is overdue by ${inv.daysOverdue} days. Please clear the pending balance. You can view your full ledger here: ${window.location.origin}/statement?customer=${inv.customer_id}`
                              );
                              openInBrowser(`https://wa.me/${cleanPhone}?text=${msg}`);
                            };

                            return (
                              <tr key={inv.id} className="hover:bg-neutral-50/50">
                                <td className="p-3 font-bold text-neutral-900">
                                  {inv.customer_name || 'Customer'}
                                  {phone && <span className="block text-[10px] text-neutral-400">{phone}</span>}
                                </td>
                                <td className="p-3 font-mono font-bold text-neutral-700">
                                  {inv.invoice_number || inv.id?.slice(0, 8)}
                                </td>
                                <td className="p-3 text-neutral-500">
                                  {inv.date ? format(new Date(inv.date), "dd MMM yyyy") : "N/A"}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block",
                                    isCritical 
                                      ? "bg-rose-100 text-rose-800" 
                                      : isWarning 
                                        ? "bg-amber-100 text-amber-800" 
                                        : "bg-emerald-100 text-emerald-800"
                                  )}>
                                    {inv.daysOverdue === 0 ? "Due Today" : `${inv.daysOverdue} Days Overdue`}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-black text-neutral-900 tabular-nums text-sm">
                                  {formatCurrency(inv.amt, "INR")}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={handleSendWhatsApp}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                                    title="Send WhatsApp Payment Reminder"
                                  >
                                    <WhatsAppIcon size={14} />
                                    <span>Remind</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Native Card View */}
                    <div className="block md:hidden divide-y divide-neutral-100 border border-neutral-100 rounded-2xl bg-white overflow-hidden">
                      {list.map(inv => {
                        const customer = customers.find(c => c.id === inv.customer_id);
                        const phone = customer?.phone || inv.customer_phone || '';

                        const handleSendWhatsApp = () => {
                          const cleanPhone = phone.replace(/[^0-9]/g, '');
                          const msg = encodeURIComponent(
                            `Dear ${inv.customer_name || 'Customer'}, gentle reminder from ${settings?.business_name || 'InvoCentric'} regarding Invoice #${inv.invoice_number || 'INV'} for ₹${inv.amt.toLocaleString()} which is overdue by ${inv.daysOverdue} days. Please clear the pending balance.`
                          );
                          openInBrowser(`https://wa.me/${cleanPhone}?text=${msg}`);
                        };

                        return (
                          <div key={inv.id} className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-neutral-900 text-sm block">{inv.customer_name || 'Customer'}</span>
                                <span className="text-[10px] text-neutral-400 font-mono block">Inv #{inv.invoice_number || inv.id?.slice(0, 8)}</span>
                              </div>
                              <span className="font-black text-sm text-neutral-900 tabular-nums">
                                {formatCurrency(inv.amt, "INR")}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                                inv.daysOverdue > 60 ? "bg-rose-100 text-rose-800" : inv.daysOverdue > 30 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                              )}>
                                {inv.daysOverdue === 0 ? "Due Today" : `${inv.daysOverdue} Days Overdue`}
                              </span>

                              <button
                                type="button"
                                onClick={handleSendWhatsApp}
                                className="flex items-center gap-1.5 px-3 py-1 bg-[#25D366] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
                              >
                                <WhatsAppIcon size={13} />
                                <span>Remind on WhatsApp</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </div>

      {/* Hidden printable container for beautiful vector high-quality PDF report */}
      <div className="printable-container">
        <div
          ref={reportPrintRef}
          className="w-[850px] p-12 bg-white text-slate-900 font-sans border border-slate-200 print-inner-container"
        >
          {/* Company Details */}
          <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                {settings?.business_name || "InvoCentric Client"}
              </h1>
              {settings?.owner_name && (
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                  Proprietor: {settings.owner_name}
                </p>
              )}
              {settings?.address && (
                <p className="text-xs text-slate-500 mt-1 max-w-[400px] leading-relaxed">
                  {settings.address}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-slate-900 border-2 border-slate-900 bg-white px-3 py-1 rounded-full uppercase tracking-widest">
                Business Report
              </span>
              {settings?.phone && (
                <p className="text-xs text-slate-600 font-semibold mt-3">
                  Phone: {settings.phone}
                </p>
              )}
              {settings?.email && (
                <p className="text-xs text-slate-600 font-semibold">
                  {settings.email}
                </p>
              )}
              {settings?.gstin && (
                <p className="text-xs text-green-700 font-bold mt-1">
                  GSTIN: {settings.gstin}
                </p>
              )}
            </div>
          </div>

          {/* Title block */}
          <div className="mb-8">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Financial & Performance Statement
            </h2>
            <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
              <span>
                Period: {format(filteredData.startDate, "dd MMMM yyyy")} —{" "}
                {format(filteredData.endDate, "dd MMMM yyyy")}
              </span>
              <span>
                Generated: {format(new Date(), "dd MMM yyyy, hh:mm a")}
              </span>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                Total Billed
              </span>
              <p className="text-lg font-black text-slate-900 mt-1">
                {formatCurrency(filteredData.sales, "INR")}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                Total Collected
              </span>
              <p className="text-lg font-black text-green-800 mt-1">
                {formatCurrency(filteredData.collected, "INR")}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                Pending Dues
              </span>
              <p className="text-lg font-black text-amber-800 mt-1">
                {formatCurrency(filteredData.balanceDue, "INR")}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                Collection Rate
              </span>
              <p className="text-lg font-black text-green-800 mt-1">
                {Math.round(filteredData.collectionRate)}%
              </p>
            </div>
          </div>

          {/* Sales Invoice Ledger Table */}
          <div className="mb-8">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">
              I. Sales & Invoices Ledger ({filteredData.invoices.length}{" "}
              entries)
            </h3>
            {filteredData.invoices.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No invoices found in this period.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="w-full text-left text-xs border-collapse excel-table">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 uppercase tracking-widest font-black text-[9px]">
                    <th className="py-2 px-3 border border-slate-300">No</th>
                    <th className="py-2 px-3 border border-slate-300">
                      Invoice ID
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      Customer Name
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      Issue Date
                    </th>
                    <th className="py-2 px-3 text-right border border-slate-300">
                      Amount
                    </th>
                    <th className="py-2 px-3 text-right border border-slate-300">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.invoices.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      className={cn(
                        "text-slate-700 font-medium border-b border-slate-200",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                      )}
                    >
                      <td className="py-2 px-3 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 font-mono font-bold text-slate-900">
                        {inv.invoice_number ||
                          inv.invoiceNumber ||
                          inv.id?.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-2 px-3 border border-slate-200">
                        {inv.customer_name ||
                          inv.customerName ||
                          "Walk-in Client"}
                      </td>
                      <td className="py-2 px-3 border border-slate-200">
                        {inv.created_at || inv.createdAt
                          ? format(
                              parseDateSafe(inv.created_at || inv.createdAt),
                              "dd MMM yyyy",
                            )
                          : "N/A"}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 text-right font-bold tabular-nums text-slate-900">
                        {formatCurrency(inv.amount || 0, inv.currency || "INR")}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 text-right uppercase tracking-wider font-black text-[9px]">
                        {inv.status || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Collections Ledger Table */}
          <div className="mb-12">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">
              II. Payments & Collections Ledger ({filteredData.payments.length}{" "}
              entries)
            </h3>
            {filteredData.payments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No payments received in this period.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="w-full text-left text-xs border-collapse excel-table">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 uppercase tracking-widest font-black text-[9px]">
                    <th className="py-2 px-3 border border-slate-300">No</th>
                    <th className="py-2 px-3 border border-slate-300">
                      Customer Name
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      Payment Date
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      Method
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      Reference ID
                    </th>
                    <th className="py-2 px-3 text-right border border-slate-300">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.payments.map((pay, idx) => {
                    const resolvedCustName = pay.customer_name || pay.customerName || customers.find(c => c.id === pay.customer_id)?.name || "Walk-in Customer";
                    return (
                      <tr
                        key={pay.id || idx}
                        className={cn(
                          "text-slate-700 font-medium border-b border-slate-200",
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                        )}
                      >
                        <td className="py-2 px-3 border border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 font-bold text-slate-900">
                          {resolvedCustName}
                        </td>
                        <td className="py-2 px-3 border border-slate-200">
                          {pay.date
                            ? format(parseDateSafe(pay.date), "dd MMM yyyy")
                            : "N/A"}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 font-bold">
                          {pay.payment_method || pay.paymentMethod || "Cash"}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 font-mono text-[10px] text-slate-500">
                          {pay.reference ||
                            pay.reference_id ||
                            pay.id?.slice(0, 8) ||
                            "-"}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-right font-bold tabular-nums text-slate-900">
                          {formatCurrency(pay.amount || 0, pay.currency || "INR")}
                        </td>
                      </tr>
                    )})}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Verification Footer */}
          <div className="border-t border-slate-200 pt-6 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <p>
              Generated via InvoCentric Financial Ledger & Billing Ecosystem
            </p>
            <p className="text-[8px] mt-1 text-slate-500">
              Confidential Statement · For Internal Records Only
            </p>
          </div>
        </div>
      </div>

      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        whatsAppUrl={whatsAppUrlState}
        documentTitle="Business Report"
        copiedToClipboard={copiedToClipboard}
        fileName={generatedPdfFileName || `Report_${timeRange}.pdf`}
        onDirectSharePdf={generatedPdfBlob ? handleDirectPdfShare : undefined}
      />

      {/* CA & Tax Audit Package Modal */}
      <AnimatePresence>
        {showCaModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shadow-inner">
                    <Building2 size={20} className="text-indigo-300" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      CA Data & Tax Audit Package
                    </h2>
                    <p className="text-xs text-indigo-200/80">
                      GSTR-1, GSTR-2B, Expenses & Debtors ledger in multi-sheet Excel
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCaModal(false)}
                  className="p-1.5 text-indigo-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
                
                {/* Period Selector Tabs */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2">
                    Select Filing / Audit Period:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                    {[
                      { id: "this_month", label: "This Month" },
                      { id: "last_month", label: "Last Month" },
                      { id: "this_quarter", label: "This Quarter" },
                      { id: "fy", label: "Full FY" },
                      { id: "all", label: "All Time" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setCaPeriod(tab.id as any)}
                        className={cn(
                          "py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center",
                          caPeriod === tab.id
                            ? "bg-white text-indigo-900 shadow-sm font-black"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                    Active Period: <span className="font-bold text-indigo-700">{caFilteredData.label}</span>
                  </p>
                </div>

                {/* Audit Key Metrics Summary Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                    <span>Tax & Accounting Snapshot</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Audit Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Taxable Sales</span>
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        {formatCurrency(caFilteredData.totalSalesTaxable, "INR")}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">{caFilteredData.invoices.length} invoices</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Output GST</span>
                      <span className="text-xs sm:text-sm font-black text-indigo-700">
                        {formatCurrency(caFilteredData.totalOutputTax, "INR")}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Sales tax liability</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Eligible ITC</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-700">
                        {formatCurrency(caFilteredData.totalInputTax, "INR")}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">{caFilteredData.purchases.length} purchase bills</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Net Tax Payable</span>
                      <span className="text-xs sm:text-sm font-black text-amber-600">
                        {formatCurrency(caFilteredData.netGstPayable, "INR")}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {caFilteredData.itcBalance > 0 ? `ITC Bal: ${formatCurrency(caFilteredData.itcBalance, "INR")}` : 'After ITC set-off'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5 Sheets Included Breakdown */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block mb-2">
                    5 Audit-Grade Tabs Inside The Excel (.xlsx):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                      <span><strong>Sheet 1:</strong> GST & Financial Summary</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                      <span><strong>Sheet 2:</strong> GSTR-1 Sales Register</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                      <span><strong>Sheet 3:</strong> GSTR-2B Purchases Register</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                      <span><strong>Sheet 4:</strong> Operating Expenses Register</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:col-span-2">
                      <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                      <span><strong>Sheet 5:</strong> Debtors Ledger & Receivables Aging</span>
                    </div>
                  </div>
                </div>

                {/* Contact Inputs for CA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      CA / Tax Consultant Mobile No. (WhatsApp):
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={caPhone}
                        onChange={(e) => setCaPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      CA Email Address (Optional):
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={caEmail}
                        onChange={(e) => setCaEmail(e.target.value)}
                        placeholder="ca.name@example.com"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Success Message Banner */}
                {caSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-fadeIn">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{caSuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <button
                  onClick={handleCopyCaSummary}
                  className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {caCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{caCopied ? "Summary Copied!" : "Copy Summary"}</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleCaWhatsApp}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                  >
                    <WhatsAppIcon size={15} />
                    <span>WhatsApp CA</span>
                  </button>

                  <button
                    onClick={handleCaEmail}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                  >
                    <Mail size={15} />
                    <span>Email CA</span>
                  </button>

                  <button
                    onClick={handleDownloadCaPackage}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                  >
                    <Download size={15} />
                    <span>Download Excel</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
