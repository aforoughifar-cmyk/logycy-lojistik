
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Shipment, ShipmentStatus, Container, FinanceItem, ShipmentHistory, ShipmentDocument, Supplier } from '../types';
import { 
  ArrowLeft, Save, Trash2, Plus, Container as ContainerIcon, 
  DollarSign, Clock, MapPin, FileText, CheckCircle, Paperclip, ExternalLink,
  Printer, Share2, Copy, MessageCircle, CloudUpload, ScrollText, X, ClipboardList, Upload
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import LiveMap from '../components/LiveMap';

const ShipmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'containers' | 'finance' | 'history' | 'documents'>('overview');
  const [shareCopied, setShareCopied] = useState(false);
  
  // Modals
  const [showDeliveryOrder, setShowDeliveryOrder] = useState(false);
  const [showManifest, setShowManifest] = useState(false);

  // Input States
  const [newContainer, setNewContainer] = useState<Partial<Container>>({ type: '40HC', containerNo: '' });
  const [newFinance, setNewFinance] = useState<Partial<FinanceItem>>({ type: 'gelir', currency: 'USD', amount: 0, description: '', supplierId: '' });
  const [newHistory, setNewHistory] = useState<Partial<ShipmentHistory>>({ location: '', description: '' });
  const [newDoc, setNewDoc] = useState<Partial<ShipmentDocument>>({ name: '', type: 'B/L', url: '' });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [liveCoords, setLiveCoords] = useState<{lat: number, lng: number} | undefined>(undefined);

  // Print Settings (from LocalStorage)
  const [printSettings, setPrintSettings] = useState<any>({});

  useEffect(() => {
    if (id) {
      loadShipment(id);
      loadSuppliers();
    }
    const saved = localStorage.getItem('invoiceSettings');
    if(saved) setPrintSettings(JSON.parse(saved));
  }, [id]);

  const loadSuppliers = async () => {
    const res = await supabaseService.getSuppliers();
    if(res.data) setSuppliers(res.data);
  };

  const loadShipment = async (shipmentId: string) => {
    setLoading(true);
    const result = await supabaseService.getShipmentById(shipmentId);
    if (result.data) {
      setShipment(result.data);
      if(result.data.status === ShipmentStatus.IN_TRANSIT) {
          setLiveCoords({ lat: 34.5, lng: 18.0 });
      } else {
          setLiveCoords(undefined);
      }
      if (result.data.customerId) {
        const custRes = await supabaseService.getCustomerById(result.data.customerId);
        if (custRes.data && custRes.data.phone) {
            setCustomerPhone(custRes.data.phone);
        }
      }
    } else {
      toast.error('Dosya bulunamadı.');
    }
    setLoading(false);
  };

  const handleStatusChange = async (newStatus: ShipmentStatus) => {
    if (!shipment) return;
    await supabaseService.updateShipmentStatus(shipment.id, newStatus);
    toast.success(`Durum güncellendi: ${newStatus}`);
    loadShipment(shipment.id);
  };

  const handleAddContainer = async (e: React.FormEvent) => { e.preventDefault(); if(!shipment) return; await supabaseService.addContainer({...newContainer, shipmentId: shipment.id}); toast.success('Eklendi'); setNewContainer({type:'40HC', containerNo:''}); loadShipment(shipment.id); };
  const handleDeleteContainer = async (id: string) => { if(!confirm('Sil?')) return; await supabaseService.deleteContainer(id); loadShipment(shipment!.id); };
  const handleAddFinance = async (e: React.FormEvent) => { e.preventDefault(); if(!shipment) return; await supabaseService.addFinance({...newFinance, shipmentId: shipment.id}); toast.success('Eklendi'); setNewFinance({type:'gelir', currency:'USD', amount:0, description:'', supplierId:''}); loadShipment(shipment.id); };
  const handleDeleteFinance = async (id: string) => { if(!confirm('Sil?')) return; await supabaseService.deleteFinance(id); loadShipment(shipment!.id); };
  const handleAddHistory = async (e: React.FormEvent) => { e.preventDefault(); if(!shipment) return; await supabaseService.addHistory(shipment.id, {...newHistory, date: new Date().toISOString()}); toast.success('Eklendi'); setNewHistory({location:'', description:''}); loadShipment(shipment.id); };
  
  // Document Upload
  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setUploadingDoc(true);
      const res = await supabaseService.uploadFile(file, 'documents');
      if(res.data) {
          setNewDoc(prev => ({ ...prev, url: res.data!, name: prev.name || file.name }));
          toast.success('Dosya yüklendi, kaydetmeyi unutmayın.');
      } else {
          toast.error(res.error || 'Yükleme başarısız');
      }
      setUploadingDoc(false);
  };

  const handleAddDoc = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if(!shipment || !newDoc.url) { toast.error('Lütfen dosya seçin veya link girin'); return; }
      await supabaseService.addDocument({...newDoc, shipmentId: shipment.id}); 
      toast.success('Eklendi'); 
      setNewDoc({name:'', type:'B/L', url:''}); 
      loadShipment(shipment.id); 
  };
  
  const handleDeleteDoc = async (id: string) => { if(!confirm('Sil?')) return; await supabaseService.deleteDocument(id); loadShipment(shipment!.id); };

  const handleShare = () => {
    if(!shipment) return;
    const url = `${window.location.origin}/#/tracking?id=${shipment.referenceNo}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if(!shipment) return;
    let phone = customerPhone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (!phone) { toast.error('Tel no yok'); return; }
    const url = `${window.location.origin}/#/tracking?id=${shipment.referenceNo}`;
    const msg = `Sayın *${shipment.customerName}*, ${shipment.referenceNo} nolu dosyanızın durumu: ${shipment.status}. Takip: ${url}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!shipment) return <div className="p-10 text-center text-red-500">Kayıt bulunamadı.</div>;

  // Multi-Currency Logic
  const currencyGroups: Record<string, { income: number, expense: number }> = {};
  
  shipment.finance?.forEach(item => {
      const curr = item.currency || 'USD';
      if (!currencyGroups[curr]) currencyGroups[curr] = { income: 0, expense: 0 };
      
      if (item.type === 'gelir') currencyGroups[curr].income += item.amount;
      else currencyGroups[curr].expense += item.amount;
  });

  const isPrintingModal = showDeliveryOrder || showManifest;

  return (
    <>
    {/* MAIN CONTENT WRAPPER - HIDDEN ON PRINT IF MODAL IS OPEN */}
    <div className={clsx("space-y-6", isPrintingModal && "print:hidden")}>
      
      {/* Normal View Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/shipments')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
              {shipment.referenceNo} 
              <span className="text-xs px-2 py-1 bg-slate-200 rounded text-slate-600 font-mono">
                {shipment.transportMode.toUpperCase()}
              </span>
            </h1>
            <p className="text-slate-500">{shipment.customerName} • {shipment.description}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowManifest(true)} className="bg-white border px-3 py-2.5 rounded-lg flex gap-2 font-medium hover:bg-slate-50">
             <ClipboardList size={18} /> <span className="hidden sm:inline">Liste</span>
          </button>
          <button onClick={() => setShowDeliveryOrder(true)} className="bg-brand-600 text-white px-3 py-2.5 rounded-lg flex gap-2 font-bold shadow-lg">
             <ScrollText size={18} /> <span className="hidden sm:inline">Ordino</span>
          </button>
          <button onClick={handleWhatsApp} className="bg-green-500 text-white px-3 py-2.5 rounded-lg flex gap-2 font-bold shadow-lg">
             <MessageCircle size={18} /> <span className="hidden sm:inline">WhatsApp</span>
          </button>
          <button onClick={handleShare} className="bg-white border px-3 py-2.5 rounded-lg flex gap-2 font-medium hover:bg-slate-50">
             {shareCopied ? <CheckCircle size={18} className="text-green-500"/> : <Share2 size={18} />}
          </button>
          <select value={shipment.status} onChange={(e) => handleStatusChange(e.target.value as ShipmentStatus)} className="bg-white border border-brand-200 font-bold text-sm rounded-lg p-2.5 shadow-sm outline-none">
            {Object.values(ShipmentStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-x-auto shadow-sm no-scrollbar">
        {[{id:'overview', icon:FileText, label:'Genel'}, {id:'containers', icon:ContainerIcon, label:`Konteyner`}, {id:'finance', icon:DollarSign, label:'Finans'}, {id:'documents', icon:Paperclip, label:'Doküman'}, {id:'history', icon:Clock, label:'Tarihçe'}].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={clsx("flex-shrink-0 py-4 px-6 flex items-center justify-center gap-2 text-sm font-bold transition border-b-2 whitespace-nowrap", activeTab === tab.id ? "border-accent-500 text-brand-900 bg-accent-50" : "border-transparent text-slate-500 hover:text-brand-600")}>
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 p-6 min-h-[400px]">
        
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="h-72 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative">
               <LiveMap origin={shipment.origin} destination={shipment.destination} currentLat={liveCoords?.lat} currentLng={liveCoords?.lng} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="font-bold border-b pb-2">Rota</h3>
                    <div className="bg-slate-50 p-3 rounded"><b>Origin:</b> {shipment.origin}</div>
                    <div className="bg-slate-50 p-3 rounded"><b>Destination:</b> {shipment.destination}</div>
                    <div className="bg-slate-50 p-3 rounded"><b>ETD:</b> {shipment.etd}</div>
                    <div className="bg-slate-50 p-3 rounded"><b>ETA:</b> {shipment.eta}</div>
                </div>
                <div className="space-y-4">
                    <h3 className="font-bold border-b pb-2">Taraflar</h3>
                    <div className="bg-slate-50 p-3 rounded"><b>Shipper:</b> {shipment.senderName}</div>
                    <div className="bg-slate-50 p-3 rounded"><b>Consignee:</b> {shipment.receiverName}</div>
                    <div className="bg-blue-50 p-3 rounded border border-blue-100"><b>Müşteri:</b> {shipment.customerName}</div>
                </div>
            </div>
          </div>
        )}

        {/* --- FINANCE TAB (Updated for Multi-Currency) --- */}
        {activeTab === 'finance' && (
            <div>
               {/* Summary Cards */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {Object.keys(currencyGroups).length === 0 && <p className="col-span-full text-center text-slate-400 py-4 border-2 border-dashed border-slate-100 rounded">Henüz finansal kayıt girilmedi.</p>}
                  
                  {Object.entries(currencyGroups).map(([curr, stats]) => (
                      <div key={curr} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">{curr} Bakiyesi</p>
                          <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span className="text-green-600 font-bold">Gelir:</span> <span>{stats.income.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span className="text-red-600 font-bold">Gider:</span> <span>{stats.expense.toLocaleString()}</span></div>
                              <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between font-bold text-base">
                                  <span>Net:</span> 
                                  <span className={stats.income - stats.expense >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                      {(stats.income - stats.expense).toLocaleString()}
                                  </span>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>

               {/* Add Form */}
               <form onSubmit={handleAddFinance} className="bg-slate-50 p-4 mb-6 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-2 items-end">
                  <div className="w-full md:w-32">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Tip</label>
                      <select className="w-full border p-2 rounded text-sm bg-white outline-none" value={newFinance.type} onChange={e => setNewFinance({...newFinance, type: e.target.value as any})}><option value="gelir">Gelir</option><option value="gider">Gider</option></select>
                  </div>
                  <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Açıklama</label>
                      <input className="w-full border p-2 rounded text-sm outline-none" placeholder="Örn: Navlun Bedeli" value={newFinance.description} onChange={e => setNewFinance({...newFinance, description: e.target.value})} />
                  </div>
                  <div className="w-full md:w-32">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Tutar</label>
                      <input className="w-full border p-2 rounded text-sm outline-none" type="number" placeholder="0" value={newFinance.amount} onChange={e => setNewFinance({...newFinance, amount: Number(e.target.value)})} />
                  </div>
                  <div className="w-full md:w-24">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Birim</label>
                      <select className="w-full border p-2 rounded text-sm bg-white outline-none" value={newFinance.currency} onChange={e => setNewFinance({...newFinance, currency: e.target.value as any})}>
                          <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="TRY">TRY</option>
                      </select>
                  </div>
                  <button className="bg-brand-600 text-white px-4 py-2 rounded font-bold hover:bg-brand-700 transition">Ekle</button>
               </form>

               <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                          <th className="p-3 rounded-tl-lg">Tip</th>
                          <th className="p-3">Açıklama</th>
                          <th className="p-3 text-right">Tutar</th>
                          <th className="p-3 text-right rounded-tr-lg">İşlem</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {shipment.finance?.map(f => (
                          <tr key={f.id} className="hover:bg-slate-50">
                              <td className="p-3">
                                  <span className={clsx("uppercase text-xs font-bold px-2 py-1 rounded", f.type === 'gelir' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                      {f.type}
                                  </span>
                              </td>
                              <td className="p-3">{f.description}</td>
                              <td className="p-3 text-right font-mono font-bold">{f.amount.toLocaleString()} {f.currency}</td>
                              <td className="p-3 text-right"><button onClick={() => handleDeleteFinance(f.id)} className="text-slate-400 hover:text-red-500 transition"><Trash2 size={16}/></button></td>
                          </tr>
                      ))}
                  </tbody>
               </table>
            </div>
        )}
        
        {activeTab === 'containers' && (
            <div>
               <form onSubmit={handleAddContainer} className="bg-slate-50 p-4 mb-4 rounded flex gap-2">
                  <input className="border p-2 rounded flex-1" placeholder="Konteyner No" value={newContainer.containerNo} onChange={e => setNewContainer({...newContainer, containerNo: e.target.value})} />
                  <button className="bg-brand-600 text-white p-2 rounded">Ekle</button>
               </form>
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 font-bold"><tr><th className="p-2">No</th><th className="p-2">Tip</th><th className="p-2 text-right">Sil</th></tr></thead>
                  <tbody>{shipment.containers?.map(c => <tr key={c.id} className="border-b"><td className="p-2">{c.containerNo}</td><td className="p-2">{c.type}</td><td className="p-2 text-right"><button onClick={() => handleDeleteContainer(c.id)}><Trash2 size={14}/></button></td></tr>)}</tbody>
               </table>
            </div>
        )}

        {/* --- HISTORY TAB --- */}
        {activeTab === 'history' && (
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-800">Hareket Geçmişi</h3>
             </div>
             
             {/* Add History Form */}
             <form onSubmit={handleAddHistory} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-4 items-end">
                <div className="flex-1">
                   <label className="text-xs font-bold text-slate-500 mb-1 block">Açıklama</label>
                   <input className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none" 
                     value={newHistory.description} onChange={e => setNewHistory({...newHistory, description: e.target.value})} placeholder="Örn: Gümrük işlemleri başladı" required />
                </div>
                <div className="flex-1">
                   <label className="text-xs font-bold text-slate-500 mb-1 block">Konum</label>
                   <input className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none" 
                     value={newHistory.location} onChange={e => setNewHistory({...newHistory, location: e.target.value})} placeholder="Örn: İstanbul" required />
                </div>
                <div className="w-40">
                   <label className="text-xs font-bold text-slate-500 mb-1 block">Tarih</label>
                   <input type="datetime-local" className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none" 
                     value={newHistory.date ? new Date(newHistory.date).toISOString().slice(0, 16) : ''} 
                     onChange={e => setNewHistory({...newHistory, date: new Date(e.target.value).toISOString()})} />
                </div>
                <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 transition">Ekle</button>
             </form>

             <div className="relative pl-4 border-l-2 border-slate-200 space-y-8">
                {shipment.history && shipment.history.map((h, i) => (
                   <div key={i} className="relative group">
                      <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-white border-4 border-brand-500"></div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition">
                         <div className="flex justify-between items-start">
                            <div>
                               <p className="font-bold text-slate-800">{h.description}</p>
                               <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin size={14}/> {h.location}</p>
                            </div>
                            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                               {new Date(h.date).toLocaleDateString('tr-TR')} {new Date(h.date).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* --- DOCUMENTS TAB WITH UPLOAD --- */}
        {activeTab === 'documents' && (
           <div className="space-y-6">
              <form onSubmit={handleAddDoc} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                 <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Belge Adı</label>
                    <input className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none" 
                      value={newDoc.name} onChange={e => setNewDoc({...newDoc, name: e.target.value})} placeholder="Dosya adı..." required />
                 </div>
                 <div className="w-40">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Tip</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none"
                      value={newDoc.type} onChange={e => setNewDoc({...newDoc, type: e.target.value as any})}>
                       <option>B/L</option><option>Invoice</option><option>Packing List</option><option>Dekont</option><option>Diğer</option>
                    </select>
                 </div>
                 
                 <div className="flex-[2] flex gap-2">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Dosya Yükle / Link</label>
                        <div className="flex gap-2">
                            <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition w-full">
                                <Upload size={16} className={uploadingDoc ? 'animate-bounce' : ''}/>
                                <span className="text-xs font-bold text-slate-600 truncate">{uploadingDoc ? 'Yükleniyor...' : (newDoc.url ? 'Dosya Seçili' : 'Dosya Seç')}</span>
                                <input type="file" className="hidden" accept="image/*, application/pdf" onChange={handleDocFileChange} disabled={uploadingDoc} />
                            </label>
                            <input className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none" 
                                value={newDoc.url} onChange={e => setNewDoc({...newDoc, url: e.target.value})} placeholder="veya URL..." />
                        </div>
                    </div>
                 </div>

                 <button type="submit" disabled={uploadingDoc} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 transition disabled:opacity-50">Ekle</button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {shipment.documents && shipment.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Paperclip size={20}/></div>
                          <div>
                             <p className="font-bold text-slate-800">{doc.name}</p>
                             <p className="text-xs text-slate-500 uppercase">{doc.type}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded transition"><ExternalLink size={18}/></a>
                          <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 size={18}/></button>
                       </div>
                    </div>
                 ))}
                 {(!shipment.documents || shipment.documents.length === 0) && (
                    <div className="col-span-full p-8 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">Belge yüklenmedi.</div>
                 )}
              </div>
           </div>
        )}

      </div>
    </div>

      {/* PRINT MODALS - MOVED OUTSIDE MAIN CONTAINER */}
      
      {/* DELIVERY ORDER MODAL */}
      {showDeliveryOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-0 backdrop-blur-sm overflow-auto print:absolute print:top-0 print:left-0 print:w-full print:h-auto print:z-[9999] print:bg-white print:block">
           <div className="bg-white w-full max-w-4xl min-h-[1000px] shadow-2xl m-4 relative animate-in fade-in duration-300 print:shadow-none print:m-0 print:w-full print:h-auto print:border-none print:rounded-none">
             <div className="absolute top-0 right-0 p-4 flex gap-2 print:hidden">
               <button onClick={() => window.print()} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                 <Printer size={18} /> Yazdır
               </button>
               <button onClick={() => setShowDeliveryOrder(false)} className="bg-slate-200 text-slate-700 p-2 rounded-lg">
                 <X size={20} />
               </button>
             </div>
             
             {/* Printable Content */}
             <div className="p-12 md:p-16 text-slate-900 font-serif print:text-black">
                
                {/* Header with Logo */}
                <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900 print:border-black">
                   <div className="w-1/2">
                      {printSettings.logoUrl ? (
                          <img src={printSettings.logoUrl} className="h-20 mb-2 object-contain" alt="Logo" />
                      ) : (
                          <h2 className="font-bold text-2xl uppercase">{printSettings.companyName || 'LOGYCY LOGISTICS'}</h2>
                      )}
                      <p className="text-xs mt-2 whitespace-pre-line">
                         {printSettings.address}
                         <br/>Tel: {printSettings.phone}
                      </p>
                   </div>
                   <div className="text-right">
                        <h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-900 print:text-black">TESLİMAT EMRİ</h2>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest print:text-gray-600">DELIVERY ORDER</p>
                        <p className="mt-4 font-mono font-bold text-lg">{shipment.referenceNo}</p>
                   </div>
                </div>

                <div className="flex justify-between items-start mb-8">
                   <div className="w-1/2">
                      <div className="mb-6"><span className="block text-xs font-bold uppercase text-slate-500 mb-1 print:text-gray-600">ALICI / MÜŞTERİ</span><div className="border border-slate-300 p-3 min-h-[60px] font-bold text-lg bg-slate-50 print:bg-transparent print:border-gray-400 print:text-black">{shipment.customerName}</div></div>
                      <div><span className="block text-xs font-bold uppercase text-slate-500 mb-1 print:text-gray-600">GÖNDERİCİ</span><div className="border border-slate-300 p-3 min-h-[40px] font-medium print:border-gray-400 print:text-black">{shipment.senderName}</div></div>
                   </div>
                   <div className="w-1/3 text-right space-y-2">
                      <div className="flex justify-between border-b pb-1"><span className="text-xs font-bold">GEMİ / SEFER:</span> <span>-</span></div>
                      <div className="flex justify-between border-b pb-1"><span className="text-xs font-bold">VARIŞ LİMANI:</span> <span>{shipment.destination}</span></div>
                      <div className="flex justify-between border-b pb-1"><span className="text-xs font-bold">ETA:</span> <span>{shipment.eta}</span></div>
                   </div>
                </div>

                <div className="mb-12">
                   <h3 className="font-bold border-b border-slate-400 mb-2 pb-1 text-sm uppercase print:text-black print:border-black">YÜK DETAYLARI</h3>
                   <table className="w-full border-collapse border border-slate-300 text-sm print:border-gray-400">
                      <thead className="bg-slate-100 print:bg-gray-100"><tr><th className="border p-2 print:border-gray-400 print:text-black">KONTEYNER NO</th><th className="border p-2 print:border-gray-400 print:text-black">TİP</th><th className="border p-2 print:border-gray-400 print:text-black">MÜHÜR NO</th></tr></thead>
                      <tbody>
                          {shipment.containers?.map(c => (
                              <tr key={c.id}>
                                  <td className="border p-2 font-mono print:border-gray-400 print:text-black">{c.containerNo}</td>
                                  <td className="border p-2 print:border-gray-400 print:text-black">{c.type}</td>
                                  <td className="border p-2 print:border-gray-400 print:text-black">-</td>
                              </tr>
                          ))}
                          {(!shipment.containers || shipment.containers.length === 0) && (
                              <tr><td colSpan={3} className="border p-4 text-center print:border-gray-400">Konteyner bilgisi girilmedi.</td></tr>
                          )}
                      </tbody>
                   </table>
                </div>

                <div className="mt-20 flex justify-between items-end">
                   <div className="text-center w-64"><p className="text-xs font-bold uppercase mb-16 print:text-black">TESLİM ALAN</p><div className="border-t border-slate-900 pt-1 print:border-black">İmza / Kaşe</div></div>
                   <div className="text-center w-64"><p className="text-xs font-bold uppercase mb-16 print:text-black">TESLİM EDEN</p><p className="font-bold text-lg mb-2 print:text-black">{printSettings.companyName || 'LOGYCY'}</p><div className="border-t border-slate-900 pt-1 print:border-black">İmza / Kaşe</div></div>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* MANIFEST MODAL */}
      {showManifest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-0 backdrop-blur-sm overflow-auto print:absolute print:top-0 print:left-0 print:w-full print:h-auto print:z-[9999] print:bg-white print:block">
           <div className="bg-white w-full max-w-4xl min-h-[800px] shadow-2xl m-4 relative animate-in fade-in duration-300 print:shadow-none print:m-0 print:w-full print:h-auto print:border-none print:rounded-none">
             <div className="absolute top-0 right-0 p-4 flex gap-2 print:hidden">
               <button onClick={() => window.print()} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Printer size={18} /> Yazdır</button>
               <button onClick={() => setShowManifest(false)} className="bg-slate-200 text-slate-700 p-2 rounded-lg"><X size={20} /></button>
             </div>
             <div className="p-12 md:p-16 text-slate-900 font-sans print:text-black">
                <div className="flex justify-between items-center border-b-4 border-slate-800 pb-4 mb-8 print:border-black">
                   <div>
                       <h1 className="text-3xl font-extrabold text-slate-900 print:text-black">CARGO MANIFEST</h1>
                       <p className="text-sm text-slate-500 font-bold">{printSettings.companyName}</p>
                   </div>
                   <div className="text-right"><p className="font-mono font-bold text-lg print:text-black">DATE: {new Date().toLocaleDateString('tr-TR')}</p></div>
                </div>
                
                <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                    <div>
                        <span className="block font-bold text-slate-500">CONSIGNEE:</span>
                        <p className="font-bold text-lg">{shipment.receiverName}</p>
                    </div>
                    <div>
                        <span className="block font-bold text-slate-500">NOTIFY:</span>
                        <p className="font-bold text-lg">{shipment.customerName}</p>
                    </div>
                </div>

                <table className="w-full border-collapse mb-8">
                   <thead><tr className="bg-slate-800 text-white text-sm print:bg-black print:text-white"><th className="p-3 text-left">CONTAINER NO</th><th className="p-3 text-center">TYPE</th><th className="p-3 text-right">WEIGHT (KGS)</th></tr></thead>
                   <tbody>
                       {shipment.containers?.map(c => (
                           <tr key={c.id} className="border-b print:border-gray-300">
                               <td className="p-3 font-mono print:text-black font-bold">{c.containerNo}</td>
                               <td className="p-3 text-center print:text-black">{c.type}</td>
                               <td className="p-3 text-right print:text-black">-</td>
                           </tr>
                       ))}
                   </tbody>
                </table>
             </div>
           </div>
        </div>
      )}
    </>
  );
};

export default ShipmentDetail;
