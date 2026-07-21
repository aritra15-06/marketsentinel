import nsepython
import json

try:
    print("Fetching top gainers via nsepython...")
    df = nsepython.nse_get_top_gainers()
    print("Type of result:", type(df))
    print("DataFrame shape:", df.shape)
    print("DataFrame content:")
    print(df.to_string())
except Exception as e:
    print("Error calling nse_get_top_gainers:", str(e))
