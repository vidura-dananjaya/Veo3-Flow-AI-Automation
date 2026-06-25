# Server Module

This directory contains the core WebSocket server and automated file management processes for the Veo3-Flow-AI-Automation project.

## Features & Processes

### 1. WebSocket Server (`server.py`)
- **Port:** `3200`
- **Address:** `ws://localhost:3200`
- **Purpose:** Acts as a bridge between Chrome Extensions and Controller scripts.
- **Roles Handled:**
  - `extension`: Connects to report generation status, logs, and receive generation commands.
  - `controller`: Connects to send commands (`generate`, `stop`) and requests server state/status.

### 2. Automated File Renaming & Monitoring Script
- Asynchronously monitors a designated retrieval folder (`FILES_RETRIEVE_PATH`).
- Automatically categorizes files based on their extensions:
  - **Images** (`.png`, `.jpg`, etc.) are moved to `IMAGE_FILE_PATH`.
  - **Videos** (`.mp4`, `.avi`, etc.) are moved to `VIDEO_FILE_PATH`.
- Automatically renames incoming files sequentially (e.g., `1.jpg`, `2.mp4`) based on the highest existing numbered file in the corresponding target directory.

### 3. Configuration Management
- Handled via `config.json`.
- If the file does not exist, the server automatically generates it with default paths upon startup.

## Setup & Running
Run the server using Python:
```bash
python server.py
```
The server will start the folder watcher in the background and wait for WebSocket clients to connect.
