from llama_index.llms.openai import OpenAI
from openai import OpenAI as OpenAIClient

from ..config import (
    OPENAI_API_KEY,
    LLM_MODEL,
    LLM_MAX_TOKENS,
    LLM_REASONING,
    LLM_TIMEOUT,
    LLM_VISION_MODEL,
)


def get_llm() -> OpenAI:
    return OpenAI(
        api_key=OPENAI_API_KEY,
        model=LLM_MODEL,
        max_tokens=LLM_MAX_TOKENS,
        timeout=LLM_TIMEOUT,
        additional_kwargs={
            "reasoning_effort": LLM_REASONING
        }
    )


def get_vision_llm() -> OpenAI:
    return OpenAI(
        api_key=OPENAI_API_KEY,
        model=LLM_VISION_MODEL,
        timeout=LLM_TIMEOUT,
    )


def get_openai_client() -> OpenAIClient:
    return OpenAIClient(
        api_key=OPENAI_API_KEY,
        timeout=LLM_TIMEOUT,
    )
