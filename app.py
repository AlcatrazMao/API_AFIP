"""
AFIP API Manager - Interfaz Gráfica
Simple GUI para administración del sistema
"""

import tkinter as tk
from tkinter import messagebox, scrolledtext
import subprocess
import threading
import time
import requests
import os
import sys

# ============================================
# CONFIGURACIÓN
# ============================================
WORKER_URL = "https://afip-api.m-a-o-alcatraz.workers.dev"

# Colores (Dark theme)
COLOR_BG = "#1e1e2e"
COLOR_FG = "#cdd6f4"
COLOR_ACCENT = "#89b4fa"
COLOR_SUCCESS = "#a6e3a1"
COLOR_ERROR = "#f38ba8"
COLOR_WARNING = "#f9e2af"


# ============================================
# CLASE PRINCIPAL
# ============================================
class AfipManager(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("AFIP API Manager")
        self.geometry("550x450")
        self.configure(bg=COLOR_BG)
        self.resizable(False, False)

        # Estado de los servicios
        self.server_online = False
        self.tunnel_online = False
        self.worker_online = False

        self.setup_ui()

        # Auto-check al abrir
        self.after(500, self.check_all_status)

    def setup_ui(self):
        # Título
        title = tk.Label(
            self,
            text="AFIP API Manager",
            font=("Arial", 16, "bold"),
            bg=COLOR_BG,
            fg=COLOR_ACCENT,
        )
        title.pack(pady=12)

        # Frame de status
        status_frame = tk.Frame(self, bg=COLOR_BG)
        status_frame.pack(pady=10, padx=20, fill="x")

        # Worker status
        self.lbl_worker = tk.Label(
            status_frame,
            text="⏳ Worker: checking...",
            font=("Arial", 11),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_worker.pack(anchor="w", pady=4)

        # Tunnel status
        self.lbl_tunnel = tk.Label(
            status_frame,
            text="⏳ Tunnel: checking...",
            font=("Arial", 11),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_tunnel.pack(anchor="w", pady=4)

        # Server status
        self.lbl_server = tk.Label(
            status_frame,
            text="⏳ Server: checking...",
            font=("Arial", 11),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_server.pack(anchor="w", pady=4)

        # Botones
        btn_frame = tk.Frame(self, bg=COLOR_BG)
        btn_frame.pack(pady=15)

        btn_start = tk.Button(
            btn_frame,
            text="▶ INICIAR",
            command=self.start_services,
            bg=COLOR_SUCCESS,
            fg=COLOR_BG,
            font=("Arial", 10, "bold"),
            width=12,
            relief="flat",
            cursor="hand2",
        )
        btn_start.pack(side="left", padx=8)

        btn_stop = tk.Button(
            btn_frame,
            text="⏹ DETENER",
            command=self.stop_services,
            bg=COLOR_ERROR,
            fg=COLOR_BG,
            font=("Arial", 10, "bold"),
            width=12,
            relief="flat",
            cursor="hand2",
        )
        btn_stop.pack(side="left", padx=8)

        btn_refresh = tk.Button(
            btn_frame,
            text="🔄 REFRESH",
            command=self.check_all_status,
            bg=COLOR_WARNING,
            fg=COLOR_BG,
            font=("Arial", 10, "bold"),
            width=12,
            relief="flat",
            cursor="hand2",
        )
        btn_refresh.pack(side="left", padx=8)

        # Log area
        log_label = tk.Label(
            self, text="LOG:", font=("Arial", 9, "bold"), bg=COLOR_BG, fg=COLOR_FG
        )
        log_label.pack(anchor="w", padx=20)

        self.log_area = scrolledtext.ScrolledText(
            self, width=65, height=8, bg="#2a2a3e", fg=COLOR_FG, font=("Consolas", 8)
        )
        self.log_area.pack(padx=20, pady=8)
        self.log_area.config(state="disabled")

        # Info
        info = tk.Label(
            self,
            text=f"API: {WORKER_URL}/invoices",
            font=("Arial", 8),
            bg=COLOR_BG,
            fg="#666",
        )
        info.pack(pady=5)

    def log(self, message, color=None):
        """Agregar mensaje al log"""
        if color is None:
            color = COLOR_FG
        self.log_area.config(state="normal")
        ts = time.strftime("%H:%M:%S")
        self.log_area.insert("end", f"[{ts}] {message}\n")
        self.log_area.see("end")
        self.log_area.config(state="disabled")

    def check_worker(self):
        """Verificar Worker"""
        try:
            r = requests.get(f"{WORKER_URL}/health", timeout=5)
            if r.status_code == 200:
                self.worker_online = True
                self.lbl_worker.config(text="✅ Worker: ONLINE", fg=COLOR_SUCCESS)
                return True
        except Exception as e:
            pass
        self.worker_online = False
        self.lbl_worker.config(text="❌ Worker: OFFLINE", fg=COLOR_ERROR)
        return False

    def check_tunnel(self):
        """Verificar Tunnel - buscar proceso"""
        try:
            result = subprocess.run(
                [
                    "powershell.exe",
                    "-Command",
                    "Get-Process | Where-Object {$_.ProcessName -match 'cloudflared'}",
                ],
                capture_output=True,
                timeout=5,
            )
            if result.stdout:
                self.tunnel_online = True
                self.lbl_tunnel.config(text="✅ Tunnel: ONLINE", fg=COLOR_SUCCESS)
            else:
                self.tunnel_online = False
                self.lbl_tunnel.config(text="❌ Tunnel: OFFLINE", fg=COLOR_ERROR)
        except:
            self.tunnel_online = False
            self.lbl_tunnel.config(text="❌ Tunnel: OFFLINE", fg=COLOR_ERROR)
        return self.tunnel_online

    def check_server(self):
        """Verificar Server local"""
        try:
            r = requests.get("http://localhost:3000/health", timeout=3)
            if r.status_code == 200:
                self.server_online = True
                self.lbl_server.config(text="✅ Server: ONLINE", fg=COLOR_SUCCESS)
                return True
        except:
            pass
        self.server_online = False
        self.lbl_server.config(text="❌ Server: OFFLINE", fg=COLOR_ERROR)
        return False

    def check_all_status(self):
        """Verificar todos los servicios"""
        self.log("Verificando servicios...")

        # Habilitamos thread para no bloquear UI
        threading.Thread(target=self._run_checks, daemon=True).start()

    def _run_checks(self):
        w = self.check_worker()
        self.after(0, lambda: self.log(f"Worker: {'OK' if w else 'FAIL'}"))

        t = self.check_tunnel()
        self.after(0, lambda: self.log(f"Tunnel: {'OK' if t else 'FAIL'}"))

        s = self.check_server()
        self.after(0, lambda: self.log(f"Server: {'OK' if s else 'FAIL'}"))

        if w and t and s:
            self.after(
                0, lambda: self.log("TODO OK - Sistema funcionando!", COLOR_SUCCESS)
            )
        else:
            self.after(
                0,
                lambda: self.log(
                    "Revisa los servicios que están OFFLINE", COLOR_WARNING
                ),
            )

    def start_services(self):
        """Iniciar servicios"""
        self.log("Iniciando servicios...")

        try:
            # Buscar el dir del exe/script
            base_dir = os.path.dirname(os.path.abspath(__file__))

            subprocess.Popen(
                [
                    "powershell.exe",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    os.path.join(base_dir, "start-services.ps1"),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
                cwd=base_dir,
            )
            self.log("Servicios iniciados!")
            self.after(2000, self.check_all_status)
        except Exception as e:
            self.log(f"Error: {str(e)}", COLOR_ERROR)

    def stop_services(self):
        """Detener servicios"""
        self.log("Deteniendo servicios...")

        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))

            subprocess.Popen(
                [
                    "powershell.exe",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    os.path.join(base_dir, "stop-services.ps1"),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
                cwd=base_dir,
            )
            self.log("Servicios detenidos!")

            # Resetear labels
            self.lbl_worker.config(text="⏳ Worker: checking...", fg=COLOR_FG)
            self.lbl_tunnel.config(text="⏳ Tunnel: checking...", fg=COLOR_FG)
            self.lbl_server.config(text="⏳ Server: checking...", fg=COLOR_FG)
            self.worker_online = False
            self.tunnel_online = False
            self.server_online = False

        except Exception as e:
            self.log(f"Error: {str(e)}", COLOR_ERROR)


# ============================================
# MAIN
# ============================================
if __name__ == "__main__":
    try:
        app = AfipManager()
        app.mainloop()
    except Exception as e:
        print(f"Error: {e}")
        input("Presiona Enter para salir...")
