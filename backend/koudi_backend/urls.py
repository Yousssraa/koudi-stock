"""KOUDI STOCK - root URL configuration."""
from pathlib import Path

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
        return FileResponse(open(target, "rb"))
    index = SPA_DIST / "index.html"
    if index.exists():
        return FileResponse(open(index, "rb"))
    return HttpResponseNotFound("index.html not found")


urlpatterns += [re_path(r"^(?!api/|admin/)(?P<path>.*)$", spa, name="spa")]
