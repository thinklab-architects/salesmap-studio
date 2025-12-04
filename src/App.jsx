import React, { useState } from 'react';
import ControlPanel from './components/ControlPanel';
import MapView from './components/MapView';

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
