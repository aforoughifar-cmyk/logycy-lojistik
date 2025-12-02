
import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Calculator, Settings, LogOut, Truck, Menu, Users, Ship, FileText, BarChart3, CheckSquare, Bell, Wallet, Search, CheckCircle, AlertCircle, Info, UserCog, Banknote, Container, FileInput, Receipt, CreditCard, ChevronDown, ChevronRight, Briefcase, Command, Box, Car, Link as LinkIcon, Database } from 'lucide-react';
import { supabaseService, supabase } from '../services/supabaseService';
import { CommandPalette } from '../components/CommandPalette';
import AIAssistant from '../components/AIAssistant';
import clsx from 'clsx';

const AdminLayout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(true);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [userDisplay, setUserDisplay] = useState<string>('User');
  const [userInitials, setUserInitials] = useState('US');
  
  // Menu Open States
  const [isAccountingOpen, setAccountingOpen] = useState(true);
  const [isHROpen, setHROpen] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name;
        const email = user.email?.split('@')[0] || 'User';
        setUserDisplay(name || email);
        if (name) {
            const parts = name.split(' ');
            if(parts.length > 1) setUserInitials(parts[0][0] + parts[1][0]);
            else setUserInitials(name.substring(0,2));
        } else {
            setUserInitials(email.substring(0, 2).toUpperCase());
        }
      }
    };
    fetchUser();

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabaseService.signOut();
    navigate('/login');
  };

  const notifications = [
    { id: 1, type: 'success', text: 'LOG-2025-8821 teslim edildi.', time: '10 dk önce', read: false },
    { id: 2, type: 'warning', text: 'MSC Lines ödemesi gecikiyor.', time: '1 saat önce', read: false },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    // CRITICAL FIX: print:block disables flexbox layout during print, allowing multipage flow
    <div className="flex h-screen bg-slate-50/50 overflow-hidden print:block print:h-auto print:overflow-visible">
      <CommandPalette />
      <AIAssistant /> {/* Floating AI Assistant */}
      
      {/* Sidebar */}
      <aside 
        className={clsx(
          "bg-brand-900 text-white flex flex-col transition-all duration-300 shadow-2xl z-30 relative border-r border-white/5 print:hidden",
          isSidebarOpen ? "w-72" : "w-20"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-center border-b border-white/10 flex-shrink-0 bg-brand-900/50">
          <div className="flex items-center gap-3 font-bold text-2xl tracking-wider">
            <div className="bg-gradient-to-br from-accent-400 to-accent-600 p-2.5 rounded-xl shadow-lg shadow-accent-500/30 transform hover:scale-105 transition-transform duration-300">
              <Truck size={24} className="text-brand-900" />
            </div>
            {isSidebarOpen && <span className="text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">LOGYCY</span>}
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto no-scrollbar">
          
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Kontrol Paneli" isOpen={isSidebarOpen} />
          <NavItem to="/shipments" icon={Package} label="Sevkiyatlar" isOpen={isSidebarOpen} />
          <NavItem to="/customers" icon={Users} label="Müşteriler" isOpen={isSidebarOpen} />
          <NavItem to="/warehouse" icon={Box} label="Depo / Antrepo" isOpen={isSidebarOpen} />
          <NavItem to="/fleet" icon={Car} label="Araç / Filo Yönetimi" isOpen={isSidebarOpen} />
          <NavItem to="/containers" icon={Container} label="Konteynerler" isOpen={isSidebarOpen} />

          {/* Group: Accounting */}
          <div className="pt-4 pb-1">
             {isSidebarOpen ? (
                <button onClick={() => setAccountingOpen(!isAccountingOpen)} className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-white transition group">
                   İÇ MUHASEBE
                   <ChevronDown size={14} className={clsx("transition-transform", !isAccountingOpen && "-rotate-90")}/>
                </button>
             ) : (
                <div className="h-px bg-white/10 mx-4 my-2"></div>
             )}
             
             {(!isSidebarOpen || isAccountingOpen) && (
               <div className="space-y-1.5 animate-slide-up">
                 <NavItem to="/invoices" icon={Receipt} label="Faturalar" isOpen={isSidebarOpen} />
                 <NavItem to="/checks" icon={Banknote} label="Çek / Senet" isOpen={isSidebarOpen} />
                 <NavItem to="/expenses" icon={CreditCard} label="Ofis Giderleri" isOpen={isSidebarOpen} />
                 <NavItem to="/finance" icon={Wallet} label="Kasa Durumu" isOpen={isSidebarOpen} />
               </div>
             )}
          </div>

          {/* Group: HR */}
          <div className="pt-2 pb-1">
             {isSidebarOpen ? (
                <button onClick={() => setHROpen(!isHROpen)} className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-white transition group">
                   İNSAN KAYNAKLARI
                   <ChevronDown size={14} className={clsx("transition-transform", !isHROpen && "-rotate-90")}/>
                </button>
             ) : (
                <div className="h-px bg-white/10 mx-4 my-2"></div>
             )}
             
             {(!isSidebarOpen || isHROpen) && (
               <div className="space-y-1.5 animate-slide-up">
                 <NavItem to="/staff" icon={UserCog} label="Personel Listesi" isOpen={isSidebarOpen} />
                 <NavItem to="/payroll" icon={Briefcase} label="Maaş / Bordro" isOpen={isSidebarOpen} />
               </div>
             )}
          </div>

          {/* Group: Operations */}
          <div className="pt-4 pb-1">
             {isSidebarOpen && <div className="px-4 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">DİĞER</div>}
             <div className="space-y-1.5">
                <NavItem to="/tasks" icon={CheckSquare} label="Görevler" isOpen={isSidebarOpen} />
                <NavItem to="/offers" icon={FileText} label="Teklifler" isOpen={isSidebarOpen} />
                <NavItem to="/integration" icon={Database} label="Entegrasyon (ShipsGo)" isOpen={isSidebarOpen} />
                <NavItem to="/reports" icon={BarChart3} label="Raporlar" isOpen={isSidebarOpen} />
                <NavItem to="/settings" icon={Settings} label="Ayarlar" isOpen={isSidebarOpen} />
             </div>
          </div>

        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-white/10 transition w-full p-3 rounded-xl group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            {isSidebarOpen && <span className="text-sm font-bold">Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 print:h-auto print:overflow-visible print:block">
        {/* Sticky Glass Header */}
        <header className="h-20 glass sticky top-0 z-20 px-6 md:px-8 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-brand-900 transition flex-shrink-0"
            >
              <Menu size={24} />
            </button>
            
            {/* Quick Command Trigger */}
            <button 
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="hidden md:flex items-center gap-3 bg-slate-100/50 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 px-4 py-2.5 rounded-xl text-slate-500 transition-all group w-64"
            >
               <Search size={18} className="text-slate-400 group-hover:text-brand-600 transition-colors" />
               <span className="text-sm font-medium">Hızlı Arama...</span>
               <div className="ml-auto flex items-center gap-1 text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
                  <Command size={10} /> K
               </div>
            </button>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6 ml-4">
             {/* Notification */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setNotifOpen(!isNotifOpen)}
                className={clsx("relative p-2.5 rounded-full transition hover:bg-slate-100", isNotifOpen ? "bg-slate-100 text-brand-900" : "text-slate-500")}
              >
                 <Bell size={20} />
                 {unreadCount > 0 && (
                   <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                 )}
              </button>
              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-fade-in">
                   <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-brand-900">Bildirimler</h3></div>
                   <div className="p-4 text-sm text-slate-500">Yeni bildirim yok.</div>
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-brand-900 capitalize truncate max-w-[150px]">{userDisplay}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Yönetici</p>
              </div>
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 shadow-lg shadow-brand-900/20 border-2 border-white flex items-center justify-center text-white font-bold text-sm uppercase cursor-pointer hover:scale-105 transition-transform">
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        {/* CRITICAL FIX: print:overflow-visible print:h-auto allows content to flow */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth print:p-0 print:overflow-visible print:h-auto print:block">
          <div className="max-w-7xl mx-auto h-full animate-fade-in print:max-w-none print:h-auto print:block">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

// Helper Component for Nav Items
const NavItem = ({ to, icon: Icon, label, isOpen }: { to: string, icon: any, label: string, isOpen: boolean }) => (
  <NavLink
    to={to}
    className={({ isActive }) => clsx(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
      isActive 
        ? "bg-white text-brand-900 shadow-md font-bold scale-[1.02]" 
        : "text-slate-400 hover:bg-white/5 hover:text-white hover:pl-5"
    )}
  >
    {({ isActive }) => (
      <>
        <div className={clsx("absolute left-0 top-0 bottom-0 w-1 bg-accent-500 transition-all duration-300", isActive ? "opacity-100" : "opacity-0")}></div>
        <Icon size={20} className={clsx("flex-shrink-0 transition-colors", isActive ? "text-accent-600" : "group-hover:text-white")} />
        {isOpen && <span className="text-sm truncate">{label}</span>}
      </>
    )}
  </NavLink>
);

export default AdminLayout;
