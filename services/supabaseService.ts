
import { createClient } from '@supabase/supabase-js';
import { Shipment, ShipmentStatus, Customer, Supplier, ServiceResult, ShipmentHistory, Container, FinanceItem, ShipmentDocument, Offer, OfferStatus, Task, Employee, Check, Invoice, InvoiceItem, InvoicePayment, Expense, Payroll, InvoiceType, InvoiceStatus, InventoryItem, Vehicle } from '../types';

// ------------------------------------------------------------------
// AYARLAR: Lütfen Supabase proje bilgilerinizi buraya giriniz.
// ------------------------------------------------------------------
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class SupabaseService {

  // --- STORAGE / FILE UPLOAD ---

  async uploadFile(file: File, bucket: string = 'documents'): Promise<ServiceResult<string>> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return { data: publicUrl, error: null };
    } catch (err: any) {
      console.error('Upload Error:', err);
      // Fallback for demo if storage not set up: return fake URL or error
      // return { data: URL.createObjectURL(file), error: null }; 
      return { data: null, error: err.message || 'Dosya yüklenemedi. Storage ayarlarını kontrol edin.' };
    }
  }

  // --- AUTHENTICATION (V2) ---

  async signIn(email: string, password: string): Promise<ServiceResult<any>> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { data: null, error: error.message };
    return { data: data.user, error: null };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  }

  async updateUserPassword(newPassword: string): Promise<ServiceResult<any>> {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) return { data: null, error: error.message };
    return { data: data.user, error: null };
  }

  async updateUserProfile(attributes: { data: { full_name?: string, phone?: string } }): Promise<ServiceResult<any>> {
    const { data, error } = await supabase.auth.updateUser({
      data: attributes.data
    });
    if (error) return { data: null, error: error.message };
    return { data: data.user, error: null };
  }

  // --- DASHBOARD ANALYTICS ---

  async getDashboardStats() {
    try {
      // 1. Shipment Counts
      const { count: totalShipments } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true });

      const { count: activeShipments } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("Teslim Edildi","İptal")');

      // 2. Finance Totals (Detailed by Currency)
      const { data: financeData } = await supabase.from('finance').select('amount, type, currency');
      const { data: expenseData } = await supabase.from('expenses').select('amount, currency');

      // Initialize totals
      const totals: Record<string, { income: number, expense: number }> = {
          'USD': { income: 0, expense: 0 },
          'EUR': { income: 0, expense: 0 },
          'GBP': { income: 0, expense: 0 },
          'TRY': { income: 0, expense: 0 },
      };

      if (financeData) {
        financeData.forEach(item => {
          const curr = item.currency || 'USD'; // Default fallback
          if (!totals[curr]) totals[curr] = { income: 0, expense: 0 };
          
          if (item.type === 'gelir') totals[curr].income += Number(item.amount);
          if (item.type === 'gider') totals[curr].expense += Number(item.amount);
        });
      }
      
      // Add Office Expenses to Total Expense (Assuming Expenses are 'gider')
      if (expenseData) {
        expenseData.forEach(item => {
           const curr = item.currency || 'TRY';
           if (!totals[curr]) totals[curr] = { income: 0, expense: 0 };
           totals[curr].expense += Number(item.amount);
        });
      }

      // Calculate Estimated Profit in USD for the single KPI card
      // Using static rates for estimation: 1 EUR = 1.08 USD, 1 GBP = 1.25 USD, 1 TRY = 0.03 USD
      let estimatedProfitUSD = 0;
      const rates: Record<string, number> = { 'USD': 1, 'EUR': 1.08, 'GBP': 1.25, 'TRY': 0.03 };

      Object.keys(totals).forEach(curr => {
          const net = totals[curr].income - totals[curr].expense;
          estimatedProfitUSD += net * (rates[curr] || 0);
      });

      // 3. Customer Count
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      // 4. Recent Activity (Last 5 shipments)
      const { data: recentShipments } = await supabase
        .from('shipments')
        .select('id, reference_no, status, created_at, customers(name), transport_mode')
        .order('created_at', { ascending: false })
        .limit(5);

      // 5. Upcoming Checks (Next 7 days)
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      const { data: upcomingChecks } = await supabase
        .from('checks')
        .select('*')
        .eq('status', 'pending')
        .gte('due_date', today.toISOString().slice(0, 10))
        .lte('due_date', nextWeek.toISOString().slice(0, 10))
        .order('due_date', { ascending: true });

      return {
        data: {
          totalShipments: totalShipments || 0,
          activeShipments: activeShipments || 0,
          totalCustomers: totalCustomers || 0,
          financial: {
            byCurrency: totals, // Returning detailed breakdown
            estimatedProfitUSD: Math.round(estimatedProfitUSD)
          },
          recentActivity: recentShipments || [],
          upcomingChecks: upcomingChecks || []
        },
        error: null
      };

    } catch (err: any) {
      console.error('Stats error:', err);
      return { data: null, error: err.message };
    }
  }

  // --- YARDIMCI METODLAR (Data Mapping) ---
  
  private mapShipmentFromDB(dbItem: any): Shipment {
    return {
      id: dbItem.id,
      referenceNo: dbItem.reference_no,
      customerId: dbItem.customer_id,
      customerName: dbItem.customers?.name || 'Bilinmiyor',
      senderName: dbItem.sender_name,
      receiverName: dbItem.receiver_name,
      transportMode: dbItem.transport_mode,
      loadType: dbItem.load_type,
      description: dbItem.description,
      origin: dbItem.origin,
      destination: dbItem.destination,
      status: dbItem.status as ShipmentStatus,
      etd: dbItem.etd,
      eta: dbItem.eta,
      created_at: dbItem.created_at,
      history: dbItem.shipment_history ? dbItem.shipment_history.map((h: any) => ({
        id: h.id,
        date: h.date,
        description: h.description,
        location: h.location
      })) : [],
      containers: dbItem.containers ? dbItem.containers.map((c: any) => ({
        id: c.id,
        shipmentId: c.shipment_id,
        containerNo: c.container_no,
        type: c.type,
        shipsGoLink: c.shipsgo_link,
        shipsgoContainerId: c.shipsgo_container_id,
        lastLocation: c.last_location,
        waitingTimeDays: c.waiting_time_days
      })) : [],
      finance: dbItem.finance ? dbItem.finance.map((f: any) => ({
        id: f.id,
        shipmentId: f.shipment_id,
        type: f.type,
        description: f.description,
        amount: f.amount,
        currency: f.currency,
        exchangeRate: f.exchange_rate,
        supplierId: f.supplier_id,
        supplierName: f.suppliers?.name
      })) : [],
      documents: dbItem.shipment_documents ? dbItem.shipment_documents.map((d: any) => ({
        id: d.id,
        shipmentId: d.shipment_id,
        name: d.name,
        type: d.type,
        url: d.url,
        created_at: d.created_at
      })) : [],
      shipsgoShipmentId: dbItem.shipsgo_shipment_id,
      carrier: dbItem.carrier,
      bookingNo: dbItem.booking_no,
      vesselName: dbItem.vessel_name
    };
  }

  private mapShipmentToDB(item: Partial<Shipment>) {
    return {
      reference_no: item.referenceNo,
      customer_id: item.customerId,
      sender_name: item.senderName,
      receiver_name: item.receiverName,
      transport_mode: item.transportMode,
      load_type: item.loadType,
      description: item.description,
      origin: item.origin,
      destination: item.destination,
      status: item.status,
      etd: item.etd || null,
      eta: item.eta || null,
      shipsgo_shipment_id: item.shipsgoShipmentId,
      carrier: item.carrier,
      booking_no: item.bookingNo,
      vessel_name: item.vesselName
    };
  }

  // --- CUSTOMER MAPPERS ---
  
  private mapCustomerFromDB(db: any): Customer {
    return {
      id: db.id,
      type: db.type,
      name: db.name,
      email: db.email,
      phone: db.phone,
      address: db.address,
      taxId: db.tax_id, // Mapping snake_case from DB to camelCase for Frontend
      notes: db.notes
    };
  }

  private mapCustomerToDB(c: Partial<Customer>) {
    return {
      type: c.type,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      tax_id: c.taxId, // Mapping camelCase from Frontend to snake_case for DB
      notes: c.notes
    };
  }

  // --- CUSTOMERS ---

  async getCustomers(): Promise<ServiceResult<Customer[]>> {
    try {
      const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      // Use mapper here
      return { data: data.map(this.mapCustomerFromDB), error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  }

  // INTEGRATION HELPER: Find customer by name
  async getCustomerByName(name: string): Promise<ServiceResult<Customer>> {
    try {
        const { data, error } = await supabase.from('customers').select('*').ilike('name', name).maybeSingle();
        if (error) throw error;
        return { data: data ? this.mapCustomerFromDB(data) : null, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
  }

  async getCustomerById(id: string): Promise<ServiceResult<Customer>> {
    try {
      const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
      if (error) throw error;
      // Use mapper here
      return { data: this.mapCustomerFromDB(data), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getCustomerShipments(customerId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          finance ( type, amount, currency )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processed = data.map((item: any) => {
        // Calculate total income roughly in USD for list display
        const incomeUSD = item.finance?.reduce((sum: number, f: any) => {
            if(f.type !== 'gelir') return sum;
            const rate = f.currency === 'EUR' ? 1.08 : f.currency === 'GBP' ? 1.25 : f.currency === 'TRY' ? 0.03 : 1;
            return sum + (f.amount * rate);
        }, 0) || 0;

        return {
           ...this.mapShipmentFromDB(item),
           totalIncomeUSD: Math.round(incomeUSD)
        };
      });

      return { data: processed, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async createCustomer(customer: Omit<Customer, 'id'>): Promise<ServiceResult<Customer>> {
    try {
      // Map Payload
      const dbPayload = this.mapCustomerToDB(customer);
      const { data, error } = await supabase.from('customers').insert([dbPayload]).select().single();
      if (error) throw error;
      // Map Response
      return { data: this.mapCustomerFromDB(data), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<ServiceResult<Customer>> {
    try {
      // Map Payload
      const dbPayload = this.mapCustomerToDB(updates);
      // Remove undefined fields to avoid overwriting with null if not intended
      Object.keys(dbPayload).forEach(key => (dbPayload as any)[key] === undefined && delete (dbPayload as any)[key]);

      const { data, error } = await supabase.from('customers').update(dbPayload).eq('id', id).select().single();
      if (error) throw error;
      return { data: this.mapCustomerFromDB(data), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteCustomer(id: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: 'Silinemedi. Bağlı kayıtlar olabilir.' };
    }
  }

  // --- SUPPLIERS ---

  async getSuppliers(): Promise<ServiceResult<Supplier[]>> {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
      if (error) throw error;
      return { data: data as Supplier[], error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  }

  async getSupplierById(id: string): Promise<ServiceResult<Supplier>> {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single();
      if (error) throw error;
      return { data: data as Supplier, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getSupplierExpenses(supplierId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await supabase
        .from('finance')
        .select(`
          *,
          shipments ( reference_no, origin, destination )
        `)
        .eq('supplier_id', supplierId)
        .eq('type', 'gider')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data, error: null };
    } catch (err: any) {
       return { data: null, error: err.message };
    }
  }

  async createSupplier(supplier: Omit<Supplier, 'id'>): Promise<ServiceResult<Supplier>> {
    try {
      const { data, error } = await supabase.from('suppliers').insert([supplier]).select().single();
      if (error) throw error;
      return { data: data as Supplier, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteSupplier(id: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: 'Silinemedi.' };
    }
  }

  // --- OFFERS (TEKLIFLER) ---

  async getOffers(): Promise<ServiceResult<Offer[]>> {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`*, customers ( name )`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedData = data.map((item: any) => ({
        id: item.id,
        customerId: item.customer_id,
        customerName: item.customers?.name || 'Bilinmiyor',
        origin: item.origin,
        destination: item.destination,
        transportMode: item.transport_mode,
        description: item.description,
        price: item.price,
        currency: item.currency,
        status: item.status,
        validUntil: item.valid_until,
        created_at: item.created_at
      }));

      return { data: mappedData, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async createOffer(offer: Partial<Offer>): Promise<ServiceResult<Offer>> {
    try {
      const dbPayload = {
        customer_id: offer.customerId,
        origin: offer.origin,
        destination: offer.destination,
        transport_mode: offer.transportMode,
        description: offer.description,
        price: offer.price,
        currency: offer.currency,
        status: offer.status,
        valid_until: offer.validUntil || null // Handle empty string
      };

      const { data, error } = await supabase.from('offers').insert([dbPayload]).select().single();
      if (error) throw error;
      return { data: data as unknown as Offer, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async updateOfferStatus(id: string, status: OfferStatus): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('offers').update({ status }).eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteOffer(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('offers').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- TASKS (GÖREVLER) ---

  async getTasks(): Promise<ServiceResult<Task[]>> {
    try {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const mapped = data.map((d: any) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        isCompleted: d.is_completed,
        priority: d.priority,
        dueDate: d.due_date,
        created_at: d.created_at
      }));

      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addTask(task: Partial<Task>): Promise<ServiceResult<Task>> {
    try {
      const dbPayload = {
        title: task.title,
        description: task.description,
        is_completed: false,
        priority: task.priority || 'medium',
        due_date: task.dueDate || null
      };
      const { data, error } = await supabase.from('tasks').insert([dbPayload]).select().single();
      if (error) throw error;
      
      const mapped = {
        id: data.id,
        title: data.title,
        description: data.description,
        isCompleted: data.is_completed,
        priority: data.priority,
        dueDate: data.due_date,
        created_at: data.created_at
      };
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async toggleTask(id: string, isCompleted: boolean): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('tasks').update({ is_completed: isCompleted }).eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteTask(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- SHIPMENTS ---

  async getAllShipments(): Promise<ServiceResult<Shipment[]>> {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`*, customers ( name ), shipment_history ( * )`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data.map(item => this.mapShipmentFromDB(item)), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getShipmentById(id: string): Promise<ServiceResult<Shipment>> {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          customers ( name ),
          shipment_history ( * ),
          containers ( * ),
          finance ( *, suppliers(name) ),
          shipment_documents ( * )
        `)
        .eq('id', id)
        .single();

      if (error) return { data: null, error: 'Kayıt bulunamadı' };
      
      if (data.shipment_history) {
        data.shipment_history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      return { data: this.mapShipmentFromDB(data), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getShipmentByTrackingNumber(refNo: string): Promise<ServiceResult<Shipment>> {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`*, customers ( name ), shipment_history ( * ), containers ( * ), finance ( * )`)
        .eq('reference_no', refNo)
        .single();

      if (error) return { data: null, error: 'Kayıt bulunamadı' };
      return { data: this.mapShipmentFromDB(data), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async createShipment(shipmentData: any): Promise<ServiceResult<Shipment>> {
    try {
      const dbPayload = this.mapShipmentToDB(shipmentData);
      const { data, error } = await supabase.from('shipments').insert([dbPayload]).select().single();
      if (error) throw error;

      await supabase.from('shipment_history').insert([{
        shipment_id: data.id,
        description: 'Dosya oluşturuldu',
        location: shipmentData.origin || 'Sistem'
      }]);

      return { data: this.mapShipmentFromDB(data), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // INTEGRATION HELPER: Update shipment details directly
  async updateShipmentDetails(id: string, updates: Partial<Shipment>): Promise<ServiceResult<any>> {
      try {
          const dbPayload = this.mapShipmentToDB(updates);
          // Clean undefined
          Object.keys(dbPayload).forEach(key => (dbPayload as any)[key] === undefined && delete (dbPayload as any)[key]);
          
          const { error } = await supabase.from('shipments').update(dbPayload).eq('id', id);
          if (error) throw error;
          return { data: true, error: null };
      } catch (err: any) {
          return { data: null, error: err.message };
      }
  }

  async updateShipmentStatus(id: string, status: ShipmentStatus): Promise<ServiceResult<any>> {
    try {
       const { error } = await supabase.from('shipments').update({ status: status }).eq('id', id);
        if (error) throw error;
        await this.addHistory(id, {
            date: new Date().toISOString(),
            description: `Durum güncellendi: ${status}`,
            location: 'Sistem'
        });
        return { data: true, error: null };
    } catch (err: any) {
       return { data: null, error: err.message };
    }
  }

  // --- CONTAINERS ---

  async addContainer(container: Partial<Container>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('containers').insert([{
          shipment_id: container.shipmentId,
          container_no: container.containerNo,
          type: container.type,
          shipsgo_link: container.shipsGoLink,
          shipsgo_container_id: container.shipsgoContainerId,
          last_location: container.lastLocation,
          waiting_time_days: container.waitingTimeDays
        }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async updateContainer(id: string, updates: Partial<Container>): Promise<ServiceResult<any>> {
      try {
          const payload = {
              container_no: updates.containerNo,
              shipsgo_link: updates.shipsGoLink,
              last_location: updates.lastLocation,
              waiting_time_days: updates.waitingTimeDays
          };
          // Clean undefined
          Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

          const { error } = await supabase.from('containers').update(payload).eq('id', id);
          if (error) throw error;
          return { data: true, error: null };
      } catch(err: any) {
          return { data: null, error: err.message };
      }
  }

  async deleteContainer(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('containers').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getAllContainers(): Promise<ServiceResult<Container[]>> {
    try {
      const { data, error } = await supabase
        .from('containers')
        .select(`*, shipments ( reference_no, customers ( name ) )`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = data.map((c: any) => ({
        id: c.id,
        shipmentId: c.shipment_id,
        containerNo: c.container_no,
        type: c.type,
        shipsGoLink: c.shipsgo_link,
        shipmentRef: c.shipments?.reference_no,
        customerName: c.shipments?.customers?.name,
        lastLocation: c.last_location,
        waitingTimeDays: c.waiting_time_days
      }));

      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- FINANCE (CENTRALIZED) ---
  
  async getAllFinanceItems(): Promise<ServiceResult<any[]>> {
    try {
      // 1. Fetch Shipment Finance Items
      const { data: financeData, error: financeError } = await supabase
        .from('finance')
        .select(`
          *,
          shipments ( reference_no, customers ( name ) ),
          suppliers ( name )
        `);

      if (financeError) throw financeError;

      // 2. Fetch Office Expenses
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('*');

      if (expenseError) throw expenseError;

      // 3. Map Shipment Finance
      const mappedFinance = financeData.map((item: any) => ({
        id: item.id,
        shipmentId: item.shipment_id,
        refNo: item.shipments?.reference_no || '-',
        customerName: item.shipments?.customers?.name || '-',
        supplierName: item.suppliers?.name || '-',
        type: item.type,
        description: item.description,
        amount: item.amount,
        currency: item.currency,
        created_at: item.created_at,
        source: 'shipment'
      }));

      // 4. Map Office Expenses (to look similar)
      const mappedExpenses = expenseData.map((item: any) => ({
        id: item.id,
        shipmentId: null,
        refNo: 'OFİS',
        customerName: '-',
        supplierName: '-', 
        type: 'gider',
        description: `${item.category} - ${item.description}`,
        amount: item.amount,
        currency: item.currency,
        created_at: item.date, // Use expense date
        source: 'office'
      }));

      // 5. Merge and Sort
      const combined = [...mappedFinance, ...mappedExpenses].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { data: combined, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addFinance(finance: Partial<FinanceItem>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('finance').insert([{
          shipment_id: finance.shipmentId,
          type: finance.type,
          description: finance.description,
          amount: finance.amount,
          currency: finance.currency,
          exchange_rate: finance.exchangeRate || 1.0,
          supplier_id: finance.supplierId || null
        }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteFinance(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('finance').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addHistory(shipmentId: string, history: Partial<ShipmentHistory>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('shipment_history').insert([{
          shipment_id: shipmentId,
          date: history.date || new Date().toISOString(),
          description: history.description,
          location: history.location
        }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- DOCUMENTS ---

  async addDocument(doc: Partial<ShipmentDocument>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('shipment_documents').insert([{
        shipment_id: doc.shipmentId,
        name: doc.name,
        type: doc.type,
        url: doc.url
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteDocument(id: string): Promise<ServiceResult<any>> {
     try {
      const { error } = await supabase.from('shipment_documents').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- HR (EMPLOYEES) ---

  async getEmployees(): Promise<ServiceResult<Employee[]>> {
    try {
      const { data, error } = await supabase.from('employees').select('*').order('full_name');
      if (error) throw error;
      const mapped = data.map((e: any) => ({
        id: e.id,
        fullName: e.full_name,
        position: e.position,
        department: e.department,
        email: e.email,
        phone: e.phone,
        salary: e.salary,
        currency: e.currency,
        startDate: e.start_date,
        status: e.status,
        iban: e.iban,
        created_at: e.created_at
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addEmployee(employee: Partial<Employee>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('employees').insert([{
        full_name: employee.fullName,
        position: employee.position,
        department: employee.department,
        email: employee.email,
        phone: employee.phone,
        salary: employee.salary,
        currency: employee.currency,
        start_date: employee.startDate || new Date().toISOString(),
        status: 'active',
        iban: employee.iban
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteEmployee(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- PAYROLL (MAAŞ BODROSU) ---

  async getPayrolls(period: string): Promise<ServiceResult<Payroll[]>> {
    try {
      // In a real app, join with employees table
      const { data, error } = await supabase.from('payrolls').select('*').eq('period', period);
      if (error) throw error;
      const mapped = data.map((p: any) => ({
        id: p.id,
        period: p.period,
        employeeId: p.employee_id,
        employeeName: p.employee_name,
        baseSalary: p.base_salary,
        bonus: p.bonus,
        deductions: p.deductions,
        netSalary: p.net_salary,
        currency: p.currency,
        status: p.status,
        paymentDate: p.payment_date
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async createPayroll(payroll: Partial<Payroll>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('payrolls').insert([{
        period: payroll.period,
        employee_id: payroll.employeeId,
        employee_name: payroll.employeeName,
        base_salary: payroll.baseSalary,
        bonus: payroll.bonus,
        deductions: payroll.deductions,
        net_salary: payroll.netSalary,
        currency: payroll.currency,
        status: payroll.status
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- CHECKS (ÇEK/SENET) ---

  async getChecks(): Promise<ServiceResult<Check[]>> {
    try {
      const { data, error } = await supabase.from('checks').select('*').order('due_date');
      if (error) throw error;
      const mapped = data.map((c: any) => ({
        id: c.id,
        type: c.type,
        referenceNo: c.reference_no,
        amount: c.amount,
        currency: c.currency,
        dueDate: c.due_date,
        partyName: c.party_name,
        status: c.status,
        bankName: c.bank_name,
        description: c.description,
        created_at: c.created_at
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // Get Pending Outgoing Checks for Expenses
  async getPendingOutgoingChecks(): Promise<ServiceResult<Check[]>> {
    try {
      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .eq('type', 'out')
        .eq('status', 'pending')
        .order('due_date');
      
      if (error) throw error;
      
      const mapped = data.map((c: any) => ({
        id: c.id,
        type: c.type,
        referenceNo: c.reference_no,
        amount: c.amount,
        currency: c.currency,
        dueDate: c.due_date,
        partyName: c.party_name,
        status: c.status,
        bankName: c.bank_name,
        description: c.description,
        created_at: c.created_at
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getCheckById(id: string): Promise<ServiceResult<Check>> {
    try {
      const { data, error } = await supabase.from('checks').select('*').eq('id', id).single();
      if (error) throw error;
      const mapped = {
        id: data.id,
        type: data.type,
        referenceNo: data.reference_no,
        amount: data.amount,
        currency: data.currency,
        dueDate: data.due_date,
        partyName: data.party_name,
        status: data.status,
        bankName: data.bank_name,
        description: data.description,
        created_at: data.created_at
      };
      return { data: mapped as Check, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addCheck(check: Partial<Check>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('checks').insert([{
        type: check.type,
        reference_no: check.referenceNo,
        amount: check.amount,
        currency: check.currency,
        due_date: check.dueDate || null,
        party_name: check.partyName,
        status: 'pending',
        bank_name: check.bankName,
        description: check.description
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async updateCheckStatus(id: string, status: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('checks').update({ status }).eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteCheck(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('checks').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- INVOICES (FATURALAR) ---

  async getInvoices(): Promise<ServiceResult<Invoice[]>> {
    try {
      const { data, error } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
      if (error) throw error;
      const mapped = data.map((i: any) => ({
        id: i.id,
        invoiceNo: i.invoice_no,
        type: i.type,
        partyName: i.party_name,
        issueDate: i.issue_date,
        dueDate: i.due_date,
        totalAmount: i.total_amount,
        currency: i.currency,
        status: i.status
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getInvoicesByType(type: InvoiceType): Promise<ServiceResult<Invoice[]>> {
    try {
      const { data, error } = await supabase.from('invoices').select('*').eq('type', type).order('issue_date', { ascending: false });
      if (error) throw error;
      const mapped = data.map((i: any) => ({
        id: i.id,
        invoiceNo: i.invoice_no,
        type: i.type,
        partyName: i.party_name,
        issueDate: i.issue_date,
        dueDate: i.due_date,
        totalAmount: i.total_amount,
        currency: i.currency,
        status: i.status
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getInvoiceById(id: string): Promise<ServiceResult<Invoice>> {
    try {
      const { data, error } = await supabase.from('invoices').select('*, invoice_items(*), invoice_payments(*)').eq('id', id).single();
      if (error) throw error;
      const mapped = {
        id: data.id,
        invoiceNo: data.invoice_no,
        type: data.type,
        partyName: data.party_name,
        partyId: data.party_id,
        shipmentId: data.shipment_id,
        issueDate: data.issue_date,
        dueDate: data.due_date,
        totalAmount: data.total_amount,
        currency: data.currency,
        status: data.status,
        items: data.invoice_items?.map((item: any) => ({
            id: item.id,
            invoiceId: item.invoice_id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price, // Fixed mapping
            total: item.total
        })),
        payments: data.invoice_payments?.map((pay: any) => ({
            id: pay.id,
            invoiceId: pay.invoice_id,
            date: pay.date,
            amount: pay.amount,
            method: pay.method,
            reference: pay.reference
        }))
      };
      return { data: mapped as Invoice, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // Get invoice payments linked to a check
  async getPaymentsByCheckReference(reference: string): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select(`*, invoices ( invoice_no, party_name, type, total_amount )`)
        .eq('method', 'Çek')
        .ilike('reference', `%${reference}%`); // Soft match for demo, exact for real

      if (error) throw error;
      return { data: data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async createInvoice(invoice: Partial<Invoice>): Promise<ServiceResult<Invoice>> {
    try {
       const dbPayload = {
         invoice_no: invoice.invoiceNo,
         type: invoice.type,
         party_name: invoice.partyName,
         party_id: invoice.partyId || null,
         shipment_id: invoice.shipmentId || null,
         issue_date: invoice.issueDate || null,
         due_date: invoice.dueDate || null,
         total_amount: invoice.totalAmount,
         currency: invoice.currency,
         status: invoice.status || 'Taslak'
       };

       const { data, error } = await supabase.from('invoices').insert([dbPayload]).select().single();
       
       if (error) throw error;
       return { data: data as any, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addInvoiceItem(item: Partial<InvoiceItem>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('invoice_items').insert([{
        invoice_id: item.invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteInvoiceItem(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('invoice_items').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addInvoicePayment(payment: Partial<InvoicePayment>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('invoice_payments').insert([{
        invoice_id: payment.invoiceId,
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- EXPENSES (OFİS GİDERLERİ) ---

  async getExpenses(): Promise<ServiceResult<Expense[]>> {
    try {
      const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (error) throw error;
      const mapped = data.map((e: any) => ({
         id: e.id,
         category: e.category,
         description: e.description,
         amount: e.amount,
         currency: e.currency,
         paymentMethod: e.payment_method,
         date: e.date
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async addExpense(expense: Partial<Expense>): Promise<ServiceResult<any>> {
    try {
       const { data, error } = await supabase.from('expenses').insert([{
         category: expense.category,
         description: expense.description,
         amount: expense.amount,
         currency: expense.currency,
         payment_method: expense.paymentMethod,
         date: expense.date
       }]).select().single();
       if (error) throw error;
       return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- INVENTORY / WAREHOUSE ---

  async getInventory(): Promise<ServiceResult<InventoryItem[]>> {
    try {
      const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const mapped = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        status: item.status,
        entryDate: item.entry_date, // Map from snake_case
        ownerName: item.owner_name  // Map from snake_case
      }));

      return { data: mapped, error: null };
    } catch (err: any) {
      // Fallback for demo
      return { data: [], error: null };
    }
  }

  async addInventoryItem(item: Partial<InventoryItem>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('inventory').insert([{
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        status: item.status,
        entry_date: item.entryDate,
        owner_name: item.ownerName
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteInventoryItem(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // --- FLEET (ARAÇ YÖNETİMİ) ---

  async getVehicles(): Promise<ServiceResult<Vehicle[]>> {
    try {
      const { data, error } = await supabase.from('fleet').select('*');
      // If table doesn't exist, ignore error for demo
      if (error && error.code !== '42P01') throw error;
      if (!data) return { data: [], error: null };

      const mapped = data.map((v: any) => ({
        id: v.id,
        plateNo: v.plate_no,
        type: v.type,
        brand: v.brand,
        model: v.model,
        driverName: v.driver_name,
        status: v.status,
        lastMaintenance: v.last_maintenance,
        fuelLevel: v.fuel_level
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: [], error: null }; 
    }
  }

  async addVehicle(vehicle: Partial<Vehicle>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase.from('fleet').insert([{
        plate_no: vehicle.plateNo,
        type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model,
        driver_name: vehicle.driverName,
        status: vehicle.status,
        last_maintenance: vehicle.lastMaintenance || null, // Fix: Empty string -> null
        fuel_level: vehicle.fuelLevel
      }]).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteVehicle(id: string): Promise<ServiceResult<any>> {
    try {
      const { error } = await supabase.from('fleet').delete().eq('id', id);
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

}

export const supabaseService = new SupabaseService();
