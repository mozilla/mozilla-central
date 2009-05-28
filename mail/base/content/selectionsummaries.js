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
 * The Original Code is multiple message preview pane
 *
 * The Initial Developer of the Original Code is
 *   Mozilla Messaging
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Ascher <dascher@mozillamessaging.com>
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


Components.utils.import("resource://gre/modules/DownloadUtils.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource://app/modules/gloda/mimemsg.js");

let gSelectionSummaryStrings = {
  selectedNMessages: "selectedNMessages",
  acrossNThreads: "acrossNThreads",
  numMsgs: "numMsgs",
  countUnread: "countUnread",
  Nmessages: "Nmessages",
  messagesSize: "messagesSize",
  yesterday: "yesterday",
  noticeText: "noticeText",
  noSubject: "noSubject",
}

/**
 * loadSelectionSummaryStrings does the routine localization of non-pluralized
 * strings, populating the gSelectionSummaryStrings array based on the current
 * locale.
 */
function loadSelectionSummaryStrings()
{
  // convert strings to those in the string bundle
  let getStr = function(string) document.getElementById("bundle_multimessages").getString(string);
  var strBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService();
  strBundleService = strBundleService.QueryInterface(Components.interfaces.nsIStringBundleService);
    for (let [name, value] in Iterator(gSelectionSummaryStrings))
      gSelectionSummaryStrings[name] = typeof value == "string" ?
        getStr(value) : value.map(gSelectionSummaryStrings);
}

loadSelectionSummaryStrings();

/**
 * pickMessagePane is the toggle to figure out whether to use the standard
 * message pane used to display message bodies (& headers), or whether to
 * display an HTML iframe used for the multiple message summaries.
 *
 * @param visiblePaneId
 *        the ID of the pane that we want to make be the visible one.
 * @return the DOM element corresponding to the selected pane.
 *
 */
function pickMessagePane(visiblePaneId)
{
  var paneIds = ['singlemessage', 'multimessage'];
  // when we want to do folder and account summaries, we just need to add
  // XUL elements for them, and add them to this list.
  //               'foldersummary', 'accountsummary'];
  for (let [,paneId] in Iterator(paneIds))
    document.getElementById(paneId).hidden = paneId != visiblePaneId;

  return document.getElementById(visiblePaneId);
}

// Ah, wouldn't it be nice if there was platform code to do the following...

/**
 * the equivalent of jQuery's addClass.  Avoids duplicates, nothing fancy.
 *
 * @param node
 *        any old DOM node
 * @param classname
 *        a string, which will be added as a CSS class
 */
function _mm_addClass(node, classname)
{
  let classes = [];
  if (node.hasAttribute('class'))
    classes = node.getAttribute('class').split(' ');

  for each (klass in classes) {
    if (klass == classname) // already have it
      return;
  }
  classes.push(classname);
  node.setAttribute('class', classes.join(' '));
}

/**
 * the equivalent of jQuery's removeClass.  Doesn't freak if the class name
 * isn't in the class attribute.
 *
 * @param node
 *        any old DOM node
 * @param classname
 *        a string, which will be removed from the class set.
 */
function _mm_removeClass(node, classname)
{
  if (! node.hasAttribute('class'))
    return;
  let classes = node.getAttribute('class').split(' ');
  let newclasses = [];
  for each (klass in classes) {
    if (klass != classname)
      newclasses.push(klass);
  }
  node.setAttribute('class', newclasses.join(' '));
}


/**
 * the MultiMessageSummary class is responsible for populating the message pane
 * with a reasonable summary of a set of messages that span more than one
 * thread.
 *
 * It uses the same multimessage iframe as ThreadSummary, so both it
 * and ThreadSummary should be careful to clean up the other's work
 * before inserting their DOM nodes into the frame.
 *
 * There's a two phase process: build the framework based on what's available
 * from the msgHdr itself, and then spawn an aysnc Gloda query which will
 * fetch the snippets, tags, etc.
 *
 * @param msgURIs
 *        array of message URIs
 */

function MultiMessageSummary(msgURIs) {
  this._msgURIs = msgURIs;
}

MultiMessageSummary.prototype = {
  init: function() {
    this._msgHdrs = new Array();
    this._glodaQueries = [];
    this._headerNodes = {};
    this._snippetNodes = {};
    this._tagsNodes = {};
    for (var i = 0; i < this._msgURIs.length; ++i)
      this._msgHdrs.push(messenger.msgHdrFromURI(this._msgURIs[i]));

    this.summarize();
  },

  /**
   * Given a name (as one sees in email headers), strip eventual
   * leading/trailing quotes (both single and double).
   *
   * @param senderName
   *     name which might be quoted
   * @return
   *     name without quotes
   **/
  stripQuotes: function(senderName) {
    if ((senderName[0] == "'" && senderName[senderName.length-1] == "'") ||
        (senderName[0] == '"' && senderName[senderName.length-1] == '"'))
      senderName = senderName.slice(1, -1);
    return senderName;
  },

  /**
   * Fill in the summary pane describing the selected messages
   **/
  summarize: function() {
    let htmlpane = pickMessagePane('multimessage');
    // First, we group the messages in threads.
    // count threads
    let threads = {};
    let numThreads = 0;
    for (let [,msgHdr] in Iterator(this._msgHdrs))
    {
      if (! threads[msgHdr.threadId]) {
        threads[msgHdr.threadId] = [msgHdr];
        numThreads += 1;
      }
      else
      {
        threads[msgHdr.threadId].push(msgHdr);
      }
    }

    // set the heading based on the number of messages & threads
    let heading = htmlpane.contentDocument.getElementById('heading');
    _mm_addClass(heading, "heading");
    _mm_addClass(heading, "info");

    let numMessages = this._msgURIs.length;
    let messagesTitle = PluralForm.get(numMessages, gSelectionSummaryStrings["selectedNMessages"]).replace('#1', numMessages);
    messagesTitle +=  PluralForm.get(numThreads, gSelectionSummaryStrings["acrossNThreads"]).replace('#1', numThreads);

    heading.innerHTML = messagesTitle;

    // clear the messages list
    let messagesElt = htmlpane.contentDocument.getElementById('messagelist');
    while (messagesElt.firstChild)
      messagesElt.removeChild(messagesElt.firstChild);

    let MAXCOUNT = 100;
    let count = 0;
    let maxCountExceeded = false;
    // we could consider sorting differently someday
    for (let [thread,msgs] in Iterator(threads))
    {
      count += 1;
      if (count > MAXCOUNT) {
        maxCountExceeded = true;
        break;
      }
      let countUnread = 0;
      let countStarred = 0;
      let header, subject, tags, countNode;
      let msg = htmlpane.contentDocument.createElement("div");
      _mm_addClass(msg, "message");
      // we'll mark the thread unread if any messages in it are unread

      for (let [, msgHdr] in Iterator(msgs)) {
        if (! msgHdr.isRead)
          countUnread += 1;
        if (msgHdr.isFlagged)
          countStarred += 1;
      }

      if (countUnread)
        _mm_addClass(msg, 'unread');

      header = htmlpane.contentDocument.createElement("div");
      _mm_addClass(header, "header");

      if (countStarred) {
        _mm_addClass(msg, "starred");
      }

      let subjectText = msgs[0].mime2DecodedSubject || gSelectionSummaryStrings['noSubject'];
      // Someday, we might want to handle multi-subject threads
      subject = htmlpane.contentDocument.createElement("div");
      _mm_addClass(subject, "subject");
      subject.innerHTML = escapeXMLchars(subjectText);


      let authorText = " " + msgs[0].mime2DecodedAuthor;
      // Someday, we might want to handle multi-subject threads
      let author = htmlpane.contentDocument.createElement("div");
      _mm_addClass(author, "author");
      author.innerHTML = escapeXMLchars(authorText);

      let wrappedsubject = htmlpane.contentDocument.createElement("div");
      _mm_addClass(wrappedsubject, 'wrappedsubject');
      let star = htmlpane.contentDocument.createElement("div");
      _mm_addClass(star, "star");
      wrappedsubject.appendChild(subject);
      wrappedsubject.appendChild(author);

      header.appendChild(wrappedsubject);

      // this feels ugly -- is there a better way to pass in data?
      subject.msgs = msgs;
      subject.addEventListener("click", function() {
        selectMultipleMessagesByMsgHdr(this.msgs)
      }, true);
      _mm_addClass(subject, "link");

      msg.appendChild(header);

      let snippet = htmlpane.contentDocument.createElement("div");
      _mm_addClass(snippet, "snippet");
      header.appendChild(snippet);

      tags = htmlpane.contentDocument.createElement("div");
      _mm_addClass(tags, "tags");
      header.appendChild(tags);

      // use the first msgHdr in the thread for key purposes for snippets
      this._snippetNodes[msgs[0].messageKey + msgs[0].folder.URI] = snippet;
      // for tags, stars, and read/unread status, we want to map
      // from all messages to one node
      for each (msgHdr in msgs) {
        this._headerNodes[msgHdr.messageKey + msgHdr.folder.URI] = header;
        this._tagsNodes[msgHdr.messageKey + msgHdr.folder.URI] = tags;
      }

      let numMsgs = msgs.length;
      countNode = htmlpane.contentDocument.createElement("div");
      _mm_addClass(countNode, 'count');
      if (numMsgs > 1) {
        let label = "(";
        label += PluralForm.get(numMsgs, gSelectionSummaryStrings["numMsgs"]).replace('#1', numMsgs);
        if (countUnread)
          label += PluralForm.get(numMsgs, gSelectionSummaryStrings["countUnread"]).replace('#1', countUnread);
        label += ")";
        countNode.innerHTML = label;
      }
      msg.appendChild(countNode);
      countNode.appendChild(star);
      messagesElt.appendChild(msg);
    }
    this.computeSize();
    this.notifyMaxCountExceeded(numMessages, MAXCOUNT);

    this._glodaQueries.push(Gloda.getMessageCollectionForHeaders(this._msgHdrs, this));
  },

  /**
   * compute the size of the messages in the selection and display it
   * in the element of id "size"
  **/
  computeSize: function() {
    let htmlpane = pickMessagePane('multimessage');
    let numThreads = 0;
    let numBytes = 0;

    for (let [,msgHdr] in Iterator(this._msgHdrs))
      numBytes += msgHdr.messageSize; // XXX do something about news?
    let [size, unit] = DownloadUtils.convertByteUnits(numBytes);
    let sizeText = replaceInsert(gSelectionSummaryStrings.messagesSize, 1, size);
    sizeText = replaceInsert(sizeText, 2, unit);
    htmlpane.contentDocument.getElementById('size').innerHTML = sizeText;
  },

  /** compute the size of the messages in the selection and display it
   * in the element of id "size"
  **/
  notifyMaxCountExceeded: function(numMessages, maxCount) {
    let htmlpane = pickMessagePane('multimessage');
    let notice = htmlpane.contentDocument.getElementById('notice');
    if (numMessages > maxCount)
    {
      let noticeText = gSelectionSummaryStrings.noticeText;
      noticeText = replaceInsert(noticeText, 1, numMessages);
      noticeText = replaceInsert(noticeText, 2, maxCount);
      notice.innerHTML = noticeText;
      _mm_removeClass(notice, 'hidden');
    } else {
      _mm_addClass(notice, 'hidden');
    }
  },

  // these are listeners for the gloda collections.
  onItemsAdded: function(aItems) {
  },
  onItemsModified: function(aItems) {
    this.processItems(aItems);
  },
  onItemsRemoved: function(aItems) {
  },

  /**
   * Given a set of items from a gloda collection, process them and update
   * the display accordingly.
   *
   * @param aItems
   *        contents of a gloda collection
  **/
  processItems: function(aItems) {
    var tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                     .getService(Components.interfaces.nsIMsgTagService);

    let seenTagNode = {};
    for (let [,glodaMsg] in Iterator(aItems)) {
      let messageKey = glodaMsg.messageKey;
      let domkey = messageKey + glodaMsg.folder.uri;

      if (this._headerNodes) {
        let headerNode = this._headerNodes[domkey];
        // unread and starred will get set if any of the messages in a
        // collapsed thread qualify
        if (headerNode) {
          if (! glodaMsg.read)
            _mm_addClass(headerNode, "unread");
          else
            _mm_removeClass(headerNode, "unread");
          if (glodaMsg.starred)
            _mm_addClass(headerNode, "starred");
          else
            _mm_removeClass(headerNode, "starred");
        }
      }
      if (this._snippetNodes) {
        let snippetNode = this._snippetNodes[domkey];

        MsgHdrToMimeMessage(glodaMsg.folderMessage, null, function(aMsgHdr, aMimeMsg) {
          if (aMimeMsg == null)
            return;

          let text = Gloda.getMessageContent(glodaMsg, aMimeMsg).getContentSnippet(101);
          if (snippetNode && text)
          {
            let kSnippetLength = 100;
            if (text.length > kSnippetLength)
              text = text.substring(0, kSnippetLength) + "\u2026"; // ellipsis
            snippetNode.innerHTML = escapeXMLchars(text);
          }
        });

      }
      if (this._tagsNodes) {
        // for tags, we need to do some fancy stuff, to figure out the set
        // of tags that correspond to all of the messages in a collapsed
        // thread.
        let key = messageKey + glodaMsg.folder.uri;
        let tagsNode = this._tagsNodes[key];
        if (tagsNode) {
          if (! seenTagNode[tagsNode]) {
            // We haven't processed a message from this thread before
            while (tagsNode.childNodes.length) {
              // get rid of all tags
              tagsNode.removeChild(tagsNode.firstChild);
            }
            seenTagNode[tagsNode] = {};
          }
          for each (let [,tag] in Iterator(glodaMsg.tags)) {
            // have we already added this tag to the thread?
            if (!(seenTagNode[tagsNode][tag.tag])) {
              let tagNode = tagsNode.ownerDocument.createElement('span');
              // see tagColors.css
              let colorClass = "blc-" + tagService.getColorForKey(tag.key).substr(1);
              _mm_addClass(tagNode, "tag " + tag.tag + " " + colorClass);
              tagNode.innerHTML = tag.tag;
              tagsNode.appendChild(tagNode);
              seenTagNode[tagsNode][tag.tag] = true;
            }
          }
        }
      }
    }
  },

  onQueryCompleted: function(aCollection) {
    if (aCollection.items.length) {
      this.processItems(aCollection.items);
    }
  }
}


/**
 * the ThreadSummary class is responsible for populating the message pane
 * with a reasonable summary of a set of messages that are are in a single
 * thread.
 *
 * It uses the same multimessage iframe as MultiMessageSummary, so both it
 * and MultiMessageSummary should be careful to clean up the other's work
 * before inserting their DOM nodes into the frame.
 *
 * There's a two phase process: build the framework based on what's available
 * from the msgHdr itself, and then spawn an aysnc Gloda query which will
 * fetch the snippets, tags, etc.
 *
 * @param msgURIs
 *        array of message URIs
 */

function ThreadSummary(msgURIs)
{
  this._msgURIs = msgURIs;
}

ThreadSummary.prototype = {
  __proto__: MultiMessageSummary.prototype,

  summarize: function() {
    this._headerNodes = {};
    this._snippetNodes = {};

    let htmlpane = pickMessagePane('multimessage');

    let firstMsgHdr = messenger.msgHdrFromURI(this._msgURIs[0]);
    let numMessages = this._msgURIs.length;
    let subject = (firstMsgHdr.mime2DecodedSubject || gSelectionSummaryStrings["noSubject"])
       + " "
       + PluralForm.get(numMessages, gSelectionSummaryStrings["Nmessages"]).replace('#1', numMessages);
    let heading = htmlpane.contentDocument.getElementById('heading');
    heading.setAttribute("class", "heading");
    heading.innerHTML = escapeXMLchars(subject);

    let messagesElt = htmlpane.contentDocument.getElementById('messagelist');
    while (messagesElt.firstChild)
      messagesElt.removeChild(messagesElt.firstChild);

    let headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                                    .getService(Components.interfaces.nsIMsgHeaderParser);
    let msgHdrs = new Array();
    let count = 0;
    const MAXCOUNT = 100;
    let maxCountExceeded = false;
    for (var i = 0; i < this._msgURIs.length; ++i)
    {
      count += 1;
      if (count > MAXCOUNT) {
        maxCountExceeded = true;
        break;
      }
      let msgHdr, msg, header, sender, snippet, tags;
      msgHdr = messenger.msgHdrFromURI(this._msgURIs[i]);
      msgHdrs.push(msgHdr);
      msg = htmlpane.contentDocument.createElement("div");
      let key = msgHdr.messageKey + msgHdr.folder.URI;

      _mm_addClass(msg, "message");

      if (! msgHdr.isRead)
        _mm_addClass(msg, "unread");

      header = htmlpane.contentDocument.createElement("div");
      _mm_addClass(header, "header");
      if (msgHdr.isFlagged)
        _mm_addClass(msg, "starred");

      let senderName = headerParser.extractHeaderAddressNames(msgHdr.mime2DecodedAuthor);
      senderName = this.stripQuotes(senderName);
      sender = htmlpane.contentDocument.createElement("div");
      sender.msgHdr = msgHdr;
      _mm_addClass(sender, "sender");
      sender.addEventListener("click", function(e) {
        // if the msg is the first message in a collapsed thread, we need to
        // uncollapse it.
        let origRowCount = gDBView.rowCount;
        let viewIndex = gDBView.findIndexOfMsgHdr(e.target.msgHdr, true);
        gDBView.selectFolderMsgByKey(this.folder, this.msgKey);
        if (gDBView.rowCount != origRowCount)
          gDBView.selectionChanged();
      }, true);
      _mm_addClass(sender, "link");
      sender.innerHTML = escapeXMLchars(senderName); // escape?
      sender.folder = msgHdr.folder;
      sender.msgKey = msgHdr.messageKey;

      let wrappedsender = htmlpane.contentDocument.createElement("div");
      _mm_addClass(wrappedsender, "wrappedsender");
      let star = htmlpane.contentDocument.createElement("div");
      _mm_addClass(star, "star");
      wrappedsender.appendChild(sender);

      header.appendChild(wrappedsender);

      snippet = htmlpane.contentDocument.createElement("div");
      _mm_addClass(snippet, "snippet");
      header.appendChild(snippet);

      tags = htmlpane.contentDocument.createElement("div");
      _mm_addClass(tags, "tags");
      header.appendChild(tags);

      this._headerNodes[key] = msg;
      this._snippetNodes[key] = snippet;
      this._tagsNodes[key] = tags;

      msg.appendChild(header);
      let dateNode = htmlpane.contentDocument.createElement("div");
      dateNode.innerHTML = makeFriendlyDateAgo(new Date(msgHdr.date/1000));
      dateNode.appendChild(star);
      _mm_addClass(dateNode, "date");
      msg.appendChild(dateNode);
      messagesElt.appendChild(msg);
    }
    // stash somewhere so it doesn't get GC'ed
    this._glodaQueries.push(Gloda.getMessageCollectionForHeaders(msgHdrs, this));
    this.notifyMaxCountExceeded(numMessages, MAXCOUNT);

    this.computeSize();
  }
}

// We use a global to prevent GC of gloda collection (and we reuse it to prevent
// leaks).  Without a global, the GC is aggressive enough that the gloda query
// is gone before it returns.
var gSummary;


/**
 * Given an array of message URIs which are all in the
 * same thread, summarize them.
 *
 * @param selectedMsgUris
 *        array of message URIs
 */
function summarizeThread(selectedMsgUris)
{
  if (selectedMsgUris.length == 0)
    return;

  gSummary = new ThreadSummary(selectedMsgUris);
  gSummary.init();
}

/**
 * Given an array of message URIs, cause the message pane
 * to display a summary of them.
 *
 * @param selectedMsgUris
 *        array of message URIs
 */
function summarizeMultipleSelection(selectedMsgUris)
{
  if (selectedMsgUris.length == 0)
    return;

  gSummary = new MultiMessageSummary(selectedMsgUris);
  gSummary.init();
}

/**
 * Given an array of nsMsgHdrs, select all of them.  This will uncollapse
 * threads that are collapsed as necessary.
 *
 * @param msgHdrs
 *        array of msgHdr's
 */
function selectMultipleMessagesByMsgHdr(msgHdrs)
{
  let treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
  if (msgHdrs.length == 1) {
    gDBView.selectFolderMsgByKey(msgHdrs[0].folder, msgHdrs[0].messageKey);
  } else {
    let treeSelection = treeView.selection;
    treeSelection.clearSelection();
    for (let [, msgHdr] in Iterator(msgHdrs))
    {
      let viewIndex = gDBView.findIndexOfMsgHdr(msgHdr, false);
      let thread = gDBView.getThreadContainingIndex(viewIndex);
      let flags = gDBView.getFlagsAt(viewIndex);

      if (flags & Components.interfaces.nsMsgMessageFlags.Elided)
        treeView.toggleOpenState(viewIndex);

      treeSelection.rangedSelect(viewIndex, viewIndex, true);
    }
  }
}

/**
 * Helper function to generate a localized "friendly" representation of
 * time relative to the present.  If the time input is "today", it returns
 * a string corresponding to just the time.  If it's yesterday, it returns
 * "yesterday" (localized).  If it's in the last week, it returns the day
 * of the week. If it's before that, it returns the date.
 *
 * @param time
 *        the time (better be in the past!)
 * @return The string with a "human-friendly" representation of that time
 *        relative to now.
 */
function makeFriendlyDateAgo(time)
{
  let dts = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                      .getService(Components.interfaces.nsIScriptableDateFormat);

  // Figure out when today begins
  let now = new Date();
  let today = new Date(now.getFullYear(), now.getMonth(),
                       now.getDate());

  // Get the end time to display
  let end = time;

  // Figure out if the end time is from today, yesterday,
  // this week, etc.
  let dateTime;
  let kDayInMsecs = 24 * 60 * 60 * 1000;
  let k6DaysInMsecs = 6 * kDayInMsecs;
  if (end >= today) {
    // activity finished after today started, show the time
    dateTime = dts.FormatTime("", dts.timeFormatNoSeconds,
                                  end.getHours(), end.getMinutes(),0);
  } else if (today - end < kDayInMsecs) {
    // activity finished after yesterday started, show yesterday
    dateTime = gSelectionSummaryStrings.yesterday;
  } else if (today - end < k6DaysInMsecs) {
    // activity finished after last week started, show day of week
    dateTime = end.toLocaleFormat("%A");
  } else if (now.getFullYear() == end.getFullYear()) {
    // activity must have been from some time ago.. show month/day
    let month = end.toLocaleFormat("%B");
    // Remove leading 0 by converting the date string to a number
    let date = Number(end.toLocaleFormat("%d"));
    //dateTime = replaceInsert(this.text.monthDate, 1, month);
    dateTime = replaceInsert("#1 #2", 1, month);
    dateTime = replaceInsert(dateTime, 2, date);
  } else {
    // not this year, so show year as wel
    let month = end.toLocaleFormat("%B");
    let year = end.toLocaleFormat("%Y");
    // Remove leading 0 by converting the date string to a number
    let date = Number(end.toLocaleFormat("%d"));
    //dateTime = replaceInsert(this.text.monthDate, 1, month);
    dateTime = replaceInsert("#1 #2 #3", 1, month);
    dateTime = replaceInsert(dateTime, 2, date);
    dateTime = replaceInsert(dateTime, 3, year);
  }
  return dateTime;
}

/**
 * Helper function to replace a placeholder string with a real string
 *
 * @param aText
 *        Source text containing placeholder (e.g., #1)
 * @param aIndex
 *        Index number of placeholder to replace
 * @param aValue
 *        New string to put in place of placeholder
 * @return The string with placeholder replaced with the new string
 */
function replaceInsert(aText, aIndex, aValue)
{
  return aText.replace("#" + aIndex, aValue);
}

/**
 * Helper function to escape some XML chars, so they display properly in
 * innerHTML.
 *
 * @param s
 *        input text
 * @return The string with <, >, and & replaced by the corresponding entities.
 */
function escapeXMLchars(s)
{
    return s.replace(/[<>&]/g, function(s) {
        switch (s) {
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "&": return "&amp;";
            default: throw Error("Unexpected match");
            }
        }
    );
}

