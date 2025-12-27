
import React, { useEffect, useState, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Expense, Check } from '../types';
import { Plus, Search, Calendar, DollarSign, X, Filter, Banknote, Trash2, Printer, Sparkles, Loader2, Upload, Calculator, FileText } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { GoogleGenAI } from "@google/genai";
import { useStore } from '../store/useStore';

const Expenses: React.FC = () => {
  const { definitions } = useStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [checks, setChecks] = useState<Check[]>([]); 
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'month'>('all');

  // AI Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [formData, setFormData] = useState<Partial<Expense>>({
    category: definitions.expenseCategories[0] || 'Diğer',
    description: '',
    amount: 0,
    currency: 'TRY',
    paymentMethod: 'Nakit',
    date: new Date().toISOString().slice(0, 10)
  });

  const [selectedCheckId, setSelectedCheckId] = useState('');
  const [currencyTotals, setCurrencyTotals] = useState<Record<string, number>>({});

  // Auto-calculate Total Amount when Base or Tax changes
  useEffect(() => {
      const taxAmount = baseAmount * (taxRate / 100);
      const total = baseAmount + taxAmount;
      setFormData(prev => ({ ...prev, amount: parseFloat(total.toFixed(2)) }));
  }, [baseAmount, taxRate]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
      calculateTotals();
  }, [expenses, searchTerm, dateFilter]);

  const calculateTotals = () => {
      const t: Record<string, number> = { TRY: 0, USD: 0, EUR: 0, GBP: 0 };
      filtered.forEach(e => {
          if(t[e.currency] !== undefined) t[e.currency] += e.amount;
      });
      setCurrencyTotals(t);
  };

  const loadData = async () => {
    setLoading(true);
    const [expRes, checkRes] = await Promise.all([
        supabaseService.getExpenses(),
        supabaseService.getPendingOutgoingChecks()
    ]);
    if (expRes.data) setExpenses(expRes.data);
    if (checkRes.data) setChecks(checkRes.data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    let expenseData = { ...formData };
    
    // Append Note to Description if exists
    if (notes.trim()) {
        expenseData.description = `${expenseData.description} | Not: ${notes}`;
    }

    if (formData.paymentMethod === 'Çek' && selectedCheckId) {
        const selectedCheck = checks.find(c => c.id === selectedCheckId);
        if (selectedCheck) expenseData.description = `${expenseData.description} (Çek: ${selectedCheck.referenceNo})`;
    }
    
    await supabaseService.addExpense(expenseData);
    setShowModal(false);
    
    // Reset Form
    setFormData({ category: definitions.expenseCategories[0] || 'Diğer', description: '', amount: 0, currency: 'TRY', paymentMethod: 'Nakit', date: new Date().toISOString().slice(0, 10) });
    setBaseAmount(0);
    setTaxRate(0);
    setNotes('');
    setSelectedCheckId('');
    
    loadData();
  };

  const handleDelete = async (id: string) => {
      if(!confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;
      await supabaseService.deleteExpense(id);
      toast.success('Gider silindi.');
      loadData();
  };

  const handleCheckSelection = (checkId: string) => {
      setSelectedCheckId(checkId);
      const check = checks.find(c => c.id === checkId);
      if(check) {
          setFormData(prev => ({
              ...prev,
              amount: check.amount,
              currency: check.currency as any,
              description: `Çek Ödemesi - ${check.partyName}`
          }));
          // Disable manual calc for Check
          setBaseAmount(check.amount);
          setTaxRate(0);
      }
  };

  // --- AI SCANNING LOGIC ---
  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
        const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `
            You are an expert accounting assistant. Analyze this invoice/receipt image or PDF.
            Extract the following data into a strictly valid JSON object.
            
            Fields to extract:
            - supplier: The name of the company/agency issuing the invoice.
            - date: The invoice date in YYYY-MM-DD format.
            - amount: The total amount (numeric).
            - currency: The currency code (TRY, USD, EUR, GBP). Default to TRY if not found.
            - description: A brief summary of the service/items.
            - category: Suggest a category based on the list: ${definitions.expenseCategories.join(', ')}. If unsure use "Diğer".

            Example Output:
            {
                "supplier": "MSC Shipping",
                "date": "2024-03-15",
                "amount": 1250.50,
                "currency": "USD",
                "description": "MSC Shipping - Navlun ve THC Bedeli",
                "category": "Diğer"
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: file.type, data: base64Data } }
                    ]
                }
            ],
            config: { responseMimeType: 'application/json' }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("AI did not return text.");
        
        const extracted = JSON.parse(jsonText);

        setFormData({
            category: extracted.category || definitions.expenseCategories[0] || 'Diğer',
            description: extracted.description || `Fatura: ${extracted.supplier}`,
            amount: extracted.amount || 0,
            currency: extracted.currency || 'TRY',
            paymentMethod: 'Havale',
            date: extracted.date || new Date().toISOString().slice(0, 10)
        });
        
        // Auto-fill calc fields
        setBaseAmount(extracted.amount || 0);
        setTaxRate(0);

        toast.success("Fatura tarandı! Bilgileri kontrol edip kaydedin.");
        setShowModal(true);

    } catch (error: any) {
        console.error("Scan Error:", error);
        toast.error("Tarama başarısız: " + error.message);
    } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filtered = expenses.filter(e => {
      const matchSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase());
      let matchDate = true;
      if (dateFilter === 'month') {
          const d = new Date(e.date);
          const now = new Date();
          matchDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return matchSearch && matchDate;
  });

  return (
    <div className="space-y-6 relative">
      
      {/* Scanning Overlay */}
      {isScanning && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
              <div className="relative">
                  <div className="absolute inset-0 bg-accent-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                  <Sparkles size={64} className="relative z-10 text-accent-400 animate-spin-slow" />
              </div>
              <h2 className="text-2xl font-bold mt-6 animate-pulse">Fatura Analiz Ediliyor...</h2>
              <p className="text-slate-300 mt-2">Gemini AI verileri okuyor</p>
          </div>
      )}

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,application/pdf"
      />

      {/* Print Header */}
      <div className="hidden print:block mb-8 text-center border-b border-black pb-4">
          <h1 className="text-2xl font-bold">GİDER RAPORU</h1>
          <p className="text-sm">Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
          <p className="text-xs text-gray-500">Dönem: {dateFilter === 'month' ? 'Bu Ay' : 'Tüm Zamanlar'}</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Ofis & Acente Giderleri</h1>
          <p className="text-slate-500">Operasyonel ödemeler ve fatura girişleri.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleScanClick}
                disabled={isScanning}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-xl hover:shadow-lg transition flex items-center gap-2 font-bold shadow-md border border-white/20 animate-in fade-in"
            >
                {isScanning ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} />} 
                <span className="hidden sm:inline">Fatura Tara (AI)</span>
            </button>
            <button onClick={() => window.print()} className="bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 font-bold shadow-sm">
                <Printer size={18} /> Raporla
            </button>
            <button onClick={() => { setBaseAmount(0); setTaxRate(0); setShowModal(true); }} className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold">
              <Plus size={20} /> Manuel Ekle
            </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
         {Object.entries(currencyTotals).map(([curr, val]) => (
             <div key={curr} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center print:border-black">
                 <span className="text-xs font-bold text-slate-400 uppercase mb-1">{curr} Toplam</span>
                 <span className="text-xl font-extrabold text-red-600">{(val as any).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
             </div>
         ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:border-none print:shadow-none">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between gap-4 print:hidden">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Açıklama ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
          <select 
                className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white outline-none"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
             >
                 <option value="all">Tüm Tarihler</option>
                 <option value="month">Bu Ay</option>
             </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 print:text-black">
            <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200 print:bg-gray-100 print:border-black">
              <tr>
                <th className="px-6 py-4 print:py-2">Tarih</th>
                <th className="px-6 py-4 print:py-2">Kategori</th>
                <th className="px-6 py-4 print:py-2">Açıklama</th>
                <th className="px-6 py-4 print:py-2">Ödeme Yöntemi</th>
                <th className="px-6 py-4 print:py-2 text-right">Tutar</th>
                <th className="px-6 py-4 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 print:divide-black">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center">Yükleniyor...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center">Kayıt yok.</td></tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 print:py-2 text-slate-500">{new Date(exp.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4 print:py-2"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600 print:bg-transparent print:p-0">{exp.category}</span></td>
                    <td className="px-6 py-4 print:py-2 font-medium text-slate-800">{exp.description}</td>
                    <td className="px-6 py-4 print:py-2">{exp.paymentMethod}</td>
                    <td className="px-6 py-4 print:py-2 text-right font-bold text-red-600">{exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} {exp.currency}</td>
                    <td className="px-6 py-4 print:hidden text-right">
                        <button onClick={() => handleDelete(exp.id)} className="text-slate-400 hover:text-red-500 transition"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-white font-bold text-lg">Gider Girişi</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Tarih</label>
                   <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Kategori</label>
                   <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                     {definitions.expenseCategories.map(cat => (
                         <option key={cat} value={cat}>{cat}</option>
                     ))}
                   </select>
                 </div>
              </div>
              
              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase">Ödeme Yöntemi</label>
                 <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-white" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})}>
                   <option value="Nakit">Nakit</option>
                   <option value="Havale">Banka Havalesi</option>
                   <option value="Kredi Kartı">Kredi Kartı</option>
                   <option value="Çek">Çek (Portföyden)</option>
                 </select>
              </div>

              {formData.paymentMethod === 'Çek' && (
                  <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                      <label className="text-xs font-bold text-yellow-700 uppercase flex items-center gap-1 mb-1"><Banknote size={14}/> Ödenecek Çek Seçimi</label>
                      <select 
                        className="w-full border border-yellow-200 rounded-lg p-2 text-sm outline-none bg-white"
                        value={selectedCheckId}
                        onChange={(e) => handleCheckSelection(e.target.value)}
                      >
                          <option value="">Çek Seçiniz...</option>
                          {checks.map(c => (
                              <option key={c.id} value={c.id}>
                                  {c.referenceNo} - {c.partyName} ({c.amount} {c.currency})
                              </option>
                          ))}
                      </select>
                  </div>
              )}

              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase">Firma / Başlık</label>
                 <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-white" placeholder="Örn: MSC Shipping" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><FileText size={14}/> Detaylı Not / Açıklama</label>
                 <textarea 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none h-20 resize-none bg-white" 
                    placeholder="Ek bilgiler..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                 />
              </div>
              
              {/* CALCULATOR SECTION */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-3"><Calculator size={14}/> Tutar Hesaplama</h4>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 block">Ara Toplam (Net)</label>
                          <input 
                            type="number" step="0.01"
                            disabled={formData.paymentMethod === 'Çek'}
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm font-medium"
                            value={baseAmount || ''}
                            onChange={e => setBaseAmount(parseFloat(e.target.value) || 0)}
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 block">KDV Oranı (%)</label>
                          <select 
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                            disabled={formData.paymentMethod === 'Çek'}
                            value={taxRate}
                            onChange={e => setTaxRate(parseFloat(e.target.value))}
                          >
                              <option value="0">%0 (Muaf)</option>
                              {definitions.taxRates.map(r => (
                                  <option key={r} value={r}>%{r}</option>
                              ))}
                          </select>
                      </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 block">Para Birimi</label>
                          <select 
                            className="border border-slate-200 rounded-lg p-1 text-xs font-bold bg-white" 
                            value={formData.currency} 
                            onChange={e => setFormData({...formData, currency: e.target.value as any})}
                          >
                            {definitions.currencies.map(c => (
                                <option key={c.code} value={c.code}>{c.code}</option>
                            ))}
                          </select>
                      </div>
                      <div className="text-right">
                          <span className="text-xs text-slate-500 block">GENEL TOPLAM</span>
                          <span className="text-2xl font-black text-brand-900">{formData.amount?.toLocaleString()} {formData.currency}</span>
                      </div>
                  </div>
              </div>
              
              <div className="pt-2">
                 <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
