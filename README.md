# TimerWheelKit (React)

Spin-to-extend time control with snap notches, cost preview, 2-second confirm bar, tick sound, and optional haptics. Web port aligned with the SwiftUI mental model.

- **`TimerWheelView`** – low-level wheel (gesture + overlay). Calls back for payment.
- **`WheelTimer`** – demo wrapper that shows a countdown label, plays a success sound, confetti, and extends the timer when payment succeeds.
- **Hooks** – `useCountdownTimer` and `useTimerViewModel` for the same “Timer → ViewModel → UI” structure you used in Swift.

## Install

```bash
# only needed if you use the demo wrapper with confetti
npm i react-confetti
# or
yarn add react-confetti
```

Include the wheel CSS in whatever way you prefer:
```ts
import './TimerWheelView.css';
```

## Quick Start

```tsx
import { TimerWheelView } from './components/TimerWheelView';

<TimerWheelView
  config={{
    costPerMinute: 0.50,
    snapDegree: 15,
    minuteStep: 1,
    maxMinutes: 120,
    allowsNegative: true,
    tickSoundUrl: '/tick.mp3',
    haptic: true,
    shouldPlaySuccessHaptic: true,
  }}
  onRequestPayment={(minutes, cost, done) => {
    // open your checkout UI here…
    fakePay(cost).then(ok => done(ok));
  }}
/>
```

## Components

### `TimerWheelView`

Low-level wheel. It does **not** manage the countdown; it just computes minutes and asks you to charge the user.

```tsx
type PaymentRequest = (
  minutes: number,                 // ± minutes selected (already clamped)
  cost: number,                    // abs(minutes) * costPerMinute
  done: (success: boolean) => void // call this when payment finishes
) => void;

interface TimerWheelViewProps {
  config?: Partial<TimerWheelConfig>;
  onRequestPayment: PaymentRequest;
}
```

- The wheel shows an overlay with `±Xm` and the calculated cost while dragging.
- On release, it starts a 2-second progress bar; when it completes, your `onRequestPayment` is called.
- Call `done(true)` to celebrate (overlay fade + optional haptic) or `done(false)` to reset quietly.

#### Config (matches your current TS interface)

```ts
export interface Gradient { colors: string[] }

export interface TimerWheelConfig {
  // ── Mechanics ──
  minuteStep: number;            // minutes per notch
  snapDegree: number;            // degrees per notch
  costPerMinute: number;
  allowsNegative: boolean;       // allow counter-clockwise (negative minutes)
  maxMinutes: number;            // 0 => no cap (∞). Otherwise ±cap.

  // ── Ring appearance ──
  ringLineWidth: number;
  ringGradient: Gradient;        // CSS color strings

  // ── Confirm bar ──
  overlayBarWidth: number;       // px
  overlayBarHeight: number;      // px

  // ── Feedback ──
  tickSoundUrl?: string;         // '', undefined => silent
  haptic?: boolean;              // vibrate on tick (best-effort)
  shouldPlaySuccessHaptic: boolean; // vibrate on success
}
```

**Defaults** (already shipped in your code):

```ts
export const defaultConfig: TimerWheelConfig = {
  minuteStep: 1,
  snapDegree: 15,
  costPerMinute: 0.35,
  allowsNegative: true,
  maxMinutes: 0,
  ringLineWidth: 40,
  ringGradient: { colors: ['rgba(128,128,128,0.4)','rgba(128,128,128,0.9)'] },
  overlayBarWidth: 75,
  overlayBarHeight: 6,
  tickSoundUrl: '',
  haptic: true,
  shouldPlaySuccessHaptic: true,
};
```

### `WheelTimer`

Batteries-included demo: renders the countdown label + wheel, flashes green, plays a success SFX, tosses confetti, then extends the timer when payment succeeds.

```tsx
import { WheelTimer } from './components/WheelTimer';

<WheelTimer
  startMinutes={30}
  wheelConfig={{
    costPerMinute: 0.5,
    maxMinutes: 120,
    tickSoundUrl: '/tick.mp3',
  }}
  onRequestPayment={(mins, cost, done) => {
    // integrate Apple Pay / Stripe / whatever
    simulatePayment(cost).then(ok => done(ok));
  }}
/>
```

> The demo expects a success sound at `/success.mp3`. Drop one in your `public/` folder or change the file in the component if you want.

## Hooks (Timer + ViewModel)

Use these if you want the same architecture as the Swift version.

```ts
// Countdown (seconds)
const { remaining, extend } = useCountdownTimer(30 * 60);
// extend(seconds: number) accepts positive or negative

// ViewModel (minutes)
const { remainingSeconds, extendMinutes, timeString } = useTimerViewModel(30);
// extendMinutes(mins: number) accepts positive or negative
```

- `timeString` is `"MM:SS"` (monospace-friendly).
- The countdown ticks once per second, never goes below `0`.

## Example: Integrate payments

```tsx
<TimerWheelView
  config={{ costPerMinute: 1, maxMinutes: 90, tickSoundUrl: '/tick.mp3' }}
  onRequestPayment={async (mins, cost, done) => {
    try {
      // e.g., open a modal or Apple Pay sheet
      const ok = await chargeUser(cost); // boolean
      done(ok);
    } catch {
      done(false);
    }
  }}
/>
```

## Styling

- The SVG rotates with inline `transform`. Outer ring uses your gradient; center is a neutral disc.
- The overlay uses classes (`tw-overlay`, `tw-overlay-content`, `tw-bar-bg`, `tw-bar-fill`, etc.) — tweak in `TimerWheelView.css`.
- For touch devices, ensure the container has `touch-action: none` so drag isn’t hijacked by page scroll.  
  We already set this inline, but you can also add:
  ```css
  .tw-wheel-container { touch-action: none; }
  ```

## Behavior details

- **Dragging:** Wheel follows the pointer 1:1 (no drift, no direction flip). Snapping is used to compute minutes; visual only locks when you hit a clamp.
- **Clamping:** If `maxMinutes > 0`, minutes are limited to `±maxMinutes`. If `allowsNegative` is `false`, the lower bound is `0`.
- **Ticks:** A tick fires when the **snapped step** changes. Provide a small `tickSoundUrl` (e.g., `/tick.mp3`). Browsers require a user gesture before playing sounds.
- **Haptics:** `navigator.vibrate(10)` on tick (if `haptic`), brief vibrate on success (if `shouldPlaySuccessHaptic`). Not all devices support it.

## Common pitfalls

- **“Spins at light speed” / “backwards doesn’t reverse”** – caused by stacking `pointermove` listeners or bad angle math. This implementation registers listeners once and uses the shortest angular difference with an unwrapped accumulator.
- **No audio/haptics** – browsers block autoplay; try after a user gesture and confirm device support.
- **Touch drag fights scrolling** – ensure `touch-action: none` on the container.

## Types

Everything is TypeScript-first. `config` accepts `Partial<TimerWheelConfig>` and merges with `defaultConfig`.

## License

MIT. PRs welcome.
