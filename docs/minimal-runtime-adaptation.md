# Adaptation candidate de LNReader — accord préalable requis

**Proposition uniquement : non implémentée, non validée sur Android, sans garantie de compatibilité avec les protections du site.** Le plugin livré ne dépend pas de cette API. L'utilisateur doit accepter une modification de LNReader, une APK distincte et sa maintenance avant qu'elle devienne une dépendance du projet. Cette note ne demande ni compte ni secret et n'autorise aucune désactivation de protection.

## Pourquoi un simple plugin ne suffit pas actuellement

Le [lecteur public examiné](site-session-audit.md) utilise une session Firebase, renouvelle Auth et App Check dans le navigateur, et demande une validation reCAPTCHA après un certain nombre de chapitres. LNReader 2.1.3 partage les cookies HTTP, mais son API de plugins ne sait pas demander à une page distante connectée de terminer ce parcours et de restituer un chapitre. `webStorageUtilized` transfère seulement des instantanés de localStorage/sessionStorage ; `customJS` agit dans le document généré du lecteur. Aucun de ces mécanismes ne remplace le contexte navigateur du site.

## Périmètre minimal proposé

Ajouter au runtime une capacité explicite, par exemple `fetchRenderedChapter(path)`, réservée à une origine autorisée et déclarée par le plugin. Son contrat serait une promesse contenant le chemin canonique et le HTML vérifié du chapitre, ou une erreur typée. Le plugin ne recevrait jamais cookies, en-têtes d'authentification, jetons, stockage Web ou IndexedDB.

Le runtime ouvrirait le chemin demandé dans un WebView ordinaire et persistant de `https://world-novel.fr`. Le site exécuterait ses propres scripts et son propre parcours de chargement. L'utilisateur effectuerait la connexion, Cloudflare et les CAPTCHA dans l'interface visible. La session resterait dans ce WebView. La proposition n'inclut ni navigateur furtif, ni changement des détecteurs, ni rejeu de justificatifs dans le plugin, ni API permettant à un plugin d'injecter du JavaScript arbitraire.

Le transfert serait limité au contenu du `#textContainer.chapter-content` correspondant au chemin demandé, après succès démontré. **Un sélecteur présent ou quelques paragraphes ne suffisent pas** : ce même conteneur affiche aussi les messages de connexion, de CAPTCHA et d'erreur. Un prototype devrait établir un signal de réussite fiable lié à la réponse CDN 200 et au chapitre courant, sans exporter la requête ou ses justificatifs. Ce point n'est pas résolu par le runtime actuel. Si un tel signal ne peut pas être observé sans modifier les contrôles du site, la capacité doit rester indisponible.

## Bornes et erreurs

- Une seule navigation de lecture en cours, identifiée par une demande interne ; refuser les messages périmés, les chemins différents et toute origine finale étrangère. Une redirection vers `/restreint`, `/maintenance` ou un autre service doit produire une erreur.
- Aucune nouvelle tentative automatique propre à LNReader après un refus. Respecter les temporisations et validations du site : le client observé limite à trois tentatives par minute et présente un CAPTCHA après dix chargements. Arrêter une file de téléchargements lorsqu'une interaction est nécessaire.
- Délais bornés, annulation explicite et taille maximale de réponse — valeurs proposées à tester : 60 secondes hors interaction humaine, plafond de 4 Mio de HTML et 50 000 nœuds. Une attente de connexion/CAPTCHA rend la main à l'utilisateur ; elle ne prolonge pas silencieusement une tâche de fond.
- Distinguer connexion requise, session expirée, challenge requis, accès refusé, limitation de débit, page indisponible, structure modifiée et annulation. Aucune erreur, enveloppe de page ou prévisualisation ne doit être sauvegardée comme chapitre.
- Avant restitution, retirer navigation, scripts, formulaires, traqueurs, styles exécutables et éléments effectivement masqués. La structure réelle du texte et ses CSS n'ayant pas été inspectées, la règle de nettoyage reste à valider sur le rendu réel ; supprimer toutes les classes puis supposer le résultat fidèle serait insuffisant.
- Ne journaliser que statuts et tailles. Aucun HTML de chapitre, identifiant utilisateur, URL avec paramètres de session, jeton ou instantané de stockage dans les rapports, fixtures ou dépôts.

## Composants concernés au tag vérifié

Sur LNReader `v2.1.3`, commit `cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947` :

| Composant | Modification candidate |
| --- | --- |
| [Écran WebView distant](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/screens/WebviewScreen/WebviewScreen.tsx#L92) | Session persistante, interface d'interaction, navigation bornée et retour de contenu validé |
| [Gestionnaire de plugins](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/pluginManager.ts#L30) | Nouvelle capacité contrôlée, sans accès générique aux secrets ou au DOM |
| [Types des plugins](https://github.com/lnreader/lnreader/blob/cb1a5d9e8294d01ec89e3ba79e1b6fde41e10947/src/plugins/types/index.ts) | Déclaration de capacité, origine, résultats et erreurs |
| Service de lecture/téléchargement | Suspension de la file pour interaction, annulation et sauvegarde uniquement après validation |

`WebViewReader.tsx` affiche actuellement le HTML déjà obtenu ; il ne faut pas le confondre avec la nouvelle acquisition distante. La séparation entre navigateur connecté et lecteur hors ligne demeure nécessaire.

## Validation avant toute promesse d'installation

Le prototype devra fonctionner dans l'APK candidate, sans modifier les gardes du site, sur connexion initiale, expiration, CAPTCHA, 403/429, déconnexion et redémarrage. Il devra comparer le texte visible de chapitres autorisés, vérifier leur ordre, exclure les contenus effectivement masqués et refuser tous les écrans d'erreur. Les contrôles de fidélité restent locaux et ne publient aucun roman. Une batterie de tests Node ou le seul chargement HTTP 200 ne suffisent pas.

Si les protections du site empêchent ce WebView ordinaire, il faudra obtenir une intégration autorisée auprès du site ou conserver la lecture comme bloquée. Aucune autre voie d'accès n'est supposée disponible.
