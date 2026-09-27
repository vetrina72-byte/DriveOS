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
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { LocationInfo } from '../types/maps';
import { globalSearchService } from '../services/SearchService';
import { fastTypeaheadTrie, TrieSuggestion } from '../services/GeoNLPResolutionEngine';
import { AutomotiveCategory, AUTOMOTIVE_CATEGORIES } from '../services/AutomotivePlacesEngine';
import { BrandBadge } from './BrandResolver';

interface SearchPanelProps {
  rpos: { lat: number; lng: number } | null;
  onSelectDestination: (dest: LocationInfo) => void;
  homeLocation: LocationInfo | null;
  workLocation: LocationInfo | null;
  setHomeLocation?: (loc: { lat: number; lng: number; name: string } | null) => void;
  setWorkLocation?: (loc: { lat: number; lng: number; name: string } | null) => void;
  isVisible: boolean;
  currentStreet?: string;
  onSaveCurrentLocationAs?: (type: 'home' | 'work', loc: LocationInfo) => void;
  onCategoryResults?: (category: AutomotiveCategory | null, results: LocationInfo[]) => void;
  onSelectPOIPreview?: (poi: LocationInfo) => void;
  onOpenChange?: (isOpen: boolean) => void;
}

const QUICK_CATEGORIES: { id: AutomotiveCategory; label: string; icon: any; color: string }[] = [
  { id: 'fuel', label: 'Benzina', icon: Fuel, color: 'text-amber-500 bg-amber-500/15' },
  { id: 'charging', label: 'Ricarica EV', icon: Zap, color: 'text-cyan-500 bg-cyan-500/15' },
  { id: 'parking', label: 'Parcheggio', icon: ParkingCircle, color: 'text-blue-500 bg-blue-500/15' },
  { id: 'restaurant', label: 'Ristorante', icon: Utensils, color: 'text-rose-500 bg-rose-500/15' },
  { id: 'hotel', label: 'Hotel', icon: Hotel, color: 'text-purple-500 bg-purple-500/15' },
  { id: 'pharmacy', label: 'Farmacia', icon: Pill, color: 'text-emerald-500 bg-emerald-500/15' },
  { id: 'supermarket', label: 'Supermercato', icon: ShoppingBag, color: 'text-amber-600 bg-amber-600/15' }
];

export default function SearchPanel({
  rpos,
  onSelectDestination,
  homeLocation,
  workLocation,
  setHomeLocation,
  setWorkLocation,
  isVisible,
  currentStreet,
  onCategoryResults,
  onSelectPOIPreview,
  onOpenChange,
}: SearchPanelProps) {
  const { useDarkTheme: isNight } = useWeather();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<AutomotiveCategory | null>(null);
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'typing' | 'loading' | 'results' | 'empty' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);
  const [settingSpecialLocation, setSettingSpecialLocation] = useState<'home' | 'work' | null>(null);
  const [recents, setRecents] = useState<LocationInfo[]>([]);
  const [typeaheadSuggestions, setTypeaheadSuggestions] = useState<TrieSuggestion[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
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
    setRecents([]);
  }, []);

  // Typeahead Autocomplete function (fired on debounced keystroke)
  const handleAutocomplete = async (q: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (q.length < 2) {
      setResults([]);
      setIsLoading(false);
      setSearchStatus('idle');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reqId = ++searchRequestIdRef.current;
    setIsLoading(true);
    setSearchStatus('loading');
    setSearchError(null);

    try {
      const activePos = rpos || TelemetryStore.position || undefined;
      const res = await globalSearchService.autocomplete(q, activePos, controller.signal);
      if (reqId === searchRequestIdRef.current) {
        if (res && res.length > 0) {
          setResults(res.slice(0, 8));
          setSearchStatus('results');
        } else {
          setResults([]);
          setSearchStatus('empty');
        }
      }
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        console.error('Autocomplete error:', e);
        if (reqId === searchRequestIdRef.current) {
          setResults([]);
          setSearchStatus('error');
          setSearchError('Impossibile completare la ricerca.');
        }
      }
    } finally {
      if (reqId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Comprehensive Search function (fired on Enter or category button click)
  const handleFullSearch = async (q: string) => {
    if (!q || !q.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reqId = ++searchRequestIdRef.current;
    setIsLoading(true);
    setSearchStatus('loading');
    setSearchError(null);

    try {
      const activePos = rpos || TelemetryStore.position || undefined;
      const res = await globalSearchService.search(q, activePos, controller.signal);
      if (reqId === searchRequestIdRef.current) {
        if (res && res.length > 0) {
          setResults(res.slice(0, 10));
          setSearchStatus('results');
        } else {
          setResults([]);
          setSearchStatus('empty');
        }
      }
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        console.error('Full search error:', e);
        if (reqId === searchRequestIdRef.current) {
          setResults([]);
          setSearchStatus('error');
          setSearchError('Servizio di ricerca momentaneamente non disponibile.');
        }
      }
    } finally {
      if (reqId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const qTrim = query.trim();

    // Fast-path Trie Typeahead suggestions (< 1ms synchronous)
    if (qTrim.length >= 1) {
      const suggestions = fastTypeaheadTrie.searchPrefix(qTrim);
      setTypeaheadSuggestions(suggestions.slice(0, 3));
    } else {
      setTypeaheadSuggestions([]);
    }

    if (qTrim.length >= 2) {
      setSearchStatus('typing');
      timerRef.current = setTimeout(() => handleAutocomplete(qTrim), 220);
    } else {
      searchRequestIdRef.current++;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults([]);
      setIsLoading(false);
      setSearchStatus(qTrim.length === 1 ? 'typing' : 'idle');
      setSearchError(null);
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

  const handleCategoryClick = async (categoryId: AutomotiveCategory) => {
    setActiveCategory(categoryId);
    setQuery('');
    setIsOpen(true);
    setIsLoading(true);
    setSearchStatus('loading');
    setSearchError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++searchRequestIdRef.current;

    try {
      const activePos = rpos || TelemetryStore.position || undefined;
      const catResults = await globalSearchService.searchCategory(categoryId, activePos, controller.signal);
      if (reqId === searchRequestIdRef.current) {
        if (catResults && catResults.length > 0) {
          setResults(catResults);
          setSearchStatus('results');
          onCategoryResults?.(categoryId, catResults);
        } else {
          setResults([]);
          setSearchStatus('empty');
          onCategoryResults?.(categoryId, []);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Category search error:', err);
        if (reqId === searchRequestIdRef.current) {
          setResults([]);
          setSearchStatus('error');
          setSearchError('Nessun risultato disponibile per questa categoria.');
          onCategoryResults?.(categoryId, []);
        }
      }
    } finally {
      if (reqId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }

    if (inputRef.current) inputRef.current.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.dispatchEvent(new CustomEvent('close-virtual-keyboard'));
  };

  const handleClearCategory = () => {
    setActiveCategory(null);
    setResults([]);
    setSearchStatus('idle');
    setSearchError(null);
    onCategoryResults?.(null, []);
  };

  const handleItemClick = (item: LocationInfo) => {
    // Directly select destination for route framing and animation without jump-then-zoom-out
    handleSelect(item);
  };

  const renderIcon = (item: LocationInfo, isRecent: boolean) => {
    return (
      <div className="relative flex-shrink-0">
        <BrandBadge brand={item.brand} placeName={item.name} category={item.category} size={32} />
        {isRecent && (
          <div
            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm border ${
              isNight ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-zinc-300 text-zinc-500'
            }`}
            title="Destinazione recente"
          >
            <Clock className="w-2 h-2" />
          </div>
        )}
      </div>
    );
  };

  const highlight = (text?: any, q?: any) => {
    if (!text || typeof text !== 'string' || !q || typeof q !== 'string') return text || '';
    const pts = q.trim().split(/\s+/).filter((p: any) => p && typeof p === 'string' && p.length > 0);
    if (!pts.length) return text;
    const escaped = pts
      .map((p: string) => (p && typeof p === 'string' ? p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : ''))
      .filter(Boolean)
      .join('|');
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

  const displayList = activeCategory
    ? (query.trim()
        ? results.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || (r.address && r.address.toLowerCase().includes(query.toLowerCase())))
        : results)
    : (query.length >= 2 ? results : recents);

  return (
    <div
      id="search-panel-container"
      ref={searchContainerRef}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`absolute top-3 left-3 sm:top-5 sm:left-5 z-[2000] w-[calc(100%-4.5rem)] sm:w-[22rem] max-w-[22rem] backdrop-blur-md border squircle-card rounded-2xl shadow-xl overflow-hidden touch-auto transition-all duration-300 ease-in-out ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
      } ${
        isNight
          ? 'bg-neutral-900/90 border-white/10 text-white'
          : 'bg-white/95 border-zinc-300/80 text-zinc-900 shadow-slate-300/50'
      }`}
    >
      {/* Search Input Header */}
      <div className="relative flex items-center p-2 sm:p-2.5">
        <Search
          className={`absolute left-4 sm:left-5 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none transition-colors z-10 ${
            isNight ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        />
        <div className={`w-full flex items-center gap-1.5 border rounded-lg sm:rounded-xl py-1.5 sm:py-2 pl-9 sm:pl-12 pr-2.5 sm:pr-3 min-h-[44px] sm:min-h-[50px] transition-all ${
          isNight
            ? 'bg-zinc-800/80 border-white/10 text-white'
            : 'bg-zinc-100/90 border-zinc-200 text-zinc-900 hover:bg-zinc-100'
        }`}>
          {activeCategory && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600/20 text-blue-500 border border-blue-500/30 shrink-0 select-none">
              <span>{AUTOMOTIVE_CATEGORIES[activeCategory]?.label || activeCategory}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearCategory();
                }}
                className="hover:text-blue-700 dark:hover:text-white p-0.5 rounded cursor-pointer"
                title="Rimuovi filtro categoria"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
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
                  handleItemClick(displayList[0]);
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
            placeholder={
              activeCategory
                ? "Filtra per nome o via..."
                : settingSpecialLocation === 'home'
                ? "Cerca il nuovo indirizzo di casa..."
                : settingSpecialLocation === 'work'
                ? "Cerca il nuovo indirizzo di lavoro..."
                : "Cerca destinazione o recenti..."
            }
            className="w-full bg-transparent text-[15px] font-semibold focus:outline-none placeholder:text-zinc-400 select-text"
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
              className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                isNight ? 'text-zinc-400 hover:text-white hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Expanded Content: Animated grid transition on open & close */}
      <div
        className={`grid transition-all duration-350 ease-in-out border-inherit ${
          isOpen
            ? 'grid-rows-[1fr] opacity-100 translate-y-0 border-t'
            : 'grid-rows-[0fr] opacity-0 -translate-y-2 border-t-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          {/* Persistent Current Street / Location Indicator */}
          {currentStreet && (
            <div className={`px-3.5 pt-2.5 pb-1 text-xs flex items-center gap-2 ${
              isNight ? 'text-zinc-400' : 'text-zinc-500'
            }`}>
              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-semibold truncate tracking-wide">{currentStreet}</span>
            </div>
          )}

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
                <button
                  id="btn-choose-special-on-map"
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetType = settingSpecialLocation || 'home';
                    setSettingSpecialLocation(null);
                    setIsOpen(false);
                    window.dispatchEvent(new CustomEvent('start-map-point-picker', { detail: { type: targetType } }));
                  }}
                  title="Scegli un punto toccando la mappa"
                  className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                    isNight
                      ? 'bg-blue-600/30 border-blue-500/50 text-blue-300 hover:bg-blue-600/50'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>Sulla mappa</span>
                </button>
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

          {/* Quick Categories Bar with Mini Navigation Chevrons and Drag-to-Scroll */}
          <div className="relative flex items-center px-1.5 py-1">
            {/* Left Mini Arrow */}
            <button
              id="cat-scroll-left-btn"
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (categoriesRef.current) {
                  categoriesRef.current.scrollBy({ left: -140, behavior: 'smooth' });
                }
              }}
              title="Scorri categorie a sinistra"
              className={`p-1 rounded-full transition-all flex-shrink-0 cursor-pointer select-none active:scale-90 ${
                isNight
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div
              ref={categoriesRef}
              onMouseDown={handleCategoriesMouseDown}
              onMouseMove={handleCategoriesMouseMove}
              onMouseUp={handleCategoriesMouseUpOrLeave}
              onMouseLeave={handleCategoriesMouseUpOrLeave}
              className="flex items-center gap-2 px-1.5 py-1.5 overflow-x-auto scrollbar-none select-none cursor-grab active:cursor-grabbing touch-pan-x flex-1"
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
                      handleCategoryClick(cat.id);
                    }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all select-none active:scale-95 cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : isNight
                        ? 'bg-zinc-800/70 border-white/5 text-zinc-200 hover:bg-zinc-700 hover:text-white hover:border-zinc-500'
                        : 'bg-zinc-100 border-zinc-200/80 text-zinc-800 hover:bg-zinc-200 hover:text-zinc-950 hover:border-zinc-400'
                    }`}
                  >
                    <span className={`p-1 rounded-md ${activeCategory === cat.id ? 'bg-white/20 text-white' : cat.color} shrink-0 pointer-events-none`}>
                      <IconComp className="w-3.5 h-3.5" />
                    </span>
                    <span className="whitespace-nowrap shrink-0 pointer-events-none">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Mini Arrow */}
            <button
              id="cat-scroll-right-btn"
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (categoriesRef.current) {
                  categoriesRef.current.scrollBy({ left: 140, behavior: 'smooth' });
                }
              }}
              title="Scorri categorie a destra"
              className={`p-1 rounded-full transition-all flex-shrink-0 cursor-pointer select-none active:scale-90 ${
                isNight
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Results or Recents List */}
          <div className="flex flex-col max-h-[14rem] sm:max-h-[19rem] overflow-y-auto px-2 pb-2 scrollbar-thin">
            {/* Status: Error with retry */}
            {searchStatus === 'error' && (
              <div className={`p-4 my-2 rounded-xl text-center flex flex-col items-center gap-2 ${
                isNight ? 'bg-rose-950/30 border border-rose-500/20 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                <div className="text-xs font-semibold">{searchError || 'Impossibile completare la ricerca'}</div>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeCategory) {
                      handleCategoryClick(activeCategory);
                    } else if (query.trim()) {
                      handleFullSearch(query.trim());
                    }
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                >
                  Riprova
                </button>
              </div>
            )}

            {/* Status: Loading */}
            {isLoading ? (
              <div className={`flex items-center justify-center gap-2.5 py-7 text-sm font-medium ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Ricerca in corso...</span>
              </div>
            ) : displayList.length > 0 ? (
              <>
                <div
                  className={`px-3 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wider flex items-center justify-between ${
                    isNight ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {!activeCategory && query.length < 2 && (
                      <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                    )}
                    <span>
                      {activeCategory
                        ? (AUTOMOTIVE_CATEGORIES[activeCategory]?.label || activeCategory)
                        : (query.length < 2 ? 'Destinazioni recenti' : 'Luoghi suggeriti')}
                    </span>
                  </div>
                  {results.length > 0 && (
                    <span className="text-[10px] font-medium lowercase opacity-75">{results.length} risultati</span>
                  )}
                  {!activeCategory && query.length < 2 && recents.length > 0 && (
                    <span className="text-[10px] font-normal lowercase opacity-75">{recents.length} salvate</span>
                  )}
                </div>
                {displayList.map((item, idx) => (
                  <button
                    key={`${item.name}_${idx}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick(item);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all active:scale-[0.99] cursor-pointer group border border-transparent ${
                      isNight
                        ? 'hover:bg-zinc-800/60 hover:border-zinc-700/50 text-zinc-200'
                        : 'hover:bg-zinc-100 hover:border-zinc-200/80 text-zinc-800'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {renderIcon(item, !activeCategory && query.length < 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[13.5px] font-medium tracking-tight truncate ${
                            isNight ? 'text-zinc-100 group-hover:text-white' : 'text-zinc-900 group-hover:text-black'
                          }`}
                        >
                          {highlight(item.name, query)}
                        </span>
                        {item.brand && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                            isNight ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                          }`}>
                            {item.brand}
                          </span>
                        )}
                        {item.detourMinutes !== undefined && item.detourMinutes >= 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            +{item.detourMinutes} min deviazione
                          </span>
                        )}
                      </div>
                      {item.address && (
                        <div
                          className={`text-[12px] font-normal truncate mt-0.5 ${
                            isNight ? 'text-zinc-400' : 'text-zinc-500'
                          }`}
                        >
                          {highlight(item.address, query)}
                        </div>
                      )}
                    </div>
                    {item.dk !== undefined && (
                      <div className="flex-shrink-0 text-right pl-2">
                        <div
                          className={`text-[12.5px] font-medium ${
                            isNight ? 'text-zinc-300' : 'text-zinc-700'
                          }`}
                        >
                          {item.dk < 1 ? `${Math.round(item.dk * 1000)} m` : `${item.dk.toFixed(1)} km`}
                        </div>
                        {item.em !== undefined && (
                          <div
                            className={`text-[11px] leading-tight font-normal ${
                              isNight ? 'text-zinc-500' : 'text-zinc-400'
                            }`}
                          >
                            ~{item.em} min
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}

                {/* Subdued Category Suggestions Pill Bar at bottom of results */}
                {typeaheadSuggestions.length > 0 && query.trim().length >= 1 && (
                  <div className="mt-2 pt-2 border-t border-inherit flex items-center gap-1.5 overflow-x-auto px-1">
                    <span className="text-[11px] opacity-60 shrink-0">Suggeriti:</span>
                    {typeaheadSuggestions.map((sug, sIdx) => (
                      <button
                        key={`sug_${sIdx}`}
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryClick(sug.category === 'fuel' ? 'benzina' : sug.category === 'hotel' ? 'hotel' : sug.category === 'restaurant' ? 'ristorante' : sug.category === 'charging' ? 'ricarica veicoli elettrici' : sug.category === 'pharmacy' ? 'farmacia' : sug.category === 'supermarket' ? 'supermercato' : sug.category === 'parking' ? 'parcheggio' : sug.text);
                        }}
                        className={`text-[11.5px] font-medium px-2 py-0.5 rounded-md shrink-0 transition-colors ${
                          isNight ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : query.length >= 2 ? (
              <div className="py-6 px-4 text-center">
                <div className={`text-sm font-medium ${isNight ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Nessun luogo trovato per &ldquo;{query}&rdquo;
                </div>
                <div className={`text-xs mt-1 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Verifica l'ortografia o prova a cercare per categoria (es. benzina, parcheggio)
                </div>
                {typeaheadSuggestions.length > 0 && (
                  <div className="mt-3 flex justify-center gap-1.5 flex-wrap">
                    {typeaheadSuggestions.map((sug, sIdx) => (
                      <button
                        key={`empty_sug_${sIdx}`}
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryClick(sug.category === 'fuel' ? 'benzina' : sug.category === 'hotel' ? 'hotel' : sug.category === 'restaurant' ? 'ristorante' : sug.category === 'charging' ? 'ricarica veicoli elettrici' : sug.category === 'pharmacy' ? 'farmacia' : sug.category === 'supermarket' ? 'supermercato' : sug.category === 'parking' ? 'parcheggio' : sug.text);
                        }}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                          isNight ? 'bg-zinc-800 text-blue-400 hover:bg-zinc-700' : 'bg-zinc-100 text-blue-600 hover:bg-zinc-200'
                        }`}
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                )}
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
      </div>
    </div>
  );
}
