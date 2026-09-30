import React, { useState, useEffect } from 'react';
import { X, Share2, CheckCircle2, Zap, QrCode, RefreshCw, AlertCircle, Loader2, Copy, Check } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { openInBrowser } from '../lib/utils';
import { whatsappDesktopService, WhatsAppServiceStatus } from '../services/whatsappDesktopService';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsAppUrl: string;
  whatsAppWebUrl?: string;
  whatsAppAppUrl?: string;
  documentTitle: string;
  copiedToClipboard?: boolean;
  fileName?: string;
  onDirectSharePdf?: () => void;
  phone?: string;
  shareText?: string;
  base64Pdf?: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  whatsAppUrl = 'https://wa.me/',
  whatsAppWebUrl,
  whatsAppAppUrl,
  documentTitle,
  copiedToClipboard = true,
  fileName,
  onDirectSharePdf,
  phone,
  shareText,
  base64Pdf,
}) => {
  const [desktopStatus, setDesktopStatus] = useState<WhatsAppServiceStatus['status']>('disconnected');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isSendingBackground, setIsSendingBackground] = useState(false);
  const [backgroundSentSuccess, setBackgroundSentSuccess] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const handleCopy = () => {
    const textToCopy = shareText || whatsAppUrl;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const isDesktopSupported = whatsappDesktopService.isSupported();

  useEffect(() => {
    if (!isOpen || !isDesktopSupported) return;

    whatsappDesktopService.getStatus().then((res) => {
      setDesktopStatus(res.status);
      if (res.qrCode) setQrCodeData(res.qrCode);
    });

    const unsubStatus = whatsappDesktopService.onStatus((data) => {
      setDesktopStatus(data.status);
      if (data.status === 'connected') {
        setShowQrPanel(false);
      }
    });

    const unsubQr = whatsappDesktopService.onQr((qr) => {
      setQrCodeData(qr);
      if (qr) setShowQrPanel(true);
    });

    return () => {
      unsubStatus();
      unsubQr();
    };
  }, [isOpen, isDesktopSupported]);

  if (!isOpen) return null;

  const handleStartDesktopConnect = async () => {
    setShowQrPanel(true);
    await whatsappDesktopService.startSession();
  };

  const handleSendBackground = async () => {
    if (!phone) {
      setBackgroundError('No valid customer phone number found on invoice.');
      return;
    }
    setIsSendingBackground(true);
    setBackgroundError(null);
    try {
      const res = await whatsappDesktopService.sendMessage({
        phone,
        text: shareText || '',
        base64Pdf,
        fileName
      });
      if (res.success) {
        setBackgroundSentSuccess(true);
      } else {
        setBackgroundError(res.error || 'Failed to dispatch WhatsApp message.');
      }
    } catch (err: any) {
      setBackgroundError(err?.message || 'Error communicating with background WhatsApp.');
    } finally {
      setIsSendingBackground(false);
    }
  };

  const isDesktopDevice = typeof window !== 'undefined' && window.innerWidth > 1024;
  const hasNativeMobileShare = (typeof navigator !== 'undefined' && Boolean(navigator.share)) || 
                               (typeof window !== 'undefined' && Boolean((window as any).AndroidFileManager?.shareFile));

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" id="whatsapp-instructions-modal">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-neutral-100 transform transition-all relative max-h-[94vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 transition-colors rounded-full border-none bg-transparent cursor-pointer"
          title="Close Modal"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner ring-4 ring-green-50">
            <WhatsAppIcon size={32} className="animate-pulse" />
          </div>
          
          <div className="space-y-1 text-center">
            <h3 className="text-xl font-extrabold text-neutral-900">
              WhatsApp Invoice Share
            </h3>
            <p className="text-xs text-green-600 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 size={13} />
              {documentTitle} Ready for Delivery
            </p>
          </div>

          {/* Desktop Automation Status & Actions */}
          {isDesktopSupported && (
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap size={14} className={desktopStatus === 'connected' ? 'text-emerald-600' : 'text-amber-500'} />
                  Desktop Background Sender:
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                  desktopStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {desktopStatus === 'connected' ? '● Connected' : 'Not Paired'}
                </span>
              </div>

              {desktopStatus === 'connected' ? (
                <>
                  {backgroundSentSuccess ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      <span>Invoice sent directly to customer WhatsApp in background!</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isSendingBackground}
                      onClick={handleSendBackground}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSendingBackground ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Sending directly in background...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={16} />
                          <span>⚡ Send Directly in Background (Zero Clicks)</span>
                        </>
                      )}
                    </button>
                  )}
                  {backgroundError && (
                    <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle size={14} /> {backgroundError}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Connect your WhatsApp once to send invoices silently without opening web browser.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartDesktopConnect}
                    className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <QrCode size={14} />
                    <span>Pair Desktop WhatsApp (Scan QR)</span>
                  </button>

                  {showQrPanel && qrCodeData && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center space-y-2">
                      <p className="text-[11px] font-bold text-slate-700">Scan this QR in WhatsApp Linked Devices:</p>
                      <img src={qrCodeData} alt="WhatsApp QR Code" className="w-48 h-48 mx-auto rounded-lg shadow-sm" />
                      <p className="text-[10px] text-slate-400">Settings &gt; Linked Devices &gt; Link a Device</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Android / Mobile Native Direct Share Button */}
          {hasNativeMobileShare && onDirectSharePdf && (
            <button
              type="button"
              onClick={onDirectSharePdf}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 size={16} />
              Share Invoice PDF Directly via WhatsApp (Auto-Attached)
            </button>
          )}

          {/* Steps summary */}
          <div className="w-full border-t border-b border-gray-100 py-3 my-1 text-left space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-xs font-bold shrink-0 mt-0.5">
                1
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Saved:</strong> {fileName ? `File "${fileName}"` : `${documentTitle} PDF`} ready.
              </p>
            </div>
            
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-xs font-bold shrink-0 mt-0.5">
                2
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Summary & Details:</strong> {copiedToClipboard ? `Summary copied to clipboard. Press Ctrl + V to paste preview!` : "Details pre-filled."}
              </p>
            </div>
          </div>

          {/* Universal Fallback Links */}
          <div className="w-full pt-1 flex flex-col gap-2">
            {isDesktopDevice && (whatsAppWebUrl || whatsAppAppUrl) ? (
              <>
                {whatsAppWebUrl && (
                  <a
                    href={whatsAppWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      openInBrowser(whatsAppWebUrl);
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 cursor-pointer no-underline text-xs"
                  >
                    <WhatsAppIcon size={18} />
                    Open in WhatsApp Web (Browser)
                  </a>
                )}
                {whatsAppAppUrl && (
                  <a
                    href={whatsAppAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      openInBrowser(whatsAppAppUrl);
                    }}
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-emerald-100 cursor-pointer no-underline text-xs"
                  >
                    <WhatsAppIcon size={15} />
                    Open in WhatsApp Desktop App
                  </a>
                )}
              </>
            ) : (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  openInBrowser(whatsAppUrl);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 border-none cursor-pointer no-underline text-xs"
              >
                <WhatsAppIcon size={18} />
                Open WhatsApp Chat
              </a>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-xl transition-all border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            >
              {copiedText ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Message Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Message & Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all border-none cursor-pointer text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
