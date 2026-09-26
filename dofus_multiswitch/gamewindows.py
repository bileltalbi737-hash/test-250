# -*- coding: utf-8 -*-
"""Détection des fenêtres Dofus et logique d'ordre/cycle.

Les fonctions de parsing et de cycle sont pures (testables partout) ;
seule find_dofus_windows() touche à l'API Win32.
"""

import os
from collections import namedtuple

from . import winapi

GameWindow = namedtuple("GameWindow", ["hwnd", "title", "character", "pid"])

# Fenêtres contenant « dofus » mais qui ne sont PAS un client de jeu.
_EXCLUDED_SUBSTRINGS = (
    "ankama launcher",
    "multiswitch",  # notre propre fenêtre
)

# Exécutables jamais considérés comme un client de jeu (navigateurs, etc.).
_EXCLUDED_PROCESSES = (
    "chrome.exe",
    "firefox.exe",
    "msedge.exe",
    "opera.exe",
    "brave.exe",
    "vivaldi.exe",
    "explorer.exe",
    "discord.exe",
)

NOT_LOGGED_LABEL = "(non connecté)"


def looks_like_dofus(title, process_image=""):
    """Vrai si le titre (et le processus) ressemblent à un client Dofus.

    `process_image` est le chemin de l'exécutable ("" si inconnu) : un
    exécutable dont le nom commence par « dofus » est toujours accepté,
    un navigateur/Discord est toujours refusé, et en l'absence
    d'information on se rabat sur le titre seul.
    """
    if not title:
        return False
    lowered = title.lower()
    if "dofus" not in lowered:
        return False
    if any(excl in lowered for excl in _EXCLUDED_SUBSTRINGS):
        return False
    if process_image:
        exe = process_image.replace("\\", "/").rsplit("/", 1)[-1].lower()
        if exe.startswith("dofus"):
            return True
        if exe in _EXCLUDED_PROCESSES:
            return False
    return True


def character_name(title):
    """Extrait le nom du personnage d'un titre de fenêtre Dofus.

    Formats connus :
      « Nom - Dofus 2.73.5.12 »  (Dofus 2)
      « Nom - Dofus 3.x »        (Dofus 3 / Unity)
      « Nom - Dofus Retro »      (Retro)
      « Dofus »                  (client pas encore connecté)
    """
    if not title:
        return NOT_LOGGED_LABEL
    for separator in (" - Dofus", " — Dofus", " – Dofus"):
        index = title.find(separator)
        if index > 0:
            return title[:index].strip()
    stripped = title.strip()
    if stripped.lower().startswith("dofus"):
        return NOT_LOGGED_LABEL
    return stripped


def dedupe_names(names):
    """Rend les noms uniques : le 2e « Nom » devient « Nom #2 », etc."""
    seen = {}
    result = []
    for name in names:
        count = seen.get(name, 0) + 1
        seen[name] = count
        result.append(name if count == 1 else "%s #%d" % (name, count))
    return result


def order_windows(windows, saved_order):
    """Trie les fenêtres selon l'ordre sauvegardé (ordre d'initiative).

    Les personnages inconnus de l'ordre sauvegardé sont placés à la fin,
    dans leur ordre de détection. Tri stable.
    """
    rank = {name: i for i, name in enumerate(saved_order)}
    fallback = len(saved_order)
    return sorted(
        windows,
        key=lambda w, _r=rank, _f=fallback: _r.get(w.character, _f),
    )


def cycle_target(hwnds, current, step):
    """Renvoie le hwnd suivant/précédent dans le cycle, ou None si vide.

    Si `current` (fenêtre au premier plan) n'est pas dans la liste, on va
    à la première fenêtre (step > 0) ou à la dernière (step < 0).
    """
    if not hwnds:
        return None
    try:
        index = hwnds.index(current)
    except ValueError:
        return hwnds[0] if step > 0 else hwnds[-1]
    return hwnds[(index + step) % len(hwnds)]


def find_dofus_windows():
    """Détecte les clients Dofus ouverts (fenêtres visibles, hors launcher).

    Les noms de personnages en double sont suffixés (#2, #3…) pour rester
    des clés uniques dans la configuration.
    """
    own_pid = os.getpid()
    found = []
    image_cache = {}
    for hwnd, title, pid in winapi.list_windows():
        if pid == own_pid:
            continue
        if "dofus" not in title.lower():
            continue
        if pid not in image_cache:
            image_cache[pid] = winapi.get_process_image(pid)
        if looks_like_dofus(title, image_cache[pid]):
            found.append(GameWindow(hwnd, title, character_name(title), pid))
    names = dedupe_names([w.character for w in found])
    return [w._replace(character=name) for w, name in zip(found, names)]
