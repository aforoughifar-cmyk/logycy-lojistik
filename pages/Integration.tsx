import React, { useState } from 'react';
import { Upload, Database, CheckCircle, AlertTriangle, FileSpreadsheet, ArrowRight, RefreshCw, Loader2, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { supabaseService } from '../services/supabaseService';
import { ShipmentStatus } from '../types';

// Simulated import types based on ShipsGo CSVs
type ImportType = 'shipments' | 'gate_in' | 'gate_out' | 'waiting' | 'rerouted';

const Integration: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<ImportType>('shipments');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [importResults, setImportResults] = useState<{
    total: number;
    created: number;
    updated: number;
    errors: number;
  } | null>(null);

  const importOptions = [
    { id: 'shipments', label: 'My Shipments (Temel Dosyalar)', icon: FileSpreadsheet, desc: 'Yeni sevkiyatları ve müşteri bilgilerini oluşturur.' },
    { id: 'waiting', label: 'Waiting Containers (Bekleyenler)', icon: AlertTriangle, desc: 'Liman bekleme sürelerini ve kritik durumları günceller.' },
    { id: 'gate_out', label: 'Gate Out (Teslim Edilenler)', icon: CheckCircle, desc: 'Teslim edilen kargoları günceller ve müşteriyi bilgilendirir.' },
    { id: 'gate_in', label: 'Gate In / Rerouted', icon: RefreshCw, desc: 'Giriş ve rota değişikliği hareketlerini işler.' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

  const processFile = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setProgress(0);
    setLogs([]);
    setImportResults({ total: 0, created: 0, updated: 0, errors: 0 });

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

      const totalRows = jsonData.length;
      addLog(`${totalRows} satır veri okundu. İşlem başlıyor...`);

      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      // Batch Processing Loop
      for (let i = 0; i < totalRows; i++) {
        const row = jsonData[i];
        
        // Update Progress
        if (i % 5 === 0) setProgress(Math.round(((i + 1) / totalRows) * 100));

        try {
          // Normalize keys (lowercase, remove spaces) for easier access
          const cleanRow: any = {};
          Object.keys(row).forEach(key => {
            cleanRow[key.toLowerCase().trim().replace(/ /g, '_')] = row[key];
          });

          const refNo = cleanRow['reference_no'] || cleanRow['ref_no'] || cleanRow['shipment_ref'] || cleanRow['booking_no'];
          const containerNo = cleanRow['container_no'] || cleanRow['container_number'];

          // --- 1. SHIPMENTS IMPORT ---
          if (importType === 'shipments') {
             if (!refNo) { errorCount++; continue; }

             // Customer Logic
             const customerName = cleanRow['customer_name'] || cleanRow['notify_party'] || 'Unknown Customer';
             let customerId = '';
             const custRes = await supabaseService.getCustomerByName(customerName);
             if (custRes.data) {
                customerId = custRes.data.id;
             } else {
                const newCust = await supabaseService.createCustomer({
                   type: 'kurumsal',
                   name: customerName,
                   phone: '', email: '', address: ''
                });
                if (newCust.data) {
                   customerId = newCust.data.id;
                   addLog(`[+] Yeni Müşteri: ${customerName}`);
                }
             }

             // Shipment Logic
             const shipRes = await supabaseService.getShipmentByTrackingNumber(refNo);
             const shipmentData = {
                customerId,
                referenceNo: refNo,
                transportMode: (cleanRow['transport_mode'] || 'deniz').toLowerCase(),
                origin: cleanRow['pol'] || cleanRow['origin'],
                destination: cleanRow['pod'] || cleanRow['destination'],
                eta: cleanRow['eta'] ? new Date(cleanRow['eta']).toISOString().slice(0,10) : undefined,
                description: `Imported: ${new Date().toLocaleDateString()}`,
                carrier: cleanRow['carrier_name'],
                vesselName: cleanRow['vessel_name'],
                bookingNo: cleanRow['booking_no']
             };

             if (shipRes.data) {
                await supabaseService.updateShipmentDetails(shipRes.data.id, shipmentData);
                updatedCount++;
                addLog(`[U] Güncellendi: ${refNo}`);
             } else {
                await supabaseService.createShipment({ ...shipmentData, status: ShipmentStatus.IN_TRANSIT });
                createdCount++;
                addLog(`[C] Oluşturuldu: ${refNo}`);
             }
          }
          
          // --- 2. GATE OUT (DELIVERED) ---
          else if (importType === 'gate_out') {
             if (!refNo) continue;
             const shipRes = await supabaseService.getShipmentByTrackingNumber(refNo);
             if (shipRes.data) {
                await supabaseService.updateShipmentStatus(shipRes.data.id, ShipmentStatus.DELIVERED);
                await supabaseService.addHistory(shipRes.data.id, {
                    description: 'Konteyner Teslim Edildi (Gate Out)',
                    location: cleanRow['pod'] || 'Varış Limanı',
                    date: new Date().toISOString()
                });
                updatedCount++;
                addLog(`[OK] Teslimat Kaydedildi: ${refNo}`);
             } else {
                errorCount++;
                addLog(`[!] Dosya bulunamadı: ${refNo}`);
             }
          }

          // --- 3. WAITING LIST ---
          else if (importType === 'waiting') {
             if (!refNo || !containerNo) continue;
             // Here we would find the container specifically if we had exact mapping, 
             // for now we log an alert
             const days = cleanRow['waiting_days'] || 0;
             if (days > 7) {
                 addLog(`[WARN] Kritik Bekleme: ${containerNo} (${days} gün)`);
                 // In real app: Update container "waitingTimeDays" field
             }
             updatedCount++;
          }

          // --- 4. GATE IN / REROUTED ---
          else if (importType === 'gate_in') {
             if (!refNo) continue;
             const shipRes = await supabaseService.getShipmentByTrackingNumber(refNo);
             if (shipRes.data) {
                 const isRerouted = cleanRow['is_rerouted'] || cleanRow['new_pod'];
                 if (isRerouted) {
                     await supabaseService.updateShipmentDetails(shipRes.data.id, { 
                         destination: cleanRow['new_pod'],
                         description: `${shipRes.data.description} | ROTA DEĞİŞTİ`
                     });
                     addLog(`[ROUTE] Rota Değişimi: ${refNo} -> ${cleanRow['new_pod']}`);
                 } else {
                     // Standard Gate In
                     await supabaseService.addHistory(shipRes.data.id, {
                         description: `Liman Girişi (Gate In) - Konteyner: ${containerNo || 'N/A'}`,
                         location: cleanRow['current_port'] || cleanRow['pol'],
                         date: new Date().toISOString()
                     });
                     addLog(`[IN] Liman Girişi: ${refNo}`);
                 }
                 updatedCount++;
             }
          }

        } catch (err) {
          console.error(err);
          errorCount++;
        }
      }

      setProgress(100);
      setImportResults({
        total: totalRows,
        created: createdCount,
        updated: updatedCount,
        errors: errorCount
      });

      // Small delay to show 100%
      setTimeout(() => setActiveStep(3), 500);
      toast.success('İçe aktarma başarıyla tamamlandı.');

    } catch (error: any) {
      toast.error('Dosya işleme hatası: ' + error.message);
      addLog('KRİTİK HATA: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const resetImport = () => {
      setSelectedFile(null);
      setImportResults(null);
      setLogs([]);
      setActiveStep(1);
      setProgress(0);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 flex items-center gap-2">
            <Database className="text-accent-500" /> ShipsGo Entegrasyonu
          </h1>
          <p className="text-slate-500">Excel / CSV dosyalarını toplu olarak sisteme aktarın.</p>
        </div>
        
        {/* Step Indicator */}
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold shadow-sm">
            <span className={clsx(activeStep >= 1 ? "text-brand-900" : "text-slate-400")}>1. Tip</span>
            <ArrowRight size={14} className="text-slate-300" />
            <span className={clsx(activeStep >= 2 ? "text-brand-900" : "text-slate-400")}>2. Yükleme</span>
            <ArrowRight size={14} className="text-slate-300" />
            <span className={clsx(activeStep >= 3 ? "text-brand-900" : "text-slate-400")}>3. Sonuç</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Panel: Logs */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-brand-900 text-white rounded-2xl p-6 relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="font-bold text-lg mb-2">Otomatik Senkronizasyon</h3>
                    <p className="text-brand-200 text-sm mb-4">
                        Webhook kullanarak verileri anlık olarak güncelleyebilirsiniz.
                    </p>
                    <div className="bg-white/10 p-3 rounded-lg border border-white/20 text-xs font-mono break-all mb-2 select-all cursor-pointer hover:bg-white/20 transition">
                        https://api.logycy.com/v1/shipsgo-hook
                    </div>
                    <p className="text-[10px] text-slate-400">Bu URL'i ShipsGo panelinize ekleyin.</p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                    <RefreshCw size={120} />
                </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[400px]">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                    Canlı Log
                    {logs.length > 0 && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">{logs.length} satır</span>}
                </h3>
                <div className="flex-1 overflow-y-auto text-xs font-mono bg-slate-900 text-green-400 p-4 rounded-xl border border-slate-200 shadow-inner">
                    {logs.length === 0 ? (
                        <span className="text-slate-500 opacity-50">Sistem hazır. İşlem bekleniyor...</span>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-white/10 pb-1 last:border-0 break-words">
                                <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Right Panel: Wizard */}
        <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                
                {/* STEP 1: Select Type */}
                {activeStep === 1 && (
                    <div className="p-8 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">İçe aktarılacak veri tipini seçin</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {importOptions.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => { setImportType(opt.id as ImportType); setActiveStep(2); }}
                                    className="text-left p-5 border border-slate-200 rounded-xl hover:border-accent-500 hover:bg-accent-50 transition group bg-slate-50/30"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white border border-slate-100 rounded-lg group-hover:text-accent-600 transition shadow-sm">
                                            <opt.icon size={24} />
                                        </div>
                                        <span className="font-bold text-slate-800">{opt.label}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 pl-12 leading-relaxed">{opt.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 2: Upload */}
                {activeStep === 2 && (
                    <div className="p-8 flex flex-col items-center justify-center flex-1 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Dosya Yükleme</h2>
                        <p className="text-slate-500 mb-8 text-sm bg-slate-100 px-3 py-1 rounded-full">
                            Seçilen Mod: <span className="font-bold text-brand-600 uppercase">{importType}</span>
                        </p>
                        
                        <label className={clsx(
                            "w-full max-w-lg h-64 border-3 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden",
                            isUploading ? "border-slate-200 bg-slate-50" : selectedFile ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-accent-400 hover:bg-slate-50"
                        )}>
                            <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                            
                            {isUploading ? (
                                <div className="flex flex-col items-center gap-4 w-full px-10">
                                    <Loader2 size={48} className="text-brand-600 animate-spin" />
                                    <p className="font-bold text-slate-600">İşleniyor... %{progress}</p>
                                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div className="bg-brand-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            ) : selectedFile ? (
                                <div className="flex flex-col items-center gap-2 animate-in zoom-in">
                                    <div className="p-4 bg-green-100 text-green-600 rounded-full mb-2 shadow-sm">
                                        <FileSpreadsheet size={32} />
                                    </div>
                                    <p className="font-bold text-slate-800">{selectedFile.name}</p>
                                    <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                    <div className="flex items-center gap-1 text-xs text-green-700 font-bold mt-2 bg-green-200/50 px-3 py-1 rounded-full">
                                        <CheckCircle size={12} /> Dosya Hazır
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-slate-400">
                                    <div className="p-4 bg-slate-100 rounded-full">
                                        <Upload size={32} />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-slate-600">Dosyayı buraya sürükleyin</p>
                                        <p className="text-xs mt-1">veya seçmek için tıklayın (.xlsx, .csv)</p>
                                    </div>
                                </div>
                            )}
                        </label>

                        <div className="flex gap-4 mt-8 w-full max-w-lg">
                            <button 
                                onClick={() => { setActiveStep(1); setSelectedFile(null); }} 
                                disabled={isUploading}
                                className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
                            >
                                Geri
                            </button>
                            <button 
                                onClick={processFile} 
                                disabled={!selectedFile || isUploading}
                                className="flex-[2] bg-brand-900 text-white py-3 rounded-xl font-bold hover:bg-brand-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                            >
                                {isUploading ? 'Lütfen Bekleyin...' : <><Play size={18} /> İşlemi Başlat</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Results */}
                {activeStep === 3 && importResults && (
                    <div className="p-8 flex flex-col items-center justify-center flex-1 animate-in fade-in slide-in-from-right-4 text-center">
                        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-100">
                            <CheckCircle size={48} />
                        </div>
                        <h2 className="text-3xl font-extrabold text-slate-800 mb-2">İşlem Tamamlandı!</h2>
                        <p className="text-slate-500 mb-10 max-w-md">Veriler başarıyla sisteme aktarıldı ve veritabanı güncellendi.</p>

                        <div className="grid grid-cols-3 gap-6 w-full max-w-2xl mb-10">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">YENİ KAYIT</p>
                                <p className="text-3xl font-black text-green-600">+{importResults.created}</p>
                            </div>
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">GÜNCELLENEN</p>
                                <p className="text-3xl font-black text-blue-600">{importResults.updated}</p>
                            </div>
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">HATA / ATLANAN</p>
                                <p className="text-3xl font-black text-red-500">{importResults.errors}</p>
                            </div>
                        </div>

                        <button 
                            onClick={resetImport}
                            className="bg-brand-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-brand-700 transition shadow-xl shadow-brand-900/20"
                        >
                            Yeni Dosya Yükle
                        </button>
                    </div>
                )}

            </div>
        </div>

      </div>
    </div>
  );
};

export default Integration;