# Diagnostic local facultatif

Cet outil de développement observe une navigation normale dans Edge ou Chrome. Il n'est pas utilisé par le plugin sur Android, ne répare pas une session LNReader et ne prouve pas à lui seul que la lecture fonctionne.

Prérequis : Node.js 22 ou supérieur, dépendances du projet installées (`npm ci --ignore-scripts`), Edge ou Chrome installé sous Windows. Playwright utilise le navigateur déjà installé : aucun téléchargement de navigateur supplémentaire n'est requis.

Depuis le dossier du projet :

```powershell
npm run diagnose
```

Une fenêtre s'ouvre avec un profil neuf et dédié dans `.local/browser-profile`. Naviguer normalement : catalogue, fiche, puis un seul chapitre accessible. Effectuer soi-même les éventuels CAPTCHA et la connexion dans cette fenêtre. Aucun mot de passe ne doit être collé dans le terminal ou le chat. Appuyer sur Entrée dans le terminal pour enregistrer le rapport et fermer le navigateur.

Pour un relevé automatique de la fiche publique Shadow Slave, sans action de connexion, puis fermeture après 12 secondes d'observation :

```powershell
npm run diagnose -- --public-audit
```

Un CAPTCHA ou une redirection peut empêcher cette observation : le résultat conserve alors ce blocage. Le mode public ne garantit pas une navigation anonyme si le profil dédié contient déjà une session créée manuellement.

Pour analyser également le code client public effectivement chargé :

```powershell
npm run diagnose -- --public-audit --save-public-scripts
```

Cette option conserve exclusivement les réponses JavaScript publiques de `https://world-novel.fr/_next/static/`, sans query string, dans `.research/site`. Les noms des fichiers sont calculés à partir du chemin public. Les fichiers restent locaux et ignorés par Git ; ils ne doivent pas être publiés. Elle ne sauvegarde pas les pages HTML, les réponses JSON, les chapitres ou la session. L'outil ne déclenche pas de téléchargement de chapitres en arrière-plan. Il est possible de choisir le navigateur avec `--edge` ou `--chrome`.

Le fichier local `.research/site/scripts-manifest.json` relie les noms des scripts collectés à leurs URL publiques statiques, sans paramètres. Il contient uniquement les scripts observés pendant la dernière exécution avec cette option.

Pour utiliser Chrome standard avec son propre profil dédié, au moyen d'un port DevTools temporaire limité à `127.0.0.1` :

```powershell
npm run diagnose -- --chrome --manual-browser --save-public-scripts
```

Ce mode emploie `.local/browser-profile-chrome-manual`, sans toucher au profil Chrome personnel. Il n'ajoute aucune option de dissimulation ou de désactivation des protections. À la fin, l'outil demande la fermeture de ce navigateur dédié et vérifie la fermeture du port local ; un avertissement indique si une fermeture manuelle est encore nécessaire.

Après une éventuelle connexion manuelle dans ce profil, un parcours borné est disponible :

```powershell
npm run diagnose -- --chrome --manual-browser --audit-flow --save-public-scripts
```

Il ouvre `/home`, utilise le bouton et le champ de recherche ordinaires pour « Shadow Slave », suit sa fiche, ouvre seulement la première route de chapitre issue de sa liste, puis une autre fiche publique si disponible. CAPTCHA, page de connexion ou redirection externe interrompent le parcours avec `BLOCKED` : aucune validation automatique ni contournement. Une réussite de l'étape `chapter-route` prouve uniquement la navigation, jamais la présence du texte intégral. Le rapport conserve `chapterReading: NOT_VERIFIED`.

Les parseurs locaux du projet inspectent les pages d'accueil et de fiche seulement en mémoire. Le rapport n'enregistre que le nombre de sélections, de volumes, de chapitres parsés et le total annoncé. Il est actualisé après les documents observés et chaque étape, sans HTML ni titre de chapitre. Les éventuelles mesures d'anti-débogage du site restent actives et peuvent bloquer l'observation.

Pour vérifier directement une fiche et la navigation vers son premier chapitre, sans dépendre de la recherche :

```powershell
npm run diagnose -- --chrome --manual-browser --chapter-audit --save-public-scripts
```

Ce parcours ouvre la fiche Shadow Slave, sélectionne une seule route de chapitre fournie par ses métadonnées, puis vérifie la fiche The Mech Touch. Il conserve seulement les compteurs des fiches et la structure de la page de lecture, jamais son texte. Un HTTP 200 ou la présence d'un conteneur ne valide pas le contenu : la lecture reste explicitement non vérifiée. Les modes `--public-audit`, `--audit-flow` et `--chapter-audit` sont mutuellement exclusifs.

## Ce que contient le rapport

Le fichier `.local/diagnostic-redacted.json` contient uniquement :

- les deux origines autorisées, des gabarits de chemins, méthodes HTTP, codes de réponse et catégories de contenu ;
- des noms de clés JSON figurant dans une liste autorisée et les types de leurs valeurs, jamais ces valeurs ;
- les noms des mécanismes observés, par exemple Firebase Authentication, Firebase App Check ou Discord OAuth ;
- des caractéristiques du document et les noms de clés des données JSON/Next.js embarquées ;
- des avertissements techniques prédéfinis, sans message d'erreur brut.

Tous les paramètres d'URL, fragments et segments de chemin inconnus sont supprimés ou masqués. Les routes d'authentification et d'analytics sont exclues des événements. L'outil ne lit pas les headers de requête, les cookies ou le stockage du navigateur. Seul le type de contenu de la réponse est consulté. Il ne génère ni HAR, ni capture d'écran, ni trace, ni export de texte de chapitre. Une éventuelle réponse JSON est inspectée temporairement en mémoire pour sa structure et n'est jamais écrite sur disque.

Les clés JSON non reconnues sont comptées mais ne sont pas exportées : cela évite de divulguer une adresse e-mail ou un identifiant utilisé comme clé. Ce choix peut masquer un nouveau champ ou endpoint utile ; le rapport est volontairement conservateur. Les valeurs `authentication: NOT_VERIFIED` et `chapterReading: NOT_VERIFIED` restent explicites, même après une connexion manuelle. Il faut une preuve fonctionnelle séparée pour conclure à leur réussite.

La navigation contacte naturellement le site et ses services habituels. Le programme ne transmet pas son rapport à un serveur ; il n'ajoute aucun proxy, service tiers, contournement ou injection de jeton. Le navigateur conserve localement les éléments de session nécessaires à sa navigation. Ne jamais publier `.local`, `.research`, un profil navigateur ou un fichier brut de navigation.

## Réversibilité

Fermer la fenêtre dédiée avant de relancer l'outil. Pour supprimer la session, fermer le navigateur puis supprimer uniquement le dossier de profil dédié de ce projet : `.local/browser-profile` pour Edge, `.local/browser-profile-chrome` pour Chrome piloté, ou `.local/browser-profile-chrome-manual` pour Chrome standard avec port temporaire. Pour effacer les résultats, supprimer `.local/diagnostic-redacted.json` et, si l'option correspondante a été utilisée, les scripts collectés dans `.research/site`. Le profil personnel Edge/Chrome n'est ni lu ni modifié.

Les tests hors ligne de confidentialité s'exécutent avec :

```powershell
node --test tests/diagnostic-redaction.test.mjs
```

Ces tests utilisent seulement des données synthétiques. Leur réussite ne remplace pas une vérification réseau ou Android.
