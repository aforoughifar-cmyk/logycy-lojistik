import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Calculator, Settings, LogOut, Truck, Menu, Users, Ship, FileText, BarChart3, CheckSquare, Bell, Wallet, Search, CheckCircle, AlertCircle, Info, UserCog, Banknote, Container, FileInput, Receipt, CreditCard, ChevronDown, ChevronRight, Briefcase, Command, Box, Car, Link as LinkIcon, Database, Shield, ScrollText, X, FileClock } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { CommandPalette } from '../components/CommandPalette';
import AIAssistant from '../components/AIAssistant';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import { AppNotification } from '../types';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { sidebarOpen, toggleSidebar, setSidebarOpen, user, userRole, userPermissions } = useStore();
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [userDisplay, setUserDisplay] = useState<string>('User');
  const [userInitials, setUserInitials] = useState('US');
  
  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Menu Open States
  const [isAccountingOpen, setAccountingOpen] = useState(false);
  const [isHROpen, setHROpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);

  // Helper: Check permission
  const hasAccess = (module: string) => {
      // If userPermissions is empty or undefined, default to ALL (safety net)
      if (!userPermissions || userPermissions.length === 0) return true;
      // Admin bypass
      if (userPermissions.includes('all')) return true;
      // Specific check
      return userPermissions.includes(module);
  };

  const isAdmin = hasAccess('all');

  // Close sidebar on route change (Mobile UX)
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    // Sync User Info from Global Store
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

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    // Fetch Notifications
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
      // 1. Get Base Notifications (Calendar, etc)
      const baseNotes = await supabaseService.getNotifications();
      
      // 2. Add Check Maturity Alerts (Only for Admin/Finance)
      let checkAlerts: AppNotification[] = [];
      if (hasAccess('finance')) {
          const { data: checks } = await supabaseService.getChecks();
          if (checks) {
              const today = new Date();
              const threeDaysLater = new Date();
              threeDaysLater.setDate(today.getDate() + 3);
              
              checks.forEach(c => {
                  if (c.status === 'pending') {
                      const due = new Date(c.dueDate);
                      if (due <= threeDaysLater) {
                          const daysDiff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          
                          let title = '';
                          let type: 'warning' | 'error' | 'success' | 'info' = 'info';
                          
                          if (daysDiff < 0) {
                              title = `GECİKMİŞ ÇEK: ${Math.abs(daysDiff)} Gün!`;
                              type = 'error';
                          } else if (daysDiff === 0) {
                              title = 'BUGÜN ÇEK GÜNÜ!';
                              type = 'warning';
                          } else {
                              title = `Çek Yaklaşıyor (${daysDiff} Gün)`;
                              type = 'info';
                          }

                          checkAlerts.push({
                              id: `chk-alert-${c.id}`,
                              title: title,
                              message: `${c.type === 'in' ? 'Tahsilat' : 'Ödeme'}: ${c.amount.toLocaleString()} ${c.currency} - ${c.partyName}`,
                              type: type,
                              date: new Date().toISOString(),
                              isRead: false,
                              link: `/checks/${c.id}`
                          });
                      }
                  }
              });
          }
      }

      const merged = [...checkAlerts, ...baseNotes].sort((a, b) => {
          if (a.type === 'error' && b.type !== 'error') return -1;
          if (b.type === 'error' && a.type !== 'error') return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setNotifications(merged);
  };

  const handleLogout = async () => {
    await supabaseService.signOut();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden print:block print:h-auto print:overflow-visible">
      <CommandPalette />
      <AIAssistant /> 
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-brand-900/50 backdrop-blur-sm z-30 md:hidden animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "bg-brand-900 text-white flex flex-col transition-all duration-300 shadow-2xl z-40 fixed md:relative h-full border-r border-white/5 print:hidden",
          sidebarOpen ? "w-72 translate-x-0" : "w-0 md:w-20 -translate-x-full md:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-between px-4 md:justify-center border-b border-white/10 flex-shrink-0 bg-brand-900/50">
          <div className="flex items-center gap-3 font-bold text-2xl tracking-wider">
            <div className="bg-gradient-to-br from-accent-400 to-accent-600 p-2.5 rounded-xl shadow-lg shadow-accent-500/30 transform hover:scale-105 transition-transform duration-300">
              <Truck size={24} className="text-brand-900" />
            </div>
            {sidebarOpen && <span className="text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300 animate-in fade-in">LOGYCY</span>}
          </div>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto no-scrollbar">
          
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Kontrol Paneli" isOpen={sidebarOpen} currentPath={location.pathname} />
          
          {(hasAccess('operations') || hasAccess('shipments')) && <NavItem to="/shipments" icon={Package} label="Sevkiyatlar" isOpen={sidebarOpen} currentPath={location.pathname} />}
          {(hasAccess('operations') || hasAccess('crm')) && <NavItem to="/customers" icon={Users} label="Müşteriler" isOpen={sidebarOpen} currentPath={location.pathname} />}
          {hasAccess('operations') && <NavItem to="/warehouse" icon={Box} label="Depo / Antrepo" isOpen={sidebarOpen} currentPath={location.pathname} />}
          {hasAccess('operations') && <NavItem to="/fleet" icon={Car} label="Araç / Filo Yönetimi" isOpen={sidebarOpen} currentPath={location.pathname} />}
          {hasAccess('operations') && <NavItem to="/containers" icon={Container} label="Konteynerler" isOpen={sidebarOpen} currentPath={location.pathname} />}

          {/* Group: Finance */}
          {hasAccess('finance') && (
            <div className="pt-4 pb-1">
               {sidebarOpen ? (
                  <button onClick={() => setAccountingOpen(!isAccountingOpen)} className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-white transition group">
                     FİNANS & MUHASEBE
                     <ChevronDown size={14} className={clsx("transition-transform", !isAccountingOpen && "-rotate-90")}/>
                  </button>
               ) : (
                  <div className="h-px bg-white/10 mx-4 my-2"></div>
               )}
               
               {(!sidebarOpen || isAccountingOpen) && (
                 <div className="space-y-1.5 animate-slide-up">
                   <NavItem to="/ordinos" icon={ScrollText} label="Ordino Yönetimi" isOpen={sidebarOpen} currentPath={location.pathname} />
                   <NavItem to="/invoices" icon={Receipt} label="Faturalar" isOpen={sidebarOpen} currentPath={location.pathname} />
                   <NavItem to="/checks" icon={Banknote} label="Çek / Senet" isOpen={sidebarOpen} currentPath={location.pathname} />
                   <NavItem to="/expenses" icon={CreditCard} label="Ofis Giderleri" isOpen={sidebarOpen} currentPath={location.pathname} />
                   <NavItem to="/finance" icon={Wallet} label="Kasa Durumu" isOpen={sidebarOpen} currentPath={location.pathname} />
                 </div>
               )}
            </div>
          )}

          {/* Group: HR */}
          {hasAccess('hr') && (
            <div className="pt-2 pb-1">
               {sidebarOpen ? (
                  <button onClick={() => setHROpen(!isHROpen)} className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-white transition group">
                     İNSAN KAYNAKLARI
                     <ChevronDown size={14} className={clsx("transition-transform", !isHROpen && "-rotate-90")}/>
                  </button>
               ) : (
                  <div className="h-px bg-white/10 mx-4 my-2"></div>
               )}
               
               {(!sidebarOpen || isHROpen) && (
                 <div className="space-y-1.5 animate-slide-up">
                   <NavItem to="/staff" icon={UserCog} label="Personel Listesi" isOpen={sidebarOpen} currentPath={location.pathname} />
                   <NavItem to="/payroll" icon={Briefcase} label="Maaş / Bordro" isOpen={sidebarOpen} currentPath={location.pathname} />
                   <NavItem to="/advances" icon={Wallet} label="Avans / Müşarede" isOpen={sidebarOpen} currentPath={location.pathname} />
                   <NavItem to="/insurance" icon={Shield} label="Sigorta / Prim" isOpen={sidebarOpen} currentPath={location.pathname} />
                 </div>
               )}
            </div>
          )}

          {/* Group: Others */}
          <div className="pt-4 pb-1">
             {sidebarOpen && <div className="px-4 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">DİĞER</div>}
             <div className="space-y-1.5">
                <NavItem to="/tasks" icon={CheckSquare} label="Görevler" isOpen={sidebarOpen} currentPath={location.pathname} />
                {(hasAccess('crm') || hasAccess('operations')) && <NavItem to="/offers" icon={FileText} label="Teklifler" isOpen={sidebarOpen} currentPath={location.pathname} />}
                {hasAccess('reports') && <NavItem to="/reports" icon={BarChart3} label="Raporlar" isOpen={sidebarOpen} currentPath={location.pathname} />}
                {hasAccess('operations') && <NavItem to="/integration" icon={Database} label="Gümrük Aktarım" isOpen={sidebarOpen} currentPath={location.pathname} />}
                
                {/* Admin Only Audit Logs */}
                {isAdmin && <NavItem to="/audit-logs" icon={FileClock} label="İşlem Geçmişi" isOpen={sidebarOpen} currentPath={location.pathname} />}
                
                {hasAccess('settings') && <NavItem to="/settings" icon={Settings} label="Ayarlar" isOpen={sidebarOpen} currentPath={location.pathname} />}
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
            {sidebarOpen && <span className="text-sm font-bold">Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 print:h-auto print:overflow-visible print:block">
        {/* Sticky Glass Header */}
        <header className="h-20 glass sticky top-0 z-20 px-4 md:px-8 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-brand-900 transition flex-shrink-0"
            >
              <Menu size={24} />
            </button>
            
            {/* Quick Command Trigger (Search) */}
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
            <button 
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                className="md:hidden p-2 text-slate-500"
            >
                <Search size={24} />
            </button>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6 ml-4">
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
                   <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                       <h3 className="font-bold text-brand-900">Bildirimler</h3>
                       <button onClick={fetchNotifications} className="text-xs text-blue-600 hover:underline">Yenile</button>
                   </div>
                   <div className="max-h-80 overflow-y-auto">
                       {notifications.length === 0 ? (
                           <div className="p-6 text-center text-sm text-slate-500">Yeni bildirim yok.</div>
                       ) : (
                           notifications.map((n, i) => (
                               <div key={i} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer" onClick={() => n.link && navigate(n.link)}>
                                   <div className="flex gap-3">
                                       <div className={clsx("w-2 h-2 rounded-full mt-2 flex-shrink-0", n.type === 'error' ? "bg-red-500" : n.type === 'warning' ? "bg-orange-500" : "bg-blue-500")}></div>
                                       <div>
                                           <p className={clsx("text-sm font-bold", n.type === 'error' ? "text-red-700" : "text-slate-800")}>{n.title}</p>
                                           <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                                           <p className="text-[10px] text-slate-400 mt-1">{new Date(n.date).toLocaleDateString('tr-TR')}</p>
                                       </div>
                                   </div>
                               </div>
                           ))
                       )}
                   </div>
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-brand-900 capitalize truncate max-w-[150px]">{userDisplay}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isAdmin ? 'YÖNETİCİ' : 'PERSONEL'}</p>
              </div>
              <div className={clsx("w-10 h-10 md:w-11 md:h-11 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white font-bold text-xs md:text-sm uppercase cursor-pointer hover:scale-105 transition-transform", isAdmin ? "bg-gradient-to-br from-brand-800 to-brand-900" : "bg-gradient-to-br from-blue-500 to-blue-600")}>
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth print:p-0 print:overflow-visible print:h-auto print:block">
          <div className="max-w-7xl mx-auto h-full animate-fade-in print:max-w-none print:h-auto print:block">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Helper Component for Nav Items
const NavItem = ({ to, icon: Icon, label, isOpen, currentPath }: { to: string, icon: any, label: string, isOpen: boolean, currentPath: string }) => {
  const isActive = currentPath.startsWith(to) && (to === '/' ? currentPath === '/' : true);
  return (
    <NavLink
      to={to}
      className={clsx(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
        isActive 
          ? "bg-white text-brand-900 shadow-md font-bold scale-[1.02]" 
          : "text-slate-400 hover:bg-white/5 hover:text-white hover:pl-5"
      )}
    >
      <div className={clsx("absolute left-0 top-0 bottom-0 w-1 bg-accent-500 transition-all duration-300", isActive ? "opacity-100" : "opacity-0")}></div>
      <Icon size={20} className={clsx("flex-shrink-0 transition-colors", isActive ? "text-accent-600" : "group-hover:text-white")} />
      {isOpen && <span className="text-sm truncate">{label}</span>}
    </NavLink>
  );
};

export default AdminLayout;