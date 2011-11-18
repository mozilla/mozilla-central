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
 *   Mark Banner <bugzilla@standard8.plus.com>
 *   David Ascher <dascher@mozillamessaging.com>
 *   Dan Mosedale <dmose@mozillamessagin.com>
 *   Joachim Herb <herb@leo.org>
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/* This is where functions related to displaying the headers for a selected message in the
   message pane live. */

////////////////////////////////////////////////////////////////////////////////////
// Warning: if you go to modify any of these JS routines please get a code review from
// scott@scott-macgregor.org. It's critical that the code in here for displaying
// the message headers for a selected message remain as fast as possible. In particular,
// right now, we only introduce one reflow per message. i.e. if you click on a message in the thread
// pane, we batch up all the changes for displaying the header pane (to, cc, attachements button, etc.)
// and we make a single pass to display them. It's critical that we maintain this one reflow per message
// view in the message header pane.
////////////////////////////////////////////////////////////////////////////////////

var gViewAllHeaders = false;
var gMinNumberOfHeaders = 0;
var gDummyHeaderIdIndex = 0;
var gBuildAttachmentsForCurrentMsg = false;
var gBuildAttachmentPopupForCurrentMsg = true;
var gBuiltExpandedView = false;
var gHeadersShowReferences = false;
// Show the friendly display names for people I know, instead of the name + email address.
var gShowCondensedEmailAddresses;

/**
 * Other components may listen to on start header & on end header notifications
 * for each message we display: to do that you need to add yourself to our
 * gMessageListeners array with an object that supports the three properties:
 * onStartHeaders, onEndHeaders and onEndAttachments.
 *
 * Additionally, if your object has an onBeforeShowHeaderPane() method, it will
 * be called at the appropriate time.  This is designed to give add-ons a
 * chance to examine and modify the currentHeaderData array before it gets
 * displayed.
 */
var gMessageListeners = new Array();

// For every possible "view" in the message pane, you need to define the header names you want to
// see in that view. In addition, include information describing how you want that header field to be
// presented. i.e. if it's an email address field, if you want a toggle inserted on the node in case
// of multiple email addresses, etc. We'll then use this static table to dynamically generate header view entries
// which manipulate the UI.
// When you add a header to one of these view lists you can specify the following properties:
// name: the name of the header. i.e. "to", "subject". This must be in lower case and the name of the
//       header is used to help dynamically generate ids for objects in the document. (REQUIRED)
// useToggle:      true if the values for this header are multiple email addresses and you want a
//                 a (more) toggle to show a short vs. long list (DEFAULT: false)
// outputFunction: this is a method which takes a headerEntry (see the definition below) and a header value
//                 This allows you to provide your own methods for actually determining how the header value
//                 is displayed. (DEFAULT: updateHeaderValue which just sets the header value on the text node)

// This expanded header view shows many of the more common (and useful) headers.
var gExpandedHeaderList = [ {name:"subject"},
                            {name:"from", useToggle:true, outputFunction:OutputEmailAddresses},
                            {name:"reply-to", useToggle:true, outputFunction:OutputEmailAddresses},
                            {name:"to", useToggle:true, outputFunction:OutputEmailAddresses},
                            {name:"cc", useToggle:true, outputFunction:OutputEmailAddresses},
                            {name:"bcc", useToggle:true, outputFunction:OutputEmailAddresses},
                            {name:"newsgroups", outputFunction:OutputNewsgroups},
                            {name:"references", outputFunction:OutputMessageIds},
                            {name:"followup-to", outputFunction:OutputNewsgroups},
                            {name:"content-base"},
                            {name:"tags"} ];

// These are all the items that use a mail-multi-emailHeaderField widget and
// therefore may require updating if the address book changes.
const gEmailAddressHeaderNames = ["from", "reply-to",
                                  "to", "cc", "bcc", "toCcBcc"];

// Now, for each view the message pane can generate, we need a global table of headerEntries. These
// header entry objects are generated dynamically based on the static data in the header lists (see above)
// and elements we find in the DOM based on properties in the header lists.
var gExpandedHeaderView  = {};

// currentHeaderData --> this is an array of header name and value pairs for the currently displayed message.
//                       it's purely a data object and has no view information. View information is contained in the view objects.
//                       for a given entry in this array you can ask for:
// .headerName ---> name of the header (i.e. 'to'). Always stored in lower case
// .headerValue --> value of the header "johndoe@netscape.net"
var currentHeaderData = {};

// For the currently displayed message, we store all the attachment data. When displaying a particular
// view, it's up to the view layer to extract this attachment data and turn it into something useful.
// For a given entry in the attachments list, you can ask for the following properties:
// .contentType --> the content type of the attachment
// url --> an imap, or mailbox url which can be used to fetch the message
// uri --> an RDF URI which refers to the message containig the attachment
// isExternalAttachment --> boolean flag stating whether the attachment is an attachment which is a URL that refers to the attachment location
var currentAttachments = new Array();

const nsIAbListener = Components.interfaces.nsIAbListener;
const nsIAbCard = Components.interfaces.nsIAbCard;

// createHeaderEntry --> our constructor method which creates a header Entry
// based on an entry in one of the header lists. A header entry is different from a header list.
// a header list just describes how you want a particular header to be presented. The header entry
// actually has knowledge about the DOM and the actual DOM elements associated with the header.
// prefix --> the name of the view (e.g. "expanded")
// headerListInfo --> entry from a header list.
function createHeaderEntry(prefix, headerListInfo)
{
  var partialIDName = prefix + headerListInfo.name;
  this.enclosingBox = document.getElementById(partialIDName + 'Box');
  this.enclosingRow = document.getElementById(partialIDName + 'Row');
  this.textNode = document.getElementById(partialIDName + 'Value');
  this.isNewHeader = false;
  this.valid = false;

  if ("useToggle" in headerListInfo)
  {
    this.useToggle = headerListInfo.useToggle;
    if (this.useToggle) // find the toggle icon in the document
    {
      this.toggleIcon = this.enclosingBox.toggleIcon;
      this.longTextNode = this.enclosingBox.longEmailAddresses;
      this.textNode = this.enclosingBox.emailAddresses;
    }
  }
  else
   this.useToggle = false;

  if ("outputFunction" in headerListInfo)
    this.outputFunction = headerListInfo.outputFunction;
  else
    this.outputFunction = updateHeaderValue;

  // stash this so that the <mail-multi-emailheaderfield/> binding can
  // later attach it to any <mail-emailaddress> tags it creates for later
  // extraction and use by UpdateEmailNodeDetails.
  this.enclosingBox.headerName = headerListInfo.name;

}

function initializeHeaderViewTables()
{
  var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch2);
  // iterate over each header in our header list arrays and create header entries
  // for each one. These header entries are then stored in the appropriate header table
  var index;
  for (index = 0; index < gExpandedHeaderList.length; index++)
  {
    var headerName = gExpandedHeaderList[index].name;
    gExpandedHeaderView[headerName] = new createHeaderEntry('expanded', gExpandedHeaderList[index]);
  }

  var extraHeaders = prefBranch.getCharPref("mailnews.headers.extraExpandedHeaders").split(' ');
  for (index = 0; index < extraHeaders.length; index++)
  {
    var extraHeader = extraHeaders[index];
    gExpandedHeaderView[extraHeader.toLowerCase()] = new createNewHeaderView(extraHeader, extraHeader);
  }

  if (prefBranch.getBoolPref("mailnews.headers.showOrganization"))
  {
    var organizationEntry = {name:"organization", outputFunction:updateHeaderValue};
    gExpandedHeaderView[organizationEntry.name] = new createHeaderEntry('expanded', organizationEntry);
  }

  if (prefBranch.getBoolPref("mailnews.headers.showUserAgent"))
  {
    var userAgentEntry = {name:"user-agent", outputFunction:updateHeaderValue};
    gExpandedHeaderView[userAgentEntry.name] = new createHeaderEntry('expanded', userAgentEntry);
  }

  if (prefBranch.getBoolPref("mailnews.headers.showMessageId"))
  {
    var messageIdEntry = {name:"message-id", outputFunction:OutputMessageIds};
    gExpandedHeaderView[messageIdEntry.name] = new createHeaderEntry('expanded', messageIdEntry);
  }

  if (prefBranch.getBoolPref("mailnews.headers.showSender"))
  {
    var senderEntry = {name:"sender", outputFunction:OutputEmailAddresses};
    gExpandedHeaderView[senderEntry.name] = new createHeaderEntry('expanded', senderEntry);
  }
}

function OnLoadMsgHeaderPane()
{
  // HACK...force our XBL bindings file to be load before we try to create our first xbl widget....
  // otherwise we have problems.
  document.loadBindingDocument('chrome://messenger/content/mailWidgets.xml');

  // load any preferences that at are global with regards to
  // displaying a message...
  gMinNumberOfHeaders = pref.getIntPref("mailnews.headers.minNumHeaders");
  gShowCondensedEmailAddresses = pref.getBoolPref("mail.showCondensedAddresses");
  gHeadersShowReferences = pref.getBoolPref("mailnews.headers.showReferences");

  // listen to the
  pref.addObserver("mail.showCondensedAddresses", MsgHdrViewObserver, false);
  pref.addObserver("mailnews.headers.showReferences", MsgHdrViewObserver, false);

  initializeHeaderViewTables();

  // Add an address book listener so we can update the header view when things
  // change.
  Components.classes["@mozilla.org/abmanager;1"]
            .getService(Components.interfaces.nsIAbManager)
            .addAddressBookListener(AddressBookListener,
                                    Components.interfaces.nsIAbListener.all);

  // if an invalid index is selected; reset to 0.  One way this can happen
  // is if a value of 1 was persisted to localStore.rdf by Tb2 (when there were
  // two panels), and then the user upgraded to Tb3, which only has one.
  // Presumably this can also catch cases of extension uninstalls as well.
  let deckElement = document.getElementById('msgHeaderViewDeck')

  // If the selectedIndex was 0, then we were using the compact header, (if we
  // were coming from TB2, but we'll check that in the feature configurator).
  deckElement.usedCompactHeader = (deckElement.selectedIndex == 0);

  if (deckElement.selectedIndex < 0 ||
      deckElement.selectedIndex >= deckElement.childElementCount) {
    deckElement.selectedIndex = 0;
  }

  initToolbarMenu();

  // Only offer openInTab and openInNewWindow if this window supports tabs...
  // (i.e. is not a standalone message window), since those actions are likely
  // to be significantly less common in that case.
  let opensAreHidden = document.getElementById("tabmail") ? false : true;
  let openInTab = document.getElementById("otherActionsOpenInNewTab");
  let openInNewWindow = document.getElementById("otherActionsOpenInNewWindow");
  openInTab.hidden = openInNewWindow.hidden = opensAreHidden;

  // dispatch an event letting any listeners know that we have loaded the message pane
  var event = document.createEvent('Events');
  event.initEvent('messagepane-loaded', false, true);
  var headerViewElement = document.getElementById("msgHeaderView");
  headerViewElement.dispatchEvent(event);

  initInlineToolbox("header-view-toolbox", "header-view-toolbar",
                    "CustomizeHeaderToolbar", function() {
                      UpdateJunkButton();
                      UpdateReplyButtons();
                    });
  initInlineToolbox("attachment-view-toolbox", "attachment-view-toolbar",
                    "CustomizeAttachmentToolbar", function () {
                      updateSaveAllAttachmentsButton();
                    });
}

/**
 * Initialize an inline toolbox and its toolbar to have the appropriate
 * attributes necessary for customization and persistence.
 *
 * @param toolboxId the id for the toolbox to initialize
 * @param toolbarId the id for the toolbar to initialize
 * @param popupId the id for the menupopup to initialize
 * @param customizeChange (optional) a function to call when a toolbar button
 *        has been added or removed from the toolbar
 */
function initInlineToolbox(toolboxId, toolbarId, popupId, customizeChange) {
  let toolbox = document.getElementById(toolboxId);
  toolbox.customizeDone = function(aEvent) {
    MailToolboxCustomizeDone(aEvent, popupId);
  };
  if (customizeChange)
    toolbox.customizeChange = customizeChange;

  let toolbarset = document.getElementById("customToolbars");
  toolbox.toolbarset = toolbarset;

  // Check whether we did an upgrade to a customizable header pane.
  // If yes, set the header pane toolbar mode to icons besides text
  let toolbar = document.getElementById(toolbarId);
  if (toolbox && toolbar) {
    if (!toolbox.getAttribute("mode")) {

      /* set toolbox attributes to default values */
      let mode = toolbox.getAttribute("defaultmode");
      let align = toolbox.getAttribute("defaultlabelalign");
      let iconsize = toolbox.getAttribute("defaulticonsize");
      toolbox.setAttribute("mode", mode);
      toolbox.setAttribute("labelalign", align);
      toolbox.setAttribute("iconsize", iconsize);
      toolbox.ownerDocument.persist(toolbox.id, "mode");
      toolbox.ownerDocument.persist(toolbox.id, "iconsize");
      toolbox.ownerDocument.persist(toolbox.id, "labelalign");

      /* set toolbar attributes to default values */
      iconsize = toolbar.getAttribute("defaulticonsize");
      toolbar.setAttribute("iconsize", iconsize);
      toolbar.ownerDocument.persist(toolbar.id, "iconsize");
    }
  }
}

function initToolbarMenu() {

  // Get the mode as persisted on the toolbar itself.
  let mode = document.getElementById('header-view-toolbar')
                     .getAttribute("mode");

  return;
}

function OnUnloadMsgHeaderPane()
{
  pref.removeObserver("mail.showCondensedAddresses", MsgHdrViewObserver);
  pref.removeObserver("mailnews.headers.showReferences", MsgHdrViewObserver);

  Components.classes["@mozilla.org/abmanager;1"]
            .getService(Components.interfaces.nsIAbManager)
            .removeAddressBookListener(AddressBookListener);

  // dispatch an event letting any listeners know that we have unloaded the message pane
  var event = document.createEvent('Events');
  event.initEvent('messagepane-unloaded', false, true);
  var headerViewElement = document.getElementById("msgHeaderView");
  headerViewElement.dispatchEvent(event);
}

const MsgHdrViewObserver =
{
  observe: function(subject, topic, prefName)
  {
    // verify that we're changing the mail pane config pref
    if (topic == "nsPref:changed")
    {
      if (prefName == "mail.showCondensedAddresses")
      {
        gShowCondensedEmailAddresses = pref.getBoolPref("mail.showCondensedAddresses");
        ReloadMessage();
      }
      else if (prefName == "mailnews.headers.showReferences")
      {
        gHeadersShowReferences = pref.getBoolPref("mailnews.headers.showReferences");
        ReloadMessage();
      }
    }
  }
};

var AddressBookListener =
{
  onItemAdded: function(aParentDir, aItem) {
    OnAddressBookDataChanged(nsIAbListener.itemAdded,
                             aParentDir, aItem);
  },
  onItemRemoved: function(aParentDir, aItem) {
    OnAddressBookDataChanged(aItem instanceof nsIAbCard ?
                             nsIAbListener.directoryItemRemoved :
                             nsIAbListener.directoryRemoved,
                             aParentDir, aItem);
  },
  onItemPropertyChanged: function(aItem, aProperty, aOldValue, aNewValue) {
    // We only need updates for card changes, address book and mailing list
    // ones don't affect us here.
    if (aItem instanceof Components.interfaces.nsIAbCard)
      OnAddressBookDataChanged(nsIAbListener.itemChanged, null, aItem);
  }
};

function OnAddressBookDataChanged(aAction, aParentDir, aItem) {
  gEmailAddressHeaderNames.forEach(function (headerName) {
      var headerEntry = null;

      if (headerName in gExpandedHeaderView) {
        headerEntry = gExpandedHeaderView[headerName];
        if (headerEntry)
          headerEntry.enclosingBox.updateExtraAddressProcessing(aAction,
                                                                aParentDir,
                                                                aItem);
      }
    });
}

// The messageHeaderSink is the class that gets notified of a message's headers as we display the message
// through our mime converter.

var messageHeaderSink = {
    QueryInterface: XPCOMUtils.generateQI(
      [Components.interfaces.nsIMsgHeaderSink]),
    onStartHeaders: function()
    {
      this.mSaveHdr = null;
      // every time we start to redisplay a message, check the view all headers pref....
      var showAllHeadersPref = pref.getIntPref("mail.show_headers");
      if (showAllHeadersPref == 2)
      {
        gViewAllHeaders = true;
      }
      else
      {
        if (gViewAllHeaders) // if we currently are in view all header mode, rebuild our header view so we remove most of the header data
        {
          hideHeaderView(gExpandedHeaderView);
          RemoveNewHeaderViews(gExpandedHeaderView);
          gDummyHeaderIdIndex = 0;
          gExpandedHeaderView = {};
          initializeHeaderViewTables();
        }

        gViewAllHeaders = false;
      }

      ClearCurrentHeaders();
      gBuiltExpandedView = false;
      gBuildAttachmentsForCurrentMsg = false;
      gBuildAttachmentPopupForCurrentMsg = true;
      ClearAttachmentList();
      ClearEditMessageBox();
      gMessageNotificationBar.clearMsgNotifications();

      for (let index in gMessageListeners)
        gMessageListeners[index].onStartHeaders();
    },

    onEndHeaders: function()
    {
      // give add-ons a chance to modify currentHeaderData before it actually
      // gets displayed
      for (let index in gMessageListeners)
        if ("onBeforeShowHeaderPane" in gMessageListeners[index])
          gMessageListeners[index].onBeforeShowHeaderPane();

      ShowMessageHeaderPane();
      // WARNING: This is the ONLY routine inside of the message Header Sink that should
      // trigger a reflow!
      ClearHeaderView(gExpandedHeaderView);

      EnsureSubjectValue(); // make sure there is a subject even if it's empty so we'll show the subject and the twisty

      // Only update the expanded view if it's actually selected (an
      // extension-provided panel could be visible instead) and needs updating.
      if (document.getElementById('msgHeaderViewDeck').selectedIndex == 0 &&
          !gBuiltExpandedView) {
        UpdateExpandedMessageHeaders();
      }

      ShowEditMessageBox();
      UpdateJunkButton();

      for (let index in gMessageListeners)
        gMessageListeners[index].onEndHeaders();
    },

    processHeaders: function(headerNameEnumerator, headerValueEnumerator, dontCollectAddress)
    {
      this.onStartHeaders();

      const kMailboxSeparator = ", ";
      var index = 0;
      while (headerNameEnumerator.hasMore())
      {
        var header = new Object;
        header.headerValue = headerValueEnumerator.getNext();
        header.headerName = headerNameEnumerator.getNext();

        // For consistency's sake, let us force all header names to be lower
        // case so we don't have to worry about looking for: Cc and CC, etc.
        var lowerCaseHeaderName = header.headerName.toLowerCase();

        // If we have an x-mailer, x-mimeole, or x-newsreader string,
        // put it in the user-agent slot which we know how to handle already.
        if (/^x-(mailer|mimeole|newsreader)$/.test(lowerCaseHeaderName))
          lowerCaseHeaderName = "user-agent";

        if (this.mDummyMsgHeader)
        {
          if (lowerCaseHeaderName == "from")
            this.mDummyMsgHeader.author = header.headerValue;
          else if (lowerCaseHeaderName == "to")
            this.mDummyMsgHeader.recipients = header.headerValue;
          else if (lowerCaseHeaderName == "cc")
            this.mDummyMsgHeader.ccList = header.headerValue;
          else if (lowerCaseHeaderName == "subject")
            this.mDummyMsgHeader.subject = header.headerValue;
          else if (lowerCaseHeaderName == "reply-to")
            this.mDummyMsgHeader.replyTo = header.headerValue;
          else if (lowerCaseHeaderName == "message-id")
            this.mDummyMsgHeader.messageId = header.headerValue;
          else if (lowerCaseHeaderName == "list-post")
            this.mDummyMsgHeader.listPost = header.headerValue;
          else if (lowerCaseHeaderName == "delivered-to")
            this.mDummyMsgHeader.deliveredTo = header.headerValue;
          else if (lowerCaseHeaderName == "date")
            this.mDummyMsgHeader.date = Date.parse(header.headerValue) * 1000;
        }
        // according to RFC 2822, certain headers
        // can occur "unlimited" times
        if (lowerCaseHeaderName in currentHeaderData)
        {
          // sometimes, you can have multiple To or Cc lines....
          // in this case, we want to append these headers into one.
          if (lowerCaseHeaderName == 'to' || lowerCaseHeaderName == 'cc')
            currentHeaderData[lowerCaseHeaderName].headerValue = currentHeaderData[lowerCaseHeaderName].headerValue + ',' + header.headerValue;
          else
          {
            // use the index to create a unique header name like:
            // received5, received6, etc
            currentHeaderData[lowerCaseHeaderName + index++] = header;
          }
        }
        else
         currentHeaderData[lowerCaseHeaderName] = header;
      } // while we have more headers to parse

      // process message tags as if they were headers in the message
      SetTagHeader();

      var msgHeaderParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                                      .getService(Components.interfaces.nsIMsgHeaderParser);

      if (("from" in currentHeaderData) && ("sender" in currentHeaderData))
      {
        var senderMailbox = kMailboxSeparator +
          msgHeaderParser.extractHeaderAddressMailboxes(
            currentHeaderData.sender.headerValue) + kMailboxSeparator;
        var fromMailboxes = kMailboxSeparator +
          msgHeaderParser.extractHeaderAddressMailboxes(
            currentHeaderData.from.headerValue) + kMailboxSeparator;
        if (fromMailboxes.indexOf(senderMailbox) >= 0)
          delete currentHeaderData.sender;
      }

      // We don't need to show the reply-to header if its value is either
      // the From field (totally pointless) or the To field (common for
      // mailing lists, but not that useful).
      if (("from" in currentHeaderData) &&
          ("to" in currentHeaderData) &&
          ("reply-to" in currentHeaderData)) {
        var replyToMailbox = msgHeaderParser.extractHeaderAddressMailboxes(
            currentHeaderData["reply-to"].headerValue);
        var fromMailboxes = msgHeaderParser.extractHeaderAddressMailboxes(
            currentHeaderData.from.headerValue);
        var toMailboxes = msgHeaderParser.extractHeaderAddressMailboxes(
            currentHeaderData.to.headerValue);

        if (replyToMailbox == fromMailboxes || replyToMailbox == toMailboxes)
          delete currentHeaderData["reply-to"];
      }

      this.onEndHeaders();
    },

    handleAttachment: function(contentType, url, displayName, uri, isExternalAttachment)
    {
      // presentation level change....don't show vcards as external attachments in the UI.
      // libmime already renders them inline.

      if (!this.mSaveHdr)
        this.mSaveHdr = messenger.messageServiceFromURI(uri).messageURIToMsgHdr(uri);
      if (contentType == "text/x-vcard") {
        var inlineAttachments = pref.getBoolPref("mail.inline_attachments");
        var displayHtmlAs = pref.getIntPref("mailnews.display.html_as");
        if (inlineAttachments && !displayHtmlAs)
          return;
      }

      var size = null;
      if (isExternalAttachment) {
        var fileHandler = Components.classes["@mozilla.org/network/io-service;1"]
                                    .getService(Components.interfaces.nsIIOService)
                                    .getProtocolHandler("file")
                                    .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
        try {
          size = fileHandler.getFileFromURLSpec(url).fileSize;
        }
        catch(e) {
          Components.utils.reportError("Couldn't open external attachment!");
        }
      }

      currentAttachments.push(new AttachmentInfo(contentType, url, displayName,
                                                 uri, isExternalAttachment,
                                                 size));
      // If we have an attachment, set the nsMsgMessageFlags.Attachment flag
      // on the hdr to cause the "message with attachment" icon to show up
      // in the thread pane.
      // We only need to do this on the first attachment.
      var numAttachments = currentAttachments.length;
      if (numAttachments == 1) {
        // we also have to enable the File/Attachments menuitem
        var node = document.getElementById("fileAttachmentMenu");
        if (node)
          node.removeAttribute("disabled");

        // convert the uri into a hdr
        this.mSaveHdr.markHasAttachments(true);
      }
    },

    addAttachmentField: function(field, value)
    {
      let last = currentAttachments[currentAttachments.length-1];
      if (field == "X-Mozilla-PartSize" && !last.isExternalAttachment &&
          !last.isDeleted) {
        let size = parseInt(value);

        // libmime returns -1 if it never managed to figure out the size.
        if (size != -1)
          last.size = size;
      }
      else if (field == "X-Mozilla-PartDownloaded" && value == "0") {
        // We haven't downloaded the attachment, so any size we get from
        // libmime is almost certainly inaccurate. Just get rid of it. (Note:
        // this relies on the fact that PartDownloaded comes after PartSize from
        // the MIME emitter.)
        last.size = null;
      }
    },

    onEndAllAttachments: function()
    {
      displayAttachmentsForExpandedView();

      for each (let [, listener] in Iterator(gMessageListeners)) {
        if ("onEndAttachments" in listener)
          listener.onEndAttachments();
      }
    },

    /**
     * This event is generated by nsMsgStatusFeedback when it gets an
     * OnStateChange event for STATE_STOP.  This is the same event that
     * generates the "msgLoaded" property flag change event.  This best
     * corresponds to the end of the streaming process.
     */
    onEndMsgDownload: function(url)
    {
      gMessageDisplay.onLoadCompleted();

      // if we don't have any attachments, turn off the attachments flag
      if (!this.mSaveHdr)
      {
        var messageUrl = url.QueryInterface(Components.interfaces.nsIMsgMessageUrl);
        this.mSaveHdr = messenger.msgHdrFromURI(messageUrl.uri);
      }
      if (!currentAttachments.length && this.mSaveHdr)
        this.mSaveHdr.markHasAttachments(false);
      OnMsgParsed(url);
    },

    onEndMsgHeaders: function(url)
    {
      OnMsgLoaded(url);
    },

    onMsgHasRemoteContent: function(aMsgHdr)
    {
      gMessageNotificationBar.setRemoteContentMsg(aMsgHdr);
    },

    mSecurityInfo  : null,
    mSaveHdr: null,
    get securityInfo()
    {
      return this.mSecurityInfo;
    },
    set securityInfo(aSecurityInfo)
    {
      this.mSecurityInfo = aSecurityInfo;
    },

    mDummyMsgHeader: null,

    get dummyMsgHeader()
    {
      if (!this.mDummyMsgHeader)
        this.mDummyMsgHeader = new nsDummyMsgHeader();
      // The URI resolution will never work on the dummy header;
      // save it now... we know it will be needed eventually.
      // (And save it every time we come through here, not just when
      // we create it; the onStartHeaders might come after creation!)
      this.mSaveHdr = this.mDummyMsgHeader;
      return this.mDummyMsgHeader;
    },
    mProperties: null,
    get properties()
    {
      if (!this.mProperties)
        this.mProperties = Components.classes["@mozilla.org/hash-property-bag;1"].
          createInstance(Components.interfaces.nsIWritablePropertyBag2);
      return this.mProperties;
    },

    resetProperties: function() {
      this.mProperties = null;
    }
};

function SetTagHeader()
{
  // it would be nice if we passed in the msgHdr from the back end
  var msgHdr = gFolderDisplay.selectedMessage;
  if (!msgHdr)
    return; // no msgHdr to add our tags to

  // get the list of known tags
  var tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                   .getService(Components.interfaces.nsIMsgTagService);
  var tagArray = tagService.getAllTags({});
  var tagKeys = {};
  for each (var tagInfo in tagArray)
    if (tagInfo.tag)
      tagKeys[tagInfo.key] = true;

  // extract the tag keys from the msgHdr
  var msgKeyArray = msgHdr.getStringProperty("keywords").split(" ");

  // attach legacy label to the front if not already there
  var label = msgHdr.label;
  if (label)
  {
    var labelKey = "$label" + label;
    if (msgKeyArray.indexOf(labelKey) < 0)
      msgKeyArray.unshift(labelKey);
  }

  // Rebuild the keywords string with just the keys that are actual tags or
  // legacy labels and not other keywords like Junk and NonJunk.
  // Retain their order, though, with the label as oldest element.
  for (var i = msgKeyArray.length - 1; i >= 0; --i)
    if (!(msgKeyArray[i] in tagKeys))
      msgKeyArray.splice(i, 1); // remove non-tag key
  var msgKeys = msgKeyArray.join(" ");

  if (msgKeys)
    currentHeaderData.tags = {headerName: "tags", headerValue: msgKeys};
  else // no more tags, so clear out the header field
    delete currentHeaderData.tags;
}

function EnsureSubjectValue()
{
  if (!('subject' in currentHeaderData))
  {
    var foo = new Object;
    foo.headerValue = "";
    foo.headerName = 'subject';
    currentHeaderData[foo.headerName] = foo;
  }
}

function OnTagsChange()
{
  // rebuild the tag headers
  SetTagHeader();

  // now update the expanded header view to rebuild the tags,
  // and then show or hide the tag header box.
  if (gBuiltExpandedView)
  {
    var headerEntry = gExpandedHeaderView.tags;
    if (headerEntry)
    {
      headerEntry.valid = ("tags" in currentHeaderData);
      if (headerEntry.valid)
        headerEntry.outputFunction(headerEntry, currentHeaderData.tags.headerValue);

      // we may need to collapse or show the tag header row...
      headerEntry.enclosingRow.collapsed = !headerEntry.valid;
      // ... and ensure that all headers remain correctly aligned
      syncGridColumnWidths();
    }
  }
}

// flush out any local state being held by a header entry for a given
// table
function ClearHeaderView(headerTable)
{
  for each (let [, headerEntry] in Iterator(headerTable))
  {
     if (headerEntry.enclosingBox.clearHeaderValues)
     {
       headerEntry.enclosingBox.clearHeaderValues();
     }

     headerEntry.valid = false;
  }
}

// make sure that any valid header entry in the table is collapsed
function hideHeaderView(headerTable)
{
  for each (let [, headerEntry] in Iterator(headerTable))
    headerEntry.enclosingRow.collapsed = true;
}

// make sure that any valid header entry in the table specified is
// visible
function showHeaderView(headerTable)
{
  for each (let [, headerEntry] in Iterator(headerTable))
  {
    if (headerEntry.valid)
    {
      headerEntry.enclosingRow.collapsed = false;
    }
    else // if the entry is invalid, always make sure it's collapsed
      headerEntry.enclosingRow.collapsed = true;
  }
}

// enumerate through the list of headers and find the number that are visible
// add empty entries if we don't have the minimum number of rows
function EnsureMinimumNumberOfHeaders (headerTable)
{
  if (!gMinNumberOfHeaders) // 0 means we don't have a minimum..do nothing special
    return;

  var numVisibleHeaders = 0;
  for each (let [, headerEntry] in Iterator(headerTable))
  {
    if (headerEntry.valid)
      numVisibleHeaders ++;
  }

  if (numVisibleHeaders < gMinNumberOfHeaders)
  {
    // how many empty headers do we need to add?
    var numEmptyHeaders = gMinNumberOfHeaders - numVisibleHeaders;

    // we may have already dynamically created our empty rows and we just need to make them visible
    for each (let [index, headerEntry] in Iterator(headerTable))
    {
      if (index.indexOf("Dummy-Header") == 0 && numEmptyHeaders)
      {
        headerEntry.valid = true;
        numEmptyHeaders--;
      }
    }

    // ok, now if we have any extra dummy headers we need to add, create a new header widget for them
    while (numEmptyHeaders)
    {
      var dummyHeaderId = "Dummy-Header" + gDummyHeaderIdIndex;
      gExpandedHeaderView[dummyHeaderId] = new createNewHeaderView(dummyHeaderId, "");
      gExpandedHeaderView[dummyHeaderId].valid = true;

      gDummyHeaderIdIndex++;
      numEmptyHeaders--;
    }

  }
}

// make sure the appropriate fields in the expanded header view are collapsed
// or visible...
function updateExpandedView()
{
  // if the expanded view isn't selected, don't bother updating it
  if (document.getElementById('msgHeaderViewDeck').selectedIndex != 0)
    return;

  if (gMinNumberOfHeaders)
      EnsureMinimumNumberOfHeaders(gExpandedHeaderView);
  showHeaderView(gExpandedHeaderView);

  // Now that we have all the headers, ensure that the name columns of both
  // grids are the same size so that they don't look weird.
  syncGridColumnWidths();

  UpdateJunkButton();
  UpdateReplyButtons();
  displayAttachmentsForExpandedView();

  try {
    AdjustHeaderView(pref.getIntPref("mail.show_headers"));
  } catch (e) { logException(e); }
}

/**
 * Ensure that the name columns in both grids are the same size, since the only
 * reason that we're using two grids at all is to workaround the XUL box
 * model's inability to float elements.
 */
function syncGridColumnWidths()
{
  let nameColumn = document.getElementById('expandedHeadersNameColumn');
  let nameColumn2 = document.getElementById('expandedHeaders2NameColumn');

  // reset the minimum widths to 0 so that clientWidth will return the
  // preferred intrinsic width of each column
  nameColumn.minWidth = nameColumn2.minWidth = 0;

  // set minWidth on the smaller of the two columns to be the width of the
  // larger of the two
  if (nameColumn.clientWidth > nameColumn2.clientWidth) {
    nameColumn2.minWidth = nameColumn.clientWidth;
  } else if (nameColumn.clientWidth < nameColumn2.clientWidth) {
    nameColumn.minWidth = nameColumn2.clientWidth;
  }
}

// default method for updating a header value into a header entry
function updateHeaderValue(headerEntry, headerValue)
{
  headerEntry.enclosingBox.headerValue = headerValue;
}

/**
 * Create the DOM nodes (aka "View") for a non-standard header and insert them
 * into the grid.  Create and return the corresponding headerEntry object.
 *
 * @param {String} headerName  name of the header we're adding, all lower-case;
 *                             used to construct element ids
 * @param {String} label       name of the header as displayed in the UI
 */
function createNewHeaderView(headerName, label)
{
  var idName = 'expanded' + headerName + 'Box';

  // create new collapsed row
  let newRowNode = document.createElement("row");
  newRowNode.setAttribute("id", 'expanded' + headerName + 'Row');
  newRowNode.collapsed = true;

  // create and append the label which contains the header name
  let newLabelNode = document.createElement("label");
  newLabelNode.setAttribute("id", 'expanded' + headerName + 'Label');
  newLabelNode.setAttribute("value", label);
  newLabelNode.setAttribute("class", "headerName");
  newLabelNode.setAttribute("control", idName);
  newRowNode.appendChild(newLabelNode);

  // create and append the new header value
  var newHeaderNode = document.createElement("mail-headerfield");
  newHeaderNode.setAttribute('id', idName);
  newHeaderNode.setAttribute('flex', '1');

  newRowNode.appendChild(newHeaderNode);

  // this new element needs to be inserted into the view...
  let topViewNode = document.getElementById('expandedHeader2Rows');
  topViewNode.appendChild(newRowNode);

  this.enclosingBox = newHeaderNode;
  this.enclosingRow = newRowNode;
  this.isNewHeader = true;
  this.valid = false;
  this.useToggle = false;
  this.outputFunction = updateHeaderValue;
}

/**
 * Removes all non-predefined header nodes from the view.
 *
 * @param aHeaderTable Table of header entries.
 */
function RemoveNewHeaderViews(aHeaderTable)
{
  for each (let [, headerEntry] in Iterator(aHeaderTable))
  {
    if (headerEntry.isNewHeader)
      headerEntry.enclosingRow.parentNode.removeChild(headerEntry.enclosingRow);
  }
}

// UpdateExpandedMessageHeaders: Iterate through all the current header data
// we received from mime for this message for the expanded header entry table,
// and see if we have a corresponding entry for that header (i.e.
// whether the expanded header view cares about this header value)
// If so, then call updateHeaderEntry
function UpdateExpandedMessageHeaders() {
  // iterate over each header we received and see if we have a matching entry in each
  // header view table...
  var headerName;

  // Remove the height attr so that it redraws correctly. Works around a problem that
  // attachment-splitter causes if it's moved high enough to affect the header box:
  document.getElementById('msgHeaderView').removeAttribute('height');

  for (headerName in currentHeaderData) {
    var headerField = currentHeaderData[headerName];
    var headerEntry = null;

    if (headerName in gExpandedHeaderView)
        headerEntry = gExpandedHeaderView[headerName];

    if (!headerEntry && gViewAllHeaders) {
      // for view all headers, if we don't have a header field for this
      // value....cheat and create one....then fill in a headerEntry
      if (headerName == "message-id" || headerName == "in-reply-to") {
        var messageIdEntry = {
          name: headerName,
          outputFunction: OutputMessageIds
        };
        gExpandedHeaderView[headerName] = new createHeaderEntry('expanded',
                                                                messageIdEntry);
      }
      // Don't bother showing X-Mozilla-LocalizedDate, since that value is
      // displayed below the message header toolbar.
      else if (headerName != "x-mozilla-localizeddate") {
        gExpandedHeaderView[headerName] =
          new createNewHeaderView(headerName,
                                  currentHeaderData[headerName].headerName);
      }

      headerEntry = gExpandedHeaderView[headerName];
    }

    if (headerEntry) {
      if (headerName == "references" &&
          !(gViewAllHeaders || gHeadersShowReferences ||
            gFolderDisplay.view.isNewsFolder)) {
        // hide references header if view all headers mode isn't selected, the
        // pref show references is deactivated and the currently displayed
        // message isn't a newsgroup posting
        headerEntry.valid = false;
      }
      else
      {
        headerEntry.outputFunction(headerEntry, headerField.headerValue);
        headerEntry.valid = true;
      }
    }
  }

  let dateLabel = document.getElementById("dateLabel");
  if ("x-mozilla-localizeddate" in currentHeaderData) {
    document.getElementById("dateLabel").textContent =
      currentHeaderData["x-mozilla-localizeddate"].headerValue;
    dateLabel.collapsed = false;
  } else {
    dateLabel.collapsed = true;
  }

  gBuiltExpandedView = true;

  // now update the view to make sure the right elements are visible
  updateExpandedView();
}

function ClearCurrentHeaders()
{
  currentHeaderData = {};
  currentAttachments = new Array();
}

function ShowMessageHeaderPane()
{
  document.getElementById('msgHeaderView').collapsed = false;

  // We used to do this as a work-around for long-ago bug 39655
  // there apparently was a layout bug where the message pane
  // 'toolbar' was being hidden as a result of the folder change,
  // then re-shown, but the layout would glitch and not show it.
  // As much as I love cargo-culting, I am commenting this out
  // because I have great respect for our layout ninjas and little
  // respect for random global variables such as the one that
  // controlled this.
  //
  //var el = document.getElementById("msgHeaderView");
  //el.setAttribute("style", el.getAttribute("style"));
  //
}

function HideMessageHeaderPane()
{
  document.getElementById('msgHeaderView').collapsed = true;

  // disable the File/Attachments menuitem
  document.getElementById("fileAttachmentMenu").setAttribute("disabled", "true");
  // disable the attachment box
  document.getElementById("attachmentView").collapsed = true;
  document.getElementById("attachment-splitter").collapsed = true;

  ClearEditMessageBox();
}

/**
 * Take string of newsgroups separated by commas, split it
 * into newsgroups and send them to the corresponding
 * mail-newsgroups-headerfield element.
 *
 * @param headerEntry  the entry data structure for this header
 * @param headerValue  the string value for the header from the message
 */
function OutputNewsgroups(headerEntry, headerValue)
{
  headerValue.split(",").forEach(
    function(newsgroup) headerEntry.enclosingBox.addNewsgroupView(newsgroup));

  headerEntry.enclosingBox.buildViews();
}

// take string of message-ids separated by whitespace, split it
// into message-ids and send them together with the index number
// to the corresponding mail-messageids-headerfield element
function OutputMessageIds(headerEntry, headerValue)
{
  var messageIdArray = headerValue.split(/\s+/);

  headerEntry.enclosingBox.clearHeaderValues();
  for (var i = 0; i < messageIdArray.length; i++)
    headerEntry.enclosingBox.addMessageIdView(messageIdArray[i]);

  headerEntry.enclosingBox.fillMessageIdNodes();
}

// OutputEmailAddresses --> knows how to take a comma separated list of email addresses,
// extracts them one by one, linkifying each email address into a mailto url.
// Then we add the link-ified email address to the parentDiv passed in.
//
// emailAddresses --> comma separated list of the addresses for this header field

function OutputEmailAddresses(headerEntry, emailAddresses)
{
  if (!emailAddresses)
    return;

  var addresses = {};
  var fullNames = {};
  var names = {};
  var numAddresses =  0;

  var msgHeaderParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                                  .getService(Components.interfaces.nsIMsgHeaderParser);
  numAddresses = msgHeaderParser.parseHeadersWithArray(emailAddresses, addresses, names, fullNames);
  var index = 0;
  while (index < numAddresses)
  {
    // if we want to include short/long toggle views and we have a long view, always add it.
    // if we aren't including a short/long view OR if we are and we haven't parsed enough
    // addresses to reach the cutoff valve yet then add it to the default (short) div.
    var address = {};
    address.emailAddress = addresses.value[index];
    address.fullAddress = fullNames.value[index];
    address.displayName = names.value[index];
    if (headerEntry.useToggle)
      headerEntry.enclosingBox.addAddressView(address);
    else
      updateEmailAddressNode(headerEntry.enclosingBox.emailAddressNode, address);
    index++;
  }

  if (headerEntry.useToggle)
    headerEntry.enclosingBox.buildViews();
}

function updateEmailAddressNode(emailAddressNode, address)
{
  emailAddressNode.setAttribute("emailAddress", address.emailAddress);
  emailAddressNode.setAttribute("fullAddress", address.fullAddress);
  emailAddressNode.setAttribute("displayName", address.displayName);
  emailAddressNode.removeAttribute("tooltiptext");

  UpdateEmailNodeDetails(address.emailAddress, emailAddressNode);
}

/**
 * Take an email address and compose a sensible display name based on the
 * header display name and/or the display name from the address book. If no
 * appropriate name can be made (e.g. there is no card for this address),
 * returns |null|.
 *
 * @param aEmailAddress       the email address to format
 * @param aHeaderDisplayName  the display name from the header, if any
 * @param aContext            the field being formatted (e.g. "to", "from")
 * @param aCard               the address book card, if any
 * @return The formatted display name, or null
 */
function FormatDisplayName(aEmailAddress, aHeaderDisplayName, aContext, aCard)
{
  var displayName = null;
  var identity = getBestIdentity(accountManager.allIdentities, aEmailAddress);
  var card = aCard || getCardForEmail(aEmailAddress).card;

  // If this address is one of the user's identities...
  if (aEmailAddress == identity.email) {
    var bundle = document.getElementById("bundle_messenger");
    // ...pick a localized version of the word "Me" appropriate to this
    // specific header; fall back to the version used by the "to" header
    // if nothing else is available.
    try {
      displayName = bundle.getString("header" + aContext + "FieldMe");
    } catch (ex) {
      displayName = bundle.getString("headertoFieldMe");
    }

    // Make sure we have an unambiguous name if there are multiple identities
    if (accountManager.allIdentities.Count() > 1)
      displayName += " <"+identity.email+">";
  }

  // If we don't have a card, refuse to generate a display name. Places calling
  // this are then responsible for falling back to something else (e.g. the
  // value from the message header).
  if (card) {
    if (!displayName)
      displayName = aHeaderDisplayName;

    // getProperty may return a "1" or "0" string, we want a boolean
    if (!displayName || card.getProperty("PreferDisplayName", true) != false)
      displayName = card.displayName;
  }

  return displayName;
}

function UpdateEmailNodeDetails(aEmailAddress, aDocumentNode, aCardDetails) {
  // If we haven't been given specific details, search for a card.
  var cardDetails = aCardDetails ? aCardDetails :
                                   getCardForEmail(aEmailAddress);
  aDocumentNode.cardDetails = cardDetails;

  if (!cardDetails.card) {
    aDocumentNode.setAttribute("hascard", "false");
    aDocumentNode.setAttribute("tooltipstar",
      document.getElementById("addToAddressBookItem").label);
  }
  else {
    aDocumentNode.setAttribute("hascard", "true");
    aDocumentNode.setAttribute("tooltipstar",
      document.getElementById("editContactItem").label);
  }

  // When we are adding cards, we don't want to move the display around if the
  // user has clicked on the star, therefore if it is locked, just exit and
  // leave the display updates until later.
  if (aDocumentNode.hasAttribute("updatingUI"))
    return;

  var displayName = FormatDisplayName(aEmailAddress,
                                      aDocumentNode.getAttribute("displayName"),
                                      aDocumentNode.getAttribute("headerName"),
                                      aDocumentNode.cardDetails.card);

  if (gShowCondensedEmailAddresses && displayName) {
    aDocumentNode.setAttribute("label", displayName);
    aDocumentNode.setAttribute("tooltiptext", aEmailAddress);
  }
  else
    aDocumentNode.setAttribute("label",
      aDocumentNode.getAttribute("fullAddress") ||
      aDocumentNode.getAttribute("displayName"));
}

function UpdateExtraAddressProcessing(aAddressData, aDocumentNode, aAction,
                                      aParentDir, aItem)
{
  switch (aAction) {
  case nsIAbListener.itemChanged:
    if (aAddressData &&
        aDocumentNode.cardDetails.card &&
        aItem.hasEmailAddress(aAddressData.emailAddress)) {
      aDocumentNode.cardDetails.card = aItem;
      var displayName = FormatDisplayName(aAddressData.emailAddress,
                                          aDocumentNode.getAttribute("displayName"),
                                          aDocumentNode.getAttribute("headerName"),
                                          aDocumentNode.cardDetails.card);

      if (gShowCondensedEmailAddresses && displayName)
        aDocumentNode.setAttribute("label", displayName);
      else
        aDocumentNode.setAttribute("label",
                                   aDocumentNode.getAttribute("fullAddress") ||
                                   aDocumentNode.getAttribute("displayName"));
    }
    break;
  case nsIAbListener.itemAdded:
    // Is it a new address book?
    if (aItem instanceof Components.interfaces.nsIAbDirectory) {
      // If we don't have a match, search again for updates (e.g. a interface
      // to an existing book may just have been added).
      if (!aDocumentNode.cardDetails.card)
        UpdateEmailNodeDetails(aAddressData.emailAddress, aDocumentNode);
    }
    else if (aItem instanceof nsIAbCard) {
      // If we don't have a card, does this new one match?
      if (!aDocumentNode.cardDetails.card &&
          aItem.hasEmailAddress(aAddressData.emailAddress)) {
        // Just in case we have a bogus parent directory
        if (aParentDir instanceof Components.interfaces.nsIAbDirectory) {
          var cardDetails = { book: aParentDir, card: aItem };
          UpdateEmailNodeDetails(aAddressData.emailAddress, aDocumentNode,
                                 cardDetails);
        }
        else
          UpdateEmailNodeDetails(aAddressData.emailAddress, aDocumentNode);
      }
    }
    break;
  case nsIAbListener.directoryItemRemoved:
    // Unfortunately we don't necessarily get the same card object back.
    if (aAddressData &&
        aDocumentNode.cardDetails.card &&
        aDocumentNode.cardDetails.book == aParentDir &&
        aItem.hasEmailAddress(aAddressData.emailAddress)) {
      UpdateEmailNodeDetails(aAddressData.emailAddress, aDocumentNode);
    }
    break;
  case nsIAbListener.directoryRemoved:
    if (aDocumentNode.cardDetails.book == aItem)
      UpdateEmailNodeDetails(aAddressData.emailAddress, aDocumentNode);
    break;
  }
}

function findEmailNodeFromPopupNode(elt, popup)
{
  // This annoying little function is needed because in the binding for
  // mail-emailaddress, we set the context on the <description>, but that if
  // the user clicks on the label, then popupNode is set to it, rather than
  // the description.  So we have walk up the parent until we find the
  // element with the popup set, and then return its parent.

  while (elt.getAttribute("popup") != popup)
  {
    elt = elt.parentNode;
    if (elt == null)
      return null;
  }
  return elt.parentNode;
}

function hideEmailNewsPopup(addressNode)
{
  // highlight the emailBox/newsgroupBox
  addressNode.removeAttribute('selected');
}

function setupEmailAddressPopup(emailAddressNode)
{
  var emailAddressPlaceHolder = document.getElementById('emailAddressPlaceHolder');
  var emailAddress = emailAddressNode.getPart('emaillabel').value;
  emailAddressNode.setAttribute('selected', 'true');
  emailAddressPlaceHolder.setAttribute('label', emailAddress);

  if (emailAddressNode.cardDetails.card) {
    document.getElementById('addToAddressBookItem').setAttribute('hidden', true);
    if (!emailAddressNode.cardDetails.book.readOnly) {
      document.getElementById('editContactItem').removeAttribute('hidden');
      document.getElementById('viewContactItem').setAttribute('hidden', true);
    }
    else {
      document.getElementById('editContactItem').setAttribute('hidden', true);
      document.getElementById('viewContactItem').removeAttribute('hidden');
    }
  }
  else {
    document.getElementById('addToAddressBookItem').removeAttribute('hidden');
    document.getElementById('editContactItem').setAttribute('hidden', true);
    document.getElementById('viewContactItem').setAttribute('hidden', true);
  }
}

// Returns an object with two properties, book and card. If the email address
// is found in the address books, then it book will contain an nsIAbDirectory,
// and card will contain an nsIAbCard. If the email address is not found, both
// items will contain null.
function getCardForEmail(emailAddress)
{
  // Email address is searched for in any of the address books that support
  // the cardForEmailAddress function.
  // Future expansion could be to domain matches

  var books = Components.classes["@mozilla.org/abmanager;1"]
                        .getService(Components.interfaces.nsIAbManager)
                        .directories;

  var result = { book: null, card: null };

  while (!result.card && books.hasMoreElements()) {
    var ab = books.getNext()
                  .QueryInterface(Components.interfaces.nsIAbDirectory);
    try {
      var card = ab.cardForEmailAddress(emailAddress);
      if (card) {
        result.book = ab;
        result.card = card;
      }
    }
    catch (ex) { }
  }

  return result;
}

function onClickEmailStar(event, emailAddressNode)
{
  // Only care about left-click events
  if (event.button != 0)
    return;

  if (emailAddressNode && emailAddressNode.cardDetails &&
      emailAddressNode.cardDetails.card)
    EditContact(emailAddressNode);
  else
    AddContact(emailAddressNode);
}

/**
 * Takes the email address node, adds a new contact from the node's
 * displayName and emailAddress attributes to the personal address book.
 * @param emailAddressNode a node with displayName and emailAddress attributes
 */
function AddContact(emailAddressNode)
{
  // When we collect an address, it updates the AB which sends out
  // notifications to update the UI. In the add case we don't want to update
  // the UI so that accidentally double-clicking on the star doesn't lead
  // to something strange (i.e star would be moved out from underneath,
  // leaving something else there).
  emailAddressNode.setAttribute("updatingUI", true);

  let abManager = Components.classes["@mozilla.org/abmanager;1"]
                            .getService(Components.interfaces.nsIAbManager);
  const kPersonalAddressbookURI = "moz-abmdbdirectory://abook.mab";
  let addressBook = abManager.getDirectory(kPersonalAddressbookURI);

  let card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                       .createInstance(Components.interfaces.nsIAbCard);
  card.displayName = emailAddressNode.getAttribute("displayName");
  card.primaryEmail = emailAddressNode.getAttribute("emailAddress");

  // Just save the new node straight away.
  addressBook.addCard(card);

  emailAddressNode.removeAttribute("updatingUI");
}

function EditContact(emailAddressNode)
{
  if (emailAddressNode.cardDetails.card)
    editContactInlineUI.showEditContactPanel(emailAddressNode.cardDetails,
                                             emailAddressNode);
}

/**
 * Takes the email address title button, extracts the email address we stored
 * in there and opens a compose window with that address.
 * @param addressNode a node which has a "fullAddress" or "newsgroup" attribute
 */
function SendMailToNode(addressNode)
{
  let fields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                         .createInstance(Components.interfaces.nsIMsgCompFields);
  let params = Components.classes["@mozilla.org/messengercompose/composeparams;1"]
                         .createInstance(Components.interfaces.nsIMsgComposeParams);

  fields.newsgroups = addressNode.getAttribute("newsgroup");
  fields.to = addressNode.getAttribute("fullAddress");

  params.type = Components.interfaces.nsIMsgCompType.New;
  params.format = Components.interfaces.nsIMsgCompFormat.Default;
  if (gFolderDisplay.displayedFolder) {
    params.identity = accountManager.getFirstIdentityForServer(
                        gFolderDisplay.displayedFolder.server);
  }
  params.composeFields = fields;
  msgComposeService.OpenComposeWindowWithParams(null, params);
}

/**
 * Takes the email address or newsgroup title button, extracts the address/name
 * we stored in there and copies it to the clipboard.
 *
 * @param addressNode  a node which has an "emailAddress" or "newsgroup"
 *                     attribute
 */
function CopyEmailNewsAddress(addressNode)
{
  let clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                            .getService(Components.interfaces.nsIClipboardHelper);
  let address = addressNode.getAttribute("emailAddress") ||
                addressNode.getAttribute("newsgroup");
  clipboard.copyString(address);
}

/**
 * Causes the filter dialog to pop up, prefilled for the specified e-mail
 * address.
 * @param emailAddressNode a node which has an "emailAddress" attribute
 */
function CreateFilter(emailAddressNode)
{
  let emailAddress = emailAddressNode.getAttribute("emailAddress");
  top.MsgFilters(emailAddress, GetFirstSelectedMsgFolder());
}

/**
 * Get the newsgroup server corresponding to the currently selected message.
 *
 * @return nsISubscribableServer for the newsgroup, or null
 */
function GetNewsgroupServer()
{
  if (gFolderDisplay.selectedMessageIsNews)
  {
    let server = gFolderDisplay.selectedMessage.folder.server;
    if (server)
        return server.QueryInterface(Components.interfaces.nsISubscribableServer);
  }
  return null;
}

/**
 * Initialize the newsgroup popup, showing/hiding menu items as appropriate.
 *
 * @param newsgroupNode a node which has a "newsgroup" attribute
 */
function setupNewsgroupPopup(newsgroupNode)
{
  let newsgroupPlaceHolder = document.getElementById('newsgroupPlaceHolder');
  let newsgroup = newsgroupNode.getAttribute('newsgroup');
  newsgroupNode.setAttribute('selected', 'true');
  newsgroupPlaceHolder.setAttribute('label', newsgroup);

  let server = GetNewsgroupServer();
  if (server)
  {
    // XXX Why is this necessary when nsISubscribableServer contains
    // |isSubscribed|?
    server = server.QueryInterface(Components.interfaces.nsINntpIncomingServer);
    if (!server.containsNewsgroup(newsgroup))
    {
      document.getElementById('subscribeToNewsgroupItem').removeAttribute('hidden');
      document.getElementById('subscribeToNewsgroupSeparator').removeAttribute('hidden');
      return;
    }
  }
  document.getElementById('subscribeToNewsgroupItem').setAttribute('hidden',
                                                                   true);
  document.getElementById('subscribeToNewsgroupSeparator').setAttribute('hidden', true);
}

/**
 * Subscribe to a newsgroup based on the newsgroup title button
 *
 * @param newsgroupNode a node which has a "newsgroup" attribute
 */
function SubscribeToNewsgroup(newsgroupNode)
{
  let server = GetNewsgroupServer();
  if (server)
  {
    let newsgroup = newsgroupNode.getAttribute('newsgroup');
    server.subscribe(newsgroup);
    server.commitSubscribeChanges();
  }
}

/**
 * Takes the newsgroup address title button, extracts the newsgroup name we
 * stored in there and copies it to the clipboard.
 *
 * @param newsgroupNode a node which has a "newsgroup" attribute
 */
function CopyNewsgroupName(newsgroupNode)
{
  let clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                            .getService(Components.interfaces.nsIClipboardHelper);
  clipboard.copyString(newsgroupNode.getAttribute("newsgroup"));
}

/**
 * Takes the newsgroup address title button, extracts the newsgroup name we
 * stored in there and copies it URL to it.
 *
 * @param newsgroupNode a node which has a "newsgroup" attribute
 */
function CopyNewsgroupURL(newsgroupNode)
{
  let server = GetNewsgroupServer();
  if (!server)
    return;

  let ng = newsgroupNode.getAttribute("newsgroup");

  // TODO let backend construct URL and return as attribute
  let url;
  if (server.socketType != Components.interfaces.nsMsgSocketType.SSL) {
    url = "news://" + server.hostName;
    if (server.port != Components.interfaces.nsINntpUrl.DEFAULT_NNTP_PORT)
      url += ":" + server.port;
    url += "/" + ng;
  }
  else {
    url = "snews://" + server.hostName;
    if (server.port != Components.interfaces.nsINntpUrl.DEFAULT_NNTPS_PORT)
      url += ":" + server.port;
    url += "/" + ng;
  }
  let clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                            .getService(Components.interfaces.nsIClipboardHelper);
  clipboard.copyString(decodeURI(url));
}

/**
 * Create a new attachment object which goes into the data attachment array.
 * This method checks whether the passed attachment is empty or not.
 *
 * @param contentType The attachment's mimetype
 * @param url The URL for the attachment
 * @param name The name to be displayed for this attachment (usually the
          filename)
 * @param uri The URI for the message containing the attachment
 * @param isExternalAttachment True if the attachment has been detached
 * @param size The size in bytes of the attachment
 */
function AttachmentInfo(contentType, url, name, uri,
                        isExternalAttachment, size)
{
  this.contentType = contentType;
  this.url = url;
  this.name = name;
  this.uri = uri;
  this.isExternalAttachment = isExternalAttachment;
  this.size = size;
}

AttachmentInfo.prototype = {
  /**
   * Save this attachment to a file.
   */
  save: function AttachmentInfo_save()
  {
    messenger.saveAttachment(this.contentType, this.url,
                             encodeURIComponent(this.name),
                             this.uri, this.isExternalAttachment);
  },

  /**
   * Open this attachment.
   */
  open: function AttachmentInfo_open()
  {
    if (!this.hasFile)
      return;

    if (this.isEmpty) {
      var prompt = document.getElementById("bundle_messenger")
                           .getString("emptyAttachment");
      msgWindow.promptDialog.alert(null, prompt);
    }
    else {
      messenger.openAttachment(this.contentType, this.url,
                               encodeURIComponent(this.name),
                               this.uri, this.isExternalAttachment);
    }
  },

  /**
   * Detach this attachment from the message.
   *
   * @param aSaveFirst true if the attachment should be saved before detaching,
   *                   false otherwise
   */
  detach: function AttachmentInfo_detach(aSaveFirst)
  {
    messenger.detachAttachment(this.contentType, this.url,
                               encodeURIComponent(this.name),
                               this.uri, aSaveFirst);
  },

  /**
   * This method checks whether the attachment has been deleted or not.
   *
   * @return true if the attachment has been deleted, false otherwise
   */
  get isDeleted()
  {
    return this.contentType == "text/x-moz-deleted";
  },

  /**
   * This method checks whether the attachment has an associated file or not.
   * Deleted attachments or detached attachments with missing external files
   * do *not* have a file.
   *
   * @return true if the attachment has an associated file, false otherwise
   */
  get hasFile()
  {
    if (this.isDeleted)
      return false;
    if (this.isExternalAttachment && /^file:/.test(this.url) &&
        this.size === null)
      return false;

    return true;
  },

  /**
   * This method checks whether the attachment is empty or not.
   *
   * @return true if the attachment is empty, false otherwise
   */
  get isEmpty()
  {
    // Create an input stream on the attachment url.
    let url = Services.io.newURI(this.url, null, null);
    let stream = Services.io.newChannelFromURI(url).open();

    let inputStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                                .createInstance(Components.interfaces.nsIBinaryInputStream);
    inputStream.setInputStream(stream);

    let bytesAvailable = 0;

    if (inputStream.isNonBlocking()) {
      // If the stream does not block, test on two conditions:
      //   - attachment is empty     -> 0 bytes will be returned on readBytes()
      //   - attachment is not empty -> NS_BASE_STREAM_WOULD_BLOCK exception is
      //                                thrown
      let chunk = null;

      try {
        chunk = inputStream.readBytes(1);
      } catch (ex if ex.result == Components.results
                                            .NS_BASE_STREAM_WOULD_BLOCK) {
        bytesAvailable = 1;
      }
      if (chunk)
        bytesAvailable = chunk.length;
    }
    else {
      // If the stream blocks, we can rely on available() to return the correct
      // number.
      bytesAvailable = inputStream.available();
    }

    return (bytesAvailable == 0);
  },
};

/**
 * Return true if possible attachments in the currently loaded message can be
 * deleted/detached.
 */
function CanDetachAttachments()
{
  var canDetach = !gFolderDisplay.selectedMessageIsNews &&
                  (!gFolderDisplay.selectedMessageIsImap || MailOfflineMgr.isOnline());
  if (canDetach && ("content-type" in currentHeaderData))
    canDetach = !ContentTypeIsSMIME(currentHeaderData["content-type"].headerValue);
  return canDetach;
}

/** Return true if the content type is an S/MIME one. */
function ContentTypeIsSMIME(contentType)
{
  // S/MIME is application/pkcs7-mime and application/pkcs7-signature
  // - also match application/x-pkcs7-mime and application/x-pkcs7-signature.
  return /application\/(x-)?pkcs7-(mime|signature)/.test(contentType);
}

/**
 * Set up the attachment item context menu, showing or hiding the appropriate
 * menu items.
 */
function onShowAttachmentItemContextMenu()
{
  let attachmentList = document.getElementById("attachmentList");
  let attachmentInfo = document.getElementById("attachmentInfo");
  let attachmentName = document.getElementById("attachmentName");
  let contextMenu    = document.getElementById("attachmentItemContext");
  let openMenu       = document.getElementById("context-openAttachment");
  let saveMenu       = document.getElementById("context-saveAttachment");
  let detachMenu     = document.getElementById("context-detachAttachment");
  let deleteMenu     = document.getElementById("context-deleteAttachment");

  // If we opened the context menu from the attachment info area (the paperclip,
  // "1 attachment" label, filename, or file size, just grab the first (and
  // only) attachment as our "selected" attachments.
  var selectedAttachments;
  if (contextMenu.triggerNode == attachmentInfo ||
      contextMenu.triggerNode.parentNode == attachmentInfo) {
    selectedAttachments = [attachmentList.getItemAtIndex(0).attachment];
    if (contextMenu.triggerNode == attachmentName)
      attachmentName.setAttribute("selected", true);
  }
  else
    selectedAttachments = [item.attachment for each([, item] in
                           Iterator(attachmentList.selectedItems))];
  contextMenu.attachments = selectedAttachments;

  var allSelectedDetached = selectedAttachments.every(function(attachment) {
    return attachment.isExternalAttachment;
  });
  var allSelectedDeleted = selectedAttachments.every(function(attachment) {
    return !attachment.hasFile;
  });
  var canDetachSelected = CanDetachAttachments() && !allSelectedDetached &&
                          !allSelectedDeleted;

  openMenu.disabled = allSelectedDeleted;
  saveMenu.disabled = allSelectedDeleted;
  detachMenu.disabled = !canDetachSelected;
  deleteMenu.disabled = !canDetachSelected;
}

/**
 * Close the attachment item context menu, performing any cleanup as necessary.
 */
function onHideAttachmentItemContextMenu()
{
  let attachmentName = document.getElementById("attachmentName");
  let contextMenu = document.getElementById("attachmentItemContext");

  // If we opened the context menu from the attachmentName label, we need to
  // get rid of the "selected" attribute.
  if (contextMenu.triggerNode == attachmentName)
    attachmentName.removeAttribute("selected");
}

/**
 * Set up the attachment list context menu, showing or hiding the appropriate
 * menu items.
 */
function onShowAttachmentListContextMenu()
{
  var openAllMenu   = document.getElementById("context-openAllAttachments");
  var saveAllMenu   = document.getElementById("context-saveAllAttachments");
  var detachAllMenu = document.getElementById("context-detachAllAttachments");
  var deleteAllMenu = document.getElementById("context-deleteAllAttachments");

  var allDetached = currentAttachments.every(function(attachment) {
    return attachment.isExternalAttachment;
  });
  var allDeleted = currentAttachments.every(function(attachment) {
    return !attachment.hasFile;
  });
  var canDetachAll = CanDetachAttachments() && !allDetached && !allDeleted;

  saveAllMenu.disabled = allDeleted;
  openAllMenu.disabled = allDeleted;
  detachAllMenu.disabled = !canDetachAll;
  deleteAllMenu.disabled = !canDetachAll;
}

/**
 * Enable/disable menu items as appropriate for the single-attachment save all
 * toolbar button.
 */
function onShowSaveAttachmentMenuSingle()
{
  let openItem   = document.getElementById('button-openAttachment');
  let saveItem   = document.getElementById('button-saveAttachment');
  let detachItem = document.getElementById('button-detachAttachment');
  let deleteItem = document.getElementById('button-deleteAttachment');

  let detached = currentAttachments[0].isExternalAttachment;
  let deleted  = !currentAttachments[0].hasFile;
  let canDetach = CanDetachAttachments() && !deleted && !detached;

  openItem.disabled = deleted;
  saveItem.disabled = deleted;
  detachItem.disabled = !canDetach;
  deleteItem.disabled = !canDetach;
}

/**
 * Enable/disable menu items as appropriate for the multiple-attachment save all
 * toolbar button.
 */
function onShowSaveAttachmentMenuMultiple()
{
  let openAllItem   = document.getElementById('button-openAllAttachments');
  let saveAllItem   = document.getElementById('button-saveAllAttachments');
  let detachAllItem = document.getElementById('button-detachAllAttachments');
  let deleteAllItem = document.getElementById('button-deleteAllAttachments');

  let allDetached = currentAttachments.every(function(attachment) {
    return attachment.isExternalAttachment;
  });
  let allDeleted = currentAttachments.every(function(attachment) {
    return !attachment.hasFile;
  });
  let canDetach = CanDetachAttachments() && !allDeleted && !allDetached;

  openAllItem.disabled = allDeleted;
  saveAllItem.disabled = allDeleted;
  detachAllItem.disabled = !canDetach;
  deleteAllItem.disabled = !canDetach;
}

function MessageIdClick(node, event)
{
  if (event.button == 0)
  {
    var messageId = GetMessageIdFromNode(node, true);
    OpenMessageForMessageId(messageId);
  }
}

/**
 * This is our oncommand handler for the attachment list items. A double click
 * or enter press in an attachmentitem simulates "opening" the attachment.
 *
 * @param event the event object
 */
function attachmentItemCommand(event)
{
  HandleSelectedAttachments("open");
}

var AttachmentListController =
{
  supportsCommand: function(command)
  {
    switch (command)
    {
      case "cmd_selectAll":
      case "cmd_delete":
      case "cmd_shiftDelete":
      case "cmd_saveAsFile":
        return true;
      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    switch (command)
    {
      case "cmd_selectAll":
      case "cmd_delete":
      case "cmd_shiftDelete":
      case "cmd_saveAsFile":
        return true;
      default:
        return false;
    }
  },

  doCommand: function(command)
  {
    // If the user invoked a key short cut then it is possible that we got here
    // for a command which is really disabled. kick out if the command should
    // be disabled.
    if (!this.isCommandEnabled(command)) return;

    var attachmentList = document.getElementById('attachmentList');

    switch (command)
    {
      case "cmd_selectAll":
        attachmentList.selectAll();
        return;
      case "cmd_delete":
      case "cmd_shiftDelete":
        HandleSelectedAttachments('delete');
        return;
      case "cmd_saveAsFile":
        HandleSelectedAttachments('saveAs');
        return;
    }
  },

  onEvent: function(event)
  {}
};

function displayAttachmentsForExpandedView()
{
  var bundle = document.getElementById("bundle_messenger");
  var numAttachments = currentAttachments.length;
  var totalSize = 0;
  var attachmentView = document.getElementById("attachmentView");
  var attachmentSplitter = document.getElementById("attachment-splitter");

  if (numAttachments <= 0) {
    attachmentView.collapsed = true;
    attachmentSplitter.collapsed = true;
  }
  else if (!gBuildAttachmentsForCurrentMsg) {
    attachmentView.collapsed = false;

    var attachmentList = document.getElementById("attachmentList");

    var viewMode = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch2)
                             .getIntPref("mailnews.attachments.display.view");
    var views = ["small", "large", "tile"];
    attachmentList.view = views[viewMode];
    attachmentList.controllers.appendController(AttachmentListController);

    toggleAttachmentList(false);

    var unknownSize = false;
    for each (let [, attachment] in Iterator(currentAttachments)) {
      // Create a new attachment widget
      var displayName = SanitizeAttachmentDisplayName(attachment);
      var item = attachmentList.appendItem(attachment, displayName);
      item.setAttribute("tooltiptext", attachment.name);
      item.addEventListener("command", attachmentItemCommand, false);

      if (attachment.size !== null)
        totalSize += attachment.size;
      else if (!attachment.isDeleted)
        unknownSize = true;
    }

    // Show the appropriate toolbar button and label based on the number of
    // attachments.
    updateSaveAllAttachmentsButton();

    let attachmentInfo = document.getElementById("attachmentInfo");
    let attachmentCount = document.getElementById("attachmentCount");
    let attachmentName = document.getElementById("attachmentName");
    let attachmentSize = document.getElementById("attachmentSize");

    if (numAttachments == 1) {
      let count = bundle.getString("attachmentCountSingle");
      let name = SanitizeAttachmentDisplayName(currentAttachments[0]);

      attachmentInfo.setAttribute("contextmenu", "attachmentItemContext");
      attachmentCount.setAttribute("value", count);
      attachmentName.hidden = false;
      attachmentName.setAttribute("value", name);
    }
    else {
      let words = bundle.getString("attachmentCount");
      let count = PluralForm.get(currentAttachments.length, words)
                            .replace("#1", currentAttachments.length);

      attachmentInfo.setAttribute("contextmenu", "attachmentListContext");
      attachmentCount.setAttribute("value", count);
      attachmentName.hidden = true;
    }

    let sizeStr = messenger.formatFileSize(totalSize);
    if (unknownSize) {
      if (totalSize == 0)
        sizeStr = bundle.getString("attachmentSizeUnknown");
      else
        sizeStr = bundle.getFormattedString("attachmentSizeAtLeast", [sizeStr]);
    }
    attachmentSize.setAttribute("value", sizeStr);

    gBuildAttachmentsForCurrentMsg = true;
  }
}

/**
 * Update the "save all attachments" button in the attachment pane, showing
 * the proper button and enabling/disabling it as appropriate.
 */
function updateSaveAllAttachmentsButton()
{
  let saveAllSingle   = document.getElementById("attachmentSaveAllSingle");
  let saveAllMultiple = document.getElementById("attachmentSaveAllMultiple");

  // If we can't find the buttons, they're not on the toolbar, so bail out!
  if (!saveAllSingle || !saveAllMultiple)
    return;

  let allDeleted = currentAttachments.every(function(attachment) {
    return !attachment.hasFile;
  });
  let single = (currentAttachments.length == 1);

  saveAllSingle.hidden = !single;
  saveAllMultiple.hidden = single;
  saveAllSingle.disabled = saveAllMultiple.disabled = allDeleted;
}

/**
 * Expand/collapse the attachment list. When expanding it, automatically resize
 * it to an appropriate height (1/4 the message pane or smaller).
 *
 * @param expanded True if the attachment list should be expanded, false
 *                 otherwise. If |expanded| is not specified, toggle the state.
 * @param updateFocus (optional) True if the focus should be updated, focusing
 *                    on the attachmentList when expanding, or the messagepane
 *                    when collapsing (but only when the attachmentList was
 *                    originally focused).
 */
function toggleAttachmentList(expanded, updateFocus)
{
  var attachmentView = document.getElementById("attachmentView");
  var attachmentBar = document.getElementById("attachmentBar");
  var attachmentToggle = document.getElementById("attachmentToggle");
  var attachmentList = document.getElementById("attachmentList");
  var attachmentSplitter = document.getElementById("attachment-splitter");
  var bundle = document.getElementById("bundle_messenger");

  if (expanded === undefined)
    expanded = !attachmentToggle.checked;
  attachmentToggle.checked = expanded;

  if (expanded) {
    attachmentList.collapsed = false;
    attachmentSplitter.collapsed = false;
    attachmentBar.setAttribute("tooltiptext", bundle.getString(
      "collapseAttachmentPaneTooltip"));

    attachmentList.setOptimumWidth();

    var attachmentHeight = attachmentView.boxObject.height -
      attachmentList.boxObject.height + attachmentList.preferredHeight;

    // If the attachments box takes up too much of the message pane, downsize:
    var maxAttachmentHeight = document.getElementById("messagepanebox")
                                      .boxObject.height / 4;

    attachmentView.setAttribute("height", Math.min(attachmentHeight,
                                                   maxAttachmentHeight));
    attachmentView.setAttribute("maxheight", attachmentHeight);

    if (updateFocus)
      attachmentList.focus();
  }
  else {
    attachmentList.collapsed = true;
    attachmentSplitter.collapsed = true;
    attachmentBar.setAttribute("tooltiptext", bundle.getString(
      "expandAttachmentPaneTooltip"));
    attachmentView.removeAttribute("height");
    attachmentView.removeAttribute("maxheight");

    if (updateFocus && document.activeElement == attachmentList)
      SetFocusMessagePane();
  }
}

/**
 * Pick out a nice icon for the attachment.
 * @param attachment the nsIMsgAttachment object to show icon for
 */
function getIconForAttachment(attachment)
{
  if (attachment.isDeleted)
    return "chrome://messenger/skin/icon/attachment-deleted.png";
  else
    return "moz-icon://" + attachment.name + "?size=16&amp;contentType=" +
           attachment.contentType;
}

// Public method called when we create the attachments file menu
function FillAttachmentListPopup(popup)
{
  // the FE sometimes call this routine TWICE...I haven't been able to figure out why yet...
  // protect against it...
  if (!gBuildAttachmentPopupForCurrentMsg)
    return;

  // otherwise we need to build the attachment view...
  // First clear out the old view...
  ClearAttachmentMenu(popup);

  for each (let [attachmentIndex, attachment] in Iterator(currentAttachments))
    addAttachmentToPopup(popup, attachment, attachmentIndex);

  gBuildAttachmentPopupForCurrentMsg = false;

  var allDetached = currentAttachments.every(function(attachment) {
    return attachment.isExternalAttachment;
  });
  var allDeleted = currentAttachments.every(function(attachment) {
    return !attachment.hasFile;
  });
  var canDetachAll = CanDetachAttachments() && !allDetached && !allDeleted;

  var openAllMenu = document.getElementById('file-openAllAttachments');
  var saveAllMenu = document.getElementById('file-saveAllAttachments');
  var detachAllMenu = document.getElementById('file-detachAllAttachments');
  var deleteAllMenu = document.getElementById('file-deleteAllAttachments');

  saveAllMenu.disabled = allDeleted;
  openAllMenu.disabled = allDeleted;
  detachAllMenu.disabled = !canDetachAll;
  deleteAllMenu.disabled = !canDetachAll;
}

// Public method used to clear the file attachment menu
function ClearAttachmentMenu(popup)
{
  if ( popup )
  {
     while ( popup.childNodes[0].localName == 'menu' )
       popup.removeChild(popup.childNodes[0]);
  }
}

/**
 * Create a menu for a single attachment.
 *
 * @param popup the popup to add the menu to
 * @param attachment the AttachmentInfo object to add
 * @param attachmentIndex the index (starting at 0) of this attachment
 */
function addAttachmentToPopup(popup, attachment, attachmentIndex)
{
  if (!popup)
    return;

  var item = document.createElement('menu');
  if (!item)
    return;

  function getString(aName) {
    return document.getElementById("bundle_messenger").getString(aName);
  }

  // Insert the item just before the separator. The separator is the 2nd to
  // last element in the popup.
  item.setAttribute('class', 'menu-iconic');
  item.setAttribute('image', getIconForAttachment(attachment));

  var numItemsInPopup = popup.childNodes.length;
  // find the separator
  var indexOfSeparator = 0;
  while (popup.childNodes[indexOfSeparator].localName != 'menuseparator')
    indexOfSeparator++;

  var displayName = SanitizeAttachmentDisplayName(attachment);
  var label = document.getElementById("bundle_messenger")
                      .getFormattedString("attachmentDisplayNameFormat",
                                          [attachmentIndex, displayName]);
  item.setAttribute("crop", "center");
  item.setAttribute("label", label);
  item.setAttribute('accesskey', attachmentIndex);

  // Each attachment in the list gets its own menupopup with options for
  // saving, deleting, detaching, etc.
  var openpopup = document.createElement('menupopup');
  openpopup = item.appendChild(openpopup);

  // Due to Bug #314228, we must append our menupopup to the new attachment
  // menu item before we inserting the attachment menu into the popup. If we
  // don't, our attachment menu items will not show up.
  item = popup.insertBefore(item, popup.childNodes[indexOfSeparator]);

  var detached = attachment.isExternalAttachment;
  var deleted  = !attachment.hasFile;
  var canDetach = CanDetachAttachments() && !deleted && !detached;

  if (deleted) {
    // We can't do anything with a deleted attachment, so just return.
    item.disabled = true;
    return;
  }

  // Create the "open" menu item
  var menuitementry = document.createElement('menuitem');
  menuitementry.attachment = attachment;
  menuitementry.setAttribute('oncommand', 'this.attachment.open();');
  menuitementry.setAttribute('label', getString("openLabel"));
  menuitementry.setAttribute('accesskey', getString("openLabelAccesskey"));
  menuitementry.setAttribute('disabled', deleted);
  menuitementry = openpopup.appendChild(menuitementry);

  // Create a menuseparator
  var menuseparator = document.createElement('menuseparator');
  openpopup.appendChild(menuseparator);

  // Create the "save" menu item
  menuitementry = document.createElement('menuitem');
  menuitementry.attachment = attachment;
  menuitementry.setAttribute('oncommand', 'this.attachment.save();');
  menuitementry.setAttribute('label', getString("saveLabel"));
  menuitementry.setAttribute('accesskey', getString("saveLabelAccesskey"));
  menuitementry.setAttribute('disabled', deleted);
  menuitementry = openpopup.appendChild(menuitementry);

  // Create the "detach" menu item
  menuitementry = document.createElement('menuitem');
  menuitementry.attachment = attachment;
  menuitementry.setAttribute('oncommand', 'this.attachment.detach(true);');
  menuitementry.setAttribute('label', getString("detachLabel"));
  menuitementry.setAttribute('accesskey', getString("detachLabelAccesskey"));
  menuitementry.setAttribute('disabled', !canDetach);
  menuitementry = openpopup.appendChild(menuitementry);

  // Create the "delete" menu item
  menuitementry = document.createElement('menuitem');
  menuitementry.attachment = attachment;
  menuitementry.setAttribute('oncommand', 'this.attachment.detach(false);');
  menuitementry.setAttribute('label', getString("deleteLabel"));
  menuitementry.setAttribute('accesskey', getString("deleteLabelAccesskey"));
  menuitementry.setAttribute('disabled', !canDetach);
  menuitementry = openpopup.appendChild(menuitementry);
}

/**
 * Handle all the attachments in this message (save them, open them, etc).
 *
 * @param action one of "open", "save", "saveAs", "detach", or "delete"
 */
function HandleAllAttachments(action)
{
  HandleMultipleAttachments(currentAttachments, action);
}

/**
 * Try to handle all the attachments in this message (save them, open them,
 * etc). If the action fails for whatever reason, catch the error and report it.
 *
 * @param action one of "open", "save", "saveAs", "detach", or "delete"
 */
function TryHandleAllAttachments(action)
{
  try {
    HandleAllAttachments(action)
  }
  catch (e) {
    Components.utils.reportError(e);
  }
}

/**
 * Handle the currently-selected attachments in this message (save them, open
 * them, etc).
 *
 * @param action one of "open", "save", "saveAs", "detach", or "delete"
 */
function HandleSelectedAttachments(action)
{
  var attachmentList = document.getElementById('attachmentList');
  var selectedAttachments = [];
  for (var i in attachmentList.selectedItems)
    selectedAttachments.push(attachmentList.selectedItems[i].attachment);

  HandleMultipleAttachments(selectedAttachments, action);
}

/**
 * Perform an action on multiple attachments (e.g. open or save)
 *
 * @param attachments an array of AttachmentInfo objects to work with
 * @param action one of "open", "save", "saveAs", "detach", or "delete"
 */
function HandleMultipleAttachments(attachments, action)
{
  // convert our attachment data into some c++ friendly structs
  var attachmentContentTypeArray = [];
  var attachmentUrlArray = [];
  var attachmentDisplayNameArray = [];
  var attachmentMessageUriArray = [];

  // populate these arrays..
  var actionIndex = 0;
  for each(let [, attachment] in Iterator(attachments))
  {
    // Exclude attachment which are 1) deleted, or 2) detached with missing
    // external files.
    if (!attachment.hasFile)
      continue;
    attachmentContentTypeArray[actionIndex] = attachment.contentType;
    attachmentUrlArray[actionIndex] = attachment.url;
    attachmentDisplayNameArray[actionIndex] = encodeURI(attachment.name);
    attachmentMessageUriArray[actionIndex] = attachment.uri;
    ++actionIndex;
  }

  // The list has been built. Now call our action code...
  switch (action)
  {
    case "save":
      messenger.saveAllAttachments(attachmentContentTypeArray.length,
                                   attachmentContentTypeArray,
                                   attachmentUrlArray,
                                   attachmentDisplayNameArray,
                                   attachmentMessageUriArray);
      return;
    case "detach":
      // 'detach' on a multiple selection of attachments is so far not really
      // supported. As a workaround, resort to normal detach-'all'. See also
      // the comment on 'detaching a multiple selection of attachments' below.
      if (attachments.length == 1)
        attachments[0].detach(true);
      else
        messenger.detachAllAttachments(attachmentContentTypeArray.length,
                                       attachmentContentTypeArray,
                                       attachmentUrlArray,
                                       attachmentDisplayNameArray,
                                       attachmentMessageUriArray,
                                       true); // save
      return;
    case "delete":
      messenger.detachAllAttachments(attachmentContentTypeArray.length,
                                     attachmentContentTypeArray,
                                     attachmentUrlArray,
                                     attachmentDisplayNameArray,
                                     attachmentMessageUriArray,
                                     false); // don't save
      return;
    case "open":
    case "saveAs":
      // XXX hack alert. If we sit in tight loop and open/save multiple
      // attachments, we get chrome errors in layout as we start loading the
      // first helper app dialog then before it loads, we kick off the next
      // one and the next one. Subsequent helper app dialogs were failing
      // because we were still loading the chrome files for the first attempt
      // (error about the xul cache being empty). For now, work around this by
      // doing the first helper app dialog right away, then waiting a bit
      // before we launch the rest.

      var actionFunction = null;
      if (action == "open")
        actionFunction = function(aAttachment) { aAttachment.open(); };
      else
        actionFunction = function(aAttachment) { aAttachment.save(); };

      for (var i = 0; i < attachments.length; i++)
      {
        if (i == 0)
          actionFunction(attachments[i]);
        else
          setTimeout(actionFunction, 100, attachments[i]);
      }
      return;
    default:
      throw new Error("unknown HandleMultipleAttachments action: " + action);
  }
}

function ClearAttachmentList()
{
  // we also have to disable the File/Attachments menuitem
  var node = document.getElementById("fileAttachmentMenu");
  if (node)
    node.setAttribute("disabled", "true");

  // clear selection
  var list = document.getElementById('attachmentList');
  list.selectedItems.length = 0;

  while (list.hasChildNodes())
    list.removeChild(list.lastChild);
}

var attachmentListDNDObserver = {
  onDragStart: function (aEvent, aAttachmentData, aDragAction)
  {
    var target = aEvent.target;

    if (target.localName == "attachmentitem")
      aAttachmentData.data = CreateAttachmentTransferData(target.attachment);
  }
};

var attachmentNameDNDObserver = {
  onDragStart: function (aEvent, aAttachmentData, aDragAction)
  {
    var attachmentList = document.getElementById("attachmentList");
    aAttachmentData.data = CreateAttachmentTransferData(
      attachmentList.getItemAtIndex(0).attachment);
  }
};

function ShowEditMessageBox()
{
  // it would be nice if we passed in the msgHdr from the back end
  var msgHdr = gFolderDisplay.selectedMessage;
  if (!msgHdr || !msgHdr.folder)
    return;
  const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
  if (msgHdr.folder.isSpecialFolder(nsMsgFolderFlags.Drafts, true))
    document.getElementById("editMessageBox").collapsed = false;
}

function ClearEditMessageBox()
{
  var editBox = document.getElementById("editMessageBox");
  if (editBox)
    editBox.collapsed = true;
}

// CopyWebsiteAddress takes the website address title button, extracts
// the website address we stored in there and copies it to the clipboard
function CopyWebsiteAddress(websiteAddressNode)
{
  if (websiteAddressNode)
  {
    var websiteAddress = websiteAddressNode.textContent;

    var contractid = "@mozilla.org/widget/clipboardhelper;1";
    var iid = Components.interfaces.nsIClipboardHelper;
    var clipboard = Components.classes[contractid].getService(iid);
    clipboard.copyString(websiteAddress);
  }
}

function nsDummyMsgHeader()
{
}

nsDummyMsgHeader.prototype =
{
  mProperties : new Array,
  getStringProperty : function(aProperty) {
    if (aProperty in this.mProperties)
      return this.mProperties[property];
    return "";
  },
  setStringProperty : function(aProperty, aVal) {
    this.mProperties[aProperty] = aVal;
  },
  getUint32Property : function(aProperty) {
    if (aProperty in this.mProperties)
      return parseInt(this.mProperties[aProperty]);
    return 0;
  },
  setUint32Property: function(aProperty, aVal) {
    this.mProperties[aProperty] = aVal.toString();
  },
  markHasAttachments : function(hasAttachments) {},
  messageSize : 0,
  recipients : null,
  from : null,
  subject : null,
  get mime2DecodedSubject() { return this.subject; },
  ccList : null,
  listPost : null,
  messageId : null,
  date : 0,
  accountKey : "",
  // if you change us to return a fake folder, please update
  // folderDisplay.js's FolderDisplayWidget's selectedMessageIsExternal getter.
  folder : null
};

function onShowOtherActionsPopup()
{
  // Enable/disable the Open Conversation button.
  let prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch2);
  let glodaEnabled = prefBranch.getBoolPref("mailnews.database.global.indexer.enabled");

  let openConversation = document.getElementById("otherActionsOpenConversation");
  openConversation.disabled = !glodaEnabled;
  if (glodaEnabled && gFolderDisplay.selectedMessages.length > 0) {
    let message = gFolderDisplay.selectedMessages[0];
    let isMessageIndexed = Gloda.isMessageIndexed(message);
    openConversation.disabled = !isMessageIndexed;
  }

  if (SelectedMessagesAreRead()) {
    document.getElementById('markAsReadMenuItem').setAttribute('hidden', true);
    document.getElementById('markAsUnreadMenuItem').removeAttribute('hidden');
  } else {
    document.getElementById('markAsReadMenuItem').removeAttribute('hidden');
    document.getElementById('markAsUnreadMenuItem').setAttribute('hidden',
                                                                 true);
  }
}

function ConversationOpener()
{
}

ConversationOpener.prototype = {
  openConversationForMessages: function(messages) {
    try {
      this._items = [];
      this._msgHdr = messages[0];
      this._queries = [Gloda.getMessageCollectionForHeaders(messages, this)];
    } catch (e) {
      logException(e);
    }
  },
  isSelectedMessageIndexed: function() {
    let prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                               .getService(Components.interfaces.nsIPrefBranch2);
    let glodaEnabled = prefBranch.getBoolPref("mailnews.database.global.indexer.enabled");

    if (glodaEnabled && gFolderDisplay.selectedMessages.length > 0) {
      let message = gFolderDisplay.selectedMessages[0];
      return Gloda.isMessageIndexed(message);
    }
    return false;
  },
  onItemsAdded: function(aItems) {
  },
  onItemsModified: function(aItems) {
  },
  onItemsRemoved: function(aItems) {
  },
  onQueryCompleted: function(aCollection) {
    try {
      if (!aCollection.items.length) {
        Components.utils.reportError("Couldn't find a collection for msg: " +
                                     this._msgHdr);
      } else {
        let aMessage = aCollection.items[0];
        let tabmail = document.getElementById("tabmail");
        tabmail.openTab("glodaList", {
          conversation: aMessage.conversation,
          message: aMessage,
          title: aMessage.conversation.subject,
          background: false
        });
      }
    } catch (e) {
      logException(e);
    }
  }
}

var gConversationOpener = new ConversationOpener();
