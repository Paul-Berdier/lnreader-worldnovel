# Résultats — 23 septembre 2026

**La lecture réelle reste BLOCKED. Le projet n’est pas une réparation complète.**

## Vérifications hors ligne

Résultat final : **80 tests PASS, 0 FAIL**, typage et build PASS. Commande : `npm run check` = TypeScript strict, build minimal CommonJS puis `node --test tests/*.test.mjs`. Données synthétiques uniquement. Le bundle est évalué avec le wrapper exact `exports.default` du runtime stable et seulement les objets injectés vérifiés (`cheerio`, `@libs/fetch`, `@libs/storage`). Node, DOM, navigateur, IndexedDB et fetch global ne sont pas fournis.

| Vérification | Statut | Preuve / portée |
|---|---|---|
| TypeScript strict et génération bundle/manifeste/icône | PASS | Commande `npm run check` exécutée localement ; métadonnées communes, versions cohérentes |
| Extraction cartes accueil, déduplication, pagination et fin | PASS | Tests `catalogue.test.mjs`, pages distinctes de 20 |
| Index recherche complet du site en cache, accents/Unicode, aucun résultat, expiration | PASS | Tests `search.test.mjs` ; aucune recherche réduite aux cartes d’accueil |
| Métadonnées, numéros source, ordre numérique, volumes, encodage RFC3986, totaux et dates | PASS | Tests `novel.test.mjs` ; limite des numéros manquants côté APK documentée |
| Flight fragmenté, JSON imbriqué, références, UTF8, hints, erreurs, profondeur, pollution prototype | PASS | Tests `flight.test.mjs` ; aucun eval/Function de JavaScript distant |
| HTTP401/403/404/429/500, Retry-After, réponses vides, redirections et modales | PASS | Tests `network.test.mjs`, aucun retry agressif |
| Corps synthétique, aperçu/connexion/CAPTCHA/notice et HTML dangereux | PASS | Le plugin refuse toute lecture faute de capacité ; nettoyeur testé séparément, **pas validé sur texte/CSS réels** |
| Bundle avec chargeur stable, exports, dépendances et recherche snapshot | PASS | Tests `bundle.test.mjs` ; un import Node indisponible échoue |
| Expurgation du diagnostic et arrêt auth/CAPTCHA | PASS | Tests `diagnostic-redaction.test.mjs` et `diagnostic-flow.test.mjs` |

Les commandes officielles `build:multisrc`, `build:compile`, `build:manifest`, `build:full`, `lint`, `format:check`, `check:sites` et `check:plugin` ont été lues dans le dépôt officiel. Les générateurs globaux de 280 sources, leur UI de développement et leurs publications n’ont pas été exécutés dans ce dépôt minimal. La validation locale couvre le typage, le contrat, le manifeste et le chargeur effectivement utilisés. Aucun succès d’une suite officielle complète n’est revendiqué.

## Réseau réel et navigateur

| Essai | Statut | Observation |
|---|---|---|
| URL réellement formée par WorldNovel officiel publié | PASS | `https://world-novel.fr//page/1/?s=&post_type=wp-manga`, version2.2.0 Madara |
| Reproduction du 404 du téléphone | NOT_RUN | Téléphone et plugin installé non inspectés ; l’URL exacte reçoit ici 403, pas404 |
| HTTP ordinaire accueil et fiche | BLOCKED | 403 Cloudflare avec `Cf-Mitigated`, distinct d’une panne du site |
| Navigation complète de diagnostic accueil → recherche | BLOCKED | Garde anti-devtools et redirection externe ; aucun contournement |
| Parsing réel fiche Shadow Slave | PASS | 14 records Flight, 14 volumes, 3 174 annoncés / 3 174 parsés |
| Parsing réel autre fiche The Mech Touch | PASS | 14 records Flight, 1 volume, 392 annoncés / 392 parsés |
| Erreur initiale du parseur sur données réelles | FAIL puis corrigée | Hints `:HL` sans id non pris en charge ; correction protocolée + tests ; les deux fiches réelles passent ensuite |
| Route d’un chapitre issue de la fiche | BLOCKED | HTTP200 shell Next.js, 0 paragraphe/0 article ; texte et complétude non validés |
| Index Firestore sans authentification | BLOCKED | GET document observé `sauvegarde/userpage` : 403 PERMISSION_DENIED ; aucune tentative de contournement |
| Requête CDN identifiée dans le code client | PASS | Firebase Auth + App Check requis par client ; c’est une preuve statique, pas un appel authentifié réussi |
| Texte réel d’un chapitre accessible | BLOCKED | Aucun texte téléchargé/validé par le plugin |
| Session absente/expirée, déconnexion, redémarrage après connexion | NOT_RUN | Aucun compte connecté au diagnostic ; simulations HTTP et cache ne remplacent pas ces tests |

Les réponses HTML de fiche ont été analysées **en mémoire**, puis réduites à des compteurs. Aucun texte de chapitre, HAR, cookie, jeton ou capture de roman n’est inclus dans les rapports. Les scripts clients publics étudiés sont exclus de Git sous `.research/`.

## Android réel (émulateur, pas téléphone)

APK officiel LNReader2.1.3 x86_64, SHA256 vérifié. AVD neuve `WorldNovel_API_35`, serial `emulator-5580` ; données de l’AVD personnelle non copiées.

| Essai | Statut | Preuve |
|---|---|---|
| Démarrage Android35, installation APK, version et lancement | PASS | boot_completed=1 ; install Success ; versionName2.1.3/versionCode4196355 ; MainActivity lancée |
| Ajout manifeste de développement, plugin WorldNovel VNH, identité et installation | PASS | Dépôt loopback visible ; Français activé ; WorldNovel VNH0.1.0 passe de Install à Installed |
| Ouverture source et chargement du bundle | PASS | Source ouverte, dépendances résolues ; erreur réseau émise par notre code |
| Catalogue source | BLOCKED | Message réel du plugin : accès refusé403 |
| Recherche Shadow Slave | BLOCKED | Saisie faite ; l’APK affiche l’erreur catalogue prioritaire, résultat recherche séparé non concluant |
| WebView de la source | BLOCKED | Ouverture effective ; page Cloudflare « Just a moment » et CAPTCHA visible, non résolu |
| Fiche et lecture dans l’application | NOT_RUN | Accès source bloqué en amont |
| Installation et lecture sur le téléphone personnel | NOT_RUN | Aucun téléphone connecté ou modifié |

L’import Android a précédé les dernières corrections du parseur Flight et du message de lecture ; leur bundle final est revalidé hors ligne. Il ne s’agit pas d’un essai de lecture Android réussi. Le reverse ADB, l’application, l’émulateur dédié et le serveur temporaire ont été arrêtés après le test. Détails : [android-test.md](android-test.md).

## Publication

Empreintes SHA256 des fichiers locaux vérifiés :

```text
33693ba8c2a295312a860dd31e5430d503b90f3c64c3184f4fc3dd8f8df10aac  dist/worldnovel-vnh.js
afc16dda242ccf803c56a3836a45e57573ee191134133b2f0cc40ce3e94da0c5  dist/plugins.min.json
7a5d814113298aac01d2be51158d0b9a1191daee42cc1e88e52a256f0219d4af  dist/worldnovel-vnh.png
```

Publication publique autorisée puis effectuée le 23 septembre 2026 : **PASS**. Le commit distant du code publié est `c70a7d6a7c7bab14cdfa78c1728b0730912c35de`, sur `codex/worldnovel-vnh`. La base `main` contient seulement le commit initial vide `70b96bb054f2da9d6410b1b15d17ee0d3d778e78`. La [PR n°1](https://github.com/Paul-Berdier/lnreader-worldnovel/pull/1) reste ouverte en brouillon, sans fusion.

Le [workflow du commit publié](https://github.com/Paul-Berdier/lnreader-worldnovel/actions/runs/35872857189) est terminé avec succès : typage, build, tests hors ligne et contrôle de reproductibilité de `dist/`. La vérification anonyme du 23 septembre à 14:15:52 UTC a récupéré `plugins.min.json`, `plugins.json`, `worldnovel-vnh.js` et `worldnovel-vnh.png` : HTTP200, contenus et hashes identiques aux fichiers locaux. Le JSON est valide, les deux manifestes concordent, les métadonnées et imports du bundle chargé correspondent au contrat vérifié.

URL d’installation publiée et vérifiée : [plugins.min.json](https://raw.githubusercontent.com/Paul-Berdier/lnreader-worldnovel/codex/worldnovel-vnh/dist/plugins.min.json). Ces contrôles valident la distribution du plugin expérimental ; ils ne changent pas les statuts BLOCKED/NOT_RUN de lecture, session et téléphone ci-dessus. Aucun commentaire chez les mainteneurs LNReader.
