import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Check, ChevronRight, Volume2, VolumeX,
  Receipt, FileEdit, Users, CreditCard, Package, ShoppingCart, Landmark, Settings,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

interface DemoScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  id: string;
  stage: string;
  title: string;
  icon: React.ReactNode;
  route: string;
  purpose: string;
  howItWorks: string[];
  tips: string;
  speechText: string;
}

export default function DemoScriptModal({ isOpen, onClose }: DemoScriptModalProps) {
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Stop any playing speech on unmount or when modal is closed
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const stepsList: GuideStep[] = [
    {
      id: 'invoice',
      stage: 'STEP 1',
      title: 'GST & Regular Invoices (Sales Billing)',
      icon: <Receipt className="text-green-600" size={20} />,
      route: '/invoices',
      purpose: 'Quickly create and send professional invoices, compute GST taxes, and generate payment UPI QR codes.',
      howItWorks: [
        'Click on "Create Invoice" from the dashboard or sidebar.',
        'Select a registered customer and add items from your inventory catalog.',
        'Apply discounts, choose tax rates (GST, SGST, IGST), or choose tax-exempt status.',
        'Generate an instant Dynamic QR Code so customers can scan and pay via GooglePay, PhonePe, or Paytm.',
        'Click save to view the bill, download as high-quality PDF, or share instantly via 1-click WhatsApp.'
      ],
      tips: 'Pro-Tip: Switch on "Thermal Format" in settings to print quick 2-inch or 3-inch receipts for POS thermal printers.',
      speechText: "Step 1: Sales Billing and Invoices. Create professional GST bills instantly. Select your customer, add products from stock, customize tax and discounts, and generate a dynamic QR code for instant UPI payments. Finally, download as watermark free PDF or share on WhatsApp with one click."
    },
    {
      id: 'quotations',
      stage: 'STEP 2',
      title: 'Quotations & Price Estimates',
      icon: <FileEdit className="text-sky-600" size={20} />,
      route: '/quotations',
      purpose: 'Send professional price proposals to potential clients and convert them to tax invoices in a single click.',
      howItWorks: [
        'Navigate to the "Quotations" section and click "New Quotation".',
        'Enter estimated rates, labor, and product values.',
        'Download and share the non-tax quotation PDF directly with clients.',
        'Once approved, click "Convert to Invoice" on the quotation view page to automatically transfer all details into a fresh GST bill.'
      ],
      tips: 'Pro-Tip: Ideal for B2B deals, contracts, and service providers to lock in pricing agreements before final delivery.',
      speechText: "Step 2: Quotations and Price Estimates. Create formal business quotes and proforma invoices for your deals. When your client approves the estimate, simply open the quote and click convert to invoice to instantly generate a proper GST bill without retyping anything."
    },
    {
      id: 'parties',
      stage: 'STEP 3',
      title: 'Parties Ledger (Customers & Suppliers)',
      icon: <Users className="text-amber-600" size={20} />,
      route: '/customers',
      purpose: 'Keep zero-error accounting ledgers for customers who buy from you and suppliers who sell you inventory.',
      howItWorks: [
        'Open the "Customers & Suppliers" page and register a new party.',
        'Add details such as mobile number, GSTIN, shipping address, and opening balance (credit/due).',
        'The app automatically tracks the historic due balance of each customer as invoices and payments are recorded.',
        'Download the full transaction ledger statement (PDF or Excel) and send payment reminders on WhatsApp in one click.'
      ],
      tips: 'Pro-Tip: Color-coded balances immediately highlight who owes you money (red) and who you owe money to (green).',
      speechText: "Step 3: Parties Ledger. Register customers and wholesale suppliers. Keep a neat digital customer ledger. View dynamic outstanding balances, download full ledger reports, and send automatic payment reminders directly to client phones."
    },
    {
      id: 'payments',
      stage: 'STEP 4',
      title: 'Payments Received & Paid Logs',
      icon: <CreditCard className="text-emerald-600" size={20} />,
      route: '/payments',
      purpose: 'Record advance amounts, partial customer installments, and payment modes to prevent discrepancy.',
      howItWorks: [
        'When a customer makes a payment, click "Record Payment".',
        'Select the customer, type the amount received, select the payment date, and document the mode (Cash, UPI, GPay, Online).',
        'The software automatically decreases the customer\'s outstanding balance.',
        'Print or share a clean payment receipt acknowledging receipt of funds.'
      ],
      tips: 'Pro-Tip: Tie payments to specific invoices to track which bills are fully settled or partially outstanding.',
      speechText: "Step 4: Payments Tracking. Record advance payments, part payments, and split payment modes like cash, card, and online. This updates the digital register instantly, ensuring accurate cash-on-hand tracking."
    },
    {
      id: 'items',
      stage: 'STEP 5',
      title: 'Items & Inventory Management',
      icon: <Package className="text-green-600" size={20} />,
      route: '/items',
      purpose: 'Add products with selling prices, wholesale purchase prices, tax rates, and set low stock warning levels.',
      howItWorks: [
        'Go to the "Items" catalog and click "Add New Item".',
        'Enter item name, barcode, custom unit (Pcs, Box, Kg), Sale Price, Purchase Price, and GST percentage.',
        'Enter current stock on hand and specify a Minimum Stock Alert quantity.',
        'When selling, the system automatically subtracts the items and triggers a visual warning once stock goes below your specified limit.'
      ],
      tips: 'Pro-Tip: Utilize your smartphone or computer camera to scan barcodes directly for high-speed item additions and instant checkout.',
      speechText: "Step 5: Items and Inventory. Set up your digital product catalog. Save item names, retail prices, purchase costs, and tax settings. Get immediate alerts when your inventory levels fall low, so you never run out of stock."
    },
    {
      id: 'purchases',
      stage: 'STEP 6',
      title: 'Purchases (Supplier Bill Entries)',
      icon: <ShoppingCart className="text-purple-600" size={20} />,
      route: '/purchases',
      purpose: 'Log wholesale purchases from suppliers to increase inventory counts and monitor raw material costs.',
      howItWorks: [
        'Open the "Purchases" menu and click "Add Purchase Bill".',
        'Select the wholesale vendor and add the products purchased.',
        'Input purchase prices and tax details to update your average costing.',
        'Saving the purchase automatically increments stock levels for all included items.'
      ],
      tips: 'Pro-Tip: Registering purchases is crucial to correctly compute your Business Gross Profits and audit-ready stock levels.',
      speechText: "Step 6: Wholesale Purchases. Record purchase bills from vendors. Logging your purchase costs automatically adds products back into your inventory stock and maintains your supplier credit balances."
    },
    {
      id: 'expenses',
      stage: 'STEP 7',
      title: 'Business Expense Tracker',
      icon: <Landmark className="text-rose-600" size={20} />,
      route: '/expenses',
      purpose: 'Keep tabs on miscellaneous expenses like rent, office utilities, salaries, and maintenance to calculate absolute Net Profit.',
      howItWorks: [
        'Go to "Expenses" and click "Add Expense Entry".',
        'Assign a category (e.g., Rent, Office Stationery, Tea & Snacks, Transport).',
        'Enter total amount, payment method (Cash, Bank), and write a quick reference note.',
        'All logged expenses are instantly subtracted from gross income in your Profit & Loss analytics.'
      ],
      tips: 'Pro-Tip: Keeping expenses organized prevents missing cash-leaks and optimizes business taxation deduction benefits.',
      speechText: "Step 7: Expense Tracker. Log operating expenses such as rent, salaries, transport, and utilities. Keeping tabs on non inventory expenses is essential for calculating your true net business profit."
    },
    {
      id: 'reports',
      stage: 'STEP 8',
      title: 'Reports & Dynamic Settings',
      icon: <Settings className="text-slate-700" size={20} />,
      route: '/reports',
      purpose: 'Export tax-compliant GST data, Sales reports, Profit & Loss summaries, and manage print sizes.',
      howItWorks: [
        'Open the "Reports" center to view real-time graphical charts representing Sales, Profit/Loss, and Expenses.',
        'Use custom date-filters (Today, This Month, Financial Year) to audit your finances.',
        'Export reports in 1-click to Microsoft Excel or download detailed PDF summary sheets.',
        'Navigate to "Settings" to upload your brand logo, configure custom terms & conditions, set up cloud sync, or select A4 / 3-inch thermal bill size.'
      ],
      tips: 'Pro-Tip: Review your "Daily Cash Book" every evening to match the physical cash in your drawer with the digital app balance.',
      speechText: "Step 8: Reports and Settings. View real time financial charts, sales analytics, and dynamic GST reports. Export directly to Excel or PDF. In settings, upload your business logo, configure print formats, and sync your data securely."
    }
  ];

  const handleSpeech = (stepId: string, text: string) => {
    if ('speechSynthesis' in window) {
      if (isSpeakingId === stepId) {
        window.speechSynthesis.cancel();
        setIsSpeakingId(null);
      } else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Microsoft'))
        );
        if (enVoice) utterance.voice = enVoice;

        utterance.onend = () => {
          setIsSpeakingId(null);
        };
        utterance.onerror = () => {
          setIsSpeakingId(null);
        };

        setIsSpeakingId(stepId);
        window.speechSynthesis.speak(utterance);
      }
    } else {
      alert("Text-to-Speech is not supported in this browser environment.");
    }
  };

  const toggleComplete = (id: string) => {
    setCompletedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      {/* Container */}
      <div className="bg-[#FAF9F6] text-slate-800 w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200/80 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200" id="interactive-app-guide-modal">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-green-50 border border-green-200 rounded-xl sm:rounded-2xl text-green-600 shadow-xs">
              <Sparkles size={20} className="animate-pulse sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base md:text-xl font-black tracking-tight text-slate-900 leading-tight">
                InvoCentric Interactive Product Walkthrough
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                Learn how all features work with audio walkthroughs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border-none bg-transparent shrink-0 active:scale-90"
            title="Close Guide"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Controls Bar: Progress */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
            Your Progress:
          </span>
          <div className="text-right flex items-center gap-2">
            <div className="text-[10px] sm:text-xs font-bold text-slate-700">
              {Object.values(completedSteps).filter(Boolean).length}/{stepsList.length} Completed
            </div>
            <div className="w-20 sm:w-28 bg-slate-100 h-1.5 sm:h-2 rounded-full overflow-hidden border border-slate-200">
              <div 
                className="bg-green-500 h-full transition-all duration-300"
                style={{ width: `${(Object.values(completedSteps).filter(Boolean).length / stepsList.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 bg-[#FAF9F6]">
          
          {/* Welcome Intro Banner */}
          <div className="p-3.5 sm:p-4 bg-green-50/75 border border-green-200/80 rounded-xl sm:rounded-2xl flex items-start gap-2.5 sm:gap-3 shadow-xs">
            <div className="p-1.5 sm:p-2 bg-green-100 text-green-800 rounded-lg shrink-0 mt-0.5">
              <Info size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-green-950">
                Welcome to your Personal App Walkthrough!
              </h4>
              <p className="text-[11px] sm:text-xs text-green-900 leading-relaxed mt-1 font-medium">
                We have designed this offline-first billing app to be extremely simple yet complete. Tap on the Speaker button next to any step to hear a clear audio walkthrough of that feature!
              </p>
            </div>
          </div>

          {/* Steps Loop */}
          <div className="space-y-4 sm:space-y-6">
            {stepsList.map((step) => {
              const isChecked = !!completedSteps[step.id];
              const isSpeaking = isSpeakingId === step.id;
              
              return (
                <div 
                  key={step.id}
                  className={cn(
                    "p-4 sm:p-5 md:p-6 bg-white border rounded-xl sm:rounded-2xl transition-all duration-300 relative group shadow-xs",
                    isChecked ? "border-slate-300 bg-slate-50/50" : "border-slate-200/90 hover:border-green-300 hover:shadow-md"
                  )}
                >
                  {/* Top line of card */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 mb-3.5">
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 rounded-lg sm:rounded-xl flex items-center justify-center border border-slate-200/60 shadow-inner shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {step.stage}
                          </span>
                          <span className="text-[9px] sm:text-xs font-mono font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">
                            Route: {step.route}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1 leading-tight">
                          {step.title}
                        </h3>
                      </div>
                    </div>

                    {/* Action Panel: Play Sound & Check Done */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleSpeech(step.id, step.speechText)}
                        className={cn(
                          "flex-1 sm:flex-none justify-center px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 border cursor-pointer active:scale-95",
                          isSpeaking 
                            ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse" 
                            : "bg-green-50 border-green-100 text-green-700 hover:bg-green-100/60"
                        )}
                        title={isSpeaking ? "Stop Audio" : "Play Audio Tour"}
                      >
                        {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        <span>{isSpeaking ? "Stop" : "Listen Tour"}</span>
                      </button>

                      <button
                        onClick={() => toggleComplete(step.id)}
                        className={cn(
                          "p-2 rounded-lg sm:rounded-xl border transition-all cursor-pointer shrink-0 active:scale-95",
                          isChecked 
                            ? "bg-slate-800 border-slate-800 text-white" 
                            : "bg-white border-slate-200 text-slate-400 hover:text-slate-800 hover:border-slate-300"
                        )}
                        title={isChecked ? "Mark as Uncompleted" : "Mark as Completed"}
                      >
                        <Check size={15} strokeWidth={isChecked ? 3 : 2} />
                      </button>
                    </div>
                  </div>

                  {/* Feature Purpose Statement */}
                  <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed font-bold border-l-3 border-green-500 pl-2.5 py-0.5 mb-3">
                    {step.purpose}
                  </p>

                  {/* Step-by-Step Instructions */}
                  <div className="space-y-1.5 mb-3 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-100/80">
                    <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      How to use this feature:
                    </p>
                    <ul className="space-y-1.5 text-[11px] sm:text-xs text-slate-700">
                      {step.howItWorks.map((act, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <ChevronRight size={13} className="text-green-600 shrink-0 mt-0.5 sm:w-3.5 sm:h-3.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pro-Tips footer inside card */}
                  <div className="bg-amber-50/50 border border-amber-200/60 p-3 rounded-lg sm:rounded-xl flex items-start sm:items-center gap-2 text-[10px] sm:text-xs text-amber-900 font-medium leading-relaxed">
                    <Sparkles size={13} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                    <span>{step.tips}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Bottom Sticky Footer Bar */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium text-center sm:text-left leading-tight">
            💡 Quick Access: Click on any Route badge to visit that screen instantly.
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all cursor-pointer border-none shadow-sm active:scale-95"
          >
            Got it, Thanks!
          </button>
        </div>

      </div>
    </div>
  );
}
