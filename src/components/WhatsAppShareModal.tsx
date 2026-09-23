import React from 'react';
import { X, Share2, CheckCircle2 } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { openInBrowser } from '../lib/utils';

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
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  whatsAppUrl,
  whatsAppWebUrl,
  whatsAppAppUrl,
  documentTitle,
  copiedToClipboard = true,
  fileName,
  onDirectSharePdf,
}) => {
  if (!isOpen) return null;

  // Simple heuristic for checking if it is a desktop device
  const isDesktopDevice = typeof window !== 'undefined' && window.innerWidth > 1024;

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

        <div className="flex flex-col items-center space-y-5">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner ring-4 ring-green-50">
            <WhatsAppIcon size={32} className="animate-pulse" />
          </div>
          
          <div className="space-y-1 text-center">
            <h3 className="text-xl font-extrabold text-neutral-900">
              WhatsApp Share Started
            </h3>
            <p className="text-xs text-green-600 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 size={13} />
              {documentTitle} Summary Copied & Saved!
            </p>
          </div>

          <div className="w-full border-t border-b border-gray-100 py-4 my-1 text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-xs font-bold shrink-0 mt-0.5">
                1
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Saved:</strong> {fileName ? `File "${fileName}"` : `${documentTitle} PDF`} has been downloaded automatically to your device.
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-xs font-bold shrink-0 mt-0.5">
                2
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Pasting Image & Details:</strong> {copiedToClipboard ? `${documentTitle} image/summary copied to clipboard! Click inside WhatsApp chat and press Ctrl + V (or long-press & Paste) to send the picture!` : "Text details pre-filled in your WhatsApp chat box."}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-xs font-bold shrink-0 mt-0.5">
                3
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Direct Message:</strong> Sent directly to WhatsApp without third-party web links.
              </p>
            </div>
          </div>

          {onDirectSharePdf && typeof navigator !== "undefined" && navigator.share && (
            <button
              type="button"
              onClick={onDirectSharePdf}
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-all border border-emerald-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 size={15} />
              Share PDF File Directly via App
            </button>
          )}

          <div className="w-full pt-1 flex flex-col gap-2.5">
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
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 border-none cursor-pointer no-underline text-sm"
                  >
                    <WhatsAppIcon size={20} />
                    Open in WhatsApp Web (Chrome)
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
                    className="w-full py-2.5 bg-[#F0FDF4] hover:bg-[#F0FDF4] text-[#166534] font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-emerald-100 cursor-pointer no-underline text-xs"
                  >
                    <WhatsAppIcon size={16} />
                    Open in WhatsApp App (PC)
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
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 border-none cursor-pointer no-underline text-sm"
              >
                <WhatsAppIcon size={20} />
                Open WhatsApp Chat Now
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all border-none cursor-pointer text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
