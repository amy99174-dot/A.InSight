
import { useState, useEffect, useCallback, useRef } from 'react';

export function useOrientation() {
  const [orientation, setOrientation] = useState({ x: 0, y: 0 });
  
  // Stores the "Zero" position (Calibration point)
  const originRef = useRef<{ beta: number; gamma: number } | null>(null);
  
  // Smooth animation refs
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  const LERP_FACTOR = 0.1; // Smoothness (0.0 - 1.0)

  /**
   * ZEROING / CALIBRATION
   * Resets the coordinate system so the current device angle becomes (0,0).
   */
  const resetOrigin = useCallback(() => {
    // We clear the origin so the NEXT sensor event will be captured as the new origin.
    originRef.current = null;
    
    // Reset visual state
    targetRef.current = { x: 0, y: 0 };
    currentRef.current = { x: 0, y: 0 };
    setOrientation({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    // ---------------------------------------------------------
    // 1. SENSOR HANDLER
    // ---------------------------------------------------------
    const handleOrientation = (event: DeviceOrientationEvent) => {
      let { beta, gamma } = event;
      
      // Null checks for some devices/browsers
      if (beta === null) beta = 0;
      if (gamma === null) gamma = 0;

      // Capture Origin (Calibration) if not set
      if (!originRef.current) {
        originRef.current = { beta, gamma };
      }

      // Calculate Relative Position (Delta)
      // X = Gamma (Left/Right tilt)
      // Y = Beta (Up/Down tilt)
      const xDelta = gamma - originRef.current.gamma;
      const yDelta = beta - originRef.current.beta;

      targetRef.current = { x: xDelta, y: yDelta };
    };

    // ---------------------------------------------------------
    // 2. MOUSE FALLBACK (Desktop)
    // ---------------------------------------------------------
    const handleMouseMove = (event: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      // Map screen to approx +/- 45 degrees
      const xDeg = ((event.clientX / innerWidth) - 0.5) * 90;
      const yDeg = ((event.clientY / innerHeight) - 0.5) * 90;
      targetRef.current = { x: xDeg, y: yDeg };
    };

    // ---------------------------------------------------------
    // 3. ANIMATION LOOP (LERP)
    // ---------------------------------------------------------
    let animationFrameId: number;
    const updateLoop = () => {
      const target = targetRef.current;
      const current = currentRef.current;

      // Interpolate
      const nextX = current.x + (target.x - current.x) * LERP_FACTOR;
      const nextY = current.y + (target.y - current.y) * LERP_FACTOR;

      currentRef.current = { x: nextX, y: nextY };

      // Update State only if changed significantly (Optimization)
      setOrientation(prev => {
        if (Math.abs(prev.x - nextX) > 0.05 || Math.abs(prev.y - nextY) > 0.05) {
          return { x: nextX, y: nextY };
        }
        return prev;
      });

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('mousemove', handleMouseMove);
    updateLoop();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return { x: orientation.x, y: orientation.y, resetOrigin };
}
