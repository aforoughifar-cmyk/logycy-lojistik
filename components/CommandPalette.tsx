import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, ArrowRight, Package, Users, Calculator, FileText, CheckSquare, LogOut, Wallet } from 'lucide-react';
import clsx from 'clsx';

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const actions = [
    { icon: Package, label: 'Dosyalar / Sevkiyatlar', path: '/shipments', shortcut: 'S' },
    { icon: Users, label: 'Müşteriler', path: '/customers', shortcut: 'C' },
    { icon: Calculator, label: 'Navlun Hesapla', path: '/calculator', shortcut: 'N' },
    { icon: FileText, label: 'Teklif Oluştur', path: '/offers', shortcut: 'O' },
    { icon: CheckSquare, label: 'Görevler', path: '/tasks', shortcut: 'T' },
    { icon: Wallet, label: 'Finans Durumu', path: '/finance', shortcut: 'F' },
  ];

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-fade-in">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
      
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-slide-up ring-1 ring-slate-900/5">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <Search className="text-slate-400" size={20} />
          <input 
            autoFocus
            type="text"
            placeholder="Nereye gitmek istiyorsunuz? (Komutlar için arayın...)"
            className="flex-1 outline-none text-lg text-slate-700 placeholder-slate-400 bg-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="hidden sm:flex items-center gap-1">
             <kbd className="bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-500 font-bold">ESC</kbd>
          </div>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {filteredActions.length > 0 ? (
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Hızlı Erişim</div>
              {filteredActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(action.path)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group",
                    idx === selectedIndex ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-slate-50"
                  )}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className={clsx("p-2 rounded-lg transition-colors", idx === selectedIndex ? "bg-white text-brand-600 shadow-sm" : "bg-slate-100 text-slate-500")}>
                    <action.icon size={18} />
                  </div>
                  <span className="flex-1 font-medium">{action.label}</span>
                  <ArrowRight size={16} className={clsx("transition-transform opacity-0 -translate-x-2", idx === selectedIndex && "opacity-100 translate-x-0")} />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              Sonuç bulunamadı.
            </div>
          )}
        </div>
        
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
           <div className="flex gap-4">
              <span><span className="font-bold text-slate-500">↑↓</span> Seç</span>
              <span><span className="font-bold text-slate-500">↵</span> Git</span>
           </div>
           <div className="flex items-center gap-1">
              <Command size={12} /> <span className="font-bold">K</span>
           </div>
        </div>
      </div>
    </div>
  );
};