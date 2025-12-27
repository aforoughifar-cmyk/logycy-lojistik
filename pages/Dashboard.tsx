
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, Package, Users, DollarSign, Activity, ArrowRight, Truck, RefreshCw, Coins, Zap, FileText, Box, AlertTriangle, Loader2, Download, Banknote, Calendar as CalendarIcon, CheckSquare, Clock, BarChart3, Circle, CheckCircle2 } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useStore } from '../store/useStore';
import CalendarWidget from '../components/CalendarWidget';
import { CalendarEvent, Task } from '../types';
import toast from 'react-hot-toast';
import { useDashboardStats, useTasks, useFinanceItems, useExpenses, useEmployees } from '../hooks/useQueries';
import { usePWA } from '../hooks/usePWA';

const Dashboard: React.FC = () => {
  const { currencyRates, fetchLiveRates } = useStore();
  const navigate = useNavigate();
  const [updatingRates, setUpdatingRates] = useState(false);
  const [chartCurrency, setChartCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'TRY'>('USD');
  const [forecastCurrency, setForecastCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'TRY'>('USD');
  
  // New: Forecast Data State
  const [forecastRawData, setForecastRawData] = useState<any[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(true);

  // PWA Hook
  const { isInstallable, installApp } = usePWA();
  
  // Calendar State
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  // --- REACT QUERY HOOKS (Parallel Fetching & Caching) ---
  const { data: statsData, isLoading: loadingStats } = useDashboardStats();
  const { data: tasksData, isLoading: loadingTasks, refetch: refetchTasks } = useTasks();
  const { data: financeData, isLoading: loadingFinance } = useFinanceItems();
  const { data: expensesData, isLoading: loadingExpenses } = useExpenses();
  const { data: employeesData, isLoading: loadingEmployees } = useEmployees();

  const isLoading = loadingStats || loadingTasks || loadingFinance || loadingExpenses || loadingEmployees;

  // --- Fetch Forecast Logic ---
  useEffect(() => {
      const loadForecast = async () => {
          setLoadingForecast(true);
          const res = await supabaseService.getCashFlowForecast();
          if (res.data) setForecastRawData(res.data);
          setLoadingForecast(false);
      };
      loadForecast();
  }, []);

  // --- Process Forecast Data for Chart based on Selected Currency ---
  const forecastChartData = useMemo(() => {
      return forecastRawData.map(week => ({
          name: week.name,
          income: week.breakdown?.[forecastCurrency]?.income || 0,
          expense: week.breakdown?.[forecastCurrency]?.expense || 0,
      }));
  }, [forecastRawData, forecastCurrency]);

  const forecastSummary = useMemo(() => {
      return forecastChartData.reduce((acc, week) => ({
          income: acc.income + week.income,
          expense: acc.expense + week.expense
      }), { income: 0, expense: 0 });
  }, [forecastChartData]);

  // --- Derived State ---
  const stats = useMemo(() => {
      return statsData || {
        totalShipments: 0,
        activeShipments: 0,
        totalCustomers: 0,
        financial: { estimatedProfitUSD: 0, byCurrency: {} },
        recentActivity: [],
        actionItems: { upcomingChecks: [], delayedShipments: [], overdueTasks: [] }
      };
  }, [statsData]);

  // Specific Action Items from Stats
  const actionItems = stats.actionItems || { upcomingChecks: [], delayedShipments: [], overdueTasks: [] };

  const expiringPermits = useMemo(() => {
      if (!employeesData) return [];
      const today = new Date();
      return employeesData
        .filter(e => e.isActive && e.hasWorkPermit && e.workPermitEndDate)
        .map(e => {
            const endDate = new Date(e.workPermitEndDate!);
            const diffTime = endDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { name: e.fullName, daysLeft: diffDays, endDate };
        })
        .filter(item => item.daysLeft <= 30) // Show expiring or recently expired
        .sort((a,b) => a.daysLeft - b.daysLeft);
  }, [employeesData]);

  // Combine Finance & Expenses for Chart
  const combinedFinance = useMemo(() => {
      let all = [];
      if (financeData) all = [...financeData];
      if (expensesData) {
          const mapped = expensesData.map((e: any) => ({
              ...e,
              type: 'gider',
              created_at: e.date, 
              source: 'office'
          }));
          all = [...all, ...mapped];
      }
      return all;
  }, [financeData, expensesData]);

  // --- Calendar Fetching ---
  useEffect(() => {
      const fetchEvents = async () => {
          const evts = await supabaseService.getEvents(calendarMonth.year, calendarMonth.month);
          setCalendarEvents(evts);
      };
      fetchEvents();
  }, [calendarMonth]);

  const handleAddNote = async (date: string, title: string, desc: string) => {
      await supabaseService.addNote({ date, title, description: desc });
      toast.success('Not eklendi');
      const evts = await supabaseService.getEvents(calendarMonth.year, calendarMonth.month);
      setCalendarEvents(evts);
  };

  const handleUpdateRates = async () => {
      setUpdatingRates(true);
      try {
          await fetchLiveRates();
          toast.success("Kurlar güncellendi (Frankfurter API)");
      } catch (e) {
          toast.error("Kur güncellemesi başarısız.");
      } finally {
          setUpdatingRates(false);
      }
  };

  const toggleTaskStatus = async (id: string, current: boolean) => {
      await supabaseService.toggleTask(id, !current);
      refetchTasks();
      toast.success(current ? 'Görev geri alındı' : 'Görev tamamlandı');
  };

  // --- Dynamic Chart Data Calculation (Past 7 Days) ---
  const chartData = useMemo(() => {
    const days = 7;
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const displayDay = d.toLocaleDateString('tr-TR', { weekday: 'short' });

        const dayItems = combinedFinance.filter(item => 
            (item.created_at || '').startsWith(dateStr) && 
            item.currency === chartCurrency
        );

        const income = dayItems.filter(item => item.type === 'gelir').reduce((sum, item) => sum + Number(item.amount), 0);
        const expense = dayItems.filter(item => item.type === 'gider').reduce((sum, item) => sum + Number(item.amount), 0);

        data.push({
            name: displayDay,
            date: dateStr,
            income: income,
            expense: expense
        });
    }
    return data;
  }, [combinedFinance, chartCurrency]);

  const kpiCards = [
    { label: 'Toplam Sevkiyat', value: stats.totalShipments, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Aktif Operasyon', value: stats.activeShipments, icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Müşteri Sayısı', value: stats.totalCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black text-brand-900 tracking-tight">Yönetim Paneli</h1>
          <p className="text-slate-500 mt-1 font-medium">Kuzey Kıbrıs Lojistik Operasyon Merkezi</p>
        </div>
        
        <div className="flex items-center gap-2">
            {isInstallable && (
                <button 
                    onClick={installApp}
                    className="flex items-center gap-2 bg-brand-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg hover:bg-brand-800 transition animate-pulse-slow"
                >
                    <Download size={16} /> Uygulamayı Yükle
                </button>
            )}

            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm h-[34px]">
              <span className={clsx("w-2 h-2 rounded-full", isLoading ? "bg-orange-500 animate-bounce" : "bg-green-500 animate-pulse")}></span>
              <span>{isLoading ? 'Güncelleniyor...' : 'Sistem Online'}</span>
            </div>
        </div>
      </div>

      {/* --- ACTION REQUIRED PANEL --- */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-6 bg-red-500 rounded-full"></div>
              <h2 className="text-lg font-black text-brand-900 uppercase tracking-wide">Acil Durumlar & Aksiyonlar</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div onClick={() => navigate('/checks')} className="bg-white border-l-4 border-l-orange-500 rounded-r-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer group">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Ödemesi Yaklaşan (7 Gün)</p>
                          <p className={clsx("text-2xl font-black mt-1", actionItems.upcomingChecks.length > 0 ? "text-orange-600" : "text-slate-700")}>
                              {actionItems.upcomingChecks.length} <span className="text-xs font-medium text-slate-400">Çek/Senet</span>
                          </p>
                      </div>
                      <div className="bg-orange-50 p-2 rounded-lg text-orange-600 group-hover:scale-110 transition-transform">
                          <Banknote size={20} />
                      </div>
                  </div>
                  {actionItems.upcomingChecks.length > 0 ? (
                      <p className="text-xs text-orange-600 mt-2 font-medium flex items-center gap-1">
                          <Clock size={12}/> Vadesi gelen ödemeler var!
                      </p>
                  ) : (
                      <p className="text-xs text-green-600 mt-2 font-medium flex items-center gap-1">
                          <CheckSquare size={12}/> Bu hafta ödeme yok.
                      </p>
                  )}
              </div>

              <div onClick={() => navigate('/shipments')} className="bg-white border-l-4 border-l-red-500 rounded-r-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer group">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Geciken Sevkiyatlar</p>
                          <p className={clsx("text-2xl font-black mt-1", actionItems.delayedShipments.length > 0 ? "text-red-600" : "text-slate-700")}>
                              {actionItems.delayedShipments.length} <span className="text-xs font-medium text-slate-400">Dosya</span>
                          </p>
                      </div>
                      <div className="bg-red-50 p-2 rounded-lg text-red-600 group-hover:scale-110 transition-transform">
                          <AlertTriangle size={20} />
                      </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">ETA tarihi geçmiş aktif yükler.</p>
              </div>

              <div onClick={() => navigate('/staff')} className="bg-white border-l-4 border-l-purple-500 rounded-r-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer group">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Personel İzinleri</p>
                          <p className={clsx("text-2xl font-black mt-1", expiringPermits.length > 0 ? "text-purple-600" : "text-slate-700")}>
                              {expiringPermits.length} <span className="text-xs font-medium text-slate-400">Kişi</span>
                          </p>
                      </div>
                      <div className="bg-purple-50 p-2 rounded-lg text-purple-600 group-hover:scale-110 transition-transform">
                          <Users size={20} />
                      </div>
                  </div>
                  {expiringPermits.length > 0 ? (
                      <p className="text-xs text-purple-600 mt-2 font-medium truncate">{expiringPermits[0].name} ve diğerleri...</p>
                  ) : (
                      <p className="text-xs text-green-600 mt-2 font-medium">Tüm evraklar güncel.</p>
                  )}
              </div>

              <div onClick={() => navigate('/tasks')} className="bg-white border-l-4 border-l-blue-500 rounded-r-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer group">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Gecikmiş Görevler</p>
                          <p className={clsx("text-2xl font-black mt-1", actionItems.overdueTasks.length > 0 ? "text-blue-600" : "text-slate-700")}>
                              {actionItems.overdueTasks.length} <span className="text-xs font-medium text-slate-400">Görev</span>
                          </p>
                      </div>
                      <div className="bg-blue-50 p-2 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
                          <CheckSquare size={20} />
                      </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Tamamlanmamış و süresi dolmuş.</p>
              </div>
          </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-800 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center gap-2 mb-4 opacity-80">
              <Zap size={18} className="text-accent-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Hızlı İşlemler</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={() => navigate('/shipments')} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex items-center gap-3 transition group text-left">
                  <div className="bg-white/20 p-2 rounded-lg text-accent-400 group-hover:scale-110 transition-transform"><Package size={20}/></div>
                  <div><span className="block font-bold text-sm">Yeni Sevkiyat</span><span className="text-[10px] text-brand-200">Dosya Aç</span></div>
              </button>
              <button onClick={() => navigate('/customers')} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex items-center gap-3 transition group text-left">
                  <div className="bg-white/20 p-2 rounded-lg text-blue-300 group-hover:scale-110 transition-transform"><Users size={20}/></div>
                  <div><span className="block font-bold text-sm">Müşteri Ekle</span><span className="text-[10px] text-brand-200">Cari Hesap</span></div>
              </button>
              <button onClick={() => navigate('/offers')} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex items-center gap-3 transition group text-left">
                  <div className="bg-white/20 p-2 rounded-lg text-green-300 group-hover:scale-110 transition-transform"><FileText size={20}/></div>
                  <div><span className="block font-bold text-sm">Teklif Ver</span><span className="text-[10px] text-brand-200">Fiyat Çalışması</span></div>
              </button>
              <button onClick={() => navigate('/warehouse')} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex items-center gap-3 transition group text-left">
                  <div className="bg-white/20 p-2 rounded-lg text-orange-300 group-hover:scale-110 transition-transform"><Box size={20}/></div>
                  <div><span className="block font-bold text-sm">Depo Girişi</span><span className="text-[10px] text-brand-200">Mal Kabul</span></div>
              </button>
          </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loadingStats ? Array(4).fill(0).map((_, i) => (
           <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse"></div>
        )) : (
            <>
                {kpiCards.map((card, idx) => (
                <div key={idx} className={clsx("p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 bg-white group relative overflow-hidden", card.border)}>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{card.label}</p>
                            <h3 className="text-3xl font-extrabold text-slate-800">{card.value}</h3>
                        </div>
                        <div className={clsx("p-3 rounded-xl", card.bg, card.color)}>
                            <card.icon size={24} />
                        </div>
                    </div>
                    <div className={clsx("absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-125 transition-transform", card.bg)}></div>
                </div>
                ))}
                
                <div className="p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-all duration-300 bg-white group relative overflow-hidden">
                    <div className="relative z-10 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                <DollarSign size={14}/> KASA DURUMU (NET)
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-auto">
                            {['USD', 'EUR', 'GBP', 'TRY'].map((curr) => {
                                const data = stats.financial.byCurrency[curr] || { income: 0, expense: 0 };
                                const net = data.income - data.expense;
                                return (
                                    <div key={curr} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-bold text-slate-400">{curr}</span>
                                            <div className={clsx("w-1.5 h-1.5 rounded-full", net >= 0 ? "bg-emerald-500" : "bg-red-500")}></div>
                                        </div>
                                        <p className={clsx("text-sm font-extrabold truncate", net >= 0 ? "text-slate-700" : "text-red-500")}>
                                            {net.toLocaleString()}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-125 transition-transform bg-emerald-50"></div>
                </div>
            </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Charts & Activity */}
        <div className="lg:col-span-2 space-y-8">
           
           {/* FORECAST CHART */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-gradient-to-r from-slate-50 to-white gap-4">
                 <div>
                    <h3 className="font-bold text-brand-900 flex items-center gap-2">
                       <BarChart3 size={20} className="text-purple-500"/> Nakit Akış Tahmini (30 Gün)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Önümüzdeki 4 haftalık tahsilat و ödeme planı.</p>
                 </div>
                 
                 <div className="bg-white border border-slate-200 p-1 rounded-lg flex items-center shadow-sm">
                    {['USD', 'EUR', 'GBP', 'TRY'].map((curr) => (
                       <button
                          key={curr}
                          onClick={() => setForecastCurrency(curr as any)}
                          className={clsx(
                             "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                             forecastCurrency === curr ? "bg-purple-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                          )}
                       >
                          {curr}
                       </button>
                    ))}
                 </div>
              </div>
              <div className="p-6">
                 {loadingForecast ? (
                     <div className="h-[250px] flex items-center justify-center">
                         <Loader2 className="animate-spin text-slate-300" size={32}/>
                     </div>
                 ) : (
                     <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={forecastChartData} barGap={4} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10}/>
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                              <Tooltip 
                                 contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)'}}
                                 labelStyle={{fontWeight: 'bold', color: '#1e293b', marginBottom: '5px'}}
                                 formatter={(value: number) => [`${value.toLocaleString()} ${forecastCurrency}`, '']}
                              />
                              <Legend verticalAlign="top" iconType="circle" height={36}/>
                              <Bar dataKey="income" name="Gelecek Para" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                              <Bar dataKey="expense" name="Çıkacak Para" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                           </BarChart>
                        </ResponsiveContainer>
                     </div>
                 )}
              </div>
              <div className="bg-slate-50 p-3 flex justify-around text-xs border-t border-slate-100">
                  <div className="text-center">
                      <span className="block text-slate-400 font-bold uppercase">Toplam Beklenen</span>
                      <span className="text-lg font-black text-brand-900">{(forecastSummary.income).toLocaleString()} {forecastCurrency}</span>
                  </div>
                  <div className="text-center">
                      <span className="block text-slate-400 font-bold uppercase">Toplam Ödenecek</span>
                      <span className="text-lg font-black text-red-600">{(forecastSummary.expense).toLocaleString()} {forecastCurrency}</span>
                  </div>
                  <div className="text-center">
                      <span className="block text-slate-400 font-bold uppercase">Net Fark</span>
                      <span className={clsx("text-lg font-black", (forecastSummary.income - forecastSummary.expense) >= 0 ? "text-green-600" : "text-red-500")}>
                          {(forecastSummary.income - forecastSummary.expense).toLocaleString()} {forecastCurrency}
                      </span>
                  </div>
              </div>
           </div>

           {/* Historical Chart Section */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div>
                    <h3 className="font-bold text-brand-900 flex items-center gap-2">
                       <Activity size={20} className="text-accent-500"/> Geçmiş Nakit Akışı
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Son 7 günlük gerçekleşen gelir و gider.</p>
                 </div>
                 
                 <div className="bg-slate-100 p-1 rounded-lg flex items-center shadow-sm border border-slate-200">
                    {['USD', 'EUR', 'GBP', 'TRY'].map((curr) => (
                       <button
                          key={curr}
                          onClick={() => setChartCurrency(curr as any)}
                          className={clsx(
                             "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                             chartCurrency === curr ? "bg-white text-brand-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          )}
                       >
                          {curr}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="p-6">
                 <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                             <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10}/>
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                          <Tooltip 
                             contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)'}}
                             labelStyle={{fontWeight: 'bold', color: '#1e293b', marginBottom: '5px'}}
                             formatter={(value: number) => [`${value.toLocaleString()} ${chartCurrency}`, '']}
                          />
                          <Area type="monotone" dataKey="income" name="Gelir" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                          <Area type="monotone" dataKey="expense" name="Gider" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Recent Activity Table */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-bold text-brand-900 text-lg">Son İşlemler</h3>
                 <Link to="/shipments" className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">Tümünü Gör <ArrowRight size={12}/></Link>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                       <tr><th className="p-4">Ref No</th><th className="p-4">Müşteri</th><th className="p-4">Durum</th><th className="p-4 text-right">Tarih</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {loadingStats ? (
                          <tr><td colSpan={4} className="p-6 text-center text-slate-400">Yükleniyor...</td></tr>
                       ) : stats.recentActivity.length === 0 ? (
                          <tr><td colSpan={4} className="p-6 text-center text-slate-400">Kayıt yok.</td></tr>
                       ) : (
                          (stats.recentActivity || []).map((item: any) => {
                             const customers = item.customers as any;
                             const customerName = customers ? (Array.isArray(customers) ? customers[0]?.name : customers.name) : '-';
                             const statusStr: string = String(item.status || '');
                             return (
                               <tr key={item.id} className="hover:bg-slate-50 transition">
                                  <td className="p-4 font-mono font-bold text-brand-600">{String(item.reference_no || '')}</td>
                                  <td className="p-4 font-medium">{String(customerName || '-')}</td>
                                  <td className="p-4"><span className={clsx("px-2 py-1 rounded text-[10px] font-bold uppercase border", statusStr === 'Teslim Edildi' ? "bg-green-50 text-green-700 border-green-100" : statusStr === 'İptal' ? "bg-red-50 text-red-700 border-red-100" : "bg-blue-50 text-blue-700 border-blue-100")}>{statusStr}</span></td>
                                  <td className="p-4 text-right text-xs text-slate-400">{item.created_at ? new Date(String(item.created_at)).toLocaleDateString('tr-TR') : '-'}</td>
                               </tr>
                             );
                          })
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* Right Sidebar: Calendar & Currency */}
        <div className="space-y-8">
           
           <div className="h-[600px]">
               <CalendarWidget 
                  events={calendarEvents} 
                  onMonthChange={(y, m) => setCalendarMonth({ year: y, month: m })}
                  onAddNote={handleAddNote}
               />
           </div>

           {/* GÖREV YÖNETİCİSİ (Task Manager) Widget */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-brand-900 flex items-center gap-2"><CheckSquare size={18} className="text-blue-500"/> Görev Yöneticisi</h3>
                    <Link to="/tasks" className="text-[10px] font-bold text-brand-600 hover:underline uppercase">Tümü</Link>
                </div>
                <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {loadingTasks ? (
                        <div className="py-8 text-center"><Loader2 className="animate-spin text-slate-300 mx-auto" size={24}/></div>
                    ) : (tasksData || []).filter((t: Task) => !t.isCompleted).length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs italic">Aktif görev bulunmuyor.</div>
                    ) : (
                        (tasksData || []).filter((t: Task) => !t.isCompleted).slice(0, 5).map((task: Task) => (
                            <div key={task.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg group transition border border-transparent hover:border-slate-100">
                                <button onClick={() => toggleTaskStatus(task.id, task.isCompleted)} className="mt-0.5 text-slate-300 hover:text-green-500 transition">
                                    <Circle size={16}/>
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate">{task.title}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('tr-TR') : 'Süresiz'}
                                    </p>
                                </div>
                                <span className={clsx("text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase", 
                                    task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 
                                    task.priority === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                                    'bg-green-50 text-green-600 border-green-100'
                                )}>{task.priority}</span>
                            </div>
                        ))
                    )}
                </div>
           </div>

           {/* Currency Rates Display */}
           <div className="bg-brand-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Coins size={20} className="text-accent-500"/> Operasyonel Kur</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleUpdateRates}
                            className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition flex items-center gap-1"
                            disabled={updatingRates}
                        >
                            {updatingRates ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Update
                        </button>
                    </div>
                 </div>
                 <div className="space-y-3">
                    {Object.entries(currencyRates).map(([code, rate], i) => (
                       code !== 'USD' && (
                           <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition">
                              <div className="flex items-center gap-3"><div className="bg-accent-500/20 p-1.5 rounded text-accent-400 text-xs font-bold">{code} / USD</div></div>
                              <div className="text-right"><p className="font-mono font-bold text-sm">{String(rate)}</p></div>
                           </div>
                       )
                    ))}
                 </div>
              </div>
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-accent-500 rounded-full blur-[80px] opacity-20"></div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
