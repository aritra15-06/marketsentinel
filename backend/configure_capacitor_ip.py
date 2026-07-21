import socket
import json
import os

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to a public DNS IP (doesn't send any traffic, just finds local interface)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def main():
    ip = get_local_ip()
    print(f"Detected local IP: {ip}")
    
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "capacitor.config.json"))
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
    else:
        config = {
            "appId": "com.marketsentinel.app",
            "appName": "MarketSentinel",
            "webDir": "dist"
        }
    
    config["server"] = {
        "url": f"http://{ip}:5173",
        "cleartext": True
    }
    
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
        
    print(f"Successfully updated capacitor.config.json with live server URL: http://{ip}:5173")

if __name__ == "__main__":
    main()
