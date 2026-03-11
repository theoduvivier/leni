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
