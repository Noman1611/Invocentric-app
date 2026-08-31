import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const _filename = typeof __filename !== "undefined"
  ? __filename
  : "";

const _dirname = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(_filename);

const loadFirebaseConfig = () => {
  const searchPaths = [
    path.resolve(_dirname, "../firebase-applet-config.json"),
    path.resolve(_dirname, "./firebase-applet-config.json"),
    path.resolve(_dirname, "firebase-applet-config.json"),
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    path.resolve(process.cwd(), "api/firebase-applet-config.json")
  ];

  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[Firebase Config] Successfully loaded config from: ${p}`);
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      }
    } catch (err) {
      // ignore and try next
    }
  }

  if (process.env.FIREBASE_CONFIG) {
    try {
      console.log("[Firebase Config] Attempting to load config from process.env.FIREBASE_CONFIG...");
      return JSON.parse(process.env.FIREBASE_CONFIG);
    } catch (err) {
      console.error("[Firebase Config] Failed to parse process.env.FIREBASE_CONFIG:", err);
    }
  }

  if (process.env.FIREBASE_PROJECT_ID) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || "ai-studio-35b3a03e-2ff1-43a1-8d12-3b65d45df63e",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    };
  }

  throw new Error("Could not find firebase-applet-config.json in any search path and no fallback environment variables are defined.");
};

const firebaseConfig = loadFirebaseConfig();

dotenv.config();

const isProd = process.env.NODE_ENV === "production" || process.env.VITE_PROD === "true";

// --- CRITICAL ENVIRONMENT VARIABLE VALIDATION ---
if (isProd && !process.env.GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is missing. AI features will fail gracefully.");
}

const app = express();
app.set("trust proxy", 1);

// --- AUTOMATIC HTTPS REDIRECTION IN PRODUCTION ---
app.use((req, res, next) => {
  if (isProd && req.headers["x-forwarded-proto"] && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// --- HTTP SECURITY (Helmet & CORS) ---
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://www.googletagmanager.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "https://*.google-analytics.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseapp.com", "https://*.cloudfunctions.net", "https://*.google-analytics.com"],
      frameAncestors: ["'none'"]
    }
  } : false,
  frameguard: isProd ? { action: 'deny' } : false, // Deny framing in production, allow in dev for AI Studio preview
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false, // Strict-Transport-Security: 1 year (31536000 seconds)
  crossOriginEmbedderPolicy: false,
}));

// Restrict CORS in production to specific frontend domains; allow localhost and preview servers
const allowedOrigins = [
  "https://invocentric.vercel.app",
  "https://invocentric.dev",
  "https://invocentric.in",
  "https://www.invocentric.in"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !isProd || allowedOrigins.includes(origin) || origin.startsWith("https://ais-dev-") || origin.startsWith("https://ais-pre-") || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
      callback(null, true);
    } else {
      callback(new Error("CORS: Not allowed by security policy. Access denied."));
    }
  },
  credentials: true
}));

// --- RATE LIMITING (Abuse Protection) ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
  },
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Dedicated strict rate limiter for authentication/email-sending endpoints (5 attempts/min per IP)
const authEmailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit 5 attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many action requests. Please wait 1 minute before trying again.' }
});

// --- SECURE AUTHENTICATION MIDDLEWARE ---
// Uses Firebase's secure userinfo token validation to verify active identity context
async function checkAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED: Missing or invalid authorization credentials." });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "UNAUTHORIZED: No access token provided." });
  }

  try {
    const apiKey = firebaseConfig.apiKey;
    if (!apiKey) {
      return res.status(500).json({ error: "SERVER_ERROR: Firebase API Key configuration missing." });
    }

    // Securely validate Firebase ID Token with Google ID Token validation API endpoint
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });

    if (!response.ok) {
      return res.status(401).json({ error: "UNAUTHORIZED: Session expired or invalid signature token." });
    }

    const result = await response.json();
    if (!result.users || result.users.length === 0) {
      return res.status(401).json({ error: "UNAUTHORIZED: Validated profile could not be resolved." });
    }

    // Bind authenticated identity securely to request state
    req.user = {
      uid: result.users[0].localId,
      email: result.users[0].email,
      emailVerified: result.users[0].emailVerified,
      idToken: token
    };

    next();
  } catch (error) {
    console.error("Token Auth Validation Error:", error);
    return res.status(500).json({ error: "SERVER_ERROR: Security token validation failed." });
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- STATIC CRAWLER SEO ACCESSIBILITY ROUTES ---
app.get("/robots.txt", (req, res) => {
  const robotsPath = path.resolve(_dirname, "../public/robots.txt");
  res.setHeader("Content-Type", "text/plain");
  res.sendFile(robotsPath);
});

app.get("/sitemap.xml", (req, res) => {
  const sitemapPath = path.resolve(_dirname, "../public/sitemap.xml");
  res.setHeader("Content-Type", "application/xml");
  res.sendFile(sitemapPath);
});

app.get("/manifest.webmanifest", (req, res) => {
  const manifestPath = path.resolve(_dirname, "../public/manifest.webmanifest");
  res.setHeader("Content-Type", "application/manifest+json");
  res.sendFile(manifestPath);
});

// Apply general rate limiter to API routes
app.use("/api/", apiLimiter);

// Helper function to generate safe unique correlation IDs for error tracking
function generateCorrelationId(): string {
  return "ERR-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// API Route for sending emails with rate limit and strict error containment (Protected by checkAuth)
app.post("/api/send-email", authEmailLimiter, checkAuth, async (req, res) => {
  const { to, subject, html, attachments } = req.body;

  // --- STRICT INPUT VALIDATION & SANITIZATION ---
  if (typeof to !== "string" || !to.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "A valid recipient email address is required." });
  }
  if (typeof subject !== "string" || !subject.trim() || subject.length > 250) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Subject must be a valid string under 250 characters." });
  }
  if (typeof html !== "string" || !html.trim() || html.length > 500000) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "HTML content must be a valid string under 500,000 characters." });
  }
  if (attachments && (!Array.isArray(attachments) || attachments.length > 10)) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Attachments must be an array with max 10 files." });
  }

  const result = await dispatchEmail({ to, subject, html, attachments });
  if (result.success) {
    res.status(200).json({ success: true });
  } else {
    res.status(500).json({ 
      success: false, 
      error: "SEND_FAILED",
      message: result.error || "Failed to dispatch email via SMTP."
    });
  }
});

// --- EMAIL OTP AUTHENTICATION (100% Free, No Billing Required) ---
const emailOtpStore = new Map<string, { otp: string; expires: number }>();

app.post("/api/auth/send-email-otp", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  // Valid for full 10 minutes (600,000 ms)
  emailOtpStore.set(email.trim().toLowerCase(), {
    otp,
    expires: Date.now() + 10 * 60 * 1000 
  });

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 500px; margin: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <h2 style="color: #15803d; text-align: center; margin-bottom: 8px;">InvoCentric</h2>
      <p style="text-align: center; color: #64748b; font-size: 14px; margin-bottom: 24px;">Free GST Billing & Invoice Maker</p>
      <p style="color: #334155; font-size: 15px;">Hello,</p>
      <p style="color: #334155; font-size: 15px;">Your one-time verification code is:</p>
      <div style="background: #f0fdf4; color: #15803d; font-size: 32px; font-weight: bold; text-align: center; padding: 16px; border-radius: 12px; letter-spacing: 6px; margin: 24px 0; border: 1px solid #bbf7d0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #64748b; text-align: center;">This code is valid for <strong>10 minutes</strong>. Do not share this with anyone.</p>
    </div>
  `;

  const result = await dispatchEmail({
    to: email.trim(),
    subject: `Your InvoCentric Verification Code: ${otp}`,
    html
  });

  if (result.success) {
    return res.json({ success: true, message: "OTP sent successfully to your email! Valid for 10 minutes." });
  } else {
    console.log(`[Development OTP Fallback] Email: ${email}, OTP: ${otp}`);
    return res.json({ 
      success: true, 
      message: "OTP generated successfully!", 
      devOtp: otp 
    });
  }
});

app.post("/api/auth/verify-email-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }

  const key = email.trim().toLowerCase();
  const record = emailOtpStore.get(key);

  if (!record || record.expires < Date.now()) {
    return res.status(400).json({ error: "OTP expired or invalid. Please request a new code." });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: "Incorrect verification code. Please try again." });
  }

  emailOtpStore.delete(key);
  return res.json({ success: true, email: key });
});

// --- EMAIL & PASSWORD + OTP AUTHENTICATION SYSTEM ---
const usersDbPath = path.resolve(process.cwd(), 'users_db.json');

function loadUsersDb(): Record<string, { email: string; passwordHash: string; name: string }> {
  try {
    if (fs.existsSync(usersDbPath)) {
      return JSON.parse(fs.readFileSync(usersDbPath, 'utf-8'));
    }
  } catch (e) {
    console.error("Error reading users db:", e);
  }
  return {};
}

function saveUsersDb(db: Record<string, { email: string; passwordHash: string; name: string }>) {
  try {
    fs.writeFileSync(usersDbPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing users db:", e);
  }
}

app.post("/api/auth/check-user", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  const db = loadUsersDb();
  const exists = !!db[email.trim().toLowerCase()];
  res.json({ exists });
});

app.post("/api/auth/register-password", async (req, res) => {
  const { email, password, otp } = req.body;
  if (!email || !password || !otp) {
    return res.status(400).json({ error: "Email, password, and OTP are required." });
  }

  const key = email.trim().toLowerCase();
  const record = emailOtpStore.get(key);

  if (!record || record.expires < Date.now()) {
    return res.status(400).json({ error: "OTP expired or invalid. Please request a new code." });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: "Incorrect verification code. Please try again." });
  }

  const db = loadUsersDb();
  db[key] = {
    email: key,
    passwordHash: String(password).trim(),
    name: key.split('@')[0]
  };
  saveUsersDb(db);
  emailOtpStore.delete(key);

  return res.json({ 
    success: true, 
    user: {
      uid: 'user_' + key.replace(/[^a-zA-Z0-9]/g, '_'),
      email: key,
      displayName: key.split('@')[0],
      emailVerified: true
    }
  });
});

app.post("/api/auth/login-password", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const key = email.trim().toLowerCase();
  const rawPass = String(password).trim();
  const db = loadUsersDb();
  const userRecord = db[key];

  if (!userRecord || userRecord.passwordHash !== rawPass) {
    return res.status(400).json({ error: "Invalid email or password. Click 'Forgot password?' to set or reset your password via OTP." });
  }

  return res.json({
    success: true,
    user: {
      uid: 'user_' + key.replace(/[^a-zA-Z0-9]/g, '_'),
      email: key,
      displayName: userRecord.name || key.split('@')[0],
      emailVerified: true
    }
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, password, otp } = req.body;
  if (!email || !password || !otp) {
    return res.status(400).json({ error: "Email, new password, and OTP are required." });
  }

  const key = email.trim().toLowerCase();
  const record = emailOtpStore.get(key);

  if (!record || record.expires < Date.now()) {
    return res.status(400).json({ error: "OTP expired or invalid. Please request a new code." });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: "Incorrect verification code. Please try again." });
  }

  const db = loadUsersDb();
  db[key] = {
    email: key,
    passwordHash: password,
    name: key.split('@')[0]
  };
  saveUsersDb(db);
  emailOtpStore.delete(key);

  return res.json({
    success: true,
    user: {
      uid: 'user_' + key.replace(/[^a-zA-Z0-9]/g, '_'),
      email: key,
      displayName: db[key].name,
      emailVerified: true
    }
  });
});

// --- GEMINI INVOICE EXTRACTION ENGINE ---
let aiClient: GoogleGenAI | null = null;

function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. AI features will not work.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function safeParseJson(jsonString: string) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    let cleaned = jsonString.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();
    }
    // Replace unescaped control characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
      if (match === '\n') return '\\n';
      if (match === '\r') return '\\r';
      if (match === '\t') return '\\t';
      return '';
    });
    return JSON.parse(cleaned);
  }
}
function isQuotaOrRateLimitError(error: any): boolean {
  const errMessage = (typeof error?.message === 'string' ? error.message : JSON.stringify(error || '')).toLowerCase();
  const errStatus = String(error?.status || error?.error?.status || "").toLowerCase();
  const errCode = String(error?.code || error?.status || error?.error?.code || "");
  
  return (
    errMessage.includes("resource_exhausted") ||
    errMessage.includes("quota exceeded") ||
    errMessage.includes("rate exceeded") ||
    errMessage.includes("rate limit") ||
    errMessage.includes("limit exceeded") ||
    errMessage.includes("429") ||
    errStatus.includes("resource_exhausted") ||
    errCode === "429"
  );
}

async function generateContentWithRetry(aiInstance: GoogleGenAI, params: any, maxRetries = 3) {
  let lastError: any = null;
  // Dynamic fallback hierarchy: requested model -> gemini-3.7-flash -> gemini-2.5-flash -> gemini-2.5-pro -> gemini-1.5-flash -> gemini-3.1-flash-lite
  const initialModel = params.model || "gemini-3.6-flash";
  const candidateModels = [initialModel, "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-2.5-pro", "gemini-1.5-flash"];
  const modelsToTry = Array.from(new Set(candidateModels));

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI Request] Attempting with model: ${model} (Attempt ${attempt}/${maxRetries})...`);
        const response = await aiInstance.models.generateContent({
          ...params,
          model: model
        });
        console.log(`[AI Request] Success with model: ${model}`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMessage = typeof err?.message === 'string' ? err.message : JSON.stringify(err || '');
        const errStatus = String(err?.status || err?.error?.status || "");
        const errCode = String(err?.code || err?.status || err?.error?.code || "");

        console.warn(`[AI Request] Attempt ${attempt} failed for model ${model}:`, errMessage);

        const lowerMessage = errMessage.toLowerCase();
        const lowerStatus = String(errStatus).toLowerCase();
        const isTransient = 
          lowerMessage.includes("503") || 
          lowerMessage.includes("unavailable") || 
          lowerMessage.includes("429") || 
          lowerMessage.includes("resource_exhausted") ||
          lowerMessage.includes("quota exceeded") ||
          lowerMessage.includes("rate exceeded") ||
          lowerMessage.includes("rate limit") ||
          lowerMessage.includes("limit exceeded") ||
          lowerMessage.includes("high demand") ||
          lowerStatus.includes("unavailable") ||
          lowerStatus.includes("resource_exhausted") ||
          errCode === "503" ||
          errCode === "429";

        if (isTransient) {
          if (attempt < maxRetries) {
            const delay = attempt * 1200 + Math.floor(Math.random() * 600);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // Move on to next model in hierarchy on persistent 503/429
            console.warn(`[AI Request] Model ${model} unavailable after ${maxRetries} attempts, attempting fallback model if available...`);
            break;
          }
        } else {
          // Non-transient error for this model, try fallback
          break;
        }
      }
    }
  }

  throw lastError;
}

// --- FIRESTORE USER DOCUMENT CHECKER ---
async function fetchUserDoc(uid: string, idToken?: string): Promise<any> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${uid}?key=${apiKey}`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Firestore REST returned ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("fetchUserDoc error:", error);
    return null;
  }
}

async function isUserPro(uid: string, email?: string, idToken?: string): Promise<boolean> {
  if (email && email.toLowerCase() === "nomanshaikh1999@gmail.com") {
    return true;
  }
  
  const userDoc = await fetchUserDoc(uid, idToken);
  if (!userDoc || !userDoc.fields) return false;
  
  const plan = userDoc.fields.plan?.stringValue;
  const role = userDoc.fields.role?.stringValue;
  
  if (plan === "pro" || role === "owner") {
    return true;
  }
  return false;
}

app.post("/api/extract-invoice", checkAuth, async (req, res) => {
  const { base64Image, mimeType } = req.body;

  // --- STRICT INPUT VALIDATION & SANITIZATION ---
  if (!base64Image || !mimeType) {
    return res.status(400).json({ error: "Missing base64Image or mimeType in request body." });
  }
  if (typeof base64Image !== "string" || typeof mimeType !== "string") {
    return res.status(400).json({ error: "INVALID_INPUT", message: "base64Image and mimeType must be valid strings." });
  }
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Unsupported file type. Only JPEG, PNG, WEBP, GIF, and PDF are supported." });
  }
  if (base64Image.length > 20000000) {
    return res.status(413).json({ error: "INVALID_INPUT", message: "File payload exceeds size limit (max 15MB)." });
  }

  try {
    // Backend billing guard
    const isPro = await isUserPro((req as any).user.uid, (req as any).user.email, (req as any).user.idToken);
    if (!isPro) {
      return res.status(403).json({ 
        error: "FORBIDDEN_LIMIT_REACHED", 
        message: "AI Scan is a Pro Plan feature. Please upgrade your plan." 
      });
    }

    const aiInstance = getAI();
    const prompt = "Extract complete invoice information from this purchase invoice or supplier bill image. Extract header fields (invoiceNo, invoiceDate, supplierBillNo, dueDate, supplierName, supplierGst, supplierPhone, supplierAddress), item table rows (description, hsn, barcode, batchNo, serialNo, quantity, rate, gstPercent, amount), and totals (subTotal, discount, taxableAmount, cgst, sgst, roundOff, totalAmount). Ensure the output is valid JSON.";

    const response = await generateContentWithRetry(aiInstance, {
      model: "gemini-3.6-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: prompt }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            supplierName: { type: Type.STRING },
            supplierGst: { type: Type.STRING },
            supplierPhone: { type: Type.STRING },
            supplierAddress: { type: Type.STRING },
            invoiceNo: { type: Type.STRING },
            invoiceDate: { type: Type.STRING },
            supplierBillNo: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            currency: { type: Type.STRING },
            subTotal: { type: Type.NUMBER },
            discount: { type: Type.NUMBER },
            taxableAmount: { type: Type.NUMBER },
            cgst: { type: Type.NUMBER },
            sgst: { type: Type.NUMBER },
            roundOff: { type: Type.NUMBER },
            totalAmount: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  hsn: { type: Type.STRING },
                  barcode: { type: Type.STRING },
                  batchNo: { type: Type.STRING },
                  serialNo: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  rate: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                  gstPercent: { type: Type.NUMBER },
                  amount: { type: Type.NUMBER }
                },
                required: ["description", "quantity"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from AI");
    }

    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (error: any) {
    const correlationId = generateCorrelationId();
    console.error(`[${correlationId}] AI Extraction Error server-side:`, error);
    if (isQuotaOrRateLimitError(error)) {
      return res.status(429).json({
        success: false,
        error: "QUOTA_EXCEEDED",
        message: "Your request hit Gemini API's rate limits or daily quota. Please wait a minute or try again later. For permanent high-volume access, consider attaching a custom billing key in the application settings.",
        correlationId: correlationId
      });
    }
    res.status(500).json({ 
      success: false, 
      error: "EXTRACTION_FAILED", 
      message: "Failed to extract invoice data. Please verify the image size or quality and try again.",
      correlationId: correlationId
    });
  }
});

app.post("/api/parse-contact", checkAuth, async (req, res) => {
  const { text } = req.body;
  
  // --- STRICT INPUT VALIDATION & SANITIZATION ---
  if (!text) {
    return res.status(400).json({ error: "Missing text in request body." });
  }
  if (typeof text !== "string" || text.length > 10000) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Text must be a valid string under 10,000 characters." });
  }

  try {
    const aiInstance = getAI();
    const prompt = "Extract contact information from this transcript. Return data for name, phone, company_name, email, address, and gst_number. Return empty strings for any missing fields.";

    const response = await generateContentWithRetry(aiInstance, {
      model: "gemini-3.6-flash",
      contents: [{
        role: "user",
        parts: [{ text: text + "\n\n" + prompt }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            phone: { type: Type.STRING },
            company_name: { type: Type.STRING },
            email: { type: Type.STRING },
            address: { type: Type.STRING },
            gst_number: { type: Type.STRING }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No data returned from AI");
    }

    const data = JSON.parse(resultText);
    res.status(200).json(data);
  } catch (error: any) {
    const correlationId = generateCorrelationId();
    console.error(`[${correlationId}] AI Parse Contact Error server-side:`, error);
    if (isQuotaOrRateLimitError(error)) {
      return res.status(429).json({
        success: false,
        error: "QUOTA_EXCEEDED",
        message: "Your request hit Gemini API's rate limits or daily quota. Please wait a minute or try again later. For permanent high-volume access, consider attaching a custom billing key in the application settings.",
        correlationId: correlationId
      });
    }
    res.status(500).json({ 
      success: false, 
      error: "PARSE_FAILED", 
      message: "Failed to parse contact data.",
      correlationId: correlationId
    });
  }
});

// --- TELEGRAM SECURE ADMIN NOTIFICATION ENGINE ---
const processedTelegramEvents = new Set<string>();

function markEventProcessed(eventId: string): boolean {
  if (processedTelegramEvents.has(eventId)) {
    return true; // Duplicate detected!
  }
  if (processedTelegramEvents.size > 2000) {
    const firstItem = processedTelegramEvents.values().next().value;
    if (firstItem) processedTelegramEvents.delete(firstItem);
  }
  processedTelegramEvents.add(eventId);
  return false;
}

async function sendTelegramAdminNotification(messageText: string, eventId?: string): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not configured in environment variables. Skipping Telegram notification.");
    return { success: false, error: "Telegram credentials missing" };
  }

  if (eventId && markEventProcessed(eventId)) {
    console.log(`[Telegram] Duplicate event ID detected (${eventId}). Skipping duplicate message.`);
    return { success: true };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const doRequest = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          disable_web_page_preview: true
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  try {
    let res = await doRequest();
    if (!res.ok) {
      console.warn(`[Telegram] First attempt returned status ${res.status}. Retrying in 1s...`);
      await new Promise(r => setTimeout(r, 1000));
      res = await doRequest();
    }

    if (res.ok) {
      console.log("[Telegram] Notification sent successfully to admin chat ID.");
      return { success: true };
    } else {
      const text = await res.text();
      console.error(`[Telegram] API error (HTTP ${res.status}):`, text);
      return { success: false, error: `Telegram HTTP ${res.status}` };
    }
  } catch (err: any) {
    console.error("[Telegram] Network exception while sending notification:", err.message || err);
    return { success: false, error: err.message || "Network error" };
  }
}

// --- USER LOGIN TELEGRAM NOTIFICATION ROUTE ---
app.post("/api/notify-login", authEmailLimiter, checkAuth, async (req, res) => {
  const user = (req as any).user;
  const userId = user.uid;
  const userEmail = user.email || "Unknown Email";
  const idToken = user.idToken;

  try {
    // Deduplicate rapid session calls within a 15-minute window for the same user
    const timeBucket = Math.floor(Date.now() / (15 * 60 * 1000));
    const eventId = `login_${userId}_${timeBucket}`;

    const userDoc = await fetchUserDoc(userId, idToken);
    const userName = userDoc?.fields?.display_name?.stringValue || userEmail.split('@')[0] || "User";

    const localDateAndTime = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    const telegramMessage = `🔐 NEW USER LOGIN\n\n👤 User: ${userName}\n📧 Email: ${userEmail}\n🕒 Login Time: ${localDateAndTime}`;

    // Dispatch Telegram notification safely in background
    const telegramResult = await sendTelegramAdminNotification(telegramMessage, eventId);

    res.status(200).json({
      success: true,
      telegram: telegramResult
    });
  } catch (error: any) {
    console.error("Login notification route error:", error);
    // Return 200 so login flow is never broken
    res.status(200).json({ success: false, error: error.message });
  }
});

// --- ADMIN NOTIFICATION DISPATCH ENGINE FOR PENDING UPI PAYMENTS ---
app.post("/api/subscription/notify-pending", authEmailLimiter, checkAuth, async (req, res) => {
  const { amount, billingCycle, upiId } = req.body;
  const user = (req as any).user;
  const userId = user.uid;
  const idToken = user.idToken;
  const userEmail = user.email || "Unknown Email";

  if (!amount || !billingCycle || !upiId) {
    return res.status(400).json({ error: "Missing subscription details." });
  }

  const adminEmail = "nomanshaikh1999@gmail.com";
  const notificationText = `🚨 *InvoCentric Alert* 🚨\n\nNew UPI Subscription payment submitted for verification!\n\nUser: ${userEmail}\nPlan Cycle: ${billingCycle.toUpperCase()}\nAmount: ₹${amount}\nUPI ID / UTR Ref No: ${upiId}\n\nPlease match this with your SBI Yono App/Account and approve/reject it in the Admin Panel.\n\nAdmin Panel: https://invocentric.in/admin`;

  const results = {
    email: false,
    whatsappCallMeBot: false,
    twilio: false,
    telegram: { success: false } as any,
    errors: [] as string[]
  };

  // 1. Dispatch Telegram Notification Alert
  try {
    const userDoc = await fetchUserDoc(userId, idToken);
    const userName = userDoc?.fields?.display_name?.stringValue || userEmail.split('@')[0] || "User";

    const localDateAndTime = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    const planName = billingCycle === "yearly" ? "InvoCentric Pro (Yearly)" : "InvoCentric Pro (Monthly)";

    const telegramMessage = `💳 NEW PRO PLAN PAYMENT REQUEST\n\n👤 User: ${userName}\n📧 Email: ${userEmail}\n📦 Plan: ${planName}\n💰 Amount: ₹${amount}\n🧾 Transaction ID: ${upiId}\n🕒 Submitted: ${localDateAndTime}\n📌 Status: Pending Admin Approval`;

    const eventId = `payment_${userId}_${upiId}`;
    results.telegram = await sendTelegramAdminNotification(telegramMessage, eventId);
  } catch (tgErr: any) {
    console.error("Failed to send Telegram admin notification:", tgErr);
    results.errors.push(`Telegram Error: ${tgErr.message || tgErr}`);
  }

  // 1. Send Email Notification via SMTP
  try {
    const emailRes = await dispatchEmail({
      to: adminEmail,
      subject: `🚨 ACTION REQUIRED: UPI Subscription Verification (₹${amount}) - Ref: ${upiId}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 40px;">🚨</span>
            <h2 style="font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.025em; color: #0f172a; margin-top: 12px; margin-bottom: 4px;">Pending UPI Verification</h2>
            <p style="font-size: 13px; color: #64748b; font-weight: 600; margin: 0;">InvoCentric Admin Alert Engine</p>
          </div>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">User Account:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; text-align: right;">${user.email}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Plan Cycle:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; text-align: right; text-transform: uppercase;">${billingCycle}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount Due:</td>
                <td style="padding: 8px 0; color: #10b981; font-weight: 800; text-align: right;">₹${amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">UTR / UPI ID Ref No:</td>
                <td style="padding: 8px 0; color: #166534; font-family: monospace; font-weight: 800; text-align: right; font-size: 14px;">${upiId}</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            Please open your <strong>State Bank of India (SBI)</strong> account or check your SMS transactions to verify if ₹${amount} was received matching transaction reference <strong>${upiId}</strong>.
          </p>
          
          <div style="text-align: center;">
            <a href="https://invocentric.in/admin" style="display: inline-block; background-color: #166534; color: #ffffff; padding: 12px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; text-transform: uppercase; text-decoration: none; letter-spacing: 0.05em; box-shadow: 0 4px 6px -1px rgba(22, 101, 52, 0.15);">Open Admin Panel</a>
          </div>
        </div>
      `
    });
    if (emailRes.success) {
      results.email = true;
    } else {
      results.errors.push(`Email Alert Error: ${emailRes.error}`);
    }
  } catch (err: any) {
    console.error("Failed to send admin alert email:", err);
    results.errors.push(`Email Error: ${err.message || err}`);
  }

  // 2. CallMeBot WhatsApp Integration (Free, personal developer gateway)
  const callMeBotKey = process.env.CALLMEBOT_WHATSAPP_API_KEY;
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (callMeBotKey && adminPhone) {
    try {
      const cleanPhone = adminPhone.replace(/\+/g, '').replace(/\s/g, '');
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(notificationText)}&apikey=${callMeBotKey}`;
      const response = await fetch(url);
      if (response.ok) {
        results.whatsappCallMeBot = true;
      } else {
        const text = await response.text();
        results.errors.push(`CallMeBot Error: status ${response.status}, ${text}`);
      }
    } catch (err: any) {
      console.error("Failed to send WhatsApp alert via CallMeBot:", err);
      results.errors.push(`CallMeBot Connection Error: ${err.message || err}`);
    }
  }

  // 3. Twilio SMS / WhatsApp Integration (Professional gateway)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  if (twilioSid && twilioAuthToken && twilioFrom && adminPhone) {
    try {
      const authHeader = Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
      const isWhatsApp = twilioFrom.startsWith('whatsapp:');
      const toPhone = isWhatsApp ? `whatsapp:${adminPhone}` : adminPhone;
      
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${authHeader}`
        },
        body: new URLSearchParams({
          To: toPhone,
          From: twilioFrom,
          Body: notificationText
        })
      });

      if (response.ok) {
        results.twilio = true;
      } else {
        const json = await response.json();
        results.errors.push(`Twilio Error: ${json.message || JSON.stringify(json)}`);
      }
    } catch (err: any) {
      console.error("Failed to send Twilio notification:", err);
      results.errors.push(`Twilio API Error: ${err.message || err}`);
    }
  }

  res.status(200).json({ success: true, results });
});

// --- AUTOMATIC PAYMENT RECEIPT GENERATION & EMAIL DELIVERY ON SUBSCRIPTION APPROVAL ---
app.post("/api/subscription/approve-receipt", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  if ((req as any).user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }

  const { userId, userEmail, amount, billingCycle, upiIdRef } = req.body;

  if (!userId || !userEmail || !amount || !billingCycle || !upiIdRef) {
    return res.status(400).json({ error: "Missing required approval details." });
  }

  try {
    const idToken = (req as any).user.idToken;
    // 1. Fetch user displayName from Firestore
    const userDoc = await fetchUserDoc(userId, idToken);
    const userName = userDoc?.fields?.display_name?.stringValue || userEmail.split('@')[0];

    // 2. Generate Unique Receipt Number (INV-YYYY-NNNNNN format)
    const receiptNo = `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateStr = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    // 3. Generate PDF Buffer via jsPDF
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Draw header accent band
    doc.setFillColor(22, 101, 52); // #166534
    doc.rect(0, 0, 210, 8, "F");

    // InvoCentric logo and subtitle
    doc.setTextColor(22, 101, 52);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(26);
    doc.text("InvoCentric", 15, 25);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("Helvetica", "normal");
    doc.text("Professional Billing & Invoicing Made Simple", 15, 31);

    // Document Title
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text("PAYMENT RECEIPT", 135, 25);

    // Intro Line
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Thank you for subscribing to InvoCentric. Below is your official payment receipt.", 15, 42);

    // Grid details (Requirement 2 - exactly 10 fields, in order, NO GST/tax fields)
    const receiptFields = [
      { label: "Receipt No.", value: receiptNo },
      { label: "Customer Name", value: userName },
      { label: "Customer Email", value: userEmail },
      { label: "Order / Reference No.", value: upiIdRef },
      { label: "Subscription Plan", value: `InvoCentric Pro Account (${billingCycle === "monthly" ? "Monthly" : "Yearly"})` },
      { label: "Payment Type", value: "Subscription Renewal" },
      { label: "Payment Date & Time", value: dateStr },
      { label: "Payment Mode", value: "UPI" },
      { label: "UPI Reference / UTR No.", value: upiIdRef },
      { label: "Paid Amount", value: `INR ${Number(amount).toFixed(2)}` }
    ];

    // Draw fields in a beautiful dual-column key-value table
    let currentY = 48;
    
    // Draw table top border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(15, currentY, 195, currentY);

    receiptFields.forEach((field, i) => {
      const rowY = currentY + (i * 10);
      
      // Draw alternating backgrounds
      if (field.label === "Paid Amount") {
        // Highlighted green background for Paid Amount
        doc.setFillColor(220, 252, 231);
        doc.rect(15, rowY, 180, 10, "F");
      } else if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, rowY, 180, 10, "F");
      }

      // Draw Row Borders
      doc.setDrawColor(241, 245, 249);
      doc.line(15, rowY + 10, 195, rowY + 10);

      // Render Label
      doc.setFontSize(9.5);
      doc.setFont("Helvetica", "bold");
      if (field.label === "Paid Amount") {
        doc.setTextColor(21, 128, 61); // Green-700
      } else {
        doc.setTextColor(71, 85, 105); // Slate-600
      }
      doc.text(field.label, 18, rowY + 6.5);

      // Render Value
      doc.setFont("Helvetica", field.label === "Paid Amount" ? "bold" : "normal");
      if (field.label === "Paid Amount") {
        doc.setFontSize(11);
        doc.setTextColor(21, 128, 61); // Green-700
      } else {
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Slate-900
      }
      doc.text(String(field.value), 80, rowY + 6.5);
    });

    // Draw table side vertical lines to frame it
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY, 15, currentY + 100);
    doc.line(195, currentY, 195, currentY + 100);
    doc.line(15, currentY + 100, 195, currentY + 100);

    // Terms & Conditions section (Requirement 2 - 4 short points)
    const termsY = currentY + 112;
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Terms and Conditions:", 15, termsY);

    const points = [
      "1. Receipt confirms successful payment towards mentioned plan.",
      "2. Subscription benefits activate within a few minutes of approval.",
      "3. This is system-generated, no signature required.",
      "4. Unauthorized use/copying of receipt is prohibited."
    ];

    doc.setFontSize(8.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    points.forEach((point, idx) => {
      doc.text(point, 15, termsY + 6 + (idx * 5.5));
    });

    // Discrepancy Contact line (Requirement 2 - placeholder phone and support email)
    const contactY = termsY + 34;
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const contactText = "For any discrepancies, support inquiries, or billing issues, please contact our support team at support@invocentric.in or call +91 9824194869.";
    doc.text(contactText, 15, contactY, { maxWidth: 180 });

    // Footer Disclaimer (Requirement 2 - small, centered footer disclaimer)
    const footerY = 265;
    doc.setDrawColor(241, 245, 249);
    doc.line(15, footerY - 5, 195, footerY - 5);

    doc.setFontSize(7.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    
    const disclaimerText = "This is a system-generated receipt and does not require a signature. Any unauthorized use, disclosure, dissemination or copying of this receipt is strictly prohibited and may be unlawful.";
    doc.text(disclaimerText, 105, footerY, { align: "center", maxWidth: 170 });

    const arrayBuffer = doc.output("arraybuffer");
    const pdfBuffer = Buffer.from(arrayBuffer);
    const pdfBase64 = pdfBuffer.toString("base64");

    // 4. Save metadata and pdf_base64 to subscription_receipts inside Firestore using REST
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    const apiKey = firebaseConfig.apiKey;
    const fsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/subscription_receipts?key=${apiKey}`;

    const receiptPayload = {
      fields: {
        receipt_number: { stringValue: receiptNo },
        user_id: { stringValue: userId },
        user_email: { stringValue: userEmail },
        user_name: { stringValue: userName },
        amount: { doubleValue: Number(amount) },
        billing_cycle: { stringValue: billingCycle },
        payment_method: { stringValue: "upi" },
        upi_id_ref: { stringValue: upiIdRef },
        pdf_base64: { stringValue: pdfBase64 },
        created_at: { stringValue: new Date().toISOString() }
      }
    };

    const fsResponse = await fetch(fsUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify(receiptPayload)
    });

    if (!fsResponse.ok) {
      const errText = await fsResponse.text();
      console.error("Failed to save receipt record to Firestore REST:", errText);
    }

    // 5. Send PDF Email Attachment to Customer via Nodemailer
    const receiptEmailResult = await dispatchEmail({
      to: userEmail,
      subject: "Your InvoCentric Payment Receipt",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 50%; padding: 12px; margin-bottom: 12px;">
              <span style="font-size: 32px; color: #15803d; line-height: 1;">✓</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Subscription Activated!</h2>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Welcome to InvoCentric Pro</p>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            Dear <strong>${userName}</strong>,
          </p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            Thank you for subscribing to InvoCentric. Below is your official payment receipt. Your <strong>InvoCentric Pro Account (${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'})</strong> has been activated successfully.
          </p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            Your official <strong>Payment Receipt (${receiptNo})</strong> has been generated and attached to this email as a PDF. You can also view and download your past subscription receipts at any time from your Account settings panel.
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Plan:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right; text-transform: uppercase;">InvoCentric Pro (${billingCycle})</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Amount:</td>
                <td style="padding: 6px 0; color: #166534; font-weight: 800; text-align: right;">₹${amount}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">UPI UTR:</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: 700; text-align: right;">${upiIdRef}</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 13px; line-height: 1.6; color: #64748b; text-align: center; margin-bottom: 24px;">
            Thank you for choosing InvoCentric! Let's power your business.
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
          
          <p style="font-size: 11px; text-align: center; color: #94a3b8; margin: 0;">
            InvoCentric © 2026. All rights reserved.<br/>
            If you have any questions, reply to this email or write to <a href="mailto:support@invocentric.in" style="color: #166534; text-decoration: none; font-weight: 600;">support@invocentric.in</a> or call <strong style="color: #166534;">+91 9824194869</strong>.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Receipt-${receiptNo}.pdf`,
          content: pdfBuffer,
        }
      ]
    });

    const emailSent = receiptEmailResult.success;
    const emailError = receiptEmailResult.error || "";

    res.status(200).json({
      success: true,
      receiptNumber: receiptNo,
      emailSent,
      emailError: emailError || null
    });
  } catch (error: any) {
    console.error("Failed to approve subscription receipt:", error);
    res.status(500).json({ error: "Internal server error: " + (error.message || error) });
  }
});

// --- SUBSCRIPTION RECEIPT DOWNLOAD SERVING ROUTE ---
app.get("/api/subscription/receipt-download/:receiptId", checkAuth, async (req, res) => {
  const { receiptId } = req.params;
  const idToken = (req as any).user.idToken;
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/subscription_receipts/${receiptId}?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${idToken}`
      }
    });
    if (!response.ok) {
      return res.status(404).send("Receipt not found");
    }
    const data = await response.json();
    const pdfBase64 = data.fields?.pdf_base64?.stringValue;
    if (!pdfBase64) {
      return res.status(404).send("PDF data not found in receipt record");
    }
    const receiptNum = data.fields?.receipt_number?.stringValue || "receipt";
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Receipt-${receiptNum}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Error downloading receipt:", err);
    res.status(500).send("Internal server error");
  }
});

// --- EMAIL DISPATCH AND INACTIVITY MONITORING ENGINE ---

function parseFirestoreValue(value: any): any {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return parseFloat(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map((v: any) => parseFirestoreValue(v));
  }
  if ('mapValue' in value) {
    const parsed: Record<string, any> = {};
    const fields = value.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      parsed[key] = parseFirestoreValue(fields[key]);
    }
    return parsed;
  }
  return null;
}

function parseFirestoreDocument(doc: any) {
  if (!doc || !doc.fields) return null;
  const id = doc.name.split("/").pop();
  const parsed: Record<string, any> = { id };
  for (const key of Object.keys(doc.fields)) {
    parsed[key] = parseFirestoreValue(doc.fields[key]);
  }
  return parsed;
}

// Fetch all users in paginated chunks via Firestore REST API
async function fetchAllUsers(authHeader?: string): Promise<any[]> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  let allUsers: any[] = [];

  const headers: Record<string, string> = {};
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  // Strategy 1: runQuery POST request (Works seamlessly with API Key across public rules)
  try {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${apiKey}`;
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: "users" }]
      }
    };
    const res = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(queryBody)
    });
    if (res.ok) {
      const queryData = await res.json();
      if (Array.isArray(queryData)) {
        const queryDocs = queryData
          .filter((item: any) => item && item.document)
          .map((item: any) => item.document);
        if (queryDocs.length > 0) {
          allUsers = queryDocs;
        }
      }
    }
  } catch (err) {
    console.error("Error in fetchAllUsers runQuery strategy:", err);
  }

  // Strategy 2: If runQuery returned empty, fallback to GET list
  if (allUsers.length === 0) {
    let nextPageToken: string | undefined = undefined;
    do {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users?pageSize=300${nextPageToken ? `&pageToken=${nextPageToken}` : ""}&key=${apiKey}`;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          break;
        }
        const data = await res.json();
        if (data.documents && Array.isArray(data.documents)) {
          allUsers = allUsers.concat(data.documents);
        }
        nextPageToken = data.nextPageToken;
      } catch (err) {
        break;
      }
    } while (nextPageToken);
  }

  return allUsers;
}

// Log email events securely inside a unified Firestore collection
async function logEmailDispatch(email: string, type: string, subject: string, status: string, errorMsg?: string) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/email_logs?key=${apiKey}`;
  
  const payload = {
    fields: {
      recipient_email: { stringValue: email },
      email_type: { stringValue: type },
      subject: { stringValue: subject },
      status: { stringValue: status },
      error: errorMsg ? { stringValue: errorMsg } : { nullValue: null },
      timestamp: { stringValue: new Date().toISOString() }
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error("Failed to log email dispatch to Firestore:", await res.text());
    }
  } catch (err) {
    console.error("Error logging email dispatch:", err);
  }
}

// Update specific fields on the user's document via REST PATCH
async function updateUserInactivityReminderFields(uid: string, fields: {
  inactivity_reminder_status?: string;
  inactivity_reminder_sent_at?: string | null;
  inactivity_reminder_cycle_id?: string | null;
  inactivity_reminder_error?: string | null;
}) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  
  const updateMasks: string[] = [];
  const firestoreFields: Record<string, any> = {};

  for (const key of Object.keys(fields)) {
    updateMasks.push(`updateMask.fieldPaths=${key}`);
    const val = (fields as any)[key];
    if (val === null) {
      firestoreFields[key] = { nullValue: null };
    } else {
      firestoreFields[key] = { stringValue: val };
    }
  }

  const queryParams = [...updateMasks, `key=${apiKey}`].join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${uid}?${queryParams}`;

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: firestoreFields })
    });
    if (!res.ok) {
      console.error(`Failed to update user inactivity fields for ${uid}:`, await res.text());
    }
  } catch (err) {
    console.error(`Error updating user inactivity fields for ${uid}:`, err);
  }
}

let etherealTransporter: any = null;

async function getSmtpTransporter(): Promise<{ transporter: nodemailer.Transporter; from: string } | null> {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;

  if (smtpUser && smtpPass) {
    return {
      transporter: nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      }),
      from: `"InvoCentric" <${smtpUser}>`
    };
  }

  // Fallback: Lazy create an Ethereal test account so email sending always succeeds without configuration
  if (!etherealTransporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      etherealTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log("[SMTP] Initialized fallback Ethereal test email account:", testAccount.user);
    } catch (err) {
      console.error("[SMTP] Failed to create Ethereal test account:", err);
    }
  }

  if (etherealTransporter) {
    return {
      transporter: etherealTransporter,
      from: `"InvoCentric Demo" <no-reply@invocentric.app>`
    };
  }

  return null;
}

// Unified email sender via Resend API (primary) or Nodemailer (fallback)
async function dispatchEmail({ 
  to, 
  subject, 
  html, 
  text,
  attachments 
}: { 
  to: string; 
  subject: string; 
  html: string; 
  text?: string;
  attachments?: { filename: string; content: any }[];
}): Promise<{ success: boolean; error?: string }> {
  let resendError = "";

  // 1. Try Resend API first if key is present
  if (process.env.RESEND_API_KEY) {
    try {
      const resendPayload: any = {
        from: process.env.RESEND_FROM || "InvoCentric <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
        text
      };
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        resendPayload.attachments = attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === "string" ? att.content : Buffer.from(att.content).toString("base64")
        }));
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(resendPayload)
      });

      if (res.ok) {
        console.log(`[Resend API] Email sent successfully to ${to}`);
        return { success: true };
      } else {
        const errData = await res.json().catch(() => ({}));
        resendError = errData.message || `Resend API failed with status ${res.status}`;
        console.warn(`[Resend API] Failed (${resendError}). Automatically falling back to SMTP...`);
      }
    } catch (err: any) {
      resendError = err.message || String(err);
      console.warn(`[Resend API] Threw error (${resendError}). Automatically falling back to SMTP...`);
    }
  }

  // 2. Fallback to SMTP / Nodemailer (if Resend failed, hit rate limit, or wasn't configured)
  try {
    const config = await getSmtpTransporter();
    if (!config) {
      return { 
        success: false, 
        error: resendError ? `Resend failed (${resendError}) and SMTP transporter is unconfigured.` : "SMTP Transporter and Resend API key both missing." 
      };
    }

    const smtpUser = process.env.SMTP_USER || "no-reply@invocentric.app";

    const mailOptions: any = {
      from: config.from,
      to,
      subject,
      html,
      replyTo: smtpUser,
      headers: {
        "List-Unsubscribe": `<https://invocentric.in/settings>, <mailto:${smtpUser}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "X-Mailer": "InvoCentric Mailer"
      }
    };

    if (text) {
      mailOptions.text = text;
    }

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        encoding: typeof att.content === "string" ? "base64" : undefined
      }));
    }

    const info = await config.transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[SMTP Fallback] Email sent to ${to}. Ethereal Preview: ${previewUrl}`);
    } else {
      console.log(`[SMTP Fallback] Email sent successfully to ${to}`);
    }

    return { success: true };
  } catch (smtpErr: any) {
    console.error("dispatchEmail SMTP fallback failed:", smtpErr);
    return { 
      success: false, 
      error: `Resend error: ${resendError || 'none'} | SMTP error: ${smtpErr.message || String(smtpErr)}` 
    };
  }
}

function generateInactivityEmailTemplate(userName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>InvoCentric - We miss you!</title>
</head>
<body style="margin:0; padding:0; background-color:#000000; font-family: Arial, Helvetica, sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000; padding:30px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; border:1px solid #1f1f1f; border-radius:14px; overflow:hidden;">

        <!-- HEADER -->
        <tr>
          <td style="padding:26px 32px; border-bottom:1px solid #1f1f1f;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left" valign="middle">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle" style="padding-right:10px;">
                        <svg width="38" height="38" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                          <g fill="#22c55e">
                            <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9
                              c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87
                              c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3
                              c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3
                              C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
                            <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
                            <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6
                              c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z"/>
                          </g>
                        </svg>
                      </td>
                      <td valign="middle">
                        <div style="font-size:20px; font-weight:bold; color:#ffffff; line-height:1.1;">Invo<span style="color:#22c55e;">Centric</span></div>
                        <div style="font-size:11px; color:#8a8a8a; margin-top:2px;">Billing. Simplified.</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" valign="middle" style="font-size:12px; color:#9a9a9a;">
                  Can't see this email? <a href="https://invocentric.in/" style="color:#22c55e; text-decoration:none;">View in browser</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td style="padding:34px 32px 10px 32px;">
            <div style="font-size:16px; color:#d0d0d0; margin-bottom:14px;">Hi ${userName}, 👋</div>
            <div style="font-size:30px; font-weight:bold; color:#ffffff; line-height:1.25; margin-bottom:18px;">
              We miss you!<br>
              Your business is<br>
              <span style="color:#22c55e;">always</span> a click away.
            </div>
            <div style="font-size:14px; color:#a8a8a8; line-height:1.7; max-width:400px;">
              You haven't opened InvoCentric for the last <span style="color:#e5e5e5; font-weight:bold;">24 hours.</span> Your invoices, customers, and business data are safe and ready whenever you need them.
            </div>
            <div style="font-size:14px; color:#a8a8a8; line-height:1.7; margin-top:14px; max-width:400px;">
              Come back and continue managing your business like a pro.
            </div>
          </td>
        </tr>

        <!-- DASHBOARD PREVIEW CARD -->
        <tr>
          <td style="padding:20px 32px 10px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#101010; border:1px solid #232323; border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle">
                        <span style="font-size:13px; font-weight:bold; color:#ffffff;">📊 InvoCentric</span>
                      </td>
                      <td align="right">
                        <table role="presentation" cellpadding="0" cellspacing="0" align="right">
                          <tr>
                            <td style="background-color:#0d1f16; border:1px solid #22c55e; border-radius:50%; width:34px; height:34px; text-align:center;">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;">
                                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="#22c55e"/>
                              </svg>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                    <tr>
                      <!-- side nav -->
                      <td width="30%" valign="top" style="border-right:1px solid #232323; padding-right:12px;">
                        <div style="background-color:#16301f; border-radius:6px; padding:7px 8px; font-size:11px; color:#22c55e; margin-bottom:6px;">🏠 Dashboard</div>
                        <div style="padding:7px 8px; font-size:11px; color:#8a8a8a; margin-bottom:6px;">📄 Invoices</div>
                        <div style="padding:7px 8px; font-size:11px; color:#8a8a8a; margin-bottom:6px;">👥 Customers</div>
                        <div style="padding:7px 8px; font-size:11px; color:#8a8a8a; margin-bottom:6px;">🛍 Products</div>
                        <div style="padding:7px 8px; font-size:11px; color:#8a8a8a; margin-bottom:6px;">📈 Reports</div>
                        <div style="padding:7px 8px; font-size:11px; color:#8a8a8a;">⚙️ Settings</div>
                      </td>
                      <!-- main -->
                      <td width="70%" valign="top" style="padding-left:14px;">
                        <div style="font-size:12px; font-weight:bold; color:#ffffff; margin-bottom:10px;">Dashboard</div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="33%" style="background-color:#151515; border:1px solid #232323; border-radius:8px; padding:8px 10px;">
                              <div style="font-size:9px; color:#8a8a8a;">Total Invoices</div>
                              <div style="font-size:14px; color:#ffffff; font-weight:bold;">124</div>
                              <div style="font-size:9px; color:#22c55e;">▲ 12%</div>
                            </td>
                            <td width="4%"></td>
                            <td width="33%" style="background-color:#151515; border:1px solid #232323; border-radius:8px; padding:8px 10px;">
                              <div style="font-size:9px; color:#8a8a8a;">Total Sales</div>
                              <div style="font-size:14px; color:#ffffff; font-weight:bold;">₹45,250</div>
                              <div style="font-size:9px; color:#22c55e;">▲ 18%</div>
                            </td>
                            <td width="4%"></td>
                            <td width="26%" style="background-color:#151515; border:1px solid #232323; border-radius:8px; padding:8px 10px;">
                              <div style="font-size:9px; color:#8a8a8a;">Outstanding</div>
                              <div style="font-size:14px; color:#ffffff; font-weight:bold;">₹8,450</div>
                              <div style="font-size:9px; color:#22c55e;">▲ 8%</div>
                            </td>
                          </tr>
                        </table>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px; background-color:#151515; border:1px solid #232323; border-radius:8px;">
                          <tr>
                            <td style="padding:10px;">
                              <table width="100%"><tr>
                                <td style="font-size:10px; color:#ffffff; font-weight:bold;">Sales Overview</td>
                                <td align="right" style="font-size:9px; color:#8a8a8a;">This Month</td>
                              </tr></table>
                              <svg width="100%" height="55" viewBox="0 0 260 55" preserveAspectRatio="none" style="margin-top:6px;">
                                <polyline points="0,35 40,25 80,40 120,20 160,30 200,10 240,18 260,12" fill="none" stroke="#22c55e" stroke-width="2"/>
                                <circle cx="120" cy="20" r="3" fill="#22c55e"/>
                                <circle cx="200" cy="10" r="3" fill="#22c55e"/>
                              </svg>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:28px 32px 6px 32px;">
            <a href="https://invocentric.in/" style="display:inline-block; background-color:#22c55e; color:#04140a; font-size:16px; font-weight:bold; text-decoration:none; padding:16px 38px; border-radius:10px;">
              Open InvoCentric Now &nbsp;→
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 26px 32px; font-size:12px; color:#8a8a8a;">
            🔒 Secure. Fast. Always with you.
          </td>
        </tr>

        <!-- FEATURES -->
        <tr>
          <td style="padding:0 32px 26px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d0d; border:1px solid #1f1f1f; border-radius:12px;">
              <tr>
                <td style="padding:24px 20px 20px 20px;" align="center">
                  <div style="font-size:16px; font-weight:bold; color:#ffffff; margin-bottom:20px;">
                    Everything you can do with <span style="color:#22c55e;">InvoCentric</span>
                  </div>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="20%" align="center" style="padding:0 4px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td align="center" valign="middle" style="width:52px; height:52px; background-color:#141414; border:1px solid #232323; border-radius:50%; text-align:center; line-height:0; font-size:0;">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin:0; padding:0;">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <line x1="10" y1="9" x2="8" y2="9" />
                              </svg>
                            </td>
                          </tr>
                        </table>
                        <div style="font-size:11px; color:#c9c9c9; margin-top:10px; line-height:1.4;">Create &amp; Send<br>Invoices</div>
                      </td>
                      <td width="20%" align="center" style="padding:0 4px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td align="center" valign="middle" style="width:52px; height:52px; background-color:#141414; border:1px solid #232323; border-radius:50%; text-align:center; line-height:0; font-size:0;">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin:0; padding:0;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                            </td>
                          </tr>
                        </table>
                        <div style="font-size:11px; color:#c9c9c9; margin-top:10px; line-height:1.4;">Manage<br>Customers</div>
                      </td>
                      <td width="20%" align="center" style="padding:0 4px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td align="center" valign="middle" style="width:52px; height:52px; background-color:#141414; border:1px solid #232323; border-radius:50%; text-align:center; line-height:0; font-size:0;">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin:0; padding:0;">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                              </svg>
                            </td>
                          </tr>
                        </table>
                        <div style="font-size:11px; color:#c9c9c9; margin-top:10px; line-height:1.4;">Manage<br>Products</div>
                      </td>
                      <td width="20%" align="center" style="padding:0 4px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td align="center" valign="middle" style="width:52px; height:52px; background-color:#141414; border:1px solid #232323; border-radius:50%; text-align:center; line-height:0; font-size:0;">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin:0; padding:0;">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                                <path d="M2 20h20" />
                              </svg>
                            </td>
                          </tr>
                        </table>
                        <div style="font-size:11px; color:#c9c9c9; margin-top:10px; line-height:1.4;">Sales &amp; GST<br>Reports</div>
                      </td>
                      <td width="20%" align="center" style="padding:0 4px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td align="center" valign="middle" style="width:52px; height:52px; background-color:#141414; border:1px solid #232323; border-radius:50%; text-align:center; line-height:0; font-size:0;">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin:0; padding:0;">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                              </svg>
                            </td>
                          </tr>
                        </table>
                        <div style="font-size:11px; color:#c9c9c9; margin-top:10px; line-height:1.4;">Barcode &amp; QR<br>Tools</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SECURITY BANNER -->
        <tr>
          <td style="padding:0 32px 26px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d0d; border:1px solid #1f1f1f; border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;" valign="middle">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle" style="padding-right:14px;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" valign="middle" style="width:44px; height:44px; background-color:#0f2417; border-radius:50%; text-align:center; line-height:0; font-size:0;">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin:0; padding:0;">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <polyline points="9 11 11 13 15 9" />
                              </svg>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td valign="middle">
                        <div style="font-size:14px; color:#e5e5e5;"><span style="color:#22c55e; font-weight:bold;">Your data is 100% secure</span> with us.</div>
                        <div style="font-size:13px; color:#9a9a9a; margin-top:2px;">We're here to help you grow your business.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER CONTACT -->
        <tr>
          <td style="padding:0 32px 20px 32px; border-top:1px solid #1f1f1f; padding-top:24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="top" width="55%">
                  <div style="font-size:13px; color:#9a9a9a;">Thank you for choosing InvoCentric.</div>
                  <div style="font-size:14px; color:#e5e5e5; font-weight:bold; margin-top:4px;">We're here whenever you need us!</div>
                  <div style="font-size:13px; color:#22c55e; margin-top:6px;">– Team InvoCentric</div>
                </td>
                <td valign="top" width="45%">
                  <table role="presentation" cellpadding="0" cellspacing="0" align="right">
                    <tr>
                      <td style="padding-bottom:8px;" align="left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:middle; margin-right:8px;">
                          <path d="M3 5h18v14H3z" stroke="#22c55e" stroke-width="1.6"/>
                          <path d="M3 6l9 7 9-7" stroke="#22c55e" stroke-width="1.6"/>
                        </svg>
                        <span style="font-size:12px; color:#ffffff; font-weight:bold;">support@invocentric.in</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:8px;" align="left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:middle; margin-right:8px;">
                          <circle cx="12" cy="12" r="9" stroke="#22c55e" stroke-width="1.6"/>
                          <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z" stroke="#22c55e" stroke-width="1.4"/>
                        </svg>
                        <span style="font-size:12px; color:#ffffff; font-weight:bold;">www.invocentric.in</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:middle; margin-right:8px;">
                          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1.1.5 1.1 1.1v3.3c0 .6-.5 1.1-1.1 1.1C10.6 21.1 2.9 13.4 2.9 3.2 2.9 2.6 3.4 2.1 4 2.1h3.3c.6 0 1.1.5 1.1 1.1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1L6.6 10.8z" stroke="#22c55e" stroke-width="1.4"/>
                        </svg>
                        <span style="font-size:12px; color:#ffffff; font-weight:bold;">+91 98241 94869</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- LEGAL -->
        <tr>
          <td align="center" style="padding:22px 32px 30px 32px; font-size:11px; color:#6a6a6a; line-height:1.6;">
            You received this email because you are a registered user of InvoCentric.<br>
            <a href="https://invocentric.in/settings" target="_blank" style="color:#22c55e; text-decoration:underline;">Unsubscribe</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
// Global function to perform the user inactivity scanning and reminder dispatches
async function runInactivityRemindersCheck(
  authHeader?: string, 
  force: boolean = false, 
  reset: boolean = false
): Promise<{ checked: number; sent: number; errors: string[] }> {
  console.log(`[Inactivity Scheduler] Scanning users for inactivity reminders (force=${force}, reset=${reset})...`);
  const results = { checked: 0, sent: 0, errors: [] as string[] };
  try {
    const rawUsers = await fetchAllUsers(authHeader);
    results.checked = rawUsers.length;
    
    const now = Date.now();
    const INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000; // 24 continuous hours
    for (const rawUser of rawUsers) {
      const user = parseFirestoreDocument(rawUser);
      if (!user) continue;

      // Extract valid email
      const email = user.email || user.business_email;
      if (!email || !email.includes("@")) continue;

      // Reset reminders if requested
      if (reset) {
        if (user.inactivity_reminder_status !== 'not_eligible') {
          await updateUserInactivityReminderFields(user.id, {
            inactivity_reminder_status: 'not_eligible',
            inactivity_reminder_sent_at: null,
            inactivity_reminder_cycle_id: null,
            inactivity_reminder_error: null
          });
          user.inactivity_reminder_status = 'not_eligible';
        }
      }

      // Check user toggle settings
      if (user.email_reminders_enabled === false) {
        if (user.inactivity_reminder_status !== 'disabled') {
          await updateUserInactivityReminderFields(user.id, { inactivity_reminder_status: 'disabled' });
        }
        continue;
      }

      // Safeguard: do not dispatch if already sent in this cycle (unless forced)
      if (user.inactivity_reminder_status === 'sent' && !force) {
        continue;
      }

      // Check last active threshold
      const lastActiveStr = user.last_active_at || user.updated_at || user.created_at;
      if (!lastActiveStr && !force) continue;

      const lastActiveTime = lastActiveStr ? new Date(lastActiveStr).getTime() : 0;
      const inactiveMs = now - lastActiveTime;

      if (inactiveMs >= INACTIVITY_THRESHOLD || force) {
        console.log(`[Inactivity Scheduler] Sending reminder to: ${email} (inactive for ${lastActiveStr ? Math.round(inactiveMs / 3600000) : 'unknown'} hours, force=${force})`);
        
        const userName = user.owner_name || user.display_name || user.business_name || email.split("@")[0] || "there";
        const html = generateInactivityEmailTemplate(userName);
        const text = `Hi ${userName},\n\nWe miss you! Your InvoCentric billing dashboard is ready.\n\nYou haven't logged into InvoCentric in the last 24 hours. This is just a friendly check-in to see if we can help you streamline your invoicing today.\n\nYour client lists, custom products, pending payments, and receipts are safely synced in the cloud and ready whenever you are.\n\nReturn to Dashboard: https://invocentric.in/\n\nTo stop receiving these alerts, update your settings at https://invocentric.in/settings`;

        const dispatch = await dispatchEmail({
          to: email,
          subject: "InvoCentric Account Status: Your billing dashboard is active",
          html,
          text
        });

        if (dispatch.success) {
          results.sent++;
          const cycleId = "cycle_" + Date.now();
          await updateUserInactivityReminderFields(user.id, {
            inactivity_reminder_status: 'sent',
            inactivity_reminder_sent_at: new Date().toISOString(),
            inactivity_reminder_cycle_id: cycleId,
            inactivity_reminder_error: null
          });

          await logEmailDispatch(
            email,
            "Reminder",
            "InvoCentric Account Status: Your billing dashboard is active",
            "Sent"
          );
        } else {
          results.errors.push(`${email}: ${dispatch.error}`);
          await updateUserInactivityReminderFields(user.id, {
            inactivity_reminder_status: 'failed',
            inactivity_reminder_error: dispatch.error || "Unknown Error"
          });

          await logEmailDispatch(
            email,
            "Reminder",
            "InvoCentric Account Status: Your billing dashboard is active",
            "Failed",
            dispatch.error
          );
        }
      }
    }
  } catch (err: any) {
    console.error("[Inactivity Scheduler] Error executing scanning cycle:", err);
    results.errors.push(`Global check error: ${err.message || err}`);
  }
  return results;
}

// Background loop running at server level inside the Cloud container (no client state dependency)
function startInactivityScheduler() {
  console.log("[Inactivity Scheduler] Initializing background checker loop...");
  
  // Stagger start by 10 seconds to let container finish bootup gracefully
  setTimeout(() => {
    runInactivityRemindersCheck()
      .then(res => console.log(`[Inactivity Scheduler] Startup scan complete: Checked ${res.checked}, Sent ${res.sent}, Failures: ${res.errors.length}`))
      .catch(err => console.error("[Inactivity Scheduler] Startup scan crash:", err));
  }, 10000);

  // Poll every 1 hour thereafter
  setInterval(() => {
    runInactivityRemindersCheck()
      .then(res => console.log(`[Inactivity Scheduler] Hourly scan complete: Checked ${res.checked}, Sent ${res.sent}, Failures: ${res.errors.length}`))
      .catch(err => console.error("[Inactivity Scheduler] Hourly scan crash:", err));
  }, 3600000);
}

// Start the scheduler on application initialization
startInactivityScheduler();

// --- ADMIN API ENDPOINTS FOR EMAIL MANAGEMENT & TEST DISPATCH ---

// 1. Trigger manual scan
app.post("/api/admin/check-inactivity", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  if ((req as any).user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }

  try {
    const authHeader = req.headers.authorization;
    const { force, reset } = req.body || {};
    const results = await runInactivityRemindersCheck(authHeader, !!force, !!reset);
    res.status(200).json({ success: true, ...results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || err });
  }
});

// 2. Send customized test inactivity email template
app.post("/api/admin/send-test-reminder", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  if ((req as any).user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }

  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid recipient email address." });
  }

  try {
    const testHtml = generateInactivityEmailTemplate("Valued Admin");
    const testText = `Hi Valued Admin,\n\nWe miss you! Your InvoCentric billing dashboard is ready.\n\nYou haven't logged into InvoCentric in the last 24 hours. This is just a friendly check-in to see if we can help you streamline your invoicing today.\n\nYour client lists, custom products, pending payments, and receipts are safely synced in the cloud and ready whenever you are.\n\nReturn to Dashboard: https://invocentric.in/\n\nTo stop receiving these alerts, update your settings at https://invocentric.in/settings`;
    const result = await dispatchEmail({
      to: email,
      subject: "Ready to streamline your billing? (Admin Test)",
      html: testHtml,
      text: testText
    });

    if (result.success) {
      await logEmailDispatch(email, "Test Reminder", "Ready to streamline your billing? (Admin Test)", "Sent");
      res.status(200).json({ success: true, message: "Test inactivity email sent." });
    } else {
      await logEmailDispatch(email, "Test Reminder", "Ready to streamline your billing? (Admin Test)", "Failed", result.error);
      res.status(500).json({ error: result.error || "Failed to dispatch test email." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || err });
  }
});

// 3. Log receipt sending on approval
// Note: Handled inside app.post("/api/subscription/approve-receipt") via logEmailDispatch calls.

// Hook up logEmailDispatch to original approve-receipt endpoint
const originalApproveReceipt = app._router.stack.find((layer: any) => layer.route && layer.route.path === "/api/subscription/approve-receipt");
if (originalApproveReceipt) {
  const handler = originalApproveReceipt.route.stack[originalApproveReceipt.route.stack.length - 1].handle;
  originalApproveReceipt.route.stack[originalApproveReceipt.route.stack.length - 1].handle = async function (req: any, res: any, next: any) {
    const originalResJson = res.json;
    res.json = function (body: any) {
      if (body && body.success) {
        logEmailDispatch(
          req.body.userEmail,
          "Receipt",
          "Your InvoCentric Payment Receipt",
          body.emailSent ? "Sent" : "Failed",
          body.emailError || undefined
        ).catch(e => console.error("Async post-receipt logging failed:", e));
      }
      return originalResJson.call(this, body);
    };
    return handler(req, res, next);
  };
}

// --- LOCAL USB MOBILE SCANNER ENGINE (OFFLINE-READY) ---
let sseClients: { res: any; sessionId: string }[] = [];
const mobileHeartbeats = new Map<string, number>(); // sessionId -> timestamp
const wasMobileConnectedMap = new Map<string, boolean>(); // sessionId -> wasConnected
const HEARTBEAT_TIMEOUT = 5000; // 5s timeout

function isMobileConnected(sessionId: string) {
  const lastHeartbeat = mobileHeartbeats.get(sessionId) || 0;
  return (Date.now() - lastHeartbeat) < HEARTBEAT_TIMEOUT;
}

// Broadcast message helper
function broadcastToSse(sessionId: string, data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    if (client.sessionId === sessionId || client.sessionId === "default" || sessionId === "default") {
      try {
        client.res.write(payload);
      } catch (err) {
        // client connection might be dead
      }
    }
  });
}

// Check connectivity status periodically and broadcast changes
setInterval(() => {
  const activeSessions = new Set<string>();
  sseClients.forEach(c => activeSessions.add(c.sessionId));

  activeSessions.forEach(sessionId => {
    const currentConnected = isMobileConnected(sessionId);
    const wasConnected = wasMobileConnectedMap.get(sessionId) || false;
    if (currentConnected !== wasConnected) {
      wasMobileConnectedMap.set(sessionId, currentConnected);
      broadcastToSse(sessionId, { type: "status", connected: currentConnected });
    }
  });
}, 1000);

// SSE connection for PC browser
app.get("/api/usb-scanner/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sessionId = (req.query.sessionId as string) || "default";

  sseClients.push({ res, sessionId });

  // Send current connectivity immediately
  res.write(`data: ${JSON.stringify({ type: "status", connected: isMobileConnected(sessionId) })}\n\n`);

  req.on("close", () => {
    sseClients = sseClients.filter(client => client.res !== res);
  });
});

// Mobile heartbeat route
app.post("/api/usb-scanner/heartbeat", (req, res) => {
  const { sessionId } = req.body;
  const sid = sessionId || "default";

  mobileHeartbeats.set(sid, Date.now());
  const currentConnected = isMobileConnected(sid);
  const wasConnected = wasMobileConnectedMap.get(sid) || false;
  if (currentConnected !== wasConnected) {
    wasMobileConnectedMap.set(sid, currentConnected);
    broadcastToSse(sid, { type: "status", connected: true });
  }
  res.status(200).json({ success: true, connected: true });
});

// Mobile barcode submission route
app.post("/api/usb-scanner/scan", (req, res) => {
  const { code, sessionId } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing barcode code" });
  }

  const sid = sessionId || "default";

  // Record a heartbeat since they successfully scanned
  mobileHeartbeats.set(sid, Date.now());
  wasMobileConnectedMap.set(sid, true);

  // Broadcast code to matching session PC listeners
  broadcastToSse(sid, { type: "scan", code: code.trim() });

  res.status(200).json({ success: true });
});

export default app;
