
import { Shipment, Invoice, InvoiceStatus } from '../types';

export const normalizeInvoiceStatus = (status: any): InvoiceStatus => {
    const v = (status || '').toString().trim();
    if (!v) return InvoiceStatus.DRAFT;

    const map: Record<string, InvoiceStatus> = {
      'Taslak': InvoiceStatus.DRAFT,
      'DRAFT': InvoiceStatus.DRAFT,
      'SENT': InvoiceStatus.DRAFT,
      'Gönderildi': InvoiceStatus.DRAFT,
      'Kısmi Ödeme': InvoiceStatus.PARTIAL,
      'Kısmi Odeme': InvoiceStatus.PARTIAL,
      'PARTIAL': InvoiceStatus.PARTIAL,
      'ÖDENDİ': InvoiceStatus.PAID,
      'Ödendi': InvoiceStatus.PAID,
      'PAID': InvoiceStatus.PAID
    };

    return map[v] || (v as any);
};

export const mapShipmentFromDB = (dbItem: any): Shipment => {
    if (!dbItem) return {} as Shipment;
    return {
      ...dbItem,
      referenceNo: dbItem.reference_no,
      transportMode: dbItem.transport_mode,
      senderName: dbItem.sender_name,
      receiverName: dbItem.receiver_name,
      vesselName: dbItem.vessel_name || '',
      bookingNo: dbItem.booking_no,
      loadType: dbItem.load_type,
      isPartial: dbItem.is_partial,
      customerId: dbItem.customer_id,
      customerName: dbItem.customers?.name || dbItem.customer_name,
      
      containers: dbItem.containers?.map((c: any) => ({
        id: c.id,
        containerNo: c.container_no,
        type: c.type,
        shipsGoLink: c.shipsgo_link,
        lastLocation: c.last_location,
        waitingTimeDays: c.waiting_time_days
      })),

      finance: dbItem.finance?.map((f: any) => ({
        id: f.id,
        type: f.type,
        currency: f.currency,
        amount: f.amount,
        description: f.description,
        supplierId: f.supplier_id,
        supplierName: f.suppliers?.name,
        created_at: f.created_at
      })),

      history: (dbItem.shipment_history || dbItem.history_logs || [])?.map(
        (h: any) => ({
          date: h.created_at || h.date,
          description: h.description,
          location: h.location
        })
      ),

      documents: (dbItem.shipment_documents || dbItem.documents || [])?.map(
        (d: any) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          url: d.url
        })
      ),

      manifest: dbItem.manifest
    };
};

export const mapInvoiceFromDB = (dbItem: any): Invoice => {
    if (!dbItem) return {} as Invoice;
    return {
      id: dbItem.id,
      invoiceNo: dbItem.invoice_no,
      type: dbItem.type,
      partyName: dbItem.party_name,
      issueDate: dbItem.issue_date,
      dueDate: dbItem.due_date,
      totalAmount: dbItem.total_amount || 0,
      currency: dbItem.currency,
      status: normalizeInvoiceStatus(dbItem.status),
      shipmentDetails: dbItem.shipment_details,
      items: dbItem.invoice_items?.map((item: any) => ({
        id: item.id,
        invoiceId: item.invoice_id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total
      })),
      payments: dbItem.invoice_payments?.map((pay: any) => ({
        id: pay.id,
        invoiceId: pay.invoice_id,
        date: pay.date,
        amount: pay.amount,
        method: pay.method,
        reference: pay.reference
      }))
    };
};

export const mapCheckFromDB = (dbItem: any) => ({
    id: dbItem.id,
    type: dbItem.type,
    referenceNo: dbItem.reference_no ?? dbItem.referenceNo,
    amount: dbItem.amount || 0,
    currency: dbItem.currency,
    dueDate: dbItem.due_date ?? dbItem.dueDate,
    partyName: dbItem.party_name ?? dbItem.partyName,
    bankName: dbItem.bank_name ?? dbItem.bankName,
    description: dbItem.description,
    status: dbItem.status,
    created_at: dbItem.created_at
});
