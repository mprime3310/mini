import { useState, useCallback, useRef, useEffect } from 'react';

export function useSound() {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    document.addEventListener('click', initAudio, { once: true });
    return () => document.removeEventListener('click', initAudio);
  }, []);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Soft bell ding for wins - pleasant chime sound
  const playWinSound = useCallback(() => {
    if (!isSoundEnabled) return;
    try {
      const ctx = getContext();
      const now = ctx.currentTime;
      
      // Bell frequencies - harmonics of a soft chime
      const bellFreqs = [880, 1320, 1760]; // A5, E6, A6 - soft bell harmonics
      
      bellFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        // Bell envelope - quick attack, long decay
        const volume = 0.15 / (i + 1); // Harmonics fade
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      });
    } catch (e) {
      console.warn('Win sound failed:', e);
    }
  }, [isSoundEnabled, getContext]);

  // Low beep for losses - short, low-pitched
  const playLossSound = useCallback(() => {
    if (!isSoundEnabled) return;
    try {
      const ctx = getContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now); // A3 - low beep
      
      // Short beep envelope
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Loss sound failed:', e);
    }
  }, [isSoundEnabled, getContext]);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => !prev);
  }, []);

  return {
    isSoundEnabled,
    toggleSound,
    playWinSound,
    playLossSound,
  };
}
