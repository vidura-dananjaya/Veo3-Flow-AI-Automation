import asyncio
import websockets
import json
import base64
import mimetypes
import os
import sys

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

async def main(input_data):
    if not input_data.get("prompt"):
        print("Error: 'prompt' is missing or empty in the provided JSON. Process stopped.")
        return

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
            "prompt": input_data.get("prompt", ""),
            "count": 1,
            "delay": 30,
            "upscale": True,
            "videoMode": input_data.get("videoMode", False),
            "prefix": "cyber_"
        }

        # --- HOW TO ADD A REFERENCE IMAGE ---
        image_name = input_data.get("imageName")
        if image_name:
            config = load_config()
            image_file_path_base = config.get("IMAGE_FILE_PATH", "")
            image_path = os.path.join(image_file_path_base, image_name)
            
            if os.path.exists(image_path):
                print(f"Attaching reference image: {image_path}")
                with open(image_path, "rb") as f:
                    img_data = base64.b64encode(f.read()).decode("utf-8")
                mime_type, _ = mimetypes.guess_type(image_path)
                mime_type = mime_type or "image/jpeg"
                
                command["imageData"] = f"data:{mime_type};base64,{img_data}"
                command["imageMimeType"] = mime_type
                command["imageName"] = image_name
            else:
                print(f"Note: Reference image '{image_path}' not found, generating without it.")
        else:
            print("Note: No imageName provided in the input, generating without it.")
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
                        
                        if "sequence" in input_data:
                            sequence_val = input_data["sequence"]
                            config = load_config()
                            
                            if input_data.get("videoMode"):
                                target_path = config.get("VIDEO_FILE_PATH", "")
                            else:
                                target_path = config.get("IMAGE_FILE_PATH", "")
                                
                            if target_path:
                                print(f"\nWaiting for file with sequence '{sequence_val}' to be created in {target_path}...")
                                file_found = False
                                while not file_found:
                                    if os.path.exists(target_path):
                                        for filename in os.listdir(target_path):
                                            name, ext = os.path.splitext(filename)
                                            if name == str(sequence_val):
                                                file_found = True
                                                break
                                    if not file_found:
                                        await asyncio.sleep(1)
                                print("success")
                                
                                if input_data.get("videoMode") and input_data.get("takeLastScreenShot"):
                                    try:
                                        import cv2
                                        video_file_path = None
                                        for filename in os.listdir(target_path):
                                            name, ext = os.path.splitext(filename)
                                            if name == str(sequence_val):
                                                video_file_path = os.path.join(target_path, filename)
                                                break
                                        
                                        if video_file_path:
                                            image_target_path = config.get("IMAGE_FILE_PATH", "")
                                            if image_target_path:
                                                os.makedirs(image_target_path, exist_ok=True)
                                                image_file = os.path.join(image_target_path, f"{sequence_val}.jpeg")
                                                print(f"Extracting last frame from {video_file_path} to {image_file}...")
                                                cap = cv2.VideoCapture(video_file_path)
                                                if cap.isOpened():
                                                    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                                                    if total_frames > 0:
                                                        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total_frames - 1))
                                                        ret, frame = cap.read()
                                                        if ret:
                                                            cv2.imwrite(image_file, frame)
                                                            print("Screenshot saved successfully.")
                                                        else:
                                                            print("Failed to read the last frame.")
                                                    else:
                                                        print("Video has no frames.")
                                                    cap.release()
                                                else:
                                                    print("Failed to open video file.")
                                    except ImportError:
                                        print("Error: cv2 module not found. Please run 'pip install opencv-python'.")
                                    except Exception as e:
                                        print(f"Error extracting screenshot: {e}")
                        break
                        
                elif data.get("type") == "error":
                    print(f"ERROR from server: {data.get('error')}")
                    break
                    
                elif data.get("type") == "success":
                    print(f"Server acknowledged: {data.get('message')}")
                    
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed by server.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            input_json = json.loads(sys.argv[1])
        except json.JSONDecodeError:
            print("Error: Invalid JSON provided as argument.")
            sys.exit(1)
    else:
        # Default test payload if no arguments are passed
        input_json = {
            "prompt": "make a dancing cat",
            "videoMode": False,
            "imageName": "1.jpg",
            "sequence": 1
        }
        
    asyncio.run(main(input_json))
