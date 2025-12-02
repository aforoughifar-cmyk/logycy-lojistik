import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Check, Customer, Supplier } from '../types';
import { Plus, Search, Banknote, Calendar, ArrowUpRight, ArrowDownLeft, Trash2, X, CheckCircle, Clock, AlertCircle, Eye } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

const Checks: React.FC = () => {
  const [checks, setChecks] = useState<Check[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'in' | 'out'>('in'); // in = Alınan (Received), out = Verilen (Given)

  const [formData, setFormData] = useState<Partial<Check>>({
    type: 'in',
    referenceNo: '',
    amount: 0,
    currency: 'TRY',
    dueDate: '',
    partyName: '',
    bankName: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [checkRes, custRes, supRes] = await Promise.all([
      supabaseService.getChecks(),
      supabaseService.getCustomers(),
      supabaseService.getSuppliers()
    ]);
    
    if (checkRes.data) setChecks(checkRes.data);
    if (custRes.data) setCustomers(custRes.data);
    if (supRes.data) setSuppliers(supRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.addCheck({ ...formData, type: tab }); // Use current tab as type
    setFormData({ referenceNo: '', amount: 0, currency: 'TRY', dueDate: '', partyName: '', bankName: '', description: '' });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Çeki silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteCheck(id);
    loadData();
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    await supabaseService.updateCheckStatus(id, newStatus);
    loadData();
  };

  const filtered = checks.filter(c => c.type === tab);
  
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'cleared': return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-100"><CheckCircle size={12}/> Tahsil</span>;
      case 'bounced': return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100"><AlertCircle size={12}/> Karşılıksız</span>;
      default: return <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100"><Clock size={12}/> Bekliyor</span>;
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Çek / Senet Yönetimi</h1>
          <p className="text-slate-500">Alınan ve verilen çeklerin vadesi ve takibi.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Yeni Çek Girişi
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
           <button 
             onClick={() => setTab('in')}
             className={clsx("flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition border-b-2", tab === 'in' ? "border-green-500 text-green-700 bg-green-50/30" : "border-transparent text-slate-500 hover:bg-slate-50")}
           >
             <ArrowDownLeft size={18} /> Alınan Çekler (Müşteri)
           </button>
           <button 
             onClick={() => setTab('out')}
             className={clsx("flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition border-b-2", tab === 'out' ? "border-red-500 text-red-700 bg-red-50/30" : "border-transparent text-slate-500 hover:bg-slate-50")}
           >
             <ArrowUpRight size={18} /> Verilen Çekler (Ödeme)
           </button>
        </div>

        <div className="p-6">
           {loading ? <p className="text-center py-10">Yükleniyor...</p> : filtered.length === 0 ? (
             <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
               <Banknote size={40} className="text-slate-300 mx-auto mb-3" />
               <p className="text-slate-500">Bu kategoride kayıt bulunamadı.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filtered.map(check => (
                 <div key={check.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition bg-white relative group">
                    <div className="flex justify-between items-start mb-4">
                       <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">VADE TARİHİ</p>
                          <div className={clsx("flex items-center gap-2 font-bold text-lg", new Date(check.dueDate) < new Date() && check.status === 'pending' ? "text-red-600" : "text-slate-800")}>
                             <Calendar size={18} /> {new Date(check.dueDate).toLocaleDateString('tr-TR')}
                          </div>
                       </div>
                       {getStatusBadge(check.status)}
                    </div>
                    
                    <div className="space-y-3 mb-4">
                       <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">{tab === 'in' ? 'KEŞİDECİ (KİMDEN)' : 'LEHTAR (KİME)'}</p>
                          <p className="font-bold text-brand-900">{check.partyName}</p>
                          {check.bankName && <p className="text-xs text-slate-500 mt-1">{check.bankName}</p>}
                       </div>
                       <div className="flex justify-between items-center px-2">
                          <span className="text-sm font-mono text-slate-500">#{check.referenceNo}</span>
                          <span className="text-xl font-extrabold text-slate-800">{check.amount.toLocaleString()} {check.currency}</span>
                       </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                       <div className="flex gap-2">
                          <button onClick={() => handleDelete(check.id)} className="text-slate-300 hover:text-red-500 transition p-1 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                          <Link to={`/checks/${check.id}`} className="text-slate-300 hover:text-blue-500 transition p-1 hover:bg-blue-50 rounded"><Eye size={18}/></Link>
                       </div>
                       {check.status === 'pending' && (
                         <div className="flex gap-2">
                            <button onClick={() => handleStatusUpdate(check.id, 'bounced')} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold hover:bg-red-200 transition">Karşılıksız</button>
                            <button onClick={() => handleStatusUpdate(check.id, 'cleared')} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded font-bold hover:bg-green-200 transition">Tahsil Et</button>
                         </div>
                       )}
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={clsx("px-6 py-4 flex justify-between items-center", tab === 'in' ? "bg-green-600" : "bg-red-600")}>
              <h3 className="text-white font-bold text-lg">{tab === 'in' ? 'Yeni Alınan Çek' : 'Yeni Verilen Çek'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Çek No</label>
                    <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                      value={formData.referenceNo} onChange={e => setFormData({...formData, referenceNo: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Vade Tarihi</label>
                    <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                      value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                  </div>
               </div>
               
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">{tab === 'in' ? 'Kimden Alındı (Müşteri Seçimi)' : 'Kime Verildi (Tedarikçi Seçimi)'}</label>
                  <select 
                    required 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-white"
                    value={formData.partyName}
                    onChange={e => setFormData({...formData, partyName: e.target.value})}
                  >
                      <option value="">Seçiniz...</option>
                      {tab === 'in' ? (
                          customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                      ) : (
                          suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                      )}
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Tutar</label>
                    <input type="number" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                      value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Banka Adı (Opsiyonel)</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
               </div>

               <div className="pt-4">
                 <button type="submit" className={clsx("w-full py-3 rounded-xl font-bold text-white shadow-lg transition", tab === 'in' ? "bg-green-600 hover:bg-green-700 shadow-green-500/20" : "bg-red-600 hover:bg-red-700 shadow-red-500/20")}>
                   Kaydet
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checks;