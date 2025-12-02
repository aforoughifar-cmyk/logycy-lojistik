import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Coordinates for major hubs (Fallback/Demo purposes)
const COORD_MAP: Record<string, [number, number]> = {
  'Mersin': [36.8121, 34.6415],
  'Istanbul': [41.0082, 28.9784],
  'İzmir': [38.4237, 27.1428],
  'Magusa': [35.125, 33.95], // Famagusta
  'Girne': [35.33, 33.32],    // Kyrenia
  'London': [51.5074, -0.1278],
  'Dubai': [25.2048, 55.2708],
  'Shanghai': [31.2304, 121.4737],
  'Hamburg': [53.5511, 9.9937],
  'New York': [40.7128, -74.0060],
  'Rotterdam': [51.9244, 4.4777],
  'Antalya': [36.8969, 30.7133]
};

interface LiveMapProps {
  origin: string;
  destination: string;
  currentLat?: number; // Optional real data
  currentLng?: number; // Optional real data
}

const LiveMap: React.FC<LiveMapProps> = ({ origin, destination, currentLat, currentLng }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map only once
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([35, 30], 4);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapInstance.current);

      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    }

    // --- Logic to Draw Map ---
    if (!mapInstance.current || !markersLayer.current) return;

    // Clear previous layers
    markersLayer.current.clearLayers();

    // Helper to fuzzy match coordinates from city name
    const getCoords = (city: string): [number, number] | null => {
      if (!city) return null;
      const key = Object.keys(COORD_MAP).find(k => city.toLowerCase().includes(k.toLowerCase()));
      return key ? COORD_MAP[key] : null;
    };

    const originCoords = getCoords(origin);
    const destCoords = getCoords(destination);
    
    // Define Icons
    const portIcon = L.divIcon({ 
        html: `<div style="background-color: #cbd5e1; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`, 
        className: 'port-marker', iconSize: [12, 12] 
    });

    const shipIcon = L.divIcon({
        html: `<div style="background-color: #eab308; color: #0f172a; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.8 2.2 8"/><path d="M10 10V4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v6"/></svg>
               </div>`,
        className: 'ship-marker', iconSize: [24, 24], iconAnchor: [12, 12]
    });

    const bounds = L.latLngBounds([]);

    // 1. Plot Origin
    if (originCoords) {
        L.marker(originCoords, { icon: portIcon }).addTo(markersLayer.current).bindPopup(`<b>Çıkış:</b> ${origin}`);
        bounds.extend(originCoords);
    }

    // 2. Plot Destination
    if (destCoords) {
        L.marker(destCoords, { icon: portIcon }).addTo(markersLayer.current).bindPopup(`<b>Varış:</b> ${destination}`);
        bounds.extend(destCoords);
    }

    // 3. Plot Real Ship Location (if provided via API)
    if (currentLat && currentLng) {
        const shipCoords: [number, number] = [currentLat, currentLng];
        L.marker(shipCoords, { icon: shipIcon, zIndexOffset: 1000 }).addTo(markersLayer.current)
         .bindPopup(`<b>Canlı Konum</b><br/>Lat: ${currentLat}<br/>Lng: ${currentLng}`).openPopup();
        bounds.extend(shipCoords);

        // Draw line from origin to ship (past)
        if(originCoords) {
             L.polyline([originCoords, shipCoords], { color: '#3b82f6', weight: 3, opacity: 0.6 }).addTo(markersLayer.current);
        }
        // Draw dashed line from ship to destination (future)
        if(destCoords) {
             L.polyline([shipCoords, destCoords], { color: '#cbd5e1', weight: 3, dashArray: '5, 10', opacity: 0.6 }).addTo(markersLayer.current);
        }

    } else if (originCoords && destCoords) {
        // Fallback: Draw straight curved line if no real data
        L.polyline([originCoords, destCoords], { color: '#cbd5e1', weight: 2, dashArray: '5, 5', opacity: 0.5 }).addTo(markersLayer.current);
    }

    // Fit Map Bounds
    if (bounds.isValid()) {
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    } else {
        mapInstance.current.setView([35, 34], 5);
    }
    
  }, [origin, destination, currentLat, currentLng]);

  return <div ref={mapRef} className="w-full h-full rounded-xl z-0" style={{ minHeight: '300px' }} />;
};

export default LiveMap;