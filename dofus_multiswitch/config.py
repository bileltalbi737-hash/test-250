# -*- coding: utf-8 -*-
"""Chargement/sauvegarde de la configuration (JSON dans %APPDATA%).

La configuration est indexée par NOM DE PERSONNAGE, pas par fenêtre :
elle survit donc aux redémarrages du jeu et de l'outil.
"""

import json
import os
import tempfile

APP_DIR_NAME = "DofusMultiSwitch"
CONFIG_FILE_NAME = "config.json"


def defaults():
    """Configuration par défaut (nouvelle instance à chaque appel)."""
    return {
        # personnage -> raccourci ("F1", "Ctrl+F2", ...)
        "bindings": {},
        # ordre d'initiative : liste de noms de personnages
        "order": [],
        # raccourcis de navigation ("" = désactivé)
        "nav": {"next": "F9", "prev": "F10", "last": ""},
        "options": {
            "topmost": False,
            "auto_refresh": True,
            "refresh_secs": 3,
            "armed": False,  # raccourcis actifs à la fermeture -> réarmés au lancement
        },
    }


def config_dir():
    base = os.environ.get("APPDATA") or os.path.expanduser("~")
    return os.path.join(base, APP_DIR_NAME)


def config_path():
    return os.path.join(config_dir(), CONFIG_FILE_NAME)


def _merge(default, loaded):
    """Fusionne récursivement `loaded` dans `default` (types vérifiés)."""
    if not isinstance(loaded, dict):
        return default
    merged = {}
    for key, default_value in default.items():
        value = loaded.get(key, default_value)
        if isinstance(default_value, dict) and key not in ("bindings",):
            merged[key] = _merge(default_value, value)
        elif isinstance(value, type(default_value)) or (
            key == "bindings" and isinstance(value, dict)
        ):
            merged[key] = value
        else:
            merged[key] = default_value
    return merged


def load(path=None):
    """Charge la configuration ; renvoie les valeurs par défaut si absente
    ou illisible (jamais d'exception)."""
    path = path or config_path()
    base = defaults()
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return base
    merged = _merge(base, data)
    # Nettoyage : ne garder que des chaînes dans bindings/order.
    merged["bindings"] = {
        str(k): str(v) for k, v in merged["bindings"].items() if isinstance(v, str) and v
    }
    merged["order"] = [str(n) for n in merged["order"] if isinstance(n, str)]
    return merged


def save(cfg, path=None):
    """Sauvegarde atomique (fichier temporaire puis remplacement)."""
    path = path or config_path()
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix="config.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(cfg, handle, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)
    except BaseException:
        # Quelle que soit l'erreur (OSError, TypeError...), ne pas laisser
        # traîner le fichier temporaire.
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise
