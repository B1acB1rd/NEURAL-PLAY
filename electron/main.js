const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;

// Detect if running in production (packaged) or development
// app.isPackaged is true when running from packaged .exe, false in dev
const isDev = !app.isPackaged;

// Enable hardware acceleration
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Start the Python backend
function startBackend() {
    if (isDev) {
        // Development: Run Python directly
        console.log('Starting backend in development mode...');
        backendProcess = spawn('python', ['backend/main.py'], {
            cwd: path.join(__dirname, '..'),
            shell: true
        });
    } else {
        // Production: Run bundled executable
        console.log('Starting backend in production mode...');
        const backendPath = process.platform === 'win32'
            ? path.join(process.resourcesPath, 'backend', 'neuralplay-backend.exe')
            : path.join(process.resourcesPath, 'backend', 'neuralplay-backend');

        console.log('Looking for backend at:', backendPath);

        if (fs.existsSync(backendPath)) {
            console.log('Backend found! Starting...');
            backendProcess = spawn(backendPath, [], {
                cwd: path.dirname(backendPath)
            });
        } else {
            console.error('Backend executable not found:', backendPath);
            // List contents of resourcesPath to debug
            try {
                const resourceFiles = fs.readdirSync(process.resourcesPath);
                console.log('Resources directory contents:', resourceFiles);
            } catch (e) {
                console.error('Could not read resources directory:', e);
            }
        }
    }

    if (backendProcess) {
        backendProcess.stdout.on('data', (data) => {
            console.log(`Backend: ${data}`);
        });
        backendProcess.stderr.on('data', (data) => {
            console.error(`Backend Error: ${data}`);
        });
        backendProcess.on('close', (code) => {
            console.log(`Backend exited with code ${code}`);
        });
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icons', 'icon.ico'),
        show: false, // Don't show until ready
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false, // Allow loading local files
        },
    });

    // Determine the correct URL based on environment
    let startUrl;
    if (isDev) {
        startUrl = 'http://localhost:5173';
    } else {
        // In production, load from the dist folder
        // Use path.join and convert backslashes for Windows
        const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
        startUrl = `file://${indexPath.replace(/\\/g, '/')}`;
    }

    console.log('isDev:', isDev);
    console.log('__dirname:', __dirname);
    console.log('Loading URL:', startUrl);
    mainWindow.loadURL(startUrl);

    // Show window when ready to prevent white flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle load errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
        console.error('Failed to load:', errorCode, errorDesc);
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // Custom Menu
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                { label: 'Open Video', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu-open-video') },
                { type: 'separator' },
                { label: 'Export Transcript', click: () => mainWindow.webContents.send('menu-export-transcript') },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Toggle Library', accelerator: 'CmdOrCtrl+L', click: () => mainWindow.webContents.send('menu-toggle-library') },
                { label: 'Toggle Settings', accelerator: 'CmdOrCtrl+,', click: () => mainWindow.webContents.send('menu-toggle-settings') },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About NeuralPlay',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About NeuralPlay',
                            message: 'NeuralPlay v1.0',
                            detail: `AI-Powered Video Analysis & Player

Made by: Oredipe Oluwagbohunmi Adekunle
aka B1ACB1RD

─────────────────────

💙 SUPPORT THE PROJECT

Your donations help us:
• Train custom AI models for better accuracy
• Cover GPU cloud costs for model training
• Keep the project free & open source
• Accelerate development of new features

SOL: 79gVfZ4q8UcFojF7S23afiVZ8APy2YbfsyLofqD92UzB
ETH: 0x75DFFB62b779BFc5706864cE7d4Cd259b0372c0B
BTC: bc1qfljhc88vsdxdddm4ggaq4e89qthzv2n4a7sajv

─────────────────────

🚀 FUTURE PLANS

AI Models We're Training:
• Smart Intro Skip - Automatically detect & skip intros
• Scene Classification - Understand scene content (action, dialogue, etc.)
• Advanced Scene Detection - Better chapter generation
• Content-Aware Highlights - Find the best moments
• Speaker Diarization - Know who's speaking when

Upcoming Features:
• Cloud sync for watch history
• Multi-video comparison view
• Audio waveform visualization
• Custom trained models marketplace
• Mobile companion app

─────────────────────

Current Features: Transcription, Object Detection, Emotion Recognition, Scene Analysis, Smart Skip, Voice Control, and more.`
                        });
                    }
                },
                {
                    label: 'Keyboard Shortcuts',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Keyboard Shortcuts',
                            message: 'NeuralPlay Shortcuts',
                            detail: 'Space: Play/Pause\n←/→: Skip 5s\n↑/↓: Volume\nF: Fullscreen\nM: Mute\nS: Screenshot\n[: Loop A\n]: Loop B\n\\: Clear Loop'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// Old startBackend removed - using the new one defined at top

app.on('ready', () => {
    // Start backend (the new startBackend function handles dev/prod detection)
    startBackend();
    createWindow();

    ipcMain.handle('open-video', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv'] }]
        });
        return result.filePaths[0];
    });

    ipcMain.handle('scan-folder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        if (result.filePaths[0]) {
            const fs = require('fs');
            const path = require('path');
            const folder = result.filePaths[0];
            const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv'];
            const videos = [];

            const scanDir = (dir) => {
                try {
                    const files = fs.readdirSync(dir);
                    files.forEach(file => {
                        const fullPath = path.join(dir, file);
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) {
                            scanDir(fullPath);
                        } else if (videoExts.includes(path.extname(file).toLowerCase())) {
                            videos.push(fullPath);
                        }
                    });
                } catch (e) { }
            };

            scanDir(folder);
            return videos;
        }
        return [];
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        if (backendProcess) backendProcess.kill();
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

app.on('will-quit', () => {
    if (backendProcess) backendProcess.kill();
});
