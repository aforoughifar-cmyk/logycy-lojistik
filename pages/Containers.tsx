
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Container } from '../types';
import { Search, Link as LinkIcon, ExternalLink, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

const Containers: React.FC = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await supabaseService.getAllContainers();
    if (result.data) setContainers(result.data);
    setLoading(false);
  };

  const filtered = containers.filter(c => 
    c.containerNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.shipmentRef && c.shipmentRef.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Konteyner Listesi</h1>
          <p className="text-slate-500">Tüm aktif konteynerler ve takip durumu.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Konteyner No veya Dosya Ref Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Konteyner No</th>
                <th className="px-6 py-4">Dosya Ref</th>
                <th className="px-6 py-4 text-right">Takip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={3} className="text-center py-10">Yükleniyor...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-10">Kayıt bulunamadı.</td></tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">{item.containerNo}</td>
                    <td className="px-6 py-4">
                      {item.shipmentId ? (
                        <Link to={`/shipments/${item.shipmentId}`} className="text-brand-600 hover:underline font-bold flex items-center gap-1">
                          <LinkIcon size={14}/> {item.shipmentRef}
                        </Link>
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                       {item.shipsGoLink ? (
                         <a href={item.shipsGoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 font-bold hover:bg-green-100 transition">
                            <ExternalLink size={14} /> ShipsGo
                         </a>
                       ) : (
                         <span className="text-slate-300 text-xs italic">Link yok</span>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Containers;
