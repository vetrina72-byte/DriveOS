import React from 'react';

/**
 * Costanti condivise per il posizionamento e l'ergonomia touch dell'handle (Requisito R4)
 * - HANDLE_GAP_FROM_PANEL: 14px - distanza visibile della pillola dal bordo del pannello
 * - HANDLE_MIN_MARGIN_FROM_VIEWPORT: 12px - margine minimo di sicurezza dal bordo schermo / viewport
 * - HANDLE_TOUCH_SIZE: 48px - area touch minima conforme agli standard HIG / WCAG (>= 44px)
 * - HANDLE_PILL_THICKNESS: 6px - spessore visivo della pillola
 * - HANDLE_PILL_LENGTH: 64px - lunghezza visiva della pillola
 */
export const HANDLE_GAP_FROM_PANEL = 14;
export const HANDLE_MIN_MARGIN_FROM_VIEWPORT = 12;
export const HANDLE_TOUCH_SIZE = 48;
export const HANDLE_PILL_THICKNESS = 6;
export const HANDLE_PILL_LENGTH = 64;

export interface DrawerHandleProps {
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
  isNight: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  ariaLabel?: string;
}

export const DrawerHandle: React.FC<DrawerHandleProps> = React.memo(({
  orientation,
  isOpen,
  isNight,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ariaLabel = 'Trascina per chiudere',
}) => {
  const isHorizontal = orientation === 'horizontal';
  const pillColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

  // Area di tocco esterna al pannello (touch-action: none per evitare scroll concorrente del browser)
  // Orizzontale: ancorata a sinistra del pannello (right: 100%), centrata verticalmente (top: 50%, -translate-y-1/2)
  // Verticale (layered): ancorata sopra il pannello (bottom: 100%), centrata orizzontalmente (left: 50%, -translate-x-1/2)
  const containerStyle: React.CSSProperties = isHorizontal
    ? {
        position: 'absolute',
        top: '50%',
        right: '100%',
        transform: 'translateY(-50%)',
        width: `${HANDLE_TOUCH_SIZE}px`,
        height: '112px',
        paddingRight: `${HANDLE_GAP_FROM_PANEL}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }
    : {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '128px',
        height: `${HANDLE_TOUCH_SIZE}px`,
        paddingBottom: `${HANDLE_GAP_FROM_PANEL}px`,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      };

  return (
    <div
      style={containerStyle}
      className={`cursor-grab active:cursor-grabbing z-[6000] group transition-opacity duration-300 ${
        isOpen ? 'opacity-100 bubble-handle pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={ariaLabel}
      role="button"
      tabIndex={0}
    >
      <div
        className={`rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 ${
          isHorizontal
            ? `w-[6px] h-[64px] group-active:scale-y-110 ${pillColorClass}`
            : `w-[64px] h-[6px] group-active:scale-x-110 ${pillColorClass}`
        }`}
      />
    </div>
  );
});

export default DrawerHandle;
