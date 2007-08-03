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

var GraphFormModules = [];
var GraphFormModuleCount = 0;

function ExtraDataGraphFormModule(userConfig, userName) {
    GraphFormModuleCount++;
    //log("userName: " + userName);
    //this.__proto__.__proto__.constructor.call(this, "graphForm" + GraphFormModuleCount, userConfig, userName);
    this.init("graphForm" + GraphFormModuleCount, userConfig, userName);
}

ExtraDataGraphFormModule.prototype = {
    __proto__: new YAHOO.widget.Module(),

    imageRoot: "",

    testId: null,
    testIds: null,
    testText: "",
    baseline: false,
    average: false,
    name: "",
    limitDays: null,
    isLimit: null,
    onLoadingDone : new YAHOO.util.CustomEvent("onloadingdone"),
    onLoading : new YAHOO.util.CustomEvent("onloading"),
    addedInitialInfo : new YAHOO.util.CustomEvent("addedinitialinfo"),

    init: function (el, userConfig, userName) {
        var self = this;
        //log("el " + el + " userConfig " + userConfig + " userName " + userName);
        this.__proto__.__proto__.init.call(this, el/*, userConfig*/);
        
        this.cfg = new YAHOO.util.Config(this);
        this.cfg.addProperty("testid", { suppressEvent: true });
        this.cfg.addProperty("average", { suppressEvent: true });
        this.cfg.addProperty("baseline", { suppressEvent: true });

        if (userConfig)
            this.cfg.applyConfig(userConfig, true);

        var form, td, el;
        var tbl;
        var tbl_row;
        var tbl_col;
        tbl = new TABLE({});
        tbl_row = new TR({});
        tbl_col = new TD({colspan: 2});
        appendChildNodes(tbl_col,"Limit selection list by:");
        appendChildNodes(tbl_row, tbl_col);
        tbl_col = new TD({});
        appendChildNodes(tbl_col,"Choose test(s) to graph:");
        appendChildNodes(tbl_row, tbl_col);
        tbl.appendChild(tbl_row);
        
        
        tbl_row = new TR({});

        form = new DIV({ class: "graphform-line" });

        tbl_col = new TD({});
        el = new INPUT({ name: "dataload" + GraphFormModules.length,
                         id: "all-days-radio",
                         type: "radio",
                         checked: 1,
                         onchange: function(event) { self.update(null, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value); } });
        tbl_col.appendChild(el);
        appendChildNodes(tbl_col, "all tests");

        tbl_col.appendChild(new DIV({}));
        el = new INPUT({ name: "dataload" + GraphFormModules.length,
                         type: "radio",
                         onchange: function(event) { self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);} });
        this.isLimit = el;
        tbl_col.appendChild(el);
        appendChildNodes(tbl_col, "previous "); 
        el = new INPUT({ name: "load-days-entry",
                         id: "load-days-entry",
                         type: "text",
                         size: "3",
                         value: "5",
                         onchange: function(event) { if (self.isLimit.checked) {
                                                          self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);} } });
        this.limitDays = el;
        tbl_col.appendChild(el);
        appendChildNodes(tbl_col, " days");

        tbl_row.appendChild(tbl_col);

        tbl_col = new TD({});
        appendChildNodes(tbl_col, "Branch: ");
        appendChildNodes(tbl_col, new BR({}));
        el = new SELECT({ name: "branchname",
                          class: "other",
                          size: 5,
                          onchange: function(event) { if (self.isLimit.checked) {
                                                          self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);}
                                                      else self.update(null, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value); } });
        this.branchSelect = el;
        Tinderbox.requestSearchList(1, null, null, function (list) {
                                                        var opts = [];
                                                        opts.push(new OPTION({value: null, selected: true}, "all"));
                                                        for each (var listvalue in list)  {
                                                            opts.push(new OPTION({ value: listvalue.value}, listvalue.value));
                                                        }
                                                        replaceChildNodes(self.branchSelect, opts);
                                                        });
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);
        tbl_col = new TD({rowspan: 2, colspan: 2}); 
        span = new SPAN({id: "listname"});
        appendChildNodes(tbl_col, span);
        appendChildNodes(tbl_col, new BR({}));
        el = new SELECT({ name: "testname",
                          class: "testname",
                          multiple: true,
                          center: true,
                          size: 20,
                          onchange: function(event) { self.onChangeTest(); } });
        this.testSelect = el;
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);
        tbl.appendChild(tbl_row);
        tbl_row = new TR({});

        tbl_col = new TD({});
        appendChildNodes(tbl_col, "Machine: ");
        appendChildNodes(tbl_col, new BR({}));
        el = new SELECT({ name: "machinename",
                          class: "other",
                          size: 5,
                          onchange: function(event) { if (self.isLimit.checked) {
                                                          self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);}
                                                      else self.update(null, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value); } });
        this.machineSelect = el;
        Tinderbox.requestSearchList(null, 1, null, function (list) {
                                                        var opts = [];
                                                        opts.push(new OPTION({value: null, selected: true}, "all"));
                                                        for each (var listvalue in list)  {
                                                            opts.push(new OPTION({ value: listvalue.value}, listvalue.value));
                                                        }
                                                        replaceChildNodes(self.machineSelect, opts);
                                                        });
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);

        tbl_col = new TD({});
        appendChildNodes(tbl_col, "Test name: ");
        appendChildNodes(tbl_col, new BR({}));
        el = new SELECT({ name: "testtypename",
                          class: "other",
                          size: 5,
                          onchange: function(event) { if (self.isLimit.checked) {
                                                          self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);}
                                                      else self.update(null, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value); } });
        this.testtypeSelect = el;

        var forceTestIds = null;
        this.average = false;
        if (userConfig) {
            forceTestIds = userConfig;
        }
        //log ("userName: " + userName);

        Tinderbox.requestSearchList(null, null, 1, function (list) {
                                                        var opts = [];
                                                        //opts.push(new OPTION({value: null, selected: true}, "all"));
                                                        for each (var listvalue in list)  {
                                                            if ((userName) && (userName == listvalue.value)) {
                                                                opts.push(new OPTION({ value: listvalue.value, selected : true}, listvalue.value));
                                                            }
                                                            else {
                                                                opts.push(new OPTION({ value: listvalue.value}, listvalue.value));
                                                            }
                                                        }
                                                        replaceChildNodes(self.testtypeSelect, opts);
                                                        if (forceTestIds == null) {
                                                            self.testtypeSelect.options[0].selected = true;
                                                            self.update(null, null, null, self.testtypeSelect.value, forceTestIds);
                                                        }
                                                        else {
                                                            self.update(null, null, null, userName, forceTestIds);
                                                        }
                                                        });
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);
/*
        tbl_col = new TD({rowspan: 2, colspan: 2}); 
        el = new SELECT({ name: "testname",
                          class: "testname",
                          multiple: true,
                          size: 20,
                          onchange: function(event) { self.onChangeTest(); } });
        this.testSelect = el;
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);
*/
        tbl.appendChild(tbl_row);
        form.appendChild(tbl);



        this.setBody (form);
/*
        var forceTestIds = null;
        this.average = false;
        if (userConfig) {
            forceTestIds = userConfig;
        }
*/
        //self.update(null, null, null, null, forceTestIds);
        GraphFormModules.push(this);
    },

    getQueryString: function (prefix) {
        var qstring = '';
        ctr = 1;
        for each (var opt in this.testSelect.options) {
          if (opt.selected) {
            prefixed = prefix + ctr; 
            qstring += "&" + prefixed + "tid=" + opt.value + "&" + prefixed + "bl=" + (this.baseline ? "1" : "0")
            + "&" + prefixed + "avg=" + (this.average? "1" : "0");
            ctr++
          }
        }
        return qstring;
    },

   getDumpString: function () {
       var prefix = '';
       var dstring = '';
       for each (var opt in this.testSelect.options) {
         if (opt.selected) {
           dstring += prefix + "setid=" + opt.value;
           prefix = "&";
         }
       }
       return dstring;
   },

    onChangeTest: function (forceTestIds) {
        this.testId = this.testSelect.value;
        //log("setting testId: " + this.testId);
        this.testIds = [];
        for each (var opt in this.testSelect.options) {
            if (opt.selected) {   
              //log("opt: " + opt.value);
              this.testIds.push([opt.value, opt.text]);
            }
        }
        //log("testIDs: " + this.testIds);
        //log(this.testSelect.options[this.testSelect.selectedIndex].text);
        this.testText = this.testSelect.options[this.testSelect.selectedIndex];
        this.addedInitialInfo.fire();
        this.name = this.testtypeSelect.value;
    },

    onBaseLineRadioClick: function () {
        GraphFormModules.forEach(function (g) { g.baseline = false; });
        this.baseline = true;
    },

    remove: function () {
        var nf = [];
        for each (var f in GraphFormModules) {
            if (f != this)
                nf.push(f);
        }
        GraphFormModules = nf;
        this.destroy();
    },
    
    update: function (limitD, branch, machine, testname, forceTestIds) {
        var self = this;
        this.onLoading.fire("updating test list");
        //log ("attempting to update graphformmodule, forceTestIds " + forceTestIds);
        Tinderbox.requestTestList(limitD, branch, machine, testname, function (tests) {
                                      var opts = [];
                                      var branch_opts = [];
                                      if (tests == '') {
                                        log("empty test list"); 
                                        self.onLoadingDone.fire();
                                        replaceChildNodes(self.testSelect, null);
                                        btn = getElement("graphbutton");
                                        btn.disabled = true;
                                        return;
                                      }
                                      // let's sort by machine name
                                      var sortedTests = Array.sort(tests, function (a, b) {
                                                                       if (a.machine < b.machine) return -1;
                                                                       if (a.machine > b.machine) return 1;
                                                                       if (a.test < b.test) return -1;
                                                                       if (a.test > b.test) return 1;
                                                                       if (a.test_type < b.test_type) return -1;
                                                                       if (a.test_type > b.test_type) return 1;
                                                                       if (a.data < b.data) return -1;
                                                                       if (a.data > b.data) return 1;
                                                                       return 0;
                                                                   });

                                      for each (var test in sortedTests) {
                                          var s1 = test.data;
                                          var padstr = "--------------------";
                                          var tstr = "" + //test.test + padstr.substr(0, 20-test.test.length) + 
                                              test.branch.toString() + padstr.substr(0, 6-test.branch.toString().length) + 
                                              "-" + test.machine + padstr.substr(0, 10-test.machine.length) + 
                                              "-" + s1;
                                          startSelected = false;
                                          if (forceTestIds != null) { 
                                            if ((forceTestIds == test.id) || (forceTestIds.indexOf(Number(test.id)) > -1)) {
                                              startSelected = true;
                                            }
                                          } 
                                          if (startSelected) {
                                              //log("starting with an initial selection");
                                              opts.push(new OPTION({ value: test.id + "_" + test.data, selected: true}, tstr));
                                          }
                                          else {
                                              opts.push(new OPTION({ value: test.id + "_" + test.data}, tstr));
                                          }
                                      }
                                      replaceChildNodes(self.testSelect, opts);

                                      if (forceTestIds == null) {
                                          self.testSelect.options[0].selected = true;
                                          //self.testSelect.value = sortedTests[0].id;
                                      }
                                      replaceChildNodes("listname", null);
                                      appendChildNodes("listname","Select from " + testname + ":");
                                      btn = getElement("graphbutton");
                                      btn.disabled = false;
                                      setTimeout(function () { self.onChangeTest(forceTestIds); }, 0);
                                      self.onLoadingDone.fire();
                                  });
    },


};

