
import React, { useState, useEffect } from 'react';
import { routeStore } from './routeStore';

interface DebugOverlayProps {
  navigationTarget: { lat: number, lng: number, name: string } | null;
  miniMapRoutePropLength: number;
}

export default function DebugOverlay({ navigationTarget, miniMapRoutePropLength }: DebugOverlayProps) {
  const [storeCoordsLength, setStoreCoordsLength] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>('Never');

  useEffect(() => {
    const unsubscribe = routeStore.subscribe((coords) => {
      setStoreCoordsLength(coords?.length || 0);
      setLastUpdated(new Date().toLocaleTimeString());
    });
    return unsubscribe;
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '0.625rem',
      left: '0.625rem',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: 'lime',
      padding: '0.75rem',
      borderRadius: '0.5rem',
      zIndex: 99999,
      fontFamily: 'monospace',
      fontSize: '0.875rem',
      border: '1px solid lime',
      maxWidth: '21.875rem',
      lineHeight: '1.4'
    }}>
      <h3 style={{ margin: 0, paddingBottom: '0.3125rem', borderBottom: '1px solid #555', color: 'white' }}>DEBUGGER DI ROTTA (ON-SCREEN)</h3>
      <div style={{ marginTop: '0.5rem' }}>
        <div><strong style={{ color: 'white' }}>Stato Nav:</strong> {navigationTarget ? <span style={{color: 'yellow'}}>ATTIVA</span> : 'INATTIVA'}</div>
        <div><strong style={{ color: 'white' }}>Destinazione:</strong> {navigationTarget?.name || 'N/D'}</div>
        <hr style={{ margin: '8px 0', borderColor: '#444' }}/>
        
        <div style={{color: 'cyan'}}><strong>&#9679; Route Store (Singleton):</strong></div>
        <div style={{ paddingLeft: '0.625rem' }}>
          <div><strong>Coords:</strong> {storeCoordsLength} punti</div>
          <div><strong>Last Update:</strong> {lastUpdated}</div>
        </div>

        <hr style={{ margin: '8px 0', borderColor: '#444' }}/>
        
        <div style={{color: 'magenta'}}><strong>&#9679; Prop `miniMapRoute` (Legacy):</strong></div>
        <div style={{ paddingLeft: '0.625rem' }}>
          <div><strong>Coords:</strong> {miniMapRoutePropLength} punti</div>
        </div>

        <hr style={{ margin: '8px 0', borderColor: '#444' }}/>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          {storeCoordsLength > 0 && miniMapRoutePropLength === 0 ? "⚠️ Store ha dati, ma la prop è vuota. Problema di passaggio dati!" : ""}
          {storeCoordsLength === 0 && miniMapRoutePropLength > 0 ? "⚠️ Prop ha dati, ma lo store è vuoto. Problema di sincronizzazione!" : ""}
          {storeCoordsLength > 0 && miniMapRoutePropLength > 0 && storeCoordsLength !== miniMapRoutePropLength ? "⚠️ Dati non sincronizzati tra Store e Prop!" : ""}
        </div>
      </div>
    </div>
  );
}
