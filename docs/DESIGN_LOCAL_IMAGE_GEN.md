# Design Document: Local Image Generation with Z-Image-Turbo

## 1. Objective
Enable "Local Image Generation" within the Hapa-AG application, specifically targeting the **Z-Image-Turbo** model as the default local option. This feature allows users to generate images using their local hardware (GPU) instead of external APIs, integrated seamlessly into the existing "One-Click" generation workflows.

## 2. Technical Architecture

### 2.1. Core Strategy: The Python Bridge
Unlike `llama.cpp` which provides a standalone binary server, `Z-Image-Turbo` (and most Diffusers models) runs best in a Python environment with PyTorch.
We will implement a **Python Bridge** pattern:
1.  **Electron Main**: Spawns a Python subprocess (`python server.py`).
2.  **Python Backend**: A lightweight server (FastAPI or distinct script) that:
    *   Loads models (Diffusers pipelines).
    *   Handles generation requests.
    *   Manages model downloads via `huggingface_hub`.
3.  **Communication**: IPC via HTTP (localhost port) or Stdio. HTTP is preferred for streaming progress and separating control/data.

### 2.2. New Settings Structure
We need to persist configuration for this new "Local Vision" engine.
`store.get('localVisionSettings')`:
```typescript
interface LocalVisionSettings {
  enabled: boolean;
  pythonPath: string; // Path to python executable (v3.10+)
  modelsDir: string; // Where to store HF cache/models
  activeModel: string; // Repo ID (e.g. 'Tongyi-MAI/Z-Image-Turbo')
  device: 'cuda' | 'mps' | 'cpu'; // Auto-detect preferred
  autoStart: boolean;
}
```

### 2.3. Model Management
*   **Discovery**: Reuse existing HF API search logic from Electron, but searching for `diffusers` tags instead of GGUF files.
*   **Downloading**: Delegate to the Python Backend.
    *   Electron sends: `POST /models/download { repo_id: "Tongyi-MAI/Z-Image-Turbo" }`
    *   Python uses `huggingface_hub.snapshot_download()`.
    *   Progress reported via Server-Sent Events (SSE) or WebSocket to Electron, then to Frontend.

## 3. Feature Requirements

### (1) Find/Download Local AI Model
*   **Search**: New "Local Vision" tab in settings or dedicated "Vision" page.
*   **Default**: Pre-populate "Tongyi-MAI/Z-Image-Turbo" as a recommended one-click install.
*   **Search Logic**: Filter HF models for `pipeline_tag: text-to-image`.

### (2) Run Model with Configurations
*   **Parameters**:
    *   Prompt (from LLM or User)
    *   Negative Prompt
    *   Steps (Turbo needs few, e.g., 4-8)
    *   Guidance Scale
    *   Seed
    *   Dimensions (1024x1024 for Z-Image)
*   **LoRA Support**:
    *   UI to select LoRA files (safetensors) from a `loras` directory.
    *   Python backend loads them into the pipeline.

### (3) Pipeline Integration
*   **Card Details**:
    *   Add "Image Gen Provider" selector: `Revid` | `DALL-E` | `Local (Z-Image)`.
    *   If Local is selected, the generation request is routed to the Python Bridge.

### (4) Default Behavior
*   "Set and Forget": Once Local is configured, it becomes a valid provider in the dropdowns.

## 4. UI/UX Design

### A. New Page: `Local Vision` (Settings/Management)
*   Similar to `LocalLlama.tsx` but distinct.
*   **Status Panel**: Python Bridge Status (Online/Offline), Active Model, GPU VRAM usage (if possible).
*   **Library**: List of downloaded Diffusers models.
*   **Config**: Python Path, Models Path.
*   **One-Click Setup**: "Install Z-Image-Turbo" button.

### B. Card Interface
*   In the "Generate Image" section:
    *   Dropdown for "Provider".
    *   If "Local" is selected:
        *   Show "Model" dropdown (listing downloaded models).
        *   Show "Speed/Quality" slider (Steps).

## 5. Implementation Plan

### Phase 1: The Python Backend
1.  Create `python/` directory in project root.
2.  Create `server.py`:
    *   `POST /generate`: Run txt2img.
    *   `POST /download`: Trigger HF download.
    *   `GET /status`: Health check.
3.  Create `requirements.txt`: `torch`, `diffusers`, `transformers`, `accelerate`, `huggingface_hub`, `fastapi`, `uvicorn`.

### Phase 2: Electron Integration
1.  Add `localVisionSettings` to `electron/main.ts`.
2.  Implement `spawnPythonServer` function.
3.  Add IPC handlers:
    *   `start-vision-server`, `stop-vision-server`.
    *   `generate-local-image`.
    *   `download-vision-model`.

### Phase 3: Frontend Management UI
1.  Create `src/pages/LocalVision.tsx`.
2.  Implement configuration and model management.
3.  Test downloading `Z-Image-Turbo`.

### Phase 4: Pipeline Integration
1.  Update `CardDetails` image generation logic to support the new provider.

## 6. Technical Notes: Z-Image-Turbo
*   **URL**: https://huggingface.co/Tongyi-MAI/Z-Image-Turbo
*   **Usage**:
    ```python
    from diffusers import AutoPipelineForTextToImage
    import torch

    pipe = AutoPipelineForTextToImage.from_pretrained(
        "Tongyi-MAI/Z-Image-Turbo",
        torch_dtype=torch.float16,
        variant="fp16"
    ).to("cuda")
    
    image = pipe(prompt="...", num_inference_steps=4, guidance_scale=1.5).images[0]
    ```
*   **Requirements**: CUDA capable GPU recommended.

## 7. Implementation Log
*   [x] Created Design Doc
*   [x] Created Python Server Scaffolding (`python/server.py` & `python/requirements.txt`)
*   [ ] Integrated Electron IPC
*   [ ] Created Frontend UI
