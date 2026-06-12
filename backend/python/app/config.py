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

def load_system_prompt() -> str:
    possible_paths = [
        # relative to config.py (backend/python/app/config.py) -> 4 levels up
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "sys_prompt.md"),
        # current working directory
        "sys_prompt.md",
    ]
    for path in possible_paths:
        normalized = os.path.abspath(path)
        if os.path.exists(normalized):
            try:
                with open(normalized, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        return content
            except Exception:
                pass
    return "You are a helpful, precise, and composed AI assistant."

def __getattr__(name: str):
    if name == "SYSTEM_PROMPT":
        return load_system_prompt()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

