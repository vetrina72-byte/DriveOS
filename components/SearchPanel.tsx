import React, { useState, useEffect, useRef } from 'react';
import { useWeather } from '../context/WeatherContext';
import { TelemetryStore } from '../context/TelemetryStore';
import {
  Search,
  X,
  Home,
  Briefcase,
  Clock,
  MapPin,
  Fuel,
  ParkingCircle,
  Utensils,
  Hotel,
  Pill,
  ShoppingBag,
  Zap
} from 'lucide-react';
import { LocationInfo } from '../types/maps';
import { globalSearchService } from '../services/SearchService';

interface SearchPanelProps {
  rpos: { lat: number; lng: number } | null;
  onSelectDestination: (dest: LocationInfo) => void;
  homeLocation: LocationInfo | null;
  workLocation: LocationInfo | null;
  isVisible: boolean;
  onSaveCurrentLocationAs?: (type: 'home' | 'work', loc: LocationInfo) => void;
}

const QUICK_CATEGORIES = [
  { id: 'fuel', label: 'Benzina', query: 'benzina', icon: Fuel, color: 'text-amber-500 bg-amber-500/15' },
  { id: 'parking', label: 'Parcheggio', query: 'parcheggio', icon: ParkingCircle, color: 'text-blue-500 bg-blue-500/15' },
  { id: 'restaurant', label: 'Ristorante', query: 'pizzeria', icon: Utensils, color: 'text-rose-500 bg-rose-500/15' },
  { id: 'hotel', label: 'Hotel', query: 'hotel', icon: Hotel, color: 'text-purple-500 bg-purple-500/15' },
  { id: 'pharmacy', label: 'Farmacia', query: 'farmacia', icon: Pill, color: 'text-emerald-500 bg-emerald-500/15' }
];

export default function SearchPanel({
  rpos,
  onSelectDestination,
  homeLocation,
  workLocation,
  isVisible,
}: SearchPanelProps) {
  const { useDarkTheme: isNight } = useWeather();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recents, setRecents] = useState<LocationInfo[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search panel on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        isOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('rec_dest') || localStorage.getItem('recent_destinations');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecents(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load recents from localStorage', e);
    }
    // Default recents if none stored
    setRecents([
      { name: "Duomo di Milano", address: "Piazza del Duomo, Milano", lat: 45.4642, lng: 9.1919 },
      { name: "Aeroporto di Malpensa", address: "Ferno, VA", lat: 45.6301, lng: 8.7255 },
      { name: "Stazione Centrale", address: "Piazza Duca d'Aosta, Milano", lat: 45.4854, lng: 9.2045 }
    ]);
  }, []);

  const handleSearch = async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const activePos = rpos || TelemetryStore.position || undefined;
      const res = await globalSearchService.search(q, activePos);
      if (res) {
        setResults(res.slice(0, 10));
      }
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length >= 2) {
      timerRef.current = setTimeout(() => handleSearch(query.trim()), 250);
    } else {
      setResults([]);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const handleSelect = (item: LocationInfo) => {
    const safeRecents = Array.isArray(recents) ? recents : [];
    const nr = [
      item,
      ...safeRecents.filter(
        (r) => !(r.name === item.name && Math.abs(r.lat - item.lat) < 0.0001)
      ),
    ].slice(0, 6);
    setRecents(nr);
    try {
      localStorage.setItem('rec_dest', JSON.stringify(nr));
    } catch (e) {
      console.error(e);
    }
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
    onSelectDestination(item);
  };

  const handleCategoryClick = (categoryQuery: string) => {
    setQuery(categoryQuery);
    setIsOpen(true);
    handleSearch(categoryQuery);
    inputRef.current?.focus();
  };

  const renderIcon = (item: LocationInfo, isRecent: boolean) => {
    if (isRecent) return <Clock className="w-4 h-4 text-zinc-400" />;
    
    switch (item.category) {
      case 'fuel':
        return <Fuel className="w-4 h-4 text-amber-500" />;
      case 'parking':
        return <ParkingCircle className="w-4 h-4 text-blue-500" />;
      case 'restaurant':
        return <Utensils className="w-4 h-4 text-rose-500" />;
      case 'hotel':
        return <Hotel className="w-4 h-4 text-purple-500" />;
      case 'pharmacy':
        return <Pill className="w-4 h-4 text-emerald-500" />;
      case 'supermarket':
        return <ShoppingBag className="w-4 h-4 text-orange-500" />;
      case 'charging':
        return <Zap className="w-4 h-4 text-cyan-500" />;
      default:
        return <MapPin className="w-4 h-4 text-blue-500" />;
    }
  };

  const highlight = (text: string, q: string) => {
    if (!text || !q) return text || '';
    const pts = q.trim().split(/\s+/).filter((p) => p && typeof p === 'string' && p.length > 0);
    if (!pts.length) return text;
    const escaped = pts.map((p) => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).filter(Boolean).join('|');
    if (!escaped) return text;

    const regex = new RegExp(`(${escaped})`, 'i');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <strong key={i} className={`${isNight ? "text-white" : "text-black"} font-extrabold`}>{part}</strong>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (!isVisible) return null;

  const displayList = query.length >= 2 ? results : recents;

  return (
    <div
      id="search-panel-container"
      ref={searchContainerRef}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`absolute top-5 left-5 z-[2000] w-[21.25rem] max-w-[calc(100vw-50px)] backdrop-blur-md border rounded-2xl shadow-xl overflow-hidden pointer-events-auto touch-auto transition-all duration-300 ${
        isNight
          ? 'bg-neutral-900/90 border-white/10 text-white'
          : 'bg-white/95 border-zinc-300/80 text-zinc-900 shadow-slate-300/50'
      }`}
    >
      {/* Search Input Header */}
      <div className="relative flex items-center p-2.5">
        <Search
          className={`absolute left-5 w-5 h-5 pointer-events-none transition-colors ${
            isNight ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        />
        <input
          id="search-destination-input"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          placeholder="Cerca destinazione"
          className={`w-full border rounded-xl py-3.5 pl-12 pr-10 text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 touch-auto pointer-events-auto select-text transition-all ${
            isNight
              ? 'bg-zinc-800/80 border-white/10 text-white placeholder:text-zinc-400'
              : 'bg-zinc-100/90 border-zinc-200 text-zinc-900 placeholder:text-zinc-500 hover:bg-zinc-100'
          }`}
        />
        {query ? (
          <button
            id="search-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              inputRef.current?.focus();
            }}
            className={`absolute right-5 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isNight ? 'text-zinc-400 hover:text-white hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Expanded Content: Only visible when isOpen is true */}
      {isOpen && (
        <div className="animate-fade-in border-t border-inherit">
          {/* Quick Categories Bar */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-none">
            {QUICK_CATEGORIES.map((cat) => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCategoryClick(cat.query);
                  }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                    isNight
                      ? 'bg-zinc-800/70 border-white/5 text-zinc-200 hover:bg-zinc-700 hover:text-white hover:border-zinc-500'
                      : 'bg-zinc-100 border-zinc-200/80 text-zinc-800 hover:bg-zinc-200 hover:text-zinc-950 hover:border-zinc-400'
                  }`}
                >
                  <span className={`p-1 rounded-md ${cat.color}`}>
                    <IconComp className="w-3.5 h-3.5" />
                  </span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Results or Recents List */}
          <div className="flex flex-col max-h-[19rem] overflow-y-auto px-2 pb-2 scrollbar-thin">
            {isLoading && query.length >= 2 ? (
              <div className={`text-center py-6 text-sm font-medium ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Ricerca in corso...
              </div>
            ) : displayList.length > 0 ? (
              <>
                <div
                  className={`px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider ${
                    isNight ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  {query.length < 2 ? 'Destinazioni recenti' : 'Risultati'}
                </div>
                {displayList.map((item, idx) => (
                  <button
                    key={`${item.name}_${idx}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(item);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer ${
                      isNight ? 'hover:bg-white/15 text-zinc-100' : 'hover:bg-zinc-200/80 text-zinc-900'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                        isNight
                          ? 'bg-zinc-800/80 border-white/10'
                          : 'bg-zinc-100 border-zinc-200'
                      }`}
                    >
                      {renderIcon(item, query.length < 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[14.5px] font-bold truncate ${
                          isNight ? 'text-zinc-100' : 'text-zinc-900'
                        }`}
                      >
                        {highlight(item.name, query)}
                      </div>
                      {item.address && (
                        <div
                          className={`text-[13px] truncate ${
                            isNight ? 'text-zinc-400' : 'text-zinc-600'
                          }`}
                        >
                          {highlight(item.address, query)}
                        </div>
                      )}
                    </div>
                    {item.dk !== undefined && (
                      <div className="flex-shrink-0 text-right pl-2">
                        <div
                          className={`text-[13.5px] font-bold ${
                            isNight ? 'text-zinc-200' : 'text-zinc-800'
                          }`}
                        >
                          {item.dk < 1 ? `${Math.round(item.dk * 1000)} m` : `${item.dk.toFixed(1)} km`}
                        </div>
                        {item.em !== undefined && (
                          <div
                            className={`text-[12px] leading-tight ${
                              isNight ? 'text-zinc-400' : 'text-zinc-500'
                            }`}
                          >
                            ~{item.em} min
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </>
            ) : query.length >= 2 ? (
              <div className={`text-center py-6 text-sm font-medium ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Nessun luogo trovato per &ldquo;{query}&rdquo;
              </div>
            ) : null}
          </div>

          {/* Quick Home / Work Shortcuts (Inside Expanded Panel) */}
          <div
            className={`flex border-t p-2 gap-2 justify-around ${
              isNight ? 'border-white/10' : 'border-zinc-200'
            }`}
          >
            <button
              id="search-home-shortcut"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (homeLocation) handleSelect(homeLocation);
              }}
              className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                homeLocation ? 'opacity-100' : 'opacity-60'
              } ${
                isNight
                  ? 'text-zinc-300 hover:bg-white/15 hover:text-white'
                  : 'text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900'
              }`}
            >
              <Home className={`w-4 h-4 ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`} />
              <span>Casa</span>
            </button>
            <button
              id="search-work-shortcut"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (workLocation) handleSelect(workLocation);
              }}
              className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                workLocation ? 'opacity-100' : 'opacity-60'
              } ${
                isNight
                  ? 'text-zinc-300 hover:bg-white/15 hover:text-white'
                  : 'text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900'
              }`}
            >
              <Briefcase className={`w-4 h-4 ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`} />
              <span>Lavoro</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
