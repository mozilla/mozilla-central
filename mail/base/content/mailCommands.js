# -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Communicator client code, released
# March 31, 1998.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998-1999
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Magnus Melin <mkmelin+mozilla@iki.fi>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

var gPromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                      .getService(Components.interfaces.nsIPromptService);

function getBestIdentity(identities, optionalHint)
{
  var identity = null;

  var identitiesCount = identities.Count();

  try
  {
    // if we have more than one identity and a hint to help us pick one
    if (identitiesCount > 1 && optionalHint) {
      // normalize case on the optional hint to improve our chances of finding a match
      optionalHint = optionalHint.toLowerCase();

      var id;
      // iterate over all of the identities
      var tempID;

      var lengthOfLongestMatchingEmail = 0;
      for each (var tempID in fixIterator(identities,
                                          Components.interfaces.nsIMsgIdentity)) {
        if (optionalHint.indexOf(tempID.email.toLowerCase()) >= 0) {
          // Be careful, the user can have several adresses with the same
          // postfix e.g. aaa.bbb@ccc.ddd and bbb@ccc.ddd. Make sure we get the
          // longest match.
          if (tempID.email.length > lengthOfLongestMatchingEmail) {
            identity = tempID;
            lengthOfLongestMatchingEmail = tempID.email.length;
          }
        }
      }

      // if we could not find an exact email address match within the hint fields then maybe the message
      // was to a mailing list. In this scenario, we won't have a match based on email address.
      // Before we just give up, try and search for just a shared domain between the hint and
      // the email addresses for our identities. Hey, it is better than nothing and in the case
      // of multiple matches here, we'll end up picking the first one anyway which is what we would have done
      // if we didn't do this second search. This helps the case for corporate users where mailing lists will have the same domain
      // as one of your multiple identities.

      if (!identity) {
        for (id = 0; id < identitiesCount; ++id) {
          tempID = identities.GetElementAt(id).QueryInterface(Components.interfaces.nsIMsgIdentity);
          // extract out the partial domain
          var start = tempID.email.lastIndexOf("@"); // be sure to include the @ sign in our search to reduce the risk of false positives
          if (optionalHint.search(tempID.email.slice(start).toLowerCase()) >= 0) {
            identity = tempID;
            break;
          }
        }
      }
    }
  }
  catch (ex) {dump (ex + "\n");}

  // Still no matches ?
  // Give up and pick the first one (if it exists), like we used to.
  if (!identity && identitiesCount > 0)
    identity = identities.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIdentity);

  return identity;
}

function getIdentityForServer(server, optionalHint)
{
    var identity = null;

    if (server) {
        // Get the identities associated with this server.
        var identities = accountManager.GetIdentitiesForServer(server);
        // dump("identities = " + identities + "\n");
        // Try and find the best one.
        identity = getBestIdentity(identities, optionalHint);
    }

    return identity;
}

function getIdentityForHeader(hdr, type)
{
  // If we treat reply from sent specially, do we check for that folder flag here ?
  var isTemplate = (type == Components.interfaces.nsIMsgCompType.Template);
  var hintForIdentity = isTemplate ? hdr.author : hdr.recipients + hdr.ccList;
  var identity = null;
  var server;

  var folder = hdr.folder;
  if (folder)
  {
    server = folder.server;
    identity = folder.customIdentity;
  }

  var accountKey = hdr.accountKey;
  if (accountKey.length > 0)
  {
    var account = accountManager.getAccount(accountKey);
    if (account)
      server = account.incomingServer;
  }

  if (server && !identity) 
    identity = getIdentityForServer(server, hintForIdentity);

  if (!identity)
  {
    var allIdentities = accountManager.allIdentities;
    identity = getBestIdentity(allIdentities, hintForIdentity);
  }
  return identity;
}

function GetNextNMessages(folder)
{
  if (folder) {
    var newsFolder = folder.QueryInterface(Components.interfaces.nsIMsgNewsFolder);
    if (newsFolder) {
      newsFolder.getNextNMessages(msgWindow);
    }
  }
}

// type is a nsIMsgCompType and format is a nsIMsgCompFormat
function ComposeMessage(type, format, folder, messageArray)
{
  var msgComposeType = Components.interfaces.nsIMsgCompType;
  var identity = null;
  var newsgroup = null;
  var server;

  // dump("ComposeMessage folder=" + folder + "\n");
  try
  {
    if (folder)
    {
      // Get the incoming server associated with this uri.
      server = folder.server;

      // If they hit new or reply and they are reading a newsgroup,
      // turn this into a new post or a reply to group.
      if (!folder.isServer && server.type == "nntp" && type == msgComposeType.New)
      {
        type = msgComposeType.NewsPost;
        newsgroup = folder.folderURL;
      }

      identity = folder.customIdentity;
      if (!identity)
        identity = getIdentityForServer(server);
      // dump("identity = " + identity + "\n");
    }
  }
  catch (ex)
  {
    dump("failed to get an identity to pre-select: " + ex + "\n");
  }

  // dump("\nComposeMessage from XUL: " + identity + "\n");
  var uri = null;

  if (!msgComposeService)
  {
    dump("### msgComposeService is invalid\n");
    return;
  }

  if (type == msgComposeType.New)
  {
    // New message.

    // dump("OpenComposeWindow with " + identity + "\n");

    // If the addressbook sidebar panel is open and has focus, get
    // the selected addresses from it.
    if (document.commandDispatcher.focusedWindow.document.documentElement.hasAttribute("selectedaddresses"))
      NewMessageToSelectedAddresses(type, format, identity);
    else
      msgComposeService.OpenComposeWindow(null, null, null, type, format, identity, msgWindow);
    return;
  }
  else if (type == msgComposeType.NewsPost)
  {
    // dump("OpenComposeWindow with " + identity + " and " + newsgroup + "\n");
    msgComposeService.OpenComposeWindow(null, null, newsgroup, type, format, identity, msgWindow);
    return;
  }

  messenger.setWindow(window, msgWindow);

  var object = null;

  if (messageArray && messageArray.length > 0)
  {
    uri = "";
    for (var i = 0; i < messageArray.length; ++i)
    {
      var messageUri = messageArray[i];

      var hdr = messenger.msgHdrFromURI(messageUri);
      identity = getIdentityForHeader(hdr, type);
      if (/^https?:/.test(hdr.messageId))
        openComposeWindowForRSSArticle(hdr, type);
      else if (type == msgComposeType.Reply ||
               type == msgComposeType.ReplyAll ||
               type == msgComposeType.ReplyToList ||
               type == msgComposeType.ForwardInline ||
               type == msgComposeType.ReplyToGroup ||
               type == msgComposeType.ReplyToSender ||
               type == msgComposeType.ReplyToSenderAndGroup ||
               type == msgComposeType.Template ||
               type == msgComposeType.Redirect ||
               type == msgComposeType.Draft)
      {
        msgComposeService.OpenComposeWindow(null, hdr, messageUri, type, format, identity, msgWindow);
        // Limit the number of new compose windows to 8. Why 8 ? I like that number :-)
        if (i == 7)
          break;
      }
      else
      {
        if (i)
          uri += ","
        uri += messageUri;
      }
    }
    // If we have more than one ForwardAsAttachment then pass null instead
    // of the header to tell the compose service to work out the attachment
    // subjects from the URIs.
    if (type == msgComposeType.ForwardAsAttachment && uri)
      msgComposeService.OpenComposeWindow(null,
                                          messageArray.length > 1 ? null : hdr,
                                          uri, type, format,
                                          identity, msgWindow);
  }
  else
    dump("### nodeList is invalid\n");
}

function NewMessageToSelectedAddresses(type, format, identity) {
  var abSidebarPanel = document.commandDispatcher.focusedWindow;
  var abResultsTree = abSidebarPanel.document.getElementById("abResultsTree");
  var abResultsBoxObject = abResultsTree.treeBoxObject;
  var abView = abResultsBoxObject.view;
  abView = abView.QueryInterface(Components.interfaces.nsIAbView);
  var addresses = abView.selectedAddresses;
  var params = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
  if (params) {
    params.type = type;
    params.format = format;
    params.identity = identity;
    var composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
    if (composeFields) {
      var addressList = "";
      for (var i = 0; i < addresses.Count(); i++) {
        addressList = addressList + (i > 0 ? ",":"") + addresses.QueryElementAt(i,Components.interfaces.nsISupportsString).data;
      }
      composeFields.to = addressList;
      params.composeFields = composeFields;
      msgComposeService.OpenComposeWindowWithParams(null, params);
    }
  }
}

function NewFolder(name, folder)
{
  if (!folder || !name)
    return;

  folder.createSubfolder(name, msgWindow);
}

function Subscribe(preselectedMsgFolder)
{
  window.openDialog("chrome://messenger/content/subscribe.xul",
                    "subscribe", "chrome,modal,titlebar,resizable=yes",
                    {folder:preselectedMsgFolder,
                      okCallback:SubscribeOKCallback});
}

function SubscribeOKCallback(changeTable)
{
  for (var serverURI in changeTable) {
    var folder = GetMsgFolderFromUri(serverURI, true);
    var server = folder.server;
    var subscribableServer =
          server.QueryInterface(Components.interfaces.nsISubscribableServer);

    for (var name in changeTable[serverURI]) {
      if (changeTable[serverURI][name] == true) {
        try {
          subscribableServer.subscribe(name);
        }
        catch (ex) {
          dump("failed to subscribe to " + name + ": " + ex + "\n");
        }
      }
      else if (changeTable[serverURI][name] == false) {
        try {
          subscribableServer.unsubscribe(name);
        }
        catch (ex) {
          dump("failed to unsubscribe to " + name + ": " + ex + "\n");
        }
      }
      else {
        // no change
      }
    }

    try {
      subscribableServer.commitSubscribeChanges();
    }
    catch (ex) {
      dump("failed to commit the changes: " + ex + "\n");
    }
  }
}

function SaveAsFile(uri)
{
  if (uri) {
    var filename = null;
    try {
      var subject = messenger.messageServiceFromURI(uri)
                             .messageURIToMsgHdr(uri).mime2DecodedSubject;
      filename = GenerateValidFilename(subject, ".eml");
    }
    catch (ex) {}
    messenger.saveAs(uri, true, null, filename);
  }
}

function SaveAsTemplate(uri, folder)
{
  if (uri) 
  {
    var hdr = messenger.msgHdrFromURI(uri);
    var identity = getIdentityForHeader(hdr, Components.interfaces.nsIMsgCompType.Template);
    messenger.saveAs(uri, false, identity, null);
  }
}

function MarkSelectedMessagesRead(markRead)
{
  ClearPendingReadTimer();
  gDBView.doCommand(markRead ? nsMsgViewCommandType.markMessagesRead : nsMsgViewCommandType.markMessagesUnread);
}

function MarkSelectedMessagesFlagged(markFlagged)
{
  gDBView.doCommand(markFlagged ? nsMsgViewCommandType.flagMessages : nsMsgViewCommandType.unflagMessages);
}

function ViewPageSource(messages)
{
  var numMessages = messages.length;

  if (numMessages == 0)
  {
    dump("MsgViewPageSource(): No messages selected.\n");
    return false;
  }

  try {
    // First, get the mail session
    const mailSessionContractID = "@mozilla.org/messenger/services/session;1";
    const nsIMsgMailSession = Components.interfaces.nsIMsgMailSession;
    var mailSession = Components.classes[mailSessionContractID].getService(nsIMsgMailSession);
    var mailCharacterSet = "charset=" + msgWindow.mailCharacterSet;

    for (var i = 0; i < numMessages; i++)
    {
      // Now, we need to get a URL from a URI
      var url = mailSession.ConvertMsgURIToMsgURL(messages[i], msgWindow);
      window.openDialog("chrome://global/content/viewSource.xul",
                        "_blank", "all,dialog=no", url,
                        mailCharacterSet);
    }
    return true;
  } catch (e) {
    // Couldn't get mail session
    return false;
  }
}
