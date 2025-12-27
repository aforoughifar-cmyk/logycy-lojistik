
import React, { useEffect, useState, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Employee } from '../types';
import { Plus, Search, User, Phone, Mail, DollarSign, Trash2, X, Briefcase, Sparkles, Upload, FileText, CheckCircle, AlertCircle, ArrowRight, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from "@google/genai";

const HR: React.FC = () => {
  const { definitions } = useStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // AI Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<any[]>([]);
  const [importPeriod, setImportPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Filter State
  const [filterType, setFilterType] = useState<'all' | 'local' | 'foreign'>('all');

  // Dynamic Positions State
  const [positions, setPositions] = useState<string[]>(['Müdür', 'Operasyon Sorumlusu', 'Muhasebe', 'Saha Personeli', 'Şoför', 'Depo Sorumlusu']);
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');

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

  // --- AI IMPORT LOGIC ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setImportFile(e.target.files[0]);
          setAnalyzedData([]); // Reset previous data
      }
  };

  const analyzeFile = async () => {
      if (!importFile) return;
      setIsAnalyzing(true);
      try {
          const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(importFile);
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = error => reject(error);
          });

          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            Analyze this image of a North Cyprus Insurance List (İhtiyat Sandığı / Sosyal Sigorta).
            Extract the employee list.
            
            Return a JSON object with:
            - period: The document date in YYYY-MM format (e.g. 2025-10). If not found, use null.
            - items: Array of employees. Each item must have:
                - name: Full name of employee (Adı Soyadı).
                - identityNo: ID number (Kimlik No / Sigorta No). Clean spaces.
                - salary: Gross salary (Brüt Kazanç) as number.
                - deduction: Total deduction amount (Prim/Kesinti) if visible, else 0.
            
            CRITICAL: Ensure 'identityNo' is extracted accurately as it is used for matching.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: importFile.type, data: base64Data } }] }],
              config: { responseMimeType: 'application/json' }
          });

          const result = JSON.parse(response.text || '{}');
          if (result.period) setImportPeriod(result.period);

          // Process and Match Data
          const processed = (result.items || []).map((item: any) => {
              // Try to find existing employee
              const existing = employees.find(e => 
                  (e.identityNo && e.identityNo.replace(/\s/g, '') === item.identityNo?.replace(/\s/g, '')) ||
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
          toast.success(`${processed.length} kayıt analiz edildi.`);

      } catch (error: any) {
          console.error(error);
          toast.error("AI Analiz Hatası: " + error.message);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const saveImport = async () => {
      if (analyzedData.length === 0) return;
      const toastId = toast.loading('Veriler işleniyor...');
      
      try {
          let newCount = 0;
          let updatedCount = 0;
          const coveredEmployeesForInsurance: any[] = [];

          for (const item of analyzedData) {
              let empId = item.existingId;

              if (item.status === 'new') {
                  // Create New Employee
                  const nameParts = item.name.split(' ');
                  const firstName = nameParts[0];
                  const lastName = nameParts.slice(1).join(' ');
                  
                  const newEmp: Partial<Employee> = {
                      fullName: item.name,
                      firstName,
                      lastName,
                      identityNo: item.identityNo,
                      salary: item.salary,
                      currency: 'TRY', // Default for Insurance lists in TRNC
                      position: 'Personel', // Default
                      startDate: `${importPeriod}-01`,
                      isActive: true,
                      insuranceNo: item.identityNo // Often same or similar
                  };
                  
                  // We need to fetch the ID of the created employee, 
                  // but our service addEmployee returns void/error currently.
                  // For this feature to work perfectly, we'd ideally fetch the created user.
                  // Since we are iterating, let's just do the insert.
                  // To link insurance, we'll fetch all employees again after loop or try to get ID.
                  
                  // Workaround: We'll re-query or assume success for list generation. 
                  // Ideally `addEmployee` should return data. 
                  // Let's assume we can match by IdentityNo after refresh.
                  await supabaseService.addEmployee(newEmp);
                  newCount++;
              } else if (item.status === 'update') {
                  // Update Salary if changed
                  if (item.salary !== item.currentSalary) {
                      await supabaseService.updateEmployee(empId, { salary: item.salary });
                      updatedCount++;
                  }
              }
          }

          // Refresh employees to get IDs for the insurance record
          const { data: freshEmployees } = await supabaseService.getEmployees();
          if (freshEmployees) {
              analyzedData.forEach(item => {
                  const match = freshEmployees.find(e => 
                      (e.identityNo && e.identityNo.replace(/\s/g, '') === item.identityNo?.replace(/\s/g, '')) ||
                      (e.fullName.toLowerCase() === item.name.toLowerCase())
                  );
                  if (match) {
                      coveredEmployeesForInsurance.push({
                          id: match.id,
                          name: match.fullName,
                          amount: item.deduction || 0
                      });
                  }
              });
          }

          // Create Insurance Payment Record
          const totalAmount = coveredEmployeesForInsurance.reduce((acc, curr) => acc + (curr.amount || 0), 0);
          if (totalAmount > 0) {
              await supabaseService.createInsurancePayment({
                  period: importPeriod,
                  amount: totalAmount,
                  currency: 'TRY',
                  type: 'Sosyal Sigorta / İhtiyat Sandığı',
                  paymentDate: new Date().toISOString().slice(0, 10),
                  description: `AI İçe Aktarım - ${importPeriod} Bordrosu`,
                  status: 'Bekliyor',
                  coveredEmployees: coveredEmployeesForInsurance
              });
          }

          toast.success(`${newCount} yeni personel, ${updatedCount} güncelleme yapıldı.`, { id: toastId });
          setShowImportModal(false);
          setAnalyzedData([]);
          setImportFile(null);
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
  };

  return (
    <div className="space-y-6">
      
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
              <Sparkles size={18} /> AI Listesi Yükle
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
               <Briefcase size={24} />
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-orange-200 transition">
           <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">YABANCI UYRUKLU</p>
               <p className="text-3xl font-black text-orange-600">{stats.foreign}</p>
           </div>
           <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
               <FileText size={24} />
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
              <button onClick={() => setFilterType('all')} className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition", filterType === 'all' ? "bg-white shadow text-brand-900" : "text-slate-500 hover:text-slate-700")}>
                  Tümü
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

                <button 
                  onClick={(e) => handleDelete(emp.id, e)}
                  className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                >
                   <Trash2 size={18} />
                </button>
             </div>
           ))}
        </div>
      </div>

      {/* AI IMPORT MODAL */}
      {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/80 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                  
                  {/* Header */}
                  <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center shrink-0 text-white">
                      <div className="flex items-center gap-3">
                          <Sparkles size={24} className="text-yellow-300"/>
                          <div>
                              <h3 className="font-bold text-lg">AI Sigorta & Personel İçe Aktarma</h3>
                              <p className="text-xs text-indigo-200">Liste fotoğrafından otomatik personel oluşturma ve maaş güncelleme.</p>
                          </div>
                      </div>
                      <button onClick={() => setShowImportModal(false)} className="hover:bg-indigo-700 p-2 rounded-lg transition"><X size={20}/></button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                      
                      {!analyzedData.length ? (
                          <div className="h-full flex flex-col items-center justify-center text-center">
                              <div className="bg-white p-8 rounded-full shadow-lg mb-6 animate-pulse">
                                  <Upload size={48} className="text-indigo-500" />
                              </div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">Sigorta Listesi Yükleyin</h3>
                              <p className="text-slate-500 mb-8 max-w-md">
                                  İhtiyat Sandığı veya Sosyal Sigorta listesinin fotoğrafını (PDF/JPG) yükleyin. 
                                  Yapay zeka (Gemini) personelleri otomatik tanıyacaktır.
                              </p>
                              
                              <label className={clsx("bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition shadow-xl flex items-center gap-2", isAnalyzing && "opacity-70 pointer-events-none")}>
                                  {isAnalyzing ? <Loader2 size={24} className="animate-spin"/> : <FileText size={24}/>}
                                  {isAnalyzing ? 'Analiz Ediliyor...' : 'Dosya Seç & Tara'}
                                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileSelect} ref={fileInputRef}/>
                              </label>
                              
                              {isAnalyzing && <p className="mt-4 text-xs font-bold text-indigo-600 animate-bounce">Gemini AI verileri okuyor...</p>}
                          </div>
                      ) : (
                          <div className="space-y-6">
                              <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                  <div className="flex items-center gap-4">
                                      <div className="text-sm">
                                          <p className="text-slate-500 font-bold uppercase text-[10px]">TESPİT EDİLEN DÖNEM</p>
                                          <input 
                                            type="month" 
                                            value={importPeriod} 
                                            onChange={(e) => setImportPeriod(e.target.value)} 
                                            className="font-bold text-indigo-700 border-b border-indigo-200 outline-none"
                                          />
                                      </div>
                                      <div className="h-8 w-px bg-slate-200"></div>
                                      <div className="text-sm">
                                          <p className="text-slate-500 font-bold uppercase text-[10px]">TOPLAM PERSONEL</p>
                                          <p className="font-bold text-slate-800">{analyzedData.length}</p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => { setAnalyzedData([]); setImportFile(null); }} className="text-slate-500 hover:text-slate-700 px-3 py-2 text-sm font-bold">İptal</button>
                                      <button onClick={analyzeFile} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">Yeniden Tara</button>
                                  </div>
                              </div>

                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                  <table className="w-full text-left text-sm">
                                      <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold">
                                          <tr>
                                              <th className="p-3">Adı Soyadı</th>
                                              <th className="p-3">Kimlik No</th>
                                              <th className="p-3 text-right">Maaş (Brüt)</th>
                                              <th className="p-3 text-center">Durum</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                          {analyzedData.map((item, idx) => (
                                              <tr key={idx} className="hover:bg-slate-50">
                                                  <td className="p-3 font-bold text-slate-800">{item.name}</td>
                                                  <td className="p-3 font-mono text-slate-600">{item.identityNo}</td>
                                                  <td className="p-3 text-right font-medium">
                                                      {item.salary?.toLocaleString()}
                                                      {item.status === 'update' && item.salary !== item.currentSalary && (
                                                          <span className="text-[10px] text-slate-400 block line-through">{item.currentSalary?.toLocaleString()}</span>
                                                      )}
                                                  </td>
                                                  <td className="p-3 text-center">
                                                      {item.status === 'new' ? (
                                                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">
                                                              <Plus size={12}/> Yeni Kayıt
                                                          </span>
                                                      ) : (
                                                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                                                              <CheckCircle size={12}/> Mevcut
                                                          </span>
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

                  {/* Footer Actions */}
                  {analyzedData.length > 0 && (
                      <div className="p-4 bg-white border-t border-slate-200 flex justify-end shrink-0">
                          <button 
                            onClick={saveImport}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg flex items-center gap-2"
                          >
                              <Save size={18}/> 
                              Onayla ve İçe Aktar
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

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

export default HR;
