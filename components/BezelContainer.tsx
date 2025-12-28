
import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export const BezelContainer: React.FC<Props> = ({ children }) => {
  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-[#1c1917] p-4 overflow-hidden">
      {/* 
         Main Device Container 
         - Strictly set to w-[320px] h-[320px] to mimic approx 8cm physical size.
         - Acts as the relative anchor for all absolute layers inside.
      */}
      <div className="relative w-[320px] h-[320px] shrink-0 rounded-[1rem] bg-[#1a1816] shadow-2xl ring-1 ring-[#3a3530]">
        
        {/* 
           LAYER 1: The Frame (Bezel)
           - Overlays the content perfectly using absolute inset-0.
           - pointer-events-none ensures clicks pass through to the content.
           - z-50 ensures it visually frames the content.
        */}
        <div className="absolute inset-0 z-50 pointer-events-none rounded-[1rem] border-[12px] border-[#594a36] shadow-inner">
           {/* Inner golden rim */}
           <div className="absolute inset-0 border border-[#8c7348] opacity-50 rounded-[0.5rem]" />
           
           {/* Screws / Rivets */}
           <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-[#8c7348] to-[#3e3424] shadow-md flex items-center justify-center">
             <div className="w-1.5 h-0.5 bg-[#2a241a] rotate-45" />
           </div>
           <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-[#8c7348] to-[#3e3424] shadow-md flex items-center justify-center">
             <div className="w-1.5 h-0.5 bg-[#2a241a] rotate-45" />
           </div>
           <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-[#8c7348] to-[#3e3424] shadow-md flex items-center justify-center">
             <div className="w-1.5 h-0.5 bg-[#2a241a] rotate-45" />
           </div>
           <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-[#8c7348] to-[#3e3424] shadow-md flex items-center justify-center">
             <div className="w-1.5 h-0.5 bg-[#2a241a] rotate-45" />
           </div>
        </div>

        {/* 
           LAYER 2: The Content 
           - Positioned absolutely to fill the container exactly.
           - Uses flexbox to center content mathematically.
           - z-0 to sit behind the frame.
        */}
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden rounded-[0.8rem] bg-[#050505]">
          {children}
        </div>
        
        {/* 
           LAYER 3: Reflection/Gloss
           - Sits on top of everything for the glass effect.
        */}
        <div className="absolute inset-0 z-[100] rounded-[1rem] pointer-events-none bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-50" />
      </div>
    </div>
  );
};
