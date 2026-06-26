import React, { useState, useEffect } from 'react';
// Cache-busted App.jsx
import { supabase } from './lib/supabaseClient';
import AgendaTab from './components/AgendaTab';
import EntrenarTab from './components/EntrenarTab';
import BottomSheet from './components/BottomSheet';
import { Calendar, Headphones, WifiOff, LogIn, User, Check, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('agenda'); // 'agenda' | 'train'
  const [events, setEvents] = useState([]);
  const [beats, setBeats] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isMapView, setIsMapView] = useState(false);
  const [session, setSession] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Supabase Session, Events & Beats
  useEffect(() => {
    // 1. Get user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserFavorites(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserFavorites(session.user.id);
        setAuthSuccessMsg(`CONECTADO: ${session.user.email.toUpperCase()}`);
        setTimeout(() => setAuthSuccessMsg(null), 3000);
      } else {
        setFavorites([]);
      }
    });

    // 2. Fetch Events & Beats
    try {
      const cached = localStorage.getItem('cached_beatmarket');
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasOldBeats = parsed.some(b => 
          !['Boom Bap Old School Funk', 'Trance Trap Free', 'Base de Rap Para Improvisar'].includes(b.beat_title)
        );
        if (hasOldBeats) {
          localStorage.removeItem('cached_beatmarket');
          console.log('Cleared outdated cached_beatmarket from localStorage.');
        }
      }
    } catch (e) {
      localStorage.removeItem('cached_beatmarket');
    }

    fetchEvents();
    fetchBeats();

    // 3. Load local favorites as fallback
    const localFavs = localStorage.getItem('local_favorites');
    if (localFavs && !session) {
      setFavorites(JSON.parse(localFavs));
    }

    return () => subscription.unsubscribe();
  }, []);

  const fetchEvents = async () => {
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('agenda_eventos')
          .select('*')
          .order('fecha', { ascending: true });

        if (error) throw error;
        
        setEvents(data);
        // Cache data for offline usage
        localStorage.setItem('cached_agenda_eventos', JSON.stringify(data));
      } else {
        loadCachedEvents();
      }
    } catch (err) {
      console.error('Error fetching events from database:', err);
      loadCachedEvents();
    }
  };

  const loadCachedEvents = () => {
    const cached = localStorage.getItem('cached_agenda_eventos');
    if (cached) {
      setEvents(JSON.parse(cached));
    }
  };

  const fetchBeats = async () => {
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('beatmarket')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        setBeats(data);
        localStorage.setItem('cached_beatmarket', JSON.stringify(data));
      } else {
        loadCachedBeats();
      }
    } catch (err) {
      console.warn('Error fetching beats from database, using fallback/cache:', err.message);
      loadCachedBeats();
    }
  };

  const loadCachedBeats = () => {
    const cached = localStorage.getItem('cached_beatmarket');
    if (cached) {
      setBeats(JSON.parse(cached));
    } else {
      // Fallback default beats in case the table is empty or offline first time
      setBeats([
        {
          id: 'beat-1',
          beat_title: 'Boom Bap Old School Funk',
          bpm: 90,
          producer_name: 'Sebastián Lorca',
          audio_url: 'https://inoremwazicuzbsehzax.supabase.co/storage/v1/object/public/beats/boom_bap_old_school.mp3',
          genre: 'Boom Bap',
          intro_duration: 0
        },
        {
          id: 'beat-2',
          beat_title: 'Trance Trap Free',
          bpm: 120,
          producer_name: 'BasesRap',
          audio_url: 'https://inoremwazicuzbsehzax.supabase.co/storage/v1/object/public/beats/trance_trap_free.mp3',
          genre: 'Trap',
          intro_duration: 0
        },
        {
          id: 'beat-3',
          beat_title: 'Base de Rap Para Improvisar',
          bpm: 95,
          producer_name: 'BasesRap',
          audio_url: 'https://inoremwazicuzbsehzax.supabase.co/storage/v1/object/public/beats/base_improvisar_rap.mp3',
          genre: 'Boom Bap',
          intro_duration: 5.5
        }
      ]);
    }
  };

  const loadUserFavorites = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles') // Check if user profiles table stores favorites, otherwise use local storage synced
        .select('favorites')
        .single();
      
      if (data && data.favorites) {
        setFavorites(data.favorites);
      } else {
        // Fallback: sync local favorites
        const localFavs = localStorage.getItem('local_favorites');
        if (localFavs) {
          setFavorites(JSON.parse(localFavs));
        }
      }
    } catch (err) {
      // If table profiles doesn't exist or fail, fallback to localStorage
      const localFavs = localStorage.getItem('local_favorites');
      if (localFavs) {
        setFavorites(JSON.parse(localFavs));
      }
    }
  };

  const handleToggleFavorite = async (eventId) => {
    if (!session) {
      // Prompt user to log in if anonymous
      setIsAuthDrawerOpen(true);
      return;
    }

    let updatedFavorites;
    if (favorites.includes(eventId)) {
      updatedFavorites = favorites.filter(id => id !== eventId);
    } else {
      updatedFavorites = [...favorites, eventId];
    }
    setFavorites(updatedFavorites);
    localStorage.setItem('local_favorites', JSON.stringify(updatedFavorites));

    // Try saving to Supabase if session exists
    try {
      await supabase
        .from('profiles')
        .upsert({ id: session.user.id, favorites: updatedFavorites });
    } catch (err) {
      console.warn('Failed to sync favorites with server profile, saved locally:', err);
    }
  };

  const handleOAuthSignIn = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error(`Auth failed for ${provider}:`, err);
      alert(`Error al conectar con ${provider}.`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('local_favorites');
    setFavorites([]);
  };

  return (
    <>
      {/* Top editorial header bar */}
      <header className="app-header">
        <div className="header-left">
          {isOffline ? (
            <div className="offline-pill mono-text">
              <WifiOff size={12} />
              <span>SIN SEÑAL</span>
            </div>
          ) : (
            <div className="online-indicator mono-text">
              <span className="dot" />
              <span>LIVE_ Plaza</span>
            </div>
          )}
        </div>
        
        <h1 className="logo-text">U_FREE</h1>
        
        <div className="header-right">
          {session ? (
            <button onClick={handleSignOut} className="header-auth-btn active" title="Cerrar Sesión">
              <User size={14} />
              <span className="mono-text truncate" style={{ maxWidth: '60px' }}>
                OUT
              </span>
            </button>
          ) : (
            <button onClick={() => setIsAuthDrawerOpen(true)} className="header-auth-btn" title="Iniciar Sesión">
              <LogIn size={14} />
              <span className="mono-text">LOGIN</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Tab Views */}
      <main className="tab-content">
        {activeTab === 'agenda' ? (
          <AgendaTab 
            events={events} 
            onSelectEvent={(event) => setSelectedEvent(event)} 
            selectedEvent={selectedEvent}
            onViewModeChange={(mode) => setIsMapView(mode === 'mapa')}
          />
        ) : (
          <EntrenarTab beats={beats} />
        )}
      </main>


      {/* Ergonomic Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <button 
          onClick={() => setActiveTab('agenda')}
          className={`bottom-nav-btn ${activeTab === 'agenda' ? 'active' : 'inactive'}`}
        >
          <Calendar size={20} />
          <span>Agenda</span>
        </button>
        <button 
          onClick={() => setActiveTab('train')}
          className={`bottom-nav-btn ${activeTab === 'train' ? 'active' : 'inactive'}`}
        >
          <Headphones size={20} />
          <span>Entrenar</span>
        </button>
      </nav>

      {/* Details Sheet Drawer */}
      <BottomSheet
        event={selectedEvent}
        isOpen={!!selectedEvent && !isMapView}
        onClose={() => setSelectedEvent(null)}
        isFavorite={selectedEvent ? favorites.includes(selectedEvent.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* OAuth Login Bottom Sheet */}
      <div className={`auth-backdrop ${isAuthDrawerOpen ? 'show' : ''}`} onClick={() => setIsAuthDrawerOpen(false)} />
      <div className={`auth-drawer ${isAuthDrawerOpen ? 'open' : ''}`}>
        <div className="auth-handle-container" onClick={() => setIsAuthDrawerOpen(false)}>
          <div className="auth-handle" />
        </div>
        <div className="auth-content">
          <div className="auth-header">
            <h3 className="auth-title">VINCULAR CUENTA</h3>
            <p className="auth-desc">Vincular una cuenta te permite respaldar tus competencias favoritas y recuperarlas desde cualquier dispositivo.</p>
          </div>
          
          <div className="auth-buttons">
            <button onClick={() => handleOAuthSignIn('google')} className="auth-btn google-btn">
              <span>VINCULAR CON GOOGLE</span>
            </button>
            <button onClick={() => handleOAuthSignIn('apple')} className="auth-btn apple-btn">
              <span>VINCULAR CON APPLE</span>
            </button>
            <button onClick={() => setIsAuthDrawerOpen(false)} className="auth-btn guest-btn">
              <span>SEGUIR COMO INVITADO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {authSuccessMsg && (
        <div className="auth-toast mono-text">
          <Check size={14} />
          <span>{authSuccessMsg}</span>
        </div>
      )}

      <style>{`
        .app-header {
          height: 56px;
          border-bottom: 2px solid var(--border-subtle);
          background-color: var(--bg-panel);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          position: relative;
          z-index: 90;
          box-shadow: inset 0px 1px 0px var(--border-highlight), 0px 2px 5px rgba(0,0,0,0.15);
        }
        
        .logo-text {
          font-size: 15px;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: 0.1em;
          text-align: center;
          color: var(--color-accent-amber);
          text-shadow: 0 0 6px rgba(255, 166, 0, 0.4);
          background-color: var(--bg-screen);
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid var(--border-subtle);
          box-shadow: inset 1px 1.5px 3px rgba(0,0,0,0.8);
        }
        
        .header-left, .header-right {
          width: 90px;
          display: flex;
          align-items: center;
        }
        
        .header-right {
          justify-content: flex-end;
        }
        
        .offline-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 8px;
          font-weight: bold;
          color: var(--color-accent-red);
          border: 1px solid var(--color-accent-red);
          background-color: rgba(255, 77, 77, 0.05);
          padding: 3px 6px;
          border-radius: 4px;
          box-shadow: 0 0 4px rgba(255, 77, 77, 0.2);
        }
        
        .online-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 8px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-weight: 700;
        }
        
        .online-indicator .dot {
          width: 6px;
          height: 6px;
          background-color: var(--color-accent-green);
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 6px var(--color-accent-green), inset 0px 1px 1px rgba(255, 255, 255, 0.3);
          animation: led-blink 1.5s infinite ease-in-out;
        }
        
        .header-auth-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 8px;
          font-weight: bold;
          color: var(--text-primary);
          border: 1px solid var(--border-subtle);
          background-color: var(--bg-card);
          padding: 5px 10px;
          border-radius: 6px;
          box-shadow: inset 1px 1px 0px rgba(255, 255, 255, 0.05), 
                      0px 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.1s;
        }
        .header-auth-btn:active {
          transform: translateY(1px);
          box-shadow: inset 1.5px 2px 3px rgba(0, 0, 0, 0.6);
          background-color: #17181a;
        }
        .header-auth-btn.active {
          color: var(--color-accent-amber);
          border-color: var(--color-accent-amber);
        }
        
        /* Auth Drawer Slider */
        .auth-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.85);
          z-index: 1001;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .auth-backdrop.show {
          opacity: 1;
          pointer-events: auto;
        }
        
        .auth-drawer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--bg-panel);
          border-top: 2px solid var(--border-subtle);
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          z-index: 1002;
          transform: translateY(100%);
          box-shadow: 0px -10px 30px rgba(0,0,0,0.5), inset 0px 1px 0px var(--border-highlight);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .auth-drawer.open {
          transform: translateY(0);
        }
        
        .auth-handle-container {
          width: 100%;
          padding: 14px 0 8px 0;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
        }
        .auth-handle {
          width: 36px;
          height: 5px;
          background-color: var(--border-subtle);
          border-radius: 2.5px;
          box-shadow: inset 0px 1px 2px rgba(0,0,0,0.5), 0px 1px 0px var(--border-highlight);
        }
        
        .auth-content {
          padding: 10px 24px 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .auth-header {
          text-align: center;
        }
        .auth-title {
          font-size: 16px;
          margin-bottom: 6px;
          font-family: var(--font-mono);
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--color-accent-amber);
        }
        .auth-desc {
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        
        .auth-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .auth-btn {
          width: 100%;
          height: 48px;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 11px;
          font-weight: 700;
          border-radius: 8px;
          text-transform: uppercase;
          border: 1px solid var(--border-subtle);
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05),
                      0px 3px 5px rgba(0,0,0,0.3);
          transition: all 0.1s ease;
        }
        .auth-btn:active {
          transform: translateY(1.5px);
          box-shadow: inset 1.5px 2px 3px rgba(0, 0, 0, 0.7);
        }
        
        .google-btn {
          background-color: var(--text-primary);
          color: var(--bg-base);
          border-color: var(--text-primary);
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.2), 0px 3px 5px rgba(0,0,0,0.3);
        }
        
        .apple-btn {
          background-color: var(--bg-card);
          color: var(--text-primary);
        }
        
        .guest-btn {
          background-color: transparent;
          color: var(--text-secondary);
          border-color: transparent;
          box-shadow: none;
        }
        .guest-btn:active {
          color: var(--text-primary);
          background-color: rgba(255, 255, 255, 0.02);
        }
        
        .auth-toast {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background-color: var(--bg-screen);
          border: 1px solid var(--color-accent-green);
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: bold;
          color: var(--color-accent-green);
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 2000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.8), inset 0px 1px 3px rgba(0,0,0,0.5);
          text-shadow: 0 0 4px rgba(57, 211, 83, 0.4);
        }
      `}</style>
    </>
  );
}
