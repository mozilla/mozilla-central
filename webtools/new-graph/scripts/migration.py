from pysqlite2 import dbapi2 as sqlite
import MySQLdb, sys, os

DIRNAME= os.path.dirname(sys.argv[0])
if not DIRNAME:
	DBPATH="../db/data.sqlite"
else:
	DBPATH=DIRNAME + "/../db/data.sqlite"

sqlite_db = sqlite.connect(DBPATH)

mysql_db = MySQLdb.connect("localhost","o","o","o_graphs")
mysql_cur = mysql_db.cursor()

def migrate_table(table, select, insert):
	print "Migrating: " + table
	sqlite_cur = sqlite_db.cursor()
	res = sqlite_cur.execute(select)
	for row in res:
		mysql_cur.execute(insert % row)


migrate_table('annotations',"SELECT dataset_id,time,value FROM annotations", "INSERT INTO annotations (`dataset_id`, `time`, `value` ) VALUES ('%s','%s','%s')")
migrate_table('dataset_branchinfo',"SELECT `dataset_id`, `time`, `branchid` FROM dataset_branchinfo", "INSERT INTO dataset_branchinfo (`dataset_id`, `time`, `branchid` ) VALUES ('%s','%s','%s')")
migrate_table('dataset_extra_data',"SELECT `dataset_id`, `time`, `data`  FROM dataset_extra_data", "INSERT INTO dataset_extra_data (`dataset_id`, `time`, `data` ) VALUES ('%s','%s','%s')")
migrate_table('dataset_info',"SELECT `id`, `type`, `machine`,`test`, `test_type`, `extra_data`, `branch`, `date` FROM dataset_info", "INSERT INTO dataset_info (`id`, `type`, `machine`,`test`, `test_type`, `extra_data`, `branch`, `date` ) VALUES ('%s', '%s', '%s','%s', '%s', '%s', '%s', '%s')")
migrate_table('dataset_values',"SELECT `dataset_id`, `time`, `value` FROM dataset_values", "INSERT INTO dataset_values (`dataset_id`, `time`, `value` ) VALUES ('%s','%s','%s')")
