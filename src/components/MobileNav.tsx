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
  ScanLine,
  Sparkles,
  Lock,
  Layout as LayoutIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileNav() {
  const { isAdmin, user, logout, appMode, isPro, triggerUpgradeModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  
  const isHardcodedAdmin = user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const showAdmin = isAdmin || isHardcodedAdmin;
  
  // Main bottom bar items (Max 4-5 including FAB)
  const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Invoices', path: '/invoices', icon: FileText },
  ];

  const rightNavItems = [
    { name: appMode === 'freelancer' ? 'Clients' : 'Parties', path: '/customers', icon: Users },
  ];

  const menuItems = [
    { name: appMode === 'freelancer' ? 'Services' : 'Items', path: '/items', icon: Package },
    { name: 'Payments', path: '/payments', icon: CreditCard },
    { name: appMode === 'freelancer' ? 'Software & Tools' : 'Purchases', path: '/purchases', icon: Database },
    { name: 'Expenses', path: '/expenses', icon: TrendingDown },
    { name: 'Daily Book', path: '/dailybook', icon: Book },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Barcode Generator', path: '/barcode-generator', icon: QrCode },
    { name: 'QR Generator', path: '/qr-generator', icon: QrCode },
    { name: 'Plans & Pricing', path: '/pricing', icon: Sparkles },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden print:hidden h-[68px] pb-safe flex items-center justify-between px-2 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg shadow-slate-900/5">
        
        <div className="flex-1 flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-2xl transition-all",
                  isActive ? "text-green-600" : "text-neutral-400"
                )}
                onClick={() => setMenuOpen(false)}
              >
                <item.icon size={20} className={cn("transition-transform duration-300", isActive && "scale-110")} strokeWidth={isActive ? 3 : 2} />
                <span className={cn("text-[8px] font-black uppercase tracking-widest leading-none", isActive ? "opacity-100" : "opacity-60")}>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Center FAB */}
        <div className="relative -top-6 mx-1">
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
            className="w-14 h-14 rounded-full flex items-center justify-center  active:scale-95 transition-all outline-none bg-green-600 text-white shadow-lg shadow-green-600/30"
          >
            <ScanLine size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 flex justify-around items-center">
          {rightNavItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-2xl transition-all",
                  isActive ? "text-green-600" : "text-neutral-400"
                )}
                onClick={() => setMenuOpen(false)}
              >
                <item.icon size={20} className={cn("transition-transform duration-300", isActive && "scale-110")} strokeWidth={isActive ? 3 : 2} />
                <span className={cn("text-[8px] font-black uppercase tracking-widest leading-none", isActive ? "opacity-100" : "opacity-60")}>{item.name}</span>
              </NavLink>
            );
          })}

          <button
            onClick={() => setMenuOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-2xl transition-all",
              menuOpen ? "text-green-600" : "text-neutral-400"
            )}
          >
            <MenuIcon size={20} className={cn("transition-transform duration-300", menuOpen && "scale-110")} strokeWidth={menuOpen ? 3 : 2} />
            <span className={cn("text-[8px] font-black uppercase tracking-widest leading-none", menuOpen ? "opacity-100" : "opacity-60")}>Menu</span>
          </button>
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
              className="fixed inset-0 backdrop-blur-sm z-[60] bg-neutral-900/40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-[70] max-h-[85vh] flex flex-col  bg-white"
            >
              <div className="flex justify-center pt-3 pb-2 w-full" onClick={() => setMenuOpen(false)}>
                <div className="w-12 h-1.5 rounded-full bg-neutral-200" />
              </div>
              
              <div className="flex items-center justify-between px-6 py-4 border-b transition-colors border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-green-100 text-green-700">
                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{user?.displayName || 'User'}</p>
                    <p className="text-[10px] font-medium uppercase text-neutral-500">{user?.email?.split('@')[0]}</p>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full active:scale-95 transition-colors bg-neutral-100 text-neutral-600">
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-4 py-4 space-y-2 pb-8 custom-scrollbar">
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
                        "flex items-center gap-4 p-4 rounded-2xl transition-all text-neutral-600 hover:bg-neutral-50 active:bg-neutral-50"
                      )}
                    >
                      <item.icon size={22} className="text-slate-500" />
                      <span className="text-[15px]">{item.name}</span>
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
                        "flex items-center justify-between p-4 rounded-2xl transition-all",
                        isActive 
                          ? "bg-green-50 text-green-700 font-bold" 
                          : "text-neutral-600 active:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon size={22} className={isActive ? "text-green-600" : "text-slate-500"} />
                        <span className="text-[15px]">{item.name}</span>
                      </div>
                      {item.path === '/qr-generator' && !isPro && (
                        <Lock size={14} className="text-amber-500 mr-2 shrink-0" />
                      )}
                    </NavLink>
                  );
                })}

                {showAdmin && (
                  <>
                    <div className="h-px my-4 mx-2 bg-neutral-100" />
                    <p className="px-4 text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-2">Admin Options</p>
                    <NavLink
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) => cn(
                        "flex items-center gap-4 p-4 rounded-2xl transition-all",
                        isActive 
                          ? "bg-green-50 text-green-700 font-bold" 
                          : "text-green-600 active:bg-green-50/50"
                      )}
                    >
                      <ShieldCheck size={22} />
                      <span className="text-[15px] font-bold">Admin Panel</span>
                    </NavLink>
                  </>
                )}

                <div className="h-px my-4 mx-2 bg-neutral-100" />
                
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-4 p-4 rounded-2xl text-red-600 active:bg-red-50 font-bold transition-all"
                >
                  <LogOut size={22} />
                  <span className="text-[15px]">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

