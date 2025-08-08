import { useState, useEffect, useRef } from 'react';

export function useCountdownTimer(start: number) {
  const [remaining, setRemaining] = useState(start);

  // ① Ref holds either a timer ID (number) or null initially
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // start countdown
    intervalRef.current = window.setInterval(() => {
      setRemaining(r => (r > 0 ? r - 1 : 0));
    }, 1000);

    return () => {
      // ② guard against null
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const extend = (seconds: number) => {
    setRemaining(r => r + seconds);
  };

  return { remaining, extend };
}
