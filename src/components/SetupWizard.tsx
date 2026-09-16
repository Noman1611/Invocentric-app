import React, { useRef, useState } from 'react';
import { 
  Building, User as UserIcon, Phone, Mail, MapPin, Landmark, QrCode, 
  LogOut, ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Shield, 
  HelpCircle, Check, Trash2, Upload, MessageSquare, BookOpen, Eye, X,
  Globe, CreditCard, Paintbrush, ChevronRight, FileText
} from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '../lib/utils';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { setSecureStorage } from '../utils/cryptoUtils';
import { getStoredUserProfile, saveStoredUserProfile } from '../utils/settingsStorage';

interface SetupWizardProps {
  wizardForm: {
    business_name: string;
    owner_name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    upi_id: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    account_holder: string;
    currency: string;
    business_type: string;
    gstin: string;
    business_description: string;
    business_logo: string;
    theme_color: string;
    invoice_prefix: string;
    default_terms: string;
  };
  setWizardForm: React.Dispatch<React.SetStateAction<any>>;
  wizardStep: number;
  setWizardStep: React.Dispatch<React.SetStateAction<number>>;
  savingWizard: boolean;
  setSavingWizard: React.Dispatch<React.SetStateAction<boolean>>;
  isOfflineMode: boolean;
  user: any;
  logout: () => void;
  setShowProfileSuccessToast?: React.Dispatch<React.SetStateAction<boolean>>;
  onComplete?: (updatedData: any) => void;
  onDismiss?: () => void;
}

// Modern Outlined Floating Label Input Component matching reference screenshot
function FloatingInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  icon: Icon,
  disabled = false,
  maxLength,
  rows,
  helperText
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  icon?: any;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  helperText?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined && value !== null && value.toString().trim() !== '';

  return (
    <div className="relative my-2.5">
      {/* Floating Label sitting cut on top border line */}
      <label className={cn(
        "absolute left-3 bg-white px-1.5 text-xs font-bold transition-all duration-200 pointer-events-none z-10 flex items-center gap-0.5",
        isFocused || hasValue
          ? "-top-2.5 text-green-700 scale-95"
          : "top-3.5 text-slate-400 font-medium"
      )}>
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <div className={cn(
        "relative rounded-lg bg-white border transition-all duration-200 flex items-center",
        isFocused
          ? "border-green-600 ring-2 ring-green-600/15 shadow-sm"
          : "border-slate-300 hover:border-slate-400"
      )}>
        {Icon && (
          <div className="pl-3.5 text-slate-400 shrink-0">
            <Icon size={16} />
          </div>
        )}

        {rows ? (
          <textarea
            rows={rows}
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isFocused ? placeholder : ''}
            disabled={disabled}
            className="w-full px-3.5 py-3 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none resize-none"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isFocused ? placeholder : ''}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            className="w-full h-12 px-3.5 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"
          />
        )}
      </div>
      {helperText && (
        <span className="text-[11px] text-slate-400 font-medium mt-1 block px-1">
          {helperText}
        </span>
      )}
    </div>
  );
}

export default function SetupWizard({
  wizardForm,
  setWizardForm,
  wizardStep,
  setWizardStep,
  savingWizard,
  setSavingWizard,
  isOfflineMode,
  user,
  logout,
  setShowProfileSuccessToast,
  onComplete,
  onDismiss
}: SetupWizardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [helpTab, setHelpTab] = useState<'steps' | 'support'>('steps');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [submittingSupport, setSubmittingSupport] = useState(false);

  const handleNext = () => {
    if (wizardStep < 4) setWizardStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (wizardStep > 1) setWizardStep(prev => prev - 1);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Logo size should be under 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setWizardForm((prev: any) => ({
          ...prev,
          business_logo: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setWizardForm((prev: any) => ({
      ...prev,
      business_logo: ''
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSkipSetup = () => {
    try {
      if (user?.uid) {
        localStorage.setItem(`wizard_completed_${user.uid}`, 'true');
        setSecureStorage(`wizard_completed_${user.uid}`, true);
      }
      localStorage.setItem('wizard_completed_global', 'true');
    } catch (err) {
      console.error("Localstorage skip error:", err);
    }

    if (onDismiss) {
      onDismiss();
    }
    if (onComplete) {
      onComplete({ wizard_completed: true });
    }

    // Background sync to Firestore without blocking user or UI
    if (user?.uid && !isOfflineMode && navigator.onLine) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        setDoc(userDocRef, {
          wizard_completed: true,
          updated_at: serverTimestamp()
        }, { merge: true }).catch(err => console.warn("Background skip sync error:", err));
      } catch (err) {
        console.warn("Background skip error:", err);
      }
    }
  };

  const handleCompleteSetup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setSavingWizard(true);
    const existingProfile = getStoredUserProfile(user?.uid) || {};
    const updatedData = {
      ...existingProfile,
      ...wizardForm,
      business_name: wizardForm.business_name?.trim() || existingProfile.business_name || user?.displayName || 'My Business',
      owner_name: wizardForm.owner_name || existingProfile.owner_name || user?.displayName || 'Owner',
      display_name: wizardForm.owner_name || existingProfile.display_name || user?.displayName || 'Owner',
      email: wizardForm.email || existingProfile.email || user?.email || '',
      wizard_completed: true,
      updated_at: new Date().toISOString()
    };

    // 1. Instantly cache locally & notify parent callback so UI unlocks immediately
    try {
      if (user?.uid) {
        localStorage.setItem(`wizard_completed_${user.uid}`, 'true');
        saveStoredUserProfile(user?.uid, updatedData);
        localStorage.removeItem(`wizard_draft_${user.uid}`);
        setSecureStorage(`wizard_completed_${user.uid}`, true);
      }
      localStorage.setItem('wizard_completed_global', 'true');
    } catch (err) {
      console.error("Localstorage cache error:", err);
    }

    // 2. Instantly unlock UI via onDismiss and onComplete
    if (onDismiss) {
      onDismiss();
    }
    if (onComplete) {
      onComplete(updatedData);
    }
    if (setShowProfileSuccessToast) {
      setShowProfileSuccessToast(true);
    }

    setTimeout(() => {
      setSavingWizard(false);
    }, 300);

    // 3. Persist to DB and Firestore asynchronously in background (fire-and-forget)
    if (user?.uid && !isOfflineMode && navigator.onLine) {
      const userDocRef = doc(db, 'users', user.uid);
      setDoc(userDocRef, {
        ...updatedData,
        updated_at: serverTimestamp()
      }, { merge: true })
      .then(() => dbService.update('users', user.uid, updatedData, { offlineMode: isOfflineMode, userId: user.uid }))
      .catch(err => console.warn("Remote billing profile save warning:", err));
    }
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSubmittingSupport(true);
    setTimeout(() => {
      setSubmittingSupport(false);
      setSupportSubmitted(true);
      setSupportMessage('');
    }, 1200);
  };

  const STEPS = [
    { id: 1, title: 'Business details', subtitle: 'Add basic information about your business', icon: Building },
    { id: 2, title: 'Contact details', subtitle: 'Add business address and contact channels', icon: Phone },
    { id: 3, title: 'Payment methods', subtitle: 'Setup instant payment options for invoices', icon: Landmark },
    { id: 4, title: 'Branding & Terms', subtitle: 'Customize logo, colors, and default terms', icon: Paintbrush },
  ];

  const logoInitials = wizardForm.business_name ? wizardForm.business_name.substring(0, 1).toUpperCase() : 'B';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 antialiased">
      
      {/* Main Split Screen Container matching InsideBox reference layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
        
        {/* LEFT SIDEBAR PANEL: App Brand + Vertical Steps List */}
        <aside className="w-full lg:w-80 xl:w-88 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-6 xl:p-8 flex flex-col justify-between shrink-0 shadow-sm">
          
          <div>
            {/* Top Brand Logo Header */}
            <div className="flex items-center gap-3 mb-10">
              <Logo size={44} showBg={true} />
              <div>
                <h1 className="font-brand text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  InvoCentric
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-700">Business Setup</p>
              </div>
            </div>

            {/* Vertical Step Progress List */}
            <nav className="space-y-4">
              {STEPS.map((stepItem) => {
                const isCompleted = stepItem.id < wizardStep;
                const isActive = stepItem.id === wizardStep;

                return (
                  <button
                    key={stepItem.id}
                    type="button"
                    onClick={() => {
                      if (stepItem.id <= wizardStep || isCompleted) {
                        setWizardStep(stepItem.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3.5 p-3 rounded-xl text-left transition-all duration-200 group cursor-pointer",
                      isActive 
                        ? "bg-green-50/80 text-green-700 font-bold" 
                        : isCompleted
                        ? "text-slate-800 hover:bg-slate-50 font-semibold"
                        : "text-slate-400 hover:bg-slate-50 font-medium"
                    )}
                  >
                    {/* Circle Indicator Icon */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-200",
                      isCompleted
                        ? "bg-emerald-600 text-white"
                        : isActive
                        ? "border-2 border-green-700 text-green-700 bg-white font-black"
                        : "border border-slate-300 text-slate-400 bg-white"
                    )}>
                      {isCompleted ? (
                        <Check size={16} className="text-white font-bold" />
                      ) : (
                        <span>{stepItem.id}</span>
                      )}
                    </div>

                    {/* Step Title Label */}
                    <span className={cn(
                      "text-sm tracking-tight",
                      isActive ? "text-green-700 font-bold" : isCompleted ? "text-slate-800 font-semibold" : "text-slate-500 font-medium"
                    )}>
                      {stepItem.title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Left Sidebar Footer: Preview Invoice Button & Auto Save status */}
          <div className="mt-10 pt-6 border-t border-slate-100 space-y-3">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="w-full py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Eye size={15} className="text-green-700" />
                Live Invoice Preview
              </span>
              <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Auto-saving draft
              </span>
              <span className="text-slate-300">|</span>
              <button onClick={logout} className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1">
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </div>

        </aside>

        {/* RIGHT MAIN PANEL: Top Bar + Form Content + Bottom Nav */}
        <main className="flex-1 flex flex-col justify-between p-6 md:p-12 xl:p-16 max-w-4xl mx-auto w-full">
          
          {/* Top Bar Header with Help Link */}
          <div className="flex items-center justify-between pb-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-green-800 bg-green-50 border border-green-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Step {wizardStep} of 4
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={handleSkipSetup}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs md:text-sm transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300/80 shadow-xs"
              >
                Skip & Go to Dashboard
                <ArrowRight size={14} />
              </button>
              <button 
                type="button"
                onClick={() => { setShowHelpModal(true); setHelpTab('steps'); }}
                className="text-slate-500 hover:text-green-700 text-xs md:text-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                Having trouble? <span className="text-green-700 font-bold underline">Get Help</span>
              </button>
            </div>
          </div>

          {/* Active Step Header Title & Subtitle */}
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              {STEPS[wizardStep - 1].title === 'Business details' ? 'About your company' : STEPS[wizardStep - 1].title}
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {STEPS[wizardStep - 1].subtitle}
            </p>
          </div>

          {/* Form Content Area */}
          <div className="flex-1 space-y-6">
            
            {/* STEP 1: BUSINESS DETAILS */}
            {wizardStep === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <FloatingInput
                  label="Business name"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={wizardForm.business_name}
                  onChange={(e) => setWizardForm((p: any) => ({ ...p, business_name: e.target.value }))}
                  icon={Building}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatingInput
                    label="Owner full name"
                    required
                    placeholder="e.g. John Doe"
                    value={wizardForm.owner_name}
                    onChange={(e) => setWizardForm((p: any) => ({ ...p, owner_name: e.target.value }))}
                    icon={UserIcon}
                  />

                  <FloatingInput
                    label="Business type"
                    placeholder="e.g. Retail Shop, Agency, IT Services"
                    value={wizardForm.business_type}
                    onChange={(e) => setWizardForm((p: any) => ({ ...p, business_type: e.target.value }))}
                    icon={Building}
                  />
                </div>

                <FloatingInput
                  label="GSTIN Number (Optional)"
                  placeholder="e.g. 22AAAAA1111A1Z1"
                  value={wizardForm.gstin}
                  onChange={(e) => setWizardForm((p: any) => ({ ...p, gstin: e.target.value }))}
                  icon={Landmark}
                />

                <FloatingInput
                  label="Business description (Optional)"
                  placeholder="e.g. We provide professional digital solutions and premium consultancy."
                  rows={2}
                  value={wizardForm.business_description}
                  onChange={(e) => setWizardForm((p: any) => ({ ...p, business_description: e.target.value }))}
                />

                {/* Logo Upload Box */}
                <div className="pt-2">
                  <label className="text-xs font-bold text-slate-600 block mb-2">Business Logo (Optional)</label>
                  <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                  
                  <div className="flex items-center gap-4 bg-white border border-slate-300 rounded-lg p-3.5">
                    {wizardForm.business_logo ? (
                      <div className="relative group shrink-0">
                        <img src={wizardForm.business_logo} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center font-black text-lg text-white shrink-0"
                        style={{ backgroundColor: wizardForm.theme_color || '#166534' }}
                      >
                        {logoInitials}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {wizardForm.business_logo ? "Custom Logo Attached" : "Upload your business logo"}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">PNG or JPG under 2MB. Appears on invoices.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Upload size={14} />
                      {wizardForm.business_logo ? 'Change' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: CONTACT DETAILS */}
            {wizardStep === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatingInput
                    label="Business phone"
                    type="tel"
                    required
                    placeholder="e.g. +91 99999 99999"
                    value={wizardForm.phone}
                    onChange={(e) => setWizardForm((p: any) => ({ ...p, phone: e.target.value }))}
                    icon={Phone}
                  />

                  <FloatingInput
                    label="Business email"
                    type="email"
                    required
                    placeholder="e.g. info@yourbusiness.com"
                    value={wizardForm.email}
                    onChange={(e) => setWizardForm((p: any) => ({ ...p, email: e.target.value }))}
                    icon={Mail}
                  />
                </div>

                <FloatingInput
                  label="Street address"
                  required
                  placeholder="e.g. 123 Business Lane, Sector 5"
                  value={wizardForm.address}
                  onChange={(e) => setWizardForm((p: any) => ({ ...p, address: e.target.value }))}
                  icon={MapPin}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FloatingInput
                    label="City"
                    placeholder="e.g. Mumbai"
                    value={wizardForm.city}
                    onChange={(e) => setWizardForm((p: any) => ({ ...p, city: e.target.value }))}
                  />

                  <FloatingInput
                    label="State"
                    placeholder="e.g. Maharashtra"
                    value={wizardForm.state}
                    onChange={(e) => setWizardForm((p: any) => ({ ...p, state: e.target.value }))}
                  />

                  <FloatingInput
                    label="Pincode"
                    placeholder="e.g. 400001"
                    value={wizardForm.pincode}
                    onChange={(e) => setWizardForm((p: any) => ({ ...p, pincode: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT METHODS */}
            {wizardStep === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <FloatingInput
                  label="UPI Address (For QR Code Scan-to-Pay)"
                  placeholder="merchant@upi or mobile number ID"
                  value={wizardForm.upi_id}
                  onChange={(e) => setWizardForm((p: any) => ({ ...p, upi_id: e.target.value }))}
                  icon={QrCode}
                  helperText="Enables dynamic QR code on printed and PDF invoices"
                />

                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-xs font-bold text-slate-700 block mb-2">Direct Bank Account Details</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FloatingInput
                      label="Bank name"
                      placeholder="e.g. HDFC Bank"
                      value={wizardForm.bank_name}
                      onChange={(e) => setWizardForm((p: any) => ({ ...p, bank_name: e.target.value }))}
                      icon={Landmark}
                    />

                    <FloatingInput
                      label="Account holder name"
                      placeholder="e.g. Acme Corporation"
                      value={wizardForm.account_holder}
                      onChange={(e) => setWizardForm((p: any) => ({ ...p, account_holder: e.target.value }))}
                      icon={UserIcon}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FloatingInput
                      label="Account number"
                      placeholder="e.g. 50100123456789"
                      value={wizardForm.account_number}
                      onChange={(e) => setWizardForm((p: any) => ({ ...p, account_number: e.target.value }))}
                      icon={CreditCard}
                    />

                    <FloatingInput
                      label="IFSC Code"
                      placeholder="e.g. HDFC0000123"
                      value={wizardForm.ifsc_code}
                      onChange={(e) => setWizardForm((p: any) => ({ ...p, ifsc_code: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: BRANDING & TERMS */}
            {wizardStep === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <FloatingInput
                  label="Invoice number prefix"
                  placeholder="e.g. INV"
                  maxLength={6}
                  value={wizardForm.invoice_prefix}
                  onChange={(e) => setWizardForm((p: any) => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))}
                  helperText="Invoices will be formatted like INV-001, INV-002"
                />

                <div className="my-3">
                  <label className="text-xs font-bold text-slate-600 block mb-2">Brand Accent Color</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { hex: '#166534', name: 'Brand Green' },
                      { hex: '#16a34a', name: 'Emerald' },
                      { hex: '#2563EB', name: 'Blue' },
                      { hex: '#7C3AED', name: 'Purple' },
                      { hex: '#D97706', name: 'Amber' },
                      { hex: '#0F172A', name: 'Dark Slate' }
                    ].map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => setWizardForm((p: any) => ({ ...p, theme_color: color.hex }))}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer border border-white shadow-sm",
                          wizardForm.theme_color === color.hex ? "ring-2 ring-green-600 ring-offset-2 scale-110" : "hover:scale-105"
                        )}
                        style={{ backgroundColor: color.hex }}
                      >
                        {wizardForm.theme_color === color.hex && (
                          <Check size={14} className="text-white font-bold" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <FloatingInput
                  label="Default invoice terms & notes"
                  placeholder="Payment is due within 15 days from date of invoice."
                  rows={3}
                  value={wizardForm.default_terms}
                  onChange={(e) => setWizardForm((p: any) => ({ ...p, default_terms: e.target.value }))}
                />
              </div>
            )}

          </div>

          {/* Bottom Navigation Controls Bar matching InsideBox reference */}
          <div className="pt-8 mt-8 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {wizardStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  Previous step
                </button>
              )}
              <button
                type="button"
                onClick={handleSkipSetup}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-lg text-xs sm:text-sm transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                Skip & Go to Dashboard
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-8 py-2.5 bg-[#166534] hover:bg-[#0B665C] text-white font-bold rounded-lg text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  Next step
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCompleteSetup()}
                  disabled={savingWizard}
                  className="px-8 py-2.5 bg-[#166534] hover:bg-[#0B665C] text-white font-bold rounded-lg text-sm transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {savingWizard ? 'Saving...' : 'Complete Setup'}
                  <CheckCircle2 size={16} />
                </button>
              )}
            </div>
          </div>

        </main>

      </div>

      {/* LIVE INVOICE PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Eye size={18} className="text-green-700" />
                Live Invoice Preview
              </h3>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </header>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4 text-xs">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="font-black text-slate-900 text-base uppercase">{wizardForm.business_name || 'Your Business Name'}</h2>
                    <p className="text-slate-500">{wizardForm.business_type || 'Services / Agency'}</p>
                  </div>
                  <span className="font-bold text-green-800 bg-green-50 border border-green-200/80 px-2 py-0.5 rounded text-[11px]">
                    # {wizardForm.invoice_prefix || 'INV'}-001
                  </span>
                </div>

                <div className="text-slate-500 space-y-0.5">
                  <p>{wizardForm.address || 'Your Business Address'}</p>
                  <p>{wizardForm.phone} • {wizardForm.email}</p>
                  {wizardForm.gstin && <p className="text-green-700 font-bold">GSTIN: {wizardForm.gstin}</p>}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between font-bold text-slate-800 text-sm">
                    <span>Sample Total</span>
                    <span style={{ color: wizardForm.theme_color || '#166534' }}>₹15,000.00</span>
                  </div>
                </div>

                {(wizardForm.upi_id || wizardForm.bank_name) && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <p className="font-bold text-slate-800">Payment Details:</p>
                    {wizardForm.upi_id && <p>UPI: {wizardForm.upi_id}</p>}
                    {wizardForm.bank_name && <p>Bank: {wizardForm.bank_name} ({wizardForm.account_number})</p>}
                  </div>
                )}
              </div>
            </div>

            <footer className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 bg-[#166534] hover:bg-[#0B665C] text-white font-bold rounded-lg text-xs"
              >
                Close Preview
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* HELP & SUPPORT CENTER OVERLAY */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            <header className="bg-slate-50 border-b border-slate-200/60 p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HelpCircle size={20} className="text-green-700" />
                <h3 className="font-bold text-slate-800 text-base">InvoCentric Support</h3>
              </div>
              <button 
                onClick={() => { setShowHelpModal(false); setSupportSubmitted(false); }}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 text-xs font-bold"
              >
                ✕
              </button>
            </header>

            <nav className="flex border-b border-slate-100 bg-slate-50">
              <button
                onClick={() => { setHelpTab('steps'); setSupportSubmitted(false); }}
                className={cn(
                  "flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all cursor-pointer",
                  helpTab === 'steps' ? "border-green-700 text-green-700" : "border-transparent text-slate-400"
                )}
              >
                Guide
              </button>
              <button
                onClick={() => { setHelpTab('support'); setSupportSubmitted(false); }}
                className={cn(
                  "flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all cursor-pointer",
                  helpTab === 'support' ? "border-green-700 text-green-700" : "border-transparent text-slate-400"
                )}
              >
                Contact Support
              </button>
            </nav>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600">
              {helpTab === 'steps' && (
                <div className="space-y-3">
                  <p className="font-medium text-slate-700">
                    Fill out each section to configure your billing profile. Your progress is auto-saved in your browser so you will not lose typed data!
                  </p>
                  <ul className="space-y-2 text-slate-500">
                    <li>• <strong>Step 1:</strong> Business & Owner name for tax invoices.</li>
                    <li>• <strong>Step 2:</strong> Phone, email, address for invoice headers.</li>
                    <li>• <strong>Step 3:</strong> UPI or Bank account for instant payments.</li>
                    <li>• <strong>Step 4:</strong> Brand accent color and invoice terms.</li>
                  </ul>
                </div>
              )}

              {helpTab === 'support' && (
                <div>
                  {supportSubmitted ? (
                    <div className="text-center py-6 space-y-2">
                      <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                      <h4 className="font-bold text-slate-800 text-sm">Ticket Received!</h4>
                      <p className="text-slate-500 text-xs">We will contact you shortly at your registered email address.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSupportSubmit} className="space-y-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Your Question / Issue:</label>
                        <textarea
                          required
                          rows={3}
                          value={supportMessage}
                          onChange={(e) => setSupportMessage(e.target.value)}
                          placeholder="Describe what help you need..."
                          className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submittingSupport}
                        className="w-full py-2 bg-[#166534] hover:bg-[#0B665C] text-white font-bold rounded-lg text-xs"
                      >
                        {submittingSupport ? 'Sending...' : 'Submit Ticket'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
