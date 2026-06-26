# Server Changelog

All notable changes to the server module and its related processes will be documented in this file.

## [Current/Recent Updates]

### Added
- **WebSocket Server Setup:** Created base `server.py` to handle bidirectional communication via WebSockets on port `3200`.
- **Role Management:** Implemented connection logic to manage connected clients as either `extension` or `controller`.
- **Command Routing:** Added event handlers for `generate`, `stop`, `report`, and `status` messages to synchronize state between extensions and controllers.
- **Automated File Monitoring:** Implemented an asynchronous folder watcher (`watch_folder`) to continuously monitor a specific retrieve path.
- **Automated File Renaming Script:** Added logic to automatically move incoming files from the retrieve path to specific image/video folders while renaming them sequentially (`1.ext`, `2.ext`, `3.ext`...).
- **Configuration Parsing:** Added `load_config()` logic to automatically read or generate `config.json` containing base paths (`FILES_RETRIEVE_PATH`, `IMAGE_FILE_PATH`, `VIDEO_FILE_PATH`).
- **Client Output Monitoring:** Updated `example_client.py` to support a new `sequence` attribute in the payload. The client now waits dynamically for a file matching the sequence number to be generated in `VIDEO_FILE_PATH` (if `videoMode` is True) or `IMAGE_FILE_PATH` (if `videoMode` is False) before reporting success.

### Updated
- **Automated Prompt Execution:** Modified `prompt_executer.py` to read a JSON array of payload objects from a `prompt.json` file. Each prompt payload is executed sequentially.
- **Configuration Parsing:** Added `PROMPT_FILE_PATH` to `config.json` to configure the location of the `prompt.json` file.
