import asyncio
import websockets
import json
import logging
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")

# Port for WebSocket Server
PORT = 3200

# Store connected clients
extensions = set()
controllers = set()

# Server state
state = {
    "running": False,
    "done": 0,
    "remaining": 0,
    "total": 0,
    "currentPrompt": None,
    "logs": []
}

def add_log(msg):
    # Print ascii safe version
    logging.info(msg.encode('ascii', 'replace').decode())
    entry = f"[{time.strftime('%H:%M:%S')}] {msg}"
    state["logs"].append(entry)
    if len(state["logs"]) > 100:
        state["logs"] = state["logs"][-100:]

async def broadcast_to_controllers(data):
    """Send message to all connected Python scripts/Postman"""
    if not controllers:
        return
    message = json.dumps(data)
    await asyncio.gather(*(c.send(message) for c in controllers), return_exceptions=True)

async def broadcast_to_extensions(data):
    """Send message to all connected Chrome extensions"""
    if not extensions:
        return
    message = json.dumps(data)
    await asyncio.gather(*(e.send(message) for e in extensions), return_exceptions=True)

async def handle_client(websocket, path="/"):
    # Wait for identity message
    try:
        identity_msg = await websocket.recv()
        identity_data = json.loads(identity_msg)
        role = identity_data.get("role")
        
        if role == "extension":
            extensions.add(websocket)
            logging.info(f"Extension connected. Total extensions: {len(extensions)}")
            await websocket.send(json.dumps({"type": "status", "message": "Connected to WebSocket server"}))
            
            # Send current state
            await broadcast_to_controllers({"type": "connection_update", "extensions_connected": len(extensions)})
            
        elif role == "controller":
            controllers.add(websocket)
            logging.info(f"Controller connected. Total controllers: {len(controllers)}")
            
            # Send current state immediately to controller
            await websocket.send(json.dumps({
                "type": "state", 
                "state": state,
                "extensions_connected": len(extensions)
            }))
        else:
            logging.warning("Unknown role, closing connection.")
            await websocket.close()
            return
            
    except Exception as e:
        logging.error(f"Handshake failed: {e}")
        return

    # Message loop
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if role == "controller":
                    if msg_type == "generate":
                        if not extensions:
                            await websocket.send(json.dumps({"type": "error", "error": "No Chrome extensions connected!"}))
                            continue
                            
                        force = data.get("force", False)
                        if state["running"] and not force:
                            await websocket.send(json.dumps({
                                "type": "error", 
                                "error": "A generation is already running. Send {\"type\": \"stop\"} or {\"type\": \"generate\", \"force\": true}."
                            }))
                            continue
                            
                        # Update state
                        state["running"] = True
                        state["done"] = 0
                        state["total"] = data.get("count", 1)
                        state["remaining"] = state["total"]
                        state["currentPrompt"] = data.get("prompt", "")
                        add_log(f"Received generate command from controller: {data.get('prompt')}")
                        
                        # Forward to extensions
                        await broadcast_to_extensions(data)
                        await websocket.send(json.dumps({"type": "success", "message": "Command forwarded to extension."}))
                        
                    elif msg_type == "stop":
                        state["running"] = False
                        add_log("Stop command received from controller.")
                        await broadcast_to_extensions(data)
                        await websocket.send(json.dumps({"type": "success", "message": "Stop command sent."}))
                        
                    elif msg_type == "status":
                        await websocket.send(json.dumps({
                            "type": "state", 
                            "state": state,
                            "extensions_connected": len(extensions)
                        }))
                
                elif role == "extension":
                    if msg_type == "report":
                        if "running" in data: state["running"] = data["running"]
                        if "done" in data: state["done"] = data["done"]
                        if "remaining" in data: state["remaining"] = data["remaining"]
                        if "total" in data: state["total"] = data["total"]
                        if "currentPrompt" in data: state["currentPrompt"] = data["currentPrompt"]
                        if "log" in data: add_log(data["log"])
                        
                        # Forward the report to all controllers
                        await broadcast_to_controllers({"type": "report", "data": data})

                    elif msg_type == "ping":
                        # Just a heartbeat
                        pass
                        
            except json.JSONDecodeError:
                logging.error(f"Invalid JSON received: {message}")
                
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if role == "extension" and websocket in extensions:
            extensions.remove(websocket)
            logging.info(f"Extension disconnected. Total extensions: {len(extensions)}")
            if state["running"] and len(extensions) == 0:
                 state["running"] = False
                 add_log("All extensions disconnected. Resetting running state.")
            await broadcast_to_controllers({"type": "connection_update", "extensions_connected": len(extensions)})
        elif role == "controller" and websocket in controllers:
            controllers.remove(websocket)
            logging.info(f"Controller disconnected. Total controllers: {len(controllers)}")

async def main():
    print("""
+========================================================+
|   Flow Auto Generator — WebSocket Server               |
|   Address:   ws://localhost:3200                       |
+========================================================+
Waiting for Chrome Extension or Python Scripts to connect...
""")
    
    # Start WebSocket Server with a large max_size to allow High-Res reference images (50 MB)
    server = await websockets.serve(handle_client, "0.0.0.0", PORT, max_size=50 * 1024 * 1024)
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
