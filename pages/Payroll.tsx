
import React, { useEffect, useState, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Employee, Payroll } from '../types';
import { Calendar, CheckCircle, Trash2, Loader2, CheckSquare, User, Wallet, Filter, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useDeletePayroll } from '../hooks/useQueries';

const PayrollPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); 
  const [loading, setLoading] = useState(true);
  const [showOnlyWithDebt, setShowOnlyWithDebt] = useState(false);
  const [advanceBalances, setAdvanceBalances] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, { bonus: number, deductions: number, advanceDeduct: number, days: number }>>({});

  const deletePayrollMutation = useDeletePayroll();

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
        const empRes = await supabaseService.getEmployees();
        let empList: Employee[] = [];
        if(empRes.data) empList = empRes.data.filter(e => e.isActive !== false).sort((a,b) => a.fullName.localeCompare(b.fullName));
        
        const payRes = await supabaseService.getPayrolls(period);
        const currentMonthPayrolls = payRes.data || [];
        setPayrolls(currentMonthPayrolls);

        const newBalances: Record<string, number> = {};
        const newDrafts: typeof drafts = {};
        if (empList.length > 0) {
            await Promise.all(empList.map(async (emp) => {
                const advRes = await supabaseService.getEmployeeAdvances(emp.id);
                const netDebt = advRes.data || 0;
                const existingInPeriod = currentMonthPayrolls.find(p => p.employeeId === emp.id);
                newBalances[emp.id] = netDebt + (existingInPeriod?.advanceDeduction || 0);
                newDrafts[emp.id] = { bonus: existingInPeriod?.bonus || 0, deductions: existingInPeriod?.deductions || 0, advanceDeduct: existingInPeriod?.advanceDeduction || 0, days: existingInPeriod?.workedDays || 30 };
            }));
        }
        setEmployees(empList);
        setDrafts(newDrafts);
        setAdvanceBalances(newBalances);
    } catch (err) {
        toast.error("Veriler yüklenirken hata oluştu.");
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async (emp: Employee) => {
    const draft = drafts[emp.id] || { bonus: 0, deductions: 0, advanceDeduct: 0, days: 30 };
    const base = Number(emp.salary || 0);
    const prorated = draft.days >= 30 ? base : Math.round((base / 30) * draft.days);
    const net = prorated + draft.bonus - draft.deductions - draft.advanceDeduct;
    
    const payload = {
        period: period, employeeId: emp.id, employeeName: emp.fullName, baseSalary: base, bonus: draft.bonus, deductions: draft.deductions, advanceDeduction: draft.advanceDeduct, workedDays: draft.days, netSalary: net, currency: emp.currency, status: 'Ödendi'
    };
    const res = await supabaseService.createPayroll(payload);
    if(res.error) toast.error('Hata: ' + res.error);
    else { toast.success('Maaş ödendi.'); loadData(); }
  };

  const handleDelete = async (payrollId: string) => {
      if(!confirm('Bu ödeme kaydını silmek istiyor musunuz? (Finans kayıtları otomatik temizlenir)')) return;
      try {
          await deletePayrollMutation.mutateAsync(payrollId);
          toast.success('İşlem geri alındı.');
          loadData();
      } catch (err: any) {
          toast.error("Hata: " + err.message);
      }
  };

  const visibleEmployees = useMemo(() => employees.filter(emp => showOnlyWithDebt ? (advanceBalances[emp.id] || 0) > 0 : true), [employees, showOnlyWithDebt, advanceBalances]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold text-brand-900">Maaş & Bordro Yönetimi</h1><p className="text-slate-500">Personel hak edişleri و ödeme takibi.</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="relative"><Calendar className="absolute left-3 top-2.5 text-slate-500" size={18}/><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none font-bold text-brand-900"/></div><button onClick={() => setShowOnlyWithDebt(!showOnlyWithDebt)} className={clsx("px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm", showOnlyWithDebt ? "bg-orange-600 text-white" : "bg-white border text-slate-600")}><Wallet size={16} /> {showOnlyWithDebt ? "Tümü" : "Borçlular"}</button></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b"><tr><th className="p-4">Personel</th><th className="p-4 text-center">Gün</th><th className="p-4 text-right">Maaş</th><th className="p-4 text-right text-green-600">Ek (+)</th><th className="p-4 text-right text-orange-600">Avans</th><th className="p-4 text-right text-red-600">Kesinti (-)</th><th className="p-4 text-right font-black">NET</th><th className="p-4 text-center">İşlem</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-brand-500" size={32}/></td></tr> : visibleEmployees.map(emp => {
                     const existing = payrolls.find(p => p.employeeId === emp.id);
                     const draft = drafts[emp.id] || { bonus: 0, deductions: 0, advanceDeduct: 0, days: 30 };
                     const base = Number(emp.salary || 0);
                     const prorated = existing ? (base / 30 * (existing.workedDays || 30)) : (base / 30 * draft.days);
                     const net = existing ? existing.netSalary : (prorated + draft.bonus - draft.deductions - draft.advanceDeduct);
                     return (
                        <tr key={emp.id} className={clsx("transition", existing ? "bg-green-50/30" : "hover:bg-slate-50")}>
                           <td className="p-4"><div className="font-bold text-slate-800">{emp.fullName}</div><div className="text-[10px] text-slate-400 font-bold">{emp.position}</div></td>
                           <td className="p-4 text-center">{existing ? <span className="font-bold">{existing.workedDays}</span> : <input type="number" className="w-14 p-1.5 border rounded text-center font-bold" value={draft.days} onChange={(e) => setDrafts({...drafts, [emp.id]: {...draft, days: Number(e.target.value)}})}/> }</td>
                           <td className="p-4 text-right text-slate-600">{Math.round(prorated).toLocaleString()}</td>
                           <td className="p-4 text-right">{existing ? <span className="text-green-600">+{existing.bonus}</span> : <input type="number" className="w-20 p-1.5 border rounded text-right text-green-600" placeholder="0" value={draft.bonus || ''} onChange={(e) => setDrafts({...drafts, [emp.id]: {...draft, bonus: Number(e.target.value)}})}/> }</td>
                           <td className="p-4 text-right text-orange-600">-{existing ? existing.advanceDeduction : <input type="number" className="w-20 p-1.5 border rounded text-right text-orange-600" placeholder="0" value={draft.advanceDeduct || ''} onChange={(e) => setDrafts({...drafts, [emp.id]: {...draft, advanceDeduct: Number(e.target.value)}})}/> }</td>
                           <td className="p-4 text-right text-red-600">-{existing ? existing.deductions : <input type="number" className="w-20 p-1.5 border rounded text-right text-red-600" placeholder="0" value={draft.deductions || ''} onChange={(e) => setDrafts({...drafts, [emp.id]: {...draft, deductions: Number(e.target.value)}})}/> }</td>
                           <td className="p-4 text-right font-black text-brand-900">{net.toLocaleString()} {emp.currency}</td>
                           <td className="p-4 text-center">{existing ? <div className="flex items-center justify-center gap-2"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Ödendi</span><button onClick={() => handleDelete(existing.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div> : <button onClick={() => handleSave(emp)} className="bg-brand-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Kaydet</button> }</td>
                        </tr>
                     );
                  })}</tbody></table></div></div>
    </div>
  );
};

export default PayrollPage;
