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

function DiscreteGraphFormModule(userConfig) {
    GraphFormModuleCount++;
    this.__proto__.__proto__.constructor.call(this, "graphForm" + GraphFormModuleCount, userConfig);
}

DiscreteGraphFormModule.prototype = {
    __proto__: new YAHOO.widget.Module(),

    imageRoot: "",

    testId: null,
    testText: "",
    baseline: false,
    average: false,
    color: "#000000",
    limitDays: null,
    isLimit: null,

    init: function (el, userConfig) {
        var self = this;

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

        form = new DIV({ class: "graphform-line" });

        tbl_col = new TD({}); 
        el = new IMG({ src: "js/img/minus.png", class: "plusminus",
                       onclick: function(event) { self.remove(); } });
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);

        tbl_col = new TD({}); 
        el = new DIV({ id: "whee", style: "display: inline; border: 1px solid black; height: 15; " +
                              "padding-right: 15; vertical-align: middle; margin: 3px;" });
        this.colorDiv = el;
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);

        tbl_col = new TD({}); 
        el = new SELECT({ name: "testname",
                          class: "testname",
                          onchange: function(event) { self.onChangeTest(); } });
        this.testSelect = el;
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);

        tbl_col = new TD({}); 
        appendChildNodes(tbl_col, "List: ")
        tbl_row.appendChild(tbl_col);

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
        tbl.appendChild(tbl_row);

        tbl_col = new TD({});
        appendChildNodes(tbl_col, "Branch: ");
        el = new SELECT({ name: "branchname",
                          class: "other",
                          onchange: function(event) { if (self.isLimit.checked) {
                                                          self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);}
                                                      else self.update(null, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value); } });
        this.branchSelect = el;
        Tinderbox.requestSearchList(1, null, null, function (list) {
                                                        var opts = [];
                                                        opts.push(new OPTION({value: null}, "all"));
                                                        for each (var listvalue in list)  {
                                                            opts.push(new OPTION({ value: listvalue.value}, listvalue.value));
                                                        }
                                                        replaceChildNodes(self.branchSelect, opts);
                                                        });
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);

        tbl_col = new TD({});
        appendChildNodes(tbl_col, "Machine: ");
        el = new SELECT({ name: "machinename",
                          class: "other",
                          onchange: function(event) { if (self.isLimit.checked) {
                                                          self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);}
                                                      else self.update(null, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value); } });
        this.machineSelect = el;
        Tinderbox.requestSearchList(null, 1, null, function (list) {
                                                        var opts = [];
                                                        opts.push(new OPTION({value: null}, "all"));
                                                        for each (var listvalue in list)  {
                                                            opts.push(new OPTION({ value: listvalue.value}, listvalue.value));
                                                        }
                                                        replaceChildNodes(self.machineSelect, opts);
                                                        });
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);

        tbl_col = new TD({});
        appendChildNodes(tbl_col, "Test name: ");
        el = new SELECT({ name: "testtypename",
                          class: "other",
                          onchange: function(event) { if (self.isLimit.checked) {
                                                          self.update(self.limitDays.value, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value);}
                                                      else self.update(null, self.branchSelect.value, self.machineSelect.value, self.testtypeSelect.value); } });
        this.testtypeSelect = el;
        Tinderbox.requestSearchList(null, null, 1, function (list) {
                                                        var opts = [];
                                                        opts.push(new OPTION({value: null}, "all"));
                                                        for each (var listvalue in list)  {
                                                            opts.push(new OPTION({ value: listvalue.value}, listvalue.value));
                                                        }
                                                        replaceChildNodes(self.testtypeSelect, opts);
                                                        });
        tbl_col.appendChild(el);
        tbl_row.appendChild(tbl_col);

        form.appendChild(tbl);

        this.setBody (form);

        var forceTestId = null;
        this.average = false;
        if (userConfig) {
            forceTestId = this.cfg.getProperty("testid");
            /*
            avg = this.cfg.getProperty("average");
            baseline = this.cfg.getProperty("baseline");
            if (avg == 1) {
                this.averageCheckbox.checked = true;
                this.average = true;
            }
            if (baseline == 1)
                this.onBaseLineRadioClick();
            */
        }

        self.update(null, null, null, null, forceTestId);
        GraphFormModules.push(this);
    },

    getQueryString: function (prefix) {
        return prefix + "tid=" + this.testId + "&" + prefix + "bl=" + (this.baseline ? "1" : "0")
            + "&" + prefix + "avg=" + (this.average? "1" : "0");
    },

    onChangeTest: function (forceTestId) {
        this.testId = this.testSelect.value;
        //log("setting testId: " + this.testId);
        //log(this.testSelect.options[this.testSelect.selectedIndex].text);
        this.testText = this.testSelect.options[this.testSelect.selectedIndex];
    },

    onBaseLineRadioClick: function () {
        GraphFormModules.forEach(function (g) { g.baseline = false; });
        this.baseline = true;
    },

    setColor: function (newcolor) {
        this.color = newcolor;
        this.colorDiv.style.backgroundColor = colorToRgbString(newcolor);
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
    
    update: function (limitD, branch, machine, testname, forceTestId) {
        var self = this;
        //log ("attempting to update graphformmodule, forceTestId " + forceTestId);
        Tinderbox.requestTestList(limitD, branch, machine, testname, function (tests) {
                                      var opts = [];
                                      var branch_opts = [];
                                      // let's sort by machine name
                                      var sortedTests = Array.sort(tests, function (a, b) {
                                                                       if (a.machine < b.machine) return -1;
                                                                       if (a.machine > b.machine) return 1;
                                                                       if (a.test < b.test) return -1;
                                                                       if (a.test > b.test) return 1;
                                                                       if (a.test_type < b.test_type) return -1;
                                                                       if (a.test_type > b.test_type) return 1;
                                                                       return 0;
                                                                   });

                                      for each (var test in sortedTests) {
                                          var d = new Date(test.date*1000);
                                          var s1 = d.getHours() + (d.getMinutes() < 10 ? ":0" : ":") + d.getMinutes() +
                                                                  (d.getSeconds() < 10 ? ":0" : ":") + d.getSeconds() +
                                                                  " " + (d.getDate() < 10 ? "0" : "") + d.getDate();
                                          s1 +=  " " + MONTH_ABBREV[d.getMonth()] + " " + (d.getYear() + 1900);
                                          var padstr = "--------------------";
                                          var tstr = test.test + padstr.substr(0, 20-test.test.length) + 
                                              "-" + test.branch.toString() + padstr.substr(0, 7-test.branch.toString().length) + 
                                              "-" + test.machine + padstr.substr(0, 20-test.machine.length) + 
                                              "-" + s1;
                                          opts.push(new OPTION({ value: test.id }, tstr));
                                      }
                                      replaceChildNodes(self.testSelect, opts);
                                      self.testSelect.options[0].selected = true;

                                      if (forceTestId != null) {
                                          self.testSelect.value = forceTestId;
                                      } else {
                                          self.testSelect.value = sortedTests[0].id;
                                      }
                                      setTimeout(function () { self.onChangeTest(forceTestId); }, 0);
                                  });
    },


};

