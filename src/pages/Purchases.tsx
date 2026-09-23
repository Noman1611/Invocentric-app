import { getSecureStorage } from "../utils/cryptoUtils";
import { getStoredUserProfile } from "../utils/settingsStorage";
import { useState, useMemo } from "react";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  Filter,
  Download,
  Package,
  Trash2,
  Edit3,
  Calendar,
  DollarSign,
  AlertCircle,
  FileText,
  X,
  Printer,
  Phone,
} from "lucide-react";
import { formatCurrency, cn, getWhatsAppShareUrl, isMobile, openInBrowser } from "../lib/utils";
import { WhatsAppShareModal } from "../components/WhatsAppShareModal";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { format, parseISO } from "date-fns";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../hooks/useData";
import { dbService } from "../services/dbService";
import { Logo } from "../components/Logo";

export default function Purchases() {
  const { user, isOfflineMode } = useAuth();
  const { purchases = [], items = [], loading } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"All" | "Paid" | "Unpaid">(
    "All",
  );
  const [sellerInfo, setSellerInfo] = useState<any>(null);

  // WhatsApp Share Modal States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppShareText, setWhatsAppShareText] = useState("");
  const [whatsAppUrlState, setWhatsAppUrlState] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  React.useEffect(() => {
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
        console.error("Error fetching supplier settings profile:", err);
      }
    };
    fetchSellerInfo();
  }, [user, isOfflineMode]);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    supplierName: "",
    supplierGstin: "",
    billNumber: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    status: "Paid",
  });

  const pMethods = [
    "Cash",
    "Bank Transfer",
    "UPI",
    "Credit Card",
    "Debit Card",
  ];

  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set(
      purchases.map((p: any) => p.supplier_name).filter(Boolean),
    );
    return Array.from(suppliers);
  }, [purchases]);

  const uniqueItemsList = useMemo(() => {
    const list = new Set(
      purchases.map((p: any) => p.description).filter(Boolean),
    );
    items.forEach((item: any) => {
      if (item.name) list.add(item.name);
    });
    return Array.from(list);
  }, [purchases, items]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((pur: any) => {
      const matchSearch =
        (pur.description || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (pur.supplier_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchStatus =
        statusFilter === "All" ? true : (pur.status || "Paid") === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [purchases, searchTerm, statusFilter]);

  const totalPurchase = useMemo(() => {
    return filteredPurchases.reduce(
      (sum: number, pur: any) => sum + (pur.amount || 0),
      0,
    );
  }, [filteredPurchases]);

  const statementData = useMemo(() => {
    if (!statementSupplier) return [];
    return purchases
      .filter((pur: any) => pur.supplier_name === statementSupplier)
      .sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
  }, [purchases, statementSupplier]);

  const statementTotals = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    statementData.forEach((pur: any) => {
      if ((pur.status || "Paid") === "Paid") {
        paid += pur.amount || 0;
      } else {
        unpaid += pur.amount || 0;
      }
    });
    return { paid, unpaid, total: paid + unpaid };
  }, [statementData]);

  const handleWhatsAppShare = async () => {
    if (!statementSupplier || statementData.length === 0) return;

    const bizName = sellerInfo?.business_name || "INVOCENTRIC";
    const bizPhone = sellerInfo?.phone
      ? `\n*Contact:* ${sellerInfo.phone}`
      : "";

    const formattedTransactions = statementData
      .slice(0, 15)
      .map((pur: any) => {
        const dateStr = format(new Date(pur.date), "dd MMM yyyy");
        const amountStr = formatCurrency(pur.amount, "INR");
        const statusStr = pur.status || "Paid";
        return `📅 ${dateStr} - ${pur.description || "Items"}\n    [${statusStr}] ${amountStr} (${pur.payment_method})`;
      })
      .join("\n");

    const extraCount =
      statementData.length > 15
        ? `\n...and ${statementData.length - 15} more purchases.`
        : "";

    const shareText =
      `*SUPPLIER STATEMENT*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Shop:* ${bizName}${bizPhone}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Supplier Name:* ${statementSupplier}\n` +
      `*Date:* ${format(new Date(), "dd MMM yyyy")}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*SUMMARY:*\n` +
      `• Total Purchased: ${formatCurrency(statementTotals.total, "INR")}\n` +
      `• Total Paid: ${formatCurrency(statementTotals.paid, "INR")}\n` +
      `• *Outstanding Unpaid: ${formatCurrency(statementTotals.unpaid, "INR")}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*RECENT PURCHASES:*\n` +
      `${formattedTransactions || "No purchases in records."}${extraCount}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Generated via InvoCentric.\n` +
      `Thank you!`;

    const whatsappUrl = getWhatsAppShareUrl("", shareText);

    setWhatsAppShareText(shareText);
    setWhatsAppUrlState(whatsappUrl);

    if (isMobile()) {
      window.location.href = whatsappUrl;
    } else {
      openInBrowser(whatsappUrl);
    }

    setShowWhatsAppModal(true);

    // 2. Copy to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopiedToClipboard(true);
      }
    } catch (clipErr) {
      setCopiedToClipboard(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      await dbService.add("purchases", {
        description: formData.billNumber ? `Bill #${formData.billNumber} - ${formData.description}` : formData.description,
        amount: parseFloat(formData.amount as string),
        supplier_name: formData.supplierName,
        supplier_gstin: formData.supplierGstin,
        bill_number: formData.billNumber,
        date: new Date(formData.date).toISOString(),
        payment_method: formData.paymentMethod,
        status: formData.status,
      }, { userId: user.uid });

      setIsModalOpen(false);
      setFormData({
        description: "",
        amount: "",
        supplierName: "",
        supplierGstin: "",
        billNumber: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Cash",
        status: "Paid",
      });
    } catch (error) {
      console.error("Error adding purchase:", error);
      handleFirestoreError(error, OperationType.CREATE, "purchases");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await dbService.delete("purchases", deletingId, {
        offlineMode: isOfflineMode,
        userId: user?.uid || "",
      });
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting purchase:", error);
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `purchases/${deletingId}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      await dbService.update(
        "purchases",
        id,
        {
          status: "Paid",
        },
        { offlineMode: isOfflineMode, userId: user?.uid || "" },
      );
    } catch (error) {
      console.error("Error marking purchase paid:", error);
      handleFirestoreError(error, OperationType.UPDATE, `purchases/${id}`);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight uppercase">
            Purchases
          </h1>
          <p className="text-neutral-500 font-bold text-sm mt-1 uppercase tracking-wider">
            Manage bought inventory and stock
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsStatementModalOpen(true)}
            className="flex items-center gap-2 p-3 text-neutral-400 hover:text-neutral-900 bg-white border border-neutral-100 rounded-2xl shadow-sm transition-all text-[10px] font-black uppercase tracking-widest leading-none"
          >
            <FileText size={16} />
            <span className="hidden md:inline">Statement</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#000000] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] shadow-xl shadow-neutral-900/10 hover:translate-y-[-2px] transition-all active:scale-95"
          >
            <Plus size={16} />
            Add Purchase
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#10191F] rounded-[2rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
            <Package className="text-green-400" size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">
              Total Purchases
            </p>
            <h2 className="text-4xl font-black tracking-tighter text-white">
              {formatCurrency(totalPurchase, "INR")}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl">
          <AlertCircle size={16} className="text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-100">
            Stock Tracking
          </span>
        </div>
      </motion.div>

      {/* List Container */}
      <div className="glass-card bg-white border border-neutral-100 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md px-0">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <input
              type="text"
              placeholder="SEARCH PURCHASES..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-400 focus:ring-2 focus:ring-black transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-neutral-50 border-none rounded-xl text-[10px] font-black text-neutral-500 uppercase tracking-widest focus:ring-2 focus:ring-black outline-none transition-all cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid / Credit</option>
            </select>
          </div>
        </div>

        {/* Mobile View: Native Card Stack */}
        <div className="block md:hidden divide-y divide-neutral-100">
          {filteredPurchases.length === 0 ? (
            <div className="p-10 text-center">
              <div className="p-5 rounded-full bg-neutral-50 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <Package size={28} className="text-neutral-300" />
              </div>
              <p className="text-sm font-black text-neutral-900 uppercase tracking-tight">
                No purchases found
              </p>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-0.5">
                Start tracking your supplier purchases
              </p>
            </div>
          ) : (
            filteredPurchases.map((pur: any) => (
              <div key={pur.id} className="p-4 space-y-2.5 hover:bg-neutral-50/50 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-neutral-900 uppercase tracking-tight block">
                      {pur.supplier_name || "Vendor"}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-500 block mt-0.5">
                      {pur.description}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mt-1">
                      {format(new Date(pur.date), "dd MMM yyyy")} • {pur.payment_method}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-neutral-900 tracking-tight block">
                      {formatCurrency(pur.amount, "INR")}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block",
                        (pur.status || "Paid") === "Paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700",
                      )}
                    >
                      {pur.status || "Paid"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-100/60">
                  {(pur.status || "Paid") === "Unpaid" && (
                    <button
                      onClick={() => markAsPaid(pur.id)}
                      className="px-3 py-1 bg-neutral-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-neutral-800 transition-all"
                    >
                      Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(pur.id)}
                    className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-lg transition-all"
                    title="Delete Purchase"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Data Table */}
        <div className="hidden md:block overflow-x-auto px-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-3 md:px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">
                  Date
                </th>
                <th className="px-3 md:px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">
                  Supplier/Items
                </th>
                <th className="px-3 md:px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">
                  Method
                </th>
                <th className="px-3 md:px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 text-right">
                  Amount
                </th>
                <th className="px-3 md:px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredPurchases.map((pur: any) => (
                <tr
                  key={pur.id}
                  className="hover:bg-neutral-50/50 transition-all group"
                >
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-tight">
                      {format(new Date(pur.date), "dd MMM yyyy")}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4">
                    <div className="flex justify-start items-center gap-3">
                      <div className="p-2 rounded-xl bg-neutral-100 text-neutral-600 shrink-0">
                        <Package size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-black text-neutral-900 uppercase tracking-tight block">
                          {pur.supplier_name || "Vendor"}
                        </span>
                        <span className="text-[10px] font-bold text-neutral-500">
                          {pur.description}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">
                      {pur.payment_method}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block",
                        (pur.status || "Paid") === "Paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700",
                      )}
                    >
                      {pur.status || "Paid"}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4 text-right whitespace-nowrap">
                    <span className="text-sm font-black text-neutral-900 tracking-tight">
                      {formatCurrency(pur.amount, "INR")}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {(pur.status || "Paid") === "Unpaid" && (
                        <button
                          onClick={() => markAsPaid(pur.id)}
                          className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-neutral-800 transition-all"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(pur.id)}
                        className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-xl transition-all"
                        title="Delete Purchase"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 rounded-full bg-neutral-50">
                        <Package size={40} className="text-neutral-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-neutral-900 uppercase tracking-tight">
                          No purchases found
                        </p>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                          Start tracking your supplier purchases today
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Purchase Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[70] p-4"
            >
              <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-neutral-100">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-xl">
                    <Plus className="text-white" size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">
                    Record Purchase
                  </h3>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">
                    Add a new supplier purchase
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                      Supplier / Vendor Name
                    </label>
                    <input
                      type="text"
                      required
                      list="suppliers-list"
                      value={formData.supplierName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          supplierName: e.target.value,
                        }))
                      }
                      placeholder="E.G., ABC WHOLESALE"
                      className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-300 focus:ring-2 focus:ring-black"
                    />
                    <datalist id="suppliers-list">
                      {uniqueSuppliers.map((supplier: any, idx: number) => (
                        <option key={idx} value={supplier} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                        Supplier Bill / Invoice #
                      </label>
                      <input
                        type="text"
                        value={formData.billNumber}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            billNumber: e.target.value,
                          }))
                        }
                        placeholder="E.G. INV-9042"
                        className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-300 focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                        Supplier GSTIN (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.supplierGstin}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            supplierGstin: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="27AAAAA0000A1Z5"
                        className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-300 focus:ring-2 focus:ring-black"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                      Items / Description
                    </label>
                    <input
                      type="text"
                      required
                      list="items-list"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="E.G., OFFICE CHAIRS OR BULK MATERIALS"
                      className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-300 focus:ring-2 focus:ring-black"
                    />
                    <datalist id="items-list">
                      {uniqueItemsList.map((item: any, idx: number) => (
                        <option key={idx} value={item} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                        Total Bill Amount
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const cleaned = val.replace(/^0+(?=\d)/, "");
                          e.target.value = cleaned;
                          setFormData((prev) => ({ ...prev, amount: cleaned }));
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-300 focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                        Date
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }))
                        }
                        className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-black"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1 border-t border-neutral-100 mt-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                        Payment Method
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {pMethods.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                paymentMethod: m,
                                status: "Paid",
                              }))
                            }
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                              formData.paymentMethod === m &&
                                formData.status === "Paid"
                                ? "bg-neutral-900 text-white shadow-lg"
                                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
                            )}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                        Credit / Unpaid
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            paymentMethod: "Credit",
                            status: "Unpaid",
                          }))
                        }
                        className={cn(
                          "w-full px-4 py-2 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center h-full max-h-10",
                          formData.status === "Unpaid"
                            ? "bg-red-50 border-red-200 text-red-600"
                            : "bg-transparent border-neutral-200 text-neutral-500 hover:border-neutral-300",
                        )}
                      >
                        {formData.status === "Unpaid"
                          ? "Marked Unpaid"
                          : "Mark as Credit"}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-900 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-4 bg-[#000000] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-neutral-900/10 hover:translate-y-[-2px] transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? "SAVING..." : "SAVE RECORD"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Statement Modal */}
      <AnimatePresence>
        {isStatementModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStatementModalOpen(false)}
              className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[70] overflow-hidden flex flex-col"
            >
              <div className="flex-none p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-neutral-100 shadow-sm">
                    <FileText className="text-neutral-900" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-neutral-900 uppercase tracking-tight">
                      Supplier Statement
                    </h2>
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
                      View purchase history
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsStatementModalOpen(false)}
                  className="p-3 bg-white hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 rounded-xl transition-all shadow-sm border border-neutral-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 border-b border-neutral-100">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">
                      Select Supplier
                    </label>
                    <select
                      value={statementSupplier}
                      onChange={(e) => setStatementSupplier(e.target.value)}
                      className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-black outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Choose Supplier --</option>
                      {uniqueSuppliers.map((sup: any, idx: number) => (
                        <option key={idx} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </div>

                  {statementSupplier && (
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="p-4 bg-neutral-50 rounded-2xl">
                        <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">
                          Total Amount
                        </p>
                        <h4 className="text-lg font-black text-neutral-900">
                          {formatCurrency(statementTotals.total, "INR")}
                        </h4>
                      </div>
                      <div className="p-4 bg-green-50 rounded-2xl">
                        <p className="text-[9px] font-black text-green-600/70 uppercase tracking-widest mb-1.5">
                          Total Paid
                        </p>
                        <h4 className="text-lg font-black text-green-700">
                          {formatCurrency(statementTotals.paid, "INR")}
                        </h4>
                      </div>
                      <div className="p-4 bg-red-50 rounded-2xl">
                        <p className="text-[9px] font-black text-red-600/70 uppercase tracking-widest mb-1.5">
                          Total Unpaid
                        </p>
                        <h4 className="text-lg font-black text-red-700">
                          {formatCurrency(statementTotals.unpaid, "INR")}
                        </h4>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto w-full">
                {!statementSupplier ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-neutral-400">
                    <FileText size={48} className="mb-4 text-neutral-200" />
                    <p className="text-sm font-black uppercase tracking-widest">
                      Select a supplier
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest mt-1">
                      to view their statement
                    </p>
                  </div>
                ) : statementData.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400 text-sm font-bold uppercase tracking-widest">
                    No transactions found for this supplier.
                  </div>
                ) : (
                  <div className="p-6 overflow-x-auto">
                    <table className="w-full border-collapse border border-neutral-300 text-xs text-left">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-neutral-300">
                          <th className="py-2 px-3 text-left font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-12">
                            Sr.
                          </th>
                          <th className="py-2 px-3 text-left font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-28">
                            Date
                          </th>
                          <th className="py-2 px-3 text-left font-black uppercase tracking-wider text-neutral-700 border border-neutral-300">
                            Description
                          </th>
                          <th className="py-2 px-3 text-center font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-28">
                            Pay Method
                          </th>
                          <th className="py-2 px-3 text-center font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-24">
                            Status
                          </th>
                          <th className="py-2 px-3 text-right font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-32">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {statementData.map((pur: any, index: number) => (
                          <tr
                            key={pur.id}
                            className={cn(
                              "align-middle border-b border-neutral-200",
                              index % 2 === 0 ? "bg-white" : "bg-neutral-50/50"
                            )}
                          >
                            <td className="py-2 px-3 font-medium text-neutral-500 border border-neutral-200">
                              {index + 1}
                            </td>
                            <td className="py-2 px-3 font-bold text-neutral-900 tabular-nums border border-neutral-200">
                              {format(new Date(pur.date), "dd MMM yyyy")}
                            </td>
                            <td className="py-2 px-3 border border-neutral-200">
                              <p className="font-bold text-neutral-900 uppercase">
                                {pur.description || "Items"}
                              </p>
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-neutral-600 uppercase tracking-tight border border-neutral-200">
                              {pur.payment_method}
                            </td>
                            <td className="py-2 px-3 text-center border border-neutral-200">
                              <span
                                className={cn(
                                  "font-black text-[9px] uppercase tracking-wider",
                                  (pur.status || "Paid") === "Paid"
                                    ? "text-green-600"
                                    : "text-red-600"
                                )}
                              >
                                {pur.status || "Paid"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-black text-neutral-900 tabular-nums border border-neutral-200">
                              {formatCurrency(pur.amount, "INR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-neutral-100 font-black border-t-2 border-neutral-300">
                          <td
                            colSpan={4}
                            className="py-2 px-3 text-right text-[10px] uppercase tracking-wider text-neutral-700 border border-neutral-300"
                          >
                            Totals
                          </td>
                          <td className="py-2 px-3 text-center text-red-600 font-bold border border-neutral-300">
                            {statementTotals.unpaid > 0
                              ? `Unpaid: ${formatCurrency(statementTotals.unpaid, "INR")}`
                              : "All Paid"}
                          </td>
                          <td className="py-2 px-3 text-right text-xs text-neutral-900 tabular-nums border border-neutral-300">
                            {formatCurrency(statementTotals.total, "INR")}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {statementSupplier && statementData.length > 0 && (
                <div className="flex-none p-6 bg-white border-t border-neutral-100 flex gap-3">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-neutral-200 transition-all"
                  >
                    <Printer size={18} />
                    Print
                  </button>
                  <button
                    onClick={handleWhatsAppShare}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#25D366] text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-green-500/20 hover:bg-[#128C7E] transition-all"
                  >
                    <WhatsAppIcon size={18} />
                    WhatsApp
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">Delete Purchase?</h2>
              <p className="text-neutral-500 mb-8">
                Are you sure you want to delete this record? This action cannot
                be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="btn-primary flex-1 bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 text-white"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Statement for Supplier (visible only when printing) */}
      {isStatementModalOpen && statementSupplier && (
        <div className="hidden print:block w-full text-black bg-white p-8 font-sans purchase-statement-print-section">
          {/* Statement Header */}
          <div className="border-b-2 border-neutral-950 pb-6 mb-6">
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
                  <h1 className="text-3xl font-black uppercase tracking-tight text-neutral-900">
                    {sellerInfo?.business_name || "INVOCENTRIC"}
                  </h1>
                  {sellerInfo?.company_name && (
                    <p className="text-sm font-bold text-neutral-600 uppercase mt-0.5">
                      {sellerInfo.company_name}
                    </p>
                  )}
                  {sellerInfo?.address && (
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      {sellerInfo.address}
                    </p>
                  )}
                  {sellerInfo?.phone && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Phone: {sellerInfo.phone}
                    </p>
                  )}
                  {sellerInfo?.email && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Email: {sellerInfo.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-extrabold uppercase tracking-widest text-neutral-400">
                  Supplier Statement
                </h2>
                <p className="text-xs font-bold text-neutral-500 mt-2 uppercase tracking-wider">
                  Statement Date
                </p>
                <p className="text-sm font-black text-neutral-900">
                  {format(new Date(), "dd MMM yyyy")}
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-between items-end gap-8">
              <div>
                <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1">
                  Supplier Info
                </p>
                <h3 className="text-lg font-black uppercase text-neutral-900">
                  {statementSupplier}
                </h3>
              </div>
              <div className="flex gap-2 text-center">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <p className="text-[8px] font-black uppercase text-neutral-400 mb-1">
                    Total Bill
                  </p>
                  <p className="text-xs font-black text-neutral-900">
                    {formatCurrency(statementTotals.total, "INR")}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-[8px] font-black uppercase text-green-600/70 mb-1">
                    Total Paid
                  </p>
                  <p className="text-xs font-black text-green-700">
                    {formatCurrency(statementTotals.paid, "INR")}
                  </p>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-[8px] font-black uppercase text-red-600/70 mb-1">
                    Outstanding
                  </p>
                  <p className="text-xs font-black text-red-700">
                    {formatCurrency(statementTotals.unpaid, "INR")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Statement Ledger Table */}
          <table className="w-full border-collapse border border-neutral-300 text-xs">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-300 print:bg-neutral-100">
                <th className="py-2 px-3 text-left font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-12">
                  Sr.
                </th>
                <th className="py-2 px-3 text-left font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-28">
                  Date
                </th>
                <th className="py-2 px-3 text-left font-black uppercase tracking-wider text-neutral-700 border border-neutral-300">
                  Description
                </th>
                <th className="py-2 px-3 text-center font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-28">
                  Pay Method
                </th>
                <th className="py-2 px-3 text-center font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-24">
                  Status
                </th>
                <th className="py-2 px-3 text-right font-black uppercase tracking-wider text-neutral-700 border border-neutral-300 w-32">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {statementData.map((pur: any, index: number) => (
                <tr
                  key={pur.id}
                  className={cn(
                    "align-middle border-b border-neutral-200",
                    index % 2 === 0 ? "bg-white" : "bg-neutral-50/50"
                  )}
                >
                  <td className="py-2 px-3 font-medium text-neutral-500 border border-neutral-200">
                    {index + 1}
                  </td>
                  <td className="py-2 px-3 font-bold text-neutral-900 tabular-nums border border-neutral-200">
                    {format(new Date(pur.date), "dd MMM yyyy")}
                  </td>
                  <td className="py-2 px-3 border border-neutral-200">
                    <p className="font-bold text-neutral-900 uppercase">
                      {pur.description || "Items"}
                    </p>
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-neutral-600 uppercase tracking-tight border border-neutral-200">
                    {pur.payment_method}
                  </td>
                  <td className="py-2 px-3 text-center border border-neutral-200">
                    <span
                      className={cn(
                        "font-black text-[9px] uppercase tracking-wider",
                        (pur.status || "Paid") === "Paid"
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {pur.status || "Paid"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-black text-neutral-900 tabular-nums border border-neutral-200">
                    {formatCurrency(pur.amount, "INR")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-100 font-black border-t-2 border-neutral-300">
                <td
                  colSpan={4}
                  className="py-2 px-3 text-right text-[10px] uppercase tracking-wider text-neutral-700 border border-neutral-300"
                >
                  Totals
                </td>
                <td className="py-2 px-3 text-center text-red-600 font-bold border border-neutral-300">
                  {statementTotals.unpaid > 0
                    ? `Unpaid: ${formatCurrency(statementTotals.unpaid, "INR")}`
                    : "All Paid"}
                </td>
                <td className="py-2 px-3 text-right text-xs text-neutral-900 tabular-nums border border-neutral-300">
                  {formatCurrency(statementTotals.total, "INR")}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Statement Footer */}
          <div className="mt-12 pt-6 border-t border-dashed border-neutral-300 flex justify-between items-center text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
            <p>Generated via InvoCentric Invoicing</p>
            <p>This is a computer generated document</p>
          </div>
        </div>
      )}

      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        whatsAppUrl={whatsAppUrlState}
        documentTitle="Supplier Statement"
        copiedToClipboard={copiedToClipboard}
        fileName={`Supplier_Statement_${statementSupplier || 'Supplier'}.pdf`}
      />

      {/* Print styles to ensure beautiful, clean lines and suppress all screen controls */}
      <style>{`
         @media print {
           /* Hide everything */
           body * {
             visibility: hidden !important;
           }
           /* Show only our print container and its descendants */
           .purchase-statement-print-section,
           .purchase-statement-print-section * {
             visibility: visible !important;
           }
           .purchase-statement-print-section {
             display: block !important;
             position: absolute !important;
             left: 0 !important;
             top: 0 !important;
             width: 100% !important;
             height: auto !important;
             background: white !important;
             color: black !important;
             z-index: 9999999 !important;
             padding: 0 !important;
             margin: 0 !important;
           }
           /* Adjust page settings */
           @page {
             size: A4 portrait;
             margin: 15mm 15mm 15mm 15mm;
           }
           tr {
             page-break-inside: avoid !important;
             break-inside: avoid !important;
           }
           thead {
             display: table-header-group !important;
           }
         }
       `}</style>
    </div>
  );
}
