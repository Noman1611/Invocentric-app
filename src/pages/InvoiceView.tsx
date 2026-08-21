import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { useParams, Link, useNavigate } from 'react-router-dom';
import React, { useEffect, useState, useRef } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, query, where, collection, getDocs } from 'firebase/firestore';
import { dbService, findLinkedPayments } from '../services/dbService';
import { formatCurrency, cn, normalizePhoneNumber, isMobile, getWhatsAppShareUrl, getWhatsAppWebUrl, getWhatsAppAppUrl, getInvoiceDisplayNumber } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { toWords } from 'number-to-words';
import { ImageIcon, ArrowLeft, Printer, Download, CheckCircle2, Loader2, Loader2 as Loader, Edit3, Wallet, Phone, Instagram, Facebook, Globe, Copy, Check, UploadCloud, Trash2, Share2, Send, X, Sliders, Palette, Layout as LayoutIcon, Save, Undo2, Redo2, Move, Maximize2, Minimize2, Eye, EyeOff, Type, RotateCcw, ZoomIn, ZoomOut, ChevronDown, Wand2, Code2 } from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { useTemplates } from '../hooks/useData';
import { Logo } from '../components/Logo';
import { WhatsAppShareModal } from '../components/WhatsAppShareModal';
import { WhatsAppIcon } from '../components/WhatsAppIcon';

const safeToWords = (value: number, currency: string = 'INR'): string => {
  try {
    const valFloor = Math.floor(value);
    if (isFinite(valFloor) && !isNaN(valFloor) && valFloor >= 0) {
      const words = toWords(valFloor);
      const currencyWord = currency === 'INR' ? 'RUPEES' : currency;
      return `${words} ${currencyWord} ONLY`.toUpperCase();
    }
  } catch (err) {
    console.warn("toWords failed in InvoiceView:", err);
  }
  return '';
};

const ColumnResizeHandle = ({
  colKey,
  nextColKey,
  onStartResize,
  className = ""
}: {
  colKey: string;
  nextColKey?: string;
  onStartResize: (currKey: string, nextKey: string | undefined, e: React.MouseEvent) => void;
  className?: string;
}) => (
  <div
    onMouseDown={(e) => onStartResize(colKey, nextColKey, e)}
    className={cn(
      "absolute top-0 right-0 bottom-0 w-3 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden select-none flex items-center justify-center",
      className
    )}
    title="Drag vertical divider line to resize column width"
  >
    <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
);

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, appMode, isOfflineMode, isPro, isAdmin } = useAuth();
  const isHardcodedAdmin = user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const canDeleteTemplates = isAdmin || isHardcodedAdmin;
  const [rawInvoice, setInvoice] = useState<any>(null);
  const [rawCustomer, setRawCustomer] = useState<any>(null);
  const [rawSellerInfo, setRawSellerInfo] = useState<any>(null);

  const setCustomer = setRawCustomer;
  const setSellerInfo = setRawSellerInfo;

  const isSubReceipt = !!rawInvoice?.is_subscription_receipt;

  const sellerInfo = isSubReceipt ? {
    business_name: 'InvoCentric Inc.',
    owner_name: 'Shekh Mahammad Noman',
    address: 'Vercel App Platform, Mumbai, Maharashtra, India',
    phone: 'N/A',
    email: 'billing@invocentric.com',
    gstin: '27AAAAA1111A1Z1',
    upi_id: 'shekhnoman@sbi',
    logo_url: null,
    signature_url: null,
  } : rawSellerInfo;

  const customer = isSubReceipt ? {
    name: rawSellerInfo?.business_name || user?.displayName || 'InvoCentric Pro Subscriber',
    phone: rawSellerInfo?.phone || user?.phoneNumber || '',
    address: rawSellerInfo?.address || '',
    gst_number: rawSellerInfo?.gstin || '',
    company_name: rawSellerInfo?.business_name || '',
    email: rawSellerInfo?.email || user?.email || '',
  } : rawCustomer;
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [generatedImageBlob, setGeneratedImageBlob] = useState<Blob | null>(null);
  const [generatedImageFileName, setGeneratedImageFileName] = useState<string>('');
  const [whatsAppShareText, setWhatsAppShareText] = useState<string>('');
  const [whatsAppUrlState, setWhatsAppUrlState] = useState<string>('');
  const [whatsAppWebUrlState, setWhatsAppWebUrlState] = useState<string>('');
  const [whatsAppAppUrlState, setWhatsAppAppUrlState] = useState<string>('');
  const [useLetterheadMode, setUseLetterheadMode] = useState(false);
  const [letterheadSpacerHeight, setLetterheadSpacerHeight] = useState(210); // in pixels
  const [customLetterhead, setCustomLetterhead] = useState<string | null>(() => {
    return localStorage.getItem('custom_letterhead_image') || null;
  });
  const [letterheadType, setLetterheadType] = useState<'header' | 'full'>(() => {
    return (localStorage.getItem('custom_letterhead_type') as 'header' | 'full') || 'header';
  });

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      setCustomLetterhead(base64String);
      localStorage.setItem('custom_letterhead_image', base64String);

      if (invoice?.user_id) {
        try {
          const userDocRef = doc(db, 'users', invoice.user_id);
          await updateDoc(userDocRef, {
            letterhead_image: base64String,
            letterhead_type: letterheadType
          });
        } catch (err) {
          console.error("Error saving letterhead to Firestore:", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLetterhead = async () => {
    setCustomLetterhead(null);
    localStorage.removeItem('custom_letterhead_image');
    if (invoice?.user_id) {
      try {
        const userDocRef = doc(db, 'users', invoice.user_id);
        await updateDoc(userDocRef, {
          letterhead_image: null
        });
      } catch (err) {
        console.error("Error removing letterhead from Firestore:", err);
      }
    }
  };

  const handleLetterheadTypeChange = async (type: 'header' | 'full') => {
    setLetterheadType(type);
    localStorage.setItem('custom_letterhead_type', type);
    if (invoice?.user_id) {
      try {
        const userDocRef = doc(db, 'users', invoice.user_id);
        await updateDoc(userDocRef, {
          letterhead_type: type
        });
      } catch (err) {
        console.error("Error updating letterhead type in Firestore:", err);
      }
    }
  };
  const invoiceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const printTriggered = useRef(false);
  const shareTriggered = useRef(false);
  const initialTemplateSetRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1.15);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [paperSize, setPaperSize] = useState<'a4' | 'a5'>('a4');
  const [template, setTemplate] = useState<string>('tally_prime_gst');
  const [customTemplate, setCustomTemplate] = useState<any>(null);
  const { templates: userCustomTemplates } = useTemplates();

  // Tally & GST Customizable Layout State (Khadi & Aadi Lines + Header Branding)
  const [tallyConfig, setTallyConfig] = useState<any>({
    slNoWidth: 6,
    descWidth: 36,
    sizeWidth: 6,
    hsnWidth: 10,
    qtyWidth: 8,
    mrpWidth: 10,
    rateWidth: 12,
    amtWidth: 18,
    cgstWidth: 6,
    sgstWidth: 6,
    igstWidth: 8,
    discWidth: 6,
    totalWidth: 12,
    tableMinHeight: 380,
    emptyRowsCount: 0,
    headerSplitRatio: 50,
    rowPadding: 'py-1',
    borderThickness: 'border-2',
    borderColor: '#000000',
    showLogo: true,
    logoPosition: 'left',
    logoHeight: 60,
    showPhone: true,
    showEmail: true,
    showAddress: true,
    showGstin: true,
    showPan: true,
    showStateCode: true,
    invoiceTitle: 'TAX INVOICE',
    copySubtitle: 'ORIGINAL FOR RECIPIENT'
  });

  const [isTallyCustomizerOpen, setIsTallyCustomizerOpen] = useState(false);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [saveLayoutSuccess, setSaveLayoutSuccess] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("Logo size should be less than 1MB. Please choose a smaller image.");
      if (e.target) e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Logo = reader.result as string;
      try {
        setIsUploadingLogo(true);
        // 1. Update in-memory state
        setSellerInfo((prev: any) => ({ ...prev, logo_url: base64Logo }));
        setTallyConfig((prev: any) => ({ ...prev, showLogo: true }));

        // 2. Persist to Firestore / Local Storage
        if (user?.uid) {
          if (!isOfflineMode) {
            try {
              await updateDoc(doc(db, "users", user.uid), { logo_url: base64Logo });
            } catch (dberr) {
              console.warn("Could not direct update user doc, trying dbService:", dberr);
              await dbService.update("users", user.uid, { logo_url: base64Logo }, { offlineMode: false, userId: user.uid });
            }
          }
          const localProfile = getSecureStorage(`offline_profile_${user.uid}`, {});
          setSecureStorage(`offline_profile_${user.uid}`, { ...(typeof localProfile === "object" ? localProfile : {}), logo_url: base64Logo });
          const userProfile = getSecureStorage(`user_profile_${user.uid}`, {});
          setSecureStorage(`user_profile_${user.uid}`, { ...(typeof userProfile === "object" ? userProfile : {}), logo_url: base64Logo });
        }

        window.dispatchEvent(new Event("user_profile_updated"));
        showToast("Company logo updated successfully!");
      } catch (err) {
        console.error("Error saving logo:", err);
        showToast("Failed to save logo", "error");
      } finally {
        setIsUploadingLogo(false);
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm("Are you sure you want to remove your company logo?")) return;
    try {
      setIsUploadingLogo(true);
      setSellerInfo((prev: any) => ({ ...prev, logo_url: "" }));
      if (user?.uid) {
        if (!isOfflineMode) {
          try {
            await updateDoc(doc(db, "users", user.uid), { logo_url: "" });
          } catch (dberr) {
            await dbService.update("users", user.uid, { logo_url: "" }, { offlineMode: false, userId: user.uid });
          }
        }
        const localProfile = getSecureStorage(`offline_profile_${user.uid}`, {});
        setSecureStorage(`offline_profile_${user.uid}`, { ...(typeof localProfile === "object" ? localProfile : {}), logo_url: "" });
        const userProfile = getSecureStorage(`user_profile_${user.uid}`, {});
        setSecureStorage(`user_profile_${user.uid}`, { ...(typeof userProfile === "object" ? userProfile : {}), logo_url: "" });
      }
      window.dispatchEvent(new Event("user_profile_updated"));
      showToast("Company logo removed");
    } catch (err) {
      console.error("Error removing logo:", err);
      showToast("Failed to remove logo", "error");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Full Customize Mode Layer State (Drag, Resize, Inline Edit, History Undo/Redo)
  const [isCustomizeMode, setIsCustomizeMode] = useState<boolean>(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState<boolean>(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [customizeTab, setCustomizeTab] = useState<'toggles' | 'selected' | 'lines'>('toggles');
  const [layoutOverrides, setLayoutOverrides] = useState<Record<string, any>>({});

  // History Stack for Undo/Redo
  const [history, setHistory] = useState<Record<string, any>[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isOverridesInitializedRef = useRef(false);

  // Load layout overrides from invoice/user storage
  useEffect(() => {
    if (isOverridesInitializedRef.current) return;
    const loadedOverrides = rawInvoice?.layout_overrides || sellerInfo?.layout_overrides;
    if (loadedOverrides && Object.keys(loadedOverrides).length > 0) {
      setLayoutOverrides(loadedOverrides);
      setHistory([loadedOverrides]);
      setHistoryIndex(0);
      isOverridesInitializedRef.current = true;
    } else if (rawInvoice || sellerInfo) {
      setHistory([{}]);
      setHistoryIndex(0);
      isOverridesInitializedRef.current = true;
    }
  }, [rawInvoice?.layout_overrides, sellerInfo?.layout_overrides, id]);

  // Reset initialization flag when switching invoices
  useEffect(() => {
    isOverridesInitializedRef.current = false;
  }, [id]);

  const pushHistory = (newOverrides: Record<string, any>) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newOverrides);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setLayoutOverrides(newOverrides);
  };

  const updateOverride = (id: string, updates: any) => {
    const current = layoutOverrides[id] || {};
    const updated = {
      ...layoutOverrides,
      [id]: { ...current, ...updates }
    };
    pushHistory(updated);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setLayoutOverrides(history[prevIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setLayoutOverrides(history[nextIndex]);
    }
  };

  const handleResetElement = (id: string) => {
    const newOverrides = { ...layoutOverrides };
    delete newOverrides[id];
    pushHistory(newOverrides);
  };

  const handleDeleteOverride = (id: string) => {
    updateOverride(id, { hidden: true });
  };

  const downloadLayoutSettings = () => {
    try {
      const settings = {
        layoutOverrides,
        tallyConfig
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `invoice_layout_settings_${id || 'default'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Layout settings exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to export settings", "error");
    }
  };

  const uploadLayoutSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && typeof parsed === 'object') {
            if (parsed.layoutOverrides) {
              setLayoutOverrides(parsed.layoutOverrides);
              setHistory([parsed.layoutOverrides]);
              setHistoryIndex(0);
            }
            if (parsed.tallyConfig) {
              setTallyConfig((prev: any) => ({ ...prev, ...parsed.tallyConfig }));
            }
            showToast("Layout settings uploaded successfully!", "success");
          } else {
            showToast("Invalid settings file format.", "error");
          }
        } catch (err) {
          console.error(err);
          showToast("Error parsing settings file.", "error");
        }
      };
    }
  };

  // Keyboard shortcut listener (Ctrl+Z / Cmd+Z -> Undo, Ctrl+Y / Cmd+Shift+Z -> Redo)
  useEffect(() => {
    if (!isCustomizeMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCustomizeMode, historyIndex, history]);

  const saveLayout = async () => {
    setIsSavingLayout(true);
    try {
      const activeUserId = user?.uid || rawInvoice?.user_id;
      if (activeUserId && !isOfflineMode) {
        const userDocRef = doc(db, 'users', activeUserId);
        await updateDoc(userDocRef, {
          layout_overrides: layoutOverrides,
          tally_config: tallyConfig
        });
        if (id) {
          const invDocRef = doc(db, 'invoices', id);
          await updateDoc(invDocRef, {
            layout_overrides: layoutOverrides,
            tally_config: tallyConfig
          });
        }
      } else if (isOfflineMode && user) {
        const localProfile = getSecureStorage(`offline_profile_${user.uid}`, {});
        setSecureStorage(`offline_profile_${user.uid}`, { 
          ...localProfile, 
          layout_overrides: layoutOverrides,
          tally_config: tallyConfig 
        });
      }
      setSaveLayoutSuccess(true);
      setTimeout(() => setSaveLayoutSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving layout customization:", err);
    } finally {
      setIsSavingLayout(false);
    }
  };

  // Draggable and Resizable Interactive Section Wrapper
  const DraggableBox: React.FC<{
    id: string;
    label: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }> = ({ id, label, children, className = '', style = {} }) => {
    const override: any = layoutOverrides[id] || {};
    const isSelected = selectedElementId === id;

    const [isDragging, setIsDragging] = useState(false);

    if (override.hidden) return null;

    // Drag position logic
    const handleMouseDownDrag = (e: React.MouseEvent) => {
      if (!isCustomizeMode) return;
      e.stopPropagation();
      setSelectedElementId(id);

      setIsDragging(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const initialX = override.x || 0;
      const initialY = override.y || 0;

      const handleMouseMove = (moveEv: MouseEvent) => {
        const deltaX = moveEv.clientX - startX;
        const deltaY = moveEv.clientY - startY;
        updateOverride(id, {
          x: Math.round(initialX + deltaX),
          y: Math.round(initialY + deltaY)
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    // Resize handles logic
    const handleMouseDownResize = (dir: string, e: React.MouseEvent) => {
      if (!isCustomizeMode) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedElementId(id);

      const startX = e.clientX;
      const startY = e.clientY;
      const initialWidth = override.width || 300;
      const initialHeight = override.height || 100;

      const handleMouseMove = (moveEv: MouseEvent) => {
        const deltaX = moveEv.clientX - startX;
        const deltaY = moveEv.clientY - startY;

        const updates: any = {};
        if (dir.includes('r')) {
          updates.width = Math.max(80, initialWidth + deltaX);
        }
        if (dir.includes('b')) {
          updates.height = Math.max(30, initialHeight + deltaY);
        }
        updateOverride(id, updates);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    const baseStyle: any = style || {};
    const computedStyle: React.CSSProperties = {
      ...style,
      position: (override.x !== undefined || override.y !== undefined) ? 'relative' : (baseStyle.position || 'relative'),
      left: override.x ? `${override.x}px` : undefined,
      top: override.y ? `${override.y}px` : undefined,
      width: override.width ? `${override.width}px` : baseStyle.width,
      height: override.height ? `${override.height}px` : baseStyle.height,
      borderWidth: override.borderWidth !== undefined ? `${override.borderWidth}px` : undefined,
      fontSize: override.fontSize ? `${override.fontSize}px` : undefined,
      padding: override.padding !== undefined ? `${override.padding}px` : undefined,
    };

    return (
      <div
        onClick={(e) => {
          if (isCustomizeMode) {
            e.stopPropagation();
            setSelectedElementId(id);
          }
        }}
        style={computedStyle}
        className={cn(
          className,
          isCustomizeMode && "relative group transition-all select-none cursor-pointer",
          isCustomizeMode && isSelected && "ring-2 ring-green-600 ring-offset-2 z-20 bg-green-50/15 shadow-green-100 shadow-md",
          isCustomizeMode && !isSelected && "hover:ring-2 hover:ring-green-400 hover:ring-dashed hover:bg-slate-50/50",
          isDragging && "opacity-80 z-30 scale-[1.01]"
        )}
      >
        {/* Selection Corners Highlight for Active Component */}
        {isCustomizeMode && isSelected && (
          <div className="absolute inset-0 pointer-events-none z-20 border-2 border-green-600 border-dashed animate-pulse-subtle">
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-green-600 rounded-sm" />
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-green-600 rounded-sm" />
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-green-600 rounded-sm" />
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-green-600 rounded-sm" />
          </div>
        )}

        {/* Floating Context Menu Toolbar */}
        {isCustomizeMode && isSelected && (
          <div 
            className="absolute -top-10 right-0 bg-slate-900 border border-slate-700/90 text-white rounded-xl py-1 px-2.5 shadow-2xl z-40 flex items-center gap-2.5 text-[10px] font-semibold print:hidden pointer-events-auto select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 border-r border-slate-800 pr-2">
              <span className="text-[9px] text-green-400 font-extrabold tracking-wider uppercase bg-green-950/80 px-1.5 py-0.5 rounded border border-green-900/60">
                {label}
              </span>
            </div>

            {/* Quick Border Thickness selection */}
            <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
              <span className="text-slate-400 text-[9px]">Border:</span>
              {[0, 1, 2, 3].map((b) => (
                <button
                  key={b}
                  onClick={() => updateOverride(id, { borderWidth: b })}
                  className={cn(
                    "w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center transition-all",
                    (override.borderWidth ?? 1) === b
                      ? "bg-green-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                  title={`Set border thickness to ${b}px`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Quick Font Size Controls */}
            <div className="flex items-center gap-1.5 border-r border-slate-800 pr-2">
              <span className="text-slate-400 text-[9px]">Font:</span>
              <button
                onClick={() => {
                  const currFs = override.fontSize || 12;
                  updateOverride(id, { fontSize: Math.max(8, currFs - 1) });
                }}
                className="w-4 h-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center justify-center text-[10px] font-bold"
                title="Decrease font size"
              >
                -
              </button>
              <span className="font-bold text-green-300 min-w-[14px] text-center">
                {override.fontSize || 12}
              </span>
              <button
                onClick={() => {
                  const currFs = override.fontSize || 12;
                  updateOverride(id, { fontSize: Math.min(24, currFs + 1) });
                }}
                className="w-4 h-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center justify-center text-[10px] font-bold"
                title="Increase font size"
              >
                +
              </button>
            </div>

            {/* Quick Reset Layout of this element */}
            <button
              onClick={() => handleResetElement(id)}
              className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-all flex items-center gap-0.5"
              title="Reset position and size to default"
            >
              <RotateCcw size={11} className="text-amber-400" />
              <span>Reset</span>
            </button>

            {/* Quick Delete / Hide Layout Overrides */}
            <button
              onClick={() => handleDeleteOverride(id)}
              className="p-1 hover:bg-rose-950 hover:text-rose-400 rounded text-rose-300 transition-all flex items-center gap-0.5 border-l border-slate-800 pl-2"
              title="Hide this layout section"
            >
              <Trash2 size={11} className="text-rose-400" />
              <span>Hide</span>
            </button>
          </div>
        )}

        {/* Customize Badge & Drag Handle */}
        {isCustomizeMode && (
          <div className="absolute -top-3 left-2 bg-green-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-md z-30 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity print:hidden">
            <span 
              onMouseDown={handleMouseDownDrag} 
              className="cursor-move hover:text-green-200 flex items-center gap-1"
              title="Click and drag to move section"
            >
              <Move size={10} /> {label}
            </span>
          </div>
        )}

        {/* Resize Handles */}
        {isCustomizeMode && isSelected && (
          <>
            {/* Right Handle */}
            <div
              onMouseDown={(e) => handleMouseDownResize('r', e)}
              className="absolute top-0 right-0 bottom-0 w-2 bg-green-600/50 hover:bg-green-600 cursor-ew-resize z-30 print:hidden transition-all"
              title="Drag to resize width"
            />
            {/* Bottom Handle */}
            <div
              onMouseDown={(e) => handleMouseDownResize('b', e)}
              className="absolute left-0 right-0 bottom-0 h-2 bg-green-600/50 hover:bg-green-600 cursor-ns-resize z-30 print:hidden transition-all"
              title="Drag to resize height"
            />
            {/* Corner Handle */}
            <div
              onMouseDown={(e) => handleMouseDownResize('rb', e)}
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-700 border-2 border-white rounded-full cursor-nwse-resize z-40 print:hidden shadow-md"
              title="Drag corner to resize width and height"
            />
          </>
        )}

        {children}
      </div>
    );
  };

  useEffect(() => {
    const loadedConfig = rawInvoice?.tally_config || sellerInfo?.tally_config;
    if (loadedConfig) {
      setTallyConfig((prev: any) => ({ ...prev, ...loadedConfig }));
    }
  }, [sellerInfo?.tally_config, rawInvoice?.tally_config]);

  const getColWidthKey = (colKey: string) => {
    switch (colKey) {
      case 'slNo': return 'slNoWidth';
      case 'desc': return 'descWidth';
      case 'size': return 'sizeWidth';
      case 'hsn': return 'hsnWidth';
      case 'qty': return 'qtyWidth';
      case 'mrp': return 'mrpWidth';
      case 'rate': return 'rateWidth';
      case 'amt':
      case 'taxable': return 'amtWidth';
      case 'cgst': return 'cgstWidth';
      case 'sgst': return 'sgstWidth';
      case 'igst':
      case 'gst': return 'igstWidth';
      case 'disc':
      case 'discount': return 'discWidth';
      case 'total': return 'totalWidth';
      default: return `${colKey}Width`;
    }
  };

  const getColMinWidth = (colKey: string) => {
    switch (colKey) {
      case 'slNo': return 3;
      case 'desc': return 15;
      case 'size': return 3;
      case 'hsn': return 4;
      case 'qty': return 4;
      case 'mrp': return 5;
      case 'rate': return 6;
      case 'amt':
      case 'taxable': return 8;
      case 'cgst':
      case 'sgst':
      case 'igst':
      case 'gst': return 4;
      case 'disc':
      case 'discount': return 4;
      case 'total': return 8;
      default: return 4;
    }
  };

  const getColMaxWidth = (colKey: string) => {
    switch (colKey) {
      case 'slNo': return 15;
      case 'desc': return 65;
      case 'size': return 15;
      case 'hsn': return 25;
      case 'qty': return 20;
      case 'mrp': return 25;
      case 'rate': return 30;
      case 'amt':
      case 'taxable': return 35;
      case 'cgst':
      case 'sgst':
      case 'igst':
      case 'gst': return 20;
      case 'disc':
      case 'discount': return 20;
      case 'total': return 35;
      default: return 50;
    }
  };

  const handleStartResize = (currColKey: string, nextColKey: string | undefined, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(currColKey);

    const startX = e.clientX;
    const initialConfig = { ...tallyConfig };
    const containerWidth = containerRef.current?.offsetWidth || 750;

    const currWidthKey = getColWidthKey(currColKey);
    const nextWidthKey = nextColKey ? getColWidthKey(nextColKey) : null;

    const initialCurrWidth = Number(initialConfig[currWidthKey]) || 10;
    const initialNextWidth = nextWidthKey ? (Number(initialConfig[nextWidthKey]) || 10) : 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = Math.round((deltaX / containerWidth) * 100);

      const minCurr = getColMinWidth(currColKey);
      const maxCurr = getColMaxWidth(currColKey);

      if (nextWidthKey) {
        const minNext = getColMinWidth(nextColKey);
        const maxNext = getColMaxWidth(nextColKey);

        let newCurrWidth = Math.max(minCurr, Math.min(maxCurr, initialCurrWidth + deltaPercent));
        let diff = newCurrWidth - initialCurrWidth;

        let newNextWidth = initialNextWidth - diff;
        if (newNextWidth < minNext) {
          newNextWidth = minNext;
          diff = initialNextWidth - minNext;
          newCurrWidth = initialCurrWidth + diff;
        } else if (newNextWidth > maxNext) {
          newNextWidth = maxNext;
          diff = initialNextWidth - maxNext;
          newCurrWidth = initialCurrWidth + diff;
        }

        setTallyConfig((prev: any) => ({
          ...prev,
          [currWidthKey]: newCurrWidth,
          [nextWidthKey]: newNextWidth
        }));
      } else {
        const newCurrWidth = Math.max(minCurr, Math.min(maxCurr, initialCurrWidth + deltaPercent));
        setTallyConfig((prev: any) => ({
          ...prev,
          [currWidthKey]: newCurrWidth
        }));
      }
    };

    const handleMouseUp = () => {
      setResizingCol(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSaveTallyLayout = async () => {
    setIsSavingLayout(true);
    try {
      const activeUserId = user?.uid || rawInvoice?.user_id;
      if (activeUserId && !isOfflineMode) {
        const userDocRef = doc(db, 'users', activeUserId);
        await updateDoc(userDocRef, {
          tally_config: tallyConfig
        });
        if (id) {
          const invDocRef = doc(db, 'invoices', id);
          await updateDoc(invDocRef, {
            tally_config: tallyConfig
          });
        }
      } else if (isOfflineMode && user) {
        const localProfile = getSecureStorage(`offline_profile_${user.uid}`, {});
        setSecureStorage(`offline_profile_${user.uid}`, { ...localProfile, tally_config: tallyConfig });
      }
      setSaveLayoutSuccess(true);
      setTimeout(() => setSaveLayoutSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving layout customization:", err);
    } finally {
      setIsSavingLayout(false);
    }
  };

  useEffect(() => {
    initialTemplateSetRef.current = false;
  }, [id]);

  useEffect(() => {
    async function loadCustomTemplate() {
      const isBuiltin = ['invocentric_classic_gst', 'tally_prime_gst', 'tally_simple_bill', 'tally_bill_of_supply', 'tally_export_invoice', 'thermal'].includes(template);
      if (isBuiltin) {
        setCustomTemplate(null);
        return;
      }
      
      const matchedHook = userCustomTemplates?.find((t: any) => t.id === template || t.template_id === template);
      if (matchedHook) {
        setCustomTemplate(matchedHook);
        return;
      }

      try {
        // Check local storage / offline cache first
        if (user) {
          const localTemplates = getSecureStorage(`offline_templates_${user.uid}`, []);
          const matched = localTemplates.find((t: any) => t.id === template || t.template_id === template);
          if (matched) {
            setCustomTemplate(matched);
            return;
          }
        }
        
        if (!isOfflineMode) {
          const docRef = doc(db, 'templates', template);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCustomTemplate({ id: docSnap.id, ...data });
            return;
          }
        }
      } catch (err) {
        console.error("Error loading custom template details in InvoiceView:", err);
      }
    }
    loadCustomTemplate();
  }, [template, isOfflineMode, user, userCustomTemplates, rawInvoice?.user_id]);

  useEffect(() => {
    if (initialTemplateSetRef.current) return;
    if (rawInvoice || sellerInfo) {
      const initialTmpl = rawInvoice?.invoice_template || sellerInfo?.invoice_template || 'invocentric_classic_gst';
      setTemplate(initialTmpl);
      if (initialTmpl === 'tally_simple_bill' || initialTmpl === 'tally_bill_of_supply') {
        setPaperSize('a5');
      }
      initialTemplateSetRef.current = true;
    }
  }, [rawInvoice, sellerInfo]);

  const handleTemplateChange = async (newTemplate: string) => {
    const isBuiltin = ['invocentric_classic_gst', 'tally_prime_gst', 'tally_simple_bill', 'tally_bill_of_supply', 'tally_export_invoice', 'thermal'].includes(newTemplate);
    
    if (!isBuiltin) {
      const matchedHook = userCustomTemplates?.find((t: any) => t.id === newTemplate || t.template_id === newTemplate);
      if (matchedHook) {
        setCustomTemplate(matchedHook);
      } else if (user) {
        const localTemplates = getSecureStorage(`offline_templates_${user.uid}`, []);
        const matchedLocal = localTemplates.find((t: any) => t.id === newTemplate || t.template_id === newTemplate);
        if (matchedLocal) {
          setCustomTemplate(matchedLocal);
        }
      } else {
        try {
          if (!isOfflineMode) {
            const docRef = doc(db, 'templates', newTemplate);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const tmplData = docSnap.data();
              setCustomTemplate({ id: docSnap.id, ...tmplData });
            }
          }
        } catch (err) {
          console.warn("Could not fetch remote template doc:", err);
        }
      }
    } else {
      setCustomTemplate(null);
    }

    setTemplate(newTemplate);
    if (newTemplate === 'tally_simple_bill' || newTemplate === 'tally_bill_of_supply') {
      setPaperSize('a5');
    } else if (newTemplate === 'tally_prime_gst' || newTemplate === 'tally_export_invoice' || newTemplate === 'invocentric_classic_gst') {
      setPaperSize('a4');
    }
    setShareFile(null);
    if (rawInvoice) {
      setInvoice((prev: any) => prev ? { ...prev, invoice_template: newTemplate } : prev);
    }
    if (sellerInfo) {
      setSellerInfo((prev: any) => prev ? { ...prev, invoice_template: newTemplate } : prev);
    }

    const activeInvoiceCreatorId = rawInvoice?.user_id;

    if (activeInvoiceCreatorId && user && activeInvoiceCreatorId === user.uid) {
      try {
        const userDocRef = doc(db, 'users', activeInvoiceCreatorId);
        await updateDoc(userDocRef, {
          invoice_template: newTemplate
        });
        if (id && !isOfflineMode) {
          const invDocRef = doc(db, 'invoices', id);
          await updateDoc(invDocRef, {
            invoice_template: newTemplate
          });
        }
      } catch (err) {
        console.error("Error saving template to Firestore:", err);
      }
    }
  };

  const defaultBuiltInTemplates = [
    { id: 'invocentric_classic_gst', name: 'InvoCentic Classic GST Invoice' },
    { id: 'tally_prime_gst', name: 'InvoCentic Tally Prime Standard GST Invoice' },
    { id: 'tally_simple_bill', name: 'InvoCentic Tally Simple Retail Invoice ERP 9' },
    { id: 'tally_bill_of_supply', name: 'InvoCentic Tally Bill of Supply Composition' },
    { id: 'tally_export_invoice', name: 'InvoCentic Tally Export GST Invoice' },
    { id: 'thermal', name: 'InvoCentic POS Thermal (3-inch / 80mm Roll)' }
  ];

  const [deletedBuiltInIds, setDeletedBuiltInIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('deleted_builtin_templates');
    return saved ? JSON.parse(saved) : [];
  });

  const handleDeleteBuiltInTemplate = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove template "${name}"?`)) return;
    const newDeleted = [...deletedBuiltInIds, id];
    setDeletedBuiltInIds(newDeleted);
    localStorage.setItem('deleted_builtin_templates', JSON.stringify(newDeleted));
    if (template === id) {
      const remaining = defaultBuiltInTemplates.filter(t => !newDeleted.includes(t.id));
      setTemplate(remaining[0]?.id || 'invocentric_classic_gst');
    }
    showToast(`Template "${name}" removed successfully`);
  };
  const baseColumnVisibility = {
    size: false,
    hsn: true,
    mrp: false,
    discount: false,
    gstPercent: false,
    ...(rawInvoice?.columnVisibility || {}),
    ...(customTemplate?.column_visibility || {})
  };
  const columnVisibility = {
    ...baseColumnVisibility,
    ...(tallyConfig.showHsnColumn !== undefined ? { hsn: tallyConfig.showHsnColumn } : {}),
    ...(tallyConfig.showSizeColumn !== undefined ? { size: tallyConfig.showSizeColumn } : {}),
    ...(tallyConfig.showMrpColumn !== undefined ? { mrp: tallyConfig.showMrpColumn } : {}),
    ...(tallyConfig.showDiscountColumn !== undefined ? { discount: tallyConfig.showDiscountColumn } : {}),
    ...(tallyConfig.showGstPercentColumn !== undefined ? { gstPercent: tallyConfig.showGstPercentColumn } : {}),
  };

  const effectiveTemplate = customTemplate ? (customTemplate.base_template || 'gst_classic') : template;
  const activeBaseTemplate = effectiveTemplate;

  const getColumnLabel = (colKey: string, defaultLabel: string) => {
    return rawInvoice?.column_labels?.[colKey] || customTemplate?.column_labels?.[colKey] || defaultLabel;
  };

  const getSectionLabel = (sectKey: string, defaultLabel: string) => {
    return rawInvoice?.section_labels?.[sectKey] || customTemplate?.section_labels?.[sectKey] || defaultLabel;
  };

  const getSummaryLabel = (sumKey: string, defaultLabel: string) => {
    return rawInvoice?.summary_labels?.[sumKey] || customTemplate?.summary_labels?.[sumKey] || defaultLabel;
  };

  const invoiceTitleText = rawInvoice?.invoice_title || customTemplate?.invoice_title || (rawInvoice?.bill_type && rawInvoice.bill_type !== 'INVOICE' ? rawInvoice.bill_type : 'TAX INVOICE');
  const copySubtitleText = rawInvoice?.copy_subtitle || customTemplate?.copy_subtitle || 'ORIGINAL FOR RECIPIENT';
  const termsText = rawInvoice?.terms_text || rawInvoice?.notes || customTemplate?.terms_text || sellerInfo?.default_terms || '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. charged after due date.';
  const declarationText = rawInvoice?.declaration_text || customTemplate?.declaration_text || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
  const signatoryTitleText = rawInvoice?.signatory_title || customTemplate?.signatory_title || 'Authorized Signatory';

  const isSectionVisible = (sectKey: string) => {
    // Check brand field toggles from tallyConfig
    if (sectKey === 'showLogo' || sectKey === 'logo') return tallyConfig.showLogo !== false;
    if (sectKey === 'showPhone' || sectKey === 'phone') return tallyConfig.showPhone !== false;
    if (sectKey === 'showEmail' || sectKey === 'email') return tallyConfig.showEmail !== false;
    if (sectKey === 'showAddress') return tallyConfig.showAddress !== false;
    if (sectKey === 'showGstin') return tallyConfig.showGstin !== false;
    if (sectKey === 'showPan') return tallyConfig.showPan !== false;
    if (sectKey === 'showStateCode') return tallyConfig.showStateCode !== false;

    // Check if there is an active layout override hiding/showing this section
    const overrideId = 
      (sectKey === 'hsn_summary' || sectKey === 'tally_hsn_summary') ? 'tally_hsn_summary' :
      sectKey === 'amount_in_words' ? 'tally_amount_words' :
      sectKey === 'bank_details' ? 'tally_footer_block' :
      sectKey === 'terms' ? 'tally_footer_block' :
      sectKey === 'declaration' ? 'tally_footer_block' :
      sectKey === 'signature' ? 'tally_footer_block' :
      sectKey === 'seller_address' ? 'tally_seller_branding' :
      sectKey === 'customer_gstin' ? 'tally_buyer_consignee' :
      null;

    if (overrideId && layoutOverrides[overrideId] !== undefined) {
      if (layoutOverrides[overrideId].hidden === true) {
        return false;
      }
      if (layoutOverrides[overrideId].hidden === false) {
        return true;
      }
    }

    if (rawInvoice?.hide_sections && typeof rawInvoice.hide_sections[sectKey] === 'boolean') {
      return !rawInvoice.hide_sections[sectKey];
    }
    return customTemplate ? (customTemplate.hide_sections?.[sectKey] !== true) : true;
  };

  const primaryColor = customTemplate?.primary_color || '#1e5eb8';
  const primaryBgLight = customTemplate?.primary_color ? `${customTemplate.primary_color}15` : '#e6f0fa';
  const primaryBgBanner = customTemplate?.primary_color ? `${customTemplate.primary_color}08` : '#f4f8fe';

  const isHsnVisible = tallyConfig.showHsnColumn !== undefined ? tallyConfig.showHsnColumn : (columnVisibility.hsn !== false);
  const isDiscountEnabled = columnVisibility.discount === true;
  const isGstEnabled = columnVisibility.gstPercent === true;

  const cleanInvoiceDiscount = isDiscountEnabled ? (Number(rawInvoice?.discount) || 0) : 0;
  
  const cleanItems = rawInvoice?.items?.map((item: any) => {
    const disc = isDiscountEnabled ? (Number(item.discount) || 0) : 0;
    const basePrice = (columnVisibility.mrp && item.mrp) ? Number(item.mrp) : Number(item.price);
    const price = !isDiscountEnabled ? basePrice : Number(item.price);
    const gstPercent = isGstEnabled ? (Number(item.gstPercent) || 0) : 0;
    return {
      ...item,
      discount: disc,
      price: price,
      gstPercent: gstPercent,
      gst_rate: gstPercent,
      tax_amount: gstPercent > 0 ? (price * (gstPercent / 100)) : 0
    };
  }) || [];

  const totalSalesReturn = (rawInvoice?.salesReturn || rawInvoice?.sales_return || 0);

  const rawSubtotal = cleanItems.reduce((acc: any, i: any) => {
    const base = i.mrp || i.price || 0;
    return acc + (i.quantity * base);
  }, 0) || 0;

  const itemDiscountsSum = cleanItems.reduce((acc: any, i: any) => {
    const base = i.mrp || i.price || 0;
    const disc = i.discount || 0;
    return acc + (i.quantity * base * (disc / 100));
  }, 0) || 0;

  const totalDiscount = cleanInvoiceDiscount + itemDiscountsSum;

  const totalGst = cleanItems.reduce((acc: any, i: any) => {
    const itemPrice = i.price || i.mrp || 0;
    const taxPercent = i.gstPercent || 0;
    return acc + ((i.quantity * itemPrice) * (taxPercent / 100));
  }, 0) || 0;

  const isIgst = Boolean(customer?.state && sellerInfo?.state && customer.state.toLowerCase() !== sellerInfo.state.toLowerCase());
  const calcGst = { igst: isIgst ? totalGst : 0, cgst: isIgst ? 0 : totalGst / 2, sgst: isIgst ? 0 : totalGst / 2, totalTax: totalGst };
  const hsnSummary = cleanItems.reduce((acc: any, i: any) => {
    const code = i?.hsn || '0000';
    const qty = Number(i?.quantity) || 0;
    const prc = Number(i?.price) || 0;
    const dsc = Number(i?.discount) || 0;
    const gstPct = Number(i?.gstPercent) || 0;
    const taxable = qty * prc * (1 - dsc / 100);
    const tax = taxable * gstPct / 100;
    if (!acc[code]) {
      acc[code] = { taxable: 0, tax: 0, gstRate: gstPct, igst: 0, cgst: 0, sgst: 0 };
    }
    acc[code].taxable += taxable;
    acc[code].tax += tax;
    if (isIgst) {
      acc[code].igst += tax;
    } else {
      acc[code].cgst += tax / 2;
      acc[code].sgst += tax / 2;
    }
    return acc;
  }, {});
  const totalTaxable = Object.values(hsnSummary).reduce((acc: number, cur: any) => acc + (cur?.taxable || 0), 0) as number;

  const computedGrandTotal = rawSubtotal - totalDiscount + totalSalesReturn + totalGst;
  const advanceAmount = Number(rawInvoice?.advance_amount || rawInvoice?.advanceAmount || 0);
  const balanceDue = Math.max(0, computedGrandTotal - advanceAmount);

  const invoice = rawInvoice ? {
    ...rawInvoice,
    invoice_number: getInvoiceDisplayNumber(rawInvoice),
    items: cleanItems,
    discount: cleanInvoiceDiscount,
    amount: computedGrandTotal,
    advance_amount: advanceAmount,
    advanceAmount: advanceAmount,
    balance_due: balanceDue,
    balanceDue: balanceDue,
    amount_words: safeToWords(computedGrandTotal, rawInvoice.currency)
  } : null;

  const formatDateSafe = (dateVal: any, fmt: string) => {
    if (!dateVal) return 'N/A';
    try {
      if (typeof dateVal === 'string') return format(parseISO(dateVal), fmt);
      if (dateVal.seconds) return format(new Date(dateVal.seconds * 1000), fmt);
      if (dateVal instanceof Date) return format(dateVal, fmt);
      if (typeof dateVal === 'number') return format(new Date(dateVal), fmt);
    } catch (e) {
      return 'Invalid Date';
    }
    return 'N/A';
  };

  const getItemName = (item: any) => {
    if (!item) return '---';
    return item.description || 
           item.name || 
           item.itemName || 
           item.item_name || 
           item.title || 
           item.productName || 
           item.product_name || 
           item.service || 
           item.serviceName || 
           '---';
  };

  const renderItemDetails = (item: any, textColorClass = "text-gray-600") => {
    if (!item) return null;
    const detailsList: string[] = [];
    
    const serial = item.serial_number || item.serialNumber;
    
    const candidates = [
      item.notes,
      item.custom_box,
      item.description_sub,
      item.notes_sub,
      item.item_details,
      item.details
    ];
    
    const itemName = getItemName(item)?.trim().toLowerCase();
    
    candidates.forEach(c => {
      if (c && typeof c === 'string') {
        const trimmed = c.trim();
        if (trimmed && !detailsList.includes(trimmed)) {
          if (trimmed.toLowerCase() !== itemName) {
            detailsList.push(trimmed);
          }
        }
      }
    });

    if (detailsList.length === 0 && !serial) return null;

    return (
      <div className={cn("text-[9px] font-normal mt-0.5 space-y-0.5 whitespace-pre-wrap leading-relaxed italic", textColorClass)}>
        {serial && <p className="not-italic font-semibold text-emerald-700 dark:text-emerald-300"><span className="font-semibold text-gray-700 dark:text-gray-300">SR/No:</span> {serial}</p>}
        {detailsList.map((detail, index) => (
          <p key={index}>{detail}</p>
        ))}
      </div>
    );
  };

  const hasGST = invoice?.items?.some((item: any) => (item.gstPercent > 0 || item.gst_rate > 0 || item.tax_amount > 0)) || false;
  const computedDefaultType = hasGST ? 'TAX INVOICE' : 'INVOICE';
  const displayBillType = (invoice?.bill_type === 'INVOICE' || invoice?.bill_type === 'TAX INVOICE' || !invoice?.bill_type) ? computedDefaultType : invoice?.bill_type;

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateScale = () => {
      requestAnimationFrame(() => {
        if (!containerRef.current || !invoiceRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        
        // Exact target dimensions based on paper format:
        // Thermal: 80mm (~340px)
        // A5: 148mm × 210mm (~595px)
        // A4: 210mm × 297mm (~840px)
        const targetWidth = template === 'thermal' 
          ? 340 
          : paperSize === 'a5' 
            ? 595 
            : 840;
        
        const availableWidth = Math.max(containerWidth - 24, 260);
        
        let baseScale = 1;
        if (availableWidth < targetWidth) {
          baseScale = availableWidth / targetWidth;
        } else {
          baseScale = Math.min(1.2, availableWidth / targetWidth);
        }

        const finalScale = baseScale * zoomLevel;
        setScale(finalScale);

        // Update dynamic CSS custom property for layout height flow
        const currentHeight = invoiceRef.current.offsetHeight || invoiceRef.current.scrollHeight;
        containerRef.current.style.setProperty('--invoice-height', `${currentHeight * finalScale}px`);
      });
    };

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);
    if (invoiceRef.current) resizeObserver.observe(invoiceRef.current);
    
    updateScale(); // Initial call
    
    return () => resizeObserver.disconnect();
  }, [loading, template, zoomLevel, isSidebarCollapsed, paperSize, customTemplate]);

  // Sync paper size attribute to the main scroll container for @media print and CSS targeting
  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    if (mainContainer) {
      mainContainer.setAttribute('data-paper-size', paperSize);
    }
    return () => {
      if (mainContainer) {
        mainContainer.removeAttribute('data-paper-size');
      }
    };
  }, [paperSize]);

  useEffect(() => {
    async function fetchData() {
      if (!id || !user) return;
      try {
        const upserts = getSecureStorage(`offline_upserts_${user.uid}`, []);
        const localInvoices = getSecureStorage(`offline_invoices_${user.uid}`, []);
        
        let invData: any = null;
        const queuedInvoice = upserts.find((u: any) => u.collection === "invoices" && u.item.id === id);
        if (queuedInvoice) invData = queuedInvoice.item;
        else if (isOfflineMode) invData = localInvoices.find((i: any) => i.id === id);
        
        if (!invData && !isOfflineMode) {
          const invDocRef = doc(db, "invoices", id);
          const invSnap = await getDoc(invDocRef);
          if (invSnap.exists()) invData = { id: invSnap.id, ...invSnap.data() };
        }

        if (invData) {
          setInvoice(invData);
          
          // Fetch Customer info
          if (invData.customer_id) {
            let custData: any = null;
            const queuedCust = upserts.find((u: any) => u.collection === "customers" && u.item.id === invData.customer_id);
            if (queuedCust) custData = queuedCust.item;
            else if (isOfflineMode) {
              const localCustomers = getSecureStorage(`offline_customers_${user.uid}`, []);
              custData = localCustomers.find((c: any) => c.id === invData.customer_id);
            } else {
              const custDocRef = doc(db, "customers", invData.customer_id);
              const custSnap = await getDoc(custDocRef);
              if (custSnap.exists()) custData = { id: custSnap.id, ...custSnap.data() };
            }
            if (custData) setCustomer(custData);
          }
          
          // Fetch Seller info
          if (invData.user_id) {
             let userData: any = null;
             if (isOfflineMode) {
                 const localUsers = getSecureStorage(`offline_users_${user.uid}`, []);
                 userData = localUsers.find((u: any) => u.id === invData.user_id);
                 // If not found in local, fallback to current user info (if matches)
                 if (!userData && user.uid === invData.user_id) {
                     const cachedProfile = getSecureStorage(`user_profile_${user.uid}`, null);
                     if (cachedProfile) {
                         try {
                             userData = { id: user.uid, ...typeof cachedProfile === 'string' ? JSON.parse(cachedProfile) : cachedProfile };
                         } catch (e) {
                             userData = { id: user.uid, displayName: user.displayName, email: user.email };
                         }
                     } else {
                         userData = { id: user.uid, displayName: user.displayName, email: user.email };
                     }
                 }
             } else {
                 const userDocRef = doc(db, "users", invData.user_id);
                 const userSnap = await getDoc(userDocRef);
                 if (userSnap.exists()) userData = { id: userSnap.id, ...userSnap.data() };
             }
             if (userData) setSellerInfo(userData);
          }
        }

      } catch (error) {
        console.error("Error fetching data:", error);
        handleFirestoreError(error, OperationType.GET, `invoices/${id}`);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, user, isOfflineMode]);

  useEffect(() => {
    if (sellerInfo?.letterhead_image) {
      setCustomLetterhead(sellerInfo.letterhead_image);
      localStorage.setItem('custom_letterhead_image', sellerInfo.letterhead_image);
    }
    if (sellerInfo?.letterhead_type) {
      setLetterheadType(sellerInfo.letterhead_type);
      localStorage.setItem('custom_letterhead_type', sellerInfo.letterhead_type);
    }
  }, [sellerInfo]);

  useEffect(() => {
    // Reset background PDF when invoice changes (e.g. status updates)
    setShareFile(null);
  }, [invoice?.status]);

  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!invoiceRef.current) return null;

    try {
      // Use html-to-image to bypass html2canvas computed style parsing issues with oklch/color-mix
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const dataUrl = await toPng(invoiceRef.current, { 
        quality: 1.0, 
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        fontEmbedCSS: '',
        skipFonts: true,
        style: {
          transform: 'none',
          boxShadow: 'none'
        }
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const isThermal = template === 'thermal';
      if (isThermal) {
        const pdfWidthMm = 80;
        const margin = 3;
        const pdfHeightMm = ((img.height * (pdfWidthMm - margin * 2)) / img.width) + (margin * 2);

        const pdf = new jsPDF({
          unit: 'mm',
          format: [pdfWidthMm, pdfHeightMm],
          orientation: 'portrait',
          compress: true
        });

        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidthMm, pdfHeightMm, 'F');
        pdf.addImage(dataUrl, 'PNG', margin, margin, pdfWidthMm - margin * 2, pdfHeightMm - margin * 2);
        return pdf.output('blob');
      }

      // Standard A4 / A5 PDF Generation
      const isA5 = paperSize === 'a5';
      const pdfWidthMm = isA5 ? 148 : 210;
      const pdfPageHeightMm = isA5 ? 210 : 297;
      const imgHeightMm = (img.height * pdfWidthMm) / img.width;

      const pdf = new jsPDF({
        unit: 'mm',
        format: isA5 ? 'a5' : 'a4',
        orientation: 'portrait',
        compress: true
      });

      if (imgHeightMm <= (isA5 ? 220 : 310)) {
        // Fits cleanly on 1 single page without creating unwanted second page
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidthMm, pdfPageHeightMm, 'F');
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidthMm, Math.min(pdfPageHeightMm, imgHeightMm));
      } else {
        // Multi-page PDF export only for invoices with large item counts
        const totalPages = Math.ceil(imgHeightMm / pdfPageHeightMm);
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage(isA5 ? 'a5' : 'a4', 'portrait');
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pdfWidthMm, pdfPageHeightMm, 'F');
          const positionY = - (page * pdfPageHeightMm);
          pdf.addImage(dataUrl, 'PNG', 0, positionY, pdfWidthMm, imgHeightMm);
        }
      }

      return pdf.output('blob');
    } catch (err) {
      console.error("PDF Generation Error:", err);
      return null;
    }
  };

  useEffect(() => {
    // Pre-generate PDF for sharing to avoid user gesture timeout issues on mobile devices
    if (!invoice || shareFile || isGeneratingShare || !invoiceRef.current) return;
    
    let isCancelled = false;
    
    const generateBackgroundPDF = async () => {
      setIsGeneratingShare(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 800)); // wait for complete render
        if (isCancelled || !invoiceRef.current) return;
        
        const blob = await generatePdfBlob();
        if (blob) {
          const file = new File([blob], `Invoice_${invoice.id.slice(0, 8)}.pdf`, { type: 'application/pdf' });
          if (!isCancelled) {
            setShareFile(file);
          }
        }
      } catch (e) {
        console.error("Background PDF generation failed", e);
      } finally {
        if (!isCancelled) {
          setIsGeneratingShare(false);
        }
      }
    };
    
    const timer = setTimeout(generateBackgroundPDF, 500);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [invoice, shareFile, isGeneratingShare, paperSize, template]);

  const handleMarkAsPaid = async () => {
    if (!invoice || updating) return;
    setUpdating(true);
    try {
      const invDocRef = doc(db, 'invoices', invoice.id);
      await updateDoc(invDocRef, {
        status: 'paid',
        updated_at: serverTimestamp()
      });

      // Automatically record or update payment entry in the payments collection
      if (user) {
        const existingPayments = await findLinkedPayments(user.uid, invoice.id, isOfflineMode);
        const invNum = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
        const paymentPayload = {
          customer_id: invoice.customer_id || null,
          customer_name: invoice.customer_name || 'Cash Sale',
          amount: invoice.amount || invoice.total || 0,
          note: `Invoice #${invNum} Paid`,
          method: 'cash',
          invoice_id: invoice.id,
        };

        if (existingPayments.length > 0) {
          for (const p of existingPayments) {
            await dbService.update('payments', p.id, paymentPayload, { offlineMode: isOfflineMode, userId: user.uid });
          }
        } else {
          await dbService.add('payments', {
            ...paymentPayload,
            user_id: user.uid,
            date: new Date().toISOString(),
          }, { offlineMode: isOfflineMode, userId: user.uid });
        }
      }
      
      setInvoice(prev => ({ ...prev, status: 'paid' }));
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#14532D', '#ffffff', '#fbbf24']
      });
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${invoice.id}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadPDF = async () => {
    setShowPdfModal(true);
  };

  const handleDirectPdfDownload = async () => {
    if (!invoiceRef.current || !invoice) return;
    try {
      setDownloading(true);
      const blob = await generatePdfBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `InvoCentric_Invoice_${invoice.id.slice(0, 8)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error("Failed to generate PDF");
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
      setShowPdfModal(false);
    }
  };

  const generateImageBlob = async (): Promise<Blob | null> => {
    if (!invoiceRef.current) return null;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(invoiceRef.current, { 
        quality: 1.0, 
        pixelRatio: 2, // 2x pixelRatio for crystal-clear high resolution HD images
        backgroundColor: '#ffffff',
        fontEmbedCSS: '',
        skipFonts: true,
        style: {
          transform: 'none',
          boxShadow: 'none'
        },
        cacheBust: true
      });
      const response = await fetch(dataUrl);
      return await response.blob();
    } catch (err) {
      console.error("Image Generation Error:", err);
      return null;
    }
  };

  const handleWhatsAppShare = async () => {
    if (!invoice) return;
    
    const invoiceNo = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
    const pdfFileName = `InvoCentric_Invoice_${invoiceNo}.pdf`;

    const targetPhone = customer?.phone ? normalizePhoneNumber(customer.phone) : '';
    const grandTotalStr = formatCurrency(invoice.amount, invoice.currency);
    const bizName = sellerInfo?.business_name || 'InvoCentric';

    // Professional WhatsApp text message
    const shareText = `*Invoice #${invoiceNo}* from *${bizName}*\n\n` +
      `Hello ${customer?.name || 'Customer'},\n` +
      `Please find the invoice details for your recent purchase:\n\n` +
      `• *Invoice No:* #${invoiceNo}\n` +
      `• *Total Amount:* *${grandTotalStr}*\n` +
      `• *Due Date:* ${formatDateSafe(invoice.due_date || invoice.dueDate || invoice.created_at, 'dd MMM yyyy')}\n\n` +
      `Thank you for your business!`;

    const whatsappUrl = getWhatsAppShareUrl(targetPhone, shareText);
    const whatsappWebUrl = getWhatsAppWebUrl(targetPhone, shareText);
    const whatsappAppUrl = getWhatsAppAppUrl(targetPhone, shareText);

    // Save states for modal
    setWhatsAppShareText(shareText);
    setWhatsAppUrlState(whatsappUrl);
    setWhatsAppWebUrlState(whatsappWebUrl);
    setWhatsAppAppUrlState(whatsappAppUrl);
    setDownloading(true);

    // Copy invoice image or text details directly to clipboard
    let imageCopied = false;
    if (navigator.clipboard) {
      try {
        const imageBlob = await generateImageBlob();
        if (imageBlob && typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({
            'image/png': imageBlob
          });
          await navigator.clipboard.write([item]);
          imageCopied = true;
          setCopiedToClipboard(true);
        }
      } catch (clipErr) {
        console.error("Clipboard image copy failed, falling back to text copy:", clipErr);
      }

      if (!imageCopied) {
        try {
          await navigator.clipboard.writeText(shareText);
          setCopiedToClipboard(true);
        } catch (clipErr) {
          console.error("Clipboard text copy failed:", clipErr);
          setCopiedToClipboard(false);
        }
      }
    }

    // Determine best default WhatsApp URL based on device
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 1024;
    const defaultUrl = isDesktop ? whatsappWebUrl : whatsappUrl;

    // NOW open WhatsApp directly with customer phone and message!
    if (isMobile()) {
      window.location.href = defaultUrl;
    } else {
      window.open(defaultUrl, '_blank');
    }

    setShowWhatsAppModal(true);

    // Generate PDF & auto-download in background (PNG is NOT downloaded)
    try {
      const pdfBlob = await generatePdfBlob();
      if (pdfBlob) {
        try {
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const pdfLink = document.createElement('a');
          pdfLink.href = pdfUrl;
          pdfLink.download = pdfFileName;
          document.body.appendChild(pdfLink);
          pdfLink.click();
          document.body.removeChild(pdfLink);
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 3000);
        } catch (pdfErr) {
          console.error("Auto download PDF failed:", pdfErr);
        }
      }
    } catch (pdfErr: any) {
      console.error("PDF generation error:", pdfErr);
    } finally {
      setDownloading(false);
    }
  };

  const handleDirectImageShare = async () => {
    if (!generatedImageBlob) return;
    try {
      const fileToShare = new File([generatedImageBlob], generatedImageFileName, { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
          title: `Invoice #${invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()}`,
          text: whatsAppShareText,
        });
      } else {
        alert("Direct image sharing is not supported on this browser/device. Please download the image or copy the link.");
      }
    } catch (err: any) {
      const errStr = err?.message?.toLowerCase() || String(err).toLowerCase();
      if (err?.name === 'AbortError' || errStr.includes('share canceled') || errStr.includes('cancelled') || errStr.includes('cancel')) {
        return;
      }
      console.error("Direct image share failed:", err);
    }
  };

  const handleShare = async () => {
    if (!invoiceRef.current || !invoice) return;
    setDownloading(true);
    try {
      let fileToShare = shareFile;
      
      // If file isn't ready (background generation didn't finish), generate it now
      if (!fileToShare) {
        const blob = await generatePdfBlob();
        if (blob) {
          fileToShare = new File([blob], `InvoCentric_Invoice_${invoice.id.slice(0, 8)}.pdf`, { type: 'application/pdf' });
          setShareFile(fileToShare);
        }
      }

      if (fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
          title: 'InvoCentric Invoice',
          text: `Invoice for ${formatCurrency(invoice.amount, invoice.currency)} from ${sellerInfo?.business_name || 'InvoCentric'}`,
        });
      } else if (navigator.share) {
         // Fallback to URL sharing if file sharing is unsupported (e.g. some desktop browsers)
         await navigator.share({
           title: 'InvoCentric Invoice',
           text: `Invoice for ${formatCurrency(invoice?.amount || 0, invoice?.currency)} from ${sellerInfo?.business_name || 'InvoCentric'}`,
           url: window.location.href, 
         });
      } else {
        // Fallback: copy link
        await navigator.clipboard.writeText(window.location.href);
        alert('Sharing files is not supported on this device/browser. Invoice link copied to clipboard!');
      }
    } catch (error: any) {
      const errStr = error?.message?.toLowerCase() || String(error).toLowerCase();
      
      if (error?.name === 'AbortError' || errStr.includes('share canceled') || errStr.includes('cancelled') || errStr.includes('cancel')) {
        return;
      }
      
      console.error("Sharing failed:", error);
      
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Sharing PDF failed. Invoice link copied to clipboard!');
      } catch (clipboardError) {
        alert('Sharing failed. Please copy the URL from your browser address bar.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Link copy failed:", err);
    }
  };

  useEffect(() => {
    // Auto-trigger share flow if ?share=true query param is present
    if (loading || !rawInvoice) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('share') === 'true' && !shareTriggered.current) {
      shareTriggered.current = true;
      // Clear the share param to avoid re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
      
      // Delay slightly to ensure fonts/layout are stable
      setTimeout(() => {
        handleWhatsAppShare();
      }, 1000);
    }
  }, [rawInvoice, loading]);

  useEffect(() => {
    // Auto-trigger print dialog if ?print=true query param is present
    if (loading || !rawInvoice) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('print') === 'true' && !printTriggered.current) {
      printTriggered.current = true;
      // Clear the print param to avoid re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
      
      // Delay slightly to ensure fonts and elements are fully rendered
      setTimeout(() => {
        window.focus();
        window.print();
      }, 1000);
    }
  }, [rawInvoice, loading]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Logo size={64} className="opacity-50" />
      </motion.div>
      <div className="flex items-center gap-2">
        <Loader2 className="animate-spin text-green-600" size={20} />
        <p className="text-neutral-500 font-bold animate-pulse">Crafting your invoice...</p>
      </div>
    </div>
  );
  
  if (!invoice) return <div className="p-20 text-center">Invoice not found.</div>;

  const upiPayAmount = (invoice?.advance_amount > 0 && invoice?.balance_due !== undefined) ? invoice.balance_due : (invoice?.amount || 0);
  const upiUrl = (sellerInfo?.upi_id || sellerInfo?.upiId)
    ? `upi://pay?pa=${sellerInfo.upi_id || sellerInfo.upiId}&pn=${encodeURIComponent(sellerInfo.business_name || sellerInfo.businessName || '')}&am=${upiPayAmount}&cu=INR&tn=Invoice%20${invoice?.id?.slice(0,8) || ''}`
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/invoices" className="btn-secondary p-3 rounded-full hover:scale-110 active:scale-95 transition-all">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-neutral-900">#INV-{invoice.id.slice(0,8).toUpperCase()}</h1>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                invoice.status === 'paid' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              )}>
                {invoice.status}
              </span>
              {advanceAmount > 0 && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Advance: {formatCurrency(advanceAmount, invoice.currency)}
                </span>
              )}
              {advanceAmount > 0 && balanceDue > 0 && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                  Due: {formatCurrency(balanceDue, invoice.currency)}
                </span>
              )}
            </div>
            <p className="text-neutral-500 text-xs font-bold tracking-wide uppercase">
              Issued on {formatDateSafe(invoice?.created_at, 'dd MMM yyyy')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
            className="btn-secondary flex items-center gap-2 py-2 text-xs"
          >
            <Edit3 size={16} />
            Edit
          </button>
          
          <button 
            onClick={handleCopyLink}
            className={cn(
              "btn-secondary flex items-center gap-2 py-2 text-xs transition-all",
              copied ? "bg-green-50 text-green-700 border-green-200" : "bg-neutral-50 text-neutral-700 border-neutral-100"
            )}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Link"}
          </button>
          
          <button 
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="btn-secondary flex items-center gap-2 py-2 text-xs bg-green-50 text-green-700 border-green-100"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            PDF
          </button>

          <button 
            onClick={handleWhatsAppShare}
            disabled={downloading}
            className="btn-primary flex items-center gap-2 py-2 text-xs bg-[#25D366] hover:bg-[#128C7E] border-none"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <WhatsAppIcon size={18} />}
            WhatsApp
          </button>

          {invoice.status !== 'paid' && (
            <button 
              onClick={handleMarkAsPaid}
              disabled={updating}
              className="btn-primary flex items-center gap-2 py-2 text-xs bg-green-600 hover:bg-green-700"
            >
              {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Mark as Paid
            </button>
          )}

          <button 
            onClick={() => {
              window.focus();
              window.print();
            }}
            className="btn-primary flex items-center gap-2 py-2 text-xs"
          >
            <Printer size={16} />
            Print
          </button>

          {/* Customize Layout Mode Toggle Button */}
          <button 
            onClick={() => {
              setIsCustomizeMode(!isCustomizeMode);
              if (isCustomizeMode) setSelectedElementId(null);
            }}
            className={cn(
              "flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all border shadow-sm",
              isCustomizeMode 
                ? "bg-green-600 text-white border-green-700 ring-2 ring-green-400" 
                : "bg-white text-green-600 border-green-200 hover:bg-green-50"
            )}
          >
            <Sliders size={16} />
            {isCustomizeMode ? "Done Editing" : "Customize Layout"}
          </button>
        </div>
      </div>




      {/* Main Invoice Section */}
      <div className="flex flex-col lg:flex-row gap-6 overflow-visible items-start justify-center invoice-main-flex-container">
        {/* The Invoice Document & Controls */}
        <div className="flex-1 pb-20 w-full flex flex-col items-center min-w-0">
          {/* Preview Zoom & Size Controls Bar */}
          <div className="w-full max-w-[920px] mb-3 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-100/90 backdrop-blur-sm rounded-2xl border border-slate-200 text-slate-700 shadow-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <ZoomIn size={15} className="text-green-600" /> Preview Size
              </span>
              <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5 shadow-xs">
                <button
                  type="button"
                  title="Zoom Out"
                  onClick={() => setZoomLevel(prev => Math.max(0.6, Number((prev - 0.1).toFixed(1))))}
                  className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-lg transition-all"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="px-2.5 text-xs font-bold text-slate-800 min-w-[52px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  title="Zoom In"
                  onClick={() => setZoomLevel(prev => Math.min(2.5, Number((prev + 0.1).toFixed(1))))}
                  className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-lg transition-all"
                >
                  <ZoomIn size={14} />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="hidden sm:flex items-center gap-1">
                {[1.0, 1.15, 1.25, 1.5, 1.75, 2.0].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setZoomLevel(lvl)}
                    className={cn(
                      "px-2 py-1 text-[11px] font-bold rounded-lg transition-all border",
                      zoomLevel === lvl
                        ? "bg-green-600 text-white border-green-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {Math.round(lvl * 100)}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {template !== 'thermal' && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPaperSize('a4');
                      setShareFile(null);
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                      paperSize === 'a4'
                        ? "bg-white text-green-700 shadow-xs font-extrabold"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                    title="A4 Full Page (210 x 297 mm)"
                  >
                    <span>A4</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaperSize('a5');
                      setShareFile(null);
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                      paperSize === 'a5'
                        ? "bg-green-600 text-white shadow-xs font-extrabold"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                    title="A5 Half Sheet (148 x 210 mm)"
                  >
                    <span>A5</span>
                    <span className="text-[9px] bg-green-700/50 px-1 py-0.2 rounded text-white">Half</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setZoomLevel(1.15)}
                title="Reset to Default Size"
                className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-green-700 border border-green-200 rounded-xl font-bold text-xs shadow-xs transition-all"
              >
                {isSidebarCollapsed ? (
                  <>
                    <Minimize2 size={14} />
                    <span>Show Editor</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={14} />
                    <span>Full Preview Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto scrollbar-hide flex justify-center items-start invoice-parent-wrapper" ref={containerRef}>
          <div 
            className={cn(
              "shadow-2xl text-black relative origin-top print-exact-size shrink-0 box-border",
              template === 'thermal' ? "bg-white p-0 border border-gray-300 border-dashed" : "bg-white"
            )}
            style={{ 
              width: template === 'thermal' ? '80mm' : paperSize === 'a5' ? '148mm' : '210mm',
              minHeight: template === 'thermal' ? 'auto' : paperSize === 'a5' ? '210mm' : '297mm',
              boxSizing: 'border-box',
              transform: scale !== 1 ? `scale(${scale})` : 'none',
              transformOrigin: 'top center',
              marginBottom: scale !== 1 ? `calc(var(--invoice-height, 100%) * ${scale - 1})` : '0',
            }}
          >
            <div 
              ref={invoiceRef}
              data-paper-size={paperSize}
              className={cn(
                "invoice-print-container relative w-full text-[#000000] flex flex-col justify-between box-border",
                paperSize === 'a5' ? 'paper-size-a5' : 'paper-size-a4',
                template === 'thermal' 
                  ? "bg-white h-auto p-2" 
                  : paperSize === 'a5' 
                    ? "bg-[#ffffff] p-[4mm] sm:p-[5mm] min-h-[210mm]" 
                    : "bg-[#ffffff] p-[8mm] sm:p-[10mm] min-h-[297mm]",
                template !== 'thermal' && (
                  (invoice?.items?.length || 0) > 8 
                    ? "print-ultra-compact" 
                    : (invoice?.items?.length || 0) > 5 
                      ? "print-very-compact" 
                      : "print-standard"
                )
              )}
              style={{ 
                fontFamily: template === 'thermal' ? "'JetBrains Mono', Courier, monospace" : "'Inter', sans-serif",
                boxSizing: 'border-box'
              }}
            >
              {customTemplate && (
                <style>{`
                  .invoice-print-container {
                    font-family: ${customTemplate.font_family ? `'${customTemplate.font_family}', sans-serif` : "'Inter', sans-serif"} !important;
                    ${customTemplate.font_size === 'compact' ? 'font-size: 8.5pt !important;' : customTemplate.font_size === 'large' ? 'font-size: 11pt !important;' : ''}
                  }
                  .invoice-print-container [class*="border-[#1e5eb8]"] { border-color: ${primaryColor} !important; }
                  .invoice-print-container [class*="bg-[#1e5eb8]"] { background-color: ${primaryColor} !important; }
                  .invoice-print-container [class*="text-[#1e5eb8]"] { color: ${primaryColor} !important; }
                  .invoice-print-container [class*="bg-[#e6f0fa]"] { background-color: ${primaryBgLight} !important; }
                  .invoice-print-container [class*="bg-[#f4f8fe]"] { background-color: ${primaryBgBanner} !important; }
                  /* Support other standard templates accent colors */
                  .invoice-print-container .bg-slate-900 { background-color: ${primaryColor} !important; }
                  .invoice-print-container .border-slate-900 { border-color: ${primaryColor} !important; }
                  .invoice-print-container .text-green-600 { color: ${primaryColor} !important; }
                  .invoice-print-container .bg-green-600 { background-color: ${primaryColor} !important; }
                  .invoice-print-container .border-green-600 { border-color: ${primaryColor} !important; }
                  .invoice-print-container .text-emerald-600 { color: ${primaryColor} !important; }
                  ${customTemplate.custom_css || ''}
                `}</style>
              )}
              {/* Universal Custom Letterhead Background Image overlay */}
              {useLetterheadMode && customLetterhead && (
                <div 
                  className={cn(
                    "absolute pointer-events-none z-0",
                    letterheadType === 'full' ? "inset-0" : "top-0 left-0 w-full"
                  )} 
                  style={letterheadType === 'header' ? { height: `${letterheadSpacerHeight}px` } : undefined}
                >
                  <img src={customLetterhead} className="w-full h-full object-fill" alt="Custom Letterhead" />
                </div>
              )}
                     {activeBaseTemplate === 'invocentric_classic_gst' || (activeBaseTemplate !== 'tally_prime_gst' && activeBaseTemplate !== 'tally_simple_bill' && activeBaseTemplate !== 'tally_bill_of_supply' && activeBaseTemplate !== 'tally_export_invoice' && activeBaseTemplate !== 'thermal') ? (
                <div 
                  className="relative z-10 w-full flex flex-col flex-1 flex-grow justify-between min-h-full h-full bg-white p-5 text-[12px] leading-snug border" 
                  style={{ 
                    borderColor: primaryColor || '#2f6fb0', 
                    fontFamily: customTemplate?.font_family ? `'${customTemplate.font_family}', sans-serif` : 'Arial, Helvetica, sans-serif'
                  }}
                >
                  {/* Letterhead Mode Spacer */}
                  {useLetterheadMode && (
                    <div style={{ height: `${letterheadSpacerHeight}px` }} className="w-full shrink-0" />
                  )}

                  {/* Header */}
                  {!useLetterheadMode && (
                    <div className="flex justify-between items-start mb-3.5">
                      <div className="flex gap-3 items-start">
                        {sellerInfo?.logo_url && isSectionVisible('logo') && (
                          <img className="w-16 h-16 object-contain" src={sellerInfo.logo_url} alt="Logo" />
                        )}
                        <div>
                          <h1 className="text-2xl font-bold uppercase m-0 mb-1" style={{ color: primaryColor || '#1c4a75' }}>
                            {sellerInfo?.business_name || 'Your Company Name'}
                          </h1>
                          <div className="text-[12px] leading-relaxed whitespace-pre-line text-gray-800">
                            {sellerInfo?.address || 'Company Address...'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[12px] space-y-0.5">
                        <div><b>Name</b> : {customer?.name || invoice?.customer_name || 'Jay Enterprises'}</div>
                        <div><b>Phone</b> : {customer?.phone || sellerInfo?.phone || '-'}</div>
                      </div>
                    </div>
                  )}

                  {/* GSTIN / Title Bar */}
                  <div 
                    className="flex justify-between items-center border border-b-0 px-2.5 py-1.5 font-bold text-[13px]"
                    style={{ borderColor: primaryColor || '#2f6fb0' }}
                  >
                    <div>GSTIN : <span className="uppercase">{sellerInfo?.gstin || 'N/A'}</span></div>
                    <div className="text-[15px] font-black uppercase" style={{ color: primaryColor || '#1c4a75' }}>
                      {invoiceTitleText || 'TAX INVOICE'}
                    </div>
                    <div className="uppercase text-[12px]">{copySubtitleText || 'ORIGINAL FOR RECIPIENT'}</div>
                  </div>

                  {/* Meta Grid (3 columns: Buyer | Consignee | Invoice Meta) */}
                  <div className="grid grid-cols-12 border text-[12px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                    {/* Column 1: Details of Buyer | Billed to */}
                    <div className="col-span-5 p-2 border-r" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                      <div 
                        className="font-bold text-center border-b -mx-2 -mt-2 mb-1.5 p-1 text-[12px]" 
                        style={{ background: primaryBgLight || '#eaf2fb', borderColor: primaryColor || '#2f6fb0' }}
                      >
                        {getSectionLabel('billed_to', 'Details of Buyer | Billed to :')}
                      </div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">Name</div><div className="flex-1 font-semibold uppercase">{customer?.name || invoice?.customer_name || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">Address</div><div className="flex-1 whitespace-pre-line">{customer?.address || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">Phone</div><div className="flex-1">{customer?.phone || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">GSTIN</div><div className="flex-1 font-bold uppercase">{customer?.gst_number || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">PAN</div><div className="flex-1 font-bold uppercase">{customer?.pan || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">Place of Supply</div><div className="flex-1 font-semibold">{customer?.place_of_supply || customer?.state || '-'}</div></div>
                    </div>

                    {/* Column 2: Details of Consignee | Shipped to */}
                    <div className="col-span-4 p-2 border-r" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                      <div 
                        className="font-bold text-center border-b -mx-2 -mt-2 mb-1.5 p-1 text-[12px]" 
                        style={{ background: primaryBgLight || '#eaf2fb', borderColor: primaryColor || '#2f6fb0' }}
                      >
                        {getSectionLabel('shipped_to', 'Details of Consignee | Shipped to :')}
                      </div>
                      <div className="flex mb-0.5"><div className="w-16 shrink-0 font-bold">Name</div><div className="flex-1 font-semibold uppercase">{customer?.consignee_name || customer?.name || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-16 shrink-0 font-bold">Address</div><div className="flex-1 whitespace-pre-line">{customer?.consignee_address || customer?.address || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-16 shrink-0 font-bold">Country</div><div className="flex-1">{customer?.country || 'India'}</div></div>
                      <div className="flex mb-0.5"><div className="w-16 shrink-0 font-bold">Phone</div><div className="flex-1">{customer?.consignee_phone || customer?.phone || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-16 shrink-0 font-bold">GSTIN</div><div className="flex-1 font-bold uppercase">{customer?.consignee_gstin || customer?.gst_number || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-16 shrink-0 font-bold">State</div><div className="flex-1 font-semibold">{customer?.state || '-'}</div></div>
                    </div>

                    {/* Column 3: Invoice Meta */}
                    <div className="col-span-3 p-2 space-y-0.5">
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">Invoice No.</div><div className="flex-1 font-bold">{invoice?.invoice_number || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">Invoice Date</div><div className="flex-1">{formatDateSafe(invoice?.date, 'dd-MMM-yyyy')}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">Due Date</div><div className="flex-1">{formatDateSafe(invoice?.due_date || invoice?.date, 'dd-MMM-yyyy')}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">P.O. No.</div><div className="flex-1">{invoice?.po_number || '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">P.O. Date</div><div className="flex-1">{invoice?.po_date ? formatDateSafe(invoice.po_date, 'dd-MMM-yyyy') : '-'}</div></div>
                      <div className="flex mb-0.5"><div className="w-20 shrink-0 font-bold">E-Way No.</div><div className="flex-1">{invoice?.e_way_bill || '-'}</div></div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="border border-t-0 text-[12px] flex-1 flex flex-col justify-between" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="font-bold text-center" style={{ background: primaryBgLight || '#eaf2fb' }}>
                          <th className="border p-1.5 w-[35px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>Sr. No.</th>
                          <th className="border p-1.5 text-left" style={{ borderColor: primaryColor || '#2f6fb0' }}>{getColumnLabel('desc', 'Name of Product / Service')}</th>
                          {isHsnVisible && (
                            <th className="border p-1.5 w-[75px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>{getColumnLabel('hsn', 'HSN / SAC')}</th>
                          )}
                          <th className="border p-1.5 w-[75px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>{getColumnLabel('qty', 'Qty')}</th>
                          <th className="border p-1.5 w-[85px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>{getColumnLabel('rate', 'Rate')}</th>
                          <th className="border p-1.5 w-[110px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>{getColumnLabel('taxableValue', 'Taxable Value')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice?.items?.map((item: any, idx: number) => {
                          const qtyNum = Number(item.quantity || 0);
                          const priceNum = Number(item.price || 0);
                          const taxVal = qtyNum * priceNum;
                          return (
                            <tr key={idx} className="align-top">
                              <td className="border-l border-r p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>{idx + 1}</td>
                              <td className="border-l border-r p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                                <div className="font-bold">{getItemName(item)}</div>
                                {renderItemDetails(item, "italic text-[11px] text-gray-700 block")}
                              </td>
                              {isHsnVisible && (
                                <td className="border-l border-r p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>{item.hsn_code || item.hsn || '-'}</td>
                              )}
                              <td className="border-l border-r p-1.5 text-center font-semibold" style={{ borderColor: primaryColor || '#2f6fb0' }}>{qtyNum} {item.unit || ''}</td>
                              <td className="border-l border-r p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(priceNum, invoice?.currency)}</td>
                              <td className="border-l border-r p-1.5 text-right font-bold" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(taxVal, invoice?.currency)}</td>
                            </tr>
                          );
                        })}
                        {/* Spacer row to expand container cleanly */}
                        <tr className="h-full min-h-[40px] align-top">
                          <td className="border-l border-r p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                          <td className="border-l border-r p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                          {isHsnVisible && <td className="border-l border-r p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>}
                          <td className="border-l border-r p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                          <td className="border-l border-r p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                          <td className="border-l border-r p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                        </tr>
                        {/* GST tax row inside items table */}
                        {(calcGst?.cgst > 0 || calcGst?.sgst > 0 || calcGst?.igst > 0) && (
                          <tr className="border-t font-bold" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                            <td colSpan={2 + (isHsnVisible ? 1 : 0)}></td>
                            <td colSpan={2} className="p-1.5 text-right border-l border-r" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                              {calcGst.igst > 0 ? 'IGST' : 'CGST + SGST'}
                            </td>
                            <td className="p-1.5 text-right border-l border-r" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                              {calcGst.igst > 0 ? (
                                <div>{formatCurrency(calcGst.igst, invoice?.currency)}</div>
                              ) : (
                                <div>
                                  <div>CGST: {formatCurrency(calcGst.cgst, invoice?.currency)}</div>
                                  <div>SGST: {formatCurrency(calcGst.sgst, invoice?.currency)}</div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t font-bold" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                          <td colSpan={2 + (isHsnVisible ? 1 : 0)}></td>
                          <td className="p-1.5 text-right border-l border-r" style={{ borderColor: primaryColor || '#2f6fb0' }}>Total</td>
                          <td className="p-1.5 text-center border-l border-r font-black" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                            {invoice?.items?.reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0)}
                          </td>
                          <td className="p-1.5 text-right border-l border-r text-sm font-black" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                            ₹ {formatCurrency(invoice?.amount, invoice?.currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Total in words */}
                  <div className="border border-t-0 p-2 text-[12px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                    Total in words<br />
                    <b className="uppercase">{safeToWords(Number(invoice?.amount || 0), invoice?.currency)}</b>
                  </div>

                  {/* Tax Summary Table */}
                  {isSectionVisible('hsn_summary') && (
                    <table className="w-full border-collapse border border-t-0 text-[12px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                      <thead>
                        <tr style={{ background: primaryBgLight || '#eaf2fb' }}>
                          <th rowSpan={2} className="border p-1.5 text-left" style={{ borderColor: primaryColor || '#2f6fb0' }}>HSN / SAC</th>
                          <th rowSpan={2} className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>Taxable Value</th>
                          {calcGst.igst > 0 ? (
                            <th colSpan={2} className="border p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>IGST</th>
                          ) : (
                            <>
                              <th colSpan={2} className="border p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>CGST</th>
                              <th colSpan={2} className="border p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>SGST</th>
                            </>
                          )}
                          <th rowSpan={2} className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>Total Tax</th>
                        </tr>
                        <tr style={{ background: primaryBgLight || '#eaf2fb' }}>
                          {calcGst.igst > 0 ? (
                            <>
                              <th className="border p-1 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>%</th>
                              <th className="border p-1 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>Amount</th>
                            </>
                          ) : (
                            <>
                              <th className="border p-1 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>%</th>
                              <th className="border p-1 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>Amount</th>
                              <th className="border p-1 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>%</th>
                              <th className="border p-1 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>Amount</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(hsnSummary || {}).map(([hsn, d]: [string, any]) => (
                          <tr key={hsn}>
                            <td className="border p-1.5 text-left font-semibold" style={{ borderColor: primaryColor || '#2f6fb0' }}>{hsn}</td>
                            <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(d.taxable, invoice?.currency)}</td>
                            {calcGst.igst > 0 ? (
                              <>
                                <td className="border p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>{d.gstRate || 18}%</td>
                                <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(d.igst || d.tax, invoice?.currency)}</td>
                              </>
                            ) : (
                              <>
                                <td className="border p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>{(d.gstRate || 18)/2}%</td>
                                <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(d.cgst || (d.tax/2), invoice?.currency)}</td>
                                <td className="border p-1.5 text-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>{(d.gstRate || 18)/2}%</td>
                                <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(d.sgst || (d.tax/2), invoice?.currency)}</td>
                              </>
                            )}
                            <td className="border p-1.5 text-right font-bold" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(d.tax, invoice?.currency)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold border-t" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                          <td className="border p-1.5 text-left" style={{ borderColor: primaryColor || '#2f6fb0' }}>Total</td>
                          <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(totalTaxable, invoice?.currency)}</td>
                          {calcGst.igst > 0 ? (
                            <>
                              <td className="border p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                              <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(calcGst.igst, invoice?.currency)}</td>
                            </>
                          ) : (
                            <>
                              <td className="border p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                              <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(calcGst.cgst, invoice?.currency)}</td>
                              <td className="border p-1.5" style={{ borderColor: primaryColor || '#2f6fb0' }}></td>
                              <td className="border p-1.5 text-right" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(calcGst.sgst, invoice?.currency)}</td>
                            </>
                          )}
                          <td className="border p-1.5 text-right font-black" style={{ borderColor: primaryColor || '#2f6fb0' }}>{formatCurrency(calcGst.totalTax, invoice?.currency)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {/* Total Tax in Words */}
                  {isSectionVisible('hsn_summary') && (
                    <div className="border border-t-0 p-2 text-[12px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                      Total Tax in words: <b>{safeToWords(Number(calcGst.totalTax || 0), invoice?.currency)}</b>
                    </div>
                  )}

                  {/* Bank Details / Signatory Grid */}
                  <div className="grid grid-cols-12 border border-t-0 text-[12px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                    {/* Bank Col */}
                    <div className="col-span-8 border-r" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                      <div 
                        className="font-bold text-center p-1 border-b text-[12px]" 
                        style={{ background: primaryBgLight || '#eaf2fb', borderColor: primaryColor || '#2f6fb0' }}
                      >
                        Bank Details
                      </div>
                      <div className="flex">
                        <div className="p-2 flex-1 space-y-0.5">
                          <div className="flex"><div className="w-24 shrink-0 font-bold">Name</div><div>{sellerInfo?.bank_name || '-'}</div></div>
                          <div className="flex"><div className="w-24 shrink-0 font-bold">Branch</div><div>{sellerInfo?.bank_branch || '-'}</div></div>
                          <div className="flex"><div className="w-24 shrink-0 font-bold">Acc. Number</div><div>{sellerInfo?.account_number || '-'}</div></div>
                          <div className="flex"><div className="w-24 shrink-0 font-bold">IFSC</div><div>{sellerInfo?.ifsc_code || '-'}</div></div>
                          <div className="flex"><div className="w-24 shrink-0 font-bold">UPI ID</div><div>{sellerInfo?.upi_id || '-'}</div></div>
                        </div>
                        <div className="w-28 p-2 text-center border-l flex flex-col items-center justify-center" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                          {sellerInfo?.upi_id ? (
                            <QRCodeSVG 
                              value={`upi://pay?pa=${sellerInfo.upi_id}&pn=${encodeURIComponent(sellerInfo?.business_name || 'Business')}&am=${invoice?.amount || 0}&cu=INR`} 
                              size={80} 
                            />
                          ) : (
                            <div className="w-20 h-20 border border-dashed border-gray-400 flex items-center justify-center text-[10px] text-gray-400">UPI QR</div>
                          )}
                          <div className="text-[10px] mt-1 font-semibold">Pay using UPI</div>
                        </div>
                      </div>
                    </div>

                    {/* Signatory Col */}
                    <div className="col-span-4 p-2 text-center flex flex-col justify-between">
                      <div 
                        className="font-bold text-center p-1 border-b -mx-2 -mt-2 mb-1 text-[11px]" 
                        style={{ background: primaryBgLight || '#eaf2fb', borderColor: primaryColor || '#2f6fb0' }}
                      >
                        {declarationText || 'Certified that the particulars given above are true and correct.'}
                      </div>
                      <div className="font-bold text-[12px] my-1">For {sellerInfo?.business_name || 'Global Securities'}</div>
                      <div className="h-14 flex items-center justify-center">
                        {sellerInfo?.signature_url && isSectionVisible('signature') ? (
                          <img src={sellerInfo.signature_url} alt="Signature" className="max-h-14 object-contain" />
                        ) : null}
                      </div>
                      <div className="font-bold pt-1 border-t border-gray-300 text-[11px]">
                        {signatoryTitleText || 'Authorised Signatory'}
                      </div>
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="border border-t-0 text-[12px]" style={{ borderColor: primaryColor || '#2f6fb0' }}>
                    <div 
                      className="font-bold text-center p-1 border-b text-[12px]" 
                      style={{ background: primaryBgLight || '#eaf2fb', borderColor: primaryColor || '#2f6fb0' }}
                    >
                      Terms and Conditions
                    </div>
                    <div className="p-2 space-y-0.5 text-[11px]">
                      {termsText ? (
                        termsText.split('\n').map((termLine: string, idx: number) => (
                          <div key={idx}>{termLine}</div>
                        ))
                      ) : (
                        <>
                          <div>Subject to our home Jurisdiction.</div>
                          <div>Our Responsibility Ceases as soon as goods leaves our Premises.</div>
                          <div>Goods once sold will not taken back.</div>
                          <div>Delivery Ex-Premises.</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeBaseTemplate === 'tally_prime_gst' ? (
                <div className={`relative z-10 w-full flex flex-col flex-1 flex-grow justify-between min-h-full h-full font-sans text-black ${tallyConfig.borderThickness || 'border-2'} border-black bg-white p-0 text-[11px] leading-tight`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                  {/* Active Column Dragging Indicator */}
                  {resizingCol && (
                    <div className="bg-green-600 text-white text-xs font-bold px-3 py-1 text-center animate-pulse print:hidden">
                      ↔️ Resizing Khadi Line (Vertical Border Column Width)... Move mouse and release to set.
                    </div>
                  )}

                  {/* Top Header: Company Name & Contact */}
                  <div className="flex justify-between items-start border-b border-black p-3" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                    <div className="space-y-0.5">
                      <h1 className="text-base font-black uppercase tracking-wide text-blue-900">{sellerInfo?.business_name || 'N/A'}</h1>
                      {sellerInfo?.address && (
                        <p className="whitespace-pre-line text-[10px] text-gray-800 leading-snug">{sellerInfo.address}</p>
                      )}
                    </div>
                    <div className="text-right text-[10px] space-y-0.5 font-semibold">
                      <p>Name : <span className="font-normal">{sellerInfo?.contact_person || sellerInfo?.business_name || 'N/A'}</span></p>
                      <p>Phone : <span className="font-normal">{sellerInfo?.phone || 'N/A'}</span></p>
                    </div>
                  </div>

                  {/* Tax Invoice Banner Row with GSTIN */}
                  <div className="grid grid-cols-12 border-b border-black font-bold text-[10px] bg-gray-50 text-center items-center py-1.5 px-3" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                    <div className="col-span-4 text-left font-mono">
                      {tallyConfig.showGstin && sellerInfo?.gstin ? `GSTIN : ${sellerInfo.gstin}` : 'GSTIN : N/A'}
                    </div>
                    <div className="col-span-4 text-center tracking-widest text-xs font-black uppercase text-blue-900">
                      TAX INVOICE
                    </div>
                    <div className="col-span-4 text-right uppercase text-[9px] text-gray-700 tracking-wider">
                      ORIGINAL FOR RECIPIENT
                    </div>
                  </div>

                  {/* 3-Column Details Grid: Details of Buyer | Details of Consignee | Invoice Reference */}
                  <div className="grid grid-cols-12 border-b border-black text-[10px]" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                    {/* Column 1: Details of Buyer / Billed to */}
                    <div className="col-span-4 p-2.5 border-r border-black space-y-1" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                      <span className="text-[9px] font-bold uppercase block text-gray-600 border-b border-gray-300 pb-0.5 mb-1">Details of Buyer | Billed to :</span>
                      <p className="font-bold text-xs uppercase">{customer?.name || invoice?.customer_name || 'N/A'}</p>
                      <p className="whitespace-pre-line text-[10px] text-gray-800">{customer?.address || 'N/A'}</p>
                      <div className="pt-1 space-y-0.5 text-[10px]">
                        <p><span className="text-gray-600">Phone</span> : {customer?.phone || 'N/A'}</p>
                        <p><span className="text-gray-600">GSTIN</span> : <span className="font-bold uppercase">{customer?.gst_number || 'N/A'}</span></p>
                        <p><span className="text-gray-600">PAN</span> : <span className="font-bold uppercase">{customer?.pan || 'N/A'}</span></p>
                        <p><span className="text-gray-600">Place of Supply</span> : <span className="font-bold">{customer?.place_of_supply || customer?.state || 'N/A'}</span></p>
                      </div>
                    </div>

                    {/* Column 2: Details of Consignee / Shipped to */}
                    <div className="col-span-4 p-2.5 border-r border-black space-y-1" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                      <span className="text-[9px] font-bold uppercase block text-gray-600 border-b border-gray-300 pb-0.5 mb-1">Details of Consignee | Shipped to :</span>
                      <p className="font-bold text-xs uppercase">{customer?.consignee_name || sellerInfo?.business_name || 'N/A'}</p>
                      <p className="whitespace-pre-line text-[10px] text-gray-800">{customer?.consignee_address || sellerInfo?.address || 'N/A'}</p>
                      <div className="pt-1 space-y-0.5 text-[10px]">
                        <p><span className="text-gray-600">Country</span> : {customer?.country || 'N/A'}</p>
                        <p><span className="text-gray-600">Phone</span> : {customer?.consignee_phone || 'N/A'}</p>
                        <p><span className="text-gray-600">GSTIN</span> : <span className="font-bold uppercase">{customer?.consignee_gstin || 'N/A'}</span></p>
                        <p><span className="text-gray-600">State</span> : <span className="font-bold">{customer?.state || 'N/A'}</span></p>
                      </div>
                    </div>

                    {/* Column 3: Invoice References & Dates */}
                    <div className="col-span-4 p-2.5 space-y-1.5">
                      <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-600">Invoice No.</span>
                        <span className="font-bold">{invoice?.invoice_number || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-600">Invoice Date</span>
                        <span className="font-bold">{formatDateSafe(invoice?.date, 'dd-MMM-yyyy')}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-600">Due Date</span>
                        <span>{formatDateSafe(invoice?.due_date || invoice?.date, 'dd-MMM-yyyy')}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-600">P.O. No.</span>
                        <span>{invoice?.po_number || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-600">P.O. Date</span>
                        <span>{formatDateSafe(invoice?.po_date || invoice?.date, 'dd-MMM-yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">E-Way No.</span>
                        <span>{invoice?.e_way_bill || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Items Table Box with Draggable Khadi Lines & Vertical Border Columns */}
                  <DraggableBox id="tally_items_table" label="Items & Products Table" className="flex-1 flex-grow flex flex-col justify-between">
                    <div className="border-b border-black flex flex-col justify-between w-full flex-1 flex-grow h-full print:min-h-0" style={{ minHeight: `${paperSize === 'a5' ? 100 : (tallyConfig.tableMinHeight || 280)}px`, borderColor: tallyConfig.borderColor || '#000000' }}>
                      <table className="w-full text-left border-collapse table-fixed flex-1 h-full min-h-full">
                        <thead>
                          <tr className="border-b border-black bg-gray-100 text-[10px] font-bold text-center relative select-none" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                            <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.slNoWidth || 6}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                              Sl No.
                              <div 
                                onMouseDown={(e) => handleStartResize('slNo', 'desc', e)} 
                                className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                title="Drag vertical line (khadi line) to resize column"
                              >
                                <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                              </div>
                            </th>
                            <th className={`px-2 border-r border-black text-left relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.descWidth || 36}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                              Description of Goods
                              <div 
                                onMouseDown={(e) => handleStartResize('desc', columnVisibility.size ? 'size' : isHsnVisible ? 'hsn' : 'qty', e)} 
                                className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                title="Drag vertical line (khadi line) to resize column"
                              >
                                <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                              </div>
                            </th>
                            {columnVisibility.size && (
                              <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.sizeWidth || 6}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                                Size
                                <div 
                                  onMouseDown={(e) => handleStartResize('size', isHsnVisible ? 'hsn' : 'qty', e)} 
                                  className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                  title="Drag vertical line (khadi line) to resize column"
                                >
                                  <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                                </div>
                              </th>
                            )}
                            {isHsnVisible && (
                              <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.hsnWidth || 10}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                                HSN/SAC
                                <div 
                                  onMouseDown={(e) => handleStartResize('hsn', 'qty', e)} 
                                  className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                  title="Drag vertical line (khadi line) to resize column"
                                >
                                  <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                                </div>
                              </th>
                            )}
                            {columnVisibility.mrp && (
                              <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.mrpWidth || 10}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                                MRP
                                <div 
                                  onMouseDown={(e) => handleStartResize('mrp', 'qty', e)} 
                                  className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                  title="Drag vertical line (khadi line) to resize column"
                                >
                                  <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                                </div>
                              </th>
                            )}
                            <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.qtyWidth || 8}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                              Qty
                              <div 
                                onMouseDown={(e) => handleStartResize('qty', 'rate', e)} 
                                className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                title="Drag vertical line (khadi line) to resize column"
                              >
                                <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                              </div>
                            </th>
                            <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.rateWidth || 12}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                              Rate
                              <div 
                                onMouseDown={(e) => handleStartResize('rate', 'amt', e)} 
                                className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                title="Drag vertical line (khadi line) to resize column"
                              >
                                <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                              </div>
                            </th>
                            {columnVisibility.discount && (
                              <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.discWidth || 6}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                                Disc %
                                <div 
                                  onMouseDown={(e) => handleStartResize('disc', 'amt', e)} 
                                  className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                  title="Drag vertical line (khadi line) to resize column"
                                >
                                  <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                                </div>
                              </th>
                            )}
                            {columnVisibility.gstPercent && (
                              <th className={`px-1 border-r border-black relative ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.cgstWidth || 6}%`, borderColor: tallyConfig.borderColor || '#000000' }}>
                                GST %
                                <div 
                                  onMouseDown={(e) => handleStartResize('gst', 'amt', e)} 
                                  className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-green-500/60 transition-colors z-30 group print:hidden"
                                  title="Drag vertical line (khadi line) to resize column"
                                >
                                  <div className="w-0.5 h-full bg-green-600 opacity-0 group-hover:opacity-100 mx-auto" />
                                </div>
                              </th>
                            )}
                            <th className={`px-2 text-right relative whitespace-nowrap min-w-[75px] ${paperSize === 'a5' ? 'py-1' : 'py-1.5'}`} style={{ width: `${tallyConfig.amtWidth || 18}%` }}>
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="h-full">
                          {invoice?.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="text-[10px] align-top">
                              <td className={`px-1 border-r border-black text-center ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{idx + 1}</td>
                              <td className={`px-2 border-r border-black font-semibold ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                                <div className="break-words">{getItemName(item)}</div>
                                {renderItemDetails(item, "text-gray-600")}
                              </td>
                              {columnVisibility.size && (
                                <td className={`px-1 border-r border-black text-center ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{item.size || '-'}</td>
                              )}
                              {isHsnVisible && (
                                <td className={`px-1 border-r border-black text-center ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{item.hsn_code || item.hsn || '---'}</td>
                              )}
                              {columnVisibility.mrp && (
                                <td className={`px-1 border-r border-black text-right ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{formatCurrency(item.mrp || 0, invoice?.currency)}</td>
                              )}
                              <td className={`px-1 border-r border-black text-center font-bold ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{item.quantity}</td>
                              <td className={`px-1 border-r border-black text-right ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{formatCurrency(item.price, invoice?.currency)}</td>
                              {columnVisibility.discount && (
                                <td className={`px-1 border-r border-black text-center ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{item.discount || 0}%</td>
                              )}
                              {columnVisibility.gstPercent && (
                                <td className={`px-1 border-r border-black text-center ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`} style={{ borderColor: tallyConfig.borderColor || '#000000' }}>{item.gstPercent || 0}%</td>
                              )}
                              <td className={`px-2 text-right font-bold whitespace-nowrap tabular-nums min-w-[75px] ${paperSize === 'a5' ? 'py-0.5' : (tallyConfig.rowPadding || 'py-1')}`}>{formatCurrency(item.quantity * item.price, invoice?.currency)}</td>
                            </tr>
                          ))}

                          {/* Empty vertical column spacer row (creates the clean vertical space in the middle with NO horizontal lines) */}
                          <tr className={`h-full ${paperSize === 'a5' ? 'min-h-[20px]' : 'min-h-[60px]'} print:min-h-0 align-top`}>
                            <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            <td className="px-2 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            {columnVisibility.size && (
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            )}
                            {isHsnVisible && (
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            )}
                            {columnVisibility.mrp && (
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            )}
                            <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            {columnVisibility.discount && (
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            )}
                            {columnVisibility.gstPercent && (
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            )}
                            <td className="px-2"></td>
                          </tr>

                          {/* Optional additional custom empty rows if user explicitly requested them in customizer */}
                          {(tallyConfig.emptyRowsCount || 0) > 0 && Array.from({ length: Math.max(0, (tallyConfig.emptyRowsCount || 0) - (invoice?.items?.length || 0)) }).map((_, i) => (
                            <tr key={`empty-${i}`} className="h-7 text-center print:hidden empty-padding-row">
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              <td className="px-2 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              {columnVisibility.size && (
                                <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              )}
                              {isHsnVisible && (
                                <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              )}
                              {columnVisibility.mrp && (
                                <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              )}
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              {columnVisibility.discount && (
                                <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              )}
                              {columnVisibility.gstPercent && (
                                <td className="px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                              )}
                              <td className="px-2"></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-black bg-gray-100 font-bold text-xs text-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                            <td colSpan={2 + (columnVisibility.size ? 1 : 0) + (isHsnVisible ? 1 : 0) + (columnVisibility.mrp ? 1 : 0)} className="py-1.5 px-2 text-right font-bold uppercase border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}>
                              TOTAL
                            </td>
                            <td 
                              className="py-1.5 px-1 text-center font-black border-r border-black" 
                              style={{ 
                                borderColor: tallyConfig.borderColor || '#000000',
                                fontSize: '10px'
                              }}
                            >
                              {invoice?.items?.reduce((a: number, c: any) => a + Number(c.quantity || 0), 0)}
                            </td>
                            <td className="py-1.5 px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            {columnVisibility.discount && (
                              <td className="py-1.5 px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            )}
                            {columnVisibility.gstPercent && (
                              <td className="py-1.5 px-1 border-r border-black" style={{ borderColor: tallyConfig.borderColor || '#000000' }}></td>
                            )}
                            <td 
                              className="py-1.5 px-2 text-right font-black whitespace-nowrap tabular-nums text-sm min-w-[75px]"
                              style={{
                                fontWeight: 'bold',
                                fontSize: '10px',
                                lineHeight: '20px',
                                paddingLeft: '4px'
                              }}
                            >
                              {formatCurrency(invoice?.amount, invoice?.currency)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </DraggableBox>

                  {isSectionVisible('hsn_summary') && (
                    <DraggableBox id="tally_hsn_summary" label="HSN Tax breakdown Table" className="print-avoid-break break-inside-avoid">
                      <div className="border-b border-black w-full">
                        <div className="text-[9px] font-bold px-2 py-0.5 bg-gray-100 border-b border-black">HSN/SAC Tax Breakdown</div>
                        <table className="w-full text-center text-[9px] border-collapse">
                          <thead>
                            <tr className="border-b border-black bg-gray-50 font-bold">
                              <th className="p-1 border-r border-black">HSN/SAC</th>
                              <th className="p-1 border-r border-black">Taxable Value</th>
                              <th className="p-1 border-r border-black">Central Tax Rate</th>
                              <th className="p-1 border-r border-black">Central Tax Amt</th>
                              <th className="p-1 border-r border-black">State Tax Rate</th>
                              <th className="p-1 border-r border-black">State Tax Amt</th>
                              <th className="p-1">Total Tax Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/20">
                            {invoice?.items?.map((item: any, idx: number) => {
                              const taxRate = item.gstPercent || item.gst_rate || 0;
                              const taxableVal = item.quantity * item.price;
                              const cgstRate = taxRate / 2;
                              const cgstAmt = taxableVal * (cgstRate / 100);
                              const sgstRate = taxRate / 2;
                              const sgstAmt = taxableVal * (sgstRate / 100);
                              const totalTax = cgstAmt + sgstAmt;
                              return (
                                <tr key={idx}>
                                  <td className="p-1 border-r border-black font-semibold">{item.hsn_code || item.hsn || '---'}</td>
                                  <td className="p-1 border-r border-black whitespace-nowrap tabular-nums">{formatCurrency(taxableVal, invoice?.currency)}</td>
                                  <td className="p-1 border-r border-black">{cgstRate}%</td>
                                  <td className="p-1 border-r border-black whitespace-nowrap tabular-nums">{formatCurrency(cgstAmt, invoice?.currency)}</td>
                                  <td className="p-1 border-r border-black">{sgstRate}%</td>
                                  <td className="p-1 border-r border-black whitespace-nowrap tabular-nums">{formatCurrency(sgstAmt, invoice?.currency)}</td>
                                  <td className="p-1 font-bold whitespace-nowrap tabular-nums">{formatCurrency(totalTax, invoice?.currency)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </DraggableBox>
                  )}

                  {isSectionVisible('amount_in_words') && (
                    <DraggableBox id="tally_amount_words" label="Amount Chargeable In Words" className="print-avoid-break break-inside-avoid">
                      <div className="p-2 border-b border-black w-full">
                        <span className="font-semibold text-[10px]">Amount Chargeable (in words): </span>
                        <span className="font-black text-[11px] capitalize">{invoice?.amount_words || (invoice?.amount ? safeToWords(invoice.amount, invoice?.currency) : 'INR Only')}</span>
                      </div>
                    </DraggableBox>
                  )}

                  <DraggableBox id="tally_footer_block" label="Bank Details & Signature Footer" className="mt-auto flex-shrink-0 print-avoid-break break-inside-avoid">
                    <div className="grid grid-cols-12 text-[10px] w-full">
                      <div className="col-span-7 p-3 border-r border-black space-y-1">
                        {isSectionVisible('bank_details') && (
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <p className="font-bold underline text-[10px]">Company's Bank Details</p>
                              <p><span className="font-semibold">Bank Name:</span> {sellerInfo?.bank_name || 'N/A'}</p>
                              <p><span className="font-semibold">A/c No.:</span> {sellerInfo?.account_number || 'N/A'}</p>
                              <p><span className="font-semibold">Branch & IFS Code:</span> {sellerInfo?.bank_branch || ''} {sellerInfo?.ifsc_code ? `(${sellerInfo.ifsc_code})` : ''}</p>
                              {sellerInfo?.upi_id && <p><span className="font-semibold">UPI ID:</span> {sellerInfo.upi_id}</p>}
                            </div>
                            {upiUrl && (
                              <div className="flex flex-col items-center shrink-0 p-1.5 bg-white border border-black rounded text-center">
                                <span className="text-[7px] font-bold text-black uppercase mb-0.5">Scan to Pay</span>
                                <QRCodeSVG value={upiUrl} size={55} level="H" />
                                <span className="text-[7px] font-semibold text-black mt-0.5 max-w-[95px] truncate">{sellerInfo?.upi_id || sellerInfo?.upiId}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isSectionVisible('declaration') && (
                          <div className="mt-2 pt-1 border-t border-dashed border-gray-400 text-[9px]">
                            <span className="font-bold underline">Declaration:</span>
                            <p className="text-gray-700 italic leading-tight mt-0.5 whitespace-pre-line">{declarationText}</p>
                          </div>
                        )}

                        {isSectionVisible('terms') && (
                          <div className="mt-2 pt-1 border-t border-dashed border-gray-400 text-[9px]">
                            <span className="font-bold underline">Terms & Conditions:</span>
                            <p className="text-gray-700 leading-tight mt-0.5 whitespace-pre-line">{termsText}</p>
                          </div>
                        )}
                      </div>

                      {isSectionVisible('signature') && (
                        <div className="col-span-5 p-3 flex flex-col justify-between items-center text-center">
                          <div>
                            <p className="font-bold text-[10px]">For {sellerInfo?.business_name || 'N/A'}</p>
                          </div>
                          <div className="mt-6 text-center w-full flex flex-col items-center justify-center">
                            {sellerInfo?.signature_url ? (
                              <img src={sellerInfo.signature_url} alt="Signature" className="h-10 max-w-[120px] object-contain mb-1" />
                            ) : (
                              <div className="h-10"></div>
                            )}
                            <div className="border-t border-black w-36 pt-0.5 mx-auto">
                              <span className="font-bold text-[9px] uppercase tracking-wider">{signatoryTitleText}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </DraggableBox>
                </div>
              ) : activeBaseTemplate === 'tally_simple_bill' ? (
                <div className={cn(
                  "relative z-10 w-full flex flex-col flex-1 flex-grow justify-between min-h-full h-full font-mono text-black border-2 border-black bg-white leading-tight",
                  paperSize === 'a5' ? "p-2.5 text-[9.5px]" : "p-4 text-[11px]"
                )}>
                  {isSectionVisible('seller_address') && (
                    <DraggableBox id="tally_seller_branding" label="Seller Branding">
                      <div className={cn(
                        "text-center border-b-2 border-black space-y-0.5 w-full",
                        paperSize === 'a5' ? "pb-1.5 mb-1.5" : "pb-2 mb-2"
                      )}>
                        {tallyConfig.showLogo !== false && (sellerInfo?.logo_url || sellerInfo?.company_logo || sellerInfo?.logo) ? (
  <div className="relative group/logo inline-flex items-center mb-1">
    <img
      src={sellerInfo?.logo_url || sellerInfo?.company_logo || sellerInfo?.logo}
      alt="Logo"
      style={{ height: `${tallyConfig.logoHeight || 54}px`, maxHeight: "120px" }}
      className="w-auto object-contain shrink-0"
    />
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}
      className="no-print absolute -top-1.5 -right-1.5 bg-blue-600 text-white rounded-full p-1 opacity-0 group-hover/logo:opacity-100 transition-opacity shadow-sm hover:bg-blue-700 cursor-pointer"
      title="Change Company Logo"
    >
      <Edit3 size={10} />
    </button>
  </div>
) : null}
                        <h1 className={cn(
                          "font-black uppercase tracking-wider",
                          paperSize === 'a5' ? "text-base" : "text-lg"
                        )}>{sellerInfo?.business_name || ''}</h1>
                        {sellerInfo?.address && (
                          <p className={cn(
                            "whitespace-pre-line",
                            paperSize === 'a5' ? "text-[9px]" : "text-[10px]"
                          )}>{sellerInfo.address}</p>
                        )}
                        <p className={cn(
                          "font-bold",
                          paperSize === 'a5' ? "text-[9px]" : "text-[10px]"
                        )}>Ph: {sellerInfo?.phone} | Email: {sellerInfo?.email}</p>
                        {sellerInfo?.gstin && <p className={cn(
                          "font-bold",
                          paperSize === 'a5' ? "text-[9px]" : "text-[10px]"
                        )}>GSTIN: {sellerInfo.gstin}</p>}
                        <div className="pt-0.5">
                          <span className={cn(
                            "border border-black font-bold tracking-widest uppercase inline-block",
                            paperSize === 'a5' ? "px-2.5 py-0.5 text-[10px]" : "px-4 py-0.5 text-xs"
                          )}>{invoiceTitleText}</span>
                        </div>
                      </div>
                    </DraggableBox>
                  )}

                  {isSectionVisible('customer_gstin') && (
                    <DraggableBox id="tally_buyer_consignee" label="Buyer & Consignee">
                      <div className={cn(
                        "grid grid-cols-12 border border-black divide-x divide-black w-full",
                        paperSize === 'a5' ? "mb-1.5 text-[9px]" : "mb-2 text-[10px]"
                      )}>
                        <div className={cn(
                          "col-span-7 space-y-0.5",
                          paperSize === 'a5' ? "p-1.5" : "p-3"
                        )}>
                          <p className="font-bold underline text-[8px] sm:text-[9px]">PARTY DETAILS:</p>
                          <p className={cn(
                            "font-black uppercase truncate",
                            paperSize === 'a5' ? "text-[11px]" : "text-xs"
                          )}>{customer?.name || invoice?.customer_name || ''}</p>
                          <p className="whitespace-pre-line text-[9px] sm:text-[10px] line-clamp-2">{customer?.address || ''}</p>
                          {customer?.gst_number && (
                            <p><span className="font-semibold">GSTIN/UIN:</span> {customer.gst_number}</p>
                          )}
                          <p><span className="font-semibold">State:</span> {customer?.place_of_supply || customer?.state || ''}</p>
                        </div>
                        <div className={cn(
                          "col-span-5 space-y-0.5",
                          paperSize === 'a5' ? "p-1.5" : "p-3"
                        )}>
                          <p><span className="font-bold">Invoice No:</span> {invoice?.invoice_number || invoice?.id?.slice(0, 8)?.toUpperCase() || ''}</p>
                          <p><span className="font-bold">Date:</span> {formatDateSafe(invoice?.date, 'dd/MM/yyyy')}</p>
                          <p><span className="font-bold">Place of Supply:</span> {customer?.place_of_supply || ''}</p>
                          <p><span className="font-bold">Payment Mode:</span> {invoice?.payment_terms || ''}</p>
                        </div>
                      </div>
                    </DraggableBox>
                  )}

                  <DraggableBox id="tally_items_table" label="Items & Products Table" className="flex-1 flex flex-col justify-between">
                    <table className={cn(
                      "w-full border border-black text-left border-collapse",
                      paperSize === 'a5' ? "text-[9px] mb-1.5" : "text-[10px] mb-2"
                    )}>
                      <thead>
                        <tr className="border-b border-black bg-gray-100 font-bold text-center">
                          <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-6 sm:w-8" : "py-2 px-1.5 w-8")}>Sl.</th>
                          <th className={cn("border-r border-black text-left", paperSize === 'a5' ? "py-1 px-1.5" : "py-2 px-1.5")}>Particulars</th>
                          {isHsnVisible && <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-12" : "py-2 px-1.5 w-16")}>HSN</th>}
                          <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-10" : "py-2 px-1.5 w-12")}>Qty</th>
                          <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-14" : "py-2 px-1.5 w-16")}>Rate</th>
                          <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-10" : "py-2 px-1.5 w-12")}>Disc %</th>
                          <th className={cn("text-right", paperSize === 'a5' ? "py-1 px-1.5 w-16" : "py-2 px-1.5 w-20")}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice?.items?.map((item: any, idx: number) => (
                          <tr key={idx} className="align-top">
                            <td className={cn("border-r border-black text-center", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{idx + 1}</td>
                            <td className={cn("border-r border-black font-semibold", paperSize === 'a5' ? "py-1 px-1.5" : "py-1.5 px-1.5")}>
                              <div className="break-words">{getItemName(item)}</div>
                              {renderItemDetails(item, "text-gray-600")}
                            </td>
                            {isHsnVisible && <td className={cn("border-r border-black text-center", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{item.hsn_code || item.hsn || '---'}</td>}
                            <td className={cn("border-r border-black text-center font-bold", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{item.quantity}</td>
                            <td className={cn("border-r border-black text-right", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{formatCurrency(item.price, invoice?.currency)}</td>
                            <td className={cn("border-r border-black text-center", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{item.discount || 0}%</td>
                            <td className={cn("text-right font-bold", paperSize === 'a5' ? "py-1 px-1.5" : "py-1.5 px-1.5")}>{formatCurrency(item.quantity * item.price * (1 - (item.discount || 0)/100), invoice?.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DraggableBox>

                  <DraggableBox id="tally_footer_block" label="Terms, Bank & Signatures" className="mt-auto shrink-0">
                    <div className="w-full">
                      <div className={cn(
                        "flex justify-between items-start border border-black w-full",
                        paperSize === 'a5' ? "p-1.5 mb-1.5" : "p-3 mb-2"
                      )}>
                        <div className={cn(
                          "w-1/2 space-y-1",
                          paperSize === 'a5' ? "text-[8px]" : "text-[9px]"
                        )}>
                          {isSectionVisible('terms') && (
                            <>
                              <p className="font-bold underline">Terms & Conditions:</p>
                              <p className="whitespace-pre-line leading-tight">{termsText}</p>
                            </>
                          )}
                          {isSectionVisible('declaration') && (
                            <div className="mt-0.5">
                              <p className="font-bold underline">Declaration:</p>
                              <p className="whitespace-pre-line text-[#4b5563] leading-tight">{declarationText}</p>
                            </div>
                          )}
                          {isSectionVisible('bank_details') && sellerInfo?.bank_name && (
                            <div className="mt-1 flex items-start justify-between gap-1.5 border-t border-dashed border-gray-300 pt-1">
                              <div className="space-y-0.5">
                                <p className="font-bold underline">Bank Details:</p>
                                <p>{sellerInfo.bank_name} | A/C: {sellerInfo.account_number} | IFSC: {sellerInfo.ifsc_code}</p>
                                {sellerInfo?.upi_id && <p>UPI ID: {sellerInfo.upi_id}</p>}
                              </div>
                              {upiUrl && (
                                <div className="flex flex-col items-center shrink-0 p-1 bg-white border border-black rounded text-center">
                                  <span className="text-[6px] font-bold text-black uppercase mb-0.5">UPI Scan</span>
                                  <QRCodeSVG value={upiUrl} size={paperSize === 'a5' ? 36 : 45} level="H" />
                                  <span className="text-[6px] font-semibold text-black mt-0.5 max-w-[70px] truncate">{sellerInfo?.upi_id || sellerInfo?.upiId}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className={cn(
                          "w-1/2 pl-3 border-l border-black text-right font-bold space-y-0.5",
                          paperSize === 'a5' ? "text-[9px]" : "text-[10px]"
                        )}>
                          <div className="flex justify-between"><span>Sub Total:</span><span>{formatCurrency(rawSubtotal, invoice?.currency)}</span></div>
                          {totalDiscount > 0 && <div className="flex justify-between text-red-600"><span>Discount:</span><span>-{formatCurrency(totalDiscount, invoice?.currency)}</span></div>}
                          {hasGST && <div className="flex justify-between"><span>GST Tax:</span><span>+{formatCurrency(totalGst, invoice?.currency)}</span></div>}
                          <div className={cn(
                            "flex justify-between border-t border-b border-black py-0.5 font-black",
                            paperSize === 'a5' ? "text-xs" : "text-sm"
                          )}>
                            <span>GRAND TOTAL:</span>
                            <span>{formatCurrency(invoice?.amount, invoice?.currency)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={cn(
                        "flex justify-between items-end w-full",
                        paperSize === 'a5' ? "pt-1 text-[9px]" : "pt-2 text-[10px]"
                      )}>
                        <div>
                          <span className="font-semibold">Customer Signature</span>
                        </div>
                        {isSectionVisible('signature') && (
                          <div className="text-center flex flex-col items-center justify-center">
                            <p className="font-bold">For {sellerInfo?.business_name || ''}</p>
                            <div className={cn("flex items-center justify-center", paperSize === 'a5' ? "h-6 mt-0.5" : "h-8 mt-1")}>
                              {sellerInfo?.signature_url ? (
                                <img src={sellerInfo.signature_url} alt="Signature" className={cn("object-contain", paperSize === 'a5' ? "h-6 max-w-[80px]" : "h-8 max-w-[100px]")} />
                              ) : (
                                <div className={paperSize === 'a5' ? "h-6" : "h-8"}></div>
                              )}
                            </div>
                            <p className="font-bold uppercase text-[8px] sm:text-[9px] border-t border-black px-3 inline-block pt-0.5 mx-auto">{signatoryTitleText}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </DraggableBox>
                </div>
              ) : activeBaseTemplate === 'tally_bill_of_supply' ? (
                <div className={cn(
                  "relative z-10 w-full flex flex-col flex-1 flex-grow justify-between min-h-full h-full font-sans text-black border-2 border-black bg-white leading-tight",
                  paperSize === 'a5' ? "p-0 text-[9.5px]" : "p-0 text-[11px]"
                )}>
                  {isSectionVisible('seller_address') && (
                    <DraggableBox id="tally_seller_branding" label="Seller Branding">
                      <div className="w-full">
                        <div className={cn(
                          "bg-gray-200 border-b border-black text-center font-black uppercase tracking-wide",
                          paperSize === 'a5' ? "py-0.5 text-[8px]" : "py-1 text-[10px]"
                        )}>
                          COMPOSITION TAXABLE PERSON, NOT ELIGIBLE TO COLLECT TAX ON SUPPLIES
                        </div>

                        <div className={cn(
                          "text-center font-bold uppercase border-b border-black tracking-widest",
                          paperSize === 'a5' ? "text-sm py-1" : "text-base py-1.5"
                        )}>
                          BILL OF SUPPLY
                        </div>
                      </div>
                    </DraggableBox>
                  )}

                  {isSectionVisible('customer_gstin') && (
                    <DraggableBox id="tally_buyer_consignee" label="Buyer & Consignee">
                      <div className={cn(
                        "grid grid-cols-12 border-b border-black divide-x divide-black w-full",
                        paperSize === 'a5' ? "text-[9px]" : "text-[10px]"
                      )}>
                        <div className={cn("col-span-6 space-y-0.5", paperSize === 'a5' ? "p-2" : "p-3")}>
                          <h2 className={cn("font-black uppercase truncate", paperSize === 'a5' ? "text-xs" : "text-sm")}>{sellerInfo?.business_name || ''}</h2>
                          {sellerInfo?.address && (
                            <p className="whitespace-pre-line text-[9px] line-clamp-2">{sellerInfo.address}</p>
                          )}
                          <p className="font-bold">GSTIN/UIN: {sellerInfo?.gstin || ''}</p>
                          <p>State: {sellerInfo?.state || ''}</p>
                        </div>
                        <div className={cn("col-span-6 space-y-0.5", paperSize === 'a5' ? "p-2" : "p-3")}>
                          <p><span className="font-bold">Bill No.:</span> {invoice?.invoice_number || invoice?.id?.slice(0, 8)?.toUpperCase() || ''}</p>
                          <p><span className="font-bold">Date:</span> {formatDateSafe(invoice?.date, 'dd-MMM-yyyy')}</p>
                          <p className="font-bold underline text-[8px] sm:text-[9px] mt-0.5">RECIPIENT (BUYER):</p>
                          <p className={cn("font-bold truncate", paperSize === 'a5' ? "text-[11px]" : "text-xs")}>{customer?.name || invoice?.customer_name || ''}</p>
                          <p className="whitespace-pre-line text-[9px] line-clamp-2">{customer?.address || ''}</p>
                        </div>
                      </div>
                    </DraggableBox>
                  )}

                  <DraggableBox id="tally_items_table" label="Items & Products Table" className="flex-1 flex flex-col justify-between">
                    <div className={cn(
                      "border-b border-black flex flex-col justify-between w-full flex-1",
                      paperSize === 'a5' ? "min-h-[140px]" : "min-h-[220px]"
                    )}>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={cn(
                            "border-b border-black bg-gray-100 font-bold text-center",
                            paperSize === 'a5' ? "text-[9px]" : "text-[10px]"
                          )}>
                            <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-6 sm:w-8" : "py-2 px-1.5 w-10")}>Sl.</th>
                            <th className={cn("border-r border-black text-left", paperSize === 'a5' ? "py-1 px-1.5" : "py-2 px-2")}>Description of Goods / Services</th>
                            {isHsnVisible && <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-14" : "py-2 px-1.5 w-20")}>HSN/SAC</th>}
                            <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-10" : "py-2 px-1.5 w-16")}>Qty</th>
                            <th className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1 w-14" : "py-2 px-1.5 w-20")}>Rate</th>
                            <th className={cn("text-right", paperSize === 'a5' ? "py-1 px-1.5 w-16" : "py-2 px-2 w-24")}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice?.items?.map((item: any, idx: number) => (
                            <tr key={idx} className={cn("align-top", paperSize === 'a5' ? "text-[9px]" : "text-[10px]")}>
                              <td className={cn("border-r border-black text-center", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{idx + 1}</td>
                              <td className={cn("border-r border-black font-semibold", paperSize === 'a5' ? "py-1 px-1.5" : "py-1.5 px-2")}>
                                <div className="break-words">{getItemName(item)}</div>
                                {renderItemDetails(item, "text-gray-600")}
                              </td>
                              {isHsnVisible && <td className={cn("border-r border-black text-center", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{item.hsn_code || item.hsn || '---'}</td>}
                              <td className={cn("border-r border-black text-center font-bold", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{item.quantity}</td>
                              <td className={cn("border-r border-black text-right", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1.5")}>{formatCurrency(item.price, invoice?.currency)}</td>
                              <td className={cn("text-right font-bold", paperSize === 'a5' ? "py-1 px-1.5" : "py-1.5 px-2")}>{formatCurrency(item.quantity * item.price, invoice?.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={cn("border-t-2 border-black bg-gray-100 font-bold text-black", paperSize === 'a5' ? "text-[10px]" : "text-xs")}>
                            <td colSpan={2 + (isHsnVisible ? 1 : 0)} className={cn("text-right font-bold uppercase border-r border-black", paperSize === 'a5' ? "py-1 px-1.5" : "py-1.5 px-2")}>Total</td>
                            <td className={cn("text-center font-black border-r border-black", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1")}>{invoice?.items?.reduce((a: number, c: any) => a + Number(c.quantity || 0), 0)}</td>
                            <td className={cn("border-r border-black", paperSize === 'a5' ? "py-1 px-1" : "py-1.5 px-1")}></td>
                            <td className={cn("text-right font-black", paperSize === 'a5' ? "py-1 px-1.5 text-xs" : "py-1.5 px-2 text-sm")}>{formatCurrency(invoice?.amount, invoice?.currency)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </DraggableBox>

                  <DraggableBox id="tally_footer_block" label="Terms, Bank & Signatures" className="mt-auto shrink-0">
                    <div className="w-full">
                      <div className={cn(
                        "border-b border-black space-y-0.5 w-full",
                        paperSize === 'a5' ? "p-2 text-[9px]" : "p-3 text-[10px]"
                      )}>
                        {isSectionVisible('amount_in_words') && (
                          <p><span className="font-bold">Amount in Words:</span> <span className="font-bold capitalize">{invoice?.amount_words}</span></p>
                        )}
                        {isSectionVisible('declaration') && (
                          <p className="text-[8px] sm:text-[9px] text-gray-700 italic">Declaration: Composition taxable person, not eligible to collect tax on supplies under CGST Act.</p>
                        )}
                      </div>

                      <div className={cn(
                        "flex justify-between items-end w-full",
                        paperSize === 'a5' ? "p-2" : "p-3"
                      )}>
                        <div>
                          {isSectionVisible('bank_details') && sellerInfo?.bank_name && (
                            <div className={cn(
                              "flex items-start gap-2",
                              paperSize === 'a5' ? "text-[8px]" : "text-[9px]"
                            )}>
                              <div className="space-y-0.5">
                                <p className="font-bold underline">Bank Details:</p>
                                <p>{sellerInfo?.bank_name} - A/c: {sellerInfo?.account_number}</p>
                                <p>IFS: {sellerInfo?.ifsc_code}</p>
                                {sellerInfo?.upi_id && <p>UPI ID: {sellerInfo.upi_id}</p>}
                              </div>
                              {upiUrl && (
                                <div className="flex flex-col items-center shrink-0 p-1 bg-white border border-black rounded text-center">
                                  <span className="text-[6px] font-bold text-black uppercase mb-0.5">UPI Scan</span>
                                  <QRCodeSVG value={upiUrl} size={paperSize === 'a5' ? 36 : 45} level="H" />
                                  <span className="text-[6px] font-semibold text-black mt-0.5 max-w-[70px] truncate">{sellerInfo?.upi_id || sellerInfo?.upiId}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isSectionVisible('signature') && (
                          <div className="text-center flex flex-col items-center">
                            <p className={cn("font-bold", paperSize === 'a5' ? "text-[9px]" : "text-[10px]")}>For {sellerInfo?.business_name}</p>
                            <div className={cn("flex items-center justify-center", paperSize === 'a5' ? "h-6 mt-0.5" : "h-8 mt-1")}>
                              {sellerInfo?.signature_url ? (
                                <img src={sellerInfo.signature_url} alt="Signature" className={cn("object-contain", paperSize === 'a5' ? "h-6 max-w-[80px]" : "h-8 max-w-[100px]")} />
                              ) : (
                                <div className={paperSize === 'a5' ? "h-6" : "h-8"}></div>
                              )}
                            </div>
                            <p className={cn("font-bold border-t border-black pt-0.5 mx-auto", paperSize === 'a5' ? "text-[8px] w-24" : "text-[9px] w-32")}>{signatoryTitleText}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </DraggableBox>
                </div>
              ) : activeBaseTemplate === 'tally_export_invoice' ? (
                <div className="relative z-10 w-full flex flex-col flex-1 flex-grow justify-between min-h-full h-full font-sans text-black border-2 border-black bg-white p-0 text-[11px] leading-tight">
                  <DraggableBox id="tally_seller_branding" label="Export Header & Supplier">
                    <div className="w-full">
                      <div className="text-center font-bold text-sm uppercase py-1.5 border-b border-black tracking-widest bg-gray-50">
                        TAX INVOICE - EXPORT / INTERSTATE
                        <p className="text-[9px] font-normal tracking-normal text-gray-700">SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX (IGST) / UNDER LUT</p>
                      </div>

                      <div className="grid grid-cols-12 border-b border-black divide-x divide-black">
                        <div className="col-span-6 p-3 space-y-1">
                          <span className="text-[9px] font-bold uppercase underline">EXPORTER / SUPPLIER:</span>
                          <h2 className="font-black text-sm uppercase">{sellerInfo?.business_name || ''}</h2>
                          {isSectionVisible('seller_address') && sellerInfo?.address && (
                            <p className="whitespace-pre-line text-[10px]">{sellerInfo.address}</p>
                          )}
                          <p className="font-bold">GSTIN: {sellerInfo?.gstin || ''}</p>
                          <p>IEC Code: {sellerInfo?.iec_code || ''}</p>
                        </div>
                        <div className="col-span-6 p-3 space-y-1">
                          <span className="text-[9px] font-bold uppercase underline">OVERSEAS BUYER / CONSIGNEE:</span>
                          <p className="font-bold text-xs uppercase">{customer?.name || invoice?.customer_name || ''}</p>
                          <p className="whitespace-pre-line text-[10px]">{customer?.address || ''}</p>
                          <p><span className="font-bold">Country of Destination:</span> {customer?.country || ''}</p>
                          <p><span className="font-bold">Port of Discharge:</span> {invoice?.port_of_discharge || ''}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 border-b border-black divide-x divide-black text-[10px]">
                        <div className="col-span-3 p-1.5">
                          <span className="text-[9px] text-gray-600 block">Invoice No. & Date</span>
                          <span className="font-bold">{invoice?.invoice_number || invoice?.id?.slice(0, 8)?.toUpperCase() || ''} ({formatDateSafe(invoice?.date, 'dd-MMM-yyyy')})</span>
                        </div>
                        <div className="col-span-3 p-1.5">
                          <span className="text-[9px] text-gray-600 block">Shipping Bill No. & Date</span>
                          <span className="font-bold">{invoice?.shipping_bill_no || ''}</span>
                        </div>
                        <div className="col-span-3 p-1.5">
                          <span className="text-[9px] text-gray-600 block">Port Code</span>
                          <span className="font-bold">{invoice?.port_code || ''}</span>
                        </div>
                        <div className="col-span-3 p-1.5">
                          <span className="text-[9px] text-gray-600 block">LUT / Bond Ref</span>
                          <span className="font-bold">{invoice?.lut_number || ''}</span>
                        </div>
                      </div>
                    </div>
                  </DraggableBox>

                  <DraggableBox id="tally_items_table" label="Export Goods Table">
                    <div className="border-b border-black min-h-[200px] w-full">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-black bg-gray-100 text-[10px] font-bold text-center">
                            <th className="py-2 px-1.5 border-r border-black w-10">Sl.</th>
                            <th className="py-2 px-2 border-r border-black text-left">Description of Goods</th>
                            {isHsnVisible && <th className="py-2 px-1.5 border-r border-black w-20">HSN/SAC</th>}
                            <th className="py-2 px-1.5 border-r border-black w-16">Qty</th>
                            <th className="py-2 px-1.5 border-r border-black w-20">Rate</th>
                            <th className="py-2 px-1.5 border-r border-black w-16">IGST %</th>
                            <th className="py-2 px-2 text-right w-24">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice?.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="text-[10px] align-top">
                              <td className="py-1.5 px-1.5 border-r border-black text-center">{idx + 1}</td>
                              <td className="py-1.5 px-2 border-r border-black font-semibold">
                                <div>{getItemName(item)}</div>
                                {renderItemDetails(item, "text-gray-600")}
                              </td>
                              {isHsnVisible && <td className="py-1.5 px-1.5 border-r border-black text-center">{item.hsn_code || item.hsn || '---'}</td>}
                              <td className="py-1.5 px-1.5 border-r border-black text-center font-bold">{item.quantity}</td>
                              <td className="py-1.5 px-1.5 border-r border-black text-right">{formatCurrency(item.price, invoice?.currency)}</td>
                              <td className="py-1.5 px-1.5 border-r border-black text-center font-bold">{item.gstPercent || 18}%</td>
                              <td className="py-1.5 px-2 text-right font-bold">{formatCurrency(item.quantity * item.price, invoice?.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DraggableBox>

                  <DraggableBox id="tally_footer_block" label="Terms & Signatures">
                    <div className="w-full">
                      <div className="p-3 border-b border-black flex justify-between font-bold text-xs bg-gray-50 w-full">
                        <span>Total Amount Payable</span>
                        <span className="font-black text-sm">{formatCurrency(invoice?.amount, invoice?.currency)}</span>
                      </div>

                      <div className="p-3 flex justify-between items-end w-full">
                        <div className="text-[10px] space-y-1">
                          {isSectionVisible('amount_in_words') && (
                            <p><span className="font-bold">Amount in Words:</span> <span className="font-bold capitalize">{invoice?.amount_words}</span></p>
                          )}
                          {isSectionVisible('declaration') && (
                            <p className="text-[9px] text-gray-600">Declaration: Exported under LUT without payment of IGST under Rule 96A.</p>
                          )}
                          {isSectionVisible('bank_details') && sellerInfo?.bank_name && (
                            <div className="text-[9px] pt-2 flex items-start gap-3 border-t border-dashed border-gray-300 mt-2">
                              <div>
                                <p className="font-bold underline">Bank Details:</p>
                                <p>{sellerInfo?.bank_name} - A/c: {sellerInfo?.account_number} - IFS: {sellerInfo?.ifsc_code}</p>
                                {sellerInfo?.upi_id && <p>UPI ID: {sellerInfo.upi_id}</p>}
                              </div>
                              {upiUrl && (
                                <div className="flex flex-col items-center shrink-0 p-1 bg-white border border-black rounded text-center">
                                  <span className="text-[6px] font-bold text-black uppercase mb-0.5">UPI Scan & Pay</span>
                                  <QRCodeSVG value={upiUrl} size={45} level="H" />
                                  <span className="text-[6px] font-semibold text-black mt-0.5 max-w-[80px] truncate">{sellerInfo?.upi_id || sellerInfo?.upiId}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isSectionVisible('signature') && (
                          <div className="text-center flex flex-col items-center">
                            <p className="font-bold text-[10px]">For {sellerInfo?.business_name}</p>
                            <div className="h-8 flex items-center justify-center">
                              {sellerInfo?.signature_url ? (
                                <img src={sellerInfo.signature_url} alt="Signature" className="h-8 max-w-[100px] object-contain" />
                              ) : (
                                <div className="h-8"></div>
                              )}
                            </div>
                            <p className="font-bold text-[9px] border-t border-black pt-0.5 w-32 mx-auto">{signatoryTitleText}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </DraggableBox>
                </div>
              ) : activeBaseTemplate === 'tally_pos_voucher' ? (
                <div className="relative z-10 w-full flex flex-col font-mono text-black border-2 border-black bg-white p-5 text-[11px] leading-tight max-w-[500px] mx-auto shadow-md">
                  <DraggableBox id="tally_seller_branding" label="POS Voucher Header">
                    <div className="text-center pb-2 border-b-2 border-dashed border-black mb-2 space-y-0.5 w-full">
                      <p className="text-[9px] font-bold tracking-widest text-gray-600 uppercase">*** TALLY POS SALES VOUCHER ***</p>
                      <h1 className="text-base font-black uppercase">{sellerInfo?.business_name || ''}</h1>
                      {isSectionVisible('seller_address') && sellerInfo?.address && (
                        <p className="text-[10px] whitespace-pre-line">{sellerInfo.address}</p>
                      )}
                      <p className="text-[10px]">Ph: {sellerInfo?.phone} | GSTIN: {sellerInfo?.gstin || ''}</p>
                    </div>
                  </DraggableBox>

                  <DraggableBox id="tally_buyer_consignee" label="Voucher & Customer Info">
                    <div className="text-[10px] space-y-0.5 mb-2 pb-2 border-b border-dashed border-black w-full">
                      <div className="flex justify-between"><span>Voucher No: <span className="font-bold">{invoice?.invoice_number || invoice?.id?.slice(0, 8)?.toUpperCase() || ''}</span></span><span>Date: <span className="font-bold">{formatDateSafe(invoice?.date, 'dd/MM/yyyy')}</span></span></div>
                      <div className="flex justify-between"><span>Counter: <span className="font-bold">{invoice?.pos_counter || ''}</span></span><span>Customer: <span className="font-bold">{customer?.name || invoice?.customer_name || ''}</span></span></div>
                    </div>
                  </DraggableBox>

                  <DraggableBox id="tally_items_table" label="POS Items List">
                    <table className="w-full text-left text-[10px] mb-2 border-collapse">
                      <thead>
                        <tr className="border-b border-black font-bold">
                          <th className="py-1.5">Item Particulars</th>
                          <th className="py-1.5 text-center w-10">Qty</th>
                          <th className="py-1.5 text-right w-16">Rate</th>
                          <th className="py-1.5 text-right w-16">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dashed divide-black/40">
                        {invoice?.items?.map((item: any, idx: number) => (
                          <tr key={idx} className="align-top">
                            <td className="py-1.5 font-semibold">
                              <div>{getItemName(item)}</div>
                                {renderItemDetails(item, "text-gray-600")}
                            </td>
                            <td className="py-1.5 text-center font-bold">{item.quantity}</td>
                            <td className="py-1.5 text-right">{formatCurrency(item.price, invoice?.currency)}</td>
                            <td className="py-1.5 text-right font-bold">{formatCurrency(item.quantity * item.price, invoice?.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DraggableBox>

                  <DraggableBox id="tally_footer_block" label="Payable & POS Footer">
                    <div className="w-full">
                      <div className="border-t-2 border-b-2 border-black py-2 mb-2 space-y-1 font-bold text-xs w-full">
                        <div className="flex justify-between text-base font-black">
                          <span>NET PAYABLE:</span>
                          <span>{formatCurrency(invoice?.amount, invoice?.currency)}</span>
                        </div>
                        <div className="text-[9px] pt-1 border-t border-dashed border-black space-y-0.5 font-normal">
                          <div className="flex justify-between"><span>Payment Mode:</span><span className="font-bold">{invoice?.payment_terms || ''}</span></div>
                          <div className="flex justify-between"><span>Cash Tendered:</span><span>{formatCurrency(invoice?.amount, invoice?.currency)}</span></div>
                          <div className="flex justify-between"><span>Balance Returned:</span><span>₹ 0.00</span></div>
                        </div>
                      </div>

                      <div className="text-center pt-1 space-y-1 w-full flex flex-col items-center">
                        <p className="text-[10px] font-bold tracking-widest uppercase">Thank You! Visit Again</p>
                        <p className="text-[8px] italic text-gray-600">E. & O.E. | Computer Generated Voucher</p>
                        {upiUrl && (
                          <div className="flex flex-col items-center my-2 p-1.5 bg-white border border-black rounded text-center">
                            <span className="text-[6px] font-bold text-black uppercase mb-0.5">UPI QR to Pay: {sellerInfo?.business_name}</span>
                            <QRCodeSVG value={upiUrl} size={50} level="H" />
                            <span className="text-[6px] font-semibold text-black mt-0.5">{sellerInfo?.upi_id || sellerInfo?.upiId}</span>
                          </div>
                        )}
                        <p className="text-[9px] font-bold">For {sellerInfo?.business_name}</p>
                      </div>
                    </div>
                  </DraggableBox>
                </div>
              ) : activeBaseTemplate === 'thermal' ? (
                /* ── POS THERMAL 80mm TEMPLATE ── */
                <div className="thermal-invoice-container w-full bg-white text-black font-mono text-[11px] leading-tight p-2" style={{ width: '80mm', maxWidth: '80mm', margin: '0 auto', fontFamily: "'JetBrains Mono', Courier, monospace" }}>
                  {/* Header */}
                  <div className="text-center border-b border-black pb-1 mb-1">
                    {sellerInfo?.logo_url && (
                      <img src={sellerInfo.logo_url} alt="Logo" className="h-8 mx-auto mb-1 object-contain" />
                    )}
                    <div className="font-bold text-[13px] uppercase">{sellerInfo?.business_name || 'Business Name'}</div>
                    {sellerInfo?.address && <div className="text-[9px]">{sellerInfo.address}</div>}
                    {sellerInfo?.phone && <div className="text-[9px]">Ph: {sellerInfo.phone}</div>}
                    {sellerInfo?.gstin && <div className="text-[9px] font-bold">GSTIN: {sellerInfo.gstin}</div>}
                  </div>

                  {/* Invoice Info */}
                  <div className="border-b border-dashed border-black pb-1 mb-1 text-[10px]">
                    <div className="flex justify-between"><span className="font-bold">Invoice No:</span><span>{invoice?.invoice_number || '-'}</span></div>
                    <div className="flex justify-between"><span className="font-bold">Date:</span><span>{formatDateSafe(invoice?.date, 'dd-MMM-yyyy')}</span></div>
                    <div className="flex justify-between"><span className="font-bold">Customer:</span><span className="text-right flex-1 ml-1 truncate">{customer?.name || invoice?.customer_name || 'CASH SALE'}</span></div>
                    {customer?.phone && <div className="flex justify-between"><span className="font-bold">Phone:</span><span>{customer.phone}</span></div>}
                  </div>

                  {/* Items */}
                  <div className="border-b border-dashed border-black pb-1 mb-1">
                    <div className="flex font-bold text-[10px] border-b border-black pb-0.5 mb-0.5">
                      <span className="flex-1">Item</span>
                      <span className="w-8 text-center">Qty</span>
                      <span className="w-14 text-right">Rate</span>
                      <span className="w-16 text-right">Amt</span>
                    </div>
                    {invoice?.items?.map((item: any, idx: number) => {
                      const qty = Number(item.quantity || 0);
                      const price = Number(item.price || 0);
                      const amt = qty * price;
                      return (
                        <div key={idx} className="text-[10px] py-0.5 border-b border-dotted border-gray-400">
                          <div className="font-semibold truncate">{getItemName(item)}</div>
                          <div className="flex">
                            <span className="flex-1 text-[9px] text-gray-600">{item.hsn_code || item.hsn ? `HSN: ${item.hsn_code || item.hsn}` : ''}</span>
                            <span className="w-8 text-center">{qty}</span>
                            <span className="w-14 text-right">₹{price.toFixed(2)}</span>
                            <span className="w-16 text-right font-bold">₹{amt.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  <div className="border-b border-dashed border-black pb-1 mb-1 text-[10px] space-y-0.5">
                    <div className="flex justify-between"><span>Subtotal:</span><span>₹{Number(rawSubtotal || 0).toFixed(2)}</span></div>
                    {totalDiscount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-₹{totalDiscount.toFixed(2)}</span></div>}
                    {totalGst > 0 && <div className="flex justify-between"><span>Tax (GST):</span><span>₹{totalGst.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-black text-[12px] border-t border-black pt-0.5">
                      <span>TOTAL:</span>
                      <span>₹{Number(invoice?.amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="text-[9px] italic text-center">{safeToWords(Number(invoice?.amount || 0), invoice?.currency)}</div>
                  </div>

                  {/* Payment Mode */}
                  {invoice?.payment_mode && (
                    <div className="text-[10px] text-center border-b border-dashed border-black pb-1 mb-1">
                      <span className="font-bold">Payment: </span>{invoice.payment_mode}
                    </div>
                  )}

                  {/* UPI QR */}
                  {sellerInfo?.upi_id && (
                    <div className="flex flex-col items-center border-b border-dashed border-black pb-1 mb-1">
                      <QRCodeSVG value={`upi://pay?pa=${sellerInfo.upi_id}&pn=${encodeURIComponent(sellerInfo?.business_name || 'Business')}&am=${invoice?.amount || 0}&cu=INR`} size={60} />
                      <div className="text-[9px] font-bold mt-0.5">Pay using UPI: {sellerInfo.upi_id}</div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="text-center text-[9px] space-y-0.5">
                    {termsText ? (
                      <div className="text-[8px] text-gray-600 border-b border-dashed border-black pb-1 mb-0.5">{termsText}</div>
                    ) : (
                      <div className="text-[8px] text-gray-600">Goods once sold will not be taken back.</div>
                    )}
                    <div className="font-bold">*** Thank You! Visit Again ***</div>
                    <div className="text-[8px] text-gray-500">E. &amp; O.E. | Computer Generated</div>
                  </div>
                </div>
              ) : null}
              {!isPro && (
                <div className="mt-8 pt-4 border-t border-dashed border-gray-200/60 flex justify-between items-center text-[8px] sm:text-[9px] text-gray-400 font-bold uppercase tracking-widest print:flex select-none z-20 relative">
                  <span>Powered by invocentric</span>
                  <span>invocentric.in</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Sidebar help / Status info (Hidden on Mobile or Print) */}
        <aside className={cn("w-full lg:w-[380px] xl:w-[420px] shrink-0 print:hidden transition-all duration-300", isSidebarCollapsed && "hidden")}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-5 items-start">
            {/* Unified Custom Layout & Lines Engine Panel (Light Theme) */}
          <div className="bg-white border-2 border-green-100 rounded-3xl p-5 space-y-4 shadow-sm text-slate-800 transition-all duration-300">
            {/* Top Header */}
            <div 
              onClick={() => {
                setIsCustomizeMode(!isCustomizeMode);
                if (isCustomizeMode) setSelectedElementId(null);
              }}
              className={cn(
                "flex items-center justify-between cursor-pointer group select-none transition-all duration-300",
                isCustomizeMode ? "border-b border-slate-100 pb-3" : ""
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100 group-hover:bg-green-100 transition-colors">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm tracking-tight group-hover:text-green-600 transition-colors">
                    Custom Layout Engine
                  </h3>
                  <p className="text-[10px] text-green-600 font-semibold">
                    {isCustomizeMode ? "⚡ Visual Editor Active" : "Click to expand customization menu"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCustomizeMode(!isCustomizeMode);
                    if (isCustomizeMode) setSelectedElementId(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold text-xs transition-all border shadow-xs",
                    isCustomizeMode
                      ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                      : "bg-green-50 hover:bg-green-100 text-green-700 border-green-100"
                  )}
                >
                  {isCustomizeMode ? "Hide" : "Customize"}
                </button>
                <ChevronDown 
                  size={16} 
                  className={cn("text-slate-400 transition-transform duration-300", isCustomizeMode && "rotate-180")} 
                />
              </div>
            </div>

            {isCustomizeMode && (
              <div className="space-y-4 animate-fadeIn">

            {/* Quick Action Tools: Save, Undo/Redo, Import/Export */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
              <button
                onClick={saveLayout}
                disabled={isSavingLayout}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              >
                {isSavingLayout ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {saveLayoutSuccess ? "Saved!" : "Save Layout"}
              </button>

              <div className="flex items-center gap-1">
                <div className="flex items-center bg-white rounded-xl p-0.5 border border-slate-200 shadow-2xs">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className={cn(
                      "p-1.5 rounded-lg text-xs transition-all",
                      historyIndex > 0 ? "hover:bg-slate-100 text-slate-800" : "text-slate-300 cursor-not-allowed"
                    )}
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 size={13} />
                  </button>
                  <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className={cn(
                      "p-1.5 rounded-lg text-xs transition-all",
                      historyIndex < history.length - 1 ? "hover:bg-slate-100 text-slate-800" : "text-slate-300 cursor-not-allowed"
                    )}
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 size={13} />
                  </button>
                </div>

                <button
                  onClick={downloadLayoutSettings}
                  className="p-1.5 bg-white hover:bg-slate-100 text-green-600 rounded-xl border border-slate-200 shadow-2xs"
                  title="Export Layout JSON"
                >
                  <Download size={13} />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 bg-white hover:bg-slate-100 text-green-600 rounded-xl border border-slate-200 shadow-2xs"
                  title="Import Layout JSON"
                >
                  <UploadCloud size={13} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={uploadLayoutSettings}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-bold">
              <button
                onClick={() => setCustomizeTab('toggles')}
                className={cn(
                  "py-1.5 px-1.5 rounded-xl text-[10.5px] transition-all flex items-center justify-center gap-1",
                  customizeTab === 'toggles'
                    ? "bg-white text-green-700 shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Eye size={12} /> Blocks
              </button>
              <button
                onClick={() => setCustomizeTab('selected')}
                className={cn(
                  "py-1.5 px-1.5 rounded-xl text-[10.5px] transition-all flex items-center justify-center gap-1",
                  customizeTab === 'selected'
                    ? "bg-white text-green-700 shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Sliders size={12} /> Precision
              </button>
              <button
                onClick={() => setCustomizeTab('lines')}
                className={cn(
                  "py-1.5 px-1.5 rounded-xl text-[10.5px] transition-all flex items-center justify-center gap-1",
                  customizeTab === 'lines'
                    ? "bg-white text-green-700 shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <LayoutIcon size={12} /> Lines
              </button>
            </div>

            {/* Tab 1: Show/Hide Sections */}
            {customizeTab === 'toggles' && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block mb-2 border-b border-slate-200 pb-1">
                    Major Blocks (Click to Show/Hide)
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: 'tally_banner', label: 'Title Banner' },
                      { id: 'tally_seller_branding', label: 'Seller Branding' },
                      { id: 'tally_invoice_meta', label: 'Invoice Reference No.' },
                      { id: 'tally_buyer_consignee', label: 'Buyer & Consignee' },
                      { id: 'tally_items_table', label: 'Items & Products' },
                      { id: 'tally_hsn_summary', label: 'HSN Tax breakdown' },
                      { id: 'tally_amount_words', label: 'Amount in Words' },
                      { id: 'tally_footer_block', label: 'Bank & Signature' },
                    ].map((block) => {
                      const isHidden = !!layoutOverrides[block.id]?.hidden;
                      return (
                        <button
                          key={block.id}
                          onClick={() => updateOverride(block.id, { hidden: !isHidden })}
                          className={cn(
                            "p-2 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between border",
                            isHidden
                              ? "bg-slate-100 border-slate-200 text-slate-400 line-through"
                              : "bg-green-50/80 border-green-200/80 text-green-950 hover:bg-green-100/80"
                          )}
                        >
                          <span>{block.label}</span>
                          {isHidden ? (
                            <EyeOff size={13} className="text-slate-400 shrink-0" />
                          ) : (
                            <Eye size={13} className="text-green-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block mb-2 border-b border-slate-200 pb-1">
                    Brand Fields Toggle
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'Company Logo', key: 'showLogo' },
                      { label: 'Phone Number', key: 'showPhone' },
                      { label: 'Email Address', key: 'showEmail' },
                      { label: 'Seller Address', key: 'showAddress' },
                      { label: 'Seller GSTIN', key: 'showGstin' },
                      { label: 'Seller PAN', key: 'showPan' },
                      { label: 'State & Code', key: 'showStateCode' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-medium text-[11px]">
                        <input
                          type="checkbox"
                          checked={!!tallyConfig[item.key]}
                          onChange={(e) => setTallyConfig((p: any) => ({ ...p, [item.key]: e.target.checked }))}
                          className="rounded border-slate-300 text-[#25d366] focus:ring-0 w-3.5 h-3.5 accent-[#25d366]"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block mb-2 border-b border-slate-200 pb-1">
                    Table Columns Toggle
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'HSN / SAC Column', key: 'showHsnColumn', defaultVal: true },
                      { label: 'Discount Column', key: 'showDiscountColumn', defaultVal: false },
                      { label: 'GST % Column', key: 'showGstPercentColumn', defaultVal: false },
                      { label: 'MRP Column', key: 'showMrpColumn', defaultVal: false },
                      { label: 'Size Column', key: 'showSizeColumn', defaultVal: false },
                    ].map((item) => {
                      const isChecked = tallyConfig[item.key] !== undefined ? !!tallyConfig[item.key] : item.defaultVal;
                      return (
                        <label key={item.key} className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-medium text-[11px]">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setTallyConfig((p: any) => ({ ...p, [item.key]: e.target.checked }))}
                            className="rounded border-slate-300 text-[#25d366] focus:ring-0 w-3.5 h-3.5 accent-[#25d366]"
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600 font-medium">Empty padding rows:</span>
                    <select
                      value={tallyConfig.emptyRowsCount ?? 0}
                      onChange={(e) => setTallyConfig((p: any) => ({ ...p, emptyRowsCount: Number(e.target.value) }))}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-800 font-semibold focus:outline-none"
                    >
                      {[0, 2, 4, 6, 8, 10, 12, 14, 16].map((n) => (
                        <option key={n} value={n}>{n} rows</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-600 mb-0.5 font-semibold">
                      <span>Table Min Height:</span>
                      <span>{tallyConfig.tableMinHeight || 380}px</span>
                    </div>
                    <input
                      type="range"
                      min="150"
                      max="600"
                      step="10"
                      value={tallyConfig.tableMinHeight || 380}
                      onChange={(e) => setTallyConfig((p: any) => ({ ...p, tableMinHeight: Number(e.target.value) }))}
                      className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Precision Controls */}
            {customizeTab === 'selected' && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                {selectedElementId ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-[11px] font-extrabold text-green-700 uppercase tracking-wider truncate max-w-[180px]">
                        🎯 {selectedElementId.replace('tally_', '').replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => handleResetElement(selectedElementId)}
                        className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <RotateCcw size={10} /> Reset
                      </button>
                    </div>

                    {/* Position X / Y */}
                    <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                      <span className="font-bold text-[10px] text-slate-600 block uppercase border-b border-slate-100 pb-1">
                        X & Y Shift (Offset)
                      </span>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-600 font-semibold">
                          <span>X (Left Shift):</span>
                          <span className="font-mono text-green-700 font-bold bg-slate-100 px-1 rounded">
                            {layoutOverrides[selectedElementId]?.x ?? 0}px
                          </span>
                        </div>
                        <div className="flex items-center gap-1 justify-between">
                          <button onClick={() => updateOverride(selectedElementId, { x: (layoutOverrides[selectedElementId]?.x ?? 0) - 10 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">-10</button>
                          <button onClick={() => updateOverride(selectedElementId, { x: (layoutOverrides[selectedElementId]?.x ?? 0) - 1 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">-1</button>
                          <input type="number" value={layoutOverrides[selectedElementId]?.x ?? 0} onChange={(e) => updateOverride(selectedElementId, { x: Number(e.target.value) })} className="w-12 text-center bg-slate-50 border border-slate-200 rounded py-0.5 text-xs text-slate-900 font-bold" />
                          <button onClick={() => updateOverride(selectedElementId, { x: (layoutOverrides[selectedElementId]?.x ?? 0) + 1 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">+1</button>
                          <button onClick={() => updateOverride(selectedElementId, { x: (layoutOverrides[selectedElementId]?.x ?? 0) + 10 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">+10</button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-600 font-semibold">
                          <span>Y (Top Shift):</span>
                          <span className="font-mono text-green-700 font-bold bg-slate-100 px-1 rounded">
                            {layoutOverrides[selectedElementId]?.y ?? 0}px
                          </span>
                        </div>
                        <div className="flex items-center gap-1 justify-between">
                          <button onClick={() => updateOverride(selectedElementId, { y: (layoutOverrides[selectedElementId]?.y ?? 0) - 10 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">-10</button>
                          <button onClick={() => updateOverride(selectedElementId, { y: (layoutOverrides[selectedElementId]?.y ?? 0) - 1 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">-1</button>
                          <input type="number" value={layoutOverrides[selectedElementId]?.y ?? 0} onChange={(e) => updateOverride(selectedElementId, { y: Number(e.target.value) })} className="w-12 text-center bg-slate-50 border border-slate-200 rounded py-0.5 text-xs text-slate-900 font-bold" />
                          <button onClick={() => updateOverride(selectedElementId, { y: (layoutOverrides[selectedElementId]?.y ?? 0) + 1 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">+1</button>
                          <button onClick={() => updateOverride(selectedElementId, { y: (layoutOverrides[selectedElementId]?.y ?? 0) + 10 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">+10</button>
                        </div>
                      </div>
                    </div>

                    {/* Dimensions Width / Height */}
                    <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                      <span className="font-bold text-[10px] text-slate-600 block uppercase border-b border-slate-100 pb-1">Width & Height</span>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-600 font-semibold">
                          <span>Width:</span>
                          <span className="font-mono text-green-700 font-bold bg-slate-100 px-1 rounded">
                            {layoutOverrides[selectedElementId]?.width ? `${layoutOverrides[selectedElementId].width}px` : 'Auto'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 justify-between">
                          <button onClick={() => updateOverride(selectedElementId, { width: Math.max(50, (layoutOverrides[selectedElementId]?.width || 300) - 10) })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">-10</button>
                          <input type="number" placeholder="Auto" value={layoutOverrides[selectedElementId]?.width || ''} onChange={(e) => updateOverride(selectedElementId, { width: e.target.value ? Number(e.target.value) : undefined })} className="w-16 text-center bg-slate-50 border border-slate-200 rounded py-0.5 text-xs text-slate-900 font-bold" />
                          <button onClick={() => updateOverride(selectedElementId, { width: (layoutOverrides[selectedElementId]?.width || 300) + 10 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">+10</button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-600 font-semibold">
                          <span>Height:</span>
                          <span className="font-mono text-green-700 font-bold bg-slate-100 px-1 rounded">
                            {layoutOverrides[selectedElementId]?.height ? `${layoutOverrides[selectedElementId].height}px` : 'Auto'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 justify-between">
                          <button onClick={() => updateOverride(selectedElementId, { height: Math.max(10, (layoutOverrides[selectedElementId]?.height || 100) - 10) })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">-10</button>
                          <input type="number" placeholder="Auto" value={layoutOverrides[selectedElementId]?.height || ''} onChange={(e) => updateOverride(selectedElementId, { height: e.target.value ? Number(e.target.value) : undefined })} className="w-16 text-center bg-slate-50 border border-slate-200 rounded py-0.5 text-xs text-slate-900 font-bold" />
                          <button onClick={() => updateOverride(selectedElementId, { height: (layoutOverrides[selectedElementId]?.height || 100) + 10 })} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold border border-slate-200">+10</button>
                        </div>
                      </div>
                    </div>

                    {/* Styling Font & Border */}
                    <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                      <span className="font-bold text-[10px] text-slate-600 block uppercase border-b border-slate-100 pb-1">Font Size & Border</span>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold block">Font Size:</span>
                        <div className="flex gap-1 flex-wrap">
                          {[8, 9, 10, 11, 12, 13, 14, 16].map((fs) => (
                            <button
                              key={fs}
                              onClick={() => updateOverride(selectedElementId, { fontSize: fs })}
                              className={cn(
                                "w-6 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all border",
                                (layoutOverrides[selectedElementId]?.fontSize || 12) === fs
                                  ? "bg-green-600 text-white border-green-600"
                                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                              )}
                            >
                              {fs}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold block">Border Width:</span>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4].map((bw) => (
                            <button
                              key={bw}
                              onClick={() => updateOverride(selectedElementId, { borderWidth: bw })}
                              className={cn(
                                "w-7 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all border",
                                (layoutOverrides[selectedElementId]?.borderWidth ?? 1) === bw
                                  ? "bg-green-600 text-white border-green-600"
                                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                              )}
                            >
                              {bw}px
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-600 p-4 bg-green-50/60 border border-green-100 rounded-xl text-center space-y-1">
                    <p className="font-bold text-green-900">💡 Precision Controls Tip</p>
                    <p className="text-[10px] text-slate-600 leading-snug">Click directly on any section in the invoice preview on the left to select it and adjust exact position, width, height, or font size!</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Khadi Lines & Column Width Sliders */}
            {customizeTab === 'lines' && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-4">
                {/* Header Branding Controls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-green-800 flex items-center gap-1">
                      <Palette size={12} /> Header Branding & Company Logo
                    </h4>
                    {sellerInfo?.logo_url && (
                      <span className="text-[9px] bg-green-100 text-green-800 font-bold px-1.5 py-0.5 rounded-full border border-green-200">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Logo Management Box */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Company Logo:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {isUploadingLogo ? <Loader2 size={10} className="animate-spin" /> : <UploadCloud size={10} />}
                          {sellerInfo?.logo_url ? "Change Logo" : "+ Add Logo"}
                        </button>
                        {sellerInfo?.logo_url && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            disabled={isUploadingLogo}
                            className="text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 px-1.5 py-1 rounded-lg border border-red-200 transition-colors cursor-pointer"
                            title="Remove Logo"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>

                    {sellerInfo?.logo_url ? (
                      <div className="flex items-center gap-2.5 pt-1.5 border-t border-slate-100">
                        <div className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-lg p-1 flex items-center justify-center shrink-0">
                          <img src={sellerInfo.logo_url} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-0.5">
                            <span>Logo Height:</span>
                            <span className="text-green-700 font-mono">{tallyConfig.logoHeight || 60}px</span>
                          </div>
                          <input
                            type="range"
                            min="28"
                            max="120"
                            step="2"
                            value={tallyConfig.logoHeight || 60}
                            onChange={(e) => setTallyConfig({ ...tallyConfig, logoHeight: Number(e.target.value) })}
                            className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No logo uploaded. Click "+ Add Logo" to upload brand logo.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tallyConfig.showLogo !== false}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, showLogo: e.target.checked })}
                        className="rounded accent-[#25d366] border-slate-300"
                      />
                      Show Logo
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tallyConfig.showPhone}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, showPhone: e.target.checked })}
                        className="rounded accent-[#25d366] border-slate-300"
                      />
                      Show Phone
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tallyConfig.showEmail}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, showEmail: e.target.checked })}
                        className="rounded accent-[#25d366] border-slate-300"
                      />
                      Show Email
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tallyConfig.showGstin}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, showGstin: e.target.checked })}
                        className="rounded accent-[#25d366] border-slate-300"
                      />
                      Show GSTIN
                    </label>
                  </div>

                  {tallyConfig.showLogo !== false && (
                    <div className="pt-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Logo Position</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['left', 'center', 'right'].map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setTallyConfig({ ...tallyConfig, logoPosition: pos })}
                            className={cn(
                              "py-1 text-[10px] font-bold uppercase rounded-lg border capitalize transition-all",
                              (tallyConfig.logoPosition || 'left') === pos
                                ? "bg-[#25d366] text-white border-[#25d366]"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Khadi Lines (Column Width Sliders) */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <Sliders size={12} /> Khadi Lines (Column Widths)
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Sl No. Column</span>
                        <span>{tallyConfig.slNoWidth}%</span>
                      </div>
                      <input
                        type="range" min="3" max="15" value={tallyConfig.slNoWidth}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, slNoWidth: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Item Description</span>
                        <span>{tallyConfig.descWidth}%</span>
                      </div>
                      <input
                        type="range" min="20" max="65" value={tallyConfig.descWidth}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, descWidth: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>HSN / SAC Column</span>
                        <span>{tallyConfig.hsnWidth}%</span>
                      </div>
                      <input
                        type="range" min="6" max="25" value={tallyConfig.hsnWidth}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, hsnWidth: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Qty Column</span>
                        <span>{tallyConfig.qtyWidth}%</span>
                      </div>
                      <input
                        type="range" min="5" max="20" value={tallyConfig.qtyWidth}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, qtyWidth: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Rate Column</span>
                        <span>{tallyConfig.rateWidth}%</span>
                      </div>
                      <input
                        type="range" min="8" max="25" value={tallyConfig.rateWidth}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, rateWidth: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                  </div>
                </div>

                {/* Aadi Lines & Box Layout Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <LayoutIcon size={12} /> Aadi Lines (Box Height & Grid)
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Table Box Height</span>
                        <span>{tallyConfig.tableMinHeight}px</span>
                      </div>
                      <input
                        type="range" min="200" max="600" step="10" value={tallyConfig.tableMinHeight}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, tableMinHeight: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Empty Grid Rows (Aadi Lines)</span>
                        <span>{tallyConfig.emptyRowsCount ?? 0} rows</span>
                      </div>
                      <input
                        type="range" min="0" max="20" value={tallyConfig.emptyRowsCount ?? 0}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, emptyRowsCount: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Header Seller vs Meta Ratio</span>
                        <span>{tallyConfig.headerSplitRatio}% / {100 - tallyConfig.headerSplitRatio}%</span>
                      </div>
                      <input
                        type="range" min="30" max="70" step="5" value={tallyConfig.headerSplitRatio}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, headerSplitRatio: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Custom Layout Button */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <button
                    type="button"
                    onClick={handleSaveTallyLayout}
                    disabled={isSavingLayout}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                  >
                    {isSavingLayout ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Save Custom Layout Defaults</span>
                  </button>
                  {saveLayoutSuccess && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] font-bold flex items-center gap-1.5 justify-center">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>Layout saved successfully!</span>
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            )}
          </div>

           {/* Template Selector */}
           <div className="bg-white border-2 border-neutral-100 rounded-3xl p-6 space-y-4 shadow-sm">
             <div className="flex items-center gap-2">
               <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                 <Copy size={18} />
               </div>
               <div>
                 <h3 className="font-bold text-neutral-900 text-sm">Invoice Template</h3>
                 <p className="text-[10px] text-neutral-400 font-medium">Choose style & layout</p>
               </div>
             </div>
             
             <div className="space-y-2">
               {template !== 'thermal' && (
                 <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 mb-3">
                   <p className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                     <span>Paper Size Mode:</span>
                     <span className="text-[10px] text-green-700 font-extrabold uppercase">{paperSize === 'a5' ? 'A5 (Half Sheet)' : 'A4 (Standard Full)'}</span>
                   </p>
                   <div className="grid grid-cols-2 gap-1.5">
                     <button
                       type="button"
                       onClick={() => {
                         setPaperSize('a4');
                         setShareFile(null);
                       }}
                       className={cn(
                         "py-1.5 px-2 rounded-xl text-xs font-bold transition-all border text-center flex flex-col items-center",
                         paperSize === 'a4'
                           ? "bg-green-600 text-white border-green-600 shadow-xs"
                           : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                       )}
                     >
                       <span>A4 Sheet</span>
                       <span className="text-[9px] opacity-80">210 × 297 mm</span>
                     </button>
                     <button
                       type="button"
                       onClick={() => {
                         setPaperSize('a5');
                         setShareFile(null);
                       }}
                       className={cn(
                         "py-1.5 px-2 rounded-xl text-xs font-bold transition-all border text-center flex flex-col items-center",
                         paperSize === 'a5'
                           ? "bg-green-600 text-white border-green-600 shadow-xs"
                           : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                       )}
                     >
                       <span>A5 Half Sheet</span>
                       <span className="text-[9px] opacity-80">148 × 210 mm</span>
                     </button>
                   </div>
                 </div>
               )}

               {defaultBuiltInTemplates.map((t) => (
                 <button
                   key={t.id}
                   type="button"
                   onClick={() => handleTemplateChange(t.id)}
                   className={cn(
                     "w-full text-left py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all border",
                     template === t.id
                       ? "bg-[#25d366] text-white border-[#25d366] shadow-sm"
                       : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                   )}
                 >
                   <span>{t.name}</span>
                   {template === t.id && <Check size={14} className="shrink-0" />}
                 </button>
               ))}
             </div>
           </div>

           {/* Company Logo Section in Sidebar */}
           <div className="bg-white border-2 border-neutral-100 rounded-3xl p-6 space-y-4 shadow-sm">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                   <ImageIcon size={18} />
                 </div>
                 <div>
                   <h3 className="font-bold text-neutral-900 text-sm">Company Logo</h3>
                   <p className="text-[10px] text-neutral-400 font-medium">Add or manage brand logo</p>
                 </div>
               </div>
               {sellerInfo?.logo_url && (
                 <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-200">
                   Active
                 </span>
               )}
             </div>

             {sellerInfo?.logo_url ? (
               <div className="space-y-3">
                 <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                   <div className="w-14 h-14 bg-white rounded-xl border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                     <img src={sellerInfo.logo_url} alt="Logo" className="w-full h-full object-contain" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-xs font-bold text-slate-800 truncate">{sellerInfo?.business_name || "Your Company"}</p>
                     <p className="text-[10px] text-slate-500 font-medium">Logo printed on invoice</p>
                     <div className="flex items-center gap-2 mt-1.5">
                       <button
                         type="button"
                         onClick={() => logoInputRef.current?.click()}
                         disabled={isUploadingLogo}
                         className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 border border-blue-200"
                       >
                         {isUploadingLogo ? <Loader2 size={11} className="animate-spin" /> : <UploadCloud size={11} />}
                         Change
                       </button>
                       <button
                         type="button"
                         onClick={handleRemoveLogo}
                         disabled={isUploadingLogo}
                         className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 border border-red-200"
                       >
                         <Trash2 size={11} />
                         Remove
                       </button>
                     </div>
                   </div>
                 </div>

                 {/* Controls for Logo Height & Position */}
                 <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200 space-y-3">
                   <div className="flex items-center justify-between">
                     <span className="text-[11px] font-bold text-slate-700">Show on Invoice:</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input
                         type="checkbox"
                         checked={tallyConfig.showLogo !== false}
                         onChange={(e) => setTallyConfig((p: any) => ({ ...p, showLogo: e.target.checked }))}
                         className="sr-only peer"
                       />
                       <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#25d366]"></div>
                     </label>
                   </div>

                   {tallyConfig.showLogo !== false && (
                     <>
                       <div>
                         <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                           <span>Logo Height:</span>
                           <span className="text-green-700 font-mono font-bold">{tallyConfig.logoHeight || 60}px</span>
                         </div>
                         <input
                           type="range"
                           min="28"
                           max="120"
                           step="2"
                           value={tallyConfig.logoHeight || 60}
                           onChange={(e) => setTallyConfig((p: any) => ({ ...p, logoHeight: Number(e.target.value) }))}
                           className="w-full h-1 bg-slate-200 rounded accent-[#25d366]"
                         />
                       </div>

                       <div>
                         <span className="text-[10px] font-bold text-slate-700 block mb-1">Position:</span>
                         <div className="grid grid-cols-3 gap-1">
                           {["left", "center", "right"].map((pos) => (
                             <button
                               key={pos}
                               type="button"
                               onClick={() => setTallyConfig((p: any) => ({ ...p, logoPosition: pos }))}
                               className={cn(
                                 "py-1 text-[10px] font-bold uppercase rounded-lg border transition-all text-center",
                                 (tallyConfig.logoPosition || "left") === pos
                                   ? "bg-[#25d366] text-white border-[#25d366] shadow-2xs"
                                   : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                               )}
                             >
                               {pos}
                             </button>
                           ))}
                         </div>
                       </div>
                     </>
                   )}
                 </div>
               </div>
             ) : (
               <div className="space-y-3">
                 <button
                   type="button"
                   onClick={() => logoInputRef.current?.click()}
                   disabled={isUploadingLogo}
                   className="w-full py-4 px-3 border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center"
                 >
                   <div className="p-2.5 bg-blue-100 group-hover:bg-blue-600 text-blue-600 group-hover:text-white rounded-xl transition-all shadow-2xs">
                     {isUploadingLogo ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                   </div>
                   <div>
                     <p className="text-xs font-bold text-blue-900 group-hover:text-blue-700 transition-colors">
                       {isUploadingLogo ? "Uploading Logo..." : "+ Add Company Logo"}
                     </p>
                     <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                       PNG, JPG, SVG or WebP (Max 1MB)
                     </p>
                   </div>
                 </button>
               </div>
             )}
           </div>

           {/* Letterhead Printing Mode Options */}
           <div className="bg-white border-2 border-neutral-100 rounded-3xl p-6 space-y-4 shadow-sm">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                   <Printer size={18} />
                 </div>
                 <div>
                   <h3 className="font-bold text-neutral-900 text-sm">Letterhead Mode</h3>
                   <p className="text-[10px] text-neutral-400 font-medium">For pre-printed paper sheets</p>
                 </div>
               </div>
               
               <label className="relative inline-flex items-center cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={useLetterheadMode} 
                   onChange={(e) => setUseLetterheadMode(e.target.checked)}
                   className="sr-only peer"
                 />
                 <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#25d366]"></div>
               </label>
             </div>
             
             <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
               Enable this mode if you already have a <strong>pre-printed letterhead paper</strong> for your shop. This will hide the digital header and leave a blank space for printing.
             </p>
             
             {useLetterheadMode && (
               <div className="space-y-4 pt-3 border-t border-dashed border-neutral-100">
                 <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
                   <span>Top Margin Spacer</span>
                   <span className="font-mono text-green-600 font-black bg-green-50 px-2 py-0.5 rounded text-[11px]">
                     {letterheadSpacerHeight}px
                   </span>
                 </div>
                 
                 <input 
                   type="range" 
                   min="40" 
                   max="360" 
                   step="10"
                   value={letterheadSpacerHeight} 
                   onChange={(e) => setLetterheadSpacerHeight(Number(e.target.value))}
                   className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-[#25d366]"
                 />
                 
                 <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                   <span>Min (1 in)</span>
                   <span>Max (3.8 in)</span>
                 </div>

                 {/* CUSTOM LETTERHEAD IMAGE UPLOAD */}
                 <div className="space-y-2 pt-3 border-t border-neutral-100">
                   <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
                     Custom Letterhead Image
                   </label>
                   
                   {!customLetterhead ? (
                     <div className="flex items-center justify-center w-full">
                       <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-neutral-200 rounded-2xl cursor-pointer hover:bg-neutral-50 hover:border-green-300 transition-all">
                         <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                           <UploadCloud className="text-neutral-400 mb-1" size={20} />
                           <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Upload Image</p>
                           <p className="text-[9px] text-neutral-400 font-medium">JPEG or PNG</p>
                         </div>
                         <input 
                           type="file" 
                           accept="image/*" 
                           onChange={handleLetterheadUpload} 
                           className="hidden" 
                         />
                       </label>
                     </div>
                   ) : (
                     <div className="space-y-3">
                       <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50 h-20 flex items-center justify-center">
                         <img 
                           src={customLetterhead} 
                           alt="Letterhead Preview" 
                           className="max-h-full max-w-full object-contain" 
                         />
                         <button
                           type="button"
                           onClick={handleRemoveLetterhead}
                           className="absolute top-1 right-1 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-sm transition-all"
                           title="Remove Letterhead"
                         >
                           <Trash2 size={12} />
                         </button>
                       </div>

                       {/* Letterhead placement style */}
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                           Letterhead Fit Style
                         </label>
                         <div className="grid grid-cols-2 gap-2">
                           <button
                             type="button"
                             onClick={() => handleLetterheadTypeChange('header')}
                             className={cn(
                               "py-1.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all",
                               letterheadType === 'header'
                                 ? "bg-green-50 border-green-200 text-green-700 shadow-sm"
                                 : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                             )}
                           >
                             Top Header
                           </button>
                           <button
                             type="button"
                             onClick={() => handleLetterheadTypeChange('full')}
                             className={cn(
                               "py-1.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all",
                               letterheadType === 'full'
                                 ? "bg-green-50 border-green-200 text-green-700 shadow-sm"
                                 : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                             )}
                           >
                             Full Page
                           </button>
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
               </div>
             )}
           </div>

           <div className="shadow-lg bg-neutral-900 text-white rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 text-green-400 rounded-xl">
                  <Wallet size={20} />
                </div>
                <h3 className="font-bold">Payment Status</h3>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-xs text-white/50 mb-1">Status</p>
                <p className="text-lg font-black uppercase tracking-widest text-green-400 leading-none">{invoice.status}</p>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                High-quality HD Invoice. Share it directly with your customer via WhatsApp or Email.
              </p>
           </div>

           <div className="bg-white border-2 border-neutral-100 rounded-3xl p-6 space-y-4">
             <h3 className="font-bold text-neutral-900">Notes</h3>
             <div className="space-y-3">
               <div className="flex gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                 <p className="text-xs text-neutral-500">Auto-generated professional invoice.</p>
               </div>
               <div className="flex gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                 <p className="text-xs text-neutral-500">Securely stored with InvoCentric.</p>
               </div>
             </div>
           </div>
          </div>
        </aside>
      </div>

      {/* WhatsApp Helper Instructions Modal */}
      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        whatsAppUrl={whatsAppUrlState}
        whatsAppWebUrl={whatsAppWebUrlState}
        whatsAppAppUrl={whatsAppAppUrlState}
        documentTitle="Invoice"
        copiedToClipboard={copiedToClipboard}
        fileName={generatedImageFileName || `Invoice_${invoice?.invoice_number || 'bill'}.png`}
        onDirectSharePdf={generatedImageBlob ? handleDirectImageShare : undefined}
      />

      {/* PDF Quality Mode Selector Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-800 to-emerald-700 px-6 py-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2" style={{ color: '#fef6f6', borderColor: '#ffffff' }}>
                  <Download size={20} />
                  Choose PDF Quality
                </h3>
                <p className="text-xs mt-0.5 font-bold" style={{ color: '#ffffff', borderColor: '#ffffff' }}>Select your preferred PDF style</p>
              </div>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="text-green-100 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              
              {/* Option 1: Native High-Quality PDF */}
              <div className="border border-green-100 bg-green-50/20 hover:bg-green-50/40 p-4 rounded-2xl transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-black">1</span>
                    <h4 className="font-bold text-xs text-neutral-900 uppercase tracking-wide">
                      Super High-Quality Vector PDF (पक्का PDF)
                    </h4>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed pl-7">
                    <strong>Highly Recommended.</strong> Creates a pristine, official document with <strong>selectable text</strong> and infinite zoom quality. Best for tax and professional billing.
                  </p>
                  <p className="text-[11px] text-green-700 font-bold leading-relaxed pl-7 mt-1.5 italic">
                    How: Choose <strong>"Save as PDF"</strong> (या <strong>'PDF के रूप में सेव करें'</strong>) in the destination dropdown on the next screen.
                  </p>
                </div>
                <div className="pl-7 mt-3">
                  <button
                    onClick={() => {
                      setShowPdfModal(false);
                      setTimeout(() => {
                        window.focus();
                        window.print();
                      }, 200);
                    }}
                    className="w-full py-2.5 px-4 bg-green-800 text-white font-black text-[11px] uppercase tracking-wider rounded-xl hover:bg-green-900 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer size={15} />
                    Open Print & Save PDF
                  </button>
                </div>
              </div>

              {/* Option 2: Direct Image PDF */}
              <div className="border border-neutral-200 bg-neutral-50/30 hover:bg-neutral-50 p-4 rounded-2xl transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-500 text-white text-[10px] font-black">2</span>
                    <h4 className="font-bold text-xs text-neutral-800 uppercase tracking-wide">
                      Direct Download PDF (Kachha PDF)
                    </h4>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed pl-7">
                    Downloads an instant PDF converted from a super-high resolution screenshot. Text in this file is static (non-selectable image).
                  </p>
                </div>
                <div className="pl-7 mt-3">
                  <button
                    onClick={handleDirectPdfDownload}
                    disabled={downloading}
                    className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-900 disabled:bg-neutral-400 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Download Standard PDF
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Floating Action Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none print:hidden">
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 font-sans"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-100">{toastMessage.text}</span>
          </motion.div>
        </div>
      )}


      <style>{`
        .invoice-print-container *, .invoice-print-container {
          border-color: #e5e7eb !important;
          outline-color: transparent !important;
          text-decoration-color: transparent !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .invoice-print-container h1, 
        .invoice-print-container h2, 
        .invoice-print-container h3, 
        .invoice-print-container .font-space {
          font-family: 'Space Grotesk', sans-serif !important;
        }

        @media print {
          /* Hide all UI elements inside body by default */
          body * {
            visibility: hidden !important;
          }

          /* Completely remove non-printable components from print layout to reclaim space */
          .print\:hidden,
          [class*="print:hidden"],
          aside,
          nav,
          header,
          footer,
          button,
          .sidebar-container,
          .mobile-nav-container,
          div[class*="sticky top-0"],
          div[class*="pb-28"] {
            display: none !important;
          }

          /* Reset all layout wrapper ancestors to flow naturally with zero padding/margin and auto height */
          html, 
          body, 
          #root, 
          #root > div, 
          div[class*="h-[100dvh]"], 
          main, 
          .max-w-5xl,
          .invoice-main-flex-container {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
          }

          /* Reset scale transform on print to prevent tiny scaling or clipping */
          .print-exact-size {
            transform: none !important;
            -webkit-transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
          }

          /* Make the parent and printable container visible */
          .print-exact-size,
          .invoice-print-container, 
          .invoice-print-container * {
            visibility: visible !important;
          }
          
          .invoice-print-container {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            overflow: visible !important;
            background-color: #ffffff !important;
            
            /* Enable exact color prints without forcing grayscale or breaking colors/logos */
            -webkit-print-color-adjust: economy !important;
            print-color-adjust: economy !important;
          }

          /* Strict Monochrome Black & White Style Override (No custom colors, no 3rd colors, black text/borders) */
          .invoice-print-container,
          .invoice-print-container * {
            background-color: #ffffff !important;
            color: #000000 !important;
            background-image: none !important;
            text-shadow: none !important;
            box-shadow: none !important;
            filter: grayscale(100%) !important;
          }

          /* Bold Crisp Black Outlines and Borders for all container blocks */
          .invoice-print-container *,
          .invoice-print-container [class*="border"] {
            border-color: #000000 !important;
          }

          .invoice-print-container hr {
            border-top: 1px solid #000000 !important;
            border-color: #000000 !important;
            background-color: #000000 !important;
            height: 1.5px !important;
          }

          /* Clean parent wrapper layout during printing to prevent second-page overflow */
          .invoice-parent-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
          }

          /* Tighter padding and compact fonts inside table to fit maximum entries perfectly */
          .invoice-print-container table {
            width: 100% !important;
            table-layout: auto !important;
            page-break-inside: auto;
            border: 1px solid #000000 !important;
            border-collapse: collapse !important;
          }

          .invoice-print-container table th, 
          .invoice-print-container table td {
            border: 1px solid #000000 !important;
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            background-color: #ffffff !important;
            color: #000000 !important;
          }

          /* Spacing Compressors for Auto-adjusting A4 Layout (Fit-to-page) */
          /* 6-8 Items: Very Compact spacing to fit on 1 A4 page */
          .print-very-compact {
            font-size: 8.5pt !important;
          }
          .print-very-compact table th, 
          .print-very-compact table td {
            padding-top: 2.5px !important;
            padding-bottom: 2.5px !important;
            padding-left: 4px !important;
            padding-right: 4px !important;
            font-size: 8.5px !important;
            line-height: 1.1 !important;
          }
          .print-very-compact .p-4, 
          .print-very-compact .p-3, 
          .print-very-compact .p-2\.5 {
            padding: 4px !important;
          }
          .print-very-compact .mb-8, 
          .print-very-compact .mb-6, 
          .print-very-compact .mb-4 {
            margin-bottom: 4px !important;
          }
          .print-very-compact .pb-6, 
          .print-very-compact .pb-4 {
            padding-bottom: 3px !important;
          }
          .print-very-compact .h-36 {
            height: 60px !important;
          }
          .print-very-compact .h-20 {
            height: 30px !important;
          }
          .print-very-compact img {
            max-height: 38px !important;
          }

          /* 9+ Items: Ultra Compact spacing to guarantee fitting on 1 A4 page */
          .print-ultra-compact {
            font-size: 7.5pt !important;
          }
          .print-ultra-compact table th, 
          .print-ultra-compact table td {
            padding-top: 1.5px !important;
            padding-bottom: 1.5px !important;
            padding-left: 2px !important;
            padding-right: 2px !important;
            font-size: 7.5px !important;
            line-height: 1.0 !important;
          }
          .print-ultra-compact .p-4, 
          .print-ultra-compact .p-3, 
          .print-ultra-compact .p-2\.5 {
            padding: 2px !important;
          }
          .print-ultra-compact .mb-8, 
          .print-ultra-compact .mb-6, 
          .print-ultra-compact .mb-4,
          .print-ultra-compact .mt-6,
          .print-ultra-compact .mt-4 {
            margin-bottom: 2px !important;
            margin-top: 2px !important;
          }
          .print-ultra-compact .pb-6, 
          .print-ultra-compact .pb-4 {
            padding-bottom: 2px !important;
          }
          .print-ultra-compact .h-36 {
            height: 40px !important;
          }
          .print-ultra-compact .h-20 {
            height: 15px !important;
          }
          .print-ultra-compact img {
            max-height: 25px !important;
          }
          .print-ultra-compact .gap-6, 
          .print-ultra-compact .gap-4,
          .print-ultra-compact .gap-3 {
            gap: 3px !important;
          }

          /* Traditional Layout specific black border rules */
          .traditional-invoice-container, 
          .traditional-invoice-container * {
            border-color: #000000 !important;
          }

          .traditional-invoice-container table th, 
          .traditional-invoice-container table td {
            border-color: #000000 !important;
            border-width: 1.5px !important;
          }

          .ink-paper-invoice {
            min-height: 0 !important;
            height: auto !important;
          }
          
          /* Prevent page-breaks only on individual rows and specific signature/bank details modules */
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          thead {
            display: table-header-group !important;
          }

          tfoot {
            display: table-footer-group !important;
          }

          .qrcode-container,
          .bank-details-container,
          .signature-container,
          .signature-block,
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            break-inside: avoid-page !important;
          }
        }
      `}</style>
      {template === 'thermal' && (
        <style>{`
          @media print {
            @page {
              margin: 0 !important;
              size: 80mm auto !important;
            }
            body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .invoice-print-container {
              width: 80mm !important;
              max-width: 80mm !important;
              padding: 0 !important;
              margin: 0 auto !important;
              position: relative !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-exact-size {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
              min-height: 0 !important;
              height: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            /* Completely avoid break inside thermal invoice */
            .thermal-invoice-container,
            .thermal-invoice-container * {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}</style>
      )}

      {template !== 'thermal' && (
        <style>{`
          @media print {
            @page {
              size: ${paperSize === 'a5' ? 'A5 portrait' : 'A4 portrait'} !important;
              margin: ${paperSize === 'a5' ? '5mm' : '10mm'} !important;
            }

            html, body {
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .invoice-parent-wrapper {
              display: block !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .print-exact-size {
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              transform: none !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }

            .invoice-print-container {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              display: block !important;
              box-sizing: border-box !important;
              box-shadow: none !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
              overflow: hidden !important;
            }

            .invoice-print-container > div {
              height: auto !important;
              min-height: 0 !important;
            }

            .invoice-print-container table tbody tr.empty-spacer-row {
              display: none !important;
            }

            .invoice-print-container table th, 
            .invoice-print-container table td {
              padding-top: ${paperSize === 'a5' ? '2px' : '3px'} !important;
              padding-bottom: ${paperSize === 'a5' ? '2px' : '3px'} !important;
              padding-left: ${paperSize === 'a5' ? '3px' : '4px'} !important;
              padding-right: ${paperSize === 'a5' ? '3px' : '4px'} !important;
              font-size: ${paperSize === 'a5' ? '8pt' : '9.5px'} !important;
              line-height: 1.15 !important;
            }

            .invoice-print-container .p-3, 
            .invoice-print-container .p-4,
            .invoice-print-container .p-2\.5 {
              padding: ${paperSize === 'a5' ? '3.5px' : '5px'} !important;
            }

            .invoice-print-container .mb-8, 
            .invoice-print-container .mb-6 {
              margin-bottom: ${paperSize === 'a5' ? '4px' : '6px'} !important;
            }

            .invoice-print-container .pb-6, 
            .invoice-print-container .pb-4 {
              padding-bottom: ${paperSize === 'a5' ? '3px' : '4px'} !important;
            }

            .invoice-print-container .gap-6, 
            .invoice-print-container .gap-4 {
              gap: ${paperSize === 'a5' ? '4px' : '6px'} !important;
            }

            .invoice-print-container .h-36 {
              height: ${paperSize === 'a5' ? '48px' : '72px'} !important;
            }

            .invoice-print-container .h-20 {
              height: ${paperSize === 'a5' ? '28px' : '40px'} !important;
            }

            .invoice-print-container img {
              max-height: ${paperSize === 'a5' ? '32px' : '48px'} !important;
            }

            table {
              page-break-inside: auto !important;
              width: 100% !important;
            }

            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            thead {
              display: table-header-group !important;
            }

            tbody {
              display: table-row-group !important;
            }

            .signature-container,
            .bank-details-container,
            .qrcode-container,
            .terms-container,
            #tally_footer_block,
            #tally_hsn_summary,
            #tally_amount_words,
            #tally_buyer_consignee,
            #tally_seller_branding,
            #tally_banner,
            .print-avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-inside: avoid-page !important;
            }

            .empty-padding-row {
              display: none !important;
            }
          }
        `}</style>
      )}

      {/* Hidden File Input for Company Logo Upload */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleLogoUpload}
      />

          </div>
  );
}

