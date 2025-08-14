
import React, { useRef, useState } from 'react';
import { FaSpotify } from 'react-icons/fa';
import { FiSearch, FiChevronLeft } from 'react-icons/fi';

const navLinks = ["Home", "Playlist", "Artisti"];

type ViewType = 'home' | 'playlists' | 'artists' | 'search' | 'playlist' | 'album' | 'artist';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const textColor = isNight ? 'text-white' : 'text-zinc-900';
  const secondaryTextColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  const activeLinkColor = isNight ? 'bg-white text-black' : 'bg-black text-white';
  const hoverBg = isNight ? 'hover:bg-white/10' : 'hover:bg-black/5';
  const inputBg = isNight ? 'bg-white/10' : 'bg-black/5';

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };
  
  // Map internal view types to display names for nav links
  const viewToLinkName: { [key in ViewType]?: string } = {
    home: "Home",
    playlists: "Playlist",
    artists: "Artisti",
  };

  return (
    <nav className="w-full px-6 pt-6 pb-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-4">
        {showBackButton ? (
          <button onClick={onBack} className={`p-2 -ml-2 rounded-full transition-colors ${hoverBg}`}>
            <FiChevronLeft className={`w-7 h-7 ${textColor}`} />
          </button>
        ) : (
          <FaSpotify className={`w-8 h-8 ${textColor}`} />
        )}
        <div className="relative flex-grow max-w-xs">
          <FiSearch className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${secondaryTextColor}`} />
          <input
            type="text"
            placeholder="Cosa vuoi ascoltare?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className={`w-full pl-11 pr-4 py-3 rounded-full text-sm font-medium transition-colors duration-300 ${textColor} ${inputBg} placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 focus:outline-none`}
          />
        </div>
      </div>
      <div ref={scrollRef} className="mt-4 spotify-carousel -mx-6 px-6">
        <div className="flex items-center gap-2">
          {navLinks.map((link) => {
            const linkView = link.toLowerCase() as ViewType;
            const isActive = activeView === linkView || (activeView === 'search' && link === 'Home'); // Show home as active during search
            return (
              <a
                key={link}
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate(linkView); }}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-300 ${isActive ? activeLinkColor : `${textColor} bg-white/5 ${hoverBg}`}`}
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
