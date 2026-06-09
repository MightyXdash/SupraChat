import os
import torch

MODEL_ID: str = os.getenv("SUPRA_MODEL_ID", "SupraLabs/Supra-50M-Instruct")
DEVICE: str = os.getenv("SUPRA_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")

# Use BF16 on Ampere+, FP16 otherwise, FP32 on CPU
def resolve_dtype() -> torch.dtype:
    if DEVICE == "cpu":
        return torch.float32
    if torch.cuda.is_available() and torch.cuda.get_device_capability()[0] >= 8:
        return torch.bfloat16
    return torch.float16

TORCH_DTYPE: torch.dtype = resolve_dtype()

# Generation defaults
MAX_NEW_TOKENS: int = int(os.getenv("SUPRA_MAX_NEW_TOKENS", "512"))
TEMPERATURE: float = float(os.getenv("SUPRA_TEMPERATURE", "0.7"))
TOP_P: float = float(os.getenv("SUPRA_TOP_P", "0.9"))
REPETITION_PENALTY: float = float(os.getenv("SUPRA_REP_PENALTY", "1.1"))

SYSTEM_PROMPT: str = (
    " "
    ""
  
)
# System Prompt makes the model trash, idk why
