
import React, { useRef } from 'react';
import { FaSpotify } from 'react-icons/fa';
import { FiSearch, FiChevronLeft, FiChevronRight, FiArrowLeft } from 'react-icons/fi';

const navLinks = ["Home", "Ascoltati di recente", "Playlist", "Artisti", "Album", "Podcast", "Scopri"];

interface TopNavBarProps {
  isNight: boolean;
  onNavigate: (link: string) => void;
  activeLink: string;
  onBack: () => void;
  showBackButton: boolean;
}

const TopNavBar = ({ isNight, onNavigate, activeLink, onBack, showBackButton }: TopNavBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const textColor = isNight ? 'text-white' : 'text-black';
  const iconColor = isNight ? 'text-gray-300' : 'text-gray-700';
  const activeLinkClasses = isNight ? 'bg-white/20' : 'bg-black/10';
  const hoverBg = isNight ? 'hover:bg-white/10' : 'hover:bg-black/5';

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <nav className="w-full px-6 pt-6 pb-4 flex-shrink-0 z-20 flex items-center gap-4">
      {showBackButton ? (
        <button onClick={onBack} className={`p-2 rounded-full ${hoverBg}`}>
            <FiArrowLeft className={`w-6 h-6 ${iconColor}`} />
        </button>
      ) : (
        <>
            <FaSpotify className="w-8 h-8 text-[#1DB954] flex-shrink-0" />
            <button className={`p-2 rounded-full ${hoverBg}`}>
                <FiSearch className={`w-6 h-6 ${iconColor}`} />
            </button>
        </>
      )}

      <div className="flex-grow flex items-center overflow-hidden relative">
         <button onClick={() => scroll('left')} className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-black/30 hover:bg-black/50 ${isNight ? '' : 'hidden'}`}>
             <FiChevronLeft className="w-5 h-5 text-white" />
         </button>
        <div ref={scrollRef} className="flex items-center gap-2 overflow-x-auto spotify-carousel whitespace-nowrap">
          {navLinks.map((link) => (
            <button
              key={link}
              onClick={() => onNavigate(link)}
              className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors duration-300 ${textColor} ${activeLink === link ? activeLinkClasses : hoverBg}`}
            >
              {link}
            </button>
          ))}
        </div>
        <button onClick={() => scroll('right')} className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-black/30 hover:bg-black/50 ${isNight ? '' : 'hidden'}`}>
             <FiChevronRight className="w-5 h-5 text-white" />
         </button>
      </div>
    </nav>
  );
};

export default TopNavBar;