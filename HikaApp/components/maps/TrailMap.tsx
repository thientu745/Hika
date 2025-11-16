import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Trail } from '../../types';

interface TrailMapProps {
  trail: Trail;
  height?: number;
}

const TrailMap: React.FC<TrailMapProps> = ({ trail, height = 300 }) => {
  // Generate HTML with Leaflet map
  const htmlContent = useMemo(() => {
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
            <View style={styles.loadingSpinner} />
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

