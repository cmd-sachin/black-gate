"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, ScaleControl } from "react-map-gl/mapbox";
import type { MapRef, ViewState, ViewStateChangeEvent, MarkerEvent } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// Approximate country centroids for geo-placement on the map
const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [-98.58, 39.83],
  "China": [104.20, 35.86],
  "Russia": [105.32, 61.52],
  "Germany": [10.45, 51.17],
  "United Kingdom": [-3.44, 55.38],
  "India": [78.96, 20.59],
  "Brazil": [-51.93, -14.24],
  "Japan": [138.25, 36.20],
  "France": [2.21, 46.23],
  "Australia": [133.78, -25.27],
  "Canada": [-106.35, 56.13],
  "South Korea": [127.77, 35.91],
  "Netherlands": [5.29, 52.13],
  "The Netherlands": [5.29, 52.13],
  "Singapore": [103.82, 1.35],
  "Israel": [34.85, 31.05],
  "Iran": [53.69, 32.43],
  "Ukraine": [31.17, 48.38],
  "Poland": [19.15, 51.92],
  "Sweden": [18.64, 60.13],
  "Switzerland": [8.23, 46.82],
  "Hong Kong": [114.17, 22.32],
  "Taiwan": [120.96, 23.70],
  "South Africa": [22.94, -30.56],
  "Mexico": [-102.55, 23.63],
  "Turkey": [35.24, 38.96],
  "Romania": [24.97, 45.94],
  "Italy": [12.57, 41.87],
  "Spain": [-3.75, 40.46],
  "Indonesia": [113.92, -0.79],
  "Thailand": [100.99, 15.87],
  "Vietnam": [108.28, 14.06],
  "Argentina": [-63.62, -38.42],
  "Egypt": [30.80, 26.82],
  "Nigeria": [8.68, 9.08],
  "Pakistan": [69.35, 30.38],
  "Bangladesh": [90.36, 23.68],
  "Colombia": [-74.30, 4.57],
  "Saudi Arabia": [45.08, 23.89],
  "United Arab Emirates": [53.85, 23.42],
  "Finland": [25.75, 61.92],
  "Norway": [8.47, 60.47],
  "Denmark": [9.50, 56.26],
  "Belgium": [4.47, 50.50],
  "Czech Republic": [15.47, 49.82],
};

interface ThreatOrigin {
  country: string;
  incident_count: number;
  total_alerts: number;
  severities: Record<string, number>;
  last_seen: string | null;
  sample_ips: string[];
}

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  country: string;
  incidentCount: number;
  totalAlerts: number;
  color: string;
  severities: Record<string, number>;
  lastSeen: string | null;
  sampleIps: string[];
}

function getSeverityColor(severities: Record<string, number>): string {
  if (severities.critical > 0) return "#ef4444";
  if (severities.high > 0) return "#f97316";
  if (severities.medium > 0) return "#eab308";
  return "#3b82f6";
}

export default function ThreatMap() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState<Partial<ViewState>>({
    longitude: 20,
    latitude: 25,
    zoom: 1.5,
  });
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Fetch threat origins from Elasticsearch via our API
  useEffect(() => {
    fetch(`${API_BASE}/api/geo/threat-origins`)
      .then((res) => res.json())
      .then((data) => {
        const origins: ThreatOrigin[] = data.origins || [];
        const mapped: MapMarker[] = origins
          .map((origin) => {
            const coords = COUNTRY_COORDS[origin.country];
            if (!coords) return null;
            return {
              id: origin.country,
              latitude: coords[1],
              longitude: coords[0],
              country: origin.country,
              incidentCount: origin.incident_count,
              totalAlerts: origin.total_alerts,
              color: getSeverityColor(origin.severities),
              severities: origin.severities,
              lastSeen: origin.last_seen,
              sampleIps: origin.sample_ips,
            };
          })
          .filter(Boolean) as MapMarker[];
        setMarkers(mapped);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch threat origins", err);
        setIsLoading(false);
      });
  }, []);

  const onMarkerClick = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker);
    mapRef.current?.flyTo({
      center: [marker.longitude, marker.latitude],
      zoom: 4.5,
      duration: 1000,
      essential: true,
    });
  }, []);

  if (!token) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded-xl p-6">
        <div className="text-amber-400 mb-2">⚠️ Mapbox token missing</div>
        <p className="text-slate-400 text-sm text-center">
          Add <code className="bg-slate-800 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to your .env.local
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={token}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={[]}
      >
        <NavigationControl position="top-right" />
        <ScaleControl />

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            longitude={marker.longitude}
            latitude={marker.latitude}
            anchor="center"
            onClick={(e: MarkerEvent<MouseEvent>) => {
              e.originalEvent.stopPropagation();
              onMarkerClick(marker);
            }}
          >
            <div className="relative group cursor-pointer">
              <div
                className="w-10 h-10 rounded-full bg-black/70 border-2 flex items-center justify-center text-xs font-bold shadow-lg transition-transform group-hover:scale-110"
                style={{ borderColor: marker.color, color: marker.color }}
              >
                {marker.incidentCount}
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none text-white">
                {marker.country}
              </div>
            </div>
          </Marker>
        ))}

        {selectedMarker && (
          <Popup
            longitude={selectedMarker.longitude}
            latitude={selectedMarker.latitude}
            anchor="top"
            closeOnClick={false}
            onClose={() => setSelectedMarker(null)}
            className="dark-popup"
          >
            <div className="max-w-sm">
              <h3 className="font-bold text-lg mb-1">{selectedMarker.country}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                <span className="font-mono font-bold">{selectedMarker.incidentCount}</span> incidents
                {" · "}
                <span className="font-mono">{selectedMarker.totalAlerts}</span> alerts
              </p>

              {/* Severity breakdown */}
              <div className="flex gap-2 mb-3">
                {Object.entries(selectedMarker.severities).map(([sev, count]) => (
                  <span
                    key={sev}
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      sev === "critical"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : sev === "high"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        : sev === "medium"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}
                  >
                    {sev}: {count}
                  </span>
                ))}
              </div>

              {/* Sample IPs */}
              {selectedMarker.sampleIps.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                  <p className="text-xs text-slate-500 mb-1">Sample IPs:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedMarker.sampleIps.map((ip) => (
                      <span key={ip} className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {ip}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedMarker.lastSeen && (
                <p className="text-xs text-slate-400 mt-2">
                  Last seen: {new Date(selectedMarker.lastSeen).toLocaleString()}
                </p>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
          <span className="text-sm text-slate-300 animate-pulse">Loading threat origins from Elasticsearch…</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && markers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="text-sm text-slate-500 bg-black/50 px-4 py-2 rounded-lg">
            No geo data yet — run a simulation first
          </span>
        </div>
      )}

      <div className="absolute bottom-2 left-2 text-xs text-white/50 bg-black/40 px-2 py-1 rounded z-10 pointer-events-none">
        © Mapbox © OpenStreetMap
      </div>
    </div>
  );
}
