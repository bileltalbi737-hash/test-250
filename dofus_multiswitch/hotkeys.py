# -*- coding: utf-8 -*-
"""Thread de raccourcis clavier globaux (RegisterHotKey + boucle GetMessage).

RegisterHotKey lie chaque raccourci au thread qui l'enregistre : un thread
dédié enregistre les touches, pompe les messages WM_HOTKEY et appelle le
callback associé. Les callbacks s'exécutent donc DANS CE THREAD : toute
mise à jour d'interface doit repasser par `root.after(...)`.

Un raccourci = un callback = une seule fenêtre ciblée. Aucune entrée n'est
envoyée au jeu.
"""

import threading

from ctypes import wintypes

from . import keys, winapi


class HotkeyThread(threading.Thread):
    """Enregistre une liste de raccourcis globaux et distribue les appuis.

    `entries` : liste de tuples (label, modificateurs, vk, callback).
    Après `start_and_wait()`, `failures` contient les labels des raccourcis
    que Windows a refusés (déjà pris par un autre logiciel).
    """

    def __init__(self, entries):
        super().__init__(daemon=True, name="HotkeyThread")
        self._entries = list(entries)
        self._thread_id = None
        self._ready = threading.Event()
        self._callbacks = {}
        self.failures = []

    def run(self):
        self._thread_id = winapi.get_current_thread_id()
        # Créer la file de messages AVANT de signaler « prêt », sinon un
        # PostThreadMessage(WM_QUIT) précoce serait perdu.
        winapi.create_message_queue()

        registered_ids = []
        for index, (label, modifiers, vk, callback) in enumerate(self._entries, start=1):
            if winapi.register_hotkey(index, modifiers | keys.MOD_NOREPEAT, vk):
                self._callbacks[index] = callback
                registered_ids.append(index)
            else:
                self.failures.append(label)
        self._ready.set()

        try:
            msg = wintypes.MSG()
            while True:
                result = winapi.get_message(msg)
                if result == 0 or result == -1:  # WM_QUIT ou erreur
                    break
                if msg.message == winapi.WM_HOTKEY:
                    callback = self._callbacks.get(int(msg.wParam))
                    if callback is not None:
                        try:
                            callback()
                        except Exception:
                            # Un callback défaillant ne doit pas tuer la boucle.
                            pass
        finally:
            for hotkey_id in registered_ids:
                winapi.unregister_hotkey(hotkey_id)

    def start_and_wait(self, timeout=5.0):
        """Démarre le thread et attend l'enregistrement des raccourcis.

        Renvoie la liste des raccourcis refusés par le système.
        """
        self.start()
        self._ready.wait(timeout)
        return list(self.failures)

    def stop(self, timeout=2.0):
        """Demande l'arrêt de la boucle et attend la fin du thread."""
        if not self.is_alive():
            return
        # S'assurer que run() a créé sa file de messages.
        self._ready.wait(timeout)
        if self._thread_id is not None:
            winapi.post_thread_quit(self._thread_id)
        self.join(timeout)
