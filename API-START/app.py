"""
AFIP API Manager - Interfaz Gráfica
"""

import tkinter as tk
from tkinter import messagebox
import subprocess
import threading
import time
import requests
import os
import sys
import socket

# Solo una instancia
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 65432))
    s.close()
except:
    messagebox.showwarning("AFIP Manager", "Ya hay una instancia corriendo!")
    sys.exit()

# Configuración
WORKER_URL = "https://afip-api.m-a-o-alcatraz.workers.dev"

# Colores (Dark theme)
COLOR_BG = "#1e1e2e"
COLOR_FG = "#cdd6f4"
COLOR_ACCENT = "#89b4fa"
COLOR_SUCCESS = "#a6e3a1"
COLOR_ERROR = "#f38ba8"
COLOR_WARNING = "#f9e2af"


# Helper functions
def find_cloudflared(base_dir):
    paths = [
        os.path.join(base_dir, "cloudflared.exe"),
        os.path.join(os.path.dirname(base_dir), "API-START", "cloudflared.exe"),
        "C:\\Users\\Alcatraz\\Documents\\GitHub\\API_AFIP\\API-START\\cloudflared.exe",
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None


def find_server_dir(base_dir):
    paths = [
        os.path.join(base_dir, "server"),
        "C:\\Users\\Alcatraz\\Documents\\GitHub\\API_AFIP\\server",
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None


def get_actual_port(base_dir):
    try:
        for d in [base_dir, os.path.dirname(base_dir), "server"]:
            if os.path.exists(d):
                port_file = os.path.join(d, ".afip-port")
                if os.path.exists(port_file):
                    with open(port_file, "r") as f:
                        return int(f.read().strip())
    except:
        pass
    return 3000


def find_available_port(start_port=3000, max_attempts=5):
    import socket

    for port in range(start_port, start_port + max_attempts):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect(("localhost", port))
            s.close()
        except:
            return port
    return start_port


class AfipManager(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("AFIP API Manager")
        self.geometry("550x520")
        self.configure(bg=COLOR_BG)

        self.server_online = False
        self.tunnel_online = False
        self.worker_online = False

        self.setup_ui()
        self.after(1000, self.start_services)

    def setup_ui(self):
        title = tk.Label(
            self,
            text="AFIP API Manager",
            font=("Arial", 16, "bold"),
            bg=COLOR_BG,
            fg=COLOR_ACCENT,
        )
        title.pack(pady=12)

        # Status
        status_frame = tk.Frame(self, bg=COLOR_BG)
        status_frame.pack(pady=10, padx=20, fill="x")

        self.lbl_worker = tk.Label(
            status_frame,
            text="⏳ Worker: checking...",
            font=("Arial", 11),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_worker.pack(anchor="w", pady=4)

        self.lbl_tunnel = tk.Label(
            status_frame,
            text="⏳ Tunnel: checking...",
            font=("Arial", 11),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_tunnel.pack(anchor="w", pady=4)

        self.lbl_server = tk.Label(
            status_frame,
            text="⏳ Server: checking...",
            font=("Arial", 11),
            bg=COLOR_BG,
            fg=COLOR_FG,
        )
        self.lbl_server.pack(anchor="w", pady=4)

        # Botones principales
        btn_frame = tk.Frame(self, bg=COLOR_BG)
        btn_frame.pack(pady=15)

        tk.Button(
            btn_frame,
            text="🔄 RE-INICIAR",
            command=self.restart_services,
            bg=COLOR_ACCENT,
            fg=COLOR_BG,
            font=("Arial", 10, "bold"),
            width=12,
            relief="flat",
        ).pack(side="left", padx=8)
        tk.Button(
            btn_frame,
            text="⏹ DETENER",
            command=self.stop_services,
            bg=COLOR_ERROR,
            fg=COLOR_BG,
            font=("Arial", 10, "bold"),
            width=12,
            relief="flat",
        ).pack(side="left", padx=8)
        tk.Button(
            btn_frame,
            text="🔄 REFRESH",
            command=self.check_all_status,
            bg=COLOR_WARNING,
            fg=COLOR_BG,
            font=("Arial", 10, "bold"),
            width=12,
            relief="flat",
        ).pack(side="left", padx=8)

        # Botones individuales
        ind_frame = tk.Frame(self, bg=COLOR_BG)
        ind_frame.pack(pady=8)
        tk.Button(
            ind_frame,
            text="🔁 Server",
            command=self.restart_server_only,
            bg="#3b5bdb",
            fg=COLOR_BG,
            font=("Arial", 9),
            width=10,
            relief="flat",
        ).pack(side="left", padx=4)
        tk.Button(
            ind_frame,
            text="🔁 Tunnel",
            command=self.restart_tunnel_only,
            bg="#3b5bdb",
            fg=COLOR_BG,
            font=("Arial", 9),
            width=10,
            relief="flat",
        ).pack(side="left", padx=4)

        # Autostart
        self.chk_autostart = tk.Checkbutton(
            self,
            text="Iniciar con Windows",
            bg=COLOR_BG,
            fg=COLOR_FG,
            selectcolor=COLOR_BG,
            command=self.toggle_autostart,
        )
        self.chk_autostart.pack(pady=5)
        self.update_autostart_check()

        # Log
        tk.Label(
            self, text="LOG:", font=("Arial", 9, "bold"), bg=COLOR_BG, fg=COLOR_FG
        ).pack(anchor="w", padx=20)
        self.log_area = tk.Text(
            self, width=65, height=9, bg="#2a2a3e", fg=COLOR_FG, font=("Consolas", 8)
        )
        self.log_area.pack(padx=20, pady=8)
        self.log_area.config(state="disabled")

        tk.Label(
            self,
            text=f"API: {WORKER_URL}/invoices",
            font=("Arial", 8),
            bg=COLOR_BG,
            fg="#666",
        ).pack(pady=5)

    def log(self, message, color=None):
        if color is None:
            color = COLOR_FG
        ts = time.strftime("%H:%M:%S")
        msg = f"[{ts}] {message}"
        try:
            log_file = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "afip-manager.log"
            )
            if getattr(sys, "frozen", False):
                log_file = os.path.join(
                    os.path.dirname(sys.executable), "afip-manager.log"
                )
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
        except:
            pass
        self.log_area.config(state="normal")
        self.log_area.insert("end", msg + "\n")
        self.log_area.see("end")
        self.log_area.config(state="disabled")

    def start_services(self):
        self.log("Iniciando servicios...")

        if getattr(sys, "frozen", False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))

        server_dir = find_server_dir(base_dir)
        cloudflared_path = find_cloudflared(base_dir)

        if not server_dir:
            self.log(f"ERROR: Server no encontrado", COLOR_ERROR)
            return
        if not cloudflared_path:
            self.log(f"ERROR: cloudflared no encontrado", COLOR_ERROR)
            return

        self.log(f"Server dir: {server_dir}")
        self.log(f"Cloudflared: {cloudflared_path}")

        # Server
        target_port = find_available_port(3000, 4)
        self.log(f"Puerto: {target_port}")

        server_cmd = (
            f'cmd /c "set PORT={target_port} && cd /d {server_dir} && npm run dev"'
        )

        proc = subprocess.Popen(server_cmd, shell=True, cwd=server_dir)
        self.log(f"Server PID: {proc.pid}")

        # Esperar server
        self.log("Esperando server...")
        for i in range(30):
            try:
                r = requests.get(f"http://localhost:{target_port}/health", timeout=2)
                if r.status_code == 200:
                    self.log(f"Server ONLINE! (intento {i + 1})")
                    break
            except:
                pass
            time.sleep(0.5)
        else:
            self.log("ERROR: Server no respondió", COLOR_ERROR)
            return

        # Tunnel
        self.log("Iniciando Tunnel...")

        tunnel_cmd = (
            f'cmd /c "{cloudflared_path}" tunnel --url http://localhost:{target_port}'
        )
        tunnel_dir = os.path.dirname(cloudflared_path)

        proc_tunnel = subprocess.Popen(
            tunnel_cmd,
            shell=True,
            cwd=tunnel_dir,
        )
        self.log(f"Tunnel PID: {proc_tunnel.pid}")

        # Esperar tunnel
        self.log("Esperando tunnel...")
        for i in range(30):
            try:
                r = requests.get(f"http://localhost:{target_port}/health", timeout=2)
                if r.status_code == 200:
                    self.log(f"Tunnel ONLINE! (intento {i + 1})")
                    break
            except:
                pass
            time.sleep(1)

        self.log("Servicios iniciados!")
        self.after(5000, self.check_all_status)

    def restart_services(self):
        self.stop_services()
        self.after(1500, self.start_services)

    def restart_server_only(self):
        self.log("Reiniciando Server...")
        try:
            subprocess.run(
                [
                    "powershell.exe",
                    "-Command",
                    "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force",
                ],
                capture_output=True,
                timeout=5,
            )
        except:
            pass
        self.after(1000, self._start_server_only)

    def _start_server_only(self):
        if getattr(sys, "frozen", False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))

        server_dir = find_server_dir(base_dir)
        if not server_dir:
            self.log("ERROR: Server no encontrado", COLOR_ERROR)
            return

        target_port = find_available_port(3000, 4)
        server_cmd = (
            f'cmd /c "set PORT={target_port} && cd /d {server_dir} && npm run dev"'
        )

        subprocess.Popen(server_cmd, shell=True, cwd=server_dir)
        self.log(f"Server reiniciado en puerto {target_port}")
        self.after(5000, self.check_all_status)

    def restart_tunnel_only(self):
        self.log("Reiniciando Tunnel...")
        try:
            subprocess.run(
                [
                    "powershell.exe",
                    "-Command",
                    "Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force",
                ],
                capture_output=True,
                timeout=5,
            )
        except:
            pass
        self.after(1000, self._start_tunnel_only)

    def _start_tunnel_only(self):
        if getattr(sys, "frozen", False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))

        cloudflared_path = find_cloudflared(base_dir)
        if not cloudflared_path:
            self.log("ERROR: cloudflared.exe no encontrado", COLOR_ERROR)
            return

        actual_port = get_actual_port(base_dir)
        tunnel_cmd = (
            f'cmd /c "{cloudflared_path}" tunnel --url http://localhost:{actual_port}'
        )
        tunnel_dir = os.path.dirname(cloudflared_path)

        subprocess.Popen(
            tunnel_cmd,
            shell=True,
            cwd=tunnel_dir,
        )
        self.log("Tunnel reiniciado!")
        self.after(10000, self.check_all_status)

    def stop_services(self):
        self.log("Deteniendo servicios...")
        try:
            subprocess.run(
                [
                    "powershell.exe",
                    "-Command",
                    "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force",
                ],
                capture_output=True,
                timeout=5,
            )
        except:
            pass
        try:
            subprocess.run(
                [
                    "powershell.exe",
                    "-Command",
                    "Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force",
                ],
                capture_output=True,
                timeout=5,
            )
        except:
            pass
        self.log("Servicios detenidos!")
        self.lbl_worker.config(text="⏳ Worker: ...", fg=COLOR_FG)
        self.lbl_tunnel.config(text="⏳ Tunnel: ...", fg=COLOR_FG)
        self.lbl_server.config(text="⏳ Server: ...", fg=COLOR_FG)
        self.worker_online = False
        self.tunnel_online = False
        self.server_online = False

    def update_autostart_check(self):
        import winreg

        key = r"Software\Microsoft\Windows\CurrentVersion\Run"
        try:
            reg = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key)
            try:
                winreg.QueryValueEx(reg, "AFIP-Manager")
                self.chk_autostart.select()
            except:
                self.chk_autostart.deselect()
            winreg.CloseKey(reg)
        except:
            pass

    def toggle_autostart(self):
        import winreg

        script_path = os.path.abspath(__file__)
        key = r"Software\Microsoft\Windows\CurrentVersion\Run"
        try:
            reg = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key, 0, winreg.KEY_WRITE)
            if self.chk_autostart.instate(["selected"]):
                winreg.SetValueEx(reg, "AFIP-Manager", 0, winreg.REG_SZ, script_path)
                self.log("Agregado a inicio Windows")
            else:
                try:
                    winreg.DeleteValue(reg, "AFIP-Manager")
                    self.log("Quitado de inicio Windows")
                except:
                    pass
            winreg.CloseKey(reg)
        except Exception as e:
            self.log(f"Error autostart: {e}", COLOR_ERROR)

    def check_worker(self):
        try:
            r = requests.get(f"{WORKER_URL}/health", timeout=5)
            if r.status_code == 200:
                self.worker_online = True
                self.lbl_worker.config(text="✅ Worker: ONLINE", fg=COLOR_SUCCESS)
                return True
        except:
            pass
        self.worker_online = False
        self.lbl_worker.config(text="❌ Worker: OFFLINE", fg=COLOR_ERROR)
        return False

    def check_tunnel(self):
        # Primero verificar que el server responde (porque tunnel -> server)
        base_dir = (
            os.path.dirname(sys.executable)
            if getattr(sys, "frozen", False)
            else os.path.dirname(os.path.abspath(__file__))
        )
        actual_port = get_actual_port(base_dir)

        # Verificar que responde (el tunnel está funcionando)
        for attempt in range(3):
            try:
                r = requests.get(f"http://localhost:{actual_port}/health", timeout=3)
                if r.status_code == 200:
                    # El server responde = tunnel está forwardeando bien
                    self.tunnel_online = True
                    self.lbl_tunnel.config(text="✅ Tunnel: ONLINE", fg=COLOR_SUCCESS)
                    return True
            except:
                time.sleep(1)

        # Si no respondió, verificar si el proceso existe
        try:
            result = subprocess.run(
                [
                    "powershell.exe",
                    "-Command",
                    "Get-Process cloudflared -ErrorAction SilentlyContinue",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if "cloudflared" in result.stdout.lower():
                self.tunnel_online = False
                self.lbl_tunnel.config(
                    text="⚠️ Tunnel: PROCESO PERO SIN RESPONDER", fg=COLOR_WARNING
                )
                return False
        except:
            pass

        self.tunnel_online = False
        self.lbl_tunnel.config(text="❌ Tunnel: OFFLINE", fg=COLOR_ERROR)
        return False

    def check_server(self):
        for i in range(3):
            try:
                base_dir = (
                    os.path.dirname(sys.executable)
                    if getattr(sys, "frozen", False)
                    else os.path.dirname(os.path.abspath(__file__))
                )
                actual_port = get_actual_port(base_dir)
                r = requests.get(f"http://localhost:{actual_port}/health", timeout=5)
                if r.status_code == 200:
                    data = r.json()
                    if data.get("service") == "afip-server":
                        self.server_online = True
                        self.lbl_server.config(
                            text=f"✅ Server: ONLINE", fg=COLOR_SUCCESS
                        )
                        return True
            except:
                time.sleep(1)
        self.server_online = False
        self.lbl_server.config(text="❌ Server: OFFLINE", fg=COLOR_ERROR)
        return False

    def check_all_status(self):
        self.log("Verificando...")
        threading.Thread(target=self._run_checks, daemon=True).start()

    def _run_checks(self):
        w = self.check_worker()
        self.after(0, lambda: self.log(f"Worker: {'OK' if w else 'FAIL'}"))
        t = self.check_tunnel()
        self.after(0, lambda: self.log(f"Tunnel: {'OK' if t else 'FAIL'}"))
        s = self.check_server()
        self.after(0, lambda: self.log(f"Server: {'OK' if s else 'FAIL'}"))
        if w and t and s:
            self.after(0, lambda: self.log("TODO OK!", COLOR_SUCCESS))
        else:
            self.after(0, lambda: self.log("Revisar servicios offline", COLOR_WARNING))


try:
    app = AfipManager()
    app.mainloop()
except Exception as e:
    print(f"Error: {e}")
    input("Press Enter to exit...")
