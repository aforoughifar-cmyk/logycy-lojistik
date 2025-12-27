import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Shipment, ShipmentStatus, Container, FinanceItem, ShipmentHistory, ShipmentDocument, Supplier, ManifestItem, ManifestGood, Customer } from '../types';
import { 
  ArrowLeft, Save, Trash2, Plus, Container as ContainerIcon, 
  DollarSign, Clock, MapPin, FileText, CheckCircle, Paperclip, ExternalLink,
  MessageCircle, Users, Anchor, Map, Minus, Ship, Upload
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import LiveMap from '../components/LiveMap';
import SearchableSelect from '../components/SearchableSelect';

const ShipmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'manifest' | 'containers' | 'finance' | 'history' | 'documents'>('overview');
  const [liveCoords, setLiveCoords] = useState<{lat: number, lng: number} | null>(null);
  
  // Custom Settings State
  const [unitOptions, setUnitOptions] = useState<string[]>(['Koli', 'Palet', 'Adet', 'Sandık', 'Kg', 'UNIT']);

  // Input States
  const [newContainer, setNewContainer] = useState<Partial<Container>>({ type: 'Unknown', containerNo: '', shipsGoLink: '' });
  const [newFinance, setNewFinance] = useState<Partial<FinanceItem>>({ type: 'gelir', currency: 'USD', amount: 0, description: '', supplierId: '' });
  const [newHistory, setNewHistory] = useState<Partial<ShipmentHistory>>({ location: '', description: '', date: new Date().toISOString().slice(0, 16) });
  const [newDoc, setNewDoc] = useState<Partial<ShipmentDocument>>({ name: '', type: 'B/L', url: '' });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // --- Manifest / Groupage States ---
  const [manifestItems, setManifestItems] = useState<ManifestItem[]>([]);
  const [activeManifestCustomer, setActiveManifestCustomer] = useState<{id: string, name: string, containerId: string}>({ id: '', name: '', containerId: '' });
  const [currentGoodsList, setCurrentGoodsList] = useState<ManifestGood[]>([]);
  const [newGoodLine, setNewGoodLine] = useState<ManifestGood>({ description: '', quantity: 1, packageType: 'Koli', marks: '', weight: '', volume: '' }); // Initialized with empty strings

  const currencyGroups = useMemo(() => {
      const groups: Record<string, { income: number; expense: number }> = {
          'USD': { income: 0, expense: 0 },
          'EUR': { income: 0, expense: 0 },
          'GBP': { income: 0, expense: 0 },
          'TRY': { income: 0, expense: 0 },
      };
      if (shipment?.finance) {
          shipment.finance.forEach(f => {
              const curr = f.currency || 'USD';
              if (!groups[curr]) groups[curr] = { income: 0, expense: 0 };
              if (f.type === 'gelir') groups[curr].income += Number(f.amount);
              else groups[curr].expense += Number(f.amount);
          });
      }
      return groups;
  }, [shipment]);

  useEffect(() => {
    if (id) {
      loadShipment(id);
      loadSuppliers();
      loadCustomers();
    }

    const savedDefs = localStorage.getItem('systemDefinitions');
    if (savedDefs) {
        const parsed = JSON.parse(savedDefs);
        if (parsed.quantityUnits && parsed.quantityUnits.length > 0) {
            setUnitOptions(parsed.quantityUnits);
            setNewGoodLine(prev => ({...prev, packageType: parsed.quantityUnits[0] }));
        }
    }
  }, [id]);

  const loadSuppliers = async () => {
    const res = await supabaseService.getSuppliers();
    if(res.data) setSuppliers(res.data);
  };

  const loadCustomers = async () => {
      const res = await supabaseService.getCustomers();
      if(res.data) setCustomers(res.data);
  };

  const loadShipment = async (shipmentId: string) => {
    setLoading(true);
    const result = await supabaseService.getShipmentById(shipmentId);
    if (result.data) {
      setShipment(result.data);
      if (result.data.manifest) {
          setManifestItems(result.data.manifest);
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

  // --- CRUD Operations ---
  const handleAddContainer = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if(!shipment) return; 
      await supabaseService.addContainer({...newContainer, shipmentId: shipment.id}); 
      toast.success('Eklendi'); 
      setNewContainer({type:'Unknown', containerNo:'', shipsGoLink: ''}); 
      loadShipment(shipment.id); 
  };
  
  const handleDeleteContainer = async (id: string) => { 
      if(!confirm('Sil?')) return; 
      await supabaseService.deleteContainer(id); 
      loadShipment(shipment!.id); 
  };
  
  const handleAddFinance = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if(!shipment) return; 
      await supabaseService.addFinance({...newFinance, shipmentId: shipment.id}); 
      toast.success('Eklendi'); 
      setNewFinance({type:'gelir', currency:'USD', amount:0, description:'', supplierId:''}); 
      loadShipment(shipment.id); 
  };
  
  const handleDeleteFinance = async (id: string) => { 
      if(!confirm('Sil?')) return; 
      await supabaseService.deleteFinance(id); 
      loadShipment(shipment!.id); 
  };
  
  const handleAddHistory = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if(!shipment) return; 
      await supabaseService.addHistory(shipment.id, {...newHistory}); 
      toast.success('Kayıt eklendi'); 
      setNewHistory({location:'', description:'', date: new Date().toISOString().slice(0, 16)}); 
      loadShipment(shipment.id); 
  };
  
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
      if(!shipment || !newDoc.url) return; 
      await supabaseService.addDocument({...newDoc, shipmentId: shipment.id}); 
      toast.success('Eklendi'); 
      setNewDoc({name:'', type:'B/L', url:''}); 
      loadShipment(shipment.id); 
  };
  
  const handleDeleteDoc = async (id: string) => { 
      if(!confirm('Sil?')) return; 
      await supabaseService.deleteDocument(id); 
      loadShipment(shipment!.id); 
  };

  // --- MANIFEST LOGIC ---
  const addGoodToLine = () => {
      if(!newGoodLine.description) return;
      setCurrentGoodsList([...currentGoodsList, newGoodLine]);
      setNewGoodLine({ description: '', quantity: 1, packageType: unitOptions[0] || 'Koli', marks: '', weight: '', volume: '' }); // Reset to empty strings
  };

  const removeGoodFromLine = (idx: number) => {
      const newList = [...currentGoodsList];
      newList.splice(idx, 1);
      setCurrentGoodsList(newList);
  };

  const saveManifestItem = async () => {
      if(!activeManifestCustomer.id || currentGoodsList.length === 0) {
          toast.error("Müşteri ve en az bir ürün giriniz.");
          return;
      }
      const container = shipment?.containers?.find(c => c.id === activeManifestCustomer.containerId);
      const newItem: ManifestItem = {
          id: Math.random().toString(36).substr(2, 9),
          customerId: activeManifestCustomer.id,
          customerName: activeManifestCustomer.name,
          containerId: activeManifestCustomer.containerId,
          containerNo: container?.containerNo,
          goods: [...currentGoodsList],
          isSaved: false
      };
      const updatedManifest = [...manifestItems, newItem];
      setManifestItems(updatedManifest);
      if (shipment) {
          await supabaseService.updateShipmentDetails(shipment.id, { manifest: updatedManifest });
          toast.success('Listeye kaydedildi');
      }
      setActiveManifestCustomer({ id: '', name: '', containerId: '' });
      setCurrentGoodsList([]);
  };

  const deleteManifestItem = async (itemId: string) => {
      if(!confirm('Silmek istediğinize emin misiniz?')) return;
      const itemToDelete = manifestItems.find(i => i.id === itemId);
      if (itemToDelete && itemToDelete.financeIds) {
          for (const fId of itemToDelete.financeIds) await supabaseService.deleteFinance(fId);
      }
      const updated = manifestItems.filter(i => i.id !== itemId);
      setManifestItems(updated);
      if(shipment) {
          await supabaseService.updateShipmentDetails(shipment.id, { manifest: updated });
          loadShipment(shipment.id); 
      }
  };

  const handleWhatsApp = (item: ManifestItem) => {
      const cust = customers.find(c => c.id === item.customerId);
      const trackingUrl = `${window.location.origin}/#/tracking?id=${shipment?.referenceNo}`;
      const msg = `Sayın *${cust?.name}*,\n${shipment?.referenceNo} nolu dosyanızın durumu güncellenmiştir.\nTakip için: ${trackingUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!shipment) return <div className="p-10 text-center text-red-500">Kayıt bulunamadı.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/shipments')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
              {shipment.description || 'İsimsiz Sevkiyat'}
              <span className="text-xs px-2 py-1 bg-slate-200 rounded text-slate-600 font-mono">
                {shipment.transportMode.toUpperCase()}
              </span>
            </h1>
            <p className="text-slate-500 flex items-center gap-2">
                <span className="font-mono bg-slate-100 px-1 rounded">{shipment.referenceNo}</span>
                {shipment.vesselName && <span>• {shipment.vesselName}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={shipment.status} onChange={(e) => handleStatusChange(e.target.value as ShipmentStatus)} className="bg-white border border-brand-200 font-bold text-sm rounded-lg p-2.5 shadow-sm outline-none">
            {Object.values(ShipmentStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-x-auto shadow-sm no-scrollbar">
        {[
          {id:'overview', icon:Anchor, label:'Genel Bakış (Master)'}, 
          {id:'containers', icon:ContainerIcon, label:`Konteyner (${shipment.containers?.length || 0})`}, 
          {id:'manifest', icon:Users, label:'Yük Dağılımı (Manifest)'}, 
          {id:'finance', icon:DollarSign, label:'Finans'}, 
          {id:'documents', icon:Paperclip, label:'Doküman'}, 
          {id:'history', icon:Clock, label:'Tarihçe'}
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={clsx("flex-shrink-0 py-4 px-6 flex items-center justify-center gap-2 text-sm font-bold transition border-b-2 whitespace-nowrap", activeTab === tab.id ? "border-accent-500 text-brand-900 bg-accent-50" : "border-transparent text-slate-500 hover:text-brand-600")}>
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 p-6 min-h-[400px]">
        
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            <div className="h-72 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative">
               <LiveMap origin={shipment.origin} destination={shipment.destination} currentLat={liveCoords?.lat} currentLng={liveCoords?.lng} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="font-bold text-brand-900 mb-4 flex items-center gap-2"><Map size={18}/> Rota Bilgileri</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">Çıkış (POL)</span>
                            <span className="font-bold text-slate-800">{shipment.origin}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">Varış (POD)</span>
                            <span className="font-bold text-slate-800">{shipment.destination}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Tahmini Varış</span>
                            <span className="font-bold text-brand-600">{shipment.eta || '-'}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="font-bold text-brand-900 mb-4 flex items-center gap-2"><Ship size={18}/> Gemi / Taşıyıcı</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">Gemi Adı</span>
                            <span className="font-bold text-slate-800">{shipment.vesselName || '-'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">Master B/L No</span>
                            <span className="font-bold text-slate-800">{shipment.bookingNo || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'containers' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
               <div className="flex-1 w-full">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Konteyner No</label>
                  <input className="w-full border rounded-lg p-2 text-sm" value={newContainer.containerNo} onChange={e => setNewContainer({...newContainer, containerNo: e.target.value})} placeholder="ABCD1234567" />
               </div>
               <button onClick={handleAddContainer} className="bg-brand-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-800 transition w-full md:w-auto">Ekle</button>
            </div>
            
            <div className="space-y-3">
               {shipment.containers?.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition">
                     <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ContainerIcon size={20}/></div>
                        <div>
                           <p className="font-bold text-slate-800">{c.containerNo}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        {c.shipsGoLink && <a href={c.shipsGoLink} target="_blank" className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded font-bold">Takip Et</a>}
                        <button onClick={() => handleDeleteContainer(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                     </div>
                  </div>
               ))}
               {(!shipment.containers || shipment.containers.length === 0) && <p className="text-center text-slate-400 py-4">Konteyner eklenmedi.</p>}
            </div>
          </div>
        )}

        {activeTab === 'manifest' && (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Users size={20}/> Yeni Müşteri Ekle</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Müşteri Seçimi</label>
                            <SearchableSelect 
                                options={customers.map(c => ({ id: c.id, label: c.name }))}
                                value={activeManifestCustomer.id}
                                onChange={(val) => {
                                    const c = customers.find(cus => cus.id === val);
                                    setActiveManifestCustomer(prev => ({ ...prev, id: val, name: c?.name || '' }));
                                }}
                                placeholder="Müşteri Ara..."
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Konteyner (Opsiyonel)</label>
                            <select className="w-full border rounded-xl p-3 text-sm bg-white"
                                value={activeManifestCustomer.containerId} 
                                onChange={e => setActiveManifestCustomer(prev => ({...prev, containerId: e.target.value}))}
                            >
                                <option value="">Seçiniz...</option>
                                {shipment.containers?.map(c => <option key={c.id} value={c.id}>{c.containerNo}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">Mal Listesi (Alt alta ekleyiniz)</label>
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <div className="md:col-span-2">
                                    <input className="w-full border rounded-lg p-2 text-sm" placeholder="Mal Cinsi / Açıklama" value={newGoodLine.description} onChange={e => setNewGoodLine({...newGoodLine, description: e.target.value})} />
                                </div>
                                <div><input className="w-full border rounded-lg p-2 text-sm" placeholder="Marka & No" value={newGoodLine.marks} onChange={e => setNewGoodLine({...newGoodLine, marks: e.target.value})} /></div>
                                <div className="flex gap-2">
                                    <input type="number" className="w-full border rounded-lg p-2 text-sm" placeholder="Miktar" value={newGoodLine.quantity} onChange={e => setNewGoodLine({...newGoodLine, quantity: Number(e.target.value)})} />
                                    <select className="w-full border rounded-lg p-2 text-sm bg-white" value={newGoodLine.packageType} onChange={e => setNewGoodLine({...newGoodLine, packageType: e.target.value})}>{unitOptions.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                                {/* Changed to text input to accept strings like '120.000' */}
                                <div><input className="w-full border rounded-lg p-2 text-sm" placeholder="Ağırlık (KG)" value={newGoodLine.weight || ''} onChange={e => setNewGoodLine({...newGoodLine, weight: e.target.value})} /></div>
                                <div><input className="w-full border rounded-lg p-2 text-sm" placeholder="Hacim (CBM)" value={newGoodLine.volume || ''} onChange={e => setNewGoodLine({...newGoodLine, volume: e.target.value})} /></div>
                                <div className="md:col-span-2"><button onClick={addGoodToLine} className="w-full bg-slate-200 text-slate-700 p-2 rounded-lg hover:bg-slate-300 font-bold text-sm flex items-center justify-center gap-2"><Plus size={16}/> Satır Ekle</button></div>
                            </div>
                        </div>
                        {currentGoodsList.length > 0 && (
                            <div className="mt-3 space-y-1">
                                {currentGoodsList.map((g, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
                                        <span>{g.description} <span className="text-slate-400 text-xs">({g.marks || '-'})</span></span>
                                        <div className="flex items-center gap-4"><span className="font-bold">{g.quantity} {g.packageType}</span><button onClick={() => removeGoodFromLine(i)} className="text-red-400 hover:text-red-600"><Minus size={14}/></button></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={saveManifestItem} className="w-full bg-brand-900 text-white py-3 rounded-xl font-bold hover:bg-brand-800 transition flex items-center justify-center gap-2"><Save size={18}/> Listeye Kaydet</button>
                </div>
                <div className="space-y-4">
                    {manifestItems.map((item) => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h4 className="font-bold text-lg text-brand-900 flex items-center gap-2">{item.customerName} {item.isSaved && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={10}/> Kayıtlı</span>}</h4>
                                    <p className="text-xs text-slate-500 font-mono">{item.containerNo || 'Konteyner Atanmadı'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleWhatsApp(item)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"><MessageCircle size={18}/></button>
                                    <button onClick={() => window.open(`/#/tracking?id=${shipment.referenceNo}`, '_blank')} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"><ExternalLink size={18}/></button>
                                    <button onClick={() => deleteManifestItem(item.id)} className="p-2 text-slate-400 hover:text-red-500 transition"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-400 font-bold bg-slate-50 uppercase"><tr><th className="p-2">Marka</th><th className="p-2">Açıklama</th><th className="p-2 text-right">Miktar</th><th className="p-2 text-right">KG / CBM</th></tr></thead>
                                <tbody>{item.goods.map((g, idx) => (<tr key={idx} className="border-b border-slate-50 last:border-0"><td className="p-2 text-xs font-mono">{g.marks || '-'}</td><td className="p-2 font-medium">{g.description}</td><td className="p-2 text-right font-mono">{g.quantity} {g.packageType}</td><td className="p-2 text-right text-xs text-slate-500">{g.weight} / {g.volume}</td></tr>))}</tbody>
                            </table>
                        </div>
                    ))}
                    {manifestItems.length === 0 && <div className="text-center text-slate-400 py-10">Henüz müşteri eklenmedi.</div>}
                </div>
            </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(currencyGroups).map(([curr, val]: [string, any]) => (
                   <div key={curr} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase">{curr} Bakiye</p>
                      <p className={clsx("font-bold text-lg", (val.income - val.expense) >= 0 ? "text-green-600" : "text-red-600")}>{(val.income - val.expense).toLocaleString()}</p>
                   </div>
                ))}
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Tip</label><select className="w-full border rounded-lg p-2 text-sm" value={newFinance.type} onChange={e => setNewFinance({...newFinance, type: e.target.value as any})}><option value="gelir">Gelir</option><option value="gider">Gider</option></select></div>
                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Açıklama</label><input className="w-full border rounded-lg p-2 text-sm" value={newFinance.description} onChange={e => setNewFinance({...newFinance, description: e.target.value})} placeholder="Örn: Navlun Bedeli" /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Tutar</label><div className="flex gap-1"><input type="number" className="w-full border rounded-lg p-2 text-sm" value={newFinance.amount} onChange={e => setNewFinance({...newFinance, amount: Number(e.target.value)})} /><select className="border rounded-lg p-2 text-sm bg-white" value={newFinance.currency} onChange={e => setNewFinance({...newFinance, currency: e.target.value as any})}><option>USD</option><option>EUR</option><option>GBP</option><option>TRY</option></select></div></div>
                <button onClick={handleAddFinance} className="bg-brand-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-800 transition h-[38px]">Ekle</button>
             </div>
             <div className="space-y-2">
                {shipment.finance?.map(f => (
                   <div key={f.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3"><div className={clsx("w-2 h-2 rounded-full", f.type === 'gelir' ? "bg-green-500" : "bg-red-500")}></div><span className="font-medium text-slate-700">{f.description}</span>{f.supplierName && <span className="text-xs text-slate-400">({f.supplierName})</span>}</div>
                      <div className="flex items-center gap-4"><span className={clsx("font-mono font-bold", f.type === 'gelir' ? "text-green-600" : "text-red-600")}>{f.type === 'gelir' ? '+' : '-'}{f.amount.toLocaleString()} {f.currency}</span><button onClick={() => handleDeleteFinance(f.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full"><label className="text-xs font-bold text-slate-500 mb-1 block">Olay / Açıklama</label><input className="w-full border rounded-lg p-2 text-sm" value={newHistory.description} onChange={e => setNewHistory({...newHistory, description: e.target.value})} /></div>
                <div className="w-full md:w-48"><label className="text-xs font-bold text-slate-500 mb-1 block">Konum</label><input className="w-full border rounded-lg p-2 text-sm" value={newHistory.location} onChange={e => setNewHistory({...newHistory, location: e.target.value})} /></div>
                <div className="w-full md:w-48"><label className="text-xs font-bold text-slate-500 mb-1 block">Tarih</label><input type="datetime-local" className="w-full border rounded-lg p-2 text-sm" value={newHistory.date} onChange={e => setNewHistory({...newHistory, date: e.target.value})} /></div>
                <button onClick={handleAddHistory} className="bg-brand-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-800 transition w-full md:w-auto">Ekle</button>
             </div>
             <div className="relative pl-4 border-l-2 border-slate-200 space-y-8 py-2">
                {shipment.history?.map((h, i) => (
                   <div key={i} className="relative">
                      <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-brand-600 border-4 border-white shadow-sm"></div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm ml-4">
                         <div className="flex justify-between items-start mb-1"><span className="font-bold text-brand-900">{h.description}</span><span className="text-xs text-slate-400">{new Date(h.date).toLocaleDateString('tr-TR', {day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'})}</span></div>
                         <div className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12}/> {h.location}</div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed text-center">
                {uploadingDoc ? <div className="text-brand-600 font-bold animate-pulse">Yükleniyor...</div> : <label className="cursor-pointer block"><Upload className="mx-auto text-slate-400 mb-2" size={32} /><span className="text-sm font-bold text-slate-600">Dosya Seç veya Sürükle</span><input type="file" className="hidden" onChange={handleDocFileChange} /></label>}
             </div>
             {newDoc.url && (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex gap-4 items-end">
                   <div className="flex-1"><label className="text-xs font-bold text-green-700 mb-1 block">Dosya Adı</label><input className="w-full border border-green-200 rounded-lg p-2 text-sm" value={newDoc.name} onChange={e => setNewDoc({...newDoc, name: e.target.value})} /></div>
                   <div><label className="text-xs font-bold text-green-700 mb-1 block">Tip</label><select className="w-full border border-green-200 rounded-lg p-2 text-sm bg-white" value={newDoc.type} onChange={e => setNewDoc({...newDoc, type: e.target.value as any})}><option>B/L</option><option>Invoice</option><option>Packing List</option><option>Dekont</option><option>Diğer</option></select></div>
                   <button onClick={handleAddDoc} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition">Kaydet</button>
                </div>
             )}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {shipment.documents?.map(d => (
                   <div key={d.id} className="group relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3 text-slate-500"><FileText size={24}/></div>
                      <p className="font-bold text-sm truncate text-slate-700" title={d.name}>{d.name}</p>
                      <p className="text-xs text-slate-400 mb-2">{d.type}</p>
                      <div className="flex justify-center gap-2">
                         <a href={d.url} target="_blank" className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded hover:bg-brand-100">İndir</a>
                         <button onClick={() => handleDeleteDoc(d.id)} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100"><Trash2 size={12}/></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ShipmentDetail;