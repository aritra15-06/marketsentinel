import nsepython
import inspect

print("--- nse_eq Source ---")
try:
    print(inspect.getsource(nsepython.nse_eq))
except Exception as e:
    print(e)

print("\n--- quote_equity Source ---")
try:
    print(inspect.getsource(nsepython.quote_equity))
except Exception as e:
    print(e)

print("\n--- nsefetch Source ---")
try:
    print(inspect.getsource(nsepython.nsefetch))
except Exception as e:
    print(e)
