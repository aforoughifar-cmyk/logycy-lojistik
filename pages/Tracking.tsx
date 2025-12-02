import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Shipment, ShipmentStatus } from '../types';
import { Search, MapPin, Calendar, Package, AlertCircle, Check, ArrowRight, Truck, Anchor, CheckCircle2 } from 'lucide-react';
import LiveMap from '../components/LiveMap';
import clsx from 'clsx';

const Tracking: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || '';
  
  const [trackingNumber, setTrackingNumber] = useState(initialId);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialId) {
      handleTrack(initialId);
    }
  }, []);

  const handleTrack = async (id: string) => {
    setLoading(true);
    setError(null);
    setShipment(null);
    
    setSearchParams({ id });

    const result = await supabaseService.getShipmentByTrackingNumber(id);
    
    if (result.error) {
      setError('Kayıt bulunamadı veya takip numarası hatalı.');
    } else {
      setShipment(result.data);
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber) handleTrack(trackingNumber);
  };

  // Needed for icon component usage below
  const Clipboard = (props: any) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
  );

  // Progress Steps Definition
  const steps = [
    { key: 'order', label: 'Sipariş Alındı', icon: Package, statuses: [ShipmentStatus.DRAFT, ShipmentStatus.BOOKED] },
    { key: 'preparing', label: 'Hazırlanıyor', icon: Clipboard, statuses: [ShipmentStatus.PREPARING, ShipmentStatus.CUSTOMS] },
    { key: 'transit', label: 'Yolda', icon: Truck, statuses: [ShipmentStatus.IN_TRANSIT] },
    { key: 'arrived', label: 'Varış Ülkesinde', icon: Anchor, statuses: [ShipmentStatus.ARRIVED] },
    { key: 'delivered', label: 'Teslim Edildi', icon: CheckCircle2, statuses: [ShipmentStatus.DELIVERED] },
  ];

  // Helper to check if step is active or completed
  const getStepStatus = (stepIndex: number, currentStatus: ShipmentStatus) => {
     // Simplified logic mapping
     const statusMap: Record<string, number> = {
        [ShipmentStatus.DRAFT]: 0,
        [ShipmentStatus.BOOKED]: 0,
        [ShipmentStatus.PREPARING]: 1,
        [ShipmentStatus.CUSTOMS]: 1,
        [ShipmentStatus.IN_TRANSIT]: 2,
        [ShipmentStatus.ARRIVED]: 3,
        [ShipmentStatus.DELIVERED]: 4,
        [ShipmentStatus.CANCELLED]: -1
     };
     
     const currentLevel = statusMap[currentStatus] ?? 0;
     if (currentLevel > stepIndex) return 'completed';
     if (currentLevel === stepIndex) return 'active';
     return 'pending';
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:py-12">
      <div className="max-w-5xl mx-auto">
        
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-brand-900 rounded-2xl shadow-xl mb-4">
             <Truck className="text-accent-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Kargo Takip</h1>
          <p className="text-slate-500 mt-2">Logycy Lojistik Hizmetleri</p>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-2 mb-10 border border-slate-100 max-w-2xl mx-auto transform hover:-translate-y-1 transition duration-300">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Takip numarasını giriniz (Örn: LOG-...)"
                className="w-full pl-6 pr-4 py-4 rounded-xl outline-none text-slate-700 placeholder-slate-400 font-medium"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-brand-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-brand-800 transition disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-brand-900/20"
            >
              {loading ? '...' : <><Search size={20} /> Sorgula</>}
            </button>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-2xl mx-auto bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 mb-8 border border-red-100 animate-in slide-in-from-bottom-2">
            <AlertCircle size={24} />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Result State */}
        {shipment && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Status Card & Map */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Details */}
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                   <div>
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 inline-block">
                        {shipment.transportMode} Kargo
                      </span>
                      <h2 className="text-3xl font-black text-brand-900 mb-1">{shipment.referenceNo}</h2>
                      <p className="text-slate-500 text-sm mb-6">Müşteri Referansı: {shipment.description || '-'}</p>
                      
                      <div className="space-y-6 relative">
                         {/* Connecting Line */}
                         <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200"></div>

                         <div className="relative flex items-start gap-4">
                            <div className="w-6 h-6 rounded-full bg-blue-100 border-4 border-white shadow-sm flex items-center justify-center relative z-10">
                               <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            </div>
                            <div>
                               <p className="text-xs text-slate-400 uppercase font-bold">Çıkış Noktası</p>
                               <p className="font-bold text-slate-900 text-lg">{shipment.origin}</p>
                               <p className="text-xs text-slate-500">{shipment.senderName}</p>
                            </div>
                         </div>

                         <div className="relative flex items-start gap-4">
                            <div className="w-6 h-6 rounded-full bg-green-100 border-4 border-white shadow-sm flex items-center justify-center relative z-10">
                               <div className="w-2 h-2 rounded-full bg-green-600"></div>
                            </div>
                            <div>
                               <p className="text-xs text-slate-400 uppercase font-bold">Varış Noktası</p>
                               <p className="font-bold text-slate-900 text-lg">{shipment.destination}</p>
                               <p className="text-xs text-slate-500">{shipment.receiverName}</p>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3 mb-2">
                         <Calendar className="text-brand-600" size={20}/>
                         <div>
                            <p className="text-xs text-slate-400 font-bold">TAHMİNİ TESLİMAT</p>
                            <p className="font-bold text-slate-800">{shipment.eta || 'Belirlenmedi'}</p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Live Map */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[300px] lg:min-h-full group">
                   <LiveMap origin={shipment.origin} destination={shipment.destination} />
                   <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm z-[400] flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Canlı İzleme
                   </div>
                </div>
            </div>

            {/* Visual Progress Stepper */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 overflow-x-auto">
               <div className="min-w-[600px]">
                  <div className="flex justify-between items-center relative">
                     {/* Background Line */}
                     <div className="absolute left-0 top-1/2 w-full h-1 bg-slate-100 -z-0 -translate-y-1/2 rounded-full"></div>
                     {/* Active Line (Calculated mostly visually here for simplicity) */}
                     
                     {steps.map((step, idx) => {
                        const status = getStepStatus(idx, shipment.status);
                        const StepIcon = step.icon;
                        
                        return (
                           <div key={step.key} className="relative z-10 flex flex-col items-center gap-3 group">
                              <div className={clsx(
                                 "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                                 status === 'completed' ? "bg-green-500 border-green-100 text-white" :
                                 status === 'active' ? "bg-brand-900 border-brand-100 text-white scale-110 shadow-lg" :
                                 "bg-white border-slate-200 text-slate-300"
                              )}>
                                 {status === 'completed' ? <Check size={20} strokeWidth={3} /> : <StepIcon size={20} />}
                              </div>
                              <div className="text-center">
                                 <p className={clsx("font-bold text-sm", status === 'pending' ? "text-slate-400" : "text-slate-900")}>{step.label}</p>
                                 {status === 'active' && <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded mt-1 inline-block animate-pulse">İşleniyor</span>}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>

            {/* Detailed History */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800">Hareket Geçmişi</h3>
               </div>
               <div className="divide-y divide-slate-100">
                  {shipment.history && shipment.history.length > 0 ? (
                     shipment.history.map((event, idx) => (
                        <div key={idx} className="p-6 flex gap-6 hover:bg-slate-50 transition">
                           <div className="min-w-[100px] text-right">
                              <p className="font-bold text-slate-900">{new Date(event.date).toLocaleDateString('tr-TR')}</p>
                              <p className="text-xs text-slate-400">{new Date(event.date).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</p>
                           </div>
                           <div className="relative pl-6 border-l-2 border-slate-200">
                              <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-brand-200"></div>
                              <p className="font-bold text-slate-800 mb-1">{event.description}</p>
                              <p className="text-sm text-slate-500 flex items-center gap-1">
                                 <MapPin size={14}/> {event.location}
                              </p>
                           </div>
                        </div>
                     ))
                  ) : (
                     <div className="p-8 text-center text-slate-400">Henüz hareket kaydı girilmedi.</div>
                  )}
               </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Tracking;