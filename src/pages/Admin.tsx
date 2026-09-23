import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Building, 
  Calendar, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  MoreHorizontal, 
  UserPlus, 
  Search, 
  X, 
  Activity, 
  Mail, 
  Ban, 
  Trash2, 
  Check, 
  Copy, 
  RefreshCw,
  Plus,
  Lock,
  Smartphone,
  PieChart as PieIcon,
  CheckCircle,
  FileCheck,
  Building2,
  DollarSign,
  AlertCircle,
  LayoutGrid,
  List,
  Clock,
  Radio,
  Sparkles,
  Bell,
  Zap,
  Send,
  Key,
  Server,
  Eye,
  EyeOff,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  getDocs 
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

// Safe date parser to avoid external import errors
const parseDateSafe = (dateInput: any): Date => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'object' && dateInput.toDate) return dateInput.toDate();
  try {
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch (e) {
    return new Date();
  }
};

interface UserItem {
  id: string;
  name: string;
  email: string;
  business: string;
  status: 'Active' | 'Inactive' | 'Pending';
  joinedOn: string;
  lastActiveDate: Date;
  invoiceCount: number;
  photo_url?: string;
  plan?: string;
}

interface ActivityItem {
  id: string;
  type: 'signup' | 'business' | 'invoice' | 'payment' | 'delete';
  title: string;
  description: string;
  time: string;
  rawTime: Date;
}

// Helper to calculate exact invoice count per user from real-time dbInvoices
const getUserInvoiceCount = (userId: string, userEmail?: string, invoices: any[] = []): number => {
  const cleanEmail = userEmail?.toLowerCase().trim();
  return invoices.filter(inv => {
    const invUserId = inv.user_id || inv.uid || inv.created_by;
    const invEmail = (inv.user_email || inv.email || '').toLowerCase().trim();
    
    return (
      (userId && invUserId === userId) ||
      (cleanEmail && invEmail && invEmail === cleanEmail)
    );
  }).length;
};

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  
  // Make sure Noman Shaikh is always treated as an admin
  const isHardcodedAdmin = user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const showAdmin = isAdmin || isHardcodedAdmin;

  // Real-time Firestore loaded states
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Interface view & interactive controls states
  const [timelineFilter, setTimelineFilter] = useState<'year' | 'month'>('year');
  const [dateRangeText, setDateRangeText] = useState('All Time');
  const [showDatePickerDropdown, setShowDatePickerDropdown] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive' | 'Pending'>('all');
  
  // Email logs & Auto-sync reminder states
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [checkingInactivity, setCheckingInactivity] = useState(false);
  const [forceScan, setForceScan] = useState(false);
  const [resetStatuses, setResetStatuses] = useState(false);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [emailSubTab, setEmailSubTab] = useState<'reminders' | 'receipts'>('reminders');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('admin_reminder_autosync') !== 'false';
  });
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('admin_last_reminder_autosync');
    return saved ? new Date(saved) : null;
  });
  const [sendingReminderUserId, setSendingReminderUserId] = useState<string | null>(null);
  const isAutoSyncingRef = useRef(false);

  // SMTP Server Configuration Modal & Verification States
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; email?: string; host?: string }>({
    configured: false
  });
  const [smtpForm, setSmtpForm] = useState({
    host: 'smtp.gmail.com',
    port: '587',
    user: '',
    pass: '',
    fromName: 'InvoCentric Billing',
    testRecipient: user?.email || 'nomanshaikh1999@gmail.com'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSmtpStatus = useCallback(async () => {
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/admin/smtp-status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSmtpStatus(data);
          if (data.email && !smtpForm.user) {
            setSmtpForm(prev => ({ ...prev, user: data.email, host: data.host || prev.host }));
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load SMTP status:', e);
    }
  }, [user, smtpForm.user]);

  useEffect(() => {
    fetchSmtpStatus();
  }, [fetchSmtpStatus]);

  const handleTestSmtp = async () => {
    if (!smtpForm.user || !smtpForm.pass) {
      setSmtpFeedback({ type: 'error', message: 'Please enter both Email/Username and App Password.' });
      return;
    }
    setTestingSmtp(true);
    setSmtpFeedback(null);
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/admin/test-smtp-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(smtpForm)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSmtpFeedback({ type: 'success', message: data.message || 'SMTP Connection Verified Successfully!' });
          fetchSmtpStatus();
        } else {
          setSmtpFeedback({ type: 'error', message: data.error || 'Failed to authenticate with SMTP server.' });
        }
      }
    } catch (err: any) {
      setSmtpFeedback({ type: 'error', message: err.message || 'Network connection failed.' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSaveSmtp = async () => {
    if (!smtpForm.user || !smtpForm.pass) {
      setSmtpFeedback({ type: 'error', message: 'Please enter Email and App Password.' });
      return;
    }
    setSavingSmtp(true);
    setSmtpFeedback(null);
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/admin/save-smtp-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(smtpForm)
        });
        const data = await res.json();
        if (res.ok) {
          setSmtpFeedback({ type: 'success', message: 'SMTP settings saved successfully!' });
          fetchSmtpStatus();
          setTimeout(() => setIsSmtpModalOpen(false), 1200);
        } else {
          setSmtpFeedback({ type: 'error', message: data.error || 'Failed to save SMTP settings.' });
        }
      }
    } catch (err: any) {
      setSmtpFeedback({ type: 'error', message: err.message || 'Error saving settings.' });
    } finally {
      setSavingSmtp(false);
    }
  };

  const filteredEmailLogs = useMemo(() => {
    return emailLogs.map((log: any) => {
      // If legacy log lacks recipient_name or business_name, resolve it from real-time dbUsers
      const matchedUser = dbUsers.find((u: any) => 
        (u.email || '').trim().toLowerCase() === (log.recipient_email || '').trim().toLowerCase() ||
        (u.business_email || '').trim().toLowerCase() === (log.recipient_email || '').trim().toLowerCase()
      );
      const recipientName = log.recipient_name || matchedUser?.display_name || matchedUser?.owner_name || matchedUser?.name || '';
      const businessName = log.business_name || matchedUser?.business_name || '';

      return {
        ...log,
        recipient_name: recipientName,
        business_name: businessName,
        delivery_mode: log.delivery_mode || 'Automatic'
      };
    }).filter((log: any) => {
      const isReminder = log.email_type === 'Reminder' || log.email_type === 'Test Reminder';
      if (emailSubTab === 'reminders' && !isReminder) return false;
      if (emailSubTab === 'receipts' && isReminder) return false;

      const email = (log.recipient_email || '').toLowerCase();
      const recName = (log.recipient_name || '').toLowerCase();
      const bizName = (log.business_name || '').toLowerCase();
      const type = (log.email_type || '').toLowerCase();
      const subject = (log.subject || '').toLowerCase();
      const mode = (log.delivery_mode || '').toLowerCase();
      const search = logSearchTerm.toLowerCase();
      return email.includes(search) || recName.includes(search) || bizName.includes(search) || type.includes(search) || subject.includes(search) || mode.includes(search);
    });
  }, [emailLogs, dbUsers, logSearchTerm, emailSubTab]);

  // Modals / Full-list states
  const [showAllUsersModal, setShowAllUsersModal] = useState(false);
  const [showAllActivitiesModal, setShowAllActivitiesModal] = useState(false);
  const [usersLayoutMode, setUsersLayoutMode] = useState<'grid' | 'table'>('grid');
  
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'approvals' | 'emails'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'approvals' || tabParam === 'users' || tabParam === 'emails' || tabParam === 'overview') {
      return tabParam as any;
    }
    return 'overview';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'approvals' || tabParam === 'users' || tabParam === 'emails' || tabParam === 'overview') {
      setActiveTab(tabParam as any);
    }
  }, [location.search]);

  // Toast confirmation feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Real-time database synchronizer
  useEffect(() => {
    if (!showAdmin) return;
    setLoading(true);

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at ? parseDateSafe(data.created_at).toISOString() : new Date().toISOString()
        };
      });
      setDbUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error("Error reading users in Admin view:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch (err) {
        console.warn("Handled users listener error:", err);
      }
      setLoading(false);
    });

    const unsubscribeInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      const invoicesList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at ? parseDateSafe(data.created_at).toISOString() : new Date().toISOString()
        };
      });
      setDbInvoices(invoicesList);
    }, (error) => {
      console.error("Error reading invoices in Admin view:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'invoices');
      } catch (err) {
        console.warn("Handled invoices listener error:", err);
      }
    });

    const unsubscribeRequests = onSnapshot(collection(db, 'subscription_requests'), (snapshot) => {
      const requestsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at ? parseDateSafe(data.created_at).toISOString() : new Date().toISOString()
        };
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSubscriptionRequests(requestsList);
    }, (error) => {
      console.error("Error reading subscription requests in Admin view:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'subscription_requests');
      } catch (err) {
        console.warn("Handled requests listener error:", err);
      }
    });

    const unsubscribeEmailLogs = onSnapshot(collection(db, 'email_logs'), (snapshot) => {
      const logsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp ? parseDateSafe(data.timestamp).toISOString() : new Date().toISOString()
        };
      }).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEmailLogs(logsList);
    }, (error) => {
      console.error("Error reading email logs in Admin view:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'email_logs');
      } catch (err) {
        console.warn("Handled email logs listener error:", err);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeInvoices();
      unsubscribeRequests();
      unsubscribeEmailLogs();
    };
  }, [showAdmin]);

  // Convert Firestore DB users into target format, sorted by last active time (most recent first)
  const mergedUsers = useMemo<UserItem[]>(() => {
    return dbUsers.map(u => {
      const dateRaw = u.last_active_at || u.last_login_at || u.updated_at || u.created_at;
      const lastActiveDate = parseDateSafe(dateRaw);
      const invoiceCount = getUserInvoiceCount(u.id, u.email, dbInvoices);

      return {
        id: u.id,
        name: u.display_name || u.owner_name || u.name || 'Anonymous User',
        email: u.email || 'no-email@example.com',
        business: u.business_name || 'Individual Creator',
        status: u.status === 'banned' ? 'Inactive' : (u.plan_status === 'trial' ? 'Pending' : 'Active'),
        joinedOn: u.created_at,
        lastActiveDate,
        invoiceCount,
        photo_url: u.photo_url || u.photoURL,
        plan: u.plan || 'free'
      };
    }).sort((a, b) => b.lastActiveDate.getTime() - a.lastActiveDate.getTime());
  }, [dbUsers, dbInvoices]);

  // Calculate real-time active users
  const activeTodayCount = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return mergedUsers.filter(u => u.lastActiveDate.getTime() >= startOfToday).length;
  }, [mergedUsers]);

  const activeNowCount = useMemo(() => {
    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    return mergedUsers.filter(u => u.lastActiveDate.getTime() >= fiveMinsAgo).length;
  }, [mergedUsers]);

  // Calculate real-time inactive users eligible for inactivity reminder (>24 continuous hours)
  const inactiveUsersForReminder = useMemo(() => {
    const now = Date.now();
    const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

    return dbUsers.filter((u: any) => {
      const email = (u.email || u.business_email || '').trim();
      if (!email || !email.includes('@')) return false;
      if (u.email_reminders_enabled === false) return false;

      const dateRaw = u.last_active_at || u.last_login_at || u.updated_at || u.created_at;
      const lastActiveTime = dateRaw ? parseDateSafe(dateRaw).getTime() : 0;
      if (!lastActiveTime) return false;

      const inactiveMs = now - lastActiveTime;
      if (inactiveMs < INACTIVITY_THRESHOLD_MS) return false;

      // Check if already sent recently (within last 3 days cooldown)
      if (u.inactivity_reminder_status === 'sent' && u.inactivity_reminder_sent_at) {
        const sentTime = parseDateSafe(u.inactivity_reminder_sent_at).getTime();
        const daysSinceSent = (now - sentTime) / (24 * 3600000);
        if (daysSinceSent < 3) return false;
      }

      return true;
    }).map((u: any) => {
      const dateRaw = u.last_active_at || u.last_login_at || u.updated_at || u.created_at;
      const lastActiveDate = parseDateSafe(dateRaw);
      const hoursInactive = Math.max(1, Math.round((Date.now() - lastActiveDate.getTime()) / 3600000));
      const daysInactive = Math.max(1, Math.round((Date.now() - lastActiveDate.getTime()) / (24 * 3600000)));
      const invoiceCount = getUserInvoiceCount(u.id, u.email, dbInvoices);
      return {
        ...u,
        name: u.display_name || u.owner_name || u.name || (u.email ? u.email.split('@')[0] : 'User'),
        business: u.business_name || u.owner_name || u.display_name || 'InvoCentric Partner',
        lastActiveDate,
        hoursInactive,
        daysInactive,
        invoiceCount
      };
    }).sort((a, b) => b.hoursInactive - a.hoursInactive);
  }, [dbUsers, dbInvoices]);

  // High-level system statistics summary (counts only - no monetary amounts shown)
  const statsSummary = useMemo(() => {
    const totalInvoices = dbInvoices.length;
    const totalUsers = dbUsers.length;
    const totalBusinesses = new Set(dbUsers.map(u => u.business_name).filter(Boolean)).size;

    return {
      totalInvoices,
      totalUsers,
      totalBusinesses
    };
  }, [dbInvoices, dbUsers]);

  // Doughnut slices based on statuses of our current user list
  const userStatusDistribution = useMemo(() => {
    const total = mergedUsers.length;
    if (total === 0) return { active: 0, inactive: 0, pending: 0, activePct: '0', inactivePct: '0', pendingPct: '0' };

    const active = mergedUsers.filter(u => u.status === 'Active').length;
    const inactive = mergedUsers.filter(u => u.status === 'Inactive').length;
    const pending = mergedUsers.filter(u => u.status === 'Pending').length;

    const activePct = ((active / total) * 100).toFixed(1);
    const inactivePct = ((inactive / total) * 100).toFixed(1);
    const pendingPct = ((pending / total) * 100).toFixed(1);

    return {
      active,
      inactive,
      pending,
      activePct,
      inactivePct,
      pendingPct
    };
  }, [mergedUsers]);

  // Active & Pending Businesses
  const activeBusinessesCount = useMemo(() => {
    return dbUsers.filter(u => u.status !== 'banned' && u.business_name).length;
  }, [dbUsers]);

  const pendingBusinessesCount = useMemo(() => {
    return dbUsers.filter(u => u.plan_status === 'trial' && u.business_name).length;
  }, [dbUsers]);

  // User list searching & filtering
  const filteredUsers = useMemo(() => {
    return mergedUsers.filter(u => {
      const searchMatch = 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.business.toLowerCase().includes(searchTerm.toLowerCase());
      
      const statusMatch = statusFilter === 'all' || u.status === statusFilter;

      return searchMatch && statusMatch;
    });
  }, [mergedUsers, searchTerm, statusFilter]);

  // Date range handlers
  const handleSelectDateRange = (rangeText: string) => {
    setDateRangeText(rangeText);
    setShowDatePickerDropdown(false);
    triggerToast(`Date filter changed to: ${rangeText}`);
  };

  // Change User Status interactively (Cycles through states or flips)
  const handleToggleStatus = async (userId: string, currentStatus: 'Active' | 'Inactive' | 'Pending') => {
    const nextStatusMap: Record<string, 'Active' | 'Inactive' | 'Pending'> = {
      'Active': 'Inactive',
      'Inactive': 'Pending',
      'Pending': 'Active'
    };
    const nextStatus = nextStatusMap[currentStatus];

    try {
      const userDocRef = doc(db, 'users', userId);
      const mappedDbStatus = nextStatus === 'Inactive' ? 'banned' : 'active';
      const mappedPlanStatus = nextStatus === 'Pending' ? 'trial' : 'active';
      await updateDoc(userDocRef, { 
        status: mappedDbStatus,
        plan_status: mappedPlanStatus
      });
      triggerToast(`Updated user status to ${nextStatus}!`);
    } catch (err) {
      console.error("Failed to update user status in Firestore:", err);
    }
  };

  const handleTogglePlan = async (userId: string, currentPlan: string) => {
    const nextPlan = currentPlan === 'pro' ? 'free' : 'pro';
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { 
        plan: nextPlan,
        plan_tier: nextPlan,
        plan_status: 'active',
        subscription_status: nextPlan === 'pro' ? 'active' : 'cancelled',
        subscription_pending: false,
        billing_cycle: nextPlan === 'pro' ? 'monthly' : null,
        plan_renews_at: nextPlan === 'pro' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      }, { merge: true });
      triggerToast(`Updated user plan to ${nextPlan.toUpperCase()}!`);
    } catch (err) {
      console.error("Failed to update user plan in Firestore:", err);
    }
  };

  // Delete User Interactively
  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.uid) {
      alert("You cannot delete your own admin account!");
      return;
    }

    const userName = mergedUsers.find(u => u.id === userId)?.name || 'User';
    const confirmed = window.confirm(`Are you sure you want to delete ${userName}?`);
    if (!confirmed) return;

    try {
      const userDocRef = doc(db, 'users', userId);
      await deleteDoc(userDocRef);
      triggerToast(`Deleted user ${userName} from database.`);
    } catch (err) {
      console.error("Failed to delete user in Firestore:", err);
    }
  };

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

  const handlePurgeAllPending = async () => {
    const pending = subscriptionRequests.filter(r => r.status === 'pending');
    if (pending.length === 0) {
      triggerToast("No pending requests to clear.");
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to clear/reject all ${pending.length} pending subscription requests?`);
    if (!confirmed) return;
    try {
      for (const req of pending) {
        const reqRef = doc(db, 'subscription_requests', req.id);
        await updateDoc(reqRef, { status: 'rejected', rejected_at: new Date().toISOString() }).catch(() => {});
        await deleteDoc(reqRef).catch(() => {});
        if (req.user_id) {
          await updateDoc(doc(db, 'users', req.user_id), {
            subscription_pending: false,
            subscription_status: 'rejected'
          }).catch(() => {});
        }
      }
      setSubscriptionRequests(prev => prev.filter(r => r.status !== 'pending'));
      triggerToast("All pending subscription requests cleared successfully.");
    } catch (err) {
      console.error("Failed to purge pending requests:", err);
      setSubscriptionRequests(prev => prev.filter(r => r.status !== 'pending'));
      triggerToast("All pending subscription requests cleared.");
    }
  };

  // Approve pending UPI Subscription (with automated invoice/receipt and expense logger)
  const handleApproveSubscription = async (requestId: string, userId: string, userEmail: string, amount: number, billingCycle: string, upiIdRef: string) => {
    const targetUserId = userId || '';
    const targetUserEmail = userEmail || 'Unknown User';
    const targetUpiIdRef = upiIdRef || 'N/A';

    try {
      // 1. Update subscription_requests status to 'approved'
      const requestRef = doc(db, 'subscription_requests', requestId);
      await updateDoc(requestRef, {
        status: 'approved',
        approved_at: new Date().toISOString()
      });

      // Cleanup any other pending requests for this user so duplicates are removed
      await cleanupUserPendingRequests(targetUserId, targetUserEmail, requestId);

      if (targetUserId) {
        // 2. Upgrade the User in Firestore (unlock Pro)
        const userRef = doc(db, 'users', targetUserId);
        await setDoc(userRef, {
          plan: 'pro',
          plan_tier: 'pro',
          plan_status: 'active',
          billing_cycle: billingCycle,
          subscription_pending: false,
          subscription_status: 'active',
          subscription_request_ref: null,
          plan_renews_at: billingCycle === 'monthly' 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, { merge: true });

        // 3. Log a record in payments_subscription
        await dbService.add('payments_subscription', {
          user_id: targetUserId,
          user_email: targetUserEmail,
          amount: amount,
          billing_cycle: billingCycle,
          payment_method: 'upi',
          date: new Date().toISOString(),
          status: 'success'
        }, { offlineMode: false, userId: targetUserId });

        // Add strictly only an expense record for the business subscription purchase (khud ka kharcha / expense)
        await dbService.add('expenses', {
          description: `InvoCentric Pro Subscription (${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'})`,
          amount: amount,
          category: 'Office Supplies',
          date: new Date().toISOString(),
          payment_method: 'UPI',
          user_id: targetUserId,
          created_at: new Date().toISOString()
        }, { offlineMode: false, userId: targetUserId });

        // 4. Push a real-time notification to the user to congratulate them!
        await dbService.add('notifications', {
          user_id: targetUserId,
          text: `🎉 Pro Plan Activated! Your UPI Reference ${targetUpiIdRef} of ₹${amount} was verified successfully by Shekh Mahammad Noman. Thank you!`,
          read: false,
          category: 'other',
          created_at: new Date().toISOString()
        }, { offlineMode: false, userId: targetUserId });
      }

      // 5. Trigger backend automatic payment receipt PDF generation & email delivery
      try {
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          const notifyRes = await fetch('/api/subscription/approve-receipt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              userId: targetUserId,
              userEmail: targetUserEmail,
              amount,
              billingCycle,
              upiIdRef: targetUpiIdRef
            })
          });
          
          if (notifyRes.ok) {
            const notifyResult = await notifyRes.json();
            if (notifyResult.success) {
              triggerToast(`Subscription approved! Receipt ${notifyResult.receiptNumber} generated and emailed to ${targetUserEmail}.`);
            } else {
              triggerToast(`Subscription approved, but receipt delivery had warnings.`);
            }
          } else {
            const errResult = await notifyRes.json();
            console.warn("Backend receipt approval warning:", errResult.error);
            triggerToast(`Subscription approved, but receipt generation failed: ${errResult.error}`);
          }
        }
      } catch (notifyErr) {
        console.error("Failed to trigger backend receipt approval:", notifyErr);
        triggerToast(`Subscription approved, but receipt dispatch failed to connect.`);
      }
    } catch (err) {
      console.error("Failed to approve subscription:", err);
      triggerToast(`Approval error. Please try again.`);
    }
  };

  // Reject / Delete pending UPI Subscription
  const handleRejectSubscription = async (requestId: string, userId: string, userEmail: string, upiIdRef: string) => {
    const targetUserId = userId || '';
    const targetUserEmail = userEmail || 'Unknown User';
    const targetUpiIdRef = upiIdRef || 'N/A';

    const confirmed = window.confirm(`Are you sure you want to REJECT and REMOVE subscription request for ${targetUserEmail} (Ref: ${targetUpiIdRef})?`);
    if (!confirmed) return;

    try {
      // 1. Update status to rejected first so query filters immediately, then delete completely
      const reqRef = doc(db, 'subscription_requests', requestId);
      await updateDoc(reqRef, { status: 'rejected', rejected_at: new Date().toISOString() }).catch(() => {});
      await deleteDoc(reqRef).catch(() => {});
      await cleanupUserPendingRequests(targetUserId, targetUserEmail, requestId);

      if (targetUserId) {
        // 2. Set user subscription status to 'rejected' and turn off pending flag
        const userRef = doc(db, 'users', targetUserId);
        await updateDoc(userRef, {
          subscription_pending: false,
          subscription_status: 'rejected'
        }).catch(() => {});

        // 3. Send warning notification to user
        await dbService.add('notifications', {
          user_id: targetUserId,
          text: `⚠️ UPI Verification Failed: Reference ${targetUpiIdRef} could not be matched with our SBI account records. Please try again with correct details.`,
          read: false,
          category: 'other',
          created_at: new Date().toISOString()
        }, { offlineMode: false, userId: targetUserId }).catch(() => {});
      }

      setSubscriptionRequests(prev => prev.filter(r => r.id !== requestId));
      triggerToast(`Subscription request removed for ${targetUserEmail}.`);
    } catch (err) {
      console.error("Failed to reject subscription:", err);
      // Fallback force delete even if error
      try {
        await deleteDoc(doc(db, 'subscription_requests', requestId));
        setSubscriptionRequests(prev => prev.filter(r => r.id !== requestId));
        triggerToast(`Subscription request removed.`);
      } catch (delErr) {
        setSubscriptionRequests(prev => prev.filter(r => r.id !== requestId));
        triggerToast(`Subscription request removed.`);
      }
    }
  };

  // Delete subscription request audit trail entry
  const handleDeleteSubscriptionRequest = async (requestId: string) => {
    const confirmed = window.confirm("Are you sure you want to remove this subscription audit trail entry from history?");
    if (!confirmed) return;
    try {
      const reqRef = doc(db, 'subscription_requests', requestId);
      await updateDoc(reqRef, { status: 'rejected', rejected_at: new Date().toISOString() }).catch(() => {});
      await deleteDoc(reqRef).catch(() => {});
      triggerToast("Subscription request record deleted successfully.");
    } catch (err) {
      console.error("Failed to delete subscription request:", err);
      triggerToast("Failed to delete record.");
    }
  };

  // Delete individual email log entry
  const handleDeleteEmailLog = async (logId: string) => {
    const confirmed = window.confirm("Are you sure you want to remove this email log?");
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'email_logs', logId));
      triggerToast("Email log deleted.");
    } catch (err) {
      console.error("Failed to delete email log:", err);
      triggerToast("Failed to delete log.");
    }
  };

  // Delete all email logs of a specific section (Reminders vs Receipts), or all
  const handleDeleteAllEmailLogs = async (typeGroup: 'reminders' | 'receipts' | 'all') => {
    const label = typeGroup === 'reminders' ? 'all Reminders' : typeGroup === 'receipts' ? 'all Receipts' : 'all email logs';
    const confirmed = window.confirm(`Are you sure you want to permanently delete ${label}? This action is irreversible.`);
    if (!confirmed) return;

    try {
      const logsToDelete = emailLogs.filter(log => {
        const isReminder = log.email_type === 'Reminder' || log.email_type === 'Test Reminder';
        if (typeGroup === 'reminders') return isReminder;
        if (typeGroup === 'receipts') return !isReminder;
        return true;
      });

      if (logsToDelete.length === 0) {
        triggerToast("No email logs to delete in this category.");
        return;
      }

      await Promise.all(logsToDelete.map(log => deleteDoc(doc(db, 'email_logs', log.id))));
      triggerToast(`Successfully deleted ${logsToDelete.length} ${label} records.`);
    } catch (err) {
      console.error("Failed to delete email logs:", err);
      triggerToast("Error deleting logs.");
    }
  };

  // Real-time Auto-Sync Engine: dispatches reminders automatically in background when due
  const performAutoSync = useCallback(async () => {
    if (!autoSyncEnabled || isAutoSyncingRef.current || !auth.currentUser) return;
    if (inactiveUsersForReminder.length === 0) return;

    // Throttle: don't auto-sync more than once every 10 minutes
    const now = Date.now();
    const lastTime = lastAutoSyncTime ? lastAutoSyncTime.getTime() : 0;
    if (now - lastTime < 10 * 60 * 1000) return;

    isAutoSyncingRef.current = true;
    try {
      const token = await auth.currentUser.getIdToken();
      const payloadUsers = inactiveUsersForReminder.map((u: any) => {
        const userInvs = dbInvoices.filter((i: any) => i.user_id === u.id);
        const dueSum = userInvs
          .filter((i: any) => (i.status || '').toLowerCase() !== 'paid' && (i.status || '').toLowerCase() !== 'cancelled')
          .reduce((acc: number, i: any) => acc + Math.max(0, (Number(i.total || i.amount || 0) - Number(i.paid_amount || 0))), 0);

        return {
          id: u.id,
          email: u.email || u.business_email,
          owner_name: u.name,
          business_name: u.business,
          last_active_at: u.last_active_at || u.updated_at || u.created_at,
          invoices_count: userInvs.length,
          items_count: u.items_count,
          pending_due: dueSum > 0 ? dueSum.toLocaleString('en-IN') : undefined,
          customers_count: u.customers_count
        };
      });

      const res = await fetch('/api/admin/check-inactivity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ users: payloadUsers, force: false, reset: false })
      });

      if (res.ok) {
        const data = await res.json();
        const syncDate = new Date();
        setLastAutoSyncTime(syncDate);
        localStorage.setItem('admin_last_reminder_autosync', syncDate.toISOString());
        if (data.sent > 0) {
          triggerToast(`⚡ Real-time Auto-Sync: Dispatched ${data.sent} reminder(s) automatically!`);
        }
      }
    } catch (err) {
      console.warn("Auto-sync background check error:", err);
    } finally {
      isAutoSyncingRef.current = false;
    }
  }, [autoSyncEnabled, inactiveUsersForReminder, dbInvoices, lastAutoSyncTime]);

  // Periodic heartbeat: run auto-sync every 60 seconds while admin is viewing
  useEffect(() => {
    if (!autoSyncEnabled) return;
    performAutoSync();
    const interval = setInterval(performAutoSync, 60000);
    return () => clearInterval(interval);
  }, [autoSyncEnabled, performAutoSync]);

  const handleToggleAutoSync = () => {
    const nextVal = !autoSyncEnabled;
    setAutoSyncEnabled(nextVal);
    localStorage.setItem('admin_reminder_autosync', String(nextVal));
    triggerToast(`Real-time Auto-Sync is now ${nextVal ? 'ACTIVATED (Scanning Every 60s)' : 'PAUSED'}.`);
  };

  const handleSendIndividualReminder = async (targetUser: any) => {
    const email = (targetUser.email || targetUser.business_email || '').trim();
    if (!email || !email.includes('@')) {
      triggerToast("User does not have a valid recipient email.");
      return;
    }

    setSendingReminderUserId(targetUser.id);
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const userInvs = dbInvoices.filter((i: any) => i.user_id === targetUser.id);
        const dueSum = userInvs
          .filter((i: any) => (i.status || '').toLowerCase() !== 'paid' && (i.status || '').toLowerCase() !== 'cancelled')
          .reduce((acc: number, i: any) => acc + Math.max(0, (Number(i.total || i.amount || 0) - Number(i.paid_amount || 0))), 0);

        const dateRaw = targetUser.last_active_at || targetUser.updated_at || targetUser.created_at;
        let diffDays = 1;
        let lastLoginFormatted = "Recently";
        if (dateRaw) {
          const parsed = parseDateSafe(dateRaw);
          diffDays = Math.max(1, Math.round((Date.now() - parsed.getTime()) / (24 * 3600000)));
          lastLoginFormatted = parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        const res = await fetch('/api/admin/send-user-reminder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: targetUser.id,
            email,
            recipientName: targetUser.name || targetUser.owner_name || targetUser.display_name,
            businessName: targetUser.business || targetUser.business_name,
            lastLoginDate: lastLoginFormatted,
            daysInactive: `${diffDays} Day${diffDays > 1 ? 's' : ''}`,
            invoiceCount: String(userInvs.length),
            stockCount: targetUser.items_count !== undefined ? `${targetUser.items_count} Items` : (userInvs.length > 0 ? "Synced" : "0 Items"),
            dueCount: `₹${dueSum.toLocaleString('en-IN')}`,
            customerCount: targetUser.customers_count !== undefined ? String(targetUser.customers_count) : "0",
            deliveryMode: "Manual"
          })
        });

        if (res.ok) {
          triggerToast(`Reminder email dispatched to ${email}!`);
        } else {
          const err = await res.json();
          triggerToast(`Failed to dispatch: ${err.error || 'Unknown Error'}`);
        }
      }
    } catch (err: any) {
      console.error("Individual reminder dispatch error:", err);
      triggerToast(`Connection failed: ${err.message || err}`);
    } finally {
      setSendingReminderUserId(null);
    }
  };

  const handleTriggerInactivityCheck = async () => {
    setCheckingInactivity(true);
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const payloadUsers = inactiveUsersForReminder.map((u: any) => {
          const userInvs = dbInvoices.filter((i: any) => i.user_id === u.id);
          const dueSum = userInvs
            .filter((i: any) => (i.status || '').toLowerCase() !== 'paid' && (i.status || '').toLowerCase() !== 'cancelled')
            .reduce((acc: number, i: any) => acc + Math.max(0, (Number(i.total || i.amount || 0) - Number(i.paid_amount || 0))), 0);

          return {
            id: u.id,
            email: u.email || u.business_email,
            owner_name: u.name,
            business_name: u.business,
            last_active_at: u.last_active_at || u.updated_at || u.created_at,
            invoices_count: userInvs.length,
            items_count: u.items_count,
            pending_due: dueSum > 0 ? dueSum.toLocaleString('en-IN') : undefined,
            customers_count: u.customers_count
          };
        });

        const res = await fetch('/api/admin/check-inactivity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ users: payloadUsers, force: forceScan, reset: resetStatuses })
        });
        if (res.ok) {
          const result = await res.json();
          triggerToast(`Inactivity check complete. Checked ${result.checked} users, sent ${result.sent} emails.`);
          // Reset controls back to safe false defaults
          setForceScan(false);
          setResetStatuses(false);
        } else {
          const err = await res.json();
          triggerToast(`Failed to trigger check: ${err.error || 'Unknown Error'}`);
        }
      }
    } catch (err: any) {
      console.error("Inactivity trigger error:", err);
      triggerToast(`Connection failed: ${err.message || err}`);
    } finally {
      setCheckingInactivity(false);
    }
  };

  const handleSendTestReminder = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      triggerToast("Please enter a valid recipient email.");
      return;
    }
    setSendingTest(true);
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const cleanEmail = testEmail.trim().toLowerCase();
        
        // Match real user record from database
        const matchedUser = dbUsers.find((u: any) => (u.email || u.business_email || '').trim().toLowerCase() === cleanEmail);
        const userInvs = matchedUser ? dbInvoices.filter((i: any) => i.user_id === matchedUser.id) : [];
        const dueSum = userInvs
          .filter((i: any) => {
            const st = (i.status || '').toLowerCase();
            return st !== 'paid' && st !== 'cancelled';
          })
          .reduce((acc: number, i: any) => acc + Math.max(0, (Number(i.total || i.amount || 0) - Number(i.paid_amount || 0))), 0);

        const lastActive = matchedUser?.last_active_at || matchedUser?.updated_at || matchedUser?.created_at;
        let diffDays = 1;
        let lastLoginFormatted = "Recently";
        if (lastActive) {
          const parsed = parseDateSafe(lastActive);
          diffDays = Math.max(1, Math.round((Date.now() - parsed.getTime()) / (24 * 3600000)));
          lastLoginFormatted = parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        const realPayload = {
          email: testEmail,
          businessName: matchedUser?.business_name || matchedUser?.owner_name || matchedUser?.display_name || cleanEmail.split('@')[0],
          lastLoginDate: lastLoginFormatted,
          daysInactive: `${diffDays} Day${diffDays > 1 ? 's' : ''}`,
          invoiceCount: String(userInvs.length),
          stockCount: matchedUser?.items_count !== undefined ? `${matchedUser.items_count} Items` : (userInvs.length > 0 ? "Synced" : "0 Items"),
          dueCount: `₹${dueSum.toLocaleString('en-IN')}`,
          customerCount: matchedUser?.customers_count !== undefined ? String(matchedUser.customers_count) : "0"
        };

        const res = await fetch('/api/admin/send-test-reminder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(realPayload)
        });
        if (res.ok) {
          triggerToast(`Test email dispatched to ${testEmail} with real user data!`);
          setTestEmail('');
        } else {
          const err = await res.json();
          triggerToast(`Test failed: ${err.error || 'Unknown Error'}`);
        }
      }
    } catch (err: any) {
      console.error("Test send error:", err);
      triggerToast(`Connection failed: ${err.message || err}`);
    } finally {
      setSendingTest(false);
    }
  };

  // Dynamic calculations for Invoice Creation volume streams (counts only)
  const invoiceChartDataYear = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const data = months.map(name => ({ name, count: 0 }));
    
    dbInvoices.forEach(inv => {
      const date = parseDateSafe(inv.created_at);
      if (date.getFullYear() === currentYear) {
        const monthIndex = date.getMonth();
        data[monthIndex].count += 1;
      }
    });
    return data;
  }, [dbInvoices]);

  const invoiceChartDataMonth = useMemo(() => {
    const data = [
      { name: 'Week 1', count: 0 },
      { name: 'Week 2', count: 0 },
      { name: 'Week 3', count: 0 },
      { name: 'Week 4', count: 0 },
      { name: 'Week 5', count: 0 }
    ];
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    dbInvoices.forEach(inv => {
      const date = parseDateSafe(inv.created_at);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        const day = date.getDate();
        let weekIndex = Math.floor((day - 1) / 7);
        if (weekIndex > 4) weekIndex = 4;
        data[weekIndex].count += 1;
      }
    });
    return data;
  }, [dbInvoices]);

  // Daily statistics for 7-day sparklines
  const sparklineInvoices = useMemo(() => {
    const data = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { dateStr: format(d, 'yyyy-MM-dd'), pv: 0 };
    });
    
    dbInvoices.forEach(inv => {
      const invDateStr = format(parseDateSafe(inv.created_at), 'yyyy-MM-dd');
      const dayBucket = data.find(item => item.dateStr === invDateStr);
      if (dayBucket) {
        dayBucket.pv += 1;
      }
    });
    return data;
  }, [dbInvoices]);

  const sparklineUsers = useMemo(() => {
    const data = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { dateStr: format(d, 'yyyy-MM-dd'), pv: 0 };
    });
    
    dbUsers.forEach(u => {
      const uDateStr = format(parseDateSafe(u.created_at), 'yyyy-MM-dd');
      const dayBucket = data.find(item => item.dateStr === uDateStr);
      if (dayBucket) {
        dayBucket.pv += 1;
      }
    });
    return data;
  }, [dbUsers]);

  const sparklineBusinesses = useMemo(() => {
    const data = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { dateStr: format(d, 'yyyy-MM-dd'), pv: 0 };
    });
    
    dbUsers.forEach(u => {
      if (u.business_name) {
        const uDateStr = format(parseDateSafe(u.created_at), 'yyyy-MM-dd');
        const dayBucket = data.find(item => item.dateStr === uDateStr);
        if (dayBucket) {
          dayBucket.pv += 1;
        }
      }
    });
    return data;
  }, [dbUsers]);

  const sparklineActiveToday = useMemo(() => {
    const data = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { dateStr: format(d, 'yyyy-MM-dd'), pv: 0 };
    });
    
    mergedUsers.forEach(u => {
      const uDateStr = format(u.lastActiveDate, 'yyyy-MM-dd');
      const dayBucket = data.find(item => item.dateStr === uDateStr);
      if (dayBucket) {
        dayBucket.pv += 1;
      }
    });
    return data;
  }, [mergedUsers]);

  // Compute week-over-week trends
  const trends = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(now.getDate() - 14);

    let thisWeekInvoices = 0;
    let lastWeekInvoices = 0;

    dbInvoices.forEach(inv => {
      const date = parseDateSafe(inv.created_at);
      if (date >= oneWeekAgo && date <= now) {
        thisWeekInvoices++;
      } else if (date >= twoWeeksAgo && date < oneWeekAgo) {
        lastWeekInvoices++;
      }
    });

    let thisWeekUsers = 0;
    let lastWeekUsers = 0;
    let thisWeekBusinesses = 0;
    let lastWeekBusinesses = 0;

    dbUsers.forEach(u => {
      const date = parseDateSafe(u.created_at);
      if (date >= oneWeekAgo && date <= now) {
        thisWeekUsers++;
        if (u.business_name) thisWeekBusinesses++;
      } else if (date >= twoWeeksAgo && date < oneWeekAgo) {
        lastWeekUsers++;
        if (u.business_name) lastWeekBusinesses++;
      }
    });

    const getPercentChange = (current: number, previous: number) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return ((current - previous) / previous) * 100;
    };

    return {
      invoices: getPercentChange(thisWeekInvoices, lastWeekInvoices),
      users: getPercentChange(thisWeekUsers, lastWeekUsers),
      businesses: getPercentChange(thisWeekBusinesses, lastWeekBusinesses),
    };
  }, [dbInvoices, dbUsers]);

  // Real chronological system logs based on actual DB actions (Strictly without currency amounts)
  const dbActivities = useMemo<ActivityItem[]>(() => {
    const list: ActivityItem[] = [];
    
    dbUsers.forEach(u => {
      const date = parseDateSafe(u.created_at);
      list.push({
        id: `user-${u.id}`,
        type: 'signup',
        title: 'New user registered',
        description: `${u.display_name || u.owner_name || 'Anonymous User'} joined the platform`,
        time: formatDistanceToNow(date, { addSuffix: true }),
        rawTime: date
      });
      
      if (u.business_name) {
        list.push({
          id: `biz-${u.id}`,
          type: 'business',
          title: 'New business added',
          description: `${u.business_name} registered by ${u.display_name || u.owner_name || 'Owner'}`,
          time: formatDistanceToNow(date, { addSuffix: true }),
          rawTime: date
        });
      }
    });
    
    dbInvoices.forEach(inv => {
      const date = parseDateSafe(inv.created_at);
      const invNo = inv.invoice_number || `#${inv.id.substring(0, 8)}`;
      list.push({
        id: `inv-${inv.id}`,
        type: 'invoice',
        title: 'Invoice created',
        description: `Invoice ${invNo} created${inv.customer_name ? ' for ' + inv.customer_name : ''}`,
        time: formatDistanceToNow(date, { addSuffix: true }),
        rawTime: date
      });
      
      if (inv.status === 'paid') {
        const paidDate = inv.updated_at ? parseDateSafe(inv.updated_at) : date;
        list.push({
          id: `pay-${inv.id}`,
          type: 'payment',
          title: 'Payment marked completed',
          description: `Payment confirmed for Invoice ${invNo}`,
          time: formatDistanceToNow(paidDate, { addSuffix: true }),
          rawTime: paidDate
        });
      }
    });
    
    return list.sort((a, b) => b.rawTime.getTime() - a.rawTime.getTime());
  }, [dbUsers, dbInvoices]);

  // Export statistics report handler (Privacy-safe report without amounts)
  const handleExportData = (formatType: 'csv' | 'pdf') => {
    setShowExportMenu(false);
    if (formatType === 'csv') {
      const csvRows = [
        ['Report Date Range', dateRangeText],
        [],
        ['Metric', 'Count'],
        ['Total Users', statsSummary.totalUsers],
        ['Total Invoices Created', statsSummary.totalInvoices],
        ['Active Users Today', activeTodayCount],
        ['Active Online Now', activeNowCount],
        ['Total Registered Businesses', statsSummary.totalBusinesses],
        [],
        ['User Name', 'Email', 'Business Name', 'Status', 'Invoices Created', 'Last Active Time', 'Joined Date'],
        ...filteredUsers.map(u => [
          `"${u.name}"`,
          `"${u.email}"`,
          `"${u.business}"`,
          `"${u.status}"`,
          u.invoiceCount,
          `"${format(u.lastActiveDate, 'yyyy-MM-dd HH:mm')}"`,
          `"${format(parseDateSafe(u.joinedOn), 'yyyy-MM-dd')}"`
        ])
      ];
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + csvRows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `invocentric_users_activity_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerToast("CSV User Activity Report Downloaded!");
    } else {
      window.print();
      triggerToast("Print/PDF dialog opened!");
    }
  };

  // Helper renderer for user real-time last active timestamp & status
  const renderLastActiveBadge = (lastActiveDate: Date) => {
    const now = Date.now();
    const diffMs = now - lastActiveDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    // Active in last 3 minutes -> Glowing green "ONLINE NOW" badge
    if (diffMins < 3) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black shadow-xs tracking-wider border border-emerald-500">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>ONLINE NOW</span>
        </div>
      );
    }

    if (diffMins < 10) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200/80">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Active {diffMins}m ago</span>
        </div>
      );
    }

    // Active today -> Relative minutes/hours
    const isToday = lastActiveDate.toDateString() === new Date().toDateString();
    if (isToday) {
      return (
        <div className="inline-flex items-center gap-1 text-slate-700 text-[11px] font-bold">
          <Clock size={12} className="text-emerald-600 shrink-0" />
          <span>{formatDistanceToNow(lastActiveDate, { addSuffix: true })}</span>
          <span className="text-slate-400 font-normal">({format(lastActiveDate, 'hh:mm a')})</span>
        </div>
      );
    }

    // Active on earlier days -> Date format
    return (
      <div className="inline-flex items-center gap-1 text-slate-500 text-[11px] font-medium">
        <Clock size={12} className="text-slate-400 shrink-0" />
        <span>{format(lastActiveDate, 'dd MMM, hh:mm a')}</span>
      </div>
    );
  };

  if (authLoading) return null;
  if (!showAdmin) return <Navigate to="/" />;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-10 pb-24 space-y-8 animate-fadeIn">
      
      {/* Toast Feedback Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 md:right-12 z-50 bg-slate-900 text-white text-xs font-black uppercase tracking-wider px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-800"
          >
            <CheckCircle size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADMIN TITLE BANNER CONTAINER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-transparent">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-sans flex items-center gap-2">
            Admin Panel & Real-time Monitor ⚡
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Real-time user activity, active timestamps, and invoice counts.
          </p>
        </div>

        {/* CONTROLS AREA: DATE FILTER & EXPORT */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto relative">
          
          {/* Live Online Badge */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-800 shadow-xs">
            <Radio size={14} className="text-emerald-600 animate-pulse" />
            <span>{activeNowCount} Online Now</span>
          </div>

          {/* Date Picker Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDatePickerDropdown(!showDatePickerDropdown);
                setShowExportMenu(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-sm cursor-pointer select-none"
            >
              <Calendar size={14} className="text-slate-400" />
              <span>{dateRangeText}</span>
              <ChevronDown size={14} className="text-slate-500" />
            </button>

            {showDatePickerDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 overflow-hidden animate-fadeIn py-1">
                <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filter System Range</p>
                </div>
                {[
                  'Today (Real-time)',
                  'Yesterday',
                  'Last 7 Days',
                  'Last 30 Days',
                  'This Month',
                  'All Time'
                ].map((rangeOption) => (
                  <button
                    key={rangeOption}
                    onClick={() => handleSelectDateRange(rangeOption)}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-none"
                  >
                    {rangeOption}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Report Action Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowDatePickerDropdown(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#00B074] hover:bg-[#00905d] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer select-none border-none"
            >
              <FileCheck size={14} />
              <span>Export User Log</span>
              <ChevronDown size={14} className="text-white opacity-80" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn py-1">
                <button
                  onClick={() => handleExportData('csv')}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 border-none cursor-pointer"
                >
                  <FileText size={14} className="text-slate-400" />
                  <span>Download User Activity CSV</span>
                </button>
                <button
                  onClick={() => handleExportData('pdf')}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 border-none cursor-pointer"
                >
                  <FileCheck size={14} className="text-slate-400" />
                  <span>Print Activity Report</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* TABS SUB-NAVIGATION BAR (Extremely PC & Smartphone Friendly) */}
      <div className="flex border-b border-slate-100 overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex space-x-1 p-1 bg-slate-50 rounded-2xl border border-slate-100 w-full md:w-auto min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer",
              activeTab === 'overview'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900 bg-transparent"
            )}
          >
            <Activity size={15} />
            <span>Overview Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer",
              activeTab === 'users'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900 bg-transparent"
            )}
          >
            <Users size={15} />
            <span>User Registry</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-black bg-slate-200/80 text-slate-700 rounded-full">
              {mergedUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer relative",
              activeTab === 'approvals'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900 bg-transparent"
            )}
          >
            <CheckCircle size={15} />
            <span>UPI Approvals</span>
            {subscriptionRequests.filter(r => r.status === 'pending').length > 0 ? (
              <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500 text-white rounded-full animate-pulse">
                {subscriptionRequests.filter(r => r.status === 'pending').length}
              </span>
            ) : (
              <span className="ml-1 px-2 py-0.5 text-[10px] font-black bg-slate-200/85 text-slate-700 rounded-full">
                0
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer",
              activeTab === 'emails'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900 bg-transparent"
            )}
          >
            <Mail size={15} />
            <span>Email & Automations</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-black bg-slate-200/85 text-slate-700 rounded-full">
              {emailLogs.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* METRICS STATS BOARD GRID (Counts only - no amounts) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1: Total Users */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all h-40">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Registered Users</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {statsSummary.totalUsers.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner border border-emerald-100">
              <Users size={18} />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50/50">
            <div className={cn("flex items-center gap-1 text-[11px] font-black", trends.users >= 0 ? "text-emerald-600" : "text-rose-500")}>
              {trends.users >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{Math.abs(trends.users).toFixed(1)}%</span>
              <span className="text-slate-400 font-bold ml-0.5">vs last week</span>
            </div>
            {/* Sparkline Miniature representation */}
            <div className="w-16 h-8 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineUsers}>
                  <Area type="monotone" dataKey="pv" stroke="#00B074" fill="#00B074" fillOpacity={0.1} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Invoices Created */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all h-40">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Invoices Created</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {statsSummary.totalInvoices.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 bg-green-50 text-green-700 rounded-full flex items-center justify-center shadow-inner border border-green-100">
              <FileText size={18} />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50/50">
            <div className={cn("flex items-center gap-1 text-[11px] font-black", trends.invoices >= 0 ? "text-emerald-600" : "text-rose-500")}>
              {trends.invoices >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{Math.abs(trends.invoices).toFixed(1)}%</span>
              <span className="text-slate-400 font-bold ml-0.5">vs last week</span>
            </div>
            {/* Sparkline Miniature representation */}
            <div className="w-16 h-8 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineInvoices}>
                  <Area type="monotone" dataKey="pv" stroke="#0D9488" fill="#0D9488" fillOpacity={0.1} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Users Today */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all h-40">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Active Users Today</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{activeTodayCount}</span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {activeNowCount} Online
                </span>
              </h3>
            </div>
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shadow-inner">
              <Activity size={18} />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50/50">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-time Active</span>
            </div>
            {/* Sparkline Miniature representation */}
            <div className="w-16 h-8 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineActiveToday}>
                  <Area type="monotone" dataKey="pv" stroke="#00B074" fill="#00B074" fillOpacity={0.1} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Metric 4: Total Businesses */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all h-40">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Registered Businesses</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {statsSummary.totalBusinesses}
              </h3>
            </div>
            <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center shadow-inner">
              <Building size={18} />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50/50">
            <div className={cn("flex items-center gap-1 text-[11px] font-black", trends.businesses >= 0 ? "text-emerald-600" : "text-rose-500")}>
              {trends.businesses >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{Math.abs(trends.businesses).toFixed(1)}%</span>
              <span className="text-slate-400 font-bold ml-0.5">vs last week</span>
            </div>
            {/* Sparkline Miniature representation */}
            <div className="w-16 h-8 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineBusinesses}>
                  <Area type="monotone" dataKey="pv" stroke="#00B074" fill="#00B074" fillOpacity={0.1} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>

      {/* CHARTS CONTAINER SECTION: INVOICE VOLUME STREAM + USER DEMOGRAPHICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Invoice Volume Stream (2/3 col space) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-50">
            <div>
              <h2 className="text-lg font-black text-slate-900">Invoices Creation Stream</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Platform invoice generation volume over time</p>
            </div>
            
            {/* Filter selectors inside chart header */}
            <div className="flex items-center gap-2">
              <select
                value={timelineFilter}
                onChange={(e) => {
                  setTimelineFilter(e.target.value as 'year' | 'month');
                  triggerToast(`Timeline set to: ${e.target.value === 'year' ? 'This Year' : 'This Month'}`);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="year">This Year</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>

          {/* Area Chart of invoice creation counts */}
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timelineFilter === 'year' ? invoiceChartDataYear : invoiceChartDataMonth}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorInvoices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00B074" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#00B074" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', border: 'none', borderRadius: '12px' }}
                  labelStyle={{ color: '#E2E8F0', fontWeight: 'bold', fontSize: 11 }}
                  itemStyle={{ color: '#00B074', fontWeight: 'bold', fontSize: 12 }}
                  formatter={(value: any) => [`${value} Invoices Created`, 'Volume']}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#00B074" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorInvoices)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: User & Business Overview (1/3 col space) */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-black text-slate-900">User Status Distribution</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Platform account status breakdown</p>
            </div>

            {/* Doughnut Pie chart with central text */}
            <div className="relative w-full h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active Users', value: userStatusDistribution.active },
                      { name: 'Inactive Users', value: userStatusDistribution.inactive },
                      { name: 'Pending Users', value: userStatusDistribution.pending }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    <Cell fill="#00B074" />
                    <Cell fill="#64748B" />
                    <Cell fill="#0D9488" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center text representing the total users */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-slate-900 leading-none">
                  {statsSummary.totalUsers.toLocaleString()}
                </span>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-0.5">
                  Total Users
                </span>
              </div>
            </div>

            {/* Custom Pie Legend */}
            <div className="space-y-2 mt-4 pt-3 border-t border-slate-50">
              {/* Active */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00B074]" />
                  <span className="text-slate-600">Active Users</span>
                </div>
                <div className="text-slate-950 font-bold">
                  {userStatusDistribution.active} <span className="text-slate-400 font-bold text-[10.5px]">({userStatusDistribution.activePct}%)</span>
                </div>
              </div>
              
              {/* Inactive */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#64748B]" />
                  <span className="text-slate-600">Inactive Users</span>
                </div>
                <div className="text-slate-950 font-bold">
                  {userStatusDistribution.inactive} <span className="text-slate-400 font-bold text-[10.5px]">({userStatusDistribution.inactivePct}%)</span>
                </div>
              </div>

              {/* Pending */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
                  <span className="text-slate-600">Pending Users</span>
                </div>
                <div className="text-slate-950 font-bold">
                  {userStatusDistribution.pending} <span className="text-slate-400 font-bold text-[10.5px]">({userStatusDistribution.pendingPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Under-Legend Cards */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-50">
            <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Stores</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-lg font-black text-slate-900">{activeBusinessesCount}</span>
                <span className={cn("text-[9px] font-bold flex items-center", trends.businesses >= 0 ? "text-emerald-600" : "text-rose-500")}>
                  {trends.businesses >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {Math.abs(trends.businesses).toFixed(1)}%
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight mt-0.5">vs last week</p>
            </div>

            <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pending Stores</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-lg font-black text-slate-900">{pendingBusinessesCount}</span>
                <span className="text-[9px] font-bold text-slate-400 flex items-center">
                  Trial mode
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight mt-0.5 font-sans">vs last week</p>
            </div>
          </div>

        </div>

      </div>
      </>)}

      {/* UPI SUBSCRIPTION APPROVAL QUEUE */}
      {activeTab === 'approvals' && (
        <div className="space-y-8">
          {subscriptionRequests.filter(r => r.status === 'pending').length > 0 ? (
            <div className="bg-white border border-amber-200 rounded-[2.5rem] p-6 md:p-8 space-y-6 shadow-md shadow-amber-500/5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-amber-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <span>Pending UPI Subscription Approvals</span>
                <span className="text-xs font-black bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {subscriptionRequests.filter(r => r.status === 'pending').length} Requests
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                Match UTR Ref No. in SBI Yono with these submissions. Click "Approve" to upgrade user and generate automated invoice receipt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePurgeAllPending}
                className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 text-[10px] font-black uppercase tracking-wider rounded-xl border border-red-200 transition-colors cursor-pointer"
                title="Clear or reject all pending requests if any are stuck"
              >
                Clear All Pending
              </button>
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border border-amber-200">
                <Clock size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
                <span>Manual match required</span>
              </div>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="pb-3 font-black">User Email</th>
                  <th className="pb-3 font-black">Ref No / UTR</th>
                  <th className="pb-3 font-black">Plan Cycle</th>
                  <th className="pb-3 font-black">Amount</th>
                  <th className="pb-3 font-black">Date Requested</th>
                  <th className="pb-3 text-right font-black">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptionRequests.filter(r => r.status === 'pending').map((req) => (
                  <tr key={req.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 text-xs font-extrabold text-slate-900">{req.user_email || req.email || 'N/A'}</td>
                    <td className="py-3.5 text-xs">
                      <div className="font-mono font-extrabold text-green-700 bg-green-50/50 px-2 py-1 rounded-lg w-fit flex items-center gap-1.5">
                        <span>{req.upi_id_ref || req.upiId || 'N/A'}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(req.upi_id_ref || req.upiId || '');
                            triggerToast("Copied Reference to Clipboard!");
                          }}
                          className="p-1 hover:bg-green-100 rounded text-green-600 transition-colors border-none bg-transparent cursor-pointer"
                          title="Copy reference"
                        >
                          <Copy size={10} />
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                      {req.billing_cycle || 'monthly'}
                    </td>
                    <td className="py-3.5 text-xs font-extrabold text-[#166534]">₹{req.amount}</td>
                    <td className="py-3.5 text-xs text-slate-500 font-medium">
                      {format(parseDateSafe(req.created_at), 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleDeleteSubscriptionRequest(req.id)}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors border-none cursor-pointer"
                        title="Delete record"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => handleRejectSubscription(req.id, req.user_id || req.uid || '', req.user_email || req.email || '', req.upi_id_ref || req.upiId || '')}
                        className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors border-none cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveSubscription(req.id, req.user_id || req.uid || '', req.user_email || req.email || '', req.amount, req.billing_cycle || 'monthly', req.upi_id_ref || req.upiId || '')}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors shadow-sm shadow-emerald-600/10 border-none cursor-pointer"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile-Friendly Cards Layout for Smartphones */}
          <div className="block md:hidden space-y-4">
            {subscriptionRequests.filter(r => r.status === 'pending').map((req) => (
              <div key={req.id} className="bg-slate-50 p-5 rounded-3xl border border-slate-100/80 space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">User Email</span>
                    <p className="text-xs font-extrabold text-slate-900 break-all">{req.user_email || req.email || 'N/A'}</p>
                  </div>
                  <span className="text-xs font-extrabold text-[#166534] bg-green-50 border border-green-100/50 px-2.5 py-1 rounded-xl shrink-0">
                    ₹{req.amount}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Plan Cycle</span>
                    <p className="font-extrabold text-slate-700 uppercase mt-0.5">{req.billing_cycle || 'monthly'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Requested On</span>
                    <p className="text-slate-500 font-semibold mt-0.5">
                      {format(parseDateSafe(req.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ref No / UTR</span>
                  <div className="font-mono font-extrabold text-green-700 bg-green-50/50 px-3 py-2 rounded-xl w-full flex items-center justify-between">
                    <span className="truncate mr-2 text-xs select-all">{req.upi_id_ref || req.upiId || 'N/A'}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(req.upi_id_ref || req.upiId || '');
                        triggerToast("Copied Reference!");
                      }}
                      className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg transition-colors border-none bg-transparent cursor-pointer shrink-0"
                      title="Copy reference"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-slate-200/40">
                  <button
                    onClick={() => handleRejectSubscription(req.id, req.user_id || req.uid || '', req.user_email || req.email || '', req.upi_id_ref || req.upiId || '')}
                    className="flex-1 py-3 bg-red-50 text-red-700 hover:bg-red-100 text-[10.5px] font-black uppercase tracking-wider rounded-2xl transition-colors border-none cursor-pointer flex items-center justify-center min-h-[44px]"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveSubscription(req.id, req.user_id || req.uid || '', req.user_email || req.email || '', req.amount, req.billing_cycle || 'monthly', req.upi_id_ref || req.upiId || '')}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-2xl transition-colors shadow-sm shadow-emerald-600/10 border-none cursor-pointer flex items-center justify-center min-h-[44px]"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center space-y-4 shadow-sm animate-fadeIn">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner border border-green-100">
            <Check size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">All Approvals Processed</h3>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto mt-1">
              Every single UPI subscription upgrade request has been verified and processed successfully.
            </p>
          </div>
        </div>
      )}

      {/* PROCESSED LOGS / AUDIT TRAIL */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-8 space-y-6 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900">Subscription Upgrades Audit Trail</h2>
          <p className="text-xs text-slate-400 font-bold mt-0.5">
            Historical log of all approved and processed platform subscriptions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                <th className="pb-3 font-black">User Email</th>
                <th className="pb-3 font-black">Ref No / UTR</th>
                <th className="pb-3 font-black">Billing Cycle</th>
                <th className="pb-3 font-black">Amount</th>
                <th className="pb-3 font-black">Status</th>
                <th className="pb-3 text-right font-black">Date Processed</th>
                <th className="pb-3 text-right font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptionRequests.filter(r => r.status !== 'pending').length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic text-xs">
                    No historical subscription requests processed yet.
                  </td>
                </tr>
              ) : (
                subscriptionRequests.filter(r => r.status !== 'pending').map((req) => (
                  <tr key={req.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 text-xs font-extrabold text-slate-900">{req.user_email || req.email || 'N/A'}</td>
                    <td className="py-3.5 text-xs font-mono font-bold text-slate-500">{req.upi_id_ref || req.upiId || 'N/A'}</td>
                    <td className="py-3.5 text-xs uppercase tracking-wider font-bold">{req.billing_cycle || 'monthly'}</td>
                    <td className="py-3.5 text-xs font-extrabold text-[#166534]">₹{req.amount}</td>
                    <td className="py-3.5 text-xs">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        req.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                      )}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right text-xs text-slate-400 font-bold">
                      {req.approved_at ? format(parseDateSafe(req.approved_at), 'dd MMM yyyy, hh:mm a') : format(parseDateSafe(req.created_at), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3.5 text-right text-xs">
                      <button
                        onClick={() => handleDeleteSubscriptionRequest(req.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer inline-flex items-center"
                        title="Remove entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* RECENT USERS REGISTRY TABLE */}
      {activeTab === 'users' && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between transition-all duration-300 w-full animate-fadeIn">
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>Users Activity & Invoices Log</span>
                  <span className="text-xs font-black bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                    {filteredUsers.length} Users
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5 font-sans">
                  Real-time active timestamps & invoice creation counts per user
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative w-full sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search user, business..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#00B074]"
                  />
                </div>

                {/* Filter Status */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                {/* View switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-0.5">
                  <button
                    onClick={() => setUsersLayoutMode('grid')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all border-none cursor-pointer flex items-center justify-center",
                      usersLayoutMode === 'grid' ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-600 bg-transparent"
                    )}
                    title="Grid Card View"
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    onClick={() => setUsersLayoutMode('table')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all border-none cursor-pointer flex items-center justify-center",
                      usersLayoutMode === 'table' ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-600 bg-transparent"
                    )}
                    title="List Table View"
                  >
                    <List size={14} />
                  </button>
                </div>

                {showAllUsersModal ? (
                  <button 
                    onClick={() => {
                      setShowAllUsersModal(false);
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 border-none cursor-pointer transition-all"
                  >
                    <X size={14} />
                    <span>Collapse</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowAllUsersModal(true)}
                    className="text-xs font-bold text-[#00B074] hover:underline bg-transparent border-none cursor-pointer"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>

            {usersLayoutMode === 'grid' ? (
              /* Grid Layout view */
              <div className={cn(
                "grid gap-4 transition-all duration-300",
                showAllUsersModal ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 animate-fadeIn" : "grid-cols-1 sm:grid-cols-2"
              )}>
                {(showAllUsersModal ? filteredUsers : filteredUsers.slice(0, 4)).map((u) => {
                  return (
                    <div 
                      key={u.id} 
                      className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-3xl p-4 transition-all group relative flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        {/* Header: User Info & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center overflow-hidden font-bold text-emerald-700 text-xs shadow-inner">
                                {u.photo_url ? (
                                  <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  u.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              {Date.now() - u.lastActiveDate.getTime() < 3 * 60 * 1000 && (
                                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white animate-pulse" title="Online Now" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-slate-900 text-xs truncate max-w-[120px]" title={u.name}>
                                {u.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]" title={u.email}>
                                {u.email}
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleToggleStatus(u.id, u.status)}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider transition-all select-none border border-transparent cursor-pointer shrink-0",
                              u.status === 'Active' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" :
                              u.status === 'Inactive' ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-amber-50 text-amber-500 hover:bg-amber-100"
                            )}
                            title="Click to toggle user status!"
                          >
                            {u.status}
                          </button>
                        </div>

                        {/* Details: Invoices Count & Real-time Active Timestamp */}
                        <div className="mt-3.5 pt-3 border-t border-slate-200/50 space-y-2">
                          
                          {/* 1. Invoices Created Badge */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-400 uppercase tracking-tight text-[9px]">Invoices Created</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200/80">
                              <FileText size={12} className="text-emerald-600" />
                              <span>{u.invoiceCount} Invoices</span>
                            </span>
                          </div>

                          {/* 2. Last Active Real-time Timestamp */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-400 uppercase tracking-tight text-[9px]">Last Active</span>
                            {renderLastActiveBadge(u.lastActiveDate)}
                          </div>

                          {/* 3. Business Name */}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-slate-400 uppercase tracking-tight text-[9px]">Business</span>
                            <span className="font-bold text-slate-700 truncate max-w-[120px]" title={u.business}>{u.business}</span>
                          </div>

                          {/* 4. Plan Tier */}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-slate-400 uppercase tracking-tight text-[9px]">Plan</span>
                            <button
                              onClick={() => handleTogglePlan(u.id, u.plan || 'free')}
                              className={cn(
                                "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all select-none border border-transparent cursor-pointer flex items-center gap-0.5",
                                (u.plan === 'pro') 
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200/50" 
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/50"
                              )}
                              title="Click to toggle plan tier!"
                            >
                              {(u.plan === 'pro') ? <Sparkles size={9} className="text-amber-600 animate-pulse" /> : null}
                              <span>{(u.plan || 'free').toUpperCase()}</span>
                            </button>
                          </div>

                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-200/50 flex items-center justify-between">
                        <span className="text-[9px] font-mono text-slate-400">ID: {u.id.substring(0, 6).toUpperCase()}</span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSendIndividualReminder(u)}
                            disabled={sendingReminderUserId === u.id}
                            className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer disabled:opacity-50"
                            title="Send Inactivity Reminder"
                          >
                            {sendingReminderUserId === u.id ? (
                              <RefreshCw size={11} className="animate-spin text-emerald-700" />
                            ) : (
                              <Bell size={11} className="text-emerald-700" />
                            )}
                            <span>Remind</span>
                          </button>
                          <button
                            onClick={() => {
                              if (u.email) {
                                window.location.href = `mailto:${u.email}?subject=InvoCentric%20Admin%20Support`;
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[9px] font-black uppercase text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                            title="Contact user"
                          >
                            <Mail size={11} />
                            <span>Contact</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all border border-transparent hover:border-rose-100 bg-transparent cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(showAllUsersModal ? filteredUsers : filteredUsers.slice(0, 4)).length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-400 font-semibold italic">
                    No matching users found inside users registry.
                  </div>
                )}
              </div>
            ) : (
              /* Table layout */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoices Created</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Tier</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Active</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Business</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(showAllUsersModal ? filteredUsers : filteredUsers.slice(0, 6)).map((u) => {
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                          
                          {/* User Profile */}
                          <td className="py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center overflow-hidden font-bold text-emerald-700 text-xs shadow-inner">
                                  {u.photo_url ? (
                                    <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    u.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                {Date.now() - u.lastActiveDate.getTime() < 3 * 60 * 1000 && (
                                  <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-white animate-pulse" title="Online Now" />
                                )}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-xs truncate max-w-[150px]" title={u.name}>
                                  {u.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]" title={u.email}>
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Invoices Count */}
                          <td className="py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200/80">
                              <FileText size={13} className="text-emerald-600" />
                              <span>{u.invoiceCount} Invoices</span>
                            </span>
                          </td>

                          {/* Plan Tier */}
                          <td className="py-3.5">
                            <button
                              onClick={() => handleTogglePlan(u.id, u.plan || 'free')}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all select-none border border-transparent cursor-pointer flex items-center gap-1",
                                (u.plan === 'pro') 
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200/50" 
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/50"
                              )}
                              title="Click to toggle plan tier!"
                            >
                              {(u.plan === 'pro') ? <Sparkles size={10} className="text-amber-600 animate-pulse" /> : null}
                              <span>{(u.plan || 'free').toUpperCase()}</span>
                            </button>
                          </td>

                          {/* Last Active Timestamp */}
                          <td className="py-3.5">
                            {renderLastActiveBadge(u.lastActiveDate)}
                          </td>

                          {/* Business */}
                          <td className="py-3.5 text-xs text-slate-700 font-bold truncate max-w-[150px]" title={u.business}>
                            {u.business}
                          </td>

                          {/* Status badge */}
                          <td className="py-3.5">
                            <button
                              onClick={() => handleToggleStatus(u.id, u.status)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all select-none border border-transparent cursor-pointer",
                                u.status === 'Active' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100/50" :
                                u.status === 'Inactive' ? "bg-rose-50 text-rose-600 hover:bg-rose-100/50" : "bg-amber-50 text-amber-500 hover:bg-amber-100/50"
                              )}
                              title="Click to toggle user status!"
                            >
                              {u.status}
                            </button>
                          </td>

                          {/* Action buttons */}
                          <td className="py-3.5 text-center">
                            <div className="flex justify-center items-center gap-1">
                              <button
                                onClick={() => handleSendIndividualReminder(u)}
                                disabled={sendingReminderUserId === u.id}
                                className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors border-none bg-transparent cursor-pointer disabled:opacity-50"
                                title="Send Inactivity Reminder Email"
                              >
                                {sendingReminderUserId === u.id ? (
                                  <RefreshCw size={13} className="animate-spin text-emerald-600" />
                                ) : (
                                  <Bell size={13} />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  if (u.email) {
                                    window.location.href = `mailto:${u.email}?subject=InvoCentric%20Admin%20Support`;
                                  }
                                }}
                                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                                title="Email User"
                              >
                                <Mail size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Button View All Users Footer */}
          {!showAllUsersModal ? (
            <div className="pt-4 mt-2 border-t border-slate-50 flex justify-center">
              <button
                onClick={() => setShowAllUsersModal(true)}
                className="px-5 py-2.5 text-xs font-bold text-[#00B074] hover:text-[#00905d] flex items-center gap-1.5 transition-colors bg-transparent border-none cursor-pointer"
              >
                <span>View All Registered Users ({filteredUsers.length})</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          ) : (
            <div className="pt-4 mt-2 border-t border-slate-50 flex justify-center">
              <button
                onClick={() => {
                  setShowAllUsersModal(false);
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors bg-transparent border-none cursor-pointer"
              >
                <span>Collapse Registry</span>
                <X size={14} />
              </button>
            </div>
          )}

        </div>
      )}

      {/* Right: System Activity Log (Strictly without currency amounts) */}
      {activeTab === 'overview' && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between transition-all duration-300 w-full animate-fadeIn">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900">System Activity Stream</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">Real-time event chronicle</p>
              </div>

              <button 
                onClick={() => setShowAllActivitiesModal(true)}
                className="text-xs font-bold text-[#00B074] hover:underline bg-transparent border-none cursor-pointer"
              >
                View All
              </button>
            </div>

            {/* List Activity items */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {dbActivities.slice(0, 6).map((act) => {
                const styleMap = {
                  signup: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: UserPlus },
                  business: { bg: 'bg-green-100', text: 'text-green-800', icon: Building2 },
                  invoice: { bg: 'bg-emerald-50 border border-emerald-200/60', text: 'text-emerald-700', icon: FileText },
                  payment: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle },
                  delete: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Trash2 }
                };
                const config = styleMap[act.type] || styleMap.signup;
                const IconComp = config.icon;

                return (
                  <div key={act.id} className="flex gap-3 text-left group">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-inner", config.bg, config.text)}>
                      <IconComp size={15} />
                    </div>
                    <div className="min-w-0 flex-1 flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 leading-snug">{act.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">{act.description}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap pt-0.5">{act.time}</span>
                    </div>
                  </div>
                );
              })}

              {dbActivities.length === 0 && (
                <div className="text-center py-12 text-slate-400 italic text-xs">
                  No registered activities currently active.
                </div>
              )}
            </div>
          </div>

          {/* Clean Real-Time Status indicator */}
          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-time database sync active</span>
          </div>

        </div>
      )}

      {/* EMAIL HISTORY & DISPATCH CENTER */}
      {activeTab === 'emails' && (
        <div className="bg-white border border-slate-150 rounded-[2.5rem] p-6 md:p-8 space-y-6 shadow-sm mt-8 animate-fadeIn">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Mail className="text-[#166534]" size={20} />
              <span>Email Delivery & Dispatch Center</span>
              <span className="text-xs font-black bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full border border-green-200">
                {emailLogs.length} Dispatched
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              Secure automated audit log of receipts and inactivity reminder emails sent to users.
            </p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
              autoSyncEnabled 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              <span className={cn("w-2 h-2 rounded-full", autoSyncEnabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              <span>{autoSyncEnabled ? "Real-Time Auto-Sync: Active" : "Auto-Sync: Paused"}</span>
            </div>
            <button
              onClick={() => setIsSmtpModalOpen(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all hover:scale-105 active:scale-95",
                smtpStatus.configured
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse"
              )}
              title="Click to configure or test SMTP Email credentials"
            >
              <span className={cn("w-2 h-2 rounded-full", smtpStatus.configured ? "bg-[#166534] animate-pulse" : "bg-amber-600")} />
              <span>{smtpStatus.configured ? (smtpStatus.email ? `SMTP: ${smtpStatus.email}` : "SMTP Online") : "⚠️ Configure SMTP"}</span>
              <Settings size={11} className="ml-0.5 opacity-70" />
            </button>
          </div>
        </div>

        {/* REAL-TIME AUTO-SYNC REMINDERS ENGINE BANNER */}
        <div className="bg-gradient-to-br from-[#0B4D46] via-[#0F645D] to-[#083833] rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-white/15 border border-white/20 text-emerald-200 backdrop-blur-sm">
                  <Zap size={12} className="text-amber-300 fill-amber-300" />
                  <span>Real-Time Engine</span>
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border",
                  autoSyncEnabled 
                    ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/40" 
                    : "bg-rose-400/20 text-rose-200 border-rose-400/40"
                )}>
                  <span className={cn("w-2 h-2 rounded-full", autoSyncEnabled ? "bg-emerald-400 animate-ping" : "bg-rose-400")} />
                  <span>{autoSyncEnabled ? "Auto-Sync Active (Scanning Every 60s)" : "Paused"}</span>
                </span>
                {inactiveUsersForReminder.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-400/20 text-amber-200 border border-amber-400/30">
                    <Bell size={11} />
                    <span>{inactiveUsersForReminder.length} Due for Reminder</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                    <CheckCircle size={11} />
                    <span>All Users Up-To-Date</span>
                  </span>
                )}
              </div>

              <h3 className="text-lg font-black tracking-tight text-white">
                Automatic 24-Hour Inactivity Email Dispatcher
              </h3>
              <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
                Jaise hi koi user 24 ghante tak login nahi karta, system automatically background me bina kisi manual button click ke reminder email bhej deta hai. Saare dispatched emails real-time me niche System Reminders audit log me user aur business name ke sath record hote hain.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-emerald-200/80 font-semibold">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-emerald-300" />
                  <span>Heartbeat: Every 60s auto-scan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-emerald-300" />
                  <span>
                    Last checked: {lastAutoSyncTime ? formatDistanceToNow(lastAutoSyncTime, { addSuffix: true }) : 'Just initialized'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className="text-amber-300" />
                  <span>Cooldown: 1 email per user every 3 days</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <button
                onClick={handleToggleAutoSync}
                className={cn(
                  "px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center justify-center gap-2 shadow-sm",
                  autoSyncEnabled
                    ? "bg-white text-[#0B4D46] hover:bg-emerald-50 border-white/80"
                    : "bg-emerald-400 hover:bg-emerald-300 text-slate-900 border-emerald-300 font-extrabold"
                )}
              >
                {autoSyncEnabled ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span>Auto-Sync is ON (Click to Pause)</span>
                  </>
                ) : (
                  <>
                    <Zap size={13} className="fill-current" />
                    <span>Enable Auto-Sync</span>
                  </>
                )}
              </button>

              <button
                onClick={performAutoSync}
                disabled={isAutoSyncingRef.current || inactiveUsersForReminder.length === 0}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white border border-white/20 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 backdrop-blur-sm"
              >
                <RefreshCw size={12} className={isAutoSyncingRef.current ? "animate-spin" : ""} />
                <span>Sync Pending Now ({inactiveUsersForReminder.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* ELIGIBLE INACTIVITY REMINDERS QUEUE */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-200/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>Due Inactivity Reminders Queue</span>
                  <span className="text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                    {inactiveUsersForReminder.length} Eligible
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Users inactive for &gt; 24 hours queued for automated dispatch (or dispatch instantly with 1-click)
                </p>
              </div>
            </div>

            {inactiveUsersForReminder.length > 0 && (
              <button
                onClick={handleTriggerInactivityCheck}
                disabled={checkingInactivity}
                className="px-4 py-2 bg-[#166534] hover:bg-[#0D635C] disabled:opacity-50 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 shadow-sm"
              >
                {checkingInactivity ? (
                  <>
                    <RefreshCw className="animate-spin" size={11} />
                    <span>Sending to All...</span>
                  </>
                ) : (
                  <>
                    <Send size={11} />
                    <span>Send to All {inactiveUsersForReminder.length} Users</span>
                  </>
                )}
              </button>
            )}
          </div>

          {inactiveUsersForReminder.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle size={20} />
              </div>
              <span>All registered users are active or have recently received their scheduled reminders!</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {inactiveUsersForReminder.slice(0, 6).map((user: any) => (
                <div key={user.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-slate-300 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 truncate" title={user.name}>{user.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold truncate" title={user.email || user.business_email}>
                          {user.email || user.business_email}
                        </p>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                        {user.daysInactive}d Inactive
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      <span className="truncate max-w-[130px] font-bold text-slate-700">{user.business}</span>
                      <span>{user.invoiceCount} Invoices</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendIndividualReminder(user)}
                    disabled={sendingReminderUserId === user.id}
                    className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {sendingReminderUserId === user.id ? (
                      <>
                        <RefreshCw size={11} className="animate-spin text-emerald-700" />
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <Send size={11} className="text-emerald-700" />
                        <span>Send Reminder Now</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* INTERACTIVE ACTIONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Action 1: Manual Inactivity Checker Scan */}
          <div className="bg-slate-50/60 rounded-3xl p-5 border border-slate-100 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#166534] bg-green-50 px-2.5 py-1 rounded-full border border-green-150 inline-block">Automation Controls</span>
              <h3 className="text-sm font-black text-slate-800 leading-snug">Trigger Manual User Inactivity Scan</h3>
              <p className="text-[11px] text-slate-500 font-medium leading-normal">
                Manually run the 24-hour inactivity scanning cycle. The server will scan all registered user documents, respect opt-outs, and send reminder emails to users who became eligible in the last cycle.
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <div className="flex flex-col gap-2.5 bg-slate-100/60 p-3.5 rounded-2xl border border-slate-200/50">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="forceScanCheckbox"
                    checked={forceScan}
                    onChange={(e) => setForceScan(e.target.checked)}
                    className="w-4 h-4 text-[#166534] border-slate-300 rounded focus:ring-[#166534] accent-[#166534] cursor-pointer animate-none"
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Force scan (Bypass constraints)</span>
                    <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Bypasses the 24h inactive check & 'sent' status safeguard</span>
                  </div>
                </label>

                <div className="h-px bg-slate-200/60" />

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="resetStatusesCheckbox"
                    checked={resetStatuses}
                    onChange={(e) => setResetStatuses(e.target.checked)}
                    className="w-4 h-4 text-[#B91C1C] border-slate-300 rounded focus:ring-[#B91C1C] accent-[#B91C1C] cursor-pointer animate-none"
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider">Reset reminder cycles</span>
                    <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Resets all user statuses to eligible for inactivity check</span>
                  </div>
                </label>
              </div>

              <button
                id="manualScanButton"
                onClick={handleTriggerInactivityCheck}
                disabled={checkingInactivity}
                className="w-full md:w-auto px-5 py-3 bg-[#166534] hover:bg-[#0D635C] disabled:bg-green-800/40 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border-none flex items-center justify-center gap-2 shadow-md shadow-green-700/10"
              >
                {checkingInactivity ? (
                  <>
                    <RefreshCw className="animate-spin" size={12} />
                    <span>Scanning Users...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    <span>Scan & Dispatch Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action 2: Send Premium Template Test */}
          <div className="bg-slate-50/60 rounded-3xl p-5 border border-slate-100 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-150 inline-block">Template Sandbox</span>
              <h3 className="text-sm font-black text-slate-800 leading-snug">Send Test Reminder Email</h3>
              <p className="text-[11px] text-slate-500 font-medium leading-normal">
                Enter an email address below to immediately dispatch a preview of the dark-themed, mobile-responsive InvoCentric Inactivity Reminder HTML email template.
              </p>
            </div>
            
            <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                placeholder="developer@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:border-[#166534]"
              />
              <button
                onClick={handleSendTestReminder}
                disabled={sendingTest}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/40 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-green-600/10"
              >
                {sendingTest ? (
                  <>
                    <RefreshCw className="animate-spin" size={12} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Test HTML</span>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* LOG SEARCH & TABLE SECTION */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">Dispatched Receipts & Reminders</span>
              <p className="text-[10px] text-slate-400 font-bold">Manage system-generated automated client communications with real-time delivery logs</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search user, business, email..."
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#166534]"
                />
              </div>

              {/* Delete All / Category Bulk Clear */}
              <button
                onClick={() => handleDeleteAllEmailLogs(emailSubTab)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all border border-rose-100 cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Trash2 size={12} />
                <span>Remove All {emailSubTab === 'reminders' ? 'Reminders' : 'Receipts'}</span>
              </button>
            </div>
          </div>

          {/* Separation Tabs (Reminders vs. Receipts) */}
          <div className="flex border-b border-slate-100 pb-0.5 gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setEmailSubTab('reminders')}
              className={cn(
                "px-4 py-2.5 text-xs font-black uppercase tracking-wider border-none bg-transparent cursor-pointer transition-all pb-2.5 border-b-2 relative",
                emailSubTab === 'reminders' 
                  ? "text-[#166534] border-[#166534]" 
                  : "text-slate-400 hover:text-slate-600 border-transparent"
              )}
            >
              System Reminders ({
                emailLogs.filter(log => log.email_type === 'Reminder' || log.email_type === 'Test Reminder').length
              })
            </button>
            <button
              onClick={() => setEmailSubTab('receipts')}
              className={cn(
                "px-4 py-2.5 text-xs font-black uppercase tracking-wider border-none bg-transparent cursor-pointer transition-all pb-2.5 border-b-2 relative",
                emailSubTab === 'receipts' 
                  ? "text-[#166534] border-[#166534]" 
                  : "text-slate-400 hover:text-slate-600 border-transparent"
              )}
            >
              Subscription Receipts ({
                emailLogs.filter(log => log.email_type !== 'Reminder' && log.email_type !== 'Test Reminder').length
              })
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="py-3 px-4 font-black">User & Business</th>
                  <th className="py-3 px-4 font-black">Delivery Mode</th>
                  <th className="py-3 px-4 font-black">Type</th>
                  <th className="py-3 px-4 font-black">Subject</th>
                  <th className="py-3 px-4 font-black">Delivery Status</th>
                  <th className="py-3 px-4 text-right font-black">Timestamp</th>
                  <th className="py-3 px-4 text-right font-black">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmailLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    
                    {/* User & Business */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">
                            {log.recipient_name || 'Registered User'}
                          </span>
                          {log.business_name && (
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 max-w-[120px] truncate" title={log.business_name}>
                              {log.business_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <span className="truncate max-w-[170px]">{log.recipient_email}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.recipient_email || "");
                              triggerToast("Email Copied!");
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer rounded"
                            title="Copy Email"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Delivery Mode */}
                    <td className="py-3.5 px-4">
                      {log.delivery_mode === 'Automatic' || log.delivery_mode === 'Cron' ? (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <Zap size={10} className="fill-emerald-600 text-emerald-600" />
                          <span>Auto-Synced</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                          <span>👤 Manual</span>
                        </span>
                      )}
                    </td>

                    {/* Email Type */}
                    <td className="py-3.5 px-4">
                      {log.email_type === 'Reminder' ? (
                        <span className="text-[9.5px] font-black uppercase tracking-wider bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full border border-green-150">
                          Reminder
                        </span>
                      ) : log.email_type === 'Test Reminder' ? (
                        <span className="text-[9.5px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-150">
                          Test Template
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-black uppercase tracking-wider bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full border border-green-150">
                          Receipt / Pro
                        </span>
                      )}
                    </td>

                    {/* Subject */}
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-600 max-w-xs truncate" title={log.subject}>
                      {log.subject}
                    </td>

                    {/* Delivery Status */}
                    <td className="py-3.5 px-4">
                      {log.status === 'Sent' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <CheckCircle size={12} />
                          <span>Delivered</span>
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                            <AlertCircle size={12} />
                            <span>Failed</span>
                          </span>
                          {log.error && (
                            <span className="text-[9.5px] text-slate-400 font-medium max-w-xs truncate" title={log.error}>
                              {log.error}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-xs font-bold text-slate-400 font-sans" title={log.timestamp}>
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            const matchedUser = dbUsers.find((u: any) => 
                              (u.email || '').toLowerCase() === (log.recipient_email || '').toLowerCase() ||
                              (u.business_email || '').toLowerCase() === (log.recipient_email || '').toLowerCase()
                            );
                            handleSendIndividualReminder(matchedUser || {
                              id: log.user_id || 'manual-resend',
                              email: log.recipient_email,
                              name: log.recipient_name,
                              business: log.business_name
                            });
                          }}
                          disabled={sendingReminderUserId === (log.user_id || log.recipient_email)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer disabled:opacity-50 inline-flex items-center justify-center"
                          title="Resend Reminder to this User"
                        >
                          <Send size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteEmailLog(log.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer inline-flex items-center justify-center"
                          title="Delete log entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}

                {filteredEmailLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 italic text-xs">
                      No matching email dispatch logs resolved.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      )}

      {/* MODAL 2: VIEW ALL CHRONOLOGICAL OPERATIONS LOG */}
      {showAllActivitiesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-2 pt-6 pb-6 overflow-y-auto xs:items-center sm:p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn my-auto">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={18} className="text-[#00B074]" />
                  Chronological System Audit Stream
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Full operational log stream</p>
              </div>
              <button 
                onClick={() => setShowAllActivitiesModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {dbActivities.map((act) => {
                const styleMap = {
                  signup: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: UserPlus },
                  business: { bg: 'bg-green-100', text: 'text-green-800', icon: Building2 },
                  invoice: { bg: 'bg-emerald-50 border border-emerald-200/60', text: 'text-emerald-700', icon: FileText },
                  payment: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle },
                  delete: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Trash2 }
                };
                const config = styleMap[act.type] || styleMap.signup;
                const IconComp = config.icon;

                return (
                  <div key={act.id} className="flex gap-3 text-left pb-3 border-b border-slate-50/80 last:border-none">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-inner", config.bg, config.text)}>
                      <IconComp size={15} />
                    </div>
                    <div className="min-w-0 flex-1 flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 leading-snug">{act.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">{act.description}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">
                          {format(parseDateSafe(act.rawTime), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap pt-0.5">{act.time}</span>
                    </div>
                  </div>
                );
              })}

              {dbActivities.length === 0 && (
                <div className="text-center py-16 text-slate-400 italic text-xs">
                  No registered operational logs currently logged.
                </div>
              )}
            </div>

            {/* Close footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                onClick={() => setShowAllActivitiesModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border-none shadow-md"
              >
                Close Logs
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SMTP Email Server Configuration Modal */}
      {isSmtpModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm select-none">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200/90 shadow-2xl overflow-hidden text-slate-800 animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#0d5c4b] to-[#116e5a] px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <Server size={20} className="text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">SMTP Email Server Settings</h3>
                  <p className="text-xs text-emerald-100/80 font-medium">
                    Configure real Gmail / SMTP credentials for reminders & receipts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSmtpModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Status Alert */}
              <div className={cn(
                "p-3 rounded-2xl border flex items-center gap-2.5",
                smtpStatus.configured ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
              )}>
                <CheckCircle2 size={16} className={smtpStatus.configured ? "text-emerald-600 shrink-0" : "text-amber-600 shrink-0"} />
                <div className="leading-snug">
                  <span className="font-bold block">
                    {smtpStatus.configured ? "SMTP Server is Active" : "SMTP Credentials Not Configured"}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {smtpStatus.configured 
                      ? `Using ${smtpStatus.email} on ${smtpStatus.host}`
                      : "Emails will fail or remain unsent until a valid SMTP username & password are provided."}
                  </span>
                </div>
              </div>

              {smtpFeedback && (
                <div className={cn(
                  "p-3 rounded-2xl border flex items-start gap-2.5 text-xs font-semibold",
                  smtpFeedback.type === 'success' 
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900" 
                    : "bg-rose-50 border-rose-300 text-rose-900"
                )}>
                  {smtpFeedback.type === 'success' ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />}
                  <span>{smtpFeedback.message}</span>
                </div>
              )}

              {/* Host & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Port</label>
                  <input
                    type="text"
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                    placeholder="587"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Username / Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Sender Email ID / Username</label>
                <div className="relative">
                  <input
                    type="email"
                    value={smtpForm.user}
                    onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    placeholder="e.g. yourbusiness@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* App Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-500">App Password / SMTP Password</label>
                  <span className="text-[10px] text-emerald-800 font-bold">16-char Gmail App Password</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={smtpForm.pass}
                    onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Sender Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">From Name</label>
                <input
                  type="text"
                  value={smtpForm.fromName}
                  onChange={(e) => setSmtpForm({ ...smtpForm, fromName: e.target.value })}
                  placeholder="InvoCentric Official"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Test Recipient Email */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black uppercase text-slate-500">Send Test Email To (Verification)</label>
                <input
                  type="email"
                  value={smtpForm.testRecipient}
                  onChange={(e) => setSmtpForm({ ...smtpForm, testRecipient: e.target.value })}
                  placeholder="your-personal@gmail.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Gmail Help Guide */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed space-y-1">
                <span className="font-bold text-slate-800 block">💡 Gmail Quick Setup Guide:</span>
                <span>1. Open your Google Account &gt; Security &gt; Enable <strong>2-Step Verification</strong>.</span><br />
                <span>2. Search for <strong>"App passwords"</strong> in your Google Account.</span><br />
                <span>3. Create an app password named "InvoCentric" and paste the 16-character code above.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={testingSmtp || !smtpForm.user || !smtpForm.pass}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={testingSmtp ? "animate-spin" : ""} />
                <span>{testingSmtp ? "Testing Connection..." : "Test Connection"}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSmtpModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSmtp}
                  disabled={savingSmtp || !smtpForm.user || !smtpForm.pass}
                  className="px-5 py-2 bg-[#0d5c4b] hover:bg-[#09473a] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {savingSmtp ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Local Lucide icon helper
function CheckSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
