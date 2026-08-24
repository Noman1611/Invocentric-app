import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../hooks/useData';
import { dbService } from '../services/dbService';
import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { 
  BarcodeType, 
  BarcodeOptions, 
  validateBarcode, 
  downloadBarcodePng, 
  downloadBarcodeSvg, 
  exportSingleBarcodePdf, 
  copyBarcodeToClipboard,
  PRESET_SHEET_CONFIGS,
  LabelSheetConfig,
  calculateEanChecksum
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
  Save, 
  Package, 
  Sliders, 
  History as HistoryIcon, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  ChevronRight, 
  FileSpreadsheet
} from 'lucide-react';

interface BulkRowItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  type: BarcodeType;
  price: number;
  mrp: number;
  qty: number;
  selected: boolean;
  error?: string;
}

export default function BarcodeGenerator() {
  const { user, isOfflineMode, isPro, triggerUpgradeModal } = useAuth();
  const { items } = useItems();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get('tab') || 'single';

  // ── 1. Single Barcode State ──
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
  const [barcodeValue, setBarcodeValue] = useState('INV1002026');
  const [productName, setProductName] = useState('Fresh Organic Almonds 500g');
  const [sku, setSku] = useState('SKU-ALM-500');
  const [price, setPrice] = useState<number | ''>(499);
  const [mrp, setMrp] = useState<number | ''>(599);
  const [selectedProductId, setSelectedProductId] = useState('');
  
  // Customization Options
  const [barWidth, setBarWidth] = useState(2);
  const [barHeight, setBarHeight] = useState(60);
  const [displayValue, setDisplayValue] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [margin, setMargin] = useState(8);
  const [lineColor, setLineColor] = useState('#000000');
  const [background, setBackground] = useState('#ffffff');
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Copy & Action Feedback
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── 2. Label Designer & Sheet Printing State ──
  const [sheetPresetKey, setSheetPresetKey] = useState<string>('a4_24');
  const [sheetConfig, setSheetConfig] = useState<LabelSheetConfig>(PRESET_SHEET_CONFIGS['a4_24']);
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [businessName, setBusinessName] = useState('InvoCentic Retail');
  const [showPriceTag, setShowPriceTag] = useState(true);
  const [showMrpTag, setShowMrpTag] = useState(true);
  const [showSkuTag, setShowSkuTag] = useState(true);
  const [customCopies, setCustomCopies] = useState<number>(24);

  // ── 3. Bulk Generator State ──
  const [bulkRows, setBulkRows] = useState<BulkRowItem[]>([
    { id: '1', name: 'Cotton T-Shirt Blue', sku: 'TS-BLU-M', barcode: '8901234567890', type: 'EAN13', price: 599, mrp: 799, qty: 6, selected: true },
    { id: '2', name: 'Denim Jeans Slim Fit', sku: 'JN-SLM-32', barcode: '8901234567807', type: 'EAN13', price: 1299, mrp: 1599, qty: 6, selected: true },
    { id: '3', name: 'Wireless Bluetooth Earbuds', sku: 'EB-WRL-BLK', barcode: '8901234567715', type: 'EAN13', price: 1499, mrp: 1999, qty: 12, selected: true }
  ]);

  // ── 4. History State ──
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Load history on mount
  useEffect(() => {
    const saved = getSecureStorage('invocentric_barcode_history', []);
    if (Array.isArray(saved)) {
      setHistoryList(saved);
    }
  }, []);

  // Save entry to history
  const recordHistory = (entry: any) => {
    const next = [
      {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...entry
      },
      ...historyList
    ].slice(0, 50);
    setHistoryList(next);
    setSecureStorage('invocentric_barcode_history', next);
  };

  // Pre-fill from URL param if opened from Product Catalog
  useEffect(() => {
    const itemParam = searchParams.get('item');
    if (itemParam && items.length > 0) {
      const match = items.find(i => i.id === itemParam || i.name.toLowerCase() === itemParam.toLowerCase());
      if (match) {
        setSelectedProductId(match.id);
        setProductName(match.name);
        setPrice(match.price || 0);
        setMrp(match.mrp || match.price || 0);
        setSku(match.hsn || match.size || `SKU-${match.id.slice(0, 6).toUpperCase()}`);
        if (match.barcode) {
          setBarcodeValue(match.barcode);
        } else {
          // generate standard code without mutating product until user saves
          setBarcodeValue(`INV${match.id.slice(0, 8).toUpperCase()}`);
        }
      }
    }
  }, [searchParams, items]);

  // Live options for Single Barcode
  const barcodeOptions: BarcodeOptions = useMemo(() => ({
    type: barcodeType,
    value: barcodeValue,
    width: barWidth,
    height: barHeight,
    displayValue,
    fontSize,
    margin,
    lineColor,
    background
  }), [barcodeType, barcodeValue, barWidth, barHeight, displayValue, fontSize, margin, lineColor, background]);

  // Real-time validation check
  useEffect(() => {
    const val = validateBarcode(barcodeType, barcodeValue);
    if (!val.isValid) {
      setValidationError(val.error || 'Invalid barcode format');
    } else {
      setValidationError(null);
    }
  }, [barcodeType, barcodeValue]);

  // Handle Preset Sheet selection
  const handleSelectPreset = (key: string) => {
    setSheetPresetKey(key);
    const cfg = PRESET_SHEET_CONFIGS[key];
    if (cfg) {
      setSheetConfig(cfg);
      setCustomCopies(cfg.columns * cfg.rows);
    }
  };

  // Generate deterministic new valid barcode if user explicitly clicks "Generate"
  const handleGenerateDeterministicBarcode = () => {
    const ts = Date.now().toString().slice(-6);
    if (barcodeType === 'EAN13') {
      const body = '890' + ts + Math.floor(100 + Math.random() * 900).toString();
      const check = calculateEanChecksum(body.slice(0, 12));
      setBarcodeValue(body.slice(0, 12) + check);
    } else if (barcodeType === 'EAN8') {
      const body = '890' + Math.floor(1000 + Math.random() * 9000).toString().slice(0, 4);
      const check = calculateEanChecksum(body);
      setBarcodeValue(body + check);
    } else if (barcodeType === 'UPC') {
      const body = '0' + ts + Math.floor(1000 + Math.random() * 9000).toString().slice(0, 4);
      const check = calculateEanChecksum(body);
      setBarcodeValue(body + check);
    } else {
      setBarcodeValue(`INV-${new Date().getFullYear()}-${ts}`);
    }
  };

  // Save Barcode back to InvoCentic Product Catalog
  const handleSaveToProduct = async () => {
    if (!selectedProductId || !user) {
      alert('Please select an existing product from your catalog first.');
      return;
    }
    const val = validateBarcode(barcodeType, barcodeValue);
    if (!val.isValid) {
      alert(`Cannot save invalid barcode: ${val.error}`);
      return;
    }

    try {
      await dbService.update('items', selectedProductId, {
        barcode: barcodeValue.trim(),
        updated_at: new Date().toISOString()
      }, { offlineMode: isOfflineMode, userId: user.uid });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      recordHistory({
        action: 'Save to Product',
        type: barcodeType,
        value: barcodeValue,
        productName,
        price,
        sku
      });
    } catch (err) {
      console.error('Failed to save barcode to product:', err);
      alert('Failed to update product barcode in database.');
    }
  };

  // Copy Barcode Image
  const handleCopy = async () => {
    const success = await copyBarcodeToClipboard(barcodeOptions);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      alert('Failed to copy image to clipboard in this browser.');
    }
  };

  // 1-Click Print
  const handlePrint = () => {
    recordHistory({
      action: 'Print Label',
      type: barcodeType,
      value: barcodeValue,
      productName,
      price,
      sku
    });
    window.print();
  };

  // Handle Excel / CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const newRows: BulkRowItem[] = data.map((row: any, idx: number) => {
          const rawName = row['Product Name'] || row['Name'] || row['Item'] || `Imported Item ${idx + 1}`;
          const rawSku = row['SKU'] || row['Code'] || `SKU-${idx + 1}`;
          const rawBarcode = String(row['Barcode'] || row['Barcode Value'] || row['UPC'] || `890${Date.now().toString().slice(-9)}`);
          const rawType: BarcodeType = (row['Type'] || row['Barcode Type'] || 'CODE128') as BarcodeType;
          const rawPrice = Number(row['Price'] || row['Rate'] || 0);
          const rawMrp = Number(row['MRP'] || rawPrice);
          const rawQty = Number(row['Quantity'] || row['Qty'] || 1);

          const validation = validateBarcode(rawType, rawBarcode);

          return {
            id: `import-${idx}-${Date.now()}`,
            name: rawName,
            sku: rawSku,
            barcode: rawBarcode,
            type: rawType,
            price: rawPrice,
            mrp: rawMrp,
            qty: Math.max(1, rawQty),
            selected: true,
            error: validation.isValid ? undefined : validation.error
          };
        });

        setBulkRows(newRows);
        recordHistory({
          action: 'Bulk Import',
          count: newRows.length
        });
      } catch (ex) {
        console.error('Error parsing file:', ex);
        alert('Failed to parse Excel/CSV. Please make sure columns are named "Product Name", "Barcode", "Price".');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Build items array for Label Sheet Printing
  const printableLabels = useMemo(() => {
    if (activeTab === 'bulk') {
      const selected = bulkRows.filter(r => r.selected);
      const list: any[] = [];
      selected.forEach(r => {
        for (let i = 0; i < r.qty; i++) {
          list.push({
            name: r.name,
            sku: r.sku,
            barcode: r.barcode,
            type: r.type,
            price: r.price,
            mrp: r.mrp
          });
        }
      });
      return list;
    } else {
      const list: any[] = [];
      for (let i = 0; i < customCopies; i++) {
        list.push({
          name: productName,
          sku: sku,
          barcode: barcodeValue,
          type: barcodeType,
          price: Number(price) || 0,
          mrp: Number(mrp) || 0
        });
      }
      return list;
    }
  }, [activeTab, bulkRows, customCopies, productName, sku, barcodeValue, barcodeType, price, mrp]);

  return (
    <div className="min-h-screen bg-[#F8FAFB] pb-16 print:bg-white print:p-0 print:m-0">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 md:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Barcode size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-slate-900 leading-none">Barcode Studio & Label Generator</h1>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-blue-200">
                PRO MODULE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              100% Vector Barcodes, Live Physical Label Sheet Printing &amp; Inventory Integration
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { key: 'single', label: 'Single Barcode', icon: Barcode },
            { key: 'bulk', label: 'Bulk Generator', icon: Layers },
            { key: 'labels', label: 'Label Sheet Designer', icon: Grid },
            { key: 'history', label: 'History', icon: HistoryIcon },
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSearchParams({ tab: t.key })}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  active 
                    ? "bg-white text-blue-700 shadow-sm shadow-slate-200 border border-slate-200/60" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-6 print:m-0 print:p-0 print:max-w-none">
        {/* ═══════════ TAB 1: SINGLE BARCODE GENERATOR ═══════════ */}
        {activeTab === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
            {/* Left Config Panel */}
            <div className="lg:col-span-5 space-y-6 print:hidden">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Sliders size={16} className="text-blue-600" />
                    Barcode Configuration
                  </h3>
                  <button
                    type="button"
                    onClick={handleGenerateDeterministicBarcode}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    Generate New Code
                  </button>
                </div>

                {/* Load Product from Inventory */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Link with Product (Catalog)
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setSelectedProductId(pid);
                      const match = items.find(i => i.id === pid);
                      if (match) {
                        setProductName(match.name);
                        setPrice(match.price || 0);
                        setMrp(match.mrp || match.price || 0);
                        setSku(match.hsn || match.size || `SKU-${match.id.slice(0, 6).toUpperCase()}`);
                        if (match.barcode) setBarcodeValue(match.barcode);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">-- Custom (No Product Linked) --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.barcode ? `Barcode: ${it.barcode}` : 'No Barcode'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format & Barcode Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Barcode Type / Format
                    </label>
                    <select
                      value={barcodeType}
                      onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 font-mono"
                    >
                      <option value="CODE128">CODE128 (Standard)</option>
                      <option value="EAN13">EAN-13 (13 Digits Retail)</option>
                      <option value="EAN8">EAN-8 (8 Digits)</option>
                      <option value="UPC">UPC-A (12 Digits)</option>
                      <option value="CODE39">CODE39 (Industrial)</option>
                      <option value="ITF14">ITF-14 (14 Digits Carton)</option>
                      <option value="codabar">CODABAR (Logistics)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Barcode Value / Number
                    </label>
                    <input
                      type="text"
                      value={barcodeValue}
                      onChange={(e) => setBarcodeValue(e.target.value)}
                      placeholder="e.g. 8901234567890"
                      className={cn(
                        "w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all focus:outline-none",
                        validationError 
                          ? "bg-rose-50 border border-rose-300 text-rose-900 focus:border-rose-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-blue-600"
                      )}
                    />
                  </div>
                </div>

                {/* Validation Error Alert */}
                {validationError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-fadeIn">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Validation Issue:</p>
                      <p className="text-[11px] text-rose-700 font-medium">{validationError}</p>
                    </div>
                  </div>
                )}

                {/* Product Metadata Info */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Product Name (Display on Label)
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Product description"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        SKU / Code
                      </label>
                      <input
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="SKU-001"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Selling Price (₹)
                      </label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="₹ Price"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        MRP (₹)
                      </label>
                      <input
                        type="number"
                        value={mrp}
                        onChange={(e) => setMrp(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="₹ MRP"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Sizing & Geometry Sliders */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Bar Width: {barWidth}px</span>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.5}
                      value={barWidth}
                      onChange={(e) => setBarWidth(Number(e.target.value))}
                      className="w-32 accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Height: {barHeight}px</span>
                    <input
                      type="range"
                      min={30}
                      max={120}
                      step={5}
                      value={barHeight}
                      onChange={(e) => setBarHeight(Number(e.target.value))}
                      className="w-32 accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Font Size: {fontSize}px</span>
                    <input
                      type="range"
                      min={10}
                      max={20}
                      step={1}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-32 accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Save to Product Button */}
                {selectedProductId && (
                  <button
                    type="button"
                    onClick={handleSaveToProduct}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {saveSuccess ? (
                      <>
                        <Check size={16} />
                        <span>Barcode Saved to Product Catalog!</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Save Barcode to Selected Product</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Right Live Preview & Export Panel */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center relative min-h-[380px]">
                <div className="absolute top-4 left-6 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Vector Preview</span>
                </div>

                {/* Sticker Label Preview Box */}
                <div className="w-full max-w-sm bg-white border-2 border-dashed border-slate-300 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-lg my-6">
                  {showBusinessName && (
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                      {businessName}
                    </p>
                  )}

                  {productName && (
                    <p className="text-sm font-black text-slate-900 leading-tight mb-2 line-clamp-2">
                      {productName}
                    </p>
                  )}

                  {/* Rendered Barcode SVG */}
                  <div className="my-2 max-w-full overflow-hidden">
                    <BarcodeCanvas options={barcodeOptions} />
                  </div>

                  {/* Price & SKU row */}
                  <div className="flex items-center justify-center gap-4 mt-2 font-bold text-xs">
                    {sku && <span className="text-slate-500 font-mono">SKU: {sku}</span>}
                    {price !== '' && (
                      <span className="text-emerald-700 font-black text-sm">
                        ₹{price}
                        {mrp !== '' && mrp > price && (
                          <span className="text-slate-400 text-xs font-normal line-through ml-1.5">
                            ₹{mrp}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => downloadBarcodePng(barcodeOptions, productName)}
                    className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download size={14} className="text-blue-600" />
                    <span>PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadBarcodeSvg(barcodeOptions, productName)}
                    className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download size={14} className="text-indigo-600" />
                    <span>SVG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportSingleBarcodePdf(barcodeOptions, { name: productName, price: Number(price) || undefined, mrp: Number(mrp) || undefined, sku }, businessName)}
                    className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileText size={14} className="text-rose-600" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copySuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchParams({ tab: 'labels' })}
                    className="col-span-2 sm:col-span-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>Print Sheet</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 2: BULK BARCODE GENERATOR ═══════════ */}
        {activeTab === 'bulk' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Layers size={18} className="text-blue-600" />
                    Bulk Barcode Batch Generator &amp; Excel Import
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Generate, validate, and print 100+ barcodes together in a single batch.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <label className="py-2 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer">
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>Import Excel / CSV</span>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setBulkRows(prev => [
                        ...prev,
                        {
                          id: Date.now().toString(),
                          name: `Product ${prev.length + 1}`,
                          sku: `SKU-${prev.length + 1}`,
                          barcode: `890${Date.now().toString().slice(-9)}`,
                          type: 'CODE128',
                          price: 100,
                          mrp: 120,
                          qty: 5,
                          selected: true
                        }
                      ]);
                    }}
                    className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Add Row</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchParams({ tab: 'labels' })}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>Print Batch Labels</span>
                  </button>
                </div>
              </div>

              {/* Bulk Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase tracking-wider font-extrabold">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={bulkRows.every(r => r.selected)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setBulkRows(prev => prev.map(r => ({ ...r, selected: checked })));
                          }}
                          className="rounded text-blue-600"
                        />
                      </th>
                      <th className="py-3 px-3">Product Name</th>
                      <th className="py-3 px-3">SKU</th>
                      <th className="py-3 px-3">Barcode Format</th>
                      <th className="py-3 px-3">Barcode Value</th>
                      <th className="py-3 px-3">Price (₹)</th>
                      <th className="py-3 px-3">MRP (₹)</th>
                      <th className="py-3 px-3 w-20 text-center">Qty</th>
                      <th className="py-3 px-3 text-center">Preview</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkRows.map((row, idx) => (
                      <tr key={row.id} className={cn("hover:bg-slate-50/80 transition-colors", row.error && "bg-rose-50/40")}>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, selected: checked } : r));
                            }}
                            className="rounded text-blue-600"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => {
                              const v = e.target.value;
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, name: v } : r));
                            }}
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) => {
                              const v = e.target.value;
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, sku: v } : r));
                            }}
                            className="w-24 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const t = e.target.value as BarcodeType;
                              const valRes = validateBarcode(t, row.barcode);
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, type: t, error: valRes.isValid ? undefined : valRes.error } : r));
                            }}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 font-mono"
                          >
                            <option value="CODE128">CODE128</option>
                            <option value="EAN13">EAN-13</option>
                            <option value="EAN8">EAN-8</option>
                            <option value="UPC">UPC-A</option>
                            <option value="CODE39">CODE39</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.barcode}
                            onChange={(e) => {
                              const b = e.target.value;
                              const valRes = validateBarcode(row.type, b);
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, barcode: b, error: valRes.isValid ? undefined : valRes.error } : r));
                            }}
                            className={cn(
                              "w-36 px-2.5 py-1 rounded-lg text-xs font-mono font-bold",
                              row.error ? "border border-rose-300 bg-rose-50 text-rose-900" : "border border-slate-200 bg-white text-slate-800"
                            )}
                          />
                          {row.error && <p className="text-[10px] text-rose-600 font-medium mt-0.5">{row.error}</p>}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            value={row.price}
                            onChange={(e) => {
                              const p = Number(e.target.value);
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, price: p } : r));
                            }}
                            className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            value={row.mrp}
                            onChange={(e) => {
                              const m = Number(e.target.value);
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, mrp: m } : r));
                            }}
                            className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={row.qty}
                            onChange={(e) => {
                              const q = Math.max(1, Number(e.target.value));
                              setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: q } : r));
                            }}
                            className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {!row.error ? (
                            <div className="w-28 h-10 mx-auto overflow-hidden flex items-center justify-center">
                              <BarcodeCanvas options={{ type: row.type, value: row.barcode, width: 1, height: 25, fontSize: 10, margin: 2 }} />
                            </div>
                          ) : (
                            <span className="text-[10px] text-rose-500 font-bold">Invalid</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setBulkRows(prev => prev.filter(r => r.id !== row.id))}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
          </div>
        )}

        {/* ═══════════ TAB 3: LABEL DESIGNER & PRINTING ═══════════ */}
        {activeTab === 'labels' && (
          <div className="space-y-6 print:m-0 print:p-0">
            {/* Sheet Format Controls (Hidden on print) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Grid size={18} className="text-blue-600" />
                    Physical Sticker Label Sheet Layout &amp; Print
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Select standard pre-cut sticker sheets (A4 24/65-in-1, A5) or continuous Thermal Rolls.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Print Sticker Sheet Now</span>
                </button>
              </div>

              {/* Preset Selector Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {Object.entries(PRESET_SHEET_CONFIGS).map(([k, cfg]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleSelectPreset(k)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                      sheetPresetKey === k
                        ? "border-blue-500 bg-blue-50/50 text-blue-950 shadow-xs ring-1 ring-blue-500"
                        : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="text-xs font-black truncate">{cfg.name.split('(')[0]}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 font-semibold">
                      {cfg.labelWidthMm}×{cfg.labelHeightMm}mm ({cfg.columns * cfg.rows} per sheet)
                    </span>
                  </button>
                ))}
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2 text-xs font-bold text-slate-700 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBusinessName}
                    onChange={(e) => setShowBusinessName(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show Shop / Business Name</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPriceTag}
                    onChange={(e) => setShowPriceTag(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show Price (₹)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMrpTag}
                    onChange={(e) => setShowMrpTag(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show MRP (₹)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSkuTag}
                    onChange={(e) => setShowSkuTag(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show SKU</span>
                </label>
              </div>
            </div>

            {/* Rendered Physical Sheet (Printable Canvas) */}
            <div className="flex justify-center overflow-x-auto pb-8 print:p-0 print:m-0">
              <div
                id="printable-barcode-sheet"
                style={{
                  width: `${sheetConfig.pageWidthMm}mm`,
                  minHeight: `${sheetConfig.pageHeightMm}mm`,
                  paddingTop: `${sheetConfig.marginTopMm}mm`,
                  paddingBottom: `${sheetConfig.marginBottomMm}mm`,
                  paddingLeft: `${sheetConfig.marginLeftMm}mm`,
                  paddingRight: `${sheetConfig.marginRightMm}mm`,
                  background: '#ffffff',
                  boxSizing: 'border-box'
                }}
                className="shadow-2xl rounded-xl border border-slate-200 print:shadow-none print:border-none print:rounded-none print:m-0"
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${sheetConfig.columns}, ${sheetConfig.labelWidthMm}mm)`,
                    gap: `${sheetConfig.gapVerticalMm}mm ${sheetConfig.gapHorizontalMm}mm`,
                    justifyContent: 'center'
                  }}
                >
                  {printableLabels.map((lbl, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: `${sheetConfig.labelWidthMm}mm`,
                        height: `${sheetConfig.labelHeightMm}mm`,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        padding: '1.5mm',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'center',
                        border: '0.5px dashed #cbd5e1'
                      }}
                      className="print:border-none"
                    >
                      {showBusinessName && (
                        <div style={{ fontSize: '7pt', fontWeight: '800', textTransform: 'uppercase', color: '#475569', lineHeight: 1, letterSpacing: '0.5px' }}>
                          {businessName}
                        </div>
                      )}

                      <div style={{ fontSize: '7.5pt', fontWeight: '800', color: '#0f172a', lineHeight: 1.1, maxHeight: '16px', overflow: 'hidden' }}>
                        {lbl.name}
                      </div>

                      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', transform: 'scale(0.85)', transformOrigin: 'center' }}>
                        <BarcodeCanvas
                          options={{
                            type: lbl.type || 'CODE128',
                            value: lbl.barcode,
                            width: 1.5,
                            height: 35,
                            fontSize: 10,
                            margin: 1,
                            displayValue: true
                          }}
                        />
                      </div>

                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: '7pt', fontWeight: '700', lineHeight: 1 }}>
                        {showSkuTag && lbl.sku && (
                          <span style={{ color: '#64748b' }}>{lbl.sku}</span>
                        )}
                        {showPriceTag && lbl.price > 0 && (
                          <span style={{ color: '#166534', fontWeight: '900' }}>₹{lbl.price}</span>
                        )}
                        {showMrpTag && lbl.mrp > lbl.price && (
                          <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>₹{lbl.mrp}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 4: HISTORY & SAVED TEMPLATES ═══════════ */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <HistoryIcon size={18} className="text-blue-600" />
                  Generated Barcodes History
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  View and re-download previously generated barcode records.
                </p>
              </div>

              {historyList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryList([]);
                    setSecureStorage('invocentric_barcode_history', []);
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  Clear History
                </button>
              )}
            </div>

            {historyList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Barcode size={36} className="text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">No Barcode History Found</p>
                <p className="text-xs text-slate-400">Barcodes you generate or export will appear here for easy re-use.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {historyList.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                        <Barcode size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">
                          {item.productName || item.value || item.action}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.type || 'CODE128'} • {new Date(item.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.value && (
                        <button
                          type="button"
                          onClick={() => {
                            setBarcodeValue(item.value);
                            if (item.type) setBarcodeType(item.type);
                            if (item.productName) setProductName(item.productName);
                            setSearchParams({ tab: 'single' });
                          }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Load in Studio
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Embedded Print CSS for exact physical label dimensions */}
      <style>{`
        @media print {
          @page {
            size: ${sheetConfig.paperSize === 'thermal' ? `${sheetConfig.pageWidthMm}mm ${sheetConfig.pageHeightMm}mm` : (sheetConfig.paperSize === 'A5' ? 'A5 portrait' : 'A4 portrait')};
            margin: 0mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-barcode-sheet, #printable-barcode-sheet * {
            visibility: visible !important;
          }
          #printable-barcode-sheet {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: ${sheetConfig.pageWidthMm}mm !important;
            min-height: ${sheetConfig.pageHeightMm}mm !important;
            margin: 0 !important;
            padding-top: ${sheetConfig.marginTopMm}mm !important;
            padding-bottom: ${sheetConfig.marginBottomMm}mm !important;
            padding-left: ${sheetConfig.marginLeftMm}mm !important;
            padding-right: ${sheetConfig.marginRightMm}mm !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
