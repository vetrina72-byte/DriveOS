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
  Zap,
  Pencil,
  Trash2,
  Plus
} from 'lucide-react';
import { LocationInfo } from '../types/maps';
import { globalSearchService } from '../services/SearchService';

interface SearchPanelProps {
  rpos: { lat: number; lng: number } | null;
  onSelectDestination: (dest: LocationInfo) => void;
  homeLocation: LocationInfo | null;
  workLocation: LocationInfo | null;
  setHomeLocation?: (loc: { lat: number; lng: number; name: string } | null) => void;
  setWorkLocation?: (loc: { lat: number; lng: number; name: string } | null) => void;
  isVisible: boolean;
  onSaveCurrentLocationAs?: (type: 'home' | 'work', loc: LocationInfo) => void;
}

const QUICK_CATEGORIES = [
  { id: 'fuel', label: 'Benzina', query: 'benzina', icon: Fuel, color: 'text-amber-500 bg-amber-500/15' },
  { id: 'parking', label: 'Parcheggio', query: 'parcheggio', icon: ParkingCircle, color: 'text-blue-500 bg-blue-500/15' },
  { id: 'restaurant', label: 'Ristorante', query: 'pizzeria', icon: Utensils, color: 'text-rose-500 bg-rose-500/15' },
  { id: 'hotel', label: 'Hotel', query: 'hotel', icon: Hotel, color: 'text-purple-500 bg-purple-500/15' },
  { id: 'pharmacy', label: 'Farmacia', query: 'farmacia', icon: Pill, color: 'text-emerald-500 bg-emerald-500/15' },
  { id: 'supermarket', label: 'Supermercato', query: 'supermercato', icon: ShoppingBag, color: 'text-amber-600 bg-amber-600/15' },
  { id: 'ev', label: 'Ricarica EV', query: 'ricarica veicoli elettrici', icon: Zap, color: 'text-cyan-500 bg-cyan-500/15' }
];

export default function SearchPanel({
  rpos,
  onSelectDestination,
  homeLocation,
  workLocation,
  setHomeLocation,
  setWorkLocation,
  isVisible,
}: SearchPanelProps) {
  const { useDarkTheme: isNight } = useWeather();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [settingSpecialLocation, setSettingSpecialLocation] = useState<'home' | 'work' | null>(null);
  const [recents, setRecents] = useState<LocationInfo[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Drag-to-scroll refs and handlers for quick categories bar
  const categoriesRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const handleCategoriesMouseDown = (e: React.MouseEvent) => {
    if (!categoriesRef.current) return;
    isMouseDownRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - categoriesRef.current.offsetLeft;
    scrollLeftRef.current = categoriesRef.current.scrollLeft;
  };

  const handleCategoriesMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !categoriesRef.current) return;
    e.preventDefault();
    const currentX = e.pageX - categoriesRef.current.offsetLeft;
    const walk = currentX - startXRef.current;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    categoriesRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleCategoriesMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
  };

  // Close search panel on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        isOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent('close-virtual-keyboard'));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
        window.dispatchEvent(new CustomEvent('close-virtual-keyboard'));
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
    const handleReconfigureEvent = (e: Event) => {
      const custom = e as CustomEvent<'home' | 'work'>;
      if (custom.detail) {
        setIsOpen(true);
        setSettingSpecialLocation(custom.detail);
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('reconfigure-location', handleReconfigureEvent);
    return () => window.removeEventListener('reconfigure-location', handleReconfigureEvent);
  }, []);

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
    
    if (inputRef.current) inputRef.current.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.dispatchEvent(new CustomEvent('close-virtual-keyboard'));

    if (settingSpecialLocation === 'home' && setHomeLocation) {
      setHomeLocation({ lat: item.lat, lng: item.lng, name: item.name });
      setSettingSpecialLocation(null);
    } else if (settingSpecialLocation === 'work' && setWorkLocation) {
      setWorkLocation({ lat: item.lat, lng: item.lng, name: item.name });
      setSettingSpecialLocation(null);
    } else {
      onSelectDestination(item);
    }
  };

  const handleCategoryClick = (categoryQuery: string) => {
    setQuery(categoryQuery);
    setIsOpen(true);
    handleSearch(categoryQuery);
    if (inputRef.current) inputRef.current.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.dispatchEvent(new CustomEvent('close-virtual-keyboard'));
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
      className={`absolute top-5 left-5 z-[2000] w-[22rem] sm:w-[23rem] max-w-[calc(100vw-40px)] backdrop-blur-md border rounded-2xl shadow-xl overflow-hidden pointer-events-auto touch-auto transition-all duration-300 ${
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (inputRef.current) inputRef.current.blur();
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              window.dispatchEvent(new CustomEvent('close-virtual-keyboard'));
              if (displayList.length > 0) {
                handleSelect(displayList[0]);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
              if (inputRef.current) inputRef.current.blur();
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              window.dispatchEvent(new CustomEvent('close-virtual-keyboard'));
            }
          }}
          placeholder={settingSpecialLocation === 'home' ? "Cerca il nuovo indirizzo di casa..." : settingSpecialLocation === 'work' ? "Cerca il nuovo indirizzo di lavoro..." : "Cerca destinazione"}
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
              setSettingSpecialLocation(null);
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
          {/* Reconfigure / Set Home/Work active banner */}
          {settingSpecialLocation && (
            <div
              className={`mx-2.5 my-2 p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                isNight
                  ? 'bg-blue-950/60 border-blue-500/40 text-blue-200'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {settingSpecialLocation === 'home' ? (
                  <Home className="w-4 h-4 text-blue-400 shrink-0" />
                ) : (
                  <Briefcase className="w-4 h-4 text-blue-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {settingSpecialLocation === 'home'
                      ? (homeLocation ? 'Reimposta Casa' : 'Imposta Casa')
                      : (workLocation ? 'Reimposta Lavoro' : 'Imposta Lavoro')}
                  </div>
                  <div className="text-[11px] opacity-80 truncate">
                    Cerca un indirizzo e selezionalo
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {((settingSpecialLocation === 'home' && homeLocation) ||
                  (settingSpecialLocation === 'work' && workLocation)) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (settingSpecialLocation === 'home' && setHomeLocation) {
                        setHomeLocation(null);
                      } else if (settingSpecialLocation === 'work' && setWorkLocation) {
                        setWorkLocation(null);
                      }
                      setSettingSpecialLocation(null);
                      setQuery('');
                    }}
                    title="Rimuovi indirizzo"
                    className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                      isNight
                        ? 'bg-red-950/50 border-red-800/50 text-red-300 hover:bg-red-900/70'
                        : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Rimuovi</span>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingSpecialLocation(null);
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isNight
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Quick Categories Bar with Mouse & Touch Drag-to-Scroll */}
          <div className="relative group">
            <div
              ref={categoriesRef}
              onMouseDown={handleCategoriesMouseDown}
              onMouseMove={handleCategoriesMouseMove}
              onMouseUp={handleCategoriesMouseUpOrLeave}
              onMouseLeave={handleCategoriesMouseUpOrLeave}
              className="flex items-center gap-2 px-3 py-2.5 overflow-x-auto scrollbar-none select-none cursor-grab active:cursor-grabbing touch-pan-x"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {QUICK_CATEGORIES.map((cat) => {
                const IconComp = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMovedRef.current) {
                        return;
                      }
                      handleCategoryClick(cat.query);
                    }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all select-none active:scale-95 cursor-pointer ${
                      isNight
                        ? 'bg-zinc-800/70 border-white/5 text-zinc-200 hover:bg-zinc-700 hover:text-white hover:border-zinc-500'
                        : 'bg-zinc-100 border-zinc-200/80 text-zinc-800 hover:bg-zinc-200 hover:text-zinc-950 hover:border-zinc-400'
                    }`}
                  >
                    <span className={`p-1 rounded-md ${cat.color} shrink-0 pointer-events-none`}>
                      <IconComp className="w-3.5 h-3.5" />
                    </span>
                    <span className="whitespace-nowrap shrink-0 pointer-events-none">{cat.label}</span>
                  </button>
                );
              })}
            </div>
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

          {/* Quick Home / Work Shortcuts with Reconfigure buttons */}
          <div
            className={`flex border-t p-2 gap-2 justify-around ${
              isNight ? 'border-white/10' : 'border-zinc-200'
            }`}
          >
            {/* Casa Button with Reconfigure Action */}
            <div
              className={`flex-1 flex items-center justify-between rounded-xl border transition-all ${
                homeLocation
                  ? isNight
                    ? 'bg-zinc-800/70 border-white/10 text-white'
                    : 'bg-zinc-50 border-zinc-200/80 text-zinc-900'
                  : isNight
                    ? 'bg-zinc-800/30 border-dashed border-white/10 text-zinc-400'
                    : 'bg-zinc-50/50 border-dashed border-zinc-200 text-zinc-500'
              }`}
            >
              <button
                id="search-home-shortcut"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (homeLocation) {
                    handleSelect(homeLocation);
                  } else {
                    setSettingSpecialLocation('home');
                    setQuery('');
                    inputRef.current?.focus();
                  }
                }}
                className="flex-1 flex items-center gap-2 py-2 px-2.5 text-left min-w-0 cursor-pointer overflow-hidden group"
                title={homeLocation ? `Naviga a Casa: ${homeLocation.name}` : 'Imposta Casa'}
              >
                <Home className={`w-4 h-4 shrink-0 transition-colors ${homeLocation ? 'text-blue-500' : isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold leading-tight truncate">
                    {homeLocation ? 'Casa' : 'Imposta Casa'}
                  </div>
                  {homeLocation && (
                    <div className={`text-[10.5px] truncate ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {homeLocation.name.split(',')[0]}
                    </div>
                  )}
                </div>
              </button>
              {homeLocation ? (
                <button
                  id="search-home-reconfigure"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingSpecialLocation('home');
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  title="Reimposta indirizzo di Casa"
                  className={`p-2 mr-1 rounded-lg transition-colors cursor-pointer ${
                    isNight ? 'text-zinc-400 hover:text-white hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/80'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  id="search-home-add"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingSpecialLocation('home');
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  title="Imposta Casa"
                  className={`p-2 mr-1 rounded-lg transition-colors cursor-pointer ${
                    isNight ? 'text-zinc-400 hover:text-white hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/80'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Lavoro Button with Reconfigure Action */}
            <div
              className={`flex-1 flex items-center justify-between rounded-xl border transition-all ${
                workLocation
                  ? isNight
                    ? 'bg-zinc-800/70 border-white/10 text-white'
                    : 'bg-zinc-50 border-zinc-200/80 text-zinc-900'
                  : isNight
                    ? 'bg-zinc-800/30 border-dashed border-white/10 text-zinc-400'
                    : 'bg-zinc-50/50 border-dashed border-zinc-200 text-zinc-500'
              }`}
            >
              <button
                id="search-work-shortcut"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (workLocation) {
                    handleSelect(workLocation);
                  } else {
                    setSettingSpecialLocation('work');
                    setQuery('');
                    inputRef.current?.focus();
                  }
                }}
                className="flex-1 flex items-center gap-2 py-2 px-2.5 text-left min-w-0 cursor-pointer overflow-hidden group"
                title={workLocation ? `Naviga a Lavoro: ${workLocation.name}` : 'Imposta Lavoro'}
              >
                <Briefcase className={`w-4 h-4 shrink-0 transition-colors ${workLocation ? 'text-indigo-500' : isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold leading-tight truncate">
                    {workLocation ? 'Lavoro' : 'Imposta Lavoro'}
                  </div>
                  {workLocation && (
                    <div className={`text-[10.5px] truncate ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {workLocation.name.split(',')[0]}
                    </div>
                  )}
                </div>
              </button>
              {workLocation ? (
                <button
                  id="search-work-reconfigure"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingSpecialLocation('work');
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  title="Reimposta indirizzo di Lavoro"
                  className={`p-2 mr-1 rounded-lg transition-colors cursor-pointer ${
                    isNight ? 'text-zinc-400 hover:text-white hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/80'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  id="search-work-add"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingSpecialLocation('work');
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  title="Imposta Lavoro"
                  className={`p-2 mr-1 rounded-lg transition-colors cursor-pointer ${
                    isNight ? 'text-zinc-400 hover:text-white hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/80'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
