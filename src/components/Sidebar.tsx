import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
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
  Layout as LayoutIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Sidebar({ onProfileClick }: { onProfileClick?: () => void }) {
  const { logout, user, isAdmin, appMode, planTier, isPro, triggerUpgradeModal } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);

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
      title: 'SALES',
      items: [
        { name: 'Invoices', path: '/invoices', icon: FileText },
        { name: appMode === 'freelancer' ? 'Proposals' : 'Quotations', path: '/quotations', icon: FileEdit },
        { name: appMode === 'freelancer' ? 'Clients' : 'Parties', path: '/customers', icon: Users },
        { name: 'Payments', path: '/payments', icon: CreditCard },
      ]
    },
    {
      title: 'ACCOUNTING',
      items: [
        { name: 'Daily Book', path: '/dailybook', icon: Book },
        { name: 'Expenses', path: '/expenses', icon: TrendingDown },
      ]
    },
    {
      title: 'REPORTS',
      items: [
        { name: 'Reports', path: '/reports', icon: BarChart3 },
        { name: 'Barcode Generator', path: '/barcode-generator', icon: Barcode },
        { name: 'QR Generator', path: '/qr-generator', icon: QrCode },
        { name: 'Download App / PC', path: '/download', icon: Download },
        { name: 'Plans & Pricing', path: '/pricing', icon: Sparkles },
        { name: 'Settings', path: '/settings', icon: Settings },
      ]
    }
  ];

  const itemsSubItems = [
    { name: 'Products', path: '/items', icon: Package },
    { name: 'Stock Overview', path: '/items?tab=overview', icon: BarChart3 },
    { name: 'Stock Adjustment', path: '/items?tab=adjustment', icon: FileEdit },
    { name: 'Stock Transfer', path: '/items?tab=transfer', icon: ArrowRight },
    { name: 'Serial Numbers', path: '/items?tab=serials', icon: Barcode },
    { name: 'Lot / Batch', path: '/items?tab=batches', icon: Database },
    { name: 'Low Stock', path: '/items?tab=lowstock', icon: TrendingDown },
    { name: 'Expiry Alerts', path: '/items?tab=expiry', icon: AlertCircle },
    { name: 'Categories & Units', path: '/items?tab=categories', icon: Tag },
    { name: 'Inventory History', path: '/items?tab=history', icon: FileText },
    { name: appMode === 'freelancer' ? 'Software & Tools' : 'Purchases', path: '/purchases', icon: ShoppingBag },
  ];

  const adminItem = { name: 'Admin Control', path: '/admin', icon: ShieldCheck };


  return (
    <aside className={cn(
      "h-screen flex flex-col transition-all duration-300 ease-in-out relative z-20 shadow-xl bg-white text-[#4F5B66] border-r border-slate-100/80",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Header with App Logo */}
      <div className="p-5 flex items-center justify-between mb-2">
        <div className={cn("flex items-center gap-2.5 transition-all duration-300", collapsed && "opacity-0 hidden")}>
          <Logo size={38} showBg={true} />
          <div className="flex flex-col">
            <span className="font-brand text-[15px] tracking-tight text-slate-900 leading-tight">
              <span className="font-black text-slate-800">Invo</span><span className="font-bold text-slate-700">Centric</span>
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest leading-none text-[#166534] mt-0.5">Enterprise Edition</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg transition-all hover:bg-slate-50 text-slate-500 hover:text-slate-800"
          >
            <ChevronLeft size={16} className={cn("transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Nav Items Scrollable List */}
      <div className="flex-1 overflow-y-auto px-4 mt-2 custom-scrollbar no-scrollbar space-y-1">
        {/* Dashboard Link stands at the very top */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 group relative mb-4",
              isActive 
                ? "bg-[#F0FDF4] text-[#166534] font-extrabold" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Home size={18} className={cn("shrink-0 transition-colors", isActive ? "text-[#166534]" : "text-slate-500 group-hover:text-slate-600")} />
              {!collapsed && (
                <span className="text-[13px] tracking-tight font-bold">
                  Dashboard
                </span>
              )}
            </>
          )}
        </NavLink>

        {/* Grouped menu sections */}
        {menuGroups.map((group) => (
          <div key={group.title} className={cn("space-y-1 mb-5", collapsed && "mb-3")}>
            {!collapsed && (
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A99AD] px-4 mb-2">
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
                    "flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 group relative text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon size={18} className="shrink-0 text-slate-500 group-hover:text-slate-600" />
                  {!collapsed && (
                    <span className="text-[13px] tracking-tight font-bold">
                      {item.name}
                    </span>
                  )}
                </a>
              ) : (
                 <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={(e) => {
                    if (item.path === '/qr-generator' && !isPro) {
                      e.preventDefault();
                      triggerUpgradeModal('QR Generator & Digital Branding', [
                        'Generate dynamic, beautifully branded UPI & website QR codes.',
                        'Auto-embed QR codes directly onto your PDF invoices for quick payments.',
                        'Real-time verification of payment status via custom QR layouts.'
                      ]);
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                      isActive 
                        ? "bg-[#F0FDF4] text-[#166534] font-extrabold" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-[#166534]" : "text-slate-500 group-hover:text-slate-600")} />
                      {!collapsed && (
                        <span className="text-[13px] tracking-tight font-bold flex-1 flex items-center justify-between">
                          <span>{item.name}</span>
                          {item.path === '/qr-generator' && !isPro && (
                            <Lock size={12} className="text-amber-500 ml-1.5 shrink-0" />
                          )}
                        </span>
                      )}
                      {collapsed && item.path === '/qr-generator' && !isPro && (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 border border-white" />
                      )}
                    </>
                  )}
                </NavLink>
              )
            ))}

            {/* Insert collapsible ITEMS section after SALES group */}
            {group.title === 'SALES' && (
              <div className={cn("space-y-1 mt-5 mb-2", collapsed && "mt-3 mb-1")}>
                {!collapsed && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#8A99AD] px-4 mb-2">
                    ITEMS
                  </p>
                )}
                {/* Items Collapsible Toggle Button */}
                <button
                  onClick={() => setItemsOpen(!itemsOpen)}
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                    itemsOpen
                      ? "bg-[#F0FDF4] text-[#166534] font-extrabold"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Package size={18} className={cn("shrink-0 transition-colors", itemsOpen ? "text-[#166534]" : "text-slate-500 group-hover:text-slate-600")} />
                  {!collapsed && (
                    <span className="text-[13px] tracking-tight font-bold flex-1 flex items-center justify-between">
                      <span>Items</span>
                      {itemsOpen
                        ? <ChevronDown size={14} className="text-[#166534] transition-transform duration-200" />
                        : <ChevronRight size={14} className="text-slate-400 transition-transform duration-200" />
                      }
                    </span>
                  )}
                </button>

                {/* Items Sub-Menu */}
                {itemsOpen && (
                  <div className={cn("space-y-0.5", !collapsed && "pl-3 border-l-2 border-[#D1FAE5] ml-5")}>
                    {itemsSubItems.map((sub) => (
                      <NavLink
                        key={sub.path}
                        to={sub.path}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative text-[12px]",
                            isActive
                              ? "bg-[#F0FDF4] text-[#166534] font-extrabold"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <sub.icon size={15} className={cn("shrink-0", isActive ? "text-[#166534]" : "text-slate-400 group-hover:text-slate-600")} />
                            {!collapsed && (
                              <span className="tracking-tight font-bold">{sub.name}</span>
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Admin Section */}
        {showAdmin && (
          <div className={cn("space-y-1 mb-5", collapsed && "mb-3")}>
            {!collapsed && (
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A99AD] px-4 mb-2">
                ADMIN
              </p>
            )}
            <NavLink
              to={adminItem.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-[#EEF2F6] text-slate-800 font-extrabold" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <adminItem.icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-slate-800" : "text-slate-500 group-hover:text-slate-600")} />
                  {!collapsed && (
                    <span className="text-[13px] tracking-tight font-bold flex-1 flex items-center justify-between">
                      <span>{adminItem.name}</span>
                      {pendingCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                    </span>
                  )}
                  {collapsed && pendingCount > 0 && (
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse border-2 border-white" />
                  )}
                </>
              )}
            </NavLink>
          </div>
        )}
      </div>

      {/* Footer area matching screenshot exactly */}
      <div className="p-4 border-t bg-slate-50/50 border-slate-100 space-y-3.5 shrink-0">
        {!collapsed && (
          <div 
            onClick={onProfileClick}
            className="flex items-center justify-between p-3.5 rounded-2xl border transition-all bg-white border-slate-100 shadow-sm hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 bg-green-50 shadow-inner">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-green-600">{user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-black truncate leading-tight text-slate-800">{user?.displayName || user?.email?.split('@')[0] || 'Business Owner'}</p>
                <p className="text-[10px] font-extrabold text-slate-500 leading-none mt-1 uppercase tracking-wider">{planTier === 'pro' ? 'Pro Account' : 'Free Account'}</p>
              </div>
            </div>
            <MoreVertical size={16} className="text-slate-500 shrink-0 ml-1 hover:text-slate-600 transition-colors" />
          </div>
        )}

        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3.5 w-full py-2.5 transition-all text-[13px] font-bold px-4 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50/50",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
