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
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const handleFocusSearch = () => {
      const focus = () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
          searchInputRef.current.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        }
      };
      focus();
      requestAnimationFrame(focus);
      setTimeout(focus, 20);
      setTimeout(focus, 80);
    };

    window.addEventListener('spotify-open-search', handleFocusSearch);
    return () => window.removeEventListener('spotify-open-search', handleFocusSearch);
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
    <nav ref={navContainerRef} className={`w-full ${isNavCompact ? 'px-3 sm:px-4 pt-3 pb-2.5 gap-2' : 'px-5 sm:px-6 pt-4 pb-3 gap-3'} flex-shrink-0 z-30 relative flex items-center justify-between`}>
      {/* 1. Left side: Logo/Back + Search */}
      <div className={`flex items-center ${isNavCompact ? 'gap-2' : 'gap-3'} flex-shrink-0`}>
        {showBackButton ? (
          <button onClick={onBack} className={`p-1.5 rounded-full transition-colors ${hoverBg}`} aria-label="Indietro">
            <FiChevronLeft className={`w-6 h-6`} style={{ color: textColor }} />
          </button>
        ) : (
          <FaSpotify className={`w-6 h-6 sm:w-7 sm:h-7`} style={{ color: 'var(--text-spotify-logo)' }}/>
        )}
        <form onSubmit={handleSearchSubmit} className={`relative flex-shrink-0 transition-all duration-200 ${isNavVeryCompact ? 'w-[105px]' : (isNavCompact ? 'w-[125px]' : 'w-[140px] sm:w-[155px] md:w-[170px]')}`}>
          <FiSearch className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isNavCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} style={{ color: secondaryTextColor }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={isNavVeryCompact ? "Cerca..." : "Cosa vuoi ascoltare?"}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${isNavCompact ? 'pl-7 pr-6 py-1 text-[11px] placeholder:text-[10.5px] rounded-full' : 'pl-8 pr-7 py-1.5 text-xs sm:text-[13px] placeholder:text-xs rounded-full'} font-medium transition-colors duration-300 ${inputBg} placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 focus:outline-none`}
            style={{ color: textColor }}
          />
           <button 
            type="submit"
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors duration-200 ${hoverBg}`}
            aria-label="Cerca"
          >
              <FiSend className={`${isNavCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} style={{color: textColor}}/>
          </button>
        </form>
      </div>
      
      {/* 2. Middle: Navigation Links - Horizontally Scrollable */}
      <div className="flex-1 min-w-0 mx-1 sm:mx-2 flex items-center justify-start gap-1 sm:gap-1.5 py-0.5 pr-6 overflow-x-auto hide-scrollbar scroll-smooth">
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
                className={`relative z-10 ${isNavCompact ? 'px-1.5 sm:px-2 py-0.5 text-[10.5px] sm:text-[11px]' : 'px-2 sm:px-2.5 py-1 text-xs md:text-[13px]'} rounded-full whitespace-nowrap transition-all duration-200 ${fontWeight} ${
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

      {/* 3. Right side: Fixed User Profile Pill (Always Visible & Unclipped) */}
      <div className="flex-shrink-0 flex items-center justify-end pl-1">
        <UserProfileMenu isNight={isNight} isCompact={isNavCompact} />
      </div>
    </nav>
  );
});

TopNavBar.displayName = 'TopNavBar';

export default TopNavBar;