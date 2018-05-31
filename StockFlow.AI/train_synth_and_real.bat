python main.py --test_file=..\StockFlow.Data\generate\data\test_buying.csv --train_file=..\StockFlow.Data\generate\data\train_buying.csv --epochs=1
timeout /T 3
FOR /F "delims=" %%i IN ('dir /b /ad-h /t:c /od') DO SET a=%%i
cd %a%
MOVE /Y test.csv test_buying_synth.csv
MOVE /Y train.csv train_buying_synth.csv
COPY /Y ..\..\StockFlow.Data\process\data\test_buying.csv test.csv
COPY /Y ..\..\StockFlow.Data\process\data\train_buying.csv train.csv
timeout /T 3
call resume_infinitely.bat
pause