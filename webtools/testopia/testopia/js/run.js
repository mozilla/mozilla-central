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
           {name: "plan_version", mapping:"plan_version"}
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
                                text: 'New Completion Report',
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
                            }]
                        }
                    },{
                        text: 'Edit',
                        menu: {
                             items: [{
                                 text: 'Manger',
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
                    text: 'View Test Run in a New Tab',
                    handler: function(){
                        window.open('tr_show_run.cgi?run_id=' + grid.store.getAt(grid.selindex).get('run_id'));
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
            text: 'Add Case',
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
                        Ext.getCmp('newrun-win').close();
                    },
                    failure: testopiaError
                });
            }
        },{
            text: 'Cancel',
            type: 'reset',
            handler: function(){
                Ext.getCmp('newrunsouth').getForm().reset();
                Ext.getCmp('newRun-win').close();
            }
        }]
    });
    this.on('render', function(){
        casegrid.store.load();
    });
};
Ext.extend(NewRunForm, Ext.Panel);

RunClonePanel = function(run, caselist){

    doClone = function(f,a){
        var form = new Ext.form.BasicForm('run_clone_frm',{});
        form.on('beforeaction', function(f,a){
            f.el.mask('Processing...');
        });

        form.submit({
            url: 'tr_process_run.cgi',
            timeout: 120,
            success: function(f,a){
                Ext.getCmp('run-clone-win').close();
                window.location="tr_show_run.cgi?run_id=" + a.result.run_id;
            },
            failure: testopiaError
        });
    };

    RunClonePanel.superclass.constructor.call(this,{
        id: 'run-clone-panel',
        title: 'Select Clone Options',
        listeners: {'render':function(p){
            p.load({
                url: 'tr_process_run.cgi',
                params: {action: 'getcloneform', case_list: caselist, run_id: run.run_id}
            });
        }},
        bodyStyle: 'padding: 10px',
        autoShow: true,
        buttons: [{
            text: 'Submit',
            handler:  doClone
        },{
            text: 'Cancel',
            handler: function(){
                Ext.getCmp('run-clone-win').close();
            }
        }]
    });
};
Ext.extend(RunClonePanel, Ext.Panel);

RunClonePopup = function(run,caselist){
    var win = new Ext.Window({
        id: 'run-clone-win',
        closable:true,
        width: 600,
        height: 500,
        plain: true,
        shadow: false,
        layout: 'fit',
        items: [new RunClonePanel(run,caselist)]
    });
    
    win.show(this);
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
