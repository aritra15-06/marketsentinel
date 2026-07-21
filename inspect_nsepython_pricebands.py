import nsepython
import inspect

print("--- nse_price_band_hitters Source ---")
try:
    print(inspect.getsource(nsepython.nse_price_band_hitters))
except Exception as e:
    print(e)
