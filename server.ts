import app from "./api/index.ts";

const isProd = process.env.NODE_ENV === "production" || process.env.VITE_PROD === "true";
const isVercel = process.env.VERCEL === "1";

// Helper function to generate safe unique correlation IDs for error tracking
function generateCorrelationId(): string {
  return "ERR-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function startServer() {
  if (!isVercel) {
    if (!isProd) {
      console.log("[Local Dev] Starting in DEVELOPMENT mode with Vite Middleware...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      console.log("[Local Prod] Starting in PRODUCTION mode with static file server...");
      const path = await import("path");
      const express = await import("express");
      const distPath = path.resolve(process.cwd(), "dist");

      app.use(express.static(distPath, {
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

      app.get("*", (req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    // Add global error handler for body-parser or other early errors
    app.use((err: any, req: any, res: any, next: any) => {
      const correlationId = generateCorrelationId();
      console.error(`[${correlationId}] Global Error Handler:`, err);
      if (err instanceof SyntaxError && "status" in err && (err as any).status === 400 && "body" in err) {
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

    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Local Server] Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
