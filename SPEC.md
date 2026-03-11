# Leni — Spécification Produit Complète

## Contexte

Outil solo, usage personnel. Pas de multi-tenant. Un seul utilisateur admin.
Coût cible : zéro hors VPS + tokens Claude API.
Objectif : remplacer 1h/jour de gestion réseaux sociaux par 10 minutes de validation.

---

## Flows utilisateur

### Flow 1 — Post viral lancement bêta Flipio

```
1. Dashboard → bouton "+" → sheet de composition
2. Persona = Flipio / Type = Viral / Plateforme = LinkedIn
3. Brief : "Lancement bêta imminente, je veux des inscrits, ton audacieux"
4. Claude génère 3 variantes avec score viralité estimé
5. Choix de la variante, ajustement si besoin
6. Planification : demain 8h30
7. Worker publie automatiquement à l'heure choisie
```

### Flow 2 — Deal terminé → capitalisation contenu

```
1. Upload 4 photos avant/après depuis téléphone
2. Remplir : ville=Paris 12e, stratégie=division, plus-value=85k€
3. Claude génère :
   → Post LinkedIn narratif (chiffres + leçons)
   → 4 slides carrousel Instagram (avant/après + stats)
4. Validation des deux
5. Planification : LinkedIn jeudi 9h / Instagram vendredi 18h
```

### Flow 3 — Veille automatique quotidienne

```
Chaque nuit à 6h :
1. Scrape 8 sources RSS + Reddit
2. Claude score chaque article 0-10
3. Articles > 7 → post généré automatiquement → queue
4. Articles 5-7 → digest dans le dashboard
5. Notification : "3 posts en attente de validation"
6. Validation en 2 minutes depuis le dashboard
```

### Flow 4 — Inbox batch quotidien

```
Chaque soir à 19h :
1. Extension Chrome poll la boîte LinkedIn
2. Nouveaux messages → envoyés au backend VPS
3. Claude classifie + rédige les réponses
4. Notification : "X réponses prêtes à valider"
5. Dashboard : cocher les réponses qui conviennent
6. Ajuster si besoin, supprimer les spams
7. Clic "Envoyer les sélectionnées" → fait
```

### Flow 5 — Mise à jour automatique des skills

```
Chaque lundi à 8h :
1. Algorithm Watcher scrape les sources algo
2. Claude analyse les changements vs règles actuelles
3. Confiance haute → skill mis à jour automatiquement
4. Confiance moyenne → notification avec bouton "Appliquer"
5. Digest email récapitulatif envoyé à 8h30
```

---

## Structure des skills dynamiques

### linkedin_post_texte.md v1.0

```markdown
# Skill : linkedin_post_texte
# Version : 1.0.0

## Règles de format
- Longueur : 900–1100 caractères
- Hashtags : 0 à 3 maximum, intégrés naturellement
- Une idée = une ligne courte
- Emojis : 1–2 maximum si naturels

## Structure obligatoire
1. ACCROCHE (ligne 1) : contre-intuitive ou chiffre choc
2. CORPS : 6–9 lignes courtes, rythme punchy
3. CTA FINAL : une seule action demandée

## À éviter
- Superlatifs vides (révolutionnaire, incroyable...)
- Post qui commence par "Je"
- Plus de 2 phrases longues consécutives
- Jargon sans explication
```

### linkedin_comment_trigger.md v1.0

```markdown
# Skill : linkedin_comment_trigger
# Version : 1.0.0

## Principe
L'algorithme LinkedIn booste les posts avec beaucoup de commentaires.
Demander de commenter un mot-clé est du growth hacking natif.

## Structure obligatoire
1. ACCROCHE forte (1 ligne, parfois fausse polémique)
2. CORPS : 8–12 lignes, monter la tension progressive
3. PROMESSE : ce que reçoit la personne qui commente
4. CTA : "Commentez [MOT_CLÉ] et je vous envoie [LIVRABLE]"

## 3 variantes à toujours générer
- Polémique douce : commence par une affirmation forte et contestable
- Storytelling : commence par "J'ai..." avec une situation réelle
- Chiffre choc : commence par un nombre surprenant

## Score de viralité (0-10)
Évaluer chaque variante sur :
- Force de l'accroche (3 pts)
- Clarté de la promesse (3 pts)
- Urgence / FOMO (2 pts)
- Simplicité du CTA (2 pts)
```

### instagram_caption.md v1.0

```markdown
# Skill : instagram_caption
# Version : 1.0.0

## Format
- Longueur : 150–300 caractères pour la partie visible
- Structure : phrase d'accroche → 2-3 lignes → hashtags en fin
- Hashtags : 20–30, mix niche + populaires
- Emojis : utilisés librement, 1 par idée max

## Hashtags immo recommandés (à adapter)
#immobilier #investissementimmobilier #marchanddebiens
#immobilierfrancais #investir #patrimoine #paris #idf
#renovation #division #flipimmo

## Ton
Plus personnel et visuel que LinkedIn.
Parler à la première personne, montrer les coulisses.
```

### inbox_reply.md v1.0

```markdown
# Skill : inbox_reply
# Version : 1.0.0

## Classification des messages

PROSPECT_FLIPIO : mentionne Flipio, SaaS, outils, logiciel, données immo
→ Réponse chaleureuse + mention places bêta + lien inscription

DEAL_MDB : parle d'un bien, d'une opération, d'un partenariat immo
→ Réponse courte + demander les détails du projet

NETWORKING : curiosité générale, veut échanger, pas de demande précise
→ Réponse courte et chaleureuse + proposer un appel si pertinent

SPAM : démarchage commercial, recrutement, MLM
→ Déclin poli en 1 phrase

PERSO : contexte personnel, famille, amis
→ NE PAS GÉNÉRER de réponse, flaguer pour traitement manuel

## Règles
- Jamais plus de 5 phrases
- Toujours terminer par une question ou une action
- Utiliser le prénom de l'interlocuteur
- Adapter le ton au profil (promoteur ≠ étudiant)
- Ne jamais promettre ce qui n'est pas dans le Context Engine
```

### veille_scoring.md v1.0

```markdown
# Skill : veille_scoring
# Version : 1.0.0

## Critères de score (0-10)

+3 : Directement actionnable pour un MdB ou promoteur
+2 : Réglementation ou fiscalité immo (impact fort)
+2 : Données de marché chiffrées (prix, volumes, tendances)
+1 : PropTech / innovation (si pertinent pour Flipio)
+1 : Sujet qui génère du débat / engagement prévisible
-2 : Sujet déjà traité cette semaine
-3 : Hors scope (résidentiel particulier, viager, international hors France)

## Décision
>7 : Générer un post automatiquement
5-7 : Soumettre pour validation manuelle
<5 : Ignorer

## Output attendu
JSON : { score: number, raison: string, persona: "flipio" | "mdb" | "both", suggestion_accroche: string }
```

---

## Context Engine — structure complète

### Persona Flipio

```json
{
  "identite": {
    "nom": "Flipio",
    "tagline": "La plateforme des marchands de biens",
    "url": "app.flipio.immo",
    "stade": "bêta privée"
  },
  "beta": {
    "places_disponibles": 47,
    "date_ouverture": "2025-04-01",
    "avantages": ["accès lifetime deal", "onboarding personnalisé", "influence roadmap"],
    "mot_trigger": "FLIPIO",
    "lien_inscription": "app.flipio.immo/beta"
  },
  "cible": {
    "profils": ["marchands de biens", "promoteurs", "agents immo investisseurs"],
    "douleurs": ["sourcing chronophage", "analyse DVF manuelle", "Excel pas scalable"],
    "anti_cible": ["particuliers", "agents transac classiques"]
  },
  "ton": {
    "style": "direct, expert, légèrement provocateur",
    "a_eviter": ["trop commercial", "superlatifs vides", "anglicismes inutiles"]
  },
  "faq": [
    {
      "question": "C'est quoi Flipio ?",
      "reponse": "Une plateforme qui agrège DVF, DPE et données cadastrales pour que les marchands de biens sourcent et analysent des deals en minutes au lieu d'heures."
    },
    {
      "question": "C'est gratuit ?",
      "reponse": "La bêta est gratuite avec accès complet. Ensuite abonnement mensuel — les bêta testeurs ont un tarif préférentiel à vie."
    },
    {
      "question": "Ça marche comment ?",
      "reponse": "Tu rentres une adresse ou une zone, Flipio croise DVF normalisé + DPE + copropriété et te sort une fiche d'analyse complète en 30 secondes."
    }
  ],
  "regles": "Toujours mentionner le nombre de places restantes quand quelqu'un demande un accès. Ne jamais promettre des fonctionnalités non encore développées. Si quelqu'un est hostile ou sceptique, ne pas insister."
}
```

### Persona MdB Perso

```json
{
  "identite": {
    "nom": "Théo",
    "activite": "Marchand de biens — Paris & IDF"
  },
  "operations": {
    "strategies_actives": ["division appartements", "bloc/détail", "rénovation revente"],
    "ticket_moyen": "300–800k€",
    "zone_cible": ["Paris intramuros", "Petite couronne", "villes >50k hab IDF"]
  },
  "criteres_deal": {
    "immeuble": [
      "Minimum 4 lots",
      "Potentiel de division existant (surface >40m² par lot créable)",
      "Pas de copropriété problématique"
    ],
    "appartement": [
      "Surface >60m² divisible",
      "Paris ou couronne avec tension locative forte"
    ]
  },
  "ce_que_je_ne_fais_pas": ["Viager", "Résidences services", "Hors IDF pour l'instant"],
  "ton": {
    "style": "pragmatique, terrain, chiffres concrets, pas de blabla"
  },
  "regles": "Toujours parler en chiffres concrets. Ne jamais donner de conseils juridiques ou fiscaux précis. Si quelqu'un cherche un associé ou propose un deal, demander les détails (ville, surface, prix demandé, état) avant de donner un avis."
}
```

---

## Algorithm Watcher — sources et fréquence

### LinkedIn
| Source | Type | Fréquence scrape |
|--------|------|-----------------|
| linkedin.com/blog | RSS/HTML | Hebdo |
| Richard van der Blom newsletter | HTML | Hebdo |
| Social Media Today | RSS | Hebdo |
| Later Blog | RSS | Hebdo |

### Instagram
| Source | Type | Fréquence scrape |
|--------|------|-----------------|
| creators.instagram.com | HTML | Hebdo |
| Adam Mosseri (threads.net) | HTML | Hebdo |
| Later Blog Instagram section | RSS | Hebdo |

---

## Extension Chrome — Inbox Manager

L'extension lit le DOM de linkedin.com/messaging et envoie les données au backend.

```javascript
// Structure du message envoyé au backend
{
  externalId: "urn:li:message:...",
  senderName: "Jean Dupont",
  senderRole: "Promoteur chez XYZ",
  senderProfileUrl: "https://linkedin.com/in/...",
  contenu: "Bonjour, j'ai vu votre post...",
  timestamp: "2025-03-10T14:30:00Z"
}

// Endpoint : POST https://{VPS_IP}:3001/api/inbox/sync
// Auth : Bearer token stocké dans les options de l'extension
```

---

## Priorités de build

| Phase | Modules | Durée estimée |
|-------|---------|---------------|
| 1 | Foundation (schema, auth, docker) | 3–4h |
| 2 | M11 Context Engine + M01 Content Agent | 2–3h |
| 3 | M01 Publisher LinkedIn | 2h |
| 4 | M02 Veille + M09 Viral On-Demand | 3h |
| 5 | M10 Inbox Manager (sans extension Chrome) | 3h |
| 6 | M03 Carnet de deal + M04 Ghostwriter | 2h |
| 7 | M12 Algorithm Watcher | 3h |
| 8 | M01 Publisher Instagram | 2h |
| 9 | Extension Chrome inbox | 3h |
| 10 | V2 : M05 Calendrier + M06 Newsletter | 4h |
