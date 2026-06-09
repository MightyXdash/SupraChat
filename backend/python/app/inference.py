from __future__ import annotations

from dataclasses import dataclass, field

import torch

import config
import model as _model_mod
import tokenizer as _tok_mod


@dataclass
class GenerationParams:
    max_new_tokens: int = config.MAX_NEW_TOKENS
    temperature: float = config.TEMPERATURE
    top_p: float = config.TOP_P
    repetition_penalty: float = config.REPETITION_PENALTY


class SupraInference:
    """
    Reusable inference engine.
    Instantiate once; call generate() from terminal or HTTP handlers.
    """

    def __init__(self) -> None:
        self._model = _model_mod.get_model()
        self._tok = _tok_mod.get_tokenizer()

    def generate(
        self,
        history: list[dict[str, str]],
        params: GenerationParams | None = None,
    ) -> str:
        if params is None:
            params = GenerationParams()

        prompt = _tok_mod.build_prompt(history)

        inputs = self._tok(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048,
        ).to(config.DEVICE)

        input_len = inputs["input_ids"].shape[-1]

        with torch.inference_mode():
            output_ids = self._model.generate(
                **inputs,
                max_new_tokens=params.max_new_tokens,
                temperature=params.temperature,
                top_p=params.top_p,
                repetition_penalty=params.repetition_penalty,
                do_sample=params.temperature > 0,
                use_cache=True,          # KV cache
                pad_token_id=self._tok.pad_token_id,
                eos_token_id=self._tok.eos_token_id,
            )

        # Decode only newly generated tokens
        new_ids = output_ids[0, input_len:]
        response = self._tok.decode(new_ids, skip_special_tokens=True)
        return response.strip()
