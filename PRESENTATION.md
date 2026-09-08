# KOUDI STOCK — Guide de présentation (démo)

Prêt en 30 secondes, une seule adresse à montrer : **http://127.0.0.1:8001**

## 1. Lancer la démo

- Double-cliquez sur **`start_demo.bat`** à la racine du projet.
- Le script construit le frontend, démarre le serveur (API + interface sur le même
  port 8001) et ouvre le navigateur automatiquement.
- Astuce : fermez la fenêtre « KOUDI STOCK backend 8001 » pour arrêter la démo.

## 2. Déroulé de la démo (3–5 min)

### Connexion (nouveau)
- Un écran de connexion s'affiche au démarrage : **`demo` / `demo2026`**.
- L'API est protégée (authentification par token) — beau point sécurité à montrer.
- « Se déconnecter » dans la barre latérale pour revenir à l'écran de connexion.

### Dashboard (écran d'accueil)
- KPI : Volume total (m³), Valeur du stock (MAD/m³), Alertes stock bas, Ventes du mois.
- Bandeau entrées/sorties du mois (↓ vert / ↑ rouge).
- Graphique « Ventes par Mois » et « Volume par Essence ».
- Top produits + journal des mouvements récents.
- **NOUVEAU — Alertes de réapprovisionnement** : carte ambrée listant chaque produit
  sous son seuil m³ (stock actuel / seuil / déficit / quantité suggérée), avec un
  bouton **⚡ Créer la réappro auto** qui génère un bon de commande fournisseur en
  draft en un clic (toast + actualisation des chiffres).

### Inventory
- Montrez la table avancée : SKU, essence, dimensions, m³, humidité (Sec Séchoir /
  Séché à l'air / Vert), grade, quantités par dépôt, badges de statut.
- **NOUVEAU — Photos réelles des essences** : chaque carte affiche une vraie photo
  de l'essence (Pin sylvestre, Épicéa, Sapelli, Kossipo, Dabema, Dibétou, Iroko,
  Chêne, Noyer, Okoumé + gros plan panneau MDF et planches de coffrage).
- Démontrez les **filtres** (essence, humidité, grade, dépôt) et la **recherche**.
- Cliquez **⭳ Export CSV** : un fichier Excel/LibreOffice s'ouvre.
- **+ Nouveau Produit** : le volume se calcule automatiquement à la saisie.
- **NOUVEAU — Seuil de réapprovisionnement (m³)** dans le formulaire produit :
  entrez un seuil, sauvegardez, puis observez le produit apparaître dans l'alerte
  du tableau de bord.
- **NOUVEAU — ◫ QR Étiquettes** : sur une carte produit, cliquez le bouton pour
  générer le PDF des étiquettes de lot (grille A4 3×4, code scannable avec
  SKU · dimensions · volume · dépôt).

### Calculateur Live (c'est l'argument clé)
- Dans la barre du haut, cliquez **+ Vente**.
- Choisissez un produit : dimensions pré-remplies, prix par m³.
- Modifiez une dimension ou la quantité → le **volume (m³) et le total MAD se
  recalculent en direct**.
- Validez : toast de confirmation, stock mis à jour, chiffres du dashboard actualisés.

### Transactions
- Onglets Ventes / Achats avec le détail des lignes facturées au m³ (MAD/m³, m³, total).
- **NOUVEAU — Documents officiels** : sur une carte Vente, **Devis PDF** puis
  **Facture PDF**. Ouvrez le PDF : en-tête société, client, dépôt, références,
  lignes m³, sous-total HT, **TVA 20 %**, total TTC — document prêt à envoyer.
- **NOUVEAU — Profit réel** : chaque vente affiche la **marge %** (prix de vente
  moins le **coût débarqué** : prix d'achat + frais logistiques répartis au m³),
  le **palier de remise** appliqué et le solde **Payé / Reste**.

### Clients & Crédit (nouveau)
- Entrée **✉ Clients & Crédit** dans la barre latérale.
- Métriques : **impayés totaux**, **retards**, clients au-delà du plafond, bloqués.
- Chaque client : barre **impayé / plafond**, % de crédit utilisé, crédit disponible,
  badge **⚠ Dépassement** sur CHARENTE / ÉBÉNISTERIE (retards réels) et badge
  **⏳ Retard** — les calculs reposent sur le **livre des encaissements** plus les
  délais de paiement de chaque client.
- **+ Encaisser** : enregistrez un règlement (montant, date, mode, référence) ; la
  barre et les métriques se mettent à jour. L'historique des encaissements apparaît
  en bas de page.
- Dans le **Calculateur (+ Vente)** : sélectionnez un client → un **banner crédit**
  s'affiche (impayé / plafond) et s'il est **bloqué**, le serveur **refuse** la
  vente avec un message français clair.

### Séchage & Séchoir (nouveau)
- Entrée **♨ Séchage & Séchoir** dans la barre latérale.
- **3 séchoirs de démonstration** (SEC-1 / SEC-2 Casablanca, SEC-3 Tanger) avec
  capacité en m³ et barre d'occupation calculée en direct sur les lots « En cours ».
- Indicateurs : séchoirs en service, capacité engagée (% d'occupation), lots en
  cours, coût énergie engagé et durée moyenne d'un cycle.
- **5 lots de démonstration** : en cours (barre humidité départ → actuelle → cible),
  terminés, annulés ; le stade humidité (Vert / Séché à l'air / Sec Séchoir) est
  **dérivé automatiquement** du taux actuel.
- **✓ Terminer** un lot : enregistre l'humidité finale, passe le produit en
  « kiln-dried » (visible dans l'Inventaire) et **répercute le coût énergie**
  sur le prix (MAD/m³ — coût et vente montent ensemble).
- **+ Nouveau Cycle** : charge un séchoir (produit, séchoir, quantité, humidités,
  coût énergie, fin estimée). **Annuler** abandonne le cycle sans toucher au produit.
  Le serveur **refuse toute charge dépassant la capacité disponible** du séchoir
  (message « Capacité insuffisante » affiché dans l'application).
- **Clic sur une carte séchoir** → historique complet de ses cycles ; badge
  **⚠ Dépassement** si la charge dépasse la capacité, et aperçu du volume estimé
  dans le formulaire avant ouverture du cycle.

### Facturation & Règlements (nouveau)
- Entrée **🧾 Facturation** dans la barre latérale (admin uniquement).
- **4 onglets** : Factures · Facturer des BL · Avoirs · Historique des paiements.
- **Registre des factures** : résumé par statut (Réglée 🟢 / En attente d'échéance
  🔵 / Partiellement réglée 🟡 / Non réglée / En retard 🔴), solde dû, BL attachés
  et avoirs déjà déduits. Export CSV SAGE/Ciel filtrable par client / période / statut.
- **Facturer des BL** : liste des bons de livraison livrés et non facturés →
  cochez des BL, validez → facture mensuelle regroupée (`FC…`, TVA 20 %, net à payer
  en chiffres **et en toutes lettres** en français).
- **Avoirs** : créez un avoir lié à une facture d'origine (motif, m³, montant),
  plafonné au solde de la facture ; le reste crédite automatiquement le client.
- **Règlements** : enregistrez un paiement (montant, date, mode de règlement —
  Chèque, Traite 30/60/90j, Virement, Espèces — banque, référence, échéance) ;
  badge de statut mis à jour en direct.
- **Relances** : WhatsApp (lien wa.me pré-rempli avec total TTC + échéance + RIB)
  et e-mail (SMTP) directement depuis la ligne de facture.
- Le même registre est consultable côté **Espace Pro** (`/pro/factures`).

### Remises par volume (nouveau)
- Dans le **Calculateur**, entrez un gros volume (≥ 25 m³) → une puce **−5 % ·
  Tarif gros** apparaît sur le total, recalculé en direct via `/api/pricing/lookup/`.
- La remise est **appliquée côté serveur** à la création de la vente (palier +
  montant remisé stockés sur la commande), visible dans Transactions et sur le PDF.

### Journal d'Audit (nouveau)
- Entrée **✍ Journal d'Audit** dans la barre latérale (réservé aux admins).
- Tableau chronologique : date, utilisateur, action, entité, référence, détails, IP.
- Filtres : action, entité, utilisateur, recherche, plage de dates.
- Chaque connexion, modification, téléchargement, réappro et clôture y figure —
  l'argument **traçabilité / conformité** à montrer en fin de démo. Retestez les
  boutons Facture/Devis précédents : les téléchargements apparaissent dans le journal.

### Détail qui impressionne
- Tentez une vente de quantité excessive → le serveur renvoie
  **« Insufficient stock »** et un **toast rouge** s'affiche (aucun stock négatif possible).

## 3. Si besoin de re-créer les données de démo

```powershell
cd backend
python seed_demo.py          # inventaire + clients + ventes
python seed_facturation_demo.py  # BL de démo, facture, avoir, règlement
```

Idempotent : relancez-les sans risque.

## 4. En cas de problème

| Problème | Solution |
| --- | --- |
| Port 8001 déjà utilisé | Fermez l'ancienne fenêtre serveur, relancez `start_demo.bat`. |
| Page blanche | Vérifiez que la fenêtre backend affiche bien `runserver`. |
| Données manquantes | Relancez `python seed_demo.py` (backend arrêté ou après). |
