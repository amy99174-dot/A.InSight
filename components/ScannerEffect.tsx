
import React from 'react';

export const ScannerEffect: React.FC = () => {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Horizontal scanning bar */}
      <div className="absolute left-0 right-0 h-1 bg-lime-400/80 shadow-[0_0_20px_rgba(57,255,20,0.8)] animate-[scan_2s_ease-in-out_infinite]" 
           style={{ top: '0%' }} 
      />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(57,255,20,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(57,255,20,0.1)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
      
      {/* Corner Brackets */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-lime-400/50" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-lime-400/50" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-lime-400/50" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-lime-400/50" />

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};
