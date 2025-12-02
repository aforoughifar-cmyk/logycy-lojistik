import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Supplier } from '../types';
import { ArrowLeft, Ship, Truck, Briefcase, FileText, Printer } from 'lucide-react';

const SupplierDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (supplierId: string) => {
    setLoading(true);
    const [supRes, expRes] = await Promise.all([
      supabaseService.getSupplierById(supplierId),
      supabaseService.getSupplierExpenses(supplierId)
    ]);
    
    if (supRes.data) setSupplier(supRes.data);
    if (expRes.data) setExpenses(expRes.data);
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!supplier) return <div className="p-10 text-center text-red-500">Tedarikçi bulunamadı.</div>;

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  const getTypeIcon = (type: string) => {
      switch(type) {
        case 'armator': return <Ship size={32} />;
        case 'nakliye': return <Truck size={32} />;
        default: return <Briefcase size={32} />;
      }
    };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/suppliers')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition">
          <ArrowLeft size={24} />
        </button>
        <div>
           <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
             {supplier.name}
           </h1>
           <p className="text-slate-500 text-sm">Tedarikçi Hesabı</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
             <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
                {getTypeIcon(supplier.type)}
             </div>
             <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 uppercase mb-2">
                 {supplier.type}
             </span>
             {supplier.contact && <p className="text-slate-700 font-medium">{supplier.contact}</p>}
             {supplier.notes && <p className="text-slate-500 text-sm mt-4 p-3 bg-slate-50 rounded-lg w-full text-left">{supplier.notes}</p>}
          </div>

          <div className="bg-slate-800 text-white rounded-xl shadow-sm p-6">
             <p className="text-slate-300 text-sm font-medium mb-1">Toplam Ödeme/Gider</p>
             <p className="text-3xl font-extrabold text-white">${totalExpense.toLocaleString()}</p>
             <p className="text-xs text-slate-400 mt-2">Bu tedarikçiye ait sistemdeki toplam gider kaydı.</p>
          </div>
        </div>

        <div className="md:col-span-2">
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <FileText size={18} /> Hesap Ekstresi
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
                     <th className="p-4 font-medium">Dosya Ref</th>
                     <th className="p-4 font-medium">Açıklama</th>
                     <th className="p-4 font-medium">Döviz</th>
                     <th className="p-4 font-medium text-right">Tutar</th>
                     <th className="p-4 font-medium text-right">Tarih</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Kayıtlı gider yok.</td></tr>
                  ) : (
                    expenses.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 group">
                        <td className="p-4">
                           {item.shipments ? (
                             <Link to={`/shipments/${item.shipment_id}`} className="font-mono font-bold text-brand-600 hover:underline">
                               {item.shipments.reference_no}
                             </Link>
                           ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="p-4 text-slate-600">
                           {item.description}
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-bold uppercase">
                           {item.currency}
                        </td>
                        <td className="p-4 text-right font-medium text-red-600">
                           {item.amount.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-slate-400 text-xs">
                          {new Date(item.created_at).toLocaleDateString('tr-TR')}
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

export default SupplierDetail;
