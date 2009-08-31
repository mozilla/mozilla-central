/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is SeaMonkey Tabmail code.
 *
 * The Initial Developer of the Original Code is
 *   Karsten Düsterloh <mnromyr@tprac.de>
 * based upon the tabmail work by
 *   David Bienvenu <bienvenu@nventure.com>.
 *   Scott MacGregor <mscott@mozilla.org>
 *   Andrew Sutherland <asutherland@asutherland.org>
 * and other code by various artists from all over the place in mailnews.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

// common pref object for all windows using tabmail
// alas, it's a legacy name without a 'g' prefix
var pref = null;

function GetPrefService()
{
  if (!pref)
    pref = Components.classes["@mozilla.org/preferences-service;1"]
                     .getService(Components.interfaces.nsIPrefBranch2);
  return pref;
}

// Traditionally, mailnews tabs come in two flavours: "folder" and
// "message" tabs. But these modes are just mere default settings on tab
// creation, defining layout, URI to load, etc.
// The user can turn a "message" tab into a "folder" tab just by unhiding
// the folder pane (F9) and hiding the message pane (F8), and vice versa.
// Tab title and icon will change accordingly.
// Both flavours are just instances of the basic "3pane" mode, triggered by
// a bitwise or combination of these possible pane values:
const kTabShowNoPane      = 0;
const kTabShowFolderPane  = 1 << 0;
const kTabShowMessagePane = 1 << 1;
const kTabShowThreadPane  = 1 << 2;
const kTabShowAcctCentral = 1 << 3;
// predefined mode masks
const kTabMaskDisplayDeck = kTabShowThreadPane | kTabShowAcctCentral;
// predefined traditional flavours
const kTabModeFolder      = kTabShowFolderPane | kTabShowThreadPane | kTabShowMessagePane;
const kTabModeMessage     = kTabShowMessagePane;  // message tab


// global mailnews tab definition object
var gMailNewsTabsType =
{
  name: "mailnews",
  panelId: "mailContent",

  modes:
  {
    "3pane":
    {
      isDefault: true,
      type: "3pane",

      // aTabInfo belongs to the newly created tab,
      // aModeBits is a combination of kTabShow* layout bits (or null),
      // aFolderURI designates the folder to select (or null)
      // aMsgHdr designates the message to select (or null)
      openTab: function(aTabInfo, aModeBits, aFolderURI, aMsgHdr)
      {
        // clone the current 3pane state before overriding parts of it
        this.saveTabState(aTabInfo);

        // aModeBits must have at least one bit set
        // if not, we just copy the current state
        let cloneMode = !aModeBits;
        if (cloneMode)
          aModeBits = this.getCurrentModeBits() || kTabModeFolder;
        aTabInfo.modeBits = aModeBits;
        // Currently, we only check for kTabModeMessage vs. kTabModeFolder,
        // but in theory we could distinguish in much more detail!
        let messageId = null;
        if (aModeBits == kTabModeMessage || cloneMode)
        {
          if (!aMsgHdr && gDBView)
          {
            try
            {
              // duplicate current message tab if nothing else is specified
              aMsgHdr = gDBView.hdrForFirstSelectedMessage;
              // Use the header's folder - this will open a msg in a virtual folder view
              // in its real folder, which is needed if the msg wouldn't be in a new
              // view with the same terms - e.g., it's read and the view is unread only.
              // If we cloned the view, we wouldn't have to do this.
              if (aTabInfo.switchToNewTab)
              {
                // Fix it so we won't try to load the previously loaded message.
                aMsgHdr.folder.lastMessageLoaded = nsMsgKey_None;
              }
              aFolderURI = aMsgHdr.folder.URI;
            }
            catch (ex) {}
          }
          if (aMsgHdr)
            messageId = aMsgHdr.messageId;
          aTabInfo.clearSplitter = true;
        }

        if (!messageId)
        {
          // only sanitize the URL, if possible
          let clearSplitter = aModeBits == kTabModeFolder;
          if (!aFolderURI)
          {
            // Use GetSelectedMsgFolders() to find out which folder to open
            // instead of GetLoadedMsgFolder().URI. This is required because on a
            // right-click, the currentIndex value will be different from the
            // actual row that is highlighted. GetSelectedMsgFolders() will
            // return the message that is highlighted.
            let msgFolder = GetSelectedMsgFolders()[0];
            aFolderURI = msgFolder.URI;
            // don't kill the splitter settings for account central
            clearSplitter &= !msgFolder.isServer;
          }
          aMsgHdr = null;
          aTabInfo.clearSplitter = clearSplitter;
        }
        aTabInfo.uriToOpen = aFolderURI;
        aTabInfo.hdr = aMsgHdr;
        aTabInfo.selectedMsgId = messageId;

        // call superclass logic
        this.openTab(aTabInfo);
      },

      // We can close all mailnews tabs - but one.
      // Closing the last mailnews tab would destroy our mailnews functionality.
      canCloseTab: function(aTabInfo)
      {
        return aTabInfo.mode.tabs.length > 1;
      }
    }
  },

  // combines the current pane visibility states into a mode bit mask
  getCurrentModeBits: function()
  {
    let modeBits = kTabShowNoPane;
    if (!IsFolderPaneCollapsed())
      modeBits |= kTabShowFolderPane;
    if (!IsDisplayDeckCollapsed())
    {
      // currently, the display deck has only two panes
      if (gAccountCentralLoaded)
        modeBits |= kTabShowAcctCentral;
      else
        modeBits |= kTabShowThreadPane;
    }
    if (!IsMessagePaneCollapsed())
      modeBits |= kTabShowMessagePane;
    return modeBits;
  },

  _updatePaneLayout: function(aTabInfo)
  {
    // first show all needed panes, then hide all unwanted ones
    // (we have to keep this order to avoid hiding all panes!)
    let showFolderPane  = aTabInfo.modeBits & kTabShowFolderPane;
    let showMessagePane = aTabInfo.modeBits & kTabShowMessagePane;
    let showDisplayDeck = aTabInfo.modeBits & (kTabShowThreadPane | kTabShowAcctCentral);
    if (showMessagePane && IsMessagePaneCollapsed())
      MsgToggleMessagePane(true); // show message pane
    if (showDisplayDeck && IsDisplayDeckCollapsed())
      MsgToggleThreadPane();      // show thread pane
    if (showFolderPane && IsFolderPaneCollapsed())
      MsgToggleFolderPane(true);  // show folder pane
    if (!showMessagePane && !IsMessagePaneCollapsed())
      MsgToggleMessagePane(true); // hide message pane
    if (!showDisplayDeck && !IsDisplayDeckCollapsed())
      MsgToggleThreadPane();      // hide thread pane
    if (!showFolderPane && !IsFolderPaneCollapsed())
      MsgToggleFolderPane(true);  // hide folder pane
    UpdateLayoutVisibility();
  },

  /**
   * Create the new tab's state, which engenders some side effects.
   * Part of our contract is that we leave the tab in the selected state.
   */
  openTab: function(aTabInfo)
  {
    // each tab gets its own messenger instance
    // for undo/redo, backwards/forwards, etc.
    messenger = Components.classes["@mozilla.org/messenger;1"]
                          .createInstance(Components.interfaces.nsIMessenger);
    messenger.setWindow(window, msgWindow);
    aTabInfo.messenger = messenger;

    // remember the currently selected folder
    aTabInfo.msgSelectedFolder = gMsgFolderSelected;

    // show tab if permitted
    if (aTabInfo.switchToNewTab)
      this.showTab(aTabInfo);
  },

  showTab: function(aTabInfo)
  {
    // don't allow saveTabState while restoring a tab
    aTabInfo.lock = true;
    // set the messagepane as the primary browser for content
    getMessageBrowser().setAttribute("type", "content-primary");

    if (aTabInfo.uriToOpen)
    {
      // Clear selection, because context clicking on a folder and opening in a
      // new tab needs to have SelectFolder think the selection has changed.
      // We also need to clear these globals to subvert the code that prevents
      // folder loads when things haven't changed.
      let folderTree = GetFolderTree();
      folderTree.view.selection.clearSelection();
      folderTree.view.selection.currentIndex = -1;
      gMsgFolderSelected = null;
      msgWindow.openFolder = null;

      // clear gDBView so we won't try to close it
      gDBView = null;

      // reroot the message sink (we might have switched layout)
      messenger.setWindow(null, null);
      messenger.setWindow(window, msgWindow);

      // Clear thread pane selection - otherwise, the tree tries to impose the
      // the current selection on the new view.
      let msgHdr = aTabInfo.hdr;
      let msgId  = aTabInfo.selectedMsgId;
      SelectFolder(aTabInfo.uriToOpen);
      let folderResource = RDF.GetResource(aTabInfo.uriToOpen);
      if (folderResource instanceof Components.interfaces.nsIMsgFolder)
        aTabInfo.msgSelectedFolder = folderResource;
      delete aTabInfo.uriToOpen; // destroy after use!
      // restore our message data
      aTabInfo.hdr = msgHdr;
      aTabInfo.selectedMsgId = msgId;

      aTabInfo.dbView = gDBView;
      UpdateMailToolbar("new tab");
    }

    // restore layout if present
    ShowThreadPane();
    // Some modes (e.g. new message tabs) need to initially hide the splitters,
    // this is marked by aTabInfo.clearSplitter=true.
    let clearSplitter = "clearSplitter" in aTabInfo && aTabInfo.clearSplitter;
    if (clearSplitter)
    {
      aTabInfo.messageSplitter.collapsible = true;
      aTabInfo.folderSplitter.collapsible  = true;
      delete aTabInfo.clearSplitter;
    }
    SetSplitterState(GetThreadAndMessagePaneSplitter(), aTabInfo.messageSplitter);
    SetSplitterState(GetFolderPaneSplitter(),           aTabInfo.folderSplitter);
    this._updatePaneLayout(aTabInfo);
    ClearMessagePane();
    // force header pane twisty state restoration by toggling from the opposite
    if (gCollapsedHeaderViewMode != aTabInfo.headerViewMode)
      ToggleHeaderView();

    // restore globals
    messenger = aTabInfo.messenger;
    gDBView = aTabInfo.dbView;
    gSearchSession = aTabInfo.searchSession;
    let folderToSelect = aTabInfo.msgSelectedFolder || gDBView && gDBView.msgFolder;

    // restore view state if we had one
    let folderTree = GetFolderTree();
    let row = EnsureFolderIndex(folderTree.builderView, folderToSelect);
    let treeBoxObj = folderTree.treeBoxObject;
    let folderTreeSelection = treeBoxObj.view.selection;

    // make sure that row.value is valid so that it doesn't mess up
    // the call to ensureRowIsVisible()
    if ((row >= 0) && !folderTreeSelection.isSelected(row))
    {
      gMsgFolderSelected = folderToSelect;
      msgWindow.openFolder = folderToSelect;
      folderTreeSelection.select(row);
      treeBoxObj.ensureRowIsVisible(row);
    }

    if (gDBView)
    {
      // This sets the thread pane tree's view to the gDBView view.
      UpdateSortIndicators(gDBView.sortType, gDBView.sortOrder);
      RerootThreadPane();

      // We don't want to reapply the mailview (threadpane changes by switching
      // tabs alone would be rather surprising), just update the viewpicker
      // and resave the new view.
      UpdateViewPickerByValue(aTabInfo.mailView);
      SetMailViewForFolder(folderToSelect, aTabInfo.mailView);

      // restore quick search
      GetSearchInput().value = aTabInfo.searchInput;

      // We need to restore the selection to what it was when we switched away
      // from this tab. We need to remember the selected keys, instead of the
      // selected indices, since the view might have changed. But maybe the
      // selectedIndices adjust as items are added/removed from the (hidden)
      // view.
      try
      {
        if (aTabInfo.selectedMsgId && aTabInfo.msgSelectedFolder)
        {
          // We clear the selection in order to generate an event when we
          // re-select our message. This destroys aTabInfo.selectedMsgId.
          let selectedMsgId = aTabInfo.selectedMsgId;
          ClearThreadPaneSelection();
          aTabInfo.selectedMsgId = selectedMsgId;
          let msgDB = aTabInfo.msgSelectedFolder.msgDatabase;
          let msgHdr = msgDB.getMsgHdrForMessageID(aTabInfo.selectedMsgId);
          setTimeout(gDBView.selectFolderMsgByKey,
                     0,
                     aTabInfo.msgSelectedFolder,
                     msgHdr.messageKey);
        }
        // We do not clear the selection if there was more than one message
        // displayed.  this leaves our selection intact. there was originally
        // some claim that the selection might lose synchronization with the
        // view, but this is unsubstantiated.  said comment came from the
        // original code that stored information on the selected rows, but
        // then failed to do anything with it, probably because there is no
        // existing API call that accomplishes it.
      }
      catch (ex)
      {
        dump(ex);
      }
      GetThreadTree().treeBoxObject.scrollToRow(aTabInfo.firstVisibleRow);
    }
    else if (gMsgFolderSelected.isServer)
    {
      // Load AccountCentral page here.
      ShowAccountCentral();
    }
    UpdateLocationBar(gMsgFolderSelected);
    UpdateMailToolbar("tab changed");
    delete aTabInfo.lock;
  },

  closeTab: function(aTabInfo)
  {
    if (aTabInfo.dbView)
      aTabInfo.dbView.close();
    if (aTabInfo.messenger)
      aTabInfo.messenger.setWindow(null, null);
  },

  // called when switching away from aTabInfo
  saveTabState: function(aTabInfo)
  {
    if (aTabInfo.lock)
      return;

    // save message db data and view filters
    aTabInfo.messenger = messenger;
    aTabInfo.dbView = gDBView;
    aTabInfo.searchSession = gSearchSession;
    aTabInfo.msgSelectedFolder = gMsgFolderSelected;
    aTabInfo.selectedMsgId = null;
    if (gDBView)
    {
      // save thread pane scroll position
      aTabInfo.firstVisibleRow = GetThreadTree().treeBoxObject.getFirstVisibleRow();

      let curMsgViewIndex = gDBView.currentlyDisplayedMessage;
      if (curMsgViewIndex != nsMsgViewIndex_None)
      {
        try // there may not be a selected message.
        {
          // the currentlyDisplayedMessage is not always the first selected
          // message, e.g. on a right click for the context menu
          let curMsgHdr = gDBView.getMsgHdrAt(curMsgViewIndex);
          aTabInfo.selectedMsgId = curMsgHdr.messageId;
        }
        catch (ex) {}
      }
      if (!aTabInfo.selectedMsgId)
        aTabInfo.msgSelectedFolder = gDBView.msgFolder;
    }
    aTabInfo.mailView = GetMailViewForFolder(aTabInfo.msgSelectedFolder);

    // remember layout
    aTabInfo.modeBits = this.getCurrentModeBits();
    aTabInfo.messageSplitter = GetSplitterState(GetThreadAndMessagePaneSplitter());
    aTabInfo.folderSplitter  = GetSplitterState(GetFolderPaneSplitter());

    // header pane twisty state
    aTabInfo.headerViewMode = gCollapsedHeaderViewMode;

    // quick search
    aTabInfo.searchInput = GetSearchInput().value;
  },

  onTitleChanged: function(aTabInfo, aTabNode)
  {
    // If we have an account, we also always have a "Local Folders" account,
    let accountCount = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                 .getService(Components.interfaces.nsIMsgAccountManager)
                                 .accounts.Count();
    let multipleRealAccounts = accountCount > 2;

    // clear out specific tab data now, because we might need to return early
    aTabNode.removeAttribute("SpecialFolder");
    aTabNode.removeAttribute("ServerType");
    aTabNode.removeAttribute("IsServer");
    aTabNode.removeAttribute("IsSecure");
    aTabNode.removeAttribute("NewMessages");
    aTabNode.removeAttribute("ImapShared");
    aTabNode.removeAttribute("BiffState");
    aTabNode.removeAttribute("MessageType");
    aTabNode.removeAttribute("Offline");
    aTabNode.removeAttribute("Attachment");
    aTabNode.removeAttribute("IMAPDeleted");

    // aTabInfo.msgSelectedFolder may contain the base folder of saved search
    let msgSelectedFolder = null;
    if (aTabInfo.uriToOpen)
    {
      // select folder for the backgound tab without changing the current one
      // (stolen from SelectFolder)
      let folderResource = RDF.GetResource(aTabInfo.uriToOpen);
      if (folderResource instanceof Components.interfaces.nsIMsgFolder)
        msgSelectedFolder = folderResource;
    }
    else
    {
      msgSelectedFolder = (aTabInfo.dbView && aTabInfo.dbView.viewFolder) ||
                          (aTabInfo.dbView && aTabInfo.dbView.msgFolder) ||
                          aTabInfo.msgSelectedFolder ||
                          gMsgFolderSelected;
    }

    // update the message header only if we're the current tab
    if (aTabNode.selected)
    {
      try
      {
        aTabInfo.hdr = aTabInfo.dbView && aTabInfo.dbView.hdrForFirstSelectedMessage;
      }
      catch (e)
      {
        aTabInfo.hdr = null;
      }
    }

    // update tab title and icon state
    aTabInfo.title = "";
    if (IsMessagePaneCollapsed() || !aTabInfo.hdr)
    {
      // Folder Tab
      aTabNode.setAttribute("type", "folder"); // override "3pane"
      if (!msgSelectedFolder)
      {
        // nothing to do
        return;
      }
      else
      {
        aTabInfo.title = msgSelectedFolder.prettyName;
        if (!msgSelectedFolder.isServer && multipleRealAccounts)
          aTabInfo.title += " - " + msgSelectedFolder.server.prettyName;
      }

      // The user may have changed folders, triggering our onTitleChanged callback.
      // Update the appropriate attributes on the tab.
      aTabNode.setAttribute("SpecialFolder", getSpecialFolderString(msgSelectedFolder));
      aTabNode.setAttribute("ServerType",    msgSelectedFolder.server.type);
      aTabNode.setAttribute("IsServer",      msgSelectedFolder.isServer);
      aTabNode.setAttribute("IsSecure",      msgSelectedFolder.server.isSecure);
      aTabNode.setAttribute("NewMessages",   msgSelectedFolder.hasNewMessages);
      aTabNode.setAttribute("ImapShared",    msgSelectedFolder.imapShared);

      let biffState = "UnknownMail";
      switch (msgSelectedFolder.biffState)
      {
        case Components.interfaces.nsIMsgFolder.nsMsgBiffState_NewMail:
          biffState = "NewMail";
          break;
        case Components.interfaces.nsIMsgFolder.nsMsgBiffState_NoMail:
          biffState = "NoMail";
          break;
      }
      aTabNode.setAttribute("BiffState", biffState);
    }
    else
    {
      // Message Tab
      aTabNode.setAttribute("type", "message"); // override "3pane"
      if (aTabInfo.hdr.flags & Components.interfaces.nsMsgMessageFlags.HasRe)
        aTabInfo.title = "Re: ";
      if (aTabInfo.hdr.mime2DecodedSubject)
        aTabInfo.title += aTabInfo.hdr.mime2DecodedSubject;
      aTabInfo.title += " - " + aTabInfo.hdr.folder.prettyName;
      if (multipleRealAccounts)
        aTabInfo.title += " - " + aTabInfo.hdr.folder.server.prettyName;

      // message specific tab data
      const nsMsgMessageFlags = Components.interfaces.nsMsgMessageFlags;
      let flags = aTabInfo.hdr.flags;
      aTabNode.setAttribute("MessageType", msgSelectedFolder.server.type);
      aTabNode.setAttribute("Offline",     Boolean(flags & nsMsgMessageFlags.Offline));
      aTabNode.setAttribute("Attachment",  Boolean(flags & nsMsgMessageFlags.Attachment));
      aTabNode.setAttribute("IMAPDeleted", Boolean(flags & nsMsgMessageFlags.IMAPDeleted));
    }
  },

  getBrowser: function(aTabInfo)
  {
    // we currently use the messagepane element for all 3pane tab types
    return getMessageBrowser();
  },

  //
  // nsIController implementation
  //
  // We ignore the aTabInfo parameter sent by tabmail when calling nsIController
  // stuff and just delegate the call to the DefaultController by using it as
  // our proto chain.
  // XXX remove the MessageWindowController stuff once we kill messageWindow.xul
  __proto__: "DefaultController" in window && window.DefaultController ||
             "MessageWindowController" in window && window.MessageWindowController
};



//
//  tabmail support methods
//

function GetTabMail()
{
  return document.getElementById("tabmail");
}

function MsgOpenNewTab(aType, aModeBits)
{
  // duplicate the current tab
  var tabmail = GetTabMail();
  if (tabmail)
    tabmail.openTab(aType, aModeBits);
}

function MsgOpenNewTabForFolder()
{
  // open current folder in full 3pane tab
  MsgOpenNewTab("3pane", kTabModeFolder);
}

function MsgOpenNewTabForMessage()
{
  // open current message in message tab
  MsgOpenNewTab("3pane", kTabModeMessage);
}

function MsgCloseCurrentTab()
{
  var tabmail = GetTabMail();
  if (tabmail.tabInfo.length > 1)
    tabmail.removeCurrentTab();
  else
    CloseMailWindow();
}

function AllowOpenTabOnMiddleClick()
{
  return GetPrefService().getBoolPref("browser.tabs.opentabfor.middleclick");
}

function AllowOpenTabOnDoubleClick()
{
  return GetPrefService().getBoolPref("browser.tabs.opentabfor.doubleclick");
}

//
// pane management
// (maybe we should cache these items in a global object?)
//

function GetFolderPane()
{
  return document.getElementById("folderPaneBox");
}

function GetThreadPane()
{
  return document.getElementById("threadPaneBox");
}

function GetDisplayDeck()
{
  return document.getElementById("displayDeck");
}

function GetMessagePane()
{
  return document.getElementById("messagepanebox");
}

function GetHeaderPane()
{
  return document.getElementById("msgHeaderView");
}

function GetFolderPaneSplitter()
{
  return document.getElementById("folderpane-splitter");
}

function GetThreadAndMessagePaneSplitter()
{
  return document.getElementById("threadpane-splitter");
}



//
// pane visibility management
//
// - collapsing the folderpane by clicking its splitter doesn't need
//   additional processing
// - collapsing the messagepane by clicking its splitter needs some special
//   treatment of attachments, gDBView, etc.
// - the threadpane has no splitter assigned to it
// - collapsing the messagepane, threadpane or folderpane by <key> needs to
//   pay attention to the other panes' (and splitters') visibility

function IsMessagePaneCollapsed()
{
  return GetMessagePane().collapsed;
}

function IsDisplayDeckCollapsed()
{
  // regard display deck as collapsed in the standalone message window
  var displayDeck = GetDisplayDeck();
  return !displayDeck || displayDeck.collapsed;
}

function IsFolderPaneCollapsed()
{
  // regard folderpane as collapsed in the standalone message window
  var folderPane = GetFolderPane();
  return !folderPane || folderPane.collapsed;
}

// Which state is the splitter in? Is it collapsed?
// How wide/high is the associated pane?
function GetSplitterState(aSplitter)
{
  var next = aSplitter.getAttribute("collapse") == "after";
  var pane = next ? aSplitter.nextSibling : aSplitter.previousSibling;
  var vertical = aSplitter.orient == "vertical";
  var rv =
  {
    state:     aSplitter.getAttribute("state"),
    collapsed: aSplitter.collapsed,
    // <splitter>s are <hbox>es,
    // thus the "orient" attribute is usually either unset or "vertical"
    size:      vertical ? pane.height : pane.width,
    collapsible: "collapsible" in aSplitter && aSplitter.collapsible
  };
  return rv;
}

function SetSplitterState(aSplitter, aState)
{
  // all settings in aState are optional
  if (!aState)
    return;
  if ("state" in aState)
    aSplitter.setAttribute("state", aState.state);
  if ("collapsed" in aState)
    aSplitter.collapsed = aState.collapsed;
  if ("size" in aState)
  {
    let next = aSplitter.getAttribute("collapse") == "after";
    let pane = next ? aSplitter.nextSibling : aSplitter.previousSibling;
    let vertical = aSplitter.orient == "vertical";
    if (vertical)
    {
      // vertical splitter orientation
      pane.height = aState.size;
    }
    else
    {
      // horizontal splitter orientation
      pane.width = aState.size;
    }
  }
  if ("collapsible" in aState)
    aSplitter.collapsible = aState.collapsible;
}

// If we hit one of the pane splitter <key>s or choose the respective menuitem,
// we show/hide both the pane *and* the splitter, just like we do for the
// browser sidebar. Clicking a splitter's grippy, though, will hide the pane
// but not the splitter.
function MsgToggleSplitter(aSplitter)
{
  var state = aSplitter.getAttribute("state");
  if (state == "collapsed")
  {
    // removing the attribute would hurt persistency
    aSplitter.setAttribute("state", "open");
    aSplitter.collapsed = false; // always show splitter when open
  }
  else
  {
    aSplitter.setAttribute("state", "collapsed");
    aSplitter.collapsed = true; // hide splitter
  }
}

function MsgCollapseSplitter(aSplitter, aCollapse)
{
  if (!("collapsible" in aSplitter))
    aSplitter.collapsible = true;
  aSplitter.collapsed = aCollapse && aSplitter.collapsible;
}

// helper function for UpdateLayoutVisibility
function UpdateFolderPaneFlex(aTuneLayout)
{
  var folderBox = GetFolderPane();
  var messagesBox = document.getElementById("messagesBox");
  if (aTuneLayout)
  {
    // tune folderpane layout
    folderBox.setAttribute("flex", "1");
    messagesBox.removeAttribute("flex");
  }
  else
  {
    // restore old layout
    folderBox.removeAttribute("flex");
    messagesBox.setAttribute("flex", "1");
  }
}

// we need to finetune the pane and splitter layout in certain circumstances
function UpdateLayoutVisibility()
{
  var modeBits = gMailNewsTabsType.getCurrentModeBits();
  var folderPaneVisible  = modeBits & kTabShowFolderPane;
  var messagePaneVisible = modeBits & kTabShowMessagePane;
  var threadPaneVisible  = modeBits & kTabShowThreadPane;
  var displayDeckVisible = modeBits & kTabMaskDisplayDeck;
  var onlyFolderPane     = modeBits == kTabShowFolderPane;
  var onlyMessagePane    = modeBits == kTabShowMessagePane;
  var onlyDisplayDeck    = modeBits == kTabShowThreadPane ||
                           modeBits == kTabShowAcctCentral;
  var onlyOnePane = onlyFolderPane || onlyMessagePane || onlyDisplayDeck;
  var showFolderSplitter  = false;
  var showMessageSplitter = false;
  var layout = pref.getIntPref("mail.pane_config.dynamic");
  switch (layout)
  {
    case kClassicMailLayout:
      // if only the folderpane is visible it has to flex,
      // while the messagesbox must not
      UpdateFolderPaneFlex(onlyFolderPane);
      if (!onlyOnePane)
      {
        showFolderSplitter  = folderPaneVisible;
        showMessageSplitter = threadPaneVisible && messagePaneVisible;
      }
      break;

    case kWideMailLayout:
      // if only the messagepane is visible, collapse the rest
      let messengerBox = document.getElementById("messengerBox");
      messengerBox.collapsed = onlyMessagePane;
      // a hidden displaydeck must not flex, while the folderpane has to
      if (!onlyMessagePane)
        UpdateFolderPaneFlex(!displayDeckVisible);
      if (!onlyOnePane)
      {
        showFolderSplitter  = folderPaneVisible && displayDeckVisible;
        showMessageSplitter = messagePaneVisible;
      }
      break;

    case kVerticalMailLayout:
      // if the threadpane is hidden, we need to hide its outer box as well
      let messagesBox = document.getElementById("messagesBox");
      messagesBox.collapsed = !displayDeckVisible;
      // if only the folderpane is visible, it needs to flex
      UpdateFolderPaneFlex(onlyFolderPane);
      if (!onlyOnePane)
      {
        showFolderSplitter  = folderPaneVisible;
        showMessageSplitter = messagePaneVisible;
      }
      break;
  }

  // set splitter visibility
  // if the pane was hidden by clicking the splitter grippy,
  // the splitter must not hide
  MsgCollapseSplitter(GetFolderPaneSplitter(),           !showFolderSplitter);
  MsgCollapseSplitter(GetThreadAndMessagePaneSplitter(), !showMessageSplitter);

  // disable location bar if only message pane is visible
  document.getElementById("locationFolders").disabled = onlyMessagePane;
  // disable mailviews and search if threadpane is invisble
  var viewPicker = document.getElementById("viewPicker");
  viewPicker.disabled = !threadPaneVisible;
  viewPicker.previousSibling.disabled = !threadPaneVisible;
  GetSearchInput().disabled = !threadPaneVisible;
}

function ChangeMessagePaneVisibility()
{
  var hidden = IsMessagePaneCollapsed();
  // We also have to disable the Message/Attachments menuitem.
  // It will be enabled when loading a message with attachments
  // (see messageHeaderSink.handleAttachment).
  if (hidden)
  {
    let node = document.getElementById("msgAttachmentMenu");
    if (node)
      node.setAttribute("disabled", "true");
  }

  if (gDBView)
  {
    // clear the subject, collapsing won't automatically do this
    setTitleFromFolder(GetThreadPaneFolder(), null);
    // the collapsed state is the state after we released the mouse
    // so we take it as it is
    gDBView.suppressMsgDisplay = hidden;
    // set the subject, uncollapsing won't automatically do this
    gDBView.loadMessageByUrl("about:blank");
    gDBView.selectionChanged();
  }
  var event = document.createEvent("Events");
  if (hidden)
    event.initEvent("messagepane-hide", false, true);
  else
    event.initEvent("messagepane-unhide", false, true);
  document.getElementById("messengerWindow").dispatchEvent(event);
}

function MsgToggleMessagePane(aToggleManually)
{
  // don't hide all three panes at once
  if (IsDisplayDeckCollapsed() && IsFolderPaneCollapsed())
    return;
  // toggle the splitter manually if it wasn't clicked and remember that
  var splitter = GetThreadAndMessagePaneSplitter();
  if (aToggleManually)
    MsgToggleSplitter(splitter);
  splitter.collapsible = aToggleManually;
  ChangeMessagePaneVisibility();
  UpdateLayoutVisibility();
}

function MsgToggleFolderPane(aToggleManually)
{
  // don't hide all three panes at once
  if (IsDisplayDeckCollapsed() && IsMessagePaneCollapsed())
    return;
  // toggle the splitter manually if it wasn't clicked and remember that
  var splitter = GetFolderPaneSplitter();
  if (aToggleManually)
    MsgToggleSplitter(splitter);
  splitter.collapsible = aToggleManually;
  UpdateLayoutVisibility();
}

function MsgToggleThreadPane()
{
  // don't hide all three panes at once
  if (IsFolderPaneCollapsed() && IsMessagePaneCollapsed())
    return;
  var threadPane = GetDisplayDeck();
  threadPane.collapsed = !threadPane.collapsed;
  // we only get here by hitting a key, so always hide border splitters
  UpdateLayoutVisibility();
}

// When the ThreadPane is hidden via the displayDeck, we should collapse the
// elements that are only meaningful to the thread pane. When AccountCentral is
// shown via the displayDeck, we need to switch the displayDeck to show the
// accountCentralBox and load the iframe in the AccountCentral box with the
// corresponding page.
function ShowAccountCentral()
{
  try
  {
    GetDisplayDeck().selectedPanel = accountCentralBox;
    let acctCentralPage = pref.getComplexValue("mailnews.account_central_page.url",
                                               Components.interfaces.nsIPrefLocalizedString).data;
    window.frames["accountCentralPane"].location.href = acctCentralPage;
  }
  catch (ex)
  {
    dump("Error loading AccountCentral page -> " + ex + "\n");
    return;
  }
}

function ShowingAccountCentral()
{
  if (!IsFolderPaneCollapsed())
    GetFolderTree().focus();
  gAccountCentralLoaded = true;
}

function HidingAccountCentral()
{
  gAccountCentralLoaded = false;
}

function ShowThreadPane()
{
  GetDisplayDeck().selectedPanel = GetThreadPane();
}

function ShowingThreadPane()
{
  gSearchBox.collapsed = false;
  var threadPaneSplitter = GetThreadAndMessagePaneSplitter();
  threadPaneSplitter.collapsed = false;
  if (!threadPaneSplitter.hidden && threadPaneSplitter.getAttribute("state") != "collapsed")
  {
    GetMessagePane().collapsed = false;
    // XXX We need to force the tree to refresh its new height
    // so that it will correctly scroll to the newest message
    GetThreadTree().boxObject.height;
  }
  document.getElementById("key_toggleThreadPane").removeAttribute("disabled");
  document.getElementById("key_toggleMessagePane").removeAttribute("disabled");
}

function HidingThreadPane()
{
  ClearThreadPane();
  GetUnreadCountElement().hidden = true;
  GetTotalCountElement().hidden = true;
  GetMessagePane().collapsed = true;
  GetThreadAndMessagePaneSplitter().collapsed = true;
  gSearchBox.collapsed = true;
  document.getElementById("key_toggleThreadPane").setAttribute("disabled", "true");
  document.getElementById("key_toggleMessagePane").setAttribute("disabled", "true");
}

var gCurrentDisplayDeckId = "";
function ObserveDisplayDeckChange(aEvent)
{
  var selectedPanel = GetDisplayDeck().selectedPanel;
  var nowSelected = selectedPanel ? selectedPanel.id : "";
  // onselect fires for every mouse click inside the deck, so ObserveDisplayDeckChange
  // is getting called every time we click on a message in the thread pane.
  // Only show/hide elements if the selected deck is actually changing.
  if (nowSelected != gCurrentDisplayDeckId)
  {
    if (nowSelected == "threadPaneBox")
      ShowingThreadPane();
    else
      HidingThreadPane();

    if (nowSelected == "accountCentralBox")
    {
      ShowingAccountCentral();
    }
    else
    {
      HidingAccountCentral();
    }
    gCurrentDisplayDeckId = nowSelected;
  }
}

function InvalidateTabDBs()
{
  // enforce reloading the tab's dbView
  var tabInfos = GetTabMail().tabInfo;
  for (let i = 0; i < tabInfos.length; ++i)
  {
    let tabInfo = tabInfos[i];
    // only reroot 3pane tabs
    if (tabInfo.mode.type == "3pane")
    {
      // don't change URI if already set -
      // we might try to read from an invalid msgSelectedFolder
      if (!("uriToOpen" in tabInfo))
        tabInfo.uriToOpen = tabInfo.msgSelectedFolder.URI;
    }
  }
}
