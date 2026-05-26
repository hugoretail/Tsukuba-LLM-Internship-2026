from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Dict, Tuple, Optional
import math
import re

import sacrebleu


LATIN_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]")
JP_RE = re.compile(r"[\u3040-\u30ff\u4e00-\u9faf]")
PUNCT_RE = re.compile(r"[^\w\u3040-\u30ff\u4e00-\u9faf]+", re.UNICODE)


@dataclass
class SampleMetrics:
    bleu: float
    chrf: float
    rouge_l: float
    language_ok: bool
    copied_source: bool
    line_count_match: bool
    length_ratio: float


def _normalize(text: str) -> str:
    lowered = text.strip().lower()
    return PUNCT_RE.sub("", lowered)


def _split_tokens(text: str, use_char_level: bool) -> List[str]:
    if use_char_level:
        return list(text.strip())
    return [t for t in text.strip().split() if t]


def _lcs_len(a: List[str], b: List[str]) -> int:
    if not a or not b:
        return 0
    dp = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        prev = 0
        for j in range(1, len(b) + 1):
            tmp = dp[j]
            if a[i - 1] == b[j - 1]:
                dp[j] = prev + 1
            else:
                dp[j] = max(dp[j], dp[j - 1])
            prev = tmp
    return dp[-1]


def rouge_l(hyp: str, ref: str, use_char_level: bool) -> float:
    hyp_tokens = _split_tokens(hyp, use_char_level)
    ref_tokens = _split_tokens(ref, use_char_level)
    if not hyp_tokens or not ref_tokens:
        return 0.0
    lcs = _lcs_len(hyp_tokens, ref_tokens)
    prec = lcs / max(len(hyp_tokens), 1)
    rec = lcs / max(len(ref_tokens), 1)
    if prec + rec == 0:
        return 0.0
    return (2 * prec * rec) / (prec + rec)


def language_ok(text: str, direction: str) -> bool:
    if direction == "fr-ja":
        return bool(JP_RE.search(text))
    return bool(LATIN_RE.search(text))


def ui_language_ok(text: str, ui_lang: str) -> bool:
    if not text.strip():
        return False
    if ui_lang == "fr":
        return bool(LATIN_RE.search(text)) and not bool(JP_RE.search(text))
    return bool(JP_RE.search(text))


def list_language_ok(items: Iterable[str], ui_lang: str) -> bool:
    filtered = [item for item in items if item.strip()]
    if not filtered:
        return False
    return all(ui_language_ok(item, ui_lang) for item in filtered)


def grammar_language_ok(grammar: Iterable[Dict[str, str]], ui_lang: str) -> bool:
    entries = list(grammar)
    if not entries:
        return False
    for entry in entries:
        name = str(entry.get("name", ""))
        explanation = str(entry.get("explanation", ""))
        if not ui_language_ok(name, ui_lang) or not ui_language_ok(explanation, ui_lang):
            return False
    return True


def keyword_coverage(text: str, keywords: Iterable[str]) -> Optional[float]:
    keywords_list = [k.strip() for k in keywords if k and str(k).strip()]
    if not keywords_list:
        return None
    haystack = text
    hits = 0
    for key in keywords_list:
        if JP_RE.search(key):
            if key in haystack:
                hits += 1
        else:
            if key.lower() in haystack.lower():
                hits += 1
    return hits / max(len(keywords_list), 1)


def line_count_match(source: str, hyp: str) -> bool:
    return len(source.replace("\r\n", "\n").split("\n")) == len(hyp.replace("\r\n", "\n").split("\n"))


def length_ratio(hyp: str, ref: str) -> float:
    denom = max(len(ref), 1)
    return len(hyp) / denom


def copied_source(source: str, hyp: str) -> bool:
    return _normalize(source) == _normalize(hyp)


def compute_metrics(
    sources: Iterable[str],
    hyps: Iterable[str],
    refs: Iterable[str],
    directions: Iterable[str],
) -> Tuple[List[SampleMetrics], Dict[str, float]]:
    sources_list = list(sources)
    hyps_list = list(hyps)
    refs_list = list(refs)
    directions_list = list(directions)

    bleu = sacrebleu.corpus_bleu(hyps_list, [refs_list]).score
    chrf = sacrebleu.corpus_chrf(hyps_list, [refs_list]).score

    rouge_scores = []
    sample_metrics: List[SampleMetrics] = []

    for source, hyp, ref, direction in zip(sources_list, hyps_list, refs_list, directions_list):
        use_char = direction == "fr-ja"
        rouge = rouge_l(hyp, ref, use_char_level=use_char)
        rouge_scores.append(rouge)
        sent_bleu = sacrebleu.sentence_bleu(hyp, [ref]).score
        sent_chrf = sacrebleu.sentence_chrf(hyp, [ref]).score
        sample_metrics.append(
            SampleMetrics(
                bleu=sent_bleu,
                chrf=sent_chrf,
                rouge_l=rouge,
                language_ok=language_ok(hyp, direction),
                copied_source=copied_source(source, hyp),
                line_count_match=line_count_match(source, hyp),
                length_ratio=length_ratio(hyp, ref),
            )
        )

    summary = {
        "bleu": float(bleu),
        "chrf": float(chrf),
        "rouge_l": float(sum(rouge_scores) / max(len(rouge_scores), 1)),
    }

    return sample_metrics, summary
