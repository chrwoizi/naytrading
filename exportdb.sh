#!/bin/sh

dbuser=naytrading
dbpass=naytrading
dbname=naytrading
processdir="$(dirname $0)/../dumping"
outdir="$(dirname $0)/.."
initdir="$(PWD)"

mkdir "$processdir"
cd "$processdir"

echo cleanup..
rm *.sql
rm *.tar.gz

backup_table()
{
  echo "exporting $1..."
  mysqldump --user="$dbuser" --password="$dbpass" "$dbname" $1 > $2.sql
}

backup_table instruments
backup_table instrumentrates
backup_table settings
backup_table snapshots
backup_table snapshotrates
backup_table sources
backup_table trades
backup_table tradelogs
backup_table users
backup_table userinstruments
backup_table usersnapshots
backup_table weights
backup_table whitelists

echo compressing...
tar czf dump.tar.gz *.sql

echo cleanup...
rm *.sql
mv -f dump.tar.gz "../$outdir/dump.tar.gz"
cd "$initdir"
echo done.