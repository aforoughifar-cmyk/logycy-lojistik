import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Employee, Payroll } from '../types';
import { Calendar, Save, CheckCircle, Calculator, Printer } from 'lucide-react';
import clsx from 'clsx';

const PayrollPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(true);

  // Draft Calculation State
  const [drafts, setDrafts] = useState<Record<string, { bonus: number, deductions: number }>>({});

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    // 1. Get All Employees
    const empRes = await supabaseService.getEmployees();
    if(empRes.data) {
        setEmployees(empRes.data.filter(e => e.status === 'active'));
    }
    
    // 2. Get Existing Payrolls for this period
    const payRes = await supabaseService.getPayrolls(period);
    if(payRes.data) {
        setPayrolls(payRes.data);
    } else {
        setPayrolls([]);
    }
    setLoading(false);
  };

  const calculateNet = (base: number, bonus: number, deduct: number) => {
    return base + bonus - deduct;
  };

  const handleSave = async (emp: Employee) => {
    const draft = drafts[emp.id] || { bonus: 0, deductions: 0 };
    const net = calculateNet(emp.salary, draft.bonus, draft.deductions);
    
    const payload = {
        period: period,
        employeeId: emp.id,
        employeeName: emp.fullName,
        baseSalary: emp.salary,
        bonus: draft.bonus,
        deductions: draft.deductions,
        netSalary: net,
        currency: emp.currency,
        status: 'Ödendi' as any
    };

    await supabaseService.createPayroll(payload);
    loadData(); // Refresh to show saved state
  };

  const handleDraftChange = (id: string, field: 'bonus' | 'deductions', value: number) => {
    setDrafts(prev => ({
        ...prev,
        [id]: { ...prev[id], [field]: value }
    }));
  };

  const getTotalPayout = () => {
    let total = { TRY: 0, USD: 0, EUR: 0, GBP: 0 };
    
    // Count saved payrolls
    payrolls.forEach(p => {
        if(p.currency === 'TRY') total.TRY += p.netSalary;
        if(p.currency === 'USD') total.USD += p.netSalary;
        if(p.currency === 'EUR') total.EUR += p.netSalary;
    });

    // Count unsaved drafts (active employees not in payrolls)
    employees.forEach(e => {
        const isPaid = payrolls.find(p => p.employeeId === e.id);
        if(!isPaid) {
            const draft = drafts[e.id] || { bonus: 0, deductions: 0 };
            const net = calculateNet(e.salary, draft.bonus, draft.deductions);
             if(e.currency === 'TRY') total.TRY += net;
             if(e.currency === 'USD') total.USD += net;
             if(e.currency === 'EUR') total.EUR += net;
        }
    });

    return total;
  };

  const totals = getTotalPayout();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Maaş Bordrosu</h1>
          <p className="text-slate-500">Aylık maaş hesaplama ve ödeme takibi.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-500" size={18}/>
                <input 
                    type="month" 
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-bold text-brand-900"
                />
            </div>
            <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 flex items-center gap-2">
                <Printer size={18} /> Yazdır
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm font-bold text-slate-500 mb-2">Toplam TRY Ödenecek</p>
            <p className="text-3xl font-extrabold text-slate-800">₺{totals.TRY.toLocaleString()}</p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm font-bold text-slate-500 mb-2">Toplam USD Ödenecek</p>
            <p className="text-3xl font-extrabold text-green-600">${totals.USD.toLocaleString()}</p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm font-bold text-slate-500 mb-2">Personel Sayısı</p>
            <p className="text-3xl font-extrabold text-brand-900">{employees.length}</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
               <thead className="bg-brand-900 text-white font-bold">
                  <tr>
                     <th className="p-4">Personel</th>
                     <th className="p-4">Departman</th>
                     <th className="p-4 text-right">Maaş (Taban)</th>
                     <th className="p-4 text-right">Prim / Ek (+)</th>
                     <th className="p-4 text-right">Kesinti (-)</th>
                     <th className="p-4 text-right">Net Ödenecek</th>
                     <th className="p-4 text-center">Durum</th>
                     <th className="p-4 text-center">İşlem</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading ? (
                     <tr><td colSpan={8} className="p-8 text-center text-slate-400">Yükleniyor...</td></tr>
                  ) : employees.map(emp => {
                     const existing = payrolls.find(p => p.employeeId === emp.id);
                     const draft = drafts[emp.id] || { bonus: 0, deductions: 0 };
                     
                     if (existing) {
                        return (
                           <tr key={emp.id} className="bg-green-50/50">
                              <td className="p-4 font-bold text-slate-800">{emp.fullName}</td>
                              <td className="p-4 text-slate-500">{emp.department}</td>
                              <td className="p-4 text-right">{existing.baseSalary.toLocaleString()} {emp.currency}</td>
                              <td className="p-4 text-right text-green-600">+{existing.bonus.toLocaleString()}</td>
                              <td className="p-4 text-right text-red-600">-{existing.deductions.toLocaleString()}</td>
                              <td className="p-4 text-right font-bold text-lg">{existing.netSalary.toLocaleString()} {existing.currency}</td>
                              <td className="p-4 text-center">
                                 <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                    <CheckCircle size={12} /> ÖDENDİ
                                 </span>
                              </td>
                              <td className="p-4 text-center text-slate-400">-</td>
                           </tr>
                        );
                     }

                     return (
                        <tr key={emp.id} className="hover:bg-slate-50">
                           <td className="p-4 font-bold text-slate-800">{emp.fullName}</td>
                           <td className="p-4 text-slate-500">{emp.department}</td>
                           <td className="p-4 text-right font-medium">{emp.salary.toLocaleString()} {emp.currency}</td>
                           <td className="p-4 text-right">
                              <input 
                                 type="number"
                                 className="w-20 p-1 border border-slate-300 rounded text-right text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                 placeholder="0"
                                 onChange={(e) => handleDraftChange(emp.id, 'bonus', Number(e.target.value))}
                              />
                           </td>
                           <td className="p-4 text-right">
                              <input 
                                 type="number"
                                 className="w-20 p-1 border border-slate-300 rounded text-right text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                 placeholder="0"
                                 onChange={(e) => handleDraftChange(emp.id, 'deductions', Number(e.target.value))}
                              />
                           </td>
                           <td className="p-4 text-right font-bold text-brand-700">
                              {calculateNet(emp.salary, draft.bonus, draft.deductions).toLocaleString()} {emp.currency}
                           </td>
                           <td className="p-4 text-center">
                              <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold">
                                 BEKLİYOR
                              </span>
                           </td>
                           <td className="p-4 text-center">
                              <button 
                                onClick={() => handleSave(emp)}
                                className="bg-brand-600 text-white p-2 rounded hover:bg-brand-700 transition"
                                title="Onayla ve Kaydet"
                              >
                                 <Save size={16} />
                              </button>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default PayrollPage;