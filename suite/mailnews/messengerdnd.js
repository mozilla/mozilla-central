/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   disttsc@bart.nl
 *   jarrod.k.gray@rose-hulman.edu
 *   Jan Varga <varga@ku.sk>
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

// cache these services
var dragService = Components.classes["@mozilla.org/widget/dragservice;1"].getService().QueryInterface(Components.interfaces.nsIDragService);
var nsIDragService = Components.interfaces.nsIDragService;

function debugDump(msg)
{
  // uncomment for noise
  // dump(msg+"\n");
}

function CanDropOnFolderTree(index, orientation)
{
    var dragSession = null;
    var dragFolder = false;

    dragSession = dragService.getCurrentSession();
    if (! dragSession)
        return false;

    var flavorSupported = dragSession.isDataFlavorSupported("text/x-moz-message") || dragSession.isDataFlavorSupported("text/x-moz-folder");

    var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
    if (! trans)
        return false;

    trans.addDataFlavor("text/x-moz-message");
    trans.addDataFlavor("text/x-moz-folder");
    trans.addDataFlavor("text/x-moz-newsfolder");
    trans.addDataFlavor("application/x-moz-file");
    trans.addDataFlavor("text/x-moz-url");
 
    var folderTree = GetFolderTree();
    var targetFolder = GetFolderResource(folderTree, index).QueryInterface(Components.interfaces.nsIMsgFolder);
    var targetUri = targetFolder.URI;
    var targetServer = targetFolder.server;
    var sourceServer, sourceFolder;
   
    for (var i = 0; i < dragSession.numDropItems; i++)
    {
        dragSession.getData (trans, i);
        var dataObj = new Object();
        var dataFlavor = new Object();
        var len = new Object();
        try
        {
            trans.getAnyTransferData (dataFlavor, dataObj, len );
        }
        catch (ex)
        {
            continue;   //no data so continue;
        }

        if (dataFlavor.value == "application/x-moz-file" && dataObj)
        {
          if (orientation != Components.interfaces.nsITreeView.DROP_ON ||
              targetFolder.isServer ||
              !targetFolder.canFileMessages)
            return false;
          if (dataObj.value instanceof Components.interfaces.nsIFile)
            return dataObj.value.isFile();
          return false;
        }
        if (dataObj)
            dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
        if (! dataObj)
            continue;

        // pull the URL out of the data object
        var sourceUri = dataObj.data.substring(0, len.value);
        if (! sourceUri)
            continue;
        if (dataFlavor.value == "text/x-moz-message")
        {
            if (orientation != Components.interfaces.nsITreeView.DROP_ON)
              return false;

            if (targetFolder.isServer)
            {
                debugDump("***isServer == true\n");
                return false;
            }
            // canFileMessages checks no select, and acl, for imap.
            if (!targetFolder.canFileMessages)
            {
                debugDump("***canFileMessages == false\n");
                return false;
            }
            var hdr = messenger.msgHdrFromURI(sourceUri);
            if (hdr.folder == targetFolder)
                return false;
            break;
        } else if (dataFlavor.value == "text/x-moz-folder") {
          // we should only get here if we are dragging and dropping folders
          dragFolder = true;
          sourceFolder = GetMsgFolderFromUri(sourceUri);
          sourceServer = sourceFolder.server;

          if (orientation != Components.interfaces.nsITreeView.DROP_ON)
            return false;

          if (targetUri == sourceUri)	
              return false;

          //don't allow immediate child to be dropped to it's parent
          if (targetFolder.URI == sourceFolder.parent.URI)
          {
              debugDump(targetFolder.URI + "\n");
              debugDump(sourceFolder.parent.URI + "\n");     
              return false;
          }
          
          // don't allow dragging of virtual folders across accounts
          if ((sourceFolder.flags & Components.interfaces.nsMsgFolderFlags.Virtual) && sourceServer != targetServer)
            return false;

          var isAncestor = sourceFolder.isAncestorOf(targetFolder);
          // don't allow parent to be dropped on its ancestors
          if (isAncestor)
              return false;
        }
        else if (dataFlavor.value == "text/x-moz-newsfolder")
        {
          sourceFolder = GetMsgFolderFromUri(sourceUri);

          // don't allow dragging on to element
          if (orientation == Components.interfaces.nsITreeView.DROP_ON)
            return false;

          // don't allow dragging news folder (newsgroup) to other account
          if (targetFolder.rootFolder != sourceFolder.rootFolder)
            return false;

          // don't allow dragging news folder (newsgroup) to server folder
          if (targetFolder.isServer)
            return false;

          // don't allow dragging news folder (newsgroup) to before/after itself
          index += orientation;
          if (index < folderTree.view.rowCount) {	
            targetFolder = GetFolderResource(folderTree, index).QueryInterface(Components.interfaces.nsIMsgFolder);

            if (targetFolder == sourceFolder)	
              return false;
          }

          return true;
        }
        else if (dataFlavor.value == "text/x-moz-url")
        {
          // eventually check to make sure this is an http url before doing anything else...
          var uri = Components.classes["@mozilla.org/network/standard-url;1"].
                      createInstance(Components.interfaces.nsIURI);
          var url = sourceUri.split("\n")[0];
          uri.spec = url;

          if (orientation != Components.interfaces.nsITreeView.DROP_ON)
            return false;

          if ( (uri.schemeIs("http") || uri.schemeIs("https")) && targetServer && targetServer.type == 'rss')
            return true;
        }
    }

    if (dragFolder)
    {
        //first check these conditions then proceed further
        debugDump("***isFolderFlavor == true \n");

        // no copy for folder drag within a server
        if (dragSession.dragAction == nsIDragService.DRAGDROP_ACTION_COPY && sourceServer == targetServer)
            return false;

        // if cannot create subfolders then a folder cannot be dropped here     
        if (!targetFolder.canCreateSubfolders)
        {
            debugDump("***canCreateSubfolders == false \n");
            return false;
        }

        var serverType = targetFolder.server.type;

        // if we've got a folder that can't be renamed
        // allow us to drop it if we plan on dropping it on "Local Folders"
        // (but not within the same server, to prevent renaming folders on "Local Folders" that
        // should not be renamed)

        if (!sourceFolder.canRename) {
            if (sourceServer == targetServer)
                return false;
            if (serverType != "none")
                return false;
        }
    }

    //message or folder
    if (flavorSupported)
    {
        dragSession.canDrop = true;
        return true;
    }
	
    return false;
}

function DropOnFolderTree(row, orientation)
{
    var folderTree = GetFolderTree();
    var targetFolder = GetFolderResource(folderTree, row).QueryInterface(Components.interfaces.nsIMsgFolder);
    var targetServer = targetFolder.server;

    var targetUri = targetFolder.URI;
    debugDump("***targetUri = " + targetUri + "\n");

    var dragSession = dragService.getCurrentSession();
    if (! dragSession )
        return false;

    var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
    trans.addDataFlavor("text/x-moz-message");
    trans.addDataFlavor("text/x-moz-folder");
    trans.addDataFlavor("text/x-moz-newsfolder");
    trans.addDataFlavor("application/x-moz-file");
    trans.addDataFlavor("text/x-moz-url");

    var list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
    var cs = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
                       .getService(Components.interfaces.nsIMsgCopyService);

    var dropMessage;
    var sourceUri;
    var sourceFolder;
    var sourceServer;
	
    for (var i = 0; i < dragSession.numDropItems; i++)
    {
        dragSession.getData (trans, i);
        var dataObj = new Object();
        var flavor = new Object();
        var len = new Object();
        trans.getAnyTransferData(flavor, dataObj, len);
        
        // shortcircuit external files and get out
        if (flavor.value == "application/x-moz-file" && dataObj)
        {
          dataObj = dataObj.value.QueryInterface(Components.interfaces.nsIFile);
          if (!dataObj)
            return false; // don't know how this would ever happen
          if (dataObj.isFile())
          {
            let len = dataObj.leafName.length;
            if (len > 4 && dataObj.leafName.substr(len - 4).toLowerCase() == ".eml")
              cs.CopyFileMessage(dataObj, targetFolder, null, false, 1, "", null, msgWindow);
          }
          continue;
        }
        
        if (dataObj)
            dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
        if (! dataObj)
            continue;

        // pull the URL out of the data object
        sourceUri = dataObj.data.substring(0, len.value);
        if (! sourceUri)
            continue;

        debugDump("    Node #" + i + ": drop " + sourceUri + " to " + targetUri + "\n");
        
        // only do this for the first object, either they are all messages or they are all folders
        if (i == 0) 
        {
          if (flavor.value == "text/x-moz-folder") 
          {
            if (orientation != Components.interfaces.nsITreeView.DROP_ON)
              return false;

            sourceFolder = GetMsgFolderFromUri(sourceUri);
            dropMessage = false;  // we are dropping a folder
          }
          else if (flavor.value == "text/x-moz-newsfolder")
          {
            if (orientation == Components.interfaces.nsITreeView.DROP_ON)
              return false;

            sourceFolder = GetMsgFolderFromUri(sourceUri);
            dropMessage = false;  // we are dropping a news folder (newsgroup)
          }
          else if (flavor.value == "text/x-moz-message")
          {
            if (orientation != Components.interfaces.nsITreeView.DROP_ON)
              return false;

            dropMessage = true;
          }
          else if (flavor.value == "text/x-moz-url")
          {
            if (orientation != Components.interfaces.nsITreeView.DROP_ON)
              return false;

            var uri = Components.classes["@mozilla.org/network/standard-url;1"].
                        createInstance(Components.interfaces.nsIURI);
            var url = sourceUri.split("\n")[0];
            uri.spec = url;
            
            if ( (uri.schemeIs("http") || uri.schemeIs("https")) && targetServer && targetServer.type == 'rss')
            {
              var rssService = Components.classes["@mozilla.org/newsblog-feed-downloader;1"].getService().
                               QueryInterface(Components.interfaces.nsINewsBlogFeedDownloader);
              if (rssService)
                rssService.subscribeToFeed(url, targetFolder, msgWindow);
              return true;
            }
            else 
              return false;            
          }
        }
        else {
           if (!dropMessage)
             dump("drag and drop of multiple folders isn't supported\n");
        }

        if (dropMessage) {
            // from the message uri, get the appropriate messenger service
            // and then from that service, get the msgDbHdr
            list.appendElement(messenger.msgHdrFromURI(sourceUri), false);
        }
        else {
            // Prevent dropping of a node before, after, or on itself
            if (sourceFolder == targetFolder)	
                continue;

            list.appendElement(sourceFolder, false);
        }
    }

    if (list.length < 1)
       return false;

    var isSourceNews = false;
    isSourceNews = isNewsURI(sourceUri);

    if (dropMessage) {
        var sourceMsgHdr = list.queryElementAt(0, Components.interfaces.nsIMsgDBHdr);
        sourceFolder = sourceMsgHdr.folder;
        sourceServer = sourceFolder.server;


        try {
            if (isSourceNews) {
                // news to pop or imap is always a copy
                cs.CopyMessages(sourceFolder, list, targetFolder, false, null,
                                msgWindow, true);
            }
            else if (dragSession.dragAction == nsIDragService.DRAGDROP_ACTION_COPY ||
                     dragSession.dragAction == nsIDragService.DRAGDROP_ACTION_MOVE) {
                var isMove = (dragSession.dragAction == nsIDragService.DRAGDROP_ACTION_MOVE);
                pref.setCharPref("mail.last_msg_movecopy_target_uri", targetFolder.URI);
                pref.setBoolPref("mail.last_msg_movecopy_was_move", isMove);
                cs.CopyMessages(sourceFolder, list, targetFolder, isMove, null,
                                msgWindow, true); 
            }
        }
        catch (ex) {
            dump("failed to copy messages: " + ex + "\n");
        }
    }
    else
    {
      var folderTree = GetFolderTree();

      if (sourceFolder.server.type == "nntp")
      { // dragging a news folder (newsgroup)
        var newsFolder = targetFolder.rootFolder
                                     .QueryInterface(Components.interfaces.nsIMsgNewsFolder);
        newsFolder.moveFolder(sourceFolder, targetFolder, orientation);
        SelectFolder(sourceFolder.URI);
      }
      else
      { // dragging a normal folder
        sourceServer = sourceFolder.server;
        cs.CopyFolders(list, targetFolder, (sourceServer == targetServer), null,
                       msgWindow);
      }
    }
    return true;
}

function BeginDragFolderTree(event)
{
    debugDump("BeginDragFolderTree\n");

    if (event.originalTarget.localName != "treechildren")
      return false;

    var folderTree = GetFolderTree();
    var row = folderTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
    if (row == -1)
      return false;

    var folderResource = GetFolderResource(folderTree, row);
    var folder = folderResource.QueryInterface(Components.interfaces.nsIMsgFolder);

    if (folder.isServer)
    {
      debugDump("***IsServer == true\n");
      return false;
    }

    var flavor;
    if (folder.server.type == "nntp")
    { // news folder (newsgroup)
      flavor = "text/x-moz-newsfolder";
    }
    else
    { // normal folder
      flavor = "text/x-moz-folder";
    }

    var folderArray = [];
    var folderTree = GetFolderTree();
    var rangeCount = folderTree.view.selection.getRangeCount();

    for (var i = 0; i < rangeCount; i++)
    {
      var startIndex = {};
      var endIndex = {};
      folderTree.view.selection.getRangeAt(i, startIndex, endIndex);
      for (var j = startIndex.value; j <= endIndex.value; j++)
        folderArray.push(GetFolderResource(folderTree, j).Value);
    }

    return BeginDragTree(event, folderTree, folderArray, flavor);
}

function BeginDragThreadPane(event)
{
    debugDump("BeginDragThreadPane\n");

    var threadTree = GetThreadTree();
    var selectedMessages = GetSelectedMessages();
    if (!selectedMessages)
      return false;
 
    //A message can be dragged from one window and dropped on another window
    //therefore setNextMessageAfterDelete() here 
    //no major disadvantage even if it is a copy operation

    SetNextMessageAfterDelete();
    return BeginDragTree(event, threadTree, selectedMessages, "text/x-moz-message");
}

function BeginDragTree(event, tree, selArray, flavor)
{
    var dataTransfer = event.dataTransfer;
    var count = selArray.length;
    for (var i = 0; i < count; ++i)
      dataTransfer.mozSetDataAt(flavor, selArray[i], i);
    dataTransfer.effectAllowed = "copyMove";
    dataTransfer.addElement(event.originalTarget);

    return false;  // don't propagate the event if a drag has begun
}
