
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Customer, Check, Offer, Shipment, ManifestItem, Invoice, InvoiceType, InvoiceStatus } from '../types';
import { ArrowLeft, Phone, Mail, MapPin, Building2, Package, Printer, Globe, Banknote, Calendar, CheckCircle, AlertCircle, Clock, Trash2, FileText, ScrollText, X, Download, Receipt, ArrowUpRight, ArrowDownLeft, Eye, Ship, Anchor, Loader2, MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  
  // Data States
  const [shipments, setShipments] = useState<any[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQueue, setPrintQueue] = useState<{shipment: any, ordino: ManifestItem}[]>([]);
  const [printSettings, setPrintSettings] = useState<any>({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Ref for PDF Generation (Still used for "Print" button, but not for WhatsApp)
  const printRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'shipments' | 'ordinos' | 'offers' | 'checks' | 'invoices'>('shipments');

  useEffect(() => {
    if (id) loadData(id);
    const savedSettings = localStorage.getItem('invoiceSettings');
    if(savedSettings) setPrintSettings(JSON.parse(savedSettings));
  }, [id]);

  const loadData = async (customerId: string) => {
    setLoading(true);
    
    // 1. Get Customer Basic Info
    const custRes = await supabaseService.getCustomerById(customerId);
    if (!custRes.data) {
        setLoading(false);
        return;
    }
    setCustomer(custRes.data);

    // 2. Parallel fetch for related data
    const [allShipRes, offerRes, checkRes, invRes] = await Promise.all([
      supabaseService.getAllShipments(), 
      supabaseService.getOffersByCustomerId(customerId),
      supabaseService.getChecksByParty(custRes.data.name),
      supabaseService.getInvoices()
    ]);
    
    if (allShipRes.data) {
        // Filter shipments
        const relevantShipments = allShipRes.data.filter(s => 
            s.customerId === customerId || 
            (s.manifest && s.manifest.some((m: any) => m.customerId === customerId))
        );
        setShipments(relevantShipments);
    }

    if (offerRes.data) setOffers(offerRes.data);
    if (checkRes.data) setChecks(checkRes.data);
    
    if (invRes.data) {
        const custName = custRes.data.name.trim().toLowerCase();
        const relevantInvoices = invRes.data.filter(inv => 
            inv.partyName.trim().toLowerCase() === custName
        );
        setInvoices(relevantInvoices);
    }
    
    setLoading(false);
  };

  const handleDeleteCheck = async (checkId: string) => {
      if(!confirm('Bu çeki silmek istediğinize emin misiniz?')) return;
      await supabaseService.deleteCheck(checkId);
      setChecks(prev => prev.filter(c => c.id !== checkId));
      toast.success('Çek silindi');
  };

  // --- WHATSAPP HANDLER (TEXT BASED) ---
  const handleWhatsAppShare = () => {
      if (!customer || !customer.phone) {
          toast.error("Müşterinin telefon numarası kayıtlı değil.");
          return;
      }

      // 1. Calculate Totals
      const pendingChecks = checks.filter(c => c.status === 'pending');
      const openInvoices = invoices.filter(i => i.status !== InvoiceStatus.PAID);
      
      const checkTotal = pendingChecks.reduce((sum, c) => sum + c.amount, 0);
      const invoiceTotal = openInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

      // 2. Build Message
      let text = `*SAYIN ${customer.name.toUpperCase()}*\n\n`;
      text += `Hesap özetiniz aşağıdadır:\n\n`;

      if (openInvoices.length > 0) {
          text += `*📄 AÇIK FATURALAR:*\n`;
          openInvoices.slice(0, 5).forEach(inv => {
              text += `- ${inv.invoiceNo}: ${inv.totalAmount.toLocaleString()} ${inv.currency}\n`;
          });
          if (openInvoices.length > 5) text += `... ve ${openInvoices.length - 5} diğer fatura.\n`;
          text += `\n`;
      }

      if (pendingChecks.length > 0) {
          text += `*🏦 BEKLEYEN ÇEKLER:*\n`;
          pendingChecks.slice(0, 5).forEach(c => {
              text += `- ${new Date(c.dueDate).toLocaleDateString()}: ${c.amount.toLocaleString()} ${c.currency}\n`;
          });
          text += `\n`;
      }

      text += `*TOPLAM BORÇ:* ${invoiceTotal.toLocaleString()} USD (Tahmini)\n`; // Simplified currency logic
      text += `*BEKLEYEN ÇEK:* ${checkTotal.toLocaleString()} TRY (Tahmini)\n\n`;
      
      text += `Saygılarımızla,\nLOGYCY Logistics`;

      // 3. Open WhatsApp
      const phone = customer.phone.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
  };

  const getOrdinoList = () => {
      if (!customer) return [];
      return shipments.filter(s => s.manifest && s.manifest.some((m: any) => m.customerId === customer.id));
  };

  const handlePrintSingle = (shipment: any, ordino: ManifestItem) => {
      setPrintQueue([{ shipment, ordino }]);
      setShowPrintModal(true);
  };

  const handlePrintAllOrdinos = () => {
      const list = getOrdinoList();
      const queue: {shipment: any, ordino: ManifestItem}[] = [];
      list.forEach(ship => {
          const ordino = ship.manifest?.find((m: any) => m.customerId === customer?.id);
          if (ordino) queue.push({ shipment: ship, ordino });
      });
      if (queue.length === 0) { toast.error("Yazdırılacak ordino bulunamadı."); return; }
      setPrintQueue(queue);
      setShowPrintModal(true);
  };

  const handleDownloadPDF = async () => {
      if (!printRef.current) return;
      setIsGeneratingPdf(true);
      const toastId = toast.loading('PDF oluşturuluyor...');
      try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const pdf = new jsPDF('p', 'mm', 'a4');
          const elements = printRef.current.querySelectorAll('.ordino-page'); 
          for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794, windowWidth: 1200 });
              const imgData = canvas.toDataURL('image/jpeg', 0.90);
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = pdf.internal.pageSize.getHeight();
              if (i > 0) pdf.addPage();
              pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          }
          pdf.save(`${customer?.name || 'Musteri'}_Ordino_Listesi.pdf`);
          toast.success('PDF İndirildi', { id: toastId });
      } catch (error: any) {
          toast.error('PDF oluşturulamadı: ' + error.message, { id: toastId });
      } finally {
          setIsGeneratingPdf(false);
      }
  };

  // Helper Functions
  const cleanDescription = (desc: string) => desc ? desc.replace(/BRAND NAME:/gi, '').trim() : '';
  
  if (loading) return <div className="p-10 text-center text-slate-500">Yükleniyor...</div>;
  if (!customer) return <div className="p-10 text-center text-red-500 font-bold">Müşteri bulunamadı.</div>;

  // -- Calculations --
  const revenueByCurrency: Record<string, number> = {};
  const invoicedManifestItemIds = new Set<string>();
  invoices.forEach(inv => {
      if (inv.type === InvoiceType.SALE) {
          const curr = inv.currency || 'USD';
          revenueByCurrency[curr] = (revenueByCurrency[curr] || 0) + (inv.totalAmount || 0);
          if (inv.shipmentDetails?.ordinoManifestItemId) invoicedManifestItemIds.add(inv.shipmentDetails.ordinoManifestItemId);
      }
  });
  const ordinoRevenueByCurrency: Record<string, number> = {};
  shipments.forEach(ship => {
      if (ship.manifest) {
          ship.manifest.forEach((m: any) => {
              if (m.customerId === customer?.id && m.savedFees) {
                  if (invoicedManifestItemIds.has(m.id)) return; 
                  const totalFees = (m.savedFees.navlun || 0) + (m.savedFees.tahliye || 0) + (m.savedFees.exworks || 0);
                  const curr = m.savedFees.currency || 'USD';
                  if (totalFees > 0) ordinoRevenueByCurrency[curr] = (ordinoRevenueByCurrency[curr] || 0) + totalFees;
              }
          });
      }
  });
  const finalRevenueByCurrency: Record<string, number> = { ...revenueByCurrency };
  Object.entries(ordinoRevenueByCurrency).forEach(([curr, amount]) => {
      finalRevenueByCurrency[curr] = (finalRevenueByCurrency[curr] || 0) + amount;
  });
  const checkTotals: Record<string, {in: number, out: number}> = {};
  checks.forEach(chk => {
      if (chk.status !== 'pending') return;
      const curr = chk.currency;
      if (!checkTotals[curr]) checkTotals[curr] = { in: 0, out: 0 };
      if (chk.type === 'in') checkTotals[curr].in += chk.amount;
      else checkTotals[curr].out += chk.amount;
  });
  const pendingOffersCount = offers.filter(o => o.status === 'Gönderildi' || o.status === 'Taslak').length;

  const CurrencyRows = ({ data }: { data: Record<string, number> }) => (
      <div className="space-y-1">
          {Object.entries(data).length === 0 && <span className="text-sm opacity-50">Henüz gelir kaydı yok.</span>}
          {Object.entries(data).map(([curr, val]) => (
              <div key={curr} className="flex justify-between items-center text-sm">
                  <span className="font-bold opacity-70 w-10">{curr}</span>
                  <span className="font-mono font-bold">{val.toLocaleString()}</span>
              </div>
          ))}
      </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/customers')} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition shadow-sm bg-white border border-slate-100">
            <ArrowLeft size={20} />
          </button>
          <div>
             <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-3">
               {customer.name}
               <span className="text-xs px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold uppercase tracking-wider">
                 {customer.type}
               </span>
             </h1>
             <p className="text-slate-500 text-sm">Müşteri Kartı ve Hesap Detayları</p>
          </div>
        </div>
        
        {/* Main Actions */}
        <div className="flex gap-2">
            <button 
              onClick={handleWhatsAppShare}
              className="bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 transition flex items-center gap-2 font-bold shadow-lg shadow-green-600/20"
            >
              <MessageCircle size={18} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button 
              onClick={() => window.print()}
              className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 font-bold shadow-sm"
            >
              <Printer size={18} /> <span className="hidden sm:inline">Yazdır</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Profile Card (Left) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
             <div className="flex items-center justify-center mb-6 relative z-10">
               <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center text-brand-900 border-4 border-white shadow-lg">
                  {customer.type === 'acente' ? <Globe size={40} /> : <Building2 size={40} />}
               </div>
             </div>
             <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-3 text-slate-700 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Phone size={18} className="text-slate-400"/>
                  <span className="font-medium text-sm">{customer.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Mail size={18} className="text-slate-400"/>
                  <span className="font-medium text-sm truncate">{customer.email || '-'}</span>
                </div>
                <div className="flex items-start gap-3 text-slate-700 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <MapPin size={18} className="text-slate-400 mt-1"/>
                  <span className="font-medium text-sm">{customer.address || '-'}</span>
                </div>
             </div>
          </div>
          
          <div className="bg-brand-900 text-white rounded-2xl shadow-xl p-6 relative overflow-hidden group">
             <div className="relative z-10">
                <p className="text-brand-200 text-xs font-bold uppercase tracking-wider mb-2">TOPLAM GELİR</p>
                <CurrencyRows data={finalRevenueByCurrency} />
             </div>
             <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40 bg-accent-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
          </div>
        </div>

        {/* Main Content (Right) */}
        <div className="lg:col-span-3">
          
          {/* Summary Mini Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[120px]">
                <div className="flex justify-between items-start mb-2">
                   <p className="text-xs font-bold text-slate-400 uppercase">BEKLEYEN TEKLİFLER</p>
                   <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FileText size={20}/></div>
                </div>
                <div>
                   <span className="text-3xl font-black text-slate-800">{pendingOffersCount}</span>
                   <span className="text-xs text-slate-400 ml-1">Adet</span>
                </div>
             </div>

             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[120px]">
                <div className="flex justify-between items-start mb-2">
                   <p className="text-xs font-bold text-slate-400 uppercase">BEKLEYEN ÇEKLER</p>
                   <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Banknote size={20}/></div>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-24 text-sm">
                   {Object.keys(checkTotals).length === 0 && <span className="text-slate-400 text-xs">Kayıt yok.</span>}
                   {Object.entries(checkTotals).map(([curr, val]) => (
                       <div key={curr} className="flex justify-between items-center border-b border-slate-50 pb-1 last:border-0">
                           <span className="font-bold text-slate-600 w-8">{curr}</span>
                           <div className="flex gap-3 font-mono">
                               <span className="text-green-600">+{val.in.toLocaleString()}</span>
                               <span className="text-red-500">-{val.out.toLocaleString()}</span>
                           </div>
                       </div>
                   ))}
                </div>
             </div>
          </div>

          {/* TABS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
            <div className="flex border-b border-slate-100 overflow-x-auto">
               <button onClick={() => setActiveTab('shipments')} className={clsx("px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap", activeTab === 'shipments' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:text-slate-700")}><Package size={18} /> Sevkiyatlar <span className="bg-slate-200 px-2 py-0.5 rounded-full text-xs ml-1">{shipments.length}</span></button>
               <button onClick={() => setActiveTab('ordinos')} className={clsx("px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap", activeTab === 'ordinos' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:text-slate-700")}><ScrollText size={18} /> Ordinolar <span className="bg-slate-200 px-2 py-0.5 rounded-full text-xs ml-1">{getOrdinoList().length}</span></button>
               <button onClick={() => setActiveTab('invoices')} className={clsx("px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap", activeTab === 'invoices' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:text-slate-700")}><Receipt size={18} /> Faturalar <span className="bg-slate-200 px-2 py-0.5 rounded-full text-xs ml-1">{invoices.length}</span></button>
               <button onClick={() => setActiveTab('offers')} className={clsx("px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap", activeTab === 'offers' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:text-slate-700")}><FileText size={18} /> Teklifler <span className="bg-slate-200 px-2 py-0.5 rounded-full text-xs ml-1">{offers.length}</span></button>
               <button onClick={() => setActiveTab('checks')} className={clsx("px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap", activeTab === 'checks' ? "border-brand-600 text-brand-900 bg-slate-50" : "border-transparent text-slate-500 hover:text-slate-700")}><Banknote size={18} /> Çek / Senet <span className="bg-slate-200 px-2 py-0.5 rounded-full text-xs ml-1">{checks.length}</span></button>
            </div>
            
            <div className="flex-1 p-0">
              
              {/* TAB CONTENT: SHIPMENTS */}
              {activeTab === 'shipments' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100"><tr><th className="p-4 font-bold text-xs uppercase">Referans</th><th className="p-4 font-bold text-xs uppercase">Tür</th><th className="p-4 font-bold text-xs uppercase">Rota</th><th className="p-4 font-bold text-xs uppercase">Durum</th><th className="p-4 font-bold text-xs uppercase text-right">Gelirler</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {shipments.length === 0 ? <tr><td colSpan={5} className="p-12 text-center text-slate-400">Kayıt bulunamadı.</td></tr> : shipments.map((ship) => (
                          <tr key={ship.id} className="hover:bg-slate-50 transition group">
                            <td className="p-4"><Link to={`/shipments/${ship.id}`} className="font-mono font-bold text-brand-600 hover:underline">{ship.referenceNo}</Link></td>
                            <td className="p-4">{ship.isPartial ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">ORDİNO</span> : <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">MASTER</span>}</td>
                            <td className="p-4"><div className="flex items-center gap-2 font-medium text-slate-700"><span className="truncate max-w-[80px]">{ship.origin}</span>→<span className="truncate max-w-[80px]">{ship.destination}</span></div></td>
                            <td className="p-4"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${ship.status === 'Teslim Edildi' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>{ship.status}</span></td>
                            <td className="p-4 text-right font-bold text-slate-700">{ship.revenueByCurrency && Object.keys(ship.revenueByCurrency).length > 0 ? <div className="flex flex-col items-end gap-1">{Object.entries(ship.revenueByCurrency).map(([c, v]: any) => <span key={c} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{v.toLocaleString()} {c}</span>)}</div> : <span className="text-slate-300">-</span>}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB CONTENT: ORDINOS */}
              {activeTab === 'ordinos' && (
                  <div className="flex flex-col h-full">
                      <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-end">
                          <button onClick={handlePrintAllOrdinos} className="bg-brand-900 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-brand-800 transition shadow-sm"><Printer size={14} /> Tümünü Yazdır (PDF)</button>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100"><tr><th className="p-4 font-bold text-xs uppercase">Ordino No</th><th className="p-4 font-bold text-xs uppercase">Dosya Ref</th><th className="p-4 font-bold text-xs uppercase">B/L No</th><th className="p-4 font-bold text-xs uppercase">Mal Cinsi</th><th className="p-4 font-bold text-xs uppercase text-right">Tutar</th><th className="p-4 text-right">İşlemler</th></tr></thead>
                              <tbody className="divide-y divide-slate-50">
                                  {getOrdinoList().length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-400">Ordino kaydı bulunamadı.</td></tr> : getOrdinoList().map((ship) => {
                                          const ordino = ship.manifest?.find((m: any) => m.customerId === customer.id);
                                          if (!ordino) return null;
                                          const total = (ordino.savedFees?.navlun || 0) + (ordino.savedFees?.tahliye || 0) + (ordino.savedFees?.exworks || 0);
                                          const curr = ordino.savedFees?.currency || 'USD';
                                          return (
                                              <tr key={ship.id + ordino.id} className="hover:bg-slate-50 transition group">
                                                  <td className="p-4 font-mono font-bold text-slate-800">{ordino.ordinoNo || '-'}</td>
                                                  <td className="p-4"><Link to={`/shipments/${ship.id}`} className="text-brand-600 hover:underline font-mono">{ship.referenceNo}</Link></td>
                                                  <td className="p-4 font-mono text-slate-500">{ordino.blNo || ship.bookingNo || '-'}</td>
                                                  <td className="p-4 text-slate-600">{ordino.goods?.map((g: any, i: number) => <div key={i} className="text-xs">{g.quantity} {g.packageType} - {cleanDescription(g.description)}</div>)}</td>
                                                  <td className="p-4 text-right font-bold text-green-600">{total.toLocaleString()} {curr}</td>
                                                  <td className="p-4 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => handlePrintSingle(ship, ordino)} className="p-2 text-slate-400 hover:text-brand-900 hover:bg-slate-100 rounded transition" title="Yazdır"><Printer size={16}/></button><Link to={`/shipments/${ship.id}`} className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold hover:bg-slate-200">Görüntüle</Link></div></td>
                                              </tr>
                                          );
                                      })}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {/* TAB CONTENT: INVOICES */}
              {activeTab === 'invoices' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="p-4 font-bold text-xs uppercase">Fatura No</th>
                        <th className="p-4 font-bold text-xs uppercase">Tarih</th>
                        <th className="p-4 font-bold text-xs uppercase">Vade</th>
                        <th className="p-4 font-bold text-xs uppercase text-right">Tutar</th>
                        <th className="p-4 font-bold text-xs uppercase text-center">Durum</th>
                        <th className="p-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {invoices.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-slate-400">Fatura bulunamadı.</td></tr>
                      ) : (
                        invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-bold text-brand-900">{inv.invoiceNo}</td>
                            <td className="p-4 text-slate-500">{new Date(inv.issueDate).toLocaleDateString('tr-TR')}</td>
                            <td className="p-4 text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : '-'}</td>
                            <td className="p-4 text-right font-bold text-slate-700">{inv.totalAmount.toLocaleString()} {inv.currency}</td>
                            <td className="p-4 text-center">
                              <span className={clsx("px-2 py-1 rounded text-[10px] font-bold uppercase", 
                                inv.status === InvoiceStatus.PAID ? "bg-green-100 text-green-700" : 
                                inv.status === InvoiceStatus.PARTIAL ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700")}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <Link to={`/invoices/${inv.id}`} className="text-brand-600 hover:underline font-bold text-xs">Görüntüle</Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB CONTENT: OFFERS */}
              {activeTab === 'offers' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="p-4 font-bold text-xs uppercase">Tarih</th>
                        <th className="p-4 font-bold text-xs uppercase">Rota</th>
                        <th className="p-4 font-bold text-xs uppercase">Açıklama</th>
                        <th className="p-4 font-bold text-xs uppercase text-right">Tutar</th>
                        <th className="p-4 font-bold text-xs uppercase text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {offers.length === 0 ? (
                        <tr><td colSpan={5} className="p-12 text-center text-slate-400">Teklif bulunamadı.</td></tr>
                      ) : (
                        offers.map((offer) => (
                          <tr key={offer.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 text-slate-500">{new Date(offer.created_at || '').toLocaleDateString('tr-TR')}</td>
                            <td className="p-4 font-medium">{offer.origin} → {offer.destination}</td>
                            <td className="p-4 text-slate-600 truncate max-w-[200px]">{offer.description}</td>
                            <td className="p-4 text-right font-bold text-brand-900">{offer.price.toLocaleString()} {offer.currency}</td>
                            <td className="p-4 text-center">
                              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase">{offer.status}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB CONTENT: CHECKS */}
              {activeTab === 'checks' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="p-4 font-bold text-xs uppercase">Vade Tarihi</th>
                        <th className="p-4 font-bold text-xs uppercase">Tip</th>
                        <th className="p-4 font-bold text-xs uppercase">Banka / Ref</th>
                        <th className="p-4 font-bold text-xs uppercase text-right">Tutar</th>
                        <th className="p-4 font-bold text-xs uppercase text-center">Durum</th>
                        <th className="p-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {checks.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-slate-400">Çek kaydı bulunamadı.</td></tr>
                      ) : (
                        checks.map((check) => (
                          <tr key={check.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-bold text-slate-700">{new Date(check.dueDate).toLocaleDateString('tr-TR')}</td>
                            <td className="p-4">
                               <span className={clsx("text-[10px] font-bold px-2 py-1 rounded uppercase", check.type === 'in' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                  {check.type === 'in' ? 'ALINAN' : 'VERİLEN'}
                               </span>
                            </td>
                            <td className="p-4 text-slate-600">
                               <div>{check.bankName}</div>
                               <div className="text-xs text-slate-400">{check.referenceNo}</div>
                            </td>
                            <td className="p-4 text-right font-black text-slate-800">{check.amount.toLocaleString()} {check.currency}</td>
                            <td className="p-4 text-center">
                               <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold uppercase">{check.status === 'pending' ? 'BEKLİYOR' : check.status}</span>
                            </td>
                            <td className="p-4 text-right">
                               <button onClick={() => handleDeleteCheck(check.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* PRINT MODAL */}
      {showPrintModal && printQueue.length > 0 && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-0 backdrop-blur-sm overflow-auto print:absolute print:top-0 print:left-0 print:w-full print:h-auto print:z-[9999] print:bg-white print:block">
            <div className="bg-white w-[210mm] min-h-[297mm] shadow-2xl m-4 relative animate-in fade-in duration-300 print:shadow-none print:m-0 print:w-full print:h-auto print:border-none print:rounded-none mx-auto flex flex-col">
               <div className="absolute top-0 right-[-80px] p-4 flex flex-col gap-2 print:hidden fixed">
                  <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition" title="PDF İndir">{isGeneratingPdf ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}</button>
                  <button onClick={() => window.print()} className="bg-brand-600 text-white p-3 rounded-full shadow-lg hover:bg-brand-700 transition" title="Yazdır"><Printer size={24} /></button>
                  <button onClick={() => setShowPrintModal(false)} className="bg-white text-slate-700 p-3 rounded-full shadow-lg hover:bg-slate-100 transition" title="Kapat"><X size={24} /></button>
               </div>
               <div ref={printRef}>
               {printQueue.map((item, idx) => {
                   const { shipment, ordino } = item;
                   const fees = ordino.savedFees || { navlun: 0, tahliye: 0, exworks: 0, currency: 'USD' };
                   const total = (fees.navlun || 0) + (fees.tahliye || 0) + (fees.exworks || 0);
                   const currency = fees.currency || 'USD';
                   const containerRef = shipment.containers?.find((c: any) => c.id === ordino.containerId);
                   const containerNo = ordino.containerNo || containerRef?.containerNo || '';
                   return (
                       <div key={ordino.id} className="ordino-page p-12 print:p-8 font-sans text-black relative flex flex-col page-break-after-always bg-white" style={{width: '794px', minHeight: '1123px', margin: '0 auto'}}>
                            <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
                                <div className="w-1/2">
                                    <h1 className="text-2xl font-black uppercase mb-1">{printSettings.companyName || 'LOGYCY LOGISTICS'}</h1>
                                    <div className="text-[10px] space-y-0.5 font-medium"><p>{printSettings.address}</p><p>Tel: {printSettings.phone} | Email: {printSettings.email}</p></div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-xl font-bold uppercase tracking-widest">ORDİNO</h2>
                                    <p className="font-bold text-lg font-mono">{ordino.ordinoNo || 'DRAFT'}</p>
                                    <p className="text-xs">Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="mb-6 flex gap-4 text-xs">
                                    <div className="w-1/2 space-y-2">
                                        <div className="flex border-b border-gray-300 pb-1"><span className="font-bold w-24">ALICI:</span><span className="font-bold uppercase">{ordino.customerName}</span></div>
                                        <div className="flex border-b border-gray-300 pb-1"><span className="font-bold w-24">B/L NO:</span><span>{ordino.blNo || shipment.bookingNo || '-'}</span></div>
                                        <div className="flex border-b border-gray-300 pb-1"><span className="font-bold w-24">GEMİ:</span><span>{ordino.vesselName || shipment.vesselName || '-'}</span></div>
                                    </div>
                                    <div className="w-1/2 space-y-2">
                                        <div className="flex border-b border-gray-300 pb-1"><span className="font-bold w-24">KONTEYNER:</span><span className="font-bold">{containerNo}</span></div>
                                        <div className="flex border-b border-gray-300 pb-1"><span className="font-bold w-24">GÜMRÜK:</span><span>{ordino.arrivalPort || shipment.destination}</span></div>
                                        <div className="flex border-b border-gray-300 pb-1"><span className="font-bold w-24">TESCİL NO:</span><span>{ordino.tescilNo || '-'}</span></div>
                                    </div>
                                </div>
                                <div className="border-t-2 border-b-2 border-black mb-6">
                                    <table className="w-full text-xs text-left">
                                        <thead><tr className="font-bold uppercase"><th className="py-2 w-24">Marka</th><th className="py-2 w-20">Miktar</th><th className="py-2">Eşya Tanımı</th><th className="py-2 text-right w-24">Ağırlık (KG)</th></tr></thead>
                                        <tbody className="font-medium align-top">
                                            {ordino.goods?.map((g: any, i: number) => (
                                                <tr key={i} className="border-t border-dotted border-gray-300"><td className="py-2">{g.marks || '-'}</td><td className="py-2">{g.quantity} {g.packageType}</td><td className="py-2 uppercase">{cleanDescription(g.description)}</td><td className="py-2 text-right">{g.weight || '-'}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="text-xs mb-8"><p className="font-bold mb-2">NOTLAR:</p><p>Yukarıda dökümü yapılan yükün alıcısına teslim edilmesinde tarafımızca bir sakınca yoktur.</p><p>Gümrük işlemleri ve vergiler alıcı sorumluluğundadır.</p></div>
                            </div>
                            <div className="mt-auto flex justify-between items-end pt-4 border-t-2 border-black">
                                <div>
                                    <p className="text-[10px] font-bold mb-1">MASRAFLAR</p>
                                    {fees.navlun > 0 && <p className="text-xs flex justify-between w-40"><span>NAVLUN:</span> <span>{fees.navlun} {currency}</span></p>}
                                    {fees.tahliye > 0 && <p className="text-xs flex justify-between w-40"><span>TAHLİYE:</span> <span>{fees.tahliye} {currency}</span></p>}
                                    {fees.exworks > 0 && <p className="text-xs flex justify-between w-40"><span>LOKAL:</span> <span>{fees.exworks} {currency}</span></p>}
                                    <div className="border-t border-gray-400 mt-1 pt-1 w-40 flex justify-between font-bold text-sm"><span>TOPLAM:</span><span>{total.toLocaleString()} {currency}</span></div>
                                </div>
                                <div className="text-center"><p className="font-bold text-xs mb-8">KAŞE / İMZA</p><p className="font-bold uppercase text-sm">{printSettings.companyName}</p></div>
                            </div>
                       </div>
                   );
               })}
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default CustomerDetail;
