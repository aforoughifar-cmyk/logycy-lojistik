import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ArrowRight, ShieldCheck, Globe2, Clock, Truck, Menu, X, Phone, Mail, MapPin } from 'lucide-react';

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
    <div className="flex flex-col min-h-screen font-sans">
      
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
              <a href="#" className="text-slate-200 hover:text-white font-medium transition">Hizmetlerimiz</a>
              <a href="#" className="text-slate-200 hover:text-white font-medium transition">Kurumsal</a>
              <a href="#" className="text-slate-200 hover:text-white font-medium transition">İletişim</a>
              <Link 
                to="/login" 
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-5 py-2.5 rounded-lg font-bold border border-white/20 transition flex items-center gap-2"
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
      <section className="relative bg-brand-900 text-white pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-brand-600 opacity-20 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] rounded-full bg-blue-500 opacity-20 blur-[100px]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:w-2/3">
            <div className="inline-block px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 font-bold text-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              🚀 KKTC'nin Lojistik Üssü
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700">
              Kıbrıs'tan Dünyaya <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-amber-200">Sınır Tanımayan</span> Lojistik
            </h1>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              Logycy ile gönderileriniz güvenle taşınır. Modern teknoloji ve profesyonel ekibimizle işletmenizin gücüne güç katıyoruz.
            </p>

            {/* Quick Tracking Box */}
            <div className="bg-white/5 backdrop-blur-xl p-3 rounded-2xl max-w-lg border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-4 border-none rounded-xl bg-brand-950/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 font-medium"
                    placeholder="Takip No (Örn: LOG-2025...)"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-accent-500 hover:bg-accent-400 text-brand-900 px-8 py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-accent-500/20"
                >
                  Sorgula <ArrowRight size={18} />
                </button>
              </form>
            </div>
            
            <div className="mt-8 flex items-center gap-6 text-sm text-slate-400 animate-in fade-in duration-1000 delay-300">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> 7/24 Online Takip</span>
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Sigortalı Taşıma</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-brand-600 font-bold tracking-widest uppercase text-sm mb-3">Hizmetlerimiz</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-brand-900">Lojistikte Güvenin Adresi</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 border border-slate-100 group">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <Globe2 size={32} />
              </div>
              <h4 className="text-xl font-bold text-brand-900 mb-3">Uluslararası Ağ</h4>
              <p className="text-slate-500 leading-relaxed">
                Türkiye, Avrupa ve Asya başta olmak üzere dünyanın dört bir yanına entegre lojistik çözümleri sunuyoruz.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 border border-slate-100 group">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
                <ShieldCheck size={32} />
              </div>
              <h4 className="text-xl font-bold text-brand-900 mb-3">%100 Güvenli Taşıma</h4>
              <p className="text-slate-500 leading-relaxed">
                Gönderileriniz sigorta kapsamında. Hasarsız ve eksiksiz teslimat garantisi ile içiniz rahat olsun.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 border border-slate-100 group">
              <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300">
                <Clock size={32} />
              </div>
              <h4 className="text-xl font-bold text-brand-900 mb-3">Hızlı Teslimat</h4>
              <p className="text-slate-500 leading-relaxed">
                Optimize edilmiş rotalar ve gümrük süreçleri ile kargolarınız tam zamanında alıcısına ulaşır.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-brand-900 py-20 relative overflow-hidden">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
               <div>
                  <div className="text-4xl md:text-5xl font-extrabold text-accent-500 mb-2">10+</div>
                  <div className="text-slate-400 font-medium">Yıllık Tecrübe</div>
               </div>
               <div>
                  <div className="text-4xl md:text-5xl font-extrabold text-accent-500 mb-2">50k+</div>
                  <div className="text-slate-400 font-medium">Başarılı Teslimat</div>
               </div>
               <div>
                  <div className="text-4xl md:text-5xl font-extrabold text-accent-500 mb-2">100+</div>
                  <div className="text-slate-400 font-medium">Ülkeye Erişim</div>
               </div>
               <div>
                  <div className="text-4xl md:text-5xl font-extrabold text-accent-500 mb-2">24/7</div>
                  <div className="text-slate-400 font-medium">Canlı Destek</div>
               </div>
            </div>
         </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-brand-900 to-brand-800 rounded-[2.5rem] p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500 rounded-full blur-[120px] opacity-20 -mr-20 -mt-20"></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">İşletmeniz için özel teklif alın</h2>
              <p className="text-brand-100 max-w-xl text-lg leading-relaxed">
                Düzenli gönderileriniz için kurumsal çözümlerimizle tanışın. Size özel fiyatlandırma ve operasyon yönetimi ile maliyetlerinizi düşürün.
              </p>
            </div>
            <button className="relative z-10 bg-white text-brand-900 px-10 py-5 rounded-2xl font-bold hover:bg-slate-100 transition shadow-lg whitespace-nowrap text-lg">
              Hemen İletişime Geç
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-8">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
               <div className="space-y-4">
                  <div className="flex items-center gap-2 font-bold text-2xl text-brand-900">
                     <div className="bg-accent-500 p-1.5 rounded shadow-sm">
                        <Truck size={18} className="text-brand-900" />
                     </div>
                     LOGYCY
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">
                     Kuzey Kıbrıs'ın lider lojistik çözümleri. Güven, hız ve teknoloji odaklı taşımacılık.
                  </p>
               </div>
               
               <div>
                  <h4 className="font-bold text-brand-900 mb-4">Hızlı Erişim</h4>
                  <ul className="space-y-2 text-sm text-slate-500">
                     <li><a href="#" className="hover:text-accent-600 transition">Ana Sayfa</a></li>
                     <li><a href="#" className="hover:text-accent-600 transition">Hakkımızda</a></li>
                     <li><a href="#" className="hover:text-accent-600 transition">Hizmetler</a></li>
                     <li><Link to="/tracking" className="hover:text-accent-600 transition">Kargo Takip</Link></li>
                  </ul>
               </div>

               <div>
                  <h4 className="font-bold text-brand-900 mb-4">Yasal</h4>
                  <ul className="space-y-2 text-sm text-slate-500">
                     <li><a href="#" className="hover:text-accent-600 transition">Gizlilik Politikası</a></li>
                     <li><a href="#" className="hover:text-accent-600 transition">Kullanım Koşulları</a></li>
                     <li><a href="#" className="hover:text-accent-600 transition">Çerez Politikası</a></li>
                  </ul>
               </div>

               <div>
                  <h4 className="font-bold text-brand-900 mb-4">İletişim</h4>
                  <ul className="space-y-3 text-sm text-slate-500">
                     <li className="flex items-start gap-3">
                        <MapPin size={18} className="text-accent-500 mt-0.5" />
                        <span>Gazimağusa Serbest Liman Bölgesi,<br/>No: 12, KKTC</span>
                     </li>
                     <li className="flex items-center gap-3">
                        <Phone size={18} className="text-accent-500" />
                        <span>+90 533 000 00 00</span>
                     </li>
                     <li className="flex items-center gap-3">
                        <Mail size={18} className="text-accent-500" />
                        <span>info@logycy.com</span>
                     </li>
                  </ul>
               </div>
            </div>
            
            <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
               <p>&copy; 2025 Logycy Logistics Ltd. Tüm hakları saklıdır.</p>
               <p>Designed for Excellence.</p>
            </div>
         </div>
      </footer>

    </div>
  );
};

export default Home;