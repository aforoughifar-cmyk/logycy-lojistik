
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { AuditLog } from '../types';
import { Search, FileClock, Activity, Filter, User, RefreshCw, AlertTriangle, Database } from 'lucide-react';
import clsx from 'clsx';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({}); // Email -> FullName map
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    
    // Fetch logs and employees in parallel
    const [logsResult, employeesResult] = await Promise.all([
        supabaseService.getAuditLogs(),
        supabaseService.getEmployees()
    ]);

    // Handle Table Not Found (404) or other DB errors
    if (logsResult.error) {
        console.error("Audit Log Fetch Error:", logsResult.error);
        setDbError(logsResult.error);
        setLoading(false);
        return;
    }

    // Create a lookup map for employees: email -> fullName
    const map: Record<string, string> = {};
    if (employeesResult.data) {
        employeesResult.data.forEach(emp => {
            if (emp.email) {
                map[emp.email.trim().toLowerCase()] = emp.fullName;
            }
        });
    }
    
    setUserMap(map);

    if (logsResult.data) setLogs(logsResult.data);
    setLoading(false);
  };

  // Helper to resolve the display name
  const getUserDisplayName = (email: string) => {
      const lowerEmail = email.trim().toLowerCase();
      
      // 1. Try to find in Employee Database
      if (userMap[lowerEmail]) {
          return userMap[lowerEmail];
      }

      // 2. Fallback: Format email to Name (e.g. "ali.yilmaz" -> "Ali Yilmaz")
      if (email.includes('@')) {
          const prefix = email.split('@')[0];
          // Remove numbers and special chars, replace dots/underscores with space
          const cleanName = prefix.replace(/[0-9]/g, '').replace(/[._-]/g, ' ');
          // Title Case
          return cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      return email;
  };

  const filteredLogs = logs.filter(log => {
    const displayName = getUserDisplayName(log.user_email);

    const matchesSearch = 
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;

    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
      case 'LOGIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getInitials = (name: string) => {
      return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
            <FileClock className="text-accent-500" /> İşlem Geçmişi (Audit Logs)
          </h1>
          <p className="text-slate-500">Sistem üzerindeki tüm kullanıcı hareketleri ve değişiklik kayıtları.</p>
        </div>
        <button 
          onClick={loadData}
          className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 font-bold shadow-sm text-sm"
        >
          <RefreshCw size={16} /> Yenile
        </button>
      </div>

      {dbError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                <Database size={32} />
            </div>
            <h3 className="text-lg font-bold text-amber-900 mb-2">Veritabanı Tablosu Bulunamadı</h3>
            <p className="text-amber-700 mb-6 max-w-lg mx-auto text-sm">
                'Audit Logs' tablosu veritabanınızda henüz oluşturulmamış (Hata 404). 
                Bu özelliği kullanmak için lütfen aşağıdaki SQL kodunu Supabase SQL Editor üzerinden çalıştırın.
            </p>
            
            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-left text-xs font-mono overflow-x-auto max-w-2xl mx-auto shadow-lg">
<pre>{`create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_email text,
  action text,
  entity text,
  details text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.audit_logs enable row level security;

create policy "Enable read access for all users" on public.audit_logs for select using (true);
create policy "Enable insert access for all users" on public.audit_logs for insert with check (true);`}</pre>
            </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Filters */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                type="text" 
                placeholder="Ara (İsim, Detay, Modül)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
                />
            </div>
            
            <div className="flex gap-2 items-center">
                <Filter size={18} className="text-slate-400" />
                <select 
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold text-sm outline-none cursor-pointer hover:border-slate-300"
                >
                    <option value="ALL">Tüm İşlemler</option>
                    <option value="CREATE">Oluşturma (Create)</option>
                    <option value="UPDATE">Güncelleme (Update)</option>
                    <option value="DELETE">Silme (Delete)</option>
                    <option value="LOGIN">Giriş (Login)</option>
                </select>
            </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-brand-900 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4">Tarih</th>
                    <th className="px-6 py-4">Personel Adı</th>
                    <th className="px-6 py-4">İşlem</th>
                    <th className="px-6 py-4">Modül / Kayıt</th>
                    <th className="px-6 py-4">Detaylar</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {loading ? (
                    <tr><td colSpan={5} className="text-center py-10">Yükleniyor...</td></tr>
                ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">
                        <Activity size={32} className="mx-auto mb-2 opacity-50"/>
                        Kayıt bulunamadı.
                    </td></tr>
                ) : (
                    filteredLogs.map((log) => {
                    const displayName = getUserDisplayName(log.user_email);
                    
                    return (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                            {new Date(log.created_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold shadow-sm">
                                    {getInitials(displayName)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 text-sm">
                                        {displayName}
                                    </span>
                                    {/* Show email only as subtext */}
                                    <span className="text-[10px] text-slate-400">{log.user_email}</span>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={clsx("text-[10px] px-2 py-1 rounded border font-bold uppercase", getActionColor(log.action))}>
                                {log.action}
                            </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">
                            {log.entity}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                            {log.details}
                        </td>
                        </tr>
                    );
                    })
                )}
                </tbody>
            </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
