# Profile Page Implementation Plan

## Objective
Create a "Profile Page" accessible via the top-right profile icon. This page will serve as the user's identity hub within the Hapa Node ecosystem, managing their P2P identity, AI persona, and system data.

## Design Philosophy
- **Astro UXDS First:** Use `rux-` components for all interactive elements.
- **Cyberpunk/Sci-Fi Aesthetic:** Align with the "Hapa Node" / "Ops Terminal" theme (dark mode, neon accents, glassmorphism).
- **Functional Density:** Provide real utility (stats, keys, data management) rather than just a placeholder.

## Features

### 1. Agent Identity (Header)
- **Avatar:** Visual representation (currently static or generated).
- **Display Name:** Editable field.
- **Agent ID:** The user's P2P Public Key (derived from their default Hypercore).

### 2. Neural Persona
- **Context Field:** A text area where the user defines who they are (e.g., "I am a senior React developer...").
- **Usage:** This context can be injected into Chat/Wormhole prompts in the future.

### 3. Network Status
- **Connection Health:** Visual indicator of P2P swarm status.
- **Peers:** Count of active peers.
- **Public Key:** Copyable field for sharing with other nodes.

### 4. Operational Stats
- **Card Count:** Total cards in library.
- **Wiki Nodes:** Total wiki entries generated.
- **Wormhole Runs:** Total processing jobs completed.

### 5. Data Management (Danger Zone)
- **Storage Usage:** Approximate size of the `./storage` directory.
- **Clear Data:** Options to wipe specific caches or the entire node (with confirmation).

## Technical Implementation

### Backend (`electron/main.ts`)
- **Profile Persistence:** Use `electron-store` to save `profile` data (name, bio, avatar).
- **Stats Aggregation:** Expose a new IPC `get-system-stats` to fetch file counts/sizes and P2P status.
- **IPC Handlers:**
    - `get-profile`: Retrieve profile data.
    - `save-profile`: Save profile data.
    - `get-system-stats`: Return usage metrics.

### Frontend (`src/pages/Profile.tsx`)
- **Layout:** 3-column grid or dashboard layout using `rux-card` containers.
- **Components:**
    - `ProfileHeader`: Avatar + Name input.
    - `PersonaEditor`: `rux-textarea` for system prompt context.
    - `StatsGrid`: Visual counters.
    - `DataControls`: Actions for storage management.

### Integration
- **Router:** Add `/profile` route in `App.tsx`.
- **Navigation:** Update `Layout.tsx` profile icon to link to `/profile`.

## Step-by-Step Plan
1.  **Backend:** Add `get-profile`, `save-profile`, and `get-system-stats` IPC handlers.
2.  **Preload:** Expose new methods in `electronAPI`.
3.  **Page:** Create `src/pages/Profile.tsx` with Astro components.
4.  **Route:** Register route in `App.tsx`.
5.  **Link:** Connect Layout profile icon.
