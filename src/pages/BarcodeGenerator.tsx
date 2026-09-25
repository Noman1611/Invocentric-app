import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useItems, useSettings } from '../hooks/useData';
import { 
  BarcodeType, 
  validateBarcode, 
  PRESET_SHEET_CONFIGS, 
  LabelSheetConfig, 
  calculateEanChecksum,
  exportMultiLabelSheetPdf,
  downloadBarcodePng,
  downloadBarcodeSvg,
  copyBarcodeToClipboard,
  PrintableLabelItem
} from '../services/barcodeService';
import { BarcodeCanvas } from '../components/BarcodeCanvas';
import { formatCurrency, cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { 
  Barcode, 
  Layers, 
  Grid, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  RefreshCw, 
  Upload, 
  FileText, 
  Trash2, 
  Plus, 
  Package, 
  Sliders, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  ChevronRight, 
  ChevronLeft,
  FileSpreadsheet,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  Store,
  Hash,
  DollarSign,
  Boxes,
  HelpCircle,
  FileDown,
  ArrowRight
} from 'lucide-react';

export interface CustomFieldEntry {
  id: string;
  label: string;
  value: string;
}

export interface BarcodeItemQueueEntry {
  id: string;
  name: string;
  code: string;
  barcodeType: BarcodeType;
  price?: number;
  mrp?: number;
  sku?: string;
  brand?: string;
  packSize?: string;
  hsn?: string;
  gst?: number;
  batchNo?: string;
  expiryDate?: string;
  description?: string;
  customFields: Record<string, string>;
  quantity: number;
  error?: string;
}

type WizardStep = 1 | 2 | 3;
type LayoutDensity = 'code_only' | 'barcode_1_field' | 'barcode_2_fields' | 'barcode_3_fields';

export default function BarcodeGenerator() {
  const { user, isOfflineMode } = useAuth();
  const { items } = useItems();
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Wizard active step: 1 (Items), 2 (Design), 3 (Sheet & Print)
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // ══════════════════════════════════════════════════════════
  // STEP 1: ITEM QUEUE & ENTRY STATE
  // ══════════════════════════════════════════════════════════
  const [itemEntryTab, setItemEntryTab] = useState<'inventory' | 'manual' | 'bulk'>('inventory');
  
  // Inventory picker state
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [inventoryItemQty, setInventoryItemQty] = useState<number>(12);

  // Manual Item Form
  const [manualName, setManualName] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualBarcodeType, setManualBarcodeType] = useState<BarcodeType>('CODE128');
  const [manualPrice, setManualPrice] = useState<number | ''>('');
  const [manualMrp, setManualMrp] = useState<number | ''>('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [manualHsn, setManualHsn] = useState('');
  const [manualPackSize, setManualPackSize] = useState('');
  const [manualQty, setManualQty] = useState<number>(12);
  const [manualCustomFields, setManualCustomFields] = useState<CustomFieldEntry[]>([]);

  // Bulk Upload State
  const [bulkFileError, setBulkFileError] = useState<string | null>(null);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  // Active Barcode Queue
  const [queue, setQueue] = useState<BarcodeItemQueueEntry[]>([
    {
      id: 'demo-1',
      name: 'Fresh Organic Almonds',
      code: '8901234567890',
      barcodeType: 'CODE128',
      price: 499,
      mrp: 599,
      brand: 'NutriFarm',
      sku: 'SKU-ALM-500',
      packSize: '500g',
      hsn: '0802',
      gst: 5,
      customFields: {},
      quantity: 12
    },
    {
      id: 'demo-2',
      name: 'Cotton T-Shirt Blue (M)',
      code: 'INV8920192',
      barcodeType: 'CODE128',
      price: 599,
      mrp: 799,
      brand: 'InvoApparel',
      sku: 'TS-BLU-M',
      packSize: '1 Pcs',
      hsn: '6109',
      gst: 12,
      customFields: {},
      quantity: 12
    }
  ]);

  // Selected item ID for single sticker preview
  const [previewItemId, setPreviewItemId] = useState<string>('demo-1');

  // Pre-fill from URL if opened from Item Catalog
  useEffect(() => {
    const itemParam = searchParams.get('item');
    if (itemParam && items.length > 0) {
      const match = items.find(i => i.id === itemParam || i.name.toLowerCase() === itemParam.toLowerCase());
      if (match) {
        const itemCode = match.barcode || `INV${match.id.slice(0, 8).toUpperCase()}`;
        const newEntry: BarcodeItemQueueEntry = {
          id: `item-${match.id}-${Date.now()}`,
          name: match.name,
          code: itemCode,
          barcodeType: 'CODE128',
          price: match.price || 0,
          mrp: match.mrp || match.price || 0,
          sku: match.hsn || `SKU-${match.id.slice(0, 6).toUpperCase()}`,
          brand: match.category || '',
          packSize: match.unit || match.size || '1 Pcs',
          hsn: match.hsn || '',
          gst: match.gstPercent || 0,
          customFields: {},
          quantity: 24
        };
        setQueue(prev => [newEntry, ...prev.filter(p => p.code !== itemCode)]);
        setPreviewItemId(newEntry.id);
      }
    }
  }, [searchParams, items]);

  // ══════════════════════════════════════════════════════════
  // STEP 2: DESIGN & FIELD MAPPING STATE
  // ══════════════════════════════════════════════════════════
  const [globalBarcodeType, setGlobalBarcodeType] = useState<BarcodeType>('CODE128');
  const [layoutDensity, setLayoutDensity] = useState<LayoutDensity>('barcode_2_fields');
  
  // Field mappings for 1, 2, or 3 fields layout
  const [field1Mapping, setField1Mapping] = useState<string>('name'); // Top header
  const [field2Mapping, setField2Mapping] = useState<string>('mrp');  // Sub / Bottom
  const [field3Mapping, setField3Mapping] = useState<string>('price'); // Secondary bottom

  // Visual customization
  const [businessName, setBusinessName] = useState<string>(() => {
    return settings?.business_name || 'InvoCentric Store';
  });

  useEffect(() => {
    if (settings?.business_name && businessName === 'InvoCentric Store') {
      setBusinessName(settings.business_name);
    }
  }, [settings]);

  const [displayValue, setDisplayValue] = useState<boolean>(true); // Human-readable digits
  const [barHeight, setBarHeight] = useState<number>(45);
  const [showBorder, setShowBorder] = useState<boolean>(true); // Subtle sticker cut border

  // ══════════════════════════════════════════════════════════
  // STEP 3: SHEET SIZE & PRINTING STATE
  // ══════════════════════════════════════════════════════════
  const [presetKey, setPresetKey] = useState<string>('a4_24');
  const [sheetConfig, setSheetConfig] = useState<LabelSheetConfig>(PRESET_SHEET_CONFIGS['a4_24']);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Preview panel toggle & zoom
  const [previewMode, setPreviewMode] = useState<'single' | 'sheet'>('single');
  const [sheetZoom, setSheetZoom] = useState<number>(100);
  const [sheetPage, setSheetPage] = useState<number>(1);

  // Sync sheet preset
  const handleSelectPreset = (key: string) => {
    setPresetKey(key);
    const cfg = PRESET_SHEET_CONFIGS[key];
    if (cfg) {
      setSheetConfig(cfg);
    }
  };

  // Helper: auto-generate standard CODE128 or EAN code
  const handleAutoGenerateCode = (type: BarcodeType = manualBarcodeType): string => {
    const ts = Date.now().toString().slice(-6);
    if (type === 'EAN13') {
      const body = '890' + ts + Math.floor(100 + Math.random() * 900).toString();
      const check = calculateEanChecksum(body.slice(0, 12));
      return body.slice(0, 12) + check;
    } else if (type === 'EAN8') {
      const body = '890' + Math.floor(1000 + Math.random() * 9000).toString().slice(0, 4);
      const check = calculateEanChecksum(body);
      return body + check;
    } else if (type === 'UPC') {
      const body = '0' + ts + Math.floor(1000 + Math.random() * 9000).toString().slice(0, 4);
      const check = calculateEanChecksum(body);
      return body + check;
    }
    return `INV-${new Date().getFullYear()}-${ts}`;
  };

  // ── Inventory Item Add ──
  const handleAddFromInventory = () => {
    if (!selectedInventoryId) return;
    const match = items.find(i => i.id === selectedInventoryId);
    if (!match) return;

    const itemCode = match.barcode || `INV${match.id.slice(0, 8).toUpperCase()}`;
    const newEntry: BarcodeItemQueueEntry = {
      id: `inv-${match.id}-${Date.now()}`,
      name: match.name,
      code: itemCode,
      barcodeType: globalBarcodeType,
      price: match.price || 0,
      mrp: match.mrp || match.price || 0,
      sku: match.hsn || `SKU-${match.id.slice(0, 6).toUpperCase()}`,
      brand: match.category || '',
      packSize: match.unit || match.size || '1 Pcs',
      hsn: match.hsn || '',
      gst: match.gstPercent || 0,
      batchNo: (match as any).batch_no || (match as any).batchNo || '',
      expiryDate: (match as any).expiry_date || (match as any).expiryDate || '',
      customFields: {},
      quantity: Math.max(1, inventoryItemQty)
    };

    setQueue(prev => [newEntry, ...prev]);
    setPreviewItemId(newEntry.id);
    setSelectedInventoryId('');
  };

  // ── Manual Item Add ──
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      alert('Please enter an item name.');
      return;
    }

    const finalCode = manualCode.trim() || handleAutoGenerateCode(manualBarcodeType);
    const validation = validateBarcode(manualBarcodeType, finalCode);

    const customFieldsMap: Record<string, string> = {};
    manualCustomFields.forEach(cf => {
      if (cf.label.trim() && cf.value.trim()) {
        customFieldsMap[cf.label.trim()] = cf.value.trim();
      }
    });

    const newEntry: BarcodeItemQueueEntry = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      code: finalCode,
      barcodeType: manualBarcodeType,
      price: manualPrice !== '' ? Number(manualPrice) : undefined,
      mrp: manualMrp !== '' ? Number(manualMrp) : undefined,
      brand: manualBrand.trim() || undefined,
      sku: manualSku.trim() || undefined,
      packSize: manualPackSize.trim() || undefined,
      hsn: manualHsn.trim() || undefined,
      customFields: customFieldsMap,
      quantity: Math.max(1, manualQty),
      error: validation.isValid ? undefined : validation.error
    };

    setQueue(prev => [newEntry, ...prev]);
    setPreviewItemId(newEntry.id);

    // Reset manual form
    setManualName('');
    setManualCode('');
    setManualPrice('');
    setManualMrp('');
    setManualBrand('');
    setManualSku('');
    setManualHsn('');
    setManualPackSize('');
    setManualCustomFields([]);
  };

  // ── Add Custom Field to Manual Form ──
  const handleAddCustomField = () => {
    if (manualCustomFields.length >= 4) return;
    setManualCustomFields(prev => [
      ...prev,
      { id: Date.now().toString(), label: '', value: '' }
    ]);
  };

  const handleUpdateCustomField = (id: string, key: 'label' | 'value', val: string) => {
    setManualCustomFields(prev => prev.map(cf => cf.id === id ? { ...cf, [key]: val } : cf));
  };

  const handleRemoveCustomField = (id: string) => {
    setManualCustomFields(prev => prev.filter(cf => cf.id !== id));
  };

  // ── Bulk Excel / CSV Upload ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBulkFileError(null);
    setBulkSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (!data || data.length === 0) {
          setBulkFileError('Uploaded file appears to be empty.');
          return;
        }

        const newEntries: BarcodeItemQueueEntry[] = data.map((row: any, idx: number) => {
          const rawName = row['Item Name'] || row['Product Name'] || row['Name'] || row['Title'] || `Item ${idx + 1}`;
          let rawBarcode = String(row['Item Code'] || row['Barcode'] || row['Code'] || row['UPC'] || '').trim();
          if (!rawBarcode) {
            rawBarcode = `INV${Date.now().toString().slice(-6)}${idx}`;
          }
          const rawType: BarcodeType = (row['Type'] || row['Barcode Type'] || globalBarcodeType) as BarcodeType;
          const rawMrp = Number(row['MRP'] || row['Mrp'] || row['M.R.P.'] || 0);
          const rawPrice = Number(row['Selling Price'] || row['Price'] || row['Rate'] || rawMrp);
          const rawBrand = row['Brand'] || row['Company'] || '';
          const rawSku = row['SKU'] || '';
          const rawHsn = row['HSN'] || row['HSN Code'] || '';
          const rawGst = Number(row['GST'] || row['GST%'] || 0);
          const rawPack = row['Pack Size'] || row['Unit'] || row['Size'] || '';
          const rawDesc = row['Description'] || row['Desc'] || '';
          const rawBatch = row['Batch'] || row['Batch No'] || row['Batch Number'] || '';
          const rawExpiry = row['Expiry'] || row['Expiry Date'] || row['Exp Date'] || '';
          const rawQty = Math.max(1, Number(row['Print Quantity'] || row['Quantity'] || row['Qty'] || 12));

          const validation = validateBarcode(rawType, rawBarcode);

          return {
            id: `bulk-${idx}-${Date.now()}`,
            name: rawName,
            code: rawBarcode,
            barcodeType: rawType,
            price: rawPrice > 0 ? rawPrice : undefined,
            mrp: rawMrp > 0 ? rawMrp : undefined,
            brand: rawBrand || undefined,
            sku: rawSku || undefined,
            packSize: rawPack || undefined,
            hsn: rawHsn || undefined,
            gst: rawGst > 0 ? rawGst : undefined,
            batchNo: rawBatch || undefined,
            expiryDate: rawExpiry || undefined,
            description: rawDesc || undefined,
            customFields: {},
            quantity: rawQty,
            error: validation.isValid ? undefined : validation.error
          };
        });

        setQueue(prev => [...newEntries, ...prev]);
        if (newEntries[0]) setPreviewItemId(newEntries[0].id);
        setBulkSuccessMsg(`Successfully imported ${newEntries.length} items to print queue!`);
      } catch (err: any) {
        console.error('Bulk parse error:', err);
        setBulkFileError('Could not parse file. Please use our sample template.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Download Sample Excel Template ──
  const handleDownloadSampleTemplate = () => {
    const sampleData = [
      {
        'Item Name': 'Premium Cotton T-Shirt (Blue, M)',
        'Item Code': '8901234567890',
        'MRP': 799,
        'Selling Price': 599,
        'Brand': 'InvoStyle',
        'SKU': 'TS-BLU-M',
        'HSN': '6109',
        'GST': 12,
        'Pack Size': '1 Pcs',
        'Description': '100% Combed Cotton',
        'Print Quantity': 24
      },
      {
        'Item Name': 'Organic Green Tea 250g',
        'Item Code': '8909876543210',
        'MRP': 349,
        'Selling Price': 299,
        'Brand': 'NaturePure',
        'SKU': 'TEA-GRN-250',
        'HSN': '0902',
        'GST': 5,
        'Pack Size': '250g',
        'Description': 'Whole Leaf Green Tea',
        'Print Quantity': 18
      },
      {
        'Item Name': 'Wireless Bluetooth Earbuds',
        'Item Code': 'INV8829101',
        'MRP': 1999,
        'Selling Price': 1499,
        'Brand': 'AcousticPro',
        'SKU': 'EB-WRL-BLK',
        'HSN': '8518',
        'GST': 18,
        'Pack Size': '1 Box',
        'Description': 'ANC Earbuds with 40h Battery',
        'Print Quantity': 12
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Barcode Template');
    XLSX.writeFile(wb, 'InvoCentric_Barcode_Import_Template.xlsx');
  };

  // ── Bulk Set All Quantities ──
  const handleSetAllQuantities = (qty: number) => {
    if (qty <= 0) return;
    setQueue(prev => prev.map(item => ({ ...item, quantity: qty })));
  };

  // ── Flattened Printable List (Total Stickers Array) ──
  const flattenedPrintableList: PrintableLabelItem[] = useMemo(() => {
    const list: PrintableLabelItem[] = [];
    queue.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        list.push({
          id: item.id,
          name: item.name,
          code: item.code,
          barcodeType: item.barcodeType || globalBarcodeType,
          price: item.price,
          mrp: item.mrp,
          sku: item.sku,
          brand: item.brand,
          packSize: item.packSize,
          hsn: item.hsn,
          gst: item.gst,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          description: item.description,
          customFields: item.customFields
        });
      }
    });
    return list;
  }, [queue, globalBarcodeType]);

  // Total Statistics
  const totalStickersCount = flattenedPrintableList.length;
  const labelsPerPage = Math.max(1, sheetConfig.columns * sheetConfig.rows);
  const totalSheetsNeeded = Math.ceil(totalStickersCount / labelsPerPage) || 1;

  // Active item for Single Label Preview
  const activePreviewItem = useMemo(() => {
    return queue.find(q => q.id === previewItemId) || queue[0] || {
      id: 'fallback',
      name: 'Sample Product Name',
      code: 'INV1002026',
      barcodeType: 'CODE128',
      price: 499,
      mrp: 599,
      brand: 'InvoCentric',
      sku: 'SKU-SAMPLE',
      packSize: '1 Pcs',
      batchNo: 'B-2409',
      expiryDate: '12/2027',
      customFields: {},
      quantity: 1
    };
  }, [queue, previewItemId]);

  // Dynamic available fields for mapping dropdowns
  const availableFieldOptions = useMemo(() => {
    const baseOptions = [
      { key: 'none', label: '-- None (Empty) --' },
      { key: 'business_name', label: 'Store / Business Name' },
      { key: 'name', label: 'Item Name' },
      { key: 'mrp', label: 'MRP (₹)' },
      { key: 'price', label: 'Selling Price (₹)' },
      { key: 'sku', label: 'SKU Code' },
      { key: 'brand', label: 'Brand Name' },
      { key: 'packSize', label: 'Pack Size / Unit' },
      { key: 'hsn', label: 'HSN Code' },
      { key: 'gst', label: 'GST Percentage' },
      { key: 'batchNo', label: 'Batch No.' },
      { key: 'expiryDate', label: 'Expiry Date' },
      { key: 'description', label: 'Description' }
    ];

    // Collect custom field keys from queue
    const customKeys = new Set<string>();
    queue.forEach(item => {
      if (item.customFields) {
        Object.keys(item.customFields).forEach(k => customKeys.add(k));
      }
    });

    customKeys.forEach(k => {
      baseOptions.push({ key: k, label: `Custom: ${k}` });
    });

    return baseOptions;
  }, [queue]);

  // ── Helper to resolve field text for single sticker preview ──
  const getPreviewFieldText = (key: string, item: any): string => {
    if (!key || key === 'none') return '';
    if (key === 'business_name') return businessName;
    if (key === 'name') return item.name || '';
    if (key === 'mrp') return item.mrp ? `MRP: ₹${item.mrp}` : '';
    if (key === 'price') return item.price ? `₹${item.price}` : '';
    if (key === 'sku') return item.sku ? `SKU: ${item.sku}` : '';
    if (key === 'brand') return item.brand || '';
    if (key === 'packSize') return item.packSize ? `Pack: ${item.packSize}` : '';
    if (key === 'hsn') return item.hsn ? `HSN: ${item.hsn}` : '';
    if (key === 'gst') return item.gst ? `GST: ${item.gst}%` : '';
    if (key === 'batchNo') return item.batchNo ? `Batch: ${item.batchNo}` : '';
    if (key === 'expiryDate') return item.expiryDate ? `Exp: ${item.expiryDate}` : '';
    if (key === 'description') return item.description || '';
    if (item.customFields && item.customFields[key]) return item.customFields[key];
    return '';
  };

  // ── Export High-Resolution PDF ──
  const handleDownloadPdf = async () => {
    if (flattenedPrintableList.length === 0) {
      alert('Your barcode queue is empty! Please add items in Step 1 first.');
      return;
    }

    setIsExportingPdf(true);
    try {
      await exportMultiLabelSheetPdf({
        items: flattenedPrintableList,
        config: sheetConfig,
        layout: layoutDensity,
        fieldMapping: {
          field1: field1Mapping !== 'none' ? field1Mapping : undefined,
          field2: field2Mapping !== 'none' ? field2Mapping : undefined,
          field3: field3Mapping !== 'none' ? field3Mapping : undefined
        },
        businessName,
        displayValue,
        showBorder,
        filename: `InvoCentric_Barcodes_${sheetConfig.name.slice(0, 10)}_${Date.now()}`
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Please verify your barcode data and try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ── Native Direct Print ──
  const handleDirectPrint = () => {
    if (flattenedPrintableList.length === 0) {
      alert('Please add items to the print queue first.');
      return;
    }
    window.print();
  };

  // ── Filtered Inventory Items for Picker ──
  const filteredInventoryItems = useMemo(() => {
    if (!inventorySearch.trim()) return items.slice(0, 15);
    const q = inventorySearch.toLowerCase();
    return items.filter(it => 
      it.name.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q)) ||
      (it.hsn && it.hsn.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q))
    ).slice(0, 25);
  }, [items, inventorySearch]);

  // Labels for the currently viewed sheet page
  const pagePrintableLabels = useMemo(() => {
    const startIndex = (sheetPage - 1) * labelsPerPage;
    return flattenedPrintableList.slice(startIndex, startIndex + labelsPerPage);
  }, [flattenedPrintableList, sheetPage, labelsPerPage]);

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-slate-900 pb-20 print:bg-white print:p-0 print:m-0">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP APP HEADER & BRANDING
      ───────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 px-4 sm:px-8 py-3.5 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#166534] flex items-center justify-center text-white shadow-sm">
              <Barcode size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Barcode Studio & Label Generator
                </h1>
                <span className="px-2 py-0.5 bg-emerald-50 text-[#166534] text-[10px] font-bold uppercase tracking-wider rounded-md border border-emerald-200/80">
                  Inventory Integrated
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Professional multi-step barcode sticker generator for A4 sheets & thermal rolls
              </p>
            </div>
          </div>

          {/* Quick Stat Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl text-xs">
              <span className="text-slate-500 font-medium">Queue:</span>
              <span className="font-bold text-[#166534]">{queue.length} items</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-slate-700">{totalStickersCount} stickers</span>
            </div>
            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf || flattenedPrintableList.length === 0}
                className="bg-[#166534] hover:bg-[#14532d] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. WIZARD STEPPER NAVIGATION
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1">
            {[
              { num: 1 as WizardStep, title: 'Item Selection & Queue', desc: 'Single, bulk & inventory' },
              { num: 2 as WizardStep, title: 'Barcode Design & Fields', desc: 'Layout & dynamic attributes' },
              { num: 3 as WizardStep, title: 'Sheet & Quantities', desc: 'A4 / Roll size & print' }
            ].map(step => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer whitespace-nowrap",
                    isActive 
                      ? "bg-emerald-50/80 border border-emerald-200 text-[#166534]" 
                      : isPast
                        ? "text-slate-700 hover:bg-slate-50"
                        : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all",
                    isActive 
                      ? "bg-[#166534] text-white shadow-xs" 
                      : isPast
                        ? "bg-emerald-100 text-[#166534]"
                        : "bg-slate-100 text-slate-500"
                  )}>
                    {isPast ? <Check size={14} strokeWidth={3} /> : step.num}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{step.title}</div>
                    <div className="text-[10px] text-slate-500 font-medium hidden md:block">{step.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Stepper Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => (prev - 1) as WizardStep)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => (prev + 1) as WizardStep)}
                disabled={queue.length === 0}
                className="bg-[#166534] hover:bg-[#14532d] text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <span>Proceed to Step {currentStep + 1}</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDirectPrint}
                className="bg-[#166534] hover:bg-[#14532d] text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Printer size={14} />
                <span>Direct Print</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. MAIN SPLIT SCREEN WORKSPACE
      ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-8 mt-4 sm:mt-6 overflow-x-hidden print:m-0 print:p-0 print:max-w-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          
          {/* ═════════════════════════════════════════════════════════
              LEFT / MAIN PANEL: 3-STEP WIZARD VIEWS
          ═════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-6 print:hidden">

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                STEP 1: ITEM SELECTION & ENTRY
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {currentStep === 1 && (
              <div className="space-y-6">
                
                {/* Method Selector Tabs */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Package size={16} className="text-[#166534]" />
                        Add Items to Barcode Queue
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Choose existing inventory, enter manual items with custom fields, or bulk upload via Excel
                      </p>
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-100/80 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setItemEntryTab('inventory')}
                      className={cn(
                        "py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        itemEntryTab === 'inventory' 
                          ? "bg-white text-[#166534] shadow-xs" 
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <Store size={14} />
                      <span>From Inventory</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemEntryTab('manual')}
                      className={cn(
                        "py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        itemEntryTab === 'manual' 
                          ? "bg-white text-[#166534] shadow-xs" 
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <Plus size={14} />
                      <span>Manual Item</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemEntryTab('bulk')}
                      className={cn(
                        "py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        itemEntryTab === 'bulk' 
                          ? "bg-white text-[#166534] shadow-xs" 
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <FileSpreadsheet size={14} />
                      <span>Bulk Excel / CSV</span>
                    </button>
                  </div>

                  {/* ── Sub-tab A: From Existing Invocentric Inventory ── */}
                  {itemEntryTab === 'inventory' && (
                    <div className="space-y-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Search Product from Inventory ({items.length} items available)
                        </label>
                        <div className="relative">
                          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by name, barcode, SKU, or category..."
                            value={inventorySearch}
                            onChange={(e) => setInventorySearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>
                      </div>

                      {/* Filtered items list */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {filteredInventoryItems.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                            No inventory items match your search.
                          </div>
                        ) : (
                          filteredInventoryItems.map(it => {
                            const isSelected = selectedInventoryId === it.id;
                            return (
                              <div
                                key={it.id}
                                onClick={() => setSelectedInventoryId(it.id)}
                                className={cn(
                                  "p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all",
                                  isSelected 
                                    ? "bg-emerald-50/70 border-emerald-300 text-slate-900 shadow-xs" 
                                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800"
                                )}
                              >
                                <div className="space-y-0.5">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span>{it.name}</span>
                                    {it.barcode && (
                                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                        {it.barcode}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                    <span>MRP: ₹{it.mrp || it.price || 0}</span>
                                    <span>•</span>
                                    <span className="text-[#166534] font-semibold">Rate: ₹{it.price || 0}</span>
                                    {it.hsn && <span>• HSN: {it.hsn}</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] font-bold",
                                    isSelected ? "bg-[#166534] text-white" : "bg-slate-100 text-slate-600"
                                  )}>
                                    {isSelected ? 'Selected' : 'Select'}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add Action Bar */}
                      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                        <div className="w-32">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Sticker Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={inventoryItemQty}
                            onChange={(e) => setInventoryItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddFromInventory}
                          disabled={!selectedInventoryId}
                          className="flex-1 mt-5 bg-[#166534] hover:bg-[#14532d] text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Plus size={15} />
                          <span>Add to Barcode Queue</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Sub-tab B: Manual Single Item ── */}
                  {itemEntryTab === 'manual' && (
                    <form onSubmit={handleAddManualItem} className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Item / Product Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Wireless Bluetooth Headphones"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Item Code / Barcode
                            </label>
                            <button
                              type="button"
                              onClick={() => setManualCode(handleAutoGenerateCode())}
                              className="text-[11px] font-bold text-[#166534] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw size={11} /> Auto-Generate
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Leave blank to auto-generate"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Barcode Format
                          </label>
                          <select
                            value={manualBarcodeType}
                            onChange={(e) => setManualBarcodeType(e.target.value as BarcodeType)}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#166534]"
                          >
                            <option value="CODE128">CODE 128 (Recommended)</option>
                            <option value="EAN13">EAN-13 (Standard Retail)</option>
                            <option value="CODE39">CODE 39 (Alphanumeric)</option>
                            <option value="UPC">UPC-A</option>
                            <option value="EAN8">EAN-8</option>
                            <option value="ITF14">ITF-14 (Packaging)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            MRP (Maximum Retail Price)
                          </label>
                          <input
                            type="number"
                            placeholder="e.g. 999"
                            value={manualMrp}
                            onChange={(e) => setManualMrp(e.target.value !== '' ? Number(e.target.value) : '')}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Selling Price / Offer Rate
                          </label>
                          <input
                            type="number"
                            placeholder="e.g. 799"
                            value={manualPrice}
                            onChange={(e) => setManualPrice(e.target.value !== '' ? Number(e.target.value) : '')}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Brand / Company (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. InvoStyle"
                            value={manualBrand}
                            onChange={(e) => setManualBrand(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Pack Size / Unit (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 500g, 1 Pcs, Pack of 2"
                            value={manualPackSize}
                            onChange={(e) => setManualPackSize(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>
                      </div>

                      {/* Dynamic Custom Fields Section */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Tag size={13} className="text-[#166534]" />
                            Dynamic Custom Fields ({manualCustomFields.length}/4)
                          </label>
                          {manualCustomFields.length < 4 && (
                            <button
                              type="button"
                              onClick={handleAddCustomField}
                              className="text-xs font-bold text-[#166534] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={13} /> Add Custom Field
                            </button>
                          )}
                        </div>

                        {manualCustomFields.map((cf, idx) => (
                          <div key={cf.id} className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="Field Name (e.g. Batch, HSN, Expiry)"
                              value={cf.label}
                              onChange={(e) => handleUpdateCustomField(cf.id, 'label', e.target.value)}
                              className="w-1/2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#166534]"
                            />
                            <input
                              type="text"
                              placeholder="Value (e.g. B-9910, 8443)"
                              value={cf.value}
                              onChange={(e) => handleUpdateCustomField(cf.id, 'value', e.target.value)}
                              className="w-1/2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#166534]"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomField(cf.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Action Bar */}
                      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                        <div className="w-32">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Sticker Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={manualQty}
                            onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>
                        <button
                          type="submit"
                          className="flex-1 mt-5 bg-[#166534] hover:bg-[#14532d] text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Plus size={15} />
                          <span>Push Item to Queue</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Sub-tab C: Bulk Excel / CSV Upload ── */}
                  {itemEntryTab === 'bulk' && (
                    <div className="space-y-4 pt-1">
                      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-[#166534] flex items-center gap-1.5">
                            <FileSpreadsheet size={15} />
                            Download Standard Template
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            Use our clean spreadsheet template with columns for Name, Barcode, MRP, Brand, SKU, and Quantity.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadSampleTemplate}
                          className="bg-white hover:bg-slate-50 text-[#166534] border border-emerald-300 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
                        >
                          <FileDown size={14} />
                          <span>Download Template (.xlsx)</span>
                        </button>
                      </div>

                      {/* Dropzone */}
                      <label className="border-2 border-dashed border-slate-200 hover:border-[#166534] rounded-2xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/30">
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <div className="w-12 h-12 rounded-xl bg-emerald-100/70 text-[#166534] flex items-center justify-center mb-2">
                          <Upload size={22} />
                        </div>
                        <div className="text-xs font-bold text-slate-800">
                          Click to select or drag &amp; drop Excel / CSV file
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Supports .xlsx, .xls, and .csv files with header rows
                        </p>
                      </label>

                      {bulkFileError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                          <AlertTriangle size={15} />
                          <span>{bulkFileError}</span>
                        </div>
                      )}

                      {bulkSuccessMsg && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#166534] flex items-center gap-2">
                          <CheckCircle2 size={15} />
                          <span>{bulkSuccessMsg}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Active Queue Table Card ── */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Active Barcode Queue
                      </h3>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full">
                        {queue.length} items
                      </span>
                    </div>

                    {queue.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Clear all items from barcode print queue?')) {
                            setQueue([]);
                          }
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Clear Queue
                      </button>
                    )}
                  </div>

                  {queue.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                      <Boxes size={28} className="mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">Your barcode print queue is empty</p>
                      <p className="text-[11px] text-slate-400">Add products from your inventory, manually, or via Excel above.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                            <th className="pb-2">Product &amp; Code</th>
                            <th className="pb-2">Prices</th>
                            <th className="pb-2">Details</th>
                            <th className="pb-2 text-center">Stickers</th>
                            <th className="pb-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {queue.map(item => {
                            const isCurrentPreview = previewItemId === item.id;
                            return (
                              <tr 
                                key={item.id} 
                                className={cn(
                                  "hover:bg-slate-50/70 transition-colors",
                                  isCurrentPreview && "bg-emerald-50/40"
                                )}
                              >
                                <td className="py-2.5 pr-2">
                                  <div className="font-bold text-slate-900 leading-tight">{item.name}</div>
                                  <div className="font-mono text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                    <span className="bg-slate-100 px-1 py-0.5 rounded">{item.code}</span>
                                    <span className="text-[9px] uppercase text-slate-400">{item.barcodeType}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 pr-2 whitespace-nowrap">
                                  {item.mrp && <div className="text-slate-500 text-[11px]">MRP: ₹{item.mrp}</div>}
                                  {item.price && <div className="text-[#166534] font-bold text-[11px]">Rate: ₹{item.price}</div>}
                                </td>
                                <td className="py-2.5 pr-2">
                                  <div className="text-[11px] text-slate-600 space-y-0.5">
                                    {item.brand && <span>Brand: {item.brand} </span>}
                                    {item.packSize && <span>({item.packSize})</span>}
                                    {item.sku && <div>SKU: {item.sku}</div>}
                                  </div>
                                </td>
                                <td className="py-2.5 text-center">
                                  <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: Math.max(1, q.quantity - 1) } : q));
                                      }}
                                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 font-bold"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      max="500"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const v = Math.max(1, parseInt(e.target.value) || 1);
                                        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: v } : q));
                                      }}
                                      className="w-12 text-center text-xs font-bold text-slate-900 border-none outline-none focus:ring-0 p-0"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: q.quantity + 1 } : q));
                                      }}
                                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewItemId(item.id)}
                                      title="Preview single sticker"
                                      className={cn(
                                        "p-1.5 rounded-lg transition-colors cursor-pointer",
                                        isCurrentPreview 
                                          ? "bg-[#166534] text-white" 
                                          : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                      )}
                                    >
                                      <Eye size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
                                      title="Remove from queue"
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Step 1 Next Button */}
                  {queue.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="bg-[#166534] hover:bg-[#14532d] text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <span>Proceed to Step 2: Barcode Design</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                STEP 2: BARCODE DESIGN & DYNAMIC FIELD CUSTOMIZATION
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {currentStep === 2 && (
              <div className="space-y-6">
                
                {/* 1. Barcode Format Selection */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Barcode size={16} className="text-[#166534]" />
                        1. Barcode Format &amp; Symbology
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Choose the standard barcode encoding for POS scanners
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { type: 'CODE128' as BarcodeType, label: 'CODE 128', desc: 'Universal alphanumeric (Recommended)' },
                      { type: 'EAN13' as BarcodeType, label: 'EAN-13', desc: '13-digit standard retail products' },
                      { type: 'CODE39' as BarcodeType, label: 'CODE 39', desc: 'Standard industrial & logistics' },
                      { type: 'UPC' as BarcodeType, label: 'UPC-A', desc: '12-digit standard retail code' },
                      { type: 'EAN8' as BarcodeType, label: 'EAN-8', desc: '8-digit compact retail labels' },
                      { type: 'ITF14' as BarcodeType, label: 'ITF-14', desc: '14-digit master shipping box' }
                    ].map(fmt => {
                      const isSelected = globalBarcodeType === fmt.type;
                      return (
                        <div
                          key={fmt.type}
                          onClick={() => {
                            setGlobalBarcodeType(fmt.type);
                            setQueue(prev => prev.map(q => ({ ...q, barcodeType: fmt.type })));
                          }}
                          className={cn(
                            "p-3 rounded-xl border text-left cursor-pointer transition-all",
                            isSelected 
                              ? "bg-emerald-50/70 border-emerald-400 text-[#166534] shadow-xs" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                          )}
                        >
                          <div className="font-bold text-xs">{fmt.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{fmt.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Information Density Layouts (4 Radio Cards) */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Sliders size={16} className="text-[#166534]" />
                        2. Information Density Layout (4 Modes)
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Select how much product info to print on each barcode sticker
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        key: 'code_only' as LayoutDensity,
                        title: 'Item Code Only',
                        desc: 'Clean minimal bars + human readable code only',
                        badge: 'Minimal'
                      },
                      {
                        key: 'barcode_1_field' as LayoutDensity,
                        title: 'Barcode + 1 Field',
                        desc: 'Header attribute (e.g. Product Name) + Barcode',
                        badge: 'Compact'
                      },
                      {
                        key: 'barcode_2_fields' as LayoutDensity,
                        title: 'Barcode + 2 Fields',
                        desc: 'Header (Product Name) + Barcode + Price / MRP',
                        badge: 'Popular'
                      },
                      {
                        key: 'barcode_3_fields' as LayoutDensity,
                        title: 'Barcode + 3 Fields',
                        desc: 'Store/Brand + Name + Barcode + Price / HSN / Size',
                        badge: 'Full Retail'
                      }
                    ].map(layout => {
                      const isSelected = layoutDensity === layout.key;
                      return (
                        <div
                          key={layout.key}
                          onClick={() => setLayoutDensity(layout.key)}
                          className={cn(
                            "p-3.5 rounded-xl border text-left cursor-pointer transition-all relative",
                            isSelected 
                              ? "bg-emerald-50/70 border-emerald-400 text-slate-900 shadow-xs ring-1 ring-emerald-300" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{layout.title}</span>
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded",
                              isSelected ? "bg-[#166534] text-white" : "bg-slate-100 text-slate-600"
                            )}>
                              {layout.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{layout.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Dynamic Field Mapping Dropdowns */}
                {layoutDensity !== 'code_only' && (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <Tag size={16} className="text-[#166534]" />
                          3. Dynamic Field Mapping
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Map which attribute prints in each position on your sticker
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Field 1 (Always active for 1, 2, 3 fields) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Field 1 (Header / Top)
                        </label>
                        <select
                          value={field1Mapping}
                          onChange={(e) => setField1Mapping(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#166534]"
                        >
                          {availableFieldOptions.map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Field 2 (Active for 2 and 3 fields) */}
                      {(layoutDensity === 'barcode_2_fields' || layoutDensity === 'barcode_3_fields') && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Field 2 ({layoutDensity === 'barcode_3_fields' ? 'Product Name' : 'Bottom / Footer'})
                          </label>
                          <select
                            value={field2Mapping}
                            onChange={(e) => setField2Mapping(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#166534]"
                          >
                            {availableFieldOptions.map(opt => (
                              <option key={opt.key} value={opt.key}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Field 3 (Active for 3 fields only) */}
                      {layoutDensity === 'barcode_3_fields' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Field 3 (Bottom Price / Tag)
                          </label>
                          <select
                            value={field3Mapping}
                            onChange={(e) => setField3Mapping(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#166534]"
                          >
                            {availableFieldOptions.map(opt => (
                              <option key={opt.key} value={opt.key}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Store Name Configuration */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Store / Business Name (Appears when Store Name is mapped)
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. InvoCentric Retail Store"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#166534]"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Fine-Tuning Dimensions & Font */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    4. Barcode Appearance Options
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                        <span>Barcode Bar Height</span>
                        <span className="font-mono text-[#166534]">{barHeight}px</span>
                      </div>
                      <input
                        type="range"
                        min="25"
                        max="80"
                        value={barHeight}
                        onChange={(e) => setBarHeight(parseInt(e.target.value))}
                        className="w-full accent-[#166534]"
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayValue}
                          onChange={(e) => setDisplayValue(e.target.checked)}
                          className="rounded text-[#166534] focus:ring-[#166534]"
                        />
                        <span>Print Human-Readable Digits below Barcode</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showBorder}
                          onChange={(e) => setShowBorder(e.target.checked)}
                          className="rounded text-[#166534] focus:ring-[#166534]"
                        />
                        <span>Print Subtle Label Border / Cut Guide</span>
                      </label>
                    </div>
                  </div>

                  {/* Step 2 Navigation */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Back to Items
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="bg-[#166534] hover:bg-[#14532d] text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <span>Proceed to Step 3: Sheet &amp; Quantities</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                STEP 3: SHEET SIZE, PER-ITEM QUANTITIES & EXPORT
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {currentStep === 3 && (
              <div className="space-y-6">
                
                {/* 1. Paper / Preset Selection */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Grid size={16} className="text-[#166534]" />
                        1. Paper &amp; Label Sheet Size Presets
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Select standard A4 die-cut sticker sheets or thermal roll printer sizes
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.entries(PRESET_SHEET_CONFIGS).map(([key, cfg]) => {
                      const isSelected = presetKey === key;
                      return (
                        <div
                          key={key}
                          onClick={() => handleSelectPreset(key)}
                          className={cn(
                            "p-3 rounded-xl border text-left cursor-pointer transition-all",
                            isSelected 
                              ? "bg-emerald-50/70 border-emerald-400 text-slate-900 shadow-xs ring-1 ring-emerald-300" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{cfg.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {cfg.columns}×{cfg.rows} ({cfg.columns * cfg.rows}/pg)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Label Size: {cfg.labelWidthMm}mm × {cfg.labelHeightMm}mm
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Per-Item Quantity Control & Quick Toolbar */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Hash size={16} className="text-[#166534]" />
                        2. Per-Item Sticker Quantities
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Set exact sticker count needed for each product
                      </p>
                    </div>

                    {/* Quick Set All Toolbar */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                      <span className="text-[11px] text-slate-400 font-medium">Set All:</span>
                      <button
                        type="button"
                        onClick={() => handleSetAllQuantities(1)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold"
                      >
                        1 each
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllQuantities(6)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold"
                      >
                        6 each
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllQuantities(12)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold"
                      >
                        12 each
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllQuantities(labelsPerPage)}
                        className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-[#166534] rounded text-[11px] font-bold"
                      >
                        1 Full Sheet ({labelsPerPage})
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {queue.map(item => (
                      <div 
                        key={item.id} 
                        className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="font-mono text-[10px] text-slate-500">{item.code}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Stickers:</span>
                          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: Math.max(1, q.quantity - 1) } : q));
                              }}
                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="500"
                              value={item.quantity}
                              onChange={(e) => {
                                const v = Math.max(1, parseInt(e.target.value) || 1);
                                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: v } : q));
                              }}
                              className="w-14 text-center text-xs font-bold text-slate-900 border-none outline-none focus:ring-0 p-0"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: q.quantity + 1 } : q));
                              }}
                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Bar */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#166534]">
                        Total Stickers: {totalStickersCount} stickers across {queue.length} products
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Fits onto {totalSheetsNeeded} physical {sheetConfig.paperSize} sheet(s) ({labelsPerPage} stickers/sheet)
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold px-2.5 py-1 bg-[#166534] text-white rounded-lg">
                        {totalSheetsNeeded} Page{totalSheetsNeeded > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Export & Action Controls */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    3. Export &amp; Print Actions
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={isExportingPdf || flattenedPrintableList.length === 0}
                      className="bg-[#166534] hover:bg-[#14532d] text-white p-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Download size={16} />
                      <span>{isExportingPdf ? 'Generating Vector PDF...' : 'Download High-Resolution PDF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectPrint}
                      disabled={flattenedPrintableList.length === 0}
                      className="bg-slate-900 hover:bg-black text-white p-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Printer size={16} />
                      <span>Direct Print (OS Dialog)</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Back to Design
                    </button>
                    <span className="text-xs text-slate-400 font-medium">Ready to print with zero scaling distortion</span>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* ═════════════════════════════════════════════════════════
              RIGHT / PREVIEW PANEL: STICKY REAL-TIME LIVE PREVIEW
          ═════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-4 lg:sticky lg:top-20 print:hidden">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              
              {/* Preview Header & Controls */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('single')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      previewMode === 'single' ? "bg-white text-[#166534] shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Single Sticker
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('sheet')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      previewMode === 'sheet' ? "bg-white text-[#166534] shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Sheet Grid ({totalSheetsNeeded}p)
                  </button>
                </div>

                {/* Zoom / Page switcher */}
                {previewMode === 'sheet' ? (
                  <div className="flex items-center gap-2">
                    {totalSheetsNeeded > 1 && (
                      <div className="flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setSheetPage(prev => Math.max(1, prev - 1))}
                          disabled={sheetPage <= 1}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <span className="font-bold text-slate-700">{sheetPage}/{totalSheetsNeeded}</span>
                        <button
                          type="button"
                          onClick={() => setSheetPage(prev => Math.min(totalSheetsNeeded, prev + 1))}
                          disabled={sheetPage >= totalSheetsNeeded}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Live Sticker Render
                  </span>
                )}
              </div>

              {/* Preview Body */}
              <div className="p-3 sm:p-6 bg-slate-100/60 min-h-[320px] sm:min-h-[360px] flex items-center justify-center overflow-auto max-w-full">
                
                {/* ── View A: Single Sticker Preview ── */}
                {previewMode === 'single' && (
                  <div className="w-full max-w-[280px]">
                    <div className="bg-white rounded-xl border border-slate-300 shadow-md p-4 text-center space-y-2 transition-all">
                      {/* Top Field */}
                      {layoutDensity !== 'code_only' && (
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {getPreviewFieldText(field1Mapping, activePreviewItem) || activePreviewItem.name}
                        </div>
                      )}

                      {/* Barcode Graphic */}
                      <div className="py-1 flex items-center justify-center bg-white">
                        <BarcodeCanvas
                          options={{
                            type: activePreviewItem.barcodeType || globalBarcodeType,
                            value: activePreviewItem.code,
                            height: Math.min(barHeight, 55),
                            width: 2,
                            displayValue,
                            fontSize: 12,
                            margin: 2
                          }}
                          className="max-w-full"
                        />
                      </div>

                      {/* Middle/Bottom Fields */}
                      {layoutDensity === 'barcode_2_fields' && (
                        <div className="font-bold text-xs text-[#166534] truncate">
                          {getPreviewFieldText(field2Mapping, activePreviewItem) || (activePreviewItem.price ? `₹${activePreviewItem.price}` : '')}
                        </div>
                      )}

                      {layoutDensity === 'barcode_3_fields' && (
                        <div className="space-y-0.5 pt-0.5 border-t border-slate-100">
                          <div className="text-[11px] font-semibold text-slate-700 truncate">
                            {getPreviewFieldText(field2Mapping, activePreviewItem)}
                          </div>
                          <div className="font-bold text-xs text-[#166534] truncate">
                            {getPreviewFieldText(field3Mapping, activePreviewItem) || (activePreviewItem.price ? `₹${activePreviewItem.price}` : '')}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Item Picker if multiple items */}
                    {queue.length > 1 && (
                      <div className="mt-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Previewing Product:
                        </label>
                        <select
                          value={previewItemId}
                          onChange={(e) => setPreviewItemId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          {queue.map(q => (
                            <option key={q.id} value={q.id}>{q.name} ({q.code})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* ── View B: Full Sheet Grid Preview ── */}
                {previewMode === 'sheet' && (
                  <div className="w-full overflow-x-auto overflow-y-auto max-h-[460px] p-1 sm:p-2 flex justify-center">
                    <div 
                      className="bg-white border border-slate-300 shadow-lg rounded-sm p-2 sm:p-3 transition-all box-border"
                      style={{
                        width: 'min(320px, 100%)',
                        maxWidth: '100%',
                        minHeight: '400px'
                      }}
                    >
                      <div 
                        className="grid gap-1.5"
                        style={{
                          gridTemplateColumns: `repeat(${sheetConfig.columns}, minmax(0, 1fr))`
                        }}
                      >
                        {pagePrintableLabels.map((lbl, idx) => (
                          <div
                            key={idx}
                            className="border border-dashed border-slate-200 bg-white rounded p-1 text-center flex flex-col justify-between overflow-hidden"
                            style={{
                              height: `${Math.max(34, Math.min(80, sheetConfig.labelHeightMm * 1.5))}px`
                            }}
                          >
                            {layoutDensity !== 'code_only' && (
                              <div className="text-[8px] font-bold text-slate-900 truncate leading-none">
                                {getPreviewFieldText(field1Mapping, lbl) || lbl.name}
                              </div>
                            )}

                            <div className="my-auto py-0.5">
                              <BarcodeCanvas
                                options={{
                                  type: lbl.barcodeType || globalBarcodeType,
                                  value: lbl.code,
                                  height: 20,
                                  width: 1,
                                  displayValue: false,
                                  margin: 0
                                }}
                                className="w-full max-h-6"
                              />
                              <div className="font-mono text-[7px] text-slate-600 truncate leading-none mt-0.5">
                                {lbl.code}
                              </div>
                            </div>

                            {layoutDensity === 'barcode_2_fields' && (
                              <div className="text-[8px] font-bold text-[#166534] truncate leading-none">
                                {getPreviewFieldText(field2Mapping, lbl) || (lbl.price ? `₹${lbl.price}` : '')}
                              </div>
                            )}

                            {layoutDensity === 'barcode_3_fields' && (
                              <div className="text-[7.5px] font-bold text-[#166534] truncate leading-none">
                                {getPreviewFieldText(field3Mapping, lbl) || (lbl.price ? `₹${lbl.price}` : '')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Single Label Quick Action Bar */}
              <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Single Label Actions:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      const success = await copyBarcodeToClipboard({
                        type: activePreviewItem.barcodeType || globalBarcodeType,
                        value: activePreviewItem.code,
                        height: barHeight,
                        width: 2,
                        displayValue,
                        fontSize: 12
                      });
                      if (success) {
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }
                    }}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Copy Barcode to Clipboard"
                  >
                    {copySuccess ? <Check size={13} className="text-[#166534]" /> : <Copy size={13} />}
                    <span className="text-[11px] font-semibold">{copySuccess ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      downloadBarcodePng({
                        type: activePreviewItem.barcodeType || globalBarcodeType,
                        value: activePreviewItem.code,
                        height: barHeight,
                        width: 2,
                        displayValue,
                        fontSize: 12
                      }, `${activePreviewItem.name}_${activePreviewItem.code}`);
                    }}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Download PNG"
                  >
                    <Download size={13} />
                    <span className="text-[11px] font-semibold">PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      downloadBarcodeSvg({
                        type: activePreviewItem.barcodeType || globalBarcodeType,
                        value: activePreviewItem.code,
                        height: barHeight,
                        width: 2,
                        displayValue,
                        fontSize: 12
                      }, `${activePreviewItem.name}_${activePreviewItem.code}`);
                    }}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Download SVG"
                  >
                    <Download size={13} />
                    <span className="text-[11px] font-semibold">SVG</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Helper Card */}
            <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200/70 p-4 text-xs space-y-1.5">
              <div className="font-bold text-[#166534] flex items-center gap-1.5">
                <Sparkles size={14} />
                Printing Tip for Best Quality
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                In your browser or operating system print dialog, make sure <strong>Margins</strong> is set to <strong>None</strong> and <strong>Scale</strong> is set to <strong>100% (Default)</strong> for exact millimeter alignment with physical die-cut sheets.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          4. DEDICATED PRINT ENGINE (Rendered only on window.print())
      ───────────────────────────────────────────────────────────── */}
      <div id="printable-barcode-sheet" className="hidden print:block">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { margin: 0; padding: 0; background: white !important; }
            @page {
              size: ${sheetConfig.paperSize === 'A4' ? 'A4 portrait' : `${sheetConfig.pageWidthMm}mm ${sheetConfig.pageHeightMm}mm`};
              margin: 0;
            }
            .print-sheet-page {
              page-break-after: always;
              break-after: page;
              width: ${sheetConfig.pageWidthMm}mm;
              height: ${sheetConfig.pageHeightMm}mm;
              padding: ${sheetConfig.marginTopMm}mm ${sheetConfig.marginRightMm}mm ${sheetConfig.marginBottomMm}mm ${sheetConfig.marginLeftMm}mm;
              box-sizing: border-box;
              display: grid;
              grid-template-columns: repeat(${sheetConfig.columns}, ${sheetConfig.labelWidthMm}mm);
              column-gap: ${sheetConfig.gapHorizontalMm}mm;
              row-gap: ${sheetConfig.gapVerticalMm}mm;
            }
            .print-label-cell {
              width: ${sheetConfig.labelWidthMm}mm;
              height: ${sheetConfig.labelHeightMm}mm;
              box-sizing: border-box;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              padding: 1.5mm;
              ${showBorder ? 'border: 0.15mm solid #cbd5e1;' : ''}
            }
          }
        `}} />

        {Array.from({ length: totalSheetsNeeded }).map((_, pIdx) => {
          const pageItems = flattenedPrintableList.slice(pIdx * labelsPerPage, (pIdx + 1) * labelsPerPage);
          return (
            <div key={pIdx} className="print-sheet-page">
              {pageItems.map((lbl, cIdx) => (
                <div key={cIdx} className="print-label-cell">
                  {layoutDensity !== 'code_only' && (
                    <div className="font-bold text-[8pt] leading-tight text-slate-900 truncate w-full">
                      {getPreviewFieldText(field1Mapping, lbl) || lbl.name}
                    </div>
                  )}

                  <div className="my-auto w-full flex flex-col items-center justify-center">
                    <BarcodeCanvas
                      options={{
                        type: lbl.barcodeType || globalBarcodeType,
                        value: lbl.code,
                        height: Math.min(barHeight, 35),
                        width: 1.5,
                        displayValue,
                        fontSize: 10,
                        margin: 1
                      }}
                      className="max-w-full"
                    />
                  </div>

                  {layoutDensity === 'barcode_2_fields' && (
                    <div className="font-bold text-[8pt] text-[#166534] truncate w-full">
                      {getPreviewFieldText(field2Mapping, lbl) || (lbl.price ? `₹${lbl.price}` : '')}
                    </div>
                  )}

                  {layoutDensity === 'barcode_3_fields' && (
                    <div className="w-full">
                      <div className="font-semibold text-[7pt] text-slate-700 truncate">
                        {getPreviewFieldText(field2Mapping, lbl)}
                      </div>
                      <div className="font-bold text-[8pt] text-[#166534] truncate">
                        {getPreviewFieldText(field3Mapping, lbl) || (lbl.price ? `₹${lbl.price}` : '')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

    </div>
  );
}
