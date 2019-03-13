pip install numpy
pip install tensorflow
pip install tensorflow-gpu
pip install matplotlib
python src\train.py --action=buy --model_dir=buying --train_file=buying_train.csv --test_file=buying_test.csv --repeat_train_data=1 --epochs=60
pause