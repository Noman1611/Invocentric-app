import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Check, FileText, Barcode, AlertCircle, Copy } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BulkSerialImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  existingSerials?: string[];
  onImport: (newSerials: string[]) => void;
}

export function BulkSerialImportModal({
  isOpen,
  onClose,
  itemName,
  existingSerials = [],
  onImport
}: BulkSerialImportModalProps) {
  const [textInput, setTextInput] = useState('');
  const [parsedSerials, setParsedSerials] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleParseText = (raw: string) => {
    setTextInput(raw);
    setErrorMsg('');
    if (!raw.trim()) {
      setParsedSerials([]);
      return;
    }
    // Split by newlines, commas, spaces, tabs, or semicolons
    const tokens = raw
      .split(/[\r\n,;\t\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    // Remove duplicates inside the imported batch
    const unique = Array.from(new Set(tokens));
    setParsedSerials(unique);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const serialsFound: string[] = [];
        json.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach(cell => {
              if (cell !== undefined && cell !== null) {
                const clean = String(cell).trim().toUpperCase();
                // Filter out obvious header strings
                if (clean && !['SERIAL', 'SERIALS', 'SERIAL NUMBER', 'IMEI', 'SR NO', 'SRNO'].includes(clean)) {
                  serialsFound.push(clean);
                }
              }
            });
          }
        });

        const unique = Array.from(new Set(serialsFound));
        if (unique.length === 0) {
          setErrorMsg('No valid serial numbers detected in this file.');
        } else {
          setParsedSerials(unique);
          setTextInput(unique.join('\n'));
        }
      } catch (err: any) {
        setErrorMsg('Error reading file: ' + (err?.message || 'Invalid format'));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (parsedSerials.length === 0) {
      setErrorMsg('Please enter or upload at least 1 serial number.');
      return;
    }

    // Merge with existing serials and eliminate duplicates
    const existingSet = new Set(existingSerials.map(s => s.trim().toUpperCase()));
    const finalSerials = [...existingSerials];

    parsedSerials.forEach(s => {
      if (!existingSet.has(s)) {
        finalSerials.push(s);
        existingSet.add(s);
      }
    });

    onImport(finalSerials);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Barcode size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">Bulk Serial / IMEI Number Import</h3>
                <p className="text-xs text-slate-500 font-medium">Adding serials for: <strong className="text-slate-800">{itemName || 'Product'}</strong></p>
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
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* File Drag and Drop / Upload Button */}
            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 text-center transition-colors relative cursor-pointer group bg-slate-50/50">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload size={22} className="text-slate-400 mx-auto mb-1.5 group-hover:text-emerald-600 transition-colors" />
              <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                {fileName ? `Loaded: ${fileName}` : 'Click or Drag & Drop Excel / CSV / Text File'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .csv, and newline text files</p>
            </div>

            {/* Manual Paste Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Or Paste Serial Numbers (Comma or Newline separated)
                </label>
                <span className="text-xs font-black text-emerald-700">
                  {parsedSerials.length} Detected
                </span>
              </div>
              <textarea
                rows={6}
                value={textInput}
                onChange={(e) => handleParseText(e.target.value)}
                placeholder="SN1001&#10;SN1002&#10;SN1003&#10;890123456789..."
                className="w-full p-3 font-mono text-xs font-bold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 leading-relaxed text-slate-800"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Preview Chip Cloud */}
            {parsedSerials.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Preview ({parsedSerials.length} Items):
                </label>
                <div className="max-h-28 overflow-y-auto p-2 bg-slate-100/70 border border-slate-200 rounded-xl flex flex-wrap gap-1.5">
                  {parsedSerials.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 text-[10px] font-mono font-bold rounded-md shadow-2xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={parsedSerials.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Check size={15} />
              <span>Import {parsedSerials.length} Serials</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
