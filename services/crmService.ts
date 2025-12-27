
import { supabase } from './supabaseClient';
import { auditService } from './auditService';

export const crmService = {
  // --- CUSTOMERS ---
  async getCustomers() {
    const { data } = await supabase.from('customers').select('*');
    return { data: data as any, error: null };
  },

  async getCustomerById(id: string) {
    const { data } = await supabase.from('customers').select('*').eq('id', id).single();
    return { data: data as any, error: null };
  },

  async createCustomer(c: any) {
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: c.name, type: c.type, email: c.email, phone: c.phone, address: c.address, tax_id: c.taxId })
      .select().single();
    
    if (data) {
        await auditService.log('CREATE', 'Customer', `Yeni müşteri: ${c.name}`, data.id);
    }
    return { data, error: error?.message || null };
  },

  async updateCustomer(id: string, c: any) {
    await supabase
      .from('customers')
      .update({ name: c.name, type: c.type, email: c.email, phone: c.phone, address: c.address, tax_id: c.taxId })
      .eq('id', id);
    
    await auditService.log('UPDATE', 'Customer', `Müşteri güncellendi: ${c.name}`, id);
    return { data: null, error: null };
  },

  async deleteCustomer(id: string) {
    await supabase.from('customers').delete().eq('id', id);
    await auditService.log('DELETE', 'Customer', `Müşteri silindi: ${id}`, id);
    return { data: null, error: null };
  },

  // --- SUPPLIERS ---
  async getSuppliers() {
    const { data } = await supabase.from('suppliers').select('*');
    return { data: data as any, error: null };
  },

  async createSupplier(s: any) {
    const { data } = await supabase.from('suppliers').insert(s).select().single();
    if (data) {
        await auditService.log('CREATE', 'Supplier', `Yeni tedarikçi: ${s.name}`, data.id);
    }
    return { data: null, error: null };
  },

  async deleteSupplier(id: string) {
    await supabase.from('suppliers').delete().eq('id', id);
    return { data: null, error: null };
  },

  async getSupplierById(id: string) {
    const { data } = await supabase.from('suppliers').select('*').eq('id', id).single();
    return { data: data as any, error: null };
  },

  async getSupplierExpenses(id: string) {
    const { data } = await supabase.from('finance').select('*, shipments(reference_no)').eq('supplier_id', id);
    return { data: data as any, error: null };
  },

  // --- OFFERS ---
  async getOffers() {
    const { data } = await supabase.from('offers').select('*');
    const mapped = data?.map((o: any) => ({
      id: o.id,
      customerId: o.customer_id,
      customerName: o.customer_name,
      origin: o.origin,
      destination: o.destination,
      description: o.description,
      price: o.price,
      currency: o.currency,
      status: o.status,
      validUntil: o.valid_until,
      transportMode: o.transport_mode,
      created_at: o.created_at
    }));
    return { data: mapped as any, error: null };
  },

  async getOffersByCustomerId(id: string) {
    const { data } = await supabase.from('offers').select('*').eq('customer_id', id);
    const mapped = data?.map((o: any) => ({
      id: o.id,
      customerId: o.customer_id,
      customerName: o.customer_name,
      origin: o.origin,
      destination: o.destination,
      description: o.description,
      price: o.price,
      currency: o.currency,
      status: o.status,
      validUntil: o.valid_until,
      transportMode: o.transport_mode,
      created_at: o.created_at
    }));
    return { data: mapped as any, error: null };
  },

  async createOffer(o: any) {
    const { data } = await supabase.from('offers').insert({
      customer_id: o.customerId,
      customer_name: o.customerName,
      origin: o.origin,
      destination: o.destination,
      description: o.description,
      price: o.price,
      currency: o.currency,
      status: o.status,
      valid_until: o.validUntil,
      transport_mode: o.transportMode
    }).select().single();
    
    if (data) {
        await auditService.log('CREATE', 'Offer', `Teklif oluşturuldu: ${o.customerName}`, data.id);
    }
    return { data: null, error: null };
  },

  async updateOfferStatus(id: string, status: string) {
    await supabase.from('offers').update({ status }).eq('id', id);
    await auditService.log('UPDATE', 'Offer', `Teklif durumu: ${status}`, id);
    return { data: null, error: null };
  },

  async deleteOffer(id: string) {
    await supabase.from('offers').delete().eq('id', id);
    return { data: null, error: null };
  },

  // --- TASKS ---
  async getTasks() {
    const { data } = await supabase.from('tasks').select('*');
    const mapped = data?.map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.due_date,
      isCompleted: t.is_completed
    }));
    return { data: mapped as any, error: null };
  },

  async addTask(t: any) {
    await supabase.from('tasks').insert({
      title: t.title,
      priority: t.priority,
      due_date: t.dueDate,
      is_completed: false
    });
    return { data: null, error: null };
  },

  async toggleTask(id: string, status: boolean) {
    await supabase.from('tasks').update({ is_completed: status }).eq('id', id);
    return { data: null, error: null };
  },

  async deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id);
    return { data: null, error: null };
  }
};
