
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Database, CheckCircle, FileSpreadsheet, ArrowRight, Play, Loader2, FileText, Ship, AlertTriangle, Plus, Save, Trash2, Settings, X, MousePointer2, Eraser, Container as ContainerIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
import { supabaseService } from '../services/supabaseService';
import { ShipmentStatus, ManifestItem, ManifestGood } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

// --- TYPES ---
interface Template {
    id: string;
    name: string;
    splitters: number[]; // X percentages (0-100)
    columns: string[]; // Field types
}

interface ExtractedRow {
    sequenceNo: string;      // Sıra No
    transportDocNo: string;  // 14. Taşıma Senedi
    containerNo: string;     // Konteyner No (Includes type now if present)
    packageCount: string;    // 15. Adedi
    packageType: string;     // 15. Cinsi
    marks: string;           // Marka ve Nosu
    description: string;     // 16. Eşyanın Tanımı (Cinsi)
    weight: string;          // Brüt A.(kg)
    receiverName: string;    // 17. Alıcı
    
    // Computed / Global
    tescilNo: string;
    blNo: string;
    vesselName?: string;
}

const Integration: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualVesselName, setManualVesselName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [importResults, setImportResults] = useState<{
    shipmentsCreated: number;
    ordinosCreated: number;
    errors: number;
  } | null>(null);

  // Template State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isDesigning, setIsDesigning] = useState(false);
  
  // Designer State
  const [pdfImages, setPdfImages] = useState<string[]>([]); // Array of Image Data URLs
  const [tempSplitters, setTempSplitters] = useState<number[]>([]); // X percentages
  const [tempColumnTypes, setTempColumnTypes] = useState<string[]>(['ignore']); 
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [targetShipmentId, setTargetShipmentId] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [importType, setImportType] = useState<'pdf' | 'excel'>('pdf');
  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>([]);
  
  // Shipments Data for Selection
  const [shipments, setShipments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // Quick Create Master Shipment State
  const [isCreatingMaster, setIsCreatingMaster] = useState(false);
  const [newMasterData, setNewMasterData] = useState({ 
      referenceNo: '', 
      vesselName: '',
      tescilDate: '',
      arrivalDate: ''
  });
  
  const designerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const saved = localStorage.getItem('manifestTemplates');
      if (saved) setTemplates(JSON.parse(saved));
      loadData();
  }, []);

  const loadData = async () => {
      const [shipRes, custRes] = await Promise.all([
          supabaseService.getAllShipments(),
          supabaseService.getCustomers()
      ]);
      if (shipRes.data) setShipments(shipRes.data);
      if (custRes.data) setCustomers(custRes.data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setImportResults(null);
      setLogs([]);
      setActiveStep(1);
    }
  };

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);
  const cleanString = (str: string) => str ? str.trim().replace(/\s+/g, ' ') : '';

  // --- PDF PREVIEW & TEMPLATE ---
  const loadPdfPreview = async () => {
      if (!selectedFile) return;
      setIsUploading(true);
      try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          const images: string[] = [];
          const maxPages = Math.min(pdf.numPages, 5);
          
          for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const scale = 1.5;
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              if (context) {
                  await page.render({ canvasContext: context, viewport } as any).promise;
                  images.push(canvas.toDataURL('image/png'));
              }
          }
          setPdfImages(images);
          setIsDesigning(true);
          setTempSplitters([]);
          setTempColumnTypes(['ignore']);
      } catch (e: any) {
          toast.error("PDF Önizleme hatası: " + e.message);
      } finally {
          setIsUploading(false);
      }
  };

  // --- TEMPLATE DESIGNER FUNCTIONS ---
  const addSplitter = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!designerRef.current) return;
      const rect = designerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let percent = (x / rect.width) * 100;
      percent = Math.max(1, Math.min(99, percent));
      
      const newSplitters = [...tempSplitters, percent].sort((a, b) => a - b);
      setTempSplitters(newSplitters);
      
      const newTypes = [...tempColumnTypes];
      let index = 0;
      for(let i=0; i<tempSplitters.length; i++) {
          if (percent > tempSplitters[i]) index = i + 1;
      }
      newTypes.splice(index + 1, 0, 'ignore');
      setTempColumnTypes(newTypes);
  };

  const removeSplitter = (index: number) => {
      const newSplitters = tempSplitters.filter((_, i) => i !== index);
      setTempSplitters(newSplitters);
      const newTypes = tempColumnTypes.filter((_, i) => i !== index + 1);
      setTempColumnTypes(newTypes);
  };

  const updateColumnType = (index: number, type: string) => {
      const newTypes = [...tempColumnTypes];
      newTypes[index] = type;
      setTempColumnTypes(newTypes);
  };

  const clearAllSplitters = () => {
      setTempSplitters([]);
      setTempColumnTypes(['ignore']);
  };

  const saveTemplate = () => {
      if (!newTemplateName) return toast.error("Şablon ismi giriniz");
      const newTemplate: Template = {
          id: Date.now().toString(),
          name: newTemplateName,
          splitters: tempSplitters,
          columns: tempColumnTypes
      };
      const updated = [...templates, newTemplate];
      setTemplates(updated);
      localStorage.setItem('manifestTemplates', JSON.stringify(updated));
      setSelectedTemplateId(newTemplate.id);
      setIsDesigning(false);
      toast.success("Şablon kaydedildi!");
  };

  const deleteTemplate = (id: string) => {
      if(!confirm("Şablonu silmek istiyor musunuz?")) return;
      const updated = templates.filter(t => t.id !== id);
      setTemplates(updated);
      localStorage.setItem('manifestTemplates', JSON.stringify(updated));
      if (selectedTemplateId === id) setSelectedTemplateId('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          setImportFile(file);
          setExtractedRows([]);
          
          if (importType === 'pdf') {
              await processPdfWithGemini(file);
          } else {
              await processExcelFile(file);
          }
      }
  };

  // 1. EXCEL PROCESSOR
  const processExcelFile = async (file: File) => {
      setIsProcessing(true);
      setProcessingStatus('Excel okunuyor...');
      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          const rows: ExtractedRow[] = [];
          const startRow = jsonData.findIndex(row => row.some(c => String(c).toLowerCase().includes('konteyner') || String(c).toLowerCase().includes('container'))) + 1;
          
          for (let i = startRow || 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if(!row || row.length < 2) continue;
              
              const val = (idx: number) => row[idx] ? String(row[idx]).trim() : '';
              if (!val(2) && !val(6)) continue;

              // Simply take the raw string
              const rawContainer = val(2);

              rows.push({
                  sequenceNo: val(0),
                  transportDocNo: val(1),
                  containerNo: rawContainer,
                  packageCount: val(3),
                  packageType: val(4) || 'Koli',
                  marks: val(5),
                  description: val(6),
                  weight: val(7), 
                  receiverName: val(8),
                  tescilNo: '',
                  blNo: val(1),
                  containerType: 'Unknown' // Not used in display anymore
              } as any);
          }
          setExtractedRows(rows);
          toast.success(`${rows.length} satır Excel'den alındı.`);
      } catch (error: any) {
          toast.error("Excel Hatası: " + error.message);
      } finally {
          setIsProcessing(false);
          setProcessingStatus('');
      }
  };

  // 2. AI PROCESSOR (Gemini 2.5 Flash)
  const processPdfWithGemini = async (file: File) => {
      setIsProcessing(true);
      setProcessingStatus('PDF metne dönüştürülüyor...');
      
      try {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          let fullText = "";
          const numPages = pdf.numPages;

          for (let i = 1; i <= numPages; i++) {
              setProcessingStatus(`Sayfa ${i} / ${numPages} okunuyor...`);
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += `--- PAGE ${i} START ---\n${pageText}\n--- PAGE ${i} END ---\n`;
          }

          setProcessingStatus('Yapay Zeka (Gemini) veriyi analiz ediyor...');
          
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            You are a data extraction expert analyzing a Shipping Manifest (Ordinato/Konşimento) document.
            Please extract all the cargo items into a clean JSON structure.
            
            CRITICAL RULES:
            1. **receiverName**: Extract only the "Consignee" / "Alıcı". Do NOT extract "Shipper".
            2. **containerNo**: Extract the FULL string (e.g., "ZCSU6538061- 1X40HQ").
            3. **Global Headers**: Look for "Tescil Tarihi" (Registration Date), "Varış Tarihi" (Arrival Date), "Vessel Name".

            Return ONLY the JSON object with keys:
            vesselName, tescilNo, tescilDate, arrivalDate,
            items: [{ sequenceNo, transportDocNo, containerNo, packageCount, packageType, marks, description, weight, receiverName }]
            
            DOCUMENT TEXT:
            ${fullText}
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const jsonText = response.text;
          if (!jsonText) throw new Error("AI Empty Response");
          const result = JSON.parse(jsonText);
          
          const mappedRows: ExtractedRow[] = (result.items || []).map((item: any) => {
              const rawCont = item.containerNo || '';

              return {
                  sequenceNo: item.sequenceNo || '',
                  transportDocNo: item.transportDocNo || '',
                  containerNo: rawCont,
                  packageCount: item.packageCount || '',
                  packageType: item.packageType || 'Kap',
                  marks: item.marks || '',
                  description: item.description || '',
                  weight: item.weight || '', 
                  receiverName: item.receiverName || '',
                  tescilNo: result.tescilNo || '',
                  blNo: item.transportDocNo || '',
                  vesselName: result.vesselName || '',
                  containerType: 'Unknown'
              } as any;
          });

          setExtractedRows(mappedRows);
          setNewMasterData(prev => ({ 
              ...prev, 
              vesselName: result.vesselName || '',
              tescilDate: result.tescilDate || '',
              arrivalDate: result.arrivalDate || ''
          }));
          
          toast.success(`${mappedRows.length} satır başarıyla analiz edildi.`);

      } catch (error: any) {
          console.error(error);
          toast.error("AI İşleme Hatası: " + error.message);
      } finally {
          setIsProcessing(false);
          setProcessingStatus('');
      }
  };

  // --- SAVING LOGIC ---
  const saveImportResult = async () => {
      if (!targetShipmentId) return toast.error("Hedef dosya seçilmedi.");
      if (extractedRows.length === 0) return toast.error("Veri yok.");

      setIsUploading(true); // Re-use this flag for saving state
      const newManifestItems: ManifestItem[] = [];
      const containerTypesMap = new Map<string, string>();
      
      const { data: latestCustomers } = await supabaseService.getCustomers();
      const currentCustomers = latestCustomers || customers;

      for (const row of extractedRows) {
          // 1. Customer
          let customerId = '';
          const normalizedName = row.receiverName?.trim() || 'BİLİNMEYEN ALICI';
          let existingCust = currentCustomers.find(c => c.name.trim().toLowerCase() === normalizedName.toLowerCase());
          
          if (existingCust) {
              customerId = existingCust.id;
          } else if (normalizedName.length > 2 && normalizedName !== 'BİLİNMEYEN ALICI') {
              const newCust = await supabaseService.createCustomer({ name: normalizedName, type: 'musteri', phone: '', email: '', address: 'Otomatik' });
              if (newCust.data) {
                  customerId = newCust.data.id;
                  currentCustomers.push(newCust.data);
              }
          }

          // 2. Track Container - Just use full string
          if (row.containerNo && row.containerNo.length > 3) {
              containerTypesMap.set(row.containerNo, 'Unknown');
          }

          // 3. Merge Manifest Items
          const existingItemIndex = newManifestItems.findIndex(i => i.transportDocNo === row.transportDocNo && i.containerNo === row.containerNo);

          if (existingItemIndex > -1) {
              newManifestItems[existingItemIndex].goods.push({
                  description: row.description,
                  quantity: parseFloat(row.packageCount) || 0,
                  packageType: row.packageType,
                  marks: row.marks,
                  weight: row.weight,
                  volume: '0'
              });
          } else {
              newManifestItems.push({
                  id: Math.random().toString(36).substr(2, 9),
                  customerId: customerId,
                  customerName: normalizedName,
                  containerNo: row.containerNo,
                  blNo: row.blNo || row.transportDocNo, 
                  tescilNo: row.tescilNo,
                  transportDocNo: row.transportDocNo, 
                  vesselName: newMasterData.vesselName,
                  goods: [{
                      description: row.description,
                      quantity: parseFloat(row.packageCount) || 0,
                      packageType: row.packageType,
                      marks: row.marks,
                      weight: row.weight,
                      volume: '0'
                  }],
                  isSaved: false
              });
          }
      }

      const shipment = shipments.find(s => s.id === targetShipmentId);
      if (shipment) {
          const currentManifest = shipment.manifest || [];
          const updatedManifest = [...currentManifest, ...newManifestItems];
          await supabaseService.updateShipmentDetails(shipment.id, { manifest: updatedManifest });
          
          // Upsert Containers with TYPE (Default Unknown as we hide it)
          for (const [contNo, type] of containerTypesMap.entries()) {
              await supabaseService.upsertContainer({
                  shipmentId: shipment.id,
                  containerNo: contNo,
                  type: type
              });
          }

          toast.success("Aktarım tamamlandı.");
          setShowImportModal(false);
          setExtractedRows([]);
          setImportFile(null);
      }
      setIsUploading(false);
  };

  const updateRow = (index: number, field: keyof ExtractedRow, value: any) => {
      const updated = [...extractedRows];
      updated[index] = { ...updated[index], [field]: value };
      setExtractedRows(updated);
  };

  const removeRow = (index: number) => {
      setExtractedRows(extractedRows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
            <Database className="text-accent-500" /> Akıllı PDF Entegrasyonu
          </h1>
          <p className="text-slate-500">PDF manifestoları şablon veya AI ile okuyun.</p>
        </div>
        <button 
            onClick={() => setShowImportModal(true)}
            className="bg-brand-900 text-white px-5 py-3 rounded-xl hover:bg-brand-800 transition flex items-center gap-2 shadow-lg font-bold"
        >
            <Plus size={18} /> Yeni Aktarım
        </button>
      </div>

      {/* Existing Manual Template Logic UI (Simplified for brevity, assuming standard flow) */}
      {!isDesigning && !showImportModal && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* ... (Existing Template UI) ... */}
             <div className="lg:col-span-3 bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300">
                 <p className="text-slate-400 mb-4">Hızlı aktarım için yukarıdaki "Yeni Aktarım" butonunu kullanın.</p>
                 <div className="flex justify-center gap-4">
                     <div className="bg-slate-50 p-4 rounded-xl">
                         <FileText className="mx-auto mb-2 text-blue-500"/>
                         <p className="font-bold text-sm">PDF (AI)</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl">
                         <FileSpreadsheet className="mx-auto mb-2 text-green-500"/>
                         <p className="font-bold text-sm">Excel</p>
                     </div>
                 </div>
             </div>
          </div>
      )}

      {/* --- IMPORT MODAL --- */}
      {showImportModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-7xl h-[95vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                  
                  {/* TOP BAR */}
                  <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-4">
                          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                              {importType === 'pdf' ? <Settings className="text-purple-600"/> : <FileSpreadsheet className="text-green-600"/>} 
                              {importType === 'pdf' ? 'Gemini AI Aktarım' : 'Excel Aktarımı'}
                          </h3>
                          
                          {/* File Selection */}
                          {!importFile && (
                              <div className="flex gap-2">
                                  <label className="bg-brand-900 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-brand-800 transition flex items-center gap-2 shadow-lg shadow-brand-900/20">
                                      <FileText size={14} className="text-accent-400"/> PDF (AI)
                                      <input type="file" accept=".pdf" className="hidden" onClick={() => setImportType('pdf')} onChange={handleFileSelect} />
                                  </label>
                                  <label className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-600/20">
                                      <FileSpreadsheet size={14}/> Excel Seç
                                      <input type="file" accept=".xlsx, .xls" className="hidden" onClick={() => setImportType('excel')} onChange={handleFileSelect} />
                                  </label>
                              </div>
                          )}
                          
                          {importFile && (
                              <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-600 bg-white border px-3 py-1 rounded">{importFile.name}</span>
                                  <button onClick={() => { setImportFile(null); setExtractedRows([]); }} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                              </div>
                          )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                          {extractedRows.length > 0 && (
                              <div className="flex items-center gap-2 mr-4">
                                  <span className="text-xs font-bold text-slate-500 uppercase">Hedef Dosya:</span>
                                  <select className="border border-slate-300 rounded-lg p-2 text-xs font-bold w-48" value={targetShipmentId} onChange={e => setTargetShipmentId(e.target.value)}>
                                      <option value="">Seçiniz...</option>
                                      {shipments.map(s => <option key={s.id} value={s.id}>{s.referenceNo}</option>)}
                                  </select>
                              </div>
                          )}
                          <button onClick={() => setShowImportModal(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg"><X size={20}/></button>
                      </div>
                  </div>

                  {/* DATA GRID */}
                  <div className="flex-1 overflow-auto bg-white relative">
                      {extractedRows.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center p-10 text-slate-400">
                              {isProcessing ? (
                                  <div className="text-center">
                                      <Loader2 size={48} className="animate-spin text-brand-600 mx-auto mb-4"/>
                                      <p className="font-bold text-slate-600">{processingStatus}</p>
                                  </div>
                              ) : (
                                  <>
                                    <div className="p-6 bg-slate-50 rounded-full mb-4"><Upload size={40} className="text-slate-300"/></div>
                                    <p>Dosya yükleyin...</p>
                                  </>
                              )}
                          </div>
                      ) : (
                          <div className="min-w-[1300px]">
                              <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 sticky top-0 z-10">
                                  <div className="col-span-1 p-2 border-r">Sıra</div>
                                  <div className="col-span-1 p-2 border-r">B/L No</div>
                                  <div className="col-span-2 p-2 border-r bg-blue-50 text-blue-800">Konteyner (Tam)</div>
                                  {/* Type column removed */}
                                  <div className="col-span-1 p-2 border-r">Kap</div>
                                  <div className="col-span-2 p-2 border-r">Marka</div>
                                  <div className="col-span-3 p-2 border-r">Eşya Tanımı</div>
                                  <div className="col-span-2 p-2">Alıcı</div>
                              </div>
                              
                              {extractedRows.map((row, idx) => (
                                  <div key={idx} className="grid grid-cols-12 text-xs border-b border-slate-100 hover:bg-blue-50/30 transition items-center">
                                      <div className="col-span-1 p-1 border-r"><input className="w-full bg-transparent outline-none text-center" value={row.sequenceNo} onChange={(e) => updateRow(idx, 'sequenceNo', e.target.value)}/></div>
                                      <div className="col-span-1 p-1 border-r"><input className="w-full bg-transparent outline-none" value={row.transportDocNo} onChange={(e) => updateRow(idx, 'transportDocNo', e.target.value)}/></div>
                                      
                                      {/* Container No Display */}
                                      <div className="col-span-2 p-1 border-r bg-blue-50/20">
                                          <input className="w-full bg-transparent outline-none font-bold" value={row.containerNo} onChange={(e) => updateRow(idx, 'containerNo', e.target.value)}/>
                                      </div>

                                      <div className="col-span-1 p-1 border-r flex gap-1"><input className="w-8 text-right bg-transparent" value={row.packageCount} onChange={(e) => updateRow(idx, 'packageCount', e.target.value)}/><input className="w-full bg-transparent" value={row.packageType} onChange={(e) => updateRow(idx, 'packageType', e.target.value)}/></div>
                                      <div className="col-span-2 p-1 border-r"><textarea rows={2} className="w-full bg-transparent outline-none resize-none" value={row.marks} onChange={(e) => updateRow(idx, 'marks', e.target.value)}/></div>
                                      <div className="col-span-3 p-1 border-r"><textarea rows={2} className="w-full bg-transparent outline-none resize-none font-medium text-slate-700" value={row.description} onChange={(e) => updateRow(idx, 'description', e.target.value)}/></div>
                                      <div className="col-span-2 p-1 flex justify-between items-center">
                                          <input className="w-full bg-transparent outline-none font-bold text-green-700" value={row.receiverName} onChange={(e) => updateRow(idx, 'receiverName', e.target.value)}/>
                                          <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 ml-1"><X size={14}/></button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* FOOTER ACTIONS */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                      <div className="text-xs text-slate-500">
                          {extractedRows.length > 0 && <span className="flex items-center gap-2"><ContainerIcon size={14}/> Toplam {extractedRows.length} kayıt okundu.</span>}
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => { setExtractedRows([]); setImportFile(null); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-300">Temizle</button>
                          <button onClick={saveImportResult} disabled={extractedRows.length === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 shadow-lg flex items-center gap-2 disabled:opacity-50">
                              <Save size={16}/> Kaydet
                          </button>
                      </div>
                  </div>

              </div>
          </div>
      )}

    </div>
  );
};

export default Integration;
