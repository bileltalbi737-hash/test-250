# 🎨 Carnet — un carnet de tâches impressionniste, rien que pour elle

Carnet est une to-do list **belle comme un carnet d'aquarelle**, pensée pour quelqu'un qui jongle
entre études, enseignement, un chat et mille autres choses. Elle s'installe comme une vraie app sur
**iPhone** et **Mac**, fonctionne **hors-ligne**, et se synchronise entre les deux **sans aucun cloud** :
les données restent chez vous, chiffrées de bout en bout.

- Zéro dépendance, zéro compte, zéro pub, zéro service tiers.
- Polices et icônes déjà présentes sur iPhone/Mac : rien n'est chargé depuis Internet.
- Un seul fichier serveur (`server.js`, Node.js) à lancer sur le Mac.

---

## ✨ Ce qu'elle sait faire

| | |
|---|---|
| **Ajout ultra-rapide** | Une barre en bas, toujours là. Elle comprend le français : `Corriger copies demain 17h !! #cours @enseignement` |
| **Détails** | Notes (sur papier ligné), liste, couleur, priorité, date + heure, répétition, étiquettes, sous-tâches avec barre de progression, épingle |
| **Gestes** | Glisser → droite = terminer, ← gauche = supprimer (avec « Annuler »). Glisser par la poignée pour réordonner. |
| **Vues** | Aujourd'hui (avec bonjour du jour et résumé), À venir (7 jours + plus tard), Toutes (par liste), Terminées, Recherche avec filtres |
| **Listes** | Études, Enseignement, Chat, Maison, Perso, Courses… créées d'avance, modifiables à volonté (nom, emoji, couleur) |
| **Récurrences** | Tous les jours / en semaine / chaque semaine / toutes les 2 semaines / chaque mois / chaque an, ou « tous les lundis » |
| **Thème** | Jour (papier crème) et Nocturne, automatique selon l'appareil |
| **Rappels** | Notification quand une tâche avec heure approche ; pastille sur l'icône avec le nombre de tâches du jour |
| **Statistiques** | Tâches terminées, série de jours d'affilée 🔥, répartition par liste |
| **Données** | Export/Import JSON, sauvegardes quotidiennes automatiques côté serveur |
| **Synchro** | Mac ↔ iPhone via votre propre petit serveur, fusion intelligente, chiffrement AES-256 de bout en bout |

---

## 🚀 Démarrage en 3 minutes (sur le Mac)

1. **Installer Node.js** (une seule fois) : <https://nodejs.org> (version LTS), ou `brew install node`.
2. **Lancer le serveur** dans le Terminal :
   ```bash
   cd chemin/vers/memo
   node server.js
   ```
   Il affiche :
   ```
   🎨  Carnet est prêt.
   Sur cet ordinateur : http://localhost:8787
   Sur le réseau local : http://192.168.1.42:8787
   Jeton de synchronisation : Xk3…
   ```
3. **Ouvrir** <http://localhost:8787> dans Safari. C'est tout : Carnet fonctionne déjà, avec les données stockées dans le navigateur.

> Le jeton est enregistré dans `memo/data/token.txt` (jamais commité). Le dossier `data/` contient
> aussi le coffre `vault.json` et 7 jours de sauvegardes automatiques.

---

## 📱 L'avoir comme une vraie app (icône, plein écran)

**iPhone 15 (Safari)** : ouvrir l'adresse de Carnet → bouton **Partager** (carré avec flèche) →
**« Sur l'écran d'accueil »** → Ajouter. L'icône aquarelle apparaît ; l'app s'ouvre plein écran, sans
barre Safari, respecte la Dynamic Island, et marche hors-ligne (si l'adresse est en HTTPS, voir ci-dessous).

**MacBook Air (Safari)** : ouvrir l'adresse → menu **Fichier → « Ajouter au Dock »**. Elle a sa propre
fenêtre et son icône dans le Dock, comme une app native. (Avec Chrome : icône « Installer » dans la barre d'adresse.)

---

## 🔁 Synchroniser Mac ↔ iPhone : la bonne manière

Le serveur doit tourner sur un ordinateur allumé (le Mac). Trois façons d'y accéder depuis l'iPhone, de la meilleure à la plus simple :

### Option A — Recommandée : Tailscale (gratuit, chiffré, marche partout, HTTPS)

Tailscale crée un mini réseau privé entre vos appareils, **sans ouvrir de port** ni rien exposer sur Internet.
Bonus : il fournit un **vrai certificat HTTPS**, ce qui débloque sur iPhone le mode hors-ligne complet,
le chiffrement de bout en bout et les notifications.

1. Installer **Tailscale** sur le Mac (<https://tailscale.com/download>) et sur l'iPhone (App Store), se connecter avec le **même compte** (Apple/Google) sur les deux.
2. Sur le Mac, activer HTTPS pour le réseau : dans l'admin Tailscale (<https://login.tailscale.com/admin/dns>) → **Enable HTTPS** et **MagicDNS**.
3. Publier Carnet en HTTPS sur le tailnet (une seule fois) :
   ```bash
   tailscale serve --bg 8787
   ```
   Tailscale affiche une adresse du type `https://macbook-air.tail1234.ts.net` — c'est **l'adresse de Carnet**, valable depuis l'iPhone où qu'il soit (Wi-Fi, 4G/5G), tant que le Mac est allumé et connecté.
4. Sur l'iPhone : ouvrir cette adresse dans Safari, l'ajouter à l'écran d'accueil.
5. Dans Carnet → **Réglages → Synchronisation** sur chaque appareil :
   - Adresse du serveur : `https://macbook-air.tail1234.ts.net`
   - Jeton : celui affiché par `node server.js`
   - Phrase secrète : **la même sur les deux appareils** (elle chiffre tout avant l'envoi ; le serveur ne voit qu'un blob illisible)
   - **Tester et synchroniser** ✓

Sur le Mac lui-même, on peut utiliser soit `http://localhost:8787`, soit l'adresse Tailscale (préférable, pour avoir exactement la même configuration).

### Option B — Wi-Fi de la maison uniquement (le plus simple)

Ouvrir sur l'iPhone l'adresse « réseau local » affichée par le serveur, par ex. `http://192.168.1.42:8787`, et la mettre dans Réglages → Synchronisation des deux appareils.

Limites, honnêtement : en HTTP, Safari n'autorise ni le chiffrement de bout en bout ni le mode hors-ligne (l'app ne s'ouvrira pas hors de la maison). Les données restent pourtant sur votre réseau local, protégées par le jeton. Pour une utilisation partout, préférez l'option A.

*(Pour que l'adresse ne change pas, donnez au Mac une IP fixe dans la box, ou utilisez `http://nom-du-mac.local:8787` — le nom se trouve dans Réglages Système → Général → Partage.)*

### Option C — HTTPS sur le Wi-Fi maison sans Tailscale (pour les bricoleurs)

```bash
brew install mkcert && mkcert -install
mkcert -cert-file data/cert.pem -key-file data/key.pem macbook-air.local 192.168.1.42
node server.js   # démarre automatiquement en HTTPS si data/cert.pem + data/key.pem existent
```
Puis installer le certificat racine de mkcert sur l'iPhone (`mkcert -CAROOT` → envoyer `rootCA.pem` par AirDrop → Réglages → Profil téléchargé → Installer → puis Réglages → Général → Informations → Réglages des certificats → activer la confiance totale).

---

## 🌙 Lancer Carnet automatiquement au démarrage du Mac

Créer le fichier `~/Library/LaunchAgents/fr.carnet.server.plist` (adapter les deux chemins ; `which node` donne le chemin de Node, souvent `/opt/homebrew/bin/node` sur un Mac M1) :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>fr.carnet.server</string>
  <key>ProgramArguments</key><array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/VOTRE_NOM/memo/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/VOTRE_NOM/memo</string>
  <key>EnvironmentVariables</key><dict><key>PORT</key><string>8787</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/carnet.log</string>
  <key>StandardErrorPath</key><string>/tmp/carnet.log</string>
</dict></plist>
```
Puis : `launchctl load ~/Library/LaunchAgents/fr.carnet.server.plist`. Le jeton reste consultable dans `memo/data/token.txt`.

> Quand le Mac dort (capot fermé), le serveur est injoignable : l'app continue de fonctionner sur
> l'iPhone (tout est local) et rattrape la synchro dès que le Mac se réveille. Si vous voulez une synchro
> permanente, faites tourner `server.js` sur une machine toujours allumée (vieux Mac, Raspberry Pi…) avec Tailscale.

---

## 🔐 Vie privée & sécurité

- **Aucun tiers** : ni Google, ni iCloud, ni « notre serveur ». Seulement le vôtre.
- **Jeton** obligatoire pour parler à l'API ; comparaison en temps constant ; blocage temporaire après 8 échecs.
- **Chiffrement de bout en bout** (AES-256-GCM, clé dérivée de la phrase secrète par PBKDF2) : le fichier `vault.json` sur le Mac est illisible sans la phrase. Une phrase oubliée = coffre irrécupérable (les données restent sur chaque appareil, il suffit de changer la phrase et de resynchroniser).
- **Fusion sans perte** : chaque tâche porte sa date de modification ; le plus récent gagne ; les suppressions sont propagées ; conflits d'écriture gérés par numéro de révision (jamais d'écrasement silencieux).
- `data/` est ignoré par git : jeton et coffre ne quittent jamais la machine.

---

## ✍️ Astuces de saisie (dans la barre d'ajout)

| Vous tapez… | Carnet comprend |
|---|---|
| `Rendre le mémoire vendredi 17h !!!` | échéance vendredi 17:00, priorité haute |
| `Vermifuge du chat le 15 tous les mois @chat` | le 15, répétition mensuelle, liste Chat |
| `Préparer cours 4e demain matin #cours` | demain 9:00, étiquette #cours |
| `Appeler le véto dans 3 jours` | échéance dans 3 jours |
| `Courses ce week-end @courses` | samedi, liste Courses |
| `Sport tous les lundis 19h` | chaque lundi à 19:00 |

Mots compris : aujourd'hui, demain, après-demain, lundi…dimanche (+ « prochain »), ce week-end, semaine prochaine, mois prochain, dans N jours/semaines/mois, le 12, 12/10, 12/10/2026, 3 mars, 17h, 17h30, 9:30, midi, ce matin, cet aprem, ce soir, `!` `!!` `!!!`, urgent, `#étiquette`, `@liste`, tous les jours / en semaine / toutes les semaines / toutes les 2 semaines / tous les mois / tous les ans / tous les lundis.

Raccourcis Mac : `/` ou `n` → ajouter, `⌘K` → rechercher, `Échap` → fermer.

---

## 🗂 Structure

```
memo/
├── server.js            # serveur : fichiers statiques + API de synchro (zéro dépendance)
├── package.json
├── web/                 # l'application (PWA)
│   ├── index.html
│   ├── styles.css       # thème « carnet impressionniste » (jour / nocturne)
│   ├── app.js           # toute la logique
│   ├── sw.js            # hors-ligne
│   ├── manifest.webmanifest
│   └── icons/           # générées par tools/gen-icons.js
├── tools/gen-icons.js   # régénère les icônes PNG (node tools/gen-icons.js)
└── data/                # créé au lancement : token.txt, vault.json, sauvegardes (ignoré par git)
```

Variables d'environnement du serveur : `PORT` (8787), `HOST` (0.0.0.0), `CARNET_DATA` (dossier data), `CARNET_TOKEN` (forcer un jeton), `CARNET_CERT` / `CARNET_KEY` (certificat HTTPS).

Fait avec amour, sans cloud ni pub 💐
