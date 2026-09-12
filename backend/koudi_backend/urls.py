"""KOUDI STOCK - root URL configuration."""
from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, HttpResponse, HttpResponseNotFound
from django.urls import include, path, re_path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("stock.urls")),
]

# ---------------------------------------------------------------------------
# Single-port production demo: serve the built React SPA from Django.
# Any path that is not /api/ or /admin/ is served from frontend/dist, with a
# fallback to index.html so client-side routing (BrowserRouter) works on
# deep links. Build first with: cd frontend && npm run build
# ---------------------------------------------------------------------------
SPA_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def spa(request, path=""):
    if not SPA_DIST.exists():
        return HttpResponse(
            "KOUDI STOCK frontend is not built. Run `npm run build` inside the "
            "`frontend/` directory, then refresh.",
            content_type="text/plain",
            status=200,
        )
    target = (SPA_DIST / path).resolve()
    if target.is_file() and str(target).startswith(str(SPA_DIST.resolve())):
        # Assets have content-hashed filenames (index-<hash>.js/css) => safe to
        # cache long. Everything else served as-is.
        response = FileResponse(open(target, "rb"))
        if target.name.startswith("index-"):
            response["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
    index = SPA_DIST / "index.html"
    if index.exists():
        # index.html must never be cached so the browser always picks up the
        # latest build and its new hashed assets.
        response = FileResponse(open(index, "rb"))
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response
    return HttpResponseNotFound("index.html not found")


def media(request, path=""):
    """Serve files uploaded under MEDIA_ROOT (must be registered before the SPA
    fallback below). Render's disk is ephemeral: back up these files or move to
    object storage for production uploads."""
    root = settings.MEDIA_ROOT.resolve()
    target = (root / path).resolve()
    if not str(target).startswith(str(root)) or not target.is_file():
        return HttpResponseNotFound("Fichier introuvable")
    response = FileResponse(open(target, "rb"))
    response["Cache-Control"] = "public, max-age=3600"
    return response


urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", media, name="media"),
    re_path(r"^(?!api/|admin/|media/)(?P<path>.*)$", spa, name="spa"),
]
