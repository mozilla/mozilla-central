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
    var selected;
    
    CaseRunPanel.superclass.constructor.call(this, {
        layout: 'border',
        title: 'Test Cases',
        id: 'caserun-panel',
        border: false,
        bodyBorder: false,
        items: [filter, cgrid, cr]
    });
    cr.disable();
    cgrid.getSelectionModel().on('rowdeselect', function (sm,n,r){
        if (sm.getCount() < 1){
            cr.disable();
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
    });
    cgrid.getSelectionModel().on('rowselect', function (sm,n,r){
        cr.enable();
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
        for (var i=0; i< sm.grid.store.data.items.length; i++){
            if (sm.grid.getSelectionModel().isSelected(i)){
                sel.push(i);
            }
        }
        sm.grid.selectedRows = sel;
        if (sm.getCount() > 1){
            return;
        }

        Ext.getCmp('case_bugs_panel').tcid = r.get('case_id');
        Ext.getCmp('case_comps_panel').tcid = r.get('case_id');
        Ext.getCmp('attachments_panel').object = r.data;
        cr.caserun_id = r.get('caserun_id');
        
        var tab = Ext.getCmp('caserun_center_region').getActiveTab();
        Ext.getCmp(tab.id).fireEvent('activate');
        if (Ext.getCmp('case_bugs_panel')){
            Ext.getCmp('case_bugs_panel').case_id = r.get('case_id');
        }
        if (Ext.getCmp('case_bugs_panel')){
            Ext.getCmp('case_bugs_panel').case_id = r.get('case_id');
        }
        cr.store.load({
            params: {
                caserun_id: r.get('caserun_id'), 
                action: 'gettext'
            }
        });
        selected = n;
    });
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
                        Ext.getCmp('run_filter_grid').store.reload();
                    },
                    failure: testopiaError
                });
            }
        },
//        new Ext.Toolbar.Fill(),
        {
            text: 'Search',
            handler: function(){
                Ext.getCmp('caserun_grid').store.baseParams = searchform.getValues();
                Ext.getCmp('caserun_grid').store.load();
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
        baseParams: {ctype: 'json', viewall:1},
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
               {name: "assignee_name", mapping:"assignee_name"},
               {name: "testedby", mapping:"testedby"},
               {name: "status", mapping:"status"},
               {name: "category", mapping:"category"},
               {name: "priority", mapping:"priority"},
               {name: "bug_count", mapping:"bug_count"},
               {name: "case_summary", mapping:"case_summary"},
               {name: "component", mapping:"component"}
               
        ]}),
        remoteSort: false,
        sortInfo: {field: 'run_id', direction: "ASC"},
        groupField: 'run_id'
    });
    this.store.paramNames.sort = 'order';
    this.columns = [
        {header: "Case", width: 50, dataIndex: 'case_id', sortable: true, hidden:true},
        {header: "Run", width: 50, dataIndex: 'run_id', sortable: true, 
         groupRenderer: function(v){return v;},
         renderer: tutil.runLink },
        {header: "Build", width: 50, dataIndex: 'build', sortable: true, id: 'caserun_list_build_col'},
        {header: "Environment", width: 50, dataIndex: 'environment', sortable: true},
		{header: "Assignee", width: 150, sortable: true, dataIndex: 'assignee_name'},
        {header: "Tested By", width: 150, sortable: true, dataIndex: 'testedby'},
		{header: "Status", width: 30, sortable: true, dataIndex: 'status', groupRenderer: function(v){return v;}, renderer: tutil.statusIcon},		
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
    var t = new TestopiaUtil();
    this.params = params;
    this.run = run;
    var testopia_form = new Ext.form.BasicForm('testopia_helper_frm',{});
    envRenderer = function(v,md,r,ri,ci,s){
        f = this.getColumnModel().getCellEditor(ci,ri).field;
        record = f.store.getById(v);
        if (record) {
            return '<a href="tr_show_environment.cgi?env_id=' + record.data[f.valueField] +'">' + record.data[f.displayField] +'</a>';
        }
        else {
            return '<a href="tr_show_environment.cgi?env_id=' + r.data.env_id +'">' + v +'</a>';
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
               {name: "assignee_name", mapping:"assignee_name"},
               {name: "testedby", mapping:"testedby"},
               {name: "status", mapping:"status"},
               {name: "requirement", mapping:"requirement"},
               {name: "category", mapping:"category"},
               {name: "priority", mapping:"priority"},
               {name: "bug_count", mapping:"bug_count"},
               {name: "case_summary", mapping:"case_summary"},
               {name: "type", mapping:"type"},
               {name: "id", mapping:"id"},
               {name: "component", mapping:"component"}
               
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
        params: {product_id: run.plan.product_id}
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
        params: {product_id: run.plan.product_id}
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
             new BuildCombo({params: {product_id: run.plan.product_id}})
         ),renderer: TestopiaComboRenderer.createDelegate(this)},
        {header: "Environment", width: 50, dataIndex: 'environment', sortable: true,
         editor: new Ext.grid.GridEditor(
             new EnvironmentCombo({params: {product_id: run.plan.product_id}})
         ),renderer: envRenderer.createDelegate(this)},
		{header: "Assignee", width: 150, sortable: true, dataIndex: 'assignee_name',
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
        {header: "Component", width: 100, sortable: true,dataIndex: 'component'}
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
                tooltip: 'Mark as IDLE',
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
                    TestopiaUpdateMultiple('caserun', { status_id: 4, ids: getSelectedObjects(Ext.getCmp('caserun_grid'),'caserun_id')}, Ext.getCmp('caserun_grid'));
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
            singleSelect: false
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
                                        params: {product_id: grid.run.plan.product_id},
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
                                        params: {product_id: grid.run.plan.product_id},
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
                        RunClonePopup(grid.run,getSelectedObjects(grid,'case_id'));
                    }
                },{
                    text: 'Refresh List', 
                    handler: function(){
                        grid.store.reload();
                    } 
                },{
                    text: 'View Test Case in a New Tab',
                    handler: function(){
                        window.open('tr_show_case.cgi?case_id=' + grid.store.getAt(index).get('case_id'));
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
        case 'assignee_name':
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
    appendNote = function(){
        var form = new Ext.form.BasicForm('testopia_helper_frm',{});
        form.submit({
            url: 'tr_caserun.cgi',
            params: {action: 'update_note', note: Ext.getCmp('caserun_append_note_fld').getValue(), caserun_id: this.caserun_id},
            success: function(){
                store.reload();
            },
            failure: testopiaError
        });
    };
    CaseRun.superclass.constructor.call(this,{
        layout: 'fit',
        region: 'south',
        split: true,
        border: false,
        bodyBorder: false,
        collapsible: true,
        height: 250,
        items:[{
            xtype: 'tabpanel',
            bodyBorder: false,
            activeTab: 0,
            id: 'caserun_center_region',
            title:'Details',
            width: 200,
            items: [{
                title:'Action & Expected Results',
                id: 'caserun_action_panel',
                border:false,
                bodyBorder: false,
                layout: 'fit',
                autoScroll: true,
                items:[{
                    xtype: 'dataview',
                    bodyBorder: false,
                    store: store,
                    itemSelector: 'div.actiondiv',
                    loadingText: 'Loading...',
                    tpl: new Ext.XTemplate(
                        '<tpl for=".">',
                          '<table style="width: 100%"><tr>',
                            '<td valign="top" width="50%" class="ae_s">',
                            '<div style="overflow:auto" >',
                              '<b>Action:</b><br/>{action}',
                            '</div>',
                            '</td>',
                            '<td valign="top" align="left" width="50%" class="ae_s">',
                            '<div style="overflow:auto">',
                              '<b>Expected Results:</b><br/>{results}',
                            '</div>',
                            '</td>',
                          '</tr></table>',
                        '</tpl>',
                        '<div class="x-clear"></div>'
                    )
                }]
            },{
                title:'Setup & Breakdown',
                id: 'caserun_setup_panel',
                border:false,
                bodyBorder: false,
                layout: 'fit',
                autoScroll: true,
                items:[{
                    xtype: 'dataview',
                    bodyBorder: false,
                    store: store,
                    itemSelector: 'div.actiondiv',
                    loadingText: 'Loading...',
                    tpl: new Ext.XTemplate(
                        '<tpl for=".">',
                          '<table style="width: 100%"><tr>',
                            '<td valign="top" width="50%" class="ae_s">',
                            '<div style="overflow:auto" >',
                              '<b>Setup:</b><br/>{setup}',
                            '</div>',
                            '</td>',
                            '<td valign="top" align="left" width="50%" class="ae_s">',
                            '<div style="overflow:auto">',
                              '<b>Breakdown:</b><br/>{breakdown}',
                            '</div>',
                            '</td>',
                          '</tr></table>',
                        '</tpl>',
                        '<div class="x-clear"></div>'
                    )
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
            new CaseComponentsGrid()]
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
            {name: 'summary', mapping: 'summary'},
            {name: 'bug_id', mapping: 'bug_id'}
        ]
    });
    addbug = function(){
        tcid = this.tcid;
        testopia_form.submit({
            url: 'tr_process_case.cgi',
            params: {action: 'edit', bugs: Ext.getCmp('attachbug').getValue(), case_id: this.tcid},
            success: function(){
                ds.load({
                    params: {case_id: tcid}
                });
            },
            failure: testopiaError
        });
    };
    removebug = function(){
        tcid = this.tcid;
        testopia_form.submit({
            url: 'tr_process_case.cgi',
            params: {action: 'detachbug', bug_id: getSelectedObjects(Ext.getCmp('case_bugs_panel'), 'bug_id'), case_id: this.tcid},
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
            window.open(url);
        });
    };
    var ds = this.store;
    this.columns = [
        {header: "ID", width: 150, dataIndex: 'bug_id', sortable: true, renderer: bug_link},
        {id: 'bugs_summary', header: "Summary", width: 150, dataIndex: 'summary', sortable: true}
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
        }],
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
