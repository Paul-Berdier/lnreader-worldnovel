# Projet personnel WorldNovel VNH

- Périmètre : ce dépôt uniquement. Aucun matériel, compte ou service Prooftag.
- Plugin TypeScript dans `src/`. Runtime cible LNReader Android stable 2.1.3 ; vérifier les imports dans `docs/runtime-audit.md` avant ajout. Aucun Node, DOM ou navigateur externe à l’exécution du plugin.
- Outils de développement/diagnostic dans `tools/`, tests synthétiques dans `tests/`, publication minimale dans `dist/`.
- Validation : `npm ci --ignore-scripts`, puis `npm run check`. Le build régénère bundle, manifestes et icône depuis les métadonnées du plugin. Tests connectés : séparés et facultatifs, jamais dans la CI.
- Ne jamais publier `.local/`, `.research/`, profils, cookies, jetons, HAR, sauvegardes ou texte de chapitre. Aucun log de corps de réponse de lecture. Ne pas exécuter le JavaScript distant pour le parser.
- Le dépôt distant existe et est public. Toute première publication publique exige l’accord précis de l’utilisateur ; travailler sur `codex/`, ne pas fusionner ni modifier la visibilité sans autorisation.
- Maintenir des résultats PASS/FAIL/BLOCKED/NOT_RUN honnêtes. Une compilation ou des fixtures synthétiques ne prouvent pas un fonctionnement réseau ni Android.
- Conserver NovelFrance et la bibliothèque personnelle. La migration native stable supprime l’ancienne entrée : ne pas la déclencher automatiquement.
