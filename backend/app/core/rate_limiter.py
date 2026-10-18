import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import HTTPException, Request, status
from app.core.config import settings


class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter per IP address or user ID.
    Thread-safe for standard ASGI workers.
    """
    def __init__(self):
        # map key -> list of timestamps
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> Tuple[bool, int]:
        now = time.time()
        cutoff = now - window_seconds
        
        # Clean older requests
        timestamps = [ts for ts in self.requests[key] if ts > cutoff]
        self.requests[key] = timestamps

        if len(timestamps) >= max_requests:
            retry_after = int(timestamps[0] + window_seconds - now) + 1
            return False, max(1, retry_after)

        self.requests[key].append(now)
        return True, 0


limiter = InMemoryRateLimiter()


def rate_limit_auth(request: Request):
    """Rate limit authentication attempts per client IP."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"auth:{client_ip}"
    allowed, retry_after = limiter.is_allowed(key, max_requests=settings.RATE_LIMIT_AUTH_PER_MINUTE, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many authentication attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )


def rate_limit_ai(request: Request):
    """Rate limit AI-intensive requests per client or user."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"ai:{client_ip}"
    allowed, retry_after = limiter.is_allowed(key, max_requests=settings.RATE_LIMIT_AI_PER_MINUTE, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many research queries. Please wait {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )
