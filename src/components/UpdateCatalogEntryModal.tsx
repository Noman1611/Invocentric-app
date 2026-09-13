import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  ScanLine, 
  Barcode, 
  AlertCircle, 
  Trash2, 
  Tag, 
  Layers, 
  Package, 
  IndianRupee, 
  Info, 
  Save,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useItems } from '../hooks/useData';
import SerialNumberInput from './SerialNumberInput';
import { extractProductFromImage } from '../services/aiService';

export interface CatalogItemData {
  id?: string;
  name: string;
  image?: string;
  category?: string;
  brand?: string;
  barcode?: string;
  hsn?: string;
  serialNumber?: string;
  serials?: string[];
  mrp?: number | string;
  costPrice?: number | string;
  price?: number | string;
  wholesalePrice?: number | string;
  discount?: number | string;
  gstPercent?: number | string;
  stock?: number | string;
  low_stock_threshold?: number | string;
  unit?: string;
  size?: string;
  custom_box?: string;
  description?: string;
  active?: boolean;
}

interface UpdateCatalogEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: CatalogItemData) => void | Promise<void>;
  initialData?: Partial<CatalogItemData> | null;
  onOpenScanner?: () => void;
  scannedBarcode?: string;
  title?: string;
}

export default function UpdateCatalogEntryModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  onOpenScanner,
  scannedBarcode,
  title = "Update Catalog Entry"
}: UpdateCatalogEntryModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { items } = useItems();

  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showSerialDropdown, setShowSerialDropdown] = useState(false);

  const uniqueCategories = Array.from(new Set(items.map(item => item.category).filter(Boolean))) as string[];
  const uniqueBrands = Array.from(new Set(items.map(item => item.brand).filter(Boolean))) as string[];
  const uniqueNames = Array.from(new Set(items.map(item => item.name).filter(Boolean))) as string[];
  const uniqueSerials = Array.from(new Set(items.map(item => item.serialNumber || item.serial_number).filter(Boolean))) as string[];

  const [formData, setFormData] = useState<CatalogItemData>({
    name: '',
    image: '',
    category: '',
    brand: '',
    barcode: '',
    hsn: '',
    serialNumber: '',
    serials: [],
    mrp: '',
    costPrice: '',
    price: '',
    wholesalePrice: '',
    discount: '',
    gstPercent: '18',
    stock: '0',
    low_stock_threshold: '5',
    unit: 'Pcs',
    size: '',
    custom_box: '',
    active: true
  });

  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showMismatchModal, setShowMismatchModal] = useState<boolean>(false);
  const [isExtractingAI, setIsExtractingAI] = useState<boolean>(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string>('');

  const triggerAIExtraction = async (base64Data: string) => {
    if (!base64Data) return;
    setIsExtractingAI(true);
    setAiSuccessMessage('');
    try {
      let mimeType = 'image/jpeg';
      let rawBase64 = base64Data;
      if (base64Data.startsWith('data:')) {
        const parts = base64Data.split(';base64,');
        mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        rawBase64 = parts[1] || '';
      }

      const extracted = await extractProductFromImage(rawBase64, mimeType);
      
      setFormData(prev => {
        const nextSerials = extracted.serialNumber ? [extracted.serialNumber] : (prev.serials || []);
        return {
          ...prev,
          name: extracted.name || prev.name,
          brand: extracted.brand || prev.brand,
          category: extracted.category || prev.category,
          barcode: extracted.barcode || prev.barcode,
          mrp: extracted.mrp !== undefined && extracted.mrp !== null ? String(extracted.mrp) : prev.mrp,
          price: extracted.price !== undefined && extracted.price !== null 
            ? String(extracted.price) 
            : (extracted.mrp !== undefined && extracted.mrp !== null ? String(extracted.mrp) : prev.price),
          wholesalePrice: extracted.wholesalePrice !== undefined && extracted.wholesalePrice !== null ? String(extracted.wholesalePrice) : prev.wholesalePrice,
          costPrice: extracted.costPrice !== undefined && extracted.costPrice !== null ? String(extracted.costPrice) : prev.costPrice,
          discount: extracted.discount !== undefined && extracted.discount !== null ? String(extracted.discount) : prev.discount,
          hsn: extracted.hsn || prev.hsn,
          unit: extracted.unit || prev.unit,
          size: extracted.size || prev.size,
          stock: extracted.stock !== undefined && extracted.stock !== null ? String(extracted.stock) : prev.stock,
          serialNumber: extracted.serialNumber || prev.serialNumber,
          serials: nextSerials,
          custom_box: extracted.custom_box || prev.custom_box,
          gstPercent: extracted.gstPercent !== undefined && extracted.gstPercent !== null ? String(extracted.gstPercent) : prev.gstPercent,
          description: extracted.description || prev.description
        };
      });

      setAiSuccessMessage('✨ AI auto-filled product details, barcode, pricing & specs!');
      setTimeout(() => setAiSuccessMessage(''), 7000);
    } catch (err: any) {
      console.error('AI extraction error:', err);
    } finally {
      setIsExtractingAI(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        let initialSerials: string[] = [];
        if (Array.isArray(initialData.serials)) {
          initialSerials = initialData.serials.map(s => typeof s === 'string' ? s : (s as any).code || String(s)).filter(Boolean);
        } else if (initialData.serialNumber) {
          initialSerials = initialData.serialNumber.split(',').map(s => s.trim()).filter(Boolean);
        }

        setFormData({
          id: initialData.id,
          name: initialData.name || '',
          image: initialData.image || '',
          category: initialData.category || '',
          brand: initialData.brand || '',
          barcode: initialData.barcode || '',
          hsn: initialData.hsn || '',
          serialNumber: initialData.serialNumber || (initialSerials.length ? initialSerials.join(', ') : ''),
          serials: initialSerials,
          mrp: initialData.mrp ?? '',
          costPrice: initialData.costPrice ?? '',
          price: initialData.price ?? '',
          wholesalePrice: initialData.wholesalePrice ?? '',
          discount: initialData.discount ?? '',
          gstPercent: initialData.gstPercent ?? '18',
          stock: initialData.stock ?? '0',
          low_stock_threshold: initialData.low_stock_threshold ?? '5',
          unit: initialData.unit || 'Pcs',
          size: initialData.size || '',
          custom_box: initialData.custom_box || '',
          active: initialData.active !== undefined ? initialData.active : true
        });
        setImagePreview(initialData.image || '');
      } else {
        setFormData({
          name: '',
          image: '',
          category: '',
          brand: '',
          barcode: '',
          hsn: '',
          serialNumber: '',
          serials: [],
          mrp: '',
          costPrice: '',
          price: '',
          discount: '',
          gstPercent: '18',
          stock: '0',
          low_stock_threshold: '5',
          unit: 'Pcs',
          size: '',
          custom_box: '',
          active: true
        });
        setImagePreview('');
      }
    }
  }, [isOpen, initialData]);

  // Sync scanned barcode from scanner modal
  useEffect(() => {
    if (scannedBarcode && isOpen) {
      setFormData(prev => ({ ...prev, barcode: scannedBarcode }));
    }
  }, [scannedBarcode, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showMismatchModal) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showMismatchModal]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert("Image size should be under 15MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const rawResult = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setImagePreview(compressed);
            setFormData(prev => ({ ...prev, image: compressed }));
            triggerAIExtraction(compressed);
            return;
          }
          setImagePreview(rawResult);
          setFormData(prev => ({ ...prev, image: rawResult }));
          triggerAIExtraction(rawResult);
        };
        img.onerror = () => {
          setImagePreview(rawResult);
          setFormData(prev => ({ ...prev, image: rawResult }));
          triggerAIExtraction(rawResult);
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview('');
    setFormData(prev => ({ ...prev, image: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const executeSave = async () => {
    setIsSubmitting(true);
    try {
      // Ensure serialNumber string matches serials array for backward compatibility
      const payload: CatalogItemData = {
        ...formData,
        serialNumber: formData.serials?.length ? formData.serials.join(', ') : (formData.serialNumber || ''),
        serials: formData.serials || []
      };
      await onSave(payload);
      setShowMismatchModal(false);
      onClose();
    } catch (err) {
      console.error("Failed to save catalog entry:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter Item Name");
      return;
    }

    const expectedStock = Number(formData.stock) || 0;
    const serialsCount = formData.serials?.length || 0;

    // Check if there is a mismatch between stock and scanned serials
    if (expectedStock > 0 || serialsCount > 0) {
      if (serialsCount !== expectedStock) {
        setShowMismatchModal(true);
        return;
      }
    }

    await executeSave();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window Container - Phone & Desktop Responsive */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 30 }}
          transition={{ type: "spring", damping: 26, stiffness: 340 }}
          className="relative w-full max-w-3xl lg:max-w-4xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col my-0 sm:my-auto max-h-[94vh] sm:max-h-[90vh] z-10 text-slate-900 dark:text-slate-100"
        >
          {/* Mobile Handle Indicator */}
          <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2 shrink-0" />

          {/* Sticky Header */}
          <div className="px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 border-b border-slate-100 dark:border-slate-800/90 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center justify-center text-[#166534] dark:text-green-400 shrink-0 shadow-xs">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{title}</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  Manage specifications, pricing, inventory stock &amp; barcode scanning.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Scroll Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-28 sm:pb-12 space-y-6">
            
            {/* SECTION 1: BASIC INFO */}
            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-green-400 flex items-center gap-1.5">
                  <Tag size={15} /> Basic Info
                </h3>
                <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">Core Item Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
                {/* Item Name */}
                <div className="lg:col-span-8 space-y-1.5 relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Item Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="e.g. Premium Wireless Mouse / Cotton T-Shirt"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onFocus={() => setShowNameDropdown(true)}
                      onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                      className="w-full pl-3.5 pr-10 py-2.5 sm:py-3 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all animate-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer pointer-events-none">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                  {showNameDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-xl py-1">
                      {uniqueNames
                        .filter(n => n.toLowerCase().includes((formData.name || '').toLowerCase()))
                        .map((name, index) => (
                          <button
                            key={index}
                            type="button"
                            onMouseDown={() => {
                              setFormData({ ...formData, name });
                              setShowNameDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-[#166534]/10 dark:hover:bg-green-950/40 hover:text-[#166534] dark:hover:text-green-400 transition-colors font-semibold"
                          >
                            {name}
                          </button>
                        ))
                      }
                      {uniqueNames.filter(n => n.toLowerCase().includes((formData.name || '').toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                          {formData.name ? `Type name "${formData.name}"` : 'Type to add custom item name'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Brand */}
                <div className="lg:col-span-4 space-y-1.5 relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:text-green-400">
                    Brand
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="e.g. Logitech, Nike"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      onFocus={() => setShowBrandDropdown(true)}
                      onBlur={() => setTimeout(() => setShowBrandDropdown(false), 200)}
                      className="w-full pl-3.5 pr-10 py-2.5 sm:py-3 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all animate-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer pointer-events-none">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                  {showBrandDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-xl py-1">
                      {uniqueBrands
                        .filter(b => b.toLowerCase().includes((formData.brand || '').toLowerCase()))
                        .map((brand, index) => (
                          <button
                            key={index}
                            type="button"
                            onMouseDown={() => {
                              setFormData({ ...formData, brand });
                              setShowBrandDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-[#166534]/10 dark:hover:bg-green-950/40 hover:text-[#166534] dark:hover:text-green-400 transition-colors font-semibold"
                          >
                            {brand}
                          </button>
                        ))
                      }
                      {uniqueBrands.filter(b => b.toLowerCase().includes((formData.brand || '').toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                          {formData.brand ? `Press tab to create brand "${formData.brand}"` : 'Type to add custom brand'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Group Category */}
                <div className="lg:col-span-6 space-y-1.5 relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:text-green-400">
                    Group Category
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="e.g. Electronics, Groceries, Clothing"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      onFocus={() => setShowCategoryDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                      className="w-full pl-3.5 pr-10 py-2.5 sm:py-3 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer pointer-events-none">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                  {showCategoryDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-xl py-1">
                      {uniqueCategories
                        .filter(c => c.toLowerCase().includes((formData.category || '').toLowerCase()))
                        .map((cat, index) => (
                          <button
                            key={index}
                            type="button"
                            onMouseDown={() => {
                              setFormData({ ...formData, category: cat });
                              setShowCategoryDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-[#166534]/10 dark:hover:bg-green-950/40 hover:text-[#166534] dark:hover:text-green-400 transition-colors font-semibold"
                          >
                            {cat}
                          </button>
                        ))
                      }
                      {uniqueCategories.filter(c => c.toLowerCase().includes((formData.category || '').toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                          {formData.category ? `Press tab to create category "${formData.category}"` : 'Type to add custom category'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Item Image Upload */}
                <div className="lg:col-span-6 space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Item Image
                  </label>
                  <div className="flex items-center gap-3">
                    {imagePreview ? (
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 bg-slate-50 dark:bg-slate-800 group">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute inset-0 bg-slate-950/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon size={20} />
                      </div>
                    )}

                    <div className="flex-1 flex flex-col gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="catalog-image-upload"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor="catalog-image-upload"
                          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors touch-manipulation active:scale-95"
                        >
                          <Upload size={14} className="text-[#166534] dark:text-green-400" />
                          <span>{imagePreview ? 'Change Photo' : 'Upload Image'}</span>
                        </label>

                        {imagePreview && (
                          <button
                            type="button"
                            onClick={() => triggerAIExtraction(imagePreview)}
                            disabled={isExtractingAI}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
                            title="Auto-extract product name, brand, category, barcode, price and details using Gemini AI"
                          >
                            {isExtractingAI ? (
                              <>
                                <Loader2 size={13} className="animate-spin text-emerald-600" />
                                <span>Scanning...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
                                <span>AI Auto-Fill</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {isExtractingAI && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-pulse">
                          <Loader2 size={13} className="animate-spin" />
                          <span>AI reading barcode, MRP, prices & product details...</span>
                        </div>
                      )}

                      {aiSuccessMessage && !isExtractingAI && (
                        <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>{aiSuccessMessage}</span>
                        </div>
                      )}

                      <span className="text-[10px] text-slate-400">Upload package photo for automatic AI detail &amp; barcode detection</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: IDENTIFICATION */}
            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-green-400 flex items-center gap-1.5">
                  <Barcode size={15} /> Identification &amp; Serial Number
                </h3>
                <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">SKU, HSN Code &amp; S/N Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* Unique SKU / Barcode */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Unique SKU / Barcode
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 8901234567890"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="flex-1 px-3.5 py-2.5 sm:py-3 text-sm font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenScanner) {
                          onOpenScanner();
                        } else {
                          const randomCode = '890' + Math.floor(100000000 + Math.random() * 900000000);
                          setFormData(prev => ({ ...prev, barcode: randomCode }));
                        }
                      }}
                      className="px-3.5 py-2.5 sm:py-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-[#166534] dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors flex items-center gap-1.5 shrink-0 active:scale-95 touch-manipulation"
                      title="Open Barcode Scanner Camera"
                    >
                      <ScanLine size={18} />
                      <span className="text-xs font-bold">Scan</span>
                    </button>
                  </div>
                </div>

                {/* HSN / SAC Code */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8471 (Goods) or 9983 (Services)"
                    value={formData.hsn}
                    onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:py-3 text-sm font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
                  />
                </div>

                {/* Serial Number Input Component */}
                <div className="sm:col-span-2 lg:col-span-3 pt-2">
                  <SerialNumberInput
                    value={formData.serials || []}
                    onChange={(newSerials) => {
                      setFormData(prev => ({
                        ...prev,
                        serials: newSerials,
                        serialNumber: newSerials.length > 0 ? newSerials.join(', ') : ''
                      }));
                    }}
                    expectedCount={Number(formData.stock) || 0}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: PRICING */}
            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-green-400 flex items-center gap-1.5">
                  <IndianRupee size={15} /> Pricing
                </h3>
                <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">Cost, MRP, Selling &amp; Taxes</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                {/* MRP ₹ */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all tabular-nums"
                  />
                </div>

                {/* Purchase/Cost Price ₹ */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all tabular-nums"
                  />
                </div>

                {/* Selling Price ₹ (Retail) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:text-green-400">
                    Retail Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-950/30 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all tabular-nums"
                  />
                </div>

                {/* Wholesale Price ₹ (B2B) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    Wholesale Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formData.wholesalePrice}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/30 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all tabular-nums"
                  />
                </div>

                {/* Default Discount % */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all tabular-nums"
                  />
                </div>

                {/* GST Rate % */}
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    GST Rate (%)
                  </label>
                  <select
                    value={formData.gstPercent}
                    onChange={(e) => setFormData({ ...formData, gstPercent: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
                  >
                    <option value="0">0% (Nil)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 4: INVENTORY */}
            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-green-400 flex items-center gap-1.5">
                  <Layers size={15} /> Inventory
                </h3>
                <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">Stock Levels &amp; Alert Limits</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                {/* Current Stock */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all tabular-nums"
                  />
                </div>

                {/* Alert Threshold (Red Text) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Alert Threshold
                  </label>
                  <input
                    type="number"
                    placeholder="5"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all tabular-nums"
                  />
                </div>

                {/* Unit of Measurement */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Unit of Measurement
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
                  >
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Kg">Kg (Kilograms)</option>
                    <option value="Litre">Litre (Litres)</option>
                    <option value="Box">Box (Boxes)</option>
                    <option value="Hrs">Hrs (Hours)</option>
                    <option value="Mtr">Mtr (Meters)</option>
                    <option value="Pack">Pack (Packs)</option>
                    <option value="Set">Set (Sets)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 5: VARIANTS */}
            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-green-400 flex items-center gap-1.5">
                  <Package size={15} /> Variants
                </h3>
                <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">Dimension, Color or Size Attributes</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Size / Variant
                </label>
                <input
                  type="text"
                  placeholder="e.g. XL, 500ml, Black Color, Pack of 6"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="w-full px-3.5 py-2.5 sm:py-3 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
                />
              </div>
            </div>

            {/* SECTION 6: EXTRA DETAILS & STATUS */}
            <div className="space-y-4 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-green-400 flex items-center gap-1.5">
                  <Info size={15} /> Extra Details &amp; Status
                </h3>
                <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">Invoice Notes &amp; Catalog Visibility</span>
              </div>

              {/* Custom Box / Item Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Custom Box / Item Details
                  </label>
                  <span className="text-[10px] text-slate-400 italic">
                    Shown in Invoice item description
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="e.g. Serial No: SN-82910, Batch Code: B-32, Expiry: 12/28..."
                  value={formData.custom_box}
                  onChange={(e) => setFormData({ ...formData, custom_box: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all resize-none"
                />
              </div>

              {/* Active / Inactive Toggle */}
              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Catalog Status
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                      formData.active
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                    )}>
                      {formData.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {formData.active ? 'Visible in POS billing & search selection' : 'Hidden from active billing dropdowns'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                  className={cn(
                    "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#166534] focus:ring-offset-2 touch-manipulation",
                    formData.active ? "bg-[#166534]" : "bg-slate-300 dark:bg-slate-600"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                      formData.active ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Footer Buttons (Aligned Right, Sticky at Bottom) */}
            <div className="pt-3 pb-2 sm:py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 mt-6 z-20">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 sm:py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider transition-colors active:scale-95 touch-manipulation min-h-[44px]"
              >
                Dismiss
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 sm:py-3 rounded-xl bg-[#166534] hover:bg-[#0F3D21] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-green-900/20 flex items-center gap-2 active:scale-95 touch-manipulation min-h-[44px]"
              >
                <Save size={16} />
                <span>{isSubmitting ? 'Saving...' : 'Save Updates'}</span>
              </button>
            </div>

          </form>
        </motion.div>

        {/* Serial Number Count Mismatch Confirmation Modal */}
        <AnimatePresence>
          {showMismatchModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMismatchModal(false)}
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/60 p-5 sm:p-6 space-y-4 z-20 text-slate-900 dark:text-white"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      Serial Number Count Mismatch
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Only <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm">{formData.serials?.length || 0}</span> of <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{formData.stock || 0}</span> serial numbers were scanned.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Do you want to save anyway or continue scanning serials?
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowMismatchModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Continue Editing
                  </button>
                  <button
                    type="button"
                    onClick={executeSave}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-amber-900/20 active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={15} />
                    <span>Yes, Save Anyway</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
