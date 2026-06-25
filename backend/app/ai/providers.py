from __future__ import annotations

import httpx

from . import settings


class ProviderError(Exception):
    pass


class AllProvidersFailed(Exception):
    pass


Msg = dict


class LLMProvider:
    name = "base"

    def available(self) -> bool:
        raise NotImplementedError

    def complete(self, system: str, messages: list[Msg], *,
                 json_mode: bool = False, max_tokens: int | None = None,
                 temperature: float | None = None) -> str:
        raise NotImplementedError


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        self.key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL

    def available(self) -> bool:
        return bool(self.key)

    def complete(self, system, messages, *, json_mode=False, max_tokens=None, temperature=None):
        if not self.available():
            raise ProviderError("gemini: нет ключа")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        contents = [
            {"role": "model" if m["role"] == "assistant" else "user",
             "parts": [{"text": m["content"]}]}
            for m in messages
        ]
        gen = {
            "temperature": settings.TEMPERATURE if temperature is None else temperature,
            "maxOutputTokens": max_tokens or settings.MAX_TOKENS,
        }
        if json_mode:
            gen["responseMimeType"] = "application/json"
        body: dict = {"contents": contents, "generationConfig": gen}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        try:
            r = httpx.post(url, params={"key": self.key}, json=body, timeout=settings.HTTP_TIMEOUT)
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (httpx.HTTPError, KeyError, IndexError) as e:
            raise ProviderError(f"gemini: {e}") from e


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self) -> None:
        self.key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL

    def available(self) -> bool:
        return bool(self.key)

    def complete(self, system, messages, *, json_mode=False, max_tokens=None, temperature=None):
        if not self.available():
            raise ProviderError("openai: нет ключа")
        msgs = ([{"role": "system", "content": system}] if system else []) + messages
        body: dict = {
            "model": self.model,
            "messages": msgs,
            "temperature": settings.TEMPERATURE if temperature is None else temperature,
            "max_tokens": max_tokens or settings.MAX_TOKENS,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        try:
            r = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.key}"},
                json=body, timeout=settings.HTTP_TIMEOUT,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError) as e:
            raise ProviderError(f"openai: {e}") from e


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        self.key = settings.ANTHROPIC_API_KEY
        self.model = settings.ANTHROPIC_MODEL

    def available(self) -> bool:
        return bool(self.key)

    def complete(self, system, messages, *, json_mode=False, max_tokens=None, temperature=None):
        if not self.available():
            raise ProviderError("anthropic: нет ключа")
        body: dict = {
            "model": self.model,
            "max_tokens": max_tokens or settings.MAX_TOKENS,
            "temperature": settings.TEMPERATURE if temperature is None else temperature,
            "messages": messages,
        }
        if system:
            body["system"] = system + ("\nОтвечай только валидным JSON-объектом." if json_mode else "")
        try:
            r = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=body, timeout=settings.HTTP_TIMEOUT,
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"]
        except (httpx.HTTPError, KeyError, IndexError) as e:
            raise ProviderError(f"anthropic: {e}") from e


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self) -> None:
        self.host = settings.OLLAMA_HOST.rstrip("/")
        self.model = settings.OLLAMA_MODEL

    def available(self) -> bool:
        return bool(self.host)

    def complete(self, system, messages, *, json_mode=False, max_tokens=None, temperature=None):
        if not self.available():
            raise ProviderError("ollama: нет хоста")
        msgs = ([{"role": "system", "content": system}] if system else []) + messages
        body: dict = {
            "model": self.model,
            "messages": msgs,
            "stream": False,
            "options": {"temperature": settings.TEMPERATURE if temperature is None else temperature},
        }
        if json_mode:
            body["format"] = "json"
        try:
            r = httpx.post(f"{self.host}/api/chat", json=body, timeout=settings.HTTP_TIMEOUT)
            r.raise_for_status()
            return r.json()["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError) as e:
            raise ProviderError(f"ollama: {e}") from e


_REGISTRY = {
    "ollama": OllamaProvider,
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
}


class LLMRouter:
    def __init__(self) -> None:
        self.providers: list[LLMProvider] = [
            _REGISTRY[name]() for name in settings.PROVIDER_ORDER if name in _REGISTRY
        ]
        self.last_provider: str | None = None

    def available(self) -> bool:
        return (not settings.OFFLINE) and any(p.available() for p in self.providers)

    def status(self) -> list[dict]:
        return [{"provider": p.name, "available": p.available()} for p in self.providers]

    def complete(self, system: str, messages: list[Msg], **kw) -> str:
        if settings.OFFLINE:
            raise AllProvidersFailed("AI_OFFLINE=1")
        errors: list[str] = []
        for p in self.providers:
            if not p.available():
                continue
            try:
                out = p.complete(system, messages, **kw)
                if out and out.strip():
                    self.last_provider = p.name
                    return out
                errors.append(f"{p.name}: пустой ответ")
            except ProviderError as e:
                errors.append(str(e))
        raise AllProvidersFailed("; ".join(errors) or "нет доступных провайдеров")


router = LLMRouter()
