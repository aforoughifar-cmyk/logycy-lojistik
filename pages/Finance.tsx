
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, FileText, XCircle, Building, FolderOpen, PieChart, Banknote, Receipt, Users, Shield, Search, Filter, Sparkles, Loader2, Scale, X, Save, ScrollText, RefreshCw } from "lucide-react";
import { supabaseService } from "../services/supabaseService";
import { InvoiceStatus, InvoiceType } from "../types";
import AdvancedSearchPanel, { FilterState } from "../components/AdvancedSearchPanel";
import { GoogleGenAI } from "@google/genai";
import { useStore } from '../store/useStore';
import { useQueryClient } from '@tanstack/react-query';

type FinanceRow = {
  id: string;
  created_at: string;
  type: "gelir" | "gider";
  amount: number;
  currency: string;
  description: string;
  source: "file" | "office" | "check" | "invoice" | "payroll" | "insurance" | "ordino" | "other";
  shipmentId?: string | null;
  supplierId?: string | null;
  refNo?: string | null;
  category?: string | null;
  customerName?: string | null;
  supplierName?: string | null;
  status?: string; 
};

function parseDateSafe(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseOrdinoFromDescription(desc: string): { party?: string; ref?: string; kind?: string } {
  const d = (desc || "").trim();
  const m = d.match(/^\s*ordino.*:\s*(.+?)(?:\s*\(([^)]+)\)\s*)?$/i);
  if (!m) return {};
  const party = (m[1] || "").trim();
  const ref = (m[2] || "").trim();
  return { party: party || undefined, ref: ref || undefined, kind: "ORDINO" };
}

function detectSourceFromDescription(desc: string, originalSource: string | null): "file" | "office" | "check" | "invoice" | "payroll" | "insurance" | "ordino" | "other" {
    const d = (desc || '').toLowerCase();
    if (d.includes('[ordino]')) return 'ordino';
    if (d.includes('[fatura]')) return 'invoice';
    if (d.includes('[çek]') || d.includes('[cek]')) return 'check';
    if (d.includes('[maaş]') || d.includes('[maas]')) return 'payroll';
    if (d.includes('[sigorta]')) return 'insurance';
    if (d.includes('[ofis]') || d.includes('[office]')) return 'office';
    if (d.includes('[dosya]') || d.includes('[file]')) return 'file';
    if (d.includes('ordino')) return 'ordino';
    if (d.includes('fatura') || d.includes('invoice')) return 'invoice';
    if (d.includes('çek') || d.includes('cek')) return 'check';
    if (d.includes('maaş') || d.includes('salary')) return 'payroll';
    if (d.includes('sigorta')) return 'insurance';
    if (originalSource && ['ordino','file','check','invoice','payroll','insurance','office'].includes(originalSource)) {
        return originalSource as any;
    }
    return 'other';
}

const Finance: React.FC = () => {
  const queryClient = useQueryClient();
  const { definitions } = useStore();
  const [items, setItems] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Advanced Search State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '', dateStart: '', dateEnd: '', status: '', type: '', minAmount: '', maxAmount: ''
  });

  const printRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [showReconModal, setShowReconModal] = useState(false);
  const [formData, setFormData] = useState<any>({ category: 'Diğer', description: '', amount: 0, currency: 'TRY', paymentMethod: 'Nakit', date: new Date().toISOString().slice(0, 10) });
  const [reconValues, setReconValues] = useState<Record<string, number>>({});
  
  const loadData = async (isManual = false) => {
    setLoading(true);
    if (isManual) {
        // Force clear cache for all relevant data
        await queryClient.invalidateQueries({ queryKey: ['finance'] });
        await queryClient.invalidateQueries({ queryKey: ['expenses'] });
        await queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    }
    
    try {
      const [
          financeRes, expenseRes, shipmentsRes, suppliersRes, payrollRes, insuranceRes, checksRes, invoicesRes
      ] = await Promise.all([
        supabaseService.getAllFinanceItems(),
        supabaseService.getExpenses(),
        supabaseService.getAllShipments(),
        supabaseService.getSuppliers(),
        supabaseService.getAllPayrolls(),
        supabaseService.getInsurancePayments(),
        supabaseService.getChecks(),
        supabaseService.getInvoices()
      ]);

      const shipmentsById = new Map<string, any>();
      const financeIdToManifestCustomer = new Map<string, string>();

      (shipmentsRes?.data || []).forEach((s: any) => {
        if (!s?.id) return;
        shipmentsById.set(String(s.id), s);
        if (s.manifest && Array.isArray(s.manifest)) {
            s.manifest.forEach((m: any) => {
                if (m.financeIds && Array.isArray(m.financeIds)) {
                    m.financeIds.forEach((fid: string) => {
                        if (m.customerName) financeIdToManifestCustomer.set(String(fid), m.customerName);
                    });
                }
            });
        }
      });

      const supplierNameById = new Map<string, string>();
      (suppliersRes?.data || []).forEach((s: any) => {
        if (!s?.id) return;
        supplierNameById.set(String(s.id), s.name || s.company_name || s.title || String(s.id));
      });

      // 1. Finance table entries
      const mappedFinance: FinanceRow[] = (financeRes?.data || [])
        .filter((f: any) => f.source !== 'file') 
        .map((f: any) => {
        const shipmentId = f.shipment_id ?? f.shipmentId ?? null;
        const supplierId = f.supplier_id ?? f.supplierId ?? null;
        const sh = shipmentId ? shipmentsById.get(String(shipmentId)) : null;
        const parsedOrdino = parseOrdinoFromDescription(String(f?.description || ""));
        const baseRefNo = sh?.referenceNo ?? sh?.reference_no ?? f?.ref_no ?? f?.refNo ?? (shipmentId ? `#${String(shipmentId).slice(0, 8)}` : "-");
        const refNo = (baseRefNo === "-" || String(baseRefNo).startsWith("#")) && parsedOrdino.ref ? parsedOrdino.ref : baseRefNo;
        let customerName = "-";
        if (financeIdToManifestCustomer.has(String(f.id))) customerName = financeIdToManifestCustomer.get(String(f.id))!;
        else if (parsedOrdino.party) customerName = parsedOrdino.party; 
        else if (f.customer_name || f.customerName) customerName = f.customer_name || f.customerName;
        else if (sh && sh.customerName) customerName = sh.customerName; 
        const supplierName = f?.supplierName ?? f?.supplier_name ?? supplierNameById.get(String(supplierId ?? "")) ?? "-";
        const category = f?.category ?? f?.kategori ?? f?.expense_type ?? parsedOrdino.kind ?? null;
        const detectedSource = detectSourceFromDescription(f.description, f.source);

        return {
          id: String(f.id), created_at: f.created_at || new Date().toISOString(),
          type: (f.type === "gelir" ? "gelir" : "gider") as "gelir" | "gider",
          amount: Number(f.amount || 0), currency: f.currency || "TRY",
          description: f.description || "", source: detectedSource,
          shipmentId: shipmentId ? String(shipmentId) : null, supplierId: supplierId ? String(supplierId) : null,
          refNo: refNo ?? "-", category, customerName, supplierName,
        };
      });

      // 2. Direct Office Expenses
      const mappedExpenses: FinanceRow[] = (expenseRes?.data || []).map((e: any) => ({
          id: `office-${String(e.id)}`, created_at: e?.date || e?.created_at || new Date().toISOString(),
          type: "gider", amount: Number(e.amount || 0), currency: e.currency || "TRY",
          description: e.description || "", source: "office", shipmentId: null,
          supplierId: e.supplier_id ?? e.supplierId ?? null, refNo: e?.ref_no ?? e?.refNo ?? null,
          category: e?.category ?? "OFİS", customerName: "-", supplierName: e?.suppliers?.name ?? e?.supplier_name ?? "-",
      }));

      // 3. Payrolls (Filtered by presence in Payroll table)
      const mappedPayrolls: FinanceRow[] = (payrollRes?.data || []).map((p: any) => ({
          id: `payroll-${p.id}`, created_at: p.period ? `${p.period}-28` : new Date().toISOString(),
          type: 'gider', amount: Number(p.netSalary || 0), currency: p.currency || 'TRY',
          description: `Maaş Ödemesi: ${p.employeeName} (${p.period})`, source: 'payroll',
          shipmentId: null, supplierId: null, refNo: p.period, category: 'MAAŞ', customerName: '-', supplierName: p.employeeName
      }));

      // 4. Insurance
      const mappedInsurance: FinanceRow[] = (insuranceRes?.data || []).map((i: any) => ({
          id: `insurance-${i.id}`, created_at: i.paymentDate || new Date().toISOString(),
          type: 'gider', amount: Number(i.amount || 0), currency: i.currency || 'TRY',
          description: `Sigorta Ödemesi: ${i.type || 'Prim'} (${i.period})`, source: 'insurance',
          shipmentId: null, supplierId: null, refNo: i.period, category: 'SİGORTA', customerName: '-', supplierName: 'Sosyal Sigortalar'
      }));

      // 5. Checks
      const mappedChecks: FinanceRow[] = (checksRes?.data || []).map((c: any) => ({
          id: `check-${c.id}`, created_at: c.due_date || c.dueDate || new Date().toISOString(),
          type: c.type === 'in' ? 'gelir' : 'gider', amount: Number(c.amount || 0), currency: c.currency || 'TRY',
          description: `Çek ${c.reference_no || c.referenceNo} - ${c.description || ''} (${c.bank_name || c.bankName || 'Banka'})`,
          source: 'check', shipmentId: null, supplierId: null, refNo: c.reference_no || c.referenceNo,
          category: 'ÇEK', customerName: c.type === 'in' ? c.party_name || c.partyName : '-',
          supplierName: c.type === 'out' ? c.party_name || c.partyName : '-', status: c.status
      }));

      // 6. Unpaid Invoices
      const mappedInvoices: FinanceRow[] = (invoicesRes?.data || [])
        .filter((inv: any) => inv.status !== InvoiceStatus.PAID && inv.status !== 'Ödendi')
        .map((inv: any) => {
            const paid = inv.payments?.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || 0;
            const remaining = (inv.totalAmount || 0) - paid;
            if (remaining <= 0.01) return null; 
            return {
                id: `inv-${inv.id}`, created_at: inv.dueDate || inv.issueDate || new Date().toISOString(),
                type: inv.type === InvoiceType.SALE ? 'gelir' : 'gider', amount: remaining, currency: inv.currency || 'USD',
                description: `Fatura Bakiyesi #${inv.invoiceNo}`, source: 'invoice', shipmentId: null,
                supplierId: null, refNo: inv.invoiceNo, category: 'FATURA', customerName: inv.type === InvoiceType.SALE ? inv.partyName : '-',
                supplierName: inv.type === InvoiceType.PURCHASE ? inv.partyName : '-', status: inv.status
            };
        }).filter((i): i is FinanceRow => i !== null);

      const combined = [...mappedFinance, ...mappedExpenses, ...mappedPayrolls, ...mappedInsurance, ...mappedChecks, ...mappedInvoices]
        .sort((a, b) => {
          const da = parseDateSafe(a.created_at)?.getTime() ?? 0;
          const db = parseDateSafe(b.created_at)?.getTime() ?? 0;
          return db - da;
        });

      setItems(combined);
    } catch (err) {
      toast.error("Veriler yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const term = (filters.searchTerm || "").toLowerCase().trim();
    const from = filters.dateStart ? new Date(filters.dateStart) : null;
    const to = filters.dateEnd ? new Date(filters.dateEnd) : null;
    if (from) from.setHours(0,0,0,0);
    if (to) to.setHours(23,59,59,999);

    return items.filter((item) => {
      const haystack = [item.refNo || "", item.category || "", item.description || "", item.customerName || "", item.supplierName || "", item.currency || ""].join(" ").toLowerCase();
      const matchesSearch = term.length === 0 || haystack.includes(term);
      const d = parseDateSafe(item.created_at);
      const matchesFrom = !from || (d ? d >= from : true);
      const matchesTo = !to || (d ? d <= to : true);
      const matchesType = !filters.status || item.type === filters.status.toLowerCase();
      const matchesSource = !filters.type || item.source === filters.type;
      const amt = item.amount;
      const matchesMin = !filters.minAmount || amt >= Number(filters.minAmount);
      const matchesMax = !filters.maxAmount || amt <= Number(filters.maxAmount);
      return matchesSearch && matchesFrom && matchesTo && matchesType && matchesSource && matchesMin && matchesMax;
    });
  }, [items, filters]);

  const totals = useMemo(() => {
    const byCurrency: Record<string, { income: number; expense: number }> = {};
    filteredItems.forEach((i) => {
      const curr = i.currency || "TRY";
      if (!byCurrency[curr]) byCurrency[curr] = { income: 0, expense: 0 };
      if (i.type === "gelir") byCurrency[curr].income += Number(i.amount || 0);
      if (i.type === "gider") byCurrency[curr].expense += Number(i.amount || 0);
    });
    return byCurrency;
  }, [filteredItems]);

  const handleExportCSV = () => {
    const headers = ["Tarih", "Kaynak", "Ref", "Kategori", "İlgili Taraf", "Açıklama", "Tip", "Tutar", "Para Birimi"];
    const rows = filteredItems.map((i) => {
      const party = i.type === 'gelir' ? i.customerName : i.supplierName;
      const safe = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      return [safe(parseDateSafe(i.created_at)?.toLocaleDateString("tr-TR") || "-"), safe(getSourceLabel(i.source)), safe(i.refNo || "-"), safe(i.category || "-"), safe(party || "-"), safe(i.description || "-"), safe(i.type), safe(i.amount), safe(i.currency)].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finance_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getSourceIcon = (source: string) => {
      switch(source) {
          case 'ordino': return <ScrollText size={12}/>;
          case 'file': return <FolderOpen size={12}/>;
          case 'check': return <Banknote size={12}/>;
          case 'invoice': return <Receipt size={12}/>;
          case 'payroll': return <Users size={12}/>;
          case 'insurance': return <Shield size={12}/>;
          default: return <Building size={12}/>;
      }
  };

  const getSourceLabel = (source: string) => {
      switch(source) {
          case 'ordino': return 'ORDİNO'; case 'file': return 'DOSYA'; case 'check': return 'ÇEK'; case 'invoice': return 'FATURA'; case 'payroll': return 'MAAŞ'; case 'insurance': return 'SİGORTA'; case 'office': return 'OFİS'; default: return 'DİĞER';
      }
  };

  const getSourceColor = (source: string) => {
      switch(source) {
          case 'ordino': return 'bg-green-100 text-green-700'; case 'file': return 'bg-blue-100 text-blue-700'; case 'check': return 'bg-purple-100 text-purple-700'; case 'invoice': return 'bg-pink-100 text-pink-700'; case 'payroll': return 'bg-teal-100 text-teal-700'; case 'insurance': return 'bg-indigo-100 text-indigo-700'; default: return 'bg-orange-100 text-orange-700';
      }
  };

  const handleScanClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsScanning(true);
      try {
          const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = error => reject(error);
          });
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Analyze invoice. JSON: {supplier, date, amount, currency, description, category}`;
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64Data } }] }],
              config: { responseMimeType: 'application/json' }
          });
          const extracted = JSON.parse(response.text || '{}');
          setFormData({ category: extracted.category || 'Diğer', description: extracted.description || `Fatura: ${extracted.supplier}`, amount: extracted.amount || 0, currency: extracted.currency || 'TRY', paymentMethod: 'Havale', date: extracted.date || new Date().toISOString().slice(0, 10) });
          setShowModal(true);
      } catch (e: any) {
          toast.error("Hata: " + e.message);
      } finally {
          setIsScanning(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      await supabaseService.addExpense(formData);
      setShowModal(false);
      loadData(true);
  };

  return (
    <div className="space-y-6">
      {isScanning && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
              <Sparkles size={64} className="animate-spin text-accent-400 mb-4" />
              <h2 className="text-2xl font-bold animate-pulse">Analiz Ediliyor...</h2>
          </div>
      )}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finans & Kasa Durumu</h1>
          <p className="text-slate-500">Tüm gelir و giderler. (Veriler otomatik senkronize edilir)</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => loadData(true)} className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition active:scale-95">
              <RefreshCw size={16} className={clsx(loading && "animate-spin")} /> Yenile
          </button>
          <button onClick={() => setShowReconModal(true)} className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-slate-900 flex items-center gap-2">
              <Scale size={16} /> Kasa Mutabakatı
          </button>
          <button onClick={handleScanClick} disabled={isScanning} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-md flex items-center gap-2">
             {isScanning ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} AI Tara
          </button>
          <button onClick={handleExportCSV} className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
            <Download size={16} /> CSV
          </button>
          <button onClick={() => { setFormData({category:'Diğer', amount:0, currency:'TRY', date:new Date().toISOString().slice(0,10), paymentMethod:'Nakit', description:''}); setShowModal(true); }} className="bg-accent-500 text-brand-900 px-3 py-2 rounded-lg text-sm font-bold hover:bg-accent-400">
             + Ekle
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 relative z-40">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input value={filters.searchTerm} onChange={(e) => setFilters(prev => ({...prev, searchTerm: e.target.value}))} placeholder="Hızlı Ara (Açıklama, Taraf, Ref...)" className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 text-sm" />
            </div>
            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={clsx("px-4 py-2.5 rounded-xl border font-bold text-sm flex items-center gap-2 transition", isFilterOpen || Object.entries(filters).some(([k, v]) => k !== 'searchTerm' && v) ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
                <Filter size={18} /> Detaylı Filtre
                {(filters.minAmount || filters.maxAmount || filters.dateStart || filters.status || filters.type) && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
            </button>
        </div>
        <AdvancedSearchPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} onSearch={setFilters} onClear={() => setFilters({ searchTerm:'', dateStart:'', dateEnd:'', status:'', type:'', minAmount:'', maxAmount:'' })} enableDate={true} enableAmount={true} enableStatus={true} enableType={true} statusOptions={['Gelir', 'Gider']} typeOptions={[{value:'ordino', label:'Ordino'}, {value:'office', label:'Ofis'}, {value:'check', label:'Çek'}, {value:'invoice', label:'Fatura'}, {value:'payroll', label:'Maaş'}, {value:'insurance', label:'Sigorta'}]} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Object.keys(totals).sort().map((curr) => {
            const t = totals[curr];
            const net = (t.income || 0) - (t.expense || 0);
            return (
              <div key={curr} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-slate-500 uppercase">{curr} Kasa</p>
                  <p className={clsx("text-xs font-black", net >= 0 ? "text-emerald-700" : "text-rose-700")}>NET {net.toLocaleString()}</p>
                </div>
                <div className="mt-2 text-sm flex justify-between"><span className="text-slate-500">Gelir</span><span className="font-bold text-emerald-700">+{t.income.toLocaleString()}</span></div>
                <div className="mt-1 text-sm flex justify-between"><span className="text-slate-500">Gider</span><span className="font-bold text-rose-700">-{t.expense.toLocaleString()}</span></div>
              </div>
            );
          })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold">
              <tr><th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Kaynak</th><th className="px-4 py-3 text-left">Ref</th><th className="px-4 py-3 text-left">Taraf</th><th className="px-4 py-3 text-left">Açıklama</th><th className="px-4 py-3 text-center">Tip</th><th className="px-4 py-3 text-right">Tutar</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-500" /></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-medium">Bu kriterlere uygun kayıt bulunamadی.</td></tr>
              ) : (
                filteredItems.map((item) => {
                  const party = item.type === "gelir" ? (item.customerName || item.supplierName) : item.supplierName;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition group">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{parseDateSafe(item.created_at)?.toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={clsx("inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black gap-1 uppercase", getSourceColor(item.source))}>
                          {getSourceIcon(item.source)} {getSourceLabel(item.source)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.refNo || "-"}</td>
                      <td className="px-4 py-3 font-bold text-slate-700 truncate max-w-[150px]">{party || "-"}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-xs">{item.description || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-flex px-2 py-1 rounded-lg text-[10px] font-black", item.type === "gelir" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                          {item.type === "gelir" ? "GELİR" : "GİDER"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black">
                        <span className={clsx(item.type === "gelir" ? "text-emerald-700" : "text-rose-700")}>
                          {item.type === "gelir" ? "+" : "-"}{item.amount.toLocaleString()} {item.currency}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showReconModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Scale size={20}/> Kasa Mutabakatı</h3>
                      <button onClick={() => setShowReconModal(false)}><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-slate-500 mb-4 font-medium">Lütfen kasadaki واقعی tutarları giriniz. Sistem farkı otomatik hesaplayacaktır.</p>
                      <div className="space-y-4">
                          {Object.keys(totals).sort().map(curr => {
                              const systemNet = (totals[curr].income || 0) - (totals[curr].expense || 0);
                              const actual = reconValues[curr] ?? systemNet;
                              const diff = actual - systemNet;
                              return (
                                  <div key={curr} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                      <div className="flex justify-between items-center mb-2"><span className="font-bold text-slate-700">{curr} Birimi</span><span className="text-xs text-slate-400 font-bold">Sistem: {systemNet.toLocaleString()}</span></div>
                                      <div className="flex items-center gap-3">
                                          <input type="number" className="flex-1 border border-slate-300 rounded-lg p-2 text-sm font-bold focus:border-brand-500" placeholder="Gerçek Tutar" value={reconValues[curr] || ''} onChange={(e) => setReconValues({...reconValues, [curr]: Number(e.target.value)})} />
                                          <div className={clsx("w-24 text-right font-black text-sm", diff === 0 ? "text-slate-400" : diff > 0 ? "text-emerald-600" : "text-rose-600")}>
                                              {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                              <span className="block text-[8px] text-slate-400 font-bold">FARK</span>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                      <div className="mt-6 flex justify-end"><button onClick={() => setShowReconModal(false)} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-900 transition">Kapat</button></div>
                  </div>
              </div>
          </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
                <h3 className="font-bold text-xl mb-4 text-brand-900">Manuel Gider Girişi</h3>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Tarih</label><input type="date" className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Tutar و ارز</label><div className="flex gap-2"><input type="number" className="flex-1 border p-2.5 rounded-xl font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} /><select className="border p-2.5 rounded-xl font-bold bg-white" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>{['TRY', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Açıklama</label><input className="w-full border p-2.5 rounded-xl" placeholder="Harcama nedeni..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                    <div className="flex gap-3 justify-end pt-4"><button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition">Vazgeç</button><button type="submit" className="px-8 py-2.5 bg-brand-900 text-white rounded-xl font-bold hover:bg-brand-800 transition shadow-lg">Kaydet</button></div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
