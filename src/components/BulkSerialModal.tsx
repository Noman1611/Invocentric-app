import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileSpreadsheet, Check, AlertCircle, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

interface BulkSerialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (serials: string[]) => void;
}

export function BulkSerialModal({ isOpen, onClose, onImport }: BulkSerialModalProps) {
  const [inputText, setInputText] = useState('');
  const [prefix, setPrefix] = useState('');
  const [startNum, setStartNum] = useState('');
  const [count, setCount] = useState('');

  if (!isOpen) return null;

  const handleTextImport = () => {
    const rawLines: string[] = inputText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const uniqueSerials: string[] = Array.from(new Set(rawLines));
    if (uniqueSerials.length > 0) {
      onImport(uniqueSerials);
      onClose();
    }
  };

  const handleGenerateSequence = () => {
    const sNum = parseInt(startNum, 10);
    const cnt = parseInt(count, 10);
    if (!isNaN(sNum) && !isNaN(cnt) && cnt > 0) {
      const generated: string[] = [];
      for (let i = 0; i < cnt; i++) {
        generated.push(`${prefix}${sNum + i}`);
      }
      onImport(generated);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">Bulk Import Serial Numbers</h2>
                <p className="text-xs text-slate-500 font-medium">Paste from Excel, CSV, or auto-generate series</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Option A: Paste from Excel / Text */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Paste Serial Numbers (One per line or comma-separated)
              </label>
              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="SN100201&#10;SN100202&#10;SN100203"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-600 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleTextImport}
                disabled={!inputText.trim()}
                className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Import Pasted Serials
              </button>
            </div>

            {/* Option B: Generate Sequence */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Or Auto-Generate Serial Number Range
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Prefix (e.g. SN-)"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="number"
                  placeholder="Start (e.g. 1001)"
                  value={startNum}
                  onChange={(e) => setStartNum(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="number"
                  placeholder="Count (e.g. 10)"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateSequence}
                disabled={!startNum || !count}
                className="mt-2 w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Generate &amp; Add Series
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
