import React, { useState, useEffect, useRef } from 'react';
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

  // Currently expanded tab (shows text label for a timed window, then collapses to compact dock)
  const [expandedTab, setExpandedTab] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerExpansion = (tabKey: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setExpandedTab(tabKey);
    // Auto-collapse after 3.2 seconds back to the small compact icon dock
    timerRef.current = setTimeout(() => {
      setExpandedTab(null);
    }, 3200);
  };

  // Expand briefly on route changes to give clear feedback, then collapse
  useEffect(() => {
    let key: string | null = null;
    if (location.pathname === '/' || location.pathname === '/dashboard') key = 'home';
    else if (location.pathname === '/invoices/create' || location.pathname === '/invoices/new') key = 'create';
    else if (location.pathname.startsWith('/pos')) key = 'pos';
    else if (location.pathname.startsWith('/settings')) key = 'settings';

    if (key) {
      triggerExpansion(key);
    } else {
      setExpandedTab(null);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [location.pathname]);

  // Outside touch listener: collapse immediately if user touches the app content outside the dock
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const dock = document.getElementById('mobile-bottom-dock');
      if (dock && !dock.contains(e.target as Node)) {
        setExpandedTab(null);
      }
    };
    window.addEventListener('click', handleOutsideClick, { passive: true });
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden print:hidden h-[calc(76px+env(safe-area-inset-bottom,0px))] pb-safe flex items-center justify-center px-2 pointer-events-none">
      <div 
        id="mobile-bottom-dock"
        className="pointer-events-auto bg-[#10251F] text-[#93A69C] rounded-full shadow-[0_12px_36px_rgba(16,37,31,0.45)] border border-[#274439]/70 p-1.5 h-14 mb-2 flex justify-around items-center gap-1.5 transition-all duration-300 ease-out max-w-[420px] w-auto select-none"
      >
        
        {/* 1. Home Button */}
        <NavLink
          to="/dashboard"
          onClick={() => {
            if (isHomeActive && expandedTab === 'home') {
              setExpandedTab(null);
            } else {
              triggerExpansion('home');
            }
          }}
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-300 active:scale-95 select-none text-[11px] sm:text-xs tracking-tight shrink-0",
            isHomeActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40",
            expandedTab === 'home' ? "px-3.5 gap-1.5" : "w-11 px-0"
          )}
          title="Dashboard Home"
        >
          <LayoutDashboard size={isHomeActive ? 17 : 18} strokeWidth={isHomeActive ? 2.8 : 2.2} className="shrink-0" />
          {expandedTab === 'home' && (
            <span className="whitespace-nowrap font-black animate-in fade-in zoom-in-95 duration-200">
              Home
            </span>
          )}
        </NavLink>

        {/* 2. Create Invoice Button */}
        <NavLink
          to="/invoices/create"
          onClick={() => {
            if (isCreateActive && expandedTab === 'create') {
              setExpandedTab(null);
            } else {
              triggerExpansion('create');
            }
          }}
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-300 active:scale-95 select-none text-[11px] sm:text-xs tracking-tight shrink-0",
            isCreateActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40",
            expandedTab === 'create' ? "px-3.5 gap-1.5" : "w-11 px-0"
          )}
          title="Create New Invoice"
        >
          <Plus size={isCreateActive ? 17 : 18} strokeWidth={isCreateActive ? 3 : 2.2} className="shrink-0" />
          {expandedTab === 'create' && (
            <span className="whitespace-nowrap font-black animate-in fade-in zoom-in-95 duration-200">
              Create Invoice
            </span>
          )}
        </NavLink>

        {/* 3. POS Button */}
        <NavLink
          to="/pos"
          onClick={() => {
            if (isPosActive && expandedTab === 'pos') {
              setExpandedTab(null);
            } else {
              triggerExpansion('pos');
            }
          }}
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-300 active:scale-95 select-none text-[11px] sm:text-xs tracking-tight shrink-0",
            isPosActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40",
            expandedTab === 'pos' ? "px-3.5 gap-1.5" : "w-11 px-0"
          )}
          title="Point of Sale (POS)"
        >
          <ScanLine size={isPosActive ? 17 : 18} strokeWidth={isPosActive ? 2.8 : 2.2} className="shrink-0" />
          {expandedTab === 'pos' && (
            <span className="whitespace-nowrap font-black animate-in fade-in zoom-in-95 duration-200">
              POS
            </span>
          )}
        </NavLink>

        {/* 4. Setting Button */}
        <NavLink
          to="/settings"
          onClick={() => {
            if (isSettingsActive && expandedTab === 'settings') {
              setExpandedTab(null);
            } else {
              triggerExpansion('settings');
            }
          }}
          className={cn(
            "flex-1 flex items-center justify-center h-11 rounded-full transition-all duration-300 active:scale-95 select-none text-[11px] sm:text-xs tracking-tight shrink-0",
            isSettingsActive 
              ? "bg-[#D7F4D4] text-[#193C30] font-black shadow-sm" 
              : "text-[#93A69C] hover:text-white font-bold hover:bg-[#193C30]/40",
            expandedTab === 'settings' ? "px-3.5 gap-1.5" : "w-11 px-0"
          )}
          title="Application Settings"
        >
          <Settings size={isSettingsActive ? 17 : 18} strokeWidth={isSettingsActive ? 2.8 : 2.2} className="shrink-0" />
          {expandedTab === 'settings' && (
            <span className="whitespace-nowrap font-black animate-in fade-in zoom-in-95 duration-200">
              Setting
            </span>
          )}
        </NavLink>

      </div>
    </nav>
  );
}
