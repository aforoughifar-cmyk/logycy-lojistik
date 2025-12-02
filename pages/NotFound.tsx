import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-slate-100">
        <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-4xl font-extrabold text-brand-900 mb-2">404</h1>
        <h2 className="text-xl font-bold text-slate-700 mb-4">Sayfa Bulunamadı</h2>
        <p className="text-slate-500 mb-8">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir. Lütfen adresi kontrol ediniz.
        </p>
        <Link 
          to="/dashboard" 
          className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center gap-2 w-full"
        >
          <ArrowLeft size={20} /> Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
};

export default NotFound;