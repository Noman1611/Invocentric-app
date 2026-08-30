import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Barcode, 
  ScanLine, 
  X, 
  Plus, 
  Clipboard, 
  AlertCircle, 
  CheckCircle2, 
  Zap, 
  Trash2, 
  ListFilter,
  Check,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { startHtml5ScannerRobust, playScanBeepSound, playErrorBeepSound } from '../utils/cameraUtils';
import { Html5Qrcode } from 'html5-qrcode';

export interface SerialNumberInputProps {
  value?: string[];
  serialNumbers?: string[]; // Alias for value
  onChange?: (serials: string[]) => void;
  onAddSerial?: (serial: string) => void; // Alias callback
  onRemoveSerial?: (serialOrIndex: string | number) => void; // Alias callback
  expectedCount?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
}

export default function SerialNumberInput({
  value,
  serialNumbers,
  onChange,
  onAddSerial,
  onRemoveSerial,
  expectedCount = 0,
  disabled = false,
  className,
  placeholder = "Scan or type serial (e.g. SN-92810X)",
  id = "serial-number-input"
}: SerialNumberInputProps) {
  const serials = value || serialNumbers || [];
  const [inputValue, setInputValue] = useState('');
  const [scanMode, setScanMode] = useState<boolean>(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let active = true;
    if (showCameraScanner) {
      setTimeout(() => {
        const elementId = 'serial-camera-reader';
        const el = document.getElementById(elementId);
        if (!el || !active) return;
        try {
          const html5QrCode = new Html5Qrcode(elementId);
          scannerRef.current = html5QrCode;
          startHtml5ScannerRobust(
            html5QrCode,
            'environment',
            { fps: 30, qrbox: { width: 280, height: 140 }, aspectRatio: 1.777778, disableFlip: true },
            (decodedText) => {
              if (active && decodedText) {
                playScanBeepSound(true);
                const trimmed = decodedText.trim();
                if (trimmed && !serials.includes(trimmed)) {
                  if (onAddSerial) onAddSerial(trimmed);
                  if (onChange) onChange([...serials, trimmed]);
                }
                setShowCameraScanner(false);
              }
            }
          ).catch((err) => {
            console.error("Camera scanner start error:", err);
          });
        } catch (e) {
          console.error("Camera init error:", e);
        }
      }, 300);
    } else {
      if (scannerRef.current) {
        const s = scannerRef.current;
        scannerRef.current = null;
        if (s.isScanning) {
          s.stop().then(() => {
            try { s.clear(); } catch (e) {}
          }).catch(() => {});
        } else {
          try { s.clear(); } catch (e) {}
        }
      }
    }
    return () => {
      active = false;
      if (scannerRef.current) {
        const s = scannerRef.current;
        scannerRef.current = null;
        if (s.isScanning) {
          s.stop().then(() => {
            try { s.clear(); } catch (e) {}
          }).catch(() => {});
        } else {
          try { s.clear(); } catch (e) {}
        }
      }
    };
  }, [showCameraScanner, serials, onChange, onAddSerial]);

  const enforceFocus = useCallback(() => {
    if (scanMode && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [scanMode, disabled]);

  // When Scan Mode is toggled ON, focus input immediately
  useEffect(() => {
    if (scanMode) {
      enforceFocus();
    }
  }, [scanMode, enforceFocus]);

  // Handle duplicate error banner timeout (2.5 - 3 seconds)
  const triggerDuplicateError = (serial: string) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    setDuplicateError(`Already scanned: ${serial}`);
    errorTimeoutRef.current = setTimeout(() => {
      setDuplicateError(null);
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Add single serial chip
  const addSerial = (rawCode: string): boolean => {
    const code = rawCode.trim();
    if (!code) return false;

    // Duplicate check (case-insensitive)
    const isDuplicate = serials.some(s => s.trim().toLowerCase() === code.toLowerCase());
    if (isDuplicate) {
      triggerDuplicateError(code);
      return false;
    }

    if (onAddSerial) {
      onAddSerial(code);
    }
    if (onChange) {
      onChange([...serials, code]);
    }
    setDuplicateError(null);
    return true;
  };

  // Handle Input KeyDown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        const added = addSerial(inputValue);
        if (added || duplicateError) {
          setInputValue('');
        }
      }
    }
  };

  // Remove single chip
  const removeSerial = (indexToRemove: number) => {
    if (disabled) return;
    const itemToRemove = serials[indexToRemove];
    if (onRemoveSerial) {
      onRemoveSerial(itemToRemove !== undefined ? itemToRemove : indexToRemove);
    }
    const next = serials.filter((_, idx) => idx !== indexToRemove);
    if (onChange) {
      onChange(next);
    }
  };

  // Clear all chips
  const clearAll = () => {
    if (disabled || serials.length === 0) return;
    if (window.confirm(`Remove all ${serials.length} scanned serial numbers?`)) {
      if (onChange) {
        onChange([]);
      }
    }
  };

  // Handle bulk paste
  const handleBulkPaste = () => {
    if (!pasteText.trim()) return;

    // Split by commas, semicolons, newlines, tabs, or consecutive spaces
    const rawTokens = pasteText
      .split(/[\r\n,;\t]+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (rawTokens.length === 0) return;

    const existingLower = new Set(serials.map(v => v.trim().toLowerCase()));
    const newUniqueList: string[] = [];
    let duplicateCount = 0;

    for (const token of rawTokens) {
      const lower = token.toLowerCase();
      if (existingLower.has(lower)) {
        duplicateCount++;
      } else {
        existingLower.add(lower);
        newUniqueList.push(token);
      }
    }

    if (newUniqueList.length > 0) {
      newUniqueList.forEach(s => onAddSerial && onAddSerial(s));
      if (onChange) {
        onChange([...serials, ...newUniqueList]);
      }
      setPasteFeedback(`Added ${newUniqueList.length} serials.${duplicateCount > 0 ? ` (${duplicateCount} duplicate(s) skipped)` : ''}`);
      setTimeout(() => {
        setShowPasteModal(false);
        setPasteText('');
        setPasteFeedback(null);
      }, 1200);
    } else {
      setPasteFeedback(`All ${rawTokens.length} serials were already scanned.`);
    }
  };

  // Live counter match logic
  const isCountMatched = expectedCount > 0 && serials.length === expectedCount;
  const isCountOver = expectedCount > 0 && serials.length > expectedCount;

  // Filtered list of chips for display
  const displayedSerials = filterQuery.trim()
    ? serials.filter(s => s.toLowerCase().includes(filterQuery.toLowerCase()))
    : serials;

  return (
    <div id={id} className={cn("space-y-2.5", className)}>
      {/* Top Header Row: Label & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#166534] dark:text-green-400 flex items-center gap-1.5">
            <Barcode size={15} />
            <span>Serial Numbers (S/N)</span>
          </label>

          {/* Live Counter Badge */}
          <div 
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border transition-all duration-200 shadow-xs",
              isCountMatched
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                : isCountOver
                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            )}
            title={`Scanned: ${serials.length} | Expected Stock: ${expectedCount}`}
          >
            {isCountMatched ? (
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : isCountOver ? (
              <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
            ) : null}
            <span>
              {serials.length} / {expectedCount} scanned
            </span>
          </div>
        </div>

        {/* Right Tools: Scan Mode Toggle & Paste Multiple */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Scan Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setScanMode(prev => !prev)}
            disabled={disabled}
            className={cn(
              "min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 select-none active:scale-95 cursor-pointer",
              scanMode
                ? "bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/20 animate-pulse"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60"
            )}
            title="Scan Mode: Keeps input focused for continuous USB / Bluetooth HID scanner entry"
          >
            <Zap size={14} className={cn(scanMode ? "text-amber-300 fill-amber-300" : "text-slate-400")} />
            <span>Scan Mode: {scanMode ? "ON" : "OFF"}</span>
            {scanMode && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
            )}
          </button>

          {/* Camera Scan Button */}
          <button
            type="button"
            onClick={() => setShowCameraScanner(true)}
            disabled={disabled}
            className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
            title="Open camera barcode scanner"
          >
            <ScanLine size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Scan</span>
          </button>

          {/* Paste Multiple Button */}
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            disabled={disabled}
            className="min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Paste multiple serial numbers from spreadsheet / text"
          >
            <Clipboard size={14} className="text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Paste Multiple</span>
          </button>
        </div>
      </div>

      {/* Main Input Container */}
      <div className="relative">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            placeholder={scanMode ? "⚡ Scan Mode Active — Scan barcode gun now..." : placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (scanMode && !disabled) {
                // Re-focus instantly when scan mode is active
                setTimeout(() => enforceFocus(), 20);
              }
            }}
            className={cn(
              "w-full pl-3.5 pr-20 py-2.5 min-h-[44px] text-sm font-mono font-bold rounded-xl border transition-all",
              scanMode
                ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-slate-900 dark:text-white ring-2 ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
            )}
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {inputValue.trim() && (
              <button
                type="button"
                onClick={() => {
                  if (inputValue.trim()) {
                    const added = addSerial(inputValue);
                    if (added || duplicateError) {
                      setInputValue('');
                    }
                    enforceFocus();
                  }
                }}
                className="min-h-[36px] px-3 py-1.5 text-xs font-bold bg-[#166534] hover:bg-[#14532d] text-white rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                Add
              </button>
            )}
            <div className="text-slate-400 p-1">
              <ScanLine size={16} />
            </div>
          </div>
        </div>

        {/* Scan Mode Active Hint */}
        {scanMode && (
          <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-medium px-1">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              USB / Bluetooth HID Scanner focused. Ready for continuous scans.
            </span>
            <button
              type="button"
              onClick={() => setScanMode(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline text-[10px]"
            >
              Turn off
            </button>
          </div>
        )}

        {/* Inline Duplicate Error Alert */}
        <AnimatePresence>
          {duplicateError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold"
            >
              <AlertCircle size={14} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{duplicateError}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chips Area */}
      {serials.length > 0 && (
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
          {/* Chip List Controls */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800/80">
            <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
              Scanned Chips ({serials.length})
            </span>

            <div className="flex items-center gap-2">
              {serials.length > 6 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none w-24 sm:w-32"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterQuery('')}
                      className="absolute right-1 top-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={clearAll}
                disabled={disabled}
                className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:underline flex items-center gap-1 font-medium transition-colors py-1 cursor-pointer"
              >
                <Trash2 size={12} />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Chips Grid / Wrap */}
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 py-1 custom-scrollbar">
            {displayedSerials.map((sn, idx) => {
              // Find actual index in `serials` array
              const actualIndex = serials.findIndex(v => v === sn);
              return (
                <span
                  key={`${sn}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-green-200 dark:border-green-800/80 shadow-2xs group hover:border-green-400 dark:hover:border-green-600 transition-colors break-all"
                >
                  <span className="text-[10px] text-slate-400 select-none">#{actualIndex + 1}</span>
                  <span className="select-all tracking-tight break-all">{sn}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeSerial(actualIndex >= 0 ? actualIndex : idx)}
                      className="min-w-[28px] min-h-[28px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-90"
                      title="Remove serial"
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Paste Modal */}
      <AnimatePresence>
        {showPasteModal && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasteModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: '100%', sm: { scale: 0.95, y: 15 } }}
              animate={{ y: 0, sm: { scale: 1, y: 0 } }}
              exit={{ y: '100%', sm: { scale: 0.95, y: 15 } }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 md:p-6 space-y-4 z-10 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto pb-safe sm:pb-6"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden -mt-1 mb-2" />
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center justify-center text-[#166534] dark:text-green-400">
                    <Clipboard size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Paste Multiple Serial Numbers</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Separate codes with commas, newlines, semicolons, or spaces.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={6}
                  placeholder={`SN-92810X\nSN-92811X\nSN-92812X\nSN-92813X`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
                />
                
                {pasteFeedback && (
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check size={14} />
                    <span>{pasteFeedback}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasteModal(false);
                    setPasteText('');
                    setPasteFeedback(null);
                  }}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkPaste}
                  disabled={!pasteText.trim()}
                  className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-[#166534] hover:bg-[#14532d] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  Add Serials
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Camera Scanner Modal */}
        {showCameraScanner && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
            <motion.div 
              initial={{ y: '100%', sm: { scale: 0.95 } }}
              animate={{ y: 0, sm: { scale: 1 } }}
              exit={{ y: '100%', sm: { scale: 0.95 } }}
              className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden p-5 sm:p-6 space-y-4 max-h-[90vh] pb-safe sm:pb-6"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden -mt-1 mb-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <ScanLine size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Scan Barcode / Serial</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Point camera at barcode or QR code</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(false)}
                  className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative w-full aspect-[16/10] bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <div id="serial-camera-reader" className="w-full h-full"></div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(false)}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                >
                  Close Camera
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
