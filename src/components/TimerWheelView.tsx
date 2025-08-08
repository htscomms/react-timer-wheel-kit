// src/components/TimerWheelView.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { TimerWheelConfig } from '../config/TimerWheelConfig';
import { defaultConfig } from '../config/TimerWheelConfig';
import './TimerWheelView.css';

export type PaymentRequest = (
  minutes: number,
  cost: number,
  done: (success: boolean) => void
) => void;

export interface TimerWheelViewProps {
  config?: Partial<TimerWheelConfig>;
  onRequestPayment: PaymentRequest;
}

function shortestDeltaDeg(a: number, b: number) {
  // smallest signed angle from b -> a (degrees, (-180, 180])
  let d = a - b;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d;
}

export const TimerWheelView: React.FC<TimerWheelViewProps> = ({
  config: userConfig,
  onRequestPayment,
}) => {
  // merge once per prop change, but read through a ref inside handlers
  const merged = { ...defaultConfig, ...userConfig };
  const cfgRef = useRef(merged);
  useEffect(() => {
    cfgRef.current = { ...defaultConfig, ...userConfig };
  }, [userConfig]);

  // visual & UI state
  const [wheelRotation, setWheelRotation] = useState(0); // degrees (visual)
  const [liveDeltaMins, setLiveDeltaMins] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [barProgress, setBarProgress] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(1);

  const wheelRef = useRef<SVGSVGElement>(null);

  // drag refs (no re-renders)
  const dragging = useRef(false);
  const lastAngle = useRef(0);           // last pointer angle (deg)
  const totalRotation = useRef(0);       // continuous unwrapped rotation (deg)
  const lastSnappedStep = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  // latest values for RAF writing (avoid stale closures)
  const visRotationRef = useRef(0);
  const minsRef = useRef(0);

  const costString = (mins: number) => {
    const { costPerMinute } = cfgRef.current;
    const dollars = Math.abs(mins) * costPerMinute;
    const sign = mins >= 0 ? '+' : '–';
    return `${sign}$${dollars.toFixed(2)}`;
  };

  const playTick = () => {
    const { tickSoundUrl, haptic } = cfgRef.current;
    if (tickSoundUrl) {
      new Audio(tickSoundUrl).play().catch(() => {});
    }
    if (haptic && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const resetState = () => {
    setShowOverlay(false);
    setLiveDeltaMins(0);
    setBarProgress(0);
    setOverlayOpacity(1);
    lastSnappedStep.current = null;
  };

  const celebrate = () => {
    const { shouldPlaySuccessHaptic } = cfgRef.current;
    setOverlayOpacity(0);
    if (shouldPlaySuccessHaptic && navigator.vibrate) {
      navigator.vibrate([30, 30]);
    }
    setTimeout(resetState, 400);
  };

  // one-time pointer setup
  useEffect(() => {
    const svg = wheelRef.current;
    if (!svg) return;

    const getCenter = () => {
      const rect = svg.getBoundingClientRect();
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    };

    const angleAt = (e: PointerEvent) => {
      const { cx, cy } = getCenter();
      return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    };

    const flushRAF = () => {
      if (rafId.current != null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        setWheelRotation(visRotationRef.current);
        setLiveDeltaMins(minsRef.current);
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      svg.setPointerCapture(e.pointerId);
      dragging.current = true;
      setShowOverlay(true);

      // start from current visual rotation, don't reset
      lastAngle.current = angleAt(e);
      lastSnappedStep.current = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;

      const cfg = cfgRef.current;

      const a = angleAt(e);
      const d = shortestDeltaDeg(a, lastAngle.current); // tiny step in correct direction
      lastAngle.current = a;

      // accumulate continuous rotation (prevents ±180 flips)
      totalRotation.current += d;

      // convert to minutes via snapDegree/minuteStep
      let steps = totalRotation.current / cfg.snapDegree;
      let mins = Math.round(steps) * cfg.minuteStep;

      // clamp minutes
      if (cfg.maxMinutes > 0) {
        const minBound = cfg.allowsNegative ? -cfg.maxMinutes : 0;
        mins = Math.max(minBound, Math.min(cfg.maxMinutes, mins));
      } else if (!cfg.allowsNegative && mins < 0) {
        mins = 0;
      }

      // visual rotation: track cursor 1:1 until clamp; if clamped, lock to snapped rotation
      const snappedRotation = (mins / cfg.minuteStep) * cfg.snapDegree;

      // if our snapped mins differs from what raw totalRotation would round to, we hit a clamp
      const unclampedMins = Math.round((totalRotation.current / cfg.snapDegree)) * cfg.minuteStep;
      const clamped = unclampedMins !== mins;

      const visual = clamped ? snappedRotation : totalRotation.current;

      // tick when snapped step changes
      const snappedStep = Math.round(snappedRotation / cfg.snapDegree);
      if (lastSnappedStep.current === null) {
        lastSnappedStep.current = snappedStep;
      } else if (snappedStep !== lastSnappedStep.current) {
        lastSnappedStep.current = snappedStep;
        playTick();
      }

      // publish via RAF
      visRotationRef.current = visual;
      minsRef.current = mins;
      flushRAF();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging.current) return;

      svg.releasePointerCapture(e.pointerId);
      dragging.current = false;

      const mins = minsRef.current;
      // snap back, show progress, then request payment
      if (mins !== 0) {
        setWheelRotation(0);
        visRotationRef.current = 0;
        totalRotation.current = 0; // reset the unwrapped base for next drag

        setBarProgress(1);
        setTimeout(() => setBarProgress(0), 2000);

        setTimeout(() => {
          const { costPerMinute } = cfgRef.current;
          const cost = Math.abs(mins) * costPerMinute;
          onRequestPayment(mins, cost, ok => {
            ok ? celebrate() : resetState();
          });
        }, 2000);
      } else {
        resetState();
      }
    };

    svg.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      svg.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, [onRequestPayment]);

  return (
    <div className="tw-wheel-container" style={{ touchAction: 'none' }}>
      <svg
        ref={wheelRef}
        width="260"
        height="260"
        viewBox="0 0 260 260"
        style={{ transform: `rotate(${wheelRotation}deg)` }}
      >
        <defs>
          <linearGradient id="tw-gradient" gradientUnits="objectBoundingBox">
            {cfgRef.current.ringGradient.colors.map((c, i) => (
              <stop
                key={i}
                offset={`${(i / (cfgRef.current.ringGradient.colors.length - 1)) * 100}%`}
                stopColor={c}
              />
            ))}
          </linearGradient>
        </defs>

        {/* Outer ring */}
        <circle
          cx="130"
          cy="130"
          r={130 - cfgRef.current.ringLineWidth / 2}
          stroke="url(#tw-gradient)"
          strokeWidth={cfgRef.current.ringLineWidth}
          fill="none"
        />

        {/* Inner discs */}
        <circle cx="130" cy="130" r={130 - cfgRef.current.ringLineWidth} fill="#f0f0f0" />
        <circle cx="130" cy="130" r="130" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      </svg>

      {/* Overlay */}
      <div className="tw-overlay" style={{ opacity: overlayOpacity }}>
        {showOverlay && liveDeltaMins !== 0 ? (
          <div className="tw-overlay-content">
            <div className="tw-delta">{liveDeltaMins > 0 ? `+${liveDeltaMins}` : liveDeltaMins} m</div>
            <div className="tw-cost">{costString(liveDeltaMins)}</div>
            <div className="tw-bar-bg">
              <div
                className="tw-bar-fill"
                style={{
                  width: `${cfgRef.current.overlayBarWidth * barProgress}px`,
                  height: `${cfgRef.current.overlayBarHeight}px`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="tw-arrow">⟳</div>
        )}
      </div>
    </div>
  );
};
