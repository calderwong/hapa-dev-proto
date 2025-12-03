// @ts-nocheck
import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));

        if (toast.duration !== Infinity) {
            const timer = setTimeout(() => {
                handleClose();
            }, toast.duration || 5000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => onClose(toast.id), 300);
    };

    const getTheme = (type: ToastType) => {
        switch (type) {
            case 'success': return 'border-green-500 bg-green-900/90 text-white';
            case 'error': return 'border-red-500 bg-red-900/90 text-white';
            case 'warning': return 'border-orange-500 bg-orange-900/90 text-white';
            default: return 'border-cyan-500 bg-cyan-900/90 text-white';
        }
    };

    return (
        <div 
            className={`
                pointer-events-auto w-full max-w-sm rounded-lg border p-4 mb-3 flex items-start gap-3
                transition-all duration-300 transform shadow-lg backdrop-blur-md
                ${getTheme(toast.type)}
                ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
            `}
            role="alert"
        >
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold tracking-wide uppercase font-mono">{toast.title}</h4>
                {toast.message && (
                    <p className="text-xs mt-1 opacity-90 leading-relaxed">{toast.message}</p>
                )}
            </div>
            <button onClick={handleClose} className="text-white opacity-50 hover:opacity-100 font-bold">
                ✕
            </button>
        </div>
    );
};
