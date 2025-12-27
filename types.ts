
export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  totalPages: number;
}

export interface AuditLog {
  id: string;
  user_email: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'OTHER';
  entity: string; // e.g. 'Shipment', 'Invoice', 'Customer'
  entity_id?: string;
  details: string;
  created_at: string;
  ip_address?: string;
}

export enum ShipmentStatus {
  DRAFT = 'Taslak',
  BOOKED = 'Rezerve',
  PREPARING = 'Hazırlanıyor',
  IN_TRANSIT = 'Yolda',
  CUSTOMS = 'Gümrükte',
  ARRIVED = 'Varış Ülkesinde',
  DELIVERED = 'Teslim Edildi',
  CANCELLED = 'İptal'
}

export interface Shipment {
  id: string;
  referenceNo: string;
  description?: string;
  transportMode: 'deniz' | 'hava' | 'kara';
  origin: string;
  destination: string;
  status: ShipmentStatus;
  eta?: string;
  etd?: string;
  senderName?: string;
  receiverName?: string;
  vesselName?: string;
  bookingNo?: string;
  containers?: Container[];
  finance?: FinanceItem[];
  history?: ShipmentHistory[];
  documents?: ShipmentDocument[];
  manifest?: ManifestItem[];
  created_at?: string;
  loadType?: string;
  isPartial?: boolean;
  revenueByCurrency?: any;
  carrier?: string;
  customerId?: string;
  customerName?: string;
  shipsgoShipmentId?: string;
}

export interface Container {
  id: string;
  containerNo: string;
  type: string;
  shipsGoLink?: string;
  shipmentId?: string;
  shipmentRef?: string;
  customerName?: string;
  lastLocation?: string;
  waitingTimeDays?: number;
}

export interface FinanceItem {
  id: string;
  type: 'gelir' | 'gider';
  currency: 'USD' | 'EUR' | 'GBP' | 'TRY';
  amount: number;
  description: string;
  supplierId?: string;
  supplierName?: string;
  customerName?: string;
  source?: 'file' | 'office' | 'check' | 'invoice' | 'payroll' | 'insurance' | 'ordino';
  refNo?: string;
  shipmentId?: string;
  created_at: string;
}

export interface ShipmentHistory {
  date: string;
  description: string;
  location: string;
}

export interface ShipmentDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  shipmentId?: string;
  created_at?: string;
}

export interface OrdinoPayment {
  id: string;
  date: string;
  amount: number;
  currency: string;
  method: 'Nakit' | 'Havale' | 'Çek' | 'Kredi Kartı';
  reference?: string; // Receipt no or note
  checkId?: string; // Link to the real Check record if method is Check
}

export interface ManifestItem {
  id: string;
  customerId: string;
  customerName: string;
  containerId?: string;
  containerNo?: string;
  goods: ManifestGood[];
  isSaved?: boolean;
  ordinoNo?: string;
  blNo?: string;
  tescilNo?: string;
  tescilDate?: string; 
  arrivalDate?: string; 
  arrivalPort?: string;
  vesselName?: string; 
  voyageNo?: string; 
  transportDocNo?: string; 
  financeIds?: string[];
  savedFees?: {
      navlun: number;
      tahliye: number;
      exworks: number;
      currency: string;
  };
  // NEW: Double-Bookkeeping for Government/Official records
  officialFees?: {
      navlun: number;
      tahliye: number;
      exworks: number;
      currency: string;
  };
  // Payment Tracking
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  paidAmount?: number;
  payments?: OrdinoPayment[];
}

export interface ManifestGood {
  description: string;
  quantity: number;
  packageType: string;
  marks?: string;
  weight?: string; 
  volume?: string; 
}

export interface Customer {
  id: string;
  name: string;
  type: 'musteri' | 'acente';
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: 'armator' | 'nakliye' | 'gumruk' | 'diger';
  contact?: string;
  notes?: string;
}

export interface Employee {
  id: string;
  fullName: string;
  position: string;
  email?: string;
  phone?: string;
  salary: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  startDate?: string;
  status?: 'active' | 'inactive';
  isActive?: boolean;
  department?: string;
  hasWorkPermit?: boolean;
  workPermitStartDate?: string;
  workPermitEndDate?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  identityNo?: string;
  insuranceNo?: string;
  address?: string;
  bankName?: string;
  branchName?: string;
  accountNo?: string;
  iban?: string;
  created_at?: string;
  permissions?: string[]; // Added permissions field
}

export interface InsurancePayment {
  id: string;
  period: string; // YYYY-MM
  amount: number;
  currency: string;
  type?: string; 
  paymentDate: string;
  description?: string;
  status: string;
  coveredEmployees?: { id: string; name: string; amount?: number }[];
}

export interface Check {
  id: string;
  type: 'in' | 'out';
  referenceNo: string;
  amount: number;
  currency: string;
  dueDate: string;
  partyName: string;
  bankName?: string;
  description?: string;
  status: 'pending' | 'cleared' | 'bounced';
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
  currency: string;
  status: OfferStatus;
  validUntil?: string;
  created_at?: string;
}

export enum OfferStatus {
  DRAFT = 'Taslak',
  SENT = 'Gönderildi',
  ACCEPTED = 'Onaylandı',
  REJECTED = 'Reddedildi'
}

export interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  isCompleted: boolean;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  type: InvoiceType;
  partyName: string;
  issueDate: string;
  dueDate?: string;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  // New field for logistic details
  shipmentDetails?: {
    vesselName?: string;
    voyageNo?: string;
    blNo?: string;
    containerNo?: string;
    arrivalDate?: string;
    arrivalPort?: string;
    goodsDescription?: string;
    registrationNo?: string; // Kayıt No
    ordinoManifestItemId?: string;
    ordinoRefNo?: string;
    ordinoSerialNo?: string;
    manNo?: string;
    notes?: string;
  };
}

export enum InvoiceType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE'
}

export enum InvoiceStatus {
  DRAFT = 'Ödenmedi',
  SENT = 'Gönderildi',
  PARTIAL = 'Kısım Ödendi',
  PAID = 'Ödendi',
  CANCELLED = 'İptal'
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
  method: string;
  reference?: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  date: string;
  supplierName?: string;
  shipmentId?: string;
  shipments?: { reference_no: string };
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  location: string;
  status: 'Stokta' | 'Rezerve' | 'Hasarlı';
  ownerName?: string;
  entryDate: string;
}

export interface Vehicle {
  id: string;
  plateNo: string;
  type: string;
  brand: string;
  model: string;
  driverName: string;
  status: string;
  fuelLevel: number;
  lastMaintenance?: string;
}

export interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  currency: string;
  date: string;
  description?: string;
  status: string;
}

export interface Payroll {
  id: string;
  period: string;
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  advanceDeduction?: number;
  workedDays?: number;
  netSalary: number;
  currency: string;
  status: string;
}

// --- NEW CALENDAR TYPES ---
export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  type: 'shipment' | 'check' | 'task' | 'note';
  status?: string; // e.g. "pending", "paid", "arriving"
  relatedId?: string; // ID of the related entity (shipment ID, etc)
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  date: string;
  isRead: boolean;
  link?: string;
}
