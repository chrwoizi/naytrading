pip install numpy
pip install tensorflow
pip install tensorflow-gpu
pip install matplotlib
python src\train.py --action=sell --model_dir=selling --train_file=selling_train.csv --test_file=selling_test.csv --additional_columns=1 --epochs=600
pause