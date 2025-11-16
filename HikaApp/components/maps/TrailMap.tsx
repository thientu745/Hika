import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Trail } from '../../types';

// For web, we'll use React.createElement to create a div with forwardRef
const WebDiv = Platform.OS === 'web' 
  ? (() => {
      const Div = React.forwardRef<HTMLDivElement, any>((props, ref) => 
        React.createElement('div', { ...props, ref })
      );
      Div.displayName = 'WebDiv';
      return Div;
    })()
  : View;

// Leaflet will be loaded from CDN on web only
let L: any = null;
let leafletLoading = false;

interface TrailMapProps {
  trail: Trail;
  height?: number;
}

const TrailMap: React.FC<TrailMapProps> = ({ trail, height = 300 }) => {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const domNodeRef = useRef<HTMLElement | null>(null);

  // Web: Load Leaflet from CDN (avoids bundler issues)
  const loadLeaflet = React.useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        reject(new Error('Not on web platform'));
        return;
      }

      // If already loaded, return it
      if (L && (window as any).L) {
        L = (window as any).L;
        resolve(L);
        return;
      }

      // If already loading, wait for it
      if (leafletLoading) {
        const checkInterval = setInterval(() => {
          if (L && (window as any).L) {
            L = (window as any).L;
            clearInterval(checkInterval);
            resolve(L);
          }
        }, 100);
        return;
      }

      leafletLoading = true;

      // Load CSS first
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Load Leaflet script from CDN
      if ((window as any).L) {
        L = (window as any).L;
        leafletLoading = false;
        resolve(L);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        L = (window as any).L;
        leafletLoading = false;
        resolve(L);
      };
      script.onerror = () => {
        leafletLoading = false;
        reject(new Error('Failed to load Leaflet script'));
      };
      document.head.appendChild(script);
    });
  }, []);

  // Web: Initialize Leaflet map directly
  const initMap = React.useCallback(async () => {
    if (Platform.OS !== 'web' || !domNodeRef.current) return;
    if (typeof window === 'undefined') return;

    // Load Leaflet from CDN if not already loaded
    if (!L) {
      try {
        await loadLeaflet();
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        return;
      }
    }

    if (!L) return;

    // Clean up existing map if trail changes
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
    }

    const mapElement = domNodeRef.current;
    if (!mapElement) return;

    const lat = trail.coordinates.latitude;
    const lng = trail.coordinates.longitude;

    // Initialize map
    const map = L.map(mapElement, {
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      touchZoom: true,
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add trail path if available
    if (trail.path && trail.path.length > 0) {
      const trailPath = trail.path.map((p) => [p.latitude, p.longitude] as [number, number]);
      
      const polyline = L.polyline(trailPath, {
        color: '#10b981',
        weight: 4,
        opacity: 0.8,
      }).addTo(map);

      // Add start marker
      const startMarker = L.marker(trailPath[0] as [number, number], {
        icon: L.divIcon({
          className: 'start-marker',
          html: '<div style="background-color: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);
      startMarker.bindPopup('Trail Start');

      // Add end marker if different from start
      if (trailPath.length > 1) {
        const endMarker = L.marker(trailPath[trailPath.length - 1] as [number, number], {
          icon: L.divIcon({
            className: 'end-marker',
            html: '<div style="background-color: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        }).addTo(map);
        endMarker.bindPopup('Trail End');
      }

      // Fit bounds to trail
      const bounds = L.latLngBounds(trailPath);
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      // No path, just show a marker at the trail location
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'trail-marker',
          html: '<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      marker.bindPopup(trail.name);
      map.setView([lat, lng], 13);
    }

    mapInstanceRef.current = map;
    setMapReady(true);
  }, [trail, loadLeaflet]);

  // Trigger map initialization when trail changes or DOM node is ready
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (domNodeRef.current) {
      initMap();
    }
  }, [trail, initMap]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Mobile: Generate HTML with Leaflet map for WebView
  const htmlContent = useMemo(() => {
    if (Platform.OS === 'web') return '';
    
    const lat = trail.coordinates.latitude;
    const lng = trail.coordinates.longitude;
    
    // Convert trail path to Leaflet format [lat, lng] if available
    let pathCoordinates = '';
    let boundsScript = '';
    
    if (trail.path && trail.path.length > 0) {
      const coords = trail.path.map(p => `[${p.latitude}, ${p.longitude}]`).join(', ');
      pathCoordinates = `var trailPath = [${coords}];`;
      
      // Calculate bounds to fit the entire trail
      const lats = trail.path.map(p => p.latitude);
      const lngs = trail.path.map(p => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      boundsScript = `
        var bounds = [[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]];
        map.fitBounds(bounds, { padding: [20, 20] });
      `;
    } else {
      // If no path, just show a marker at the trail location
      pathCoordinates = 'var trailPath = [];';
      boundsScript = `map.setView([${lat}, ${lng}], 13);`;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 100%; height: 100%; overflow: hidden; }
            #map { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            var map = L.map('map', {
              zoomControl: true,
              scrollWheelZoom: false,
              doubleClickZoom: true,
              boxZoom: true,
              keyboard: true,
              dragging: true,
              touchZoom: true
            });

            // Add OpenStreetMap tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 19
            }).addTo(map);

            ${pathCoordinates}

            // Add trail path if available
            if (trailPath.length > 0) {
              var polyline = L.polyline(trailPath, {
                color: '#10b981',
                weight: 4,
                opacity: 0.8
              }).addTo(map);

              // Add start marker
              var startMarker = L.marker(trailPath[0], {
                icon: L.divIcon({
                  className: 'start-marker',
                  html: '<div style="background-color: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })
              }).addTo(map);
              startMarker.bindPopup('Trail Start');

              // Add end marker if different from start
              if (trailPath.length > 1) {
                var endMarker = L.marker(trailPath[trailPath.length - 1], {
                  icon: L.divIcon({
                    className: 'end-marker',
                    html: '<div style="background-color: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                  })
                }).addTo(map);
                endMarker.bindPopup('Trail End');
              }

              ${boundsScript}
            } else {
              // No path, just show a marker at the trail location
              var marker = L.marker([${lat}, ${lng}], {
                icon: L.divIcon({
                  className: 'trail-marker',
                  html: '<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })
              }).addTo(map);
              marker.bindPopup('${trail.name.replace(/'/g, "\\'")}');
              ${boundsScript}
            }

            // Prevent scrolling on the page
            document.addEventListener('touchmove', function(e) {
              if (e.target.closest('#map')) {
                return;
              }
              e.preventDefault();
            }, { passive: false });
          </script>
        </body>
      </html>
    `;
  }, [trail]);

  // Web: Render Leaflet map directly
  if (Platform.OS === 'web') {
    // Callback ref to get the actual DOM node and trigger map init
    const setMapRef = (node: HTMLElement | null) => {
      if (node && !domNodeRef.current) {
        domNodeRef.current = node;
        // Trigger map initialization
        initMap();
      } else if (!node) {
        domNodeRef.current = null;
      }
    };

    return (
      <View style={[styles.container, { height }]}>
        {!mapReady && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#10b981" />
          </View>
        )}
        <WebDiv
          ref={setMapRef}
          style={styles.webMapContainer}
        />
      </View>
    );
  }

  // Mobile: Use WebView
  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#10b981" />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webMapContainer: {
    width: '100%',
    height: '100%',
    flex: 1,
    ...(Platform.OS === 'web' && {
      // @ts-ignore - web-specific styles
      position: 'relative',
      zIndex: 0,
    }),
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#E5E7EB',
    borderTopColor: '#10b981',
  },
});

export default TrailMap;

