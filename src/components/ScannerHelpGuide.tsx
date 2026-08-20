import React, { useState } from 'react';
import { 
  HelpCircle, 
  Smartphone, 
  Barcode, 
  Camera, 
  Keyboard, 
  CheckCircle2, 
  Terminal, 
  Settings, 
  AlertTriangle, 
  ArrowRight, 
  Copy, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  Lightbulb,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

export function ScannerHelpGuide() {
  const [activeTab, setActiveTab] = useState<'usb-gun' | 'mobile-usb' | 'pc-camera' | 'add-items'>('usb-gun');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const faqItems = [
    {
      q: "My USB Gun scans but doesn't press Enter/Add item automatically. What should I do?",
      a: "Most scanner guns can be programmed to send a 'Carriage Return' (Enter key) after every scan. Look at your scanner gun's printed manual and scan the configuration barcode labeled 'Add Enter Suffix' or 'Add CR Suffix'. Once done, it will auto-submit invoices instantly!"
    },
    {
      q: "The PC Camera is very slow or cannot focus on barcodes. How to improve?",
      a: "1. Make sure you have adequate lighting. Barcodes need sharp contrast to be recognized.\n2. Do not hold the item too close to the camera (keep it 10-15 cm away).\n3. Tap anywhere on the camera viewfinder to trigger continuous autofocus."
    },
    {
      q: "How does the Mobile USB Cam Bridge work?",
      a: "It acts as a local network bridge. By connecting your phone via USB and running the port-forwarding command, your phone's browser can safely talk to the invoice server running on your computer. This lets you use your phone's high-quality camera as a wireless scanner!"
    },
    {
      q: "Where do I add/configure barcodes for my items?",
      a: "Go to the 'Inventory / Items' page, click 'Add Item' or edit an existing item, and scan or type its barcode value. Once saved, scanning that barcode anywhere in Create Invoice or POS will instantly load that item!"
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <HelpCircle size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Scanner Setup & Connection Guide</h3>
            <p className="text-[10px] text-slate-500 font-bold">Step-by-step instructions for all hardware</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest">
          <Sparkles size={11} className="text-emerald-500 animate-pulse" />
          <span>SaaS Pro Guide</span>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-slate-100/80 p-1.5 border-b border-slate-200">
        {[
          { id: 'usb-gun', label: 'USB Gun', icon: Barcode },
          { id: 'mobile-usb', label: 'Mobile Cam', icon: Smartphone },
          { id: 'pc-camera', label: 'PC Camera', icon: Camera },
          { id: 'add-items', label: 'Item Reg.', icon: Plus },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                activeTab === tab.id
                  ? "bg-white text-emerald-600 border border-slate-200 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              )}
            >
              <Icon size={13} />
              <span className="hidden xs:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div className="p-4 space-y-3.5 bg-white text-slate-600">
        
        {activeTab === 'usb-gun' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0">1</span>
              <p className="text-[11px] font-bold text-slate-800">Plug & Play Connection</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium pl-7 leading-relaxed">
              Plug your USB Scanner Gun into any available USB port on your PC or Laptop. Most scanners require absolutely no drivers or software installation.
            </p>

            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0">2</span>
              <p className="text-[11px] font-bold text-slate-800">Select "USB Gun" Mode</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium pl-7 leading-relaxed">
              Click the <span className="font-bold text-slate-800">USB Gun</span> tab above. The barcode input field will automatically request focus (a green active border will appear).
            </p>

            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0">3</span>
              <p className="text-[11px] font-bold text-slate-800">Point & Press Trigger</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium pl-7 leading-relaxed">
              Aim the red scanner laser line across your product's barcode label. Press the trigger. The scanner gun will read the value and automatically insert the item into your invoice or cart!
            </p>

            <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/60 text-[10px] text-slate-600 flex items-start gap-2 mt-2">
              <Lightbulb size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-800 font-bold">Pro Tip:</strong> Ensure your cursor remains inside the input field so the USB scanner gun can input the data instantly.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'mobile-usb' && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[10px] text-slate-600 flex items-center gap-2">
              <Settings className="text-emerald-600 shrink-0" size={14} />
              <span className="font-bold text-slate-800">Transform your Android/iOS Phone into a wireless barcode gun!</span>
            </div>

            <div className="space-y-2.5 pl-1">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">1</span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-800">Enable USB Debugging</h4>
                  <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                    Connect your phone to your PC using a USB cable. On Android, go to Settings &gt; Developer Options &gt; enable <strong className="text-slate-800">USB Debugging</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">2</span>
                <div className="flex-1">
                  <h4 className="text-[11px] font-bold text-slate-800">Run ADB Port Forwarding</h4>
                  <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                    Open Terminal/Command Prompt on your computer and run this command:
                  </p>
                  <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1.5 items-center justify-between mt-1.5">
                    <code className="text-[9.5px] text-emerald-600 font-mono pl-2 text-left overflow-x-auto whitespace-nowrap scrollbar-none w-full mr-2">
                      adb reverse tcp:3000 tcp:3000
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('adb reverse tcp:3000 tcp:3000', 'adb')}
                      className="bg-slate-200 hover:bg-slate-300 text-[8.5px] uppercase tracking-wider font-extrabold px-2.5 py-1.5 rounded-lg text-slate-700 shrink-0 transition-colors"
                    >
                      {copiedText === 'adb' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">3</span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-800">Open mobile-scan Page on Phone</h4>
                  <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                    Open Chrome/Safari on your phone and browse to:
                  </p>
                  <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1.5 items-center justify-between mt-1.5">
                    <code className="text-[9.5px] text-emerald-600 font-mono pl-2 text-left overflow-x-auto whitespace-nowrap scrollbar-none w-full mr-2">
                      http://localhost:3000/mobile-scan
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('http://localhost:3000/mobile-scan', 'url')}
                      className="bg-slate-200 hover:bg-slate-300 text-[8.5px] uppercase tracking-wider font-extrabold px-2.5 py-1.5 rounded-lg text-slate-700 shrink-0 transition-colors"
                    >
                      {copiedText === 'url' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[9.5px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> The phone UI will connect and stream barcode scans instantly!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pc-camera' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0">1</span>
              <p className="text-[11px] font-bold text-slate-800">Allow Camera Permissions</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium pl-7 leading-relaxed">
              When prompted by your browser, click <strong className="text-slate-800">Allow</strong> to grant camera access. Ensure no other applications are using the camera.
            </p>

            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0">2</span>
              <p className="text-[11px] font-bold text-slate-800">Align Barcode inside Viewfinder</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium pl-7 leading-relaxed">
              Place your product's barcode directly inside the glowing green rectangle cutout. Keep the item parallel to the camera lens.
            </p>

            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0">3</span>
              <p className="text-[11px] font-bold text-slate-800">Refocus and Control Zoom</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium pl-7 leading-relaxed">
              Tap anywhere inside the video viewer to force autofocus. Use the <strong className="text-slate-800">1.4x / 2.0x</strong> zoom controls or the <strong className="text-slate-800">Flashlight/Torch</strong> toggle for low-light items.
            </p>
          </div>
        )}

        {activeTab === 'add-items' && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-[11px] text-slate-800 font-bold leading-normal">
              How to register barcodes for automatic scanning:
            </p>

            <div className="flex items-start gap-2.5 pl-1">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">1</div>
              <div>
                <h4 className="text-[11px] font-bold text-slate-800">Navigate to Inventory</h4>
                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                  Click the <span className="font-bold text-slate-800">Inventory / Items</span> page in the main navigation menu.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pl-1">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">2</div>
              <div>
                <h4 className="text-[11px] font-bold text-slate-800">Create or Edit Item</h4>
                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                  Click the <span className="font-bold text-slate-800">Add Item</span> button, or select <span className="font-bold text-slate-800">Edit</span> on an existing item.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pl-1">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">3</div>
              <div>
                <h4 className="text-[11px] font-bold text-slate-800">Enter or Scan Barcode Value</h4>
                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                  Locate the <span className="font-bold text-slate-800">Barcode</span> field. You can either type the barcode number manually, or click the scanner icon next to it and scan it to capture it instantly. Save the item.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[10px] text-slate-600 flex items-start gap-2 mt-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Your product is now ready! Scan this barcode anywhere in Invocentric to instantly load product description, price, and stock levels.
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Accordion FAQ Area */}
      <div className="border-t border-slate-200 bg-slate-50/50 p-4 space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Troubleshooting & FAQs</h4>
        {faqItems.map((faq, index) => {
          const isExpanded = expandedFAQ === index;
          return (
            <div 
              key={index}
              className="border border-slate-200 rounded-xl bg-white overflow-hidden transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => setExpandedFAQ(isExpanded ? null : index)}
                className="w-full flex items-center justify-between p-2.5 text-left text-[10px] font-bold text-slate-700 hover:text-slate-900 transition-colors"
              >
                <span>{faq.q}</span>
                {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {isExpanded && (
                <div className="px-2.5 pb-2.5 text-[9.5px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2 bg-slate-50/20">
                  {faq.a.split('\n').map((line, i) => (
                    <p key={i} className="mb-1">{line}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
