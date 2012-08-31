/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    {
      subscriptionsWindow.FeedSubscriptions.selectFolder(aFolder);
      subscriptionsWindow.FeedSubscriptions.mView.treeBox.ensureRowIsVisible(
        subscriptionsWindow.FeedSubscriptions.mView.selection.currentIndex);
    }

    subscriptionsWindow.focus();
  }
  else
  {
    window.openDialog("chrome://messenger-newsblog/content/feed-subscriptions.xul",
                      "", "centerscreen,chrome,dialog=no,resizable",
                      { folder: aFolder});
  }
}

// Special case attempts to reply/forward/edit as new RSS articles.  For
// messages stored prior to Tb15, we are here only if the message's folder's
// account server is rss and feed messages moved to other types will have their
// summaries loaded, as viewing web pages only happened in an rss account.
// The user may choose whether to load a summary or web page link by ensuring
// the current feed message is being viewed as either a summary or web page.
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

      }, false, {saneBodySize: true});
    }
    catch (ex)
    {
      // Error getting header, use the summary.
      MailServices.compose.OpenComposeWindow(aMsgComposeWindow, aMsgHdr, aMessageUri,
                                             aType, aFormat, aIdentity, aMsgWindow);
    }
  }
}
