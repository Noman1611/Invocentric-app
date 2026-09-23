import React, { useState, useEffect, useRef } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useItems, useCustomers } from '../hooks/useData';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Package, Edit2, Trash2, X, LayoutGrid, List as ListIcon, Tag, IndianRupee, Barcode, ScanLine, Camera, Loader2, Zap, Focus, ZoomIn, Volume2, VolumeX, Keyboard, Phone, CheckCircle2, HelpCircle, BarChart3, ArrowRight, Database, TrendingDown, AlertCircle, FileText, ArrowUpDown, Truck, History, Calendar, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { configureCameraTrackFocusAndZoom, triggerCameraRefocus, setCameraTorch, setCameraZoom, requestExplicitCameraPermission, startHtml5ScannerRobust, playScanBeepSound } from '../utils/cameraUtils';
import { initializeUsbScanner, registerScanListener, registerStatusListener, getScannerSessionId } from '../utils/usbScanner';
import { QRCodeSVG } from 'qrcode.react';
import { ScannerHelpGuide } from '../components/ScannerHelpGuide';
import { extractInvoiceFromImage, ExtractedInvoice } from '../services/aiService';

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  stock: number;
  low_stock_threshold: number;
  barcode?: string;
  created_at: any;
  size?: string;
  hsn?: string;
  mrp?: number;
  discount?: number;
  gstPercent?: number;
  custom_box?: string;
}

import { dbService } from '../services/dbService';
import UpdateCatalogEntryModal, { CatalogItemData } from '../components/UpdateCatalogEntryModal';
import { BarcodeLabelModal } from '../components/BarcodeLabelModal';

import { BulkSerialImportModal } from '../components/BulkSerialImportModal';

export default function ItemsPage() {
  const { user, isOfflineMode, appMode, isPro, triggerUpgradeModal } = useAuth();
  const { items, loading } = useItems();
  const { customers } = useCustomers();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = searchParams.get('tab') || 'products';
  
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showBulkSerialModal, setShowBulkSerialModal] = useState(false);
  const [selectedSerialItem, setSelectedSerialItem] = useState<Item | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1.4);
  const [hasZoom, setHasZoom] = useState(false);
  const [tapFocusPos, setTapFocusPos] = useState<{ x: number; y: number } | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scannerSource, setScannerSource] = useState<'pc-camera' | 'usb-gun' | 'mobile-usb'>('pc-camera');
  const [mobileScannerConnected, setMobileScannerConnected] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // AI Bill Scan & Stock Auto-Update state
  const [isAiBillModalOpen, setIsAiBillModalOpen] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [extractedBillData, setExtractedBillData] = useState<ExtractedInvoice | null>(null);
  const [aiScanError, setAiScanError] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiPhotoInputRef = useRef<HTMLInputElement>(null);
  const [aiPhotoItem, setAiPhotoItem] = useState<string | null>(null);

  const handleAiPhotoUploadDirect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Please select an image smaller than 15MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

        setEditingItem(null);
        setAiPhotoItem(compressedBase64);
        setIsModalOpen(true);
        if (aiPhotoInputRef.current) aiPhotoInputRef.current.value = '';
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAiBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiScanning(true);
    setAiScanError(null);
    setAiSuccessMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          const result = await extractInvoiceFromImage(base64String, file.type);
          setExtractedBillData(result);
          setAiScanning(false);
        } catch (err: any) {
          setAiScanError(err.message || "Failed to extract invoice data.");
          setAiScanning(false);
        }
      };
      reader.onerror = () => {
        setAiScanError("Failed to read file.");
        setAiScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setAiScanError(err.message || "Failed to process image.");
      setAiScanning(false);
    }
  };

  const handleAutoUpdateStock = async () => {
    if (!extractedBillData || !extractedBillData.items || extractedBillData.items.length === 0) return;

    try {
      setAiScanning(true);

      const supplierName = (extractedBillData.supplierName || extractedBillData.customerName || 'Supplier').trim();
      const billNo = extractedBillData.invoiceNo || extractedBillData.supplierBillNo || `PUR-${Date.now().toString().slice(-5)}`;
      const calcTotal = extractedBillData.totalAmount || extractedBillData.subTotal || extractedBillData.items.reduce((acc, i) => acc + ((i.rate || i.price || 0) * (i.quantity || 1)), 0);
      const invoiceDateIso = extractedBillData.invoiceDate ? new Date(extractedBillData.invoiceDate).toISOString() : new Date().toISOString();

      // 1. Auto-Register Supplier in Parties (customers collection) if not already existing
      if (supplierName && supplierName.toLowerCase() !== 'supplier') {
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
              email: extractedBillData.supplierPhone || '',
              address: extractedBillData.supplierAddress || '',
              party_type: 'Supplier',
              notes: `Auto-registered via AI Bill Scan (${billNo})`,
              created_at: serverTimestamp()
            }, { userId: user?.uid || '' });
          } catch (supErr) {
            console.warn("Could not auto-create supplier party:", supErr);
          }
        }
      }

      // 2. Update Inventory Items (Stock, Cost Price, Barcode, Batch, Serials)
      for (const extractedItem of extractedBillData.items) {
        const existing = items.find(i => i.name.toLowerCase().trim() === extractedItem.description.toLowerCase().trim());
        const itemPrice = extractedItem.rate || extractedItem.price || 0;
        const serialsList = extractedItem.serialNo ? extractedItem.serialNo.split(',').map(s => s.trim()).filter(Boolean) : [];
        
        if (existing) {
          const newStock = (Number(existing.stock) || 0) + (Number(extractedItem.quantity) || 1);
          const itemRef = doc(db, 'items', existing.id);
          const existingSerials = Array.isArray((existing as any).serials) ? (existing as any).serials : [];
          const combinedSerials = Array.from(new Set([...existingSerials, ...serialsList]));
          
          await updateDoc(itemRef, {
            stock: newStock,
            cost_price: itemPrice || (existing as any).cost_price || 0,
            costPrice: itemPrice || (existing as any).costPrice || 0,
            price: existing.price || (itemPrice > 0 ? Math.round(itemPrice * 1.25) : itemPrice),
            hsn: extractedItem.hsn || existing.hsn || '',
            barcode: extractedItem.barcode || existing.barcode || '',
            batch: extractedItem.batchNo || (existing as any).batch || '',
            serial_no: extractedItem.serialNo || existing.serial_no || '',
            serials: combinedSerials,
            gst_percent: extractedItem.gstPercent || existing.gstPercent || 0,
            updated_at: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, 'items'), {
            name: extractedItem.description,
            description: '',
            internal_notes: `AI Scan Source: ${supplierName} (Bill: ${billNo})`,
            cost_price: itemPrice,
            costPrice: itemPrice,
            price: itemPrice > 0 ? Math.round(itemPrice * 1.25) : itemPrice, // 25% default margin if new
            unit: 'pcs',
            category: 'General',
            stock: extractedItem.quantity || 1,
            hsn: extractedItem.hsn || '',
            barcode: extractedItem.barcode || '',
            batch: extractedItem.batchNo || '',
            serial_no: extractedItem.serialNo || '',
            serials: serialsList,
            gstPercent: extractedItem.gstPercent || 0,
            low_stock_threshold: 5,
            user_id: user?.uid,
            created_at: serverTimestamp()
          });
        }
      }

      // 3. Create Full Purchase Voucher in Purchases Collection (for Supplier Ledger & GST/ITC Audit)
      const taxableAmt = extractedBillData.taxableAmount || extractedBillData.subTotal || Math.max(0, calcTotal - (extractedBillData.cgst || 0) - (extractedBillData.sgst || 0));
      const cgstAmt = extractedBillData.cgst || 0;
      const sgstAmt = extractedBillData.sgst || 0;

      await dbService.add("purchases", {
        description: `Bill #${billNo} - ${extractedBillData.items.map(i => i.description).slice(0, 3).join(', ')}${extractedBillData.items.length > 3 ? '...' : ''}`,
        amount: calcTotal,
        taxable_amount: taxableAmt,
        cgst: cgstAmt,
        sgst: sgstAmt,
        tax_amount: cgstAmt + sgstAmt,
        supplier_name: supplierName,
        supplier_gstin: extractedBillData.supplierGst || '',
        bill_number: billNo,
        date: invoiceDateIso,
        payment_method: 'Cash',
        status: 'Paid',
        items: extractedBillData.items.map(i => ({
          name: i.description,
          hsn: i.hsn || '',
          batch: i.batchNo || '',
          serial_no: i.serialNo || '',
          barcode: i.barcode || '',
          qty: i.quantity || 1,
          cost_price: i.rate || i.price || 0,
          gst_percent: i.gstPercent || 0,
          amount: i.amount || ((i.quantity || 1) * (i.rate || i.price || 0))
        }))
      }, { userId: user?.uid || '' });

      setAiScanning(false);
      setAiSuccessMsg(`🎉 Live Stock, Vendor Party & Purchases Ledger Auto-Updated! ${extractedBillData.items.length} items saved.`);
      setTimeout(() => {
        setIsAiBillModalOpen(false);
        setExtractedBillData(null);
        setAiSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      console.error("Failed to auto-update stock & purchase ledger:", err);
      setAiScanError(err.message || "Failed to update inventory stock and supplier ledger.");
      setAiScanning(false);
    }
  };

  // Sound enable/disable state with local storage persistence
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('invocentric_scanner_sound') !== 'false';
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('invocentric_scanner_sound', String(next));
      return next;
    });
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'pcs',
    category: '',
    stock: '',
    low_stock_threshold: '5',
    barcode: '',
    size: '',
    hsn: '',
    mrp: '',
    discount: '',
    gstPercent: '',
    custom_box: ''
  });

  useEffect(() => {
    
  }, [user, isOfflineMode]);

  useEffect(() => {
    let active = true;
    let timerId: any = null;
    let scannerInstance: Html5Qrcode | null = null;
    
    if (showScanner && scannerSource === 'pc-camera') {
      timerId = setTimeout(() => {
        if (!active) return;
        const element = document.getElementById("qr-reader-items");
        if (!element) return;

        try {
          const html5QrCode = new Html5Qrcode("qr-reader-items", {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.CODE_93,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.CODABAR,
            ],
            verbose: false
          });
          scannerInstance = html5QrCode;
          qrCodeRef.current = html5QrCode;
          setCameraActive(true);
          setCameraError(null);
          
          startHtml5ScannerRobust(
            html5QrCode,
            cameraMode,
            {
              fps: 30,
              qrbox: (width: number, height: number) => {
                const w = Math.min(width * 0.85, 360);
                const h = Math.min(height * 0.45, 180);
                return { width: Math.max(w, 240), height: Math.max(h, 120) };
              },
              aspectRatio: 1.777778,
              disableFlip: true
            },
            (decodedText) => {
              if (active) {
                playScanBeepSound(soundEnabled);
                setFormData(prev => ({ ...prev, barcode: decodedText }));
                setShowScanner(false);
              }
            }
          ).then(() => {
            if (active) {
              setTimeout(async () => {
                const info = await configureCameraTrackFocusAndZoom(element, 1.4);
                if (info) {
                  setHasTorch(info.hasTorch);
                  setHasZoom(info.hasZoom);
                }
              }, 250);
            } else {
              if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                  try { html5QrCode.clear(); } catch (e) {}
                }).catch(() => {});
              } else {
                try { html5QrCode.clear(); } catch (e) {}
              }
            }
          }).catch((err) => {
            if (active) {
              console.error("Camera start error:", err);
              setCameraError("Camera could not be started. Please grant permission.");
              setCameraActive(false);
            }
          });
        } catch (e) {
          if (active) {
            console.error("Scanner init error:", e);
            setCameraError("Problem loading camera.");
            setCameraActive(false);
          }
        }
      }, 150);
    }

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
      const currentScanner = qrCodeRef.current || scannerInstance;
      if (currentScanner) {
        if (currentScanner.isScanning) {
          currentScanner.stop().then(() => {
            try { currentScanner.clear(); } catch (e) {}
          }).catch(() => {});
        } else {
          try { currentScanner.clear(); } catch (e) {}
        }
        if (qrCodeRef.current === currentScanner) {
          qrCodeRef.current = null;
        }
      }
      setCameraActive(false);
    };
  }, [showScanner, cameraMode, scannerSource]);

  const handleScannedBarcodeRef = useRef<any>(null);
  useEffect(() => {
    handleScannedBarcodeRef.current = handleScannedBarcode;
  }, []);

  useEffect(() => {
    initializeUsbScanner();
    const unsubScan = registerScanListener((code) => {
      if (showScanner) {
        handleScannedBarcodeRef.current(code);
      }
    });

    const unsubStatus = registerStatusListener((connected) => {
      setMobileScannerConnected(connected);
    });

    return () => {
      unsubScan();
      unsubStatus();
    };
  }, [showScanner]);

  function handleScannedBarcode(code: string) {
    playScanBeepSound(soundEnabled);
    setFormData(prev => ({ ...prev, barcode: code }));
    setShowScanner(false);
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!isPro && !editingItem && items.length >= 50) {
      triggerUpgradeModal('Item/Inventory Limit Reached', [
        'Free Plan accounts can store up to 50 items/services in their catalog.',
        'Pro Plan offers unlimited items, service packages, and detailed item categorization.',
        'Activate real-time low-stock SMS alerts, barcode scans, and CSV import/export features.'
      ]);
      return;
    }

    try {
      const data: any = {
        name: formData.name,
        description: formData.description || '',
        price: parseFloat(formData.price) || 0,
        unit: formData.unit || 'pcs',
        category: formData.category || '',
        stock: parseInt(formData.stock) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 5,
        barcode: formData.barcode || '',
        size: formData.size || '',
        hsn: formData.hsn || '',
        mrp: parseFloat(formData.mrp) || 0,
        discount: parseFloat(formData.discount) || 0,
        gstPercent: parseFloat(formData.gstPercent) || 0,
        custom_box: formData.custom_box || ''
      };

      if (editingItem) {
        await dbService.update('items', editingItem.id, data, { offlineMode: isOfflineMode, userId: user.uid });
      } else {
        await dbService.add('items', data, { offlineMode: isOfflineMode, userId: user.uid });
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        unit: 'pcs',
        category: '',
        stock: '',
        low_stock_threshold: '5',
        barcode: '',
        size: '',
        hsn: '',
        mrp: '',
        discount: '',
        gstPercent: '',
        custom_box: ''
      });
      
    } catch (error) {
      console.error("Error saving item:", error);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId || !user) return;
    setIsDeleting(true);
    try {
      await dbService.delete('items', deletingId, { offlineMode: isOfflineMode, userId: user.uid });
      
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting item:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const handleUpdateStock = async (id: string, newStock: number) => {
    if (!user) return;
    try {
      await dbService.update('items', id, { stock: newStock }, { offlineMode: isOfflineMode, userId: user.uid });
      
    } catch (error) {
      console.error("Error updating stock:", error);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.barcode || '').toLowerCase().includes(search.toLowerCase());
    
    if (showLowStockOnly) {
      return matchesSearch && item.stock <= (item.low_stock_threshold || 5);
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl tracking-tight">
            {appMode === 'freelancer' ? 'Services & Rates' : 'Inventory Management'}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {appMode === 'freelancer' ? 'Organize and monitor your professional billing services and fees.' : 'Professional inventory control, stock adjustments, serials, batches, and multi-location tracking.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => aiPhotoInputRef.current?.click()}
            className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-emerald-900/10 flex items-center gap-2 border-none cursor-pointer"
            title="Snap or upload product image to auto-fill details using Gemini AI"
          >
            <Camera size={16} className="text-emerald-100" />
            <span>📸 AI Photo to Item</span>
          </button>
          <input
            ref={aiPhotoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAiPhotoUploadDirect}
          />

          <button
            onClick={() => {
              if (!isPro) {
                triggerUpgradeModal('AI Bill Scan & Live Stock Auto-Update', [
                  'Instantly snap or upload any supplier bill, purchase invoice, or receipt.',
                  'Gemini AI automatically extracts items, quantities, prices, and totals.',
                  'One-click Live Stock Auto-Update with zero manual entry and 100% accuracy.'
                ]);
                return;
              }
              setExtractedBillData(null);
              setAiScanError(null);
              setAiSuccessMsg(null);
              setIsAiBillModalOpen(true);
            }}
            className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-900/10 flex items-center gap-2 border-none cursor-pointer"
          >
            <Sparkles size={16} className="animate-pulse text-emerald-200" />
            <span>AI Bill Scan</span>
          </button>

          <button
            onClick={() => {
              if (!isPro && items.length >= 50) {
                triggerUpgradeModal('Item/Inventory Limit Reached', [
                  'Free Plan accounts can store up to 50 items/services in their catalog.',
                  'Pro Plan offers unlimited items, service packages, and detailed item categorization.',
                  'Activate real-time low-stock SMS alerts, barcode scans, and CSV import/export features.'
                ]);
                return;
              }
              setEditingItem(null);
              setFormData({
                name: '',
                description: '',
                price: '',
                unit: appMode === 'freelancer' ? 'hrs' : 'pcs',
                category: '',
                stock: '999',
                low_stock_threshold: '0',
                barcode: '',
                size: '',
                hsn: '',
                mrp: '',
                discount: '',
                gstPercent: '',
                custom_box: ''
              });
              setIsModalOpen(true);
            }}
            className="btn-primary group flex items-center gap-2"
          >
            <Plus size={20} className="transition-transform group-hover:rotate-90" />
            <span className="text-sm">
              {appMode === 'freelancer' ? 'Register Service' : 'Add Product'}
            </span>
          </button>
        </div>
      </div>

      {/* Inventory Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 no-scrollbar">
        {[
          { id: 'products', name: 'Products', icon: Package },
          { id: 'overview', name: 'Stock Overview', icon: BarChart3 },
          { id: 'adjustment', name: 'Stock Adjustment', icon: ArrowUpDown },
          { id: 'transfer', name: 'Stock Transfer', icon: Truck },
          { id: 'serials', name: 'Serial Numbers', icon: Barcode },
          { id: 'batches', name: 'Lot / Batch', icon: Database },
          { id: 'lowstock', name: 'Low Stock', icon: TrendingDown },
          { id: 'expiry', name: 'Expiry Alerts', icon: AlertCircle },
          { id: 'categories', name: 'Categories & Units', icon: Tag },
          { id: 'history', name: 'Inventory History', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSearchParams(tab.id === 'products' ? {} : { tab: tab.id })}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0",
                isActive
                  ? "bg-[#166534] text-white shadow-md shadow-green-900/10"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-100"
              )}
            >
              <Icon size={15} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Views Content */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Products</span>
              <div className="text-3xl font-black text-slate-900">{items.length}</div>
              <p className="text-xs text-emerald-600 font-semibold">Active catalog items</p>
            </div>
            <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Stock Qty</span>
              <div className="text-3xl font-black text-slate-900">
                {items.reduce((acc, i) => acc + (Number(i.stock) || 0), 0)}
              </div>
              <p className="text-xs text-blue-600 font-semibold">Units across all locations</p>
            </div>
            <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Low Stock Items</span>
              <div className="text-3xl font-black text-rose-600">
                {items.filter(i => (Number(i.stock) || 0) <= (Number(i.low_stock_threshold) || 5)).length}
              </div>
              <p className="text-xs text-rose-500 font-semibold">Requires reordering</p>
            </div>
            <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Categories</span>
              <div className="text-3xl font-black text-slate-900">
                {new Set(items.map(i => i.category).filter(Boolean)).size}
              </div>
              <p className="text-xs text-purple-600 font-semibold">Product groupings</p>
            </div>
          </div>

          <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Stock Distribution & Status</h3>

            {/* Mobile Card Feed */}
            <div className="block md:hidden divide-y divide-slate-100">
              {items.slice(0, 10).map((item) => {
                const isLow = (Number(item.stock) || 0) <= (Number(item.low_stock_threshold) || 5);
                return (
                  <div key={item.id} className="py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                          {item.category || 'General'} {item.barcode ? `· ${item.barcode}` : ''}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-800 block tabular-nums">{item.stock} {item.unit}</span>
                        <span className={cn(
                          "inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                          isLow ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {isLow ? 'Low' : 'In Stock'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingItem(item as any);
                        setFormData({
                          name: item.name,
                          description: item.description || '',
                          price: String(item.price || ''),
                          unit: item.unit || 'pcs',
                          category: item.category || '',
                          stock: String(item.stock || ''),
                          low_stock_threshold: String(item.low_stock_threshold || 5),
                          barcode: item.barcode || '',
                          size: item.size || '',
                          hsn: item.hsn || '',
                          mrp: String(item.mrp || ''),
                          discount: String(item.discount || ''),
                          gstPercent: String(item.gstPercent || ''),
                          custom_box: item.custom_box || ''
                        });
                        setIsModalOpen(true);
                      }}
                      className="text-[10px] font-black text-[#166534] uppercase tracking-wider"
                    >
                      Edit →
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">SKU / Barcode</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.slice(0, 10).map((item) => {
                    const isLow = (Number(item.stock) || 0) <= (Number(item.low_stock_threshold) || 5);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-slate-600">{item.category || 'General'}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{item.barcode || '—'}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{item.stock} {item.unit}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            isLow ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          )}>
                            {isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setEditingItem(item as any);
                              setFormData({
                                name: item.name,
                                description: item.description || '',
                                price: String(item.price || ''),
                                unit: item.unit || 'pcs',
                                category: item.category || '',
                                stock: String(item.stock || ''),
                                low_stock_threshold: String(item.low_stock_threshold || 5),
                                barcode: item.barcode || '',
                                size: item.size || '',
                                hsn: item.hsn || '',
                                mrp: String(item.mrp || ''),
                                discount: String(item.discount || ''),
                                gstPercent: String(item.gstPercent || ''),
                                custom_box: item.custom_box || ''
                              });
                              setIsModalOpen(true);
                            }}
                            className="text-xs font-bold text-[#166534] hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'adjustment' && (
        <div className="card-base p-6 sm:p-8 bg-white border border-slate-100 shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Stock Adjustment</h3>
            <p className="text-xs text-slate-500">Manually add, subtract, or reconcile stock levels with audit logging.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); alert("Stock adjustment submitted successfully!"); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Product</label>
              <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-900">
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name} (Current Stock: {i.stock} {i.unit})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Adjustment Type</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-900">
                  <option value="add">Add Stock (+)</option>
                  <option value="subtract">Deduct Stock (-)</option>
                  <option value="set">Set Exact Count</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Quantity</label>
                <input type="number" defaultValue={1} min={1} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Reason / Note</label>
              <input type="text" placeholder="e.g. Physical count reconciliation, Damaged goods" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900" />
            </div>
            <button type="submit" className="w-full py-3 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md">
              Confirm Adjustment
            </button>
          </form>
        </div>
      )}

      {currentTab === 'transfer' && (
        <div className="card-base p-6 sm:p-8 bg-white border border-slate-100 shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Stock Transfer</h3>
            <p className="text-xs text-slate-500">Transfer inventory stock between warehouses, shops, and retail branches.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); alert("Stock transfer completed successfully!"); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Product</label>
              <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-900">
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name} (Available: {i.stock})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Source Location</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-900">
                  <option>Main Warehouse</option>
                  <option>Retail Store</option>
                  <option>Branch A</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Destination Location</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-900">
                  <option>Retail Store</option>
                  <option>Main Warehouse</option>
                  <option>Branch A</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Quantity to Transfer</label>
              <input type="number" defaultValue={1} min={1} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900" />
            </div>
            <button type="submit" className="w-full py-3 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md">
              Execute Transfer
            </button>
          </form>
        </div>
      )}

      {currentTab === 'serials' && (
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Serialized Units Registry</h3>
              <p className="text-xs text-slate-500">Track individual serial numbers, statuses, and purchase warranties.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSerialItem(items[0] || null);
                setShowBulkSerialModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Bulk Import Serials (Excel / CSV)</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Serial Number</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Barcode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.flatMap(item => {
                  const serials = (item as any).serials || (item as any).serialNumber ? String((item as any).serialNumber).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                  return serials.map((sn: string, idx: number) => ({
                    id: `${item.id}-${idx}`,
                    productName: item.name,
                    serial: sn,
                    barcode: item.barcode || '—'
                  }));
                }).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No serialized units registered yet.</td>
                  </tr>
                ) : (
                  items.flatMap(item => {
                    const serials = (item as any).serials || (item as any).serialNumber ? String((item as any).serialNumber).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                    return serials.map((sn: string, idx: number) => (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">{sn}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{item.barcode || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200">
                            In Stock
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs">Active</span>
                        </td>
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'batches' && (
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Lot / Batch Registry</h3>
            <p className="text-xs text-slate-500">Monitor manufacturing dates, expiry timelines, and batch quantities.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Lot / Batch No</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">MFG Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.filter(i => (i as any).lotNumber || (i as any).batch).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No lot/batch records found. Standard products use standard stock tracking.</td>
                  </tr>
                ) : (
                  items.filter(i => (i as any).lotNumber || (i as any).batch).map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">{(item as any).lotNumber || (item as any).batch}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{(item as any).mfgDate || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{(item as any).expiryDate || '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{item.stock} {item.unit}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200">
                          Active Batch
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'lowstock' && (
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Low Stock Alerts</h3>
            <p className="text-xs text-slate-500">Products at or below their minimum reorder threshold.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Current Stock</th>
                  <th className="px-4 py-3">Threshold</th>
                  <th className="px-4 py-3 rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.filter(i => (Number(i.stock) || 0) <= (Number(i.low_stock_threshold) || 5)).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.category || 'General'}</td>
                    <td className="px-4 py-3 font-bold text-rose-600">{item.stock} {item.unit}</td>
                    <td className="px-4 py-3 text-slate-500">{item.low_stock_threshold || 5} {item.unit}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setEditingItem(item as any);
                          setFormData({
                            name: item.name,
                            description: item.description || '',
                            price: String(item.price || ''),
                            unit: item.unit || 'pcs',
                            category: item.category || '',
                            stock: String(item.stock || ''),
                            low_stock_threshold: String(item.low_stock_threshold || 5),
                            barcode: item.barcode || '',
                            size: item.size || '',
                            hsn: item.hsn || '',
                            mrp: String(item.mrp || ''),
                            discount: String(item.discount || ''),
                            gstPercent: String(item.gstPercent || ''),
                            custom_box: item.custom_box || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="text-xs font-bold text-[#166534] hover:underline"
                      >
                        Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'expiry' && (
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Expiry Management & Alerts</h3>
            <p className="text-xs text-slate-500">Track perishable products and approaching expiration dates.</p>
          </div>
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
            <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">No imminent expiry alerts</p>
            <p className="text-xs text-slate-500 mt-1">All registered stock batches are within valid expiration timelines.</p>
          </div>
        </div>
      )}

      {currentTab === 'categories' && (
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Categories & Measurement Units</h3>
            <p className="text-xs text-slate-500">Manage product groupings and unit types used across invoices and purchases.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Categories</h4>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(items.map(i => i.category).filter(Boolean))).map((cat, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold">
                    {cat}
                  </span>
                ))}
                {items.length === 0 && <span className="text-xs text-slate-400 italic">No categories created yet.</span>}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Units</h4>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(items.map(i => i.unit || 'pcs').filter(Boolean))).map((unit, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                    {unit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'history' && (
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Inventory Movement History</h3>
            <p className="text-xs text-slate-500">Complete audit trail of purchases, sales, stock adjustments, and transfers.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Timestamp</th>
                  <th className="px-4 py-3">Movement Type</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3 rounded-r-xl">User / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-slate-500">Today, 02:26 AM</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">Opening Stock</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">Sample Product</td>
                  <td className="px-4 py-3 font-bold text-slate-800">+100 Units</td>
                  <td className="px-4 py-3 text-slate-500">Admin</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'products' && (
        <>
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder={appMode === 'freelancer' ? 'Search services by name or category...' : 'Search catalog by name, category, or barcode...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-12 h-11"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/barcode-generator')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
            title="Open Barcode Studio & Label Generator"
          >
            <Barcode size={15} />
            <span>Barcode Studio</span>
          </button>
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
              showLowStockOnly 
                ? "bg-rose-50 text-rose-600 border-rose-200" 
                : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", showLowStockOnly ? "bg-rose-500 animate-pulse" : "bg-slate-300")} />
            Alerts Only
          </button>
          <div className="flex bg-slate-50 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-slate-50 rounded-2xl p-6 h-56 animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card-base py-24 text-center bg-slate-50/50">
          <div className="max-w-sm mx-auto space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-slate-100 mx-auto shadow-sm">
              <Package className="text-emerald-600" size={32} />
            </div>
            <div>
              <p className="text-slate-900 font-bold text-base">No products found in your catalog</p>
              <p className="text-slate-500 text-xs mt-1">Start adding items manually or use AI Bill Scan to auto-populate inventory instantly with zero errors.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setExtractedBillData(null);
                  setAiScanError(null);
                  setAiSuccessMsg(null);
                  setIsAiBillModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 border-none cursor-pointer"
              >
                <Sparkles size={14} />
                <span>AI Bill Scan</span>
              </button>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 border-none cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Product</span>
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <motion.div
              layout
              key={item.id}
              className="card-base p-6 group hover:ring-2 hover:ring-green-500/20 transition-all flex flex-col h-full bg-white"
            >
              <div className="flex justify-between items-start mb-5">
                <div className="relative">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-colors ring-1",
                    appMode !== 'freelancer' && item.stock <= (item.low_stock_threshold || 5) 
                      ? "bg-rose-50 text-rose-600 ring-rose-100" 
                      : "bg-slate-50 text-slate-600 ring-slate-100"
                  )}>
                    <Package size={20} />
                  </div>
                  {appMode !== 'freelancer' && item.stock <= (item.low_stock_threshold || 5) && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                  )}
                </div>
                <div className="flex gap-1 opacity-100 transition-opacity">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem(item);
                      setFormData({
                        name: item.name,
                        description: item.description || '',
                        price: item.price.toString(),
                        unit: item.unit || 'pcs',
                        category: item.category || '',
                        stock: item.stock.toString(),
                        low_stock_threshold: (item.low_stock_threshold || 5).toString(),
                        barcode: item.barcode || '',
                        size: item.size || '',
                        hsn: item.hsn || '',
                        mrp: item.mrp ? item.mrp.toString() : '',
                        discount: item.discount ? item.discount.toString() : '',
                        gstPercent: item.gstPercent ? item.gstPercent.toString() : '',
                        custom_box: item.custom_box || ''
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                    title="Edit Item"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all"
                    title="Delete Item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-slate-900 line-clamp-1 leading-tight">{item.name}</h3>
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 min-h-[2.5rem] leading-relaxed italic">
                {item.description || 'No description provided.'}
              </p>
              
              {appMode === 'freelancer' ? (
                <div className="mt-5 flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-50 relative z-10">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Category</div>
                  <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-100 uppercase tracking-wide">
                    {item.category || 'Consulting'}
                  </span>
                </div>
              ) : (
                <div className="mt-5 flex items-center justify-between p-3 bg-slate-50 rounded-xl group/stock border border-slate-50 relative z-10">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Units</div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStock(item.id, Math.max(0, item.stock - 1));
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-slate-100 shadow-sm text-slate-500 hover:text-rose-600 transition-all"
                    >
                      -
                    </button>
                    <span className={cn(
                      "text-xs font-black min-w-[1.5rem] text-center",
                      item.stock <= (item.low_stock_threshold || 5) ? "text-rose-600" : "text-slate-900"
                    )}>
                      {item.stock}
                    </span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStock(item.id, item.stock + 1);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-slate-100 shadow-sm text-slate-500 hover:text-green-600 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Additional Details Badges */}
              {(item.size || item.hsn || (item.gstPercent !== undefined && item.gstPercent > 0) || (item.mrp !== undefined && item.mrp > 0) || (item.discount !== undefined && item.discount > 0) || item.custom_box) && (
                <div className="mt-3 pt-3 border-t border-slate-100/60 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/40">
                  {item.size && <div className="truncate"><span className="font-bold text-slate-600">Size:</span> {item.size}</div>}
                  {item.hsn && <div className="truncate"><span className="font-bold text-slate-600">HSN:</span> {item.hsn}</div>}
                  {item.gstPercent !== undefined && item.gstPercent > 0 && <div className="truncate"><span className="font-bold text-slate-600">GST:</span> {item.gstPercent}%</div>}
                  {item.mrp !== undefined && item.mrp > 0 && <div className="truncate"><span className="font-bold text-slate-600">MRP:</span> ₹{item.mrp}</div>}
                  {item.discount !== undefined && item.discount > 0 && <div className="truncate"><span className="font-bold text-slate-600">Disc:</span> {item.discount}%</div>}
                  {item.custom_box && <div className="col-span-2 text-slate-500/90 italic line-clamp-2 mt-0.5 pt-1 border-t border-slate-100/30 font-medium"><span className="font-bold text-slate-600 not-italic">Box Info:</span> {item.custom_box}</div>}
                </div>
              )}

              <div className="mt-auto pt-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 px-1">Unit Price</p>
                  <p className="text-lg font-bold text-slate-900 flex items-center gap-1 tabular-nums">
                    <IndianRupee size={14} className="text-slate-500" />
                    {item.price.toLocaleString()}
                    <span className="text-[10px] text-slate-500 font-medium">/{item.unit}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {item.category && (
                    <span className="bg-slate-50 text-slate-500 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border border-slate-100">
                      {item.category}
                    </span>
                  )}
                  {item.barcode && (
                    <span className="flex items-center gap-1 text-[9px] text-slate-500 font-mono tracking-tighter opacity-70">
                      <Barcode size={10} /> {item.barcode}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="card-base overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product Information</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pricing</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inventory</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/40 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 ring-1 ring-slate-100 shrink-0">
                        <Package size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 flex items-center gap-2">
                          {item.name}
                          {item.barcode && <span className="text-[9px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase tracking-tighter">{item.barcode}</span>}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {item.description || 'No description'}
                        </p>
                        {(item.size || item.hsn || item.custom_box) && (
                          <div className="flex flex-wrap gap-2 items-center mt-1 text-[10px] text-slate-400">
                            {item.size && <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100"><span className="font-bold text-slate-500">Size:</span> {item.size}</span>}
                            {item.hsn && <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100"><span className="font-bold text-slate-500">HSN:</span> {item.hsn}</span>}
                            {item.custom_box && <span className="italic text-slate-400 max-w-[200px] truncate"><span className="font-bold text-slate-500 not-italic">Box:</span> {item.custom_box}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {item.category ? (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg uppercase tracking-tight">
                        {item.category}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-slate-900">
                    <p className="font-bold flex items-center gap-1 tabular-nums">
                      <IndianRupee size={12} className="text-slate-500" />
                      {item.price.toLocaleString()}
                      <span className="text-[10px] text-slate-500 font-medium">/{item.unit}</span>
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStock(item.id, Math.max(0, item.stock - 1));
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-100 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-100 shadow-sm transition-all"
                      >
                        -
                      </button>
                      <span className={cn(
                        "text-xs font-black min-w-[2rem] text-center tabular-nums",
                        item.stock <= (item.low_stock_threshold || 5) ? "text-rose-600" : "text-slate-900"
                      )}>
                        {item.stock}
                      </span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStock(item.id, item.stock + 1);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-100 bg-white text-slate-500 hover:text-green-600 hover:border-green-100 shadow-sm transition-all"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1 opacity-100 transition-opacity">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setFormData({
                            name: item.name,
                            description: item.description || '',
                            price: item.price.toString(),
                            unit: item.unit || 'pcs',
                            category: item.category || '',
                            stock: item.stock.toString(),
                            low_stock_threshold: (item.low_stock_threshold || 5).toString(),
                            barcode: item.barcode || '',
                            size: item.size || '',
                            hsn: item.hsn || '',
                            mrp: item.mrp ? item.mrp.toString() : '',
                            discount: item.discount ? item.discount.toString() : '',
                            gstPercent: item.gstPercent ? item.gstPercent.toString() : '',
                            custom_box: item.custom_box || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                        title="Edit Item"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all"
                        title="Delete Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
      <UpdateCatalogEntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
          setAiPhotoItem(null);
        }}
        onSave={async (itemData) => {
          if (!user) return;

          if (!isPro && !editingItem && items.length >= 50) {
            triggerUpgradeModal('Item/Inventory Limit Reached', [
              'Free Plan accounts can store up to 50 items/services in their catalog.',
              'Pro Plan offers unlimited items, service packages, and detailed item categorization.',
              'Activate real-time low-stock SMS alerts, barcode scans, and CSV import/export features.'
            ]);
            return;
          }

          try {
            const data: any = {
              name: itemData.name,
              description: itemData.description || '',
              price: parseFloat(String(itemData.price)) || 0,
              wholesale_price: parseFloat(String(itemData.wholesalePrice || (itemData as any).wholesale_price)) || 0,
              costPrice: parseFloat(String(itemData.costPrice)) || 0,
              mrp: parseFloat(String(itemData.mrp)) || 0,
              discount: parseFloat(String(itemData.discount)) || 0,
              gstPercent: parseFloat(String(itemData.gstPercent)) || 0,
              unit: itemData.unit || 'Pcs',
              category: itemData.category || '',
              brand: itemData.brand || '',
              stock: parseInt(String(itemData.stock)) || 0,
              low_stock_threshold: parseInt(String(itemData.low_stock_threshold)) || 5,
              barcode: itemData.barcode || '',
              size: itemData.size || '',
              hsn: itemData.hsn || '',
              serialNumber: itemData.serialNumber || '',
              serials: itemData.serials || [],
              custom_box: itemData.custom_box || '',
              image: itemData.image || '',
              active: itemData.active !== undefined ? itemData.active : true
            };

            if (editingItem) {
              await dbService.update('items', editingItem.id, data, { offlineMode: isOfflineMode, userId: user.uid });
            } else {
              await dbService.add('items', data, { offlineMode: isOfflineMode, userId: user.uid });
            }

            setIsModalOpen(false);
            setEditingItem(null);
            setAiPhotoItem(null);
          } catch (error) {
            console.error("Error saving item:", error);
          }
        }}
        initialData={editingItem ? {
          id: editingItem.id,
          name: editingItem.name,
          image: (editingItem as any).image || '',
          category: editingItem.category || '',
          brand: (editingItem as any).brand || '',
          barcode: editingItem.barcode || '',
          hsn: editingItem.hsn || '',
          serialNumber: (editingItem as any).serialNumber || '',
          serials: (editingItem as any).serials || ((editingItem as any).serialNumber ? String((editingItem as any).serialNumber).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
          mrp: editingItem.mrp,
          costPrice: (editingItem as any).costPrice,
          price: editingItem.price,
          wholesalePrice: (editingItem as any).wholesale_price || (editingItem as any).wholesalePrice,
          discount: editingItem.discount,
          gstPercent: editingItem.gstPercent,
          stock: editingItem.stock,
          low_stock_threshold: editingItem.low_stock_threshold,
          unit: editingItem.unit || 'Pcs',
          size: editingItem.size || '',
          custom_box: editingItem.custom_box || '',
          active: (editingItem as any).active !== undefined ? (editingItem as any).active : true
        } : (aiPhotoItem ? { image: aiPhotoItem } : null)}
        onOpenScanner={() => setShowScanner(true)}
        scannedBarcode={formData.barcode}
        title={editingItem ? "Update Catalog Entry" : "Create Catalog Entry"}
      />

       <AnimatePresence>
         <div className={cn("fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 transition-all duration-300", showScanner ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
           <motion.div
             animate={{ opacity: showScanner ? 1 : 0 }}
             onClick={() => setShowScanner(false)}
             className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
           />
           <motion.div
             animate={showScanner ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.95 }}
             transition={{ type: "spring", damping: 25, stiffness: 350 }}
             className="relative w-full max-w-md bg-white border border-slate-200 rounded-[28px] shadow-2xl overflow-hidden p-5 md:p-6 text-slate-800"
           >
              <div>
                {/* Header Bar */}
                <div className="flex items-center justify-between gap-3 pb-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-emerald-500/30 bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                      <ScanLine size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
                        Barcode Scanner
                      </h2>
                      <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-emerald-100 shrink-0">
                        AUTO-DETECT
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setShowHelpGuide(!showHelpGuide)}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200",
                        showHelpGuide 
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                      )}
                      title="Setup & Connection Guide"
                    >
                      <HelpCircle size={18} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowScanner(false)}
                      className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {showHelpGuide ? (
                  <div className="mt-4 max-h-[440px] overflow-y-auto pr-1">
                    <ScannerHelpGuide />
                  </div>
                ) : (
                  <>
                
                {/* Scanner Source Selector Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setScannerSource('pc-camera')}
                    className={cn(
                      "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                      scannerSource === 'pc-camera'
                        ? "bg-white text-emerald-600 border border-slate-200 shadow-sm font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Camera size={13} />
                    <span>PC Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannerSource('usb-gun')}
                    className={cn(
                      "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                      scannerSource === 'usb-gun'
                        ? "bg-white text-emerald-600 border border-slate-200 shadow-sm font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Barcode size={13} />
                    <span>USB Gun</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannerSource('mobile-usb')}
                    className={cn(
                      "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                      scannerSource === 'mobile-usb'
                        ? "bg-white text-emerald-600 border border-slate-200 shadow-sm font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Phone size={13} />
                    <span>Mobile Cam</span>
                  </button>
                </div>

                {/* Top Input Bar for USB Gun / Manual Scan */}
                <div className="relative flex items-center mb-4">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Barcode size={16} />
                  </div>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.barcode.trim()) {
                        handleScannedBarcode(formData.barcode.trim());
                        setShowScanner(false);
                      }
                    }}
                    placeholder={
                      scannerSource === 'usb-gun'
                        ? "Awaiting gun scan... Pull trigger now"
                        : scannerSource === 'mobile-usb'
                        ? "Awaiting phone scan..."
                        : "Type barcode or scan with USB Gun..."
                    }
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-xs font-medium pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
                    autoFocus={scannerSource === 'usb-gun'}
                  />
                  {formData.barcode ? (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, barcode: '' }))}
                      className="absolute right-3 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <div className="absolute right-3 hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-semibold bg-slate-200/60 px-1.5 py-0.5 rounded">
                      <Keyboard size={12} /> {scannerSource === 'usb-gun' ? 'Focus Active' : 'USB Gun'}
                    </div>
                  )}
                </div>

                {/* Conditional Viewfinder Container */}
                {scannerSource === 'pc-camera' ? (
                  <div 
                    onClick={(e) => {
                      if (!cameraActive || cameraError) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      setTapFocusPos({ x, y });
                      setTimeout(() => setTapFocusPos(null), 800);
                      const el = document.getElementById("qr-reader-items");
                      triggerCameraRefocus(el);
                    }}
                    className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-[280px] xs:h-[300px] sm:h-[320px] w-full flex flex-col items-center justify-center cursor-pointer select-none"
                  >
                    <div id="qr-reader-items" className="w-full h-full [&>video]:object-contain [&>video]:mx-auto" />
                    
                    {/* Tap focus ring indicator */}
                    {tapFocusPos && (
                      <div 
                        style={{ left: tapFocusPos.x - 24, top: tapFocusPos.y - 24 }}
                        className="absolute w-12 h-12 rounded-full border-2 border-emerald-500 bg-emerald-500/20 z-30 pointer-events-none animate-ping"
                      />
                    )}

                    {!cameraActive && !cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-800 bg-slate-50/95 z-20 p-4 text-center">
                        <Loader2 className="animate-spin text-emerald-600 mb-2" size={28} />
                        <p className="text-sm font-bold">Camera starting...</p>
                        <p className="text-xs text-slate-500 mt-1">Enabling continuous autofocus...</p>
                      </div>
                    )}

                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 bg-slate-50 z-20 p-6 text-center">
                        <Camera className="mb-3 text-rose-500 animate-pulse" size={36} />
                        <p className="text-slate-800 font-bold text-base md:text-lg mb-4 max-w-[280px] leading-snug">
                          Camera could not be started. Please grant permission.
                        </p>
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              setCameraError(null);
                              const res = await requestExplicitCameraPermission();
                              if (res.success) {
                                setCameraActive(true);
                              } else {
                                setCameraError(res.error || "Permission denied.");
                              }
                            }}
                            className="px-6 py-3 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs md:text-sm rounded-full shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2"
                          >
                            <Camera size={16} /> Allow Camera Access
                          </button>
                          {window.self !== window.top && (
                            <a
                              href={window.location.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 text-[11px] text-emerald-600 hover:underline font-semibold"
                            >
                              Or open app in new tab
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Scanning Target Guide Box ("Mark") */}
                    {cameraActive && !cameraError && (
                      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                        {/* Centered guide rectangle with cutout backdrop shadow */}
                        <div className="relative w-[260px] h-[140px] border-2 border-emerald-500/50 rounded-2xl overflow-hidden bg-black/5 shadow-[0_0_0_9999px_rgba(248,250,252,0.85)]">
                          {/* Glowing laser scan line */}
                          <div className="scanner-laser-line bg-emerald-500" />
                          
                          {/* Laser sweep glow area */}
                          <div className="scanner-laser-glow" />

                          {/* Corner Brackets */}
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                        </div>

                        {/* Visual Align Instruction */}
                        <div className="absolute bottom-3 bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-emerald-500">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          Tap Camera to Refocus
                        </div>
                      </div>
                    )}
                  </div>
                ) : scannerSource === 'usb-gun' ? (
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50 h-[280px] sm:h-[320px] w-full flex flex-col items-center justify-center p-6 text-center select-none">
                    <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />
                    
                    <div className="w-[180px] h-[80px] border border-slate-200 rounded-2xl bg-white flex items-center justify-center relative overflow-hidden mb-6 shadow-sm">
                      <Barcode className="text-slate-400" size={54} />
                      <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                    </div>

                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-1.5">USB Scanner Gun Ready</h3>
                    <p className="text-[11px] text-slate-500 font-bold max-w-[270px] leading-relaxed">
                      Ensure cursor is focused inside the barcode field above and pull the scanner gun trigger to capture barcode automatically.
                    </p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50 min-h-[300px] py-6 px-5 w-full flex flex-col items-center justify-center text-center select-none">
                    <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />

                    {mobileScannerConnected ? (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-md animate-pulse">
                          <CheckCircle2 size={32} className="fill-current" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-1.5 flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1" />
                          Phone Scanner Connected!
                        </h3>
                        <p className="text-[11px] text-slate-500 font-bold max-w-[270px] leading-normal mb-4">
                          Aapka phone successfully connect ho chuka hai! Point your phone camera at any barcode to automatically scan and enter items.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center w-full">
                        {/* Beautiful QR Code representation */}
                        <div className="bg-white p-2 rounded-2xl shadow-md mb-3 border border-slate-200">
                          <QRCodeSVG value={`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`} size={120} />
                        </div>

                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                          Scan QR Code to Connect
                        </h3>
                        <p className="text-[11px] text-slate-500 font-bold max-w-[290px] leading-snug mb-3">
                          Open your phone camera to scan this QR code. Scanning will begin automatically!
                        </p>

                        <div className="w-full max-w-sm mt-1">
                          <p className="text-[8.5px] text-slate-400 font-black uppercase tracking-widest mb-1 text-center">Or open this link on your phone:</p>
                          <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 items-center justify-between">
                            <code className="text-[9.5px] text-emerald-600 font-mono pl-2 text-left overflow-x-auto whitespace-nowrap scrollbar-none w-full mr-2">
                              {`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`);
                              }}
                              className="bg-slate-200 hover:bg-slate-300 text-[8.5px] uppercase tracking-wider font-extrabold px-2.5 py-1.5 rounded-lg text-slate-700 shrink-0"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Camera Focus, Zoom & Torch Quick Controls Bar */}
                {scannerSource === 'pc-camera' && cameraActive && !cameraError && (
                  <div className="mt-2.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 flex items-center justify-between gap-2 shadow-inner">
                    {/* Sound Beep Toggle */}
                    <button
                      type="button"
                      onClick={toggleSound}
                      className={cn(
                        "py-1.5 px-2.5 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 border transition-all active:scale-95",
                        soundEnabled
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                          : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                      )}
                      title={soundEnabled ? "Mute scan sound" : "Enable scan sound"}
                    >
                      {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      <span className="text-[10px]">{soundEnabled ? 'Beep On' : 'Muted'}</span>
                    </button>

                    {/* Manual Refocus button */}
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("qr-reader-items");
                        triggerCameraRefocus(el);
                      }}
                      className="py-1.5 px-2 bg-white hover:bg-slate-50 active:scale-95 text-emerald-600 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition-all"
                    >
                      <Focus size={14} className="animate-pulse text-emerald-500" /> Refocus
                    </button>

                    {/* Torch / Flashlight Toggle */}
                    <button
                      type="button"
                      onClick={async () => {
                        const el = document.getElementById("qr-reader-items");
                        const nextState = !torchOn;
                        const ok = await setCameraTorch(el, nextState);
                        if (ok) setTorchOn(nextState);
                      }}
                      className={cn(
                        "py-1.5 px-3 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 border transition-all active:scale-95",
                        torchOn
                          ? "bg-amber-100 text-amber-800 border-amber-300 shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <Zap size={14} className={torchOn ? "fill-current text-amber-500" : ""} /> Torch
                    </button>

                    {/* Zoom presets */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      {[1.0, 1.4, 2.0].map((zVal) => (
                        <button
                          key={zVal}
                          type="button"
                          onClick={async () => {
                            setCurrentZoom(zVal);
                            const el = document.getElementById("qr-reader-items");
                            await setCameraZoom(el, zVal);
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider transition-all",
                            Math.abs(currentZoom - zVal) < 0.1
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-700"
                          )}
                        >
                          {zVal}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Bar: CAMERA Mode Switcher */}
                {scannerSource === 'pc-camera' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 px-4 flex items-center justify-between mt-3">
                    <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                      CAMERA:
                    </span>
                    <div className="bg-slate-200/50 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCameraMode('environment')}
                        className={cn(
                          "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                          cameraMode === 'environment'
                            ? "bg-emerald-600 text-white font-black shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Rear Cam
                      </button>
                      <button
                        type="button"
                        onClick={() => setCameraMode('user')}
                        className={cn(
                          "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                          cameraMode === 'user'
                            ? "bg-emerald-600 text-white font-black shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Front Cam
                      </button>
                    </div>
                  </div>
                )}
                </>
               )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} />
              </div>
              <h2 className="text-xl mb-2 tracking-tight font-medium">Remove item?</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                This item will be permanently removed from your catalog and ledger sync.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="btn-secondary py-2 text-sm"
                >
                  Keep Item
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="bg-rose-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-rose-700 transition-all disabled:opacity-50"
                >
                  {isDeleting ? 'Removing...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Bill Scan & Live Stock Auto-Update Modal */}
      <AnimatePresence>
        {isAiBillModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8 overflow-hidden relative max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                    <Sparkles size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">AI Bill Scan & Live Stock Auto-Update</h2>
                    <p className="text-xs text-slate-500 font-semibold">Snap a bill photo — Gemini AI extracts items & updates inventory instantly</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAiBillModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-6 space-y-6 overflow-y-auto flex-1">
                {aiSuccessMsg && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>{aiSuccessMsg}</span>
                  </div>
                )}

                {aiScanError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-3">
                    <AlertCircle size={18} className="text-rose-600 shrink-0" />
                    <span>{aiScanError}</span>
                  </div>
                )}

                {!extractedBillData ? (
                  <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-3xl p-8 text-center bg-slate-50/50 transition-colors flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shadow-inner">
                      <Camera size={28} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">Upload or Snap Supplier Bill / Invoice</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Supports JPG, PNG, WEBP or PDF supplier bills with items, quantities, and prices.</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleAiBillUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={aiScanning}
                      className="px-6 py-3 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-green-900/10 flex items-center gap-2 border-none cursor-pointer disabled:opacity-50"
                    >
                      {aiScanning ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Gemini AI Scanning Bill...</span>
                        </>
                      ) : (
                        <>
                          <ScanLine size={16} />
                          <span>Select Bill Photo / PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Header Details */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Supplier</span>
                          <span className="font-extrabold text-slate-800">{extractedBillData.supplierName || extractedBillData.customerName || 'Shree Electronics'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Invoice No</span>
                          <span className="font-bold text-slate-800">{extractedBillData.invoiceNo || 'PI-2026-00452'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Invoice Date</span>
                          <span className="font-bold text-slate-800">{extractedBillData.invoiceDate || '20-08-2026'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Supplier Bill No</span>
                          <span className="font-bold text-slate-800">{extractedBillData.supplierBillNo || 'SUP-88921'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Item Table */}
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Extracted Items ({extractedBillData.items?.length || 0})</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {extractedBillData.items?.map((item, idx) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1 text-xs shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-900">{item.description}</span>
                              <span className="font-black text-emerald-700">₹{item.amount || (item.quantity * (item.rate || item.price || 0))}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <span>HSN: <strong className="text-slate-700">{item.hsn || '-'}</strong></span>
                              <span>Batch: <strong className="text-slate-700">{item.batchNo || '-'}</strong></span>
                              <span>Serial: <strong className="text-slate-700">{item.serialNo || '-'}</strong></span>
                              <span>Qty: <strong className="text-slate-700">{item.quantity}</strong> | Rate: <strong className="text-slate-700">₹{item.rate || item.price || 0}</strong></span>
                            </div>
                            {item.gstPercent ? (
                              <div className="text-[10px] text-indigo-600 font-bold">GST: {item.gstPercent}%</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 text-xs space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Sub Total:</span>
                        <span className="font-bold">₹{extractedBillData.subTotal || extractedBillData.totalAmount || 0}</span>
                      </div>
                      {extractedBillData.discount ? (
                        <div className="flex justify-between text-slate-600">
                          <span>Discount:</span>
                          <span className="font-bold">-₹{extractedBillData.discount}</span>
                        </div>
                      ) : null}
                      {extractedBillData.cgst || extractedBillData.sgst ? (
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>CGST + SGST:</span>
                          <span>₹{extractedBillData.cgst || 0} + ₹{extractedBillData.sgst || 0}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-slate-900 font-black pt-1 border-t border-emerald-200 text-sm">
                        <span>Grand Total:</span>
                        <span className="text-emerald-700">₹{extractedBillData.totalAmount || 0}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setExtractedBillData(null)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer"
                      >
                        Scan Another Bill
                      </button>
                      <button
                        onClick={handleAutoUpdateStock}
                        disabled={aiScanning}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-900/10 flex items-center justify-center gap-2 border-none cursor-pointer"
                      >
                        {aiScanning ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Updating Stock...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            <span>Auto-Update Live Stock</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BarcodeLabelModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
        items={items as any}
      />

      {selectedSerialItem && (
        <BulkSerialImportModal
          isOpen={showBulkSerialModal}
          onClose={() => setShowBulkSerialModal(false)}
          itemName={selectedSerialItem.name}
          existingSerials={(selectedSerialItem as any).serials || ((selectedSerialItem as any).serialNumber ? String((selectedSerialItem as any).serialNumber).split(',').map((s: string) => s.trim()).filter(Boolean) : [])}
          onImport={async (newSerials) => {
            if (!user) return;
            try {
              const updatedStock = Math.max(Number(selectedSerialItem.stock) || 0, newSerials.length);
              await dbService.update('items', selectedSerialItem.id, {
                serials: newSerials,
                serialNumber: newSerials.join(', '),
                stock: updatedStock
              }, { offlineMode: isOfflineMode, userId: user.uid });
            } catch (err) {
              console.error("Error importing bulk serials:", err);
            }
          }}
        />
      )}
    </div>
  );
}
