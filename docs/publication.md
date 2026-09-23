# Publication préparée, non effectuée

Cible vérifiée : dépôt existant **public et vide** `Paul-Berdier/lnreader-worldnovel`, compte connecté `Paul-Berdier`. La visibilité ne doit pas changer. Aucune PR, aucun commentaire ni correctif n’a été envoyé aux mainteneurs LNReader.

Le travail reste sur la branche dédiée `codex/worldnovel-vnh`. Le dépôt distant n’ayant aucun commit ni branche principale effective, une PR nécessitera d’abord une base distante (un commit initial vide peut remplir ce rôle), puis la branche de travail. Aucun merge automatique.

Avant la première écriture publique, demander une autorisation nommant explicitement ce dépôt et les fichiers suivants : `.gitignore`, `.github/workflows/validate.yml`, `AGENTS.md`, `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `src/`, `tests/`, `tools/`, `docs/`, `dist/`. Inspecter chaque fichier, confirmer l’absence de secrets, données personnelles privées, sessions et textes de romans. L’identifiant du compte GitHub et les références publiques des projets restent nécessairement visibles. Utiliser l’adresse de commit GitHub noreply, jamais une adresse personnelle.

Le build ne publie rien. Les manifestes `dist/plugins.min.json` et `dist/plugins.json` ciblent la branche de travail ; ces destinations restent théoriques tant qu’un push autorisé n’a pas eu lieu. Ne pas les présenter comme des liens d’installation actifs.

La CI `Validate` sépare validation et publication : elle n’a que `contents: read`, compile et teste hors ligne, puis vérifie que `dist/` est reproductible. Aucun secret, compte de lecture, navigateur connecté, tâche périodique, téléchargement de roman ni publication depuis une PR. Aucun workflow de publication automatique.

Après autorisation et push : vérifier SHA distant, résultat du workflow et PR. Récupérer sans authentification le manifeste JSON, puis chaque URL de bundle/icône ; contrôler le contenu, les métadonnées, les hashes et le chargement du bundle. Le statut HTTP200 seul ne suffit pas. Fournir ensuite seulement l’URL réellement publiée et vérifiée. Maintenir la mention expérimentale tant que lecture/session Android ne sont pas validées.

## Revue proposée

Titre : `Add experimental WorldNovel VNH source and verified runtime audit`.

Description : Le plugin WorldNovel officiel appelle encore des routes Madara alors que le site sert désormais des fiches Next.js. Cette variante personnelle conserve une identité distincte, extrait les métadonnées et chapitres, utilise l’index de recherche du site lorsqu’il est disponible dans le snapshot WebView et refuse d’enregistrer une page intermédiaire comme chapitre. La lecture observée dans le code public exige Firebase Auth et App Check, hors des capacités du pont de plugins stable ; aucun appel authentifié réussi n’est revendiqué. Le rapport de tests distingue tests synthétiques, réseau et installation Android. Cette PR ne doit pas être annoncée comme une réparation complète.
