import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Save, X, LogOut, CheckCircle2, Download, Upload, Trash2, HardDrive, FolderOpen, Lock, Unlock, CloudDownload } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { dbService } from '../services/dbService';
import { getFileHandleFromIndexedDB, writeAllDataToPcFile, downloadBackupFile, applyDataToLocalCache } from '../utils/fileSystemDb';

export default function SettingsPage() {
  const { 
    user, 
    logout, 
    isOfflineMode: isOfflineModeReal, 
    setOfflineMode, 
    planTier,
    isPcDriveEnabled,
    isPcFileConnected,
    pcFileName,
    enablePcDriveMode,
    disablePcDriveMode,
    unlockPcDriveFile
  } = useAuth();
  const isOfflineMode = false; // Always keep UI input fields enabled and active
  const isCloudDataImported = user ? getSecureStorage(`cloud_data_imported_${user.uid}`, false) : false;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [fetchingReceipts, setFetchingReceipts] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || isOfflineModeReal) return;
    const fetchReceipts = async () => {
      setFetchingReceipts(true);
      try {
        const q = query(
          collection(db, 'subscription_receipts'),
          where('user_id', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const docsList = querySnapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        // Sort manually by created_at descending
        docsList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setReceipts(docsList);
      } catch (err) {
        console.error("Error fetching subscription receipts:", err);
      } finally {
        setFetchingReceipts(false);
      }
    };
    fetchReceipts();
  }, [user, isOfflineModeReal]);

  const downloadReceipt = async (receiptId: string, receiptNumber: string) => {
    setDownloadingReceiptId(receiptId);
    try {
      const headers: Record<string, string> = {};
      if (user) {
        const token = await user.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/subscription/receipt-download/${receiptId}`, {
        headers
      });
      if (!response.ok) throw new Error("Receipt download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${receiptNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download receipt.");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const isLoadedRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  const getInitialFormData = () => {
    const defaultData = {
      business_name: '',
      owner_name: '',
      currency: 'INR',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      upi_id: '',
      bank_name: '',
      bank_branch: '',
      account_number: '',
      ifsc_code: '',
      account_holder: '',
      invoice_prefix: 'INV',
      logo_url: '',
      backup_enabled: false,
      email_reminders_enabled: true,
      instagram: '',
      facebook: '',
      website: '',
      social_qr_url: '',
      social_qr_label: '@business_handle',
      invoice_template: 'template_01',
      signature_url: '',
      letterhead_enabled: false,
      letterhead_url: '',
      letterhead_top_margin: 45,
      letterhead_bottom_margin: 20,
      letterhead_hide_header: true
    };
    if (typeof window !== 'undefined' && user?.uid) {
      try {
        const cached = getSecureStorage(`user_profile_${user.uid}`, null) || 
          (localStorage.getItem(`user_profile_${user.uid}`) ? JSON.parse(localStorage.getItem(`user_profile_${user.uid}`)!) : null);
        if (cached && typeof cached === 'object') {
          return { ...defaultData, ...cached };
        }
      } catch (e) {}
    }
    return defaultData;
  };

  const [formData, setFormData] = useState(getInitialFormData);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Base64 storage
        alert("Logo size should be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Base64 storage
        alert("QR Image size should be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, social_qr_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Base64 storage
        alert("Signature image size should be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, signature_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Letterhead image should be under 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ 
          ...prev, 
          letterhead_url: reader.result as string,
          letterhead_enabled: true 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLetterhead = () => {
    setFormData(prev => ({ 
      ...prev, 
      letterhead_url: '', 
      letterhead_enabled: false 
    }));
  };

  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    if (!user) return;
    downloadBackupFile(user.uid, `invocentric_backup_db_${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        applyDataToLocalCache(user.uid, data);
        alert("Offline data restored successfully! (डेटा सफलतापूर्वक रिस्टोर हो गया)");
        window.location.reload();
      } catch (err) {
        alert("Invalid backup file format.");
      }
    };
    reader.readAsText(file);
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
    }
  };

  const [importingCloudData, setImportingCloudData] = useState(false);

  const handleImportCloudData = async () => {
    if (!user) return;
    if (!navigator.onLine) {
      alert("इसके लिए इंटरनेट कनेक्शन (Internet Connection) आवश्यक है! कृपया ऑनलाइन जाएँ।");
      return;
    }

    const confirmImport = window.confirm("क्या आप Firebase क्लाउड (Cloud) से अपना सारा पुराना डेटा डाउनलोड करके पीसी (Local PC) और ब्राउज़र में मर्ज करना चाहते हैं?");
    if (!confirmImport) return;

    setImportingCloudData(true);
    try {
      // 1. Fetch User Profile
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const profileData = userDocSnap.data();
        setFormData(prev => ({ ...prev, ...profileData }));
        setSecureStorage(`user_profile_${user.uid}`, profileData);
      }

      // 2. Fetch other collections
      const collectionsToSync = ['invoices', 'customers', 'items', 'expenses', 'purchases', 'payments'];
      let importedCount = 0;

      for (const colName of collectionsToSync) {
        const q = query(collection(db, colName), where('user_id', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const fetchedDocs = querySnapshot.docs.map(doc => {
          const d = doc.data();
          if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
          if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
          if (d.due_date?.toDate) d.due_date = d.due_date.toDate().toISOString();
          if (d.date?.toDate) d.date = d.date.toDate().toISOString();
          return { id: doc.id, ...d };
        });

        if (fetchedDocs.length > 0) {
          const localKey = `offline_${colName}_${user.uid}`;
          const existingLocal = getSecureStorage(localKey, []);
          
          // Map to unique docs
          const merged = [...existingLocal];
          fetchedDocs.forEach((newDoc: any) => {
            const idx = merged.findIndex(item => item.id === newDoc.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...newDoc };
            } else {
              merged.push(newDoc);
            }
          });

          setSecureStorage(localKey, merged);
          importedCount += fetchedDocs.length;
        }
      }

      // 3. If PC Hard Drive Mode is active, write to the physical file instantly
      if (isPcDriveEnabled) {
        try {
          const handle = await getFileHandleFromIndexedDB(user.uid);
          if (handle) {
            await writeAllDataToPcFile(user.uid, handle);
            console.log("Instantly updated PC Hard Drive file with merged Firebase data");
          }
        } catch (fileErr) {
          console.error("Failed to automatically update local PC file:", fileErr);
        }
      }

      setSecureStorage(`cloud_data_imported_${user.uid}`, true);

      alert(`बधाई हो! क्लाउड से कुल ${importedCount} डेटा सफलतापूर्वक डाउनलोड करके आपके PC/Browser Storage में मर्ज कर दिया गया है।`);
      window.location.reload();
    } catch (err: any) {
      console.error("Cloud data migration failed:", err);
      alert("डेटा डाउनलोड करने में त्रुटि आई: " + err.message);
    } finally {
      setImportingCloudData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmPhrase = prompt("To permanently delete your account and ALL associated local and cloud data, type 'DELETE':");
    if (confirmPhrase !== 'DELETE') {
      alert("Account deletion canceled.");
      return;
    }

    setSaving(true);
    try {
      const userId = user.uid;

      // 1. Delete user profile document from Firestore to comply with GDPR/CCPA
      if (navigator.onLine) {
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);
        console.log("Firestore profile doc deleted");
      }

      // 2. Clear all local storage records for user
      const keysToErase = [
        `offline_invoices_${userId}`,
        `offline_customers_${userId}`,
        `offline_items_${userId}`,
        `offline_expenses_${userId}`,
        `offline_purchases_${userId}`,
        `offline_payments_${userId}`,
        `user_profile_${userId}`,
        `offline_deletions_${userId}`,
        `offline_upserts_${userId}`,
        'last_plan_check_date',
        'app_mode'
      ];

      keysToErase.forEach(key => localStorage.removeItem(key));
      console.log("Erased all local cache keys");

      alert("Your account and all associated data have been permanently deleted.");
      await logout();
      window.location.href = '/';
    } catch (err: any) {
      console.error("Error during account deletion:", err);
      alert("Failed to delete account. Please check your internet connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Immediately read local cache (both secureStorage and localStorage) to avoid blank-screen wipes
        const cached = getSecureStorage(`user_profile_${user.uid}`, null) || 
          (localStorage.getItem(`user_profile_${user.uid}`) ? JSON.parse(localStorage.getItem(`user_profile_${user.uid}`)!) : null);
        
        if (cached && typeof cached === 'object') {
          setFormData(prev => ({
            ...prev,
            ...cached,
            upi_id: cached.upi_id || prev.upi_id || '',
            bank_name: cached.bank_name || prev.bank_name || '',
            account_number: cached.account_number || prev.account_number || '',
            ifsc_code: cached.ifsc_code || prev.ifsc_code || '',
            invoice_template: cached.invoice_template || prev.invoice_template || 'template_01'
          }));
        }

        if (isOfflineModeReal) {
          setTimeout(() => {
            isLoadedRef.current = true;
          }, 300);
          setLoading(false);
          return;
        }

        // 2. Fetch from Firestore and intelligently merge with cached data
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const merged: any = {
            business_name: data.business_name || cached?.business_name || '',
            owner_name: data.owner_name || data.display_name || cached?.owner_name || cached?.display_name || '',
            currency: data.currency || cached?.currency || 'INR',
            phone: data.phone || cached?.phone || '',
            email: data.email || cached?.email || '',
            address: data.address || cached?.address || '',
            city: data.city || cached?.city || '',
            state: data.state || cached?.state || '',
            pincode: data.pincode || cached?.pincode || '',
            gstin: data.gstin || cached?.gstin || '',
            upi_id: data.upi_id || cached?.upi_id || '',
            bank_name: data.bank_name || cached?.bank_name || '',
            bank_branch: data.bank_branch || cached?.bank_branch || '',
            account_number: data.account_number || cached?.account_number || '',
            ifsc_code: data.ifsc_code || cached?.ifsc_code || '',
            account_holder: data.account_holder || cached?.account_holder || '',
            invoice_prefix: data.invoice_prefix || cached?.invoice_prefix || 'INV',
            logo_url: data.logo_url || cached?.logo_url || '',
            backup_enabled: data.backup_enabled ?? cached?.backup_enabled ?? false,
            email_reminders_enabled: data.email_reminders_enabled ?? cached?.email_reminders_enabled ?? true,
            instagram: data.instagram || cached?.instagram || '',
            facebook: data.facebook || cached?.facebook || '',
            website: data.website || cached?.website || '',
            social_qr_url: data.social_qr_url || cached?.social_qr_url || '',
            social_qr_label: data.social_qr_label || cached?.social_qr_label || '@business_handle',
            invoice_template: data.invoice_template || cached?.invoice_template || 'template_01',
            signature_url: data.signature_url || cached?.signature_url || ''
          };
          setFormData(merged);
          setSecureStorage(`user_profile_${user.uid}`, merged);
          localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(merged));

          // If local cache had upi_id but Firestore was missing it, sync to Firestore now
          if (!data.upi_id && merged.upi_id) {
            setDoc(docRef, { upi_id: merged.upi_id }, { merge: true }).catch(console.warn);
          }
        }
        // Wait a brief moment to ensure React state has flushed before turning on auto-save
        setTimeout(() => {
          isLoadedRef.current = true;
        }, 300);
      } catch (error) {
        console.error("Error fetching settings:", error);
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [user, isOfflineModeReal]);

  // Robust persistence across local secureStorage, localStorage, IndexedDB, and Firestore
  const persistSettings = async (dataToSave: typeof formData) => {
    if (!user) return;
    
    // 1. Local secure storage & localStorage
    setSecureStorage(`user_profile_${user.uid}`, dataToSave);
    localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(dataToSave));

    // 2. Offline users collection mirror
    const cachedUsers = getSecureStorage(`offline_users_${user.uid}`, []);
    const updatedUsers = Array.isArray(cachedUsers) && cachedUsers.length > 0
      ? cachedUsers.map((u: any) => u.id === user.uid ? { ...u, ...dataToSave } : u)
      : [{ id: user.uid, ...dataToSave }];
    setSecureStorage(`offline_users_${user.uid}`, updatedUsers);

    // 3. dbService (IndexedDB) in both online and offline modes
    try {
      await dbService.update('users', user.uid, dataToSave, { offlineMode: isOfflineModeReal, userId: user.uid });
    } catch (err) {
      console.warn("dbService users update handled:", err);
    }

    // 4. Firestore (if online)
    if (!isOfflineModeReal && navigator.onLine) {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      const updateData: any = {
        ...dataToSave,
        updated_at: serverTimestamp(),
      };
      
      if (!userDocSnap.exists() || !userDocSnap.data()?.created_at) {
        updateData.created_at = serverTimestamp();
      }
      if (!userDocSnap.exists() || !userDocSnap.data()?.email) {
        updateData.email = user.email || null;
      }
      if (!userDocSnap.exists() || !userDocSnap.data()?.id) {
        updateData.id = user.uid;
      }
      
      await setDoc(userDocRef, updateData, { merge: true });
    }
  };

  // Debounced Auto-Save
  useEffect(() => {
    if (!isLoadedRef.current || !user) return;

    // Validate that we have a business name before auto-saving (only in online mode)
    if (!isOfflineMode && (!formData.business_name || formData.business_name.trim() === '')) {
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await persistSettings(formData);
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 3000);
      } catch (error) {
        console.error("Error auto-saving settings:", error);
        setSaveStatus('error');
      }
    }, 1500); // 1.5 seconds debounce to give user a comfortable typing window

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData, user, isOfflineModeReal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaving(true);
    setSaveStatus('saving');
    try {
      await persistSettings(formData);
      setSaveStatus('saved');
      alert("Settings saved successfully! (सेटिंग्स सुरक्षित रूप से सहेज ली गई हैं)");
      setTimeout(() => {
        setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
      }, 3000);
    } catch (error) {
      console.error("Error updating settings:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setSaveStatus('error');
      alert("Error saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <header className="flex flex-col items-center text-center mb-10">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-xl shadow-gray-200/50 overflow-hidden border border-gray-100">
           <Logo size={80} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Business Settings</h1>
        <p className="text-gray-500 mt-2 font-medium">Update your shop's details — they appear on every invoice and quote.</p>
        
        {/* Autosave Status Indicator */}
        <div className="mt-4 min-h-[32px] flex items-center justify-center">
          {saveStatus === 'saving' && (
            <div className="px-4 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold flex items-center gap-2 animate-pulse">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
              Saving changes automatically...
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="px-4 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              All changes saved automatically
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="px-4 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Error saving changes automatically
            </div>
          )}
          {saveStatus === 'idle' && isLoadedRef.current && (
            <div className="px-4 py-1.5 text-gray-500 text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-gray-500" />
              Auto-save active
            </div>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Plan & Billing Card */}
        <section className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              Account Plan & Billing
            </h2>
            <p className="text-xs text-slate-500 font-medium">Manage your subscription, unlock features, and check account tier limits.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border",
              planTier === 'pro' 
                ? "bg-[#F0FDF4] text-[#166534] border-green-100" 
                : "bg-slate-50 text-slate-500 border-slate-200"
            )}>
              {planTier === 'pro' ? 'Pro Account' : 'Free Tier'}
            </span>
            <Link 
              to="/pricing"
              className="bg-[#166534] hover:bg-[#0F3D21] text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-md shadow-green-700/10 active:scale-[0.98]"
            >
              {planTier === 'pro' ? 'View Pricing Plans' : 'Upgrade to Pro'}
            </Link>
          </div>
        </section>

        {/* Business Profile */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Business Profile</h2>
            <div className="flex items-center gap-4">
              {formData.logo_url && (
                <div className="relative group">
                  <img src={formData.logo_url} alt="Logo Preview" className="w-16 h-16 object-contain rounded-lg border border-gray-100 p-1" />
                  {!isOfflineMode && (
                    <button 
                      type="button" 
                      onClick={() => setFormData(p => ({ ...p, logo_url: '' }))}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 transition-opacity border border-white shadow-sm hover:bg-red-200"
                      title="Remove Logo"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
              {!isOfflineMode && (
                <label className="cursor-pointer bg-gray-50 border border-gray-200 hover:bg-gray-100 px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 transition-all flex items-center gap-2">
                  <Save size={14} className="rotate-45" />
                  {formData.logo_url ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Business Name *</label>
              <input 
                type="text" 
                required
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-450 disabled:cursor-not-allowed" 
                value={formData.business_name}
                onChange={(e) => setFormData(p => ({ ...p, business_name: e.target.value }))}
                placeholder="E.g. Sharma Electronics & Mobile Hub"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Owner Name</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-450 disabled:cursor-not-allowed" 
                value={formData.owner_name}
                onChange={(e) => setFormData(p => ({ ...p, owner_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Currency</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-450 disabled:cursor-not-allowed" 
                value={formData.currency}
                onChange={(e) => setFormData(p => ({ ...p, currency: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Contact info */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Phone</label>
              <input 
                type="tel" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Email</label>
              <input 
                type="email" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Address</label>
              <textarea 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow min-h-[100px] disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.address}
                onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                placeholder="Shop address..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">City</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.city}
                onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">State</label>
              <select 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed"
                value={formData.state}
                onChange={(e) => setFormData(p => ({ ...p, state: e.target.value }))}
              >
                <option value="">Select state</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Delhi">Delhi</option>
                <option value="Karnataka">Karnataka</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Pincode</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.pincode}
                onChange={(e) => setFormData(p => ({ ...p, pincode: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Tax info */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Tax & Numbering</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">GSTIN</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.gstin}
                onChange={(e) => setFormData(p => ({ ...p, gstin: e.target.value }))}
                placeholder="27AABC..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Invoice Prefix</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.invoice_prefix}
                onChange={(e) => setFormData(p => ({ ...p, invoice_prefix: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 bg-gradient-to-r from-green-50 to-blue-50/50 border border-green-100 rounded-xl p-5 mt-2">
              <label className="text-xs font-black text-green-950 mb-1 block uppercase tracking-wider">Invoice Design Template</label>
              <p className="text-xs text-green-700/80 mb-3 font-medium">Select the layout design for your printed and downloaded invoices.</p>
              <select 
                className="w-full bg-white border border-green-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow text-slate-800 font-semibold"
                value={formData.invoice_template || 'template_01'}
                onChange={(e) => setFormData(p => ({ ...p, invoice_template: e.target.value }))}
              >
                <option value="template_01">Template 01 — Blue Bordered + IGST Columns (A4)</option>
                <option value="template_02">Template 02 — Blue Line Top + IGST Columns (A4)</option>
                <option value="template_03">Template 03 — Supplier B2B (Dedicated Serial / Batch Column)</option>
                <option value="template_04">Template 04 — POS Receipt Thermal (3-Inch / 80mm Roll)</option>
                <option value="template_05">Template 05 — POS Receipt Thermal (2-Inch / 58mm Roll)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Payment details */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Payment Details (for Invoices)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">UPI ID</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.upi_id}
                onChange={(e) => setFormData(p => ({ ...p, upi_id: e.target.value }))}
                placeholder="yours@upi"
              />
              <p className="text-[10px] text-gray-500 mt-1">This will be used to generate a UPI QR code on the invoice.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Bank Name</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.bank_name}
                onChange={(e) => setFormData(p => ({ ...p, bank_name: e.target.value }))}
                placeholder="E.g. State Bank of India"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Bank Branch</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.bank_branch}
                onChange={(e) => setFormData(p => ({ ...p, bank_branch: e.target.value }))}
                placeholder="E.g. Main Branch, MG Road"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Account Holder Name</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.account_holder}
                onChange={(e) => setFormData(p => ({ ...p, account_holder: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Account Number</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.account_number}
                onChange={(e) => setFormData(p => ({ ...p, account_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">IFSC Code</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.ifsc_code}
                onChange={(e) => setFormData(p => ({ ...p, ifsc_code: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Social Media Details */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Social Media</h2>
            <div className="flex items-center gap-4">
              {formData.social_qr_url && (
                <div className="relative group">
                  <img src={formData.social_qr_url} alt="QR Preview" className="w-16 h-16 object-contain rounded-lg border border-gray-100 p-1 bg-white" />
                  {!isOfflineMode && (
                    <button 
                      type="button" 
                      onClick={() => setFormData(p => ({ ...p, social_qr_url: '' }))}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 transition-opacity border border-white shadow-sm hover:bg-red-200"
                      title="Remove QR"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
              {!isOfflineMode && (
                <label className="cursor-pointer bg-gray-50 border border-gray-200 hover:bg-gray-100 px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 transition-all flex items-center gap-2">
                  <Save size={14} className="rotate-45" />
                  {formData.social_qr_url ? 'Change Profile QR Code' : 'Upload Profile/Social QR'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                </label>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
               <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">QR Code Label / Handle</label>
               <input 
                 type="text" 
                 disabled={isOfflineMode}
                 className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                 value={formData.social_qr_label}
                 onChange={(e) => setFormData(p => ({ ...p, social_qr_label: e.target.value }))}
                 placeholder="E.g. Scan to follow us on Instagram"
               />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Instagram Handle</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.instagram}
                onChange={(e) => setFormData(p => ({ ...p, instagram: e.target.value }))}
                placeholder="@yourhandle"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Facebook Handle / Page</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.facebook}
                onChange={(e) => setFormData(p => ({ ...p, facebook: e.target.value }))}
                placeholder="fb.com/yourpage"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Website / Other Link</label>
              <input 
                type="text" 
                disabled={isOfflineMode}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow disabled:bg-gray-50 disabled:text-gray-455 disabled:cursor-not-allowed" 
                value={formData.website}
                onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))}
                placeholder="www.yourwebsite.com"
              />
            </div>
          </div>
        </section>

        {/* Authorized Signature */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Authorized Signature</h2>
              <p className="text-xs text-gray-500">Upload your signature image (preferably a transparent PNG or white background). It will automatically show in all your invoices.</p>
            </div>
            <div className="flex items-center gap-4">
              {formData.signature_url && (
                <div className="relative group">
                  <img src={formData.signature_url} alt="Signature Preview" className="h-12 w-32 object-contain rounded-lg border border-gray-100 p-1 bg-white" />
                  {!isOfflineMode && (
                    <button 
                      type="button" 
                      onClick={() => setFormData(p => ({ ...p, signature_url: '' }))}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 transition-opacity border border-white shadow-sm hover:bg-red-200"
                      title="Remove Signature"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
              {!isOfflineMode && (
                <label className="cursor-pointer bg-gray-50 border border-gray-200 hover:bg-gray-100 px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 transition-all flex items-center gap-2 shrink-0">
                  <Save size={14} className="rotate-45" />
                  {formData.signature_url ? 'Change Signature' : 'Upload Signature'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                </label>
              )}
            </div>
          </div>
        </section>

        {/* Custom Letterhead & Page Alignment */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Custom Letterhead (Print &amp; PDF)</h2>
                <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {formData.letterhead_enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Upload your own company letterhead (Image: PNG, JPG, WEBP). The invoice will print directly on top of your letterhead background.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(formData.letterhead_enabled)}
                  onChange={(e) => setFormData(p => ({ ...p, letterhead_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <span className="text-xs font-bold text-gray-800">Enable Letterhead</span>
              </label>

              {formData.letterhead_url && (
                <button
                  type="button"
                  onClick={removeLetterhead}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
                  title="Remove Letterhead"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Letterhead Preview & Upload */}
            <div className="lg:col-span-4 flex flex-col items-center gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <div className="relative w-40 h-56 bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden flex flex-col items-center justify-center group">
                {formData.letterhead_url ? (
                  <>
                    <img
                      src={formData.letterhead_url}
                      alt="Letterhead Preview"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="cursor-pointer bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md hover:bg-slate-100">
                        Change Image
                        <input type="file" accept="image/*" className="hidden" onChange={handleLetterheadUpload} />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-3 text-slate-400">
                    <Upload size={24} className="mb-2 text-slate-300" />
                    <span className="text-[11px] font-bold">No Letterhead Uploaded</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">Upload your A4 sheet image</span>
                  </div>
                )}
              </div>

              <label className="cursor-pointer bg-white hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-2 shadow-xs">
                <Upload size={14} className="text-emerald-600" />
                <span>{formData.letterhead_url ? 'Change Letterhead' : 'Upload Letterhead'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLetterheadUpload} />
              </label>
              <span className="text-[10px] text-slate-400 text-center">Supports high-res PNG, JPG up to 5MB</span>
            </div>

            {/* Accessible Margin Sliders & Controls */}
            <div className="lg:col-span-8 space-y-5">
              {/* Vertical Position Slider (Upar-Niche karne ka accessible slider) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Header Offset / Top Margin (Upar se Jagah)
                  </label>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-extrabold tabular-nums">
                    {formData.letterhead_top_margin || 45} mm
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Adjust this slider to move the invoice content down so it does not overlap your printed letterhead header or logo.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] font-bold text-slate-400">0 mm</span>
                  <input
                    type="range"
                    min="0"
                    max="120"
                    step="1"
                    value={formData.letterhead_top_margin || 45}
                    onChange={(e) => setFormData(p => ({ ...p, letterhead_top_margin: Number(e.target.value) }))}
                    className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <span className="text-[10px] font-bold text-slate-400">120 mm</span>
                </div>
              </div>

              {/* Bottom Margin Slider */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Footer Offset / Bottom Margin (Niche se Jagah)
                  </label>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-extrabold tabular-nums">
                    {formData.letterhead_bottom_margin || 20} mm
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Adjust this slider to give clearance for pre-printed footers, terms, or bank accounts at the bottom.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] font-bold text-slate-400">0 mm</span>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="1"
                    value={formData.letterhead_bottom_margin || 20}
                    onChange={(e) => setFormData(p => ({ ...p, letterhead_bottom_margin: Number(e.target.value) }))}
                    className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <span className="text-[10px] font-bold text-slate-400">80 mm</span>
                </div>
              </div>

              {/* Hide Default Header Checkbox */}
              <div className="flex items-start gap-3 p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <input
                  type="checkbox"
                  id="hide_header_check"
                  checked={formData.letterhead_hide_header !== false}
                  onChange={(e) => setFormData(p => ({ ...p, letterhead_hide_header: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300"
                />
                <label htmlFor="hide_header_check" className="text-xs text-slate-700 cursor-pointer leading-relaxed">
                  <strong className="font-bold text-slate-900 block">Hide standard digital company header</strong>
                  Hides your business name and logo on the invoice so it doesn't double-print over your physical/uploaded letterhead.
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Storage & Connectivity */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <HardDrive className="text-gray-900" size={20} />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Storage & Database Options</h2>
          </div>
          
          <div className="space-y-6">
            {/* 1. PC Hard Drive Storage Mode (Premium Local-First Mode) */}
            <div className="p-6 bg-emerald-50/50 border border-emerald-100/80 rounded-[2rem] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-emerald-900 uppercase tracking-wider">PC Hard Drive Storage Mode</p>
                    <span className="bg-emerald-600 text-[8px] font-black text-white px-2 py-0.5 rounded uppercase tracking-widest">Safe & Zero Cost</span>
                  </div>
                  <p className="text-xs text-emerald-800/80 font-bold uppercase tracking-widest leading-relaxed">
                    Save and write all your data directly inside a physical JSON file on your computer's hard drive.
                  </p>
                </div>

                <div className="shrink-0">
                  {isPcDriveEnabled ? (
                    <button
                      type="button"
                      onClick={disablePcDriveMode}
                      className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-red-200/50 transition-colors"
                    >
                      Disconnect PC Storage
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={enablePcDriveMode}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-emerald-600/10 transition-all flex items-center gap-2"
                    >
                      <FolderOpen size={14} />
                      Set PC File
                    </button>
                  )}
                </div>
              </div>

              {isPcDriveEnabled && (
                <div className="p-4 bg-white border border-emerald-100 rounded-2xl space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <HardDrive size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Active Database File</p>
                        <p className="font-black text-gray-800 text-sm">{pcFileName || 'invocentric_db.json'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPcFileConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          Connected & Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 border border-amber-200">
                          <Lock size={12} />
                          Locked (Permission Required)
                        </span>
                      )}
                    </div>
                  </div>

                  {!isPcFileConnected && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                      <p className="text-[11px] text-amber-800 font-bold uppercase tracking-wider text-center sm:text-left leading-relaxed">
                        🔒 File handle needs re-authorization for this browser session. Unlock now to continue offline hard-drive sync.
                      </p>
                      <button
                        type="button"
                        onClick={unlockPcDriveFile}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                      >
                        <Unlock size={12} />
                        Unlock PC File
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 font-medium leading-relaxed uppercase">
                    💡 All your changes (invoices, payments, clients, products) are written in real-time to this local file. Since the file is on your PC, you never have to worry about browser cache clearance or data storage limits!
                  </div>
                </div>
              )}
            </div>

            {/* Manual Backup and Restore Fallbacks */}
            <div className="border-t border-gray-100 pt-6">
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Manual Offline Sync Fallbacks</p>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex-1 flex items-center justify-center gap-2 bg-neutral-900 text-white p-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/10"
                >
                  <Download size={16} />
                  Download Manual Backup
                </button>

                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept=".json"
                    ref={backupFileInputRef}
                    onChange={handleRestoreBackup}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Upload Backup File"
                  />
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 bg-white text-neutral-900 border-2 border-neutral-200 p-4 rounded-xl font-black uppercase tracking-widest text-xs hover:border-neutral-900 transition-colors"
                  >
                    <Upload size={16} />
                    Restore From PC JSON
                  </button>
                </div>
              </div>

              {/* Firebase Cloud Data Downloader */}
              {!isCloudDataImported && (
                <div className="bg-sky-50/50 border border-sky-100 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-2">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-sky-900 uppercase tracking-widest">Firebase Cloud Data Recovery</p>
                    <p className="text-[11px] text-sky-700 font-bold uppercase tracking-wide leading-relaxed">
                      क्लाउड पर बचा हुआ पुराना डेटा आपके PC/Browser Storage में डाउनलोड और मर्ज करने के लिए यहाँ क्लिक करें।
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={importingCloudData}
                    onClick={handleImportCloudData}
                    className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white font-black text-[10px] uppercase tracking-widest px-5 py-3 rounded-xl transition-all shadow-md shadow-sky-600/10 flex items-center gap-2 disabled:opacity-50"
                  >
                    <CloudDownload size={14} className={cn(importingCloudData && "animate-spin")} />
                    {importingCloudData ? "Downloading..." : "Import Cloud Data"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Automation & Backups */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Automation & Backups</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">Daily Auto-Backup</p>
                <p className="text-xs text-gray-500">Automatically send all invoice data to your email every 24 hours.</p>
              </div>
              <button
                type="button"
                disabled={isOfflineMode}
                onClick={() => setFormData(p => ({ ...p, backup_enabled: !p.backup_enabled }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative flex items-center px-1 disabled:opacity-50 disabled:cursor-not-allowed",
                  formData.backup_enabled ? "bg-[#14532D]" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow-sm transition-all transform",
                  formData.backup_enabled ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">Email Reminders</p>
                <p className="text-xs text-gray-500">Receive helpful activity reminders when you are inactive on the platform.</p>
              </div>
              <button
                type="button"
                disabled={isOfflineMode}
                onClick={() => setFormData(p => ({ ...p, email_reminders_enabled: !p.email_reminders_enabled }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative flex items-center px-1 disabled:opacity-50 disabled:cursor-not-allowed",
                  formData.email_reminders_enabled !== false ? "bg-[#14532D]" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow-sm transition-all transform",
                  formData.email_reminders_enabled !== false ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>
        </section>

        {/* Subscription Receipts History */}
        {!isOfflineMode && (
          <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Subscription Receipts</h2>
                <p className="text-xs text-gray-500 mt-1">Download your official payment receipts for active/past InvoCentric Pro subscriptions.</p>
              </div>
            </div>

            {fetchingReceipts ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#14532D]"></div>
              </div>
            ) : receipts.length > 0 ? (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-4 text-xs font-bold text-gray-600 uppercase">Receipt No</th>
                      <th className="p-4 text-xs font-bold text-gray-600 uppercase">Date</th>
                      <th className="p-4 text-xs font-bold text-gray-600 uppercase">Billing Cycle</th>
                      <th className="p-4 text-xs font-bold text-gray-600 uppercase">Amount</th>
                      <th className="p-4 text-xs font-bold text-gray-600 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {receipts.map((receipt) => (
                      <tr key={receipt.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-sm font-bold text-gray-900">{receipt.receipt_number}</td>
                        <td className="p-4 text-xs text-gray-500">
                          {new Date(receipt.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="p-4 text-xs text-gray-600 font-medium capitalize">{receipt.billing_cycle}</td>
                        <td className="p-4 text-sm font-extrabold text-[#14532D]">₹{receipt.amount}</td>
                        <td className="p-4 text-sm text-right">
                          <button
                            type="button"
                            disabled={downloadingReceiptId === receipt.id}
                            onClick={() => downloadReceipt(receipt.id, receipt.receipt_number)}
                            className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 hover:bg-[#14532D]/5 hover:border-[#14532D] hover:text-[#14532D] px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Download size={12} className={cn(downloadingReceiptId === receipt.id && "animate-bounce")} />
                            {downloadingReceiptId === receipt.id ? 'Downloading...' : 'Download'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50/50 border border-dashed border-gray-100 rounded-xl">
                <p className="text-xs text-gray-500 font-medium">No subscription receipts found on your account.</p>
              </div>
            )}
          </section>
        )}

        {/* Danger Zone */}
        <section className="bg-white border border-red-100 rounded-2xl p-8 shadow-sm">
          <h2 className="text-sm font-bold text-red-600 mb-6 uppercase tracking-wider">Danger Zone</h2>
          <div className="p-4 bg-red-50/30 rounded-xl border border-red-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-900">Delete Account & Permanent Data Wipe</p>
              <p className="text-xs text-gray-500">Permanently delete your profile and completely wipe all local cache, inventory, clients, invoices, and payment documents. This is irreversible.</p>
            </div>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-red-600/10 shrink-0"
            >
              <Trash2 size={14} />
              Delete Account
            </button>
          </div>
        </section>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
          <button 
            type="submit" 
            disabled={saving || saveStatus === 'saving'}
            className="bg-[#14532D] text-white flex items-center justify-center gap-2 px-12 py-4 rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 min-w-[200px] w-full md:w-auto"
          >
            <Save size={20} />
            {saveStatus === 'saving' || saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved Successfully!' : 'Save Settings'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="bg-red-50 text-red-600 flex items-center justify-center gap-2 px-12 py-4 rounded-xl font-bold hover:bg-red-100 transition-all active:scale-95 min-w-[200px] w-full md:w-auto"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </form>
    </div>
  );
}
