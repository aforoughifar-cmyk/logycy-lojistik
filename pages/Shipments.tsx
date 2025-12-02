import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Shipment, ShipmentStatus, Customer } from '../types';
import { Plus, Search, Filter, Eye, MoreHorizontal, FileText, X, LayoutGrid, List as ListIcon, MapPin, Calendar as CalendarIcon, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import clsx from 'clsx';

const Shipments: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showModal, setShowModal] = useState(false);
  
  // Updated Form Data
  const [formData, setFormData] = useState({
    customerId: '',
    referenceNo: '',
    transportMode: 'deniz',
    origin: '',
    destination: '',
    etd: '',
    eta: '',
    description: '',
    loadType: 'FCL'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // await new Promise(r => setTimeout(r, 1000)); // optional delay to see skeleton
    const [shipmentRes, customerRes] = await Promise.all([
      supabaseService.getAllShipments(),
      supabaseService.getCustomers()
    ]);
    
    if (shipmentRes.data) setShipments(shipmentRes.data);
    if (customerRes.data) setCustomers(customerRes.data);
    
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
       ...formData,
       status: ShipmentStatus.DRAFT,
       referenceNo: formData.referenceNo || `LOG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    };
    await supabaseService.createShipment(dataToSubmit);
    setShowModal(false);
    loadData();
  };

  const filteredShipments = shipments.filter(s => 
    s.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Grouping for Kanban
  const kanbanColumns = {
    'Hazırlık': filteredShipments.filter(s => [ShipmentStatus.DRAFT, ShipmentStatus.PREPARING, ShipmentStatus.BOOKED].includes(s.status)),
    'Yolda': filteredShipments.filter(s => [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CUSTOMS, ShipmentStatus.ARRIVED].includes(s.status)),
    'Teslim Edildi': filteredShipments.filter(s => s.status === ShipmentStatus.DELIVERED),
    'İptal': filteredShipments.filter(s => s.status === ShipmentStatus.CANCELLED),
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    
    // Adjust for Monday start (Turkey/Cyprus standard)
    const startingDay = firstDay === 0 ? 6 : firstDay - 1; 
    
    const days = [];
    // Previous month filler
    for(let i=0; i<startingDay; i++) days.push(null);
    // Current month days
    for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));
    
    return days;
  };

  const calendarDays = getDaysInMonth(currentDate);

  const getEventsForDate = (date: Date) => {
      const dateStr = date.toISOString().slice(0,10);
      return filteredShipments.filter(s => 
          s.etd === dateStr || s.eta === dateStr
      );
  };

  const changeMonth = (offset: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + offset);
      setCurrentDate(newDate);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Sevkiyat Yönetimi</h1>
          <p className="text-slate-500">Aktif dosyalar ve kargo durumları.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-white border border-slate-200 rounded-xl p-1 flex">
              <button 
                onClick={() => setViewMode('list')}
                className={clsx("p-2 rounded-lg transition", viewMode === 'list' ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                title="Liste Görünümü"
              >
                 <ListIcon size={20} />
              </button>
              <button 
                onClick={() => setViewMode('board')}
                className={clsx("p-2 rounded-lg transition", viewMode === 'board' ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                title="Kanban (Board) Görünümü"
              >
                 <LayoutGrid size={20} />
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={clsx("p-2 rounded-lg transition", viewMode === 'calendar' ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                title="Takvim Görünümü"
              >
                 <CalendarIcon size={20} />
              </button>
           </div>
           <button 
             onClick={() => {
                setFormData({
                   customerId: '', referenceNo: '', transportMode: 'deniz',
                   origin: '', destination: '', etd: '', eta: '', description: '', loadType: 'FCL'
                });
                setShowModal(true);
             }}
             className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
           >
             <Plus size={20} /> Yeni Dosya
           </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Referans No veya Müşteri Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
          
          {viewMode === 'calendar' && (
             <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded-full hover:shadow-sm transition"><ChevronLeft size={20}/></button>
                <span className="font-bold text-slate-700 min-w-[140px] text-center">
                    {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded-full hover:shadow-sm transition"><ChevronRight size={20}/></button>
             </div>
          )}

          {viewMode !== 'calendar' && (
            <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 bg-white text-sm font-bold shadow-sm transition">
                <Filter size={16} /> Filtrele
            </button>
          )}
        </div>
      </div>

      {/* VIEW: KANBAN BOARD */}
      {viewMode === 'board' && (
         <div className="flex gap-6 overflow-x-auto pb-6 -mx-6 px-6 snap-x">
            {Object.entries(kanbanColumns).map(([title, items], colIdx) => (
               <div key={title} className="flex-none w-80 snap-center">
                  <div className="flex items-center justify-between mb-4 px-2">
                     <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                        <div className={clsx("w-2 h-2 rounded-full", 
                           title === 'Hazırlık' ? 'bg-blue-500' : 
                           title === 'Yolda' ? 'bg-orange-500' :
                           title === 'Teslim Edildi' ? 'bg-green-500' : 'bg-slate-300'
                        )}></div>
                        {title}
                     </h3>
                     <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">{items.length}</span>
                  </div>
                  
                  <div className="space-y-3 min-h-[200px]">
                     {items.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 text-center text-xs text-slate-300">
                           Kayıt yok
                        </div>
                     ) : (
                        items.map(shipment => (
                           <Link 
                              to={`/shipments/${shipment.id}`} 
                              key={shipment.id}
                              className="block bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-brand-200 transition group animate-fade-in"
                           >
                              <div className="flex justify-between items-start mb-2">
                                 <span className="font-mono text-xs font-bold text-slate-400">{shipment.referenceNo}</span>
                                 <span className="text-[10px] font-bold uppercase bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">{shipment.transportMode}</span>
                              </div>
                              <h4 className="font-bold text-brand-900 mb-1 line-clamp-1">{shipment.customerName}</h4>
                              <p className="text-xs text-slate-500 mb-3 line-clamp-1">{shipment.description}</p>
                              
                              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100/50 mb-3">
                                 <span className="font-medium truncate max-w-[80px]">{shipment.origin}</span>
                                 <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
                                 <span className="font-medium truncate max-w-[80px]">{shipment.destination}</span>
                              </div>

                              <div className="flex justify-between items-center text-[10px] text-slate-400">
                                 <div className="flex items-center gap-1">
                                    <CalendarIcon size={12}/> {shipment.eta ? new Date(shipment.eta).toLocaleDateString('tr-TR') : '-'}
                                 </div>
                                 <div className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-600 font-bold flex items-center gap-1">
                                    Detay <ArrowRight size={10} />
                                 </div>
                              </div>
                           </Link>
                        ))
                     )}
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* VIEW: CALENDAR */}
      {viewMode === 'calendar' && (
         <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
               {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
                  <div key={d} className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{d}</div>
               ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr">
               {calendarDays.map((date, idx) => {
                  if (!date) return <div key={idx} className="bg-slate-50/30 border-b border-r border-slate-100 min-h-[120px]"></div>;
                  
                  const events = getEventsForDate(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dateStr = date.toISOString().slice(0,10);

                  return (
                     <div key={idx} className={clsx("border-b border-r border-slate-100 p-2 min-h-[120px] relative transition hover:bg-slate-50", isToday && "bg-blue-50/30")}>
                        <div className={clsx("text-sm font-bold mb-2 w-7 h-7 flex items-center justify-center rounded-full", isToday ? "bg-accent-500 text-brand-900 shadow-sm" : "text-slate-700")}>
                           {date.getDate()}
                        </div>
                        <div className="space-y-1.5">
                           {events.map(ev => (
                              <Link to={`/shipments/${ev.id}`} key={ev.id} className="block text-[10px] p-1.5 rounded border shadow-sm hover:shadow transition bg-white group">
                                 <div className="font-bold text-slate-800 truncate">{ev.customerName}</div>
                                 <div className="flex items-center gap-1 mt-0.5">
                                    {ev.etd === dateStr ? (
                                       <span className="bg-blue-100 text-blue-700 px-1 rounded text-[9px] font-bold">ETD</span>
                                    ) : (
                                       <span className="bg-green-100 text-green-700 px-1 rounded text-[9px] font-bold">ETA</span>
                                    )}
                                    <span className="text-slate-500 truncate">{ev.referenceNo}</span>
                                 </div>
                              </Link>
                           ))}
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      )}

      {/* VIEW: LIST TABLE */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Ref No</th>
                  <th className="px-6 py-4">Müşteri</th>
                  <th className="px-6 py-4">Rota / Tip</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4">ETD / ETA</th>
                  <th className="px-6 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-5"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-6 py-5">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-6 py-5">
                        <Skeleton className="h-4 w-40 mb-2" />
                        <Skeleton className="h-3 w-16" />
                      </td>
                      <td className="px-6 py-5"><Skeleton className="h-6 w-24 rounded-full" /></td>
                      <td className="px-6 py-5">
                        <Skeleton className="h-3 w-24 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </td>
                      <td className="px-6 py-5 text-right"><Skeleton className="h-8 w-8 rounded-lg ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredShipments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10">Kayıt bulunamadı.</td></tr>
                ) : (
                  filteredShipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-slate-50 transition group">
                      <td className="px-6 py-5 font-mono font-bold text-brand-700">{shipment.referenceNo}</td>
                      <td className="px-6 py-5">
                        <span className="text-brand-900 font-bold block">{shipment.customerName}</span>
                        <span className="text-xs text-slate-400">{shipment.description}</span>
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{shipment.origin} ➝ {shipment.destination}</span>
                          <span className="text-xs text-slate-400 uppercase">{shipment.transportMode} • {shipment.loadType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={clsx(
                          "px-3 py-1.5 rounded-full text-xs font-bold border",
                          shipment.status === ShipmentStatus.DELIVERED ? "bg-green-50 text-green-700 border-green-100" :
                          shipment.status === ShipmentStatus.IN_TRANSIT ? "bg-blue-50 text-blue-700 border-blue-100" :
                          "bg-gray-50 text-gray-700 border-gray-100"
                        )}>
                          {shipment.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs space-y-1">
                          <div><span className="text-slate-400">ETD:</span> {shipment.etd}</div>
                          <div><span className="text-slate-400">ETA:</span> {shipment.eta}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Link to={`/shipments/${shipment.id}`} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-600 transition" title="Detay"><Eye size={18} /></Link>
                           <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-600 transition" title="Etiket Yazdır"><FileText size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal - Create Shipment */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-8 py-5 flex justify-between items-center">
              <h3 className="text-white font-bold text-xl">Yeni Sevkiyat Dosyası</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition bg-white/10 p-1 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-8 space-y-5">
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Müşteri Seçimi</label>
                  <select 
                    required 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none font-medium bg-slate-50"
                    value={formData.customerId} 
                    onChange={e => setFormData({...formData, customerId: e.target.value})}
                  >
                    <option value="">Seçiniz...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Açıklama (Konu)</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none font-medium bg-slate-50" 
                     value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Örn: 2 Knt Mobilya" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Taşıma Modu</label>
                   <select 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-slate-50"
                    value={formData.transportMode} onChange={e => setFormData({...formData, transportMode: e.target.value})}
                   >
                     <option value="deniz">Deniz Yolu</option>
                     <option value="hava">Hava Yolu</option>
                     <option value="kara">Kara Yolu</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Yük Tipi</label>
                   <select 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-slate-50"
                    value={formData.loadType} onChange={e => setFormData({...formData, loadType: e.target.value})}
                   >
                     <option value="FCL">FCL (Full)</option>
                     <option value="LCL">LCL (Parsiyel)</option>
                   </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Özel Ref No (Opsiyonel)</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none font-medium bg-slate-50" 
                    value={formData.referenceNo} onChange={e => setFormData({...formData, referenceNo: e.target.value})} placeholder="Otomatik..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Çıkış (Origin)</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none font-medium bg-slate-50" 
                    value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Varış (Destination)</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none font-medium bg-slate-50" 
                    value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">ETD (Tahmini Çıkış)</label>
                   <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none font-medium bg-slate-50" 
                      value={formData.etd} onChange={e => setFormData({...formData, etd: e.target.value})} />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">ETA (Tahmini Varış)</label>
                   <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none font-medium bg-slate-50" 
                      value={formData.eta} onChange={e => setFormData({...formData, eta: e.target.value})} />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3.5 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20 text-base">
                  Taslak Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;