
import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiArrowLeft, FiArrowRight, FiRefreshCw, FiSearch, FiAlertTriangle } from 'react-icons/fi';

interface WebAppViewerProps {
    url: string;
    onClose: () => void;
}

const WebAppViewer: React.FC<WebAppViewerProps> = ({ url: initialUrl, onClose }) => {
    const [webview, setWebview] = useState<HTMLWebViewElement | null>(null);
    const [isElectron, setIsElectron] = useState(true);

    const webviewRef = useCallback((node: HTMLWebViewElement | null) => {
        if (node) {
            setWebview(node);
            // Check if it's a real Electron webview by checking for a method unique to it
            if (typeof node.loadURL !== 'function') {
                setIsElectron(false);
            }
        }
    }, []);

    const [inputValue, setInputValue] = useState(initialUrl);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const isURL = (str: string) => {
        try {
            return new URL(str).protocol.startsWith('http') || (str.includes('.') && !str.includes(' '));
        } catch (_) {
            return false;
        }
    };

    const handleNavigate = () => {
        if (!webview) return;
        let urlToLoad = inputValue.trim();
        if (!urlToLoad) return;
        
        if (isURL(urlToLoad)) {
             if (!urlToLoad.startsWith('http')) {
                urlToLoad = `https://${urlToLoad}`;
            }
        } else {
            urlToLoad = `https://www.google.com/search?q=${encodeURIComponent(urlToLoad)}`;
        }
        
        if (typeof webview.loadURL === 'function') {
            webview.loadURL(urlToLoad);
        } else {
            // Fallback for non-Electron or when method is missing
            webview.src = urlToLoad;
        }
    };

    useEffect(() => {
        if (!webview || !isElectron) return;
        
        const handleDidStartLoading = () => setIsLoading(true);
        const handleDidStopLoading = () => setIsLoading(false);
        const handleDomReady = () => {
            if (typeof webview.canGoBack === 'function') setCanGoBack(webview.canGoBack());
            if (typeof webview.canGoForward === 'function') setCanGoForward(webview.canGoForward());
        };
        const handleDidNavigate = (e: any) => {
            setInputValue(e.url);
            if (typeof webview.canGoBack === 'function') setCanGoBack(webview.canGoBack());
            if (typeof webview.canGoForward === 'function') setCanGoForward(webview.canGoForward());
        };
        const handleNewWindow = (e: any) => { 
             if (typeof webview.loadURL === 'function') webview.loadURL(e.url);
             else webview.src = e.url;
        };
        
        // Add event listeners only if they exist on the element (Electron webview)
        webview.addEventListener('dom-ready', handleDomReady);
        webview.addEventListener('did-start-loading', handleDidStartLoading);
        webview.addEventListener('did-stop-loading', handleDidStopLoading);
        webview.addEventListener('did-navigate', handleDidNavigate);
        webview.addEventListener('new-window', handleNewWindow);

        return () => {
            webview.removeEventListener('dom-ready', handleDomReady);
            webview.removeEventListener('did-start-loading', handleDidStartLoading);
            webview.removeEventListener('did-stop-loading', handleDidStopLoading);
            webview.removeEventListener('did-navigate', handleDidNavigate);
            webview.removeEventListener('new-window', handleNewWindow);
        };
    }, [webview, isElectron]);

    const handleGoBack = () => {
        if (webview && typeof webview.goBack === 'function') webview.goBack();
    };
    const handleGoForward = () => {
        if (webview && typeof webview.goForward === 'function') webview.goForward();
    };
    const handleRefresh = () => {
        if (webview && typeof webview.reload === 'function') webview.reload();
        else if (webview) webview.src = webview.src; // Fallback
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleNavigate();
    };

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black z-[10000] flex flex-col"
            role="dialog"
            aria-modal="true"
        >
            <div className="flex-shrink-0 p-2 bg-zinc-900 border-b border-zinc-700 flex items-center gap-2">
                <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors" aria-label="Close"><FiX size={20} /></button>
                <button onClick={handleGoBack} disabled={!canGoBack} className="p-2 text-white/70 hover:text-white disabled:text-white/30 disabled:hover:bg-transparent hover:bg-white/10 rounded-full transition-colors" aria-label="Back"><FiArrowLeft size={20} /></button>
                <button onClick={handleGoForward} disabled={!canGoForward} className="p-2 text-white/70 hover:text-white disabled:text-white/30 disabled:hover:bg-transparent hover:bg-white/10 rounded-full transition-colors" aria-label="Forward"><FiArrowRight size={20} /></button>
                <button onClick={handleRefresh} disabled={isLoading && isElectron} className="p-2 text-white/70 hover:text-white disabled:text-white/30 disabled:hover:bg-transparent hover:bg-white/10 rounded-full transition-colors" aria-label="Refresh">
                    {isLoading && isElectron ? <div className="w-5 h-5 rounded-full loading-spinner-border" /> : <FiRefreshCw size={20} />}
                </button>
                <form onSubmit={handleFormSubmit} className="flex-grow relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-zinc-800 text-white rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Search or enter website name"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white" aria-label="Go">
                        <FiSearch size={18} />
                    </button>
                </form>
            </div>
            
            <div className="relative flex-grow w-full h-full bg-zinc-900">
                {!isElectron && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10 pointer-events-none">
                        <FiAlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Ambiente Browser Rilevato</h3>
                        <p className="text-zinc-400 max-w-md">
                            Questa funzionalità richiede l'esecuzione in <strong>Electron</strong> per caricare siti esterni come Netflix o YouTube in modo sicuro e performante.
                        </p>
                        <p className="mt-4 text-xs text-zinc-500">I controlli potrebbero non funzionare correttamente qui.</p>
                    </div>
                )}
                
                <webview
                    ref={webviewRef}
                    src={initialUrl}
                    className="w-full h-full border-none"
                    useragent={userAgent}
                    partition="persist:theater"
                    allowpopups="true"
                    plugins="true"
                />
            </div>
        </motion.div>
    );
};

export default WebAppViewer;
