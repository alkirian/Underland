import React from 'react';

// Department centroids for the abstract schematic layout (mapped to SVG 400x400)
const DEPARTMENTS = [
  { id: 'Artigas', label: 'ART', x: 200, y: 40 },
  { id: 'Salto', label: 'SLT', x: 130, y: 90 },
  { id: 'Rivera', label: 'RIV', x: 270, y: 80 },
  { id: 'Paysandú', label: 'PAY', x: 110, y: 150 },
  { id: 'Tacuarembó', label: 'TAC', x: 200, y: 140 },
  { id: 'Cerro Largo', label: 'CRL', x: 290, y: 150 },
  { id: 'Río Negro', label: 'RNG', x: 100, y: 210 },
  { id: 'Durazno', label: 'DUR', x: 200, y: 210 },
  { id: 'Treinta y Tres', label: 'TYT', x: 300, y: 210 },
  { id: 'Soriano', label: 'SOR', x: 90, y: 270 },
  { id: 'Flores', label: 'FLO', x: 150, y: 260 },
  { id: 'Florida', label: 'FLD', x: 210, y: 270 },
  { id: 'Lavalleja', label: 'LAV', x: 270, y: 270 },
  { id: 'Rocha', label: 'ROC', x: 330, y: 290 },
  { id: 'Colonia', label: 'COL', x: 80, y: 330 },
  { id: 'San José', label: 'SJO', x: 140, y: 320 },
  { id: 'Canelones', label: 'CAN', x: 200, y: 330 },
  { id: 'Maldonado', label: 'MAL', x: 260, y: 330 },
  { id: 'Montevideo', label: 'MVD', x: 200, y: 375 }
];

const EDGES = [
  ['Artigas', 'Salto'], ['Artigas', 'Rivera'],
  ['Salto', 'Paysandú'], ['Salto', 'Tacuarembó'],
  ['Rivera', 'Tacuarembó'], ['Rivera', 'Cerro Largo'],
  ['Paysandú', 'Río Negro'], ['Paysandú', 'Tacuarembó'],
  ['Tacuarembó', 'Durazno'], ['Tacuarembó', 'Cerro Largo'],
  ['Cerro Largo', 'Treinta y Tres'], ['Cerro Largo', 'Durazno'],
  ['Río Negro', 'Soriano'], ['Río Negro', 'Durazno'],
  ['Durazno', 'Flores'], ['Durazno', 'Florida'], ['Durazno', 'Treinta y Tres'],
  ['Treinta y Tres', 'Lavalleja'], ['Treinta y Tres', 'Florida'], ['Treinta y Tres', 'Rocha'],
  ['Soriano', 'Colonia'], ['Soriano', 'Flores'],
  ['Flores', 'San José'], ['Flores', 'Florida'],
  ['Florida', 'San José'], ['Florida', 'Canelones'], ['Florida', 'Lavalleja'],
  ['Lavalleja', 'Canelones'], ['Lavalleja', 'Maldonado'], ['Lavalleja', 'Rocha'],
  ['Rocha', 'Maldonado'],
  ['Colonia', 'San José'],
  ['San José', 'Canelones'], ['San José', 'Montevideo'],
  ['Canelones', 'Montevideo'], ['Canelones', 'Maldonado']
];

// Linear interpolation to map coordinates (Lat/Lng) to the 400x400 SVG box
export function getMapCoordinates(lat, lng) {
  // Approximate bounding box coordinates for Uruguay
  const minLat = -35.2; // South
  const maxLat = -30.0; // North
  const minLng = -58.5; // West
  const maxLng = -53.0; // East

  // Map latitude to Y (inverted in SVG)
  const y = 380 - ((lat - minLat) / (maxLat - minLat)) * 340;
  // Map longitude to X
  const x = 20 + ((lng - minLng) / (maxLng - minLng)) * 360;

  return { x, y };
}

export default function UruguayMap({ events, selectedDept, onSelectDept, onSelectEvent }) {
  // Count events per department
  const getEventCountForDept = (deptName) => {
    return events.filter(e => e.departamento.toLowerCase() === deptName.toLowerCase()).length;
  };

  return (
    <div className="map-container">
      <div className="map-header">
        <div className="mono-text map-title">MAPA DE RUTA / URUGUAY</div>
        <div className="mono-text map-subtitle">
          {selectedDept ? `SELECCIONADO: ${selectedDept.toUpperCase()}` : 'MOSTRANDO TODO EL PAIS'}
        </div>
      </div>
      
      <svg viewBox="0 0 400 420" className="uruguay-svg-map">
        {/* Network connections (roads) */}
        <g className="map-edges">
          {EDGES.map(([fromId, toId], index) => {
            const from = DEPARTMENTS.find(d => d.id === fromId);
            const to = DEPARTMENTS.find(d => d.id === toId);
            if (!from || !to) return null;
            
            const isHighlighted = 
              selectedDept === fromId || selectedDept === toId;

            return (
              <line
                key={`edge-${index}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isHighlighted ? '#4a5d5d' : '#1f1f1f'}
                strokeWidth={isHighlighted ? 1.5 : 1}
              />
            );
          })}
        </g>

        {/* Department Nodes */}
        <g className="map-nodes">
          {DEPARTMENTS.map((dept) => {
            const eventCount = getEventCountForDept(dept.id);
            const isSelected = selectedDept === dept.id;
            const hasEvents = eventCount > 0;

            return (
              <g 
                key={dept.id} 
                className={`map-node-group ${isSelected ? 'selected' : ''} ${hasEvents ? 'has-events' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDept(isSelected ? null : dept.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse background if there are events */}
                {hasEvents && (
                  <circle
                    cx={dept.x}
                    cy={dept.y}
                    r={isSelected ? 14 : 9}
                    fill="none"
                    stroke="#2F4F4F"
                    strokeWidth="1.5"
                    style={{
                      animation: 'pulse-green 2s infinite ease-in-out',
                      transformOrigin: `${dept.x}px ${dept.y}px`
                    }}
                  />
                )}

                {/* Base node circle */}
                <circle
                  cx={dept.x}
                  cy={dept.y}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? '#F5F5F3' : (hasEvents ? '#2F4F4F' : '#222222')}
                  stroke={isSelected ? '#2F4F4F' : '#333333'}
                  strokeWidth="1"
                />

                {/* Monospace label */}
                <text
                  x={dept.x}
                  y={dept.y - 10}
                  textAnchor="middle"
                  className="mono-text dept-label"
                  fill={isSelected ? '#F5F5F3' : '#666666'}
                  fontSize="8"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {dept.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Real Event Pins (based on actual GPS coordinates) */}
        <g className="map-event-pins">
          {events.map((event) => {
            const { x, y } = getMapCoordinates(parseFloat(event.lat), parseFloat(event.lng));
            const isSelectedDept = selectedDept === event.departamento;

            return (
              <g 
                key={`pin-${event.id}`}
                className="event-pin-group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent(event);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse background for active competition pin */}
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill="none"
                  stroke="#F5F5F3"
                  strokeWidth="1"
                  style={{
                    animation: 'pulse-dot 1.5s infinite ease-in-out',
                    transformOrigin: `${x}px ${y}px`
                  }}
                />

                {/* Pin core */}
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="#F5F5F3"
                />
              </g>
            );
          })}
        </g>
      </svg>
      
      <style>{`
        .map-container {
          background-color: #0b0b0b;
          border-bottom: 1px solid var(--border-subtle);
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 10;
        }
        .map-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 10px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
        }
        .map-title {
          color: var(--text-secondary);
        }
        .map-subtitle {
          color: var(--color-accent-silver);
          font-weight: bold;
        }
        .uruguay-svg-map {
          width: 100%;
          max-height: 320px;
        }
        .dept-label {
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
