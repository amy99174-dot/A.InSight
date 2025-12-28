
import React from 'react';

// ==========================================
// 🔧 CONFIGURATION
// ==========================================
const SPEED = 10;            // Pixels per degree of tilt. (Increased to 10)
const CONTAINER_SIZE = 320; // The defined pixel width/height of the container
const IMAGE_SCALE = 3.5;    // 350% scale

// Calculate the maximum pixels we can move before hitting the edge
// (ImageSize - ViewportSize) / 2
// (1120 - 320) / 2 = 400px
const MAX_OFFSET = (CONTAINER_SIZE * IMAGE_SCALE - CONTAINER_SIZE) / 2;

interface Props {
  imageSrc: string;
  position: { x: number; y: number }; // Relative degrees from "Zero"
}

export const KeyholeViewer: React.FC<Props> = ({ imageSrc, position }) => {
  
  // 1. Calculate Raw Offsets based on input
  // Formula: Input * Speed
  // We strictly implement the "Window Effect" (Opposite Direction)
  // Moving Phone RIGHT (Positive X) -> Moves Image LEFT (Negative Translate) -> Reveals Right Content
  // So we multiply by -1 (or just subtract). Actually, previously we removed -1 to fix it.
  // Let's stick to the logic the user approved: "Direct Mapping" (No -1).
  // xOffset = position.x * SPEED;
  
  let rawX = position.x * SPEED;
  let rawY = position.y * SPEED;

  // 2. Apply Clamping (Boundary Limits)
  // Ensure the offset never exceeds the calculated limit (MAX_OFFSET)
  // This prevents the black background from showing.
  const xOffset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, rawX));
  const yOffset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, rawY));

  return (
    <div className="relative h-full w-full overflow-hidden touch-none bg-black rounded-full select-none">
      
      {/* 
         LAYER 1: The Ambient Blur (Background)
         We move this slightly less to create depth/parallax.
      */}
      <div 
        className="absolute inset-0 opacity-40 blur-xl scale-[1.2] pointer-events-none"
        style={{
          transform: `translate(calc(-50% + ${xOffset * 0.2}px), calc(-50% + ${yOffset * 0.2}px))`,
          top: '50%',
          left: '50%',
          transition: 'transform 0.1s linear'
        }}
      >
        <img 
          src={imageSrc} 
          alt="Ambience" 
          className="h-full w-full object-cover"
        />
      </div>

      {/* 
         LAYER 2: The Viewfinder (Main Window)
      */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
            className="w-[320px] h-[320px] rounded-full overflow-hidden relative shadow-[0_0_80px_rgba(0,0,0,1)] border-4 border-[#39ff14]/20 bg-black"
        >
            {/* The Moving Image Canvas */}
            <img 
              src={imageSrc}
              alt="History Panorama"
              className="max-w-none object-cover filter contrast-110 saturate-125 brightness-90"
              style={{
                // 1. Size: 350% (Simulates ~35 inch display surface)
                width: `${IMAGE_SCALE * 100}%`, 
                height: `${IMAGE_SCALE * 100}%`,

                // 2. Anchoring
                position: 'absolute',
                top: '50%',
                left: '50%',

                // 3. Movement Logic
                // calc(-50% ...) keeps the image centered by default.
                // We add the CLAMPED offset pixels to "pan" the camera.
                transform: `translate(
                  calc(-50% + ${xOffset}px), 
                  calc(-50% + ${yOffset}px)
                )`,

                // 4. Smooth Transition
                transition: 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1)' 
              }}
            />
            
            {/* Lens Effects Overlays */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 via-transparent to-white/10 pointer-events-none mix-blend-overlay" />
            <div className="absolute inset-0 rounded-full ring-inset ring-[20px] ring-black/80 blur-md pointer-events-none" />
        </div>
      </div>

      {/* 
         LAYER 3: HUD / Reticle
      */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#39ff14]/30 mix-blend-screen opacity-50">
            <svg width="60" height="60" viewBox="0 0 60 60">
               <circle cx="30" cy="30" r="28" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 2" />
               <line x1="30" y1="10" x2="30" y2="50" stroke="currentColor" strokeWidth="0.5" />
               <line x1="10" y1="30" x2="50" y2="30" stroke="currentColor" strokeWidth="0.5" />
            </svg>
         </div>
      </div>
    </div>
  );
};
