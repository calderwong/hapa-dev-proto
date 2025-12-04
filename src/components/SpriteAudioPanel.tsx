// @ts-nocheck
import React, { useState, useRef } from 'react';
import { PrimaryButton, SecondaryButton } from './Button';
import AudioRecorder from './AudioRecorder';

interface AudioChild {
    cardId: string;
    title: string;
    duration?: number;
    url?: string;
    createdAt?: string;
}

interface SpriteAudioPanelProps {
    animationCard: any;
    gifUrl: string;
    audioChildren: AudioChild[];
    onUpload: (file: File) => Promise<void>;
    onRecordComplete: (audioBlob: Blob, name: string) => Promise<void>;
    onDelete: (audioCardId: string) => Promise<void>;
    onPlayAudio?: (audioUrl: string) => void;
}

export const SpriteAudioPanel: React.FC<SpriteAudioPanelProps> = ({
    animationCard,
    gifUrl,
    audioChildren,
    onUpload,
    onRecordComplete,
    onDelete,
    onPlayAudio
}) => {
    const [showRecorder, setShowRecorder] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await onUpload(file);
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRecordSave = async (audioBlob: Blob, name: string) => {
        await onRecordComplete(audioBlob, name);
        setShowRecorder(false);
    };

    const handlePlayPause = (child: AudioChild) => {
        if (!child.url) return;

        const audioEl = audioRefs.current[child.cardId];
        
        if (playingId === child.cardId) {
            // Currently playing, pause it
            audioEl?.pause();
            setPlayingId(null);
        } else {
            // Stop any currently playing audio
            if (playingId && audioRefs.current[playingId]) {
                audioRefs.current[playingId].pause();
                audioRefs.current[playingId].currentTime = 0;
            }
            
            // Play new audio
            if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.play();
                setPlayingId(child.cardId);
            }
        }
    };

    const handleAudioEnded = (cardId: string) => {
        if (playingId === cardId) {
            setPlayingId(null);
        }
    };

    const handleDelete = async (cardId: string) => {
        setDeletingId(cardId);
        try {
            await onDelete(cardId);
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        <rux-icon icon="volume-up" size="small" className="text-cyan-400"></rux-icon>
                        <span className="text-sm font-bold text-white uppercase tracking-wider">
                            Sound Effects
                        </span>
                        <span className="text-xs text-gray-500">
                            ({audioChildren.length})
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-b border-gray-700 flex gap-2">
                    <SecondaryButton 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        title="Upload an audio file"
                    >
                        {isUploading ? (
                            <rux-icon icon="autorenew" size="small" className="mr-2 animate-spin"></rux-icon>
                        ) : (
                            <rux-icon icon="upload" size="small" className="mr-2"></rux-icon>
                        )}
                        {isUploading ? 'UPLOADING...' : 'UPLOAD'}
                    </SecondaryButton>
                    <PrimaryButton 
                        onClick={() => setShowRecorder(true)}
                        title="Record audio with your microphone"
                    >
                        <rux-icon icon="mic" size="small" className="mr-2"></rux-icon>
                        RECORD
                    </PrimaryButton>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                        onChange={handleFileSelect}
                        className="hidden"
                        title="Select audio file"
                        aria-label="Select audio file to upload"
                    />
                </div>

                {/* Audio List */}
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {audioChildren.length === 0 ? (
                        <div className="p-6 text-center">
                            <div className="text-gray-600 text-sm mb-2">
                                No sound effects attached yet
                            </div>
                            <div className="text-gray-700 text-xs">
                                Upload or record audio to sync with this animation
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-800">
                            {audioChildren.map((child) => (
                                <div 
                                    key={child.cardId}
                                    className="p-3 flex items-center gap-3 hover:bg-white/5 transition-colors group"
                                >
                                    {/* Hidden audio element */}
                                    {child.url && (
                                        <audio
                                            ref={(el) => { if (el) audioRefs.current[child.cardId] = el; }}
                                            src={child.url}
                                            onEnded={() => handleAudioEnded(child.cardId)}
                                            preload="metadata"
                                        />
                                    )}

                                    {/* Play/Pause Button */}
                                    <button
                                        onClick={() => handlePlayPause(child)}
                                        disabled={!child.url}
                                        className={`
                                            w-10 h-10 rounded-full flex items-center justify-center transition-all
                                            ${playingId === child.cardId 
                                                ? 'bg-cyan-500 text-white' 
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                            }
                                            ${!child.url ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                        title={playingId === child.cardId ? 'Pause' : 'Play'}
                                    >
                                        <rux-icon 
                                            icon={playingId === child.cardId ? 'pause' : 'play-arrow'} 
                                            size="small"
                                        ></rux-icon>
                                    </button>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white truncate">
                                            {child.title || 'Untitled'}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <span>{formatDuration(child.duration)}</span>
                                            {child.createdAt && (
                                                <>
                                                    <span>•</span>
                                                    <span>{new Date(child.createdAt).toLocaleDateString()}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDelete(child.cardId)}
                                        disabled={deletingId === child.cardId}
                                        className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Remove audio"
                                    >
                                        {deletingId === child.cardId ? (
                                            <rux-icon icon="autorenew" size="extra-small" className="animate-spin"></rux-icon>
                                        ) : (
                                            <rux-icon icon="delete" size="extra-small"></rux-icon>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                <div className="p-3 border-t border-gray-700 bg-black/20">
                    <div className="text-[10px] text-gray-600 flex items-center gap-1">
                        <rux-icon icon="info" size="extra-small"></rux-icon>
                        Drag audio cards here to attach (coming soon)
                    </div>
                </div>
            </div>

            {/* Audio Recorder Modal */}
            {showRecorder && (
                <AudioRecorder
                    gifUrl={gifUrl}
                    animationTitle={animationCard.data?.title || animationCard.title || 'Animation'}
                    onSave={handleRecordSave}
                    onCancel={() => setShowRecorder(false)}
                />
            )}
        </>
    );
};

export default SpriteAudioPanel;
