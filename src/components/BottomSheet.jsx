import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, MessageSquare, Compass, Heart } from 'lucide-react';

const InstagramIcon = ({ size = 18, className = "", style = {} }) => (
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

export default function BottomSheet({ 
  event, 
  isOpen, 
  onClose, 
  isFavorite, 
  onToggleFavorite 
}) {
  if (!event) return null;

  const [imageError, setImageError] = useState(false);

  // Reset image error state when event changes
  useEffect(() => {
    setImageError(false);
  }, [event.id]);

  // External Links
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`;
  const whatsappUrl = event.whatsapp_url || 'https://chat.whatsapp.com/mock';

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`bottom-sheet-backdrop ${isOpen ? 'show' : ''}`} 
        onClick={onClose}
      />

      {/* Bottom Sheet Drawer */}
      <div className={`bottom-sheet-drawer ${isOpen ? 'open' : ''}`}>
        {/* Drag handle */}
        <div className="bottom-sheet-handle-container" onClick={onClose}>
          <div className="bottom-sheet-handle" />
        </div>

        {/* Content */}
        <div className="bottom-sheet-content">
          {/* Header Row */}
          <div className="sheet-header">
            <div>
              <div className="sheet-organizer-row">
                <img 
                  src={getOrganizerLogo(event.instagram_url)} 
                  alt="Organizador" 
                  className="sheet-organizer-logo"
                />
                <span className="mono-text event-category">{event.departamento.toUpperCase()}</span>
              </div>
              <h2 className="event-title">{event.nombre}</h2>
            </div>
            <div className="sheet-header-actions">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(event.id);
                }} 
                className={`fav-btn ${isFavorite ? 'active' : ''}`}
                title={isFavorite ? 'Quitar de Favoritos' : 'Agregar a Favoritos'}
              >
                <Heart size={20} fill={isFavorite ? '#F5F5F3' : 'none'} stroke={isFavorite ? '#F5F5F3' : '#8E8E8E'} />
              </button>
              <button onClick={onClose} className="close-btn">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Flyer Image Container (in original full-color as specified) */}
          <div className="flyer-container">
            {(!event.flyer_url || event.flyer_url.includes('placeholder') || event.flyer_url.includes('picsum.photos') || imageError) ? (
              <div className="flyer-fallback-banner">
                <div className="fallback-grid-overlay" />
                <div className="fallback-content">
                  <span className="fallback-subtitle">{event.departamento.toUpperCase()}</span>
                  <h3 className="fallback-title">{event.nombre}</h3>
                  <div className="fallback-decoration">
                    <span className="deco-dot green" />
                    <span className="deco-dot amber" />
                    <span className="deco-dot red" />
                    <span className="deco-line" />
                    <span className="mono-text deco-tech">SYS-LNK // UNDERLAND</span>
                  </div>
                </div>
              </div>
            ) : (
              <img 
                src={event.flyer_url} 
                alt={`Flyer de ${event.nombre}`} 
                className="flyer-img"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Detailed Info Grid */}
          <div className="info-grid">
            <div className="info-item">
              <Calendar size={16} className="info-icon" />
              <div>
                <div className="mono-text info-label">FECHA</div>
                {event.instagram_url ? (
                  <a
                    href={event.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="info-val info-link"
                    title="Ver post original en Instagram"
                  >
                    {new Date(event.fecha.replace(/-/g, '/')).toLocaleDateString('es-UY', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                    <InstagramIcon size={12} style={{ marginLeft: '6px', opacity: 0.8 }} />
                  </a>
                ) : (
                  <div className="info-val">
                    {new Date(event.fecha.replace(/-/g, '/')).toLocaleDateString('es-UY', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="info-item">
              <Clock size={16} className="info-icon" />
              <div>
                <div className="mono-text info-label">INSCRIPCIONES</div>
                <div className="info-val">{event.hora_inscripcion}</div>
              </div>
            </div>

            <div className="info-item">
              <MapPin size={16} className="info-icon" />
              <div>
                <div className="mono-text info-label">UBICACIÓN</div>
                <div className="info-val">{event.lugar}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons (Ergonomic, Thumb height at bottom) */}
          <div className="actions-container">
            <a 
              href={mapsUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="action-btn maps-btn"
            >
              <Compass size={18} />
              <span>¿Cómo llegar?</span>
            </a>
            
            <a 
              href={whatsappUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="action-btn whatsapp-btn"
            >
              <MessageSquare size={18} />
              <span>Coordinar viaje</span>
            </a>

            {event.instagram_url && (
              <a 
                href={event.instagram_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="action-btn instagram-btn"
              >
                <InstagramIcon size={18} />
                <span>Ver post original</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .bottom-sheet-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.8);
          z-index: 999;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bottom-sheet-backdrop.show {
          opacity: 1;
          pointer-events: auto;
        }
        
        .bottom-sheet-drawer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--bg-panel);
          border-top: 2px solid var(--border-subtle);
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          z-index: 1000;
          max-height: 85%;
          display: flex;
          flex-direction: column;
          box-shadow: 0px -10px 30px rgba(0,0,0,0.5), inset 0px 1px 0px var(--border-highlight);
          transform: translateY(100%);
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          overflow-y: auto;
        }
        .bottom-sheet-drawer.open {
          transform: translateY(0);
        }
        
        .bottom-sheet-handle-container {
          width: 100%;
          padding: 14px 0 8px 0;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
        }
        .bottom-sheet-handle {
          width: 36px;
          height: 5px;
          background-color: var(--border-subtle);
          border-radius: 2.5px;
          box-shadow: inset 0px 1px 2px rgba(0,0,0,0.5), 0px 1px 0px var(--border-highlight);
        }
        
        .bottom-sheet-content {
          padding: 0 20px 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1.5px solid var(--border-subtle);
          padding-bottom: 12px;
        }
        .event-category {
          font-size: 8px;
          font-family: var(--font-mono);
          color: var(--text-secondary);
          display: block;
        }
        
        .sheet-organizer-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        
        .sheet-organizer-logo {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--border-subtle);
        }
        .sheet-organizer-logo-fallback {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #151617;
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }
        .event-title {
          font-size: 18px;
          font-weight: 700;
          line-height: 1.2;
          color: var(--text-primary);
        }
        .sheet-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .close-btn, .fav-btn {
          width: 36px;
          height: 36px;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: var(--text-primary);
          background-color: var(--bg-card);
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.03), 0px 1px 2px rgba(0,0,0,0.3);
          transition: all 0.1s;
        }
        .close-btn:active, .fav-btn:active {
          transform: translateY(1.5px);
          box-shadow: inset 1.5px 2px 3px rgba(0,0,0,0.6);
        }
        .fav-btn.active {
          color: var(--color-accent-amber);
          border-color: var(--color-accent-amber);
        }
        
        .flyer-container {
          width: 100%;
          height: 180px;
          overflow: hidden;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background-color: var(--bg-screen);
          box-shadow: inset 2px 2px 5px rgba(0,0,0,0.8);
        }
        .flyer-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .flyer-fallback-banner {
          width: 100%;
          height: 100%;
          position: relative;
          background: linear-gradient(135deg, #1C1D1F 0%, #0F0F10 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255, 166, 0, 0.15);
        }
        .fallback-grid-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-size: 16px 16px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
          pointer-events: none;
        }
        .fallback-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          width: 100%;
        }
        .fallback-subtitle {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          color: var(--color-accent-amber);
          letter-spacing: 0.15em;
          margin-bottom: 6px;
          text-shadow: 0 0 8px rgba(255, 166, 0, 0.3);
        }
        .fallback-title {
          font-family: var(--font-editorial);
          font-size: 18px;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          text-transform: uppercase;
          margin-bottom: 12px;
          max-width: 90%;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          line-height: 1.25;
        }
        .fallback-decoration {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          justify-content: center;
        }
        .deco-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          box-shadow: 0 0 6px currentColor;
        }
        .deco-dot.green { color: var(--color-accent-green); background-color: var(--color-accent-green); }
        .deco-dot.amber { color: var(--color-accent-amber); background-color: var(--color-accent-amber); }
        .deco-dot.red { color: var(--color-accent-red); background-color: var(--color-accent-red); }
        .deco-line {
          height: 1px;
          flex: 0.2;
          background-color: var(--border-subtle);
        }
        .deco-tech {
          font-size: 7px;
          color: var(--text-secondary);
          letter-spacing: 0.05em;
        }
        
        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background-color: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 14px;
          box-shadow: inset 1px 1.5px 3px rgba(0,0,0,0.4);
        }
        .info-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .info-icon {
          color: var(--color-accent-amber);
          margin-top: 2px;
        }
        .info-label {
          font-size: 8px;
          font-family: var(--font-mono);
          color: var(--text-secondary);
          margin-bottom: 2px;
        }
        .info-val {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        
        .actions-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }
        
        .action-btn {
          width: 100%;
          height: 48px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
          text-transform: uppercase;
          border: 1px solid var(--border-subtle);
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05),
                      0px 3px 6px rgba(0,0,0,0.35);
          transition: all 0.1s ease;
        }
        .action-btn:active {
          transform: translateY(1.5px);
          box-shadow: inset 1.5px 2px 3px rgba(0, 0, 0, 0.7);
        }
        
        .maps-btn {
          background-color: var(--bg-card);
          color: var(--color-accent-amber);
          border-color: var(--color-accent-amber);
        }
        
        .whatsapp-btn {
          background-color: var(--bg-card);
          color: #25D366;
          border-color: rgba(37, 211, 102, 0.4);
        }
        .whatsapp-btn:hover {
          background-color: rgba(37, 211, 102, 0.05);
        }
 
        .instagram-btn {
          background-color: var(--bg-card);
          color: var(--text-primary);
        }
        .instagram-btn:hover {
          background-color: rgba(255, 255, 255, 0.02);
        }
 
        .info-link {
          color: var(--text-primary);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: color 0.2s;
        }
        .info-link:hover {
          text-decoration: underline;
          color: var(--color-accent-amber);
        }
      `}</style>
    </>
  );
}
