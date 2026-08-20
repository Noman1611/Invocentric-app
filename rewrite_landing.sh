#!/bin/bash
cat << 'INNER_EOF' > src/pages/LandingPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import {
  Zap, ShieldCheck, BarChart3, Smartphone, ChevronRight, Sparkles,
  ArrowRight, Calculator, History, Users, Check, Minus, ChevronDown, ChevronUp,
  Star, HelpCircle, Store, Package, QrCode, FileText, Landmark, MessageSquare,
  AlertTriangle, Printer, Shield, Award, TrendingUp, Heart, Clock, Coins,
  Facebook, Twitter, Instagram, Linkedin, MapPin, Phone, Mail, Receipt,
  PieChart, Activity, Globe, Download, Send, RefreshCw, SmartphoneNfc
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FADE_UP = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20 } },
};

const STAGGER = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const TickerItem = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-xl font-black text-gray-400 mx-8 whitespace-nowrap">
    {children}
  </div>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  
  // SEO Tool: GST Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(10000);
  const [calcGstRate, setCalcGstRate] = useState<number>(18);
  const [calcIsGstInclusive, setCalcIsGstInclusive] = useState<boolean>(false);
  
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 400]);
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

  const faqs = [
    {
      q: "Is BillCraft suitable for mobile shops and retail stores?",
      a: "Yes! BillCraft is perfectly optimized for mobile repair shops, electronics, grocery, and general retail stores. It supports fast billing and thermal printing."
    },
    {
      q: "Can I share invoices on WhatsApp?",
      a: "Absolutely. You can generate a professional PDF invoice and share it directly with your customers via WhatsApp in just one click."
    },
    {
      q: "Is it completely free?",
      a: "BillCraft offers a generous free tier that covers the needs of most small businesses, including unlimited basic invoicing and thermal printing."
    },
    {
      q: "Is my shop data secure?",
      a: "Yes, we use industry-standard encryption. Your data is stored securely in the cloud and is automatically backed up."
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-teal-500/30 overflow-x-hidden text-gray-900">
      
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          scrolled ? 'bg-white/80 backdrop-blur-xl border-gray-200 shadow-sm py-3' : 'bg-transparent border-transparent py-5'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
              <div className="bg-teal-600 text-white p-2 rounded-xl group-hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20">
                <Logo size={24} />
              </div>
              <span className="text-2xl font-black tracking-tight">BillCraft</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 bg-white/50 backdrop-blur-md px-8 py-3 rounded-full border border-gray-200/50 shadow-sm">
               <a href="#features" className="text-sm font-bold text-gray-600 hover:text-teal-600 transition-colors">Features</a>
               <a href="#how-it-works" className="text-sm font-bold text-gray-600 hover:text-teal-600 transition-colors">How it Works</a>
               <a href="#tools" className="text-sm font-bold text-gray-600 hover:text-teal-600 transition-colors">Free Tools</a>
               <a href="#faq" className="text-sm font-bold text-gray-600 hover:text-teal-600 transition-colors">FAQ</a>
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
                    className="hidden lg:block px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold rounded-full hover:shadow-lg hover:shadow-teal-500/30 transition-all active:scale-95 flex items-center gap-2"
                  >
                    Start Free
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      <main>
        {/* Animated Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden min-h-[90vh] flex items-center">
          {/* Background Ambient Glows */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
             <motion.div style={{ y: heroY }} className="absolute w-[800px] h-[800px] rounded-full bg-teal-200/40 blur-[120px] -top-1/4 -right-1/4" />
             <motion.div style={{ y: heroY }} className="absolute w-[600px] h-[600px] rounded-full bg-blue-200/30 blur-[100px] top-1/4 -left-1/4" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-8">
              
              {/* Left Copy */}
              <motion.div 
                className="w-full lg:w-[55%]"
                variants={STAGGER}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={FADE_UP} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm text-gray-800 text-xs font-bold uppercase tracking-widest mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                  </span>
                  India's #1 Free Billing App
                </motion.div>
                
                <motion.h1 variants={FADE_UP} className="text-5xl md:text-7xl lg:text-[80px] font-black text-gray-900 tracking-tighter leading-[1.05] mb-6">
                  Smart Billing for <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-800">
                    Faster Growth.
                  </span>
                </motion.h1>
                
                <motion.p variants={FADE_UP} className="text-lg md:text-xl text-gray-600 mb-10 max-w-xl leading-relaxed font-medium">
                  Create professional GST invoices in 10 seconds, manage inventory, send bills via WhatsApp, and print thermal receipts seamlessly.
                </motion.p>
                
                <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center gap-4">
                  <button 
                    onClick={() => navigate('/login')}
                    className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white text-base font-bold rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group active:scale-95 shadow-xl shadow-gray-900/20"
                  >
                    Start Free Trial
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                     onClick={() => {
                        const el = document.getElementById('tools');
                        el?.scrollIntoView({ behavior: 'smooth' });
                     }}
                    className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border-2 border-gray-200 text-base font-bold rounded-full hover:border-teal-500 hover:text-teal-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                  >
                    <Calculator size={20} />
                    Explore Free Tools
                  </button>
                </motion.div>

                <motion.div variants={FADE_UP} className="mt-12 flex items-center gap-6 text-sm font-bold text-gray-500">
                  <div className="flex items-center gap-2"><Check size={18} className="text-teal-500"/> No credit card</div>
                  <div className="flex items-center gap-2"><Check size={18} className="text-teal-500"/> 100% Secure</div>
                  <div className="flex items-center gap-2 flex-col sm:flex-row">
                     <div className="flex -space-x-2">
                        {[1,2,3,4].map(i => <div key={i} className={`w-6 h-6 rounded-full border-2 border-white bg-gray-${i*200} flex items-center justify-center overflow-hidden`}><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}&backgroundColor=e2e8f0`} alt="User" /></div>)}
                     </div>
                     <span className="text-xs">Trusted by 50k+ shops</span>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right Floating Dashboard UI */}
              <motion.div 
                className="w-full lg:w-[45%] relative h-[400px] md:h-[500px]"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.2, type: "spring" }}
                style={{ opacity: heroOpacity }}
              >
                {/* Main floating card */}
                <motion.div 
                  animate={{ y: [0, -15, 0] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                  className="absolute top-10 right-0 left-10 md:left-20 bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-20 backdrop-blur-xl bg-white/90"
                >
                  <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600">
                           <Store size={24} />
                        </div>
                        <div>
                           <div className="text-sm font-bold text-gray-900">TechMart Electronics</div>
                           <div className="text-xs text-gray-500 font-medium">GSTIN: 24AAACC1206D1Z</div>
                        </div>
                     </div>
                     <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-wider">Online</div>
                  </div>
                  
                  <div className="space-y-4">
                     <div className="flex justify-between items-end">
                        <div>
                           <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Today's Sales</div>
                           <div className="text-3xl font-black text-gray-900">₹45,200</div>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-500 text-sm font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                           <TrendingUp size={16} /> +12.5%
                        </div>
                     </div>

                     <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-4">
                        <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: "75%" }}
                           transition={{ duration: 1.5, delay: 0.5 }}
                           className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full" 
                        />
                     </div>
                  </div>
                </motion.div>

                {/* Floating Invoice Toast */}
                <motion.div 
                  animate={{ y: [0, 10, 0], x: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-10 left-0 bg-gray-900 text-white rounded-2xl shadow-2xl p-4 z-30 flex items-center gap-4 w-[280px]"
                >
                   <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                      <Send size={20} />
                   </div>
                   <div>
                      <div className="text-sm font-bold">Invoice Shared</div>
                      <div className="text-xs text-gray-400 font-medium">INV-2401 sent via WhatsApp</div>
                   </div>
                </motion.div>

                {/* Floating Printer Icon */}
                <motion.div 
                  animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 2 }}
                  className="absolute top-0 right-10 w-16 h-16 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center text-gray-800 z-10"
                >
                   <Printer size={28} />
                </motion.div>

              </motion.div>

            </div>
          </div>
        </section>

        {/* Infinite Marquee Social Proof */}
        <section className="py-10 bg-white border-y border-gray-200 overflow-hidden relative">
           <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
           <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />
           
           <div className="flex w-[200%] animate-marquee">
              <div className="flex flex-1 justify-around items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                 <TickerItem><Store /> RETAIL PRO</TickerItem>
                 <TickerItem><Smartphone /> MOBILE HUB</TickerItem>
                 <TickerItem><Package /> MEGA MART</TickerItem>
                 <TickerItem><Activity /> PHARMA CARE</TickerItem>
                 <TickerItem><Zap /> QUICK BITE</TickerItem>
              </div>
              <div className="flex flex-1 justify-around items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                 <TickerItem><Store /> RETAIL PRO</TickerItem>
                 <TickerItem><Smartphone /> MOBILE HUB</TickerItem>
                 <TickerItem><Package /> MEGA MART</TickerItem>
                 <TickerItem><Activity /> PHARMA CARE</TickerItem>
                 <TickerItem><Zap /> QUICK BITE</TickerItem>
              </div>
           </div>
        </section>

        {/* Bento Grid Core Features (SEO Targets) */}
        <section id="features" className="py-32 bg-gray-50 relative">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight mb-6">Designed for Indian Retail.</h2>
              <p className="text-xl text-gray-600 font-medium">Everything you need to automate your shop, save time, and look professional to your customers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 max-w-6xl mx-auto h-auto md:h-[600px]">
               
               {/* Feature 1: Large Bento */}
               <motion.div 
                 whileHover={{ y: -5, scale: 1.01 }}
                 className="md:col-span-2 md:row-span-1 bg-white rounded-[32px] p-8 shadow-sm border border-gray-200 overflow-hidden relative group hover:shadow-xl transition-all duration-300"
               >
                  <div className="relative z-10 w-full md:w-2/3 h-full flex flex-col justify-center">
                     <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                        <Send size={28} />
                     </div>
                     <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">WhatsApp Invoicing</h3>
                     <p className="text-gray-600 text-lg leading-relaxed font-medium">Ditch the paper. Generate beautiful PDF invoices and send them directly to your customer's WhatsApp in one click.</p>
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 opacity-5 group-hover:opacity-10 group-hover:-translate-x-8 transition-all duration-700">
                     <MessageSquare size={250} />
                  </div>
               </motion.div>

               {/* Feature 2: Tall Bento */}
               <motion.div 
                 whileHover={{ y: -5, scale: 1.01 }}
                 className="md:col-span-1 md:row-span-2 bg-gray-900 rounded-[32px] p-8 shadow-xl overflow-hidden relative group text-white hover:shadow-2xl transition-all duration-300 flex flex-col"
               >
                  <div className="relative z-10 flex-1 flex flex-col">
                     <div className="w-14 h-14 bg-gray-800 text-teal-400 rounded-2xl flex items-center justify-center mb-6 border border-gray-700 shadow-inner">
                        <Printer size={28} />
                     </div>
                     <h3 className="text-3xl font-black mb-4 tracking-tight">Thermal Printing</h3>
                     <p className="text-gray-400 text-lg leading-relaxed font-medium mb-8">Lightning-fast billing for busy counters. Built-in native support for 2-inch and 3-inch POS thermal printers.</p>
                     
                     <div className="mt-auto bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-3">
                        <div className="flex items-center gap-3"><Check size={16} className="text-teal-400"/> <span>Customizable Layouts</span></div>
                        <div className="flex items-center gap-3"><Check size={16} className="text-teal-400"/> <span>Auto Paper Cut</span></div>
                        <div className="flex items-center gap-3"><Check size={16} className="text-teal-400"/> <span>Logo Support</span></div>
                     </div>
                  </div>
               </motion.div>

               {/* Feature 3: Small Bento */}
               <motion.div 
                 whileHover={{ y: -5, scale: 1.01 }}
                 className="md:col-span-1 md:row-span-1 bg-white rounded-[32px] p-8 shadow-sm border border-gray-200 overflow-hidden relative group hover:shadow-xl transition-all duration-300"
               >
                  <div className="relative z-10">
                     <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                        <PieChart size={28} />
                     </div>
                     <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Auto GST Reports</h3>
                     <p className="text-gray-600 font-medium">Ready-to-file GST reports generated automatically. Export to Excel for your CA instantly.</p>
                  </div>
               </motion.div>

               {/* Feature 4: Small Bento */}
               <motion.div 
                 whileHover={{ y: -5, scale: 1.01 }}
                 className="md:col-span-1 md:row-span-1 bg-white rounded-[32px] p-8 shadow-sm border border-gray-200 overflow-hidden relative group hover:shadow-xl transition-all duration-300"
               >
                  <div className="relative z-10">
                     <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                        <Package size={28} />
                     </div>
                     <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Smart Inventory</h3>
                     <p className="text-gray-600 font-medium">Real-time stock tracking, low stock alerts, and barcode scanning integration.</p>
                  </div>
               </motion.div>

            </div>
          </div>
        </section>

        {/* How it Works (Animated Timeline) */}
        <section id="how-it-works" className="py-32 bg-white">
           <div className="container mx-auto px-6 max-w-5xl">
              <div className="text-center mb-20">
                 <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">Billing made effortless.</h2>
                 <p className="text-xl text-gray-600 font-medium">Go from opening the app to handing over the receipt in 3 simple steps.</p>
              </div>

              <div className="relative">
                 {/* Connecting Line */}
                 <div className="absolute left-8 md:left-1/2 top-10 bottom-10 w-1 bg-gray-100 -translate-x-1/2 rounded-full overflow-hidden">
                    <motion.div 
                       style={{ height: useTransform(scrollYProgress, [0.3, 0.7], ["0%", "100%"]) }}
                       className="w-full bg-teal-500 rounded-full"
                    />
                 </div>

                 <div className="space-y-20 relative z-10">
                    {/* Step 1 */}
                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
                       <div className="md:w-1/2 flex md:justify-end w-full pl-20 md:pl-0">
                          <div className="text-left md:text-right">
                             <div className="text-teal-600 font-black text-lg tracking-widest uppercase mb-2">Step 1</div>
                             <h3 className="text-3xl font-black text-gray-900 mb-4">Add Items / Scan Barcode</h3>
                             <p className="text-gray-600 text-lg font-medium">Quickly search your inventory or use a barcode scanner to add items to the cart instantly.</p>
                          </div>
                       </div>
                       <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-teal-500 shadow-xl flex items-center justify-center text-teal-600 z-10">
                          <QrCode size={24} />
                       </div>
                       <div className="md:w-1/2 w-full pl-20 md:pl-0">
                          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm max-w-sm">
                             <div className="h-10 bg-white rounded-lg border border-gray-200 flex items-center px-4 text-gray-400 gap-3">
                                <QrCode size={18} /> <span className="font-medium text-sm">Scan or search item...</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16">
                       <div className="md:w-1/2 flex md:justify-start w-full pl-20 md:pl-0">
                          <div className="text-left">
                             <div className="text-teal-600 font-black text-lg tracking-widest uppercase mb-2">Step 2</div>
                             <h3 className="text-3xl font-black text-gray-900 mb-4">Auto Calculate Taxes</h3>
                             <p className="text-gray-600 text-lg font-medium">BillCraft automatically applies the correct CGST, SGST, or IGST based on the customer's state.</p>
                          </div>
                       </div>
                       <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-teal-500 shadow-xl flex items-center justify-center text-teal-600 z-10">
                          <Calculator size={24} />
                       </div>
                       <div className="md:w-1/2 w-full pl-20 md:pl-0 flex md:justify-end">
                          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm max-w-sm w-full">
                             <div className="space-y-3 font-medium text-sm">
                                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹1,000.00</span></div>
                                <div className="flex justify-between text-gray-600"><span>CGST (9%)</span><span>₹90.00</span></div>
                                <div className="flex justify-between text-gray-600"><span>SGST (9%)</span><span>₹90.00</span></div>
                                <div className="h-px bg-gray-200 w-full my-2" />
                                <div className="flex justify-between text-gray-900 font-black text-lg"><span>Total</span><span>₹1,180.00</span></div>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
                       <div className="md:w-1/2 flex md:justify-end w-full pl-20 md:pl-0">
                          <div className="text-left md:text-right">
                             <div className="text-teal-600 font-black text-lg tracking-widest uppercase mb-2">Step 3</div>
                             <h3 className="text-3xl font-black text-gray-900 mb-4">Print or WhatsApp</h3>
                             <p className="text-gray-600 text-lg font-medium">Hit print for a rapid thermal receipt, or enter a mobile number to send a PDF via WhatsApp.</p>
                          </div>
                       </div>
                       <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-teal-500 shadow-xl flex items-center justify-center text-teal-600 z-10">
                          <Printer size={24} />
                       </div>
                       <div className="md:w-1/2 w-full pl-20 md:pl-0">
                          <div className="flex gap-4">
                             <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-lg"><Printer size={24}/></div>
                             <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg"><Send size={24}/></div>
                          </div>
                       </div>
                    </div>

                 </div>
              </div>
           </div>
        </section>

        {/* SEO Tools Magnet Section */}
        <section id="tools" className="py-32 bg-gray-50 border-y border-gray-200 relative overflow-hidden">
           {/* Decorative Background */}
           <div className="absolute right-0 bottom-0 w-[500px] h-[500px] bg-teal-100 rounded-full blur-[100px] opacity-50 translate-x-1/2 translate-y-1/2 pointer-events-none" />

           <div className="container mx-auto px-6 relative z-10">
              <div className="text-center max-w-3xl mx-auto mb-16">
                 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 text-teal-700 text-xs font-bold uppercase tracking-widest mb-6">
                    <Sparkles size={16} /> Free Business Tools
                 </div>
                 <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-6">Free GST Calculator</h2>
                 <p className="text-xl text-gray-600 font-medium">Quickly calculate GST inclusive and exclusive prices. No sign up required.</p>
              </div>

              <div className="max-w-4xl mx-auto bg-white rounded-[32px] shadow-2xl border border-gray-200 overflow-hidden">
                 <div className="grid grid-cols-1 md:grid-cols-2">
                    
                    {/* Calculator Form */}
                    <div className="p-8 md:p-12">
                       <div className="mb-8">
                          <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest mb-3">Base Amount (₹)</label>
                          <div className="relative">
                             <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 font-black text-xl">₹</div>
                             <input 
                                type="number" 
                                value={calcAmount || ''} 
                                onChange={(e) => setCalcAmount(Number(e.target.value))}
                                className="w-full pl-12 pr-6 py-5 bg-gray-50 border-2 border-gray-200 rounded-2xl font-black text-gray-900 text-2xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-sm"
                             />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-6 mb-2">
                          <div>
                             <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest mb-3">GST Rate</label>
                             <div className="relative">
                                <select 
                                   value={calcGstRate} 
                                   onChange={(e) => setCalcGstRate(Number(e.target.value))}
                                   className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold text-gray-900 focus:outline-none focus:border-teal-500 focus:bg-white transition-all appearance-none cursor-pointer"
                                >
                                   <option value={5}>5% GST</option>
                                   <option value={12}>12% GST</option>
                                   <option value={18}>18% GST</option>
                                   <option value={28}>28% GST</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                             </div>
                          </div>
                          <div>
                             <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest mb-3">Type</label>
                             <div className="flex bg-gray-50 border-2 border-gray-200 rounded-2xl p-1 relative h-[56px]">
                                <button 
                                   onClick={() => setCalcIsGstInclusive(false)}
                                   className={`flex-1 rounded-xl text-sm font-bold transition-all z-10 ${!calcIsGstInclusive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                                >
                                   Exclusive
                                </button>
                                <button 
                                   onClick={() => setCalcIsGstInclusive(true)}
                                   className={`flex-1 rounded-xl text-sm font-bold transition-all z-10 ${calcIsGstInclusive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                                >
                                   Inclusive
                                </button>
                                <motion.div 
                                   initial={false}
                                   animate={{ x: calcIsGstInclusive ? '100%' : '0%' }}
                                   className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-md z-0"
                                />
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Calculator Result */}
                    <div className="bg-gray-900 p-8 md:p-12 text-white flex flex-col justify-center">
                       <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest mb-8">Calculation Result</h3>
                       
                       <div className="space-y-6">
                          <div className="flex justify-between items-center">
                             <span className="text-gray-400 font-medium text-lg">Base Value</span>
                             <span className="font-bold text-xl">₹{calculatedGst.base.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-gray-400 font-medium text-lg">GST Amount ({calcGstRate}%)</span>
                             <span className="font-bold text-xl">₹{calculatedGst.tax.toFixed(2)}</span>
                          </div>
                          
                          <div className="h-px bg-gray-800 w-full my-6" />
                          
                          <div className="flex justify-between items-end">
                             <span className="text-sm font-bold text-white uppercase tracking-widest">Total Amount</span>
                             <span className="text-4xl md:text-5xl font-black text-teal-400">₹{calculatedGst.total.toFixed(2)}</span>
                          </div>
                       </div>

                       <button 
                         onClick={() => navigate('/login')}
                         className="w-full mt-12 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all border border-white/10"
                       >
                         Generate Invoice with this amount
                       </button>
                    </div>

                 </div>
              </div>

              {/* Other SEO Links */}
              <div className="max-w-4xl mx-auto mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                 {['Find HSN/SAC Code', 'Verify GSTIN', 'Invoice Templates', 'Tally XML Converter'].map((tool, i) => (
                    <a key={i} href="#" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-gray-200 hover:border-teal-500 hover:shadow-lg transition-all group cursor-pointer">
                       <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors mb-3">
                          <Award size={20} />
                       </div>
                       <span className="text-sm font-bold text-gray-700 text-center">{tool}</span>
                    </a>
                 ))}
              </div>
           </div>
        </section>

        {/* Customer Reviews */}
        <section className="py-32 bg-white">
           <div className="container mx-auto px-6 max-w-6xl">
              <div className="text-center mb-16">
                 <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">Loved by shop owners.</h2>
                 <p className="text-xl text-gray-600 font-medium">Join the growing community of smart retailers in India.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {[
                    { name: "Rahul Patel", shop: "Mobile Hub", review: "BillCraft has completely changed how I manage my mobile repair shop. The thermal printing is super fast and WhatsApp invoicing looks very professional." },
                    { name: "Amit Singh", shop: "Singh Electronics", review: "Best free billing software in India. The inventory management and low stock alerts save me so much time. Highly recommended!" },
                    { name: "Priya Sharma", shop: "Priya Boutique", review: "So easy to use! I don't need an accountant for my daily sales tracking anymore. The GST reports are generated automatically." }
                 ].map((testimonial, i) => (
                    <motion.div 
                       key={i}
                       whileHover={{ y: -10 }}
                       className="bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-sm"
                    >
                       <div className="flex text-yellow-400 mb-6">
                          {[1,2,3,4,5].map(star => <Star key={star} size={18} fill="currentColor" />)}
                       </div>
                       <p className="text-gray-700 text-lg leading-relaxed mb-8 font-medium">"{testimonial.review}"</p>
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${testimonial.name}`} alt={testimonial.name} />
                          </div>
                          <div>
                             <div className="font-bold text-gray-900">{testimonial.name}</div>
                             <div className="text-sm text-gray-500 font-medium">{testimonial.shop}</div>
                          </div>
                       </div>
                    </motion.div>
                 ))}
              </div>
           </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-32 bg-gray-50 border-t border-gray-200">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">Frequently Asked Questions</h2>
              <p className="text-xl text-gray-600 font-medium">Got questions? We've got answers.</p>
            </div>
            
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div 
                  key={i} 
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300 hover:border-teal-300 hover:shadow-md"
                >
                  <button 
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 md:p-8 text-left"
                  >
                    <span className="font-bold text-gray-900 text-lg pr-8">{faq.q}</span>
                    <div className={`w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180 bg-teal-50 text-teal-600' : 'text-gray-400'}`}>
                      <ChevronDown size={20} />
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
                        <div className="p-6 md:p-8 pt-0 text-gray-600 text-lg font-medium leading-relaxed border-t border-gray-50">
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
        <section className="py-32 bg-gray-900 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
             <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-900/40 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3" />
             <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/30 rounded-full blur-[120px] -translate-x-1/3 translate-y-1/3" />
          </div>
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter">Ready to upgrade your billing?</h2>
              <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto font-medium">
                Join thousands of businesses across India using BillCraft to manage their daily operations.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <button 
                  onClick={() => navigate('/login')}
                  className="px-10 py-5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-lg font-bold rounded-full hover:shadow-2xl hover:shadow-teal-500/40 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Create Free Account <ArrowRight size={20} />
                </button>
              </div>
              <p className="mt-10 text-sm text-gray-500 font-bold uppercase tracking-widest flex justify-center items-center gap-4">
                 <span><Check size={16} className="inline mr-1 text-teal-500"/> Takes 30s</span>
                 <span><Check size={16} className="inline mr-1 text-teal-500"/> No Credit Card</span>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-16 text-gray-600">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            
            {/* Brand & Contact */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-teal-600 p-2 rounded-xl text-white shadow-sm">
                   <Logo size={24} />
                </div>
                <span className="text-2xl font-black text-gray-900 tracking-tight">BillCraft</span>
              </div>
              
              <div className="space-y-4 font-medium text-sm">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <span>Call: +91 9824194869</span>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <span>Email: nomanshaikh1999@gmail.com</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <span className="leading-relaxed">Patan Gujarat, India</span>
                </div>
              </div>

              {/* Social Icons */}
              <div className="flex items-center gap-4 pt-4">
                <a href="#" aria-label="Facebook" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all text-gray-400">
                  <Facebook size={18} />
                </a>
                <a href="#" aria-label="Twitter" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all text-gray-400">
                  <Twitter size={18} />
                </a>
                <a href="#" aria-label="Instagram" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all text-gray-400">
                  <Instagram size={18} />
                </a>
                <a href="#" aria-label="LinkedIn" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all text-gray-400">
                  <Linkedin size={18} />
                </a>
              </div>
            </div>

            {/* Quick Links 1 */}
            <div className="space-y-6">
              <h3 className="text-gray-900 text-lg font-bold mb-6 tracking-tight">Company</h3>
              <ul className="space-y-4 font-medium text-sm">
                <li><a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo(0,0); }} className="hover:text-teal-600 transition-colors">Home</a></li>
                <li><a href="#features" className="hover:text-teal-600 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors">Blog</a></li>
              </ul>
            </div>

            {/* Free Tools */}
            <div className="space-y-6">
              <h3 className="text-gray-900 text-lg font-bold mb-6 tracking-tight">Free Tools</h3>
              <ul className="space-y-4 font-medium text-sm">
                <li><a href="#calculator" className="hover:text-teal-600 transition-colors flex items-center justify-between group">GST Calculator <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/></a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors flex items-center justify-between group">Invoice Generator <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/></a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors flex items-center justify-between group">Find GSTIN <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/></a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors flex items-center justify-between group">HSN/SAC Finder <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/></a></li>
                <li><a href="#" className="hover:text-teal-600 transition-colors flex items-center justify-between group">Tally XML Converter <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/></a></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-6">
               <h3 className="text-gray-900 text-lg font-bold mb-6 tracking-tight">Legal</h3>
               <ul className="space-y-4 font-medium text-sm">
                <li><button onClick={() => navigate("/terms")} className="hover:text-teal-600 transition-colors cursor-pointer text-left">Privacy Policy</button></li>
                <li><button onClick={() => navigate("/terms")} className="hover:text-teal-600 transition-colors cursor-pointer text-left">Terms & Conditions</button></li>
                <li><button onClick={() => navigate("/terms")} className="hover:text-teal-600 transition-colors cursor-pointer text-left">Cookie Policy</button></li>
                <li><button onClick={() => navigate("/terms")} className="hover:text-teal-600 transition-colors cursor-pointer text-left">Refund Policy</button></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
             <p className="text-sm font-bold text-gray-500">© 2026 BillCraft Invoicing. All rights reserved.</p>
             <div className="flex items-center gap-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 bg-teal-50 px-3 py-1 rounded-full">Built for the modern shop owner</span>
             </div>
          </div>
        </div>
      </footer>

      {/* Floating Support Button */}
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
          className="w-14 h-14 md:w-16 md:h-16 bg-teal-600 text-white rounded-2xl shadow-2xl shadow-teal-600/30 flex items-center justify-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-teal-500 rounded-2xl animate-ping opacity-20 group-hover/support:opacity-0" />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 md:w-[28px] md:h-[28px]">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </motion.button>
      </motion.div>

      {/* Support Modal */}
      <AnimatePresence>
        {isSupportOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSupportOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl border border-gray-100"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Logo size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">Customer Support</h3>
                <p className="text-gray-500 text-sm font-medium mb-8">Please let us know how we can help you.</p>
                  
                <div className="space-y-3">
                  <a 
                    href="mailto:nomanshaikh1999@gmail.com"
                    target="_top"
                    className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-200 group hover:border-teal-500 hover:bg-teal-50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-gray-500 shadow-sm transition-transform group-hover:scale-110 group-hover:text-teal-600 border border-gray-100">
                        <Mail />
                      </div>
                      <div className="text-left">
                        <p className="text-base font-bold text-gray-900">Email Support</p>
                        <p className="text-[10px] text-gray-500 font-medium group-hover:text-teal-600 italic">nomanshaikh1999@gmail.com</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-300 group-hover:text-teal-500" />
                  </a>
                </div>
                <button 
                  onClick={() => setIsSupportOpen(false)}
                  className="mt-8 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
INNER_EOF
bash rewrite_landing.sh