python synth.py --test=1000 --train=100000
timeout /T 3
python main.py --test_file=test_buying_synth.csv --train_file=train_buying_synth.csv --epochs=1
timeout /T 3
FOR /F "delims=" %%i IN ('dir /b /ad-h /t:c /od') DO SET a=%%i
cd %a%
MOVE /Y test.csv test_before.csv
MOVE /Y train.csv train_before.csv
COPY /Y ..\..\StockFlow.WPF\bin\Debug\test_buying.csv test.csv
COPY /Y ..\..\StockFlow.WPF\bin\Debug\train_buying.csv train.csv
timeout /T 3
call resume_infinitely.bat
pause