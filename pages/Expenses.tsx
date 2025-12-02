import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Expense, Check } from '../types';
import { Plus, Search, Calendar, DollarSign, X, Filter, Banknote } from 'lucide-react';
import clsx from 'clsx';

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [checks, setChecks] = useState<Check[]>([]); // Pending Outgoing Checks
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Expense>>({
    category: 'Ofis',
    description: '',
    amount: 0,
    currency: 'TRY',
    paymentMethod: 'Nakit',
    date: new Date().toISOString().slice(0, 10)
  });

  const [selectedCheckId, setSelectedCheckId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [expRes, checkRes] = await Promise.all([
        supabaseService.getExpenses(),
        supabaseService.getPendingOutgoingChecks()
    ]);
    
    if (expRes.data) setExpenses(expRes.data);
    if (checkRes.data) setChecks(checkRes.data);
    
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let expenseData = { ...formData };

    // If check selected, append ref to description
    if (formData.paymentMethod === 'Çek' && selectedCheckId) {
        const selectedCheck = checks.find(c => c.id === selectedCheckId);
        if (selectedCheck) {
            expenseData.description = `${expenseData.description} (Çek: ${selectedCheck.referenceNo})`;
            // Note: In a real app, we might link via ID in DB, but description is fine for now.
        }
    }

    await supabaseService.addExpense(expenseData);
    setShowModal(false);
    setFormData({ category: 'Ofis', description: '', amount: 0, currency: 'TRY', paymentMethod: 'Nakit', date: new Date().toISOString().slice(0, 10) });
    setSelectedCheckId('');
    loadData();
  };

  const handleCheckSelection = (checkId: string) => {
      setSelectedCheckId(checkId);
      const check = checks.find(c => c.id === checkId);
      if(check) {
          setFormData(prev => ({
              ...prev,
              amount: check.amount,
              currency: check.currency as any,
              description: `Çek Ödemesi - ${check.partyName}`
          }));
      }
  };

  const filtered = expenses.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalExpense = filtered.reduce((acc, curr) => acc + curr.amount, 0); // Simplified (ignore currency mix for demo)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Ofis Giderleri</h1>
          <p className="text-slate-500">Günlük harcamalar ve operasyonel giderler.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Gider Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-3 flex items-center justify-between">
           <div>
              <p className="text-sm font-bold text-slate-500 mb-2">Toplam Gider (Filtrelenen)</p>
              <h3 className="text-3xl font-extrabold text-red-600">~{totalExpense.toLocaleString()}</h3>
           </div>
           <div className="p-4 bg-red-50 rounded-xl"><DollarSign className="text-red-500" size={32}/></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Açıklama ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Açıklama</th>
                <th className="px-6 py-4">Ödeme Yöntemi</th>
                <th className="px-6 py-4 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center">Yükleniyor...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center">Kayıt yok.</td></tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500">{new Date(exp.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{exp.category}</span></td>
                    <td className="px-6 py-4 font-medium text-slate-800">{exp.description}</td>
                    <td className="px-6 py-4">{exp.paymentMethod}</td>
                    <td className="px-6 py-4 text-right font-bold text-red-600">{exp.amount.toLocaleString()} {exp.currency}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Hızlı Gider Girişi</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Tarih</label>
                   <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Kategori</label>
                   <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                     <option value="Kira">Kira</option>
                     <option value="Ofis">Ofis Malzemesi</option>
                     <option value="Yemek">Yemek / Mutfak</option>
                     <option value="Ulaşım">Ulaşım / Benzin</option>
                     <option value="Fatura">Fatura (Elek/Su/Net)</option>
                     <option value="Diğer">Diğer</option>
                   </select>
                 </div>
              </div>
              
              {/* Payment Method & Check Selection Logic */}
              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase">Ödeme Yöntemi</label>
                 <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})}>
                   <option value="Nakit">Nakit</option>
                   <option value="Havale">Banka Havalesi</option>
                   <option value="Kredi Kartı">Kredi Kartı</option>
                   <option value="Çek">Çek (Portföyden)</option>
                 </select>
              </div>

              {formData.paymentMethod === 'Çek' && (
                  <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                      <label className="text-xs font-bold text-yellow-700 uppercase flex items-center gap-1 mb-1"><Banknote size={14}/> Ödenecek Çek Seçimi</label>
                      <select 
                        className="w-full border border-yellow-200 rounded-lg p-2 text-sm outline-none bg-white"
                        value={selectedCheckId}
                        onChange={(e) => handleCheckSelection(e.target.value)}
                      >
                          <option value="">Çek Seçiniz...</option>
                          {checks.map(c => (
                              <option key={c.id} value={c.id}>
                                  {c.referenceNo} - {c.partyName} ({c.amount} {c.currency})
                              </option>
                          ))}
                      </select>
                  </div>
              )}

              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase">Açıklama</label>
                 <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" placeholder="Örn: Kırtasiye Alımı" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Tutar</label>
                   <input 
                     type="number" 
                     required 
                     disabled={formData.paymentMethod === 'Çek'}
                     className={clsx("w-full border border-slate-200 rounded-xl p-3 text-sm outline-none", formData.paymentMethod === 'Çek' && "bg-slate-100 text-slate-500")} 
                     value={formData.amount} 
                     onChange={e => setFormData({...formData, amount: Number(e.target.value)})} 
                   />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Para Birimi</label>
                   <select 
                     className={clsx("w-full border border-slate-200 rounded-xl p-3 text-sm outline-none", formData.paymentMethod === 'Çek' && "bg-slate-100 text-slate-500 pointer-events-none")} 
                     value={formData.currency} 
                     onChange={e => setFormData({...formData, currency: e.target.value as any})}
                   >
                     <option value="TRY">TRY</option>
                     <option value="USD">USD</option>
                     <option value="EUR">EUR</option>
                     <option value="GBP">GBP</option>
                   </select>
                 </div>
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

export default Expenses;