import asyncio
import websockets
import json
import base64
import mimetypes
import os

async def main():
    uri = "ws://localhost:3200"
    print(f"Connecting to {uri}...")
    # Connect with a large max_size to allow High-Res reference images (50 MB)
    async with websockets.connect(uri, max_size=50 * 1024 * 1024) as websocket:
        # 1. Identify as a controller
        await websocket.send(json.dumps({"role": "controller"}))
        
        # 2. Wait for initial state
        response = await websocket.recv()
        state_data = json.loads(response)
        print("Initial Server State:", json.dumps(state_data, indent=2))
        
        if state_data.get("extensions_connected", 0) == 0:
            print("\nWARNING: No Chrome Extensions are connected. The command will fail.")
            print("Please open the Google Labs tab and make sure the extension is loaded.")
            return

        # 3. Send a generation command
        command = {
            "type": "generate",
            "prompt": "make cat color as red",
            "count": 1,
            "delay": 30,
            "upscale": True,
            "videoMode": False,
            "prefix": "cyber_"
        }

        # --- HOW TO ADD A REFERENCE IMAGE ---
        # Provide a valid path to an image file here to test it:
        image_path = "C:\\AI\\imgs\\image1.jpeg" 
        
        if os.path.exists(image_path):
            print(f"Attaching reference image: {image_path}")
            with open(image_path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode("utf-8")
            mime_type, _ = mimetypes.guess_type(image_path)
            mime_type = mime_type or "image/jpeg"
            
            command["imageData"] = f"data:{mime_type};base64,{img_data}"
            command["imageMimeType"] = mime_type
            command["imageName"] = os.path.basename(image_path)
        else:
            print(f"Note: Reference image '{image_path}' not found, generating without it.")
        # ------------------------------------

        print("\nSending command:", json.dumps({**command, "imageData": "...base64..." if "imageData" in command else None}, indent=2))
        await websocket.send(json.dumps(command))
        
        # 4. Listen for real-time logs and updates
        print("\nListening for real-time updates from the extension (Press Ctrl+C to exit)...")
        try:
            while True:
                message = await websocket.recv()
                data = json.loads(message)
                
                if data.get("type") == "report":
                    if "log" in data["data"]:
                        print(f"Extension Log: {data['data']['log']}")
                        
                    if "running" in data["data"] and data["data"]["running"] is False:
                        print("\nGeneration finished!")
                        break
                        
                elif data.get("type") == "error":
                    print(f"ERROR from server: {data.get('error')}")
                    break
                    
                elif data.get("type") == "success":
                    print(f"Server acknowledged: {data.get('message')}")
                    
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed by server.")

if __name__ == "__main__":
    asyncio.run(main())
