import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { 
  isFileSystemApiSupported, 
  saveFileHandleToIndexedDB, 
  getFileHandleFromIndexedDB, 
  removeFileHandleFromIndexedDB, 
  verifyFilePermission, 
  writeAllDataToPcFile, 
  readAllDataFromPcFile, 
  applyDataToLocalCache,
  triggerPcFileSyncDebounced
} from '../utils/fileSystemDb';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  planStatus: string;
  planTier: 'free' | 'pro';
  isOfflineMode: boolean;
  loading: boolean;
  appMode: 'shop' | 'freelancer';
  setAppMode: (mode: 'shop' | 'freelancer') => Promise<void>;
  updatePlanTier: (tier: 'free' | 'pro', billing_cycle?: 'monthly' | 'yearly') => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  loginWithEmailOtp: (email: string) => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPasswordAndOtp: (email: string, password: string, otp: string) => Promise<void>;
  resetPasswordWithOtp: (email: string, password: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  setOfflineMode: (offline: boolean) => void;
  refreshUserData: () => Promise<void>;
  role: 'user' | 'owner';
  billingCycle: 'monthly' | 'yearly' | null;
  planRenewsAt: string | null;
  isPro: boolean;
  isOwner: boolean;
  activeLockedFeature: { name: string; benefits: string[] } | null;
  triggerUpgradeModal: (name: string, benefits: string[]) => void;
  closeUpgradeModal: () => void;
  subscriptionPending: boolean;
  subscriptionStatus: 'pending' | 'approved' | 'rejected' | null;
  subscriptionRequestRef: string | null;
  isPcDriveEnabled: boolean;
  isPcFileConnected: boolean;
  pcFileName: string;
  enablePcDriveMode: () => Promise<boolean>;
  disablePcDriveMode: () => Promise<void>;
  unlockPcDriveFile: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('email_otp_session');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return null;
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [planStatus, setPlanStatus] = useState<string>('active'); // Default to active for now
  const [planTier, setPlanTier] = useState<'free' | 'pro'>('free'); // Default to free plan
  const [role, setRole] = useState<'user' | 'owner'>('user');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | null>(null);
  const [planRenewsAt, setPlanRenewsAt] = useState<string | null>(null);
  const [activeLockedFeature, setActiveLockedFeature] = useState<{ name: string; benefits: string[] } | null>(null);
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [subscriptionRequestRef, setSubscriptionRequestRef] = useState<string | null>(null);

  const triggerUpgradeModal = (name: string, benefits: string[]) => {
    setActiveLockedFeature({ name, benefits });
  };

  const closeUpgradeModal = () => {
    setActiveLockedFeature(null);
  };
  const [appMode, setAppModeState] = useState<'shop' | 'freelancer'>(() => {
    return (localStorage.getItem('app_mode') as 'shop' | 'freelancer') || 'shop';
  });
  const [isOfflineModeState, setIsOfflineModeState] = useState<boolean>(() => {
    // Auto-clear quota limit flags after 12 hours to try reconnecting online
    const storedTimestamp = localStorage.getItem('firestore_quota_exceeded_timestamp');
    if (storedTimestamp) {
      const diff = Date.now() - Number(storedTimestamp);
      if (diff > 12 * 60 * 60 * 1000) { // 12 hours
        localStorage.removeItem('firestore_quota_exceeded');
        localStorage.removeItem('is_offline_mode');
        localStorage.removeItem('firestore_quota_exceeded_timestamp');
      }
    }
    return localStorage.getItem('is_offline_mode') === 'true';
  });
  const [isBrowserOffline, setIsBrowserOffline] = useState(!navigator.onLine);

  // PC Storage States
  const [isPcDriveEnabled, setIsPcDriveEnabled] = useState<boolean>(false);
  const [pcFileHandle, setPcFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [isPcFileConnected, setIsPcFileConnected] = useState<boolean>(false);
  const [pcFileName, setPcFileName] = useState<string>('');

  // Handle restoring file handle from IndexedDB on startup/user change
  useEffect(() => {
    if (!user) {
      setPcFileHandle(null);
      setIsPcFileConnected(false);
      setPcFileName('');
      setIsPcDriveEnabled(false);
      return;
    }

    const checkStoredHandle = async () => {
      const enabled = localStorage.getItem(`pc_drive_enabled_${user.uid}`) === 'true';
      setIsPcDriveEnabled(enabled);
      if (!enabled) return;

      try {
        const handle = await getFileHandleFromIndexedDB(user.uid);
        if (handle) {
          setPcFileHandle(handle);
          setPcFileName(handle.name);
          const isPermitted = await (handle as any).queryPermission({ mode: 'readwrite' }) === 'granted';
          setIsPcFileConnected(isPermitted);
          
          if (isPermitted) {
            const fileData = await readAllDataFromPcFile(handle);
            applyDataToLocalCache(user.uid, fileData);
          }
        }
      } catch (e) {
        console.warn("Error restoring PC file handle on startup:", e);
      }
    };

    checkStoredHandle();
  }, [user]);

  // Listen to write events in offline database to save changes to PC file automatically
  useEffect(() => {
    if (!user || !isPcDriveEnabled || !pcFileHandle || !isPcFileConnected) return;

    const handleLocalDbWrite = (e: any) => {
      const { key } = e.detail;
      if (key.includes(`_${user.uid}`)) {
        triggerPcFileSyncDebounced(user.uid, pcFileHandle);
      }
    };

    window.addEventListener('local_db_write', handleLocalDbWrite);
    return () => window.removeEventListener('local_db_write', handleLocalDbWrite);
  }, [user, isPcDriveEnabled, pcFileHandle, isPcFileConnected]);

  const enablePcDriveMode = async (): Promise<boolean> => {
    if (!user) return false;
    if (!isFileSystemApiSupported()) {
      alert("Your browser does not support local drive files. Please use Google Chrome or Microsoft Edge.");
      return false;
    }

    try {
      const options = {
        suggestedName: 'invocentric_db.json',
        startIn: 'desktop' as const,
        types: [{
          description: 'JSON Database File',
          accept: { 'application/json': ['.json'] },
        }],
      };
      const handle = await (window as any).showSaveFilePicker(options);
      
      const permitted = await verifyFilePermission(handle, true);
      if (!permitted) {
        alert("Write permission is required to enable PC Drive storage.");
        return false;
      }

      let fileData: any = {};
      try {
        const file = await handle.getFile();
        const text = await file.text();
        if (text.trim()) {
          fileData = JSON.parse(text);
        }
      } catch (e) {
        console.warn("Could not read initial file data:", e);
      }

      const hasExistingData = fileData && (
        fileData.invoices?.length || 
        fileData.customers?.length || 
        fileData.items?.length
      );

      setPcFileHandle(handle);
      setPcFileName(handle.name);
      setIsPcFileConnected(true);
      setIsPcDriveEnabled(true);
      localStorage.setItem(`pc_drive_enabled_${user.uid}`, 'true');
      localStorage.setItem(`pc_file_path_${user.uid}`, handle.name);
      await saveFileHandleToIndexedDB(user.uid, handle);

      if (hasExistingData) {
        applyDataToLocalCache(user.uid, fileData);
        alert(`Successfully connected to PC file: ${handle.name}! Loaded existing invoices, inventory, and customers from the file.`);
      } else {
        await writeAllDataToPcFile(user.uid, handle);
        alert(`Successfully enabled PC Drive Storage! Your database is now saved in real-time in: ${handle.name} on your hard drive.`);
      }

      setOfflineMode(true);
      return true;
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log("User cancelled file selection");
      } else {
        console.error("Failed to enable PC Drive storage:", e);
        alert("An error occurred: " + e.message);
      }
      return false;
    }
  };

  const disablePcDriveMode = async () => {
    if (!user) return;
    const confirmDisable = window.confirm("Are you sure you want to disconnect your PC Hard Drive Database? Your data will remain safe in the JSON file on your computer, but the app will stop writing updates to it.");
    if (!confirmDisable) return;

    try {
      await removeFileHandleFromIndexedDB(user.uid);
      setPcFileHandle(null);
      setPcFileName('');
      setIsPcFileConnected(false);
      setIsPcDriveEnabled(false);
      localStorage.removeItem(`pc_drive_enabled_${user.uid}`);
      alert("PC Hard Drive Database disconnected successfully.");
    } catch (e) {
      console.error("Error disconnecting PC database:", e);
    }
  };

  const unlockPcDriveFile = async (): Promise<boolean> => {
    if (!user || !pcFileHandle) return false;
    try {
      const permitted = await verifyFilePermission(pcFileHandle, true);
      if (permitted) {
        setIsPcFileConnected(true);
        const fileData = await readAllDataFromPcFile(pcFileHandle);
        applyDataToLocalCache(user.uid, fileData);
        return true;
      } else {
        alert("Permission denied. Could not connect to your PC database file.");
        return false;
      }
    } catch (e: any) {
      console.error("Failed to unlock file:", e);
      alert("Error unlocking file: " + e.message);
      return false;
    }
  };

  useEffect(() => {
    const syncOfflineMode = () => {
      const val = localStorage.getItem('is_offline_mode') === 'true';
      setIsOfflineModeState(val);
    };

    window.addEventListener('storage', syncOfflineMode);
    window.addEventListener('firestore-quota-exceeded', syncOfflineMode);

    return () => {
      window.removeEventListener('storage', syncOfflineMode);
      window.removeEventListener('firestore-quota-exceeded', syncOfflineMode);
    };
  }, []);

  const setAppMode = async (mode: 'shop' | 'freelancer') => {
    setAppModeState(mode);
    localStorage.setItem('app_mode', mode);
    if (auth.currentUser) {
      try {
        const profileKey = `user_profile_${auth.currentUser.uid}`;
        const cached = localStorage.getItem(profileKey);
        let data = cached ? JSON.parse(cached) : {};
        data.app_mode = mode;
        localStorage.setItem(profileKey, JSON.stringify(data));
        window.dispatchEvent(new StorageEvent('storage', { key: profileKey, newValue: JSON.stringify(data) }));
      } catch (err) {
        console.error("Error updating user mode locally:", err);
      }
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsBrowserOffline(false);
    const handleOffline = () => setIsBrowserOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOfflineMode = false;
  const isOwner = role === 'owner' || user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const isPro = planTier === 'pro' || isOwner;
  const [loading, setLoading] = useState(true);

  const setOfflineMode = (offline: boolean) => {
    setIsOfflineModeState(offline);
    localStorage.setItem('is_offline_mode', String(offline));
  };

  // Trigger automatic synchronization of offline data (Bypassed - Always local)
  useEffect(() => {
    // No-op to preserve interface. Business data is kept entirely local.
  }, [user]);

  const refreshUserData = async () => {
    if (!auth.currentUser) return;
    await handleUserChange(auth.currentUser);
  };

  useEffect(() => {
    // Safety timeout: if auth state doesn't resolve within 5 seconds, force loading to false
    // to prevent getting stuck on the page loader screen due to network hang or Firebase blockages.
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      console.warn("Auth state took too long to resolve; safety timeout triggered.");
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimeout);
      if (typeof window !== 'undefined' && localStorage.getItem('local_guest_session') === 'true') {
        setLoading(false);
        return;
      }
      console.log("Auth state change:", firebaseUser ? `User ID ${firebaseUser.uid.slice(0, 5)}...` : "No user");
      await handleUserChange(firebaseUser);
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    // When the user has internet and is not a guest account,
    // we always want to subscribe to real-time updates from Firestore to detect plan upgrades (like from Free to Pro) instantly.
    const isActuallyOffline = isOfflineMode && isBrowserOffline;
    if (isActuallyOffline) {
      const profile = getSecureStorage(`user_profile_${user.uid}`, null);
      if (profile) {
        if (profile?.plan_status) {
          setPlanStatus(profile.plan_status);
        }
        const isProOffline = profile?.plan_tier === 'pro' || profile?.plan === 'pro' || profile?.subscription_status === 'active';
        setPlanTier(isProOffline ? 'pro' : 'free');
        if (profile?.app_mode) {
          setAppModeState(profile.app_mode);
          localStorage.setItem('app_mode', profile.app_mode);
        }
        const isOwnerEmail = user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setRole(isOwnerEmail ? 'owner' : (profile?.role || 'user'));
        setBillingCycle(profile?.billing_cycle || profile?.billingCycle || null);
        setPlanRenewsAt(profile?.plan_renews_at || profile?.planRenewsAt || null);
        setSubscriptionPending(!!profile?.subscription_pending);
        setSubscriptionStatus(profile?.subscription_status || null);
        setSubscriptionRequestRef(profile?.subscription_request_ref || null);
        const isAdminEmail = user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setIsAdmin(isAdminEmail || !!profile?.is_admin);
      }
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Only force logout if we are explicitly online, to prevent offline sync mismatch from signing us out
        if (navigator.onLine) {
          console.log("Real-time profile deletion detected. Signing out user");
          signOut(auth);
          setUser(null);
          setIsAdmin(false);
        }
        return;
      }

      const profile = snapshot.data();
      // Cache in localStorage for offline fallback
      if (profile) {
        setSecureStorage(`user_profile_${user.uid}`, profile);
      }

      // Synchronize key state values in real-time
      if (profile?.plan_status) {
        setPlanStatus(profile.plan_status);
      }
      const isProRealtime = profile?.plan_tier === 'pro' || profile?.plan === 'pro' || profile?.subscription_status === 'active';
      setPlanTier(isProRealtime ? 'pro' : 'free');
      if (profile?.app_mode) {
        setAppModeState(profile.app_mode);
        localStorage.setItem('app_mode', profile.app_mode);
      }
      
      const isOwnerEmail = user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
      setRole(isOwnerEmail ? 'owner' : (profile?.role || 'user'));
      setBillingCycle(profile?.billing_cycle || profile?.billingCycle || null);
      setPlanRenewsAt(profile?.plan_renews_at || profile?.planRenewsAt || null);
      setSubscriptionPending(!!profile?.subscription_pending);
      setSubscriptionStatus(profile?.subscription_status || null);
      setSubscriptionRequestRef(profile?.subscription_request_ref || null);
      
      const isAdminEmail = user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
      setIsAdmin(isAdminEmail || !!profile?.is_admin);
    }, (error) => {
      console.error("Error listening to user profile in AuthContext:", error);
      try {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } catch (err) {
        console.warn("Handled profile listener error:", err);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, isOfflineMode, isBrowserOffline]);

  const handleUserChange = async (firebaseUser: User | null) => {
    console.log("Auth transition:", firebaseUser ? `User logged in [REDACTED]` : "No user");
    try {
      if (firebaseUser) {
        // Daily login check logic
        const today = new Date().toDateString();
        const lastCheck = localStorage.getItem('last_plan_check_date');
        
        // Fetch user profile from Firestore with safe offline fallback
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        let userDoc = null;
        let profile = null;
        const isOffline = !navigator.onLine;

        if (!isOffline) {
          try {
            // Fetch with a 2.5 seconds timeout to avoid hanging the entire app startup
            userDoc = await Promise.race([
              getDoc(userDocRef),
              new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), 2500))
            ]) as any;

            if (userDoc?.exists()) {
              profile = userDoc.data();
              // Cache the profile details in localStorage as a backup
              setSecureStorage(`user_profile_${firebaseUser.uid}`, profile);
            }
          } catch (err: any) {
            const errMessage = err instanceof Error ? err.message : String(err);
            if (errMessage.includes('timeout')) {
              console.log("Firestore login profile fetch timed out gracefully, using local cached profile.");
            } else {
              console.warn("Error fetching user doc on login:", errMessage);
            }
            if (errMessage.toLowerCase().includes('quota') || errMessage.toLowerCase().includes('resource-exhausted') || errMessage.toLowerCase().includes('resource_exhausted')) {
              localStorage.setItem('is_offline_mode', 'true');
              localStorage.setItem('firestore_quota_exceeded', 'true');
              localStorage.setItem('firestore_quota_exceeded_timestamp', String(Date.now()));
              window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', { detail: { error: errMessage } }));
            }
          }
        }

        // If fetch failed or we are offline and couldn't get from Firestore, load from backup
        if (!profile) {
          const cachedProfile = getSecureStorage(`user_profile_${firebaseUser.uid}`, null);
          if (cachedProfile) {
            profile = cachedProfile;
            console.log("Loaded fallback user profile from localStorage [REDACTED]");
          }
        }

        // Plan status logic
        if (profile?.plan_status) {
          setPlanStatus(profile.plan_status);
        } else {
          setPlanStatus('active'); // Initial trial
        }

        // Plan tier logic
        const isProLogin = profile?.plan_tier === 'pro' || profile?.plan === 'pro' || profile?.subscription_status === 'active';
        setPlanTier(isProLogin ? 'pro' : 'free');

        const isOwnerEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setRole(isOwnerEmail ? 'owner' : (profile?.role || 'user'));
        setBillingCycle(profile?.billing_cycle || profile?.billingCycle || null);
        setPlanRenewsAt(profile?.plan_renews_at || profile?.planRenewsAt || null);
        setSubscriptionPending(!!profile?.subscription_pending);
        setSubscriptionStatus(profile?.subscription_status || null);
        setSubscriptionRequestRef(profile?.subscription_request_ref || null);

        // Update last check date
        localStorage.setItem('last_plan_check_date', today);

        // Check for admin status - prioritize email for bootstrap admin
        const isAdminEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setIsAdmin(isAdminEmail || !!profile?.is_admin);

        // Sync profile details only when online
        if (!isOffline) {
          const profileData: any = {
            id: firebaseUser.uid,
            email: firebaseUser.email || null,
            display_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || null,
            photo_url: firebaseUser.photoURL || null,
            updated_at: serverTimestamp(),
            last_login_at: serverTimestamp(),
            last_active_at: serverTimestamp()
          };

          if (!userDoc?.exists() && !profile) {
            console.log("Creating brand new profile");
            profileData.is_admin = isAdminEmail;
            profileData.status = 'active';
            profileData.plan_status = 'active';
            profileData.plan_tier = 'free';
            profileData.plan = 'free';
            profileData.role = isAdminEmail ? 'owner' : 'user';
            profileData.billing_cycle = null;
            profileData.plan_renews_at = null;
            profileData.is_offline_mode = false;
            profileData.created_at = serverTimestamp();
            profileData.app_mode = appMode; // Default to local selected mode
            
            try {
              await Promise.race([
                setDoc(userDocRef, profileData),
                new Promise((_, reject) => setTimeout(() => reject(new Error("setDoc timeout")), 2500))
              ]);
              console.log("Profile created successfully");
              setSecureStorage(`user_profile_${firebaseUser.uid}`, profileData);
            } catch (insertErr: any) {
              const msg = insertErr?.message || String(insertErr);
              if (msg.includes('timeout')) {
                console.log("Profile creation timed out gracefully, continuing startup.");
              } else {
                console.warn("Failed to create user profile:", msg);
              }
            }
          } else {
            console.log("Syncing/updating profile for existing user");
            try {
              // Set local app mode if found in DB, otherwise write current local appMode to DB
              if (profile?.app_mode) {
                setAppModeState(profile.app_mode);
                localStorage.setItem('app_mode', profile.app_mode);
              } else {
                profileData.app_mode = appMode;
              }

              // If the existing user profile doesn't have a created_at field, add it!
              if (!profile?.created_at) {
                profileData.created_at = serverTimestamp();
              }
              // Merge true updates fields without overwriting user custom settings (like business_name, etc.)
              await Promise.race([
                setDoc(userDocRef, profileData, { merge: true }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("setDoc timeout")), 2500))
              ]);
              console.log("Profile updated/synced successfully on login");
            } catch (updateErr: any) {
              const msg = updateErr?.message || String(updateErr);
              if (msg.includes('timeout')) {
                console.log("Profile update timed out gracefully, continuing startup.");
              } else {
                console.warn("Failed to update user profile on login sync:", msg);
              }
            }
          }
        } else {
          console.log("Device is offline. Skipping Firestore profile sync, keeping current local state.");
          if (profile?.app_mode) {
            setAppModeState(profile.app_mode);
            localStorage.setItem('app_mode', profile.app_mode);
          }
        }

        setUser(firebaseUser);

        // Dispatch background Telegram alert for successful user login
        if (firebaseUser && !isOffline) {
          const sessionNotifiedKey = `login_telegram_notified_${firebaseUser.uid}`;
          if (!sessionStorage.getItem(sessionNotifiedKey)) {
            sessionStorage.setItem(sessionNotifiedKey, 'true');
            firebaseUser.getIdToken().then(token => {
              fetch('/api/notify-login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                }
              }).catch(err => console.warn("Login notification trigger failed (handled):", err));
            }).catch(err => console.warn("Failed to acquire user ID token for login alert (handled):", err));
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Critical error in auth session handling:", error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time presence heartbeat (Bypassed - Always local)
  useEffect(() => {
    // No-op: presence heartbeat disabled to comply with offline-only data requirement
  }, [user]);

  const updatePlanTier = async (tier: 'free' | 'pro', billing_cycle?: 'monthly' | 'yearly') => {
    setPlanTier(tier);
    const bCycle = billing_cycle || 'monthly';
    const status = tier === 'pro' ? 'active' : 'cancelled';
    
    let renewsAtISO: string | null = null;
    if (tier === 'pro') {
      const renewsAt = new Date();
      if (bCycle === 'yearly') {
        renewsAt.setFullYear(renewsAt.getFullYear() + 1);
      } else {
        renewsAt.setMonth(renewsAt.getMonth() + 1);
      }
      renewsAtISO = renewsAt.toISOString();
    }
    
    setPlanStatus(status);
    setBillingCycle(tier === 'pro' ? bCycle : null);
    setPlanRenewsAt(renewsAtISO);

    if (auth.currentUser) {
      const subData = {
        plan_tier: tier,
        plan: tier,
        plan_status: status,
        billing_cycle: tier === 'pro' ? bCycle : null,
        plan_renews_at: renewsAtISO
      };
      
      // Update local storage cache
      try {
        const profileKey = `user_profile_${auth.currentUser.uid}`;
        const cached = localStorage.getItem(profileKey);
        let data = cached ? JSON.parse(cached) : {};
        Object.assign(data, subData);
        localStorage.setItem(profileKey, JSON.stringify(data));
        window.dispatchEvent(new StorageEvent('storage', { key: profileKey, newValue: JSON.stringify(data) }));
      } catch (e) {
        console.error("Error updating local profile cache:", e);
      }

      // Persist to Firestore if online
      if (navigator.onLine) {
        try {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userDocRef, subData, { merge: true });
          console.log("Firestore plan updated from updatePlanTier");
        } catch (err) {
          console.error("Failed to update Firestore plan inside updatePlanTier:", err);
        }
      }
    }
  };

  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log("Redirect login successful");
      }
    }).catch((err) => {
      console.warn("Redirect result handle warning:", err);
    });
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log("Initiating Google Sign-In...");
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
        console.log("Popup login success");
      } catch (popupError: any) {
        console.warn("Popup login failed, attempting redirect login...", popupError);
        if (
          popupError.code === 'auth/popup-blocked' || 
          popupError.code === 'auth/popup-closed-by-user' || 
          popupError.code === 'auth/network-request-failed' || 
          popupError.code === 'auth/internal-error' || 
          popupError.message?.includes('Pending promise') ||
          popupError.message?.includes('network-request-failed')
        ) {
          await signInWithRedirect(auth, provider);
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing up with email:", error);
      throw error;
    }
  };

  const loginWithEmailOtp = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const verifiedUser: any = {
      uid: 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0],
      photoURL: null,
      emailVerified: true
    };
    localStorage.setItem('email_otp_session', JSON.stringify(verifiedUser));
    setUser(verifiedUser);
    handleUserChange(verifiedUser as any);
  };

  const loginWithPassword = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch('/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    
    // Standardize user object
    const userObj = {
      ...data.user,
      uid: data.user?.uid || ('user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')),
      email: cleanEmail
    };
    
    localStorage.setItem('email_otp_session', JSON.stringify(userObj));
    setUser(userObj);
    handleUserChange(userObj as any);
  };

  const registerWithPasswordAndOtp = async (email: string, password: string, otp: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch('/api/auth/register-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    
    const userObj = {
      ...data.user,
      uid: data.user?.uid || ('user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')),
      email: cleanEmail
    };

    localStorage.setItem('email_otp_session', JSON.stringify(userObj));
    setUser(userObj);
    handleUserChange(userObj as any);
  };

  const resetPasswordWithOtp = async (email: string, password: string, otp: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password reset failed');
    
    const userObj = {
      ...data.user,
      uid: data.user?.uid || ('user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')),
      email: cleanEmail
    };

    localStorage.setItem('email_otp_session', JSON.stringify(userObj));
    setUser(userObj);
    handleUserChange(userObj as any);
  };

  const logout = async () => {
    try {
      localStorage.removeItem('local_guest_session');
      localStorage.removeItem('email_otp_session');
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin, 
      planStatus,
      planTier,
      isOfflineMode,
      loading, 
      appMode,
      setAppMode,
      updatePlanTier,
      signInWithGoogle, 
      signInWithEmail,
      signUpWithEmail,
      loginWithEmailOtp,
      loginWithPassword,
      registerWithPasswordAndOtp,
      resetPasswordWithOtp,
      logout,
      setOfflineMode,
      refreshUserData,
      role,
      billingCycle,
      planRenewsAt,
      isPro,
      isOwner,
      activeLockedFeature,
      triggerUpgradeModal,
      closeUpgradeModal,
      subscriptionPending,
      subscriptionStatus,
      subscriptionRequestRef,
      isPcDriveEnabled,
      isPcFileConnected,
      pcFileName,
      enablePcDriveMode,
      disablePcDriveMode,
      unlockPcDriveFile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
