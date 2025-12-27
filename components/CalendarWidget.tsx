
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon } from 'lucide-react';
import { CalendarEvent } from '../types';
import clsx from 'clsx';

interface CalendarWidgetProps {
  events: CalendarEvent[];
  onAddNote: (date: string, title: string, desc: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ events, onAddNote, onMonthChange }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Default selected date to today in YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', desc: '' });

  // Update parent when month changes
  useEffect(() => {
    onMonthChange(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun
  
  // Adjust start day to Monday = 0 (Standard in TR/EU)
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };

  const handleSaveNote = () => {
    if (newNote.title) {
      onAddNote(selectedDate, newNote.title, newNote.desc);
      setNewNote({ title: '', desc: '' });
      setShowAddModal(false);
    }
  };

  const selectedEvents = events.filter(e => e.date === selectedDate);

  const getEventDotColor = (type: string) => {
      switch(type) {
          case 'shipment': return 'bg-blue-500';
          case 'check': return 'bg-red-500';
          case 'task': return 'bg-purple-500';
          default: return 'bg-yellow-500'; // notes
      }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Calendar Header */}
      <div className="p-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon size={18} className="text-brand-600"/>
            {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-500"><ChevronLeft size={18}/></button>
            <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-500"><ChevronRight size={18}/></button>
        </div>
      </div>

      {/* Main Content: Vertical Layout (Grid top, Agenda bottom) */}
      <div className="flex flex-col flex-1 min-h-0">
          
          {/* Calendar Grid */}
          <div className="p-3">
              <div className="grid grid-cols-7 text-center mb-2">
                  {['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(d => <div key={d} className="text-xs font-bold text-slate-400">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: adjustedStartDay }).map((_, i) => <div key={`empty-${i}`} className="h-8"></div>)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayEvents = events.filter(e => e.date === dateStr);
                      const isSelected = selectedDate === dateStr;
                      const isToday = dateStr === new Date().toISOString().slice(0, 10);

                      return (
                          <div 
                            key={day} 
                            onClick={() => handleDayClick(day)}
                            className={clsx(
                                "h-9 w-full rounded-lg flex flex-col items-center justify-center cursor-pointer transition relative border border-transparent",
                                isSelected ? "bg-brand-900 text-white shadow-md" : "hover:bg-slate-50 hover:border-slate-100 text-slate-700",
                                isToday && !isSelected && "bg-brand-50 text-brand-700 font-bold border-brand-100"
                            )}
                          >
                              <span className="text-sm leading-none">{day}</span>
                              <div className="flex gap-0.5 mt-1 h-1.5">
                                  {dayEvents.slice(0, 3).map((e, idx) => (
                                      <div key={idx} className={clsx("w-1 h-1 rounded-full", getEventDotColor(e.type))}></div>
                                  ))}
                                  {dayEvents.length > 3 && <div className="w-1 h-1 rounded-full bg-slate-300"></div>}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>

          {/* Day Detail / Agenda (Scrollable area below grid) */}
          <div className="flex-1 bg-slate-50 border-t border-slate-200 p-4 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-3 flex-shrink-0">
                  <h4 className="font-bold text-slate-800 text-sm">
                      {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                  </h4>
                  <button onClick={() => setShowAddModal(true)} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded hover:bg-brand-50 hover:text-brand-700 transition flex items-center gap-1 shadow-sm">
                      <Plus size={12}/> Not
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {selectedEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <p className="text-xs">Etkinlik yok.</p>
                      </div>
                  ) : (
                      selectedEvents.map(evt => (
                          <div key={evt.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative group hover:border-brand-200 transition">
                              <div className={clsx("absolute left-0 top-3 bottom-3 w-1 rounded-r", getEventDotColor(evt.type))}></div>
                              <div className="pl-3">
                                  <p className="text-xs font-bold text-slate-800">{evt.title}</p>
                                  {evt.description && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{evt.description}</p>}
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-1 block">
                                      {evt.type === 'note' ? 'Not' : evt.type === 'shipment' ? 'Sevkiyat' : evt.type === 'check' ? 'Çek' : 'Görev'}
                                  </span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>

      {/* Add Note Modal */}
      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <h4 className="font-bold text-brand-900">Not Ekle ({selectedDate})</h4>
                      <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                  </div>
                  <div className="p-4 space-y-3">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Başlık</label>
                          <input 
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-brand-500 transition" 
                            placeholder="Örn: Toplantı" 
                            value={newNote.title} 
                            onChange={e => setNewNote({...newNote, title: e.target.value})} 
                            autoFocus
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Detay</label>
                          <textarea 
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm h-24 resize-none outline-none focus:border-brand-500 transition" 
                            placeholder="Not detayları..." 
                            value={newNote.desc} 
                            onChange={e => setNewNote({...newNote, desc: e.target.value})}
                          />
                      </div>
                      <button onClick={handleSaveNote} className="w-full bg-brand-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-brand-800 transition shadow-lg">
                          Kaydet
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CalendarWidget;
