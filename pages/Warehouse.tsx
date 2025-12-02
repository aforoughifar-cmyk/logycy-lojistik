import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { InventoryItem, Customer } from '../types';
import { Plus, Search, Box, Package, User, MapPin, Barcode, Trash2, X, CheckCircle, AlertTriangle, Printer, QrCode } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const Warehouse: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Label Modal State
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    sku: '',
    quantity: 0,
    unit: 'Adet',
    location: '',
    status: 'Stokta',
    ownerName: '',
    entryDate: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [invRes, custRes] = await Promise.all([
        supabaseService.getInventory(),
        supabaseService.getCustomers()
    ]);
    if (invRes.data) setInventory(invRes.data);
    if (custRes.data) setCustomers(custRes.data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.addInventoryItem(formData);
    toast.success('Ürün girişi yapıldı');
    setFormData({
        name: '', sku: '', quantity: 0, unit: 'Adet', location: '', 
        status: 'Stokta', ownerName: '', entryDate: new Date().toISOString().slice(0, 10)
    });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Bu ürünü stoktan silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteInventoryItem(id);
    toast.success('Ürün silindi');
    loadData();
  };

  const handleOpenLabel = (item: InventoryItem) => {
      setSelectedItem(item);
      setShowLabelModal(true);
  };

  const filtered = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.ownerName && item.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalItems = filtered.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Depo / Antrepo</h1>
          <p className="text-slate-500">Stok yönetimi ve mal kabul işlemleri.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Mal Kabul
        </button>
      </div>

      {/* Stats - Hidden in Print */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase mb-2">TOPLAM STOK ADEDİ</p>
               <p className="text-3xl font-extrabold text-brand-900">{totalItems.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-brand-50 text-brand-700 rounded-xl">
               <Package size={24} />
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase mb-2">DOLULUK ORANI</p>
               <p className="text-3xl font-extrabold text-blue-600">%65</p>
            </div>
            <div className="w-16 h-16 relative flex items-center justify-center">
               <svg viewBox="0 0 36 36" className="w-full h-full">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="65, 100" />
               </svg>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Ürün adı, SKU veya Müşteri ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
           {loading ? (
             <p className="col-span-full text-center text-slate-500 py-10">Yükleniyor...</p>
           ) : filtered.length === 0 ? (
             <div className="col-span-full text-center py-10">
                <Box size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Stok kaydı bulunamadı.</p>
             </div>
           ) : (
             filtered.map(item => (
               <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition group relative">
                  <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                           {item.sku || 'NO-SKU'}
                        </span>
                        <span className={clsx("text-xs font-bold px-2 py-1 rounded flex items-center gap-1", 
                           item.status === 'Stokta' ? "bg-green-100 text-green-700" : 
                           item.status === 'Rezerve' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                        )}>
                           {item.status === 'Stokta' ? <CheckCircle size={10}/> : <AlertTriangle size={10}/>} {item.status}
                        </span>
                     </div>
                  </div>
                  
                  <h3 className="font-bold text-brand-900 text-lg mb-4">{item.name}</h3>
                  
                  <div className="space-y-2 text-sm">
                     <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-2"><Box size={14}/> Miktar</span>
                        <span className="font-bold text-slate-800">{item.quantity} {item.unit}</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-2"><MapPin size={14}/> Konum</span>
                        <span className="font-bold text-brand-600">{item.location}</span>
                     </div>
                     <div className="flex justify-between py-2">
                        <span className="text-slate-500 flex items-center gap-2"><User size={14}/> Müşteri</span>
                        <span className="font-medium text-slate-700">{item.ownerName || '-'}</span>
                     </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-50">
                     <button onClick={() => handleOpenLabel(item)} className="text-sm font-bold text-slate-500 hover:text-brand-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50 transition">
                        <Printer size={16} /> Etiket
                     </button>
                     <button onClick={() => handleDelete(item.id)} className="text-sm font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition">
                        <Trash2 size={16} /> Sil
                     </button>
                  </div>
               </div>
             ))
           )}
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Mal Kabul / Stok Girişi</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
               {/* Form Fields */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">SKU / Barkod</label>
                     <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="Otomatik..." />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Giriş Tarihi</label>
                     <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})} />
                  </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Ürün Adı</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Örn: Yedek Parça Koli" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Miktar</label>
                     <input type="number" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Birim</label>
                     <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                        value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as any})}>
                        <option value="Adet">Adet</option>
                        <option value="Koli">Koli</option>
                        <option value="Palet">Palet</option>
                        <option value="Kg">Kg</option>
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Raf / Konum</label>
                     <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Örn: A-12" />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Durum</label>
                     <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                        value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value="Stokta">Stokta</option>
                        <option value="Rezerve">Rezerve</option>
                        <option value="Hasarlı">Hasarlı</option>
                     </select>
                  </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Mal Sahibi (Müşteri Seçimi)</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-white"
                    value={formData.ownerName} 
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                  >
                      <option value="">Seçiniz...</option>
                      {customers.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                  </select>
               </div>

               <div className="pt-4">
                  <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20">Kaydet</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Label Print Modal */}
      {showLabelModal && selectedItem && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm print:bg-white print:p-0 print:absolute print:inset-0 print:z-auto print:block">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:w-full print:max-w-none print:rounded-none">
               <div className="bg-brand-900 px-4 py-3 flex justify-between items-center print:hidden">
                  <h3 className="text-white font-bold">Etiket Önizleme</h3>
                  <div className="flex items-center gap-2">
                     <button onClick={() => window.print()} className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition"><Printer size={18} /></button>
                     <button onClick={() => setShowLabelModal(false)} className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition"><X size={18} /></button>
                  </div>
               </div>
               
               {/* Actual Label Area - Designed to match 10x10cm or similar sticker */}
               <div className="p-6 flex flex-col items-center justify-center text-center border-4 border-slate-900 m-4 print:m-0 print:border-2 print:w-[10cm] print:h-[10cm] print:flex print:flex-col print:justify-center print:items-center">
                  <h2 className="text-xl font-extrabold text-slate-900 mb-1">LOGYCY LOGISTICS</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-4">WAREHOUSE ENTRY LABEL</p>
                  
                  <div className="w-full border-t-2 border-b-2 border-slate-900 py-4 my-2">
                     <h1 className="text-3xl font-black text-slate-900 leading-tight mb-2 break-words">{selectedItem.name}</h1>
                     <p className="font-bold text-slate-600">Müşteri: {selectedItem.ownerName || 'Unknown'}</p>
                  </div>

                  <div className="flex w-full justify-between items-end my-4 px-2">
                     <div className="text-left">
                        <p className="text-xs font-bold text-slate-400 uppercase">LOCATION</p>
                        <p className="text-2xl font-mono font-bold text-slate-900">{selectedItem.location}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">QUANTITY</p>
                        <p className="text-2xl font-mono font-bold text-slate-900">{selectedItem.quantity} <span className="text-sm">{selectedItem.unit}</span></p>
                     </div>
                  </div>

                  {/* Simulated Barcode */}
                  <div className="mt-auto w-full">
                     <div className="h-12 bg-slate-900 w-full mb-1 flex items-center justify-center gap-1">
                        {/* Just a visual pattern to look like barcode */}
                        {Array.from({length: 40}).map((_,i) => (
                           <div key={i} className="h-full bg-white" style={{width: Math.random() > 0.5 ? '2px' : '4px', opacity: Math.random() > 0.3 ? 1 : 0}}></div>
                        ))}
                     </div>
                     <p className="font-mono text-xs tracking-[0.3em] font-bold">{selectedItem.sku || 'LOG-'+selectedItem.id.substring(0,6).toUpperCase()}</p>
                  </div>
                  
                  <p className="text-[8px] text-slate-400 mt-2">
                     Entry: {new Date(selectedItem.entryDate).toLocaleDateString()} | System Generated
                  </p>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Warehouse;