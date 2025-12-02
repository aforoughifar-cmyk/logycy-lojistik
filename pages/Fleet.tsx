import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Vehicle } from '../types';
import { Plus, Search, Truck, PenTool, Battery, User, Activity, AlertCircle, X, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const Fleet: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState<Partial<Vehicle>>({
    plateNo: '',
    type: 'Kamyon',
    brand: '',
    model: '',
    driverName: '',
    status: 'Aktif',
    fuelLevel: 50,
    lastMaintenance: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await supabaseService.getVehicles();
    if (result.data) setVehicles(result.data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.addVehicle(formData);
    toast.success('Araç eklendi');
    setFormData({ plateNo: '', type: 'Kamyon', brand: '', model: '', driverName: '', status: 'Aktif', fuelLevel: 50, lastMaintenance: '' });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Bu aracı silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteVehicle(id);
    toast.success('Araç silindi');
    loadData();
  };

  const filtered = vehicles.filter(v => v.plateNo.toLowerCase().includes(searchTerm.toLowerCase()));

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Aktif': return 'bg-green-100 text-green-700';
          case 'Seferde': return 'bg-blue-100 text-blue-700';
          case 'Bakımda': return 'bg-orange-100 text-orange-700';
          case 'Garajda': return 'bg-slate-100 text-slate-700';
          default: return 'bg-slate-100 text-slate-700';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Araç / Filo Yönetimi</h1>
          <p className="text-slate-500">Şirket araçları, rütuş ve bakım takibi.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Yeni Araç Ekle
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Plaka Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
           {loading ? (
             <p className="col-span-full text-center text-slate-500">Yükleniyor...</p>
           ) : filtered.length === 0 ? (
             <div className="col-span-full text-center py-10">
                <Truck size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Kayıtlı araç bulunamadı.</p>
             </div>
           ) : (
             filtered.map(v => (
               <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition group relative">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                           <Truck size={24} />
                        </div>
                        <div>
                           <h3 className="font-bold text-lg text-brand-900 font-mono tracking-wide">{v.plateNo}</h3>
                           <p className="text-xs text-slate-500">{v.brand} {v.model}</p>
                        </div>
                     </div>
                     <span className={clsx("px-2 py-1 rounded text-xs font-bold", getStatusColor(v.status))}>
                        {v.status}
                     </span>
                  </div>

                  <div className="space-y-3">
                     <div className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500 flex items-center gap-2"><User size={14}/> Sürücü</span>
                        <span className="font-medium text-slate-800">{v.driverName || '-'}</span>
                     </div>
                     
                     <div className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500 flex items-center gap-2"><PenTool size={14}/> Son Bakım</span>
                        <span className="font-medium text-slate-800">{v.lastMaintenance ? new Date(v.lastMaintenance).toLocaleDateString('tr-TR') : '-'}</span>
                     </div>

                     <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                           <span className="flex items-center gap-1"><Battery size={12}/> Yakıt Durumu</span>
                           <span>%{v.fuelLevel}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                           <div 
                             className={clsx("h-1.5 rounded-full", v.fuelLevel && v.fuelLevel < 20 ? "bg-red-500" : "bg-green-500")} 
                             style={{width: `${v.fuelLevel}%`}}
                           ></div>
                        </div>
                     </div>
                  </div>

                  <button 
                    onClick={() => handleDelete(v.id)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  >
                     <Trash2 size={18} />
                  </button>
               </div>
             ))
           )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Araç Ekle</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Plaka No</label>
                     <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.plateNo} onChange={e => setFormData({...formData, plateNo: e.target.value})} placeholder="34 AB 123" />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Araç Tipi</label>
                     <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                        value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                        <option value="Kamyon">Kamyon</option>
                        <option value="Tır">Tır</option>
                        <option value="Van">Van / Panelvan</option>
                        <option value="Forklift">Forklift</option>
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Marka</label>
                     <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Model</label>
                     <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                  </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Atanan Sürücü</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.driverName} onChange={e => setFormData({...formData, driverName: e.target.value})} placeholder="Opsiyonel" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Durum</label>
                     <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                        value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value="Aktif">Aktif</option>
                        <option value="Seferde">Seferde</option>
                        <option value="Garajda">Garajda</option>
                        <option value="Bakımda">Bakımda</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Yakıt (%)</label>
                     <input type="number" className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.fuelLevel} onChange={e => setFormData({...formData, fuelLevel: Number(e.target.value)})} />
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

export default Fleet;