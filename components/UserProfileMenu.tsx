import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, ChevronDown, Sparkles, Shield, User as UserIcon } from 'lucide-react';

interface UserProfileMenuProps {
  isNight?: boolean;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ isNight = true }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
    <div className="relative z-[100] flex-shrink-0" ref={menuRef} id="spotify-user-profile-container">
      {/* Profile Trigger Button - Minimal Infotainment Style */}
      <button
        id="spotify-profile-button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full transition-all duration-200 select-none backdrop-blur-md border ${
          isNight
            ? 'bg-zinc-900/70 hover:bg-zinc-800/90 text-zinc-100 border-white/10 hover:border-white/20 shadow-md shadow-black/30'
            : 'bg-zinc-100/80 hover:bg-zinc-200/90 text-zinc-900 border-zinc-300/80 shadow-sm'
        } ${isOpen ? 'ring-2 ring-emerald-500/60 border-emerald-500/40' : ''}`}
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

        <span className="text-xs font-semibold max-w-[110px] truncate">
          {displayName}
        </span>

        <ChevronDown
          size={14}
          className={`text-zinc-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Card */}
      {isOpen && (
        <div
          id="spotify-profile-dropdown"
          className={`absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-2xl backdrop-blur-2xl border p-3.5 transition-all duration-200 animate-in fade-in zoom-in-95 z-[100] ${
            isNight
              ? 'bg-zinc-950/90 border-white/10 text-zinc-100 shadow-black/90'
              : 'bg-white/95 border-zinc-200 text-zinc-900 shadow-zinc-400/40'
          }`}
        >
          {/* Header Info */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border border-emerald-500/60 shadow-md flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-600/90 flex items-center justify-center text-white text-base font-bold shadow-md flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-sm truncate leading-snug">
                {displayName}
              </span>
              {user.email && (
                <span className="text-[11px] text-zinc-400 truncate">
                  {user.email}
                </span>
              )}
              <div className="flex items-center gap-1 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    isPremium
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  <Sparkles size={9} />
                  {isPremium ? 'Spotify Premium' : 'Spotify Free'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection status */}
          <div className="py-2 space-y-1 text-xs text-zinc-400 border-b border-white/10">
            <div className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Shield size={12} className="text-zinc-400" />
                Connessione Spotify
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Attiva
              </span>
            </div>
          </div>

          {/* Logout Action */}
          <div className="pt-2.5">
            <button
              id="spotify-logout-button"
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-all duration-150 ${
                isNight
                  ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 active:scale-[0.98]'
                  : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 active:scale-[0.98]'
              }`}
            >
              <LogOut size={14} />
              <span>Disconnetti</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileMenu;
