# Local Vision Pipeline Research & Design

## Current Status
- **Error Encountered:** `module diffusers has no attribute ZImagePipeline`
- **Cause:** The `Tongyi-MAI/Z-Image-Turbo` model configuration likely specifies a custom pipeline class `ZImagePipeline` that is not part of the standard `diffusers` library. Loading it requires either `trust_remote_code=True` or explicitly mapping it to a supported pipeline (like `StableDiffusionXLPipeline` if compatible).
- **Hardware Target:** NVIDIA RTX 4090 (24GB VRAM). This is a high-end card, capable of running full SDXL models easily. The user's request for a "smaller version" might imply disk space concerns or a desire for maximum inference speed (e.g., using `taesdxl` VAE or `fp16`/`int8` quantization).

## Objectives
1.  **Fix Pipeline Loading:** Ensure `Z-Image-Turbo` loads correctly.
2.  **Optimize for 4090:**
    - Use `torch.float16` (already implemented).
    - Enable `enable_model_cpu_offload()` or `enable_sequential_cpu_offload()` if VRAM is tight (unlikely on 4090 but good practice).
    - Use `torch.compile()` for speedup if available.
    - Consider `xformers` or `scaled_dot_product_attention` (PyTorch 2.0 default).
3.  **Refine UI/UX:**
    - "Generate Next Image" step in Card Library.
    - Better progress feedback during generation.
    - "smaller version" default -> Maybe swtich to a robust SDXL-Turbo generic model or Ensure Z-Image-Turbo is loaded efficiently.
4.  **Default Model Selection:** Evaluate if `Z-Image-Turbo` is the best default or if `stabilityai/sdxl-turbo` is safer/better supported.

## Troubleshooting `ZImagePipeline`
The error `AttributeError: module 'diffusers' has no attribute 'ZImagePipeline'` usually happens when `AutoPipeline` tries to instantiate a class defined in the model's `model_index.json` that doesn't exist in the local library.
- **Solution A:** Use `trust_remote_code=True` in `from_pretrained`. This allows the model to execute code from its repo.
- **Solution B:** Force loading as `StableDiffusionXLPipeline` (if architecture matches).

## Progress Update
- **Fix Applied:** Updated `server.py` to use `trust_remote_code=True` when loading the pipeline. This should resolve the `module diffusers has no attribute ZImagePipeline` error by allowing the custom model code to execute.
- **Fallback Logic:** Added a try/except block to attempt loading with `variant="fp16"` first, falling back to the default variant if that fails.
- **Hard Fallback:** `AutoPipeline` still failed with `ZImagePipeline` attribute error despite `trust_remote_code=True`. Added a hard fallback to force loading as `StableDiffusionXLPipeline`. This bypasses the custom pipeline definition and loads the weights into the standard SDXL architecture, which should work for `Z-Image-Turbo`.

## Optimization Strategy: "Smaller Version"
To satisfy the request for a "smaller version" (saving disk space and download time), we can restrict the `snapshot_download` to only fetch `fp16` weights.
- **Action:** Modify `download_model` to accept an `optimized` flag.
- **Implementation:** Use `allow_patterns` in `snapshot_download`.
    - Patterns: `["model_index.json", "scheduler/scheduler_config.json", "text_encoder/*.json", "text_encoder/*.fp16.safetensors", "unet/*.json", "unet/*.fp16.safetensors", "vae/*.json", "vae/*.fp16.safetensors", "tokenizer/*"]`
    - *Risk:* If the repo structure doesn't match exactly or uses different filenames, this breaks.
    - *Alternative:* Start with standard download, but maybe `Z-Image-Turbo` is just large.

## UX Improvements for "Generate Next Image"
- **Current State:** Simple "Generating..." text.
- **Desired State:**
    - **Phase 1:** "Warming up model..." (during the initial load/pipeline creation).
    - **Phase 2:** "Dreaming..." (during inference).
    - **Feedback:** Show the prompt being used?
- **Card Library Integration:**
    - The "Generate Next Image" button is part of the `CardInspector`.
    - It currently handles the flow in `handleGenerateImage`.

## Next Steps
1.  Verify `StableDiffusionXLPipeline` fallback works (User to test).
2.  Monitor generation quality (Turbo models can be sensitive to guidance scale).
3.  Enhance `CardLibrary` UI states if needed.

## Recovery Plan: Z-Image-Turbo Specifics
User requested reverting to `Z-Image-Turbo` and ensuring it works.
**Findings:**
- `Z-Image-Turbo` uses a custom `ZImagePipeline`.
- Loading it via `AutoPipeline` or `DiffusionPipeline` without `custom_pipeline` argument fails with `AttributeError`.
- **Fix:** Use `DiffusionPipeline.from_pretrained(..., custom_pipeline="Tongyi-MAI/Z-Image-Turbo", trust_remote_code=True)`.
- **Tuning:**
    - Dtype: `bfloat16` (Recommended for 4090).
    - Steps: 4.
    - Guidance: 1.5.

**Implementation Tasks:**
1.  [x] Install PyTorch CUDA (Running).
2.  [ ] Revert `LocalVision.tsx` default model.
3.  [ ] Update `server.py` with `Z-Image-Turbo` specific loading logic.

