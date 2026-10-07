import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { motion, AnimatePresence } from 'motion/react';
import { sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  AlertCircle, 
  Eye, 
  EyeOff, 
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Clock,
  X,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import { openInBrowser, cn } from '../lib/utils';
import { apiUrl } from '../utils/apiConfig';

// Official Google SVG Icon
const GoogleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// InvoCentric Official Brand Header Badge
const InvoCentricBrandBadge = () => (
  <div className="flex justify-center mb-5">
    <Logo size={52} className="shadow-xs hover:scale-105 transition-transform" />
  </div>
);

// Left Side Hero Section - Exactly matches user reference image
const AuthHeroOfferShowcase = () => {
  return (
    <div className="w-full flex flex-col justify-center select-none pr-0 lg:pr-8 xl:pr-12">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3 mb-10 lg:mb-14">
        <Link to="/" className="inline-flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Logo size={42} />
          <span className="font-extrabold text-2xl sm:text-3xl text-[#0d3b31] tracking-tight">
            InvoCentric
          </span>
        </Link>
      </div>

      {/* Main Headline */}
      <h1 className="text-3xl sm:text-4xl lg:text-[44px] xl:text-[48px] font-extrabold text-slate-900 tracking-tight leading-[1.18] mb-5">
        You’re <span className="text-[#0d3b31]">2 clicks</span> away from<br />
        smarter GST billing &amp;<br />
        effortless growth.
      </h1>

      {/* Subtitle */}
      <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-lg mb-8">
        Free up business hours while increasing daily profit, cashflow &amp; 100% tax compliance.
      </p>

      {/* Two Action Pills / Badges - Exact match from image */}
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="px-5 py-2.5 rounded-xl bg-[#0d3b31] text-white text-sm font-semibold shadow-xs transition-all select-none cursor-default">
          1-Month free trial Claim
        </div>
        <div className="px-5 py-2.5 rounded-xl bg-white border border-[#0d3b31] text-[#0d3b31] text-sm font-semibold shadow-xs transition-all select-none cursor-default">
          No credit card needed
        </div>
      </div>
    </div>
  );
};

interface LoginPageProps {
  defaultMode?: 'login' | 'signup' | 'forgot';
}

export default function LoginPage({ defaultMode }: LoginPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    signInWithGoogle, 
    loginWithPassword,
    registerWithPasswordAndOtp,
    resetPasswordWithOtp,
    user,
    loading: authLoading
  } = useAuth();
  
  const urlMode = searchParams.get('mode') as 'login' | 'signup' | 'forgot' | null;
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>(urlMode || defaultMode || 'login');
  
  useEffect(() => {
    if (urlMode) {
      setAuthMode(urlMode);
    } else if (defaultMode) {
      setAuthMode(defaultMode);
    }
  }, [urlMode, defaultMode]);

  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleAuthStep, setGoogleAuthStep] = useState<'idle' | 'selecting' | 'authorizing' | 'connected' | 'error'>('idle');
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  
  // Form states
  const [fullName, setFullName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP 6-Digit input boxes state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [handshakeCompleted, setHandshakeCompleted] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Focus the first OTP box when entering OTP mode
  useEffect(() => {
    if (otpSent) {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [otpSent]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const urlMobileAuth = searchParams.get('mobile_auth') === '1';
  const urlSessionId = searchParams.get('session');

  // Persist mobile auth session across Google redirects in mobile browsers
  if (urlMobileAuth && urlSessionId && typeof window !== 'undefined') {
    try {
      localStorage.setItem('invocentric_mobile_auth', '1');
      localStorage.setItem('invocentric_mobile_session', urlSessionId);
    } catch (_) {}
  }

  const storedMobileAuth = typeof window !== 'undefined' ? localStorage.getItem('invocentric_mobile_auth') === '1' : false;
  const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem('invocentric_mobile_session') : null;

  const isMobileAuth = urlMobileAuth || storedMobileAuth;
  const mobileSessionId = urlSessionId || storedSessionId;

  // Transmit authenticated user credentials to Android APK via server API, Firestore, and deep link
  const transmitHandshake = async (
    authenticatedUser: any,
    credentialIdToken?: string | null,
    accessToken?: string | null,
    targetSessionId?: string | null
  ) => {
    const activeSid = targetSessionId || mobileSessionId;
    if (!activeSid || handshakeCompleted) return;

    let firebaseToken = null;
    if (typeof authenticatedUser?.getIdToken === 'function') {
      try {
        firebaseToken = await authenticatedUser.getIdToken(true);
      } catch (tokenErr) {
        console.warn("Could not get fresh Firebase ID token:", tokenErr);
      }
    }

    const payload = {
      sessionId: activeSid,
      status: 'authenticated',
      idToken: credentialIdToken || firebaseToken || null,
      googleIdToken: credentialIdToken || null,
      googleAccessToken: accessToken || null,
      firebaseIdToken: firebaseToken || null,
      accessToken: accessToken || null,
      uid: authenticatedUser.uid,
      email: authenticatedUser.email || '',
      displayName: authenticatedUser.displayName || '',
      photoURL: authenticatedUser.photoURL || ''
    };

    try {
      await fetch(apiUrl('/api/auth/mobile-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (apiErr) {
      console.warn("Server API session post notice:", apiErr);
    }

    try {
      const sessionRef = doc(db, 'app_auth_sessions', activeSid);
      await setDoc(sessionRef, {
        ...payload,
        completedAt: Date.now()
      });
    } catch (fsErr) {
      console.warn("Firestore session auxiliary write notice:", fsErr);
    }

    try {
      localStorage.removeItem('invocentric_mobile_auth');
      localStorage.removeItem('invocentric_mobile_session');
    } catch (_) {}

    setHandshakeCompleted(true);
    setLoading(false);

    const effectiveIdToken = credentialIdToken || firebaseToken || '';
    const effectiveAccessToken = accessToken || '';

    const intentUrl = `intent://auth?session=${activeSid}&status=authenticated&idToken=${encodeURIComponent(effectiveIdToken)}&accessToken=${encodeURIComponent(effectiveAccessToken)}&uid=${encodeURIComponent(authenticatedUser.uid)}&email=${encodeURIComponent(authenticatedUser.email || '')}&displayName=${encodeURIComponent(authenticatedUser.displayName || '')}#Intent;scheme=invocentric;package=com.invocentric.app;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
    const schemeUrl = `invocentric://auth?session=${activeSid}&status=authenticated&idToken=${encodeURIComponent(effectiveIdToken)}&accessToken=${encodeURIComponent(effectiveAccessToken)}&uid=${encodeURIComponent(authenticatedUser.uid)}&email=${encodeURIComponent(authenticatedUser.email || '')}&displayName=${encodeURIComponent(authenticatedUser.displayName || '')}`;

    try {
      window.location.assign(intentUrl);
    } catch (_) {
      try {
        window.location.assign(schemeUrl);
      } catch (__) {}
    }
  };

  useEffect(() => {
    const activeSid = mobileSessionId || (typeof window !== 'undefined' ? localStorage.getItem('invocentric_mobile_session') : null);
    if (!activeSid) return;

    let isCancelled = false;

    getRedirectResult(auth).then(async (result) => {
      if (isCancelled) return;
      if (result?.user) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        await transmitHandshake(result.user, credential?.idToken, credential?.accessToken, activeSid);
      }
    }).catch(err => {
      console.warn("Mobile auth redirect handling:", err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (isCancelled || !u || handshakeCompleted) return;
      setTimeout(async () => {
        if (!isCancelled && !handshakeCompleted && auth.currentUser) {
          await transmitHandshake(auth.currentUser, null, null, activeSid);
        }
      }, 500);
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [mobileSessionId, handshakeCompleted]);

  const handleGoogleLogin = async () => {
    setGoogleModalOpen(true);
    setGoogleAuthStep('selecting');
    setGoogleAuthError(null);
    setLoading(true);
    setError(null);
    try {
      if (isMobileAuth && mobileSessionId) {
        try {
          localStorage.setItem('invocentric_mobile_auth', '1');
          localStorage.setItem('invocentric_mobile_session', mobileSessionId);
        } catch (_) {}

        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
          const result = await signInWithPopup(auth, provider);
          if (result?.user) {
            setGoogleAuthStep('authorizing');
            const credential = GoogleAuthProvider.credentialFromResult(result);
            await transmitHandshake(result.user, credential?.idToken, credential?.accessToken, mobileSessionId);
            setGoogleAuthStep('connected');
            setTimeout(() => {
              navigate('/dashboard');
            }, 600);
            return;
          }
        } catch (popupErr: any) {
          console.warn("Popup attempt notice:", popupErr?.code);
          await signInWithRedirect(auth, provider);
          return;
        }
        return;
      }

      await signInWithGoogle((step) => {
        if (step === 'initializing' || step === 'bottom_sheet') {
          setGoogleAuthStep('selecting');
        } else if (step === 'token_received' || step === 'verifying_server' || step === 'session_created') {
          setGoogleAuthStep('authorizing');
        } else if (step === 'access_granted') {
          setGoogleAuthStep('connected');
        }
      });
      setGoogleAuthStep('connected');
      setTimeout(() => {
        navigate('/dashboard');
      }, 600);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' || 
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('cancelled')
      ) {
        setGoogleModalOpen(false);
        setGoogleAuthStep('idle');
        return;
      }
      console.error("Google Login Error:", err);
      let message = err.message || "Failed to sign in with Google. Please try again.";
      if (err.code === 'auth/popup-blocked') {
        message = "Login popup was blocked by your browser. Please allow popups for this site and try again.";
      }
      setGoogleAuthStep('error');
      setGoogleAuthError(message);
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
      if (user) {
        await transmitHandshake(user);
      } else {
        await handleGoogleLogin();
      }
    } catch (err: any) {
      console.error("Authorize App Error:", err);
      setError(err.message || "Failed to authorize app.");
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
    if (cooldownSeconds > 0) return;
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
          setCooldownSeconds(60);
          setError("Too many password reset attempts. Please wait 1 minute before trying again.");
        } else {
          setError(err.message || "Unable to send password reset email. Please try again.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!passwordInput) {
      const generatedPass = `Inv@${Math.floor(100000 + Math.random() * 900000)}#Aa`;
      setPasswordInput(generatedPass);
    }

    setLoading(true);
    setError(null);
    setOtpToken(null);
    setOtpDigits(['', '', '', '', '', '']);

    try {
      const res = await fetch(apiUrl('/api/auth/send-email-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 || (data.error && data.error.toLowerCase().includes('wait'))) {
          setCooldownSeconds(data.retryAfter || 60);
        }
        throw new Error(data.error || 'Failed to send OTP');
      }
      
      setOtpSent(true);
      if (data.otpToken) {
        setOtpToken(data.otpToken);
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Too many requests') || err.message.toLowerCase().includes('wait'))) {
        setCooldownSeconds(prev => (prev > 0 ? prev : 60));
      }
      setError(err.message || "Unable to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle 6-digit OTP individual input boxes
  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputsRef.current[nextIdx]?.focus();
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    const code = otpDigits.join('');
    if (!code || code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await registerWithPasswordAndOtp(emailInput, passwordInput, code, otpToken || undefined);
      
      if (fullName.trim() && auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: fullName.trim() });
          const userDoc = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userDoc, { name: fullName.trim(), displayName: fullName.trim() }, { merge: true });
        } catch (_) {}
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Too many requests') || err.message.toLowerCase().includes('wait'))) {
        setCooldownSeconds(prev => (prev > 0 ? prev : 60));
      }
      setError(err.message || "Account creation failed. Please check the verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc] text-slate-900 font-sans"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(226, 232, 240, 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[380px] bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 text-center flex flex-col items-center"
        >
          <InvoCentricBrandBadge />
          <h2 className="text-xl font-bold text-slate-900 mb-1">Checking session...</h2>
          <p className="text-xs text-slate-500 max-w-xs mb-6">
            Connecting to your workspace.
          </p>
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  // Handle Chrome Mobile Handshake Success Screen (Web Chrome to APK)
  if (isMobileAuth && mobileSessionId && handshakeCompleted) {
    const intentUrl = `intent://auth?session=${mobileSessionId}&status=authenticated#Intent;scheme=invocentric;package=com.invocentric.app;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
    const schemeUrl = `invocentric://auth?session=${mobileSessionId}&status=authenticated`;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc] text-slate-900 font-sans"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(226, 232, 240, 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center"
        >
          <InvoCentricBrandBadge />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Login Successful!</h2>
          <p className="text-sm text-slate-600 mb-6">
            Your login has been confirmed. Tap below to switch back to the InvoCentric app.
          </p>
          <a
            href={intentUrl}
            onClick={() => {
              setTimeout(() => {
                try { window.location.href = schemeUrl; } catch (_) {}
              }, 300);
            }}
            className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-semibold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] mb-4 cursor-pointer"
          >
            <span>Open InvoCentric App (Return to App)</span>
          </a>
        </motion.div>
      </div>
    );
  }

  // Already logged in redirect
  if (!isMobileAuth && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Mobile Browser Handshake Sign-in
  if (isMobileAuth && mobileSessionId && user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc] text-slate-900 font-sans"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(226, 232, 240, 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center"
        >
          <InvoCentricBrandBadge />
          <h2 className="text-xl font-bold text-slate-900 mb-1">Connect to InvoCentric App</h2>
          <p className="text-xs text-slate-500 mb-6">
            Signed in as <strong className="text-slate-800">{user.email}</strong>. Tap below to send this login to your app.
          </p>
          <button
            onClick={handleAuthorizeApp}
            disabled={loading}
            className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mb-3 cursor-pointer"
          >
            {loading ? "Connecting..." : "Authorize App Login"}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 md:p-10 font-sans bg-[#f8fafc] text-slate-900 relative selection:bg-emerald-600 selection:text-white overflow-x-hidden"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(226, 232, 240, 0.5) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(226, 232, 240, 0.5) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}
    >
      {/* Ambient Animated Floating Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 35, -25, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.08, 0.96, 1],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-32 -left-24 w-[540px] h-[540px] bg-gradient-to-br from-emerald-100/60 via-teal-100/35 to-transparent rounded-full blur-3xl opacity-75"
        />
        <motion.div
          animate={{
            x: [0, -40, 25, 0],
            y: [0, 30, -25, 0],
            scale: [1, 1.1, 0.94, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-32 -right-24 w-[580px] h-[580px] bg-gradient-to-tl from-emerald-100/50 via-teal-100/30 to-transparent rounded-full blur-3xl opacity-70"
        />
        <motion.div
          animate={{
            x: [0, 25, -20, 0],
            y: [0, -20, 25, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-50/50 rounded-full blur-3xl opacity-60"
        />
      </div>

      <div className="w-full max-w-6xl mx-auto flex flex-col items-center relative z-10">
        {/* Mobile View: Brand Logo */}
        <div className="lg:hidden mb-6 flex items-center justify-center gap-2.5">
          <Link to="/" className="inline-flex items-center gap-2.5 hover:opacity-85 transition-opacity">
            <Logo size={36} />
            <span className="font-extrabold text-xl text-[#0d3b31] tracking-tight">InvoCentric</span>
          </Link>
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center justify-center">
          {/* LEFT SIDE: Hero Section (Desktop) */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-center">
            <AuthHeroOfferShowcase />
          </div>

          {/* RIGHT SIDE: MAIN AUTHENTICATION CARD */}
          <div className="w-full lg:col-span-5 flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full max-w-[400px] bg-white rounded-[26px] p-7 sm:p-9 border border-slate-200/90 shadow-xl shadow-slate-200/60 relative overflow-hidden"
            >
              {/* Top InvoCentric Official Brand Badge */}
              <InvoCentricBrandBadge />

          {/* SCREEN 1: CREATE AN ACCOUNT (Sign Up) */}
          {authMode === 'signup' && !otpSent && (
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight text-center mb-1">
                Create an account
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 text-center mb-6">
                Please enter your details to create an account.
              </p>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSendOtp} className="space-y-4">
                {/* Full Name Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all font-medium"
                  />
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter your Email"
                    required
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all font-medium"
                  />
                </div>

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={loading || cooldownSeconds > 0}
                  className="w-full h-11 mt-1 bg-[#181C24] hover:bg-black text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : cooldownSeconds > 0 ? (
                    <span>Please wait ({cooldownSeconds}s)</span>
                  ) : (
                    <span>Send email code</span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-5 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/80" />
                </div>
                <span className="relative px-3 bg-white text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  OR
                </span>
              </div>

              {/* Social Google Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full h-11 px-4 flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* Footer Switch */}
              <div className="mt-6 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(null); }}
                  className="font-semibold text-slate-900 underline hover:text-black cursor-pointer ml-1"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 2: CHECK YOUR EMAIL (OTP Verification) */}
          {authMode === 'signup' && otpSent && (
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight text-center mb-1">
                Check your email
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 text-center mb-6">
                Enter the code sent to <br />
                <span className="font-semibold text-slate-900">{emailInput}</span>
              </p>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleCompleteSignup} className="space-y-5">
                {/* 6 Individual Digit Boxes */}
                <div className="flex justify-between items-center gap-2 sm:gap-2.5">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpInputsRef.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className="w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all shadow-2xs"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6}
                  className="w-full h-11 bg-[#181C24] hover:bg-black text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Verify & Create Account</span>
                  )}
                </button>
              </form>

              {/* Spam notice & actions */}
              <div className="mt-5 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  Can't find the email? Check your spam folder.
                </p>

                <div className="flex items-center justify-center gap-3 text-xs pt-1">
                  {cooldownSeconds > 0 ? (
                    <span className="text-slate-400">
                      Resend code in {cooldownSeconds}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="font-semibold text-slate-800 hover:text-black underline cursor-pointer"
                    >
                      Resend code
                    </button>
                  )}
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setError(null); }}
                    className="text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Change email
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3: LOGIN */}
          {authMode === 'login' && (
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight text-center mb-1">
                Login
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 text-center mb-6">
                Enter your details to login.
              </p>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter your Email"
                    required
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all font-medium"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setError(null); }}
                      className="text-xs text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full h-11 pl-3.5 pr-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-1 bg-[#181C24] hover:bg-black text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Login</span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-5 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/80" />
                </div>
                <span className="relative px-3 bg-white text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  OR
                </span>
              </div>

              {/* Social Google Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full h-11 px-4 flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* Footer Switch */}
              <div className="mt-6 text-center text-xs text-slate-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setOtpSent(false); setError(null); }}
                  className="font-semibold text-slate-900 underline hover:text-black cursor-pointer ml-1"
                >
                  Sign up
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 4: FORGOT PASSWORD */}
          {authMode === 'forgot' && (
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight text-center mb-1">
                Reset your password
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 text-center mb-6">
                Enter your email to receive a password reset link.
              </p>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {!resetEmailSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Registered Email</label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Enter your Email"
                      required
                      className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || cooldownSeconds > 0}
                    className="w-full h-11 bg-[#181C24] hover:bg-black text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>Send reset link</span>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={26} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Check your inbox</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    We've emailed a password reset link to <strong className="text-slate-800">{emailInput}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Be sure to check your spam or junk folder if you don't see it within a minute.
                  </p>
                </div>
              )}

              <div className="mt-6 text-center text-xs">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setResetEmailSent(false); setError(null); }}
                  className="font-semibold text-slate-900 underline hover:text-black cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}

          {/* Terms of Service & Privacy Policy Notice inside the card */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500 leading-relaxed">
            By proceeding, you agree to InvoCentric's{' '}
            <Link to="/terms#terms" className="font-semibold text-slate-900 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/terms#privacy" className="font-semibold text-slate-900 hover:underline">
              Privacy Policy
            </Link>.
          </div>
        </motion.div>
      </div>

    </div>
  </div>

      {/* Floating Support Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsSupportOpen(true)}
          className="h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full shadow-md flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <HelpCircle size={15} className="text-emerald-600" />
          <span>Need Help?</span>
        </button>
      </div>

      {/* Support Modal */}
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
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 border border-slate-200 shadow-xl"
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
                <InvoCentricBrandBadge />
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
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 active:scale-[0.98] border border-slate-100 hover:border-emerald-200 rounded-xl transition-all cursor-pointer group"
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
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 active:scale-[0.98] border border-slate-100 hover:border-emerald-200 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-[#166534] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                      <ExternalLink size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 group-hover:text-[#166534] transition-colors">Email Support</p>
                      <p className="text-xs text-slate-500">support@invocentric.in</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-slate-400 group-hover:text-[#166534] transition-colors" />
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

      {/* Google In-App Modal / Bottom Sheet */}
      <AnimatePresence>
        {googleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-green-600" />

              <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-xs">
                    <GoogleIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-tight">Google Sign-In</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Secure Verification</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleModalOpen(false);
                    setGoogleAuthStep('idle');
                    setLoading(false);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-3 border-slate-200 border-t-emerald-600 animate-spin mb-4" />
                <h4 className="text-base font-bold text-slate-900 mb-1">Authenticating with Google...</h4>
                <p className="text-xs text-slate-500 max-w-xs mb-4">
                  Please select your Google account in the popup window.
                </p>
                {googleAuthError && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {googleAuthError}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
