import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { SEOHead } from '../components/SEOHead';
import { Logo } from '../components/Logo';
import { 
  Calculator, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Copy, 
  HelpCircle, 
  FileText, 
  IndianRupee, 
  PieChart, 
  Percent, 
  CheckCircle2, 
  Download,
  Share2,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function GstCalculatorPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(10000);
  const [gstRate, setGstRate] = useState<number>(18);
  const [isInclusive, setIsInclusive] = useState<boolean>(false);
  const [taxType, setTaxType] = useState<'intra' | 'inter'>('intra'); // intra = CGST+SGST, inter = IGST
  const [copied, setCopied] = useState(false);

  // Instant Calculation
  const result = useMemo(() => {
    const rawAmt = Number(amount) || 0;
    const rate = Number(gstRate) || 0;

    if (isInclusive) {
      // Amount is Inclusive of GST: Base = Amount / (1 + Rate/100)
      const base = rawAmt / (1 + rate / 100);
      const totalTax = rawAmt - base;
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;
      const igst = totalTax;
      return {
        baseAmount: Number(base.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        cgst: Number(cgst.toFixed(2)),
        sgst: Number(sgst.toFixed(2)),
        igst: Number(igst.toFixed(2)),
        finalAmount: Number(rawAmt.toFixed(2))
      };
    } else {
      // Amount is Exclusive of GST: Tax = Amount * (Rate/100)
      const totalTax = rawAmt * (rate / 100);
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;
      const igst = totalTax;
      const finalAmt = rawAmt + totalTax;
      return {
        baseAmount: Number(rawAmt.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        cgst: Number(cgst.toFixed(2)),
        sgst: Number(sgst.toFixed(2)),
        igst: Number(igst.toFixed(2)),
        finalAmount: Number(finalAmt.toFixed(2))
      };
    }
  }, [amount, gstRate, isInclusive]);

  const handleCopySummary = () => {
    const text = `📊 GST Calculation Summary:\n• Base Price: ₹${result.baseAmount}\n• GST Rate: ${gstRate}% (${isInclusive ? 'Inclusive' : 'Exclusive'})\n• Total GST: ₹${result.totalTax} ${taxType === 'intra' ? `(CGST: ₹${result.cgst} + SGST: ₹${result.sgst})` : `(IGST: ₹${result.igst})`}\n• Final Total: ₹${result.finalAmount}\n\nGenerated with InvoCentric Free GST Calculator (https://invocentric.in/gst-calculator)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const structuredSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'name': 'Free Online GST Calculator India - InvoCentric',
    'url': 'https://invocentric.in/gst-calculator',
    'applicationCategory': 'BusinessApplication, FinancialApplication',
    'operatingSystem': 'All',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'INR'
    },
    'description': 'Calculate GST, CGST, SGST, and IGST for 5%, 12%, 18%, 28% tax slabs. Free online GST calculator tool for Indian retailers, wholesalers, and accountants with instant invoice creation.'
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <SEOHead
        title="Free Online GST Calculator India (CGST, SGST, IGST) | InvoCentric"
        description="Calculate GST online for 5%, 12%, 18%, 28% tax rates instantly. Accurate inclusive & exclusive GST calculation with CGST, SGST, and IGST breakdown. 100% free tool by InvoCentric."
        canonicalUrl="https://invocentric.in/gst-calculator"
        keywords={[
          'gst calculator',
          'online gst calculator',
          'free gst calculator india',
          'cgst sgst calculator',
          'igst calculator',
          'inclusive gst calculator',
          'exclusive gst calculator',
          'gst reverse calculator',
          'gst rates 5 12 18 28'
        ]}
        structuredData={structuredSchema}
      />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <Logo size={44} />
            <div>
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">InvoCentric</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">GST Tools</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 px-3 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-900/10 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Create Free GST Bill</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="pt-10 sm:pt-14 pb-8 sm:pb-10 bg-linear-to-b from-white to-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-black uppercase tracking-wider">
            <Sparkles size={13} />
            <span>100% Free & Accurate Online Tool</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            Free Online GST Calculator
          </h1>
          <p className="text-xs sm:text-base text-slate-600 max-w-2xl mx-auto font-medium">
            Calculate accurate CGST, SGST, IGST, Base Price, and Grand Total for all Indian GST Tax Slabs (0%, 5%, 12%, 18%, 28%) in real time.
          </p>
        </div>
      </section>

      {/* Main Interactive Calculator Canvas */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Panel: Inputs */}
          <div className="lg:col-span-7 p-6 sm:p-10 space-y-6">
            
            {/* Calculation Mode Toggle */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                1. Calculation Mode (GST Type)
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setIsInclusive(false)}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center",
                    !isInclusive
                      ? "bg-white text-emerald-800 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  GST Exclusive (Add GST +)
                </button>
                <button
                  type="button"
                  onClick={() => setIsInclusive(true)}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center",
                    isInclusive
                      ? "bg-white text-emerald-800 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  GST Inclusive (Reverse GST -)
                </button>
              </div>
              <p className="text-[11px] text-slate-500 italic pl-1">
                {!isInclusive 
                  ? "• Add GST to net amount (e.g. ₹100 + 18% = ₹118)" 
                  : "• Extract base price from MRP/final total (e.g. ₹118 → ₹100 base + ₹18 GST)"}
              </p>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                2. Enter Amount (₹)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₹</div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full pl-10 pr-4 py-3.5 text-lg sm:text-xl font-black rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 transition-all tabular-nums"
                />
              </div>
            </div>

            {/* GST Slabs Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                3. Select GST Slab Rate (%)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[0, 5, 12, 18, 28].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setGstRate(rate)}
                    className={cn(
                      "py-3 rounded-2xl font-black text-sm sm:text-base border transition-all cursor-pointer flex flex-col items-center justify-center",
                      gstRate === rate
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-102"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    )}
                  >
                    <span>{rate}%</span>
                    <span className="text-[9px] font-medium opacity-80">
                      {rate === 0 ? 'Exempt' : rate === 5 ? 'Essential' : rate === 12 ? 'Standard' : rate === 18 ? 'General' : 'Luxury'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interstate / Intrastate Supply Type */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                4. Supply Location (Tax Split)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTaxType('intra')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    taxType === 'intra'
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  )}
                >
                  <div className="font-bold text-xs">Same State (Intra-state)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">CGST ({gstRate/2}%) + SGST ({gstRate/2}%)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTaxType('inter')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    taxType === 'inter'
                      ? "border-blue-500 bg-blue-50/50 text-blue-900"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  )}
                >
                  <div className="font-bold text-xs">Other State (Inter-state)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Full IGST ({gstRate}%)</div>
                </button>
              </div>
            </div>

          </div>

          {/* Right Panel: Live Tax Breakdown Card */}
          <div className="lg:col-span-5 bg-slate-900 text-white p-6 sm:p-10 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800">
            <div className="space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <PieChart size={15} /> Result Summary
                </span>
                <span className="text-[10px] font-bold bg-slate-800 px-2.5 py-1 rounded-full text-slate-300">
                  {gstRate}% {isInclusive ? 'Inclusive' : 'Exclusive'}
                </span>
              </div>

              {/* Breakdown Rows */}
              <div className="space-y-3.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Net Base Amount:</span>
                  <span className="font-bold text-white text-base tabular-nums">₹{result.baseAmount.toLocaleString('en-IN')}</span>
                </div>

                {taxType === 'intra' ? (
                  <>
                    <div className="flex justify-between items-center text-slate-400 text-xs">
                      <span>Central Tax (CGST - {gstRate/2}%):</span>
                      <span className="font-semibold text-emerald-400 tabular-nums">₹{result.cgst.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 text-xs">
                      <span>State Tax (SGST - {gstRate/2}%):</span>
                      <span className="font-semibold text-emerald-400 tabular-nums">₹{result.sgst.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center text-slate-400 text-xs">
                    <span>Integrated Tax (IGST - {gstRate}%):</span>
                    <span className="font-semibold text-blue-400 tabular-nums">₹{result.igst.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/80 pt-3">
                  <span>Total Tax (GST):</span>
                  <span className="font-black text-amber-400 text-base tabular-nums">+ ₹{result.totalTax.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Grand Total Box */}
              <div className="bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-slate-700 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Invoice Amount
                </div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 tabular-nums">
                  ₹{result.finalAmount.toLocaleString('en-IN')}
                </div>
              </div>

            </div>

            {/* Actions */}
            <div className="pt-6 space-y-3">
              <button
                type="button"
                onClick={handleCopySummary}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                <span>{copied ? 'Summary Copied to Clipboard!' : 'Copy Calculation Details'}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/invoices/create?auto_price=${result.baseAmount}&auto_gst=${gstRate}&supply_type=${taxType}`)}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-98"
              >
                <span>Make Tax Invoice for ₹{result.finalAmount}</span>
                <ArrowRight size={15} />
              </button>
            </div>

          </div>

        </div>
      </main>

      {/* SEO Information & Educational Content Section */}
      <section className="bg-white border-t border-slate-200 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
          
          {/* GST Slabs Table */}
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Understanding Indian GST Tax Rates & Slabs (2026)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Goods and Services Tax (GST) in India is categorized into 5 primary tax tiers designed to tax essentials at lower rates and luxury products at standard rates:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border border-slate-200 rounded-2xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-800 font-black uppercase text-[11px]">
                  <tr>
                    <th className="p-3.5 border-b border-slate-200">GST Slab</th>
                    <th className="p-3.5 border-b border-slate-200">Category Type</th>
                    <th className="p-3.5 border-b border-slate-200">Common Items / Services</th>
                    <th className="p-3.5 border-b border-slate-200">CGST + SGST Split</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-emerald-700">0% (Nil)</td>
                    <td className="p-3.5 font-semibold">Exempted Goods</td>
                    <td className="p-3.5 text-slate-600">Fresh vegetables, milk, eggs, unbranded grains</td>
                    <td className="p-3.5 text-slate-600">0% + 0%</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-emerald-700">5% Slab</td>
                    <td className="p-3.5 font-semibold">Essential Commodities</td>
                    <td className="p-3.5 text-slate-600">Packaged food, medicines, economy transport, tea, coffee</td>
                    <td className="p-3.5 text-slate-600">2.5% + 2.5%</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-emerald-700">12% Slab</td>
                    <td className="p-3.5 font-semibold">Standard Tier 1</td>
                    <td className="p-3.5 text-slate-600">Computers, processed food, apparel above ₹1000, business class air travel</td>
                    <td className="p-3.5 text-slate-600">6% + 6%</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-emerald-700">18% Slab</td>
                    <td className="p-3.5 font-semibold">General Standard (Most Common)</td>
                    <td className="p-3.5 text-slate-600">IT services, restaurants, electronics, software, telecom, consulting</td>
                    <td className="p-3.5 text-slate-600">9% + 9%</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-emerald-700">28% Slab</td>
                    <td className="p-3.5 font-semibold">Luxury & De-merit</td>
                    <td className="p-3.5 text-slate-600">Automobiles, air conditioners, gaming, tobacco, aerated drinks</td>
                    <td className="p-3.5 text-slate-600">14% + 14%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Formulas Explanations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Percent size={16} className="text-emerald-600" />
                GST Exclusive Calculation Formula
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-mono bg-white p-3 rounded-xl border border-slate-200">
                GST Amount = (Base Price × GST Rate) / 100<br/>
                Total Price = Base Price + GST Amount
              </p>
              <p className="text-xs text-slate-500">Used when adding GST on top of product wholesale rate.</p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Percent size={16} className="text-emerald-600" />
                GST Inclusive (Reverse) Formula
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-mono bg-white p-3 rounded-xl border border-slate-200">
                Base Price = Total Price / (1 + (GST Rate / 100))<br/>
                GST Amount = Total Price - Base Price
              </p>
              <p className="text-xs text-slate-500">Used when removing GST from MRP retail price.</p>
            </div>
          </div>

          {/* FAQs */}
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions (GST Calculator FAQs)
            </h2>
            <div className="space-y-3">
              {[
                {
                  q: "What is the difference between CGST, SGST, and IGST?",
                  a: "CGST (Central GST) and SGST (State GST) apply when goods are sold within the same state (Intra-state). Both the Central and State governments split the tax equally (e.g. 18% = 9% CGST + 9% SGST). IGST (Integrated GST) applies when goods or services are supplied across state borders (Inter-state) and goes directly to the Central government."
                },
                {
                  q: "How do I calculate GST backwards from MRP (Reverse GST)?",
                  a: "Select the 'GST Inclusive' toggle in the calculator above. Enter the MRP (e.g. ₹118) and select your GST rate (e.g. 18%). The calculator will automatically extract the original net base price (₹100) and the exact tax paid (₹18)."
                },
                {
                  q: "Is this GST calculator free for business use?",
                  a: "Yes, 100% free! You can also use InvoCentric to generate professional GST invoices, convert estimates into tax bills, track inventory, and send 1-click WhatsApp payment reminders with zero hidden charges."
                }
              ].map((faq, idx) => (
                <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <h4 className="font-bold text-slate-900 text-sm">{faq.q}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Bottom CTA Banner */}
      <footer className="bg-slate-900 text-white py-12 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <h3 className="text-2xl sm:text-3xl font-black text-white">
            Create Professional GST Invoices in 30 Seconds
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Ready to streamline your billing? Generate GST-compliant invoices, track stock with barcodes, and share bills on WhatsApp with InvoCentric.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span>Start Free Now</span>
            <ArrowRight size={16} />
          </button>
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} InvoCentric. Built for Indian Retailers, Wholesalers & Freelancers.
          </p>
        </div>
      </footer>

    </div>
  );
}
