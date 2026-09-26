import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { getStoredUserProfile, saveStoredUserProfile, sanitizeFirestorePayload, sanitizeUserProfile, DEFAULT_PROFILE_DATA, UserProfileData } from '../utils/settingsStorage';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  X, 
  LogOut, 
  CheckCircle2, 
  Download, 
  Upload, 
  Trash2, 
  HardDrive, 
  FolderOpen, 
  Lock, 
  Unlock, 
  CloudDownload, 
  Store, 
  Briefcase, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  Smartphone, 
  Pill, 
  Scale, 
  User, 
  Building, 
  FileText, 
  CreditCard, 
  Settings, 
  ChevronRight, 
  ArrowLeft, 
  Camera, 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  HelpCircle, 
  Key, 
  Bell, 
  Check, 
  ExternalLink,
  Search,
  Repeat
} from 'lucide-react';
import { updateService, AppUpdateState } from '../services/updateService';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { db, OperationType, handleFirestoreError, auth } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get('tab');
  
  // Mobile drill-down state: if mobile and no tab query, show category cards list
  const activeTab = currentTabParam || 'profile';
  const isMobileListVisible = !currentTabParam;

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMobileBack = () => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  // Search filter for mobile category list
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile photo file input ref
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

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
        setUpdateActionMsg(`Update found: v${res.latestVersion}`);
      } else {
        setUpdateActionMsg("You are using the latest version!");
      }
    } catch (err: any) {
      setUpdateActionMsg("Could not check updates: " + err.message);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleApplyUpdate = async () => {
    try {
      const res = await updateService.applyUpdate();
      if (res.message) {
        setUpdateActionMsg(res.message);
      }
    } catch (err: any) {
      alert("Update error: " + err.message);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setGdriveSyncing(true);
      const connected = await connectGoogleDrive();
      if (connected) {
        setGdriveConnected(true);
        alert("Google Drive connected successfully! Automatic 24-hour backup is now enabled.");
        if (user) {
          const syncRes = await syncDataToGoogleDrive(user.uid);
          if (syncRes.success) {
            setGdriveLastBackup(new Date().toISOString());
          }
        }
      }
    } catch (err: any) {
      console.error("Drive connection error:", err);
      alert(`Google Drive connection failed: ${err.message}`);
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
        alert("Synced to Google Drive successfully!\nMaster backup updated\nToday's daily backup created in daily_backups/");
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
        alert(`PC Folder connected successfully!\nBackup saved to: ${dirHandle.name}/invocentric_master_backup.json and daily_backups/`);
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
        alert(`Backup saved to PC folder (${dirHandle.name}) successfully!`);
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
        const snap = await getDocs(q);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a: any, b: any) => {
          const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
          const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
          return dateB.getTime() - dateA.getTime();
        });
        setReceipts(docs);
      } catch (err) {
        console.warn("Could not fetch receipts:", err);
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
    if (!user?.uid) return { ...DEFAULT_PROFILE_DATA };
    const cached = getStoredUserProfile(user.uid);
    return sanitizeUserProfile(cached, user.email, user.displayName);
  };

  const [formData, setFormData] = useState<UserProfileData>(getInitialFormData);
  const [initialDataSnapshot, setInitialDataSnapshot] = useState<UserProfileData>(getInitialFormData);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Photo size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profile_photo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
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
      if (file.size > 1024 * 1024) {
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
      if (file.size > 1024 * 1024) {
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
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const profileData = sanitizeUserProfile(userDocSnap.data(), user.email, user.displayName);
        setFormData(prev => ({ ...prev, ...profileData }));
        setSecureStorage(`user_profile_${user.uid}`, profileData);
      }

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

      if (isPcDriveEnabled) {
        try {
          const handle = await getFileHandleFromIndexedDB(user.uid);
          if (handle) {
            await writeAllDataToPcFile(user.uid, handle);
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
      if (navigator.onLine) {
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);
      }

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

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }
    if (!auth.currentUser) {
      setPasswordStatus({ type: 'error', text: 'You must be logged in to update your password.' });
      return;
    }

    setPasswordLoading(true);
    setPasswordStatus(null);
    try {
      if (currentPassword && auth.currentUser.email) {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, cred);
      }
      await updatePassword(auth.currentUser, newPassword);
      setPasswordStatus({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err.code === 'auth/wrong-password') {
        setPasswordStatus({ type: 'error', text: 'Current password is incorrect.' });
      } else if (err.code === 'auth/requires-recent-login') {
        setPasswordStatus({ type: 'error', text: 'Please enter your current password to confirm your identity.' });
      } else {
        setPasswordStatus({ type: 'error', text: err.message || 'Failed to update password.' });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      if (!user) return;
      setLoading(true);
      try {
        const isOwnerEmail = user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        const cached = getStoredUserProfile(user.uid);
        const safeLocal = sanitizeUserProfile(cached, user.email, user.displayName);
        const mergedInitial = {
          ...DEFAULT_PROFILE_DATA,
          ...safeLocal
        };
        setFormData(mergedInitial);
        setInitialDataSnapshot(mergedInitial);

        if (isOfflineModeReal) {
          return;
        }

        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          const safeCloudData = sanitizeUserProfile(cloudData, user.email, user.displayName);

          if (!isOwnerEmail) {
            const rawOwner = String(cloudData.owner_name || '').toLowerCase();
            const rawBusiness = String(cloudData.business_name || '').toLowerCase();
            const isContaminated = 
              rawOwner.includes('noman') ||
              rawOwner.includes('shekh') ||
              rawBusiness.includes('graphic designer') ||
              rawBusiness.includes('noman') ||
              cloudData.is_admin ||
              cloudData.role === 'owner';

            if (isContaminated) {
              const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
              const defaultSafeName = user.displayName || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
              const wipeClean = sanitizeFirestorePayload({
                business_name: '',
                owner_name: defaultSafeName,
                display_name: defaultSafeName,
                phone: '',
                address: '',
                city: '',
                state: '',
                pincode: '',
                gstin: '',
                pan: '',
                upi_id: '',
                bank_name: '',
                bank_branch: '',
                account_number: '',
                ifsc_code: '',
                account_holder: '',
                logo_url: '',
                signature_url: '',
                is_admin: false,
                role: 'user',
                updated_at: serverTimestamp()
              });
              setDoc(docRef, wipeClean, { merge: true }).catch(console.warn);
            }
          }

          const merged = saveStoredUserProfile(user.uid, safeCloudData, user.email);
          const fullData = {
            ...DEFAULT_PROFILE_DATA,
            ...merged
          };
          setFormData(fullData);
          setInitialDataSnapshot(fullData);

          const cleanToSync = sanitizeFirestorePayload({
            ...merged,
            updated_at: serverTimestamp()
          });
          setDoc(docRef, cleanToSync, { merge: true }).catch(console.warn);
        } else {
          if (safeLocal && (safeLocal.business_name || safeLocal.phone)) {
            const cleanToSync = sanitizeFirestorePayload({
              ...safeLocal,
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

  const persistSettings = async (dataToSave: typeof formData) => {
    if (!user) return;
    saveStoredUserProfile(user.uid, dataToSave, user.email);

    const cachedUsers = getSecureStorage(`offline_users_${user.uid}`, []);
    const updatedUsers = Array.isArray(cachedUsers) && cachedUsers.length > 0
      ? cachedUsers.map((u: any) => u.id === user.uid ? { ...u, ...dataToSave } : u)
      : [{ id: user.uid, ...dataToSave }];
    setSecureStorage(`offline_users_${user.uid}`, updatedUsers);

    try {
      await dbService.update('users', user.uid, dataToSave, { offlineMode: isOfflineModeReal, userId: user.uid });
    } catch (err) {
      console.warn("dbService users update handled:", err);
    }

    if (!isOfflineModeReal && navigator.onLine) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const {
          is_admin,
          role,
          plan,
          plan_tier,
          plan_status,
          subscription_status,
          subscription_pending,
          subscription_request_ref,
          created_at,
          free_trial_claimed,
          free_trial_claimed_at,
          ...cleanData
        } = dataToSave as any;

        const updateData = sanitizeFirestorePayload({
          ...cleanData,
          id: user.uid,
          email: user.email || cleanData.email || null,
          updated_at: serverTimestamp(),
        });
        await setDoc(userDocRef, updateData, { merge: true });
      } catch (cloudErr) {
        console.warn("Cloud settings sync notice:", cloudErr);
      }
    }
  };

  useEffect(() => {
    if (!isLoadedRef.current || !user) return;

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
    }, 1500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData, user, isOfflineModeReal]);

  const handleManualSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const handleResetForm = () => {
    if (window.confirm("Are you sure you want to reset any unsaved changes in this form?")) {
      setFormData({ ...initialDataSnapshot });
    }
  };

  const CATEGORIES = [
    { 
      id: 'profile', 
      label: 'Profile', 
      mobileTitle: 'User Settings',
      icon: User, 
      desc: 'Update your personal profile, credentials & details' 
    },
    { 
      id: 'company', 
      label: 'Company', 
      mobileTitle: 'Company Settings',
      icon: Store, 
      desc: 'Company information, operating mode & logo' 
    },
    { 
      id: 'tax', 
      label: 'Tax & Numbering', 
      mobileTitle: 'Tax & Numbering',
      icon: FileText, 
      desc: 'GSTIN, PAN & invoice numbering serials' 
    },
    { 
      id: 'payment', 
      label: 'Payment Details', 
      mobileTitle: 'Payment & QR',
      icon: CreditCard, 
      desc: 'UPI ID, QR code & bank accounts' 
    },
    { 
      id: 'storage', 
      label: 'Storage & Backup', 
      mobileTitle: 'Backup & Restore',
      icon: HardDrive, 
      desc: 'PC Hard Drive, Google Drive & data export' 
    },
    { 
      id: 'system', 
      label: 'System Settings', 
      mobileTitle: 'System Settings',
      icon: Settings, 
      desc: 'Language, timezone, currency & app updates' 
    },
    { 
      id: 'security', 
      label: 'Plan & Security', 
      mobileTitle: 'Plan & Security',
      icon: ShieldCheck, 
      desc: 'Subscription tier, billing receipts & account' 
    }
  ];

  const filteredCategories = CATEGORIES.filter(c => 
    c.mobileTitle.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
    c.desc.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const currentCategoryInfo = CATEGORIES.find(c => c.id === activeTab) || CATEGORIES[0];

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 font-semibold text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-16 px-3 sm:px-6 lg:px-8">
      {/* ========================================================================= */}
      {/* MOBILE CATEGORY DIRECTORY (Shown on mobile when no tab is selected)       */}
      {/* Matches user's Android mockup structure: Image 3                          */}
      {/* ========================================================================= */}
      <div className={cn("md:hidden", !isMobileListVisible && "hidden")}>
        {/* Mobile Top Header */}
        <div className="flex items-center justify-between py-4 border-b border-slate-200 mb-4 bg-white -mx-3 px-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <Logo size={28} />
          </div>
        </div>

        {/* Search Bar for Mobile Categories */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search settings..."
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <p className="text-xs font-semibold text-slate-500 mb-3 px-1">
          Manage your account, business and system preferences
        </p>

        {/* Vertical list of Category Cards */}
        <div className="space-y-2.5">
          {filteredCategories.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className="w-full p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between text-left hover:border-emerald-500 hover:shadow-xs transition-all active:scale-[0.99] group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <IconComponent size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                      {cat.mobileTitle}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-medium">
                      {cat.desc}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-emerald-700 transition-colors shrink-0 ml-2" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP & DRILLDOWN CONTAINER                                             */}
      {/* ========================================================================= */}
      <div className={cn(isMobileListVisible && "hidden md:block")}>
        {/* Mobile Drilldown Navigation Top Bar */}
        <div className="md:hidden flex items-center justify-between py-3.5 border-b border-slate-200 mb-6 bg-white -mx-3 px-4 sticky top-0 z-20 shadow-xs">
          <button
            type="button"
            onClick={handleMobileBack}
            className="flex items-center gap-2 text-slate-700 font-bold text-sm hover:text-emerald-800 py-1"
          >
            <ArrowLeft size={18} />
            <span>Settings</span>
            <span className="text-slate-400 font-normal">/</span>
            <span className="text-emerald-900 font-black">{currentCategoryInfo.label}</span>
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={saving}
            className="p-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl font-bold flex items-center gap-1 text-xs"
            title="Save changes"
          >
            <Check size={16} />
            <span>Save</span>
          </button>
        </div>

        {/* Desktop Header */}
        <header className="mb-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100 shadow-xs">
                <Settings size={26} className="text-emerald-800" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Manage your account, business profiles and system preferences</p>
              </div>
            </div>

            {/* Autosave Status Indicator */}
            <div className="flex items-center gap-3">
              {saveStatus === 'saving' && (
                <div className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full animate-ping"></span>
                  Saving automatically...
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  All changes saved
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="px-3.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Error saving changes
                </div>
              )}
              {saveStatus === 'idle' && isLoadedRef.current && (
                <div className="px-3 py-1.5 text-slate-500 text-xs font-medium flex items-center gap-1.5 bg-slate-50 rounded-full border border-slate-200">
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  Auto-save active
                </div>
              )}
            </div>
          </div>

          {/* Desktop Horizontal Category Tabs Bar (Matches Image 1) */}
          <div className="hidden md:flex items-center gap-2 mt-5 overflow-x-auto pb-2 no-scrollbar">
            {CATEGORIES.map(cat => {
              const IconComp = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveTab(cat.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer",
                    isActive 
                      ? "bg-[#166534] text-white shadow-sm shadow-green-900/10" 
                      : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
                  )}
                >
                  <IconComp size={15} className={isActive ? "text-white" : "text-slate-500"} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* ========================================================================= */}
        {/* MAIN 2-COLUMN GRID (Left: Active Tab Content, Right: Quick Links / Helper) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-12 gap-6 mt-2">
          {/* Main Left Column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <form onSubmit={handleManualSave} className="space-y-6">
              
              {/* ================================================================= */}
              {/* TAB 1: PROFILE (User & Personal Details, Password, Address)       */}
              {/* ================================================================= */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {/* Card 1: User Profile */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">User Profile</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Update your personal, identity and professional credentials</p>
                    </div>

                    {/* Avatar / Photo Upload */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-6 border-b border-slate-100">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-emerald-100 flex items-center justify-center overflow-hidden shadow-xs">
                          {formData.profile_photo_url ? (
                            <img src={formData.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <User size={40} className="text-slate-400" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => profilePhotoInputRef.current?.click()}
                          className="absolute bottom-0 right-0 p-2 rounded-full bg-[#166534] hover:bg-green-800 text-white shadow-md transition-transform active:scale-90 cursor-pointer"
                          title="Change Photo"
                        >
                          <Camera size={14} />
                        </button>
                      </div>

                      <div className="text-center sm:text-left space-y-1.5">
                        <div className="flex items-center gap-3 justify-center sm:justify-start">
                          <button
                            type="button"
                            onClick={() => profilePhotoInputRef.current?.click()}
                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            Change Photo
                          </button>
                          {formData.profile_photo_url && (
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, profile_photo_url: '' }))}
                              className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">JPG, PNG (Max 2MB)</p>
                        <input 
                          type="file" 
                          ref={profilePhotoInputRef} 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handlePhotoUpload} 
                        />
                      </div>
                    </div>

                    {/* Grid of Profile Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Full Name *</label>
                        <input 
                          type="text" 
                          required
                          value={formData.owner_name || ''}
                          onChange={(e) => setFormData(p => ({ ...p, owner_name: e.target.value, display_name: e.target.value }))}
                          placeholder="Rahul Sharma"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Email Address *</label>
                        <input 
                          type="email" 
                          required
                          value={formData.email || user?.email || ''}
                          onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                          placeholder="rahul.sharma@yourcompany.com"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Phone Number *</label>
                        <input 
                          type="tel" 
                          value={formData.phone || ''}
                          onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                          placeholder="+91 98765 43210"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Employee / Business ID</label>
                        <input 
                          type="text" 
                          value={formData.employee_id || ''}
                          onChange={(e) => setFormData(p => ({ ...p, employee_id: e.target.value }))}
                          placeholder="EMP001"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Designation</label>
                        <input 
                          type="text" 
                          value={formData.designation || ''}
                          onChange={(e) => setFormData(p => ({ ...p, designation: e.target.value }))}
                          placeholder="e.g. Owner / Manager / Executive"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Department</label>
                        <input 
                          type="text" 
                          value={formData.department || ''}
                          onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))}
                          placeholder="e.g. Management / Sales / Billing"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Date of Joining / Start</label>
                        <input 
                          type="date" 
                          value={formData.date_of_joining || ''}
                          onChange={(e) => setFormData(p => ({ ...p, date_of_joining: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div className="flex flex-col justify-center">
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Status</label>
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, is_active: p.is_active === false ? true : false }))}
                            className={cn(
                              "relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                              formData.is_active !== false ? "bg-[#166534]" : "bg-slate-300"
                            )}
                            role="switch"
                            aria-checked={formData.is_active !== false}
                          >
                            <span 
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                                formData.is_active !== false ? "translate-x-6" : "translate-x-0"
                              )}
                            />
                          </button>
                          <span className="text-xs font-bold text-slate-700">
                            {formData.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Change Password */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <div className="flex items-center gap-2">
                        <Lock size={18} className="text-[#166534]" />
                        <h2 className="text-base font-bold text-slate-900">Change Password</h2>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Keep your account secure with a strong password</p>
                    </div>

                    {passwordStatus && (
                      <div className={cn(
                        "p-4 rounded-xl text-xs font-bold mb-5 flex items-center gap-2",
                        passwordStatus.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                      )}>
                        {passwordStatus.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                        <span>{passwordStatus.text}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Current Password</label>
                        <input 
                          type="password" 
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Current password"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">New Password</label>
                        <input 
                          type="password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password (min 6)"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Confirm Password</label>
                        <input 
                          type="password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={handlePasswordUpdate}
                        disabled={passwordLoading || !newPassword}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
                      >
                        <Key size={14} />
                        <span>{passwordLoading ? 'Updating...' : 'Update Password'}</span>
                      </button>
                    </div>
                  </section>

                  {/* Card 3: Address Information */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-[#166534]" />
                        <h2 className="text-base font-bold text-slate-900">Address Information</h2>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Your official business & operating address</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Address Line 1 *</label>
                        <input 
                          type="text" 
                          value={formData.address || ''}
                          onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                          placeholder="123 Business Street, Near City Center"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Address Line 2</label>
                        <input 
                          type="text" 
                          value={formData.address_line_2 || ''}
                          onChange={(e) => setFormData(p => ({ ...p, address_line_2: e.target.value }))}
                          placeholder="Floor 2, Complex / Landmark"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">City *</label>
                        <input 
                          type="text" 
                          value={formData.city || ''}
                          onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                          placeholder="Ahmedabad"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">State *</label>
                        <input 
                          type="text" 
                          value={formData.state || ''}
                          onChange={(e) => setFormData(p => ({ ...p, state: e.target.value }))}
                          placeholder="Gujarat"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Country</label>
                        <input 
                          type="text" 
                          value={formData.country || 'India'}
                          onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))}
                          placeholder="India"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Pin Code *</label>
                        <input 
                          type="text" 
                          value={formData.pincode || ''}
                          onChange={(e) => setFormData(p => ({ ...p, pincode: e.target.value }))}
                          placeholder="380001"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* ================================================================= */}
              {/* TAB 2: COMPANY (Operating Mode, Shop Name, Logo, Modules)        */}
              {/* ================================================================= */}
              {activeTab === 'company' && (
                <div className="space-y-6">
                  {/* Operating Mode Switcher */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                            Operating Mode
                          </h2>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                            appMode === 'shop' ? "bg-emerald-100 text-emerald-800" : "bg-emerald-100 text-emerald-800"
                          )}>
                            {appMode === 'shop' ? 'Shop Mode Active' : 'Freelancer Mode Active'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Choose your primary operating interface: Retail/Wholesale Shop or Freelancer/Consultant Services.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-600">
                          {appMode === 'shop' ? 'Shop Mode' : 'Freelancer Mode'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAppMode(appMode === 'shop' ? 'freelancer' : 'shop')}
                          className={cn(
                            "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            appMode === 'shop' ? "bg-[#166534]" : "bg-[#166534]"
                          )}
                          role="switch"
                          aria-checked={appMode === 'shop'}
                          title="Toggle Shop / Freelancer Mode"
                        >
                          <span 
                            className={cn(
                              "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              appMode === 'shop' ? "translate-x-0" : "translate-x-7"
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Mode perks comparison cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        appMode === 'shop' 
                          ? "bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300" 
                          : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                      )} onClick={() => setAppMode('shop')}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Store size={16} className={appMode === 'shop' ? "text-[#166534]" : "text-slate-500"} />
                          <h3 className="text-xs font-bold text-slate-900 uppercase">Shop / Retail / Wholesale Mode</h3>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          POS barcode scanning, low stock alerts, product inventory, batch & expiry dates, customer credit ledger.
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        appMode === 'freelancer' 
                          ? "bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300" 
                          : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                      )} onClick={() => setAppMode('freelancer')}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Briefcase size={16} className={appMode === 'freelancer' ? "text-[#166534]" : "text-slate-500"} />
                          <h3 className="text-xs font-bold text-slate-900 uppercase">Freelancer / Consultant Mode</h3>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          Hourly & milestone rates, service catalog, software subscriptions expense ledger, project quotes.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Company Information & Logo */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Company Information</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Details that appear on your invoices and customer receipts</p>
                      </div>
                      
                      {/* Logo Preview & Upload */}
                      <div className="flex items-center gap-3">
                        {formData.logo_url && (
                          <div className="relative group">
                            <img src={formData.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, logo_url: '' }))}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors shadow-xs"
                              title="Remove logo"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        <label className="cursor-pointer px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5">
                          <Camera size={13} />
                          <span>{formData.logo_url ? 'Change Logo' : 'Upload Logo'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Business / Company Name *</label>
                        <input 
                          type="text" 
                          required
                          value={formData.business_name || ''}
                          onChange={(e) => setFormData(p => ({ ...p, business_name: e.target.value }))}
                          placeholder="Your Company Pvt. Ltd."
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Tagline / Business Subtitle</label>
                        <input 
                          type="text" 
                          value={formData.tagline || ''}
                          onChange={(e) => setFormData(p => ({ ...p, tagline: e.target.value }))}
                          placeholder="Smarter Business, Better Growth"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Website URL</label>
                        <input 
                          type="text" 
                          value={formData.website || ''}
                          onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))}
                          placeholder="www.yourcompany.com"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Industry Specialized Modules */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">Industry Features & Modules</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Toggle advanced modules for Pharma, Weighing Scale, or Hardware</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Pharma Batch / Expiry */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Pill size={16} className="text-[#166534]" />
                            <h3 className="text-xs font-bold text-slate-900 uppercase">Pharma Batch & Expiry</h3>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Enables Batch No., Expiry Date, and Drug License fields on items & invoices.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={formData.industry_modules?.pharma_batch_expiry || false}
                          onChange={(e) => setFormData(p => ({
                            ...p,
                            industry_modules: {
                              ...p.industry_modules,
                              pharma_batch_expiry: e.target.checked
                            }
                          }))}
                          className="w-5 h-5 accent-[#166534] rounded cursor-pointer mt-1"
                        />
                      </div>

                      {/* Decimal / Weighing Scale */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Scale size={16} className="text-[#166534]" />
                            <h3 className="text-xs font-bold text-slate-900 uppercase">Weighing Scale & 3-Decimals</h3>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Enables 3-decimal precise quantities (e.g. 1.250 kg) for grocery & hardware.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={formData.industry_modules?.hardware_decimals || false}
                          onChange={(e) => setFormData(p => ({
                            ...p,
                            industry_modules: {
                              ...p.industry_modules,
                              hardware_decimals: e.target.checked
                            }
                          }))}
                          className="w-5 h-5 accent-[#166534] rounded cursor-pointer mt-1"
                        />
                      </div>

                      {/* Electronics Serial / IMEI */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Smartphone size={16} className="text-[#166534]" />
                            <h3 className="text-xs font-bold text-slate-900 uppercase">Serial & IMEI Tracking</h3>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Enables IMEI, serial numbers, and warranty tracking on electronics invoices.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={formData.industry_modules?.electronics_imei || false}
                          onChange={(e) => setFormData(p => ({
                            ...p,
                            industry_modules: {
                              ...p.industry_modules,
                              electronics_imei: e.target.checked
                            }
                          }))}
                          className="w-5 h-5 accent-[#166534] rounded cursor-pointer mt-1"
                        />
                      </div>

                      {/* Services & Retainers */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Repeat size={16} className="text-[#166534]" />
                            <h3 className="text-xs font-bold text-slate-900 uppercase">Recurring Retainers</h3>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Monthly & annual automatic retainer reminders for client services.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={formData.industry_modules?.services_recurring || false}
                          onChange={(e) => setFormData(p => ({
                            ...p,
                            industry_modules: {
                              ...p.industry_modules,
                              services_recurring: e.target.checked
                            }
                          }))}
                          className="w-5 h-5 accent-[#166534] rounded cursor-pointer mt-1"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Digital Signature & Letterhead */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Authorized Signature</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Appears automatically at the bottom of all generated invoices</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {formData.signature_url && (
                          <div className="relative group">
                            <img src={formData.signature_url} alt="Signature" className="h-10 w-28 object-contain rounded-lg border border-slate-200 bg-white p-1" />
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, signature_url: '' }))}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors shadow-xs"
                              title="Remove signature"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        <label className="cursor-pointer px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5">
                          <Upload size={13} />
                          <span>{formData.signature_url ? 'Change Signature' : 'Upload Signature'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Default Terms & Conditions</label>
                        <textarea 
                          rows={3}
                          value={formData.default_terms || ''}
                          onChange={(e) => setFormData(p => ({ ...p, default_terms: e.target.value }))}
                          placeholder="1. Goods once sold will not be taken back.&#10;2. Interest @18% p.a. will be charged if payment is delayed."
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* ================================================================= */}
              {/* TAB 3: TAX & NUMBERING (GST, PAN, Drug License, Serials)          */}
              {/* ================================================================= */}
              {activeTab === 'tax' && (
                <div className="space-y-6">
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">Tax Identification Details</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Government registration codes for valid tax compliance</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">GSTIN Number</label>
                        <input 
                          type="text" 
                          value={formData.gstin || ''}
                          onChange={(e) => setFormData(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                          placeholder="24ABCDE1234F1Z5"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow uppercase font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">PAN Number</label>
                        <input 
                          type="text" 
                          value={formData.pan || ''}
                          onChange={(e) => setFormData(p => ({ ...p, pan: e.target.value.toUpperCase() }))}
                          placeholder="ABCDE1234F"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow uppercase font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Drug License (DL) Number</label>
                        <input 
                          type="text" 
                          value={formData.drug_license_no || ''}
                          onChange={(e) => setFormData(p => ({ ...p, drug_license_no: e.target.value }))}
                          placeholder="e.g. 20B/21B GJ-PAT-12345"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow uppercase"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Document Numbering & Serials */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">Document Numbering & Serial Formats</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Control how your invoice numbers and quotations are formatted</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Invoice Prefix</label>
                        <input 
                          type="text" 
                          value={formData.invoice_prefix || 'INV'}
                          onChange={(e) => setFormData(p => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))}
                          placeholder="INV"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow uppercase font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Invoice Design Template</label>
                        <select 
                          value={formData.invoice_template || 'template_01'}
                          onChange={(e) => setFormData(p => ({ ...p, invoice_template: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-semibold"
                        >
                          <option value="template_01">Template 01 — Modern Clean A4 (Tax Invoice)</option>
                          <option value="template_02">Template 02 — Corporate Bordered A4</option>
                          <option value="template_03">Template 03 — Wholesale & Pharma Detailed A4</option>
                          <option value="template_04">Template 04 — POS Thermal 3-Inch (80mm)</option>
                          <option value="template_05">Template 05 — POS Thermal 2-Inch (58mm)</option>
                        </select>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* ================================================================= */}
              {/* TAB 4: PAYMENT DETAILS (UPI, QR Code, Bank Accounts)             */}
              {/* ================================================================= */}
              {activeTab === 'payment' && (
                <div className="space-y-6">
                  {/* UPI & QR Code */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">UPI & Dynamic Payment QR</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Customers can scan to pay instantly via Google Pay, PhonePe, or Paytm</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {formData.social_qr_url && (
                          <div className="relative group">
                            <img src={formData.social_qr_url} alt="QR Code" className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-0.5" />
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, social_qr_url: '' }))}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors shadow-xs"
                              title="Remove QR"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        <label className="cursor-pointer px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5">
                          <Upload size={13} />
                          <span>{formData.social_qr_url ? 'Change QR' : 'Upload Standee QR'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Primary UPI ID</label>
                        <input 
                          type="text" 
                          value={formData.upi_id || ''}
                          onChange={(e) => setFormData(p => ({ ...p, upi_id: e.target.value }))}
                          placeholder="businessname@okaxis"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                        <p className="text-[11px] text-slate-400 mt-1 font-medium">Used to automatically generate printable UPI QR codes on invoices</p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">QR Code Display Label</label>
                        <input 
                          type="text" 
                          value={formData.social_qr_label || ''}
                          onChange={(e) => setFormData(p => ({ ...p, social_qr_label: e.target.value }))}
                          placeholder="Scan & Pay via any UPI App"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Bank Account Details */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">Bank Account Details (NEFT / RTGS)</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Printed on invoices for direct bank transfer payments</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Bank Name</label>
                        <input 
                          type="text" 
                          value={formData.bank_name || ''}
                          onChange={(e) => setFormData(p => ({ ...p, bank_name: e.target.value }))}
                          placeholder="HDFC Bank"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Branch Name</label>
                        <input 
                          type="text" 
                          value={formData.bank_branch || ''}
                          onChange={(e) => setFormData(p => ({ ...p, bank_branch: e.target.value }))}
                          placeholder="Main Branch, CG Road"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Account Number</label>
                        <input 
                          type="text" 
                          value={formData.account_number || ''}
                          onChange={(e) => setFormData(p => ({ ...p, account_number: e.target.value }))}
                          placeholder="50200012345678"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">IFSC Code</label>
                        <input 
                          type="text" 
                          value={formData.ifsc_code || ''}
                          onChange={(e) => setFormData(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                          placeholder="HDFC0000123"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow uppercase font-mono font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Account Holder Name</label>
                        <input 
                          type="text" 
                          value={formData.account_holder || ''}
                          onChange={(e) => setFormData(p => ({ ...p, account_holder: e.target.value }))}
                          placeholder="Your Company Pvt. Ltd."
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* ================================================================= */}
              {/* TAB 5: STORAGE & BACKUP (PC Drive, Google Drive, JSON Backup)     */}
              {/* ================================================================= */}
              {activeTab === 'storage' && (
                <div className="space-y-6">
                  {/* Storage Mode Selector Widget */}
                  <StorageModeSelector />

                  {/* PC Hard Drive Directory Folder Backup */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <HardDrive size={20} className="text-[#166534]" />
                          <h2 className="text-base font-bold text-slate-900">PC Hard Drive Folder Backup</h2>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">Local Disk</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Select a folder on your computer. InvoCentric saves master backup & daily dated snapshots every 24 hours.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {pcDirConnected ? (
                          <>
                            <button
                              type="button"
                              disabled={pcDirSyncing}
                              onClick={handleSyncPcDirNow}
                              className="px-3.5 py-2 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <HardDrive size={13} className={cn(pcDirSyncing && "animate-spin")} />
                              <span>{pcDirSyncing ? 'Writing...' : 'Save Now'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleSelectPcDirectory}
                              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={handleDisconnectPcDir}
                              className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={pcDirSyncing}
                            onClick={handleSelectPcDirectory}
                            className="px-4 py-2.5 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <FolderOpen size={14} />
                            <span>{pcDirSyncing ? 'Connecting...' : 'Choose PC Folder'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {pcDirConnected && (
                      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs font-medium text-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <span>Connected Folder: <strong className="text-emerald-900 font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">{pcDirName}</strong></span>
                        {pcDirLastBackup && <span>Last sync: {new Date(pcDirLastBackup).toLocaleString()}</span>}
                      </div>
                    )}
                  </section>

                  {/* Google Drive Automatic Cloud Backup */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe size={20} className="text-[#166534]" />
                          <h2 className="text-base font-bold text-slate-900">Google Drive Automatic Cloud Backup</h2>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">Cloud Sync</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Seamless background backup to your personal Google Drive account with 24-hr daily retention.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {gdriveConnected ? (
                          <>
                            <button
                              type="button"
                              disabled={gdriveSyncing}
                              onClick={handleSyncGoogleDriveNow}
                              className="px-3.5 py-2 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <RefreshCw size={13} className={cn(gdriveSyncing && "animate-spin")} />
                              <span>{gdriveSyncing ? 'Syncing...' : 'Sync Now'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleDisconnectGoogleDrive}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={gdriveSyncing}
                            onClick={handleConnectGoogleDrive}
                            className="px-4 py-2.5 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <CloudDownload size={14} />
                            <span>{gdriveSyncing ? 'Connecting...' : 'Connect Google Drive'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {gdriveConnected && (
                      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs font-medium text-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-emerald-900 font-bold">
                          <CheckCircle2 size={14} /> Google Drive Connected & Active
                        </span>
                        {gdriveLastBackup && <span>Last sync: {new Date(gdriveLastBackup).toLocaleString()}</span>}
                      </div>
                    )}
                  </section>

                  {/* Manual Backup Download & Restore */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">Manual Offline Backups</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Export a complete standalone JSON database file or restore onto another machine</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#166534] hover:bg-green-800 text-white p-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors shadow-xs cursor-pointer"
                      >
                        <Download size={16} />
                        <span>Download Offline Backup</span>
                      </button>

                      <div className="flex-1 relative">
                        <input
                          type="file"
                          accept=".json"
                          ref={backupFileInputRef}
                          onChange={handleRestoreBackup}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Restore Backup"
                        />
                        <button
                          type="button"
                          className="w-full flex items-center justify-center gap-2 bg-white text-slate-800 border-2 border-slate-200 hover:border-slate-800 p-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
                        >
                          <Upload size={16} />
                          <span>Restore From JSON</span>
                        </button>
                      </div>
                    </div>

                    {!isCloudDataImported && (
                      <div className="mt-5 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-700">
                          <strong className="text-emerald-900 block font-bold">Import Previous Cloud Data</strong>
                          Download existing customer invoices and catalog records into local storage.
                        </div>
                        <button
                          type="button"
                          disabled={importingCloudData}
                          onClick={handleImportCloudData}
                          className="px-4 py-2 bg-[#166534] hover:bg-green-800 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {importingCloudData ? 'Importing...' : 'Import Data'}
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* ================================================================= */}
              {/* TAB 6: SYSTEM SETTINGS (Language, Currency, Updates, Alerts)      */}
              {/* ================================================================= */}
              {activeTab === 'system' && (
                <div className="space-y-6">
                  {/* System Preferences */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">Regional & System Preferences</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Configure language, time formatting and currency symbols</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Default Currency</label>
                        <select
                          value={formData.currency || 'INR'}
                          onChange={(e) => setFormData(p => ({ ...p, currency: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-semibold"
                        >
                          <option value="INR">INR — Indian Rupee (₹)</option>
                          <option value="USD">USD — US Dollar ($)</option>
                          <option value="EUR">EUR — Euro (€)</option>
                          <option value="AED">AED — UAE Dirham (د.إ)</option>
                          <option value="GBP">GBP — British Pound (£)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">System Language</label>
                        <select
                          value={formData.language || 'English'}
                          onChange={(e) => setFormData(p => ({ ...p, language: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-semibold"
                        >
                          <option value="English">English</option>
                          <option value="Hindi">हिन्दी (Hindi)</option>
                          <option value="Gujarati">ગુજરાતી (Gujarati)</option>
                          <option value="Marathi">मराठी (Marathi)</option>
                          <option value="Tamil">தமிழ் (Tamil)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Timezone</label>
                        <select
                          value={formData.timezone || 'Asia/Kolkata'}
                          onChange={(e) => setFormData(p => ({ ...p, timezone: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-semibold"
                        >
                          <option value="Asia/Kolkata">Asia/Kolkata (IST GMT+5:30)</option>
                          <option value="Asia/Dubai">Asia/Dubai (GST GMT+4:00)</option>
                          <option value="Europe/London">Europe/London (GMT/BST)</option>
                          <option value="America/New_York">America/New_York (EST/EDT)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Date Format</label>
                        <select
                          value={formData.date_format || 'DD-MM-YYYY'}
                          onChange={(e) => setFormData(p => ({ ...p, date_format: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-semibold"
                        >
                          <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 26-09-2026)</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 09/26/2026)</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-09-26)</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Software & App Updates */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Smartphone size={20} className="text-[#166534]" />
                          <h2 className="text-base font-bold text-slate-900">Software & App Updates</h2>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Current App Version: <strong className="text-emerald-900 font-mono font-bold">v{updateState.currentVersion || '2.0.0'}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isCheckingUpdates}
                          onClick={handleCheckUpdatesManual}
                          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw size={13} className={cn(isCheckingUpdates && "animate-spin")} />
                          <span>{isCheckingUpdates ? 'Checking...' : 'Check for Updates'}</span>
                        </button>

                        {updateState.hasUpdate && (
                          <button
                            type="button"
                            onClick={handleApplyUpdate}
                            className="px-4 py-2 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            Update Now (v{updateState.latestVersion})
                          </button>
                        )}
                      </div>
                    </div>

                    {updateActionMsg && (
                      <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold">
                        {updateActionMsg}
                      </div>
                    )}
                  </section>

                  {/* Notification & Automation Alerts */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-slate-100 pb-5 mb-6">
                      <h2 className="text-base font-bold text-slate-900">Notification Alerts</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Automated communication preferences for you and your clients</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Email Payment Reminders</p>
                          <p className="text-[11px] text-slate-500 font-medium">Send automatic email receipts and invoice due notifications</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={formData.email_reminders_enabled !== false}
                          onChange={(e) => setFormData(p => ({ ...p, email_reminders_enabled: e.target.checked }))}
                          className="w-5 h-5 accent-[#166534] rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Low Stock Inventory Alerts</p>
                          <p className="text-[11px] text-slate-500 font-medium">Show dashboard alert when product quantity falls below reorder level</p>
                        </div>
                        <input 
                          type="checkbox"
                          defaultChecked={true}
                          className="w-5 h-5 accent-[#166534] rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* ================================================================= */}
              {/* TAB 7: PLAN & SECURITY (Account Tier, Receipts, Danger Zone)      */}
              {/* ================================================================= */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {/* Account Plan & Billing Card */}
                  <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={20} className="text-[#166534]" />
                        <h2 className="text-base font-bold text-slate-900">Account Plan & Billing</h2>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Manage your subscription, feature access and billing receipts</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border",
                        planTier === 'pro' 
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        {planTier === 'pro' ? 'Pro Account' : 'Free Tier'}
                      </span>
                      <Link 
                        to="/pricing"
                        className="bg-[#166534] hover:bg-green-800 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        {planTier === 'pro' ? 'View Plans' : 'Upgrade to Pro'}
                      </Link>
                    </div>
                  </section>

                  {/* Subscription History / Payment Receipts */}
                  {receipts && receipts.length > 0 && (
                    <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
                      <div className="border-b border-slate-100 pb-5 mb-4">
                        <h2 className="text-base font-bold text-slate-900">Subscription History & Receipts</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Download official GST tax receipts for your account upgrade</p>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {receipts.map((r) => (
                          <div key={r.id} className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold text-slate-900">{r.plan_name || 'InvoCentric Pro'} - ₹{r.amount_paid}</p>
                              <p className="text-[11px] text-slate-400 font-mono font-medium">Receipt #{r.receipt_number}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => downloadReceipt(r.id, r.receipt_number)}
                              disabled={downloadingReceiptId === r.id}
                              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Download size={13} />
                              <span>{downloadingReceiptId === r.id ? 'Downloading...' : 'PDF'}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Danger Zone */}
                  <section className="bg-white border border-red-200 rounded-2xl p-6 sm:p-8 shadow-xs">
                    <div className="border-b border-red-100 pb-5 mb-6">
                      <div className="flex items-center gap-2">
                        <Trash2 size={18} className="text-red-600" />
                        <h2 className="text-base font-bold text-red-600">Danger Zone</h2>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Irreversible actions on your account and data</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase">Delete Account & Permanent Wipe</h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Permanently delete your profile and all local & cloud data. This action cannot be reversed.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shrink-0 shadow-xs cursor-pointer"
                      >
                        Delete Account
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {/* Bottom Action Bar for Desktop/Mobile (Save & Reset) */}
              <div className="pt-4 flex items-center justify-between gap-4 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#166534] hover:bg-green-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* ========================================================================= */}
          {/* DESKTOP RIGHT SIDEBAR (Quick Links, Other Settings, Preferences, Help)     */}
          {/* Matches reference screenshot Image 1                                     */}
          {/* ========================================================================= */}
          <div className="hidden lg:block lg:col-span-4 space-y-6">
            
            {/* Widget 1: Quick Links */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Sparkles size={16} className="text-[#166534]" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Quick Links</h3>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Lock size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    Change Password
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Camera size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    Update Profile Picture
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    View Plan & Billing
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => alert("Two-Factor Authentication is active via Google / Secure Identity.")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Key size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    Two Factor Authentication
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LogOut size={14} className="text-rose-500" />
                    Logout Account
                  </span>
                  <ChevronRight size={14} className="text-rose-300" />
                </button>
              </div>
            </div>

            {/* Widget 2: Other Settings */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Settings size={16} className="text-[#166534]" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Other Settings</h3>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('company')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Store size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    Company Information
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tax')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    GST / Tax Settings
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('payment')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    Payment & QR Details
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('storage')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HardDrive size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    Backup & PC Drive
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('system')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-emerald-900 transition-colors text-xs font-bold text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Smartphone size={14} className="text-slate-400 group-hover:text-emerald-700" />
                    Software & Updates
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-700" />
                </button>
              </div>
            </div>

            {/* Widget 3: System Preferences */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Globe size={16} className="text-[#166534]" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">System Preferences</h3>
              </div>
              <div className="space-y-3.5 text-xs font-medium">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Language</label>
                  <select 
                    value={formData.language || 'English'}
                    onChange={(e) => setFormData(p => ({ ...p, language: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Timezone</label>
                  <select 
                    value={formData.timezone || 'Asia/Kolkata'}
                    onChange={(e) => setFormData(p => ({ ...p, timezone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GMT+4:00)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date Format</label>
                  <select 
                    value={formData.date_format || 'DD-MM-YYYY'}
                    onChange={(e) => setFormData(p => ({ ...p, date_format: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Currency</label>
                  <select 
                    value={formData.currency || 'INR'}
                    onChange={(e) => setFormData(p => ({ ...p, currency: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Widget 4: Need Help? */}
            <div className="bg-gradient-to-br from-emerald-50/70 via-slate-50 to-teal-50/50 border border-emerald-100 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-[#166534]">
                <HelpCircle size={18} />
                <h3 className="text-xs font-black uppercase tracking-wider">Need Help?</h3>
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
                For any issues, assistance or custom requirements, contact our support team anytime.
              </p>
              <a 
                href="mailto:support@invocentric.com" 
                className="text-xs font-bold text-[#166534] hover:text-green-800 flex items-center gap-1.5 transition-colors"
              >
                <span>Contact Support</span>
                <ChevronRight size={14} />
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
