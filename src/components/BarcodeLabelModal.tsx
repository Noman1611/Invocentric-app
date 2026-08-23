import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Barcode, Grid, Tag, Layers } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

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
  }>;
}

export function BarcodeLabelModal({ isOpen, onClose, items }: BarcodeLabelModalProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [sheetType, setSheetType] = useState<'a4_24' | 'a4_65' | 'thermal_single'>('a4_24');
  const [labelCount, setLabelCount] = useState<number>(24);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [businessName, setBusinessName] = useState('InvoCentic Retail');
  const printRef = useRef<HTMLDivElement>(null);

  const activeItem = items.find(i => i.id === selectedItemId) || items[0];
  const barcodeValue = activeItem?.barcode || activeItem?.id?.slice(0, 10) || '0000000000';

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
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
                <p className="text-xs text-slate-500 font-medium">Print barcodes for A4 Sticker Sheets (24/65-in-1) or Thermal Rolls</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 print:p-0 print:overflow-visible print:block">
            {/* Left Controls (Hidden on Print) */}
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
                      {item.name} ({item.barcode ? `Barcode: ${item.barcode}` : 'Auto-code'})
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
                    onClick={() => { setSheetType('a4_24'); setLabelCount(24); }}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      sheetType === 'a4_24' ? "bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-xs" : "bg-white border-slate-200 text-slate-600"
                    )}
                  >
                    <Grid size={16} className="mb-1" />
                    <span className="text-[11px]">A4 (24-in-1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSheetType('a4_65'); setLabelCount(65); }}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      sheetType === 'a4_65' ? "bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-xs" : "bg-white border-slate-200 text-slate-600"
                    )}
                  >
                    <Layers size={16} className="mb-1" />
                    <span className="text-[11px]">A4 (65-in-1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSheetType('thermal_single'); setLabelCount(1); }}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      sheetType === 'thermal_single' ? "bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-xs" : "bg-white border-slate-200 text-slate-600"
                    )}
                  >
                    <Tag size={16} className="mb-1" />
                    <span className="text-[11px]">Thermal Roll</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Number of Labels ({sheetType === 'thermal_single' ? 'Copies' : 'Stickers'})
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={labelCount}
                  onChange={(e) => setLabelCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sticker Details to Show
                </label>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBusinessName}
                      onChange={(e) => setShowBusinessName(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    Shop / Brand Name
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMrp}
                      onChange={(e) => setShowMrp(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    MRP ({formatCurrency(activeItem?.mrp || activeItem?.price || 0)})
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    Sale Price ({formatCurrency(activeItem?.price || 0)})
                  </label>
                </div>
              </div>
            </div>

            {/* Right Print Preview Canvas */}
            <div className="lg:col-span-2 flex flex-col items-center bg-slate-100 p-4 rounded-2xl border border-slate-200 overflow-x-auto print:bg-white print:border-none print:p-0">
              <div
                ref={printRef}
                id="barcode-print-canvas"
                className={cn(
                  "bg-white shadow-md print:shadow-none box-border",
                  sheetType === 'a4_24' && "w-[210mm] min-h-[297mm] p-[8mm] grid grid-cols-3 gap-x-[3mm] gap-y-[3mm] content-start",
                  sheetType === 'a4_65' && "w-[210mm] min-h-[297mm] p-[6mm] grid grid-cols-5 gap-x-[2mm] gap-y-[2mm] content-start",
                  sheetType === 'thermal_single' && "w-[50mm] min-h-[25mm] p-2 flex flex-col items-center justify-center"
                )}
              >
                {Array.from({ length: labelCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "border border-dashed border-slate-300 print:border-none rounded flex flex-col items-center justify-between text-center overflow-hidden bg-white",
                      sheetType === 'a4_24' && "h-[33.9mm] p-1.5",
                      sheetType === 'a4_65' && "h-[21.2mm] p-1 text-[8px]",
                      sheetType === 'thermal_single' && "w-full h-full p-1 text-[9px]"
                    )}
                  >
                    {showBusinessName && (
                      <div className="font-extrabold text-[9px] uppercase tracking-wider truncate w-full text-slate-700 leading-tight">
                        {businessName}
                      </div>
                    )}
                    <div className="font-bold text-[10px] truncate w-full leading-tight text-slate-900">
                      {activeItem?.name || 'Product'}
                    </div>

                    {/* Barcode Visual Bars */}
                    <div className="my-0.5 flex flex-col items-center">
                      <div className="flex items-center justify-center gap-[1.5px] h-6">
                        {barcodeValue.split('').map((char: string, cIdx: number) => (
                          <div
                            key={cIdx}
                            className="bg-black"
                            style={{
                              width: (char.charCodeAt(0) % 3 === 0) ? '2.5px' : '1px',
                              height: '100%'
                            }}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-[8px] tracking-widest text-slate-600 font-bold leading-none mt-0.5">
                        *{barcodeValue}*
                      </span>
                    </div>

                    {/* Price Row */}
                    <div className="flex items-center justify-center gap-1.5 w-full text-[9px] leading-tight font-bold">
                      {showMrp && activeItem?.mrp && (
                        <span className="text-slate-400 line-through text-[8px]">
                          MRP: ₹{activeItem.mrp}
                        </span>
                      )}
                      {showPrice && (
                        <span className="text-slate-900 font-black">
                          Our Price: ₹{activeItem?.price || 0}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
            size: ${sheetType === 'thermal_single' ? '50mm 25mm' : 'A4 portrait'};
            margin: 0mm;
          }
          body * { visibility: hidden !important; }
          #barcode-print-canvas, #barcode-print-canvas * { visibility: visible !important; }
          #barcode-print-canvas {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </AnimatePresence>
  );
}
