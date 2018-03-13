rmdir /S /Q model
python StockFlow.Python.py --data_file=buy_dummy.csv --data_count=1024 --batch_size=64 --test_data_ratio=0.25 --first_day=-1814
pause