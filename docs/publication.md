# Publication de la version d’essai

Publication publique autorisée par l’utilisateur et réalisée le **23 septembre 2026** sur [Paul-Berdier/lnreader-worldnovel](https://github.com/Paul-Berdier/lnreader-worldnovel). Le compte connecté et le dépôt public vide ont été revérifiés avant l’écriture. La visibilité n’a pas changé.

## État distant vérifié

- `main` : `70b96bb054f2da9d6410b1b15d17ee0d3d778e78`, commit initial vide permettant la revue du travail dans une PR.
- Code du plugin sur `codex/worldnovel-vnh` : `c70a7d6a7c7bab14cdfa78c1728b0730912c35de`. Les mises à jour documentaires de publication suivent sur cette même branche.
- [PR n°1](https://github.com/Paul-Berdier/lnreader-worldnovel/pull/1) ouverte en brouillon, sans fusion automatique. Aucun envoi aux mainteneurs LNReader.
- [Validation GitHub du code publié](https://github.com/Paul-Berdier/lnreader-worldnovel/actions/runs/35872857189) : terminée avec succès.

Le manifeste d’installation public est :

```text
https://raw.githubusercontent.com/Paul-Berdier/lnreader-worldnovel/codex/worldnovel-vnh/dist/plugins.min.json
```

Le 23 septembre à 14:15:52 UTC, les téléchargements sans authentification des deux manifestes, du bundle et de l’icône ont reçu HTTP200 avec exactement les octets attendus. Vérifications supplémentaires : JSON valide, métadonnées cohérentes, signature PNG et chargement du bundle avec le wrapper stable et ses seuls imports autorisés. Les empreintes sont consignées dans [test-results.md](test-results.md).

**La publication n’est pas une validation de lecture.** Cette version expérimentale 0.1.0 s’installe, mais refuse la récupération des chapitres faute de capacité Firebase Auth/App Check dans le pont stable. Le catalogue Android peut aussi rester bloqué par Cloudflare. Conserver NovelFrance.

## Contenu publié et exclusions

Les 49 fichiers revus appartiennent à `.gitignore`, `.github/workflows/validate.yml`, `AGENTS.md`, `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `src/`, `tests/`, `tools/`, `docs/` et `dist/`.

Aucun profil, session, secret, donnée personnelle privée ou texte de roman n’a été trouvé dans ce contenu. Les fixtures sont synthétiques. L’identifiant GitHub public est nécessaire aux URL ; les commits utilisent l’adresse GitHub noreply. `.local/`, `.research/`, `node_modules/`, sauvegardes et traces de navigation sont exclus de Git.

La CI `Validate` dispose uniquement de `contents: read`, installe les dépendances verrouillées avec `--ignore-scripts`, compile et teste hors ligne, puis vérifie la reproductibilité de `dist/`. Aucun secret, compte de lecture, navigateur connecté, tâche périodique, téléchargement de roman ni publication automatique.

## Suite et retour arrière

Garder les URL et l’identité du plugin pour les prochaines versions autorisées ; vérifier à nouveau le commit, le workflow et tous les fichiers distribués. Ne pas supprimer la branche de distribution tant que son manifeste est utilisé. Une fusion, un changement de visibilité ou l’adoption d’une APK LNReader modifiée n’est pas autorisé par cette publication.

Pour retirer l’essai du téléphone : désinstaller seulement WorldNovel VNH et retirer son dépôt, en conservant NovelFrance et la sauvegarde. [Guide Android](installation.md).
