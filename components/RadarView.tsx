
import React from 'react';

export const RadarView: React.FC<{ active: boolean; color?: string }> = ({ active, color = '#39ff14' }) => {
  if (!active) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-0">
      
      {/* Static Grid */}
      <div className="absolute inset-0" 
           style={{ 
             backgroundImage: `radial-gradient(circle, ${color}33 1px, transparent 1px)`,
             backgroundSize: '20px 20px' 
           }} 
      />

      {/* Sweeping Radar Arm */}
      <div className="absolute h-[150%] w-[150%] animate-[spin_4s_linear_infinite]">
        <div className="h-1/2 w-full bg-gradient-to-r from-transparent via-transparent to-transparent relative overflow-hidden">
           <div 
             className="absolute bottom-0 right-1/2 w-1/2 h-full origin-bottom-right"
             style={{
               background: `conic-gradient(from 270deg, transparent 0deg, ${color}20 60deg, transparent 90deg)`
             }}
           />
        </div>
      </div>
      
      {/* Concentric Rings */}
      <div className="absolute w-[200px] h-[200px] rounded-full border border-[#39ff14]/20" />
      <div className="absolute w-[140px] h-[140px] rounded-full border border-[#39ff14]/30 border-dashed" />
      <div className="absolute w-[80px] h-[80px] rounded-full border border-[#39ff14]/40" />
    </div>
  );
};
