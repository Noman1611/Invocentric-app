import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Printer, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Sparkles, 
  Maximize2, 
  X, 
  Layers, 
  Building2, 
  Pill, 
  ShoppingBag, 
  Zap, 
  ArrowRight,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export interface TemplateInfo {
  id: string;
  name: string;
  shortName: string;
  category: string;
  badge: string;
  badgeColor: string;
  format: 'A4' | 'POS 80mm' | 'POS 58mm';
  icon: any;
  color: string;
  image: string;
  pdfUrl: string;
  idealFor: string;
  description: string;
  features: string[];
}

export const TEMPLATES_DATA: TemplateInfo[] = [
  {
    id: 'template_01',
    name: 'Template 01 — Modern Clean A4',
    shortName: 'Modern Clean',
    category: 'General GST & Retail',
    badge: 'Most Popular',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    format: 'A4',
    icon: FileText,
    color: '#0d5c4b',
    image: '/templates/template_01.png',
    pdfUrl: '/demo-invoices/Template_01_Modern_Clean_A4.pdf',
    idealFor: 'Retail Stores, Traders, Agencies, Hardware & Services',
    description: 'Clean emerald-accented A4 layout with complete GST breakup, HSN summary, and instant UPI QR code.',
    features: [
      'Dual CGST/SGST & Inter-State IGST compliance',
      'Accurate HSN/SAC summary table with tax rates',
      'Embedded Bank Account details with Dynamic UPI QR',
      'Auto amount in words and authorized signatory block',
      'Perfect for laser, inkjet, or desktop PDF sharing'
    ]
  },
  {
    id: 'template_02',
    name: 'Template 02 — Corporate Bordered A4',
    shortName: 'Corporate Bordered',
    category: 'B2B & Corporates',
    badge: 'Executive',
    badgeColor: 'bg-green-100 text-green-800 border-green-200',
    format: 'A4',
    icon: Building2,
    color: '#166534',
    image: '/templates/template_02.png',
    pdfUrl: '/demo-invoices/Template_02_Corporate_Bordered_A4.pdf',
    idealFor: 'Corporate Vendors, Consultants, Manufacturing & IT Services',
    description: 'Forest-line header with structured 3-column metadata (Billed To, Shipped To, and PO tracking).',
    features: [
      'Clear 3-column party & shipment routing grid',
      'Prominent Purchase Order (P.O.) & E-Way Bill numbers',
      'Clean border separators for corporate bookkeeping',
      'Terms & Conditions and late-payment interest clauses',
      'Compact bank details and scan-to-pay QR badge'
    ]
  },
  {
    id: 'template_03',
    name: 'Template 03 — Wholesale & Pharma Detailed A4',
    shortName: 'Wholesale & Pharma',
    category: 'Pharma, Medical & Electronics',
    badge: 'Batch & Serial Ready',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    format: 'A4',
    icon: Pill,
    color: '#1e5eb8',
    image: '/templates/template_03.png',
    pdfUrl: '/demo-invoices/Template_03_Wholesale_Pharma_B2B_A4.pdf',
    idealFor: 'Pharmacies, Medical Distributors, Mobile & Electronics B2B',
    description: 'Engineered specifically for pharma and electronic distributors with dedicated Batch, Expiry, and Serial number columns.',
    features: [
      'Dedicated Serial / IMEI / Batch number column',
      'Supplier & Customer Drug License (DL-20B/21B) numbers',
      'Manufacturing & Expiry dates printed per product',
      'Clear wholesale margins, MRP, and discount percentages',
      'Instant B2B audit & tax compliance verification'
    ]
  },
  {
    id: 'template_04',
    name: 'Template 04 — POS Thermal Receipt (3-Inch / 80mm)',
    shortName: 'POS Thermal 3"',
    category: 'Supermarkets & High-Speed Retail',
    badge: '80mm Roll',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    format: 'POS 80mm',
    icon: Printer,
    color: '#d97706',
    image: '/templates/template_04.png',
    pdfUrl: '/demo-invoices/Template_04_POS_Thermal_3Inch_80mm.pdf',
    idealFor: 'Supermarkets, Grocery Stores, Garments, Cafes & Restaurants',
    description: 'Designed for standard 80mm thermal receipt printers (Epson, TVS, NGX) with high-speed monospace printing.',
    features: [
      'Standard 80mm / 3-inch roll receipt format',
      'Crystal-clear monospace typography for thermal heads',
      'Compact UPI QR Code for contactless counter checkout',
      'Tax & subtotal breakup with custom thank-you footer',
      'Zero ink cost — compatible with all USB/Ethernet POS printers'
    ]
  },
  {
    id: 'template_05',
    name: 'Template 05 — POS Thermal Receipt (2-Inch / 58mm)',
    shortName: 'POS Thermal 2"',
    category: 'Mobile Handheld & Bluetooth',
    badge: '58mm Bluetooth',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    format: 'POS 58mm',
    icon: ShoppingBag,
    color: '#4f46e5',
    image: '/templates/template_05.png',
    pdfUrl: '/demo-invoices/Template_05_POS_Thermal_2Inch_58mm.pdf',
    idealFor: 'Field Sales, Mobile Vans, Delivery Agents & Small Kiosks',
    description: 'Ultra-compact receipt designed for portable Bluetooth and battery-powered 58mm handheld printers.',
    features: [
      '58mm / 2-inch ultra-narrow roll optimization',
      'High contrast formatting to fit essentials in 32 columns',
      'Fast Bluetooth printing from Android phone / tablet',
      'Quick UPI scan code & store brand headline',
      'Minimal paper wastage for economical daily operations'
    ]
  },
  {
    id: 'template_06',
    name: 'Template 06 — Nexus Enterprise Pro A4',
    shortName: 'Nexus Enterprise Pro',
    category: 'Modern Tech & High-End Brands',
    badge: 'Enterprise Pro',
    badgeColor: 'bg-slate-900 text-white border-slate-700',
    format: 'A4',
    icon: Layers,
    color: '#1a3673',
    image: '/templates/template_06.png',
    pdfUrl: '/demo-invoices/Template_06_Nexus_Enterprise_Pro_A4.pdf',
    idealFor: 'Tech Companies, Hardware Brands, D2C Sellers & Exporters',
    description: 'Sophisticated deep-navy layout with 10-column structured grid, SKU tracking, and executive styling.',
    features: [
      'Modern 10-column layout with Product SKU / Barcode',
      'Unit of measurement (Pcs, Box, Kg) & line-item tax breakdown',
      'Right-aligned financial summary with prominent Grand Total',
      'Structured Terms & Declarations list with authorized stamp area',
      'Contemporary typography engineered for high-value billing'
    ]
  }
];

export function InvoiceTemplatesShowcase() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTemplateId, setActiveTemplateId] = useState<string>('template_01');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const activeTemplate = TEMPLATES_DATA.find(t => t.id === activeTemplateId) || TEMPLATES_DATA[0];

  const handleDownloadPdf = (pdfUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section id="templates" className="py-24 sm:py-32 bg-gradient-to-b from-white via-slate-50/50 to-white border-y border-slate-200/80 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-tr from-emerald-100/30 via-teal-100/20 to-sky-100/30 rounded-full blur-[150px] pointer-events-none -z-0" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold mb-4 shadow-xs">
            <Sparkles size={14} className="text-emerald-600" />
            <span>6 Ready-to-Use GST Designs</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Stunning Invoice Templates. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 bg-clip-text text-transparent">
              Tailored For Your Business.
            </span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed">
            Whether you run a pharma wholesale agency, a busy retail counter with thermal roll printers, or an enterprise B2B company — InvoCentric provides professionally designed, 100% GST-compliant templates ready to print or share instantly.
          </p>
        </div>

        {/* Interactive Template Selector Tabs */}
        <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 overflow-x-auto pb-4 mb-10 custom-scrollbar scroll-smooth">
          {TEMPLATES_DATA.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === activeTemplateId;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTemplateId(t.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer border ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/15 scale-[1.02]'
                    : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-100/80 hover:border-slate-300'
                }`}
              >
                <div 
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Icon size={14} />
                </div>
                <span>{t.shortName}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isActive ? 'bg-emerald-400 text-slate-950' : 'bg-slate-100 text-slate-600'
                }`}>
                  {t.format}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Template Showcase Card (2-Column Studio Layout) */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-8 lg:p-10 shadow-xl shadow-slate-900/5 backdrop-blur-xl mb-14">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTemplate.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
            >
              
              {/* Left Column: Template Information & Actions (5 Columns) */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                <div>
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${activeTemplate.badgeColor}`}>
                      {activeTemplate.badge}
                    </span>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {activeTemplate.category}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
                    {activeTemplate.name}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    {activeTemplate.description}
                  </p>

                  {/* Best For Tag */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-6">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">
                      Ideal For:
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {activeTemplate.idealFor}
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                      Key Capabilities:
                    </span>
                    {activeTemplate.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-tight font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Call To Action Buttons */}
                <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleDownloadPdf(activeTemplate.pdfUrl, `${activeTemplate.id}_sample.pdf`)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Download Demo PDF</span>
                  </button>

                  <button
                    onClick={() => setFullscreenImage(activeTemplate.image)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <Maximize2 size={15} />
                    <span>Enlarge Preview</span>
                  </button>

                  <button
                    onClick={() => navigate(user ? '/invoices/create' : '/login')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-slate-600 hover:text-slate-950 text-xs sm:text-sm font-bold transition-colors cursor-pointer ml-auto"
                  >
                    <span>Use Template</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Right Column: High-Fidelity Interactive Preview Frame (7 Columns) */}
              <div className="lg:col-span-7 flex justify-center items-center">
                <div className="relative group max-w-full">
                  {/* Subtle Paper Drop Shadow */}
                  <div className="absolute inset-0 bg-slate-900/10 blur-2xl rounded-3xl transform translate-y-4 -z-10" />

                  {/* Document Container */}
                  <div 
                    onClick={() => setFullscreenImage(activeTemplate.image)}
                    className={`relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden cursor-zoom-in transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                      activeTemplate.format.startsWith('POS')
                        ? 'max-w-[340px] sm:max-w-[380px] p-2 sm:p-3'
                        : 'w-full max-w-[580px] p-2 sm:p-3'
                    }`}
                  >
                    {/* Top Browser / Document Tool Bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="ml-2 font-mono text-[10px] text-slate-600 font-bold">{activeTemplate.shortName}.pdf</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
                        {activeTemplate.format}
                      </span>
                    </div>

                    {/* Invoice Image Preview */}
                    <div className="rounded-lg overflow-hidden border border-slate-100 bg-white">
                      <img
                        src={activeTemplate.image}
                        alt={`${activeTemplate.name} Preview`}
                        className="w-full h-auto object-contain block transition-transform duration-500 group-hover:scale-[1.01]"
                        loading="lazy"
                      />
                    </div>

                    {/* Hover Overlay Hint */}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl flex items-center justify-center gap-2 text-white font-bold text-xs pointer-events-none">
                      <Maximize2 size={18} />
                      <span>Click to View Full Resolution</span>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* 6-Card Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TEMPLATES_DATA.map((tpl) => {
            const Icon = tpl.icon;
            const isCurrent = tpl.id === activeTemplateId;
            return (
              <div
                key={tpl.id}
                onClick={() => setActiveTemplateId(tpl.id)}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-white border-slate-900 shadow-md ring-2 ring-slate-900/5'
                    : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                        <Icon size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-900">{tpl.shortName}</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {tpl.format}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                    {tpl.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-bold">
                  <span className="text-emerald-700">{tpl.badge}</span>
                  <span className="text-slate-400 group-hover:text-slate-900 flex items-center gap-1">
                    Preview <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreenImage(null)}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-4 sm:p-8 flex items-center justify-center cursor-zoom-out"
          >
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="relative max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl p-2 sm:p-4 shadow-2xl border border-white/20 custom-scrollbar"
            >
              <button
                onClick={() => setFullscreenImage(null)}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
              >
                <X size={18} />
              </button>

              <img
                src={fullscreenImage}
                alt="Enlarged Invoice Preview"
                className="w-full h-auto max-h-[85vh] object-contain mx-auto block rounded-lg"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
