import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Barcode, Grid, Tag, Layers, ExternalLink } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { BarcodeCanvas } from './BarcodeCanvas';
import { PRESET_SHEET_CONFIGS, LabelSheetConfig, BarcodeType } from '../services/barcodeService';
import { useNavigate } from 'react-router-dom';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{
    id: string;
    name: string;
    barcode?: string;
    price: number;
    mrp?: number;
    size?: string;
    hsn?: string;
  }>;
}

export function BarcodeLabelModal({ isOpen, onClose, items }: BarcodeLabelModalProps) {
  const navigate = useNavigate();
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [presetKey, setPresetKey] = useState<string>('a4_24');
  const [sheetConfig, setSheetConfig] = useState<LabelSheetConfig>(PRESET_SHEET_CONFIGS['a4_24']);
  const [copies, setCopies] = useState<number>(24);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [businessName, setBusinessName] = useState('InvoCentic Retail');
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');

  const activeItem = items.find(i => i.id === selectedItemId) || items[0];
  const barcodeValue = activeItem?.barcode || (activeItem?.id ? `INV${activeItem.id.slice(0, 8).toUpperCase()}` : 'INV1002026');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleOpenStudio = () => {
    onClose();
    navigate(`/barcode-generator?tab=single&item=${activeItem?.id || ''}`);
  };

  const handleSelectPreset = (key: string) => {
    setPresetKey(key);
    const cfg = PRESET_SHEET_CONFIGS[key];
    if (cfg) {
      setSheetConfig(cfg);
      setCopies(cfg.columns * cfg.rows);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 print:p-0 print:m-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs print:hidden"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-5xl bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none print:w-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <Barcode size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">Barcode Label Sticker Printing</h2>
                <p className="text-xs text-slate-500 font-medium">Print crisp barcodes for A4 Sticker Sheets (24/65-in-1) or Thermal Rolls</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenStudio}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Barcode Studio</span>
                <ExternalLink size={13} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 print:p-0 print:overflow-visible print:block">
            {/* Left Controls */}
            <div className="space-y-4 print:hidden">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Product / Item
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.barcode ? `Barcode: ${item.barcode}` : 'Auto Code'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Label Sheet Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('a4_24')}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      presetKey === 'a4_24' ? "bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-xs" : "bg-white border-slate-200 text-slate-600"
                    )}
                  >
                    <Grid size={16} className="mb-1" />
                    <span className="text-[11px]">A4 (24-in-1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('a4_65')}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      presetKey === 'a4_65' ? "bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-xs" : "bg-white border-slate-200 text-slate-600"
                    )}
                  >
                    <Layers size={16} className="mb-1" />
                    <span className="text-[11px]">A4 (65-in-1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('thermal_50x25')}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      presetKey === 'thermal_50x25' ? "bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-xs" : "bg-white border-slate-200 text-slate-600"
                    )}
                  >
                    <Tag size={16} className="mb-1" />
                    <span className="text-[11px]">Thermal Roll</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Number of Labels ({sheetConfig.paperSize === 'thermal' ? 'Copies' : 'Stickers'})
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Store / Brand Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBusinessName}
                    onChange={(e) => setShowBusinessName(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show Store Name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show Sale Price (₹{activeItem?.price || 0})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMrp}
                    onChange={(e) => setShowMrp(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show MRP (₹{activeItem?.mrp || activeItem?.price || 0})</span>
                </label>
              </div>
            </div>

            {/* Right Print Preview Canvas */}
            <div className="lg:col-span-2 flex flex-col items-center bg-slate-100 p-4 rounded-2xl border border-slate-200 overflow-x-auto print:bg-white print:border-none print:p-0">
              <div
                id="barcode-print-canvas"
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
                className="shadow-md print:shadow-none box-border"
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${sheetConfig.columns}, ${sheetConfig.labelWidthMm}mm)`,
                    gap: `${sheetConfig.gapVerticalMm}mm ${sheetConfig.gapHorizontalMm}mm`,
                    justifyContent: 'center'
                  }}
                >
                  {Array.from({ length: copies }).map((_, idx) => (
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
                        {activeItem?.name || 'Product'}
                      </div>

                      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', transform: 'scale(0.85)', transformOrigin: 'center' }}>
                        <BarcodeCanvas
                          options={{
                            type: barcodeType,
                            value: barcodeValue,
                            width: 1.5,
                            height: 35,
                            fontSize: 10,
                            margin: 1,
                            displayValue: true
                          }}
                        />
                      </div>

                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: '7pt', fontWeight: '700', lineHeight: 1 }}>
                        {showPrice && (
                          <span style={{ color: '#166534', fontWeight: '900' }}>₹{activeItem?.price || 0}</span>
                        )}
                        {showMrp && activeItem?.mrp && activeItem.mrp > (activeItem?.price || 0) && (
                          <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>MRP: ₹{activeItem.mrp}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 print:hidden">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Sticker Sheet</span>
            </button>
          </div>
        </motion.div>
      </div>

      <style>{`
        @media print {
          @page {
            size: ${sheetConfig.paperSize === 'thermal' ? `${sheetConfig.pageWidthMm}mm ${sheetConfig.pageHeightMm}mm` : 'A4 portrait'};
            margin: 0mm;
          }
          body * { visibility: hidden !important; }
          #barcode-print-canvas, #barcode-print-canvas * { visibility: visible !important; }
          #barcode-print-canvas {
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
    </AnimatePresence>
  );
}
