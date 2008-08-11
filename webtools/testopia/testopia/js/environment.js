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
                    icon: 'testopia/img/refresh.png',
                    iconCls: 'img_button_16x',
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
