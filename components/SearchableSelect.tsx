
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import clsx from 'clsx';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | string[]; // Changed to support array
  onChange: (value: any) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  multiple?: boolean; // New prop
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  options, value, onChange, placeholder = "Seçiniz...", required = false, className, multiple = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getLabel = () => {
      if (multiple && Array.isArray(value)) {
          if (value.length === 0) return placeholder;
          if (value.length === 1) return options.find(o => o.id === value[0])?.label || placeholder;
          return `${value.length} Seçildi`;
      }
      return options.find(o => o.id === value)?.label || placeholder;
  };

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) || 
    (o.subLabel && o.subLabel.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (id: string) => {
      if (multiple) {
          const current = Array.isArray(value) ? value : [];
          if (current.includes(id)) {
              onChange(current.filter(v => v !== id));
          } else {
              onChange([...current, id]);
          }
          // Keep open for multiple selection
      } else {
          onChange(id);
          setIsOpen(false);
          setSearch('');
      }
  };

  const removeTag = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (Array.isArray(value)) {
          onChange(value.filter(v => v !== id));
      }
  };

  return (
    <div className={clsx("relative", className)} ref={wrapperRef}>
      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full border rounded-xl p-3 text-sm flex items-center justify-between cursor-pointer bg-slate-50 transition hover:bg-white focus:ring-2 focus:ring-accent-500 min-h-[46px]",
          isOpen ? "border-accent-500 ring-2 ring-accent-500/20 bg-white" : "border-slate-200"
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1">
            {multiple && Array.isArray(value) && value.length > 0 ? (
                value.map(id => {
                    const opt = options.find(o => o.id === id);
                    return (
                        <span key={id} className="bg-brand-100 text-brand-800 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                            {opt?.label}
                            <X size={12} className="cursor-pointer hover:text-brand-900" onClick={(e) => removeTag(e, id)}/>
                        </span>
                    );
                })
            ) : (
                <span className={clsx("truncate font-medium", (!value || (Array.isArray(value) && value.length === 0)) && "text-slate-400")}>
                  {(!multiple && value) ? getLabel() : (Array.isArray(value) && value.length > 0 ? '' : placeholder)}
                </span>
            )}
        </div>
        <ChevronDown size={16} className="text-slate-400 flex-shrink-0 ml-2" />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input 
                autoFocus
                type="text" 
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-brand-500"
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">Sonuç bulunamadı.</div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = multiple && Array.isArray(value) ? value.includes(option.id) : value === option.id;
                return (
                    <div 
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={clsx(
                        "px-3 py-2 rounded-lg text-sm cursor-pointer transition flex justify-between items-center",
                        isSelected ? "bg-accent-50 text-brand-900 font-bold" : "text-slate-700 hover:bg-slate-50"
                    )}
                    >
                    <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.subLabel && <span className="text-[10px] text-slate-400 font-normal">{option.subLabel}</span>}
                    </div>
                    {isSelected && <Check size={14} className="text-brand-600"/>}
                    </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
