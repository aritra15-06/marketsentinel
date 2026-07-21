import nsepython
import inspect

functions = [
    'nse_get_top_gainers',
    'nse_get_top_losers',
    'nse_preopen',
    'nse_most_active',
    'nse_get_index_list'
]

for func_name in functions:
    print(f"\n--- {func_name} Source ---")
    try:
        func = getattr(nsepython, func_name)
        print(inspect.getsource(func))
    except Exception as e:
        print(e)
