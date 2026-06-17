import asyncio
import websockets
import json

async def main():
    uri = "ws://localhost:3200"
    print(f"Connecting to {uri}...")
    
    async with websockets.connect(uri) as websocket:
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
            "prompt": "A futuristic city in neon colors, cyberpunk style",
            "count": 1,
            "delay": 30,
            "upscale": False,
            "videoMode": False,
            "prefix": "cyber_"
        }
        print("\nSending command:", json.dumps(command, indent=2))
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
