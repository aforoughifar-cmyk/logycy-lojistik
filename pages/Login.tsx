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
    <div className="min-h-screen bg-brand-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Animated Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
         <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-accent-500/20 rounded-full blur-[120px] animate-pulse-slow"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-600/30 rounded-full blur-[120px] animate-float" style={{ animationDelay: '1s' }}></div>
         <div className="absolute top-[40%] left-[20%] w-[200px] h-[200px] bg-blue-500/20 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-slide-up">
        <div className="p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-accent-400 to-accent-600 p-4 rounded-2xl mb-6 shadow-lg shadow-accent-500/20 transform rotate-3">
              <Truck size={40} className="text-brand-900" />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">LOGYCY</h1>
            <p className="text-slate-400 font-medium">Lojistik Yönetim Paneli</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 text-sm animate-shake">
                <AlertCircle size={18} className="flex-shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">E-Posta</label>
              <div className="relative group">
                <User className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-accent-500 transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:bg-white/10 transition-all font-medium"
                  placeholder="user@logycy.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">Şifre</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-accent-500 transition-colors" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:bg-white/10 transition-all font-medium"
                  placeholder="•••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-500 to-accent-400 hover:from-accent-400 hover:to-accent-300 text-brand-950 font-bold py-4 rounded-xl transition-all shadow-lg shadow-accent-500/20 hover:shadow-accent-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-lg mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Giriş Yap'}
            </button>
          </form>

          <div className="mt-10 text-center">
             <p className="text-xs text-slate-500 opacity-60">
                &copy; 2025 Logycy Logistics. Secure Enterprise System.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;