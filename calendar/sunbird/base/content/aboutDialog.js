/* -*- Mode: Java; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gSelectedPage = 0;

function init(aEvent) 
{
  if (aEvent.target != document)
    return;
  var userAgentField = document.getElementById("userAgent");
  userAgentField.value = navigator.userAgent;

  var button = document.documentElement.getButton("extra2");
  button.setAttribute("label", document.documentElement.getAttribute("creditslabel"));
  button.setAttribute("accesskey", document.documentElement.getAttribute("creditsaccesskey"));
  button.addEventListener("command", switchPage, false);

  document.documentElement.getButton("accept").focus();
}

function uninit(aEvent)
{
  if (aEvent.target != document)
    return;
  var iframe = document.getElementById("creditsIframe");
  iframe.setAttribute("src", "");
}

function switchPage(aEvent)
{
  var button = aEvent.target;
  if (button.localName != "button")
    return;

  var iframe = document.getElementById("creditsIframe");
  if (gSelectedPage == 0) { 
    iframe.setAttribute("src", "chrome://sunbird/content/credits.xhtml");
    button.setAttribute("label", document.documentElement.getAttribute("aboutlabel"));
    button.setAttribute("accesskey", document.documentElement.getAttribute("aboutaccesskey"));
    gSelectedPage = 1;
  }
  else {
    iframe.setAttribute("src", ""); 
    button.setAttribute("label", document.documentElement.getAttribute("creditslabel"));
    button.setAttribute("accesskey", document.documentElement.getAttribute("creditsaccesskey"));
    gSelectedPage = 0;
  }
  var modes = document.getElementById("modes");
  modes.setAttribute("selectedIndex", gSelectedPage);
}

