import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Mic, MicOff, Headphones, Share2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  detectHeadphones, 
  saveRecordingToLocal, 
  getLocalRecordings, 
  getLocalRecordingById,
  deleteLocalRecording,
  convertBlobToWav
} from '../utils/audioManager';

const FALLBACK_BEATS = [
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
];

const URUGUAYAN_WORDS = [
  'RAMBLA', 'MATE', 'BONDI', 'CONAPROLE', 'REPECHO', 'BIZCOCHO', 
  'ANTEL', 'CUTCSA', 'GARRA CHARRÚA', 'TERMO', 'CHIVITO', 'TABLADO', 
  'MURGA', 'CANDOMBE', 'BOCHA', 'GURÍ', 'REBOQUE', 'BOTIJA', 'FAROL', 
  'CHAMPIONES', 'PLUNA', 'PELODURO', 'BAGAYO', 'BOLICHE', 'MATEADA'
];

// DJB2 Hash based on Device Date (YYYY-MM-DD)
const getDailySeed = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let hash = 5381;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) + hash) + dateStr.charCodeAt(i);
  }
  return Math.abs(hash);
};

// Select 1 beat based on the seed
const getDailyBeatIndex = (seed, totalBeats) => {
  if (totalBeats === 0) return 0;
  return seed % totalBeats;
};

// Select 3 unique words based on the seed
const getDailyWords = (seed, wordsArray) => {
  if (!wordsArray || wordsArray.length < 3) return ['MATE', 'BONDI', 'RAMBLA'];
  const selected = [];
  let currentSeed = seed;
  while (selected.length < 3) {
    const index = currentSeed % wordsArray.length;
    const word = wordsArray[index];
    if (!selected.includes(word)) {
      selected.push(word);
    }
    // Update seed value to get next word
    currentSeed = Math.floor(currentSeed / 13) + 7;
  }
  return selected;
};

export default function EntrenarTab({ beats = [] }) {
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStudioMode, setIsStudioMode] = useState(false); // true = Headphones (digital mix), false = Plaza (ambient)
  const [currentWord, setCurrentWord] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [recordings, setRecordings] = useState([]);
  const [isMixing, setIsMixing] = useState(false);

  // Smart reproducer states
  const [isIntroActive, setIsIntroActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null); // null | 3 | 2 | 1 | '¡TIEMPO!'
  const [introSecondsLeft, setIntroSecondsLeft] = useState(0);
  const [introTotalTime, setIntroTotalTime] = useState(0);

  // Daily Challenge state
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const isChallengeModeRef = useRef(false);

  // Audio playback and recording refs
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const wordIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const introIntervalRef = useRef(null);
  const introTimeoutRef = useRef(null);
  const startTimeRef = useRef(0);
  const challengeWordIndexRef = useRef(0);

  // Local audio player states & refs
  const [playingRecId, setPlayingRecId] = useState(null);
  const localAudioRef = useRef(null);
  const localAudioUrlRef = useRef(null);

  // Web Audio Context & Nodal bridge refs
  const audioCtxRef = useRef(null);
  const beatSourceRef = useRef(null);
  const micSourceRef = useRef(null);

  // Gesture swipe tracking
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const activeBeats = beats && beats.length > 0 ? beats : FALLBACK_BEATS;
  const activeBeat = activeBeats[activeBeatIndex];

  // Daily Challenge calculations
  const dailySeed = React.useMemo(() => getDailySeed(), []);
  const dailyBeatIndex = React.useMemo(() => {
    return getDailyBeatIndex(dailySeed, activeBeats.length);
  }, [dailySeed, activeBeats.length]);
  const dailyBeat = activeBeats[dailyBeatIndex];
  const dailyWords = React.useMemo(() => {
    return getDailyWords(dailySeed, URUGUAYAN_WORDS);
  }, [dailySeed]);

  // Load local recordings on mount
  useEffect(() => {
    loadRecordings();
    
    // Auto-detect headphones on mount
    detectHeadphones().then(hasHeadphones => {
      setIsStudioMode(hasHeadphones);
    });



    return () => {
      stopPlaybackAndIntervals();
    };
  }, []);

  const formatSize = (blob) => {
    if (!blob) return '0 KB';
    const size = blob.size;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const loadRecordings = async () => {
    try {
      const data = await getLocalRecordings();
      // Sort: newest first
      setRecordings(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error('Error loading recordings:', err);
    }
  };

  const stopPlaybackAndIntervals = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(err => console.warn('Failed to close audio context:', err));
      audioCtxRef.current = null;
    }
    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current = null;
    }
    if (localAudioUrlRef.current) {
      URL.revokeObjectURL(localAudioUrlRef.current);
      localAudioUrlRef.current = null;
    }
    setPlayingRecId(null);
    
    if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
  };

  // Swiping gestures on beat picker
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextBeat();
    } else if (isRightSwipe) {
      prevBeat();
    }
  };

  const nextBeat = () => {
    if (isTraining) return;
    setActiveBeatIndex(prev => (prev + 1) % activeBeats.length);
  };

  const prevBeat = () => {
    if (isTraining) return;
    setActiveBeatIndex(prev => (prev - 1 + activeBeats.length) % activeBeats.length);
  };

  // Select word based on Challenge mode status
  const pickWord = () => {
    if (isChallengeModeRef.current) {
      const word = dailyWords[challengeWordIndexRef.current % 3];
      setCurrentWord(word);
      challengeWordIndexRef.current += 1;
    } else {
      const randomIndex = Math.floor(Math.random() * URUGUAYAN_WORDS.length);
      setCurrentWord(URUGUAYAN_WORDS[randomIndex]);
    }
  };

  // Accept Daily Challenge Action
  const handleAcceptChallenge = () => {
    setIsChallengeMode(true);
    isChallengeModeRef.current = true;
    
    // Configure players with Daily Challenge beat
    setActiveBeatIndex(dailyBeatIndex);
    
    // Force record session
    setIsRecording(true);

    // Call startTraining immediately overriding settings
    startTraining(dailyBeat, true);
  };

  // Start Training Routine
  const startTraining = async (overrideBeat = null, overrideRecording = null) => {
    const targetBeat = overrideBeat || activeBeat;
    const targetRecording = overrideRecording !== null ? overrideRecording : isRecording;

    const beatUrl = targetBeat.audio_url || targetBeat.url;
    const beatName = targetBeat.beat_title || targetBeat.name;

    // 1. Setup Web Audio API and start recording if targetRecording is true
    if (targetRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;

        // Create Web Audio recording destination node
        const recordingDestination = audioCtx.createMediaStreamDestination();

        // Route mic input to recording destination
        const micSource = audioCtx.createMediaStreamSource(stream);
        micSourceRef.current = micSource;
        micSource.connect(recordingDestination);

        // Setup audio element for the beat (with crossOrigin for CORS)
        audioRef.current = new Audio(beatUrl);
        audioRef.current.loop = true;
        audioRef.current.crossOrigin = 'anonymous';

        // Connect the beat player to Web Audio graph
        const beatSource = audioCtx.createMediaElementSource(audioRef.current);
        beatSourceRef.current = beatSource;
        // Beat goes both to recording destination (mix) and physical output (headphones/speakers)
        beatSource.connect(recordingDestination);
        beatSource.connect(audioCtx.destination);

        // MediaRecorder records directly from the unified mixed stream
        const mediaRecorder = new MediaRecorder(recordingDestination.stream);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        const recorderMime = mediaRecorder.mimeType || 'audio/webm';
        mediaRecorder.onstop = async () => {
          const rawBlob = new Blob(audioChunksRef.current, { type: recorderMime });
          let finalBlob = rawBlob;

          // Stop all stream tracks to turn off mic light
          stream.getTracks().forEach(track => track.stop());

          setIsMixing(true);
          try {
            // Decode and convert mixed recording to standard WAV format
            finalBlob = await convertBlobToWav(rawBlob);
          } catch (err) {
            console.error('Failed to convert mixed recording to WAV, using raw output:', err);
          }
          setIsMixing(false);

          // Save to local IndexedDB
          const timestamp = Date.now();
          const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
          
          // Generate brutalist name (TRN_ or CHL_)
          const prefix = isChallengeModeRef.current ? 'CHL' : 'TRN';
          const date = new Date(timestamp);
          const nameStr = `${prefix}_${beatName.replace(/\s+/g, '').toUpperCase()}_${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}_${date.getHours().toString().padStart(2,'0')}${date.getMinutes().toString().padStart(2,'0')}`;

          await saveRecordingToLocal({
            name: nameStr,
            blob: finalBlob,
            duration: duration,
            beatName: beatName,
            timestamp: timestamp,
            isChallenge: isChallengeModeRef.current
          });

          loadRecordings();
        };

        mediaRecorder.start();
        
        // Play the beat element
        try {
          await audioRef.current.play();
        } catch (playErr) {
          console.warn('Audio playback blocked or failed:', playErr);
        }
      } catch (micErr) {
        console.error('Error starting Web Audio recording:', micErr);
        alert('Error de micrófono: Habilitá los permisos de audio/micrófono para poder grabar tu sesión. Detalle: ' + micErr.message);
        stopTraining();
        return;
      }
    } else {
      // 2. Setup and Play Audio Loop without recording
      try {
        audioRef.current = new Audio(beatUrl);
        audioRef.current.loop = true;
        audioRef.current.crossOrigin = 'anonymous';
        await audioRef.current.play();
      } catch (playErr) {
        console.warn('Audio playback blocked or failed:', playErr);
      }
    }

    // 3. Smart intro / Countdown logic
    setIsTraining(true);
    setIsIntroActive(true);
    setCountdownValue(null);

    const bpm = targetBeat.bpm || 90;
    const beatDuration = 60 / bpm; // in seconds

    // Calculate intro duration (vuelta duration)
    // Formula: 960 / bpm if intro_duration is 0 or undefined
    const introDuration = Number(targetBeat.intro_duration) > 0 
      ? Number(targetBeat.intro_duration) 
      : (960 / bpm);

    setIntroTotalTime(introDuration);
    setIntroSecondsLeft(introDuration);

    let cypherStarted = false;

    // High-frequency polling (20ms) to sync with audio.currentTime
    introIntervalRef.current = setInterval(() => {
      if (!audioRef.current) return;

      const currentTime = audioRef.current.currentTime;
      const remaining = Math.max(0, introDuration - currentTime);
      setIntroSecondsLeft(remaining);

      // Trigger the cypher drop when intro duration is reached
      if (currentTime >= introDuration) {
        if (!cypherStarted) {
          cypherStarted = true;
          clearInterval(introIntervalRef.current);
          setCountdownValue(null);
          setIsIntroActive(false);

          startTimeRef.current = Date.now(); // Reset time ref for recording duration

          // Pick first word and start word rotation interval
          challengeWordIndexRef.current = 0;
          pickWord();
          
          wordIntervalRef.current = setInterval(() => {
            setSecondsLeft(prev => {
              if (prev <= 1) {
                pickWord();
                return 10;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } else if (currentTime >= introDuration - beatDuration) {
        setCountdownValue('¡TIEMPO!');
      } else if (currentTime >= introDuration - 2 * beatDuration) {
        setCountdownValue(1);
      } else if (currentTime >= introDuration - 3 * beatDuration) {
        setCountdownValue(2);
      } else if (currentTime >= introDuration - 4 * beatDuration) {
        setCountdownValue(3);
      } else {
        setCountdownValue(null);
      }
    }, 20);
  };

  const stopTraining = () => {
    stopPlaybackAndIntervals();
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    setIsTraining(false);
    setIsIntroActive(false);
    setCountdownValue(null);
    setSecondsLeft(10);
    setCurrentWord('');
    setIsChallengeMode(false);
    isChallengeModeRef.current = false;
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar esta grabación?')) {
      try {
        await deleteLocalRecording(id);
        loadRecordings();
      } catch (err) {
        console.error('Error deleting recording:', err);
        alert('No se pudo eliminar la grabación de la base de datos: ' + err.message);
      }
    }
  };



  const handleShare = (recording) => {
    try {
      const blob = recording.blob;
      if (!blob) {
        alert('No se pudo encontrar el archivo de audio para compartir.');
        return;
      }

      const isWav = blob.type.includes('wav');
      const ext = isWav ? 'wav' : 'webm';
      const mime = blob.type || (isWav ? 'audio/wav' : 'audio/webm');
      
      const file = new File([blob], `${recording.name}.${ext}`, { type: mime });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `Freestyle Uruguay - ${recording.name}`,
          text: '¡Escuchá mi freestyle grabado!'
        }).catch(err => {
          console.error('Error sharing native file:', err);
        });
      } else {
        // Fallback: download directly
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recording.name}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error sharing file:', err);
      alert('No se pudo compartir el archivo: ' + err.message);
    }
  };

  const handlePlayLocal = (recording) => {
    // If clicking the currently playing recording, toggle play/pause
    if (playingRecId === recording.id) {
      if (localAudioRef.current) {
        if (localAudioRef.current.paused) {
          localAudioRef.current.play()
            .then(() => setPlayingRecId(recording.id))
            .catch(err => {
              console.error('Error playing audio:', err);
              alert('Error al reproducir: ' + err.message);
            });
        } else {
          localAudioRef.current.pause();
          setPlayingRecId(null);
        }
      }
      return;
    }

    // Stop current audio if playing
    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current = null;
    }
    if (localAudioUrlRef.current) {
      URL.revokeObjectURL(localAudioUrlRef.current);
      localAudioUrlRef.current = null;
    }

    try {
      const blob = recording.blob;
      if (!blob) {
        alert('No se pudo encontrar el archivo de audio de esta grabación.');
        return;
      }

      // Generate temporary URL
      const url = URL.createObjectURL(blob);
      localAudioUrlRef.current = url;

      // Create Audio element
      const audio = new Audio(url);
      localAudioRef.current = audio;

      // Setup events
      audio.onended = () => {
        setPlayingRecId(null);
        if (localAudioUrlRef.current) {
          URL.revokeObjectURL(localAudioUrlRef.current);
          localAudioUrlRef.current = null;
        }
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        const err = audio.error;
        let errMsg = 'Desconocido';
        if (err) {
          switch (err.code) {
            case err.MEDIA_ERR_ABORTED: errMsg = 'Reproducción abortada.'; break;
            case err.MEDIA_ERR_NETWORK: errMsg = 'Error de red.'; break;
            case err.MEDIA_ERR_DECODE: errMsg = 'Error de decodificación. El formato de audio podría no ser compatible con tu dispositivo.'; break;
            case err.MEDIA_ERR_SRC_NOT_SUPPORTED: errMsg = 'Formato de audio no soportado.'; break;
          }
        }
        alert('Error en elemento de audio: ' + errMsg);
        setPlayingRecId(null);
      };

      // Play
      audio.play()
        .then(() => {
          setPlayingRecId(recording.id);
        })
        .catch((err) => {
          console.error('Audio play failed:', err);
          alert('Error de reproducción en el celular: ' + err.message + '\n\nDetalle: Los navegadores en celulares a veces bloquean la reproducción automática o formatos no compatibles. Intenta grabar en Modo Estudio (mezcla digital WAV).');
          setPlayingRecId(null);
        });

    } catch (err) {
      console.error('Error preparing local playback:', err);
      alert('Error al reproducir la grabación: ' + err.message);
    }
  };

  const beatNameStr = activeBeat.beat_title || activeBeat.name;
  const beatProdStr = activeBeat.producer_name || activeBeat.prod || 'Prod. Local';
  const beatGenreStr = activeBeat.genre || 'Género';

  return (
    <div className="train-tab-container">
      {isTraining ? (
        /* Training overlay visible from 2 meters away */
        <div className="training-active-overlay brutalist-training">
          {isIntroActive ? (
            /* Intro / Countdown screen */
            <div className="intro-container">
              {countdownValue !== null ? (
                <div className="countdown-value-box">
                  <h1 className={`countdown-number ${countdownValue === '¡TIEMPO!' ? 'go' : ''}`}>
                    {countdownValue}
                  </h1>
                </div>
              ) : (
                <div className="intro-waiting-box">
                  <div className="waiting-status mono-text blink-slow">ALINEANDO COMPÁS...</div>
                  <h2 className="waiting-seconds mono-text">{introSecondsLeft.toFixed(1)}s</h2>
                  <div className="brutalist-progress">
                    <div 
                      className="brutalist-progress-fill" 
                      style={{ width: `${((introTotalTime - introSecondsLeft) / introTotalTime) * 100}%` }}
                    />
                  </div>
                  <div className="intro-details mono-text">
                    {beatNameStr.toUpperCase()} ({activeBeat.bpm} BPM)
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Active freestyle session */
            <div className="freestyle-active-container">
              {/* Top timer */}
              <div className="timer-section mono-text">
                <span>{secondsLeft.toString().padStart(2, '0')}s</span>
                <div className="small-detail">SIGUIENTE PALABRA</div>
              </div>

              {/* Central giant word */}
              <div className="word-section">
                <h1 className="giant-word">{currentWord}</h1>
              </div>

              {/* Bottom active words tracker (only in Daily Challenge mode) */}
              {isChallengeMode && (
                <div className="challenge-words-tracker">
                  <div className="tracker-title mono-text">CONCEPTOS OBLIGATORIOS:</div>
                  <div className="tracker-badges-container">
                    {dailyWords.map((word) => {
                      const isActive = currentWord === word;
                      return (
                        <span key={word} className={`tracker-badge mono-text ${isActive ? 'active' : ''}`}>
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom active controls block */}
          <div className="training-controls">
            <div className="mono-text training-details">
              <span>{beatNameStr.toUpperCase()} ({activeBeat.bpm} BPM)</span>
              {isRecording && (
                <div className="rec-badge">
                  <div className="rec-dot" />
                  <span>GRABANDO ({isStudioMode ? 'ESTUDIO' : 'PLAZA'})</span>
                </div>
              )}
            </div>
            
            <button onClick={stopTraining} className="action-btn stop-btn">
              <Square size={20} fill="#121212" />
              <span>Detener sesión</span>
            </button>
          </div>
        </div>
      ) : (
        /* Clean default menu layout */
        <div className="train-idle-menu">
          {/* Deck Title */}
          <div className="deck-title-box">
            <span className="mono-text sub">BEATMARKER - REPRODUCTOR INTELIGENTE</span>
            <h2 className="title">CYPHER PLAZA</h2>
          </div>

          {/* Daily Challenge Highlighted Card */}
          <div className="daily-challenge-panel brutalist-card">
            <div className="card-badge mono-text">DESAFÍO DEL DÍA</div>
            <div className="card-header-row">
              <span className="mono-text challenge-date">
                {new Date().toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
            <h3 className="challenge-beat-title">
              BASE: {dailyBeat?.beat_title || dailyBeat?.name || 'Cargando...'}
            </h3>
            <div className="challenge-meta mono-text">
              TEMPO: {dailyBeat?.bpm} BPM | GÉNERO: {(dailyBeat?.genre || 'Género').toUpperCase()}
            </div>
            <div className="challenge-words-row">
              <span className="words-label mono-text">CONCEPTOS OBLIGATORIOS:</span>
              <div className="words-badge-container">
                {dailyWords.map(w => (
                  <span key={w} className="challenge-word-badge mono-text">{w}</span>
                ))}
              </div>
            </div>
            <button 
              onClick={handleAcceptChallenge} 
              className="accept-challenge-btn mono-text"
            >
              ACEPTAR DESAFÍO
            </button>
          </div>

          {/* Beat Swiper Card (Brutalist style) */}
          <div 
            className="beat-picker-card brutalist-deck"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <button onClick={prevBeat} className="picker-arrow-btn">
              <ChevronLeft size={24} />
            </button>

            <div className="beat-card-content">
              <span className="mono-text prod-label">{beatProdStr.toUpperCase()}</span>
              <h3 className="beat-name">{beatNameStr}</h3>
              <div className="beat-meta-row mono-text">
                <span className="genre-label">{beatGenreStr.toUpperCase()}</span>
                <span className="separator">/</span>
                <span className="bpm-label">{activeBeat.bpm} BPM</span>
              </div>
            </div>

            <button onClick={nextBeat} className="picker-arrow-btn">
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Configuration Options (Thumb accessible zone) */}
          <div className="config-grid">
            {/* Record toggle */}
            <button 
              className={`config-card brutalist-config ${isRecording ? 'active' : ''}`}
              onClick={() => setIsRecording(prev => !prev)}
            >
              {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
              <div>
                <div className="mono-text label">MICROFONO</div>
                <div className="val">{isRecording ? 'GRABAR SESIÓN' : 'SOLO AUDIO'}</div>
              </div>
            </button>

            {/* Studio vs Plaza mode switch */}
            <button 
              className={`config-card brutalist-config ${isStudioMode ? 'studio' : 'plaza'}`}
              onClick={() => setIsStudioMode(prev => !prev)}
            >
              <Headphones size={20} />
              <div>
                <div className="mono-text label">LÓGICA AUDIO</div>
                <div className="val">{isStudioMode ? 'MODO ESTUDIO' : 'MODO PLAZA'}</div>
              </div>
            </button>
          </div>



          {/* Big START button (Brutalist thick) */}
          <div className="start-btn-container">
            <button onClick={() => startTraining()} className="giant-start-btn brutalist-btn-start">
              <Play size={28} fill="#121212" />
              <span>EMPEZAR CYPHER</span>
            </button>
          </div>

          {/* Saved recordings list */}
          <div className="recordings-section">
            <div className="recordings-header mono-text">
              MIS GRABACIONES LOCALES ({recordings.length})
            </div>
            
            {isMixing && (
              <div className="mixing-loader">
                <div className="spinner" />
                <span className="mono-text">MEZCLANDO AUDIO DIGITALMENTE...</span>
              </div>
            )}

            <div className="recordings-list">
              {recordings.length === 0 ? (
                <div className="recordings-empty mono-text">
                  SIN GRABACIONES GUARDADAS EN EL EQUIPO
                </div>
              ) : (
                recordings.map((rec) => (
                  <div key={rec.id} className={`rec-card brutalist-rec-card ${playingRecId === rec.id ? 'playing' : ''}`}>
                    <button 
                      onClick={() => handlePlayLocal(rec)} 
                      className={`rec-play-btn ${playingRecId === rec.id ? 'playing' : ''}`}
                      title={playingRecId === rec.id ? 'Pausar' : 'Reproducir'}
                    >
                      {playingRecId === rec.id ? (
                        <Pause size={16} fill="var(--color-accent-green)" stroke="var(--color-accent-green)" />
                      ) : (
                        <Play size={16} fill="var(--text-primary)" stroke="var(--text-primary)" />
                      )}
                    </button>
                    <div className="rec-info" onClick={() => handlePlayLocal(rec)}>
                      <div className="rec-name truncate">
                        {rec.isChallenge && <span className="rec-badge-challenge mono-text">DESAFÍO</span>}
                        {rec.name}
                      </div>
                      <div className="rec-meta mono-text">
                        {rec.beatName.toUpperCase()} / {rec.duration} SEG / {formatSize(rec.blob)}
                      </div>
                    </div>
                    <div className="rec-actions">
                      <button onClick={() => handleShare(rec)} className="rec-action-btn" title="Compartir">
                        <Share2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(rec.id)} className="rec-action-btn delete" title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .train-tab-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-base);
          height: 100%;
          overflow: hidden;
        }
        
        .training-active-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--bg-screen);
          z-index: 200;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px 20px;
          border: 2px solid var(--border-subtle);
          box-shadow: inset 3px 3px 10px rgba(0,0,0,0.9);
        }
 
        .intro-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }
 
        .intro-waiting-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          width: 100%;
          gap: 16px;
        }
 
        .waiting-status {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }
 
        .waiting-seconds {
          font-size: 48px;
          font-weight: 700;
          color: var(--color-accent-amber);
          font-family: var(--font-mono);
          text-shadow: 0 0 8px rgba(255,166,0,0.4);
        }
 
        .brutalist-progress {
          width: 80%;
          height: 12px;
          border: 1px solid var(--border-subtle);
          background-color: var(--bg-card);
          position: relative;
          border-radius: 4px;
          box-shadow: inset 1px 1px 3px rgba(0,0,0,0.5);
          overflow: hidden;
        }
 
        .brutalist-progress-fill {
          height: 100%;
          background-color: var(--color-accent-amber);
          box-shadow: 0 0 6px var(--color-accent-amber);
          transition: width 0.05s linear;
        }
 
        .intro-details {
          font-size: 9px;
          color: var(--text-secondary);
          margin-top: 8px;
          font-family: var(--font-mono);
        }
 
        .countdown-value-box {
          display: flex;
          justify-content: center;
          align-items: center;
        }
 
        .countdown-number {
          font-size: 110px;
          font-weight: 700;
          color: var(--color-accent-green);
          font-family: var(--font-mono);
          text-shadow: 0 0 12px rgba(57, 211, 83, 0.4);
          animation: scale-up-countdown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
 
        .countdown-number.go {
          font-size: 48px;
          color: var(--color-accent-red);
          text-shadow: 0 0 12px rgba(255, 77, 77, 0.4);
          animation: pulse-go-text 0.5s ease;
        }
 
        @keyframes scale-up-countdown {
          0% { transform: scale(0.6); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
 
        @keyframes pulse-go-text {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
 
        .blink-slow {
          animation: blink-anim 1.5s infinite;
        }
 
        @keyframes blink-anim {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
 
        .freestyle-active-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        .timer-section {
          text-align: center;
          font-size: 32px;
          font-weight: bold;
          color: var(--color-accent-amber);
          border-bottom: 1.5px solid var(--border-subtle);
          padding-bottom: 12px;
          font-family: var(--font-mono);
          text-shadow: 0 0 8px rgba(255, 166, 0, 0.4);
        }
        .timer-section .small-detail {
          font-size: 9px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        
        .word-section {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .giant-word {
          font-size: 44px;
          text-align: center;
          letter-spacing: -0.02em;
          color: var(--color-accent-green);
          line-height: 1.2;
          text-transform: uppercase;
          font-family: var(--font-mono);
          text-shadow: 0 0 10px rgba(57, 211, 83, 0.5);
        }

        .challenge-words-tracker {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          margin-bottom: 20px;
          width: 100%;
        }
        .tracker-title {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .tracker-badges-container {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .tracker-badge {
          font-size: 10px;
          font-weight: bold;
          padding: 6px 12px;
          background-color: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }
        .tracker-badge.active {
          color: var(--color-accent-green);
          border-color: var(--color-accent-green);
          background-color: rgba(57, 211, 83, 0.1);
          box-shadow: 0 0 8px rgba(57, 211, 83, 0.2);
          transform: scale(1.05);
        }
        
        .training-controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .training-details {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: var(--text-secondary);
          border-top: 1.5px solid var(--border-subtle);
          padding-top: 12px;
          align-items: center;
          font-family: var(--font-mono);
        }
        .rec-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-accent-red);
          font-weight: 700;
        }
        .rec-dot {
          width: 8px;
          height: 8px;
          background-color: var(--color-accent-red);
          border-radius: 50%;
          box-shadow: 0 0 6px var(--color-accent-red);
          animation: led-blink 1s infinite ease-in-out;
        }
        
        .stop-btn {
          background-color: var(--bg-panel);
          color: var(--color-accent-red);
          border: 1px solid var(--border-subtle);
          font-weight: 700;
          height: 52px;
          font-family: var(--font-mono);
          border-radius: 8px;
          box-shadow: inset 1px 1px 0px rgba(255, 255, 255, 0.05),
                      0px 4px 8px rgba(0, 0, 0, 0.4);
          transition: all 0.1s ease;
          text-transform: uppercase;
        }
        .stop-btn:active {
          transform: translateY(1.5px);
          box-shadow: inset 1.5px 2px 4px rgba(0, 0, 0, 0.8);
        }
        
        /* Idle menu */
        .train-idle-menu {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
          overflow-y: auto;
          gap: 16px;
        }
        
        .deck-title-box {
          border-bottom: 1.5px solid var(--border-subtle);
          padding-bottom: 8px;
        }
        .deck-title-box .sub {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: bold;
          font-family: var(--font-mono);
        }
        .deck-title-box .title {
          font-size: 20px;
          font-weight: 700;
        }

        /* Daily Challenge Card Styles */
        .daily-challenge-panel {
          border: 2px solid var(--border-subtle);
          border-radius: 10px;
          padding: 16px;
          background-color: var(--bg-panel);
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05),
                      0px 6px 12px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: relative;
          overflow: hidden;
        }
        
        .daily-challenge-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, var(--color-accent-amber), var(--color-accent-green));
        }

        .daily-challenge-panel .card-badge {
          align-self: flex-start;
          font-size: 8px;
          font-weight: 800;
          background-color: var(--color-accent-amber);
          color: #000;
          padding: 3px 8px;
          border-radius: 4px;
        }

        .daily-challenge-panel .card-header-row {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: var(--text-secondary);
        }

        .daily-challenge-panel .challenge-beat-title {
          font-size: 15px;
          font-weight: bold;
          color: var(--text-primary);
          margin: 4px 0 0 0;
        }

        .daily-challenge-panel .challenge-meta {
          font-size: 9px;
          color: var(--text-secondary);
        }

        .daily-challenge-panel .challenge-words-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 4px;
        }

        .daily-challenge-panel .words-label {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: 700;
        }

        .daily-challenge-panel .words-badge-container {
          display: flex;
          gap: 8px;
        }

        .daily-challenge-panel .challenge-word-badge {
          font-size: 9px;
          font-weight: bold;
          background-color: var(--bg-card);
          border: 1px solid var(--border-subtle);
          padding: 4px 8px;
          border-radius: 4px;
          color: var(--color-accent-green);
        }

        .daily-challenge-panel .accept-challenge-btn {
          width: 100%;
          height: 40px;
          background-color: var(--bg-screen);
          color: var(--color-accent-amber);
          border: 1px solid var(--color-accent-amber);
          border-radius: 6px;
          font-size: 11px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.03), 0px 2px 4px rgba(0,0,0,0.3);
          margin-top: 6px;
          letter-spacing: 0.05em;
        }

        .daily-challenge-panel .accept-challenge-btn:active {
          transform: translateY(1px);
          box-shadow: inset 1.5px 2px 3px rgba(0,0,0,0.8);
          background-color: #0d0e0f;
        }
        
        .beat-picker-card.brutalist-deck {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background-color: var(--bg-screen);
          padding: 16px 8px;
          box-shadow: inset 2px 2px 5px rgba(0, 0, 0, 0.8), 0px 1px 0px var(--border-highlight);
          color: var(--color-accent-amber);
          text-shadow: 0 0 6px rgba(255,166,0,0.4);
          font-family: var(--font-mono);
        }
        .beat-card-content {
          text-align: center;
          flex: 1;
          overflow: hidden;
        }
        .prod-label {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .beat-name {
          font-size: 18px;
          margin: 4px 0;
          font-weight: 700;
          color: var(--color-accent-amber);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .beat-meta-row {
          display: flex;
          justify-content: center;
          gap: 6px;
          font-size: 9px;
          font-weight: 700;
        }
        .beat-meta-row .separator {
          color: rgba(255, 166, 0, 0.4);
        }
        .picker-arrow-btn {
          width: 36px;
          height: 36px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: var(--text-secondary);
          transition: all 0.1s ease;
        }
        .picker-arrow-btn:active {
          color: var(--color-accent-amber);
          transform: scale(0.95);
        }
        
        .config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .config-card.brutalist-config {
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          background-color: var(--bg-card);
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.03), 
                      0px 3px 6px rgba(0, 0, 0, 0.3);
          transition: all 0.1s ease;
        }
        .config-card.brutalist-config.active, .config-card.brutalist-config.studio {
          background-color: var(--bg-screen);
          border-color: var(--color-accent-amber);
          color: var(--color-accent-amber);
          box-shadow: inset 1.5px 2px 3px rgba(0,0,0,0.8);
        }
        .config-card.brutalist-config.active .label, 
        .config-card.brutalist-config.studio .label {
          color: rgba(255, 166, 0, 0.6);
        }
        .config-card.brutalist-config:active {
          transform: translateY(1px);
          box-shadow: inset 1.5px 2.5px 3px rgba(0,0,0,0.6);
        }
        .config-card .label {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: 700;
          font-family: var(--font-mono);
        }
        .config-card .val {
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
        }
        
        .start-btn-container {
          width: 100%;
        }
        .giant-start-btn.brutalist-btn-start {
          width: 100%;
          height: 56px;
          background-color: var(--bg-panel);
          color: var(--text-primary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          box-shadow: inset 1px 1px 0px rgba(255, 255, 255, 0.08), 
                      0px 6px 12px rgba(0, 0, 0, 0.4), 
                      0px 2px 4px rgba(0, 0, 0, 0.25);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: 0.05em;
          transition: all 0.1s ease;
        }
        .giant-start-btn.brutalist-btn-start:active {
          transform: translateY(2px);
          box-shadow: inset 2px 2.5px 5px rgba(0, 0, 0, 0.8), 0px 1px 0px rgba(255,255,255,0.03);
          background-color: #232426;
        }
        
        /* Recordings history list */
        .recordings-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-top: 1.5px solid var(--border-subtle);
          padding-top: 16px;
          margin-top: 8px;
          gap: 8px;
        }
        .recordings-header {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: 700;
          font-family: var(--font-mono);
        }
        .mixing-loader {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          background-color: var(--bg-screen);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          box-shadow: inset 1px 1.5px 3px rgba(0,0,0,0.6);
        }
        .mixing-loader span {
          font-size: 8px;
          color: var(--color-accent-amber);
          font-weight: 700;
          font-family: var(--font-mono);
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          width: 12px;
          height: 12px;
          border: 1.5px solid rgba(255,166,0,0.2);
          border-top-color: var(--color-accent-amber);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        .recordings-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .recordings-empty {
          font-size: 8px;
          color: var(--text-secondary);
          text-align: center;
          padding: 16px;
          font-family: var(--font-mono);
        }
        
        .rec-card.brutalist-rec-card {
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background-color: var(--bg-card);
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 52px;
          padding: 0 12px;
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.03), 0px 2px 4px rgba(0,0,0,0.35);
          transition: all 0.15s ease;
        }
        
        .rec-card.brutalist-rec-card:active {
          transform: translateY(1.5px);
          box-shadow: inset 1.5px 2px 3px rgba(0, 0, 0, 0.6);
        }

        .rec-card.brutalist-rec-card.playing {
          border-color: var(--color-accent-green);
          background-color: rgba(57, 211, 83, 0.05);
          box-shadow: 0 0 8px rgba(57, 211, 83, 0.2);
        }

        .rec-play-btn {
          width: 32px;
          height: 32px;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          background-color: var(--bg-panel);
          transition: all 0.1s ease;
          border-radius: 6px;
          margin-right: 12px;
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05), 0px 1px 2px rgba(0,0,0,0.3);
          flex-shrink: 0;
        }
        .rec-play-btn:active {
          transform: scale(0.95) translateY(1px);
          box-shadow: inset 1px 1.5px 2px rgba(0,0,0,0.6);
          background-color: #232426;
        }
        .rec-play-btn.playing {
          color: var(--color-accent-green);
          border-color: var(--color-accent-green);
          background-color: rgba(57, 211, 83, 0.1);
        }
        
        .rec-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          cursor: pointer;
        }
        .rec-name {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
        }
        .rec-meta {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: 700;
        }
        
        .rec-badge-challenge {
          font-size: 7px;
          font-weight: 800;
          background-color: var(--color-accent-amber);
          color: #000;
          padding: 2px 5px;
          border-radius: 4px;
          margin-right: 6px;
          display: inline-block;
          vertical-align: middle;
        }

        .rec-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .rec-action-btn {
          width: 32px;
          height: 32px;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          background-color: var(--bg-panel);
          transition: all 0.1s ease;
          border-radius: 6px;
          box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05), 0px 1px 2px rgba(0,0,0,0.3);
        }
        .rec-action-btn:active {
          transform: translateY(1px);
          box-shadow: inset 1px 1.5px 2px rgba(0,0,0,0.6);
          background-color: #232426;
        }
        .rec-action-btn.delete:active {
          background-color: rgba(255, 77, 77, 0.15);
          color: var(--color-accent-red);
          border-color: var(--color-accent-red);
          box-shadow: inset 1px 1.5px 2px rgba(255, 77, 77, 0.2);
        }


      `}</style>
    </div>
  );
}
