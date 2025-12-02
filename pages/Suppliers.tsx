import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Supplier } from '../types';
import { Plus, Search, Ship, Truck, Briefcase, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<Omit<Supplier, 'id'>>({
    type: 'armator',
    name: '',
    contact: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await supabaseService.getSuppliers();
    if (result.data) setSuppliers(result.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await supabaseService.createSupplier(formData);
    setFormData({ type: 'armator', name: '', contact: '', notes: '' });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu tedarikçiyi silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteSupplier(id);
    loadData();
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'armator': return <Ship size={20} />;
      case 'nakliye': return <Truck size={20} />;
      default: return <Briefcase size={20} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'armator': return 'Armatör (Line)';
      case 'nakliye': return 'Nakliye / Lojistik';
      case 'gumruk': return 'Gümrük Müşavirliği';
      default: return 'Diğer Tedarikçi';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Tedarikçiler</h1>
          <p className="text-slate-500">Armatörler, nakliyeciler ve hizmet sağlayıcılar.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Yeni Tedarikçi
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Firma adı ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {loading ? (
             <p className="col-span-full text-center text-slate-500 py-10">Yükleniyor...</p>
           ) : filtered.length === 0 ? (
             <p className="col-span-full text-center text-slate-500 py-10">Kayıt bulunamadı.</p>
           ) : (
             filtered.map(item => (
               <div 
                 key={item.id} 
                 onClick={() => navigate(`/suppliers/${item.id}`)}
                 className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition bg-white group relative cursor-pointer"
               >
                 <div className="flex items-center gap-3 mb-4">
                   <div className="p-3 rounded-lg bg-slate-100 text-slate-600">
                     {getTypeIcon(item.type)}
                   </div>
                   <div>
                     <h3 className="font-bold text-brand-900 group-hover:text-accent-600 transition">{item.name}</h3>
                     <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">{getTypeLabel(item.type)}</span>
                   </div>
                 </div>
                 <div className="text-sm text-slate-600 space-y-1">
                   {item.contact && <p className="flex items-center gap-2"><Briefcase size={14} className="text-slate-400"/> {item.contact}</p>}
                   {item.notes && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{item.notes}</p>}
                 </div>
                 <button 
                   onClick={(e) => handleDelete(item.id, e)}
                   className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                 >
                   <Trash2 size={18} />
                 </button>
               </div>
             ))
           )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4">
              <h3 className="text-white font-bold text-lg">Yeni Tedarikçi Ekle</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tip</label>
                <select 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50"
                  value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}
                >
                  <option value="armator">Armatör</option>
                  <option value="nakliye">Nakliye Firması</option>
                  <option value="gumruk">Gümrükçü</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Firma Adı</label>
                <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Örn: MSC Shipping" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">İletişim / Tel</label>
                <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                  value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="+90..." />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">İptal</button>
                <button type="submit" className="flex-1 bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;