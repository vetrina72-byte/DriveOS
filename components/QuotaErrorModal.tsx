import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SpinningRecord = ({ isNight }: { isNight: boolean }) => (
    <div className="relative w-36 h-36 my-6">
        {/* Tonearm */}
        <div 
            className="absolute -top-4 right-1 w-2 h-24 bg-zinc-400 rounded-full z-10"
            style={{ transform: 'rotate(25deg)', transformOrigin: '90% 90%' }}
        >
            <div className="absolute -left-1 -top-1 w-4 h-4 bg-zinc-300 rounded-full"></div>
        </div>
        {/* Record */}
        <div 
            className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center animate-spin border-4 border-zinc-700"
            style={{ animationDuration: '4s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }}
        >
            <div className={`w-1/3 h-1/3 rounded-full flex items-center justify-center ${isNight ? 'bg-red-800' : 'bg-red-400'}`}>
                <div className="w-3 h-3 rounded-full bg-zinc-900"></div>
            </div>
            {/* Grooves */}
            <div className="absolute inset-2 border-2 border-zinc-700/50 rounded-full"></div>
            <div className="absolute inset-5 border border-zinc-700/50 rounded-full"></div>
            <div className="absolute inset-10 border border-zinc-700/50 rounded-full"></div>
        </div>
    </div>
);


interface QuotaErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    isNight: boolean;
}

const QuotaErrorModal: React.FC<QuotaErrorModalProps> = ({ isOpen, onClose, isNight }) => {
    const theme = {
        bg: isNight ? 'bg-zinc-800' : 'bg-gray-100',
        textPrimary: isNight ? 'text-zinc-100' : 'text-zinc-800',
        textSecondary: isNight ? 'text-zinc-400' : 'text-zinc-500',
        border: isNight ? 'border-zinc-700' : 'border-gray-200',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                    onClick={onClose} // Allow closing by clicking backdrop
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className={`w-full max-w-sm p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-2 text-center border ${theme.bg} ${theme.border}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <SpinningRecord isNight={isNight} />
                        <h2 className={`text-2xl font-bold ${theme.textPrimary}`}>Ci stiamo prendendo una pausa 🎶</h2>
                        <p className={theme.textSecondary}>
                            Torneremo presto! L'app tenterà di riconnettersi automaticamente.
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default QuotaErrorModal;
