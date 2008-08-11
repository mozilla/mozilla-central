/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// because of the XPCOM creation stuff, we need to import our globals later...
var Gloda = null;
var GlodaUtils = null;

// flags are from MailNewsTypes.h
// -- status flags
const MSG_FLAG_READ      = 0x0001;
const MSG_FLAG_REPLIED   = 0x0002;
const MSG_FLAG_FORWARDED = 0x1000;
const MSG_FLAG_NEW       = 0x10000;
// -- general use flags
const MSG_FLAG_ATTACHMENT = 0x10000000;

const NO_SUCH_MESSAGE_KEY = 0xFFFFFFFF; // nsMsgKey_none
const NO_SUCH_VIEW_INDEX = -1;

function messageStatusString(aFlags) {
  if (aFlags & MSG_FLAG_REPLIED)
    return "replied"; // L10N-me
  if (aFlags & MSG_FLAG_FORWARDED)
    return "forwarded"; // L10N-me
  if (aFlags & MSG_FLAG_NEW)
    return "new"; // L10N-me
  if (aFlags & MSG_FLAG_READ)
    return "read"; // L10N-me
}

function messagePriorityString(aPriority) { // L10n-me, XXX ugly
  switch (aPriority) {
    case Ci.nsMsgPriority.normal:
      return "normal";
    case Ci.nsMsgPriority.notSet:
      return "not set";
    case Ci.nsMsgPriority.lowest:
      return "lowest";
    case Ci.nsMsgPriority.low:
      return "low";
    case Ci.nsMsgPriority.high:
      return "high";
    case Ci.nsMsgPriority.highest:
      return "highest";
    default:
      return "illegal";
  }
}

const SORT_NONE = Ci.nsMsgViewSortOrder.none;
const SORT_ASCENDING = Ci.nsMsgViewSortOrder.ascending;
const SORT_DESCENDING = Ci.nsMsgViewSortOrder.descending;

function GMTreeNode(aMessage) {
  this.message = aMessage;
  this.parent = null;
  this.children = null;
  this.open = false;
  this.level = 0;
}

GMTreeNode.prototype = {
  setLevel: function(aLevel) {
    this.level = aLevel;
    for (let iChild=0; iChild < this.children; iChild++) {
      this.children[iChild].setLevel(aLevel+1);
    }
  },
  
  get nodesInSubTree() {
    let numNodes = 1;
    if (this.children) {
      for (let iChild=0; iChild < this.children.length; iChild++)
        numNodes += this.children[iChild].nodesInSubTree;
    }
    return numNodes;
  },
  
  // this pierces the message representation, which is unusual, but ok.
  get unreadInSubTree() {
    let numUnread = this.message.folderMessage.isRead ? 0 : 1;
    if (this.children) {
      for (let iChild=0; iChild < this.children.length; iChild++)
        numUnread += this.children[iChild].unreadInSubTree;
    }
    return numUnread;
  },
};

function GlodaMsgDBView() {
dump("GlodaMsgDBView constructor entry\n");
  this._messenger = null;
  this._msgWindow = null;
  this._commandUpdater = null;

  this._sortType = Ci.nsMsgViewSortType.byDate;
  this._sortOrder = SORT_DESCENDING;
  this._viewFlags = Ci.nsMsgViewFlagsType.kNone;
  
  this._messages = [];
  this._toplevelNodes = [];
  this._rows = [];
  
  this._customColumns = {};
  this._customSortColumn = null;
  
  this._treeSelection = null;
  this._selectedNodes = null;
  this._selectedIndices = null;
  
  //: the currently displayed message's node
  this._displayedNode = null;
  
  // set up our awesome globals!
  if (Gloda === null) {
dump("GlodaMsgDBView loading globals\n");
    let loadNS = {};
    Cu.import("resource://gloda/modules/gloda.js", loadNS);
    Gloda = loadNS.Gloda;
    Cu.import("resource://gloda/modules/utils.js", loadNS);
    GlodaUtils = loadNS.GlodaUtils;
dump("GlodaMsgDBView globals loaded (Gloda: " + Gloda + ", GlodaUtils:" + 
     GlodaUtils + "\n");
  }
  
dump("GlodaMsgDBView comparison func inits\n");
  try {
    this._initComparisonFuncs();
  }
  catch (ex) {
    dump("Exception (source: " + ex.fileName + ":" + ex.lineNumber + ") " +
         ex + "\n");
  }
dump("GlodaMsgDBView constructor completion\n");
}

GlodaMsgDBView.prototype = {
  classDescription: "Gloda Message View",
  classID: Components.ID("{b7979f43-0188-445a-92e0-492350047254}"),
  contractID: "@mozilla.org/messenger/msgdbview;1?type=gloda",
  
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgDBView,
                                         Ci.nsITreeView]),

  get _isThreaded() {
    return this._viewFlags & Ci.nsMsgViewFlagsType.kThreadedDisplay;
  },
  
  get _isGroupBySort() {
    return this._viewFlags & Ci.nsMsgViewFlagsType.kGroupBySort;
  },
  
  /**
   * Return the list of currently selected GMTreeNodes.  Special-casing handles
   *  the "stand alone mode" where we lack a _treeSelection.
   */
  get selectedNodes() {
    if (this._selectedNodes === null) {
      if (this._treeSelection !== null) {
        let selNodes;
        this._selectedNodes = selNodes = [];
        
        let rangeCount = this._treeSelection.getRangeCount();
        let rangeMinObj = {}, rangeMaxObj = {};
        for (let iRange=0; iRange < rangeCount; iRange++) {
          this._treeSelection.getRangeAt(iRange, rangeMinObj, rangeMaxObj);
          selNodes.push.apply(selNodes, this._rows.slice(rangeMinObj.value,
                                                         rangeMaxObj.value+1));
        }
      }
      else if (this._displayedNode) { // stand-alone mode
        this._selectedNodes = [this._displayedNode];
      }
      else
        this._selectedNodes = [];
    }
    return this._selectedNodes;
  },
  
  get selectedIndices() {
    if (this._selectedIndices === null) {
      if (this._treeSelection !== null) {
        let selIndices;
        this._selectedIndices = selIndices = [];
        
        let rangeCount = this._treeSelection.getRangeCount();
        let rangeMinObj = {}, rangeMaxObj = {};
        for (let iRange=0; iRange < rangeCount; iRange++) {
          this._treeSelection.getRangeAt(iRange, rangeMinObj, rangeMaxObj);
          let rangeMax = rangeMaxObj.value;
          for (let i=rangeMinObj.value; i < rangeMaxObj.value; i++)
            selIndices.push(i);
        }
      }
      else if (this._displayedNode) { // stand-alone mode
        this._selectedIndices = [this._rows.indexOf(this._displayedNode)];
      }
      else
        this._selectedIndices = [];
    }
    return this._selectedIndices;
  },

  _comparisonFuncs: null,
  _initComparisonFuncs: function() {
    if (this._comparisonFuncs !== null)
      return;
    this.__proto__._comparisonFuncs = {};
    
    // Ci.nsMsgViewSortType.byNone means do nothing!
    this._comparisonFuncs[Ci.nsMsgViewSortType.byDate] = function(a, b) {
      return a.message.date - b.message.date;
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.bySubject] = function(a, b) {
      return a.message.conversation.subject.localeCompare(
        b.message.conversation.subject);
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byAuthor] = function(a, b) {
      return a.message.from.contact.name.localeCompare(
        b.message.from.contact.name);
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byId] = function(a, b) {
      return a.message.headerMessageId.localeCompare(
        b.message.headerMessageId);
    };
    // Ci.nsMsgViewSortType.byThread is special (and apparently a nop)
    this._comparisonFuncs[Ci.nsMsgViewSortType.byPriority] = function(a, b) {
      // XXX this might be backwards
      return a.message.folderMessage.priority -
        b.message.folderMessage.priority;
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byStatus] = function(a, b) {
      let aStatus = messageStatusString(a.message.folderMessage.flags);
      let bStatus = messageStatusString(b.message.folderMessage.flags);
      return aStatus.localeCompare(bStatus);
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.bySize] = function(a, b) {
      // XXX line usage predication
      return a.message.folderMessage.messageSize -
        b.message.folderMessage.messageSize;
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byFlagged] = function(a, b) {
      // XXX this might be backwards... starred as earlier for now
      // TODO: when starred status is tracked immediately, use our message rep.
      let aFlagged = a.message.folderMessage.isFlagged ? 1 : 0;
      let bFlagged = b.message.folderMessage.isFlagged ? 1 : 0;
      return bFlagged - aFlagged;
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byUnread] = function(a, b) {
      // XXX this might be backwards... unread as earlier for now
      // TODO: when unread status is tracked immediately, use our message rep.
      let aUnread = a.message.folderMessage.isRead ? 0 : 1;
      let bUnread = b.message.folderMessage.isRead ? 0 : 1;
      return bUnread - aUnread;
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byRecipient] = function(a, b) {
      let aRecip = a.message.folderMessage.recipients;
      let bRecip = b.message.folderMessage.recipients;
      return aRecip.localeCompare(bRecip); 
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byLocation] = function(a, b) {
      return a.message.folderURI.localeCompare(b.message.folderURI);
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byTags] = function(a, b) {
      let aKeywords = a.message.folderMessage.getStringProperty("keywords");
      let bKeywords = b.message.folderMessage.getStringProperty("keywords");
      return aKeywords.localeCompare(bKeywords);
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byJunkStatus] = function(a, b) {
      // XXX backwards?
      let aScore = a.message.folderMessage.getStringProperty("junkscore");
      let bScore = b.message.folderMessage.getStringProperty("junkscore");
      let aNum = aScore ? parseInt(aScore) : 0;
      let bNum = bScore ? parseInt(bScore) : 0;
      return aNum - bNum;
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byAttachments] = function(a, b) {
      // XXX backwards?
      let aAttach = a.message.folderMessage.flags&MSG_FLAG_ATTACHMENT ? 1 : 0;
      let bAttach = b.message.folderMessage.flags&MSG_FLAG_ATTACHMENT ? 1 : 0;
      return aAttach - bAttach;
    };
    this._comparisonFuncs[Ci.nsMsgViewSortType.byAccount] = function(a, b) {
      // XXX should use more gloda-centric account conceptualization
      return a.message.folderMessage.accountKey.localeCompare(
        b.message.folderMessage.accountKey);
    };
    // Ci.nsMsgViewSortType.byCustom is handled specially
    this._comparisonFuncs[Ci.nsMsgViewSortType.byReceived] = function(a, b) {
      let aRec = a.message.folderMessage.getUint32Property("dateReceived");
      let bRec = b.message.folderMessage.getUint32Property("dateReceived");
      return aRec - bRec;
    };
  },
  _sort: function gloda_mdbv_realSort() {
    // TODO: kShowIgnored
    // TODO: kUnreadOnly
    // TODO: kExpandAll
    let allExpanded = false;
    
    let nodes;
  
    if (this._isThreaded) {
      nodes = [];
      // cluster by conversation
      let conversations = {};
      
      for (let iMsg=0; iMsg < this._messages.length; iMsg++) {
        let message = this._messages[iMsg];
        if (!(message.conversationID in conversations))
          conversations[message.conversationID] = [message];
        else
          conversations[message.conversationID].push(message);
      }
      
      // build hierarchy within each conversation
      for (let [convID, convMsgs] in Iterator(conversations)) {
        // fast-track conversations with only one messages
        if (convMsgs.length == 1) {
          nodes.push(new GMTreeNode(convMsgs[0]));
          continue;
        }
      
        // we basically thread from nothing; we pull up the message headers
        //  and do the full references hashmap stuff.  other alternative are:
        // 1) go back to maintaining parentId for each message and pull up all
        //    the messages in the conversation.  (although the conversation may
        //    not have every actual message that ever happened in the thread,
        //    the parentIds will form a proper tree structure.)
        // 2) somehow encode the path to a message in the tree hierarchy in our
        //    message representation.
        // we do it the way we do it because the cost is proportional to the
        //  number of messages being displayed, plus we might have to hit the
        //  backing header later on anyways.
        let messageIdMap = {};

        // so, map everyone by their message-id, wrapping them in tree nodes as
        //  we go.  we didn't do this in the conversation-binning pass because
        //  we don't need the mapping object's lifetimes so large.  (perhaps
        //  silly?  worst case is an extra N objects for N messages.)
        for (let iMsg=0; iMsg < convMsgs.length; iMsg++) {
          let message = this._messages[iMsg];
          messageIdMap[message.headerMessageID] = new GMTreeNode(message);
        }
        // now find their closest parent...
        for each (let treeNode in messageIdMap) {
          let msgHdr = treeNode.message.folderMessage;
           
          // references are ordered from old (0) to new (n-1), so walk backwards
          for (let iRef=msgHdr.numReferences-1; iRef >= 0; iRef--) {
            let ref = msgHdr.getStringReference(iRef);
            if (ref in messageIdMap) {
              // link them to their parent
              let parentNode = messageIdMap[ref];
              if (parentNode.children === null)
                parentNode.children = [treeNode.message];
              else
                parentNode.children.push(treeNode.message);
              treeNode.parent = parentNode;
              break; 
            }
          }
          
          if (treeNode.parent === null)
            nodes.push(treeNode);
        }
      } // (done building hierarchy)
    } // (done dealing with threading)
    else {
      nodes = [new GMTreeNode(msg) for each (msg in this._messages)];
    }
    
    // SORT!
    switch (this._sortType) {
      case Ci.nsMsgViewSortType.byNone:
        // nothing to do!
      case Ci.nsMsgViewSortType.byThread:
        // also nothing to do!
        break;
      case Ci.nsMsgViewSortType.byCustom:
        if (this._customSortColumn) {
          let sortColumn = this._customSortColumn;
          if (this._customSortColumn.IsString)
            nodes.sort(function (a, b) {
              let aStr = sortColumn.getSortStringForRow(
                a.message.folderMessage) || "";
              let bStr = sortColumn.getSortStringForRow(
                b.message.folderMessage) || "";
              return aStr.localeCompare(bStr)
            });
          else
            nodes.sort(function (a, b) {
              return sortColumn.getSortLongForRow(a.message.folderMessage) -
                     sortColumn.getSortLongForRow(b.message.folderMessage);
            });
        }
        break;
      default:
        nodes.sort(this._comparisonFuncs[this._sortType]);
        break;
    }
    // XXX backwards-consistency etc etc.
    // FIXME: secondary sort
    if (this._sortOrder == SORT_DESCENDING)
      nodes.reverse();
    
    if (this._isGroupBySort) {
      let comparator = this._comparisonFuncs[this._sortType];
      let groupedNodes = [];
    
      let groupNode = null, groupExampleNode = null;
      for (let iNode=0; iNode < nodes.length; iNode++) {
        let curNode = nodes[iNode];
        
        if ((groupNode === null) || comparator(groupExampleNode, curNode)) {
          // TODO: make the group node not just a duplicate of the message!
          groupNode = new GMTreeNode(curNode.message);
          groupExampleNode = curNode;
          
          curNode.parent = groupNode;
          groupNode.children = [curNode];
          
          groupedNodes.push(groupNode);
        }
        else {
          curNode.parent = groupNode;
          groupNode.children.push(curNode);
        }
      }
      
      nodes = groupedNodes;
    }
    
    if (this._rows && this._treeBox) {
      this._treeBox.rowCountChanged(0, -this._rows.length);
    }
    
    this._toplevelNodes = nodes;
    for (let iNode=0; iNode < nodes.length; iNode++)
      nodes[iNode].setLevel(0);
    this._rows = nodes.concat();
    
    if (this._treeBox) {
      this._treeBox.rowCountChanged(0, this._rows.length); 
    }
  },

  /* ========== nsIMsgDBView ========== */

  init: function gloda_mdbv_init(aMessengerInstance, aMsgWindow,
                                 aCommandUpdater) {
    this._messenger = aMessengerInstance;
    this._msgWindow = aMsgWindow;
    this._commandUpdater = aCommandUpdater;
  },
  
  open: function gloda_mdbv_open(aFolder, aSortType, aSortOrder, aViewFlags,
                                 aOutCount) {
    this._sortType = aSortType;
    this._sortOrder = aSortOrder;
    this._viewFlags = aViewFlags;
    
    let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
    query.folderURI(aFolder.URI);
    this._messages = query.getAllSync();
    this._sort();
  },
  openWithHdrs: function gloda_mdbv_openWithHdrs(aHeaders, aSortType,
                                                 aSortOrder, aViewFlags,
                                                 aOutCount) {
    this._sortType = aSortType;
    this._sortOrder = aSortOrder;
    this._viewFlags = aViewFlags;
    
    this._messages = [Gloda.getMessageForHeader(hdr) for each
                      (hdr in aHeaders)];
    this._sort();
    
    aOutCount.value = this._messages.length;
  },

  cloneDBView: function gloda_mdbv_cloneDBView(aMessengerInstance,
                                               aMsgWindow, aCommandUpdater) {
    let newView = new GlodaMsgDBView();
    newView._messenger = aMessengerInstance;
    newView._msgWindow = aMsgWindow;
    newView._commandUpdater = aCommandUpdater;
    
    newView._sortType  = this._sortType;
    newView._sortOrder = this._sortOrder;
    newView._viewFlags = this._viewFlags;
    newView._messages  = this._messages; // XXX may need to clone someday soon
    newView._sort();
    
    return newView;
  },

  close: function gloda_mdbv_close() {
    this._messenger = null;
    this._msgWindow = null;
    this._commandUpdater = null;
    this._messages = null;
    this._toplevelNodes = null;
    this._rows = null;
    this._customColumns = null;
    this._customSortColumn = null;
    this._treeSelection = null;
    this._selectedNodes = null;
    this._selectedIndices = null;
  },

  sort: function gloda_mdbv_sort(aSortType, aSortOrder) {
    this._sortType = aSortType;
    this._sortOrder = aSortOrder;
    
    this._sort();
  },
  
  doCommand: function gloda_mdbv_doCommand(aCommand) {
    switch (aCommand) { // no 5
      // -- selection related (15,18,19)
      case Ci.nsMsgViewCommandType.selectAll:
      case Ci.nsMsgViewCommandType.selectThread:
      case Ci.nsMsgViewCommandType.selectFlagged:
      // -- re-dispatch (0-4,7-9,27-29)
      case Ci.nsMsgViewCommandType.markMessagesRead:
      case Ci.nsMsgViewCommandType.markMessagesUnread:
      case Ci.nsMsgViewCommandType.toggleMessageRead:
      case Ci.nsMsgViewCommandType.flagMessages:
      case Ci.nsMsgViewCommandType.unflagMessages:
      case Ci.nsMsgViewCommandType.deleteMsg:
      case Ci.nsMsgViewCommandType.deleteNoTrash:
      case Ci.nsMsgViewCommandType.markThreadRead:
      case Ci.nsMsgViewCommandType.junk:
      case Ci.nsMsgViewCommandType.unjunk:
      case Ci.nsMsgViewCommandType.undeleteMsg:
      
      case Ci.nsMsgViewCommandType.toggleThreadWatched:
      case Ci.nsMsgViewCommandType.expandAll:
      case Ci.nsMsgViewCommandType.collapseAll:
      
      case Ci.nsMsgViewCommandType.copyMessages:
      case Ci.nsMsgViewCommandType.moveMessages:
      case Ci.nsMsgViewCommandType.downloadSelectedForOffline:
      case Ci.nsMsgViewCommandType.downloadFlaggedForOffline:
      
      case Ci.nsMsgViewCommandType.cmdRequiringMsgBody:
      
      case Ci.nsMsgViewCommandType.label0:
      case Ci.nsMsgViewCommandType.label1:
      case Ci.nsMsgViewCommandType.label2:
      case Ci.nsMsgViewCommandType.label3:
      case Ci.nsMsgViewCommandType.label4:
      case Ci.nsMsgViewCommandType.label5:
      
      case Ci.nsMsgViewCommandType.applyFilters:
      case Ci.nsMsgViewCommandType.runJunkControls:
      case Ci.nsMsgViewCommandType.deleteJunk:
    }
  },
  doCommandWithFolder: function gloda_mdbv_doCommandWithFolder(aCommand,
                                                               aFolder) {
    // only copyMessages and moveMessages can do stuff here...\
    switch (aCommand) { // no 5
      case Ci.nsMsgViewCommandType.copyMessages:
      case Ci.nsMsgViewCommandType.moveMessages:
      // error!
      default:
    }
  },
  getCommandStatus: function gloda_mdbv_getCommandStatus(
      aCommand, aOutIsSelectable, aOutIsSelected) {
    switch (aCommand) { // no 5
      // -- selection related (15,18,19)
      case Ci.nsMsgViewCommandType.selectAll:
      case Ci.nsMsgViewCommandType.selectThread:
      case Ci.nsMsgViewCommandType.selectFlagged:
      // -- re-dispatch (0-4,7-9,27-29)
      case Ci.nsMsgViewCommandType.markMessagesRead:
      case Ci.nsMsgViewCommandType.markMessagesUnread:
      case Ci.nsMsgViewCommandType.toggleMessageRead:
      case Ci.nsMsgViewCommandType.flagMessages:
      case Ci.nsMsgViewCommandType.unflagMessages:
      case Ci.nsMsgViewCommandType.deleteMsg:
      case Ci.nsMsgViewCommandType.deleteNoTrash:
      case Ci.nsMsgViewCommandType.markThreadRead:
      case Ci.nsMsgViewCommandType.junk:
      case Ci.nsMsgViewCommandType.unjunk:
      case Ci.nsMsgViewCommandType.undeleteMsg:
      
      case Ci.nsMsgViewCommandType.toggleThreadWatched:
      case Ci.nsMsgViewCommandType.expandAll:
      case Ci.nsMsgViewCommandType.collapseAll:
      
      case Ci.nsMsgViewCommandType.copyMessages:
      case Ci.nsMsgViewCommandType.moveMessages:
      case Ci.nsMsgViewCommandType.downloadSelectedForOffline:
      case Ci.nsMsgViewCommandType.downloadFlaggedForOffline:
      
      case Ci.nsMsgViewCommandType.cmdRequiringMsgBody:
      
      case Ci.nsMsgViewCommandType.label0:
      case Ci.nsMsgViewCommandType.label1:
      case Ci.nsMsgViewCommandType.label2:
      case Ci.nsMsgViewCommandType.label3:
      case Ci.nsMsgViewCommandType.label4:
      case Ci.nsMsgViewCommandType.label5:
      
      case Ci.nsMsgViewCommandType.applyFilters:
      case Ci.nsMsgViewCommandType.runJunkControls:
      case Ci.nsMsgViewCommandType.deleteJunk:
        return true;
    }
  },
  
  get viewType() {
    // XXX TODO: do something about the viewtype enumeration issue
    return 0;
  },
  
  get viewFlags() {
    return this._viewFlags;
  },
  set viewFlags(aViewFlags) {
    this._viewFlags = aViewFlags;
  },
  
  get sortType() {
    return this._sortType;
  },
  set sortType(aSortType) {
    this._sortType = aSortType;
    this._sort();
  },
  
  get sortOrder() {
    return this._sortOrder;
  },
  
  get keyForFirstSelectedMessage() {
    let selNodes = this.selectedNodes;
    if (selNodes.length)
      return selNodes[0].message.id;
    else
      return NO_SUCH_MESSAGE_KEY;
  },
  
  get viewIndexForFirstSelectedMsg() {
    let selIndices = this.selectedIndices;
    return selIndices.length ? selIndices[0] : NO_SUCH_VIEW_INDEX;
  },
  
  viewNavigate: function gloda_mdbv_viewNavigate(aMotion, aOutResultId,
                                                 aOutResultIndex,
                                                 aOutThreadIndex, aWrap) {
    switch (aMotion) {
      case Ci.nsMsgNavigationType.firstMessage:
      case Ci.nsMsgNavigationType.nextMessage:
      case Ci.nsMsgNavigationType.previousMessage:
      case Ci.nsMsgNavigationType.lastMessage:
      case Ci.nsMsgNavigationType.toggleThreadKilled:
      case Ci.nsMsgNavigationType.firstUnreadMessage:
      case Ci.nsMsgNavigationType.nextUnreadMessage:
      case Ci.nsMsgNavigationType.previousUnreadMessage:
      case Ci.nsMsgNavigationType.lastUnreadMessage:
      case Ci.nsMsgNavigationType.nextUnreadThread:
      case Ci.nsMsgNavigationType.nextUnreadFolder:
      case Ci.nsMsgNavigationType.nextFolder:
      case Ci.nsMsgNavigationType.readMore:
      case Ci.nsMsgNavigationType.back:
      case Ci.nsMsgNavigationType.forward:
      case Ci.nsMsgNavigationType.firstFlagged:
      case Ci.nsMsgNavigationType.nextFlagged:
      case Ci.nsMsgNavigationType.previousFlagged:
      case Ci.nsMsgNavigationType.firstNew:
      case Ci.nsMsgNavigationType.editUndo:
      case Ci.nsMsgNavigationType.editRedo:
      case Ci.nsMsgNavigationType.toggleSubthreadKilled:
    }
  },
  
  navigateStatus: function gloda_mdbv_navigateStatus(aMotion) {
    switch (aMotion) {
      case Ci.nsMsgNavigationType.firstMessage:
      case Ci.nsMsgNavigationType.lastMessage:
        return this._rows.length != 0;
      case Ci.nsMsgNavigationType.nextMessage:

      case Ci.nsMsgNavigationType.previousMessage:
      case Ci.nsMsgNavigationType.toggleThreadKilled:
      case Ci.nsMsgNavigationType.firstUnreadMessage:
      case Ci.nsMsgNavigationType.nextUnreadMessage:
      case Ci.nsMsgNavigationType.previousUnreadMessage:
      case Ci.nsMsgNavigationType.lastUnreadMessage:
      case Ci.nsMsgNavigationType.nextUnreadThread:
      case Ci.nsMsgNavigationType.nextUnreadFolder:
      case Ci.nsMsgNavigationType.nextFolder:
      case Ci.nsMsgNavigationType.readMore:
      case Ci.nsMsgNavigationType.back:
      case Ci.nsMsgNavigationType.forward:
      case Ci.nsMsgNavigationType.firstFlagged:
      case Ci.nsMsgNavigationType.nextFlagged:
      case Ci.nsMsgNavigationType.previousFlagged:
      case Ci.nsMsgNavigationType.firstNew:
      case Ci.nsMsgNavigationType.editUndo:
      case Ci.nsMsgNavigationType.editRedo:
      case Ci.nsMsgNavigationType.toggleSubthreadKilled:
    }
  },
  
  get msgFolder() {
    return null;
  },
  get viewFolder() {
    return null;
  },
  
  getKeyAt: function gloda_mdbv_getKeyAt(aViewIndex) {
    return this._rows[aViewIndex].message.folderMessage.messageKey;
  },
  getFolderForViewIndex: function gloda_mdbv_getFolderForViewIndex(aViewIndex) {
    return this._rows[aViewIndex].message.folderMessage.folder;
  },
  getURIForViewIndex: function gloda_mdbv_getURIForViewIndex(aViewIndex) {
    return this._rows[aViewIndex].message.folderMessageURI;
  },
  
  getURIsForSelection: function gloda_mdbv_getURIsForSelection(
      aOutCount, aOutUris) {
    let selNodes = this.selectedNodes;
    aOutCount.value = selNodes.length;
    return [node.message.folderMessageURI for each
                      (node in selNodes)];
  },
  getIndicesForSelection: function gloda_mdbv_getIndicesForSelection(
      aOutCount, aOutIndices) {
    let selIndices = this.selectedIndices;
    aOutCount.value = selIndices.length;
    aOutIndices.value = selIndices;
  },
  
  get URIForFirstSelectedMessage() {
    let selNodes = this.selectedNodes;
    if (selNodes.length)
      return selNodes[0].message.folderMessageURI;
    else
      return null;
  },
  get hdrForFirstSelectedMessage() {
    let selNodes = this.selectedNodes;
    if (selNodes.length)
      return selNodes[0].message.folderMessage;
    else
      return null;
  },
  
  loadMessageByMsgKey: function gloda_mdbv_loadMessageByMsgKey(aMsgKey) {
    // ambiguity as to what message key we are dealing with.  let's assume it's
    //  a gloda message id for the sake of this method...
    
    this._messenger.OpenURL()
  },
  loadMessageByViewIndex: function gloda_mdbv_loadMessageByViewIndex(
      aViewIndex) {
    this._messenger.OpenURL()
  },
  loadMessageByUrl: function gloda_mdbv_loadMessageByUrl(aUrl) {
  },
  
  reloadMessage: function gloda_mdbv_reloadMessage() {
  },
  reloadMessageWithAllParts: function gloda_mdbv_reloadMessageWithAllParts() {
  },
  
  get numSelected() {
    return this.selectedIndices.length;
  },
  get msgToSelectAfterDelete() {
  },
  get currentlyDisplayedMessage() {
    return this._rows.indexOf(this._displayedNode);
  },
  
  selectMsgByKey: function gloda_mdbv_selectMsgByKey(aMsgKey) {
  },
  selectFolderMsgByKey: function gloda_mdbv_selectFolderMsgByKey(
      aMsgFolder, aMsgKey) {
  },
  
  get suppressMsgDisplay() {
    // TODO message display issues
    return null;
  },
  set suppressMsgDisplay(aSuppress) {
    // TODO message display issues
  },
  
  get suppressCommandUpdating() {
  },
  set suppressCommandUpdating(aSuppress) {
  },
  
  onDeleteCompleted: function gloda_mdbv_onDeleteCompleted(aSucceeded) {
  },
  
  get db() {
    return null;
  },
  
  get supportsThreading() {
    return true;
  },
  
  get searchSession() {
    // TODO: support searches
    return null;
  },
  set searchSession(aMsgSearchSession) {
    // TODO: support searches
    // nop for now
  },
  
  get removeRowOnMoveOrDelete() {
    // this depends on the delete model in the underlying world.
    // for now, we will always get rid of it
    return true;
  },
  
  findIndexFromKey: function gloda_mdbv_findIndexFromKey(aMsgKey, aExpand) {
  },
  ExpandAndSelectThreadByIndex:
    function gloda_mdbv_ExpandAndSelectThreadByIndex(aViewIndex, aAugment) {
  },
  
  get usingLines() {
    // XXX I guess we could support lines
    return false;
  },
  
  addColumnHandler: function gloda_mdbv_addColumnHandler(aColumn, aHandler) {
    this._customColumns[aColumn] = aHandler;
  },
  removeColumnHandler: function gloda_mdbv_removeColumnHandler(aColumn) {
    if (aColumn in this._customColumns)
      delete this._customColumns[aColumn];
  },
  getColumnHandler: function gloda_mdbv_getColumnHandler(aColumn) {
    return this._customColumns[aColumn];
  },
  
  /* ========== nsITreeView ========== */
  get selection() {
    return this._treeSelection;
  },
  set selection(aTreeSelection) {
    this._treeSelection = aTreeSelection;
  },
  
  get rowCount() {
    if (this._rows == null)
      return 0;
    return this._rows.length;
  },
  
  setTree: function gloda_mdbv_setTree(aTreeBox) {
    this._treeBox = aTreeBox;
  },

  getCellText: function gloda_mdbv_getCellText(aRow, aTreeCol) {
    let columnId = aTreeCol.id;
    if (columnId in this._customColumns) {
      let customColumn = this._customColumns[columnId];
      customColumn.getCellText(aRow, aTreeCol);
    }

    let message = this._rows[aRow].message;
    // if we can't find the underlying message, be sad and return nothing...
    if (message.folderMessage === null)
      return ":(";
    
    switch(columnId[0]) {
      case "s": // subject, sender, size, status
        switch(columnId[1]) {
          case "u": // subject
            return message.folderMessage.mime2DecodedSubject;
          case "e": // sender
            return message.from.contact.name;
          case "i": // size
            return message.folderMessage.messageSize;
          case "t": // status
            return messageStatusString(message.folderMessage.flags);
        }
        break;
      case "r": // recipient, received
        switch(columnId[3]) {
          case "i": // recipient
            return message.folderMessage.recipients;
          case "e": // received
            let recDate = new Date(1000 *
              folderMessage.getUint32Property("dateReceived"));
            return GlodaUtils.dateFormat(recDate);
        }
        break;
      case "d": // date
        return GlodaUtils.dateFormat(message.date);
      case "p": // priority
        return messagePriorityString(message.folderMessage.priority);
      case "a": // account
        return message.folderMessage.accountKey;
      case "t": // total messages in thread, tags
        switch (columnId[1]) {
          case "h": // total messages in thread
            // per idiom, only return this for top-level nodes
            let node = this._Rows[aRow];
            if (node.parent === null)
              return "" + node.nodesInSubTree;
            else
              return "";
          case "a": // tags
            return [tag.tag.tag for each (tag in message.tags)].join(" ");
        }
        break;
      case "u": // unread messages in thread
        // per idiom, only return this for top-level nodes
        let node = this._Rows[aRow];
        if (node.parent === null)
          return "" + node.unreadInSubTree;
        else
          return "";        
      case "j": // junk score
        return message.folderMessage.getStringProperty("junkscore");
      case "i": // id
        // I don't think this is exposed anymore; perhaps only ever for
        //  debugging?  (The C++ impl exposes the messageKey, which has no
        //  reason to be user visible.)
        return "" + message.id;
      case "l": // location, previously label too?
        switch (columnId[1]) {
          case "o": // location
            return message.folderMessage.folder.prettiestName;
            break;
        }
      default:
        break;
    }
    return "";
  },
  
  isContainer: function gloda_mdbv_isContainer(aIndex) {
    return this._rows[aIndex].children &&
           this._rows[aIndex].children.length != 0;
  },
  isContainerOpen: function gloda_mdbv_isContainerOpen(aIndex) {
    return this._rows[aIndex].open;
  },
  isContainerEmpty: function gloda_mdbv_isContainerEmpty(aIndex) {
    // we won't report something is a container if it lacks children
    return false;
  },
  isSeparator: function gloda_mdbv_isSeparator(aIndex) {
    // no message is a separator, unless this involves grouping, in which case
    //  we need to do something about that.
    return false;
  },
  
  isSorted: function gloda_mdbv_isSorted() {
    return this._sortType != Ci.nsMsgViewSortType.byNone;
  },
  isEditable: function gloda_mdbv_isEditable(idx, column) {
    return false;
  },
  
  getParentIndex: function gloda_mdbv_getParentIndex(aIndex) {
    let selNode = this._rows[aIndex];
    // a reverse search would be nicer.
    // potentially nicest would be just leveraging our knowledge of the tree to
    //  do our own traversal, although the indexOf has a fair chance of winning
    //  in many cases (assuming it is optimized).
    return this._rows.indexOf(selNode.parent);
  },
  getLevel: function gloda_mdbv_getLevel(aIndex) {
    return this._rows[aIndex].level;
  },
  
  hasNextSibling: function gloda_mdbv_hasNextSibling(aIndex, aAfterIndex) {
    let selNode = this._rows[aIndex];
    // if we have no parent or we are the last child, just rule it out.
    if ((selNode.parent === null) ||
        (selNode.parent.indexOf(selNode) == selNode.parent.children.length - 1))
      return false;
    // walk to the after index looking for our last sibling.  if we find it
    //  before we run out of indices, we have no sibling, otherwise our sibling
    //  must exist there.  we are assuming afterIndex is partitioned in such
    //  a way that this walk is probably shorter than walking potentially the
    //  entire row list.
    let lastSibling = selNode.parent.children[selNode.parent.children.length-1];
    for (let iCur=aIndex+1; iCur <= aAfterIndex; iCur++) {
      if (this._rows[iCur] === lastSibling)
        return false;
    }
    return true;
  },
  toggleOpenState: function gloda_mdbv_toggleOpenState(aIndex) {
    let selNode = this._rows[aIndex];
    selNode.open = !selNode.open;
    
    if(selNode.open) {
      // we're now open, we were previously closed.
      // since our children retain their open/closed status, we may need to
      //  recursively open such children.
      
      // to avoid pathological insertion to _rows, build a list of what we
      //  are going to insert, and since we plan on using splice via apply,
      //  put the initial args in...
      let spliceArgs = [aIndex+1, 0];
      
      function expandNode(aNode) {
        for (let iChild=0; iChild < aNode.children; iChild++) {
          let child = aNode.children[iChild];
          spliceArgs.push(child);
          if (child.open)
            expandNode(child);
        }
      }
      
      expandNode(selNode);
      let rowsInserted = spliceArgs.length - 2;
      this._rows.splice.apply(this._rows, spliceArgs);
      
      if (this._treeBox)
        this._treeBox.rowCountChanged(aIndex+1, rowsInserted);
    }
    else {
      // we're closed now, we were previously open
      
      // since we don't have a root node, locating the next sibling/uncle is not
      //  tremendously easy to just scan for that. so we do a level scan
      //  for the first node at or above the given node's level (which must be
      //  a sibling or uncle)
      let curLevel = selNode.level;
      for (let iRow=aIndex+1; iRow < this._rows.length; iRow++) {
        if (this._rows[iRow].level <= curLevel)
          break;
      }
      let rowsToDelete = iRow - aIndex+1;
      if (rowsToDelete) {
        this._rows.splice(aIndex+1, rowsToDelete);
        if (this._treeBox)
          this._treeBox.rowCountChanged(aIndex+1, -rowsToDelete);
      }
    }
  },
  
  getImageSrc: function(idx, column) {},
  getProgressMode : function(idx,column) {},
  getCellValue: function(idx, column) {},
  cycleHeader: function(col, elem) {},
  selectionChanged: function gloda_mdbv_selectionChanged() {
    this._selectedNodes = null;
  },
  cycleCell: function(idx, column) {},
  performAction: function(action) {},
  performActionOnCell: function(action, index, column) {},
  getRowProperties: function(idx, column, prop) {
  },
  getCellProperties: function(idx, column, prop) {
  },
  getColumnProperties: function(column, element, prop) {
  },  
};

var components = [GlodaMsgDBView];
function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
