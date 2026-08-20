import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App.tsx';
import './index.css';

// --- Domain Redirection Fallback ---
// Handled gracefully inside App.tsx via MigrationModal for cache cleaning and session logout.

// --- PWA Auto-Update Logic ---
if ('serviceWorker' in navigator) {
  const hasController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasController && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.ready.then(registration => {
        registration.update().catch(err => console.error("SW update failed", err));
      });
    }
  });
}

// Prevent third-party browser extensions or iframe sandboxing scripts from throwing fatal console/runtime errors
if (typeof window !== 'undefined') {
  const ignorePatterns = [
    'should only be loaded in a browser extension',
    'chrome-extension://',
    'moz-extension://',
    'extension',
    'ResizeObserver loop completed with undelivered notifications',
    'ResizeObserver loop limit exceeded'
  ];

  const handleError = (message: string, filename: string = '') => {
    return ignorePatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase()) || 
      filename.toLowerCase().includes(pattern.toLowerCase())
    );
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const file = event.filename || '';
    if (handleError(msg, file)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason ? (reason.message || String(reason)) : '';
    if (handleError(msg)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Automatically reload when Vite fails to fetch a dynamic chunk
  window.addEventListener('vite:preloadError', (event) => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  });
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  // Automatically reload on dynamic import failure due to caching
  if (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.message.includes('dynamically imported module')
  ) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full border border-red-100">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Something went wrong</h1>
        <p className="text-neutral-500 mb-6 font-medium">The application encountered a critical error. This can happen due to bad data or a connection issue.</p>
        <div className="bg-red-50 p-4 rounded-2xl mb-6 overflow-auto max-h-32">
          <code className="text-[10px] text-red-600 break-all">{error.message}</code>
        </div>
        <div className="space-y-3">
          <button 
            onClick={resetErrorBoundary}
            className="w-full bg-[#14532D] text-white py-4 rounded-2xl font-bold transition-transform active:scale-95 shadow-lg shadow-[#14532D]/20"
          >
            Try Again
          </button>
          <button 
            onClick={() => {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
              if ('caches' in window) {
                caches.keys().then((names) => {
                  names.forEach(name => caches.delete(name));
                });
              }
              window.location.reload();
            }}
            className="w-full bg-neutral-100 text-neutral-600 py-3 rounded-2xl font-bold text-sm"
          >
            Clear Cache & Reload
          </button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset the state of your app so the error doesn't happen again
      }}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
