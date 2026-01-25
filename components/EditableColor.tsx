
import React, { useRef } from 'react';

interface EditableColorProps {
    value: string; // Can be hex (#fff) or tailwind class (text-red-500)
    onChange: (value: string) => void;
    isEditable?: boolean;
    className?: string;
    children: React.ReactNode;
}

export const EditableColor: React.FC<EditableColorProps> = ({ value, onChange, isEditable, className, children }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isEditable) return <>{children}</>;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        inputRef.current?.click();
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Always save as Hex when using color picker
        onChange(e.target.value);
    };

    // Helper to get a valid hex for the picker input, defaulting to white if it's a tailwind class
    const currentHex = value.startsWith('#') ? value : '#ffffff';

    return (
        <div className={`relative group pointer-events-none ${className || ''}`} onClick={handleClick}>
            {/* Invisible Color Input - Force Hidden but present */}
            <input
                ref={inputRef}
                type="color"
                value={currentHex}
                onChange={handleColorChange}
                className="absolute opacity-0 w-0 h-0 pointer-events-none top-0 left-0"
            />

            {/* Hover Indicator */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-dashed group-hover:border-yellow-400/50 rounded-full pointer-events-none z-50"></div>

            {children}
        </div>
    );
};
