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
  const [isRecording, setIsRecording] = useState(true); // Always record sessions
  const [isStudioMode, setIsStudioMode] = useState(false); // true = Headphones (digital mix + bypass HPF), false = Speakers (no direct mix + HPF active)
  const [currentWord, setCurrentWord] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [recordings, setRecordings] = useState([]);
  const [isMixing, setIsMixing] = useState(false);

  // Mode and Timer states
  const [trainingMode, setTrainingMode] = useState('libre'); // 'libre' | 'reto' | 'conceptos'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isManualOverrideRef = useRef(false);

  const toggleStudioModeManually = () => {
    isManualOverrideRef.current = true;
    setIsStudioMode(prev => !prev);
  };

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
  const stopwatchIntervalRef = useRef(null);

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

  const dailyRule = React.useMemo(() => {
    const rules = [
      "Métrica Forzada: Cambio de tempo a 140 BPM en el segundo 30.",
      "Conceptos Cruzados: Integrá las 3 palabras obligatorias en el primer patrón.",
      "Modo Acelerado: Incremento de ritmo progresivo cada 4 compases.",
      "Cortes de Beat: Silencios de batería aleatorios de 2 segundos.",
      "Doble Tempo: Duplicar velocidad de rima en las palabras destacadas."
    ];
    return rules[dailySeed % rules.length];
  }, [dailySeed]);

  // Load local recordings on mount
  useEffect(() => {
    loadRecordings();
    
    // Auto-detect headphones on mount and listen to changes
    const checkHeadphones = () => {
      if (isManualOverrideRef.current) return;
      detectHeadphones().then(hasHeadphones => {
        if (!isManualOverrideRef.current) {
          setIsStudioMode(hasHeadphones);
        }
      });
    };

    checkHeadphones();

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', checkHeadphones);
    }

    return () => {
      stopPlaybackAndIntervals();
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', checkHeadphones);
      }
    };
  }, []);

  const formatStopwatch = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }
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
    if (!touchStart || !touchEnd || trainingMode === 'reto') return;
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
    if (isTraining || trainingMode === 'reto') return;
    setActiveBeatIndex(prev => (prev + 1) % activeBeats.length);
  };

  const prevBeat = () => {
    if (isTraining || trainingMode === 'reto') return;
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

  const handleModeChange = (mode) => {
    if (isTraining) return;
    setTrainingMode(mode);
    if (mode === 'reto') {
      setActiveBeatIndex(dailyBeatIndex);
    }
  };

  const handleStartClick = () => {
    if (trainingMode === 'reto') {
      setIsChallengeMode(true);
      isChallengeModeRef.current = true;
      startTraining(dailyBeat, true);
    } else {
      setIsChallengeMode(false);
      isChallengeModeRef.current = false;
      startTraining(activeBeat, true);
    }
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

        // Immediately run detectHeadphones post-permission if not manually overridden!
        let activeUseHeadphones = isStudioMode;
        if (!isManualOverrideRef.current) {
          try {
            const hasHeadphones = await detectHeadphones();
            if (!isManualOverrideRef.current) {
              setIsStudioMode(hasHeadphones);
              activeUseHeadphones = hasHeadphones;
            }
          } catch (err) {
            console.warn('Failed to detect headphones post-permission:', err);
          }
        }

        audioChunksRef.current = [];
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;

        // Create Web Audio recording destination node
        const recordingDestination = audioCtx.createMediaStreamDestination();

        // Route mic input through HPF
        const micSource = audioCtx.createMediaStreamSource(stream);
        micSourceRef.current = micSource;

        const hpfFilter = audioCtx.createBiquadFilter();
        hpfFilter.type = 'highpass';

        const now = audioCtx.currentTime;
        if (activeUseHeadphones) {
          // "Con Auriculares": bypass mode. Smoothly ramp to 0Hz
          hpfFilter.frequency.setValueAtTime(100, now);
          hpfFilter.frequency.linearRampToValueAtTime(0, now + 0.1);
        } else {
          // "Sin Auriculares": active mode. Smoothly ramp to 110Hz to filter rumble
          hpfFilter.frequency.setValueAtTime(20, now);
          hpfFilter.frequency.linearRampToValueAtTime(110, now + 0.1);
        }

        micSource.connect(hpfFilter);
        hpfFilter.connect(recordingDestination);

        // Setup audio element for the beat (with crossOrigin for CORS)
        audioRef.current = new Audio(beatUrl);
        audioRef.current.loop = true;
        audioRef.current.crossOrigin = 'anonymous';

        // Connect the beat player to Web Audio graph
        const beatSource = audioCtx.createMediaElementSource(audioRef.current);
        beatSourceRef.current = beatSource;
        
        // Beat goes to physical output (headphones/speakers)
        beatSource.connect(audioCtx.destination);

        // Beat goes to recording destination ONLY in "Con Auriculares"
        if (activeUseHeadphones) {
          beatSource.connect(recordingDestination);
        }

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

          // Pick first word and start appropriate interval based on mode
          if (trainingMode === 'libre') {
            let elapsed = 0;
            setElapsedSeconds(0);
            stopwatchIntervalRef.current = setInterval(() => {
              elapsed += 1;
              setElapsedSeconds(elapsed);
            }, 1000);
          } else {
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
    
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }
    
    setIsTraining(false);
    setIsIntroActive(false);
    setCountdownValue(null);
    setSecondsLeft(10);
    setElapsedSeconds(0);
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
          alert('Error de reproducción en el celular: ' + err.message + '\n\nDetalle: Los navegadores en celulares a veces bloquean la reproducción automática o formatos no compatibles. Intenta grabar con auriculares (mezcla digital WAV).');
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
              {trainingMode === 'libre' ? (
                <div className="timer-section mono-text">
                  <span>{formatStopwatch(elapsedSeconds)}</span>
                  <div className="small-detail">TIEMPO TRANSCURRIDO</div>
                </div>
              ) : (
                <div className="timer-section mono-text">
                  <span>{secondsLeft.toString().padStart(2, '0')}s</span>
                  <div className="small-detail">SIGUIENTE PALABRA</div>
                </div>
              )}

              {/* Central giant word */}
              {trainingMode !== 'libre' && (
                <div className="word-section">
                  <h1 className="giant-word">{currentWord}</h1>
                </div>
              )}
              {trainingMode === 'libre' && (
                <div className="word-section">
                  <h1 className="giant-word libre-placeholder">FLOW LIBRE</h1>
                </div>
              )}

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
                  <span>GRABANDO ({isStudioMode ? 'AURICULARES' : 'PARLANTE'})</span>
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
            <h2 className="title">CYPHER STUDIO</h2>
          </div>

          {/* Mode Selector Tabs */}
          <div className="mode-tabs">
            <button 
              className={`mode-tab ${trainingMode === 'libre' ? 'active' : ''}`}
              onClick={() => handleModeChange('libre')}
            >
              LIBRE
            </button>
            <button 
              className={`mode-tab ${trainingMode === 'reto' ? 'active' : ''}`}
              onClick={() => handleModeChange('reto')}
            >
              RETO DIARIO ⚡
            </button>
            <button 
              className={`mode-tab ${trainingMode === 'conceptos' ? 'active' : ''}`}
              onClick={() => handleModeChange('conceptos')}
            >
              CONCEPTOS
            </button>
          </div>

          {/* Beat Swiper Card */}
          <div 
            className={`beat-picker-card brutalist-deck ${trainingMode === 'reto' ? 'locked' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <button 
              onClick={prevBeat} 
              className={`picker-arrow-btn ${trainingMode === 'reto' ? 'disabled' : ''}`}
              disabled={trainingMode === 'reto'}
            >
              <ChevronLeft size={24} />
            </button>

            <div className="beat-card-content">
              <span className="mono-text prod-label">
                {trainingMode === 'reto' ? '🔴 RETO DEL DÍA' : beatProdStr.toUpperCase()}
              </span>
              <h3 className="beat-name">{beatNameStr}</h3>
              <div className="beat-meta-row mono-text">
                <span className="genre-label">{beatGenreStr.toUpperCase()}</span>
                <span className="separator">/</span>
                <span className="bpm-label">{activeBeat.bpm} BPM</span>
              </div>
            </div>

            <button 
              onClick={nextBeat} 
              className={`picker-arrow-btn ${trainingMode === 'reto' ? 'disabled' : ''}`}
              disabled={trainingMode === 'reto'}
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Daily Challenge Rules Banner */}
          {trainingMode === 'reto' && (
            <div className="rules-banner mono-text">
              <span className="rules-title">RETO DE HOY</span>
              <p className="rules-desc">{dailyRule}</p>
              <div className="rules-concepts-row">
                <span className="concepts-label">CONCEPTOS:</span>
                <div className="concepts-badges">
                  {dailyWords.map(w => (
                    <span key={w} className="rules-concept-badge">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Single giant START action button and Hardware Status */}
          <div className="start-container">
            <button onClick={handleStartClick} className="btn-empezar-giant">
              [ EMPEZAR ]
            </button>
            <button 
              onClick={toggleStudioModeManually} 
              className="hardware-status-btn mono-text"
              title="Alternar uso de auriculares"
            >
              {isStudioMode ? "🎧 Con Auriculares (Recomendado)" : "🔊 Sin Auriculares (Parlante)"}
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

        /* Mode Selector Tabs */
        .mode-tabs {
          display: flex;
          justify-content: space-between;
          background-color: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 8px;
          box-shadow: inset 1px 1px 3px rgba(0,0,0,0.6);
        }

        .mode-tab {
          flex: 1;
          text-align: center;
          padding: 10px 4px;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--text-secondary);
          border-radius: 6px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          letter-spacing: 0.02em;
          cursor: pointer;
        }

        .mode-tab.active {
          background-color: var(--bg-panel);
          color: var(--color-accent-amber);
          box-shadow: 1px 1px 0px var(--border-highlight), 0px 2px 4px rgba(0, 0, 0, 0.4);
        }

        .beat-picker-card.brutalist-deck {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background-color: var(--bg-screen);
          padding: 20px 12px;
          box-shadow: inset 2px 2px 5px rgba(0, 0, 0, 0.8), 0px 1px 0px var(--border-highlight);
          color: var(--color-accent-amber);
          text-shadow: 0 0 6px rgba(255,166,0,0.4);
          font-family: var(--font-mono);
          transition: all 0.3s ease;
        }
        
        .beat-picker-card.brutalist-deck.locked {
          border-color: rgba(255, 166, 0, 0.2);
          opacity: 0.85;
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
          cursor: pointer;
        }
        
        .picker-arrow-btn.disabled {
          opacity: 0.15;
          cursor: not-allowed;
        }

        .picker-arrow-btn:not(.disabled):active {
          color: var(--color-accent-amber);
          transform: scale(0.95);
        }

        /* Rules Banner Styles */
        .rules-banner {
          background-color: rgba(255, 166, 0, 0.03);
          border: 1px dashed rgba(255, 166, 0, 0.25);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: center;
          animation: fade-in 0.3s ease;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rules-banner .rules-title {
          font-size: 9px;
          font-weight: 700;
          color: var(--color-accent-amber);
          letter-spacing: 0.05em;
        }

        .rules-banner .rules-desc {
          font-size: 11px;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .rules-concepts-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
          border-top: 1px dashed rgba(255, 166, 0, 0.15);
          padding-top: 6px;
        }

        .concepts-label {
          font-size: 8px;
          color: var(--text-secondary);
          font-weight: 700;
        }

        .concepts-badges {
          display: flex;
          gap: 6px;
        }

        .rules-concept-badge {
          font-size: 9px;
          font-weight: 700;
          background-color: rgba(57, 211, 83, 0.08);
          border: 1px solid rgba(57, 211, 83, 0.25);
          color: var(--color-accent-green);
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Start Button & Hardware Status */
        .start-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 8px 0;
          gap: 12px;
        }

        .btn-empezar-giant {
          width: 100%;
          height: 64px;
          background-color: var(--bg-panel);
          color: var(--color-accent-green);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          font-size: 18px;
          font-weight: 900;
          font-family: var(--font-mono);
          letter-spacing: 0.08em;
          box-shadow: inset 1px 1px 0px var(--border-highlight), 
                      0px 6px 12px rgba(0, 0, 0, 0.4), 
                      0px 2px 4px rgba(0, 0, 0, 0.25);
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          justify-content: center;
          align-items: center;
          text-shadow: 0 0 8px rgba(57, 211, 83, 0.25);
          cursor: pointer;
        }

        .btn-empezar-giant:active {
          transform: translateY(2px);
          box-shadow: inset 2px 2.5px 5px rgba(0, 0, 0, 0.8), 0px 1px 0px var(--border-highlight);
          background-color: #232426;
          color: rgba(57, 211, 83, 0.85);
        }

        .hardware-status-btn {
          background: var(--bg-card);
          border: 1.5px dashed var(--border-subtle);
          border-radius: 8px;
          color: var(--text-secondary);
          padding: 8px 16px;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-mono);
          cursor: pointer;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          transition: all 0.2s ease;
          width: 100%;
          text-align: center;
          box-shadow: 0px 2px 4px rgba(0,0,0,0.2);
        }
        .hardware-status-btn:hover {
          color: var(--text-primary);
          border-color: var(--color-accent-green);
          background-color: rgba(57, 211, 83, 0.05);
        }
        .hardware-status-btn:active {
          transform: scale(0.98);
        }

        .giant-word.libre-placeholder {
          color: var(--text-secondary);
          text-shadow: 0 0 8px rgba(255, 255, 255, 0.05);
          font-size: 36px;
          opacity: 0.6;
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
