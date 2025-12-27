
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Check } from '../types';
import { ArrowLeft, Printer, Banknote, User, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';
import clsx from 'clsx';

const CheckDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [check, setCheck] = useState<Check | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
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
    }
    setLoading(false);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!check) return;
    await supabaseService.updateCheckStatus(check.id, newStatus);
    loadCheck(check.id);
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!check) return <div className="p-10 text-center text-red-500">Çek bulunamadı.</div>;

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
