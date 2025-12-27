

import React, { useEffect, useState, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Employee } from '../types';
import { Plus, Search, User, Phone, Mail, DollarSign, Trash2, X, Briefcase, CreditCard, Calendar, FileText, CheckCircle, AlertCircle, Save, Gift, Globe, Home, Filter, Edit, Shield, CheckSquare, Square, ChevronRight, Sparkles, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;


const Staff: React.FC = () => {
  const { definitions } = useStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false); 
  const [showImportModal, setShowImportModal] = useState(false); // AI Import Modal

  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // AI Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [analyzedData, setAnalyzedData] = useState<any[]>([]);
  const [importPeriod, setImportPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter State
  const [filterType, setFilterType] = useState<'all' | 'local' | 'foreign'>('all');

  // Dynamic Positions State
  const [positions, setPositions] = useState<string[]>(['Müdür', 'Operasyon Sorumlusu', 'Muhasebe', 'Saha Personeli', 'Şoför', 'Depo Sorumlusu']);
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');

  // Permissions State for selected user
  const [permTarget, setPermTarget] = useState<Employee | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // Initial State for New Employee
  const initialFormState: Partial<Employee> = {
    firstName: '',
    lastName: '',
    birthDate: '',
    identityNo: '',
    phone: '',
    email: '',
    address: '',
    
    position: '',
    startDate: '',
    insuranceNo: '',
    isActive: true,
    hasWorkPermit: false,
    workPermitStartDate: '',
    workPermitEndDate: '',

    bankName: '',
    branchName: '',
    accountNo: '',
    iban: '',
    salary: 0,
    currency: 'TRY',
  };

  const [formData, setFormData] = useState<Partial<Employee>>(initialFormState);

  useEffect(() => {
    loadData();
    loadPositions();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await supabaseService.getEmployees();
    if (result.error) {
      console.error(result.error);
      toast.error('Personel listesi yüklenemedi.');
    }
    if (result.data) setEmployees(result.data);
    setLoading(false);
  };

  const loadPositions = () => {
      const savedDefs = localStorage.getItem('systemDefinitions');
      if (savedDefs) {
          const parsed = JSON.parse(savedDefs);
          if (parsed.employeePositions && Array.isArray(parsed.employeePositions) && parsed.employeePositions.length > 0) {
              setPositions(parsed.employeePositions);
          }
      }
  };

  // --- AI MULTI-PAGE IMPORT LOGIC ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          setImportFile(file);
          setAnalyzedData([]); 
          analyzeFile(file);
      }
  };

  const analyzeFile = async (file: File) => {
      setIsAnalyzing(true);
      setAnalyzedData([]);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const allExtractedItems: any[] = [];

      try {
          if (file.type === 'application/pdf') {
              // PDF processing logic
              const arrayBuffer = await file.arrayBuffer();
              const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
              const pdf = await loadingTask.promise;
              const totalPages = pdf.numPages;
              setAnalysisProgress({ current: 0, total: totalPages });

              for (let i = 1; i <= totalPages; i++) {
                  setAnalysisProgress(prev => ({ ...prev, current: i }));
                  
                  const page = await pdf.getPage(i);
                  const scale = 1.5;
                  const viewport = page.getViewport({ scale });
                  const canvas = document.createElement('canvas');
                  const context = canvas.getContext('2d');
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;

                  if (context) {
                      // Fix: Added missing required 'canvas' property to RenderParameters
                      await page.render({ canvasContext: context, viewport, canvas }).promise;
                      const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                      
                      const pageItems = await callGeminiForContent(ai, base64Data, 'image/jpeg');
                      allExtractedItems.push(...pageItems);
                  }
              }
          } else {
              // Single image processing
              const base64Data = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.readAsDataURL(file);
                  reader.onload = () => resolve((reader.result as string).split(',')[1]);
              });
              const items = await callGeminiForContent(ai, base64Data, file.type);
              allExtractedItems.push(...items);
          }

          // Match data with existing employees
          const processed = allExtractedItems.map((item: any) => {
              const existing = employees.find(e => 
                  (e.identityNo && item.identityNo && e.identityNo.replace(/\s/g, '') === item.identityNo.replace(/\s/g, '')) ||
                  (e.fullName.toLowerCase() === item.name.toLowerCase())
              );

              return {
                  ...item,
                  status: existing ? 'update' : 'new',
                  existingId: existing?.id,
                  currentSalary: existing?.salary || 0
              };
          });

          setAnalyzedData(processed);
          toast.success(`${processed.length} kayıt başarıyla analiz edildi.`);

      } catch (error: any) {
          console.error(error);
          toast.error("Hata: " + error.message);
      } finally {
          setIsAnalyzing(false);
          setAnalysisProgress({ current: 0, total: 0 });
      }
  };

  const callGeminiForContent = async (ai: any, base64: string, mimeType: string) => {
      const prompt = `
        Analyze this page of a North Cyprus Insurance List.
        Extract ALL employees in this list. 
        Return a JSON array of objects with keys: 
        - name: Full name (Adı Soyadı).
        - identityNo: ID number (Kimlik No).
        - salary: Gross salary (Brüt Kazanç) as a number.
        - deduction: Total deduction (Prim) as a number.
        Return ONLY the array.
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
          config: { responseMimeType: 'application/json' }
      });

      const text = response.text;
      try {
          const parsed = JSON.parse(text);
          return Array.isArray(parsed) ? parsed : (parsed.items || []);
      } catch (e) {
          console.error("Gemini Parse Error on page", e);
          return [];
      }
  };

  const saveImport = async () => {
      if (analyzedData.length === 0) return;
      const toastId = toast.loading(`${analyzedData.length} kayıt işleniyor...`);
      
      try {
          let newCount = 0;
          let updatedCount = 0;
          const coveredEmployeesForInsurance: any[] = [];

          for (const item of analyzedData) {
              if (item.status === 'new') {
                  const nameParts = item.name.split(' ');
                  const firstName = nameParts[0];
                  const lastName = nameParts.slice(1).join(' ');
                  
                  await supabaseService.addEmployee({
                      fullName: item.name, firstName, lastName,
                      identityNo: item.identityNo, salary: item.salary,
                      currency: 'TRY', position: 'Personel', 
                      startDate: `${importPeriod}-01`, isActive: true, insuranceNo: item.identityNo
                  });
                  newCount++;
              } else if (item.status === 'update') {
                  if (item.salary !== item.currentSalary) {
                      await supabaseService.updateEmployee(item.existingId, { salary: item.salary });
                      updatedCount++;
                  }
              }
          }

          // Generate Insurance Record
          const { data: freshEmployees } = await supabaseService.getEmployees();
          if (freshEmployees) {
              analyzedData.forEach(item => {
                  const match = freshEmployees.find(e => 
                      (e.identityNo && item.identityNo && e.identityNo.replace(/\s/g, '') === item.identityNo.replace(/\s/g, '')) ||
                      (e.fullName.toLowerCase() === item.name.toLowerCase())
                  );
                  if (match) {
                      coveredEmployeesForInsurance.push({
                          id: match.id, name: match.fullName, amount: item.deduction || 0
                      });
                  }
              });
          }

          const totalAmount = coveredEmployeesForInsurance.reduce((acc, curr) => acc + (curr.amount || 0), 0);
          if (totalAmount > 0) {
              await supabaseService.createInsurancePayment({
                  period: importPeriod, amount: totalAmount, currency: 'TRY',
                  type: 'Sosyal Sigorta / İhtiyat Sandığı',
                  paymentDate: new Date().toISOString().slice(0, 10),
                  description: `AI İçe Aktarım - ${importPeriod} Bordrosu`,
                  status: 'Bekliyor', coveredEmployees: coveredEmployeesForInsurance
              });
          }

          toast.success(`${newCount} yeni, ${updatedCount} güncellenen personel.`, { id: toastId });
          setShowImportModal(false);
          setAnalyzedData([]);
          loadData();

      } catch (err: any) {
          toast.error("Hata: " + err.message, { id: toastId });
      }
  };

  const handleAddNewPosition = () => {
      if (!newPositionName.trim()) return;
      const updatedPositions = [...positions, newPositionName.trim()];
      setPositions(updatedPositions);
      const savedDefs = localStorage.getItem('systemDefinitions');
      const parsed = savedDefs ? JSON.parse(savedDefs) : {};
      parsed.employeePositions = updatedPositions;
      localStorage.setItem('systemDefinitions', JSON.stringify(parsed));
      setFormData({ ...formData, position: newPositionName.trim() });
      setNewPositionName('');
      setIsAddingPosition(false);
      toast.success('Yeni pozisyon eklendi.');
  };

  const handleOpenCreate = () => {
      setEditingId(null);
      setFormData(initialFormState);
      setShowModal(true);
  };

  const handleEdit = (emp: Employee, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingId(emp.id);
      setFormData({
          firstName: emp.firstName || emp.fullName.split(' ')[0],
          lastName: emp.lastName || emp.fullName.split(' ').slice(1).join(' '),
          birthDate: emp.birthDate || '',
          identityNo: emp.identityNo || '',
          phone: emp.phone || '',
          email: emp.email || '',
          address: emp.address || '',
          position: emp.position || '',
          startDate: emp.startDate || '',
          insuranceNo: emp.insuranceNo || '',
          isActive: emp.isActive,
          hasWorkPermit: emp.hasWorkPermit,
          workPermitStartDate: emp.workPermitStartDate || '',
          workPermitEndDate: emp.workPermitEndDate || '',
          bankName: emp.bankName || '',
          branchName: emp.branchName || '',
          accountNo: emp.accountNo || '',
          iban: emp.iban || '',
          salary: emp.salary || 0,
          currency: emp.currency || 'TRY'
      });
      setShowModal(true);
  };

  // --- PERMISSIONS HANDLERS ---
  const handleOpenPermissions = (emp: Employee, e: React.MouseEvent) => {
      e.stopPropagation();
      setPermTarget(emp);
      setSelectedPerms(emp.permissions || []);
      setShowPermissionsModal(true);
  };

  const applyRoleTemplate = (roleName: string) => {
      const role = definitions.roles.find(r => r.name === roleName);
      if (role) {
          setSelectedPerms([...role.permissions]);
          toast.success(`'${roleName}' yetkileri uygulandı`);
      }
  };

  const handleSavePermissions = async () => {
      if (!permTarget) return;
      const finalPerms = selectedPerms.includes('all') ? ['all'] : selectedPerms;
      const res = await supabaseService.updateEmployee(permTarget.id, { permissions: finalPerms });
      if (res.error) {
          toast.error("Yetki güncelleme hatası: " + res.error);
      } else {
          toast.success("Yetkiler güncellendi!");
          setShowPermissionsModal(false);
          loadData();
      }
  };

  const togglePerm = (perm: string) => {
      if (perm === 'all') {
          if (selectedPerms.includes('all')) setSelectedPerms([]);
          else setSelectedPerms(['all']);
      } else {
          let newPerms = selectedPerms.filter(p => p !== 'all');
          if (newPerms.includes(perm)) newPerms = newPerms.filter(p => p !== perm);
          else newPerms.push(perm);
          setSelectedPerms(newPerms);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
        ...formData,
        fullName: `${formData.firstName} ${formData.lastName}`.trim()
    };

    let res;
    if (editingId) {
        res = await supabaseService.updateEmployee(editingId, payload);
    } else {
        res = await supabaseService.addEmployee(payload);
    }

    if (res.error) {
        toast.error('Hata: ' + res.error);
    } else {
        toast.success(editingId ? 'Personel güncellendi' : 'Personel eklendi');
        setShowModal(false);
        loadData();
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if(!confirm('Personeli silmek istediğinize emin misiniz?')) return;
    const res = await supabaseService.deleteEmployee(id);
    if (res.error) {
        toast.error('Hata: ' + res.error);
    } else {
        toast.success('Personel silindi');
        loadData();
    }
  };

  const isBirthdayToday = (dateString?: string) => {
      if (!dateString) return false;
      const today = new Date();
      const birth = new Date(dateString);
      return today.getDate() === birth.getDate() && today.getMonth() === birth.getMonth();
  };

  const filtered = employees.filter(e => {
      const matchesSearch = e.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = 
        filterType === 'all' ? true :
        filterType === 'foreign' ? e.hasWorkPermit :
        !e.hasWorkPermit;
      return matchesSearch && matchesFilter;
  });

  const stats = {
      total: employees.length,
      foreign: employees.filter(e => e.hasWorkPermit).length,
      local: employees.filter(e => !e.hasWorkPermit).length,
      birthdays: employees.filter(e => isBirthdayToday(e.birthDate))
  };

  const PERMISSION_OPTIONS = [
      { id: 'finance', label: 'Finans & Muhasebe' },
      { id: 'hr', label: 'İnsan Kaynakları' },
      { id: 'operations', label: 'Operasyon' },
      { id: 'crm', label: 'CRM & Satış' },
      { id: 'settings', label: 'Ayarlar' },
      { id: 'reports', label: 'Raporlar' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Birthday Banner */}
      {stats.birthdays.length > 0 && (
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-1 shadow-lg animate-in slide-in-from-top-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between text-white">
                  <div className="flex items-center gap-4">
                      <div className="bg-white text-pink-500 p-3 rounded-full shadow-md animate-bounce">
                          <Gift size={24} />
                      </div>
                      <div>
                          <h3 className="font-bold text-lg">İyi ki Doğdunuz! 🎉</h3>
                          <p className="text-pink-100 text-sm">
                              Bugün {stats.birthdays.map(e => e.firstName).join(", ")} isimli personelin doğum günü.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Personel Listesi</h1>
          <p className="text-slate-500">Çalışan kartları, izinler ve detaylı bilgiler.</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => setShowImportModal(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:shadow-lg transition flex items-center gap-2 font-bold"
            >
              <Sparkles size={18} /> AI Listesi
            </button>
            <button 
              onClick={handleOpenCreate}
              className="bg-brand-900 text-white px-5 py-3 rounded-xl hover:bg-brand-800 transition flex items-center gap-2 shadow-lg shadow-brand-900/20 font-bold"
            >
              <Plus size={20} /> Yeni Personel
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-brand-200 transition">
           <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">TOPLAM PERSONEL</p>
               <p className="text-3xl font-black text-brand-900">{stats.total}</p>
           </div>
           <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition">
               <User size={24} />
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition">
           <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">YERLİ İSTİHDAM</p>
               <p className="text-3xl font-black text-blue-600">{stats.local}</p>
           </div>
           <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
               <Home size={24} />
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-orange-200 transition">
           <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">YABANCI UYRUKLU</p>
               <p className="text-3xl font-black text-orange-600">{stats.foreign}</p>
           </div>
           <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
               <Globe size={24} />
           </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="İsim Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
          
          <div className="flex gap-2">
              <button onClick={() => setFilterType('all')} className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2", filterType === 'all' ? "bg-white shadow text-brand-900" : "text-slate-500 hover:text-slate-700")}>
                  <Filter size={16} /> Tümü
              </button>
              <button onClick={() => setFilterType('local')} className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition", filterType === 'local' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-blue-600")}>
                  Yerli
              </button>
              <button onClick={() => setFilterType('foreign')} className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition", filterType === 'foreign' ? "bg-white shadow text-orange-600" : "text-slate-500 hover:text-orange-600")}>
                  Yabancı
              </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
           {filtered.length === 0 ? (
               <div className="col-span-full py-12 text-center text-slate-400">
                   Kayıt bulunamadı.
               </div>
           ) : filtered.map(emp => (
             <div 
                key={emp.id} 
                onClick={() => navigate(`/staff/${emp.id}`)}
                className="border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-white relative group cursor-pointer overflow-hidden"
             >
                <div className={clsx("absolute top-0 left-0 w-full h-1.5", emp.isActive ? "bg-green-500" : "bg-slate-300")}></div>

                <div className="flex items-start gap-4 mb-4 mt-2">
                   <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-xl font-bold border-2 border-white shadow-sm">
                      {emp.firstName?.[0]}{emp.lastName?.[0]}
                   </div>
                   <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-brand-900 truncate">{emp.fullName}</h3>
                      <p className="text-xs font-bold uppercase text-accent-600 truncate mb-1">{emp.position}</p>
                      <div className="flex gap-2">
                          {emp.hasWorkPermit ? <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold border border-orange-200">Çalışma İzinli</span> : <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">KKTC / TC</span>}
                          {!emp.isActive && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold border border-slate-200">Pasif</span>}
                      </div>
                   </div>
                </div>
                
                <div className="space-y-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                   <div className="flex items-center gap-2 truncate">
                       <Phone size={14} className="text-slate-400"/> {emp.phone || '-'}
                   </div>
                   <div className="flex items-center gap-2 truncate">
                       <Mail size={14} className="text-slate-400"/> {emp.email || '-'}
                   </div>
                   <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <DollarSign size={14} className="text-green-600"/> 
                      <span className="font-bold text-slate-800">{emp.salary.toLocaleString()} {emp.currency}</span>
                      <span className="text-xs text-slate-400 ml-auto font-bold uppercase">MAAŞ</span>
                   </div>
                </div>

                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => handleOpenPermissions(emp, e)}
                      className="p-1.5 bg-white text-slate-400 hover:text-purple-600 rounded-lg shadow-sm border border-slate-100 hover:border-purple-200 transition"
                      title="Yetkileri Düzenle"
                    >
                       <Shield size={16} />
                    </button>
                    <button 
                      onClick={(e) => handleEdit(emp, e)}
                      className="p-1.5 bg-white text-slate-400 hover:text-blue-600 rounded-lg shadow-sm border border-slate-100 hover:border-blue-200 transition"
                    >
                       <Edit size={16} />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(emp.id, e)}
                      className="p-1.5 bg-white text-slate-400 hover:text-red-600 rounded-lg shadow-sm border border-slate-100 hover:border-red-200 transition"
                    >
                       <Trash2 size={16} />
                    </button>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Permissions Modal */}
      {showPermissionsModal && permTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b bg-brand-900 text-white flex justify-between items-center">
                      <h4 className="font-bold flex items-center gap-2"><Shield size={18}/> Erişim Yetkileri</h4>
                      <button onClick={() => setShowPermissionsModal(false)}><X size={18}/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm font-bold text-slate-800 mb-1">{permTarget.fullName}</p>
                      
                      {/* Role Templates Selection */}
                      <div className="mb-4">
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Hızlı Rol Ata</label>
                          <div className="flex flex-wrap gap-2">
                              {definitions.roles?.map((role, i) => (
                                  <button 
                                    key={i}
                                    onClick={() => applyRoleTemplate(role.name)}
                                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition"
                                  >
                                      {role.name}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="h-px bg-slate-100 my-4"></div>
                      
                      <div className="space-y-3">
                          <button 
                              onClick={() => togglePerm('all')}
                              className={clsx("w-full flex items-center gap-3 p-3 rounded-xl border transition", 
                                  selectedPerms.includes('all') ? "bg-green-50 border-green-200 text-green-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              )}
                          >
                              {selectedPerms.includes('all') ? <CheckSquare size={20} className="text-green-600"/> : <Square size={20}/>}
                              <span className="font-bold text-sm">Tam Yetki (Admin)</span>
                          </button>

                          {PERMISSION_OPTIONS.map(opt => (
                              <button 
                                  key={opt.id}
                                  onClick={() => togglePerm(opt.id)}
                                  disabled={selectedPerms.includes('all')}
                                  className={clsx("w-full flex items-center gap-3 p-2 rounded-lg transition text-left", 
                                      selectedPerms.includes(opt.id) ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50",
                                      selectedPerms.includes('all') && "opacity-50 cursor-not-allowed"
                                  )}
                              >
                                  {selectedPerms.includes(opt.id) || selectedPerms.includes('all') ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18}/>}
                                  <span className="text-sm">{opt.label}</span>
                              </button>
                          ))}
                      </div>

                      <button onClick={handleSavePermissions} className="w-full bg-brand-900 text-white py-3 rounded-xl font-bold mt-6 hover:bg-brand-800 transition">
                          Kaydet
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* AI IMPORT MODAL */}
      {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/80 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                  <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center shrink-0 text-white">
                      <div className="flex items-center gap-3">
                          <Sparkles size={24} className="text-yellow-300"/>
                          <div>
                              <h3 className="font-bold text-lg">AI Sigorta & Personel İçe Aktarma</h3>
                              <p className="text-xs text-indigo-200">Yüzlerce kayıt Gemini AI ile otomatik olarak işlenir.</p>
                          </div>
                      </div>
                      <button onClick={() => setShowImportModal(false)} className="hover:bg-indigo-700 p-2 rounded-lg transition"><X size={20}/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                      {isAnalyzing ? (
                          <div className="h-full flex flex-col items-center justify-center text-center">
                              <div className="w-64 h-2 bg-slate-200 rounded-full mb-6 overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-600 transition-all duration-300" 
                                    style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                                  />
                              </div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">Liste Analiz Ediliyor...</h3>
                              <p className="text-slate-500">
                                  Sayfa {analysisProgress.current} / {analysisProgress.total} işleniyor.
                                  <br/>Büyük listeler için bu işlem 1-2 dakika sürebilir.
                              </p>
                              <Loader2 size={48} className="animate-spin text-indigo-600 mt-8" />
                          </div>
                      ) : !analyzedData.length ? (
                          <div className="h-full flex flex-col items-center justify-center text-center">
                              <div className="bg-white p-8 rounded-full shadow-lg mb-6 animate-pulse"><Upload size={48} className="text-indigo-500" /></div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">Sigorta Listesi Yükleyin (PDF/Resim)</h3>
                              <p className="text-slate-500 mb-8 max-w-md">Gemini AI, 18 sayfaya kadar olan ağır listeleri tek tek tarayarak personelleri sisteme aktarır.</p>
                              <label className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition shadow-xl flex items-center gap-2">
                                  <FileText size={24}/> Dosya Seç & Analiz Et
                                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileSelect} ref={fileInputRef}/>
                              </label>
                          </div>
                      ) : (
                          <div className="space-y-6">
                              <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                  <div className="flex items-center gap-4">
                                      <div className="text-sm">
                                          <p className="text-slate-500 font-bold uppercase text-[10px]">DÖNEM</p>
                                          <input type="month" value={importPeriod} onChange={(e) => setImportPeriod(e.target.value)} className="font-bold text-indigo-700 border-b border-indigo-200 outline-none"/>
                                      </div>
                                      <div className="h-8 w-px bg-slate-200"></div>
                                      <div className="text-sm">
                                          <p className="text-slate-500 font-bold uppercase text-[10px]">TOPLAM TESPİT</p>
                                          <p className="font-bold text-slate-800">{analyzedData.length} Kişi</p>
                                      </div>
                                  </div>
                                  <button onClick={() => { setAnalyzedData([]); setImportFile(null); }} className="text-slate-500 hover:text-slate-700 px-3 py-2 text-sm font-bold">İptal</button>
                              </div>
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                  <table className="w-full text-left text-sm">
                                      <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold sticky top-0">
                                          <tr><th className="p-3">Adı Soyadı</th><th className="p-3">Kimlik No</th><th className="p-3 text-right">Maaş (Brüt)</th><th className="p-3 text-center">Durum</th></tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                          {analyzedData.map((item, idx) => (
                                              <tr key={idx} className="hover:bg-slate-50">
                                                  <td className="p-3 font-bold text-slate-800">{item.name}</td>
                                                  <td className="p-3 font-mono text-slate-600">{item.identityNo}</td>
                                                  <td className="p-3 text-right font-medium">{item.salary?.toLocaleString()}</td>
                                                  <td className="p-3 text-center">
                                                      {item.status === 'new' ? (
                                                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200"><Plus size={12}/> Yeni</span>
                                                      ) : (
                                                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100"><CheckCircle size={12}/> Mevcut</span>
                                                      )}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </div>

                  {analyzedData.length > 0 && (
                      <div className="p-4 bg-white border-t border-slate-200 flex justify-end shrink-0">
                          <button onClick={saveImport} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg flex items-center gap-2">
                              <Save size={18}/> Onayla ve {analyzedData.length} Kaydı Aktar
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Staff Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-white font-bold text-lg">{editingId ? 'Personel Düzenle' : 'Yeni Personel Kartı'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition bg-white/10 p-1 rounded-lg"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
              
              {/* Personal Info */}
              <div>
                  <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                      <User size={16} className="text-accent-500"/> Kişisel Bilgiler
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Ad</label>
                        <input required className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 transition" 
                            value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Soyad</label>
                        <input required className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 transition" 
                            value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Doğum Tarihi</label>
                        <input type="date" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none" 
                            value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Kimlik No</label>
                        <input className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none" 
                            value={formData.identityNo} onChange={e => setFormData({...formData, identityNo: e.target.value})} />
                      </div>
                  </div>
              </div>

              {/* Work Info */}
              <div>
                  <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                      <Briefcase size={16} className="text-accent-500"/> İş & Pozisyon
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Pozisyon</label>
                        <div className="flex gap-2">
                            <select 
                                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-white" 
                                value={formData.position} 
                                onChange={e => setFormData({...formData, position: e.target.value})}
                            >
                                <option value="">Seçiniz...</option>
                                {positions.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <button type="button" onClick={() => setIsAddingPosition(!isAddingPosition)} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg text-slate-600"><Plus size={18}/></button>
                        </div>
                        {isAddingPosition && (
                            <div className="flex gap-2 mt-2">
                                <input className="flex-1 border rounded-lg p-2 text-xs" placeholder="Yeni Pozisyon Adı" value={newPositionName} onChange={e => setNewPositionName(e.target.value)}/>
                                <button type="button" onClick={handleAddNewPosition} className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold">Ekle</button>
                            </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">İşe Başlama</label>
                        <input type="date" required className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none" 
                            value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Maaş</label>
                        <input type="number" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none font-bold text-slate-800" 
                            value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Para Birimi</label>
                        <select className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none bg-white" 
                            value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}>
                            <option value="TRY">TRY</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                        </select>
                      </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500" 
                            checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                          <span className="text-sm font-bold text-slate-700">Aktif Personel</span>
                      </label>
                      <div className="h-4 w-px bg-slate-300"></div>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500" 
                            checked={formData.hasWorkPermit} onChange={e => setFormData({...formData, hasWorkPermit: e.target.checked})} />
                          <span className="text-sm font-bold text-slate-700">Çalışma İzni Gerekli</span>
                      </label>
                  </div>

                  {formData.hasWorkPermit && (
                      <div className="grid grid-cols-2 gap-4 mt-4 bg-orange-50 p-3 rounded-xl border border-orange-100 animate-in fade-in">
                          <div>
                            <label className="text-[10px] font-bold text-orange-700 uppercase block mb-1">İzin Başlangıç</label>
                            <input type="date" className="w-full border border-orange-200 rounded-lg p-2 text-sm outline-none bg-white" 
                                value={formData.workPermitStartDate} onChange={e => setFormData({...formData, workPermitStartDate: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-orange-700 uppercase block mb-1">İzin Bitiş</label>
                            <input type="date" className="w-full border border-orange-200 rounded-lg p-2 text-sm outline-none bg-white" 
                                value={formData.workPermitEndDate} onChange={e => setFormData({...formData, workPermitEndDate: e.target.value})} />
                          </div>
                      </div>
                  )}
              </div>

              {/* Contact Info */}
              <div>
                  <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                      <Phone size={16} className="text-accent-500"/> İletişim & Adres
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Telefon</label>
                        <input className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none" 
                            value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">E-Posta</label>
                        <input type="email" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none" 
                            value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                      </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Adres</label>
                    <textarea className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none h-20 resize-none" 
                        value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
              </div>

              <div className="pt-4 sticky bottom-0 bg-white">
                 <button type="submit" className="w-full bg-brand-900 text-white py-3.5 rounded-xl font-bold hover:bg-brand-800 transition shadow-lg shadow-brand-900/20 text-base">{editingId ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
