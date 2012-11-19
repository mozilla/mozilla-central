/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Dependencies:
// gBrandBundle, gMessengerBundle should already be defined
// gatherTextUnder from utilityOverlay.js

Components.utils.import("resource:///modules/hostnameUtils.jsm");

const kPhishingNotSuspicious = 0;
const kPhishingWithIPAddress = 1;
const kPhishingWithMismatchedHosts = 2;

//////////////////////////////////////////////////////////////////////////////
// isEmailScam --> examines the message currently loaded in the message pane
//                 and returns true if we think that message is an e-mail scam.
//                 Assumes the message has been completely loaded in the message pane (i.e. OnMsgParsed has fired)
// aUrl: nsIURI object for the msg we want to examine...
//////////////////////////////////////////////////////////////////////////////
function isMsgEmailScam(aUrl)
{
  var isEmailScam = false; 
  if (!aUrl || !Services.prefs.getBoolPref("mail.phishing.detection.enabled"))
    return isEmailScam;

  try {
    // nsIMsgMailNewsUrl.folder can throw an NS_ERROR_FAILURE, especially if
    // we are opening an .eml file.
    var folder = aUrl.folder;

    // Ignore NNTP and RSS messages.
    if (folder.server.type == 'nntp' || folder.server.type == 'rss')
      return isEmailScam;

    // Also ignore messages in Sent/Drafts/Templates/Outbox.
    const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    let outgoingFlags = nsMsgFolderFlags.SentMail | nsMsgFolderFlags.Drafts |
                        nsMsgFolderFlags.Templates | nsMsgFolderFlags.Queue;
    if (folder.isSpecialFolder(outgoingFlags, true))
      return isEmailScam;

  } catch (ex) {
    if (ex.result != Components.results.NS_ERROR_FAILURE)
      throw ex;
  }

  // loop through all of the link nodes in the message's DOM, looking for phishing URLs...
  var msgDocument = document.getElementById('messagepane').contentDocument;
  var index;

  // examine all links...
  var linkNodes = msgDocument.links;
  for (index = 0; index < linkNodes.length && !isEmailScam; index++)
    isEmailScam = isPhishingURL(linkNodes[index], true);

  // if an e-mail contains a non-addressbook form element, then assume the message is
  // a phishing attack. Legitimate sites should not be using forms inside of e-mail
  if (!isEmailScam)
  {
    var forms = msgDocument.getElementsByTagName("form");
    for (index = 0; index < forms.length && !isEmailScam; index++)
      isEmailScam = forms[index].action != "" && !/^addbook:/.test(forms[index].action);
  }

  // we'll add more checks here as our detector matures....
  return isEmailScam;
}

//////////////////////////////////////////////////////////////////////////////
// isPhishingURL --> examines the passed in linkNode and returns true if we think
//                   the URL is an email scam.
// aLinkNode: the link node to examine
// aSilentMode: don't prompt the user to confirm
// aHref: optional href for XLinks
//////////////////////////////////////////////////////////////////////////////

function isPhishingURL(aLinkNode, aSilentMode, aHref)
{
  if (!Services.prefs.getBoolPref("mail.phishing.detection.enabled"))
    return false;

  var phishingType = kPhishingNotSuspicious;
  var href = aHref || aLinkNode.href;
  if (!href)
    return false;

  var linkTextURL = {};
  var isPhishingURL = false;

  var hrefURL = Services.io.newURI(href, null, null);
  
  // only check for phishing urls if the url is an http or https link.
  // this prevents us from flagging imap and other internally handled urls
  if (hrefURL.schemeIs('http') || hrefURL.schemeIs('https'))
  {
    let ipAddress = isLegalIPAddress(hrefURL.host, true);
    if (ipAddress && !isLegalLocalIPAddress(ipAddress))
      phishingType = kPhishingWithIPAddress;
    else if (misMatchedHostWithLinkText(aLinkNode, hrefURL, linkTextURL))
      phishingType = kPhishingWithMismatchedHosts;

    isPhishingURL = phishingType != kPhishingNotSuspicious;

    if (!aSilentMode && isPhishingURL) // allow the user to override the decision
      isPhishingURL = confirmSuspiciousURL(phishingType, hrefURL.host);
  }

  return isPhishingURL;
}

//////////////////////////////////////////////////////////////////////////////
// helper methods in support of isPhishingURL
//////////////////////////////////////////////////////////////////////////////

function misMatchedHostWithLinkText(aLinkNode, aHrefURL, aLinkTextURL)
{
  var linkNodeText = gatherTextUnder(aLinkNode);

  // gatherTextUnder puts a space between each piece of text it gathers,
  // so strip the spaces out (see bug 326082 for details).
  linkNodeText = linkNodeText.replace(/ /g, "");

  // only worry about http and https urls
  if (linkNodeText)
  {
    // does the link text look like a http url?
     if (linkNodeText.search(/(^http:|^https:)/) != -1)
     {
       var linkTextURL  = Services.io.newURI(linkNodeText, null, null);
       aLinkTextURL.value = linkTextURL;
       // compare hosts, but ignore possible www. prefix
       return !(aHrefURL.host.replace(/^www\./, "") == aLinkTextURL.value.host.replace(/^www\./, ""));
     }
  }

  return false;
}

// returns true if the user confirms the URL is a scam
function confirmSuspiciousURL(aPhishingType, aSuspiciousHostName)
{
  var brandShortName = gBrandBundle.getString("brandShortName");
  var titleMsg = gMessengerBundle.getString("confirmPhishingTitle");
  var dialogMsg;

  switch (aPhishingType)
  {
    case kPhishingWithIPAddress:
    case kPhishingWithMismatchedHosts:
      dialogMsg = gMessengerBundle.getFormattedString("confirmPhishingUrl" + aPhishingType, [brandShortName, aSuspiciousHostName], 2);
      break;
    default:
      return false;
  }

  var buttons = Services.prompt.STD_YES_NO_BUTTONS +
                Services.prompt.BUTTON_POS_1_DEFAULT;
  return Services.prompt.confirmEx(window, titleMsg, dialogMsg, buttons, "", "", "", "", {}); /* the yes button is in position 0 */
}
