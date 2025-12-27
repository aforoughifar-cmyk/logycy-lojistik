
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { 
  User, Lock, Palette, Building, 
  Upload, List, X, Users, Coins, Briefcase, 
  Anchor, Shield, Layout, Percent, Tag, Banknote, Plus
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';

const Settings: React.FC = () => {
  const { currencyRates, setCurrencyRates, definitions, updateDefinitions } = useStore();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'invoice' | 'currency' | 'definitions'>('profile');
  const [loading, setLoading] = useState(false);

  // --- 1. PROFILE STATE ---
  const [profile, setProfile] = useState({ fullName: '', phone: '' });
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });

  // --- 2. INVOICE CONFIG STATE ---
  const [invoiceConfig, setInvoiceConfig] = useState({
    companyName: 'Logycy Logistics Ltd.',
    address: 'Gazimağusa Serbest Liman Bölgesi, No: 12',
    phone: '+90 533 000 00 00',
    email: 'info@logycy.com',
    website: 'www.logycy.com',
    logoUrl: '',
    primaryColor: '#3730a3',
    taxOffice: 'Gazimağusa V.D.',
    taxNo: ''
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // --- 3. CURRENCY STATE ---
  const [rates, setRates] = useState(currencyRates);

  // --- 4. USERS STATE ---
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
      email: '',
      fullName: '',
      role: 'user', // admin, user, manager
      position: ''
  });

  // Access (Auth) modal state
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessTarget, setAccessTarget] = useState<any>(null);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPassword, setAccessPassword] = useState('');

  const generatePassword = (len: number = 10) => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
      let out = "";
      for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
  };

  const openAccessModal = (u: any) => {
      setAccessTarget(u);
      setAccessEmail(u?.email || "");
      setAccessPassword(generatePassword(12));
      setShowAccessModal(true);
  };

// Input States for Definitions
  const [newDef, setNewDef] = useState('');
  const [newRate, setNewRate] = useState<number>(0);
  const [newCurrency, setNewCurrency] = useState({ code: '', symbol: '', name: '' });
  const [activeDefInput, setActiveDefInput] = useState<string>('');

  // --- INITIAL LOAD ---
  useEffect(() => {
    // Load User
    supabaseService.getCurrentUser().then(u => {
        setUser(u);
        if(u?.user_metadata) {
            setProfile({
                fullName: u.user_metadata.full_name || '',
                phone: u.user_metadata.phone || ''
            });
        }
    });

    // Load LocalStorage Settings
    const savedConfig = localStorage.getItem('invoiceSettings');
    if (savedConfig) setInvoiceConfig(JSON.parse(savedConfig));

    loadSystemUsers();
  }, []);

  // --- HANDLERS: USERS ---
  const loadSystemUsers = async () => {
      const res = await supabaseService.getEmployees();
      if(res.data) {
          const mapped = res.data.map(e => ({
              id: e.id,
              email: e.email,
              full_name: e.fullName,
              role: (e.position || '').toLowerCase().includes('yönetici') ? 'Yönetici' : 'Personel',
              status: e.isActive ? 'Aktif' : 'Pasif',
              hasAuth: !!(e as any).authUserId,
              accessEnabled: (e as any).accessEnabled ?? false,
              inviteStatus: (e as any).inviteStatus ?? 'none'
          }));

          // De-duplicate: if the same person appears twice (e.g., "Profil" + "Hesap"),
          // keep the stronger row (hasAuth > accessEnabled > has email).
          const byKey = new Map<string, any>();
          for (const u of mapped) {
              const key = String(u.full_name || '').trim().toLowerCase() || String(u.email || '').trim().toLowerCase() || String(u.id);
              const prev = byKey.get(key);
              if (!prev) {
                  byKey.set(key, u);
                  continue;
              }
              const score = (x: any) => (x.hasAuth ? 4 : 0) + (x.accessEnabled ? 2 : 0) + (x.email ? 1 : 0);
              if (score(u) > score(prev)) byKey.set(key, u);
          }

          const users = Array.from(byKey.values());
          setSystemUsers(users);
      }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      const empPayload = {
          fullName: newUser.fullName,
          email: newUser.email,
          position: newUser.role === 'admin' ? 'Sistem Yöneticisi' : newUser.position || 'Personel',
          department: 'Ofis',
          phone: '',
          salary: 0,
          currency: 'TRY' as const,
          startDate: new Date().toISOString().split('T')[0],
          status: 'active' as const,
          isActive: true
      };
      
      const res = await supabaseService.addEmployee(empPayload);
      if(res.error) {
          toast.error("Hata: " + res.error);
      } else {
          toast.success("Kullanıcı profili oluşturuldu!");
          setShowUserModal(false);
          setNewUser({ email: '', fullName: '', role: 'user', position: '' });
          loadSystemUsers();
      }
      setLoading(false);
  };

  const handleGrantAccess = async (employee: any) => {
      // Open modal to set email/password (no email invitation)
      openAccessModal(employee);
  };

  const handleAccessSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!accessTarget?.id) return;
      const email = (accessEmail || '').trim();
      const password = (accessPassword || '').trim();

      if(!email) { toast.error('E-posta zorunlu'); return; }
      if(password.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return; }

      setLoading(true);
      try {
          const redirectTo = `${window.location.origin}/login`;
          const res = await supabaseService.grantEmployeeAccess(accessTarget.id, { email, password, redirectTo });
          if(res.error) toast.error('Hata: ' + res.error);
          else {
              toast.success(accessTarget.hasAuth ? 'Şifre güncellendi!' : 'Erişim verildi!');
              setShowAccessModal(false);
              await loadSystemUsers();
          }
      } catch (err: any) {
          const msg = (err?.message ?? String(err)) as string;
          if (msg.includes('Forbidden') || msg.toLowerCase().includes('admin only') || msg.toLowerCase().includes('admin')) {
              toast.error('Bu işlem sadece yönetici (Admin) tarafından yapılabilir.');
          } else {
              toast.error('Hata: ' + msg);
          }
      } finally {
          setLoading(false);
      }
  };



  // --- HANDLERS: PROFILE ---
  const handleProfileUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      const result = await supabaseService.updateUserProfile({
          data: { full_name: profile.fullName, phone: profile.phone }
      });
      if (result.error) toast.error(result.error);
      else toast.success('Profil güncellendi.');
      setLoading(false);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) return toast.error('Şifreler eşleşmiyor!');
    if (passwords.new.length < 6) return toast.error('Şifre en az 6 karakter olmalı.');

    setLoading(true);
    const result = await supabaseService.updateUserPassword(passwords.new);
    if (result.error) toast.error(result.error);
    else {
        toast.success('Şifre değiştirildi.');
        setPasswords({ new: '', confirm: '' });
    }
    setLoading(false);
  };

  // --- HANDLERS: INVOICE ---
  const handleInvoiceConfigSave = (e: React.FormEvent) => {
      e.preventDefault();
      localStorage.setItem('invoiceSettings', JSON.stringify(invoiceConfig));
      toast.success('Fatura ayarları kaydedildi.');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingLogo(true);
    const file = e.target.files[0];
    const result = await supabaseService.uploadFile(file, 'documents'); 
    
    if (result.error) {
        toast.error('Yükleme hatası: ' + result.error);
    } else if (result.data) {
        setInvoiceConfig(prev => ({ ...prev, logoUrl: result.data! }));
        toast.success('Logo yüklendi!');
    }
    setUploadingLogo(false);
  };

  // --- HANDLERS: DEFINITIONS ---
  const handleAddDefinition = (key: keyof typeof definitions) => {
      let updated;
      
      if (key === 'insuranceTypes') {
          if(!newDef.trim()) return;
          const newItem = { name: newDef.trim(), rate: Number(newRate) };
          updated = { ...definitions, insuranceTypes: [...definitions.insuranceTypes, newItem] };
      } else if (key === 'taxRates') {
          if(!newRate && newRate !== 0) return;
          if(definitions.taxRates.includes(newRate)) return toast.error("Bu oran zaten var.");
          updated = { ...definitions, taxRates: [...definitions.taxRates, Number(newRate)].sort((a,b) => a-b) };
      } else if (key === 'currencies') {
          if(!newCurrency.code) return;
          const newItem = { ...newCurrency, code: newCurrency.code.toUpperCase() };
          updated = { ...definitions, currencies: [...definitions.currencies, newItem] };
      } else {
          if(!newDef.trim()) return;
          const currentList = definitions[key] as string[];
          updated = { ...definitions, [key]: [...currentList, newDef.trim()] };
      }
      
      updateDefinitions(updated);
      
      // Reset Inputs
      setNewDef('');
      setNewRate(0);
      setNewCurrency({ code: '', symbol: '', name: '' });
      toast.success('Eklendi');
  };

  const handleDeleteDefinition = (key: keyof typeof definitions, value: any) => {
      let updated;
      if (key === 'insuranceTypes') {
          updated = { ...definitions, insuranceTypes: definitions.insuranceTypes.filter(v => v.name !== value) };
      } else if (key === 'taxRates') {
          updated = { ...definitions, taxRates: definitions.taxRates.filter(v => v !== value) };
      } else if (key === 'currencies') {
          updated = { ...definitions, currencies: definitions.currencies.filter(v => v.code !== value) };
      } else {
          const currentList = definitions[key] as string[];
          updated = { ...definitions, [key]: currentList.filter(v => v !== value) };
      }
      updateDefinitions(updated);
  };

  // --- HANDLERS: CURRENCY ---
  const handleCurrencySave = (e: React.FormEvent) => {
      e.preventDefault();
      setCurrencyRates(rates);
      toast.success('Kurlar güncellendi.');
  };

  // --- UI COMPONENTS ---
  const SidebarItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
      <button 
          onClick={() => setActiveTab(id as any)}
          className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-bold",
              activeTab === id ? "bg-brand-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-100"
          )}
      >
          <Icon size={18} />
          {label}
      </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sticky top-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">AYARLAR MENÜSÜ</h2>
              <div className="space-y-1">
                  <SidebarItem id="profile" icon={User} label="Profil & Güvenlik" />
                  <SidebarItem id="users" icon={Users} label="Kullanıcılar" />
                  <SidebarItem id="invoice" icon={Palette} label="Fatura Tasarımı" />
                  <SidebarItem id="definitions" icon={List} label="Sistem Tanımları" />
                  <SidebarItem id="currency" icon={Coins} label="Döviz Kurları" />
              </div>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1">
          
          {/* ... (PROFILE, USERS, INVOICE, CURRENCY TABS REMAIN SAME, JUST DEFINITIONS TAB IS RE-RENDERED) ... */}
          {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                          <User className="text-brand-600"/> Kişisel Bilgiler
                      </h3>
                      <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-md">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Ad Soyad</label>
                              <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-brand-500" 
                                  value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Telefon</label>
                              <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-brand-500" 
                                  value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                          </div>
                          <button type="submit" disabled={loading} className="bg-brand-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-800 transition">
                              Güncelle
                          </button>
                      </form>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                          <Lock className="text-red-600"/> Şifre Değiştir
                      </h3>
                      <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Yeni Şifre</label>
                              <input type="password" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-brand-500" 
                                  value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Şifre Tekrar</label>
                              <input type="password" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-brand-500" 
                                  value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                          </div>
                          <button type="submit" disabled={loading} className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition">
                              Şifreyi Değiştir
                          </button>
                      </form>
                  </div>
              </div>
          )}

          {activeTab === 'users' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Kullanıcı Yönetimi</h3>
                      <button onClick={() => setShowUserModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2">
                          <Plus size={16}/> Yeni Kullanıcı
                      </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                              <tr>
                                  <th className="p-4 font-bold">Ad Soyad</th>
                                  <th className="p-4 font-bold">E-Posta</th>
                                  <th className="p-4 font-bold">Rol</th>
                                  <th className="p-4 font-bold text-center">Durum</th>
                                   <th className="p-4 font-bold text-center">Erişim</th>
                                   <th className="p-4 font-bold text-center">İşlem</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {systemUsers.map((u: any) => (
                                  <tr key={u.id} className="hover:bg-slate-50">
                                      <td className="p-4 font-bold text-slate-800">{u.full_name}</td>
                                      <td className="p-4 text-slate-600">{u.email || '-'}</td>
                                      <td className="p-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                                      <td className="p-4 text-center">
                                          <span className={clsx("px-2 py-1 rounded text-xs font-bold", u.status === 'Aktif' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                                              {u.status}
                                          </span>
                                      </td>
                                       <td className="p-4 text-center">
                                           {u.hasAuth ? (
                                               <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">Hesap</span>
                                           ) : (
                                               <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">Profil</span>
                                           )}
                                       </td>
                                       <td className="p-4 text-center">
                                           <button
                                               disabled={loading}
                                               onClick={() => handleGrantAccess(u)}
                                               className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                           >
                                               {u.hasAuth ? 'Şifre Güncelle' : 'Erişim Ver'}
                                           </button>
                                       </td>
                                  </tr>
                              ))}
                              {systemUsers.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Kullanıcı bulunamadı.</td></tr>}
                          </tbody>
                      </table>
                  </div>

                  {showUserModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
                          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                              <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
                                  <h3 className="text-white font-bold text-lg">Yeni Kullanıcı</h3>
                                  <button onClick={() => setShowUserModal(false)} className="text-white/60 hover:text-white transition"><X size={20}/></button>
                              </div>
                              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Ad Soyad</label>
                                      <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm" 
                                          value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">E-Posta</label>
                                      <input required type="email" className="w-full border border-slate-200 rounded-xl p-3 text-sm" 
                                          value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Rol</label>
                                      <select className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white"
                                          value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                                          <option value="user">Personel</option>
                                          <option value="admin">Yönetici</option>
                                          <option value="manager">Müdür</option>
                        
                  
              </select>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Pozisyon</label>
                                      <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" 
                                          value={newUser.position} onChange={e => setNewUser({...newUser, position: e.target.value})} placeholder="Örn: Muhasebe" />
                                  </div>
                                  <div className="pt-2">
                                      <button type="submit" className="w-full bg-brand-900 text-white py-3 rounded-xl font-bold hover:bg-brand-800 transition">Oluştur</button>
                                  </div>
                              </form>
                          </div>
                      </div>
                  )}

{showAccessModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100">
                              <div className="flex justify-between items-center p-5 border-b border-slate-100">
                                  <h4 className="font-extrabold text-slate-800">Erişim Ver (Şifre Tanımla)</h4>
                                  <button onClick={() => setShowAccessModal(false)} className="text-slate-400 hover:text-slate-600">
                                      <X />
                                  </button>
                              </div>
                              <form onSubmit={handleAccessSubmit} className="p-5 space-y-4">
                                  <div className="text-xs text-slate-500">
                                      Bu işlem kullanıcıyı <b>Authentication/Users</b> içine ekler. E-posta gönderilmez. <b>Yalnızca yönetici</b> yapabilir.
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Ad Soyad</label>
                                      <div className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50">
                                          {accessTarget?.full_name || accessTarget?.fullName || '-'}
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">E-Posta</label>
                                      <input
                                          className="w-full border border-slate-200 rounded-xl p-3 text-sm"
                                          value={accessEmail}
                                          onChange={(e) => setAccessEmail(e.target.value)}
                                          placeholder="user@company.com"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Şifre</label>
                                      <div className="flex gap-2">
                                          <input
                                              className="flex-1 border border-slate-200 rounded-xl p-3 text-sm"
                                              value={accessPassword}
                                              onChange={(e) => setAccessPassword(e.target.value)}
                                              placeholder="******"
                                          />
                                          <button
                                              type="button"
                                              className="px-3 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                                              onClick={() => setAccessPassword(generatePassword(12))}
                                          >
                                              Üret
                                          </button>
                                      </div>
                                  </div>
                                  <div className="pt-2 flex gap-2 justify-end">
                                      <button
                                          type="button"
                                          onClick={() => setShowAccessModal(false)}
                                          className="px-4 py-2 rounded-xl border border-slate-200 font-bold hover:bg-slate-50"
                                      >
                                          Vazgeç
                                      </button>
                                      <button
                                          type="submit"
                                          disabled={loading}
                                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50"
                                      >
                                          {accessTarget?.hasAuth ? 'Şifreyi Güncelle' : 'Erişim Ver'}
                                      </button>
                                  </div>
                              </form>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'invoice' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                      <Layout className="text-purple-600"/> Fatura & Rapor Tasarımı
                  </h3>
                  <form onSubmit={handleInvoiceConfigSave} className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Firma Adı</label>
                                      <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={invoiceConfig.companyName} onChange={e => setInvoiceConfig({...invoiceConfig, companyName: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Telefon</label>
                                      <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={invoiceConfig.phone} onChange={e => setInvoiceConfig({...invoiceConfig, phone: e.target.value})} />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase">Adres</label>
                                  <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm h-20 resize-none" value={invoiceConfig.address} onChange={e => setInvoiceConfig({...invoiceConfig, address: e.target.value})} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">E-Posta</label>
                                      <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={invoiceConfig.email} onChange={e => setInvoiceConfig({...invoiceConfig, email: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Web Sitesi</label>
                                      <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={invoiceConfig.website} onChange={e => setInvoiceConfig({...invoiceConfig, website: e.target.value})} />
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Vergi Dairesi</label>
                                      <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={invoiceConfig.taxOffice} onChange={e => setInvoiceConfig({...invoiceConfig, taxOffice: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Vergi No</label>
                                      <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={invoiceConfig.taxNo} onChange={e => setInvoiceConfig({...invoiceConfig, taxNo: e.target.value})} />
                                  </div>
                              </div>
                          </div>

                          <div className="w-full md:w-64 space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Firma Logosu</label>
                                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center h-40 flex flex-col items-center justify-center relative overflow-hidden group">
                                      {invoiceConfig.logoUrl ? (
                                          <img src={invoiceConfig.logoUrl} className="h-full object-contain" alt="Logo" />
                                      ) : (
                                          <div className="text-slate-400"><Building size={32} className="mx-auto mb-2"/>Logo Yok</div>
                                      )}
                                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                          <label className="cursor-pointer text-white font-bold text-xs flex items-center gap-1">
                                              <Upload size={14}/> {uploadingLogo ? 'Yükleniyor...' : 'Değiştir'}
                                              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                          </label>
                                      </div>
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Ana Renk</label>
                                  <div className="flex gap-2">
                                      <input type="color" className="w-10 h-10 rounded border-none cursor-pointer" value={invoiceConfig.primaryColor} onChange={e => setInvoiceConfig({...invoiceConfig, primaryColor: e.target.value})} />
                                      <input className="flex-1 border border-slate-200 rounded-xl px-3 text-sm uppercase font-mono" value={invoiceConfig.primaryColor} onChange={e => setInvoiceConfig({...invoiceConfig, primaryColor: e.target.value})} />
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="border-t border-slate-100 pt-4 flex justify-end">
                          <button type="submit" className="bg-brand-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-800 transition">Ayarları Kaydet</button>
                      </div>
                  </form>
              </div>
          )}

          {activeTab === 'currency' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Coins className="text-green-600"/> Döviz Kurları</h3>
                      <button onClick={() => setRates({'USD':1, 'EUR': 1.08, 'GBP': 1.25, 'TRY': 0.03})} className="text-xs text-blue-600 font-bold hover:underline">Varsayılana Dön</button>
                  </div>
                  
                  <form onSubmit={handleCurrencySave} className="grid grid-cols-2 gap-6 max-w-lg">
                      {Object.keys(rates).map(curr => (
                          <div key={curr}>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">1 {curr} = ? USD</label>
                              <input 
                                  type="number" step="0.0001" 
                                  className="w-full border border-slate-200 rounded-xl p-3 text-sm font-mono font-bold" 
                                  value={rates[curr]}
                                  onChange={e => setRates({...rates, [curr]: parseFloat(e.target.value)})}
                                  disabled={curr === 'USD'}
                              />
                          </div>
                      ))}
                      <div className="col-span-2 pt-2">
                          <button type="submit" className="w-full bg-brand-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-800 transition">Kurları Güncelle</button>
                          <p className="text-[10px] text-slate-400 text-center mt-2">Bu kurlar raporlardaki tahmini çevrimlerde kullanılır.</p>
                      </div>
                  </form>
              </div>
          )}

          {/* --- TAB: DEFINITIONS --- */}
          {activeTab === 'definitions' && (
              <div className="space-y-6 animate-in fade-in">
                  
                  {/* Tax Rates */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Percent size={18} className="text-purple-600"/> Vergi Oranları (KDV)</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                          {definitions.taxRates.map(r => (
                              <div key={r} className="bg-purple-50 text-purple-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold border border-purple-100">
                                  %{r}
                                  <button onClick={() => handleDeleteDefinition('taxRates', r)} className="text-purple-400 hover:text-purple-600"><X size={14}/></button>
                              </div>
                          ))}
                      </div>
                      <div className="flex gap-2 max-w-sm">
                          <input type="number" className="border rounded-lg px-3 py-2 text-sm outline-none flex-1" placeholder="Oran (Örn: 18)" value={newRate || ''} onChange={e => setNewRate(parseFloat(e.target.value))} />
                          <button onClick={() => handleAddDefinition('taxRates')} className="bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Ekle</button>
                      </div>
                  </div>

                  {/* Currencies */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Banknote size={18} className="text-green-600"/> Para Birimleri</h3>
                      <div className="flex flex-wrap gap-3 mb-4">
                          {definitions.currencies.map(c => (
                              <div key={c.code} className="bg-green-50 text-green-800 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold border border-green-100">
                                  <span className="bg-white px-1.5 rounded text-xs border border-green-200">{c.symbol}</span> {c.code}
                                  <button onClick={() => handleDeleteDefinition('currencies', c.code)} className="text-green-400 hover:text-green-600 ml-1"><X size={14}/></button>
                              </div>
                          ))}
                      </div>
                      <div className="flex gap-2 max-w-lg">
                          <input className="border rounded-lg px-3 py-2 text-sm outline-none w-20" placeholder="Kod (USD)" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value})} />
                          <input className="border rounded-lg px-3 py-2 text-sm outline-none w-16" placeholder="Sem ($)" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} />
                          <input className="border rounded-lg px-3 py-2 text-sm outline-none flex-1" placeholder="Adı (Amerikan Doları)" value={newCurrency.name} onChange={e => setNewCurrency({...newCurrency, name: e.target.value})} />
                          <button onClick={() => handleAddDefinition('currencies')} className="bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Ekle</button>
                      </div>
                  </div>

                  {/* Expense Categories */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Tag size={18} className="text-orange-600"/> Gider Kategorileri (Ofis)</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                          {definitions.expenseCategories.map(c => (
                              <div key={c} className="bg-orange-50 text-orange-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold border border-orange-100">
                                  {c}
                                  <button onClick={() => handleDeleteDefinition('expenseCategories', c)} className="text-orange-400 hover:text-orange-600"><X size={14}/></button>
                              </div>
                          ))}
                      </div>
                      <div className="flex gap-2 max-w-sm">
                          <input className="border rounded-lg px-3 py-2 text-sm outline-none flex-1" placeholder="Yeni Kategori" value={activeDefInput === 'expenseCategories' ? newDef : ''} onChange={e => { setActiveDefInput('expenseCategories'); setNewDef(e.target.value); }} />
                          <button onClick={() => handleAddDefinition('expenseCategories')} className="bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Ekle</button>
                      </div>
                  </div>

                  {/* Insurance Types (Object Array) */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Shield size={18} className="text-red-600"/> Sigorta Türleri & Oranları</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                          {definitions.insuranceTypes.map(c => (
                              <div key={c.name} className="bg-red-50 text-red-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold border border-red-100">
                                  {c.name} <span className="bg-white text-red-600 px-1.5 rounded text-xs border border-red-100">% {c.rate}</span>
                                  <button onClick={() => handleDeleteDefinition('insuranceTypes', c.name)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                              </div>
                          ))}
                      </div>
                      <div className="flex gap-2">
                          <input className="border rounded-lg px-3 py-2 text-sm outline-none flex-[2]" placeholder="Adı (Örn: SGK)" value={activeDefInput === 'insuranceTypes' ? newDef : ''} onChange={e => { setActiveDefInput('insuranceTypes'); setNewDef(e.target.value); }} />
                          <input type="number" className="border rounded-lg px-3 py-2 text-sm outline-none flex-1" placeholder="Oran %" value={newRate || ''} onChange={e => setNewRate(parseFloat(e.target.value))} />
                          <button onClick={() => handleAddDefinition('insuranceTypes')} className="bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Ekle</button>
                      </div>
                  </div>

                  {/* Customs Offices */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Anchor size={18} className="text-blue-600"/> Gümrük Müdürlükleri</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                          {definitions.customsOffices.map(c => (
                              <div key={c} className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold border border-blue-100">
                                  {c}
                                  <button onClick={() => handleDeleteDefinition('customsOffices', c)} className="text-blue-400 hover:text-blue-600"><X size={14}/></button>
                              </div>
                          ))}
                      </div>
                      <div className="flex gap-2">
                          <input className="border rounded-lg px-3 py-2 text-sm outline-none flex-1" placeholder="Yeni Gümrük Ekle" value={activeDefInput === 'customsOffices' ? newDef : ''} onChange={e => { setActiveDefInput('customsOffices'); setNewDef(e.target.value); }} />
                          <button onClick={() => handleAddDefinition('customsOffices')} className="bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Ekle</button>
                      </div>
                  </div>

                  {/* Employee Positions */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Briefcase size={18} className="text-orange-600"/> Personel Pozisyonları</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                          {definitions.employeePositions.map(c => (
                              <div key={c} className="bg-orange-50 text-orange-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold border border-orange-100">
                                  {c}
                                  <button onClick={() => handleDeleteDefinition('employeePositions', c)} className="text-orange-400 hover:text-orange-600"><X size={14}/></button>
                              </div>
                          ))}
                      </div>
                      <div className="flex gap-2">
                          <input className="border rounded-lg px-3 py-2 text-sm outline-none flex-1" placeholder="Yeni Pozisyon Ekle" value={activeDefInput === 'employeePositions' ? newDef : ''} onChange={e => { setActiveDefInput('employeePositions'); setNewDef(e.target.value); }} />
                          <button onClick={() => handleAddDefinition('employeePositions')} className="bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Ekle</button>
                      </div>
                  </div>

              </div>
          )}

      </div>
    </div>
  );
};

export default Settings;
