import sys
import os
import logging
import asyncio
from typing import Optional, List
from pydantic import BaseModel

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import torch
try:
    from diffusers import AutoPipelineForTextToImage, DiffusionPipeline, StableDiffusionXLPipeline
except ImportError:
    # Fallback for older diffusers versions
    from diffusers import DiffusionPipeline as AutoPipelineForTextToImage
    from diffusers import DiffusionPipeline
    try:
        from diffusers import StableDiffusionXLPipeline
    except ImportError:
        StableDiffusionXLPipeline = None
from huggingface_hub import snapshot_download, scan_cache_dir

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("hapa-vision")

app = FastAPI(title="Hapa Vision Bridge")

# --- Diagnostics ---
import sys
logger.info(f"Python Executable: {sys.executable}")
logger.info(f"Torch Version: {torch.__version__}")
try:
    import diffusers
    logger.info(f"Diffusers Version: {diffusers.__version__}")
except ImportError:
    logger.error("Diffusers not found")

if torch.cuda.is_available():
    logger.info(f"CUDA Available: True. Version: {torch.version.cuda}")
    logger.info(f"Device Count: {torch.cuda.device_count()}")
    logger.info(f"Current Device: {torch.cuda.get_device_name(0)}")
else:
    logger.warning("CUDA NOT AVAILABLE. Running on CPU. This will be very slow.")
    logger.warning("Please install PyTorch with CUDA support.")
    logger.info(f"Torch version detected: {torch.__version__}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global State ---
current_pipeline = None
current_model_id = None
device = "cuda" if torch.cuda.is_available() else "cpu"
if torch.backends.mps.is_available():
    device = "mps"

logger.info(f"Inference device determined as: {device}")

# --- Data Models ---

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    model_id: str = "Tongyi-MAI/Z-Image-Turbo"
    cache_dir: Optional[str] = None
    num_inference_steps: int = 4
    guidance_scale: float = 1.5
    width: int = 1024
    height: int = 1024
    seed: Optional[int] = None
    num_images: int = 1

class DownloadRequest(BaseModel):
    repo_id: str
    cache_dir: Optional[str] = None

class ModelInfo(BaseModel):
    repo_id: str
    size: str
    cached: bool

# --- Helper Functions ---

def load_pipeline(model_id: str, cache_dir: Optional[str] = None):
    global current_pipeline, current_model_id
    
    if current_pipeline is not None and current_model_id == model_id:
        return current_pipeline
        
    logger.info(f"Loading pipeline for {model_id}...")
    
    try:
        # Determine model path
        model_path = model_id
        if cache_dir:
            # Check for local_dir structure (repo_id with -- instead of /)
            local_model_name = model_id.replace("/", "--")
            potential_path = os.path.join(cache_dir, local_model_name)
            if os.path.exists(potential_path):
                logger.info(f"Found local model at {potential_path}")
                model_path = potential_path
        
        # Use float16 for GPU, float32 for CPU
        torch_dtype = torch.float16 if device != "cpu" else torch.float32
        
        # Optimized dtype for 4090 if available
        if device == "cuda" and torch.cuda.is_bf16_supported():
            torch_dtype = torch.bfloat16
            logger.info("Using bfloat16 for optimal performance")

        variant = "fp16" if device != "cpu" and torch_dtype == torch.float16 else None
        
        logger.info(f"Using device: {device}, dtype: {torch_dtype}, variant: {variant}")

        # We try to load safely
        try:
            pipe = AutoPipelineForTextToImage.from_pretrained(
                model_path,
                torch_dtype=torch_dtype,
                variant=variant,
                trust_remote_code=True
            )
        except Exception as e:
            logger.warning(f"Failed to load with variant={variant}: {e}. Trying default...")
            try:
                pipe = AutoPipelineForTextToImage.from_pretrained(
                    model_path,
                    torch_dtype=torch_dtype,
                    trust_remote_code=True
                )
            except Exception as e2:
                logger.warning(f"AutoPipeline failed: {e2}. Trying DiffusionPipeline...")
                # Try generic DiffusionPipeline which is more robust for custom code
                try:
                    pipe = DiffusionPipeline.from_pretrained(
                        model_path,
                        torch_dtype=torch_dtype,
                        trust_remote_code=True,
                        variant=variant
                    )
                except Exception as e3:
                     # Last ditch: Try without variant in DiffusionPipeline
                    logger.warning(f"DiffusionPipeline (variant) failed: {e3}. Trying without variant...")
                    pipe = DiffusionPipeline.from_pretrained(
                        model_path,
                        torch_dtype=torch_dtype,
                        trust_remote_code=True
                    )
        
        pipe.to(device)
        current_pipeline = pipe
        current_model_id = model_id
        logger.info(f"Pipeline loaded successfully on {device}")
        return pipe
    except Exception as e:
        logger.error(f"Failed to load pipeline: {e}")
        raise e

# --- Routes ---

@app.get("/status")
async def get_status():
    return {
        "status": "online",
        "device": device,
        "loaded_model": current_model_id,
        "gpu_name": torch.cuda.get_device_name(0) if device == "cuda" else "N/A"
    }

@app.post("/generate")
async def generate_image(req: GenerateRequest):
    global current_pipeline
    
    try:
        pipe = load_pipeline(req.model_id, req.cache_dir)
        
        generator = None
        if req.seed is not None and req.seed != -1:
            generator = torch.Generator(device=device).manual_seed(req.seed)
            
        logger.info(f"Generating image with prompt: {req.prompt}")
        
        result = pipe(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            num_inference_steps=req.num_inference_steps,
            guidance_scale=req.guidance_scale,
            width=req.width,
            height=req.height,
            num_images_per_prompt=1, # Supporting batch=1 for now to keep it simple
            generator=generator
        )
        
        # Convert to base64
        import io
        import base64
        
        generated_images = []
        for img in result.images:
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            generated_images.append(img_str)
            
        return {"images": generated_images}
        
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/download")
async def download_model(req: DownloadRequest, background_tasks: BackgroundTasks):
    def _download_task(repo_id, cache_dir, variant):
        logger.info(f"Starting download for {repo_id} (variant={variant})")
        try:
            kwargs = {}
            if cache_dir:
                # Use local_dir with symlinks disabled to avoid WinError 1314
                local_name = repo_id.replace("/", "--")
                local_path = os.path.join(cache_dir, local_name)
                kwargs['local_dir'] = local_path
                kwargs['local_dir_use_symlinks'] = False
                logger.info(f"Downloading to local dir: {local_path}")
            
            if variant == "fp16":
                # Optimized download patterns for SDXL/SD models
                kwargs['allow_patterns'] = [
                    "model_index.json",
                    "*.json",
                    "*.txt",
                    "*.fp16.safetensors",
                    "scheduler/*",
                    "text_encoder/*.json",
                    "text_encoder/*.fp16.safetensors",
                    "text_encoder_2/*.json",
                    "text_encoder_2/*.fp16.safetensors",
                    "unet/*.json",
                    "unet/*.fp16.safetensors",
                    "vae/*.json",
                    "vae/*.fp16.safetensors",
                    "tokenizer/*",
                    "tokenizer_2/*"
                ]
                logger.info("Using optimized fp16 download patterns")

            snapshot_download(repo_id=repo_id, **kwargs)
            logger.info(f"Download complete for {repo_id}")
        except Exception as e:
            logger.error(f"Download failed for {repo_id}: {e}")

    background_tasks.add_task(_download_task, req.repo_id, req.cache_dir, req.variant)
    return {"status": "download_started", "repo_id": req.repo_id}

@app.get("/models")
async def list_models(cache_dir: Optional[str] = None):
    # Scan HF cache to find downloaded models
    models = []
    
    logger.info(f"List models request. Cache dir: {cache_dir}")
    
    # 1. Scan local_dir based cache if provided
    if cache_dir and os.path.exists(cache_dir):
        try:
            logger.info(f"Scanning local dir: {cache_dir}")
            items = os.listdir(cache_dir)
            logger.info(f"Found items: {items}")
            
            for item in items:
                item_path = os.path.join(cache_dir, item)
                # Look for folders that resemble repo IDs (with --)
                if os.path.isdir(item_path) and "--" in item:
                    logger.info(f"Found model directory: {item}")
                    # Simple size calculation
                    total_size = 0
                    for dirpath, dirnames, filenames in os.walk(item_path):
                        for f in filenames:
                            fp = os.path.join(dirpath, f)
                            if not os.path.islink(fp):
                                total_size += os.path.getsize(fp)
                    
                    size_str = f"{total_size / (1024*1024*1024):.2f} GB"
                    repo_id = item.replace("models--", "").replace("--", "/") # Fix parsing logic
                    
                    # Check if already added (avoid duplicates if mixed scanning)
                    if not any(m["repo_id"] == repo_id for m in models):
                        models.append({
                            "repo_id": repo_id,
                            "size": size_str,
                            "cached": True
                        })
        except Exception as e:
            logger.error(f"Failed to scan local cache dir: {e}")
    elif cache_dir:
        logger.warning(f"Cache dir provided but does not exist: {cache_dir}")

    # 2. Scan default HF cache (fallback/addition)
    try:
        hf_cache_info = scan_cache_dir()
        for repo in hf_cache_info.repos:
            if repo.repo_type == "model":
                # Check if already added
                if any(m["repo_id"] == repo.repo_id for m in models):
                    continue
                    
                # Calculate size
                size = sum(rev.size_on_disk for rev in repo.revisions)
                size_str = f"{size / (1024*1024*1024):.2f} GB"
                models.append({
                    "repo_id": repo.repo_id,
                    "size": size_str,
                    "cached": True
                })
    except Exception as e:
        logger.error(f"Failed to scan default model cache: {e}")
        
    return models

if __name__ == "__main__":
    # Allow port to be configured via env var, default to 11435 (random-ish port for Hapa Vision)
    port = int(os.getenv("HAPA_VISION_PORT", 11435))
    uvicorn.run(app, host="127.0.0.1", port=port)
