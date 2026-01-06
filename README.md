# 🎬 NeuralPlay

**AI-Powered Video Analysis & Player**

NeuralPlay is an intelligent video player that uses machine learning to provide real-time object detection, emotion recognition, transcription, and scene analysis.

![NeuralPlay Screenshot](electron/icons/icon.png)

---

##  Features

-  **Object Detection** - Real-time detection using YOLOv8
-  **Emotion Recognition** - Face detection with emotion analysis via DeepFace
-  **Transcription** - Automatic speech-to-text using OpenAI Whisper
-  **Scene Detection** - AI-powered scene boundary detection
-  **Smart Chapters** - Auto-generated chapter markers
-  **Voice Control** - Control playback with voice commands
-  **Audio Visualization** - Codec info and audio stats
-  **Keyboard Shortcuts** - Full keyboard control
-  **Library Management** - Organize and scan video folders

---

##  Quick Start (Development)

### Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Python** 3.10+ ([Download](https://python.org/))
- **FFmpeg** ([Download](https://ffmpeg.org/download.html)) - Add to PATH

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/B1acB1rd/NEURAL-PLAY.git
   cd NeuralPlay
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

   This starts both the React frontend and Python backend.

---

##  Building for Distribution

### Option 1: Full Build Script (Windows)

Run the included build script:
```bash
build.bat
```

This will:
1. Install dependencies
2. Bundle the Python backend with PyInstaller
3. Build the React frontend with Vite
4. Package everything with Electron

Output: `release/win-unpacked/NeuralPlay.exe`

### Option 2: Manual Build

1. **Build Python backend**
   ```bash
   pip install pyinstaller
   pyinstaller neuralplay-backend.spec
   ```

2. **Build React frontend**
   ```bash
   npm run build
   ```

3. **Package with Electron**
   ```bash
   npm run dist:win   # Windows
   npm run dist:mac   # macOS
   npm run dist:linux # Linux
   ```

---

##  Project Structure

```
NeuralPlay/
├── backend/              # Python backend
│   ├── main.py           # FastAPI server
│   ├── face_emotion.py   # DeepFace emotion detection
│   ├── object_detection.py # YOLOv8 detection
│   ├── scene_detection.py  # Scene boundary detection
│   ├── transcription.py    # Whisper transcription
│   └── requirements.txt    # Python dependencies
├── electron/             # Electron main process
│   └── main.js           # Electron entry point
├── src/                  # React frontend
│   ├── App.jsx           # Main React component
│   ├── App.css           # Styles
│   └── components/       # React components
├── package.json          # Node.js config
├── vite.config.js        # Vite bundler config
├── neuralplay-backend.spec # PyInstaller config
└── build.bat             # Windows build script
```

---

## ⌨ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` / `→` | Skip 5 seconds |
| `↑` / `↓` | Volume up/down |
| `F` | Toggle fullscreen |
| `M` | Mute/Unmute |
| `S` | Take screenshot |
| `[` | Set loop start |
| `]` | Set loop end |
| `\` | Clear loop |

---

##  AI Models Used

- **YOLOv8** - Object detection (Ultralytics)
- **DeepFace** - Face detection and emotion recognition
- **OpenAI Whisper** - Speech-to-text transcription
- **ResNet18** - Scene change detection

Models are automatically downloaded on first use.

---

##  Support the Project

Help fund AI model training and development:

| Currency | Address |
|----------|---------|
| **SOL** | `79gVfZ4q8UcFojF7S23afiVZ8APy2YbfsyLofqD92UzB` |
| **ETH** | `0x75DFFB62b779BFc5706864cE7d4Cd259b0372c0B` |
| **BTC** | `bc1qfljhc88vsdxdddm4ggaq4e89qthzv2n4a7sajv` |

---

##  License

MIT License - Feel free to use, modify, and distribute.

---

##  Credits

**Made by Oredipe Oluwagbohunmi Adekunle (B1ACB1RD)**

Built with:
- [Electron](https://electronjs.org/)
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Ultralytics YOLOv8](https://ultralytics.com/)
- [OpenAI Whisper](https://openai.com/research/whisper)
- [DeepFace](https://github.com/serengil/deepface)
