import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Home, Briefcase, Clock, MapPin, ShoppingBag } from 'lucide-react';

const AC_API_KEY = '0d2c9c7f72c0477eb3260838db72a383';

interface LocationInfo {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  isShop?: boolean;
  dk?: number;
  em?: number;
}

interface SearchPanelProps {
  rpos: { lat: number; lng: number } | null;
  onSelectDestination: (dest: LocationInfo) => void;
  homeLocation: LocationInfo | null;
  workLocation: LocationInfo | null;
  isVisible: boolean;
  onSaveCurrentLocationAs?: (type: 'home' | 'work', loc: LocationInfo) => void;
}

export default function SearchPanel({
  rpos,
  onSelectDestination,
  homeLocation,
  workLocation,
  isVisible,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recents, setRecents] = useState<LocationInfo[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('rec_dest');
      if (stored) {
        setRecents(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recents from localStorage', e);
    }
  }, []);

  // Distance computation helper
  const dist = (la1: number, lo1: number, la2: number, lo2: number) => {
    const R = 6371e3;
    const p1 = (la1 * Math.PI) / 180;
    const p2 = (la2 * Math.PI) / 180;
    const dp = ((la2 - la1) * Math.PI) / 180;
    const dl = ((lo2 - lo1) * Math.PI) / 180;
    const a =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const sGeo = async (q: string): Promise<LocationInfo[]> => {
    try {
      const b = rpos ? `&bias=proximity:${rpos.lng},${rpos.lat}` : '';
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
        q
      )}&lang=it&limit=10&filter=countrycode:it${b}&apiKey=${AC_API_KEY}`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const d = await r.json();
      return (d.features || [])
        .map((f: any) => {
          const p2 = f.properties;
          const nm =
            p2.name ||
            (p2.street
              ? p2.street + (p2.housenumber ? ' ' + p2.housenumber : '')
              : '') ||
            p2.formatted ||
            '';
          const ad =
            p2.address_line2 ||
            [p2.city || p2.town || p2.village, p2.state].filter(Boolean).join(', ') ||
            '';
          return { lat: p2.lat, lng: p2.lon, name: nm, address: ad };
        })
        .filter((r: LocationInfo) => r.lat && r.lng && r.name);
    } catch (e) {
      return [];
    }
  };

  const sNom = async (q: string): Promise<LocationInfo[]> => {
    try {
      const v = rpos
        ? `&viewbox=${rpos.lng - 0.5},${rpos.lat + 0.3},${rpos.lng + 0.5},${rpos.lat - 0.3}&bounded=0`
        : '';
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=jsonv2&limit=6&addressdetails=1&countrycodes=it${v}`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const d = await r.json();
      return (d || [])
        .map((i: any) => {
          const a = i.address || {};
          const nm =
            i.name ||
            a.road ||
            a.amenity ||
            a.shop ||
            i.display_name.split(',')[0] ||
            '';
          const pts = [];
          if (a.house_number && a.road) pts.push(a.road + ' ' + a.house_number);
          else if (a.road) pts.push(a.road);
          if (a.city || a.town || a.village) pts.push(a.city || a.town || a.village);
          return {
            lat: parseFloat(i.lat),
            lng: parseFloat(i.lon),
            name: nm,
            address: pts.join(', '),
          };
        })
        .filter((r: LocationInfo) => r.lat && r.lng && r.name);
    } catch (e) {
      return [];
    }
  };

  const handleSearch = async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      let res = await sGeo(q);
      if (res.length < 2) {
        const nom = await sNom(q);
        nom.forEach((n: LocationInfo) => {
          if (n.name.length < 2) return;
          if (
            !res.some(
              (r) => Math.abs(r.lat - n.lat) < 0.001 && Math.abs(r.lng - n.lng) < 0.001
            )
          ) {
            res.push(n);
          }
        });
      }
      res.forEach((r) => {
        if (rpos) {
          r.dk = dist(rpos.lat, rpos.lng, r.lat, r.lng) / 1000;
          r.em = (r.dk / (r.dk > 200 ? 80 : r.dk > 30 ? 60 : 40)) * 60;
        }
        r.isShop =
          !!r.address &&
          (r.address.includes('via') ||
            r.address.includes('strada') ||
            r.address.includes('piazza'));
      });

      if (rpos) {
        res.sort((a, b) => {
          const an = a.name && a.name !== a.address;
          const bn = b.name && b.name !== b.address;
          if (an && !bn) return -1;
          if (!an && bn) return 1;
          return (a.dk || 9999) - (b.dk || 9999);
        });
      }

      setResults(res.slice(0, 10));
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length >= 2) {
      timerRef.current = setTimeout(() => handleSearch(query.trim()), 300);
    } else {
      setResults([]);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const handleSelect = (item: LocationInfo) => {
    const nr = [
      item,
      ...recents.filter(
        (r) => !(r.name === item.name && Math.abs(r.lat - item.lat) < 0.0001)
      ),
    ].slice(0, 5);
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

  const highlight = (text: string, q: string) => {
    if (!text || !q) return text || '';
    const pts = q.trim().split(/\s+/).filter((p) => p.length > 0);
    if (!pts.length) return text;
    const reg = pts.map((p) => p?.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') || '').join('|');
    const regex = new RegExp(`(${reg})`, 'gi');
    
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <strong key={i} className="text-white font-extrabold">{part}</strong>
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
    <div className="w-full bg-neutral-900/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg overflow-hidden relative z-20 pointer-events-auto">
      <div className="relative flex items-center p-3">
        <Search className="absolute left-6 text-zinc-400 w-5 h-5 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Cerca destinazione"
          className="w-full bg-zinc-800/80 border border-transparent rounded-lg py-2.5 pl-11 pr-10 text-white text-sm font-medium focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-500"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-5 p-1.5 text-zinc-500 hover:text-white rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col max-h-[17.5rem] overflow-y-auto px-2 pb-2 scrollbar-thin">
          {isLoading && query.length >= 2 ? (
            <div className="text-center p-4 text-zinc-400 text-sm">Ricerca...</div>
          ) : displayList.length > 0 ? (
            <>
              {query.length < 2 && (
                <div className="px-3 py-1.5 text-[0.6875rem] font-bold text-zinc-500 uppercase tracking-wider">
                  Recenti
                </div>
              )}
              {displayList.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center gap-4 p-2.5 hover:bg-white/10 rounded-lg text-left transition-colors active:scale-[0.98]"
                >
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      item.isShop
                        ? 'bg-orange-500/15 text-orange-500'
                        : 'bg-blue-500/15 text-blue-500'
                    } ${query.length < 2 ? '!bg-zinc-800 !text-zinc-400' : ''}`}
                  >
                    {query.length < 2 ? (
                      <Clock className="w-4 h-4" />
                    ) : item.isShop ? (
                      <ShoppingBag className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {highlight(item.name, query)}
                    </div>
                    {item.address && (
                      <div className="text-[0.8125rem] text-zinc-400 truncate">
                        {highlight(item.address, query)}
                      </div>
                    )}
                  </div>
                  {item.dk !== undefined && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-semibold text-white">
                        {item.dk.toFixed(1)} km
                      </div>
                      {item.em && (
                        <div className="text-[0.75rem] text-zinc-400 leading-none mt-1">
                          ~{Math.round(item.em)} min
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </>
          ) : query.length >= 2 ? (
            <div className="text-center p-4 text-zinc-400 text-sm">Nessun risultato</div>
          ) : null}
        </div>
      )}

      {/* Footer trigger options */}
      <div className="flex border-t border-white/10 p-2 gap-2 justify-around">
        <button
          onClick={() => homeLocation && handleSelect(homeLocation)}
          className="flex-1 flex justify-center items-center gap-2 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <Home className="w-4.5 h-4.5 text-zinc-400" /> Casa
        </button>
        <button
          onClick={() => workLocation && handleSelect(workLocation)}
          className="flex-1 flex justify-center items-center gap-2 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <Briefcase className="w-4.5 h-4.5 text-zinc-400" /> Lavoro
        </button>
      </div>
    </div>
  );
}
