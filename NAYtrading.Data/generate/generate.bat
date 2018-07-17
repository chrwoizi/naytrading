@set %1 >NUL
@set %2 >NUL
@set %3 >NUL

IF "%TRAIN%" == "" SET TRAIN=50000
IF "%TEST%" == "" SET TEST=10000

python generate.py --train=%TRAIN% --test=%TEST%

@ECHO OFF
IF NOT "%SILENT%" == "1" pause
@ECHO ON