# -*- coding: utf-8 -*-
"""Interface graphique (tkinter) de Dofus MultiSwitch.

Tout ce que fait l'outil : afficher les fenêtres Dofus détectées, leur
associer un raccourci clavier global, et mettre la bonne fenêtre au
premier plan quand on appuie sur la touche. Rien d'autre.
"""

import functools
import queue
import threading
import tkinter as tk
from tkinter import messagebox, ttk

from . import APP_NAME, __version__, config, gamewindows, keys, winapi
from .hotkeys import HotkeyThread

NAV_NONE = "(aucune)"

ABOUT_TEXT = (
    "%s v%s\n\n"
    "Gestionnaire de fenêtres multi-compte pour Dofus.\n\n"
    "Conformité CGU Ankama :\n"
    "• 1 appui de touche = 1 action = 1 fenêtre (changement de focus uniquement)\n"
    "• aucune touche ni aucun clic n'est envoyé au jeu\n"
    "• aucune duplication d'entrées vers plusieurs clients\n"
    "• aucune automatisation d'action de jeu\n\n"
    "Rappel : le multi-compte est interdit sur les serveurs mono-compte."
) % (APP_NAME, __version__)


class App:
    def __init__(self, root):
        self.root = root
        self.cfg = config.load()
        self.windows = []  # liste ordonnée de GameWindow (remplacée atomiquement)
        self.char_to_hwnd = {}  # personnage -> hwnd (remplacé atomiquement)
        self.hotkey_thread = None
        self.armed = False
        self._last_signature = None
        self._previous_hwnd = 0  # pour le raccourci « dernière fenêtre »
        # File d'événements venant du thread des raccourcis : celui-ci ne
        # doit JAMAIS appeler Tcl/Tk directement (même root.after), sous
        # peine de se bloquer en attendant la boucle d'événements.
        self._ui_queue = queue.Queue()

        root.title(APP_NAME)
        root.minsize(640, 420)
        root.protocol("WM_DELETE_WINDOW", self.on_close)

        self._build_menu()
        self._build_ui()
        self._apply_options()
        self.refresh()
        self._schedule_auto_refresh()
        self.root.after(100, self._poll_ui_queue)

        if self.cfg["options"].get("armed"):
            self.root.after(200, self.arm)

    # ------------------------------------------------------------------ UI

    def _build_menu(self):
        menubar = tk.Menu(self.root)
        helpmenu = tk.Menu(menubar, tearoff=0)
        helpmenu.add_command(label="À propos / rappel CGU", command=self._show_about)
        menubar.add_cascade(label="Aide", menu=helpmenu)
        self.root.config(menu=menubar)

    def _build_ui(self):
        pad = {"padx": 6, "pady": 4}

        # --- Barre d'outils -------------------------------------------------
        toolbar = ttk.Frame(self.root)
        toolbar.pack(fill="x", **pad)
        ttk.Button(toolbar, text="Actualiser", command=self.refresh).pack(side="left")
        ttk.Button(
            toolbar, text="Auto-assigner F1, F2…", command=self.auto_assign
        ).pack(side="left", padx=(6, 0))
        ttk.Button(toolbar, text="▲ Monter", command=lambda: self.move_selected(-1)).pack(
            side="left", padx=(18, 0)
        )
        ttk.Button(toolbar, text="▼ Descendre", command=lambda: self.move_selected(1)).pack(
            side="left", padx=(6, 0)
        )

        self.var_topmost = tk.BooleanVar(value=self.cfg["options"]["topmost"])
        ttk.Checkbutton(
            toolbar,
            text="Toujours visible",
            variable=self.var_topmost,
            command=self.on_toggle_topmost,
        ).pack(side="right")
        self.var_autorefresh = tk.BooleanVar(value=self.cfg["options"]["auto_refresh"])
        ttk.Checkbutton(
            toolbar,
            text="Actualisation auto",
            variable=self.var_autorefresh,
            command=self.on_toggle_autorefresh,
        ).pack(side="right", padx=(0, 10))

        # --- Liste des fenêtres --------------------------------------------
        columns = ("slot", "hotkey", "character", "title")
        self.tree = ttk.Treeview(self.root, columns=columns, show="headings", height=10)
        self.tree.heading("slot", text="N°")
        self.tree.heading("hotkey", text="Raccourci")
        self.tree.heading("character", text="Personnage")
        self.tree.heading("title", text="Fenêtre")
        self.tree.column("slot", width=40, anchor="center", stretch=False)
        self.tree.column("hotkey", width=110, anchor="center", stretch=False)
        self.tree.column("character", width=180, anchor="w", stretch=False)
        self.tree.column("title", anchor="w")
        self.tree.tag_configure("active", background="#d6f5d6")
        self.tree.pack(fill="both", expand=True, **pad)
        self.tree.bind("<Double-1>", self.on_tree_double_click)

        # --- Assignation d'un raccourci -------------------------------------
        assign = ttk.LabelFrame(self.root, text="Raccourci du personnage sélectionné")
        assign.pack(fill="x", **pad)
        ttk.Label(assign, text="Touche :").pack(side="left", padx=(8, 2), pady=4)
        self.var_key = tk.StringVar(value="F1")
        ttk.Combobox(
            assign,
            textvariable=self.var_key,
            values=keys.KEY_CHOICES,
            state="readonly",
            width=6,
        ).pack(side="left", pady=4)
        self.var_ctrl = tk.BooleanVar()
        self.var_alt = tk.BooleanVar()
        self.var_shift = tk.BooleanVar()
        ttk.Checkbutton(assign, text="Ctrl", variable=self.var_ctrl).pack(side="left", padx=(8, 0))
        ttk.Checkbutton(assign, text="Alt", variable=self.var_alt).pack(side="left")
        ttk.Checkbutton(assign, text="Maj", variable=self.var_shift).pack(side="left")
        ttk.Button(assign, text="Assigner", command=self.assign_hotkey).pack(
            side="left", padx=(12, 0)
        )
        ttk.Button(assign, text="Retirer", command=self.remove_hotkey).pack(
            side="left", padx=(6, 8)
        )

        # --- Navigation (cycle) ---------------------------------------------
        nav = ttk.LabelFrame(
            self.root, text="Navigation entre fenêtres (ordre de la liste = initiative)"
        )
        nav.pack(fill="x", **pad)
        nav_values = [NAV_NONE] + keys.KEY_CHOICES
        self.nav_vars = {}
        for label, name in (
            ("Suivante :", "next"),
            ("Précédente :", "prev"),
            ("Dernière utilisée :", "last"),
        ):
            ttk.Label(nav, text=label).pack(side="left", padx=(8, 2), pady=4)
            var = tk.StringVar(value=self.cfg["nav"].get(name) or NAV_NONE)
            combo = ttk.Combobox(
                nav, textvariable=var, values=nav_values, state="readonly", width=6
            )
            combo.pack(side="left", pady=4)
            combo.bind("<<ComboboxSelected>>", lambda _e, n=name: self.on_nav_change(n))
            self.nav_vars[name] = var

        # --- Activation ------------------------------------------------------
        bottom = ttk.Frame(self.root)
        bottom.pack(fill="x", **pad)
        self.btn_arm = tk.Button(
            bottom,
            text="▶  Activer les raccourcis",
            font=("TkDefaultFont", 11, "bold"),
            bg="#2e8b57",
            fg="white",
            activebackground="#3cb371",
            activeforeground="white",
            command=self.toggle_armed,
        )
        self.btn_arm.pack(fill="x", ipady=4)

        self.status = tk.StringVar(value="Prêt.")
        ttk.Label(self.root, textvariable=self.status, anchor="w", relief="sunken").pack(
            fill="x", side="bottom"
        )

    def _show_about(self):
        messagebox.showinfo("À propos", ABOUT_TEXT, parent=self.root)

    # ------------------------------------------------------------- helpers

    def _set_status(self, text):
        """Met à jour la barre d'état depuis n'importe quel thread."""
        if threading.current_thread() is threading.main_thread():
            self.status.set(text)
        else:
            self._ui_queue.put(("status", text))

    def _request_highlight(self):
        """Demande la mise à jour du surlignage (thread-safe)."""
        if threading.current_thread() is threading.main_thread():
            self._update_active_highlight()
        else:
            self._ui_queue.put(("highlight", None))

    def _poll_ui_queue(self):
        """Draine les événements postés par le thread des raccourcis."""
        try:
            while True:
                kind, payload = self._ui_queue.get_nowait()
                if kind == "status":
                    self.status.set(payload)
                elif kind == "highlight":
                    self._update_active_highlight()
        except queue.Empty:
            pass
        self.root.after(100, self._poll_ui_queue)

    def _selected_character(self):
        selection = self.tree.selection()
        if not selection:
            return None
        values = self.tree.item(selection[0], "values")
        return values[2] if len(values) >= 3 else None

    def _save_cfg(self):
        try:
            config.save(self.cfg)
        except OSError as exc:
            self._set_status("Impossible d'enregistrer la configuration : %s" % exc)

    # ------------------------------------------------------------- refresh

    def refresh(self):
        """Redétecte les fenêtres Dofus et reconstruit la liste."""
        try:
            detected = gamewindows.find_dofus_windows()
        except RuntimeError as exc:
            self._set_status(str(exc))
            return
        ordered = gamewindows.order_windows(detected, self.cfg["order"])
        self.windows = ordered
        self.char_to_hwnd = {w.character: w.hwnd for w in ordered}
        self._rebuild_tree()
        if not ordered:
            self._set_status(
                "Aucune fenêtre Dofus détectée. Lancez vos clients puis « Actualiser »."
            )
        else:
            self._set_status("%d fenêtre(s) Dofus détectée(s)." % len(ordered))

    def _rebuild_tree(self):
        selected = self._selected_character()
        self.tree.delete(*self.tree.get_children())
        try:
            foreground = winapi.get_foreground_window() if winapi.IS_WINDOWS else 0
        except RuntimeError:
            foreground = 0
        for index, window in enumerate(self.windows, start=1):
            hotkey = self.cfg["bindings"].get(window.character, "")
            tags = ("active",) if window.hwnd == foreground else ()
            item = self.tree.insert(
                "",
                "end",
                values=(index, hotkey, window.character, window.title),
                tags=tags,
            )
            if window.character == selected:
                self.tree.selection_set(item)
        self._last_signature = tuple((w.hwnd, w.title) for w in self.windows)

    def _schedule_auto_refresh(self):
        interval = max(1, int(self.cfg["options"].get("refresh_secs", 3))) * 1000
        self.root.after(interval, self._auto_refresh_tick)

    def _auto_refresh_tick(self):
        if self.var_autorefresh.get():
            try:
                detected = gamewindows.find_dofus_windows()
                ordered = gamewindows.order_windows(detected, self.cfg["order"])
                signature = tuple((w.hwnd, w.title) for w in ordered)
                if signature != self._last_signature:
                    self.windows = ordered
                    self.char_to_hwnd = {w.character: w.hwnd for w in ordered}
                    self._rebuild_tree()
                else:
                    self._update_active_highlight()
            except RuntimeError:
                pass
        self._schedule_auto_refresh()

    def _update_active_highlight(self):
        try:
            foreground = winapi.get_foreground_window()
        except RuntimeError:
            return
        for item in self.tree.get_children():
            values = self.tree.item(item, "values")
            character = values[2] if len(values) >= 3 else None
            hwnd = self.char_to_hwnd.get(character)
            self.tree.item(item, tags=("active",) if hwnd == foreground else ())

    # ------------------------------------------------------- ordre / slots

    def move_selected(self, delta):
        character = self._selected_character()
        if character is None:
            self._set_status("Sélectionnez d'abord une fenêtre dans la liste.")
            return
        current = [w.character for w in self.windows]
        if character not in current:
            return
        index = current.index(character)
        new_index = index + delta
        if not 0 <= new_index < len(current):
            return
        current[index], current[new_index] = current[new_index], current[index]
        self.cfg["order"] = current
        self._save_cfg()
        self.refresh()

    def auto_assign(self):
        """Assigne F1, F2, F3… aux fenêtres dans l'ordre de la liste.

        Les touches réservées à la navigation sont retirées de la réserve
        AVANT l'appariement : chaque fenêtre reçoit la prochaine touche F
        réellement libre.
        """
        if not self.windows:
            self._set_status("Aucune fenêtre à assigner.")
            return
        nav_used = {
            keys.normalize_hotkey(v)
            for v in self.cfg["nav"].values()
            if v and keys.is_valid_hotkey(v)
        }
        free_keys = [k for k in ("F%d" % i for i in range(1, 13)) if k not in nav_used]
        assigned = 0
        assigned_chars = set()
        used_keys = set()
        for window, key in zip(self.windows, free_keys):
            self.cfg["bindings"][window.character] = key
            assigned_chars.add(window.character)
            used_keys.add(key)
            assigned += 1
        # Retirer les anciens raccourcis d'autres personnages qui entreraient
        # en collision avec une touche fraîchement assignée.
        for character, hotkey in list(self.cfg["bindings"].items()):
            if character in assigned_chars:
                continue
            if keys.is_valid_hotkey(hotkey) and keys.normalize_hotkey(hotkey) in used_keys:
                del self.cfg["bindings"][character]
        self.cfg["order"] = [w.character for w in self.windows]
        self._save_cfg()
        self._rebuild_tree()
        self._set_status("%d raccourci(s) assigné(s) automatiquement." % assigned)
        self._rearm_if_needed()

    def assign_hotkey(self):
        character = self._selected_character()
        if character is None:
            self._set_status("Sélectionnez d'abord une fenêtre dans la liste.")
            return
        try:
            hotkey = keys.make_hotkey(
                self.var_key.get(),
                ctrl=self.var_ctrl.get(),
                alt=self.var_alt.get(),
                shift=self.var_shift.get(),
            )
        except ValueError as exc:
            self._set_status(str(exc))
            return
        owner = self._hotkey_owner(hotkey)
        if owner is not None and owner != character:
            self._set_status(
                "Le raccourci %s est déjà utilisé par « %s »." % (hotkey, owner)
            )
            return
        self.cfg["bindings"][character] = hotkey
        self._save_cfg()
        self._rebuild_tree()
        self._set_status("Raccourci %s assigné à « %s »." % (hotkey, character))
        self._rearm_if_needed()

    def remove_hotkey(self):
        character = self._selected_character()
        if character is None:
            self._set_status("Sélectionnez d'abord une fenêtre dans la liste.")
            return
        if self.cfg["bindings"].pop(character, None) is not None:
            self._save_cfg()
            self._rebuild_tree()
            self._set_status("Raccourci retiré pour « %s »." % character)
            self._rearm_if_needed()

    def _hotkey_owner(self, hotkey):
        """Renvoie le personnage ou la fonction de navigation utilisant déjà ce raccourci."""
        normalized = keys.normalize_hotkey(hotkey)
        for character, existing in self.cfg["bindings"].items():
            if keys.is_valid_hotkey(existing) and keys.normalize_hotkey(existing) == normalized:
                return character
        nav_labels = {"next": "navigation (suivante)", "prev": "navigation (précédente)",
                      "last": "navigation (dernière)"}
        for name, label in nav_labels.items():
            value = self.cfg["nav"].get(name)
            if value and keys.is_valid_hotkey(value) and keys.normalize_hotkey(value) == normalized:
                return label
        return None

    def on_nav_change(self, name):
        value = self.nav_vars[name].get()
        value = "" if value == NAV_NONE else value
        if value:
            owner = self._hotkey_owner(value)
            expected = "navigation (%s)" % {
                "next": "suivante", "prev": "précédente", "last": "dernière"
            }[name]
            if owner is not None and owner != expected:
                self._set_status("Le raccourci %s est déjà utilisé par « %s »." % (value, owner))
                self.nav_vars[name].set(self.cfg["nav"].get(name) or NAV_NONE)
                return
        self.cfg["nav"][name] = value
        self._save_cfg()
        self._rearm_if_needed()

    # ------------------------------------------------------------- options

    def _apply_options(self):
        self.root.attributes("-topmost", bool(self.cfg["options"]["topmost"]))

    def on_toggle_topmost(self):
        self.cfg["options"]["topmost"] = bool(self.var_topmost.get())
        self._apply_options()
        self._save_cfg()

    def on_toggle_autorefresh(self):
        self.cfg["options"]["auto_refresh"] = bool(self.var_autorefresh.get())
        self._save_cfg()

    # ----------------------------------------------------- raccourcis armés

    def toggle_armed(self):
        if self.armed:
            self.disarm()
        else:
            self.arm()

    def _build_entries(self):
        """Construit les entrées (label, mods, vk, callback) à enregistrer."""
        entries = []
        seen = set()
        skipped = []
        for character, hotkey in self.cfg["bindings"].items():
            try:
                mods, vk = keys.parse_hotkey(hotkey)
            except ValueError:
                skipped.append(hotkey)
                continue
            if (mods, vk) in seen:
                skipped.append(hotkey)
                continue
            seen.add((mods, vk))
            entries.append(
                (hotkey, mods, vk, functools.partial(self.on_hotkey_character, character))
            )
        nav_callbacks = {
            "next": functools.partial(self.on_hotkey_cycle, 1),
            "prev": functools.partial(self.on_hotkey_cycle, -1),
            "last": self.on_hotkey_last,
        }
        for name, callback in nav_callbacks.items():
            hotkey = self.cfg["nav"].get(name)
            if not hotkey:
                continue
            try:
                mods, vk = keys.parse_hotkey(hotkey)
            except ValueError:
                skipped.append(hotkey)
                continue
            if (mods, vk) in seen:
                skipped.append(hotkey)
                continue
            seen.add((mods, vk))
            entries.append((hotkey, mods, vk, callback))
        return entries, skipped

    def arm(self):
        if not winapi.IS_WINDOWS:
            self._set_status("Les raccourcis globaux nécessitent Windows.")
            return
        if not self.disarm():
            # Ne surtout pas réenregistrer pendant que l'ancien thread
            # détient encore les raccourcis : cela échouerait en silence.
            self._set_status(
                "L'ancien thread de raccourcis ne s'est pas encore arrêté — réessayez dans un instant."
            )
            return
        entries, skipped = self._build_entries()
        if not entries:
            self._set_status(
                "Aucun raccourci à activer : assignez d'abord des touches (ou « Auto-assigner »)."
            )
            return
        thread = HotkeyThread(entries)
        failures = thread.start_and_wait()
        self.hotkey_thread = thread
        self.armed = True
        self.btn_arm.config(text="■  Désactiver les raccourcis", bg="#b22222",
                            activebackground="#cd5c5c")
        message = "Raccourcis actifs (%d)." % (len(entries) - len(failures))
        if failures:
            message += " Refusés par Windows (déjà pris ?) : %s." % ", ".join(failures)
        if skipped:
            message += " Ignorés (doublons/invalides) : %s." % ", ".join(skipped)
        self._set_status(message)

    def disarm(self):
        """Arrête les raccourcis. Renvoie True si le thread est bien terminé."""
        stopped = True
        if self.hotkey_thread is not None:
            stopped = self.hotkey_thread.stop()
            if stopped:
                self.hotkey_thread = None  # sinon, on le garde pour réessayer
        if self.armed:
            self.armed = False
            self.btn_arm.config(text="▶  Activer les raccourcis", bg="#2e8b57",
                                activebackground="#3cb371")
            self._set_status("Raccourcis désactivés.")
        return stopped

    def _rearm_if_needed(self):
        if self.armed:
            self.arm()

    # ------------------------------------------------ callbacks raccourcis
    # Ces méthodes s'exécutent dans le thread des raccourcis : elles ne
    # touchent à l'interface que via _set_status/after.

    def on_hotkey_character(self, character):
        hwnd = self.char_to_hwnd.get(character)
        if not hwnd:
            self._set_status("« %s » : fenêtre introuvable (relancez Actualiser)." % character)
            return
        self._activate(hwnd, character)

    def on_hotkey_cycle(self, step):
        windows = self.windows  # instantané (référence remplacée atomiquement)
        hwnds = [w.hwnd for w in windows]
        try:
            current = winapi.get_foreground_window()
        except RuntimeError:
            return
        target = gamewindows.cycle_target(hwnds, current, step)
        if target is None:
            self._set_status("Aucune fenêtre Dofus détectée.")
            return
        character = next((w.character for w in windows if w.hwnd == target), "")
        self._activate(target, character)

    def on_hotkey_last(self):
        target = self._previous_hwnd
        if not target:
            self._set_status("Pas encore de « dernière fenêtre » mémorisée.")
            return
        character = next((w.character for w in self.windows if w.hwnd == target), "")
        self._activate(target, character)

    def _activate(self, hwnd, character):
        """Met la fenêtre au premier plan et mémorise la précédente."""
        try:
            current = winapi.get_foreground_window()
            if current and current != hwnd and current in {w.hwnd for w in self.windows}:
                self._previous_hwnd = current
            if winapi.activate_window(hwnd):
                if character:
                    self._set_status("Fenêtre active : %s" % character)
                self._request_highlight()
            else:
                self._set_status(
                    "Impossible d'activer « %s » (fenêtre fermée ?)." % (character or hwnd)
                )
        except RuntimeError as exc:
            self._set_status(str(exc))

    # -------------------------------------------------------------- divers

    def on_tree_double_click(self, event):
        # Ignorer les double-clics hors des lignes (en-têtes, zone vide) :
        # sinon un redimensionnement de colonne activerait la fenêtre
        # encore sélectionnée d'un clic précédent.
        if self.tree.identify_region(event.x, event.y) != "cell":
            return
        row = self.tree.identify_row(event.y)
        if not row:
            return
        values = self.tree.item(row, "values")
        character = values[2] if len(values) >= 3 else None
        if not character:
            return
        hwnd = self.char_to_hwnd.get(character)
        if hwnd:
            self._activate(hwnd, character)

    def on_close(self):
        self.cfg["options"]["armed"] = self.armed
        self.cfg["options"]["topmost"] = bool(self.var_topmost.get())
        self.cfg["options"]["auto_refresh"] = bool(self.var_autorefresh.get())
        self._save_cfg()
        self.disarm()
        self.root.destroy()


def run():
    root = tk.Tk()
    App(root)
    root.mainloop()
