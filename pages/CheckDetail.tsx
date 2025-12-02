import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Check, Invoice, InvoiceType } from '../types';
import { ArrowLeft, Calendar, Printer, Banknote, User, AlertCircle, CheckCircle, Clock, Link as LinkIcon, Plus, X } from 'lucide-react';
import clsx from 'clsx';

const CheckDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [check, setCheck] = useState<Check | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Link Invoice State
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [linkAmount, setLinkAmount] = useState(0);

  // Print Settings
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    if (id) loadCheck(id);
    const saved = localStorage.getItem('invoiceSettings');
    if(saved) setSettings(JSON.parse(saved));
  }, [id]);

  const loadCheck = async (checkId: string) => {
    setLoading(true);
    const result = await supabaseService.getCheckById(checkId);
    if (result.data) {
      setCheck(result.data);
      setLinkAmount(result.data.amount); // Default to full amount
      
      // Load linked invoices
      const links = await supabaseService.getPaymentsByCheckReference(result.data.referenceNo);
      if(links.data) setLinkedPayments(links.data);
    }
    setLoading(false);
  };

  const loadAvailableInvoices = async () => {
    if(!check) return;
    const type = check.type === 'in' ? InvoiceType.SALE : InvoiceType.PURCHASE;
    const result = await supabaseService.getInvoicesByType(type);
    if(result.data) setAvailableInvoices(result.data);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!check) return;
    await supabaseService.updateCheckStatus(check.id, newStatus);
    loadCheck(check.id);
  };

  const handleLinkInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!check || !selectedInvoiceId) return;

    await supabaseService.addInvoicePayment({
        invoiceId: selectedInvoiceId,
        amount: linkAmount,
        date: new Date().toISOString().slice(0, 10),
        method: 'Çek',
        reference: `${check.referenceNo} - ${check.bankName || 'Bank'}`
    });

    setShowLinkModal(false);
    loadCheck(check.id);
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!check) return <div className="p-10 text-center text-red-500">Çek bulunamadı.</div>;

  const usedAmount = linkedPayments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = check.amount - usedAmount;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'cleared': return <span className="flex items-center gap-1 text-green-700 bg-green-100 px-3 py-1.5 rounded-lg font-bold"><CheckCircle size={16}/> Tahsil Edildi</span>;
      case 'bounced': return <span className="flex items-center gap-1 text-red-700 bg-red-100 px-3 py-1.5 rounded-lg font-bold"><AlertCircle size={16}/> Karşılıksız</span>;
      default: return <span className="flex items-center gap-1 text-orange-700 bg-orange-100 px-3 py-1.5 rounded-lg font-bold"><Clock size={16}/> Bekliyor</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/checks')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
              #{check.referenceNo}
              <span className={clsx("text-xs px-2 py-1 rounded font-bold uppercase", check.type === 'in' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                {check.type === 'in' ? 'ALINAN ÇEK' : 'VERİLEN ÇEK'}
              </span>
            </h1>
            <p className="text-slate-500">{check.partyName}</p>
          </div>
        </div>
        <button onClick={() => setShowReceiptModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-900 text-white rounded-lg font-bold hover:bg-brand-800 transition shadow-lg shadow-brand-900/20">
            <Printer size={18}/> Makbuz Yazdır
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-6 mb-6">
            <div className="flex items-center gap-4">
               <div className="p-4 bg-slate-50 rounded-xl text-slate-600">
                  <Banknote size={32} />
               </div>
               <div>
                  <p className="text-sm text-slate-500 font-bold uppercase">Çek Tutarı</p>
                  <p className="text-3xl font-extrabold text-brand-900">{check.amount.toLocaleString()} {check.currency}</p>
               </div>
            </div>
            <div className="flex flex-col items-end gap-2">
               {getStatusBadge(check.status)}
               <p className="text-xs text-slate-400">Vade: {new Date(check.dueDate).toLocaleDateString('tr-TR')}</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
               <label className="text-xs font-bold text-slate-400 block mb-1">KEŞİDECİ / LEHTAR</label>
               <div className="flex items-center gap-2 text-slate-800 font-medium">
                  <User size={16} className="text-slate-400"/> {check.partyName}
               </div>
            </div>
            <div>
               <label className="text-xs font-bold text-slate-400 block mb-1">BANKA</label>
               <div className="flex items-center gap-2 text-slate-800 font-medium">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div> {check.bankName || 'Belirtilmemiş'}
               </div>
            </div>
            <div>
               <label className="text-xs font-bold text-slate-400 block mb-1">DURUM GÜNCELLE</label>
               <select 
                 className="bg-slate-50 border border-slate-200 text-sm rounded-lg p-2 outline-none w-full font-medium"
                 value={check.status}
                 onChange={(e) => handleStatusUpdate(e.target.value)}
               >
                  <option value="pending">Bekliyor</option>
                  <option value="cleared">Tahsil Edildi / Ödendi</option>
                  <option value="bounced">Karşılıksız</option>
               </select>
            </div>
         </div>
      </div>

      {/* Linked Invoices */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <LinkIcon size={18} /> İlişkili Faturalar (Mahsup)
               </h3>
               <p className="text-xs text-slate-500 mt-1">Bu çekin kullanıldığı fatura ödemeleri.</p>
            </div>
            <div className="text-right">
               <p className="text-xs text-slate-500">Kalan Bakiye</p>
               <p className={clsx("font-bold", remainingAmount < 0 ? "text-red-600" : "text-green-600")}>
                  {remainingAmount.toLocaleString()} {check.currency}
               </p>
            </div>
         </div>

         <div className="p-6">
            {linkedPayments.length > 0 ? (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                           <th className="p-3">Fatura No</th>
                           <th className="p-3">Cari</th>
                           <th className="p-3">Tarih</th>
                           <th className="p-3 text-right">Kullanılan Tutar</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {linkedPayments.map(lp => (
                           <tr key={lp.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-brand-700">
                                 {lp.invoices?.invoice_no || '-'}
                              </td>
                              <td className="p-3">{lp.invoices?.party_name}</td>
                              <td className="p-3 text-slate-500">{new Date(lp.date).toLocaleDateString('tr-TR')}</td>
                              <td className="p-3 text-right font-bold">{lp.amount.toLocaleString()}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            ) : (
               <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                  Bu çek henüz bir faturaya bağlanmamış.
               </div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-100">
               <button 
                 onClick={() => { loadAvailableInvoices(); setShowLinkModal(true); }}
                 className="flex items-center gap-2 text-brand-600 font-bold hover:bg-brand-50 px-4 py-2 rounded-lg transition"
               >
                  <Plus size={18} /> Fatura ile İlişkilendir
               </button>
            </div>
         </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Fatura Seçimi</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleLinkInvoice} className="p-6 space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Fatura Seçiniz</label>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50"
                    value={selectedInvoiceId}
                    onChange={e => setSelectedInvoiceId(e.target.value)}
                  >
                     <option value="">Seçiniz...</option>
                     {availableInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                           {inv.invoiceNo} - {inv.partyName} ({inv.totalAmount} {inv.currency})
                        </option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Kullanılacak Tutar</label>
                  <input 
                    type="number" 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none"
                    value={linkAmount}
                    onChange={e => setLinkAmount(Number(e.target.value))}
                  />
                  <p className="text-xs text-slate-400 mt-1">Maksimum kullanılabilir: {remainingAmount}</p>
               </div>
               <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition mt-2">
                  Kaydet ve İlişkilendir
               </button>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal (Makbuz) */}
      {showReceiptModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-0 backdrop-blur-sm overflow-auto print:p-0 print:bg-white print:fixed print:inset-0 print:z-[200] print:block">
            <div className="bg-white w-full max-w-2xl min-h-[600px] shadow-2xl m-4 print:m-0 print:shadow-none print:w-full print:h-full relative animate-in fade-in duration-300">
               
               {/* Toolbar */}
               <div className="absolute top-0 right-0 p-4 flex gap-2 print:hidden">
                  <button onClick={() => window.print()} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-700 transition">
                     <Printer size={18} /> Yazdır
                  </button>
                  <button onClick={() => setShowReceiptModal(false)} className="bg-slate-200 text-slate-700 p-2 rounded-lg hover:bg-slate-300 transition">
                     <X size={20} />
                  </button>
               </div>

               {/* Receipt Content */}
               <div className="p-12 print:p-10 font-serif text-slate-900">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                     <div className="w-1/2">
                        {settings.logoUrl && <img src={settings.logoUrl} className="h-16 mb-2 object-contain" alt="Logo"/>}
                        <h2 className="font-bold text-xl uppercase" style={{color: settings.primaryColor || '#000'}}>{settings.companyName || 'LOGYCY LOGISTICS'}</h2>
                        <p className="text-xs text-slate-500 whitespace-pre-line mt-1">
                           {settings.address} {'\n'} {settings.phone}
                        </p>
                     </div>
                     <div className="text-right">
                        <h1 className="text-3xl font-extrabold uppercase tracking-widest text-slate-800">
                           {check.type === 'in' ? 'TAHSİLAT MAKBUZU' : 'TEDİYE MAKBUZU'}
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                           {check.type === 'in' ? 'COLLECTION RECEIPT' : 'PAYMENT RECEIPT'}
                        </p>
                        <p className="mt-4 font-mono font-bold text-lg">NO: {check.referenceNo}</p>
                        <p className="text-sm">Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
                     </div>
                  </div>

                  {/* Body */}
                  <div className="space-y-6">
                     <div className="flex border-b border-slate-200 pb-2">
                        <span className="w-32 font-bold text-slate-500 uppercase text-xs pt-1">SAYIN</span>
                        <span className="flex-1 font-bold text-lg">{check.partyName}</span>
                     </div>
                     
                     <div className="flex border-b border-slate-200 pb-2">
                        <span className="w-32 font-bold text-slate-500 uppercase text-xs pt-1">TUTAR</span>
                        <span className="flex-1 font-mono font-bold text-xl">{check.amount.toLocaleString()} {check.currency}</span>
                     </div>

                     <div className="flex border-b border-slate-200 pb-2">
                        <span className="w-32 font-bold text-slate-500 uppercase text-xs pt-1">AÇIKLAMA</span>
                        <span className="flex-1 italic">{check.description || 'Çek ödemesi'} - Vade: {new Date(check.dueDate).toLocaleDateString('tr-TR')} - Banka: {check.bankName}</span>
                     </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-16 flex justify-between items-end">
                     <div className="text-center w-40">
                        <p className="text-xs font-bold uppercase mb-12">TESLİM EDEN</p>
                        <div className="border-t border-slate-400 pt-1 text-xs">İmza</div>
                     </div>
                     <div className="text-center w-40">
                        <p className="text-xs font-bold uppercase mb-12">TESLİM ALAN</p>
                        <p className="font-bold text-xs mb-1">{settings.companyName}</p>
                        <div className="border-t border-slate-400 pt-1 text-xs">Kaşe / İmza</div>
                     </div>
                  </div>

               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default CheckDetail;