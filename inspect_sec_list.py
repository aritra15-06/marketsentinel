from curl_cffi import requests
import pandas as pd
from io import StringIO

url = "https://nsearchives.nseindia.com/content/equities/sec_list_20072026.csv"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

try:
    r = requests.get(url, headers=headers, impersonate="chrome120")
    if r.status_code == 200:
        df = pd.read_csv(StringIO(r.text))
        print("Data columns:", df.columns)
        print("\nUnique values in Band column:")
        print(df['Band'].unique())
        
        print("\nSample rows:")
        print(df.head(10).to_string())
        
        print("\nChecking specific tickers (RELIANCE, INFY, SBIN):")
        for ticker in ['RELIANCE', 'INFY', 'SBIN']:
            row = df[df['Symbol'].str.strip() == ticker]
            if not row.empty:
                print(row.to_string())
            else:
                print(f"{ticker} not found in sec_list.")
    else:
        print("Status code:", r.status_code)
except Exception as e:
    print("Error:", str(e))
