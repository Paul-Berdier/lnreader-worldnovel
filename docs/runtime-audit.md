# Audit du runtime LNReader Android

Audit du 23 septembre 2026. Lecture de sources publiques, sans exécution du code téléchargé et sans modification de LNReader. Ce document décrit la compatibilité du runtime ; il ne prouve pas à lui seul que WorldNovel fournit un chapitre lisible.

## Références examinées

| Projet | Référence exacte | Vérification |
| --- | --- | --- |
| LNReader Android | `v2.1.3`, `cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947` | API GitHub `releases/latest` : `prerelease: false`, publication `2026-08-23T13:56:13Z` ; archive du tag lue |
| lnreader-plugins | `master`, `04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984` | README, quickstart, contrat, tests, compilateur et génération du manifeste lus |
| React Native | `v0.86.0`, `a632f9efe24bac8b3a113c78469948f55bde0f5d` | Version du verrou LNReader, fichiers réseau Android lus |
| react-native-webview | `13.17.0` | Version résolue dans le verrou LNReader, configuration de l'écran WebView lue |

La [release ciblée](https://github.com/lnreader/lnreader/releases/tag/v2.1.3) a été déterminée par une requête fraîche à l'[API GitHub](https://api.github.com/repos/lnreader/lnreader/releases/latest). Une copie web mise en cache présentait encore 2.1.3 comme préversion et 2.1.0 comme dernière stable ; cette copie n'a pas été retenue. La version réellement installée sur le téléphone de l'utilisateur n'a pas été lue.

Les versions natives sont consignées dans le [verrou du tag](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/pnpm-lock.yaml#L128) (`react-native`, lignes 128–130 ; `react-native-webview`, lignes 182–184). Les archives de recherche restent locales dans `.research/runtime`, hors livrable.

## Contrat réellement disponible

Le [chargeur de plugins](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/pluginManager.ts#L30) évalue un module CommonJS et prend `exports.default`. Il injecte une liste précise de bibliothèques via `require` (lignes 30–63) :

| Module | Exports disponibles |
| --- | --- |
| `cheerio` | `load` |
| `htmlparser2` | `Parser` |
| `dayjs` | objet/fonction dayjs |
| `urlencode` | `encode`, `decode` |
| `@libs/fetch` | `fetchApi`, `fetchText`, `fetchProto` |
| `@libs/storage` | `storage`, `localStorage`, `sessionStorage`, propres à l'identifiant du plugin |
| `@libs/novelStatus` | `NovelStatus` |
| `@libs/filterInputs` | `FilterTypes` |
| `@libs/isAbsoluteUrl` | `isUrlAbsolute` |
| `@libs/defaultCover` | `defaultCover` |
| `@libs/aes` | `gcm` |
| `@libs/utils` | `utf8ToBytes`, `bytesToUtf8` |

Un import Node, Playwright, Firebase ou une autre bibliothèque n'est pas résolu automatiquement. Les types n'ajoutent aucune capacité au téléphone. L'application charge toutefois le [polyfill URL](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/App.tsx#L1), ce qui permet d'utiliser `URL` pour construire les chemins.

Le [contrat Android](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/types/index.ts#L54) comprend `popularNovels(page, options)`, `searchNovels(term, page)`, `parseNovel(path)` et `parseChapter(path)`. `parseChapter` renvoie une chaîne HTML. `parsePage` et `SourceNovel.totalPages` existent pour la pagination des listes de chapitres. `chapterNumber` est facultatif dans l'interface et doit correspondre à une numérotation réellement fournie par la source lorsqu'elle existe.

Limite concrète de l'application : [l'insertion dans la bibliothèque](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/database/queries/ChapterQueries.ts#L78) remplace un `chapterNumber` absent par `index + 1`. Supprimer un numéro local de volume ne permet donc pas de conserver un numéro « inconnu » dans cette version : cela produit un numéro global d'affichage dérivé de la position. Conserver les numéros effectivement fournis et préciser le volume dans le titre évite cette substitution pour les chapitres numérotés. Pour un interlude sans numéro source, cette substitution demeure un comportement de LNReader à distinguer des données du site.

### Réseau et erreurs

[`fetchApi`](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/helpers/fetch.ts#L43) ajoute les en-têtes usuels et appelle le `fetch` React Native. Il ne refuse pas lui-même les statuts HTTP d'erreur : le plugin doit contrôler `status`, `ok` et le corps vide. `fetchText`, lignes 76–99 du même fichier, capture les échecs et renvoie une chaîne vide ; il ne permet pas à lui seul de distinguer 404, 403, 429 ou une erreur réseau. Utiliser `fetchApi` pour conserver ce diagnostic.

### Cookies, stockage et session

Le partage Android des **cookies HTTP** dispose d'un fondement concret : [NetworkingModule](https://github.com/facebook/react-native/blob/a632f9efe24bac8b3a113c78469948f55bde0f5d/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/NetworkingModule.kt#L174) installe `JavaNetCookieJar(ForwardingCookieHandler)`. [ForwardingCookieHandler](https://github.com/facebook/react-native/blob/a632f9efe24bac8b3a113c78469948f55bde0f5d/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/ForwardingCookieHandler.kt#L18) lit et écrit le `CookieManager` Android du WebView. [XMLHttpRequest](https://github.com/facebook/react-native/blob/a632f9efe24bac8b3a113c78469948f55bde0f5d/packages/react-native/Libraries/Network/XMLHttpRequest.js#L157) active par défaut `withCredentials` ; le module natif désactive son cookie jar si cette option est fausse (NetworkingModule, ligne 371). Ce mécanisme respecte les cookies applicables à l'URL ; il ne transfère pas automatiquement des jetons stockés ailleurs. Le fonctionnement réel avec la session WorldNovel de l'utilisateur reste à vérifier sur Android.

`webStorageUtilized` n'est pas un navigateur programmable. Dans [WebviewScreen](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/screens/WebviewScreen/WebviewScreen.tsx#L66), le seul script injecté sérialise `{localStorage, sessionStorage}` (lignes 92–93). Les données reçues sont temporairement conservées, puis copiées dans MMKV lorsque l'utilisateur quitte par les chemins de retour prévus (lignes 66–89 et 109–110). Il s'agit d'un instantané à la suite du chargement, pas d'une synchronisation continue de l'authentification SPA.

Les classes [LocalStorage et SessionStorage](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/helpers/storage.ts#L94) exposent seulement `get()` sur cet instantané (lignes 94–119). Elles n'exposent ni `getItem`, ni `setItem`, ni IndexedDB. Le `storage` du plugin est un autre magasin, persistant, avec `get/set/delete/clearAll/getAllKeys` et expiration facultative ; il n'est pas le stockage du site.

Aucune méthode de la table d'injection n'autorise un plugin à naviguer un WebView distant, lire son DOM, exécuter le SDK Firebase dans l'origine du site, accéder à son IndexedDB ou demander une attestation App Check. Une session qui dépendrait indispensablement de telles opérations ne peut pas être déclarée prise en charge grâce au seul drapeau `webStorageUtilized`.

### `customJS` et lecteur

Le [gestionnaire d'installation](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/pluginManager.ts#L125) télécharge `customJS` dans `custom.js`. Le [lecteur](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/screens/reader/components/WebViewReader.tsx#L315) construit son propre document HTML à partir de `processedHtml`, avec éventuellement `baseUrl = plugin.site`, puis charge `custom.js` (ligne 420). Cela n'exécute pas le plugin dans la page distante Next.js de WorldNovel et ne remplace pas une récupération réussie du chapitre. Aucune ressource `customJS` ne doit être annoncée comme passerelle d'authentification distante sans modification et validation supplémentaires du runtime.

Si le site exige effectivement un contexte navigateur pour la lecture, la plus petite adaptation plausible se situerait dans une API explicite entre le service de plugins et un WebView autorisé : origine limitée, durée bornée, restitution du contenu validé et absence de journalisation de session. Elle nécessiterait une modification LNReader, donc l'accord de l'utilisateur avant d'en faire une dépendance. Copier un jeton manuel n'est pas une solution pérenne. Cette possibilité technique n'a pas été implémentée dans l'application.

## Build, manifeste et installation

Les [README](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/README.md), [quickstart](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/docs/quickstart.md), [contrat documenté](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/docs/docs.md) et [guide de tests](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/docs/testing.md) officiels ont été lus.

Les commandes existantes du dépôt officiel sont `build:compile` (TypeScript), `build:manifest`, `lint`, `format:check`, `check:plugin` et `dev:start`. Ce dernier lance aussi le générateur multisource ; il ne faut pas copier le catalogue complet pour un unique plugin personnel. Le build de production officiel est CommonJS/ES5 avec minification ; le test connecté utilise esbuild Node 22. Le nom `check:plugin` ne garantit donc pas une simulation du runtime Android : [sa configuration](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/scripts/live-check-plugin.js#L78) incorpore les bibliothèques locales avec des alias, au lieu de vérifier les seuls modules injectés dans l'APK. Un test séparé du bundle livré est nécessaire.

Le manifeste est un **tableau JSON**, pas une URL de dépôt Git ni un APK. Les [champs Android](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/types/index.ts#L97) sont `id`, `name`, `site`, `lang`, `version`, `url` (JavaScript compilé) et `iconUrl`, plus éventuellement `customJS/customCSS`. Le [générateur officiel](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/scripts/build-plugin-manifest.js#L111) dérive les métadonnées de l'instance et des chemins du build. La langue française exacte du manifeste est [`Français`](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/scripts/languages.js#L5).

L'[écran des dépôts](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/screens/settings/SettingsRepositoryScreen/SettingsRepositoryScreen.tsx#L49) contrôle une URL HTTP(S) contenant `plugins.min.json`. La [page officielle](https://www.lnreader.app/plugins) décrit : paramètres → dépôts → coller l'URL → actualiser → installer la source. Les fichiers doivent être accessibles au téléphone ; un dépôt GitHub privé n'est pas automatiquement accessible par cette méthode. Ne jamais incorporer de jeton GitHub dans l'URL du manifeste.

Le chargeur déduplique les plugins par `id`, et les mises à jour utilisent cet identifiant et la version. L'identité personnelle doit donc rester distincte (`worldnovel-vnh`). Le [comparateur](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/utils/compareVersion.ts#L1) retire les caractères autres que chiffres/points : des versions numériques monotones sont plus sûres qu'un suffixe préversion ; le caractère expérimental doit être explicite dans la documentation.

## Migration depuis NovelFrance

Le runtime propose une migration avec choix de couverture, métadonnées et retéléchargement dans [MigrationReviewDialog](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/screens/browse/migration/MigrationReviewDialog.tsx#L28). Le [traitement](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/services/migrate/migrateNovel.ts#L136) supprime toutefois l'ancienne entrée, puis rapproche les chapitres par `chapterNumber` seulement (lignes 156–178), sans vérifier leurs titres ou volumes. Le retéléchargement des anciens téléchargements est activé par défaut dans l'interface.

Pour respecter la conservation demandée de NovelFrance : créer d'abord une sauvegarde, relever numéro **et titre** du dernier chapitre lu, tester WorldNovel VNH à côté de l'ancienne source, puis reporter la progression manuellement après comparaison. Ne pas déclencher la migration native tant que la suppression de l'ancienne entrée n'est pas acceptée. Ne pas promettre une conservation parfaite des états, particulièrement lorsque plusieurs volumes reprennent la même numérotation. Aucune base de bibliothèque n'a été modifiée par cet audit.

## Statut des preuves

| Vérification | Statut | Portée |
| --- | --- | --- |
| Dernière release non-préversion via API fraîche | PASS | Tag et commit vérifiés ci-dessus |
| Contrat, bibliothèques et manifeste au tag ciblé | PASS | Inspection statique des sources |
| Absence de passerelle plugin vers IndexedDB / WebView distant | PASS | Table des injections, écran distant et lecteur examinés |
| Chemin natif de partage des cookies Android | PASS | Inspection React Native à version verrouillée |
| Session WorldNovel après connexion/expiration/déconnexion/redémarrage | NOT_RUN | Nécessite le site et un environnement Android autorisé |
| Installation, navigation et lecture dans l'APK | NOT_RUN | Aucun test Android effectué dans cet audit |
| Migration de bibliothèque réelle | NOT_RUN | Aucune modification des données utilisateur |

Les résultats du plugin et du site doivent rester séparés de ces preuves statiques. En particulier, un chapitre impossible à obtenir avec la session et les API réellement accessibles ne peut pas être marqué PASS à partir d'une fixture synthétique ou d'un test Node.
