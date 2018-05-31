@set %1 >NUL
@set %2 >NUL
@set %3 >NUL

python download.py --stockflow_url=http://stockflow.net --stockflow_user=%USER% --stockflow_password=%PASSWORD%

@ECHO OFF
IF NOT "%SILENT%" == "1" pause
@ECHO ON