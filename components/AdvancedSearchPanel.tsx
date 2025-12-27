
import React, { useState, useEffect } from 'react';
import { X, Filter, Calendar, Tag, DollarSign, Check, SlidersHorizontal, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export interface FilterState {
  searchTerm: string;
  dateStart: string;
  dateEnd: string;
  status: string;
  type: string;
  minAmount: string;
  maxAmount: string;
}

export type SelectOption = string | { value: string; label: string };

interface AdvancedSearchPanelProps {
  onSearch: (filters: FilterState) => void;
  onClear: () => void;
  enableDate?: boolean;
  enableStatus?: boolean;
  enableType?: boolean;
  enableAmount?: boolean;
  statusOptions?: SelectOption[];
  typeOptions?: SelectOption[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  onSearch,
  onClear,
  enableDate = false,
  enableStatus = false,
  enableType = false,
  enableAmount = false,
  statusOptions = [],
  typeOptions = [],
  isOpen,
  onClose,
  className
}) => {
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    dateStart: '',
    dateEnd: '',
    status: '',
    type: '',
    minAmount: '',
    maxAmount: ''
  });

  // Apply filters whenever they change (or you could use a submit button)
  useEffect(() => {
    // Debounce slightly for text inputs if needed, but direct call is fine for local filtering
    onSearch(filters);
  }, [filters]);

  const handleClear = () => {
    setFilters({
      searchTerm: '',
      dateStart: '',
      dateEnd: '',
      status: '',
      type: '',
      minAmount: '',
      maxAmount: ''
    });
    onClear();
  };

  const renderOptions = (options: SelectOption[]) => {
    return options.map((opt, idx) => {
      const value = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      return <option key={`${value}-${idx}`} value={value}>{label}</option>;
    });
  };

  if (!isOpen) return null;

  return (
    <div className={clsx("absolute top-full left-0 mt-2 w-full md:w-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 animate-in slide-in-from-top-2 p-6", className)}>
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-brand-600" /> Detaylı Filtreleme
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Date Range */}
        {enableDate && (
          <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Calendar size={14}/> Tarih Aralığı</label>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <input 
                  type="date" 
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-brand-500"
                  value={filters.dateStart}
                  onChange={e => setFilters({...filters, dateStart: e.target.value})}
                />
              </div>
              <span className="text-slate-400 font-bold">-</span>
              <div className="flex-1">
                <input 
                  type="date" 
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-brand-500"
                  value={filters.dateEnd}
                  onChange={e => setFilters({...filters, dateEnd: e.target.value})}
                />
              </div>
            </div>
          </div>
        )}

        {/* Status Filter */}
        {enableStatus && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Check size={14}/> Durum / Tip</label>
            <select 
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-brand-500 bg-white"
              value={filters.status}
              onChange={e => setFilters({...filters, status: e.target.value})}
            >
              <option value="">Tümü</option>
              {renderOptions(statusOptions)}
            </select>
          </div>
        )}

        {/* Type/Category Filter */}
        {enableType && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Tag size={14}/> Tür / Kaynak</label>
            <select 
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-brand-500 bg-white"
              value={filters.type}
              onChange={e => setFilters({...filters, type: e.target.value})}
            >
              <option value="">Tümü</option>
              {renderOptions(typeOptions)}
            </select>
          </div>
        )}

        {/* Amount Range */}
        {enableAmount && (
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><DollarSign size={14}/> Tutar Aralığı</label>
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  placeholder="Min"
                  className="w-full border border-slate-200 rounded-lg p-2 pl-3 text-sm outline-none focus:border-brand-500"
                  value={filters.minAmount}
                  onChange={e => setFilters({...filters, minAmount: e.target.value})}
                />
              </div>
              <span className="text-slate-400 font-bold">-</span>
              <div className="relative flex-1">
                <input 
                  type="number" 
                  placeholder="Max"
                  className="w-full border border-slate-200 rounded-lg p-2 pl-3 text-sm outline-none focus:border-brand-500"
                  value={filters.maxAmount}
                  onChange={e => setFilters({...filters, maxAmount: e.target.value})}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button 
          onClick={handleClear} 
          className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold flex items-center gap-2 transition"
        >
          <RefreshCw size={14} /> Temizle
        </button>
        <button 
          onClick={onClose} 
          className="px-6 py-2 bg-brand-900 text-white rounded-xl text-sm font-bold hover:bg-brand-800 transition shadow-lg"
        >
          Sonuçları Göster
        </button>
      </div>
    </div>
  );
};

export default AdvancedSearchPanel;
