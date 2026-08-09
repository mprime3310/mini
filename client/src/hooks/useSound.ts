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

  // "Ding" sound for wins - High pitch, short, clear
  const playWinSound = useCallback(() => {
    if (!isSoundEnabled) return;
    try {
      const ctx = getContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      // C7 = 2093.00 Hz, nice bright ding
      osc.frequency.setValueAtTime(2093.00, now);
      
      // Instant attack, exponential decay
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn('Win sound failed:', e);
    }
  }, [isSoundEnabled, getContext]);

  // "Beep" sound for losses - Low frequency, short, more distinct
  const playLossSound = useCallback(() => {
    if (!isSoundEnabled) return;
    try {
      const ctx = getContext();
      const now = ctx.currentTime;
      
      // Create two quick beeps for loss notification
      const playBeep = (startTime: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.linearRampToValueAtTime(0.01, startTime + 0.1);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + 0.1);
      };
      
      // Two beeps: 200Hz then 150Hz
      playBeep(now, 200);
      playBeep(now + 0.15, 150);
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
