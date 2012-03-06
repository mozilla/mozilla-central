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

Components.utils.import("resource:///modules/gloda/mimemsg.js");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

function openSubscriptionsDialog(aFolder)
{
  // Check for an existing feed subscriptions window and focus it.
  let subscriptionsWindow =
    Services.wm.getMostRecentWindow("Mail:News-BlogSubscriptions");

  if (subscriptionsWindow)
  {
    if (aFolder)
      subscriptionsWindow.gFeedSubscriptionsWindow.selectFolder(aFolder);
    subscriptionsWindow.focus();
  }
  else
  {
    window.openDialog("chrome://messenger-newsblog/content/feed-subscriptions.xul",
                      "", "centerscreen,chrome,dialog=no,resizable",
                      { folder: aFolder});
  }
}

// Special case attempts to reply/forward/edit as new RSS articles.  We are
// here only if the message's account server is rss.  Feed messages moved to
// other account types will have their summaries loaded, as viewing web pages
// only happens in an rss account.  The user may choose whether to load a
// summary or web page link by ensuring the current feed message is being
// viewed as either a summary or web page.
function openComposeWindowForRSSArticle(aMsgComposeWindow, aMsgHdr, aMessageUri,
                                        aType, aFormat, aIdentity, aMsgWindow)
{
  if (gShowFeedSummary)
  {
    // The user is viewing the summary.
    MailServices.compose.OpenComposeWindow(aMsgComposeWindow, aMsgHdr, aMessageUri,
                                           aType, aFormat, aIdentity, aMsgWindow);

  }
  else
  {
    // Set up the compose message and get the feed message's web page link.
    let Cc = Components.classes;
    let Ci = Components.interfaces;
    let msgHdr = aMsgHdr;
    let type = aType;
    let msgComposeType = Ci.nsIMsgCompType;
    let subject = msgHdr.mime2DecodedSubject;
    let fwdPrefix = Services.prefs.getCharPref("mail.forward_subject_prefix");
    fwdPrefix = fwdPrefix ? fwdPrefix + ": " : "";

    let params = Cc["@mozilla.org/messengercompose/composeparams;1"].
                 createInstance(Ci.nsIMsgComposeParams);

    let composeFields = Cc["@mozilla.org/messengercompose/composefields;1"].
                        createInstance(Ci.nsIMsgCompFields);

    if (type == msgComposeType.Reply ||
        type == msgComposeType.ReplyAll ||
        type == msgComposeType.ReplyToSender ||
        type == msgComposeType.ReplyToGroup ||
        type == msgComposeType.ReplyToSenderAndGroup)
    {
      subject = "Re: " + subject;
    }
    else if (type == msgComposeType.ForwardInline ||
             type == msgComposeType.ForwardAsAttachment)
    {
      subject = fwdPrefix + subject;
    }

    params.composeFields = composeFields;
    params.composeFields.subject = subject;
    params.composeFields.characterSet = msgHdr.Charset;
    params.composeFields.body = "";
    params.bodyIsLink = false;
    params.identity = aIdentity;

    try
    {
      // The feed's web page url is stored in the Content-Base header.
      MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
        if (aMimeMsg && aMimeMsg.headers["content-base"] &&
            aMimeMsg.headers["content-base"][0])
        {
          params.composeFields.body = aMimeMsg.headers["content-base"];
          params.bodyIsLink = true;
          MailServices.compose.OpenComposeWindowWithParams(null, params);
        }
        else
          // No content-base url, use the summary.
          MailServices.compose.OpenComposeWindow(aMsgComposeWindow, aMsgHdr, aMessageUri,
                                                 aType, aFormat, aIdentity, aMsgWindow);

      });
    }
    catch (ex)
    {
      // Error getting header, use the summary.
      MailServices.compose.OpenComposeWindow(aMsgComposeWindow, aMsgHdr, aMessageUri,
                                             aType, aFormat, aIdentity, aMsgWindow);
    }
  }
}
