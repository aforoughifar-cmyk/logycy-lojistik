import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Shipment, ShipmentStatus } from '../types';
import { Plus, Package, Truck, Search, RefreshCw } from 'lucide-react';

const Admin: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // New shipment form state
  const [formData, setFormData] = useState({
    senderName: '',
    receiverName: '',
    origin: '',
    destination: '',
    referenceNo: `LOG-TR-${Math.floor(100000 + Math.random() * 900000)}`,
    status: ShipmentStatus.PREPARING,
    eta: ''
  });

  const fetchShipments = async () => {
    setLoading(true);
    const result = await supabaseService.getAllShipments();
    if (result.data) {
      setShipments(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    // Default values for missing fields in this simplified form
    const dataToSubmit = {
        ...formData,
        transportMode: 'deniz' as 'deniz' | 'hava' | 'kara',
        loadType: 'FCL' as 'FCL' | 'LCL',
        description: 'Yeni Gönderi'
    };
    const result = await supabaseService.createShipment(dataToSubmit);
    if (result.data) {
      setShowModal(false);
      fetchShipments(); // Refresh list
      // Reset form
      setFormData({
        senderName: '',
        receiverName: '',
        origin: '',
        destination: '',
        referenceNo: `LOG-TR-${Math.floor(100000 + Math.random() * 900000)}`,
        status: ShipmentStatus.PREPARING,
        eta: ''
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Yönetim Paneli</h1>
            <p className="text-slate-500">Tüm kargo süreçlerini buradan yönetebilirsiniz.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition flex items-center gap-2"
          >
            <Plus size={20} /> Yeni Gönderi Oluştur
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <Package size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Toplam Gönderi</p>
              <p className="text-2xl font-bold text-slate-900">{shipments.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
             <div className="bg-orange-100 p-3 rounded-full text-orange-600">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Yoldaki Kargolar</p>
              <p className="text-2xl font-bold text-slate-900">
                {shipments.filter(s => s.status === ShipmentStatus.IN_TRANSIT).length}
              </p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
             <div className="bg-green-100 p-3 rounded-full text-green-600">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Son Güncelleme</p>
              <p className="text-sm font-semibold text-slate-900">Az önce</p>
            </div>
          </div>
        </div>

        {/* Shipments Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-slate-700">Son Gönderiler</h2>
            <div className="relative">
              <input type="text" placeholder="Ara..." className="pl-8 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Takip No</th>
                  <th className="px-6 py-4">Gönderici</th>
                  <th className="px-6 py-4">Alıcı</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4">Konum</th>
                  <th className="px-6 py-4">Tahmini Teslim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8">Yükleniyor...</td></tr>
                ) : shipments.length === 0 ? (
                   <tr><td colSpan={6} className="text-center py-8">Kayıt bulunamadı.</td></tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-medium text-brand-600">{shipment.referenceNo}</td>
                      <td className="px-6 py-4">{shipment.senderName || '-'}</td>
                      <td className="px-6 py-4">{shipment.receiverName || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                          ${shipment.status === ShipmentStatus.DELIVERED ? 'bg-green-100 text-green-700' : 
                            shipment.status === ShipmentStatus.IN_TRANSIT ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                          {shipment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{shipment.history && shipment.history.length > 0 ? shipment.history[shipment.history.length - 1].location : '-'}</td>
                      <td className="px-6 py-4">{shipment.eta || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Shipment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-brand-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Yeni Kargo Oluştur</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleCreateShipment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gönderici Adı</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-md p-2" 
                    value={formData.senderName} onChange={e => setFormData({...formData, senderName: e.target.value})} />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alıcı Adı</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-md p-2" 
                    value={formData.receiverName} onChange={e => setFormData({...formData, receiverName: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Çıkış Yeri</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-md p-2" 
                    value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Varış Yeri</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-md p-2" 
                    value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
                </div>
              </div>

               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tahmini Teslim Tarihi</label>
                  <input required type="date" className="w-full border border-slate-300 rounded-md p-2" 
                    value={formData.eta} onChange={e => setFormData({...formData, eta: e.target.value})} />
                </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-md hover:bg-slate-200 transition">İptal</button>
                <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 transition">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;