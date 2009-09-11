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
var gMessengerBundle;
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
//                 a toggle icon to show a short vs. long list (DEFAULT: false)
// useShortView:   (only works on some fields like From). If the field has a long presentation and a
//                 short presentation we'll use the short one. i.e. if you are showing the From field and you
//                 set this to true, we can show just "John Doe" instead of "John Doe <jdoe@netscape.net>".
//                 (DEFAULT: false)
//
// outputFunction: this is a method which takes a headerEntry (see the definition below) and a header value
//                 This allows you to provide your own methods for actually determining how the header value
//                 is displayed. (DEFAULT: updateHeaderValue which just sets the header value on the text node)

// This expanded header view shows many of the more common (and useful) headers.
var gExpandedHeaderList = [ {name:"subject"},
                            {name:"from", useToggle:true, outputFunction:OutputEmailAddresses},
                            {name:"reply-to", useToggle:true, outputFunction:OutputEmailAddresses},
                            {name:"date"},
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
  var useShortView = false;
  var partialIDName = prefix + headerListInfo.name;
  this.enclosingBox = document.getElementById(partialIDName + 'Box');
  this.enclosingRow = document.getElementById(partialIDName + 'Row');
  this.textNode = document.getElementById(partialIDName + 'Value');
  this.isNewHeader = false;
  this.valid = false;

  if ("useShortView" in headerListInfo)
  {
    useShortView = headerListInfo.useShortView;
    if (useShortView)
      this.enclosingBox = this.textNode;
    else
      this.enclosingBox.emailAddressNode = this.textNode;
  }

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

  if (this.textNode)
    this.textNode.useShortView = useShortView;

  if ("outputFunction" in headerListInfo)
    this.outputFunction = headerListInfo.outputFunction;
  else
    this.outputFunction = updateHeaderValue;

  // stash this so that the <mail-multi-emailheaderfield/> binding can
  // later attach it to any <mail-emailaddress> tags it creates for later
  // extraction and use by AddExtraAddressProcessing.
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
  if (deckElement.selectedIndex < 0 ||
      deckElement.selectedIndex >= deckElement.childElementCount) {
    deckElement.selectedIndex = 0;
  }

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
      if (contentType == "text/x-vcard")
      {
        var inlineAttachments = pref.getBoolPref("mail.inline_attachments");
        var displayHtmlAs = pref.getIntPref("mailnews.display.html_as");
        if (inlineAttachments && !displayHtmlAs)
          return;
      }

      currentAttachments.push (new createNewAttachmentInfo(contentType, url, displayName, uri, isExternalAttachment));
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

    onEndAllAttachments: function()
    {
      displayAttachmentsForExpandedView();

      gMessageDisplay.messageLoading = false;
      gMessageDisplay.messageLoaded = true;

      for (index in gMessageListeners) {
        if ("onEndAttachments" in gMessageListeners[index])
          gMessageListeners[index].onEndAttachments();
      }
    },

    onEndMsgDownload: function(url)
    {
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
    }
  }
}

// flush out any local state being held by a header entry for a given
// table
function ClearHeaderView(headerTable)
{
  for (index in headerTable)
  {
     var headerEntry = headerTable[index];
     if (headerEntry.useToggle)
     {
       headerEntry.enclosingBox.clearHeaderValues();
     }

     headerEntry.valid = false;
  }
}

// make sure that any valid header entry in the table is collapsed
function hideHeaderView(headerTable)
{
  for (index in headerTable)
  {
    headerTable[index].enclosingRow.collapsed = true;
  }
}

// make sure that any valid header entry in the table specified is
// visible
function showHeaderView(headerTable)
{
  var headerEntry;
  for (index in headerTable)
  {
    headerEntry = headerTable[index];
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
  for (index in headerTable)
  {
    if (headerTable[index].valid)
      numVisibleHeaders ++;
  }

  if (numVisibleHeaders < gMinNumberOfHeaders)
  {
    // how many empty headers do we need to add?
    var numEmptyHeaders = gMinNumberOfHeaders - numVisibleHeaders;

    // we may have already dynamically created our empty rows and we just need to make them visible
    for (index in headerTable)
    {
      if (index.indexOf("Dummy-Header") == 0 && numEmptyHeaders)
      {
        headerTable[index].valid = true;
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
  for (var index in aHeaderTable)
  {
    var headerEntry = aHeaderTable[index];
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
      else {
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

function OutputNewsgroups(headerEntry, headerValue)
{
  headerValue = headerValue.replace(/,/g,", ");
  updateHeaderValue(headerEntry, headerValue);
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

function OutputDate(headerEntry, headerValue)
{
  headerEntry.textNode.value = headerValue;
  // The date field is a textbox, and we want it to be as small as possible to
  // not take space from the subject textbox. This is a bit bigger than
  // necessary, but guaranteed to fit. We should move to not using textboxes
  // because of these sizing problems, and instead figure out selectable
  // labels.
  headerEntry.textNode.setAttribute("size", Math.round(headerValue.length * 1.2));
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
  emailAddressNode.setAttribute("label", address.fullAddress || address.displayName);
  emailAddressNode.setAttribute("emailAddress", address.emailAddress);
  emailAddressNode.setAttribute("fullAddress", address.fullAddress);
  emailAddressNode.setAttribute("displayName", address.displayName);
  emailAddressNode.removeAttribute("tooltiptext");

  AddExtraAddressProcessing(address.emailAddress, emailAddressNode);
}

function AddExtraAddressProcessing(emailAddress, documentNode)
{
  // Always get the card details so we can show add or edit menu options.
  var cardDetails = getCardForEmail(emailAddress);
  documentNode.cardDetails = cardDetails;

  if (!cardDetails.card) {
    documentNode.setAttribute("hascard", "false");
    documentNode.setAttribute("tooltipstar",
      document.getElementById("addToAddressBookItem").label);
  }
  else {
    documentNode.setAttribute("hascard", "true");
    documentNode.setAttribute("tooltipstar",
      document.getElementById("editContactItem").label);
  }

  if (!gShowCondensedEmailAddresses)
    return;

  // If this address is one of the user's identities...
  var displayName;
  var identity = getBestIdentity(accountManager.allIdentities);
  if (emailAddress == identity.email) {

    // ...pick a localized version of the word "You" appropriate to this
    // specific header; fall back to the version used by the "to" header
    // if nothing else is available.
    let headerName = documentNode.getAttribute("headerName");
    try {
      displayName = gMessengerBundle.getString("header" + headerName +
                                               "FieldYou");
    } catch (ex) {
      displayName = gMessengerBundle.getString("headertoFieldYou");
    }
  }
  else
  {
    if (!cardDetails.card)
      return;
    displayName = cardDetails.card.displayName;
  }

  if (!displayName)
    return;

  documentNode.setAttribute("label", displayName);
  documentNode.setAttribute("tooltiptext", emailAddress);
}

function UpdateEmailNodeDetails(aEmailAddress, aDocumentNode, aCardDetails) {
  // If we haven't been given specific details, search for a card.
  var cardDetails = aCardDetails ? aCardDetails :
                                   getCardForEmail(aEmailAddress);
  var displayName = null;

  aDocumentNode.cardDetails = cardDetails;

  if (cardDetails.card) {
    displayName = cardDetails.card.displayName;
    aDocumentNode.setAttribute("hascard", "true");
    aDocumentNode.setAttribute("tooltipstar",
                               document.getElementById("editContactItem").label);
  }
  else {
    aDocumentNode.setAttribute("hascard", "false");
    aDocumentNode.setAttribute("tooltipstar",
                               document.getElementById("addToAddressBookItem").label);
  }

  // When we are adding cards, we don't want to move the display around if the
  // user has clicked on the star, therefore if it is locked, just exit and
  // leave the display updates until later.
  if (aDocumentNode.hasAttribute("updatingUI"))
    return;

  if (gShowCondensedEmailAddresses && displayName) {
    aDocumentNode.setAttribute("label", displayName);
    aDocumentNode.setAttribute("tooltiptext", aEmailAddress);
  }
  else if (aDocumentNode.parentNode.useShortView &&
           aDocumentNode.getAttribute("displayName")) {
    aDocumentNode.setAttribute("label",
                               aDocumentNode.getAttribute("displayName"));
    aDocumentNode.setAttribute("tooltiptext",
                               aDocumentNode.getAttribute("fullAddress"));
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
      var displayName = aItem.displayName;

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

function hideEmailAddressPopup(emailAddressNode)
{
  // highlight the emailBox
  emailAddressNode.removeAttribute('selected');
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
 * @return the DOM node for the header-view-button-box in the currently
 * selected panel of the message header
 *
 * @note that this assumes that the first such button box is the only one
 * worth caring about (having more than one per panel is not supported).
 */
function getCurrentMsgHdrButtonBox() {

  return document.getElementById('msgHeaderViewDeck').selectedPanel
                 .getElementsByTagName("header-view-button-box").item(0);
}

function AddContact(emailAddressNode)
{
  if (emailAddressNode) {
    // When we collect an address, it updates the AB which sends out
    // notifications to update the UI. In the add case we don't want to update
    // the UI so that accidentally double-clicking on the star doesn't lead
    // to something strange (i.e star would be moved out from underneath,
    // leaving something else there).
    emailAddressNode.setAttribute("updatingUI", true);

    // Just save the new node straight away
    Components.classes["@mozilla.org/addressbook/services/addressCollector;1"]
      .getService(Components.interfaces.nsIAbAddressCollector)
      .collectSingleAddress(emailAddressNode.getAttribute("emailAddress"),
                            emailAddressNode.getAttribute("displayName"), true,
                            Components.interfaces.nsIAbPreferMailFormat.unknown,
                            true);

    emailAddressNode.removeAttribute("updatingUI");
  }
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
 * @param emailAddressNode a node which has a "fullAddress" attribute
 */
function SendMailToNode(emailAddressNode)
{
  let fields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                         .createInstance(Components.interfaces.nsIMsgCompFields);
  let params = Components.classes["@mozilla.org/messengercompose/composeparams;1"]
                         .createInstance(Components.interfaces.nsIMsgComposeParams);
  fields.to = emailAddressNode.getAttribute("fullAddress");
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
 * Takes the email address title button, extracts the email address we stored
 * in there and copies it to the clipboard.
 * @param emailAddressNode a node which has an "emailAddress" attribute
 */
function CopyEmailAddress(emailAddressNode)
{
  let clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                            .getService(Components.interfaces.nsIClipboardHelper);
  clipboard.copyString(emailAddressNode.getAttribute("emailAddress"));
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

// createnewAttachmentInfo --> constructor method for creating new attachment object which goes into the
// data attachment array.
function createNewAttachmentInfo(contentType, url, displayName, uri, isExternalAttachment)
{
  this.contentType = contentType;
  this.url = url;
  this.displayName = displayName;
  this.uri = uri;
  this.isExternalAttachment = isExternalAttachment;
}

function saveAttachment(aAttachment)
{
  messenger.saveAttachment(aAttachment.contentType,
                           aAttachment.url,
                           encodeURIComponent(aAttachment.displayName),
                           aAttachment.uri, aAttachment.isExternalAttachment);
}

function openAttachment(aAttachment)
{
  if (aAttachment.contentType == "text/x-moz-deleted")
    return;

  messenger.openAttachment(aAttachment.contentType,
                           aAttachment.url,
                           encodeURIComponent(aAttachment.displayName),
                           aAttachment.uri, aAttachment.isExternalAttachment);
}

function detachAttachment(aAttachment, aSaveFirst)
{
  messenger.detachAttachment(aAttachment.contentType,
                           aAttachment.url,
                           encodeURIComponent(aAttachment.displayName),
                           aAttachment.uri, aSaveFirst);
}

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

function onShowAttachmentContextMenu()
{
  // if no attachments are selected, disable the Open and Save...
  var attachmentList = document.getElementById('attachmentList');
  var selectedAttachments = attachmentList.selectedItems;
  var openMenu = document.getElementById('context-openAttachment');
  var saveMenu = document.getElementById('context-saveAttachment');
  var detachMenu = document.getElementById('context-detachAttachment');
  var deleteMenu = document.getElementById('context-deleteAttachment');
  var menuSeparator = document.getElementById('context-menu-separator');
  var saveAllMenu = document.getElementById('context-saveAllAttachments');
  var detachAllMenu = document.getElementById('context-detachAllAttachments');
  var deleteAllMenu = document.getElementById('context-deleteAllAttachments');

  var canDetach = CanDetachAttachments();
  var deletedAmongSelected = false;
  var detachedAmongSelected = false;
  var anyDeleted = false; // at least one deleted attachment in the list
  var anyDetached = false; // at least one detached attachment in the list
  var selectNone = selectedAttachments.length == 0;

  // Check if one or more of the selected attachments are deleted.
  for (var i = 0; i < selectedAttachments.length && !deletedAmongSelected; i++)
    deletedAmongSelected =
      (selectedAttachments[i].attachment.contentType == 'text/x-moz-deleted');

  // Check if one or more of the selected attachments are detached.
  for (var i = 0; i < selectedAttachments.length && !detachedAmongSelected; i++)
    detachedAmongSelected = selectedAttachments[i].attachment.isExternalAttachment;

  // Check if any attachments are deleted.
  for (var i = 0; i < currentAttachments.length && !anyDeleted; i++)
    anyDeleted = (currentAttachments[i].contentType == 'text/x-moz-deleted');

  // Check if any attachments are detached.
  for (var i = 0; i < currentAttachments.length && !anyDetached; i++)
    anyDetached = currentAttachments[i].isExternalAttachment;

  openMenu.setAttribute('hidden', selectNone);
  saveMenu.setAttribute('hidden', selectNone);
  detachMenu.setAttribute('hidden', selectNone);
  deleteMenu.setAttribute('hidden', selectNone);
  menuSeparator.setAttribute('hidden', selectNone);
  saveAllMenu.setAttribute('hidden', !selectNone);
  detachAllMenu.setAttribute('hidden', !selectNone);
  deleteAllMenu.setAttribute('hidden', !selectNone);

  if (!selectNone)
  {
    openMenu.setAttribute('disabled', deletedAmongSelected);
    saveMenu.setAttribute('disabled', deletedAmongSelected);
    detachMenu.setAttribute('disabled', !canDetach || deletedAmongSelected
                                        || detachedAmongSelected);
    deleteMenu.setAttribute('disabled', !canDetach || deletedAmongSelected
                                        || detachedAmongSelected);
  }
  else
  {
    saveAllMenu.setAttribute('disabled', anyDeleted);
    detachAllMenu.setAttribute('disabled', !canDetach || anyDeleted || anyDetached);
    deleteAllMenu.setAttribute('disabled', !canDetach || anyDeleted || anyDetached);
  }
}

function MessageIdClick(node, event)
{
  if (event.button == 0)
  {
    var messageId = GetMessageIdFromNode(node, true);
    OpenMessageForMessageId(messageId);
  }
}

// this is our onclick handler for the attachment list.
// A double click in a listitem simulates "opening" the attachment....
function attachmentListClick(event)
{
  // we only care about button 0 (left click) events
  if (event.button != 0)
    return;

  if (event.detail == 2) // double click
  {
    var target = event.target;
    if (target.localName == "descriptionitem")
      openAttachment(target.attachment);
  }
}

function cloneAttachment(aAttachment)
{
  var obj = new Object();
  obj.contentType = aAttachment.contentType;
  obj.url = aAttachment.url;
  obj.displayName = aAttachment.displayName;
  obj.uri = aAttachment.uri;
  obj.isExternalAttachment = aAttachment.isExternalAttachment;
  return obj;
}

function createAttachmentDisplayName(aAttachment)
{
  // Strip any white space at the end of the display name to avoid
  // attachment name spoofing (especially Windows will drop trailing dots
  // and whitespace from filename extensions). Leading and internal
  // whitespace will be taken care of by the crop="center" attribute.
  // We must not change the actual filename, though.
  return aAttachment.displayName.trimRight();
}

function displayAttachmentsForExpandedView()
{
  var numAttachments = currentAttachments.length;
  var expandedAttachmentBox = document.getElementById('attachmentView');
  var attachmentSplitter = document.getElementById('attachment-splitter');

  if (numAttachments <= 0)
  {
    expandedAttachmentBox.collapsed = true;
    attachmentSplitter.collapsed = true;
  }
  else if (!gBuildAttachmentsForCurrentMsg)
  {
    // IMPORTANT: make sure we uncollapse the attachment box BEFORE we start adding
    // our attachments to the view. Otherwise, layout doesn't calculate the correct height for
    // the attachment view and we end up with a box that is too tall.
    expandedAttachmentBox.collapsed = false;
    attachmentSplitter.collapsed = false;

    var showLargeAttView = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch2)
                             .getBoolPref("mailnews.attachments.display.largeView")
    if (showLargeAttView)
      expandedAttachmentBox.setAttribute("largeView", "true");

    // Remove height attribute, or the attachments box could be drawn badly:
    expandedAttachmentBox.removeAttribute("height");

    var attachmentList = document.getElementById('attachmentList');
    for (index in currentAttachments)
    {
      var attachment = currentAttachments[index];

      // Create a new attachment widget
      var displayName = createAttachmentDisplayName(attachment);
      var attachmentView = attachmentList.appendItem(displayName);

      attachmentView.setAttribute("class", "descriptionitem-iconic");

      if (showLargeAttView)
        attachmentView.setAttribute("largeView", "true");

      setApplicationIconForAttachment(attachment, attachmentView, showLargeAttView);
      attachmentView.setAttribute("tooltiptext", attachment.displayName);
      attachmentView.setAttribute("context", "attachmentListContext");

      attachmentView.attachment = cloneAttachment(attachment);
      attachmentView.setAttribute("attachmentUrl", attachment.url);
      attachmentView.setAttribute("attachmentContentType", attachment.contentType);
      attachmentView.setAttribute("attachmentUri", attachment.uri);

      var item = attachmentList.appendChild(attachmentView);
    } // for each attachment
    gBuildAttachmentsForCurrentMsg = true;

    // Switch overflow off (via css attribute selector) temporarily to get the preferred window height:
    var attachmentContainer = document.getElementById('attachmentView');
    attachmentContainer.setAttribute("attachmentOverflow", "false");
    var attachmentHeight = expandedAttachmentBox.boxObject.height;
    attachmentContainer.setAttribute("attachmentOverflow", "true");

    // If the attachments box takes up too much of the message pane, downsize:
    var maxAttachmentHeight = document.getElementById('messagepanebox').boxObject.height / 4;
    if (attachmentHeight > maxAttachmentHeight)
      attachmentHeight = maxAttachmentHeight;
    expandedAttachmentBox.setAttribute("height", attachmentHeight);
 }
}

/**
 * Show a nice icon next to the attachment.
 * @param attachment the nsIMsgAttachment object to show icon for
 * @param listitem the listitem currently showing the attachment
 * @param largeView boolean value: 32x32 vs. 16x16 size icon
 */
function setApplicationIconForAttachment(attachment, listitem, largeView)
{
  // Show a nice icon next to it the attachment.
  if (attachment.contentType == "text/x-moz-deleted")
  {
    let fn = largeView ? "attachment-deleted-large.png" : "attachment-deleted.png";
    listitem.setAttribute("image", "chrome://messenger/skin/icons/"+fn);
  }
  else
  {
    let iconSize = largeView ? 32 : 16;
    listitem.setAttribute("image", "moz-icon://" + attachment.displayName + "?size=" +
                                   iconSize + "&contentType=" + attachment.contentType);
  }
}

// Public method called when we create the attachments file menu
function FillAttachmentListPopup(popup)
{
  // the FE sometimes call this routine TWICE...I haven't been able to figure out why yet...
  // protect against it...
  if (!gBuildAttachmentPopupForCurrentMsg)
    return;

  var attachmentIndex = 0;

  // otherwise we need to build the attachment view...
  // First clear out the old view...
  ClearAttachmentMenu(popup);

  var canDetachOrDeleteAll = CanDetachAttachments();

  for (index in currentAttachments)
  {
    ++attachmentIndex;
    addAttachmentToPopup(popup, currentAttachments[index], attachmentIndex);
    if (canDetachOrDeleteAll &&
        (currentAttachments[index].isExternalAttachment ||
        currentAttachments[index].contentType == 'text/x-moz-deleted'))
      canDetachOrDeleteAll = false;
  }

  gBuildAttachmentPopupForCurrentMsg = false;

  var detachAllMenu = document.getElementById('file-detachAllAttachments');
  var deleteAllMenu = document.getElementById('file-deleteAllAttachments');

  detachAllMenu.setAttribute('disabled', !canDetachOrDeleteAll);
  deleteAllMenu.setAttribute('disabled', !canDetachOrDeleteAll);
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

// private method used to build up a menu list of attachments
function addAttachmentToPopup(popup, attachment, attachmentIndex)
{
  if (popup)
  {
    var item = document.createElement('menu');
    if ( item )
    {
      if (!gMessengerBundle)
        gMessengerBundle = document.getElementById("bundle_messenger");

      // insert the item just before the separator...the separator is the 2nd to last element in the popup.
      item.setAttribute('class', 'menu-iconic');
      setApplicationIconForAttachment(attachment,item, false);

      var numItemsInPopup = popup.childNodes.length;
      // find the separator
      var indexOfSeparator = 0;
      while (popup.childNodes[indexOfSeparator].localName != 'menuseparator')
        indexOfSeparator++;

      var displayName = createAttachmentDisplayName(attachment);
      var formattedDisplayNameString = gMessengerBundle.getFormattedString("attachmentDisplayNameFormat",
                                       [attachmentIndex, displayName]);

      item.setAttribute("crop", "center");
      item.setAttribute('label', formattedDisplayNameString);
      item.setAttribute('accesskey', attachmentIndex);

      // each attachment in the list gets its own menupopup with options for saving, deleting, detaching, etc.
      var openpopup = document.createElement('menupopup');
      openpopup = item.appendChild(openpopup);

      // Due to Bug #314228, we must append our menupopup to the new attachment menu item
      // before we inserting the attachment menu into the popup. If we don't, our attachment
      // menu items will not show up.
      item = popup.insertBefore(item, popup.childNodes[indexOfSeparator]);

      var menuitementry = document.createElement('menuitem');
      menuitementry.attachment = cloneAttachment(attachment);
      menuitementry.setAttribute('oncommand', 'openAttachment(this.attachment)');

      function getString(aName) {
        return gMessengerBundle.getString(aName);
      }

      var canDetach = CanDetachAttachments() && !attachment.isExternalAttachment;
      menuitementry.setAttribute('label', getString("openLabel"));
      menuitementry.setAttribute('accesskey', getString("openLabelAccesskey"));
      menuitementry = openpopup.appendChild(menuitementry);
      if (attachment.contentType == 'text/x-moz-deleted')
        menuitementry.setAttribute('disabled', true);

      var menuseparator = document.createElement('menuseparator');
      openpopup.appendChild(menuseparator);

      menuitementry = document.createElement('menuitem');
      menuitementry.attachment = cloneAttachment(attachment);
      menuitementry.setAttribute('oncommand', 'saveAttachment(this.attachment)');
      menuitementry.setAttribute('label', getString("saveLabel"));
      menuitementry.setAttribute('accesskey', getString("saveLabelAccesskey"));
      if (attachment.contentType == 'text/x-moz-deleted')
        menuitementry.setAttribute('disabled', true);
      menuitementry = openpopup.appendChild(menuitementry);

      var menuseparator = document.createElement('menuseparator');
      openpopup.appendChild(menuseparator);

      menuitementry = document.createElement('menuitem');
      menuitementry.attachment = cloneAttachment(attachment);
      menuitementry.setAttribute('oncommand', 'detachAttachment(this.attachment, true)');
      menuitementry.setAttribute('label', getString("detachLabel"));
      menuitementry.setAttribute('accesskey', getString("detachLabelAccesskey"));
      if (attachment.contentType == 'text/x-moz-deleted' || !canDetach)
        menuitementry.setAttribute('disabled', true);
      menuitementry = openpopup.appendChild(menuitementry);

      menuitementry = document.createElement('menuitem');
      menuitementry.attachment = cloneAttachment(attachment);
      menuitementry.setAttribute('oncommand', 'detachAttachment(this.attachment, false)');
      menuitementry.setAttribute('label', getString("deleteLabel"));
      menuitementry.setAttribute('accesskey', getString("deleteLabelAccesskey"));
      if (attachment.contentType == 'text/x-moz-deleted' || !canDetach)
        menuitementry.setAttribute('disabled', true);
      menuitementry = openpopup.appendChild(menuitementry);
    }  // if we created a menu item for this attachment...
  } // if we have a popup
}

function HandleAllAttachments(action)
{
  HandleMultipleAttachments(currentAttachments, action);
}

function HandleSelectedAttachments(action)
{
  var attachmentList = document.getElementById('attachmentList');
  var selectedAttachments = new Array();
  for (var i in attachmentList.selectedItems)
    selectedAttachments.push(attachmentList.selectedItems[i].attachment);

  HandleMultipleAttachments(selectedAttachments, action);
}

// supported actions: open, save, saveAs, detach, delete
function HandleMultipleAttachments(attachments, action)
{
 try
 {
   // convert our attachment data into some c++ friendly structs
   var attachmentContentTypeArray = new Array();
   var attachmentUrlArray = new Array();
   var attachmentDisplayNameArray = new Array();
   var attachmentMessageUriArray = new Array();

   // populate these arrays..
   var actionIndex = 0;
   for (let index in attachments)
   {
     // exclude all attachments already deleted
     var attachment = attachments[index];
     if ( attachment.contentType != 'text/x-moz-deleted' )
     {
       attachmentContentTypeArray[actionIndex] = attachment.contentType;
       attachmentUrlArray[actionIndex] = attachment.url;
       attachmentDisplayNameArray[actionIndex] = encodeURI(attachment.displayName);
       attachmentMessageUriArray[actionIndex] = attachment.uri;
       ++actionIndex;
     }
   }

   // okay the list has been built... now call our action code...
   if ( action == 'save' )
     messenger.saveAllAttachments(attachmentContentTypeArray.length,
                                  attachmentContentTypeArray, attachmentUrlArray,
                                  attachmentDisplayNameArray, attachmentMessageUriArray);
   else if ( action == 'detach' )
     messenger.detachAllAttachments(attachmentContentTypeArray.length,
                                    attachmentContentTypeArray, attachmentUrlArray,
                                    attachmentDisplayNameArray, attachmentMessageUriArray,
                                    true); // save
   else if ( action == 'delete' )
     messenger.detachAllAttachments(attachmentContentTypeArray.length,
                                    attachmentContentTypeArray, attachmentUrlArray,
                                    attachmentDisplayNameArray, attachmentMessageUriArray,
                                    false); // don't save
   else if ( action == 'open'|| action == 'saveAs' ) {
     // XXX hack alert. If we sit in tight loop and open/save multiple attachments,
     // we get chrome errors in layout as we start loading the first helper app dialog
     // then before it loads, we kick off the next one and the next one. Subsequent helper
     // app dialogs were failing because we were still loading the chrome files for the
     // first attempt (error about the xul cache being empty). For now, work around this
     // by doing the first helper app dialog right away, then waiting a bit before we
     // launch the rest.
     var actionFunction = (action == 'open') ? openAttachment : saveAttachment;
     for (var i = 0; i < attachments.length; i++)
     {
       if (i == 0)
         actionFunction(attachments[i]);
       else
         setTimeout(actionFunction, 100, attachments[i]);
     }
   }
   else
     dump ("** unknown HandleMultipleAttachments action: " + action + "**\n");
 }
 catch (ex)
 {
   dump ("** failed to handle multiple attachments **\n");
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

  while (list.hasChildNodes())
    list.removeChild(list.lastChild);
}

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
    var websiteAddress = websiteAddressNode.getAttribute("value");

    var contractid = "@mozilla.org/widget/clipboardhelper;1";
    var iid = Components.interfaces.nsIClipboardHelper;
    var clipboard = Components.classes[contractid].getService(iid);
    clipboard.copyString(websiteAddress);
  }
}

var attachmentAreaDNDObserver = {
  onDragStart: function (aEvent, aAttachmentData, aDragAction)
  {
    var target = aEvent.target;
    if (target.localName == "descriptionitem")
    {
      var attachment = target.attachment;
      if (attachment.contentType == "text/x-moz-deleted")
        return;

      var data = new TransferData();
      if (attachment.url && attachment.displayName)
      {
        var info = attachment.url + "&type=" + attachment.contentType +
                   "&filename=" + encodeURIComponent(attachment.displayName);
        data.addDataForFlavour("text/x-moz-url",
                               info + "\n" + attachment.displayName);
        data.addDataForFlavour("text/x-moz-url-data", attachment.url);
        data.addDataForFlavour("text/x-moz-url-desc", attachment.displayName);
        data.addDataForFlavour("application/x-moz-file-promise-url",
                               attachment.url);
        data.addDataForFlavour("application/x-moz-file-promise",
                               new nsFlavorDataProvider(), 0,
                               Components.interfaces.nsISupports);
      }
      aAttachmentData.data = data;
    }
  }
};

function nsFlavorDataProvider()
{
}

nsFlavorDataProvider.prototype =
{
  QueryInterface : function(iid)
  {
      if (iid.equals(Components.interfaces.nsIFlavorDataProvider) ||
          iid.equals(Components.interfaces.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
  },

  getFlavorData : function(aTransferable, aFlavor, aData, aDataLen)
  {
    // get the url for the attachment
    if (aFlavor == "application/x-moz-file-promise")
    {
      var urlPrimitive = { };
      var dataSize = { };
      aTransferable.getTransferData("application/x-moz-file-promise-url", urlPrimitive, dataSize);

      var srcUrlPrimitive = urlPrimitive.value.QueryInterface(Components.interfaces.nsISupportsString);

      // now get the destination file location from kFilePromiseDirectoryMime
      var dirPrimitive = {};
      aTransferable.getTransferData("application/x-moz-file-promise-dir", dirPrimitive, dataSize);
      var destDirectory = dirPrimitive.value.QueryInterface(Components.interfaces.nsILocalFile);

      // now save the attachment to the specified location
      // XXX: we need more information than just the attachment url to save it, fortunately, we have an array
      // of all the current attachments so we can cheat and scan through them

      var attachment = null;
      for (index in currentAttachments)
      {
        attachment = currentAttachments[index];
        if (attachment.url == srcUrlPrimitive)
          break;
      }

      // call our code for saving attachments
      if (attachment)
      {
        var destFilePath = messenger.saveAttachmentToFolder(attachment.contentType, attachment.url, encodeURIComponent(attachment.displayName), attachment.uri, destDirectory);
        aData.value = destFilePath.QueryInterface(Components.interfaces.nsISupports);
        aDataLen.value = 4;
      }
    }
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
  accountKey : "",
  // if you change us to return a fake folder, please update
  // folderDisplay.js's FolderDisplayWidget's selectedMessageIsExternal getter.
  folder : null
};
