# LuminaStem 3D - Media Suite v2

## Overview
Media Suite v2 upgrades the asset capture and management capabilities of LuminaStem, focusing on speed, organization, and remixability. It allows users to capture webcam, screen, and microphone input, organize clips in a library, and place them into the 3D scene or convert them into audio stems.

## Features

### 1. Capture Modes
- **Webcam**: Captures video from user camera.
- **Screen**: Captures desktop/window (with optional system audio).
- **Mic**: Captures audio-only input.

### 2. Quick Takes
One-click buttons for timed recordings:
- **3s Take**: Rapid capture for loops.
- **5s Take**: Standard phrase length.
- **10s Take**: Long capture.
- **Manual**: Toggle start/stop freely.

### 3. Clip Library
- **Filters**: Sort by type (Webcam, Screen, Mic, Imported).
- **Search**: Find clips by name/label.
- **Sorting**: Newest, Oldest, Longest, Shortest.
- **Import**: Bring in external video/audio files directly.

### 4. Placements
Clips can be instantiated into the 3D scene in multiple modes:
- **World**: Floating billboard at fixed position.
- **HUD (Camera)**: Locked to camera view (Heads-Up Display).
- **Fleet Attach**: Locked to deck positions (A/B/C).

### 5. Placements Manager
A dedicated tab to manage active scene objects:
- Edit Scale, Opacity, Looping.
- Delete placements.
- Persists via Session Bundle export.

## Event Log
The system tracks media events for session replay/export:
- `MEDIA_RECORD_START`
- `MEDIA_RECORD_STOP`
- `MEDIA_CLIP_ADDED`
- `MEDIA_PLACEMENT_ADDED`
- `MEDIA_PLACEMENT_UPDATE`
- `MEDIA_PLACEMENT_REMOVED`

## Usage Guide
1. Open **Media Dock** (Video Icon on right).
2. Use **Capture** tab to record content.
3. Enable **Auto-Place** to immediately spawn the clip after recording.
4. Go to **Library** to manage clips or import files.
5. Use **Placements** tab to fine-tune visual properties of placed screens.
6. Drag **Audio Stems** from clips into the main mixer using "To Stem" button.
