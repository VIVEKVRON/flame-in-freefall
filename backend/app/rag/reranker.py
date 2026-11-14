"""Stage 2 Cross-Encoder Reranking via lazy-loaded Qwen/Qwen3-Reranker-0.6B causal LM."""

from __future__ import annotations

import logging
import math
import os
import threading
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

logger = logging.getLogger(__name__)

DEFAULT_TASK_INSTRUCTION = (
    "Given a microgravity combustion query and mission environment, retrieve NASA PSI "
    "experiment records detailing flammability limits, ignition energy, and flame spread."
)


class Qwen3Reranker:
    """
    Lazy-loaded Qwen/Qwen3-Reranker-0.6B scorer using CausalLM yes/no token logits.
    Delays 1.2 GB model initialization until the first query arrives.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._tokenizer: Any = None
        self._model: Any = None
        self._token_false_id: int | None = None
        self._token_true_id: int | None = None
        self._prefix_tokens: list[int] = []
        self._suffix_tokens: list[int] = []
        self._device: str = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_name = os.getenv("RERANKER_MODEL", "Qwen/Qwen3-Reranker-0.6B")
        self.max_length = 2048

    def _ensure_loaded(self) -> None:
        if self._model is not None and self._tokenizer is not None:
            return

        with self._lock:
            if self._model is not None and self._tokenizer is not None:
                return

            logger.info(
                "Lazy-loading Qwen3 reranker '%s' on device=%s...",
                self.model_name,
                self._device,
            )
            tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                padding_side="left",
            )
            dtype = torch.float16 if self._device == "cuda" else torch.float32
            model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=dtype,
            ).to(self._device)
            model.eval()

            prefix = (
                "<|im_start|>system\n"
                "Judge whether the Document meets the requirements based on the Query and the "
                'Instruct provided. Note that the answer can only be "yes" or "no".'
                "<|im_end|>\n<|im_start|>user\n"
            )
            suffix = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"

            self._prefix_tokens = tokenizer.encode(prefix, add_special_tokens=False)
            self._suffix_tokens = tokenizer.encode(suffix, add_special_tokens=False)
            self._token_false_id = tokenizer.convert_tokens_to_ids("no")
            self._token_true_id = tokenizer.convert_tokens_to_ids("yes")
            self._tokenizer = tokenizer
            self._model = model
            logger.info("Qwen3 reranker ready.")

    def _format_pair(self, instruction: str, query: str, document: str) -> str:
        return f"<Instruct>: {instruction}\n<Query>: {query}\n<Document>: {document}"

    def _score_pairs(self, pairs: list[str]) -> list[float]:
        self._ensure_loaded()
        assert self._tokenizer is not None
        assert self._model is not None
        assert self._token_false_id is not None
        assert self._token_true_id is not None

        max_body_len = self.max_length - len(self._prefix_tokens) - len(self._suffix_tokens)
        tokenized = self._tokenizer(
            pairs,
            padding=False,
            truncation="longest_first",
            return_attention_mask=False,
            max_length=max_body_len,
        )

        input_ids_list: list[list[int]] = []
        for seq in tokenized["input_ids"]:
            input_ids_list.append(self._prefix_tokens + seq + self._suffix_tokens)

        padded = self._tokenizer.pad(
            {"input_ids": input_ids_list},
            padding=True,
            return_tensors="pt",
        )
        inputs = {k: v.to(self._device) for k, v in padded.items()}

        with torch.no_grad():
            outputs = self._model(**inputs)
            last_logits = outputs.logits[:, -1, :]
            false_logits = last_logits[:, self._token_false_id]
            true_logits = last_logits[:, self._token_true_id]
            stacked = torch.stack([false_logits, true_logits], dim=1)
            probs = torch.nn.functional.log_softmax(stacked, dim=1)[:, 1].exp()
            return [round(float(p), 4) for p in probs.detach().cpu().tolist()]

    def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_n: int = 3,
        environment: str | None = None,
    ) -> tuple[list[dict[str, Any]], bool]:
        """
        Stage 2 Reranking: score up to 10 Qdrant candidates with Qwen3-Reranker-0.6B
        and return the top `top_n` ranked contexts plus a flag indicating whether Qwen3 ran.
        """
        if not candidates:
            return [], False

        env_hint = f" Target mission environment: {environment}." if environment else ""
        instruction = f"{DEFAULT_TASK_INSTRUCTION}{env_hint}"

        pairs = [
            self._format_pair(
                instruction,
                query,
                f"[{doc.get('experiment', '')} | {doc.get('environmentLabel', '')}] "
                f"{doc.get('text', '')}",
            )
            for doc in candidates
        ]

        try:
            scores = self._score_pairs(pairs)
            reranked: list[dict[str, Any]] = []
            for doc, score in zip(candidates, scores):
                enriched = dict(doc)
                enriched["rerankScore"] = score
                reranked.append(enriched)

            reranked.sort(key=lambda item: item["rerankScore"], reverse=True)
            return reranked[:top_n], True
        except Exception as exc:  # pragma: no cover - defensive offline/OOM fallback
            logger.exception(
                "Qwen3 reranker unavailable (%s); falling back to bi-encoder order.", exc
            )
            fallback: list[dict[str, Any]] = []
            for doc in candidates[:top_n]:
                enriched = dict(doc)
                raw = float(doc.get("biEncoderScore", 0.5))
                enriched["rerankScore"] = round(max(0.0, min(1.0, 1 / (1 + math.exp(-raw)))), 4)
                fallback.append(enriched)
            return fallback, False


QwenReranker = Qwen3Reranker
qwen3_reranker = QwenReranker()
