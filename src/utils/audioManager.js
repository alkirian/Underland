// Local IndexedDB Storage for saved audio recording sessions
const DB_NAME = 'FreestyleUruguayDB';
const STORE_NAME = 'grabaciones';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveRecordingToLocal(recording) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(recording); // recording = { timestamp, blob, duration, beatName, name }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalRecordings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalRecordingById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteLocalRecording(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Headphones Auto-Detection
export async function detectHeadphones() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return false;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
    // If device labels are permission-restricted, labels will be empty, returning false.
    // Otherwise, we search for keyword identifiers.
    return audioOutputs.some(device => {
      const label = device.label.toLowerCase();
      return label.includes('headphone') || 
             label.includes('headset') || 
             label.includes('auricular') || 
             label.includes('wired') || 
             label.includes('bluetooth') ||
             label.includes('handsfree');
    });
  } catch (err) {
    console.error('Error detecting headphones:', err);
    return false;
  }
}

// Cache Storage Helper for Offline Audio Loops
async function getBeatAudioBuffer(beatUrl, audioCtx) {
  try {
    const cache = await caches.open('freestyle-beats-cache');
    let response = await cache.match(beatUrl);
    if (!response) {
      response = await fetch(beatUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      await cache.put(beatUrl, response.clone());
    }
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.error('Failed to get audio buffer from cache or network:', err);
    // Fallback: direct fetch if cache fails
    const response = await fetch(beatUrl);
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  }
}

// Convert AudioBuffer to 16-bit Stereo WAV File Blob
function bufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // raw PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferArr = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(bufferArr);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + result.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, result.length * 2, true);
  
  // Write the PCM audio samples
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([bufferArr], { type: 'audio/wav' });
}

function interleave(inputL, inputR) {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Perform digital mixing of Beat + Voice client-side
export async function mixBeatAndVoice(beatUrl, voiceBlob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    // 1. Decode beat from cached storage
    const beatBuffer = await getBeatAudioBuffer(beatUrl, audioCtx);

    // 2. Decode voice file
    const voiceArrayBuffer = await voiceBlob.arrayBuffer();
    const voiceBuffer = await audioCtx.decodeAudioData(voiceArrayBuffer);

    // 3. Setup destination AudioBuffer (Stereo, same length as voiceBuffer)
    const sampleRate = audioCtx.sampleRate;
    const numChannels = 2;
    const mixLength = voiceBuffer.length;
    const mixedBuffer = audioCtx.createBuffer(numChannels, mixLength, sampleRate);

    const BEAT_GAIN = 0.8;
    const VOICE_GAIN = 1.0;

    // Get input channel data
    const voiceL = voiceBuffer.getChannelData(0);
    const voiceR = voiceBuffer.numberOfChannels > 1 ? voiceBuffer.getChannelData(1) : voiceL;

    const beatL = beatBuffer.getChannelData(0);
    const beatR = beatBuffer.numberOfChannels > 1 ? beatBuffer.getChannelData(1) : beatL;

    // Get output channel data
    const mixedL = mixedBuffer.getChannelData(0);
    const mixedR = mixedBuffer.getChannelData(1);

    // 4. Mathematical channel mixing (loop sample-by-sample)
    for (let i = 0; i < mixLength; i++) {
      const beatIndex = i % beatBuffer.length;

      const beatValL = beatL[beatIndex];
      const beatValR = beatR[beatIndex];

      const voiceValL = voiceL[i];
      const voiceValR = voiceR[i];

      mixedL[i] = (voiceValL * VOICE_GAIN) + (beatValL * BEAT_GAIN);
      mixedR[i] = (voiceValR * VOICE_GAIN) + (beatValR * BEAT_GAIN);
    }

    // 5. Convert mixed buffer to WAV Blob
    const wavBlob = bufferToWav(mixedBuffer);

    // Clean up
    audioCtx.close().catch(err => console.warn('Failed to close audio context:', err));

    return wavBlob;
  } catch (err) {
    audioCtx.close().catch(() => {});
    throw err;
  }
}

export function getHardwareLatencyMs() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const base = audioCtx.baseLatency || 0;
    const output = audioCtx.outputLatency || 0;
    audioCtx.close();
    return Math.round((base + output) * 1000);
  } catch (err) {
    console.warn('Could not estimate hardware latency:', err);
    return 0;
  }
}

export async function applyLatencyCorrection(voiceBlob, offsetMs) {
  if (!offsetMs || offsetMs === 0) return voiceBlob;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    const arrayBuffer = await voiceBlob.arrayBuffer();
    const voiceBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const sampleRate = voiceBuffer.sampleRate;
    const numChannels = voiceBuffer.numberOfChannels;
    const offsetSamples = Math.round((offsetMs / 1000) * sampleRate);

    let correctedBuffer;

    if (offsetSamples > 0) {
      // Trim (remove) the first offsetSamples
      if (offsetSamples >= voiceBuffer.length) {
        return voiceBlob;
      }
      const newLength = voiceBuffer.length - offsetSamples;
      correctedBuffer = audioCtx.createBuffer(numChannels, newLength, sampleRate);
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = voiceBuffer.getChannelData(channel);
        const newChannelData = correctedBuffer.getChannelData(channel);
        newChannelData.set(channelData.subarray(offsetSamples));
      }
    } else {
      // Prepend silence (negative offset)
      const silenceSamples = Math.abs(offsetSamples);
      const newLength = voiceBuffer.length + silenceSamples;
      correctedBuffer = audioCtx.createBuffer(numChannels, newLength, sampleRate);
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = voiceBuffer.getChannelData(channel);
        const newChannelData = correctedBuffer.getChannelData(channel);
        newChannelData.set(channelData, silenceSamples);
      }
    }

    return bufferToWav(correctedBuffer);
  } catch (err) {
    console.error('Failed to apply latency correction, returning original voice:', err);
    return voiceBlob;
  }
}

export async function convertBlobToWav(recordedBlob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();
  try {
    const arrayBuffer = await recordedBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBlob = bufferToWav(audioBuffer);
    await audioCtx.close();
    return wavBlob;
  } catch (err) {
    console.error('Failed to convert mixed recording to WAV, returning original:', err);
    await audioCtx.close().catch(() => {});
    return recordedBlob;
  }
}

