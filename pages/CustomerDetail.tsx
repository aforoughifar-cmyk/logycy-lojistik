import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Customer } from '../types';
import { ArrowLeft, Phone, Mail, MapPin, Building2, User, Package, DollarSign, Printer } from 'lucide-react';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (customerId: string) => {
    setLoading(true);
    const [custRes, shipRes] = await Promise.all([
      supabaseService.getCustomerById(customerId),
      supabaseService.getCustomerShipments(customerId)
    ]);
    
    if (custRes.data) setCustomer(custRes.data);
    if (shipRes.data) setShipments(shipRes.data);
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!customer) return <div className="p-10 text-center text-red-500">Müşteri bulunamadı.</div>;

  const totalRevenue = shipments.reduce((acc, curr) => acc + (curr.totalIncome || 0), 0);
  const activeJobs = shipments.filter(s => s.status !== 'Teslim Edildi' && s.status !== 'İptal').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition">
          <ArrowLeft size={24} />
        </button>
        <div>
           <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
             {customer.name}
             <span className="text-xs px-2 py-1 bg-slate-200 rounded text-slate-600 font-mono uppercase">{customer.type}</span>
           </h1>
           <p className="text-slate-500 text-sm">Müşteri Profili ve Geçmişi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
             <div className="flex items-center justify-center mb-6">
               <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  {customer.type === 'kurumsal' ? <Building2 size={40} /> : <User size={40} />}
               </div>
             </div>
             <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-600">
                  <Phone size={18} className="text-slate-400"/>
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail size={18} className="text-slate-400"/>
                  <span className="text-sm truncate">{customer.email}</span>
                </div>
                <div className="flex items-start gap-3 text-slate-600">
                  <MapPin size={18} className="text-slate-400 mt-1"/>
                  <span className="text-sm">{customer.address || '-'}</span>
                </div>
             </div>
          </div>
          
          <div className="bg-brand-900 text-white rounded-xl shadow-sm p-6 relative overflow-hidden">
             <div className="relative z-10">
                <p className="text-brand-200 text-sm font-medium mb-1">Toplam Ciro</p>
                <p className="text-3xl font-extrabold text-accent-400">${totalRevenue.toLocaleString()}</p>
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                   <span className="text-sm text-brand-200">Toplam Dosya</span>
                   <span className="font-bold">{shipments.length}</span>
                </div>
             </div>
             <div className="absolute right-0 bottom-0 w-32 h-32 bg-accent-500 rounded-full blur-[60px] opacity-20 -mr-10 -mb-10"></div>
          </div>
        </div>

        {/* Shipments List */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Package size={18} /> Dosya Geçmişi
              </h3>
              <button 
                onClick={() => window.print()}
                className="text-xs flex items-center gap-1 text-slate-500 hover:text-brand-600 bg-white border border-slate-200 px-2 py-1 rounded transition"
              >
                <Printer size={12} /> Yazdır
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                   <tr>
                     <th className="p-4 font-medium">Referans</th>
                     <th className="p-4 font-medium">Rota</th>
                     <th className="p-4 font-medium">Durum</th>
                     <th className="p-4 font-medium text-right">Tutar</th>
                     <th className="p-4 font-medium text-right">Tarih</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipments.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Henüz işlem yok.</td></tr>
                  ) : (
                    shipments.map((ship) => (
                      <tr key={ship.id} className="hover:bg-slate-50 group">
                        <td className="p-4">
                           <Link to={`/shipments/${ship.id}`} className="font-mono font-bold text-brand-600 hover:underline">
                             {ship.referenceNo}
                           </Link>
                        </td>
                        <td className="p-4 text-slate-600">
                           {ship.origin} <span className="text-slate-300">→</span> {ship.destination}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${ship.status === 'Teslim Edildi' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                             {ship.status}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium text-slate-700">
                           ${ship.totalIncome?.toLocaleString() || '0'}
                        </td>
                        <td className="p-4 text-right text-slate-400 text-xs">
                          {new Date(ship.created_at).toLocaleDateString('tr-TR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetail;
