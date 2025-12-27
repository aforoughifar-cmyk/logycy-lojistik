
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Advance, Employee, Payroll } from '../types';
import { Plus, Search, Wallet, Trash2, X, CheckCircle, Calendar, User, DollarSign, Activity, PieChart } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';
import clsx from 'clsx';

// Interface for aggregated data
interface EmployeeAdvanceSummary {
    employeeId: string;
    employeeName: string;
    totalTaken: number;
    totalRepaid: number;
    remaining: number;
    currency: string;
    status: 'Bitti' | 'Kısmi' | 'Borçlu';
}

const Advances: React.FC = () => {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'list'>('summary');

  const [formData, setFormData] = useState<Partial<Advance>>({
    employeeId: '',
    amount: 0,
    currency: 'TRY',
    date: new Date().toISOString().slice(0, 10),
    description: 'Maaş Avansı',
    status: 'Onaylandı'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [advRes, empRes, payRes] = await Promise.all([
        supabaseService.getAdvances(),
        supabaseService.getEmployees(),
        supabaseService.getAllPayrolls() // New method to get deduction history
    ]);
    if (advRes.data) setAdvances(advRes.data);
    if (empRes.data) setEmployees(empRes.data.filter(e => e.isActive));
    if (payRes.data) setPayrolls(payRes.data);
    setLoading(false);
  };

  // --- AGGREGATION LOGIC ---
  const employeeSummaries: EmployeeAdvanceSummary[] = employees.map(emp => {
      // 1. Total Advances Taken (Only Approved ones if needed, assuming all here are valid)
      const empAdvances = advances.filter(a => a.employeeId === emp.id && a.status !== 'Reddedildi');
      const totalTaken = empAdvances.reduce((sum, a) => sum + a.amount, 0);

      // 2. Total Deductions from Payrolls
      const empPayrolls = payrolls.filter(p => p.employeeId === emp.id);
      const totalRepaid = empPayrolls.reduce((sum, p) => sum + (p.advanceDeduction || 0), 0);

      // 3. Calculation
      const remaining = totalTaken - totalRepaid;
      
      let status: 'Bitti' | 'Kısmi' | 'Borçlu' = 'Borçlu';
      if (remaining <= 0 && totalTaken > 0) status = 'Bitti';
      else if (totalRepaid > 0 && remaining > 0) status = 'Kısmi';
      else if (totalTaken === 0) status = 'Bitti'; // Or none

      return {
          employeeId: emp.id,
          employeeName: emp.fullName,
          totalTaken,
          totalRepaid,
          remaining: Math.max(0, remaining),
          currency: emp.currency, // Assuming primary currency
          status
      };
  }).filter(s => s.totalTaken > 0); // Only show those who ever took advance

  // --- STATS ---
  const totalStats = employeeSummaries.reduce((acc, curr) => {
      // Simple sum (ignoring currency mix for visual simplicity or assume TRY/Primary)
      // Ideally separate by currency
      acc.given += curr.totalTaken;
      acc.repaid += curr.totalRepaid;
      acc.remaining += curr.remaining;
      return acc;
  }, { given: 0, repaid: 0, remaining: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
        toast.error('Lütfen personel seçiniz.');
        return;
    }
    const emp = employees.find(e => e.id === formData.employeeId);
    await supabaseService.createAdvance({
        ...formData,
        employeeName: emp?.fullName || 'Unknown'
    });
    
    toast.success('Avans kaydedildi.');
    setShowModal(false);
    setFormData({ 
        employeeId: '', amount: 0, currency: 'TRY', 
        date: new Date().toISOString().slice(0, 10), description: 'Maaş Avansı', status: 'Onaylandı' 
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteAdvance(id);
    toast.success('Silindi.');
    loadData();
  };

  const filteredAdvances = advances.filter(a => 
      a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSummaries = employeeSummaries.filter(s => 
      s.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Avans Yönetimi</h1>
          <p className="text-slate-500">Müşarede takibi ve geri ödeme durumu.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Avans Ekle
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">TOPLAM VERİLEN</p>
                  <p className="text-2xl font-black text-blue-600">{totalStats.given.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Wallet size={24}/>
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">TOPLAM TAHSİL (MAAŞ)</p>
                  <p className="text-2xl font-black text-green-600">{totalStats.repaid.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                  <CheckCircle size={24}/>
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">KALAN ALACAK</p>
                  <p className="text-2xl font-black text-red-600">{totalStats.remaining.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                  <PieChart size={24}/>
              </div>
          </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
        <div className="flex border-b border-slate-100">
            <button 
              onClick={() => setActiveTab('summary')}
              className={clsx("flex-1 py-4 font-bold text-sm transition border-b-2", activeTab === 'summary' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:bg-slate-50")}
            >
                Genel Durum (Özet)
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={clsx("flex-1 py-4 font-bold text-sm transition border-b-2", activeTab === 'list' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:bg-slate-50")}
            >
                Hareket Listesi
            </button>
        </div>

        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
           <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Personel ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>
        
        <div className="p-0">
           {loading ? <div className="p-10 text-center text-slate-400">Yükleniyor...</div> : (
               <>
               {activeTab === 'summary' && (
                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                               <tr>
                                   <th className="p-4 font-bold uppercase text-xs">Personel</th>
                                   <th className="p-4 font-bold uppercase text-xs text-right">Toplam Alınan</th>
                                   <th className="p-4 font-bold uppercase text-xs text-right">Maaştan Kesilen</th>
                                   <th className="p-4 font-bold uppercase text-xs text-right">Kalan Borç</th>
                                   <th className="p-4 font-bold uppercase text-xs text-center">Durum</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {filteredSummaries.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">Veri yok.</td></tr> : 
                               filteredSummaries.map(item => (
                                   <tr key={item.employeeId} className="hover:bg-slate-50">
                                       <td className="p-4 font-bold text-slate-800">{item.employeeName}</td>
                                       <td className="p-4 text-right font-medium">{item.totalTaken.toLocaleString()} {item.currency}</td>
                                       <td className="p-4 text-right text-green-600">{item.totalRepaid.toLocaleString()}</td>
                                       <td className="p-4 text-right font-bold text-red-600">{item.remaining.toLocaleString()}</td>
                                       <td className="p-4 text-center">
                                           <span className={clsx("text-xs font-bold px-2 py-1 rounded border", 
                                               item.status === 'Bitti' ? "bg-green-50 text-green-700 border-green-100" : 
                                               item.status === 'Kısmi' ? "bg-orange-50 text-orange-700 border-orange-100" : 
                                               "bg-red-50 text-red-700 border-red-100"
                                           )}>
                                               {item.status === 'Bitti' ? 'TESLİM EDİLDİ' : item.status}
                                           </span>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               )}

               {activeTab === 'list' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                    {filteredAdvances.map(adv => (
                        <div key={adv.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition bg-white relative group">
                            <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                    <User size={20}/>
                                </div>
                                <div>
                                    <h3 className="font-bold text-brand-900">{adv.employeeName}</h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={10}/> {new Date(adv.date).toLocaleDateString('tr-TR')}</p>
                                </div>
                            </div>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold border border-green-200">
                                {adv.status}
                            </span>
                            </div>
                            
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
                                <p className="text-sm text-slate-600">{adv.description}</p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                                    <DollarSign size={18} />
                                    {adv.amount.toLocaleString()} {adv.currency}
                                </div>
                                <button 
                                    onClick={() => handleDelete(adv.id)} 
                                    className="text-slate-300 hover:text-red-500 p-2 transition opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        </div>
                    ))}
                   </div>
               )}
               </>
           )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><Wallet size={20}/> Avans Kaydı</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Personel</label>
                  <SearchableSelect 
                    options={employees.map(e => ({ id: e.id, label: e.fullName }))}
                    value={formData.employeeId || ''}
                    onChange={(val) => setFormData({...formData, employeeId: val})}
                    placeholder="Personel Seçiniz..."
                    required
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Tarih</label>
                      <input type="date" required className="w-full border rounded-lg p-2.5 text-sm" 
                        value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Tutar</label>
                      <input type="number" required className="w-full border rounded-lg p-2.5 text-sm" 
                        value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Para Birimi</label>
                      <select className="w-full border rounded-lg p-2.5 text-sm bg-white" 
                        value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                          <option value="TRY">TRY</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Durum</label>
                      <select className="w-full border rounded-lg p-2.5 text-sm bg-white" 
                        value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                          <option value="Onaylandı">Onaylandı</option>
                          <option value="Bekliyor">Bekliyor</option>
                      </select>
                  </div>
              </div>

              <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Açıklama</label>
                  <input className="w-full border rounded-lg p-2.5 text-sm" 
                    value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div className="pt-2">
                 <button type="submit" className="w-full bg-brand-900 text-white py-3 rounded-xl font-bold hover:bg-brand-800 transition">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Advances;
