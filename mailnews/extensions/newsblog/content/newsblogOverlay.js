# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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
# The Original Code is Thunderbird Newsblog Overlay
#
# The Initial Developer of the Original Code is
# The Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2005
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Scott MacGregor <mscott@mozilla.org>
#  David Bienvenu <bienvenu@nventure.com>
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
# ***** END LICENSE BLOCK ******

function openSubscriptionsDialog(aFolder, aServer)
{
  if (!aServer)
    aServer = aFolder.server;
  //check for an existing subscriptions window and focus it.
  const kWindowMediatorContractID = "@mozilla.org/appshell/window-mediator;1";
  const kWindowMediatorIID = Components.interfaces.nsIWindowMediator;
  const kWindowMediator = Components.classes[kWindowMediatorContractID]
                                    .getService(kWindowMediatorIID);
  var lastSubscriptionWindow =
    kWindowMediator.getMostRecentWindow("Mail:News-BlogSubscriptions");
  
  if (lastSubscriptionWindow)
  {
    if (aFolder)
      lastSubscriptionWindow.gFeedSubscriptionsWindow.selectFolder(aFolder);
    lastSubscriptionWindow.focus();
  }
  else
  {
    window.openDialog("chrome://messenger-newsblog/content/feed-subscriptions.xul", "",
                      "centerscreen,chrome,dialog=no,resizable",
                      { server: aServer, folder: aFolder});
  }
}

// Special case attempts to reply/forward/edit as new RSS arrticles
// Send the feed article URL instead of trying to load the feed inside of
// an iframe. Bug #258278.
function openComposeWindowForRSSArticle(msgHdr, type)
{
  // convert our messageId into a url..
  var contentBase = msgHdr.messageId.replace("@localhost.localdomain", "");

  var params = Components.classes["@mozilla.org/messengercompose/composeparams;1"]
                         .createInstance(Components.interfaces.nsIMsgComposeParams);
  if (params)
  {
    params.composeFields = Components.classes['@mozilla.org/messengercompose/composefields;1']
                                     .createInstance(Components.interfaces.nsIMsgCompFields);
    if (params.composeFields)
    {
      params.composeFields.body = contentBase;
      var subject = msgHdr.mime2DecodedSubject;
      var msgComposeType = Components.interfaces.nsIMsgCompType;
      if (type == msgComposeType.Reply ||
          type == msgComposeType.ReplyAll ||
          type == msgComposeType.ReplyToSender ||
          type == msgComposeType.ReplyToGroup ||
          type == msgComposeType.ReplyToSenderAndGroup)
        subject = 'Re: ' + subject;
      else if (type == msgComposeType.ForwardInline ||
               type == msgComposeType.ForwardAsAttachment)
        subject = '[Fwd: ' + subject + ']';
      params.composeFields.subject = subject;
      params.composeFields.characterSet = msgHdr.Charset;
      params.bodyIsLink = true;

      if (msgComposeService)
      {
        try
        {
          params.identity = msgComposeService.defaultIdentity;
        }
        catch (ex)
        {
          params.identity = null;
        }
        msgComposeService.OpenComposeWindowWithParams(null, params);
      }
    }
  }
}
