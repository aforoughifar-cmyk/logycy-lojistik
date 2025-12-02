import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Employee } from '../types';
import { Plus, Search, User, Phone, Mail, DollarSign, Trash2, X, Briefcase, CreditCard } from 'lucide-react';

const Staff: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Employee>>({
    fullName: '',
    position: '',
    department: '',
    email: '',
    phone: '',
    salary: 0,
    currency: 'TRY',
    startDate: '',
    iban: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await supabaseService.getEmployees();
    if (result.data) setEmployees(result.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.addEmployee(formData);
    setFormData({ fullName: '', position: '', department: '', email: '', phone: '', salary: 0, currency: 'TRY', startDate: '', iban: '' });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Personeli silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteEmployee(id);
    loadData();
  };

  const filtered = employees.filter(e => e.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Personel Listesi</h1>
          <p className="text-slate-500">Çalışan kartları ve detaylı bilgiler.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Yeni Personel
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
           <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="İsim Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
           {filtered.map(emp => (
             <div key={emp.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition bg-white relative group">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border-2 border-white shadow-sm">
                      <User size={28} />
                   </div>
                   <div>
                      <h3 className="font-bold text-brand-900 text-lg">{emp.fullName}</h3>
                      <p className="text-xs font-bold uppercase text-accent-600 bg-accent-50 px-2 py-0.5 rounded inline-block">{emp.position}</p>
                   </div>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                   <div className="flex items-center gap-2"><Briefcase size={14} className="text-slate-400"/> {emp.department || 'Genel'}</div>
                   <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {emp.phone || '-'}</div>
                   <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400"/> {emp.email || '-'}</div>
                   {emp.iban && <div className="flex items-center gap-2 text-xs font-mono"><CreditCard size={14} className="text-slate-400"/> {emp.iban}</div>}
                   
                   <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                      <DollarSign size={16} className="text-green-500"/> 
                      <span className="font-bold text-slate-800 text-lg">{emp.salary.toLocaleString()} {emp.currency}</span>
                      <span className="text-xs text-slate-400 ml-auto bg-slate-100 px-2 py-1 rounded">Net Maaş</span>
                   </div>
                </div>
                <button 
                  onClick={() => handleDelete(emp.id)}
                  className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                >
                   <Trash2 size={18} />
                </button>
             </div>
           ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Yeni Personel Kartı</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Ad Soyad</label>
                   <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Departman</label>
                   <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} placeholder="Örn: Operasyon"/>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Pozisyon</label>
                   <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Telefon</label>
                   <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                 </div>
              </div>
              <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">IBAN / Banka</label>
                   <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Maaş Tutarı</label>
                   <input type="number" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Para Birimi</label>
                   <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}>
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                   </select>
                 </div>
              </div>
              <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">İşe Başlama Tarihi</label>
                   <input type="date" className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              <div className="pt-4">
                 <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;