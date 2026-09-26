# -*- coding: utf-8 -*-
"""Liaisons ctypes vers l'API Win32 (aucune dépendance externe).

Seules des fonctions de GESTION DE FENÊTRES sont utilisées : énumération,
lecture de titre, mise au premier plan. Aucune fonction d'injection
d'entrées (SendInput, keybd_event, PostMessage vers le jeu…) n'est liée
ici, volontairement : l'outil ne doit jamais envoyer de touches au jeu.
"""

import ctypes
import sys
from ctypes import wintypes

IS_WINDOWS = sys.platform == "win32"

# Constantes Win32
SW_RESTORE = 9
WM_HOTKEY = 0x0312
WM_QUIT = 0x0012
PM_NOREMOVE = 0x0000
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

_WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM) if IS_WINDOWS else None

if IS_WINDOWS:
    _user32 = ctypes.WinDLL("user32", use_last_error=True)
    _kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    # Les argtypes sont indispensables en 64 bits : sans eux, ctypes passe
    # les HWND comme des int 32 bits et peut les tronquer.
    _user32.EnumWindows.argtypes = [_WNDENUMPROC, wintypes.LPARAM]
    _user32.EnumWindows.restype = wintypes.BOOL

    _user32.IsWindowVisible.argtypes = [wintypes.HWND]
    _user32.IsWindowVisible.restype = wintypes.BOOL

    _user32.IsWindow.argtypes = [wintypes.HWND]
    _user32.IsWindow.restype = wintypes.BOOL

    _user32.IsIconic.argtypes = [wintypes.HWND]
    _user32.IsIconic.restype = wintypes.BOOL

    _user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    _user32.GetWindowTextLengthW.restype = ctypes.c_int

    _user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    _user32.GetWindowTextW.restype = ctypes.c_int

    _user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    _user32.GetWindowThreadProcessId.restype = wintypes.DWORD

    _user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    _user32.ShowWindow.restype = wintypes.BOOL

    _user32.SetForegroundWindow.argtypes = [wintypes.HWND]
    _user32.SetForegroundWindow.restype = wintypes.BOOL

    _user32.GetForegroundWindow.argtypes = []
    _user32.GetForegroundWindow.restype = wintypes.HWND

    _user32.BringWindowToTop.argtypes = [wintypes.HWND]
    _user32.BringWindowToTop.restype = wintypes.BOOL

    _user32.AttachThreadInput.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.BOOL]
    _user32.AttachThreadInput.restype = wintypes.BOOL

    _user32.SwitchToThisWindow.argtypes = [wintypes.HWND, wintypes.BOOL]
    _user32.SwitchToThisWindow.restype = None

    _user32.RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]
    _user32.RegisterHotKey.restype = wintypes.BOOL

    _user32.UnregisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int]
    _user32.UnregisterHotKey.restype = wintypes.BOOL

    _user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
    _user32.GetMessageW.restype = ctypes.c_int  # -1 en cas d'erreur

    _user32.PeekMessageW.argtypes = [
        ctypes.POINTER(wintypes.MSG),
        wintypes.HWND,
        wintypes.UINT,
        wintypes.UINT,
        wintypes.UINT,
    ]
    _user32.PeekMessageW.restype = wintypes.BOOL

    _user32.PostThreadMessageW.argtypes = [
        wintypes.DWORD,
        wintypes.UINT,
        wintypes.WPARAM,
        wintypes.LPARAM,
    ]
    _user32.PostThreadMessageW.restype = wintypes.BOOL

    _kernel32.GetCurrentThreadId.argtypes = []
    _kernel32.GetCurrentThreadId.restype = wintypes.DWORD

    _kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    _kernel32.OpenProcess.restype = wintypes.HANDLE

    _kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    _kernel32.CloseHandle.restype = wintypes.BOOL

    _kernel32.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    _kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL


def _require_windows():
    if not IS_WINDOWS:
        raise RuntimeError("API Win32 indisponible : cet outil fonctionne sous Windows.")


def list_windows():
    """Énumère les fenêtres visibles de premier niveau.

    Renvoie une liste de tuples (hwnd, titre, pid).
    """
    _require_windows()
    result = []

    def _callback(hwnd, _lparam):
        if _user32.IsWindowVisible(hwnd):
            length = _user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buffer = ctypes.create_unicode_buffer(length + 1)
                _user32.GetWindowTextW(hwnd, buffer, length + 1)
                pid = wintypes.DWORD(0)
                _user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                result.append((int(hwnd) if hwnd else 0, buffer.value, pid.value))
        return True

    _user32.EnumWindows(_WNDENUMPROC(_callback), 0)
    return result


def get_process_image(pid):
    """Chemin de l'exécutable du processus, ou "" si inaccessible."""
    _require_windows()
    handle = _kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return ""
    try:
        size = wintypes.DWORD(1024)
        buffer = ctypes.create_unicode_buffer(size.value)
        if _kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
            return buffer.value
        return ""
    finally:
        _kernel32.CloseHandle(handle)


def is_window(hwnd):
    _require_windows()
    return bool(_user32.IsWindow(hwnd))


def get_foreground_window():
    _require_windows()
    return int(_user32.GetForegroundWindow() or 0)


def activate_window(hwnd):
    """Met la fenêtre au premier plan (simple changement de focus).

    Renvoie True si la fenêtre a bien pris le focus. Plusieurs stratégies
    sont essayées car Windows restreint parfois SetForegroundWindow
    (verrou de premier plan).
    """
    _require_windows()
    if not hwnd or not _user32.IsWindow(hwnd):
        return False

    if _user32.IsIconic(hwnd):
        _user32.ShowWindow(hwnd, SW_RESTORE)

    # 1) Cas nominal : notre processus vient de recevoir le raccourci
    #    clavier, il a donc le droit de changer le premier plan.
    if _user32.SetForegroundWindow(hwnd):
        return True

    # 2) Repli : attacher notre file d'entrée à celle de la fenêtre au
    #    premier plan le temps de l'appel.
    foreground = _user32.GetForegroundWindow()
    if foreground:
        current_thread = _kernel32.GetCurrentThreadId()
        fg_thread = _user32.GetWindowThreadProcessId(foreground, None)
        if fg_thread and fg_thread != current_thread:
            attached = _user32.AttachThreadInput(current_thread, fg_thread, True)
            try:
                _user32.BringWindowToTop(hwnd)
                if _user32.SetForegroundWindow(hwnd):
                    return True
            finally:
                if attached:
                    _user32.AttachThreadInput(current_thread, fg_thread, False)

    # 3) Dernier recours (équivalent Alt+Tab côté système).
    _user32.SwitchToThisWindow(hwnd, True)
    return get_foreground_window() == int(hwnd)


def register_hotkey(hotkey_id, modifiers, vk):
    _require_windows()
    return bool(_user32.RegisterHotKey(None, hotkey_id, modifiers, vk))


def unregister_hotkey(hotkey_id):
    _require_windows()
    return bool(_user32.UnregisterHotKey(None, hotkey_id))


def get_message(msg):
    """GetMessageW pour le thread courant. Renvoie 0 sur WM_QUIT, -1 sur erreur."""
    _require_windows()
    return _user32.GetMessageW(ctypes.byref(msg), None, 0, 0)


def create_message_queue():
    """Force la création de la file de messages du thread courant."""
    _require_windows()
    msg = wintypes.MSG()
    _user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, PM_NOREMOVE)


def post_thread_quit(thread_id):
    _require_windows()
    return bool(_user32.PostThreadMessageW(thread_id, WM_QUIT, 0, 0))


def get_current_thread_id():
    _require_windows()
    return int(_kernel32.GetCurrentThreadId())
