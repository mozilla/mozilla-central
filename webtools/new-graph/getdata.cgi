#!/usr/bin/env python

import cgitb; cgitb.enable()

import os
import sys
import cgi
import time
import re
import gzip
import minjson as json

import cStringIO

from graphsdb import db
#
# All objects are returned in the form:
# {
#  resultcode: n,
#  ...
# }
#
# The ... is dependant on the result type.
#
# Result codes:
#   0 success
#  -1 bad tinderbox
#  -2 bad test name
#
# incoming query string:
# tbox=name
#  tinderbox name
#
# If only tbox specified, returns array of test names for that tinderbox in data
# If invalid tbox specified, returns error -1
#
# test=testname
#  test name
#
# Returns results for that test in .results, in array of [time0, value0, time1, value1, ...]
# Also returns .annotations for that dataset, in array of [time0, string0, time1, string1, ...]
#
# raw=1
# Same as full results, but includes raw data for test in .rawdata, in form [time0, rawdata0, ...]
#
# starttime=tval
#  Start time to return results from, in seconds since GMT epoch
# endtime=tval
#  End time, in seconds since GMT epoch
#
# getlist=1
#   To be combined with branch, machine and testname
#   Returns a list of distinct branches, machines or testnames in the database
#
# if neither getlist nor setid are found in the query string the returned results will be a list
# of tests, limited by a given datelimit, branch, machine and testname
#  ie) dgetdata?datelimit=1&branch=1.8 will return all tests in the database that are not older than a day and that
#      were run on the 1.8 branch

def doError(errCode):
    errString = "unknown error"
    if errCode == -1:
        errString = "bad tinderbox"
    elif errCode == -2:
        errString = "bad test name"
    print "{ resultcode: " + str(errCode) + ", error: '" + errString + "' }"

def doGetList(fo, type, branch, machine, testname):
    results = []
    s1 = ""
    if branch:
      s1 = "SELECT DISTINCT branch FROM dataset_info"
    if machine:
      s1 = "SELECT DISTINCT machine FROM dataset_info"
    if testname:
      s1 = "SELECT DISTINCT test FROM dataset_info"
    cur = db.cursor()
    cur.execute(s1 + " WHERE type = ?", (type,))
    for row in cur:
        results.append({ "value": row[0] })
    cur.close()
    fo.write(json.write( {"resultcode": 0, "results": results} ))  

def doListTests(fo, type, datelimit, branch, machine, testname, graphby):
    results = []
    s1 = ""

    # FIXME: This could be vulnerable to SQL injection!  Although it looks like checkstring should catch bad strings.
    if branch:
       s1 += " AND branch = '" + branch + "' "
    if machine:
       s1 += " AND machine = '" + machine + "' "
    if testname:
       s1 += " AND test = '" + testname + "' "
   
    cur = db.cursor()
    if graphby and graphby == 'bydata':
        cur.execute("SELECT id, machine, test, test_type, dataset_extra_data.data, extra_data, branch FROM dataset_extra_data JOIN dataset_info ON dataset_extra_data.dataset_id = dataset_info.id WHERE type = ? AND test_type != ? and (date >= ?) " + s1 +" GROUP BY machine,test,test_type,dataset_extra_data.data, extra_data, branch", (type, "baseline", datelimit))
    else:
        cur.execute("SELECT id, machine, test, test_type, date, extra_data, branch FROM dataset_info WHERE type = ? AND test_type != ? and (date >= ?)" + s1, (type, "baseline", datelimit))
    for row in cur:
        if graphby and graphby == 'bydata':
            results.append( {"id": row[0],
                             "machine": row[1],
                             "test": row[2],
                             "test_type": row[3],
                             "data": row[4],
                             "extra_data": row[5],
                             "branch": row[6]})
        else:
            results.append( {"id": row[0],
                             "machine": row[1],
                             "test": row[2],
                             "test_type": row[3],
                             "date": row[4],
                             "extra_data": row[5],
                             "branch": row[6]})

    cur.close()
    fo.write (json.write( {"resultcode": 0, "results": results} ))


def getByDataResults(cur,setid,extradata,starttime,endtime):
    s1 = ""
    s2 = ""
    cur.execute("""
                    SELECT dataset_info.date,avg(dataset_values.value)
                        FROM dataset_info
                        JOIN dataset_extra_data 
                            ON dataset_extra_data.dataset_id = dataset_info.id
                        JOIN dataset_values
                            ON dataset_extra_data.time = dataset_values.time
                            AND dataset_info.id = dataset_values.dataset_id
                        WHERE 
                            (dataset_info.machine,dataset_info.test,dataset_info.test_type,dataset_info.extra_data,dataset_info.branch) = (SELECT machine,test,test_type,extra_data,branch from dataset_info where id = ? limit 1) 
                        AND dataset_extra_data.data = ?
                        GROUP BY dataset_info.date ORDER BY dataset_info.date
                """, (setid,extradata))
                        
def doSendAllResults(fo, setids):
    datasets = {} 
    data = {}
    fo.write ("{ resultcode: 0,")
    cur = db.cursor()
    setids = [ int(x) for x in setids.split(",") ] 

    datasets[setids[0]] = {}
    # Not using bind variables, but we know that all of the values are integers because of the previous line
    sql = "SELECT IFNULL(data,0), a.value as `" + str(setids[0]) + "`" 
    for x in setids[1:]:
        sql += ", IFNULL( ( SELECT value from dataset_values where time = a.time and dataset_id = " + str(x) + " ),0) as `" + str(x) + "`"
        datasets[x] = {}

    sql += """
                FROM dataset_values AS a
                LEFT JOIN dataset_extra_data as ded ON 
                    a.dataset_id = ded.dataset_id AND a.time = ded.time
                WHERE a.dataset_id = """ + str(setids[0]) + """ ORDER BY a.time"""

    cur.execute(sql)
    i = 0
    for row in cur:
        data[i] = row[0]
        j = 1
        for x in setids:
            datasets[x][i] = row[j]
            j += 1 
        i += 1
    cur.close()
    fo.write( "results: {")
    for x in datasets:
        fo.write("'" + str(x)+ "': [")
        i = 0
        for y in datasets[x]:
            fo.write( str(y)+ ","+str(datasets[x][y]) + ",")
        fo.write ("],")
                
    fo.write ("},")
    fo.write ("rawdata: [")
    for x in data:
        fo.write(  str(x) + ",'" + str(data[x]) + "'," )
        
    
    fo.write ("],")
    fo.write("stats: {")
    for x in setids:
        cur = db.cursor()
        cur.execute("SELECT avg(value), max(value), min(value) from dataset_values where dataset_id = ?  GROUP BY dataset_id", (x,))
        for row in cur:
            fo.write("'%s': [%s, %s, %s,]," %(x,row[0], row[1], row[2]))
        cur.close()
    fo.write("},")
    fo.write ("}")

    
def doSendResults(fo, setid, starttime, endtime, raw, graphby, extradata=None):
    s1 = ""
    s2 = ""
    if starttime:
        s1 = " AND time >= " + starttime
    if endtime:
        s2 = " AND time <= " + endtime

    fo.write ("{ resultcode: 0,")

    cur = db.cursor()
    if not graphby or graphby == "time": 
        cur.execute("SELECT time, value FROM dataset_values WHERE dataset_id = ? " + s1 + s2 + " ORDER BY time", (setid,))
    else:
        getByDataResults(cur,setid, extradata,starttime,endtime) 
    fo.write ("results: [")
    for row in cur:
        if row[1] == 'nan':
            continue
        fo.write ("%s,%s," % (row[0], row[1]))
    cur.close()
    fo.write ("],")

    cur = db.cursor()
    cur.execute("SELECT time, value FROM annotations WHERE dataset_id = ? " + s1 + s2 + " ORDER BY time", (setid,))
    fo.write ("annotations: [")
    for row in cur:
        fo.write("%s,'%s'," % (row[0], row[1]))
    cur.close()
    fo.write ("],")

    cur = db.cursor()
    cur.execute("SELECT test FROM dataset_info WHERE id = ?", (setid,))
    row = cur.fetchone()
    test_name = row[0]

    cur.execute("SELECT id, extra_data FROM dataset_info WHERE test = ? and test_type = ?", (test_name, "baseline"))
    baselines = cur.fetchall()

    fo.write ("baselines: {")
    for baseline in baselines:
        cur.execute("SELECT value FROM dataset_values WHERE dataset_id = ? LIMIT 1", (baseline[0],))
        row = cur.fetchone()
        fo.write("'%s': '%s'," % (baseline[1], row[0]))
    fo.write("},")
    cur.close()

    if raw:
        cur = db.cursor()
        cur.execute("SELECT time, data FROM dataset_extra_data WHERE dataset_id = ? " + s1 + s2 + " ORDER BY time", (setid,))
        fo.write ("rawdata: [")
        for row in cur:
            blob = row[1]
            if "\\" in blob:
                blob = blob.replace("\\", "\\\\")
            if "'" in blob:
                blob = blob.replace("'", "\\'")
            fo.write("%s,'%s'," % (row[0], blob))
        cur.close()
        fo.write ("],")

    cur = db.cursor()
    cur.execute("SELECT avg(value), max(value), min(value) from dataset_values where dataset_id = ? " + s1 + s2 + " GROUP BY dataset_id", (setid,))
    fo.write("stats: [")
    for row in cur:
        fo.write("%s, %s, %s," %(row[0], row[1], row[2]))
    cur.close()
    fo.write("],")

    fo.write ("}")

#if var is a number returns a value other than None
def checkNumber(var):
    if var is None:
      return 1
    reNumber = re.compile('^[0-9.]*$')
    return reNumber.match(var)

#if var is a string returns a value other than None
def checkString(var):
    if var is None:
      return 1
    reString = re.compile('^[0-9A-Za-z.,_()\- ]*$')
    return reString.match(var)

doGzip = 0
try:
    if "gzip" in os.environ["HTTP_ACCEPT_ENCODING"]:
        doGzip = 1
except:
    pass

form = cgi.FieldStorage()

#make sure that we are getting clean data from the user
for strField in ["type", "machine", "branch", "test", "graphby","extradata","setids"]:
    val = form.getfirst(strField)
    if strField == "test":
        strField = "testname"
    if not checkString(val):
        print "Invalid string arg: ", strField, " '" + val + "'"
        sys.exit(500)
    globals()[strField] = val

for numField in ["setid", "raw", "starttime", "endtime", "datelimit", "getlist"]:
    val = form.getfirst(numField)
    if not checkNumber(val):
        print "Invalid string arg: ", numField, " '" + val + "'"
        sys.exit(500)
    globals()[numField] = val

if not datelimit:
  datelimit = 0

zbuf = cStringIO.StringIO()
zfile = zbuf
if doGzip == 1:
    zfile = gzip.GzipFile(mode = 'wb', fileobj = zbuf, compresslevel = 5)

if not setid and not getlist and not setids:
    doListTests(zfile, type, datelimit, branch, machine, testname, graphby)
elif setids and not getlist:
    doSendAllResults(zfile,setids)
elif not getlist:
    doSendResults(zfile, setid, starttime, endtime, raw, graphby,extradata)
else:
    doGetList(zfile, type, branch, machine, testname)

sys.stdout.write("Content-Type: text/plain\n")
if doGzip == 1:
    zfile.close()
    sys.stdout.write("Content-Encoding: gzip\n")
sys.stdout.write("\n")

sys.stdout.write(zbuf.getvalue())



