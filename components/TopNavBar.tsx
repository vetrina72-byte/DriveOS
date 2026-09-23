import React, { useState, useEffect, useRef } from 'react';
import { FaSpotify } from 'react-icons/fa';
import { FiSearch, FiChevronLeft, FiSend } from 'react-icons/fi';
import { ViewType } from './SpotifyPlayer';
import { UserProfileMenu } from './UserProfileMenu';

export const wikiSpotifyLogoUrl = "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg";
export const officialSpotifyDjLogoUrl = "https://lexicon-assets.spotifycdn.com/DJ-Beta-CoverArt-300.jpg";

const navLinks = ["Home", "AI DJ", "Playlist", "Artisti", "Album", "Podcast", "Generi e Mood"];

const linkToViewMap: { [key: string]: ViewType } = {
    "Home": 'home',
    "AI DJ": 'ai-dj',
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

const TopNavBar = React.memo(({ isNight, activeView, onNavigate, onSearch, onBack, showBackButton }: TopNavBarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const navContainerRef = useRef<HTMLElement>(null);
  const [navWidth, setNavWidth] = useState<number | null>(null);

  useEffect(() => {
    const navEl = navContainerRef.current;
    if (!navEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setNavWidth(entry.contentRect.width);
      }
    });

    observer.observe(navEl);
    return () => observer.disconnect();
  }, []);

  const isNavCompact = navWidth !== null && navWidth < 780;
  const isNavVeryCompact = navWidth !== null && navWidth < 540;

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
    <nav ref={navContainerRef} className={`w-full ${isNavCompact ? 'px-3.5 pt-4 pb-3 gap-2' : 'px-6 pt-6 pb-4 gap-4'} flex-shrink-0 z-30 relative flex items-center justify-between`}>
      {/* Left side: Logo/Back + Search */}
      <div className={`flex items-center ${isNavCompact ? 'gap-2' : 'gap-4'} flex-shrink-0`}>
        {showBackButton ? (
          <button onClick={onBack} className={`p-2 -ml-2 rounded-full transition-colors ${hoverBg}`} aria-label="Indietro">
            <FiChevronLeft className={`w-7 h-7`} style={{ color: textColor }} />
          </button>
        ) : (
          <FaSpotify className={`w-8 h-8`} style={{ color: 'var(--text-spotify-logo)' }}/>
        )}
        <form onSubmit={handleSearchSubmit} className={`relative flex-grow transition-all duration-200 ${isNavVeryCompact ? 'max-w-[130px]' : (isNavCompact ? 'max-w-[170px]' : 'max-w-xs')}`}>
          <FiSearch className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isNavCompact ? 'w-4 h-4' : 'w-5 h-5'}`} style={{ color: secondaryTextColor }} />
          <input
            type="text"
            placeholder="Cosa vuoi ascoltare?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${isNavCompact ? 'pl-8 pr-7 py-2 text-xs' : 'pl-11 pr-10 py-3 text-sm'} font-medium transition-colors duration-300 ${inputBg} placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 focus:outline-none`}
            style={{ color: textColor }}
          />
           <button 
            type="submit"
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors duration-200 ${hoverBg}`}
            aria-label="Cerca"
          >
              <FiSend className={`${isNavCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} style={{color: textColor}}/>
          </button>
        </form>
      </div>
      
      {/* Right side: Navigation Links & User Profile */}
      <div className={`flex items-center ${isNavCompact ? 'gap-1.5' : 'gap-3'} ml-auto min-w-0 flex-1 justify-end`}>
        <div className={`flex items-center ${isNavCompact ? 'gap-1' : 'gap-2'} overflow-x-auto py-1 scrollbar-none min-w-0`}>
          {navLinks.map((link) => {
            const linkView = linkToViewMap[link];
            if (!linkView) return null;
            
            const isActive = activeView === linkView;
            const isDj = link === "AI DJ";
            const linkColor = isDj && !isActive ? (isNight ? '#1ed760' : '#16a34a') : (isActive ? textColor : secondaryTextColor);
            const fontWeight = isActive || isDj ? 'font-bold' : 'font-semibold';

            return (
              <div key={link} className="relative inline-flex items-center flex-shrink-0">
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onNavigate(linkView); }}
                  className={`relative z-10 ${isNavCompact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} rounded-full whitespace-nowrap transition-all duration-200 ${fontWeight} ${
                    isActive 
                      ? (isNight ? 'bg-white/15' : 'bg-black/10') 
                      : hoverBg
                  } ${isDj ? (isActive ? 'border border-[#1db954]' : 'border border-[#1db954]/40 hover:border-[#1db954]/80') : ''}`}
                  style={{ color: linkColor }}
                >
                  {link}
                </a>
              </div>
            );
          })}
        </div>

        {/* User Profile Menu & Logout */}
        <UserProfileMenu isNight={isNight} />
      </div>
    </nav>
  );
});

TopNavBar.displayName = 'TopNavBar';

export default TopNavBar;