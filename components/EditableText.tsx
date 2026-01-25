
import React, { useState, useEffect, useRef } from 'react';

interface EditableTextProps {
    value: string;
    onChange: (value: string) => void;
    isEditable?: boolean;
    className?: string;
}

export const EditableText: React.FC<EditableTextProps> = ({ value, onChange, isEditable, className }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onChange(tempValue);
            setIsEditing(false);
        } else if (e.key === 'Escape') {
            setTempValue(value);
            setIsEditing(false);
        }
    };

    if (!isEditable) {
        return <span className={className}>{value}</span>;
    }

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={() => { onChange(tempValue); setIsEditing(false); }}
                onKeyDown={handleKeyDown}
                className="bg-black/80 text-white border border-white/50 px-1 rounded min-w-[50px] outline-none z-50 relative pointer-events-auto font-mono text-center"
                onClick={(e) => e.stopPropagation()}
            />
        );
    }

    return (
        <span
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className={`cursor-pointer hover:bg-white/10 hover:outline hover:outline-1 hover:outline-white/30 rounded px-1 transition-all pointer-events-auto whitespace-pre-wrap ${className}`}
            title="Click to edit"
        >
            {value}
        </span>
    );
};
