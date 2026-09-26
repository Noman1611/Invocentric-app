import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { getStoredUserProfile, saveStoredUserProfile, mergeProfileData, sanitizeFirestorePayload, clearGlobalProfileBackup, sanitizeUserProfile } from '../utils/settingsStorage';
import { apiUrl } from '../utils/apiConfig';
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
  ConfirmationResult,
  signInWithCredential,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  onSnapshot,
  deleteDoc
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
  registerWithPasswordAndOtp: (email: string, password: string, otp: string, otpToken?: string) => Promise<void>;
  resetPasswordWithOtp: (email: string, password: string, otp: string, otpToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  setOfflineMode: (offline: boolean) => void;
  refreshUserData: () => Promise<void>;
  role: 'user' | 'owner';
  billingCycle: 'monthly' | 'yearly' | null;
  planRenewsAt: string | null;
  isPro: boolean;
  isOwner: boolean;
  isTrialActive: boolean;
  daysLeftInTrial: number;
  isTrialExpired: boolean;
  trialStartDate: string | null;
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
  freeTrialClaimed: boolean;
  freeTrialClaimedAt: string | null;
  claimFreeProTrial: () => Promise<{ success: boolean; message?: string; receiptNumber?: string }>;
}

export interface PlanEvaluationResult {
  effectiveTier: 'free' | 'pro';
  effectiveStatus: string;
  isExpired: boolean;
  daysRemaining: number;
  renewsAt: string | null;
  billingCycle: 'monthly' | 'yearly' | null;
  freeTrialClaimed: boolean;
  freeTrialClaimedAt: string | null;
}

export const evaluatePlanValidity = (
  profile: any,
  userEmail?: string | null
): PlanEvaluationResult => {
  const isOwnerEmail = userEmail?.toLowerCase() === 'nomanshaikh1999@gmail.com' || profile?.role === 'owner';
  if (isOwnerEmail) {
    return {
      effectiveTier: 'pro',
      effectiveStatus: 'active',
      isExpired: false,
      daysRemaining: 9999,
      renewsAt: null,
      billingCycle: 'yearly',
      freeTrialClaimed: true,
      freeTrialClaimedAt: null
    };
  }

  const rawTier = (profile?.plan_tier || profile?.plan || 'free') as 'free' | 'pro';
  const renewsAt = profile?.plan_renews_at || profile?.planRenewsAt || null;
  const billingCycle = profile?.billing_cycle || profile?.billingCycle || null;
  const freeTrialClaimed = !!(profile?.free_trial_claimed || profile?.freeTrialClaimed);
  const freeTrialClaimedAt = profile?.free_trial_claimed_at || profile?.freeTrialClaimedAt || null;

  if (rawTier === 'pro' || profile?.subscription_status === 'active') {
    if (renewsAt) {
      const expiryTime = new Date(renewsAt).getTime();
      const now = Date.now();
      if (!isNaN(expiryTime)) {
        if (now > expiryTime) {
          // EXPIRED! Cleanly downgrade to free tier
          return {
            effectiveTier: 'free',
            effectiveStatus: 'expired',
            isExpired: true,
            daysRemaining: 0,
            renewsAt,
            billingCycle,
            freeTrialClaimed,
            freeTrialClaimedAt
          };
        } else {
          // ACTIVE PRO
          const daysRemaining = Math.max(1, Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000)));
          return {
            effectiveTier: 'pro',
            effectiveStatus: 'active',
            isExpired: false,
            daysRemaining,
            renewsAt,
            billingCycle: billingCycle || 'monthly',
            freeTrialClaimed,
            freeTrialClaimedAt
          };
        }
      }
    }

    if (freeTrialClaimed && freeTrialClaimedAt) {
      const claimedTime = new Date(freeTrialClaimedAt).getTime();
      const expiryTime = claimedTime + 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (now > expiryTime) {
        return {
          effectiveTier: 'free',
          effectiveStatus: 'expired',
          isExpired: true,
          daysRemaining: 0,
          renewsAt: new Date(expiryTime).toISOString(),
          billingCycle,
          freeTrialClaimed,
          freeTrialClaimedAt
        };
      } else {
        const daysRemaining = Math.max(1, Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000)));
        return {
          effectiveTier: 'pro',
          effectiveStatus: 'active',
          isExpired: false,
          daysRemaining,
          renewsAt: new Date(expiryTime).toISOString(),
          billingCycle: 'monthly',
          freeTrialClaimed,
          freeTrialClaimedAt
        };
      }
    }

    // Pro with no valid renew date or corrupt data -> fallback to expired
    return {
      effectiveTier: 'free',
      effectiveStatus: 'expired',
      isExpired: true,
      daysRemaining: 0,
      renewsAt: null,
      billingCycle,
      freeTrialClaimed,
      freeTrialClaimedAt
    };
  }

  return {
    effectiveTier: 'free',
    effectiveStatus: profile?.plan_status || (profile?.subscription_status === 'expired' ? 'expired' : 'active'),
    isExpired: profile?.plan_status === 'expired' || profile?.subscription_status === 'expired',
    daysRemaining: 0,
    renewsAt,
    billingCycle,
    freeTrialClaimed,
    freeTrialClaimedAt
  };
};

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

  // Plan State & Free Trial Claim Tracking
  const [freeTrialClaimed, setFreeTrialClaimed] = useState<boolean>(false);
  const [freeTrialClaimedAt, setFreeTrialClaimedAt] = useState<string | null>(null);

  const applyPlanEvaluation = (evalResult: PlanEvaluationResult, userUid?: string) => {
    setPlanTier(evalResult.effectiveTier);
    setPlanStatus(evalResult.effectiveStatus);
    setPlanRenewsAt(evalResult.renewsAt);
    setBillingCycle(evalResult.billingCycle);
    setFreeTrialClaimed(evalResult.freeTrialClaimed);
    setFreeTrialClaimedAt(evalResult.freeTrialClaimedAt);

    // If plan was recorded as pro but has now cleanly expired, heal Firestore and local cache
    if (evalResult.isExpired && userUid && navigator.onLine) {
      const userDocRef = doc(db, 'users', userUid);
      setDoc(userDocRef, {
        plan: 'free',
        plan_tier: 'free',
        plan_status: 'expired',
        subscription_status: 'expired',
        updated_at: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
  };

  const isOwner = role === 'owner' || user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const isPro = planTier === 'pro' || isOwner;
  const daysLeftInTrial = (planTier === 'pro' && planRenewsAt)
    ? Math.max(0, Math.ceil((new Date(planRenewsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const isTrialActive = !isOwner && planTier === 'pro' && freeTrialClaimed && daysLeftInTrial > 0;
  const isTrialExpired = !isOwner && (planStatus === 'expired' || (freeTrialClaimed && planTier === 'free'));
  const trialStartDate = freeTrialClaimedAt;
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
        const planEval = evaluatePlanValidity(profile, user.email);
        applyPlanEvaluation(planEval, user.uid);
        if (profile?.app_mode) {
          setAppModeState(profile.app_mode);
          localStorage.setItem('app_mode', profile.app_mode);
        }
        const isOwnerEmail = user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setRole(isOwnerEmail ? 'owner' : (profile?.role === 'owner' ? 'user' : (profile?.role || 'user')));
        setSubscriptionPending(!!profile?.subscription_pending);
        setSubscriptionStatus(profile?.subscription_status || null);
        setSubscriptionRequestRef(profile?.subscription_request_ref || null);
        setIsAdmin(isOwnerEmail);
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
        const planEval = evaluatePlanValidity(profile, user.email);
        applyPlanEvaluation(planEval, user.uid);
      }

      if (profile?.app_mode) {
        setAppModeState(profile.app_mode);
        localStorage.setItem('app_mode', profile.app_mode);
      }
      
      const isOwnerEmail = user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
      setRole(isOwnerEmail ? 'owner' : (profile?.role === 'owner' ? 'user' : (profile?.role || 'user')));
      setSubscriptionPending(!!profile?.subscription_pending);
      setSubscriptionStatus(profile?.subscription_status || null);
      setSubscriptionRequestRef(profile?.subscription_request_ref || null);
      setIsAdmin(isOwnerEmail);

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
      const rawCached = getStoredUserProfile(firebaseUser.uid);
      const cached = sanitizeUserProfile(rawCached, firebaseUser.email, firebaseUser.displayName);
      
      const emailPrefix = firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User';
      const formattedDefaultName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      const safeDisplayName = (firebaseUser.displayName && !firebaseUser.displayName.toLowerCase().includes('noman') && !firebaseUser.displayName.toLowerCase().includes('shekh'))
        ? firebaseUser.displayName
        : (isOwnerEmail ? 'Shekh Mahammad Noman' : formattedDefaultName);

      const profileData: any = {
        id: firebaseUser.uid,
        email: firebaseUser.email || null,
        display_name: safeDisplayName,
        owner_name: isOwnerEmail ? 'Shekh Mahammad Noman' : safeDisplayName,
        photo_url: firebaseUser.photoURL || null,
        is_admin: isOwnerEmail,
        status: 'active',
        plan_status: cached?.plan_status || 'active',
        plan_tier: isOwnerEmail ? 'pro' : (cached?.plan_tier || 'free'),
        plan: isOwnerEmail ? 'pro' : (cached?.plan || 'free'),
        role: isOwnerEmail ? 'owner' : 'user',
        billing_cycle: cached?.billing_cycle || null,
        plan_renews_at: cached?.plan_renews_at || null,
        free_trial_claimed: cached?.free_trial_claimed || false,
        free_trial_claimed_at: cached?.free_trial_claimed_at || null,
        is_offline_mode: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        last_login_at: serverTimestamp(),
        last_active_at: serverTimestamp(),
        app_mode: cached?.app_mode || appMode || 'shop'
      };
      
      await setDoc(userDocRef, sanitizeFirestorePayload(profileData), { merge: true });
      saveStoredUserProfile(firebaseUser.uid, profileData, firebaseUser.email);
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
        saveStoredUserProfile(firebaseUser.uid, profile, firebaseUser.email);
        const planEval = evaluatePlanValidity(profile, firebaseUser.email);
        applyPlanEvaluation(planEval, firebaseUser.uid);

        if (profile.app_mode) {
          setAppModeState(profile.app_mode);
          localStorage.setItem('app_mode', profile.app_mode);
        }
        const isOwnerEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
        setRole(isOwnerEmail ? 'owner' : (profile.role === 'owner' ? 'user' : (profile.role || 'user')));
        setSubscriptionPending(!!profile.subscription_pending);
        setSubscriptionStatus(profile.subscription_status || null);
        setSubscriptionRequestRef(profile.subscription_request_ref || null);
        setIsAdmin(isOwnerEmail);

        // Self-Healing Sanitation for contaminated non-admin profiles
        if (!isOwnerEmail) {
          const rawOwner = String(profile.owner_name || '').toLowerCase();
          const rawBusiness = String(profile.business_name || '').toLowerCase();
          const rawPhone = String(profile.phone || '');
          const rawAddress = String(profile.address || '').toLowerCase();
          const rawUpi = String(profile.upi_id || '').toLowerCase();

          const isContaminated = 
            profile.is_admin ||
            profile.role === 'owner' ||
            rawOwner.includes('noman') ||
            rawOwner.includes('shekh') ||
            rawBusiness.includes('graphic designer') ||
            rawBusiness.includes('noman') ||
            rawBusiness.includes('invocentric main') ||
            rawPhone.includes('9824194869') ||
            rawAddress.includes('patan') ||
            rawUpi.includes('shekhnoman') ||
            rawUpi.includes('noman');

          if (isContaminated) {
            const emailPrefix = firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User';
            const defaultSafeName = firebaseUser.displayName || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
            const sanitizedFields = {
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
            };
            Object.assign(profile, sanitizedFields);
            saveStoredUserProfile(firebaseUser.uid, profile, firebaseUser.email);
            if (navigator.onLine) {
              setDoc(userDocRef, sanitizeFirestorePayload(sanitizedFields), { merge: true }).catch(() => {});
            }
          }
        }

        // Mark weekly Monday plan verification as completed since server sync was successful
        try {
          const now = new Date();
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(now.getFullYear(), now.getMonth(), diff);
          const currentMondayKey = monday.toISOString().split('T')[0];
          localStorage.setItem('last_plan_check_monday', currentMondayKey);
          localStorage.setItem('last_plan_check_date', now.toDateString());
        } catch (e) {}

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
            fetch(apiUrl('/api/notify-login'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            }).catch(err => console.warn("Login notification trigger notice:", err));
          }).catch((err: any) => console.warn("Acquire token for login alert notice:", err));
        } else {
          fetch(apiUrl('/api/notify-login'), {
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
          localStorage.setItem('invocentric_session_user', JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email || null,
            displayName: firebaseUser.displayName || null,
            photoURL: firebaseUser.photoURL || null,
            savedAt: Date.now()
          }));
          if (typeof (firebaseUser as any).getIdToken === 'function') {
            (firebaseUser as any).getIdToken().then((tok: string) => {
              if (tok) localStorage.setItem('invocentric_id_token', tok);
            }).catch(() => {});
          }
        } catch (e) {}

        // 2. Set user immediately in state so PrivateRoute and HomeRoute know user is active!
        setUser(firebaseUser);

        // 3. Fast offline-first hydration from local storage (0ms - instantaneous)
        const cachedProfile = getStoredUserProfile(firebaseUser.uid);
        if (cachedProfile) {
          const planEval = evaluatePlanValidity(cachedProfile, firebaseUser.email);
          applyPlanEvaluation(planEval, firebaseUser.uid);
          if (cachedProfile.app_mode) {
            setAppModeState(cachedProfile.app_mode);
            localStorage.setItem('app_mode', cachedProfile.app_mode);
          }
          const isOwnerEmail = firebaseUser.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
          setRole(isOwnerEmail ? 'owner' : (cachedProfile.role === 'owner' ? 'user' : (cachedProfile.role || 'user')));
          setSubscriptionPending(!!cachedProfile.subscription_pending);
          setSubscriptionStatus(cachedProfile.subscription_status || null);
          setSubscriptionRequestRef(cachedProfile.subscription_request_ref || null);
          setIsAdmin(isOwnerEmail);
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
        // If Firebase Auth returned null, check if we have an active saved session (e.g. mobile/electron session)
        if (typeof window !== 'undefined') {
          const savedSession = localStorage.getItem('invocentric_session_user');
          if (savedSession) {
            try {
              const parsed = JSON.parse(savedSession);
              if (parsed && parsed.uid) {
                console.log("Restoring active user from saved session:", parsed.uid);
                await applyExternalSessionUser(parsed);
                return;
              }
            } catch (sessErr) {
              console.warn("Failed to restore saved session user:", sessErr);
            }
          }
        }

        try {
          localStorage.removeItem('invocentric_auth_active');
          localStorage.removeItem('invocentric_last_uid');
          localStorage.removeItem('invocentric_last_email');
          localStorage.removeItem('invocentric_session_user');
          localStorage.removeItem('invocentric_id_token');
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

  const claimFreeProTrial = async (): Promise<{ success: boolean; message?: string; receiptNumber?: string }> => {
    if (!user) {
      return { success: false, message: "Please log in to claim your 1-month free Pro plan." };
    }
    if (isOwner) {
      return { success: false, message: "Admin/Owner account already has lifetime Pro access." };
    }
    if (freeTrialClaimed) {
      return { success: false, message: "1-Month Free Pro Trial has already been claimed for this account." };
    }

    let renewsAtISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let receiptNo = `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      let data: any = null;
      try {
        const idToken = await user.getIdToken(true);
        const response = await fetch(apiUrl('/api/subscription/claim-free-pro'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({})
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await response.json();
        }

        if (response.ok && data) {
          if (data.planRenewsAt) renewsAtISO = data.planRenewsAt;
          if (data.receiptNumber) receiptNo = data.receiptNumber;
        } else if (data?.error === 'ALREADY_CLAIMED') {
          return { success: false, message: data.message || "1-Month Free Pro Trial has already been claimed for this account." };
        } else {
          console.warn("Backend claim returned non-ok or non-json status, activating client-side Pro:", response.status, data);
        }
      } catch (backendFetchErr) {
        console.warn("Notice: Backend claim-free-pro call warning, proceeding with direct secure client activation:", backendFetchErr);
      }

      // 1. Update React state immediately
      setPlanTier('pro');
      setPlanStatus('active');
      setBillingCycle('monthly');
      setPlanRenewsAt(renewsAtISO);
      setFreeTrialClaimed(true);
      setFreeTrialClaimedAt(new Date().toISOString());

      // 2. Update Firestore user document
      if (navigator.onLine) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            plan: 'pro',
            plan_tier: 'pro',
            plan_status: 'active',
            billing_cycle: 'monthly',
            plan_renews_at: renewsAtISO,
            free_trial_claimed: true,
            free_trial_claimed_at: new Date().toISOString(),
            subscription_status: 'active',
            subscription_pending: false,
            updated_at: serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          console.warn("Client Firestore update notice:", fsErr);
        }
      }

      // 3. Update local storage cache
      const cached = getStoredUserProfile(user.uid) || {};
      const updatedProfile = {
        ...cached,
        plan: 'pro',
        plan_tier: 'pro',
        plan_status: 'active',
        billing_cycle: 'monthly',
        plan_renews_at: renewsAtISO,
        free_trial_claimed: true,
        free_trial_claimed_at: new Date().toISOString(),
        subscription_status: 'active',
        subscription_pending: false
      };
      saveStoredUserProfile(user.uid, updatedProfile, user.email);

      // 4. Log subscription payment record (amount: 0, 100% off promotional offer)
      await dbService.add('payments_subscription', {
        user_id: user.uid,
        user_email: user.email,
        amount: 0,
        billing_cycle: 'monthly',
        payment_method: 'promotional_offer',
        date: new Date().toISOString(),
        status: 'success',
        note: '1 Month Free Pro Promotional Claim'
      }, { offlineMode: isOfflineMode, userId: user.uid });

      // 5. Add subscription receipt invoice
      const invoiceNum = `PRO-CLAIM-${Date.now().toString(36).substring(3, 7).toUpperCase()}`;
      const expiryFormatted = new Date(renewsAtISO).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const invoicePayload = {
        invoice_number: invoiceNum,
        customer_name: 'InvoCentric Pro Free Promotion',
        customer_id: null,
        amount: 0,
        total: 0,
        currency: 'INR',
        bill_type: 'regular',
        discount: 199,
        sales_return: 0,
        columnVisibility: {
          size: false,
          hsn: false,
          mrp: false,
          discount: false,
          gstPercent: false
        },
        amount_words: 'ZERO RUPEES ONLY (100% DISCOUNT PROMOTIONAL OFFER)',
        status: 'paid',
        due_date: renewsAtISO,
        items: [
          {
            description: 'InvoCentric Pro Plan - 1 Month Free Access Offer (30 Days)',
            quantity: 1,
            price: 0
          }
        ],
        notes: `Congratulations! Your 1-Month Free InvoCentric Pro plan has been claimed successfully.\nOffer Ref: ${receiptNo}\nValid until: ${expiryFormatted}\nOfficial receipt has been delivered to your email.`,
        is_subscription_receipt: true
      };
      await dbService.add('invoices', invoicePayload, { offlineMode: isOfflineMode, userId: user.uid });

      // 6. Add congratulatory notification
      await dbService.add('notifications', {
        user_id: user.uid,
        text: `🎉 1 Month Free Pro Plan Claimed! You now have 30 days of full Pro access with AI billing, unlimited invoices, barcode scanner & reports until ${expiryFormatted}. Receipt #${receiptNo} was sent to ${user.email}.`,
        read: false,
        category: 'other',
        created_at: new Date().toISOString()
      }, { offlineMode: isOfflineMode, userId: user.uid });

      return { success: true, receiptNumber: receiptNo };
    } catch (err: any) {
      console.error("claimFreeProTrial error:", err);
      return { success: false, message: err.message || "Failed to claim free trial." };
    }
  };

  const applyExternalSessionUser = async (data: any) => {
    try {
      const token = data.idToken || data.token || (typeof window !== 'undefined' ? localStorage.getItem('invocentric_id_token') : '') || '';
      
      // Save session user persistently
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('invocentric_session_user', JSON.stringify({
            uid: data.uid,
            email: data.email || null,
            displayName: data.displayName || null,
            photoURL: data.photoURL || null,
            idToken: token,
            accessToken: data.accessToken || null,
            savedAt: Date.now()
          }));
          if (token) {
            localStorage.setItem('invocentric_id_token', token);
          }
          localStorage.setItem('invocentric_auth_active', 'true');
          localStorage.setItem('invocentric_last_uid', data.uid);
          if (data.email) {
            localStorage.setItem('invocentric_last_email', data.email);
          }
        } catch (e) {}
      }

      const syntheticUser = {
        uid: data.uid,
        email: data.email || null,
        displayName: data.displayName || (data.email ? data.email.split('@')[0] : 'User'),
        photoURL: data.photoURL || null,
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => token || (typeof window !== 'undefined' ? localStorage.getItem('invocentric_id_token') : '') || '',
        getIdTokenResult: async () => ({
          token: token || (typeof window !== 'undefined' ? localStorage.getItem('invocentric_id_token') : '') || '',
          claims: {},
          authTime: '',
          issuedAtTime: '',
          expirationTime: '',
          signInProvider: 'google.com'
        } as any),
        reload: async () => {},
        toJSON: () => ({ uid: data.uid, email: data.email })
      } as unknown as User;

      await handleUserChange(syntheticUser);
    } catch (e) {
      console.warn("Failed to apply synthetic session user:", e);
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

    // Global listener for deep link callbacks (invocentric://auth?session=...&idToken=...)
    const handleDeepLinkAuth = async (event: any) => {
      const urlStr = event?.detail?.url || '';
      if (!urlStr) return;
      if (urlStr.includes('invocentric://') || urlStr.includes('com.invocentric.app://')) {
        try {
          const dummy = new URL(
            urlStr
              .replace('invocentric://auth', 'http://localhost/auth')
              .replace('invocentric://', 'http://localhost/')
              .replace('com.invocentric.app://auth', 'http://localhost/auth')
              .replace('com.invocentric.app://', 'http://localhost/')
          );
          const sessionId = dummy.searchParams.get('session');
          const idToken = dummy.searchParams.get('idToken');
          const accessToken = dummy.searchParams.get('accessToken');
          const uid = dummy.searchParams.get('uid');
          const email = dummy.searchParams.get('email');
          const displayName = dummy.searchParams.get('displayName');

          if (idToken) {
            const cred = GoogleAuthProvider.credential(idToken, accessToken || undefined);
            await signInWithCredential(auth, cred);
          } else if (sessionId) {
            // Check server API first
            try {
              const res = await fetch(`https://invocentric.in/api/auth/mobile-session?session=${sessionId}`);
              if (res.ok) {
                const sData = await res.json();
                if (sData?.idToken) {
                  const cred = GoogleAuthProvider.credential(sData.idToken, sData.accessToken || undefined);
                  await signInWithCredential(auth, cred);
                  return;
                } else if (sData?.uid) {
                  await applyExternalSessionUser(sData);
                  return;
                }
              }
            } catch (apiErr) {
              console.warn("Server API session check notice:", apiErr);
            }

            // Fallback: Check Firestore document safely
            try {
              const snap = await getDoc(doc(db, 'app_auth_sessions', sessionId));
              if (snap.exists()) {
                const d = snap.data();
                if (d.idToken) {
                  const cred = GoogleAuthProvider.credential(d.idToken, d.accessToken || undefined);
                  await signInWithCredential(auth, cred);
                } else if (d.uid) {
                  await applyExternalSessionUser(d);
                }
                await deleteDoc(doc(db, 'app_auth_sessions', sessionId)).catch(() => {});
              }
            } catch (fsErr) {
              console.warn("Firestore session fallback notice:", fsErr);
            }
          } else if (uid) {
            await applyExternalSessionUser({ uid, email, displayName });
          }
        } catch (e) {
          console.warn("Error handling deep link auth event:", e);
        }
      }
    };

    window.addEventListener('app-deep-link', handleDeepLinkAuth);
    return () => window.removeEventListener('app-deep-link', handleDeepLinkAuth);
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log("Initiating Google Sign-In...");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI);
      const isNativeAndroid = typeof window !== 'undefined' && Boolean(
        (window as any).AndroidAppUpdater || 
        (window as any).AndroidGoogleAuth ||
        (window as any).Capacitor?.isNativePlatform?.() ||
        window.location.protocol === 'capacitor:' ||
        (/android/i.test(navigator.userAgent) && (window as any).Capacitor)
      );

      // --- NATIVE ANDROID GOOGLE SIGN-IN (Credential Manager with Seamless Chrome Handshake Fallback) ---
      if (isNativeAndroid) {
        console.log("Native Android detected. Invoking modern Android Credential Manager...");

        let authData: { idToken: string; email?: string; displayName?: string; photoUrl?: string } | null = null;

        // 1. Try Capacitor NativeGoogleAuth Plugin first (if available)
        try {
          const { registerPlugin } = await import('@capacitor/core');
          const NativeGoogleAuth = registerPlugin<any>('NativeGoogleAuth');
          if (NativeGoogleAuth && typeof NativeGoogleAuth.signIn === 'function') {
            const res = await NativeGoogleAuth.signIn({
              filterByAuthorizedAccounts: false,
              autoSelectEnabled: false
            });
            if (res?.idToken) {
              authData = res;
            }
          }
        } catch (capErr: any) {
          if (
            capErr?.code === 'USER_CANCELLED' || 
            capErr?.message?.includes('User cancelled') || 
            capErr?.message?.includes('cancelled')
          ) {
            console.log("User cancelled Google Sign-In account chooser.");
            return;
          }
          console.warn("Capacitor NativeGoogleAuth plugin notice:", capErr?.message || capErr);
        }

        // 2. Direct JavascriptInterface fallback (AndroidGoogleAuth)
        if (!authData && typeof window !== 'undefined') {
          const bridge = (window as any).AndroidGoogleAuth;
          if (bridge && typeof bridge.signIn === 'function') {
            try {
              authData = await new Promise((resolve, reject) => {
                const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                (window as any).__onNativeGoogleAuth = (cbId: string, err: any, data: any) => {
                  if (cbId !== callbackId) return;
                  delete (window as any).__onNativeGoogleAuth;
                  if (err) {
                    if (err.code === 'USER_CANCELLED' || err.message?.includes('cancelled')) {
                      resolve(null);
                    } else {
                      // Reject so catch block smoothly passes to Chrome handshake
                      reject(new Error(err.message || 'Credential Manager unavailable'));
                    }
                  } else {
                    resolve(data);
                  }
                };
                try {
                  bridge.signIn(JSON.stringify({ filterByAuthorizedAccounts: false, autoSelectEnabled: false }), callbackId);
                } catch (bridgeErr) {
                  delete (window as any).__onNativeGoogleAuth;
                  reject(bridgeErr);
                }
              });
            } catch (credErr: any) {
              console.warn("Credential Manager unconfigured or skipped, smoothly falling back to Chrome handshake:", credErr?.message);
            }
          }
        }

        // If native Credential Manager succeeded with valid ID Token:
        if (authData?.idToken) {
          console.log("Authenticating with Firebase using native Google ID Token...");
          const cred = GoogleAuthProvider.credential(authData.idToken);
          const userCredential = await signInWithCredential(auth, cred);
          console.log("Successfully signed in with Google account:", userCredential.user?.email);
          return;
        }

        // 3. Fallback: Seamless Chrome Custom Tabs / Browser Handshake
        // 100% reliable across all Android devices and versions without requiring google-services.json
        console.log("Launching seamless Chrome Custom Tab Google Authentication handshake...");
        const sessionId = 'mob_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const authUrl = `https://invocentric.in/login?mobile_auth=1&session=${sessionId}`;

        const updaterBridge = (window as any).AndroidAppUpdater;
        const googleAuthBridge = (window as any).AndroidGoogleAuth;
        if (updaterBridge?.openAuthCustomTab) {
          updaterBridge.openAuthCustomTab(authUrl);
        } else if (googleAuthBridge?.openAuthCustomTab) {
          googleAuthBridge.openAuthCustomTab(authUrl);
        } else if (updaterBridge?.openExternalUrl) {
          updaterBridge.openExternalUrl(authUrl);
        } else {
          window.open(authUrl, '_system');
        }

        await new Promise<void>((resolve, reject) => {
          let resolved = false;
          const cleanupFns: Array<() => void> = [];
          const sessionRef = doc(db, 'app_auth_sessions', sessionId);

          const cleanup = () => {
            cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
          };

          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              try { deleteDoc(sessionRef).catch(() => {}); } catch (e) {}
              reject(new Error("Login in Chrome timed out. Please try again."));
            }
          }, 5 * 60 * 1000);
          cleanupFns.push(() => clearTimeout(timer));

          const handleAuthPayload = async (data: any) => {
            if (resolved) return;
            resolved = true;
            cleanup();

            try {
              if (data.idToken) {
                const cred = GoogleAuthProvider.credential(data.idToken, data.accessToken || undefined);
                await signInWithCredential(auth, cred);
              } else if (data.uid) {
                await applyExternalSessionUser(data);
              }
              try { deleteDoc(sessionRef).catch(() => {}); } catch (e) {}
              resolve();
            } catch (err: any) {
              console.error("Failed to authenticate session in APK:", err);
              if (data.uid) {
                await applyExternalSessionUser(data);
                try { deleteDoc(sessionRef).catch(() => {}); } catch (e) {}
                resolve();
              } else {
                reject(err);
              }
            }
          };

          // 1. High-frequency Server API Polling
          const pollTimer = setInterval(async () => {
            if (resolved) return;
            try {
              const res = await fetch(`https://invocentric.in/api/auth/mobile-session?session=${sessionId}`);
              if (res.ok) {
                const sData = await res.json();
                if (sData?.status === 'authenticated') {
                  handleAuthPayload(sData);
                }
              }
            } catch (netErr) {}
          }, 1200);
          cleanupFns.push(() => clearInterval(pollTimer));

          // 2. Firestore real-time session listener
          try {
            const unsubSnapshot = onSnapshot(sessionRef, (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data?.status === 'authenticated') {
                  handleAuthPayload(data);
                }
              }
            }, (err) => {
              console.warn("Session snapshot listener notice:", err?.message);
            });
            cleanupFns.push(unsubSnapshot);
          } catch (listenerErr) {
            console.warn("Snapshot setup notice:", listenerErr);
          }

          // 3. Deep link listener for instant foreground callback
          const onDeepLink = (event: any) => {
            const urlStr = event?.detail?.url || '';
            if (urlStr.includes('session=') || urlStr.includes(sessionId)) {
              try {
                const dummy = new URL(
                  urlStr
                    .replace('invocentric://auth', 'http://localhost/auth')
                    .replace('invocentric://', 'http://localhost/')
                    .replace('com.invocentric.app://auth', 'http://localhost/auth')
                    .replace('com.invocentric.app://', 'http://localhost/')
                );
                const sId = dummy.searchParams.get('session');
                const idToken = dummy.searchParams.get('idToken');
                const accessToken = dummy.searchParams.get('accessToken');
                const uid = dummy.searchParams.get('uid');
                const email = dummy.searchParams.get('email');
                const displayName = dummy.searchParams.get('displayName');

                if (sId === sessionId || !sId) {
                  if (idToken || uid) {
                    handleAuthPayload({
                      idToken,
                      accessToken,
                      uid,
                      email: email || '',
                      displayName: displayName || ''
                    });
                  }
                }
              } catch (e) {
                console.warn("Deep link parse error:", e);
              }
            }
          };
          window.addEventListener('app-deep-link', onDeepLink);
          cleanupFns.push(() => window.removeEventListener('app-deep-link', onDeepLink));
        });
        return;
      }

      // Non-Android environments (Web / Desktop Electron)
      try {
        await signInWithPopup(auth, provider);
        console.log("Popup login success");
      } catch (popupError: any) {
        console.warn("Popup login failed:", popupError);

        // If user cancelled or manually closed popup, exit gracefully
        if (
          popupError.code === 'auth/popup-closed-by-user' ||
          popupError.code === 'auth/cancelled-popup-request'
        ) {
          return;
        }

        // On desktop software (Electron), never navigate the main application away
        if (isElectron) {
          throw popupError;
        }

        // On web if popup was blocked, fall back to redirect
        if (
          popupError.code === 'auth/popup-blocked' || 
          popupError.code === 'auth/operation-not-supported-in-this-environment' ||
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
      const cleanEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cred.user) {
        const rawPrefix = cleanEmail.split('@')[0];
        const formattedName = rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1);
        await updateProfile(cred.user, { displayName: formattedName }).catch(() => {});
      }
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

  const registerWithPasswordAndOtp = async (email: string, password: string, otp: string, otpToken?: string) => {
    // First verify OTP with backend
    const cleanEmail = email.trim().toLowerCase();
    const rawPass = password.trim();
    
    // Verify OTP
    const verifyRes = await fetch(apiUrl('/api/auth/verify-email-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: otp.trim(), otpToken })
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(verifyData.error || 'Invalid verification code.');

    // Create Firebase Auth account
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, rawPass);
      if (cred.user) {
        const rawPrefix = cleanEmail.split('@')[0];
        const formattedName = rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1);
        await updateProfile(cred.user, { displayName: formattedName }).catch(() => {});
      }
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

  const resetPasswordWithOtp = async (email: string, password: string, otp: string, otpToken?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Verify OTP first
    const verifyRes = await fetch(apiUrl('/api/auth/verify-email-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: otp.trim(), otpToken })
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
      localStorage.removeItem('invocentric_session_user');
      localStorage.removeItem('invocentric_id_token');
      localStorage.removeItem('local_guest_session');
      localStorage.removeItem('email_otp_session');
      clearGlobalProfileBackup();
      if (typeof window !== 'undefined') {
        try {
          const { registerPlugin } = await import('@capacitor/core');
          const NativeGoogleAuth = registerPlugin<any>('NativeGoogleAuth');
          if (NativeGoogleAuth?.signOut) {
            await NativeGoogleAuth.signOut().catch(() => {});
          }
        } catch (ignored) {}
        if ((window as any).AndroidGoogleAuth?.signOut) {
          try {
            (window as any).AndroidGoogleAuth.signOut('logout_cb');
          } catch (ignored) {}
        }
      }
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
      isTrialActive,
      daysLeftInTrial,
      isTrialExpired,
      trialStartDate,
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
      unlockPcDriveFile,
      freeTrialClaimed,
      freeTrialClaimedAt,
      claimFreeProTrial
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
