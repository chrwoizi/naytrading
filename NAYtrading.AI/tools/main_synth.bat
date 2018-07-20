cd ..
pip install numpy
pip install tensorflow
pip install tensorflow-gpu
pip install matplotlib
pip install noise
python src\main.py --test_file=..\NAYtrading.Data\generate\data\test_buying.csv --train_file=..\NAYtrading.Data\generate\data\train_buying.csv --epochs=1
pause