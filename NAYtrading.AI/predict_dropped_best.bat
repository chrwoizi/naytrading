pip install requests
pip install tensorflow
cd src
python predict.py --buy_checkpoint_dir=%1\checkpoint\best --sell_checkpoint_dir=%2\checkpoint\best
pause