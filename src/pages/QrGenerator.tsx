import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { QrCode, ExternalLink, ShieldCheck, Sparkles, ArrowUpRight } from 'lucide-react';
import { openInBrowser } from '../lib/utils';

export default function QrGenerator() {
  const navigate = useNavigate();
  const { isPro, triggerUpgradeModal } = useAuth();

  useEffect(() => {
    if (!isPro) {
      navigate('/');
      triggerUpgradeModal('QR Generator & Digital Branding', [
        'Generate dynamic, beautifully branded UPI & website QR codes.',
        'Auto-embed QR codes directly onto your PDF invoices for quick payments.',
        'Real-time verification of payment status via custom QR layouts.'
      ]);
    }
  }, [isPro, navigate]);

  const handleLaunch = () => {
    openInBrowser('https://ns-fixed-qr.vercel.app/');
  };

  return (
    <div className="space-y-8 pb-12 max-w-3xl mx-auto flex flex-col justify-center min-h-[70vh]">
      <div className="bg-white rounded-[26px] border border-[#E5EBE0] p-8 sm:p-12 shadow-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-[24px] bg-[#D7F4D4] text-[#073E36] flex items-center justify-center shadow-xs">
            <QrCode size={40} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#D7F4D4] text-[#073E36] text-xs font-bold uppercase tracking-wider border border-[#C6E9C1]">
            <Sparkles size={13} /> External Utility Suite
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#10251F]">
            QR Generator
          </h1>
          <p className="text-[#52796F] text-sm max-w-xl mx-auto leading-relaxed">
            Create high-resolution custom QR codes for UPI payments, URLs, Wi-Fi networks, SMS, and virtual business cards. Print them instantly onto your customer receipts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={handleLaunch}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#073E36] hover:bg-[#0d4f45] text-white text-sm font-bold shadow-sm transition-all cursor-pointer group"
          >
            <span>Launch QR Generator Suite</span>
            <ArrowUpRight size={18} className="text-[#D7F4D4] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[#52796F] font-mono text-[11px] uppercase tracking-wider pt-6">
          <ShieldCheck size={15} className="text-[#0F645D]" /> Secure SSL Connection (ns-fixed-qr.vercel.app)
        </div>
      </div>
    </div>
  );
}
