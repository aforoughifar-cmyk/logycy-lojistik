
import { supabase } from './supabaseClient';
import { mapShipmentFromDB } from './mappers';
import { ServiceResult, Shipment } from '../types';
import { auditService } from './auditService';

export const shipmentService = {
  async getShipments({ page = 1, limit = 10, search = '' }: { page?: number; limit?: number; search?: string }) {
    try {
      let query = supabase.from('shipments').select('*, customers(name), containers(*)', { count: 'exact' });

      if (search) {
        const term = search.trim();
        query = query.or(`reference_no.ilike.%${term}%,description.ilike.%${term}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await query.range(from, to).order('created_at', { ascending: false });

      if (error) throw error;
      const mapped = data ? data.map(item => mapShipmentFromDB(item)) : [];

      return {
        data: {
          data: mapped,
          count: count || 0,
          page,
          totalPages: Math.ceil((count || 0) / limit)
        },
        error: null
      };
    } catch (e: any) {
      console.error('getShipments Error:', e);
      return { data: null, error: e.message || 'Veriler yüklenirken hata oluştu' };
    }
  },

  async getAllShipments() {
    const { data, error } = await supabase.from('shipments').select('*, customers(name)').order('created_at', { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data.map(i => mapShipmentFromDB(i)), error: null };
  },

  async getShipmentById(id: string) {
    const { data, error } = await supabase
      .from('shipments')
      .select(`*, containers(*), finance(*, suppliers(name)), shipment_history(*), shipment_documents(*), customers(name)`)
      .eq('id', id)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: 'Not found' };
    return { data: mapShipmentFromDB(data), error: null };
  },

  async getShipmentByTrackingNumber(ref: string) {
    const { data, error } = await supabase
      .from('shipments')
      .select(`*, containers(*), shipment_history(*)`)
      .eq('reference_no', ref)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    return { data: mapShipmentFromDB(data), error: null };
  },

  async createShipment(s: any) {
    const dbObj: any = {
      reference_no: s.referenceNo,
      description: s.description || 'Yeni Sevkiyat',
      transport_mode: s.transportMode,
      origin: s.origin || 'Bilinmiyor',
      destination: s.destination || 'KKTC',
      status: s.status,
      eta: s.eta || null,
      etd: s.etd || null,
      sender_name: s.senderName || '-',
      receiver_name: s.receiverName || '-',
      vessel_name: s.vesselName || null,
      booking_no: s.bookingNo || null,
      load_type: s.loadType || 'FCL',
      is_partial: s.isPartial || false,
      customer_id: s.customerId || null
    };

    // Remove undefined keys
    Object.keys(dbObj).forEach(key => dbObj[key] === undefined && delete dbObj[key]);

    const { data, error } = await supabase.from('shipments').insert(dbObj).select().single();
    if (error) {
      console.error('Create Shipment Error:', error);
      return { data: null, error: error.message };
    }
    
    // Audit Log
    if (data) {
        await auditService.log('CREATE', 'Shipment', `Yeni dosya açıldı: ${data.reference_no}`, data.id);
    }

    return { data: mapShipmentFromDB(data), error: null };
  },

  async updateShipmentDetails(id: string, s: any) {
    const dbObj: any = {};
    if (s.referenceNo !== undefined) dbObj.reference_no = s.referenceNo;
    if (s.description !== undefined) dbObj.description = s.description;
    if (s.transportMode !== undefined) dbObj.transport_mode = s.transportMode;
    if (s.origin !== undefined) dbObj.origin = s.origin;
    if (s.destination !== undefined) dbObj.destination = s.destination;
    if (s.eta !== undefined) dbObj.eta = s.eta;
    if (s.etd !== undefined) dbObj.etd = s.etd;
    if (s.carrier !== undefined) dbObj.carrier = s.carrier;
    if (s.loadType !== undefined) dbObj.load_type = s.loadType;
    if (s.manifest !== undefined) dbObj.manifest = s.manifest;

    const { error } = await supabase.from('shipments').update(dbObj).eq('id', id);
    
    // Audit Log
    if (!error) {
       await auditService.log('UPDATE', 'Shipment', `Dosya güncellendi.`, id);
    }

    return { data: null, error: error?.message || null };
  },

  async updateShipmentStatus(id: string, status: string) {
    const { error } = await supabase.from('shipments').update({ status }).eq('id', id);
    if (!error) {
        await auditService.log('UPDATE', 'Shipment', `Durum değişti: ${status}`, id);
    }
    return { data: null, error: null };
  },

  async deleteShipment(id: string) {
    const { error } = await supabase.from('shipments').delete().eq('id', id);
    if (!error) {
        await auditService.log('DELETE', 'Shipment', `Dosya silindi: ${id}`, id);
    }
    return { error };
  },

  // --- CONTAINERS ---
  async getAllContainers() {
    try {
      // 1. Get raw containers (No joins to avoid errors)
      const { data: containers, error: cErr } = await supabase
        .from('containers')
        .select('*');

      if (cErr) throw cErr;
      if (!containers || containers.length === 0) return { data: [], error: null };

      // 2. Get unique shipment IDs
      const shipmentIds = [...new Set(containers.map((c: any) => c.shipment_id).filter(Boolean))];
      
      let shipmentsMap = new Map();
      if (shipmentIds.length > 0) {
          const { data: shipments } = await supabase
            .from('shipments')
            .select('id, reference_no, customer_id, customers(name)')
            .in('id', shipmentIds);
            
          if (shipments) {
              shipments.forEach((s: any) => shipmentsMap.set(s.id, s));
          }
      }

      // 3. Get unique Customer IDs from fetched shipments
      const customerIds = [...new Set(Array.from(shipmentsMap.values()).map((s: any) => s.customer_id).filter(Boolean))];
      let customerMap = new Map();
      
      if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', customerIds);
            
          if (customers) {
              customers.forEach((c: any) => customerMap.set(c.id, c.name));
          }
      }

      // 4. Map everything together
      const mapped = containers.map((c: any) => {
          const ship = shipmentsMap.get(c.shipment_id);
          
          let custName = '-';
          if (ship) {
              // Try Customer ID first, then Denormalized Name
              if (ship.customer_id && customerMap.has(ship.customer_id)) {
                  custName = customerMap.get(ship.customer_id);
              } else if (ship.customers?.name) {
                  custName = ship.customers.name;
              } else if (ship.customer_name) {
                  custName = ship.customer_name;
              }
          }

          return {
              id: c.id,
              containerNo: c.container_no,
              type: c.type,
              shipmentRef: ship?.reference_no || '-',
              shipmentId: c.shipment_id,
              shipsGoLink: c.shipsgo_link,
              customerName: custName,
              lastLocation: c.last_location,
              waitingTimeDays: c.waiting_time_days
          };
      });

      return { data: mapped, error: null };
    } catch (err: any) {
        console.error("Critical Error in getAllContainers:", err);
        return { data: [], error: err.message };
    }
  },

  async addContainer(c: any) {
    const { error } = await supabase.from('containers').insert({
      container_no: c.containerNo,
      type: c.type,
      shipsgo_link: c.shipsGoLink,
      shipment_id: c.shipmentId
    });
    if (!error) {
        await auditService.log('CREATE', 'Container', `Konteyner eklendi: ${c.containerNo}`, c.shipmentId);
    }
    return { data: null, error: null };
  },

  async deleteContainer(id: string) {
    await supabase.from('containers').delete().eq('id', id);
    return { data: null, error: null };
  },

  async upsertContainer(c: any) {
    const { data: existing } = await supabase
      .from('containers').select('id').eq('container_no', c.containerNo).eq('shipment_id', c.shipmentId).maybeSingle();

    const payload: any = {
      container_no: c.containerNo,
      shipment_id: c.shipmentId,
      ...(c.type && c.type !== 'Unknown' && { type: c.type }),
      ...(c.waitingTimeDays !== undefined && { waiting_time_days: c.waitingTimeDays }),
      ...(c.lastLocation !== undefined && { last_location: c.last_location })
    };

    if (existing) {
      const res = await supabase.from('containers').update(payload).eq('id', existing.id);
      return { data: null, error: res.error?.message || null };
    } else {
      if (!payload.type) payload.type = 'Unknown';
      const res = await supabase.from('containers').insert(payload);
      return { data: null, error: res.error?.message || null };
    }
  },

  // --- HISTORY & DOCS ---
  async addHistory(id: string, h: any) {
    await supabase.from('shipment_history').insert({ shipment_id: id, ...h });
    return { data: null, error: null };
  },

  async addDocument(d: any) {
    await supabase.from('shipment_documents').insert({ shipment_id: d.shipmentId, name: d.name, type: d.type, url: d.url });
    await auditService.log('CREATE', 'Document', `Doküman yüklendi: ${d.name}`, d.shipmentId);
    return { data: null, error: null };
  },

  async deleteDocument(id: string) {
    await supabase.from('shipment_documents').delete().eq('id', id);
    return { data: null, error: null };
  },

  async uploadFile(file: File, bucket: string = 'documents'): Promise<ServiceResult<string>> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { data: publicUrl, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }
};
