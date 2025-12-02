import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Task } from '../types';
import { Plus, CheckCircle, Circle, Trash2, AlertCircle, Clock, Calendar } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState<Partial<Task>>({ title: '', priority: 'medium', dueDate: '' });
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    const result = await supabaseService.getTasks();
    if (result.data) setTasks(result.data);
    setLoading(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    await supabaseService.addTask(newTask);
    toast.success('Görev eklendi');
    setNewTask({ title: '', priority: 'medium', dueDate: '' });
    loadTasks();
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    await supabaseService.toggleTask(id, !currentStatus);
    if(!currentStatus) toast.success('Görev tamamlandı!');
    loadTasks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Görevi silmek istiyor musunuz?')) return;
    await supabaseService.deleteTask(id);
    toast.success('Görev silindi');
    loadTasks();
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.isCompleted;
    if (filter === 'completed') return t.isCompleted;
    return true;
  });

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'text-red-600 bg-red-50 border-red-100';
      case 'low': return 'text-green-600 bg-green-50 border-green-100';
      default: return 'text-orange-600 bg-orange-50 border-orange-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Görev Yöneticisi</h1>
          <p className="text-slate-500">Operasyonel iş takibi ve hatırlatmalar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Plus size={20} className="text-accent-500" /> Yeni Görev
            </h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Başlık</label>
                <input 
                  required
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
                  placeholder="Örn: MSC faturasını öde..."
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Son Tarih (Opsiyonel)</label>
                <input 
                  type="date"
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
                  value={newTask.dueDate}
                  onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Öncelik</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTask({...newTask, priority: p as any})}
                      className={clsx(
                        "flex-1 py-2 rounded-lg text-xs font-bold uppercase border transition",
                        newTask.priority === p 
                          ? "bg-brand-900 text-white border-brand-900" 
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {p === 'low' ? 'Düşük' : p === 'medium' ? 'Orta' : 'Yüksek'}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20">
                Listeye Ekle
              </button>
            </form>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filters */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
            <button 
              onClick={() => setFilter('all')} 
              className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition", filter === 'all' ? "bg-white shadow text-brand-900" : "text-slate-500")}
            >
              Tümü
            </button>
            <button 
              onClick={() => setFilter('active')} 
              className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition", filter === 'active' ? "bg-white shadow text-brand-900" : "text-slate-500")}
            >
              Aktif
            </button>
            <button 
              onClick={() => setFilter('completed')} 
              className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition", filter === 'completed' ? "bg-white shadow text-brand-900" : "text-slate-500")}
            >
              Tamamlanan
            </button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <p className="text-center py-10 text-slate-400">Yükleniyor...</p>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 border-dashed">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <CheckCircle size={32} />
                </div>
                <p className="text-slate-500 font-medium">Görev bulunamadı.</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <div 
                  key={task.id}
                  className={clsx(
                    "bg-white p-4 rounded-xl border flex items-center gap-4 transition group animate-in slide-in-from-bottom-2",
                    task.isCompleted ? "border-slate-100 opacity-60" : "border-slate-200 shadow-sm hover:border-brand-200"
                  )}
                >
                  <button 
                    onClick={() => handleToggle(task.id, task.isCompleted)}
                    className={clsx("flex-shrink-0 transition-colors", task.isCompleted ? "text-green-500" : "text-slate-300 hover:text-brand-500")}
                  >
                    {task.isCompleted ? <CheckCircle size={24} className="fill-green-100"/> : <Circle size={24} />}
                  </button>
                  
                  <div className="flex-1">
                    <h4 className={clsx("font-bold text-slate-800", task.isCompleted && "line-through text-slate-400")}>{task.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      {task.dueDate && (
                        <span className={clsx("text-xs flex items-center gap-1", new Date(task.dueDate) < new Date() && !task.isCompleted ? "text-red-500 font-bold" : "text-slate-400")}>
                          <Calendar size={12} /> {new Date(task.dueDate).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded border uppercase font-bold", getPriorityColor(task.priority))}>
                        {task.priority === 'low' ? 'Düşük' : task.priority === 'medium' ? 'Orta' : 'Yüksek'}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDelete(task.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;