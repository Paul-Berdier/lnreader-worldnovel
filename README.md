# WorldNovel VNH pour LNReader

**Version expérimentale 0.1.0, cible Android LNReader 2.1.3. La lecture n’est pas réparée à ce stade. Ne migrez pas votre bibliothèque NovelFrance.**

Ce dépôt personnel contient un véritable bundle de plugin LNReader, avec une identité distincte `worldnovel-vnh`, et ses outils de validation. Il ne remplace ni WorldNovel officiel ni NovelFrance. Ce bundle s’installe dans LNReader sans serveur permanent ni ordinateur allumé ; sa lecture reste toutefois bloquée, comme détaillé ci-dessous.

## État exact

- Bundle CommonJS, manifeste et icône générés dans `dist/` ; installation dans l’émulateur Android vérifiée.
- Sélections d’accueil : extraction des cartes réelles, déduplication et pages locales de 20. Cela ne représente pas tout le catalogue.
- Recherche : implémentée sur **l’index utilisé par le site**, `searchCache`, lu depuis le snapshot localStorage du WebView. Cache absent/expiré : erreur explicite et procédure de rafraîchissement. Ce parcours réel sur Android reste à valider.
- Fiches et chapitres : parseur des données Next.js, encodage des identifiants, tri numérique, volumes et contrôle du nombre annoncé. Les résultats réseau détaillés sont dans [les tests](docs/test-results.md).
- **Lecture : bloquée.** La requête du lecteur vers le CDN est identifiée dans le code public : elle exige Firebase Auth et App Check, que le pont de plugins stable ne fournit pas. Aucun appel authentifié réussi n’a été obtenu. `parseChapter` lève une erreur sans requête inutile ; il ne renvoie jamais une page intermédiaire comme téléchargement réussi.
- Version d’essai publiée avec autorisation le 23 septembre 2026 sur la branche `codex/worldnovel-vnh`. [Manifeste d’installation vérifié](https://raw.githubusercontent.com/Paul-Berdier/lnreader-worldnovel/codex/worldnovel-vnh/dist/plugins.min.json) : JSON, bundle et icône accessibles sans authentification, empreintes identiques aux fichiers testés. [PR de revue en brouillon](https://github.com/Paul-Berdier/lnreader-worldnovel/pull/1), sans fusion dans `main`.

Le code officiel WorldNovel 2.2.0 utilise encore Madara et une route `page/1/?s=&post_type=wp-manga`. Le site actuel sert des fiches `/oeuvres/…`. Les clients HTTP rencontrent Cloudflare ; les navigateurs de diagnostic rencontrent aussi une garde anti-outils de développement qui redirige vers Discord. Rejoindre Discord ne répare pas le plugin. Voir [l’audit général](docs/audit.md), [l’audit du runtime](docs/runtime-audit.md) et [l’analyse de session](docs/site-session-audit.md).

La [proposition d’adaptation minimale de LNReader](docs/minimal-runtime-adaptation.md) décrit une piste pour la lecture, avec une APK distincte et une maintenance supplémentaire. Elle nécessite votre accord et n’est ni implémentée ni garantie.

## Installation de l’essai

Créer une sauvegarde dans LNReader, puis **More → Settings → Repositories → Add** et coller :

```text
https://raw.githubusercontent.com/Paul-Berdier/lnreader-worldnovel/codex/worldnovel-vnh/dist/plugins.min.json
```

Dans **Browse → Plugins**, activer la langue **Français** si nécessaire et installer **WorldNovel VNH**. La source apparaît ensuite dans **Sources**. Cette installation ne débloque pas la lecture des chapitres. Conserver NovelFrance et ne pas lancer de migration. [Guide complet et retour arrière](docs/installation.md).

## Développement local

Prérequis vérifiés : Node 24.19.0 et npm 11.17.0.

```powershell
npm ci --ignore-scripts
npm run check
```

`check` lance le typage, le build et les tests hors ligne. Les données de test sont synthétiques. Le test du bundle reproduit le chargeur `exports.default` et les imports injectés par l’APK stable, avec rejet des imports indisponibles. Il ne simule pas une preuve de fonctionnement Android.

Pour le diagnostic facultatif avec Chrome installé :

```powershell
npm run diagnose -- --chrome --manual-browser --save-public-scripts
```

Le navigateur utilise un profil **dédié**, jamais le profil personnel. Validez vous-même toute demande du site. Appuyez sur Entrée dans le terminal pour terminer. Aucun jeton à copier. L’outil ne désactive aucune protection ; une redirection anti-debug reste un blocage. Voir [le guide du diagnostic](docs/diagnostic-tool.md).

## Organisation et documents

- `src/` : plugin exécuté dans LNReader ; aucune API Node, DOM, IndexedDB ou Playwright.
- `tools/` : build, diagnostic et serveur loopback temporaire réservé aux tests Android.
- `tests/` : tests synthétiques et vérification des dépendances du bundle.
- `dist/` : seuls fichiers nécessaires à une future installation.
- `.local/`, `.research/` : fichiers privés de travail exclus de Git ; aucune session ou réponse brute publiée.
- [Installation et retour arrière](docs/installation.md), [recherche et cache](docs/search-cache.md), [numérotation et migration](docs/chapters-and-migration.md), [publication](docs/publication.md), [test Android](docs/android-test.md).

Licence MIT pour ce code. Voir [les attributions](THIRD_PARTY_NOTICES.md). Aucun texte de roman n’est distribué.
