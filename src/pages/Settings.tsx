import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { getStoredUserProfile, saveStoredUserProfile, mergeProfileData, sanitizeFirestorePayload, DEFAULT_PROFILE_DATA } from '../utils/settingsStorage';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Save, X, LogOut, CheckCircle2, Download, Upload, Trash2, HardDrive, FolderOpen, Lock, Unlock, CloudDownload, Store, Briefcase, Keyboard, Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';
import { updateService, AppUpdateState } from '../services/updateService';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { StorageModeSelector } from '../components/StorageModeSelector';
import { dbService } from '../services/dbService';
import { 
  getFileHandleFromIndexedDB, 
  writeAllDataToPcFile, 
  downloadBackupFile, 
  applyDataToLocalCache,
  isDirectoryPickerSupported,
  saveDirectoryHandleToIndexedDB,
  getDirectoryHandleFromIndexedDB,
  removeDirectoryHandleFromIndexedDB,
  writeAllDataToPcDirectory
} from '../utils/fileSystemDb';
import { 
  isGoogleDriveConnected, 
  connectGoogleDrive, 
  disconnectGoogleDrive, 
  syncDataToGoogleDrive, 
  getGoogleDriveLastBackupTime 
} from '../utils/googleDriveSync';

export default function SettingsPage() {
  const { 
    user, 
    logout, 
    isOfflineMode: isOfflineModeReal, 
    setOfflineMode, 
    planTier,
    appMode,
    setAppMode,
    isPcDriveEnabled,
    isPcFileConnected,
    pcFileName,
    enablePcDriveMode,
    disablePcDriveMode,
    unlockPcDriveFile
  } = useAuth();
  const isOfflineMode = false; // Always keep UI input fields enabled and active
  const isCloudDataImported = user ? getSecureStorage(`cloud_data_imported_${user.uid}`, false) : false;

  // Google Drive & PC Directory Sync States
  const [gdriveConnected, setGdriveConnected] = useState<boolean>(() => isGoogleDriveConnected());
  const [gdriveSyncing, setGdriveSyncing] = useState<boolean>(false);
  const [gdriveLastBackup, setGdriveLastBackup] = useState<string | null>(() => getGoogleDriveLastBackupTime());

  const [pcDirConnected, setPcDirConnected] = useState<boolean>(false);
  const [pcDirName, setPcDirName] = useState<string>('');
  const [pcDirSyncing, setPcDirSyncing] = useState<boolean>(false);
  const [pcDirLastBackup, setPcDirLastBackup] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getDirectoryHandleFromIndexedDB(user.uid).then(handle => {
      if (handle) {
        setPcDirConnected(true);
        setPcDirName(handle.name);
      }
    });
    setPcDirLastBackup(localStorage.getItem(`pc_directory_last_backup_${user.uid}`));

    const handleGdriveStatus = () => {
      setGdriveConnected(isGoogleDriveConnected());
      setGdriveLastBackup(getGoogleDriveLastBackupTime());
    };
    window.addEventListener('gdrive_status_changed', handleGdriveStatus);
    window.addEventListener('gdrive_backup_success', handleGdriveStatus);
    return () => {
      window.removeEventListener('gdrive_status_changed', handleGdriveStatus);
      window.removeEventListener('gdrive_backup_success', handleGdriveStatus);
    };
  }, [user]);

  // Software & App Auto-Updater State
  const [updateState, setUpdateState] = useState<AppUpdateState>(() => updateService.getState());
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateActionMsg, setUpdateActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = updateService.subscribe((s) => {
      setUpdateState(s);
    });
    return () => unsub();
  }, []);

  const handleCheckUpdatesManual = async () => {
    setIsCheckingUpdates(true);
    setUpdateActionMsg(null);
    try {
      const res = await updateService.checkForUpdates(true);
      if (res.hasUpdate) {
        setUpdateActionMsg(`New update v${res.latestVersion} is available! Click Update Now to install.`);
      } else {
        setUpdateActionMsg(`Your software/app is up to date (v${res.currentVersion}).`);
      }
    } catch (err: any) {
      setUpdateActionMsg(`Update check error: ${err.message || 'Check failed'}`);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleApplyUpdateManual = async () => {
    try {
      const res = await updateService.applyUpdate();
      if (res.message) {
        setUpdateActionMsg(res.message);
      }
    } catch (err: any) {
      alert(`Update error: ${err.message || 'Could not start update.'}`);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setGdriveSyncing(true);
      await connectGoogleDrive();
      if (user) {
        const res = await syncDataToGoogleDrive(user.uid);
        if (res.success) {
          alert("🎉 Google Drive connected successfully! Master backup file and daily_backups folder created in your Google Drive.");
          setGdriveConnected(true);
          setGdriveLastBackup(new Date().toISOString());
        } else {
          alert(`Google Drive connected, but initial sync had an issue: ${res.error || 'Please retry sync.'}`);
        }
      }
    } catch (err: any) {
      console.error("Google Drive connection error:", err);
      alert(`Google Drive connection failed: ${err.message || 'Please check popup permissions.'}`);
    } finally {
      setGdriveSyncing(false);
    }
  };

  const handleSyncGoogleDriveNow = async () => {
    if (!user) return;
    try {
      setGdriveSyncing(true);
      const res = await syncDataToGoogleDrive(user.uid);
      if (res.success) {
        alert("✅ Synced to Google Drive successfully!\n• Master backup updated\n• Today's daily backup created in daily_backups/");
        setGdriveLastBackup(new Date().toISOString());
      } else {
        alert(`Sync failed: ${res.error || 'Please re-connect Google Drive'}`);
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setGdriveSyncing(false);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    if (window.confirm("Disconnect Google Drive backup? Automatic 24h sync to Drive will be paused.")) {
      disconnectGoogleDrive();
      setGdriveConnected(false);
      setGdriveLastBackup(null);
    }
  };

  const handleSelectPcDirectory = async () => {
    if (!isDirectoryPickerSupported()) {
      alert("Folder selection is supported in Google Chrome, Microsoft Edge, and modern desktop browsers.");
      return;
    }
    if (!user) return;

    try {
      setPcDirSyncing(true);
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      if (!dirHandle) return;

      await saveDirectoryHandleToIndexedDB(user.uid, dirHandle);
      setPcDirConnected(true);
      setPcDirName(dirHandle.name);

      const res = await writeAllDataToPcDirectory(user.uid, dirHandle);
      if (res.masterSaved) {
        setPcDirLastBackup(new Date().toISOString());
        alert(`🎉 PC Folder connected successfully!\nBackup saved to: ${dirHandle.name}/invocentric_master_backup.json and daily_backups/`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Directory picker error:", err);
        alert(`Failed to select directory: ${err.message}`);
      }
    } finally {
      setPcDirSyncing(false);
    }
  };

  const handleSyncPcDirNow = async () => {
    if (!user) return;
    try {
      setPcDirSyncing(true);
      const dirHandle = await getDirectoryHandleFromIndexedDB(user.uid);
      if (!dirHandle) {
        alert("Please connect a backup folder first.");
        return;
      }
      const res = await writeAllDataToPcDirectory(user.uid, dirHandle);
      if (res.masterSaved) {
        setPcDirLastBackup(new Date().toISOString());
        alert(`✅ Backup saved to PC folder (${dirHandle.name}) successfully!`);
      } else {
        alert(`Backup failed: Master file could not be saved.`);
      }
    } catch (err: any) {
      console.error("PC directory sync error:", err);
      alert(`PC directory sync failed: ${err.message}`);
    } finally {
      setPcDirSyncing(false);
    }
  };

  const handleDisconnectPcDir = async () => {
    if (!user) return;
    if (window.confirm("Disconnect PC folder backup?")) {
      await removeDirectoryHandleFromIndexedDB(user.uid);
      setPcDirConnected(false);
      setPcDirName('');
      setPcDirLastBackup(null);
    }
  };
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
    return getStoredUserProfile(user?.uid);
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
        alert("Offline data restored successfully!");
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
      alert("An internet connection is required for this action! Please connect to the internet.");
      return;
    }

    const confirmImport = window.confirm("Do you want to download and merge your previous cloud data into your local PC and browser storage?");
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

      alert(`Success! A total of ${importedCount} records were downloaded and merged into your PC/Browser Storage.`);
      window.location.reload();
    } catch (err: any) {
      console.error("Cloud data migration failed:", err);
      alert("Error downloading data: " + err.message);
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
        'last_plan_check_monday',
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
        // 1. Immediately read persistent local cache from all redundant storage layers
        const cached = getStoredUserProfile(user.uid);
        if (cached && Object.keys(cached).length > 0) {
          setFormData(prev => ({
            ...DEFAULT_PROFILE_DATA,
            ...prev,
            ...cached
          }));
        }

        if (isOfflineModeReal) {
          return;
        }

        // 2. Fetch from Firestore and intelligently merge without ever dropping local fields
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          const merged = saveStoredUserProfile(user.uid, cloudData);
          setFormData(prev => ({
            ...DEFAULT_PROFILE_DATA,
            ...prev,
            ...merged
          }));

          // If local cache had fields (like upi_id, letterhead, etc.) missing in Firestore, sync them up
          const cleanToSync = sanitizeFirestorePayload({
            ...merged,
            updated_at: serverTimestamp()
          });
          setDoc(docRef, cleanToSync, { merge: true }).catch(console.warn);
        } else {
          // Document does not exist yet in Firestore - seed it with current local profile
          if (cached && (cached.business_name || cached.phone)) {
            const cleanToSync = sanitizeFirestorePayload({
              ...cached,
              id: user.uid,
              email: user.email || null,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            });
            setDoc(docRef, cleanToSync, { merge: true }).catch(console.warn);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        isLoadedRef.current = true;
        setLoading(false);
      }
    }
    fetchSettings();
  }, [user, isOfflineModeReal]);

  // Robust persistence across local secureStorage, localStorage, IndexedDB, and Firestore
  const persistSettings = async (dataToSave: typeof formData) => {
    if (!user) return;
    
    // 1. Save across all redundant local storage layers (secure, raw, permanent, global)
    saveStoredUserProfile(user.uid, dataToSave);

    // 2. Offline users collection mirror
    const cachedUsers = getSecureStorage(`offline_users_${user.uid}`, []);
    const updatedUsers = Array.isArray(cachedUsers) && cachedUsers.length > 0
      ? cachedUsers.map((u: any) => u.id === user.uid ? { ...u, ...dataToSave } : u)
      : [{ id: user.uid, ...dataToSave }];
    setSecureStorage(`offline_users_${user.uid}`, updatedUsers);

    // 3. dbService (IndexedDB)
    try {
      await dbService.update('users', user.uid, dataToSave, { offlineMode: isOfflineModeReal, userId: user.uid });
    } catch (err) {
      console.warn("dbService users update handled:", err);
    }

    // 4. Firestore (if online) - sanitized against undefined values & size limits
    if (!isOfflineModeReal && navigator.onLine) {
      const userDocRef = doc(db, 'users', user.uid);
      const updateData = sanitizeFirestorePayload({
        ...dataToSave,
        id: user.uid,
        email: user.email || dataToSave.email || null,
        updated_at: serverTimestamp(),
      });
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
      alert("Settings saved successfully!");
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
        <div className="mb-4 flex items-center justify-center">
           <Logo size={72} />
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

        {/* Operating Mode (Shop Mode vs Freelancer Mode) */}
        <section className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Operating Mode
                </h2>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                  appMode === 'shop' ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                )}>
                  {appMode === 'shop' ? 'Shop Mode Active' : 'Freelancer Mode Active'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Choose your primary operating interface: Retail/Wholesale Shop or Freelancer/Consultant Services.
              </p>
            </div>

            {/* Premium Toggle Switch */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600">
                {appMode === 'shop' ? 'Shop Mode' : 'Freelancer Mode'}
              </span>
              <button
                type="button"
                onClick={() => setAppMode(appMode === 'shop' ? 'freelancer' : 'shop')}
                className={cn(
                  "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  appMode === 'shop' ? "bg-[#166534]" : "bg-blue-600"
                )}
                role="switch"
                aria-checked={appMode === 'shop'}
                title="Toggle Shop / Freelancer Mode"
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    appMode === 'shop' ? "translate-x-7" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Interactive Cards Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {/* Shop Mode Option */}
            <div
              onClick={() => setAppMode('shop')}
              className={cn(
                "cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-4",
                appMode === 'shop'
                  ? "border-[#166534] bg-emerald-50/40 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                appMode === 'shop' ? "bg-[#166534] text-white" : "bg-slate-100 text-slate-600"
              )}>
                <Store size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Shop Mode</h3>
                  {appMode === 'shop' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Best for retail, wholesale, and traders. Includes barcode scanning, quick POS terminal, stock inventory, and GST bills.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">Quick POS</span>
                  <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">Inventory</span>
                  <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">Parties</span>
                </div>
              </div>
            </div>

            {/* Freelancer Mode Option */}
            <div
              onClick={() => setAppMode('freelancer')}
              className={cn(
                "cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-4",
                appMode === 'freelancer'
                  ? "border-blue-600 bg-blue-50/40 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                appMode === 'freelancer' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
              )}>
                <Briefcase size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Freelancer Mode</h3>
                  {appMode === 'freelancer' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Best for consultants, designers, developers & agencies. Streamlined for client proposals, hourly/project services, and contracts.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">Proposals</span>
                  <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">Clients</span>
                  <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">Services</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fast Keys & Keyboard Shortcuts Guide */}
        <section className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Keyboard size={18} className="text-[#166534]" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Fast Keys & Shortcuts
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Speed up your billing workflow using fast keys (F1 for help, F8 for new invoice, Alt+N, Ctrl+S to save).
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_shortcuts_modal'))}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          >
            <Keyboard size={14} className="text-emerald-400" />
            <span>Open Fast Keys (F1)</span>
          </button>
        </section>

        {/* Software & App Updates Section */}
        <section className="bg-gradient-to-br from-emerald-900/5 via-slate-50 to-teal-900/5 border border-emerald-200/60 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0d5c4b] flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Software & App Updates
                </h2>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Current Version: <span className="font-bold text-slate-900">v{updateState.currentVersion}</span> • Platform: <span className="font-bold text-slate-900">{updateState.platform === 'electron' ? 'Windows Desktop' : updateState.platform === 'android' ? 'Android Phone App' : 'Web Browser'}</span>
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold pt-1">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>100% Zero Data Loss Guarantee: Your invoices, stock, and customer data remain completely safe during updates.</span>
              </div>
              {updateActionMsg && (
                <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 mt-2 animate-fadeIn">
                  {updateActionMsg}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCheckUpdatesManual}
                disabled={isCheckingUpdates}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <RefreshCw size={14} className={isCheckingUpdates ? "animate-spin text-white" : "text-emerald-200"} />
                <span>{isCheckingUpdates ? 'Checking Updates...' : 'Check for Updates'}</span>
              </button>

              {updateState.hasUpdate && (
                <button
                  type="button"
                  onClick={handleApplyUpdateManual}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Update Now (v{updateState.latestVersion})</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Business Profile */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Business Profile</h2>
            <div className="flex items-center gap-4">
              {formData.logo_url && (
                <div className="relative group">
                  <img src={formData.logo_url} alt="Logo Preview" className="w-16 h-16 object-contain rounded-lg p-0.5" />
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
                <option value="template_01">InvoCentric Template 01 — Blue Bordered + IGST Columns (A4)</option>
                <option value="template_02">InvoCentric Template 02 — Blue Line Top + IGST Columns (A4)</option>
                <option value="template_03">InvoCentric Template 03 — Supplier B2B (Dedicated Serial / Batch Column)</option>
                <option value="template_04">InvoCentric Template 04 — POS Receipt Thermal (3-Inch / 80mm Roll)</option>
                <option value="template_05">InvoCentric Template 05 — POS Receipt Thermal (2-Inch / 58mm Roll)</option>
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
                  <img src={formData.social_qr_url} alt="QR Preview" className="w-16 h-16 object-contain rounded-lg p-0.5" />
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
                  <img src={formData.signature_url} alt="Signature Preview" className="h-12 w-32 object-contain rounded-lg p-0.5" />
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



        {/* Storage Engine & Privacy Selector (Cloud vs Local PC Offline) */}
        <StorageModeSelector />

        {/* Storage & Connectivity */}
        <section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <HardDrive className="text-gray-900" size={20} />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Storage & Database Options</h2>
          </div>
          
          <div className="space-y-6">
            {/* 1. PC Hard Drive Storage Mode (Premium Local-First Mode) */}
            
            {/* PC Hard Drive Directory Folder Mode (Master + Daily Backups) */}
            <div className="p-6 bg-gradient-to-r from-green-50/80 via-emerald-50/60 to-teal-50/50 border border-green-200 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-[#166534] uppercase tracking-wider flex items-center gap-1.5">
                      <span>PC Hard Drive Folder Backup</span>
                      <span className="bg-[#166534] text-[8px] font-black text-white px-2 py-0.5 rounded uppercase tracking-widest">Local Disk</span>
                    </p>
                    {pcDirConnected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={11} /> Folder Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    Select a folder on your PC. InvoCentric automatically writes the master database (<span className="font-mono font-bold text-emerald-900">invocentric_master_backup.json</span>) and creates daily dated files inside <span className="font-mono font-bold text-emerald-900">daily_backups/</span> every 24 hours.
                  </p>
                  {pcDirConnected && (
                    <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                      <span className="font-bold text-slate-600">Selected PC Folder: <span className="font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">{pcDirName}</span></span>
                      {pcDirLastBackup && (
                        <span className="text-slate-500 font-medium">Last Saved: {new Date(pcDirLastBackup).toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pcDirConnected ? (
                    <>
                      <button
                        type="button"
                        disabled={pcDirSyncing}
                        onClick={handleSyncPcDirNow}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <HardDrive size={13} className={cn(pcDirSyncing && "animate-spin")} />
                        <span>{pcDirSyncing ? 'Writing...' : 'Save to PC Now'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectPcDirectory}
                        className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Change Folder"
                      >
                        Change Folder
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectPcDir}
                        className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Disconnect Folder"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={pcDirSyncing}
                      onClick={handleSelectPcDirectory}
                      className="px-4 py-2.5 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <FolderOpen size={15} />
                      <span>{pcDirSyncing ? 'Connecting...' : 'Choose PC Backup Folder'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

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
                      Click here to download and merge your previous cloud data into your local PC and browser storage.
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
            {/* Google Drive 24-Hour Auto-Backup (Master File + Daily Folder) */}
            <div className="p-5 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-[#166534] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Google Drive Auto-Backup</span>
                      <span className="bg-[#166534] text-[9px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Cloud 24H</span>
                    </p>
                    {gdriveConnected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={11} /> Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Saves an accumulated master backup (<span className="font-mono font-bold text-emerald-800">invocentric_master_backup.json</span>) and dated daily snapshots inside <span className="font-mono font-bold text-emerald-800">daily_backups/</span> on your Google Drive automatically every 24 hours.
                  </p>
                  {gdriveLastBackup && (
                    <p className="text-[11px] text-slate-500 font-semibold">
                      Last Google Drive Sync: {new Date(gdriveLastBackup).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {gdriveConnected ? (
                    <>
                      <button
                        type="button"
                        disabled={gdriveSyncing}
                        onClick={handleSyncGoogleDriveNow}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Upload size={13} className={cn(gdriveSyncing && "animate-spin")} />
                        <span>{gdriveSyncing ? 'Syncing...' : 'Sync to Drive Now'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectGoogleDrive}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Disconnect Google Drive"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={gdriveSyncing}
                      onClick={handleConnectGoogleDrive}
                      className="px-4 py-2.5 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <HardDrive size={14} />
                      <span>{gdriveSyncing ? 'Connecting...' : 'Connect Google Drive'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">Email Daily Auto-Backup</p>
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
