# Audit des plugins et correctifs existants

Recherche effectuée le 23 septembre 2026. Les sources distantes ont été lues sans exécuter leur code. Aucun commentaire, aucune PR ni écriture n'a été envoyé aux mainteneurs.

## Références examinées

| Projet / référence | Commit ou version | Résultat |
| --- | --- | --- |
| LNReader plugins, `master` | `04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984`, 22 septembre 2026 | WorldNovel reste généré par Madara |
| LNReader plugins, branche `plugins/v3.0.0` | `78556111dae806fea5f95d53a8818a0a08d84cca`, 22 septembre 2026 | Bundle WorldNovel publié, version `2.2.0` |
| PR officielle [2404](https://github.com/lnreader/lnreader-plugins/pull/2404) | tête de PR `6d89efc0d69bfda4c7a7c8a2fa344f837d9004c9` | Fermée, non fusionnée ; WorldNovel expressément laissé inchangé |
| Balrog57, `fix/french-plugins-2026` et `fix/french-plugins-v2` | `946b68bd20cf1ff63630659bd34f3a4a0e65651d` / `9aaa3d80454178ce9e3d9b456cb608f022493d8b` | Entrée WorldNovel toujours Madara |
| NovelSourcery/extensions-source | `ae33a5c95ea0734f9c9255a228617886ab307fcd`, 22 septembre 2026 | WorldNovel reste une sous-classe MadaraNovel |
| Yumesion/NovelYume | `e1edee37cb24a6226b085e2f37bc7d1bbdc2882d`, 19 septembre 2026 | Adaptation Kotlin spécifique avec WebView Android persistant |

## Plugin officiel effectivement publié

Le [manifeste officiel](https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json), récupéré et parsé en JSON, donne :

```json
{
  "id": "worldnovel",
  "name": "WorldNovel",
  "site": "https://world-novel.fr/",
  "lang": "Français",
  "version": "2.2.0",
  "url": "https://raw.githubusercontent.com/lnreader/lnreader-plugins/plugins/v3.0.0/.js/src/plugins/french/WorldNovel[madara].js",
  "iconUrl": "https://raw.githubusercontent.com/lnreader/lnreader-plugins/plugins/v3.0.0/public/static/multisrc/madara/worldnovel/icon.png"
}
```

La lecture du bundle confirme les anciennes routes et sélecteurs WordPress/Madara :

- Catalogue initial : `https://world-novel.fr//page/1/?s=&post_type=wp-manga`. Le double slash résulte de la concaténation dans le code publié ; une éventuelle normalisation dépend du transport et du site.
- Recherche : même route `/page/N/`, avec `s=` encodé et `post_type=wp-manga`.
- Chapitres : POST vers `site + novelPath + 'ajax/chapters/'` puisque `useNewChapterEndpoint` vaut `true`.
- Catalogue lu avec `.page-item-detail` / `.c-tabs-item__content`, chapitres avec `.wp-manga-chapter`, lecture avec `.text-left` et autres sélecteurs Madara.
- Le message exact `Could not reach site (...) try to open in webview.` provient du contrôle `!response.ok` de `getCheerio`.

Cela prouve ce que fait **le bundle officiel actuellement disponible**. Le plugin réellement installé sur le téléphone n'a pas été extrait ; sa version ne peut donc pas être affirmée. La réponse HTTP actuelle du site et son fonctionnement dans un navigateur sont à établir séparément : une erreur d'environnement ne prouve pas une panne générale.

## Domaine et historique

Le ticket [2090](https://github.com/lnreader/lnreader-plugins/issues/2090) contient initialement `word-novel.fr`. L'auteur le corrige en [commentaire du 4 avril 2026](https://github.com/lnreader/lnreader-plugins/issues/2090#issuecomment-4187183153) : il s'agit bien de `world-novel.fr`. Les commentaires suivants signalent une maintenance temporaire puis le retour du site le 7 avril ; ce ne sont pas des preuves de son état actuel. Le [ticket 1692](https://github.com/lnreader/lnreader-plugins/issues/1692) mentionne également l'ancien changement vers `victorian-novel-house.fr`.

## Recherche des solutions réutilisables

Les recherches ont couvert les issues/PR ouvertes et fermées, les branches officielles, les branches du fork français identifié, les résultats GitHub Code Search avec `fork:true` pour le domaine exact, et une recherche TypeScript ciblée. Aucun correctif LNReader prêt à réutiliser n'a été trouvé. Cela ne constitue pas une garantie d'absence dans un dépôt non indexé, privé ou une branche non indexée.

La PR 2404 évoque Next.js, Firebase App Check et Cloudflare, mais laisse WorldNovel inchangé. Son diagnostic reste une piste à confronter au site actuel. Le [ticket lightnovel-crawler 1962](https://github.com/lncrawl/lightnovel-crawler/issues/1962#issuecomment-5153257689) constate aussi un blocage ; sa description de l'architecture diffère de celle de la PR. Ces témoignages ne remplacent pas l'inspection des réponses réseau.

L'[extension NovelSourcery](https://github.com/NovelSourcery/extensions-source/blob/ae33a5c95ea0734f9c9255a228617886ab307fcd/src/fr/worldnovel/src/eu/kanade/tachiyomi/extension/fr/worldnovel/WorldNovel.kt), licence Apache-2.0, n'apporte pas d'adaptation au nouveau site. Le fork Hiirbaf consulté utilise également Madara.

Le [provider NovelYume](https://github.com/Yumesion/NovelYume/blob/e1edee37cb24a6226b085e2f37bc7d1bbdc2882d/app/src/main/java/com/lagradost/quicknovel/providers/WorldNovelProvider.kt), licence GPL-3.0, contient une tentative plus récente. Il lit les données d'œuvre depuis le HTML puis ouvre chaque lecture dans un [WebView Android persistant](https://github.com/Yumesion/NovelYume/blob/e1edee37cb24a6226b085e2f37bc7d1bbdc2882d/app/src/main/java/com/lagradost/quicknovel/network/WorldNovelWebView.kt) doté d'un pont JavaScript natif. Ce n'est pas un plugin LNReader compatible. Son code limite la recherche à l'accueil, peut renvoyer un diagnostic comme chapitre et applique des heuristiques de nettoyage non suffisamment justifiées. Ses interactions automatiques avec les défis ne sont pas reprises. Aucun code de cette intégration n'est réutilisé.

Le [ticket NoveLA 13](https://github.com/HnDK0/NoveLA/issues/13) a été fermé sans ajout de WorldNovel. Il ne fournit pas de correctif.

## Identité, génération et licence

`worldnovel-vnh` ne figure ni dans le manifeste officiel récupéré ni dans les résultats de la recherche GitHub Code Search exacte (zéro résultat). L'identité proposée est donc distincte de `worldnovel` ; les dépôts privés et non indexés ne sont pas couverts.

Le [générateur Madara](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/plugins/multisrc/madara/generator.js) charge `sources.json`, concatène `template.ts` et crée `plugins/french/WorldNovel[madara].ts` via le générateur multisource. Modifier seulement le fichier généré serait écrasé au build. Un futur correctif officiel autonome devra retirer l'entrée Madara correspondante pour éviter sa réintroduction et les doublons.

Le dépôt LNReader plugins est sous [licence MIT](https://github.com/lnreader/lnreader-plugins/blob/04db8d4eb41b7297ecb90ef1ed8712ce9ecd7984/LICENSE), copyright 2021 Rajarshee Chatterjee. Toute reprise substantielle conserve cette licence et cette attribution. L'approche retenue est une variante personnelle distincte, utilisant le contrat LNReader vérifié et des parseurs fondés sur le site réellement observé. Aucune capacité WebView propre aux autres applications n'est supposée disponible dans LNReader.

Les copies de recherche sont confinées à `.research/fixes/`, hors livrable public. Elles ne contiennent pas de contenu de chapitre récupéré pour cet audit. La validation réseau et Android relève des rapports de tests du projet.
