import { useCallback } from 'react';

/**
 * Hook to download/export images or videos from the app
 */
export const useMediaDownload = () => {
    const downloadMedia = useCallback(async (
        mediaPath: string,
        fileName?: string,
        mediaType: 'image' | 'video' = 'image'
    ) => {
        try {
            // Use the electronAPI to save the media
            if (window.electronAPI?.saveMedia) {
                const result = await window.electronAPI.saveMedia({
                    mediaPath,
                    suggestedFilename: fileName,
                    mediaType
                });

                if (result.success) {
                    console.log(`✓ Saved to: ${result.path}`);
                    return { success: true, path: result.path };
                } else if (result.canceled) {
                    return { success: false, canceled: true };
                } else {
                    console.error('Save failed:', result.error);
                    return { success: false, error: result.error };
                }
            } else {
                // Fallback: create a download link (for web version if it exists)
                const link = document.createElement('a');
                link.href = mediaPath;
                link.download = fileName || `hapa_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'png'}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return { success: true };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Download failed:', error);
            return { success: false, error: errorMessage };
        }
    }, []);

    /**
     * Export media directly to configured export directory
     */
    const exportMedia = useCallback(async (
        mediaPath: string,
        fileName: string,
        mediaType: 'image' | 'video' = 'image'
    ) => {
        try {
            if (window.electronAPI?.exportMedia) {
                const result = await window.electronAPI.exportMedia({
                    mediaPath,
                    fileName,
                    mediaType
                });

                if (result.success) {
                    console.log(`✓ Exported to: ${result.path}`);
                    return { success: true, path: result.path };
                } else {
                    console.error('Export failed:', result.error);
                    return { success: false, error: result.error };
                }
            } else {
                // Fallback to regular download
                return downloadMedia(mediaPath, fileName, mediaType);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Export failed:', error);
            return { success: false, error: errorMessage };
        }
    }, [downloadMedia]);

    return { downloadMedia, exportMedia };
};
