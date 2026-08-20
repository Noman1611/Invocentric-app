# InvoCentric (formerly BillCraft)

InvoCentric is a 100% free, offline-first invoicing and billing application built with React, Vite, Tailwind CSS, Express, and Firebase.

## 🔐 Security and Credentials Pass

We have performed a rigorous, comprehensive secret safety audit and refactored the application to prevent any secret exposure to client-side bundles.

### ⚠️ IMPORTANT SECURITY WARNING (Git History)
> [!WARNING]
> If any secret API keys (such as `GEMINI_API_KEY` or `RESEND_API_KEY`) were previously hardcoded in the codebase, those values remain present in your repository's local and remote Git history.
>
> **You MUST rotate any previously hardcoded secret keys immediately** to prevent unauthorized access.
> 1. Revoke the old keys in your Google AI Studio or Resend developer console.
> 2. Generate new keys.
> 3. Add the new keys exclusively via the **Settings > Secrets** panel in AI Studio or your hosting provider's environment variables dashboard.

---

## 🛠️ Environment Variables Configuration

Copy the example configuration to your active environment file:
```bash
cp .env.example .env
```

And set the required variables:

- **`GEMINI_API_KEY`** (Server-Side): Used by the Express backend to analyze and extract invoice items, totals, and client names from scanned invoices/receipt images.
- **`RESEND_API_KEY`** (Server-Side): Used by the Express backend to securely dispatch daily invoice backups and automated email OTPs.

---

## 📦 Architecture Refactoring Details

To ensure zero leakage of private keys:
1. **Server-Side API Proxying**: The client no longer imports `@google/genai` or initiates model generation directly in the browser. Instead, it hits the server-side proxy route `/api/extract-invoice`.
2. **Vite Compile-Time Cleansing**: Removed compiled `define` parameters from `vite.config.ts` so that secrets are never embedded in static assets.
3. **Strict Git Ignores**: `.env` and other environment overrides are fully ignored via `.gitignore` to prevent committing live configurations.
