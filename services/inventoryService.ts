
import { supabase } from './supabaseClient';
import { normalizeInvoiceStatus } from './mappers';

export const inventoryService = {
  // --- VEHICLES ---
  async getVehicles() {
    const { data, error } = await supabase.from('vehicles').select('*');
    const mapped = data?.map((v: any) => ({
      id: v.id,
      plateNo: v.plate_no,
      type: v.type,
      brand: v.brand,
      model: v.model,
      driverName: v.driver_name,
      status: v.status,
      fuelLevel: v.fuel_level,
      lastMaintenance: v.last_maintenance
    }));
    return { data: mapped as any, error: error?.message || null };
  },

  async addVehicle(v: any) {
    await supabase.from('vehicles').insert({
      plate_no: v.plateNo,
      type: v.type,
      brand: v.brand,
      model: v.model,
      driver_name: v.driverName,
      status: v.status,
      fuel_level: v.fuelLevel
    });
    return { data: null, error: null };
  },

  async updateVehicle(id: string, v: any) {
    await supabase.from('vehicles').update({
      plate_no: v.plateNo,
      type: v.type,
      brand: v.brand,
      model: v.model,
      driver_name: v.driverName,
      status: v.status,
      fuel_level: v.fuelLevel,
      last_maintenance: v.lastMaintenance || null
    }).eq('id', id);
    return { data: null, error: null };
  },

  async deleteVehicle(id: string) {
    await supabase.from('vehicles').delete().eq('id', id);
    return { data: null, error: null };
  },

  // --- WAREHOUSE INVENTORY ---
  async getInventory() {
    const { data } = await supabase.from('inventory').select('*');
    const mapped = data?.map((i: any) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      quantity: i.quantity,
      unit: i.unit,
      location: i.location,
      status: normalizeInvoiceStatus(i.status),
      ownerName: i.owner_name,
      entryDate: i.entry_date
    }));
    return { data: mapped as any, error: null };
  },

  async addInventoryItem(i: any) {
    await supabase.from('inventory').insert({
      name: i.name,
      sku: i.sku,
      quantity: i.quantity,
      unit: i.unit,
      location: i.location,
      status: normalizeInvoiceStatus(i.status),
      owner_name: i.ownerName,
      entry_date: i.entryDate
    });
    return { data: null, error: null };
  },

  async deleteInventoryItem(id: string) {
    await supabase.from('inventory').delete().eq('id', id);
    return { data: null, error: null };
  }
};
