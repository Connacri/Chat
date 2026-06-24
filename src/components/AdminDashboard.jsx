import React, { useEffect, useRef } from 'react';

const AdminDashboard = ({ users }) => {
  const allUsers = Object.values(users);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map()); // userId -> Marker instance

  useEffect(() => {
    // Only initialize the map if Leaflet is loaded and it hasn't been initialized yet
    if (window.L && !mapInstanceRef.current) {
      // Find default location or center of France [46.2276, 2.2137]
      mapInstanceRef.current = window.L.map('osm-map').setView([46.2276, 2.2137], 5);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    if (map && window.L) {
      // Remove markers for users no longer in the list
      const currentUserIds = new Set(allUsers.map(u => u.id));
      for (const [id, marker] of markersRef.current.entries()) {
        if (!currentUserIds.has(id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }

      // Add/Update markers for each user
      allUsers.forEach(u => {
        if (u.location && u.location.lat && u.location.lng) {
          const latLng = [u.location.lat, u.location.lng];
          if (markersRef.current.has(u.id)) {
            // Update position
            markersRef.current.get(u.id).setLatLng(latLng);
          } else {
            // Create custom icon or use standard marker
            const marker = window.L.marker(latLng).addTo(map);
            const popupContent = `
              <div style="color: #111; font-family: sans-serif; font-size: 13px;">
                <b style="font-size: 14px;">${u.name}</b> ${u.verified ? '✅ Verified' : ''}<br/>
                📞 ${u.phone}<br/>
                📍 ${u.city || 'Inconnue'}<br/>
                🌟 ${u.premium ? 'Membre Premium' : 'Membre Freemium'}
              </div>
            `;
            marker.bindPopup(popupContent);
            markersRef.current.set(u.id, marker);
          }
        }
      });
    }
  }, [allUsers]);

  return (
    <div className="admin-dashboard">
      <h1>🛡️ Super Admin Dashboard</h1>
      <div className="stats-grid">
        <div className="stat">Users: {allUsers.length}</div>
        <div className="stat">Verified: {allUsers.filter(u => u.verified).length}</div>
        <div className="stat">Premium: {allUsers.filter(u => u.premium).length}</div>
      </div>

      <div className="map-container">
        <h3>📍 Global Heatmap (OpenStreetMap)</h3>
        <div id="osm-map" style={{ height: '400px', background: '#181824', borderRadius: '12px', border: '1px solid #2e2e4a' }}>
          {/* Leaflet map mounts here */}
        </div>
      </div>

      <div className="user-list">
        <h3>User Activity</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Location</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.verified ? '✅' : '❌'} {u.premium ? '⭐' : ''}</td>
                <td>{u.location ? `${u.location.lat.toFixed(4)}, ${u.location.lng.toFixed(4)} (${u.city || '?'})` : 'Unknown'}</td>
                <td>{new Date(u.ts).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
