
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Truck, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await supabaseService.signIn(email, password);
    
    if (result.error) {
      setError(result.error === 'Invalid login credentials' ? 'Kullanıcı adı veya şifre hatalı!' : result.error);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Animated Shapes - Softened for Light Theme */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
         <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-accent-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="bg-white w-full max-w-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden relative z-10 animate-slide-up border border-slate-200">
        <div className="p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-brand-800 to-brand-900 p-4 rounded-2xl mb-6 shadow-lg transform rotate-3">
              <Truck size={40} className="text-accent-400" />
            </div>
            <h1 className="text-4xl font-extrabold text-brand-900 tracking-tight mb-2">LOGYCY</h1>
            <p className="text-slate-600 font-bold">Lojistik Yönetim Paneli</p>
            <p className="text-accent-600 text-xs font-black uppercase tracking-widest mt-2">Kuzey Kıbrıs Operasyon Merkezi</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-shake">
                <AlertCircle size={18} className="flex-shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">E-Posta Adresi</label>
              <div className="relative group">
                <User className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-bold"
                  placeholder="name@logycy.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Şifre</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-bold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-900 hover:bg-brand-800 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-brand-900/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-lg mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Sisteme Giriş Yap'}
            </button>
          </form>

          <div className="mt-10 text-center">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                &copy; 2025 Logycy Logistics System
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
