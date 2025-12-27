
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Offer, Customer, OfferStatus, ShipmentStatus } from '../types';
import { Plus, Search, FileText, CheckCircle, XCircle, Trash2, ArrowRight, Printer, X, Truck, Calendar, MapPin, Mail, Phone } from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';

const Offers: React.FC = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  
  // Settings for Print
  const [settings, setSettings] = useState<any>({});

  const navigate = useNavigate();

  // Form
  const [formData, setFormData] = useState<Partial<Offer>>({
    customerId: '',
    origin: '',
    destination: '',
    transportMode: 'deniz',
    description: '',
    price: 0,
    currency: 'USD',
    status: OfferStatus.DRAFT,
    validUntil: ''
  });

  useEffect(() => {
    loadData();
    const saved = localStorage.getItem('invoiceSettings');
    if(saved) setSettings(JSON.parse(saved));
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [offerRes, customerRes] = await Promise.all([
      supabaseService.getOffers(),
      supabaseService.getCustomers()
    ]);
    if (offerRes.data) setOffers(offerRes.data);
    if (customerRes.data) setCustomers(customerRes.data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.createOffer(formData);
    setShowModal(false);
    loadData();
    setFormData({ customerId: '', origin: '', destination: '', transportMode: 'deniz', description: '', price: 0, currency: 'USD', status: OfferStatus.DRAFT, validUntil: '' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu teklifi silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteOffer(id);
    loadData();
  };

  const handleStatusChange = async (id: string, newStatus: OfferStatus) => {
    await supabaseService.updateOfferStatus(id, newStatus);
    loadData();
  };

  const handlePrintPreview = (offer: Offer) => {
    setSelectedOffer(offer);
    setShowPrintModal(true);
  };

  const convertToShipment = async (offer: Offer) => {
    if (!confirm('Bu teklifi onaylayıp yeni bir sevkiyat dosyasına dönüştürmek istiyor musunuz?')) return;
    
    // 1. Mark offer as accepted
    await supabaseService.updateOfferStatus(offer.id, OfferStatus.ACCEPTED);

    // 2. Create shipment
    const shipmentData = {
       referenceNo: `LOG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
       customerId: offer.customerId,
       transportMode: offer.transportMode,
       loadType: 'FCL' as 'FCL' | 'LCL', // Cast explicitly
       description: offer.description,
       origin: offer.origin,
       destination: offer.destination,
       status: ShipmentStatus.PREPARING,
       senderName: '-',
       receiverName: '-',
    };

    const res = await supabaseService.createShipment(shipmentData);
    
    if (res.data) {
        // 3. Add Finance item (Income)
        await supabaseService.addFinance({
            shipmentId: res.data.id,
            type: 'gelir',
            description: 'Teklif Bedeli',
            amount: offer.price,
            currency: offer.currency as any
        });
        
        navigate(`/shipments/${res.data.id}`);
    }
  };

  const filteredOffers = offers.filter(o => 
    (o.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) || 
    o.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Teklifler</h1>
          <p className="text-slate-500">Müşteri fiyat teklifleri ve yönetimi.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Yeni Teklif
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Müşteri veya açıklama ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
           {loading ? (
             <p className="col-span-full text-center text-slate-500">Yükleniyor...</p>
           ) : filteredOffers.length === 0 ? (
             <p className="col-span-full text-center text-slate-500">Kayıt bulunamadı.</p>
           ) : (
             filteredOffers.map(offer => (
               <div key={offer.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition bg-white flex flex-col justify-between">
                 <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                         <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                           <FileText size={20} />
                         </div>
                         <div>
                           <h3 className="font-bold text-brand-900 line-clamp-1">{offer.customerName}</h3>
                           <p className="text-xs text-slate-500">{new Date(offer.created_at!).toLocaleDateString('tr-TR')}</p>
                         </div>
                      </div>
                      <span className={clsx("px-2 py-1 rounded text-xs font-bold", 
                        offer.status === OfferStatus.ACCEPTED ? "bg-green-100 text-green-700" :
                        offer.status === OfferStatus.REJECTED ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      )}>
                        {offer.status}
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                       <div className="text-sm font-medium text-slate-700">
                         {offer.origin} ➝ {offer.destination}
                       </div>
                       <p className="text-sm text-slate-500 line-clamp-2">{offer.description}</p>
                       <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                          <span className="text-xs font-bold text-slate-500">FİYAT</span>
                          <span className="font-mono font-bold text-lg text-brand-700">{offer.price.toLocaleString()} {offer.currency}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                   <div className="flex gap-2">
                     <button onClick={() => handleDelete(offer.id)} className="text-slate-400 hover:text-red-500 transition p-1.5 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                     <button onClick={() => handlePrintPreview(offer)} className="text-slate-400 hover:text-blue-500 transition p-1.5 hover:bg-blue-50 rounded" title="Yazdır"><Printer size={18} /></button>
                   </div>
                   
                   {offer.status !== OfferStatus.ACCEPTED && (
                     <div className="flex gap-2">
                        {offer.status !== OfferStatus.SENT && (
                          <button onClick={() => handleStatusChange(offer.id, OfferStatus.SENT)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-bold transition">
                            Gönderildi
                          </button>
                        )}
                        <button onClick={() => convertToShipment(offer)} className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded font-bold transition flex items-center gap-1">
                          Siparişe Çevir <ArrowRight size={12} />
                        </button>
                     </div>
                   )}
                   {offer.status === OfferStatus.ACCEPTED && (
                     <span className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> Siparişe Dönüştü</span>
                   )}
                 </div>
               </div>
             ))
           )}
        </div>
      </div>

       {/* Create Modal */}
       {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Yeni Teklif Oluştur</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Müşteri</label>
                  <SearchableSelect
                      options={customers.map(c => ({ id: c.id, label: c.name }))}
                      value={formData.customerId || ''}
                      onChange={(val) => setFormData({...formData, customerId: val})}
                      placeholder="Müşteri Ara..."
                      required
                  />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Çıkış</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Varış</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Açıklama / Hizmet Detayı</label>
                <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Örn: 20DC Konteyner Navlun + THC" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Fiyat</label>
                   <input type="number" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Para Birimi</label>
                   <select 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50"
                    value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}
                   >
                     <option value="USD">USD</option>
                     <option value="EUR">EUR</option>
                     <option value="GBP">GBP</option>
                     <option value="TRY">TRY</option>
                   </select>
                </div>
              </div>

               <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Geçerlilik Tarihi</label>
                   <input type="date" className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.validUntil} onChange={e => setFormData({...formData, validUntil: e.target.value})} />
                </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition">
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
       )}

       {/* Print Preview Modal - Identical PDF Output */}
       {showPrintModal && selectedOffer && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-0 backdrop-blur-sm overflow-auto print:p-0 print:bg-white print:fixed print:inset-0 print:z-[9999] print:block">
           <div className="bg-white w-full max-w-4xl min-h-[800px] shadow-2xl m-4 print:m-0 print:shadow-none print:w-full print:h-auto print:border-none relative animate-in fade-in duration-300">
             
             {/* Toolbar - Hidden in Print */}
             <div className="absolute top-0 right-0 p-4 flex gap-2 print:hidden">
               <button 
                 onClick={() => window.print()}
                 className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-700 transition"
               >
                 <Printer size={18} /> Yazdır / PDF
               </button>
               <button 
                 onClick={() => setShowPrintModal(false)}
                 className="bg-slate-200 text-slate-700 p-2 rounded-lg hover:bg-slate-300 transition"
               >
                 <X size={20} />
               </button>
             </div>

             {/* Document Content */}
             <div className="p-12 md:p-16 print:p-10 text-slate-900 font-serif">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
                   <div className="w-1/2">
                      {settings.logoUrl && <img src={settings.logoUrl} className="h-16 mb-4 object-contain" alt="Logo" />}
                      <h2 className="font-bold text-xl uppercase" style={{color: settings.primaryColor || '#000'}}>{settings.companyName || 'LOGYCY LOGISTICS'}</h2>
                      <p className="text-slate-500 text-xs mt-1 whitespace-pre-line">
                        {settings.address} {'\n'} {settings.phone}
                      </p>
                   </div>
                   <div className="text-right">
                      <h2 className="text-4xl font-extrabold text-slate-200 uppercase tracking-widest mb-2 print:text-gray-300">FİYAT TEKLİFİ</h2>
                      <p className="font-bold text-slate-700">Tarih: {new Date(selectedOffer.created_at || Date.now()).toLocaleDateString('tr-TR')}</p>
                      <p className="text-slate-500 text-sm">Teklif No: OFF-{selectedOffer.id.substring(0, 6).toUpperCase()}</p>
                   </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-12 mb-12">
                   <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sayın / Firma</h3>
                      <p className="text-xl font-bold text-brand-900 print:text-black">{selectedOffer.customerName}</p>
                   </div>
                   <div className="text-right">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Geçerlilik Tarihi</h3>
                      <p className="text-lg font-medium text-slate-800">
                        {selectedOffer.validUntil ? new Date(selectedOffer.validUntil).toLocaleDateString('tr-TR') : 'Belirtilmedi'}
                      </p>
                   </div>
                </div>

                {/* Route Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-12 flex justify-between items-center print:border print:bg-white print:border-gray-300">
                   <div className="flex items-center gap-3">
                      <MapPin className="text-brand-500 print:text-black" />
                      <div>
                         <span className="text-xs font-bold text-slate-400 block">ÇIKIŞ</span>
                         <span className="font-bold text-lg">{selectedOffer.origin}</span>
                      </div>
                   </div>
                   <div className="flex-1 border-b-2 border-dashed border-slate-300 mx-8 relative top-1"></div>
                   <div className="flex items-center gap-3 text-right">
                      <div>
                         <span className="text-xs font-bold text-slate-400 block">VARIŞ</span>
                         <span className="font-bold text-lg">{selectedOffer.destination}</span>
                      </div>
                      <MapPin className="text-accent-500 print:text-black" />
                   </div>
                </div>

                {/* Service Details */}
                <div className="mb-12">
                   <h3 className="font-bold text-brand-900 border-b border-slate-200 pb-2 mb-4 print:text-black">HİZMET DETAYLARI & FİYATLANDIRMA</h3>
                   <table className="w-full text-left">
                      <thead className="bg-brand-900 text-white text-sm print:bg-gray-100 print:text-black print:border-b print:border-black">
                         <tr>
                            <th className="p-3 rounded-l-lg print:rounded-none">Açıklama</th>
                            <th className="p-3">Taşıma Modu</th>
                            <th className="p-3 text-right rounded-r-lg print:rounded-none">Tutar</th>
                         </tr>
                      </thead>
                      <tbody className="text-slate-700">
                         <tr className="border-b border-slate-100">
                            <td className="p-4 font-medium">{selectedOffer.description}</td>
                            <td className="p-4 uppercase text-sm">{selectedOffer.transportMode}</td>
                            <td className="p-4 text-right font-bold text-lg">{selectedOffer.price.toLocaleString()} {selectedOffer.currency}</td>
                         </tr>
                      </tbody>
                   </table>
                   <div className="flex justify-end mt-4">
                      <div className="bg-accent-50 p-4 rounded-xl text-right w-64 print:border print:border-gray-300 print:bg-white">
                         <span className="block text-xs font-bold text-slate-500 uppercase">TOPLAM TEKLİF</span>
                         <span className="block text-2xl font-extrabold text-brand-900 print:text-black">{selectedOffer.price.toLocaleString()} {selectedOffer.currency}</span>
                      </div>
                   </div>
                </div>

                {/* Footer / Terms */}
                <div className="text-sm text-slate-500 border-t border-slate-200 pt-8 mt-auto">
                   <h4 className="font-bold text-slate-700 mb-2">Şartlar & Koşullar</h4>
                   <ul className="list-disc pl-5 space-y-1 mb-8">
                      <li>Bu teklif yukarıda belirtilen tarihe kadar geçerlidir.</li>
                      <li>Fiyatlara KDV dahil değildir (aksi belirtilmedikçe).</li>
                      <li>Ödeme vadesi, fatura tarihinden itibaren 15 gündür.</li>
                      <li>Yerel masraflar ve gümrük vergileri alıcıya aittir.</li>
                   </ul>
                   
                   <div className="flex justify-between items-end">
                      <div>
                         <p className="font-bold text-brand-900 print:text-black">{settings.companyName}</p>
                         <div className="flex gap-4 mt-2 text-xs">
                            <span className="flex items-center gap-1"><Mail size={12}/> {settings.email}</span>
                            <span className="flex items-center gap-1"><Phone size={12}/> {settings.phone}</span>
                         </div>
                      </div>
                      <div className="text-center w-40">
                         <div className="h-16 border-b border-slate-300 mb-2"></div>
                         <p className="text-xs font-bold">Kaşe / İmza</p>
                      </div>
                   </div>
                </div>

             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default Offers;
