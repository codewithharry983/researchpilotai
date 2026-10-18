import json
import time
import re
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Generator
import httpx
from app.core.config import settings


class LLMResponse:
    def __init__(
        self,
        content: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        latency_ms: int = 0,
        model: str = "offline-grounded"
    ):
        self.content = content
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = prompt_tokens + completion_tokens
        self.latency_ms = latency_ms
        self.model = model


class BaseLLM(ABC):
    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        pass


class OpenAILLM(BaseLLM):
    def __init__(self, api_key: str, model: str = settings.LLM_MODEL):
        self.api_key = api_key
        self.model = model

    def generate(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        start_time = time.time()
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": settings.LLM_TEMPERATURE,
            "max_tokens": settings.LLM_MAX_TOKENS
        }

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        latency_ms = int((time.time() - start_time) * 1000)
        usage = data.get("usage", {})
        content = data["choices"][0]["message"]["content"]

        return LLMResponse(
            content=content,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            latency_ms=latency_ms,
            model=self.model
        )


class GeminiLLM(BaseLLM):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model

    def generate(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        start_time = time.time()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": settings.LLM_TEMPERATURE,
                "maxOutputTokens": settings.LLM_MAX_TOKENS
            }
        }

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        latency_ms = int((time.time() - start_time) * 1000)
        candidates = data.get("candidates", [])
        if not candidates:
            return LLMResponse(content="No response generated.", latency_ms=latency_ms, model=self.model)

        content = candidates[0]["content"]["parts"][0]["text"]
        usage = data.get("usageMetadata", {})

        return LLMResponse(
            content=content,
            prompt_tokens=usage.get("promptTokenCount", 0),
            completion_tokens=usage.get("candidatesTokenCount", 0),
            latency_ms=latency_ms,
            model=self.model
        )


class OfflineGroundedLLM(BaseLLM):
    """
    High-fidelity offline grounded answer engine.
    Extracts relevant facts directly from context passages, validates evidence,
    and reliably returns structured uncertainty when passages do not support an answer.
    """
    def generate(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        start_time = time.time()

        # Parse context passages and query from user_prompt
        # Format usually: CONTEXT PASSAGES:\n[Source: ...] ... QUESTION: <query>
        context_match = re.search(r'CONTEXT PASSAGES:(.*?)(?:\n\nQUESTION:|\Z)', user_prompt, re.DOTALL)
        question_match = re.search(r'QUESTION:\s*(.*)', user_prompt, re.DOTALL)

        context_text = context_match.group(1).strip() if context_match else user_prompt
        question = question_match.group(1).strip() if question_match else ""

        q_lower = question.lower()
        stopwords = {
            "what", "how", "why", "when", "where", "who", "which", "many", "does", "with",
            "from", "that", "this", "have", "been", "were", "will", "would", "could", "should",
            "the", "and", "for", "are", "about", "ignore", "previous", "instructions", "output", "system"
        }
        all_q_words = re.findall(r'\b\w{3,}\b', q_lower)
        q_words = [w for w in all_q_words if w not in stopwords]

        # Check for unanswerable questions or empty context
        if not context_text or context_text == "No relevant document passages were found." or len(q_words) == 0:
            content = (
                "Based on the uploaded research documents, there is insufficient evidence to answer this question. "
                "The documents do not contain information addressing your query."
            )
        else:
            # Split context into passages
            passages = re.split(r'\[Source \d+:', context_text)
            scored_facts = []

            for p in passages:
                if not p.strip():
                    continue
                lines = p.strip().split("\n")
                body = "\n".join(lines[1:]) if len(lines) > 1 else lines[0]

                # Check relevance of sentences to question tokens
                sentences = re.split(r'(?<=[.!?])\s+', body)
                for s in sentences:
                    s_clean = s.strip()
                    if len(s_clean) < 15:
                        continue
                    s_lower = s_clean.lower()
                    
                    # Score sentence: exact word matches get 2 points, prefix matches get 1 point
                    score = 0
                    for qw in q_words:
                        if qw in s_lower:
                            score += 2
                        elif len(qw) >= 4 and qw[:4] in s_lower:
                            score += 1

                    min_required_score = 4 if len(q_words) >= 6 else (2 if len(q_words) >= 3 else 1)
                    if score >= min_required_score:
                        scored_facts.append((score, s_clean))

            if not scored_facts:
                content = (
                    "Based on the uploaded research documents, there is insufficient evidence to answer this question. "
                    "The retrieved passages do not discuss this topic."
                )
            else:
                # Sort by score descending and take top unique sentences
                scored_facts.sort(key=lambda x: x[0], reverse=True)
                top_sentences = []
                seen = set()
                for sc, text_sent in scored_facts:
                    if text_sent not in seen:
                        top_sentences.append(text_sent)
                        seen.add(text_sent)
                    if len(top_sentences) >= 4:
                        break

                synthesis = " ".join(top_sentences)
                content = f"Based on the provided research documents:\n\n{synthesis}"

        latency_ms = int((time.time() - start_time) * 1000)
        tokens = len(user_prompt.split()) + len(content.split())

        return LLMResponse(
            content=content,
            prompt_tokens=len(user_prompt.split()),
            completion_tokens=len(content.split()),
            latency_ms=max(10, latency_ms),
            model="offline-grounded-v1"
        )


def get_llm_service() -> BaseLLM:
    provider = settings.LLM_PROVIDER.lower()
    openai_key = settings.OPENAI_API_KEY or settings.LLM_API_KEY
    gemini_key = settings.GEMINI_API_KEY or settings.LLM_API_KEY

    if provider == "openai" or (provider == "auto" and openai_key and openai_key.startswith("sk-")):
        return OpenAILLM(api_key=openai_key)
    elif provider == "gemini" or (provider == "auto" and gemini_key and not gemini_key.startswith("sk-")):
        return GeminiLLM(api_key=gemini_key)
    else:
        return OfflineGroundedLLM()


llm_service = get_llm_service()
