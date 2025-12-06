import React, { useState, useRef, useEffect } from 'react';

interface HoverVideoThumbnailProps {
    /** Image source URL */
    imageSrc: string;
    /** Video source URL (plays on hover) */
    videoSrc?: string | null;
    /** Alt text for the image */
    alt?: string;
    /** CSS class for the container */
    className?: string;
    /** CSS class for the image/video */
    mediaClassName?: string;
    /** Show loop badge when video is available */
    showLoopBadge?: boolean;
    /** Badge position */
    badgePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Children to render over the thumbnail */
    children?: React.ReactNode;
    /** Click handler */
    onClick?: (e: React.MouseEvent) => void;
    /** Muted state for video */
    muted?: boolean;
}

/**
 * A reusable thumbnail component that shows an image and plays a video on hover.
 * Use this anywhere you need hover-to-play video functionality.
 * 
 * @example
 * <HoverVideoThumbnail
 *     imageSrc={imageUrl}
 *     videoSrc={loopVideoUrl}
 *     className="w-full h-40 rounded-lg"
 *     showLoopBadge
 * />
 */
export const HoverVideoThumbnail: React.FC<HoverVideoThumbnailProps> = ({
    imageSrc,
    videoSrc,
    alt = 'Thumbnail',
    className = '',
    mediaClassName = 'w-full h-full object-cover',
    showLoopBadge = true,
    badgePosition = 'top-right',
    children,
    onClick,
    muted = true,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // Auto-play/pause video on hover
    useEffect(() => {
        if (videoRef.current) {
            if (isHovered && videoSrc) {
                videoRef.current.play().catch(() => {
                    // Ignore autoplay errors
                });
            } else {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }
    }, [isHovered, videoSrc]);
    
    const hasVideo = Boolean(videoSrc);
    
    const badgePositionClass = {
        'top-left': 'top-1 left-1',
        'top-right': 'top-1 right-1',
        'bottom-left': 'bottom-1 left-1',
        'bottom-right': 'bottom-1 right-1',
    }[badgePosition];
    
    return (
        <div 
            className={`relative overflow-hidden ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
        >
            {/* Base Image - lazy load for memory efficiency */}
            <img 
                src={imageSrc} 
                alt={alt}
                loading="lazy"
                className={`${mediaClassName} transition-opacity duration-200 ${
                    hasVideo && isHovered ? 'opacity-0' : 'opacity-100'
                }`}
            />
            
            {/* Video Layer (only rendered if video exists) */}
            {hasVideo && (
                <video
                    ref={videoRef}
                    src={videoSrc!}
                    loop
                    muted={muted}
                    playsInline
                    preload="metadata"
                    className={`absolute inset-0 ${mediaClassName} transition-opacity duration-200 pointer-events-none ${
                        isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                />
            )}
            
            {/* Loop Video Badge */}
            {hasVideo && showLoopBadge && (
                <div className={`absolute ${badgePositionClass} bg-purple-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10`}>
                    <span className="text-[10px]">⟳</span>
                    LOOP
                </div>
            )}
            
            {/* Children (badges, overlays, etc.) */}
            {children}
        </div>
    );
};

/**
 * Helper to extract video path from a card's data.
 * Works with both new taxonomy (children array) and legacy (loopVideo field).
 * 
 * For IMAGE cards: Returns child loop video path if exists
 * For VIDEO cards: Returns the video itself (use getCardImagePath for thumbnail)
 * For HELL WEEK cards (no mediaKind): Check children for loop-video
 */
export function getCardVideoPath(card: any): string | null {
    if (!card) return null;
    
    // Check for loop video child in children array (new taxonomy)
    // This works for both IMAGE cards and HELL WEEK cards (which may not have mediaKind)
    const loopChild = card.cardRecord?.children?.find((c: any) => c.type === 'loop-video');
    if (loopChild?.videoPath) {
        return loopChild.videoPath;
    }
    
    // For IMAGE cards - also check legacy format
    if (card.mediaKind === 'image') {
        // Legacy: embedded loopVideo
        if (card.cardRecord?.loopVideo?.localPath) {
            return card.cardRecord.loopVideo.localPath;
        }
    }
    
    // For VIDEO cards - return the video path itself
    // (the caller should use getCardImagePath for the thumbnail)
    if (card.mediaKind === 'video') {
        return card.mediaLocalPath || card.cardRecord?.mediaLocalPath || null;
    }
    
    return null;
}

/**
 * Helper to get the thumbnail/image source from a card.
 */
export function getCardImagePath(card: any): string | null {
    if (!card) return null;
    
    // For image cards
    if (card.mediaKind === 'image') {
        return card.mediaLocalPath || 
               card.cardRecord?.wormhole?.ingest?.originalPath ||
               card.thumbnail || 
               card.mediaRemoteUrl || 
               null;
    }
    
    // For video cards, use thumbnail or first frame
    if (card.mediaKind === 'video') {
        return card.thumbnail || 
               card.cardRecord?.sourceImage?.localPath ||
               null;
    }
    
    // Generic fallback
    return card.thumbnail || card.mediaLocalPath || card.mediaRemoteUrl || null;
}

export default HoverVideoThumbnail;
