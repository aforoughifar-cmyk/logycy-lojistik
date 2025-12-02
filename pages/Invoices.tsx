import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Invoice, InvoiceType, InvoiceStatus, Customer, Supplier } from '../types';
import { Plus, Search, Filter, Receipt, ArrowUpRight, ArrowDownLeft, Eye, X } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | InvoiceType>('all');
  const [showModal, setShowModal] = useState(false);

  // New Invoice Form
  const [formData, setFormData] = useState<Partial<Invoice>>({
    invoiceNo: '',
    type: InvoiceType.SALE,
    partyName: '',
    partyId: '',
    issueDate: '',
    dueDate: '',
    totalAmount: 0,
    currency: 'USD',
    status: InvoiceStatus.DRAFT
  });

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
    await supabaseService.createInvoice(formData);
    setShowModal(false);
    loadData();
    setFormData({ invoiceNo: '', type: InvoiceType.SALE, partyName: '', partyId: '', issueDate: '', dueDate: '', totalAmount: 0, currency: 'USD', status: InvoiceStatus.DRAFT });
  };

  const filtered = invoices.filter(i => {
    const matchesSearch = i.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || i.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || i.type === filterType;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: string) => {
     const styles = {
        [InvoiceStatus.PAID]: 'bg-green-100 text-green-700',
        [InvoiceStatus.PARTIAL]: 'bg-yellow-100 text-yellow-700',
        [InvoiceStatus.OVERDUE]: 'bg-red-100 text-red-700',
        [InvoiceStatus.DRAFT]: 'bg-slate-100 text-slate-600',
        [InvoiceStatus.SENT]: 'bg-blue-100 text-blue-700',
     };
     return <span className={clsx("px-2 py-1 rounded text-xs font-bold", styles[status] || styles[InvoiceStatus.DRAFT])}>{status}</span>;
  };

  const handlePartyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      let selectedName = '';

      if (formData.type === InvoiceType.SALE) {
          const c = customers.find(x => x.id === selectedId);
          selectedName = c ? c.name : '';
      } else {
          const s = suppliers.find(x => x.id === selectedId);
          selectedName = s ? s.name : '';
      }

      setFormData({ ...formData, partyId: selectedId, partyName: selectedName });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Faturalar</h1>
          <p className="text-slate-500">Alış ve satış faturaları takibi.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Yeni Fatura
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Filters */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Fatura No veya Firma Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
          <div className="flex gap-2">
             <button onClick={() => setFilterType('all')} className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition", filterType === 'all' ? "bg-white shadow text-brand-900" : "text-slate-500")}>Tümü</button>
             <button onClick={() => setFilterType(InvoiceType.SALE)} className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2", filterType === InvoiceType.SALE ? "bg-white shadow text-green-700" : "text-slate-500")}>
               <ArrowUpRight size={16}/> Satış
             </button>
             <button onClick={() => setFilterType(InvoiceType.PURCHASE)} className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2", filterType === InvoiceType.PURCHASE ? "bg-white shadow text-red-700" : "text-slate-500")}>
               <ArrowDownLeft size={16}/> Alış
             </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Fatura No</th>
                <th className="px-6 py-4">Tip</th>
                <th className="px-6 py-4">Cari Adı</th>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Tutar</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Yükleniyor...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Fatura bulunamadı.</td></tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{inv.invoiceNo}</td>
                    <td className="px-6 py-4">
                       {inv.type === InvoiceType.SALE ? 
                         <span className="text-green-600 font-bold flex items-center gap-1"><ArrowUpRight size={14}/> Satış</span> :
                         <span className="text-red-600 font-bold flex items-center gap-1"><ArrowDownLeft size={14}/> Alış</span>
                       }
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                        {inv.partyId && inv.type === InvoiceType.SALE ? (
                            <Link to={`/customers/${inv.partyId}`} className="hover:text-brand-600 hover:underline">
                                {inv.partyName}
                            </Link>
                        ) : inv.partyId && inv.type === InvoiceType.PURCHASE ? (
                            <Link to={`/suppliers/${inv.partyId}`} className="hover:text-brand-600 hover:underline">
                                {inv.partyName}
                            </Link>
                        ) : (
                            inv.partyName
                        )}
                    </td>
                    <td className="px-6 py-4">{new Date(inv.issueDate).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4 font-mono font-bold">{inv.totalAmount.toLocaleString()} {inv.currency}</td>
                    <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                    <td className="px-6 py-4 text-right">
                       <Link to={`/invoices/${inv.id}`} className="text-brand-600 hover:bg-brand-50 p-2 rounded inline-block"><Eye size={18}/></Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Yeni Fatura Oluştur</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
               <div className="flex gap-4 p-1 bg-slate-100 rounded-lg w-fit mx-auto mb-4">
                  <button type="button" onClick={() => setFormData({...formData, type: InvoiceType.SALE, partyName: '', partyId: ''})} className={clsx("px-6 py-2 rounded-md text-sm font-bold transition", formData.type === InvoiceType.SALE ? "bg-white shadow text-green-700" : "text-slate-500")}>Satış (Gelir)</button>
                  <button type="button" onClick={() => setFormData({...formData, type: InvoiceType.PURCHASE, partyName: '', partyId: ''})} className={clsx("px-6 py-2 rounded-md text-sm font-bold transition", formData.type === InvoiceType.PURCHASE ? "bg-white shadow text-red-700" : "text-slate-500")}>Alış (Gider)</button>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Fatura No</label>
                    <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.invoiceNo} onChange={e => setFormData({...formData, invoiceNo: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Tarih</label>
                    <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.issueDate} onChange={e => setFormData({...formData, issueDate: e.target.value})} />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Vade Tarihi</label>
                    <input type="date" className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">
                        {formData.type === InvoiceType.SALE ? 'Müşteri Seçimi' : 'Tedarikçi Seçimi'}
                    </label>
                    <select 
                        required 
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-white"
                        value={formData.partyId || ''}
                        onChange={handlePartyChange}
                    >
                        <option value="">Seçiniz...</option>
                        {formData.type === InvoiceType.SALE ? (
                            customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                        ) : (
                            suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        )}
                    </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Toplam Tutar</label>
                    <input type="number" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Para Birimi</label>
                    <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="TRY">TRY</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
               </div>
               
               <div className="pt-4">
                 <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20">Kaydet</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;