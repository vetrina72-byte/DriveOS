
import React from 'react';

const navLinks = ["Home", "Playlists", "Artists", "Albums", "Podcasts"];

const TopNavBar = ({ isNight }: { isNight: boolean }) => {
  const textColor = isNight ? 'text-white' : 'text-zinc-900';
  const activeLinkColor = isNight ? 'bg-white/20' : 'bg-black/10';
  const hoverBg = isNight ? 'hover:bg-white/10' : 'hover:bg-black/5';

  return (
    <nav className="w-full px-6 pt-6 pb-4 flex-shrink-0">
      <div className="flex items-center gap-2">
        {navLinks.map((link, index) => (
          <a
            key={link}
            href="#"
            className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors duration-300 ${textColor} ${index === 0 ? activeLinkColor : `${hoverBg}`}`}
          >
            {link}
          </a>
        ))}
      </div>
    </nav>
  );
};

export default TopNavBar;
