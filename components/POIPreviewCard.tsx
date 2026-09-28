import React from 'react';
import { 
  Navigation, 
  PlusCircle, 
  X, 
  Phone, 
  Globe, 
  Clock, 
  MapPin, 
  Compass, 
  CheckCircle2 
} from 'lucide-react';
import { LocationInfo, AutomotiveCategory } from '../types/maps';
import { BrandBadge, resolveBrand } from './BrandResolver';

interface POIPreviewCardProps {
  poi: LocationInfo | null;
  onClose: () => void;
  onSetDestination: (poi: LocationInfo) => void;
  onAddWaypoint?: (poi: LocationInfo) => void;
  isNavigating?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Distributore Carburante',
  charging: 'Colonnina Ricarica EV',
  parking: 'Parcheggio & Sosta',
  restaurant: 'Ristorazione & Bar',
  hotel: 'Hotel & Ospitalità',
  pharmacy: 'Farmacia & Sanità',
  supermarket: 'Supermercato & Spesa',
  repair: 'Officina & Assistenza',
  airport: 'Aeroporto',
  train_station: 'Stazione Ferroviaria',
  address: 'Indirizzo Civico',
  place: 'Punto di Interesse'
};

export const POIPreviewCard: React.FC<POIPreviewCardProps> = ({
  poi,
  onClose,
  onSetDestination,
  onAddWaypoint,
  isNavigating = false
}) => {
  if (!poi) return null;

  const categoryLabel = CATEGORY_LABELS[poi.category || 'place'] || 'Punto di Interesse';
  const brand = resolveBrand(poi.brand, poi.name, poi.category as AutomotiveCategory);

  // Format distance
  const distanceStr = poi.dk !== undefined 
    ? (poi.dk < 1 ? `${Math.round(poi.dk * 1000)} m` : `${poi.dk.toFixed(1)} km`)
    : undefined;

  // Format drive duration
  const durationStr = poi.em !== undefined
    ? (poi.em < 60 ? `${Math.round(poi.em)} min` : `${Math.floor(poi.em / 60)} h ${Math.round(poi.em % 60)} min`)
    : undefined;

  return (
    <div 
      className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 z-[4100] w-[calc(100%-1.5rem)] sm:w-[26rem] max-w-[26rem] squircle-card rounded-2xl p-4 sm:p-5 bg-zinc-900/90 backdrop-blur-xl border border-white/15 shadow-2xl text-white animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with Brand / Category and Close Button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandBadge 
            brand={poi.brand} 
            placeName={poi.name} 
            category={poi.category as AutomotiveCategory} 
            size={38} 
          />
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              {brand ? brand.name : categoryLabel}
            </span>
            <h3 className="text-lg font-black text-white tracking-tight leading-tight mt-0.5 line-clamp-1">
              {poi.name}
            </h3>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
          title="Chiudi anteprima"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Address */}
      {poi.address && (
        <div className="flex items-start gap-2 mt-3 text-xs text-zinc-300 leading-snug">
          <MapPin className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{poi.address}</span>
        </div>
      )}

      {/* Metrics Row: Distance, Drive Time, Status */}
      <div className="grid grid-cols-3 gap-2 mt-4 py-2.5 px-3 squircle-card rounded-xl bg-white/5 border border-white/5">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Distanza</span>
          <span className="text-sm font-black text-white mt-0.5">
            {distanceStr || '—'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center text-center border-x border-white/10">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Tempo guida</span>
          <span className="text-sm font-black text-blue-400 mt-0.5">
            {durationStr || '—'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Stato</span>
          {poi.openNow !== undefined ? (
            <span className={`text-xs font-bold mt-0.5 flex items-center gap-1 ${poi.openNow ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${poi.openNow ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {poi.openNow ? 'Aperto' : 'Chiuso'}
            </span>
          ) : (
            <span className="text-xs font-semibold text-zinc-300 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-zinc-400" />
              Disponibile
            </span>
          )}
        </div>
      </div>

      {/* Optional Metadata: Phone, Website */}
      {(poi.phone || poi.website) && (
        <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
          {poi.phone && (
            <a 
              href={`tel:${poi.phone}`}
              className="flex items-center gap-1.5 hover:text-white transition-colors bg-white/5 px-2.5 py-1 rounded-lg"
            >
              <Phone className="w-3 h-3 text-emerald-400" />
              <span>{poi.phone}</span>
            </a>
          )}
          {poi.website && (
            <a 
              href={poi.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors bg-white/5 px-2.5 py-1 rounded-lg truncate max-w-[140px]"
            >
              <Globe className="w-3 h-3 text-blue-400" />
              <span className="truncate">Sito web</span>
            </a>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
        <button
          onClick={() => onSetDestination(poi)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 squircle-button rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Navigation className="w-4 h-4 fill-white" />
          <span>{isNavigating ? 'Nuova destinazione' : 'Avvia navigazione'}</span>
        </button>

        {isNavigating && onAddWaypoint && (
          <button
            onClick={() => onAddWaypoint(poi)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 squircle-button rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer"
            title="Aggiungi come tappa intermedia"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Aggiungi tappa</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default POIPreviewCard;
