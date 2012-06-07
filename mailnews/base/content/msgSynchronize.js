/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var gSynchronizeTree = null;
var gParentMsgWindow;
var gMsgWindow;

var gInitialFolderStates = {};

function OnLoad()
{
    if (window.arguments && window.arguments[0]) {
        if (window.arguments[0].msgWindow) {
            gParentMsgWindow = window.arguments[0].msgWindow;
        }
    }

    document.getElementById("syncMail").checked =
      Services.prefs.getBoolPref("mailnews.offline_sync_mail");
    document.getElementById("syncNews").checked =
      Services.prefs.getBoolPref("mailnews.offline_sync_news");
    document.getElementById("sendMessage").checked =
      Services.prefs.getBoolPref("mailnews.offline_sync_send_unsent");
    document.getElementById("workOffline").checked =
      Services.prefs.getBoolPref("mailnews.offline_sync_work_offline");

    return true;
}

function syncOkButton()
{

    var syncMail = document.getElementById("syncMail").checked;
    var syncNews = document.getElementById("syncNews").checked;
    var sendMessage = document.getElementById("sendMessage").checked;
    var workOffline = document.getElementById("workOffline").checked;

    Services.prefs.setBoolPref("mailnews.offline_sync_mail", syncMail);
    Services.prefs.setBoolPref("mailnews.offline_sync_news", syncNews);
    Services.prefs.setBoolPref("mailnews.offline_sync_send_unsent", sendMessage);
    Services.prefs.setBoolPref("mailnews.offline_sync_work_offline", workOffline);

    if (syncMail || syncNews || sendMessage || workOffline) {
        var offlineManager = Components.classes["@mozilla.org/messenger/offline-manager;1"]
                                       .getService(Components.interfaces.nsIMsgOfflineManager);
        if(offlineManager)
            offlineManager.synchronizeForOffline(syncNews, syncMail, sendMessage, workOffline, gParentMsgWindow)
    }

    return true;
}

function OnSelect()
{
   top.window.openDialog("chrome://messenger/content/msgSelectOffline.xul", "",
                         "centerscreen,chrome,modal,titlebar,resizable=yes");
   return true;
}

function selectOkButton()
{
    return true;
}

function selectCancelButton()
{
    var RDF = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                        .getService(Components.interfaces.nsIRDFService);
    for (var resourceValue in gInitialFolderStates) {
      var resource = RDF.GetResource(resourceValue);
      var folder = resource.QueryInterface(Components.interfaces.nsIMsgFolder);
      if (gInitialFolderStates[resourceValue])
        folder.setFlag(Components.interfaces.nsMsgFolderFlags.Offline);
      else
        folder.clearFlag(Components.interfaces.nsMsgFolderFlags.Offline);
    }
    return true;
}

function selectOnLoad()
{
    gMsgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
                           .createInstance(Components.interfaces.nsIMsgWindow);
    gMsgWindow.domWindow = window;
    gMsgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;

    gSynchronizeTree = document.getElementById('synchronizeTree');

    SortSynchronizePane('folderNameCol', '?folderTreeNameSort');
} 

function SortSynchronizePane(column, sortKey)
{
    var node = FindInWindow(window, column);
    if(!node) {
        dump('Couldnt find sort column\n');
        return;
    }

    node.setAttribute("sort", sortKey);
    node.setAttribute("sortDirection", "natural");
    var col = gSynchronizeTree.columns[column];
    gSynchronizeTree.view.cycleHeader(col);
}

function FindInWindow(currentWindow, id)
{
    var item = currentWindow.document.getElementById(id);
    if(item)
    return item;

    for(var i = 0; i < currentWindow.frames.length; i++) {
        var frameItem = FindInWindow(currentWindow.frames[i], id);
        if(frameItem)
            return frameItem;
    }

    return null;
}


function onSynchronizeClick(event)
{
    // we only care about button 0 (left click) events
    if (event.button != 0)
      return;

    var row = {}
    var col = {}
    var elt = {}

    gSynchronizeTree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
    if (row.value == -1)
      return;

    if (elt.value == "twisty") {
        var folderResource = GetFolderResource(gSynchronizeTree, row.value);
        var msgFolder = folderResource.QueryInterface(Components.interfaces.nsIMsgFolder);

        if (!(gSynchronizeTree.treeBoxObject.view.isContainerOpen(row.value))) {
            var serverType = msgFolder.server.type;
            // imap is the only server type that does folder discovery
            if (serverType != "imap") return;

            if (folder.isServer) {
                var server = msgFolder.server;
                server.performExpand(gMsgWindow);
            }
            else {
                var imapFolder = folderResource.QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
                if (imapFolder) {
                  imapFolder.performExpand(gMsgWindow);
                }
            }
        }
    }
    else {
      if (col.value.id == "syncCol") {   
        UpdateNode(GetFolderResource(gSynchronizeTree, row.value), row.value);
      }
    }
}

function onSynchronizeTreeKeyPress(event)
{
    // for now, only do something on space key
    if (event.charCode != KeyEvent.DOM_VK_SPACE)
      return;

    var treeSelection = gSynchronizeTree.view.selection; 
    for (var i=0;i<treeSelection.getRangeCount();i++) {
      var start = {}, end = {};
      treeSelection.getRangeAt(i,start,end);
      for (var k=start.value;k<=end.value;k++)
        UpdateNode(GetFolderResource(gSynchronizeTree, k), k);
    }
}

function UpdateNode(resource, row)
{
    var folder = resource.QueryInterface(Components.interfaces.nsIMsgFolder);

    if (folder.isServer)
      return;

    if (!(resource.Value in gInitialFolderStates)) {
      gInitialFolderStates[resource.Value] = folder.getFlag(Components.interfaces.nsMsgFolderFlags.Offline);
    }

    folder.toggleFlag(Components.interfaces.nsMsgFolderFlags.Offline);
}

function GetFolderResource(aTree, aIndex) {
  return aTree.builderView.getResourceAtIndex(aIndex);
}
