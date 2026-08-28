import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  QrCode, 
  Lock, 
  AlertCircle,
  Zap,
  Info,
  CheckCircle2,
  ArrowRight,
  Landmark,
  User,
  Crown,
  Printer,
  Copy,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { dbService } from '../services/dbService';
import { doc, updateDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function PricingPage() {
  const { 
    user, 
    planTier, 
    updatePlanTier, 
    isOfflineMode,
    subscriptionPending,
    subscriptionStatus,
    subscriptionRequestRef
  } = useAuth();
  const navigate = useNavigate();
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'processing' | 'success'>('details');
  const [paymentError, setPaymentError] = useState('');

  const monthlyPrice = 199;
  const yearlyPrice = 1999;
  const currentPrice = billingCycle === 'monthly' ? monthlyPrice : yearlyPrice;

  // Plan features definitions
  const freeFeatures = [
    { name: "Invoices & Quotations: Unlimited (Manual)", active: true },
    { name: "Customers / Parties: Up to 30", active: true },
    { name: "Items & Inventory: Up to 50 Items", active: true },
    { name: "Payments Ledger & Daily Book", active: true },
    { name: "Basic Reports (Current Month View Only)", active: true },
    { name: "Users: 1 (Owner Only)", active: true },
    { name: "No watermark on Invoices", active: true },
    { name: "AI Bill Scan OCR (Auto-fill)", active: false },
    { name: "Quick POS Mode Integration", active: false },
    { name: "Advanced Export (Excel, PDF)", active: false },
    { name: "UPI Dynamic QR Generator", active: false }
  ];

  const proFeatures = [
    { name: "Invoices & Quotations: Unlimited (Manual)", active: true },
    { name: "Customers / Parties: Unlimited", active: true },
    { name: "Items & Inventory: Unlimited", active: true },
    { name: "🏷️ Barcode Label Printing (A4 Sheets & Thermal Roll)", active: true },
    { name: "👥 Party-Wise Last Selling Price (Auto-Memory)", active: true },
    { name: "🔔 1-Click WhatsApp Payment Reminders with UPI", active: true },
    { name: "💳 Advance Payment Auto-Adjustment in Invoice", active: true },
    { name: "📦 Bulk Serial Numbers & Batch Import", active: true },
    { name: "🔄 Quotation to Invoice 1-Click Conversion", active: true },
    { name: "⚖️ Wholesale vs Retail Double Pricing Tier", active: true },
    { name: "AI Bill Scan OCR (Auto-fill Unlimited)", active: true },
    { name: "Quick POS Mode Integration", active: true },
    { name: "Advanced Export (Excel, PDF)", active: true },
    { name: "Multi-Device Instant Cloud Sync", active: true },
    { name: "24/7 Priority Chat & WhatsApp Support", active: true }
  ];

  const handleCheckoutOpen = () => {
    if (planTier === 'pro') return;
    setCheckoutStep('details');
    setPaymentError('');
    setCreatedInvoiceId(null);
    setShowCheckoutModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');

    if (paymentMethod === 'upi') {
      if (!upiId || upiId.trim().length < 4) {
        setPaymentError('Please enter a valid Transaction Ref No. / UTR or UPI ID');
        return;
      }
    }
    if (paymentMethod === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        setPaymentError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry.includes('/')) {
        setPaymentError('Please enter a valid expiry (MM/YY)');
        return;
      }
      if (cardCvv.length < 3) {
        setPaymentError('Please enter a valid 3-digit CVV');
        return;
      }
    }

    setCheckoutStep('processing');

    // Simulate safe transaction processing
    setTimeout(async () => {
      try {
        if (!user) {
          setPaymentError('User session expired. Please log in again.');
          setCheckoutStep('details');
          return;
        }

        if (paymentMethod === 'upi') {
          // Clean up any existing pending requests for this user first to prevent duplicate requests
          if (db && !isOfflineMode) {
            try {
              const q = query(collection(db, 'subscription_requests'), where('user_id', '==', user.uid), where('status', '==', 'pending'));
              const existingSnap = await getDocs(q);
              for (const dSnap of existingSnap.docs) {
                await deleteDoc(doc(db, 'subscription_requests', dSnap.id));
              }
            } catch (err) {
              console.warn("Could not clean old pending requests:", err);
            }
          }

          // Generate a custom ID for the subscription request
          const requestId = `req_${user.uid}_${Date.now()}`;
          const requestData = {
            id: requestId,
            user_id: user.uid,
            user_email: user.email,
            user_name: user.displayName || user.email?.split('@')[0] || 'User',
            amount: currentPrice,
            billing_cycle: billingCycle,
            payment_method: 'upi',
            upi_id_ref: upiId,
            status: 'pending',
            created_at: new Date().toISOString()
          };

          // Direct online Firebase Firestore sync for real-time admin alert & dashboard approval
          if (db && !isOfflineMode) {
            await setDoc(doc(db, 'subscription_requests', requestId), requestData);
          } else {
            await dbService.add('subscription_requests', requestData, { offlineMode: isOfflineMode, userId: user.uid });
          }

          // Update user profile in Firestore to pending
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            subscription_pending: true,
            subscription_status: 'pending',
            subscription_request_ref: upiId,
            subscription_request_cycle: billingCycle,
            subscription_request_amount: currentPrice,
            subscription_request_date: new Date().toISOString()
          });

          // Add a notification that subscription verification is initiated
          await dbService.add('notifications', {
            user_id: user.uid,
            text: `⏱️ Subscription Verification Initiated: UPI Ref ${upiId} is being matched with our State Bank of India account. Pro features will unlock upon approval!`,
            read: false,
            category: 'other',
            created_at: new Date().toISOString()
          }, { offlineMode: isOfflineMode, userId: user.uid });

          // Send notification alert to backend for WhatsApp / SMS / Email dispatcher
          try {
            const token = await user.getIdToken();
            await fetch('/api/subscription/notify-pending', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                amount: currentPrice,
                billingCycle,
                upiId
              })
            });
          } catch (notifyErr) {
            console.error("Failed to trigger admin notification dispatch:", notifyErr);
          }

        } else {
          // Auto-approve simulated card / netbanking payments
          // Upgrade plan tier in Firestore
          await updatePlanTier('pro');

          // Log payment transaction record
          await dbService.add('payments_subscription', {
            user_id: user.uid,
            user_email: user.email,
            amount: currentPrice,
            billing_cycle: billingCycle,
            payment_method: paymentMethod,
            date: new Date().toISOString(),
            status: 'success'
          }, { offlineMode: isOfflineMode, userId: user.uid });

          // Generate dynamic sub invoice number
          const invoiceNum = `SUB-${billingCycle === 'monthly' ? 'M' : 'Y'}-${Date.now().toString(36).substring(3, 7).toUpperCase()}`;
          
          // Add a professional paid subscription invoice in user's invoices
          const invoicePayload = {
            invoice_number: invoiceNum,
            customer_name: 'InvoCentric Subscription Service',
            customer_id: null,
            amount: currentPrice,
            total: currentPrice,
            currency: 'INR',
            bill_type: 'regular',
            discount: 0,
            sales_return: 0,
            columnVisibility: {
              size: false,
              hsn: false,
              mrp: false,
              discount: false,
              gstPercent: false
            },
            amount_words: `${currentPrice === 199 ? 'ONE HUNDRED NINETY NINE' : 'ONE THOUSAND NINE HUNDRED NINETY NINE'} RUPEES ONLY`,
            status: 'paid',
            due_date: new Date().toISOString(),
            items: [
              {
                description: `InvoCentric Pro Plan Subscription (${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'})`,
                quantity: 1,
                price: currentPrice
              }
            ],
            notes: `Thank you for upgrading to InvoCentric Pro!\nPayment Method: ${paymentMethod.toUpperCase()}\nUPI ID / Account: ${paymentMethod === 'upi' ? (upiId || 'user@upi') : 'Saved Card/Account'}\nYour subscription is now active on all devices.`,
            is_subscription_receipt: true
          };

          const resInvoice = await dbService.add('invoices', invoicePayload, { offlineMode: isOfflineMode, userId: user.uid });
          if (resInvoice && resInvoice.id) {
            setCreatedInvoiceId(resInvoice.id);

            // Add a payment ledger record linked to this invoice
            await dbService.add('payments', {
              customer_id: null,
              customer_name: 'InvoCentric Subscription Service',
              amount: currentPrice,
              date: new Date().toISOString(),
              note: `Subscription Invoice #${invoiceNum} Paid`,
              method: paymentMethod === 'upi' ? 'upi' : 'card',
              invoice_id: resInvoice.id,
              user_id: user.uid,
            }, { offlineMode: isOfflineMode, userId: user.uid });

            // Add an expense record for the business subscription purchase (खर्च)
            await dbService.add('expenses', {
              description: `InvoCentric Pro Subscription (${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'})`,
              amount: currentPrice,
              category: 'Software/Subscription',
              date: new Date().toISOString().split('T')[0],
              payment_method: paymentMethod === 'upi' ? 'UPI' : 'Credit Card',
              user_id: user.uid,
              created_at: new Date().toISOString()
            }, { offlineMode: isOfflineMode, userId: user.uid });
          }

          // Add a premium notification for the user
          await dbService.add('notifications', {
            user_id: user.uid,
            text: `🎉 Welcome to InvoCentric Pro! Your ${billingCycle} account is now fully active. Enjoy AI scans, POS, and unlimited exports!`,
            read: false,
            category: 'other',
            created_at: new Date().toISOString()
          }, { offlineMode: isOfflineMode, userId: user.uid });
        }

        setCheckoutStep('success');
      } catch (err) {
        console.error("Subscription update failed:", err);
        setPaymentError('Internal payment processing error. Please try again.');
        setCheckoutStep('details');
      }
    }, 2500);
  };

  return (
    <div className="space-y-10 py-4 max-w-6xl mx-auto">
      {/* UPI Subscription Pending Banner */}
      {subscriptionPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/60 flex items-center justify-center text-amber-700 shrink-0">
              <Clock size={22} className="animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight flex items-center gap-2">
                UPI Payment Verification Pending
              </h4>
              <p className="text-xs text-amber-700 mt-1">
                Your payment reference <span className="font-extrabold">{subscriptionRequestRef}</span> is under manual verification. 
                Our Admin (Shekh Mahammad Noman) is verifying the receipt with SBI Yono. Pro features will unlock automatically!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Awaiting Approval
            </span>
          </div>
        </div>
      )}

      {/* Rejected Subscription Alert Banner */}
      {!subscriptionPending && subscriptionStatus === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <X size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">
                Payment Verification Rejected
              </h4>
              <p className="text-xs text-red-700 mt-1">
                Your previous UPI Reference ID <span className="font-extrabold">{subscriptionRequestRef}</span> could not be verified with our SBI account. 
                Please try making the payment again or entering the correct UPI Transaction ID / Ref No.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-100 text-red-800 border border-red-200">
              Verification Failed
            </span>
          </div>
        </div>
      )}

      {/* Dynamic Alert Banner */}
      <div className="bg-gradient-to-r from-[#166534]/10 to-[#166534]/5 rounded-3xl p-6 border border-[#166534]/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#166534] shadow-sm border border-[#166534]/5 shrink-0">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Active Plan State</h4>
            <p className="text-xs text-slate-500 mt-1">
              Currently logged in as <span className="font-extrabold text-slate-700">{user?.email}</span> with a <span className="font-extrabold text-[#166534] uppercase">{planTier} account</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border",
            planTier === 'pro' 
              ? "bg-[#F0FDF4] text-[#166534] border-green-100" 
              : "bg-slate-100 text-slate-500 border-slate-200"
          )}>
            {planTier === 'pro' ? 'Pro Plan Active' : 'Free Tier Active'}
          </span>
        </div>
      </div>

      {/* Header Section */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">
          Choose the Perfect Plan for Your Business
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-lg mx-auto">
          Scale effortlessly from simple freelance invoicing to advanced multi-mode retail billing. Upgrade to unlock full automation.
        </p>

        {/* Custom Toggle Selector */}
        <div className="pt-2">
          <div className="bg-slate-100/80 p-1.5 rounded-2xl inline-flex items-center gap-1 border border-slate-200/40">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all",
                billingCycle === 'monthly' ? "bg-[#166534] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Monthly billing
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                billingCycle === 'yearly' ? "bg-[#166534] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Yearly billing
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-md font-extrabold leading-none select-none uppercase tracking-wide",
                billingCycle === 'yearly' ? "bg-white/20 text-white" : "bg-[#F0FDF4] text-[#166534]"
              )}>
                Save 16%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* FREE PLAN CARD */}
        <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-8 md:p-10 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[640px] relative overflow-hidden">
          {planTier === 'free' && (
            <div className="absolute top-4 right-4 bg-slate-100 text-slate-600 px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200">
              Current Plan
            </div>
          )}
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Free Plan</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Forever Free</p>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-slate-950 tracking-tight">₹0</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">/ forever</span>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Feature Checkbox List */}
            <ul className="space-y-4">
              {freeFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    feat.active ? "bg-[#F0FDF4] text-[#166534]" : "bg-slate-50 text-slate-300"
                  )}>
                    {feat.active ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </div>
                  <span className={cn(
                    "text-xs leading-normal",
                    feat.active ? "text-slate-700 font-medium" : "text-slate-400 line-through decoration-slate-200"
                  )}>
                    {feat.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-8">
            <button 
              disabled={planTier === 'free'}
              className={cn(
                "w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                planTier === 'free' 
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                  : "bg-slate-950 text-white hover:bg-slate-900"
              )}
            >
              {planTier === 'free' ? 'Your Current Plan' : 'Standard Free Plan'}
            </button>
          </div>
        </div>

        {/* PRO PLAN CARD */}
        <div className="bg-white border-2 border-[#166534] rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-green-900/5 transition-all flex flex-col justify-between min-h-[640px] relative overflow-hidden">
          {/* Accent Ribbon Badge */}
          <div className="absolute top-4 right-4 bg-[#166534] text-white px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
            <Crown size={10} />
            Recommended
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                Pro Plan
              </h3>
              <p className="text-xs text-[#166534] font-extrabold uppercase tracking-wider mt-1">Professional Billing Suite</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-[#166534] tracking-tight">
                  ₹{billingCycle === 'monthly' ? monthlyPrice : yearlyPrice}
                </span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  / {billingCycle === 'monthly' ? 'month' : 'year'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 w-fit px-2 py-1 rounded-md">
                  <Zap size={10} className="fill-emerald-600" />
                  Save ₹388 — 2 months free!
                </p>
              )}
            </div>

            <div className="h-px bg-slate-100" />

            {/* Feature Checkbox List */}
            <ul className="space-y-4">
              {proFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#F0FDF4] text-[#166534] flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-xs leading-normal text-slate-700 font-semibold">
                    {feat.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-8">
            <button 
              onClick={handleCheckoutOpen}
              disabled={planTier === 'pro' || subscriptionPending}
              className={cn(
                "w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2",
                (planTier === 'pro' || subscriptionPending)
                  ? "bg-[#F0FDF4] text-[#166534] border border-green-100 cursor-not-allowed" 
                  : "bg-[#166534] hover:bg-[#0F3D21] text-white shadow-green-700/10 hover:shadow-lg hover:scale-[1.01]"
              )}
            >
              {planTier === 'pro' 
                ? 'Your Current Plan' 
                : subscriptionPending 
                  ? 'Payment Verification Pending' 
                  : `Upgrade to Pro (${billingCycle})`}
              {planTier !== 'pro' && !subscriptionPending && <ArrowRight size={14} />}
            </button>
          </div>
        </div>

      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-8 md:p-10 space-y-8">
        <div className="text-center md:text-left space-y-2">
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Frequently Asked Questions</h3>
          <p className="text-xs text-slate-500 font-medium">Clear answers to your billing and subscription queries.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">Can I change my billing cycle later?</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">Yes! You can switch between monthly and yearly billing cycles at any time from your settings panel. Your account balance will be prorated automatically.</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">Is the watermark removed on the Free Plan?</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">Absolutely! InvoCentric believes in absolute professionalism. We do not add any promotional watermarks or brand logos on generated invoice PDFs, even on the Free Plan.</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">How does the AI Bill Scan feature work?</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">Simply upload a picture or PDF of any vendor purchase receipt or physical invoice. Our advanced AI scan (OCR) engine automatically extracts items, totals, vendor names, and GST numbers to auto-fill your documents.</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">What are the online payment security standards?</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">Our payment gateway integrations utilize industry-standard 256-bit SSL encryption. All payments are processed securely through leading payment gateways (Razorpay/Stripe); your sensitive credit card or UPI details are never stored on our servers.</p>
          </div>
        </div>
      </div>

      {/* CHECKOUT MODAL WINDOW LAYER */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-2 pt-6 pb-6 overflow-y-auto xs:items-center sm:p-4">
            
            {/* Dark Overlay Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (checkoutStep !== 'processing') setShowCheckoutModal(false);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Body Container */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              className="relative w-full max-w-lg lg:max-w-4xl bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200/80 z-10 my-auto max-h-[95vh] flex flex-col"
            >
              
              {/* DETAILS AND PAYMENT STEP */}
              {checkoutStep === 'details' && (
                <div className="p-5 sm:p-7 overflow-y-auto scrollbar-thin">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] text-[#166534] flex items-center justify-center shadow-xs">
                        <CreditCard size={17} />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">Secure Upgrade Checkout</h2>
                        <p className="text-[11px] text-slate-500 font-semibold hidden sm:block">Instant Pro features activation with 0% gateway fee</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowCheckoutModal(false)}
                      className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Error Notification Alert */}
                  {paymentError && (
                    <div className="mt-3 bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs text-rose-600 flex items-center gap-2 font-semibold">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {/* Main Grid: 2-Columns on PC (Left QR, Right Form) | 1-Column on Mobile */}
                  <form onSubmit={handlePaymentSubmit} className="mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7 items-start">
                    
                    {/* LEFT COLUMN: Prominent Big QR Code Card (5 cols on desktop) */}
                    <div className="lg:col-span-5 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center space-y-3.5 shadow-xs">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        <QrCode size={14} className="text-[#166534]" />
                        <span>Scan & Pay with Any UPI App</span>
                      </div>
                      
                      {/* High Resolution Dynamic QR Code */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                            `upi://pay?pa=shekhnoman@sbi&pn=Shekh%20Mahammad%20Noman&am=${currentPrice}&cu=INR&tn=InvoCentric%20Pro%20Subscription`
                          )}`}
                          alt="UPI QR Code"
                          className="w-[150px] h-[150px] sm:w-[175px] sm:h-[175px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <div className="mt-2 text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          <span className="text-emerald-700">Dynamic ₹{currentPrice} QR Active</span>
                        </div>
                      </div>

                      {/* Account Beneficiary Info */}
                      <div className="w-full space-y-0.5 text-center">
                        <p className="text-xs font-black text-slate-800">Shekh Mahammad Noman</p>
                        <p className="text-[10px] font-bold text-slate-500">State Bank of India (SBI)</p>
                      </div>

                      {/* 1-Click Copy UPI ID */}
                      <div className="w-full bg-white border border-slate-200/80 rounded-xl p-2 flex items-center justify-between gap-2 shadow-xs">
                        <span className="text-xs font-mono font-bold text-[#166534] truncate pl-1">shekhnoman@sbi</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('shekhnoman@sbi');
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="px-2.5 py-1 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Copy size={11} />
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      {/* Mobile Instant UPI Intent App Link */}
                      <div className="w-full pt-0.5">
                        <a 
                          href={`upi://pay?pa=shekhnoman@sbi&pn=Shekh%20Mahammad%20Noman&am=${currentPrice}&cu=INR&tn=InvoCentric%20Pro%20Subscription`}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <Sparkles size={13} className="text-amber-300" />
                          Pay via GPay / PhonePe / Paytm
                        </a>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Plan Summary, Reference Details & Submit (7 cols on desktop) */}
                    <div className="lg:col-span-7 space-y-4 sm:space-y-5 flex flex-col justify-between h-full">
                      
                      {/* Subscription Summary Card */}
                      <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 sm:p-5 flex justify-between items-center shadow-xs">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Selected Plan</p>
                          <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5">InvoCentric Pro ({billingCycle})</p>
                          <p className="text-[11px] text-emerald-700 font-bold mt-0.5">Includes unlimited AI scanning & POS</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Payable</p>
                          <p className="text-xl sm:text-2xl font-black text-[#166534] mt-0.5">₹{currentPrice}</p>
                        </div>
                      </div>

                      {/* Reference Number / UPI ID Input */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase text-slate-700 tracking-wider flex items-center justify-between">
                          <span>Your UPI ID / 12-Digit UTR Ref Number</span>
                          <span className="text-[10px] font-bold text-amber-600">Required for instant activation</span>
                        </label>
                        <input 
                          type="text"
                          required
                          placeholder="e.g. 423987123456 or name@okaxis"
                          className="w-full px-4 py-3 bg-[#F8FAFB] border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#166534] text-xs sm:text-sm font-bold text-slate-900"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                        />
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          Pay using the QR code on the left, then enter your transaction reference / UTR number above to verify and unlock Pro instantly.
                        </p>
                      </div>

                      {/* Trust & Guarantee Badges */}
                      <div className="grid grid-cols-2 gap-2.5 py-1">
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-bold text-slate-700">Instant Activation</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                          <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-bold text-slate-700">100% Direct SBI Settle</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2.5 pt-2">
                        <div className="flex gap-3">
                          <button 
                            type="button" 
                            onClick={() => setShowCheckoutModal(false)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            className="flex-1 bg-[#166534] hover:bg-[#0F3D21] text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/15 cursor-pointer active:scale-95"
                          >
                            <Lock size={13} />
                            Verify & Upgrade ₹{currentPrice}
                          </button>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
                          <ShieldCheck size={12} className="text-emerald-600" />
                          Encrypted Verification • Zero Transaction Commission
                        </div>
                      </div>

                    </div>
                  </form>
                </div>
              )}

              {/* PROCESSING LOADING SPIN STEP */}
              {checkoutStep === 'processing' && (
                <div className="p-12 text-center space-y-6 flex flex-col items-center justify-center min-h-[360px]">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-[#166534]/10 border-t-[#166534] animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-[#166534]">
                      <Lock size={18} className="animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-md font-black uppercase tracking-tight text-slate-800">Processing Secure Payment</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-normal">
                      Your transaction is being processed securely. Please do not close this window or navigate away.
                    </p>
                  </div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                    Settle with Razorpay Node Server...
                  </div>
                </div>
              )}

              {/* CELEBRATORY SUCCESS UPGRADE STEP */}
              {checkoutStep === 'success' && (
                <div className="p-10 text-center space-y-6 flex flex-col items-center justify-center min-h-[380px]">
                  {paymentMethod === 'upi' ? (
                    <>
                      <motion.div 
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15 }}
                        className="w-20 h-20 bg-amber-50 text-amber-600 border border-amber-100 rounded-full flex items-center justify-center shadow-lg animate-pulse"
                      >
                        <Clock size={44} strokeWidth={2.5} />
                      </motion.div>
                      
                      <div className="space-y-2">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">⏱️ Request Submitted!</h2>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                          Your UPI reference <span className="font-bold text-slate-800">{upiId}</span> has been successfully submitted for verification! 
                        </p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
                          Our system Admin (Shekh Mahammad Noman) is matching it with our State Bank of India account records. Your Pro tier will unlock automatically.
                        </p>
                      </div>

                      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 w-full text-left space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-amber-800 font-medium">Verification Status:</span>
                          <span className="text-amber-900 font-black uppercase">Awaiting Approval</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-amber-800 font-medium">Billed Cycle:</span>
                          <span className="text-amber-950 font-extrabold uppercase">{billingCycle}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-amber-800 font-medium">Reference Entered:</span>
                          <span className="text-amber-950 font-mono font-extrabold">{upiId}</span>
                        </div>
                      </div>

                      <div className="w-full">
                        <button 
                          type="button"
                          onClick={() => {
                            setShowCheckoutModal(false);
                            setCheckoutStep('details');
                          }}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-amber-600/10"
                        >
                          Got It, Back to Dashboard
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <motion.div 
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15 }}
                        className="w-20 h-20 bg-green-50 text-[#166534] border border-green-100 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <CheckCircle2 size={44} strokeWidth={2.5} />
                      </motion.div>
                      
                      <div className="space-y-2">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">🎉 Subscription Successful!</h2>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                          Your subscription was processed successfully! All Pro features have been unlocked for your account. Welcome to InvoCentric Pro!
                        </p>
                      </div>

                      <div className="bg-[#F0FDF4]/50 border border-green-100 rounded-2xl p-4 w-full text-left space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Unlocked Account Tier:</span>
                          <span className="text-[#166534] font-black uppercase">PRO ACCOUNT</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Billed Cycle:</span>
                          <span className="text-slate-700 font-extrabold uppercase">{billingCycle}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Payment Method:</span>
                          <span className="text-slate-700 font-extrabold uppercase">{paymentMethod}</span>
                        </div>
                      </div>

                      <div className="w-full space-y-2">
                        {createdInvoiceId && (
                          <button 
                            type="button"
                            onClick={() => {
                              setShowCheckoutModal(false);
                              setCheckoutStep('details');
                              navigate(`/invoices/${createdInvoiceId}`);
                            }}
                            className="w-full bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534] border border-green-200 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            <Printer size={14} />
                            Download &amp; Print Invoice
                          </button>
                        )}

                        <button 
                          type="button"
                          onClick={() => {
                            setShowCheckoutModal(false);
                            setCheckoutStep('details');
                          }}
                          className="w-full bg-[#166534] hover:bg-[#0F3D21] text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                          Dismiss &amp; Start Billing
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

            </motion.div>

          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
