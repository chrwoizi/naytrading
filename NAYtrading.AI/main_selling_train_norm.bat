pip install numpy
pip install tensorflow
pip install tensorflow-gpu
pip install matplotlib
python src\main.py --action=sell --model_dir=selling --train_file=selling_train_norm.csv --test_file=selling_test_norm.csv --additional_columns=1 --epochs=600
pause