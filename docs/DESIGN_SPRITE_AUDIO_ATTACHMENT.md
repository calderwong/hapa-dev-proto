# Sprite Audio Attachment System - Design Document

## Date: Dec 3, 2025

## Overview

Enable users to attach audio (sound effects, voice clips) to sprite animations, creating a complete audio-visual asset ready for game integration. This prepares for future drag-and-drop "equipping" of sounds to animations.

---

## Card Hierarchy (4 Stages)

```
🖼️ Original Image Card (type: 'image')
    │
    │  [MARK AS SEED] - User action
    ▼
🌱 Sprite Seed Card (type: 'image', subType: 'sprite-seed')
    │   parentId: original-image-id
    │
    │  [GENERATE ANIMATION] - AI generates sprite sheet
    ▼
📊 Sprite Sheet Card (type: 'image', subType: 'sprite-sheet')
    │   parentId: seed-card-id
    │
    │  [MAKE GIF] - Convert to animated GIF
    ▼
🎬 Sprite Animation Card (type: 'image', subType: 'sprite-animation')
    │   parentId: sprite-sheet-id
    │
    │  [RECORD/UPLOAD AUDIO] - Attach sound effects
    ▼
🔊 Audio Clip Card (type: 'audio', subType: 'sprite-sfx')
        parentId: animation-card-id
```

**Each card is a child of the one that created it, forming a 4-stage pipeline.**

### Card Type Definitions

| Card Type | subType | Description |
|-----------|---------|-------------|
| image | sprite-seed | Original character/sprite image |
| image | sprite-sheet | Grid of animation frames |
| image | sprite-animation | Animated GIF/WebP from sprite sheet |
| audio | sprite-sfx | Sound effect attached to animation |

---

## Feature Requirements

### 1. Animation Card Audio Panel

When viewing a `sprite-animation` card, show an "Audio" section with:

- **Upload Button**: Upload existing audio file (.mp3, .wav, .ogg, .m4a)
- **Record Button**: Open recording modal with GIF sync
- **Attached Audio List**: Show all `sprite-sfx` children with playback controls

### 2. Audio Recording Modal

#### UI Components

```
┌─────────────────────────────────────────────────────────┐
│  🎤 Record Sound Effect                           [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│     ┌─────────────────────────────────────┐             │
│     │                                     │             │
│     │         [GIF Preview]               │             │
│     │         (plays during recording)    │             │
│     │                                     │             │
│     └─────────────────────────────────────┘             │
│                                                         │
│                    ● 3... 2... 1...                     │
│                                                         │
│     ┌─────────────────────────────────────┐             │
│     │  🎤 ████████████░░░░░░░░░░ 00:02.5  │             │
│     └─────────────────────────────────────┘             │
│                                                         │
│     Duration: Match GIF loop / Custom                   │
│                                                         │
│    [RECORD]  [PREVIEW]  [RE-RECORD]  [SAVE]            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Recording Flow

1. **Preparation**
   - User clicks "Record"
   - Show countdown: 3... 2... 1...
   - GIF animation pauses at frame 0

2. **Recording**
   - At "GO!", GIF starts playing + audio recording begins
   - Show waveform visualization
   - Show elapsed time
   - Auto-stop options:
     a. After one GIF loop
     b. After user clicks "Stop"
     c. After max duration (e.g., 10 seconds)

3. **Preview**
   - Play recorded audio synced with GIF
   - User can see if timing matches

4. **Save or Re-record**
   - "Save" → Create audio-clip card, attach as child
   - "Re-record" → Discard and restart

### 3. Audio Upload Flow

1. User clicks "Upload Audio"
2. File picker opens (accept: .mp3, .wav, .ogg, .m4a, .webm)
3. File is ingested via `wormholeIngestContent`
4. Created card is linked as child of animation card
5. Show in "Attached Audio" list

### 4. Attached Audio List

For each audio child:
- Thumbnail/icon
- Name (editable?)
- Duration
- Play/Pause button
- Delete button
- Drag handle (for future reordering/equipping)

---

## Technical Implementation

### New Component: `AudioRecorder.tsx`

```typescript
interface AudioRecorderProps {
  animationCard: Card;           // The sprite-animation card
  gifUrl: string;                // URL to the animated GIF
  onSave: (audioBlob: Blob, name: string) => Promise<void>;
  onCancel: () => void;
}
```

Uses Web Audio API:
- `navigator.mediaDevices.getUserMedia({ audio: true })`
- `MediaRecorder` for capturing
- `AudioContext` for waveform visualization

### New Component: `SpriteAudioPanel.tsx`

```typescript
interface SpriteAudioPanelProps {
  animationCard: Card;
  audioChildren: Card[];
  onUpload: (file: File) => Promise<void>;
  onRecord: () => void;
  onDelete: (audioCardId: string) => Promise<void>;
}
```

### CardWorkspace Updates

1. Detect if viewing a `sprite-animation` card
2. Fetch audio children from P2P store
3. Render `SpriteAudioPanel`
4. Handle upload/record callbacks

### Electron Main Process

No new IPC handlers needed - reuse existing:
- `wormhole-ingest-content` for saving audio files
- `p2pAppend` for creating card records and links

### Audio Card Structure

```typescript
{
  type: 'card',
  kind: 'audio',
  id: 'card-xxx',
  title: 'Attack Sound',
  mediaType: 'audio',
  subType: 'sprite-sfx',
  parentId: 'animation-card-id',
  audio: {
    localPath: '/path/to/file.wav',
    url: 'file:///path/to/file.wav',
    duration: 1.5,  // seconds
    mimeType: 'audio/wav'
  },
  generationMetadata: {
    recordedAt: '2025-12-03T...',
    syncedWithAnimation: true,
    sourceAnimationId: 'animation-card-id'
  }
}
```

---

## Implementation Plan

### Phase 1: Core Components
1. [ ] Create `SpriteAudioPanel.tsx` component
2. [ ] Create `AudioRecorder.tsx` component with countdown + recording
3. [ ] Add Web Audio API integration for recording

### Phase 2: Integration
4. [ ] Update `CardWorkspace.tsx` to detect sprite-animation cards
5. [ ] Add audio panel to the right sidebar or main content area
6. [ ] Wire up upload flow (file input → wormholeIngestContent → link as child)

### Phase 3: Recording Flow
7. [ ] Implement countdown timer with GIF sync
8. [ ] Implement MediaRecorder capture
9. [ ] Implement preview playback (audio + GIF synced)
10. [ ] Implement save flow (blob → wormholeIngestContent → child link)

### Phase 4: Polish
11. [ ] Add waveform visualization during recording
12. [ ] Add duration display
13. [ ] Add delete functionality for audio clips
14. [ ] Add playback controls for attached audio list

---

## Future Considerations

### Drag-and-Drop Equipping
- Audio cards can be dragged onto animation cards
- Creates parent-child link
- Visual feedback during drag

### Multiple Audio Slots
- Primary SFX
- Secondary SFX
- Voice line
- Each slot is a different `subType`

### Audio Mixing
- Volume sliders per audio clip
- Preview mixed audio with animation

---

## Open Questions

1. **Recording duration**: Should it auto-stop after one GIF loop, or let user control?
   - **Decision**: Offer both options - default to one loop, with "hold to record longer" option

2. **Audio format**: What format to save recordings?
   - **Decision**: WebM/Opus for web compatibility, offer WAV export for quality

3. **Where to show audio panel?**
   - **Decision**: Add as a section in the right panel of CardWorkspace, below "Derived Assets"

---

## Acceptance Criteria

- [ ] User can upload audio file to sprite-animation card
- [ ] User can record audio synced with GIF playback
- [ ] 3-second countdown before recording starts
- [ ] GIF plays during recording
- [ ] User can preview recorded audio with GIF
- [ ] User can re-record if not satisfied
- [ ] Saved audio appears as child card of animation
- [ ] Audio cards are accessible in Card Library
- [ ] Attached audio shows in animation card's detail view
