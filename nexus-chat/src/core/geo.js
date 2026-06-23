/**
 * Geolocation Layer - OSM Integration and Privacy
 */

export const GeoService = {
  async getCurrentPosition() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej('Geo not supported');
      navigator.geolocation.getCurrentPosition(
        (pos) => res({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        rej
      );
    });
  },

  // Broadcast position to network (if allowed)
  async broadcastPosition(nodeId, position) {
    // In a P2P network, we gossip the location update
    // This will be picked up by the Super Admin node
    return {
      type: 'LOCATION_UPDATE',
      nodeId,
      lat: position.lat,
      lng: position.lng,
      ts: Date.now()
    };
  }
};
