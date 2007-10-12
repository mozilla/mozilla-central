/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is new-graph code.
 *
 * The Initial Developer of the Original Code is
 *    Mozilla Corporation
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir@pobox.com> (Original Author)
 *   Alice Nodelman <anodelman@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

//const getdatacgi = "getdata-fake.cgi?";
//const getdatacgi = "http://localhost:9050/getdata.cgi?";
const getdatacgi = "getdata.cgi?"


function checkErrorReturn(obj) {
    if (!obj || obj.resultcode != 0) {
        alert ("Error: " + (obj ? (obj.error + "(" + obj.resultcode + ")") : "(nil)"));
        return false;
    }
    return true;
}

function TinderboxData() {
    this.onTestListAvailable = new YAHOO.util.CustomEvent("testlistavailable");
    this.onDataSetAvailable = new YAHOO.util.CustomEvent("datasetavailable");
    this.testList = null;
    
    this.testData = {};

}

TinderboxData.prototype = {
    testList: null,
    testData: null,

    onTestListAvailable: null,
    onDataSetAvailable: null,

    defaultLoadRange: null,
    raw: 0,

    init: function () {
        var self = this;
        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")
        
        loadJSONDoc(getdatacgi + "type=continuous")
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                self.testList = obj.results;
                //log("default test list" + self.testList);
                self.onTestListAvailable.fire(self.testList);
            },
            function () {alert ("Error talking to " + getdatacgi + ""); });
    },

    requestTestList: function (callback) {
        //log("requestTestList default");
        var self = this;
        
        if (this.testList != null) {
            callback.call (window, this.testList);
        } else {
            var cb = 
            function (type, args, obj) {
                self.onTestListAvailable.unsubscribe(cb, obj);
                obj.call (window, args[0]);
            };
            
            this.onTestListAvailable.subscribe (cb, callback);
        }
    },

    // arg1 = startTime, arg2 = endTime, arg3 = callback
    // arg1 = callback, arg2/arg3 == null
    requestDataSetFor: function (testId, arg1, arg2, arg3) {
        var self = this;

        var startTime = arg1;
        var endTime = arg2;
        var callback = arg3;

        if (arg1 && arg2 == null && arg3 == null) {
            callback = arg1;
            if (this.defaultLoadRange) {
                startTime = this.defaultLoadRange[0];
                endTime = this.defaultLoadRange[1];
                //log ("load range using default", startTime, endTime);
            } else {
                startTime = null;
                endTime = null;
            }
        }

        if (testId in this.testData) {
            var ds = this.testData[testId];
            //log ("Can maybe use cached?");
            if ((ds.requestedFirstTime == null && ds.requestedLastTime == null) ||
                (ds.requestedFirstTime <= startTime &&
                 ds.requestedLastTime >= endTime))
            {
                //log ("Using cached ds");
                callback.call (window, testId, ds);
                return;
            }

            // this can be optimized, if we request just the bookend bits,
            // but that's overkill
            if (ds.firstTime < startTime)
                startTime = ds.firstTime;
            if (ds.lastTime > endTime)
                endTime = ds.lastTime;
        }

        var cb = 
        function (type, args, obj) {
            if (args[0] != testId ||
                args[2] > startTime ||
                args[3] < endTime)
            {
                // not useful for us; there's another
                // outstanding request for our time range, so wait for that
                return;
            }

            self.onDataSetAvailable.unsubscribe(cb, obj);
            obj.call (window, args[0], args[1]);
        };
        this.onDataSetAvailable.subscribe (cb, callback);

        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")

        var reqstr = getdatacgi + "setid=" + testId;
        if (startTime)
            reqstr += "&starttime=" + startTime;
        if (endTime)
            reqstr += "&endtime=" + endTime;
        //raw data is the extra_data column
        if (this.raw)
            reqstr += "&raw=1";
        //log (reqstr);
        loadJSONDoc(reqstr)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;

                var ds = new TimeValueDataSet(obj.results);

                //this is the the case of a discrete graph - where the entire test run is always requested
                //so the start and end points are the first and last entries in the returned data set
                if  (!startTime && !endTime)  {
                    startTime = ds.data[0];
                    endTime = ds.data[ds.data.length -2];
                }
                ds.requestedFirstTime = startTime;
                ds.requestedLastTime = endTime;
                self.testData[testId] = ds;
                if (obj.annotations)
                    ds.annotations = new TimeStringDataSet(obj.annotations);
                if (obj.baselines)
                    ds.baselines = obj.baselines;
                if (obj.rawdata)
                    ds.rawdata = obj.rawdata;
                if (obj.stats)
                    ds.stats = obj.stats;
                self.onDataSetAvailable.fire(testId, ds, startTime, endTime);
            },
            function (obj) {alert ("Error talking to " + getdatacgi + " (" + obj + ")"); log (obj.stack); });
    },

    clearValueDataSets: function () {
        //log ("clearvalueDatasets");
        this.tinderboxTestData = {};
    },

};

function DiscreteTinderboxData() {
};

DiscreteTinderboxData.prototype = {
    __proto__: new TinderboxData(),
   
    init: function () {
    },
    
    requestTestList: function (limitDate, branch, machine, testname, callback) {
        var self = this;
        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")
        var limiters = "";

        var tDate = 0;
        if (limitDate != null) {
          tDate = new Date().getTime();
          tDate -= limitDate * 86400 * 1000;
          //log ("returning test lists greater than this date" + (new Date(tDate)).toGMTString());
          //TODO hack hack hack
          tDate = Math.floor(tDate/1000)
          
        }
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;
        //log("drequestTestList: " + getdatacgi + "type=discrete&datelimit=" + tDate + limiters);
        loadJSONDoc(getdatacgi + "type=discrete&datelimit=" + tDate + limiters)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                self.testList = obj.results;
                //log ("testlist: " + self.testList);
                callback.call(window, self.testList);
            },
            function () {alert ("requestTestList: Error talking to " + getdatacgi + ""); });
    },

    requestSearchList: function (branch, machine, testname, callback) {
        var self = this;
        limiters = ""; 
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;
        //log(getdatacgi + "getlist=1&type=discrete" + limiters);
        loadJSONDoc(getdatacgi + "getlist=1&type=discrete" + limiters)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                callback.call(window, obj.results);
            },
            function () {alert ("requestSearchList: Error talking to " + getdatacgi); });
    },

    // arg1 = startTime, arg2 = endTime, arg3 = callback
    // arg1 = callback, arg2/arg3 == null
    requestDataSetFor: function (testIds) {
        var self = this;

        var cb = 
        function (type, args, obj) {
            self.onDataSetAvailable.unsubscribe(cb, obj);
            for (x in args[0] ) {
                testIds[x].call(window,x,args[1][x]);
            }
             
           // obj.call (window, args[0], args[1]);
        };

        this.onDataSetAvailable.subscribe (cb, testIds );

        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")
        var testIdString = "";

        for (setId in testIds) {
            if (testIdString == "" ) {
                testIdString += setId; 
            } else {
                testIdString += "," + setId;
            }
        }

        var reqstr = getdatacgi + "setids=" + testIdString;
        //raw data is the extra_data column
        //log (reqstr);
        loadJSONDoc(reqstr)
        .addCallbacks(
            function (obj) {
                var ds = new Array();
                var baseSet = new Array();
                var secondarySet = new Array();
                var sortableSet = new Array();
                if (!checkErrorReturn(obj)) return;
                var testIdCount = 0;
                for ( x in obj.results ) {
                    testIdCount++;
                }
                if ( testIdCount > 1  && getElement("deltasort").checked ) {
                    for ( x in obj.results ) {
                        if (baseSet.length == 0 ) {
                            for ( i = 1; i < obj.results[x].length; i += 2 )  { 
                                baseSet[i] = obj.results[x][i];  
                            }
                        } else {
                            for ( i = 1; i < obj.results[x].length; i += 2 )  { 
                                if (typeof(secondarySet[i]) != 'undefined') {  
                                    secondarySet[i][0] += obj.results[x][i];  
                                    secondarySet[i][1] += 1;
                                } else {
                                    secondarySet[i] = new Array();
                                    secondarySet[i][0] = obj.results[x][i];  
                                    secondarySet[i][1] = 1;
                                }
                            }
                        }
                    }
                    for ( x in baseSet ) {
                        sortableSet[x] = new Array();
                        sortableSet[x][0] = Math.abs(baseSet[x] - ( secondarySet[x][0] / secondarySet[x][1] )); 
                        sortableSet[x][1] = x;
                    }


                    sortableSet.sort( function(a,b) {
                                                        return a[0] - b[0];
                                                    });
                    for ( x in obj.results ) {
                        var tempArray = new Array();
                        for (y=0;y < sortableSet.length / 2; y++ ) {
                            key = sortableSet[y][1];
                            tempArray[y*2] = y;
                            tempArray[y*2 + 1 ] = obj.results[x][key];
                        }
                        obj.results[x] = tempArray;
                    }
                    var tempRawdata = new Array();
                    for ( y=0;y < sortableSet.length / 2; y++) {
                           var key = sortableSet[y][1];
                           tempRawdata[y*2] = y;
                           tempRawdata[y*2 + 1] = obj.rawdata[key]; 
                    }
                    obj.rawdata = tempRawdata;
                }

                for ( x in obj.results ) {
                    ds[x] = new TimeValueDataSet(obj.results[x]);
                    ds[x].rawdata = obj.rawdata;
                    if (obj.stats[x]) 
                        ds[x].stats = obj.stats[x];
                    self.testData[x] = ds[x];
                    ds[x].requestedFirstTime = ds[x].data[0];
                    ds[x].requestedLastTime = ds[x].data[ds[x].data.length - 2];
                }

                self.onDataSetAvailable.fire(testIds, ds);
            },
            function (obj) {alert ("Error talking to " + getdatacgi + " (" + obj + ")"); log (obj.stack); });
    },
};
function ExtraDataTinderboxData() {
};

ExtraDataTinderboxData.prototype = {
    __proto__: new TinderboxData(),
   
    init: function () {
    },
    
    requestTestList: function (limitDate, branch, machine, testname, callback) {
        var self = this;
        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")
        var limiters = "";

        var tDate = 0;
        if (limitDate != null) {
          tDate = new Date().getTime();
          tDate -= limitDate * 86400 * 1000;
          //log ("returning test lists greater than this date" + (new Date(tDate)).toGMTString());
          //TODO hack hack hack
          tDate = Math.floor(tDate/1000)
          
        }
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;
        //log("drequestTestList: " + getdatacgi + "type=discrete&datelimit=" + tDate + limiters);
        loadJSONDoc(getdatacgi + "type=discrete&graphby=bydata&datelimit=" + tDate + limiters)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                self.testList = obj.results;
                //log ("testlist: " + self.testList);
                callback.call(window, self.testList);
            },
            function () {alert ("requestTestList: Error talking to " + getdatacgi + ""); });
    },

    requestSearchList: function (branch, machine, testname, callback) {
        var self = this;
        limiters = ""; 
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;
        //log(getdatacgi + "getlist=1&type=discrete" + limiters);
        loadJSONDoc(getdatacgi + "getlist=1&type=discrete" + limiters)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                callback.call(window, obj.results);
            },
            function () {alert ("requestSearchList: Error talking to " + getdatacgi); });
    },
    // arg1 = startTime, arg2 = endTime, arg3 = callback
    // arg1 = callback, arg2/arg3 == null
    requestDataSetFor: function (testId, arg1, arg2, arg3) {
        var self = this;

        var startTime = arg1;
        var endTime = arg2;
        var callback = arg3;

        var tempArray = new Array();
        tempArray = testId.split("_",2);
        testId = tempArray[0];
        var extradata = tempArray[1];

        if (arg1 && arg2 == null && arg3 == null) {
            callback = arg1;
            if (this.defaultLoadRange) {
                startTime = this.defaultLoadRange[0];
                endTime = this.defaultLoadRange[1];
                //log ("load range using default", startTime, endTime);
            } else {
                startTime = null;
                endTime = null;
            }
        }

        if (testId in this.testData) {
            var ds = this.testData[testId];
            //log ("Can maybe use cached?");
            if ((ds.requestedFirstTime == null && ds.requestedLastTime == null) ||
                (ds.requestedFirstTime <= startTime &&
                 ds.requestedLastTime >= endTime))
            {
                //log ("Using cached ds");
                callback.call (window, testId, ds);
                return;
            }

            // this can be optimized, if we request just the bookend bits,
            // but that's overkill
            if (ds.firstTime < startTime)
                startTime = ds.firstTime;
            if (ds.lastTime > endTime)
                endTime = ds.lastTime;
        }

        var cb = 
        function (type, args, obj) {
            if (args[0] != testId ||
                args[2] > startTime ||
                args[3] < endTime)
            {
                // not useful for us; there's another
                // outstanding request for our time range, so wait for that
                return;
            }

            self.onDataSetAvailable.unsubscribe(cb, obj);
            obj.call (window, args[0], args[1]);
        };
        this.onDataSetAvailable.subscribe (cb, callback);

        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")

        var reqstr = getdatacgi + "setid=" + testId;
        if (startTime)
            reqstr += "&starttime=" + startTime;
        if (endTime)
            reqstr += "&endtime=" + endTime;
        //raw data is the extra_data column
        if (this.raw)
            reqstr += "&raw=1";
        reqstr += "&graphby=bydata";
        reqstr += "&extradata=" + extradata;
        //log (reqstr);
        loadJSONDoc(reqstr)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;

                var ds = new TimeValueDataSet(obj.results);

                //this is the the case of a discrete graph - where the entire test run is always requested
                //so the start and end points are the first and last entries in the returned data set
                if  (!startTime && !endTime)  {
                    startTime = ds.data[0];
                    endTime = ds.data[ds.data.length -2];
                }
                ds.requestedFirstTime = startTime;
                ds.requestedLastTime = endTime;
                self.testData[testId] = ds;
                if (obj.annotations)
                    ds.annotations = new TimeStringDataSet(obj.annotations);
                if (obj.baselines)
                    ds.baselines = obj.baselines;
                if (obj.rawdata)
                    ds.rawdata = obj.rawdata;
                if (obj.stats)
                    ds.stats = obj.stats;
                self.onDataSetAvailable.fire(testId, ds, startTime, endTime);
            },
            function (obj) {alert ("Error talking to " + getdatacgi + " (" + obj + ")"); log (obj.stack); });
    },
};
