
import { supabase } from './supabaseClient';
import { mapInvoiceFromDB, mapCheckFromDB, normalizeInvoiceStatus } from './mappers';

export const financeService = {
  // --- GENERAL FINANCE (Shipment Expenses/Incomes) ---
  async addFinance(f: any) {
    // FIX: The database table 'finance' lacks 'customer_name', 'ref_no', and 'source' columns.
    // We consolidate this metadata into the description field to ensure visibility without schema errors.
    
    let finalDesc = f.description || '';

    // 1. Append Customer Name
    if (f.customerName && !finalDesc.includes(f.customerName)) {
        finalDesc = `${finalDesc} (${f.customerName})`;
    }

    // 2. Append Ref No
    if (f.refNo && !finalDesc.includes(f.refNo)) {
        finalDesc = `${finalDesc} [Ref: ${f.refNo}]`;
    }

    // 3. Append Source (Mapped to readable text)
    if (f.source) {
        const sourceMap: Record<string, string> = {
            'ordino': 'Ordino',
            'invoice': 'Fatura',
            'check': 'Çek',
            'office': 'Ofis',
            'payroll': 'Maaş',
            'insurance': 'Sigorta',
            'file': 'Dosya'
        };
        const sourceLabel = sourceMap[f.source] || f.source;
        // Only append if it's not already obvious in description
        if (!finalDesc.toLowerCase().includes(sourceLabel.toLowerCase())) {
             finalDesc = `${finalDesc} [${sourceLabel}]`;
        }
    }

    const { data, error } = await supabase.from('finance').insert({
      shipment_id: f.shipmentId,
      type: f.type,
      currency: f.currency,
      amount: f.amount,
      description: finalDesc, 
      supplier_id: f.supplierId,
      // customer_name: f.customerName, // Removed: column missing
      // ref_no: f.refNo,               // Removed: column missing
      // source: f.source               // Removed: column missing
    }).select().single();
    
    return { data, error: error?.message || null };
  },

  async deleteFinance(id: string) {
    await supabase.from('finance').delete().eq('id', id);
    return { data: null, error: null };
  },

  async getAllFinanceItems() {
    const { data } = await supabase.from('finance').select('*');
    return { data: data as any, error: null };
  },

  // --- INVOICES ---
  async getInvoices() {
    const { data, error } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data.map(i => mapInvoiceFromDB(i)), error: null };
  },

  async getInvoiceById(id: string) {
    const { data, error } = await supabase.from('invoices').select('*, invoice_items(*), invoice_payments(*)').eq('id', id).single();
    if (error) return { data: null, error: error.message };
    return { data: mapInvoiceFromDB(data), error: null };
  },

  async createInvoice(i: any) {
    const dbObj: any = {
      invoice_no: i.invoiceNo,
      type: i.type,
      party_name: i.partyName,
      issue_date: i.issueDate,
      due_date: i.dueDate || i.issueDate,
      total_amount: i.totalAmount,
      currency: i.currency,
      status: normalizeInvoiceStatus(i.status),
      shipment_details: i.shipmentDetails
    };

    const { data, error } = await supabase.from('invoices').insert(dbObj).select().single();
    if (error) {
      console.error("Create Invoice Error:", error);
      return { data: null, error: error.message };
    }
    return { data: mapInvoiceFromDB(data), error: null };
  },

  async findInvoiceByOrdinoManifestItemId(manifestItemId: string) {
    if (!manifestItemId) return { data: null, error: null };
    let { data, error }: any = await supabase
      .from('invoices')
      .select('id, invoice_no')
      .filter('shipment_details->>ordinoManifestItemId', 'eq', manifestItemId)
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message || String(error) };
    if (!data) return { data: null, error: null };
    return { data: { id: data.id, invoiceNo: data.invoice_no }, error: null };
  },

  async updateInvoice(id: string, u: any) {
    const dbObj: any = {};
    if (u.totalAmount !== undefined) dbObj.total_amount = u.totalAmount;
    if (u.status !== undefined) dbObj.status = u.status;
    if (u.invoiceNo !== undefined) dbObj.invoice_no = u.invoiceNo;
    if (u.issueDate !== undefined) dbObj.issue_date = u.issueDate;
    if (u.dueDate !== undefined) dbObj.due_date = u.dueDate;
    if (u.partyName !== undefined) dbObj.party_name = u.partyName;
    if (u.shipmentDetails !== undefined) dbObj.shipment_details = u.shipmentDetails;

    const { error } = await supabase.from('invoices').update(dbObj).eq('id', id);
    return { data: null, error: error?.message || null };
  },

  async deleteInvoice(id: string) {
    await supabase.from('invoices').delete().eq('id', id);
    return { data: null, error: null };
  },

  async addInvoiceItem(i: any) {
    await supabase.from('invoice_items').insert({
      invoice_id: i.invoiceId,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      total: i.total
    });
    return { data: null, error: null };
  },

  async deleteInvoiceItem(id: string) {
    await supabase.from('invoice_items').delete().eq('id', id);
    return { data: null, error: null };
  },

  async addInvoicePayment(p: any) {
    const { error } = await supabase.from('invoice_payments').insert({
      invoice_id: p.invoiceId,
      date: p.date,
      amount: p.amount,
      method: p.method,
      reference: p.reference
    });
    return { data: null, error: error?.message || null };
  },

  // --- CHECKS ---
  async getChecks() {
    const { data, error } = await supabase.from('checks').select('*');
    if (error) return { data: null, error: error.message };
    return { data: (data || []).map(mapCheckFromDB), error: null };
  },

  async addCheck(c: any) {
    const { error } = await supabase.from('checks').insert({
      type: c.type,
      reference_no: c.referenceNo,
      amount: c.amount,
      currency: c.currency,
      due_date: c.dueDate,
      party_name: c.partyName,
      bank_name: c.bankName,
      description: c.description,
      status: 'pending'
    });
    return { data: null, error: error?.message || null };
  },

  async deleteCheck(id: string) {
    await supabase.from('checks').delete().eq('id', id);
    return { data: null, error: null };
  },

  async getCheckById(id: string) {
    const { data, error } = await supabase.from('checks').select('*').eq('id', id).single();
    if (error) return { data: null, error: error.message };
    return { data: data ? mapCheckFromDB(data) : null, error: null };
  },

  async updateCheckStatus(id: string, s: string) {
    await supabase.from('checks').update({ status: s }).eq('id', id);
    return { data: null, error: null };
  },

  async getChecksByParty(name: string) {
    const { data, error } = await supabase.from('checks').select('*').eq('party_name', name);
    if (error) return { data: null, error: error.message };
    return { data: (data || []).map(mapCheckFromDB), error: null };
  },

  async getPendingOutgoingChecks() {
    const { data, error } = await supabase.from('checks').select('*').eq('type', 'out').eq('status', 'pending');
    if (error) return { data: null, error: error.message };
    return { data: (data || []).map(mapCheckFromDB), error: null };
  },

  // --- OFFICE EXPENSES ---
  async getExpenses() {
    const { data } = await supabase.from('expenses').select('*');
    return { data: data as any, error: null };
  },

  async addExpense(e: any) {
    await supabase.from('expenses').insert({
      category: e.category,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      payment_method: e.paymentMethod,
      date: e.date,
      supplier_id: e.supplierId
    });
    return { data: null, error: null };
  },

  async deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id);
    return { data: null, error: null };
  }
};
