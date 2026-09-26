# -*- coding: utf-8 -*-
"""Point d'entrée : `python -m dofus_multiswitch` ou DofusMultiSwitch.pyw."""

import sys


def main():
    if sys.platform != "win32":
        message = (
            "Dofus MultiSwitch gère des fenêtres Windows : "
            "lancez-le sous Windows (là où tournent vos clients Dofus)."
        )
        try:
            import tkinter as tk
            from tkinter import messagebox

            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("Dofus MultiSwitch", message)
            root.destroy()
        except Exception:
            print(message, file=sys.stderr)
        sys.exit(1)

    from .gui import run

    run()


if __name__ == "__main__":
    main()
