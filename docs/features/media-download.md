# Media Download Feature

## Overview
Added the ability to download any image or video from the app to your local machine.

## Implementation Details

### Files Modified/Created

1. **`src/hooks/useMediaDownload.ts`** (NEW)
   - Custom React hook for downloading media
   - Handles both Electron and web fallback scenarios
   - Supports images and videos

2. **`electron/main.ts`**
   - Added `save-media` IPC handler
   - Opens native save dialog for user to choose location
   - Copies file from app's temp storage to chosen location

3. **`electron/preload.ts`**
   - Exposed `saveMedia` method in electronAPI
   - Bridge between renderer and main process

4. **`src/components/CardDetails.tsx`**
   - Added download button to image lightbox
   - Button appears next to the close button
   - Filename is auto-suggested based on card name

## Usage

### In Any Component

```tsx
import { useMediaDownload } from '../hooks/useMediaDownload';

function MyComponent() {
  const { downloadMedia } = useMediaDownload();
  
  const handleDownload = async () => {
    const result = await downloadMedia(
      'file:///path/to/media.png',  // Media path
      'my_image.png',               // Suggested filename (optional)
      'image'                        // Media type: 'image' | 'video'
    );
    
    if (result.success) {
      console.log('Saved to:', result.path);
    } else if (result.canceled) {
      console.log('User canceled');
    } else {
      console.error('Error:', result.error);
    }
  };
  
  return <button onClick={handleDownload}>Download</button>;
}
```

### Current Integration

- **Card Details Lightbox**: Download button appears in the top-right corner when viewing a card image in full-screen

### Future Enhancements

To add download buttons to other parts of the app:

1. Import the hook: `import { useMediaDownload } from '../hooks/useMediaDownload';`
2. Use it: `const { downloadMedia } = useMediaDownload();`
3. Call it with the media path, suggested filename, and type

### Supported File Types

**Images**: PNG, JPG, JPEG, WebP
**Videos**: MP4, MOV, WebM

The save dialog shows appropriate file filters based on the media type.

## Technical Notes

- Uses Electron's native `dialog.showSaveDialog()` for file picker
- Handles `file://` protocol URLs automatically  
- Sanitizes card names for filenames (removes special characters)
- Returns success/error/canceled status for UI feedback
