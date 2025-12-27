
import { supabase } from './supabaseClient';
import { authService } from './authService';
import { shipmentService } from './shipmentService';
import { crmService } from './crmService';
import { financeService } from './financeService';
import { hrService } from './hrService';
import { inventoryService } from './inventoryService';
import { calendarService } from './calendarService';
import { auditService } from './auditService';
import { storageService } from './storageService';
import { ServiceResult } from '../types';

// Helper to normalize currency names across the system
export const systemNormalizeCurrency = (curr: string) => {
  if (!curr) return 'USD';
  const c = curr.toString().trim().toUpperCase();
  if (c === 'TL' || c === 'TR' || c === 'TRY' || c === 'TÜRK LIRASI' || c === '₺') return 'TRY';
  if (c === 'EUR' || c === 'EURO' || c === 'AVRO' || c === '€') return 'EUR';
  if (c === 'GBP' || c === 'STERLIN' || c === 'STG' || c === 'POUND' || c === '£') return 'GBP';
  if (c === 'USD' || c === 'DOLAR' || c === '$') return 'USD';
  return c;
};

// --- DASHBOARD LOGIC ---
const dashboardService = {
  async getDashboardStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const [
          shipmentsRes, 
          activeShipmentsRes, 
          customersRes, 
          financeRes, 
          expenseRes, 
          recentRes,
          checksRes,
          tasksRes
      ] = await Promise.all([
          supabase.from('shipments').select('*', { count: 'exact', head: true }),
          supabase.from('shipments').select('*', { count: 'exact', head: true }).not('status', 'in', '("Teslim Edildi","İptal")'),
          supabase.from('customers').select('*', { count: 'exact', head: true }),
          supabase.from('finance').select('amount, type, currency'),
          supabase.from('expenses').select('amount, currency'),
          supabase.from('shipments').select('id, reference_no, status, created_at, customers(name), transport_mode').order('created_at', { ascending: false }).limit(5),
          supabase.from('checks').select('*').eq('status', 'pending').lte('due_date', nextWeekStr).gte('due_date', today),
          supabase.from('tasks').select('*').eq('is_completed', false).lt('due_date', today)
      ]);

      const { data: delayedData } = await supabase
        .from('shipments')
        .select('id, reference_no, eta, customers(name)')
        .not('status', 'in', '("Teslim Edildi","İptal")')
        .lt('eta', today);

      const totals: any = {
        USD: { income: 0, expense: 0 },
        EUR: { income: 0, expense: 0 },
        GBP: { income: 0, expense: 0 },
        TRY: { income: 0, expense: 0 }
      };

      const aggregate = (curr: string, type: 'gelir' | 'gider', amount: number) => {
          const c = systemNormalizeCurrency(curr);
          if (!totals[c]) totals[c] = { income: 0, expense: 0 };
          if (type === 'gelir') totals[c].income += amount;
          else totals[c].expense += amount;
      };

      if (financeRes.data) {
        financeRes.data.forEach((i: any) => {
          aggregate(i.currency, i.type === 'gelir' ? 'gelir' : 'gider', Number(i.amount));
        });
      }

      if (expenseRes.data) {
        expenseRes.data.forEach((i: any) => {
          aggregate(i.currency || 'TRY', 'gider', Number(i.amount));
        });
      }

      return {
        data: {
          totalShipments: shipmentsRes.count || 0,
          activeShipments: activeShipmentsRes.count || 0,
          totalCustomers: customersRes.count || 0,
          financial: { byCurrency: totals, estimatedProfitUSD: 0 },
          recentActivity: recentRes.data || [],
          actionItems: {
              upcomingChecks: checksRes.data || [],
              delayedShipments: delayedData || [],
              overdueTasks: tasksRes.data || []
          }
        },
        error: null
      };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },

  async getCashFlowForecast() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        const fourWeeksLater = new Date(today);
        fourWeeksLater.setDate(today.getDate() + 28);
        const endStr = fourWeeksLater.toISOString().split('T')[0];

        // Fetch pending items and future office expenses
        const [checksRes, invoicesRes, officeExpensesRes] = await Promise.all([
            supabase.from('checks').select('amount, currency, type, due_date').eq('status', 'pending').lte('due_date', endStr),
            supabase.from('invoices').select('total_amount, currency, type, status, due_date, issue_date').lte('due_date', endStr),
            supabase.from('expenses').select('amount, currency, date').lte('date', endStr).gte('date', todayStr)
        ]);

        const weeks = [0, 1, 2, 3].map((_, i) => {
            const start = new Date(today);
            start.setDate(today.getDate() + (i * 7));
            start.setHours(0,0,0,0);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23,59,59,999);
            return { 
                name: i === 0 ? 'Bu Hafta' : `${i+1}. Hafta`, 
                start, 
                end, 
                breakdown: { 
                    USD: { income: 0, expense: 0 }, 
                    EUR: { income: 0, expense: 0 }, 
                    GBP: { income: 0, expense: 0 }, 
                    TRY: { income: 0, expense: 0 } 
                }
            };
        });

        const addToWeek = (dateStr: string, amount: number, type: 'income' | 'expense', rawCurr: string) => {
            if (!dateStr) return;
            const date = new Date(dateStr);
            date.setHours(0,0,0,0);
            
            const targetWeekIdx = weeks.findIndex(w => date >= w.start && date <= w.end);
            const finalIdx = (date < today) ? 0 : targetWeekIdx;

            if (finalIdx !== -1) {
                const currency = systemNormalizeCurrency(rawCurr);
                if (!(weeks[finalIdx].breakdown as any)[currency]) {
                    (weeks[finalIdx].breakdown as any)[currency] = { income: 0, expense: 0 };
                }
                (weeks[finalIdx].breakdown as any)[currency][type] += Number(amount);
            }
        };

        // 1. Add Checks
        checksRes.data?.forEach((c: any) => {
            addToWeek(c.due_date, c.amount, c.type === 'in' ? 'income' : 'expense', c.currency);
        });

        // 2. Add Invoices (Unpaid)
        invoicesRes.data?.forEach((i: any) => {
            const status = String(i.status || '').toUpperCase();
            if (status === 'PAID' || status === 'ÖDENDİ') return;
            const type = i.type === 'SALE' ? 'income' : 'expense';
            addToWeek(i.due_date || i.issue_date, i.total_amount, type, i.currency);
        });

        // 3. Add Office Expenses (Fixed: Now including office costs in forecast)
        officeExpensesRes.data?.forEach((e: any) => {
            addToWeek(e.date, e.amount, 'expense', e.currency || 'TRY');
        });

        return { data: weeks, error: null };
    } catch (e: any) {
        console.error("Forecast error:", e);
        return { data: [], error: e.message };
    }
  },

  async getCustomerProfitability() {
      try {
          const [financeRes, shipmentRes, customerRes, invoicesRes] = await Promise.all([
              supabase.from('finance').select('*'),
              supabase.from('shipments').select('id, customer_id, reference_no, customers(name)'),
              supabase.from('customers').select('id, name'),
              supabase.from('invoices').select('party_name, total_amount, currency, type, status').neq('status', 'CANCELLED')
          ]);

          const finance = financeRes.data || [];
          const shipments = shipmentRes.data || [];
          const customers = customerRes.data || [];
          const invoices = invoicesRes.data || [];

          const shipmentMap = new Map<string, any>(shipments.map((s: any) => [s.id, s]));
          const profitability: Record<string, { income: number, expense: number }> = {};
          const rates: any = { USD: 1, EUR: 1.08, GBP: 1.25, TRY: 0.03 }; 
          const EXCLUDED_NAMES = ['NAKİT', 'NAKIT', 'HAVALE', 'EFT', 'KREDİ KARTI', 'ÇEK', 'CEK', 'BANKA', 'KASA', 'DİĞER', 'MAAŞ', '-', 'OFİS'];

          const normalizeName = (n: string) => (!n || n.trim() === '' || n === '-') ? "Diğer / Tanımsız" : n.trim();

          invoices.forEach((inv: any) => {
              const name = normalizeName(inv.party_name);
              const currency = systemNormalizeCurrency(inv.currency);
              const usdAmount = (inv.total_amount || 0) * (rates[currency] || 1);
              if (!profitability[name]) profitability[name] = { income: 0, expense: 0 };
              if (inv.type === 'SALE') profitability[name].income += usdAmount;
              else profitability[name].expense += usdAmount;
          });

          finance.forEach((f: any) => {
              let name = f.customer_name;
              if (!name && f.shipment_id) {
                  const ship = shipmentMap.get(f.shipment_id);
                  if (ship) { name = ship.customers?.name || ship.customer_name; }
              }
              if (!name && f.description && f.description.includes('(')) {
                  const match = f.description.match(/\((.*?)\)/);
                  if (match && match[1].length > 2 && !match[1].match(/\d{4}/)) name = match[1];
              }
              const resolvedName = normalizeName(name);
              if (!profitability[resolvedName]) profitability[resolvedName] = { income: 0, expense: 0 };
              const c = systemNormalizeCurrency(f.currency);
              const usdAmount = f.amount * (rates[c] || 1);
              if (f.type === 'gelir') profitability[resolvedName].income += usdAmount;
              else profitability[resolvedName].expense += usdAmount;
          });

          const result = Object.entries(profitability)
            .map(([name, val]) => ({
                name,
                income: val.income,
                expense: val.expense,
                profit: val.income - val.expense,
                margin: val.income > 0 ? ((val.income - val.expense) / val.income) * 100 : 0
            }))
            .filter(r => {
                const upperName = r.name.toUpperCase();
                if (EXCLUDED_NAMES.some(ex => upperName.includes(ex))) return false;
                if (r.name === "Diğer / Tanımsız") return false;
                return r.income > 0 || r.expense > 0;
            })
            .sort((a,b) => b.profit - a.profit)
            .slice(0, 50);

          return { data: result, error: null };
      } catch (e: any) {
          return { data: [], error: e.message };
      }
  },
};

// --- STORAGE LOGIC ---
const storageService = {
  async uploadPdfBlob(blob: Blob, fileName: string): Promise<string | null> {
      try {
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(`whatsapp_shares/${fileName}`, blob, {
                contentType: 'application/pdf',
                upsert: true
            });
        
        if (error) {
            console.error("Upload Error", error);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(`whatsapp_shares/${fileName}`);
        
        return publicUrl;
      } catch (e) {
        console.error("Exception in uploadPdfBlob", e);
        return null;
      }
  },

  async uploadFile(file: File | Blob, bucket: string = 'documents', fileName?: string): Promise<ServiceResult<string>> {
    try {
      const name = fileName || `${Math.random().toString(36).substring(2)}_${Date.now()}.pdf`;
      const filePath = `${name}`;
      
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: true
      });

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { data: publicUrl, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }
};

export const supabaseService = {
  ...authService,
  ...shipmentService,
  ...crmService,
  ...financeService,
  ...hrService,
  ...inventoryService,
  ...calendarService,
  ...auditService,
  ...dashboardService,
  ...storageService 
};

export { supabase };
