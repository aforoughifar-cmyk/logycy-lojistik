import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Database, Shield, Bell, User, Lock, Save, AlertCircle, CheckCircle, Phone, Palette, Building, Upload } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'invoice'>('profile');
  
  // Auth States
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [profile, setProfile] = useState({ fullName: '', phone: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Invoice Design State (Persisted in localStorage for demo)
  const [invoiceConfig, setInvoiceConfig] = useState({
    companyName: 'Logycy Logistics Ltd.',
    address: 'Gazimağusa Serbest Liman Bölgesi, No: 12',
    phone: '+90 533 000 00 00',
    email: 'info@logycy.com',
    website: 'www.logycy.com',
    logoUrl: '',
    primaryColor: '#3730a3', // Default brand color
    taxOffice: 'Gazimağusa V.D.',
    taxNo: ''
  });

  useEffect(() => {
    supabaseService.getCurrentUser().then(u => {
        setUser(u);
        if(u?.user_metadata) {
            setProfile({
                fullName: u.user_metadata.full_name || '',
                phone: u.user_metadata.phone || ''
            });
        }
    });

    // Load invoice settings
    const savedConfig = localStorage.getItem('invoiceSettings');
    if (savedConfig) {
        setInvoiceConfig(JSON.parse(savedConfig));
    }
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'Şifreler eşleşmiyor!' });
      return;
    }
    if (passwords.new.length < 6) {
      setMessage({ type: 'error', text: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }

    setLoading(true);
    const result = await supabaseService.updateUserPassword(passwords.new);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Şifre başarıyla güncellendi.' });
      setPasswords({ new: '', confirm: '' });
    }
    setLoading(false);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);
      setLoading(true);
      
      const result = await supabaseService.updateUserProfile({
          data: { full_name: profile.fullName, phone: profile.phone }
      });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Profil bilgileri güncellendi.' });
        setTimeout(() => window.location.reload(), 1000);
      }
      setLoading(false);
  };

  const handleInvoiceConfigSave = (e: React.FormEvent) => {
      e.preventDefault();
      localStorage.setItem('invoiceSettings', JSON.stringify(invoiceConfig));
      toast.success('Fatura tasarım ayarları kaydedildi.');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingLogo(true);
    const file = e.target.files[0];
    const result = await supabaseService.uploadFile(file, 'public'); // Using 'public' bucket for logo
    
    if (result.error) {
        toast.error('Logo yüklenemedi: ' + result.error);
    } else if (result.data) {
        setInvoiceConfig(prev => ({ ...prev, logoUrl: result.data! }));
        toast.success('Logo yüklendi!');
    }
    setUploadingLogo(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Sistem Ayarları</h1>
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
         <button 
            onClick={() => setActiveTab('profile')}
            className={clsx("px-6 py-3 font-bold text-sm border-b-2 transition flex items-center gap-2", activeTab === 'profile' ? "border-brand-600 text-brand-900" : "border-transparent text-slate-500")}
         >
            <User size={18} /> Profil & Güvenlik
         </button>
         <button 
            onClick={() => setActiveTab('invoice')}
            className={clsx("px-6 py-3 font-bold text-sm border-b-2 transition flex items-center gap-2", activeTab === 'invoice' ? "border-brand-600 text-brand-900" : "border-transparent text-slate-500")}
         >
            <Palette size={18} /> Fatura & Çıktı Tasarımı
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Info Card - Always Visible) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 flex flex-col items-center border-b border-slate-200 bg-slate-50">
              {activeTab === 'profile' ? (
                  <div className="w-20 h-20 rounded-full bg-brand-900 text-accent-500 flex items-center justify-center text-2xl font-bold border-4 border-white shadow-md mb-3 uppercase">
                    {profile.fullName ? profile.fullName.substring(0, 2) : 'AD'}
                  </div>
              ) : (
                  <div className="w-20 h-20 rounded-lg bg-white flex items-center justify-center border-2 border-slate-100 shadow-sm mb-3 overflow-hidden relative group">
                     {invoiceConfig.logoUrl ? (
                         <img src={invoiceConfig.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                     ) : (
                         <Building size={32} className="text-slate-300" />
                     )}
                  </div>
              )}
              
              <h3 className="text-lg font-bold text-slate-800">
                  {activeTab === 'profile' ? (profile.fullName || 'Yönetici') : invoiceConfig.companyName}
              </h3>
              <p className="text-slate-500 text-sm">
                  {activeTab === 'profile' ? user?.email : 'Şirket Profili'}
              </p>
            </div>
            <div className="p-4">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Durum</div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">Aktif</span>
                {activeTab === 'invoice' && <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">Özel Tasarım</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Forms) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Global Message Area */}
          {message && (
            <div className={`p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {message.text}
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex items-start gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><User size={24} /></div>
                        <div><h3 className="text-lg font-bold text-slate-800">Profil Bilgileri</h3></div>
                    </div>
                    <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Ad Soyad</label>
                                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Telefon</label>
                                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                            </div>
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button type="submit" disabled={loading} className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-700 transition">Kaydet</button>
                        </div>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex items-start gap-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><Lock size={24} /></div>
                        <div><h3 className="text-lg font-bold text-slate-800">Şifre Değiştir</h3></div>
                    </div>
                    <form onSubmit={handlePasswordUpdate} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Yeni Şifre</label>
                                <input type="password" required className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Yeni Şifre (Tekrar)</label>
                                <input type="password" required className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                            </div>
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button type="submit" disabled={loading} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-900 transition">Güncelle</button>
                        </div>
                    </form>
                </div>
            </>
          )}

          {/* TAB: INVOICE DESIGN */}
          {activeTab === 'invoice' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex items-start gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Palette size={24} /></div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fatura & Çıktı Ayarları</h3>
                        <p className="text-slate-500 text-sm">Fatura, makbuz ve ordinolarda görünecek şirket bilgileri.</p>
                    </div>
                </div>
                <form onSubmit={handleInvoiceConfigSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">Firma Ünvanı (Header)</label>
                        <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={invoiceConfig.companyName} onChange={e => setInvoiceConfig({...invoiceConfig, companyName: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Telefon</label>
                            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={invoiceConfig.phone} onChange={e => setInvoiceConfig({...invoiceConfig, phone: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">E-Posta</label>
                            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={invoiceConfig.email} onChange={e => setInvoiceConfig({...invoiceConfig, email: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">Adres</label>
                        <textarea rows={2} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none resize-none" value={invoiceConfig.address} onChange={e => setInvoiceConfig({...invoiceConfig, address: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Vergi Dairesi</label>
                            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={invoiceConfig.taxOffice} onChange={e => setInvoiceConfig({...invoiceConfig, taxOffice: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Vergi No</label>
                            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none" value={invoiceConfig.taxNo} onChange={e => setInvoiceConfig({...invoiceConfig, taxNo: e.target.value})} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Firma Logosu</label>
                            <div className="flex gap-2 items-center">
                                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition border border-slate-200">
                                    <Upload size={18} className="text-slate-600"/>
                                    <span className="text-sm font-bold text-slate-700">{uploadingLogo ? 'Yükleniyor...' : 'Logo Seç'}</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo}/>
                                </label>
                                {invoiceConfig.logoUrl && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle size={12}/> Yüklendi</span>}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Önerilen boyut: 200x200px (PNG/JPG)</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Tema Rengi</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-20 border border-slate-300 rounded cursor-pointer" value={invoiceConfig.primaryColor} onChange={e => setInvoiceConfig({...invoiceConfig, primaryColor: e.target.value})} />
                                <input type="text" className="flex-1 border border-slate-300 rounded-lg p-2.5 outline-none uppercase font-mono" value={invoiceConfig.primaryColor} onChange={e => setInvoiceConfig({...invoiceConfig, primaryColor: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button type="submit" className="bg-brand-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-800 transition shadow-lg shadow-brand-900/20">Ayarları Kaydet</button>
                    </div>
                </form>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;