var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// api/index.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_helmet = __toESM(require("helmet"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
process.on("uncaughtException", (err) => {
  console.error("[CRITICAL PROCESS CRASH GUARD] Prevented server shutdown from uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[CRITICAL PROCESS CRASH GUARD] Prevented server shutdown from unhandled rejection:", reason);
});
var _filename = typeof __filename !== "undefined" ? __filename : "";
var _dirname = typeof __dirname !== "undefined" ? __dirname : import_path.default.dirname(_filename);
var loadFirebaseConfig = () => {
  const searchPaths = [
    import_path.default.resolve(_dirname, "../firebase-applet-config.json"),
    import_path.default.resolve(_dirname, "./firebase-applet-config.json"),
    import_path.default.resolve(_dirname, "firebase-applet-config.json"),
    import_path.default.resolve(process.cwd(), "firebase-applet-config.json"),
    import_path.default.resolve(process.cwd(), "api/firebase-applet-config.json")
  ];
  for (const p of searchPaths) {
    try {
      if (import_fs.default.existsSync(p)) {
        console.log(`[Firebase Config] Successfully loaded config from: ${p}`);
        return JSON.parse(import_fs.default.readFileSync(p, "utf-8"));
      }
    } catch (err) {
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
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID
    };
  }
  throw new Error("Could not find firebase-applet-config.json in any search path and no fallback environment variables are defined.");
};
var firebaseConfig = loadFirebaseConfig();
import_dotenv.default.config();
var isProd = process.env.NODE_ENV === "production" || process.env.VITE_PROD === "true";
if (isProd && !process.env.GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is missing. AI features will fail gracefully.");
}
var app = (0, import_express.default)();
app.set("trust proxy", 1);
app.use((req, res, next) => {
  if (isProd && req.headers["x-forwarded-proto"] && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
app.use((0, import_helmet.default)({
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
  frameguard: isProd ? { action: "deny" } : false,
  // Deny framing in production, allow in dev for AI Studio preview
  hsts: isProd ? { maxAge: 31536e3, includeSubDomains: true, preload: true } : false,
  // Strict-Transport-Security: 1 year (31536000 seconds)
  crossOriginEmbedderPolicy: false
}));
var allowedOrigins = [
  "https://invocentric.vercel.app",
  "https://invocentric.dev",
  "https://invocentric.in",
  "https://www.invocentric.in",
  "https://localhost",
  "capacitor://localhost"
];
app.use((0, import_cors.default)({
  origin: (origin, callback) => {
    if (!origin || !isProd || allowedOrigins.includes(origin) || origin.startsWith("https://ais-dev-") || origin.startsWith("https://ais-pre-") || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));
var apiLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 150,
  // Limit each IP to 150 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false
  },
  message: { error: "Too many requests from this IP. Please try again after a few minutes." }
});
var authEmailLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 6,
  // Limit 6 action attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false
  },
  message: { error: "Too many requests. Please wait 1 minute before trying again." }
});
var securityTracker = /* @__PURE__ */ new Map();
function getSecurityRecord(key) {
  const now = Date.now();
  let record = securityTracker.get(key);
  if (!record) {
    record = { failedAttempts: 0, lockedUntil: 0, otpRequestsThisHour: 0, hourResetTime: now + 36e5 };
    securityTracker.set(key, record);
  }
  if (now > (record.hourResetTime || 0)) {
    record.otpRequestsThisHour = 0;
    record.hourResetTime = now + 36e5;
  }
  return record;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of securityTracker.entries()) {
    if (record.lockedUntil < now && record.failedAttempts === 0 && (record.lastOtpRequestTime || 0) < now - 36e5) {
      securityTracker.delete(key);
    }
  }
}, 5 * 60 * 1e3);
async function checkAuth(req, res, next) {
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
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    });
    if (!response.ok) {
      return res.status(401).json({ error: "UNAUTHORIZED: Session expired or invalid signature token." });
    }
    const result = await response.json();
    if (!result.users || result.users.length === 0) {
      return res.status(401).json({ error: "UNAUTHORIZED: Validated profile could not be resolved." });
    }
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
app.use(import_express.default.json({ limit: "10mb" }));
app.use(import_express.default.urlencoded({ limit: "10mb", extended: true }));
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    delete req.body["__proto__"];
    delete req.body["constructor"];
    delete req.body["prototype"];
  }
  if (req.query && typeof req.query === "object") {
    delete req.query["__proto__"];
    delete req.query["constructor"];
    delete req.query["prototype"];
  }
  next();
});
app.use("/api/auth/", authEmailLimiter);
app.get("/robots.txt", (req, res) => {
  const robotsPath = import_path.default.resolve(_dirname, "../public/robots.txt");
  res.setHeader("Content-Type", "text/plain");
  res.sendFile(robotsPath);
});
app.get("/sitemap.xml", (req, res) => {
  const sitemapPath = import_path.default.resolve(_dirname, "../public/sitemap.xml");
  res.setHeader("Content-Type", "application/xml");
  res.sendFile(sitemapPath);
});
app.get("/manifest.webmanifest", (req, res) => {
  const manifestPath = import_path.default.resolve(_dirname, "../public/manifest.webmanifest");
  res.setHeader("Content-Type", "application/manifest+json");
  res.sendFile(manifestPath);
});
app.get("/api/download", async (req, res) => {
  const platform = (req.query.platform || req.query.type || "windows").toString().toLowerCase();
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repo = "Noman1611/Invocentric-app";
  try {
    const headers = {
      "User-Agent": "InvoCentric-Server"
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }
    let releaseData = null;
    const relRes = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
    if (relRes.ok) {
      releaseData = await relRes.json();
    } else {
      const fallbackRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/v1.0.0`, { headers });
      if (fallbackRes.ok) {
        releaseData = await fallbackRes.json();
      }
    }
    if (!releaseData) {
      return res.redirect(302, `https://github.com/${repo}/releases/latest/download/InvoCentric-Setup.exe`);
    }
    const isAndroid = platform.includes("android") || platform.includes("apk") || platform.includes("mobile");
    const asset = releaseData.assets?.find((a) => {
      const n = a.name.toLowerCase();
      if (isAndroid) return n.includes("invocentric") && n.endsWith(".apk") || n.includes("invocentic") && n.endsWith(".apk") || n === "app-release.apk";
      return (n.includes("invocentric") || n.includes("invocentic")) && n.endsWith(".exe");
    });
    if (!asset) {
      if (isAndroid) {
        return res.redirect(302, "/download?platform=android&guide=open");
      }
      return res.redirect(302, `https://github.com/${repo}/releases/latest/download/InvoCentric-Setup.exe`);
    }
    return res.redirect(302, asset.browser_download_url);
  } catch (err) {
    console.error("[Download Route Error]:", err);
    if (platform.includes("android") || platform.includes("apk") || platform.includes("mobile")) {
      return res.redirect(302, "/download?platform=android&guide=open");
    }
    return res.redirect(302, `https://github.com/${repo}/releases/latest/download/InvoCentric-Setup.exe`);
  }
});
app.use("/api/", apiLimiter);
function generateCorrelationId() {
  return "ERR-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}
app.post("/api/send-email", authEmailLimiter, checkAuth, async (req, res) => {
  const { to, subject, html, attachments, emailType, recipientName, businessName, deliveryMode } = req.body;
  if (typeof to !== "string" || !to.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "A valid recipient email address is required." });
  }
  if (typeof subject !== "string" || !subject.trim() || subject.length > 250) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Subject must be a valid string under 250 characters." });
  }
  if (typeof html !== "string" || !html.trim() || html.length > 5e5) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "HTML content must be a valid string under 500,000 characters." });
  }
  if (attachments && (!Array.isArray(attachments) || attachments.length > 10)) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Attachments must be an array with max 10 files." });
  }
  const result = await dispatchEmail({ to, subject, html, attachments });
  const computedType = emailType || (subject.toLowerCase().includes("reminder") ? "Reminder" : "Receipt");
  logEmailDispatch(
    to,
    computedType,
    subject,
    result.success ? "Sent" : "Failed",
    result.error,
    {
      recipient_name: recipientName,
      business_name: businessName,
      user_id: req.user?.uid,
      delivery_mode: deliveryMode || "Automatic"
    }
  ).catch((err) => console.error("send-email logging failed:", err));
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
var emailOtpStore = /* @__PURE__ */ new Map();
function generateOtpEmailTemplate(data) {
  const otp = typeof data === "string" ? data : data?.otp || "";
  const businessName = typeof data === "object" && data?.businessName ? data.businessName : "Business Partner";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>InvoCentric \u2014 Authorization Token Slip</title>
<style>
  @media only screen and (max-width: 600px) {
    .main-table { width: 100% !important; }
    .receipt-card { padding: 22px 16px !important; }
    .otp-val { font-size: 28px !important; letter-spacing: 5px !important; }
    .headline { font-size: 18px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#c8d3ce; font-family:'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">

<!-- FULL WIDTH CENTER WRAPPER -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#c8d3ce; width:100% !important; margin:0; padding:35px 12px;">
  <tr>
    <td align="center" valign="top">

      <!-- MAX-WIDTH CONTAINER (520px) -->
      <table role="presentation" class="main-table" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%; margin:0 auto;">

        <!-- PREVIEW ANIMATION LINK -->
        <tr>
          <td align="center" style="padding-bottom:14px;">
            <a href="https://invocentric.in/api/preview/inactivity-email" target="_blank" style="display:inline-block; background-color:#ffffff; color:#0d5c4b; text-decoration:none; font-size:11.5px; font-weight:600; padding:6px 16px; border-radius:20px; border:1px solid #b9d4ca; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
              \u26A1 View Live Thermal Print Animation \u2197
            </a>
          </td>
        </tr>

        <!-- POS PRINTER MACHINE HEAD -->
        <tr>
          <td align="center" style="padding:0; line-height:1;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; height:46px; background-color:#1b2229; background:linear-gradient(180deg, #1b2229 0%, #29343f 70%, #151b22 100%); border-radius:12px 12px 0 0; box-shadow:0 8px 20px rgba(0,0,0,0.35);">
              <tr>
                <td width="36" align="center" style="padding-left:16px;">
                  <div style="width:10px; height:10px; border-radius:50%; background-color:#2ecc71; box-shadow:0 0 8px #2ecc71; display:inline-block;"></div>
                </td>
                <td align="center" style="padding:0 12px;">
                  <div style="height:8px; background-color:#090c0e; border-radius:4px; border-bottom:1px solid rgba(255,255,255,0.15); width:100%; max-width:380px;"></div>
                </td>
                <td width="36" style="padding-right:16px;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- THERMAL PAPER RECEIPT SLIP -->
        <tr>
          <td align="center" style="padding:0;">
            <div class="feed-container">
              <div class="receipt-wrap" id="receiptWrap">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#ffffff; box-shadow:0 14px 32px rgba(0,0,0,0.16); border-left:1px solid #dcdcdc; border-right:1px solid #dcdcdc; border-bottom:3px dashed #b9d4ca;">
              <tr>
                <td class="receipt-card" style="padding:32px 28px 24px; text-align:left;">

                  <!-- LOGO & BRAND -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                    <tr>
                      <td width="42" valign="middle">
                        <svg viewBox="0 0 500 500" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                          <g fill="#0d5c4b">
                            <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9
                              c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87
                              c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3
                              c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3
                              C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
                            <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
                            <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6
                              c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50
                              C362.6,181.5,340.3,178.8,324.8,191z"/>
                          </g>
                        </svg>
                      </td>
                      <td valign="middle" style="padding-left:12px;">
                        <div style="font-size:24px; font-weight:800; color:#0d5c4b; letter-spacing:-0.5px; line-height:1.1; margin:0;">InvoCentric</div>
                        <div style="font-size:11px; color:#0d5c4b; margin-top:2px;">More than billing. Built for your business.</div>
                      </td>
                    </tr>
                  </table>

                  <!-- DASHED DIVIDER WITH TITLE -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
                    <tr>
                      <td style="border-top:1px dashed #cccccc; font-size:1px; line-height:1px;">&nbsp;</td>
                      <td width="160" align="center" style="padding:0 8px; font-size:10.5px; font-weight:bold; letter-spacing:2px; color:#444444; white-space:nowrap;">SECURITY AUTH SLIP</td>
                      <td style="border-top:1px dashed #cccccc; font-size:1px; line-height:1px;">&nbsp;</td>
                    </tr>
                  </table>

                  <!-- HEADLINE -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                    <tr>
                      <td width="28" valign="top" style="padding-top:2px;">
                        <svg viewBox="0 0 24 24" fill="#0d5c4b" width="24" height="24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                      </td>
                      <td valign="top" style="padding-left:8px;">
                        <div class="headline" style="font-size:21px; font-weight:700; color:#0d5c4b; line-height:1.25; margin:0;">Verification Code</div>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size:14px; color:#222222; line-height:1.6; margin:0 0 10px;">Hi <strong>${businessName}</strong>,</p>
                  <p style="font-size:13.5px; color:#444444; line-height:1.55; margin:0 0 16px;">
                    A secure authentication request was initiated for your InvoCentric account. Use the one-time verification code below to proceed:
                  </p>

                  <!-- ACTIVITY BOX: EMAIL SAFE 2-COLUMN TABLE -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e3f1ec; border-radius:8px; margin:16px 0 20px;">
                    <tr>
                      <td width="49%" valign="middle" style="padding:14px 16px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td valign="middle" style="padding-right:10px;">
                              <svg viewBox="0 0 24 24" fill="#0d5c4b" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2zm0-10h2v8h-2z"/></svg>
                            </td>
                            <td valign="middle">
                              <div style="font-size:10.5px; color:#555555; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Action</div>
                              <div style="font-size:14px; color:#0d5c4b; font-weight:bold;">Login / Register</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="2%" align="center" valign="middle" style="padding:10px 0;">
                        <div style="width:1px; height:34px; background-color:#b9d4ca;"></div>
                      </td>
                      <td width="49%" valign="middle" style="padding:14px 16px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td valign="middle" style="padding-right:10px;">
                              <svg viewBox="0 0 24 24" fill="none" stroke="#0d5c4b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
                            </td>
                            <td valign="middle">
                              <div style="font-size:10.5px; color:#555555; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Session Validity</div>
                              <div style="font-size:14px; color:#0d5c4b; font-weight:bold;">10 Minutes</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- OTP VOUCHER BOX -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e3f1ec; border:2px dashed #0d5c4b; border-radius:10px; margin:20px 0;">
                    <tr>
                      <td align="center" style="padding:22px 16px;">
                        <div style="font-size:11px; font-weight:700; color:#0d5c4b; letter-spacing:2px; text-transform:uppercase; margin-bottom:6px;">\u2605 ONE-TIME PASSWORD \u2605</div>
                        <div class="otp-val" style="font-family:'Space Mono', 'Courier New', Courier, monospace; font-size:36px; font-weight:700; letter-spacing:8px; color:#0d5c4b; margin:6px 0 10px 8px;">${otp}</div>
                        <div style="display:inline-block; font-size:10.5px; color:#ffffff; font-weight:600; background-color:#0d5c4b; padding:3px 14px; border-radius:12px;">DO NOT SHARE THIS CODE</div>
                      </td>
                    </tr>
                  </table>

                  <!-- ACCESS PROTOCOL SUMMARY -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px; margin-bottom:6px;">
                    <tr>
                      <td align="left" style="font-size:12px; font-weight:bold; letter-spacing:1px; color:#111111;">PORTAL ACCESS PROTOCOL</td>
                      <td align="right" style="font-size:10px; font-weight:bold; letter-spacing:1px; color:#0d5c4b;">VERIFIED</td>
                    </tr>
                  </table>
                  <div style="border-top:1px dashed #cccccc; margin-bottom:8px;"></div>

                  <!-- ROW 1 -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #f0f0f0;">
                    <tr>
                      <td width="28" valign="middle" style="padding:10px 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0d5c4b" stroke-width="1.8" width="20" height="20"><path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
                      </td>
                      <td valign="middle" style="padding:10px 8px;">
                        <div style="font-size:13px; font-weight:bold; color:#111111;">Invoicing &amp; Billing Data</div>
                        <div style="font-size:11px; color:#666666;">Secure End-to-End Encryption</div>
                      </td>
                      <td align="right" valign="middle" style="padding:10px 0; font-size:12px; font-weight:bold; color:#0d5c4b;">
                        LOCKED
                      </td>
                    </tr>
                  </table>

                  <!-- ROW 2 -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #f0f0f0;">
                    <tr>
                      <td width="28" valign="middle" style="padding:10px 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0d5c4b" stroke-width="1.8" width="20" height="20"><path d="M12 2 3 6.5 12 11l9-4.5z"/><path d="M3 6.5v11L12 22l9-4.5v-11"/><path d="M12 11v11"/></svg>
                      </td>
                      <td valign="middle" style="padding:10px 8px;">
                        <div style="font-size:13px; font-weight:bold; color:#111111;">Inventory &amp; Warehouses</div>
                        <div style="font-size:11px; color:#666666;">Multi-Store Access Protection</div>
                      </td>
                      <td align="right" valign="middle" style="padding:10px 0; font-size:12px; font-weight:bold; color:#0d5c4b;">
                        PROTECTED
                      </td>
                    </tr>
                  </table>

                  <!-- CTA BUTTON -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px;">
                    <tr>
                      <td align="center">
                        <a href="https://invocentric.in/" target="_blank" style="display:inline-block; background-color:#0d5c4b; color:#ffffff !important; text-decoration:none; font-weight:bold; letter-spacing:0.8px; font-size:14px; padding:13px 34px; border-radius:8px; box-shadow:0 4px 12px rgba(13,92,75,0.25);">
                          CONTINUE TO INVOCENTRIC &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size:11px; color:#777777; text-align:center; margin:4px 0 18px;">
                    If you did not initiate this request, please ignore this email or contact support.
                  </p>

                  <div style="border-top:1px dashed #cccccc; margin-bottom:14px;"></div>

                  <!-- BARCODE & FOOTER -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <svg viewBox="0 0 300 36" width="210" height="26" style="display:block; margin:0 auto 10px;">
                          <g fill="#222222">
                            <rect x="0" y="0" width="2" height="36"/><rect x="5" y="0" width="1" height="36"/><rect x="9" y="0" width="3" height="36"/><rect x="15" y="0" width="1" height="36"/><rect x="19" y="0" width="2" height="36"/><rect x="24" y="0" width="1" height="36"/><rect x="28" y="0" width="1" height="36"/><rect x="32" y="0" width="3" height="36"/><rect x="38" y="0" width="1" height="36"/><rect x="42" y="0" width="2" height="36"/><rect x="47" y="0" width="1" height="36"/><rect x="51" y="0" width="1" height="36"/><rect x="55" y="0" width="3" height="36"/><rect x="61" y="0" width="1" height="36"/><rect x="65" y="0" width="2" height="36"/><rect x="70" y="0" width="1" height="36"/><rect x="74" y="0" width="3" height="36"/><rect x="80" y="0" width="1" height="36"/><rect x="84" y="0" width="1" height="36"/><rect x="88" y="0" width="2" height="36"/><rect x="93" y="0" width="1" height="36"/><rect x="97" y="0" width="3" height="36"/><rect x="103" y="0" width="1" height="36"/><rect x="107" y="0" width="2" height="36"/><rect x="112" y="0" width="1" height="36"/><rect x="116" y="0" width="1" height="36"/><rect x="120" y="0" width="3" height="36"/><rect x="126" y="0" width="2" height="36"/><rect x="131" y="0" width="1" height="36"/><rect x="135" y="0" width="1" height="36"/><rect x="139" y="0" width="3" height="36"/><rect x="145" y="0" width="1" height="36"/><rect x="149" y="0" width="2" height="36"/><rect x="154" y="0" width="1" height="36"/><rect x="158" y="0" width="1" height="36"/><rect x="162" y="0" width="3" height="36"/><rect x="168" y="0" width="2" height="36"/><rect x="173" y="0" width="1" height="36"/><rect x="177" y="0" width="3" height="36"/><rect x="183" y="0" width="1" height="36"/><rect x="187" y="0" width="1" height="36"/><rect x="191" y="0" width="2" height="36"/><rect x="196" y="0" width="1" height="36"/><rect x="200" y="0" width="3" height="36"/><rect x="206" y="0" width="1" height="36"/><rect x="210" y="0" width="2" height="36"/><rect x="215" y="0" width="1" height="36"/><rect x="219" y="0" width="1" height="36"/><rect x="223" y="0" width="3" height="36"/><rect x="229" y="0" width="2" height="36"/><rect x="234" y="0" width="1" height="36"/><rect x="238" y="0" width="1" height="36"/><rect x="242" y="0" width="3" height="36"/><rect x="248" y="0" width="1" height="36"/><rect x="252" y="0" width="2" height="36"/><rect x="257" y="0" width="1" height="36"/><rect x="261" y="0" width="3" height="36"/><rect x="267" y="0" width="1" height="36"/><rect x="271" y="0" width="1" height="36"/><rect x="275" y="0" width="2" height="36"/><rect x="280" y="0" width="1" height="36"/><rect x="284" y="0" width="3" height="36"/><rect x="290" y="0" width="1" height="36"/><rect x="294" y="0" width="2" height="36"/>
                          </g>
                        </svg>
                        <div style="font-size:10px; letter-spacing:1px; color:#555555; text-transform:uppercase; margin-bottom:2px;">SECURE ENTERPRISE AUTHENTICATION</div>
                        <div style="font-size:11.5px; font-weight:bold; color:#0d5c4b;">More than billing. Built for your business.</div>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
              </div>
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

<script>
function reprint() {
  const wrap = document.getElementById('receiptWrap');
  const led = document.getElementById('led');
  if (!wrap) return;
  wrap.style.animation = 'none';
  if (led) {
    led.style.animation = 'none';
    led.style.backgroundColor = '#e74c3c';
    led.style.boxShadow = '0 0 10px #e74c3c';
  }
  void wrap.offsetWidth;
  wrap.style.animation = 'thermalPrint 3.2s cubic-bezier(0.25, 1, 0.4, 1) forwards';
  if (led) {
    led.style.animation = 'ledBlink 0.35s infinite alternate ease-in-out';
    led.style.backgroundColor = '#2ecc71';
    led.style.boxShadow = '0 0 10px #2ecc71';
  }
}
</script>

</body>
</html>`;
}
var OTP_SECRET = process.env.VITE_ENCRYPTION_KEY || process.env.FIREBASE_API_KEY || "invocentric-otp-secure-key-2026";
function generateOtpToken(email, otp, expires) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();
  const payload = `${cleanEmail}:${cleanOtp}:${expires}`;
  const hmac = import_crypto.default.createHmac("sha256", OTP_SECRET).update(payload).digest("hex");
  return `${expires}.${hmac}`;
}
function verifyOtpToken(email, otp, token) {
  try {
    if (!token || typeof token !== "string") {
      return { valid: false, error: "OTP expired or invalid. Please request a new code." };
    }
    const parts = token.split(".");
    if (parts.length !== 2) {
      return { valid: false, error: "OTP expired or invalid. Please request a new code." };
    }
    const expires = parseInt(parts[0], 10);
    const tokenHmac = parts[1];
    if (isNaN(expires) || !tokenHmac) {
      return { valid: false, error: "OTP expired or invalid. Please request a new code." };
    }
    if (Date.now() > expires) {
      return { valid: false, error: "OTP expired or invalid. Please request a new code." };
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const payload = `${cleanEmail}:${cleanOtp}:${expires}`;
    const expectedHmac = import_crypto.default.createHmac("sha256", OTP_SECRET).update(payload).digest("hex");
    const expectedBuf = Buffer.from(expectedHmac, "hex");
    const tokenBuf = Buffer.from(tokenHmac, "hex");
    if (expectedBuf.length !== tokenBuf.length || !import_crypto.default.timingSafeEqual(expectedBuf, tokenBuf)) {
      return { valid: false, error: "Incorrect verification code. Please try again." };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: "OTP expired or invalid. Please request a new code." };
  }
}
app.post("/api/auth/send-email-otp", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string" || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address (max 100 characters)." });
  }
  const key = email.trim().toLowerCase();
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  const emailTrack = getSecurityRecord(key);
  const ipTrack = getSecurityRecord(clientIp);
  if (emailTrack.lockedUntil > Date.now() || ipTrack.lockedUntil > Date.now()) {
    const remainingMin = Math.ceil((Math.max(emailTrack.lockedUntil, ipTrack.lockedUntil) - Date.now()) / 6e4);
    return res.status(429).json({ error: `Too many failed attempts. Temporary safety cooldown active for ${remainingMin} minute(s).` });
  }
  if (emailTrack.lastOtpRequestTime && Date.now() - emailTrack.lastOtpRequestTime < 6e4) {
    const waitSec = Math.ceil((6e4 - (Date.now() - emailTrack.lastOtpRequestTime)) / 1e3);
    return res.status(429).json({ error: `Please wait ${waitSec} seconds before requesting a new verification code.` });
  }
  if ((emailTrack.otpRequestsThisHour || 0) >= 5 || (ipTrack.otpRequestsThisHour || 0) >= 10) {
    return res.status(429).json({ error: "Maximum verification code requests reached for this hour. Please try again later." });
  }
  emailTrack.lastOtpRequestTime = Date.now();
  emailTrack.otpRequestsThisHour = (emailTrack.otpRequestsThisHour || 0) + 1;
  ipTrack.otpRequestsThisHour = (ipTrack.otpRequestsThisHour || 0) + 1;
  const otp = import_crypto.default.randomInt(1e5, 1e6).toString();
  const expires = Date.now() + 10 * 60 * 1e3;
  emailOtpStore.set(key, { otp, expires });
  const otpToken = generateOtpToken(key, otp, expires);
  const businessName = email.split("@")[0] || "Business Partner";
  const html = generateOtpEmailTemplate({
    otp,
    businessName
  });
  const text = `Hi ${businessName},

Your InvoCentric verification code is: ${otp}

This code is valid for 10 minutes. Do not share this with anyone.

- InvoCentric Team`;
  const result = await dispatchEmail({
    to: email.trim(),
    subject: `Your InvoCentric Verification Code: ${otp}`,
    html,
    text
  });
  if (result.success) {
    return res.json({
      success: true,
      message: "OTP sent successfully to your email! Valid for 10 minutes.",
      otpToken
    });
  } else {
    console.log(`[Development OTP Fallback] Email: ${email}, OTP: ${otp}`);
    return res.json({
      success: true,
      message: "OTP generated successfully!",
      devOtp: otp,
      otpToken
    });
  }
});
app.post("/api/auth/verify-email-otp", async (req, res) => {
  const { email, otp, otpToken } = req.body;
  if (!email || !otp || typeof email !== "string" || typeof otp !== "string" || email.length > 100 || otp.length > 10) {
    return res.status(400).json({ error: "Email and verification code are required." });
  }
  const key = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  const emailTrack = getSecurityRecord(key);
  const ipTrack = getSecurityRecord(clientIp);
  if (emailTrack.lockedUntil > Date.now() || ipTrack.lockedUntil > Date.now()) {
    const remainingMin = Math.ceil((Math.max(emailTrack.lockedUntil, ipTrack.lockedUntil) - Date.now()) / 6e4);
    return res.status(429).json({ error: `Too many failed attempts. Security lockout active for ${remainingMin} minute(s).` });
  }
  let isValid = false;
  let errorMsg = "OTP expired or invalid. Please request a new code.";
  if (otpToken && typeof otpToken === "string") {
    const verification = verifyOtpToken(key, cleanOtp, otpToken);
    if (verification.valid) {
      isValid = true;
    } else {
      errorMsg = verification.error || errorMsg;
    }
  } else {
    const record = emailOtpStore.get(key);
    if (record && record.expires >= Date.now() && record.otp === cleanOtp) {
      isValid = true;
    }
  }
  if (!isValid) {
    emailTrack.failedAttempts += 1;
    ipTrack.failedAttempts += 1;
    if (emailTrack.failedAttempts >= 5 || ipTrack.failedAttempts >= 5) {
      emailTrack.lockedUntil = Date.now() + 15 * 60 * 1e3;
      ipTrack.lockedUntil = Date.now() + 15 * 60 * 1e3;
      return res.status(429).json({ error: "Too many incorrect verification attempts. Account locked for 15 minutes for your security." });
    }
    return res.status(400).json({ error: errorMsg });
  }
  emailTrack.failedAttempts = 0;
  emailTrack.lockedUntil = 0;
  ipTrack.failedAttempts = 0;
  emailOtpStore.delete(key);
  return res.json({ success: true, email: key });
});
var mobileAuthSessions = /* @__PURE__ */ new Map();
app.post("/api/auth/mobile-session", (req, res) => {
  const { sessionId, status, idToken, accessToken, uid, email, displayName, photoURL } = req.body;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required." });
  }
  const existing = mobileAuthSessions.get(sessionId);
  mobileAuthSessions.set(sessionId, {
    ...existing || {},
    status: status || "authenticated",
    idToken: idToken !== void 0 ? idToken : existing?.idToken,
    accessToken: accessToken !== void 0 ? accessToken : existing?.accessToken,
    uid: uid !== void 0 ? uid : existing?.uid,
    email: email !== void 0 ? email : existing?.email,
    displayName: displayName !== void 0 ? displayName : existing?.displayName,
    photoURL: photoURL !== void 0 ? photoURL : existing?.photoURL,
    expires: Date.now() + 10 * 60 * 1e3
    // 10 minutes
  });
  return res.json({ success: true, sessionId });
});
app.get("/api/auth/mobile-session", (req, res) => {
  const sessionId = (req.query.session || req.query.sessionId)?.toString();
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required." });
  }
  const record = mobileAuthSessions.get(sessionId);
  if (!record || record.expires < Date.now()) {
    return res.json({ status: "not_found" });
  }
  return res.json(record);
});
var usersDbPath = import_path.default.resolve(process.cwd(), "users_db.json");
var PASSWORD_PEPPER = process.env.VITE_ENCRYPTION_KEY || process.env.FIREBASE_API_KEY || "invocentric-secure-pepper-2026";
function hashPassword(password) {
  return import_crypto.default.createHmac("sha256", PASSWORD_PEPPER).update(password.trim()).digest("hex");
}
function verifyPassword(inputPassword, storedHashOrPlain) {
  if (!inputPassword || !storedHashOrPlain) return false;
  const clean = inputPassword.trim();
  const hashed = hashPassword(clean);
  try {
    const expectedBuf = Buffer.from(hashed, "hex");
    const storedBuf = Buffer.from(storedHashOrPlain, "hex");
    if (expectedBuf.length === storedBuf.length && import_crypto.default.timingSafeEqual(expectedBuf, storedBuf)) {
      return true;
    }
  } catch (e) {
  }
  if (storedHashOrPlain === clean) {
    return true;
  }
  return false;
}
function loadUsersDb() {
  try {
    if (import_fs.default.existsSync(usersDbPath)) {
      return JSON.parse(import_fs.default.readFileSync(usersDbPath, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading users db:", e);
  }
  return {};
}
function saveUsersDb(db) {
  try {
    import_fs.default.writeFileSync(usersDbPath, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing users db:", e);
  }
}
app.post("/api/auth/check-user", (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string" || email.length > 100) return res.status(400).json({ error: "Email required" });
  const db = loadUsersDb();
  const exists = !!db[email.trim().toLowerCase()];
  res.json({ exists });
});
app.post("/api/auth/register-password", async (req, res) => {
  const { email, password, otp, otpToken } = req.body;
  if (!email || !password || !otp || typeof email !== "string" || typeof password !== "string" || email.length > 100 || password.length > 128) {
    return res.status(400).json({ error: "Email, password, and verification code are required." });
  }
  const key = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();
  if (otpToken && typeof otpToken === "string") {
    const verification = verifyOtpToken(key, cleanOtp, otpToken);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error || "OTP expired or invalid. Please request a new code." });
    }
  } else {
    const record = emailOtpStore.get(key);
    if (!record || record.expires < Date.now()) {
      return res.status(400).json({ error: "OTP expired or invalid. Please request a new code." });
    }
    if (record.otp !== cleanOtp) {
      return res.status(400).json({ error: "Incorrect verification code. Please try again." });
    }
  }
  const db = loadUsersDb();
  db[key] = {
    email: key,
    passwordHash: hashPassword(password),
    name: key.split("@")[0]
  };
  saveUsersDb(db);
  emailOtpStore.delete(key);
  return res.json({
    success: true,
    user: {
      uid: "user_" + key.replace(/[^a-zA-Z0-9]/g, "_"),
      email: key,
      displayName: key.split("@")[0],
      emailVerified: true
    }
  });
});
app.post("/api/auth/login-password", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== "string" || typeof password !== "string" || email.length > 100 || password.length > 128) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const key = email.trim().toLowerCase();
  const rawPass = String(password).trim();
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  const emailTrack = getSecurityRecord(key);
  const ipTrack = getSecurityRecord(clientIp);
  if (emailTrack.lockedUntil > Date.now() || ipTrack.lockedUntil > Date.now()) {
    const remainingMin = Math.ceil((Math.max(emailTrack.lockedUntil, ipTrack.lockedUntil) - Date.now()) / 6e4);
    return res.status(429).json({ error: `Too many incorrect password attempts. Security lockout active for ${remainingMin} minute(s).` });
  }
  const db = loadUsersDb();
  const userRecord = db[key];
  if (!userRecord || !verifyPassword(rawPass, userRecord.passwordHash)) {
    emailTrack.failedAttempts += 1;
    ipTrack.failedAttempts += 1;
    if (emailTrack.failedAttempts >= 5 || ipTrack.failedAttempts >= 5) {
      emailTrack.lockedUntil = Date.now() + 15 * 60 * 1e3;
      ipTrack.lockedUntil = Date.now() + 15 * 60 * 1e3;
      return res.status(429).json({ error: "Too many incorrect password attempts. Account locked for 15 minutes for your security." });
    }
    return res.status(400).json({ error: "Invalid email or password. Click 'Forgot password?' to set or reset your password via OTP." });
  }
  if (userRecord.passwordHash === rawPass) {
    userRecord.passwordHash = hashPassword(rawPass);
    saveUsersDb(db);
  }
  emailTrack.failedAttempts = 0;
  emailTrack.lockedUntil = 0;
  ipTrack.failedAttempts = 0;
  return res.json({
    success: true,
    user: {
      uid: "user_" + key.replace(/[^a-zA-Z0-9]/g, "_"),
      email: key,
      displayName: userRecord.name || key.split("@")[0],
      emailVerified: true
    }
  });
});
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, password, otp, otpToken } = req.body;
  if (!email || !password || !otp || typeof email !== "string" || typeof password !== "string" || email.length > 100 || password.length > 128) {
    return res.status(400).json({ error: "Email, new password, and verification code are required." });
  }
  const key = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();
  if (otpToken && typeof otpToken === "string") {
    const verification = verifyOtpToken(key, cleanOtp, otpToken);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error || "OTP expired or invalid. Please request a new code." });
    }
  } else {
    const record = emailOtpStore.get(key);
    if (!record || record.expires < Date.now()) {
      return res.status(400).json({ error: "OTP expired or invalid. Please request a new code." });
    }
    if (record.otp !== cleanOtp) {
      return res.status(400).json({ error: "Incorrect verification code. Please try again." });
    }
  }
  const db = loadUsersDb();
  db[key] = {
    email: key,
    passwordHash: hashPassword(password),
    name: key.split("@")[0]
  };
  saveUsersDb(db);
  emailOtpStore.delete(key);
  return res.json({
    success: true,
    user: {
      uid: "user_" + key.replace(/[^a-zA-Z0-9]/g, "_"),
      email: key,
      displayName: db[key].name,
      emailVerified: true
    }
  });
});
var aiClient = null;
function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. AI features will not work.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
function isQuotaOrRateLimitError(error) {
  const errMessage = (typeof error?.message === "string" ? error.message : JSON.stringify(error || "")).toLowerCase();
  const errStatus = String(error?.status || error?.error?.status || "").toLowerCase();
  const errCode = String(error?.code || error?.status || error?.error?.code || "");
  return errMessage.includes("resource_exhausted") || errMessage.includes("quota exceeded") || errMessage.includes("rate exceeded") || errMessage.includes("rate limit") || errMessage.includes("limit exceeded") || errMessage.includes("429") || errStatus.includes("resource_exhausted") || errCode === "429";
}
async function generateContentWithRetry(aiInstance, params, maxRetries = 3) {
  let lastError = null;
  const initialModel = params.model || "gemini-3.6-flash";
  const candidateModels = [initialModel, "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-2.5-pro", "gemini-1.5-flash"];
  const modelsToTry = Array.from(new Set(candidateModels));
  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI Request] Attempting with model: ${model} (Attempt ${attempt}/${maxRetries})...`);
        const response = await aiInstance.models.generateContent({
          ...params,
          model
        });
        console.log(`[AI Request] Success with model: ${model}`);
        return response;
      } catch (err) {
        lastError = err;
        const errMessage = typeof err?.message === "string" ? err.message : JSON.stringify(err || "");
        const errStatus = String(err?.status || err?.error?.status || "");
        const errCode = String(err?.code || err?.status || err?.error?.code || "");
        console.warn(`[AI Request] Attempt ${attempt} failed for model ${model}:`, errMessage);
        const lowerMessage = errMessage.toLowerCase();
        const lowerStatus = String(errStatus).toLowerCase();
        const isTransient = lowerMessage.includes("503") || lowerMessage.includes("unavailable") || lowerMessage.includes("429") || lowerMessage.includes("resource_exhausted") || lowerMessage.includes("quota exceeded") || lowerMessage.includes("rate exceeded") || lowerMessage.includes("rate limit") || lowerMessage.includes("limit exceeded") || lowerMessage.includes("high demand") || lowerStatus.includes("unavailable") || lowerStatus.includes("resource_exhausted") || errCode === "503" || errCode === "429";
        if (isTransient) {
          if (attempt < maxRetries) {
            const delay = attempt * 1200 + Math.floor(Math.random() * 600);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            console.warn(`[AI Request] Model ${model} unavailable after ${maxRetries} attempts, attempting fallback model if available...`);
            break;
          }
        } else {
          break;
        }
      }
    }
  }
  throw lastError;
}
async function fetchUserDoc(uid, idToken) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${uid}?key=${apiKey}`;
  const headers = {
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
async function isUserPro(uid, email, idToken) {
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
  if (base64Image.length > 2e7) {
    return res.status(413).json({ error: "INVALID_INPUT", message: "File payload exceeds size limit (max 15MB)." });
  }
  try {
    const isPro = await isUserPro(req.user.uid, req.user.email, req.user.idToken);
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
          type: import_genai.Type.OBJECT,
          properties: {
            customerName: { type: import_genai.Type.STRING },
            supplierName: { type: import_genai.Type.STRING },
            supplierGst: { type: import_genai.Type.STRING },
            supplierPhone: { type: import_genai.Type.STRING },
            supplierAddress: { type: import_genai.Type.STRING },
            invoiceNo: { type: import_genai.Type.STRING },
            invoiceDate: { type: import_genai.Type.STRING },
            supplierBillNo: { type: import_genai.Type.STRING },
            dueDate: { type: import_genai.Type.STRING },
            currency: { type: import_genai.Type.STRING },
            subTotal: { type: import_genai.Type.NUMBER },
            discount: { type: import_genai.Type.NUMBER },
            taxableAmount: { type: import_genai.Type.NUMBER },
            cgst: { type: import_genai.Type.NUMBER },
            sgst: { type: import_genai.Type.NUMBER },
            roundOff: { type: import_genai.Type.NUMBER },
            totalAmount: { type: import_genai.Type.NUMBER },
            items: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  description: { type: import_genai.Type.STRING },
                  hsn: { type: import_genai.Type.STRING },
                  barcode: { type: import_genai.Type.STRING },
                  batchNo: { type: import_genai.Type.STRING },
                  serialNo: { type: import_genai.Type.STRING },
                  quantity: { type: import_genai.Type.NUMBER },
                  rate: { type: import_genai.Type.NUMBER },
                  price: { type: import_genai.Type.NUMBER },
                  gstPercent: { type: import_genai.Type.NUMBER },
                  amount: { type: import_genai.Type.NUMBER }
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
  } catch (error) {
    const correlationId = generateCorrelationId();
    console.error(`[${correlationId}] AI Extraction Error server-side:`, error);
    if (isQuotaOrRateLimitError(error)) {
      return res.status(429).json({
        success: false,
        error: "QUOTA_EXCEEDED",
        message: "Your request hit Gemini API's rate limits or daily quota. Please wait a minute or try again later. For permanent high-volume access, consider attaching a custom billing key in the application settings.",
        correlationId
      });
    }
    res.status(500).json({
      success: false,
      error: "EXTRACTION_FAILED",
      message: "Failed to extract invoice data. Please verify the image size or quality and try again.",
      correlationId
    });
  }
});
app.post("/api/extract-product", checkAuth, async (req, res) => {
  const { base64Image, mimeType } = req.body;
  if (!base64Image || !mimeType) {
    return res.status(400).json({ error: "Missing base64Image or mimeType in request body." });
  }
  if (typeof base64Image !== "string" || typeof mimeType !== "string") {
    return res.status(400).json({ error: "INVALID_INPUT", message: "base64Image and mimeType must be valid strings." });
  }
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Unsupported file type. Only JPEG, PNG, WEBP, and GIF are supported." });
  }
  if (base64Image.length > 2e7) {
    return res.status(413).json({ error: "INVALID_INPUT", message: "File payload exceeds size limit (max 15MB)." });
  }
  try {
    const aiInstance = getAI();
    const prompt = `Analyze this product packaging, label, or product image and extract ALL product catalog details accurately. Inspect all visible text, price marks, nutrition/spec tables, batch codes, and barcode stripes.
Extract:
1. name: Exact product title and name.
2. brand: Brand or manufacturer name.
3. category: Product category (e.g. Grocery, Snacks, Electronics, Personal Care, Dairy, Stationery, Hardware, Beverages, Medicine, Fashion, etc.).
4. barcode: Barcode or UPC / EAN-13 / GTIN digits. Look carefully at any barcode stripes on the packaging and extract the complete digits printed directly under or beside the barcode lines. If not visible, return empty string.
5. mrp: Maximum Retail Price (\u20B9 / MRP) printed on packaging or label. Number only.
6. price: Selling price / retail price (\u20B9) if stated or reasonable price (default to MRP if only MRP is present).
7. wholesalePrice: Wholesale / bulk price if stated, otherwise 0.
8. costPrice: Purchase or cost price if stated, otherwise 0.
9. discount: Discount percentage (%) if stated on packaging (e.g. '20% OFF' -> 20), otherwise 0.
10. gstPercent: Standard Indian GST tax percentage (0, 5, 12, 18, or 28) for this product category.
11. hsn: HSN or SAC code if printed on packaging, or the standard HSN code for this category.
12. unit: Standard unit (Pcs, Kg, Gm, Ltr, Ml, Box, Pack, Bottle, Can, Meter, etc.).
13. size: Net quantity, net weight, or volume (e.g. "500 g", "1 L", "100 ml", "Pack of 10", "Size XL").
14. stock: Quantity per pack or stated count (e.g. 1, 6, 10, 24).
15. serialNumber: Serial Number, S/N, IMEI, or unique device identifier if visible on electronics/devices.
16. custom_box: Batch Number, Expiry Date, or Manufacturing Date if printed (e.g. 'Batch: B102 | Exp: 12/2026').
17. description: Short, clear description of the product and its features.
Ensure the response is valid JSON matching the schema.`;
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
          type: import_genai.Type.OBJECT,
          properties: {
            name: { type: import_genai.Type.STRING },
            brand: { type: import_genai.Type.STRING },
            category: { type: import_genai.Type.STRING },
            barcode: { type: import_genai.Type.STRING },
            mrp: { type: import_genai.Type.NUMBER },
            price: { type: import_genai.Type.NUMBER },
            wholesalePrice: { type: import_genai.Type.NUMBER },
            costPrice: { type: import_genai.Type.NUMBER },
            discount: { type: import_genai.Type.NUMBER },
            hsn: { type: import_genai.Type.STRING },
            unit: { type: import_genai.Type.STRING },
            size: { type: import_genai.Type.STRING },
            stock: { type: import_genai.Type.NUMBER },
            serialNumber: { type: import_genai.Type.STRING },
            custom_box: { type: import_genai.Type.STRING },
            gstPercent: { type: import_genai.Type.NUMBER },
            description: { type: import_genai.Type.STRING }
          },
          required: ["name"]
        }
      }
    });
    const text = response.text;
    if (!text) {
      throw new Error("No data returned from AI");
    }
    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (error) {
    const correlationId = generateCorrelationId();
    console.error(`[${correlationId}] AI Product Extraction Error server-side:`, error);
    if (isQuotaOrRateLimitError(error)) {
      return res.status(429).json({
        success: false,
        error: "QUOTA_EXCEEDED",
        message: "Gemini API rate limit reached. Please try again in a moment.",
        correlationId
      });
    }
    res.status(500).json({
      success: false,
      error: "EXTRACTION_FAILED",
      message: "Failed to extract product data from image.",
      correlationId
    });
  }
});
app.post("/api/parse-contact", checkAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Missing text in request body." });
  }
  if (typeof text !== "string" || text.length > 1e4) {
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
          type: import_genai.Type.OBJECT,
          properties: {
            name: { type: import_genai.Type.STRING },
            phone: { type: import_genai.Type.STRING },
            company_name: { type: import_genai.Type.STRING },
            email: { type: import_genai.Type.STRING },
            address: { type: import_genai.Type.STRING },
            gst_number: { type: import_genai.Type.STRING }
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
  } catch (error) {
    const correlationId = generateCorrelationId();
    console.error(`[${correlationId}] AI Parse Contact Error server-side:`, error);
    if (isQuotaOrRateLimitError(error)) {
      return res.status(429).json({
        success: false,
        error: "QUOTA_EXCEEDED",
        message: "Your request hit Gemini API's rate limits or daily quota. Please wait a minute or try again later. For permanent high-volume access, consider attaching a custom billing key in the application settings.",
        correlationId
      });
    }
    res.status(500).json({
      success: false,
      error: "PARSE_FAILED",
      message: "Failed to parse contact data.",
      correlationId
    });
  }
});
var processedTelegramEvents = /* @__PURE__ */ new Set();
function markEventProcessed(eventId) {
  if (processedTelegramEvents.has(eventId)) {
    return true;
  }
  if (processedTelegramEvents.size > 2e3) {
    const firstItem = processedTelegramEvents.values().next().value;
    if (firstItem) processedTelegramEvents.delete(firstItem);
  }
  processedTelegramEvents.add(eventId);
  return false;
}
async function sendTelegramAdminNotification(messageText, eventId) {
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
    const timeout = setTimeout(() => controller.abort(), 6e3);
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
      await new Promise((r) => setTimeout(r, 1e3));
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
  } catch (err) {
    console.error("[Telegram] Network exception while sending notification:", err.message || err);
    return { success: false, error: err.message || "Network error" };
  }
}
app.post("/api/notify-login", authEmailLimiter, checkAuth, async (req, res) => {
  const user = req.user;
  const userId = user.uid;
  const userEmail = user.email || "Unknown Email";
  const idToken = user.idToken;
  try {
    const timeBucket = Math.floor(Date.now() / (15 * 60 * 1e3));
    const eventId = `login_${userId}_${timeBucket}`;
    const userDoc = await fetchUserDoc(userId, idToken);
    const userName = userDoc?.fields?.display_name?.stringValue || userEmail.split("@")[0] || "User";
    const localDateAndTime = (/* @__PURE__ */ new Date()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    const telegramMessage = `\u{1F510} NEW USER LOGIN

\u{1F464} User: ${userName}
\u{1F4E7} Email: ${userEmail}
\u{1F552} Login Time: ${localDateAndTime}`;
    const telegramResult = await sendTelegramAdminNotification(telegramMessage, eventId);
    res.status(200).json({
      success: true,
      telegram: telegramResult
    });
  } catch (error) {
    console.error("Login notification route error:", error);
    res.status(200).json({ success: false, error: error.message });
  }
});
app.post("/api/subscription/notify-pending", authEmailLimiter, checkAuth, async (req, res) => {
  const { amount, billingCycle, upiId } = req.body;
  const user = req.user;
  const userId = user.uid;
  const idToken = user.idToken;
  const userEmail = user.email || "Unknown Email";
  if (!amount || !billingCycle || !upiId) {
    return res.status(400).json({ error: "Missing subscription details." });
  }
  const adminEmail = "nomanshaikh1999@gmail.com";
  const notificationText = `\u{1F6A8} *InvoCentric Alert* \u{1F6A8}

New UPI Subscription payment submitted for verification!

User: ${userEmail}
Plan Cycle: ${billingCycle.toUpperCase()}
Amount: \u20B9${amount}
UPI ID / UTR Ref No: ${upiId}

Please match this with your SBI Yono App/Account and approve/reject it in the Admin Panel.

Admin Panel: https://invocentric.in/admin`;
  const results = {
    email: false,
    whatsappCallMeBot: false,
    twilio: false,
    telegram: { success: false },
    errors: []
  };
  try {
    const userDoc = await fetchUserDoc(userId, idToken);
    const userName = userDoc?.fields?.display_name?.stringValue || userEmail.split("@")[0] || "User";
    const localDateAndTime = (/* @__PURE__ */ new Date()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    const planName = billingCycle === "yearly" ? "InvoCentric Pro (Yearly)" : "InvoCentric Pro (Monthly)";
    const telegramMessage = `\u{1F4B3} NEW PRO PLAN PAYMENT REQUEST

\u{1F464} User: ${userName}
\u{1F4E7} Email: ${userEmail}
\u{1F4E6} Plan: ${planName}
\u{1F4B0} Amount: \u20B9${amount}
\u{1F9FE} Transaction ID: ${upiId}
\u{1F552} Submitted: ${localDateAndTime}
\u{1F4CC} Status: Pending Admin Approval`;
    const eventId = `payment_${userId}_${upiId}`;
    results.telegram = await sendTelegramAdminNotification(telegramMessage, eventId);
  } catch (tgErr) {
    console.error("Failed to send Telegram admin notification:", tgErr);
    results.errors.push(`Telegram Error: ${tgErr.message || tgErr}`);
  }
  try {
    const emailRes = await dispatchEmail({
      to: adminEmail,
      subject: `\u{1F6A8} ACTION REQUIRED: UPI Subscription Verification (\u20B9${amount}) - Ref: ${upiId}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 40px;">\u{1F6A8}</span>
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
                <td style="padding: 8px 0; color: #10b981; font-weight: 800; text-align: right;">\u20B9${amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">UTR / UPI ID Ref No:</td>
                <td style="padding: 8px 0; color: #166534; font-family: monospace; font-weight: 800; text-align: right; font-size: 14px;">${upiId}</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            Please open your <strong>State Bank of India (SBI)</strong> account or check your SMS transactions to verify if \u20B9${amount} was received matching transaction reference <strong>${upiId}</strong>.
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
  } catch (err) {
    console.error("Failed to send admin alert email:", err);
    results.errors.push(`Email Error: ${err.message || err}`);
  }
  const callMeBotKey = process.env.CALLMEBOT_WHATSAPP_API_KEY;
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (callMeBotKey && adminPhone) {
    try {
      const cleanPhone = adminPhone.replace(/\+/g, "").replace(/\s/g, "");
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(notificationText)}&apikey=${callMeBotKey}`;
      const response = await fetch(url);
      if (response.ok) {
        results.whatsappCallMeBot = true;
      } else {
        const text = await response.text();
        results.errors.push(`CallMeBot Error: status ${response.status}, ${text}`);
      }
    } catch (err) {
      console.error("Failed to send WhatsApp alert via CallMeBot:", err);
      results.errors.push(`CallMeBot Connection Error: ${err.message || err}`);
    }
  }
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  if (twilioSid && twilioAuthToken && twilioFrom && adminPhone) {
    try {
      const authHeader = Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString("base64");
      const isWhatsApp = twilioFrom.startsWith("whatsapp:");
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
    } catch (err) {
      console.error("Failed to send Twilio notification:", err);
      results.errors.push(`Twilio API Error: ${err.message || err}`);
    }
  }
  res.status(200).json({ success: true, results });
});
app.post("/api/subscription/approve-receipt", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  if (req.user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }
  const { userId, userEmail, amount, billingCycle, upiIdRef } = req.body;
  if (!userId || !userEmail || !amount || !billingCycle || !upiIdRef) {
    return res.status(400).json({ error: "Missing required approval details." });
  }
  try {
    const idToken = req.user.idToken;
    const userDoc = await fetchUserDoc(userId, idToken);
    const userName = userDoc?.fields?.display_name?.stringValue || userEmail.split("@")[0];
    const receiptNo = `INV-2026-${Math.floor(1e5 + Math.random() * 9e5)}`;
    const dateStr = (/* @__PURE__ */ new Date()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    doc.setFillColor(22, 101, 52);
    doc.rect(0, 0, 210, 8, "F");
    doc.setTextColor(22, 101, 52);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(26);
    doc.text("InvoCentric", 15, 25);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("Helvetica", "normal");
    doc.text("Professional Billing & Invoicing Made Simple", 15, 31);
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text("PAYMENT RECEIPT", 135, 25);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Thank you for subscribing to InvoCentric. Below is your official payment receipt.", 15, 42);
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
    let currentY = 48;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(15, currentY, 195, currentY);
    receiptFields.forEach((field, i) => {
      const rowY = currentY + i * 10;
      if (field.label === "Paid Amount") {
        doc.setFillColor(220, 252, 231);
        doc.rect(15, rowY, 180, 10, "F");
      } else if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, rowY, 180, 10, "F");
      }
      doc.setDrawColor(241, 245, 249);
      doc.line(15, rowY + 10, 195, rowY + 10);
      doc.setFontSize(9.5);
      doc.setFont("Helvetica", "bold");
      if (field.label === "Paid Amount") {
        doc.setTextColor(21, 128, 61);
      } else {
        doc.setTextColor(71, 85, 105);
      }
      doc.text(field.label, 18, rowY + 6.5);
      doc.setFont("Helvetica", field.label === "Paid Amount" ? "bold" : "normal");
      if (field.label === "Paid Amount") {
        doc.setFontSize(11);
        doc.setTextColor(21, 128, 61);
      } else {
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
      }
      doc.text(String(field.value), 80, rowY + 6.5);
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY, 15, currentY + 100);
    doc.line(195, currentY, 195, currentY + 100);
    doc.line(15, currentY + 100, 195, currentY + 100);
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
      doc.text(point, 15, termsY + 6 + idx * 5.5);
    });
    const contactY = termsY + 34;
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const contactText = "For any discrepancies, support inquiries, or billing issues, please contact our support team at support@invocentric.in or call +91 9824194869.";
    doc.text(contactText, 15, contactY, { maxWidth: 180 });
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
        created_at: { stringValue: (/* @__PURE__ */ new Date()).toISOString() }
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
    const receiptEmailResult = await dispatchEmail({
      to: userEmail,
      subject: "Your InvoCentric Payment Receipt",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 50%; padding: 12px; margin-bottom: 12px;">
              <span style="font-size: 32px; color: #15803d; line-height: 1;">\u2713</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Subscription Activated!</h2>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Welcome to InvoCentric Pro</p>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            Dear <strong>${userName}</strong>,
          </p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            Thank you for subscribing to InvoCentric. Below is your official payment receipt. Your <strong>InvoCentric Pro Account (${billingCycle === "yearly" ? "Yearly" : "Monthly"})</strong> has been activated successfully.
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
                <td style="padding: 6px 0; color: #166534; font-weight: 800; text-align: right;">\u20B9${amount}</td>
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
            InvoCentric \xA9 2026. All rights reserved.<br/>
            If you have any questions, reply to this email or write to <a href="mailto:support@invocentric.in" style="color: #166534; text-decoration: none; font-weight: 600;">support@invocentric.in</a> or call <strong style="color: #166534;">+91 9824194869</strong>.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Receipt-${receiptNo}.pdf`,
          content: pdfBuffer
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
  } catch (error) {
    console.error("Failed to approve subscription receipt:", error);
    res.status(500).json({ error: "Internal server error: " + (error.message || error) });
  }
});
app.get("/api/subscription/receipt-download/:receiptId", checkAuth, async (req, res) => {
  const { receiptId } = req.params;
  const idToken = req.user.idToken;
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
function parseFirestoreValue(value) {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("integerValue" in value) return parseInt(value.integerValue, 10);
  if ("doubleValue" in value) return parseFloat(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map((v) => parseFirestoreValue(v));
  }
  if ("mapValue" in value) {
    const parsed = {};
    const fields = value.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      parsed[key] = parseFirestoreValue(fields[key]);
    }
    return parsed;
  }
  return null;
}
function parseFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null;
  const id = doc.name.split("/").pop();
  const parsed = { id };
  for (const key of Object.keys(doc.fields)) {
    parsed[key] = parseFirestoreValue(doc.fields[key]);
  }
  return parsed;
}
async function fetchAllUsers(authHeader) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  let allUsers = [];
  const headers = {};
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
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
        const queryDocs = queryData.filter((item) => item && item.document).map((item) => item.document);
        if (queryDocs.length > 0) {
          allUsers = queryDocs;
        }
      }
    }
  } catch (err) {
    console.error("Error in fetchAllUsers runQuery strategy:", err);
  }
  if (allUsers.length === 0) {
    let nextPageToken = void 0;
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
async function logEmailDispatch(email, type, subject, status, errorMsg, extra) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/email_logs?key=${apiKey}`;
  const fields = {
    recipient_email: { stringValue: email },
    email_type: { stringValue: type },
    subject: { stringValue: subject },
    status: { stringValue: status },
    error: errorMsg ? { stringValue: errorMsg } : { nullValue: null },
    timestamp: { stringValue: (/* @__PURE__ */ new Date()).toISOString() },
    delivery_mode: { stringValue: extra?.delivery_mode || "Automatic" }
  };
  if (extra?.recipient_name) {
    fields.recipient_name = { stringValue: extra.recipient_name };
  }
  if (extra?.business_name) {
    fields.business_name = { stringValue: extra.business_name };
  }
  if (extra?.user_id) {
    fields.user_id = { stringValue: extra.user_id };
  }
  const payload = { fields };
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
async function updateUserInactivityReminderFields(uid, fields) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const updateMasks = [];
  const firestoreFields = {};
  for (const key of Object.keys(fields)) {
    updateMasks.push(`updateMask.fieldPaths=${key}`);
    const val = fields[key];
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
var customSmtpConfig = null;
async function getSmtpTransporter() {
  if (customSmtpConfig?.user && customSmtpConfig?.pass) {
    const port = Number(customSmtpConfig.port || 587);
    return {
      transporter: import_nodemailer.default.createTransport({
        host: customSmtpConfig.host || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: {
          user: customSmtpConfig.user,
          pass: customSmtpConfig.pass
        }
      }),
      from: `"${customSmtpConfig.fromName || "InvoCentric"}" <${customSmtpConfig.user}>`
    };
  }
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  if (smtpUser && smtpPass) {
    return {
      transporter: import_nodemailer.default.createTransport({
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
  return null;
}
async function dispatchEmail({
  to,
  subject,
  html,
  text,
  attachments
}) {
  let resendError = "";
  if (process.env.RESEND_API_KEY) {
    try {
      const resendPayload = {
        from: process.env.RESEND_FROM || "InvoCentric <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
        text
      };
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        resendPayload.attachments = attachments.map((att) => ({
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
    } catch (err) {
      resendError = err.message || String(err);
      console.warn(`[Resend API] Threw error (${resendError}). Automatically falling back to SMTP...`);
    }
  }
  try {
    const config = await getSmtpTransporter();
    if (!config) {
      return {
        success: false,
        error: resendError ? `Resend failed (${resendError}) and SMTP transporter is unconfigured.` : "SMTP Transporter and Resend API key both missing."
      };
    }
    const smtpUser = process.env.SMTP_USER || "no-reply@invocentric.app";
    const mailOptions = {
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
        encoding: typeof att.content === "string" ? "base64" : void 0
      }));
    }
    const info = await config.transporter.sendMail(mailOptions);
    const previewUrl = import_nodemailer.default.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[SMTP Fallback] Email sent to ${to}. Ethereal Preview: ${previewUrl}`);
    } else {
      console.log(`[SMTP Fallback] Email sent successfully to ${to}`);
    }
    return { success: true };
  } catch (smtpErr) {
    console.error("dispatchEmail SMTP fallback failed:", smtpErr);
    return {
      success: false,
      error: `Resend error: ${resendError || "none"} | SMTP error: ${smtpErr.message || String(smtpErr)}`
    };
  }
}
function generateInactivityEmailTemplate(input = "Business Partner", isPreview = false) {
  const data = typeof input === "string" ? { businessName: input } : input || {};
  const businessName = data.businessName || "Business Partner";
  const lastLoginDate = data.lastLoginDate || "Recently";
  const daysInactive = data.daysInactive || "1 Day";
  const invoiceCount = data.invoiceCount !== void 0 ? String(data.invoiceCount) : "0";
  const stockCount = data.stockCount !== void 0 ? String(data.stockCount) : "0 Items";
  const dueCount = data.dueCount !== void 0 ? String(data.dueCount) : "\u20B90";
  const customerCount = data.customerCount !== void 0 ? String(data.customerCount) : "0";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>InvoCentric \u2014 Business Reminder</title>
<style>
  @media only screen and (max-width: 600px) {
    .main-table { width: 100% !important; }
    .receipt-card { padding: 22px 16px !important; }
    .headline { font-size: 19px !important; }
  }
  /* Status LED Light Animation */
  .printer-led {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #2ecc71;
    box-shadow: 0 0 10px #2ecc71;
    display: inline-block;
    animation: ledBlink 0.35s infinite alternate ease-in-out;
  }
  @keyframes ledBlink {
    0% { opacity: 0.3; transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1.1); }
  }

  /* Stepped Thermal Paper Motor Feed Animation */
  @keyframes thermalPrint {
    0% { transform: translateY(-88%); opacity: 0.2; }
    18% { transform: translateY(-70%); opacity: 1; }
    36% { transform: translateY(-52%); }
    54% { transform: translateY(-34%); }
    72% { transform: translateY(-16%); }
    90% { transform: translateY(0); }
    95% { transform: translateY(4px); }
    100% { transform: translateY(0); opacity: 1; }
  }

  .feed-container {
    width: 100%;
    max-width: 520px;
    position: relative;
    overflow: hidden;
    margin: 0 auto;
  }

  .receipt-wrap {
    width: 100%;
    transform-origin: top center;
    animation: thermalPrint 3.2s cubic-bezier(0.25, 1, 0.4, 1) forwards;
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#c8d3ce; font-family:'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">

<!-- FULL WIDTH CENTER WRAPPER -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#c8d3ce; width:100% !important; margin:0; padding:35px 12px;">
  <tr>
    <td align="center" valign="top">

      <!-- MAX-WIDTH CONTAINER (520px) -->
      <table role="presentation" class="main-table" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%; margin:0 auto;">

        <!-- PREVIEW ANIMATION LINK -->
        <tr>
          <td align="center" style="padding-bottom:14px;">
            <a href="https://invocentric.in/api/preview/inactivity-email" target="_blank" style="display:inline-block; background-color:#ffffff; color:#0d5c4b; text-decoration:none; font-size:11.5px; font-weight:600; padding:6px 16px; border-radius:20px; border:1px solid #b9d4ca; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
              \u26A1 View Live Thermal Print Animation \u2197
            </a>
          </td>
        </tr>

        <!-- POS PRINTER MACHINE HEAD -->
        <tr>
          <td align="center" style="padding:0; line-height:1;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; height:46px; background-color:#1b2229; background:linear-gradient(180deg, #1b2229 0%, #29343f 70%, #151b22 100%); border-radius:12px 12px 0 0; box-shadow:0 8px 20px rgba(0,0,0,0.35);">
              <tr>
                <td width="36" align="center" style="padding-left:16px;">
                  <div style="width:10px; height:10px; border-radius:50%; background-color:#2ecc71; box-shadow:0 0 8px #2ecc71; display:inline-block;"></div>
                </td>
                <td align="center" style="padding:0 12px;">
                  <div style="height:8px; background-color:#090c0e; border-radius:4px; border-bottom:1px solid rgba(255,255,255,0.15); width:100%; max-width:380px;"></div>
                </td>
                <td width="36" style="padding-right:16px;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- THERMAL PAPER RECEIPT SLIP -->
        <tr>
          <td align="center" style="padding:0;">
            <div class="feed-container">
              <div class="receipt-wrap" id="receiptWrap">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#ffffff; box-shadow:0 14px 32px rgba(0,0,0,0.16); border-left:1px solid #dcdcdc; border-right:1px solid #dcdcdc; border-bottom:3px dashed #b9d4ca;">
              <tr>
                <td class="receipt-card" style="padding:32px 28px 24px; text-align:left;">

                  <!-- LOGO & BRAND -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                    <tr>
                      <td width="42" valign="middle">
                        <svg viewBox="0 0 500 500" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                          <g fill="#0d5c4b">
                            <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9
                              c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87
                              c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3
                              c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3
                              C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
                            <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
                            <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6
                              c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50
                              C362.6,181.5,340.3,178.8,324.8,191z"/>
                          </g>
                        </svg>
                      </td>
                      <td valign="middle" style="padding-left:12px;">
                        <div style="font-size:24px; font-weight:800; color:#0d5c4b; letter-spacing:-0.5px; line-height:1.1; margin:0;">InvoCentric</div>
                        <div style="font-size:11px; color:#0d5c4b; margin-top:2px;">More than billing. Built for your business.</div>
                      </td>
                    </tr>
                  </table>

                  <!-- DASHED DIVIDER WITH TITLE -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
                    <tr>
                      <td style="border-top:1px dashed #cccccc; font-size:1px; line-height:1px;">&nbsp;</td>
                      <td width="160" align="center" style="padding:0 8px; font-size:10.5px; font-weight:bold; letter-spacing:2px; color:#444444; white-space:nowrap;">BUSINESS REMINDER</td>
                      <td style="border-top:1px dashed #cccccc; font-size:1px; line-height:1px;">&nbsp;</td>
                    </tr>
                  </table>

                  <!-- HEADLINE -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                    <tr>
                      <td width="28" valign="top" style="padding-top:2px;">
                        <svg viewBox="0 0 24 24" fill="#0d5c4b" width="24" height="24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>
                      </td>
                      <td valign="top" style="padding-left:8px;">
                        <div class="headline" style="font-size:21px; font-weight:700; color:#0d5c4b; line-height:1.25; margin:0;">Your Business Has Been Waiting!</div>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size:14px; color:#222222; line-height:1.6; margin:0 0 10px;">Hi <strong>${businessName}</strong>,</p>
                  <p style="font-size:13.5px; color:#444444; line-height:1.55; margin:0 0 16px;">
                    It's been a few days since you last used InvoCentric. We noticed your billing dashboard and records are ready and waiting for you!
                  </p>

                  <!-- ACTIVITY BOX: EMAIL SAFE 2-COLUMN TABLE -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e3f1ec; border-radius:8px; margin:16px 0 22px;">
                    <tr>
                      <td width="49%" valign="middle" style="padding:14px 16px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td valign="middle" style="padding-right:10px;">
                              <svg viewBox="0 0 24 24" fill="#0d5c4b" width="18" height="18"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
                            </td>
                            <td valign="middle">
                              <div style="font-size:10.5px; color:#555555; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Last Activity</div>
                              <div style="font-size:14px; color:#0d5c4b; font-weight:bold;">${lastLoginDate}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="2%" align="center" valign="middle" style="padding:10px 0;">
                        <div style="width:1px; height:34px; background-color:#b9d4ca;"></div>
                      </td>
                      <td width="49%" valign="middle" style="padding:14px 16px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td valign="middle" style="padding-right:10px;">
                              <svg viewBox="0 0 24 24" fill="#0d5c4b" width="18" height="18"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                            </td>
                            <td valign="middle">
                              <div style="font-size:10.5px; color:#555555; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Days Inactive</div>
                              <div style="font-size:14px; color:#0d5c4b; font-weight:bold;">${daysInactive}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- SUMMARY HEADER -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
                    <tr>
                      <td align="left" style="font-size:12px; font-weight:bold; letter-spacing:1px; color:#111111;">YOUR BUSINESS SUMMARY</td>
                      <td align="right" style="font-size:10px; font-weight:bold; letter-spacing:1px; color:#0d5c4b;">READY TO GO</td>
                    </tr>
                  </table>
                  <div style="border-top:1px dashed #cccccc; margin-bottom:8px;"></div>

                  <!-- ROW 1: INVOICES -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #f0f0f0;">
                    <tr>
                      <td width="28" valign="middle" style="padding:10px 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0d5c4b" stroke-width="1.8" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                      </td>
                      <td valign="middle" style="padding:10px 8px;">
                        <div style="font-size:13px; font-weight:bold; color:#111111;">Invoices Created</div>
                        <div style="font-size:11px; color:#666666;">Synced Billing Records</div>
                      </td>
                      <td align="right" valign="middle" style="padding:10px 0; font-size:13.5px; font-weight:bold; color:#0d5c4b; white-space:nowrap;">
                        ${invoiceCount}
                      </td>
                    </tr>
                  </table>

                  <!-- ROW 2: INVENTORY -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #f0f0f0;">
                    <tr>
                      <td width="28" valign="middle" style="padding:10px 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0d5c4b" stroke-width="1.8" width="20" height="20"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                      </td>
                      <td valign="middle" style="padding:10px 8px;">
                        <div style="font-size:13px; font-weight:bold; color:#111111;">Stock &amp; Products</div>
                        <div style="font-size:11px; color:#666666;">Catalog Items Monitored</div>
                      </td>
                      <td align="right" valign="middle" style="padding:10px 0; font-size:13.5px; font-weight:bold; color:#0d5c4b; white-space:nowrap;">
                        ${stockCount}
                      </td>
                    </tr>
                  </table>

                  <!-- ROW 3: PENDING DUE -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #f0f0f0;">
                    <tr>
                      <td width="28" valign="middle" style="padding:10px 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0d5c4b" stroke-width="1.8" width="20" height="20"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </td>
                      <td valign="middle" style="padding:10px 8px;">
                        <div style="font-size:13px; font-weight:bold; color:#111111;">Pending Due</div>
                        <div style="font-size:11px; color:#666666;">Total Unpaid Receivables</div>
                      </td>
                      <td align="right" valign="middle" style="padding:10px 0; font-size:13.5px; font-weight:bold; color:#0d5c4b; white-space:nowrap;">
                        ${dueCount}
                      </td>
                    </tr>
                  </table>

                  <!-- ROW 4: CUSTOMERS -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #f0f0f0;">
                    <tr>
                      <td width="28" valign="middle" style="padding:10px 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0d5c4b" stroke-width="1.8" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </td>
                      <td valign="middle" style="padding:10px 8px;">
                        <div style="font-size:13px; font-weight:bold; color:#111111;">Linked Customers</div>
                        <div style="font-size:11px; color:#666666;">Active Client Directory</div>
                      </td>
                      <td align="right" valign="middle" style="padding:10px 0; font-size:13.5px; font-weight:bold; color:#0d5c4b; white-space:nowrap;">
                        ${customerCount}
                      </td>
                    </tr>
                  </table>

                  <!-- CTA BUTTON -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 10px;">
                    <tr>
                      <td align="center">
                        <a href="https://invocentric.in/" target="_blank" style="display:inline-block; background-color:#0d5c4b; color:#ffffff !important; text-decoration:none; font-weight:bold; letter-spacing:0.8px; font-size:14px; padding:13px 34px; border-radius:8px; box-shadow:0 4px 12px rgba(13,92,75,0.25);">
                          OPEN INVOCENTRIC &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size:11px; color:#777777; text-align:center; margin:4px 0 18px;">
                    Your data is safe and encrypted. Click above to resume invoicing seamlessly.
                  </p>

                  <div style="border-top:1px dashed #cccccc; margin-bottom:14px;"></div>

                  <!-- BARCODE & FOOTER -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <svg viewBox="0 0 300 36" width="210" height="26" style="display:block; margin:0 auto 10px;">
                          <g fill="#222222">
                            <rect x="0" y="0" width="2" height="36"/><rect x="5" y="0" width="1" height="36"/><rect x="9" y="0" width="3" height="36"/><rect x="15" y="0" width="1" height="36"/><rect x="19" y="0" width="2" height="36"/><rect x="24" y="0" width="1" height="36"/><rect x="28" y="0" width="1" height="36"/><rect x="32" y="0" width="3" height="36"/><rect x="38" y="0" width="1" height="36"/><rect x="42" y="0" width="2" height="36"/><rect x="47" y="0" width="1" height="36"/><rect x="51" y="0" width="1" height="36"/><rect x="55" y="0" width="3" height="36"/><rect x="61" y="0" width="1" height="36"/><rect x="65" y="0" width="2" height="36"/><rect x="70" y="0" width="1" height="36"/><rect x="74" y="0" width="3" height="36"/><rect x="80" y="0" width="1" height="36"/><rect x="84" y="0" width="1" height="36"/><rect x="88" y="0" width="2" height="36"/><rect x="93" y="0" width="1" height="36"/><rect x="97" y="0" width="3" height="36"/><rect x="103" y="0" width="1" height="36"/><rect x="107" y="0" width="2" height="36"/><rect x="112" y="0" width="1" height="36"/><rect x="116" y="0" width="1" height="36"/><rect x="120" y="0" width="3" height="36"/><rect x="126" y="0" width="2" height="36"/><rect x="131" y="0" width="1" height="36"/><rect x="135" y="0" width="1" height="36"/><rect x="139" y="0" width="3" height="36"/><rect x="145" y="0" width="1" height="36"/><rect x="149" y="0" width="2" height="36"/><rect x="154" y="0" width="1" height="36"/><rect x="158" y="0" width="1" height="36"/><rect x="162" y="0" width="3" height="36"/><rect x="168" y="0" width="2" height="36"/><rect x="173" y="0" width="1" height="36"/><rect x="177" y="0" width="3" height="36"/><rect x="183" y="0" width="1" height="36"/><rect x="187" y="0" width="1" height="36"/><rect x="191" y="0" width="2" height="36"/><rect x="196" y="0" width="1" height="36"/><rect x="200" y="0" width="3" height="36"/><rect x="206" y="0" width="1" height="36"/><rect x="210" y="0" width="2" height="36"/><rect x="215" y="0" width="1" height="36"/><rect x="219" y="0" width="1" height="36"/><rect x="223" y="0" width="3" height="36"/><rect x="229" y="0" width="2" height="36"/><rect x="234" y="0" width="1" height="36"/><rect x="238" y="0" width="1" height="36"/><rect x="242" y="0" width="3" height="36"/><rect x="248" y="0" width="1" height="36"/><rect x="252" y="0" width="2" height="36"/><rect x="257" y="0" width="1" height="36"/><rect x="261" y="0" width="3" height="36"/><rect x="267" y="0" width="1" height="36"/><rect x="271" y="0" width="1" height="36"/><rect x="275" y="0" width="2" height="36"/><rect x="280" y="0" width="1" height="36"/><rect x="284" y="0" width="3" height="36"/><rect x="290" y="0" width="1" height="36"/><rect x="294" y="0" width="2" height="36"/>
                          </g>
                        </svg>
                        <div style="font-size:10px; letter-spacing:1px; color:#555555; text-transform:uppercase; margin-bottom:2px;">SECURE BUSINESS BILLING PORTAL</div>
                        <div style="font-size:11.5px; font-weight:bold; color:#0d5c4b;">More than billing. Built for your business.</div>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
              </div>
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

<script>
function reprint() {
  const wrap = document.getElementById('receiptWrap');
  const led = document.getElementById('led');
  if (!wrap) return;
  wrap.style.animation = 'none';
  if (led) {
    led.style.animation = 'none';
    led.style.backgroundColor = '#e74c3c';
    led.style.boxShadow = '0 0 10px #e74c3c';
  }
  void wrap.offsetWidth;
  wrap.style.animation = 'thermalPrint 3.2s cubic-bezier(0.25, 1, 0.4, 1) forwards';
  if (led) {
    led.style.animation = 'ledBlink 0.35s infinite alternate ease-in-out';
    led.style.backgroundColor = '#2ecc71';
    led.style.boxShadow = '0 0 10px #2ecc71';
  }
}
</script>

</body>
</html>`;
}
async function runInactivityRemindersCheck(authHeader, force = false, reset = false, providedUsers) {
  console.log(`[Inactivity Scheduler] Scanning users for inactivity reminders (force=${force}, reset=${reset}, providedUsers=${providedUsers?.length || 0})...`);
  const results = { checked: 0, sent: 0, errors: [] };
  try {
    let rawUsers = [];
    if (Array.isArray(providedUsers) && providedUsers.length > 0) {
      rawUsers = providedUsers;
    } else {
      rawUsers = await fetchAllUsers(authHeader);
    }
    results.checked = rawUsers.length;
    const now = Date.now();
    const INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1e3;
    for (const rawUser of rawUsers) {
      const user = rawUser.fields ? parseFirestoreDocument(rawUser) : rawUser;
      if (!user) continue;
      const userId = user.id || user.uid;
      const email = user.email || user.business_email;
      if (!email || !email.includes("@")) continue;
      if (reset && userId) {
        if (user.inactivity_reminder_status !== "not_eligible") {
          await updateUserInactivityReminderFields(userId, {
            inactivity_reminder_status: "not_eligible",
            inactivity_reminder_sent_at: null,
            inactivity_reminder_cycle_id: null,
            inactivity_reminder_error: null
          });
          user.inactivity_reminder_status = "not_eligible";
        }
      }
      if (user.email_reminders_enabled === false) {
        if (user.inactivity_reminder_status !== "disabled" && userId) {
          await updateUserInactivityReminderFields(userId, { inactivity_reminder_status: "disabled" });
        }
        continue;
      }
      if (user.inactivity_reminder_status === "sent" && !force) {
        if (user.inactivity_reminder_sent_at) {
          const sentTime = new Date(user.inactivity_reminder_sent_at).getTime();
          const daysSinceSent = (now - sentTime) / (24 * 36e5);
          if (daysSinceSent < 3) continue;
        } else {
          continue;
        }
      }
      const lastActiveStr = user.last_active_at || user.lastActiveDate || user.updated_at || user.created_at;
      if (!lastActiveStr && !force) continue;
      const lastActiveTime = lastActiveStr ? new Date(lastActiveStr).getTime() : 0;
      const inactiveMs = now - lastActiveTime;
      if (inactiveMs >= INACTIVITY_THRESHOLD || force) {
        console.log(`[Inactivity Scheduler] Sending reminder to: ${email} (inactive for ${lastActiveStr ? Math.round(inactiveMs / 36e5) : "unknown"} hours, force=${force})`);
        const userName = user.owner_name || user.display_name || user.business_name || user.name || email.split("@")[0] || "there";
        const businessName = user.business_name || user.owner_name || user.display_name || user.name || email.split("@")[0] || "Business Partner";
        const lastLoginDate = lastActiveStr ? new Date(lastActiveStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recently";
        const daysInactive = lastActiveStr ? Math.max(1, Math.round(inactiveMs / (24 * 36e5))) + " Days" : "2+ Days";
        const invoiceCount = user.invoices_count !== void 0 ? String(user.invoices_count) : user.invoiceCount !== void 0 ? String(user.invoiceCount) : "10+";
        const stockCount = user.items_count !== void 0 ? String(user.items_count) : "Active";
        const dueCount = user.pending_due !== void 0 ? "\u20B9" + user.pending_due : "Synced";
        const customerCount = user.customers_count !== void 0 ? String(user.customers_count) : "Connected";
        const html = generateInactivityEmailTemplate({
          businessName,
          lastLoginDate,
          daysInactive,
          invoiceCount,
          stockCount,
          dueCount,
          customerCount
        });
        const text = `Hi ${userName},

We miss you! Your InvoCentric billing dashboard is ready.

You haven't logged into InvoCentric in the last 24 hours. This is just a friendly check-in to see if we can help you streamline your invoicing today.

Your client lists, custom products, pending payments, and receipts are safely synced in the cloud and ready whenever you are.

Return to Dashboard: https://invocentric.in/

To stop receiving these alerts, update your settings at https://invocentric.in/settings`;
        const dispatch = await dispatchEmail({
          to: email,
          subject: "InvoCentric Account Status: Your billing dashboard is active",
          html,
          text
        });
        if (dispatch.success) {
          results.sent++;
          const cycleId = "cycle_" + Date.now();
          if (userId) {
            await updateUserInactivityReminderFields(userId, {
              inactivity_reminder_status: "sent",
              inactivity_reminder_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
              inactivity_reminder_cycle_id: cycleId,
              inactivity_reminder_error: null
            });
          }
          await logEmailDispatch(
            email,
            "Reminder",
            "InvoCentric Account Status: Your billing dashboard is active",
            "Sent",
            void 0,
            {
              recipient_name: userName,
              business_name: businessName,
              user_id: userId,
              delivery_mode: "Automatic"
            }
          );
        } else {
          results.errors.push(`${email}: ${dispatch.error}`);
          if (userId) {
            await updateUserInactivityReminderFields(userId, {
              inactivity_reminder_status: "failed",
              inactivity_reminder_error: dispatch.error || "Unknown Error"
            });
          }
          await logEmailDispatch(
            email,
            "Reminder",
            "InvoCentric Account Status: Your billing dashboard is active",
            "Failed",
            dispatch.error,
            {
              recipient_name: userName,
              business_name: businessName,
              user_id: userId,
              delivery_mode: "Automatic"
            }
          );
        }
      }
    }
  } catch (err) {
    console.error("[Inactivity Scheduler] Error executing scanning cycle:", err);
    results.errors.push(`Global check error: ${err.message || err}`);
  }
  return results;
}
function startInactivityScheduler() {
  console.log("[Inactivity Scheduler] Initializing background checker loop...");
  setTimeout(() => {
    runInactivityRemindersCheck().then((res) => console.log(`[Inactivity Scheduler] Startup scan complete: Checked ${res.checked}, Sent ${res.sent}, Failures: ${res.errors.length}`)).catch((err) => console.error("[Inactivity Scheduler] Startup scan crash:", err));
  }, 1e4);
  setInterval(() => {
    runInactivityRemindersCheck().then((res) => console.log(`[Inactivity Scheduler] Hourly scan complete: Checked ${res.checked}, Sent ${res.sent}, Failures: ${res.errors.length}`)).catch((err) => console.error("[Inactivity Scheduler] Hourly scan crash:", err));
  }, 36e5);
}
startInactivityScheduler();
app.get("/api/preview/otp-email", (req, res) => {
  const html = generateOtpEmailTemplate({
    otp: req.query.otp || "749205",
    businessName: req.query.name || "Sample Store"
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
app.get("/api/preview/inactivity-email", (req, res) => {
  const html = generateInactivityEmailTemplate({
    businessName: req.query.name || "Sample Store",
    lastLoginDate: "12-Sep-2026",
    daysInactive: "3 Days",
    invoiceCount: "128",
    stockCount: "45 Items",
    dueCount: "\u20B98,450",
    customerCount: "64"
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
app.get("/api/admin/smtp-status", checkAuth, async (req, res) => {
  const isConfigured = Boolean(
    customSmtpConfig?.user && customSmtpConfig?.pass || process.env.SMTP_USER && process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY
  );
  const activeEmail = customSmtpConfig?.user || process.env.SMTP_USER || (process.env.RESEND_API_KEY ? "Resend API Active" : "");
  const activeHost = customSmtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
  return res.status(200).json({
    configured: isConfigured,
    email: activeEmail,
    host: activeHost
  });
});
app.post("/api/admin/save-smtp-config", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  const userEmail = req.user?.email?.toLowerCase();
  if (userEmail !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }
  const { host, port, user, pass, fromName } = req.body;
  if (!user || !pass) {
    return res.status(400).json({ error: "SMTP Username/Email and Password are required." });
  }
  customSmtpConfig = {
    host: host || "smtp.gmail.com",
    port: Number(port || 587),
    secure: Number(port) === 465,
    user: user.trim(),
    pass: pass.trim(),
    fromName: fromName || "InvoCentric"
  };
  return res.status(200).json({ success: true, message: "SMTP configuration updated successfully." });
});
app.post("/api/admin/test-smtp-connection", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  const userEmail = req.user?.email?.toLowerCase();
  if (userEmail !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }
  const { host, port, user, pass, fromName, testRecipient } = req.body;
  const targetUser = (user || customSmtpConfig?.user || process.env.SMTP_USER || "").trim();
  const targetPass = (pass || customSmtpConfig?.pass || process.env.SMTP_PASSWORD || "").trim();
  const targetHost = (host || customSmtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const targetPort = Number(port || customSmtpConfig?.port || process.env.SMTP_PORT || 587);
  if (!targetUser || !targetPass) {
    return res.status(400).json({
      success: false,
      error: "SMTP Credentials Missing: Please provide SMTP Email/Username and App Password."
    });
  }
  try {
    const transporter = import_nodemailer.default.createTransport({
      host: targetHost,
      port: targetPort,
      secure: targetPort === 465,
      auth: {
        user: targetUser,
        pass: targetPass
      },
      connectionTimeout: 15e3,
      greetingTimeout: 15e3
    });
    await transporter.verify();
    if (testRecipient && testRecipient.includes("@")) {
      await transporter.sendMail({
        from: `"${fromName || "InvoCentric"}" <${targetUser}>`,
        to: testRecipient,
        subject: "InvoCentric SMTP Connection Test - Success!",
        html: `
          <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0d5c4b; margin-top: 0;">\u2713 SMTP Live Connection Verified</h2>
            <p>Your InvoCentric billing mail engine is now fully functional and connected to <strong>${targetHost}</strong>.</p>
            <p>From Account: <strong>${targetUser}</strong></p>
            <p>Dispatched At: <strong>${(/* @__PURE__ */ new Date()).toLocaleString("en-IN")}</strong></p>
            <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #15803d; font-size: 13px;">
              System Reminders, Customer Invoices, and Automated Notifications will now be sent seamlessly.
            </div>
          </div>
        `
      });
    }
    customSmtpConfig = {
      host: targetHost,
      port: targetPort,
      secure: targetPort === 465,
      user: targetUser,
      pass: targetPass,
      fromName: fromName || "InvoCentric"
    };
    return res.status(200).json({
      success: true,
      message: testRecipient ? `SMTP Connected! Test email successfully delivered to ${testRecipient}.` : "SMTP handshake verified successfully!"
    });
  } catch (err) {
    console.error("SMTP Connection Test Failed:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to authenticate with SMTP server. Check credentials or App Password."
    });
  }
});
app.post("/api/admin/check-inactivity", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  if (req.user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }
  try {
    const authHeader = req.headers.authorization;
    const { force, reset, users } = req.body || {};
    const results = await runInactivityRemindersCheck(authHeader, !!force, !!reset, users);
    res.status(200).json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});
app.post("/api/admin/send-test-reminder", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  if (req.user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }
  const { email, businessName, lastLoginDate, daysInactive, invoiceCount, stockCount, dueCount, customerCount } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid recipient email address." });
  }
  try {
    const cleanBusinessName = businessName || email.split("@")[0] || "Valued Partner";
    const testHtml = generateInactivityEmailTemplate({
      businessName: cleanBusinessName,
      lastLoginDate: lastLoginDate || "Recently",
      daysInactive: daysInactive || "1 Day",
      invoiceCount: invoiceCount !== void 0 ? String(invoiceCount) : "0",
      stockCount: stockCount !== void 0 ? String(stockCount) : "0 Items",
      dueCount: dueCount !== void 0 ? String(dueCount) : "\u20B90",
      customerCount: customerCount !== void 0 ? String(customerCount) : "0"
    });
    const testText = `Hi ${cleanBusinessName},

We miss you! Your InvoCentric billing dashboard is ready.

Your client lists, custom products, pending payments, and receipts are safely synced in the cloud and ready whenever you are.

Return to Dashboard: https://invocentric.in/

To stop receiving these alerts, update your settings at https://invocentric.in/settings`;
    const result = await dispatchEmail({
      to: email,
      subject: "Ready to streamline your billing? (Admin Test)",
      html: testHtml,
      text: testText
    });
    if (result.success) {
      await logEmailDispatch(
        email,
        "Test Reminder",
        "Ready to streamline your billing? (Admin Test)",
        "Sent",
        void 0,
        {
          recipient_name: cleanBusinessName,
          business_name: cleanBusinessName,
          delivery_mode: "Manual"
        }
      );
      res.status(200).json({ success: true, message: "Test inactivity email sent." });
    } else {
      await logEmailDispatch(
        email,
        "Test Reminder",
        "Ready to streamline your billing? (Admin Test)",
        "Failed",
        result.error,
        {
          recipient_name: cleanBusinessName,
          business_name: cleanBusinessName,
          delivery_mode: "Manual"
        }
      );
      res.status(500).json({ error: result.error || "Failed to dispatch test email." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});
app.post("/api/admin/send-user-reminder", checkAuth, async (req, res) => {
  const adminEmail = "nomanshaikh1999@gmail.com";
  if (req.user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "FORBIDDEN: Admin privileges required." });
  }
  const {
    userId,
    email,
    businessName,
    recipientName,
    daysInactive,
    lastLoginDate,
    invoiceCount,
    stockCount,
    dueCount,
    customerCount,
    deliveryMode = "Manual"
  } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid recipient email address." });
  }
  try {
    const cleanBusiness = businessName || recipientName || email.split("@")[0] || "Valued Partner";
    const cleanName = recipientName || cleanBusiness;
    const html = generateInactivityEmailTemplate({
      businessName: cleanBusiness,
      lastLoginDate: lastLoginDate || "Recently",
      daysInactive: daysInactive || "1 Day",
      invoiceCount: invoiceCount !== void 0 ? String(invoiceCount) : "0",
      stockCount: stockCount !== void 0 ? String(stockCount) : "0 Items",
      dueCount: dueCount !== void 0 ? String(dueCount) : "\u20B90",
      customerCount: customerCount !== void 0 ? String(customerCount) : "0"
    });
    const text = `Hi ${cleanName},

We miss you! Your InvoCentric billing dashboard is ready.

You haven't logged into InvoCentric in the last 24 hours. This is just a friendly check-in to see if we can help you streamline your invoicing today.

Your client lists, custom products, pending payments, and receipts are safely synced in the cloud and ready whenever you are.

Return to Dashboard: https://invocentric.in/

To stop receiving these alerts, update your settings at https://invocentric.in/settings`;
    const dispatch = await dispatchEmail({
      to: email,
      subject: "InvoCentric Account Status: Your billing dashboard is active",
      html,
      text
    });
    if (dispatch.success) {
      if (userId) {
        await updateUserInactivityReminderFields(userId, {
          inactivity_reminder_status: "sent",
          inactivity_reminder_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
          inactivity_reminder_cycle_id: "cycle_" + Date.now(),
          inactivity_reminder_error: null
        });
      }
      await logEmailDispatch(
        email,
        "Reminder",
        "InvoCentric Account Status: Your billing dashboard is active",
        "Sent",
        void 0,
        {
          recipient_name: cleanName,
          business_name: cleanBusiness,
          user_id: userId,
          delivery_mode: deliveryMode
        }
      );
      res.status(200).json({ success: true, message: `Reminder sent to ${email}` });
    } else {
      if (userId) {
        await updateUserInactivityReminderFields(userId, {
          inactivity_reminder_status: "failed",
          inactivity_reminder_error: dispatch.error || "Failed to dispatch"
        });
      }
      await logEmailDispatch(
        email,
        "Reminder",
        "InvoCentric Account Status: Your billing dashboard is active",
        "Failed",
        dispatch.error,
        {
          recipient_name: cleanName,
          business_name: cleanBusiness,
          user_id: userId,
          delivery_mode: deliveryMode
        }
      );
      res.status(500).json({ error: dispatch.error || "Failed to dispatch reminder" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});
app.get("/api/cron/reminders", async (req, res) => {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isSecretValid = cronSecret && authHeader === `Bearer ${cronSecret}`;
  console.log(`[Cron Reminders] Inactive scan triggered (vercel=${isVercelCron}, secretValid=${!!isSecretValid}) at ${(/* @__PURE__ */ new Date()).toISOString()}`);
  try {
    const results = await runInactivityRemindersCheck(authHeader, false, false);
    res.status(200).json({
      success: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...results
    });
  } catch (err) {
    console.error("[Cron Reminders] Execution failure:", err);
    res.status(500).json({ error: err.message || err });
  }
});
var originalApproveReceipt = app._router.stack.find((layer) => layer.route && layer.route.path === "/api/subscription/approve-receipt");
if (originalApproveReceipt) {
  const handler = originalApproveReceipt.route.stack[originalApproveReceipt.route.stack.length - 1].handle;
  originalApproveReceipt.route.stack[originalApproveReceipt.route.stack.length - 1].handle = async function(req, res, next) {
    const originalResJson = res.json;
    res.json = function(body) {
      if (body && body.success) {
        logEmailDispatch(
          req.body.userEmail,
          "Receipt",
          "Your InvoCentric Payment Receipt",
          body.emailSent ? "Sent" : "Failed",
          body.emailError || void 0
        ).catch((e) => console.error("Async post-receipt logging failed:", e));
      }
      return originalResJson.call(this, body);
    };
    return handler(req, res, next);
  };
}
var sseClients = [];
var mobileHeartbeats = /* @__PURE__ */ new Map();
var wasMobileConnectedMap = /* @__PURE__ */ new Map();
var HEARTBEAT_TIMEOUT = 5e3;
function isMobileConnected(sessionId) {
  const lastHeartbeat = mobileHeartbeats.get(sessionId) || 0;
  return Date.now() - lastHeartbeat < HEARTBEAT_TIMEOUT;
}
function broadcastToSse(sessionId, data) {
  const payload = `data: ${JSON.stringify(data)}

`;
  sseClients.forEach((client) => {
    if (client.sessionId === sessionId || client.sessionId === "default" || sessionId === "default") {
      try {
        client.res.write(payload);
      } catch (err) {
      }
    }
  });
}
setInterval(() => {
  const activeSessions = /* @__PURE__ */ new Set();
  sseClients.forEach((c) => activeSessions.add(c.sessionId));
  activeSessions.forEach((sessionId) => {
    const currentConnected = isMobileConnected(sessionId);
    const wasConnected = wasMobileConnectedMap.get(sessionId) || false;
    if (currentConnected !== wasConnected) {
      wasMobileConnectedMap.set(sessionId, currentConnected);
      broadcastToSse(sessionId, { type: "status", connected: currentConnected });
    }
  });
}, 1e3);
app.get("/api/usb-scanner/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const sessionId = req.query.sessionId || "default";
  sseClients.push({ res, sessionId });
  res.write(`data: ${JSON.stringify({ type: "status", connected: isMobileConnected(sessionId) })}

`);
  req.on("close", () => {
    sseClients = sseClients.filter((client) => client.res !== res);
  });
});
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
app.post("/api/usb-scanner/scan", (req, res) => {
  const { code, sessionId } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing barcode code" });
  }
  const sid = sessionId || "default";
  mobileHeartbeats.set(sid, Date.now());
  wasMobileConnectedMap.set(sid, true);
  broadcastToSse(sid, { type: "scan", code: code.trim() });
  res.status(200).json({ success: true });
});
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isCors = err.message && err.message.includes("CORS");
  const isBadJson = err instanceof SyntaxError && "body" in err;
  console.error(`[CrashShield Error Handled] [${req.method} ${req.url}] Status: ${status} -`, err.message || err);
  if (isCors) {
    return res.status(403).json({ error: "Security policy: Access not allowed from this origin." });
  }
  if (isBadJson) {
    return res.status(400).json({ error: "Malformed JSON payload rejected by security filter." });
  }
  return res.status(status).json({
    error: isProd ? "Request could not be processed due to a security protection check." : err.message || "Internal server error"
  });
});
var api_default = app;

// server.ts
var isProd2 = process.env.NODE_ENV === "production" || process.env.VITE_PROD === "true";
var isVercel = process.env.VERCEL === "1";
function generateCorrelationId2() {
  return "ERR-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}
async function startServer() {
  if (!isVercel) {
    if (!isProd2) {
      console.log("[Local Dev] Starting in DEVELOPMENT mode with Vite Middleware...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      api_default.use(vite.middlewares);
    } else {
      console.log("[Local Prod] Starting in PRODUCTION mode with static file server...");
      const path2 = await import("path");
      const express2 = await import("express");
      const distPath = path2.resolve(process.cwd(), "dist");
      api_default.use(express2.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html") || filePath.endsWith("sw.js")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$/)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      }));
      api_default.get("*", (req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path2.join(distPath, "index.html"));
      });
    }
    api_default.use((err, req, res, next) => {
      const correlationId = generateCorrelationId2();
      console.error(`[${correlationId}] Global Error Handler:`, err);
      if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
        return res.status(400).json({ error: "Invalid JSON payload", correlationId });
      }
      if (err.type === "entity.too.large") {
        return res.status(413).json({ error: "Payload too large. Please use a smaller image (max 10MB).", correlationId });
      }
      res.status(err.status || 500).json({
        error: "An internal server error occurred. Please contact support.",
        correlationId
      });
    });
    const PORT = 3e3;
    api_default.listen(PORT, "0.0.0.0", () => {
      console.log(`[Local Server] Server running on http://localhost:${PORT}`);
    });
  }
}
startServer();
//# sourceMappingURL=server.cjs.map
