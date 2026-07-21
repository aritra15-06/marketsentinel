import requests
import json
import nsepython

print("nsepython headers:", nsepython.headers)

# Let's write our own session fetcher to print status code and response content
s = requests.Session()
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept": "*/*",
    "Referer": "https://www.nseindia.com/",
    "Connection": "keep-alive"
}

try:
    print("\nVisiting main page...")
    r1 = s.get("https://www.nseindia.com", headers=headers, timeout=10)
    print("Main page status:", r1.status_code)
    print("Main page cookies:", s.cookies.get_dict())
    
    print("\nVisiting quote api for RELIANCE...")
    r2 = s.get("https://www.nseindia.com/api/quote-equity?symbol=RELIANCE", headers=headers, timeout=10)
    print("Quote API status:", r2.status_code)
    print("Quote API length:", len(r2.text))
    if r2.status_code == 200:
        data = r2.json()
        print("Success! Keys in data:", list(data.keys()))
        if 'priceInfo' in data:
            print("priceInfo:", data['priceInfo'])
    else:
        print("Response content (first 500 chars):")
        print(r2.text[:500])
except Exception as e:
    print("Error:", str(e))
