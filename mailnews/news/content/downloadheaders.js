/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");

var markreadElement = null;
var numberElement = null;

var nntpServer = null;
var args = null;

function OnLoad()
{
  let newsBundle = document.getElementById("bundle_news");

  if ("arguments" in window && window.arguments[0]) {
    args = window.arguments[0]
                 .QueryInterface(Components.interfaces.nsINewsDownloadDialogArgs);
    /* by default, act like the user hit cancel */
    args.hitOK = false;
    /* by default, act like the user did not select download all */
    args.downloadAll = false;


    nntpServer = MailServices.accounts.getIncomingServer(args.serverKey)
               .QueryInterface(Components.interfaces.nsINntpIncomingServer);

    document.title = newsBundle.getString("downloadHeadersTitlePrefix");

    let infotext = newsBundle.getFormattedString("downloadHeadersInfoText",
                                                 [args.articleCount]);
    setText('info', infotext);
    let okButtonText = newsBundle.getString("okButtonText");
    let okbutton = document.documentElement.getButton("accept");
    okbutton.setAttribute("label", okButtonText);
    okbutton.focus();
    setText("newsgroupLabel", args.groupName);
  }

  numberElement = document.getElementById("number");
  numberElement.value = nntpServer.maxArticles;

  markreadElement = document.getElementById("markread");
  markreadElement.checked = nntpServer.markOldRead;

  return true;
}

function setText(id, value) {
  let element = document.getElementById(id);
  if (!element)
    return;

  if (element.hasChildNodes())
    element.removeChild(element.firstChild);
  let textNode = document.createTextNode(value);
  element.appendChild(textNode);
}

function OkButtonCallback() {
  nntpServer.maxArticles = numberElement.value;
  nntpServer.markOldRead = markreadElement.checked;

  let radio = document.getElementById("all");
  if (radio)
    args.downloadAll = radio.selected;

  args.hitOK = true;
  return true;
}

function CancelButtonCallback() {
  args.hitOK = false;
  return true;
}

function setupDownloadUI(enable) {
  let checkbox = document.getElementById("markread");
  let numberFld = document.getElementById("number");

  checkbox.disabled = !enable;
  numberFld.disabled = !enable;
}
