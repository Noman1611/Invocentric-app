import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ScanLine, RefreshCw, AlertCircle, CheckCircle, ArrowLeft, Volume2, VolumeX, Keyboard } from 'lucide-react';

export default function MobileScan() {
  const [sessionId] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('sessionId') || 'default';
  });

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connecting');
  const [lastScanned, setLastScanned] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');

  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);

  // Send Heartbeat to PC local server
  const sendHeartbeat = async () => {
    try {
      const res = await fetch('/api/usb-scanner/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (err) {
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    // Initial heartbeat
    sendHeartbeat();

    // Setup heartbeat interval (every 2 seconds)
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 2000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  // Handle scanned barcode
  const handleDecodedBarcode = async (code: string) => {
    if (!code) return;
    
    // Simple visual log of last scanned items
    setLastScanned(prev => [code, ...prev.slice(0, 9)]);

    // Play beep sound if enabled
    if (soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz beep
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08); // 80ms beep
      } catch (err) {
        console.error('Failed to play scan sound:', err);
      }
    }

    // Send code to PC
    try {
      const res = await fetch('/api/usb-scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, sessionId }),
      });
      if (res.ok) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (err) {
      setStatus('disconnected');
    }
  };

  // HTML5 Barcode Scanner Setup
  useEffect(() => {
    let active = true;
    let timerId: any = null;
    let scannerInstance: Html5Qrcode | null = null;

    timerId = setTimeout(() => {
      if (!active) return;
      const element = document.getElementById("mobile-qr-reader");
      if (!element) return;

      try {
        const html5QrCode = new Html5Qrcode("mobile-qr-reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
          ],
          verbose: false
        });
        scannerInstance = html5QrCode;
        qrCodeRef.current = html5QrCode;
        setCameraActive(true);
        setCameraError(null);

        html5QrCode.start(
          { facingMode: cameraMode },
          {
            fps: 30,
            qrbox: (width, height) => {
              const w = Math.min(width * 0.85, 360);
              const h = Math.min(height * 0.45, 180);
              return { width: Math.max(w, 240), height: Math.max(h, 120) };
            },
            aspectRatio: 1.777778,
            disableFlip: true
          },
          (decodedText) => {
            if (active) {
              handleDecodedBarcode(decodedText);
            }
          },
          () => {
            // Silence QR Code scan failure callback to prevent debug flooding
          }
        ).catch((err) => {
          if (active) {
            console.error("Camera start error:", err);
            setCameraError("Failed to access camera. Please allow camera permissions in your mobile browser.");
            setCameraActive(false);
          }
        });
      } catch (e) {
        if (active) {
          console.error("Scanner init error:", e);
          setCameraError("Camera load problem.");
          setCameraActive(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
      const currentScanner = qrCodeRef.current || scannerInstance;
      if (currentScanner) {
        if (currentScanner.isScanning) {
          currentScanner.stop().then(() => {
            try { currentScanner.clear(); } catch (e) {}
          }).catch(() => {});
        } else {
          try { currentScanner.clear(); } catch (e) {}
        }
        if (qrCodeRef.current === currentScanner) {
          qrCodeRef.current = null;
        }
      }
      setCameraActive(false);
    };
  }, [cameraMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleDecodedBarcode(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none pb-6">
      {/* Header */}
      <header className="px-4 py-4 border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center border border-green-500/30 shadow-inner animate-pulse">
            <ScanLine size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">InvoCentric Mobile Scanner</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Local USB Connection</p>
          </div>
        </div>

        {/* Connection Status Badge */}
        <div>
          {status === 'connected' ? (
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle size={10} className="fill-current" /> Connected
            </span>
          ) : status === 'connecting' ? (
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
              <RefreshCw size={10} className="animate-spin" /> Connecting
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <AlertCircle size={10} /> Disconnected
            </span>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-4 flex flex-col gap-4">
        {/* Connection instruction message if disconnected */}
        {status !== 'connected' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed space-y-2">
            <p className="font-bold text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={14} /> Connecting to Computer...
            </p>
            <p className="text-slate-300 font-semibold text-[11px]">
              Connecting to your computer screen...
            </p>
            <p className="text-slate-400 font-medium text-[10px]">
              If connection fails, please ensure your phone and computer are on the same Wi-Fi network or connected via personal hotspot.
            </p>
          </div>
        )}

        {/* Camera Scanner Viewfinder */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 h-[260px] xs:h-[300px] w-full flex flex-col items-center justify-center shadow-2xl">
          <div id="mobile-qr-reader" className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />

          {/* Floating sound control & camera switcher */}
          {cameraActive && !cameraError && (
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all active:scale-90 backdrop-blur-md shadow-lg ${soundEnabled ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-slate-950/80 text-slate-400 border-slate-800'}`}
                title={soundEnabled ? 'Mute' : 'Unmute'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setCameraMode(prev => prev === 'environment' ? 'user' : 'environment')}
                className="w-9 h-9 rounded-xl border bg-slate-950/80 text-slate-200 border-slate-800 flex items-center justify-center transition-all active:scale-90 backdrop-blur-md shadow-lg"
                title="Switch Camera"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}

          {/* Target Overlay Laser Frame */}
          {cameraActive && !cameraError && (
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
              <div className="relative w-[220px] h-[110px] border-2 border-green-400/60 rounded-2xl overflow-hidden bg-black/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.65)]">
                <div className="scanner-laser-line" />
                <div className="scanner-laser-glow" />
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-green-300 rounded-tl" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-green-300 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-green-300 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-green-300 rounded-br" />
              </div>
            </div>
          )}

          {!cameraActive && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-950 z-20">
              <RefreshCw className="animate-spin text-green-400 mb-2" size={24} />
              <p className="text-xs font-bold text-slate-400">Initializing Phone Camera...</p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-400 bg-slate-950 z-20 p-6 text-center">
              <AlertCircle className="mb-2 text-pink-500 animate-pulse" size={32} />
              <p className="text-white font-bold text-sm mb-1 leading-snug">{cameraError}</p>
              <p className="text-[10px] text-slate-500 font-medium">Please grant permission and restart.</p>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Form */}
        <form onSubmit={handleManualSubmit} className="relative flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-lg">
          <Keyboard className="absolute left-4 text-slate-500" size={16} />
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Type barcode to send manually..."
            className="w-full bg-transparent text-white placeholder-slate-500 text-xs font-semibold pl-10 pr-24 py-2 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="absolute right-2 px-3 py-1.5 bg-green-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider rounded-xl hover:bg-green-400 active:scale-95 transition-all disabled:opacity-40"
          >
            Send to PC
          </button>
        </form>

        {/* Scanned Log */}
        <div className="flex-1 flex flex-col bg-slate-900/40 border border-slate-900/60 rounded-3xl p-4 overflow-hidden min-h-[160px]">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Barcode Transmission Log</h2>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {lastScanned.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-6">
                <ScanLine size={24} className="opacity-20 mb-1.5" />
                <p className="text-[10px] font-bold">No scanned barcodes yet</p>
                <p className="text-[9px] text-slate-500/80 mt-0.5 mt-0.5">Scanned codes will appear here in real-time.</p>
              </div>
            ) : (
              lastScanned.map((code, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold ${index === 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-900/60 text-slate-300 border border-slate-850/50'}`}
                >
                  <span className="font-mono">{code}</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold opacity-80 flex items-center gap-1">
                    <CheckCircle size={10} className="fill-current" /> Transmitted
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
