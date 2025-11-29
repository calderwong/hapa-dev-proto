import React from 'react';

interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

/**
 * Standard layout wrapper for all main content pages.
 * Enforces consistent background, scrolling behavior, and optional padding.
 */
const PageContainer: React.FC<PageContainerProps> = ({ 
    children, 
    className = '', 
    noPadding = false 
}) => {
    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden bg-gray-900 text-white ${className}`}>
            <div className={`flex-1 overflow-y-auto ${noPadding ? '' : 'p-6 md:p-8'}`}>
                <div className={`max-w-6xl mx-auto h-full ${noPadding ? '' : 'w-full'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default PageContainer;
