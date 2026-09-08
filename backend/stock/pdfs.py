"""Enterprise PDF documents: invoices / quotations and QR bundle labels.

Generated server-side with ReportLab (+ ``qrcode`` for the scannable labels),
so the React client just downloads the resulting bytes. Timber is invoiced
per cubic metre (MAD/m³); a 20% VAT is applied on top of the HT subtotal.
"""
import io
from decimal import Decimal

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .models import CompanyProfile, CreditNote, DeliveryNote, compute_volume_m3

VAT_RATE = Decimal("0.20")  # TVA 20%


def _company():
    """Live company identity from the admin-editable singleton profile."""
    p = CompanyProfile.current()
    contact_bits = [
        f"Tél : {p.phone}" if p.phone else None,
        p.email or None,
    ]
    tax_bits = [
        f"ICE : {p.ice}" if p.ice else None,
        f"IF : {p.identifiant_fiscal}" if p.identifiant_fiscal else None,
        f"Patente : {p.patente}" if p.patente else None,
        f"CNSS : {p.cnss}" if p.cnss else None,
        f"RC : {p.registre_commerce}" if p.registre_commerce else None,
    ]
    return {
        "name": p.name or "KOUDI STOCK",
        "tagline": p.tagline or "Vente & Gestion de Stock du Bois",
        "address": (p.address or "").strip(),
        "contact": "  ·  ".join(b for b in contact_bits if b),
        "tax_id": "  ·  ".join(b for b in tax_bits if b),
        "bank_name": (p.bank_name or "").strip(),
        "bank_rib": (p.bank_rib or "").replace(" ", ""),
    }

def _delivery_refs(so):
    """Attached Bon(s) de Livraison for an invoice (grouped BL numbers)."""
    nums = [dn.bl_number for dn in so.delivery_notes.all()]
    return "<br/>Bons de livraison : " + ", ".join(nums) if nums else ""


_SUB_HEAD = ParagraphStyle(
    name="SubHead", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#74482a"),
)
_P = ParagraphStyle(
    name="P", fontName="Helvetica", fontSize=8, leading=11, textColor=colors.HexColor("#3b2f23"),
)


def _money(value):
    return f"{Decimal(str(value)):,.2f} MAD".replace(",", " ")


def _num(value, digits=4):
    return f"{Decimal(str(value)):,.{digits}f}".replace(",", " ")


_UNITS = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
    "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
    "dix-sept", "dix-huit", "dix-neuf",
]
_TENS = [
    "", "", "vingt", "trente", "quarante", "cinquante",
    "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix",
]


def _below_100(n):
    if n < 20:
        return _UNITS[n]
    t, u = divmod(n, 10)
    if t == 7:  # 70 → 79
        if u == 0:
            return "soixante-dix"
        if u == 1:
            return "soixante-et-onze"
        return f"soixante-{_UNITS[10 + u]}"
    if t == 8:  # 80 → 89
        if u == 0:
            return "quatre-vingts"
        return f"quatre-vingt-{_UNITS[u]}"
    if t == 9:  # 90 → 99
        if u == 0:
            return "quatre-vingt-dix"
        return f"quatre-vingt-{_UNITS[10 + u]}"
    if u == 0:
        return _TENS[t]
    if u == 1:
        return f"{_TENS[t]}-et-un"
    return f"{_TENS[t]}-{_UNITS[u]}"


def _below_1000(n):
    if n < 100:
        return _below_100(n)
    h, r = divmod(n, 100)
    head = "cent" if h == 1 else f"{_below_100(h)} cent"
    if r == 0:
        return head + ("s" if h > 1 else "")
    return f"{head} {_below_100(r)}"


def _integer_french_words(n):
    """Spell any integer in French words (legally required on invoices)."""
    if n == 0:
        return "zéro"
    chunks = []
    scales = ((10**9, "milliard"), (10**6, "million"), (10**3, "mille"))
    for value, name in scales:
        count, n = divmod(n, value)
        if count == 0:
            continue
        if count == 1 and name == "mille":
            chunks.append("mille")
        elif name == "mille":
            chunks.append(f"{_below_1000(count)} mille")
        elif count == 1:
            chunks.append(f"un {name}")
        else:
            chunks.append(f"{_below_1000(count)} {name}s")
    if n:
        chunks.append(_below_1000(n))
    return " ".join(chunks)


def amount_in_words(amount):
    """'12 345,67 MAD' → 'douze mille trois cent quarante-cinq dirhams et
    soixante-sept centimes' (small caps are applied by the caller)."""
    amount = Decimal(str(amount)).quantize(Decimal("0.01"))
    negative = amount < 0
    if negative:
        amount = -amount
    whole, cents = divmod(int(amount * 100), 100)
    pieces = [
        f"{_integer_french_words(whole)} dirham" if whole == 1
        else f"{_integer_french_words(whole)} dirhams"
    ]
    if cents:
        pieces.append(
            f"{_integer_french_words(cents)} centime" if cents == 1
            else f"{_integer_french_words(cents)} centimes"
        )
    text = " et ".join(pieces)
    return ("moins " + text) if negative else text


def _build_order_doc(so, doc_type):
    """Render an invoice or quotation document for a sales order."""
    is_invoice = doc_type == "invoice"
    title = "FACTURE" if is_invoice else "DEVIS"
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm,
        leftMargin=14 * mm, rightMargin=14 * mm,
    )

    story = []

    # --- Header band ---------------------------------------------------------
    comp = _company()
    info_rows = [
        [Paragraph(comp["address"], _SUB_HEAD), ""],
        [Paragraph(comp["contact"], _SUB_HEAD), ""],
        [Paragraph(comp["tax_id"], _SUB_HEAD), ""],
    ]
    header_rows = [
        [
            Paragraph(f"<b>{comp['name']}</b>", ParagraphStyle(
                "H1", fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#74482a"))),
            Paragraph(f"<b>{title}</b>", ParagraphStyle(
                "DT", fontName="Helvetica-Bold", fontSize=15, alignment=TA_RIGHT,
                textColor=colors.HexColor("#3b2f23")),
            ),
        ],
        [
            Paragraph(comp["tagline"], _SUB_HEAD),
            Paragraph(
                f"{title} N° <b>{so.so_number}</b><br/>Date : {so.order_date:%d/%m/%Y}<br/>"
                f"Statut : <b>{so.get_status_display()}</b>",
                ParagraphStyle("DTR", parent=_P, alignment=TA_RIGHT),
            ),
        ],
    ] + [row for row in info_rows if row[0].text]
    header = Table(header_rows, colWidths=[doc.width * 0.55, doc.width * 0.45])
    header.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.HexColor("#8f6233")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(header)
    story.append(Spacer(1, 6 * mm))

    # --- Client + remise -----------------------------------------------------
    info = Table(
        [
            [
                Paragraph("<b>CLIENT</b>", _SUB_HEAD),
                Paragraph("<b>DÉPÔT / LIVRAISON</b>", _SUB_HEAD),
                Paragraph("<b>RÉFÉRENCES</b>", _SUB_HEAD),
            ],
            [
                Paragraph(
                    f"<b>{so.client.company_name}</b><br/>{so.client.contact_name or ''}"
                    f"<br/>{so.client.address or ''}<br/>{so.client.tax_id or ''}",
                    _P,
                ),
Paragraph(f"{so.warehouse.name}<br/>{so.warehouse.address or ''}", _P),
                Paragraph(
                    f"Client : {so.client.code}<br/>Commande : {so.so_number}"
                    f"{_delivery_refs(so) if is_invoice else ''}"
                    f"<br/>Devise : {so.currency or 'MAD'}", _P,
                ),
            ],
        ],
        colWidths=[doc.width * 0.40, doc.width * 0.30, doc.width * 0.30],
    )
    info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#efe4d2")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, colors.HexColor("#ddccb0")),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddccb0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info)
    story.append(Spacer(1, 6 * mm))

    # --- Line items ----------------------------------------------------------
    style = getSampleStyleSheet()
    line_style = ParagraphStyle("LT", parent=style["BodyText"], fontSize=7.5, leading=9)
    head_style = ParagraphStyle(
        "TH", parent=line_style, fontName="Helvetica-Bold", textColor=colors.white,
    )

    table_data = [[
        Paragraph("RÉF", head_style),
        Paragraph("DÉSIGNATION", head_style),
        Paragraph("DIMENSIONS (t × l × L)", head_style),
        Paragraph("PIÈCES", head_style),
        Paragraph("VOLUME (m³)", head_style),
        Paragraph("PU (MAD/m³)", head_style),
        Paragraph("MONTANT HT", head_style),
    ]]

    total_volume = Decimal("0")
    subtotal = Decimal("0")
    for item in so.items.all():
        vol = compute_volume_m3(
            item.product.thickness_mm, item.product.width_mm, item.product.length_m, item.quantity_ordered
        ) or Decimal("0")
        total_volume += vol
        subtotal += Decimal(str(item.line_total))
        dims = item.product.dimensions_display
        table_data.append([
            Paragraph(item.product.sku, line_style),
            Paragraph(item.product.name, line_style),
            Paragraph(dims, line_style),
            Paragraph(_num(item.quantity_ordered, 0), line_style),
            Paragraph(_num(vol, 4), line_style),
            Paragraph(_num(item.unit_price, 2), line_style),
            Paragraph(_money(item.line_total), line_style),
        ])

    discount_amount = Decimal(str(so.discount_amount or 0))
    net = subtotal - discount_amount
    vat = net * VAT_RATE
    grand_total = net + vat

    table_data.append([
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("<b>SOUS-TOTAL HT</b>", line_style),
        Paragraph(_money(subtotal), line_style),
    ])
    if discount_amount > 0:
        pct = so.discount_percent or ""
        table_data.append([
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph(f"REMISE «{so.tier_name or 'volume'}» −{pct}%", line_style),
            Paragraph(_money(-discount_amount), line_style),
        ])
        table_data.append([
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("<b>TOTAL HT</b>", line_style),
            Paragraph(_money(net), line_style),
        ])
    table_data.append([
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("TVA 20%", line_style),
        Paragraph(_money(vat), line_style),
    ])
    table_data.append([
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("<b>TOTAL TTC</b>", line_style),
        Paragraph(f"<b>{_money(grand_total)}</b>", line_style),
    ])

    lines_table = Table(table_data, colWidths=[
        doc.width * 0.10, doc.width * 0.28, doc.width * 0.15,
        doc.width * 0.08, doc.width * 0.11, doc.width * 0.14, doc.width * 0.14,
    ], repeatRows=1)
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#74482a")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("BACKGROUND", (0, -3), (-1, -1), colors.HexColor("#f6f0e4")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
    story.append(lines_table)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(f"<b>Volume total bois : {_num(total_volume, 4)} m³</b>", ParagraphStyle(
        "VOL", parent=_SUB_HEAD, fontSize=9)))
    if is_invoice:
        words_style = ParagraphStyle(
            "NMC", parent=_P, fontSize=8, leading=11,
            textColor=colors.HexColor("#3b2f23"),
        )
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(
            "Arrêtée la présente facture à la somme de : "
            f"<b>{amount_in_words(grand_total)}</b>.",
            words_style,
        ))
    story.append(Spacer(1, 8 * mm))

# --- Footer --------------------------------------------------------------
    if is_invoice:
        days = getattr(so.client, "payment_terms_days", 30) or 30
        if comp["bank_rib"]:
            bank = f"{comp['bank_name']} — " if comp["bank_name"] else ""
            rib = " ".join(comp["bank_rib"][i:i + 4] for i in range(0, len(comp["bank_rib"]), 4))
            note = (
                f"Merci de votre confiance. Paiement à {days} jours — "
                f"Virement bancaire {bank}: RIB {rib}."
            )
        else:
            note = f"Merci de votre confiance. Paiement à {days} jours."
    else:
        note = "Document provisoire — ne constitue pas une facture. Valable 15 jours à compter de la date d'émission."
    story.append(Paragraph(
        f"<b>Conditions :</b> {note}", ParagraphStyle("F", parent=_P, fontSize=7.5),
    ))
    footer_bits = [b for b in (comp["name"], comp["address"], comp["tax_id"]) if b]
    if is_invoice and comp["bank_rib"]:
        if comp["bank_name"]:
            footer_bits.append(f"RIB — {comp['bank_name']} : {comp['bank_rib']}")
        else:
            footer_bits.append(f"RIB : {comp['bank_rib']}")
    story.append(Paragraph(
        " — ".join(footer_bits),
        ParagraphStyle("FB", parent=_P, fontSize=6.5, textColor=colors.HexColor("#99856b")),
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


def build_invoice_pdf(so):
    return _build_order_doc(so, "invoice")


def build_quotation_pdf(so):
    return _build_order_doc(so, "quotation")


def build_credit_note_pdf(cn):
    """Render a Facture d'Avoir (credit note) against an original invoice.

    Shows the reason (return / volume correction / commercial), the linked
    invoice (and optional Bon de Livraison), the HT / TVA / TTC amounts with
    the total spelled out in French words, plus the legal footer and RIB.
    """
    title = "FACTURE D'AVOIR"
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm,
        leftMargin=14 * mm, rightMargin=14 * mm,
    )

    story = []

    comp = _company()
    info_rows = [
        [Paragraph(comp["address"], _SUB_HEAD), ""],
        [Paragraph(comp["contact"], _SUB_HEAD), ""],
        [Paragraph(comp["tax_id"], _SUB_HEAD), ""],
    ]
    ref_bits = []
    if cn.sales_order:
        ref_bits.append(f"Facture d'origine : {cn.sales_order.so_number}")
    if cn.delivery_note:
        ref_bits.append(f"Bon de livraison : {cn.delivery_note.bl_number}")
    right_text = (
        f"{title} N° <b>{cn.credit_note_number}</b><br/>"
        f"Date : {cn.created_date:%d/%m/%Y}<br/>"
        f"Motif : <b>{cn.reason_label}</b>"
    )
    header_rows = [
        [
            Paragraph(f"<b>{comp['name']}</b>", ParagraphStyle(
                "H1", fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#74482a"))),
            Paragraph(f"<b>{title}</b>", ParagraphStyle(
                "DT", fontName="Helvetica-Bold", fontSize=15, alignment=TA_RIGHT,
                textColor=colors.HexColor("#3b2f23")),
            ),
        ],
        [
            Paragraph(comp["tagline"], _SUB_HEAD),
            Paragraph(right_text, ParagraphStyle("DTR", parent=_P, alignment=TA_RIGHT)),
        ],
    ] + [row for row in info_rows if row[0].text]
    header = Table(header_rows, colWidths=[doc.width * 0.55, doc.width * 0.45])
    header.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.HexColor("#8f6233")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(header)
    story.append(Spacer(1, 6 * mm))

    info = Table(
        [
            [
                Paragraph("<b>CLIENT</b>", _SUB_HEAD),
                Paragraph("<b>RÉFÉRENCES</b>", _SUB_HEAD),
            ],
            [
                Paragraph(
                    f"<b>{cn.client.company_name}</b><br/>{cn.client.contact_name or ''}"
                    f"<br/>{cn.client.address or ''}<br/>{cn.client.tax_id or ''}",
                    _P,
                ),
                Paragraph("<br/>".join(ref_bits) if ref_bits else "—", _P),
            ],
        ],
        colWidths=[doc.width * 0.50, doc.width * 0.50],
    )
    info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#efe4d2")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, colors.HexColor("#ddccb0")),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddccb0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info)
    story.append(Spacer(1, 6 * mm))

    ttc = cn.amount_ttc
    vat = ttc - Decimal(str(cn.amount))
    body = []

    motif = dict(CreditNote.Reason.choices).get(cn.reason)
    body.append(Paragraph(f"<b>Motif de l'avoir :</b> {motif}", _P))
    if cn.volume_m3:
        body.append(Paragraph(
            f"<b>Volume concerné :</b> {_num(cn.volume_m3, 4)} m³", _P,
        ))
    if cn.notes:
        body.append(Paragraph(f"<b>Notes :</b> {cn.notes}", _P))
    if cn.applied_amount and Decimal(str(cn.applied_amount)) > 0:
        body.append(Paragraph(
            f"<b>Montant appliqué à la facture d'origine :</b> "
            f"{_money(cn.applied_amount)}", _P,
        ))
    if body:
        for p in body:
            story.append(p)
        story.append(Spacer(1, 6 * mm))

    style = getSampleStyleSheet()
    line_style = ParagraphStyle("LT", parent=style["BodyText"], fontSize=8, leading=10)
    amounts = Table([
        [Paragraph("", line_style), Paragraph("MONTANT HT", line_style)],
        [Paragraph("", line_style), Paragraph(_money(cn.amount), line_style)],
        [Paragraph("", line_style), Paragraph("TVA 20 %", line_style)],
        [Paragraph("", line_style), Paragraph(_money(vat), line_style)],
        [Paragraph("", line_style),
         Paragraph(f"<b>TOTAL TTC (CRÉDIT CLIENT)</b>", line_style)],
        [Paragraph("", line_style),
         Paragraph(f"<b>{_money(ttc)}</b>", line_style)],
    ], colWidths=[doc.width * 0.70, doc.width * 0.30])
    amounts.setStyle(TableStyle([
        ("BACKGROUND", (0, -2), (-1, -1), colors.HexColor("#f6f0e4")),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddccb0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(amounts)
    story.append(Spacer(1, 3 * mm))
    words_style = ParagraphStyle(
        "NMC", parent=_P, fontSize=8, leading=11, textColor=colors.HexColor("#3b2f23"),
    )
    story.append(Paragraph(
        "Arrêté le présent avoir à la somme de : "
        f"<b>{amount_in_words(ttc)}</b>.",
        words_style,
    ))
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph(
        "<b>Conditions :</b> Ce document réduit la créance du client "
        "à concurrence du montant TTC ci-dessus. Le solde éventuellement "
        "appliqué à la facture d'origine est mentionné en référence.",
        ParagraphStyle("F", parent=_P, fontSize=7.5),
    ))
    footer_bits = [b for b in (comp["name"], comp["address"], comp["tax_id"]) if b]
    if comp["bank_rib"]:
        if comp["bank_name"]:
            footer_bits.append(f"RIB — {comp['bank_name']} : {comp['bank_rib']}")
        else:
            footer_bits.append(f"RIB : {comp['bank_rib']}")
    story.append(Paragraph(
        " — ".join(footer_bits),
        ParagraphStyle("FB", parent=_P, fontSize=6.5, textColor=colors.HexColor("#99856b")),
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


def _build_purchase_order_doc(po):
    """Render an official purchase order (bon de commande) for a supplier."""
    title = "BON DE COMMANDE"
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm,
        leftMargin=14 * mm, rightMargin=14 * mm,
    )

    story = []

    # --- Header band ---------------------------------------------------------
    comp = _company()
    info_rows = [
        [Paragraph(comp["address"], _SUB_HEAD), ""],
        [Paragraph(comp["contact"], _SUB_HEAD), ""],
        [Paragraph(comp["tax_id"], _SUB_HEAD), ""],
    ]
    header_rows = [
        [
            Paragraph(f"<b>{comp['name']}</b>", ParagraphStyle(
                "H1", fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#74482a"))),
            Paragraph(f"<b>{title}</b>", ParagraphStyle(
                "DT", fontName="Helvetica-Bold", fontSize=15, alignment=TA_RIGHT,
                textColor=colors.HexColor("#3b2f23")),
            ),
        ],
        [
            Paragraph(comp["tagline"], _SUB_HEAD),
            Paragraph(
                f"{title} N° <b>{po.po_number}</b><br/>"
                f"Date : {po.order_date:%d/%m/%Y}<br/>"
                f"Statut : <b>{po.get_status_display()}</b>",
                ParagraphStyle("DTR", parent=_P, alignment=TA_RIGHT),
            ),
        ],
    ] + [row for row in info_rows if row[0].text]
    header = Table(header_rows, colWidths=[doc.width * 0.55, doc.width * 0.45])
    header.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.HexColor("#8f6233")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(header)
    story.append(Spacer(1, 6 * mm))

    # --- Supplier + warehouse ------------------------------------------------
    expected = f"<br/>Livraison prévue : {po.expected_date:%d/%m/%Y}" if po.expected_date else ""
    info = Table(
        [
            [
                Paragraph("<b>FOURNISSEUR</b>", _SUB_HEAD),
                Paragraph("<b>DÉPÔT / RÉCEPTION</b>", _SUB_HEAD),
                Paragraph("<b>RÉFÉRENCES</b>", _SUB_HEAD),
            ],
            [
                Paragraph(
                    f"<b>{po.supplier.company_name}</b><br/>{po.supplier.contact_name or ''}"
                    f"<br/>{po.supplier.address or ''}<br/>{po.supplier.tax_id or ''}"
                    f"<br/>{po.supplier.phone or ''}",
                    _P,
                ),
                Paragraph(f"{po.warehouse.name}<br/>{po.warehouse.address or ''}", _P),
                Paragraph(
                    f"Fournisseur : {po.supplier.code}<br/>Commande : {po.po_number}"
                    f"<br/>Devise : {po.currency or 'MAD'}{expected}", _P,
                ),
            ],
        ],
        colWidths=[doc.width * 0.40, doc.width * 0.30, doc.width * 0.30],
    )
    info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#efe4d2")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, colors.HexColor("#ddccb0")),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddccb0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info)
    story.append(Spacer(1, 6 * mm))

    # --- Line items ----------------------------------------------------------
    style = getSampleStyleSheet()
    line_style = ParagraphStyle("LT", parent=style["BodyText"], fontSize=7.5, leading=9)
    head_style = ParagraphStyle(
        "TH", parent=line_style, fontName="Helvetica-Bold", textColor=colors.white,
    )

    table_data = [[
        Paragraph("RÉF", head_style),
        Paragraph("DÉSIGNATION", head_style),
        Paragraph("DIMENSIONS (t × l × L)", head_style),
        Paragraph("PIÈCES", head_style),
        Paragraph("VOLUME (m³)", head_style),
        Paragraph("PU (MAD/m³)", head_style),
        Paragraph("MONTANT", head_style),
    ]]

    total_volume = Decimal("0")
    subtotal = Decimal("0")
    for item in po.items.all():
        vol = compute_volume_m3(
            item.product.thickness_mm, item.product.width_mm, item.product.length_m, item.quantity_ordered
        ) or Decimal("0")
        total_volume += vol
        subtotal += Decimal(str(item.line_total))
        table_data.append([
            Paragraph(item.product.sku, line_style),
            Paragraph(item.product.name, line_style),
            Paragraph(item.product.dimensions_display, line_style),
            Paragraph(_num(item.quantity_ordered, 0), line_style),
            Paragraph(_num(vol, 4), line_style),
            Paragraph(_num(item.unit_price, 2), line_style),
            Paragraph(_money(item.line_total), line_style),
        ])

    fees = po.total_fees
    landed = subtotal + fees

    table_data.append([
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("<b>SOUS-TOTAL</b>", line_style),
        Paragraph(_money(subtotal), line_style),
    ])
    if fees > 0:
        fee_rows = [
            ("FRET", po.freight_cost),
            ("DOUANE", po.customs_cost),
            ("MANUTENTION", po.handling_cost),
        ]
        for f_label, f_value in fee_rows:
            if f_value > 0:
                table_data.append([
                    Paragraph("", line_style),
                    Paragraph("", line_style),
                    Paragraph("", line_style),
                    Paragraph("", line_style),
                    Paragraph("", line_style),
                    Paragraph(f_label, line_style),
                    Paragraph(_money(f_value), line_style),
                ])
        table_data.append([
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("", line_style),
            Paragraph("<b>TOTAL FRET & DOUANE</b>", line_style),
            Paragraph(_money(fees), line_style),
        ])
    table_data.append([
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("<b>COÛT TOTAL (REVIENT)</b>", line_style),
        Paragraph(f"<b>{_money(landed)}</b>", line_style),
    ])

    lines_table = Table(table_data, colWidths=[
        doc.width * 0.10, doc.width * 0.28, doc.width * 0.15,
        doc.width * 0.08, doc.width * 0.11, doc.width * 0.14, doc.width * 0.14,
    ], repeatRows=1)
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#74482a")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("BACKGROUND", (0, -4), (-1, -1), colors.HexColor("#f6f0e4")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(lines_table)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"<b>Volume total bois : {_num(total_volume, 4)} m³</b>",
        ParagraphStyle("VOL", parent=_SUB_HEAD, fontSize=9),
    ))
    story.append(Spacer(1, 3 * mm))
    if po.notes:
        story.append(Paragraph(
            f"<b>Notes :</b> {po.notes}",
            ParagraphStyle("NOTES", parent=_P, fontSize=7.5),
        ))
        story.append(Spacer(1, 8 * mm))

    # --- Footer --------------------------------------------------------------
    story.append(Paragraph(
        f"<b>Conditions :</b> {po.supplier.payment_terms or 'Paiement selon accord.'}",
        ParagraphStyle("F", parent=_P, fontSize=7.5),
    ))
    footer_bits = [b for b in (comp["name"], comp["address"], comp["tax_id"]) if b]
    story.append(Paragraph(
        " — ".join(footer_bits),
        ParagraphStyle("FB", parent=_P, fontSize=6.5, textColor=colors.HexColor("#99856b")),
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


def build_purchase_order_pdf(po):
    return _build_purchase_order_doc(po)


def build_delivery_note_pdf(bl, include_signatures=True):
    """Render a Bon de Livraison (delivery note) optimised for printing.

    Shows the shipping details (client, driver, truck plate), the line items
    with their computed volume (m³), and — when ``include_signatures`` — two
    signature fields (recipient and shipper) so the printed note can be signed
    on delivery.
    """
    title = "BON DE LIVRAISON"
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm,
        leftMargin=14 * mm, rightMargin=14 * mm,
    )

    story = []

    # --- Header band -----------------------------------------------------
    comp = _company()
    info_rows = [
        [Paragraph(comp["address"], _SUB_HEAD), ""],
        [Paragraph(comp["contact"], _SUB_HEAD), ""],
        [Paragraph(comp["tax_id"], _SUB_HEAD), ""],
    ]
    status_label = dict(DeliveryNote.Status.choices).get(bl.status, bl.status)
    header_rows = [
        [
            Paragraph(f"<b>{comp['name']}</b>", ParagraphStyle(
                "H1", fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#74482a"))),
            Paragraph(f"<b>{title}</b>", ParagraphStyle(
                "DT", fontName="Helvetica-Bold", fontSize=15, alignment=TA_RIGHT,
                textColor=colors.HexColor("#3b2f23")),
            ),
        ],
        [
            Paragraph(comp["tagline"], _SUB_HEAD),
            Paragraph(
                f"{title} N° <b>{bl.bl_number}</b><br/>Date : {bl.order_date:%d/%m/%Y}<br/>"
                f"Statut : <b>{status_label}</b>",
                ParagraphStyle("DTR", parent=_P, alignment=TA_RIGHT),
            ),
        ],
    ] + [row for row in info_rows if row[0].text]
    header = Table(header_rows, colWidths=[doc.width * 0.55, doc.width * 0.45])
    header.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.HexColor("#8f6233")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(header)
    story.append(Spacer(1, 6 * mm))

    # --- Delivery info ----------------------------------------------------
    transport = " · ".join(b for b in (
        f"Chauffeur : {bl.driver_name}" if bl.driver_name else None,
        f"Véhicule : {bl.truck_plate}" if bl.truck_plate else None,
    ) if b) or "—"
    info = Table(
        [
            [
                Paragraph("<b>CLIENT</b>", _SUB_HEAD),
                Paragraph("<b>DÉPÔT / EXPÉDITION</b>", _SUB_HEAD),
                Paragraph("<b>TRANSPORT</b>", _SUB_HEAD),
            ],
            [
                Paragraph(
                    f"<b>{bl.client.company_name}</b><br/>{bl.client.contact_name or ''}"
                    f"<br/>{bl.client.address or ''}<br/>{bl.client.tax_id or ''}",
                    _P,
                ),
                Paragraph(f"{bl.warehouse.name}<br/>{bl.warehouse.address or ''}", _P),
                Paragraph(f"Livreur : {bl.driver_name or '—'}<br/>Immatriculation : {bl.truck_plate or '—'}", _P),
            ],
        ],
        colWidths=[doc.width * 0.40, doc.width * 0.30, doc.width * 0.30],
    )
    info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#efe4d2")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, colors.HexColor("#ddccb0")),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddccb0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info)
    story.append(Spacer(1, 6 * mm))

    # --- Line items -------------------------------------------------------
    style = getSampleStyleSheet()
    line_style = ParagraphStyle("LT", parent=style["BodyText"], fontSize=7.5, leading=9)
    head_style = ParagraphStyle(
        "TH", parent=line_style, fontName="Helvetica-Bold", textColor=colors.white,
    )

    table_data = [[
        Paragraph("RÉF", head_style),
        Paragraph("DÉSIGNATION", head_style),
        Paragraph("DIMENSIONS (t × l × L)", head_style),
        Paragraph("PIÈCES", head_style),
        Paragraph("VOLUME (m³)", head_style),
        Paragraph("PU (MAD/m³)", head_style),
        Paragraph("MONTANT HT", head_style),
    ]]

    total_volume = Decimal("0")
    subtotal = Decimal("0")
    for item in bl.items.all():
        vol = item.volume_m3 or Decimal("0")
        total_volume += vol
        subtotal += Decimal(str(item.line_total))
        dims = item.product.dimensions_display
        table_data.append([
            Paragraph(item.product.sku, line_style),
            Paragraph(item.product.name, line_style),
            Paragraph(dims, line_style),
            Paragraph(_num(item.quantity, 0), line_style),
            Paragraph(_num(vol, 4), line_style),
            Paragraph(_num(item.unit_price, 2), line_style),
            Paragraph(_money(item.line_total), line_style),
        ])

    table_data.append([
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("", line_style),
        Paragraph("<b>TOTAL HT</b>", line_style),
        Paragraph(f"<b>{_money(subtotal)}</b>", line_style),
    ])

    lines_table = Table(table_data, colWidths=[
        doc.width * 0.10, doc.width * 0.28, doc.width * 0.15,
        doc.width * 0.08, doc.width * 0.11, doc.width * 0.14, doc.width * 0.14,
    ], repeatRows=1)
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#74482a")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f6f0e4")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#ddccb0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(lines_table)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(f"<b>Volume total bois : {_num(total_volume, 4)} m³</b>", ParagraphStyle(
        "VOL", parent=_SUB_HEAD, fontSize=9)))
    if bl.notes:
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            f"<b>Notes :</b> {bl.notes}", ParagraphStyle("NOTES", parent=_P, fontSize=7.5),
        ))
    story.append(Spacer(1, 8 * mm))

    # --- Signature fields -------------------------------------------------
    if include_signatures:
        sign = Table(
            [
                [
                    Paragraph("<b>LE CLIENT (cachet & signature)</b>", _SUB_HEAD),
                    Paragraph("<b>L'EXPÉDITEUR</b>", _SUB_HEAD),
                ],
                ["", ""],
                ["", ""],
            ],
            colWidths=[doc.width * 0.5, doc.width * 0.5],
        )
        sign.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddccb0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(sign)
        story.append(Spacer(1, 6 * mm))

    # --- Footer -----------------------------------------------------------
    story.append(Paragraph(
        "<b>Conditions :</b> Marchandise livrée telle que décrite ci-dessus. "
        "Toute réserve doit être émise à la réception.",
        ParagraphStyle("F", parent=_P, fontSize=7.5),
    ))
    footer_bits = [b for b in (comp["name"], comp["address"], comp["tax_id"]) if b]
    story.append(Paragraph(
        " — ".join(footer_bits),
        ParagraphStyle("FB", parent=_P, fontSize=6.5, textColor=colors.HexColor("#99856b")),
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# QR bundle labels
# ---------------------------------------------------------------------------
def _qr_png(payload, box_size=10):
    qr = qrcode.QRCode(
        version=None, error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size, border=1,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def build_label_pdf(product, warehouse, total_qty=1, copies_per_label=2):
    """Print scannable QR bundle labels (SKU, dimensions, volume, warehouse)."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4  # 595.27 x 841.89 pt

    margin = 10 * mm
    cols, rows = 3, 4
    cell_w = (width - 2 * margin) / cols
    cell_h = (height - 2 * margin) / rows

    dims = product.dimensions_display
    unit_volume = product.volume_cubic_m or Decimal("0")
    warehouse_name = warehouse.name if warehouse else "Tous dépôts"
    warehouse_code = warehouse.code if warehouse else "ALL"

    payload = (
        f"KOUDI|{product.sku}|{dims}|{unit_volume:.4f}|{warehouse_name}".replace("\u00d7", "x")
    )

    label_no = 0
    for page in range((total_qty + cols * rows - 1) // (cols * rows)):
        for r in range(rows):
            for col in range(cols):
                if label_no >= total_qty:
                    break
                x = margin + col * cell_w
                y = height - margin - (r + 1) * cell_h

                # Card background + border
                c.setFillColor(colors.HexColor("#fbf7ef"))
                c.rect(x, y, cell_w, cell_h, stroke=0, fill=1)
                c.setStrokeColor(colors.HexColor("#8f6233"))
                c.setLineWidth(0.8)
                c.rect(x, y, cell_w, cell_h, stroke=1, fill=0)

                inset = 6 * mm
                qr_size = 34 * mm
                qr = _qr_png(payload)
                c.drawImage(qr, x + inset, y + cell_h - inset - qr_size, qr_size, qr_size, mask="auto")

                tx = x + inset + qr_size + 4 * mm
                tw = cell_w - inset * 2 - qr_size - 4 * mm
                ty = y + cell_h - inset

                c.setFillColor(colors.HexColor("#74482a"))
                c.setFont("Helvetica-Bold", 7.5)
                c.drawString(tx, ty - 2 * mm, "KOUDI STOCK — LOT")

                c.setFillColor(colors.HexColor("#3b2f23"))
                c.setFont("Helvetica-Bold", 8.5)
                c.drawString(tx, ty - 6 * mm, product.sku)

                c.setFont("Helvetica", 7.5)
                lines = [
                    product.name[:42],
                    f"Dims : {dims}",
                    f"Vol. : {_num(unit_volume, 4)} m³ / unité",
                    f"Dépôt : {warehouse_name}",
                ]
                dy = ty - 10 * mm
                for line in lines:
                    c.drawString(tx, dy, line)
                    dy -= 4 * mm

                if total_qty > 1:
                    c.setFillColor(colors.HexColor("#99856b"))
                    c.setFont("Helvetica", 6.5)
                    c.drawRightString(x + cell_w - inset, y + 4.5 * mm, f"{label_no + 1}/{total_qty}")

                label_no += 1
        if label_no < total_qty:
            c.showPage()

    c.save()
    buf.seek(0)
    return buf.read()

# ---------------------------------------------------------------------------
# Public PDF catalog
# ---------------------------------------------------------------------------
CATALOG_HEAD = [ParagraphStyle(
    name="CatHead", fontName="Helvetica-Bold", fontSize=11,
    textColor=colors.HexColor("#74482a"),
)]
_CAT_NUM = ParagraphStyle(
    name="CatNum", fontName="Helvetica", fontSize=7.5, leading=10,
    textColor=colors.HexColor("#3b2f23"), alignment=TA_RIGHT,
)


def build_catalog_pdf(products, grouped):
    """Public A4 catalog: products grouped by category, priced per m3 (or m2 for panels).

    ``grouped`` is an ordered list of (category_label, [Product...]).
    Only public-safe fields are shown (no cost price / margin / internal stock).
    """
    from datetime import date

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=(14 * mm), bottomMargin=(14 * mm),
        leftMargin=(14 * mm), rightMargin=(14 * mm),
    )

    comp = _company()
    footer = Paragraph(
        f"{comp['name']} — {comp['address']}<br/>{comp['contact']} · {comp['tax_id']}",
        ParagraphStyle("Foot", fontName="Helvetica", fontSize=6.5,
                       textColor=colors.HexColor("#8f6233")),
    )

    def on_page(canv, d):
        canv.saveState()
        canv.setFont("Helvetica", 6.5)
        canv.setFillColor(colors.HexColor("#8f6233"))
        canv.drawString((14 * mm), (8 * mm), f"{comp['name']}")
        canv.drawRightString((A4[0] - 14 * mm), (8 * mm),
                             f"Page {d.page} — {len(products)} produits")
        canv.drawCentredString((A4[0] / 2), (8 * mm), footer.text)
        canv.restoreState()

    story = []

    # Header
    header = Table(
        [
            [Paragraph(f"<b>{comp['name']}</b>",
                       ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=20,
                                      textColor=colors.HexColor("#74482a"))),
             Paragraph("<b>CATALOGUE PRODUITS</b>",
                       ParagraphStyle("DT", fontName="Helvetica-Bold", fontSize=15,
                                      alignment=TA_RIGHT, textColor=colors.HexColor("#3b2f23")))],
             [Paragraph(comp["tagline"], _SUB_HEAD),
             Paragraph(f"Date : {date.today():%d/%m/%Y}<br/>"
                       f"Prix TTC en MAD", _CAT_NUM)],
        ],
        colWidths=[doc.width * 0.55, doc.width * 0.45],
    )
    header.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.HexColor("#8f6233")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(header)
    story.append(Spacer(1, 6 * mm))

    head_style = ParagraphStyle(
        "TH", fontName="Helvetica-Bold", fontSize=7.5, leading=9,
        textColor=colors.white,
    )
    row_style = ParagraphStyle(
        "ROW", fontName="Helvetica", fontSize=7.5, leading=9,
        textColor=colors.HexColor("#3b2f23"),
    )

    for label, prods in grouped:
        story.append(Paragraph(f"<b>{label}</b>", CATALOG_HEAD[0]))
        story.append(Spacer(1, 2 * mm))

        data = [[
            Paragraph("RÉF", head_style),
            Paragraph("DÉSIGNATION", head_style),
            Paragraph("ESSENCE / PIÈCE", head_style),
            Paragraph("TRAITEMENT", head_style),
            Paragraph("DIMENSIONS", head_style),
            Paragraph("VOL / SURF.", head_style),
            Paragraph("PRIX (MAD)", head_style),
        ]]
        for p in prods:
            une = (
                f"{float(p.surface_m2):.2f} m²" if p.is_panel and p.surface_m2
                else f"{float(p.volume_cubic_m):.3f} m³"
            )
            data.append([
                Paragraph(p.sku or "", row_style),
                Paragraph(_esc(p.name), row_style),
                Paragraph(f"{p.wood_type.name if p.wood_type else ''} — {p.piece_type or ''}", row_style),
                Paragraph(p.treatment or "—", row_style),
                Paragraph(p.dimensions_display or "—", row_style),
                Paragraph(une, row_style),
                Paragraph(f"{_money(p.sale_price)}", row_style),
            ])

        table = Table(data, colWidths=[
            doc.width * 0.10, doc.width * 0.28, doc.width * 0.20,
            doc.width * 0.13, doc.width * 0.14, doc.width * 0.07,
            doc.width * 0.08,
        ], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#74482a")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, colors.HexColor("#f4ecdf")]),
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddccb0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddccb0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(table)
        story.append(Spacer(1, 6 * mm))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    buf.seek(0)
    return buf.read()


def _esc(text):
    """Minimal XML escaping for ReportLab paragraphs."""
    text = str(text or "")
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
