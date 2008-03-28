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
            singleSelect: false,
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

PlanClonePanel = function(plan){
    var form = new Ext.form.BasicForm('plan_clone_frm',{});
    form.on('beforeaction',function(f,a){
        f.el.mask('Processing...');
    });

    doClone = function(f,a){
        form.submit({
            url: 'tr_process_plan.cgi',
            success: function(f,a){
                var data = a.response;
                Ext.getCmp('plan-clone-win').close();
                window.location="tr_show_plan.cgi?plan_id=" + a.result.plan_id;
            },
            failure: testopiaError
        });
    };
    
    PlanClonePanel.superclass.constructor.call(this, {
        id: 'plan-clone-panel',
        contentEl: 'plan-clone-div',
        buttons: [{
            text: 'Submit',
            handler: doClone
        },{
            text: 'Cancel',
            handler: function(){
                Ext.getCmp('plan-clone-win').hide();
            }
        }]
    });
};
Ext.extend(PlanClonePanel, Ext.Panel);

PlanClonePopup = function(plan){
    if (!this.window){
        var win = new Ext.Window({
            id: 'plan-clone-win',
            closable: true,
            width: 800,
            height: 550,
            plain: true,
            shadow: false,
            closable: false,
            layout: 'fit',
            items: [new PlanClonePanel(plan)]
        });
        this.window = win;
    }
    return this;
};
