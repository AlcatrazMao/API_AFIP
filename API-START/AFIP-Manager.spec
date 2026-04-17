# -*- mode: python ; coding: utf-8 -*-

import os

# SPECPATH es el path del archivo .spec
# El archivo spec está en API-START, entonces el cloudflared también está ahí
spec_dir = os.path.dirname(SPECPATH)  # C:\Users\Al...API_AFIP\API-START
# Pero si se ejecuta desde API-START, SPECPATH puede ser relativo o diferente
# Usamos el directorio actual del build como referencia
build_dir = os.getcwd()  # Donde estamos parados
# Si cloudflared no existe en build_dir, asumimos que estamos en API-START
if os.path.exists(os.path.join(build_dir, "cloudflared.exe")):
    script_dir = build_dir
else:
    # Estamos en el parent, ir a API-START
    script_dir = os.path.join(build_dir, "API-START")
    
cloudflared = os.path.join(script_dir, "cloudflared.exe")

a = Analysis(
    ['app.py'],
    pathex=[script_dir],
    binaries=[(cloudflared, ".")],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='AFIP-Manager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
