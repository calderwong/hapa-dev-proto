# OpenAI Integration in Hapa AG

## 1. Overview

Hapa AG now supports **multi-provider chat** with:

- **Google Gemini** via the `@google/generative-ai` SDK (Electron main process IPC `chat-with-gemini`).
- **OpenAI Chat Completions API** via direct HTTPS calls (IPC `chat-with-openai`).

The Electron main process exposes both providers over a typed preload bridge (`window.electronAPI`), and the React chat UI lets you choose:

- **Provider family** – `Google Gemini` vs `OpenAI`.
- **Model per provider** – Gemini & OpenAI model lists are loaded at runtime via IPC.

This document is for maintainers and future agents working on Hapa AG.

---

## 2. Where things live

- **Electron main**: `electron/main.ts`
  - Settings IPC: `get-settings`, `save-settings` (includes `geminiKey`, `openaiKey`, `firebaseConfig`).
  - Admin settings IPC: `get-admin-settings`, `save-admin-settings`.
  - Models IPC: `list-gemini-models`, `list-openai-models`.
  - Chat IPC: `chat-with-gemini`, `chat-with-openai`.
  - Audio transcription helper: `transcribeAudioWithOpenAI` (Whisper).
- **Preload bridge**: `electron/preload.ts`
  - Exposes the above IPC methods as `window.electronAPI.*`.
- **Renderer types**: `src/types.d.ts`
  - `Settings`, `AudioMode`, `AdminSettings`, and `ElectronAPI` interfaces.
- **Settings UI**: `src/pages/Settings.tsx`
  - Handles configuration of Gemini + OpenAI keys.
- **Chat UI**: `src/pages/Chat.tsx`
  - Core multi-provider chat interface and attachment handling.
- **Admin UI**: `src/pages/Admin.tsx`
  - Gemini request log browser + admin audio-mode toggle.

---

## 3. Authentication & configuration

### 3.1 Settings storage

Electron uses `electron-store` as a local key–value store (`store` in `electron/main.ts`).

Keys used:

- `geminiKey` – Google Gemini API key.
- `openaiKey` – OpenAI API key.
- `firebaseConfig` – Firebase config JSON string.
- `adminSettings` – serialized `AdminSettings` object (currently only `audioMode`).

### 3.2 IPC: `get-settings` / `save-settings`

```ts
ipcMain.handle('get-settings', () => {
  return {
    geminiKey: store.get('geminiKey', ''),
    openaiKey: store.get('openaiKey', ''),
    firebaseConfig: store.get('firebaseConfig', ''),
  };
});

ipcMain.handle(
  'save-settings',
  (_event, settings: { geminiKey: string; openaiKey: string; firebaseConfig: string }) => {
    store.set('geminiKey', settings.geminiKey);
    store.set('openaiKey', settings.openaiKey);
    store.set('firebaseConfig', settings.firebaseConfig);
    return true;
  },
);
```

Renderer code (`Settings.tsx`) consumes these via `window.electronAPI.getSettings()` and `saveSettings(...)`.

### 3.3 API key security

- Keys are stored **only on the local machine** via `electron-store`.
- Keys are never sent to external services other than Gemini/OpenAI endpoints.
- The React renderer cannot see the raw keys directly; it only talks over the preload bridge.

You can change the storage strategy later if you want encryption-at-rest (e.g. wrapping `electron-store` with an encryption layer).

---

## 4. Model listing

### 4.1 Gemini models

IPC: `list-gemini-models` (Electron main)

- If `geminiKey` is missing:
  - Returns a static fallback list: `gemini-pro`, `gemini-1.5-flash-001`, `gemini-1.5-pro-001`.
- If `geminiKey` is present:
  - Calls `https://generativelanguage.googleapis.com/v1beta/models?key=<GEMINI_KEY>`.
  - Filters for `supportedGenerationMethods` including `generateContent`.
  - Maps each to `{ name, displayName, description }`.

### 4.2 OpenAI models

IPC: `list-openai-models` (Electron main)

- Currently returns a **static list** (key-aware but not calling `/v1/models` yet):

```ts
const listDefaultOpenAIModels = () => [
  { name: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini', description: 'Fast, lightweight model' },
  { name: 'gpt-4.1', displayName: 'GPT-4.1', description: 'General-purpose model' },
  { name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', description: 'Fast multimodal model' },
  { name: 'gpt-4o', displayName: 'GPT-4o', description: 'Multimodal flagship model' },
];
```

The Chat UI treats both providers uniformly (see below) and doesn’t know whether the list is static or dynamic.

---

## 5. Chat UI: multi-provider behavior

File: `src/pages/Chat.tsx`

### 5.1 Provider + model state

- `provider: 'gemini' | 'openai'` (default `'gemini'`), persisted under `defaultChatProvider` in `localStorage`.
- `geminiModels: ModelInfo[]`, `openaiModels: ModelInfo[]`.
- `selectedGeminiModel`, `selectedOpenAIModel`:
  - Stored in `defaultGeminiModel` and `defaultOpenAIModel` in `localStorage`.

### 5.2 Header UI

- Provider dropdown:
  - Options: `Google Gemini`, `OpenAI`.
  - On change, updates `provider` and persists it.
- Model dropdown:
  - Shows models for the currently selected provider.
  - Uses the stored model where possible, otherwise falls back to the first available model.

### 5.3 Message sending flow

When the user hits **Send**:

1. Gather `attachments` from file input / drag-and-drop (images, video, audio).
2. Construct a `Message`:`
   - `role: 'user'`, `content: input`, `attachments` for preview only.
3. Append the user message to `messages` state.
4. Build `history` for the backend:
   - `history = messages.map(m => ({ role: m.role, content: m.content }))`.
5. Build IPC payload:

```ts
const payload = {
  message: userMessage.content,
  history,                      // { role: 'user' | 'model'; content: string }[]
  model: modelName,             // provider-specific
  attachments: currentAttachments.map(att => ({
    mimeType: att.mimeType,
    data: att.base64,
  })),
};
```

6. Route based on provider:
   - If `provider === 'gemini'` → `window.electronAPI.chatWithGemini(payload)`.
   - If `provider === 'openai'` → `window.electronAPI.chatWithOpenAI(payload)`.
7. Append the returned string as a `role: 'model'` message.


---

## 6. OpenAI chat integration (Electron main)

### 6.1 Endpoints and constants

```ts
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TRANSCRIPT_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
```

### 6.2 Admin audio settings

Types:

```ts
type AudioMode = 'transcribe' | 'realtime';

interface AdminSettings {
  audioMode: AudioMode;
}
```

Helpers:

- `getAdminSettings()`
  - Reads from `adminSettings` key in `electron-store`.
  - Returns `{ audioMode: 'transcribe' | 'realtime' }`, defaulting to `'transcribe'`.
- `saveAdminSettings(settings: AdminSettings)`
  - Persists to `electron-store`.

IPC:

- `get-admin-settings` → `AdminSettings`
- `save-admin-settings` → normalizes audioMode and returns `true` on success.

Admin UI (`Admin.tsx`) exposes radio buttons for `Transcribe first` vs `Realtime (stub)`.

### 6.3 Audio transcription helper (Whisper)

```ts
const transcribeAudioWithOpenAI = async (
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<string> => {
  const buffer = Buffer.from(base64, 'base64');
  const blob = new Blob([buffer], { type: mimeType || 'audio/wav' });
  const formData = new FormData();
  const extension = mimeType.split('/')[1] || 'wav';
  formData.append('file', blob, `audio.${extension}`);
  formData.append('model', 'whisper-1');

  const response = await fetch(OPENAI_TRANSCRIPT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData as any,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('OpenAI transcription error:', data);
    throw new Error(data.error?.message || 'Failed to transcribe audio');
  }

  return (data.text as string) || '';
};
```

### 6.4 `chat-with-openai` IPC handler

Signature:

```ts
ipcMain.handle(
  'chat-with-openai',
  async (
    _event,
    {
      message,
      history,
      model: modelName,
      attachments,
    }: {
      message: string;
      history: { role: string; content: string }[];
      model?: string;
      attachments?: { mimeType: string; data: string }[];
    },
  ) => { /* ... */ },
);
```

Processing steps:

1. **API key check**:
   - Reads `openaiKey` from `electron-store`.
   - Throws if missing with a helpful message.
2. **Read admin audio mode**: `const adminSettings = getAdminSettings();`.
3. **Map history** to OpenAI roles:
   - `role === 'model'` → `assistant`, everything else → `user`.
4. **Partition attachments**:
   - `imageAttachments` (`mimeType.startsWith('image/')`).
   - `audioAttachments` (`mimeType.startsWith('audio/')`).
   - `videoAttachments` (`mimeType.startsWith('video/')`).
5. **Build `content`**:
   - Start with `content = message` (string) for simple text-only.
   - If there are any attachments:
     - Create `parts: any[] = []`.
     - For each image:
       ```ts
       parts.push({
         type: 'image_url',
         image_url: {
           url: `data:${att.mimeType};base64,${att.data}`,
         },
       });
       ```
     - For each audio attachment:
       - If `audioMode === 'realtime'`, log a warning and **fallback to transcription** for now.
       - Call `transcribeAudioWithOpenAI(...)` and collect transcripts.
     - Build `textContent`:
       - Start from `message`.
       - If there are transcripts, append:
         ```
         [Audio transcript]
         <combined transcripts>
         ```
       - If video attachments exist, append a note that video is attached but not directly consumed by OpenAI.
     - Push a text block:
       ```ts
       parts.push({ type: 'text', text: textContent });
       content = parts;
       ```
6. **Construct OpenAI payload**:

```ts
const openaiPayload = {
  model: modelName || 'gpt-4.1-mini',
  messages: [
    ...mappedHistory,
    {
      role: 'user',
      content,
    },
  ],
  temperature: 0.7,
};
```

7. **HTTP call**:
   - `POST` to `OPENAI_CHAT_ENDPOINT` with `Authorization: Bearer <openaiKey>` and JSON body.
   - On non-2xx, logs full error JSON and throws with `data.error?.message || 'OpenAI Error'`.
   - On success, returns `data.choices?.[0]?.message?.content ?? ''`.

This handler is strictly **non-streaming** for now; Hapa AG displays the full answer once it arrives.

---

## 7. Gemini integration (for comparison)

Gemini integration predates OpenAI in this app and is implemented via `@google/generative-ai`:

- IPC: `chat-with-gemini` in `electron/main.ts`.
- Uses `GoogleGenerativeAI(apiKey).getGenerativeModel({ model })` and `startChat({ history })`.
- Maps history to Gemini `contents` with `parts: [{ text }]`.
- Uses inlineData for attachments:
  - The renderer sends `attachments` as `{ mimeType, data }` (base64, no prefix).
  - Electron wraps them as:
    ```ts
    inlineData: { mimeType, data }
    ```
- Responses:
  - Tries to read `candidates[0].content.parts`.
  - Aggregates `part.text` as text and converts `inlineData` images into markdown `![image](data:mimeType;base64,data)` links for the renderer.

Gemini does not currently use the `audioMode` setting, but it’s easy to layer in a transcription step later if you add a suitable STT service.

---

## 8. Admin audio mode (UI + behavior)

- **Admin UI (`Admin.tsx`)**:
  - Loads settings via `window.electronAPI.getAdminSettings()`.
  - Renders:
    - Radio: `Transcribe first`.
    - Radio: `Realtime (stub)`.
  - When changed, calls `window.electronAPI.saveAdminSettings({ audioMode: mode })`.

- **Behavior today**:
  - `audioMode = 'transcribe'`:
    - All audio attachments for OpenAI go through Whisper transcription before being passed to Chat Completions.
  - `audioMode = 'realtime'`:
    - Currently logs a warning and **still transcribes**.
    - This is a deliberate stub hook for future integration with realtime OpenAI APIs.

---

## 9. How to use this in development

### 9.1 Configure API keys

1. Run the app: `npm run dev`.
2. Open the **Settings** page.
3. Enter your **Gemini API key** and **OpenAI API key**.
4. Save.

### 9.2 Chat with Gemini vs OpenAI

1. Open the **Chat** page.
2. Use the provider dropdown to pick **Google Gemini** or **OpenAI**.
3. Pick a model from the model dropdown.
4. Type a message and send.
5. Optionally attach images / audio / video:
   - Attachments are handled in a unified way in the renderer and converted to provider-specific formats in Electron.

### 9.3 Tuning audio mode

1. Open the **Admin** page.
2. Under **Admin Settings**, choose:
   - **Transcribe first** (default) – audio → text (Whisper) → normal chat.
   - **Realtime (stub)** – currently behaves like transcribe but is wired for future realtime support.

---

## 10. Future enhancements

Some directions you can take this integration next:

- **Streaming**: move from single-response Chat Completions to streaming SSE in Electron and incremental rendering in React.
- **Unified provider abstraction**: wrap Gemini + OpenAI behind a shared `ChatProvider` interface to better support future providers (e.g. local models, Vertex AI).
- **Realtime audio**: when appropriate OpenAI / Gemini realtime APIs are stable, replace the stubbed `realtime` mode with a true streaming audio/text channel.
- **Richer error handling**: normalize error shapes from Gemini and OpenAI so that the UI can offer consistent messaging (rate limits, invalid keys, etc.).
