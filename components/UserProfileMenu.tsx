import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronDown, Sparkles, Shield, Globe, Users } from 'lucide-react';

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
    <div className="relative z-50" ref={menuRef} id="spotify-user-profile-container">
      {/* Profile Trigger Button */}
      <button
        id="spotify-profile-button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-all duration-200 select-none ${
          isNight
            ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-100 border border-zinc-700/60 shadow-sm'
            : 'bg-zinc-200/80 hover:bg-zinc-300/80 text-zinc-900 border border-zinc-300 shadow-sm'
        } ${isOpen ? 'ring-2 ring-emerald-500/50' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <span className="text-sm font-semibold max-w-[120px] truncate hidden sm:inline">
          {displayName}
        </span>

        <ChevronDown
          size={16}
          className={`text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Card */}
      {isOpen && (
        <div
          id="spotify-profile-dropdown"
          className={`absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl backdrop-blur-xl border p-4 transition-all duration-200 animate-in fade-in zoom-in-95 ${
            isNight
              ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100 shadow-black/80'
              : 'bg-white/95 border-zinc-200 text-zinc-900 shadow-zinc-400/40'
          }`}
        >
          {/* Header Info */}
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-700/40">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base truncate leading-tight">
                {displayName}
              </span>
              {user.email && (
                <span className="text-xs text-zinc-400 truncate mt-0.5">
                  {user.email}
                </span>
              )}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isPremium
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-700/40 text-zinc-400'
                  }`}
                >
                  <Sparkles size={10} />
                  {isPremium ? 'Spotify Premium' : 'Spotify Free'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Details / Stats */}
          <div className="py-2.5 space-y-1.5 text-xs text-zinc-400 border-b border-zinc-700/40">
            {user.followers !== undefined && (
              <div className="flex items-center justify-between py-0.5">
                <span className="flex items-center gap-1.5">
                  <Users size={13} className="text-zinc-400" />
                  Follower
                </span>
                <span className="font-semibold text-zinc-200">
                  {user.followers.total || 0}
                </span>
              </div>
            )}

            {user.country && (
              <div className="flex items-center justify-between py-0.5">
                <span className="flex items-center gap-1.5">
                  <Globe size={13} className="text-zinc-400" />
                  Paese
                </span>
                <span className="font-semibold text-zinc-200">
                  {user.country}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5">
                <Shield size={13} className="text-zinc-400" />
                Stato connessione
              </span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Attiva
              </span>
            </div>
          </div>

          {/* Logout Action */}
          <div className="pt-3">
            <button
              id="spotify-logout-button"
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-150 ${
                isNight
                  ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 active:scale-[0.98]'
                  : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 active:scale-[0.98]'
              }`}
            >
              <LogOut size={16} />
              <span>Disconnetti Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileMenu;
