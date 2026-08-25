"""Audit trail plumbing: thread-local request context + a compact logger.

The middleware captures the authenticated user + client IP for the duration
of a request; the :func:`audit` helper writes an ``AuditLog`` row. When no
request user is present (e.g. the demo seeder or a background job), entries
are skipped so the trail only reflects genuine user activity.
"""
import threading

_thread = threading.local()


def set_request_actor(user, ip_address=None, request=None):
    _thread.user = user
    _thread.ip = ip_address
    _thread.request = request


def clear_request_actor():
    _thread.user = None
    _thread.ip = None
    _thread.request = None


def current_user():
    return _resolved_user()


def current_ip():
    return getattr(_thread, "ip", None)


def _resolved_user():
    """Resolve the acting user.

    DRF authenticates the token in the ViewSet dispatch — after the middleware
    runs — so we lazily re-read the ``Authorization`` header (Token) or fall
    back to the session user.

    :returns: an authenticated auth.User, or ``None`` for system actions.
    """
    user = getattr(_thread, "user", None)
    if user is not None and getattr(user, "is_authenticated", False) and user.is_active:
        return user

    request = getattr(_thread, "request", None)
    if request is None:
        return None
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("token "):
        try:
            from rest_framework.authtoken.models import Token

            token = Token.objects.select_related("user").get(key=header.split(" ", 1)[1])
            if token.user.is_active:
                return token.user
        except Exception:
            return None
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def audit(action, entity_type, entity_id=None, entity_ref=None, details=None):
    """Record an audit row for the current request user (skipped if unknown)."""
    user = current_user()
    if user is None:
        return None
    from .models import AuditLog

    return AuditLog.objects.create(
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_ref=entity_ref,
        details=details or {},
        ip_address=current_ip(),
    )


def client_ip(request):
    """Best-effort client IP behind a reverse proxy or directly."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class AuditRequestMiddleware:
    """Capture the request (user + client IP) for the lifetime of the request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_request_actor(getattr(request, "user", None), client_ip(request), request)
        try:
            response = self.get_response(request)
        finally:
            clear_request_actor()
        return response
