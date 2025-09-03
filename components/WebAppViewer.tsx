


import React from 'react';
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';

interface WebAppViewerProps {
    url: string;
    onClose: () => void;
}

// FIX: The 'Variants' type from framer-motion can be overly strict. Removing the explicit type annotation allows TypeScript to infer a compatible type, resolving the error.
const webAppVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const WebAppViewer: React.FC<WebAppViewerProps> = ({ url, onClose }) => {
    return (
        <motion.div
            variants={webAppVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black z-[9999] flex flex-col"
            role="dialog"
            aria-modal="true"
        >
            <div className="flex-shrink-0 p-2 bg-black/50 flex items-center justify-between opacity-50 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
                 <button
                    onClick={onClose}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Close web app"
                >
                    <FiX size={24} />
                </button>
                {/* Fullscreen button removed as window controls are preferred in Electron */}
            </div>
            {/* 
              Use the <webview> tag instead of <iframe>. 
              This tag is specific to Electron and allows us to bypass security restrictions 
              like X-Frame-Options when configured correctly in main.js.
            */}
            <webview
                src={url}
                className="w-full h-full border-none flex-grow"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
                // Add partition and webpreferences for compatibility
                partition="persist:default"
                webpreferences="allowRunningInsecureContent, javascript=yes"
            />
        </motion.div>
    );
};

export default WebAppViewer;