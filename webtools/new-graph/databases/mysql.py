import MySQLdb
from MySQLdb import *




class GraphConnection(MySQLdb.connections.Connection):
    def execute(self,query, args):
        cur = self.cursor()
        result = cur.execute(query,args)
        cur.close()
        return result
class GraphsCursor(MySQLdb.cursors.Cursor):
    def execute(self, query, args=None):
        query = query.replace('?','%s')
        return MySQLdb.cursors.Cursor.execute(self, query, args)

def connect(*args,**kwargs):
    kwargs['cursorclass'] = GraphsCursor
    return GraphConnection(*args,**kwargs)
