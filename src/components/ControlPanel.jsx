import React, { useState } from 'react';

const ControlPanel = ({ projectData, onUpdateProject }) => {
  const [name, setName] = useState(projectData.name || '');
  const [address, setAddress] = useState(projectData.address || '');
  const [ringOption, setRingOption] = useState(projectData.ringMinutes.join(','));
  const [travelMode, setTravelMode] = useState('driving');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleGenerate = async () => {
    setIsLoading(true);

    // Parse ring option string "5,10,15" -> [5, 10, 15]
    const rings = ringOption.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

    let newCenter = projectData.center;
    let newPois = projectData.pois;

    // 1. Fetch Geocoding
    if (address) {
      const result = await fetchGeocoding(address);
      if (result) {
        newCenter = result.center; // [lng, lat]

        // 2. Mock POIs relative to new center (Simulating AI)
        // Simple offset to create "nearby" points
        const [lng, lat] = newCenter;
        newPois = [
          { name: '最近捷運站', type: '捷運站', minutes: 3, coord: [lng + 0.004, lat + 0.002] },
          { name: '核心商圈', type: '商業機能', minutes: 5, coord: [lng - 0.003, lat - 0.001] },
          { name: '文化園區', type: '文化 / 展演', minutes: 7, coord: [lng + 0.002, lat - 0.004] },
          { name: '知名地標', type: '地標', minutes: 4, coord: [lng - 0.002, lat + 0.003] }
        ];
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
      </p>

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

export default ControlPanel;
