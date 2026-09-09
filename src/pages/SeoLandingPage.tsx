import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { SEOHead } from '../components/SEOHead';
import { Logo } from '../components/Logo';
import { SEO_LANDING_PAGES, SeoLandingPageData } from '../data/seoPagesData';
import { 
  FileText, 
  Smartphone, 
  RefreshCw, 
  Calculator, 
  Check, 
  QrCode, 
  Globe, 
  Tag, 
  Package, 
  Printer, 
  Store, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  Barcode, 
  Receipt, 
  AlertCircle, 
  ChevronRight, 
  HelpCircle, 
  Sparkles, 
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';

// Icon mapping helper
const ICON_MAP: Record<string, any> = {
  FileText,
  Smartphone,
  RefreshCw,
  Calculator,
  Check,
  QrCode,
  Globe,
  Tag,
  Package,
  Printer,
  Store,
  Users,
  TrendingUp,
  ShieldCheck,
  Barcode,
  Receipt,
  AlertCircle,
  Sparkles
};

export default function SeoLandingPage({ pageKey }: { pageKey?: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const slug = pageKey || params.slug || 'invoice-software';
  const pageData: SeoLandingPageData | undefined = SEO_LANDING_PAGES[slug];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  if (!pageData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Logo size={48} />
        <h1 className="text-2xl font-black text-slate-900 mt-4">Page Not Found</h1>
        <p className="text-sm text-slate-500 mt-2 mb-6">The requested SEO guide could not be located.</p>
        <Link to="/" className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs">
          Back to InvoCentric Home
        </Link>
      </div>
    );
  }

  // Generate Breadcrumbs Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': pageData.breadcrumbs.map((b, idx) => ({
      '@type': 'ListItem',
      'position': idx + 1,
      'name': b.name,
      'item': b.url
    }))
  };

  // Generate FAQ Schema
  const faqSchema = pageData.faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': pageData.faqs.map(f => ({
      '@type': 'Question',
      'name': f.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': f.answer
      }
    }))
  } : null;

  // Canonical Software Application Schema with single aggregateRating
  const appSchema = {
    '@type': 'SoftwareApplication',
    '@id': 'https://invocentric.in/#software',
    'name': 'InvoCentric',
    'url': 'https://invocentric.in/',
    'applicationCategory': 'BusinessApplication, AccountingApplication',
    'operatingSystem': 'All (Web, Android, iOS, Windows, Mac)',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'INR'
    },
    'description': pageData.metaDescription,
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': '4.9',
      'reviewCount': '1280'
    }
  };

  const combinedSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbSchema,
      appSchema,
      ...(faqSchema ? [faqSchema] : [])
    ]
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-slate-900 font-sans selection:bg-emerald-500 selection:text-white flex flex-col">
      <SEOHead
        title={pageData.metaTitle}
        description={pageData.metaDescription}
        keywords={[pageData.focusKeyword, ...pageData.secondaryKeywords]}
        canonicalUrl={`https://invocentric.in/${pageData.slug}`}
        structuredData={combinedSchema}
      />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo size={32} showBg={true} />
          <span className="font-brand text-base tracking-tight text-slate-900">
            <span className="font-extrabold">Invo</span><span className="font-bold text-emerald-700">Centric</span>
          </span>
        </Link>

        {/* Desktop Quick Nav */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-600">
          <Link to="/#features" className="hover:text-emerald-700 transition-colors">Features</Link>
          <Link to="/pricing" className="hover:text-emerald-700 transition-colors">Pricing</Link>
          <Link to="/gst-calculator" className="hover:text-emerald-700 transition-colors">GST Tools</Link>
          <Link to="/blog" className="hover:text-emerald-700 transition-colors">Blogs</Link>
          <Link to="/#faq" className="hover:text-emerald-700 transition-colors">FAQ</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Log In
          </Link>
          <Link
            to="/login"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
          >
            <span>Create Free Account</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Breadcrumb Navigation */}
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-slate-400">
            {pageData.breadcrumbs.map((b, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={12} className="text-slate-300" />}
                {idx === pageData.breadcrumbs.length - 1 ? (
                  <span className="text-slate-800">{b.name}</span>
                ) : (
                  <Link to={b.url.replace('https://invocentric.in', '') || '/'} className="hover:text-emerald-600 transition-colors">
                    {b.name}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase tracking-wider">
            <Sparkles size={13} className="text-emerald-600 animate-pulse" />
            <span>{pageData.badge}</span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.15]">
            {pageData.h1}
          </h1>

          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            {pageData.subtitle}
          </p>

          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {pageData.heroHighlight}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/invoices/create"
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-102"
            >
              <span>{pageData.ctaText}</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/pos"
              className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span>Try Live POS Demo</span>
            </Link>
          </div>
        </section>

        {/* Key Feature Cards Grid */}
        <section className="max-w-6xl mx-auto px-4 md:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pageData.features.map((feat, idx) => {
              const Icon = ICON_MAP[feat.iconName] || FileText;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                    <Icon size={22} />
                  </div>
                  <h2 className="text-base font-black text-slate-900 leading-snug">{feat.title}</h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* In-Depth Content & Editorial Sections */}
        <section className="max-w-4xl mx-auto px-4 md:px-8 py-10 space-y-12">
          {pageData.detailedSections.map((sec, sIdx) => (
            <div key={sIdx} className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200/80 shadow-xs space-y-6">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {sec.heading}
              </h2>
              <div className="space-y-4 text-sm text-slate-600 font-medium leading-relaxed">
                {sec.content.map((p, pIdx) => (
                  <p key={pIdx}>{p}</p>
                ))}
              </div>

              {sec.bulletPoints && sec.bulletPoints.length > 0 && (
                <ul className="space-y-2.5 pt-2">
                  {sec.bulletPoints.map((bp, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-3 text-xs md:text-sm font-semibold text-slate-800">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        {/* FAQs Accordion */}
        {pageData.faqs.length > 0 && (
          <section className="max-w-4xl mx-auto px-4 md:px-8 py-10 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">
                Frequently Asked Questions
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Clear answers about InvoCentric billing and tax compliance
              </p>
            </div>

            <div className="space-y-3">
              {pageData.faqs.map((faq, fIdx) => (
                <div
                  key={fIdx}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === fIdx ? null : fIdx)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-black text-sm text-slate-900 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={18}
                      className={cn("text-slate-400 transition-transform duration-200 shrink-0", openFaq === fIdx && "rotate-180 text-emerald-600")}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === fIdx && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-6 pb-5 text-xs text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-3"
                      >
                        {faq.answer}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related InvoCentric Feature Guides */}
        {pageData.relatedPages.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-6 border-t border-slate-200/60 mt-12">
            <h3 className="text-lg font-black text-slate-900">
              Explore Related Billing Solutions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {pageData.relatedPages.map((rel, rIdx) => (
                <Link
                  key={rIdx}
                  to={`/${rel.slug}`}
                  className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {rel.title}
                    </h4>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600 transition-transform group-hover:translate-x-1" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">{rel.desc}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Standardized Bottom Call-to-Action Banner */}
        <section className="max-w-4xl mx-auto px-4 md:px-8 py-12 text-center">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-8 md:p-12 shadow-xl space-y-4">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Ready to simplify your billing?
            </h2>
            <p className="text-sm md:text-base text-emerald-100 max-w-xl mx-auto font-medium">
              Create your free InvoCentric account and start with the tools your business needs.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-emerald-50 text-emerald-800 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all"
              >
                <span>Start Free</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 text-xs mt-16 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Logo size={28} />
              <span className="font-brand text-base font-black text-white">InvoCentric</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Free GST Billing App &amp; Invoicing platform engineered for Indian shopkeepers, retailers, traders, and freelancers.
            </p>
          </div>

          <div>
            <h4 className="font-black text-white uppercase tracking-wider mb-3 text-[11px]">Solutions</h4>
            <ul className="space-y-2 text-[11px]">
              <li><Link to="/invoice-software" className="hover:text-white transition-colors">Invoice Software</Link></li>
              <li><Link to="/free-invoice-maker" className="hover:text-white transition-colors">Free Invoice Maker</Link></li>
              <li><Link to="/gst-billing-software" className="hover:text-white transition-colors">GST Billing Software</Link></li>
              <li><Link to="/gst-invoice-maker" className="hover:text-white transition-colors">GST Invoice Maker</Link></li>
              <li><Link to="/pos-billing-software" className="hover:text-white transition-colors">POS Billing Software</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-black text-white uppercase tracking-wider mb-3 text-[11px]">Tools &amp; Modules</h4>
            <ul className="space-y-2 text-[11px]">
              <li><Link to="/barcode-billing" className="hover:text-white transition-colors">Barcode Billing</Link></li>
              <li><Link to="/inventory-management" className="hover:text-white transition-colors">Inventory Control</Link></li>
              <li><Link to="/ledger-software" className="hover:text-white transition-colors">Digital Khata Book</Link></li>
              <li><Link to="/quotation-maker" className="hover:text-white transition-colors">Quotation Maker</Link></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">GST Knowledge Base</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-black text-white uppercase tracking-wider mb-3 text-[11px]">Compliance &amp; Legal</h4>
            <ul className="space-y-2 text-[11px]">
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service &amp; Privacy</Link></li>
              <li><span className="text-slate-500">Supports common CGST, SGST, and IGST invoice fields</span></li>
              <li><span className="text-slate-500">Local Offline Data Encryption</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 py-6 text-center text-slate-500 text-[11px]">
          © {new Date().getFullYear()} InvoCentric. Made with ❤️ for Indian Businesses. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
