import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Customer } from '../types';
import { Plus, Search, Building2, User, Phone, Mail, MapPin, X, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    type: 'kurumsal',
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
    setFormData({ type: 'kurumsal', name: '', email: '', phone: '', address: '', taxId: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
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
    e.stopPropagation(); // Prevent card click
    if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return;
    
    setLoading(true);
    const result = await supabaseService.deleteCustomer(id);
    if (result.error) {
      toast.error('Hata: ' + result.error);
    } else {
      toast.success('Müşteri silindi');
      await loadData();
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingId) {
      // Edit Mode
      const res = await supabaseService.updateCustomer(editingId, formData);
      if(!res.error) toast.success('Müşteri güncellendi');
    } else {
      // Create Mode
      const res = await supabaseService.createCustomer(formData);
      if(!res.error) toast.success('Müşteri oluşturuldu');
    }

    setShowModal(false);
    loadData();
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Müşteriler</h1>
          <p className="text-slate-500">Müşteri veritabanı ve iletişim bilgileri.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Yeni Müşteri
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Filter Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="İsim, Şirket veya E-posta ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>

        {/* List Grid (Instead of table for better mobile view) */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {loading ? (
             <p className="col-span-full text-center text-slate-500 py-10">Yükleniyor...</p>
           ) : filteredCustomers.length === 0 ? (
             <p className="col-span-full text-center text-slate-500 py-10">Kayıt bulunamadı.</p>
           ) : (
             filteredCustomers.map(customer => (
               <div 
                 key={customer.id} 
                 onClick={() => navigate(`/customers/${customer.id}`)}
                 className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition bg-white group relative cursor-pointer animate-in fade-in duration-500"
               >
                 <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                     <div className={`p-3 rounded-lg ${customer.type === 'kurumsal' ? 'bg-blue-50 text-brand-600' : 'bg-green-50 text-green-600'}`}>
                       {customer.type === 'kurumsal' ? <Building2 size={24} /> : <User size={24} />}
                     </div>
                     <div>
                       <h3 className="font-bold text-brand-900 group-hover:text-accent-600 transition">{customer.name}</h3>
                       <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">{customer.type}</span>
                     </div>
                   </div>
                 </div>
                 
                 <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" />
                      <span>{customer.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-400" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                    {customer.address && (
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-slate-400 mt-1" />
                        <span className="line-clamp-2">{customer.address}</span>
                      </div>
                    )}
                 </div>
                 
                 <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={(e) => handleOpenEdit(customer, e)}
                     className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition"
                     title="Düzenle"
                   >
                     <Edit size={16} />
                   </button>
                   <button 
                     onClick={(e) => handleDelete(customer.id, e)}
                     className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition"
                     title="Sil"
                   >
                     <Trash2 size={16} />
                   </button>
                 </div>
               </div>
             ))
           )}
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">
                {editingId ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div className="flex gap-4 p-1 bg-slate-100 rounded-lg w-fit mb-4">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'kurumsal'})}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition ${formData.type === 'kurumsal' ? 'bg-white shadow text-brand-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Kurumsal
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'bireysel'})}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition ${formData.type === 'bireysel' ? 'bg-white shadow text-brand-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Bireysel
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">İsim / Ünvan</label>
                <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-slate-50" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder={formData.type === 'kurumsal' ? 'Örn: Global Lojistik Ltd.' : 'Örn: Ali Veli'} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Telefon</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-slate-50" 
                    value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+90..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">E-Posta</label>
                  <input type="email" className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-slate-50" 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="mail@..." />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Adres</label>
                <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-slate-50 h-24 resize-none" 
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Tam adres..." />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20">
                  {editingId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;