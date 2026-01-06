---
license: apache-2.0
library_name: mlx
tags:
- dllm
- diffusion
- llm
- text_generation
- mlx
pipeline_tag: text-generation
base_model: inclusionAI/LLaDA2.0-mini
---

# mlx-community/LLaDA2.0-mini-4bit

This model [mlx-community/LLaDA2.0-mini-4bit](https://huggingface.co/mlx-community/LLaDA2.0-mini-4bit) was
converted to MLX format from [inclusionAI/LLaDA2.0-mini](https://huggingface.co/inclusionAI/LLaDA2.0-mini)
using mlx-lm version **0.28.4**.

## Use with mlx

```bash
pip install mlx-lm
```

```python
from mlx_lm import load, generate

model, tokenizer = load("mlx-community/LLaDA2.0-mini-4bit")

prompt = "hello"

if tokenizer.chat_template is not None:
    messages = [{"role": "user", "content": prompt}]
    prompt = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True
    )

response = generate(model, tokenizer, prompt=prompt, verbose=True)
```
