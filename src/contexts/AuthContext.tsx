import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { getStoredUserProfile, saveStoredUserProfile, mergeProfileData, sanitizeFirestorePayload } from '../utils/settingsStorage';
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
  sendPasswordResetEmail,
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
  const [user, setUser] = useState<User | null>(null);
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
    // Check if user was previously authenticated in local session to prevent premature loader dismiss
    const hadActiveSession = typeof window !== 'undefined' && localStorage.getItem('invocentric_auth_active') === 'true';

    // Safety timeout: if auth state doesn't resolve within timeout, force loading to false
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      console.warn("Auth state took too long to resolve; safety timeout triggered.");
    }, hadActiveSession ? 10000 : 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimeout);
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
        // DO NOT FORCE LOGOUT!
        // If snapshot does not exist, the user document in Firestore hasn't been created yet or is being initialized.
        // Create/sync the profile document safely in the background instead of signing out the authenticated user!
        console.log("Firestore user profile document not yet created. Ensuring default profile...");
        ensureUserProfileExists(user);
        return;
      }

      const profile = snapshot.data();
      // Check if user was explicitly banned by Admin
      if (profile?.status === 'banned') {
        console.warn("Account has been banned. Signing out.");
        alert("This account has been suspended by administration. Please contact support.");
        logout();
        return;
      }

      // Safely merge with persistent local cache so empty Firestore fields never wipe local data
      if (profile) {
        saveStoredUserProfile(user.uid, profile);
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

  const ensureUserProfileExists = async (firebaseUser: User) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const isOwnerEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
      const cached = getStoredUserProfile(firebaseUser.uid);
      
      const profileData: any = {
        id: firebaseUser.uid,
        email: firebaseUser.email || null,
        display_name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
        photo_url: firebaseUser.photoURL || null,
        is_admin: isOwnerEmail || !!cached?.is_admin,
        status: 'active',
        plan_status: cached?.plan_status || 'active',
        plan_tier: cached?.plan_tier || 'free',
        plan: cached?.plan || 'free',
        role: isOwnerEmail ? 'owner' : (cached?.role || 'user'),
        billing_cycle: cached?.billing_cycle || null,
        plan_renews_at: cached?.plan_renews_at || null,
        is_offline_mode: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        last_login_at: serverTimestamp(),
        last_active_at: serverTimestamp(),
        app_mode: cached?.app_mode || appMode || 'shop'
      };
      
      await setDoc(userDocRef, sanitizeFirestorePayload(profileData), { merge: true });
      saveStoredUserProfile(firebaseUser.uid, profileData);
      console.log("Profile ensured in Firestore successfully");
    } catch (err) {
      console.warn("Could not ensure profile in Firestore (safe fallback active):", err);
    }
  };

  const syncFirestoreProfileInBackground = async (firebaseUser: User, cachedProfile: any) => {
    if (!navigator.onLine) return;
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      let userDoc: any = null;
      try {
        userDoc = await Promise.race([
          getDoc(userDocRef),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), 3500))
        ]);
      } catch (err: any) {
        console.warn("Background user doc fetch notice:", err?.message || err);
      }

      const profile = userDoc?.exists() ? userDoc.data() : null;

      if (profile) {
        // Save to local storage
        saveStoredUserProfile(firebaseUser.uid, profile);

        if (profile.plan_status) setPlanStatus(profile.plan_status);
        const isPro = profile.plan_tier === 'pro' || profile.plan === 'pro' || profile.subscription_status === 'active';
        setPlanTier(isPro ? 'pro' : 'free');
        if (profile.app_mode) {
          setAppModeState(profile.app_mode);
          localStorage.setItem('app_mode', profile.app_mode);
        }
        const isOwnerEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setRole(isOwnerEmail ? 'owner' : (profile.role || 'user'));
        setBillingCycle(profile.billing_cycle || profile.billingCycle || null);
        setPlanRenewsAt(profile.plan_renews_at || profile.planRenewsAt || null);
        setSubscriptionPending(!!profile.subscription_pending);
        setSubscriptionStatus(profile.subscription_status || null);
        setSubscriptionRequestRef(profile.subscription_request_ref || null);
        const isAdminEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setIsAdmin(isAdminEmail || !!profile.is_admin);

        // Update last login timestamp without overwriting other data
        try {
          await setDoc(userDocRef, {
            last_login_at: serverTimestamp(),
            last_active_at: serverTimestamp(),
            updated_at: serverTimestamp()
          }, { merge: true });
        } catch (updateErr) {
          console.warn("Could not update last_login_at timestamp:", updateErr);
        }
      } else {
        // Profile does not exist in Firestore - create it safely!
        await ensureUserProfileExists(firebaseUser);
      }

      // Background Telegram login notification
      const sessionNotifiedKey = `login_telegram_notified_${firebaseUser.uid}`;
      if (!sessionStorage.getItem(sessionNotifiedKey)) {
        sessionStorage.setItem(sessionNotifiedKey, 'true');
        if (typeof (firebaseUser as any).getIdToken === 'function') {
          (firebaseUser as any).getIdToken().then((token: string) => {
            fetch('/api/notify-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            }).catch(err => console.warn("Login notification trigger notice:", err));
          }).catch((err: any) => console.warn("Acquire token for login alert notice:", err));
        } else {
          fetch('/api/notify-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: firebaseUser.email, uid: firebaseUser.uid })
          }).catch(err => console.warn("Login notification trigger notice:", err));
        }
      }
    } catch (err) {
      console.warn("Background profile sync notice:", err);
    }
  };

  const handleUserChange = async (firebaseUser: User | null) => {
    console.log("Auth transition:", firebaseUser ? `User logged in [REDACTED]` : "No user");
    try {
      if (firebaseUser) {
        // 1. Immediately store session marker in localStorage
        try {
          localStorage.setItem('invocentric_auth_active', 'true');
          localStorage.setItem('invocentric_last_uid', firebaseUser.uid);
          if (firebaseUser.email) {
            localStorage.setItem('invocentric_last_email', firebaseUser.email);
          }
        } catch (e) {}

        // 2. Set user immediately in state so PrivateRoute and HomeRoute know user is active!
        setUser(firebaseUser);

        // 3. Fast offline-first hydration from local storage (0ms - instantaneous)
        const cachedProfile = getStoredUserProfile(firebaseUser.uid);
        if (cachedProfile) {
          if (cachedProfile.plan_status) setPlanStatus(cachedProfile.plan_status);
          const isProOffline = cachedProfile.plan_tier === 'pro' || cachedProfile.plan === 'pro' || cachedProfile.subscription_status === 'active';
          setPlanTier(isProOffline ? 'pro' : 'free');
          if (cachedProfile.app_mode) {
            setAppModeState(cachedProfile.app_mode);
            localStorage.setItem('app_mode', cachedProfile.app_mode);
          }
          const isOwnerEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
          setRole(isOwnerEmail ? 'owner' : (cachedProfile.role || 'user'));
          setBillingCycle(cachedProfile.billing_cycle || cachedProfile.billingCycle || null);
          setPlanRenewsAt(cachedProfile.plan_renews_at || cachedProfile.planRenewsAt || null);
          setSubscriptionPending(!!cachedProfile.subscription_pending);
          setSubscriptionStatus(cachedProfile.subscription_status || null);
          setSubscriptionRequestRef(cachedProfile.subscription_request_ref || null);
          const isAdminEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
          setIsAdmin(isAdminEmail || !!cachedProfile.is_admin);
        } else {
          const isOwnerEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
          setRole(isOwnerEmail ? 'owner' : 'user');
          setIsAdmin(isOwnerEmail);
        }

        // 4. Release loading immediately so user sees their dashboard instantly without any 5-second hang
        setLoading(false);

        // 5. In background, sync with Firestore asynchronously without blocking user navigation
        syncFirestoreProfileInBackground(firebaseUser, cachedProfile);
      } else {
        try {
          localStorage.removeItem('invocentric_auth_active');
          localStorage.removeItem('invocentric_last_uid');
          localStorage.removeItem('invocentric_last_email');
        } catch (e) {}
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    } catch (error) {
      console.error("Critical error in auth session handling:", error);
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
    // Deprecated: Use loginWithPassword with Firebase Auth instead
    console.warn('loginWithEmailOtp is deprecated. Use loginWithPassword instead.');
  };

  const loginWithPassword = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password. Please check your credentials or use "Forgot password?" to reset.');
      } else if (code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later or reset your password.');
      } else if (code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Please contact support.');
      }
      throw error;
    }
  };

  const registerWithPasswordAndOtp = async (email: string, password: string, otp: string) => {
    // First verify OTP with backend
    const cleanEmail = email.trim().toLowerCase();
    const rawPass = password.trim();
    
    // Verify OTP
    const verifyRes = await fetch('/api/auth/verify-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: otp.trim() })
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(verifyData.error || 'Invalid verification code.');

    // Create Firebase Auth account
    try {
      await createUserWithEmailAndPassword(auth, cleanEmail, rawPass);
      // Firebase's onAuthStateChanged will fire and handleUserChange will set up the profile
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/email-already-in-use') {
        // Account exists - try to sign in with provided password
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, rawPass);
        } catch (signInErr: any) {
          throw new Error('This email is already registered. Please sign in or use "Forgot password?" if you forgot your password.');
        }
      } else if (code === 'auth/weak-password') {
        throw new Error('Password must be at least 6 characters long.');
      } else {
        throw error;
      }
    }
  };

  const resetPasswordWithOtp = async (email: string, password: string, otp: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Verify OTP first
    const verifyRes = await fetch('/api/auth/verify-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: otp.trim() })
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(verifyData.error || 'Invalid verification code.');

    // Send Firebase password reset email
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      // Also try to update password if user is signed in
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/user-not-found') {
        // User doesn't exist in Firebase yet - create account
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, password.trim());
        } catch (createErr: any) {
          if (createErr?.code === 'auth/email-already-in-use') {
            throw new Error('Account exists. Please sign in with Google or check your password.');
          }
          throw createErr;
        }
      } else {
        throw error;
      }
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('invocentric_auth_active');
      localStorage.removeItem('invocentric_last_uid');
      localStorage.removeItem('invocentric_last_email');
      localStorage.removeItem('local_guest_session');
      localStorage.removeItem('email_otp_session');
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      setRole('user');
      setPlanTier('free');
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
