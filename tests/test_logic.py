# -*- coding: utf-8 -*-
"""Tests de la logique pure (exécutables sur toute plateforme).

Lancement : python -m unittest discover -s tests
"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dofus_multiswitch import config, gamewindows, keys
from dofus_multiswitch.gamewindows import GameWindow


class TestKeys(unittest.TestCase):
    def test_parse_simple(self):
        self.assertEqual(keys.parse_hotkey("F1"), (0, 0x70))
        self.assertEqual(keys.parse_hotkey("F12"), (0, 0x7B))
        self.assertEqual(keys.parse_hotkey("A"), (0, 0x41))
        self.assertEqual(keys.parse_hotkey("9"), (0, 0x39))
        self.assertEqual(keys.parse_hotkey("NUM5"), (0, 0x65))

    def test_parse_modifiers(self):
        mods, vk = keys.parse_hotkey("Ctrl+Alt+F2")
        self.assertEqual(mods, keys.MOD_CONTROL | keys.MOD_ALT)
        self.assertEqual(vk, 0x71)
        mods, _ = keys.parse_hotkey("Maj+F1")
        self.assertEqual(mods, keys.MOD_SHIFT)
        mods, _ = keys.parse_hotkey("shift+f1")  # tolérance de casse
        self.assertEqual(mods, keys.MOD_SHIFT)

    def test_parse_invalid(self):
        for bad in ("", "  ", "F13+", "Ctrl+", "Blorp", "Ctrl+Blorp", "F0"):
            with self.assertRaises(ValueError, msg=bad):
                keys.parse_hotkey(bad)

    def test_make_and_normalize_roundtrip(self):
        hk = keys.make_hotkey("F3", ctrl=True, shift=True)
        self.assertEqual(hk, "Ctrl+Maj+F3")
        self.assertEqual(keys.normalize_hotkey("maj+ctrl+f3"), "Ctrl+Maj+F3")
        self.assertEqual(keys.normalize_hotkey(hk), hk)

    def test_is_valid(self):
        self.assertTrue(keys.is_valid_hotkey("F8"))
        self.assertFalse(keys.is_valid_hotkey("F98"))
        self.assertFalse(keys.is_valid_hotkey(""))


class TestCharacterName(unittest.TestCase):
    def test_dofus2(self):
        self.assertEqual(
            gamewindows.character_name("Croustibat - Dofus 2.73.5.12"), "Croustibat"
        )

    def test_dofus3(self):
        self.assertEqual(gamewindows.character_name("Kali-la-fée - Dofus 3.1"), "Kali-la-fée")

    def test_retro(self):
        self.assertEqual(gamewindows.character_name("Bwork - Dofus Retro"), "Bwork")

    def test_not_logged(self):
        self.assertEqual(gamewindows.character_name("Dofus"), gamewindows.NOT_LOGGED_LABEL)
        self.assertEqual(
            gamewindows.character_name("Dofus 2.73"), gamewindows.NOT_LOGGED_LABEL
        )
        self.assertEqual(gamewindows.character_name(""), gamewindows.NOT_LOGGED_LABEL)

    def test_name_containing_dash(self):
        self.assertEqual(
            gamewindows.character_name("Ecaflip - du - chaos - Dofus 2.73"),
            "Ecaflip - du - chaos",
        )


class TestDetectionFilter(unittest.TestCase):
    def test_accepts_game_titles(self):
        self.assertTrue(gamewindows.looks_like_dofus("Perso - Dofus 2.73"))
        self.assertTrue(gamewindows.looks_like_dofus("Dofus"))
        self.assertTrue(
            gamewindows.looks_like_dofus("Perso - Dofus 3.0", r"C:\Games\Dofus\Dofus.exe")
        )

    def test_rejects_launcher_and_self(self):
        self.assertFalse(gamewindows.looks_like_dofus("Ankama Launcher"))
        self.assertFalse(gamewindows.looks_like_dofus("Dofus MultiSwitch"))
        self.assertFalse(gamewindows.looks_like_dofus(""))
        self.assertFalse(gamewindows.looks_like_dofus("Bloc-notes"))

    def test_rejects_browsers_by_process(self):
        self.assertFalse(
            gamewindows.looks_like_dofus(
                "Dofus - forum - Google Chrome", r"C:\Program Files\Google\chrome.exe"
            )
        )
        # Sans information de processus, le titre seul décide.
        self.assertTrue(gamewindows.looks_like_dofus("Perso - Dofus 2.73", ""))

    def test_character_named_cra(self):
        self.assertTrue(gamewindows.looks_like_dofus("Cra Rouge - Dofus 2.73"))


class TestOrderAndCycle(unittest.TestCase):
    def _windows(self, *names):
        return [GameWindow(1000 + i, "%s - Dofus 2" % n, n, 1) for i, n in enumerate(names)]

    def test_order_windows(self):
        wins = self._windows("C", "A", "B")
        ordered = gamewindows.order_windows(wins, ["A", "B", "C"])
        self.assertEqual([w.character for w in ordered], ["A", "B", "C"])

    def test_order_unknown_last_stable(self):
        wins = self._windows("Z", "A", "Y")
        ordered = gamewindows.order_windows(wins, ["A"])
        self.assertEqual([w.character for w in ordered], ["A", "Z", "Y"])

    def test_cycle(self):
        hwnds = [1, 2, 3]
        self.assertEqual(gamewindows.cycle_target(hwnds, 1, 1), 2)
        self.assertEqual(gamewindows.cycle_target(hwnds, 3, 1), 1)  # boucle
        self.assertEqual(gamewindows.cycle_target(hwnds, 1, -1), 3)  # boucle arrière
        self.assertEqual(gamewindows.cycle_target(hwnds, 999, 1), 1)  # hors liste
        self.assertEqual(gamewindows.cycle_target(hwnds, 999, -1), 3)
        self.assertIsNone(gamewindows.cycle_target([], 1, 1))

    def test_dedupe_names(self):
        self.assertEqual(
            gamewindows.dedupe_names(["A", "B", "A", "A"]), ["A", "B", "A #2", "A #3"]
        )

    def test_dedupe_names_with_preexisting_suffix(self):
        result = gamewindows.dedupe_names(["A", "A #2", "A"])
        self.assertEqual(len(result), len(set(result)), "les noms doivent rester uniques")

    def test_character_name_containing_dofus(self):
        self.assertEqual(
            gamewindows.character_name("Roi - Dofus-Team - Dofus 2.73"),
            "Roi - Dofus-Team",
        )


class TestConfig(unittest.TestCase):
    def test_load_missing_gives_defaults(self):
        cfg = config.load(os.path.join(tempfile.gettempdir(), "nexiste-pas-xyz.json"))
        self.assertEqual(cfg, config.defaults())

    def test_roundtrip(self):
        cfg = config.defaults()
        cfg["bindings"]["Croustibat"] = "F1"
        cfg["order"] = ["Croustibat"]
        cfg["nav"]["next"] = "F9"
        cfg["options"]["topmost"] = True
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "config.json")
            config.save(cfg, path)
            loaded = config.load(path)
        self.assertEqual(loaded, cfg)

    def test_load_corrupt_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "config.json")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("{pas du json")
            self.assertEqual(config.load(path), config.defaults())

    def test_load_wrong_types_falls_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "config.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(
                    {
                        "bindings": {"Perso": 42, "Ok": "F2"},
                        "order": ["Ok", 3],
                        "nav": "invalide",
                        "options": {"topmost": "oui"},
                    },
                    handle,
                )
            cfg = config.load(path)
        self.assertEqual(cfg["bindings"], {"Ok": "F2"})
        self.assertEqual(cfg["order"], ["Ok"])
        self.assertEqual(cfg["nav"], config.defaults()["nav"])
        self.assertEqual(cfg["options"]["topmost"], False)


if __name__ == "__main__":
    unittest.main()
