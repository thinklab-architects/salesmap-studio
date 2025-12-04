import React, { useState } from 'react';

const ControlPanel = ({ projectData, onUpdateProject }) => {
  const [name, setName] = useState(projectData.name || '');
  const [address, setAddress] = useState(projectData.address || '');
  const [ringOption, setRingOption] = useState(projectData.ringMinutes.join(','));
  const [travelMode, setTravelMode] = useState('driving');

  const handleGenerate = () => {
    // Parse ring option string "5,10,15" -> [5, 10, 15]
    const rings = ringOption.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    
    onUpdateProject({
      ...projectData,
      name,
      address,
      ringMinutes: rings.length > 0 ? rings : [5, 10, 15],
      // In a real app, we would fetch new coordinates and POIs here
    });
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

      <button className="btn-primary" onClick={handleGenerate}>
        ⚡ 生成銷售地圖
      </button>

      <p className="hint-text">目前資料是示意用，未接真實 Geocoding / POI / AI API</p>

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
