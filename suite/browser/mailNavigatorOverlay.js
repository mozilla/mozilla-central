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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Edmund Wong <ewong@pw-wspx.org>
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

var gUseExternalMailto;

// attachment: 0 - link
//             1 - page
//             2 - image
function openComposeWindow(url, title, attachment, charset)
{
  if (gUseExternalMailto)
  {
    openExternalMailer(url, title);
  }
  else
  {
    var params = Components.classes["@mozilla.org/messengercompose/composeparams;1"]
                           .createInstance(Components.interfaces.nsIMsgComposeParams);

    params.composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                                     .createInstance(Components.interfaces.nsIMsgCompFields);
    if (attachment == 0 || attachment == 1)
    {
      params.composeFields.body = url;
      params.composeFields.subject = title;
      params.bodyIsLink = true;
    }

    if (attachment == 1 || attachment == 2)
    {
      var attachmentData = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                     .createInstance(Components.interfaces.nsIMsgAttachment);
      attachmentData.url = url;
      attachmentData.urlCharset = charset;
      params.composeFields.addAttachment(attachmentData);
    }

    var composeService = Components.classes["@mozilla.org/messengercompose;1"]
                                   .getService(Components.interfaces.nsIMsgComposeService);

    // it is possible you won't have a default identity
    // like if you've never launched mail before on a new profile.
    // see bug #196073
    try
    {
      params.identity = composeService.defaultIdentity;
    }
    catch (ex)
    {
      params.identity = null;
    }

    composeService.OpenComposeWindowWithParams(null, params);
  }
}

function openExternalMailer(url, title) {
  var extProtocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                                 .getService(Components.interfaces.nsIExternalProtocolService);
  var mailto = url ? "mailto:?body=" + encodeURIComponent(url)
                                     + "&subject="
                                     + encodeURIComponent(title) : "mailto:";
  var uri = Services.io.newURI(mailto, null, null);

  extProtocolSvc.loadUrl(uri);
}

function openNewCardDialog()
{
  window.openDialog("chrome://messenger/content/addressbook/abNewCardDialog.xul",
                    "", "chrome,modal,resizable=no,centerscreen");
}

function goOpenNewMessage()
{
  if (gUseExternalMailto)
  {
    openExternalMailer();
  }
  else if ("MsgNewMessage" in window)
  {
    MsgNewMessage(null);
  }
  else
  {
    var msgComposeService = Components.classes["@mozilla.org/messengercompose;1"]
                                      .getService(Components.interfaces.nsIMsgComposeService);
    msgComposeService.OpenComposeWindow(null, null, null,
                                       Components.interfaces.nsIMsgCompType.New,
                                       Components.interfaces.nsIMsgCompFormat.Default,
                                       null, null);
  }
}

function sendLink(aURL)
{
  var title = "";
  if (!aURL)
  {
    aURL = window.content.document.URL;
    title = window.content.document.title;
  }
  try
  {
    openComposeWindow(aURL, title, 0, null);
  }
  catch(ex)
  {
    dump("Cannot Send Link: " + ex + "\n");
  }
}

function sendMedia(mediaURL)
{
  try
  {
    var charset = getCharsetforSave(null);
    openComposeWindow(mediaURL, null, 2, charset);
  }
  catch(ex)
  {
    dump("Cannot Send Media: " + ex + "\n");
  }
}

function sendPage(aDocument)
{
  if (!aDocument)
    aDocument = window.content.document;
    
  try
  {
    var charset = getCharsetforSave(aDocument);
    openComposeWindow(aDocument.URL, aDocument.title, 1, charset);
  }
  catch(ex)
  {
    dump("Cannot Send Page: " + ex + "\n");
  }
}

function initMailContextMenuItems(aEvent)
{
  var shouldShowSendPage = !(gContextMenu.onTextInput || gContextMenu.isContentSelected ||
                           gContextMenu.onVideo || gContextMenu.onAudio) &&
                           !(gContextMenu.onLink && gContextMenu.onImage) &&
                           !gUseExternalMailto;
  gContextMenu.showItem("context-sendpage", shouldShowSendPage);

  gContextMenu.showItem("context-sep-apps", gContextMenu.shouldShowSeparator("context-sep-apps"));
}
  
function initMailContextMenuPopupListener(aEvent)
{
  var popup = document.getElementById("contentAreaContextMenu");
  if (popup)
    popup.addEventListener("popupshowing", initMailContextMenuItems, false);
}

function hideMenuitems() {
  document.getElementById("menu_newCard").hidden = gUseExternalMailto;
  var menu_sendPage = document.getElementById("menu_sendPage");
  if (menu_sendPage)
    menu_sendPage.hidden = gUseExternalMailto;
}

function initOverlay(aEvent) {
  gUseExternalMailto = Services.io.getProtocolHandler("mailto") instanceof
                         Components.interfaces.nsIExternalProtocolHandler;
  initMailContextMenuPopupListener(aEvent);
  hideMenuitems();
}

addEventListener("load", initOverlay, false);
