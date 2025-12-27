
import React, { useEffect, useMemo, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Check, Customer, Supplier } from '../types';
import {
  Plus,
  Banknote,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  X
} from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';

const Checks: React.FC = () => {
  const [checks, setChecks] = useState<Check[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'in' | 'out'>('in');

  // Filters (Date range + Status)
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'pending' | 'cleared' | 'bounced'>('ALL');

  const [formData, setFormData] = useState<Partial<Check>>({
    type: 'in',
    referenceNo: '',
    amount: 0,
    currency: 'TRY',
    dueDate: '',
    partyName: '',
    bankName: '',
    description: ''
  });

  // Currency totals (respect tab + filters; if status filter is ALL, totals are for pending)
  const [totals, setTotals] = useState<Record<string, number>>({ TRY: 0, USD: 0, EUR: 0, GBP: 0 });

  const normalizeCheck = (r: any): Check => ({
    id: (r?.id ?? '').toString(),
    type: (r?.type ?? 'in') as any,
    referenceNo: (r?.referenceNo ?? r?.reference_no ?? '').toString(),
    amount: Number(r?.amount ?? 0) || 0,
    currency: (r?.currency ?? 'TRY').toString(),
    dueDate: (r?.dueDate ?? r?.due_date ?? '').toString(),
    partyName: (r?.partyName ?? r?.party_name ?? '').toString(),
    bankName: (r?.bankName ?? r?.bank_name ?? '')?.toString(),
    description: (r?.description ?? '')?.toString(),
    status: (r?.status ?? 'pending') as any
  });

  const getDueDateStr = (c: any): string => (c?.dueDate ?? c?.due_date ?? '').toString();

  const parseDateOnly = (s: string): Date | null => {
    if (!s) return null;
    // ISO: YYYY-MM-DD
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    // TR: DD.MM.YYYY
    const tr = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (tr) return new Date(Date.UTC(Number(tr[3]), Number(tr[2]) - 1, Number(tr[1])));
    // Fallback
    const d = new Date(s);
    if (!isNaN(d.getTime())) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    return null;
  };

  const matchesDateRange = (c: any): boolean => {
    const due = parseDateOnly(getDueDateStr(c));
    if (!due) return true;
    const from = filterFromDate ? parseDateOnly(filterFromDate) : null;
    const to = filterToDate ? parseDateOnly(filterToDate) : null;
    if (from && due < from) return false;
    if (to && due > to) return false;
    return true;
  };

  const loadData = async () => {
    setLoading(true);
    const [checkRes, custRes, supRes] = await Promise.all([
      supabaseService.getChecks(),
      supabaseService.getCustomers(),
      supabaseService.getSuppliers()
    ]);

    if (checkRes.data) setChecks((checkRes.data as any[]).map(normalizeCheck));
    if (custRes.data) setCustomers(custRes.data as any);
    if (supRes.data) setSuppliers(supRes.data as any);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const statusForTotals = filterStatus === 'ALL' ? 'pending' : filterStatus;
    const list = checks.filter((c: any) => {
      const type = (c as any).type;
      const status = (c as any).status;
      return type === tab && status === statusForTotals && matchesDateRange(c);
    });

    const t: Record<string, number> = { TRY: 0, USD: 0, EUR: 0, GBP: 0 };
    list.forEach((c: any) => {
      const currency = (c as any).currency;
      const amount = Number((c as any).amount) || 0;
      if (t[currency] !== undefined) t[currency] += amount;
    });

    setTotals(t);
  }, [checks, tab, filterFromDate, filterToDate, filterStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.addCheck({ ...formData, type: tab });
    setFormData({ referenceNo: '', amount: 0, currency: 'TRY', dueDate: '', partyName: '', bankName: '', description: '' });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Çeki silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteCheck(id);
    loadData();
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    await supabaseService.updateCheckStatus(id, newStatus);
    loadData();
  };

  const filtered = useMemo(() => {
    return checks.filter((c: any) => {
      const type = (c as any).type;
      const status = (c as any).status;
      if (type !== tab) return false;
      if (filterStatus !== 'ALL' && status !== filterStatus) return false;
      if (!matchesDateRange(c)) return false;
      return true;
    });
  }, [checks, tab, filterFromDate, filterToDate, filterStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'cleared':
        return (
          <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-100">
            <CheckCircle size={12} /> Tahsil
          </span>
        );
      case 'bounced':
        return (
          <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100">
            <AlertCircle size={12} /> Karşılıksız
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100">
            <Clock size={12} /> Bekliyor
          </span>
        );
    }
  };

  const getOptions = () => {
    if (tab === 'in') {
      return customers.map(c => ({ id: c.name, label: c.name }));
    }
    const supplierOpts = suppliers.map(s => ({ id: s.name, label: s.name }));
    const customerOpts = customers.map(c => ({ id: c.name, label: c.name }));
    const all = [...supplierOpts, ...customerOpts];
    const seen = new Set<string>();
    return all.filter(it => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });
  };

  const summaryLabel =
    filterStatus === 'cleared' ? 'Tahsil' : filterStatus === 'bounced' ? 'Karşılıksız' : 'Bekleyen';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Çek / Senet Yönetimi</h1>
          <p className="text-slate-500">Portföydeki kıymetli evraklar.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className={clsx(
            "bg-accent-500 text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold",
            tab === 'in' ? "hover:bg-green-600" : "hover:bg-red-600"
          )}
        >
          <Plus size={20} /> Yeni Çek Girişi
        </button>
      </div>

      {/* Currency Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(totals).map(([curr, amount]) => (
          <div
            key={curr}
            className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center"
          >
            <span className="text-xs font-bold text-slate-400 uppercase mb-1">
              {summaryLabel} {curr}
            </span>
            <span
              className={clsx(
                "text-xl font-black",
                tab === 'in' ? "text-green-600" : "text-red-600"
              )}
            >
              {new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(amount as number)}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('in')}
            className={clsx(
              "flex-1 px-5 py-4 flex items-center justify-center gap-2 font-bold border-b-2",
              tab === 'in'
                ? "border-green-600 text-green-700 bg-green-50/30"
                : "border-transparent text-slate-500 hover:bg-slate-50"
            )}
          >
            <ArrowDownLeft size={18} /> Alınan Çekler (Müşteri)
          </button>
          <button
            onClick={() => setTab('out')}
            className={clsx(
              "flex-1 px-5 py-4 flex items-center justify-center gap-2 font-bold border-b-2",
              tab === 'out'
                ? "border-red-600 text-red-700 bg-red-50/30"
                : "border-transparent text-slate-500 hover:bg-slate-50"
            )}
          >
            <ArrowUpRight size={18} /> Verilen Çekler (Ödeme)
          </button>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tarih (Başlangıç)</label>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tarih (Bitiş)</label>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Durum</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="ALL">Tümü</option>
                  <option value="pending">Bekliyor</option>
                  <option value="cleared">Tahsil</option>
                  <option value="bounced">Karşılıksız</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setFilterFromDate('');
                setFilterToDate('');
                setFilterStatus('ALL');
              }}
              className="h-[46px] px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
            >
              Filtreleri Temizle
            </button>
          </div>

          {loading ? (
            <p className="text-center py-10">Yükleniyor...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
              <Banknote size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Bu kategoride kayıt bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((check: any) => (
                <div
                  key={check.id}
                  className="border border-slate-100 rounded-xl p-5 hover:shadow-md transition bg-white relative group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">VADE TARİHİ</p>
                      <div
                        className={clsx(
                          "flex items-center gap-2 mt-1 font-bold",
                          check.status === 'pending' ? "text-red-600" : "text-slate-800"
                        )}
                      >
                        <Calendar size={18} />{' '}
                        {getDueDateStr(check) ? new Date(getDueDateStr(check)).toLocaleDateString('tr-TR') : '-'}
                      </div>
                    </div>
                    {getStatusBadge(check.status)}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                        {tab === 'in' ? 'KEŞİDECİ' : 'LEHTAR'}
                      </p>
                      <p className="font-bold text-brand-900 truncate">{check.partyName}</p>
                    </div>

                    <div className="flex justify-between items-center px-2">
                      <span className="text-sm font-mono text-slate-500">#{check.referenceNo}</span>
                      <span className="text-xl font-extrabold text-slate-800">
                        {Number(check.amount || 0).toLocaleString()} {check.currency}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(check.id)}
                        className="text-slate-400 hover:text-red-500 transition p-1 rounded"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                      <Link
                        to={`/checks/${check.id}`}
                        className="text-slate-400 hover:text-blue-500 transition p-1 rounded"
                        title="Görüntüle"
                      >
                        <Eye size={18} />
                      </Link>
                    </div>

                    {check.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusUpdate(check.id, 'bounced')}
                          className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold hover:bg-red-200 transition"
                        >
                          Karşılıksız
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(check.id, 'cleared')}
                          className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded font-bold hover:bg-green-200 transition"
                        >
                          Tahsil Et
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-visible animate-in zoom-in-95 duration-200">
            <div
              className={clsx(
                "px-6 py-4 flex justify-between items-center rounded-t-2xl",
                tab === 'in' ? "bg-green-600" : "bg-red-600"
              )}
            >
              <h3 className="text-white font-bold text-lg">{tab === 'in' ? 'Yeni Alınan Çek' : 'Yeni Verilen Çek'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  {tab === 'in' ? 'Kimden Alındı (Müşteri)' : 'Kime Verildi (Tedarikçi / Müşteri)'}
                </label>
                <SearchableSelect
                  options={getOptions()}
                  value={formData.partyName || ''}
                  onChange={(val) => setFormData({ ...formData, partyName: val })}
                  placeholder="İsim Ara..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Çek No</label>
                  <input
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    value={formData.referenceNo || ''}
                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Vade Tarihi</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    value={formData.dueDate || ''}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Tutar</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    value={String(formData.amount ?? 0)}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Para Birimi</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    value={(formData.currency as any) || 'TRY'}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Banka</label>
                <input
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  value={formData.bankName || ''}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Açıklama</label>
                <textarea
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={clsx(
                    "px-5 py-3 rounded-xl font-bold text-white",
                    tab === 'in' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  )}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checks;
