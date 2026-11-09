import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  Plus,
  ScanLine,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function MobileNav() {
  const { isPro, triggerUpgradeModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Do not render bottom nav on document viewer or fullscreen scanner routes
  const isInvoiceDetail = (location.pathname.startsWith('/invoices/') || location.pathname.startsWith('/invoices/view/')) &&
    !location.pathname.startsWith('/invoices/create') &&
    !location.pathname.startsWith('/invoices/new') &&
    !location.pathname.startsWith('/invoices/edit') &&
    location.pathname !== '/invoices';

  if (
    isInvoiceDetail ||
    location.pathname.startsWith('/mobile-scan')
  ) {
    return null;
  }

  const isHomeActive = location.pathname === '/' || location.pathname === '/dashboard';
  const isCreateActive = location.pathname === '/invoices/create' || location.pathname === '/invoices/new';
  const isPosActive = location.pathname.startsWith('/pos');
  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden print:hidden h-[calc(76px+env(safe-area-inset-bottom,0px))] pb-safe flex items-center justify-center px-2 pointer-events-none">
      <div className="pointer-events-auto bg-[#10251F] text-[#93A69C] rounded-full shadow-[0_10px_32px_rgba(16,37,31,0.35)] max-w-[420px] w-full p-1.5 flex justify-around items-center h-14 mb-2 border border-[#274439]/60">
        
        {/* 1. Home Button */}
        <NavLink
          to="/dashboard"
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-200 active:scale-95 select-none text-[10.5px] sm:text-xs tracking-tight",
            isHomeActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm px-3 gap-1.5" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40"
          )}
          title="Dashboard Home"
        >
          <LayoutDashboard size={isHomeActive ? 16 : 18} strokeWidth={isHomeActive ? 2.8 : 2.2} className="shrink-0" />
          {isHomeActive && <span className="whitespace-nowrap">Home</span>}
        </NavLink>

        {/* 2. Create Invoice Button */}
        <NavLink
          to="/invoices/create"
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-200 active:scale-95 select-none text-[10.5px] sm:text-xs tracking-tight",
            isCreateActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm px-3 gap-1.5" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40"
          )}
          title="Create New Invoice"
        >
          <Plus size={isCreateActive ? 16 : 18} strokeWidth={isCreateActive ? 3 : 2.2} className="shrink-0" />
          {isCreateActive && <span className="whitespace-nowrap">Create Invoice</span>}
        </NavLink>

        {/* 3. POS Button */}
        <button
          type="button"
          onClick={() => {
            if (!isPro) {
              triggerUpgradeModal('Quick POS & Barcode Billing', [
                'Fast point-of-sale layout designed for touch screens and thermal printers.',
                'Real-time barcode scanning using device camera or handheld USB laser scanners.',
                'Automated cash till logging, customer balance tracking, and retail analytics.'
              ]);
            } else {
              navigate('/pos');
            }
          }}
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-200 active:scale-95 select-none text-[10.5px] sm:text-xs tracking-tight cursor-pointer",
            isPosActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm px-3 gap-1.5" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40"
          )}
          title="Point of Sale (POS)"
        >
          <ScanLine size={isPosActive ? 16 : 18} strokeWidth={isPosActive ? 2.8 : 2.2} className="shrink-0" />
          {isPosActive && <span className="whitespace-nowrap">POS</span>}
        </button>

        {/* 4. Setting Button */}
        <NavLink
          to="/settings"
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-200 active:scale-95 select-none text-[10.5px] sm:text-xs tracking-tight",
            isSettingsActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm px-3 gap-1.5" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40"
          )}
          title="Application Settings"
        >
          <Settings size={isSettingsActive ? 16 : 18} strokeWidth={isSettingsActive ? 2.8 : 2.2} className="shrink-0" />
          {isSettingsActive && <span className="whitespace-nowrap">Setting</span>}
        </NavLink>

      </div>
    </nav>
  );
}
