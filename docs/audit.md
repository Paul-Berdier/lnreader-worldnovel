# Audit WorldNovel — 23 septembre 2026

## Périmètre et plan

Projet personnel uniquement : `Paul-Berdier/lnreader-worldnovel`. Aucun service, compte ou matériel Prooftag utilisé. Plan : vérifier l’existant et le runtime stable ; observer les routes et données publiques ; implémenter les fonctions démontrées ; tester les erreurs et le bundle ; préparer une publication revue ; vérifier Android avant toute migration.

## Environnement vérifié

- Dossier initial : uniquement `.git`, aucun commit, aucun AGENTS.md applicable trouvé dans les parents examinés.
- Remote existant : `https://github.com/Paul-Berdier/lnreader-worldnovel.git`.
- Compte GitHub connecté confirmé par connecteur et CLI hors sandbox : `Paul-Berdier`.
- Dépôt distant existant **public**, vide (API contents : « This repository is empty » ; `ls-remote` vide). Aucune modification de visibilité. Aucune écriture publique autorisée avant validation spécifique.
- Node 24.19.0, npm 11.17.0, Git 2.42.0.windows.2. Dépendances locales installées avec `--ignore-scripts` ; audit npm initial : 0 vulnérabilité signalée.
- Git sandbox signale propriétaire différent ; utilisation de `git -c safe.directory=...` limitée aux commandes de ce projet, sans configuration globale. Écritures `.git` via permission explicite de l’environnement.
- Le profil PowerShell personnel comporte une erreur syntaxique ; commandes exécutées avec `login:false`, sans modifier ce profil.
- Outils navigateur réellement présents : navigateur intégré Codex, Edge, Chrome. SDK Android présent ; aucun appareil ADB connecté lors de l’inventaire ; AVD `Medium_Phone_API_35` présent. Aucune prétention de test sur le téléphone.

## Références figées

- LNReader stable `v2.1.3`, commit `cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947`, release API courante `prerelease:false`. Le cache de recherche web affichait une ancienne qualification prerelease ; l’API fraîche prime.
- lnreader-plugins master `04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984`.
- Publication officielle `plugins/v3.0.0`, commit `78556111dae806fea5f95d53a8818a0a08d84cca`.
- Plugin officiel WorldNovel `worldnovel`, version `2.2.0`, langue `Français`, Madara. Identité personnelle `worldnovel-vnh`, version expérimentale `0.1.0` ; aucune collision dans le manifeste officiel inspecté.

Voir [runtime-audit.md](runtime-audit.md) et [upstream-audit.md](upstream-audit.md) pour les sources et les limitations précises.

## Faits directement observés

1. Le bundle officiel construit l’URL `https://world-novel.fr//page/1/?s=&post_type=wp-manga`. C’est une route WordPress/Madara, différente des routes actuelles. La version **installée sur le téléphone** n’a pas été inspectée : cette preuve porte sur la version officielle publiée.
2. HTTP direct local et outil web : 403 avec `Cf-Mitigated` et page Cloudflare « Just a moment ». Cela prouve un contrôle d’accès sur ces clients, **pas** une panne générale du site, ni la réponse vue sur le téléphone.
3. Le navigateur intégré affiche `/oeuvres/shadow-slave` : fiche réelle, titre/auteur/couverture/résumé/genres, 14 volumes, compteur de 3 174 chapitres. Après quelques secondes, navigation automatique vers une invitation Discord. Même redirection observée depuis `/home` et lors de la tentative d’ouverture du premier chapitre. Cause de cette redirection encore non déterminée à ce stade.
4. Fiche SSR Next.js : `self.__next_f.push([1, ...])` fragmenté, données `oeuvre`, `volumes`, `chapters`. Les chapitres fournissent `id`, `title`, `date`, `volumeId`, `volumeDisplayName`, `ts` ; leur ordre brut n’est pas numérique. Le nom d’un chapitre est aussi son identifiant.
5. `/home` contient des sélections d’œuvres et des liens de lecture `/lecture/<œuvre>/volumes/<volume>/chapitres/<id encodé>`. **L’accueil ne prouve pas un catalogue complet.** `/classement` renvoie un shell client, sans liens d’œuvres dans le SSR observé.
6. Des segments Flight `T<taille hexadécimale>` ont été observés sur l’accueil : une simple expression régulière sur les objets imbriqués serait insuffisante.
7. Les scripts publics `/_next/static/...` eux-mêmes reçoivent 403 en HTTP direct. Premier diagnostic Edge dédié : contrôle Cloudflare, aucun script Next.js récupéré. Une validation manuelle a été demandée, sans contournement ni récupération du profil personnel.

## Vérifications poursuivies et blocage final

Le Chrome standard dédié a ensuite obtenu les scripts publics. La redirection Discord est expliquée par une garde anti-outils de développement pour les utilisateurs non administrateurs, distincte de Cloudflare. Les scripts du lecteur ont eux aussi été examinés : l’application cliente attend un utilisateur Firebase, renouvelle son jeton et une attestation App Check, puis appelle `https://cdn.world-novel.fr/chapitres/` avec chemin de chapitre, identifiant utilisateur et les en-têtes correspondants. Aucun identifiant utilisateur réel ou jeton n’a été extrait ou copié. La vérification du backend et le texte réellement retourné demeurent **BLOCKED** : aucun appel authentifié réussi effectué. Détails et sources dans [site-session-audit.md](site-session-audit.md).

Le parseur a rencontré sur une vraie fiche des hints Flight sans identifiant (`:HL…`). Après correction conforme au décodeur React public, il restitue **3 174/3 174 chapitres et 14 volumes pour Shadow Slave**, puis **392/392 et 1 volume pour The Mech Touch**. Ces résultats viennent de réponses réelles du navigateur, pas de fixtures. Aucun corps de chapitre conservé.

Une route de chapitre observée retourne HTTP200 mais sert un shell Next.js (0 paragraphe, 0 article dans la réponse examinée). Ce 200 n’est pas compté comme une lecture réussie. L’index de recherche Firestore identifié dans le client refuse un GET anonyme (403 PERMISSION_DENIED) ; cela ne distingue pas à lui seul règles Firebase et App Check. La recherche expérimentale lit donc uniquement le cache `searchCache` produit normalement par le site dans le WebView, avec contrôle d’expiration.

Un émulateur neuf et distinct a installé l’APK officiel 2.1.3 et le plugin personnel via un serveur loopback temporaire : import **PASS**, ouverture **PASS**, catalogue **BLOCKED** par 403 ; WebView **BLOCKED** sur un CAPTCHA non résolu. L’émulateur et le serveur temporaires ont été arrêtés. Aucun téléphone, compte tiers ou service Prooftag utilisé.

## Approche retenue

Bundle CommonJS minimal conforme à `exports.default`, `@libs/fetch` et `cheerio` injectés. Aucune dépendance Node/DOM/Playwright dans le plugin. Parseur Flight sûr, URLs encodées composant par composant, déduplication, vérification des totaux et erreurs levées plutôt que faux chapitres. Diagnostic de développement séparé, profil et réponses brutes exclus de Git. Catalogue complet et texte ne seront déclarés opérationnels que sur preuve réelle.
