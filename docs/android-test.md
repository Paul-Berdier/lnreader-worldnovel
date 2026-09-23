# Préparation du test Android local

Constats du 23 septembre 2026 : Android Emulator 35.1.21 et ADB 35.0.2 sont installés. L'image Android 35 Google Play x86_64, révision 8, est présente. L'AVD existante `Medium_Phone_API_35` n'a pas été lancée ; seul son fichier de configuration a été lu. Une configuration d'AVD neuve `WorldNovel_API_35` a été préparée sous `.local/android/avd`, sans copier les données de l'AVD existante ni modifier la configuration globale. Elle prévoit 2 Gio de RAM, quatre cœurs et une partition de données de 2 Gio. Le disque disposait d'environ 19,4 Go libres.

L'APK [officiel LNReader v2.1.3 x86_64](https://github.com/lnreader/lnreader/releases/tag/v2.1.3) est conservé dans `.research/android/LNReader-v2.1.3-x86_64.apk` : **49 094 701 octets**, SHA256 vérifié contre `SHA256SUMS.txt` officiel et le digest de la release :

```text
ec77cf8262b22dcacae1051663bce3a951d37f21ea172c588d71989f31617609
```

L'inspection statique avec `aapt` confirme la version 2.1.3, le code 4196355, l'ABI x86_64, le SDK minimum 24 et le package `com.rajarsheechatterjee.LNReader`. Le manifeste de l'APK autorise le HTTP (`usesCleartextTraffic=true`), donc un serveur loopback temporaire est envisageable pour installer un bundle de développement sans publication. Cela ne constitue pas une URL d'installation destinée au téléphone.

Préparation, démarrage de l'AVD dédiée et installation de l'APK : **PASS**. L'appareil `emulator-5580` répond `device`, `sys.boot_completed=1` et ABI `x86_64`. `adb install` a retourné `Success` ; `dumpsys package` confirme `versionName=2.1.3` et `versionCode=4196355`. Le lancement de `com.rajarsheechatterjee.LNReader/.MainActivity` a été accepté. Il s'agit d'un émulateur neuf, pas du téléphone personnel.

## Essai réel du bundle dans l'application

Le 23 septembre 2026, l'interface de cette installation vierge a été utilisée via ADB/UIAutomator, exclusivement sur `emulator-5580`. Le bouton d'accueil `Complete` concernait le choix du thème ; aucun accord juridique n'a été accepté. Un serveur de développement limité à `127.0.0.1:8087` a fourni le manifeste et le bundle, avec `adb reverse` ; cette adresse n'est pas une publication ni une URL d'installation pour le téléphone.

| Vérification | Résultat | Preuve |
| --- | --- | --- |
| Ajout du dépôt de développement | PASS | URL `http://127.0.0.1:8087/plugins.min.json` acceptée dans Repositories |
| Affichage du plugin français | PASS | Après activation de Français dans Browse Settings : `WorldNovel VNH`, `Français · 0.1.0` |
| Installation du bundle | PASS | Bouton `Install WorldNovel VNH`, puis section `Installed` et accès aux détails/réglages |
| Ouverture de la source | PASS | `Browse WorldNovel VNH` ouvre l'écran de la source et exécute le wrapper réseau |
| Catalogue réel | BLOCKED | Erreur affichée : « WorldNovel : accès refusé (403) ; vérifiez la validation et votre accès dans le navigateur intégré. » |
| Recherche Shadow Slave | BLOCKED | Saisie et validation effectuées ; l'écran conserve l'erreur 403 du catalogue |
| Ouverture du WebView | PASS | L'icône globe ouvre bien le navigateur intégré de la source |
| Accès au site dans ce WebView | BLOCKED | Marqueurs Cloudflare, « Just a moment », vérification humaine/de sécurité et une case de contrôle ; aucune interaction avec le CAPTCHA |
| Fiche et lecture Android | NOT_RUN | Catalogue bloqué ; aucune authentification ni ouverture de chapitre effectuée |
| Coexistence avec anciens plugins | NOT_RUN | Installation vierge : aucun ancien WorldNovel/NovelFrance installé dans l'AVD |

Le composant stable `BrowseSourceScreen.tsx` calcule `errorMessage = error || searchError` : une erreur de catalogue reste prioritaire sur le résultat de recherche. L'écran 403 ne suffit donc pas à conclure séparément à l'échec technique de la méthode de recherche. Aucun texte de roman, cookie, clé ADB, capture de chapitre ou donnée de compte n'a été enregistré dans les preuves de cet essai.

Chemins de menus confirmés dans l'interface anglaise : `More → Settings → Backup → Create backup`, `More → Settings → Repositories → Add`, `Browse → ⋮ → Repositories`, `Browse → ⋮ → Browse Settings` et `Browse → Plugins → Install WorldNovel VNH`. La langue Français était initialement désactivée dans cette installation de test. Le plugin est resté indépendant de la bibliothèque personnelle.

Après le test, la redirection ADB du port 8087 et le fichier UIAutomator temporaire ont été supprimés ; l'application a été arrêtée. La commande `adb emu kill` ayant échoué dans cet environnement, seul le processus de l'émulateur dédié lancé pour le projet et ses enfants ont été arrêtés explicitement. L'AVD locale demeure réutilisable ; aucun autre appareil ou émulateur n'a été fermé.

Le contrôle de virtualisation retournait 0 et « WHPX installed and usable », ainsi qu'une ancienne recommandation contradictoire concernant Hyper-V ; l'émulateur a néanmoins démarré sans changement de réglage Hyper-V ou de sécurité.

## Commandes pour reproduire la préparation

Exécuter depuis la racine de ce projet dans PowerShell 7.6, uniquement si l'émulateur dédié n'est pas déjà ouvert. Ces étapes ont été réalisées dans cet environnement. La configuration d'AVD préparée contient le chemin local de cet espace de travail et doit être adaptée si le projet est déplacé.

```powershell
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$testRoot = Join-Path (Get-Location).Path '.local\android'
New-Item -ItemType Directory -Force -Path (Join-Path $testRoot 'emulator') | Out-Null
Start-Process -FilePath (Join-Path $sdk 'emulator\emulator.exe') -WindowStyle Hidden `
  -ArgumentList '-avd WorldNovel_API_35 -port 5580 -no-window -no-snapshot -no-audio -gpu swiftshader_indirect' `
  -Environment @{
    ANDROID_AVD_HOME = (Join-Path $testRoot 'avd')
    ANDROID_EMULATOR_HOME = (Join-Path $testRoot 'emulator')
    ANDROID_SDK_ROOT = $sdk
  }
$adb = Join-Path $sdk 'platform-tools\adb.exe'
& $adb -s emulator-5580 get-state
& $adb -s emulator-5580 shell getprop sys.boot_completed
# Continuer seulement si l'état vaut device et sys.boot_completed vaut 1.
& $adb -s emulator-5580 install '.research\android\LNReader-v2.1.3-x86_64.apk'
& $adb -s emulator-5580 shell am start -n 'com.rajarsheechatterjee.LNReader/.MainActivity'
```

Le port 5580 doit être libre. Toujours cibler explicitement `emulator-5580`, jamais un téléphone ou un autre émulateur. Un test d'import local devra encore préparer un serveur lié uniquement à `127.0.0.1`, un manifeste de développement cohérent et son bundle, puis éventuellement utiliser `adb -s emulator-5580 reverse tcp:8087 tcp:8087`. Ne pas exposer le serveur au réseau local ni en faire une dépendance du plugin sur téléphone.

Après les tests :

```powershell
& $adb -s emulator-5580 reverse --remove tcp:8087
& $adb -s emulator-5580 emu kill
```

La bibliothèque de test reste séparée de la bibliothèque personnelle. Les essais Android doivent faire l'objet d'un résultat distinct des tests unitaires ; ne jamais enregistrer de capture ou de journal contenant le texte des chapitres.
