import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings,
  Plus,
  Package,
  ShieldCheck,
  MessageSquare,
  Menu as MenuIcon,
  X,
  CreditCard,
  TrendingDown,
  BarChart3,
  LogOut,
  Database,
  Book,
  QrCode,
  Barcode,
  ScanLine,
  Sparkles,
  Lock,
  Layout as LayoutIcon,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useRecycleBin } from '../hooks/useData';
import RecycleBinModal from './RecycleBinModal';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileNav() {
  const { isAdmin, user, logout, appMode, isPro, triggerUpgradeModal } = useAuth();
  const { recycleBinItems } = useRecycleBin();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  
  const isHardcodedAdmin = user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const showAdmin = isAdmin || isHardcodedAdmin;

  // Do not render bottom nav on document viewer, fullscreen scanner, or POS routes
  const isInvoiceDetail = (location.pathname.startsWith('/invoices/') || location.pathname.startsWith('/invoices/view/')) &&
    !location.pathname.startsWith('/invoices/create') &&
    !location.pathname.startsWith('/invoices/new') &&
    !location.pathname.startsWith('/invoices/edit') &&
    location.pathname !== '/invoices';

  if (
    isInvoiceDetail ||
    location.pathname.startsWith('/mobile-scan') ||
    location.pathname.startsWith('/pos')
  ) {
    return null;
  }
  
  // Main bottom bar items (Max 4-5 including FAB)
  const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Invoices', path: '/invoices', icon: FileText },
  ];

  const rightNavItems = [
    { name: appMode === 'freelancer' ? 'Clients' : 'Parties', path: '/customers', icon: Users },
  ];

  const menuItems = [
    { name: appMode === 'freelancer' ? 'Services' : 'Products & Stock', path: '/items', icon: Package },
    { name: appMode === 'freelancer' ? 'Software & Tools' : 'Purchases', path: '/purchases', icon: Database },
    { name: 'Payments', path: '/payments', icon: CreditCard },
    { name: 'Daily Book', path: '/dailybook', icon: Book },
    { name: 'Expenses', path: '/expenses', icon: TrendingDown },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Barcode Generator', path: '/barcode-generator', icon: Barcode },
    { name: 'Plans & Pricing', path: '/pricing', icon: Sparkles },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden print:hidden h-[calc(76px+env(safe-area-inset-bottom,0px))] pb-safe flex items-center justify-center px-2 pointer-events-none">
        <div className="pointer-events-auto bg-[#10251F] text-[#93A69C] rounded-[40px] shadow-[0_10px_32px_rgba(16,37,31,0.35)] max-w-[422px] w-full p-1.5 flex items-center justify-between h-14 mb-2">
          
          <div className="flex-1 flex justify-around items-center">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-11 px-3 rounded-full transition-all duration-200 active:scale-95 select-none",
                    isActive 
                      ? "bg-[#D7F4D4] text-[#193C30] font-extrabold shadow-sm" 
                      : "text-[#93A69C] hover:text-white"
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  {isActive && (
                    <span className="text-[11px] font-black tracking-tight">{item.name}</span>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Center Scan / POS Action */}
          <button
            onClick={() => {
              if (!isPro) {
                triggerUpgradeModal('Quick POS & Barcode Billing', [
                  'Fast point-of-sale layout designed for touch screens and thermal printers.',
                  'Real-time barcode scanning using device camera or handheld USB laser scanners.',
                  'Automated cash till logging, customer balance tracking, and retail analytics.'
                ]);
              } else {
                setMenuOpen(false);
                navigate('/pos');
              }
            }}
            title="Scan & Quick POS"
            className="h-11 w-11 mx-1 rounded-full bg-[#274439] hover:bg-[#325648] text-[#D7F4D4] flex items-center justify-center shadow-md active:scale-95 shrink-0 transition-all cursor-pointer border border-[#3c6152]"
          >
            <ScanLine size={19} strokeWidth={2.5} />
          </button>

          <div className="flex-1 flex justify-around items-center">
            {rightNavItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-11 px-3 rounded-full transition-all duration-200 active:scale-95 select-none",
                    isActive 
                      ? "bg-[#D7F4D4] text-[#193C30] font-extrabold shadow-sm" 
                      : "text-[#93A69C] hover:text-white"
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  {isActive && (
                    <span className="text-[11px] font-black tracking-tight">{item.name}</span>
                  )}
                </NavLink>
              );
            })}

            <button
              onClick={() => setMenuOpen(true)}
              className={cn(
                "flex items-center justify-center gap-1.5 h-11 px-3 rounded-full transition-all duration-200 active:scale-95 select-none cursor-pointer",
                menuOpen 
                  ? "bg-[#D7F4D4] text-[#193C30] font-extrabold shadow-sm" 
                  : "text-[#93A69C] hover:text-white"
              )}
              title="Open Navigation Menu"
            >
              <MenuIcon size={18} strokeWidth={2} className="shrink-0" />
              {menuOpen && (
                <span className="text-[11px] font-black tracking-tight">Menu</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 backdrop-blur-sm z-[60] bg-[#10251F]/60"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-[32px] z-[70] max-h-[88vh] flex flex-col bg-[#F6F8F3] pb-safe shadow-2xl border-t border-[#E5EBE0]"
            >
              <div className="flex justify-center pt-3 pb-2 w-full cursor-pointer" onClick={() => setMenuOpen(false)}>
                <div className="w-10 h-1.5 rounded-full bg-[#CCD4C8]" />
              </div>
              
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E5EBE0] bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-[#D7F4D4] text-[#0F645D] border border-[#C6E9C1]">
                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#102723]">{user?.displayName || 'User'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8781]">{user?.email?.split('@')[0]}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMenuOpen(false)} 
                  className="p-2 rounded-full active:scale-95 transition-colors bg-[#E9EFE6] text-[#102723] hover:bg-[#D7E2D3] cursor-pointer"
                  title="Close Menu"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-4 py-4 space-y-1.5 pb-10 custom-scrollbar">
                {menuItems.map((item) => {
                  const isActive = !(item as any).external && (location.pathname === item.path || location.pathname.startsWith(item.path));
                  return (item as any).external ? (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3.5 p-3.5 rounded-2xl transition-all text-[#102723] bg-white border border-[#E5EBE0] hover:bg-[#E9EFE6] active:scale-95 font-bold text-sm"
                      )}
                    >
                      <item.icon size={20} className="text-[#0F645D]" />
                      <span>{item.name}</span>
                    </a>
                  ) : (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={(e) => {
                        if (item.path === '/qr-generator' && !isPro) {
                          e.preventDefault();
                          setMenuOpen(false);
                          triggerUpgradeModal('QR Generator & Digital Branding', [
                            'Generate dynamic, beautifully branded UPI & website QR codes.',
                            'Auto-embed QR codes directly onto your PDF invoices for quick payments.',
                            'Real-time verification of payment status via custom QR layouts.'
                          ]);
                        } else {
                          setMenuOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-2xl transition-all border text-sm font-bold active:scale-95",
                        isActive 
                          ? "bg-[#D7F4D4] text-[#163C2C] border-[#C6E9C1] shadow-xs" 
                          : "bg-white text-[#102723] border-[#E5EBE0] hover:bg-[#E9EFE6]"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <item.icon size={20} className={isActive ? "text-[#163C2C]" : "text-[#0F645D]"} />
                        <span>{item.name}</span>
                      </div>
                      {item.path === '/qr-generator' && !isPro && (
                        <Lock size={14} className="text-[#B7892E] mr-2 shrink-0" />
                      )}
                    </NavLink>
                  );
                })}

                {/* Recycle Bin & Data Protection */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setRecycleBinOpen(true);
                  }}
                  className="flex items-center justify-between w-full p-3.5 rounded-2xl transition-all text-[#102723] bg-white border border-[#E5EBE0] hover:bg-[#E9EFE6] active:scale-95 text-sm font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <RotateCcw size={20} className="text-[#0F645D]" />
                    <span>Recycle Bin</span>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#E6F3EE] text-[#0F645D] border border-[#C6E9C1]">
                    {recycleBinItems.length} items
                  </span>
                </button>

                {showAdmin && (
                  <>
                    <div className="h-px my-3 mx-2 bg-[#E5EBE0]" />
                    <p className="px-4 text-[10px] font-black uppercase text-[#7B8B78] tracking-widest mb-1">Admin Operations</p>
                    <NavLink
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3.5 p-3.5 rounded-2xl transition-all border text-sm font-bold active:scale-95",
                        isActive 
                          ? "bg-[#D7F4D4] text-[#163C2C] border-[#C6E9C1] shadow-xs" 
                          : "bg-white text-[#102723] border-[#E5EBE0] hover:bg-[#E9EFE6]"
                      )}
                    >
                      <ShieldCheck size={20} className="text-[#0F645D]" />
                      <span>Admin Control Panel</span>
                    </NavLink>
                  </>
                )}

                <div className="h-px my-3 mx-2 bg-[#E5EBE0]" />
                
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-3.5 p-3.5 rounded-2xl text-[#BE3349] bg-[#FCE8E9] hover:bg-[#F9D6D9] active:scale-95 font-bold transition-all text-sm cursor-pointer"
                >
                  <LogOut size={20} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <RecycleBinModal
        isOpen={recycleBinOpen}
        onClose={() => setRecycleBinOpen(false)}
      />
    </>
  );
}

