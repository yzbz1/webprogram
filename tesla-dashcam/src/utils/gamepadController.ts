import { GamepadAction, InputSnapshot } from '../types/realityView';

function applyDeadzone(val: number, deadzone: number): number {
  if (Math.abs(val) <= deadzone) return 0;
  const sign = Math.sign(val);
  return (sign * (Math.abs(val) - deadzone)) / (1 - deadzone);
}

/**
 * Unified HTML5 Gamepad API + Keyboard driving input controller.
 * Standard Xbox / DualSense / Switch Pro mapping:
 * - RT (buttons[7]): Analog Throttle
 * - LT (buttons[6]): Analog Brake / Reverse
 * - Left Stick X (axes[0]): Analog Steering
 * - Right Stick (axes[2], axes[3]): Camera Orbit / Pitch
 * - A (0): Toggle FSD V15 Self-Driving
 * - B (1): Handbrake (hold) / Toggle P-Park when stopped
 * - X (2): Toggle Dashcam Viewer
 * - Y (3): Cycle Camera Angle
 * - LB (4) / RB (5): Left / Right Turn Signal
 * - D-Pad Up/Down (12/13): Cycle Atmosphere
 * - D-Pad Left/Right (14/15): Cycle Car Paint
 * - Menu/Start (9): Toggle Car Settings
 */
export class InputController {
  private keys = new Set<string>();
  private queuedActions: GamepadAction[] = [];
  private prevPadButtons: boolean[] = [];
  private paused = false;
  private activePadIndex: number | null = null;
  private connectedPadName = '';
  private onConnectionChange?: (connected: boolean, name: string) => void;

  constructor(onConnectionChange?: (connected: boolean, name: string) => void) {
    this.onConnectionChange = onConnectionChange;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.keys.clear();
    }
  }

  public isConnected(): boolean {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (pad && pad.connected) return true;
    }
    return false;
  }

  public getGamepadName(): string {
    return this.connectedPadName;
  }

  public rumble(intensity = 0.4, durationMs = 140): void {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad =
        (this.activePadIndex !== null ? pads[this.activePadIndex] : null) ||
        Array.from(pads).find((p) => p && p.connected);
      const actuator = (
        pad as Gamepad & {
          vibrationActuator?: {
            playEffect?: (
              type: string,
              params: {
                startDelay?: number;
                duration: number;
                weakMagnitude: number;
                strongMagnitude: number;
              }
            ) => Promise<void>;
          };
        }
      )?.vibrationActuator;

      actuator?.playEffect?.('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: Math.min(1, intensity),
        strongMagnitude: Math.min(1, intensity * 0.8),
      });
    } catch {
      // Vibration optional on unsupported browsers/controllers
    }
  }

  public poll(): InputSnapshot {
    const actions: GamepadAction[] = [];

    if (!this.paused && this.queuedActions.length > 0) {
      actions.push(...this.queuedActions);
      this.queuedActions = [];
    } else if (this.paused) {
      this.queuedActions = [];
    }

    // 1. Poll physical Gamepad
    let padThrottle = 0;
    let padBrake = 0;
    let padSteer = 0;
    let lookX = 0;
    let lookY = 0;
    let padHandbrake = false;
    let connected = false;
    let gamepadName = '';

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    if (this.activePadIndex !== null && pads[this.activePadIndex]?.connected) {
      pad = pads[this.activePadIndex];
    } else {
      for (const p of pads) {
        if (p && p.connected) {
          pad = p;
          this.activePadIndex = p.index;
          break;
        }
      }
    }

    if (pad) {
      connected = true;
      gamepadName = pad.id;
      if (this.connectedPadName !== pad.id) {
        this.connectedPadName = pad.id;
        this.onConnectionChange?.(true, pad.id);
      }

      const btns = pad.buttons;
      const axes = pad.axes;

      // Edge detection for discrete buttons
      const pressedNow = btns.map((b) => Boolean(b?.pressed));
      const rising = (idx: number) => Boolean(pressedNow[idx] && !this.prevPadButtons[idx]);

      // Gamepad X (Dashcam) & Menu (Settings) always work even when paused in Dashcam modal!
      if (rising(2)) actions.push('toggle_dashcam');
      if (rising(9)) actions.push('toggle_settings');

      if (!this.paused) {
        if (rising(0)) actions.push('toggle_fsd');
        if (rising(1)) actions.push('toggle_park');
        if (rising(3)) actions.push('cycle_camera');
        if (rising(4)) actions.push('signal_left');
        if (rising(5)) actions.push('signal_right');
        if (rising(12) || rising(13)) actions.push('cycle_atmosphere');
        if (rising(14) || rising(15)) actions.push('cycle_paint');

        padThrottle = btns[7]?.value ?? 0;
        padBrake = btns[6]?.value ?? 0;
        padHandbrake = Boolean(btns[1]?.pressed);
        padSteer = applyDeadzone(axes[0] ?? 0, 0.12);
        lookX = applyDeadzone(axes[2] ?? 0, 0.14);
        lookY = applyDeadzone(axes[3] ?? 0, 0.14);
      }

      this.prevPadButtons = pressedNow;
    } else if (this.connectedPadName) {
      this.connectedPadName = '';
      this.prevPadButtons = [];
      this.onConnectionChange?.(false, '');
    }

    // 2. Poll Keyboard (only when Reality View is active / not paused by Dashcam modal)
    let keyThrottle = 0;
    let keyBrake = 0;
    let keySteer = 0;
    let keyHandbrake = false;

    if (!this.paused) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) keyThrottle = 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) keyBrake = 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) keySteer -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) keySteer += 1;
      if (this.keys.has('Space')) keyHandbrake = true;
    }

    const throttle = Math.min(1, Math.max(padThrottle, keyThrottle));
    const brake = Math.min(1, Math.max(padBrake, keyBrake));
    const steer = Math.abs(padSteer) > 0.01 ? padSteer : keySteer;
    const handbrake = padHandbrake || keyHandbrake;

    return {
      connected,
      gamepadName,
      throttle,
      brake,
      steer,
      lookX,
      lookY,
      handbrake,
      actions,
    };
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (this.paused) return;

    this.keys.add(e.code);

    if (e.repeat) return;
    if (e.code === 'KeyF') this.queuedActions.push('toggle_fsd');
    else if (e.code === 'KeyP') this.queuedActions.push('toggle_park');
    else if (e.code === 'KeyV') this.queuedActions.push('cycle_camera');
    else if (e.code === 'KeyQ') this.queuedActions.push('signal_left');
    else if (e.code === 'KeyE') this.queuedActions.push('signal_right');
    else if (e.code === 'KeyT') this.queuedActions.push('cycle_atmosphere');
    else if (e.code === 'KeyC') this.queuedActions.push('cycle_paint');
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleBlur = () => {
    this.keys.clear();
  };

  private handleGamepadConnected = (e: GamepadEvent) => {
    this.activePadIndex = e.gamepad.index;
    this.connectedPadName = e.gamepad.id;
    this.onConnectionChange?.(true, e.gamepad.id);
    this.rumble(0.35, 160);
  };

  private handleGamepadDisconnected = (e: GamepadEvent) => {
    if (this.activePadIndex === e.gamepad.index) {
      this.activePadIndex = null;
      this.connectedPadName = '';
      this.prevPadButtons = [];
      this.onConnectionChange?.(false, '');
    }
  };
}
