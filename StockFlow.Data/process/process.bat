@SET DUMP_PATH=..\\download\\data\\*.json
@SET DATA_DIR=data
@SET DAYS=1815
@SET MAX_MISSING_DAYS=120
@SET TEST_DATA_RATIO=0.2
@SET PRESERVE_TEST_IDS=True
@SET AUGMENT_FACTOR=10
@SET SILENT=

@set %1 >NUL
@set %2 >NUL
@set %3 >NUL
@set %4 >NUL
@set %5 >NUL
@set %6 >NUL
@set %7 >NUL
@set %8 >NUL

python flatten.py --input_path=%DUMP_PATH% --output_path=%DATA_DIR%\\flat.csv --days=%DAYS% --max_missing_days=%MAX_MISSING_DAYS%

python split_by_decision.py --input_path=%DATA_DIR%\\flat.csv --output_path_buy=%DATA%\\buy.csv --output_path_no_buy=%DATA%\\no_buy.csv --output_path_sell=%DATA%\\sell.csv --output_path_no_sell=%DATA%\\no_sell.csv

python split_train_test.py --input_path=%DATA_DIR%\\buy.csv --output_path_train=%DATA_DIR%\\buy_train.csv --output_path_test=%DATA_DIR%\\buy_test.csv --factor=%TEST_DATA_RATIO% --preserve_test_ids=%PRESERVE_TEST_IDS%

python split_train_test.py --input_path=%DATA_DIR%\\no_buy.csv --output_path_train=%DATA_DIR%\\no_buy_train.csv --output_path_test=%DATA_DIR%\\no_buy_test.csv --factor=%TEST_DATA_RATIO% --preserve_test_ids=%PRESERVE_TEST_IDS%

python split_train_test.py --input_path=%DATA_DIR%\\sell.csv --output_path_train=%DATA_DIR%\\sell_train.csv --output_path_test=%DATA_DIR%\\sell_test.csv --factor=%TEST_DATA_RATIO% --preserve_test_ids=%PRESERVE_TEST_IDS%

python split_train_test.py --input_path=%DATA_DIR%\\no_sell.csv --output_path_train=%DATA_DIR%\\no_sell_train.csv --output_path_test=%DATA_DIR%\\no_sell_test.csv --factor=%TEST_DATA_RATIO% --preserve_test_ids=%PRESERVE_TEST_IDS%

python augment.py --input_path=%DATA_DIR%\\buy_test.csv --output_path=%DATA_DIR%\\buy_test_aug.csv --factor=%AUGMENT_FACTOR%

python augment.py --input_path=%DATA_DIR%\\no_buy_test.csv --output_path=%DATA_DIR%\\no_buy_test_aug.csv --factor=%AUGMENT_FACTOR%

python augment.py --input_path=%DATA_DIR%\\sell_test.csv --output_path=%DATA_DIR%\\sell_test_aug.csv --factor=%AUGMENT_FACTOR%

python augment.py --input_path=%DATA_DIR%\\no_sell_test.csv --output_path=%DATA_DIR%\\no_sell_test_aug.csv --factor=%AUGMENT_FACTOR%

python merge.py --input_path_1=%DATA_DIR%\\buy_train_aug.csv --input_path_2=%DATA_DIR%\\no_buy_train_aug.csv --output_path=%DATA_DIR%\\buying_train.csv

python merge.py --input_path_1=%DATA_DIR%\\sell_train_aug.csv --input_path_2=%DATA_DIR%\\no_sell_train_aug.csv --output_path=%DATA_DIR%\\selling_train.csv

python normalize.py --input_path=%DATA_DIR%\\buying_train_aug.csv --output_path=%DATA_DIR%\\buying_train_aug_norm.csv

python normalize.py --input_path=%DATA_DIR%\\selling_train_aug.csv --output_path=%DATA_DIR%\\selling_train_aug_norm.csv

@ECHO OFF
IF NOT "%SILENT%" == "True" pause
@ECHO ON