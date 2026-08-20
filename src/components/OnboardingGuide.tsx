import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, HelpCircle, X, CheckSquare, Square, Play, ArrowRight, ChevronRight, CheckCircle2, ChevronLeft, Store, Briefcase, Search, Bell } from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingGuideProps {
  onboardingProgress: {
    steps: Array<{
      id: string;
      label: string;
      desc: string;
      completed: boolean;
    }>;
    completedCount: number;
    percentage: number;
  };
  isGuideOpen: boolean;
  setIsGuideOpen: (open: boolean) => void;
  tourStep: number | null;
  setTourStep: (step: number | null) => void;
}

export default function OnboardingGuide({
  onboardingProgress,
  isGuideOpen,
  setIsGuideOpen,
  tourStep,
  setTourStep
}: OnboardingGuideProps) {
  const navigate = useNavigate();
  const [activeAccordion, setActiveAccordion] = useState<string>('customer');

  // Interactive Tour Step Definitions
  const tourSteps = [
    {
      step: 1,
      title: "Business Mode Switcher",
      desc: "Invocentric has dual personalities! Switch between Freelancer Mode (to create proposals & service bills) and Shop Mode (for inventory items & retail quick billing) with one click.",
      highlightSelector: "#header-profile-dropdown", // near mode selector
      position: "top-right"
    },
    {
      step: 2,
      title: "Global Command Palette (⌘K)",
      desc: "Need to find an invoice, client, or service price? Press Ctrl+K or ⌘K from anywhere in the app to open the rapid real-time search box.",
      highlightSelector: "#desktop-search",
      position: "top-center"
    },
    {
      step: 3,
      title: "Navigation Sidebar & Accounting",
      desc: "Access your Invoices, customer Statements, Purchases, Expenses, and custom Reports in neat groups. You can collapse this sidebar to maximize your workspace.",
      highlightSelector: "#sidebar-nav",
      position: "left-center"
    },
    {
      step: 4,
      title: "Live Notification Panel",
      desc: "Receive instant notifications for low stock counts, payment confirmations, and background database backup schedules.",
      highlightSelector: "#header-notification-bell",
      position: "top-right"
    }
  ];

  const currentTour = tourStep !== null ? tourSteps[tourStep - 1] : null;

  const handleStartTour = () => {
    setIsGuideOpen(false);
    setTourStep(1);
  };

  const handleDismissForever = () => {
    localStorage.setItem('onboarding_guide_dismissed', 'true');
    setIsGuideOpen(false);
  };

  const isDismissed = localStorage.getItem('onboarding_guide_dismissed') === 'true';
  const isCompleted = onboardingProgress.completedCount === 4 || onboardingProgress.percentage >= 100;

  if (isCompleted || isDismissed) {
    return null;
  }

  return (
    <>
      {/* SIDE-DOCKED COLLAPSED TRIGGER TAB (Preventing overlapping main UI buttons or text) */}
      {!isGuideOpen && tourStep === null && (
        <button
          onClick={() => setIsGuideOpen(true)}
          className="fixed right-0 top-[42%] -translate-y-1/2 bg-slate-900 text-white rounded-l-2xl rounded-r-none pl-3.5 pr-2 py-5 shadow-2xl hover:bg-slate-800 transition-all duration-300 flex flex-col items-center gap-3 z-50 border-y border-l border-slate-800/80 hover:pl-4 group cursor-pointer"
          style={{ touchAction: 'manipulation' }}
          id="onboarding-guide-trigger"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles size={14} className="text-green-400 animate-pulse shrink-0" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
          </div>
          <span 
            className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Launch Guide ({onboardingProgress.completedCount}/4)
          </span>
          <ChevronLeft size={13} className="text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* EXPANDED GUIDE DRAWER PANEL */}
      {isGuideOpen && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-10 md:bottom-6 w-auto md:w-[390px] max-w-full bg-white rounded-3xl shadow-2xl shadow-slate-300 border border-slate-200/80 z-50 overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="bg-[#F0FDF4]/50 px-5 py-4 border-b border-slate-100 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#166534]" />
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Invocentric Launch Guide</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">Let's get your business rolling!</p>
              </div>
            </div>
            <button
              onClick={() => setIsGuideOpen(false)}
              className="p-1 hover:bg-slate-200/50 rounded-lg transition-all text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-5 pt-4 pb-1">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              <span>Overall Progress</span>
              <span className="text-[#166534]">{onboardingProgress.percentage}% Done</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full w-full relative">
              <div
                className="h-1.5 bg-[#166534] rounded-full absolute left-0 top-0 transition-all duration-300"
                style={{ width: `${onboardingProgress.percentage}%` }}
              ></div>
            </div>
          </div>

          {/* Action List / Checklist Accordion */}
          <div className="p-4 space-y-2 max-h-[220px] md:max-h-[380px] overflow-y-auto">
            {onboardingProgress.steps.map((step) => {
              const isCurrent = activeAccordion === step.id;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "border rounded-2xl transition-all overflow-hidden",
                    step.completed
                      ? "border-green-100/70 bg-green-50/5"
                      : isCurrent
                      ? "border-slate-200 bg-slate-50/20 shadow-sm"
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  )}
                >
                  {/* Header Row */}
                  <div
                    onClick={() => setActiveAccordion(isCurrent ? '' : step.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {step.completed ? (
                        <div className="w-5 h-5 rounded-full bg-[#F0FDF4] flex items-center justify-center border border-green-200 shrink-0">
                          <CheckCircle2 size={13} className="text-[#166534]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center shrink-0">
                          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                        </div>
                      )}
                      <div>
                        <p className={cn("text-[11.5px] font-black leading-tight", step.completed ? "text-slate-500 line-through" : "text-slate-800")}>
                          {step.label}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      size={14}
                      className={cn(
                        "text-slate-400 transition-transform duration-300",
                        isCurrent && "rotate-90 text-[#166534]"
                      )}
                    />
                  </div>

                  {/* Expanded Body */}
                  {isCurrent && (
                    <div className="px-3.5 pb-4 pt-1 text-[11px] text-slate-500 leading-normal border-t border-slate-50 space-y-3">
                      <p className="font-semibold text-slate-500">{step.desc}</p>
                      
                      {step.id === 'profile' && (
                        <div className="bg-emerald-50/40 p-2 border border-emerald-100/50 rounded-xl text-[10.5px] font-medium text-emerald-800">
                          ✓ Your business card is set up and complete. You can update details anytime in Settings.
                        </div>
                      )}

                      {step.id === 'customer' && !step.completed && (
                        <div className="space-y-2">
                          <p className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 leading-snug font-medium text-slate-500">
                            <strong>Tip:</strong> Parties can represent retail customers, corporate entities, or recurring clients. Adding them first lets you assign invoices in one click.
                          </p>
                          <button
                            onClick={() => {
                              setIsGuideOpen(false);
                              navigate('/customers');
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                          >
                            Add Your First Customer
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      )}

                      {step.id === 'item' && !step.completed && (
                        <div className="space-y-2">
                          <p className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 leading-snug font-medium text-slate-500">
                            <strong>Tip:</strong> Invocentric stores items in local cache with custom stock counts, HSN rates, and tax parameters so that your checkout process is instant.
                          </p>
                          <button
                            onClick={() => {
                              setIsGuideOpen(false);
                              navigate('/items');
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                          >
                            Add Inventory / Service
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      )}

                      {step.id === 'invoice' && !step.completed && (
                        <div className="space-y-2">
                          <p className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 leading-snug font-medium text-slate-500">
                            <strong>Tip:</strong> Simply choose your party, pick your inventory items, configure discounts or GST, and click Save. You can instantly print or generate shareable payment links.
                          </p>
                          <button
                            onClick={() => {
                              setIsGuideOpen(false);
                              navigate('/invoices/create');
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#166534] hover:bg-[#0C6A5F] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                          >
                            Create Invoice Now
                            <Sparkles size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Walkthrough Button / Tour Action */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2.5">
            <button
              onClick={handleStartTour}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md"
            >
              <Play size={12} className="fill-white" />
              Take Interactive App Tour
            </button>
            <div className="flex items-center justify-between px-1">
              <button
                onClick={handleDismissForever}
                className="text-[9px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors"
              >
                Dismiss Guide Forever
              </button>
              <span className="text-[9px] font-bold text-slate-400">Invocentric v1.2</span>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE APPS TOUR POPOVER TOOLTIP */}
      {tourStep !== null && currentTour && (
        <div className="fixed inset-0 bg-slate-950/20 z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white w-full max-w-sm rounded-3xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden animate-scaleIn">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#166534] rounded-full blur-2xl opacity-20"></div>
            
            {/* Top Step Counter */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-black uppercase tracking-widest text-green-400 bg-green-950/50 border border-green-900 px-2 py-0.5 rounded-full">
                App Tour: Step {currentTour.step} of 4
              </span>
              <button
                onClick={() => setTourStep(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Tour Body */}
            <h4 className="text-sm font-black tracking-tight mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-green-400" />
              {currentTour.title}
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed mb-6 font-medium">
              {currentTour.desc}
            </p>

            {/* Simulated Live visual hint mock-ups */}
            <div className="mb-6 p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
              {currentTour.step === 1 && (
                <div className="flex gap-2 text-[10px] font-bold select-none text-slate-400">
                  <span className="bg-[#F0FDF4] text-[#166534] border border-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                    <Store size={10} /> Shop Mode
                  </span>
                  <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded-full flex items-center gap-1">
                    <Briefcase size={10} /> Freelancer
                  </span>
                </div>
              )}
              {currentTour.step === 2 && (
                <div className="flex items-center gap-2 bg-[#F8FAFB] text-slate-400 text-[10px] px-3 py-1.5 rounded-xl w-48 border border-slate-800">
                  <Search size={10} />
                  <span>Search everything... (⌘K)</span>
                </div>
              )}
              {currentTour.step === 3 && (
                <div className="text-[9px] font-black tracking-widest text-green-400 uppercase">
                  SALES | INVENTORY | ACCOUNTING | REPORTS
                </div>
              )}
              {currentTour.step === 4 && (
                <div className="relative p-1.5 text-slate-400 border border-slate-800 rounded-xl">
                  <Bell size={14} />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400"></span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
              <button
                disabled={currentTour.step === 1}
                onClick={() => setTourStep(currentTour.step - 1)}
                className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
              >
                <ChevronLeft size={12} />
                Prev
              </button>
              
              <button
                onClick={() => setTourStep(null)}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider"
              >
                End Tour
              </button>

              {currentTour.step < 4 ? (
                <button
                  onClick={() => setTourStep(currentTour.step + 1)}
                  className="bg-[#166534] hover:bg-[#0C6A5F] text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md shadow-green-950/50"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setTourStep(null);
                    setIsGuideOpen(true);
                  }}
                  className="bg-green-500 hover:bg-green-400 text-slate-950 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                >
                  Done!
                  <CheckCircle2 size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
