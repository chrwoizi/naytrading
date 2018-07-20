pip install numpy
pip install tensorflow
pip install tensorflow-gpu
pip install matplotlib
python src\main.py --action=buy --model_dir=buying --train_file=buying_train_norm.csv --test_file=buying_test_norm.csv --repeat_train_data=1 --epochs=60
pause