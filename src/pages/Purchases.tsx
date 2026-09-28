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
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Eye,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { extractInvoiceFromImage, ExtractedInvoice } from "../services/aiService";
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
  const { purchases = [], items = [], customers = [], loading } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPurchaseForView, setSelectedPurchaseForView] = useState<any | null>(null);

  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState<"All" | "Paid" | "Unpaid">(
    "All",
  );
  const [sellerInfo, setSellerInfo] = useState<any>(null);

  // Low-Stock 1-Click PO Items state
  const [poLineItems, setPoLineItems] = useState<Array<{ name: string; quantity: number; price: number; gstPercent?: number; total: number }>>([]);

  // Smart Bill Scan / OCR state
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [billScanSuccess, setBillScanSuccess] = useState<string | null>(null);
  const [billScanError, setBillScanError] = useState<string | null>(null);
  const [extractedBillData, setExtractedBillData] = useState<ExtractedInvoice | null>(null);
  const [showBillVerifyModal, setShowBillVerifyModal] = useState(false);
  const [autoIncrementStock, setAutoIncrementStock] = useState(true);
  const billFileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  // Auto-detect incoming PO from Low Stock generator
  React.useEffect(() => {
    if (location.state?.createPoFromLowStock && Array.isArray(location.state?.poItems) && location.state.poItems.length > 0) {
      const poItems = location.state.poItems;
      const detectedSupplier = poItems.find((p: any) => p.supplierName)?.supplierName || "";
      const totalEstimated = poItems.reduce((acc: number, cur: any) => acc + ((Number(cur.quantity) || 1) * (Number(cur.price) || 0)), 0);
      const desc = `PO for ${poItems.length} Low-Stock Items: ${poItems.map((p: any) => `${p.name} (x${p.quantity})`).slice(0, 3).join(', ')}${poItems.length > 3 ? '...' : ''}`;

      setFormData({
        description: desc,
        amount: String(totalEstimated || ''),
        supplierName: detectedSupplier,
        supplierGstin: "",
        billNumber: `PO-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        status: "Unpaid",
      });
      setPoLineItems(poItems.map((p: any) => ({
        name: p.name,
        quantity: Number(p.quantity) || 1,
        price: Number(p.price) || 0,
        gstPercent: 18,
        total: (Number(p.quantity) || 1) * (Number(p.price) || 0)
      })));
      setIsModalOpen(true);
    }
  }, [location.state]);

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningBill(true);
    setBillScanError(null);
    setBillScanSuccess(null);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const raw = evt.target?.result as string;
          let mime = file.type || 'image/jpeg';
          let base64 = raw;
          if (raw.startsWith('data:')) {
            const parts = raw.split(';base64,');
            mime = parts[0].replace('data:', '') || mime;
            base64 = parts[1] || '';
          }
          const extracted = await extractInvoiceFromImage(base64, mime);
          setExtractedBillData(extracted);
          setShowBillVerifyModal(true);
          setBillScanSuccess(`Successfully extracted bill with ${extracted.items?.length || 0} line items!`);
        } catch (err: any) {
          console.error("AI Bill extraction error:", err);
          setBillScanError(err.message || "Failed to parse bill. Please upload a clear image or enter manually.");
        } finally {
          setIsScanningBill(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsScanningBill(false);
      setBillScanError("Could not read file.");
    }
  };

  const handleUpdateExtractedHeader = (field: string, value: any) => {
    setExtractedBillData((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleUpdateExtractedItem = (index: number, field: string, value: any) => {
    setExtractedBillData((prev) => {
      if (!prev || !prev.items) return prev;
      const updatedItems = [...prev.items];
      const updatedItem = { ...updatedItems[index], [field]: value };

      if (field === 'rate' || field === 'quantity' || field === 'price' || field === 'discount' || field === 'gstPercent') {
        const qty = Number(field === 'quantity' ? value : updatedItem.quantity) || 1;
        const rate = Number(field === 'rate' || field === 'price' ? value : (updatedItem.rate ?? updatedItem.price ?? 0));
        const disc = Number(field === 'discount' ? value : (updatedItem.discount || 0));
        const gst = Number(field === 'gstPercent' ? value : (updatedItem.gstPercent || 0));
        const base = Math.max(0, (qty * rate) - disc);
        updatedItem.amount = Math.round(base * (1 + (gst / 100)) * 100) / 100;
      }

      updatedItems[index] = updatedItem;
      const totalAmount = updatedItems.reduce((acc, it) => acc + (Number(it.amount) || ((Number(it.quantity) || 1) * (Number(it.rate || it.price) || 0))), 0);
      return { ...prev, items: updatedItems, totalAmount };
    });
  };

  const handleRemoveExtractedItem = (index: number) => {
    setExtractedBillData((prev) => {
      if (!prev || !prev.items) return prev;
      const updatedItems = prev.items.filter((_, i) => i !== index);
      const totalAmount = updatedItems.reduce((acc, it) => acc + (Number(it.amount) || ((Number(it.quantity) || 1) * (Number(it.rate || it.price) || 0))), 0);
      return { ...prev, items: updatedItems, totalAmount };
    });
  };

  const handleAddExtractedItem = () => {
    setExtractedBillData((prev) => {
      if (!prev) return prev;
      const newItem = {
        description: "New Item",
        quantity: 1,
        rate: 0,
        price: 0,
        amount: 0,
        unit: "pcs",
        hsn: "",
        gstPercent: 0,
      };
      const itemsList = [...(prev.items || []), newItem];
      return { ...prev, items: itemsList };
    });
  };

  const handleConfirmExtractedBill = async () => {
    if (!extractedBillData || !user) return;
    setIsSubmitting(true);
    try {
      const supplierName = (extractedBillData.supplierName || formData.supplierName || "Unknown Supplier").trim();
      const billNo = (extractedBillData.invoiceNo || extractedBillData.supplierBillNo || `BILL-${Date.now().toString().slice(-6)}`).trim();

      const rawItems = Array.isArray(extractedBillData.items) ? extractedBillData.items : [];

      // Format and standardize line items with all details
      const formattedItems = rawItems.map((it: any) => {
        const name = (it.description || it.name || "Item").trim();
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate ?? it.price ?? 0);
        const discount = Number(it.discount) || 0;
        const gstPercent = Number(it.gstPercent) || 0;
        const calculatedAmt = (it.amount !== undefined && !isNaN(Number(it.amount)) && Number(it.amount) > 0)
          ? Number(it.amount)
          : Math.round(((qty * rate) - discount) * (1 + (gstPercent / 100)) * 100) / 100;

        return {
          name,
          description: name,
          quantity: qty,
          qty,
          unit: it.unit || "pcs",
          rate,
          price: rate,
          cost_price: rate,
          costPrice: rate,
          discount,
          gstPercent,
          gst_percent: gstPercent,
          amount: calculatedAmt,
          hsn: (it.hsn || "").toString().trim(),
          barcode: (it.barcode || "").toString().trim(),
          batch_no: (it.batchNo || it.batch || "").toString().trim(),
          batch: (it.batchNo || it.batch || "").toString().trim(),
          serial_no: (it.serialNo || it.serial_no || "").toString().trim(),
        };
      });

      const totalAmt = extractedBillData.totalAmount || formattedItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);
      const taxableAmt = Number(extractedBillData.taxableAmount) || Number(extractedBillData.subTotal) || Math.max(0, totalAmt - (Number(extractedBillData.cgst) || 0) - (Number(extractedBillData.sgst) || 0) - (Number(extractedBillData.igst) || 0));
      const cgstAmt = Number(extractedBillData.cgst) || 0;
      const sgstAmt = Number(extractedBillData.sgst) || 0;
      const igstAmt = Number(extractedBillData.igst) || 0;
      const taxAmt = cgstAmt + sgstAmt + igstAmt;
      const invoiceDateIso = extractedBillData.invoiceDate ? new Date(extractedBillData.invoiceDate).toISOString() : new Date().toISOString();

      const itemsDesc = formattedItems.map((it: any) => `${it.name} (x${it.quantity})`).slice(0, 4).join(', ');

      const purchaseRecord = {
        description: `Bill #${billNo} - ${itemsDesc || 'Supplier Bill Items'}${formattedItems.length > 4 ? ` +${formattedItems.length - 4} more` : ''}`,
        amount: Number(totalAmt) || 0,
        sub_total: Number(extractedBillData.subTotal) || taxableAmt,
        taxable_amount: taxableAmt,
        cgst: cgstAmt,
        sgst: sgstAmt,
        igst: igstAmt,
        tax_amount: taxAmt,
        supplier_name: supplierName,
        supplier_gstin: (extractedBillData.supplierGst || '').toUpperCase(),
        supplier_phone: extractedBillData.supplierPhone || '',
        supplier_address: extractedBillData.supplierAddress || '',
        bill_number: billNo,
        date: invoiceDateIso,
        payment_method: "Bank Transfer",
        status: "Paid",
        items: formattedItems
      };

      await dbService.add("purchases", purchaseRecord, { userId: user.uid, offlineMode: isOfflineMode });

      // Auto-register Supplier in Customers/Parties if not already registered
      if (supplierName && !['supplier', 'vendor', 'unknown supplier', 'cash'].includes(supplierName.toLowerCase())) {
        const existingSupplier = (customers || []).find((c: any) =>
          (c.name || '').toLowerCase().trim() === supplierName.toLowerCase() ||
          (c.company_name || '').toLowerCase().trim() === supplierName.toLowerCase()
        );
        if (!existingSupplier) {
          try {
            await dbService.add("customers", {
              name: supplierName,
              company_name: supplierName,
              gst_number: (extractedBillData.supplierGst || '').toUpperCase(),
              phone: extractedBillData.supplierPhone || '',
              address: extractedBillData.supplierAddress || '',
              party_type: 'Supplier',
              notes: `Auto-registered from AI Purchase Bill #${billNo}`,
            }, { userId: user.uid, offlineMode: isOfflineMode });
          } catch (supErr) {
            console.warn("Could not auto-register supplier:", supErr);
          }
        }
      }

      // Automatically add/update all items in Item Section (Inventory)
      let addedCount = 0;
      let updatedCount = 0;

      if (autoIncrementStock && formattedItems.length > 0) {
        // Track local map of processed items to handle duplicates in the same bill
        const processedItemsByName = new Map<string, any>();
        items.forEach((i: any) => {
          if (i.name) processedItemsByName.set(i.name.trim().toLowerCase(), { ...i });
        });

        for (const item of formattedItems) {
          if (!item.name) continue;
          const itNameLower = item.name.toLowerCase();
          const invMatch = processedItemsByName.get(itNameLower) ||
            (item.barcode ? items.find((i: any) => i.barcode && i.barcode === item.barcode) : null);

          const addedQty = Number(item.quantity) || 1;
          const itemRate = Number(item.rate) || 0;

          if (invMatch && invMatch.id) {
            // Existing item in items collection -> update stock, cost price, and metadata
            const currentStock = Number(invMatch.stock) || 0;
            const newStock = currentStock + addedQty;

            const updatePayload: any = {
              stock: newStock,
              last_purchase_price: itemRate || invMatch.last_purchase_price || 0,
              purchase_price: itemRate || invMatch.purchase_price || 0,
              costPrice: itemRate || invMatch.costPrice || 0,
              cost_price: itemRate || invMatch.cost_price || 0,
              supplier_name: supplierName || invMatch.supplier_name || '',
            };

            if (item.hsn && !invMatch.hsn) updatePayload.hsn = item.hsn;
            if (item.barcode && !invMatch.barcode) updatePayload.barcode = item.barcode;
            if (item.batch_no && !invMatch.batch_no) updatePayload.batch_no = item.batch_no;
            if (item.serial_no) {
              const existingSerials = Array.isArray(invMatch.serials) ? invMatch.serials : [];
              const newSerials = item.serial_no.split(',').map((s: string) => s.trim()).filter(Boolean);
              updatePayload.serials = Array.from(new Set([...existingSerials, ...newSerials]));
              updatePayload.serial_no = item.serial_no;
            }
            if (item.gstPercent && !invMatch.gstPercent) updatePayload.gstPercent = item.gstPercent;

            await dbService.update("items", invMatch.id, updatePayload, { userId: user.uid, offlineMode: isOfflineMode });
            processedItemsByName.set(itNameLower, { ...invMatch, ...updatePayload, stock: newStock });
            updatedCount++;
          } else {
            // New item -> automatically add to items collection so it appears in Item Section!
            const sellingPrice = itemRate > 0 ? Math.round(itemRate * 1.25) : 0;
            const serialsList = item.serial_no ? item.serial_no.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

            const newItemPayload = {
              name: item.name,
              description: item.description || '',
              price: sellingPrice,
              purchase_price: itemRate,
              costPrice: itemRate,
              cost_price: itemRate,
              last_purchase_price: itemRate,
              stock: addedQty,
              unit: item.unit || 'pcs',
              category: 'General',
              low_stock_threshold: 5,
              hsn: item.hsn || '',
              barcode: item.barcode || '',
              batch_no: item.batch_no || '',
              batch: item.batch_no || '',
              serial_no: item.serial_no || '',
              serials: serialsList,
              gstPercent: item.gstPercent || 0,
              supplier_name: supplierName || '',
              internal_notes: `Auto-added from AI Purchase Bill #${billNo}`,
              active: true,
            };

            const created = await dbService.add("items", newItemPayload, { userId: user.uid, offlineMode: isOfflineMode });
            processedItemsByName.set(itNameLower, { ...newItemPayload, id: created.id });
            addedCount++;
          }
        }
      }

      setShowBillVerifyModal(false);
      setExtractedBillData(null);
      setBillScanSuccess(`✅ Purchase bill #${billNo} saved! ${formattedItems.length} item(s) processed (${addedCount} new items added to Item section, ${updatedCount} existing items stock updated).`);
      setTimeout(() => setBillScanSuccess(null), 8000);
    } catch (err: any) {
      console.error("Error confirming extracted purchase bill:", err);
      alert("Failed to save purchase bill: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

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
      const itemsList = poLineItems.length > 0 ? poLineItems.map(p => ({
        name: p.name,
        description: p.name,
        quantity: p.quantity,
        qty: p.quantity,
        rate: p.price,
        price: p.price,
        cost_price: p.price,
        costPrice: p.price,
        gstPercent: p.gstPercent,
        amount: p.total
      })) : [];

      await dbService.add("purchases", {
        description: formData.billNumber ? `Bill #${formData.billNumber} - ${formData.description}` : formData.description,
        amount: parseFloat(formData.amount as string),
        supplier_name: formData.supplierName,
        supplier_gstin: formData.supplierGstin,
        bill_number: formData.billNumber,
        date: new Date(formData.date).toISOString(),
        payment_method: formData.paymentMethod,
        status: formData.status,
        items: itemsList
      }, { userId: user.uid, offlineMode: isOfflineMode });

      setIsModalOpen(false);
      setPoLineItems([]);
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

        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <input
            type="file"
            ref={billFileInputRef}
            accept="image/*,application/pdf"
            onChange={handleBillUpload}
            className="hidden"
          />
          <button
            onClick={() => billFileInputRef.current?.click()}
            disabled={isScanningBill}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-2xl shadow-sm transition-all text-[10px] font-black uppercase tracking-wider leading-none"
            title="Scan or upload supplier bill via AI OCR"
          >
            {isScanningBill ? (
              <>
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span>Scanning Bill...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-emerald-600" />
                <span>Scan/Upload Bill</span>
              </>
            )}
          </button>
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

      {billScanSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{billScanSuccess}</span>
        </div>
      )}
      {billScanError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{billScanError}</span>
        </div>
      )}

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
                    {Array.isArray(pur.items) && pur.items.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Package size={10} />
                          {pur.items.length} {pur.items.length === 1 ? 'Item' : 'Items'}
                        </span>
                        {pur.bill_number && (
                          <span className="text-[9px] font-mono text-neutral-400">
                            #{pur.bill_number}
                          </span>
                        )}
                      </div>
                    )}
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
                  <button
                    onClick={() => setSelectedPurchaseForView(pur)}
                    className="p-1.5 text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-all"
                    title="View Purchase Bill & Item Details"
                  >
                    <Eye size={14} />
                  </button>
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
                        {Array.isArray(pur.items) && pur.items.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Package size={10} />
                              {pur.items.length} {pur.items.length === 1 ? 'Item' : 'Items'}
                            </span>
                            {pur.bill_number && (
                              <span className="text-[9px] font-mono text-neutral-400">
                                #{pur.bill_number}
                              </span>
                            )}
                          </div>
                        )}
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
                      <button
                        onClick={() => setSelectedPurchaseForView(pur)}
                        className="p-2 text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all"
                        title="View Purchase Bill & Item Details"
                      >
                        <Eye size={16} />
                      </button>
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg z-[70] max-h-[90vh] flex flex-col"
            >
              <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-8 border border-neutral-100 overflow-y-auto max-h-[90vh]">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-xl">
                    <Plus className="text-white" size={28} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-neutral-900 uppercase tracking-tight">
                    Record Purchase
                  </h3>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">
                    Add a new supplier purchase
                  </p>
                </div>

                {poLineItems.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                        <Package size={14} className="text-amber-600" />
                        Low-Stock Reorder ({poLineItems.length} items)
                      </span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">1-Click PO</span>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1 divide-y divide-amber-100 pr-1 text-xs">
                      {poLineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1">
                          <span className="font-semibold text-neutral-800 truncate max-w-[180px]">{item.name}</span>
                          <span className="text-neutral-600 tabular-nums">Qty: {item.quantity} × ₹{item.price} = ₹{item.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
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

      {/* AI Bill Scan Verification Modal */}
      <AnimatePresence>
        {showBillVerifyModal && extractedBillData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBillVerifyModal(false)}
              className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-[75]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-4xl z-[80] max-h-[92vh] flex flex-col"
            >
              <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-7 border border-neutral-100 overflow-y-auto max-h-[92vh] space-y-5">
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">
                        Verify Scanned Bill & Items
                      </h3>
                      <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        Review & edit AI extracted bill items • All items will auto-sync to Item Section
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBillVerifyModal(false)}
                    className="p-2 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Header Info: Supplier & Bill Metadata (Editable) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">
                      Supplier / Vendor Name
                    </label>
                    <input
                      type="text"
                      value={extractedBillData.supplierName || ""}
                      onChange={(e) => handleUpdateExtractedHeader("supplierName", e.target.value)}
                      placeholder="Supplier Name"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-black outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">
                      Supplier GSTIN
                    </label>
                    <input
                      type="text"
                      value={extractedBillData.supplierGst || ""}
                      onChange={(e) => handleUpdateExtractedHeader("supplierGst", e.target.value.toUpperCase())}
                      placeholder="GSTIN (Optional)"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-neutral-900 uppercase focus:bg-white focus:ring-2 focus:ring-black outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">
                      Bill / Invoice #
                    </label>
                    <input
                      type="text"
                      value={extractedBillData.invoiceNo || extractedBillData.supplierBillNo || ""}
                      onChange={(e) => handleUpdateExtractedHeader("invoiceNo", e.target.value)}
                      placeholder="Bill #"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-black outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">
                      Bill Date
                    </label>
                    <input
                      type="date"
                      value={extractedBillData.invoiceDate ? extractedBillData.invoiceDate.split("T")[0] : new Date().toISOString().split("T")[0]}
                      onChange={(e) => handleUpdateExtractedHeader("invoiceDate", e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-black outline-none"
                    />
                  </div>
                </div>

                {/* Line Items Table (Editable & Dynamic) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">
                      Bill Items ({(extractedBillData.items || []).length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddExtractedItem}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white hover:bg-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      <Plus size={12} />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="border border-neutral-200 rounded-2xl overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-neutral-50 text-[10px] uppercase font-black text-neutral-500 border-b border-neutral-200 sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 pl-3">Item Description</th>
                          <th className="p-2.5 w-24">HSN</th>
                          <th className="p-2.5 w-20 text-center">Qty</th>
                          <th className="p-2.5 w-20 text-center">Unit</th>
                          <th className="p-2.5 w-28 text-right">Rate (₹)</th>
                          <th className="p-2.5 w-20 text-center">GST %</th>
                          <th className="p-2.5 w-28 text-right">Total (₹)</th>
                          <th className="p-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-bold">
                        {(extractedBillData.items || []).map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-neutral-50/60 transition-colors">
                            <td className="p-2 pl-3">
                              <input
                                type="text"
                                value={item.description || item.name || ""}
                                onChange={(e) => handleUpdateExtractedItem(idx, "description", e.target.value)}
                                placeholder="Item name"
                                className="w-full px-2 py-1.5 bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 outline-none"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.hsn || ""}
                                onChange={(e) => handleUpdateExtractedItem(idx, "hsn", e.target.value)}
                                placeholder="HSN"
                                className="w-full px-2 py-1.5 bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg text-xs font-mono text-neutral-700 outline-none"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity ?? 1}
                                onChange={(e) => handleUpdateExtractedItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 text-center bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 outline-none"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="text"
                                value={item.unit || "pcs"}
                                onChange={(e) => handleUpdateExtractedItem(idx, "unit", e.target.value)}
                                placeholder="pcs"
                                className="w-full px-2 py-1.5 text-center bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg text-xs text-neutral-600 outline-none uppercase"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.rate ?? item.price ?? 0}
                                onChange={(e) => handleUpdateExtractedItem(idx, "rate", parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 text-right bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 outline-none"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.gstPercent ?? 0}
                                onChange={(e) => handleUpdateExtractedItem(idx, "gstPercent", parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 text-center bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg text-xs text-neutral-700 outline-none"
                              />
                            </td>
                            <td className="p-2 text-right font-black text-neutral-900">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.amount !== undefined ? item.amount : ((Number(item.quantity) || 1) * (Number(item.rate ?? item.price ?? 0)))}
                                onChange={(e) => handleUpdateExtractedItem(idx, "amount", parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 text-right bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg text-xs font-black text-neutral-900 outline-none"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveExtractedItem(idx)}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Remove item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Auto-Add to Item Section Checkbox & Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-1">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoIncrementStock}
                        onChange={(e) => setAutoIncrementStock(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-xs font-black text-emerald-950 block">
                          Auto-add all items to Item Section (Inventory)
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 block leading-tight mt-0.5">
                          New items will be automatically created in your Item Section with purchase price and stock. Existing items will have stock incremented!
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-2xl flex items-center justify-between text-xs font-bold text-neutral-600">
                    <div className="space-y-0.5">
                      <span>Total Line Items: <strong className="text-neutral-900">{(extractedBillData.items || []).length}</strong></span>
                      {extractedBillData.taxableAmount ? (
                        <div className="text-[11px] text-neutral-500">Taxable: ₹{Number(extractedBillData.taxableAmount).toLocaleString()}</div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">Total Bill Amount</span>
                      <span className="text-xl font-black text-neutral-900">
                        ₹{Number(extractedBillData.totalAmount || (extractedBillData.items || []).reduce((sum: number, it: any) => sum + (Number(it.amount) || ((Number(it.quantity) || 1) * (Number(it.rate || it.price) || 0))), 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBillVerifyModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmExtractedBill}
                    disabled={isSubmitting || !(extractedBillData.items && extractedBillData.items.length > 0)}
                    className="flex-2 py-3.5 bg-neutral-900 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving & Adding Items...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Confirm & Save Purchase ({(extractedBillData.items || []).length} Items)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Purchase Details Modal (For viewing saved purchases with all items) */}
      <AnimatePresence>
        {selectedPurchaseForView && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPurchaseForView(null)}
              className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-[75]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-3xl z-[80] max-h-[90vh] flex flex-col"
            >
              <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-7 border border-neutral-100 overflow-y-auto max-h-[90vh] space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold">
                      <Package size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">
                        Purchase Bill Details
                      </h3>
                      <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        {selectedPurchaseForView.bill_number ? `Bill #${selectedPurchaseForView.bill_number}` : 'Purchase Record'} • {format(new Date(selectedPurchaseForView.date), "dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPurchaseForView(null)}
                    className="p-2 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Metadata Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">Supplier</span>
                    <span className="text-xs font-black text-neutral-900 block truncate">{selectedPurchaseForView.supplier_name || "Vendor"}</span>
                    {selectedPurchaseForView.supplier_gstin && (
                      <span className="text-[10px] font-mono text-neutral-500 block">GSTIN: {selectedPurchaseForView.supplier_gstin}</span>
                    )}
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">Bill No & Date</span>
                    <span className="text-xs font-black text-neutral-900 block">{selectedPurchaseForView.bill_number || "N/A"}</span>
                    <span className="text-[10px] font-bold text-neutral-500 block">{format(new Date(selectedPurchaseForView.date), "dd MMM yyyy")}</span>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">Payment Method</span>
                    <span className="text-xs font-black text-neutral-900 block">{selectedPurchaseForView.payment_method || "Cash"}</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-0.5",
                      (selectedPurchaseForView.status || "Paid") === "Paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {selectedPurchaseForView.status || "Paid"}
                    </span>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">Total Amount</span>
                    <span className="text-sm font-black text-neutral-900 block">{formatCurrency(selectedPurchaseForView.amount, "INR")}</span>
                    <span className="text-[10px] font-bold text-neutral-500 block">
                      {Array.isArray(selectedPurchaseForView.items) ? `${selectedPurchaseForView.items.length} Items` : '1 Item'}
                    </span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-2">
                    Line Items Breakdown
                  </span>
                  {Array.isArray(selectedPurchaseForView.items) && selectedPurchaseForView.items.length > 0 ? (
                    <div className="border border-neutral-100 rounded-2xl overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead className="bg-neutral-50 text-[10px] uppercase font-black text-neutral-500 border-b border-neutral-100 sticky top-0">
                          <tr>
                            <th className="p-2.5 pl-3">#</th>
                            <th className="p-2.5">Item Name</th>
                            <th className="p-2.5 text-center">HSN</th>
                            <th className="p-2.5 text-center">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-center">GST %</th>
                            <th className="p-2.5 text-right pr-3">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-bold">
                          {selectedPurchaseForView.items.map((it: any, idx: number) => (
                            <tr key={idx} className="hover:bg-neutral-50/50">
                              <td className="p-2.5 pl-3 text-neutral-400 text-xs">{idx + 1}</td>
                              <td className="p-2.5 text-neutral-900">
                                <span>{it.name || it.description}</span>
                                {it.barcode && <span className="block text-[9px] font-mono text-neutral-400">Barcode: {it.barcode}</span>}
                              </td>
                              <td className="p-2.5 text-center text-neutral-500 font-mono text-xs">{it.hsn || '-'}</td>
                              <td className="p-2.5 text-center text-neutral-700">{it.quantity || it.qty || 1} {it.unit || ''}</td>
                              <td className="p-2.5 text-right text-neutral-700">{formatCurrency(it.rate || it.price || it.cost_price || 0, "INR")}</td>
                              <td className="p-2.5 text-center text-neutral-600">{it.gstPercent || it.gst_percent ? `${it.gstPercent || it.gst_percent}%` : '-'}</td>
                              <td className="p-2.5 pr-3 text-right text-neutral-900">{formatCurrency(it.amount || ((it.quantity || it.qty || 1) * (it.rate || it.price || 0)), "INR")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs font-bold text-neutral-600">
                      {selectedPurchaseForView.description || "General Purchase Bill"}
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 text-neutral-600 font-bold">
                    {selectedPurchaseForView.taxable_amount ? (
                      <div>Taxable Value: <span className="font-mono text-neutral-900">{formatCurrency(selectedPurchaseForView.taxable_amount, "INR")}</span></div>
                    ) : null}
                    {selectedPurchaseForView.tax_amount ? (
                      <div>Total Tax (GST): <span className="font-mono text-neutral-900">{formatCurrency(selectedPurchaseForView.tax_amount, "INR")}</span></div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">Net Grand Total</span>
                    <span className="text-xl font-black text-neutral-900">{formatCurrency(selectedPurchaseForView.amount, "INR")}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setSelectedPurchaseForView(null)}
                    className="px-6 py-3 bg-neutral-900 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-md hover:bg-black transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
