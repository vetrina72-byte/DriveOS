

import React, { useRef, useState } from 'react';
import { FaSpotify } from 'react-icons/fa';
import { FiSearch, FiChevronLeft, FiSend } from 'react-icons/fi';
import { ViewType } from './SpotifyPlayer';

const navLinks = ["Home", "Ascoltati di recente", "Playlist", "Artisti", "Album", "Podcast", "Generi e Mood"];

const linkToViewMap: { [key: string]: ViewType } = {
    "Home": 'home',
    "Ascoltati di recente": 'recently-played',
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
  const activeLinkColor = isNight ? 'bg-white text-black' : 'bg-black text-white';
  const hoverBg = isNight ? 'hover:bg-white/10' : 'hover:bg-black/5';
  const inputBg = isNight ? 'bg-white/10' : 'bg-black/5';

  const handleSearch = () => {
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  return (
    <nav className="w-full px-6 pt-6 pb-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-4">
        {showBackButton ? (
          <button onClick={onBack} className={`p-2 -ml-2 rounded-full transition-colors ${hoverBg}`}>
            <FiChevronLeft className={`w-7 h-7`} style={{ color: textColor }} />
          </button>
        ) : (
          <FaSpotify className={`w-8 h-8`} style={{ color: 'var(--text-spotify-logo)' }}/>
        )}
        <div className="relative flex-grow max-w-xs">
          <FiSearch className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5`} style={{ color: secondaryTextColor }} />
          <input
            type="text"
            placeholder="Cosa vuoi ascoltare?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className={`w-full pl-11 pr-10 py-3 rounded-full text-sm font-medium transition-colors duration-300 ${inputBg} placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 focus:outline-none`}
            style={{ color: textColor }}
          />
           <button 
            onClick={handleSearch}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors duration-200 ${hoverBg}`}
            aria-label="Cerca"
          >
              <FiSend className="w-4 h-4" style={{color: textColor}}/>
          </button>
        </div>
      </div>
      <div className="mt-4 spotify-carousel -mx-6 px-6">
        <div className="flex items-center gap-2">
          {navLinks.map((link) => {
            const linkView = linkToViewMap[link];
            if (!linkView) return null;
            
            const isActive = activeView === linkView || (activeView === 'search' && link === 'Home');
            return (
              <a
                key={link}
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate(linkView); }}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-300 ${isActive ? activeLinkColor : `bg-white/5 ${hoverBg}`}`}
                style={{ color: isActive ? (isNight ? '#000' : '#FFF') : textColor }}
              >
                {link}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  );
};

export default TopNavBar;