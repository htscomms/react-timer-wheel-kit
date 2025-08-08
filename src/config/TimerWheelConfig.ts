// src/config/TimerWheelConfig.ts

/** Simple gradient type for our ring */
export interface Gradient {
  colors: string[];
}

export interface TimerWheelConfig {
  minuteStep: number;
  snapDegree: number;
  costPerMinute: number;
  allowsNegative: boolean;
  maxMinutes: number;
  ringLineWidth: number;
  ringGradient: Gradient;      // use our local type
  overlayBarWidth: number;
  overlayBarHeight: number;
  tickSoundUrl?: string;
  haptic?: boolean;
  shouldPlaySuccessHaptic: boolean;
}

export const defaultConfig: TimerWheelConfig = {
  minuteStep: 1,
  snapDegree: 15,
  costPerMinute: 0.35,
  allowsNegative: true,
  maxMinutes: 0,
  ringLineWidth: 40,
  ringGradient: {
    colors: [
      'rgba(128,128,128,0.4)',
      'rgba(128,128,128,0.9)',
    ],
  },
  overlayBarWidth: 75,
  overlayBarHeight: 6,
  tickSoundUrl: '',           // leave blank to disable
  haptic: true,
  shouldPlaySuccessHaptic: true,
};
