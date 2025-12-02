
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Send, X, MessageSquare, Bot, User, Loader2, Copy, Check } from 'lucide-react';
import clsx from 'clsx';

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'Merhaba! Ben Logycy Genius. Lojistik operasyonlarınızda, e-posta taslaklarınızda veya hesaplamalarınızda size nasıl yardımcı olabilirim?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      // Initialize Gemini
      // NOTE: In a real production app, ensure API_KEY is set in your environment variables.
      // For this demo, we assume process.env.API_KEY is available as per instructions.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemInstruction = `You are "Logycy Genius", an expert AI assistant for a logistics company based in Northern Cyprus (KKTC). 
      Your tone is professional, helpful, and concise.
      You are an expert in:
      1. Freight forwarding (Sea, Air, Road).
      2. Customs regulations (especially Turkey and Cyprus).
      3. Writing professional business emails (in Turkish and English).
      4. Analyzing shipment data.
      
      Always answer in the language the user asked (mostly Turkish).
      If asked about specific data that you don't have access to, politely explain that you can answer general questions or draft templates, but don't have direct database access yet.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), // History
            { role: 'user', parts: [{ text: userMessage }] } // New Message
        ],
        config: {
            systemInstruction: systemInstruction,
        }
      });

      const text = response.text;
      if (text) {
        setMessages(prev => [...prev, { role: 'model', text: text }]);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Üzgünüm, şu anda bağlantı kuramıyorum. Lütfen API anahtarını kontrol edin veya daha sonra tekrar deneyin.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "fixed bottom-6 right-6 z-[60] p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center group print:hidden",
          isOpen ? "bg-red-500 hover:bg-red-600 rotate-90" : "bg-gradient-to-r from-brand-800 to-brand-900 hover:scale-110"
        )}
      >
        {isOpen ? <X size={28} className="text-white" /> : <Sparkles size={28} className="text-accent-400 animate-pulse-slow" />}
      </button>

      {/* Chat Window */}
      <div 
        className={clsx(
          "fixed bottom-24 right-6 z-[60] w-[90vw] max-w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 origin-bottom-right flex flex-col print:hidden",
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-10 pointer-events-none"
        )}
        style={{ height: '600px', maxHeight: '75vh' }}
      >
        {/* Header */}
        <div className="bg-brand-900 p-4 flex items-center gap-3 border-b border-brand-800">
          <div className="bg-white/10 p-2 rounded-lg">
            <Bot size={24} className="text-accent-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Logycy Genius</h3>
            <p className="text-brand-200 text-xs flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online • Gemini 2.5 Flash
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
          {messages.map((msg, idx) => (
            <div key={idx} className={clsx("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                msg.role === 'user' ? "bg-slate-200" : "bg-accent-100"
              )}>
                {msg.role === 'user' ? <User size={16} className="text-slate-600"/> : <Sparkles size={16} className="text-accent-600"/>}
              </div>
              
              <div className={clsx(
                "max-w-[80%] p-3 rounded-2xl text-sm relative group",
                msg.role === 'user' 
                  ? "bg-brand-600 text-white rounded-tr-none" 
                  : "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
              )}>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                
                {/* Copy Button for Model Messages */}
                {msg.role === 'model' && (
                  <button 
                    onClick={() => copyToClipboard(msg.text, idx)}
                    className="absolute -right-8 top-0 p-1.5 text-slate-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition"
                    title="Kopyala"
                  >
                    {copiedIndex === idx ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
               <div className="w-8 h-8 bg-accent-100 rounded-full flex items-center justify-center"><Sparkles size={16} className="text-accent-600"/></div>
               <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-brand-600" />
                  <span className="text-xs text-slate-500 font-medium">Yazıyor...</span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              placeholder="Bir şeyler sorun..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 p-1.5 bg-brand-900 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50 disabled:hover:bg-brand-900"
            >
              <Send size={16} />
            </button>
          </form>
          <div className="mt-2 flex justify-center gap-2">
             {['E-posta Taslağı', 'Lojistik Terimi', 'Hesaplama'].map(tag => (
                <button 
                  key={tag} 
                  onClick={() => setInput(tag + ': ')}
                  className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full hover:bg-slate-200 transition border border-slate-200"
                >
                  {tag}
                </button>
             ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default AIAssistant;
