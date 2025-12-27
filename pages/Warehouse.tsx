
import React, { useEffect, useState, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { InventoryItem, Customer } from '../types';
import { Plus, Search, Box, Package, User, MapPin, Barcode, Trash2, X, CheckCircle, AlertTriangle, Printer, QrCode, Camera, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';

const Warehouse: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Camera Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Custom Unit State
  const [unitOptions, setUnitOptions] = useState<string[]>(['Adet', 'Koli', 'Palet', 'Kg']);

  // Label Modal State (Preview)
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    sku: '',
    quantity: 0,
    unit: 'Adet',
    location: '',
    status: 'Stokta',
    ownerName: '',
    entryDate: new Date().toISOString().slice(0, 10)
  });

  // Capacity Configuration (This could be moved to settings later)
  const MAX_CAPACITY = 10000; 

  useEffect(() => {
    loadData();
    
    // Load Unit Settings
    const savedDefs = localStorage.getItem('systemDefinitions');
    if (savedDefs) {
        const parsed = JSON.parse(savedDefs);
        if (parsed.quantityUnits && parsed.quantityUnits.length > 0) {
            setUnitOptions(parsed.quantityUnits);
            setFormData(prev => ({...prev, unit: parsed.quantityUnits[0] as any}));
        }
    }
  }, []);

  // --- CAMERA LOGIC ---
  const startCamera = async () => {
      setShowScanner(true);
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment' } // Prefer back camera
          });
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
      } catch (err) {
          toast.error("Kamera erişimi reddedildi veya bulunamadı.");
          setShowScanner(false);
      }
  };

  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
          videoRef.current.srcObject = null;
      }
      setShowScanner(false);
  };

  const captureAndAnalyze = async () => {
      if (!videoRef.current) return;
      setIsScanning(true);

      try {
          // Capture frame
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(videoRef.current, 0, 0);
          const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

          // Stop camera immediately to save battery/resources
          stopCamera();

          // Send to Gemini
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            Analyze this image of a product label or cargo box. 
            Extract details into JSON:
            - sku: Barcode number or SKU code found.
            - name: Product description or name.
            - quantity: Quantity if visible (number).
            - unit: Unit type (Koli, Adet, Palet, Kg) - guess based on image.
            - location: If there is a shelf code (like A-12, B3), extract it.
            
            Return JSON only.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64Data } }] }],
              config: { responseMimeType: 'application/json' }
          });

          const extracted = JSON.parse(response.text || '{}');
          
          setFormData(prev => ({
              ...prev,
              sku: extracted.sku || prev.sku,
              name: extracted.name || prev.name,
              quantity: extracted.quantity || prev.quantity,
              unit: extracted.unit || prev.unit,
              location: extracted.location || prev.location
          }));

          toast.success("Ürün bilgileri tarandı!");

      } catch (error: any) {
          console.error(error);
          toast.error("Tarama başarısız: " + error.message);
      } finally {
          setIsScanning(false);
      }
  };

  const loadData = async () => {
    setLoading(true);
    const [invRes, custRes] = await Promise.all([
        supabaseService.getInventory(),
        supabaseService.getCustomers()
    ]);
    if (invRes.data) setInventory(invRes.data);
    if (custRes.data) setCustomers(custRes.data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Auto generate SKU if empty
    const finalData = { ...formData };
    if (!finalData.sku) {
        finalData.sku = `LOG-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    await supabaseService.addInventoryItem(finalData);
    toast.success('Ürün girişi yapıldı');
    setFormData({
        name: '', sku: '', quantity: 0, unit: unitOptions[0] as any, location: '', 
        status: 'Stokta', ownerName: '', entryDate: new Date().toISOString().slice(0, 10)
    });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Bu ürünü stoktan silmek istediğinize emin misiniz?')) return;
    await supabaseService.deleteInventoryItem(id);
    toast.success('Ürün silindi');
    loadData();
  };

  // --- VECTOR LABEL PRINTING (Standard High Quality) ---
  const handlePrintVectorLabel = async (item: InventoryItem) => {
      const toastId = toast.loading('Etiket hazırlanıyor...');
      try {
          // 10cm x 10cm standard logistics label size
          const doc = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: [100, 100] 
          });

          // Helper to center text
          const centerText = (text: string, y: number, size: number, font: string = 'helvetica', weight: string = 'normal') => {
              doc.setFont(font, weight);
              doc.setFontSize(size);
              const textWidth = doc.getStringUnitWidth(text) * size / 2.822; // approx width
              const x = (100 - textWidth) / 2;
              doc.text(text, x + (textWidth/2), y, { align: 'center' });
          };

          // --- HEADER ---
          doc.setLineWidth(0.5);
          doc.rect(2, 2, 96, 96); // Outer Border
          
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text("LOGYCY LOGISTICS", 50, 10, { align: 'center' });
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text("WAREHOUSE ENTRY LABEL", 50, 14, { align: 'center' });

          doc.line(2, 16, 98, 16); // Line

          // --- PRODUCT INFO ---
          doc.setFontSize(10);
          doc.text("PRODUCT / URUN:", 5, 22);
          
          // Multiline product name
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          const splitTitle = doc.splitTextToSize(item.name.toUpperCase(), 90);
          doc.text(splitTitle, 5, 28);
          
          let yPos = 28 + (splitTitle.length * 6);
          
          doc.line(2, yPos, 98, yPos);
          yPos += 5;

          // --- DETAILS GRID ---
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text("CUSTOMER / MUSTERI:", 5, yPos);
          doc.setFont('helvetica', 'bold');
          doc.text(item.ownerName?.toUpperCase() || 'UNKNOWN', 5, yPos + 5);
          
          doc.setFont('helvetica', 'normal');
          doc.text("LOCATION / RAF:", 55, yPos);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text(item.location, 55, yPos + 6);

          yPos += 12;
          doc.line(2, yPos, 98, yPos);
          yPos += 5;

          // --- BARCODE SECTION (Code 128) ---
          // Using a public API to generate a high-res barcode image for the PDF
          const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${item.sku}&scale=3&height=10&incltext&textsize=8`;
          
          // Fetch the image
          const imgBlob = await fetch(barcodeUrl).then(r => r.blob());
          const reader = new FileReader();
          
          await new Promise((resolve) => {
              reader.onloadend = () => {
                  const base64data = reader.result as string;
                  // Add barcode image to PDF
                  // x=10, y=current, w=80, h=20
                  doc.addImage(base64data, 'PNG', 10, yPos + 2, 80, 20);
                  resolve(true);
              };
              reader.readAsDataURL(imgBlob);
          });

          // --- FOOTER ---
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(`QTY: ${item.quantity} ${item.unit} | Date: ${new Date(item.entryDate).toLocaleDateString()}`, 50, 95, { align: 'center' });

          doc.save(`Label_${item.sku}.pdf`);
          toast.success("Etiket indirildi", { id: toastId });

      } catch (e: any) {
          console.error(e);
          toast.error("Etiket oluşturulamadı: " + e.message, { id: toastId });
      }
  };

  const filtered = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.ownerName && item.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalItems = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const occupancyRate = Math.min(Math.round((totalItems / MAX_CAPACITY) * 100), 100);

  return (
    <div className="space-y-6">
      
      {/* SCANNER MODAL OVERLAY */}
      {showScanner && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col">
              <div className="absolute top-4 right-4 z-50">
                  <button onClick={stopCamera} className="bg-white/20 p-3 rounded-full text-white backdrop-blur-md">
                      <X size={24} />
                  </button>
              </div>
              <div className="flex-1 relative flex items-center justify-center bg-black">
                  <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover opacity-80"
                  />
                  {/* Scan Overlay UI */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-72 h-72 border-2 border-accent-500 rounded-2xl relative">
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-accent-500 -mt-1 -ml-1"></div>
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-accent-500 -mt-1 -mr-1"></div>
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-accent-500 -mb-1 -ml-1"></div>
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-accent-500 -mb-1 -mr-1"></div>
                          {isScanning && <div className="absolute inset-0 bg-accent-500/20 animate-pulse"></div>}
                      </div>
                  </div>
                  <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-auto">
                      <button 
                          onClick={captureAndAnalyze}
                          disabled={isScanning}
                          className="bg-white rounded-full p-6 shadow-2xl hover:scale-105 transition active:scale-95 disabled:opacity-50"
                      >
                          {isScanning ? <RefreshCw className="animate-spin text-brand-900" size={32}/> : <div className="w-8 h-8 bg-brand-900 rounded-full border-4 border-white"></div>}
                      </button>
                  </div>
                  <div className="absolute bottom-8 left-0 right-0 text-center text-white text-sm font-medium">
                      {isScanning ? 'Analiz ediliyor...' : 'Etiketi çerçeveye alıp butona basın'}
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Depo / Antrepo</h1>
          <p className="text-slate-500">Stok yönetimi ve mal kabul işlemleri.</p>
        </div>
        <button 
          onClick={() => { setFormData({ name: '', sku: '', quantity: 0, unit: 'Adet', location: '', status: 'Stokta', ownerName: '', entryDate: new Date().toISOString().slice(0, 10) }); setShowModal(true); }}
          className="bg-accent-500 text-brand-900 px-5 py-3 rounded-xl hover:bg-accent-400 transition flex items-center gap-2 shadow-lg shadow-accent-500/20 font-bold"
        >
          <Plus size={20} /> Mal Kabul
        </button>
      </div>

      {/* Stats - Hidden in Print */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase mb-2">TOPLAM STOK ADEDİ</p>
               <p className="text-3xl font-extrabold text-brand-900">{totalItems.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-brand-50 text-brand-700 rounded-xl">
               <Package size={24} />
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase mb-2">DOLULUK ORANI</p>
               <p className={clsx("text-3xl font-extrabold", occupancyRate > 90 ? "text-red-600" : "text-blue-600")}>%{occupancyRate}</p>
               <p className="text-[10px] text-slate-400 mt-1">Kap: {MAX_CAPACITY.toLocaleString()} birim</p>
            </div>
            <div className="w-16 h-16 relative flex items-center justify-center">
               <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  <path 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    fill="none" 
                    stroke={occupancyRate > 90 ? "#ef4444" : "#3b82f6"} 
                    strokeWidth="4" 
                    strokeDasharray={`${occupancyRate}, 100`} 
                  />
               </svg>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Ürün adı, SKU veya Müşteri ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
           {loading ? (
             <p className="col-span-full text-center text-slate-500 py-10">Yükleniyor...</p>
           ) : filtered.length === 0 ? (
             <div className="col-span-full text-center py-10">
                <Box size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Stok kaydı bulunamadı.</p>
             </div>
           ) : (
             filtered.map(item => (
               <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition group relative">
                  <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                           {item.sku || 'NO-SKU'}
                        </span>
                        <span className={clsx("text-xs font-bold px-2 py-1 rounded flex items-center gap-1", 
                           item.status === 'Stokta' ? "bg-green-100 text-green-700" : 
                           item.status === 'Rezerve' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                        )}>
                           {item.status === 'Stokta' ? <CheckCircle size={10}/> : <AlertTriangle size={10}/>} {item.status}
                        </span>
                     </div>
                  </div>
                  
                  <h3 className="font-bold text-brand-900 text-lg mb-4">{item.name}</h3>
                  
                  <div className="space-y-2 text-sm">
                     <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-2"><Box size={14}/> Miktar</span>
                        <span className="font-bold text-slate-800">{item.quantity} {item.unit}</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-2"><MapPin size={14}/> Konum</span>
                        <span className="font-bold text-brand-600">{item.location}</span>
                     </div>
                     <div className="flex justify-between py-2">
                        <span className="text-slate-500 flex items-center gap-2"><User size={14}/> Müşteri</span>
                        <span className="font-medium text-slate-700">{item.ownerName || '-'}</span>
                     </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-50">
                     <button onClick={() => handlePrintVectorLabel(item)} className="text-sm font-bold text-slate-500 hover:text-brand-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50 transition">
                        <Printer size={16} /> Etiket (PDF)
                     </button>
                     <button onClick={() => handleDelete(item.id)} className="text-sm font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition">
                        <Trash2 size={16} /> Sil
                     </button>
                  </div>
               </div>
             ))
           )}
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Mal Kabul / Stok Girişi</h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
            </div>
            
            {/* AI Scan Trigger inside Modal */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-center">
                <button 
                    type="button" 
                    onClick={startCamera}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition transform font-bold"
                >
                    <Camera size={20} /> Etiket Tara (AI Kamera)
                </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
               {/* Form Fields */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">SKU / Barkod</label>
                     <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="Otomatik..." />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Giriş Tarihi</label>
                     <input type="date" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})} />
                  </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Ürün Adı</label>
                  <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Örn: Yedek Parça Koli" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Miktar</label>
                     <input type="number" required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Birim</label>
                     <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                        value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as any})}>
                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Raf / Konum</label>
                     <input required className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                       value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Örn: A-12" />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Durum</label>
                     <select className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none bg-slate-50" 
                        value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value="Stokta">Stokta</option>
                        <option value="Rezerve">Rezerve</option>
                        <option value="Hasarlı">Hasarlı</option>
                     </select>
                  </div>
               </div>

               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Mal Sahibi (Müşteri Seçimi)</label>
                  <SearchableSelect
                      options={customers.map(c => ({ id: c.name, label: c.name }))}
                      value={formData.ownerName || ''}
                      onChange={(val) => setFormData({...formData, ownerName: val})}
                      placeholder="Müşteri Ara..."
                  />
               </div>

               <div className="pt-4">
                  <button type="submit" className="w-full bg-accent-500 text-brand-900 py-3 rounded-xl font-bold hover:bg-accent-400 transition shadow-lg shadow-accent-500/20">Kaydet</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warehouse;
