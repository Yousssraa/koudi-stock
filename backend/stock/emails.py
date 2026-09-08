"""Outbound e-mail notifications for the public vitrine.

At the moment this is a single purpose: when a client submits the contact or
devis form through /api/public/leads/, we e-mail the company so the team is
notified straight away (the lead is also stored in the database by the view).

Sending is driven entirely by Django settings (see ``koudi_backend/settings.py``).
If no SMTP host is configured the Django *console* backend prints the message to
the server console so local development still works without crashing.
"""
from django.conf import settings
from django.core.mail import send_mail


def notify_lead(lead):
    """E-mail the company about a newly submitted lead.

    ``lead`` is a ``stock.models.Lead`` (already persisted). The recipient is
    the company's public e-mail from ``CompanyProfile`` when available, falling
    back to ``settings.DEFAULT_FROM_EMAIL``.
    """
    from .models import CompanyProfile

    recipient = CompanyProfile.current().email or None
    if not recipient:
        recipient = settings.DEFAULT_FROM_EMAIL

    kind = dict(lead.Kind.choices).get(lead.kind, lead.kind)

    lines = [
        f"Nouveau message reçu via le site KOUDI WOOD ({kind}).",
        "",
        "--- Coordonnées ---",
        f"Nom        : {lead.name}",
        f"Société    : {lead.company or '—'}",
        f"Email      : {lead.email}",
        f"Téléphone  : {lead.phone or '—'}",
        f"Ville      : {lead.city or '—'}",
    ]
    if lead.subject:
        lines += ["", f"Sujet      : {lead.subject}"]
    lines += ["", "--- Message ---", lead.message or "(aucun message)"]

    if lead.requested_lines:
        lines += ["", "--- Lignes demandées ---"]
        for idx, item in enumerate(lead.requested_lines, 1):
            lines.append(
                f"{idx}. {item.get('name') or item.get('sku') or 'Produit'} "
                f"— quantité : {item.get('quantity') or '—'}"
            )

    subject_line = lead.subject or f"Nouveau message {kind} — {lead.name}"
    try:
        send_mail(
            subject=subject_line,
            message="\n".join(lines),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception:
        # Never let a notification failure break the client's form submission.
        pass
    return recipient
