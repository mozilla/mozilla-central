#!/usr/bin/env python

import cgitb; cgitb.enable()

import sys
import cgi
import time
import re

from graphsdb import db 

#if var is a valid number returns a value other than None
def checkNumber(var):
    if var is None:
      return 1
    reNumber = re.compile('^[0-9.]*$')
    return reNumber.match(var)

#if var is a valid string returns a value other than None
def checkString(var):
    if var is None:
      return 1
    reString = re.compile('^[0-9A-Za-z._()\- ]*$')
    return reString.match(var)

print "Content-type: text/plain\n\n"
link_format = "RETURN:%s:%.2f:%sspst=range&spstart=%d&spend=%d&bpst=cursor&bpstart=%d&bpend=%d&m1tid=%d&m1bl=0&m1avg=0\n"
link_str = ""


form = cgi.FieldStorage()

# incoming query string has the following parameters:
# type=discrete|continuous
#  indicates discrete vs. continuous dataset, defaults to continuous
# value=n
#  (REQUIRED) value to be recorded as the actual test value
# tbox=foopy
#  (REQUIRED) name of the tinderbox reporting the value (or rather, the name that is to be given this set of data)
# testname=test
#  (REQUIRED) the name of this test
# data=rawdata
#  raw data for this test
# time=seconds
#  time since the epoch in GMT of this test result; if ommitted, current time at time of script run is used
# date
#  date that the test was run - this is for discrete graphs
# branch=1.8.1,1.8.0 or 1.9.0
#  name of the branch that the build was generated for
# branchid=id
#  date of the build 
#  http://wiki.mozilla.org/MozillaQualityAssurance:Build_Ids

#takes as input a file for parsing in csv with the format:
# value,testname,tbox,time,data,branch,branchid,type,data

# Create the DB schema if it doesn't already exist
# XXX can pull out dataset_info.machine and dataset_info.{test,test_type} into two separate tables,
# if we need to.

# value,testname,tbox,time,data,branch,branchid,type,data

fields = ["value", "testname", "tbox", "timeval", "date", "branch", "branchid", "type", "data"]
strFields =  ["type", "data", "tbox", "testname", "branch", "branchid"]
numFields = ["date", "timeval", "value"]
d_ids = []
all_ids = []
all_types = []
if form.has_key("filename"):
    val = form["filename"]
    if val.file:
        print "found a file"
        for line in val.file:
            line = line.rstrip("\n\r")
            contents = line.split(',')
            #clear any previous content in the fields variables - stops reuse of data over lines
	    for field in fields:
               globals()[field] = ''
            if len(contents) < 7:
                print "Incompatable file format"
                sys.exit(500)
            for field, content in zip(fields, contents):
                globals()[field] = content
            for strField in strFields:
                if not globals().has_key(strField):
                    continue
                if not checkString(globals()[strField]):
                    print "Invalid string arg: ", strField, " '" + globals()[strField] + "'" 
                    sys.exit(500)
            for numField in numFields:
                if not globals().has_key(numField):
                    continue
                if not checkNumber(globals()[numField]):
                    print "Invalid string arg: ", numField, " '" + globals()[numField] + "'" 
                    sys.exit(500)

            #do some checks to ensure that we are enforcing the requirement rules of the script
            if (not type):
                type = "continuous"

            if (not timeval):
                timeval = int(time.time())

            if (type == "discrete") and (not date):
               print "Bad args, need a valid date"
               sys.exit(500)

            if (not value) or (not tbox) or (not testname):
                print "Bad args"
                sys.exit(500)


            # figure out our dataset id
            setid = -1

            # Not a big fan of this while loop.  If something goes wrong with the select it will insert until the script times out.
            while setid == -1:
                cur = db.cursor()
                cur.execute("SELECT id FROM dataset_info WHERE type <=> ? AND machine <=> ? AND test <=> ? AND test_type <=> ? AND extra_data <=> ? AND branch <=> ? AND date <=> ? limit 1",
                            (type, tbox, testname, "perf", "branch="+branch, branch, date))
                res = cur.fetchall()
                cur.close()

                if len(res) == 0:
                    db.execute("INSERT INTO dataset_info (type, machine, test, test_type, extra_data, branch, date) VALUES (?,?,?,?,?,?,?)",
                               (type, tbox, testname, "perf", "branch="+branch, branch, date))
                else:
                    setid = res[0][0]

            db.execute("INSERT INTO dataset_values (dataset_id, time, value) VALUES (?,?,?)", (setid, timeval, value))
            db.execute("INSERT INTO dataset_branchinfo (dataset_id, time, branchid) VALUES (?,?,?)", (setid, timeval, branchid))
            if data and data != "":
                db.execute("INSERT INTO dataset_extra_data (dataset_id, time, data) VALUES (?,?,?)", (setid, timeval, data))

            if  (type == "discrete"):
                if not setid in d_ids:
                    d_ids.append(setid)
            if not setid in all_ids:
                all_ids.append(setid)
                all_types.append(type)

    for setid, type in zip(all_ids, all_types):
        cur = db.cursor()
        cur.execute("SELECT MIN(time), MAX(time), test FROM dataset_values, dataset_info WHERE dataset_id = ? and id = dataset_id GROUP BY test", (setid,))
        res = cur.fetchall()
        cur.close()
        tstart = res[0][0]
        tend = res[0][1]
        testname = res[0][2]
        if type == "discrete":
            link_str += (link_format % (testname, float(-1), "dgraph.html#name=" + testname + "&", tstart, tend, tstart, tend, setid,))
        else:
            tstart = 0
            link_str += (link_format % (testname, float(-1), "graph.html#",tstart, tend, tstart, tend, setid,))

    #this code auto-adds a set of continuous data for each series of discrete data sets - creating an overview of the data
    # generated by a given test (matched by machine, test, test_type, extra_data and branch) 
    for setid in d_ids:
        cur = db.cursor()
        #throw out the largest value and take the average of the rest
        cur.execute("SELECT AVG(value) FROM dataset_values WHERE dataset_id = ? and value != (SELECT MAX(value) from dataset_values where dataset_id = ?)", (setid, setid,))
        res = cur.fetchall()
        cur.close()
        avg = res[0][0]
        if avg is not None:
            cur = db.cursor()
            cur.execute("SELECT machine, test, test_type, extra_data, branch, date FROM dataset_info WHERE id = ?", (setid,))
            res = cur.fetchall()
            cur.close()
            tbox = res[0][0]
            testname = res[0][1]
            test_type = res[0][2]
            extra_data = res[0][3]
            branch = str(res[0][4])
            timeval = res[0][5]
            date = ''
            cur = db.cursor()
            cur.execute("SELECT branchid FROM dataset_branchinfo WHERE dataset_id = ?", (setid,))
            res = cur.fetchall()
            cur.close()
            branchid = res[0][0]
            dsetid = -1 
            while dsetid == -1 :
                cur = db.cursor()
                cur.execute("SELECT id from dataset_info where type = ? AND machine <=> ? AND test = ? AND test_type = ? AND extra_data = ? AND branch <=> ? AND date <=> ? limit 1",
                        ("continuous", tbox, testname+"_avg", "perf", "branch="+branch, branch, date))
                res = cur.fetchall()
                cur.close()
                if len(res) == 0:
                    db.execute("INSERT INTO dataset_info (type, machine, test, test_type, extra_data, branch, date) VALUES (?,?,?,?,?,?,?)",
                           ("continuous", tbox, testname+"_avg", "perf", "branch="+branch, branch, date))
                else:
                    dsetid = res[0][0]
            cur = db.cursor()
            cur.execute("SELECT * FROM dataset_values WHERE dataset_id=? AND time <=> ? limit 1", (dsetid, timeval))
            res = cur.fetchall()
            cur.close()
            if len(res) == 0:
                db.execute("INSERT INTO dataset_values (dataset_id, time, value) VALUES (?,?,?)", (dsetid, timeval, avg))
                db.execute("INSERT INTO dataset_branchinfo (dataset_id, time, branchid) VALUES (?,?,?)", (dsetid, timeval, branchid))
            else:
                db.execute("UPDATE dataset_values SET value=? WHERE dataset_id=? AND time <=> ?", (avg, dsetid, timeval))
                db.execute("UPDATE dataset_branchinfo SET branchid=? WHERE dataset_id=? AND time <=> ?", (branchid, dsetid, timeval))
            cur = db.cursor()
            cur.execute("SELECT MIN(time), MAX(time) FROM dataset_values WHERE dataset_id = ?", (dsetid,))
            res = cur.fetchall()
            cur.close()
            tstart = 0
            tend = res[0][1]
            link_str += (link_format % (testname, float(avg), "graph.html#", tstart, tend, tstart, tend, dsetid,))

    db.commit()
print "Inserted."
print link_str

sys.exit()
