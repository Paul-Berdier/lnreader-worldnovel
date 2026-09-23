# Session et lecture : analyse statique des scripts publics

Le 23 septembre 2026, analyse statique de 33 scripts publics déjà récupérés par le diagnostic dans le navigateur Chrome dédié : 13 scripts initiaux, trois scripts supplémentaires de la fiche œuvre, puis 17 nouveaux scripts lors du dernier parcours ordinaire. Le manifeste final identifie 31 URL ; les deux anciens scripts propres à l'accueil restent présents localement. Aucun script du site n'a été exécuté par l'analyseur, aucune nouvelle requête n'a été émise par cet audit statique et aucune session n'a été lue. TypeScript 5.9.3 a uniquement servi à analyser la syntaxe et à produire des copies lisibles dans `.research/site/formatted/` (33 fichiers, zéro erreur de syntaxe). Les fichiers bruts et formatés restent exclus du livrable.

## Résultat et limites

Le lecteur client a maintenant été identifié. Il attend un utilisateur Firebase connecté, renouvelle son jeton d'identité et une attestation App Check, puis demande le HTML au CDN. Le plugin LNReader 2.1.3 ne dispose pas d'une API pour exécuter ce parcours dans le contexte navigateur connecté. Une simple lecture HTTP de la route du chapitre ne suffit pas : la réponse observée est une enveloppe Next.js sans paragraphe ni article.

**PASS : endpoint et contrat du client identifiés dans les scripts publics. BLOCKED : lecture authentifiée, vérification des exigences côté serveur et cycle de session Android.** Aucune requête au CDN des chapitres n'a été fabriquée ou rejouée, aucun jeton ni texte de chapitre n'a été exporté. Les observations de scripts prouvent ce que fait le client publié ; elles ne constituent pas un test indépendant de l'application des contrôles par le serveur.

La redirection initiale vers Discord est expliquée par un garde navigateur de la première révision observée. Les scripts de lecture collectés plus tard ont une autre révision et un garde dirigé vers `/restreint`. Il serait incorrect de confondre ces deux versions ou de déduire l'état du compte d'une redirection.

## Preuves reproductibles

Les noms locaux sont les 24 premiers caractères du SHA-256 du chemin de l'URL du script. Ils ne doivent pas être présentés comme des noms de chunks publics. La deuxième collecte a enregistré le manifeste des URL de la fiche et a ainsi retrouvé les URL des principaux scripts communs. Les empreintes ci-dessous identifient exactement les contenus examinés. Les modules Webpack sont des repères indépendants du reformatage.

| Fichier local | SHA-256 du contenu brut | Repères |
| --- | --- | --- |
| `627cb3261eb84f803192b6bf.js` | `3b5672d2ba2e850b9b18ba443f572972587f5485a1f9d647932b31559e786ef8` | modules 52873, 57968, 96743 |
| `ac8778756b5f757e1076d777.js` | `c1ac6b4c7d62bf6c560d9f6ac5f5db2a433d7a3fba09c7037b94ef943044ecd1` | modules 3061 et 52709 |
| `608db3c45c9d1152a85ef2d5.js` | `b18bbfdf6b1dc16e4425c0830d1e328a6139d90662ceb83d7b010b31ca1df687` | module Auth compat, fonction `z` de sélection de persistance |
| `20445ebceb8f9ec696693579.js` | `bc3a5e7114227a70d56d40ec1572ab90669d2ec81ff2c61d0261ee7fc2a43dc8` | module 51117, classes `On`, `mn`, `gn` |
| `dccb27d62893412b0b7309e1.js` | `d2cb2747cc88ff9338cc26827884ce3f2b88b7e8611e01c7248c373e2d2ef73a` | fiche : modules 50437, 96881 et 47244 |
| `3ab24fd0b160982f858cf6a0.js` | `5c0335209d64a82cb3a0403ff5bf6b68736463a6dba117dfbb418b3bd4af5eee` | layout fiche : module 32350 |
| `42c17aa893569baa36175c11.js` | `e33a3e38983179a40592d360ea56894df03b47b67fd6760bf8868c74e69f2d5e` | bibliothèque de graphiques |
| `89f0d69c5987a4e82b882858.js` | `ac7b00fc20cf72068cb15a38e36954d4a3e390f193e94b2d94066199c3496c6f` | décodeur React Flight, fonctions `ce` et `fe` |
| `9ce4acdde7c440a694d612e7.js` | `78473da6598f8cfbe6745c21535b9d62014a2bf39ecca0bfe81212463dd7038d` | lecteur : module 1454, fonctions `A` et `en` |
| `2dd1317439f153e101cdd12a.js` | `8032478b33df1abc830e22948aa019c085151e31bcfbe1a4768bebc7b1e30062` | layout lecteur : garde 6174, maintenance 8670 |
| `6126a02ce20b2c61bde80bb6.js` | `d4998b8e093395d5d57ad58ba15fcf3a63f6a2843e26058789e7ee7eb8650897` | initialisation App Check : module 6743 |
| `7ea24d9f1165e720c7faa691.js` | `7f208c2d021f826625fd689b07e6de83627d9ac71d2065bb7195b1d8035a6305` | SDK App Check du lecteur |
| `333f77cdaf793756971d42b1.js` | `6df8fa229072d9689afdaf10906a6c2c19d2094cb11032e9b942619c9c41105f` | Auth compat du lecteur |
| `935dad9aaa267a315b04da57.js` | `54802dbc9cad895a4a47f071a4c9666cd45237e9a85ef11af3bb4909a2f25e15` | SDK Auth du lecteur, module 7780 |

URL publiques vérifiées dans le manifeste : [garde et initialisation Firebase](https://world-novel.fr/_next/static/chunks/692-86b36dd98526dde3.js), [garde et SDK App Check](https://world-novel.fr/_next/static/chunks/65-0a6ab9f17c6bce86.js), [Auth compat](https://world-novel.fr/_next/static/chunks/584-67b740e44821066b.js), [persistance Auth](https://world-novel.fr/_next/static/chunks/8f4beb35-241a331fdc23640d.js), [fiche œuvre](https://world-novel.fr/_next/static/chunks/app/oeuvres/%5Bid%5D/page-61f361333e6fd788.js), [layout fiche](https://world-novel.fr/_next/static/chunks/app/oeuvres/%5Bid%5D/layout-deae2513c3c8ab60.js), [graphiques](https://world-novel.fr/_next/static/chunks/730-9d67425ec1475dd2.js), [décodeur Flight](https://world-novel.fr/_next/static/chunks/255-becf5b2637d304bb.js).

Révision observée pendant la navigation lecture : [page lecteur](https://world-novel.fr/_next/static/chunks/app/lecture/page-ce72e1267182a4b3.js), [layout lecteur](https://world-novel.fr/_next/static/chunks/app/lecture/layout-89ca48394bba36ac.js), [initialisation commune](https://world-novel.fr/_next/static/chunks/519-7012ec615e965965.js), [App Check](https://world-novel.fr/_next/static/chunks/884-022aa728e233dbf3.js), [Auth compat](https://world-novel.fr/_next/static/chunks/129-a0f4ef0d13d4fd98.js), [persistance Auth](https://world-novel.fr/_next/static/chunks/ae6eea6a-c4cfc7aab74616f9.js).

### Requête exacte du lecteur

Dans `9ce4…`, module **1454**, l'état `A` provient de `auth().onAuthStateChanged` (copie formatée, ligne 113). Le chargement automatique n'appelle `en(A)` que lorsque cet utilisateur est présent (ligne 174). Sans utilisateur, le composant affiche une invitation à se connecter et un lien `/auth` (ligne 182).

La fonction `en` renouvelle les deux justificatifs avec `user.getIdToken(true)` et `appCheck().getToken(true)`, puis construit la requête suivante (lignes 149–150). Les accolades sont des paramètres descriptifs, jamais des valeurs de session :

```text
GET https://cdn.world-novel.fr/chapitres/?path={encodeURIComponent(oeuvreId + "/" + volumeId + "/" + chapitreId)}&userId={user.uid}
Authorization: Bearer {jeton Firebase Auth renouvelé}
X-Firebase-AppCheck: {attestation App Check renouvelée}
```

Ce n'est pas l'URL de la page Next.js et ce n'est pas une lecture Firestore du texte. En cas de réponse autre que 200, le client refait une seule requête avec `cache: "reload"`. Il traite ensuite 429 et 403 comme des erreurs explicites. Ce comportement observé n'autorise pas un plugin à multiplier les tentatives ou à contourner une limite.

Le code impose aussi, avant le chargement, une limite locale de trois tentatives sur une fenêtre de 60 secondes et une validation reCAPTCHA visible après dix chargements comptabilisés (lignes 142–145, 172 et 182). Le diagnostic n'a ni franchi ni désactivé ces gardes. Leur application exacte côté serveur n'a pas été testée.

En cas de 200, il lit `response.text()`, parse le HTML avec `DOMParser`, retire les éléments `link[rel="stylesheet"]` et `noscript`, puis place le `body.innerHTML` dans `#textContainer.chapter-content` ; la première feuille de style rencontrée est chargée séparément (lignes 161–169 ; fonction de rendu `s`, ligne 5). Le simple fait de trouver ce conteneur ne prouve pas la présence d'un chapitre : il sert également à afficher connexion, attente, CAPTCHA et erreurs.

La route de chapitre réellement visitée a répondu HTTP 200, avec fragments Flight mais **zéro paragraphe et zéro article** dans l'enveloppe HTTP observée. Le texte, sa structure complète, les règles CSS et les éventuels paragraphes masqués restent **NOT_RUN**. Le contrat client est identifié ; aucune réussite de lecture n'est revendiquée.

### Fiche et liens de chapitres

Dans `dccb27…`, le module **50437** reçoit les propriétés `oeuvre`, `volumes` et `statsCollection`. Le module **96881** reçoit `volumes` et `oeuvreInfo` : il aplatit les tableaux `volume.chapters`, puis trie et filtre localement les chapitres par titre et volume. Les boutons et liens composent le même chemin :

```text
/lecture/{oeuvre.id}/volumes/{volume.volumeId}/chapitres/{chapter.id}
```

Repères formatés : module 50437, lignes 91–98 ; module 96881, lignes 140–163. Les identifiants, titres et dates proviennent des propriétés du serveur ; le composant de liste n'effectue pas une pagination HTTP supplémentaire. Cette observation porte sur le composant examiné, pas sur une garantie de complétude de toute réponse serveur. Les favoris exigent une connexion et utilisent la bibliothèque Firebase de l'utilisateur, mais ce contrôle ne concerne pas la lecture du texte. Le seul import dynamique propre à la fiche charge les critiques (module **47244**, chunks 963 et 815), pas un lecteur. Aucun endpoint texte ou URL de CDN de chapitre n'apparaît dans ces trois nouveaux scripts.

### Framing Flight sans identifiant pour les hints

Le décodeur public `89f0…`, fonction `fe` (lignes formatées 2698–2725), initialise l'identifiant à zéro et accepte immédiatement le séparateur `:`. La fonction `ce` traite le tag `H` comme une indication de chargement de ressource, puis lit le sous-code `D`, `C`, `L`, `m`, `X`, `S` ou `M` et parse le JSON associé (lignes 2647–2668). Une ligne telle que `:HL["/synthetic.css","style"]` est donc un framing valide, distinct des données d'une œuvre. Le parseur local ignore ces seuls hints sans identifiant après validation JSON ; les lignes de données sans identifiant restent rejetées. Aucune instruction du site ni indication de chargement de ressource n'est exécutée.

### Redirection Discord

Dans `627cb…`, module **52873**, le composant écoute `auth().onAuthStateChanged`. Sans utilisateur, il marque explicitement l'état comme non administrateur. Avec utilisateur, il renouvelle la lecture des revendications via `getIdTokenResult(true)` et consulte `claims.admin`. Cet état n'est pas une vérification d'accès au texte : c'est la condition d'activation du garde navigateur.

Pour les non-administrateurs, il initialise la bibliothèque du module **3061** avec la destination `https://discord.com/invite/victoriannovelxworldnovel`, une période de 200 ms et plusieurs détecteurs d'outils de développement. Le même composant interdit certains raccourcis clavier, le menu contextuel et la copie/sélection. Le module 3061 effectue ensuite la navigation avec l'instruction suivante lorsque le détecteur se déclenche :

```js
window.location.href = p.url;
```

Repères des copies formatées : `627cb…`, lignes 58–68 ; `ac877…`, fonction `f`, lignes 48–49. Aucun de ces gardes n'a été désactivé ou modifié pendant l'audit. Une redirection en présence d'un outil d'inspection est cohérente avec ce code ; elle ne permet pas à elle seule d'identifier quel détecteur s'est déclenché lors d'une visite donnée.

### Firebase Authentication

Le module **57968** de `627cb…` initialise le projet Firebase commun aux deux noms de site. Son domaine d'authentification dépend du nom de domaine courant. Il utilise le SDK compat ; les clés publiques de configuration n'ont pas à être reproduites ni utilisées comme justificatifs d'accès.

Dans le module Auth compat de `608db…`, la fonction `z` (copie formatée, lignes 3969–3977) place par défaut la persistance `i.i` en tête, suivie des solutions de repli disponibles dans le navigateur. L'export `i.i` désigne `Nn`, donc la classe **On** du module **51117** (`20445…`, ligne formatée 836). Cette classe utilise IndexedDB, base `firebaseLocalStorageDb`, magasin `firebaseLocalStorage`. Les autres choix sont `localStorage`, `sessionStorage` puis la mémoire.

Le gestionnaire choisit la première persistance disponible et peut migrer une session existante vers une persistance prioritaire (`20445…`, lignes formatées 153–169). La nouvelle révision conserve ce choix par défaut : Auth compat `333f…`, lignes 3153–3161, puis IndexedDB `935d…`, classe `iA`, à partir de la ligne 829. Aucun appel propre à l'application ne force `localStorage` dans les scripts examinés. L'emplacement d'une session réelle n'a pas été inspecté : l'utilisation d'IndexedDB est le choix par défaut vérifié dans le code, pas une observation de données personnelles.

### Firebase App Check

Le module **96743** de `627cb…` appelle `appCheck().activate` avec une clé de site publique et l'actualisation automatique activée. Dans le module **52709** de `ac877…`, une clé passée comme chaîne sélectionne le fournisseur reCAPTCHA v3 ; celui-ci utilise le SDK navigateur, puis échange l'attestation auprès de Firebase.

L'endpoint de ce **service d'attestation**, distinct du CDN des chapitres, est construit sous `https://content-firebaseappcheck.googleapis.com/v1/projects/{projectId}/apps/{appId}:exchangeRecaptchaV3Token`. Les paramètres de clé et valeurs d'attestation ne sont pas reproduits ici.

Le cache App Check utilise IndexedDB, base `firebase-app-check-database`, magasin `firebase-app-check-store` (`ac877…`, lignes formatées 262–283). Les dates d'expiration et la planification d'un renouvellement sont traitées par le SDK (lignes 325–337). Un jeton copié à la main serait donc temporaire et ne constituerait pas une solution d'installation terminée.

La révision du lecteur initialise à nouveau ce service avec actualisation automatique (`6126…`, module **6743**, lignes 62–73) et conserve le cache IndexedDB (`7ea24…`, ligne 143).

### Garde de la révision lecture

Le module **6174** de `2dd13…` vérifie également `claims.admin`. Pour les autres utilisateurs, il adapte ses contrôles au navigateur mobile ou de bureau et dirige les détections vers `/restreint` (lignes 5–11). Le module **8670** peut en outre diriger les non-administrateurs vers `/maintenance` selon la configuration distante (lignes 16–21). Ces conditions ne doivent pas être supprimées pour rendre une automatisation compatible. La destination Discord précédemment observée appartient à l'autre révision identifiée plus haut.

## Conséquences pour LNReader 2.1.3

Les capacités exactes sont documentées dans [l'audit du runtime](runtime-audit.md). Le partage natif des cookies HTTP existe, mais ne transforme pas les données IndexedDB de Firebase en cookies. Le drapeau `webStorageUtilized` de LNReader ne copie que des instantanés de `localStorage` et `sessionStorage`. Il ne restitue donc pas automatiquement la session Firebase par défaut ni le cache App Check.

Le plugin dispose de `fetchApi`, mais d'aucune API exposée permettant de demander au WebView distant d'exécuter reCAPTCHA ou Firebase, ou de lire son IndexedDB. `customJS` concerne le document généré du lecteur et ne remplace pas `parseChapter` par un navigateur distant. Il serait incorrect de déclarer l'authentification prise en charge sur la seule base de ces deux propriétés.

Le parcours client identifié dépend concrètement de Firebase Auth, d'App Check et de validations interactives. Aucune API HTTP autonome autorisée n'a été établie. Une [adaptation minimale candidate du runtime](minimal-runtime-adaptation.md) est proposée pour discussion ; elle n'est ni implémentée ni présentée comme une garantie. Son intégration comme dépendance et la distribution d'une APK distincte demandent l'accord de l'utilisateur. Aucune copie de jeton ni désactivation de protection n'est proposée.

## Statuts

| Vérification | Statut | Conclusion |
| --- | --- | --- |
| Explication statique du garde Discord | PASS | Protection navigateur des non-administrateurs identifiée |
| Initialisation Auth et persistance par défaut | PASS | IndexedDB en priorité, solutions de repli identifiées |
| Initialisation App Check et cache | PASS | reCAPTCHA v3, renouvellement automatique et IndexedDB |
| Routes de lecture et liste dans les propriétés de la fiche | PASS | Identifiants œuvre/volume/chapitre, tri et filtre local vérifiés |
| Hints Flight sans identifiant | PASS | Framing confirmé dans le décodeur public, cas synthétiques testés |
| Requête exacte du lecteur publié | PASS | CDN `/chapitres/`, chemin encodé, utilisateur, Auth et App Check identifiés |
| Connexion et en-têtes dans le client publié | PASS | Chargement conditionné à l'utilisateur, renouvellement des deux justificatifs |
| Limites et CAPTCHA du client publié | PASS | Trois tentatives par minute, CAPTCHA après dix chargements |
| Lecture CDN authentifiée / contrôles serveur | BLOCKED | Aucun appel authentifié ni test des contrôles serveur |
| Texte réel, CSS et contenu masqué | NOT_RUN | Aucun corps de chapitre récupéré ou exporté |
| Session réelle, expiration, déconnexion et redémarrage Android | NOT_RUN | Aucune session utilisateur inspectée par cet audit |
