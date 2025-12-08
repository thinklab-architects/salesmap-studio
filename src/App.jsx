import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Components ---

const ControlPanel = ({ projectData, onUpdateProject }) => {
    const [name, setName] = useState(projectData.name || '');
    const [address, setAddress] = useState(projectData.address || '');
    const [ringOption, setRingOption] = useState(projectData.ringMinutes.join(','));
    const [travelMode, setTravelMode] = useState('driving');
    const [geminiKey, setGeminiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [poiCount, setPoiCount] = useState(4);

    const fetchGeocoding = async (queryAddress) => {
        const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
        if (!token) {
            alert("Mapbox Token not found!");
            return null;
        }

        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(queryAddress)}.json?access_token=${token}&country=TW&limit=1`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                return data.features[0];
            }
            return null;
        } catch (error) {
            console.error("Geocoding error:", error);
            return null;
        }
    };

    const fetchGeminiPOIs = async (address, center, apiKey, count) => {
        if (!apiKey) return null;

        try {
            console.log('[fetchGeminiPOIs] Initializing Gemini API with model: gemini-2.5-flash');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `
        你是一個房地產專家。請針對「${address}」（經緯度：${center[1]}, ${center[0]}）
        列出 ${count} 個附近最重要的銷售亮點設施（例如捷運站、商圈、公園、學校、地標）。
        
        請提供每個設施的「完整名稱」與「大概位置」。
        由於你需要提供精確位置，請儘量提供該設施的「地址」或「交叉路口」，以便後續校正。
        
        請回傳純 JSON 格式，不要有 markdown 標記。格式如下：
        [
          { "name": "設施名稱", "type": "類別", "minutes": 預估開車分鐘數(整數), "address": "設施地址或路口", "lat": 參考緯度, "lng": 參考經度 }
        ]
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            return parsed; // Return raw AI results
        } catch (error) {
            console.error("Gemini API Error:", error);
            const msg = `AI Error: ${error.message || error.toString()}`;
            console.error(msg);
            return { error: msg };
        }
    };

    // Helper to correct AI coordinates using Mapbox
    const correctPOILocations = async (pois, centerLat, centerLng) => {
        if (!pois || !Array.isArray(pois)) return [];

        const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
        if (!token) return pois;

        const updated = await Promise.all(pois.map(async (poi) => {
            try {
                // Search Mapbox for the POI name + address near the project center
                const query = `${poi.name} ${poi.address || ''}`;
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=TW&proximity=${centerLng},${centerLat}&limit=1`
                );
                const data = await response.json();

                if (data.features && data.features.length > 0) {
                    const [realLng, realLat] = data.features[0].center;
                    return { ...poi, coord: [realLng, realLat], manual: false }; // Found real location
                } else {
                    return { ...poi, coord: [poi.lng, poi.lat], manual: true }; // Fallback to AI guess
                }
            } catch (e) {
                console.warn("Geocoding failed for", poi.name, e);
                return { ...poi, coord: [poi.lng, poi.lat], manual: true };
            }
        }));
        return updated;
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setErrorMsg('');

        // Parse ring option string "5,10,15" -> [5, 10, 15]
        const rings = ringOption.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

        let newCenter = projectData.center;
        let newPois = projectData.pois;

        // 1. Fetch Geocoding for Project Address
        if (address) {
            const result = await fetchGeocoding(address);
            if (result) {
                newCenter = result.center; // [lng, lat]

                // 2. Fetch Gemini POIs
                const apiKey = geminiKey || import.meta.env.VITE_GEMINI_API_KEY;
                if (apiKey) {
                    const aiResult = await fetchGeminiPOIs(address, newCenter, apiKey, poiCount);
                    if (aiResult && aiResult.error) {
                        setErrorMsg(aiResult.error);
                    } else if (aiResult) {
                        // 3. CORRECT LOCATIONS using Mapbox
                        newPois = await correctPOILocations(aiResult, newCenter[1], newCenter[0]);
                    }
                } else {
                    // Fallback to mock if no key provided
                    const [lng, lat] = newCenter;
                    // Generate mock POIs based on count (just duplicating for demo if count > 4)
                    const baseMock = [
                        { name: '最近捷運站', type: '捷運站', minutes: 3, coord: [lng + 0.004, lat + 0.002] },
                        { name: '核心商圈', type: '商業機能', minutes: 5, coord: [lng - 0.003, lat - 0.001] },
                        { name: '文化園區', type: '文化 / 展演', minutes: 7, coord: [lng + 0.002, lat - 0.004] },
                        { name: '知名地標', type: '地標', minutes: 4, coord: [lng - 0.002, lat + 0.003] }
                    ];
                    newPois = Array(poiCount).fill(null).map((_, i) => baseMock[i % baseMock.length]);
                }
            } else {
                alert("找不到此地址，請嘗試更詳細的地址！");
            }
        }

        onUpdateProject({
            ...projectData,
            name,
            address,
            center: newCenter,
            pois: newPois,
            ringMinutes: rings.length > 0 ? rings : [5, 10, 15],
        });

        setIsLoading(false);
    };

    return (
        <div className="control-panel">
            <div className="panel-header">
                <h1>自動生成銷售地圖</h1>
                <p>輸入案名與地址，系統將標示要點與車程同心圓</p>
            </div>

            <div className="form-group">
                <label>Gemini API Key (選填)</label>
                <input
                    type="password"
                    className="input-field"
                    placeholder="貼上 API Key 以啟用 AI 生成"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label>POI 數量</label>
                <input
                    type="number"
                    className="input-field"
                    min="1"
                    max="10"
                    value={poiCount}
                    onChange={(e) => setPoiCount(parseInt(e.target.value) || 4)}
                />
            </div>

            <div className="form-group">
                <label>案名</label>
                <input
                    type="text"
                    className="input-field"
                    placeholder="例如：信義璞園"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label>地址</label>
                <input
                    type="text"
                    className="input-field"
                    placeholder="例如：台北市信義區市府路45號"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
            </div>

            <div className="form-group">
                <label>車程等級</label>
                <select
                    className="select-field"
                    value={ringOption}
                    onChange={(e) => setRingOption(e.target.value)}
                >
                    <option value="5,10,15">5 / 10 / 15 分鐘</option>
                    <option value="3,6,9">3 / 6 / 9 分鐘</option>
                    <option value="8,15,25">8 / 15 / 25 分鐘</option>
                </select>
            </div>

            <div className="form-group">
                <label>交通方式</label>
                <select
                    className="select-field"
                    value={travelMode}
                    onChange={(e) => setTravelMode(e.target.value)}
                >
                    <option value="driving">開車</option>
                    <option value="cycling">機車 / 單車</option>
                    <option value="walking">步行</option>
                </select>
            </div>

            <button className="btn-primary" onClick={handleGenerate} disabled={isLoading}>
                {isLoading ? '生成中...' : '⚡ 生成銷售地圖'}
            </button>

            <p className="hint-text">
                {import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ? '已連接 Mapbox Geocoding API' : '未設定 Mapbox Token'}
                <br />
                {geminiKey ? '已啟用 Gemini AI' : '使用預設 POI (填入 Key 以啟用 AI)'}
            </p>

            {errorMsg && (
                <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '4px', marginBottom: '10px', fontSize: '0.9em' }}>
                    <strong>錯誤：</strong> {errorMsg}
                </div>
            )}

            <div className="poi-section">
                <h3>重點設施（AI 精選示意）</h3>
                <div className="poi-list">
                    {projectData.pois.map((poi, index) => (
                        <div key={index} className="poi-item">
                            <div className="poi-info">
                                <span className="poi-name">{poi.name}</span>
                                <span className="poi-time">約 {poi.minutes} 分鐘</span>
                            </div>
                            <span className="poi-type">{poi.type}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

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

// --- Main App Component ---

function App() {
    const [projectData, setProjectData] = useState({
        name: '信義璞園',
        address: '台北市信義區市府路45號',
        center: [121.5654, 25.0375],
        ringMinutes: [5, 10, 15],
        pois: [
            { name: '市政府捷運站', type: '捷運站', minutes: 3, coord: [121.5645, 25.0410] },
            { name: '信義商圈', type: '商業機能', minutes: 5, coord: [121.5665, 25.0355] },
            { name: '松山文創園區', type: '文化 / 展演', minutes: 7, coord: [121.5598, 25.0440] },
            { name: '台北 101', type: '地標', minutes: 4, coord: [121.5640, 25.0330] }
        ]
    });

    const handleUpdateProject = (newData) => {
        setProjectData(newData);
    };

    if (!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <h1 style={{ color: '#ef4444' }}>Missing Configuration</h1>
                <p>Mapbox Access Token is missing.</p>
                <p>Please add <code>VITE_MAPBOX_ACCESS_TOKEN</code> to your environment variables or GitHub Secrets.</p>
            </div>
        );
    }

    return (
        <>
            <header className="app-header">
                <div className="brand">
                    SalesMap <span className="brand-highlight">Studio</span>
                </div>
                <button className="btn-export" disabled>
                    匯出分享連結（規劃中）
                </button>
            </header>

            <main className="app-main">
                <ControlPanel
                    projectData={projectData}
                    onUpdateProject={handleUpdateProject}
                />
                <MapView projectData={projectData} />
            </main>
        </>
    );
}

export default App;
