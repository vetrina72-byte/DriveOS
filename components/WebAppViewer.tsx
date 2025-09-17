import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';

interface WebAppViewerProps {
    url: string;
    onClose: () => void;
}

const WebAppViewer: React.FC<WebAppViewerProps> = ({ url, onClose }) => {
    // Azione 1: Verifica l'URL passato, come suggerito nella checklist di diagnosi.
    console.log("Tentativo di caricare questo URL nella WebView:", url);

    const webviewRef = useRef<HTMLWebViewElement>(null);

    // Azione 2: Implementa il "Debug Remoto" aggiungendo controlli per i DevTools.
    useEffect(() => {
        const webview = webviewRef.current;
        if (webview) {
            const handleLoadFail = (e: any) => {
                console.error("WebView ha fallito il caricamento:", {
                    errorCode: e.errorCode,
                    errorDescription: e.errorDescription,
                    url: e.validatedURL
                });
                // Apre automaticamente i DevTools in caso di errore per un debug immediato.
                if (!webview.isDevToolsOpened()) {
                    webview.openDevTools();
                }
            };
            
            const handleDomReady = () => {
                console.log("WebView DOM pronto. Aggiungo listener per i messaggi console.");
                webview.addEventListener('console-message', (e: any) => {
                    // Stampa i log interni della webview nella console principale.
                    const sourceFile = e.sourceId.split('/').pop();
                    console.log(`[WebView Console] ${sourceFile}:${e.line} - ${e.message}`);
                });

                // Trova la barra superiore per aggiungere un'azione di debug.
                const topBar = webview.parentElement?.querySelector('.flex-shrink-0');
                const handleDoubleClick = () => {
                    if (webview.isDevToolsOpened()) {
                        webview.closeDevTools();
                    } else {
                        webview.openDevTools();
                    }
                };
                
                if (topBar) {
                    topBar.addEventListener('dblclick', handleDoubleClick);
                    console.log("%c[Suggerimento Debug] Fai doppio clic sulla barra nera in alto per aprire/chiudere i DevTools per questa WebView.", "color: yellow; font-weight: bold;");
                }
            };

            webview.addEventListener('did-fail-load', handleLoadFail);
            webview.addEventListener('dom-ready', handleDomReady);

            return () => {
                webview.removeEventListener('did-fail-load', handleLoadFail);
                webview.removeEventListener('dom-ready', handleDomReady);
            };
        }
    }, [url]);


    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black z-[9999] flex flex-col"
            role="dialog"
            aria-modal="true"
        >
            <div className="flex-shrink-0 p-2 bg-black/50 flex items-center justify-between opacity-50 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300" title="Doppio clic per DevTools">
                 <button
                    onClick={onClose}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Close web app"
                >
                    <FiX size={24} />
                </button>
            </div>
            <webview
                ref={webviewRef}
                src={url}
                className="w-full h-full border-none flex-grow bg-black"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
                partition="persist:default"
                webpreferences="allowRunningInsecureContent, javascript=yes"
            />
        </motion.div>
    );
};

export default WebAppViewer;
