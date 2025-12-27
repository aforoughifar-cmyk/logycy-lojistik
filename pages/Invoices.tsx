
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Invoice, InvoiceType, InvoiceStatus, Customer, Supplier, InvoiceItem } from '../types';
import { Plus, Search, ArrowUpRight, ArrowDownLeft, Trash2, Eye, Sparkles, Loader2, X, Save, Calculator, FileText, Filter, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';
import AdvancedSearchPanel, { FilterState } from '../components/AdvancedSearchPanel';
import { GoogleGenAI } from "@google/genai";
import { useStore } from '../store/useStore';

const Invoices: React.FC = () => {
  const { definitions } = useStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // --- ADVANCED FILTER STATE ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    dateStart: '',
    dateEnd: '',
    status: '',
    type: '',
    minAmount: '',
    maxAmount: ''
  });

  // AI Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calc States
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [formData, setFormData] = useState<Partial<Invoice>>({
    invoiceNo: '',
    type: InvoiceType.SALE,
    partyName: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    totalAmount: 0,
    currency: 'USD',
    status: InvoiceStatus.DRAFT
  });

  // Extracted Line Items State
  const [invoiceItems, setInvoiceItems] = useState<Partial<InvoiceItem>[]>([]);

  // Auto-calculate Total Amount when Base or Tax changes
  useEffect(() => {
      const taxAmount = baseAmount * (taxRate / 100);
      const total = baseAmount + taxAmount;
      setFormData(prev => ({ ...prev, totalAmount: parseFloat(total.toFixed(2)) }));
  }, [baseAmount, taxRate]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [invRes, custRes, supRes] = await Promise.all([
      supabaseService.getInvoices(),
      supabaseService.getCustomers(),
      supabaseService.getSuppliers()
    ]);

    if (invRes.data) setInvoices(invRes.data);
    if (custRes.data) setCustomers(custRes.data);
    if (supRes.data) setSuppliers(supRes.data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Calculate total from items if manual total is 0 or needs update
    const calculatedTotal = invoiceItems.reduce((acc, item) => acc + (item.total || 0), 0);
    // If user added manual items, use sum. Else use header calculation
    const finalTotal = calculatedTotal > 0 ? calculatedTotal : formData.totalAmount;

    // Save notes into shipmentDetails.notes if needed
    const shipmentDetails = { ...formData.shipmentDetails, notes: notes };

    // 2. Create Invoice Header
    const res = await supabaseService.createInvoice({
        ...formData,
        totalAmount: finalTotal,
        shipmentDetails
    });

    if (res.error) {
        toast.error('Hata: ' + res.error);
        return;
    }

    const newInvoiceId = (res.data as any)?.id;

    // 3. Create Invoice Items
    if (newInvoiceId && invoiceItems.length > 0) {
        const itemPromises = invoiceItems.map(item => 
            supabaseService.addInvoiceItem({
                invoiceId: newInvoiceId,
                description: item.description || 'Ürün/Hizmet',
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unitPrice) || 0,
                total: Number(item.total) || 0
            })
        );
        await Promise.all(itemPromises);
    }

    toast.success('Fatura ve kalemleri oluşturuldu');
    setShowModal(false);
    
    // Reset Form
    setFormData({
        invoiceNo: '',
        type: InvoiceType.SALE,
        partyName: '',
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: '',
        totalAmount: 0,
        currency: 'USD',
        status: InvoiceStatus.DRAFT
    });
    setInvoiceItems([]);
    setBaseAmount(0);
    setTaxRate(0);
    setNotes('');
    
    loadData();
  };

  const handleDelete = async (id: string) => {
      if(!confirm('Bu faturayı silmek istediğinize emin misiniz?')) return;
      await supabaseService.deleteInvoice(id);
      loadData();
  };

  // --- ITEMS MANAGEMENT ---
  const addItemRow = () => {
      setInvoiceItems([...invoiceItems, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItemRow = (index: number) => {
      const newItems = invoiceItems.filter((_, i) => i !== index);
      setInvoiceItems(newItems);
  };

  const updateItemRow = (index: number, field: keyof InvoiceItem, value: any) => {
      const newItems = [...invoiceItems];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Auto-calc total
      if (field === 'quantity' || field === 'unitPrice') {
          const qty = Number(newItems[index].quantity) || 0;
          const price = Number(newItems[index].unitPrice) || 0;
          newItems[index].total = qty * price;
      }

      setInvoiceItems(newItems);
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
            Analyze this invoice image. Extract data into JSON.
            
            Header Fields:
            - invoiceNo: The invoice number.
            - date: Date in YYYY-MM-DD format.
            - totalAmount: Numeric total.
            - currency: Currency code (USD, EUR, GBP, TRY).
            - supplierName: The name of the company issuing the invoice.
            - dueDate: Due date if available, else same as date.
            
            Line Items (Array "items"):
            - description: Item name/description.
            - quantity: Numeric quantity (default 1).
            - unitPrice: Numeric unit price.
            - total: Numeric total line amount.
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
        if (!jsonText) throw new Error("AI response empty");
        const extracted = JSON.parse(jsonText);

        let matchedName = extracted.supplierName || '';
        const lowerName = matchedName.toLowerCase();
        
        const foundSupplier = suppliers.find(s => s.name.toLowerCase().includes(lowerName) || lowerName.includes(s.name.toLowerCase()));
        if (foundSupplier) {
            matchedName = foundSupplier.name;
        } else {
            const foundCustomer = customers.find(c => c.name.toLowerCase().includes(lowerName) || lowerName.includes(c.name.toLowerCase()));
            if (foundCustomer) matchedName = foundCustomer.name;
        }

        setFormData({
            invoiceNo: extracted.invoiceNo || '',
            type: InvoiceType.PURCHASE,
            partyName: matchedName,
            issueDate: extracted.date || new Date().toISOString().slice(0, 10),
            dueDate: extracted.dueDate || extracted.date || new Date().toISOString().slice(0, 10),
            totalAmount: extracted.totalAmount || 0,
            currency: extracted.currency || 'USD',
            status: InvoiceStatus.DRAFT
        });

        // Set base amount for calculator
        setBaseAmount(extracted.totalAmount || 0);

        if (extracted.items && Array.isArray(extracted.items)) {
            setInvoiceItems(extracted.items.map((i: any) => ({
                description: i.description,
                quantity: Number(i.quantity) || 1,
                unitPrice: Number(i.unitPrice) || 0,
                total: Number(i.total) || 0
            })));
        } else {
            setInvoiceItems([{ 
                description: 'Fatura Bedeli', 
                quantity: 1, 
                unitPrice: extracted.totalAmount || 0, 
                total: extracted.totalAmount || 0 
            }]);
        }

        toast.success("Fatura tarandı! Kalemler eklendi.");
        setShowModal(true);

    } catch (error: any) {
        console.error("Scan Error", error);
        toast.error("Tarama hatası: " + error.message);
    } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filtered = useMemo(() => {
      const term = filters.searchTerm.toLowerCase();
      
      return invoices.filter(inv => {
          // 1. Text Search
          const invoiceNo = inv.invoiceNo || '';
          const partyName = inv.partyName || '';
          const matchSearch = 
              !term || 
              invoiceNo.toLowerCase().includes(term) || 
              partyName.toLowerCase().includes(term);

          // 2. Date Range
          const invDate = inv.issueDate ? new Date(inv.issueDate) : null;
          let matchDate = true;
          if (filters.dateStart) {
              matchDate = matchDate && (invDate !== null && invDate >= new Date(filters.dateStart));
          }
          if (filters.dateEnd) {
              const end = new Date(filters.dateEnd);
              end.setHours(23, 59, 59, 999);
              matchDate = matchDate && (invDate !== null && invDate <= end);
          }

          // 3. Status Filter (Payment Status)
          let matchStatus = true;
          if (filters.status) {
              if (filters.status === 'ÖDENDİ') matchStatus = inv.status === InvoiceStatus.PAID;
              else if (filters.status === 'KISMI ÖDEME') matchStatus = inv.status === InvoiceStatus.PARTIAL;
              else if (filters.status === 'ÖDENMEDİ/BEKLİYOR') matchStatus = inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.SENT;
              else if (filters.status === 'İPTAL') matchStatus = inv.status === InvoiceStatus.CANCELLED;
          }

          // 4. Type/Source Filter (Sale, Purchase, Ordino)
          let matchType = true;
          if (filters.type) {
              if (filters.type === 'SATIŞ (GELİR)') matchType = inv.type === InvoiceType.SALE;
              else if (filters.type === 'ALIŞ (GİDER)') matchType = inv.type === InvoiceType.PURCHASE;
              else if (filters.type === 'ORDİNO / LOJİSTİK') matchType = !!inv.shipmentDetails; // Check if linked to shipment
          }

          // 5. Amount Range
          let matchAmount = true;
          if (filters.minAmount) matchAmount = matchAmount && inv.totalAmount >= Number(filters.minAmount);
          if (filters.maxAmount) matchAmount = matchAmount && inv.totalAmount <= Number(filters.maxAmount);

          return matchSearch && matchDate && matchStatus && matchType && matchAmount;
      });
  }, [invoices, filters]);

  const getPartyOptions = () => {
    const customerOpts = customers.map(c => ({
      id: c.name, 
      label: c.name, 
      subLabel: c.type === 'acente' ? 'ACENTE' : 'MÜŞTERİ' 
    }));
    const supplierOpts = suppliers.map(s => ({
      id: s.name, 
      label: s.name, 
      subLabel: s.type.toUpperCase() 
    }));
    const all = [...customerOpts, ...supplierOpts];
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
    return unique;
  };

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
              <p className="text-slate-300 mt-2">Gemini AI verileri okuyor و eşleştiriyor</p>
          </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,application/pdf"
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Faturalar</h1>
          <p className="text-slate-500">Alış ve satış faturaları takibi.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleScanClick}
                disabled={isScanning}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-xl hover:shadow-lg transition flex items-center gap-2 font-bold shadow-md border border-white/20"
            >
                {isScanning ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} />} 
                <span className="hidden sm:inline">Fatura Tara (AI)</span>
            </button>
            <button 
              onClick={() => { setInvoiceItems([]); setBaseAmount(0); setTaxRate(0); setNotes(''); setShowModal(true); }}
              className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
            >
              <Plus size={20} /> Yeni Fatura
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative z-40">
        
        {/* ADVANCED FILTER TOOLBAR */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
           <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Fatura No, Cari veya Açıklama..." 
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
          
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={clsx(
                "px-4 py-2.5 rounded-xl border font-bold text-sm flex items-center gap-2 transition whitespace-nowrap",
                isFilterOpen || Object.entries(filters).some(([k, v]) => k !== 'searchTerm' && v) 
                    ? "bg-brand-50 border-brand-200 text-brand-700" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
              <Filter size={18} /> Filtrele
              {(filters.status || filters.type || filters.dateStart) && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
          </button>
        </div>

        {/* The AdvancedSearchPanel Component */}
        <AdvancedSearchPanel 
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            onSearch={setFilters}
            onClear={() => setFilters({ searchTerm:'', dateStart:'', dateEnd:'', status:'', type:'', minAmount:'', maxAmount:'' })}
            enableDate={true}
            enableAmount={true}
            enableStatus={true} 
            enableType={true}   
            statusOptions={['ÖDENDİ', 'KISMI ÖDEME', 'ÖDENMEDİ/BEKLİYOR', 'İPTAL']}
            typeOptions={['SATIŞ (GELİR)', 'ALIŞ (GİDER)', 'ORDİNO / LOJİSTİK']}
            className="top-[70px] left-4 right-4 w-auto md:w-[600px] md:left-auto md:right-4"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Fatura No</th>
                <th className="px-6 py-4">Cari / Açıklama</th>
                <th className="px-6 py-4">Tip</th>
                <th className="px-6 py-4 text-right">Tutar</th>
                <th className="px-6 py-4 text-center">Durum</th>
                <th className="px-6 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10">Yükleniyor...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10">Kayıt bulunamadı.</td></tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-slate-500">{new Date(inv.issueDate).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{inv.invoiceNo || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                        {inv.partyName || '-'}
                        {/* Logic Check for Ordino Source */}
                        {inv.shipmentDetails && (
                            <span className="ml-2 bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] border border-purple-100 font-bold">ORDİNO</span>
                        )}
                    </td>
                    <td className="px-6 py-4">
                       {inv.type === InvoiceType.SALE ? 
                         <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded w-fit border border-green-100"><ArrowDownLeft size={12}/> SATIŞ</span> :
                         <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded w-fit border border-red-100"><ArrowUpRight size={12}/> ALIŞ</span>
                       }
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                        {inv.totalAmount.toLocaleString()} {inv.currency}
                    </td>
                    <td className="px-6 py-4 text-center">
                        <span className={clsx("text-xs font-bold px-2 py-1 rounded",
                           inv.status === InvoiceStatus.PAID ? "bg-green-50 text-green-700" :
                           inv.status === InvoiceStatus.PARTIAL ? "bg-orange-50 text-orange-600" :
                           inv.status === InvoiceStatus.DRAFT ? "bg-red-50 text-red-600" :
                           "bg-blue-50 text-blue-600"
                        )}>
                            {inv.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2">
                           <Link to={`/invoices/${inv.id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Eye size={18}/></Link>
                           <button onClick={() => handleDelete(inv.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 size={18}/></button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Yeni Fatura Oluştur</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-6">
               {/* Header Fields */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fatura No</label>
                     <input required className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-slate-50 font-mono" 
                       value={formData.invoiceNo} onChange={e => setFormData({...formData, invoiceNo: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tarih</label>
                     <input type="date" required className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-slate-50" 
                       value={formData.issueDate} onChange={e => setFormData({...formData, issueDate: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tip</label>
                     <select className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-white font-bold" 
                        value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                        <option value={InvoiceType.SALE}>SATIŞ (Gelir)</option>
                        <option value={InvoiceType.PURCHASE}>ALIŞ (Gider)</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Para Birimi</label>
                     <select className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-white font-bold" 
                        value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}>
                        {definitions.currencies.map(c => (
                            <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                     </select>
                  </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cari / Firma Adı</label>
                  <SearchableSelect
                    options={getPartyOptions()}
                    value={formData.partyName || ''}
                    onChange={(val) => setFormData({...formData, partyName: val})}
                    placeholder="Müşteri veya Tedarikçi Ara..."
                    required
                  />
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><FileText size={14}/> Fatura Notu / Açıklama</label>
                 <textarea 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none h-16 resize-none bg-white" 
                    placeholder="Genel açıklamalar..." 
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
                            disabled={invoiceItems.length > 0}
                            className={clsx("w-full border border-slate-300 rounded-lg p-2 text-sm font-medium", invoiceItems.length > 0 && "bg-slate-100 text-slate-500")}
                            value={baseAmount || ''}
                            onChange={e => setBaseAmount(parseFloat(e.target.value) || 0)}
                            placeholder={invoiceItems.length > 0 ? "Kalemlerden hesaplanıyor" : "0.00"}
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 block">KDV Oranı (%)</label>
                          <select 
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
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
               </div>

               {/* LINE ITEMS TABLE */}
               <div className="bg-white border border-slate-200 rounded-xl p-4">
                   <div className="flex justify-between items-center mb-2">
                       <h4 className="font-bold text-slate-700 text-sm">Fatura Kalemleri (Opsiyonel)</h4>
                       <button type="button" onClick={addItemRow} className="text-xs bg-slate-50 border border-slate-200 px-3 py-1 rounded font-bold hover:bg-slate-100 flex items-center gap-1">
                           <Plus size={14}/> Satır Ekle
                       </button>
                   </div>
                   
                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-xs">
                           <thead className="text-slate-500 font-bold uppercase bg-slate-50">
                               <tr>
                                   <th className="p-2 rounded-l">Açıklama</th>
                                   <th className="p-2 w-20 text-center">Miktar</th>
                                   <th className="p-2 w-24 text-right">Birim Fiyat</th>
                                   <th className="p-2 w-24 text-right">Toplam</th>
                                   <th className="p-2 w-8 rounded-r"></th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {invoiceItems.map((item, idx) => (
                                   <tr key={idx} className="bg-white">
                                       <td className="p-1">
                                           <input className="w-full p-1.5 outline-none bg-transparent" placeholder="Ürün adı..." 
                                            value={item.description} onChange={e => updateItemRow(idx, 'description', e.target.value)} />
                                       </td>
                                       <td className="p-1">
                                           <input type="number" className="w-full p-1.5 outline-none bg-transparent text-center" 
                                            value={item.quantity} onChange={e => updateItemRow(idx, 'quantity', e.target.value)} />
                                       </td>
                                       <td className="p-1">
                                           <input type="number" className="w-full p-1.5 outline-none bg-transparent text-right" 
                                            value={item.unitPrice} onChange={e => updateItemRow(idx, 'unitPrice', e.target.value)} />
                                       </td>
                                       <td className="p-2 text-right font-bold text-slate-800">
                                           {(item.total || 0).toLocaleString()}
                                       </td>
                                       <td className="p-1 text-center">
                                           <button type="button" onClick={() => removeItemRow(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                       </td>
                                   </tr>
                               ))}
                               {invoiceItems.length === 0 && (
                                   <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">Kalem eklenmedi. Toplam tutarı yukarıdan girebilirsiniz.</td></tr>
                               )}
                           </tbody>
                       </table>
                   </div>
               </div>

               <div className="flex justify-end items-center gap-4 bg-slate-100 p-4 rounded-xl">
                   <span className="text-sm font-bold text-slate-500 uppercase">GENEL TOPLAM:</span>
                   <span className="text-2xl font-black text-brand-900">{formData.totalAmount?.toLocaleString()} {formData.currency}</span>
               </div>

               <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">İptal</button>
                  <button type="submit" className="flex-1 bg-brand-900 text-white py-3 rounded-xl font-bold hover:bg-brand-800 shadow-lg flex items-center justify-center gap-2">
                      <Save size={18}/> Faturayı Kaydet
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
