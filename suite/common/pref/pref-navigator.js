/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <ben@netscape.com>
 *   Alec Flett <alecf@netscape.com>
 *   Stephen Walker <walk84@yahoo.com>
 *   Christopher A. Aillon <christopher@aillon.com>
 *   Ian Neal <ian@arlen.demon.co.uk>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
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

// The contents of this file will be loaded into the scope of the object
// <prefpane id="navigator_pane">!

// put "global" definitions here for easy reference
var gHomePageGroupIsSet = "";
var gDefaultPage = "";
var gHomePages = [];


function GetHomePageValue()
{
  return document.getElementById("browserStartupHomepage").value;
}

function SetHomePageValue(aValue)
{
  document.getElementById("browserStartupHomepage").value = aValue;
}

function GetMostRecentBrowser()
{
  var windowManager = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                .getService(Components.interfaces.nsIWindowMediator);
  var browserWindow = windowManager.getMostRecentWindow("navigator:browser");
  return browserWindow && browserWindow.document.getElementById("content");
}

function GetCurrentPage()
{
  var tabbrowser = GetMostRecentBrowser();
  return tabbrowser && tabbrowser.currentURI.spec;
}

function GetCurrentPageGroup()
{
  var uris = [];
  var tabbrowser = GetMostRecentBrowser();
  if (tabbrowser)
  {
    var browsers = tabbrowser.browsers;
    var browsersLen = browsers.length;
    for (var i = 0; i < browsersLen; ++i)
      uris[i] = browsers[i].currentURI.spec;
  }
  return uris;
}

function UpdateHomePageButtons()
{
  var homepage = GetHomePageValue();

  // disable "current page" button if current page is already the homepage
  var currentPageButton = document.getElementById("browserUseCurrent");
  currentPageButton.disabled = (homepage == GetCurrentPage());

  // disable "default page" button if default page is already the homepage
  var defaultPageButton = document.getElementById("browserUseDefault");
  defaultPageButton.disabled = (homepage == gDefaultPage);

  // homePages.length == 1 if:
  //  - we're called from startup and there's one homepage
  //  - we're called from "current page" or "choose file"
  //  - the user typed something in the location field
  //   in those cases we only want to enable the button if:
  //    - there's more than one tab in the most recent browser
  // otherwise we have a group of homepages:
  //  - we're called from startup and there's a group of homepages
  //  - we're called from "current group"
  //   in those cases we only want to enable the button if:
  //    - there's more than one tab in the most recent browser and
  //      the current group doesn't match the group of homepages
  var enabled = false;
  if (gHomePages.length == 1)
  {
    var browser = GetMostRecentBrowser();
    enabled = !!browser && (browser.browsers.length > 1);
  }
  else
  {
    var currentURIs = GetCurrentPageGroup();
    if (currentURIs.length == gHomePages.length)
    {
      for (var i = 0; !enabled && (i < gHomePages.length); ++i)
      {
        if (gHomePages[i] != currentURIs[i])
          enabled = true;
      }
    }
    else if (currentURIs.length > 1)
    {
      enabled = true;
    }
  }

  var currentPageGroupButton = document.getElementById("browserUseCurrentGroup");
  currentPageGroupButton.disabled = !enabled;
}

function UpdateHomePageListFromInput()
{
  gHomePages = [GetHomePageValue()];
  UpdateHomePageButtons();
}

function UpdateHomePageList(aSingleURL)
{
  // write single URL into input box and set it as the list of homepages
  SetHomePageValue(aSingleURL);
  UpdateHomePageListFromInput();
}

function SelectFile()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  var prefutilitiesBundle = document.getElementById("bundle_prefutilities");
  var title = prefutilitiesBundle.getString("choosehomepage");
  fp.init(window, title, nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterAll  |
                   nsIFilePicker.filterText |
                   nsIFilePicker.filterXML  |
                   nsIFilePicker.filterHTML |
                   nsIFilePicker.filterImages);

  if (fp.show() == nsIFilePicker.returnOK)
    UpdateHomePageList(fp.fileURL.spec);
}

function SetHomePageToCurrentPage()
{
  UpdateHomePageList(GetCurrentPage());
}

function SetHomePageToDefaultPage()
{
  UpdateHomePageList(gDefaultPage);
}

function SetHomePageToCurrentGroup()
{
  var uris = GetCurrentPageGroup();
  if (uris.length > 0)
  {
    SetHomePageValue(gHomePageGroupIsSet);
    gHomePages = uris;
    UpdateHomePageButtons();
  }
}

function Startup()
{
  // initialize global strings
  gHomePageGroupIsSet = document.getElementById("bundle_prefutilities")
                                .getString("groupIsSet");
  gDefaultPage = document.getElementById("browser.startup.homepage").value;

  // initialize behaviourDeck
  SetPageAccessKeys(document.getElementById("behaviourDeck").firstChild);

  // homepage groups can have an arbitrary number of preferences,
  // thus we create them manually here 
  var uris = [];
  var preferences = document.getElementById("navigator_preferences");
  var count = document.getElementById("browser.startup.homepage.count").value;

  uris[0] = gDefaultPage;
  for (var i = 1; i < count; ++i)
  {
    // add new <preference> 
    var pref = document.createElement("preference");
    var prefname = "browser.startup.homepage." + i;
    pref.setAttribute("id", prefname);
    pref.setAttribute("name", prefname);
    pref.setAttribute("type", "string");
    preferences.appendChild(pref);

    // remember its URIs
    try
    {
      uris[i] = pref.value;
    }
    catch(e) {}
  }
  gHomePages = uris;

  if (uris.length == 1)
    SetHomePageValue(uris[0]);
  else
    SetHomePageValue(gHomePageGroupIsSet);
  UpdateHomePageButtons();

  // register our OK handler for the capturing(!) phase
  window.addEventListener("dialogaccept", this.OnDialogAccept, true);
}

function OnDialogAccept()
{
  // OK could have been hit from another pane,
  // so we need to get at our data the long but safer way
  var navigator_pane = document.getElementById("navigator_pane");

  // toolkit will save all our data for, we just need to make sure it's set
  var preferences = document.getElementById("navigator_preferences");
  var uris = navigator_pane.gHomePages;
  var uriCount = uris.length;
  if (uriCount > 0)
    document.getElementById("browser.startup.homepage").value = uris[0];
  var i = 1;
  for (; i < uriCount; ++i)
  {
    // store current value
    var prefname = "browser.startup.homepage." + i;
    var pref = document.getElementById(prefname);
    if (!pref)
    {
      pref = document.createElement("preference");
      pref.setAttribute("id", prefname);
      pref.setAttribute("name", prefname);
      pref.setAttribute("type", "string");
      preferences.appendChild(pref);
    }
    pref.value = uris[i];
  }

  // remove the old user prefs values that we didn't overwrite
  var countPref = document.getElementById("browser.startup.homepage.count");
  var oldCount = countPref.value;
  for (; i < oldCount; ++i)
  {
    // clear old pref
    var prefname = "browser.startup.homepage." + i;
    var pref = document.getElementById(prefname);
    if (pref)
    {
      pref.reset();
      pref.parentNode.removeChild(pref);
    }
  }
  countPref.value = uris.length;
}

// the following functions may seem weird, but they are needed to avoid
// accesskey clashes with hidden deck panes
function SetPageAccessKeys(aGroup)
{
  var nodes = aGroup.childNodes;
  for (var i = 0; i < nodes.length; ++i)
    nodes[i].accessKey = nodes[i].getAttribute("ak");
}

function RemovePageAccessKeys(aGroup)
{
  var nodes = aGroup.childNodes;
  for (var i = 0; i < nodes.length; ++i)
    nodes[i].accessKey = '';
}

function SwitchPage(aIndex)
{
  var deck = document.getElementById("behaviourDeck");
  RemovePageAccessKeys(deck.selectedPanel);
  deck.selectedIndex = aIndex;
  SetPageAccessKeys(deck.selectedPanel);
}
