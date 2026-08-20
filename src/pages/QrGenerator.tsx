import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { QrCode, ExternalLink, ShieldCheck, Sparkles, ArrowUpRight } from 'lucide-react';

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
    window.open('https://ns-fixed-qr.vercel.app/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto flex flex-col justify-center min-h-[70vh]">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-green-500/10 text-green-600 flex items-center justify-center shadow-inner animate-pulse">
            <QrCode size={40} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={12} /> External Utility Suite
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
            QR Generator
          </h1>
          <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">
            Create high-resolution custom QR codes for UPI payments, URLs, Wi-Fi networks, SMS, and virtual business cards. Print them instantly onto your customer receipts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={handleLaunch}
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 text-base font-bold shadow-xl shadow-green-600/10 hover:shadow-green-600/25 transition-all group"
          >
            <span>Launch QR Generator Suite</span>
            <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-500 font-mono text-[10px] uppercase tracking-widest pt-8">
          <ShieldCheck size={14} className="text-green-500" /> Secure SSL Connection (ns-fixed-qr.vercel.app)
        </div>
      </div>
    </div>
  );
}
