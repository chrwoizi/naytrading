@SET PROXY_URL=
@SET PROXY_USER=
@SET PROXY_PASSWORD=
@SET NAYTRADING_URL=http://naytrading.net
@SET NAYTRADING_USER=
@SET NAYTRADING_PASSWORD=
@SET SILENT=
@SET OUTPUT_DIR=data

@SET %1 >NUL
@SET %2 >NUL
@SET %3 >NUL
@SET %4 >NUL
@SET %5 >NUL
@SET %6 >NUL
@SET %7 >NUL
@SET %8 >NUL

python download.py --proxy_url=%PROXY_URL% --proxy_user=%PROXY_USER% --proxy_password=%PROXY_PASSWORD% --naytrading_url=%NAYTRADING_URL% --naytrading_user=%NAYTRADING_USER% --naytrading_password=%NAYTRADING_PASSWORD% --output_dir=%OUTPUT_DIR%

@ECHO OFF
IF NOT "%SILENT%" == "True" pause
@ECHO ON