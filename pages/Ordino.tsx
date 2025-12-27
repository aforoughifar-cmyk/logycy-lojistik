
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Shipment, ManifestItem, ManifestGood, ShipmentStatus, Customer, InvoiceType, InvoiceStatus, OrdinoPayment } from '../types';
import { Search, ScrollText, CheckCircle, Printer, Download, X, Ship, User, FileText, Save, ArrowLeft, FileSpreadsheet, Upload, Loader2, Plus, Trash2, Sparkles, BrainCircuit, PenTool, ArrowRightCircle, Container as ContainerIcon, Eye, Edit3, Banknote, CreditCard, History, Filter, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI, Type } from "@google/genai";
import { useStore } from '../store/useStore';

// Extended Interface for the Import Process
interface ExtractedRow {
    sequenceNo: string;      // Sıra No
    transportDocNo: string;  // 14. Taşıma Senedi
    containerNo: string;     // Konteyner No
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

// Interface for Multiple Checks
interface CheckItem {
    id: string;
    checkNo: string;
    date: string;
    amount: number;
    bankName: string;
}

const Ordino: React.FC = () => {
  const navigate = useNavigate();
  const { definitions } = useStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  
  // Local Manifest Filter States
  const [manifestSearch, setManifestSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');

  // Modal States
  const [showModal, setShowModal] = useState(false); // Ordino Edit Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false); // New Payment Modal
  
  const [existingInvoice, setExistingInvoice] = useState<{ id: string; invoiceNo: string } | null>(null);
  const [checkingInvoice, setCheckingInvoice] = useState(false);

  // Mobile Editor Tab State
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  
  // VIEW MODE STATE (Real vs Official)
  const [previewMode, setPreviewMode] = useState<'real' | 'official'>('real');

  // Print Settings
  const [printSettings, setPrintSettings] = useState<any>({});

  // --- IMPORT STATE ---
  const [showImportModal, setShowImportModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [targetShipmentId, setTargetShipmentId] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [importType, setImportType] = useState<'pdf' | 'excel'>('pdf');
  
  // Import Results State
  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>([]);
  
  // Quick Create Master Shipment State
  const [isCreatingMaster, setIsCreatingMaster] = useState(false);
  const [newMasterData, setNewMasterData] = useState({ 
      referenceNo: '', 
      vesselName: '',
      tescilDate: '', // Header Data
      arrivalDate: '' // Header Data
  });

  // State for the Ordino Document (Manual Edit)
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualTargetShipmentId, setManualTargetShipmentId] = useState('');

  const [ordinoData, setOrdinoData] = useState({
      manifestItemId: '', 
      customerId: '',
      customerName: '',
      blNo: '', 
      containerNo: '', 
      transportDocNo: '', 
      tescilNo: '', 
      serialNo: '', 
      refNo: '', 
      origin: 'MERSİN',
      arrivalPort: 'GAZİMAĞUSA', 
      customsOffice: '', 
      vesselName: '',
      voyageNo: '', 
      arrivalDate: '', 
      documentDate: '', 
      goodsList: [] as ManifestGood[],
      // Real Prices (Internal)
      navlun: 0,
      tahliye: 0, 
      exworks: 0,
      // Official Prices (Government)
      officialNavlun: 0,
      officialTahliye: 0,
      officialExworks: 0,
      
      currency: 'USD', 
  });

  // --- PAYMENT MODULE STATES ---
  const [activePaymentItem, setActivePaymentItem] = useState<ManifestItem | null>(null);
  const [paymentForm, setPaymentForm] = useState({
      amount: 0,
      method: 'Nakit' as 'Nakit' | 'Havale' | 'Çek' | 'Kredi Kartı',
      date: new Date().toISOString().slice(0, 10),
      reference: '',
  });
  
  // State for Multiple Checks
  const [checkList, setCheckList] = useState<CheckItem[]>([]);

  const ordinoRef = useRef<HTMLDivElement>(null); 
  const permitRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
    } catch (e) {
        console.error("PDF Worker Init Error", e);
    }
    loadData();
    const saved = localStorage.getItem('invoiceSettings');
    if(saved) setPrintSettings(JSON.parse(saved));
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [shipRes, custRes] = await Promise.all([
        supabaseService.getAllShipments(),
        supabaseService.getCustomers()
    ]);
    if (shipRes.data) setShipments(shipRes.data);
    if (custRes.data) setCustomers(custRes.data);
    
    if (selectedShipment && shipRes.data) {
        const updated = shipRes.data.find(s => s.id === selectedShipment.id);
        if (updated) setSelectedShipment(updated);
    }
    
    setLoading(false);
  };

  // --- PAYMENT HANDLERS ---
  const handleOpenPayment = (item: ManifestItem) => {
      setActivePaymentItem(item);
      const fees = item.savedFees || { navlun: 0, tahliye: 0, exworks: 0 };
      const totalDebt = (fees.navlun || 0) + (fees.tahliye || 0) + (fees.exworks || 0);
      const paid = item.paidAmount || 0;
      const remaining = Math.max(0, totalDebt - paid);

      setPaymentForm({
          amount: remaining,
          method: 'Nakit',
          date: new Date().toISOString().slice(0, 10),
          reference: '',
      });
      // Reset check list
      setCheckList([{ id: Date.now().toString(), checkNo: '', date: new Date().toISOString().slice(0, 10), amount: remaining, bankName: '' }]);
      
      setShowPaymentModal(true);
  };

  const handleCheckChange = (id: string, field: keyof CheckItem, value: any) => {
      setCheckList(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addCheckRow = () => {
      setCheckList(prev => [...prev, { id: Date.now().toString(), checkNo: '', date: paymentForm.date, amount: 0, bankName: '' }]);
  };

  const removeCheckRow = (id: string) => {
      if(checkList.length === 1) return;
      setCheckList(prev => prev.filter(c => c.id !== id));
  };

  // Auto-calculate total for checks
  useEffect(() => {
      if (paymentForm.method === 'Çek') {
          const totalChecks = checkList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
          setPaymentForm(prev => ({ ...prev, amount: totalChecks }));
      }
  }, [checkList, paymentForm.method]);

  const handleSavePayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activePaymentItem || !selectedShipment) return;

      const amount = Number(paymentForm.amount);
      if (amount <= 0) return toast.error("Tutar giriniz.");

      // --- VALIDATION: Check for Overpayment ---
      const fees = activePaymentItem.savedFees || { navlun: 0, tahliye: 0, exworks: 0 };
      const totalDebt = (fees.navlun || 0) + (fees.tahliye || 0) + (fees.exworks || 0);
      const currentPaid = activePaymentItem.paidAmount || 0;
      const remaining = totalDebt - currentPaid;

      // Allow a small epsilon for floating point errors
      if (amount > remaining + 0.01) {
          toast.error(`Hata: Girilen tutar (${amount.toLocaleString()}) kalan borçtan (${remaining.toLocaleString()}) fazla olamaz.`);
          return;
      }
      // ----------------------------------------

      try {
          const currentPayments = activePaymentItem.payments || [];
          const newPaymentsToAdd: OrdinoPayment[] = [];

          // 1. Handle Checks (Multiple)
          if (paymentForm.method === 'Çek') {
              for (const chk of checkList) {
                  if (!chk.checkNo || !chk.date || chk.amount <= 0) {
                      throw new Error("Lütfen tüm çek bilgilerini eksiksiz giriniz.");
                  }

                  // Create Check in DB
                  const checkRes = await supabaseService.addCheck({
                      type: 'in',
                      referenceNo: chk.checkNo,
                      amount: chk.amount,
                      currency: activePaymentItem.savedFees?.currency || 'USD',
                      dueDate: chk.date,
                      partyName: activePaymentItem.customerName,
                      bankName: chk.bankName,
                      description: `Ordino Tahsilatı (${activePaymentItem.ordinoNo})`
                  });
                  if (checkRes.error) throw new Error(checkRes.error);

                  // Add to new payments list
                  newPaymentsToAdd.push({
                      id: Math.random().toString(36).substr(2, 9),
                      date: paymentForm.date, // Transaction date
                      amount: chk.amount,
                      currency: activePaymentItem.savedFees?.currency || 'USD',
                      method: 'Çek',
                      reference: chk.checkNo,
                  });
              }
          } else {
              // 2. Handle Cash / Bank / Credit Card
              newPaymentsToAdd.push({
                  id: Math.random().toString(36).substr(2, 9),
                  date: paymentForm.date,
                  amount: amount,
                  currency: activePaymentItem.savedFees?.currency || 'USD',
                  method: paymentForm.method,
                  reference: paymentForm.reference
              });
          }

          // 3. Add to Finance (Income) - Aggregate
          // This is the REAL payment entry
          await supabaseService.addFinance({
              shipmentId: selectedShipment.id,
              type: 'gelir',
              currency: activePaymentItem.savedFees?.currency || 'USD',
              amount: amount,
              description: `Ordino Tahsilat (${paymentForm.method}): ${activePaymentItem.customerName}`,
              customerName: activePaymentItem.customerName,
              source: 'ordino',
              refNo: activePaymentItem.ordinoNo
          });

          // 4. Update Manifest Item (Mark as paid/partial)
          const updatedPayments = [...currentPayments, ...newPaymentsToAdd];
          const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
          
          let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
          if (totalPaid >= totalDebt - 0.1) status = 'paid';
          else if (totalPaid > 0) status = 'partial';

          const updatedManifest = selectedShipment.manifest?.map(m => {
              if (m.id === activePaymentItem.id) {
                  return { ...m, payments: updatedPayments, paidAmount: totalPaid, paymentStatus: status };
              }
              return m;
          });

          await supabaseService.updateShipmentDetails(selectedShipment.id, { manifest: updatedManifest });
          
          toast.success("Ödeme kaydedildi.");
          setShowPaymentModal(false);
          
          // Refresh Data
          const fresh = await supabaseService.getShipmentById(selectedShipment.id);
          if (fresh.data) setSelectedShipment(fresh.data);

      } catch (err: any) {
          toast.error("Hata: " + err.message);
      }
  };

  const handleDeletePayment = async (paymentId: string) => {
      if (!confirm('Bu ödemeyi silmek istediğinize emin misiniz? \n(Not: Finans kaydı manuel silinmelidir)')) return;
      
      if (!activePaymentItem || !selectedShipment) return;

      try {
          // 1. Remove from local list
          const currentPayments = activePaymentItem.payments || [];
          const updatedPayments = currentPayments.filter(p => p.id !== paymentId);
          
          // 2. Recalculate Totals
          const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
          const fees = activePaymentItem.savedFees || { navlun: 0, tahliye: 0, exworks: 0 };
          const totalDebt = (fees.navlun || 0) + (fees.tahliye || 0) + (fees.exworks || 0);
          
          let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
          if (totalPaid >= totalDebt - 0.1) status = 'paid';
          else if (totalPaid > 0) status = 'partial';

          // 3. Update active item state locally to reflect immediately
          const updatedItem = { ...activePaymentItem, payments: updatedPayments, paidAmount: totalPaid, paymentStatus: status };
          setActivePaymentItem(updatedItem);

          // 4. Update Database
          const updatedManifest = selectedShipment.manifest?.map(m => {
              if (m.id === activePaymentItem.id) {
                  return updatedItem;
              }
              return m;
          });

          await supabaseService.updateShipmentDetails(selectedShipment.id, { manifest: updatedManifest });
          
          toast.success("Ödeme kaydı silindi.");
          
          // Refresh Data Background
          const fresh = await supabaseService.getShipmentById(selectedShipment.id);
          if (fresh.data) setSelectedShipment(fresh.data);

      } catch (err: any) {
          toast.error("Silme hatası: " + err.message);
      }
  };

  // --- FILTER & SEARCH LOGIC ---
  
  // 1. Deep Search for Shipments (Left Sidebar)
  const filteredShipments = useMemo(() => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return shipments;

      return shipments.filter(s => {
          // Check basic shipment fields
          const basicMatch = 
              s.referenceNo.toLowerCase().includes(term) ||
              s.vesselName?.toLowerCase().includes(term);
          
          if (basicMatch) return true;

          // DEEP SEARCH: Check Manifest items (Customer, BL, Container)
          if (s.manifest && s.manifest.length > 0) {
              const manifestMatch = s.manifest.some(m => 
                  m.customerName.toLowerCase().includes(term) ||
                  m.blNo?.toLowerCase().includes(term) ||
                  m.ordinoNo?.toLowerCase().includes(term) ||
                  m.containerNo?.toLowerCase().includes(term)
              );
              if (manifestMatch) return true;
          }

          return false;
      });
  }, [shipments, searchTerm]);

  // 2. Filter Manifest Items within Selected Shipment (Right Panel)
  const filteredManifestItems = useMemo(() => {
      if (!selectedShipment || !selectedShipment.manifest) return [];

      return selectedShipment.manifest.filter(item => {
          // Text Filter
          const search = manifestSearch.toLowerCase().trim();
          const matchesSearch = 
              !search || 
              item.customerName.toLowerCase().includes(search) || 
              item.blNo?.toLowerCase().includes(search) || 
              item.containerNo?.toLowerCase().includes(search);

          // Payment Status Logic Re-calculation for consistency
          const fees = item.savedFees || { navlun: 0, tahliye: 0, exworks: 0 };
          const totalDebt = (fees.navlun || 0) + (fees.tahliye || 0) + (fees.exworks || 0);
          const paid = item.paidAmount || 0;
          
          let calculatedStatus = 'unpaid';
          if (totalDebt === 0) calculatedStatus = 'unpaid'; // Or 'free'
          else if (paid >= totalDebt - 0.1) calculatedStatus = 'paid';
          else if (paid > 0) calculatedStatus = 'partial';

          const matchesPayment = 
              paymentFilter === 'all' || 
              calculatedStatus === paymentFilter;

          return matchesSearch && matchesPayment;
      });
  }, [selectedShipment, manifestSearch, paymentFilter]);


  // --- HELPER: Formatters ---
  const convertToISODate = (dateStr: string) => {
      if (!dateStr) return undefined;
      try {
          const parts = dateStr.trim().split(' ')[0].split('.');
          if (parts.length === 3) {
              const [day, month, year] = parts;
              return `${year}-${month}-${day}`;
          }
      } catch (e) {
          console.error("Date parse error", e);
      }
      return undefined;
  };

  const cleanDesc = (t: string) => t ? t.replace(/BRAND NAME:/gi, '').trim() : '';
  const formatDateTR = (d: string) => d ? d : '-'; 
  
  const toTitleCaseTR = (str: string) => {
      if (!str) return '';
      return str.toLocaleLowerCase('tr-TR').split(' ').map(word => 
          word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1)
      ).join(' ');
  };

  // --- INVOICE LOCK ---
  const refreshInvoiceLock = async (manifestItemId?: string) => {
      const mid = manifestItemId || ordinoData.manifestItemId;
      if (!mid) {
          setExistingInvoice(null);
          return;
      }
      setCheckingInvoice(true);
      const res = await supabaseService.findInvoiceByOrdinoManifestItemId(mid);
      if (res.error) {
          console.warn("Invoice lock check error:", res.error);
          setExistingInvoice(null);
      } else {
          setExistingInvoice(res.data);
      }
      setCheckingInvoice(false);
  };

  useEffect(() => {
      refreshInvoiceLock();
      const onFocus = () => refreshInvoiceLock();
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [ordinoData.manifestItemId]);


  // --- PROCESSING ENGINES ---
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
              rows.push({
                  sequenceNo: val(0),
                  transportDocNo: val(1),
                  containerNo: val(2),
                  packageCount: val(3),
                  packageType: val(4) || 'Koli',
                  marks: val(5),
                  description: val(6),
                  weight: val(7),
                  receiverName: val(8),
                  tescilNo: '',
                  blNo: val(1)
              });
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
          const modelId = 'gemini-2.5-flash';
          const prompt = `
            You are a data extraction expert analyzing a Shipping Manifest (Ordinato/Konşimento) document.
            Please extract all the cargo items into a clean JSON structure.
            CRITICAL RULES:
            1. **receiverName (Alıcı)**: STRICTLY extract only the "Consignee" or "Alıcı". 
               - Do NOT extract the "Shipper" or "Gönderici".
               - If you see "Gönderici:" or "Shipper:", IGNORE that name.
               - Only take the name appearing under "Alıcı" or "Consignee".
            2. **weight**: Extract exactly as it appears (e.g. "120.000"). Do not remove trailing zeros.
            3. **Completeness**: Extract FULL strings for 'marks' and 'containerNo' even if they are long or contain special characters like slashes (/). Do not truncate or abbreviate.
            4. **Global Headers**: Look for "Tescil Tarihi" (Registration Date) and "Varış Tarihi" (Arrival Date). Extract FULL string including time.
            Return ONLY the JSON object.
            DOCUMENT TEXT:
            ${fullText}
          `;
          const response = await ai.models.generateContent({
              model: modelId,
              contents: prompt,
              config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          vesselName: { type: Type.STRING },
                          tescilNo: { type: Type.STRING },
                          tescilDate: { type: Type.STRING },
                          arrivalDate: { type: Type.STRING },
                          items: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      sequenceNo: { type: Type.STRING },
                                      transportDocNo: { type: Type.STRING },
                                      containerNo: { type: Type.STRING },
                                      packageCount: { type: Type.STRING },
                                      packageType: { type: Type.STRING },
                                      marks: { type: Type.STRING },
                                      description: { type: Type.STRING },
                                      weight: { type: Type.STRING },
                                      receiverName: { type: Type.STRING },
                                  }
                              }
                          }
                      }
                  }
              }
          });
          const jsonText = response.text;
          if (!jsonText) throw new Error("AI Empty Response");
          const result = JSON.parse(jsonText);
          const mappedRows: ExtractedRow[] = (result.items || []).map((item: any) => ({
              sequenceNo: item.sequenceNo || '',
              transportDocNo: item.transportDocNo || '',
              containerNo: item.containerNo || '',
              packageCount: item.packageCount || '',
              packageType: item.packageType || 'Kap',
              marks: item.marks || '',
              description: item.description || '',
              weight: item.weight || '', 
              receiverName: item.receiverName || '',
              tescilNo: result.tescilNo || '',
              blNo: item.transportDocNo || '',
              vesselName: result.vesselName || ''
          }));
          setExtractedRows(mappedRows);
          setNewMasterData(prev => ({ 
              ...prev, 
              vesselName: result.vesselName || '',
              tescilDate: result.tescilDate || '',
              arrivalDate: result.arrivalDate || ''
          }));
          if (mappedRows.length === 0) {
              toast.error("AI veri bulamadı.");
          } else {
              toast.success(`${mappedRows.length} satır başarıyla analiz edildi (Gemini AI).`);
          }
      } catch (error: any) {
          console.error(error);
          toast.error("AI İşleme Hatası: " + error.message);
      } finally {
          setIsProcessing(false);
          setProcessingStatus('');
      }
  };

  const handleCreateMasterShipment = async () => {
      if (!newMasterData.referenceNo) return toast.error("Referans No zorunludur.");
      try {
          const res = await supabaseService.createShipment({
              referenceNo: newMasterData.referenceNo,
              vesselName: newMasterData.vesselName,
              description: `İthalat - ${newMasterData.vesselName || 'Bilinmiyor'}`,
              status: ShipmentStatus.PREPARING,
              transportMode: 'deniz',
              origin: 'MERSİN',
              destination: 'GAZİMAĞUSA',
              loadType: 'FCL',
              senderName: '-',
              receiverName: '-',
              eta: convertToISODate(newMasterData.arrivalDate)
          });
          if (res.error) {
              toast.error("Kayıt Başarısız: " + res.error);
              return;
          }
          if (res.data) {
              setShipments([res.data, ...shipments]); 
              setTargetShipmentId(res.data.id); 
              setIsCreatingMaster(false); 
              toast.success("Master Dosya oluşturuldu.");
          }
      } catch (err: any) {
          console.error(err);
          toast.error("Hata: " + err.message);
      }
  };

  const saveImportResult = async () => {
      if (!targetShipmentId) return toast.error("Hedef dosya seçilmedi.");
      if (extractedRows.length === 0) return toast.error("Veri yok.");
      setLoading(true);
      const newManifestItems: ManifestItem[] = [];
      let newCustomersCount = 0;
      const { data: latestCustomers } = await supabaseService.getCustomers();
      const currentCustomers = latestCustomers || customers;
      for (const row of extractedRows) {
          let customerId = '';
          const normalizedName = row.receiverName?.trim() || 'BİLİNMEYEN ALICI';
          let existingCust = currentCustomers.find(c => c.name.trim().toLowerCase() === normalizedName.toLowerCase());
          if (existingCust) {
              customerId = existingCust.id;
          } else {
              if (normalizedName.length > 2 && normalizedName !== 'BİLİNMEYEN ALICI') {
                  const newCust = await supabaseService.createCustomer({
                      name: normalizedName,
                      type: 'musteri',
                      phone: '', email: '', address: 'Otomatik Oluşturuldu'
                  });
                  if (newCust.data) {
                      customerId = newCust.data.id;
                      newCustomersCount++;
                      currentCustomers.push(newCust.data);
                  }
              }
          }
          const existingItemIndex = newManifestItems.findIndex(i => 
              i.transportDocNo === row.transportDocNo && i.containerNo === row.containerNo
          );
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
                  tescilDate: newMasterData.tescilDate,
                  arrivalDate: newMasterData.arrivalDate,
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
                  isSaved: false,
                  paymentStatus: 'unpaid',
                  paidAmount: 0
              });
          }
      }
      const shipment = shipments.find(s => s.id === targetShipmentId);
      if (shipment) {
          const currentManifest = shipment.manifest || [];
          const updatedManifest = [...currentManifest, ...newManifestItems];
          const updates: any = { manifest: updatedManifest };
          const validEta = convertToISODate(newMasterData.arrivalDate);
          if(validEta) updates.eta = validEta;
          await supabaseService.updateShipmentDetails(shipment.id, updates);
          const uniqueContainers = new Set(newManifestItems.map(m => m.containerNo).filter(Boolean));
          for (const contNo of uniqueContainers) {
              await supabaseService.upsertContainer({
                  shipmentId: shipment.id,
                  containerNo: contNo,
                  type: 'Unknown'
              });
          }
          const { data: freshShipment } = await supabaseService.getShipmentById(shipment.id);
          if (freshShipment) {
              setSelectedShipment(freshShipment);
          }
          toast.success(`${newManifestItems.length} kayıt aktarıldı.`);
          if(newCustomersCount > 0) toast.success(`${newCustomersCount} yeni müşteri eklendi.`);
          setShowImportModal(false);
          setImportFile(null);
          setExtractedRows([]);
          loadData(); 
      }
      setLoading(false);
  };

  const updateRow = (index: number, field: keyof ExtractedRow, value: any) => {
      const updated = [...extractedRows];
      updated[index] = { ...updated[index], [field]: value };
      setExtractedRows(updated);
  };

  const removeRow = (index: number) => {
      setExtractedRows(extractedRows.filter((_, i) => i !== index));
  };

  // --- MANUEL EDIT LOGIC ---
  const handleOpenOrdino = (item: ManifestItem) => {
      if(!selectedShipment) return;
      setIsManualMode(false); 
      setMobileTab('editor'); // Reset to editor tab on open
      setPreviewMode('real'); // Default to real view
      
      const defaultOffice = definitions.customsOffices?.[0] || 'GAZİMAĞUSA GÜMRÜK MÜDÜRLÜĞÜ';
      let defaultPort = selectedShipment.destination || 'GAZİMAĞUSA';
      
      const rndSerial = item.ordinoNo ? item.ordinoNo.split('/')[0] : `00${Math.floor(1000 + Math.random() * 9000)}`;
      const rndRef = item.ordinoNo ? item.ordinoNo.split('/')[1] : `${new Date().getFullYear()}${Math.floor(100000 + Math.random() * 900000)}`;
      let arrivalDateStr = item.arrivalDate || selectedShipment.eta || new Date().toISOString().slice(0, 10);
      let tescilDateStr = item.tescilDate || new Date().toISOString().slice(0, 10);
      setOrdinoData({
          manifestItemId: item.id,
          customerId: item.customerId,
          customerName: item.customerName || '', 
          blNo: item.blNo || '', 
          containerNo: item.containerNo || '',
          transportDocNo: item.transportDocNo || '', 
          tescilNo: item.tescilNo || '', 
          serialNo: rndSerial, 
          refNo: rndRef,
          origin: selectedShipment.origin || 'MERSİN',
          arrivalPort: item.arrivalPort || defaultPort,
          customsOffice: defaultOffice,
          vesselName: item.vesselName || selectedShipment.vesselName || '', 
          voyageNo: item.voyageNo || '',
          arrivalDate: arrivalDateStr,
          documentDate: tescilDateStr,
          goodsList: item.goods || [],
          // Real
          navlun: item.savedFees?.navlun || 0,
          tahliye: item.savedFees?.tahliye || 0,
          exworks: item.savedFees?.exworks || 0,
          // Official (Load if exists)
          officialNavlun: item.officialFees?.navlun || 0,
          officialTahliye: item.officialFees?.tahliye || 0,
          officialExworks: item.officialFees?.exworks || 0,
          
          currency: item.savedFees?.currency || 'USD'
      });
      setShowModal(true);
  };

  const handleManualCreateOpen = () => {
      setIsManualMode(true); 
      setMobileTab('editor');
      setPreviewMode('real');
      setManualTargetShipmentId('');
      const defaultOffice = definitions.customsOffices?.[0] || 'GAZİMAĞUSA GÜMRÜK MÜDÜRLÜĞÜ';
      const rndSerial = `00${Math.floor(1000 + Math.random() * 9000)}`;
      const rndRef = `${new Date().getFullYear()}${Math.floor(100000 + Math.random() * 900000)}`;
      setOrdinoData({
          manifestItemId: '', 
          customerId: '',
          customerName: '', 
          blNo: '', 
          containerNo: '', 
          transportDocNo: '', 
          tescilNo: '', 
          serialNo: rndSerial, 
          refNo: rndRef, 
          origin: 'MERSİN',
          arrivalPort: 'GAZİMAĞUSA', 
          customsOffice: defaultOffice,
          vesselName: '', 
          voyageNo: '',
          arrivalDate: new Date().toISOString().slice(0, 10), 
          documentDate: new Date().toISOString().slice(0, 10), 
          goodsList: [
              { description: '', quantity: 1, packageType: 'Koli', marks: '', weight: '', volume: '' }
          ],
          navlun: 0,
          tahliye: 0, 
          exworks: 0,
          officialNavlun: 0,
          officialTahliye: 0,
          officialExworks: 0,
          currency: 'USD', 
      });
      setShowModal(true);
  };

  const handleShipmentSelection = (shipmentId: string) => {
      setManualTargetShipmentId(shipmentId);
      const ship = shipments.find(s => s.id === shipmentId);
      if (ship) {
          setOrdinoData(prev => ({
              ...prev,
              origin: ship.origin,
              arrivalPort: ship.destination,
              vesselName: ship.vesselName || '',
              arrivalDate: ship.eta || prev.arrivalDate
          }));
      }
  };

  const updateGoodItem = (index: number, field: keyof ManifestGood, value: any) => {
      const updatedGoods = [...ordinoData.goodsList];
      updatedGoods[index] = { ...updatedGoods[index], [field]: value };
      setOrdinoData({ ...ordinoData, goodsList: updatedGoods });
  };

  const handleConvertToInvoice = async () => {
      if (!ordinoData.manifestItemId) {
          toast.error("Bu ordino için Manifest ID bulunamadı.");
          return;
      }
      const lockRes = await supabaseService.findInvoiceByOrdinoManifestItemId(ordinoData.manifestItemId);
      if (lockRes.data) {
          setExistingInvoice(lockRes.data);
          toast.error(`Bu ordino zaten faturalanmış.`);
          return;
      }
      const totalAmount = 0; 
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const now = new Date();
      const ymd = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
      const hms = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
      const rnd = Math.floor(100 + Math.random() * 900);
      const kayitNo = `LL-${ymd}-${hms}-${rnd}`;
      const invoiceNoAuto = `FTR-${ymd}-${hms}-${rnd}`;
      const sanitizePartyName = (name: string) => {
          if (!name) return '';
          let n = name.trim();
          n = n.replace(/^\([^)]+\)\s*/, '');
          n = n.replace(/^[A-Z0-9]{3,}[\-\/]\s*/, '');
          return n.trim();
      };
      const invoicePayload = {
          invoiceNo: invoiceNoAuto,
          type: InvoiceType.SALE,
          partyName: sanitizePartyName(ordinoData.customerName),
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: new Date().toISOString().slice(0, 10),
          totalAmount: totalAmount,
          currency: ordinoData.currency,
          status: InvoiceStatus.DRAFT,
          shipmentDetails: {
              ordinoManifestItemId: ordinoData.manifestItemId,
              ordinoRefNo: ordinoData.refNo,
              ordinoSerialNo: ordinoData.serialNo,
              vesselName: ordinoData.vesselName,
              voyageNo: ordinoData.voyageNo,
              blNo: ordinoData.blNo,
              containerNo: ordinoData.containerNo,
              arrivalDate: ordinoData.arrivalDate,
              arrivalPort: ordinoData.origin,
              registrationNo: kayitNo,
              manNo: ordinoData.tescilNo,
              goodsDescription: ordinoData.goodsList
                .map((g: any) => `${g.description} (${g.quantity} ${g.packageType})`)
                .join(', ')
          }
      };
      try {
          const res = await supabaseService.createInvoice(invoicePayload);
          if (res.error) throw new Error(res.error);
          toast.success("Fatura oluşturuldu!");
          setExistingInvoice({ id: (res.data as any)?.id || '', invoiceNo: invoiceNoAuto });
          refreshInvoiceLock(ordinoData.manifestItemId);
          setShowModal(false);
          if (res.data && (res.data as any).id) {
              navigate(`/invoices/${(res.data as any).id}`);
          } else {
              navigate('/invoices');
          }
      } catch (error: any) {
          toast.error("Fatura hatası: " + error.message);
      }
  };

  const saveOrdino = async () => {
      const targetShipId = isManualMode ? manualTargetShipmentId : (selectedShipment?.id);
      if(!targetShipId) {
          toast.error("Lütfen bir dosya seçiniz.");
          return;
      }
      const { data: freshShipment } = await supabaseService.getShipmentById(targetShipId);
      if (!freshShipment) return;
      let updatedManifest = freshShipment.manifest || [];
      
      // Data object with new fields
      const manifestItemData = {
          customerId: ordinoData.customerId || 'manual-' + Date.now(),
          customerName: ordinoData.customerName,
          containerNo: ordinoData.containerNo,
          blNo: ordinoData.blNo,
          tescilNo: ordinoData.tescilNo,
          tescilDate: ordinoData.documentDate,
          arrivalDate: ordinoData.arrivalDate,
          arrivalPort: ordinoData.arrivalPort,
          vesselName: ordinoData.vesselName,
          voyageNo: ordinoData.voyageNo,
          transportDocNo: ordinoData.transportDocNo,
          goods: ordinoData.goodsList,
          ordinoNo: `${ordinoData.serialNo}/${ordinoData.refNo}`,
          isSaved: true,
          savedFees: { 
              navlun: ordinoData.navlun, 
              tahliye: ordinoData.tahliye, 
              exworks: ordinoData.exworks, 
              currency: ordinoData.currency 
          },
          officialFees: {
              navlun: ordinoData.officialNavlun, 
              tahliye: ordinoData.officialTahliye, 
              exworks: ordinoData.officialExworks, 
              currency: ordinoData.currency 
          }
      };
      
      if (isManualMode || !ordinoData.manifestItemId) {
          const newItem: ManifestItem = {
              id: Math.random().toString(36).substr(2, 9),
              ...manifestItemData
          };
          updatedManifest.push(newItem);
      } else {
          updatedManifest = updatedManifest.map((item: any) => {
              if (item.id === ordinoData.manifestItemId) {
                  return {
                      ...item,
                      ...manifestItemData
                  };
              }
              return item;
          });
      }
      await supabaseService.updateShipmentDetails(freshShipment.id, { manifest: updatedManifest });
      toast.success(isManualMode ? 'Yeni Ordino Kaydedildi.' : 'Ordino Güncellendi.');
      if (selectedShipment?.id === freshShipment.id) {
          const refreshed = { ...freshShipment, manifest: updatedManifest };
          setSelectedShipment(refreshed);
          setShipments(prev => prev.map(s => s.id === refreshed.id ? refreshed : s));
      } else {
          loadData();
      }
      if(isManualMode) setShowModal(false);
  };

  const handleDownloadPDF = async () => {
      if (!ordinoRef.current) return;
      try {
          toast.loading('PDF Oluşturuluyor...');
          const canvas = await html2canvas(ordinoRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: 794, windowWidth: 1200 });
          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          const pdf = new jsPDF('p', 'mm', 'a4', true);
          const pageWidth = 210;
          const pageHeight = 297;
          const addPageToPdf = (label: string, isLast: boolean) => {
              pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
              const footerX = pageWidth - 20; 
              const footerY = pageHeight - 15;
              pdf.setFontSize(11);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(0, 0, 0);
              pdf.text(label, footerX, footerY, { align: 'right' });
              pdf.setLineWidth(0.5);
              pdf.line(footerX - 60, footerY + 2, footerX, footerY + 2);
              pdf.setFontSize(14); 
              pdf.setFont("helvetica", "bold"); 
              pdf.text("LOGYCY SHIPPING LTD", footerX, footerY + 8, { align: 'right' });
              if (!isLast) pdf.addPage();
          };
          addPageToPdf('ORGINAL', false);
          addPageToPdf('COPY', false);
          addPageToPdf('COPY', false);
          addPageToPdf('COPY', true);
          const namePrefix = previewMode === 'official' ? 'RESMI_' : '';
          pdf.save(`${namePrefix}Ordino_${ordinoData.serialNo}.pdf`);
          toast.dismiss();
          toast.success('İndirildi');
      } catch (err) {
          console.error(err);
          toast.dismiss();
          toast.error('Hata oluştu');
      }
  };

  const handlePrintPermit = async () => {
      if (!permitRef.current) return;
      try {
          toast.loading('Konteyner Çıkış İzni Oluşturuluyor...');
          const canvas = await html2canvas(permitRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: 794, windowWidth: 1200 });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const imgProps = pdf.getImageProperties(imgData);
          const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfImgHeight);
          pdf.save(`Cikis_Izni_${ordinoData.containerNo}.pdf`);
          toast.dismiss();
          toast.success('İndirildi');
      } catch (err) {
          console.error(err);
          toast.dismiss();
          toast.error('Hata oluştu');
      }
  };

  // Determine which values to show in preview
  const displayNavlun = previewMode === 'real' ? ordinoData.navlun : ordinoData.officialNavlun;
  const displayTahliye = previewMode === 'real' ? ordinoData.tahliye : ordinoData.officialTahliye;
  const displayExworks = previewMode === 'real' ? ordinoData.exworks : ordinoData.officialExworks;
  const displayTotal = displayNavlun + displayTahliye + displayExworks;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className={clsx("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4", (showModal || showImportModal) && "hidden")}>
        <div>
          <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
             <ScrollText className="text-accent-500"/> Ordino Yönetimi
          </h1>
          <p className="text-slate-500">Müşteri teslimat evrakları ve ordinoları.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleManualCreateOpen}
                className="bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 font-bold shadow-sm"
            >
                <PenTool size={18} /> Manuel Ekle
            </button>
            <button 
                onClick={() => setShowImportModal(true)}
                className="bg-brand-900 text-white px-5 py-3 rounded-xl hover:bg-brand-800 transition flex items-center gap-2 shadow-lg shadow-brand-500/30 font-bold"
            >
                <Sparkles size={18} className="text-accent-400" /> Otomatik Aktarım
            </button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className={clsx("grid grid-cols-1 lg:grid-cols-3 gap-6", (showModal || showImportModal) && "hidden")}>
          {/* LEFT SIDEBAR (List) */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                      <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Ara (Gemi, Müşteri, Ref)..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white" 
                      />
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {loading ? <p className="text-center py-10 text-slate-400">Yükleniyor...</p> : 
                   filteredShipments.map(ship => (
                      <div key={ship.id} onClick={() => setSelectedShipment(ship)} className={clsx("p-3 rounded-xl border cursor-pointer transition group hover:shadow-md", selectedShipment?.id === ship.id ? "bg-brand-50 border-brand-200 ring-1 ring-brand-200" : "bg-white border-slate-100 hover:border-slate-300")}>
                          <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-brand-900 font-mono text-sm">{ship.referenceNo}</span>
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{new Date(ship.created_at!).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-slate-600 truncate flex items-center gap-1"><Ship size={10}/> {ship.vesselName || 'Gemi Yok'}</p>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><User size={10}/> {ship.manifest?.length || 0} Müşteri</p>
                      </div>
                   ))
                  }
              </div>
          </div>

          {/* RIGHT SIDE (Details) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-150px)]">
              {selectedShipment ? (
                  <>
                    <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="text-blue-500"/> {selectedShipment.referenceNo} <span className="text-sm font-normal text-slate-500">manifestosu</span>
                        </h2>
                        
                        {/* MANIFEST FILTER TOOLBAR */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="Bu dosyada ara (Müşteri, Konteyner)..." 
                                    value={manifestSearch} 
                                    onChange={(e) => setManifestSearch(e.target.value)} 
                                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 text-xs bg-slate-50" 
                                />
                            </div>
                            <div className="relative">
                                <Filter className="absolute left-2 top-2.5 text-slate-400" size={14} />
                                <select 
                                    className="pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-accent-500 appearance-none"
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value as any)}
                                >
                                    <option value="all">Tüm Durumlar</option>
                                    <option value="paid">Ödendi</option>
                                    <option value="partial">Kısmi Ödeme</option>
                                    <option value="unpaid">Ödenmedi</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {filteredManifestItems.map((item) => {
                            // Calculate Totals and Status for UI
                            const fees = item.savedFees || { navlun: 0, tahliye: 0, exworks: 0 };
                            const totalDebt = (fees.navlun || 0) + (fees.tahliye || 0) + (fees.exworks || 0);
                            const paid = item.paidAmount || 0;
                            const percent = totalDebt > 0 ? Math.min((paid / totalDebt) * 100, 100) : 0;
                            const currency = item.savedFees?.currency || 'USD';

                            return (
                            <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition bg-slate-50/30">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                            {item.customerName}
                                            {item.isSaved && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={10}/> Hazır</span>}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 font-mono">B/L: {item.blNo || '-'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => navigate(`/customers/${item.customerId}`)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 transition" title="Müşteri Profili">
                                            <User size={16} />
                                        </button>
                                        <button onClick={() => handleOpenOrdino(item)} className={clsx("px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm", item.isSaved ? "bg-white border border-green-200 text-green-700 hover:bg-green-50" : "bg-brand-900 text-white hover:bg-brand-800")}>
                                            <ScrollText size={14}/> {item.isSaved ? 'Görüntüle / Düzenle' : 'Ordino Oluştur'}
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                                    {item.goods.slice(0,3).map((g, i) => (
                                        <div key={i} className="truncate">• {g.quantity} {g.packageType} - {cleanDesc(g.description)}</div>
                                    ))}
                                </div>
                                
                                {/* Payment Status Bar */}
                                {item.isSaved && totalDebt > 0 && (
                                    <div className="mt-4 bg-white p-3 rounded-lg border border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-slate-500">TAHSİLAT DURUMU</span>
                                            <span className="text-xs font-bold text-slate-700">
                                                {paid.toLocaleString()} / {totalDebt.toLocaleString()} {currency}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                                            <div 
                                                className={clsx("h-full rounded-full transition-all duration-500", percent >= 100 ? "bg-green-500" : percent > 0 ? "bg-orange-500" : "bg-slate-300")} 
                                                style={{width: `${percent}%`}}
                                            ></div>
                                        </div>
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={() => handleOpenPayment(item)}
                                                className={clsx("text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition", percent >= 100 ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-blue-600 text-white hover:bg-blue-700")}
                                            >
                                                {percent >= 100 ? <CheckCircle size={12}/> : <Banknote size={12}/>} 
                                                {percent >= 100 ? 'Tahsil Edildi' : 'Ödeme Al'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )})}
                        
                        {filteredManifestItems.length === 0 && (
                            <div className="text-center py-10 text-slate-400">
                                Kayıt bulunamadı.
                            </div>
                        )}
                    </div>
                  </>
              ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <ScrollText size={48} className="mb-4 opacity-20"/>
                      <p>İşlem yapılacak dosyayı seçiniz.</p>
                  </div>
              )}
          </div>
      </div>

      {/* --- PAYMENT MODAL --- */}
      {showPaymentModal && activePaymentItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-green-600 px-6 py-4 flex justify-between items-center shrink-0">
                      <h3 className="text-white font-bold text-lg flex items-center gap-2">
                          <Banknote size={20}/> Tahsilat Girişi
                      </h3>
                      <button onClick={() => setShowPaymentModal(false)} className="text-white/80 hover:text-white transition"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">TOPLAM BORÇ</p>
                          <p className="text-2xl font-black text-slate-800">
                              {((activePaymentItem.savedFees?.navlun || 0) + (activePaymentItem.savedFees?.tahliye || 0) + (activePaymentItem.savedFees?.exworks || 0)).toLocaleString()} 
                              <span className="text-sm text-slate-500 ml-1">{activePaymentItem.savedFees?.currency}</span>
                          </p>
                          <div className="mt-2 text-xs flex justify-center gap-4">
                              <span className="text-green-600 font-bold">Ödenen: {activePaymentItem.paidAmount?.toLocaleString() || 0}</span>
                              <span className="text-red-600 font-bold">Kalan: {Math.max(0, ((activePaymentItem.savedFees?.navlun || 0) + (activePaymentItem.savedFees?.tahliye || 0) + (activePaymentItem.savedFees?.exworks || 0)) - (activePaymentItem.paidAmount || 0)).toLocaleString()}</span>
                          </div>
                      </div>

                      <form onSubmit={handleSavePayment} className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Ödeme Yöntemi</label>
                              <div className="flex flex-wrap gap-2">
                                  {['Nakit', 'Havale', 'Çek', 'Kredi Kartı'].map(m => (
                                      <button 
                                        key={m}
                                        type="button"
                                        onClick={() => setPaymentForm({...paymentForm, method: m as any})}
                                        className={clsx(
                                            "flex-1 py-2 rounded-lg text-xs font-bold border transition whitespace-nowrap",
                                            paymentForm.method === m ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                        )}
                                      >
                                          {m}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Tutar</label>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const fees = activePaymentItem.savedFees || { navlun: 0, tahliye: 0, exworks: 0 };
                                        const total = (fees.navlun || 0) + (fees.tahliye || 0) + (fees.exworks || 0);
                                        const paid = activePaymentItem.paidAmount || 0;
                                        setPaymentForm({...paymentForm, amount: Math.max(0, total - paid)});
                                    }}
                                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded hover:bg-slate-200 font-bold"
                                >
                                    Tamamını Öde (Max)
                                </button>
                              </div>
                              <input 
                                type="number" 
                                className={clsx("w-full border border-slate-200 rounded-xl p-3 text-lg font-bold outline-none focus:border-green-500", paymentForm.method === 'Çek' && "bg-slate-100 text-slate-500 cursor-not-allowed")}
                                value={paymentForm.amount}
                                onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})}
                                disabled={paymentForm.method === 'Çek'} // Auto-sum for checks
                              />
                          </div>

                          {paymentForm.method === 'Çek' ? (
                              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-4 animate-in fade-in">
                                  <div className="flex justify-between items-center">
                                      <h4 className="text-sm font-bold text-orange-800">Çek Listesi</h4>
                                      <button 
                                        type="button" 
                                        onClick={addCheckRow}
                                        className="text-xs bg-white text-orange-700 border border-orange-200 px-3 py-1 rounded-lg font-bold hover:bg-orange-100 flex items-center gap-1"
                                      >
                                          <Plus size={12} /> Ekle
                                      </button>
                                  </div>
                                  
                                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                      {checkList.map((chk, idx) => (
                                          <div key={chk.id} className="bg-white p-3 rounded-lg border border-orange-200 shadow-sm relative group">
                                              <div className="absolute top-2 right-2">
                                                  <button 
                                                    type="button" 
                                                    onClick={() => removeCheckRow(chk.id)}
                                                    className="text-slate-300 hover:text-red-500 p-1"
                                                    disabled={checkList.length === 1}
                                                  >
                                                      <Trash2 size={14} />
                                                  </button>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2 mb-2">
                                                  <div>
                                                      <label className="text-[9px] font-bold text-slate-400 uppercase">No</label>
                                                      <input 
                                                          className="w-full border-b border-orange-100 text-xs py-1 outline-none font-medium"
                                                          placeholder="123456"
                                                          value={chk.checkNo}
                                                          onChange={e => handleCheckChange(chk.id, 'checkNo', e.target.value)}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className="text-[9px] font-bold text-slate-400 uppercase">Vade</label>
                                                      <input 
                                                          type="date"
                                                          className="w-full border-b border-orange-100 text-xs py-1 outline-none font-medium"
                                                          value={chk.date}
                                                          onChange={e => handleCheckChange(chk.id, 'date', e.target.value)}
                                                      />
                                                  </div>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2">
                                                  <div>
                                                      <label className="text-[9px] font-bold text-slate-400 uppercase">Tutar</label>
                                                      <input 
                                                          type="number"
                                                          className="w-full border-b border-orange-100 text-xs py-1 outline-none font-bold text-slate-800"
                                                          value={chk.amount}
                                                          onChange={e => handleCheckChange(chk.id, 'amount', Number(e.target.value))}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className="text-[9px] font-bold text-slate-400 uppercase">Banka</label>
                                                      <input 
                                                          className="w-full border-b border-orange-100 text-xs py-1 outline-none font-medium"
                                                          placeholder="Garanti..."
                                                          value={chk.bankName}
                                                          onChange={e => handleCheckChange(chk.id, 'bankName', e.target.value)}
                                                      />
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ) : (
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                                      {paymentForm.method === 'Kredi Kartı' ? 'Provizyon No / Referans' : 'Referans / Not'}
                                  </label>
                                  <input 
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none"
                                    placeholder={paymentForm.method === 'Kredi Kartı' ? "123456..." : "Dekont No vb."}
                                    value={paymentForm.reference}
                                    onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                                  />
                              </div>
                          )}

                          <button type="submit" className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20 mt-4">
                              Tahsilatı Kaydet
                          </button>
                      </form>
                      
                      {/* Payment History List with Delete Option */}
                      {activePaymentItem.payments && activePaymentItem.payments.length > 0 && (
                          <div className="mt-6 border-t border-slate-100 pt-4">
                              <p className="text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-1"><History size={12}/> Geçmiş Ödemeler</p>
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                  {activePaymentItem.payments.map((p, i) => (
                                      <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100 group">
                                          <div>
                                              <span className="font-bold text-slate-700 block">{p.amount.toLocaleString()} {p.currency}</span>
                                              <span className="text-[10px] text-slate-400">{p.method} • {new Date(p.date).toLocaleDateString()}</span>
                                          </div>
                                          <div className="flex gap-2 items-center">
                                              <button 
                                                onClick={() => handleDeletePayment(p.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition"
                                                title="Ödemeyi Sil"
                                              >
                                                  <Trash2 size={14}/>
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- MANUAL EDIT MODAL & PREVIEW --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col md:flex-row print:absolute print:inset-0 print:bg-white print:block">
           
           {/* MOBILE TAB CONTROLS (Only visible on mobile) */}
           <div className="md:hidden bg-slate-800 p-2 flex gap-2 shrink-0">
               <button 
                 onClick={() => setMobileTab('editor')}
                 className={clsx("flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2", mobileTab === 'editor' ? "bg-white text-slate-900" : "bg-slate-700 text-slate-300")}
               >
                   <Edit3 size={14} /> Düzenle
               </button>
               <button 
                 onClick={() => setMobileTab('preview')}
                 className={clsx("flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2", mobileTab === 'preview' ? "bg-white text-slate-900" : "bg-slate-700 text-slate-300")}
               >
                   <Eye size={14} /> Önizle
               </button>
               <button onClick={() => setShowModal(false)} className="bg-red-600 text-white p-2 rounded-lg"><X size={16}/></button>
           </div>

           {/* LEFT SIDE: PREVIEW */}
           <div className={clsx("flex-1 overflow-auto bg-gray-200 flex flex-col items-center py-10 print:p-0 print:overflow-visible print:bg-white print:block", mobileTab === 'editor' && "hidden md:flex")}>
             
             {/* PREVIEW MODE TOGGLE */}
             <div className="bg-white p-1.5 rounded-xl shadow-lg mb-6 flex gap-2 w-[300px] shrink-0 print:hidden">
                 <button 
                    onClick={() => setPreviewMode('real')}
                    className={clsx("flex-1 py-2 text-xs font-bold rounded-lg transition text-center", previewMode === 'real' ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:bg-slate-50")}
                 >
                     Gerçek (Cari)
                 </button>
                 <button 
                    onClick={() => setPreviewMode('official')}
                    className={clsx("flex-1 py-2 text-xs font-bold rounded-lg transition text-center", previewMode === 'official' ? "bg-purple-600 text-white shadow" : "text-slate-500 hover:bg-slate-50")}
                 >
                     Resmi (Gümrük)
                 </button>
             </div>

             <div ref={ordinoRef} className="bg-white text-black font-sans box-border relative print:p-0 print:m-0 text-[11px] leading-tight shadow-xl" style={{ width: '210mm', minHeight: '297mm', paddingTop: '50mm', paddingRight: '40px', paddingBottom: '40px', paddingLeft: '40px', boxSizing: 'border-box' }}>
                
                {/* ... ORDINO TEMPLATE ... */}
                <div className="flex justify-between items-start mb-4 font-bold">
                    <div className="space-y-1 w-1/2">
                        <div className="flex gap-2"><span className="w-24">No:</span> <span>{ordinoData.serialNo}</span></div>
                        <div className="flex gap-2"><span className="w-24">Tescil No:</span> <span>{ordinoData.tescilNo}</span></div>
                        <div className="flex gap-2"><span className="w-24">Tescil Tarihi:</span> <span>{formatDateTR(ordinoData.documentDate)}</span></div>
                        <div className="flex gap-2"><span className="w-24">Varış Tarihi:</span> <span>{formatDateTR(ordinoData.arrivalDate)}</span></div>
                    </div>
                    <div className="space-y-1 w-1/2 pl-6">
                        <div className="flex gap-2"><span className="w-32">Yükleme Yeri :</span> <span>{ordinoData.origin || 'MERSİN'}</span></div>
                        <div className="flex gap-2"><span className="w-32">Boşaltma Yeri:</span> <span>{ordinoData.arrivalPort}</span></div>
                        <div className="flex gap-2"><span className="w-32">Gemi adı ve Sefer No:</span> <span>{ordinoData.vesselName} {ordinoData.voyageNo ? `/ ${ordinoData.voyageNo}` : ''}</span></div>
                    </div>
                </div>
                <div className="text-center mb-4"><h1 className="text-[14px] font-bold">B/L NO: {ordinoData.blNo}</h1></div>
                <div className="mb-4 font-bold">{ordinoData.customsOffice}</div>
                <div className="mb-6 font-medium"><span>Aşağıda belirtilen yükü </span><span className="font-bold uppercase">{ordinoData.customerName}</span><span> devrediniz.</span></div>
                <table className="w-full border-collapse border border-black text-[11px] mb-8">
                    <thead>
                        <tr>
                            <th rowSpan={2} className="border border-black p-2 align-top w-24">Taşıma<br/>Senedi</th>
                            <th rowSpan={2} className="border border-black p-2 align-top w-24">Konteyner<br/>No</th>
                            <th colSpan={3} className="border border-black p-2">Kapların Tanımı</th>
                            <th colSpan={3} className="border border-black p-2">Eşyanın Tanımı</th>
                        </tr>
                        <tr>
                            <th className="border border-black p-2 w-12">Adedi</th>
                            <th className="border border-black p-2 w-16">Cinsi</th>
                            <th className="border border-black p-2">Marka ve Nosu</th>
                            <th className="border border-black p-2">Cinsi</th>
                            <th className="border border-black p-2 w-16">Brüt<br/>A.(kg)</th>
                            <th className="border border-black p-2 w-16">Hacim<br/>(m3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ordinoData.goodsList.map((good, i) => (
                            <tr key={i} className="h-12">
                                <td className="border border-black p-2 align-top">{ordinoData.transportDocNo}</td>
                                <td className="border border-black p-2 align-top">{ordinoData.containerNo}</td>
                                <td className="border border-black p-2 align-top text-center">{good.quantity}</td>
                                <td className="border border-black p-2 align-top text-center">{good.packageType}</td>
                                <td className="border border-black p-2 align-top">{good.marks}</td>
                                <td className="border border-black p-2 align-top uppercase">{cleanDesc(good.description)}</td>
                                <td className="border border-black p-2 align-top text-right">{good.weight}</td>
                                <td className="border border-black p-2 align-top text-right">{good.volume}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="absolute bottom-10 left-10 font-bold text-sm space-y-2">
                    <div className="flex gap-2"><span className="w-32">NAVLUN:</span> <span>{displayNavlun > 0 ? displayNavlun + ' ' + ordinoData.currency : ''}</span></div>
                    <div className="flex gap-2"><span className="w-32">TAHLİYE ÜCRETİ:</span> <span>{displayTahliye > 0 ? displayTahliye + ' ' + ordinoData.currency : ''}</span></div>
                    <div className="flex gap-2"><span className="w-32">EXWORKS:</span> <span>{displayExworks > 0 ? displayExworks + ' ' + ordinoData.currency : ''}</span></div>
                    <div className="flex gap-2 mt-2 pt-2 border-t border-black"><span className="w-32">GENEL TOPLAM:</span> <span>{displayTotal.toFixed(2)} {ordinoData.currency}</span></div>
                </div>
             </div>
           </div>

           {/* --- HIDDEN GATE PASS TEMPLATE (REMAINS SAME) --- */}
           <div className="fixed top-0 left-[-9999px]">
                <div ref={permitRef} className="bg-white text-black font-sans box-border relative text-sm p-12" style={{ width: '210mm', minHeight: '297mm' }}>
                    {/* ... (Gate pass content same as previous) ... */}
                    <div className="flex justify-between items-start border-b border-black pb-6 mb-8">
                        <div className="w-1/2">
                            {printSettings.logoUrl ? <img src={printSettings.logoUrl} className="h-16 mb-2 object-contain" alt="Logo"/> : <h1 className="text-3xl font-black tracking-tighter">LOGYCY</h1>}
                            <p className="font-bold text-xs uppercase tracking-widest text-slate-500">SHIPPING & LOGISTICS</p>
                        </div>
                        <div className="w-1/2 text-right text-xs space-y-1">
                            <p className="font-bold">{printSettings.address || 'Gazimağusa Serbest Liman'}</p>
                            <p>Ofis: {printSettings.phone || '+90 533 000 00 00'}</p>
                            <p>E-mail: {printSettings.email || 'info@logycy.com'}</p>
                        </div>
                    </div>

                    <div className="text-center mb-8 relative">
                        <h2 className="text-xl font-bold">Konteyner Çıkış İzni</h2>
                        <div className="absolute right-0 top-0 text-xs font-bold">Tarih: {new Date().toLocaleDateString('tr-TR')}</div>
                    </div>

                    <div className="mb-8 font-bold text-base">
                        <p>Gümrük Şube Müdürlüğü</p>
                        <p>{toTitleCaseTR(ordinoData.arrivalPort)}</p>
                    </div>

                    <div className="mb-10 text-justify leading-relaxed">
                        <p>
                            <span className="font-bold">{ordinoData.arrivalDate}</span> tarihinde <span className="font-bold uppercase">{ordinoData.vesselName}</span> gemisi ile B/L <span className="font-bold">{ordinoData.blNo}</span> altında
                            <span className="font-bold uppercase"> {ordinoData.customerName}</span> adına gelen ve <span className="font-bold">{ordinoData.serialNo}</span> nolu ordino ile teslimi istenen,
                            aşağıda noları ve sayıları belirtilen konteyner/ların Gümrük sahası dışına çıkması için gerekli izinin verilmesini rica ederiz.
                        </p>
                    </div>

                    <div className="mb-10 flex justify-start">
                        <div className="border-1 border-black rounded-lg px-1 py-2 bg-slate-50 min-w-[200px]">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Konteyner No</p>
                            <p className="text-lg font-black text-black tracking-wider">{ordinoData.containerNo}</p>
                        </div>
                    </div>

                    <div className="mb-12 font-medium">
                        <p>Yukarıda numaraları verilmiş olan konteyner/ların 'leri boş olarak 48 saat içerisinde Gümrük sahasına teslim etmeyi taahhüt ederim.</p>
                    </div>

                    <div className="mb-20 font-bold ml-12">
                        <p>Saygılarımızla</p>
                    </div>

                    <div className="grid grid-cols-2 gap-12 text-sm font-medium">
                        <div className="space-y-6">
                            <div className="flex items-baseline gap-2">
                                <span className="w-24">Araç No:</span>
                                <div className="flex-1 border-b border-dotted border-black"></div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="w-24">Komisyoncu:</span>
                                <div className="flex-1 border-b border-dotted border-black"></div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="w-24">Teslim Tarih:</span>
                                <div className="flex-1 border-b border-dotted border-black"></div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="w-24">Teslim Alan:</span>
                                <div className="flex-1 border-b border-dotted border-black"></div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-baseline gap-2">
                                <span className="w-32 text-xs">Mağusa limanına geri varış tarihi:</span>
                                <div className="flex-1 border-b border-dotted border-black"></div>
                            </div>
                            <div className="flex items-baseline gap-2 pt-4">
                                <span className="w-24">Kontrol Eden:</span>
                                <div className="flex-1 border-b border-dotted border-black"></div>
                            </div>
                            
                            <div className="pt-8 text-center">
                                <p className="font-bold mb-12">ONAY</p>
                                <p className="text-xs font-bold">Gümrük ve Rüsumat Dairesi</p>
                                <p className="text-xs font-bold">{toTitleCaseTR(ordinoData.arrivalPort)}</p>
                            </div>
                        </div>
                    </div>
                </div>
           </div>

           {/* RIGHT SIDE: EDITOR PANEL */}
           <div className={clsx("w-full md:w-[400px] bg-white border-l border-gray-200 h-full overflow-y-auto print:hidden shadow-xl z-50", mobileTab === 'preview' && "hidden md:block")}>
               <div className="sticky top-0 bg-white z-10 border-b p-4 flex justify-between items-center">
                   <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><ArrowLeft className="md:hidden" onClick={() => setShowModal(false)}/> {isManualMode ? 'Yeni Ordino' : 'Düzenleme'}</h3>
                   <div className="flex gap-2">
                       <button onClick={saveOrdino} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700" title="Kaydet"><Save size={18}/></button>
                       <button onClick={handleDownloadPDF} className="bg-green-600 text-white p-2 rounded hover:bg-green-700" title="Yazdır"><Printer size={18}/></button>
                       <button onClick={() => setShowModal(false)} className="bg-gray-100 text-gray-600 p-2 rounded hover:bg-gray-200 hidden md:block" title="Kapat"><X size={18}/></button>
                   </div>
               </div>

               <div className="p-6 space-y-6">
                   {/* Conditional Selection for Manual Mode */}
                   {isManualMode && (
                       <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-2 mb-4">
                           <h4 className="text-xs font-bold text-orange-800 uppercase flex items-center gap-2"><Ship size={14}/> Bağlı Olduğu Master Dosya</h4>
                           <select 
                               className="w-full border border-orange-200 rounded p-2 text-sm bg-white font-bold"
                               value={manualTargetShipmentId}
                               onChange={(e) => handleShipmentSelection(e.target.value)}
                           >
                               <option value="">Dosya Seçiniz...</option>
                               {shipments.map(s => (
                                   <option key={s.id} value={s.id}>{s.referenceNo} - {s.vesselName}</option>
                               ))}
                           </select>
                           <p className="text-xs text-orange-600">Seçilen dosyanın gemi ve tarih bilgileri otomatik doldurulur.</p>
                       </div>
                   )}

                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                       <h4 className="text-xs font-bold text-slate-400 uppercase">Belge Numaraları</h4>
                       <div className="grid grid-cols-2 gap-3">
                           <div><label className="text-[10px] font-bold text-slate-500">Serial No</label><input className="w-full border rounded p-1.5 text-sm" value={ordinoData.serialNo} onChange={e => setOrdinoData({...ordinoData, serialNo: e.target.value})}/></div>
                           <div><label className="text-[10px] font-bold text-slate-500">Ref No</label><input className="w-full border rounded p-1.5 text-sm" value={ordinoData.refNo} onChange={e => setOrdinoData({...ordinoData, refNo: e.target.value})}/></div>
                       </div>
                       
                       <div><label className="text-[10px] font-bold text-slate-500 text-blue-600">Taşıma Senedi (Orijinal)</label><input className="w-full border rounded p-1.5 text-sm border-blue-200 bg-white" value={ordinoData.transportDocNo} onChange={e => setOrdinoData({...ordinoData, transportDocNo: e.target.value})}/></div>
                       <div><label className="text-[10px] font-bold text-slate-500 text-blue-600">Konteyner No</label><input className="w-full border rounded p-1.5 text-sm border-blue-200 bg-white" value={ordinoData.containerNo} onChange={e => setOrdinoData({...ordinoData, containerNo: e.target.value})}/></div>
                       <div><label className="text-[10px] font-bold text-slate-500">B/L No (Merkez)</label><input className="w-full border rounded p-1.5 text-sm bg-yellow-50" value={ordinoData.blNo} onChange={e => setOrdinoData({...ordinoData, blNo: e.target.value})}/></div>
                       
                       <div className="grid grid-cols-2 gap-3">
                           <div><label className="text-[10px] font-bold text-slate-500">Tescil No</label><input className="w-full border rounded p-1.5 text-sm" value={ordinoData.tescilNo} onChange={e => setOrdinoData({...ordinoData, tescilNo: e.target.value})}/></div>
                           <div><label className="text-[10px] font-bold text-slate-500">Tescil Tarihi (Metin)</label><input type="text" className="w-full border rounded p-1.5 text-sm" value={ordinoData.documentDate} onChange={e => setOrdinoData({...ordinoData, documentDate: e.target.value})}/></div>
                       </div>
                   </div>

                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                       <h4 className="text-xs font-bold text-slate-400 uppercase">Gemi & Rota</h4>
                       <div><label className="text-[10px] font-bold text-slate-500">Gemi Adı</label><input className="w-full border rounded p-1.5 text-sm" value={ordinoData.vesselName} onChange={e => setOrdinoData({...ordinoData, vesselName: e.target.value})}/></div>
                       <div><label className="text-[10px] font-bold text-slate-500">Sefer No</label><input className="w-full border rounded p-1.5 text-sm" value={ordinoData.voyageNo} onChange={e => setOrdinoData({...ordinoData, voyageNo: e.target.value})}/></div>
                       <div className="grid grid-cols-2 gap-3">
                           <div><label className="text-[10px] font-bold text-slate-500">Yükleme Yeri</label><input className="w-full border rounded p-1.5 text-sm" value={ordinoData.origin} onChange={e => setOrdinoData({...ordinoData, origin: e.target.value})}/></div>
                           <div><label className="text-[10px] font-bold text-slate-500">Boşaltma Yeri</label><input className="w-full border rounded p-1.5 text-sm" value={ordinoData.arrivalPort} onChange={e => setOrdinoData({...ordinoData, arrivalPort: e.target.value})}/></div>
                       </div>
                       <div><label className="text-[10px] font-bold text-slate-500">Varış Tarihi (Metin)</label><input type="text" className="w-full border rounded p-1.5 text-sm" value={ordinoData.arrivalDate} onChange={e => setOrdinoData({...ordinoData, arrivalDate: e.target.value})}/></div>
                   </div>

                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                       <h4 className="text-xs font-bold text-slate-400 uppercase">Yük Detayları (Eşya)</h4>
                       {ordinoData.goodsList.map((good, idx) => (
                           <div key={idx} className="p-2 border border-slate-200 bg-white rounded-lg space-y-2">
                               <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400">KALEM {idx+1}</span></div>
                               <div><label className="text-[9px] font-bold text-slate-400">Eşya Tanımı</label><textarea className="w-full border rounded p-1 text-xs h-10" value={good.description} onChange={e => updateGoodItem(idx, 'description', e.target.value)}/></div>
                               <div><label className="text-[9px] font-bold text-slate-400">Marka ve No</label><input className="w-full border rounded p-1 text-xs" value={good.marks || ''} onChange={e => updateGoodItem(idx, 'marks', e.target.value)}/></div>
                               <div className="grid grid-cols-2 gap-2">
                                   <div><label className="text-[9px] font-bold text-slate-400">Miktar</label><input type="number" className="w-full border rounded p-1 text-xs" value={good.quantity} onChange={e => updateGoodItem(idx, 'quantity', Number(e.target.value))}/></div>
                                   <div><label className="text-[9px] font-bold text-slate-400">Cinsi</label><input className="w-full border rounded p-1 text-xs" value={good.packageType} onChange={e => updateGoodItem(idx, 'packageType', e.target.value)}/></div>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                   <div><label className="text-[9px] font-bold text-slate-400">Ağırlık (KG)</label><input className="w-full border rounded p-1 text-xs" value={good.weight || ''} onChange={e => updateGoodItem(idx, 'weight', e.target.value)}/></div>
                                   <div><label className="text-[9px] font-bold text-slate-400">Hacim (M3)</label><input className="w-full border rounded p-1 text-xs" value={good.volume || ''} onChange={e => updateGoodItem(idx, 'volume', e.target.value)}/></div>
                               </div>
                           </div>
                       ))}
                   </div>

                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                       <h4 className="text-xs font-bold text-slate-400 uppercase">Taraflar & Ofis</h4>
                       <div><label className="text-[10px] font-bold text-slate-500">Alıcı (Müşteri)</label><textarea className="w-full border rounded p-1.5 text-sm h-16" value={ordinoData.customerName} onChange={e => setOrdinoData({...ordinoData, customerName: e.target.value})}/></div>
                       <div>
                           <label className="text-[10px] font-bold text-slate-500">Gümrük Müdürlüğü</label>
                           <select 
                                className="w-full border rounded p-1.5 text-sm bg-white" 
                                value={ordinoData.customsOffice} 
                                onChange={e => setOrdinoData({...ordinoData, customsOffice: e.target.value})}
                           >
                               {definitions.customsOffices.map(c => (
                                   <option key={c} value={c}>{c}</option>
                               ))}
                           </select>
                       </div>
                   </div>

                   {/* DOUBLE-BOOKKEEPING SECTION */}
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                       <div className="flex items-center gap-2 mb-2">
                           <h4 className="text-xs font-bold text-slate-400 uppercase">Ödeme Bilgileri</h4>
                           <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200 flex items-center gap-1"><ShieldCheck size={10}/> Çift Kayıt</span>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                           {/* Left Col: Real */}
                           <div className="space-y-2">
                               <p className="text-[10px] font-bold text-blue-600 border-b border-blue-100 pb-1">GERÇEK (CARİ)</p>
                               <div><label className="text-[9px] font-bold text-slate-400">Navlun</label><input type="number" className="w-full border rounded p-1 text-sm bg-blue-50/20" value={ordinoData.navlun} onChange={e => setOrdinoData({...ordinoData, navlun: Number(e.target.value)})}/></div>
                               <div><label className="text-[9px] font-bold text-slate-400">Tahliye</label><input type="number" className="w-full border rounded p-1 text-sm bg-blue-50/20" value={ordinoData.tahliye} onChange={e => setOrdinoData({...ordinoData, tahliye: Number(e.target.value)})}/></div>
                               <div><label className="text-[9px] font-bold text-slate-400">Exworks/Lokal</label><input type="number" className="w-full border rounded p-1 text-sm bg-blue-50/20" value={ordinoData.exworks} onChange={e => setOrdinoData({...ordinoData,exworks: Number(e.target.value)})}/></div>
                           </div>

                           {/* Right Col: Official */}
                           <div className="space-y-2">
                               <p className="text-[10px] font-bold text-purple-600 border-b border-purple-100 pb-1">RESMİ (GÜMRÜK)</p>
                               <div><label className="text-[9px] font-bold text-slate-400">Navlun</label><input type="number" className="w-full border rounded p-1 text-sm bg-purple-50/20" value={ordinoData.officialNavlun} onChange={e => setOrdinoData({...ordinoData, officialNavlun: Number(e.target.value)})}/></div>
                               <div><label className="text-[9px] font-bold text-slate-400">Tahliye</label><input type="number" className="w-full border rounded p-1 text-sm bg-purple-50/20" value={ordinoData.officialTahliye} onChange={e => setOrdinoData({...ordinoData, officialTahliye: Number(e.target.value)})}/></div>
                               <div><label className="text-[9px] font-bold text-slate-400">Exworks/Lokal</label><input type="number" className="w-full border rounded p-1 text-sm bg-purple-50/20" value={ordinoData.officialExworks} onChange={e => setOrdinoData({...ordinoData,officialExworks: Number(e.target.value)})}/></div>
                           </div>
                       </div>

                       <div className="mt-2 pt-2 border-t border-slate-200">
                           <label className="text-[10px] font-bold text-slate-500 block mb-1">Para Birimi</label>
                           <select className="w-full border rounded p-1.5 text-sm bg-white" value={ordinoData.currency} onChange={e => setOrdinoData({...ordinoData, currency: e.target.value})}>
                               <option value="USD">USD</option>
                               <option value="EUR">EUR</option>
                               <option value="GBP">GBP</option>
                               <option value="TRY">TRY</option>
                           </select>
                       </div>
                   </div>

                   <button onClick={handleConvertToInvoice} disabled={!!existingInvoice || checkingInvoice} title={existingInvoice ? `Bu ordino zaten faturalanmış. Fatura No: ${existingInvoice.invoiceNo}` : (checkingInvoice ? "Kontrol ediliyor..." : "")} className={`w-full bg-accent-500 text-white py-3 rounded-lg flex justify-center items-center gap-2 transition mb-3 ${existingInvoice || checkingInvoice ? "opacity-60 cursor-not-allowed" : "hover:bg-accent-400"}`}>
                       <ArrowRightCircle size={18} /> Faturalaştır
                   </button>
                   {existingInvoice && (
                       <div className="mt-2 mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs">
                           Bu ordino zaten faturalanmış. <b>Fatura No:</b> {existingInvoice.invoiceNo || "(yok)"}.
                           <div className="mt-2 flex gap-2">
                               <button
                                   className="px-3 py-1 rounded bg-amber-200 hover:bg-amber-300 transition"
                                   onClick={() => existingInvoice.id ? navigate(`/invoices/${existingInvoice.id}`) : navigate('/invoices')}
                               >
                                   Faturayı Aç
                               </button>
                               <button
                                   className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 transition"
                                   onClick={() => refreshInvoiceLock()}
                               >
                                   Yenile
                               </button>
                           </div>
                       </div>
                   )}

                   <div className="grid grid-cols-2 gap-2">
                       <button onClick={handleDownloadPDF} className="bg-slate-800 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-slate-900 transition text-xs">
                           <Download size={16} /> PDF İndir (4 Sayfa)
                       </button>
                       <button onClick={handlePrintPermit} className="bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-slate-50 transition text-xs">
                           <ContainerIcon size={16} /> Çıkış İzni (Gate Pass)
                       </button>
                   </div>
                   
                   {/* Spacing for mobile scrolling */}
                   <div className="h-10 md:hidden"></div>
               </div>
           </div>

        </div>
      )}

      {/* ... (IMPORT MODAL REMAINS SAME) ... */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-4">
            {/* Same import modal content as before... */}
            <div className="w-full max-w-7xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-brand-900 font-bold text-lg">
                            <Sparkles className="text-accent-500" />
                            Otomatik Manifest Aktarımı
                        </div>
                        
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setImportType('pdf')} className={clsx("px-3 py-1.5 rounded-md text-xs font-bold transition", importType === 'pdf' ? "bg-white shadow text-brand-900" : "text-slate-500")}>PDF (AI)</button>
                            <button onClick={() => setImportType('excel')} className={clsx("px-3 py-1.5 rounded-md text-xs font-bold transition", importType === 'excel' ? "bg-white shadow text-green-700" : "text-slate-500")}>Excel</button>
                        </div>

                        {!importFile ? (
                            <label className="cursor-pointer bg-brand-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-800 transition flex items-center gap-2">
                                <Upload size={14} /> Dosya Seç
                                <input type="file" className="hidden" accept={importType === 'pdf' ? ".pdf" : ".xlsx, .xls"} onChange={handleFileSelect} />
                            </label>
                        ) : (
                            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100">
                                <FileText size={14} /> {importFile.name}
                                <button onClick={() => { setImportFile(null); setExtractedRows([]); }} className="hover:text-red-600 ml-2"><X size={14}/></button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"><X size={20} /></button>
                </div>

                {/* Target Shipment Selection & Quick Create */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
                    <div className="flex items-center gap-4 flex-1 w-full">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">HEDEF DOSYA (SHIPMENT)</label>
                            <select 
                                className="border border-slate-300 rounded-lg p-2 text-sm font-bold w-64 outline-none focus:border-brand-500"
                                value={targetShipmentId}
                                onChange={(e) => setTargetShipmentId(e.target.value)}
                            >
                                <option value="">Mevcut Dosya Seçiniz...</option>
                                {shipments.map(s => <option key={s.id} value={s.id}>{s.referenceNo} - {s.vesselName || 'Gemi Yok'}</option>)}
                            </select>
                        </div>
                        <div className="text-slate-300 font-light text-2xl">/</div>
                        <button 
                            onClick={() => setIsCreatingMaster(!isCreatingMaster)}
                            className={clsx("px-4 py-2 rounded-lg text-xs font-bold border transition", isCreatingMaster ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100")}
                        >
                            {isCreatingMaster ? 'Seçime Dön' : '+ Hızlı Master Dosya Oluştur'}
                        </button>
                    </div>

                    {/* Quick Create Inputs */}
                    {isCreatingMaster && (
                        <div className="flex items-end gap-2 animate-in slide-in-from-right-10 fade-in duration-300 flex-1 w-full justify-end">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 block">REF NO</label>
                                <input className="border rounded p-1.5 text-xs w-24" placeholder="LOG-..." value={newMasterData.referenceNo} onChange={e => setNewMasterData({...newMasterData, referenceNo: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 block">GEMİ ADI</label>
                                <input className="border rounded p-1.5 text-xs w-32" placeholder="Gemi..." value={newMasterData.vesselName} onChange={e => setNewMasterData({...newMasterData, vesselName: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 block">VARIŞ TARİHİ</label>
                                <input type="date" className="border rounded p-1.5 text-xs w-28" value={newMasterData.arrivalDate} onChange={e => setNewMasterData({...newMasterData, arrivalDate: e.target.value})} />
                            </div>
                            <button onClick={handleCreateMasterShipment} className="bg-orange-500 text-white px-3 py-1.5 rounded h-[30px] text-xs font-bold hover:bg-orange-600">Oluştur</button>
                        </div>
                    )}
                </div>

                {/* Data Grid */}
                <div className="flex-1 overflow-auto bg-slate-100 relative">
                    {extractedRows.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            {isProcessing ? (
                                <>
                                    <Loader2 size={40} className="animate-spin text-brand-500 mb-4" />
                                    <p className="font-bold text-slate-600">{processingStatus}</p>
                                </>
                            ) : (
                                <>
                                    <FileSpreadsheet size={48} className="mb-4 opacity-50" />
                                    <p>Veriler burada görüntülenecek.</p>
                                    <p className="text-sm">Lütfen dosya yükleyin.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Sıra</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">B/L No</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Konteyner</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Kap</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Marka</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Eşya Tanımı</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Kilo</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Alıcı</th>
                                        <th scope="col" className="relative px-3 py-2"><span className="sr-only">Sil</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {extractedRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-2 py-1"><input className="w-12 text-xs border-none bg-transparent focus:ring-0" value={row.sequenceNo} onChange={e => updateRow(idx, 'sequenceNo', e.target.value)} /></td>
                                            <td className="px-2 py-1"><input className="w-24 text-xs border-none bg-transparent focus:ring-0 font-mono" value={row.transportDocNo} onChange={e => updateRow(idx, 'transportDocNo', e.target.value)} /></td>
                                            <td className="px-2 py-1"><input className="w-32 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-700" value={row.containerNo} onChange={e => updateRow(idx, 'containerNo', e.target.value)} /></td>
                                            <td className="px-2 py-1 flex gap-1">
                                                <input className="w-10 text-xs border-b border-slate-200 bg-transparent text-right" value={row.packageCount} onChange={e => updateRow(idx, 'packageCount', e.target.value)} />
                                                <input className="w-12 text-xs border-none bg-transparent" value={row.packageType} onChange={e => updateRow(idx, 'packageType', e.target.value)} />
                                            </td>
                                            <td className="px-2 py-1"><input className="w-full text-xs border-none bg-transparent focus:ring-0" value={row.marks} onChange={e => updateRow(idx, 'marks', e.target.value)} /></td>
                                            <td className="px-2 py-1"><textarea rows={1} className="w-full text-xs border-none bg-transparent focus:ring-0 resize-none" value={row.description} onChange={e => updateRow(idx, 'description', e.target.value)} /></td>
                                            <td className="px-2 py-1"><input className="w-16 text-xs border-none bg-transparent focus:ring-0 text-right" value={row.weight} onChange={e => updateRow(idx, 'weight', e.target.value)} /></td>
                                            <td className="px-2 py-1"><textarea rows={1} className="w-full text-xs border-none bg-transparent focus:ring-0 font-bold text-slate-700 resize-none" value={row.receiverName} onChange={e => updateRow(idx, 'receiverName', e.target.value)} /></td>
                                            <td className="px-2 py-1 text-right">
                                                <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 transition"><Trash2 size={14}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-500 font-bold">
                        {extractedRows.length > 0 && <span>{extractedRows.length} kayıt listelendi.</span>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { setExtractedRows([]); setImportFile(null); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-300">Temizle</button>
                        <button onClick={saveImportResult} disabled={extractedRows.length === 0 || !targetShipmentId} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center gap-2">
                            <CheckCircle size={18} /> Aktarımı Tamamla
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Ordino;
