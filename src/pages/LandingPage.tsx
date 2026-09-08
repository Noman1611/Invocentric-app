import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import {
  Check, ArrowRight, Calculator, ChevronDown, 
  Receipt, PieChart, Package, Printer, Store, 
  Smartphone, Activity, FileText, QrCode, TrendingUp,
  Mail, Phone, MapPin, ChevronRight, MessageCircle, HelpCircle,
  Sparkles, Star, Award, History, User, Users, RefreshCw, Upload, Download, BookOpen, X, Globe, Share2, ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BLOG_POSTS } from './BlogPage';
import { cn } from '../lib/utils';

const FADE_UP_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

// State mapping for Indian GSTIN State Code (First 2 digits)
const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

const COMMON_HSN_CODES = [
  { code: "8517", category: "Mobile Phones & Smart Devices", gst: 18, desc: "Mobile phones, smartphones, repair parts and wireless headsets" },
  { code: "8471", category: "Laptops, Computers & Tablets", gst: 18, desc: "Personal computers, CPU parts, laptops and microprocessors" },
  { code: "8528", category: "Televisions & Computer Monitors", gst: 28, desc: "Liquid crystal and LED televisions, flat screens, and monitors" },
  { code: "8415", category: "Air Conditioners", gst: 28, desc: "Split & window AC systems, compressor units, and cooling fans" },
  { code: "8544", category: "Cables & Electronic Wires", gst: 18, desc: "Insulated electric wire, optical fiber cables, copper and USB cords" },
  { code: "8443", category: "Printers, POS & Scanners", gst: 18, desc: "Thermal receipt printers, laser printers, scanners, and accessories" },
  { code: "9983", category: "Software Consulting & IT Services", gst: 18, desc: "SaaS platforms, web development, custom software solutions and support" },
  { code: "6109", category: "Apparel, Garments & Clothing", gst: 5, desc: "T-shirts, readymade suits, and general apparel (GST is 12% if value > ₹1000)" },
  { code: "0910", category: "Grocery, Masala & Spices", gst: 5, desc: "Spices, ginger, dry powders, turmeric, and general kirana store items" },
  { code: "0402", category: "Dairy Products (Milk/Paneer)", gst: 5, desc: "Packaged milk, condensed milk, paneer, and branded curd" },
  { code: "3004", category: "Medicines & Pharmacy Drugs", gst: 12, desc: "Generic medicines, antibiotics, medical drops, and health supplements" },
  { code: "6403", category: "Shoes, Sandals & Footwear", gst: 12, desc: "Leather shoes, sports sneakers, boots, and slippers" }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, planTier } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [calcAmount, setCalcAmount] = useState<number>(5000);
  const [calcGstRate, setCalcGstRate] = useState<number>(18);
  const [calcIsGstInclusive, setCalcIsGstInclusive] = useState<boolean>(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [landingBillingCycle, setLandingBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // New states for interactive modals
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isBlogsOpen, setIsBlogsOpen] = useState(false);
  const [isGstinOpen, setIsGstinOpen] = useState(false);
  const [isHsnOpen, setIsHsnOpen] = useState(false);
  const [isTallyOpen, setIsTallyOpen] = useState(false);
  const [isCareersOpen, setIsCareersOpen] = useState(false);
  const [isWhyInvoCentricOpen, setIsWhyInvoCentricOpen] = useState(false);

  // Tools search states
  const [gstinQuery, setGstinQuery] = useState('');
  const [gstinResult, setGstinResult] = useState<any | null>(null);
  const [gstinError, setGstinError] = useState('');

  const [hsnQuery, setHsnQuery] = useState('');
  const [hsnResults, setHsnResults] = useState(COMMON_HSN_CODES);

  const [tallyFile, setTallyFile] = useState<string | null>(null);
  const [tallyProgress, setTallyProgress] = useState(-1);

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const calculatedGst = React.useMemo(() => {
    if (calcIsGstInclusive) {
      const base = calcAmount / (1 + (calcGstRate / 100));
      return { base, tax: calcAmount - base, total: calcAmount };
    } else {
      const tax = calcAmount * (calcGstRate / 100);
      return { base: calcAmount, tax, total: calcAmount + tax };
    }
  }, [calcAmount, calcGstRate, calcIsGstInclusive]);

  // Handle GSTIN Validation
  const handleValidateGstin = () => {
    const cleanGst = gstinQuery.trim().toUpperCase();
    if (!cleanGst) {
      setGstinError('Please enter a GSTIN');
      setGstinResult(null);
      return;
    }
    
    // Regular Expression for Indian GSTIN Format
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    
    if (!gstinRegex.test(cleanGst)) {
      setGstinError('Invalid format. GSTIN should look like 24AAACC1206D1Z5');
      setGstinResult(null);
      return;
    }

    const stateCode = cleanGst.substring(0, 2);
    const stateName = GST_STATES[stateCode] || 'Unknown State';
    const panCard = cleanGst.substring(2, 12);
    
    setGstinError('');
    setGstinResult({
      gstin: cleanGst,
      state: stateName,
      pan: panCard,
      status: 'ACTIVE',
      type: 'Regular Taxpayer',
      legalName: 'InvoCentric Verified Shop Owner',
      tradeName: 'Retail Merchant Enterprise',
      dateOfRegistration: '12-Apr-2024'
    });
  };

  // Handle HSN Search
  const handleSearchHsn = (query: string) => {
    setHsnQuery(query);
    if (!query.trim()) {
      setHsnResults(COMMON_HSN_CODES);
      return;
    }
    const filtered = COMMON_HSN_CODES.filter(item => 
      item.code.includes(query) || 
      item.category.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase())
    );
    setHsnResults(filtered);
  };

  // Handle Tally XML conversion simulation
  const handleTallyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTallyFile(file.name);
      setTallyProgress(0);

      const interval = setInterval(() => {
        setTallyProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
    }
  };

  const handleDownloadTallyXml = () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>InvoCentric Retail Enterprise</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>20260710</DATE>
            <VOUCHERNUMBER>BC-2026-001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Cash Customer</PARTYLEDGERNAME>
            <EFFECTIVEDATE>20260710</EFFECTIVEDATE>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>-5000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash</LEDGERNAME>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>5000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tallyFile?.replace(/\.[^/.]+$/, "") || 'invocentric'}_tally_import.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const faqs = [
    {
      q: "Is InvoCentric suitable for mobile shops and retail stores?",
      a: "Yes! InvoCentric is perfectly optimized for mobile repair shops, electronics, grocery, and general retail stores. It supports fast billing and thermal printing."
    },
    {
      q: "Does it support Thermal Printers?",
      a: "Absolutely. InvoCentric is designed to work seamlessly with 2-inch and 3-inch thermal printers commonly used in Indian retail stores."
    },
    {
      q: "Is it completely free?",
      a: "InvoCentric offers a generous free tier that covers the needs of most small businesses. You can create invoices, manage basic inventory, and generate reports."
    },
    {
      q: "Is my data secure?",
      a: "Yes, we use industry-standard encryption. Your data is stored securely in the cloud and is automatically backed up so you never lose your records."
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-green-500/30 overflow-x-hidden">
      
      {/* Navigation - Spacious and Clean */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          scrolled ? 'bg-white/80 backdrop-blur-xl border-gray-200 shadow-sm py-3' : 'bg-transparent border-transparent py-5'
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <Logo size={40} />
              <span className="font-brand text-2xl tracking-tight text-gray-900">
                <span className="font-extrabold">Invo</span><span className="font-bold">Centric</span>
              </span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
               <a href="#features" className="text-sm font-semibold text-gray-600 hover:text-green-600 transition-colors">Features</a>
               <a href="#showcase" className="text-sm font-semibold text-gray-600 hover:text-green-600 transition-colors">Showcase</a>
               <a href="#pricing" className="text-sm font-semibold text-gray-600 hover:text-green-600 transition-colors">Pricing</a>
               <a href="#calculator" className="text-sm font-semibold text-gray-600 hover:text-green-600 transition-colors">GST Tools</a>
               <button onClick={() => navigate('/blog')} className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200/60 hover:bg-green-100 transition-all cursor-pointer flex items-center gap-1.5">
                 <BookOpen size={14} className="text-green-600" />
                 Blogs
               </button>
               <a href="#faq" className="text-sm font-semibold text-gray-600 hover:text-green-600 transition-colors">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-900/20"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="hidden md:block px-5 py-2.5 text-sm font-bold text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-full hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-600/30"
                  >
                    Get Started Free
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      <main>
        {/* Animated Hero Section with Spacious Margins */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
             <motion.div style={{ y: heroY }} className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-green-400/20 blur-[120px]" />
             <motion.div style={{ y: heroY }} className="absolute top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-blue-400/20 blur-[120px]" />
          </div>

          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
              
              <motion.div 
                className="w-full lg:w-1/2"
                variants={STAGGER_CONTAINER}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-100 text-green-700 text-xs font-bold uppercase tracking-wider mb-6">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                  India's #1 Free Billing App
                </motion.div>
                
                <motion.h1 variants={FADE_UP_ANIMATION_VARIANTS} className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
                  Smart Billing for <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Smart Businesses.</span>
                </motion.h1>
                
                <motion.p variants={FADE_UP_ANIMATION_VARIANTS} className="text-lg md:text-xl text-gray-800 mb-8 max-w-xl leading-relaxed">
                  Generate professional GST invoices, manage inventory, track daily expenses, and print thermal bills directly from your browser. Perfect for retail and mobile shops.
                </motion.p>
                
                <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="flex flex-col sm:flex-row items-center gap-4">
                  <button 
                    onClick={() => navigate('/login')}
                    className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group active:scale-95 shadow-xl shadow-gray-900/20"
                  >
                    Create Free Account
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                     onClick={() => {
                        const el = document.getElementById('calculator');
                        el?.scrollIntoView({ behavior: 'smooth' });
                     }}
                    className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 text-sm font-bold rounded-full hover:bg-gray-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Calculator size={18} />
                    Try GST Calculator
                  </button>
                </motion.div>

                <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="mt-10 flex items-center gap-6 text-sm font-medium text-gray-700">
                  <div className="flex items-center gap-2"><Check size={16} className="text-green-500"/> No credit card</div>
                  <div className="flex items-center gap-2"><Check size={16} className="text-green-500"/> 100% Free Tier</div>
                  <div className="flex items-center gap-2"><Check size={16} className="text-green-500"/> Secure Data</div>
                </motion.div>
              </motion.div>

              <motion.div 
                className="w-full lg:w-1/2 relative"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                style={{ opacity: heroOpacity }}
              >
                <div className="relative w-full aspect-square max-w-[500px] mx-auto">
                   <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-green-100 to-blue-50 border border-white/50 shadow-2xl animate-spin-slow opacity-50" style={{ animationDuration: '30s' }} />
                   
                   {/* Main Floating Mockup Card */}
                   <motion.div 
                     animate={{ y: [0, -10, 0] }}
                     transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                     className="absolute inset-x-4 top-12 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 z-10"
                   >
                     <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                       <div className="flex items-center gap-3">
                         <div className="bg-green-50 text-green-600 p-2.5 rounded-xl">
                           <Store size={20} />
                         </div>
                         <div>
                           <h3 className="font-bold text-gray-900 text-sm">TechMart Electronics</h3>
                           <p className="text-xs text-gray-700">GSTIN: 22DEMO9999A1Z0</p>
                         </div>
                       </div>
                       <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Live</span>
                     </div>
                     
                     <div className="space-y-4">
                       <div className="flex justify-between items-end">
                         <div>
                           <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Today's Sales</p>
                           <p className="text-2xl font-black text-gray-900">₹45,250.00</p>
                         </div>
                         <div className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                           <TrendingUp size={12} /> +12.4%
                         </div>
                       </div>
                       
                       <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                         <div className="bg-gradient-to-r from-green-500 to-blue-500 h-full w-[78%] rounded-full" />
                       </div>
                     </div>
                   </motion.div>

                   {/* Floating Invoice Badge */}
                   <motion.div 
                     animate={{ y: [0, 8, 0], x: [0, -4, 0] }}
                     transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                     className="absolute bottom-12 left-0 bg-gray-900 text-white rounded-xl shadow-xl p-3 z-20 flex items-center gap-3 max-w-[220px]"
                   >
                     <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                       <Receipt size={16} />
                     </div>
                     <div className="min-w-0">
                       <p className="text-xs font-bold truncate text-white">INV-2026-042</p>
                       <p className="text-[10px] text-green-300 font-semibold">Generated in 5 sec</p>
                     </div>
                   </motion.div>

                   {/* Floating Whatsapp Badge */}
                   <motion.div 
                     animate={{ y: [0, -8, 0], x: [0, 4, 0] }}
                     transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 2 }}
                     className="absolute top-12 right-0 bg-emerald-600 text-white rounded-xl shadow-xl p-3 z-20 flex items-center gap-3 max-w-[200px]"
                   >
                     <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
                       <WhatsAppIcon size={18} />
                     </div>
                     <div className="min-w-0">
                       <p className="text-xs font-bold">Auto Shared</p>
                       <p className="text-[10px] text-emerald-100">on WhatsApp</p>
                     </div>
                   </motion.div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* Brand Indicators / Social Proof */}
        <section className="py-12 bg-white border-y border-gray-100 text-center">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 text-center mb-6">
            <p className="text-xs uppercase font-extrabold tracking-widest text-gray-700 mb-8">Trusted by shop owners across India</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
              <span className="font-extrabold text-lg md:text-xl text-gray-700 flex items-center gap-2"><Store size={20} /> Mobile Outlets</span>
              <span className="font-extrabold text-lg md:text-xl text-gray-700 flex items-center gap-2"><Printer size={20} /> Grocery POS</span>
              <span className="font-extrabold text-lg md:text-xl text-gray-700 flex items-center gap-2"><Smartphone size={20} /> Kirana Stores</span>
              <span className="font-extrabold text-lg md:text-xl text-gray-700 flex items-center gap-2"><Activity size={20} /> Pharma Care</span>
            </div>
          </div>
        </section>

        {/* Ideal For Section - Business Niches */}
        <section className="py-20 bg-gradient-to-b from-white via-green-50/10 to-gray-50 border-b border-gray-100/60">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-100 text-[#0B524E] text-[10px] font-bold uppercase tracking-widest mb-4">
                Supported Business Niches
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Designed for your specific business.
              </h2>
              <p className="text-gray-700 max-w-xl mx-auto text-base">
                InvoCentric adapts to your retail, wholesale, or service operations seamlessly. Whether a small shop or a larger store.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                {
                  title: "Kirana & Provision Stores",
                  desc: "Fast billing, offline credit ledger, and camera barcode scanner for quick checkouts.",
                  icon: <Store className="text-green-600" size={24} />,
                  badge: "Popular"
                },
                {
                  title: "Wholesale & Distributors",
                  desc: "Manage high-volume purchase records, credit summaries, and tax invoice distributions.",
                  icon: <TrendingUp className="text-blue-600" size={24} />,
                  badge: "Bulk Trade"
                },
                {
                  title: "Mobile & Accessories Shops",
                  desc: "Track custom stock models, fast search features, and easy digital GST invoicing.",
                  icon: <Smartphone className="text-green-600" size={24} />,
                  badge: "Modern Retail"
                },
                {
                  title: "Garments & Apparel",
                  desc: "Organize items with color, size attributes, printed thermal tags, and instant PDFs.",
                  icon: <Package className="text-purple-600" size={24} />,
                  badge: "Apparel Ready"
                },
                {
                  title: "Service Providers & Freelancers",
                  desc: "Quickly generate quotations, share bills via WhatsApp, and add custom digital signatures.",
                  icon: <FileText className="text-amber-600" size={24} />,
                  badge: "Professional"
                }
              ].map((niche, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:border-green-100 cursor-default"
                >
                    <div className="relative font-semibold">
                      <div className="absolute -top-1 -right-1 bg-gray-50 group-hover:bg-green-50 text-gray-700 group-hover:text-[#0B524E] text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors">
                        {niche.badge}
                      </div>
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        {niche.icon}
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-3 leading-snug group-hover:text-[#0B524E] transition-colors">{niche.title}</h3>
                      <p className="text-xs text-gray-700 leading-relaxed">{niche.desc}</p>
                    </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Bento Grid Core Features */}
        <section id="features" className="py-24 bg-gray-50">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">Crafted for Indian Retailers</h2>
              <p className="text-gray-600 text-lg">Powerful features built explicitly to save your time, automate your billing counter, and scale your business.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-6">
                  <Receipt size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Beautiful Invoices</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Create fully compliant GST and non-GST invoices in 5 seconds. Customize headers, logos, signatures, and layouts to match your brand style.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                  <WhatsAppIcon size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">WhatsApp Sharing</h3>
                <p className="text-gray-700 text-sm leading-relaxed">No paper costs. Directly share professional PDF invoices with customers on WhatsApp with a single tap after billing.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                  <Printer size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Thermal Printing</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Fully optimized with 2-inch and 3-inch POS printers. Speed up checkout queues with rapid automatic paper cutouts and logo printing.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6">
                  <Package size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Smart Inventory</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Track stock levels live, set auto low-stock warnings, organize categories, and upload items via barcode scanning effortlessly.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-6">
                  <PieChart size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Tax & GST Reports</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Ready-to-file GSTR-1 & GSTR-3B Excel spreadsheets compiled automatically. Export and hand over cleanly to your chartered accountant.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6">
                  <Activity size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Daily Book & Cashflow</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Monitor cash sales, bank transfers, credit ledger records, and business expenditures in a consolidated dashboard.</p>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------- NEW SHOWCASE SECTION (HIGHLY INTERACTIVE) -------------------- */}
        {/* Full-Screen Premium App Preview with Floating Animation Shapes requested by user */}
        <section id="showcase" className="py-28 bg-gradient-to-b from-gray-950 to-[#0c0f17] text-white relative overflow-hidden px-4 md:px-0">
          {/* Grid Accent Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
          
          {/* Floating Neon Glow Shapes */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[160px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />

          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider mb-6">
              <Sparkles size={14} className="animate-pulse" /> Live Platform Showcase
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight text-white">
              Beautiful Workspaces. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-emerald-300 to-blue-300" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Seamless Operating Flow.</span>
            </h2>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto mb-20 font-medium leading-relaxed">
              Experience the ultra-responsive, beautifully optimized retail invoicing workspace. High performance offline processing paired with instant cloud replication.
            </p>

            {/* Simulated Desktop Container for the Image - Configured with a premium, interactive floating and viewport entry animation */}
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              className="relative w-[98%] lg:w-[96%] xl:w-[95%] max-w-[1550px] mx-auto bg-gray-950/50 rounded-[32px] p-2 md:p-3 border border-gray-900/60 shadow-[0_0_100px_-20px_rgba(20,184,166,0.25)] backdrop-blur-xl transition-shadow duration-500 hover:shadow-[0_0_120px_-10px_rgba(20,184,166,0.4)]"
            >
              
              {/* Elegant ambient corner glows behind the showcase image */}
              <div className="absolute -top-12 -left-12 w-[300px] h-[300px] bg-green-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

              {/* The user's shared image, beautifully structured and styled in full width */}
              <div 
                className="w-full h-auto overflow-hidden rounded-[24px] border border-gray-900/80 bg-[#07090e] relative group cursor-pointer"
                onClick={() => navigate(user ? '/dashboard' : '/login')}
              >
                <motion.img 
                  initial={{ scale: 1.01 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  src="https://i.ibb.co/jkjMxGvz/Invo-Centric-showcase-NEW.webp" 
                  alt="InvoCentric Smart Invoicing Web Application High-Fidelity Showcase" 
                  className="w-full h-auto object-cover object-center shadow-2xl block transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />

                {/* Center Hover Action Icon Overlay without blur */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileHover={{ scale: 1.1 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ scale: { repeat: Infinity, duration: 2, ease: "easeInOut" } }}
                    className="w-20 h-20 rounded-full bg-green-500/90 text-white flex items-center justify-center shadow-[0_0_50px_rgba(20,184,166,0.6)] border border-green-300/30"
                  >
                    <Sparkles size={36} className="text-white animate-pulse" />
                  </motion.div>
                </div>

                {/* Floating interactive corners with icons */}
                <div className="absolute top-4 left-4 z-20 hidden md:flex items-center gap-2 bg-gray-950/80 backdrop-blur-md px-3.5 py-2 rounded-full border border-gray-800/80 shadow-lg text-xs font-bold text-green-400">
                  <Activity size={12} className="animate-pulse" />
                  <span>Realtime State Engine</span>
                </div>

                <div className="absolute top-4 right-4 z-20 hidden md:flex items-center gap-2 bg-gray-950/80 backdrop-blur-md px-3.5 py-2 rounded-full border border-gray-800/80 shadow-lg text-xs font-bold text-emerald-400">
                  <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
                  <span>Cloud Sync Active</span>
                </div>

                <div className="absolute bottom-4 left-4 z-20 hidden md:flex items-center gap-2 bg-gray-950/80 backdrop-blur-md px-3.5 py-2 rounded-full border border-gray-800/80 shadow-lg text-xs font-bold text-blue-400">
                  <Printer size={12} />
                  <span>Multi-Format Printer</span>
                </div>

                <div className="absolute bottom-4 right-4 z-20 hidden md:flex items-center gap-2 bg-gray-950/80 backdrop-blur-md px-3.5 py-2 rounded-full border border-gray-800/80 shadow-lg text-xs font-bold text-green-400">
                  <Check size={12} className="bg-green-500/20 p-0.5 rounded-full text-green-400" />
                   <span>Secured with Auth</span>
                 </div>
               </div>
 
             </motion.div>
           </div>
         </section>
 
         {/* -------------------- STEP BY STEP "HOW IT WORKS" SECTION -------------------- */}
         <section id="how-it-works" className="py-24 bg-slate-50 border-b border-gray-200/60 relative overflow-hidden">
           {/* Subtle background graphics */}
           <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-[120px] pointer-events-none" />
           <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
 
           <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
             <div className="text-center max-w-3xl mx-auto mb-20">
               <span className="text-xs font-extrabold uppercase tracking-widest text-green-600 bg-green-100/60 px-4 py-1.5 rounded-full">
                 Step-by-Step Guide
               </span>
               <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mt-5">
                 How InvoCentric Works?
               </h2>
               <p className="text-gray-700 mt-3 text-base md:text-lg">
                 Digitalize your store without any technical hassle. Set up your digital billing system in just 5 simple steps.
               </p>
             </div>
 
             {/* Desktop Connective Line */}
             <div className="relative">
               <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-blue-500/20 -translate-y-1/2 hidden lg:block z-0" />
 
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
                 {/* Step 1 */}
                 <motion.div 
                   variants={FADE_UP_ANIMATION_VARIANTS}
                   initial="hidden"
                   whileInView="show"
                   viewport={{ once: true }}
                   className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative"
                 >
                   <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-green-500 text-white font-black text-sm flex items-center justify-center shadow-md">
                     1
                   </div>
                   <div>
                     <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                       <Store size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">1. Create Profile</h3>
                     <h4 className="text-xs font-semibold text-green-600 mb-3">Setup Store Profile</h4>
                     <p className="text-gray-700 text-xs leading-relaxed">
                       Enter your store name, address, contact details, and optional GSTIN/Logo to brand your invoices.
                     </p>
                   </div>
                   <div className="text-[11px] font-medium text-gray-700 mt-4 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                     💡 <span className="text-gray-900 font-semibold">Quick Start:</span> Log in with your phone number and complete details in under 1 minute.
                   </div>
                 </motion.div>
 
                 {/* Step 2 */}
                 <motion.div 
                   variants={FADE_UP_ANIMATION_VARIANTS}
                   initial="hidden"
                   whileInView="show"
                   viewport={{ once: true }}
                   className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative"
                 >
                   <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-emerald-500 text-white font-black text-sm flex items-center justify-center shadow-md">
                     2
                   </div>
                   <div>
                     <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                       <Package size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">2. Add Inventory</h3>
                     <h4 className="text-xs font-semibold text-emerald-600 mb-3">Track Stock & Items</h4>
                     <p className="text-gray-700 text-xs leading-relaxed">
                       Add products with prices, HSN, tax rates, and barcodes. Track stock counts dynamically with automatic alerts.
                     </p>
                   </div>
                   <div className="text-[11px] font-medium text-gray-700 mt-4 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                     💡 <span className="text-gray-900 font-semibold">Bulk Import:</span> Easily upload all your items in one go using Excel.
                   </div>
                 </motion.div>
 
                 {/* Step 3 */}
                 <motion.div 
                   variants={FADE_UP_ANIMATION_VARIANTS}
                   initial="hidden"
                   whileInView="show"
                   viewport={{ once: true }}
                   className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative"
                 >
                   <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-green-500 text-white font-black text-sm flex items-center justify-center shadow-md">
                     3
                   </div>
                   <div>
                     <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                       <QrCode size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">3. Scan Barcodes</h3>
                     <h4 className="text-xs font-semibold text-green-600 mb-3">Instant Camera Scan</h4>
                     <p className="text-gray-700 text-xs leading-relaxed">
                       Point your mobile camera at any product barcode to instantly identify, fetch pricing, and add items to active bills.
                     </p>
                   </div>
                   <div className="text-[11px] font-medium text-gray-700 mt-4 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                     💡 <span className="text-gray-900 font-semibold">Fast Invoicing:</span> Use your mobile phone camera as an integrated barcode scanner.
                   </div>
                 </motion.div>
 
                 {/* Step 4 */}
                 <motion.div 
                   variants={FADE_UP_ANIMATION_VARIANTS}
                   initial="hidden"
                   whileInView="show"
                   viewport={{ once: true }}
                   className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative"
                 >
                   <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-amber-500 text-white font-black text-sm flex items-center justify-center shadow-md">
                     4
                   </div>
                   <div>
                     <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                       <Printer size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">4. Print & Share</h3>
                     <h4 className="text-xs font-semibold text-amber-600 mb-3">Receipts & Sharing</h4>
                     <p className="text-gray-700 text-xs leading-relaxed">
                       Download professional PDFs, instantly share bills to clients via WhatsApp, or print directly on 2"/3" thermal printers.
                     </p>
                   </div>
                   <div className="text-[11px] font-medium text-gray-700 mt-4 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                     💡 <span className="text-gray-900 font-semibold">Formats:</span> Fully customizable layouts for Estimates, Quotes, & formal Bills.
                   </div>
                 </motion.div>
 
                 {/* Step 5 */}
                 <motion.div 
                   variants={FADE_UP_ANIMATION_VARIANTS}
                   initial="hidden"
                   whileInView="show"
                   viewport={{ once: true }}
                   className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative"
                 >
                   <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-blue-500 text-white font-black text-sm flex items-center justify-center shadow-md">
                     5
                   </div>
                   <div>
                     <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                       <TrendingUp size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">5. Ledger & Reports</h3>
                     <h4 className="text-xs font-semibold text-blue-600 mb-3">Credit Ledger & Balances</h4>
                     <p className="text-gray-700 text-xs leading-relaxed">
                       Log customer credits and payments, issue automatic digital reminders, track daily cashflow, and export monthly GSTR tax reports.
                     </p>
                   </div>
                   <div className="text-[11px] font-medium text-gray-700 mt-4 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                     💡 <span className="text-gray-900 font-semibold">100% Secure:</span> Your financial data is saved locally on your device with offline protection.
                   </div>
                 </motion.div>
               </div>
             </div>
 
             {/* Quick Action Banner */}
             <div className="mt-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-green-500/10">
               <div className="max-w-2xl">
                 <h3 className="text-2xl font-extrabold">Ready to Digitalize Your Retail Business Today?</h3>
                 <p className="text-green-50 text-sm mt-1">Zero setup fees, zero subscription costs. Free forever, no credit card required.</p>
               </div>
               <button 
                 onClick={() => navigate(user ? '/dashboard' : '/login')}
                 className="bg-white text-green-700 font-extrabold px-8 py-4 rounded-xl shadow-md hover:bg-green-50 transition-colors shrink-0 flex items-center gap-2 group text-sm"
               >
                 Start Free Invoicing Now
                 <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
               </button>
             </div>
           </div>
         </section>
 
         {/* SEO Tools Magnet Section */}
         <section id="calculator" className="py-24 bg-white border-b border-gray-100">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-extrabold uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full">GST Calculators & Utilities</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mt-4">Live Interactive GST Calculator</h2>
              <p className="text-gray-700 mt-2">Check base value, SGST, CGST, IGST and final invoice pricing instantaneously.</p>
            </div>

            <div className="max-w-5xl mx-auto bg-gray-50 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="grid grid-cols-1 md:grid-cols-2">
                 
                 {/* Left Column: Calculator inputs */}
                 <div className="p-8 md:p-12 bg-white border-r border-gray-100">
                    <div className="mb-6">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2">Base Amount (₹)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-lg">₹</span>
                        <input 
                          type="number"
                          value={calcAmount || ''}
                          onChange={(e) => setCalcAmount(Number(e.target.value))}
                          placeholder="Amount"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-9 pr-4 text-gray-900 font-extrabold text-lg focus:outline-none focus:border-green-500 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2">GST Rate</label>
                        <select 
                          value={calcGstRate}
                          onChange={(e) => setCalcGstRate(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 font-bold focus:outline-none focus:border-green-500 focus:bg-white transition-colors"
                        >
                          <option value="5">5% GST</option>
                          <option value="12">12% GST</option>
                          <option value="18">18% GST</option>
                          <option value="28">28% GST</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2">Calculation Type</label>
                        <div className="flex bg-gray-100 p-1 rounded-xl h-[48px]">
                          <button 
                            type="button"
                            onClick={() => setCalcIsGstInclusive(false)}
                            className={`flex-1 rounded-lg text-xs font-bold transition-all ${!calcIsGstInclusive ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500'}`}
                          >
                            Exclusive
                          </button>
                          <button 
                            type="button"
                            onClick={() => setCalcIsGstInclusive(true)}
                            className={`flex-1 rounded-lg text-xs font-bold transition-all ${calcIsGstInclusive ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500'}`}
                          >
                            Inclusive
                          </button>
                        </div>
                      </div>
                    </div>
                 </div>

                 {/* Right Column: Calculations Breakdown */}
                 <div className="p-8 md:p-12 bg-gray-900 text-white flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-green-400 mb-6">Calculation Breakdown</h4>
                      <div className="space-y-4 font-medium text-sm text-gray-300">
                        <div className="flex justify-between">
                          <span>Net Value (Base)</span>
                          <span className="text-white font-bold">₹{calculatedGst.base.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Central GST (CGST - {calcGstRate/2}%)</span>
                          <span className="text-white font-bold">₹{(calculatedGst.tax / 2).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>State GST (SGST - {calcGstRate/2}%)</span>
                          <span className="text-white font-bold">₹{(calculatedGst.tax / 2).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-800 mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-extrabold tracking-widest">Total Value (incl. GST)</p>
                        <p className="text-3xl font-black text-green-400 mt-1">₹{calculatedGst.total.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const text = encodeURIComponent(`📊 GST Calculation Summary:\n• Base Price: ₹${calculatedGst.base.toFixed(2)}\n• GST (${calcGstRate}%): ₹${calculatedGst.tax.toFixed(2)} (CGST: ₹${(calculatedGst.tax/2).toFixed(2)} + SGST: ₹${(calculatedGst.tax/2).toFixed(2)})\n• Total Value: ₹${calculatedGst.total.toFixed(2)}\n\nCalculated with InvoCentic Free GST Tool: https://invocentric.in/gst-calculator`);
                            window.open(`https://wa.me/?text=${text}`, '_blank');
                          }}
                          className="px-3.5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Share breakdown on WhatsApp"
                        >
                          <Share2 size={14} />
                          <span>Share Quote</span>
                        </button>
                        <button 
                          onClick={() => navigate(`/invoices/create?auto_price=${calculatedGst.base.toFixed(2)}&auto_gst=${calcGstRate}`)}
                          className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-green-950/40"
                        >
                          <span>Create Bill</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Sub-tools Links */}
            <div className="max-w-[1200px] mx-auto mt-12 grid grid-cols-2 md:grid-cols-5 gap-4">
              <button 
                onClick={() => setIsHsnOpen(true)}
                className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-green-500 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer group"
              >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <Receipt size={18} />
                </div>
                <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">HSN/SAC Codes</span>
              </button>

              <button 
                onClick={() => setIsGstinOpen(true)}
                className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-green-500 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer group"
              >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <Check size={18} />
                </div>
                <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">Verify GSTIN</span>
              </button>

              <button 
                onClick={() => setIsTallyOpen(true)}
                className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-green-500 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer group"
              >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <FileText size={18} />
                </div>
                <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">XML Converter</span>
              </button>

              <button 
                onClick={() => window.open("https://ns-fixed-qr.vercel.app/", "_blank", "noopener,noreferrer")}
                className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-green-500 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer group"
              >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <QrCode size={18} />
                </div>
                <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">QR Generator</span>
              </button>

              <button 
                onClick={() => navigate('/blog')}
                className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-green-500 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer group"
              >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <Sparkles size={18} />
                </div>
                <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">GST Blogs</span>
              </button>
            </div>
          </div>
        </section>

        {/* Semantic SEO & FAQ Section */}
        <section className="py-24 bg-gray-50 border-b border-gray-100">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              
              {/* Left Column: Why Choose & How To */}
              <div className="space-y-12">
                <div>
                  <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-6">
                    Why Choose InvoCentric Free GST Billing App?
                  </h2>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-green-100 text-green-700 p-1 rounded-full flex-shrink-0">
                        <Check size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">100% Free Professional Invoicing</h4>
                        <p className="text-sm text-gray-800 mt-1">Generate beautiful GST and non-GST invoices without paying a single rupee. No hidden trial limits or credit card requirements.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-green-100 text-green-700 p-1 rounded-full flex-shrink-0">
                        <Check size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Offline-Ready & Mobile Barcode Scans</h4>
                        <p className="text-sm text-gray-800 mt-1">Directly use your smartphone camera to scan product barcodes. Load items instantly and keep selling even if your internet connection drops.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-green-100 text-green-700 p-1 rounded-full flex-shrink-0">
                        <Check size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Customer Statements & Ledger Sharing</h4>
                        <p className="text-sm text-gray-800 mt-1">Manage customer credit ledger balances seamlessly. Generate and share PDF billing statements directly via WhatsApp or quick prints.</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <hr className="border-gray-200" />

                <div>
                  <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-6">
                    How to Generate Barcode Invoices Offline
                  </h2>
                  <div className="relative border-l border-green-200 pl-6 ml-3 space-y-8">
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                      <h4 className="font-bold text-gray-900 text-sm">Open Scanner & Align Barcode</h4>
                      <p className="text-xs text-gray-700 mt-1">Tap the scanning icon in the InvoCentric app and frame your camera over any retail product barcode.</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                      <h4 className="font-bold text-gray-900 text-sm">Autofill Details Dynamically</h4>
                      <p className="text-xs text-gray-700 mt-1">The application reads the barcode, auto-fills the product name, default rate, and default GST slab automatically.</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                      <h4 className="font-bold text-gray-900 text-sm">Instant Invoice Creation & Print</h4>
                      <p className="text-xs text-gray-700 mt-1">Confirm the transaction, click Create Invoice, and generate a downloadable PDF or print immediately.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Schema-Structured FAQ Section */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full">InvoCentric FAQs</span>
                  <h3 className="text-2xl font-black text-gray-900 mt-3">Frequently Asked Questions</h3>
                  <p className="text-xs text-gray-700 mt-1">Common queries regarding our free billing app and automated features.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100/50">
                    <h4 className="font-bold text-gray-900 text-sm">Is InvoCentric really free?</h4>
                    <p className="text-xs text-gray-700 mt-2 leading-relaxed">Yes! InvoCentric is 100% free with no credit card required. Generate invoices, track client statements, and manage stocks with zero subscriptions.</p>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100/50">
                    <h4 className="font-bold text-gray-900 text-sm">How do I print GST bills offline?</h4>
                    <p className="text-xs text-gray-700 mt-2 leading-relaxed">You can connect any standard thermal printer (2-inch or 3-inch) or laser printer to print GST bills offline directly from your web browser.</p>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100/50">
                    <h4 className="font-bold text-gray-900 text-sm">Can I generate statements with barcode scans?</h4>
                    <p className="text-xs text-gray-700 mt-2 leading-relaxed">Yes. InvoCentric includes a smart barcode scanning tool. Scan any item to add it directly to an invoice, quote, or customer statement ledger instantaneously.</p>
                  </div>
                </div>

                {/* Structured JSON-LD for Search Indexing */}
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                      "@context": "https://schema.org",
                      "@graph": [
                        {
                          "@type": "SoftwareApplication",
                          "@id": "https://vercel.app/#software",
                          "name": "InvoCentric",
                          "operatingSystem": "All",
                          "applicationCategory": "BusinessApplication, AccountingApplication",
                          "offers": {
                            "@type": "Offer",
                            "price": "0",
                            "priceCurrency": "INR"
                          },
                          "description": "Free GST Billing, Invoicing, Mobile Camera Barcode Scanner, and Inventory Management App for small shops and retail stores in India.",
                          "featureList": [
                            "GST and non-GST Invoice Generation",
                            "Live Camera Barcode Scanner integration",
                            "Instant PDF sharing on WhatsApp",
                            "Customer credit credit ledger log",
                            "Inventory Stock Alerts"
                          ]
                        },
                        {
                          "@type": "FAQPage",
                          "@id": "https://vercel.app/#faq",
                          "mainEntity": [
                            {
                              "@type": "Question",
                              "name": "Is InvoCentric really free?",
                              "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "Yes! InvoCentric is 100% free with no credit card required. Generate invoices, track client statements, and manage stocks with zero subscriptions."
                              }
                            },
                            {
                              "@type": "Question",
                              "name": "How do I print GST bills offline?",
                              "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "You can connect any standard thermal printer (2-inch or 3-inch) or laser printer to print GST bills offline directly from your web browser."
                              }
                            },
                            {
                              "@type": "Question",
                              "name": "Can I generate statements with barcode scans?",
                              "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "Yes. InvoCentric includes a smart barcode scanning tool. Scan any item to add it directly to an invoice, quote, or customer statement ledger instantaneously."
                              }
                            }
                          ]
                        }
                      ]
                    })
                  }}
                />
              </div>

            </div>
          </div>
        </section>

        {/* Customer Reviews with Balanced Spacing */}
        <section className="py-24 bg-white">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="text-center mb-16">
              <span className="text-xs font-extrabold uppercase tracking-widest text-green-600">Merchant Reviews</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mt-3">Loved by Shop Owners</h2>
              <p className="text-gray-500 mt-2">See why retail outlets, distributors and service providers trust InvoCentric.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { name: "Rahul Patel", shop: "Mobile Hub (Gujarat)", review: "InvoCentric has completely simplified my mobile billing. The thermal receipt format matches professional GST accounting styles. Printing is instant!" },
                { name: "Suresh Gupta", shop: "Gupta Kirana & General Store", review: "The WhatsApp invoice function is great. Customers love getting a clean PDF receipt directly on their phones. Saves paper!" },
                { name: "Anjali Mehta", shop: "Style Studio Boutiques", review: "Inventory alerts work beautifully. Now I can track low stock of dress materials and calculate correct GST and CGST without errors." }
              ].map((testimonial, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl p-8 border border-gray-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-yellow-500 mb-6">
                      {[1,2,3,4,5].map(st => <Star key={st} size={16} fill="currentColor" />)}
                    </div>
                    <p className="text-gray-600 italic text-sm leading-relaxed">"{testimonial.review}"</p>
                  </div>
                  <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm">
                      {testimonial.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{testimonial.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{testimonial.shop}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-slate-50/60 border-b border-gray-100 relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-green-700 bg-green-50 px-4 py-1.5 rounded-full border border-green-200/80 shadow-sm">
                <Sparkles size={13} className="text-green-600" /> Transparent Business Pricing
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mt-4">
                Choose the Right Plan for Your Business
              </h2>
              <p className="text-slate-600 mt-3.5 text-base md:text-lg">
                Start 100% free with zero hidden charges. Upgrade when you need advanced AI scanning, POS, and full exports.
              </p>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex justify-center mb-12">
              <div className="bg-slate-150/85 bg-slate-100 p-1.5 rounded-2xl inline-flex items-center gap-1 border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setLandingBillingCycle('monthly')}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                    landingBillingCycle === 'monthly' ? "bg-[#166534] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Monthly billing
                </button>
                <button
                  type="button"
                  onClick={() => setLandingBillingCycle('yearly')}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                    landingBillingCycle === 'yearly' ? "bg-[#166534] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Yearly billing
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-md font-extrabold leading-none uppercase tracking-wide",
                    landingBillingCycle === 'yearly' ? "bg-white/20 text-white" : "bg-[#F0FDF4] text-[#166534]"
                  )}>
                    Save 16%
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 max-w-4xl mx-auto items-stretch pt-2">
              
              {/* FREE PLAN */}
              <motion.div 
                whileHover={{ y: -6 }}
                className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-xl relative flex flex-col justify-between hover:shadow-2xl transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-3 mt-1">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 leading-none">Free Plan</h3>
                      <p className="text-xs text-slate-400 font-bold mt-1">Forever Free</p>
                    </div>
                    {user && (!planTier || planTier === 'free') && (
                      <span className="px-3 py-1 bg-green-50 text-green-700 font-bold text-xs rounded-full border border-green-200/80">Active Plan</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Essential features for self-employed professionals, freelancers and new retail shops.
                  </p>
                  
                  <div className="flex items-baseline gap-1.5 mb-8 pb-6 border-b border-slate-100">
                    <span className="text-5xl font-black text-slate-900 tracking-tight">₹0</span>
                    <span className="text-slate-500 text-sm font-bold">/ forever free</span>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Invoices, Quotations: Unlimited (manual entry)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Customers/Parties: Up to 25-30</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Items/Inventory: Up to 50 items</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Payments & Daily Book: Full access</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Reports: Basic (This Month view only, no export)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Users: 1 (owner only)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Watermark: None</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-200/50">
                        <X size={11} strokeWidth={3} />
                      </div>
                      <span className="line-through">AI Scan Bill</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-200/50">
                        <X size={11} strokeWidth={3} />
                      </div>
                      <span className="line-through">Quick POS</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-200/50">
                        <X size={11} strokeWidth={3} />
                      </div>
                      <span className="line-through">Export (Daily Export/Excel/PDF)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-200/50">
                        <X size={11} strokeWidth={3} />
                      </div>
                      <span className="line-through">QR Generator</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (user) {
                      navigate('/dashboard');
                    } else {
                      navigate('/login');
                    }
                  }}
                  className="w-full py-4 rounded-xl bg-green-600 text-white font-extrabold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  {user && (!planTier || planTier === 'free') ? "Your Current Plan" : "Get Started Free"}
                  <ArrowRight size={16} />
                </button>
              </motion.div>

              {/* PREMIUM PRO PLAN */}
              <motion.div 
                whileHover={{ y: -6 }}
                className="bg-white rounded-3xl p-8 md:p-10 border-2 border-[#166534] shadow-xl shadow-green-600/5 relative flex flex-col justify-between hover:shadow-2xl hover:shadow-green-600/10 transition-all duration-300"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#166534] text-white text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                  <Sparkles size={12} className="text-white" /> MOST POPULAR
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3 mt-1">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 leading-none">Pro Plan</h3>
                      <p className="text-xs text-[#166534] font-bold mt-1">Advanced Business</p>
                    </div>
                    {user && planTier === 'pro' && (
                      <span className="px-3 py-1 bg-green-50 text-green-700 font-bold text-xs rounded-full border border-green-200">Active Pro</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Designed for growing businesses, retail storefronts, and premium AI automation tools.
                  </p>
                  
                  <div className="mb-8 pb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-[#166534] tracking-tight">
                        {landingBillingCycle === 'monthly' ? "₹199" : "₹1,999"}
                      </span>
                      <span className="text-slate-500 text-sm font-bold">
                        / {landingBillingCycle === 'monthly' ? "month" : "year"}
                      </span>
                    </div>
                    {landingBillingCycle === 'yearly' && (
                      <div className="mt-2 text-xs font-extrabold text-[#166534] bg-[#F0FDF4] py-1 px-3 rounded-md inline-block">
                        Save ₹388 — 2 months free
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Everything in Free (Unlimited customers/items)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>AI Scan Bill (OCR invoice scan): Unlimited scans</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Quick POS mode</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Advanced Reports (Revenue trends, custom dates, comparison)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Daily Export (Excel/PDF export)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>QR Generator</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Shop Mode / Freelancer Mode toggle</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Multi-device cloud sync</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Overdue/reminder alerts (auto payment reminders)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200/80">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span>Priority support (WhatsApp/chat)</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => navigate('/pricing')}
                  className="w-full py-4 rounded-xl bg-[#166534] hover:bg-[#0F3D21] text-white font-extrabold text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 animate-pulse"
                >
                  {user && planTier === 'pro' ? "Active Pro Plan" : "Upgrade to Pro"}
                  <Sparkles size={16} className="text-green-300" />
                </button>
              </motion.div>

            </div>

            {/* Bottom Trust Row */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-12 text-slate-500 text-xs font-extrabold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                No Credit Card Required
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                100% Free Forever Plan
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Instant Setup in 30 Seconds
              </div>
            </div>
          </div>
        </section>

        {/* Blog & Resources Showcase Section */}
        <section id="blog" className="py-24 bg-white border-t border-gray-100 relative overflow-hidden">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-100 text-green-700 text-xs font-bold uppercase tracking-wider mb-4">
                  <BookOpen size={14} className="text-green-600" />
                  Knowledge Hub & Guides
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                  Latest Growth Guides for <br className="hidden md:block"/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
                    Indian Small Business Owners
                  </span>
                </h2>
              </div>
              <button
                onClick={() => navigate('/blog')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer self-start md:self-auto"
              >
                <span>View All Articles</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Grid of Blog Posts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.values(BLOG_POSTS).slice(0, 3).map((post) => (
                <motion.article
                  key={post.slug}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-green-300 transition-all cursor-pointer flex flex-col group"
                >
                  <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      {post.category}
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 text-xs text-gray-700 font-medium mb-3">
                        <span>{post.date}</span>
                        <span>•</span>
                        <span>{post.readTime}</span>
                      </div>
                      <h3 className="text-xl font-extrabold text-gray-900 mb-3 group-hover:text-green-600 transition-colors leading-snug line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed mb-6 font-normal">
                        {post.subtitle}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-green-600 text-sm font-bold group-hover:translate-x-1 transition-transform">
                      <span>Read Full Guide</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>

            <div className="mt-12 text-center">
              <button
                onClick={() => navigate('/blog')}
                className="px-8 py-3.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-sm font-bold rounded-full transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95"
              >
                <BookOpen size={16} />
                <span>Explore All InvoCentric Blogs & SEO Guides</span>
              </button>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-gray-50">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">Got questions? We have answers.</h2>
              <p className="text-gray-600">Everything you need to know about getting started with InvoCentric.</p>
            </div>
            
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div 
                  key={i} 
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all duration-200 hover:border-green-200"
                >
                  <button 
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="font-bold text-gray-900 pr-8">{faq.q}</span>
                    <div className={`w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180 bg-green-50 text-green-600' : 'text-gray-500'}`}>
                      <ChevronDown size={18} />
                    </div>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 pt-0 text-gray-600 leading-relaxed border-t border-gray-50">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Big CTA */}
        <section className="py-24 bg-green-900 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
             <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-800 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 opacity-50" />
             <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-800 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3 opacity-50" />
          </div>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight">Ready to transform your billing?</h2>
              <p className="text-xl text-green-100 mb-10 max-w-2xl mx-auto font-medium">
                Join thousands of businesses across India using InvoCentric to manage their daily operations.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button 
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white text-green-900 text-lg font-bold rounded-full hover:bg-green-50 transition-all active:scale-95 shadow-xl shadow-white/10"
                >
                  Start Billing for Free
                </button>
              </div>
              <p className="mt-8 text-sm text-green-200/60 font-bold uppercase tracking-widest">Takes 30 seconds to setup. No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      {/* -------------------- UPDATED FOOTER SECTION (SOCIALS REMOVED, ALL WORKING LINKS) -------------------- */}
      <footer className="border-t border-gray-900 bg-[#0a0a0f] text-gray-300 py-16">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            
            {/* Brand Logo & Contact details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Logo size={32} className="text-white" />
                <span className="font-brand text-2xl tracking-tight text-white">
                  <span className="font-extrabold">Invo</span><span className="font-bold">Centric</span>
                </span>
              </div>
              
              <div className="space-y-4">
                <a 
                  href="https://wa.me/919824194869?text=Hello%20InvoCentric%20Support,%20I%20have%20a%20question..." 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-start gap-3 text-white hover:text-emerald-300 transition-colors group cursor-pointer"
                >
                  <Phone className="w-5 h-5 text-emerald-400 group-hover:scale-110 mt-0.5 flex-shrink-0 transition-transform" />
                  <span className="text-sm font-semibold">WhatsApp & Support Phone: +91 98241 94869</span>
                </a>
                <a 
                  href="mailto:support@invocentric.in?subject=InvoCentric%20Inquiry" 
                  className="flex items-start gap-3 text-white hover:text-emerald-300 transition-colors group cursor-pointer"
                >
                  <Mail className="w-5 h-5 text-emerald-400 group-hover:scale-110 mt-0.5 flex-shrink-0 transition-transform" />
                  <span className="text-sm font-semibold">Email: support@invocentric.in</span>
                </a>
                <a 
                  href="https://invocentric.in" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-start gap-3 text-white hover:text-emerald-300 transition-colors group cursor-pointer"
                >
                  <Globe className="w-5 h-5 text-emerald-400 group-hover:scale-110 mt-0.5 flex-shrink-0 transition-transform" />
                  <span className="text-sm font-semibold">Website: www.invocentric.in</span>
                </a>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-semibold text-white leading-relaxed">Patan Gujarat India</span>
                </div>
              </div>
            </div>

            {/* Fully Functional Quick Links Column */}
            <div className="space-y-6">
              <h3 className="text-white text-lg font-bold mb-4">Billing Solutions</h3>
              <ul className="space-y-3">
                <li><Link to="/invoice-software" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Invoice Software</Link></li>
                <li><Link to="/free-invoice-maker" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Free Invoice Maker</Link></li>
                <li><Link to="/gst-billing-software" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">GST Billing Software</Link></li>
                <li><Link to="/gst-invoice-maker" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">GST Invoice Maker</Link></li>
                <li><Link to="/pos-billing-software" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Retail POS Billing</Link></li>
                <li><Link to="/quotation-maker" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Quotation Maker</Link></li>
              </ul>
            </div>

            {/* Fully Functional Tools Column */}
            <div className="space-y-6">
              <h3 className="text-white text-lg font-bold mb-4">Tools & Inventory</h3>
              <ul className="space-y-3">
                <li><Link to="/gst-calculator" className="text-sm text-left text-emerald-400 hover:text-emerald-300 transition-colors font-bold flex items-center gap-1.5"><span>Free GST Calculator</span> <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-black uppercase">Free Tool</span></Link></li>
                <li><Link to="/barcode-billing" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Barcode Billing & Labels</Link></li>
                <li><Link to="/inventory-management" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Inventory & Live Stock</Link></li>
                <li><Link to="/ledger-software" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Customer Khata Ledger</Link></li>
                <li><button onClick={() => setIsGstinOpen(true)} className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors cursor-pointer font-medium">Find GSTIN Number</button></li>
                <li><button onClick={() => setIsHsnOpen(true)} className="text-sm text-left text-green-300 hover:text-green-400 font-semibold transition-colors cursor-pointer">HSN / SAC Code Directory</button></li>
                <li><Link to="/blog" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">GST Knowledge Base</Link></li>
              </ul>
            </div>

            {/* Popular Solutions and Compliance */}
            <div className="space-y-6">
               <h3 className="text-white text-lg font-bold mb-4">About &amp; Policies</h3>
               <ul className="space-y-3">
                <li><button onClick={() => setIsAboutOpen(true)} className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors cursor-pointer font-medium">About InvoCentic</button></li>
                <li><button onClick={() => setIsWhyInvoCentricOpen(true)} className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors cursor-pointer font-medium">Why InvoCentic</button></li>
                <li><button onClick={() => setIsSupportOpen(true)} className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors cursor-pointer font-medium">Customer Support</button></li>
                <li><Link to="/terms#privacy" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Privacy Policy</Link></li>
                <li><Link to="/terms#terms" className="text-sm text-left text-gray-400 hover:text-green-400 transition-colors font-medium">Terms of Service</Link></li>
               </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
             <p className="text-xs font-medium">© 2026 InvoCentric Invoicing. All rights reserved.</p>
             <div className="flex items-center gap-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Built for the modern shop owner</span>
             </div>
          </div>
        </div>
      </footer>

      {/* Floating Support Chat Button */}
      <motion.div 
        drag 
        dragConstraints={{ left: -300, right: 0, top: -500, bottom: 0 }}
        dragMomentum={false} 
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[60] group/support cursor-grab active:cursor-grabbing"
      >
        <div className="absolute bottom-16 md:bottom-20 right-0 px-4 py-2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl opacity-0 translate-y-2 group-hover/support:opacity-100 group-hover/support:translate-y-0 transition-all duration-300 whitespace-nowrap pointer-events-none shadow-2xl">
          Need Help?
          <div className="absolute bottom-[-4px] right-6 md:right-8 rotate-45 w-2 h-2 bg-gray-900" />
        </div>

        <motion.button
          onClick={() => setIsSupportOpen(true)}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Contact Customer Support"
          className="w-12 h-12 md:w-16 md:h-16 bg-[#0B524E] text-white rounded-2xl shadow-2xl shadow-[#0B524E]/30 flex items-center justify-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[#0B524E] rounded-2xl animate-ping opacity-20 group-hover/support:opacity-0" />
          <WhatsAppIcon size={28} className="relative z-10" />
        </motion.button>
      </motion.div>

      {/* -------------------- INTERACTIVE SYSTEM MODALS -------------------- */}
      <AnimatePresence>
        {/* 1. Support Chat Modal */}
        {isSupportOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSupportOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 text-center border border-gray-100">
              <button 
                type="button"
                onClick={() => setIsSupportOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close support dialog"
              >
                <X size={18} />
              </button>

              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <WhatsAppIcon size={36} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Customer Support</h3>
              <p className="text-gray-500 text-sm mb-6">Get live, expert help regarding thermal layouts, GST configs, and invoice imports.</p>
                
              <div className="space-y-3">
                <a 
                  href="https://wa.me/919824194869?text=Hello%20InvoCentric%20Support,%20I%20need%20help%20with%20InvoCentric%20Billing%20Software"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] rounded-2xl border border-slate-800 hover:border-emerald-500/50 text-white transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 group-hover:bg-emerald-600 rounded-xl flex items-center justify-center text-emerald-400 group-hover:text-white transition-all shadow-sm">
                      <WhatsAppIcon size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">WhatsApp Support</p>
                      <p className="text-[11px] text-slate-300 font-medium">+91 98241 94869</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </a>

                <a 
                  href="mailto:support@invocentric.in?subject=InvoCentric%20Customer%20Support%20Request"
                  className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] rounded-2xl border border-slate-800 hover:border-green-500/50 text-white transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 group-hover:bg-green-600 rounded-xl flex items-center justify-center text-green-400 group-hover:text-white transition-all shadow-sm">
                      <Mail size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white group-hover:text-green-400 transition-colors">Email Support</p>
                      <p className="text-[11px] text-slate-300 font-medium">support@invocentric.in</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-slate-500 group-hover:text-green-400 transition-colors" />
                </a>

                <a 
                  href="https://invocentric.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] rounded-2xl border border-slate-800 hover:border-blue-500/50 text-white transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 group-hover:bg-blue-600 rounded-xl flex items-center justify-center text-blue-400 group-hover:text-white transition-all shadow-sm">
                      <Globe size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Website</p>
                      <p className="text-[11px] text-slate-300 font-medium">www.invocentric.in</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                </a>
              </div>

              <button 
                type="button"
                onClick={() => setIsSupportOpen(false)} 
                className="mt-6 w-full py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] rounded-xl text-xs font-bold text-slate-700 uppercase tracking-widest transition-all cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}

        {/* 2. About Us Modal */}
        {isAboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAboutOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 border border-gray-100">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-6">
                <Store size={24} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-4">About InvoCentric</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4 font-medium">
                InvoCentric was built in **Patan, Gujarat, India** to serve and empower local merchants, shop owners, and freelance service providers. 
              </p>
              <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium">
                Our vision is to deliver 100% free, robust, cloud-synchronized, and offline-compatible invoicing software that doesn't restrict small merchants with paywalls or forced credit card logins. We represent the digital future of traditional Indian retail.
              </p>
              <button onClick={() => setIsAboutOpen(false)} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Understood</button>
            </motion.div>
          </div>
        )}

        {/* 3. Verify GSTIN Tool Modal */}
        {isGstinOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGstinOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 border border-gray-100">
              <h3 className="text-2xl font-black text-gray-900 mb-2">Offline GSTIN Verifier</h3>
              <p className="text-gray-500 text-xs mb-6">Validate Indian GST registration number formats, decode PAN card numbers, and identify registered states instantly.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1.5">Enter 15-Digit GSTIN</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={gstinQuery}
                      onChange={(e) => setGstinQuery(e.target.value)}
                      placeholder="e.g. 24AAACC1206D1Z5"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:border-green-500 focus:bg-white uppercase tracking-wider"
                    />
                    <button onClick={handleValidateGstin} className="px-5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Verify</button>
                  </div>
                  {gstinError && <p className="text-xs font-bold text-rose-500 mt-2">{gstinError}</p>}
                </div>

                {gstinResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50/50 border border-green-100 rounded-2xl p-4 font-medium text-xs space-y-2.5">
                    <div className="flex justify-between border-b border-green-100/50 pb-2">
                      <span className="text-gray-500">Legal Business Name</span>
                      <span className="text-gray-900 font-bold">{gstinResult.legalName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Registered State</span>
                      <span className="text-green-700 font-black">{gstinResult.state}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">PAN Card Number</span>
                      <span className="text-gray-900 font-bold tracking-wider">{gstinResult.pan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Taxpayer Registry</span>
                      <span className="text-gray-900 font-bold">{gstinResult.type}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-green-100/50">
                      <span className="text-gray-500">GST Status</span>
                      <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[9px] font-black">{gstinResult.status}</span>
                    </div>
                  </motion.div>
                )}
              </div>

              <button onClick={() => { setIsGstinOpen(false); setGstinResult(null); setGstinQuery(''); setGstinError(''); }} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Close Tool</button>
            </motion.div>
          </div>
        )}

        {/* 4. HSN/SAC Codes Finder Modal */}
        {isHsnOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHsnOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 border border-gray-100 max-h-[85vh] flex flex-col">
              <h3 className="text-2xl font-black text-gray-900 mb-1">HSN/SAC Code Directory</h3>
              <p className="text-gray-700 text-xs mb-5">Search common product categories to find corresponding Harmonized System Nomenclature codes and GST percentages.</p>
              
              <div className="mb-4">
                <input 
                  type="text"
                  value={hsnQuery}
                  onChange={(e) => handleSearchHsn(e.target.value)}
                  placeholder="Search item, e.g. Mobile, Grocery, Medicines..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:border-green-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-6">
                {hsnResults.length > 0 ? (
                  hsnResults.map((item, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-gray-900 text-white rounded font-mono text-xs font-bold">{item.code}</span>
                          <span className="font-bold text-gray-800 text-sm">{item.category}</span>
                        </div>
                        <p className="text-gray-500 text-[10px] mt-1 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-black shrink-0">{item.gst}% GST</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-gray-500 py-8">No matching categories found.</p>
                )}
              </div>

              <button onClick={() => { setIsHsnOpen(false); setHsnQuery(''); setHsnResults(COMMON_HSN_CODES); }} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Close Directory</button>
            </motion.div>
          </div>
        )}

        {/* 5. Tally XML Converter Modal */}
        {isTallyOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTallyOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 border border-gray-100 text-center">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileText size={24} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-1">Standard XML Ledger Converter</h3>
              <p className="text-gray-700 text-xs mb-6">Upload your Excel, CSV or Text billing log spreadsheet, and instantly download a standard ERP & CA-compliant XML ledger import file.</p>
              
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 mb-6 hover:border-green-500 transition-colors relative cursor-pointer group">
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.txt" 
                  onChange={handleTallyUpload} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload size={24} className="text-gray-500 mx-auto mb-2 group-hover:text-green-600 transition-colors" />
                <p className="text-xs font-bold text-gray-700 group-hover:text-green-600 transition-colors">
                  {tallyFile ? tallyFile : 'Drag and drop your sales file here or click to select'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Supports Excel (.xlsx), CSV, Text logs</p>
              </div>

              {tallyProgress >= 0 && (
                <div className="mb-6 bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-gray-600">
                    <span>{tallyProgress < 100 ? 'Compiling XML Ledger Schema...' : 'Compilation Success!'}</span>
                    <span>{tallyProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full transition-all duration-300" style={{ width: `${tallyProgress}%` }} />
                  </div>
                  
                  {tallyProgress === 100 && (
                    <button 
                      onClick={handleDownloadTallyXml}
                      className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors animate-fadeIn"
                    >
                      <Download size={14} /> Download Standard XML File
                    </button>
                  )}
                </div>
              )}

              <button onClick={() => { setIsTallyOpen(false); setTallyFile(null); setTallyProgress(-1); }} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Close Converter</button>
            </motion.div>
          </div>
        )}

        {/* 6. GST Blogs Modal */}
        {isBlogsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBlogsOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 border border-gray-100 max-h-[85vh] flex flex-col">
              <h3 className="text-2xl font-black text-gray-900 mb-1">GST & Invoicing Knowledge Base</h3>
              <p className="text-gray-500 text-xs mb-6">Expert guidance and optimization tips curated for Indian small retail shopkeepers.</p>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-6">
                {[
                  { title: "Understanding SGST, CGST, and IGST for Inter-State Sales", text: "When you sell items to a customer within your state, apply SGST & CGST (split 50-50). If selling to a customer outside of your state boundaries, apply Integrated GST (IGST) in full. InvoCentric handles this selection automatically!" },
                  { title: "Choosing the Best Thermal Printer: 2-inch vs 3-inch Layouts", text: "2-inch (58mm) printers are perfect for compact billing counters like juice bars or small snack corners. 3-inch (80mm) POS printers are standard for grocery outlets and supermarkets as they print descriptive item headers cleanly." },
                  { title: "What is HSN Code and is it Mandatory for Retail Vyapar?", text: "HSN (Harmonized System of Nomenclature) is standard. For small merchants with turnover under ₹5 Crores, HSN codes are not strictly mandatory on B2C receipts, but adding a 4-digit HSN code makes your trade records extremely clean and audit-ready." }
                ].map((article, index) => (
                  <div key={index} className="p-5 bg-gray-50 border border-gray-100 rounded-xl text-left">
                    <h4 className="font-bold text-gray-900 text-sm mb-1.5">{article.title}</h4>
                    <p className="text-gray-700 text-xs leading-relaxed font-medium">{article.text}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => setIsBlogsOpen(false)} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Close Blogs</button>
            </motion.div>
          </div>
        )}

        {/* 7. Why InvoCentric Modal */}
        {isWhyInvoCentricOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWhyInvoCentricOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 border border-gray-100">
              <h3 className="text-2xl font-black text-gray-900 mb-2">Why Choose InvoCentric?</h3>
              <p className="text-gray-700 text-xs mb-6">Discover the core values that make InvoCentric India's premium invoicing standard.</p>
              
              <div className="space-y-4 mb-6 text-left font-medium text-xs text-gray-600">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-green-50 text-green-600 flex items-center justify-center font-bold shrink-0">1</div>
                  <p><strong>100% Free:</strong> No hidden payments, no forced premium subscriptions, and no trial limits.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-green-50 text-green-600 flex items-center justify-center font-bold shrink-0">2</div>
                  <p><strong>Offline First:</strong> Your database resides on your browser, so you can continue billing 24/7 without internet.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-green-50 text-green-600 flex items-center justify-center font-bold shrink-0">3</div>
                  <p><strong>Automatic Sync:</strong> When online, your records are automatically backed up securely to the cloud database.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-green-50 text-green-600 flex items-center justify-center font-bold shrink-0">4</div>
                  <p><strong>Tally Compliant:</strong> Fully structured ledger layout which makes Tally accounting imports completely seamless.</p>
                </div>
              </div>

              <button onClick={() => setIsWhyInvoCentricOpen(false)} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Done</button>
            </motion.div>
          </div>
        )}

        {/* 8. Careers Modal */}
        {isCareersOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCareersOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 border border-gray-100 text-center">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users size={24} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">We Are Open-Source!</h3>
              <p className="text-gray-700 text-sm mb-6 leading-relaxed">
                InvoCentric is developed as a free, 100% open-source software project. We welcome developer contributions, translation assistance and bug reports.
              </p>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6">
                <p className="text-xs font-bold text-gray-700 mb-1">GitHub Contribution Core</p>
                <p className="text-[10px] text-gray-500">Join our open repository, fork the code, or build new localized thermal themes!</p>
              </div>
              <button onClick={() => setIsCareersOpen(false)} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Join Community</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
