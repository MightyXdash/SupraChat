from __future__ import annotations

import torch
from transformers import AutoModelForCausalLM, PreTrainedModel

import config


_model: PreTrainedModel | None = None


def get_model() -> PreTrainedModel:
    global _model
    if _model is None:
        print(f"[supra] loading {config.MODEL_ID} on {config.DEVICE} ({config.TORCH_DTYPE})")
        _model = AutoModelForCausalLM.from_pretrained(
            config.MODEL_ID,
            torch_dtype=config.TORCH_DTYPE,
            device_map=config.DEVICE,
            low_cpu_mem_usage=True,
        )
        _model.eval()
        # Compile for extra speed on PyTorch 2.x (skip on CPU / MPS)
        if config.DEVICE not in ("cpu", "mps"):
            try:
                _model = torch.compile(_model, mode="reduce-overhead")
            except Exception:
                pass  # torch.compile optional
    return _model
