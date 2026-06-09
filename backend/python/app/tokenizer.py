from __future__ import annotations

from transformers import AutoTokenizer, PreTrainedTokenizerBase

import config


_tokenizer: PreTrainedTokenizerBase | None = None


def get_tokenizer() -> PreTrainedTokenizerBase:
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = AutoTokenizer.from_pretrained(
            config.MODEL_ID,
            use_fast=True,
        )
        if _tokenizer.pad_token_id is None:
            _tokenizer.pad_token_id = _tokenizer.eos_token_id
    return _tokenizer


def build_prompt(history: list[dict[str, str]]) -> str:
    """Apply chat template if available, fallback to manual format."""
    tok = get_tokenizer()
    messages = [{"role": "system", "content": config.SYSTEM_PROMPT}] + history
    if hasattr(tok, "apply_chat_template") and tok.chat_template:
        return tok.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    # Manual fallback (instruction-tuned models without a template)
    parts: list[str] = [f"System: {config.SYSTEM_PROMPT}\n"]
    for msg in history:
        role = "User" if msg["role"] == "user" else "Assistant"
        parts.append(f"{role}: {msg['content']}\n")
    parts.append("Assistant:")
    return "".join(parts)
