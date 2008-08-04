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
