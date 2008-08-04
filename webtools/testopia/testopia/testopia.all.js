/*
 * JavaScript file created by Rockstarapps Concatenation
*/

/*
 * START OF FILE - /bnc-3.0/testopia/js/strings.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 * 
 */

ATTACHMENT_DELETE_WARNING = 'You are about to remove the selected attachments. This cannot be undone. Continue?';
CASE_CATEGORY_DELETE_WARNING = 'You are about to delete the selected test case category.  Are you sure you want to continue?';
CASE_DELETE_WARNING = 'You are about to delete the selected test cases including all children and history. This action cannot be undone. Are you sure you want to continue?';
PLAN_DELETE_WARNING = 'You are about to delete the selected test plans including all children and history. This action cannot be undone. Are you sure you want to continue?';
RUN_DELETE_WARNING = 'You are about to delete the selected test runs including all children and history. This action cannot be undone. Are you sure you want to continue?';
CASERUN_DELETE_WARNING = 'You are about to remove the selected test cases from this run including all history. This action cannot be undone. Are you sure you want to continue?';
ENVIRONMENT_DELETE_WARNING = 'You are about to delete the selected test environment including associated test case data. This action cannot be undone. Are you sure you want to continue?';
/*
 * END OF FILE - /bnc-3.0/testopia/js/strings.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/util.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

Ext.state.Manager.setProvider(new Ext.state.CookieProvider({expires: new Date(new Date().getTime()+(1000*60*60*24*30))}));
Ext.data.Connection.timeout = 120000;
Ext.Updater.defaults.timeout = 120000;
Ext.Ajax.timeout = 120000;

var Testopia = {};

Testopia.Util = {};
Testopia.Environment = {};

//check column widget
Ext.grid.CheckColumn = function(config){
    Ext.apply(this, config);
    if(!this.id){
        this.id = Ext.id();
    }
    this.renderer = this.renderer.createDelegate(this);
};

Ext.grid.CheckColumn.prototype = {
    init : function(grid){
        this.grid = grid;
        this.grid.on('render', function(){
            var view = this.grid.getView();
            view.mainBody.on('mousedown', this.onMouseDown, this);
        }, this);
    },

    onMouseDown : function(e, t){
        if(t.className && t.className.indexOf('x-grid3-cc-'+this.id) != -1){
            e.stopEvent();
            var index = this.grid.getView().findRowIndex(t);
            var record = this.grid.store.getAt(index);
            record.set(this.dataIndex, !record.data[this.dataIndex]);
        }
    },

    renderer : function(v, p, record){
        p.css += ' x-grid3-check-col-td'; 
        return '<div class="x-grid3-check-col'+(v == '1' ?'-on':'')+' x-grid3-cc-'+this.id+'">&#160;</div>';
    }
};

TestopiaUtil = function(){
    this.statusIcon =  function (name){
        return '<img src="testopia/img/' + name + '_small.gif" alt="'+ name +'" title="'+ name +'">';
    };
    this.caseLink = function(id,m,r,ri,ci,s){
        if (s.isTreport === true)
            return '<a href="tr_show_case.cgi?case_id=' + id + '" target="_blank">' + id +'</a>';
        return '<a href="tr_show_case.cgi?case_id=' + id +'">' + id +'</a>';
    };
    this.runLink = function(id,m,r,ri,ci,s){
        if (s.isTreport === true)
            return '<a href="tr_show_run.cgi?run_id=' + id +'" target="_blank">' + id +'</a>';
        return '<a href="tr_show_run.cgi?run_id=' + id +'">' + id +'</a>';
    };
    this.planLink = function(id,m,r,ri,ci,s){
        if (s.isTreport === true)
            return '<a href="tr_show_plan.cgi?plan_id=' + id +'" target="_blank">' + id +'</a>';
        return '<a href="tr_show_plan.cgi?plan_id=' + id +'">' + id +'</a>';
    };
    this.bugLink = function(id,m,r,ri,ci,s){
        if (s.isTreport === true)
            return '<a href="show_bug.cgi?id=' + id +'" target="_blank">' + id +'</a>';
        return '<a href="show_bug.cgi?id=' + id +'">' + id +'</a>';
    };

    this.newRunPopup = function(plan){
        var win = new Ext.Window({
            id: 'newRun-win',
            closable:true,
            width: Ext.getBody().getViewSize().width - 150,
            height: Ext.getBody().getViewSize().height - 150,
            plain: true,
            shadow: false,
            layout: 'fit',
            items: [new NewRunForm(plan)]
        });
        win.show(this);
    };
    
    this.newCaseForm = function (plans, product_id, run_id){
        var win = new Ext.Window({
            id: 'newcase-win',
            closable:true,
            width: Ext.getBody().getViewSize().width - 150,
            height: Ext.getBody().getViewSize().height - 150,
            plain: true,
            shadow: false,
            layout: 'fit',
            items: [new NewCaseForm(plans, product_id, run_id)]
        });
        win.show(this);
    };
    
    this.addCaseToRunPopup = function(run){
        var win = new Ext.Window({
            id: 'add_case_to_run_win',
            closable:true,
            width: Ext.getBody().getViewSize().width - 150,
            height: Ext.getBody().getViewSize().height - 150,
            plain: true,
            shadow: false,
            layout: 'fit',
            items: [new AddCaseToRunForm(run)]
        });
        win.show(this);
    };

    this.newPlanPopup = function(product_id) {
        var win = new Ext.Window({
            id: 'newplan-win',
            closable:true,
            width: 800,
            height: 550,
            plain: true,
            shadow: false,
            layout: 'fit',
            items: [new NewPlanForm()]
        });
        win.show(this);
    };
    addOption = function(selectElement,newOption) {
      try {
        selectElement.add(newOption,null);
      }
      
      catch (e) {
        selectElement.add(newOption,selectElement.length);
      }
    };
    lsearch = function(val, arr){
        if (typeof arr != 'object'){
            if (arr == val)
                return true;
            return false;
        }
        for (var i in arr){
            if (arr[i] == val)
                return true;
        }
        return false;
    };
    this.addOption = addOption;
    var fillSelects = function(data){
      var s = searchToJson(window.location.search);
      for (var i in data.selectTypes){
        if (typeof data.selectTypes[i] != 'function'){
            try{
              document.getElementById(data.selectTypes[i]).options.length = 0;
              for (var j in data[data.selectTypes[i]]){
                if (typeof data[data.selectTypes[i]][j] != 'function'){
                    var newOption = new Option(data[data.selectTypes[i]][j],data[data.selectTypes[i]][j],false, lsearch(data[data.selectTypes[i]][j], s[data.selectTypes[i]]));
                    addOption(document.getElementById(data.selectTypes[i]),newOption);
                }
              }
              document.getElementById(data.selectTypes[i]).disabled = false;
              document.getElementById(data.selectTypes[i])
            }
            catch(err){}
        }
      }
    };
    this.fillSelects = fillSelects;
    this.onProductSelection = function(prod){
        var ids = [];
        for (var i=0; i<prod.options.length; i++){
          if (prod.options[i].selected === true){
            ids.push(prod.options[i].value);
          }
        }
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        var type = prod.id == 'classification' ? 'classification' : 'product';
        form.submit({
            url:     "tr_query.cgi",
            params: { value: ids.join(","), action: "getversions", type: type},
            success:   function(f,a){ 
                fillSelects(a.result.objects);
            },
            failure:   testopiaError
        });
    };

    return this;
};

ProductStore = function(class_id, auto){
    ProductStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'products',
        autoLoad: auto,
        id: 'id',
        baseParams: {action:'getproducts', class_id: class_id},
        fields: [{name:'id',   mapping:'id'},
                 {name:'name', mapping:'name'}]
        });
};
Ext.extend(ProductStore, Ext.data.JsonStore);

BuildStore = function(params, auto){
    params.action = 'list';
    BuildStore.superclass.constructor.call(this,{
        url: 'tr_builds.cgi',
        root: 'builds',
        baseParams: params,
        id: 'build_id',
        autoLoad: auto,
        fields: [
           {name: "id", mapping:"build_id"},
           {name: "name", mapping:"name"},
           {name: "milestone", mapping:"milestone"},
           {name: "description", mapping:"description"},
           {name: "product_id", mapping:"product_id"},
           {name: "isactive", mapping:"isactive"}
        ]
    });
};

Ext.extend(BuildStore, Ext.data.JsonStore);

CaseCategoryStore = function(params, auto){
    params.action = 'list';
    CaseCategoryStore.superclass.constructor.call(this,{
        url: 'tr_categories.cgi',
        root: 'categories',
        baseParams: params,
        id: 'category_id',
        autoLoad: auto,
        fields: [
           {name: "category_id", mapping:"category_id"},
           {name: "name", mapping:"name"},
           {name: "description", mapping:"description"}
        ]
    });
};
Ext.extend(CaseCategoryStore, Ext.data.JsonStore);

ComponentStore = function(params, auto){
    params.action = 'getcomponents';
    ComponentStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'components',
        baseParams: params,
        autoLoad: auto,
        id: 'id',
        fields: [
            {name:'id',   mapping: 'id'},
            {name:'name', mapping:'name'},
            {name:'qa',   mapping:'qa_contact'}
        ]
    });
};
Ext.extend(ComponentStore, Ext.data.JsonStore);

ProductVersionStore = function(params, auto){
    params.action = 'getversions';
    ProductVersionStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'versions',
        baseParams: params,
        autoLoad: auto,
        id: 'id',
        fields: [
            {name:'id',   mapping: 'id'},
            {name:'name', mapping:'name'}
        ]
    });
};
Ext.extend(ProductVersionStore, Ext.data.JsonStore);

MilestoneStore = function(params, auto){
    params.action = 'getmilestones';
    MilestoneStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'milestones',
        autoLoad: auto,
        baseParams: params,
        id: 'id',
        fields: [
            {name:'id',   mapping: 'id'},
            {name:'name', mapping:'name'}
        ]
    });
};
Ext.extend(MilestoneStore, Ext.data.JsonStore);

PriorityStore = function(auto){
    PriorityStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'priorities',
        baseParams: {action: 'getpriorities'},
        autoLoad: auto,
        id: 'id',
        fields: [
            {name:'id',   mapping: 'id'},
            {name:'name', mapping:'name'}
        ]
    });
};
Ext.extend(PriorityStore, Ext.data.JsonStore);

CaseStatusStore = function(auto){
    CaseStatusStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'statuses',
        baseParams: {action: 'getcasestatus'},
        autoLoad: auto,
        id: 'id',
        fields: [
            {name:'id',   mapping: 'id'},
            {name:'name', mapping:'name'}
        ]
    });
};
Ext.extend(CaseStatusStore, Ext.data.JsonStore);

CaseRunStatusStore = function(auto){
    CaseRunStatusStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'statuses',
        baseParams: {action: 'getcaserunstatus'},
        autoLoad: auto,
        id: 'id',
        fields: [
            {name:'id',   mapping: 'id'},
            {name:'name', mapping:'name'}
        ]
    });
};
Ext.extend(CaseRunStatusStore, Ext.data.JsonStore);

PlanTypesStore = function(auto){
    PlanTypesStore.superclass.constructor.call(this,{
        url: 'tr_quicksearch.cgi',
        root: 'types',
        baseParams: {action: 'getplantypes'},
        autoLoad: auto,
        id: 'id',
        fields: [
            {name:'id',   mapping: 'id'},
            {name:'name', mapping:'name'}
        ]
    });
};
Ext.extend(PlanTypesStore, Ext.data.JsonStore);

EnvironmentStore = function(params, auto){
    params.ctype = 'json';
    EnvironmentStore.superclass.constructor.call(this,{
        url: 'tr_list_environments.cgi',
        root: 'Result',
        baseParams: params,
        totalProperty: 'totalResultsAvailable',
        autoLoad: auto,
        id: 'environment_id',
        fields: [
           {name: "environment_id", mapping:"environment_id"},
           {name: "name", mapping:"name"},
           {name: "run_count", mapping: "run_count"},
           {name: "isactive", mapping:"isactive"}
        ],
        remoteSort: true
    });
    this.paramNames.sort = "order";
};
Ext.extend(EnvironmentStore, Ext.data.JsonStore);

TestPlanStore = function(params, auto){
    params.ctype = 'json';
    TestPlanStore.superclass.constructor.call(this,{
        url: 'tr_list_plans.cgi',
        baseParams: params,
        totalProperty: 'totalResultsAvailable',
        root: 'Result',
        autoLoad: auto,
        id: 'plan_id',
        fields: [
           {name: "plan_id", mapping:"plan_id"},
           {name: "name", mapping:"name"},
           {name: "author", mapping:"author_name"},
           {name: "creation_date", mapping:"creation_date"},
           {name: "product", mapping:"product_name"},
           {name: "product_id", mapping:"product_id"},
           {name: "default_product_version", mapping:"default_product_version"},
           {name: "plan_type", mapping:"plan_type"},
           {name: "case_count", mapping:"case_count"},
           {name: "run_count", mapping:"run_count"}
        ],
        remoteSort: true
    });
    
    this.paramNames.sort = "order";
};
Ext.extend(TestPlanStore, Ext.data.JsonStore);

TestCaseStore = function(params, auto){
    TestCaseStore.superclass.constructor.call(this,{
        url: 'tr_list_cases.cgi',
        baseParams: params,
        totalProperty: 'totalResultsAvailable',
        root: 'Result',
        autoLoad: auto,
        id: 'case_id',
        fields: [
           {name: "case_id", mapping:"case_id"},
           {name: "plan_id", mapping: "plan_id"},
           {name: "alias", mapping:"alias"},
           {name: "case_summary", mapping:"summary"},
           {name: "author", mapping:"author_name"},
           {name: "tester", mapping:"default_tester"},
           {name: "creation_date", mapping:"creation_date"},
           {name: "category", mapping:"category_name"},
           {name: "priority", mapping:"priority"},
           {name: "status", mapping:"status"},
           {name: "run_count", mapping:"run_count"},
           {name: "requirement", mapping:"requirement"},
           {name: "isautomated", mapping:"isautomated"}

        ],
        remoteSort: true
    });
        
};
Ext.extend(TestCaseStore, Ext.data.JsonStore);

/*
 * button_16x_tmpl - template for all Testopia toolbar buttons.
 * This Template is for a 16x16 px icon.
 */
button_16x_tmpl = new Ext.Template('<table border="0" cellpadding="0" cellspacing="0" class="x-btn-wrap" style="width: 20px;"><tbody><tr>',
                                   '<td class="x-btn-left"><i>&#160;</i></td><td class="x-btn-center"><em unselectable="on"><button class="x-btn-text" type="{1}">{0}</button></em></td><td class="x-btn-right"><i>&#160;</i></td>',
                                   '</tr></tbody></table>');

/*
 * UserLookup - This generates a typeahead lookup for usernames.
 * It can be used anywhere in Testopia. Extends Ext ComboBox
 */
UserLookup = function(cfg){
    UserLookup.superclass.constructor.call(this,{
        id: cfg.id || 'user_lookup',
        store: new Ext.data.JsonStore({
            url: 'tr_quicksearch.cgi',
            baseParams: {action: 'getuser'},
            root: 'users',
            totalProperty: 'total',
            id: 'login',
            fields: [
                {name: 'login', mapping: 'id'},
                {name: 'name', mapping: 'name'}
            ]
        }),
        queryParam: 'search',
        loadingText: 'Looking up users...',
        displayField: 'name',
        valueField: 'login',
        typeAhead: true,
        hideTrigger: true,
        minListWidth: 300,
        forceSelection: false,
        emptyText: 'Type a username...',
        pageSize: 20,
        tpl: '<tpl for="."><div class="x-combo-list-item"><table><tr><td>{name}</td></tr><tr><td><b>{login}</td></tr></table></div></tpl>'
    });
    Ext.apply(this, cfg);
};
Ext.extend(UserLookup, Ext.form.ComboBox);

/*
 * TagLookup - This generates a typeahead lookup for Tagnames.
 * It can be used anywhere in Testopia. Extends Ext ComboBox
 */
TagLookup = function(cfg){
    TagLookup.superclass.constructor.call(this,{
        id: cfg.id || 'tag_lookup',
        store: new Ext.data.JsonStore({
            url: 'tr_quicksearch.cgi',
            baseParams: {action: 'gettag'},
            root: 'tags',
            totalProperty: 'total',
            fields: [
                {name: 'id', mapping: 'tag_id'},
                {name: 'name', mapping: 'tag_name'}
            ]
        }),
        queryParam: 'search',
        loadingText: 'Looking up tags...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: false,
        hiddenName: 'tag',
        hideTrigger: true,
        minListWidth: 300,
        minChars: 2,
        width: 150,
        editable: true,
        forceSelection: false,
        emptyText: 'Type a tagname...',
        listeners: {'specialkey': function(f,e){
            if(e.getKey() == e.ENTER){
                Ext.getCmp('tag_add_btn').fireEvent('click');
            }
        }}
    });
    Ext.apply(this, cfg);
};
Ext.extend(TagLookup, Ext.form.ComboBox);

/*
 * BuildCombo
 */
BuildCombo = function(cfg){
    BuildCombo.superclass.constructor.call(this,{
        id: cfg.id || 'build_combo',
        store: cfg.transform ? false : new BuildStore(cfg.params, cfg.mode == 'local'? true : false),
        loadingText: 'Looking up builds...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Builds...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(BuildCombo, Ext.form.ComboBox);

/*
 * CaseCategoryCombo
 */
CaseCategoryCombo = function(cfg){
    CaseCategoryCombo.superclass.constructor.call(this,{
        id: cfg.id || 'case_category_combo',
        store: cfg.transform ? false : new CaseCategoryStore(cfg.params, cfg.mode == 'local'? true : false),
        loadingText: 'Looking up categories...',
        displayField: 'name',
        valueField: 'category_id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(CaseCategoryCombo, Ext.form.ComboBox);

/*
 * EnvironmentCombo
 */
EnvironmentCombo = function(cfg){
    if (cfg.params) {
        cfg.params.viewall = 1;
    }
    EnvironmentCombo.superclass.constructor.call(this,{
        id: cfg.id || 'environment_combo',
        store: cfg.transform ? false : new EnvironmentStore(cfg.params, cfg.mode == 'local'? true : false),
        loadingText: 'Looking up environments...',
        displayField: 'name',
        valueField: 'environment_id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Environments...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(EnvironmentCombo, Ext.form.ComboBox);

/*
 * ProductCombo
 */
ProductCombo = function(cfg){
    ProductCombo.superclass.constructor.call(this,{
        id: cfg.id || 'product_combo',
        store: cfg.transform ? false : new ProductStore(cfg.params, cfg.mode == 'local'? true : false),
        loadingText: 'Looking up products...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(ProductCombo, Ext.form.ComboBox);

/*
 * ProductVersionCombo
 */
ProductVersionCombo = function(cfg){
    ProductVersionCombo.superclass.constructor.call(this,{
        id: cfg.id || 'product_version_combo',
        store: cfg.transform ? false : new ProductVersionStore(cfg.params, cfg.mode == 'local'? true : false),
        loadingText: 'Looking up versions...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(ProductVersionCombo, Ext.form.ComboBox);

/*
 * CaseRunStatusCombo
 */
CaseRunStatusCombo = function(cfg){
    CaseRunStatusCombo.superclass.constructor.call(this,{
        id: cfg.id || 'case_run_status_combo',
        store: cfg.transform ? false : new CaseRunStatusStore(cfg.mode == 'local'? true : false),
        loadingText: 'Looking up statuses...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(CaseRunStatusCombo, Ext.form.ComboBox);

/*
 * CaseStatusCombo
 */
CaseStatusCombo = function(cfg){
    CaseStatusCombo.superclass.constructor.call(this,{
        id: cfg.id || 'case_status_combo',
        store: cfg.transform ? false : new CaseStatusStore(cfg.mode == 'local'? true : false),
        loadingText: 'Looking up statuses...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 100,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(CaseStatusCombo, Ext.form.ComboBox);

/*
 * ComponentCombo
 */
ComponentCombo = function(cfg){
    ComponentCombo.superclass.constructor.call(this,{
        id: cfg.id || 'component_combo',
        store: cfg.transform ? false : new ComponentStore(cfg.params, cfg.mode == 'local'? true : false),
        loadingText: 'Looking up Components...',
        displayField: 'name',
        valueField: 'id',
        editable: false,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(ComponentCombo, Ext.form.ComboBox);

/*
 * MilestoneCombo
 */
MilestoneCombo = function(cfg){
    MilestoneCombo.superclass.constructor.call(this,{
        id: cfg.id || 'milestone_combo',
        store: cfg.transform ? false : new MilestoneStore(cfg.params, cfg.mode == 'local'? true : false),
        loadingText: 'Looking up milestones...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(MilestoneCombo, Ext.form.ComboBox);

/*
 * PlanTypesCombo
 */
PlanTypesCombo = function(cfg){
    PlanTypesCombo.superclass.constructor.call(this,{
        id: cfg.id || 'plan_type_combo',
        store: cfg.transform ? false : new PlanTypesStore(cfg.mode == 'local'? true : false),
        loadingText: 'Looking up types...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(PlanTypesCombo, Ext.form.ComboBox);

/*
 * PriorityCombo
 */
PriorityCombo = function(cfg){
    PriorityCombo.superclass.constructor.call(this,{
        id: cfg.id || 'priority_combo',
        store: cfg.transform ? false : new PriorityStore(cfg.mode == 'local'? true : false),
        loadingText: 'Looking up priorities...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 100,
        forceSelection: true,
        transform: cfg.transform,
        emptyText: 'Please select...'
    });
    Ext.apply(this, cfg);
    this.store.on('load', function(){
      if (cfg.value){
        this.setValue(cfg.value);
      }
    }, this);
};
Ext.extend(PriorityCombo, Ext.form.ComboBox);

/*
 * RunProgress - Create a multicolored version of the Ext ProgressBar.
 */
RunProgress = function(cfg){
    RunProgress.superclass.constructor.call(this, cfg);
};
Ext.extend(RunProgress, Ext.ProgressBar,{
    onRender : function(ct, position){
        Ext.ProgressBar.superclass.onRender.call(this, ct, position);

        var tpl = new Ext.Template(
            '<div class="{cls}-wrap">',
                '<div style="position:relative">',
                    '<div class="{cls}-bar-green"></div>',
                    '<div class="{cls}-bar-red"></div>',
                    '<div class="{cls}-bar-orange"></div>',
                    '<div class="{cls}-text-main" style="font-weight: bold">',
                        '<div>&#160;</div>',
                    '</div>',
                    '<div class="{cls}-text-main {cls}-text-back-main" style="font-weight: bold">',
                        '<div>&#160;</div>',
                    '</div>',
                '</div>',
            '</div>'
        );

        if(position){
            this.el = tpl.insertBefore(position, {cls: this.baseCls}, true);
        }else{
            this.el = tpl.append(ct, {cls: this.baseCls}, true);
        }
        if(this.id){
            this.el.dom.id = this.id;
        }
        this.progressBar = Ext.get(this.el.dom.firstChild);
        this.gbar = Ext.get(this.progressBar.dom.firstChild);
        this.rbar = Ext.get(this.gbar.dom.nextSibling);
        this.obar = Ext.get(this.rbar.dom.nextSibling);
        
        if(this.textEl){
            //use an external text el
            this.textEl = Ext.get(this.textEl);
            delete this.textTopEl;
        }else{
            //setup our internal layered text els
            this.textTopEl = Ext.get(this.progressBar.dom.childNodes[3]);
            var textBackEl = Ext.get(this.progressBar.dom.childNodes[4]);
            this.textTopEl.setStyle("z-index", 99).addClass('x-hidden');
            this.textEl = new Ext.CompositeElement([this.textTopEl.dom.firstChild, textBackEl.dom.firstChild]);
            this.textEl.setWidth(this.progressBar.offsetWidth);
        }
        if(this.gvalue || this.rvalue || this.ovalue){
            this.updateProgress(this.gvalue, this.rvalue, this.ovalue, this.text);
        }else{
            this.updateText(this.text);
        }
        this.setSize(this.width || 'auto', 'auto');
        this.progressBar.setHeight(this.progressBar.offsetHeight);
    },
    updateProgress : function(gvalue, rvalue, ovalue, text){
        this.gvalue = gvalue || 0;
        this.rvalue = rvalue || 0;
        this.ovalue = ovalue || 0;
        if(text){
            this.updateText(text);
        }
        var gw = Math.floor(gvalue*this.el.dom.firstChild.offsetWidth);
        var rw = Math.floor(rvalue*this.el.dom.firstChild.offsetWidth);
        var ow = Math.floor(ovalue*this.el.dom.firstChild.offsetWidth);
        this.gbar.setWidth(gw);
        this.rbar.setWidth(rw);
        this.obar.setWidth(ow);

        return this;
    },
    setSize : function(w, h){
        Ext.ProgressBar.superclass.setSize.call(this, w, h);
        if(this.textTopEl){
            this.textEl.setSize(this.el.dom.offsetWidth, this.el.dom.offsetHeight);
        }
        return this;
    }
});

DocCompareToolbar = function(object, id){
    var store = new Ext.data.JsonStore({
        url: 'tr_history.cgi',
        baseParams: {action: 'getdocversions', object: object, object_id: id},
        root: 'list',
        fields: [
            {name: 'id', mapping: 'id'},
            {name: 'name', mapping: 'name'}
        ]
    });
    this.toolbar = new Ext.Toolbar({
        id: 'doc_compare_tbar',
        items: [
//            new Ext.form.ComboBox({
//                id: 'doc_compare_v1',
//                store: store,
//                displayField: 'name',
//                valueField: 'id',
//                width: 50,
//                mode: 'local',
//                triggerAction: 'all'
//            }),
//            new Ext.form.ComboBox({
//                id: 'doc_compare_v2',
//                store: store,
//                displayField: 'name',
//                valueField: 'id',
//                width: 50,
//                mode: 'local',
//                triggerAction: 'all'
//            }),{
//                xtype: 'button',
//                id: 'doc_compare_btn',
//                text: 'Compare',
//                handler: function(){
//                    
//                }
//            },
//            new Ext.Toolbar.Spacer(),
//            new Ext.Toolbar.Separator(),
            new Ext.Toolbar.Fill(),
            new Ext.form.ComboBox({
                id: 'doc_view',
                store: store,
                displayField: 'name',
                valueField: 'id',
                width: 50,
                triggerAction: 'all'
            }),
            {
                xtype: 'button',
                id: 'doc_view_btn',
                text: 'View Version',
                handler: function(){
                    var tab = Ext.getCmp('object_panel').add({
                        title: 'Version ' + Ext.getCmp('doc_view').getValue(),
                        closable: true,
                        autoScroll: true
                    });
                    tab.show();
                    tab.load({
                        url: 'tr_history.cgi',
                        params: {action: 'showdoc', object: object, object_id: id, version: Ext.getCmp('doc_view').getValue()},
                        failure: testopiaError
                    });
                }
            }
        ]
    });

    return this.toolbar;
};
/*
 * HistoryGrid - 
 */
HistoryGrid = function(object, id){
    this.store = new Ext.data.JsonStore({
        url: 'tr_history.cgi',
        baseParams: {action: 'show', object: object, object_id: id},
        root: 'list',
        fields: [
           {name: "what", mapping:"what"},
           {name: "who", mapping:"who"},
           {name: "oldvalue", mapping:"oldvalue"},
           {name: "newvalue", mapping:"newvalue"},
           {name: "when", mapping:"changed"}
        ]
    });
    this.columns = [
        {header: "What", width: 150, dataIndex: 'what', sortable: true},
		{header: "Who", width: 180, sortable: true, dataIndex: 'who'},
		{header: "When", width: 150, sortable: true, dataIndex: 'when'},
		{header: "Old", width: 180, sortable: true, dataIndex: 'oldvalue'},		
        {id: 'new', header: "New", width: 180, sortable: true, dataIndex: 'newvalue'}
    ];
    HistoryGrid.superclass.constructor.call(this,{
        title: 'Change History',
        id: 'history-grid',
        layout: 'fit',
        loadMask: {msg:'Loading History...'},
        autoExpandColumn: "new",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false
        })
    });
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};
Ext.extend(HistoryGrid, Ext.grid.GridPanel,{
    onActivate: function(){
        if (!this.store.getCount()){
            this.store.load();
        }
    },
    onContextClick: function(grid, index, e){
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'history-ctx-menu',
                items: [{
                    text: 'Refresh',
                    handler: function(){
                        grid.store.reload();
                    } 
                }]
            });
        }
        e.stopEvent();
        this.menu.showAt(e.getXY());
    }

});

// From JeffHowden at http://extjs.com/forum/showthread.php?t=17532
Ext.override(Ext.form.Field, {
    fireKey : function(e) {
        if(((Ext.isIE && e.type == 'keydown') || e.type == 'keypress') && e.isSpecialKey()) {
            this.fireEvent('specialkey', this, e);
        }
        else {
            this.fireEvent(e.type, this, e);
        }
    }
  , initEvents : function() {
//                this.el.on(Ext.isIE ? "keydown" : "keypress", this.fireKey,  this);
        this.el.on("focus", this.onFocus,  this);
        this.el.on("blur", this.onBlur,  this);
        this.el.on("keydown", this.fireKey, this);
        this.el.on("keypress", this.fireKey, this);
        this.el.on("keyup", this.fireKey, this);

        // reference to original value for reset
        this.originalValue = this.getValue();
    }
});// End Override

var TestopiaPager = function(type, store, cfg){
    if (! cfg){
        cfg = {};
    }
     
    function doUpdate(){
        this.updateInfo();
    }
    function viewallUpdate(){
        this.cursor = 0;
        this.afterTextEl.el.innerHTML = String.format(this.afterPageText, 1);
        this.field.dom.value = 1;
        this.updateInfo();
    }
    var sizer = new Ext.form.ComboBox({
        store: new Ext.data.SimpleStore({
            fields: ['value','name'],
            id: 0,
            data: [[25,25],[50,50],[100,100],[500,500]],
            autoLoad: true
        }),
        id: 'page_sizer',
        mode: 'local',
        displayField: 'name',
        valueField: 'value',
        triggerAction: 'all',
        editable: false,
        width: 50
    });
    
    sizer.on('select', function(c,r,i){
        this.pageSize = r.get('value');
        Ext.state.Manager.set('TESTOPIA_DEFAULT_PAGE_SIZE', r.get('value'));
        store.baseParams.limit = r.get('value');
        store.load({ 
          params: {start: 0},
          callback: doUpdate.createDelegate(this)
        });
    }, this);
    this.sizer = sizer;
    var viewall = new Ext.Button({text: 'View All',enableToggle:true});
    viewall.on('toggle',function(b,p){
        if(p){
            this.pageSize = 0;
            store.load({
                params: {viewall: 1},
                callback: viewallUpdate.createDelegate(this)
            });
        }
        else {
            this.pageSize = sizer.getValue();
            store.load({ 
                params: {start: 0, limit: sizer.getValue()}
            });
        }
    },this);
    var filter = new Ext.form.TextField({
        allowBlank: true,
        id: 'paging_filter',
        selectOnFocus: true
    });

    filter.on('specialkey', function(f,e) { 
        var key = e.getKey();
        if(key == e.ENTER){
            var params = {start: 0, limit: sizer.getValue()};
            var s = this.getValue();
            var term = s.match(/(^.*?):/);
            if (term) {
                term = term[1];
                var q = Testopia.Util.trim(s.substr(s.indexOf(':') + 1, s.length));
                if (term.match(/^start/i)){
                    term = 'start_date';
                }
                if (term.match(/^stop/i)){
                    term = 'stop_date';
                }
                if (term.match(/^manager/i)){
                    term = 'manager';
                }
                switch (term) {
                    case 'status':
                        if (type == 'case'){
                            term = 'case_status';
                        }
                        else if (type == 'caserun'){
                            term = 'case_run_status';
                        }
                        else {
                            term = 'run_status';
                            if (q.match(/running/i) ){
                                q = 0;
                            }
                            else {
                                q = 1;
                            }
                        } 
                        break;
                    case 'tester':
                        term = 'default_tester';
                        break;
                    case 'plan':
                        term = 'plan_id';
                        break;
                    case 'case':
                        term = 'case_id';
                        break;
                    case 'run':
                        term = 'run_id';
                        break;
                    case 'product_version':
                        term = 'default_product_version';
                        break;
                        
                }
                params[term] = q;
                params[term + '_type'] = 'substring';
            }
            else {
                if (type == 'case' || type == 'run') {
                    params.summary = this.getValue();
                    params.summary_type = 'allwordssubst';
                }
                else 
                    if (type == 'caserun') {
                        params.case_summary = this.getValue();
                        params.case_summary_type = 'allwordssubst';
                    }
                    else {
                        params.name = this.getValue();
                        params.name_type = 'allwordssubst';
                    }
            }
            store.load({ 
              params: params
            });
        }
        if((key == e.BACKSPACE || key == e.DELETE) && this.getValue().length === 0){
            store.load({ 
                params: {start: 0, limit: sizer.getValue()}
            });
        }
    });
    sizer.on('render', function(){
        var tt = new Ext.ToolTip({
            target: 'paging_filter',
            title: 'Quick Search Filter',
            hideDelay: '500',
            html: "Enter column and search term separated by ':'<br> <b>Example:</b> priority: P3" 
        });
    });
    TestopiaPager.superclass.constructor.call(this,{
        id: cfg.id || 'testopia_pager',
        pageSize: Ext.state.Manager.get('TESTOPIA_DEFAULT_PAGE_SIZE', 25),
        displayInfo: true,
        displayMsg: 'Displaying test ' + type + 's {0} - {1} of {2}',
        emptyMsg: 'No test ' + type + 's were found',
        store: store,
        items: [
            new Ext.menu.TextItem('Filter: '),
            filter,
            new Ext.Toolbar.Spacer('_'),
            new Ext.Toolbar.Separator(),
            new Ext.menu.TextItem('View '),
            new Ext.Toolbar.Spacer('_'),
            sizer,
            new Ext.Toolbar.Spacer('_'),
            viewall,
            new Ext.Toolbar.Spacer('_'),
            new ToolbarText({ text: '(FILTERED)', hidden: true, id:'filtered_txt', style: 'font-weight:bold;color:red'})
        ]
    });
    this.on('render',this.setPager, this);
    this.cursor = 0;
};
Ext.extend(TestopiaPager, Ext.PagingToolbar,{
    setPager: function(){
        Ext.getCmp('page_sizer').setValue(Ext.state.Manager.get('TESTOPIA_DEFAULT_PAGE_SIZE', 25));
    }
});

var ToolbarText = function(cfg){
    ToolbarText.superclass.constructor.call(this,{
        id: cfg.id,
        text: cfg.text,
        style: cfg.style,
        hidden: cfg.hidden
    });
};
Ext.extend(ToolbarText, Ext.menu.BaseItem, {
    hideOnClick : false,
    itemCls : "x-menu-text",
    onRender : function(){
        var s = document.createElement("span");
        s.className = this.itemCls;
        s.innerHTML = this.text;
        this.el = s;
        Ext.menu.TextItem.superclass.onRender.apply(this, arguments);
    }
});
DashboardPanel = function(){
    DashboardPanel.superclass.constructor.call(this,{
        title: 'Dashboard',
        layout: 'fit',
        id: 'dashboardpanel',
        tbar:[{
            xtype: 'button',
            text: 'Add Custom Panel',
            handler: function(b,e){
                Ext.Msg.prompt('Enter URL', '', function(btn, text){
                    if (btn == 'ok'){
                        var url = text + '&noheader=1';
                        var newPortlet = new Ext.ux.Portlet({
                            title: 'Custom',
                            closable: true,
                            autoScroll: true,
                            tools: PortalTools,
                            url: url
                        });
                        
                        Ext.getCmp('dashboard_leftcol').add(newPortlet);
                        Ext.getCmp('dashboard_leftcol').doLayout();
                		newPortlet.load({
                            url: url,
                            scripts: false
                        });
                    }
                });
            }
        }],
        items:[{
            id:'the_portal',
            xtype: 'portal',
            margins:'35 5 5 0',
            items:[{
                columnWidth: 0.5,
                baseCls:'x-plain',
                bodyStyle:'padding:10px 10px 10px 10px',
                id: 'dashboard_leftcol',
                items: [{
                    title: ' ',
                    hidden: true
                }]
            },{
                columnWidth: 0.5,
                baseCls:'x-plain',
                bodyStyle:'padding:10px 10px 10px 10px',
                id: 'dashboard_rightcol',
                items: [{
                    title: ' ',
                    hidden: true
                }]
            }]
        }]
    });
    this.on('activate',this.onActivate, this);
};
Ext.extend(DashboardPanel, Ext.Panel,{
    onActivate: function(p){
        p.doLayout();
    }
});
TestopiaUpdateMultiple = function(type, params, grid){
    var form = new Ext.form.BasicForm('testopia_helper_frm',{});
    params.ctype = 'json';
    params.action = 'update';
    form.submit({
        url: 'tr_list_' + type + 's.cgi',
        params: params,
        success: function(f,a){
            if (type == 'caserun'){
                Ext.getCmp('run_progress').updateProgress(a.result.passed,a.result.failed,a.result.blocked,a.result.complete);
            }
            TestopiaUtil.notify.msg('Test '+ type + 's updated', 'The selected {0}s were updated successfully', type);
            if (grid.selectedRows){
//                grid.store.baseParams.limit = Ext.getCmp('testopia_pager').pageSize;
                grid.store.baseParams.addcases = grid.selectedRows.join(',');
                Ext.getCmp('filtered_txt').show();
            }
            grid.store.reload({
                callback: function(){
                    if (grid.selectedRows){
                        var sm = grid.getSelectionModel();
                        var sel = [];
                        for (var i=0; i < grid.selectedRows.length; i++){
                            var index = grid.store.find('case_id',grid.selectedRows[i]);
                            if (index >= 0)
                            sel.push(index);
                        }
                        sm.selectRows(sel);
                        if (sm.getCount() < 1){
                            Ext.getCmp('case_details_panel').disable();
                        }
                    }
                }
            });
        },
        failure: function(f,a){
            testopiaError(f,a);
            grid.store.reload({
                callback: function(){
                    if (grid.selectedRows){
                        grid.getSelectionModel().selectRows(grid.selectedRows);
                    }
                }
            });
        }
    });
};

TestopiaComboRenderer = function(v,md,r,ri,ci,s){
    f = this.getColumnModel().getCellEditor(ci,ri).field;
    record = f.store.getById(v);
    if (record) {
        return record.data[f.displayField];
    }
    else {
        return v;
    }        
};

/*
 * testopiaError - global public function for displaying Bugzilla error messages 
 * when ERROR_MODE_AJAX is set. All failure branches of Ext.basicForm submit calls
 * should point here.
 */
testopiaError = function(f,a){
    f.el.unmask();
    var message;
    if (a.response.status && a.response.status != 200){
        message = {
            title: 'System Error!',
            msg: a.response.responseText,
            buttons: Ext.Msg.OK,
            icon: Ext.MessageBox.ERROR,
            minWidth: 400
        };
    }
    else {
        message = {
            title: 'An Error Has Occurred',
            msg: a.result.message,
            buttons: Ext.Msg.OK,
            icon: Ext.MessageBox.ERROR,
            minWidth: 400
        };
    }
    Ext.Msg.show(message);
};

testopiaLoadError = function(){
    Ext.Msg.show({
        title: 'An Error Has Occurred',
        msg: 'There was an error loading the data',
        buttons: Ext.Msg.OK,
        icon: Ext.MessageBox.ERROR
    });
};

getSelectedObjects = function(grid, field) {
    var selections = grid.getSelectionModel().getSelections();
    var arIDs = [];
    var ids;
    for (var i = 0; i < selections.length; i++){
        arIDs.push(selections[i].get(field));
    }
    ids = arIDs.join(',');
    return ids;
};

editFirstSelection = function(grid){
    if (grid.getSelectionModel().getCount() === 0){
        return;
    }
    var cols = grid.getColumnModel();
    var count = grid.getColumnModel().getColumnCount();
    var row = grid.store.indexOf(grid.getSelectionModel().getSelected());
    for (var col=0; col < count - 1; col++){
        if (cols.isCellEditable(col,row)){
            grid.startEditing(row,col);
            return;
        }
    }
};

saveSearch = function(type,params){
    var loc;
    if (type == 'custom'){
        loc = params;
        params = {report: true};
    }
    else{
        if (type == 'caserun'){
            params.current_tab = 'case_run';
        }
        else{
            params.current_tab = type;
        }
        if (params.report == 1){
            loc = 'tr_' + type +'_reports.cgi?';
        }
        else {
            loc = 'tr_list_' + type +'s.cgi?';
        }
        
        loc = loc + jsonToSearch(params,'',['ctype']);
    }
    var form = new Ext.form.BasicForm('testopia_helper_frm',{});
     Ext.Msg.prompt('Save Search As', '', function(btn, text){
        if (btn == 'ok'){
            form.submit({
                url: 'tr_query.cgi',
                params: {action: 'save_query', query_name: text, query_part: loc, type: params.report ? 1 : 0},
                success: function(){
                    if (Ext.getCmp('searches_grid')){
                        Ext.getCmp('searches_grid').store.load();
                    }
                    if (Ext.getCmp('reports_grid')){
                        Ext.getCmp('reports_grid').store.load();
                    }
                },
                failure: testopiaError
            });
        }
    });
};
linkPopup = function(params){
    if (params.current_tab == 'case_run'){
        params.current_tab = 'caserun';
    }
    var file;
    if (params.report == 1){
        file = 'tr_' + params.current_tab +'_reports.cgi';
    }
    else {
        file = 'tr_list_' + params.current_tab +'s.cgi';
    }
    var l = window.location;
    var pathprefix = l.pathname.match(/(.*)[\/\\]([^\/\\]+\.\w+)$/);
    pathprefix = pathprefix[1];

    var win = new Ext.Window({
        width: 300,
        plain: true,
        shadow: false,
        items: [new Ext.form.TextField({
            value: l.protocol + '//' + l.host + pathprefix + '/' + file + '?' + jsonToSearch(params,'',['ctype']),
            width: 287
        })]
    });
    win.show();
};

searchToJson = function(url){
    url = url.replace(/.*\//,'');
    var params = {};
    var loc = url.split('?',2);
    var file = loc[0];
    var search = loc[1] ? loc[1] : file;
    var pairs = search.split('&');

    for(var i=0; i < pairs.length; i++){
        var pair = pairs[i].split('=');
        if (params[pair[0]]){
            if (typeof params[pair[0]] == 'object'){
                params[pair[0]].push(unescape(pair[1]));
            }
            else{
                params[pair[0]] = new Array(params[pair[0]]);
                params[pair[0]].push(unescape(pair[1]));
            }
        }
        else{
            params[pair[0]] = unescape(pair[1]);
        }
    }

    return params;
};

jsonToSearch = function(params, searchStr, drops){
    searchStr = searchStr || '';
    for(var key in params){
        if (drops.indexOf(key) != -1){
            continue;
        }
        if (typeof params[key] == 'object'){
            for(i=0; i<params[key].length; i++){
                searchStr = searchStr + key + '=' + escape(params[key][i]) + '&';
            }
        }
        else{
            searchStr = searchStr + key + '=' + escape(params[key]) + '&';
        }
    }
    if (searchStr.lastIndexOf('&') == searchStr.length - 1){
        searchStr = searchStr.substr(0,searchStr.length - 1);
    }
    return searchStr;
};
/*
 * Testopia.notify - Displays a floating notification area. 
 * Taken from ext/examples/examples.js
 */

TestopiaUtil.notify = function(){
    var msgCt;

    function createBox(t, s){
        return ['<div class="msg">',
                '<div class="x-box-tl"><div class="x-box-tr"><div class="x-box-tc"></div></div></div>',
                '<div class="x-box-ml"><div class="x-box-mr"><div class="x-box-mc"><h3>', t, '</h3>', s, '</div></div></div>',
                '<div class="x-box-bl"><div class="x-box-br"><div class="x-box-bc"></div></div></div>',
                '</div>'].join('');
    }
    return {
        msg : function(title, format){
            if(!msgCt){
                msgCt = Ext.DomHelper.insertFirst(document.getElementById('bugzilla-body'), {id:'msg-div'}, true);
            }
            msgCt.alignTo(document, 't-t');
            var s = String.format.apply(String, Array.prototype.slice.call(arguments, 1));
            var m = Ext.DomHelper.append(msgCt, {html:createBox(title, s)}, true);
            m.slideIn('t').pause(1).ghost("t", {remove:true});
        },

        init : function(){
            return;
        }
    };
}();

Testopia.Util.trim = function(input){
      input = input.replace(/^\s+/g, '');
      input = input.replace(/\s+$/g, '');
      return input;
};

Testopia.Util.PlanSelector = function(product_id, cfg){
    var single = cfg.action.match('case') ? false : true;
    var pg = new PlanGrid({product_id: product_id},{id: 'plan_selector_grid', height:300, single: single});    
    
    var pchooser = new ProductCombo({mode: 'local', value: product_id});
    pchooser.on('select', function(c,r,i){
        pg.store.baseParams = {ctype: 'json', product_id: r.get('id')};
        pg.store.load();
    });

    Testopia.Util.PlanSelector.superclass.constructor.call(this,{
        items: [pg],
        buttons: [{
            text: 'Use Selected',
            handler: function(){
                var loc = cfg.action + '?plan_id=' + getSelectedObjects(pg,'plan_id');
                if (cfg.bug_id){
                    loc = loc + '&bug=' + cfg.bug_id;
                }
                window.location = loc;
            }
        }]
    });
    
    pg.on('render',function(){
    var items = pg.getTopToolbar().items.items;
        for (var i=0; i < items.length; i++){
            items[i].destroy();
        }
        pg.getTopToolbar().add(new Ext.menu.TextItem('Product: '), pchooser);
        pg.getSelectionModel().un('rowselect', pg.getSelectionModel().events['rowselect'].listeners[0].fn);
        pg.getSelectionModel().un('rowdeselect', pg.getSelectionModel().events['rowdeselect'].listeners[0].fn);
        pg.store.load();        
    });
}
Ext.extend(Testopia.Util.PlanSelector, Ext.Panel);

/*
 * END OF FILE - /bnc-3.0/testopia/js/util.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/attachments.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

AttachGrid = function(object){
    function attachlink(id){
        return '<a href="tr_attachment.cgi?attach_id='+ id +'">' + id + '</a>';
    }
    this.object = object;
    this.store = new Ext.data.JsonStore({
        url: 'tr_attachment.cgi',
        root: 'attachment',
        baseParams: {ctype: 'json', action: 'list', object: this.object.type, object_id: this.object.id},
        id: 'attach_id',
        fields: [
           {name: "id", mapping:"attachment_id"},
           {name: "submitter", mapping:"submitter"},
           {name: "caserun_id", mapping:"caserun_id"},
           {name: "name", mapping:"filename"},           //editable
           {name: "timestamp", mapping:"creation_ts"},
           {name: "mimetype", mapping:"mime_type"},      //editable
           {name: "description", mapping:"description"}, //editable
           {name: "isviewable", mapping:"isviewable"},
           {name: "canedit", mapping:"canedit"},
           {name: "candelete", mapping:"candelete"},
           {name: "size", mapping:"datasize"}
        ]
    });
    var ds = this.store;
    this.columns= [
        {id:'attach_id', header: "ID", width: 20, sortable: true, dataIndex: 'id', renderer: attachlink},
        {header: "Created", width:50, sortable:true, dataIndex: 'timestamp', renderer: function(v,md,r){
            if (r.get('caserun_id') && Ext.getCmp('caserun_grid') && Ext.getCmp('caserun_grid').getSelectionModel().getSelected().get('caserun_id') == r.get('caserun_id')){
                return '<b>* ' + v + '</b>'; 
            }
            else {
                return v;
            }
        }},
        {header: "Name", width: 50,editor: new Ext.grid.GridEditor(
             new Ext.form.TextField({})), sortable: true, dataIndex: 'name'},
        {header: "Submitted by", width:50, sortable:true, dataIndex: 'submitter'},
        {header: "Type", width:30,editor: new Ext.grid.GridEditor(
             new Ext.form.TextField({})),sortable: true, dataIndex: 'mimetype' },
        {header: "Description", width: 120, editor: new Ext.grid.GridEditor(
             new Ext.form.TextField({value:'description'})), sortable: true, dataIndex: 'description'},
        {header: "Size", width:50, sortable:true, dataIndex: 'size', renderer: function(v){if (v) return v + ' Bytes';}}
    ];
    
    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
    AttachGrid.superclass.constructor.call(this, {
        title: 'Attachments',
        id: 'attachments_panel',
        loadMask: {msg:'Loading attachments...'},
        autoExpandColumn: "Name",
        autoScroll: true,
        enableColumnHide: true,
        tbar: [new Ext.Toolbar.Fill(),
        {
            xtype: 'button',
            id: 'edit_attachment_btn',
            icon: 'testopia/img/edit.png',
            iconCls: 'img_button_16x',
            disabled: true,
            tooltip: 'Edit Attachments',
            handler: function(){
                editFirstSelection(Ext.getCmp('attachments_panel'));
            }
        },{
            xtype: 'button',
            id: 'add_attachment_btn',
            icon: 'testopia/img/add.png',
            iconCls: 'img_button_16x',
            tooltip: 'Attach a new file',
            handler: this.newAttachment.createDelegate(this)
        },{
            xtype: 'button',
            id: 'delete_attachment_btn',
            icon: 'testopia/img/delete.png',
            iconCls: 'img_button_16x',
            disabled: true,
            tooltip: 'Remove selected attachments',
            handler: this.deleteAttachment.createDelegate(this)
        }],
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false,
            listeners: {'rowselect':function(sm,i,r){
                if (r.get('candelete')){
                    Ext.getCmp('delete_attachment_btn').enable();
                }
                if (r.get('canedit')){
                    Ext.getCmp('edit_attachment_btn').enable();
                }
            },'rowdeselect': function(sm,i,r){
                if (sm.getCount() < 1){
                    Ext.getCmp('delete_attachment_btn').disable();
                    Ext.getCmp('edit_attachment_btn').disable();
                }
            }}
        }),
        viewConfig: {
            forceFit:true
        }
    });
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
    this.on('afteredit', this.onGridEdit, this);
};

Ext.extend(AttachGrid, Ext.grid.EditorGridPanel, {
    onContextClick: function(grid, index, e){
        var sm = this.selectionModel;
        var object = this.object;
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'AttachGrid-ctx-menu',
                items: [{
                    text: "Delete Selected Attachments",
                    id: 'attach_delete_mnu',
                    icon: 'testopia/img/delete.png',
                    iconCls: 'img_button_16x',
                    disabled: true,
                    handler: this.deleteAttachment.createDelegate(this)
                },{
                    text: 'Reload List',
                    handler: function(){
                        grid.store.reload();
                    }
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        if (grid.getSelectionModel().getSelected().get('candelete')){
            Ext.getCmp('attach_delete_mnu').enable();
        }
        else {
            Ext.getCmp('attach_delete_mnu').enable();
        }
        this.menu.showAt(e.getXY());
    },
    onGridEdit: function(gevent){
        var myparams = {action: "edit", ctype: "json", attach_id: this.store.getAt(gevent.row).get('id')};
        var ds = this.store;
        switch(gevent.field){
        case 'name':
            myparams.filename = gevent.value;
            break;
        case 'mime_type':
            myparams.mime_type = gevent.value;
            break;
        case 'description':
            myparams.description = gevent.value;
            break;

        }
        this.form.submit({
            url:"tr_attachment.cgi",
            params: myparams,
            success: function(f,a){
                ds.commitChanges();
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
    },
    newAttachment: function(){
        var form = new NewAttachmentPopup(this.object);
        form.window.show();
    },
    deleteAttachment: function(){
        object = this.object;
        Ext.Msg.show({
           title:'Confirm Delete?',
           msg: ATTACHMENT_DELETE_WARNING,
           buttons: Ext.Msg.YESNO,
           fn: function(btn){
               if (btn == 'yes'){
                   var testopia_form = new Ext.form.BasicForm('testopia_helper_frm');
                   testopia_form.submit({
                       url: 'tr_attachment.cgi',
                       params: {attach_ids: getSelectedObjects(Ext.getCmp('attachments_panel'),'id'), action:'remove', ctype: 'json', object: object.type, object_id: object.id},
                       success: function(){
                           Ext.getCmp('attachments_panel').store.load();
                       },
                       failure: testopiaError
                   });
               }
           },
           animEl: 'delete_attachment_btn',
           icon: Ext.MessageBox.QUESTION
        });
    },
    onActivate: function(event){
        if (this.object.type == 'caserun'){
            this.store.baseParams = {ctype: 'json', action: 'list', object: 'caserun', object_id: Ext.getCmp('caserun_grid').getSelectionModel().getSelected().get('caserun_id')};
            this.store.load();
        }
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

AttachForm = function(){
    var filecount = 1;
    AttachForm.superclass.constructor.call(this,{
        title: "Attachments",
        id: 'attachments_form',
        autoScroll: true,
        items:[{
            layout: 'column',
            items:[{
                columnWidth: 0.5,
                layout: 'form',
                bodyStyle:'padding: 5px 5px 10px 10px',
                id: 'attach_file_col',
                items:[{
                    xtype: 'field',
                    fieldLabel: 'Attachment',
                    inputType: 'file',
                    name: 'file1',
                    width: 300
                }]
            },{
                columnWidth: 0.5,
                id: 'attach_desc_col',
                bodyStyle:'padding: 5px 5px 10px 10px',
                layout: 'form',
                items: [{
                    xtype: 'textfield',
                    fieldLabel: 'Description',
                    name: 'file_desc1',
                    width: 300
                }]
            }]
        }],
            
        buttons: [{
            text: 'Attach Another',
            handler: function(){
                filecount++;
                if (filecount > 4){
                    Ext.Msg.show({
                        msg: 'You may only attach 4 files at a time',
                        title: 'Limit Exceeded',
                        buttons: Ext.Msg.OK,
                        icon: Ext.MessageBox.WARNING
                    });
                    return;
                }
                Ext.getCmp('attach_file_col').add(new Ext.form.Field({
                    fieldLabel: 'Attachment',
                    inputType: 'file',
                    name: 'file' + filecount,
                    width: 300
                }));
                Ext.getCmp('attach_desc_col').add(new Ext.form.Field({
                    fieldLabel: 'Description',
                    name: 'file_desc' + filecount,
                    width: 300
                }));
                Ext.getCmp('attachments_form').doLayout();
            }
        }]
    });
    this.on('activate', this.onActivate, this);
};

Ext.extend(AttachForm, Ext.Panel, {
    onActivate: function(){
        Ext.getCmp('attachments_form').doLayout();
    }
});

NewAttachmentPopup = function(object){
    if (!this.window){
        var win = new Ext.Window({
            id: 'new_attachment_win',
            title: 'Attach a file',
            closable: true,
            width: 400,
            height: 180,
            plain: true,
            shadow: false,
            closable: false,
            layout: 'fit',
            items: [{
                xtype: 'form',
                id: 'new_attach_frm',
                fileUpload: true,
                bodyStyle: 'padding: 10px',
                items:[{
                    xtype: 'textfield',
                    id: 'attach_desc',
                    fieldLabel: 'Description',
                    name: 'description',
                    allowBlank: false
                },{
                    xtype: 'field',
                    id: 'attach_file',
                    inputType: 'file',
                    fieldLabel: 'File',
                    name: 'data',
                    allowBlank: false               
                }]
            }],
            buttons: [{
                text: 'Submit',
                handler: function(){
                    Ext.getCmp('new_attach_frm').getForm().submit({
                        url: 'tr_attachment.cgi',
                        params: {action: 'add' ,  object: object.type, object_id: object.id, ctype: 'json'},
                        success: function(){
                            Ext.getCmp('attachments_panel').store.load();
                            Ext.getCmp('new_attachment_win').close();
                        },
                        failure: testopiaError
                    });
                }
            },{
                text: 'Cancel',
                handler: function(){
                    Ext.getCmp('new_attachment_win').close();
                }
            }]
        });
        this.window = win;
    }
    return this;
};

/*
 * END OF FILE - /bnc-3.0/testopia/js/attachments.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/plan.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

Testopia.TestPlan = {};

Testopia.TestPlan.ImportWin = function(plan_id){
    var win = new Ext.Window({
        id: 'import-win',
        closable: true,
        width: 450,
        height: 150,
        plain: true,
        shadow: false,
        layout: 'fit',
        items: [{
            xtype: 'form',
            height: 250,
            url: 'tr_importer.cgi',
            id: 'importform',
            baseParams: {action: 'upload', ctype: 'json', plan_id: plan_id},
            fileUpload: true,
            items: [{
                height: 50,
                style: "padding: 5px",
                border: false,
                html: 'Accepts CSV and XML files under 1 MB in size. <br> See <a href="testopia/import_example.csv" target="_blank">import_example.csv</a> and <a href="testopia.dtd" target="_blank">testopia.dtd</a> for proper format.'
            },{
                xtype: 'field',
                fieldLabel: 'Upload File',
                labelStyle: "padding: 5px",
                inputType: 'file',
                name: 'data',
                width: 300
            }],
            buttons: [{
                text: 'Submit',
                handler: function(){
                    Ext.getCmp('importform').getForm().submit({
                        success: function(){
                            Ext.getCmp('object_panel').activate('plan_case_grid');
                            Ext.getCmp('plan_case_grid').store.load();
                            Ext.getCmp('import-win').close();
                        },
                        failure: testopiaError
                    });
                }
            }]
        }]
    });
    win.show(this);
}

PlanGrid = function(params,cfg){
    params.limit = Ext.state.Manager.get('TESTOPIA_DEFAULT_PAGE_SIZE', 25);
    params.current_tab = 'plan';
    this.params = params;
    var tutil = new TestopiaUtil();
    this.t = tutil;
    var versionbox = new ProductVersionCombo({
         hiddenName: 'prod_version',
         mode: 'remote',
         params: {product_id: params.product_id}
    });
    
    this.store = new TestPlanStore(params);
    var ds = this.store;

    this.columns = [
        {header: "ID", width: 30, dataIndex: 'plan_id', sortable: true, renderer: tutil.planLink},
		{header: "Name", 
         width: 220, 
         dataIndex: 'name', 
         id: "plan_name", 
         sortable: true,
         editor: new Ext.grid.GridEditor(
             new Ext.form.TextField({
                 allowBlank: false
             }))
        },
		{header: "Author", width: 150, sortable: true, dataIndex: 'author'},
		{header: "Created", width: 110, sortable: true, dataIndex: 'creation_date', hidden: true},
		{header: "Product", width: 180, sortable: true, dataIndex: 'product', hidden: true},		
        {header: "Product Version", width: 60, sortable: true, dataIndex: 'default_product_version',
         editor: new Ext.grid.GridEditor(
             versionbox,{listeners: {
                 'startedit' : function(){
                     var pid = Ext.getCmp(cfg.id || 'plan_grid').getSelectionModel().getSelected().get('product_id');
                     if (versionbox.store.baseParams.product_id != pid){
                         versionbox.store.baseParams.product_id = pid;
                         versionbox.store.load();
                     }
                 }
             }}
         ), renderer: TestopiaComboRenderer.createDelegate(this)
        },		
        {header: "Type", width: 60, sortable: true,
         dataIndex: 'plan_type',
         editor: new Ext.grid.GridEditor(
             new PlanTypesCombo({
                 hiddenName:'type',
                 mode: 'remote'
             })
         ), renderer: TestopiaComboRenderer.createDelegate(this)
        },		
        {header: "Cases", width: 20, sortable: false, dataIndex: 'case_count'},		
        {header: "Runs", width: 20, sortable: false, dataIndex: 'run_count'}
    ];

    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
    this.bbar = new TestopiaPager('plan', this.store);

    PlanGrid.superclass.constructor.call(this, {
        title: 'Test Plans',
        id: cfg.id || 'plan_grid',
        layout: 'fit',
        region: 'center',
        loadMask: {msg:'Loading Test Plans...'},
        autoExpandColumn: "plan_name",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: cfg.single || false,
            listeners: {'rowselect':function(sm,i,r){
                if (Ext.getCmp('plan_add_run_mnu')){
                    Ext.getCmp('plan_add_run_mnu').enable();
                }
                if (Ext.getCmp('plan_add_case_mnu')){
                    Ext.getCmp('plan_add_case_mnu').enable();
                }
                if (Ext.getCmp('plan_grid_edit_mnu')){
                    Ext.getCmp('plan_grid_edit_mnu').enable();
                }
                Ext.getCmp('new_run_button').enable();
                Ext.getCmp('new_case_button').enable();
                Ext.getCmp('edit_plan_list_btn').enable();
                if (sm.getCount() > 1){
                    if (Ext.getCmp('plan_add_run_mnu')){
                        Ext.getCmp('plan_add_run_mnu').disable();
                    }
                    Ext.getCmp('new_run_button').disable();
                }
            },'rowdeselect': function(sm,i,r){
                if (sm.getCount() < 1){
                    Ext.getCmp('new_run_button').disable();
                    Ext.getCmp('new_case_button').disable();
                    Ext.getCmp('edit_plan_list_btn').disable();
                }
            }}
        }),
        enableColumnHide: true,
        tbar: [{
            xtype: 'button',
            text: 'New Run',
            id: 'new_run_button',
            disabled: true,
            handler: this.newRun.createDelegate(this)
        },{
            xtype: 'button',
            text: 'New Case',
            id: 'new_case_button',
            disabled: true,
            handler: this.newCase.createDelegate(this)

        },new Ext.Toolbar.Fill(),
        {
            xtype: 'button',
            id: 'save_plan_list_btn',
            icon: 'testopia/img/save.png',
            iconCls: 'img_button_16x',
            tooltip: 'Save this search',
            handler: function(b,e){
                saveSearch('plan', Ext.getCmp(cfg.id || 'plan_grid').store.baseParams);
            }
        },{
            xtype: 'button',
            id: 'link_plan_list_btn',
            icon: 'testopia/img/link.png',
            iconCls: 'img_button_16x',
            tooltip: 'Create a link to this list',
            handler: function(b,e){
                linkPopup(Ext.getCmp(cfg.id || 'plan_grid').store.baseParams);
            }
        },{
            xtype: 'button',
            id: 'edit_plan_list_btn',
            icon: 'testopia/img/edit.png',
            iconCls: 'img_button_16x',
            disabled: true,
            tooltip: 'Edit Selected Test Plan',
            handler: function(){
                editFirstSelection(Ext.getCmp(cfg.id || 'plan_grid'));
            }
        },{
            xtype: 'button',
            id: 'new_plan_list_btn',
            icon: 'testopia/img/new.png',
            iconCls: 'img_button_16x',
            tooltip: 'Create a New Test Plan',
            handler: function(){
                tutil.newPlanPopup(params.product_id);
            }
        }],
        
        viewConfig: {
            forceFit:true
        }
    });
    Ext.apply(this,cfg);
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('afteredit', this.onGridEdit, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(PlanGrid, Ext.grid.EditorGridPanel, {
    onContextClick: function(grid, index, e){
        grid.selindex = index;
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'plan-ctx-menu',
                items: [{
                    text: 'Create a New Test Plan',
                    id: 'plan_menu_new_plan',
                    icon: 'testopia/img/new.png',
                    iconCls: 'img_button_16x',
                    handler: this.newPlan.createDelegate(this)
                },{
                    text: 'Add a New Test Run to Selected Plan',
                    id: 'plan_add_run_mnu',
                    handler: this.newRun.createDelegate(this)
                },{
                    text: 'Add a New Test Case to Selected Plans',
                    id: 'plan_add_case_mnu',
                    handler: this.newCase.createDelegate(this)
                },{
                    text: 'Edit',
                    id: 'plan_grid_edit_mnu',
                    menu: {
                        items: [{
                            text: 'Type',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Change Plan Type',
                                    id: 'plan_type_win',
                                    layout: 'fit',
                                    split: true,
                                    plain: true,
                                    shadow: false,
                                    width: 350,
                                    height: 150,
                                    items: [
                                        new Ext.FormPanel({
                                            labelWidth: '40',
                                            bodyStyle: 'padding: 5px',
                                            items: [new PlanTypesCombo({
                                                fieldLabel: 'Plan Type'
                                            })]
                                        })
                                    ],
                                    buttons: [{
                                        text:'Update Type',
                                        handler: function(){
                                            var params = {
                                                plan_type: Ext.getCmp('plan_type_combo').getValue(), 
                                                ids: getSelectedObjects(grid, 'plan_id')
                                            };
                                            TestopiaUpdateMultiple('plan',params,grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Cancel',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show();
                            }
                        },{
                            text: 'Tags',
                            handler: function(){
                                TagsUpdate('plan', grid);
                            }    
                        }]
                    }
                },{
                    text: "Reports",
                    menu: {
                        items: [{
                            text: 'New Completion Report',
                            handler: function(){
                                Ext.getCmp('object_panel').setActiveTab('dashboardpanel');
                                
                                var newPortlet = new Ext.ux.Portlet({
                                    title: 'Completion Report',
                                    closable: true,
                                    autoScroll: true,
                                    tools: PortalTools
                                });
                                newPortlet.url = 'tr_run_reports.cgi?type=completion&plan_ids=' + getSelectedObjects(grid, 'plan_id');
                                Ext.getCmp('dashboard_leftcol').add(newPortlet);
                                Ext.getCmp('dashboard_leftcol').doLayout();
                        		newPortlet.load({
                                    url: newPortlet.url
                                });
                            }
                        },{
                                text: 'New Bug Report',
                                handler: function(){
                                    Ext.getCmp('object_panel').setActiveTab('dashboardpanel');
                                    var bug_list = new Testopia.BugReport({
                                            plan_ids: getSelectedObjects(grid, 'plan_id')
                                        });
                                    var newPortlet = new Ext.ux.Portlet({
                                        title: 'Bug Report',
                                        closable: true,
                                        autoScroll: true,
                                        tools: [{
                                            id:'close',
                                            handler: function(e, target, panel){
                                                panel.ownerCt.remove(panel, true);
                                            }
                                        }],
                                        items: bug_list
                                    });
                                    Ext.getCmp('dashboard_leftcol').add(newPortlet);
                                    Ext.getCmp('dashboard_leftcol').doLayout();
                                    bug_list.store.load();
                                }
                            }]
                    }
                },{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    } 
                },{
                    text: 'View Test Plan in a New Tab',
                    handler: function(){
                        window.open('tr_show_plan.cgi?plan_id=' + grid.store.getAt(grid.selindex).get('plan_id'));
                    }
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },
    newPlan: function(){
        this.t.newPlanPopup(this.params.product_id);
    },
    newRun: function(){
        this.t.newRunPopup(this.getSelectionModel().getSelected());
    },
    newCase: function(){
        this.t.newCaseForm(getSelectedObjects(this, 'plan_id'), this.getSelectionModel().getSelected().get('product_id'));
    },

    onGridEdit: function(gevent){
        var myparams = {action: "edit", plan_id: gevent.record.get('plan_id')};
        var ds = this.store;
        switch(gevent.field){
        case 'default_product_version':
            myparams.prod_version = gevent.value; 
            break;
        case 'plan_type':
            myparams.type = gevent.value;
            break;
        case 'name':
            myparams.name = gevent.value;
            break;

        }
        this.form.submit({
            url:"tr_process_plan.cgi",
            params: myparams,
            success: function(f,a){
                ds.commitChanges();
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
    },
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

NewPlanForm = function(product_id){
	var versionsBox = new ProductVersionCombo({
        hiddenName: 'prod_version',
        fieldLabel: "<b>Product Version</b>",
        mode:'local',
        params: {product_id: product_id}
	});
	var productsBox = new ProductCombo({
        hiddenName: 'product_id',
        fieldLabel: "<b>Product</b>",
        mode:'local',
        value: product_id
	});
    productsBox.on('select', function(c,r,i){
        versionsBox.reset();
        versionsBox.store.baseParams.product_id = r.get('id');
		versionsBox.store.load();
        versionsBox.enable();
	});
    
    NewPlanForm.superclass.constructor.call(this,{
        url: 'tr_new_plan.cgi',
        id: 'newplanform',
        baseParams: {action: 'add'},
        fileUpload: true,
        labelAlign: 'top',
        frame:true,
        title: 'New Plan',
        bodyStyle:'padding:5px 5px 0',
        width: 800,
        height: 500,
        items: [{
            layout:'column',
            items:[{
                columnWidth: 0.5,
                layout: 'form',
                items: [{
                    xtype:'textfield',
                    fieldLabel: '<b>Plan Name</b>',
                    name: 'plan_name',
                    anchor:'95%',
                    allowBlank: false
                }, new PlanTypesCombo({mode: 'local', hiddenName: 'type', fieldLabel: '<b>Plan Type</b>'})]
            },{
                columnWidth: 0.5,
                layout: 'form',
                items: [productsBox,versionsBox]
            }]
        },{
            xtype: 'tabpanel',
            height: 280,
            activeItem: 0,
            items:[{
                layout: 'fit',
                title: 'Plan Document',
                items: [{
                    id: 'plan_doc',
                    xtype:'htmleditor',
                    name: 'plandoc'
                }]
                
            },new AttachForm()]
        }],
        buttons: [{
            text: 'Submit',
            handler: function(){
                if (!Ext.getCmp('newplanform').getForm().isValid()){
                    return;
                }
                Ext.getCmp('newplanform').getForm().submit({
                    success: function(form, data){
                        if (data.result.err){
                            alert('One or more attachments were either too large or were empty. These have been ignored.');
                        }
                        Ext.Msg.show({
                            title:'Plan Created',
                            msg: 'Plan ' + data.result.plan + ' Created. Would you like to go there now?',
                            buttons: Ext.Msg.YESNO,
                            icon: Ext.MessageBox.QUESTION,
                            fn: function(btn){
                                if (btn == 'yes'){
                                    window.location = 'tr_show_plan.cgi?plan_id=' + data.result.plan;
                                }
                            }
                        });
                        try{
                            Ext.getCmp('newplan-win').close();
                        }
                        catch(err){}
                    },
                    failure: testopiaError
                });
            }
        },{
            text: 'Cancel',
            handler: function(){
                if (Ext.getCmp('newplan-win')){
                    Ext.getCmp('newplan-win').close();
                }
                else {
                    window.location = 'tr_show_product.cgi';
                }
            }
        }]
    });
};

Ext.extend(NewPlanForm, Ext.form.FormPanel);

Testopia.TestPlan.ClonePanel = function(plan){
    var pbox = new ProductCombo({
        hiddenName: 'product_id',
        fieldLabel: 'Copy To Product',
        mode: 'local',
        width: 550,
        value: plan.product_id
    });
    var vbox = new ProductVersionCombo({
        id: 'clone_version',
        hiddenName: 'prod_version',
        fieldLabel: 'Product Version',
        params: {product_id: plan.product_id},
        allowBlank: false
    });
    var bbox  = new BuildCombo({
        fieldLabel: 'Select a Build',
        id: 'plan_clone_build_chooser',
        mode: 'local',
        hiddenName: 'new_run_build',
        params: {product_id: plan.product_id}
    });
    var ebox = new EnvironmentCombo({
        fieldLabel: 'Select an Environment',
        id: 'plan_clone_environment_chooser',
        mode: 'local',
        hiddenName: 'new_run_env',
        params: {product_id: plan.product_id}
    });
    pbox.on('select', function(c,r,i){
        vbox.reset();
        vbox.store.baseParams.product_id = r.id;
        Ext.getCmp('plan_clone_build_chooser').store.baseParams.product_id = r.id;
        Ext.getCmp('plan_clone_environment_chooser').store.baseParams.product_id = r.id;
        Ext.getCmp('plan_clone_build_chooser').store.load();
        Ext.getCmp('plan_clone_environment_chooser').store.load();
        if (r.id == plan.product_id){
            Ext.getCmp('copy_categories').disable();
        }
        else{
            Ext.getCmp('copy_categories').enable();
        }
        
        vbox.store.load();
        vbox.enable();
    });
    function doSubmit(){
        var form = this.getForm();
        var p = form.getValues();
        if (form.isValid()){
            form.submit({
                success: function(f,a){
                    Ext.Msg.show({
                        title:'Plan Copied',
                        msg: 'Plan ' + a.result.plan_id + ' Created. Would you like to go there now?',
                        buttons: Ext.Msg.YESNO,
                        icon: Ext.MessageBox.QUESTION,
                        fn: function(btn){
                            if (btn == 'yes'){
                                window.location = 'tr_show_plan.cgi?plan_id=' + a.result.plan_id;
                            }
                        }
                    });
                },
                failure: testopiaError
            })
        }
    }
    Testopia.TestPlan.ClonePanel.superclass.constructor.call(this, {
        id: 'plan_clone_panel',
        url: 'tr_process_plan.cgi',
        baseParams: {action: 'clone'},
        bodyStyle: 'padding: 10px',
        border: false,
        autoScroll: true,
        width: 600,
        items:[{
            layout:'table',
            border: false,
            layoutConfig: {
                columns: 2,
                width: '100%'
            },
            items:[{
                colspan: 2,
                layout: 'form',
                border: false,
                items: [{
                    id:'plan_clone_name',
                    xtype:'textfield',
                    fieldLabel: '<b>New Plan Name</b>',
                    name: 'plan_name',
                    allowBlank: false,
                    width: 550
                },pbox, vbox ]
            },{
                layout: 'form',
                border: false,
                items: [{
                    xtype: 'checkbox',
                    name: 'copy_attachments',
                    checked: false,
                    boxLabel: 'Copy Plan Attachments',
                    hideLabel: true
                },{
                    xtype: 'checkbox',
                    name: 'copy_doc',
                    checked: true,
                    boxLabel: 'Copy Plan Document',
                    hideLabel: true
                },{
                    xtype: 'hidden',
                    name: 'plan_id',
                    value: plan.plan_id
                }]

            },{
                layout: 'form',
                border: false,
                items: [{
                    xtype: 'checkbox',
                    name: 'copy_tags',
                    checked: true,
                    boxLabel: 'Copy Plan Tags',
                    hideLabel: true
                },{
                    xtype: 'checkbox',
                    name: 'copy_perms',
                    checked: true,
                    boxLabel: 'Copy Plan Permissions',
                    hideLabel: true
                }]

            },{
                layout: 'form',
                border: false,
                colspan: 2,
                items: [{
                    xtype: 'checkbox',
                    name: 'keep_plan_author',
                    checked: false,
                    boxLabel: 'Maintain original author (unchecking will make me the author of the new plan)',
                    hideLabel: true
                },{
                    xtype: 'fieldset',
                    autoHeight: true,
                    checkboxToggle: true,
                    checkboxName: 'copy_cases',
                    id: 'copy_cases',
                    title: 'Copy Test Cases',
                    collapsed: true,
                    items: [{
                        xtype: 'checkbox',
                        id: 'case_copy_plan_ids',
                        name: 'make_copy',
                        boxLabel: 'Create a copy (Unchecking will create a link to selected plans)',
                        hideLabel: true,
                        listeners: {'check':function(box, checked){
                            if (checked === true){
                                Ext.getCmp('copy_cases_keep_author').enable();
                                Ext.getCmp('copy_cases_keep_tester').enable();
                                Ext.getCmp('copy_run_cases_cbox').disable();
                            }
                            else {
                                Ext.getCmp('copy_cases_keep_author').disable();
                                Ext.getCmp('copy_cases_keep_tester').disable();
                                Ext.getCmp('copy_run_cases_cbox').enable();
                            }
                        }}
                    },{
                        xtype: 'checkbox',
                        name: 'keep_case_authors',
                        id: 'copy_cases_keep_author',
                        checked: false,
                        disabled: true,
                        boxLabel: 'Maintain original authors (unchecking will make me the author of the copied cases)',
                        hideLabel: true
                    },{
                        xtype: 'checkbox',
                        id: 'copy_cases_keep_tester',
                        boxLabel: 'Keep Default Tester (unchecking will make you the default tester of copied cases)',
                        hideLabel: true,
                        name: 'keep_tester',
                        checked: true
                    },{
                        xtype: 'checkbox',
                        name: 'copy_categories',
                        id: 'copy_categories',
                        checked: false,
                        disabled: true,
                        boxLabel: 'Copy Categories to new product (unchecking will place copied cases in the default category for the selected product)',
                        hideLabel: true                        
                    }]
                },{
                    xtype: 'fieldset',
                    autoHeight: true,
                    checkboxToggle: true,
                    checkboxName: 'copy_runs',
                    id: 'copy_runs',
                    title: 'Copy Test Runs',
                    collapsed: true,
                    items: [{
                        xtype: 'checkbox',
                        name: 'keep_run_managers',
                        checked: false,
                        boxLabel: 'Maintain managers (unchecking will make me the manager of the new runs)',
                        hideLabel: true
                    },{
                        xtype: 'checkbox',
                        name: 'copy_run_tags',
                        checked: true,
                        boxLabel: 'Copy tags from the old run to the new run',
                        hideLabel: true
                    },{
                        xtype: 'checkbox',
                        name: 'copy_run_cases',
                        id: 'copy_run_cases_cbox',
                        checked: true,
                        boxLabel: 'Link cases in copied run to original test cases (unchecking will produce an empty test run)',
                        hideLabel: true
                    },bbox, ebox]
                }]

            }]
        }],
        buttons: [{
            text: 'Submit',
            handler: doSubmit.createDelegate(this)
        },{
            text: 'Cancel',
            handler: function(){
                Ext.getCmp('plan-clone-win').close();
            }
        }]
    });
};
Ext.extend(Testopia.TestPlan.ClonePanel, Ext.form.FormPanel);

PlanClonePopup = function(plan){
    
    var win = new Ext.Window({
        id: 'plan-clone-win',
        closable: true,
        width: 750,
        title: 'Create a Copy of Plan ' + plan.plan_id,
        height: 500,
        plain: true,
        shadow: false,
        closable: true,
        layout: 'fit',
        items: [new Testopia.TestPlan.ClonePanel(plan)]
    });
    win.show();
};

/*
 * END OF FILE - /bnc-3.0/testopia/js/plan.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/case.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

CasePanel = function(params,cfg){
    var cgrid = new CaseGrid(params,cfg);
    var filter = new CaseFilter();
    this.cgrid = cgrid;
    this.store = cgrid.store;
    this.params = params;
    
    CasePanel.superclass.constructor.call(this, {
        title: 'Test Cases',
        layout: 'border',
        id: 'case-panel',
        items: [filter, cgrid]
    });
    
    this.on('activate', this.onActivate, this);
};

Ext.extend(CasePanel, Ext.Panel, {
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load({params: this.params});
        }
    }
});

CaseFilter = function (){
    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
    CaseFilter.superclass.constructor.call(this, {
        title: 'Search for Test Cases',
        region: 'north',
        layout: 'fit',
        frame: true,
        collapsible: true,
        height: 120,
        items: [{
            buttons: [{
                text: 'Search',
                handler: function (){
                    Ext.getCmp('case_search').getForm().submit();
                }
            }]
        }]
    });
};
Ext.extend(CaseFilter, Ext.Panel);

CaseGrid = function(params, cfg){
    params.limit = Ext.state.Manager.get('TESTOPIA_DEFAULT_PAGE_SIZE', 25);
    var tutil = new TestopiaUtil();
    params.current_tab = 'case';
    this.params = params;
    categoryCombo = new CaseCategoryCombo({
        hiddenName: 'category',
        mode: 'remote',
        params: {}
    });

    this.store = new Ext.data.GroupingStore({
        url: 'tr_list_cases.cgi',
        baseParams: params,
        reader: new Ext.data.JsonReader({
            totalProperty: 'totalResultsAvailable',
            root: 'Result',
            id: 'case_id',
            fields: [
               {name: "case_id", mapping:"case_id"},
               {name: "plan_id", mapping: "plan_id"},
               {name: "alias", mapping:"alias"},
               {name: "summary", mapping:"summary"},
               {name: "author", mapping:"author_name"},
               {name: "tester", mapping:"default_tester"},
               {name: "creation_date", mapping:"creation_date"},
               {name: "category", mapping:"category_name"},
               {name: "priority", mapping:"priority"},
               {name: "status", mapping:"status"},
               {name: "run_count", mapping:"run_count"},
               {name: "requirement", mapping:"requirement"},
               {name: "product_id", mapping:"product_id"},
               {name: "isautomated", mapping:"isautomated"}

        ]}),
        remoteSort: true,
        sortInfo: {field: 'case_id', direction: "ASC"},
        groupField: params.plan_id ? '' : 'plan_id'
    });
    var ds = this.store;
    ds.paramNames.sort = "order";
    ds.on('beforeload',function(store, o){
        store.baseParams.ctype = 'json';
    });
    
    this.columns = [
        {header: "ID", width: 50, dataIndex: 'case_id', sortable: true, groupRenderer: function(v){return v;}, renderer: tutil.caseLink},
		{header: "Summary", 
         width: 220, 
         dataIndex: 'summary', 
         id: "case_summary", 
         sortable: true,
         editor: new Ext.grid.GridEditor(
             new Ext.form.TextField({
                 allowBlank: false
             }))
        },
		{header: "Author", width: 150, sortable: true, dataIndex: 'author'},
        {header: "Default Tester", width: 150, sortable: true, dataIndex: 'tester',
         editor: new Ext.grid.GridEditor(new UserLookup({hiddenName:'tester'})),
         renderer: TestopiaComboRenderer.createDelegate(this)},
		{header: "Created", width: 110, sortable: true, dataIndex: 'creation_date'},
        {header: "Priority", width: 100, sortable: true, dataIndex: 'priority',
         editor: new Ext.grid.GridEditor(
             new PriorityCombo({
                 hiddenName: 'priority',
                 id: 'case_grid_priority',
                 mode: 'remote'
             })
         ), renderer: TestopiaComboRenderer.createDelegate(this)
        },		
        {header: "Category", width: 100, sortable: true, dataIndex: 'category',
         editor: new Ext.grid.GridEditor(
                categoryCombo,{listeners: {
                     'startedit' : function(){
                         var pid = Ext.getCmp(cfg.id || 'case_grid').getSelectionModel().getSelected().get('product_id');
                         if (categoryCombo.store.baseParams.product_id != pid){
                             categoryCombo.store.baseParams.product_id = pid;
                             categoryCombo.store.load();
                         }
                     }
                 }}
         ), renderer: TestopiaComboRenderer.createDelegate(this)
        },
        {header: "Status", width: 100, sortable: true, dataIndex: 'status',
         editor: new Ext.grid.GridEditor(new CaseStatusCombo('status')),
         renderer: TestopiaComboRenderer.createDelegate(this)},
        {header: "Requirement", width: 40, sortable: true, dataIndex: 'requirement',
        editor: new Ext.grid.GridEditor(
            new Ext.form.TextField({
                name: 'requirement'
            }))
        },
        {header: "Plan", width: 40, sortable: true, dataIndex: 'plan_id', renderer: tutil.plan_link, groupRenderer: function(v){return v;}},
        {header: "Run Count", width: 40, sortable: false, dataIndex: 'run_count'}
    ];
    this.view = new Ext.grid.GroupingView({
        forceFit: true,
        groupTextTpl: '{text} ({[values.rs.length]} {[values.rs.length > 1 ? "Items" : "Item"]})'
    });

    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
    this.bbar = new TestopiaPager('case', this.store, {id: 'case_pager'});
    CaseGrid.superclass.constructor.call(this, {
        title: 'Test Cases',
        id: cfg.id || 'case_grid',
        loadMask: {msg:'Loading Test Cases...'},
        layout: 'fit',
        region: 'center',
        autoExpandColumn: "case_summary",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false,
            listeners: {'rowselect':function(sm,i,r){
                Ext.getCmp('delete_case_list_btn').enable();
                Ext.getCmp('edit_case_list_btn').enable();
            },'rowdeselect': function(sm,i,r){
                if (sm.getCount() < 1){
                    Ext.getCmp('delete_case_list_btn').disable();
                    Ext.getCmp('edit_case_list_btn').disable();
                }
            }}
        }),
        viewConfig: {
            forceFit:true
        },
        tbar:[new Ext.Toolbar.Fill(),
        {
            xtype: 'button',
            id: 'save_case_list_btn',
            icon: 'testopia/img/save.png',
            iconCls: 'img_button_16x',
            tooltip: 'Save this search',
            handler: function(b,e){
                saveSearch('case', Ext.getCmp(cfg.id || 'case_grid').store.baseParams);
            }
        },{
            xtype: 'button',
            id: 'link_case_list_btn',
            icon: 'testopia/img/link.png',
            iconCls: 'img_button_16x',
            tooltip: 'Create a link to this list',
            handler: function(b,e){
                linkPopup(Ext.getCmp(cfg.id || 'case_grid').store.baseParams);
            }
        },{
            xtype: 'button',
            id: 'edit_case_list_btn',
            icon: 'testopia/img/edit.png',
            disabled: true,
            iconCls: 'img_button_16x',
            tooltip: 'Edit Selected Test Case',
            handler: function(){
                editFirstSelection(Ext.getCmp(cfg.id || 'case_grid'));
            }
        },{
            xtype: 'button',
            id: 'add_case_list_btn',
            icon: 'testopia/img/new.png',
            iconCls: 'img_button_16x',
            tooltip: 'Create a New Test Case',
            handler: function(){
                try{
                    if (plan){
                        tutil.newCaseForm(plan.plan_id, plan.product_id);
                    }
                }
                catch (err){
                    window.location = 'tr_new_case.cgi';
                }
            }
        },{
            xtype: 'button',
            template: button_16x_tmpl,
            id: 'delete_case_list_btn',
            disabled: true,
            icon: 'testopia/img/delete.png',
            iconCls: 'img_button_16x',
            tooltip: 'Delete Selected Test Cases',
            handler: this.deleteList.createDelegate(this)
         }]
    });
    Ext.apply(this,cfg);
    
    this.on('activate', this.onActivate, this);
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('afteredit', this.onGridEdit, this);
};

Ext.extend(CaseGrid, Ext.grid.EditorGridPanel, {
    onContextClick: function(grid, index, e){
        grid.selindex = index;
        if(!this.menu){ // create context menu on first right click
            var hasplan;
            try{
                hasplan = plan ? false : true;
            }
            catch (err){
                hasplan = true;
            }
                
            this.menu = new Ext.menu.Menu({
                id:'case_list_ctx_menu',
                items: [{
                    text: 'Modify Selected Test Cases',
                    icon: 'testopia/img/edit.png',
                    iconCls: 'img_button_16x',
                    menu: {
                        items: [{
                            text: 'Requirements',
                            handler: function(){
                                Ext.Msg.prompt('Edit Requirements', '', function(btn, text){
                                    if (btn == 'ok'){
                                        TestopiaUpdateMultiple('case', {requirement: text, ids: getSelectedObjects(grid,'case_id')}, grid);
                                    }
                                });
                            }
                        },{
                            text: 'Category',
                            disabled: hasplan,
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Category',
                                    id: 'status-win',
                                    plain: true,
                                    shadow: false,
                                    width: 300,
                                    height: 150,
                                    items: [new CaseCategoryCombo({
                                        fieldLabel: 'Category',
                                        params: {product_id: plan.product_id}
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            TestopiaUpdateMultiple('case', {category: Ext.getCmp('case_category_combo').getValue(), ids: getSelectedObjects(grid,'case_id')}, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        },{
                            text: 'Status',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Status',
                                    id: 'status-win',
                                    plain: true,
                                    shadow: false,
                                    width: 300,
                                    height: 150,
                                    items: [new CaseStatusCombo({
                                        fieldLabel: 'Status'
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            TestopiaUpdateMultiple('case', {status: Ext.getCmp('case_status_combo').getValue(), ids: getSelectedObjects(grid,'case_id')}, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        },{
                            text: 'Priority',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Priority',
                                    id: 'priority-win',
                                    layout: 'form',
                                    plain: true,
                                    shadow: false,
                                    width: 300,
                                    height: 150,
                                    labelWidth: 30,
                                    items: [new PriorityCombo({
                                        fieldLabel: 'Priority'
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            TestopiaUpdateMultiple('case', {priority: Ext.getCmp('priority_combo').getValue(), ids: getSelectedObjects(grid,'case_id')}, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        },{
                            text: 'Tester',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Change Default Tester',
                                    id: 'def_tester_win',
                                    layout: 'fit',
                                    plain: true,
                                    shadow: false,
                                    split: true,
                                    width: 350,
                                    height: 150,
                                    items: [
                                        new Ext.FormPanel({
                                            labelWidth: '40',
                                            bodyStyle: 'padding: 5px',
                                            items: [new UserLookup({
                                                id: 'tester_update',
                                                fieldLabel: 'Default Tester'
                                            })]
                                        })
                                    ],
                                    buttons: [{
                                        text:'Update Tester',
                                        handler: function(){
                                            TestopiaUpdateMultiple('case', {tester: Ext.getCmp('tester_update').getValue(), ids: getSelectedObjects(grid,'case_id')}, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Cancel',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show();
                            }
                        },{
                            text: 'Automation',
                            handler: function(){
                                
                                var chbx = new Ext.form.Checkbox({
                                    checked: false,
                                    name: 'isautomated',
                                    fieldLabel: 'Enable Automation'
                                });
                                
                                var scripttext = new Ext.form.TextField({
                                    xtype:'textfield',
                                    disabled: true,
                                    name: 'script',
                                    fieldLabel: 'Script '
                                });

                                var argumenttext = new Ext.form.TextField({
                                    xtype:'textfield',
                                    name: 'arguments',
                                    disabled: true,
                                    fieldLabel: 'Arguments '
                                });
                                
                                chbx.on('check', function(){
                                    if (scripttext.disabled){
                                        scripttext.enable();
                                        argumenttext.enable();
                                    }
                                    else{
                                        scripttext.disable();
                                        argumenttext.disable();
                                    }
                                }, chbx);
                                
                                var win = new Ext.Window({
                                    title: 'Edit Automation Settings',
                                    id: 'auto-win',
                                    layout: 'form',
                                    plain: true,
                                    shadow: false,
                                    width: 350,
                                    height: 250,
                                    items: [{
                                        id: 'automation_form',
                                        bodyStyle: 'padding: 5px',
                                        xtype: 'form',
                                        items:[chbx, argumenttext, scripttext]
                                    }],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            params = Ext.getCmp('automation_form').getForm().getValues();
                                            params.ids = getSelectedObjects(grid,'case_id');
                                            TestopiaUpdateMultiple('case', params, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        }]
                    }
                },{
                    text: 'Delete Selected Test Cases',
                    icon: 'testopia/img/delete.png',
                    iconCls: 'img_button_16x',
                    handler: this.deleteList.createDelegate(this)

                },{
                    text: 'Add Selected Test Cases to Run... ',
                    handler: function(){
                        Ext.Msg.prompt('Add to runs', '', function(btn, text){
                            if (btn == 'ok'){
                                TestopiaUpdateMultiple('case', {addruns: text, ids: getSelectedObjects(grid,'case_id')}, grid);
                                win.close();
                            }
                        });
                    }
                },{
                    text: 'Copy or Link Selected Test Cases to Plan(s)... ',
                    handler: function(){
                        var r = grid.getSelectionModel().getSelected();
                        caseClonePopup(r.get('product_id'), getSelectedObjects(grid,'case_id'));
                    }
                },{
                    text: 'Unlink from Plan',
                    disabled: hasplan,
                    handler: function(){
                        Ext.Msg.show({
                            title: 'Unlink Selected Test Cases',
                            msg: 'You are about to unlink the selected test cases from this plan. If a test case is not linked to any other plans, it will be deleted. Do you want to continue?',
                            buttons: Ext.Msg.YESNO,
                            icon: Ext.Msg.WARNING,
                            fn: function(btn){
                                if (btn == 'yes'){
                                    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm');
                                    testopia_form.submit({
                                        url: 'tr_list_cases.cgi',
                                        params: {case_ids: getSelectedObjects(grid,'case_id'), action:'unlink', plan_id: plan.plan_id},
                                        success: function(data){
                                            Ext.Msg.show({
                                                msg: "Test cases removed",
                                                buttons: Ext.Msg.OK,
                                                icon: Ext.MessageBox.INFO
                                            });
                                            grid.store.reload();
                                        },
                                        failure: function(f,a){
                                            testopiaError(f,a);
                                            grid.store.reload();
                                        }
                                    });
                                }
                            }
                        })
                    }
                },{
                    text: 'Add or Remove Tags from Selected Cases...',
                    handler: function(){
                        TagsUpdate('case', grid);
                    }
                },{
                    text: 'Add or Remove Bugs from Selected Cases...',
                    handler: function(){
                        BugsUpdate(grid);
                    }
                },{
                    text: 'Add or Remove Components from Selected Cases...',
                    handler: function(){
                         var win = new Ext.Window({
                            title: 'Add or Remove Components',
                            id: 'component_update_win',
                            layout: 'fit',
                            split: true,
                            plain: true,
                            shadow: false,
                            width: 550,
                            height: 85,
                            items: [new CaseComponentsGrid(grid)]
                         });
                         win.show();
                    }
                },{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    } 
                },{
                    text: 'View Test Case in a New Tab',
                    handler: function(){
                        window.open('tr_show_case.cgi?case_id=' + grid.store.getAt(grid.selindex).get('case_id'));
                    }
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },
    onGridEdit: function(gevent){
        var myparams = {action: "edit", case_id: gevent.record.get('case_id')};
        var ds = this.store;
        var display_value = '';
        switch(gevent.field){
        case 'summary':
            myparams.summary = gevent.value; 
            break;
        case 'tester':
            myparams.tester = gevent.value;
            break;
        case 'priority':
            myparams.priority = gevent.value;
            break;
        case 'status':
            myparams.status = gevent.value;
            break;
        case 'category':
            myparams.category = gevent.value;
            break;
        case 'requirement':
            myparams.requirement = gevent.value;
            break;
        }
        this.form.submit({
            url:"tr_process_case.cgi",
            params: myparams,
            success: function(f,a){
                ds.commitChanges();
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
    },
    deleteList: function(){
        var grid = this;
        Ext.Msg.show({
            title:'Confirm Delete?',
            msg: CASE_DELETE_WARNING,
            buttons: Ext.Msg.YESNO,
            animEl: 'case-delete-btn',
            icon: Ext.MessageBox.QUESTION,
            fn: function(btn){
                if (btn == 'yes'){
                    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm');
                    testopia_form.submit({
                        url: 'tr_list_cases.cgi',
                        params: {case_ids: getSelectedObjects(grid,'case_id'), action:'delete'},
                        success: function(data){
                            Ext.Msg.show({
                                msg: "Test cases deleted",
                                buttons: Ext.Msg.OK,
                                icon: Ext.MessageBox.INFO
                            });
                            grid.store.reload();
                        },
                        failure: function(f,a){
                            testopiaError(f,a);
                            grid.store.reload();
                        }
                    });
                }
            }
        });
    },

    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

NewCaseForm = function(plan_ids, product_id, run_id){
    NewCaseForm.superclass.constructor.call(this,{
        id: 'newcaseform',
        url: 'tr_new_case.cgi',
        baseParams: {action: 'add'},
        fileUpload: true,
        labelAlign: 'left',
        frame:true,
        title: 'Create a New Test Case',
        bodyStyle:'padding:5px 5px 0',
        width: 1050,
        height: 670,
        items: [{
            layout:'table',
            layoutConfig: {
                columns: 2,
                width: '100%'
            },
            items:[
            {
                colspan: 2,
                layout: 'form',
                items: [{
                    id:'ncf-summary',
                    xtype:'textfield',
                    fieldLabel: '<b>Summary</b>',
                    name: 'summary',
                    allowBlank: false,
                    width: 800
                },{
                    xtype: 'hidden',
                    name: 'components',
                    id: 'compfield'
                },{
                    xtype: 'hidden',
                    name: 'plan_id',
                    id: 'planfield',
                    value: plan_ids
                }]
            },{
                layout: 'form',
                items: [
                new UserLookup({
                    id: 'default_tester',
                    hiddenName: 'tester', 
                    fieldLabel: 'Default Tester'
                }),
                {
                    xtype:'textfield',
                    fieldLabel: 'Alias',
                    id:'case_alias',
                    name: 'alias'
                },
                new PriorityCombo({
                    fieldLabel: '<b>Priority</b>&nbsp;&nbsp;<img src="images/help.png" id="priority_help" style="cursor:pointer" onclick=\'window.open("testing_priorities.html","Priority Definitions","resizable=no, scrollbars=yes, width=550,height=420");\'/>',
                    hiddenName: 'priority',
                    mode: 'local',
                    allowBlank: false
                }), 
                new CaseCategoryCombo({
                    fieldLabel: '<b>Category</b>',
                    hiddenName: 'category',
                    mode: 'local',
                    allowBlank: false,
                    params: {product_id: product_id}
                }),
                {
                    xtype:'textfield',
                    fieldLabel: 'Estimated Time (HH:MM:SS)',
                    id:'estimated_time',
                    name: 'estimated_time'
                },{
                    xtype:'textfield',
                    fieldLabel: 'Bugs',
                    id:'ncf-bugs',
                    name: 'bugs'
                },{
                    xtype:'textfield',
                    fieldLabel: 'Blocks',
                    id:'ncf-blocks',
                    name: 'tcblocks'
                }]

            },{
                layout: 'form',
                items: [new CaseStatusCombo({
                    fieldLabel: '<b>Status</b>',
                    hiddenName: 'status',
                    mode: 'local',
                    value: DEFAULT_CASE_STATUS,
                    allowBlank: false,
                    id: 'ncf-casestatus'
                }),
                {
                    xtype:'textfield',
                    fieldLabel: 'Add Tags',
                    id:'ncf-addtags',
                    name: 'addtags'
                },{
                    xtype:'textfield',
                    fieldLabel: 'Requirements',
                    id:'ncf-reqs',
                    name: 'requirement'
                },{
                    xtype:'checkbox',
                    fieldLabel: 'Automated',
                    id:'ncf-automated',
                    name: 'isautomated',
                    value: '1'
                },{
                    xtype:'textfield',
                    fieldLabel: 'Scripts',
                    id:'ncf-scripts',
                    name: 'script'
                },{
                    xtype:'textfield',
                    fieldLabel: 'Arguments',
                    id:'ncf-arguments',
                    name: 'arguments'
                },{
                    xtype:'textfield',
                    fieldLabel: 'Add to Run',
                    id:'ncf-addtorun',
                    name: 'addruns',
                    value: run_id
                },{
                    xtype:'textfield',
                    fieldLabel: 'Depends On',
                    id:'ncf-dependson',
                    name: 'tcdependson'
                }]

            }]
        },{
            xtype: 'tabpanel',
            id: 'ncf_tabs',
            height: 356,
            activeItem: 1,
            items:[{
                layout: 'column',
                title: 'Setup Procedures',
                items: [{
                    columnWidth: 0.5,
                    items:[{
                        title: 'Setup',
                        layout: 'fit',
                        items: [{
                            id: 'ncf-setup_doc',
                            name: 'tcsetup',
                            xtype:'htmleditor',
                            scrollable:true
                        }]
                    }]
                },{
                    columnWidth: 0.5,
                    items:[{
                        title: 'Break Down',
                        layout: 'fit',
                        items: [{
                            id: 'ncf-breakdown_doc',
                            name: 'tcbreakdown',
                            xtype:'htmleditor',
                            scrollable:true
                        }]
                    }]
                }]
            },{
                
                layout: 'column',
                title: 'Actions',
                items: [{
                    columnWidth: 0.5,
                    items:[{
                        title: 'Action',
                        layout: 'fit',
                        items: [{
                            id: 'ncf-action',
                            name: 'tcaction',
                            xtype:'htmleditor',
                            scrollable:true,
                            listeners:{'initialize':function(h){
                                if (!h.getValue()) {
                                    var httpRequest = new Ext.data.Connection();
                                    httpRequest.request({
                                        url: 'tr_quicksearch.cgi',
                                        params: {
                                            action: 'get_action'
                                        },
                                        success: function(d){
                                            h.setValue(d.responseText);
                                        },
                                        failure: testopiaError
                                    });
                                }  	
                            }}
                        }]
                    }]
                },{
                    columnWidth: 0.5,
                    items:[{
                        title: 'Expected Results',
                        layout: 'fit',
                        items: [{
                            id: 'ncf-effect',
                            name: 'tceffect',
                            xtype:'htmleditor',
                            scrollable:true,
                            listeners:{'initialize':function(h){
                                if(!h.getValue()){
                                    var httpRequest = new Ext.data.Connection();
                                	httpRequest.request({
                                    	url: 'tr_quicksearch.cgi',
                                    	params:{
                                    		action: 'get_effect'
                                    	}, 
                                    	success:function(d){
                                    		h.setValue(d.responseText);
                                    	}, 
                                    	failure: testopiaError
                                	});  	
                                }
                            }}
                        }]
                    }]
                }]
                
            },
            new AttachForm(),
            {
                title: 'Components',
                id: 'component_picker',
                height: 250,
                layout: 'fit',
                xtype: 'grid',
                store: new ComponentStore({product_id: product_id}, true),
                columns: [{sortable: true, dataIndex: 'name', width: 500}],
                sm: new Ext.grid.RowSelectionModel({
                    singleSelect: false
                }),
                tbar: [
                    new Ext.menu.TextItem('Product'),
                    new Ext.Toolbar.Spacer(),
                    new ProductCombo({
                        mode: 'local',
                        value: product_id,
                        id: 'comp_product_combo'
                    })
                ]
            }]
        }],
        buttons: [{
            text: 'Submit',
            handler: function(){
                if (!Ext.getCmp('newcaseform').getForm().isValid()){
                    return;
                }
                Ext.getCmp('newcaseform').getForm().submit({
                    method: 'POST',
                    success: function(form, data){
                        if (data.result.err){
                            alert('One or more attachments were either too large or were empty. These have been ignored.');
                        }
                        Ext.Msg.show({
                            title:'Test Case Created',
                            msg: 'Test case ' + data.result.tc + ' Created. Would you like to go there now?',
                            buttons: Ext.Msg.YESNO,
                            icon: Ext.MessageBox.QUESTION,
                            fn: function(btn){
                                if (btn == 'yes'){
                                    window.location = 'tr_show_case.cgi?case_id=' + data.result.tc;
                                }
                            }
                        });
                        if (Ext.getCmp('plan_case_grid')){
                            Ext.getCmp('plan_case_grid').store.reload();
                        }
                        else if (Ext.getCmp('newrun_casegrid')){
                            Ext.getCmp('newrun_casegrid').store.reload();
                        }
                        else if (Ext.getCmp('caserun_grid')){
                            Ext.getCmp('caserun_grid').store.reload();
                        }
                        else if (Ext.getCmp('product_case_grid')){
                            Ext.getCmp('product_case_grid').store.reload();
                        }
                    },
                    failure: testopiaError
                });
            }
        },{
            text: 'Cancel',
            id: 'ncf_cancel_btn',
            handler: function(){
                Ext.getCmp('newcaseform').getForm().reset();
                try {
                    if (Ext.getCmp('newcase-win')) {
                        Ext.getCmp('newcase-win').close();
                    }
                    else{
                        window.location = 'tr_show_product.cgi';
                    }
                }
                catch (err){}
            }
        }]
    });
    Ext.getCmp('comp_product_combo').on('select', function(c,r,i){
        Ext.getCmp('component_picker').store.baseParams.product_id = r.get('id');
        Ext.getCmp('component_picker').store.load();
    });
    Ext.getCmp('component_picker').getSelectionModel().on('rowselect', function(m,i,r){
        Ext.getCmp('compfield').setValue(getSelectedObjects(Ext.getCmp('component_picker'),'id'));
        Ext.getCmp('default_tester').setValue(r.get('qa'));
    });
    Ext.getCmp('ncf_tabs').on('tabchange', function(t,p){
        p.doLayout();
    });
};
Ext.extend(NewCaseForm, Ext.form.FormPanel);

CasePlans = function(tcid, product_id){
    var t = new TestopiaUtil();
    this.remove = function(){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        form.submit({
            url: 'tr_process_case.cgi',
            params: {action: 'unlink', plan_id: getSelectedObjects(Ext.getCmp('case_plan_grid'), 'plan_id'), case_id: tcid},
            success: function(){
                ds.load();
            },
            failure: testopiaError
        });
    };
    this.store = new Ext.data.JsonStore({
        url: 'tr_process_case.cgi',
        baseParams: {action: 'getplans',case_id: tcid},
        root: 'plans',
        id: 'plan_id',
        fields: [
            {name: 'plan_id', mapping: 'plan_id'},
            {name: 'plan_name', mapping: 'plan_name'}
        ]
    });
    var ds = this.store;
    this.columns = [
        {header: 'ID', dataIndex: 'plan_id', hideable: false, renderer: t.planLink},
        {header: 'Name', width: 150, dataIndex: 'plan_name', id: 'plan_name', sortable:true, hideable: false}
    ];
    
    var newplan = new Ext.form.ComboBox({
        store: new TestPlanStore({product_id: product_id, viewall: 1}, false),
        loadingText: 'Looking up plans...',
        id: 'link_plan_combo',
        width: 150,
        displayField: 'name',
        valueField: 'plan_id',
        typeAhead: true,
        triggerAction: 'all',
        minListWidth: 300,
        forceSelection: true,
        emptyText: 'Choose a Plan...'
    });
    
    var addButton = new Ext.Button({
        icon: 'testopia/img/add.png',
        iconCls: 'img_button_16x',
        tooltip: 'Link to plan',
        handler: function(){
            var form = new Ext.form.BasicForm('testopia_helper_frm',{});
            form.submit({
                url: 'tr_process_case.cgi',
                params: {action: 'link', plan_ids: newplan.getValue(), case_id: tcid},
                success: function(){
                    ds.load();
                },
                failure: testopiaError
            });
        }
    });
    
    var deleteButton = new Ext.Button({
        icon: 'testopia/img/delete.png',
        iconCls: 'img_button_16x',
        tooltip: 'Unlink Selected Plans',
        handler: this.remove
    });
        
    CasePlans.superclass.constructor.call(this, {
        title: 'Plans',
        split: true,
        layout: 'fit',
        autoExpandColumn: "plan_name",
        collapsible: true,
        id: 'case_plan_grid',
        loadMask: {msg:'Loading plans...'},
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true
        }),
        viewConfig: {
            forceFit:true
        },
        tbar: [newplan, addButton, deleteButton]
    });

    ds.on('load', function(s,r,o){
        if (s.getCount() == 1){
            deleteButton.disable();
        }
        else{
            deleteButton.enable();
        }
    });

    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(CasePlans, Ext.grid.GridPanel, {
    onContextClick: function(grid, index, e){
        grid.getSelectionModel().selectRow(index);
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'tags-ctx-menu',
                items: [
                    {
                         text: 'Unlink Selected Plans',
                         id: 'plan_remove_mnu',
                         icon: 'testopia/img/delete.png',
                         iconCls: 'img_button_16x',
                         handler: grid.remove
                    },{
                        text: 'Go to Plan',
                        handler: function (){
                            window.location = 'tr_show_plan.cgi?plan_id=' + grid.getSelectionModel().getSelected().get('plan_id');
                        }
                    },{
                        text: 'Refresh', 
                        handler: function(){
                            grid.store.reload();
                        } 
                    }
                ]
            });
        }
        if (this.store.getCount() == 1){
            Ext.getCmp('plan_remove_mnu').disable();
        }
        else{
            Ext.getCmp('plan_remove_mnu').enable();
        }
        e.stopEvent();
        this.menu.showAt(e.getXY());
    },

    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

CaseClonePanel = function(product_id, cases){
    var pgrid = new PlanGrid({product_id: product_id},{id: 'plan_clone_grid'});
    CaseClonePanel.superclass.constructor.call(this,{
        id: 'case-clone-panel',
        layout: 'border',
        items:[{
            region: 'north',
            layout: 'fit',
            border: false,
            height: 300,
            items:[pgrid]
        },{
            region: 'center',
            xtype: 'form',
            title:'Clone Options',
            id: 'case_clone_frm',
            border: false,
            frame: true,
            bodyStyle: 'padding: 10px',
            labelWidth: 250,
            height: 280,
            items: [{
                xtype: 'fieldset',
                autoHeight: true,
                checkboxToggle: true,
                checkboxName: 'copy_cases',
                title: 'Create a copy (Unchecking will create a link to selected plans)',
                id: 'case_copy_method',
                collapsed: true,
                items: [{
                    xtype: 'hidden',
                    id: 'case_copy_plan_ids',
                    name: 'plan_ids'
                },{
                    xtype: 'hidden',
                    id: 'case_clone_product_id',
                    value: product_id,
                    name: 'product_id'
                },{
                    xtype: 'checkbox',
                    boxLabel: 'Keep Author (unchecking will make you the author of copied cases)',
                    hideLabel: true,
                    name: 'keep_author',
                    checked: true
                },{
                    xtype: 'checkbox',
                    boxLabel: 'Keep Default Tester (unchecking will make you the default tester of copied cases)',
                    hideLabel: true,
                    name: 'keep_tester',
                    checked: true
                },{
                    xtype: 'checkbox',
                    boxLabel: 'Copy case document (action, expected results, etc.)',
                    hideLabel: true,
                    name: 'copy_doc',
                    checked: true
                },{
                    xtype: 'checkbox',
                    boxLabel: 'Copy Attachments',
                    hideLabel: true,
                    name: 'copy_attachments'
                },{
                    xtype: 'checkbox',
                    boxLabel: 'Copy Tags',
                    hideLabel: true,
                    name: 'copy_tags',
                    checked: true
                },{
                    xtype: 'checkbox',
                    boxLabel: 'Copy components',
                    hideLabel: true,
                    name: 'copy_comps',
                    checked: true
                },{
                    xtype: 'checkbox',
                    boxLabel: 'Copy category to new product',
                    hideLabel: true,
                    disabled: true,
                    id: 'case_clone_category_box',
                    name: 'copy_category',
                    checked: true
                }]
            }]
        }],
        buttons: [{
            text: 'Submit',
            handler: function(){
                Ext.getCmp('case_copy_plan_ids').setValue(getSelectedObjects(Ext.getCmp('plan_clone_grid'), 'plan_id'));
                var form = Ext.getCmp('case_clone_frm').getForm();
                var params = form.getValues();
                params.action = 'clone';
                params.ids = cases;
                form.submit({
                    url: 'tr_list_cases.cgi',
                    params: params,
                    success: function(form, data){
                        if (params.copy_cases){
                            if (data.result.tclist.length ==1){
                                Ext.Msg.show({
                                    title:'Test Case Copied',
                                    msg: 'Test case ' + data.result.tclist[0] + ' Copied from Case ' + cases + '. Would you like to go there now?',
                                    buttons: Ext.Msg.YESNO,
                                    icon: Ext.MessageBox.QUESTION,
                                    fn: function(btn){
                                        if (btn == 'yes'){
                                            window.location = 'tr_show_case.cgi?case_id=' + data.result.tclist[0];
                                        }
                                    }
                                });
                            }
                            else {
                                Ext.Msg.show({
                                    title:'Test Case Copied',
                                    msg: 'Test cases ' + data.result.tclist.join(',') + ' Copied successfully <a href="tr_list_cases.cgi?case_id=' + data.result.tclist.join(',') +'">View as List</a>',
                                    buttons: Ext.Msg.OK,
                                    icon: Ext.MessageBox.INFO
                                });
                            }
                        }
                        else {
                            Ext.Msg.show({
                                title:'Test Case(s) Linked',
                                msg: 'Test cases ' + cases + ' Linked successfully',
                                buttons: Ext.Msg.OK,
                                icon: Ext.MessageBox.INFO
                            });
                        }
                        Ext.getCmp('case-clone-win').close();
                        Ext.getCmp('case_plan_grid').store.reload();
                    },
                    failure: testopiaError
                });
            }
            
        },{
            text: 'Cancel',
            handler: function(){
                try {
                    Ext.getCmp('case-clone-win').close();
                }
                catch (err){
                    window.location = 'tr_show_product.cgi';
                }
            }
        }]
    });
};
Ext.extend(CaseClonePanel, Ext.Panel);

caseClonePopup = function(product_id, cases){
    var win = new Ext.Window({
        id: 'case-clone-win',
        closable:true,
        width: 800,
        height: 550,
        plain: true,
        shadow: false,
        layout: 'fit',
        items: [new CaseClonePanel(product_id, cases)]
    });
    var pg = Ext.getCmp('plan_clone_grid');
    Ext.apply(pg,{title: 'Select plans to clone cases to'});
    win.show(this);
    
    var items = pg.getTopToolbar().items.items;
    for (var i=0; i < items.length; i++){
        items[i].destroy();
    }
    var pchooser = new ProductCombo({mode: 'local', value: product_id});
    pchooser.on('select', function(c,r,i){
        pg.store.baseParams = {ctype: 'json', product_id: r.get('id')};
        if (r.get('id') != product_id){
            Ext.getCmp('case_clone_category_box').enable();
        }
        else {
            Ext.getCmp('case_clone_category_box').disable();
        }
        Ext.getCmp('case_clone_product_id').setValue(r.get('id'));
        pg.store.load();
    });
    pg.getTopToolbar().add(new Ext.menu.TextItem('Product: '), pchooser);
    pg.getSelectionModel().un('rowselect', pg.getSelectionModel().events['rowselect'].listeners[0].fn);
    pg.getSelectionModel().un('rowdeselect', pg.getSelectionModel().events['rowdeselect'].listeners[0].fn);
    pg.store.load();
};

/*
 * END OF FILE - /bnc-3.0/testopia/js/case.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/caserun.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

CaseRunPanel = function(params, run){
    var cgrid = new CaseRunGrid(params, run);
    var filter = new CaseRunFilter();
    var cr = new CaseRun();
    this.cgrid = cgrid;
    this.store = cgrid.store;
    this.params = params;
    this.caserun = cr;
    
    CaseRunPanel.superclass.constructor.call(this, {
        layout: 'border',
        title: 'Test Cases',
        id: 'caserun-panel',
        border: false,
        bodyBorder: false,
        items: [filter, cgrid, cr]
    });
    cr.disable();
    this.on('activate', this.onActivate, this);
};
Ext.extend(CaseRunPanel, Ext.Panel, {
    onActivate: function(event){
        this.store.load();
    }
});

CaseRunFilter = function (){
    this.form = new Ext.form.BasicForm('caserun_filter_form', {});
    var searchform = this.form;
    CaseRunFilter.superclass.constructor.call(this, {
        title: 'Search for Test Results',
        id: 'caserun_search',
        region: 'north',
        border: false,
        bodyBorder: false,
        layout: 'fit',
        split: true,
        frame: true,
        collapsible: true,
        height: 'auto',
        autoScroll: true,
        contentEl: 'caserun-filter-div',
        buttons: [
        new Ext.form.TextField({
            id: 'caserun_save_filter_txt',
            validateOnBlur: false,
            allowBlank: false
        }),
        {
            text: 'Save Filter',
            handler: function(){
                if (! Ext.getCmp('caserun_save_filter_txt').isValid()){
                    Ext.Msg.show({
                       title:'Invalid Entry',
                       msg: 'Please enter a name for this filter',
                       buttons: Ext.Msg.OK,
                       icon: Ext.MessageBox.WARNING
                    });
                    return false;
                }
                var testopia_form = new Ext.form.BasicForm('testopia_helper_frm',{});
                var params =  searchform.getValues();
                params.action = 'save_filter';
                params.query_name = Ext.getCmp('caserun_save_filter_txt').getValue();
                testopia_form.submit({
                    url: 'tr_process_run.cgi',
                    params: params,
                    success: function(){
                        Ext.getCmp('run_east_panel').activate('run_filter_grid');
                        Ext.getCmp('run_filter_grid').store.reload();
                        TestopiaUtil.notify.msg('Filter Saved', 'Added filter {0}', params.query_name);
                    },
                    failure: testopiaError
                });
            }
        },
//        new Ext.Toolbar.Fill(),
        {
            text: 'Reset',
            handler: function(){
                document.getElementById('caserun_filter_form').reset();
                var ds = Ext.getCmp('caserun_grid').store;
                var run_id = ds.baseParams.run_id;
                var ctype = ds.baseParams.ctype;
                
                ds.baseParams = {};
                ds.baseParams.run_id = run_id;
                ds.baseParams.ctype = ctype;
                ds.baseParams.limit = Ext.getCmp('testopia_pager').pageSize;
                
                ds.load({
                    callback: function(){
                        Ext.getCmp('filtered_txt').hide();
                        if (Ext.getCmp('caserun_grid').getSelectionModel().getCount() < 1){
                            Ext.getCmp('caserun-panel').caserun.disable();
                        }
                    }
                });
            }
        },{
            text: 'Filter',
            handler: function(){
                var ds = Ext.getCmp('caserun_grid').store;
                ds.baseParams = searchform.getValues();
                ds.baseParams.limit = Ext.getCmp('testopia_pager').pageSize;
                ds.baseParams.distinct = 1;
                ds.load({
                    callback: function(){
                        Ext.getCmp('filtered_txt').show();
                        if (Ext.getCmp('caserun_grid').getSelectionModel().getCount() < 1){
                            Ext.getCmp('caserun-panel').caserun.disable();
                        }
                    }
                });
            }
        }]
    });
};
Ext.extend(CaseRunFilter, Ext.Panel);

CaseRunListGrid = function(params, cfg){
    var tutil = new TestopiaUtil();
    this.params = params;
    this.store = new Ext.data.GroupingStore({
        url: 'tr_list_caseruns.cgi',
        baseParams: {ctype: 'json'},
        reader: new Ext.data.JsonReader({
            totalProperty: 'totalResultsAvailable',
            root: 'Result',
            id: 'caserun_id',
            fields: [
               {name: "caserun_id", mapping:"case_run_id"},
               {name: "case_id", mapping:"case_id"},
               {name: "run_id", mapping: "run_id"},
               {name: "build", mapping:"build_name"},
               {name: "environment", mapping:"env_name"},
               {name: "assignee", mapping:"assignee_name"},
               {name: "testedby", mapping:"testedby"},
               {name: "status", mapping:"status"},
               {name: "category", mapping:"category"},
               {name: "priority", mapping:"priority"},
               {name: "close_date", mapping:"close_date"},
               {name: "bug_count", mapping:"bug_count"},
               {name: "case_summary", mapping:"case_summary"},
               {name: "component", mapping:"component"}
               
        ]}),
        remoteSort: true,
        sortInfo: {field: 'run_id', direction: "ASC"},
        groupField: 'run_id'
    });
    this.store.paramNames.sort = 'order';
    this.bbar = new TestopiaPager('caserun', this.store);
    this.columns = [
        {header: "Case", width: 50, dataIndex: 'case_id', sortable: true},
        {header: "Run", width: 50, dataIndex: 'run_id', sortable: true, 
         groupRenderer: function(v){return v;},
         renderer: tutil.runLink },
        {header: "Build", width: 50, dataIndex: 'build', sortable: true, id: 'caserun_list_build_col'},
        {header: "Environment", width: 50, dataIndex: 'environment', sortable: true},
		{header: "Assignee", width: 150, sortable: true, dataIndex: 'assignee'},
        {header: "Tested By", width: 150, sortable: true, dataIndex: 'testedby'},
		{header: "Status", width: 30, sortable: true, dataIndex: 'status', groupRenderer: function(v){return v;}, renderer: tutil.statusIcon},		
        {header: "Closed", width: 60, sortable: true, dataIndex: 'close_date'},
        {header: "Priority", width: 60, sortable: true, dataIndex: 'priority'},
        {header: "Category", width: 100, sortable: true,dataIndex: 'category'},
        {header: "Component", width: 100, sortable: true,dataIndex: 'component'}
    ];
    this.view = new Ext.grid.GroupingView({
        forceFit: true,
        groupTextTpl: '{text} ({[values.rs.length]} {[values.rs.length > 1 ? "Items" : "Item"]})'
    });

    CaseRunListGrid.superclass.constructor.call(this,{
        id: 'caserun_list_grid',
        title: 'Case Run History',
        loadMask: {msg:'Loading Test Cases...'},
        layout: 'fit',
        region: 'center',
        autoExpandColumn: "caserun_list_build_col",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false
        }),
        viewConfig: {
            forceFit:true
        }
    });
    Ext.apply(this,cfg);
    this.on('activate', this.onActivate, this);
};
Ext.extend(CaseRunListGrid, Ext.grid.GridPanel, {
    deleteList: function(){
        var grid = this;
        Ext.Msg.show({
            title:'Confirm Delete?',
            msg: CASERUN_DELETE_WARNING,
            buttons: Ext.Msg.YESNO,
            animEl: 'caserun-delete-btn',
            icon: Ext.MessageBox.QUESTION,
            fn: function(btn){
                if (btn == 'yes'){
                    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm');
                    testopia_form.submit({
                        url: 'tr_list_caseruns.cgi',
                        params: {caserun_ids: getSelectedObjects(grid,'caserun_id'), action:'delete', single: true, ctype: 'json'},
                        success: function(data){
                            Ext.Msg.show({
                                msg: "Test cases removed",
                                buttons: Ext.Msg.OK,
                                icon: Ext.MessageBox.INFO
                            });
                            grid.store.reload();
                        },
                        failure: function(f,a){
                            testopiaError(f,a);
                            grid.store.reload();
                        }
                    });
                }
            }
        });
    },
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load({params: this.params});
        }
    }
});

CaseRunGrid = function(params, run){
    params.limit = Ext.state.Manager.get('TESTOPIA_DEFAULT_PAGE_SIZE', 25);
    var t = new TestopiaUtil();
    this.params = params;
    this.run = run;
    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm',{});
    var selected;
    
    envRenderer = function(v,md,r,ri,ci,s){
        var f = this.getColumnModel().getCellEditor(ci,ri).field;
        record = f.store.getById(v);
        if (record) {
            return '<a href="tr_environments.cgi?env_id=' + record.data[f.valueField] +'">' + record.data[f.displayField] +'</a>';
        }
        else {
            return '<a href="tr_environments.cgi?env_id=' + r.data.env_id +'">' + v +'</a>';
        }        
    };
    this.store = new Ext.data.GroupingStore({
        url: 'tr_list_caseruns.cgi',
        baseParams: params,
        reader: new Ext.data.JsonReader({
            totalProperty: 'totalResultsAvailable',
            root: 'Result',
            id: 'caserun_id',
            fields: [
               {name: "caserun_id", mapping:"case_run_id"},
               {name: "sortkey", mapping:"sortkey"},
               {name: "case_id", mapping:"case_id"},
               {name: "run_id", mapping: "run_id"},
               {name: "build", mapping:"build_name"},
               {name: "environment", mapping:"env_name"},
               {name: "env_id", mapping:"env_id"},
               {name: "assignee", mapping:"assignee_name"},
               {name: "testedby", mapping:"testedby"},
               {name: "status", mapping:"status"},
               {name: "requirement", mapping:"requirement"},
               {name: "category", mapping:"category"},
               {name: "priority", mapping:"priority"},
               {name: "bug_count", mapping:"bug_count"},
               {name: "case_summary", mapping:"case_summary"},
               {name: "type", mapping:"type"},
               {name: "id", mapping:"id"},
               {name: "component", mapping:"component"},
               {name: "bug_list", mapping:"bug_list"}
               
        ]}),
        remoteSort: true,
        sortInfo: {field: 'sortkey', direction: "ASC"},
        groupField: 'run_id'
    });
    var ds = this.store;
    ds.paramNames.sort = "order";
    ds.on('beforeload',function(store, o){
        store.baseParams.ctype = 'json';
    });

    var buildCombo = new BuildCombo({
        id: 'tb_build',
        width: 100,
        fieldLabel: 'Build',
        hiddenName: 'build',
        mode: 'remote',
        forceSelection: false,
        allowBlank: false,
        typeAhead: true,
        disabled: true,
        params: {product_id: run.plan.product_id, activeonly: 1}
    });
    var envCombo = new EnvironmentCombo({
        id: 'tb_environment',
        width: 100,
        fieldLabel: 'Environment',
        hiddenName: 'environment',
        mode: 'remote',
        forceSelection: false,
        allowBlank: false,
        typeAhead: true,
        disabled: true,
        params: {product_id: run.plan.product_id, isactive: 1}
    });
    buildCombo.on('select',function(c,r,i){
        params = {
            build_id: r.get('id'), 
            ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')
        };
        TestopiaUpdateMultiple('caserun', params, Ext.getCmp('caserun_grid'));
    });
    envCombo.on('select',function(c,r,i){
        params = {
            env_id: r.get('environment_id'), 
            ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')
        };
        TestopiaUpdateMultiple('caserun', params, Ext.getCmp('caserun_grid'));
    });
    this.object_type = 'environment';
    this.columns = [
        {header: "Case", width: 50, dataIndex: 'case_id', sortable: true, renderer: t.caseLink},
        {header: "Run", width: 50, dataIndex: 'run_id', sortable: true, renderer: t.runLink, hidden:true},
        {header: "Index", width: 50, dataIndex: 'sortkey', sortable: true,
         editor: new Ext.grid.GridEditor(
             new Ext.form.NumberField()
         )},
        {header: "Build", width: 50, dataIndex: 'build', sortable: true,
         editor: new Ext.grid.GridEditor(
             new BuildCombo({params: {product_id: run.plan.product_id, activeonly: 1}})
         ),renderer: TestopiaComboRenderer.createDelegate(this)},
        {header: "Environment", width: 50, dataIndex: 'environment', sortable: true,
         editor: new Ext.grid.GridEditor(
             new EnvironmentCombo({params: {product_id: run.plan.product_id, isactive: 1}})
         ),renderer: envRenderer.createDelegate(this)},
		{header: "Assignee", width: 150, sortable: true, dataIndex: 'assignee',
         editor: new Ext.grid.GridEditor(
             new UserLookup({id: 'caserun_assignee'})
         ),renderer: TestopiaComboRenderer.createDelegate(this)},
        {header: "Tested By", width: 150, sortable: true, dataIndex: 'testedby'},
		{header: "Status", width: 30, sortable: true, dataIndex: 'status', align: 'center', renderer: t.statusIcon},
        {header: "Priority", width: 60, sortable: true, dataIndex: 'priority',
         editor: new Ext.grid.GridEditor(
             new PriorityCombo({id: 'caserun_priority'})
         ),renderer: TestopiaComboRenderer.createDelegate(this)},
        {header: "Category", width: 100, sortable: true,dataIndex: 'category',
         editor: new Ext.grid.GridEditor(
             new CaseCategoryCombo({id: 'caserun_category', params: {product_id: run.plan.product_id}})
         ),renderer: TestopiaComboRenderer.createDelegate(this)},
        {header: "Requirement", width: 150, sortable: true, dataIndex: 'requirement', hidden: true},
        {header: "Component", width: 100, sortable: true,dataIndex: 'component'},
        {
            header: "Bugs In This Build and Environment",
            width: 100,
            dataIndex: "bug_list",
            sortable: false,
            hideable: true,
            renderer: function(v){
                var bugs = v.bugs;
                var rets = '';
                for (var i=0; i< bugs.length; i++){
                    if (typeof bugs[i] != 'function'){
                        rets = rets + '<a href="show_bug.cgi?id=' + bugs[i].bug_id +'" ' + (bugs[i].closed ? 'class="bz_closed"' : '') +'>' + bugs[i].bug_id + '</a>, ';
                    }
                    
                }
                return rets;
            }
        }
    ];

    var imgButtonTpl = new Ext.Template(
        '<table border="0" cellpadding="0" cellspacing="0"><tbody><tr>' +
        '<td><button type="button"><img src="{0}"></button></td>' +
        '</tr></tbody></table>');
    
    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
    this.bbar = new TestopiaPager('caserun', this.store);
    this.tbar = new Ext.Toolbar({
        id: 'caserun_grid_tb',
        items: [
            new Ext.Button({
                template:imgButtonTpl,
                text: 'testopia/img/IDLE.gif',
                tooltip: 'Mark as IDLE (Not Run)',
                disabled: true,
                handler: function(){
                    TestopiaUpdateMultiple('caserun', { status_id: 1, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')}, Ext.getCmp('caserun_grid'));
                }
            }),new Ext.Button({
                template:imgButtonTpl,
                text: 'testopia/img/PASSED.gif',
                tooltip: 'Mark as PASSED',
                disabled: true,
                handler: function(){
                    TestopiaUpdateMultiple('caserun', { status_id: 2, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id'), update_bug: Ext.getCmp('update_bugs').getValue()}, Ext.getCmp('caserun_grid'));
                }
            }),new Ext.Button({
                template:imgButtonTpl,
                text: 'testopia/img/FAILED.gif',
                tooltip: 'Mark as FAILED',
                disabled: true,
                handler: function(){
                    TestopiaUpdateMultiple('caserun', { status_id: 3, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id'), update_bug: Ext.getCmp('update_bugs').getValue()}, Ext.getCmp('caserun_grid'));
                }
            }),new Ext.Button({
                template:imgButtonTpl,
                text: 'testopia/img/RUNNING.gif',
                tooltip: 'Mark as RUNNING',
                disabled: true,
                handler: function(){
                    var reassign = 0;
                    var isowner = 1;
                    var sel = Ext.getCmp('caserun_grid').getSelectionModel().getSelections();
                    for (var i=0; i < sel.length; i++){
                        if (sel[i].get('assignee') != user_login){
                            isowner = 0;
                            break;
                        }
                    }
                    if (isowner == 0){
                        Ext.Msg.show({
                            title: "Reassign Test Case?",
                            msg: 'Setting this test case to Running will lock it so that only the assignee can update it. Would you like to make yourself the assignee?',
                            buttons: Ext.MessageBox.YESNO,
                            icon: Ext.MessageBox.QUESTION,
                            fn: function(btn){
                                if (btn == 'yes'){
                                    reassign = 1;
                                }
                                TestopiaUpdateMultiple('caserun', { status_id: 4, reassign: reassign, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')}, Ext.getCmp('caserun_grid'));
                            }
                        });
                    }
                    else {
                        TestopiaUpdateMultiple('caserun', { status_id: 4, reassign: reassign, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')}, Ext.getCmp('caserun_grid'));
                    }
                }
            }),new Ext.Button({
                template:imgButtonTpl,
                text: 'testopia/img/PAUSED.gif',
                tooltip: 'Mark as PAUSED',
                disabled: true,
                handler: function(){
                    TestopiaUpdateMultiple('caserun', { status_id: 5, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')}, Ext.getCmp('caserun_grid'));
                }
            }),new Ext.Button({
                template:imgButtonTpl,
                text: 'testopia/img/BLOCKED.gif',
                tooltip: 'Mark as BLOCKED',
                disabled: true,
                handler: function(){
                    TestopiaUpdateMultiple('caserun', { status_id: 6, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')}, Ext.getCmp('caserun_grid'));
                }
            }),new Ext.Button({
                template:imgButtonTpl,
                text: 'testopia/img/ERROR.gif',
                tooltip: 'Mark as ERROR',
                disabled: true,
                handler: function(){
                    TestopiaUpdateMultiple('caserun', { status_id: 7, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')}, Ext.getCmp('caserun_grid'));
                }
            }),new Ext.menu.TextItem('Update Bugs: '),
             new Ext.form.Checkbox({
                 id: 'update_bugs',
                 disabled: true,
                 tooltip: 'Update Status of Attached Bugs.<p><b>FAILED = REOPENED<br>PASSED = VERIFIED</b></p>'
             }),
            new Ext.Toolbar.Spacer(),new Ext.Toolbar.Separator(),new Ext.Toolbar.Spacer(),
             buildCombo,new Ext.Toolbar.Spacer(),
             envCombo,new Ext.Toolbar.Spacer(),new Ext.Toolbar.Separator(),new Ext.Toolbar.Spacer(),
            new Ext.Toolbar.Fill(),
            {
                xtype: 'button',
                id: 'add_case_to_run_btn',
                tooltip: "Add cases to this run",
                icon: 'testopia/img/add.png',
                iconCls: 'img_button_16x',
                handler: function(){
                    t.addCaseToRunPopup(run);
                }
            },{
                xtype: 'button',
                id: 'new_case_to_run_btn',
                tooltip: "Create a new case and add it to this run",
                icon: 'testopia/img/new.png',
                iconCls: 'img_button_16x',
                handler: function(){
                    t.newCaseForm(run.plan_id, run.product_id, run.run_id);
                }
            },{
                xtype: 'button',
                template: button_16x_tmpl,
                id: 'caserun_grid_edit_btn',
                icon: 'testopia/img/edit.png',
                iconCls: 'img_button_16x',
                tooltip: 'Edit Selected Test Case',
//                disabled: true,
                handler: function(){
                    editFirstSelection(Ext.getCmp('caserun_grid'));
                }
            },{
                xtype: 'button',
                template: button_16x_tmpl,
                id: 'caserun_grid_delete_btn',
                icon: 'testopia/img/delete.png',
                iconCls: 'img_button_16x',
//                disabled: true,
                tooltip: 'Remove Selected Test Cases from This Run',
                handler: this.deleteList.createDelegate(this)
            },
            new RunProgress({
                id: 'run_progress',
                text: '0%',
                width: 100
            })]
    });
    CaseRunGrid.superclass.constructor.call(this, {
        region: 'center',
        id: 'caserun_grid',
        border: false,
        bodyBorder: false,
        height: '400',
        split: true,
        enableDragDrop: true,
        loadMask: {msg:'Loading Test Cases...'},
        autoExpandColumn: "case_summary",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false,
            listeners: {'rowdeselect': function (sm,n,r){
                if (sm.getCount() < 1){
                    Ext.getCmp('case_details_panel').disable();
                    Ext.getCmp('tb_build').disable();
                    Ext.getCmp('tb_environment').disable();
                    Ext.getCmp('update_bugs').disable();
        
                    var items = this.grid.getTopToolbar().items.items;
                    for (var i=0; i < items.length; i++){
                        if ((items[i].id == 'add_case_to_run_btn' || items[i].id == 'run_progress')){
                            if (Ext.getCmp('run_status_cycle').text == 'RUNNING'){
                                items[i].enable();
                            }
                        }
                        else{
                            items[i].disable();
                        }
                    }
                }
            },'rowselect': function (sm,n,r){
                Ext.getCmp('case_details_panel').enable();
                Ext.getCmp('tb_build').enable();
                Ext.getCmp('tb_environment').enable();
                Ext.getCmp('update_bugs').enable();
                if (Ext.getCmp('run_status_cycle').text == 'RUNNING'){
                    var items = sm.grid.getTopToolbar().items.items;
                    for (var i=0; i < items.length; i++){
                        items[i].enable();
                    }
                }
                if (n == selected){
                    return;
                }
                var sel = [];
                for (i=0; i<sm.grid.store.data.items.length; i++){
                    if (sm.grid.getSelectionModel().isSelected(i)){
                        sel.push(sm.grid.store.getAt(i).get('case_id'));
                    }
                }
                sm.grid.selectedRows = sel;
                if (sm.getCount() > 1){
                    return;
                }
        
                Ext.getCmp('case_bugs_panel').tcid = r.get('case_id');
                Ext.getCmp('case_comps_panel').tcid = r.get('case_id');
                Ext.getCmp('attachments_panel').object = r.data;
                Ext.getCmp('case_details_panel').caserun_id = r.get('caserun_id');
                Ext.getCmp('casetagsgrid').obj_id = r.get('case_id');
                
                var tab = Ext.getCmp('caserun_center_region').getActiveTab();
                Ext.getCmp(tab.id).fireEvent('activate');
                if (Ext.getCmp('case_bugs_panel')){
                    Ext.getCmp('case_bugs_panel').case_id = r.get('case_id');
                }
                if (Ext.getCmp('case_bugs_panel')){
                    Ext.getCmp('case_bugs_panel').case_id = r.get('case_id');
                }
                Ext.getCmp('case_details_panel').store.load({
                    params: {
                        caserun_id: r.get('caserun_id'), 
                        action: 'gettext'
                    }
                });
                selected = n;
            }}
        }),
        viewConfig: {
            forceFit:true,
            enableRowBody:true,
            getRowClass : function(record, rowIndex, p, ds){
                p.body = '<p>'+record.data.case_summary+'</p>';
                return 'x-grid3-row-expanded';
            }
        }
    });
    
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('afteredit', this.onGridEdit, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(CaseRunGrid, Ext.grid.EditorGridPanel, {
    onContextClick: function(grid, index, e){
        grid.selindex = index;
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'caserun-ctx-menu',
                items: [
                {
                    text: 'Change', 
                    icon: 'testopia/img/edit.png',
                    iconCls: 'img_button_16x',
                    menu: {
                        items: [{
                            text: 'Build',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Build',
                                    id: 'status-win',
                                    plain: true,
                                    shadow: false,
                                    width: 320,
                                    height: 150,
                                    layout: 'form',
                                    bodyStyle: 'padding: 5px',
                                    items: [new BuildCombo({
                                        params: {product_id: grid.run.plan.product_id, activeonly: 1},
                                        fieldLabel: 'Build',
                                        id: 'multi_build'
                                    }),
                                    new Ext.form.Checkbox({
                                        fieldLabel: 'Apply to all cases in this run',
                                        id: 'build_applyall'
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            params = {
                                                run_id: grid.run.run_id, 
                                                applyall: Ext.getCmp('build_applyall').getValue(), 
                                                build_id: Ext.getCmp('multi_build').getValue(), 
                                                ids: getSelectedObjects(grid,'caserun_id')
                                            };
                                            TestopiaUpdateMultiple('caserun', params, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        },{
                            text: 'Environment',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Environment',
                                    id: 'status-win',
                                    plain: true,
                                    shadow: false,
                                    width: 320,
                                    height: 150,
                                    layout: 'form',
                                    bodyStyle: 'padding: 5px',
                                    items: [new EnvironmentCombo({
                                        params: {product_id: grid.run.plan.product_id, isactive: 1},
                                        fieldLabel: 'Environment',
                                        id: 'multi_env'
                                    }),
                                    new Ext.form.Checkbox({
                                        fieldLabel: 'Apply to all cases in this run',
                                        id: 'env_applyall'
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            params = {
                                                run_id: grid.run.run_id, 
                                                applyall: Ext.getCmp('env_applyall').getValue(), 
                                                env_id: Ext.getCmp('multi_env').getValue(), 
                                                ids: getSelectedObjects(grid,'caserun_id')
                                            };
                                            TestopiaUpdateMultiple('caserun', params, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        },{
                            text: 'Priority',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Priority',
                                    id: 'priority-win',
                                    plain: true,
                                    shadow: false,
                                    width: 320,
                                    height: 150,
                                    layout: 'form',
                                    bodyStyle: 'padding: 5px',
                                    items: [new PriorityCombo({
                                        fieldLabel: 'Priority',
                                        id: 'multi_priority'
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            params = {
                                                run_id: grid.run.run_id, 
                                                priority: Ext.getCmp('multi_priority').getValue(), 
                                                ids: getSelectedObjects(grid,'case_id')
                                            };
                                            TestopiaUpdateMultiple('case', params, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        },{
                            text: 'Category',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Category',
                                    id: 'status-win',
                                    plain: true,
                                    shadow: false,
                                    width: 300,
                                    height: 150,
                                    items: [new CaseCategoryCombo({
                                        fieldLabel: 'Category',
                                        params: {product_id: run.product_id}
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            TestopiaUpdateMultiple('case', {category: Ext.getCmp('case_category_combo').getValue(), ids: getSelectedObjects(grid,'case_id')}, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        },{
                            text: 'Assignee',
                            handler: function(){
                                var win = new Ext.Window({
                                    title: 'Edit Assignee',
                                    id: 'status-win',
                                    plain: true,
                                    shadow: false,
                                    width: 320,
                                    height: 150,
                                    layout: 'form',
                                    bodyStyle: 'padding: 5px',
                                    items: [new UserLookup({
                                        fieldLabel: 'Assignee',
                                        id: 'multi_assignee'
                                    }),
                                    new Ext.form.Checkbox({
                                        fieldLabel: 'Apply to all cases in this run',
                                        id: 'assignee_applyall'
                                    })],
                                    buttons: [{
                                        text:'Submit',
                                        handler: function(){
                                            params = {
                                                run_id: grid.run.run_id, 
                                                applyall: Ext.getCmp('assignee_applyall').getValue(), 
                                                assignee: Ext.getCmp('multi_assignee').getValue(), 
                                                ids: getSelectedObjects(grid,'caserun_id')
                                            };
                                            TestopiaUpdateMultiple('caserun', params, grid);
                                            win.close();
                                        }
                                    },{
                                        text: 'Close',
                                        handler: function(){
                                            win.close();
                                        }
                                    }]
                                });
                                win.show(this);
                            }
                        }]
                    }
                },{
                    text: 'Remove Selected Cases', 
                    icon: 'testopia/img/delete.png',
                    iconCls: 'img_button_16x',
                    handler: this.deleteList.createDelegate(this)
                },{
                    text: 'Add or Remove Tags', 
                    handler: function(){
                        TagsUpdate('case', grid);
                    }
                },{
                    text: 'New Test Run', 
                    id:'addRun',
                    handler: function(){
                         window.location="tr_new_run.cgi?plan_id=" + run.plan_id;
                    } 
                },{
                    text: 'Clone Run with Selected Cases', 
                    handler: function(){
                        RunClonePopup(grid.run.product_id,grid.run.run_id, getSelectedObjects(grid,'case_id'));
                    }
                },{
                    text: 'Copy or Link Selected Test Cases to Plan(s)... ',
                    handler: function(){
                        var r = grid.getSelectionModel().getSelected();
                        caseClonePopup(grid.run.product_id, getSelectedObjects(grid,'case_id'));
                    }
                },{
                    text: 'Add Selected Test Cases to Run... ',
                    handler: function(){
                        Ext.Msg.prompt('Add to runs', '', function(btn, text){
                            if (btn == 'ok'){
                                TestopiaUpdateMultiple('case', {addruns: text, ids: getSelectedObjects(grid,'case_id')}, grid);
                            }
                        });
                    }
                },{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    } 
                },{
                    text: 'View Test Case in a New Window',
                    handler: function(){
                        window.open('tr_show_case.cgi?case_id=' + grid.store.getAt(grid.selindex).get('case_id'));
                    }
                },{
                    text: 'List These Test Cases in a New Window',
                    handler: function(){
                        var params = Ext.getCmp('caserun_search').form.getValues();
                        if (params) {
                            window.open('tr_list_cases.cgi?' + jsonToSearch(params, '', ['current_tab']) + '&isactive=1');
                        }
                        else {
                            window.open('tr_list_cases.cgi?run_id=' + grid.store.getAt(grid.selindex).get('run_id'));
                        }
                    }
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },
    onGridEdit: function(gevent){
        var myparams = {caserun_id: gevent.record.get('caserun_id')};
        var ds = this.store;
        
        switch(gevent.field){
        case 'sortkey':
            myparams.action = 'update_sortkey';
            myparams.sortkey = gevent.value; 
            break;
        case 'build':
            myparams.action = 'update_build';
            myparams.build_id = gevent.value;
            break;
        case 'environment':
            myparams.action = 'update_environment';
            myparams.caserun_env = gevent.value;
            break;
        case 'assignee':
            myparams.action = 'update_assignee';
            myparams.assignee = gevent.value;
            break;
        case 'priority':
            myparams.action = 'update_priority';
            myparams.priority = gevent.value;
            break;
        case 'category':
            myparams.action = 'update_scategory';
            myparams.category = gevent.value;
            break;
        }
        this.form.submit({
            url:"tr_caserun.cgi",
            params: myparams,
            success: function(f,a){
                if (a.result.caserun){
                    var switched = gevent.grid.store.reader.readRecords({Result:[a.result.caserun]}).records[0];
                    gevent.grid.store.insert(gevent.row, switched);
                    ds.commitChanges();
                    gevent.grid.store.remove(gevent.record);
                    gevent.grid.getSelectionModel().selectRow(gevent.row);
                }
                else{
                    ds.commitChanges();
                }
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
    },
    deleteList: function(){
        var grid = this;
        if (grid.getSelectionModel().getCount() < 1){
            return;
        }
        Ext.Msg.show({
            title:'Confirm Delete?',
            msg: CASERUN_DELETE_WARNING,
            buttons: Ext.Msg.YESNO,
            animEl: 'caserun-delete-btn',
            icon: Ext.MessageBox.QUESTION,
            fn: function(btn){
                if (btn == 'yes'){
                    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm');
                    testopia_form.submit({
                        url: 'tr_list_caseruns.cgi',
                        params: {caserun_ids: getSelectedObjects(grid,'caserun_id'), action:'delete', ctype: 'json'},
                        success: function(data){
                            Ext.Msg.show({
                                msg: "Test cases removed",
                                buttons: Ext.Msg.OK,
                                icon: Ext.MessageBox.INFO
                            });
                            grid.store.reload();
                        },
                        failure: function(f,a){
                            testopiaError(f,a);
                            grid.store.reload();
                        }
                    });
                }
            }
        });
    },
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

CaseRun = function(){
    var t = new TestopiaUtil();
    this.caserun_id;
    this.store =  new Ext.data.Store({
        url: 'tr_caserun.cgi',
        baseParams: {action: 'gettext'},
        reader: new Ext.data.XmlReader({
            record: 'casetext',
            id: 'case_id'
        },[
            {name: 'action', mapping: 'action'},
            {name: 'results', mapping: 'effect'},
            {name: 'setup', mapping: 'setup'},
            {name: 'breakdown', mapping: 'breakdown'},
            {name: 'notes', mapping: 'notes'}
        ])
    });
    var store = this.store;
    store.on('load', function(s,r){
        Ext.getCmp('action_editor').setValue(r[0].get('action'));
        Ext.getCmp('effect_editor').setValue(r[0].get('results'));
        Ext.getCmp('setup_editor').setValue(r[0].get('setup'));
        Ext.getCmp('breakdown_editor').setValue(r[0].get('breakdown'));
    });
    
    appendNote = function(){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        form.submit({
            url: 'tr_caserun.cgi',
            params: {action: 'update_note', note: Ext.getCmp('caserun_append_note_fld').getValue(), caserun_id: this.caserun_id},
            success: function(){
                Ext.getCmp('caserun_append_note_fld').reset();
                store.reload();
            },
            failure: testopiaError
        });
    };
    processText = function(){
        var testopia_form = new Ext.form.BasicForm('testopia_helper_frm',{});
        var params = {};
        params.tcsetup = Ext.getCmp('setup_editor').getValue();
        params.tcbreakdown = Ext.getCmp('breakdown_editor').getValue();
        params.tcaction = Ext.getCmp('action_editor').getValue();
        params.tceffect = Ext.getCmp('effect_editor').getValue();
        params.case_id = Ext.getCmp('caserun_grid').getSelectionModel().getSelected().get('case_id');
        params.action = 'update_doc';
        testopia_form.submit({
            url: 'tr_process_case.cgi',
            params: params,
            success: function(){
                TestopiaUtil.notify.msg('Test case updated', 'Test Case {0} was updated successfully', 'Document');
            },
            failure: testopiaError
        });
    }
    CaseRun.superclass.constructor.call(this,{
        id: 'case_details_panel',
        layout: 'fit',
        region: 'south',
        split: true,
        border: false,
        bodyBorder: false,
        collapsible: true,
        height: 300,
        items:[{
            xtype: 'tabpanel',
            bodyBorder: false,
            activeTab: 0,
            id: 'caserun_center_region',
            title:'Details',
            width: 200,
            items: [{
                layout: 'column',
                title: 'Action / Expected Results',
                id: 'action_panel',
                items: [{
                    columnWidth:0.5,
                    layout:'fit',
                    items:{
                        title: 'Action',
                        height: 230,
                        bodyBorder: false,
                        border: false,
                        layout: 'fit',
                        autoScroll: true,
                        items:[{
                            id: 'action_editor',
                            xtype:'htmleditor'
                        }]
                    }
                },{
                    columnWidth:0.5,
                    layout:'fit',
                    items:{
                        title: 'Expected Results',
                        height: 230,
                        bodyBorder: false,
                        border: false,
                        autoScroll: true,
                        layout: 'fit',
                        items:[{
                            id: 'effect_editor',
                            xtype:'htmleditor'
                        }]  
                    }
                }],
                buttons: [{ 
                    text: 'Update Action/Results',
                    handler: processText.createDelegate(this)
                }]
            },{
                layout: 'column',
                title: 'Set Up / Break Down',
                items: [{
                    columnWidth:0.5,
                    layout:'fit',
                    items:{
                        title: 'Setup',
                        height: 230,
                        bodyBorder: false,
                        autoScroll: true,
                        border: false,
                        layout: 'fit',
                        items:[{
                            id: 'setup_editor',
                            xtype:'htmleditor'
                        }]
                    }
                },{
                    columnWidth:0.5,
                    layout:'fit',
                    items:{
                        title: 'Breakdown',
                        height: 230,
                        bodyBorder: false,
                        autoScroll: true,
                        border: false,
                        layout: 'fit',
                        items:[{
                            id: 'breakdown_editor',
                            xtype:'htmleditor'
                        }]
                    }
                }],
                buttons: [{ 
                    text: 'Update Setup/Breakdown',
                    handler: processText.createDelegate(this)
                }]
            },{
                title:'Notes',
                id: 'caserun_notes_panel',
                border:false,
                bodyBorder: false,
                autoScroll: true,
                layout: 'fit',
                items: [{
                    xtype: 'dataview',
                    bodyBorder: false,
                    store: store,
                    itemSelector: 'div.breakdowndiv',
                    loadingText: 'Loading...',
                    tpl: new Ext.XTemplate(
                        '<tpl for=".">',
                           '<div id="notesdiv" style="margin: 5px; padding: 5px; border: 1px solid black;"><pre>{notes}</pre></div>',
                        '</tpl>',
                        '<div class="x-clear"><input id="caserun_append_note_fld" ></div>'
                    )
                }],
                bbar:[{
                    xtype: 'textfield',
                    id: 'caserun_append_note_fld',
                    width: 1000
                }],
                buttons:[{
                    xtype: 'button',
                    text: 'Append Note',
                    handler: appendNote.createDelegate(this)
                }]
            },
            new CaseRunHistory(), 
            new AttachGrid({id: 0, type: 'caserun'}),
            new CaseBugsGrid(),
            new CaseComponentsGrid(),
            new TestopiaObjectTags('case', 0)]
        }]
    });
};
Ext.extend(CaseRun, Ext.Panel, this);

CaseRunHistory = function(){
    var t = new TestopiaUtil();
    
    this.store = new Ext.data.JsonStore({
        url: 'tr_caserun.cgi',
        baseParams: {action: 'gethistory'},
        root: 'records',
        fields: [
            {name: 'caserun_id', mapping: 'case_run_id'},
            {name: 'build', mapping: 'build_name'},
            {name: 'environment', mapping: 'env_name'},
            {name: 'status', mapping: 'status_name'},
            {name: 'testedby', mapping: 'testedby'},
            {name: 'closed', mapping: 'close_date'},
            {name: 'isactive', mapping: 'isactive'}
        ]
    });
    this.columns = [
        {header: "Build", width: 150, dataIndex: 'build', sortable: true},
        {header: "Environment", width: 150, dataIndex: 'environment', sortable: true},
        {header: "Status", width: 50, dataIndex: 'status', sortable: true, renderer: t.statusIcon},
        {header: "Tested By", width: 200, dataIndex: 'testedby', sortable: true },
        {header: "Closed", width: 150, dataIndex: 'closed', sortable: true}
    ];
    CaseRunHistory.superclass.constructor.call(this,{
        border: false,
        title: 'History',
        id: 'caserun_history_panel',
        bodyBorder: false,
        loadMask: {msg:'Loading Test Cases...'},
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true
        })
    });
    this.on('activate', this.onActivate, this);
};

Ext.extend(CaseRunHistory, Ext.grid.GridPanel, {
    onActivate: function(event){
        this.store.load({
            params: {
                action: 'gethistory',
                caserun_id: Ext.getCmp('caserun_grid').getSelectionModel().getSelected().get('caserun_id')
            }
                
        });
    }
});

CaseBugsGrid = function(id){
    var tutil = new TestopiaUtil();
    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm',{});
    function bug_link(id){
        return '<a href="show_bug.cgi?id=' + id + '" target="_blank">' + id +'</a>';
    }

    var tcid;
    if (id){
        tcid = id;
    }

    this.tcid = tcid;
    this.store = new Ext.data.JsonStore({
        url: 'tr_process_case.cgi',
        root: 'bugs',
        baseParams: {action: 'getbugs'},
        id: 'bug_id',
        fields: [
            {name: 'run_id', mapping: 'run_id'},
            {name: 'build', mapping: 'build'},
            {name: 'env', mapping: 'env'},
            {name: 'summary', mapping: 'summary'},
            {name: 'bug_id', mapping: 'bug_id'},
            {name: 'status', mapping: 'status'},
            {name: 'resolution', mapping: 'resolution'},
            {name: 'assignee', mapping: 'assignee'},
            {name: 'severity', mapping: 'severity'},
            {name: 'priority', mapping: 'priority'}
        ]
    });
    addbug = function(){
        tcid = this.tcid;
        var ids;
        var type = 'case';
        if (Ext.getCmp('caserun_grid')){
            type = 'caserun';
            ids = getSelectedObjects(Ext.getCmp('caserun_grid'), 'caserun_id');
        }
        else {
            ids = tcid;
        }
        testopia_form.submit({
            url: 'tr_list_cases.cgi',
            params: {action: 'update_bugs', bug_action: 'attach', bugs: Ext.getCmp('attachbug').getValue(), type: type, ids: ids},
            success: function(){
                ds.load({
                    params: {case_id: tcid}
                });
                Ext.getCmp('attachbug').reset();
            },
            failure: testopiaError
        });
    };
    removebug = function(){
        tcid = this.tcid;
        var type = 'case';
        if (Ext.getCmp('caserun_grid')){
            type = 'caserun';
            ids = getSelectedObjects(Ext.getCmp('caserun_grid'), 'caserun_id');
        }
        else {
            ids = tcid;
        }
        testopia_form.submit({
            url: 'tr_list_cases.cgi',
            params: {action: 'update_bugs', bugs: getSelectedObjects(Ext.getCmp('case_bugs_panel'), 'bug_id'), type: type, ids: ids},
            success: function(){
                ds.load({
                    params: {
                        case_id: tcid
                    }
                });
            },
            failure: testopiaError
        });
    };
    newbug = function(){
        var bug_panel = new Ext.Panel({
            id: 'new_bug_panel'
        });
        var caserun_id;
        if (Ext.getCmp('caserun_grid') && Ext.getCmp('caserun_grid').getSelectionModel().getCount()){
            caserun_id = Ext.getCmp('caserun_grid').getSelectionModel().getSelected().get('caserun_id');
        }

        var store =  new Ext.data.Store({
            url: 'tr_process_case.cgi',
            baseParams: {action: 'case_to_bug', case_id: this.tcid, caserun_id: caserun_id },
            reader: new Ext.data.XmlReader({
                record: 'newbug',
                id: 'case_id'
            },[
                {name: 'product', mapping: 'product'},
                {name: 'version', mapping: 'version'},
                {name: 'component', mapping: 'coponent'},
                {name: 'comment', mapping: 'comment'},
                {name: 'case_id', mapping: 'case_id'},
                {name: 'assigned_to', mapping: 'assigned_to'},
                {name: 'qa_contact', mapping: 'qa_contact'},
                {name: 'short_desc', mapping: 'short_desc'}
            ])
        });
        store.load();
        store.on('load',function(){
            var url = 'enter_bug.cgi?';
            for (var i=0; i<store.fields.keys.length; i++){
                url = url + store.fields.keys[i] + '=' + escape(store.getAt(0).get(store.fields.keys[i])) + '&';
            }
            url = url + 'caserun_id=' + caserun_id;
            window.open(url, 'New Bug');
        });
    };
    var ds = this.store;
    this.columns = [
        {header: "Bug", width: 150, dataIndex: 'bug_id', sortable: true, renderer: bug_link},
        {header: "Found In Run", width: 50, dataIndex: 'run_id', sortable: true, renderer: tutil.runLink},
        {header: "With Build", width: 50, dataIndex: 'build', sortable: true},
        {header: "Environment", width: 50, dataIndex: 'env', sortable: true},
        {id: 'bugs_summary', header: "Summary", width: 200, dataIndex: 'summary', sortable: true},
        {header: "Status", width: 50, dataIndex: 'status', sortable: true},
        {header: "Resolution", width: 50, dataIndex: 'resolution', sortable: true},
        {header: "Severity", width: 50, dataIndex: 'severity', sortable: true},
        {header: "Asignee", width: 150, dataIndex: 'assignee', sortable: true},
        {header: "Priority", width: 50, dataIndex: 'priority', sortable: true}
    ];
    CaseBugsGrid.superclass.constructor.call(this,{
        tbar: [new Ext.form.TextField({
            width: 50,
            id: 'attachbug'
        }), {
            xtype: 'button',
            tooltip: "Attach a Bug",
            icon: 'testopia/img/add.png',
            iconCls: 'img_button_16x',
            handler: addbug.createDelegate(this)
        },{
            xtype: 'button',
            tooltip: "File new Bug",
            icon: 'testopia/img/new.png',
            iconCls: 'img_button_16x',
            handler: newbug.createDelegate(this)
        },{
            xtype: 'button',
            tooltip: "Remove selected bugs from test case",
            icon: 'testopia/img/delete.png',
            iconCls: 'img_button_16x',
            handler: removebug.createDelegate(this)
        },new Ext.Toolbar.Separator(), 
        new Ext.menu.TextItem('This view includes all bugs attached to the selected test case regardless of run')
        ],
        border: false,
        title: 'Bugs',
        id: 'case_bugs_panel',
        bodyBorder: false,
        autoExpandColumn: 'bugs_summary',
        loadMask: {msg:'Loading...'},
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true
        })
    });
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};
Ext.extend(CaseBugsGrid, Ext.grid.GridPanel, {
    onContextClick: function(grid, index, e){
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'tags-ctx-menu',
                items: [{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    } 
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },
    onActivate: function(event){
        this.store.load({
            params: {
                case_id: this.tcid
            }
        });
    }
});

CaseComponentsGrid = function(id){
    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm',{});
    var tcid;
    var product_id;
    if (id){
        tcid = id;
    }
    else{
        if(Ext.getCmp('caserun_grid').getSelectionModel().getCount()){
            tcid = Ext.getCmp('caserun_grid').getSelectionModel().getSelected().get('case_id');
        }
    }
    try{
        if(run){
            product_id = run.plan.product_id;
        }
        if(tcase){
            product_id = tcase.product_id;
        }
    }
    catch (err){}
    this.tcid = tcid;
    this.store = new Ext.data.JsonStore({
        url: 'tr_process_case.cgi',
        root: 'comps',
        baseParams: {action: 'getcomponents'},
        id: 'component_id',
        fields: [
            {name: 'name', mapping: 'name'},
            {name: 'id', mapping: 'id'}
        ]
    });
    var ds = this.store;
    this.columns = [
        {header: "ID", width: 150, dataIndex: 'id', sortable: false, hidden: true},
        {id: 'comp_name', header: "Component", width: 150, dataIndex: 'name', sortable: true}
    ];
    
    var pchooser = new ProductCombo({
        id: 'comp_product_chooser',
        value: product_id
    });
    var compchooser = new ComponentCombo({
        params: {product_id: product_id}
    });
    this.pchooser = pchooser;
    pchooser.on('select', function(){
        compchooser.reset();
        compchooser.store.baseParams = {product_id: pchooser.getValue(), action: 'getcomponents'};
        compchooser.store.load();
    });
    addcomp = function(){
        tcid = this.tcid;
        if (typeof tcid == 'object'){
            testopia_form.submit({
                url: 'tr_list_cases.cgi',
                params: {action: 'update', comp_action: 'add', components: compchooser.getValue(), ids: getSelectedObjects(tcid,'case_id')},
                success: function(){
                    TestopiaUtil.notify.msg('Component Added', 'Added component {0} to {1} cases(s)', compchooser.getRawValue(), tcid.getSelectionModel().getCount());
                },
                failure: testopiaError
            });
            return;
        }
        testopia_form.submit({
            url: 'tr_process_case.cgi',
            params: {action: 'addcomponent', component_id: compchooser.getValue(), case_id: this.tcid},
            success: function(){
                ds.load({
                    params: {
                        case_id: tcid
                    }
                });
            },
            failure: testopiaError
        });
    };
    removecomp = function(){
        tcid = this.tcid;
        if (typeof tcid == 'object'){
            testopia_form.submit({
                url: 'tr_list_cases.cgi',
                params: {action: 'update', comp_action: 'rem', components: compchooser.getValue(), ids: getSelectedObjects(tcid,'case_id')},
                success: function(){
                    TestopiaUtil.notify.msg('Component Removed', 'Removed component {0} from {1} cases(s)', compchooser.getRawValue(), tcid.getSelectionModel().getCount());
                },
                failure: testopiaError
            });
            return;
        }
        testopia_form.submit({
            url: 'tr_process_case.cgi',
            params: {action: 'removecomponent', component_id: getSelectedObjects(Ext.getCmp('case_comps_panel'), 'id'), case_id: this.tcid},
            success: function(){
                ds.load({
                    params: {
                        case_id: tcid
                    }
                });
            },
            failure: testopiaError
        });
    };
    CaseComponentsGrid.superclass.constructor.call(this,{
        tbar: [pchooser,compchooser,
        {
            xtype: 'button',
            tooltip: "Attach selected component",
            icon: 'testopia/img/add.png',
            iconCls: 'img_button_16x',
            handler: addcomp.createDelegate(this)
        },{
            xtype: 'button',
            tooltip: "Remove component from test case",
            icon: 'testopia/img/delete.png',
            iconCls: 'img_button_16x',
            handler: removecomp.createDelegate(this)

        }],
        border: false,
        title: 'Components',
        id: 'case_comps_panel',
        bodyBorder: false,
        autoExpandColumn: 'comp_name',
        loadMask: {msg:'Loading...'},
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false
        })
    });
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};
Ext.extend(CaseComponentsGrid, Ext.grid.GridPanel, {
    onContextClick: function(grid, index, e){
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'tags-ctx-menu',
                items: [{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    } 
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },
    onActivate: function(event){
        this.store.load({
            params: {
                case_id: this.tcid
            },
            callback: function(r,o,s){
                if (s === false){
                    testopiaLoadError();
                }
            }
        });
        this.pchooser.store.load();
    }
});

BugsUpdate = function(grid){
    function commitBug(action, value, grid){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        form.submit({
            url: 'tr_list_cases.cgi',
            params: {action: 'update_bugs', bug_action: action, bugs: value, type: 'case', ids: getSelectedObjects(grid, 'case_id')},
            success: function(){},
            failure: testopiaError
        });
    }
     var win = new Ext.Window({
         title: 'Add or Remove Bugs',
         id: 'bugs_edit_win',
         layout: 'fit',
         split: true,
         plain: true,
         shadow: false,
         width: 350,
         height: 150,
         items: [
            new Ext.FormPanel({
                labelWidth: '40',
                bodyStyle: 'padding: 5px',
                items: [{
                    xtype: 'textfield',
                    name: 'bugs',
                    id: 'bug_field',
                    fieldLabel: 'Bugs'
                }]
            })
        ],
        buttons: [{
            text:'Attach Bug',
            handler: function(){
                commitBug('attach', Ext.getCmp('bug_field').getValue(), grid);
                win.close();
            }
        },{
            text: 'Remove Bug',
            handler: function(){
                commitBug('remove', Ext.getCmp('bug_field').getValue(), grid);
                win.close();
            }
        },{
            text: 'Close',
            handler: function(){
                win.close();
            }
        }]
    });
    win.show();
};
/*
 * END OF FILE - /bnc-3.0/testopia/js/caserun.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/run.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

RunGrid = function(params, cfg){
    this.tutil = new TestopiaUtil();
    params.limit = Ext.state.Manager.get('TESTOPIA_DEFAULT_PAGE_SIZE', 25);
    params.current_tab = 'run';
    this.params = params;
    var tutil = this.tutil;

    this.store = new Ext.data.JsonStore({
        url: 'tr_list_runs.cgi',
        baseParams: params,
        totalProperty: 'totalResultsAvailable',
        root: 'Result',
        id: 'run_id',
        fields: [
           {name: "run_id", mapping:"run_id"},
           {name: "plan_id", mapping:"plan_id"},
           {name: "summary", mapping:"summary"},
           {name: "manager", mapping:"manager_name"},
           {name: "start_date", mapping:"start_date"},
           {name: "stop_date", mapping:"stop_date"},
           {name: "build", mapping:"build.name"},
           {name: "environment", mapping:"environment.name"},
           {name: "status", mapping:"status"},
           {name: "case_count", mapping:"case_count"},
           {name: "product_version", mapping:"product_version"},
           {name: "product_id", mapping:"product_id"},
           {name: "passed_pct", mapping:"passed_pct"},
           {name: "failed_pct", mapping:"failed_pct"},
           {name: "blocked_pct", mapping:"blocked_pct"},
           {name: "complete_pct", mapping:"complete_pct"},
           {name: "plan_version", mapping:"plan_version"},
           {name: "bug_list", mapping:"bug_list"}
        ],
        remoteSort: true
    });
    var ds = this.store;
    ds.paramNames.sort = "order";
    ds.on('beforeload',function(store, o){
        store.baseParams.ctype = 'json';
    });
    var bcombo = new BuildCombo({
         hiddenName: 'build',
         id: 'run_grid_build',
         mode: 'remote',
         params: {product_id: params.product_id}
    });
    var ecombo = new EnvironmentCombo({
         hiddenName: 'environment',
         id: 'run_grid_env',
         mode: 'remote',
         params: {product_id: params.product_id}
    });
    var vcombo = new ProductVersionCombo({
         hiddenName: 'run_product_version',
         id: 'run_grid_version',
         mode: 'remote',
         params: {product_id: params.product_id}
    });

    this.columns = [
        {header: "Run ID", width: 30,  dataIndex: "run_id", id: "run_id", sortable: true, renderer: tutil.runLink}, 
        {header: "Plan ID", width: 30, dataIndex: "plan_id", sortable: true, renderer: tutil.planLink},
        {header: "Summary", width: 220, dataIndex: "summary", id: "run_name", sortable: true,
         editor: new Ext.grid.GridEditor(
            new Ext.form.TextField({
                allowBlank: false
            })
         )}, 
        {header: "Manager Name", width: 150, dataIndex: "manager", id:"manager_name_col", sortable: true,
         editor: new Ext.grid.GridEditor(new UserLookup({hiddenName:'manager'})),
         renderer: TestopiaComboRenderer.createDelegate(this)
        },
        {header: "Start Date", width: 110, dataIndex: "start_date", sortable: true}, 
        {header: "Stop Date", width: 110, dataIndex: "stop_date", sortable: true}, 
        {header: "Build", width: 30, dataIndex: "build", id: "build_col", sortable: true,
         editor: new Ext.grid.GridEditor(
            bcombo, 
            {listeners: {
                 'startedit' : function(){
                     var pid = Ext.getCmp(cfg.id || 'run_grid').getSelectionModel().getSelected().get('product_id');
                     if (bcombo.store.baseParams.product_id != pid){
                         bcombo.store.baseParams.product_id = pid;
                         bcombo.store.load();
                     }
                 }
            }}
         ),renderer: TestopiaComboRenderer.createDelegate(this)
        }, 
        {header: "Enviroment", width: 110, dataIndex:"environment",id: "environment", sortable: true,
        editor: new Ext.grid.GridEditor(
           ecombo,
           {listeners: {
               'startedit' : function(){
                     var pid = Ext.getCmp(cfg.id || 'run_grid').getSelectionModel().getSelected().get('product_id');
                     if (ecombo.store.baseParams.product_id != pid){
                         ecombo.store.baseParams.product_id = pid;
                         ecombo.store.load();
                     }
               }
           }}

        ),renderer: TestopiaComboRenderer.createDelegate(this)
        }, 
        {header: "Status", width: 110, dataIndex:"status",id: "status",sortable: true}, 
        {header: "Case Count", width: 30, dataIndex: "case_count", sortable: false}, 
        {header: "Product Version", width: 50, dataIndex: "product_version", id: "product_version",sortable: true,
        editor: new Ext.grid.GridEditor(
            vcombo,
            {listeners: {
                 'startedit' : function(){
                     var pid = Ext.getCmp(cfg.id || 'run_grid').getSelectionModel().getSelected().get('product_id');
                     if (vcombo.store.baseParams.product_id != pid){
                         vcombo.store.baseParams.product_id = pid;
                         vcombo.store.load();
                     }
                 }
             }}
        ),renderer: TestopiaComboRenderer.createDelegate(this)
        },
        {header: "Complete", width: 110, dataIndex:"complete_pct",sortable: false, hideable: true,
        renderer: function(v,m,r){
            var val = '';
            val = val + '<div class="x-progress-wrap" style="width: 98px; height: 15;">';
            val = val + '    <div style="position: relative;">';
            val = val + '    <div class="x-progress-bar-green" style="width: ' + Math.floor(r.get('passed_pct')*98) + 'px; height: 14;"></div>';
            val = val + '    <div class="x-progress-bar-red" style="width: ' + Math.floor(r.get('failed_pct')*98) + 'px; height: 14;"></div>';
            val = val + '    <div class="x-progress-bar-orange" style="width: ' + Math.floor(r.get('blocked_pct')*98) + 'px; height: 14;"></div>';
            val = val + '    <div class="x-progress-text-main x-hidden" style="font-weight: bold; z-index: 99;">';
            val = val + '        <div style="width: 100px; height: 12px;">' + v + '</div>';
            val = val + '    </div>';
            val = val + '    <div class="x-progress-text-main x-progress-text-back-main" style="font-weight: bold;">';
            val = val + '        <div style="width: 100px; height: 12px;">' + v + '</div>';
            val = val + '    </div>';
            val = val + '    </div>';
            val = val + '</div>';
            return val;
        }}
    ];
    
    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
    this.bbar = new TestopiaPager('run', this.store);
    RunGrid.superclass.constructor.call(this, {
        title: 'Test Runs',
        id: cfg.id || 'run_grid',
        loadMask: {msg:'Loading Test Runs...'},
        autoExpandColumn: "run_summary",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false,
            listeners: {'rowselect':function(sm,i,r){
                Ext.getCmp('new_case_to_run_button').enable();
                Ext.getCmp('delete_run_list_btn').enable();
                Ext.getCmp('edit_run_list_btn').enable();
            },'rowdeselect': function(sm,i,r){
                if (sm.getCount() < 1){
                    Ext.getCmp('new_case_to_run_button').disable();
                    Ext.getCmp('delete_run_list_btn').disable();
                    Ext.getCmp('edit_run_list_btn').disable();
                }
            }}
        }),
        viewConfig: {
            forceFit:true
        },
        tbar: [{
            xtype: 'button',
            text: 'Add Test Cases to Selected Runs',
            id: 'new_case_to_run_button',
            disabled: true,
            handler: function(){
                var run = Ext.getCmp(cfg.id || 'run_grid').getSelectionModel().getSelected();
                tutil.addCaseToRunPopup(run);
            }
        },new Ext.Toolbar.Fill(),
        {
            xtype: 'button',
            id: 'save_run_list_btn',
            icon: 'testopia/img/save.png',
            iconCls: 'img_button_16x',
            tooltip: 'Save this search',
            handler: function(b,e){
                saveSearch('run', Ext.getCmp(cfg.id || 'run_grid').store.baseParams);
            }
        },{
            xtype: 'button',
            id: 'link_run_list_btn',
            icon: 'testopia/img/link.png',
            iconCls: 'img_button_16x',
            tooltip: 'Create a link to this list',
            handler: function(b,e){
                linkPopup(Ext.getCmp(cfg.id || 'run_grid').store.baseParams);
            }
        },{
            xtype: 'button',
            id: 'edit_run_list_btn',
            icon: 'testopia/img/edit.png',
            iconCls: 'img_button_16x',
            disabled: true,
            tooltip: 'Edit Selected Test Run',
            handler: function(){
                editFirstSelection(Ext.getCmp(cfg.id || 'run_grid'));
            }
        },{
            xtype: 'button',
            id: 'add_run_list_btn',
            icon: 'testopia/img/new.png',
            iconCls: 'img_button_16x',
            tooltip: 'Create a New Test Run',
            handler: function(){
                try{
                    if (plan){
                        tutil.newRunPopup(plan);
                    }
                }
                catch (err) {
                    window.location = 'tr_new_run.cgi';
                }
            }
        },{
            xtype: 'button',
            id: 'delete_run_list_btn',
            icon: 'testopia/img/delete.png',
            iconCls: 'img_button_16x',
            disabled: true,
            tooltip: 'Delete Selected Test Runs',
            handler: this.deleteList.createDelegate(this)
         }]
    });
    Ext.apply(this,cfg);
    
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('afteredit', this.onGridEdit, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(RunGrid, Ext.grid.EditorGridPanel, {
    onContextClick: function(grid, index, e){
        grid.selindex = index;
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'run-ctx-menu',
                items: [
                    {
                        text: "Reports",
                        menu: {
                            items: [{
                                text: 'New Run Completion Report',
                                handler: function(){
                                    Ext.getCmp('object_panel').setActiveTab('dashboardpanel');
                                    
                                    var newPortlet = new Ext.ux.Portlet({
                                        title: 'Completion Report',
                                        closable: true,
                                        autoScroll: true,
                                        tools: PortalTools
                                    });
                                    newPortlet.url = 'tr_run_reports.cgi?type=completion&run_ids=' + getSelectedObjects(grid, 'run_id');
                                    Ext.getCmp('dashboard_leftcol').add(newPortlet);
                                    Ext.getCmp('dashboard_leftcol').doLayout();
                            		newPortlet.load({
                                        url: newPortlet.url
                                    });

                                }
                            },{
                                text: 'New Run Bug Report',
                                handler: function(){
                                    Ext.getCmp('object_panel').setActiveTab('dashboardpanel');
                                    var bug_list = new Testopia.BugReport({
                                            run_ids: getSelectedObjects(grid, 'run_id')
                                        });
                                    var newPortlet = new Ext.ux.Portlet({
                                        title: 'Bug Report',
                                        closable: true,
                                        autoScroll: true,
                                        tools: [{
                                            id:'close',
                                            handler: function(e, target, panel){
                                                panel.ownerCt.remove(panel, true);
                                            }
                                        }],
                                        items: bug_list
                                    });
                                    Ext.getCmp('dashboard_leftcol').add(newPortlet);
                                    Ext.getCmp('dashboard_leftcol').doLayout();
                                    bug_list.store.load();
                                }
                            }]
                        }
                    },{
                        text: 'Edit',
                        menu: {
                             items: [{
                                 text: 'Manager',
                                 handler: function(){
                                   var win = new Ext.Window({
                                       title: 'Change Run Manager',
                                       id: 'run_manager_win',
                                       layout: 'fit',
                                       split: true,
                                       plain: true,
                                       shadow: false,
                                       width: 350,
                                       height: 150,
                                       items: [
                                           new Ext.FormPanel({
                                               labelWidth: '40',
                                               bodyStyle: 'padding: 5px',
                                               items: [new UserLookup({
                                                   id: 'manager_update',
                                                   fieldLabel: 'Run Manager'
                                               })]
                                           })
                                       ],
                                        buttons: [{
                                          text:'Update Manager',
                                           handler: function(){
                                               TestopiaUpdateMultiple('run', {manager: Ext.getCmp('manager_update').getValue(), ids: getSelectedObjects(grid,'run_id')}, grid);
                                               win.close();
                                           }
                                       },{
                                           text: 'Cancel',
                                           handler: function(){
                                               win.close();
                                           }
                                       }]
                                   });
                                   win.show();
                                }
                            },{
                                text: 'Tags',
                                handler: function(){
                                   TagsUpdate('run', grid);
                                }
                            }]
                        }
                    },{
                    text: 'Clone Selected Test Runs',
                    icon: 'testopia/img/copy.png',
                    iconCls: 'img_button_16x',
                    handler: function(){
                        RunClonePopup(grid.getSelectionModel().getSelected().get('product_id'), getSelectedObjects(grid,'run_id'));
                    }

                },{
                    text: 'Delete Selected Test Runs',
                    icon: 'testopia/img/delete.png',
                    iconCls: 'img_button_16x',
                    handler: this.deleteList.createDelegate(this)

                },{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    } 
                },{
                    text: 'View Test Run in a New Window',
                    handler: function(){
                        window.open('tr_show_run.cgi?run_id=' + grid.store.getAt(grid.selindex).get('run_id'));
                    }
                },{
                    text: 'View Run\'s Test Cases in a New Window',
                    handler: function(){
                        window.open('tr_list_cases.cgi?run_id=' + grid.store.getAt(grid.selindex).get('run_id'));
                    }
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },
    onGridEdit: function(gevent){
        var myparams = {action: "edit", run_id: gevent.record.get('run_id')};
        var ds = this.store;
        switch(gevent.field){
        case 'product_version':
            myparams.run_product_version = gevent.value; 
            break;
        case 'manager':
            myparams.manager = gevent.value;
            break;
        case 'build':
            myparams.build = gevent.value;
            break;
        case 'environment':
            myparams.environment = gevent.value;
            break;
        case 'summary':
            myparams.summary = gevent.value;
            break;

        }
        this.form.submit({
            url:"tr_process_run.cgi",
            params: myparams,
            success: function(f,a){
                ds.commitChanges();
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
    },
    deleteList: function(){
        var grid = this;
        Ext.Msg.show({
            title:'Confirm Delete?',
            msg: RUN_DELETE_WARNING,
            buttons: Ext.Msg.YESNO,
            animEl: 'run-delete-btn',
            icon: Ext.MessageBox.QUESTION,
            fn: function(btn){
                if (btn == 'yes'){
                    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm');
                    testopia_form.submit({
                        url: 'tr_list_runs.cgi',
                        params: {run_ids: getSelectedObjects(grid,'run_id'), action:'delete'},
                        success: function(data){
                            Ext.Msg.show({
                                msg: "Test runs deleted",
                                buttons: Ext.Msg.OK,
                                icon: Ext.MessageBox.INFO
                            });
                            grid.store.reload();
                        },
                        failure: function(f,a){
                            testopiaError(f,a);
                            grid.store.reload();
                        }
                    });
                }
            }
        });
    },
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

var NewRunForm = function(plan){
    if (plan.data){
        plan = plan.data;
    }
    var casegrid = new CaseGrid({plan_id: plan.plan_id, case_status: 'CONFIRMED'},{
        title: 'Select From Existing Cases',
        region: 'center',
        id: 'newrun_casegrid',
        height: 500
    });
    casegrid.on('render', function(g){
        for (var i=0; i < g.getTopToolbar().items.length; i++){
            g.getTopToolbar().items.items[i].destroy();
        }
        g.getTopToolbar().add(
            {
                xtype: 'button',
                text: 'Select All',
                handler: function(){
                    casegrid.getSelectionModel().selectAll();
                }
            },
            new Ext.Toolbar.Fill(),
            {
                xtype: 'checkbox',
                id: 'selectall'
            },
                new Ext.Toolbar.Spacer(),
            new Ext.menu.TextItem(' Include all CONFIRMED Cases in Plan ' + plan.id)
        );
    });

    NewRunForm.superclass.constructor.call(this,{
        url: 'tr_new_run.cgi',
        id: 'newrunform',
        baseParams: {action: 'add'},
        labelAlign: 'left',
        frame: true,
        title: 'New Run',
        bodyStyle:'padding:5px 5px 0',
        width: 1050,
        height: 800,
        layout: 'border',
        items: [{
            region: 'north',
            title: 'Filter Cases',
            height: 168,
            collapsible: true,
            listeners: {'render': function(p){
                p.load({
                    url: 'tr_process_plan.cgi',
                    params: {action: 'getfilter', plan_id: plan.plan_id},
                    scripts: true
                });
            }},
            autoShow: true,
            autoScroll: true,
            buttons: [{
                text: 'Filter',
                handler: function(){
                    var filter = new Ext.form.BasicForm('case_filter');
                    var params = filter.getValues();
                    params.plan_id = plan.plan_id;
                    params.status = 'CONFIRMED';
                    casegrid.store.baseParams = params;
                    casegrid.store.load();
                }
            }]
        },casegrid,{
            region: 'south',
            xtype: 'form',
            url: 'tr_new_run.cgi',
            bodyStyle: 'padding: 10px',
            id: 'newrunsouth',
            height: 200,
            items:[{
                layout:'column',
                items: [{
                    columnWidth: 0.5,
                    layout: 'form',
                    items: [
                        new ProductVersionCombo({
                            fieldLabel: '<b>Product Version</b>',
                            hiddenName: 'prod_version',
                            mode: 'local',
                            forceSelection: true,
                            allowBlank: false,
                            typeAhead: true,
                            params: {product_id: plan.product_id}
                        }),
                        new UserLookup({
                            id: 'new_run_manager',
                            hiddenName: 'manager',
                            fieldLabel: '<b>Run Manager</b>', 
                            allowBlank: false
                        })
                    ]
                },{
                    columnWidth: 0.5,
                    layout: 'form',
                    items: [
                    new BuildCombo({
                        fieldLabel: '<b>Build</b>',
                        hiddenName: 'build',
                        mode: 'local',
                        forceSelection: false,
                        allowBlank: false,
                        typeAhead: true,
                        params: {product_id: plan.product_id},
                        emptyText: 'Select or type a new name'
                    }),
                    new EnvironmentCombo({
                        fieldLabel: '<b>Environment</b>',
                        hiddenName: 'environment',
                        mode: 'local',
                        forceSelection: false,
                        allowBlank: false,
                        typeAhead: true,
                        params: {product_id: plan.product_id},
                        emptyText: 'Select or type a new name'
                    })
                    ]
                }]
            },{ 
                xtype:'textfield',
                fieldLabel: '<b>Summary</b>',
                layout: 'fit',
                id: 'run_summary',
                name: 'summary',
                anchor:'100%',
                width: 600,
                allowBlank: false
            },{ 
                xtype:'hidden',
                name: 'plan_id',
                value: plan.plan_id
            },{
                layout: 'fit',
                fieldLabel: 'Notes',
                id: 'notes',
                xtype:'textarea',
                width: 600,
                height: 80
            }]
        }],
        buttons: [{
            text: 'Create New Case',
            handler: function(){
                var tutil = new TestopiaUtil();
                tutil.newCaseForm(plan.plan_id, plan.product_id);
            }
        },{
            text: 'Submit',
            handler: function(){
                if (!Ext.getCmp('newrunsouth').getForm().isValid()){
                    return;
                }

                var values = {action: 'add'};
                if (Ext.getCmp('selectall').getValue()){
                    values.getall = Ext.getCmp('selectall').getValue() ? 1 : 0;
                }
                else{
                    values.case_ids = getSelectedObjects(casegrid, 'case_id');
                }
                
                if (! Ext.getCmp('build_combo').getValue()){
                    values.new_build = Ext.getCmp('build_combo').getRawValue();
                }
                if (! Ext.getCmp('environment_combo').getValue()){
                    values.new_env = Ext.getCmp('environment_combo').getRawValue();
                }
                
                Ext.getCmp('newrunsouth').getForm().submit({
                    params: values,
                    success: function(form, data){
                        Ext.Msg.show({
                            title:'Test Run Created',
                            msg: 'Test run ' + data.result.run_id + ' Created. Would you like to go there now?',
                            buttons: Ext.Msg.YESNO,
                            icon: Ext.MessageBox.QUESTION,
                            fn: function(btn){
                                if (btn == 'yes'){
                                    window.location = 'tr_show_run.cgi?run_id=' + data.result.run_id;
                                }
                            }
                        });
                        if (Ext.getCmp('plan_run_grid')){
                            Ext.getCmp('plan_run_grid').store.reload();
                        }
                    },
                    failure: testopiaError
                });
            }
        },{
            text: 'Cancel',
            type: 'reset',
            id: 'nrf_cancel_btn',
            handler: function(){
                Ext.getCmp('newrunsouth').getForm().reset();
                try {
                    Ext.getCmp('newRun-win').close();
                }
                catch (err){
                    window.location = 'tr_show_product.cgi';
                }
            }
        }]
    });
    this.on('render', function(){
        casegrid.store.load();
    });
};
Ext.extend(NewRunForm, Ext.Panel);

RunClonePanel = function(product_id, runs, caselist){
    var pgrid = new PlanGrid({product_id: product_id},{id: 'run_clone_plan_grid'});
    var vbox = new ProductVersionCombo({
        id: 'run_clone_version_chooser',
        mode: 'local',
        hiddenName: 'new_run_prod_version',
        fieldLabel: '<b>Product Version</b>',
        params: {product_id: product_id},
        allowBlank: false
    });
    var bbox  = new BuildCombo({
        fieldLabel: '<b>Select a Build</b>',
        id: 'run_clone_build_chooser',
        mode: 'local',
        hiddenName: 'new_run_build',
        params: {product_id: product_id},
        allowBlank: false
    });
    var ebox = new EnvironmentCombo({
        fieldLabel: '<b>Select an Environment</b>',
        id: 'run_clone_environment_chooser',
        mode: 'local',
        hiddenName: 'new_run_env',
        params: {product_id: product_id},
        allowBlank: false
    });
    
    function doSubmit(){
        var form = Ext.getCmp('run_clone_frm').getForm();
        form.baseParams = {};
        if (Ext.getCmp('copy_cases_radio_group').getGroupValue() == 'copy_filtered_cases') {
            form.baseParams = Ext.getCmp('caserun_search').form.getValues();
        }
        else if (Ext.getCmp('copy_cases_radio_group').getGroupValue() == 'copy_selected_cases') {
            form.baseParams.case_list = getSelectedObjects(Ext.getCmp('caserun_grid'), 'caserun_id');
        }
        form.baseParams.action = 'clone';
        form.baseParams.ids = runs;
        form.baseParams.new_run_build = bbox.getValue();
        form.baseParams.new_run_environment = ebox.getValue();
        form.baseParams.plan_ids = getSelectedObjects(pgrid, 'plan_id');
        var p = form.getValues();
        
        if (form.isValid()){
            form.submit({
                success: function(f,a){
                    var msg;
                    if (a.result.runlist.length == 1){
                        msg = a.result.failures.length > 0 ? 'Test cases ' + a.result.failures.join(',') + ' were not included. They are either DISABLED or PROPOSED. <br>' : '';
                        Ext.Msg.show({
                            title:'Run Copied',
                            msg: msg + 'Run ' + a.result.runlist[0] + ' Created. Would you like to go there now?',
                            buttons: Ext.Msg.YESNO,
                            icon: Ext.MessageBox.QUESTION,
                            fn: function(btn){
                                if (btn == 'yes'){
                                    window.location = 'tr_show_run.cgi?run_id=' + a.result.runlist[0];
                                }
                            }
                        });
                    }
                    else {
                        msg = a.result.failures.length > 0 ? 'Test cases ' + a.result.failures.join(',') + ' were not included. They are either DISABLED or PROPOSED. <br>' : '';
                        Ext.Msg.show({
                            title:'Test Run Copied',
                            msg: msg + 'Test runs ' + a.result.runlist.join(',') + ' Copied successfully. <a href="tr_list_runs.cgi?run_id=' + a.result.runlist.join(',') +'">View as List</a>',
                            buttons: Ext.Msg.OK,
                            icon: Ext.MessageBox.INFO
                        });
                    }
                },
                failure: testopiaError
            })
        }
    }

    RunClonePanel.superclass.constructor.call(this,{
        id: 'run_clone_form',
        border: false,
        width: 600,
        layout: 'border',
        items:[{
            region: 'north',
            layout: 'fit',
            border: false,
            height: 300,
            items:[pgrid]
        },{
            region: 'center',
            xtype: 'form',
            url: 'tr_list_runs.cgi',
            title:'Clone Options',
            autoScroll: true,
            id: 'run_clone_frm',
            border: false,
            frame: true,
            bodyStyle: 'padding: 10px',
            labelWidth: 160,
            height: 350,
            items:[{
                layout: 'table',
                border: false,
                autoScroll: true,
                layoutConfig: {
                    columns: 2,
                    width: '100%'
                },
                items: [{
                    colspan: 2,
                    layout: 'form',
                    border: false,
                    items: [{
                        id: 'run_clone_name',
                        xtype: 'textfield',
                        fieldLabel: '<b>New Run Summary</b>',
                        name: 'new_run_summary',
                        allowBlank: false,
                        width: 500
                    }]
                },{
                    layout: 'form',
                    border: false,
                    items: [
                         vbox, bbox, ebox
                     ]
                },{
                    layout: 'form',
                    border: false,
                    items: [{
                        xtype: 'checkbox',
                        name: 'copy_tags',
                        checked: true,
                        boxLabel: 'Copy Run Tags',
                        hideLabel: true
                    },{
                        xtype: 'hidden',
                        id: 'run_clone_product_id',
                        name: 'product_id',
                        value: product_id
                    }]
                },{
                    colspan: 2,
                    layout: 'form',
                    border: false,
                    items: [{
                        xtype: 'checkbox',
                        name: 'keep_run_manager',
                        checked: false,
                        boxLabel: 'Maintain original manager (unchecking will make me the manager of the new run)',
                        hideLabel: true
                    },{
                        xtype: 'fieldset',
                        autoHeight: true,
                        checkboxToggle: true,
                        checkboxName: 'copy_cases',
                        id: 'run_copy_cases',
                        title: 'Copy Test Cases',
                        collapsed: caselist ? false : true,
                        items: [{
                            xtype: 'radio',
                            name: 'copy_cases_options',
                            id: 'copy_cases_radio_group',
                            inputValue: 'copy_all_cases',
                            checked: true,
                            boxLabel: 'Include all CONFIRMED cases in selected run(s)',
                            hideLabel: true
                        },{
                            xtype: 'radio',
                            name: 'copy_cases_options',
                            inputValue: 'copy_filtered_cases',
                            boxLabel: 'Only include cases that match the selected filter',
                            hideLabel: true
                        },{
                            xtype: 'radio',
                            name: 'copy_cases_options',
                            inputValue: 'copy_selected_cases',
                            boxLabel: 'Only include cases that are currently selected',
                            checked: caselist ? true: false,
                            hideLabel: true                            
                        },{
                            xtype: 'checkbox',
                            name: 'keep_indexes',
                            checked: true,
                            boxLabel: 'Copy Case Indexes',
                            hideLabel: true
                        },{
                            xtype: 'checkbox',
                            name: 'keep_statuses',
                            boxLabel: 'Maintain status of copied cases (unchecking will set case copies to IDLE (Not Run))',
                            hideLabel: true
                        }]
                    }]
                }]
            }]
        }],
        buttons: [{
            text: 'Submit',
            handler: doSubmit.createDelegate(this)
        },{
            text: 'Cancel',
            handler: function(){
                Ext.getCmp('run-clone-win').close();
            }
        }]
    });
};
Ext.extend(RunClonePanel, Ext.Panel);

RunClonePopup = function(product_id, runs, caselist){
    var win = new Ext.Window({
        id: 'run-clone-win',
        closable:true,
        width: 800,
        height: 600,
        plain: true,
        shadow: false,
        layout: 'fit',
        items: [new RunClonePanel(product_id, runs, caselist)]
    });
    var pg = Ext.getCmp('run_clone_plan_grid');
    Ext.apply(pg,{title: 'Select plans to clone runs to'});
    win.show(this);
    
    var items = pg.getTopToolbar().items.items;
    for (var i=0; i < items.length; i++){
        items[i].destroy();
    }
    var pchooser = new ProductCombo({mode: 'local', value: product_id});
    pchooser.on('select', function(c,r,i){
        pg.store.baseParams = {ctype: 'json', product_id: r.get('id')};

        Ext.getCmp('run_clone_version_chooser').reset();
        Ext.getCmp('run_clone_build_chooser').reset();
        Ext.getCmp('run_clone_environment_chooser').reset();

        Ext.getCmp('run_clone_version_chooser').store.baseParams.product_id = r.id;
        Ext.getCmp('run_clone_build_chooser').store.baseParams.product_id = r.id;
        Ext.getCmp('run_clone_environment_chooser').store.baseParams.product_id = r.id;
        
        Ext.getCmp('run_clone_version_chooser').store.load();
        Ext.getCmp('run_clone_build_chooser').store.load();
        Ext.getCmp('run_clone_environment_chooser').store.load();
        

        Ext.getCmp('run_clone_product_id').setValue(r.get('id'));
        pg.store.load();
    });
    pg.getTopToolbar().add(new Ext.menu.TextItem('Product: '), pchooser);
    pg.getSelectionModel().un('rowselect', pg.getSelectionModel().events['rowselect'].listeners[0].fn);
    pg.getSelectionModel().un('rowdeselect', pg.getSelectionModel().events['rowdeselect'].listeners[0].fn);
    pg.store.load();
};

AddCaseToRunForm = function(run){
    if (run.data){
        run = run.data;
    }
    var casegrid = new CaseGrid({plan_id: run.plan_id, case_status: 'CONFIRMED', exclude: run.run_id},{
        title: 'Select From Existing Cases',
        region: 'center',
        id: 'newrun_casegrid',
        height: 500
    });
    casegrid.on('render', function(g){
        for (var i=0; i < g.getTopToolbar().items.length; i++){
            g.getTopToolbar().items.items[i].destroy();
        }
        g.getTopToolbar().add(
            {
                xtype: 'button',
                text: 'Select All',
                handler: function(){
                    casegrid.getSelectionModel().selectAll();
                }
            }
        );
        casegrid.store.load();
    });

    AddCaseToRunForm.superclass.constructor.call(this,{
        url: 'tr_new_run.cgi',
        id: 'add_cases_form',
        title: 'Add Cases to Run',
        bodyStyle:'padding:5px 5px 0',
        width: 1050,
        height: 800,
        layout: 'border',
        items: [{
            region: 'north',
            title: 'Filter Cases',
            height: 172,
            collapsible: true,
            listeners: {'render': function(p){
                p.load({
                    url: 'tr_process_plan.cgi',
                    params: {action: 'getfilter', plan_id: run.plan_id},
                    scripts: true
                });
            }},
            autoShow: true,
            autoScroll: true,
            buttons: [{
                text: 'Filter',
                handler: function(){
                    var filter = new Ext.form.BasicForm('case_filter');
                    var params = filter.getValues();
                    params.plan_id = run.plan_id;
                    params.exclude  = run.run_id;
                    params.status = 'CONFIRMED';
                    params.limit = Ext.getCmp('case_pager').pageSize;
                    casegrid.store.baseParams = params;
                    casegrid.store.load();
                }
            }]
        },casegrid],
        buttons:[{
            text: 'Add Selected Cases to Run',
            handler: function(){
                var form = new Ext.form.BasicForm('testopia_helper_frm');
                form.submit({
                    url:'tr_list_cases.cgi',
                    params: {action: 'update', addruns: run.run_id, ids: getSelectedObjects(casegrid, 'case_id')},
                    success: function(){
                        if (Ext.getCmp('add_case_to_run_win')){
                            Ext.getCmp('add_case_to_run_win').close();
                        }
                        if (Ext.getCmp('caserun_grid')){
                            Ext.getCmp('caserun_grid').store.reload();
                        }
                    },
                    failure: testopiaError
                });
            }
        }]
    });
};
Ext.extend(AddCaseToRunForm, Ext.Panel);

/*
 * PlanVersionCombo
 */
PlanVersionCombo = function(fname,flabel,fvalue,pid){
    PlanVersionCombo.superclass.constructor.call(this,{
        id: 'plan-version-lookup',
        store: new Ext.data.JsonStore({
            url: 'tr_process_plan.cgi',
            baseParams: {action: 'getversions', plan_id: pid},
            root: 'versions',
            autoLoad: true,
            fields: [
                {name: 'id', mapping: 'id'},
                {name: 'name', mapping: 'name'}
            ]
        }),
        loadingText: 'Looking up versions...',
        displayField: 'name',
        valueField: 'id',
        typeAhead: true,
        triggerAction: 'all',
        hiddenName: fname,
        fieldLabel: flabel,
        minListWidth: 300,
        forceSelection: true,
        blankText: 'Please select...'
    });
    this.store.on('load', function(){
        this.setValue(fvalue);
    }, this);
};
Ext.extend(PlanVersionCombo, Ext.form.ComboBox);

RunFilterGrid = function(run){
    
    this.store = new Ext.data.JsonStore({
        url: 'tr_process_run.cgi',
        baseParams: {action: 'getfilters', run_id: run.run_id},
        root: 'filters',
        fields: ["name","query"]
    });
    var ds = this.store;
    
    this.columns = [
        {header: "Name", width: 30, dataIndex: "name", sortable: true}
    ];
    
    RunFilterGrid.superclass.constructor.call(this, {
        title: "Filters",
        id: "run_filter_grid",
        loadMask: {msg: "Loading Filters ..."},
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true,
            listeners: {'rowselect': function(sm, index, r){
                var name = r.get('name');
                Ext.getCmp('object_panel').setActiveTab('caserun-panel');
                var params = searchToJson(r.get('query'));
                var f = document.getElementById('caserun_filter_form');
                for (var i=0; i < f.length; i++){
                    if (f[i].type == 'select-multiple'){
                        for (var k=0; k < f[i].options.length; k++){
                            f[i].options[k].selected = false;
                        }
                            
                        var list = params[f[i].name];
                        if(!list){
                            continue;
                        }
                        if (typeof list != 'object'){
                            list = new Array(list);
                        }
                        for (j=0; j < list.length; j++){
                            for (k=0; k < f[i].options.length; k++){
                                if(f[i].options[k].value == list[j]){
                                    f[i].options[k].selected = true;
                                    break;
                                }
                            }
                        }
                    }
                    else{
                        f[i].value = params[f[i].name];
                    }
                }
        		Ext.getCmp('caserun_grid').store.baseParams = params;
                Ext.getCmp('caserun_grid').store.load();
            }}
        }),
        viewConfig: {
            forceFit:true
        }
    });
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(RunFilterGrid, Ext.grid.GridPanel, {
    onContextClick: function(grid, index, e){
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'run_filter_ctx',
                items: [{
                    text: 'Delete Saved Filter', 
                    handler: function(){
                        var form = new Ext.form.BasicForm('testopia_helper_frm', {});
                        form.submit({
                            url: 'tr_process_run.cgi',
                            params: {action: 'delete_filter', query_name: grid.store.getAt(index).get('name'), run_id: grid.store.baseParams.run_id},
                            success: function(){
                                TestopiaUtil.notify.msg('Filter removed', 'filter removed successfully');
                                grid.store.reload();
                            },
                            failure: testopiaError
                        });
                    }
                }]
            });
        }
        e.stopEvent();
        this.menu.showAt(e.getXY());
    },
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

Testopia.BugReport = function(params){
    params.type = 'bug';
    var tutil = new TestopiaUtil();
    this.store = new Ext.data.GroupingStore({
        url: 'tr_run_reports.cgi',
        baseParams: params,
        reader: new Ext.data.JsonReader({
            root: 'Result',
            fields: [
               {name: "case_id", mapping:"case_id"},
               {name: "run_id", mapping:"run_id"},
               {name: "bug_id", mapping:"bug_id"},
               {name: "case_status", mapping:"case_status"},
               {name: "bug_status", mapping:"bug_status"},
               {name: "severity", mapping:"bug_severity"}

        ]}),
        remoteSort: true,
        sortInfo: {field: 'run_id', direction: "ASC"},
        groupField: 'bug_id'
    });
    this.store.isTreport = true;
    this.view = new Ext.grid.GroupingView({
        forceFit:true,
        groupTextTpl: '{text} ({[values.rs.length]} {[values.rs.length > 1 ? "Items" : "Item"]})'
    });
    this.columns = [
        {header: 'Run', dataIndex: 'run_id', sortable: true, hideable: true, groupRenderer: function(v){return v;}, renderer: tutil.runLink},
        {header: 'Case', dataIndex: 'case_id', sortable: true, hideable: true, groupRenderer: function(v){return v;}, renderer: tutil.caseLink},
        {header: 'Bug', dataIndex: 'bug_id', sortable: true, hideable: true, groupRenderer: function(v){return v;}, renderer: tutil.bugLink},
        {header: 'Bug Status', dataIndex: 'bug_status', sortable: true, hideable: true},
        {header: 'Case Status', dataIndex: 'case_status', sortable: true, hideable: true},
        {header: 'Severity', dataIndex: 'severity', sortable: true, hideable: true}
        
    ];
    Testopia.BugReport.superclass.constructor.call(this,{
        sm: new Ext.grid.RowSelectionModel(),
        layout: 'fit',
        height: 250,
        autoScroll: true
    });
};
Ext.extend(Testopia.BugReport, Ext.grid.GridPanel);
/*
 * END OF FILE - /bnc-3.0/testopia/js/run.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/build.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

BuildGrid = function(product_id){
    this.product_id = product_id;
    this.store = new BuildStore({}, false);
    var mbox = new MilestoneCombo({
        hiddenField: 'milestone',
        mode: 'remote',
        params: {product_id: product_id}
    });
    this.columns =  [
     {header: "Name", width: 80, sortable: true, dataIndex: 'name', editor: new Ext.grid.GridEditor(
          new Ext.form.TextField({value:'name', allowBlank: false}),
             {  completeOnEnter: true,
                 listeners:{'beforecomplete':function(e,v){
                     if (! e.getValue()){
                         return false;
                     }
             }}}
          )},
     {header: "Milestone", width: 120, sortable: true, dataIndex: 'milestone', 
      editor: new Ext.grid.GridEditor(
          mbox,{listeners: {
                 'startedit' : function(){
                     var pid = Ext.getCmp('products_pane').getSelectionModel().getSelectedNode().id;
                     if (mbox.store.baseParams.product_id != pid){
                         mbox.store.baseParams.product_id = pid;
                         mbox.store.load();
                     }
                 }
             }}
      )},
     {header: "Description", width: 120,editor: new Ext.grid.GridEditor(
          new Ext.form.TextField()), sortable: true, dataIndex: 'description'},
        new Ext.grid.CheckColumn({
            header: 'Active',
            dataIndex: 'isactive',
            editor:new Ext.grid.GridEditor(
                  new Ext.form.Checkbox({value:'isactive'})),
            width:25
        })
    ];
    
    this.form = new Ext.form.BasicForm('testopia_helper_frm');
    
    BuildGrid.superclass.constructor.call(this, {
        title: 'Builds',
        id: 'build_grid',
        loadMask: {msg:'Loading Builds...'},
        autoExpandColumn: "build_name",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true
        }),
        viewConfig: {forceFit:true},
        tbar: [new Ext.Toolbar.Fill(),
        {
            xtype: 'button',
            id: 'edit_build_btn',
            icon: 'testopia/img/edit.png',
            iconCls: 'img_button_16x',
            tooltip: 'Edit Selected Build',
            handler: function(){
                editFirstSelection(Ext.getCmp('build_grid'));
            }
        },{
            xtype: 'button',
            template: button_16x_tmpl,
            id: 'add_build_btn',
            icon: 'testopia/img/add.png',
            iconCls: 'img_button_16x',
            tooltip: 'Add a new Build',
            handler: this.newRecord
         }]
    });
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this); 
    this.on('afteredit', this.onGridEdit, this); 
};
Ext.extend(BuildGrid, Ext.grid.EditorGridPanel, {
    newRecord: function(){
        NewBuild = Ext.data.Record.create([
               {name: 'name', type: 'string'},
               {name: 'milestone'},
               {name: 'description', type: 'string'},
               {name: 'isactive', type: 'bool'}
        ]);
        var b = new NewBuild({
            name: '',
            milestone: Ext.getCmp('products_pane').getSelectionModel().getSelectedNode().attributes.attributes.defaultmilestone,
            description: '',
            isactive: true
        });
        var g = Ext.getCmp('build_grid');
        g.store.insert(0,b);
        g.startEditing(0,0);
    },
    onContextClick: function(grid, index, e){
        grid.getSelectionModel().selectRow(index);
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'build-ctx-menu',
                items: [{
                    text: "Reports",
                    menu: {
                        items: [{
                            text: 'New Completion Report',
                            handler: function(){
                                Ext.getCmp('object_panel').setActiveTab('dashboardpanel');
                                
                                var newPortlet = new Ext.ux.Portlet({
                                    title: 'Build Completion Report',
                                    closable: true,
                                    autoScroll: true,
                                    tools: PortalTools
                                });
                                newPortlet.url = 'tr_builds.cgi?action=report&product_id=' + grid.product_id + '&build_ids=' + getSelectedObjects(grid, 'id');
                                Ext.getCmp('dashboard_leftcol').add(newPortlet);
                                Ext.getCmp('dashboard_leftcol').doLayout();
                        		newPortlet.load({
                                    url: newPortlet.url
                                });
                            }
                        }]
                    }
                },{
                    text: 'Add a Build', 
                    icon: 'testopia/img/add.png',
                    iconCls: 'img_button_16x',
                    handler: this.newRecord
                },{
                    text: 'Edit This Build', 
                    icon: 'testopia/img/edit.png',
                    iconCls: 'img_button_16x',
                    handler: function(){
                        editFirstSelection(grid);
                    }
                },{
                    text: 'Refresh',
                    handler: function(){
                        grid.store.reload();
                    } 
                }]
            });
        }
        e.stopEvent();
        this.menu.showAt(e.getXY());
    },
    onGridEdit: function(e){
        var bid = e.record.get('id');
        var myparams = {product_id: this.product_id, build_id: bid};
        var ds = this.store;
        
        if (bid){
            myparams.action = "edit";
            switch(e.field){
            case 'name':
                myparams.name = e.value;
                break;
            case 'description':
                myparams.description = e.value;
                break;
            case 'isactive':
                myparams.isactive = e.value;
                     break;
            case 'milestone':
                myparams.milestone = e.value;
                break;
            }
        }
        else{
            myparams.action = "add";
            myparams.name = e.value;
            myparams.milestone = Ext.getCmp('products_pane').getSelectionModel().getSelectedNode().attributes.attributes.defaultmilestone;
            myparams.isactive = 1;
        }
        this.form.submit({
            url:"tr_builds.cgi",
            params: myparams,
            success: function(f,a){
                if (a.result.build_id){
                    e.record.set('build_id', a.result.build_id);
                }
                ds.commitChanges();
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
    },
   onActivate: function(event){
        if (!this.product_id){
            Ext.Msg.alert('Error', 'Please select a product.');
            Ext.getCmp('edit_build_btn').disable();
            Ext.getCmp('add_build_btn').disable();
            return;
        }
        else{
            if (!this.store.getCount()){
                this.store.load({params: {product_id: this.product_id}});
            }
        }
    }
});

/*
 * END OF FILE - /bnc-3.0/testopia/js/build.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/category.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

CaseCategoryGrid = function(product_id){
    this.product_id = product_id;
    this.store = new CaseCategoryStore({}, false);
    var ds = this.store;
    this.columns= [
        {header: "Name", width: 120, sortable: true, dataIndex: 'name', 
         editor: new Ext.grid.GridEditor(
             new Ext.form.TextField({value:'name', allowBlank:false}),
             {  completeOnEnter: true,
                listeners:{'beforecomplete':function(e,v){
                     if (! e.getValue()){
                         return false;
                     }
             }}})},
        {header: "Description", width: 120, id: 'category_desc_column', editor: new Ext.grid.GridEditor(
             new Ext.form.TextField({value:'description'})), sortable: true, dataIndex: 'description'}
    ];

    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
   
    CaseCategoryGrid.superclass.constructor.call(this, {
        title: 'Categories',
        id: 'category_grid',
        loadMask: {msg:'Loading Categories...'},
        autoExpandColumn: "category_desc_column",
        autoScroll: true,
        enableColumnHide: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true
        }),
        viewConfig: {
            forceFit:true
        },        
        tbar: [new Ext.Toolbar.Fill(),
        {
            xtype: 'button',
            id: 'edit_category_btn',
            icon: 'testopia/img/edit.png',
            iconCls: 'img_button_16x',
            tooltip: 'Edit Selected Category',
            handler: function(){
                editFirstSelection(Ext.getCmp('category_grid'));
            }
        },{
            xtype: 'button',
            template: button_16x_tmpl,
            id: 'add_category_btn',
            icon: 'testopia/img/add.png',
            iconCls: 'img_button_16x',
            tooltip: 'Add a new Category',
            handler: this.newRecord
        },{
            xtype: 'button',
            template: button_16x_tmpl,
            icon: 'testopia/img/delete.png',
            iconCls: 'img_button_16x',
            tooltip: 'Delete this Category',
            handler: function(){
                var m = Ext.getCmp('category_grid').getSelectionModel().getSelected();
                if(! m){
                    Ext.MessageBox.alert('Message', 'Please select at least one Category to delete');
                }
                else{
                	confirmCaseCategoryDelete(product_id);	
                }
            }
        }]
    });
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
    this.on('afteredit', this.onGridEdit, this);
    
};
Ext.extend(CaseCategoryGrid, Ext.grid.EditorGridPanel, {
    newRecord: function(){
        NewCategory = Ext.data.Record.create([
               {name: 'name', type: 'string'},
               {name: 'description', type: 'string'}
        ]);
        var b = new NewCategory({
            name: '',
            description: ''
        });
        var g = Ext.getCmp('category_grid');
        g.store.insert(0,b);
        g.startEditing(0,0);
    },
    onContextClick: function(grid, index, e){
        grid.getSelectionModel().selectRow(index);
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'category-ctx-menu',
                items: [
                    {
                        text: 'Add a Category', 
                        icon: 'testopia/img/add.png',
                        iconCls: 'img_button_16x',
                        handler: this.newRecord
                    },{
                        text: 'Edit This Category', 
                        icon: 'testopia/img/edit.png',
                        iconCls: 'img_button_16x',
                        handler: function(){
                            editFirstSelection(grid);
                        }
                    },{
                        text: 'Refresh',
                        handler: function(){
                            grid.store.reload();
                        } 
                    }
                ]
            });
        }
        e.stopEvent();
        this.menu.showAt(e.getXY());
    },
    onGridEdit: function(e){
        var bid = e.record.get('category_id');
        var myparams = {product_id: this.product_id, category_id: bid};
        var ds = this.store;
        
        if (bid){
            myparams.action = "edit";
            switch(e.field){
            case 'name':
                myparams.name = e.value;
                break;
            case 'description':
                myparams.description = e.value;
                break;
            }
        }
        else{
            myparams.action = "add";
            myparams.name = e.value;
        }
        this.form.submit({
            url:"tr_categories.cgi",
            params: myparams,
            success: function(f,a){
                if (a.result.category_id){
                    e.record.set('category_id', a.result.category_id);
                }
                ds.commitChanges();
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
        
    },
   onActivate: function(event){
        if (!this.product_id){
            Ext.Msg.alert('Error', 'Please select a product.');
            Ext.getCmp('edit_category_btn').disable();
            Ext.getCmp('add_category_btn').disable();
            return;
        }
        else {
            if (!this.store.getCount()){
                this.store.load({params: {product_id: this.product_id}});
            }
        }
    }
});

confirmCaseCategoryDelete = function(){
    if (!Ext.getCmp('category_grid').getSelectionModel().getSelected().get('category_id')){
        Ext.getCmp('category_grid').store.reload();
        return;
    }
    Ext.Msg.show({
       title:'Confirm Delete?',
       msg: CASE_CATEGORY_DELETE_WARNING,
       buttons: Ext.Msg.YESNO,
       animEl: 'casecategory-delete-btn',
       icon: Ext.MessageBox.QUESTION,
       fn: function(btn){
            if (btn == 'yes'){
                var testopia_form = new Ext.form.BasicForm('testopia_helper_frm');
                testopia_form.submit({
                    url: 'tr_categories.cgi',
                    params: {category_id: Ext.getCmp('category_grid').getSelectionModel().getSelected().get('category_id'), action:'delete', product_id: Ext.getCmp('category_grid').product_id},
                    success: function(data){
                        Ext.Msg.show({
                            msg: "Test case category deleted",
                            buttons: Ext.Msg.OK,
                            icon: Ext.MessageBox.INFO
                        });
                        Ext.getCmp('category_grid').store.reload();
                    },
                    failure: testopiaError
                });
            }
        }
    });
};


/*
 * END OF FILE - /bnc-3.0/testopia/js/category.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/diff-tabs.js
 */
Ext.ux.TabCloseMenu = function(){
    var tabs, menu, ctxItem;
    this.init = function(tp){
        tabs = tp;
        tabs.on('contextmenu', onContextMenu);
    }

    function onContextMenu(ts, item, e){
        if(!menu){ // create context menu on first right click
            menu = new Ext.menu.Menu([{
                id: tabs.id + '-close',
                text: 'Close Tab',
                handler : function(){
                    tabs.remove(ctxItem);
                }
            },{
                id: tabs.id + '-close-others',
                text: 'Close Other Tabs',
                handler : function(){
                    tabs.items.each(function(item){
                        if(item.closable && item != ctxItem){
                            tabs.remove(item);
                        }
                    });
                }
            }]);
        }
        ctxItem = item;
        var items = menu.items;
        items.get(tabs.id + '-close').setDisabled(!item.closable);
        var disableOthers = true;
        tabs.items.each(function(){
            if(this != item && this.closable){
                disableOthers = false;
                return false;
            }
        });
        items.get(tabs.id + '-close-others').setDisabled(disableOthers);
        menu.showAt(e.getPoint());
    }
};

diff_tab_panel = function(type, id, doctype){
	var self = this;

	var doc_store = new Ext.data.JsonStore({
		url: "tr_history.cgi",
		baseParams: {action: 'getversions',
		             type:   type,
					 id:     id},
		root: 'versions',
        fields: [
            {name: 'name', mapping: 'name',
			 name: 'id', mapping: 'id'}
        ]
	})

	
	diff_tab_panel.superclass.constructor.call(this, {
		title:  'Test Panel',
		height: 500,
        resizeTabs:true, // turn on tab resizing
        minTabWidth: 115,
        tabWidth:135,
        enableTabScroll:true,
        defaults: {autoScroll:true},
        plugins: new Ext.ux.TabCloseMenu(),
		activeTab: 0,
		tbar: [  
		          new Ext.form.ComboBox({
				  						  displayField: 'name',
            							  valueField: 'id',
                                          name: 'product',
                                          id: 'product_combo',
                                          fieldLabel: "Product",
    		                              store: doc_store,
                                          emptyText: 'Select a version...',
                                          width: 200
		                               }),
		          " Right: ",
		          new Ext.Toolbar.Spacer(),					   
		          new Ext.form.ComboBox({
		          }),
		          " HTML: ",
		          new Ext.form.Radio({
		  	                          id:    'format',
				                      value: 'html',
							          checked: true
		                            }),
		          " Raw: ",
		          new Ext.form.Radio({
		  	                          id:    'format',
				                      value: 'raw'
		                             }),								   
		          new Ext.Button({
		                          text:    'Diff',
		                          handler: addTab
		                        }),
		          new Ext.Toolbar.Separator(),							 
		          "Show Version: ",
		          new Ext.form.ComboBox({
		                               }),							 
		          new Ext.Button({
		                          text:    'Show',
		                          handler: addTab
		                        })
              ]
    });
	
	
    function addTab() {
        self.add({
            title:   'New Tab ',
            iconCls: 'tabs',
            html:    'diff_text',
            closable:true
        }).show();
    }								  

}

Ext.extend(diff_tab_panel, Ext.TabPanel);


/*
 * END OF FILE - /bnc-3.0/testopia/js/diff-tabs.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/environment.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

EnvironmentGrid = function(params, cfg){
    this.params = params;
    this.product_id = params.product_id;
    function environmentLink(id){
        return '<a href="tr_environments.cgi?env_id=' + id +'">' + id +'</a>';
    }
    function productLink(id){
        return '<a href="tr_show_product.cgi?product_id=' + id +'">' + id +'</a>';
    }
    
    this.store = new EnvironmentStore(params, false);
    var ds = this.store;
    
    this.columns = [
        {header: "ID", width: 30, dataIndex: "environment_id", sortable: true, renderer: environmentLink},
        {header: "Environment Name", width: 110, dataIndex: "name", id: 'env_name_col', sortable: true,
          editor: new Ext.grid.GridEditor(
          new Ext.form.TextField({allowBlank: false}),{id: 'env_name_edt'})},
        {header: "Product Name", width: 150, dataIndex: "product", sortable: true, hidden: true},
        {header: "Run Count", width: 30, dataIndex: "run_count", sortable: false},
        new Ext.grid.CheckColumn({
            sortable: true,
            header: 'Active',
            dataIndex: 'isactive',
            editor:new Ext.grid.GridEditor(
                  new Ext.form.Checkbox({value:'isactive'})),
            width:25
        })
    ];
    this.form = new Ext.form.BasicForm('testopia_helper_frm', {});
    this.bbar = new TestopiaPager('environment', this.store);
    EnvironmentGrid.superclass.constructor.call(this, {
        title: 'Environments',
        id: 'environment-grid',
        loadMask: {msg:'Loading Environments...'},
        autoExpandColumn: "env_name_col",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true,
            listeners: {'rowselect':function(sm,i,r){
                Ext.getCmp('delete_env_list_btn').enable();
                Ext.getCmp('clone_env_list_btn').enable();
            },'rowdeselect': function(sm,i,r){
                if (sm.getCount() < 1){
                    Ext.getCmp('delete_env_list_btn').disable();
                    Ext.getCmp('clone_env_list_btn').disable();
                }
            }}
        }),
        viewConfig: {
            forceFit:true
        },
        tbar: [{
            xtype: 'button',
            text: 'Import',
            handler: this.importEnv.createDelegate(this)
        },
        new Ext.Toolbar.Fill(),{
            xtype: 'button',
            id : 'add_env_list_btn',
            template: button_16x_tmpl,
            icon: 'testopia/img/add.png',
            iconCls: 'img_button_16x',
            tooltip: 'Add an Environment',
            handler: this.createEnv.createDelegate(this,['','add'])
         },{
            xtype: 'button',
            id : 'clone_env_list_btn',
            template: button_16x_tmpl,
            disabled: true,
            icon: 'testopia/img/copy.png',
            iconCls: 'img_button_16x',
            tooltip: 'Clone this Environment',
            handler: this.cloneEnv.createDelegate(this)
         },{
            xtype: 'button',
            id : 'delete_env_list_btn',
            template: button_16x_tmpl,
            disabled: true,
            icon: 'testopia/img/delete.png',
            iconCls: 'img_button_16x',
            tooltip: 'Delete this Environment',
            handler: this.deleteEnv.createDelegate(this)
         }]
    });
    Ext.apply(this,cfg);
    
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('afteredit', this.onGridEdit, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(EnvironmentGrid, Ext.grid.EditorGridPanel, {
    onContextClick: function(grid, index, e){
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'run-ctx-menu',
                items: [
                {
                    text: 'Create a new environment',
                    handler: function(){
                        window.location="tr_new_environment.cgi";
                    } 
                },{
                    text: 'Delete Environments',
                    handler: this.deleteEnv.createDelegate(this)
                },{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    }
                }]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },
    onGridEdit: function(e){
        var myparams = {env_id: e.record.get('environment_id')};
        var ds = this.store;
        switch(e.field){
        case 'name':
            myparams.action = 'rename';
            myparams.name = e.value; 
            break;
        case 'isactive':
            myparams.action = 'toggle';
            break;
        }
        this.form.submit({
            url:"tr_environments.cgi",
            params: myparams,
            success: function(f,a){
                ds.commitChanges();
            },
            failure: function(f,a){
                testopiaError(f,a);
                ds.rejectChanges();
            }
        });
        
    },
    deleteEnv: function(){
        var grid = this;
        Ext.Msg.show({
            title:'Confirm Delete?',
            msg: ENVIRONMENT_DELETE_WARNING,
            buttons: Ext.Msg.YESNO,
            animEl: 'case-delete-btn',
            icon: Ext.MessageBox.QUESTION,
            fn: function(btn){
                if (btn == 'yes'){
                    form = new Ext.form.BasicForm('testopia_helper_frm', {});
                    form.submit({
                        url: 'tr_environments.cgi',
                        params: {env_id: grid.getSelectionModel().getSelected().get('environment_id'),action: 'delete'},
                        success: function(){
                            Ext.Msg.show({
                                msg: "Test environment deleted",
                                buttons: Ext.Msg.OK,
                                icon: Ext.MessageBox.INFO
                            });
                            grid.store.reload();
                        },
                        failure: function(f,a){
                            testopiaError(f,a);
                            grid.store.reload();
                        }
                    });
                }
            }
        });
    },
    createEnv: function(name, action, id){
        var grid = this;
        action = action || 'add';
        var win = new Ext.Window({
            id: 'create-env-win',
            title: 'Environment XML Import',
            closable:true,
            width: 400,
            height: 230,
            plain: true,
            shadow: false,
            layout: 'fit',
            items: [{
                xtype: 'form',
                url: 'tr_environments.cgi',
                bodyStyle: 'padding: 10px',
                id: 'env_create_frm',
                items: [{
                    xtype: 'field',
                    fieldLabel: 'Name',
                    inputType: 'text',
                    name: 'name',
                    value: name != '' ? 'Copy of ' + name : '',
                    allowBlank: false
                },
                new ProductCombo({
                    mode: 'local',
                    fieldLabel: 'Product',
                    value: grid.product_id,
                    hiddenName: 'product_id'
                }),{
                    xtype: 'hidden',
                    name: 'action',
                    value: action
                },{
                    xtype: 'hidden',
                    name: 'env_id',
                    value: id
                }],
                buttons: [{
                    text: 'Create',
                    handler: function(){
                        Ext.getCmp('env_create_frm').getForm().submit({
                            success: function(form, data){
                                Ext.Msg.show({
                                    title:'Test Environment Created',
                                    msg: 'Test environment ' + data.result.id + ' Created. Would you like to go there now?',
                                    buttons: Ext.Msg.YESNO,
                                    icon: Ext.MessageBox.QUESTION,
                                    fn: function(btn){
                                        if (btn == 'yes'){
                                            window.location = 'tr_environments.cgi?env_id=' + data.result.id;
                                        }
                                        else {
                                            grid.store.reload();
                                        }
                                    }
                                });
                                Ext.getCmp('create-env-win').close();
                            },
                            failure: testopiaError
                        });
                    }
                },{
                    text: 'Cancel',
                    handler: function(){Ext.getCmp('create-env-win').close();}
                }]
            }]
        });
        win.show(this);
    },
    cloneEnv: function(){
        this.createEnv(this.getSelectionModel().getSelected().get('name'), 'clone', this.getSelectionModel().getSelected().get('environment_id'));
    },
    importEnv: function(){
        grid = this;
        var win = new Ext.Window({
            id: 'import-env-win',
            title: 'Environment XML Import',
            closable:true,
            width: 400,
            height: 130,
            plain: true,
            shadow: false,
            layout: 'fit',
            items: [{
                xtype: 'form',
                url: 'tr_import_environment.cgi',
                bodyStyle: 'padding: 10px',
                id: 'env_xml_import_frm',
                fileUpload: true,
                items: [{
                    xtype: 'field',
                    fieldLabel: 'XML',
                    inputType: 'file',
                    name: 'xml',
                    allowBlank: false
                }],
                buttons: [{
                    text: 'Import',
                    handler: function(){
                        Ext.getCmp('env_xml_import_frm').getForm().submit();
                        Ext.getCmp('import-env-win').close();
                        grid.store.reload();
                    }
                },{
                    text: 'Cancel',
                    handler: function(){Ext.getCmp('import-env-win').close();}
                }]
            }]
        });
        win.show(this);
    },
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    }
});

/*
 * END OF FILE - /bnc-3.0/testopia/js/environment.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/search.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

Testopia.Search = {};

Testopia.Search.fillInForm = function(type, params, name){
    var f = document.getElementById(type + '_search_form');
    for (var i=0; i < f.length; i++){
        if (f[i].type == 'select-multiple'){
            for (k=0; k < f[i].options.length; k++){
                f[i].options[k].selected = false;
            }
                
            var list = params[f[i].name];
            if(!list){
                continue;
            }
            if (typeof list != 'object'){
                list = new Array(list);
            }
            for (j=0; j < list.length; j++){
                for (k=0; k < f[i].options.length; k++){
                    if(f[i].options[k].value == list[j]){
                        f[i].options[k].selected = true;
                        break;
                    }
                }
            }
        }
        else{
            f[i].value = params[f[i].name] || '';
        }
    }
};

SearchPopup = function(tab, params){
    var win = new Ext.Window({
        id: 'search_win',
        closable: true,
        width: Ext.getBody().getViewSize().width - 150,
        height: Ext.getBody().getViewSize().height - 150,
        plain: true,
        shadow: false,
        layout: 'fit',
        items: [new SearchPanel(tab, params)]
    });
    win.show();
};

SearchPanel = function(tab, params){
    params = params || {};

    SearchPanel.superclass.constructor.call(this,{
        title: 'Create a Search',
        id: 'search_panel',
        autoScroll: true,
        activeTab: tab + '_search_panel',
        defaults: {
        // applied to each contained panel
            bodyStyle:'padding:10px',
            autoScroll: true
        },
        items:[
            new PlanSearch(params),
            new CaseSearch(params),
            new RunSearch(params),
            new CaseRunSearch(params)
        ]
    });
};
Ext.extend(SearchPanel, Ext.TabPanel);

PlanSearch = function(params){
    this.params = params;
    PlanSearch.superclass.constructor.call(this,{
        title: 'Plan Search',
        id: 'plan_search_panel',
        layout:'fit',
        buttons:[{
            text: 'Submit',
            handler: function(){
                var form = new Ext.form.BasicForm('plan_search_form');
                var values = form.getValues();
                var searchnum = Math.round(Math.random()*100);
                try {
                    // EXT BUG - Closing always causes an error: 
                    // http://extjs.com/forum/showthread.php?t=20930
                    Ext.getCmp('search_win').close();
                }
                catch(err){}
                if (params.report){
                    Ext.getCmp('object_panel').add(new Ext.Panel({
                        id: 'plan_search' + searchnum, 
                        closable: true,
                        title: 'Plan Report',
                        autoScroll: true,
                        listeners: { 'render': function(){
                            this.load({
                                url: 'tr_plan_reports.cgi',
                                params: values
                            });
                        }},
                        tbar:[new Ext.Toolbar.Fill(),
                        {
                            xtype: 'button',
                            id: 'save_plan_report_btn',
                            icon: 'testopia/img/save.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Save this report',
                            handler: function(b,e){
                                saveSearch('plan', values);
                            }
                        },{
                            xtype: 'button',
                            id: 'link_plan_report_btn',
                            icon: 'testopia/img/link.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Create a link to this report',
                            handler: function(b,e){
                                linkPopup(values);
                            }
                        }]
                    }));
                    Ext.getCmp('object_panel').activate('plan_search' + searchnum);
                }
                else{
                    Ext.getCmp('object_panel').add(new PlanGrid(values,{
                        id: 'plan_search' + searchnum, 
                        closable: true,
                        title: 'Plan Search'
                    }));
                    Ext.getCmp('object_panel').activate('plan_search' + searchnum);
                }
            }
        }]
    });

    this.on('activate', this.onActivate, this);
};
Ext.extend(PlanSearch, Ext.Panel,{
    onActivate: function(event){
        if (Ext.get('case_search_form')){
            Ext.get('case_search_form').remove();
        }
        if (Ext.get('run_search_form')){
            Ext.get('run_search_form').remove();
        }
        if (Ext.get('caserun_search_form')){
            Ext.get('caserun_search_form').remove();
        }

        this.params.current_tab = 'plan';
        this.load({
            url: 'tr_query.cgi',
            params: this.params,
            scripts: true,
            text: 'Loading search form...',
            callback: Testopia.Search.fillInForm.createDelegate(this,['plan',this.params])
        });
    }
});

CaseSearch = function(params){
    this.params = params;
    CaseSearch.superclass.constructor.call(this,{
        title: 'Case Search',
        id: 'case_search_panel',
        layout:'fit',
        buttons:[{
            text: 'Submit',
            handler: function(){
                var form = new Ext.form.BasicForm('case_search_form');
                var values = form.getValues();
                var searchnum = Math.round(Math.random()*100);
                try {
                    // EXT BUG - Closing always causes an error: 
                    // http://extjs.com/forum/showthread.php?t=20930
                    Ext.getCmp('search_win').hide();
                }
                catch(err){}
                if (params.report){
                    Ext.getCmp('object_panel').add(new Ext.Panel({
                        id: 'case_search' + searchnum, 
                        closable: true,
                        title: 'Case Report',
                        autoScroll: true,
                        listeners: { 'render': function(){
                            this.load({
                                url: 'tr_case_reports.cgi',
                                params: values
                            });
                        }},
                        tbar:[new Ext.Toolbar.Fill(),
                        {
                            xtype: 'button',
                            id: 'save_case_report_btn',
                            icon: 'testopia/img/save.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Save this report',
                            handler: function(b,e){
                                saveSearch('case', values);
                            }
                        },{
                            xtype: 'button',
                            id: 'link_case_report_btn',
                            icon: 'testopia/img/link.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Create a link to this report',
                            handler: function(b,e){
                                linkPopup(values);
                            }
                        }]
                    }));
                    Ext.getCmp('object_panel').activate('plan_search' + searchnum);
                }
                else{
                    Ext.getCmp('object_panel').add(new CaseGrid(values,{
                        id: 'case_search' + searchnum, 
                        closable: true,
                        title: 'Case Search'
                    }));
                }
                Ext.getCmp('object_panel').activate('case_search' + searchnum);
            }
        }]
    });

    this.on('activate', this.onActivate, this);
};
Ext.extend(CaseSearch, Ext.Panel,{
    onActivate: function(event){
        if (Ext.get('run_search_form')){
            Ext.get('run_search_form').remove();
        }
        if (Ext.get('plan_search_form')){
            Ext.get('plan_search_form').remove();
        }
        if (Ext.get('caserun_search_form')){
            Ext.get('caserun_search_form').remove();
        }

        this.params.current_tab = 'case';
        this.load({
            url: 'tr_query.cgi',
            params: this.params,
            scripts: true,
            text: 'Loading search form...',
            callback: Testopia.Search.fillInForm.createDelegate(this,['case',this.params])
        });
    }
});

RunSearch = function(params){
    this.params = params;
    RunSearch.superclass.constructor.call(this,{
        title: 'Run Search',
        id: 'run_search_panel',
        layout:'fit',
        buttons:[{
            text: 'Submit',
            handler: function(){
                var form = new Ext.form.BasicForm('run_search_form');
                var values = form.getValues();
                if (params.qname)
                    values.qname = params.qname;
                var searchnum = Math.round(Math.random()*100);
                try {
                    // EXT BUG - Closing always causes an error: 
                    // http://extjs.com/forum/showthread.php?t=20930
                    Ext.getCmp('search_win').close();
                }
                catch(err){}
                if (params.report){
                    Ext.getCmp('object_panel').add(new Ext.Panel({
                        id: 'run_search' + searchnum, 
                        closable: true,
                        title: 'Run Report',
                        autoScroll: true,
                        listeners: { 'render': function(){
                            this.load({
                                url: 'tr_run_reports.cgi',
                                params: values
                            });
                        }},
                        tbar:[new Ext.Toolbar.Fill(),
                        {
                            xtype: 'button',
                            id: 'save_run_report_btn',
                            icon: 'testopia/img/save.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Save this report',
                            handler: function(b,e){
                                saveSearch('run', values);
                            }
                        },{
                            xtype: 'button',
                            id: 'link_run_report_btn',
                            icon: 'testopia/img/link.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Create a link to this report',
                            handler: function(b,e){
                                linkPopup(values);
                            }
                        }]
                    }));
                    Ext.getCmp('object_panel').activate('run_search' + searchnum);
                }
                else{
                    Ext.getCmp('object_panel').add(new RunGrid(values,{
                        id: 'run_search' + searchnum, 
                        closable: true,
                        title: 'Run Search'
                    }));
                }
                Ext.getCmp('object_panel').activate('run_search' + searchnum);
            }
        }]
    });

    this.on('activate', this.onActivate, this);
};
Ext.extend(RunSearch, Ext.Panel,{
    onActivate: function(event){
        if (Ext.get('case_search_form')){
            Ext.get('case_search_form').remove();
        }
        if (Ext.get('plan_search_form')){
            Ext.get('plan_search_form').remove();
        }
        if (Ext.get('caserun_search_form')){
            Ext.get('caserun_search_form').remove();
        }

        this.params.current_tab = 'run';
        this.load({
            url: 'tr_query.cgi',
            params: this.params,
            scripts: true,
            text: 'Loading search form...',
            callback: Testopia.Search.fillInForm.createDelegate(this,['run',this.params])
        });
    }
});

CaseRunSearch = function(params){
    this.params = params;
    CaseRunSearch.superclass.constructor.call(this,{
        title: 'Case-Run Search',
        id: 'caserun_search_panel',
        layout:'fit',
        buttons:[{
            text: 'Submit',
            handler: function(){
                var form = new Ext.form.BasicForm('caserun_search_form');
                var values = form.getValues();
                var searchnum = Math.round(Math.random()*100);
                try {
                    // EXT BUG - Closing always causes an error: 
                    // http://extjs.com/forum/showthread.php?t=20930
                    Ext.getCmp('search_win').close();
                }
                catch(err){}
                if (params.report){
                    Ext.getCmp('object_panel').add(new Ext.Panel({
                        id: 'case_run_search' + searchnum, 
                        closable: true,
                        title: 'Case-Run Report',
                        autoScroll: true,
                        listeners: { 'render': function(){
                            this.load({
                                url: 'tr_caserun_reports.cgi',
                                params: values
                            });
                        }},
                        tbar:[new Ext.Toolbar.Fill(),
                        {
                            xtype: 'button',
                            id: 'save_caserun_report_btn',
                            icon: 'testopia/img/save.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Save this report',
                            handler: function(b,e){
                                saveSearch('caserun', values);
                            }
                        },{
                            xtype: 'button',
                            id: 'link_plan_list_btn',
                            icon: 'testopia/img/link.png',
                            iconCls: 'img_button_16x',
                            tooltip: 'Create a link to this report',
                            handler: function(b,e){
                                linkPopup(values);
                            }
                        }]
                    }));
                    Ext.getCmp('object_panel').activate('case_run_search' + searchnum);
                }
                else{
                    Ext.getCmp('object_panel').add(new CaseRunListGrid(values,{
                        id: 'case_run_search' + searchnum, 
                        closable: true,
                        title: 'Case-Run Search'
                    }));
                }
                Ext.getCmp('object_panel').activate('case_run_search' + searchnum);
            }
        }]
    });

    this.on('activate', this.onActivate, this);
};
Ext.extend(CaseRunSearch, Ext.Panel,{
    onActivate: function(event){
        if (Ext.get('case_search_form')){
            Ext.get('case_search_form').remove();
        }
        if (Ext.get('run_search_form')){
            Ext.get('run_search_form').remove();
        }
        if (Ext.get('plan_search_form')){
            Ext.get('plan_search_form').remove();
        }
        this.params.current_tab = 'case_run';
        this.load({
            url: 'tr_query.cgi',
            params: this.params,
            scripts: true,
            text: 'Loading search form...',
            callback: Testopia.Search.fillInForm.createDelegate(this,['caserun',this.params])
        });
    }
});

ReportGrid = function(cfg){
    
    this.store = new Ext.data.JsonStore({
        url: 'tr_query.cgi',
        baseParams: {action: 'get_saved_searches', type: cfg.type},
        root: 'searches',
        fields: ["name","query","author","type"]
    });
    var ds = this.store;
    var current_col = 'dashboard_leftcol';
    
    this.columns = [
        {header: "Name", width: 30, dataindex: "name", sortable: true}
    ];
    
    ReportGrid.superclass.constructor.call(this, {
        id: cfg.id || "reports_grid",
        loadMask: {msg: "Loading ..."},
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: true,
            listeners: {'rowselect': function(sm, i, r){
                var name = r.get('name');
                if(r.get('type') == 1){
                    Ext.getCmp('object_panel').setActiveTab('dashboardpanel');
                    if(Ext.getCmp(name)){
                        return;
                    }
                    var newPortlet = new Ext.ux.Portlet({
                        title: name,
                        id: name,
                        closable: true,
                        autoScroll: true,
                        tools: PortalTools,
                        url: r.get('query')
                    });
                    
                    Ext.getCmp(current_col).add(newPortlet);
                    Ext.getCmp(current_col).doLayout();
            		newPortlet.load({
                        url: r.get('query')
                    });
                    current_col = current_col == 'dashboard_leftcol' ? 'dashboard_rightcol' : 'dashboard_leftcol';
                }
                else{
                    sm.grid.loadPanel(r);
                }
            }}
        }),
        viewConfig: {
            forceFit:true
        }
    });
    Ext.apply(this,cfg);
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(ReportGrid, Ext.grid.GridPanel, {
    onContextClick: function(grid, index, e){
        var d = grid.store.getAt(index).get('query').match(/(tr_list_|_reports)/);
        if (d){
            var g = grid.store.getAt(index).get('query').match(/completion/);
            if (g)
                d = null;
        }
        this.menu = new Ext.menu.Menu({
            id:'run-ctx-menu',
            items: [{
                text: 'Open in a new tab', 
                handler: function(){
                    var r = grid.store.getAt(index);
                    if (r.get('type') == 0){
                        grid.loadPanel(r);
                    }
                    else{
                        var newTab = new Ext.Panel({
                            title: r.get('name'),
                            closable: true,
                            id: 'search' + r.get('name'),
                            autoScroll: true
                        });
                        Ext.getCmp('object_panel').add(newTab);
                        Ext.getCmp('object_panel').activate('search' + r.get('name'));
                		newTab.load({
                            url: r.get('query')
                        });
                    }
                    
                }
            },{
                text: 'Edit', 
                icon: 'testopia/img/edit.png',
                iconCls: 'img_button_16x',
                disabled: d ? false : true,
                handler: function(){
                    var r = grid.store.getAt(index);
                    var name = r.get('name');
                    var q = r.get('query');
                    var type;
                    type = q.match(/tr_list_(run|case|plan|caserun)s/);
                    if (!type) {
                        type = q.match(/tr_(run|case|plan|caserun)_reports/);
                        if (!type) {
                            Ext.Msg.show({
                                title: "Non-editable",
                                msg: "This Search or Report cannot be edited",
                                icon: Ext.MessageBox.ERROR,
                                buttons: Ext.MessageBox.OK
                            });
                            return;
                        }
                    }
                    type = type[1];
                    
                    var params = searchToJson(r.get('query'));
                    SearchPopup(type, params);
                }
            },{
                text: 'Delete',
                icon: 'testopia/img/delete.png',
                iconCls: 'img_button_16x',
                handler: this.deleteSearch.createDelegate(this)
            },{
                text: 'Refresh List', 
                handler: function(){
                    grid.store.reload();
                }
            }]
        });
        e.stopEvent();
        this.menu.showAt(e.getXY());
    },
    deleteSearch: function(){
        var grid = this;
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        Ext.Msg.show({
            msg: 'Are you sure you want to delete this search?',
            buttons: Ext.MessageBox.YESNO,
            icon: Ext.MessageBox.QUESTION,
            fn: function(btn, text){
                if (btn == 'yes'){
                    var r = grid.getSelectionModel().getSelected();
                    form.submit({
                        url: 'tr_query.cgi',
                        params: {action: 'delete_query', query_name: r.get('name')},
                        success: function(){
                            if (grid){
                                grid.store.load();
                            }
                        },
                        failure: testopiaError
                    });
                }
            }
        });
    },
    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load();
        }
    },
    loadPanel: function(r){
        var cfg = {
            id: 'search' + r.get('name'), 
            closable: true,
            title: r.get('name')
        };
        var params = searchToJson(r.get('query'));
        var tab = params.current_tab;
        switch(tab){
            case 'plan':
                Ext.getCmp('object_panel').add(new PlanGrid(params,cfg));
                break;
            case 'run':
                Ext.getCmp('object_panel').add(new RunGrid(params,cfg));
                break;
            case 'case':
                Ext.getCmp('object_panel').add(new CaseGrid(params,cfg));
                break;
            default:
                Ext.Msg.show({
                    title:'No Type Found',
                    msg: 'There must have been a problem saving this search. I can\'t find a type',
                    buttons: Ext.Msg.OK,
                    icon: Ext.MessageBox.ERROR
                });
                return;
        }
        Ext.getCmp('object_panel').activate('search' + r.get('name'));
    }
});

PortalTools = [{
    id:'gear',
    handler: function(e,target,panel){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id: 'portal_tools_menu',
                items: [
                {
                    text: 'Save',
                    handler: function(){
                         Ext.Msg.prompt('Save Report As', '', function(btn, text){
                            if (btn == 'ok'){
                                form.submit({
                                    url: 'tr_query.cgi',
                                    params: {action: 'save_query', query_name: text, query_part: panel.url, type: 1},
                                    success: function(){
                                        Ext.getCmp('reports_grid').store.load();
                                        panel.title = text;
                                    },
                                    failure: testopiaError
                                });
                            }
                        });
                    }
                },{
                    text: 'Link to this report',
                    handler: function(){
                        var path;
                        if (panel.url.match(/^http/)){
                            path = panel.url;
                            path = path.replace(/\&noheader=1/gi, '');
                        }
                        else{
                            var l = window.location;
                            var pathprefix = l.pathname.match(/(.*)[\/\\]([^\/\\]+\.\w+)$/);
                            pathprefix = pathprefix[1];
                            path = l.protocol + '//' + l.host + pathprefix + '/' + panel.url;
                        }
                        var win = new Ext.Window({
                            width: 300,
                            plain: true,
                            shadow: false,
                            items: [new Ext.form.TextField({
                                value: path,
                                width: 287
                            })]
                        });
                        win.show();
                    }
                },{
                    text: 'Delete',
                    handler: function(){
                         Ext.Msg.show({
                            title:'Confirm Delete?',
                            icon: Ext.MessageBox.QUESTION,
                            msg: 'Are you sure you want to delete this report?',
                            buttons: Ext.Msg.YESNO,
                            fn: function(btn, text){
                                if (btn == 'yes'){
                                    form.submit({
                                        url: 'tr_query.cgi',
                                        params: {action: 'delete_query', query_name: panel.title},
                                        success: function(){
                                            Ext.getCmp('reports_grid').store.load();
                                            panel.ownerCt.remove(panel, true);
                                        },
                                        failure: testopiaError
                                    });
                                }
                            }
                        });
                    }
                }]
            });
        }
        e.stopEvent();
        this.menu.showAt(e.getXY());
    }
},{
    id:'close',
    handler: function(e, target, panel){
        panel.ownerCt.remove(panel, true);
    }
}];

/*
 * END OF FILE - /bnc-3.0/testopia/js/search.js
 */

/*
 * START OF FILE - /bnc-3.0/testopia/js/tags.js
 */
/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is the Bugzilla Testopia System.
 *
 * The Initial Developer of the Original Code is Greg Hendricks.
 * Portions created by Greg Hendricks are Copyright (C) 2006
 * Novell. All Rights Reserved.
 *
 * Contributor(s): Greg Hendricks <ghendricks@novell.com>
 *                 Ryan Hamilton <rhamilton@novell.com>
 *                 Daniel Parker <dparker1@novell.com>
 */

Testopia.Tags = {};

Testopia.Tags.renderer = function(v,md,r,ri,ci,s,type,pid){
    return '<div style="cursor:pointer" onclick=Testopia.Tags.list("' + type + '",' + pid +',"'+ r.get('tag_name') +'")>'+ v + '</div>';
};
 
Testopia.Tags.list = function(type, product, tag){
    var cfg = {
        title: 'Tag Results: ' + tag,
        closable: true,
        id: tag + 'search' + product,
        autoScroll: true
    }; 
    var search = {
        product_id: product,
        tags: tag
    };
    
    var newTab
    if (type == 'case'){
        newTab = new CaseGrid(search, cfg); 
    }
    else if (type == 'plan'){
        newTab = new PlanGrid(search, cfg); 
    }
    else if (type == 'run'){
        newTab = new RunGrid(search, cfg); 
    }
    
    Ext.getCmp('object_panel').add(newTab);
    Ext.getCmp('object_panel').activate(tag + 'search' + product);
};
TestopiaObjectTags = function(obj, obj_id){
    this.orig_id = obj_id;
    this.obj_id = obj_id;
    this.store = new Ext.data.JsonStore({
        url: 'tr_tags.cgi',
        baseParams: {action: 'gettags', type: obj},
        root: 'tags',
        id: 'tag_id',
        fields: [
            {name: 'tag_id', mapping: 'tag_id'},
            {name: 'tag_name', mapping: 'tag_name'},
            {name: 'run_count', mapping:'run_count'},
            {name: 'case_count', mapping:'case_count'},
            {name: 'plan_count', mapping:'plan_count'}
        ]
    });
    var ds = this.store;
    this.remove = function(){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        form.submit({
            url: 'tr_tags.cgi',
            params: {action: 'removetag', type: obj, id: this.obj_id, tag: getSelectedObjects(Ext.getCmp(obj + 'tagsgrid'), 'tag_name')},
            success: function(){
                ds.reload();
            },
            failure: testopiaError
        });
    };
    this.add = function(){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        form.submit({
            url: 'tr_tags.cgi',
            params: {action: 'addtag', type: obj, id: this.obj_id, tag: Ext.getCmp(obj + 'tag_lookup').getRawValue()},
            success: function(){
                ds.reload();
            },
            failure: testopiaError
        });
    };
    this.columns = [
        {dataIndex: 'tag_id', hidden: true, hideable: false},
        {header: 'Name', width: 150, dataIndex: 'tag_name', id: 'tag_name', sortable:true, hideable: false},
        {header: 'Cases', width: 35, dataIndex: 'case_count', sortable:true, hidden: true, renderer: Testopia.Tags.renderer.createDelegate(this, ['case'], true)},
        {header: 'Runs', width: 35, dataIndex: 'run_count', sortable:true, hidden: true, renderer: Testopia.Tags.renderer.createDelegate(this, ['run'], true)},
        {header: 'Plans', width: 35, dataIndex: 'plan_count', sortable:true, hidden: true, renderer: Testopia.Tags.renderer.createDelegate(this, ['plan'], true)}
    ];
    
    var addButton = new Ext.Button({
        id: 'tag_add_btn',
        icon: 'testopia/img/add.png',
        iconCls: 'img_button_16x',
        handler: this.add.createDelegate(this)
    });
    
    var deleteButton = new Ext.Button({
        icon: 'testopia/img/delete.png',
        iconCls: 'img_button_16x',
        handler: this.remove.createDelegate(this)
    });
        
    TestopiaObjectTags.superclass.constructor.call(this, {
        title: 'Tags',
        split: true,
        region: 'east',
        layout: 'fit',
        width: 200,
        autoExpandColumn: "tag_name",
        collapsible: true,
        id: obj + 'tagsgrid',
        loadMask: {msg:'Loading ' + obj + ' tags...'},
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false
        }),
        viewConfig: {
            forceFit:true
        },
        tbar: [
            new TagLookup({id: obj + 'tag_lookup'}), addButton, deleteButton
        ]
    });

    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(TestopiaObjectTags, Ext.grid.GridPanel, {
    onContextClick: function(grid, index, e){
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'tags-ctx-menu',
                items: [
                    {
                         text: 'Remove Selected Tags', 
                         icon: 'testopia/img/delete.png',
                         iconCls: 'img_button_16x',
                         handler: this.remove
                    },{
                        text: 'Refresh List', 
                        handler: function(){
                            grid.store.reload();
                        } 
                    }
                ]
            });
        }
        e.stopEvent();
        if (grid.getSelectionModel().getCount() < 1){
            grid.getSelectionModel().selectRow(index);
        }
        this.menu.showAt(e.getXY());
    },

    onActivate: function(event){
        if (!this.store.getCount() || this.orig_id != this.obj_id){
            this.store.load({params:{id: this.obj_id}});
        }
    }
});

/*
 * TestopiaProductTags - Display a grid of tags for a product, or a user.
 */
TestopiaProductTags = function(title, type, product_id){
    var tag_id;
    this.product_id = product_id;
    
    this.store = new Ext.data.JsonStore({
        url: 'tr_tags.cgi',
        baseParams: {action: 'gettags', type: type},
        root:'tags',
        id: 'tag_id',
        fields: [
            {name: 'tag_id', mapping: 'tag_id'},
            {name: 'tag_name', mapping: 'tag_name'},
            {name: 'run_count', mapping:'run_count'},
            {name: 'case_count', mapping:'case_count'},
            {name: 'plan_count', mapping:'plan_count'}
        ]
    });
    var ds = this.store;
    
    this.columns = [
        {header: "ID", dataIndex: 'tag_id', hidden: true},
        {header: 'Name', width: 150, dataIndex: 'tag_name', id: 'tag_name', sortable:true},
        {header: 'Cases', width: 35, dataIndex: 'case_count', sortable:true, renderer: Testopia.Tags.renderer.createDelegate(this, ['case', product_id], true)},
        {header: 'Runs', width: 35, dataIndex: 'run_count', sortable:true, renderer: Testopia.Tags.renderer.createDelegate(this, ['run', product_id], true)},
        {header: 'Plans', width: 35, dataIndex: 'plan_count', sortable:true, renderer: Testopia.Tags.renderer.createDelegate(this, ['plan', product_id], true)}
    ];
    
    var filter = new Ext.form.TextField({
        allowBlank: true,
        id: 'rungrid-filter',
        selectOnFocus: true
    });
    
    TestopiaProductTags.superclass.constructor.call(this, {
        title: title,
        id: type + 'tags',
        loadMask: {msg:'Loading ' + title + ' ...'},
        autoExpandColumn: "tag_name",
        autoScroll: true,
        sm: new Ext.grid.RowSelectionModel({
            singleSelect: false
        }),
        viewConfig: {
            forceFit:true
        }
    });
    
    this.on('rowcontextmenu', this.onContextClick, this);
    this.on('activate', this.onActivate, this);
};

Ext.extend(TestopiaProductTags, Ext.grid.GridPanel, {
    onContextClick: function(grid, index, e){
        
        if(!this.menu){ // create context menu on first right click
            this.menu = new Ext.menu.Menu({
                id:'tags-ctx-menu',
                items: [
                    {
                        text: 'Refresh', 
                         handler: function(){
                             ds.reload();
                         }
                     }
                ]
            });
        }
        e.stopEvent();
        this.menu.showAt(e.getXY());
    },

    onActivate: function(event){
        if (!this.store.getCount()){
            this.store.load({params: {product_id: this.product_id}});
        }
    }
});

TagsUpdate = function(type, grid){
    function commitTag(action, value, grid){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        form.submit({
            url: 'tr_tags.cgi',
            params: {action: action, tag: value, type: type, id: getSelectedObjects(grid, type+'_id')},
            success: function(){},
            failure: testopiaError
        });
    }
     var win = new Ext.Window({
         title: 'Add or Remove Tags',
         id: 'tags_edit_win',
         layout: 'fit',
         split: true,
         plain: true,
         shadow: false,
         width: 350,
         height: 150,
         items: [
            new Ext.FormPanel({
                labelWidth: '40',
                bodyStyle: 'padding: 5px',
                items: [new TagLookup({
                    fieldLabel: 'Tags'
                })]
            })
        ],
        buttons: [{
            text:'Add Tag',
            handler: function(){
                commitTag('addtag', Ext.getCmp('tag_lookup').getRawValue(), grid);
                win.close();
            }
        },{
            text: 'Remove Tag',
            handler: function(){
                commitTag('removetag', Ext.getCmp('tag_lookup').getRawValue(), grid);
                win.close();
            }
        },{
            text: 'Close',
            handler: function(){
                win.close();
            }
        }]
    });
    win.show();
};
         
/*
 * END OF FILE - /bnc-3.0/testopia/js/tags.js
 */

/*
 * JavaScript file created by Rockstarapps Concatenation
*/
