python flatten.py
python split_by_decision.py
python split_train_test.py --input_path=data\\buy.csv --output_path_train=data\\buy_train.csv --output_path_test=data\\buy_test.csv
python split_train_test.py --input_path=data\\no_buy.csv --output_path_train=data\\no_buy_train.csv --output_path_test=data\\no_buy_test.csv
python split_train_test.py --input_path=data\\sell.csv --output_path_train=data\\sell_train.csv --output_path_test=data\\sell_test.csv
python split_train_test.py --input_path=data\\no_sell.csv --output_path_train=data\\no_sell_train.csv --output_path_test=data\\no_sell_test.csv
python augment.py --input_path=data\\buy_test.csv --output_path=data\\buy_test_aug.csv
python augment.py --input_path=data\\no_buy_test.csv --output_path=data\\no_buy_test_aug.csv
python augment.py --input_path=data\\sell_test.csv --output_path=data\\sell_test_aug.csv
python augment.py --input_path=data\\no_sell_test.csv --output_path=data\\no_sell_test_aug.csv
python merge.py --input_path_1=data\\buy_train_aug.csv --input_path_2=data\\no_buy_train_aug.csv --output_path=data\\buying_train.csv
python merge.py --input_path_1=data\\sell_train_aug.csv --input_path_2=data\\no_sell_train_aug.csv --output_path=data\\selling_train.csv
python normalize.py --input_path=data\\buying_train_aug.csv --output_path=data\\buying_train_aug_norm.csv
python normalize.py --input_path=data\\selling_train_aug.csv --output_path=data\\selling_train_aug_norm.csv
pause