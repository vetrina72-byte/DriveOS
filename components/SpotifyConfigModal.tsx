import React from 'react';
import { FiX, FiClipboard, FiArrowRight } from 'react-icons/fi';

const REDIRECT_URI = 'http://localhost:8080/callback';
const SPOTIFY_DASHBOARD_URL = 'https://developer.spotify.com/dashboard';

export default function SpotifyConfigModal({ 
    onClose, 
    onConfirm 
}: { 
    onClose: () => void; 
    onConfirm: () => void;
}) {
    const [isCopied, setIsCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(REDIRECT_URI).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy URI:', err);
            alert('Failed to copy URI to clipboard.');
        });
    };

    return (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex justify-center items-center animate-fade-in p-4" onClick={onClose}>
            <div 
                className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg p-8 relative text-white"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="spotify-config-title"
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
                    aria-label="Close configuration"
                >
                    <FiX size={20}/>
                </button>
                
                <h2 id="spotify-config-title" className="text-2xl font-bold mb-4 text-center">Spotify Configuration Required</h2>
                <p className="text-zinc-400 text-center mb-6">
                    To prevent errors, you must add a Redirect URI to your Spotify application settings.
                </p>

                <div className="space-y-4 text-left">
                    <p>
                        <span className="font-semibold">Step 1:</span> Go to your 
                        <a href={SPOTIFY_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline font-semibold mx-1">
                             Spotify Developer Dashboard
                        </a> 
                        and select your application.
                    </p>
                    <p>
                        <span className="font-semibold">Step 2:</span> Click "Edit Settings" and find the "Redirect URIs" section.
                    </p>
                    <p>
                        <span className="font-semibold">Step 3:</span> Copy and paste this exact URL into the box and click "Add".
                    </p>
                </div>
                
                <div className="my-6 p-4 bg-black rounded-lg border border-zinc-700 flex items-center gap-4">
                    <p className="font-mono text-sm text-zinc-300 flex-grow break-all">{REDIRECT_URI}</p>
                    <button
                        onClick={handleCopy}
                        className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors flex-shrink-0"
                        aria-label="Copy Redirect URI"
                    >
                        {isCopied ? <span className="text-green-400 text-xs">Copied!</span> : <FiClipboard />}
                    </button>
                </div>

                <p className="text-xs text-center text-zinc-500 mb-6">
                    Make sure to save your changes in the Spotify dashboard.
                </p>

                <button
                    onClick={onConfirm}
                    className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-8 rounded-full text-lg transition-transform hover:scale-105 flex items-center justify-center gap-3"
                >
                    <span>Continue to Login</span>
                    <FiArrowRight />
                </button>
            </div>
        </div>
    );
}