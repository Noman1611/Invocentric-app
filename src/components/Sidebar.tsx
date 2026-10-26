import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { KeyUnderline } from './KeyUnderline';
import { getStoredUserProfile } from '../utils/settingsStorage';
import { motion } from 'motion/react';
import { 
  Home,
  FileText, 
  Users, 
  Settings, 
  LogOut,
  ShieldCheck,
  FileEdit,
  Package,
  CreditCard,
  BarChart3,
  TrendingDown,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Database,
  Book,
  QrCode,
  Store,
  Briefcase,
  MoreVertical,
  Barcode,
  AlertCircle,
  Tag,
  ShoppingBag,
  Sparkles,
  Lock,
  Download,
  HardDrive,
  Layout as LayoutIcon,
  ScanLine
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Sidebar({ onProfileClick }: { onProfileClick?: () => void }) {
  const { logout, user, isAdmin, appMode, planTier, isPro, triggerUpgradeModal } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => location.pathname.startsWith('/settings'));
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Sync custom User Profile photo immediately over default email/Google photo
  useEffect(() => {
    const updateAvatar = () => {
      if (!user) {
        setUserAvatar(null);
        return;
      }
      const stored = getStoredUserProfile(user.uid);
      const customPhoto = stored?.profile_photo_url || stored?.photo_url;
      if (customPhoto) {
        setUserAvatar(customPhoto);
      } else if (stored && (stored.profile_photo_url === '' || stored.photo_url === '')) {
        setUserAvatar(null);
      } else {
        setUserAvatar(user.photoURL || null);
      }
    };

    updateAvatar();

    const handleProfileChange = (e: any) => {
      if (e?.detail?.profile_photo_url !== undefined) {
        setUserAvatar(e.detail.profile_photo_url || null);
      } else {
        updateAvatar();
      }
    };

    window.addEventListener('invocentric_profile_updated', handleProfileChange);
    window.addEventListener('storage', updateAvatar);
    return () => {
      window.removeEventListener('invocentric_profile_updated', handleProfileChange);
      window.removeEventListener('storage', updateAvatar);
    };
  }, [user]);

  const isHardcodedAdmin = user?.email?.toLowerCase() === 'nomanshaikh1999@gmail.com';
  const showAdmin = isAdmin || isHardcodedAdmin;

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!showAdmin) return;
    
    const q = query(collection(db, 'subscription_requests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    }, (error) => {
      console.error("Error fetching pending subscription requests in Sidebar:", error);
    });
    
    return () => unsubscribe();
  }, [showAdmin]);

  const menuGroups = [
    {
      title: 'SALES & CLIENTS',
      items: [
        { name: 'Invoices', path: '/invoices', icon: FileText, hotkey: 'I' },
        { name: appMode === 'freelancer' ? 'Proposals' : 'Quotations', path: '/quotations', icon: FileEdit, hotkey: 'Q' },
        { name: appMode === 'freelancer' ? 'Clients' : 'Parties', path: '/customers', icon: Users, hotkey: appMode === 'freelancer' ? 'C' : 'P' },
        { name: 'Payments', path: '/payments', icon: CreditCard, hotkey: 'M' },
      ]
    },
    {
      title: 'INVENTORY & PURCHASES',
      items: [
        { name: 'Products & Stock', path: '/items', icon: Package, hotkey: 'T' },
        { name: appMode === 'freelancer' ? 'Software & Tools' : 'Purchases', path: '/purchases', icon: ShoppingBag, hotkey: 'U' },
      ]
    },
    {
      title: 'ACCOUNTS & EXPENSES',
      items: [
        { name: 'Daily Book', path: '/dailybook', icon: Book, hotkey: 'B' },
        { name: 'Expenses', path: '/expenses', icon: TrendingDown, hotkey: 'E' },
      ]
    },
    {
      title: 'REPORTS & TOOLS',
      items: [
        { name: 'Reports', path: '/reports', icon: BarChart3, hotkey: 'R' },
        { name: 'Barcode Generator', path: '/barcode-generator', icon: Barcode, hotkey: 'G' },
        { name: 'Plans & Pricing', path: '/pricing', icon: Sparkles },
      ]
    }
  ];

  const settingsSubItems = [
    { name: 'User Profile', path: '/settings?tab=profile', icon: Users },
    { name: 'Company Settings', path: '/settings?tab=company', icon: Store },
    { name: 'Tax & Numbering', path: '/settings?tab=tax', icon: FileText },
    { name: 'Payment Details', path: '/settings?tab=payment', icon: CreditCard },
    { name: 'Storage & Backup', path: '/settings?tab=storage', icon: HardDrive },
    { name: 'System Settings', path: '/settings?tab=system', icon: Settings },
    { name: 'Plan & Security', path: '/settings?tab=security', icon: ShieldCheck },
  ];

  const adminItem = { name: 'Admin Control', path: '/admin', icon: ShieldCheck, hotkey: 'A' };

  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const primaryNavItems = [
    { name: 'Overview', path: '/', icon: Home, hotkey: 'D' },
    { name: 'Invoices', path: '/invoices', icon: FileText, hotkey: 'I' },
    { name: 'Point of Sale', path: '/pos', icon: ScanLine, hotkey: 'K', isPos: true },
    { name: appMode === 'freelancer' ? 'Products & Tools' : 'Inventory', path: '/items', icon: Package, hotkey: 'T' },
    { name: appMode === 'freelancer' ? 'Clients' : 'Parties', path: '/customers', icon: Users, hotkey: appMode === 'freelancer' ? 'C' : 'P' },
    { name: 'Reports', path: '/reports', icon: BarChart3, hotkey: 'R' },
  ];

  const workspaceSubItems = [
    { name: appMode === 'freelancer' ? 'Proposals' : 'Quotations', path: '/quotations', icon: FileEdit, hotkey: 'Q' },
    { name: appMode === 'freelancer' ? 'Software & Tools' : 'Purchases', path: '/purchases', icon: ShoppingBag, hotkey: 'U' },
    { name: 'Daily Book', path: '/dailybook', icon: Book, hotkey: 'B' },
    { name: 'Expenses', path: '/expenses', icon: TrendingDown, hotkey: 'E' },
    { name: 'Payments', path: '/payments', icon: CreditCard, hotkey: 'M' },
    { name: 'Barcode Generator', path: '/barcode-generator', icon: Barcode, hotkey: 'G' },
    { name: 'Plans & Pricing', path: '/pricing', icon: Sparkles },
  ];

  return (
    <aside className={cn(
      "h-[calc(100vh-24px)] flex flex-col transition-all duration-300 ease-in-out relative z-30 bg-[#073E36] text-white rounded-[28px] my-3 ml-3 shadow-2xl border border-[#0d4f45]",
      collapsed ? "w-20" : "w-56"
    )}>
      {/* Header with Official App Brand */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className={cn("flex items-center gap-2.5 transition-all duration-300", collapsed && "opacity-0 hidden")}>
          <Logo size={28} showBg={false} />
          <div className="flex flex-col">
            <span className="font-brand text-[17px] tracking-tight text-white font-extrabold leading-tight">
              InvoCentric
            </span>
          </div>
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-xl transition-all hover:bg-white/10 text-white/70 hover:text-white cursor-pointer ml-auto"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <ChevronLeft size={16} className={cn("transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav Items Scrollable List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 custom-scrollbar no-scrollbar space-y-1">
        {primaryNavItems.map((item) => {
          const isPosItem = (item as any).isPos;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(e) => {
                if (isPosItem && !isPro) {
                  e.preventDefault();
                  triggerUpgradeModal('Quick POS & Barcode Billing', [
                    'Fast point-of-sale layout designed for touch screens and thermal printers.',
                    'Real-time barcode scanning using device camera or handheld USB laser scanners.',
                    'Automated cash till logging, customer balance tracking, and retail analytics.'
                  ]);
                }
              }}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 group relative text-sm select-none",
                  isActive 
                    ? "bg-white/15 text-white font-extrabold shadow-xs" 
                    : "text-[#D4ECE6]/80 hover:bg-white/10 hover:text-white font-medium"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-white" : "text-[#D4ECE6]/80 group-hover:text-white")} />
                  {!collapsed && (
                    <span className="text-[13px] tracking-tight flex-1 flex items-center justify-between">
                      <KeyUnderline text={item.name} hotkey={(item as any).hotkey} />
                      {isPosItem && !isPro && (
                        <Lock size={12} className="text-[#D7F4D4] ml-1.5 shrink-0" />
                      )}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Workspace Dropdown Group */}
        <div className="pt-1">
          <button
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 group relative text-sm cursor-pointer select-none",
              workspaceOpen || workspaceSubItems.some(sub => location.pathname === sub.path)
                ? "bg-white/10 text-white font-bold"
                : "text-[#D4ECE6]/80 hover:bg-white/10 hover:text-white font-medium"
            )}
          >
            <LayoutIcon size={18} className="shrink-0 text-[#D4ECE6]/80 group-hover:text-white" />
            {!collapsed && (
              <span className="text-[13px] tracking-tight flex-1 flex items-center justify-between text-left">
                <span>Workspace</span>
                {workspaceOpen
                  ? <ChevronDown size={14} className="text-white/80 transition-transform duration-200" />
                  : <ChevronRight size={14} className="text-white/60 transition-transform duration-200" />
                }
              </span>
            )}
          </button>

          {/* Workspace Sub-Items */}
          {workspaceOpen && !collapsed && (
            <div className="space-y-0.5 pl-3 border-l border-white/20 ml-5 my-1.5">
              {workspaceSubItems.map((sub) => (
                <NavLink
                  key={sub.path}
                  to={sub.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 group text-[12px]",
                      isActive
                        ? "bg-white/20 text-white font-extrabold"
                        : "text-[#D4ECE6]/70 hover:bg-white/10 hover:text-white font-medium"
                    )
                  }
                >
                  <sub.icon size={14} className="shrink-0" />
                  <span className="tracking-tight truncate">{sub.name}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Collapsible Settings Menu */}
        <div className="pt-1">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 group relative text-sm cursor-pointer select-none",
              location.pathname.startsWith('/settings')
                ? "bg-white/15 text-white font-extrabold shadow-xs"
                : "text-[#D4ECE6]/80 hover:bg-white/10 hover:text-white font-medium"
            )}
          >
            <Settings size={18} className="shrink-0 text-[#D4ECE6]/80 group-hover:text-white" />
            {!collapsed && (
              <span className="text-[13px] tracking-tight flex-1 flex items-center justify-between text-left">
                <KeyUnderline text="Settings" hotkey="S" />
                {settingsOpen
                  ? <ChevronDown size={14} className="text-white/80 transition-transform duration-200" />
                  : <ChevronRight size={14} className="text-white/60 transition-transform duration-200" />
                }
              </span>
            )}
          </button>

          {/* Settings Sub-Menu */}
          {settingsOpen && !collapsed && (
            <div className="space-y-0.5 pl-3 border-l border-white/20 ml-5 my-1.5">
              {settingsSubItems.map((sub) => {
                const isSubActive = location.pathname === '/settings' && location.search === sub.path.replace('/settings', '');
                return (
                  <NavLink
                    key={sub.path}
                    to={sub.path}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 group text-[12px]",
                      isSubActive
                        ? "bg-white/20 text-white font-extrabold"
                        : "text-[#D4ECE6]/70 hover:bg-white/10 hover:text-white font-medium"
                    )}
                  >
                    <sub.icon size={14} className="shrink-0" />
                    <span className="tracking-tight truncate">{sub.name}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin Section */}
        {showAdmin && (
          <div className="pt-1">
            <NavLink
              to={adminItem.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 group relative text-sm",
                  isActive 
                    ? "bg-white/15 text-white font-extrabold shadow-xs" 
                    : "text-[#D4ECE6]/80 hover:bg-white/10 hover:text-white font-medium"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <adminItem.icon size={18} className="shrink-0" />
                  {!collapsed && (
                    <span className="text-[13px] tracking-tight flex-1 flex items-center justify-between">
                      <KeyUnderline text={adminItem.name} hotkey={adminItem.hotkey} />
                      {pendingCount > 0 && (
                        <span className="bg-[#BE3349] text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                    </span>
                  )}
                  {collapsed && pendingCount > 0 && (
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#BE3349] animate-pulse border-2 border-white" />
                  )}
                </>
              )}
            </NavLink>
          </div>
        )}
      </div>

      {/* Footer User Profile & Logout */}
      <div className="p-3 border-t border-white/10 space-y-1.5 shrink-0">
        {!collapsed && (
          <div 
            onClick={onProfileClick}
            className="flex items-center justify-between p-2 rounded-2xl border border-white/10 bg-white/10 hover:bg-white/15 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-[#D7F4D4] text-[#073E36] font-bold text-xs">
                {userAvatar ? (
                  <img src={userAvatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold truncate leading-tight text-white">{user?.displayName || user?.email?.split('@')[0] || 'Business Owner'}</p>
                <p className="text-[9px] font-extrabold text-[#D7F4D4]/80 leading-none mt-0.5 uppercase tracking-wider">{planTier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
              </div>
            </div>
            <MoreVertical size={14} className="text-white/60 shrink-0 ml-1 hover:text-white transition-colors" />
          </div>
        )}

        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-2.5 w-full py-2 transition-all text-[12px] font-bold px-3 rounded-xl text-white/70 hover:text-rose-200 hover:bg-white/10 cursor-pointer",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
