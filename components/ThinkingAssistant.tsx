import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiX, FiCpu, FiMessageSquare } from 'react-icons/fi';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ThinkingAssistant({ isOpen, onClose, isNight }: { isOpen: boolean, onClose: () => void, isNight: boolean }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsThinking(true);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userMsg,
        config: {
          systemInstruction: "Sei l'assistente virtuale avanzato di DriveOS, un sistema di bordo per veicoli elettrici di lusso. Sei esperto in meccanica, elettronica, pianificazione viaggi e intrattenimento. Rispondi in modo professionale, conciso ma estremamente intelligente. Se la domanda è complessa, usa le tue capacità di ragionamento profondo.",
          thinkingConfig: { thinkingBudget: 32768 }
        },
      });

      const aiText = response.text || "Mi scuso, si è verificato un errore nel mio modulo di ragionamento.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (err) {
      console.error("AI Error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sistema AI momentaneamente offline. Riprova tra poco." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const theme = {
    bg: isNight ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-black/10',
    text: isNight ? 'text-white' : 'text-zinc-900',
    bubbleUser: isNight ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white',
    bubbleAi: isNight ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-100 text-zinc-800'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`fixed right-6 bottom-24 w-96 h-[500px] z-[9000] flex flex-col rounded-3xl border shadow-2xl backdrop-blur-3xl overflow-hidden ${theme.bg}`}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isNight ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500 text-white'}`}>
                <FiCpu className={isThinking ? 'animate-pulse' : ''} />
              </div>
              <h3 className={`font-bold tracking-tight ${theme.text}`}>DriveOS Intelligence</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <FiX className={theme.text} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-grow p-4 overflow-y-auto space-y-4 hide-scrollbar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-6">
                <FiMessageSquare size={48} className="mb-4" />
                <p className={theme.text}>Chiedimi qualunque cosa sulla tua auto o sul tuo viaggio. Sono in modalità "Deep Thinking".</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? theme.bubbleUser : theme.bubbleAi}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className={`p-3 rounded-2xl flex items-center gap-3 ${theme.bubbleAi}`}>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          <footer className="p-4 border-t border-white/10 bg-white/5">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Fai una domanda complessa..."
                className={`w-full py-3 pl-4 pr-12 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isNight ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-zinc-100 border-zinc-200 text-zinc-900'}`}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-400 transition-colors"
              >
                <FiSend size={20} />
              </button>
            </form>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}