// Génère et télécharge la fiche produit PDF (A4) d'un exemple de la boutique.
const PAD = 44;
const BODY = 10;
const LEAD = 14;

const AMBER = [202, 138, 4];
const INK = [28, 32, 46];
const ASH = [90, 96, 117];
const RULE = [220, 222, 232];

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function downloadFiche({ fam, ex, detail, c = {}, qf = {} }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const contentW = W - PAD * 2;
  let y = PAD;

  const ensure = (need) => {
    if (y + need > H - PAD) {
      doc.addPage();
      y = PAD;
      footer();
    }
  };

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...ASH);
    doc.text("KOUDI WOOD — Négoce de bois & matériaux · koudi-stock.onrender.com", W / 2, H - 26, { align: "center" });
  };

  const heading = (title) => {
    ensure(44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...AMBER);
    doc.text(title.toUpperCase(), PAD, y);
    y += 4;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.8);
    doc.line(PAD, y, W - PAD, y);
    y += 16;
  };

  const paragraph = (text) => {
    if (!text) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY);
    doc.setTextColor(...ASH);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensure(LEAD);
      doc.text(line, PAD, y);
      y += LEAD;
    }
    y += 8;
  };

  footer();

  // En-tête
  ensure(120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ASH);
  doc.text("KOUDI WOOD · FICHE PRODUIT", PAD, y);
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(ex.name, contentW);
  for (const line of titleLines) {
    ensure(26);
    doc.text(line, PAD, y);
    y += 26;
  }
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...AMBER);
  const famLines = doc.splitTextToSize(`${fam.label} · ${ex.essence}`, contentW);
  for (const line of famLines) {
    ensure(16);
    doc.text(line, PAD, y);
    y += 16;
  }
  y += 14;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(1);
  doc.line(PAD, y, W - PAD, y);
  y += 24;

  // Sections
  const sections = [
    { title: "Description", text: detail?.description || ex.description },
    { title: "Essence", text: c.essence },
    { title: "Provenances", text: detail?.provenances },
    { title: "Sciage / Process", text: detail?.sciage },
    { title: "Épaisseurs", text: detail?.epaisseurs },
    { title: "Qualités", text: qf.qualites },
    { title: "Couleurs & aspect", text: detail?.couleurs },
    { title: "Humidité", text: detail?.humidite },
    { title: "Spécificités & formats", text: qf.specif },
    { title: "Traçabilité", text: detail?.tracabilite },
    { title: "Densité", text: c.densite },
    { title: "Élasticité & résistance", text: [c.elasticite, c.resistance].filter(Boolean).join(" · ") },
    { title: "Applications", text: c.applications },
    { title: "Conseils de mise en œuvre", text: detail?.conseils },
  ];

  for (const s of sections) {
    if (!s.text) continue;
    heading(s.title);
    paragraph(s.text);
    y += 10;
  }

  // Mention devis
  ensure(60);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Besoin d'un devis sur mesure ?", PAD, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY);
  doc.setTextColor(...ASH);
  const cta = doc.splitTextToSize(
    `Demandez votre devis gratuit en ligne sur koudi-stock.onrender.com/devis en ajoutant « ${ex.name} » à votre demande. Notre équipe vous répond rapidement.`,
    contentW
  );
  for (const line of cta) {
    ensure(LEAD);
    doc.text(line, PAD, y);
    y += LEAD;
  }

  doc.save(`fiche-${slugify(ex.name)}.pdf`);
}