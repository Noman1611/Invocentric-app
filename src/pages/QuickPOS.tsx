import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../hooks/useData';
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
  HelpCircle
} from 'lucide-react';
import { configureCameraTrackFocusAndZoom, triggerCameraRefocus, setCameraTorch, setCameraZoom, requestExplicitCameraPermission, startHtml5ScannerRobust, playScanBeepSound, playErrorBeepSound } from '../utils/cameraUtils';
import { motion, AnimatePresence } from 'motion/react';
import { ScannerHelpGuide } from '../components/ScannerHelpGuide';
import { initializeUsbScanner, registerScanListener, registerStatusListener, getScannerSessionId } from '../utils/usbScanner';
import { QRCodeSVG } from 'qrcode.react';

import { toWords } from 'number-to-words';

interface CartItem {
  id: string;
  item: any;
  quantity: number;
}

export default function QuickPOSPage() {
  const navigate = useNavigate();
  const { user, appMode, isPro, triggerUpgradeModal } = useAuth();
  const { items } = useItems();

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
  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1.4);
  const [tapFocusPos, setTapFocusPos] = useState<{ x: number; y: number } | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scannerSource, setScannerSource] = useState<'pc-camera' | 'usb-gun' | 'mobile-usb'>('pc-camera');
  const [mobileScannerConnected, setMobileScannerConnected] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  
  // Hardware Barcode Machine scanner keystroke buffer
  const scanBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  
  // Ref to prevent rapid duplicate scans of the same item
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);
  
  // Audio context for beep sound
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize audio context on mount
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContext.current?.state !== 'closed') {
        audioContext.current?.close();
      }
    };
  }, []);

  const playBeep = () => {
    if (!audioContext.current) return;
    try {
      if (audioContext.current.state === 'suspended') {
        audioContext.current.resume();
      }
      const oscillator = audioContext.current.createOscillator();
      const gainNode = audioContext.current.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioContext.current.currentTime); // Standard high-frequency scanner beep (1000Hz)
      
      gainNode.gain.setValueAtTime(0.15, audioContext.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.12);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.current.destination);
      
      oscillator.start();
      oscillator.stop(audioContext.current.currentTime + 0.12);
    } catch (e) {
      console.log('Audio playback failed');
    }
  };

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
  }, [isScanning, cameraMode, scannerSource]); // Re-run if scanning state, camera mode or scanner source changes

  const handleScanRef = useRef<any>(null);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  useEffect(() => {
    initializeUsbScanner();
    const unsubScan = registerScanListener((code) => {
      if (isScanning) {
        handleScanRef.current(code);
      }
    });

    const unsubStatus = registerStatusListener((connected) => {
      setMobileScannerConnected(connected);
    });

    return () => {
      unsubScan();
      unsubStatus();
    };
  }, [isScanning]);

  // Must wrap items in a ref to avoid stale closures in handleScan
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Sound enable/disable toggle with local storage persistence
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

  function handleScan(barcode: string) {
    if (!barcode) return;
    
    const now = Date.now();
    if (lastScannedRef.current && lastScannedRef.current.code === barcode && now - lastScannedRef.current.time < 1200) {
      // Cooldown to prevent multi-scanning the same barcode multiple times on rapid camera frames
      return;
    }
    
    // Save last scanned barcode with the current timestamp
    lastScannedRef.current = { code: barcode, time: now };

    const processItemScan = (matchedItem: any) => {
      if (appMode !== 'freelancer') {
        const itemStock = typeof matchedItem.stock === 'number' ? matchedItem.stock : 0;
        const existingInCart = cart.find(c => c.id === matchedItem.id);
        const currentQty = existingInCart ? existingInCart.quantity : 0;

        if (itemStock <= 0) {
          playErrorBeepSound(soundEnabled);
          alert(`⚠️ OUT OF STOCK!\n\nItem "${matchedItem.name}" is completely out of stock (Stock: 0).\n\nThis item CANNOT be added to the invoice/bill.`);
          return;
        }

        if (currentQty + 1 > itemStock) {
          playErrorBeepSound(soundEnabled);
          alert(`⚠️ INSUFFICIENT STOCK!\n\nItem "${matchedItem.name}" only has ${itemStock} unit(s) in stock.\nYou already have ${currentQty} in cart. Cannot add more.`);
          return;
        }
      }

      playScanBeepSound(soundEnabled);
      setCart(prev => {
        const existing = prev.find(c => c.id === matchedItem.id);
        if (existing) {
          return prev.map(c => c.id === matchedItem.id ? { ...c, quantity: c.quantity + 1 } : c);
        }
        return [...prev, { id: matchedItem.id, item: matchedItem, quantity: 1 }];
      });
    };

    const matchedItem = itemsRef.current.find(item => {
      if (item.barcode === barcode || item.id === barcode || item.name.toLowerCase() === barcode.toLowerCase()) {
        return true;
      }
      if (Array.isArray((item as any).serials)) {
        return (item as any).serials.some((s: any) => {
          const code = typeof s === 'string' ? s : (s && s.code ? s.code : '');
          return code.toLowerCase() === barcode.toLowerCase();
        });
      }
      if ((item as any).serialNumber) {
        return String((item as any).serialNumber).toLowerCase().includes(barcode.toLowerCase());
      }
      return false;
    });

    if (matchedItem) {
      processItemScan(matchedItem);
    } else {
      // Optional: search by partial text if exact barcode match fails
      const partialItem = itemsRef.current.find(item => 
        item.name.toLowerCase().includes(barcode.toLowerCase()) || 
        (item.barcode && item.barcode.includes(barcode))
      );
      if (partialItem) {
        processItemScan(partialItem);
      } else {
        playErrorBeepSound(soundEnabled);
        alert(`❌ Item Not Found!\n\nNo inventory product matching "${barcode}" was found.`);
      }
    }
  };

  // Hardware Barcode Gun / Keyboard Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a normal textarea
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        const scannedCode = scanBufferRef.current.trim();
        if (scannedCode.length >= 2) {
          handleScan(scannedCode);
          scanBufferRef.current = '';
          setSearchInput('');
          // Prevent form submit if any
          e.preventDefault();
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // If keystrokes arrive very rapidly (< 80ms), it's a hardware barcode scanner gun typing
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
        return { ...c, quantity: newQ > 0 ? newQ : 1 };
      }
      return c;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const totals = useMemo(() => {
    const totalAmount = cart.reduce((acc, curr) => acc + (curr.item.price * curr.quantity), 0);
    const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);
    return { totalAmount, totalItems };
  }, [cart]);

  const handleCreateBill = async () => {
    if (!user || cart.length === 0) return;

    // Strict stock check before generating invoice / bill
    if (appMode !== 'freelancer') {
      for (const cartItem of cart) {
        const inventoryItem = itemsRef.current.find(i => i.id === cartItem.item.id || i.name === cartItem.item.name);
        if (inventoryItem) {
          const stock = typeof inventoryItem.stock === 'number' ? inventoryItem.stock : 0;
          if (stock <= 0) {
            playErrorBeepSound(soundEnabled);
            alert(`⚠️ INVOICE CANNOT BE CREATED!\n\nItem "${cartItem.item.name}" is OUT OF STOCK (Stock: 0).\n\nPlease remove this item from the cart or add stock before creating invoice.`);
            return;
          }
          if (cartItem.quantity > stock) {
            playErrorBeepSound(soundEnabled);
            alert(`⚠️ INVOICE CANNOT BE CREATED!\n\nRequested quantity for "${cartItem.item.name}" (${cartItem.quantity}) exceeds available stock (${stock}).\n\nPlease reduce quantity.`);
            return;
          }
        }
      }
    }

    setIsCreating(true);
    
    try {
      const invoiceItems = cart.map(c => ({
        description: c.item.name,
        quantity: c.quantity,
        price: c.item.price,
        size: c.item.size || '',
        hsn: c.item.hsn || '',
        mrp: c.item.mrp || c.item.price || 0,
        discount: c.item.discount || 0,
        gstPercent: c.item.gstPercent || 0,
        custom_box: c.item.custom_box || c.item.description || ''
      }));

      let amountWordsStr = "ZERO RUPEES ONLY";
      try {
        const valFloor = Math.floor(totals.totalAmount);
        if (isFinite(valFloor) && !isNaN(valFloor) && valFloor >= 0) {
          amountWordsStr = `${toWords(valFloor)} RUPEES ONLY`.toUpperCase();
        }
      } catch (wordErr) {
        console.warn("toWords failed in POS:", wordErr);
      }

      const invoiceData = {
        customer_id: null,
        customer_name: 'Cash Sale',
        amount: totals.totalAmount,
        currency: 'INR',
        bill_type: 'INVOICE',
        discount: 0,
        sales_return: 0,
        columnVisibility: { size: false, hsn: false, mrp: false, discount: false, gstPercent: false },
        amount_words: amountWordsStr,
        status: 'paid', // Mark POS bills as paid directly
        due_date: new Date().toISOString(),
        items: invoiceItems,
      };

      const res = await dbService.add('invoices', invoiceData, { offlineMode: false, userId: user.uid });
      const newInvoiceId = res.id;

      // Automatically record a payment entry in the payments collection
      await dbService.add('payments', {
        user_id: user.uid,
        customer_id: null,
        customer_name: 'Cash Sale',
        amount: totals.totalAmount,
        date: new Date().toISOString(),
        note: `POS Invoice #${res.id.slice(0, 8).toUpperCase()} Paid`,
        method: 'cash',
        invoice_id: res.id,
      }, { offlineMode: false, userId: user.uid });

      // Auto-deduct stock for new invoices
      for (const cartItem of cart) {
        if (!cartItem.item.id || cartItem.quantity <= 0) continue;
        const inventoryItem = itemsRef.current.find(i => i.id === cartItem.item.id);
        if (inventoryItem && typeof inventoryItem.stock === 'number') {
          const newStock = Math.max(0, inventoryItem.stock - cartItem.quantity);
          try {
            await dbService.update('items', inventoryItem.id, { stock: newStock }, { offlineMode: false, userId: user.uid });
          } catch (err) {
            console.error("Failed to deduct stock for", inventoryItem.name, err);
          }
        }
      }

      // Stop camera before navigating
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        await qrCodeRef.current.stop();
        qrCodeRef.current.clear();
      }
      
      // Navigate to the invoice view, perhaps with a query param to trigger a direct print/WhatsApp prompt if needed, 
      // but standard Invoice View is already good.
      navigate(`/invoices/${newInvoiceId}?pos=true`);
      
    } catch (error) {
      console.error("Failed to create quick bill", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 md:pb-0 pb-safe font-sans select-none">
      {/* Top Professional Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:text-slate-950 hover:bg-slate-200 active:scale-95 transition-all"
            aria-label="Back"
          >
            <X size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-850 tracking-tight flex items-center gap-2">
              Quick Bill
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">POS</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-xl border border-rose-500/20 transition-all active:scale-95"
            >
              Clear Cart
            </button>
          )}
          <button 
            type="button"
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border",
              showHelpGuide 
                ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm" 
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-800"
            )}
            title="Setup & Connection Guide"
          >
            <HelpCircle size={15} />
            <span>Help Guide</span>
          </button>
          <button 
            onClick={() => setIsScanning(!isScanning)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border",
              isScanning 
                ? "bg-emerald-600 text-white border-emerald-700 shadow-sm hover:bg-emerald-700" 
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-800"
            )}
          >
            <Camera size={15} />
            <span>{isScanning ? 'Scanner On' : 'Open Camera'}</span>
          </button>
        </div>
      </div>

      {/* Unified Search & Barcode Input */}
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 shrink-0 z-20">
        <div className="relative flex items-center">
          <Barcode className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
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
              isScanning && scannerSource === 'usb-gun'
                ? "Awaiting gun scan... Pull trigger now"
                : isScanning && scannerSource === 'mobile-usb'
                ? "Awaiting phone scan..."
                : "Scan barcode or type item name..."
            }
            className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs font-medium pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm"
            autoFocus={isScanning && scannerSource === 'usb-gun'}
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          ) : (
            <div className="absolute right-3 hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-semibold bg-slate-200 px-1.5 py-0.5 rounded">
              <Keyboard size={12} /> {isScanning && scannerSource === 'usb-gun' ? 'Focus Active' : 'USB Gun'}
            </div>
          )}
        </div>

        {/* Scanner Source Selector Tabs */}
        {isScanning && (
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 mt-2 mb-1">
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
        )}
      </div>

      {/* Collapsible Help Guide Viewport */}
      <AnimatePresence initial={false}>
        {showHelpGuide && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="w-full bg-white border-b border-slate-200 text-slate-800 overflow-hidden"
          >
            <div className="p-4 max-h-[45vh] overflow-y-auto">
              <ScannerHelpGuide />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean Collapsible Camera Scanner Viewport */}
      <AnimatePresence initial={false}>
        {isScanning && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: scannerSource === 'mobile-usb' ? '46vh' : '36vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            onClick={(e) => {
              if (scannerSource !== 'pc-camera' || !cameraActive || cameraError) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              setTapFocusPos({ x, y });
              setTimeout(() => setTapFocusPos(null), 800);
              const el = document.getElementById("pos-qr-reader");
              triggerCameraRefocus(el);
            }}
            className="w-full bg-slate-100 relative overflow-hidden shrink-0 select-none border-b border-slate-200"
          >
            {scannerSource === 'pc-camera' ? (
              <div className="relative w-full h-full">
                <div id="pos-qr-reader" className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />
                
                {/* Tap focus ring indicator */}
                {tapFocusPos && (
                  <div 
                    style={{ left: tapFocusPos.x - 20, top: tapFocusPos.y - 20 }}
                    className="absolute w-10 h-10 rounded-full border-2 border-emerald-500 bg-emerald-500/20 z-30 pointer-events-none animate-ping"
                  />
                )}

                {/* Ultra-Minimal Camera Overlay Controls */}
                {cameraActive && !cameraError && (
                  <div className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                    {/* Sound Beep Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSound();
                      }}
                      className={cn(
                        "h-9 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 backdrop-blur-md shadow-lg text-xs font-bold",
                        soundEnabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-750"
                      )}
                      title={soundEnabled ? "Mute scan sound" : "Enable scan sound"}
                    >
                      {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      <span className="hidden xs:inline text-[10px]">{soundEnabled ? 'Beep On' : 'Muted'}</span>
                    </button>

                    {/* Torch Toggle */}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const el = document.getElementById("pos-qr-reader");
                        const nextState = !torchOn;
                        const ok = await setCameraTorch(el, nextState);
                        if (ok) setTorchOn(nextState);
                      }}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 backdrop-blur-md shadow-lg",
                        torchOn
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                      title="Toggle Flash"
                    >
                      <Zap size={16} className={torchOn ? "fill-current text-amber-500" : "text-slate-500"} />
                    </button>

                    {/* Zoom Toggle (Cycle 1x -> 1.5x -> 2x) */}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const nextZoom = currentZoom === 1.0 ? 1.5 : currentZoom === 1.5 ? 2.0 : 1.0;
                        setCurrentZoom(nextZoom);
                        const el = document.getElementById("pos-qr-reader");
                        await setCameraZoom(el, nextZoom);
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white text-emerald-600 border border-slate-200 backdrop-blur-md font-extrabold text-xs flex items-center justify-center transition-all active:scale-95 shadow-lg"
                      title="Toggle Zoom"
                    >
                      {currentZoom}x
                    </button>
                  </div>
                )}

                {/* Minimal Target Viewfinder Frame */}
                <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                   <div className="relative w-[240px] h-[120px] border-2 border-emerald-500/60 rounded-2xl overflow-hidden bg-black/5 shadow-[0_0_0_9999px_rgba(248,250,252,0.85)]">
                      {/* Laser line */}
                      <div className="scanner-laser-line bg-emerald-500" />
                      <div className="scanner-laser-glow" />

                      {/* Corner Accent Hooks */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />
                   </div>
                </div>

                {/* Error or Loading State */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-50 flex items-center justify-center z-20 p-4">
                    <div className="text-center max-w-xs">
                      <p className="text-slate-800 text-xs font-semibold mb-3">{cameraError}</p>
                      <button
                        type="button"
                        onClick={async () => {
                          setCameraError(null);
                          const res = await requestExplicitCameraPermission();
                          if (res.success) setCameraActive(true);
                          else setCameraError(res.error || "Permission denied.");
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 inline-flex items-center gap-1.5"
                      >
                        <Camera size={14} /> Allow Camera Access
                      </button>
                    </div>
                  </div>
                )}
                
                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-50">
                    <Loader2 size={22} className="text-emerald-600 animate-spin" />
                  </div>
                )}
              </div>
            ) : scannerSource === 'usb-gun' ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-white">
                <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />
                
                <div className="w-[180px] h-[80px] border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-center relative overflow-hidden mb-4 shadow-sm">
                  <Barcode className="text-slate-400" size={54} />
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                </div>

                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-1.5">USB Scanner Gun Ready</h3>
                <p className="text-[11px] text-slate-500 font-bold max-w-[270px] leading-relaxed">
                  Ensure cursor is focused inside the barcode field above and pull the scanner gun trigger to capture barcode automatically.
                </p>
              </div>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-5 text-center select-none bg-white overflow-y-auto">
                <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />

                {mobileScannerConnected ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-sm animate-pulse">
                      <CheckCircle2 size={32} className="fill-current" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-1.5 flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1" />
                      Phone Scanner Connected!
                    </h3>
                    <p className="text-[11px] text-slate-500 font-bold max-w-[270px] leading-normal mb-2">
                      Aapka phone successfully connect ho chuka hai! Point your phone camera at any barcode to automatically scan and enter items.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full">
                    {/* Beautiful QR Code representation */}
                    <div className="bg-white p-2 rounded-2xl shadow-md mb-3 border border-slate-200">
                      <QRCodeSVG value={`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`} size={110} />
                    </div>

                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Scan QR Code to Connect
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold max-w-[290px] leading-snug mb-3">
                      Apne phone ka camera open karke is QR code ko scan karein. Camera open hote hi scanning shuru ho jayegi!
                    </p>

                    <div className="w-full max-w-sm">
                      <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 items-center justify-between">
                        <code className="text-[9px] text-emerald-600 font-mono pl-2 text-left overflow-x-auto whitespace-nowrap scrollbar-none w-full mr-2">
                          {`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`);
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-[8px] uppercase tracking-wider font-extrabold px-2 py-1.5 rounded-lg text-slate-700 shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Items Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-200/60 flex items-center justify-center text-slate-400 mb-3">
              <ShoppingBag size={28} />
            </div>
            <p className="text-slate-800 font-bold text-sm">Cart is empty</p>
            <p className="text-slate-500 text-xs mt-1 max-w-[220px]">
              Scan items with camera or USB scanner gun to add to bill.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 pb-24">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                Scanned Items ({totals.totalItems})
              </span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg border border-green-200/60">
                Auto-added
              </span>
            </div>
            
            <AnimatePresence>
              {cart.map((c) => (
                <motion.div 
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{c.item.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-black text-slate-900">₹{c.item.price}</span>
                      {c.item.barcode && (
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {c.item.barcode}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      <button 
                        type="button"
                        onClick={() => updateQuantity(c.id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors active:bg-slate-300"
                      >
                        <Minus size={13} strokeWidth={2.5} />
                      </button>
                      <span className="w-7 text-center text-xs font-black text-slate-900">{c.quantity}</span>
                      <button 
                        type="button"
                        onClick={() => updateQuantity(c.id, 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors active:bg-slate-300"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => removeItem(c.id)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modern High-Impact Checkout Bar */}
      <div className="bg-white border-t border-slate-200 p-3.5 shrink-0 shadow-lg">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Payable</span>
            <span className="text-xl font-black text-slate-900">₹{totals.totalAmount.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              {totals.totalItems} {totals.totalItems === 1 ? 'Item' : 'Items'}
            </span>
          </div>
        </div>

        <button 
          onClick={handleCreateBill}
          disabled={cart.length === 0 || isCreating}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {isCreating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <span>Create Bill</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
