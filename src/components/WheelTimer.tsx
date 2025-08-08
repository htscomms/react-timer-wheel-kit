import React, { useState } from 'react';
import Confetti from 'react-confetti';

import { useTimerViewModel } from '../hooks/useTimerViewModel';
import { TimerWheelView } from './TimerWheelView';

interface WheelTimerProps {
  startMinutes?: number;
  wheelConfig?: any;
  onRequestPayment: (
    minutes: number,
    cost: number,
    done: (ok: boolean) => void
  ) => void;
}

export const WheelTimer: React.FC<WheelTimerProps> = ({
  startMinutes = 30,
  wheelConfig,
  onRequestPayment
}) => {
  const { timeString, extendMinutes } = useTimerViewModel(startMinutes);
  const [flash, setFlash] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const handlePayment = (mins: number, cost: number, done: (ok:boolean)=>void) => {
    onRequestPayment(mins, cost, ok => {
      done(ok);
      if (ok) {
        // flash + confetti + sound + extend
        setFlash(true);
        window.setTimeout(()=> setFlash(false), 600);
        setConfetti(c => c+1);
        
        // success sound
        const audio = new Audio('/success.mp3');
        audio.play().catch(()=>{});
        
        setTimeout(()=> {
          extendMinutes(mins);
        }, 600);
      }
    });
  };

  return (
    <div style={{ position: 'relative', background:'#fff', padding:20, borderRadius:10, overflow:'hidden' }}>
      {confetti>0 && <Confetti recycle={false} numberOfPieces={200} />}
      <h3 style={{ margin:0, color:'#666' }}>TIME REMAINIsNG</h3>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 72,
          fontWeight: 'bold',
          opacity: flash?0.3:1,
          transition: 'opacity 0.6s ease-out'
        }}
      >
        {timeString}
      </div>
      <p style={{ color:'#666', margin:'8px 0' }}>
        Spin the dial to extend your booking
      </p>
      <TimerWheelView
        config={wheelConfig}
        onRequestPayment={handlePayment}
      />
    </div>
  );
};
