import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, ChevronDown, Sparkles, Shield } from 'lucide-react';

interface UserProfileMenuProps {
  isNight?: boolean;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ isNight = true }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const profileImageUrl = user.images && user.images.length > 0 ? user.images[0].url : null;
  const displayName = user.display_name || user.id || 'Utente Spotify';
  const isPremium = user.product === 'premium' || user.product === 'open';

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  return (
    <div className="relative z-50 flex-shrink-0" ref={menuRef} id="spotify-user-profile-container">
      {/* Profile Trigger Button - Minimal Infotainment Style */}
      <button
        id="spotify-profile-button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full transition-all duration-200 select-none backdrop-blur-md border ${
          isNight
            ? 'bg-zinc-900/80 hover:bg-zinc-800/90 text-zinc-100 border-white/10 hover:border-white/20 shadow-md shadow-black/40'
            : 'bg-zinc-100/80 hover:bg-zinc-200/90 text-zinc-900 border-zinc-300/80 shadow-sm'
        } ${isOpen ? 'ring-2 ring-emerald-500/50 border-emerald-500/40' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={displayName}
      >
        {profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt={displayName}
            className="w-6 h-6 rounded-full object-cover border border-emerald-500/60 flex-shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-emerald-600/90 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <span className="text-xs font-semibold max-w-[100px] truncate">
          {displayName}
        </span>

        <ChevronDown
          size={13}
          className={`text-zinc-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Card - Glassmorphism & Compact */}
      {isOpen && (
        <div
          id="spotify-profile-dropdown"
          style={{
            background: isNight ? 'rgba(18, 18, 18, 0.75)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: isNight ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
          }}
          className="absolute right-0 top-full mt-2 w-60 rounded-xl shadow-2xl p-3 transition-all duration-200 animate-in fade-in zoom-in-95 z-[999] pointer-events-auto"
        >
          {/* Header Info */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/10">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover border border-emerald-500/60 shadow-md flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-600/90 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-xs truncate leading-snug text-white">
                {displayName}
              </span>
              {user.email && (
                <span className="text-[10px] text-zinc-400 truncate">
                  {user.email}
                </span>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider ${
                    isPremium
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  <Sparkles size={8} />
                  {isPremium ? 'Spotify Premium' : 'Spotify Free'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection status */}
          <div className="py-2 space-y-1 text-xs text-zinc-400 border-b border-white/10">
            <div className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1 text-[10.5px]">
                <Shield size={11} className="text-zinc-400" />
                Connessione Spotify
              </span>
              <span className="text-[10.5px] font-semibold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Attiva
              </span>
            </div>
          </div>

          {/* Logout Action - Discrete Minimal Styling */}
          <div className="pt-2">
            <button
              id="spotify-logout-button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg font-semibold text-xs text-zinc-300 hover:text-red-300 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-all duration-150 active:scale-[0.98]"
            >
              <LogOut size={13} />
              <span>Disconnetti</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileMenu;
