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

from pysqlite2 import dbapi2 as sqlite

DBPATH = "db/data.sqlite"
db = sqlite.connect(DBPATH)
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

def doListTests(fo, type, datelimit, branch, machine, testname):
    results = []
    s1 = ""
    if branch:
       s1 += " AND branch = '" + branch + "' "
    if machine:
       s1 += " AND machine = '" + machine + "' "
    if testname:
       s1 += " AND test = '" + testname + "' "
   
    cur = db.cursor()
    cur.execute("SELECT id, machine, test, test_type, date, extra_data, branch FROM dataset_info WHERE type = ? AND test_type != ? and date > ?" + s1, (type, "baseline", datelimit))
    for row in cur:
        results.append( {"id": row[0],
                         "machine": row[1],
                         "test": row[2],
                         "test_type": row[3],
                         "date": row[4],
                         "extra_data": row[5],
                         "branch": row[6]})

    cur.close()
    fo.write (json.write( {"resultcode": 0, "results": results} ))

def doSendResults(fo, setid, starttime, endtime, raw):
    s1 = ""
    s2 = ""
    if starttime:
        s1 = " AND time >= " + starttime
    if endtime:
        s2 = " AND time <= " + endtime

    fo.write ("{ resultcode: 0,")

    cur = db.cursor()
    cur.execute("SELECT time, value FROM dataset_values WHERE dataset_id = ? " + s1 + s2 + " ORDER BY time", (setid,))
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
    reString = re.compile('^[0-9A-Za-z._()\- ]*$')
    return reString.match(var)

doGzip = 0
try:
    if "gzip" in os.environ["HTTP_ACCEPT_ENCODING"]:
        doGzip = 1
except:
    pass

form = cgi.FieldStorage()

#make sure that we are getting clean data from the user
for strField in ["type", "machine", "branch", "test"]:
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

if not setid and not getlist:
    doListTests(zfile, type, datelimit, branch, machine, testname)
elif not getlist:
    doSendResults(zfile, setid, starttime, endtime, raw)
else:
    doGetList(zfile, type, branch, machine, testname)

sys.stdout.write("Content-Type: text/plain\n")
if doGzip == 1:
    zfile.close()
    sys.stdout.write("Content-Encoding: gzip\n")
sys.stdout.write("\n")

sys.stdout.write(zbuf.getvalue())



