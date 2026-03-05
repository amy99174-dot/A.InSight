import React from 'react';

export interface HardwareHintsProps {
    activeLeftRight: boolean;
    activeDial: boolean;
    activeConfirm: boolean;
    colorClass?: string;
}

export function HardwareHints({
    activeLeftRight,
    activeDial,
    activeConfirm,
    colorClass = "text-white"
}: HardwareHintsProps) {

    // Define base sizes and opacities
    const iconSize = 28; // Keep size, but adjust layout
    const activeOpacity = "opacity-100"; // Removed drop-shadow glow
    const inactiveOpacity = "opacity-30"; // Pure stroke, no fill, lower opacity

    return (
        // Adjusted gap from gap-8 to gap-4 to bring them closer, added items-center for center alignment
        <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 flex flex-col gap-4 items-center z-50 pointer-events-none pr-8">

            {/* 1. Left/Right Button: Two intersecting shapes (One full circle, one crescent) */}
            <div className={`transition-opacity duration-300 ${activeLeftRight ? activeOpacity : inactiveOpacity} ${colorClass}`}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill={activeLeftRight ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeLeftRight ? "0" : "2"}>
                    {/* Left Circle (Full) */}
                    <circle cx="14" cy="20" r="10" />
                    {/* Right Crescent (Formed by subtracting a circle) */}
                    {activeLeftRight ? (
                        <path d="M 26 10 A 10 10 0 1 1 26 30 A 10 10 0 1 0 26 10 Z" fill="currentColor" />
                    ) : (
                        <path d="M 26 10 A 10 10 0 1 1 26 30 A 10 10 0 0 0 26 10 Z" stroke="currentColor" fill="none" />
                    )}
                </svg>
            </div>

            {/* 2. Rotary Dial: Gear-like circle with a hole in the middle */}
            <div className={`transition-opacity duration-300 flex items-center justify-center ${activeDial ? activeOpacity : inactiveOpacity} ${colorClass}`}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill={activeDial ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeDial ? "0" : "1.5"} strokeLinejoin="round">
                    <g transform="translate(20, 20) scale(0.85) translate(-20, -20)">
                        {/* Gear Teeth path (Center is exactly at 20,20) */}
                        <path
                            d="M20,2 C21.1,2 22,2.8 22.2,3.9 L23.5,9.6 C24.6,10.1 25.7,10.8 26.6,11.6 L31.9,8.7 C32.9,8.2 34.1,8.6 34.6,9.5 L37.3,14.1 C37.8,15.1 37.5,16.3 36.6,16.9 L32.3,20.8 C32.4,21.9 32.4,22.9 32.1,24 L36.6,28 C37.5,28.6 37.8,29.9 37.3,30.8 L34.6,35.5 C34.1,36.4 32.9,36.8 31.9,36.3 L26.6,33.3 C25.7,34.1 24.6,34.8 23.5,35.3 L22.2,41 C22,42.1 21.1,42.9 20,42.9 L14.7,42.9 C13.6,42.9 12.7,42.1 12.5,41 L11.2,35.3 C10.1,34.8 9,34.1 8.1,33.3 L2.8,36.3 C1.8,36.8 0.6,36.4 0.1,35.5 L-2.6,30.8 C-3.1,29.9 -2.8,28.6 -1.9,28 L2.4,24 C2.3,22.9 2.3,21.9 2.6,20.8 L-1.9,16.9 C-2.8,16.3 -3.1,15.1 -2.6,14.1 L0.1,9.5 C0.6,8.6 1.8,8.2 2.8,8.7 L8.1,11.6 C9,10.8 10.1,10.1 11.2,9.6 L12.5,3.9 C12.7,2.8 13.6,2 14.7,2 L20,2 Z"
                        />
                        {/* Inner Hole (Subtract) - Now mathematically perfectly centered */}
                        {activeDial ? (
                            <circle cx="20" cy="20" r="5" fill="black" />
                        ) : (
                            <circle cx="20" cy="20" r="5" stroke="currentColor" fill="none" />
                        )}
                    </g>
                </svg>
            </div>

            {/* 3. Confirm Button: Two vertically stacked circles (snowman) */}
            <div className={`transition-opacity duration-300 ${activeConfirm ? activeOpacity : inactiveOpacity} ${colorClass}`}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill={activeConfirm ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeConfirm ? "0" : "2"}>
                    {/* Top Circle - Now r=9 to match bottom circle */}
                    <circle cx="20" cy="12" r="9" />
                    {/* Bottom Circle - Also r=9 */}
                    <circle cx="20" cy="28" r="9" />
                </svg>
            </div>

        </div>
    );
}

export default HardwareHints;
