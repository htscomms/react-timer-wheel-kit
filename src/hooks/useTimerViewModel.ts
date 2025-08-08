import { useState, useEffect } from 'react';
import { useCountdownTimer } from './useCountdownTimer';

export function useTimerViewModel(startMinutes = 30) {
  const secs = startMinutes * 60;
  const { remaining, extend } = useCountdownTimer(secs);
  const [remainingSeconds, setRemainingSeconds] = useState(secs);

  useEffect(() => {
    setRemainingSeconds(remaining);
  }, [remaining]);

  const extendMinutes = (mins: number) => {
    extend(mins * 60);
  };

  const timeString = (() => {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  })();

  return { remainingSeconds, extendMinutes, timeString };
}
