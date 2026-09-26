# -*- coding: utf-8 -*-
"""Tables de touches virtuelles et représentation des raccourcis.

Module de logique pure (aucun appel système) : il est testable sur
n'importe quelle plateforme. Les constantes MOD_* et les codes de touches
virtuelles (VK) sont ceux, stables, de l'API Win32.
"""

# Modificateurs pour RegisterHotKey (winuser.h)
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000  # pas de répétition quand la touche reste enfoncée

# Codes de touches virtuelles utilisables comme raccourci global.
VK_CODES = {}
for _i in range(1, 13):  # F1..F12
    VK_CODES["F%d" % _i] = 0x70 + _i - 1
for _i in range(10):  # 0..9 (rangée du haut)
    VK_CODES[str(_i)] = 0x30 + _i
for _i in range(26):  # A..Z
    VK_CODES[chr(ord("A") + _i)] = 0x41 + _i
for _i in range(10):  # pavé numérique
    VK_CODES["NUM%d" % _i] = 0x60 + _i

# Ordre d'affichage dans les listes déroulantes de l'interface.
KEY_CHOICES = (
    ["F%d" % i for i in range(1, 13)]
    + [str(d) for d in range(10)]
    + [chr(c) for c in range(ord("A"), ord("Z") + 1)]
    + ["NUM%d" % d for d in range(10)]
)

_MOD_BY_NAME = {
    "CTRL": MOD_CONTROL,
    "ALT": MOD_ALT,
    "MAJ": MOD_SHIFT,
    "SHIFT": MOD_SHIFT,  # accepté en lecture pour tolérance
    "WIN": MOD_WIN,
}

# Ordre canonique d'écriture des modificateurs dans un raccourci.
_MOD_ORDER = [("Ctrl", MOD_CONTROL), ("Alt", MOD_ALT), ("Maj", MOD_SHIFT), ("Win", MOD_WIN)]


def make_hotkey(key, ctrl=False, alt=False, shift=False, win=False):
    """Construit la forme canonique d'un raccourci, ex. « Ctrl+Alt+F1 »."""
    key = str(key).strip().upper()
    if key not in VK_CODES:
        raise ValueError("Touche inconnue : %r" % key)
    parts = []
    if ctrl:
        parts.append("Ctrl")
    if alt:
        parts.append("Alt")
    if shift:
        parts.append("Maj")
    if win:
        parts.append("Win")
    parts.append(key)
    return "+".join(parts)


def parse_hotkey(text):
    """Analyse « Ctrl+F1 » → (modificateurs, code VK).

    Lève ValueError si le texte n'est pas un raccourci valide.
    """
    if not text or not str(text).strip():
        raise ValueError("Raccourci vide")
    tokens = [t.strip() for t in str(text).split("+") if t.strip()]
    if not tokens:
        raise ValueError("Raccourci vide")
    key = tokens[-1].upper()
    if key not in VK_CODES:
        raise ValueError("Touche inconnue : %r" % tokens[-1])
    mods = 0
    for tok in tokens[:-1]:
        mod = _MOD_BY_NAME.get(tok.upper())
        if mod is None:
            raise ValueError("Modificateur inconnu : %r" % tok)
        mods |= mod
    return mods, VK_CODES[key]


def normalize_hotkey(text):
    """Renvoie la forme canonique d'un raccourci (ou lève ValueError)."""
    mods, vk = parse_hotkey(text)
    key = next(k for k, v in VK_CODES.items() if v == vk)
    parts = [label for label, flag in _MOD_ORDER if mods & flag]
    parts.append(key)
    return "+".join(parts)


def is_valid_hotkey(text):
    try:
        parse_hotkey(text)
        return True
    except ValueError:
        return False
