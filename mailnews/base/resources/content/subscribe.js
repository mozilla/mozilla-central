/*
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Markus Hossner <markushossner@gmx.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
 
var gSubscribeTree = null;
var gSearchTree;
var okCallback = null;
var gChangeTable = {};
var gServerURI = null;
var gSubscribableServer = null;
var gStatusBar = null;
var gNameField = null;
var gNameFieldLabel = null;
var gFolderDelimiter = ".";
var gStatusFeedback = new nsMsgStatusFeedback;
var gTimelineEnabled = false;
var gMessengerBundle = null;
var gSubscribeDeck = null;
var gSearchView = null;
var gSearchTreeBoxObject = null;
// the rdf service
var RDF = Components.classes['@mozilla.org/rdf/rdf-service;1'].getService(Components.interfaces.nsIRDFService);
var subscribeDS = RDF.GetDataSource("rdf:subscribe");

// get the "subscribed" atom
var atomService = Components.classes["@mozilla.org/atom-service;1"].getService().QueryInterface(Components.interfaces.nsIAtomService);
var gSubscribedAtom = atomService.getAtom("subscribed").QueryInterface(Components.interfaces.nsISupports);

var gSubscribeBundle;

function goDoCommand()
{
}

function Stop()
{
    //dump("Stop()\n")
    if (gSubscribableServer) {
        gSubscribableServer.stopPopulating(msgWindow);
    }
}

function SetServerTypeSpecificTextValues()
{
    if (!gServerURI) return;

    var serverType = GetMsgFolderFromUri(gServerURI, true).server.type;

    // set the server specific ui elements
    var nameColumnLabel = gSubscribeBundle.getString("columnHeader-" + serverType);
    var currentListTab  = "currentListTab-" + serverType;
    var currentListTabLabel     = gSubscribeBundle.getString(currentListTab + ".label");
    var currentListTabAccesskey = gSubscribeBundle.getString(currentListTab + ".accesskey");

    document.getElementById("currentListTab").setAttribute('label', currentListTabLabel);
    document.getElementById("currentListTab").setAttribute('accesskey', currentListTabAccesskey);
    document.getElementById("newGroupsTab").collapsed = (serverType != "nntp"); // show newGroupsTab only for nntp servers
    document.getElementById("nameColumn").setAttribute('label', nameColumnLabel);
    document.getElementById("nameColumn2").setAttribute('label',nameColumnLabel);

    //set the delimiter
    try {
        gFolderDelimiter = gSubscribableServer.delimiter;
    }
    catch (ex) {
        //dump(ex + "\n");
        gFolderDelimiter = ".";
    }
}

function onServerClick(event)
{
  gServerURI = event.target.id;

  SetServerTypeSpecificTextValues();
  ShowCurrentList();
}

function SetUpServerMenu()
{
	//dump("SetUpServerMenu()\n");

    var serverMenu = document.getElementById("serverMenu");
    var menuitems = serverMenu.getElementsByAttribute("id", gServerURI);

	try {
		//dump("gServerURI="+gServerURI+"\n");
		//dump("menuitems="+menuitems+"\n");
		//dump("menuitems[0]="+menuitems[0]+"\n");
		//dump("serverMenu="+serverMenu+"\n");
    	serverMenu.selectedItem = menuitems[0];
	}
	catch (ex) {
		//dump("failed to set the selected server: " + ex + "\n");
	}

	SetServerTypeSpecificTextValues();
}

var MySubscribeListener = {
    OnDonePopulating: function() {
        gStatusFeedback._stopMeteors();

        // only re-root the tree, if it is null.
        // otherwise, we are in here because we are populating
        // a part of the tree
        var refValue = gSubscribeTree.getAttribute('ref');
        if (!refValue) {
            //dump("root subscribe tree at: "+ gServerURI +"\n");
            gSubscribeTree.database.AddDataSource(subscribeDS);
            gSubscribeTree.setAttribute('ref',gServerURI);
        }

        document.getElementById("refreshButton").disabled = false;
        document.getElementById("currentListTab").disabled = false;
        document.getElementById("newGroupsTab").disabled = false;
	}
};

function SetUpTree(forceToServer, getOnlyNew)
{
  gStatusBar = document.getElementById('statusbar-icon');
  if (!gServerURI)
    return;

  var server = GetMsgFolderFromUri(gServerURI, true).server;
  try
  {          
    CleanUpSearchView();
    gSubscribableServer = server.QueryInterface(Components.interfaces.nsISubscribableServer);
    gSubscribeTree.setAttribute('ref',null);

    // enable (or disable) the search related UI
    EnableSearchUI();

    // clear out the text field when switching server
    gNameField.value = "";

    // since there is no text, switch to the non-search view...
    SwitchToNormalView();

    gSubscribeTree.database.RemoveDataSource(subscribeDS);
    gSubscribableServer.subscribeListener = MySubscribeListener;

    var currentListTab = document.getElementById("currentListTab");
    if (currentListTab.selected)
      document.getElementById("newGroupsTab").disabled = true;
    else
      currentListTab.disabled = true;

    document.getElementById("refreshButton").disabled = true;

    gStatusFeedback._startMeteors();
    gStatusFeedback.showStatusString(gSubscribeBundle.getString("pleaseWaitString"));

    gSubscribableServer.startPopulating(msgWindow, forceToServer, getOnlyNew);
  }
  catch (ex) 
  {
    dump("failed to populate subscribe ds: " + ex + "\n");
  }
}

function SubscribeOnUnload()
{
  try {
    CleanUpSearchView();
    gSubscribeTree.database.RemoveDataSource(subscribeDS);
  }
  catch (ex) {
    dump("failed to remove the subscribe ds: " + ex + "\n");
  }
}

function EnableSearchUI()
{
  if (gSubscribableServer.supportsSubscribeSearch) {
    gNameField.removeAttribute('disabled');
    gNameFieldLabel.removeAttribute('disabled');
  }
  else {
    gNameField.setAttribute('disabled',true);
    gNameFieldLabel.setAttribute('disabled',true);
  }
}

function SubscribeOnLoad()
{
  //dump("SubscribeOnLoad()\n");
  gSubscribeBundle = document.getElementById("bundle_subscribe");
  gMessengerBundle = document.getElementById("bundle_messenger");
	
  gSubscribeTree = document.getElementById("subscribeTree");
  gSearchTree = document.getElementById("searchTree");
  gSearchTreeBoxObject = document.getElementById("searchTree").treeBoxObject;
  gNameField = document.getElementById("namefield");
  gNameFieldLabel = document.getElementById("namefieldlabel");

  gSubscribeDeck = document.getElementById("subscribedeck");

  msgWindow = Components.classes[msgWindowContractID].createInstance(Components.interfaces.nsIMsgWindow);
  msgWindow.domWindow = window;  
  msgWindow.statusFeedback = gStatusFeedback;
  msgWindow.rootDocShell.allowAuth = true;
  msgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;

	// look in arguments[0] for parameters
	if (window.arguments && window.arguments[0]) {
		if ( window.arguments[0].okCallback ) {
			top.okCallback = window.arguments[0].okCallback;
		}
	}
	
	gServerURI = null;
	if (window.arguments[0].preselectedURI) {
		var uri = window.arguments[0].preselectedURI;
		//dump("subscribe: got a uri," + uri + "\n");
		var folder = GetMsgFolderFromUri(uri, true);
		//dump("folder="+folder+"\n");
		//dump("folder.server="+folder.server+"\n");
		try {
                        CleanUpSearchView();
			gSubscribableServer = folder.server.QueryInterface(Components.interfaces.nsISubscribableServer);
                        // enable (or disable) the search related UI
                        EnableSearchUI();
			gServerURI = folder.server.serverURI;
		}
		catch (ex) {
			//dump("not a subscribable server\n");
                        CleanUpSearchView();
			gSubscribableServer = null;
			gServerURI = null;
		}
	}

	if (!gServerURI) {
		//dump("subscribe: no uri\n");
		//dump("xxx todo:  use the default news server.  right now, I'm just using the first server\n");
		var serverMenu = document.getElementById("serverMenu");
		var menuitems = serverMenu.getElementsByTagName("menuitem");
		
		if (menuitems.length > 1) {
			gServerURI = menuitems[1].id;
		}
		else {
			//dump("xxx todo none of your servers are subscribable\n");
			//dump("xxx todo fix this by disabling subscribe if no subscribable server or, add a CREATE SERVER button, like in 4.x\n");
			return;
		}
	}

	SetUpServerMenu();

  ShowCurrentList();

  gNameField.focus();
}

function subscribeOK()
{
	//dump("in subscribeOK()\n")
	if (top.okCallback) {
		top.okCallback(top.gChangeTable);
	}
	Stop();
	if (gSubscribableServer) {
		gSubscribableServer.subscribeCleanup();
	}
	return true;
}

function subscribeCancel()
{
  Stop();
  if (gSubscribableServer) {
    gSubscribableServer.subscribeCleanup();
  }
  return true;
}

function SetState(name,state)
{
  var changed = gSubscribableServer.setState(name, state);
  if (changed)
    StateChanged(name,state);
}

function changeTableRecord(server, name, state) 
{
  this.server = server;
  this.name = name;
  this.state = state;
}

function StateChanged(name,state)
{
  if (gServerURI in gChangeTable) {
    if (name in gChangeTable[gServerURI]) {
      var oldValue = gChangeTable[gServerURI][name];
      if (oldValue != state)
        delete gChangeTable[gServerURI][name];
    }
    else {
      gChangeTable[gServerURI][name] = state;
    }
  }
  else {
    gChangeTable[gServerURI] = {};
    gChangeTable[gServerURI][name] = state;
  }
}

function InSearchMode()
{
    // search is the second card in the deck
    return (gSubscribeDeck.getAttribute("selectedIndex") == "1");
}

function SearchOnClick(event)
{
  // we only care about button 0 (left click) events
  if (event.button != 0 || event.originalTarget.localName != "treechildren") return;

  var row = {}, col = {}, childElt = {};
  gSearchTreeBoxObject.getCellAt(event.clientX, event.clientY, row, col, childElt);
  if (row.value == -1 || row.value > gSearchView.rowCount-1)
    return;

  if (col.value.id == "subscribedColumn2") {
    if (event.detail != 2) {
      // single clicked on the check box 
      // (in the "subscribedColumn2" column) reverse state
      // if double click, do nothing
      ReverseStateFromRow(row.value);
    }
  } else if (event.detail == 2) {
    // double clicked on a row, reverse state
    ReverseStateFromRow(row.value);
  }

  // invalidate the row
  InvalidateSearchTreeRow(row.value);
}

function ReverseStateFromRow(row)
{
    // to determine if the row is subscribed or not,
    // we get the properties for the "subscribedColumn2" cell in the row
    // and look for the "subscribed" property
    // if the "subscribed" atom is in the list of properties
    // we are subscribed
    var properties = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
    var col = gSearchTree.columns["subscribedColumn2"];
    gSearchView.getCellProperties(row, col, properties);

    var isSubscribed = (properties.GetIndexOf(gSubscribedAtom) != -1);
    SetStateFromRow(row, !isSubscribed);
}

function SetStateFromRow(row, state)
{
    var col = gSearchTree.columns["nameColumn2"];
    var name = gSearchView.getCellText(row, col);

    SetState(name, state);
}

function SetSubscribeState(state)
{
  try {
    // we need to iterate over the tree selection, and set the state for 
    // all rows in the selection
    var inSearchMode = InSearchMode();
    var view = inSearchMode ? gSearchView : gSubscribeTree.view;
    var colId = inSearchMode ? "nameColumn2" : "nameColumn";
    
    var sel = view.selection;
    for (var i = 0; i < sel.getRangeCount(); ++i) {
      var start = {}, end = {};
      sel.getRangeAt(i, start, end);
      for (var k = start.value; k <= end.value; ++k) {
        if (inSearchMode)
          SetStateFromRow(k, state);
        else {
          var rowRes = gSubscribeTree.builderView.getResourceAtIndex(k);
          var name = GetRDFProperty(rowRes, "Name");
          SetState(name, state);
        }
      }
    }
    
    if (inSearchMode) {
      // force a repaint
      InvalidateSearchTree();
    }
  }
  catch (ex) {
    dump("SetSubscribedState failed:  " + ex + "\n");
  }
}

function ReverseStateFromNode(row)
{
  var rowRes = gSubscribeTree.builderView.getResourceAtIndex(row);
  var isSubscribed = GetRDFProperty(rowRes, "Subscribed");
  var name = GetRDFProperty(rowRes, "Name");

  SetState(name, isSubscribed != "true");
}

function GetRDFProperty(aRes, aProp)
{
  var propRes = RDF.GetResource("http://home.netscape.com/NC-rdf#"+aProp);
  var valueRes = gSubscribeTree.database.GetTarget(aRes, propRes, true);
  return valueRes ? valueRes.QueryInterface(Components.interfaces.nsIRDFLiteral).Value : null;
}

function SubscribeOnClick(event)
{
  // we only care about button 0 (left click) events
  if (event.button != 0 || event.originalTarget.localName != "treechildren")
   return;
 
  var row = {}, col = {}, obj = {};
  gSubscribeTree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
  if (row.value == -1 || row.value > (gSubscribeTree.view.rowCount - 1))
    return;

  if (event.detail == 2) {
    // only toggle subscribed state when double clicking something
    // that isn't a container
    if (!gSubscribeTree.view.isContainer(row.value)) {
      ReverseStateFromNode(row.value);
      return;
    } 
  }
  else if (event.detail == 1)
  {
    if (obj.value == "twisty") {
        if (gSubscribeTree.view.isContainerOpen(row.value)) {
          var uri = gSubscribeTree.builderView.getResourceAtIndex(row.value).Value;

          gStatusFeedback._startMeteors();
          gStatusFeedback.showStatusString(gSubscribeBundle.getString("pleaseWaitString"));

          gSubscribableServer.startPopulatingWithUri(msgWindow, true /* force to server */, uri);
        }
    }
    else {
      // if the user single clicks on the subscribe check box, we handle it here
      if (col.value.id == "subscribedColumn")
        ReverseStateFromNode(row.value);
    }
  }
}

function Refresh()
{
  // clear out the textfield's entry
  gNameField.value = "";

  var newGroupsTab = document.getElementById("newGroupsTab");
  SetUpTree(true, newGroupsTab.selected);
}

function ShowCurrentList()
{
  // clear out the textfield's entry on call of Refresh()
  gNameField.value = "";

  // make sure the current list tab is selected
  document.getElementById("subscribeTabs").selectedIndex = 0;

  // try loading the hostinfo before talk to server
  SetUpTree(false, false);
}

function ShowNewGroupsList()
{
  // clear out the textfield's entry
  gNameField.value = "";

  // make sure the new groups tab is selected
  document.getElementById("subscribeTabs").selectedIndex = 1;

  // force it to talk to the server and get new groups
  SetUpTree(true, true);
}

function InvalidateSearchTreeRow(row)
{
    gSearchTreeBoxObject.invalidateRow(row);
}

function InvalidateSearchTree()
{
    gSearchTreeBoxObject.invalidate();
}

function SwitchToNormalView()
{
  // the first card in the deck is the "normal" view
  gSubscribeDeck.setAttribute("selectedIndex","0");
}

function SwitchToSearchView()
{
  // the second card in the deck is the "search" view
  gSubscribeDeck.setAttribute("selectedIndex","1");
}

function Search()
{
  var searchValue = gNameField.value;
  if (searchValue.length && gSubscribableServer.supportsSubscribeSearch) {
    SwitchToSearchView();
    gSubscribableServer.setSearchValue(searchValue);

    if (!gSearchView && gSubscribableServer) {
    gSearchView = gSubscribableServer.QueryInterface(Components.interfaces.nsITreeView);
      gSearchView.selection = null;
    gSearchTreeBoxObject.view = gSearchView;
  }
  }
  else {
    SwitchToNormalView();
  }
}

function CleanUpSearchView()
{
  if (gSearchView) {
    gSearchView.selection = null;
    gSearchView = null;
  }
}

function onSearchTreeKeyPress(event)
{
  // for now, only do something on space key
  if (event.charCode != KeyEvent.DOM_VK_SPACE)
    return;

  var treeSelection = gSearchView.selection; 
  for (var i=0;i<treeSelection.getRangeCount();i++) {
    var start = {}, end = {};
    treeSelection.getRangeAt(i,start,end);
    for (var k=start.value;k<=end.value;k++)
      ReverseStateFromRow(k);

    // force a repaint
    InvalidateSearchTree();
  }
}

function onSubscribeTreeKeyPress(event)
{
  // for now, only do something on space key
  if (event.charCode != KeyEvent.DOM_VK_SPACE)
    return;

  var treeSelection = gSubscribeTree.view.selection; 
  for (var i=0;i<treeSelection.getRangeCount();i++) {
    var start = {}, end = {};
    treeSelection.getRangeAt(i,start,end);
    for (var k=start.value;k<=end.value;k++)
      ReverseStateFromNode(k);
  }
}


function doHelpButton() 
{
  openHelp("mail-subscribe");
}
