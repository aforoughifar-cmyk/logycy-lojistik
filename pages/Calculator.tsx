import React, { useState } from 'react';
import { Calculator as CalcIcon, RefreshCw, Info } from 'lucide-react';

const Calculator: React.FC = () => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, length: 0, weight: 0 });
  const [result, setResult] = useState<{ desi: number; chargeable: number; price: number } | null>(null);
  
  const RATE_PER_KG = 85; 
  const MIN_PRICE = 150;

  const calculate = () => {
    const vol = (dimensions.width * dimensions.height * dimensions.length) / 5000;
    const desi = parseFloat(vol.toFixed(2));
    const chargeable = Math.max(desi, dimensions.weight);
    
    let price = chargeable * RATE_PER_KG;
    if (price < MIN_PRICE) price = MIN_PRICE;

    setResult({
      desi,
      chargeable,
      price: Math.ceil(price)
    });
  };

  const reset = () => {
    setDimensions({ width: 0, height: 0, length: 0, weight: 0 });
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-900">Fiyat Hesaplama Aracı</h1>
        <p className="text-slate-500">Kargo boyutlarına göre tahmini taşıma maliyetini hesaplayın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Input Form */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="font-bold text-lg mb-6 text-brand-900 flex items-center gap-3">
            <div className="p-2 bg-accent-100 rounded-lg text-accent-700"><CalcIcon size={20} /></div>
            Ölçü Bilgileri
          </h2>
          
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">En (cm)</label>
                <input 
                  type="number" 
                  value={dimensions.width || ''} 
                  onChange={e => setDimensions({...dimensions, width: Number(e.target.value)})}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition bg-slate-50 font-medium" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Boy (cm)</label>
                <input 
                  type="number" 
                  value={dimensions.length || ''} 
                  onChange={e => setDimensions({...dimensions, length: Number(e.target.value)})}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition bg-slate-50 font-medium" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Yükseklik (cm)</label>
                <input 
                  type="number" 
                  value={dimensions.height || ''} 
                  onChange={e => setDimensions({...dimensions, height: Number(e.target.value)})}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition bg-slate-50 font-medium" 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Ağırlık (kg)</label>
              <input 
                type="number" 
                value={dimensions.weight || ''} 
                onChange={e => setDimensions({...dimensions, weight: Number(e.target.value)})}
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition bg-slate-50 font-medium" 
                placeholder="Örn: 5.5"
              />
            </div>

            <div className="pt-6 flex gap-4">
              <button 
                onClick={reset}
                className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> Sıfırla
              </button>
              <button 
                onClick={calculate}
                className="flex-[2] bg-accent-500 text-brand-900 py-3.5 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-200"
              >
                Hesapla
              </button>
            </div>
          </div>
        </div>

        {/* Result Card */}
        <div className="bg-brand-900 p-8 rounded-2xl shadow-xl flex flex-col justify-center relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 w-40 h-40 bg-accent-500 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10"></div>

          {result ? (
            <div className="space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center pb-8 border-b border-white/10">
                <p className="text-brand-200 text-sm mb-2 font-medium">Tahmini Taşıma Bedeli</p>
                <div className="text-5xl font-extrabold text-accent-400">
                  ₺{result.price}
                  <span className="text-xl text-brand-300 font-normal ml-2">+ KDV</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm bg-white/5 p-3 rounded-lg">
                  <span className="text-brand-200">Hacimsel Ağırlık (Desi):</span>
                  <span className="font-mono font-bold text-white text-lg">{result.desi}</span>
                </div>
                <div className="flex justify-between items-center text-sm bg-white/5 p-3 rounded-lg">
                  <span className="text-brand-200">Gerçek Ağırlık:</span>
                  <span className="font-mono font-bold text-white text-lg">{dimensions.weight} kg</span>
                </div>
                <div className="bg-accent-500/10 border border-accent-500/20 p-4 rounded-xl flex items-start gap-3 mt-6">
                  <Info className="text-accent-400 flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-xs text-accent-100 leading-relaxed">
                    Fiyatlandırma, <strong className="text-white">{result.chargeable} kg</strong> (Ücretlendirilebilir Ağırlık) üzerinden yapılmıştır.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-brand-300 flex flex-col items-center">
              <div className="bg-white/5 p-6 rounded-full mb-6 border border-white/5">
                <CalcIcon size={40} className="text-accent-500" />
              </div>
              <p className="font-medium">Sonuçları görmek için ölçüleri girip hesapla butonuna basın.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calculator;