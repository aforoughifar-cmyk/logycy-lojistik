
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Shipment } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, Activity, Calendar, PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Filter, Coins, CreditCard } from 'lucide-react';
import clsx from 'clsx';

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  // Data States
  const [financials, setFinancials] = useState<any[]>([]);
  const [currencyTotals, setCurrencyTotals] = useState<Record<string, {income: number, expense: number}>>({});
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [modeData, setModeData] = useState<any[]>([]);
  const [kpi, setKpi] = useState({
    estimatedNetProfitUSD: 0,
    margin: 0,
    avgShipmentValue: 0,
    totalShipments: 0
  });

  // Demo Rates for visualization
  const RATES: Record<string, number> = { 'USD': 1, 'EUR': 1.08, 'GBP': 1.25, 'TRY': 0.03 };

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    
    // Fetch all necessary data
    const [shipmentsRes, financeRes] = await Promise.all([
        supabaseService.getAllShipments(),
        supabaseService.getAllFinanceItems()
    ]);

    if (shipmentsRes.data && financeRes.data) {
        processData(shipmentsRes.data, financeRes.data);
    }
    
    setLoading(false);
  };

  const processData = (shipments: Shipment[], finance: any[]) => {
    // Filter by Selected Year
    const yearShipments = shipments.filter(s => new Date(s.created_at!).getFullYear() === year);
    const yearFinance = finance.filter(f => new Date(f.created_at).getFullYear() === year);

    // --- 1. Multi-Currency Calculation ---
    const currTotals: Record<string, { income: number, expense: number }> = {
        'USD': { income: 0, expense: 0 },
        'EUR': { income: 0, expense: 0 },
        'GBP': { income: 0, expense: 0 },
        'TRY': { income: 0, expense: 0 },
    };

    let estTotalRevenueUSD = 0;
    let estTotalExpenseUSD = 0;

    yearFinance.forEach(f => {
        const curr = f.currency || 'USD';
        if (!currTotals[curr]) currTotals[curr] = { income: 0, expense: 0 };

        const amt = Number(f.amount);
        if (f.type === 'gelir') {
            currTotals[curr].income += amt;
            estTotalRevenueUSD += amt * (RATES[curr] || 0);
        } else {
            currTotals[curr].expense += amt;
            estTotalExpenseUSD += amt * (RATES[curr] || 0);
        }
    });

    setCurrencyTotals(currTotals);

    // KPI
    const estNetProfit = estTotalRevenueUSD - estTotalExpenseUSD;
    const margin = estTotalRevenueUSD > 0 ? (estNetProfit / estTotalRevenueUSD) * 100 : 0;
    const avgVal = yearShipments.length > 0 ? estTotalRevenueUSD / yearShipments.length : 0;

    setKpi({
        estimatedNetProfitUSD: estNetProfit,
        margin,
        avgShipmentValue: avgVal,
        totalShipments: yearShipments.length
    });

    // --- 2. Monthly Financial Trend (Estimated in USD for Chart) ---
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const monthlyStats = months.map((m, i) => {
        let mRev = 0;
        let mExp = 0;

        yearFinance.filter(f => new Date(f.created_at).getMonth() === i).forEach(f => {
            const val = Number(f.amount) * (RATES[f.currency] || 0);
            if (f.type === 'gelir') mRev += val;
            else mExp += val;
        });

        return {
            name: m,
            Gelir: Math.round(mRev),
            Gider: Math.round(mExp),
            Kar: Math.round(mRev - mExp)
        };
    });
    setFinancials(monthlyStats);

    // --- 3. Top Customers (Estimated Revenue) ---
    const customerRevenue: Record<string, number> = {};
    yearFinance.filter(f => f.type === 'gelir' && f.customerName !== '-' && f.source !== 'office').forEach(f => {
        const name = f.customerName;
        const val = Number(f.amount) * (RATES[f.currency] || 0);
        customerRevenue[name] = (customerRevenue[name] || 0) + val;
    });

    const topCustData = Object.entries(customerRevenue)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    
    setTopCustomers(topCustData);

    // --- 4. Transport Mode ---
    const modes = { deniz: 0, hava: 0, kara: 0 };
    yearShipments.forEach(s => {
        if (s.transportMode === 'deniz') modes.deniz++;
        else if (s.transportMode === 'hava') modes.hava++;
        else if (s.transportMode === 'kara') modes.kara++;
    });
    setModeData([
        { name: 'Deniz', value: modes.deniz, color: '#3b82f6' },
        { name: 'Hava', value: modes.hava, color: '#f59e0b' },
        { name: 'Kara', value: modes.kara, color: '#10b981' },
    ]);
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 tracking-tight">Finansal Analiz</h1>
          <p className="text-slate-500">Çoklu para birimi tabanlı detaylı raporlama.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition font-bold text-xs">
                {year - 1}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg font-bold text-sm">
                <Calendar size={16} /> {year}
            </div>
            <button onClick={() => setYear(year + 1)} disabled={year === new Date().getFullYear()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition font-bold text-xs disabled:opacity-30">
                {year + 1}
            </button>
        </div>
      </div>

      {/* Multi-Currency Balance Sheet Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-brand-900 flex items-center gap-2">
                  <Coins size={20} className="text-accent-500"/> Kasa / Varlık Özeti
              </h3>
              <span className="text-xs text-slate-400 font-medium">*Gerçekleşen net değerler</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
              {['USD', 'EUR', 'GBP', 'TRY'].map(curr => {
                  const data = currencyTotals[curr] || { income: 0, expense: 0 };
                  const net = data.income - data.expense;
                  return (
                      <div key={curr} className="p-6 text-center">
                          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">{curr} Bakiyesi</p>
                          <p className={clsx("text-2xl font-black mb-1", net >= 0 ? "text-slate-800" : "text-red-600")}>
                              {net.toLocaleString()} <span className="text-sm font-medium text-slate-400">{curr}</span>
                          </p>
                          <div className="flex justify-center gap-4 text-[10px] font-bold mt-3">
                              <span className="text-green-600 bg-green-50 px-2 py-1 rounded">+{data.income.toLocaleString()}</span>
                              <span className="text-red-500 bg-red-50 px-2 py-1 rounded">-{data.expense.toLocaleString()}</span>
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* KPI Cards (Estimated) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* Net Profit */}
         <div className="bg-gradient-to-br from-brand-900 to-brand-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
            <div className="relative z-10">
                <p className="text-brand-200 text-xs font-bold uppercase tracking-wider mb-1">TAHMİNİ NET KAR (USD)</p>
                <h3 className="text-3xl font-extrabold">${kpi.estimatedNetProfitUSD.toLocaleString()}</h3>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 w-fit px-2 py-1 rounded">
                    <TrendingUp size={14} /> Tüm kurlar dahil
                </div>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity transform translate-y-2 translate-x-2">
                <Activity size={100} />
            </div>
         </div>

         {/* Profit Margin */}
         <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">GENEL KAR MARJI</p>
                <h3 className={clsx("text-3xl font-extrabold", kpi.margin > 20 ? "text-emerald-600" : "text-orange-500")}>
                    %{kpi.margin.toFixed(1)}
                </h3>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all duration-1000", kpi.margin > 20 ? "bg-emerald-500" : "bg-orange-500")} style={{width: `${Math.min(kpi.margin, 100)}%`}}></div>
            </div>
         </div>

         {/* Operational Efficiency */}
         <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">ORT. DOSYA DEĞERİ</p>
            <h3 className="text-2xl font-extrabold text-blue-600 mb-1">~${kpi.avgShipmentValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            <p className="text-xs text-slate-400">Toplam {kpi.totalShipments} dosya üzerinden</p>
         </div>

         <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-center gap-2">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PieIcon size={20}/></div>
                 <div>
                     <p className="text-xs text-slate-400 font-bold uppercase">EN ÇOK KULLANILAN</p>
                     <p className="font-bold text-slate-800">Deniz Yolu</p>
                 </div>
             </div>
             <div className="flex items-center gap-3 mt-2">
                 <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CreditCard size={20}/></div>
                 <div>
                     <p className="text-xs text-slate-400 font-bold uppercase">GELİR TÜRÜ</p>
                     <p className="font-bold text-slate-800">Navlun + Lokal</p>
                 </div>
             </div>
         </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Chart: Income vs Expense Trend (USD Est) */}
         <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-brand-600" size={20}/> Finansal Trend (USD Bazlı)
                </h3>
                <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Gelir</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Gider</span>
                </div>
            </div>
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financials} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorGelir" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorGider" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                            cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}}
                        />
                        <Area type="monotone" dataKey="Gelir" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGelir)" />
                        <Area type="monotone" dataKey="Gider" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorGider)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
         </div>

         {/* Chart: Top Customers */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Users className="text-accent-500" size={20}/> Ciro Liderleri (Top 5)
            </h3>
            <div className="flex-1 min-h-[300px]">
                {topCustomers.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topCustomers} layout="vertical" margin={{ left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 600, fill: '#475569'}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                            <Bar dataKey="value" fill="#3730a3" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">Veri yok</div>
                )}
            </div>
         </div>

      </div>
    </div>
  );
};

export default Reports;
