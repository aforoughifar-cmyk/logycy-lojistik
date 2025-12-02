
// Enums
export enum ShipmentStatus {
  DRAFT = 'Taslak',
  PREPARING = 'Hazırlanıyor',
  BOOKED = 'Rezervasyon',
  IN_TRANSIT = 'Yolda (On Board)',
  ARRIVED = 'Varış Limanında',
  CUSTOMS = 'Gümrükte',
  DELIVERED = 'Teslim Edildi',
  CANCELLED = 'İptal'
}

export enum OfferStatus {
  DRAFT = 'Taslak',
  SENT = 'Gönderildi',
  ACCEPTED = 'Onaylandı',
  REJECTED = 'Reddedildi'
}

export enum TransportMode {
  SEA = 'Deniz Yolu',
  AIR = 'Hava Yolu',
  ROAD = 'Kara Yolu'
}

export enum CustomerType {
  INDIVIDUAL = 'Bireysel',
  CORPORATE = 'Kurumsal'
}

export enum InvoiceType {
  SALE = 'Satış (Gelir)',
  PURCHASE = 'Alış (Gider)'
}

export enum InvoiceStatus {
  DRAFT = 'Taslak',
  SENT = 'Gönderildi',
  PARTIAL = 'Kısmi Ödendi',
  PAID = 'Ödendi',
  OVERDUE = 'Gecikmiş',
  CANCELLED = 'İptal'
}

// Interfaces

export interface Customer {
  id: string;
  type: 'bireysel' | 'kurumsal';
  name: string;
  taxId?: string;
  phone: string;
  email: string;
  address?: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  type: 'armator' | 'nakliye' | 'gumruk' | 'diger';
  name: string;
  contact?: string;
  notes?: string;
}

export interface Container {
  id: string;
  shipmentId: string;
  containerNo: string;
  type: '20DC' | '40DC' | '40HC' | 'LCL' | 'AIR';
  shipsGoLink?: string;
  status?: string;
  shipmentRef?: string;
  customerName?: string;
  // ShipsGo Specific Fields
  shipsgoContainerId?: string;
  gateInDate?: string;
  gateOutDate?: string;
  dischargeDate?: string;
  lastLocation?: string;
  waitingTimeDays?: number;
  isCriticalWaiting?: boolean; // For 80+ days alert
}

export interface FinanceItem {
  id: string;
  shipmentId: string;
  type: 'gelir' | 'gider';
  description: string;
  amount: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'TRY';
  exchangeRate?: number;
  supplierId?: string;
  supplierName?: string;
}

export interface ShipmentHistory {
  id?: string;
  date: string;
  description: string;
  location: string;
}

export interface ShipmentDocument {
  id: string;
  shipmentId: string;
  name: string;
  type: 'B/L' | 'Invoice' | 'Packing List' | 'Dekont' | 'Diğer';
  url: string;
  created_at?: string;
}

export interface Shipment {
  id: string;
  referenceNo: string;
  customerId?: string;
  customerName?: string;
  senderName?: string;
  receiverName?: string;
  transportMode: 'deniz' | 'hava' | 'kara';
  loadType: 'FCL' | 'LCL';
  description?: string;
  origin: string;
  destination: string;
  etd?: string;
  eta?: string;
  status: ShipmentStatus;
  containers?: Container[];
  finance?: FinanceItem[];
  history?: ShipmentHistory[];
  documents?: ShipmentDocument[];
  created_at?: string;
  // ShipsGo Specific Fields
  shipsgoShipmentId?: string;
  carrier?: string;
  bookingNo?: string;
  vesselName?: string;
}

export interface Offer {
  id: string;
  customerId: string;
  customerName?: string;
  origin: string;
  destination: string;
  transportMode: 'deniz' | 'hava' | 'kara';
  description: string;
  price: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'TRY';
  status: OfferStatus;
  validUntil?: string;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  created_at?: string;
}

// --- INTERNAL MANAGEMENT TYPES ---

export interface Employee {
  id: string;
  fullName: string;
  position: string;
  department?: string;
  email?: string;
  phone?: string;
  salary: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  startDate: string;
  status: 'active' | 'inactive';
  iban?: string;
  created_at?: string;
}

export interface Check {
  id: string;
  type: 'in' | 'out';
  referenceNo: string;
  amount: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  dueDate: string;
  partyName: string;
  status: 'pending' | 'cleared' | 'bounced';
  bankName?: string;
  description?: string;
  created_at?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  type: InvoiceType;
  partyName: string; // Müşteri veya Tedarikçi Adı
  partyId?: string; // Foreign key
  shipmentId?: string;
  issueDate: string;
  dueDate?: string;
  totalAmount: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'TRY';
  status: InvoiceStatus;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  created_at?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  date: string;
  amount: number;
  method: 'Nakit' | 'Havale' | 'Çek' | 'Kredi Kartı';
  reference?: string; // Check ID or Transaction ID
}

export interface Expense {
  id: string;
  category: string; // Kira, Elektrik, Yemek, vb.
  description: string;
  amount: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  paymentMethod: 'Nakit' | 'Havale' | 'Kredi Kartı' | 'Çek';
  date: string;
  created_at?: string;
}

export interface Payroll {
  id: string;
  period: string; // YYYY-MM
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  currency: string;
  status: 'Taslak' | 'Ödendi';
  paymentDate?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: 'Adet' | 'Koli' | 'Palet' | 'Kg';
  location: string; // Shelf A-1 etc.
  status: 'Stokta' | 'Rezerve' | 'Hasarlı';
  entryDate: string;
  ownerName?: string; // Customer who owns the goods
}

export interface Vehicle {
  id: string;
  plateNo: string;
  type: 'Kamyon' | 'Tır' | 'Van' | 'Forklift';
  brand: string;
  model: string;
  driverName?: string;
  status: 'Aktif' | 'Garajda' | 'Bakımda' | 'Seferde';
  lastMaintenance?: string;
  fuelLevel?: number; // 0-100
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}
