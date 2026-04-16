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

# ============================================
# CONFIGURACIÓN
# ============================================
WORKER_URL = "https://afip-api.m-a-o-alcatraz.workers.dev"
TUNNEL_URL = "https://guide-saskatchewan-circus-moore.trycloudflare.com"

# Colores
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
        self.geometry("600x500")
        self.configure(bg=COLOR_BG)
        self.resizable(False, False)

        # Estado de los servicios
        self.server_online = False
        self.tunnel_online = False
        self.worker_online = False

        self.setup_ui()
        self.check_all_status()

    def setup_ui(self):
        # Título
        title = tk.Label(
            self,
            text="AFIP API Manager",
            font=("Arial", 18, "bold"),
            bg=COLOR_BG,
            fg=COLOR_ACCENT,
        )
        title.pack(pady=15)

        # Frame de status
        status_frame = tk.Frame(self, bg=COLOR_BG)
        status_frame.pack(pady=10, padx=20, fill="x")

        # Worker status
        self.lbl_worker = tk.Label(
            status_frame,
            text="🌐 Worker: ...",
            font=("Arial", 12),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_worker.pack(anchor="w", pady=5)

        # Tunnel status
        self.lbl_tunnel = tk.Label(
            status_frame,
            text="🔗 Tunnel: ...",
            font=("Arial", 12),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_tunnel.pack(anchor="w", pady=5)

        # Server status
        self.lbl_server = tk.Label(
            status_frame,
            text="💻 Server: ...",
            font=("Arial", 12),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_server.pack(anchor="w", pady=5)

        # Botones
        btn_frame = tk.Frame(self, bg=COLOR_BG)
        btn_frame.pack(pady=20)

        btn_start = tk.Button(
            btn_frame,
            text="▶️  INICIAR",
            command=self.start_services,
            bg=COLOR_SUCCESS,
            fg=COLOR_BG,
            font=("Arial", 12, "bold"),
            width=15,
            height=2,
            relief="flat",
        )
        btn_start.pack(side="left", padx=10)

        btn_stop = tk.Button(
            btn_frame,
            text="⏹️  DETENER",
            command=self.stop_services,
            bg=COLOR_ERROR,
            fg=COLOR_BG,
            font=("Arial", 12, "bold"),
            width=15,
            height=2,
            relief="flat",
        )
        btn_stop.pack(side="left", padx=10)

        btn_refresh = tk.Button(
            btn_frame,
            text="🔄  REFRESCAR",
            command=self.check_all_status,
            bg=COLOR_WARNING,
            fg=COLOR_BG,
            font=("Arial", 12, "bold"),
            width=15,
            height=2,
            relief="flat",
        )
        btn_refresh.pack(side="left", padx=10)

        # Log area
        log_label = tk.Label(
            self, text="📋 LOG:", font=("Arial", 10, "bold"), bg=COLOR_BG, fg=COLOR_FG
        )
        log_label.pack(anchor="w", padx=20)

        self.log_area = scrolledtext.ScrolledText(
            self, width=70, height=10, bg="#2a2a3e", fg=COLOR_FG, font=("Consolas", 9)
        )
        self.log_area.pack(padx=20, pady=10)
        self.log_area.config(state="disabled")

        # .Info API
        info = tk.Label(
            self,
            text=f"API: {WORKER_URL}/invoices",
            font=("Arial", 9),
            bg=COLOR_BG,
            fg="#666",
        )
        info.pack(pady=5)

    def log(self, message, color=COLOR_FG):
        """Agregar mensaje al log"""
        self.log_area.config(state="normal")
        self.log_area.insert("end", message + "\n")
        self.log_area.see("end")
        self.log_area.config(state="disabled")

    def check_worker(self):
        """Verificar Worker"""
        try:
            r = requests.get(f"{WORKER_URL}/health", timeout=5)
            if r.status_code == 200:
                self.worker_online = True
                self.lbl_worker.config(text="🌐 Worker: ✅ ONLINE", fg=COLOR_SUCCESS)
                return True
        except:
            pass
        self.worker_online = False
        self.lbl_worker.config(text="🌐 Worker: ❌ OFFLINE", fg=COLOR_ERROR)
        return False

    def check_tunnel(self):
        """Verificar Tunnel"""
        try:
            r = requests.get(f"{TUNNEL_URL}/health", timeout=5)
            if r.status_code == 200:
                self.tunnel_online = True
                self.lbl_tunnel.config(text="🔗 Tunnel: ✅ ONLINE", fg=COLOR_SUCCESS)
                return True
        except:
            pass
        self.tunnel_online = False
        self.lbl_tunnel.config(text="🔗 Tunnel: ❌ OFFLINE", fg=COLOR_ERROR)
        return False

    def check_server(self):
        """Verificar Server local"""
        try:
            r = requests.get("http://localhost:3000/health", timeout=3)
            if r.status_code == 200:
                self.server_online = True
                self.lbl_server.config(text="💻 Server: ✅ ONLINE", fg=COLOR_SUCCESS)
                return True
        except:
            pass
        self.server_online = False
        self.lbl_server.config(text="💻 Server: ❌ OFFLINE", fg=COLOR_ERROR)
        return False

    def check_all_status(self):
        """Verificar todos los servicios"""
        self.log("🔄 Verificando servicios...")

        threading.Thread(target=self._check_in_background, daemon=True).start()

    def _check_in_background(self):
        self.after(0, lambda: self.check_worker())
        self.after(0, lambda: self.check_tunnel())
        self.after(0, lambda: self.check_server())

        if self.worker_online and self.tunnel_online and self.server_online:
            self.after(
                0, lambda: self.log("✅ Todos los servicios ONLINE!", COLOR_SUCCESS)
            )
        else:
            self.after(
                0, lambda: self.log("⚠️  Algunos servicios offline", COLOR_WARNING)
            )

    def start_services(self):
        """Iniciar servicios"""
        self.log("🚀 Iniciando servicios...")

        # Ejecutar start-services.ps1
        try:
            subprocess.Popen(
                [
                    "powershell.exe",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    "start-services.ps1",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            self.log("✅ Servicios iniciados!")
            self.after(2000, self.check_all_status)
        except Exception as e:
            self.log(f"❌ Error: {e}", COLOR_ERROR)

    def stop_services(self):
        """Detener servicios"""
        self.log("🛑 Deteniendo servicios...")

        try:
            subprocess.Popen(
                [
                    "powershell.exe",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    "stop-services.ps1",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            self.log("✅ Servicios detenidos!")
            self.worker_online = False
            self.tunnel_online = False
            self.server_online = False
            self.lbl_worker.config(text="🌐 Worker: ...", fg=COLOR_FG)
            self.lbl_tunnel.config(text="🔗 Tunnel: ...", fg=COLOR_FG)
            self.lbl_server.config(text="💻 Server: ...", fg=COLOR_FG)
        except Exception as e:
            self.log(f"❌ Error: {e}", COLOR_ERROR)


# ============================================
# MAIN
# ============================================
if __name__ == "__main__":
    app = AfipManager()
    app.mainloop()
