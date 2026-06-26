import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Calendar, MapPin, MessageSquare } from 'lucide-react';

const InstagramIcon = ({ size = 12, className = "", style = {} }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const getOrganizerLogo = (instagramUrl) => {
  if (!instagramUrl) return '/images/logos/instagram.png';
  const url = instagramUrl.toLowerCase();
  if (url.includes('antagfree')) return '/images/logos/antagfree.jpg';
  if (url.includes('darkjail')) return '/images/logos/darkjail.jpg';
  if (url.includes('redbullbatalla')) return '/images/logos/redbullbatalla.jpg';
  if (url.includes('hypnotic')) return '/images/logos/hypnotic.png';
  return '/images/logos/instagram.png';
};

const DEPARTMENTS = [
  'Todos',
  'Montevideo',
  'Canelones',
  'Maldonado',
  'San José',
  'Colonia',
  'Río Negro',
  'Salto',
  'Rocha'
];

// Coordinates for department centroids in Uruguay for fallback geocoding
const DEPARTMENT_COORDS = {
  'montevideo': [-34.9011, -56.1645],
  'canelones': [-34.5204, -56.2794],
  'maldonado': [-34.9000, -54.9500],
  'san josé': [-34.3375, -56.7136],
  'colonia': [-34.4697, -57.8428],
  'río negro': [-32.8000, -57.4333],
  'salto': [-31.3833, -57.9667],
  'rocha': [-34.4833, -54.3333],
  'artigas': [-30.4000, -56.4667],
  'rivera': [-30.9025, -55.5506],
  'paysandú': [-32.3206, -58.0756],
  'tacuarembó': [-31.7333, -55.9833],
  'cerro largo': [-32.3667, -54.1667],
  'durazno': [-33.3833, -56.5167],
  'treinta y tres': [-33.2333, -54.3833],
  'soriano': [-33.2500, -58.0167],
  'flores': [-33.5333, -56.9000],
  'florida': [-34.1000, -56.2167],
  'lavalleja': [-34.3758, -55.2375]
};

// Haversine formula to calculate geodesic distance
function getHaversineDistance(coords1, coords2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
  const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

// Format distance nicely
function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

// Helper to generate popup HTML with distance
function getPopupHtml(event, userLocation, eventLat, eventLng) {
  let distanceHtml = '';
  if (userLocation && eventLat && eventLng) {
    const dist = getHaversineDistance(userLocation, { lat: eventLat, lng: eventLng });
    distanceHtml = `
      <div class="popup-distance mono-text">
        📍 Estás a ${formatDistance(dist)} de este cypher
      </div>
    `;
  }

  const isFallback = event.lat === 0 || event.lng === 0 || !event.lat || !event.lng;
  const formattedDate = new Date(event.fecha.replace(/-/g, '/')).toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit'
  });

  return `
    <div class="brutalist-popup-content">
      <h4 class="popup-title">${event.nombre.toUpperCase()}</h4>
      <p class="popup-info mono-text">
        <span>DEP:</span> ${event.departamento.toUpperCase()}<br/>
        <span>FECHA:</span> ${formattedDate}<br/>
        <span>LUGAR:</span> ${event.lugar}<br/>
        <span>HORA:</span> ${event.hora_inscripcion || 'N/A'}<br/>
        ${isFallback ? '<span class="coord-warning">// UBICACIÓN APROXIMADA</span>' : ''}
      </p>
      ${distanceHtml}
      <div class="popup-actions-grid">
        ${event.instagram_url ? `
          <a href="${event.instagram_url}" target="_blank" rel="noopener noreferrer" class="popup-action-btn instagram mono-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line></svg>
            INSTAGRAM
          </a>
        ` : ''}
        ${(event.whatsapp_url || event.whatsapp_link) ? `
          <a href="${event.whatsapp_url || event.whatsapp_link}" target="_blank" rel="noopener noreferrer" class="popup-action-btn whatsapp mono-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            WHATSAPP
          </a>
        ` : ''}
        ${!isFallback ? `
          <a href="https://www.google.com/maps/search/?api=1&query=${eventLat},${eventLng}" target="_blank" rel="noopener noreferrer" class="popup-action-btn maps mono-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
            CÓMO LLEGAR
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

// Interactive Leaflet Map Component
function LeafletMapComponent({ 
  events, 
  selectedDept, 
  onSelectEvent, 
  selectedEvent, 
  userLocation, 
  geoError, 
  geoLoading 
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markersRef = useRef({});
  const resolvedCoordsRef = useRef({});
  const userMarkerRef = useRef(null);
  const polylineRef = useRef(null);

  const clickedFromMapRef = useRef(false);
  const onSelectEventRef = useRef(onSelectEvent);

  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
  }, [onSelectEvent]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map instance centered in Uruguay
    const map = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView([-32.5228, -55.7658], 7);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    // CartoDB Dark Matter tiles for a sleek dark background
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(map);

    // Create layer group for markers
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Clear selected event when popups are closed
    map.on('popupclose', (e) => {
      setTimeout(() => {
        if (mapRef.current && !mapRef.current._popup) {
          if (onSelectEventRef.current) {
            onSelectEventRef.current(null);
          }
        }
      }, 50);
    });

    // Invalidate size when map container dimensions change (responsive fix)
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync Markers and Centering
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    // Clear old markers
    markersLayerRef.current.clearLayers();
    markersRef.current = {};
    resolvedCoordsRef.current = {};

    events.forEach(event => {
      let lat = parseFloat(event.lat);
      let lng = parseFloat(event.lng);
      let isFallback = false;

      // Coordinate validation and fallback geocoding
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        const dept = event.departamento ? event.departamento.toLowerCase().trim() : '';
        if (DEPARTMENT_COORDS[dept]) {
          const baseCoords = DEPARTMENT_COORDS[dept];
          // Add small jitter (~2-4km) to prevent markers overlapping in the same department
          const jitterLat = (Math.random() - 0.5) * 0.05;
          const jitterLng = (Math.random() - 0.5) * 0.05;
          lat = baseCoords[0] + jitterLat;
          lng = baseCoords[1] + jitterLng;
          isFallback = true;
        } else {
          // General fallback (center of Uruguay with jitter)
          lat = -32.5228 + (Math.random() - 0.5) * 0.5;
          lng = -55.7658 + (Math.random() - 0.5) * 0.5;
          isFallback = true;
        }
      }

      resolvedCoordsRef.current[event.id] = [lat, lng];

      // Location Pin with Organizer Logo
      const markerIcon = L.divIcon({
        className: 'leaflet-custom-pin-container',
        html: `
          <div class="custom-map-pin">
            <div class="pin-teardrop ${isFallback ? 'fallback' : ''}">
              <img src="${getOrganizerLogo(event.instagram_url)}" class="pin-logo" alt="" />
            </div>
            <div class="pin-shadow"></div>
          </div>
        `,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -40]
      });

      // Generate popup content with initial userLocation (if available)
      const popupHtml = getPopupHtml(event, userLocation, lat, lng);

      // Create Marker
      const marker = L.marker([lat, lng], { icon: markerIcon })
        .bindPopup(popupHtml, {
          closeButton: false,
          className: 'brutalist-leaflet-popup'
        });

      // Trigger standard selection handler on click
      marker.on('click', () => {
        clickedFromMapRef.current = true;
        if (onSelectEvent) {
          onSelectEvent(event);
        }
      });

      markersLayerRef.current.addLayer(marker);
      markersRef.current[event.id] = marker;
    });

    // Center view based on active markers
    const coordsList = Object.values(resolvedCoordsRef.current);

    if (selectedDept) {
      const deptKey = selectedDept.toLowerCase().trim();
      if (DEPARTMENT_COORDS[deptKey]) {
        if (coordsList.length > 0) {
          const bounds = L.latLngBounds(coordsList);
          mapRef.current.invalidateSize();
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12, animate: true });
        } else {
          mapRef.current.setView(DEPARTMENT_COORDS[deptKey], 10, { animate: true });
        }
      }
    } else if (!selectedEvent) {
      if (coordsList.length > 0) {
        const bounds = L.latLngBounds(coordsList);
        mapRef.current.invalidateSize();
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12, animate: true });
      } else {
        mapRef.current.setView([-32.5228, -55.7658], 7, { animate: true });
      }
    }
  }, [events, selectedDept, onSelectEvent]);

  // Sync User Location Marker and Polyline
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // 1. Manage User Location Marker
    if (userLocation) {
      const userLatLng = [userLocation.lat, userLocation.lng];
      if (!userMarkerRef.current) {
        const userIcon = L.divIcon({
          className: 'leaflet-user-location-container',
          html: `
            <div class="user-location-pulse-ring"></div>
            <div class="user-location-dot"></div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }

    // 2. Manage Polyline (Dashed Path)
    if (userLocation && selectedEvent) {
      const userLatLng = [userLocation.lat, userLocation.lng];
      const eventLatLng = resolvedCoordsRef.current[selectedEvent.id];

      if (eventLatLng) {
        if (!polylineRef.current) {
          polylineRef.current = L.polyline([userLatLng, eventLatLng], {
            color: '#a855f7', // Purple accent
            weight: 3,
            dashArray: '5, 10',
            opacity: 0.8
          }).addTo(map);
        } else {
          polylineRef.current.setLatLngs([userLatLng, eventLatLng]);
        }
      } else {
        if (polylineRef.current) {
          polylineRef.current.remove();
          polylineRef.current = null;
        }
      }
    } else {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    }
  }, [userLocation, selectedEvent]);

  // Dynamically update popup contents when user location updates (without closing popup)
  useEffect(() => {
    if (!markersRef.current || !userLocation) return;

    Object.entries(markersRef.current).forEach(([eventId, marker]) => {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const coords = resolvedCoordsRef.current[eventId];
      if (coords) {
        const popupHtml = getPopupHtml(event, userLocation, coords[0], coords[1]);
        marker.setPopupContent(popupHtml);
      }
    });
  }, [userLocation, events]);

  // Center on Selected Event when it changes
  useEffect(() => {
    if (!mapRef.current || !selectedEvent) return;

    const coords = resolvedCoordsRef.current[selectedEvent.id];
    const marker = markersRef.current[selectedEvent.id];
    if (coords && marker) {
      if (clickedFromMapRef.current) {
        // If clicked from map, keep user's current zoom/pan and just make sure popup is open
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
        clickedFromMapRef.current = false;
      } else {
        // Center and zoom if selected from list/outside map
        mapRef.current.setView(coords, 12, { animate: true });
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
      }
    }
  }, [selectedEvent]);

  const handleCenterOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Floating GPS Button */}
      {userLocation && (
        <button 
          onClick={handleCenterOnUser}
          className="map-gps-btn"
          title="Centrar en mi ubicación"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" x2="12" y1="1" y2="4" />
            <line x1="12" x2="12" y1="20" y2="23" />
            <line x1="1" x2="4" y1="12" y2="12" />
            <line x1="20" x2="23" y1="12" y2="12" />
          </svg>
        </button>
      )}

      {/* Geolocation Error Notification Overlay */}
      {geoError && (
        <div className="map-geo-error-banner mono-text">
          <span>⚠️ {geoError === 'PERMISSION_DENIED' ? 'GPS DESACTIVADO' : 'UBICACIÓN INACCESIBLE'}</span>
        </div>
      )}
    </div>
  );
}

export default function AgendaTab({ events, onSelectEvent, selectedEvent, onViewModeChange }) {
  const [selectedDept, setSelectedDept] = useState(null);
  const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'mapa'
  const [userLocation, setUserLocation] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Notify parent of view mode change
  useEffect(() => {
    if (onViewModeChange) {
      onViewModeChange(viewMode);
    }
  }, [viewMode, onViewModeChange]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('GEOLOCATION_NOT_SUPPORTED');
      return;
    }

    setGeoLoading(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGeoError(null);
        setGeoLoading(false);
      },
      (error) => {
        console.error('Error tracking location:', error);
        setGeoLoading(false);
        if (error.code === 1) { // PERMISSION_DENIED
          setGeoError('PERMISSION_DENIED');
        } else {
          setGeoError('POSITION_UNAVAILABLE');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Filter events based on selected department
  const filteredEvents = selectedDept
    ? events.filter(e => e.departamento.toLowerCase() === selectedDept.toLowerCase())
    : events;

  return (
    <div className="agenda-tab-container">
      {/* Switch Header to alternate between LIST and MAP */}
      <div className="agenda-tabs-header">
        <button 
          className={`tab-btn mono-text ${viewMode === 'lista' ? 'active' : ''}`}
          onClick={() => setViewMode('lista')}
        >
          [ LISTA ]
        </button>
        <button 
          className={`tab-btn mono-text ${viewMode === 'mapa' ? 'active' : ''}`}
          onClick={() => setViewMode('mapa')}
        >
          [ MAPA ]
        </button>
      </div>

      {/* Sticky Department Filter */}
      <div className="dept-filter-bar-sticky">
        <div className="dept-scroll-wrapper">
          {DEPARTMENTS.map((dept) => {
            const isSelected = (dept === 'Todos' && !selectedDept) || (selectedDept === dept);
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept === 'Todos' ? null : dept)}
                className={`dept-bubble mono-text ${isSelected ? 'active' : ''}`}
              >
                {dept.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content display based on viewMode */}
      <div className="agenda-main-content">
        {viewMode === 'lista' ? (
          <div className="sheet-scroll-content">
            {filteredEvents.length === 0 ? (
              <div className="empty-state">
                <p className="mono-text">SIN COMPETENCIAS ACTIVAS EN ESTA ZONA</p>
                <button 
                  onClick={() => setSelectedDept(null)}
                  className="clear-filter-btn mono-text"
                >
                  VER TODO EL PAÍS
                </button>
              </div>
            ) : (
              <div className="events-feed">
                {filteredEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="event-card brutalist-card"
                    onClick={() => onSelectEvent(event)}
                  >
                    {/* Circular organizer logo */}
                    <div className="card-logo-box">
                      <img 
                        src={getOrganizerLogo(event.instagram_url)} 
                        alt={event.nombre} 
                        className="card-logo-img"
                      />
                    </div>
                    <div className="card-details">
                      <div className="card-header-row">
                        <div className="card-organizer-info">
                          <span className="mono-text card-dept">{event.departamento.toUpperCase()}</span>
                        </div>
                        <span className="mono-text card-time">{event.hora_inscripcion}</span>
                      </div>
                      <h3 className="card-title">{event.nombre}</h3>
                      <div className="card-info-row">
                        <div className="card-info-item">
                          <Calendar size={12} />
                          <span className="mono-text">
                            {new Date(event.fecha.replace(/-/g, '/')).toLocaleDateString('es-UY', {
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="card-info-item">
                          <MapPin size={12} />
                          <span className="truncate">{event.lugar}</span>
                        </div>
                      </div>
                      
                      <div className="card-actions-row">
                        {(event.whatsapp_url || event.whatsapp_link) && (
                          <a 
                            href={event.whatsapp_url || event.whatsapp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="card-action-btn whatsapp-btn-card"
                            onClick={(e) => e.stopPropagation()}
                            title="WhatsApp de la compe"
                          >
                            <MessageSquare size={12} />
                            <span className="mono-text btn-text">WHATSAPP</span>
                          </a>
                        )}
                        {event.instagram_url && (
                          <a 
                            href={event.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="card-action-btn instagram-btn-card destacado"
                            onClick={(e) => e.stopPropagation()}
                            title="Ver post original en Instagram"
                          >
                            <InstagramIcon size={12} />
                            <span className="mono-text btn-text">POST ORIGINAL</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="map-view-wrapper">
            <LeafletMapComponent 
              events={filteredEvents}
              selectedDept={selectedDept}
              onSelectEvent={onSelectEvent}
              selectedEvent={selectedEvent}
              userLocation={userLocation}
              geoError={geoError}
              geoLoading={geoLoading}
            />
          </div>
        )}
      </div>

      <style>{`
        .agenda-tab-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          background-color: var(--bg-base);
          overflow: hidden;
          height: 100%;
        }

        .agenda-tabs-header {
          display: flex;
          width: 100%;
          background-color: var(--bg-panel);
          border-bottom: 2px solid var(--border-subtle);
          box-shadow: 0px 2px 4px rgba(0,0,0,0.15);
          height: 46px;
          z-index: 10;
        }

        .agenda-tabs-header .tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-weight: bold;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.05em;
        }

        .agenda-tabs-header .tab-btn.active {
          color: var(--color-accent-amber);
          border-bottom: 3px solid var(--color-accent-amber);
          background-color: rgba(255, 166, 0, 0.05);
          text-shadow: 0 0 8px rgba(255,166,0,0.3);
        }

        .dept-filter-bar-sticky {
          width: 100%;
          height: 48px;
          z-index: 9;
          background-color: var(--bg-panel);
          border-bottom: 1.5px solid var(--border-subtle);
          display: flex;
          align-items: center;
          padding: 0 12px;
          box-shadow: 0px 1px 3px rgba(0,0,0,0.1);
        }
        
        .dept-scroll-wrapper {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          width: 100%;
          padding: 4px 0;
          scrollbar-width: none;
        }
        .dept-scroll-wrapper::-webkit-scrollbar {
          display: none;
        }
        
        .dept-bubble {
          white-space: nowrap;
          padding: 6px 12px;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          font-size: 8px;
          font-weight: 700;
          color: var(--text-secondary);
          background-color: var(--bg-card);
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.03), 0px 1px 2px rgba(0,0,0,0.2);
          transition: all 0.1s;
        }
        .dept-bubble.active {
          color: var(--color-accent-amber);
          border-color: var(--color-accent-amber);
          background-color: var(--bg-screen);
          transform: translateY(1px);
          box-shadow: inset 1.5px 2px 3px rgba(0,0,0,0.8);
        }
        .dept-bubble:active {
          transform: translateY(0.5px);
        }

        .agenda-main-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .sheet-scroll-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background-color: var(--bg-base);
        }

        .map-view-wrapper {
          flex: 1;
          width: 100%;
          height: 100%;
          position: relative;
          background-color: #0b0b0b;
        }

        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-secondary);
        }
        .empty-state p {
          font-size: 11px;
          margin-bottom: 12px;
        }
        .clear-filter-btn {
          padding: 8px 16px;
          border: 1px solid var(--border-subtle);
          background-color: var(--bg-panel);
          color: var(--text-primary);
          font-size: 9px;
          font-weight: bold;
          border-radius: 6px;
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05), 0px 2px 4px rgba(0,0,0,0.3);
          transition: all 0.1s;
        }
        
        /* Event Card styling */
        .events-feed {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 24px;
        }
        
        .event-card.brutalist-card {
          display: flex;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          overflow: hidden;
          background-color: var(--bg-panel);
          height: auto;
          min-height: 120px;
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05), 
                      0px 4px 8px rgba(0, 0, 0, 0.4);
          transition: all 0.1s ease;
          position: relative;
          cursor: pointer;
        }
        
        .event-card.brutalist-card:active {
          transform: translateY(1px);
          box-shadow: inset 1.5px 2px 3px rgba(0, 0, 0, 0.7);
        }
        
        .card-logo-box {
          width: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-right: 1px solid var(--border-subtle);
          background-color: var(--bg-card);
        }
        
        .card-logo-img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid var(--border-subtle);
          filter: grayscale(100%);
          transition: filter 0.3s ease, transform 0.3s ease;
        }
        
        .event-card.brutalist-card:hover .card-logo-img {
          filter: grayscale(0%);
          transform: scale(1.05);
        }
        
        .card-details {
          flex: 1;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow: hidden;
        }
        
        .card-header-row {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          font-family: var(--font-mono);
          font-weight: 700;
        }
        
        .card-dept {
          color: var(--color-accent-amber);
        }
        
        .card-organizer-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .card-time {
          color: var(--text-secondary);
        }
        
        .card-title {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--text-primary);
        }
        
        .card-info-row {
          display: flex;
          gap: 12px;
          font-size: 9px;
          color: var(--text-secondary);
          align-items: center;
          font-family: var(--font-mono);
        }
        
        .card-info-item {
          display: flex;
          align-items: center;
          gap: 4px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        
        .card-actions-row {
          display: flex;
          gap: 8px;
          margin-top: auto;
          padding-top: 6px;
        }
        
        .card-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 5px 10px;
          border: 1px solid var(--border-subtle);
          background-color: var(--bg-card);
          color: var(--text-primary);
          font-size: 8px;
          font-family: var(--font-mono);
          font-weight: bold;
          text-transform: uppercase;
          transition: all 0.1s ease;
          border-radius: 6px;
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.03), 0px 1px 2px rgba(0,0,0,0.3);
        }
        
        .card-action-btn:active {
          transform: translateY(1px);
        }
        
        .whatsapp-btn-card {
          background-color: var(--bg-card);
        }
        .whatsapp-btn-card:hover {
          background-color: rgba(37, 211, 102, 0.1);
          color: #25D366;
          border-color: #25D366;
        }
        
        .instagram-btn-card.destacado {
          background-color: var(--bg-panel);
          color: var(--color-accent-amber);
          border-color: var(--color-accent-amber);
          flex: 1;
        }
        .instagram-btn-card.destacado:hover {
          background-color: var(--color-accent-amber);
          color: var(--bg-base);
        }
        
        .truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Map styling fixes */
        /* Custom Location Pin Styling */
        .leaflet-custom-pin-container {
          background: transparent !important;
          border: none !important;
        }

        .custom-map-pin {
          position: relative;
          width: 36px;
          height: 44px;
        }

        .pin-teardrop {
          width: 36px;
          height: 36px;
          background-color: var(--color-accent-amber);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid #000000;
          display: flex;
          justify-content: center;
          align-items: center;
          position: absolute;
          top: 0;
          left: 0;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
          transition: transform 0.2s ease, background-color 0.2s ease;
        }

        .pin-teardrop.fallback {
          background-color: #3a86c8;
        }

        .pin-logo {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          transform: rotate(45deg); /* Counter-rotate to remain upright */
          object-fit: cover;
          border: 1px solid #000000;
          background-color: #000000;
        }

        .pin-shadow {
          width: 12px;
          height: 4px;
          background-color: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          position: absolute;
          bottom: 2px;
          left: 12px;
          z-index: -1;
        }

        /* Hover interaction */
        .leaflet-custom-pin-container:hover .pin-teardrop {
          transform: rotate(-45deg) scale(1.15);
          background-color: #ffffff;
          z-index: 999;
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.6);
        }

        .brutalist-leaflet-popup .leaflet-popup-content-wrapper {
          background-color: #0c0d0e !important;
          color: var(--text-primary) !important;
          border: 1px solid var(--border-subtle) !important;
          border-radius: 6px !important;
          box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.6) !important;
          padding: 8px !important;
        }

        .brutalist-leaflet-popup .leaflet-popup-tip {
          background-color: #0c0d0e !important;
          border-left: 1px solid var(--border-subtle) !important;
          border-bottom: 1px solid var(--border-subtle) !important;
        }

        .brutalist-popup-content {
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 200px;
        }

        .brutalist-popup-content .popup-title {
          margin: 0;
          font-size: 11px;
          font-weight: bold;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 4px;
        }

        .brutalist-popup-content .popup-info {
          margin: 0;
          font-size: 9px;
          line-height: 1.4;
          color: var(--text-secondary);
        }

        .brutalist-popup-content .popup-info span {
          color: var(--color-accent-amber);
          font-weight: bold;
        }

        .brutalist-popup-content .coord-warning {
          color: #3a86c8;
          font-weight: bold;
          display: inline-block;
          margin-top: 4px;
        }

        .popup-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 6px;
          margin-top: 8px;
        }

        .brutalist-popup-content .popup-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 4px;
          background-color: var(--bg-card);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-size: 8px;
          font-weight: bold;
          text-decoration: none;
          border-radius: 4px;
          text-align: center;
          transition: all 0.1s;
        }

        .brutalist-popup-content .popup-action-btn:hover {
          background-color: var(--bg-panel);
        }

        .brutalist-popup-content .popup-action-btn.instagram {
          color: var(--color-accent-amber);
          border-color: rgba(255, 166, 0, 0.4);
        }
        .brutalist-popup-content .popup-action-btn.instagram:hover {
          background-color: var(--color-accent-amber);
          color: #000;
          border-color: var(--color-accent-amber);
        }

        .brutalist-popup-content .popup-action-btn.whatsapp {
          color: #25D366;
          border-color: rgba(37, 211, 102, 0.4);
        }
        .brutalist-popup-content .popup-action-btn.whatsapp:hover {
          background-color: rgba(37, 211, 102, 0.1);
        }

        .brutalist-popup-content .popup-action-btn.maps {
          color: #a855f7;
          border-color: rgba(168, 85, 247, 0.4);
        }
        .brutalist-popup-content .popup-action-btn.maps:hover {
          background-color: rgba(168, 85, 247, 0.1);
        }

        /* User GPS Location Marker Styling */
        .leaflet-user-location-container {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }

        .user-location-dot {
          width: 14px;
          height: 14px;
          background-color: #007aff;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0, 122, 255, 0.8);
          z-index: 2;
        }

        .user-location-pulse-ring {
          position: absolute;
          width: 32px;
          height: 32px;
          border: 2px solid #007aff;
          border-radius: 50%;
          background-color: rgba(0, 122, 255, 0.15);
          animation: user-location-pulse 2s infinite ease-out;
          z-index: 1;
        }

        @keyframes user-location-pulse {
          0% {
            transform: scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        /* Floating GPS Centering Button */
        .map-gps-btn {
          position: absolute;
          bottom: 80px;
          right: 10px;
          z-index: 1000;
          width: 36px;
          height: 36px;
          background-color: #0c0d0e;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0px 2px 6px rgba(0,0,0,0.5);
          transition: all 0.2s ease;
        }

        .map-gps-btn:hover {
          color: var(--color-accent-amber);
          border-color: var(--color-accent-amber);
          background-color: #17181a;
        }

        .map-gps-btn:active {
          transform: scale(0.95);
        }

        /* Geolocation Error Banner */
        .map-geo-error-banner {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background-color: rgba(255, 77, 77, 0.9);
          color: #000;
          font-weight: bold;
          font-size: 8px;
          padding: 6px 12px;
          border-radius: 4px;
          box-shadow: 0px 4px 10px rgba(0,0,0,0.5);
          pointer-events: none;
          letter-spacing: 0.05em;
        }

        /* Popup Distance Styling */
        .popup-distance {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px dashed var(--border-subtle);
          font-size: 8.5px;
          color: #d8b4fe; /* Glowing light purple */
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}
