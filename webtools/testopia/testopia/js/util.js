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
        listeners: {'valid': function(f) {
            f.value = f.getRawValue();
        }},
        queryParam: 'search',
        loadingText: 'Looking up users...',
        displayField: 'login',
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
