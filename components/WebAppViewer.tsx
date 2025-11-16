import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiArrowLeft, FiArrowRight, FiRefreshCw, FiSearch } from 'react-icons/fi';

interface WebAppViewerProps {
    url: string;
    onClose: () => void;
}

const WebAppViewer: React.FC<WebAppViewerProps> = ({ url: initialUrl, onClose }) => {
    const [webview, setWebview] = useState<HTMLWebViewElement | null>(null);
    const webviewRef = useCallback((node: HTMLWebViewElement | null) => {
        if (node) {
            setWebview(node);
        }
    }, []);

    const [inputValue, setInputValue] = useState(initialUrl);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const isURL = (str: string) => {
        try {
            // A simple check, also allowing domain names without protocol
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
        
        webview.loadURL(urlToLoad);
    };

    useEffect(() => {
        if (!webview) return;
        
        const handleDidStartLoading = () => setIsLoading(true);
        const handleDidStopLoading = () => setIsLoading(false);
        const handleDomReady = () => {
            setCanGoBack(webview.canGoBack());
            setCanGoForward(webview.canGoForward());
        };
        const handleDidNavigate = (e: any) => {
            setInputValue(e.url);
            setCanGoBack(webview.canGoBack());
            setCanGoForward(webview.canGoForward());
        };
        const handleNewWindow = (e: any) => { webview.loadURL(e.url); };
        
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
    }, [webview]);

    const handleGoBack = () => webview?.goBack();
    const handleGoForward = () => webview?.goForward();
    const handleRefresh = () => webview?.reload();

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleNavigate();
    };

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
                <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors" aria-label="Close Browser"><FiX size={20} /></button>
                <button onClick={handleGoBack} disabled={!canGoBack} className="p-2 text-white/70 hover:text-white disabled:text-white/30 disabled:hover:bg-transparent hover:bg-white/10 rounded-full transition-colors" aria-label="Back"><FiArrowLeft size={20} /></button>
                <button onClick={handleGoForward} disabled={!canGoForward} className="p-2 text-white/70 hover:text-white disabled:text-white/30 disabled:hover:bg-transparent hover:bg-white/10 rounded-full transition-colors" aria-label="Forward"><FiArrowRight size={20} /></button>
                <button onClick={handleRefresh} disabled={isLoading} className="p-2 text-white/70 hover:text-white disabled:text-white/30 disabled:hover:bg-transparent hover:bg-white/10 rounded-full transition-colors" aria-label="Refresh">
                    {isLoading ? <div className="w-5 h-5 rounded-full loading-spinner-border" /> : <FiRefreshCw size={20} />}
                </button>
                <form onSubmit={handleFormSubmit} className="flex-grow relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="Cerca o inserisci un indirizzo"
                        className="w-full bg-zinc-800 text-white rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white" aria-label="Go">
                        <FiSearch size={18} />
                    </button>
                </form>
            </div>
            <webview
                ref={webviewRef}
                src={initialUrl}
                className="w-full h-full border-none flex-grow bg-zinc-900"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
                partition="persist:theater"
                webpreferences="allowRunningInsecureContent, javascript=yes"
                allowpopups
            />
        </motion.div>
    );
};

export default WebAppViewer;