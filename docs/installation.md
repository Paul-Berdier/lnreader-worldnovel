# Installation Android et retour arrière

## Situation actuelle

Le plugin 0.1.0 est **expérimental et ne permet pas encore la lecture**. Son installation de développement a été vérifiée dans un émulateur vierge avec l’APK officiel 2.1.3. Aucun test n’a été effectué sur votre téléphone. Aucune URL HTTPS publique vérifiée n’est disponible : le dépôt existant est public et sa publication attend une autorisation précise. Ne recopiez pas une URL locale ou une destination théorique depuis `dist/` sur votre téléphone.

## Parcours à suivre seulement après publication vérifiée et lecture débloquée

1. Dans LNReader, **More → Settings → Backup → Create backup**, créer une sauvegarde. La copier dans un emplacement sûr et relever le dernier chapitre lu de Shadow Slave.
2. Dans **More → Settings → Repositories → Add**, ajouter l’URL exacte se terminant par `plugins.min.json` fournie après publication et vérification. Le champ **Repo URL** attend le manifeste JSON, pas la page GitHub du dépôt ni le TypeScript. Autre accès observé : **Browse → ⋮ → Repositories**.
3. Dans **Browse → ⋮ → Browse Settings**, activer **Français** si cette langue est masquée, puis revenir dans **Browse → Plugins**. Sur une liste vide, un bouton **Browse Settings** mène au même réglage.
4. Installer **WorldNovel VNH**, version attendue 0.1.0 ou ultérieure. Le plugin doit apparaître dans la section **Installed**, puis dans l’onglet **Sources**. Vérifier l’identité distincte de WorldNovel officiel.
5. Dans **Browse → Sources → WorldNovel VNH**, l’icône globe en haut à droite ouvre le WebView. Effectuer soi-même le parcours normal demandé par le site. Pour l’index de recherche : ouvrir sa recherche, attendre le chargement, puis **recharger la page avant de fermer** pour que le snapshot LNReader contienne le cache. Cela ne constitue pas une prise en charge des jetons Firebase.
6. Chercher Shadow Slave, vérifier fiche, nombre/ordre des chapitres et **lecture réelle d’un chapitre accessible**. Aujourd’hui cette dernière étape est bloquée : ne pas passer à la suivante.
7. Envisager la coexistence ou la migration seulement après validation. Conserver NovelFrance et vérifier manuellement les titres/numéros autour de votre progression.

Les chemins de menus ci-dessus ont été observés dans l’interface anglaise de l’APK officiel 2.1.3 sur l’émulateur de test ; leur traduction peut varier avec la langue de l’application. Le WebView de cet essai s’est arrêté sur une vérification Cloudflare, sans validation du CAPTCHA. Aucune réinstallation de votre application n’est demandée.

## Migration prudente

La migration native 2.1.3 supprime l’ancienne entrée après transfert et rapproche les chapitres par numéro, sans garantie sur titres/volumes. Elle peut aussi retélécharger les chapitres enregistrés. **Ne l’utilisez pas automatiquement pour cet essai.** Ajoutez éventuellement la nouvelle fiche séparément, gardez l’ancienne et marquez la progression uniquement après comparaison. Aucune modification directe de la base de bibliothèque.

## Mise à jour

Après une première publication autorisée, garder le même identifiant et incrémenter `version` dans `src/metadata.ts` et `package.json` de façon cohérente. Actualiser le dépôt dans LNReader puis installer la mise à jour proposée. Le build refuse une divergence de version et génère manifeste et bundle ensemble. Chaque version doit faire l’objet de tests de lecture réels avant migration.

## Retour arrière

Conserver le plugin officiel et NovelFrance pendant tous les essais. Retirer ou désactiver le dépôt WorldNovel VNH et désinstaller uniquement **WorldNovel VNH** si nécessaire. La désinstallation du plugin n’est pas une garantie de restauration de progression : utiliser la sauvegarde si vous avez modifié votre bibliothèque. Ne supprimer aucune ancienne entrée automatiquement.
