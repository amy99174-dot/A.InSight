
import React from 'react';

export const GrainOverlay: React.FC = () => {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden rounded-none">
      {/* Heavy Vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle, transparent 40%, rgba(10,10,0,0.6) 80%, rgba(0,0,0,0.95) 100%)'
        }}
      />
      
      {/* Noise / Grain simulation using SVG filter or CSS pattern */}
      <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay">
         <svg className='h-full w-full'>
            <filter id='noiseFilter'>
                <feTurbulence 
                  type='fractalNoise' 
                  baseFrequency='0.85' 
                  numOctaves='3' 
                  stitchTiles='stitch'
                />
            </filter>
            <rect width='100%' height='100%' filter='url(#noiseFilter)' />
         </svg>
      </div>
      
      {/* Screen Line Overlay (Scanlines) */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 4px, 6px 100%'
        }}
      />
    </div>
  );
};
