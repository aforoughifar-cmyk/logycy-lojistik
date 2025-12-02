
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Package, Users, DollarSign, Activity, ArrowRight, Truck, RefreshCw, Coins, Banknote, CheckCircle } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { Skeleton } from '../components/Skeleton';
import clsx from 'clsx';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalShipments: 0,
    activeShipments: 0,
    totalCustomers: 0,
    financial: { estimatedProfitUSD: 0, byCurrency: {} as any },
    recentActivity: [] as any[],
    upcomingChecks: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  // Mock Currency Data (Real implementation would use an API like Fixer.io)
  const [rates] = useState([
     { pair: 'USD/TRY', rate: 34.15, change: 0.25, trend: 'up' },
     { pair: 'EUR/TRY', rate: 36.80, change: -0.12, trend: 'down' },
     { pair: 'GBP/TRY', rate: 43.20, change: 0.05, trend: 'up' },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Use real service
      const result = await supabaseService.getDashboardStats();
      if (result.data) {
        setStats(result.data as any);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const cards = [
    { label: 'Toplam Dosya', value: stats.totalShipments, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', gradient: 'from-blue-50 to-white' },
    { label: 'Aktif Yükler', value: stats.activeShipments, icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50', gradient: 'from-orange-50 to-white' },
    { label: 'Müşteriler', value: stats.totalCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', gradient: 'from-purple-50 to-white' },
    { label: 'Tahmini Net Kar', value: `~$${stats.financial.estimatedProfitUSD.toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', gradient: 'from-green-50 to-white' },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">Kontrol Paneli</h1>
          <p className="text-slate-500 mt-1">Hoşgeldiniz, operasyonel süreçleriniz kontrol altında.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-sm border border-slate-200">
          <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          <span>Canlı Veri</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start">
                  <div className="space-y-3 w-full">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
              </div>
            ))
          : cards.map((card, idx) => (
              <div 
                key={idx} 
                className={clsx(
                  "p-6 rounded-2xl border border-slate-100 shadow-sm card-hover relative overflow-hidden bg-gradient-to-br",
                  card.gradient
                )}
                style={{ animation: `slideUp 0.5s ease-out ${idx * 100}ms backwards` }}
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{card.label}</p>
                    <h3 className="text-3xl font-extrabold text-slate-800">{card.value}</h3>
                  </div>
                  <div className={clsx("p-3 rounded-xl shadow-sm bg-white", card.color)}>
                    <card.icon size={24} />
                  </div>
                </div>
                {/* Decorative Background Icon */}
                <card.icon className={clsx("absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.07]", card.color)} />
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content (Left 2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Recent Activity Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-slide-up" style={{ animationDelay: '300ms' }}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <h3 className="font-bold text-brand-900 text-lg flex items-center gap-2">
                <Activity size={20} className="text-accent-500"/> Son Hareketler
              </h3>
              <Link to="/shipments" className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 group">
                Tümünü Gör <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Referans</th>
                    <th className="p-4">Müşteri</th>
                    <th className="p-4">Durum</th>
                    <th className="p-4 text-right">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i}>
                        <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="p-4"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-32" /></div></td>
                        <td className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : stats.recentActivity.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Henüz işlem yok.</td></tr>
                  ) : (
                    stats.recentActivity.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition group cursor-pointer">
                        <td className="p-4 font-mono font-bold text-brand-600 group-hover:text-brand-700">{item.reference_no}</td>
                        <td className="p-4 font-medium text-slate-800">{item.customers?.name || '-'}</td>
                        <td className="p-4">
                          <span className={clsx("px-3 py-1 rounded-full text-xs font-bold shadow-sm border", 
                             item.status === 'Teslim Edildi' ? "bg-green-50 text-green-700 border-green-100" :
                             item.status === 'Yolda (On Board)' ? "bg-blue-50 text-blue-700 border-blue-100" :
                             "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 text-right text-slate-400 text-xs">
                          {new Date(item.created_at).toLocaleDateString('tr-TR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Checks */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-slide-up" style={{ animationDelay: '400ms' }}>
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <h3 className="font-bold text-brand-900 text-lg flex items-center gap-2">
                   <Banknote size={20} className="text-red-500"/> Yaklaşan Ödemeler
                </h3>
                <Link to="/checks" className="text-sm font-bold text-brand-600 hover:text-brand-700">Yönet</Link>
             </div>
             <div className="p-6 grid gap-4">
                {loading ? (
                   Array(3).fill(0).map((_,i) => (
                      <div key={i} className="flex justify-between items-center p-4 border rounded-xl">
                         <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
                         <Skeleton className="h-6 w-24" />
                      </div>
                   ))
                ) : stats.upcomingChecks.length === 0 ? (
                   <div className="text-center py-8 text-slate-400 flex flex-col items-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <CheckCircle className="mb-2 text-green-400" size={32} />
                      <p>Yakın vadeli ödeme bulunmuyor.</p>
                   </div>
                ) : (
                   stats.upcomingChecks.map((check: any) => (
                      <div key={check.id} className="flex items-center justify-between p-4 border border-red-100 bg-gradient-to-r from-red-50/50 to-white rounded-xl hover:shadow-md transition">
                         <div className="flex items-center gap-4">
                            <div className="bg-white p-2 rounded-xl border border-red-100 text-red-500 font-bold text-xs flex flex-col items-center min-w-[50px] shadow-sm">
                               <span className="text-lg leading-none">{new Date(check.due_date).getDate()}</span>
                               <span className="text-[10px] uppercase">{new Date(check.due_date).toLocaleString('tr-TR', {month: 'short'})}</span>
                            </div>
                            <div>
                               <p className="font-bold text-brand-900">{check.party_name}</p>
                               <p className="text-xs text-slate-500">Ref: {check.reference_no}</p>
                            </div>
                         </div>
                         <p className="font-mono font-bold text-red-600 bg-white px-3 py-1 rounded-lg border border-red-100 shadow-sm">
                            {check.amount.toLocaleString()} {check.currency}
                         </p>
                      </div>
                   ))
                )}
             </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="space-y-8 animate-slide-in-right" style={{ animationDelay: '500ms' }}>
           
           {/* Currency Rates */}
           <div className="bg-brand-900 text-white rounded-2xl shadow-xl p-6 relative overflow-hidden group">
              <div className="relative z-10">
                 <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Coins size={20} className="text-accent-500"/> Döviz Kurları
                 </h3>
                 <div className="space-y-4">
                    {loading ? Array(3).fill(0).map((_, i) => (
                       <div key={i} className="flex justify-between items-center py-2 border-b border-white/10">
                          <Skeleton className="bg-white/20 h-4 w-16" />
                          <Skeleton className="bg-white/20 h-4 w-12" />
                       </div>
                    )) : rates.map((r, i) => (
                       <div key={i} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                          <div className="flex items-center gap-3">
                             <span className="font-bold text-brand-100 bg-white/10 px-2 py-1 rounded text-xs">{r.pair}</span>
                          </div>
                          <div className="text-right">
                             <p className="font-mono font-bold text-lg tracking-wider">{r.rate.toFixed(2)}</p>
                             <p className={clsx("text-[10px] flex items-center justify-end gap-1 font-bold", r.trend === 'up' ? "text-green-400" : "text-red-400")}>
                                {r.trend === 'up' ? <TrendingUp size={10}/> : <TrendingDown size={10}/>} %{Math.abs(r.change)}
                             </p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
              {/* Animated Decorative Blob */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-accent-500 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10 animate-pulse-slow"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500 rounded-full blur-[50px] opacity-20 -ml-10 -mb-10 animate-float"></div>
           </div>

           {/* Quick Actions */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-brand-900 mb-4">Hızlı İşlemler</h3>
              <div className="space-y-3">
                 <Link to="/shipments" className="flex w-full items-center justify-between bg-slate-50 hover:bg-white hover:shadow-md border border-slate-200 text-slate-700 p-4 rounded-xl font-bold text-sm transition-all group">
                    <span>+ Yeni Dosya Oluştur</span>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-brand-600 group-hover:translate-x-1 transition" />
                 </Link>
                 <Link to="/calculator" className="flex w-full items-center justify-between bg-slate-50 hover:bg-white hover:shadow-md border border-slate-200 text-slate-700 p-4 rounded-xl font-bold text-sm transition-all group">
                    <span>Navlun Hesapla</span>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-brand-600 group-hover:translate-x-1 transition" />
                 </Link>
                 <Link to="/offers" className="flex w-full items-center justify-between bg-slate-50 hover:bg-white hover:shadow-md border border-slate-200 text-slate-700 p-4 rounded-xl font-bold text-sm transition-all group">
                    <span>Teklif Hazırla</span>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-brand-600 group-hover:translate-x-1 transition" />
                 </Link>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
