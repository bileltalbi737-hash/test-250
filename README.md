# Dofus MultiSwitch

Gestionnaire de fenêtres **multi-compte** pour Dofus (dans l'esprit de
l'Organizer de Naio) : attribuez un raccourci clavier global à chacune de
vos fenêtres de jeu (F1, F2, F3… jusqu'à 8 comptes et plus) et basculez
instantanément d'un personnage à l'autre.

**Zéro dépendance** : Python pur (API Win32 via `ctypes`, interface
`tkinter`). Fonctionne sous Windows 10/11 avec Dofus 2, Dofus 3 (Unity)
et Dofus Retro.

---

## ⚖️ Conformité avec les CGU d'Ankama

Cet outil est conçu pour rester dans ce qu'Ankama autorise :

| Ce que fait l'outil ✅ | Ce qu'il ne fait JAMAIS ❌ |
|---|---|
| Mettre au premier plan la fenêtre demandée (changement de focus, comme Alt+Tab) | Envoyer des touches ou des clics au jeu |
| 1 appui de touche = 1 action = 1 seule fenêtre | Dupliquer une entrée vers plusieurs clients à la fois |
| Mémoriser vos raccourcis et votre ordre d'initiative | Automatiser une action de jeu (déplacement, sort, récolte…) |
| Lire les **titres** des fenêtres pour les identifier | Lire la mémoire du jeu, les paquets réseau ou les pixels |

C'est exactement la catégorie d'outils de confort (type Organizer) tolérée
par Ankama : un « switcheur » de fenêtres. Ce qui fait bannir, ce sont les
bots, l'automatisation et la **duplication d'entrées** (une touche envoyée
à 8 clients en même temps) — cet outil n'en est techniquement pas capable,
le code ne contient aucune fonction d'injection d'entrées.

> ⚠️ **Rappels importants**
> - Le multi-compte est **interdit sur les serveurs mono-compte**. N'utilisez le multi-compte que sur les serveurs qui l'autorisent.
> - Les règles d'Ankama peuvent évoluer : consultez les Conditions Générales d'Utilisation et les règles de jeu officielles en vigueur.
> - Cet outil est un projet indépendant, non affilié à Ankama.

---

## 🚀 Installation

1. Installez [Python 3](https://www.python.org/downloads/) (3.9 ou plus récent).
   Pendant l'installation, laissez cochées les options **tcl/tk** et **Add to PATH**.
2. Téléchargez/clonez ce dépôt.
3. Double-cliquez sur **`DofusMultiSwitch.pyw`** — c'est tout.

### En faire un .exe (optionnel)

Double-cliquez sur `build_exe.bat` : il installe PyInstaller et produit
`dist\DofusMultiSwitch.exe`, un exécutable autonome à mettre où vous voulez.

---

## 🎮 Utilisation

1. Lancez vos clients Dofus et connectez vos personnages.
2. Ouvrez Dofus MultiSwitch : les fenêtres sont détectées automatiquement.
3. Cliquez sur **« Auto-assigner F1-F8 »** : la 1ʳᵉ fenêtre reçoit F1, la 2ᵉ F2, etc.
   (ou sélectionnez une ligne et choisissez la touche à la main, avec Ctrl/Alt/Maj si besoin).
4. Ordonnez la liste avec **▲ Monter / ▼ Descendre** pour refléter votre
   **ordre d'initiative** en combat.
5. Cliquez sur **« ▶ Activer les raccourcis »**.
6. En jeu : appuyez sur **F1** → la fenêtre 1 passe au premier plan,
   **F2** → la fenêtre 2, etc.

### Fonctionnalités de confort

- **Fenêtre suivante / précédente** (F9/F10 par défaut, configurables) :
  parcourez vos comptes dans l'ordre de la liste — pratique pour enchaîner
  les tours en combat.
- **Dernière fenêtre utilisée** : une touche pour revenir à la fenêtre
  précédente (aller-retour rapide entre 2 personnages).
- **Double-clic** sur une ligne de la liste = activer cette fenêtre.
- **Actualisation automatique** : les fenêtres ouvertes/fermées/reconnectées
  sont re-détectées toutes les 3 secondes ; la fenêtre actuellement active
  est surlignée en vert.
- **Toujours visible** : garde le gestionnaire au-dessus des autres fenêtres.
- **Mémoire par personnage** : les raccourcis et l'ordre sont associés au
  **nom du personnage** et sauvegardés (`%APPDATA%\DofusMultiSwitch\config.json`).
  Redémarrez le jeu ou l'outil : tout est retrouvé automatiquement.
- Si les raccourcis étaient actifs à la fermeture, ils sont **réarmés au
  lancement suivant**.

---

## ❓ FAQ / Dépannage

**Les touches F1–F8 ne font plus rien dans les autres logiciels ?**
C'est normal tant que les raccourcis sont activés : un raccourci global
capture la touche pour tout le système. Cliquez sur « ■ Désactiver les
raccourcis » (ou fermez l'outil) pour la libérer. Vous pouvez aussi choisir
des combinaisons comme `Ctrl+F1` pour laisser F1 libre.

**Un raccourci est « refusé par Windows » ?**
Une autre application l'utilise déjà (Discord, drivers, overlay…).
Choisissez une autre touche ou combinaison.

**Le changement de fenêtre ne marche pas ?**
Si Dofus est lancé **en administrateur**, Windows empêche une application
normale d'agir sur ses fenêtres : lancez alors Dofus MultiSwitch en
administrateur aussi (clic droit → Exécuter en tant qu'administrateur).

**Deux personnages ont le même nom ?**
Le deuxième apparaît comme « Nom #2 » ; les raccourcis restent distincts.

**Une fenêtre affiche « (non connecté) » ?**
Le client n'a pas encore de personnage connecté : le titre de la fenêtre ne
contient pas de nom. Connectez le personnage puis « Actualiser ».

---

## 🧪 Tests

La logique pure (raccourcis, détection de noms, ordre, configuration) est
couverte par des tests exécutables sur n'importe quelle plateforme :

```
python -m unittest discover -s tests
```

## 📁 Structure du code

```
DofusMultiSwitch.pyw        ← lanceur (double-clic)
build_exe.bat               ← construction d'un .exe autonome (optionnel)
dofus_multiswitch/
  __main__.py               ← point d'entrée (python -m dofus_multiswitch)
  gui.py                    ← interface (tkinter)
  gamewindows.py            ← détection des fenêtres Dofus, ordre, cycle
  hotkeys.py                ← raccourcis globaux (thread + RegisterHotKey)
  keys.py                   ← table des touches, parsing « Ctrl+F1 »
  config.py                 ← sauvegarde JSON dans %APPDATA%
  winapi.py                 ← liaisons ctypes vers l'API Win32
tests/test_logic.py         ← tests unitaires de la logique pure
```
