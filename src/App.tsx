/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './components/Logo';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import AutoBackup from './components/AutoBackup';
import DataBackupRecoveryModal from './components/DataBackupRecoveryModal';
import MigrationModal from './components/MigrationModal';
import { cn } from './lib/utils';

// Lazy load pages for performance (code splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const InvoicesPage = lazy(() => import('./pages/Invoices'));
const QuotationsPage = lazy(() => import('./pages/Quotations'));
const CustomersPage = lazy(() => import('./pages/Customers'));
const ItemsPage = lazy(() => import('./pages/Items'));
const ExpensesPage = lazy(() => import('./pages/Expenses'));
const PurchasesPage = lazy(() => import('./pages/Purchases'));
const DailyBookPage = lazy(() => import('./pages/DailyBook'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const CreateInvoicePage = lazy(() => import('./pages/CreateInvoice'));
const InvoiceViewPage = lazy(() => import('./pages/InvoiceView'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const AdminPage = lazy(() => import('./pages/Admin'));
const PricingPage = lazy(() => import('./pages/Pricing'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const StatementPage = lazy(() => import('./pages/Statement'));
const PaymentsPage = lazy(() => import('./pages/Payments'));
const QrGeneratorPage = lazy(() => import('./pages/QrGenerator'));
const BarcodeGeneratorPage = lazy(() => import('./pages/BarcodeGenerator'));
const QuickPOSPage = lazy(() => import('./pages/QuickPOS'));
const MobileScanPage = lazy(() => import('./pages/MobileScan'));
const SeoLandingPage = lazy(() => import('./pages/SeoLandingPage'));
const GstCalculatorPage = lazy(() => import('./pages/GstCalculatorPage'));

function PageLoader() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-neutral-50">
      <motion.div
         animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Logo size={64} className=" shadow-green-900/10" />
      </motion.div>
    </div>
  );
}

import { Store, Briefcase, Search, Bell, ChevronDown, CheckCircle, Settings, User as UserIcon, LogOut, X, Loader, Phone, Building, Globe, FileText, Package, Users, TrendingDown, HelpCircle, Sparkles, Play, Check, CheckSquare, Square, ArrowRight, AlertCircle, Info, Landmark, QrCode, Video, Copy, ScanLine, Plus } from 'lucide-react';
import { initializeUsbScanner, registerScanListener, registerStatusListener, getScannerSessionId } from './utils/usbScanner';
import { playScanBeepSound } from './utils/cameraUtils';
import { QRCodeSVG } from 'qrcode.react';
import { PlanGate } from './components/PlanGate';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices, useCustomers, useItems, useNotifications, useSettings } from './hooks/useData';
import { getSecureStorage, setSecureStorage } from './utils/cryptoUtils';
import { dbService } from './services/dbService';
import { getRelativeTimeString } from './utils/dateUtils';
import { db, auth } from './lib/firebase';
import { doc, setDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import SetupWizard from './components/SetupWizard';
import OnboardingGuide from './components/OnboardingGuide';
import DemoScriptModal from './components/DemoScriptModal';
import firebaseConfig from '../firebase-applet-config.json';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { 
    user, 
    loading, 
    logout, 
    isOfflineMode, 
    appMode, 
    setAppMode, 
    planTier,
    isPcDriveEnabled,
    isPcFileConnected,
    pcFileName,
    unlockPcDriveFile,
    isAdmin
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Global Mobile Scanner State & Listener
  const [isGlobalScannerModalOpen, setIsGlobalScannerModalOpen] = useState(false);
  const [isPhoneScannerConnected, setIsPhoneScannerConnected] = useState(false);

  useEffect(() => {
    initializeUsbScanner();
    const unsubStatus = registerStatusListener((connected) => {
      setIsPhoneScannerConnected(connected);
    });
    const unsubScan = registerScanListener((code) => {
      if (!code) return;
      playScanBeepSound(true);
      // Dispatch custom global event so any active page or component can listen
      const event = new CustomEvent('invocentric-global-scan', { detail: { code } });
      window.dispatchEvent(event);

      // Automatically type/insert into active focused input or textarea across any section
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
                                      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(activeEl, code);
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    return () => {
      unsubStatus();
      unsubScan();
    };
  }, []);

  // Real-time Settings Hook
  const { settings, loading: settingsLoading, setSettings } = useSettings();

  // Global admin approval alert popup
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [dismissedRequests, setDismissedRequests] = useState<string[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [adminToast, setAdminToast] = useState<string | null>(null);

  const isHardcodedAdmin = user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const showAdmin = isHardcodedAdmin || isAdmin;

  useEffect(() => {
    if (!showAdmin) return;
    
    const q = query(collection(db, 'subscription_requests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdminRequests(requests);
    }, (error) => {
      console.error("Error listening to subscription requests globally:", error);
    });

    return () => unsubscribe();
  }, [showAdmin]);

  // Helper to cleanup any duplicate pending subscription requests for a user
  const cleanupUserPendingRequests = async (userId: string, email: string, excludeRequestId?: string) => {
    if (!db) return;
    try {
      const processDocs = async (q: any) => {
        const snap = await getDocs(q);
        for (const dSnap of snap.docs) {
          if (!excludeRequestId || dSnap.id !== excludeRequestId) {
            const rRef = doc(db, 'subscription_requests', dSnap.id);
            await updateDoc(rRef, { status: 'rejected', rejected_at: new Date().toISOString() }).catch(() => {});
            await deleteDoc(rRef).catch(() => {});
          }
        }
      };

      if (userId) {
        await processDocs(query(collection(db, 'subscription_requests'), where('user_id', '==', userId), where('status', '==', 'pending')));
      }
      if (email && email !== 'Unknown User') {
        await processDocs(query(collection(db, 'subscription_requests'), where('user_email', '==', email), where('status', '==', 'pending')));
      }
    } catch (err) {
      console.warn("Failed to cleanup duplicate pending requests:", err);
    }
  };

  const handleGlobalApprove = async (req: any) => {
    setActionInProgress(req.id);
    const targetUserId = req.user_id || req.uid || '';
    const targetUserEmail = req.user_email || req.email || 'Unknown User';
    const targetUpiIdRef = req.upi_id_ref || req.upiId || 'N/A';

    try {
      // 1. Update subscription_requests status to 'approved'
      const requestRef = doc(db, 'subscription_requests', req.id);
      await updateDoc(requestRef, {
        status: 'approved',
        approved_at: new Date().toISOString()
      });

      // Cleanup any other pending requests for this user so duplicates are removed
      await cleanupUserPendingRequests(targetUserId, targetUserEmail, req.id);

      if (targetUserId) {
        // 2. Upgrade the User in Firestore (unlock Pro)
        const userRef = doc(db, 'users', targetUserId);
        await setDoc(userRef, {
          plan: 'pro',
          plan_tier: 'pro',
          plan_status: 'active',
          subscription_pending: false,
          subscription_status: 'active',
          subscription_request_ref: null,
          plan_renews_at: req.billing_cycle === 'yearly' 
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, { merge: true });

        // 3. Log a record in payments_subscription
        await dbService.add('payments_subscription', {
          user_id: targetUserId,
          user_email: targetUserEmail,
          amount: req.amount,
          billing_cycle: req.billing_cycle || 'monthly',
          payment_method: 'upi',
          date: new Date().toISOString(),
          status: 'success'
        }, { offlineMode: false, userId: targetUserId });

        // Add expense record
        await dbService.add('expenses', {
          description: `InvoCentric Pro Subscription (${req.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'})`,
          amount: req.amount,
          category: 'Office Supplies',
          date: new Date().toISOString(),
          payment_method: 'UPI',
          user_id: targetUserId,
          created_at: new Date().toISOString()
        }, { offlineMode: false, userId: targetUserId });

        // 4. Push a real-time notification to the user
        await dbService.add('notifications', {
          user_id: targetUserId,
          text: `🎉 Pro Plan Activated! Your UPI Reference ${targetUpiIdRef} of ₹${req.amount} was verified successfully by Shekh Mahammad Noman. Thank you!`,
          read: false,
          category: 'other',
          created_at: new Date().toISOString()
        }, { offlineMode: false, userId: targetUserId });
      }

      // 5. Trigger backend automatic receipt dispatch
      try {
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          await fetch('/api/subscription/approve-receipt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              userId: targetUserId,
              userEmail: targetUserEmail,
              amount: req.amount,
              billingCycle: req.billing_cycle || 'monthly',
              upiIdRef: targetUpiIdRef
            })
          });
        }
      } catch (notifyErr) {
        console.error("Backend receipt error in global approval:", notifyErr);
      }

      setAdminToast("Plan Approved Successfully!");
      setTimeout(() => setAdminToast(null), 3000);
    } catch (err) {
      console.error("Failed to approve subscription globally:", err);
      alert("Error approving subscription.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleGlobalReject = async (req: any) => {
    const targetUserId = req.user_id || req.uid || '';
    const targetUserEmail = req.user_email || req.email || 'Unknown User';
    const targetUpiIdRef = req.upi_id_ref || req.upiId || 'N/A';

    const confirmed = window.confirm(`Are you sure you want to REJECT subscription request for ${targetUserEmail} (Ref: ${targetUpiIdRef})?`);
    if (!confirmed) return;

    setActionInProgress(req.id);
    try {
      const requestRef = doc(db, 'subscription_requests', req.id);
      await updateDoc(requestRef, { status: 'rejected', rejected_at: new Date().toISOString() }).catch(() => {});
      await deleteDoc(requestRef).catch(() => {});
      await cleanupUserPendingRequests(targetUserId, targetUserEmail, req.id);

      if (targetUserId) {
        const userRef = doc(db, 'users', targetUserId);
        await updateDoc(userRef, {
          subscription_pending: false,
          subscription_status: 'rejected'
        });

        await dbService.add('notifications', {
          user_id: targetUserId,
          text: `⚠️ UPI Verification Failed: Reference ${targetUpiIdRef} could not be matched with our SBI account. Please try again with correct details.`,
          read: false,
          category: 'other',
          created_at: new Date().toISOString()
        }, { offlineMode: false, userId: targetUserId });
      }

      setAdminToast("Request Rejected Successfully");
      setTimeout(() => setAdminToast(null), 3000);
    } catch (err) {
      console.error("Failed to reject subscription globally:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const visibleAdminRequests = adminRequests.filter(r => !dismissedRequests.includes(r.id));

  // Wizard form state
  const [wizardForm, setWizardForm] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    upi_id: '',
    bank_name: '',
    bank_branch: '',
    account_number: '',
    ifsc_code: '',
    account_holder: '',
    currency: 'INR',
    business_type: '',
    gstin: '',
    business_description: '',
    business_logo: '',
    theme_color: '#166534',
    invoice_prefix: 'INV',
    default_terms: 'Payment is due within 15 days from the date of invoice.'
  });
  const [wizardStep, setWizardStep] = useState(1);
  const [savingWizard, setSavingWizard] = useState(false);

  const isWizardInitialized = useRef(false);

  // Initialize wizardForm ONCE from local draft or remote settings
  useEffect(() => {
    if (settings && !isWizardInitialized.current) {
      // Check for saved local draft first to avoid losing progress
      let draft: any = null;
      if (user?.uid) {
        try {
          const saved = localStorage.getItem(`wizard_draft_${user.uid}`);
          if (saved) draft = JSON.parse(saved);
        } catch (e) {
          console.error("Error reading wizard draft:", e);
        }
      }

      setWizardForm({
        business_name: draft?.business_name ?? settings.business_name ?? '',
        owner_name: draft?.owner_name ?? settings.owner_name ?? settings.display_name ?? user?.displayName ?? '',
        phone: draft?.phone ?? settings.phone ?? '',
        email: draft?.email ?? settings.email ?? user?.email ?? '',
        address: draft?.address ?? settings.address ?? '',
        city: draft?.city ?? settings.city ?? '',
        state: draft?.state ?? settings.state ?? '',
        pincode: draft?.pincode ?? settings.pincode ?? '',
        upi_id: draft?.upi_id ?? settings.upi_id ?? '',
        bank_name: draft?.bank_name ?? settings.bank_name ?? '',
        bank_branch: draft?.bank_branch ?? settings.bank_branch ?? '',
        account_number: draft?.account_number ?? settings.account_number ?? '',
        ifsc_code: draft?.ifsc_code ?? settings.ifsc_code ?? '',
        account_holder: draft?.account_holder ?? settings.account_holder ?? '',
        currency: draft?.currency ?? settings.currency ?? 'INR',
        business_type: draft?.business_type ?? settings.business_type ?? '',
        gstin: draft?.gstin ?? settings.gstin ?? '',
        business_description: draft?.business_description ?? settings.business_description ?? '',
        business_logo: draft?.business_logo ?? settings.business_logo ?? '',
        theme_color: draft?.theme_color ?? settings.theme_color ?? '#166534',
        invoice_prefix: draft?.invoice_prefix ?? settings.invoice_prefix ?? 'INV',
        default_terms: draft?.default_terms ?? settings.default_terms ?? 'Payment is due within 15 days from the date of invoice.'
      });
      isWizardInitialized.current = true;
    }
  }, [settings, user]);

  // Continuously auto-save wizardForm draft locally so typing is NEVER lost
  useEffect(() => {
    if (isWizardInitialized.current && user?.uid) {
      try {
        localStorage.setItem(`wizard_draft_${user.uid}`, JSON.stringify(wizardForm));
      } catch (e) {
        console.error("Error saving wizard draft:", e);
      }
    }
  }, [wizardForm, user?.uid]);

  const isProfileIncomplete = useMemo(() => {
    if (user?.uid && localStorage.getItem(`wizard_completed_${user.uid}`) === 'true') {
      return false;
    }
    if (settingsLoading) return false;
    if (!settings) return true;
    if (settings.wizard_completed === true || settings.wizard_completed === 'true') {
      if (user?.uid) {
        localStorage.setItem(`wizard_completed_${user.uid}`, 'true');
      }
      return false;
    }
    
    const hasBusinessName = !!settings.business_name?.trim();
    const hasPhone = !!settings.phone?.trim();
    const hasPayment = !!settings.upi_id?.trim() || !!settings.bank_name?.trim();
    
    if (hasBusinessName || hasPhone) {
      if (user?.uid) {
        localStorage.setItem(`wizard_completed_${user.uid}`, 'true');
      }
      return false;
    }

    return !hasBusinessName || !hasPhone || !hasPayment;
  }, [settings, settingsLoading, user?.uid]);

  // Onboarding Guide & Walkthrough States
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [isDemoScriptOpen, setIsDemoScriptOpen] = useState(false);

  // Theme State forced to light
  const theme = 'light';

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  // Notifications State (Real-time synced via useNotifications)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'invoices' | 'inventory' | 'other'>('all');
  const { notifications } = useNotifications();

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => {
    return localStorage.getItem('firestore_quota_exceeded') === 'true';
  });

  const [isQuotaBannerDismissed, setIsQuotaBannerDismissed] = useState(() => {
    return localStorage.getItem('firestore_quota_banner_dismissed') === 'true';
  });

  const handleDismissQuotaBanner = () => {
    localStorage.setItem('firestore_quota_banner_dismissed', 'true');
    setIsQuotaBannerDismissed(true);
  };

  const handleTryReconnect = () => {
    localStorage.removeItem('firestore_quota_exceeded');
    localStorage.removeItem('is_offline_mode');
    localStorage.removeItem('firestore_quota_exceeded_timestamp');
    setIsQuotaExceeded(false);
    window.location.reload();
  };

  useEffect(() => {
    const checkQuota = () => {
      setIsQuotaExceeded(localStorage.getItem('firestore_quota_exceeded') === 'true');
    };
    
    window.addEventListener('firestore-quota-exceeded', checkQuota);
    window.addEventListener('storage', checkQuota);
    
    return () => {
      window.removeEventListener('firestore-quota-exceeded', checkQuota);
      window.removeEventListener('storage', checkQuota);
    };
  }, []);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter(n => {
      const cat = (n.category || '').toLowerCase();
      const txt = (n.text || '').toLowerCase();
      
      if (activeTab === 'invoices') {
        return cat === 'invoices' || txt.includes('invoice') || txt.includes('payment');
      }
      if (activeTab === 'inventory') {
        return cat === 'inventory' || txt.includes('product') || txt.includes('stock') || txt.includes('inventory');
      }
      if (activeTab === 'other') {
        return cat !== 'invoices' && cat !== 'inventory' && !txt.includes('invoice') && !txt.includes('payment') && !txt.includes('product') && !txt.includes('stock') && !txt.includes('inventory');
      }
      return true;
    });
  }, [notifications, activeTab]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Profile Dropdown State
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Refs for click-outside triggers
  const notificationBellRef = useRef<HTMLButtonElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isNotificationsOpen) {
        if (
          notificationDropdownRef.current && 
          !notificationDropdownRef.current.contains(event.target as Node) &&
          notificationBellRef.current &&
          !notificationBellRef.current.contains(event.target as Node)
        ) {
          setIsNotificationsOpen(false);
        }
      }
      if (isProfileOpen) {
        if (
          profileDropdownRef.current && 
          !profileDropdownRef.current.contains(event.target as Node) &&
          profileButtonRef.current &&
          !profileButtonRef.current.contains(event.target as Node)
        ) {
          setIsProfileOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen, isProfileOpen]);

  // Real-time Presence Heartbeat
  useEffect(() => {
    if (!user || user.uid === 'offline_guest') return;

    let lastUpdated = 0;
    const HEARTBEAT_INTERVAL = 60000; // 60 seconds

    const updatePresence = async () => {
      // Don't update if document is hidden (user switched tabs / locked screen)
      if (document.hidden) return;

      const now = Date.now();
      // Enforce throttling to prevent double/multiple updates
      if (now - lastUpdated < HEARTBEAT_INTERVAL - 5000) return;

      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          last_active_at: new Date().toISOString()
        });
        lastUpdated = now;
      } catch (err) {
        console.warn("Could not update presence heartbeat:", err);
      }
    };

    // Initial update
    updatePresence();

    // Periodic heartbeat
    const intervalId = setInterval(updatePresence, HEARTBEAT_INTERVAL);

    // Update on user activity events (throttled)
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdated > HEARTBEAT_INTERVAL) {
        updatePresence();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updatePresence();
      }
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Quick Profile Edit Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName || '',
    businessName: '',
    phone: '',
    photoURL: user?.photoURL || ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [showProfileSuccessToast, setShowProfileSuccessToast] = useState(false);

  // Auto hide toast notification after 3 seconds
  useEffect(() => {
    if (showProfileSuccessToast) {
      const timer = setTimeout(() => {
        setShowProfileSuccessToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showProfileSuccessToast]);

  // Load profile values from localStorage or user cache
  useEffect(() => {
    if (user && isProfileModalOpen) {
      const data = getSecureStorage(`user_profile_${user.uid}`, null);
      if (data) {
        setProfileForm({
          displayName: data.owner_name || data.display_name || user.displayName || '',
          businessName: data.business_name || '',
          phone: data.phone || '',
          photoURL: data.logo_url || data.photo_url || user.photoURL || ''
        });
      }
    }
  }, [user, isProfileModalOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const updatedProfile = {
        owner_name: profileForm.displayName,
        display_name: profileForm.displayName,
        business_name: profileForm.businessName,
        phone: profileForm.phone,
        logo_url: profileForm.photoURL,
        photo_url: profileForm.photoURL,
        updated_at: new Date().toISOString()
      };

      // 1. Save to local storage cache immediately
      setSecureStorage(`user_profile_${user.uid}`, updatedProfile);

      // 2. Save to Firestore if we are online
      if (!isOfflineMode && navigator.onLine) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, updatedProfile, { merge: true });
      }

      setShowProfileSuccessToast(true);
      setTimeout(() => setShowProfileSuccessToast(false), 3000);
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error("Error updating profile from Quick Editor modal:", err);
      alert("Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Search Palette / Command Palette State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use real data hooks for search querying!
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { items } = useItems();

  const onboardingProgress = useMemo(() => {
    const steps = [
      { id: 'profile', label: 'Business Profile Details', desc: 'Add business name, phone & payment info', completed: !isProfileIncomplete },
      { id: 'customer', label: 'Add First Customer', desc: 'Create your first client or party card', completed: (customers?.length || 0) > 0 },
      { id: 'item', label: 'Add Service or Item', desc: 'Add products/services to your inventory list', completed: (items?.length || 0) > 0 },
      { id: 'invoice', label: 'Create Professional Invoice', desc: 'Draft and save your first beautiful invoice', completed: (invoices?.length || 0) > 0 }
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const percentage = Math.round((completedCount / steps.length) * 100);

    return { steps, completedCount, percentage };
  }, [isProfileIncomplete, customers, items, invoices]);

  // Auto-open guide for new users with 0 invoices once they complete profile setup
  useEffect(() => {
    if (!settingsLoading && !isProfileIncomplete && (invoices?.length || 0) === 0) {
      const guideDismissed = localStorage.getItem('onboarding_guide_dismissed');
      if (!guideDismissed) {
        setIsGuideOpen(true);
      }
    }
  }, [settingsLoading, isProfileIncomplete, invoices?.length]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { invoices: [], customers: [], items: [] };
    const queryStr = searchQuery.toLowerCase();

    return {
      invoices: (invoices || []).filter((inv: any) => 
        inv.invoice_number?.toLowerCase().includes(queryStr) || 
        inv.customer_name?.toLowerCase().includes(queryStr) ||
        inv.status?.toLowerCase().includes(queryStr) ||
        String(inv.amount).includes(queryStr)
      ).slice(0, 4),
      customers: (customers || []).filter((cust: any) => 
        cust.name?.toLowerCase().includes(queryStr) || 
        cust.phone?.toLowerCase().includes(queryStr) ||
        cust.email?.toLowerCase().includes(queryStr) ||
        cust.business_name?.toLowerCase().includes(queryStr)
      ).slice(0, 4),
      items: (items || []).filter((it: any) => 
        it.name?.toLowerCase().includes(queryStr) || 
        it.description?.toLowerCase().includes(queryStr) ||
        it.category?.toLowerCase().includes(queryStr)
      ).slice(0, 4)
    };
  }, [searchQuery, invoices, customers, items]);

  // Command palette shortcut ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading || (settingsLoading && !settings)) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (isProfileIncomplete) {
    return (
      <PlanGate>
        <SetupWizard 
          wizardForm={wizardForm}
          setWizardForm={setWizardForm}
          wizardStep={wizardStep}
          setWizardStep={setWizardStep}
          savingWizard={savingWizard}
          setSavingWizard={setSavingWizard}
          isOfflineMode={isOfflineMode}
          user={user}
          logout={logout}
          setShowProfileSuccessToast={setShowProfileSuccessToast}
          onComplete={(updatedData) => {
            if (setSettings) {
              setSettings((prev: any) => ({
                ...(prev || {}),
                ...updatedData,
                wizard_completed: true
              }));
            }
          }}
        />
      </PlanGate>
    );
  }

  return (
    <PlanGate>
      <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden bg-[#F8FAFB] text-slate-900">
        <div className="hidden md:block print:hidden">
          <Sidebar onProfileClick={() => setIsProfileModalOpen(true)} />
        </div>
        
        <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
          {isPcDriveEnabled && !isPcFileConnected && (
            <div className="bg-amber-700 text-white text-xs font-bold py-2.5 px-4 text-center flex flex-col sm:flex-row items-center justify-center gap-2 animate-fadeIn z-50 shrink-0 print:hidden shadow-md">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider shrink-0">
                <AlertCircle size={15} className="shrink-0 animate-bounce text-amber-200" />
                Local PC Database File is Locked
              </span>
              <span className="font-semibold opacity-95">Please authorize or unlock your local file ({pcFileName || 'invocentric_db.json'}) to save changes directly to your PC.</span>
              <button
                onClick={unlockPcDriveFile}
                className="bg-white hover:bg-neutral-100 text-amber-950 font-black px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest transition-colors shadow-sm shrink-0"
              >
                Unlock PC File
              </button>
            </div>
          )}

          {isPcDriveEnabled && isPcFileConnected ? (
            <div className="bg-emerald-600 text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn z-50 shrink-0 print:hidden">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span>Local PC Storage Active (Saving in real-time to {pcFileName})</span>
            </div>
          ) : null}

          {/* Responsive Header Bar */}
          <div className="bg-white border-b border-slate-200/60 sticky top-0 z-50 px-3 sm:px-4 md:px-10 py-2.5 sm:py-3 flex items-center justify-between gap-2 shrink-0 print:hidden">
            {/* Left side: Mobile Brand OR Beautiful Desktop Search Bar */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
              <div id="mobile-brand-logo" className="md:hidden flex items-center gap-1.5 shrink-0">
                <Logo size={24} showBg={true} />
                <span className="font-brand text-[11px] sm:text-xs tracking-tight text-slate-900 hidden sm:inline-block">
                  <span className="font-extrabold">Invo</span><span className="font-bold">Centric</span>
                </span>
              </div>
              
              {/* Desktop Search Bar */}
              <div 
                onClick={() => setIsSearchOpen(true)}
                className="hidden md:flex items-center gap-2.5 bg-[#F8FAFB] border border-slate-200/60 rounded-xl px-3.5 py-2 w-full max-w-[340px] focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500/60 transition-all cursor-pointer hover:bg-slate-50/50"
              >
                <Search size={16} className="text-slate-500 shrink-0" />
                <span className="text-[13px] text-slate-500 select-none flex-1">Search anything...</span>
                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded-md font-mono shrink-0 select-none ">
                  ⌘K
                </span>
              </div>
            </div>

            {/* Right Side: Active Controls & Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-4 shrink-0 relative">
              {/* Direct Quick Create Invoice Action Button (Always Accessible) */}
              <button
                onClick={() => navigate('/invoices/new')}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#166534] hover:bg-[#14532d] active:scale-95 text-white rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all shadow-xs shrink-0 cursor-pointer"
                title="Create New Invoice"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Invoice</span>
              </button>

              {/* Active Mode Pill Button */}
              <button
                onClick={() => setAppMode(appMode === 'shop' ? 'freelancer' : 'shop')}
                className={cn(
                  "flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all duration-300 border shrink-0",
                  appMode === 'shop'
                    ? "bg-green-50/70 border-green-100 text-green-700 hover:bg-green-100/50"
                    : "bg-green-50/70 border-green-100 text-green-700 hover:bg-green-100/50"
                )}
              >
                {appMode === 'shop' ? <Store size={12} className="text-green-600 shrink-0" /> : <Briefcase size={12} className="text-green-600 shrink-0" />}
                <span className="hidden xs:inline">{appMode === 'shop' ? 'Shop Mode' : 'Freelancer'}</span>
                <span className="xs:hidden">{appMode === 'shop' ? 'Shop' : 'Free'}</span>
              </button>

              {/* Global Phone Scanner Connect Button */}
              <button
                onClick={() => setIsGlobalScannerModalOpen(true)}
                className={cn(
                  "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xs cursor-pointer",
                  isPhoneScannerConnected
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
                title="Global Mobile Phone Barcode Scanner (Works across all pages)"
              >
                <div className={cn("w-2 h-2 rounded-full", isPhoneScannerConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                <ScanLine size={14} className={isPhoneScannerConnected ? "text-emerald-600" : "text-slate-500"} />
                <span className="hidden sm:inline">{isPhoneScannerConnected ? 'Phone Scanner Connected' : 'Connect Phone'}</span>
              </button>

              {/* Product Guide & Audio Tour Trigger Button */}
              <button
                onClick={() => setIsDemoScriptOpen(true)}
                title="Interactive App Guide & Voiceover Audio Tour"
                className="hidden sm:flex px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 rounded-xl transition-all items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
              >
                <Sparkles size={14} className="text-green-700 animate-pulse" />
                <span className="hidden sm:inline font-extrabold text-[11px] uppercase tracking-wider">App Guide & Audio Tour</span>
              </button>

              {/* Notification Bell */}
              <button 
                ref={notificationBellRef}
                id="header-notification-bell"
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsProfileOpen(false);
                }}
                className={cn(
                  "relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl transition-all  flex items-center justify-center",
                  isNotificationsOpen && "bg-slate-50 text-slate-800 border-slate-200 shadow-inner"
                )}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white animate-pulse"></span>
                )}
              </button>

              <div className="h-6 w-px bg-slate-200/80 hidden xs:block" />

              {/* User Dropdown Profile Pill */}
              <div 
                ref={profileButtonRef}
                id="header-profile-dropdown"
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 hover:bg-slate-50/80 p-1.5 rounded-2xl transition-all cursor-pointer border border-transparent select-none",
                  isProfileOpen && "bg-slate-50/80 border-slate-100 "
                )}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border border-slate-200  bg-green-50">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-black text-green-600">{user?.displayName?.[0] || 'N'}</span>
                  )}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-[13px] font-bold text-slate-900 leading-tight">
                    {user?.displayName || 'Noman Shaikh'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 tracking-wider">
                    {planTier === 'pro' ? 'Pro Account' : 'Free Account'}
                  </p>
                </div>
                <ChevronDown size={14} className="text-slate-500 hidden sm:block" />
              </div>

              {/* FLOATING NOTIFICATION DROPDOWN */}
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    ref={notificationDropdownRef} 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:w-auto absolute right-14 top-14 w-80 md:w-96 bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Bell size={14} className="text-green-600" />
                        Recent Notifications
                      </h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={async () => {
                            if (!user) return;
                            const unread = notifications.filter(n => !n.read);
                            await Promise.all(
                              unread.map(n => 
                                dbService.update('notifications', n.id, { read: true }, { offlineMode: isOfflineMode, userId: user.uid })
                              )
                            );
                          }}
                          className="text-[10px] font-black text-green-600 hover:text-green-700 uppercase tracking-wider"
                        >
                          Mark all read
                        </button>
                        <span className="text-slate-300 text-[10px]">|</span>
                        <button 
                          onClick={async () => {
                            if (!user) return;
                            const readDocs = notifications.filter(n => n.read);
                            await Promise.all(
                              readDocs.map(n => 
                                dbService.delete('notifications', n.id, { offlineMode: isOfflineMode, userId: user.uid })
                              )
                            );
                          }}
                          className="text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-wider"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex border-b border-slate-100 bg-slate-50/20 p-1 gap-1">
                      {(['all', 'invoices', 'inventory', 'other'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                            activeTab === tab 
                              ? "bg-white text-green-600 shadow-sm border border-slate-100" 
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                          )}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                      {filteredNotifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                          <Bell size={24} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                          <p className="text-xs font-semibold">No notifications</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {activeTab === 'all' 
                              ? "Real-time alerts will appear here as you create invoices, make payments, and update inventory."
                              : `No notifications in the ${activeTab} category.`}
                          </p>
                        </div>
                      ) : (
                        filteredNotifications.map(n => {
                          const cat = (n.category || '').toLowerCase();
                          const txt = (n.text || '').toLowerCase();
                          let icon = <Bell size={14} className="text-green-600" />;
                          
                          if (cat === 'invoices' || txt.includes('invoice') || txt.includes('payment')) {
                            icon = <FileText size={14} className="text-green-600" />;
                          } else if (cat === 'inventory' || txt.includes('product') || txt.includes('stock') || txt.includes('inventory')) {
                            icon = <Package size={14} className="text-amber-500" />;
                          } else if (cat === 'customers' || txt.includes('customer')) {
                            icon = <Users size={14} className="text-blue-500" />;
                          } else if (cat === 'expenses' || txt.includes('expense') || txt.includes('purchase')) {
                            icon = <TrendingDown size={14} className="text-rose-500" />;
                          } else if (cat === 'settings' || txt.includes('profile') || txt.includes('settings')) {
                            icon = <Settings size={14} className="text-slate-500" />;
                          }

                          return (
                            <div 
                              key={n.id} 
                              onClick={async () => {
                                if (!user) return;
                                if (!n.read) {
                                  await dbService.update('notifications', n.id, { read: true }, { offlineMode: isOfflineMode, userId: user.uid });
                                }
                                
                                setIsNotificationsOpen(false);
                                
                                const targetCol = (n.target_collection || '').toLowerCase();
                                const targetId = n.target_id;
                                
                                if (targetCol === 'invoices' && targetId) {
                                  navigate(`/invoices/${targetId}`);
                                } else if (targetCol === 'customers') {
                                  navigate(`/customers`);
                                } else if (targetCol === 'items') {
                                  navigate(`/items`);
                                } else if (targetCol === 'expenses') {
                                  navigate(`/expenses`);
                                } else if (targetCol === 'purchases') {
                                  navigate(`/purchases`);
                                } else if (targetCol === 'users') {
                                  navigate(`/settings`);
                                } else {
                                  if (txt.includes('invoice #')) {
                                    navigate('/invoices');
                                  } else if (txt.includes('payment')) {
                                    navigate('/payments');
                                  } else if (txt.includes('product') || txt.includes('stock')) {
                                    navigate('/items');
                                  } else if (txt.includes('customer')) {
                                    navigate('/customers');
                                  } else if (txt.includes('expense')) {
                                    navigate('/expenses');
                                  } else if (txt.includes('purchase')) {
                                    navigate('/purchases');
                                  } else if (txt.includes('profile') || txt.includes('settings')) {
                                    navigate('/settings');
                                  }
                                }
                              }}
                              className={cn(
                                "p-3.5 text-left transition-colors cursor-pointer flex gap-2.5 items-start",
                                n.read ? "bg-white hover:bg-slate-50/50" : "bg-green-50/20 hover:bg-green-50/40"
                              )}
                            >
                              <div className="shrink-0 mt-1 relative flex items-center justify-center">
                                {icon}
                                {!n.read && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse border border-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11.5px] font-medium text-slate-700 leading-normal">{n.text}</p>
                                <p className="text-[9px] text-slate-500 mt-1 font-semibold uppercase">{getRelativeTimeString(n.created_at)}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* FLOATING USER PROFILE DROPDOWN */}
              {isProfileOpen && (
                <div ref={profileDropdownRef} className="absolute right-0 top-14 max-sm:fixed max-sm:right-3 max-sm:top-14 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-fadeIn">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 bg-green-50 shrink-0">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-black text-green-600">{user?.displayName?.[0] || 'N'}</span>
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{user?.displayName || 'Noman Shaikh'}</p>
                      <p className="text-[10px] font-bold text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button 
                      onClick={() => {
                        setIsProfileOpen(false);
                        setIsDemoScriptOpen(true);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-green-700 bg-green-50/50 hover:bg-green-100/60 transition-all"
                    >
                      <Sparkles size={14} className="text-green-600 animate-pulse" />
                      App Guide & Audio Tour
                    </button>
                    <button 
                      onClick={() => {
                        setIsProfileOpen(false);
                        setIsGlobalScannerModalOpen(true);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-50 transition-all"
                    >
                      <ScanLine size={14} className="text-slate-500" />
                      Phone Scanner
                    </button>
                    <button 
                      onClick={() => {
                        setIsProfileOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-50 transition-all"
                    >
                      <UserIcon size={14} className="text-slate-500" />
                      Quick Edit Card
                    </button>
                    <button 
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-50 transition-all"
                    >
                      <Settings size={14} className="text-slate-500" />
                      Business Settings
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                    <button 
                      onClick={() => {
                        setIsProfileOpen(false);
                        logout();
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50/50 transition-all"
                    >
                      <LogOut size={14} className="text-rose-400" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-10 relative pb-28 md:pb-10 bg-[#F8FAFB]" id="main-scroll-container">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
          <MobileNav />
        </div>
      </div>

      {/* FULLY FUNCTIONAL COMMAND PALETTE SEARCH MODAL */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/60  z-50 flex items-start justify-center p-4 pt-[12vh]">
          <div className="bg-white w-full max-w-xl rounded-2xl  border border-slate-100 overflow-hidden flex flex-col max-h-[70vh]">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
              <Search size={18} className="text-slate-500 shrink-0" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices, clients, services, or totals..." 
                className="bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400 w-full focus:ring-0"
                autoFocus
              />
              <button 
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-500 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100/60 bg-white">
              {!searchQuery.trim() ? (
                <div className="p-10 text-center text-slate-450 bg-white">
                  <Search size={28} className="mx-auto mb-3 text-slate-400 opacity-60" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Search for invoices, customers, and items</p>
                  <p className="text-[11px] text-slate-500/85 mt-1">Start typing to see live matched results across your account.</p>
                </div>
              ) : (
                <div className="bg-white">
                  {searchResults.invoices.length === 0 && searchResults.customers.length === 0 && searchResults.items.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                      <p className="text-xs font-bold uppercase">No matched records found</p>
                      <p className="text-[11px] text-slate-405 mt-1">Try another keyword or search term.</p>
                    </div>
                  ) : (
                    <>
                      {/* Invoices Group */}
                      {searchResults.invoices.length > 0 && (
                        <div className="p-2">
                          <h4 className="text-[10px] font-black tracking-widest text-green-600 uppercase mb-2 px-2">Matched Invoices</h4>
                          <div className="space-y-1">
                            {searchResults.invoices.map((inv: any) => (
                              <div 
                                key={inv.id}
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/invoices/${inv.id}`);
                                }}
                                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
                              >
                                <div>
                                  <p className="text-[12.5px] font-black text-slate-800">{inv.invoice_number}</p>
                                  <p className="text-[10.5px] font-medium text-slate-500 mt-0.5">{inv.customer_name}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[12px] font-bold text-slate-900">₹{inv.amount}</p>
                                  <span className={cn(
                                    "text-[8px] font-black uppercase px-2 py-0.5 rounded-full mt-1 inline-block tracking-wider",
                                    inv.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                  )}>
                                    {inv.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Customers Group */}
                      {searchResults.customers.length > 0 && (
                        <div className="p-2">
                          <h4 className="text-[10px] font-black tracking-widest text-green-600 uppercase mb-2 px-2">Matched Customers</h4>
                          <div className="space-y-1">
                            {searchResults.customers.map((cust: any) => (
                              <div 
                                key={cust.id}
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/customers`);
                                }}
                                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
                              >
                                <div>
                                  <p className="text-[12.5px] font-black text-slate-800">{cust.name}</p>
                                  <p className="text-[10.5px] font-medium text-slate-500 mt-0.5">{cust.business_name || 'No company info'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[11px] font-semibold text-slate-600">{cust.phone || cust.email || 'Contact blank'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Items Group */}
                      {searchResults.items.length > 0 && (
                        <div className="p-2">
                          <h4 className="text-[10px] font-black tracking-widest text-green-600 uppercase mb-2 px-2">Matched Inventory & Services</h4>
                          <div className="space-y-1">
                            {searchResults.items.map((it: any) => (
                              <div 
                                key={it.id}
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/items`);
                                }}
                                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
                              >
                                <div>
                                  <p className="text-[12.5px] font-black text-slate-800">{it.name}</p>
                                  <p className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate max-w-[320px]">{it.description || 'No description'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[12px] font-bold text-slate-900">₹{it.price}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>Use <span className="font-mono bg-white px-1.5 py-0.5 border border-slate-200 rounded">Esc</span> to close search</span>
              <span>Matched results search in real-time</span>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PROFILE EDIT MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60  z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl  border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon size={16} className="text-green-600" />
                  Quick Profile Editor
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">Quickly edit your business card details</p>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 block uppercase tracking-wider mb-1.5">Your Full Name</label>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFB] border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all text-xs font-semibold text-slate-800"
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm(p => ({ ...p, displayName: e.target.value }))}
                    placeholder="E.g. Noman Shaikh"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 block uppercase tracking-wider mb-1.5">Business / Shop Name</label>
                <div className="relative">
                  <Building size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFB] border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all text-xs font-semibold text-slate-800"
                    value={profileForm.businessName}
                    onChange={(e) => setProfileForm(p => ({ ...p, businessName: e.target.value }))}
                    placeholder="E.g. Sharma Electronics"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 block uppercase tracking-wider mb-1.5">Contact Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="tel" 
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFB] border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all text-xs font-semibold text-slate-800"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="E.g. +91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 block uppercase tracking-wider mb-1.5">Avatar Image / Logo URL</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFB] border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all text-xs font-semibold text-slate-800"
                    value={profileForm.photoURL}
                    onChange={(e) => setProfileForm(p => ({ ...p, photoURL: e.target.value }))}
                    placeholder="E.g. https://image-url.com/logo.png"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingProfile}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50"
                >
                  {savingProfile ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEMO RECORDING SCRIPT & PDF GUIDE MODAL */}
      <DemoScriptModal 
        isOpen={isDemoScriptOpen}
        onClose={() => setIsDemoScriptOpen(false)}
      />

      {/* Global Mobile Scanner QR Connect Modal */}
      {isGlobalScannerModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden p-6 space-y-4 text-slate-900 dark:text-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/60 flex items-center justify-center text-green-700 dark:text-green-400">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black">Global Phone Barcode Scanner</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Scan once, works across all sections automatically!</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGlobalScannerModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <QRCodeSVG value={`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`} size={140} level="H" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold">Scan with your smartphone camera</p>
                <p className="text-[11px] text-slate-500 font-mono select-all bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 break-all">
                  {`${window.location.origin}/mobile-scan?sessionId=${getScannerSessionId()}`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={cn("w-2.5 h-2.5 rounded-full", isPhoneScannerConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                <span>{isPhoneScannerConnected ? "Connected & Ready for Global Scanning" : "Waiting for phone connection..."}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsGlobalScannerModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-green-700 hover:bg-green-800 text-white shadow-sm transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* INTERACTIVE ONBOARDING GUIDE */}
      <OnboardingGuide 
        onboardingProgress={onboardingProgress}
        isGuideOpen={isGuideOpen}
        setIsGuideOpen={setIsGuideOpen}
        tourStep={tourStep}
        setTourStep={setTourStep}
      />

      {/* SUCCESS TOAST NOTIFICATION */}
      <AnimatePresence>
        {showProfileSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-5 md:translate-x-0 bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white text-xs font-bold tracking-wide px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-[9999]"
          >
            <CheckCircle size={17} className="text-emerald-400 shrink-0" />
            <span>Profile Card Saved Successfully!</span>
            <button
              onClick={() => setShowProfileSuccessToast(false)}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Admin Approval Popups Overlay */}
      {showAdmin && visibleAdminRequests.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full space-y-3 pointer-events-auto print:hidden">
          <AnimatePresence>
            {visibleAdminRequests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                className="bg-white border-2 border-amber-300 rounded-[2rem] p-5 shadow-2xl space-y-4 relative overflow-hidden"
              >
                {/* Visual accent top line */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-500 animate-pulse" />
                
                {/* Header info */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                      <Sparkles size={16} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Pending Payment Approval</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{req.billing_cycle || 'monthly'} plan upgrade</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDismissedRequests(prev => [...prev, req.id])}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors border-none bg-transparent cursor-pointer"
                    title="Dismiss alert"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Details */}
                <div className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100/50 space-y-2 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">User Email</span>
                    <span className="font-extrabold text-slate-800 break-all text-right max-w-[180px]">{req.user_email || req.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Amount Due</span>
                    <span className="font-black text-[#166534]">₹{req.amount}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-2 border-t border-amber-100/30">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Ref No / UTR</span>
                    <div className="font-mono font-extrabold text-green-800 bg-white/80 border border-green-150 px-2 py-1 rounded-lg flex items-center justify-between text-xs mt-0.5">
                      <span className="truncate mr-2 select-all">{req.upi_id_ref || req.upiId}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(req.upi_id_ref || req.upiId || '');
                          setAdminToast("Copied Reference ID!");
                          setTimeout(() => setAdminToast(null), 2000);
                        }}
                        className="p-1 hover:bg-green-100/50 text-green-700 rounded transition-colors border-none bg-transparent cursor-pointer"
                        title="Copy reference"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Interactive Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGlobalReject(req)}
                    disabled={actionInProgress === req.id}
                    className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-red-100 cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleGlobalApprove(req)}
                    disabled={actionInProgress === req.id}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1 border-none cursor-pointer"
                  >
                    {actionInProgress === req.id ? (
                      <Loader size={11} className="animate-spin animate-infinite" />
                    ) : (
                      <Check size={11} />
                    )}
                    <span>Approve</span>
                  </button>
                </div>

                {/* Redirect directly to Approvals tab button */}
                <button
                  onClick={() => {
                    setDismissedRequests(prev => [...prev, req.id]);
                    navigate('/admin?tab=approvals');
                  }}
                  className="w-full text-center text-[10px] font-extrabold text-[#166534] hover:text-[#0a351a] hover:underline uppercase tracking-wide pt-1 border-none bg-transparent cursor-pointer"
                >
                  View full details in Admin Panel →
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Global Admin Toast alert */}
      {adminToast && (
        <div className="fixed bottom-6 left-6 z-[99999] bg-slate-900 text-white text-xs font-black uppercase tracking-wider px-5 py-3.5 rounded-2xl shadow-xl animate-fadeIn">
          {adminToast}
        </div>
      )}
    </PlanGate>
  );
}

function HomeRoute() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  return <Navigate to="/dashboard" />;
}

import InstallBanner from './components/InstallBanner';
import OfflineSyncManager from './components/OfflineSyncManager';
import UpgradeModal from './components/UpgradeModal';
import { GlobalShortcutsManager } from './components/GlobalShortcutsManager';

export default function App() {
  return (
      <AuthProvider>
        <BrowserRouter>
          <GlobalShortcutsManager />
          <MigrationModal />
          <AutoBackup />
          <DataBackupRecoveryModal />
          <OfflineSyncManager />
          <InstallBanner />
          <UpgradeModal />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<HomeRoute />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blogs" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPage />} />
              <Route path="/mobile-scan" element={<MobileScanPage />} />
              
              {/* Public SEO Feature Landing Pages */}
              <Route path="/invoice-software" element={<SeoLandingPage pageKey="invoice-software" />} />
              <Route path="/free-invoice-maker" element={<SeoLandingPage pageKey="free-invoice-maker" />} />
              <Route path="/gst-billing-software" element={<SeoLandingPage pageKey="gst-billing-software" />} />
              <Route path="/gst-invoice-maker" element={<SeoLandingPage pageKey="gst-invoice-maker" />} />
              <Route path="/billing-software" element={<SeoLandingPage pageKey="billing-software" />} />
              <Route path="/pos-billing-software" element={<SeoLandingPage pageKey="pos-billing-software" />} />
              <Route path="/barcode-billing" element={<SeoLandingPage pageKey="barcode-billing" />} />
              <Route path="/inventory-management" element={<SeoLandingPage pageKey="inventory-management" />} />
              <Route path="/ledger-software" element={<SeoLandingPage pageKey="ledger-software" />} />
              <Route path="/quotation-maker" element={<SeoLandingPage pageKey="quotation-maker" />} />
              <Route path="/gst-calculator" element={<GstCalculatorPage />} />
              <Route path="/calculator" element={<GstCalculatorPage />} />
              <Route path="/gst-calc" element={<GstCalculatorPage />} />
              
              {/* Private Routes */}
              <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
              <Route path="/invoices" element={<PrivateRoute><InvoicesPage /></PrivateRoute>} />
              <Route path="/quotations" element={<PrivateRoute><QuotationsPage /></PrivateRoute>} />
              <Route path="/invoices/create" element={<PrivateRoute><CreateInvoicePage /></PrivateRoute>} />
              <Route path="/invoices/edit/:id" element={<PrivateRoute><CreateInvoicePage /></PrivateRoute>} />
              <Route path="/customers" element={<PrivateRoute><CustomersPage /></PrivateRoute>} />
              <Route path="/customers/statement/:id" element={<PrivateRoute><StatementPage /></PrivateRoute>} />
              <Route path="/items" element={<PrivateRoute><ItemsPage /></PrivateRoute>} />
              <Route path="/expenses" element={<PrivateRoute><ExpensesPage /></PrivateRoute>} />
              <Route path="/purchases" element={<PrivateRoute><PurchasesPage /></PrivateRoute>} />
              <Route path="/dailybook" element={<PrivateRoute><DailyBookPage /></PrivateRoute>} />
              <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
              <Route path="/payments" element={<PrivateRoute><PaymentsPage /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
              <Route path="/pricing" element={<PrivateRoute><PricingPage /></PrivateRoute>} />
              <Route path="/invoices/:id" element={<PrivateRoute><InvoiceViewPage /></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
              <Route path="/pos" element={<PrivateRoute><QuickPOSPage /></PrivateRoute>} />
              <Route path="/qr-generator" element={<PrivateRoute><QrGeneratorPage /></PrivateRoute>} />
              <Route path="/barcode-generator" element={<PrivateRoute><BarcodeGeneratorPage /></PrivateRoute>} />
              
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
  );
}

