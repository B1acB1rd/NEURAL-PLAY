# -*- mode: python ; coding: utf-8 -*-
# NeuralPlay Backend - PyInstaller Spec File
# This bundles the Python backend with all AI/ML dependencies

import sys
from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

block_cipher = None

# Collect all data and submodules for heavy ML packages
whisper_datas, whisper_binaries, whisper_hiddenimports = collect_all('whisper')
ultralytics_datas, ultralytics_binaries, ultralytics_hiddenimports = collect_all('ultralytics')
deepface_datas, deepface_binaries, deepface_hiddenimports = collect_all('deepface')
torch_datas, torch_binaries, torch_hiddenimports = collect_all('torch')
torchvision_datas, torchvision_binaries, torchvision_hiddenimports = collect_all('torchvision')
cv2_datas, cv2_binaries, cv2_hiddenimports = collect_all('cv2')

# Collect all hidden imports
all_hiddenimports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'fastapi',
    'starlette',
    'pydantic',
    'sqlalchemy',
    'numpy',
    'PIL',
    'sklearn',
    'tensorflow',
    'keras',
] + whisper_hiddenimports + ultralytics_hiddenimports + deepface_hiddenimports + torch_hiddenimports + torchvision_hiddenimports + cv2_hiddenimports

# Collect all data files
all_datas = [
    ('backend/*.py', 'backend'),
] + whisper_datas + ultralytics_datas + deepface_datas + torch_datas + torchvision_datas + cv2_datas

# Collect all binaries
all_binaries = whisper_binaries + ultralytics_binaries + deepface_binaries + torch_binaries + torchvision_binaries + cv2_binaries

a = Analysis(
    ['backend/main.py'],
    pathex=[],
    binaries=all_binaries,
    datas=all_datas,
    hiddenimports=all_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='neuralplay-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Set to False for production to hide console
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='neuralplay-backend',
)
