import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useItems, useCustomers, useInvoices } from '../hooks/useData';
import { dbService } from '../services/dbService';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { cn } from '../lib/utils';
import { 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Camera,
  ShoppingBag,
  ArrowRight,
  Loader2,
  ScanLine,
  Zap,
  Focus,
  ZoomIn,
  Search,
  Barcode,
  Keyboard,
  CheckCircle2,
  Volume2,
  VolumeX,
  Phone,
  HelpCircle,
  CreditCard,
  Banknote,
  QrCode,
  User,
  Layers,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Tag,
  Package
} from 'lucide-react';
import { configureCameraTrackFocusAndZoom, triggerCameraRefocus, setCameraTorch, setCameraZoom, requestExplicitCameraPermission, startHtml5ScannerRobust, playScanBeepSound, playErrorBeepSound } from '../utils/cameraUtils';
import { motion, AnimatePresence } from 'motion/react';
import { ScannerHelpGuide } from '../components/ScannerHelpGuide';
import { initializeUsbScanner, registerScanListener, registerStatusListener } from '../utils/usbScanner';
import { QRCodeSVG } from 'qrcode.react';
import { toWords } from 'number-to-words';
import { ScrollableTabBar } from '../components/ScrollableTabBar';

const generateSequentialInvoiceNumber = (allInvoices: any[], prefixOverride?: string) => {
  const prefix = (prefixOverride || 'INV').trim().toUpperCase() || 'INV';
  const year = new Date().getFullYear();

  const existingNumSet = new Set(
    (allInvoices || [])
      .map((inv: any) => (inv.invoice_number || '').trim().toUpperCase())
      .filter(Boolean)
  );

  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  let maxSeq = 0;
  (allInvoices || []).forEach((inv: any) => {
    const match = typeof inv.invoice_number === 'string' ? inv.invoice_number.match(pattern) : null;
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  });

  let candidateSeq = maxSeq > 0 ? maxSeq + 1 : (allInvoices?.length || 0) + 1;
  let candidateNumber = `${prefix}-${year}-${String(candidateSeq).padStart(4, '0')}`;

  while (existingNumSet.has(candidateNumber.toUpperCase())) {
    candidateSeq++;
    candidateNumber = `${prefix}-${year}-${String(candidateSeq).padStart(4, '0')}`;
  }

  return candidateNumber;
};

interface CartItem {
  id: string;
  item: any;
  quantity: number;
  selectedSerials?: string[];
}

export default function QuickPOSPage() {
  const navigate = useNavigate();
  const { user, appMode, isPro, triggerUpgradeModal, isOfflineMode } = useAuth();
  const { items } = useItems();
  const { customers } = useCustomers();
  const { invoices: existingInvoices } = useInvoices();

  useEffect(() => {
    if (!isPro) {
      navigate('/');
      triggerUpgradeModal('Quick POS & Barcode Billing', [
        'Fast point-of-sale layout designed for touch screens and thermal printers.',
        'Real-time barcode scanning using device camera or handheld USB laser scanners.',
        'Automated cash till logging, customer balance tracking, and retail analytics.'
      ]);
    }
  }, [isPro, navigate]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1.4);
  const [tapFocusPos, setTapFocusPos] = useState<{ x: number; y: number } | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scannerSource, setScannerSource] = useState<'pc-camera' | 'usb-gun' | 'mobile-usb'>('usb-gun');
  const [mobileScannerConnected, setMobileScannerConnected] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Customer & Payment state
  const [customerName, setCustomerName] = useState('Cash Sale');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [showMobileCart, setShowMobileCart] = useState(false);
  
  // Serial Number Modal for specific item
  const [activeSerialModalItem, setActiveSerialModalItem] = useState<CartItem | null>(null);
  const [tempSerials, setTempSerials] = useState<string[]>([]);
  const [serialScanInput, setSerialScanInput] = useState('');
  
  // Hardware Barcode Machine scanner keystroke buffer
  const scanBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContext.current?.state !== 'closed') {
        audioContext.current?.close();
      }
    };
  }, []);

  // Unique categories from items list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('All');
    items.forEach(i => {
      if (i.category && typeof i.category === 'string' && i.category.trim()) {
        cats.add(i.category.trim());
      }
    });
    return Array.from(cats);
  }, [items]);

  // Filtered items based on search and category
  const filteredProducts = useMemo(() => {
    return items.filter(item => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (searchInput.trim()) {
        const q = searchInput.trim().toLowerCase();
        const nameMatch = (item.name || '').toLowerCase().includes(q);
        const barcodeMatch = (item.barcode || '').toLowerCase().includes(q);
        const categoryMatch = (item.category || '').toLowerCase().includes(q);
        const serialMatch = Array.isArray(item.serials) && item.serials.some((s: any) => String(s).toLowerCase().includes(q));
        return nameMatch || barcodeMatch || categoryMatch || serialMatch;
      }
      return true;
    });
  }, [items, selectedCategory, searchInput]);

  useEffect(() => {
    let active = true;
    let timerId: any = null;
    let scannerInstance: Html5Qrcode | null = null;
    
    if (isScanning && scannerSource === 'pc-camera') {
      timerId = setTimeout(() => {
        if (!active) return;
        const element = document.getElementById("pos-qr-reader");
        if (!element) return;

        try {
          const html5QrCode = new Html5Qrcode("pos-qr-reader", {
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
                handleScan(decodedText);
              }
            }
          ).then(() => {
            if (active) {
              setTimeout(async () => {
                await configureCameraTrackFocusAndZoom(element, 1.4);
              }, 250);
            }
          }).catch((err) => {
            if (active) {
              console.error("Camera start error:", err);
              setCameraError("Camera permission denied or not available.");
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
      }, 300);
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
  }, [isScanning, cameraMode, scannerSource]);

  const handleScanRef = useRef<any>(null);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  useEffect(() => {
    initializeUsbScanner();
    const unsubScan = registerScanListener((code) => {
      handleScanRef.current(code);
    });

    const unsubStatus = registerStatusListener((connected) => {
      setMobileScannerConnected(connected);
    });

    return () => {
      unsubScan();
      unsubStatus();
    };
  }, []);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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

  // Add Item to Cart with Serial detection
  const addItemToCart = (itemToAdd: any, attachedSerial?: string) => {
    if (appMode !== 'freelancer') {
      const itemStock = typeof itemToAdd.stock === 'number' ? itemToAdd.stock : 0;
      const existingInCart = cart.find(c => c.id === itemToAdd.id);
      const currentQty = existingInCart ? existingInCart.quantity : 0;

      if (itemStock <= 0) {
        playErrorBeepSound(soundEnabled);
        alert(`⚠️ OUT OF STOCK!\n\nItem "${itemToAdd.name}" is completely out of stock (Stock: 0).`);
        return;
      }

      if (currentQty + 1 > itemStock) {
        playErrorBeepSound(soundEnabled);
        alert(`⚠️ INSUFFICIENT STOCK!\n\nOnly ${itemStock} unit(s) of "${itemToAdd.name}" available in stock.`);
        return;
      }
    }

    playScanBeepSound(soundEnabled);
    setCart(prev => {
      const existing = prev.find(c => c.id === itemToAdd.id);
      if (existing) {
        const nextSerials = existing.selectedSerials ? [...existing.selectedSerials] : [];
        if (attachedSerial && !nextSerials.includes(attachedSerial)) {
          nextSerials.push(attachedSerial);
        }
        return prev.map(c => c.id === itemToAdd.id ? { 
          ...c, 
          quantity: c.quantity + 1,
          selectedSerials: nextSerials 
        } : c);
      }
      return [...prev, { 
        id: itemToAdd.id, 
        item: itemToAdd, 
        quantity: 1, 
        selectedSerials: attachedSerial ? [attachedSerial] : [] 
      }];
    });
  };

  function handleScan(barcode: string) {
    if (!barcode) return;
    
    const now = Date.now();
    if (lastScannedRef.current && lastScannedRef.current.code === barcode && now - lastScannedRef.current.time < 1000) {
      return;
    }
    lastScannedRef.current = { code: barcode, time: now };

    const trimmed = barcode.trim();

    // 1. Check exact match by Product Barcode, SKU, ID, or Name
    let matchedItem = itemsRef.current.find(item => 
      item.barcode === trimmed || 
      item.id === trimmed || 
      item.name.toLowerCase() === trimmed.toLowerCase()
    );

    // 2. Check if scanned code matches a SPECIFIC SERIAL / IMEI NUMBER in inventory!
    let matchedSerial: string | undefined = undefined;
    if (!matchedItem) {
      matchedItem = itemsRef.current.find(item => {
        if (Array.isArray(item.serials)) {
          const hasSerial = item.serials.some((s: any) => {
            const code = typeof s === 'string' ? s : (s && s.code ? s.code : '');
            return code.toLowerCase() === trimmed.toLowerCase();
          });
          if (hasSerial) {
            matchedSerial = trimmed;
            return true;
          }
        }
        if (item.serialNumber && String(item.serialNumber).toLowerCase().includes(trimmed.toLowerCase())) {
          matchedSerial = trimmed;
          return true;
        }
        return false;
      });
    }

    if (matchedItem) {
      addItemToCart(matchedItem, matchedSerial);
    } else {
      // Partial match fallback
      const partialItem = itemsRef.current.find(item => 
        item.name.toLowerCase().includes(trimmed.toLowerCase()) || 
        (item.barcode && item.barcode.includes(trimmed))
      );
      if (partialItem) {
        addItemToCart(partialItem);
      } else {
        playErrorBeepSound(soundEnabled);
        alert(`❌ Item Not Found!\n\nNo product matching "${trimmed}" found in catalog.`);
      }
    }
  }

  // Global Hardware USB Laser Gun Scanner Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (target.id !== 'pos-search-input') return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        const scannedCode = scanBufferRef.current.trim();
        if (scannedCode.length >= 2) {
          handleScan(scannedCode);
          scanBufferRef.current = '';
          setSearchInput('');
          e.preventDefault();
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (timeDiff > 120) {
          scanBufferRef.current = e.key;
        } else {
          scanBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const updateQuantity = (id: string, delta: number) => {
    const targetCartItem = cart.find(c => c.id === id);
    if (targetCartItem && delta > 0 && appMode !== 'freelancer') {
      const inventoryItem = itemsRef.current.find(i => i.id === targetCartItem.item.id || i.name === targetCartItem.item.name);
      const stock = inventoryItem && typeof inventoryItem.stock === 'number' ? inventoryItem.stock : 0;
      if (targetCartItem.quantity + delta > stock) {
        playErrorBeepSound(soundEnabled);
        alert(`⚠️ INSUFFICIENT STOCK!\n\nCannot add more "${targetCartItem.item.name}". Only ${stock} item(s) available in stock.`);
        return;
      }
    }
    setCart(prev => prev.map(c => {
      if (c.id === id) {
        const newQ = c.quantity + delta;
        // Trim serials if quantity decreases
        const nextSerials = c.selectedSerials ? c.selectedSerials.slice(0, newQ > 0 ? newQ : 1) : [];
        return { ...c, quantity: newQ > 0 ? newQ : 1, selectedSerials: nextSerials };
      }
      return c;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  // Open Serial Selector Modal for a cart item
  const openSerialModal = (cartItem: CartItem) => {
    setActiveSerialModalItem(cartItem);
    setTempSerials(cartItem.selectedSerials ? [...cartItem.selectedSerials] : []);
    setSerialScanInput('');
  };

  const saveSerialModal = () => {
    if (!activeSerialModalItem) return;
    setCart(prev => prev.map(c => {
      if (c.id === activeSerialModalItem.id) {
        return { ...c, selectedSerials: tempSerials };
      }
      return c;
    }));
    setActiveSerialModalItem(null);
  };

  const totals = useMemo(() => {
    const rawSubtotal = cart.reduce((acc, curr) => acc + (Number(curr.item.price || 0) * curr.quantity), 0);
    const totalGst = cart.reduce((acc, curr) => {
      const gstPct = Number(curr.item.gstPercent || 0);
      const price = Number(curr.item.price || 0);
      return acc + (price * curr.quantity * (gstPct / 100));
    }, 0);
    const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);
    const finalTotal = Math.max(0, rawSubtotal + totalGst - discountAmount);
    return { rawSubtotal, totalGst, totalItems, finalTotal };
  }, [cart, discountAmount]);

  // Complete POS Sale
  const handleCreateBill = async () => {
    if (!user || cart.length === 0) return;

    if (appMode !== 'freelancer') {
      for (const cartItem of cart) {
        const inventoryItem = itemsRef.current.find(i => i.id === cartItem.item.id || i.name === cartItem.item.name);
        if (inventoryItem) {
          const stock = typeof inventoryItem.stock === 'number' ? inventoryItem.stock : 0;
          if (stock <= 0) {
            playErrorBeepSound(soundEnabled);
            alert(`⚠️ Cannot create bill! "${cartItem.item.name}" is OUT OF STOCK.`);
            return;
          }
          if (cartItem.quantity > stock) {
            playErrorBeepSound(soundEnabled);
            alert(`⚠️ Cannot create bill! Quantity for "${cartItem.item.name}" exceeds available stock (${stock}).`);
            return;
          }
        }
      }
    }

    setIsCreating(true);
    
    try {
      const invoiceItems = cart.map(c => {
        const serialsList = c.selectedSerials || [];
        const serialsStr = serialsList.join(', ');
        return {
          description: c.item.name,
          quantity: c.quantity,
          price: Number(c.item.price || 0),
          size: c.item.size || '',
          hsn: c.item.hsn || '',
          mrp: c.item.mrp || c.item.price || 0,
          discount: c.item.discount || 0,
          gstPercent: c.item.gstPercent || 0,
          custom_box: c.item.custom_box || c.item.description || '',
          serials: serialsList,
          serialNumber: serialsStr,
          serial_number: serialsStr
        };
      });

      let amountWordsStr = "ZERO RUPEES ONLY";
      try {
        const valFloor = Math.floor(totals.finalTotal);
        if (isFinite(valFloor) && !isNaN(valFloor) && valFloor >= 0) {
          amountWordsStr = `${toWords(valFloor)} RUPEES ONLY`.toUpperCase();
        }
      } catch (wordErr) {
        console.warn("toWords failed in POS:", wordErr);
      }

      const seqInvoiceNumber = generateSequentialInvoiceNumber(existingInvoices);

      const invoiceData = {
        invoice_number: seqInvoiceNumber,
        customer_id: null,
        customer_name: customerName.trim() || 'Cash Sale',
        customer_phone: customerPhone.trim() || '',
        amount: totals.finalTotal,
        currency: 'INR',
        bill_type: 'INVOICE',
        invoice_template: 'template_14',
        discount: discountAmount,
        sales_return: 0,
        payment_mode: paymentMethod.toUpperCase(),
        columnVisibility: { size: false, hsn: true, mrp: false, discount: false, gstPercent: false },
        amount_words: amountWordsStr,
        status: 'paid',
        due_date: new Date().toISOString(),
        items: invoiceItems,
      };

      const res = await dbService.add('invoices', invoiceData, { offlineMode: isOfflineMode, userId: user.uid });
      const newInvoiceId = res.id;

      // Record payment entry
      await dbService.add('payments', {
        user_id: user.uid,
        customer_id: null,
        customer_name: customerName.trim() || 'Cash Sale',
        amount: totals.finalTotal,
        date: new Date().toISOString(),
        note: `POS Invoice #${seqInvoiceNumber} (${paymentMethod.toUpperCase()})`,
        method: paymentMethod,
        invoice_id: res.id,
      }, { offlineMode: isOfflineMode, userId: user.uid });

      // Auto-deduct stock and remove sold serials
      for (const cartItem of cart) {
        if (!cartItem.item.id || cartItem.quantity <= 0) continue;
        const inventoryItem = itemsRef.current.find(i => i.id === cartItem.item.id);
        if (inventoryItem) {
          const currentStock = typeof inventoryItem.stock === 'number' ? inventoryItem.stock : 0;
          const newStock = Math.max(0, currentStock - cartItem.quantity);
          
          // Remove sold serials from item's serials list
          let remainingSerials = Array.isArray(inventoryItem.serials) ? [...inventoryItem.serials] : [];
          if (cartItem.selectedSerials && cartItem.selectedSerials.length > 0) {
            const soldSet = new Set(cartItem.selectedSerials.map(s => s.toLowerCase()));
            remainingSerials = remainingSerials.filter(s => !soldSet.has(String(s).toLowerCase()));
          }

          try {
            await dbService.update('items', inventoryItem.id, { 
              stock: newStock,
              serials: remainingSerials,
              serialNumber: remainingSerials.join(', ')
            }, { offlineMode: isOfflineMode, userId: user.uid });
          } catch (err) {
            console.error("Failed to deduct stock/serials for", inventoryItem.name, err);
          }
        }
      }

      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        await qrCodeRef.current.stop();
        qrCodeRef.current.clear();
      }
      
      navigate(`/invoices/${newInvoiceId}?pos=true&print=true`);
      
    } catch (error) {
      console.error("Failed to create quick bill", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col -m-4 md:-m-10 min-h-[calc(100dvh-5rem)] md:min-h-0 md:h-full bg-[#F6F8F3] text-[#142921] font-sans select-none overflow-hidden">
      
      {/* ── Top POS Header ── */}
      <header className="bg-white border-b border-[#E5EBE0] px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs shrink-0 gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button 
            onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F0F5EC] text-[#2C4A3E] hover:bg-[#E2EBDC] active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Back"
            title="Exit POS"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-[#142921] tracking-tight flex items-center gap-1.5 truncate">
              <span>QuickPOS</span>
              <span className="hidden xs:inline-block text-[9px] font-black uppercase tracking-wider bg-[#D7F4D4] text-[#163C2C] px-2 py-0.5 rounded-full border border-[#B9E2B5]">Live</span>
            </h1>
          </div>
        </div>

        {/* Right action buttons: fully responsive & touch-friendly */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="h-8 w-8 sm:w-auto px-0 sm:px-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 shrink-0"
              title="Reset Cart"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline text-[11px]">Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleSound}
            className={cn(
              "h-8 w-8 sm:w-auto px-0 sm:px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0",
              soundEnabled
                ? "bg-[#D7F4D4] text-[#163C2C] border-[#B9E2B5] hover:bg-[#C9ECC5]"
                : "bg-white text-[#60776C] border-[#E2EBDC] hover:bg-[#F6F8F3]"
            )}
            title={soundEnabled ? "Mute scan beep" : "Enable scan beep"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="hidden md:inline text-[11px]">{soundEnabled ? 'Beep On' : 'Muted'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            className={cn(
              "h-8 w-8 sm:w-auto px-0 sm:px-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border flex items-center justify-center gap-1 cursor-pointer shrink-0",
              showHelpGuide 
                ? "bg-[#D7F4D4] text-[#163C2C] border-[#B9E2B5]" 
                : "bg-[#F0F5EC] text-[#2C4A3E] border-[#E2EBDC] hover:bg-[#E2EBDC]"
            )}
            title="Guide & Shortcuts"
          >
            <HelpCircle size={15} />
            <span className="hidden md:inline text-[11px]">Guide</span>
          </button>

          <button 
            onClick={() => setIsScanning(!isScanning)}
            className={cn(
              "h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition-all active:scale-95 border flex items-center justify-center gap-1.5 cursor-pointer shrink-0",
              isScanning 
                ? "bg-[#073E36] text-white border-[#073E36] shadow-xs" 
                : "bg-white text-[#2C4A3E] border-[#E2EBDC] hover:bg-[#F6F8F3]"
            )}
            title="Toggle Camera Barcode Scanner"
          >
            <Camera size={15} />
            <span className="hidden xs:inline text-[11px]">{isScanning ? 'Cam On' : 'Camera'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Dual Panel Layout ── */}
      <div className="flex-1 lg:grid lg:grid-cols-12 overflow-hidden">
        
        {/* ── Left Side: Products Catalog & Search (7 Cols) ── */}
        <section className="lg:col-span-7 xl:col-span-7 flex flex-col h-full overflow-hidden border-r border-[#E5EBE0] bg-[#F6F8F3]/60">
          
          {/* Top Barcode Search Input & Scanner Source Tabs */}
          <div className="bg-white p-3 border-b border-[#E5EBE0] space-y-2 shrink-0">
            <div className="relative flex items-center">
              <Barcode className="absolute left-3.5 text-[#0F645D] pointer-events-none" size={18} />
              <input
                id="pos-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchInput.trim()) {
                    handleScan(searchInput.trim());
                    setSearchInput('');
                  }
                }}
                placeholder={
                  scannerSource === 'usb-gun'
                    ? "Pull barcode gun trigger or type product/serial..."
                    : "Search product name, barcode, or serial number..."
                }
                className="w-full bg-[#F6F8F3] text-[#142921] placeholder-[#768C81] text-xs font-semibold pl-10 pr-9 py-2.5 rounded-[16px] border border-[#E2EBDC] focus:outline-none focus:border-[#0F645D] focus:ring-2 focus:ring-[#0F645D]/15 transition-all shadow-xs"
                autoFocus
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 text-[#768C81] hover:text-[#142921] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Scanner Mode Switch Tabs */}
            {isScanning && (
              <div className="grid grid-cols-3 gap-1 bg-[#EAF1E4] p-1 rounded-xl border border-[#DCE6D6]">
                <button
                  type="button"
                  onClick={() => setScannerSource('usb-gun')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    scannerSource === 'usb-gun'
                      ? "bg-white text-[#0F645D] shadow-xs border border-[#DCE6D6]"
                      : "text-[#60776C] hover:text-[#142921]"
                  )}
                >
                  <Barcode size={13} />
                  <span>USB Gun</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScannerSource('pc-camera')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    scannerSource === 'pc-camera'
                      ? "bg-white text-[#0F645D] shadow-xs border border-[#DCE6D6]"
                      : "text-[#60776C] hover:text-[#142921]"
                  )}
                >
                  <Camera size={13} />
                  <span>PC Cam</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScannerSource('mobile-usb')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    scannerSource === 'mobile-usb'
                      ? "bg-white text-[#0F645D] shadow-xs border border-[#DCE6D6]"
                      : "text-[#60776C] hover:text-[#142921]"
                  )}
                >
                  <Phone size={13} />
                  <span>Mobile</span>
                </button>
              </div>
            )}
          </div>

          {/* Collapsible Camera Scanner Viewport */}
          <AnimatePresence initial={false}>
            {isScanning && scannerSource === 'pc-camera' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: '180px', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="w-full bg-black relative overflow-hidden shrink-0 border-b border-[#E5EBE0]"
              >
                <div id="pos-qr-reader" className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />
                
                {cameraActive && !cameraError && (
                  <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const el = document.getElementById("pos-qr-reader");
                        const ok = await setCameraTorch(el, !torchOn);
                        if (ok) setTorchOn(!torchOn);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all",
                        torchOn ? "bg-amber-400 text-amber-950" : "bg-black/60 text-white"
                      )}
                    >
                      <Zap size={14} />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Filter Pills (with swipe/scroll & arrow buttons) */}
          <ScrollableTabBar containerClassName="bg-white border-b border-[#E5EBE0] px-2 py-1.5" className="gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0",
                  selectedCategory === cat
                    ? "bg-[#073E36] text-white border-[#073E36] shadow-xs font-extrabold"
                    : "bg-[#F6F8F3] text-[#60776C] border-[#E2EBDC] hover:bg-[#EDF3E8] hover:text-[#142921]"
                )}
              >
                {cat}
              </button>
            ))}
          </ScrollableTabBar>

          {/* Product Cards Grid */}
          <div className="flex-1 p-3 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#768C81]">
                <ShoppingBag size={36} className="mb-2 opacity-40 text-[#0F645D]" />
                <p className="text-sm font-bold text-[#142921]">No items found</p>
                <p className="text-xs text-[#768C81] mt-0.5">Try searching with another keyword or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-2.5">
                {filteredProducts.map((prod) => {
                  const stockNum = typeof prod.stock === 'number' ? prod.stock : 0;
                  const isOutOfStock = appMode !== 'freelancer' && stockNum <= 0;
                  const inCartItem = cart.find(c => c.id === prod.id);
                  const hasSerials = (Array.isArray(prod.serials) && prod.serials.length > 0) || Boolean(prod.serialNumber);

                  return (
                    <button
                      key={prod.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => addItemToCart(prod)}
                      className={cn(
                        "text-left p-2.5 sm:p-3 rounded-2xl border transition-all flex flex-col justify-between relative group cursor-pointer active:scale-[0.98]",
                        isOutOfStock 
                          ? "bg-[#F0F2ED] border-[#E2EBDC] opacity-60 cursor-not-allowed" 
                          : inCartItem
                            ? "bg-[#EAF7EA] border-[#0F645D] shadow-xs ring-2 ring-[#0F645D]/15"
                            : "bg-white border-[#E5EBE0] hover:border-[#B9E2B5] hover:shadow-xs"
                      )}
                    >
                      {/* In Cart Indicator badge */}
                      {inCartItem && (
                        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-[#073E36] text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                          {inCartItem.quantity}
                        </div>
                      )}

                      {/* Product Image Thumbnail */}
                      <div className="w-full aspect-[4/3] mb-2 rounded-xl bg-[#F6F8F3] border border-[#E9EFE4] flex items-center justify-center overflow-hidden shrink-0">
                        {((prod as any).image || (prod as any).image_url) ? (
                          <img
                            src={(prod as any).image || (prod as any).image_url}
                            alt={prod.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <Package className="text-[#A2B5A9]" size={24} />
                        )}
                      </div>

                      <div>
                        {prod.category && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#768C81] block mb-0.5 truncate">
                            {prod.category}
                          </span>
                        )}
                        <h3 className="font-bold text-xs text-[#142921] line-clamp-2 leading-snug">
                          {prod.name}
                        </h3>

                        {hasSerials && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-[#0F645D] bg-[#EAF7EA] px-1.5 py-0.5 rounded border border-[#B9E2B5]">
                            <Barcode size={10} />
                            <span>S/N Tracked</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-[#E5EBE0] flex items-center justify-between gap-1">
                        <div>
                          <span className="text-xs font-extrabold text-[#142921] truncate">
                            ₹{Number(prod.price || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {appMode !== 'freelancer' && (
                          <span className={cn(
                            "text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0",
                            isOutOfStock
                              ? "bg-[#FBE4E8] text-[#9A1C36]"
                              : stockNum <= 5
                                ? "bg-amber-50 text-amber-800"
                                : "bg-[#E8F3E5] text-[#2C4A3E]"
                          )}>
                            {isOutOfStock ? 'Out' : `${stockNum} left`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Right Side: Live Billing Counter & Checkout (5 Cols) ── */}
        <section className="hidden lg:flex lg:col-span-5 xl:col-span-5 flex-col h-full bg-white shadow-lg overflow-hidden border-l border-[#E5EBE0]">
          
          {/* Cart Header */}
          <div className="p-3.5 border-b border-[#E5EBE0] flex items-center justify-between bg-[#F6F8F3]">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#142921] flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-[#0F645D]" />
                <span>Current Order</span>
              </h2>
              <p className="text-[10px] text-[#768C81] font-medium">{totals.totalItems} item(s) in basket</p>
            </div>
            
            {/* Quick Customer Selection */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="w-32 text-xs font-semibold px-2.5 py-1.5 bg-white rounded-[14px] border border-[#E2EBDC] text-[#142921] placeholder-[#768C81] focus:outline-none focus:border-[#0F645D]"
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#768C81]">
                <Barcode size={32} className="opacity-30 mb-2 text-[#0F645D]" />
                <p className="text-xs font-bold text-[#142921]">Cart is empty</p>
                <p className="text-[11px] text-[#768C81] mt-0.5">Scan barcodes or tap products on the left to add</p>
              </div>
            ) : (
              cart.map((cartItem) => {
                const itemTotal = Number(cartItem.item.price || 0) * cartItem.quantity;
                const hasSerials = (Array.isArray(cartItem.item.serials) && cartItem.item.serials.length > 0) || Boolean(cartItem.item.serialNumber);
                const assignedCount = cartItem.selectedSerials?.length || 0;

                return (
                  <div 
                    key={cartItem.id}
                    className="p-2.5 bg-[#F6F8F3] border border-[#E5EBE0] rounded-2xl space-y-2 hover:border-[#DCE6D6] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#E5EBE0] overflow-hidden shrink-0 flex items-center justify-center text-[#768C81]">
                        {((cartItem.item as any).image || (cartItem.item as any).image_url) ? (
                          <img
                            src={(cartItem.item as any).image || (cartItem.item as any).image_url}
                            alt={cartItem.item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={15} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-[#142921] truncate">{cartItem.item.name}</h4>
                        <p className="text-[11px] text-[#768C81] font-medium">₹{Number(cartItem.item.price || 0).toLocaleString('en-IN')} each</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-xs text-[#142921]">
                          ₹{itemTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Serial Numbers Pill Button */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => openSerialModal(cartItem)}
                        className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer",
                          assignedCount === cartItem.quantity && assignedCount > 0
                            ? "bg-[#D7F4D4] text-[#163C2C] border-[#B9E2B5]"
                            : assignedCount > 0
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : "bg-white text-[#2C4A3E] border-[#E2EBDC] hover:bg-[#F6F8F3]"
                        )}
                      >
                        <Barcode size={12} />
                        <span>S/N ({assignedCount}/{cartItem.quantity})</span>
                        {assignedCount === cartItem.quantity && assignedCount > 0 && <CheckCircle2 size={11} className="text-[#0F645D]" />}
                      </button>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-white border border-[#E5EBE0] rounded-xl p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => updateQuantity(cartItem.id, -1)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full bg-[#EBF2E6] hover:bg-[#E0EBD8] text-[#142921] flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-xs font-black text-[#142921]">
                          {cartItem.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(cartItem.id, 1)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full bg-[#EBF2E6] hover:bg-[#E0EBD8] text-[#142921] flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(cartItem.id)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all ml-1 active:scale-90 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Checkout & Summary Panel */}
          <div className="p-3.5 border-t border-[#E5EBE0] bg-[#F6F8F3] space-y-3 shrink-0">
            
            {/* Payment Method Selector */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#768C81] mb-1 block">
                Payment Mode
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'upi', label: 'UPI QR', icon: QrCode },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'credit', label: 'Credit', icon: User },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMethod(mode.id as any)}
                      className={cn(
                        "py-1.5 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-0.5 cursor-pointer",
                        paymentMethod === mode.id
                          ? "bg-[#073E36] text-white border-[#073E36] shadow-xs font-black"
                          : "bg-white text-[#60776C] border-[#E2EBDC] hover:bg-[#F6F8F3]"
                      )}
                    >
                      <Icon size={13} />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Cash Shortcuts (if cash selected) */}
            {paymentMethod === 'cash' && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5">
                {[100, 200, 500, 2000].map(cashVal => (
                  <button
                    key={cashVal}
                    type="button"
                    onClick={() => {
                      if (totals.finalTotal > 0) {
                        alert(`Cash Tendered: ₹${cashVal}\nChange to return: ₹${Math.max(0, cashVal - totals.finalTotal).toFixed(2)}`);
                      }
                    }}
                    className="px-2 py-1 bg-white hover:bg-[#F0F5EC] border border-[#E2EBDC] text-[#2C4A3E] rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all shadow-2xs"
                  >
                    ₹{cashVal}
                  </button>
                ))}
              </div>
            )}

            {/* Summary Lines */}
            <div className="space-y-1 text-xs pt-1 border-t border-[#E5EBE0]">
              <div className="flex justify-between text-[#768C81] font-medium">
                <span>Subtotal</span>
                <span>₹{totals.rawSubtotal.toFixed(2)}</span>
              </div>
              {totals.totalGst > 0 && (
                <div className="flex justify-between text-[#768C81] font-medium">
                  <span>GST Tax</span>
                  <span>+₹{totals.totalGst.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#0F645D] font-medium">
                  <span>Discount</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-[#142921] pt-1 border-t border-[#E5EBE0]">
                <span className="font-extrabold text-sm">Net Payable:</span>
                <span className="font-black text-base text-[#0F645D]">
                  ₹{totals.finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Action CTA Button */}
            <button
              type="button"
              disabled={cart.length === 0 || isCreating}
              onClick={handleCreateBill}
              className={cn(
                "w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] cursor-pointer",
                cart.length === 0
                  ? "bg-[#E2EBDC] text-[#A2B5A9] cursor-not-allowed border-none shadow-none"
                  : "bg-[#073E36] hover:bg-[#0A4E44] text-white border border-[#073E36] shadow-[#073E36]/20"
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing Bill...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Complete Bill &amp; Print (Enter)</span>
                </>
              )}
            </button>
          </div>
        </section>

      </div>

      {/* ── Mobile Sticky Bottom Floating Bar (< lg) ── */}
      <div className="lg:hidden p-3.5 bg-white border-t border-[#E5EBE0] flex items-center justify-between shrink-0 shadow-lg z-30 mb-16 md:mb-0">
        <div>
          <span className="text-[10px] font-bold text-[#768C81] block uppercase tracking-wider">Total Payable</span>
          <span className="text-base font-black text-[#0F645D]">
            ₹{totals.finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        <button
          type="button"
          disabled={cart.length === 0}
          onClick={() => setShowMobileCart(true)}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md",
            cart.length === 0
              ? "bg-[#E2EBDC] text-[#A2B5A9] cursor-not-allowed shadow-none"
              : "bg-[#073E36] hover:bg-[#0A4E44] text-white shadow-[#073E36]/20 active:scale-95"
          )}
        >
          <ShoppingBag size={15} />
          <span>View Cart & Checkout ({totals.totalItems})</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Mobile Cart Bottom Sheet Modal ── */}
      <AnimatePresence>
        {showMobileCart && (
          <div className="lg:hidden fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-h-[90vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Sheet Drag Handle & Header */}
              <div className="pt-3 px-4 pb-3 border-b border-[#E5EBE0] bg-[#F6F8F3]">
                <div className="w-12 h-1.5 bg-[#DCE6D6] rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-[#142921] flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[#0F645D]" />
                    <span>Cart Items ({totals.totalItems})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMobileCart(false)}
                    className="w-8 h-8 rounded-full bg-[#F0F5EC] hover:bg-[#E2EBDC] text-[#2C4A3E] flex items-center justify-center cursor-pointer active:scale-90 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
                {/* Mobile Customer Details */}
                <div className="p-3 bg-[#F6F8F3] border border-[#E5EBE0] rounded-2xl space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#768C81] block">
                    Customer Details
                  </span>
                  <div className="space-y-2">
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#768C81]" />
                      <input
                        type="text"
                        placeholder="Customer Name (Optional)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-[#E2EBDC] rounded-xl text-xs font-medium text-[#142921] placeholder-[#768C81] focus:outline-none focus:border-[#0F645D]"
                      />
                    </div>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#768C81]" />
                      <input
                        type="tel"
                        placeholder="Phone Number (Optional)"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-[#E2EBDC] rounded-xl text-xs font-medium text-[#142921] placeholder-[#768C81] focus:outline-none focus:border-[#0F645D]"
                      />
                    </div>
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#768C81] block">
                    Selected Products
                  </span>
                  {cart.map((cartItem) => (
                    <div key={cartItem.id} className="p-3 bg-[#F6F8F3] border border-[#E5EBE0] rounded-2xl space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-xs text-[#142921]">{cartItem.item.name}</h4>
                          <span className="text-[11px] text-[#768C81]">₹{Number(cartItem.item.price || 0).toLocaleString('en-IN')} each</span>
                        </div>
                        <span className="font-black text-xs text-[#142921]">
                          ₹{(Number(cartItem.item.price || 0) * cartItem.quantity).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-[#E5EBE0]">
                        <button
                          type="button"
                          onClick={() => openSerialModal(cartItem)}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg border border-[#E2EBDC] bg-white text-[#2C4A3E] flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Barcode size={12} />
                          <span>S/N ({cartItem.selectedSerials?.length || 0}/{cartItem.quantity})</span>
                        </button>

                        <div className="flex items-center gap-1.5 bg-white border border-[#E5EBE0] rounded-xl p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartItem.id, -1)}
                            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-[#EBF2E6] hover:bg-[#E0EBD8] text-[#142921] flex items-center justify-center active:scale-90 cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-black w-6 text-center text-[#142921]">{cartItem.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartItem.id, 1)}
                            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-[#EBF2E6] hover:bg-[#E0EBD8] text-[#142921] flex items-center justify-center active:scale-90 cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(cartItem.id)}
                            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full text-rose-500 hover:bg-rose-50 flex items-center justify-center ml-1 active:scale-90 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile Payment Mode Selector */}
                <div className="p-3 bg-[#F6F8F3] border border-[#E5EBE0] rounded-2xl space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#768C81] block">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'upi', label: 'UPI QR', icon: QrCode },
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'credit', label: 'Credit', icon: User },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setPaymentMethod(mode.id as any)}
                          className={cn(
                            "min-h-[44px] py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex flex-col items-center justify-center gap-1 active:scale-95 cursor-pointer",
                            paymentMethod === mode.id
                              ? "bg-[#073E36] text-white border-[#073E36] shadow-xs font-black"
                              : "bg-white text-[#60776C] border-[#E2EBDC] hover:bg-[#F6F8F3]"
                          )}
                        >
                          <Icon size={14} />
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Cash Shortcuts (if cash selected) */}
                  {paymentMethod === 'cash' && (
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-1">
                      {[100, 200, 500, 2000].map(cashVal => (
                        <button
                          key={cashVal}
                          type="button"
                          onClick={() => {
                            if (totals.finalTotal > 0) {
                              alert(`Cash Tendered: ₹${cashVal}\nChange to return: ₹${Math.max(0, cashVal - totals.finalTotal).toFixed(2)}`);
                            }
                          }}
                          className="min-h-[36px] px-3 py-1.5 bg-white hover:bg-[#F0F5EC] border border-[#E2EBDC] text-[#2C4A3E] rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all shadow-2xs active:scale-95"
                        >
                          ₹{cashVal}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Discount Input */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E5EBE0]">
                    <span className="text-xs font-bold text-[#60776C]">Discount (₹)</span>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-24 px-2.5 py-1 text-right bg-white border border-[#E2EBDC] rounded-lg text-xs font-bold text-[#142921] focus:outline-none focus:border-[#0F645D]"
                    />
                  </div>
                </div>
              </div>

              {/* Sheet Checkout Footer */}
              <div className="p-4 pb-8 sm:pb-4 bg-[#F6F8F3] border-t border-[#E5EBE0] space-y-3 pb-safe">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[#768C81] font-medium">
                    <span>Subtotal</span>
                    <span>₹{totals.rawSubtotal.toFixed(2)}</span>
                  </div>
                  {totals.totalGst > 0 && (
                    <div className="flex justify-between text-[#768C81] font-medium">
                      <span>GST Tax</span>
                      <span>+₹{totals.totalGst.toFixed(2)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#0F645D] font-medium">
                      <span>Discount</span>
                      <span>-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[#142921] pt-1 border-t border-[#E5EBE0]">
                    <span className="font-extrabold text-sm">Net Payable:</span>
                    <span className="font-black text-base text-[#0F645D]">
                      ₹{totals.finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  disabled={cart.length === 0 || isCreating}
                  onClick={handleCreateBill}
                  className={cn(
                    "w-full min-h-[50px] py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 cursor-pointer",
                    cart.length === 0
                      ? "bg-[#E2EBDC] text-[#A2B5A9] cursor-not-allowed shadow-none"
                      : "bg-[#073E36] hover:bg-[#0A4E44] text-white shadow-[#073E36]/30"
                  )}
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Generating Invoice...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Generate Bill &amp; Print Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Serial Number / IMEI Selection Modal ── */}
      <AnimatePresence>
        {activeSerialModalItem && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%', sm: { scale: 0.95, opacity: 0 } }}
              animate={{ y: 0, sm: { scale: 1, opacity: 1 } }}
              exit={{ y: '100%', sm: { scale: 0.95, opacity: 0 } }}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E5EBE0] space-y-4 pb-safe sm:pb-5"
            >
              <div className="w-12 h-1.5 bg-[#DCE6D6] rounded-full mx-auto sm:hidden -mt-1 mb-1" />
              <div className="flex items-center justify-between border-b border-[#E5EBE0] pb-3">
                <div>
                  <h3 className="font-extrabold text-sm text-[#142921] flex items-center gap-1.5">
                    <Barcode size={16} className="text-[#0F645D]" />
                    <span>Select Serial Numbers</span>
                  </h3>
                  <p className="text-[11px] text-[#768C81] font-medium">
                    {activeSerialModalItem.item.name} (Qty: {activeSerialModalItem.quantity})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSerialModalItem(null)}
                  className="w-8 h-8 rounded-full bg-[#F0F5EC] text-[#2C4A3E] hover:bg-[#E2EBDC] flex items-center justify-center cursor-pointer active:scale-90 transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Quick Scan Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#768C81] uppercase">Scan or Type Serial Number</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={serialScanInput}
                    onChange={(e) => setSerialScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && serialScanInput.trim()) {
                        const code = serialScanInput.trim();
                        if (!tempSerials.includes(code)) {
                          setTempSerials([...tempSerials, code]);
                          setSerialScanInput('');
                        }
                      }
                    }}
                    placeholder="Scan barcode on box..."
                    className="flex-1 text-xs font-semibold px-3 py-2.5 bg-[#F6F8F3] border border-[#E2EBDC] rounded-xl text-[#142921] placeholder-[#768C81] focus:outline-none focus:border-[#0F645D]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = serialScanInput.trim();
                      if (code && !tempSerials.includes(code)) {
                        setTempSerials([...tempSerials, code]);
                        setSerialScanInput('');
                      }
                    }}
                    className="min-h-[44px] px-4 py-2 bg-[#073E36] hover:bg-[#0A4E44] text-white rounded-xl font-bold text-xs cursor-pointer active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Available Stock Serials List */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-[#768C81] uppercase">
                  <span>Available in Stock ({Array.isArray(activeSerialModalItem.item.serials) ? activeSerialModalItem.item.serials.length : 0})</span>
                  <span className={tempSerials.length === activeSerialModalItem.quantity ? "text-[#0F645D] font-extrabold" : "text-amber-800"}>
                    Selected: {tempSerials.length}/{activeSerialModalItem.quantity}
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto p-2 bg-[#F6F8F3] rounded-2xl border border-[#E5EBE0] space-y-1">
                  {Array.isArray(activeSerialModalItem.item.serials) && activeSerialModalItem.item.serials.length > 0 ? (
                    activeSerialModalItem.item.serials.map((s: string) => {
                      const isSelected = tempSerials.includes(s);
                      return (
                        <label 
                          key={s} 
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all",
                            isSelected 
                              ? "bg-[#EAF7EA] text-[#0F645D] border-[#B9E2B5] font-bold" 
                              : "bg-white text-[#2C4A3E] border-[#E2EBDC] hover:bg-[#F0F5EC]"
                          )}
                        >
                          <span className="font-mono break-all">{s}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setTempSerials(tempSerials.filter(item => item !== s));
                              } else {
                                if (tempSerials.length < activeSerialModalItem.quantity) {
                                  setTempSerials([...tempSerials, s]);
                                } else {
                                  alert(`Maximum ${activeSerialModalItem.quantity} serial numbers can be selected for this item.`);
                                }
                              }
                            }}
                            className="w-5 h-5 rounded text-[#0F645D] focus:ring-[#0F645D]"
                          />
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-[#768C81] text-center py-3">No pre-loaded serials in stock. You can type/scan new serials above.</p>
                  )}
                </div>
              </div>

              {/* Selected Serials Chips */}
              {tempSerials.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#768C81] uppercase">Assigned S/N for this Bill</span>
                  <div className="flex flex-wrap gap-1">
                    {tempSerials.map((s, idx) => (
                      <span key={s} className="text-[10px] font-bold px-2 py-1 bg-[#D7F4D4] text-[#163C2C] rounded-full flex items-center gap-1 border border-[#B9E2B5] break-all">
                        <span>{s}</span>
                        <button type="button" onClick={() => setTempSerials(tempSerials.filter((_, i) => i !== idx))} className="hover:text-rose-600 p-0.5"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Save Buttons */}
              <div className="pt-2 border-t border-[#E5EBE0] flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSerialModalItem(null)}
                  className="flex-1 min-h-[44px] py-2.5 bg-[#F0F5EC] hover:bg-[#E2EBDC] text-[#2C4A3E] font-bold text-xs rounded-xl cursor-pointer transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSerialModal}
                  className="flex-1 min-h-[44px] py-2.5 bg-[#073E36] hover:bg-[#0A4E44] text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs active:scale-95"
                >
                  Save Serials ({tempSerials.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help Guide Modal */}
      <AnimatePresence>
        {showHelpGuide && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%', sm: { scale: 0.95, opacity: 0 } }}
              animate={{ y: 0, sm: { scale: 1, opacity: 1 } }}
              exit={{ y: '100%', sm: { scale: 0.95, opacity: 0 } }}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E5EBE0] pb-safe sm:pb-5"
            >
              <div className="w-12 h-1.5 bg-[#DCE6D6] rounded-full mx-auto sm:hidden -mt-1 mb-2" />
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#E5EBE0]">
                <h3 className="font-extrabold text-sm text-[#142921]">POS Scanner &amp; Setup Guide</h3>
                <button onClick={() => setShowHelpGuide(false)} className="w-8 h-8 rounded-full bg-[#F0F5EC] text-[#2C4A3E] hover:bg-[#E2EBDC] flex items-center justify-center active:scale-90"><X size={14} /></button>
              </div>
              <ScannerHelpGuide />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
