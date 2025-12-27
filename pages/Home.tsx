import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ArrowRight, ShieldCheck, Globe2, Clock, Truck, Menu, X, Phone, Mail, MapPin, Anchor, Plane, Package } from 'lucide-react';

const Home: React.FC = () => {
  const [trackingInput, setTrackingInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingInput.trim()) {
      navigate(`/tracking?id=${trackingInput.trim()}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-slate-50">
      
      {/* Navbar */}
      <nav className="absolute top-0 left-0 right-0 z-50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3 font-bold text-2xl tracking-wider text-white">
              <div className="bg-accent-500 p-2 rounded-lg shadow-lg shadow-accent-500/20">
                <Truck size={22} className="text-brand-900" />
              </div>
              LOGYCY
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#" className="text-slate-200 hover:text-white font-medium transition text-sm">Hizmetlerimiz</a>
              <a href="#" className="text-slate-200 hover:text-white font-medium transition text-sm">Gümrük & Mevzuat</a>
              <a href="#" className="text-slate-200 hover:text-white font-medium transition text-sm">İletişim</a>
              <Link 
                to="/login" 
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-5 py-2.5 rounded-lg font-bold border border-white/20 transition flex items-center gap-2 text-sm"
              >
                Personel Girişi <ArrowRight size={16} />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-white p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-brand-900 border-t border-white/10 p-4 md:hidden shadow-xl animate-in slide-in-from-top-5">
            <div className="flex flex-col gap-4">
              <a href="#" className="text-slate-300 hover:text-white py-2">Hizmetlerimiz</a>
              <a href="#" className="text-slate-300 hover:text-white py-2">Kurumsal</a>
              <a href="#" className="text-slate-300 hover:text-white py-2">İletişim</a>
              <Link to="/login" className="bg-accent-500 text-brand-900 px-4 py-3 rounded-lg font-bold text-center">
                Personel Girişi
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative bg-brand-900 text-white pt-32 pb-24 lg:pt-48 lg:pb-40 overflow-hidden">
        {/* Map Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-no-repeat bg-center opacity-5 bg-fixed" style={{backgroundSize: '150%'}}></div>
        
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-brand-600 opacity-20 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] rounded-full bg-blue-500 opacity-20 blur-[100px]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 font-bold text-xs mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></span>
                KKTC'nin Lojistik Üssü
              </div>
              <h1 className="text-5xl lg:text-7xl font-black mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 tracking-tight">
                Dünyadan <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-amber-200">Kıbrıs'a</span><br/>
                Güvenli Rota
              </h1>
              <p className="text-lg text-slate-300 mb-10 max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 leading-relaxed">
                Mağusa Limanı, Girne ve Ercan Havalimanı bağlantılı global taşımacılık çözümleri. Gümrükleme, depolama ve dağıtımda tam entegre hizmet.
              </p>

              {/* Quick Tracking Box */}
              <div className="bg-white/10 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200 max-w-md">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-11 pr-4 py-3.5 border-none rounded-xl bg-brand-950/80 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 font-medium text-sm"
                      placeholder="Kargo Takip No (Örn: LOG-TR...)"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="bg-accent-500 hover:bg-accent-400 text-brand-900 px-6 rounded-xl font-bold transition flex items-center gap-2 shadow-lg"
                  >
                    <ArrowRight size={20} />
                  </button>
                </form>
              </div>
              
              <div className="mt-8 flex items-center gap-6 text-xs font-medium text-slate-400 animate-in fade-in duration-1000 delay-300">
                 <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Online Takip</span>
                 <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Gümrük Desteği</span>
                 <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> Kapıdan Kapıya</span>
              </div>
            </div>

            {/* Hero Visual - Simulated Dashboard Graphic */}
            <div className="lg:w-1/2 relative hidden lg:block animate-in fade-in slide-in-from-right-10 duration-1000">
                <div className="relative z-10 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl rotate-3 hover:rotate-0 transition duration-500">
                    <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center text-brand-900 font-bold"><Truck/></div>
                            <div>
                                <div className="h-2 w-24 bg-slate-600 rounded mb-1"></div>
                                <div className="h-2 w-16 bg-slate-700 rounded"></div>
                            </div>
                        </div>
                        <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-xs font-bold">AKTİF SEVKİYAT</div>
                    </div>
                    <div className="space-y-4">
                        {[1,2,3].map(i => (
                            <div key={i} className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400"><Globe2 size={16}/></div>
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <div className="h-2 w-20 bg-slate-600 rounded"></div>
                                        <div className="h-2 w-8 bg-slate-600 rounded"></div>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-accent-500" style={{width: `${i*30}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Decorative dots */}
                <div className="absolute -bottom-10 -left-10 grid grid-cols-6 gap-2 opacity-20">
                    {Array(24).fill(0).map((_,i) => <div key={i} className="w-1 h-1 bg-white rounded-full"></div>)}
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-brand-600 font-bold tracking-widest uppercase text-xs mb-3">Hizmetlerimiz</h2>
            <h3 className="text-3xl font-black text-brand-900">Kıbrıs Odaklı Çözümler</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Anchor size={28} />
              </div>
              <h4 className="text-lg font-bold text-brand-900 mb-3">Deniz Yolu Taşımacılığı</h4>
              <p className="text-slate-500 text-sm leading-relaxed">
                Mersin ve Avrupa limanlarından Gazimağusa Limanı'na düzenli parsiyel ve komple konteyner seferleri.
              </p>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group">
              <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Plane size={28} />
              </div>
              <h4 className="text-lg font-bold text-brand-900 mb-3">Hava Kargo</h4>
              <p className="text-slate-500 text-sm leading-relaxed">
                Ercan Havalimanı varışlı acil gönderileriniz için global acente ağımızla hızlı ve güvenli teslimat.
              </p>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group">
              <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Package size={28} />
              </div>
              <h4 className="text-lg font-bold text-brand-900 mb-3">Gümrük & İç Dağıtım</h4>
              <p className="text-slate-500 text-sm leading-relaxed">
                KKTC gümrük mevzuatına hakim uzman kadro ile sorunsuz ithalat ve kapıya teslim dağıtım hizmeti.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-brand-900 py-16 border-t border-white/5">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-white/10">
               <div>
                  <div className="text-4xl font-black text-white mb-1">15+</div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Yıllık Tecrübe</div>
               </div>
               <div>
                  <div className="text-4xl font-black text-white mb-1">10k+</div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Mutlu Müşteri</div>
               </div>
               <div>
                  <div className="text-4xl font-black text-white mb-1">%99</div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Zamanında Teslim</div>
               </div>
               <div>
                  <div className="text-4xl font-black text-white mb-1">7/24</div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Canlı Destek</div>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 pt-16 pb-8">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
               <div className="space-y-4">
                  <div className="flex items-center gap-2 font-bold text-xl text-brand-900">
                     <div className="bg-accent-500 p-1.5 rounded shadow-sm">
                        <Truck size={16} className="text-brand-900" />
                     </div>
                     LOGYCY
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">
                     Kuzey Kıbrıs Türk Cumhuriyeti merkezli, teknoloji odaklı yeni nesil lojistik yönetimi.
                  </p>
               </div>
               
               <div>
                  <h4 className="font-bold text-brand-900 mb-4 text-sm">Hızlı Erişim</h4>
                  <ul className="space-y-2 text-xs text-slate-500">
                     <li><a href="#" className="hover:text-accent-600 transition">Ana Sayfa</a></li>
                     <li><a href="#" className="hover:text-accent-600 transition">Hakkımızda</a></li>
                     <li><a href="#" className="hover:text-accent-600 transition">Hizmetler</a></li>
                     <li><Link to="/tracking" className="hover:text-accent-600 transition">Kargo Takip</Link></li>
                  </ul>
               </div>

               <div>
                  <h4 className="font-bold text-brand-900 mb-4 text-sm">Kurumsal</h4>
                  <ul className="space-y-2 text-xs text-slate-500">
                     <li><a href="#" className="hover:text-accent-600 transition">Gizlilik Politikası</a></li>
                     <li><a href="#" className="hover:text-accent-600 transition">Kullanım Koşulları</a></li>
                     <li><Link to="/login" className="hover:text-accent-600 transition">Personel Girişi</Link></li>
                  </ul>
               </div>

               <div>
                  <h4 className="font-bold text-brand-900 mb-4 text-sm">Merkez Ofis</h4>
                  <ul className="space-y-3 text-xs text-slate-500">
                     <li className="flex items-start gap-3">
                        <MapPin size={16} className="text-accent-500 mt-0.5" />
                        <span>Eşref Bitlis Caddesi, Serbest Liman Yolu<br/>Gazimağusa, KKTC</span>
                     </li>
                     <li className="flex items-center gap-3">
                        <Phone size={16} className="text-accent-500" />
                        <span>+90 533 000 00 00</span>
                     </li>
                     <li className="flex items-center gap-3">
                        <Mail size={16} className="text-accent-500" />
                        <span>info@logycy.com</span>
                     </li>
                  </ul>
               </div>
            </div>
            
            <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-400">
               <p>&copy; 2025 Logycy Shipping Ltd. Tüm hakları saklıdır.</p>
               <p>Powered by Logycy Tech.</p>
            </div>
         </div>
      </footer>

    </div>
  );
};

export default Home;