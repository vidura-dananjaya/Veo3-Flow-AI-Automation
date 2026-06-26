import asyncio
import json
import os
from example_client import main

if __name__ == "__main__":
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    
    try:
        with open(config_path, "r") as f:
            config = json.load(f)
    except Exception as e:
        print(f"Error loading config.json: {e}")
        config = {}
        
    prompt_file_path = config.get("PROMPT_FILE_PATH")
    
    if not prompt_file_path or not os.path.exists(prompt_file_path):
        print(f"Prompt file not found at: {prompt_file_path}")
    else:
        try:
            with open(prompt_file_path, "r") as f:
                prompts = json.load(f)
                
            if isinstance(prompts, list):
                for index, payload in enumerate(prompts):
                    print(f"Executing payload {index + 1}/{len(prompts)}...")
                    asyncio.run(main(payload))
                    print(f"Finished executing payload {index + 1}.\n")
            else:
                print("The prompt file does not contain a JSON array.")
        except Exception as e:
            print(f"Error loading or executing prompts: {e}")
