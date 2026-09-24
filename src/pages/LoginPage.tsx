import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { motion, AnimatePresence } from 'motion/react';
import { sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Link, Navigate } from 'react-router-dom';
import { 
  AlertCircle, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ShieldCheck, 
  Globe, 
  HelpCircle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  X
} from 'lucide-react';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import { openInBrowser } from '../lib/utils';
import { apiUrl } from '../utils/apiConfig';

const InvoiceMockup = () => {
  return (
    <div className="relative w-full h-full rounded-[36px] overflow-hidden p-8 md:p-12 flex flex-col justify-center items-center bg-[#1A4B4B] text-white shadow-inner">
      {/* Decorative ambient glowing background circles */}
      <motion.div 
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-0 w-80 h-80 bg-emerald-400 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" 
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-0 left-0 w-96 h-96 bg-teal-300 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" 
      />

      {/* Floating Badge 1: Top Right */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-8 right-8 md:top-14 md:right-14 z-20 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 px-4 border border-white/20 shadow-2xl hidden md:flex items-center gap-3"
      >
        <div className="w-9 h-9 bg-emerald-500/30 border border-emerald-400/40 rounded-xl flex items-center justify-center text-emerald-300">
          <CheckCircle2 size={18} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest leading-none mb-1">New Entry</p>
          <p className="text-sm font-bold text-white tracking-tight">+₹24,500.00</p>
        </div>
      </motion.div>

      {/* Floating Badge 2: Bottom Left */}
      <motion.div
        animate={{ y: [0, 14, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        className="absolute bottom-10 left-8 md:bottom-16 md:left-12 z-20 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 px-4 border border-white/20 shadow-2xl hidden md:flex items-center gap-3"
      >
        <div className="w-9 h-9 bg-teal-500/30 border border-teal-400/40 rounded-xl flex items-center justify-center text-teal-300">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles size={18} />
          </motion.div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-teal-200 uppercase tracking-widest leading-none mb-1">Cloud Sync</p>
          <p className="text-sm font-bold text-white tracking-tight">Realtime Active</p>
        </div>
      </motion.div>

      {/* Main Invoice Card with 3D entry */}
      <motion.div
        initial={{ opacity: 0, y: 35, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm rounded-3xl shadow-2xl p-6 md:p-8 bg-white text-slate-900 border border-white/40"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <Logo size={46} className="mb-2" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Invoice #INV-2026-001</p>
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            Paid
          </span>
        </div>

        {/* Customer Info */}
        <div className="mb-5 pb-4 border-b border-slate-100">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Billed To</p>
          <p className="font-bold text-slate-900 text-sm">Enterprise Retailer Pvt Ltd</p>
          <p className="text-xs text-slate-500 font-mono">GSTIN: 27AABCV1234F1Z5</p>
        </div>

        {/* Line Items */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-50">
            <div>
              <p className="font-bold text-slate-900">GST Billing & POS Terminal</p>
              <p className="text-[11px] text-slate-400">Annual License (1 Node)</p>
            </div>
            <p className="font-bold text-slate-900">₹4,999.00</p>
          </div>
          <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-50">
            <div>
              <p className="font-bold text-slate-900">Automated WhatsApp Reminders</p>
              <p className="text-[11px] text-slate-400">Included Addon</p>
            </div>
            <p className="font-bold text-emerald-700">Free</p>
          </div>
        </div>

        {/* Total Section */}
        <div className="rounded-2xl p-4 flex justify-between items-center bg-slate-50 border border-slate-100">
          <div>
            <p className="text-xs font-bold text-slate-600">Total Net Amount</p>
            <p className="text-[10px] text-slate-400">Incl. 18% GST</p>
          </div>
          <p className="text-xl font-extrabold text-slate-950">₹5,898.82</p>
        </div>

        {/* Footer info / Signature */}
        <div className="mt-5 pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <CheckCircle2 size={13} /> Verified Digital Receipt
          </span>
          <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">AUTH#9842</span>
        </div>
      </motion.div>

      {/* Floating Trust Metrics */}
      <div className="mt-8 flex items-center gap-6 text-xs text-white/80 font-medium">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-300" />
          <span>256-bit SSL Encrypted</span>
        </div>
        <div className="w-1 h-1 bg-white/30 rounded-full" />
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-emerald-300" />
          <span>GST Ready & Compliant</span>
        </div>
      </div>
    </div>
  );
};

export default function LoginPage() {
  const { 
    signInWithGoogle, 
    loginWithPassword,
    registerWithPasswordAndOtp,
    resetPasswordWithOtp,
    user,
    loading: authLoading
  } = useAuth();
  
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Form states
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [handshakeCompleted, setHandshakeCompleted] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const isMobileAuth = searchParams.get('mobile_auth') === '1';
  const mobileSessionId = searchParams.get('session');
  const isNativeAndroid = typeof window !== 'undefined' && Boolean(
    (window as any).AndroidAppUpdater || 
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    (/android/i.test(navigator.userAgent) && (window as any).Capacitor)
  );

  useEffect(() => {
    if (!isMobileAuth || !mobileSessionId) return;

    let isCancelled = false;

    // Check if user just returned from Google Redirect
    getRedirectResult(auth).then(async (result) => {
      if (isCancelled) return;
      if (result?.user) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const idToken = credential?.idToken;
        const accessToken = credential?.accessToken;

        // 1. Post to Server-side session API (immune to Firestore permissions)
        try {
          await fetch(apiUrl('/api/auth/mobile-session'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: mobileSessionId,
              status: 'authenticated',
              idToken: idToken || null,
              accessToken: accessToken || null,
              uid: result.user.uid,
              email: result.user.email || '',
              displayName: result.user.displayName || '',
              photoURL: result.user.photoURL || ''
            })
          });
        } catch (e) {}

        // 2. Auxiliary Firestore write (safely caught)
        try {
          const sessionRef = doc(db, 'app_auth_sessions', mobileSessionId);
          await setDoc(sessionRef, {
            status: 'authenticated',
            idToken: idToken || null,
            accessToken: accessToken || null,
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            completedAt: Date.now()
          });
        } catch (e) {}

        setHandshakeCompleted(true);
        const deepLink = `invocentric://auth?session=${mobileSessionId}&idToken=${encodeURIComponent(idToken || '')}&accessToken=${encodeURIComponent(accessToken || '')}&uid=${encodeURIComponent(result.user.uid)}&email=${encodeURIComponent(result.user.email || '')}`;
        window.location.href = deepLink;
        return;
      }

      // If auto_google=1 is requested and not redirected yet:
      if (searchParams.get('auto_google') === '1' && !handshakeCompleted) {
        if (auth.currentUser) {
          // If already signed in in this browser session, transfer immediately!
          const currUser = auth.currentUser;
          const token = await currUser.getIdToken(true).catch(() => null);
          try {
            await fetch(apiUrl('/api/auth/mobile-session'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: mobileSessionId,
                status: 'authenticated',
                idToken: token || null,
                uid: currUser.uid,
                email: currUser.email || '',
                displayName: currUser.displayName || '',
                photoURL: currUser.photoURL || ''
              })
            });
          } catch (e) {}

          setHandshakeCompleted(true);
          const deepLink = `invocentric://auth?session=${mobileSessionId}&idToken=${encodeURIComponent(token || '')}&uid=${encodeURIComponent(currUser.uid)}&email=${encodeURIComponent(currUser.email || '')}`;
          window.location.href = deepLink;
          return;
        }

        // Direct Google Sign In redirect to trigger account chooser popup immediately
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        signInWithRedirect(auth, provider);
      }
    }).catch(err => {
      console.warn("Mobile auth redirect handling:", err);
    });

    return () => { isCancelled = true; };
  }, [isMobileAuth, mobileSessionId]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isMobileAuth && mobileSessionId) {
        // Authenticate in Chrome and bridge back to APK
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const idToken = credential?.idToken;
        const accessToken = credential?.accessToken;

        // 1. Post to Server-side session API (always allowed, no Firestore rules issues)
        try {
          await fetch(apiUrl('/api/auth/mobile-session'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: mobileSessionId,
              status: 'authenticated',
              idToken: idToken || null,
              accessToken: accessToken || null,
              uid: result.user.uid,
              email: result.user.email || '',
              displayName: result.user.displayName || '',
              photoURL: result.user.photoURL || ''
            })
          });
        } catch (apiErr) {
          console.warn("Server API session post notice:", apiErr);
        }

        // 2. Auxiliary Firestore write (safely caught)
        try {
          const sessionRef = doc(db, 'app_auth_sessions', mobileSessionId);
          await setDoc(sessionRef, {
            status: 'authenticated',
            idToken: idToken || null,
            accessToken: accessToken || null,
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            completedAt: Date.now()
          });
        } catch (fsErr) {
          console.warn("Firestore session auxiliary write notice:", fsErr);
        }

        setHandshakeCompleted(true);
        const deepLink = `invocentric://auth?session=${mobileSessionId}&idToken=${encodeURIComponent(idToken || '')}&accessToken=${encodeURIComponent(accessToken || '')}&uid=${encodeURIComponent(result.user.uid)}&email=${encodeURIComponent(result.user.email || '')}`;
        window.location.href = deepLink;
        return;
      }

      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google Login Error:", err);
      let message = err.message || "Failed to sign in with Google. Please try again.";
      if (err.code === 'auth/popup-blocked') {
        message = "Login popup was blocked by your browser. Please allow popups for this site and try again.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeApp = async () => {
    if (!mobileSessionId) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const idToken = credential?.idToken;
      const accessToken = credential?.accessToken;

      // 1. Post to Server-side session API
      try {
        await fetch(apiUrl('/api/auth/mobile-session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: mobileSessionId,
            status: 'authenticated',
            idToken: idToken || null,
            accessToken: accessToken || null,
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || ''
          })
        });
      } catch (apiErr) {
        console.warn("Server API session post notice:", apiErr);
      }

      // 2. Auxiliary Firestore write (safely caught)
      try {
        const sessionRef = doc(db, 'app_auth_sessions', mobileSessionId);
        await setDoc(sessionRef, {
          status: 'authenticated',
          idToken: idToken || null,
          accessToken: accessToken || null,
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || '',
          photoURL: result.user.photoURL || '',
          completedAt: Date.now()
        });
      } catch (fsErr) {
        console.warn("Firestore session write notice:", fsErr);
      }

      setHandshakeCompleted(true);
      const deepLink = `invocentric://auth?session=${mobileSessionId}&idToken=${encodeURIComponent(idToken || '')}&accessToken=${encodeURIComponent(accessToken || '')}&uid=${encodeURIComponent(result.user.uid)}&email=${encodeURIComponent(result.user.email || '')}`;
      window.location.href = deepLink;
    } catch (err: any) {
      console.warn("Popup error during app authorize, transferring existing user data:", err);
      if (user) {
        try {
          await fetch(apiUrl('/api/auth/mobile-session'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: mobileSessionId,
              status: 'authenticated',
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL || ''
            })
          });
        } catch (e) {}

        try {
          const sessionRef = doc(db, 'app_auth_sessions', mobileSessionId);
          await setDoc(sessionRef, {
            status: 'authenticated',
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            completedAt: Date.now()
          });
        } catch (fsIgnored) {}

        setHandshakeCompleted(true);
        const deepLink = `invocentric://auth?session=${mobileSessionId}&uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email || '')}`;
        window.location.href = deepLink;
      } else {
        setError(err.message || "Failed to authorize app.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setError("Please enter both your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loginWithPassword(emailInput, passwordInput);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setError("Please enter a valid email address.");
      return;
    }

    if (authMode === 'forgot') {
      setLoading(true);
      setError(null);
      try {
        await sendPasswordResetEmail(auth, emailInput.trim().toLowerCase());
        setResetEmailSent(true);
      } catch (err: any) {
        const code = err?.code || '';
        if (code === 'auth/user-not-found') {
          setError("No account found with this email address. Please check your email or Sign Up.");
        } else if (code === 'auth/invalid-email') {
          setError("Please enter a valid email address.");
        } else if (code === 'auth/too-many-requests') {
          setError("Too many password reset attempts. Please wait a few minutes before trying again.");
        } else {
          setError(err.message || "Unable to send password reset email. Please try again.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (authMode === 'signup') {
      if (!passwordInput || passwordInput.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        setError("Passwords do not match. Please re-enter.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setDevOtpNotice(null);
    setOtpToken(null);
    try {
      const res = await fetch(apiUrl('/api/auth/send-email-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      
      setOtpSent(true);
      if (data.otpToken) {
        setOtpToken(data.otpToken);
      }
      if (data.devOtp) {
        setDevOtpNotice(`Test Verification Code: ${data.devOtp}`);
      }
    } catch (err: any) {
      setError(err.message || "Unable to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await registerWithPasswordAndOtp(emailInput, passwordInput, otpCode, otpToken || undefined);
    } catch (err: any) {
      setError(err.message || "Account creation failed. Please check the verification code.");
    } finally {
      setLoading(false);
    }
  };

  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    if (!passwordInput || passwordInput.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPasswordWithOtp(emailInput, passwordInput, otpCode, otpToken || undefined);
      // If user already exists in Firebase, a password reset link was sent to their email
      setResetEmailSent(true);
    } catch (err: any) {
      setError(err.message || "Password reset failed. Please check the verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Wait for auth to resolve before deciding to redirect
  if (authLoading) {
    return null; // Let the global PageLoader handle this
  }

  // Handle Chrome Mobile Handshake Success Screen (Web Chrome)
  if (isMobileAuth && mobileSessionId && handshakeCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-900 font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Login Successful!</h2>
          <p className="text-sm text-slate-600 mb-6">
            Your login was successfully sent to the InvoCentric app on your phone.
          </p>
          <a
            href={`invocentric://auth?session=${mobileSessionId}`}
            className="w-full h-12 flex items-center justify-center gap-2 bg-[#0F645D] hover:bg-[#0c524c] text-white font-semibold rounded-xl shadow-md transition-all active:scale-[0.98] mb-3"
          >
            Open InvoCentric App
          </a>
          <p className="text-xs text-slate-400">
            You can now safely close this browser tab.
          </p>
        </motion.div>
      </div>
    );
  }

  // Handle already logged in in Chrome with mobile_auth=1
  if (isMobileAuth && mobileSessionId && user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-900 font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center"
        >
          <Logo size={54} className="mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-1">Connect to InvoCentric App</h2>
          <p className="text-xs text-slate-500 mb-6">
            You are currently signed in as <strong className="text-slate-800">{user.email}</strong>. Tap below to send this login to your app.
          </p>
          <button
            onClick={handleAuthorizeApp}
            disabled={loading}
            className="w-full h-12 flex items-center justify-center gap-2 bg-[#0F645D] hover:bg-[#0c524c] text-white font-semibold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mb-3"
          >
            {loading ? "Connecting..." : "Authorize App Login with Google"}
          </button>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-10 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            Switch Google Account
          </button>
        </motion.div>
      </div>
    );
  }

  // Handle auto_google redirection screen
  if (isMobileAuth && searchParams.get('auto_google') === '1' && !handshakeCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-900 font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center"
        >
          <Logo size={56} className="mx-auto mb-4" />
          <div className="w-10 h-10 border-3 border-[#0F645D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Opening Google Sign-In...</h2>
          <p className="text-xs text-slate-500 mb-6">
            Please choose your Google account to log into InvoCentric.
          </p>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-2 bg-[#0F645D] hover:bg-[#0c524c] text-white text-xs font-semibold rounded-xl shadow transition-all active:scale-95"
          >
            {loading ? "Connecting..." : "Tap here if account list didn't open"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex font-sans bg-slate-50 text-slate-900">
      {/* Left Column: Visual Showcase (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 p-6 lg:p-10">
        <InvoiceMockup />
      </div>

      {/* Right Column: Authentication Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-16">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl p-8 md:p-10 border border-slate-200/80 shadow-sm"
        >
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-5">
              <Link to="/" className="inline-block focus:outline-none">
                <Logo size={50} />
              </Link>

              {authMode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setOtpSent(false); setError(null); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
              ) : (
                <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setOtpSent(false); setError(null); }}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      authMode === 'login' 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setOtpSent(false); setError(null); }}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      authMode === 'signup' 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-950 tracking-tight">
              {authMode === 'login' && 'Sign in to InvoCentric'}
              {authMode === 'signup' && 'Create your account'}
              {authMode === 'forgot' && 'Reset your password'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {authMode === 'login' && 'Enter your account credentials to access your billing dashboard.'}
              {authMode === 'signup' && 'Set up your business profile and start generating GST invoices.'}
              {authMode === 'forgot' && 'Enter your registered email to receive a password reset code.'}
            </p>
          </div>

          {/* Social Google Login Button (Shown on Login & Signup) */}
          {authMode !== 'forgot' && (
            <div className="mb-6">
              {loading && isNativeAndroid && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 font-medium text-xs text-emerald-800">
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span>Connecting with Google...</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                type="button"
                className="w-full h-11 px-4 flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm text-slate-700 transition-colors shadow-sm active:scale-[0.99] disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative px-3 bg-white text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Or continue with email
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                key={error}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-5 p-3.5 rounded-xl border bg-rose-50 border-rose-200/80 text-rose-700 flex items-start gap-2.5 text-xs font-medium"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <p className="leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dev OTP helper */}
          {devOtpNotice && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
              <span>{devOtpNotice}</span>
            </div>
          )}

          {/* FORM 1: SIGN IN */}
          {authMode === 'login' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setError(null); }}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-950 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>Sign In to Dashboard</span>}
              </button>
            </form>
          )}

          {/* FORM 2: SIGN UP */}
          {authMode === 'signup' && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business Email Address</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Mail size={16} />
                      </span>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Set Password</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Lock size={16} />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Lock size={16} />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-950 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>Send Verification Code</span>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCompleteSignup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Enter 6-Digit Email Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full h-12 text-center tracking-[0.6em] text-lg font-bold bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all font-mono"
                      required
                    />
                    <p className="text-[11px] text-slate-500 text-center mt-2">Verification code sent to <span className="font-semibold text-slate-800">{emailInput}</span></p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>Verify & Create Account</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full text-xs font-medium text-slate-500 hover:text-slate-900 text-center py-1 cursor-pointer"
                  >
                    Edit Email / Resend Code
                  </button>
                </form>
              )}
            </div>
          )}

          {/* FORM 3: FORGOT PASSWORD */}
          {authMode === 'forgot' && (
            <div className="space-y-4">
              {!resetEmailSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Registered Email Address</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Mail size={16} />
                      </span>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-950 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>Send Password Reset Link</span>}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-4 py-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle2 size={30} className="text-emerald-600" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-900 text-lg">Check your Mail Box!</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      A password reset email has been sent to <span className="font-bold text-slate-900">{emailInput}</span>.
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Please open your email mailbox, click the link inside to set your new password, and then return here to log in.
                    </p>
                  </div>

                  {/* SPAM FOLDER ALERT BOX */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-xl text-left text-xs text-amber-900 space-y-1.5 shadow-2xs">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertCircle size={16} className="shrink-0 text-amber-600" />
                      <span>Check Spam / Junk Folder</span>
                    </div>
                    <p className="leading-relaxed text-amber-850 pl-5 text-[11.5px]">
                      If the email is not in your Inbox within 1-2 minutes, <strong>please check your Spam / Junk folder</strong>. Open the email and click <em>"Not Spam"</em> to access the password reset link.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setResetEmailSent(false); setError(null); }}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-950 text-white text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer mt-2"
                  >
                    Back to Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetEmailSent(false)}
                    className="w-full text-xs font-medium text-slate-500 hover:text-slate-900 text-center py-1 cursor-pointer"
                  >
                    Didn't receive email? Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Terms */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              By proceeding, you agree to InvoCentric's{' '}
              <Link to="/terms" className="font-semibold text-slate-800 hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link to="/terms" className="font-semibold text-slate-800 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Floating Support Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsSupportOpen(true)}
          className="h-11 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-full shadow-lg flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
        >
          <HelpCircle size={16} className="text-emerald-600" />
          <span>Need Help?</span>
        </button>
      </div>

      {/* Official Support Modal */}
      <AnimatePresence>
        {isSupportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSupportOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-6 border border-slate-200 shadow-xl"
            >
              <button 
                type="button"
                onClick={() => setIsSupportOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close support dialog"
              >
                <X size={16} />
              </button>

              <div className="text-center mb-5">
                <Logo size={52} className="mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900">InvoCentric Support</h3>
                <p className="text-xs text-slate-500 mt-0.5">Need help accessing your business account?</p>
              </div>

              <div className="space-y-2.5">
                <a 
                  href="https://wa.me/919824194869?text=Hello%20InvoCentric%20Support,%20I%20need%20help%20with%20my%20account"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    openInBrowser("https://wa.me/919824194869?text=Hello%20InvoCentric%20Support,%20I%20need%20help%20with%20my%20account");
                  }}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 active:scale-[0.98] border border-slate-100 hover:border-emerald-200 rounded-xl transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                      <WhatsAppIcon size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">WhatsApp Helpdesk</p>
                      <p className="text-xs text-slate-500">+91 98241 94869</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </a>

                <a 
                  href="mailto:support@invocentric.in?subject=InvoCentric%20Login%20Support%20Request"
                  onClick={(e) => {
                    e.preventDefault();
                    openInBrowser("mailto:support@invocentric.in?subject=InvoCentric%20Login%20Support%20Request");
                  }}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50 active:scale-[0.98] border border-slate-100 hover:border-blue-200 rounded-xl transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                      <Mail size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">Email Support</p>
                      <p className="text-xs text-slate-500">support@invocentric.in</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </a>

                <a 
                  href="https://invocentric.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    openInBrowser("https://invocentric.in");
                  }}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] border border-slate-100 hover:border-slate-300 rounded-xl transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                      <Globe size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 group-hover:text-slate-900 transition-colors">Official Portal</p>
                      <p className="text-xs text-slate-500">www.invocentric.in</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </a>
              </div>

              <button 
                type="button"
                onClick={() => setIsSupportOpen(false)}
                className="mt-5 w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

