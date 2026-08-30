import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Minus, Trash2, Save, Send, Camera, Loader2, Sparkles, X, Barcode, ScanLine, Printer, Mic, Contact, CheckCircle2, AlertCircle, Zap, Focus, ZoomIn, Volume2, VolumeX, Keyboard, Tag, Palette, EyeOff, Phone, HelpCircle, ChevronDown } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomers, useItems, useInvoices, useSettings } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  doc, 
  getDoc,
  query,
  where,
  collection,
  getDocs,
  updateDoc,
  runTransaction
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { extractInvoiceFromImage, parseContactFromText } from '../services/aiService';
import { format } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';
import { toWords } from 'number-to-words';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { configureCameraTrackFocusAndZoom, triggerCameraRefocus, setCameraTorch, setCameraZoom, requestExplicitCameraPermission, startHtml5ScannerRobust, playScanBeepSound, playErrorBeepSound } from '../utils/cameraUtils';
import { initializeUsbScanner, registerScanListener, registerStatusListener, getScannerSessionId } from '../utils/usbScanner';
import { QRCodeSVG } from 'qrcode.react';
import { ScannerHelpGuide } from '../components/ScannerHelpGuide';

import { CURRENCIES } from '../constants';

interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
  size?: string;
  hsn?: string;
  mrp?: number;
  discount?: number;
  gstPercent?: number;
  custom_box?: string;
  serialNumber?: string;
  brand?: string;
  category?: string;
}

import { dbService, findLinkedPayments } from '../services/dbService';

export default function CreateInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isOfflineMode, appMode, isPro, triggerUpgradeModal } = useAuth();
  const { customers } = useCustomers();
  const { items: inventoryItems } = useItems();
  const { invoices: existingInvoices } = useInvoices();
  const { settings: sellerSettings } = useSettings();
  
  const uniqueCategories = Array.from(new Set(inventoryItems.map(item => item.category).filter(Boolean))) as string[];
  const uniqueBrands = Array.from(new Set(inventoryItems.map(item => item.brand).filter(Boolean))) as string[];
  const uniqueSerials = Array.from(new Set(inventoryItems.map(item => item.serialNumber || item.serial_number).filter(Boolean))) as string[];

  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [focusedRowField, setFocusedRowField] = useState<{ index: number; field: 'brand' | 'category' | 'serialNumber' } | null>(null);
  const [openMobileDetails, setOpenMobileDetails] = useState<Record<number, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<'draft' | 'sent' | 'paid' | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    company_name: '',
    gst_number: '',
    email: '',
    phone: '',
    address: '',
  });
  const [quickCustomFields, setQuickCustomFields] = useState<Array<{ id: string; label: string; value: string }>>([]);

  const PRESET_CUSTOM_LABELS = [
    "PAN Number",
    "Drug License (DL)",
    "Credit Days",
    "Opening Balance",
    "Contact Person",
    "Party Code",
    "Notes / Remarks"
  ];

  const handleAddQuickCustomField = (presetLabel?: string) => {
    setQuickCustomFields(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), label: presetLabel || '', value: '' }
    ]);
  };

  const handleRemoveQuickCustomField = (id: string) => {
    setQuickCustomFields(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateQuickCustomField = (id: string, key: 'label' | 'value', val: string) => {
    setQuickCustomFields(prev => prev.map(item => item.id === id ? { ...item, [key]: val } : item));
  };

  const startVoiceRecognition = () => {
    // Check if running in an iframe
    let isIframe = false;
    try {
      isIframe = window.self !== window.top;
    } catch (e) {
      isIframe = true;
    }
    
    if (isIframe) {
      alert("Voice input cannot be used inside a preview frame. Please click the 'Open App' button in the top right to open the app in a new tab.");
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      setIsListening(false);
      const transcript = event.results[0][0].transcript;
      const phoneMatches = transcript.match(/\d+/g);
      const phone = phoneMatches ? phoneMatches.join('').slice(0, 10) : '';
      const name = transcript.replace(/\d+/g, '').trim();

      setNewCustomer(prev => ({
        ...prev,
        name: name || prev.name,
        phone: phone || prev.phone
      }));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const pickContact = async () => {
    // @ts-ignore
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      alert("Contact picker API is not supported on this device/browser.");
      return;
    }
    
    // Check if running in an iframe
    let isIframe = false;
    try {
      isIframe = window.self !== window.top;
    } catch (e) {
      isIframe = true;
    }
    
    if (isIframe) {
      alert("Contact picker cannot be used inside a preview frame. Please click the 'Open App' button in the top right to open the app in a new tab.");
      return;
    }

    try {
      const props = ['name', 'tel', 'email', 'address'];
      const opts = { multiple: false };
      // @ts-ignore
      const contactsList = await navigator.contacts.select(props, opts);
      if (contactsList && contactsList.length > 0) {
        const contact = contactsList[0];
        const name = contact.name && contact.name.length > 0 ? contact.name[0] : '';
        const phone = contact.tel && contact.tel.length > 0 ? contact.tel[0].replace(/\D/g, '').slice(-10) : '';
        const email = contact.email && contact.email.length > 0 ? contact.email[0] : '';
        
        let address = '';
        if (contact.address && contact.address.length > 0) {
          const addr = contact.address[0];
          const parts = [addr.street, addr.city, addr.region, addr.country, addr.postalCode].filter(Boolean);
          address = parts.length > 0 ? parts.join(', ') : (addr.formatted || '');
        }
        
        setNewCustomer(prev => ({
          ...prev,
          name: name || prev.name,
          phone: phone || prev.phone,
          email: email || prev.email,
          address: address || prev.address
        }));
      }
    } catch (ex) {
      console.error("Error picking contact", ex);
    }
  };

  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    currency: 'INR',
    bill_type: 'INVOICE',
    price_tier: 'retail' as 'retail' | 'wholesale',
    discount: 0,
    shipping_charges: 0,
    sales_return: 0,
    advance_amount: 0,
    bank_account_id: '',
    invoice_template: 'tally_prime_gst',
    invoice_title: 'TAX INVOICE',
    copy_subtitle: 'ORIGINAL FOR RECIPIENT',
    terms_text: '',
    declaration_text: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    signatory_title: 'Authorized Signatory',
    hide_sections: {
      bank_details: false,
      upi_qr: false,
      signature: false,
      seller_address: false,
      customer_gstin: false,
      terms: false,
      declaration: false,
      amount_in_words: false,
      hsn_summary: false,
      footer: false
    } as Record<string, boolean>,
    columnVisibility: {
      size: true,
      hsn: true,
      mrp: true,
      discount: true,
      gstPercent: true,
    },
    items: [{ description: '', quantity: 1, price: 0, size: '', hsn: '', mrp: 0, discount: 0, gstPercent: 0, custom_box: '', serialNumber: '', brand: '', category: '' }],
    notes: '',
  });

  const [barcodeInput, setBarcodeInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1.4);
  const [tapFocusPos, setTapFocusPos] = useState<{ x: number; y: number } | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scannerSource, setScannerSource] = useState<'pc-camera' | 'usb-gun' | 'mobile-usb'>('pc-camera');
  const [mobileScannerConnected, setMobileScannerConnected] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

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

  const [savingDefaultTerms, setSavingDefaultTerms] = useState(false);
  const [saveTermsSuccess, setSaveTermsSuccess] = useState(false);

  const handleSaveAsDefault = async () => {
    if (!user) return;
    setSavingDefaultTerms(true);
    setSaveTermsSuccess(false);
    try {
      const currentTerms = formData.notes || '';
      
      // 1. Update in offline cache
      const cachedProfile = getSecureStorage(`user_profile_${user.uid}`, null);
      if (cachedProfile) {
        const parsed = typeof cachedProfile === 'string' ? JSON.parse(cachedProfile) : cachedProfile;
        parsed.default_terms = currentTerms;
        setSecureStorage(`user_profile_${user.uid}`, parsed);
      }

      const cachedProfileList = getSecureStorage(`offline_users_${user.uid}`, []);
      const updatedList = cachedProfileList.map((u: any) => {
        if (u.id === user.uid) {
          return { ...u, default_terms: currentTerms };
        }
        return u;
      });
      setSecureStorage(`offline_users_${user.uid}`, updatedList);

      // 2. Update in Firestore if online
      if (!isOfflineMode) {
        const docRef = doc(db, 'users', user.uid);
        await updateDoc(docRef, {
          default_terms: currentTerms
        });
      }

      setSaveTermsSuccess(true);
      setTimeout(() => {
        setSaveTermsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error saving default terms:", error);
    } finally {
      setSavingDefaultTerms(false);
    }
  };

  useEffect(() => {
    if (appMode === 'freelancer' && !id) {
      setFormData(prev => ({
        ...prev,
        columnVisibility: {
          size: false,
          hsn: false,
          mrp: false,
          discount: prev.columnVisibility.discount,
          gstPercent: prev.columnVisibility.gstPercent,
        }
      }));
    } else if (appMode === 'shop' && !id) {
      setFormData(prev => ({
        ...prev,
        columnVisibility: {
          size: true,
          hsn: true,
          mrp: true,
          discount: prev.columnVisibility.discount,
          gstPercent: prev.columnVisibility.gstPercent,
        }
      }));
    }
  }, [appMode, id]);

  useEffect(() => {
    let active = true;
    let timerId: any = null;
    let scannerInstance: Html5Qrcode | null = null;
    
    if (showScanner && scannerSource === 'pc-camera') {
      // Delay slightly to ensure the DOM element exists
      timerId = setTimeout(() => {
        if (!active) return;
        const element = document.getElementById("qr-reader");
        if (!element) return;

        try {
          const html5QrCode = new Html5Qrcode("qr-reader", {
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
                // Success callback
                playScanBeepSound(soundEnabled);
                setBarcodeInput(decodedText);
                handleScannedBarcode(decodedText);
                setShowScanner(false);
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

  const handleScannedBarcodeRef = useRef(handleScannedBarcode);
  useEffect(() => {
    handleScannedBarcodeRef.current = handleScannedBarcode;
  }, [handleScannedBarcode]);

  useEffect(() => {
    initializeUsbScanner();
    const unsubScan = registerScanListener((code) => {
      if (showScanner) {
        setBarcodeInput(code);
        handleScannedBarcodeRef.current(code);
        setShowScanner(false);
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
    if (!code) return;
    const foundItem = inventoryItems.find(i => i.barcode === code || i.name.toLowerCase() === code.toLowerCase());
    if (foundItem) {
      if (appMode !== 'freelancer') {
        const itemStock = typeof foundItem.stock === 'number' ? foundItem.stock : 0;
        const existingIndex = formData.items.findIndex(i => i.description === foundItem.name);
        const currentQtyInInvoice = existingIndex >= 0 ? formData.items[existingIndex].quantity : 0;

        if (itemStock <= 0) {
          playErrorBeepSound(soundEnabled);
          alert(`⚠️ OUT OF STOCK!\n\nItem "${foundItem.name}" is completely out of stock (Stock: 0).\n\nEntry CANNOT be added to the invoice.`);
          return;
        }

        if (currentQtyInInvoice + 1 > itemStock) {
          playErrorBeepSound(soundEnabled);
          alert(`⚠️ INSUFFICIENT STOCK!\n\nItem "${foundItem.name}" only has ${itemStock} unit(s) in stock.\nYou already have ${currentQtyInInvoice} in this invoice. Cannot add more.`);
          return;
        }
      }

      playScanBeepSound(soundEnabled);
      const existingIndex = formData.items.findIndex(i => i.description === foundItem.name);
      if (existingIndex >= 0) {
        const newItems = [...formData.items];
        newItems[existingIndex].quantity += 1;
        setFormData(prev => ({ ...prev, items: newItems }));
      } else {
        const isFirstEmpty = formData.items.length === 1 && !formData.items[0].description;
        const newItem = { 
          description: foundItem.name, 
          quantity: 1, 
          price: foundItem.price || 0, 
          size: foundItem.size || '', 
          hsn: foundItem.hsn || '', 
          mrp: foundItem.mrp || foundItem.price || 0, 
          discount: foundItem.discount || 0, 
          gstPercent: foundItem.gstPercent || 0,
          custom_box: foundItem.custom_box || foundItem.description || '',
          serialNumber: foundItem.serialNumber || ''
        };
        
        const newVisibility = { ...formData.columnVisibility };
        if (foundItem.size) newVisibility.size = true;
        if (foundItem.hsn) newVisibility.hsn = true;
        if (foundItem.mrp) newVisibility.mrp = true;
        if (foundItem.discount) newVisibility.discount = true;
        if (foundItem.gstPercent) newVisibility.gstPercent = true;

        setFormData(prev => ({
          ...prev,
          columnVisibility: {
            ...prev.columnVisibility,
            ...newVisibility
          },
          items: isFirstEmpty ? [newItem] : [...prev.items, newItem]
        }));
      }
      setBarcodeInput('');
    } else {
      playErrorBeepSound(soundEnabled);
      alert("❌ Item not found in inventory for scan: " + code);
    }
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      handleScannedBarcode(code);
    }
  };

  // Fetch invoice for editing
  useEffect(() => {
    async function fetchInvoice() {
      if (!id || !user) return;
      setFetching(true);
      try {
        const upserts = getSecureStorage(`offline_upserts_${user.uid}`, []);
        const localInvoices = getSecureStorage(`offline_invoices_${user.uid}`, []);
        
        let data: any = null;
        const queuedInvoice = upserts.find((u: any) => u.collection === "invoices" && u.item.id === id);
        if (queuedInvoice) data = queuedInvoice.item;
        else if (isOfflineMode) data = localInvoices.find((inv: any) => inv.id === id);
        
        if (!data && !isOfflineMode) {
          const docRef = doc(db, "invoices", id);
          const snap = await getDoc(docRef);
          if (snap.exists()) data = snap.data();
        }
        
        if (data) {
           setOriginalStatus(data.status || 'draft');
           const safeDate = data.due_date 
             ? format(parseDateSafe(data.due_date), "yyyy-MM-dd") 
             : new Date().toISOString().split("T")[0];
           setFormData({
             customer_id: data.customer_id,
             invoice_number: data.invoice_number || '',
             due_date: safeDate,
             currency: data.currency || "INR",
             bill_type: data.bill_type || "INVOICE",
             discount: data.discount || 0,
             sales_return: data.sales_return || 0,
             advance_amount: data.advance_amount || data.advanceAmount || 0,
             invoice_template: data.invoice_template || 'template_01',
             invoice_title: data.invoice_title || 'TAX INVOICE',
             copy_subtitle: data.copy_subtitle || 'ORIGINAL FOR RECIPIENT',
             terms_text: data.terms_text || data.notes || '',
             declaration_text: data.declaration_text || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
             signatory_title: data.signatory_title || 'Authorized Signatory',
             hide_sections: data.hide_sections || {
               bank_details: false,
               upi_qr: false,
               signature: false,
               seller_address: false,
               customer_gstin: false,
               terms: false,
               declaration: false,
               amount_in_words: false,
               hsn_summary: false,
               footer: false
             },
             items: data.items || [{ description: "", quantity: 1, price: 0, size: "", hsn: "", mrp: 0, discount: 0, gstPercent: 0 }],
             columnVisibility: data.columnVisibility || {
               size: true,
               hsn: true,
               mrp: true,
               discount: true,
               gstPercent: true,
             },
             notes: data.notes || data.terms_text || ""
           });
        }
      } catch (error) {
        console.error("Error fetching invoice:", error);
      } finally {
        setFetching(false);
      }
    }

    async function fetchFromQuotation() {
      const fromQuotationId = searchParams.get('from_quotation');
      if (!fromQuotationId || !user || id) return;
      setFetching(true);
      try {
        const docRef = doc(db, "invoices", fromQuotationId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const qData = snap.data();
          setFormData(prev => ({
            ...prev,
            customer_id: qData.customer_id || '',
            currency: qData.currency || "INR",
            bill_type: "INVOICE",
            discount: qData.discount || 0,
            advance_amount: qData.advance_amount || 0,
            items: qData.items || prev.items,
            notes: qData.notes || prev.notes
          }));
        }
      } catch (err) {
        console.error("Error loading quotation for conversion:", err);
      } finally {
        setFetching(false);
      }
    }

    if (id) {
      fetchInvoice();
    } else if (searchParams.get('from_quotation')) {
      fetchFromQuotation();
    } else {
      // Check if arriving from GST Calculator with pre-calculated amount
      const autoPrice = searchParams.get('auto_price');
      const autoGst = searchParams.get('auto_gst');
      if (autoPrice) {
        const p = parseFloat(autoPrice) || 0;
        const g = parseFloat(autoGst || '18') || 0;
        setFormData(prev => ({
          ...prev,
          columnVisibility: {
            ...prev.columnVisibility,
            gstPercent: true
          },
          items: [
            {
              description: 'General Goods / Service',
              quantity: 1,
              price: p,
              gstPercent: g,
              mrp: p,
              discount: 0,
              size: '',
              hsn: '',
              custom_box: '',
              serialNumber: '',
              brand: '',
              category: ''
            }
          ]
        }));
      }
    }
  }, [id, user, isOfflineMode, searchParams]);

  // Fetch default terms for new invoices
  useEffect(() => {
    async function fetchDefaultTerms() {
      if (!user || id) return;
      try {
        let terms = 'Payment is due within 15 days from the date of invoice.';
        if (isOfflineMode) {
          const cachedProfile = getSecureStorage(`offline_users_${user.uid}`, []);
          const cachedUser = cachedProfile.find((u: any) => u.id === user.uid) || getSecureStorage(`user_profile_${user.uid}`, null);
          const data = typeof cachedUser === 'string' ? JSON.parse(cachedUser) : cachedUser;
          if (data?.default_terms) terms = data.default_terms;
        } else {
          const docRef = doc(db, 'users', user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data()?.default_terms) {
            terms = snap.data().default_terms;
          }
        }
        setFormData(prev => ({ ...prev, notes: terms }));
      } catch (error) {
        console.error("Error loading default terms:", error);
      }
    }
    fetchDefaultTerms();
  }, [user, id, isOfflineMode]);

  // Auto-generate the next invoice number for new invoices (prefix + year + running sequence)
  useEffect(() => {
    if (id) return; // Don't touch invoice_number while editing an existing invoice

    const prefix = (sellerSettings?.invoice_prefix || 'INV').trim().toUpperCase() || 'INV';
    const year = new Date().getFullYear();

    // Collect all existing invoice numbers in a set (normalized uppercase)
    const existingNumSet = new Set(
      (existingInvoices || [])
        .map((inv: any) => (inv.invoice_number || '').trim().toUpperCase())
        .filter(Boolean)
    );

    // Look at existing invoice numbers to extract sequence numbers
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
    let maxSeq = 0;
    (existingInvoices || []).forEach((inv: any) => {
      const match = typeof inv.invoice_number === 'string' ? inv.invoice_number.match(pattern) : null;
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    });

    // Start with maxSeq + 1 or sequential check, and ensure the candidate number is NOT already in existingNumSet
    let candidateSeq = maxSeq > 0 ? maxSeq + 1 : (existingInvoices?.length || 0) + 1;
    let candidateNumber = `${prefix}-${year}-${String(candidateSeq).padStart(4, '0')}`;

    // Loop until we find a completely unused sequence number
    while (existingNumSet.has(candidateNumber.toUpperCase())) {
      candidateSeq++;
      candidateNumber = `${prefix}-${year}-${String(candidateSeq).padStart(4, '0')}`;
    }

    // If current invoice_number is empty or matches an old existing invoice, update it with fresh unique candidate
    setFormData(prev => {
      if (!prev.invoice_number || existingNumSet.has(prev.invoice_number.trim().toUpperCase())) {
        return { ...prev, invoice_number: candidateNumber };
      }
      return prev;
    });
  }, [id, sellerSettings, existingInvoices]);

  // Auto-detect currency based on locale (only for new invoices)
  useEffect(() => {
    if (id) return;
    try {
      const detectCurrency = Intl.NumberFormat().resolvedOptions().currency;
      if (detectCurrency && CURRENCIES.some(c => c.code === detectCurrency)) {
        setFormData(prev => ({ ...prev, currency: detectCurrency }));
      }
    } catch (e) {
      console.warn("Could not detect local currency:", e);
    }
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPro) {
      triggerUpgradeModal('AI Scan Bill & OCR Auto-Fill', [
        'Take a picture of any physical bill or receipt to automatically extract vendor name, line items, and totals.',
        'Eliminate manual data-entry errors with our high-precision OCR engine.',
        'Instantly reconcile paper bills and log them in your Ledger with 1-click.'
      ]);
      return;
    }

    setAiLoading(true);
    try {
      const base64Url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1600;
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
            // Compress with 0.7 quality to keep under 1MB
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.onerror = reject;
          img.src = event.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const base64 = base64Url.split(',')[1];
      const result = await extractInvoiceFromImage(base64, "image/jpeg");
      
      if (result) {
        // Find customer by name if possible
        let customerId = '';
        if (result.customerName) {
          const matched = customers.find(c => c.name.toLowerCase().includes(result.customerName!.toLowerCase()));
          if (matched) customerId = matched.id;
        }

        setFormData(prev => {
          const updates: any = {
            customer_id: customerId || prev.customer_id,
            currency: result.currency || prev.currency,
            items: result.items && result.items.length > 0 ? result.items : prev.items
          };

          // Only update dueDate if not already set or if it's empty
          if (!prev.due_date) {
            updates.due_date = new Date().toISOString().split('T')[0];
          }

          return { ...prev, ...updates };
        });
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      alert(error.message || "AI could not read this image perfectly. Please check the fields.");
    } finally {
      setAiLoading(false);
      e.target.value = '';
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, price: 0, size: '', hsn: '', mrp: 0, discount: 0, gstPercent: 0, custom_box: '', serialNumber: '', brand: '', category: '' }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const updateItemBatch = (index: number, updates: Partial<InvoiceItem>) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], ...updates };
      return { ...prev, items: newItems };
    });
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCustomer.name) return;

    setIsAddingCustomer(true);
    try {
      const cleanCustomFields = quickCustomFields.filter(f => f.label.trim() !== '' || f.value.trim() !== '');

      const res = await dbService.add('customers', {
        name: newCustomer.name,
        company_name: newCustomer.company_name,
        gst_number: newCustomer.gst_number,
        email: newCustomer.email,
        phone: newCustomer.phone,
        address: newCustomer.address,
        custom_fields: cleanCustomFields,
      }, { offlineMode: isOfflineMode, userId: user.uid });
      
      // Auto select the new customer
      setFormData(prev => ({ ...prev, customer_id: res.id }));
      setShowAddCustomerModal(false);
      setNewCustomer({ name: '', company_name: '', gst_number: '', email: '', phone: '', address: '' });
      setQuickCustomFields([]);
    } catch (error) {
      console.error("Error adding customer:", error);
      alert("Error adding customer.");
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const calculateTotal = () => {
    const isDiscountEnabled = formData.columnVisibility.discount === true;
    const isGstEnabled = formData.columnVisibility.gstPercent === true;

    const subtotal = formData.items.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const price = (!isDiscountEnabled && item.mrp) ? (Number(item.mrp) || 0) : (Number(item.price) || 0);
      return acc + (q * price);
    }, 0);

    const totalGst = isGstEnabled ? formData.items.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const basePrice = (!isDiscountEnabled && item.mrp) ? (Number(item.mrp) || 0) : (Number(item.price) || 0);
      const gstPercent = Number(item.gstPercent) || 0;
      return acc + (q * basePrice * (gstPercent / 100));
    }, 0) : 0;

    const globalDiscount = isDiscountEnabled ? (Number(formData.discount) || 0) : 0;
    const shipping = Number(formData.shipping_charges) || 0;
    const salesReturn = Number(formData.sales_return) || 0;

    const finalTotal = subtotal - globalDiscount + salesReturn + totalGst + shipping;
    return isNaN(finalTotal) ? 0 : Number(finalTotal.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'sent' | 'paid', skipView: boolean = false, printAfterSave: boolean = false) => {
    e.preventDefault();
    if (!user) return; 

    // Strict stock check before generating invoice
    if (appMode !== 'freelancer') {
      for (const item of formData.items) {
        if (!item.description || item.quantity <= 0) continue;
        const inventoryItem = inventoryItems.find(i => i.name.toLowerCase() === item.description.toLowerCase());
        if (inventoryItem) {
          const stock = typeof inventoryItem.stock === 'number' ? inventoryItem.stock : 0;
          if (stock <= 0) {
            playErrorBeepSound(soundEnabled);
            alert(`⚠️ INVOICE CANNOT BE CREATED!\n\nItem "${inventoryItem.name}" is OUT OF STOCK (Stock: 0).\n\nPlease remove this item from the invoice or update item stock in inventory.`);
            return;
          }
          if (item.quantity > stock) {
            playErrorBeepSound(soundEnabled);
            alert(`⚠️ INVOICE CANNOT BE CREATED!\n\nRequested quantity for "${inventoryItem.name}" (${item.quantity}) exceeds available stock (${stock}).\n\nPlease reduce quantity.`);
            return;
          }
        }
      }
    }

    setLoading(true);
    try {
      const selectedCustomer = customers.find(c => c.id === formData.customer_id);
      const total = calculateTotal();
      
      const dateValue = new Date(formData.due_date);
      if (isNaN(dateValue.getTime())) {
        throw new Error("Invalid due date selected. Please pick a valid date.");
      }

      const isDiscountEnabled = formData.columnVisibility.discount === true;
      const isGstEnabled = formData.columnVisibility.gstPercent === true;

      const cleanDiscount = isDiscountEnabled ? (Number(formData.discount) || 0) : 0;
      const cleanItems = formData.items.map(item => {
        const disc = isDiscountEnabled ? (Number(item.discount) || 0) : 0;
        const price = (!isDiscountEnabled && item.mrp) ? (Number(item.mrp) || 0) : (Number(item.price) || 0);
        return {
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          price: Number(price) || 0,
          size: item.size || '',
          hsn: item.hsn || '',
          mrp: Number(item.mrp) || 0,
          discount: Number(disc) || 0,
          gstPercent: isGstEnabled ? (Number(item.gstPercent) || 0) : 0,
          custom_box: item.custom_box || '',
          serialNumber: item.serialNumber || '',
          serial_number: item.serialNumber || '',
          brand: item.brand || '',
          category: item.category || ''
        };
      });

      const advance = Number(formData.advance_amount || 0);
      
      let amountWordsStr = "ZERO RUPEES ONLY";
      try {
        const valFloor = Math.floor(total);
        if (isFinite(valFloor) && !isNaN(valFloor) && valFloor >= 0) {
          const words = toWords(valFloor);
          const currencyWord = formData.currency === 'INR' ? 'RUPEES' : formData.currency;
          amountWordsStr = `${words} ${currencyWord} ONLY`.toUpperCase();
        }
      } catch (wordErr) {
        console.warn("toWords failed:", wordErr);
      }

      const invoiceData: any = {
        customer_id: formData.customer_id || null, // Allow null
        customer_name: selectedCustomer?.name || 'Cash Sale', // Default to Cash Sale
        invoice_number: formData.invoice_number || undefined,
        amount: total,
        advance_amount: advance,
        advanceAmount: advance,
        balance_due: Math.max(0, total - advance),
        currency: formData.currency,
        bill_type: formData.bill_type,
        price_tier: formData.price_tier || 'retail',
        discount: cleanDiscount,
        shipping_charges: Number(formData.shipping_charges) || 0,
        sales_return: formData.sales_return,
        bank_account_id: formData.bank_account_id || '',
        invoice_template: formData.invoice_template || 'template_01',
        invoice_title: formData.invoice_title || 'TAX INVOICE',
        copy_subtitle: formData.copy_subtitle || 'ORIGINAL FOR RECIPIENT',
        terms_text: formData.terms_text || formData.notes || '',
        declaration_text: formData.declaration_text || '',
        signatory_title: formData.signatory_title || 'Authorized Signatory',
        hide_sections: formData.hide_sections || {},
        columnVisibility: formData.columnVisibility,
        amount_words: amountWordsStr,
        status: (status === 'paid' && advance > 0 && advance < total) ? 'sent' : status,
        date: formData.invoice_date ? new Date(formData.invoice_date).toISOString() : new Date().toISOString(),
        invoice_date: formData.invoice_date ? new Date(formData.invoice_date).toISOString() : new Date().toISOString(),
        due_date: new Date(formData.due_date).toISOString(),
        items: cleanItems,
        notes: formData.terms_text || formData.notes || '',
      };

      if (id) {
        await dbService.update('invoices', id, invoiceData, { offlineMode: isOfflineMode, userId: user.uid });
        
        const invNum = formData.invoice_number || id.slice(0, 8).toUpperCase();
        if (status === 'paid') {
          const existingPayments = await findLinkedPayments(user.uid, id, isOfflineMode);

          const paymentPayload = {
            customer_id: formData.customer_id || null,
            customer_name: selectedCustomer?.name || 'Cash Sale',
            amount: total,
            date: formData.due_date ? new Date(formData.due_date).toISOString() : new Date().toISOString(),
            note: `Invoice #${invNum} Paid`,
            method: 'cash',
            invoice_id: id,
          };

          if (existingPayments.length > 0) {
            for (const p of existingPayments) {
              await dbService.update('payments', p.id, paymentPayload, { offlineMode: isOfflineMode, userId: user.uid });
            }
          } else {
            await dbService.add('payments', {
              ...paymentPayload,
              user_id: user.uid,
            }, { offlineMode: isOfflineMode, userId: user.uid });
          }
        } else {
          // If invoice status is changed to unpaid ('draft' or 'sent'), remove any linked payment entry
          const existingPayments = await findLinkedPayments(user.uid, id, isOfflineMode);
          for (const p of existingPayments) {
            await dbService.delete('payments', p.id, { offlineMode: isOfflineMode, userId: user.uid });
          }
        }
        
        // Auto-save any new item to catalog since it does not exist
        for (const item of formData.items) {
          if (!item.description) continue;
          const inventoryItem = inventoryItems.find(i => i.name.trim().toLowerCase() === item.description.trim().toLowerCase());
          if (!inventoryItem) {
            try {
              const newItemData = {
                name: item.description.trim(),
                price: Number(item.price) || 0,
                mrp: Number(item.mrp) || Number(item.price) || 0,
                costPrice: 0,
                brand: (item.brand || '').trim(),
                category: (item.category || '').trim() || 'General Inventory',
                barcode: '',
                hsn: (item.hsn || '').trim(),
                size: (item.size || '').trim(),
                serialNumber: (item.serialNumber || '').trim(),
                custom_box: (item.custom_box || '').trim(),
                gstPercent: Number(item.gstPercent) || 0,
                stock: 0,
                minStock: 0,
                active: true,
                user_id: user.uid,
                createdAt: new Date().toISOString()
              };
              await dbService.add('items', newItemData, { offlineMode: isOfflineMode, userId: user.uid });
            } catch (err) {
              console.error("Failed to auto-save item to catalog during edit", item.description, err);
            }
          }
        }

        if (printAfterSave) {
          navigate(`/invoices/${id}?print=true`);
        } else if (!skipView) {
          navigate(status === 'sent' ? `/invoices/${id}?share=true` : `/invoices/${id}`);
        } else {
          navigate('/invoices');
        }
      } else {
        const res = await dbService.add('invoices', invoiceData, { offlineMode: isOfflineMode, userId: user.uid });
        if (status === 'paid') {
          await dbService.add('payments', {
            user_id: user.uid,
            customer_id: formData.customer_id || null,
            customer_name: selectedCustomer?.name || 'Cash Sale',
            amount: total,
            date: new Date().toISOString(),
            note: `Invoice #${formData.invoice_number || res.id.slice(0, 8).toUpperCase()} Paid`,
            method: 'cash',
            invoice_id: res.id,
          }, { offlineMode: isOfflineMode, userId: user.uid });
        }
        
        // Auto-deduct stock or auto-create item in catalog with transactional updates for serials
        for (const item of formData.items) {
          if (!item.description) continue;
          const inventoryItem = inventoryItems.find(i => i.name.trim().toLowerCase() === item.description.trim().toLowerCase());
          if (inventoryItem && inventoryItem.id) {
            const selectedSerials = (item.serialNumber || '').split(',').map(s => s.trim()).filter(Boolean);
            if (db && !isOfflineMode) {
              try {
                const itemRef = doc(db, 'items', inventoryItem.id);
                await runTransaction(db, async (transaction) => {
                  const itemDoc = await transaction.get(itemRef);
                  if (!itemDoc.exists()) return;
                  const currentData = itemDoc.data();
                  const currentStock = typeof currentData.stock === 'number' ? currentData.stock : 0;
                  const deductionQty = Math.max(item.quantity || 1, selectedSerials.length || (item.quantity || 1));
                  const newStock = Math.max(0, currentStock - deductionQty);
                  
                  const updates: any = { 
                    stock: newStock, 
                    updated_at: new Date().toISOString() 
                  };

                  if (selectedSerials.length > 0 && Array.isArray(currentData.serials)) {
                    const isStringArray = currentData.serials.length === 0 || typeof currentData.serials[0] === 'string';
                    if (isStringArray) {
                      const remainingSerials = (currentData.serials as string[]).filter(s => !selectedSerials.some(sel => sel.toLowerCase() === s.trim().toLowerCase()));
                      const soldSerials = Array.isArray(currentData.sold_serials) ? currentData.sold_serials : [];
                      updates.serials = remainingSerials;
                      updates.sold_serials = [...soldSerials, ...selectedSerials];
                      updates.serialNumber = remainingSerials.join(', ');
                    } else {
                      const updatedSerials = currentData.serials.map((s: any) => {
                        if (s && s.code && selectedSerials.some(sel => sel.toLowerCase() === s.code.trim().toLowerCase())) {
                          return { ...s, status: 'sold', soldAt: new Date().toISOString() };
                        }
                        return s;
                      });
                      updates.serials = updatedSerials;
                    }
                  }
                  transaction.update(itemRef, updates);
                });
              } catch (txErr) {
                console.warn("Transaction stock deduction failed, falling back to dbService:", txErr);
                if (typeof inventoryItem.stock === 'number' && item.quantity > 0) {
                  const newStock = Math.max(0, inventoryItem.stock - item.quantity);
                  try {
                    await dbService.update('items', inventoryItem.id, { stock: newStock }, { offlineMode: isOfflineMode, userId: user.uid });
                  } catch (err) {
                    console.error("Failed to deduct stock for", item.description, err);
                  }
                }
              }
            } else {
              // Offline mode update
              if (typeof inventoryItem.stock === 'number' && item.quantity > 0) {
                const newStock = Math.max(0, inventoryItem.stock - item.quantity);
                try {
                  await dbService.update('items', inventoryItem.id, { stock: newStock }, { offlineMode: isOfflineMode, userId: user.uid });
                } catch (err) {
                  console.error("Failed to deduct stock for", item.description, err);
                }
              }
            }
          } else {
            try {
              const newItemData = {
                name: item.description.trim(),
                price: Number(item.price) || 0,
                mrp: Number(item.mrp) || Number(item.price) || 0,
                costPrice: 0,
                brand: (item.brand || '').trim(),
                category: (item.category || '').trim() || 'General Inventory',
                barcode: '',
                hsn: (item.hsn || '').trim(),
                size: (item.size || '').trim(),
                serialNumber: (item.serialNumber || '').trim(),
                serials: item.serialNumber ? [item.serialNumber.trim()] : [],
                custom_box: (item.custom_box || '').trim(),
                gstPercent: Number(item.gstPercent) || 0,
                stock: 0,
                minStock: 0,
                active: true,
                user_id: user.uid,
                createdAt: new Date().toISOString()
              };
              await dbService.add('items', newItemData, { offlineMode: isOfflineMode, userId: user.uid });
            } catch (err) {
              console.error("Failed to auto-save item to catalog during creation", item.description, err);
            }
          }
        }

        if (printAfterSave) {
          navigate(`/invoices/${res.id}?print=true`);
        } else if (!skipView) {
          navigate(status === 'sent' ? `/invoices/${res.id}?share=true` : `/invoices/${res.id}`); 
        } else {
          // Reset form for next quick entry
          setFormData({
            ...formData,
            customer_id: '',
            items: [{ description: '', quantity: 1, price: 0, size: '', hsn: '', mrp: 0, discount: 0, gstPercent: 0, custom_box: '', serialNumber: '', brand: '', category: '' }],
          });
          setBarcodeInput('');
          alert("Entry Saved Successfully!");
        }
      }
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("Error saving invoice.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Logo size={64} className="opacity-50" />
      </motion.div>
      <div className="flex items-center gap-2">
        <Loader2 className="animate-spin text-green-600" size={20} />
        <p className="text-neutral-500 font-bold">Loading invoice data...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 px-2 sm:px-4 pb-28 md:pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{id ? 'Edit' : 'Create'} Invoice</h1>
            <p className="text-xs font-semibold text-slate-400">{id ? 'Modify your existing invoice.' : 'Create a new invoice and deliver it instantly.'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className={cn(
            "btn-secondary flex items-center gap-2 cursor-pointer transition-all px-3 py-2 rounded-2xl text-xs font-bold",
            aiLoading ? "opacity-50 pointer-events-none" : "hover:border-emerald-500 hover:text-emerald-700"
          )}>
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <span className="flex items-center gap-1">
              {aiLoading ? 'AI Reading...' : 'AI Scan Bill'}
              {!aiLoading && <Sparkles size={13} className="text-amber-500" />}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      <form className="space-y-6 sm:space-y-8" onSubmit={(e) => e.preventDefault()}>
        <div className="glass-card p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">{appMode === 'freelancer' ? 'Client' : 'Customer'}</label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="text-xs font-bold text-neutral-900 flex items-center gap-1 hover:underline"
                >
                  <Plus size={12} />
                  {appMode === 'freelancer' ? 'New Client' : 'New Customer'}
                </button>
              </div>
              <select 
                className="input-field"
                value={formData.customer_id}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
              >
                <option value="">{appMode === 'freelancer' ? 'Direct / Individual Client' : 'Cash Sale (No Customer)'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Invoice Number</label>
              <input
                type="text"
                className="input-field font-semibold text-xs"
                value={formData.invoice_number}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                placeholder="INV-2026-0001 (Auto)"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Invoice Date</label>
              <input 
                type="date" 
                className="input-field font-semibold text-xs" 
                value={formData.invoice_date || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Due Date</label>
              <input 
                type="date" 
                className="input-field font-semibold text-xs" 
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label block">Currency</label>
              <select 
                className="input-field"
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                required
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol}) - {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label block">Bill Type</label>
              <select 
                className="input-field"
                value={formData.bill_type}
                onChange={(e) => setFormData(prev => ({ ...prev, bill_type: e.target.value }))}
                required
              >
                <option value="INVOICE">Invoice</option>
                <option value="BILL OF SUPPLY">Bill of Supply</option>
                <option value="CASH BILL">Cash Bill</option>
                <option value="ESTIMATE">Estimate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Template & Box Visibility Customization Panel */}
        <div className="glass-card p-4 sm:p-6 space-y-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Palette className="w-5 h-5 text-green-600 dark:text-green-400" />
                Invoice Layout Template &amp; Box Customization
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select professional GST template style &amp; choose which boxes to display on this invoice.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800">
                100% Fully Configurable
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Template Selector */}
            <div className="md:col-span-1 space-y-2">
              <label className="label block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Invoice Template Style
              </label>
              <select
                className="input-field font-semibold text-sm"
                value={formData.invoice_template || 'template_01'}
                onChange={(e) => setFormData(p => ({ ...p, invoice_template: e.target.value }))}
              >
                <option value="template_01">Template 01 — Blue Bordered Classic (A4)</option>
                <option value="template_02">Template 02 — Blue Bordered + IGST Columns (A4)</option>
                <option value="template_03">Template 03 — Blue Line Top / Company Left (A4)</option>
                <option value="template_04">Template 04 — Blue Line Top + IGST Columns (A4)</option>
                <option value="template_07">Template 07 — Full Bordered CGST/SGST (A4)</option>
                <option value="template_08">Template 08 — Company Right / Bill of Supply (A4)</option>
                <option value="template_09">Template 09 — Compact Border + Summary (A4)</option>
                <option value="template_10">Template 10 — Centered Header + Table Meta (A4)</option>
                <option value="template_12">Template 12 — Black Frame / All Table (A4)</option>
                <option value="template_14">Template 14 — POS Receipt Thermal (3-Inch / 80mm Roll)</option>
                <option value="template_15">Template 15 — POS Receipt Thermal (2-Inch / 58mm Roll)</option>
              </select>
              <p className="text-[11px] text-slate-500 italic">
                Applies instant layout formatting to preview &amp; printouts.
              </p>
            </div>

            {/* Document Header Text Customization */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Custom Invoice Title
                </label>
                <input
                  type="text"
                  className="input-field text-xs font-semibold"
                  placeholder="TAX INVOICE / CASH MEMO"
                  value={formData.invoice_title || 'TAX INVOICE'}
                  onChange={(e) => setFormData(p => ({ ...p, invoice_title: e.target.value }))}
                />
              </div>
              <div>
                <label className="label block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Copy Subtitle
                </label>
                <input
                  type="text"
                  className="input-field text-xs font-semibold"
                  placeholder="ORIGINAL FOR RECIPIENT"
                  value={formData.copy_subtitle || 'ORIGINAL FOR RECIPIENT'}
                  onChange={(e) => setFormData(p => ({ ...p, copy_subtitle: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Granular Box Toggles (Show / Hide any box) */}
          <div className="pt-2">
            <label className="label block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Select Boxes / Sections to Include in this Invoice (Show or Hide any Box)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {[
                { key: 'bank_details', label: 'Bank Details' },
                { key: 'upi_qr', label: 'UPI QR Code' },
                { key: 'signature', label: 'Signature Box' },
                { key: 'seller_address', label: 'Shop Address' },
                { key: 'customer_gstin', label: 'Customer GSTIN' },
                { key: 'terms', label: 'Terms & Conditions' },
                { key: 'declaration', label: 'Declaration Box' },
                { key: 'amount_in_words', label: 'Amount in Words' },
                { key: 'hsn_summary', label: 'HSN Table' },
                { key: 'footer', label: 'Footer Notes' },
              ].map((box) => {
                const isHidden = formData.hide_sections?.[box.key] === true;
                return (
                  <button
                    key={box.key}
                    type="button"
                    onClick={() => setFormData(p => ({
                      ...p,
                      hide_sections: {
                        ...p.hide_sections,
                        [box.key]: !isHidden
                      }
                    }))}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none",
                      !isHidden
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-xs"
                        : "bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-slate-400 line-through opacity-70"
                    )}
                  >
                    <span>{box.label}</span>
                    {!isHidden ? (
                      <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                    ) : (
                      <EyeOff size={13} className="text-slate-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold">{appMode === 'freelancer' ? 'Services & Deliverables' : 'Items'}</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mt-1">
                {appMode === 'freelancer' ? 'Configure billing details columns' : 'Configure columns to show in invoice'}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Pricing Tier Toggle (Wholesale vs Retail) */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, price_tier: 'retail' }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    formData.price_tier !== 'wholesale'
                      ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  Retail Price
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, price_tier: 'wholesale' }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    formData.price_tier === 'wholesale'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  Wholesale Rate
                </button>
              </div>

              {[
                { key: 'size', label: 'Size' },
                { key: 'hsn', label: 'HSN' },
                { key: 'mrp', label: 'MRP' },
                { key: 'discount', label: 'Disc%' },
                { key: 'gstPercent', label: 'GST%' }
              ].map(col => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    columnVisibility: {
                      ...prev.columnVisibility,
                      [col.key]: !prev.columnVisibility[col.key as keyof typeof prev.columnVisibility]
                    }
                  }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                    formData.columnVisibility[col.key as keyof typeof formData.columnVisibility]
                      ? "bg-green-50 border-green-100 text-green-700 shadow-sm"
                      : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                  )}
                >
                  {col.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-80 shrink-0 flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  placeholder="Scan Barcode or SKU..."
                  className="input-field pl-10 py-2 border-green-100 bg-green-50/50 text-sm focus:bg-white"
                />
              </div>
              <button 
                type="button"
                onClick={() => setShowScanner(true)}
                className="btn-secondary px-3 flex items-center justify-center shrink-0 border-green-200 text-green-700 hover:bg-green-50 focus:ring-4 focus:ring-green-100"
                title="Open Camera Scanner"
              >
                <ScanLine size={18} />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <React.Fragment key={index}>
                {/* ── Mobile View: Dedicated Responsive Item Card (< 768px) ── */}
                <div className="block md:hidden bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative">
                  {/* Card Top: Index Badge + Description Input + Remove Button */}
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 mt-6">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0 relative">
                      <label className="label block text-[11px] mb-1">
                        {appMode === 'freelancer' ? 'Service / Deliverable' : 'Description / Item'}
                      </label>
                      <input
                        type="text"
                        className="input-field animate-none text-xs"
                        placeholder={appMode === 'freelancer' ? 'e.g. Website Design...' : 'Start typing item name...'}
                        value={item.description}
                        onFocus={() => setFocusedItemIndex(index)}
                        onBlur={() => setTimeout(() => setFocusedItemIndex(null), 250)}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                      {item.serialNumber && (
                        <div className="flex items-center gap-1.5 px-0.5 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs break-all">
                            <span className="text-slate-500 font-sans font-medium text-[9px]">S/N:</span>
                            <span>{item.serialNumber}</span>
                          </span>
                        </div>
                      )}
                      {focusedItemIndex === index && (
                        <div className="absolute left-0 right-0 sm:right-auto top-full z-[150] mt-1 w-full max-w-full sm:min-w-[420px] sm:max-w-[540px] max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 shadow-2xl py-1 divide-y divide-slate-100 dark:divide-slate-800">
                          {inventoryItems
                            .filter(invItem => {
                              const term = (item.description || '').toLowerCase();
                              if (!term) return true;
                              return (
                                invItem.name.toLowerCase().includes(term) ||
                                (invItem.brand || '').toLowerCase().includes(term) ||
                                (invItem.category || '').toLowerCase().includes(term)
                              );
                            })
                            .map((invItem) => {
                              const itemStock = typeof invItem.stock === 'number' ? invItem.stock : 0;
                              const isOutOfStock = itemStock <= 0;
                              return (
                                <button
                                  key={invItem.id}
                                  type="button"
                                  onMouseDown={() => {
                                    if (appMode !== 'freelancer' && isOutOfStock) {
                                      playErrorBeepSound(soundEnabled);
                                      alert(`⚠️ OUT OF STOCK!\n\nItem "${invItem.name}" is out of stock (Stock: 0).\n\nCannot add to invoice.`);
                                      return;
                                    }

                                    const newVisibility = { ...formData.columnVisibility };
                                    if (invItem.size) newVisibility.size = true;
                                    if (invItem.hsn) newVisibility.hsn = true;
                                    if (invItem.mrp) newVisibility.mrp = true;
                                    if (invItem.discount) newVisibility.discount = true;
                                    if (invItem.gstPercent) newVisibility.gstPercent = true;

                                    setFormData(prev => ({
                                      ...prev,
                                      columnVisibility: {
                                        ...prev.columnVisibility,
                                        ...newVisibility
                                      }
                                    }));

                                    const selectedRate = (formData.price_tier === 'wholesale' && (invItem as any).wholesale_price)
                                      ? Number((invItem as any).wholesale_price)
                                      : (invItem.price || 0);

                                    updateItemBatch(index, {
                                      description: invItem.name,
                                      price: selectedRate,
                                      hsn: invItem.hsn || '',
                                      size: invItem.size || '',
                                      gstPercent: invItem.gstPercent || 0,
                                      mrp: invItem.mrp || invItem.price || 0,
                                      discount: invItem.discount || 0,
                                      custom_box: invItem.custom_box || invItem.description || '',
                                      serialNumber: (() => {
                                        if (Array.isArray((invItem as any).serials) && (invItem as any).serials.length > 0) {
                                          const otherSelected = new Set(
                                            formData.items.filter((_, rIdx) => rIdx !== index).map(it => (it.serialNumber || '').trim().toLowerCase())
                                          );
                                          const isString = typeof (invItem as any).serials[0] === 'string';
                                          if (isString) {
                                            const avail = ((invItem as any).serials as string[]).find(s => s && !otherSelected.has(s.trim().toLowerCase()));
                                            if (avail) return avail;
                                          } else {
                                            const availObj = (invItem as any).serials.find((s: any) => s && (s.status === 'in_stock' || !s.status) && !otherSelected.has(String(s.code || '').toLowerCase()));
                                            if (availObj) return availObj.code;
                                          }
                                        }
                                        return (invItem as any).serialNumber || '';
                                      })(),
                                      brand: invItem.brand || '',
                                      category: invItem.category || ''
                                    });
                                    setFocusedItemIndex(null);
                                  }}
                                  className={cn(
                                    "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-xs",
                                    isOutOfStock && appMode !== 'freelancer' ? "opacity-60 bg-gray-50/50" : ""
                                  )}
                                >
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                      {invItem.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                      {invItem.brand && (
                                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">
                                          {invItem.brand}
                                        </span>
                                      )}
                                      {invItem.category && (
                                        <span className="bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-medium">
                                          {invItem.category}
                                        </span>
                                      )}
                                      {invItem.hsn && (
                                        <span className="text-[9px] text-gray-400">
                                          HSN: {invItem.hsn}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right space-y-0.5 shrink-0 pl-3">
                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                      ₹{invItem.price || 0}
                                    </div>
                                    {invItem.mrp && invItem.mrp > (invItem.price || 0) && (
                                      <div className="text-[10px] text-gray-400 line-through">
                                        MRP: ₹{invItem.mrp}
                                      </div>
                                    )}
                                    {appMode !== 'freelancer' && (
                                      <div className={cn(
                                        "text-[10px] font-semibold",
                                        isOutOfStock ? "text-rose-600" : itemStock < 5 ? "text-amber-600" : "text-emerald-600"
                                      )}>
                                        {isOutOfStock ? 'Out of Stock' : `Stock: ${itemStock}`}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          }
                          {inventoryItems.filter(invItem => {
                            const term = (item.description || '').toLowerCase();
                            if (!term) return true;
                            return (
                              invItem.name.toLowerCase().includes(term) ||
                              (invItem.brand || '').toLowerCase().includes(term) ||
                              (invItem.category || '').toLowerCase().includes(term)
                            );
                          }).length === 0 && (
                            <div className="px-4 py-4 text-xs text-gray-400 italic text-center">
                              {item.description ? `Press tab to type/create new item "${item.description}"` : 'Type to search catalog items'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="min-w-[44px] min-h-[44px] p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all flex items-center justify-center active:scale-90 cursor-pointer shrink-0 mt-6"
                      title="Remove Item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Card Middle: Quantity Stepper + Net Rate + Live Total */}
                  <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    {/* Quantity Stepper (5 Cols) */}
                    <div className="col-span-5">
                      <label className="label block text-[10px] mb-1">
                        {appMode === 'freelancer' ? 'Hours / Qty' : 'Quantity'}
                      </label>
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            const current = item.quantity || 1;
                            if (current > 1) {
                              updateItem(index, 'quantity', current - 1);
                            }
                          }}
                          className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center justify-center active:scale-90 cursor-pointer shadow-2xs"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          className="w-full text-center text-xs font-black bg-transparent border-none focus:outline-none p-0"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/^0+(?=\d)/, '');
                            e.target.value = cleaned;
                            const newQty = Number(cleaned);
                            if (appMode !== 'freelancer' && item.description) {
                              const selected = inventoryItems.find(i => i.name.toLowerCase() === item.description.toLowerCase());
                              if (selected) {
                                const itemStock = typeof selected.stock === 'number' ? selected.stock : 0;
                                if (newQty > itemStock) {
                                  playErrorBeepSound(soundEnabled);
                                  alert(`⚠️ INSUFFICIENT STOCK!\n\nItem "${selected.name}" only has ${itemStock} unit(s) available in stock.`);
                                  return;
                                }
                              }
                            }
                            updateItem(index, 'quantity', newQty);
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const current = item.quantity || 0;
                            const newQty = current + 1;
                            if (appMode !== 'freelancer' && item.description) {
                              const selected = inventoryItems.find(i => i.name.toLowerCase() === item.description.toLowerCase());
                              if (selected) {
                                const itemStock = typeof selected.stock === 'number' ? selected.stock : 0;
                                if (newQty > itemStock) {
                                  playErrorBeepSound(soundEnabled);
                                  alert(`⚠️ INSUFFICIENT STOCK!\n\nItem "${selected.name}" only has ${itemStock} unit(s) available in stock.`);
                                  return;
                                }
                              }
                            }
                            updateItem(index, 'quantity', newQty);
                          }}
                          className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center justify-center active:scale-90 cursor-pointer shadow-2xs"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Net Rate (4 Cols) */}
                    <div className="col-span-4">
                      <label className="label block text-[10px] mb-1">
                        {appMode === 'freelancer' ? 'Rate / Fee' : 'Net Rate (₹)'}
                      </label>
                      <input
                        type="number"
                        className="input-field text-xs text-right font-bold"
                        value={item.price}
                        onChange={(e) => {
                          const val = e.target.value;
                          const cleaned = val.replace(/^0+(?=\d)/, '');
                          e.target.value = cleaned;
                          const newPrice = Number(cleaned);
                          if ((item.discount || 0) === 0) {
                            updateItemBatch(index, {
                              price: newPrice,
                              mrp: newPrice
                            });
                          } else {
                            updateItem(index, 'price', newPrice);
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>

                    {/* Live Line Total (3 Cols) */}
                    <div className="col-span-3 text-right">
                      <label className="label block text-[10px] mb-1 text-slate-400">Total</label>
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate pt-2">
                        ₹{((item.quantity || 0) * (item.price || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Active Toggles Grid (Size, HSN, MRP, Disc%, GST%) */}
                  {(formData.columnVisibility.size || formData.columnVisibility.hsn || formData.columnVisibility.mrp || formData.columnVisibility.discount || formData.columnVisibility.gstPercent) && (
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {formData.columnVisibility.size && (
                        <div>
                          <label className="label block text-[10px]">Size</label>
                          <input
                            type="text"
                            className="input-field uppercase text-center text-xs"
                            placeholder="L"
                            value={item.size || ''}
                            onChange={(e) => updateItem(index, 'size', e.target.value)}
                          />
                        </div>
                      )}
                      {formData.columnVisibility.hsn && (
                        <div>
                          <label className="label block text-[10px]">HSN</label>
                          <input
                            type="text"
                            className="input-field text-center text-xs"
                            placeholder="HSN"
                            value={item.hsn || ''}
                            onChange={(e) => updateItem(index, 'hsn', e.target.value)}
                          />
                        </div>
                      )}
                      {formData.columnVisibility.mrp && (
                        <div>
                          <label className="label block text-[10px]">MRP</label>
                          <input
                            type="number"
                            className="input-field text-xs"
                            value={item.mrp || 0}
                            onChange={(e) => {
                              const val = e.target.value;
                              const cleaned = val.replace(/^0+(?=\d)/, '');
                              e.target.value = cleaned;
                              const newMrp = Number(cleaned);
                              const discount = item.discount || 0;
                              const newPrice = newMrp * (1 - discount / 100);
                              updateItemBatch(index, {
                                mrp: newMrp,
                                price: Number(newPrice.toFixed(2))
                              });
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      )}
                      {formData.columnVisibility.discount && (
                        <div>
                          <label className="label block text-[10px]">Disc%</label>
                          <input
                            type="number"
                            className="input-field text-center text-xs"
                            value={item.discount || 0}
                            onChange={(e) => {
                              const val = e.target.value;
                              const cleaned = val.replace(/^0+(?=\d)/, '');
                              e.target.value = cleaned;
                              const disc = Number(cleaned);
                              const basePrice = item.mrp || item.price || 0;
                              const newPrice = basePrice * (1 - disc / 100);
                              updateItemBatch(index, {
                                discount: disc,
                                mrp: basePrice,
                                price: Number(newPrice.toFixed(2))
                              });
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      )}
                      {formData.columnVisibility.gstPercent && (
                        <div>
                          <label className="label block text-[10px]">GST%</label>
                          <input
                            type="number"
                            className="input-field text-center text-xs"
                            value={item.gstPercent || 0}
                            onChange={(e) => {
                              const val = e.target.value;
                              const cleaned = val.replace(/^0+(?=\d)/, '');
                              e.target.value = cleaned;
                              updateItem(index, 'gstPercent', Number(cleaned));
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible More Details Accordion (Brand, Category, Serial, Notes) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setOpenMobileDetails(prev => ({ ...prev, [index]: !prev[index] }))}
                      className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 py-1 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-emerald-600" />
                        <span>{openMobileDetails[index] ? 'Hide Additional Details' : 'More Details (Brand, S/N, Notes)'}</span>
                      </span>
                      <ChevronDown size={14} className={cn("transition-transform duration-200", openMobileDetails[index] && "rotate-180")} />
                    </button>

                    {openMobileDetails[index] && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                            placeholder="Brand (e.g. Sony)"
                            value={item.brand || ''}
                            onChange={(e) => updateItem(index, 'brand', e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                            placeholder="Category (e.g. Battery)"
                            value={item.category || ''}
                            onChange={(e) => updateItem(index, 'category', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-semibold"
                            placeholder="Serial Number (S/N)"
                            value={item.serialNumber || ''}
                            onChange={(e) => updateItem(index, 'serialNumber', e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-normal"
                            placeholder="Batch / Expiry / Notes"
                            value={item.custom_box || ''}
                            onChange={(e) => updateItem(index, 'custom_box', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Desktop View: High-Density Inline Row (>= 768px) ── */}
                <div className="hidden md:flex flex-col md:flex-row gap-4 items-start md:items-end bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-50 dark:border-slate-800 shadow-sm relative">
                  <div className="flex-1 w-full min-w-[240px] space-y-2">
                    <label className="label block">{appMode === 'freelancer' ? 'Service / Deliverable' : 'Description / Item'}</label>
                    <div className="flex flex-col gap-2 relative">
                      <input 
                        type="text" 
                        className="input-field animate-none" 
                        placeholder={appMode === 'freelancer' ? 'e.g. Website Design, Consulting...' : 'Start typing item name...'}
                        value={item.description}
                        onFocus={() => setFocusedItemIndex(index)}
                        onBlur={() => setTimeout(() => setFocusedItemIndex(null), 250)}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                      {item.serialNumber && (
                        <div className="flex items-center gap-1.5 px-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                            <span className="text-slate-500 font-sans font-medium text-[10px]">SR/No:</span>
                            <span>{item.serialNumber}</span>
                          </span>
                        </div>
                      )}
                      {focusedItemIndex === index && (
                        <div className="absolute left-0 right-0 sm:right-auto top-full z-[150] mt-1 w-full max-w-full sm:min-w-[420px] sm:max-w-[540px] max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 shadow-2xl py-1 divide-y divide-slate-100 dark:divide-slate-800">
                          {inventoryItems
                            .filter(invItem => {
                              const term = (item.description || '').toLowerCase();
                              if (!term) return true; // show all when focused with empty description
                              return (
                                invItem.name.toLowerCase().includes(term) ||
                                (invItem.brand || '').toLowerCase().includes(term) ||
                                (invItem.category || '').toLowerCase().includes(term)
                              );
                            })
                            .map((invItem) => {
                              const itemStock = typeof invItem.stock === 'number' ? invItem.stock : 0;
                              const isOutOfStock = itemStock <= 0;
                              return (
                                <button
                                  key={invItem.id}
                                  type="button"
                                  onMouseDown={() => {
                                    if (appMode !== 'freelancer' && isOutOfStock) {
                                      playErrorBeepSound(soundEnabled);
                                      alert(`⚠️ OUT OF STOCK!\n\nItem "${invItem.name}" is out of stock (Stock: 0).\n\nCannot add to invoice.`);
                                      return;
                                    }

                                    const newVisibility = { ...formData.columnVisibility };
                                    if (invItem.size) newVisibility.size = true;
                                    if (invItem.hsn) newVisibility.hsn = true;
                                    if (invItem.mrp) newVisibility.mrp = true;
                                    if (invItem.discount) newVisibility.discount = true;
                                    if (invItem.gstPercent) newVisibility.gstPercent = true;

                                    setFormData(prev => ({
                                      ...prev,
                                      columnVisibility: {
                                        ...prev.columnVisibility,
                                        ...newVisibility
                                      }
                                    }));

                                    const selectedRate = (formData.price_tier === 'wholesale' && (invItem as any).wholesale_price)
                                      ? Number((invItem as any).wholesale_price)
                                      : (invItem.price || 0);

                                    updateItemBatch(index, {
                                      description: invItem.name,
                                      price: selectedRate,
                                      hsn: invItem.hsn || '',
                                      size: invItem.size || '',
                                      gstPercent: invItem.gstPercent || 0,
                                      mrp: invItem.mrp || invItem.price || 0,
                                      discount: invItem.discount || 0,
                                      custom_box: invItem.custom_box || invItem.description || '',
                                      serialNumber: (() => {
                                        if (Array.isArray((invItem as any).serials) && (invItem as any).serials.length > 0) {
                                          const otherSelected = new Set(
                                            formData.items.filter((_, rIdx) => rIdx !== index).map(it => (it.serialNumber || '').trim().toLowerCase())
                                          );
                                          const isString = typeof (invItem as any).serials[0] === 'string';
                                          if (isString) {
                                            const avail = ((invItem as any).serials as string[]).find(s => s && !otherSelected.has(s.trim().toLowerCase()));
                                            if (avail) return avail;
                                          } else {
                                            const availObj = (invItem as any).serials.find((s: any) => s && (s.status === 'in_stock' || !s.status) && !otherSelected.has(String(s.code || '').toLowerCase()));
                                            if (availObj) return availObj.code;
                                          }
                                        }
                                        return (invItem as any).serialNumber || '';
                                      })(),
                                      brand: invItem.brand || '',
                                      category: invItem.category || ''
                                    });
                                    setFocusedItemIndex(null);
                                  }}
                                  className={cn(
                                    "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-xs",
                                    isOutOfStock && appMode !== 'freelancer' ? "opacity-60 bg-gray-50/50" : ""
                                  )}
                                >
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                      {invItem.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                      {invItem.brand && (
                                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">
                                          {invItem.brand}
                                        </span>
                                      )}
                                      {invItem.category && (
                                        <span className="bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-medium">
                                          {invItem.category}
                                        </span>
                                      )}
                                      {invItem.hsn && (
                                        <span className="text-[9px] text-gray-400">
                                          HSN: {invItem.hsn}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right space-y-0.5 shrink-0 pl-3">
                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                      ₹{invItem.price || 0}
                                    </div>
                                    {invItem.mrp && invItem.mrp > (invItem.price || 0) && (
                                      <div className="text-[10px] text-gray-400 line-through">
                                        MRP: ₹{invItem.mrp}
                                      </div>
                                    )}
                                    {appMode !== 'freelancer' && (
                                      <div className={cn(
                                        "text-[10px] font-semibold",
                                        isOutOfStock ? "text-rose-600" : itemStock < 5 ? "text-amber-600" : "text-emerald-600"
                                      )}>
                                        {isOutOfStock ? 'Out of Stock' : `Stock: ${itemStock}`}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          }
                          {inventoryItems.filter(invItem => {
                            const term = (item.description || '').toLowerCase();
                            if (!term) return true;
                            return (
                              invItem.name.toLowerCase().includes(term) ||
                              (invItem.brand || '').toLowerCase().includes(term) ||
                              (invItem.category || '').toLowerCase().includes(term)
                            );
                          }).length === 0 && (
                            <div className="px-4 py-4 text-xs text-gray-400 italic text-center">
                              {item.description ? `Press tab to type/create new item "${item.description}"` : 'Type to search catalog items'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Optional Item Details / Brand / Category / Serial No / Batch */}
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-3 relative">
                        <input 
                          type="text" 
                          autoComplete="off"
                          className="w-full text-[11px] px-3 py-1.5 bg-slate-50/70 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1e5eb8] focus:bg-white transition-all placeholder:text-gray-400 font-medium text-gray-800"
                          placeholder="Brand (e.g. Sony)"
                          value={item.brand || ''}
                          onChange={(e) => updateItem(index, 'brand', e.target.value)}
                          onFocus={() => setFocusedRowField({ index, field: 'brand' })}
                          onBlur={() => setTimeout(() => setFocusedRowField(null), 250)}
                        />
                        {focusedRowField?.index === index && focusedRowField?.field === 'brand' && (
                          <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-150 bg-white dark:bg-slate-900 shadow-xl py-1 text-[11px]">
                            {uniqueBrands
                              .filter(b => b.toLowerCase().includes((item.brand || '').toLowerCase()))
                              .map((bName, bIdx) => (
                                <button
                                  key={bIdx}
                                  type="button"
                                  onMouseDown={() => {
                                    updateItem(index, 'brand', bName);
                                    setFocusedRowField(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
                                >
                                  {bName}
                                </button>
                              ))
                            }
                            {uniqueBrands.filter(b => b.toLowerCase().includes((item.brand || '').toLowerCase())).length === 0 && (
                              <div className="px-3 py-2 text-slate-400 italic text-center text-[10px]">
                                {item.brand ? `Press tab to type brand` : 'Type brand name'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-3 relative">
                        <input 
                          type="text" 
                          autoComplete="off"
                          className="w-full text-[11px] px-3 py-1.5 bg-slate-50/70 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1e5eb8] focus:bg-white transition-all placeholder:text-gray-400 font-medium text-gray-800"
                          placeholder="Group Category (e.g. Battery)"
                          value={item.category || ''}
                          onChange={(e) => updateItem(index, 'category', e.target.value)}
                          onFocus={() => setFocusedRowField({ index, field: 'category' })}
                          onBlur={() => setTimeout(() => setFocusedRowField(null), 250)}
                        />
                        {focusedRowField?.index === index && focusedRowField?.field === 'category' && (
                          <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-150 bg-white dark:bg-slate-900 shadow-xl py-1 text-[11px]">
                            {uniqueCategories
                              .filter(c => c.toLowerCase().includes((item.category || '').toLowerCase()))
                              .map((cName, cIdx) => (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onMouseDown={() => {
                                    updateItem(index, 'category', cName);
                                    setFocusedRowField(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
                                >
                                  {cName}
                                </button>
                              ))
                            }
                            {uniqueCategories.filter(c => c.toLowerCase().includes((item.category || '').toLowerCase())).length === 0 && (
                              <div className="px-3 py-2 text-slate-400 italic text-center text-[10px]">
                                {item.category ? `Press tab to type category` : 'Type category'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-3 relative">
                        <input 
                          type="text" 
                          autoComplete="off"
                          className={cn(
                            "w-full text-[11px] px-3 py-1.5 rounded-lg focus:outline-none transition-all font-semibold font-mono",
                            item.serialNumber 
                              ? "bg-emerald-50/70 border border-emerald-300 text-emerald-800 focus:border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200" 
                              : "bg-slate-50/70 border border-gray-200 text-gray-800 focus:border-[#1e5eb8] focus:bg-white placeholder:text-gray-400 font-sans dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                          )}
                          placeholder="Serial Number (S/N)"
                          value={item.serialNumber || ''}
                          onChange={(e) => updateItem(index, 'serialNumber', e.target.value)}
                          onFocus={() => setFocusedRowField({ index, field: 'serialNumber' })}
                          onBlur={() => setTimeout(() => setFocusedRowField(null), 250)}
                        />
                        {focusedRowField?.index === index && focusedRowField?.field === 'serialNumber' && (() => {
                          const matchedInvItem = inventoryItems.find(i => i.name.trim().toLowerCase() === (item.description || '').trim().toLowerCase());
                          let availableSerials: string[] = [];
                          if (matchedInvItem) {
                            if (Array.isArray((matchedInvItem as any).serials)) {
                              availableSerials = (matchedInvItem as any).serials.map((s: any) => {
                                if (typeof s === 'string') return s;
                                if (s && typeof s === 'object') {
                                  return (s.status === 'in_stock' || !s.status) ? s.code : null;
                                }
                                return null;
                              }).filter(Boolean);
                            } else if ((matchedInvItem as any).serialNumber) {
                              availableSerials = String((matchedInvItem as any).serialNumber).split(',').map((s: string) => s.trim()).filter(Boolean);
                            }
                          }
                          const otherSelected = new Set(
                            formData.items
                              .filter((_, rIdx) => rIdx !== index)
                              .map(it => (it.serialNumber || '').trim().toLowerCase())
                              .filter(Boolean)
                          );
                          const candidateSerials = (availableSerials.length > 0 ? availableSerials : uniqueSerials)
                            .filter(s => !otherSelected.has(s.toLowerCase()));

                          const filtered = candidateSerials.filter(s => s.toLowerCase().includes((item.serialNumber || '').toLowerCase()));

                          return (
                            <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1 text-[11px]">
                              {availableSerials.length > 0 && (
                                <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
                                  <span>In-Stock Serials ({availableSerials.length})</span>
                                  <span className="font-normal text-emerald-600">Available</span>
                                </div>
                              )}
                              {filtered.map((sn, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onMouseDown={() => {
                                    updateItem(index, 'serialNumber', sn);
                                    setFocusedRowField(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 transition-colors font-mono font-bold flex items-center justify-between"
                                >
                                  <span>{sn}</span>
                                  <span className="text-[9px] font-sans font-semibold text-emerald-600 bg-emerald-100/60 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">in_stock</span>
                                </button>
                              ))}
                              {filtered.length === 0 && (
                                <div className="px-3 py-2 text-slate-400 italic text-center text-[10px]">
                                  {item.serialNumber ? `Use "${item.serialNumber}"` : 'No in-stock serials found'}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="sm:col-span-3">
                        <input 
                          type="text" 
                          className="w-full text-[11px] px-3 py-1.5 bg-slate-50/70 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1e5eb8] focus:bg-white transition-all placeholder:text-gray-400 font-normal text-gray-700"
                          placeholder="Details (Batch, Expiry, etc.)"
                          value={item.custom_box || ''}
                          onChange={(e) => updateItem(index, 'custom_box', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:flex md:flex-row gap-3 w-full md:w-auto items-end pt-3 md:pt-0 border-t border-slate-100 md:border-none">
                    {formData.columnVisibility.size && (
                      <div className="w-full md:w-20">
                        <label className="label block">Size</label>
                        <input 
                          type="text" 
                          className="input-field uppercase text-center" 
                          placeholder="L"
                          value={item.size || ''}
                          onChange={(e) => updateItem(index, 'size', e.target.value)}
                        />
                      </div>
                    )}
                    {formData.columnVisibility.hsn && (
                      <div className="w-full md:w-20">
                        <label className="label block">HSN</label>
                        <input 
                          type="text" 
                          className="input-field text-center" 
                          placeholder="HSN"
                          value={item.hsn || ''}
                          onChange={(e) => updateItem(index, 'hsn', e.target.value)}
                        />
                      </div>
                    )}
                    <div className="w-full md:w-20">
                      <label className="label block">{appMode === 'freelancer' ? 'Hours / Qty' : 'Qty'}</label>
                      <input 
                        type="number" 
                        className="input-field text-center" 
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          const cleaned = val.replace(/^0+(?=\d)/, '');
                          e.target.value = cleaned;
                          const newQty = Number(cleaned);

                          if (appMode !== 'freelancer' && item.description) {
                            const selected = inventoryItems.find(i => i.name.toLowerCase() === item.description.toLowerCase());
                            if (selected) {
                              const itemStock = typeof selected.stock === 'number' ? selected.stock : 0;
                              if (newQty > itemStock) {
                                playErrorBeepSound(soundEnabled);
                                alert(`⚠️ INSUFFICIENT STOCK!\n\nItem "${selected.name}" only has ${itemStock} unit(s) available in stock.`);
                                return;
                              }
                            }
                          }

                          updateItem(index, 'quantity', newQty);
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    {formData.columnVisibility.mrp && (
                      <div className="w-full md:w-24">
                        <label className="label block">MRP</label>
                        <input 
                          type="number" 
                          className="input-field" 
                          value={item.mrp || 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/^0+(?=\d)/, '');
                            e.target.value = cleaned;
                            const newMrp = Number(cleaned);
                            const discount = item.discount || 0;
                            const newPrice = newMrp * (1 - discount / 100);
                            updateItemBatch(index, {
                              mrp: newMrp,
                              price: Number(newPrice.toFixed(2))
                            });
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    )}
                    {formData.columnVisibility.discount && (
                      <div className="w-full md:w-20">
                        <label className="label block">Disc%</label>
                        <input 
                          type="number" 
                          className="input-field text-center" 
                          value={item.discount || 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/^0+(?=\d)/, '');
                            e.target.value = cleaned;
                            const disc = Number(cleaned);
                            const basePrice = item.mrp || item.price || 0;
                            const newPrice = basePrice * (1 - disc / 100);
                            updateItemBatch(index, {
                              discount: disc,
                              mrp: basePrice,
                              price: Number(newPrice.toFixed(2))
                            });
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    )}
                    {formData.columnVisibility.gstPercent && (
                      <div className="w-full md:w-20">
                        <label className="label block">GST%</label>
                        <input 
                          type="number" 
                          className="input-field text-center" 
                          value={item.gstPercent || 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/^0+(?=\d)/, '');
                            e.target.value = cleaned;
                            updateItem(index, 'gstPercent', Number(cleaned));
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    )}
                    <div className="w-full md:w-32 text-right relative">
                      <label className="label block">{appMode === 'freelancer' ? 'Hourly / Fee' : 'Net Rate'}</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={item.price}
                        onChange={(e) => {
                          const val = e.target.value;
                          const cleaned = val.replace(/^0+(?=\d)/, '');
                          e.target.value = cleaned;
                          const newPrice = Number(cleaned);
                          if ((item.discount || 0) === 0) {
                            updateItemBatch(index, {
                              price: newPrice,
                              mrp: newPrice
                            });
                          } else {
                            updateItem(index, 'price', newPrice);
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                      {/* Party-Wise Last Selling Price auto-memory badge */}
                      {(() => {
                        if (!formData.customer_id || !item.description) return null;
                        const prevInv = (existingInvoices || []).find((inv: any) => {
                          if (inv.customer_id !== formData.customer_id) return false;
                          if (inv.id === id) return false;
                          return Array.isArray(inv.items) && inv.items.some((it: any) => (it.description || '').trim().toLowerCase() === (item.description || '').trim().toLowerCase());
                        });
                        if (!prevInv) return null;
                        const prevItem = prevInv.items.find((it: any) => (it.description || '').trim().toLowerCase() === (item.description || '').trim().toLowerCase());
                        const lastPrice = Number(prevItem?.price || 0);
                        if (!lastPrice || lastPrice === item.price) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => updateItem(index, 'price', lastPrice)}
                            className="mt-1 text-[9px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 block text-right ml-auto transition-colors cursor-pointer"
                            title="Click to apply last selling price to this customer"
                          >
                            Last: ₹{lastPrice} (Apply)
                          </button>
                        );
                      })()}
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeItem(index)}
                      className="min-w-[44px] min-h-[44px] p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100/80 rounded-xl transition-all md:mb-1 shrink-0 flex items-center justify-center cursor-pointer active:scale-90"
                      title="Remove Item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            ))}
            <button 
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 text-sm font-bold text-neutral-900 border-b border-neutral-900 pb-1 mt-4"
            >
              <Plus size={16} />
              {appMode === 'freelancer' ? 'Add Service / Task' : 'Add Item'}
            </button>
          </div>
        </div>

        {/* Invoice Terms & Conditions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Terms &amp; Conditions / Notes for this Invoice
            </label>
            <span className="text-[11px] text-slate-500 font-medium">Prints at the bottom of the invoice</span>
          </div>
          <textarea
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all resize-y min-h-[90px] shadow-xs placeholder:text-slate-400"
            placeholder="Specify any terms, conditions, or customized notes for this specific invoice..."
            value={formData.notes || ''}
            onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 mt-1">
            <p className="text-[11px] text-slate-600 font-medium">
              Want to save this as default for all future invoices? (भविष्य के लिए डिफ़ॉल्ट सेट करें)
            </p>
            <button
              type="button"
              onClick={handleSaveAsDefault}
              disabled={savingDefaultTerms}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer self-end sm:self-auto",
                saveTermsSuccess 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600"
                  : "bg-green-600 hover:bg-green-700 text-white border border-green-600"
              )}
            >
              {savingDefaultTerms ? (
                <>
                  <Loader2 size={13} className="animate-spin text-white" />
                  Saving...
                </>
              ) : saveTermsSuccess ? (
                <>
                  <CheckCircle2 size={13} className="text-white animate-bounce" />
                  Saved as Default!
                </>
              ) : (
                <>
                  <Save size={13} className="text-white" />
                  Save as Default
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between card-base p-4 sm:p-8 gap-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-md">
          <div className="text-center md:text-left space-y-2 w-full md:w-auto">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wide">Total Amount</p>
            <div className="flex flex-wrap items-baseline gap-4 justify-center md:justify-start">
              <p className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {CURRENCIES.find(c => c.code === formData.currency)?.symbol || '$'}
                {(calculateTotal() || 0).toFixed(2)}
              </p>
              {(Number(formData.advance_amount) || 0) > 0 && (
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-left">
                  <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                    Advance: {CURRENCIES.find(c => c.code === formData.currency)?.symbol || '₹'}{(Number(formData.advance_amount) || 0).toFixed(2)}
                  </div>
                  <div className="text-sm font-black text-green-800 dark:text-green-300">
                    Balance Due: {CURRENCIES.find(c => c.code === formData.currency)?.symbol || '₹'}{Math.max(0, calculateTotal() - (Number(formData.advance_amount) || 0)).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
              <div className="flex flex-col">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Extra Discount (-)</label>
                <input 
                  type="number" 
                  className="w-28 px-3 py-1.5 border border-slate-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-green-500 shadow-xs"
                  value={formData.discount}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/^0+(?=\d)/, '');
                    e.target.value = cleaned;
                    setFormData(p => ({ ...p, discount: Number(cleaned) }));
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Sales Return (+)</label>
                <input 
                  type="number" 
                  className="w-28 px-3 py-1.5 border border-slate-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-green-500 shadow-xs"
                  value={formData.sales_return}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/^0+(?=\d)/, '');
                    e.target.value = cleaned;
                    setFormData(p => ({ ...p, sales_return: Number(cleaned) }));
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                  <span>Delivery / Shipping (+)</span>
                </label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-32 px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-300 font-bold focus:ring-2 focus:ring-blue-500 shadow-xs"
                  value={formData.shipping_charges || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/^0+(?=\d)/, '');
                    e.target.value = cleaned;
                    setFormData(p => ({ ...p, shipping_charges: Number(cleaned) }));
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400 mb-1 flex items-center gap-1">
                  <span>Advance Paid (-)</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">(एडवांस)</span>
                </label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-32 px-3 py-1.5 border border-emerald-500 dark:border-emerald-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-emerald-900 dark:text-emerald-300 font-bold focus:ring-2 focus:ring-emerald-500 shadow-xs"
                  value={formData.advance_amount || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/^0+(?=\d)/, '');
                    e.target.value = cleaned;
                    setFormData(p => ({ ...p, advance_amount: Number(cleaned) }));
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
          </div>
          {/* Desktop Actions (>= 768px) */}
          <div className="hidden md:flex md:items-center md:gap-3 md:w-auto">
            <button 
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, 'draft')}
              className="btn-secondary flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl transition-all h-11"
            >
              <Save size={16} />
              <span className="truncate">Draft</span>
            </button>
            <button 
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, 'paid', false, true)}
              className="bg-neutral-950 dark:bg-zinc-800 hover:bg-neutral-900 dark:hover:bg-zinc-750 text-white border border-neutral-900 dark:border-zinc-700 font-bold py-2 px-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 text-xs h-11"
              id="save-and-print-btn"
            >
              <Printer size={16} />
              <span className="truncate">Save & Print</span>
            </button>
            <button 
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, 'paid')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 text-xs h-11"
            >
              <CheckCircle2 size={16} />
              <span className="truncate">Paid</span>
            </button>
            <button 
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, 'sent')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 text-xs h-11"
            >
              <AlertCircle size={16} />
              <span className="truncate">Unpaid</span>
            </button>
            <button 
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, 'paid', true)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 text-xs h-11"
            >
              <Plus size={16} />
              <span className="truncate">Quick POS</span>
            </button>
            <button 
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, 'sent')}
              className="btn-primary flex items-center justify-center gap-1.5 py-2 px-2.5 shadow-lg shadow-neutral-900/10 text-xs font-bold rounded-xl transition-all h-11"
            >
              <Send size={16} />
              <span className="truncate">Send Invoice</span>
            </button>
          </div>

          {/* Mobile Actions (< 768px): Structured 2-Tier Stack */}
          <div className="flex md:hidden flex-col gap-2.5 w-full">
            {/* Primary Actions Row */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <button 
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, 'paid', false, true)}
                className="bg-neutral-950 dark:bg-zinc-800 hover:bg-neutral-900 dark:hover:bg-zinc-750 text-white border border-neutral-900 dark:border-zinc-700 font-bold py-3 px-3 rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-xs min-h-[48px]"
                id="save-and-print-btn-mobile"
              >
                <Printer size={16} />
                <span className="truncate">Save & Print</span>
              </button>
              <button 
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, 'paid')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-3 rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-xs min-h-[48px]"
              >
                <CheckCircle2 size={16} />
                <span className="truncate">Mark Paid</span>
              </button>
            </div>

            {/* Secondary Actions 4-Column Grid */}
            <div className="grid grid-cols-4 gap-1.5 w-full">
              <button 
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, 'draft')}
                className="btn-secondary flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-bold rounded-xl transition-all min-h-[44px] active:scale-95"
              >
                <Save size={14} />
                <span className="truncate">Draft</span>
              </button>
              <button 
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, 'sent')}
                className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-bold rounded-xl transition-all min-h-[44px] active:scale-95"
              >
                <AlertCircle size={14} />
                <span className="truncate">Unpaid</span>
              </button>
              <button 
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, 'paid', true)}
                className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-bold rounded-xl transition-all min-h-[44px] active:scale-95"
              >
                <Plus size={14} />
                <span className="truncate">POS</span>
              </button>
              <button 
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, 'sent')}
                className="btn-primary flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-bold rounded-xl transition-all min-h-[44px] active:scale-95 shadow-xs"
              >
                <Send size={14} />
                <span className="truncate">Send</span>
              </button>
            </div>
          </div>
        </div>
      </form>

            <AnimatePresence>
       <div className={cn("fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300", showScanner ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
         <motion.div
           animate={{ opacity: showScanner ? 1 : 0 }}
           onClick={() => setShowScanner(false)}
           className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
         />
         <motion.div
           animate={showScanner ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.95 }}
           transition={{ type: "spring", damping: 25, stiffness: 350 }}
           className="relative w-full max-w-md bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl overflow-hidden"
         >
           <div className="p-4 sm:p-5">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center">
                   <ScanLine size={18} className="animate-pulse" />
                 </div>
                 <div>
                   <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                     Barcode Scanner
                     <span className="text-[10px] font-black uppercase tracking-wider bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">Auto-Detect</span>
                   </h2>
                 </div>
               </div>
               <div className="flex items-center gap-1.5 shrink-0">
                 <button 
                   type="button"
                   onClick={() => setShowHelpGuide(!showHelpGuide)}
                   className={cn(
                     "w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200",
                     showHelpGuide 
                       ? "bg-green-500/20 text-green-400 border border-green-500/30"
                       : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                   )}
                   title="Setup & Connection Guide"
                 >
                   <HelpCircle size={16} />
                 </button>
                 <button 
                   onClick={() => setShowScanner(false)}
                   className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                 >
                   <X size={18} />
                 </button>
               </div>
             </div>

             {showHelpGuide ? (
               <div className="max-h-[440px] overflow-y-auto pr-1">
                 <ScannerHelpGuide />
               </div>
             ) : (
               <>
                
              {mobileScannerConnected ? (
                <div className="mb-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-3 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-black text-xs uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    Mobile Phone Scanner Connected!
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Phone scanner is actively connected. Scan barcodes directly from your phone!
                  </p>
                </div>
              ) : (
                /* Scanner Source Selector Tabs */
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-3">
                  <button
                    type="button"
                    onClick={() => setScannerSource('pc-camera')}
                    className={cn(
                      "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                      scannerSource === 'pc-camera'
                        ? "bg-slate-850 text-green-400 border border-slate-700/60 shadow-sm font-extrabold"
                        : "text-slate-400 hover:text-white"
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
                        ? "bg-slate-850 text-green-400 border border-slate-700/60 shadow-sm font-extrabold"
                        : "text-slate-400 hover:text-white"
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
                        ? "bg-slate-850 text-green-400 border border-slate-700/60 shadow-sm font-extrabold"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    <Phone size={13} />
                    <span>Mobile Cam</span>
                  </button>
                </div>
              )}

              {/* USB Hardware / Manual Barcode Input Bar */}
              <div className="mb-3 relative flex items-center">
                <Barcode className="absolute left-3.5 text-green-400 pointer-events-none" size={18} />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && barcodeInput.trim()) {
                      handleScannedBarcode(barcodeInput.trim());
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
                  className="w-full bg-slate-800/90 text-white placeholder-slate-400 text-xs font-medium pl-10 pr-9 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-inner"
                  autoFocus={scannerSource === 'usb-gun'}
                />
                {barcodeInput ? (
                  <button
                    type="button"
                    onClick={() => setBarcodeInput('')}
                    className="absolute right-3 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <div className="absolute right-3 hidden sm:flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-700/50 px-1.5 py-0.5 rounded">
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
                    const el = document.getElementById("qr-reader");
                    triggerCameraRefocus(el);
                  }}
                  className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[280px] sm:h-[320px] w-full flex flex-col items-center justify-center cursor-pointer select-none"
                >
                  <div id="qr-reader" className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />
                  
                  {/* Tap focus ring indicator */}
                  {tapFocusPos && (
                    <div 
                      style={{ left: tapFocusPos.x - 20, top: tapFocusPos.y - 20 }}
                      className="absolute w-10 h-10 rounded-full border-2 border-green-400 bg-green-400/20 z-30 pointer-events-none animate-ping"
                    />
                  )}

                  {/* Floating Overlay Controls inside Camera Viewfinder */}
                  {cameraActive && !cameraError && (
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                      {/* Beep Audio Toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSound();
                        }}
                        className={cn(
                          "h-9 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 backdrop-blur-md shadow-lg text-xs font-bold",
                          soundEnabled
                            ? "bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30"
                            : "bg-slate-900/80 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200"
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
                          const el = document.getElementById("qr-reader");
                          const nextState = !torchOn;
                          const ok = await setCameraTorch(el, nextState);
                          if (ok) setTorchOn(nextState);
                        }}
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 backdrop-blur-md shadow-lg",
                          torchOn
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-slate-900/80 text-slate-200 border-slate-700/80 hover:bg-slate-800"
                        )}
                        title="Toggle Flash"
                      >
                        <Zap size={16} className={torchOn ? "fill-current" : ""} />
                      </button>

                      {/* Zoom Toggle */}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const nextZoom = currentZoom === 1.0 ? 1.4 : currentZoom === 1.4 ? 2.0 : 1.0;
                          setCurrentZoom(nextZoom);
                          const el = document.getElementById("qr-reader");
                          await setCameraZoom(el, nextZoom);
                        }}
                        className="h-9 px-2.5 rounded-xl bg-slate-900/80 text-green-400 border border-slate-700/80 backdrop-blur-md font-extrabold text-xs flex items-center justify-center transition-all active:scale-95 shadow-lg"
                        title="Toggle Zoom"
                      >
                        {currentZoom}x
                      </button>
                    </div>
                  )}

                  {/* Target Frame Overlay */}
                  {cameraActive && !cameraError && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                      <div className="relative w-[240px] h-[120px] border-2 border-green-400/60 rounded-2xl overflow-hidden bg-black/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.70)]">
                        <div className="scanner-laser-line" />
                        <div className="scanner-laser-glow" />
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-300 rounded-tl-md" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-300 rounded-tr-md" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-300 rounded-bl-md" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-300 rounded-br-md" />
                      </div>
                    </div>
                  )}

                  {!cameraActive && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-950 z-20 p-4 text-center">
                      <Loader2 className="animate-spin text-green-400 mb-2" size={24} />
                      <p className="text-xs font-bold text-slate-300">Starting camera...</p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-400 bg-[#060c18] z-20 p-6 text-center">
                      <Camera className="mb-3 text-pink-500 animate-pulse" size={36} />
                      <p className="text-white font-bold text-base md:text-lg mb-4 max-w-[280px] leading-snug">
                        Camera could not be started. Please grant permission.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          setCameraError(null);
                          const res = await requestExplicitCameraPermission();
                          if (res.success) setCameraActive(true);
                          else setCameraError(res.error || "Permission denied.");
                        }}
                        className="px-6 py-3 bg-[#00d09c] hover:bg-green-300 text-slate-950 font-black text-xs md:text-sm rounded-full shadow-lg shadow-green-500/20 transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2"
                      >
                        <Camera size={16} /> Allow Camera Access
                      </button>
                    </div>
                  )}
                </div>
              ) : scannerSource === 'usb-gun' ? (
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950 h-[280px] sm:h-[320px] w-full flex flex-col items-center justify-center p-6 text-center select-none">
                  <div className="absolute inset-0 bg-radial-gradient from-green-500/5 to-transparent pointer-events-none" />
                  
                  <div className="w-[180px] h-[80px] border border-slate-800/80 rounded-2xl bg-slate-900/60 flex items-center justify-center relative overflow-hidden mb-6 shadow-inner">
                    <Barcode className="text-slate-600" size={54} />
                    <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                  </div>

                  <h3 className="text-xs font-black uppercase tracking-widest text-green-400 mb-1.5">USB Scanner Gun Ready</h3>
                  <p className="text-[11px] text-slate-400 font-bold max-w-[270px] leading-relaxed">
                    Connect your physical USB gun. Place your computer's cursor inside the input field above, point your scanner gun at the item's barcode, and press the trigger button.
                  </p>
                </div>
              ) : (
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950 min-h-[300px] py-6 px-5 w-full flex flex-col items-center justify-center text-center select-none">
                  <div className="absolute inset-0 bg-radial-gradient from-green-500/5 to-transparent pointer-events-none" />

                  {mobileScannerConnected ? (
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3 shadow-lg animate-pulse">
                        <CheckCircle2 size={32} className="fill-current" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-1.5 flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mr-1" />
                        Phone Scanner Connected!
                      </h3>
                      <p className="text-[11px] text-slate-300 font-bold max-w-[270px] leading-normal mb-4">
                        Aapka phone successfully connect ho chuka hai! Point your phone camera at any barcode to automatically scan and enter items.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center w-full">
                      {/* Beautiful QR Code representation */}
                      <div className="bg-white p-2.5 rounded-2xl shadow-xl mb-3 border border-slate-200">
                        <QRCodeSVG value={`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`} size={120} />
                      </div>

                      <h3 className="text-xs font-black uppercase tracking-widest text-amber-500 mb-1 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Scan QR Code to Connect
                      </h3>
                      <p className="text-[11px] text-slate-300 font-bold max-w-[290px] leading-snug mb-3">
                        Apne phone ka camera open karke is QR code ko scan karein. Camera open hote hi scanning shuru ho jayegi!
                      </p>

                      <div className="w-full max-w-sm mt-1">
                        <p className="text-[8.5px] text-slate-500 font-black uppercase tracking-widest mb-1 text-center">Or open this link on your phone:</p>
                        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 items-center justify-between">
                          <code className="text-[9.5px] text-green-400 font-mono pl-2 text-left overflow-x-auto whitespace-nowrap scrollbar-none w-full mr-2">
                            {`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-[8.5px] uppercase tracking-wider font-extrabold px-2.5 py-1.5 rounded-lg text-slate-300 shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Camera Switcher Footer */}
              {scannerSource === 'pc-camera' && (
                <div className="mt-3 flex items-center justify-between gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Camera:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCameraMode('environment')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all",
                        cameraMode === 'environment'
                          ? "bg-green-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Rear Cam
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraMode('user')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all",
                        cameraMode === 'user'
                          ? "bg-green-500 text-slate-950 shadow-sm"
                           : "text-slate-400 hover:text-white"
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

      {/* Quick Add Customer Modal */}
      <AnimatePresence>
        {showAddCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddCustomerModal(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">Quick Add Customer</h2>
                  <button 
                    onClick={() => setShowAddCustomerModal(false)}
                    className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddCustomer} className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label block mb-0">Full Name</label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={startVoiceRecognition}
                              className={`p-1 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                              title="Voice Input"
                            >
                              <Mic size={14} />
                            </button>
                            {'contacts' in navigator && 'ContactsManager' in window && (
                              <button
                                type="button"
                                onClick={pickContact}
                                className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                                title="Select from Contacts"
                              >
                                <Contact size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <input 
                          type="text" 
                          required
                          className="input-field" 
                          placeholder="John Doe"
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label block">Company Name</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Acme Corp"
                          value={newCustomer.company_name}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, company_name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label block">GST Number (Optional)</label>
                        <input 
                          type="text" 
                          className="input-field uppercase" 
                          placeholder="22AAAAA0000A1Z5"
                          value={newCustomer.gst_number}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, gst_number: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label block">Email Address</label>
                        <input 
                          type="email" 
                          className="input-field" 
                          placeholder="john@example.com"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label block">Phone</label>
                        <input 
                          type="tel" 
                          className="input-field" 
                          placeholder="+91 98765 43210"
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label block">Address</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="City, State, Country"
                          value={newCustomer.address}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Custom Party Details Section */}
                    <div className="pt-4 border-t border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag size={16} className="text-green-600" />
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Custom Party Details / Specific Fields
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddQuickCustomField()}
                          className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200/80 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={13} /> Add Field
                        </button>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-[11px] text-slate-400 font-semibold self-center mr-1">Quick Add:</span>
                        {PRESET_CUSTOM_LABELS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleAddQuickCustomField(preset)}
                            className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-green-50 hover:text-green-700 border border-slate-200 px-2 py-0.5 rounded transition-all cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>

                      {quickCustomFields.length > 0 && (
                        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          {quickCustomFields.map((field) => (
                            <div key={field.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Field Label (e.g. PAN)"
                                value={field.label}
                                onChange={(e) => handleUpdateQuickCustomField(field.id, 'label', e.target.value)}
                                className="input-field h-8 text-xs flex-1 bg-white"
                              />
                              <input
                                type="text"
                                placeholder="Value (e.g. ABCDE1234F)"
                                value={field.value}
                                onChange={(e) => handleUpdateQuickCustomField(field.id, 'value', e.target.value)}
                                className="input-field h-8 text-xs flex-1 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveQuickCustomField(field.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded shrink-0 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowAddCustomerModal(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isAddingCustomer}
                      className="btn-primary flex-1"
                    >
                      {isAddingCustomer ? 'Adding...' : 'Add Customer'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
