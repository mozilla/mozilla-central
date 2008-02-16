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

