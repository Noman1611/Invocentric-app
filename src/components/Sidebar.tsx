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
  Layout as LayoutIcon
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

  return (
    <aside className={cn(
      "h-screen flex flex-col transition-all duration-300 ease-in-out relative z-20 shadow-sm bg-white text-[#102723] border-r border-[#E5EBE0]",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Header with Official App Logo */}
      <div className="p-5 flex items-center justify-between mb-2 border-b border-[#F0F4EC]">
        <div className={cn("flex items-center gap-2.5 transition-all duration-300", collapsed && "opacity-0 hidden")}>
          <Logo size={36} showBg={true} />
          <div className="flex flex-col">
            <span className="font-brand text-[15px] tracking-tight text-[#102723] leading-tight font-extrabold">
              Invo<span className="text-[#0F645D]">Centric</span>
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest leading-none text-[#0F645D] bg-[#E6F3EE] px-1.5 py-0.5 rounded-full mt-0.5 inline-block w-max">
              Enterprise
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-xl transition-all hover:bg-[#E9EFE6] text-[#7B8781] hover:text-[#102723] cursor-pointer"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronLeft size={16} className={cn("transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Nav Items Scrollable List */}
      <div className="flex-1 overflow-y-auto px-3.5 mt-2 custom-scrollbar no-scrollbar space-y-1">
        {/* Dashboard Link stands at the very top */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative mb-1.5",
              isActive 
                ? "bg-[#D7F4D4] text-[#163C2C] font-extrabold shadow-xs" 
                : "text-[#7B8781] hover:bg-[#E9EFE6] hover:text-[#102723] font-bold"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Home size={18} className={cn("shrink-0 transition-colors", isActive ? "text-[#163C2C]" : "text-[#7B8781] group-hover:text-[#102723]")} />
              {!collapsed && (
                <span className="text-[13px] tracking-tight">
                  <KeyUnderline text="Dashboard" hotkey="D" />
                </span>
              )}
            </>
          )}
        </NavLink>

        {/* Quick POS mode directly under Dashboard */}
        <NavLink
          to="/pos"
          onClick={(e) => {
            if (!isPro) {
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
              "flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative mb-4",
              isActive 
                ? "bg-[#D7F4D4] text-[#163C2C] font-extrabold shadow-xs" 
                : "text-[#7B8781] hover:bg-[#E9EFE6] hover:text-[#102723] font-bold"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Store size={18} className={cn("shrink-0 transition-colors", isActive ? "text-[#163C2C]" : "text-[#7B8781] group-hover:text-[#102723]")} />
              {!collapsed && (
                <span className="text-[13px] tracking-tight flex items-center justify-between flex-1">
                  <KeyUnderline text="Quick POS" hotkey="K" />
                  {!isPro ? (
                    <Lock size={12} className="text-[#0F645D] ml-1.5 shrink-0" />
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider bg-[#073E36] text-[#D7F4D4] px-1.5 py-0.5 rounded-full">FAST</span>
                  )}
                </span>
              )}
            </>
          )}
        </NavLink>

        {/* Grouped menu sections */}
        {menuGroups.map((group) => (
          <div key={group.title} className={cn("space-y-1 mb-4", collapsed && "mb-2")}>
            {!collapsed && (
              <p className="text-[10px] font-black uppercase tracking-widest text-[#7B8B78] px-3.5 mb-1 mt-3">
                {group.title}
              </p>
            )}
            {group.items.map((item) => (
              (item as any).external ? (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative text-[#7B8781] hover:bg-[#E9EFE6] hover:text-[#102723] font-bold"
                  )}
                >
                  <item.icon size={18} className="shrink-0 text-[#7B8781] group-hover:text-[#102723]" />
                  {!collapsed && (
                    <span className="text-[13px] tracking-tight">
                      <KeyUnderline text={item.name} hotkey={(item as any).hotkey} />
                    </span>
                  )}
                </a>
              ) : (
                 <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative",
                      isActive 
                        ? "bg-[#D7F4D4] text-[#163C2C] font-extrabold shadow-xs" 
                        : "text-[#7B8781] hover:bg-[#E9EFE6] hover:text-[#102723] font-bold"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-[#163C2C]" : "text-[#7B8781] group-hover:text-[#102723]")} />
                      {!collapsed && (
                        <span className="text-[13px] tracking-tight flex-1 flex items-center justify-between">
                          <span>
                            <KeyUnderline text={item.name} hotkey={(item as any).hotkey} />
                          </span>
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            ))}
          </div>
        ))}

        {/* Collapsible Settings Menu */}
        <div className={cn("space-y-1 mb-3 mt-1", collapsed && "mb-2")}>
          {!collapsed && (
            <p className="text-[10px] font-black uppercase tracking-widest text-[#7B8B78] px-3.5 mb-1 mt-3">
              PREFERENCES
            </p>
          )}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn(
              "w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative cursor-pointer",
              location.pathname.startsWith('/settings')
                ? "bg-[#D7F4D4] text-[#163C2C] font-extrabold shadow-xs"
                : "text-[#7B8781] hover:bg-[#E9EFE6] hover:text-[#102723] font-bold"
            )}
          >
            <Settings size={18} className={cn("shrink-0 transition-colors", location.pathname.startsWith('/settings') ? "text-[#163C2C]" : "text-[#7B8781] group-hover:text-[#102723]")} />
            {!collapsed && (
              <span className="text-[13px] tracking-tight flex-1 flex items-center justify-between text-left">
                <KeyUnderline text="Settings" hotkey="S" />
                {settingsOpen
                  ? <ChevronDown size={14} className="text-[#163C2C] transition-transform duration-200" />
                  : <ChevronRight size={14} className="text-[#7B8781] transition-transform duration-200" />
                }
              </span>
            )}
          </button>

          {/* Settings Sub-Menu */}
          {settingsOpen && !collapsed && (
            <div className="space-y-0.5 pl-3 border-l-2 border-[#C6E9C1] ml-5 my-1">
              {settingsSubItems.map((sub) => {
                const isSubActive = location.pathname === '/settings' && location.search === sub.path.replace('/settings', '');
                return (
                  <NavLink
                    key={sub.path}
                    to={sub.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group relative text-[12px]",
                      isSubActive
                        ? "bg-[#D7F4D4] text-[#163C2C] font-extrabold shadow-xs"
                        : "text-[#7B8781] hover:bg-[#E9EFE6] hover:text-[#102723] font-bold"
                    )}
                  >
                    <sub.icon size={15} className={cn("shrink-0", isSubActive ? "text-[#163C2C]" : "text-[#7B8781] group-hover:text-[#102723]")} />
                    <span className="tracking-tight">{sub.name}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin Section */}
        {showAdmin && (
          <div className={cn("space-y-1 mb-4", collapsed && "mb-2")}>
            {!collapsed && (
              <p className="text-[10px] font-black uppercase tracking-widest text-[#7B8B78] px-3.5 mb-1 mt-3">
                ADMIN
              </p>
            )}
            <NavLink
              to={adminItem.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-[#D7F4D4] text-[#163C2C] font-extrabold shadow-xs" 
                    : "text-[#7B8781] hover:bg-[#E9EFE6] hover:text-[#102723] font-bold"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <adminItem.icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-[#163C2C]" : "text-[#7B8781] group-hover:text-[#102723]")} />
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
      <div className="p-3.5 border-t bg-[#FAFBF7] border-[#E5EBE0] space-y-2 shrink-0">
        {!collapsed && (
          <div 
            onClick={onProfileClick}
            className="flex items-center justify-between p-3 rounded-2xl border transition-all bg-white border-[#E5EBE0] shadow-xs hover:bg-[#E9EFE6] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-[#C6E9C1] bg-[#D7F4D4]">
                {userAvatar ? (
                  <img src={userAvatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black text-[#0F645D]">{user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black truncate leading-tight text-[#102723]">{user?.displayName || user?.email?.split('@')[0] || 'Business Owner'}</p>
                <p className="text-[9px] font-extrabold text-[#7B8781] leading-none mt-1 uppercase tracking-wider">{planTier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
              </div>
            </div>
            <MoreVertical size={16} className="text-[#7B8781] shrink-0 ml-1 hover:text-[#102723] transition-colors" />
          </div>
        )}

        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3 w-full py-2.5 transition-all text-[13px] font-bold px-3.5 rounded-xl text-[#7B8781] hover:text-[#BE3349] hover:bg-[#FCE8E9] cursor-pointer",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
