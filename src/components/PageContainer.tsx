// @ts-nocheck
import React from 'react';

interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
    title?: string;
    icon?: string;
}

/**
 * Standard layout wrapper for all main content pages.
 * Enforces consistent background, scrolling behavior, and optional padding.
 */
const PageContainer: React.FC<PageContainerProps> = ({
    children,
    className = '',
    noPadding = false,
    title,
    icon
}) => {
    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden bg-gray-900 text-white ${className}`}>
            {title && (
                <div className="flex-none px-6 py-4 border-b border-gray-800 flex items-center gap-3 bg-gray-900/95 backdrop-blur z-10">
                    {icon && <rux-icon icon={icon} size="small" className="text-astro-primary"></rux-icon>}
                    <h1 className="text-lg font-medium tracking-wide text-white">{title}</h1>
                </div>
            )}
            <div className={`flex-1 overflow-y-auto ${noPadding ? '' : 'p-6 md:p-8'}`}>
                <div className={`max-w-6xl mx-auto h-full ${noPadding ? '' : 'w-full'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default PageContainer;
