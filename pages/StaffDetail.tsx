
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Employee, Payroll, InsurancePayment } from '../types';
import { ArrowLeft, User, Phone, Mail, MapPin, Briefcase, CreditCard, Calendar, Printer, Shield, DollarSign, Download } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const StaffDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [insurancePayments, setInsurancePayments] = useState<any[]>([]); // Derived type
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'payroll' | 'insurance'>('profile');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (empId: string) => {
    setLoading(true);
    
    // 1. Get Employee
    const empRes = await supabaseService.getEmployeeById(empId);
    if (empRes.data) {
        setEmployee(empRes.data);
    } else {
        toast.error('Personel bulunamadı.');
        setLoading(false);
        return;
    }

    // 2. Get Payrolls
    const payRes = await supabaseService.getPayrollsByEmployee(empId);
    if (payRes.data) setPayrolls(payRes.data);

    // 3. Get All Insurance and Filter client-side (Robust approach)
    const insRes = await supabaseService.getInsurancePayments();
    if (insRes.data) {
        const empInsurance = insRes.data
            .filter(inv => inv.coveredEmployees && inv.coveredEmployees.some((ce: any) => ce.id === empId))
            .map(inv => {
                // Find specific amount for this employee in the JSONB
                const detail = inv.coveredEmployees?.find((ce: any) => ce.id === empId);
                return {
                    ...inv,
                    personalAmount: detail?.amount || 0 // If no amount saved, default 0 (or calc if logic existed)
                };
            });
        setInsurancePayments(empInsurance);
    }

    setLoading(false);
  };

  const handlePrint = async () => {
      if (!printRef.current) return;
      try {
          toast.loading('PDF Hazırlanıyor...');
          // Ensure element is visible for capture
          const element = printRef.current;
          
          const canvas = await html2canvas(element, { 
              scale: 2, 
              useCORS: true, 
              logging: false,
              backgroundColor: '#ffffff',
              width: 794, // A4 width in px at 96 DPI
              windowWidth: 1200
          });
          
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgProps = pdf.getImageProperties(imgData);
          const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfImgHeight);
          pdf.save(`${employee?.fullName}_Raporu.pdf`);
          toast.dismiss();
          toast.success('İndirildi');
      } catch (e) {
          console.error(e);
          toast.dismiss();
          toast.error('Hata oluştu');
      }
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!employee) return <div className="p-10 text-center text-red-500">Kayıt bulunamadı.</div>;

  // -- FILTER DATA --
  const filteredPayrolls = payrolls.filter(p => p.period.startsWith(`${yearFilter}`));
  const filteredInsurance = insurancePayments.filter(i => i.period.startsWith(`${yearFilter}`));

  const totalNetSalary = filteredPayrolls.reduce((sum, p) => sum + p.netSalary, 0);
  const totalInsurancePaid = filteredInsurance.reduce((sum, i) => sum + i.personalAmount, 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/staff')} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition bg-white border border-slate-200 shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-3">
              {employee.fullName}
              <span className={clsx("text-xs px-2.5 py-1 rounded-lg font-bold uppercase border", employee.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-slate-100 text-slate-500 border-slate-200")}>
                {employee.isActive ? 'Aktif' : 'Pasif'}
              </span>
            </h1>
            <p className="text-slate-500 text-sm">{employee.position} • {employee.department || 'Genel'}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
            <select 
                className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold text-sm outline-none"
                value={yearFilter}
                onChange={(e) => setYearFilter(Number(e.target.value))}
            >
                {[yearFilter - 1, yearFilter, yearFilter + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handlePrint} className="bg-brand-900 text-white px-4 py-2 rounded-xl hover:bg-brand-800 transition flex items-center gap-2 font-bold shadow-lg">
                <Printer size={18} /> Rapor Al
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Profile Card */}
          <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-center mb-6">
                      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-2xl font-bold border-4 border-white shadow-lg">
                          {employee.firstName?.[0]}{employee.lastName?.[0]}
                      </div>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50 pb-3">
                          <Phone size={16} className="text-slate-400"/> {employee.phone || '-'}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50 pb-3">
                          <Mail size={16} className="text-slate-400"/> {employee.email || '-'}
                      </div>
                      <div className="flex items-start gap-3 text-sm text-slate-700 border-b border-slate-50 pb-3">
                          <MapPin size={16} className="text-slate-400 mt-1"/> {employee.address || '-'}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50 pb-3">
                          <Briefcase size={16} className="text-slate-400"/> {employee.position}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-700">
                          <Calendar size={16} className="text-slate-400"/> Başlangıç: {new Date(employee.startDate || Date.now()).toLocaleDateString('tr-TR')}
                      </div>
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <CreditCard size={18} className="text-blue-600"/> Banka Bilgileri
                  </h3>
                  <div className="space-y-3 text-sm">
                      <div>
                          <p className="text-xs text-slate-400 uppercase">Banka Adı</p>
                          <p className="font-medium">{employee.bankName || '-'}</p>
                      </div>
                      <div>
                          <p className="text-xs text-slate-400 uppercase">IBAN</p>
                          <p className="font-mono bg-slate-50 p-2 rounded border border-slate-100 text-xs">{employee.iban || '-'}</p>
                      </div>
                  </div>
              </div>
          </div>

          {/* Right Column: Reports */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <p className="text-xs font-bold text-green-700 uppercase mb-1">YILLIK NET MAAŞ ({yearFilter})</p>
                      <p className="text-2xl font-black text-green-800">{totalNetSalary.toLocaleString()} {employee.currency}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-xs font-bold text-blue-700 uppercase mb-1">YILLIK BİME PRİMİ ({yearFilter})</p>
                      <p className="text-2xl font-black text-blue-800">{totalInsurancePaid.toLocaleString()} {employee.currency}</p>
                  </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                  <div className="flex border-b border-slate-100">
                      <button onClick={() => setActiveTab('payroll')} className={clsx("flex-1 py-4 font-bold text-sm border-b-2 transition", activeTab === 'payroll' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:bg-slate-50")}>
                          Fiş / Bordro Geçmişi
                      </button>
                      <button onClick={() => setActiveTab('insurance')} className={clsx("flex-1 py-4 font-bold text-sm border-b-2 transition", activeTab === 'insurance' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:bg-slate-50")}>
                          Sigorta Dökümü
                      </button>
                  </div>

                  <div className="p-0">
                      {activeTab === 'payroll' && (
                          <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                      <tr>
                                          <th className="p-4 font-bold">Dönem</th>
                                          <th className="p-4 font-bold text-right">Taban Maaş</th>
                                          <th className="p-4 font-bold text-right text-green-600">Ekler (+)</th>
                                          <th className="p-4 font-bold text-right text-orange-600">Avans (-)</th>
                                          <th className="p-4 font-bold text-right text-red-600">Kesinti (-)</th>
                                          <th className="p-4 font-bold text-right">Net Ödenen</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                      {filteredPayrolls.length === 0 ? (
                                          <tr><td colSpan={6} className="p-8 text-center text-slate-400">Kayıt bulunamadı.</td></tr>
                                      ) : (
                                          filteredPayrolls.map(pay => (
                                              <tr key={pay.id} className="hover:bg-slate-50">
                                                  <td className="p-4 font-mono font-bold text-brand-700">{pay.period}</td>
                                                  <td className="p-4 text-right text-slate-600">{pay.baseSalary.toLocaleString()}</td>
                                                  <td className="p-4 text-right text-green-600">+{pay.bonus.toLocaleString()}</td>
                                                  <td className="p-4 text-right text-orange-600">
                                                      {pay.advanceDeduction ? `-${pay.advanceDeduction.toLocaleString()}` : '-'}
                                                  </td>
                                                  <td className="p-4 text-right text-red-600">-{pay.deductions.toLocaleString()}</td>
                                                  <td className="p-4 text-right font-bold text-lg text-slate-800">
                                                      {pay.netSalary.toLocaleString()} <span className="text-xs font-normal text-slate-400">{pay.currency}</span>
                                                  </td>
                                              </tr>
                                          ))
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      )}

                      {activeTab === 'insurance' && (
                          <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                      <tr>
                                          <th className="p-4 font-bold">Dönem</th>
                                          <th className="p-4 font-bold">Sigorta Türü</th>
                                          <th className="p-4 font-bold">Açıklama</th>
                                          <th className="p-4 font-bold text-right">Yatırılan Tutar (Kişi)</th>
                                          <th className="p-4 font-bold text-center">Durum</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                      {filteredInsurance.length === 0 ? (
                                          <tr><td colSpan={5} className="p-8 text-center text-slate-400">Kayıt bulunamadı.</td></tr>
                                      ) : (
                                          filteredInsurance.map(ins => (
                                              <tr key={ins.id} className="hover:bg-slate-50">
                                                  <td className="p-4 font-mono font-bold text-brand-700">{ins.period}</td>
                                                  <td className="p-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">{ins.type || 'SGK'}</span></td>
                                                  <td className="p-4 text-slate-600 truncate max-w-[150px]">{ins.description}</td>
                                                  <td className="p-4 text-right font-bold text-slate-800">
                                                      {ins.personalAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400">{ins.currency}</span>
                                                  </td>
                                                  <td className="p-4 text-center">
                                                      <span className={clsx("text-xs font-bold px-2 py-1 rounded", ins.status === 'Ödendi' ? "text-green-600 bg-green-50" : "text-orange-600 bg-orange-50")}>
                                                          {ins.status}
                                                      </span>
                                                  </td>
                                              </tr>
                                          ))
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* Hidden Print Container - Offscreen but rendered for html2canvas */}
      <div className="fixed top-0 left-[-9999px]">
          <div ref={printRef} className="p-10 bg-white text-black font-sans" style={{width: '210mm', minHeight: '297mm'}}>
              <div className="border-b-2 border-black pb-4 mb-6">
                  <h1 className="text-2xl font-bold uppercase">PERSONEL HESAP EKSTRESİ</h1>
                  <p className="text-sm">LOGYCY LOGISTICS LTD.</p>
              </div>
              
              <div className="flex justify-between mb-8">
                  <div>
                      <p className="text-xs font-bold uppercase text-gray-500">PERSONEL</p>
                      <p className="font-bold text-lg">{employee.fullName}</p>
                      <p>{employee.position}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs font-bold uppercase text-gray-500">RAPOR YILI</p>
                      <p className="font-bold text-lg">{yearFilter}</p>
                      <p>Oluşturma: {new Date().toLocaleDateString()}</p>
                  </div>
              </div>

              <div className="mb-8">
                  <h3 className="font-bold border-b border-gray-300 mb-2">MAAŞ DÖKÜMÜ</h3>
                  <table className="w-full text-xs">
                      <thead>
                          <tr className="border-b border-black">
                              <th className="text-left py-1">Dönem</th>
                              <th className="text-right py-1">Taban</th>
                              <th className="text-right py-1">Ekler</th>
                              <th className="text-right py-1">Avans</th>
                              <th className="text-right py-1">Kesinti</th>
                              <th className="text-right py-1">NET</th>
                          </tr>
                      </thead>
                      <tbody>
                          {filteredPayrolls.map(p => (
                              <tr key={p.id} className="border-b border-gray-100">
                                  <td className="py-1">{p.period}</td>
                                  <td className="text-right py-1">{p.baseSalary.toLocaleString()}</td>
                                  <td className="text-right py-1">+{p.bonus.toLocaleString()}</td>
                                  <td className="text-right py-1 text-slate-600">
                                      {p.advanceDeduction ? `-${p.advanceDeduction.toLocaleString()}` : ''}
                                  </td>
                                  <td className="text-right py-1">-{p.deductions.toLocaleString()}</td>
                                  <td className="text-right py-1 font-bold">{p.netSalary.toLocaleString()} {p.currency}</td>
                              </tr>
                          ))}
                          <tr className="border-t-2 border-black font-bold">
                              <td className="py-2">TOPLAM</td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td className="text-right py-2">{totalNetSalary.toLocaleString()} {employee.currency}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>

              <div>
                  <h3 className="font-bold border-b border-gray-300 mb-2">SİGORTA / PRİM DÖKÜMÜ</h3>
                  <table className="w-full text-xs">
                      <thead>
                          <tr className="border-b border-black">
                              <th className="text-left py-1">Dönem</th>
                              <th className="text-left py-1">Tür</th>
                              <th className="text-left py-1">Açıklama</th>
                              <th className="text-right py-1">Tutar</th>
                          </tr>
                      </thead>
                      <tbody>
                          {filteredInsurance.map(i => (
                              <tr key={i.id} className="border-b border-gray-100">
                                  <td className="py-1">{i.period}</td>
                                  <td className="py-1">{i.type}</td>
                                  <td className="py-1">{i.description}</td>
                                  <td className="text-right py-1 font-bold">{i.personalAmount.toLocaleString()} {i.currency}</td>
                              </tr>
                          ))}
                          <tr className="border-t-2 border-black font-bold">
                              <td className="py-2">TOPLAM PRİM</td>
                              <td></td>
                              <td></td>
                              <td className="text-right py-2">{totalInsurancePaid.toLocaleString()} {employee.currency}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

    </div>
  );
};

export default StaffDetail;
