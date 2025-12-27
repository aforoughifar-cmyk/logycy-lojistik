import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Customer } from '../types';
import { Plus, Search, Building2, User, Phone, Mail, MapPin, X, Edit, Trash2, Eye, Upload, FileSpreadsheet, Download, Briefcase, Globe, Users, ArrowRight, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import clsx from 'clsx';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Active Tab State
  const [activeTab, setActiveTab] = useState<'musteri' | 'acente'>('musteri');
  
  const navigate = useNavigate();

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importTargetType, setImportTargetType] = useState<'musteri' | 'acente'>('musteri');

  // Form State
  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    type: 'musteri',
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await supabaseService.getCustomers();
    if (result.data) setCustomers(result.data);
    setLoading(false);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ type: activeTab, name: '', email: '', phone: '', address: '', taxId: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(customer.id);
    setFormData({
      type: customer.type,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
      taxId: customer.taxId || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    setLoading(true);
    const result = await supabaseService.deleteCustomer(id);
    if (result.error) toast.error('Hata: ' + result.error);
    else { toast.success('Kayıt silindi'); await loadData(); }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const targetType = formData.type;

    if (editingId) {
      const res = await supabaseService.updateCustomer(editingId, formData);
      if(!res.error) toast.success('Güncellendi');
    } else {
      const res = await supabaseService.createCustomer(formData);
      if(!res.error) toast.success('Oluşturuldu');
    }
    
    setShowModal(false);
    setSearchTerm('');
    setActiveTab(targetType as 'musteri' | 'acente');
    loadData();
  };

  const handleDownloadTemplate = () => {
      const ws = XLSX.utils.json_to_sheet([
          { 'İsim': 'Örnek Firma Ltd.', 'Telefon': '5331234567', 'E-posta': 'info@ornek.com', 'Adres': 'Lefkoşa', 'Vergi No': '123456' }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Şablon");
      XLSX.writeFile(wb, "Musteri_Acente_Sablon.xlsx");
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
        const buffer = await importFile.arrayBuffer();
        const wb = XLSX.read(buffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (rawData.length === 0) throw new Error("Dosya boş.");

        const firstRow = rawData[0];
        let data: any[] = [];
        if (firstRow.some(cell => typeof cell === 'string' && ['name', 'isim', 'ad', 'firma'].includes(cell.toLowerCase()))) {
            data = XLSX.utils.sheet_to_json(ws);
        } else {
            data = rawData.map(row => ({ 'Name': row[0] })); 
        }
        
        let added = 0;
        let skipped = 0;

        const normalize = (str: string) => str.trim().toLocaleLowerCase('tr-TR');
        const existingNames = new Set(customers.map(c => normalize(c.name)));

        for (const row of data) {
            const rawName = row['Name'] || row['İsim'] || row['Ad Soyad'] || row['Firma'] || row['name'] || Object.values(row)[0]; 
            
            if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') continue;

            const nameToImport = rawName.toString().trim();
            const normalizedImportName = normalize(nameToImport);

            if (existingNames.has(normalizedImportName)) {
                skipped++;
                continue;
            }

            const payload = {
                name: nameToImport,
                type: importTargetType,
                phone: (row['Phone'] || row['Telefon'] || row['Tel'] || '').toString(),
                email: (row['Email'] || row['E-posta'] || '').toString(),
                address: (row['Address'] || row['Adres'] || '').toString(),
                taxId: (row['Tax ID'] || row['Vergi No'] || '').toString()
            };

            await supabaseService.createCustomer(payload);
            existingNames.add(normalizedImportName);
            added++;
        }

        toast.success(`${added} kayıt eklendi (${importTargetType === 'musteri' ? 'Müşteri' : 'Acente'}). ${skipped} tekrar atlandı.`);
        setShowImportModal(false);
        setActiveTab(importTargetType);
        setSearchTerm('');
        loadData();
    } catch (e: any) {
        toast.error("İçe aktarma hatası: " + e.message);
    } finally {
        setImporting(false);
        setImportFile(null);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (activeTab === 'musteri' && c.type === 'acente') return false;
    if (activeTab === 'acente' && c.type !== 'acente') return false;
    return c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           c.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalCount = customers.length;
  const musteriCount = customers.filter(c => c.type !== 'acente').length;
  const acenteCount = customers.filter(c => c.type === 'acente').length;

  // Helper for Initials
  const getInitials = (name: string) => {
      return name.replace(/[^a-zA-Z\s]/g, '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Helper for Pastel Colors
  const getColorClass = (name: string) => {
      const colors = [
          'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700',
          'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700', 'bg-indigo-100 text-indigo-700'
      ];
      return colors[name.length % colors.length];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-900 tracking-tight">Müşteri & Acente</h1>
          <p className="text-slate-500 font-medium">İş ortaklarınızı ve cari hesaplarınızı yönetin.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => { setImportTargetType(activeTab); setShowImportModal(true); }}
                className="bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 font-bold shadow-sm"
            >
                <Upload size={18} /> <span className="hidden sm:inline">İçe Aktar</span>
            </button>
            <button 
            onClick={handleOpenCreate}
            className="bg-brand-900 text-white px-5 py-3 rounded-xl hover:bg-brand-800 transition flex items-center gap-2 shadow-lg shadow-brand-900/20 font-bold"
            >
            <Plus size={18} /> Yeni Kayıt
            </button>
        </div>
      </div>

      {/* STATS & TABS CONTAINER */}
      <div className="flex flex-col lg:flex-row gap-6">
          
          {/* STATS (Vertical on Desktop, Horizontal on Mobile) */}
          <div className="flex lg:flex-col gap-4 overflow-x-auto lg:w-64 flex-shrink-0 no-scrollbar">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex-1 lg:flex-none min-w-[200px]">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">TOPLAM KAYIT</p>
                  <div className="flex justify-between items-center">
                      <p className="text-3xl font-black text-brand-900">{totalCount}</p>
                      <Users className="text-slate-200" size={32} />
                  </div>
              </div>
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex-1 lg:flex-none min-w-[200px]">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">CARİ MÜŞTERİ</p>
                  <div className="flex justify-between items-center">
                      <p className="text-3xl font-black text-blue-700">{musteriCount}</p>
                      <User className="text-blue-200" size={32} />
                  </div>
              </div>
              <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 flex-1 lg:flex-none min-w-[200px]">
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">ACENTE / PARTNER</p>
                  <div className="flex justify-between items-center">
                      <p className="text-3xl font-black text-orange-700">{acenteCount}</p>
                      <Globe className="text-orange-200" size={32} />
                  </div>
              </div>
          </div>

          {/* MAIN LIST AREA */}
          <div className="flex-1 space-y-6">
              
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                  {/* Segmented Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                      <button 
                        onClick={() => setActiveTab('musteri')}
                        className={clsx("flex-1 px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2", activeTab === 'musteri' ? "bg-white text-brand-900 shadow-md" : "text-slate-500 hover:text-slate-700")}
                      >
                         <User size={16} /> Müşteriler
                      </button>
                      <button 
                        onClick={() => setActiveTab('acente')}
                        className={clsx("flex-1 px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2", activeTab === 'acente' ? "bg-white text-brand-900 shadow-md" : "text-slate-500 hover:text-slate-700")}
                      >
                         <Globe size={16} /> Acenteler
                      </button>
                  </div>

                  {/* Search */}
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Hızlı arama..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium"
                    />
                  </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                 {loading ? (
                   <p className="col-span-full text-center text-slate-500 py-20">Yükleniyor...</p>
                 ) : filteredCustomers.length === 0 ? (
                   <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-dashed border-slate-200 text-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <Search size={32} className="text-slate-300"/>
                      </div>
                      <p className="font-bold text-lg text-slate-600">Kayıt Bulunamadı</p>
                      <p className="text-sm text-slate-400 max-w-xs mx-auto">"{searchTerm}" aramasına uygun {activeTab === 'musteri' ? 'müşteri' : 'acente'} kaydı yok.</p>
                   </div>
                 ) : (
                   filteredCustomers.map(customer => (
                     <div 
                       key={customer.id} 
                       onClick={() => navigate(`/customers/${customer.id}`)}
                       className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col justify-between"
                     >
                       <div>
                           <div className="flex justify-between items-start mb-4">
                               <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm", getColorClass(customer.name))}>
                                   {getInitials(customer.name)}
                               </div>
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={(e) => handleOpenEdit(customer, e)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-600 transition"><Edit size={16} /></button>
                                   <button onClick={(e) => handleDelete(customer.id, e)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition"><Trash2 size={16} /></button>
                               </div>
                           </div>
                           
                           <h3 className="font-bold text-brand-900 text-lg line-clamp-1 mb-1">{customer.name}</h3>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">
                               {customer.type === 'acente' ? 'Global Acente' : 'Ticari Müşteri'}
                           </p>

                           <div className="space-y-2.5">
                               <div className="flex items-center gap-3 text-sm text-slate-600">
                                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Phone size={14}/></div>
                                   <span className="font-medium">{customer.phone || 'Tel Yok'}</span>
                               </div>
                               <div className="flex items-center gap-3 text-sm text-slate-600">
                                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Mail size={14}/></div>
                                   <span className="truncate font-medium">{customer.email || 'Email Yok'}</span>
                               </div>
                               {customer.address && (
                                   <div className="flex items-center gap-3 text-sm text-slate-600">
                                       <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><MapPin size={14}/></div>
                                       <span className="truncate font-medium">{customer.address}</span>
                                   </div>
                               )}
                           </div>
                       </div>

                       <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                           <span className="text-xs font-bold text-slate-400">DETAYLAR</span>
                           <div className="flex items-center gap-1 text-brand-600 font-bold text-sm group-hover:gap-2 transition-all">
                               Görüntüle <ArrowRight size={16} />
                           </div>
                       </div>
                     </div>
                   ))
                 )}
              </div>
          </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">{editingId ? 'Düzenle' : 'Yeni Kayıt'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="bg-slate-100 p-1 rounded-lg w-full flex mb-4">
                <button type="button" onClick={() => setFormData({...formData, type: 'musteri'})} className={clsx("flex-1 py-2 rounded-md text-sm font-bold transition text-center", formData.type === 'musteri' ? 'bg-white shadow text-brand-900' : 'text-slate-500 hover:text-slate-700')}>Müşteri</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'acente'})} className={clsx("flex-1 py-2 rounded-md text-sm font-bold transition text-center", formData.type === 'acente' ? 'bg-white shadow text-brand-900' : 'text-slate-500 hover:text-slate-700')}>Acente</button>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">İsim / Ünvan (Zorunlu)</label>
                <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-brand-500 transition" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase">Telefon</label><input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">E-Posta</label><input type="email" className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Adres</label><textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none h-24 resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              <div className="pt-4"><button type="submit" className="w-full bg-brand-900 text-white py-3.5 rounded-xl font-bold hover:bg-brand-800 shadow-lg">{editingId ? 'Güncelle' : 'Kaydet'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
                      <h3 className="text-white font-bold text-lg">Toplu İçe Aktar</h3>
                      <button onClick={() => setShowImportModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
                  </div>
                  <div className="p-8 flex flex-col items-center text-center">
                      
                      <div className="w-full mb-6">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2 text-left">Hangi gruba eklenecek?</p>
                          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                              <button onClick={() => setImportTargetType('musteri')} className={clsx("flex-1 py-2 text-sm font-bold rounded-lg transition", importTargetType === 'musteri' ? "bg-white shadow text-brand-900" : "text-slate-500")}>
                                  Müşteriler
                              </button>
                              <button onClick={() => setImportTargetType('acente')} className={clsx("flex-1 py-2 text-sm font-bold rounded-lg transition", importTargetType === 'acente' ? "bg-white shadow text-brand-900" : "text-slate-500")}>
                                  Acenteler
                              </button>
                          </div>
                      </div>

                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                          <FileSpreadsheet size={32} />
                      </div>
                      <p className="text-slate-600 mb-6 text-sm">
                          .xlsx veya .csv dosyanızı seçin.<br/>
                          <span className="text-xs text-slate-400">Gerekli kolon: "Name" veya "İsim".</span>
                      </p>
                      
                      <label className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition mb-4">
                          <span className="text-brand-600 font-bold">{importFile ? importFile.name : 'Dosya Seçin'}</span>
                          <input type="file" accept=".csv, .xlsx" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                      </label>

                      <div className="flex gap-2 w-full">
                          <button onClick={handleDownloadTemplate} className="flex-1 border border-slate-200 text-slate-500 py-3 rounded-xl font-bold hover:bg-slate-50 text-xs flex items-center justify-center gap-1">
                              <Download size={14} /> Şablon
                          </button>
                          <button 
                            onClick={handleImport} 
                            disabled={!importFile || importing}
                            className="flex-[2] bg-brand-900 text-white py-3 rounded-xl font-bold hover:bg-brand-800 disabled:opacity-50 transition"
                          >
                              {importing ? 'Yükleniyor...' : 'Başlat'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Customers;