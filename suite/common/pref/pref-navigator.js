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

// platform integration
const PFINT_NOT_DEFAULT = 0;
const PFINT_DEFAULT     = 1;
const PFINT_PENDING     = 2;


// put "global" definitions here for easy reference
var gDefaultHomePage = "";
var gHomePagePrefPeak = 0;
var gPreferences = null;


// <preferences> access helper methods
function GetHomePagePrefCount()
{
  return document.getElementById("browser.startup.homepage.count").value;
}

function SetHomePagePrefCount(aCount)
{
  document.getElementById("browser.startup.homepage.count").value = aCount;
}

function GetHomePagePrefName(aIndex)
{
  var prefname = "browser.startup.homepage";
  if (aIndex > 0)
    prefname += "." + aIndex;
  return prefname;
}

function GetHomePagePref(aIndex)
{
  // return the <preference> at aIndex
  return document.getElementById(GetHomePagePrefName(aIndex));
}

function AddHomePagePref(aIndex)
{
  // create new <preference> for aIndex
  var pref = document.createElement("preference");
  var prefname = GetHomePagePrefName(aIndex);
  pref.setAttribute("id",   prefname);
  pref.setAttribute("name", prefname);
  pref.setAttribute("type", "wstring");
  gPreferences.appendChild(pref);
  return pref;
}

// homepage group textbox helper methods
function GetHomePageGroup()
{
  return document.getElementById("browserStartupHomepage").value;
}

function SetHomePageValue(aValue)
{
  document.getElementById("browserStartupHomepage").value = aValue;
}

// helper methods for reading current page URIs
function GetMostRecentBrowser()
{
  var windowManager = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                .getService(Components.interfaces.nsIWindowMediator);
  var browserWindow = windowManager.getMostRecentWindow("navigator:browser");
  return browserWindow && browserWindow.getBrowser();
}

function GetCurrentPage()
{
  var tabbrowser = GetMostRecentBrowser();
  return tabbrowser && tabbrowser.currentURI.spec || ""; // ensure string
}

function GetCurrentGroup()
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
  return uris.join("\n");
}

// synchronize button states with current input
function CanonifyURLList(aList)
{
  return (aList + "\n").replace(/\n+/g, "\n");
}

function UpdateHomePageButtons()
{
  var homePageGroup = CanonifyURLList(GetHomePageGroup());
  var currentPage   = CanonifyURLList(GetCurrentPage());
  var currentGroup  = CanonifyURLList(GetCurrentGroup());

  // disable "current page" button if current page is already the homepage
  var currentPageButton = document.getElementById("browserUseCurrent");
  currentPageButton.disabled = (homePageGroup == currentPage) ||
                               (currentPage == "\n");

  // disable "current group" button if current group already set or no group
  var currentGroupButton = document.getElementById("browserUseCurrentGroup");
  currentGroupButton.disabled = (homePageGroup == currentGroup) ||
                                (currentGroup == currentPage);

  // disable "restore" button if homepage hasn't changed
  var restoreButton = document.getElementById("browserUseDefault");
  restoreButton.disabled = (homePageGroup == gDefaultHomePage);
}

function UpdateHomePagePrefs()
{
  // update the list of <preference>s to the current settings
  var newCount = 0; // current number of homepages
  var homePageGroup = CanonifyURLList(GetHomePageGroup()).split("\n");
  if (homePageGroup[0])
  {
    // we have at least one homepage
    // (the last index is always empty due to canonification)
    newCount = homePageGroup.length - 1
    for (var i = 0; i < newCount; ++i)
    {
      var pref = GetHomePagePref(i) || AddHomePagePref(i);
      pref.value = homePageGroup[i];
    }
  }

  // work around bug 410562:
  // reset unneeded preferences on dialogaccept only
  
  // update pref count watermark before setting new number of homepages
  var alreadyRequested = (gHomePagePrefPeak > 0);
  var oldCount = GetHomePagePrefCount();
  if (gHomePagePrefPeak < oldCount)
    gHomePagePrefPeak = oldCount;
  SetHomePagePrefCount(newCount);

  var needCleanup = (newCount < gHomePagePrefPeak);
  if (document.documentElement.instantApply)
  {
    // throw away unneeded preferences now
    if (needCleanup)
      HomePagePrefCleanup();
  }
  else if (needCleanup != alreadyRequested)
  {
    // cleanup necessity changed
    if (needCleanup)
    {
      // register OK handler for the capturing phase
      window.addEventListener("dialogaccept", this.HomePagePrefCleanup, true);
    }
    else
    {
      // no cleanup necessary, remove OK handler
      window.removeEventListener("dialogaccept", this.HomePagePrefCleanup, true);
    }
  }
}

function HomePagePrefCleanup()
{
  // remove the old user prefs values that we didn't overwrite
  var count = GetHomePagePrefCount();
  for (var j = count; j < gHomePagePrefPeak; ++j)
  {
    // clear <preference>
    var pref = GetHomePagePref(j);
    pref.reset();
    pref.parentNode.removeChild(pref);
  }
  gHomePagePrefPeak = 0; // cleanup done
}

function UpdateHomePageListFromInput()
{
  UpdateHomePagePrefs();
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

function SetHomePageToCurrentGroup()
{
  UpdateHomePageList(GetCurrentGroup());
}

function SetHomePageToDefaultPage()
{
  UpdateHomePageList(gDefaultHomePage);
}

function Startup()
{
  // homepage groups can have an arbitrary number of <preference>s,
  // thus we create them manually here 
  gPreferences = document.getElementById("navigator_preferences");
  var homePageGroup = "";
  var count = GetHomePagePrefCount();
  for (var i = 0; i < count; ++i)
  {
    var pref = AddHomePagePref(i);
    homePageGroup += pref.value + "\n";
  }
  gDefaultHomePage = CanonifyURLList(GetHomePagePref(0).defaultValue);
  SetHomePageValue(homePageGroup);
  UpdateHomePageButtons();

  // platform integration
  InitPlatformIntegration();
}

function SwitchPage(aIndex)
{
  document.getElementById("behaviourDeck").selectedIndex = aIndex;
}

// platform integration

function ApplySetAsDefaultBrowser()
{
  const nsIShellService = Components.interfaces.nsIShellService;
  var shellSvc = Components.classes["@mozilla.org/suite/shell-service;1"]
                           .getService(nsIShellService);

  shellSvc.setDefaultClient(false, false, nsIShellService.BROWSER);
  shellSvc.shouldBeDefaultClientFor |= nsIShellService.BROWSER;
}

function InitPlatformIntegration()
{
  const NS_SHELLSERVICE_CID = "@mozilla.org/suite/shell-service;1";

  if (NS_SHELLSERVICE_CID in Components.classes) {
    const nsIShellService = Components.interfaces.nsIShellService;
    var shellSvc = Components.classes["@mozilla.org/suite/shell-service;1"]
                             .getService(nsIShellService);
    var desc = document.getElementById("defaultBrowserDesc");
    document.getElementById("defaultBrowserGroup").hidden = false;

    if (shellSvc.isDefaultClient(false, nsIShellService.BROWSER))
      desc.textContent = desc.getAttribute("desc1");
    else {
      desc.textContent = desc.getAttribute("desc0");
      document.getElementById("defaultBrowserButton").disabled = false;
    }
  }
}

function SetAsDefaultBrowser()
{
  document.getElementById("defaultBrowserButton").disabled = true;

  if (document.documentElement.instantApply)
  {
    var desc = document.getElementById("defaultBrowserDesc"); 
    desc.textContent = desc.getAttribute("desc1");
    ApplySetAsDefaultBrowser();
  }
  else
  {
    // register OK handler for the capturing phase
    var desc = document.getElementById("defaultBrowserDesc");
    desc.textContent = desc.getAttribute("desc2");
    window.addEventListener("dialogaccept", this.ApplySetAsDefaultBrowser, true);
  }
}
