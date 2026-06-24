import React from 'react'; // BUG 8: removed unused useState and useEffect

const AdminDashboard = ({ users }) => {
  const allUsers = Object.values(users);

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
        <div id="osm-map" style={{ height: '400px', background: '#222', borderRadius: '8px' }}>
          {/* In a real browser, Leaflet would be initialized here */}
          <p style={{ textAlign: 'center', paddingTop: '180px', color: '#555' }}>
            Interactive OSM Map with {allUsers.filter(u => u.location).length} active markers
          </p>
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
                <td>{u.location ? `${u.location.lat.toFixed(2)}, ${u.location.lng.toFixed(2)}` : 'Unknown'}</td>
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
