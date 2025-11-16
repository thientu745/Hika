import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

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

interface ActiveTrailMapProps {
  path: Array<{ latitude: number; longitude: number; altitude?: number }>;
  currentLocation?: { latitude: number; longitude: number };
  height?: number;
}

const ActiveTrailMap: React.FC<ActiveTrailMapProps> = ({ 
  path, 
  currentLocation,
  height = 400 
}) => {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const domNodeRef = useRef<HTMLElement | null>(null);

  // Web: Load Leaflet from CDN
  const loadLeaflet = React.useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        reject(new Error('Not on web platform'));
        return;
      }

      if (L && (window as any).L) {
        L = (window as any).L;
        resolve(L);
        return;
      }

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

      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

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

  // Web: Initialize Leaflet map
  const initMap = React.useCallback(async () => {
    if (Platform.OS !== 'web' || !domNodeRef.current) return;
    if (typeof window === 'undefined') return;

    if (!L) {
      try {
        await loadLeaflet();
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        return;
      }
    }

    if (!L) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      const mapElement = domNodeRef.current;
      if (!mapElement) return;

      const center = currentLocation || (path.length > 0 ? path[path.length - 1] : { latitude: 0, longitude: 0 });

      const map = L.map(mapElement, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        touchZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      map.setView([center.latitude, center.longitude], 15);
      mapInstanceRef.current = map;
      setMapReady(true);
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Update polyline
    if (path.length > 0) {
      const pathCoords = path.map((p) => [p.latitude, p.longitude] as [number, number]);
      
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(pathCoords);
      } else {
        const polyline = L.polyline(pathCoords, {
          color: '#10b981',
          weight: 5,
          opacity: 0.8,
        }).addTo(map);
        polylineRef.current = polyline;
      }

      // Add start marker if path has points
      if (path.length > 0 && !map.hasLayer || !(map as any)._startMarker) {
        const startMarker = L.marker(pathCoords[0], {
          icon: L.divIcon({
            className: 'start-marker',
            html: '<div style="background-color: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        }).addTo(map);
        startMarker.bindPopup('Start');
        (map as any)._startMarker = startMarker;
      }

      // Fit bounds to path
      const bounds = L.latLngBounds(pathCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Update current location marker
    if (currentLocation) {
      if (currentMarkerRef.current) {
        currentMarkerRef.current.setLatLng([currentLocation.latitude, currentLocation.longitude]);
      } else {
        const marker = L.marker([currentLocation.latitude, currentLocation.longitude], {
          icon: L.divIcon({
            className: 'current-marker',
            html: '<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(map);
        marker.bindPopup('Current Location');
        currentMarkerRef.current = marker;
      }
    }
  }, [path, currentLocation, loadLeaflet]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (domNodeRef.current) {
      initMap();
    }
  }, [path, currentLocation, initMap]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        polylineRef.current = null;
        currentMarkerRef.current = null;
      }
    };
  }, []);

  // Mobile: Generate HTML with Leaflet map for WebView
  const htmlContent = useMemo(() => {
    if (Platform.OS === 'web') return '';
    
    const pathCoords = path.map(p => `[${p.latitude}, ${p.longitude}]`).join(', ');
    const currentLoc = currentLocation 
      ? `[${currentLocation.latitude}, ${currentLocation.longitude}]`
      : 'null';
    
    const center = currentLocation || (path.length > 0 ? path[path.length - 1] : { latitude: 0, longitude: 0 });
    
    let boundsScript = '';
    if (path.length > 0) {
      const lats = path.map(p => p.latitude);
      const lngs = path.map(p => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      boundsScript = `
        var bounds = [[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]];
        map.fitBounds(bounds, { padding: [50, 50] });
      `;
    } else {
      boundsScript = `map.setView([${center.latitude}, ${center.longitude}], 15);`;
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

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 19
            }).addTo(map);

            var pathCoords = [${pathCoords}];
            var currentLoc = ${currentLoc};
            var polyline = null;
            var startMarker = null;
            var currentMarker = null;

            function updateMap() {
              // Update polyline
              if (pathCoords.length > 0) {
                if (polyline) {
                  polyline.setLatLngs(pathCoords);
                } else {
                  polyline = L.polyline(pathCoords, {
                    color: '#10b981',
                    weight: 5,
                    opacity: 0.8
                  }).addTo(map);

                  // Add start marker
                  startMarker = L.marker(pathCoords[0], {
                    icon: L.divIcon({
                      className: 'start-marker',
                      html: '<div style="background-color: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                      iconSize: [20, 20],
                      iconAnchor: [10, 10]
                    })
                  }).addTo(map);
                  startMarker.bindPopup('Start');
                }

                ${boundsScript}
              }

              // Update current location marker
              if (currentLoc) {
                if (currentMarker) {
                  currentMarker.setLatLng(currentLoc);
                } else {
                  currentMarker = L.marker(currentLoc, {
                    icon: L.divIcon({
                      className: 'current-marker',
                      html: '<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })
                  }).addTo(map);
                  currentMarker.bindPopup('Current Location');
                }
              }
            }

            updateMap();

            // Listen for messages from React Native to update the map
            window.addEventListener('message', function(event) {
              try {
                var data = JSON.parse(event.data);
                if (data.type === 'updatePath') {
                  pathCoords = data.path;
                  currentLoc = data.currentLocation || null;
                  updateMap();
                }
              } catch (e) {
                console.error('Error updating map:', e);
              }
            });

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
  }, [path, currentLocation]);

  // Web: Render Leaflet map directly
  if (Platform.OS === 'web') {
    const setMapRef = (node: HTMLElement | null) => {
      if (node && !domNodeRef.current) {
        domNodeRef.current = node;
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
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && webViewRef.current) {
      // Send update message to WebView
      webViewRef.current.postMessage(JSON.stringify({
        type: 'updatePath',
        path: path.map(p => [p.latitude, p.longitude]),
        currentLocation: currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null,
      }));
    }
  }, [path, currentLocation]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
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
});

export default ActiveTrailMap;

