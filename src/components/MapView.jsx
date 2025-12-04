import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MapView = ({ projectData }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
        if (!token) {
            console.error("Mapbox token is missing!");
            return;
        }
        mapboxgl.accessToken = token;

        if (map.current) return; // initialize map only once

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [121.5654, 25.0375], // Taipei City Hall
            zoom: 13,
            attributionControl: false
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
        map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

        map.current.on('load', () => {
            renderProject(map.current, projectData);
        });
    }, []);

    useEffect(() => {
        if (!map.current || !map.current.isStyleLoaded()) return;
        renderProject(map.current, projectData);
    }, [projectData]);

    const renderProject = (mapInstance, data) => {
        const { center, ringMinutes, pois, name } = data;

        // 1. Fly to center
        mapInstance.flyTo({
            center: center,
            zoom: 13,
            essential: true
        });

        // 2. Update Marker
        if (markerRef.current) markerRef.current.remove();

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
            .setHTML(`<div class="popup-title">${name}</div><div class="popup-subtitle">建案基地位置</div>`);

        markerRef.current = new mapboxgl.Marker({ color: '#007aff' })
            .setLngLat(center)
            .setPopup(popup)
            .addTo(mapInstance)
            .togglePopup();

        // 3. Update Rings
        // Create features for each ring
        const ringFeatures = ringMinutes.map(m => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: center },
            properties: { minutes: m }
        }));

        const ringSourceData = {
            type: 'FeatureCollection',
            features: ringFeatures
        };

        const ringSourceId = 'project-rings';
        if (mapInstance.getSource(ringSourceId)) {
            mapInstance.getSource(ringSourceId).setData(ringSourceData);
        } else {
            mapInstance.addSource(ringSourceId, {
                type: 'geojson',
                data: ringSourceData
            });

            // Circle Layer (Fill)
            mapInstance.addLayer({
                id: 'rings-fill',
                type: 'circle',
                source: ringSourceId,
                paint: {
                    // Approximate: 1 min driving ~ 500m. At zoom 13 (lat 25), 1px ~ 19m.
                    // 500m ~ 26px.
                    // Formula: minutes * 26 * 2^(zoom - 13)
                    'circle-radius': [
                        'interpolate', ['exponential', 2], ['zoom'],
                        13, ['*', ['get', 'minutes'], 26],
                        22, ['*', ['get', 'minutes'], 26 * 512] // 2^(22-13) = 2^9 = 512
                    ],
                    'circle-color': '#007aff',
                    'circle-opacity': 0.06,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#007aff',
                    'circle-stroke-opacity': 0.4
                }
            });

            // Symbol Layer for Text
            mapInstance.addLayer({
                id: 'rings-label',
                type: 'symbol',
                source: ringSourceId,
                layout: {
                    'text-field': ['concat', ['get', 'minutes'], ' 分鐘車程圈'],
                    'text-size': 12,
                    'text-offset': [0, -1], // slightly above
                    'text-anchor': 'bottom'
                },
                paint: {
                    'text-color': '#6b7280',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2
                }
            });
        }

        // 4. Update POIs
        const poiFeatures = pois.map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: p.coord },
            properties: { ...p }
        }));

        const poiSourceId = 'project-pois';
        const poiSourceData = { type: 'FeatureCollection', features: poiFeatures };

        if (mapInstance.getSource(poiSourceId)) {
            mapInstance.getSource(poiSourceId).setData(poiSourceData);
        } else {
            mapInstance.addSource(poiSourceId, {
                type: 'geojson',
                data: poiSourceData
            });

            // Circle Layer for POI dots
            mapInstance.addLayer({
                id: 'pois-circle',
                type: 'circle',
                source: poiSourceId,
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#ffffff',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#111827'
                }
            });

            // Symbol Layer for POI names
            mapInstance.addLayer({
                id: 'pois-label',
                type: 'symbol',
                source: poiSourceId,
                layout: {
                    'text-field': ['get', 'name'],
                    'text-size': 11,
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top'
                },
                paint: {
                    'text-color': '#111827',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2
                }
            });

            // Click event for POIs
            mapInstance.on('click', 'pois-circle', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const { name, type, minutes } = e.features[0].properties;

                new mapboxgl.Popup({ offset: 10, className: 'poi-popup' })
                    .setLngLat(coordinates)
                    .setHTML(`
            <div class="popup-title">${name}</div>
            <div class="popup-subtitle">${type} • 約 ${minutes} 分鐘</div>
          `)
                    .addTo(mapInstance);
            });

            // Change cursor on hover
            mapInstance.on('mouseenter', 'pois-circle', () => {
                mapInstance.getCanvas().style.cursor = 'pointer';
            });
            mapInstance.on('mouseleave', 'pois-circle', () => {
                mapInstance.getCanvas().style.cursor = '';
            });
        }
    };

    return <div ref={mapContainer} className="map-container" />;
};

export default MapView;
