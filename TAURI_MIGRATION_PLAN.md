# Hapa Node – Tauri v2 Migration Plan

**Version:** 1.0  
**Date:** 2025-12-01  
**Author:** AI Development Agent  

---

## Executive Summary

This document outlines a comprehensive plan for migrating **Hapa Node** from Electron to **Tauri v2**. The migration aims to achieve:

- **Dramatically smaller app bundles** (from ~150MB+ to <10MB)
- **Improved security** via Rust's memory safety and Tauri's permission-based IPC
- **Native mobile support** (iOS/Android) using the same codebase
- **Better performance** through native system webview and Rust backend
- **Future-proofing** with a modern, actively maintained framework

---

## 1. Current Architecture Analysis

### 1.1 Technology Stack

| Layer | Current (Electron) | Notes |
|-------|-------------------|-------|
| **Shell/Runtime** | Electron 39 + Chromium | ~150MB+ bundle size |
| **Frontend** | React 19, Vite 7, TypeScript 5.9 | ✅ Compatible with Tauri |
| **Styling** | Tailwind CSS + Astro UXDS Web Components | ✅ Compatible with Tauri |
| **Routing** | React Router 6 (HashRouter) | ✅ Compatible with Tauri |
| **Backend IPC** | Electron IPC (ipcMain/ipcRenderer) | Needs migration to Tauri commands |
| **Storage** | electron-store | Replace with tauri-plugin-store |
| **P2P** | Hypercore + Hyperswarm (Node.js) | Needs Rust port or sidecar |
| **AI APIs** | HTTP/HTTPS calls from main process | Move to Rust commands |
| **Local AI** | Child process spawning (llama.cpp) | Use tauri-plugin-shell |

### 1.2 Core Features Inventory

1. **Multi-Provider Chat** – Gemini, OpenAI, local llama.cpp with streaming
2. **Card Library & Wormhole** – Content ingestion, summarization, key-term extraction
3. **Wiki Browser** – Knowledge graph visualization
4. **Profile Page** – User identity, stats, P2P status
5. **Local AI (llama.cpp)** – Process lifecycle management
6. **P2P Hypercore Manager** – Append-only log storage and replication
7. **Settings & Admin** – Configuration persistence

### 1.3 Current IPC Surface

The app exposes **~50+ IPC handlers** via `electron/preload.ts`:

```typescript
// Settings
getSettings, saveSettings

// AI Providers
listGeminiModels, listOpenAIModels, listLlamaModels
chatWithGemini, chatWithOpenAI, chatWithLlama

// Llama.cpp Management
getLlamaSettings, saveLlamaSettings, getLlamaStatus
startLlamaServer, stopLlamaServer, listLlamaLocalModels
hfSearchGGUFModels, deleteLlamaModel, downloadLlamaModel

// Wormhole Pipeline
wormholeIngestContent, wormholeRunTranscription
wormholeRunSummarization, wormholeRunKeyTerms
wormholeRunWikiUpdate, wormholeGetStatus, wormholeGetDerivedArtifacts

// P2P/Hypercore
p2pCreateCore, p2pAppend, p2pRead, p2pGetLength

// Profile & Stats
getProfile, saveProfile, saveProfileImage, getSystemStats

// Streaming Events
onChatStream, onAudioTranscriptStream
```

---

## 2. Tauri v2 Architecture Overview

### 2.1 Key Architectural Differences

| Aspect | Electron | Tauri v2 |
|--------|----------|----------|
| **WebView** | Bundled Chromium | System WebView (Edge/WebKit/WebKitGTK) |
| **Backend Language** | Node.js/TypeScript | Rust (primary), with Swift/Kotlin for mobile plugins |
| **Bundle Size** | 150-200MB+ | 600KB-10MB |
| **IPC Model** | `ipcMain.handle` / `ipcRenderer.invoke` | `#[tauri::command]` + `invoke()` |
| **Security** | CSP + contextBridge | Capabilities + Permissions + CSP + Isolation |
| **Mobile** | Not supported | iOS + Android native |
| **Process Model** | Main + Renderer | Core (Rust) + WebView |

### 2.2 Tauri Command System

```rust
// Rust backend (src-tauri/src/commands.rs)
#[tauri::command]
async fn get_settings(store: tauri::State<'_, Store>) -> Result<Settings, String> {
    // Implementation
}

#[tauri::command]
async fn chat_with_gemini(
    message: String,
    history: Vec<ChatMessage>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    // Implementation using reqwest
}
```

```typescript
// Frontend (TypeScript)
import { invoke } from '@tauri-apps/api/core';

const settings = await invoke<Settings>('get_settings');
const response = await invoke<ChatResponse>('chat_with_gemini', {
  message: 'Hello',
  history: [],
  model: 'gemini-1.5-flash'
});
```

### 2.3 Event System for Streaming

```rust
// Rust backend - emitting events
use tauri::Emitter;

window.emit("chat-stream", ChatStreamPayload {
    provider: "gemini",
    delta: chunk,
    done: false,
});
```

```typescript
// Frontend - listening
import { listen } from '@tauri-apps/api/event';

await listen<ChatStreamPayload>('chat-stream', (event) => {
  appendToMessage(event.payload.delta);
});
```

---

## 3. Migration Strategy

### 3.1 Phased Approach

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 0: Foundation (Week 1-2)                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • Set up Tauri v2 project alongside existing Electron code    │
│  • Configure build system for dual-mode development            │
│  • Implement core Rust types matching TypeScript definitions   │
│  • Set up tauri-plugin-store for settings persistence          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Core Commands (Week 3-4)                              │
│  ─────────────────────────────────────────────────────────────  │
│  • Port settings IPC to Tauri commands                         │
│  • Implement AI provider commands (Gemini, OpenAI)             │
│  • Add streaming support via Tauri events                      │
│  • Configure capabilities and permissions                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Local AI & Shell (Week 5-6)                           │
│  ─────────────────────────────────────────────────────────────  │
│  • Integrate tauri-plugin-shell for llama.cpp spawning         │
│  • Port HuggingFace model search and download                  │
│  • Implement process lifecycle management in Rust              │
│  • File system operations via tauri-plugin-fs                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: P2P/Hypercore (Week 7-9)                              │
│  ─────────────────────────────────────────────────────────────  │
│  • Evaluate Rust Hypercore alternatives (Option A)             │
│  • Or implement Node.js sidecar pattern (Option B)             │
│  • Port card library and wiki storage logic                    │
│  • Implement swarm networking in Rust or sidecar               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: Wormhole Pipeline (Week 10-11)                        │
│  ─────────────────────────────────────────────────────────────  │
│  • Port content ingestion logic                                │
│  • Implement transcription, summarization, key-terms           │
│  • Port wiki update and artifact management                    │
│  • File handling and media processing                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: Polish & Mobile (Week 12-14)                          │
│  ─────────────────────────────────────────────────────────────  │
│  • Complete frontend adapter layer                             │
│  • Test and fix all features                                   │
│  • Configure iOS and Android targets                           │
│  • Optimize bundle size and performance                        │
│  • Security audit and capability hardening                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Frontend Compatibility Strategy

The React frontend is **90% reusable**. Key changes:

1. **API Abstraction Layer**

```typescript
// src/api/backend.ts - Unified abstraction
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const backend = {
  getSettings: () => invoke<Settings>('get_settings'),
  saveSettings: (s: Settings) => invoke<boolean>('save_settings', { settings: s }),
  chatWithGemini: (data: ChatRequest) => invoke<ChatResponse>('chat_with_gemini', data),
  // ... etc
};

export const events = {
  onChatStream: (callback: (payload: ChatStreamPayload) => void) => {
    return listen<ChatStreamPayload>('chat-stream', (e) => callback(e.payload));
  },
};
```

2. **Global Type Declaration Update**

```typescript
// src/types.d.ts - Updated for Tauri
declare global {
  interface Window {
    __TAURI__?: {
      core: { invoke: typeof invoke };
      event: { listen: typeof listen };
    };
  }
}
```

3. **Astro UXDS Compatibility**

Astro Web Components work identically in Tauri's WebView. No changes needed to:
- `src/astro/setupAstro.ts`
- Any `rux-*` component usage
- Tailwind CSS integration

---

## 4. Technical Deep-Dives

### 4.1 Rust Type Definitions

```rust
// src-tauri/src/types.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    pub gemini_key: String,
    pub openai_key: String,
    pub firebase_config: String,
    pub revid_key: String,
    pub wormhole: Option<WormholeSettings>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatRequest {
    pub message: String,
    pub history: Vec<ChatMessage>,
    pub model: Option<String>,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub provider: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LlamaSettings {
    pub server_path: String,
    pub models_dir: String,
    pub default_model: String,
    pub port: u16,
    pub auto_start: bool,
    pub favorites: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
pub struct LlamaStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub model: Option<String>,
    pub port: Option<u16>,
    pub last_error: Option<String>,
}
```

### 4.2 AI Provider Implementation (Gemini Example)

```rust
// src-tauri/src/commands/ai.rs
use reqwest::Client;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn chat_with_gemini(
    app: AppHandle,
    message: String,
    history: Vec<ChatMessage>,
    model: Option<String>,
    attachments: Option<Vec<Attachment>>,
) -> Result<ChatResponse, String> {
    let settings = get_settings_internal(&app)?;
    let api_key = settings.gemini_key;
    
    if api_key.is_empty() {
        return Err("Gemini API key not configured".into());
    }
    
    let model_name = model.unwrap_or_else(|| "gemini-1.5-flash".into());
    let client = Client::new();
    
    // Build request body
    let body = build_gemini_request(&message, &history, &attachments);
    
    // Stream response
    let response = client
        .post(format!(
            "https://generativelanguage.googleapis.com/v1/models/{}:streamGenerateContent?key={}",
            model_name, api_key
        ))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let mut full_content = String::new();
    let mut stream = response.bytes_stream();
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        let delta = parse_gemini_chunk(&chunk)?;
        
        full_content.push_str(&delta);
        
        // Emit streaming event
        app.emit("chat-stream", ChatStreamPayload {
            provider: "gemini".into(),
            delta,
            done: false,
            model: Some(model_name.clone()),
        }).ok();
    }
    
    // Emit completion
    app.emit("chat-stream", ChatStreamPayload {
        provider: "gemini".into(),
        delta: String::new(),
        done: true,
        model: Some(model_name.clone()),
    }).ok();
    
    Ok(ChatResponse {
        content: full_content,
        model: model_name,
        provider: "gemini".into(),
    })
}
```

### 4.3 P2P/Hypercore Strategy

**Challenge:** Hypercore is a Node.js library with no direct Rust equivalent.

**Option A: Rust Native Implementation**
- Use `hypercore-protocol-rs` (community crate, less mature)
- Implement core append-only log semantics in Rust
- Use `libp2p` for swarm networking
- **Pros:** Native performance, no sidecar overhead
- **Cons:** Significant development effort, potential compatibility issues

**Option B: Node.js Sidecar Pattern**
- Bundle a minimal Node.js binary (~30MB) as a sidecar
- Run Hypercore/Hyperswarm in the sidecar process
- Communicate via local HTTP or Unix sockets
- **Pros:** Reuse existing p2p.ts code, proven reliability
- **Cons:** Larger bundle, additional process management

**Option C: Hybrid with SQLite + Holepunch**
- Use SQLite (via `tauri-plugin-sql`) for local storage
- Defer network sync to future Holepunch Rust bindings
- **Pros:** Simpler initial implementation
- **Cons:** Loses real-time P2P until Rust bindings mature

**Recommendation:** Start with **Option C** for MVP, plan for **Option A** long-term.

```rust
// Interim solution using SQLite
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_cards_table",
            sql: r#"
                CREATE TABLE cards (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE wiki_entries (
                    term TEXT PRIMARY KEY,
                    definition TEXT,
                    sources TEXT,
                    created_at TEXT NOT NULL
                );
            "#,
            kind: MigrationKind::Up,
        },
    ]
}
```

### 4.4 Local AI (llama.cpp) Management

```rust
// src-tauri/src/commands/llama.rs
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri_plugin_shell::ShellExt;

pub struct LlamaManager {
    process: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
    status: Arc<Mutex<LlamaStatus>>,
}

#[tauri::command]
pub async fn start_llama_server(
    app: AppHandle,
    state: tauri::State<'_, LlamaManager>,
) -> Result<LlamaStatus, String> {
    let settings = get_llama_settings(&app)?;
    
    let shell = app.shell();
    let (mut rx, child) = shell
        .command(&settings.server_path)
        .args(["-m", &settings.default_model, "--port", &settings.port.to_string()])
        .spawn()
        .map_err(|e| e.to_string())?;
    
    // Store process handle
    {
        let mut proc = state.process.lock().await;
        *proc = Some(child);
    }
    
    // Update status
    let mut status = state.status.lock().await;
    *status = LlamaStatus {
        running: true,
        pid: Some(child.pid()),
        model: Some(settings.default_model),
        port: Some(settings.port),
        last_error: None,
    };
    
    Ok(status.clone())
}
```

### 4.5 Capabilities & Permissions Configuration

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for Hapa Node",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default",
    "fs:default",
    "dialog:default",
    "notification:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "llama-server",
          "cmd": "llama-server",
          "args": true,
          "sidecar": false
        }
      ]
    },
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://generativelanguage.googleapis.com/*" },
        { "url": "https://api.openai.com/*" },
        { "url": "https://huggingface.co/*" },
        { "url": "http://localhost:*" }
      ]
    }
  ]
}
```

---

## 5. Project Structure

```
hapa-tauri/
├── src/                          # React frontend (mostly unchanged)
│   ├── App.tsx
│   ├── main.tsx
│   ├── api/
│   │   └── backend.ts            # NEW: Tauri invoke wrapper
│   ├── astro/
│   ├── components/
│   ├── pages/
│   ├── types.d.ts
│   └── utils/
├── src-tauri/                    # NEW: Tauri Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   └── src/
│       ├── lib.rs                # Main entry, command registration
│       ├── types.rs              # Shared type definitions
│       ├── state.rs              # Application state management
│       └── commands/
│           ├── mod.rs
│           ├── settings.rs       # Settings commands
│           ├── ai.rs             # Gemini, OpenAI, Llama chat
│           ├── llama.rs          # Llama.cpp process management
│           ├── wormhole.rs       # Wormhole pipeline
│           ├── storage.rs        # Card library, wiki storage
│           └── profile.rs        # User profile, stats
├── public/                       # Static assets (icons, etc.)
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 6. Tauri Advantages for Hapa Node

### 6.1 Immediate Benefits

| Benefit | Impact | Details |
|---------|--------|--------|
| **Bundle Size** | 🟢 Critical | From ~150MB to <10MB (15x smaller) |
| **Memory Usage** | 🟢 High | ~50-100MB RAM vs 300-500MB with Electron |
| **Startup Time** | 🟢 High | Sub-second cold start vs 2-3 seconds |
| **Security** | 🟢 High | Rust memory safety, capability-based permissions |
| **Mobile Ready** | 🟢 Critical | iOS/Android from same codebase |

### 6.2 Strategic Advantages for Hapa Vision

#### 6.2.1 Mobile Node Expansion

With Tauri v2's mobile support, Hapa Node can extend to phones/tablets:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hapa Ecosystem                               │
├──────────────────┬──────────────────┬──────────────────────────┤
│  Desktop Node    │   Mobile Node    │   Edge Device            │
│  (macOS/Win/Lin) │   (iOS/Android)  │   (Future IoT)           │
├──────────────────┴──────────────────┴──────────────────────────┤
│                    Shared Rust Core                             │
│  • AI providers  • Wormhole pipeline  • P2P storage             │
└─────────────────────────────────────────────────────────────────┘
```

- **Sovereign Memory on Mobile:** Users carry their Hypercore-backed knowledge graph
- **Mobile AI:** On-device inference with llama.cpp for iOS (Metal) / Android (Vulkan)
- **Cross-Device Sync:** P2P replication between desktop and mobile nodes

#### 6.2.2 Enhanced Security for Sovereign Memory

Tauri's security model aligns with Hapa's sovereignty principles:

- **Capability-based permissions:** Explicit grants for file system, network, shell access
- **Content Security Policy:** Strict CSP enforcement by default
- **Isolation pattern:** Optional iframe isolation between frontend and IPC
- **No Node.js in renderer:** Eliminates entire classes of supply-chain attacks

#### 6.2.3 Edge Computing Potential

Rust backend enables deployment to resource-constrained environments:

- **Raspberry Pi / ARM devices:** Efficient native compilation
- **WebAssembly target:** Potential browser-only mode for cloud-free access
- **Embedded systems:** Future Hapa "nodes" in smart devices

### 6.3 Developer Experience Improvements

- **Hot Reload:** Frontend changes reflect instantly without full restart
- **Type Safety End-to-End:** Rust types match TypeScript via serde
- **Better Debugging:** Rust's error handling propagates cleanly to frontend
- **Plugin Ecosystem:** 25+ official plugins for common needs

---

## 7. Risk Assessment & Mitigation

### 7.1 Identified Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Hypercore Rust port complexity | High | High | Start with SQLite, async Rust port |
| WebView inconsistencies | Medium | Medium | Test on all platforms, use feature detection |
| Rust learning curve | Medium | Medium | Leverage TypeScript for logic, Rust for glue |
| Plugin availability | Low | Low | Core plugins cover 90% of needs |
| Mobile-specific UI issues | Medium | High | Responsive design, platform-specific testing |

### 7.2 Rollback Strategy

Maintain Electron version in parallel during migration:

```json
// package.json
{
  "scripts": {
    "dev:electron": "concurrently \"vite\" \"npm run electron\"",
    "dev:tauri": "tauri dev",
    "build:electron": "vite build && electron-builder",
    "build:tauri": "tauri build"
  }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests (Rust)

```rust
// src-tauri/src/commands/ai.rs
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_build_gemini_request() {
        let request = build_gemini_request(
            "Hello",
            &vec![],
            &None,
        );
        assert!(request.contents.len() > 0);
    }
    
    #[tokio::test]
    async fn test_chat_with_gemini_no_key() {
        // Should return error when no API key
    }
}
```

### 8.2 Integration Tests

```typescript
// tests/integration/settings.spec.ts
import { invoke } from '@tauri-apps/api/core';

describe('Settings', () => {
  it('should save and retrieve settings', async () => {
    const settings = { geminiKey: 'test', openaiKey: '', firebaseConfig: '', revidKey: '' };
    await invoke('save_settings', { settings });
    const retrieved = await invoke<Settings>('get_settings');
    expect(retrieved.geminiKey).toBe('test');
  });
});
```

### 8.3 E2E Tests

Use WebDriver for cross-platform E2E testing:

```typescript
// tests/e2e/chat.spec.ts
import { expect, test } from '@playwright/test';

test('chat flow', async ({ page }) => {
  await page.goto('tauri://localhost/');
  await page.fill('[data-testid="chat-input"]', 'Hello');
  await page.click('[data-testid="send-button"]');
  await expect(page.locator('[data-testid="message-0"]')).toBeVisible();
});
```

---

## 9. Estimated Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 0: Foundation** | 2 weeks | Tauri project setup, type definitions, store plugin |
| **Phase 1: Core Commands** | 2 weeks | Settings, AI providers with streaming |
| **Phase 2: Local AI** | 2 weeks | llama.cpp management, file operations |
| **Phase 3: P2P/Storage** | 3 weeks | SQLite storage, card library, wiki |
| **Phase 4: Wormhole** | 2 weeks | Full pipeline port |
| **Phase 5: Polish** | 3 weeks | Mobile targets, testing, optimization |
| **Total** | ~14 weeks | Production-ready Tauri app |

---

## 10. Future Opportunities

### 10.1 Enabled by Tauri Migration

1. **iOS/Android Native Apps**
   - Hapa Companion app for mobile knowledge capture
   - Voice memos → Wormhole pipeline on-device
   - Push notifications for P2P sync events

2. **Plugin Architecture**
   - Modular feature plugins (Revid, advanced AI, etc.)
   - Community-contributed extensions
   - Platform-specific optimizations (Metal, Vulkan)

3. **Distribution Improvements**
   - App store distribution (smaller size = faster downloads)
   - Auto-updater via `tauri-plugin-updater`
   - Delta updates for faster patches

4. **Edge Deployment**
   - Self-hosted Hapa nodes on personal servers
   - Raspberry Pi home nodes
   - WebAssembly for browser-based access

5. **Performance Optimizations**
   - Rust-native AI inference (candle, burn)
   - GPU acceleration via native APIs
   - SIMD optimizations for data processing

### 10.2 Long-Term Vision Alignment

Tauri positions Hapa Node for:

- **THN (The Hapa Network):** Efficient P2P nodes across all devices
- **Sovereign Memory:** Secure, portable, device-agnostic knowledge stores
- **AI Agent Ecosystem:** Lightweight agents running on diverse hardware
- **Infinite Sharpening:** High-performance content processing pipelines

---

## 11. Appendix

### A. Useful Resources

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Tauri Plugins Workspace](https://github.com/tauri-apps/plugins-workspace)
- [Tauri + React Template](https://github.com/tauri-apps/tauri/tree/dev/examples/api)
- [Rust async programming](https://rust-lang.github.io/async-book/)
- [Serde JSON serialization](https://serde.rs/)

### B. Plugin Mapping

| Electron Feature | Tauri Plugin |
|-----------------|---------------|
| electron-store | @tauri-apps/plugin-store |
| Node.js fs | @tauri-apps/plugin-fs |
| child_process | @tauri-apps/plugin-shell |
| dialog (open/save) | @tauri-apps/plugin-dialog |
| Notification | @tauri-apps/plugin-notification |
| HTTP client | @tauri-apps/plugin-http |
| Clipboard | @tauri-apps/plugin-clipboard-manager |
| Auto-updater | @tauri-apps/plugin-updater |

### C. Command Migration Checklist

- [ ] `getSettings` / `saveSettings`
- [ ] `listGeminiModels` / `listOpenAIModels` / `listLlamaModels`
- [ ] `chatWithGemini` / `chatWithOpenAI` / `chatWithLlama`
- [ ] `getLlamaSettings` / `saveLlamaSettings`
- [ ] `getLlamaStatus` / `startLlamaServer` / `stopLlamaServer`
- [ ] `listLlamaLocalModels` / `deleteLlamaModel` / `downloadLlamaModel`
- [ ] `hfSearchGGUFModels`
- [ ] `wormholeIngestContent`
- [ ] `wormholeRunTranscription` / `wormholeRunSummarization`
- [ ] `wormholeRunKeyTerms` / `wormholeRunWikiUpdate`
- [ ] `wormholeGetStatus` / `wormholeGetDerivedArtifacts`
- [ ] `p2pCreateCore` / `p2pAppend` / `p2pRead` / `p2pGetLength`
- [ ] `getProfile` / `saveProfile` / `saveProfileImage`
- [ ] `getSystemStats`
- [ ] Streaming events: `chat-stream`, `audio-transcript-stream`

---

*This document should be updated as the migration progresses and new insights emerge.*
