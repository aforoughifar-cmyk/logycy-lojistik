
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shipment, ShipmentStatus } from '../types';
import { Plus, Search, Filter, Eye, FileText, X, LayoutGrid, List as ListIcon, MapPin, Calendar as CalendarIcon, ArrowRight, Trash2, Printer, Ship, Anchor, Package, DollarSign, Edit, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useShipments, useCreateShipment, useUpdateShipment, useDeleteShipment } from '../hooks/useQueries';
import { supabaseService } from '../services/supabaseService';
import AdvancedSearchPanel, { FilterState } from '../components/AdvancedSearchPanel';

const Shipments: React.FC = () => {
  // Pagination & Basic Search States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Increased limit for client-side filtering demo
  const [basicSearchTerm, setBasicSearchTerm] = useState('');
  
  // Advanced Search State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    searchTerm: '',
    dateStart: '',
    dateEnd: '',
    status: '',
    type: '', // Transport Mode
    minAmount: '',
    maxAmount: ''
  });

  // React Query Hooks (Fetching larger set for client-side filtering capability)
  const { data: shipmentsData, isLoading, isError, error: queryError } = useShipments(currentPage, itemsPerPage, basicSearchTerm);
  const createMutation = useCreateShipment();
  const updateMutation = useUpdateShipment();
  const deleteMutation = useDeleteShipment();

  const allShipments = shipmentsData?.data || [];
  
  // Client-Side Filtering Logic
  const filteredShipments = useMemo(() => {
    return allShipments.filter(s => {
        // 1. Basic Text Search (already handled by server mostly, but refined here)
        if (basicSearchTerm && !JSON.stringify(s).toLowerCase().includes(basicSearchTerm.toLowerCase())) return false;

        // 2. Advanced: Date Range (Check Created At or ETA)
        if (advancedFilters.dateStart) {
            const date = new Date(s.created_at || s.eta || '');
            if (date < new Date(advancedFilters.dateStart)) return false;
        }
        if (advancedFilters.dateEnd) {
            const date = new Date(s.created_at || s.eta || '');
            // End of day adjustment
            const endDate = new Date(advancedFilters.dateEnd);
            endDate.setHours(23, 59, 59);
            if (date > endDate) return false;
        }

        // 3. Advanced: Status
        if (advancedFilters.status && s.status !== advancedFilters.status) return false;

        // 4. Advanced: Transport Mode
        if (advancedFilters.type && s.transportMode !== advancedFilters.type) return false;

        return true;
    });
  }, [allShipments, basicSearchTerm, advancedFilters]);

  // View & Modal States
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<Shipment | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [printSettings, setPrintSettings] = useState<any>({});
  
  // Simplified Form Data
  const [formData, setFormData] = useState({
    referenceNo: '',
    description: '',
    transportMode: 'deniz',
    origin: '',
    destination: '',
    etd: '', 
    eta: '', 
    carrier: '',
    vesselName: '',
    loadType: 'FCL'
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('invoiceSettings');
    if (savedSettings) setPrintSettings(JSON.parse(savedSettings));
  }, []); 

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setBasicSearchTerm(e.target.value);
      setCurrentPage(1);
  };

  const handleOpenCreate = () => {
      setEditingId(null);
      setFormData({ 
          carrier: '', vesselName: '', referenceNo: '', transportMode: 'deniz', 
          origin: '', destination: '', etd: '', eta: '', description: '', loadType: 'FCL' 
      });
      setShowModal(true);
  };

  const handleOpenEdit = (shipment: Shipment) => {
      setEditingId(shipment.id);
      setFormData({
          referenceNo: shipment.referenceNo,
          description: shipment.description || '',
          transportMode: shipment.transportMode,
          origin: shipment.origin,
          destination: shipment.destination,
          etd: shipment.etd || '',
          eta: shipment.eta || '',
          carrier: shipment.carrier || '',
          vesselName: shipment.vesselName || '',
          loadType: (shipment.loadType as string) || 'FCL'
      });
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
       ...formData,
       transportMode: formData.transportMode as 'deniz' | 'hava' | 'kara',
       loadType: formData.loadType as 'FCL' | 'LCL',
    };

    try {
        if (editingId) {
            await updateMutation.mutateAsync({ id: editingId, updates: dataToSubmit });
            toast.success('Sevkiyat güncellendi.');
        } else {
            const createPayload = {
                ...dataToSubmit,
                customerId: null,
                customerName: null,
                status: ShipmentStatus.DRAFT,
                referenceNo: formData.referenceNo || `LOG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                senderName: '-',
                receiverName: '-',
            };
            await createMutation.mutateAsync(createPayload);
            toast.success('Sevkiyat dosyası açıldı.');
        }
        setShowModal(false);
    } catch (err: any) {
        toast.error('Hata: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
      if(!confirm('Bu sevkiyat dosyasını ve bağlı tüm verilerini silmek istediğinize emin misiniz?')) return;
      try {
          await deleteMutation.mutateAsync(id);
          toast.success('Dosya silindi');
      } catch (err: any) {
          toast.error('Silme başarısız: ' + err.message);
      }
  };

  const handlePrintClick = async (id: string) => {
      setPrintLoading(true);
      const res = await supabaseService.getShipmentById(id);
      if (res.data) {
          setPrintData(res.data);
          setShowPrintModal(true);
      } else {
          toast.error("Detaylar alınamadı.");
      }
      setPrintLoading(false);
  };

  // Grouping for Kanban based on filtered results
  const kanbanColumns = {
    'Hazırlık': filteredShipments.filter(s => [ShipmentStatus.DRAFT, ShipmentStatus.PREPARING, ShipmentStatus.BOOKED].includes(s.status)),
    'Yolda': filteredShipments.filter(s => [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CUSTOMS, ShipmentStatus.ARRIVED].includes(s.status)),
    'Tamamlandı': filteredShipments.filter(s => [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED].includes(s.status)),
  };

  const getFinancialSummary = (shipment: Shipment) => {
      const totals: Record<string, { income: number, expense: number }> = {};
      shipment.finance?.forEach(f => {
          const curr = f.currency || 'USD';
          if (!totals[curr]) totals[curr] = { income: 0, expense: 0 };
          if (f.type === 'gelir') totals[curr].income += Number(f.amount);
          else totals[curr].expense += Number(f.amount);
      });
      return totals;
  };

  if (isError) return <div className="p-10 text-center text-red-500">Veriler yüklenirken hata oluştu: {queryError?.message}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Sevkiyat Yönetimi</h1>
          <p className="text-slate-500">Ana dosyalar ve seferler (Master Shipments).</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-white border border-slate-200 rounded-xl p-1 flex">
              <button onClick={() => setViewMode('list')} className={clsx("p-2 rounded-lg transition", viewMode === 'list' ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}><ListIcon size={20} /></button>
              <button onClick={() => setViewMode('board')} className={clsx("p-2 rounded-lg transition", viewMode === 'board' ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}><LayoutGrid size={20} /></button>
           </div>
           <button 
             onClick={handleOpenCreate}
             className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
           >
             <Plus size={20} /> Yeni Dosya Aç
           </button>
        </div>
      </div>

      {/* Advanced Search Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative z-40">
          <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Hızlı Ara (Dosya No, Gemi Adı...)" 
                  value={basicSearchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
                />
                {isLoading && <Loader2 size={16} className="absolute right-3 top-3 animate-spin text-brand-500"/>}
              </div>
              
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={clsx(
                    "px-4 py-2.5 rounded-xl border font-bold text-sm flex items-center gap-2 transition",
                    isFilterOpen || Object.values(advancedFilters).some(x => x) 
                        ? "bg-brand-50 border-brand-200 text-brand-700" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                  <Filter size={18} /> Filtrele
                  {(advancedFilters.status || advancedFilters.dateStart || advancedFilters.type) && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
              </button>
          </div>

          {/* Advanced Panel */}
          <AdvancedSearchPanel 
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            onSearch={setAdvancedFilters}
            onClear={() => setAdvancedFilters({ searchTerm:'', dateStart:'', dateEnd:'', status:'', type:'', minAmount:'', maxAmount:'' })}
            enableDate={true}
            enableStatus={true}
            enableType={true}
            statusOptions={Object.values(ShipmentStatus)}
            typeOptions={['deniz', 'hava', 'kara']}
          />
      </div>

      {/* VIEW: KANBAN BOARD */}
      {viewMode === 'board' && (
         <div className="flex gap-6 overflow-x-auto pb-6 -mx-6 px-6 snap-x">
            {Object.entries(kanbanColumns).map(([title, items]) => (
               <div key={title} className="flex-none w-80 snap-center">
                  <div className="flex items-center justify-between mb-4 px-2">
                     <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                        <div className={clsx("w-2 h-2 rounded-full", title === 'Hazırlık' ? 'bg-blue-500' : title === 'Yolda' ? 'bg-orange-500' : 'bg-green-500')}></div>
                        {title}
                     </h3>
                     <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">{items.length}</span>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                     {items.map(shipment => (
                        <div key={shipment.id} className="block bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition group">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-xs font-bold text-slate-400">{shipment.referenceNo}</span>
                              <div className="flex gap-1">
                                  <button onClick={() => handlePrintClick(shipment.id)} className="text-slate-400 hover:text-brand-900" title="Yazdır"><Printer size={14}/></button>
                                  <button onClick={() => handleOpenEdit(shipment)} className="text-slate-400 hover:text-blue-600" title="Düzenle"><Edit size={14}/></button>
                                  <Link to={`/shipments/${shipment.id}`} className="text-slate-400 hover:text-brand-600" title="Detay"><Eye size={14}/></Link>
                                  <button onClick={() => handleDelete(shipment.id)} className="text-slate-400 hover:text-red-600" title="Sil"><Trash2 size={14}/></button>
                              </div>
                           </div>
                           <h4 className="font-bold text-brand-900 mb-1">{shipment.description || 'İsimsiz Sevkiyat'}</h4>
                           <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100/50 mb-3">
                              <span className="truncate max-w-[80px]">{shipment.origin}</span>
                              <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
                              <span className="truncate max-w-[80px]">{shipment.destination}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* VIEW: LIST TABLE */}
      {viewMode === 'list' && (
        <>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in relative z-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Ref No</th>
                  <th className="px-6 py-4">Sevkiyat Adı / Gemi</th>
                  <th className="px-6 py-4">Konteyner</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4">ETD</th>
                  <th className="px-6 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-6 py-5"><Skeleton className="h-6 w-full" /></td></tr>
                  ))
                ) : filteredShipments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10">
                      {allShipments.length > 0 ? "Filtre kriterlerine uygun kayıt bulunamadı." : "Kayıt bulunamadı."}
                  </td></tr>
                ) : (
                  filteredShipments.map((shipment) => {
                    const containerDisplay = shipment.containers && shipment.containers.length > 0 
                        ? `${shipment.containers[0].containerNo} ${shipment.containers.length > 1 ? `(+${shipment.containers.length - 1})` : ''}`
                        : '-';
                        
                    return (
                    <tr key={shipment.id} className="hover:bg-slate-50 transition group">
                      <td className="px-6 py-5 font-mono font-bold text-brand-700">{shipment.referenceNo}</td>
                      <td className="px-6 py-5">
                        <span className="text-brand-900 font-bold block">{shipment.description || 'Genel Yük'}</span>
                        <span className="text-xs text-slate-400">{shipment.vesselName}</span>
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex flex-col">
                          <span className="font-bold text-slate-800 font-mono">{containerDisplay}</span>
                          <span className="text-xs text-slate-400 uppercase">{shipment.transportMode} • {shipment.loadType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={clsx("px-3 py-1.5 rounded-full text-xs font-bold border", 
                          shipment.status === ShipmentStatus.DELIVERED ? "bg-green-50 text-green-700 border-green-100" :
                          shipment.status === ShipmentStatus.IN_TRANSIT ? "bg-blue-50 text-blue-700 border-blue-100" :
                          "bg-gray-50 text-gray-700 border-gray-100"
                        )}>{shipment.status}</span>
                      </td>
                      <td className="px-6 py-5 text-xs text-slate-500">
                        {shipment.etd ? new Date(shipment.etd).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => handlePrintClick(shipment.id)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-900 transition" title="Rapor Yazdır">
                               {printLoading && printData?.id === shipment.id ? <Loader2 size={18} className="animate-spin"/> : <Printer size={18} />}
                           </button>
                           <button onClick={() => handleOpenEdit(shipment)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-900 transition" title="Düzenle"><Edit size={18} /></button>
                           <Link to={`/shipments/${shipment.id}`} className="p-2 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-blue-600 transition" title="Detay"><Eye size={18} /></Link>
                           <button onClick={() => handleDelete(shipment.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition" title="Sil"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Modals and other components remain the same... */}
      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-8 py-5 flex justify-between items-center">
              <h3 className="text-white font-bold text-xl flex items-center gap-2"><Ship size={24}/> {editingId ? 'Dosya Düzenle' : 'Yeni Master Dosya'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition bg-white/10 p-1 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dosya Adı / Referans</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none font-medium bg-slate-50" 
                     value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Örn: 2025 Mart Çin Seferi" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Master Ref No (Opsiyonel)</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" 
                    value={formData.referenceNo} onChange={e => setFormData({...formData, referenceNo: e.target.value})} placeholder="Otomatik Üretilir" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Taşıyıcı (Line)</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" 
                    value={formData.carrier} onChange={e => setFormData({...formData, carrier: e.target.value})} placeholder="Örn: Maersk" />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase">Gemi Adı / Sefer No</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" 
                    value={formData.vesselName} onChange={e => setFormData({...formData, vesselName: e.target.value})} placeholder="Örn: MSC BELLA 204E" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Çıkış Limanı (POL)</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Varış Limanı (POD)</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
                </div>
              </div>

              {/* DATE FIELDS */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">ETD (Kalkış)</label>
                  <input 
                    type="date" 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" 
                    value={formData.etd} 
                    onChange={e => setFormData({...formData, etd: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">ETA (Varış)</label>
                  <input 
                    type="date" 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none" 
                    value={formData.eta} 
                    onChange={e => setFormData({...formData, eta: e.target.value})} 
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="w-full bg-accent-500 text-brand-900 py-3.5 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20 text-base flex justify-center items-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={18} className="animate-spin" />}
                  {editingId ? 'Güncelle' : 'Dosyayı Aç'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE SHIPMENT REPORT MODAL */}
      {showPrintModal && printData && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-0 backdrop-blur-sm overflow-auto print:p-0 print:bg-white print:fixed print:inset-0 print:z-[200] print:block">
            <div className="bg-white w-[210mm] min-h-[297mm] shadow-2xl m-4 print:m-0 print:shadow-none print:w-full print:h-auto print:border-none relative animate-in fade-in duration-300 mx-auto">
               
               {/* Toolbar - Hidden in Print */}
               <div className="absolute top-0 right-[-80px] p-4 flex flex-col gap-2 print:hidden">
                  <button onClick={() => window.print()} className="bg-brand-600 text-white p-3 rounded-full shadow-lg hover:bg-brand-700 transition" title="Yazdır">
                     <Printer size={24} />
                  </button>
                  <button onClick={() => setShowPrintModal(false)} className="bg-white text-slate-700 p-3 rounded-full shadow-lg hover:bg-slate-100 transition" title="Kapat">
                     <X size={24} />
                  </button>
               </div>

               {/* REPORT CONTENT */}
               <div className="p-12 print:p-10 font-sans text-slate-900 h-full flex flex-col">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                     <div className="w-2/3">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-brand-900 text-white p-3 font-black text-2xl tracking-tighter leading-none w-36 text-center print:bg-black">
                                LOGYCY
                                <span className="block text-[8px] font-normal tracking-normal italic mt-1 text-slate-300 print:text-white">Logistics</span>
                            </div>
                            <div className="h-12 w-px bg-slate-300"></div>
                            <div>
                                <h2 className="font-bold text-lg uppercase" style={{color: printSettings.primaryColor || '#000'}}>{printSettings.companyName || 'LOGYCY LOGISTICS LTD.'}</h2>
                                <p className="text-xs text-slate-500 whitespace-pre-line mt-1">
                                {printSettings.address || 'Gazimağusa Serbest Liman, KKTC'} {'\n'} {printSettings.phone || '+90 533 000 0000'}
                                </p>
                            </div>
                        </div>
                     </div>
                     <div className="text-right">
                        <h1 className="text-2xl font-extrabold text-slate-800 uppercase tracking-widest mb-1">DOSYA RAPORU</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">MASTER SHIPMENT REPORT</p>
                        <p className="mt-2 font-mono font-bold text-lg text-brand-700 print:text-black">{printData.referenceNo}</p>
                        <p className="text-xs text-slate-500">Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
                     </div>
                  </div>

                  {/* MASTER DETAILS GRID */}
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl mb-8 print:bg-white print:border-2 print:border-black">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                          <div className="flex justify-between border-b border-slate-200 pb-1">
                              <span className="text-xs font-bold text-slate-500 uppercase">Dosya Adı</span>
                              <span className="font-bold">{printData.description}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-200 pb-1">
                              <span className="text-xs font-bold text-slate-500 uppercase">Taşıma Modu</span>
                              <span className="font-bold uppercase">{printData.transportMode} / {printData.loadType}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-200 pb-1">
                              <span className="text-xs font-bold text-slate-500 uppercase">Gemi / Sefer</span>
                              <span className="font-bold">{printData.vesselName || '-'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-200 pb-1">
                              <span className="text-xs font-bold text-slate-500 uppercase">Taşıyıcı (Line)</span>
                              <span className="font-bold">{printData.carrier || '-'}</span>
                          </div>
                          
                          <div className="col-span-2 flex items-center justify-between pt-2">
                              <div className="flex items-center gap-2">
                                  <Anchor size={16} className="text-slate-400"/>
                                  <span className="font-bold text-lg">{printData.origin}</span>
                              </div>
                              <div className="flex-1 border-b-2 border-dashed border-slate-300 mx-4 relative top-[-4px]"></div>
                              <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">{printData.destination}</span>
                                  <Anchor size={16} className="text-slate-400"/>
                              </div>
                          </div>
                          <div className="col-span-2 flex justify-between text-xs text-slate-500">
                              <span>ETD: {printData.etd ? new Date(printData.etd).toLocaleDateString() : '-'}</span>
                              <span>ETA: {printData.eta ? new Date(printData.eta).toLocaleDateString() : '-'}</span>
                          </div>
                      </div>
                  </div>

                  {/* CONTAINERS SECTION */}
                  <div className="mb-8">
                      <h3 className="font-bold text-slate-800 border-b-2 border-slate-800 pb-1 mb-3 flex items-center gap-2">
                          <Package size={18}/> KONTEYNER LİSTESİ ({printData.containers?.length || 0})
                      </h3>
                      <table className="w-full text-sm text-left">
                          <thead>
                              <tr className="border-b border-slate-300 bg-slate-50 print:bg-gray-100">
                                  <th className="py-2 px-2">Konteyner No</th>
                                  <th className="py-2 px-2">Tip</th>
                                  <th className="py-2 px-2">Son Konum</th>
                                  <th className="py-2 px-2 text-right">Bekleme (Gün)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {printData.containers?.map((c, i) => (
                                  <tr key={i} className="border-b border-slate-100">
                                      <td className="py-2 px-2 font-mono font-bold">{c.containerNo}</td>
                                      <td className="py-2 px-2">{c.type}</td>
                                      <td className="py-2 px-2 text-xs">{c.lastLocation || '-'}</td>
                                      <td className="py-2 px-2 text-right">{c.waitingTimeDays || 0}</td>
                                  </tr>
                              ))}
                              {(!printData.containers || printData.containers.length === 0) && <tr><td colSpan={4} className="py-4 text-center text-slate-400 italic">Konteyner eklenmedi.</td></tr>}
                          </tbody>
                      </table>
                  </div>

                  {/* MANIFEST / DISTRIBUTION SUMMARY */}
                  <div className="mb-8">
                      <h3 className="font-bold text-slate-800 border-b-2 border-slate-800 pb-1 mb-3 flex items-center gap-2">
                          <ListIcon size={18}/> YÜK DAĞILIMI (MANİFESTO ÖZETİ)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                          {printData.manifest?.map((m, i) => (
                              <div key={i} className="border border-slate-200 p-3 rounded-lg print:border-black">
                                  <p className="font-bold text-sm mb-1 truncate">{m.customerName}</p>
                                  <p className="text-xs text-slate-500 mb-2">{m.goods.length} Kalem Ürün</p>
                                  <div className="text-xs space-y-1">
                                      {m.goods.map((g, gi) => (
                                          <div key={gi} className="flex justify-between border-b border-dashed border-slate-100 pb-1 last:border-0">
                                              <span className="truncate w-2/3">{g.description}</span>
                                              <span className="font-mono">{g.quantity} {g.packageType}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ))}
                          {(!printData.manifest || printData.manifest.length === 0) && <div className="col-span-2 py-4 text-center text-slate-400 italic">Yük dağılımi yapılmadı.</div>}
                      </div>
                  </div>

                  {/* FINANCE SUMMARY - PUSHED TO BOTTOM */}
                  <div className="mt-auto pt-4 border-t-2 border-slate-800">
                      <div className="flex justify-between items-end">
                          <div className="w-1/2">
                              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><DollarSign size={18}/> FİNANSAL ÖZET</h3>
                              <div className="text-xs space-y-1">
                                  {Object.entries(getFinancialSummary(printData)).map(([curr, val]) => {
                                      const net = val.income - val.expense;
                                      if(val.income === 0 && val.expense === 0) return null;
                                      return (
                                          <div key={curr} className="flex gap-4">
                                              <span className="font-bold w-10">{curr}:</span>
                                              <span className="text-green-700">Gelir: {val.income.toLocaleString()}</span>
                                              <span className="text-red-700">Gider: {val.expense.toLocaleString()}</span>
                                              <span className={clsx("font-bold", net >= 0 ? "text-slate-800" : "text-red-600")}>Net: {net.toLocaleString()}</span>
                                          </div>
                                      );
                                  })}
                                  {(!printData.finance || printData.finance.length === 0) && <span className="text-slate-400 italic">Finans kaydı yok.</span>}
                              </div>
                          </div>
                          
                          <div className="text-center">
                              <div className="mb-8">
                                  <p className="text-xs font-bold uppercase mb-8">ONAYLAYAN</p>
                                  <div className="w-32 border-b border-slate-400 mx-auto"></div>
                              </div>
                              <p className="text-[10px] text-slate-400">Logycy Management System v1.0</p>
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

export default Shipments;
