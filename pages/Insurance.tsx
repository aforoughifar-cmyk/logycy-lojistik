
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { InsurancePayment, Employee } from '../types';
import { Plus, Shield, Trash2, X, Calendar, Users, Edit, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useStore } from '../store/useStore';

const Insurance: React.FC = () => {
  const { definitions } = useStore();
  const [payments, setPayments] = useState<InsurancePayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState(new Date().toISOString().slice(0, 7)); 
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [insuranceTypes, setInsuranceTypes] = useState<{ name: string; rate: number }[]>([
    { name: 'Sosyal Sigorta', rate: 13 },
    { name: 'İhtiyat Sandığı', rate: 5 },
  ]);

  const [formData, setFormData] = useState<Partial<InsurancePayment>>({
    period: new Date().toISOString().slice(0, 7),
    amount: 0,
    currency: 'TRY',
    type: 'Sosyal Sigorta',
    paymentDate: new Date().toISOString().slice(0, 10),
    description: 'Aylık Prim Ödemesi',
    status: 'Ödendi',
  });

  const [empSelection, setEmpSelection] = useState<Record<string, any>>({});

  useEffect(() => {
    loadData();
    if (definitions.insuranceTypes && definitions.insuranceTypes.length > 0) {
      setInsuranceTypes(definitions.insuranceTypes);
    }
  }, [definitions]);

  const loadData = async () => {
    setLoading(true);
    const [payRes, empRes] = await Promise.all([
      supabaseService.getInsurancePayments(),
      supabaseService.getEmployees(),
    ]);
    if (payRes?.data) setPayments(payRes.data);
    if (empRes?.data) {
        const activeEmps = empRes.data.filter(e => e.isActive !== false);
        setEmployees(activeEmps);
    }
    setLoading(false);
  };

  const calculateAmountForEmployee = (empSalary: number, typeName: string) => {
      const typeDef = insuranceTypes.find(t => t.name === typeName);
      const rate = typeDef ? typeDef.rate : 0;
      return Math.round(Number(empSalary || 0) * (rate / 100));
  };

  // Improved recalculation function
  const recalculateTotal = (selection: Record<string, any>) => {
    let total = 0;
    Object.values(selection).forEach((item: any) => {
      if (item.selected) {
        total += Number(item.overrideAmount || 0);
      }
    });
    setFormData(prev => ({ ...prev, amount: total }));
  };

  const handleTypeChange = (typeName: string) => {
    const newSelection = { ...empSelection };
    employees.forEach(emp => {
        const currentSelected = newSelection[emp.id]?.selected || false;
        const calc = calculateAmountForEmployee(emp.salary, typeName);
        newSelection[emp.id] = {
            ...newSelection[emp.id],
            name: emp.fullName,
            salary: Number(emp.salary || 0),
            overrideAmount: calc,
            selected: currentSelected
        };
    });
    setFormData(prev => ({ ...prev, type: typeName, description: `${typeName} Ödemesi` }));
    setEmpSelection(newSelection);
    recalculateTotal(newSelection);
  };

  const handleToggleEmployee = (emp: Employee) => {
    const newSelection = { ...empSelection };
    const isCurrentlySelected = !!newSelection[emp.id]?.selected;
    
    // If not in selection yet, initialize it
    if (!newSelection[emp.id]) {
        const calc = calculateAmountForEmployee(emp.salary, formData.type || 'Sosyal Sigorta');
        newSelection[emp.id] = {
            selected: true,
            name: emp.fullName,
            salary: Number(emp.salary || 0),
            overrideAmount: calc,
        };
    } else {
        newSelection[emp.id].selected = !isCurrentlySelected;
    }
    
    setEmpSelection(newSelection);
    recalculateTotal(newSelection);
  };

  const handleManualAmountChange = (empId: string, val: number) => {
    const newSelection = { 
        ...empSelection, 
        [empId]: { 
            ...empSelection[empId], 
            overrideAmount: val, 
            selected: true // Auto-select if amount is manually entered
        } 
    };
    setEmpSelection(newSelection);
    recalculateTotal(newSelection);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    const defaultType = insuranceTypes.length > 0 ? insuranceTypes[0].name : 'Sosyal Sigorta';
    const initialSelection: Record<string, any> = {};
    employees.forEach(emp => {
        initialSelection[emp.id] = {
            selected: false,
            name: emp.fullName,
            salary: Number(emp.salary || 0),
            overrideAmount: calculateAmountForEmployee(emp.salary, defaultType)
        };
    });
    setFormData({
        period: periodFilter,
        amount: 0,
        currency: definitions.currencies[0]?.code || 'TRY',
        type: defaultType,
        paymentDate: new Date().toISOString().slice(0, 10),
        description: `${defaultType} Ödemesi`,
        status: 'Ödendi'
    });
    setEmpSelection(initialSelection);
    setShowModal(true);
  };

  const handleEdit = (payment: InsurancePayment) => {
    setEditingId(payment.id);
    setFormData({
      period: payment.period,
      amount: payment.amount,
      currency: payment.currency,
      type: payment.type || 'Sosyal Sigorta',
      paymentDate: payment.paymentDate,
      description: payment.description,
      status: payment.status,
    });
    const selection: Record<string, any> = {};
    employees.forEach(emp => {
        selection[emp.id] = {
            selected: false,
            name: emp.fullName,
            salary: Number(emp.salary || 0),
            overrideAmount: calculateAmountForEmployee(emp.salary, payment.type || 'Sosyal Sigorta')
        };
    });
    if (payment.coveredEmployees) {
      payment.coveredEmployees.forEach((ce: any) => {
        const emp = employees.find(e => e.id === ce.id);
        selection[ce.id] = {
          selected: true,
          name: ce.name,
          salary: emp ? Number(emp.salary || 0) : 0,
          overrideAmount: Number(ce.amount || 0),
        };
      });
    }
    setEmpSelection(selection);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const coveredList = Object.entries(empSelection)
      .filter(([_, val]) => (val as any).selected)
      .map(([id, val]: any) => ({ id, name: val.name, amount: Number(val.overrideAmount) }));
    if (coveredList.length === 0) {
      toast.error('Lütfen en az bir personel seçiniz.');
      return;
    }
    const payload = { ...formData, coveredEmployees: coveredList };
    const res = editingId 
        ? await supabaseService.updateInsurancePayment(editingId, payload)
        : await supabaseService.createInsurancePayment(payload);
    if (res.error) toast.error("Hata oluştu.");
    else {
        toast.success("Kayıت başarılı.");
        setShowModal(false);
        loadData();
    }
  };

  const filteredPayments = payments.filter(p => p.period === periodFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Sigorta & Prim Takibi</h1>
          <p className="text-slate-500">Personel yasal ödemeleri (Sigorta / İhtiyat Sandığı).</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="border rounded-lg p-2 font-bold text-brand-900 outline-none focus:ring-2 focus:ring-brand-500"/>
          <button onClick={handleOpenCreate} className="bg-accent-500 text-brand-900 px-5 py-2 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg font-bold">
            <Plus size={20} /> Ödeme Girişi
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b">
              <tr>
                <th className="p-4">Dönem</th>
                <th className="p-4">Tür</th>
                <th className="p-4">Açıklama</th>
                <th className="p-4 text-center">Kişi</th>
                <th className="p-4 text-right">Toplam Tutar</th>
                <th className="p-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-500"/></td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">Kayıت bulunamadı.</td></tr>
              ) : filteredPayments.map(pay => (
                <tr key={pay.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-bold text-slate-700">{pay.period}</td>
                  <td className="p-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">{pay.type}</span></td>
                  <td className="p-4 text-slate-600 font-medium">{pay.description}</td>
                  <td className="p-4 text-center font-bold text-brand-600">{pay.coveredEmployees?.length || 0} Kişi</td>
                  <td className="p-4 text-right font-black text-slate-900">{pay.amount.toLocaleString()} {pay.currency}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(pay)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Edit size={18}/></button>
                        <button onClick={() => { if(confirm('Silmek istediğinize emin misiniz?')) supabaseService.deleteInsurancePayment(pay.id).then(loadData); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><Shield size={20} /> {editingId ? 'Kaydı Düzenle' : 'Sigorta Girişi'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Prim Türü</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm bg-white font-bold" value={formData.type} onChange={e => handleTypeChange(e.target.value)}>
                    {insuranceTypes.map(t => <option key={t.name} value={t.name}>{t.name} (%{t.rate})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Dönem</label>
                  <input type="month" required className="w-full border rounded-lg p-2.5 text-sm font-bold" value={formData.period} onChange={e => setFormData({ ...formData, period: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Para Birimi</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm bg-white font-bold" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                    {definitions.currencies.map(curr => (
                      <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                  <h4 className="font-bold text-slate-700 flex items-center gap-2 uppercase text-xs tracking-wider"><Users size={16} /> Ödenecek Personel Listesi</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                              <tr>
                                  <th className="p-3 w-10">Seç</th>
                                  <th className="p-3">Personel</th>
                                  <th className="p-3 text-right">Maaş (Brüt)</th>
                                  <th className="p-3 text-right">Tahmini Prim</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {employees.map(emp => {
                                  const selectionData = empSelection[emp.id] || { selected: false, overrideAmount: 0 };
                                  const isSelected = !!selectionData.selected;
                                  return (
                                      <tr key={emp.id} className={clsx(isSelected && "bg-blue-50/50")}>
                                          <td className="p-3">
                                              <input 
                                                type="checkbox" 
                                                checked={isSelected} 
                                                onChange={() => handleToggleEmployee(emp)} 
                                                className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                                              />
                                          </td>
                                          <td className="p-3 font-bold text-slate-700 cursor-pointer" onClick={() => handleToggleEmployee(emp)}>{emp.fullName}</td>
                                          <td className="p-3 text-right text-slate-500 font-mono">{Number(emp.salary || 0).toLocaleString()}</td>
                                          <td className="p-3 text-right">
                                              <input 
                                                type="number" 
                                                className={clsx(
                                                    "w-24 border rounded px-2 py-1 text-right text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition",
                                                    isSelected ? "bg-white border-blue-200 text-brand-700" : "bg-slate-50 border-slate-100 text-slate-300"
                                                )}
                                                value={selectionData.overrideAmount || ''}
                                                onChange={(e) => handleManualAmountChange(emp.id, Number(e.target.value))}
                                              />
                                          </td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>

              <div className="bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-lg shrink-0">
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOPLAM ÖDENECEK</p>
                      <p className="text-3xl font-black">{formData.amount?.toLocaleString()} <span className="text-sm font-normal opacity-60">{formData.currency}</span></p>
                  </div>
                  <button type="submit" className="bg-accent-500 text-brand-900 px-8 py-3 rounded-xl font-bold hover:bg-accent-400 transition transform active:scale-95 shadow-lg shadow-accent-500/20">Kaydet و Onayla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Insurance;
