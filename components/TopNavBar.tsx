
import React, { useRef } from 'react';
import { FaSpotify } from 'react-icons/fa';
import { FiSearch } from 'react-icons/fi';

const navLinks = ["Home", "Ascoltati di recente", "Playlist", "Artisti", "Album", "Podcast", "Scopri nuovi generi e mood"];

const TopNavBar = ({ isNight, onBack, showBackButton }: { isNight: boolean, onBack: () => void, showBackButton: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const textColor = isNight ? 'text-white' : 'text-zinc-900';
  const activeLinkColor = isNight ? 'bg-white/10' : 'bg-black/10';
  const hoverBg = isNight ? 'hover:bg-white/10' : 'hover:bg-black/5';
  const inputBg = isNight ? 'bg-white/10' : 'bg-black/5';

  return (
    <nav className="w-full px-6 pt-6 pb-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-4">
        <FaSpotify className={`w-8 h-8 ${isNight ? 'text-white' : 'text-black'}`} />
        <div className="relative flex-grow max-w-xs">
          <FiSearch className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isNight ? 'text-[#b3b3b3]' : 'text-zinc-600'}`} />
          <input
            type="text"
            placeholder="Cerca..."
            className={`w-full pl-10 pr-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 ${textColor} ${inputBg} placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 focus:outline-none`}
          />
        </div>
      </div>
      {!showBackButton && (
        <div ref={scrollRef} className="mt-4 spotify-carousel -mx-6 px-6">
          <div className="flex items-center gap-2">
            {navLinks.map((link, index) => (
              <a
                key={link}
                href="#"
                className={`px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap transition-colors duration-300 ${textColor} ${index === 0 ? activeLinkColor : `${hoverBg}`}`}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default TopNavBar;
