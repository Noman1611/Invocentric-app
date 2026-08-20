import { Html5Qrcode } from 'html5-qrcode';

/**
 * Utility helper functions for managing HTML5 QR / Barcode scanner camera track focus,
 * continuous macro autofocus, zoom scaling, and torch controls.
 */

export interface CameraCapabilitiesInfo {
  hasTorch: boolean;
  hasZoom: boolean;
  minZoom: number;
  maxZoom: number;
  currentZoom: number;
  hasFocusMode: boolean;
}

/**
 * Configure camera video track constraints for continuous macro focus and optimal resolution
 */
export const configureCameraTrackFocusAndZoom = async (
  containerElement: HTMLElement | null,
  targetZoom: number = 1.3
): Promise<CameraCapabilitiesInfo | null> => {
  if (!containerElement) return null;
  const videoEl = containerElement.querySelector('video') as HTMLVideoElement | null;
  if (!videoEl || !videoEl.srcObject) return null;

  const stream = videoEl.srcObject as MediaStream;
  const track = stream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return null;

  try {
    const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    const settings = (track.getSettings ? track.getSettings() : {}) as any;
    const advanced: any[] = [];

    // 1. Enforce Continuous Macro Auto-Focus
    if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
      if (capabilities.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      } else if (capabilities.focusMode.includes('macro')) {
        advanced.push({ focusMode: 'macro' });
      }
    }

    // 2. Set Optical / Digital Zoom level (1.3x default helps avoid macro background focus)
    let minZoom = 1;
    let maxZoom = 1;
    let currentZoom = settings.zoom || 1;

    if (capabilities.zoom) {
      minZoom = capabilities.zoom.min || 1;
      maxZoom = capabilities.zoom.max || 5;
      currentZoom = Math.min(Math.max(targetZoom, minZoom), maxZoom);
      advanced.push({ zoom: currentZoom });
    }

    if (advanced.length > 0) {
      await track.applyConstraints({ advanced });
    }

    return {
      hasTorch: !!capabilities.torch,
      hasZoom: !!capabilities.zoom,
      minZoom,
      maxZoom,
      currentZoom,
      hasFocusMode: !!capabilities.focusMode
    };
  } catch (err) {
    console.warn("Could not apply camera focus/zoom track constraints:", err);
    return null;
  }
};

/**
 * Trigger an active autofocus motor cycle on tap or manual button press
 */
export const triggerCameraRefocus = async (containerElement: HTMLElement | null) => {
  if (!containerElement) return;
  const videoEl = containerElement.querySelector('video') as HTMLVideoElement | null;
  if (!videoEl || !videoEl.srcObject) return;

  const stream = videoEl.srcObject as MediaStream;
  const track = stream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return;

  try {
    const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    // Force a focus pulse by applying single-shot then continuous
    if (capabilities.focusMode) {
      if (capabilities.focusMode.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] as any });
      }
      setTimeout(() => {
        const resetFocus = capabilities.focusMode.includes('continuous') ? 'continuous' : 'macro';
        track.applyConstraints({ advanced: [{ focusMode: resetFocus }] as any }).catch(() => {});
      }, 350);
    }
  } catch (err) {
    console.warn("Camera refocus sweep error:", err);
  }
};

/**
 * Toggle Camera Torch (Flashlight)
 */
export const setCameraTorch = async (containerElement: HTMLElement | null, turnOn: boolean): Promise<boolean> => {
  if (!containerElement) return false;
  const videoEl = containerElement.querySelector('video') as HTMLVideoElement | null;
  if (!videoEl || !videoEl.srcObject) return false;

  const stream = videoEl.srcObject as MediaStream;
  const track = stream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return false;

  try {
    const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    if (capabilities.torch) {
      await track.applyConstraints({ advanced: [{ torch: turnOn }] as any });
      return true;
    }
  } catch (err) {
    console.warn("Camera torch error:", err);
  }
  return false;
};

/**
 * Set explicit Camera Zoom level
 */
export const setCameraZoom = async (containerElement: HTMLElement | null, zoomVal: number): Promise<boolean> => {
  if (!containerElement) return false;
  const videoEl = containerElement.querySelector('video') as HTMLVideoElement | null;
  if (!videoEl || !videoEl.srcObject) return false;

  const stream = videoEl.srcObject as MediaStream;
  const track = stream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return false;

  try {
    const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    if (capabilities.zoom) {
      const minZoom = capabilities.zoom.min || 1;
      const maxZoom = capabilities.zoom.max || 5;
      const safeZoom = Math.min(Math.max(zoomVal, minZoom), maxZoom);
      await track.applyConstraints({ advanced: [{ zoom: safeZoom }] as any });
      return true;
    }
  } catch (err) {
    console.warn("Camera zoom set error:", err);
  }
  return false;
};

/**
 * Request camera permission explicitly using getUserMedia with standard browser prompts
 */
export const requestExplicitCameraPermission = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { success: false, error: "Camera API is not supported in this browser environment." };
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    // Stop dummy test stream immediately so HTML5 QR code library can open video track cleanly
    stream.getTracks().forEach(track => track.stop());
    return { success: true };
  } catch (err: any) {
    console.error("Camera permission request failed:", err);
    let msg = "Camera permission was denied.";
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = "Camera permission denied. Please allow camera access in browser site settings.";
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      msg = "No camera device detected on this system.";
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      msg = "Camera is being used by another application or tab.";
    }
    return { success: false, error: msg };
  }
};

let sharedAudioCtx: AudioContext | null = null;

/**
 * Play standard barcode scanner beep audio feedback
 */
export const playScanBeepSound = (soundEnabled: boolean = true) => {
  if (!soundEnabled) return;
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    const oscillator = sharedAudioCtx.createOscillator();
    const gainNode = sharedAudioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1000, sharedAudioCtx.currentTime); // 1000Hz standard scanner beep
    
    gainNode.gain.setValueAtTime(0.18, sharedAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, sharedAudioCtx.currentTime + 0.12);
    
    oscillator.connect(gainNode);
    gainNode.connect(sharedAudioCtx.destination);
    
    oscillator.start();
    oscillator.stop(sharedAudioCtx.currentTime + 0.12);
  } catch (e) {
    console.warn('Scan audio beep playback failed:', e);
  }
};

/**
 * Play a distinctive low-pitched warning / error beep when an item is out of stock
 */
export const playErrorBeepSound = (soundEnabled: boolean = true) => {
  if (!soundEnabled) return;
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    const oscillator = sharedAudioCtx.createOscillator();
    const gainNode = sharedAudioCtx.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, sharedAudioCtx.currentTime);
    oscillator.frequency.setValueAtTime(200, sharedAudioCtx.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.25, sharedAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, sharedAudioCtx.currentTime + 0.35);
    
    oscillator.connect(gainNode);
    gainNode.connect(sharedAudioCtx.destination);
    
    oscillator.start();
    oscillator.stop(sharedAudioCtx.currentTime + 0.35);
  } catch (e) {
    console.warn('Error audio beep playback failed:', e);
  }
};

/**
 * Robust camera scanner start with multi-stage fallback (facingMode -> device ID -> generic camera)
 */
export const startHtml5ScannerRobust = async (
  html5QrCode: Html5Qrcode,
  cameraMode: 'environment' | 'user',
  config: any,
  onSuccess: (decodedText: string) => void
): Promise<void> => {
  // 1. First attempt: standard clean facingMode constraint
  try {
    await html5QrCode.start(
      { facingMode: cameraMode },
      config,
      onSuccess,
      () => {}
    );
    return;
  } catch (err) {
    console.warn("Camera start with facingMode constraint failed:", err);
  }

  // 2. Second attempt: enumerate cameras and pick rear / environment camera explicitly
  try {
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length > 0) {
      const backCam = devices.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear') || 
        d.label.toLowerCase().includes('environment') ||
        d.label.toLowerCase().includes('camera 0')
      );
      const targetId = backCam ? backCam.id : devices[0].id;
      await html5QrCode.start(
        targetId,
        config,
        onSuccess,
        () => {}
      );
      return;
    }
  } catch (err2) {
    console.warn("Camera enumeration failed:", err2);
  }

  // 3. Final fallback: try user-facing camera or default
  await html5QrCode.start(
    { facingMode: 'user' },
    config,
    onSuccess,
    () => {}
  );
};


