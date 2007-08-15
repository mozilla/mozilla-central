#!/usr/bin/python

import os
import minjson as json
import random
import datetime

print "Content-type: text/plain\n\n";

def getQuery():
    query = {}
    try:
        QS = os.environ["QUERY_STRING"]
        querybits = QS.split("&");
        for q in querybits:
            qq = q.split("=")
            if len(qq) == 2:
                query[qq[0]] = qq[1]
            else:
                query[qq[0]] = 1
    except:
        pass
    return query

query = getQuery()

def main():
    if "type" in query and query["type"] == "continuous":
        data = {
            'resultcode': 0,
            'results': [
            { 'id': 1, 'machine': 'tbox1', 'test': 'test1', 'test_type': 'perf', 'extra_data': None },
            { 'id': 4, 'machine': 'tbox2', 'test': 'test1', 'test_type': 'perf', 'extra_data': None },
            { 'id': 3, 'machine': 'tbox1', 'test': 'test3', 'test_type': 'perf', 'extra_data': None },
            { 'id': 6, 'machine': 'tbox3', 'test': 'test3', 'test_type': 'perf', 'extra_data': None },
            { 'id': 2, 'machine': 'tbox1', 'test': 'test2', 'test_type': 'perf', 'extra_data': None },
            { 'id': 5, 'machine': 'tbox2', 'test': 'test2', 'test_type': 'perf', 'extra_data': None },
            { 'id': 50, 'machine': 'single', 'test': 'test2', 'test_type': 'perf', 'extra_data': None },
            ]
            }
        print json.write(data)
        return

    if "type" in query and query["type"] == "discrete":
        data = None
        if "getlist" in query:
            if "machine" in query:
                data = { 'resultcode': 0, 'results': [ {'value': 'qm-pxp01'} ] }
            elif "branch" in query:
                data = { 'resultcode': 0, 'results': [ {'value': 1.9} ] }
            elif "test" in query:
                data = { 'resultcode': 0, 'results': [ {'value': "tp_CPUUsage"}, {'value': "tp_loadtime"} ] }
        if data is None:
            results = []
            if "test" in query:
                if query["test"] == "tp_CPUUsage":
                    results.append({"test_type": "perf", "machine": "qm-pxp01", "date": 1180657203, "branch": 1.9, "test": "tp_CPUUsage", "extra_data": "branch=1.9", "id": 100})
                    results.append({"test_type": "perf", "machine": "qm-pxp01", "date": 1180667203, "branch": 1.9, "test": "tp_CPUUsage", "extra_data": "branch=1.9", "id": 101})
                    results.append({"test_type": "perf", "machine": "qm-pxp01", "date": 1180677203, "branch": 1.9, "test": "tp_CPUUsage", "extra_data": "branch=1.9", "id": 102})
                elif query["test"] == "tp_loadtime":
                    results.append({"test_type": "perf", "machine": "qm-pxp01", "date": 1180657203, "branch": 1.9, "test": "tp_loadtime", "extra_data": "branch=1.9", "id": 200})
                    results.append({"test_type": "perf", "machine": "qm-pxp01", "date": 1180667203, "branch": 1.9, "test": "tp_loadtime", "extra_data": "branch=1.9", "id": 201})
                    results.append({"test_type": "perf", "machine": "qm-pxp01", "date": 1180677203, "branch": 1.9, "test": "tp_loadtime", "extra_data": "branch=1.9", "id": 202})
            
            data = {'resultcode': 0, 'results': results}
        print json.write(data)
        return

    if "setid" in query:
        setid = int(query["setid"])

        # if less than 100, then it's a continuous set
        if setid < 100:
            random.seed()

            starttime = 1148589000
    
            data = []
            val = int(random.random() * 100 + 200)
            r = 500
            if setid == 50:
                r = 1
            for z in range(r):
                timeval = starttime + (z*60*20) + int(random.random() * 240 - 120);
                data.append(timeval)
                data.append(val)
                val = val + int(random.random() * 10 - 5)

            result = { 'resultcode': 0, 'results': data }
            print json.write(result)
            return

        # if less than 200 then it's a CPU usage percentage thing
        if setid < 200:
            random.seed()
            data = []
            val = int(random.random() * 100)
            for z in range(500):
                data.append(z)
                data.append(val)
                val = val + int(random.random() * 30 - 15)
                val = max(min(val, 100), 0)
            result = { 'resultcode': 0, 'results': data, 'stats': [100.0, 100.0, 0.0] }
            print json.write(result)
            return

        # dgraph stuff
        if setid < 300:
            random.seed()
            data = []
            rawdata = []
            val = int(random.random() * 500)
            for z in range(300):
                tname = str(z) + str(z) + str(z)
                data.append(z)
                data.append(val)
                val = max(val + int(random.random() * 100 - 50), 0)
                rawdata.append(z)
                rawdata.append(tname)
            result = { 'resultcode': 0, 'results': data, 'annotations': [], 'baselines': {}, 'rawdata': rawdata }
            print json.write(result)
            return
                
main()


