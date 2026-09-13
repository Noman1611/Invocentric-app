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
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  useInvoices,
  usePayments,
  useCustomers,
  useSettings,
} from "../hooks/useData";
import { formatCurrency, cn, getWhatsAppShareUrl, isMobile } from "../lib/utils";
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
  const { isPro, triggerUpgradeModal } = useAuth();

  const [timeRange, setTimeRange] = useState(isPro ? "6m" : "1m");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"invoices" | "payments">(
    "invoices",
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const reportPrintRef = useRef<HTMLDivElement>(null);

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

    // 1. OPEN WHATSAPP IMMEDIATELY without waiting for async image/PDF rendering!
    if (isMobile()) {
      window.location.href = whatsappUrl;
    } else {
      window.open(whatsappUrl, "_blank");
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
    </>
  );
}
