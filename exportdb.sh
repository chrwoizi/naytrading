dbuser=naytrading
dbpass=naytrading
dbname=naytrading
rm -r dump
mkdir dump
cd dump
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" instruments > instruments.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" portfolios > portfolios.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" settings > settings.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" snapshots > snapshots.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" snapshotrates > snapshotrates.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" sources > sources.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" trades > trades.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" tradelogs > tradelogs.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" users > users.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" userinstruments > userinstruments.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" usersnapshots > usersnapshots.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" weights > weights.sql
mysqldump --user="$dbuser" --password="$dbpass" "$dbname" whitelists > whitelists.sql
tar czf dump.tar.gz *
rm *.sql
mv -f dump.tar.gz ../
cd ..
rmdir dump
