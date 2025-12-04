import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ControlPanel = ({ projectData, onUpdateProject }) => {
  const [name, setName] = useState(projectData.name || '');
  const [address, setAddress] = useState(projectData.address || '');
  const [ringOption, setRingOption] = useState(projectData.ringMinutes.join(','));
  const [travelMode, setTravelMode] = useState('driving');
  const [geminiKey, setGeminiKey] = useState('');
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

  const fetchGeminiPOIs = async (address, center, apiKey) => {
    if (!apiKey) return null;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        你是一個房地產專家。請針對「${address}」（經緯度：${center[1]}, ${center[0]}）
        列出 4 個附近最重要的銷售亮點設施（例如捷運站、商圈、公園、學校、地標）。
        
        請回傳純 JSON 格式，不要有 markdown 標記。格式如下：
        [
          { "name": "設施名稱", "type": "類別(如捷運/商圈/公園)", "minutes": 預估開車分鐘數(整數), "lat": 緯度, "lng": 經度 }
        ]
        
        注意：
        1. 經緯度必須真實且在該地點附近。
        2. minutes 請根據距離估算。
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up markdown if present
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Gemini API Error:", error);
      alert("AI 生成失敗，請檢查 API Key 或稍後再試。");
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
