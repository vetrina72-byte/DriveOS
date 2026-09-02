import React, { useState } from 'react';
import { FaSpotify } from 'react-icons/fa';
import { FiSearch, FiChevronLeft, FiSend } from 'react-icons/fi';
import { ViewType } from './SpotifyPlayer';
import { UserProfileMenu } from './UserProfileMenu';

const navLinks = ["Home", "Playlist", "Artisti", "Album", "Podcast", "Generi e Mood"];

const linkToViewMap: { [key: string]: ViewType } = {
    "Home": 'home',
    "Playlist": 'playlists',
    "Artisti": 'artists',
    "Album": 'albums',
    "Podcast": 'podcasts',
    "Generi e Mood": 'genres',
};

interface TopNavBarProps {
    isNight: boolean;
    activeView: ViewType;
    onNavigate: (view: ViewType) => void;
    onSearch: (query: string) => void;
    onBack: () => void;
    showBackButton: boolean;
}

const TopNavBar = ({ isNight, activeView, onNavigate, onSearch, onBack, showBackButton }: TopNavBarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const textColor = 'var(--text-primary)';
  const secondaryTextColor = 'var(--text-secondary)';
  const hoverBg = isNight ? 'hover:bg-white/10' : 'hover:bg-black/5';
  const inputBg = isNight ? 'bg-white/10' : 'bg-black/5';

  const handleSearch = () => {
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
      setSearchTerm('');
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };
  
  return (
    <nav className="w-full px-6 pt-6 pb-4 flex-shrink-0 z-20 flex items-center justify-between gap-4">
      {/* Left side: Logo/Back + Search */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {showBackButton ? (
          <button onClick={onBack} className={`p-2 -ml-2 rounded-full transition-colors ${hoverBg}`} aria-label="Indietro">
            <FiChevronLeft className={`w-7 h-7`} style={{ color: textColor }} />
          </button>
        ) : (
          <FaSpotify className={`w-8 h-8`} style={{ color: 'var(--text-spotify-logo)' }}/>
        )}
        <form onSubmit={handleSearchSubmit} className="relative flex-grow max-w-xs">
          <FiSearch className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5`} style={{ color: secondaryTextColor }} />
          <input
            type="text"
            placeholder="Cosa vuoi ascoltare?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-11 pr-10 py-3 rounded-full text-sm font-medium transition-colors duration-300 ${inputBg} placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 focus:outline-none`}
            style={{ color: textColor }}
          />
           <button 
            type="submit"
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors duration-200 ${hoverBg}`}
            aria-label="Cerca"
          >
              <FiSend className="w-4 h-4" style={{color: textColor}}/>
          </button>
        </form>
      </div>
      
      {/* Right side: Navigation Links & User Profile */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {navLinks.map((link) => {
            const linkView = linkToViewMap[link];
            if (!linkView) return null;
            
            const isActive = activeView === linkView;
            const linkColor = isActive ? textColor : secondaryTextColor;
            const fontWeight = isActive ? 'font-bold' : 'font-semibold';

            return (
              <a
                key={link}
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate(linkView); }}
                className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors duration-200 ${fontWeight} ${
                  isActive 
                    ? (isNight ? 'bg-white/15' : 'bg-black/10') 
                    : hoverBg
                }`}
                style={{ color: linkColor }}
              >
                {link}
              </a>
            )
          })}
        </div>

        {/* User Profile Menu & Logout */}
        <UserProfileMenu isNight={isNight} />
      </div>
    </nav>
  );
};

export default TopNavBar;