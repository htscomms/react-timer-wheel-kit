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
  let d = a - b;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d;
}

export const TimerWheelView: React.FC<TimerWheelViewProps> = ({
  config: userConfig,
  onRequestPayment,
}) => {
  const merged = { ...defaultConfig, ...userConfig };
  const cfgRef = useRef(merged);
  useEffect(() => { cfgRef.current = { ...defaultConfig, ...userConfig }; }, [userConfig]);

  const [wheelRotation, setWheelRotation] = useState(0);
  const [liveDeltaMins, setLiveDeltaMins] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  // progress is 0..1; we map to % width so it fills left->right
  const [barProgress, setBarProgress] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(1);

  const wheelRef = useRef<SVGSVGElement>(null);

  // drag refs
  const dragging = useRef(false);
  const lastAngle = useRef(0);
  const totalRotation = useRef(0);
  const lastSnappedStep = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  // confirm state
  const confirmingRef = useRef(false);
  const cancelledRef = useRef(false);

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
    if (tickSoundUrl) new Audio(tickSoundUrl).play().catch(() => {});
    if (haptic && navigator.vibrate) navigator.vibrate(10);
  };

  const resetState = () => {
    setShowOverlay(false);
    setBarProgress(0);
    setOverlayOpacity(1);
    setLiveDeltaMins(0);
    confirmingRef.current = false;
    cancelledRef.current = false;
    lastSnappedStep.current = null;
  };

  const celebrate = () => {
    const { shouldPlaySuccessHaptic } = cfgRef.current;
    setOverlayOpacity(0);
    if (shouldPlaySuccessHaptic && navigator.vibrate) navigator.vibrate([30, 30]);
    setTimeout(resetState, 400);
  };

  // tap center to cancel while confirming
  const handleOverlayClick = () => {
    if (!confirmingRef.current) return;
    cancelledRef.current = true;
    resetState();
  };

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
      // ignore drags while the confirm bar is running; tapping center cancels via onClick
      if (confirmingRef.current) return;

      svg.setPointerCapture(e.pointerId);
      dragging.current = true;
      setShowOverlay(true);
      lastAngle.current = angleAt(e);
      lastSnappedStep.current = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current || confirmingRef.current) return;

      const cfg = cfgRef.current;
      const a = angleAt(e);
      const d = shortestDeltaDeg(a, lastAngle.current);
      lastAngle.current = a;

      totalRotation.current += d;
      let steps = totalRotation.current / cfg.snapDegree;
      let mins = Math.round(steps) * cfg.minuteStep;

      if (cfg.maxMinutes > 0) {
        const minBound = cfg.allowsNegative ? -cfg.maxMinutes : 0;
        mins = Math.max(minBound, Math.min(cfg.maxMinutes, mins));
      } else if (!cfg.allowsNegative && mins < 0) {
        mins = 0;
      }

      const snappedRotation = (mins / cfg.minuteStep) * cfg.snapDegree;
      const unclampedMins = Math.round((totalRotation.current / cfg.snapDegree)) * cfg.minuteStep;
      const clamped = unclampedMins !== mins;
      const visual = clamped ? snappedRotation : totalRotation.current;

      const snappedStep = Math.round(snappedRotation / cfg.snapDegree);
      if (lastSnappedStep.current === null) lastSnappedStep.current = snappedStep;
      else if (snappedStep !== lastSnappedStep.current) { lastSnappedStep.current = snappedStep; playTick(); }

      visRotationRef.current = visual;
      minsRef.current = mins;
      flushRAF();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging.current) return;

      svg.releasePointerCapture(e.pointerId);
      dragging.current = false;

      const mins = minsRef.current;
      if (mins !== 0) {
        // start confirm; bar will animate width->100% and then fire onTransitionEnd
        confirmingRef.current = true;
        cancelledRef.current = false;

        setWheelRotation(0);
        visRotationRef.current = 0;
        totalRotation.current = 0;

        // kick off progress (0% -> 100%)
        setBarProgress(1);
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

  // when the bar finishes filling, trigger the payment (unless cancelled)
  const handleBarTransitionEnd: React.TransitionEventHandler<HTMLDivElement> = (e) => {
    if (e.propertyName !== 'width') return;         // only care about width transition
    if (!confirmingRef.current || cancelledRef.current) return;

    const mins = minsRef.current;
    const cost = Math.abs(mins) * cfgRef.current.costPerMinute;

    onRequestPayment(mins, cost, (ok) => {
      ok ? celebrate() : resetState();
    });

    // prevent double-fire if something else triggers width changes
    confirmingRef.current = false;
  };

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

      {/* Overlay (tap to cancel while confirming) */}
      <div className="tw-overlay" style={{ opacity: overlayOpacity }} onClick={handleOverlayClick}>
        {showOverlay && liveDeltaMins !== 0 ? (
          <div className="tw-overlay-content">
            <div className="tw-delta">{liveDeltaMins > 0 ? `+${liveDeltaMins}` : liveDeltaMins} m</div>
            <div className="tw-cost">{costString(liveDeltaMins)}</div>

            {/* Fixed-size track; fill grows left->right via width:% */}
            <div
              className="tw-bar-bg"
              style={{ width: `${cfgRef.current.overlayBarWidth}px`, height: `${cfgRef.current.overlayBarHeight}px` }}
            >
              <div
                className="tw-bar-fill"
                style={{ width: `${barProgress * 100}%` }}
                onTransitionEnd={handleBarTransitionEnd}
              />
            </div>

            {/* Optional: you could show a small “Tap to cancel” helper text when confirming */}
            {/* {confirmingRef.current && <div style={{fontSize: 12, color: '#999'}}>Tap to cancel</div>} */}
          </div>
        ) : (
          <div className="tw-arrow">⟳</div>
        )}
      </div>
    </div>
  );
};
