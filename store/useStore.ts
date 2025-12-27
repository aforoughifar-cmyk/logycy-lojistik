
import { create } from 'zustand';

export interface RoleDefinition {
  name: string;
  permissions: string[];
}

interface SystemDefinitions {
  taxRates: number[];
  currencies: { code: string; symbol: string; name: string }[];
  expenseCategories: string[];
  customsOffices: string[];
  employeePositions: string[];
  insuranceTypes: { name: string, rate: number }[];
  shipmentStatuses: string[];
  quantityUnits: string[];
  roles: RoleDefinition[];
}

const defaultDefinitions: SystemDefinitions = {
  taxRates: [0, 10, 16, 20],
  currencies: [
      { code: 'TRY', symbol: '₺', name: 'Türk Lirası' },
      { code: 'USD', symbol: '$', name: 'ABD Doları' },
      { code: 'EUR', symbol: '€', name: 'Euro' },
      { code: 'GBP', symbol: '£', name: 'İngiliz Sterlini' }
  ],
  expenseCategories: ['Kira', 'Ofis', 'Yemek', 'Ulaşım', 'Fatura', 'Diğer'],
  customsOffices: ['GAZİMAĞUSA GÜMRÜK MÜDÜRLÜĞÜ', 'GİRNE TURİZM LİMANI GÜMRÜK AMİRLİĞİ', 'ERCAN GÜMRÜK ŞUBE AMİRLİĞİ'],
  employeePositions: ['Müdür', 'Operasyon Sorumlusu', 'Muhasebe', 'Saha Personeli', 'Şoför', 'Depo Sorumlusu'],
  insuranceTypes: [
      { name: 'SGK Primi', rate: 13 },
      { name: 'İhtiyat Sandığı', rate: 5 },
      { name: 'Sosyal Güvenlik', rate: 9 }
  ],
  shipmentStatuses: ['Taslak', 'Hazırlanıyor', 'Yolda', 'Gümrükte', 'Teslim Edildi'],
  quantityUnits: ['Adet', 'Koli', 'Palet', 'Sandık', 'Kg', 'Ton', 'M3'],
  roles: [
      { name: 'Yönetici (Admin)', permissions: ['all'] },
      { name: 'Operasyon', permissions: ['operations', 'shipments', 'crm', 'tasks'] },
      { name: 'Muhasebe', permissions: ['finance', 'invoices', 'checks', 'reports'] },
      { name: 'Depo Sorumlusu', permissions: ['operations', 'warehouse'] },
      { name: 'Personel', permissions: ['tasks'] }
  ]
};

interface AppState {
  // User State
  user: any | null;
  userRole: 'admin' | 'staff' | 'manager'; 
  userPermissions: string[]; 
  isAuthenticated: boolean;
  setUser: (user: any | null) => void;
  setUserRole: (role: 'admin' | 'staff' | 'manager') => void;
  setUserPermissions: (perms: string[]) => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;

  // Global Settings (Currency Rates)
  currencyRates: Record<string, number>;
  setCurrencyRates: (rates: Record<string, number>) => void;
  fetchLiveRates: () => Promise<void>;

  // System Definitions
  definitions: SystemDefinitions;
  updateDefinitions: (defs: SystemDefinitions) => void;
}

const getInitialRates = () => {
    const saved = localStorage.getItem('currencyRates');
    return saved ? JSON.parse(saved) : { 
        'USD': 1, 
        'EUR': 1.08, 
        'GBP': 1.25, 
        'TRY': 32.50 
    };
};

const getInitialDefinitions = () => {
    const saved = localStorage.getItem('systemDefinitions');
    if (saved) {
        return { ...defaultDefinitions, ...JSON.parse(saved) };
    }
    return defaultDefinitions;
};

export const useStore = create<AppState>((set, get) => ({
  // User
  user: null,
  userRole: 'admin', 
  userPermissions: ['all'],
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setUserRole: (role) => set({ userRole: role }),
  setUserPermissions: (perms) => set({ userPermissions: perms }),

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),

  // Settings
  currencyRates: getInitialRates(),
  setCurrencyRates: (rates) => {
      localStorage.setItem('currencyRates', JSON.stringify(rates));
      set({ currencyRates: rates });
  },
  
  fetchLiveRates: async () => {
      try {
          const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,TRY');
          const data = await res.json();
          
          if (data && data.rates) {
              const mathRates = {
                  'USD': 1,
                  'EUR': parseFloat((1 / data.rates.EUR).toFixed(4)),
                  'GBP': parseFloat((1 / data.rates.GBP).toFixed(4)),
                  'TRY': parseFloat((1 / data.rates.TRY).toFixed(4))
              };
              localStorage.setItem('currencyRates', JSON.stringify(mathRates));
              set({ currencyRates: mathRates });
          }
      } catch (e) {
          console.error("Currency fetch failed", e);
          throw e;
      }
  },

  // Definitions
  definitions: getInitialDefinitions(),
  updateDefinitions: (defs) => {
      localStorage.setItem('systemDefinitions', JSON.stringify(defs));
      set({ definitions: defs });
  }
}));
