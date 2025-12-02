import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, Download, Filter, Search, Wallet, Building, Truck, Coins } from 'lucide-react';
import clsx from 'clsx';

const Finance: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'gelir' | 'gider'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Multi-currency Stats
  const [stats, setStats] = useState({
    TRY: { income: 0, expense: 0 },
    USD: { income: 0, expense: 0 },
    EUR: { income: 0, expense: 0 },
    GBP: { income: 0, expense: 0 },
    totalEstimatedUSD: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await supabaseService.getAllFinanceItems();
    if (result.data) {
      setItems(result.data);
      calculateStats(result.data);
    }
    setLoading(false);
  };

  const calculateStats = (data: any[]) => {
    const newStats = {
        TRY: { income: 0, expense: 0 },
        USD: { income: 0, expense: 0 },
        EUR: { income: 0, expense: 0 },
        GBP: { income: 0, expense: 0 },
        totalEstimatedUSD: 0
    };

    // Approx rates for estimation
    const rates = { TRY: 0.03, EUR: 1.08, GBP: 1.25, USD: 1 };

    data.forEach(item => {
       const curr = item.currency as keyof typeof newStats;
       const stat = newStats[curr];
       // Only process currency stats objects, skip totalEstimatedUSD number
       if (stat && typeof stat === 'object') {
           if (item.type === 'gelir') stat.income += Number(item.amount);
           if (item.type === 'gider') stat.expense += Number(item.amount);
       }
    });

    // Calculate Estimated Net in USD
    let netUSD = 0;
    (['TRY','USD','EUR','GBP'] as const).forEach(c => {
        const net = newStats[c].income - newStats[c].expense;
        netUSD += net * (rates[c] || 0);
    });
    newStats.totalEstimatedUSD = Math.round(netUSD);

    setStats(newStats);
  };

  const filteredItems = items.filter(item => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesSearch = 
      item.refNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Tarih,Kaynak,Referans No,Müşteri/Tedarikçi,Açıklama,Tip,Tutar,Para Birimi\n"
        + filteredItems.map(i => {
           const party = i.type === 'gelir' ? i.customerName : i.supplierName;
           const source = i.source === 'office' ? 'OFİS GİDERİ' : 'DOSYA';
           return `${new Date(i.created_at).toLocaleDateString()},${source},${i.refNo},"${party}","${i.description}",${i.type},${i.amount},${i.currency}`;
        }).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finans_raporu_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CurrencyCard = ({ currency, data }: { currency: string, data: { income: number, expense: number } }) => {
      const net = data.income - data.expense;
      return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="font-bold text-slate-400 text-xs bg-slate-50 px-2 py-1 rounded">{currency}</span>
                <span className={clsx("font-bold text-lg", net >= 0 ? "text-green-600" : "text-red-600")}>
                    {net > 0 ? '+' : ''}{net.toLocaleString()}
                </span>
            </div>
            <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span className="text-slate-400">Gelir</span>
                    <span className="font-medium text-slate-700">{data.income.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Gider</span>
                    <span className="font-medium text-slate-700">{data.expense.toLocaleString()}</span>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Finans Yönetimi</h1>
          <p className="text-slate-500">Tüm gelir ve gider hareketleri (Dosya ve Ofis).</p>
        </div>
        <button 
          onClick={handleExport}
          className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 font-bold shadow-sm"
        >
          <Download size={18} /> Excel İndir
        </button>
      </div>

      {/* Main KPI + Currency Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Total Estimate */}
          <div className="lg:col-span-1 bg-brand-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-center">
              <div className="relative z-10">
                  <p className="text-brand-200 text-xs font-bold uppercase mb-2">TAHMİNİ NET VARLIK (USD)</p>
                  <h3 className={clsx("text-3xl font-extrabold", stats.totalEstimatedUSD >= 0 ? "text-white" : "text-red-300")}>
                      ${stats.totalEstimatedUSD.toLocaleString()}
                  </h3>
                  <p className="text-[10px] text-brand-400 mt-2">*Yaklaşık kur değerleri üzerinden.</p>
              </div>
              <Wallet className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white opacity-5" />
          </div>

          {/* Breakdown Cards */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <CurrencyCard currency="USD" data={stats.USD} />
              <CurrencyCard currency="EUR" data={stats.EUR} />
              <CurrencyCard currency="GBP" data={stats.GBP} />
              <CurrencyCard currency="TRY" data={stats.TRY} />
          </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Ara: Ref No, Müşteri, Açıklama..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
             <button 
               onClick={() => setFilterType('all')}
               className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap", filterType === 'all' ? "bg-white shadow text-brand-900" : "text-slate-500 hover:text-slate-700")}
             >
               Tümü
             </button>
             <button 
               onClick={() => setFilterType('gelir')}
               className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap", filterType === 'gelir' ? "bg-white shadow text-green-700" : "text-slate-500 hover:text-green-600")}
             >
               <span className="w-2 h-2 rounded-full bg-green-500"></span> Gelirler
             </button>
             <button 
               onClick={() => setFilterType('gider')}
               className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap", filterType === 'gider' ? "bg-white shadow text-red-700" : "text-slate-500 hover:text-red-600")}
             >
               <span className="w-2 h-2 rounded-full bg-red-500"></span> Giderler
             </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Kaynak</th>
                <th className="px-6 py-4">Ref / Kategori</th>
                <th className="px-6 py-4">İlgili Taraf</th>
                <th className="px-6 py-4">Açıklama</th>
                <th className="px-6 py-4 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Yükleniyor...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Kayıt bulunamadı.</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {new Date(item.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          {item.source === 'office' ? (
                             <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><Building size={14}/></span>
                          ) : (
                             <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Truck size={14}/></span>
                          )}
                          <span className="font-bold text-xs uppercase text-slate-600">{item.source === 'office' ? 'OFİS' : 'DOSYA'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {item.source === 'office' ? (
                          <span className="font-mono text-slate-600">{item.refNo}</span> // 'OFİS'
                       ) : (
                          <Link to={`/shipments/${item.shipmentId}`} className="font-mono font-bold text-brand-600 hover:underline">
                            {item.refNo}
                          </Link>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       {item.type === 'gelir' ? (
                         <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-medium">{item.customerName}</span>
                            {item.source !== 'office' && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">MÜŞTERİ</span>}
                         </div>
                       ) : (
                         <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-medium">{item.supplierName}</span>
                            {item.source !== 'office' && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">TEDARİKÇİ</span>}
                         </div>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       {item.description}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className={clsx("font-bold font-mono text-base", item.type === 'gelir' ? "text-green-600" : "text-red-600")}>
                         {item.type === 'gelir' ? '+' : '-'}${item.amount.toLocaleString()} {item.currency}
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Finance;