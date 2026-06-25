import asyncio
from example_client import main

if __name__ == "__main__":
    # Example JSON object / dictionary to pass
    payload = {
        "prompt": "make asmr feeling",
        "videoMode": False,
        "imageName": "1.jpg",
        "sequence": 2
    }
    
    print("Executing prompt via example_client...")
    asyncio.run(main(payload))
