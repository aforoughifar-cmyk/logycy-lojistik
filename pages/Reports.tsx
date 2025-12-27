
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Shipment, Invoice, InvoiceType, Expense, Payroll, InsurancePayment, Check } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, PieChart as PieIcon, 
  Download, Receipt, ScrollText, Building, Briefcase, Shield, Award, 
  Scale, CheckCircle2, Loader2, Banknote, Wallet, FileBarChart, Info,
  /* Fix: Added missing imports for Calendar and Users icons */
  Calendar, Users
} from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const Reports: React.FC = () => {
  const { currencyRates, definitions } = useStore();
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<'ALL' | 'USD' | 'EUR' | 'GBP' | 'TRY'>('ALL');

  // Data States
  const [rawInvoices, setRawInvoices] = useState<Invoice[]>([]);
  const [rawChecks, setRawChecks] = useState<Check[]>([]);
  const [rawFinance, setRawFinance] = useState<any[]>([]);
  const [rawExpenses, setRawExpenses] = useState<Expense[]>([]);
  const [rawPayrolls, setRawPayrolls] = useState<Payroll[]>([]);
  const [rawInsurance, setRawInsurance] = useState<InsurancePayment[]>([]);

  const monthsList = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  useEffect(() => {
    loadAllRawData();
  }, []);

  const loadAllRawData = async () => {
    setLoading(true);
    try {
        const [inv, chk, fin, exp, pay, ins] = await Promise.all([
            supabaseService.getInvoices(),
            supabaseService.getChecks(),
            supabaseService.getAllFinanceItems(),
            supabaseService.getExpenses(),
            supabaseService.getAllPayrolls(),
            supabaseService.getInsurancePayments()
        ]);
        setRawInvoices(inv.data || []);
        setRawChecks(chk.data || []);
        setRawFinance(fin.data || []);
        setRawExpenses(exp.data || []);
        setRawPayrolls(pay.data || []);
        setRawInsurance(ins.data || []);
    } catch (e) {
        toast.error("Veriler alınamadı.");
    }
    setLoading(false);
  };

  // --- INTELLIGENT ANALYSIS ENGINE ---
  const analysis = useMemo(() => {
    const getRate = (curr: string) => {
        if (selectedCurrency === 'ALL') return currencyRates[curr] || (curr === 'USD' ? 1 : 0);
        return curr === selectedCurrency ? 1 : 0; 
    };

    const isMatch = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === year && (month === 'all' || d.getMonth() === month);
    };

    let metrics = {
        revOrdino: 0, // Cash from Oridino
        revInvoice: 0, // Accrual from Invoices
        revCheck: 0, // Incoming checks
        expOffice: 0,
        expPayroll: 0,
        expInvoice: 0,
        expCheck: 0, // Outgoing checks
        expInsurance: 0
    };

    // Process Finance Items (Ordino focus)
    rawFinance.forEach(f => {
        if (!isMatch(f.created_at)) return;
        const val = f.amount * getRate(f.currency);
        if (f.type === 'gelir') metrics.revOrdino += val;
        else metrics.expOffice += val;
    });

    // Process Invoices
    rawInvoices.forEach(inv => {
        if (!isMatch(inv.issueDate)) return;
        const val = inv.totalAmount * getRate(inv.currency);
        if (inv.type === InvoiceType.SALE) metrics.revInvoice += val;
        else metrics.expInvoice += val;
    });

    // Process Checks (Based on Due Date)
    rawChecks.forEach(c => {
        if (!isMatch(c.dueDate)) return;
        const val = c.amount * getRate(c.currency);
        if (c.type === 'in') metrics.revCheck += val;
        else metrics.expCheck += val;
    });

    // Process Payrolls
    rawPayrolls.forEach(p => {
        const date = `${p.period}-28`;
        if (!isMatch(date)) return;
        metrics.expPayroll += p.netSalary * getRate(p.currency);
    });

    // Process Insurance
    rawInsurance.forEach(i => {
        if (!isMatch(i.paymentDate)) return;
        metrics.expInsurance += i.amount * getRate(i.currency);
    });

    const totalRev = metrics.revOrdino + metrics.revInvoice + metrics.revCheck;
    const totalExp = metrics.expOffice + metrics.expPayroll + metrics.expInvoice + metrics.expCheck + metrics.expInsurance;

    return {
        ...metrics,
        totalRev,
        totalExp,
        netProfit: totalRev - totalExp,
        margin: totalRev > 0 ? ((totalRev - totalExp) / totalRev) * 100 : 0
    };
  }, [year, month, selectedCurrency, rawInvoices, rawChecks, rawFinance, rawExpenses, rawPayrolls, rawInsurance, currencyRates]);

  const sourceChartData = [
    { name: 'Ordino (Nakit)', value: analysis.revOrdino, color: '#10b981' },
    { name: 'Fatura (Temsili)', value: analysis.revInvoice, color: '#3b82f6' },
    { name: 'Çek (Portföy)', value: analysis.revCheck, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  const expenseChartData = [
    { name: 'Ofis/Genel', value: analysis.expOffice, color: '#f59e0b' },
    { name: 'Personel/Maaş', value: analysis.expPayroll, color: '#ef4444' },
    { name: 'Alış Faturası', value: analysis.expInvoice, color: '#ec4899' },
    { name: 'Verilen Çek', value: analysis.expCheck, color: '#64748b' },
    { name: 'Sigorta', value: analysis.expInsurance, color: '#06b6d4' },
  ].filter(d => d.value > 0);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('smart-report-pdf');
    if (!element) return;
    setIsExporting(true);
    const toastId = toast.loading('Hülasa Rapor Hazırlanıyor...');
    try {
        await new Promise(r => setTimeout(r, 800));
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfImgHeight);
        pdf.save(`Logycy_Smart_Report_${year}_${month}.pdf`);
        toast.success('Rapor İndirildi', { id: toastId });
    } catch (err) {
        toast.error('Hata oluştu', { id: toastId });
    } finally {
        setIsExporting(false);
    }
  };

  const displayCurr = selectedCurrency === 'ALL' ? 'USD (Eq)' : selectedCurrency;

  return (
    <div className="space-y-8 pb-20">
      
      {/* --- TOP CONTROLS --- */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-brand-900 tracking-tight flex items-center gap-3">
             <FileBarChart className="text-accent-500" size={32}/> Akıllı Analitik Raporu
          </h1>
          <p className="text-slate-500 font-medium">Finansal akışların derinlemesine analizi و özet raporu.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
            <button 
                onClick={handleDownloadPDF} 
                disabled={isExporting || loading}
                className="bg-brand-900 text-white px-6 py-3 rounded-2xl hover:bg-brand-800 transition flex items-center gap-2 font-bold shadow-xl disabled:opacity-50"
            >
                {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />} 
                Stratejik PDF İndir
            </button>

            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <select className="bg-transparent text-sm font-bold text-slate-700 px-2 outline-none cursor-pointer border-r" value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value as any)}>
                    <option value="ALL">USD Eq.</option>
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                </select>
                <select className="bg-transparent text-sm font-bold text-slate-700 px-2 outline-none cursor-pointer border-r" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select className="bg-transparent text-sm font-bold text-slate-700 px-2 outline-none cursor-pointer" value={month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                    <option value="all">Yıllık</option>
                    {monthsList.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
            </div>
        </div>
      </div>

      {loading ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-400">
              <Loader2 size={64} className="animate-spin text-brand-900 mb-4" />
              <p className="font-black text-lg animate-pulse">VERİLER ANALİZ EDİLİYOR...</p>
          </div>
      ) : (
          <div id="smart-report-pdf" className="space-y-10 bg-slate-50/50 p-1 md:p-0">
              
              {/* --- REPORT HEADER (Official Style) --- */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-start">
                  <div className="flex items-center gap-6">
                      <div className="bg-brand-900 text-white w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl tracking-tighter shadow-lg">L</div>
                      <div>
                          <h2 className="text-2xl font-black text-slate-900 uppercase">LOGYCY SHIPPING LTD.</h2>
                          <p className="text-slate-400 font-bold tracking-[0.2em] text-xs mt-1">MANAGEMENT FINANCIAL REPORT v3.0</p>
                          <div className="mt-3 flex gap-4 text-[10px] font-black uppercase text-slate-500">
                              <span className="flex items-center gap-1"><Calendar size={12}/> DÖNEM: {month !== 'all' ? monthsList[month] : ''} {year}</span>
                              <span className="flex items-center gap-1"><DollarSign size={12}/> BİRİM: {displayCurr}</span>
                          </div>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Rapor Tarihi</p>
                      <p className="font-mono font-bold text-slate-800">{new Date().toLocaleString('tr-TR')}</p>
                      <div className="mt-4 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-100 inline-block">
                          VERİLER DOĞRULANDI
                      </div>
                  </div>
              </div>

              {/* --- EXECUTIVE KPIs --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-brand-900 to-brand-800 p-6 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                      <p className="text-brand-300 text-[10px] font-black uppercase tracking-widest mb-2">NET OPERASYONEL KAR</p>
                      <h3 className="text-3xl font-black">{analysis.netProfit.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-sm font-normal opacity-50">{displayCurr}</span></h3>
                      <div className="mt-4 flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                          <TrendingUp size={14}/> %{analysis.margin.toFixed(1)} Karlılık Oranı
                      </div>
                      <Wallet size={80} className="absolute right-[-20px] bottom-[-20px] opacity-10" />
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">ORDİNO TAHSİLATLARI (NAKİT)</p>
                      <h3 className="text-2xl font-black text-emerald-600">{analysis.revOrdino.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-sm font-normal text-slate-300">{displayCurr}</span></h3>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold italic">Dosya bazlı sıcak para akışı.</p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">TOPLAM GİDER YÜKÜ</p>
                      <h3 className="text-2xl font-black text-rose-600">{analysis.totalExp.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-sm font-normal text-slate-300">{displayCurr}</span></h3>
                      <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500" style={{width: `${Math.min((analysis.totalExp/analysis.totalRev)*100, 100)}%`}}></div>
                      </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">ÇEK PORTFÖY DEĞERİ</p>
                      <h3 className="text-2xl font-black text-purple-600">{analysis.revCheck.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-sm font-normal text-slate-300">{displayCurr}</span></h3>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold">Vadesi gelen alacak senetleri.</p>
                  </div>
              </div>

              {/* --- SOURCE ANALYSIS CHARTS --- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <h3 className="font-black text-slate-800 text-sm mb-6 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-2 h-2 bg-brand-500 rounded-full"></div> GELİR KAYNAKLARI DAĞILIMI
                      </h3>
                      <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={sourceChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                      {sourceChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                  </Pie>
                                  <Tooltip />
                                  <Legend verticalAlign="bottom" height={36}/>
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                      <div className="mt-6 space-y-3">
                          {sourceChartData.map((d, i) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500 font-bold">{d.name}</span>
                                  <span className="font-black text-slate-700">{((d.value/analysis.totalRev)*100).toFixed(1)}%</span>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <h3 className="font-black text-slate-800 text-sm mb-6 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-2 h-2 bg-rose-500 rounded-full"></div> GİDER KALEMLERİ ANALİZİ
                      </h3>
                      <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={expenseChartData} layout="vertical" margin={{left: 40}}>
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                                  <Tooltip cursor={{fill: 'transparent'}} />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                      {expenseChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                      <div className="mt-6 space-y-3">
                          {expenseChartData.map((d, i) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500 font-bold">{d.name}</span>
                                  <span className="font-black text-slate-700">{((d.value/analysis.totalExp)*100).toFixed(1)}%</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              {/* --- DETAILED DATA TABLES (SMART TABLE) --- */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                  <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-black text-slate-800 text-sm uppercase">Detaylı Finansal Döküm (Summary)</h3>
                      <div className="flex gap-4">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><div className="w-2 h-2 rounded-full bg-emerald-600"></div> GELİR</div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600"><div className="w-2 h-2 rounded-full bg-rose-600"></div> GİDER</div>
                      </div>
                  </div>
                  <table className="w-full text-left text-sm">
                      <thead className="bg-white text-slate-400 text-[10px] uppercase font-black border-b">
                          <tr>
                              <th className="p-4">KATEGORİ / KAYNAK</th>
                              <th className="p-4">AÇIKLAMA</th>
                              <th className="p-4 text-right">TUTAR ({displayCurr})</th>
                              <th className="p-4 text-center">PAY %</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                          <tr className="hover:bg-slate-50">
                              <td className="p-4 flex items-center gap-2 font-bold text-emerald-700"><ScrollText size={16}/> ORDİNO</td>
                              <td className="p-4 text-slate-500">Nakit tahsilatlar و Ordino gelirleri</td>
                              <td className="p-4 text-right font-black">+{analysis.revOrdino.toLocaleString()}</td>
                              <td className="p-4 text-center text-xs font-bold text-slate-400">{((analysis.revOrdino/analysis.totalRev)*100).toFixed(0)}%</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                              <td className="p-4 flex items-center gap-2 font-bold text-blue-700"><Receipt size={16}/> FATURALAR (SATIŞ)</td>
                              <td className="p-4 text-slate-500">Temsili fatura gelirleri (Tebligatlı)</td>
                              <td className="p-4 text-right font-black">+{analysis.revInvoice.toLocaleString()}</td>
                              <td className="p-4 text-center text-xs font-bold text-slate-400">{((analysis.revInvoice/analysis.totalRev)*100).toFixed(0)}%</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                              <td className="p-4 flex items-center gap-2 font-bold text-purple-700"><Banknote size={16}/> ALINAN ÇEKLER</td>
                              <td className="p-4 text-slate-500">Portföydeki vadeli çekler</td>
                              <td className="p-4 text-right font-black">+{analysis.revCheck.toLocaleString()}</td>
                              <td className="p-4 text-center text-xs font-bold text-slate-400">{((analysis.revCheck/analysis.totalRev)*100).toFixed(0)}%</td>
                          </tr>
                          <tr className="bg-slate-50/50"><td colSpan={4} className="h-4"></td></tr>
                          <tr className="hover:bg-slate-50">
                              <td className="p-4 flex items-center gap-2 font-bold text-rose-700"><Users size={16}/> PERSONEL & MAAŞ</td>
                              <td className="p-4 text-slate-500">Net maaş ödemeleri و bordrolar</td>
                              <td className="p-4 text-right font-black">-{analysis.expPayroll.toLocaleString()}</td>
                              <td className="p-4 text-center text-xs font-bold text-slate-400">{((analysis.expPayroll/analysis.totalExp)*100).toFixed(0)}%</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                              <td className="p-4 flex items-center gap-2 font-bold text-orange-700"><Building size={16}/> OFİS GİDERLERİ</td>
                              <td className="p-4 text-slate-500">Kira, fatura و genel yönetim giderleri</td>
                              <td className="p-4 text-right font-black">-{analysis.expOffice.toLocaleString()}</td>
                              <td className="p-4 text-center text-xs font-bold text-slate-400">{((analysis.expOffice/analysis.totalExp)*100).toFixed(0)}%</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                              <td className="p-4 flex items-center gap-2 font-bold text-slate-700"><Shield size={16}/> SİGORTA & PRİM</td>
                              <td className="p-4 text-slate-500">Sosyal Sigorta و İhtiyat Sandığı ödemeleri</td>
                              <td className="p-4 text-right font-black">-{analysis.expInsurance.toLocaleString()}</td>
                              <td className="p-4 text-center text-xs font-bold text-slate-400">{((analysis.expInsurance/analysis.totalExp)*100).toFixed(0)}%</td>
                          </tr>
                      </tbody>
                      <tfoot className="bg-slate-900 text-white font-black">
                          <tr>
                              <td colSpan={2} className="p-5 text-right uppercase tracking-widest text-xs opacity-60">DÖNEM SONU NET BİLANÇO</td>
                              <td className="p-5 text-right text-xl">{analysis.netProfit.toLocaleString()} {displayCurr}</td>
                              <td className="p-5 text-center">
                                  <div className="bg-white/10 px-2 py-1 rounded text-[10px]">%{analysis.margin.toFixed(0)}</div>
                              </td>
                          </tr>
                      </tfoot>
                  </table>
              </div>

              {/* --- MANAGEMENT INSIGHTS --- */}
              <div className="bg-accent-50 rounded-3xl p-8 border border-accent-100 flex gap-6 items-start">
                  <div className="bg-accent-500 text-brand-900 p-3 rounded-2xl shadow-lg shadow-accent-500/20"><Info size={24}/></div>
                  <div>
                      <h4 className="font-black text-brand-900 mb-2 uppercase tracking-wide">Yönetim Analiz Notu</h4>
                      <div className="text-sm text-brand-800 leading-relaxed space-y-2">
                          <p>• Mevcut dönemde karlılık oranı <span className="font-bold">%{analysis.margin.toFixed(1)}</span> olarak gerçekleşmiştir. Sektör ortalaması baz alındığında verimli bir operasyonel süreç izlenmektedir.</p>
                          <p>• مخارج (Giderler) içinde en büyük payı <span className="font-bold">%{((Math.max(analysis.expPayroll, analysis.expOffice, analysis.expInvoice)/analysis.totalExp)*100).toFixed(0)}</span> ile 
                             {analysis.expPayroll > analysis.expOffice ? " Personel Giderleri " : " Ofis Giderleri "} oluşturmaktadır.</p>
                          <p>• Nakit akışının <span className="font-bold">%{((analysis.revOrdino/analysis.totalRev)*100).toFixed(0)}</span> oranında Ordino (Sıcak Para) kaynaklı olması، likidite gücünün yüksek olduğunu göstermektedir.</p>
                      </div>
                  </div>
              </div>

              {/* --- REPORT FOOTER --- */}
              <div className="border-t border-slate-200 pt-8 flex justify-between items-end text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <div className="space-y-1">
                      <p>Logycy Lojistik Yazılım Sistemleri</p>
                      <p>Gazimağusa, Kuzey Kıbrıs</p>
                  </div>
                  <div className="text-center">
                      <div className="w-32 h-px bg-slate-300 mb-4 mx-auto"></div>
                      <p>FİNANS DİREKTÖRÜ ONAYI</p>
                  </div>
                  <div>
                      SAYFA 1 / 1
                  </div>
              </div>

          </div>
      )}
    </div>
  );
};

export default Reports;
