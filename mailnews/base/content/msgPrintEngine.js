/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This is where functions related to the print engine are kept */

Components.utils.import("resource://gre/modules/Services.jsm");

/* globals for a particular window */
var printEngineContractID      = "@mozilla.org/messenger/msgPrintEngine;1";
var printEngineWindow;
var printEngine;
var printSettings = null;
var printOpener = null;

const kMsgBundle = "chrome://messenger/locale/messenger.properties";

/* Functions related to startup */
function OnLoadPrintEngine()
{
  PrintEngineCreateGlobals();
  InitPrintEngineWindow();
  printEngine.startPrintOperation(printSettings);
}

function PrintEngineCreateGlobals()
{
  /* get the print engine instance */
  printEngine = Components.classes[printEngineContractID].createInstance();
  printEngine = printEngine.QueryInterface(Components.interfaces.nsIMsgPrintEngine);
  printSettings = PrintUtils.getPrintSettings();
  if (printSettings) {
    printSettings.isCancelled = false;
  }
}

var PrintPreviewListener = {
  getPrintPreviewBrowser: function () {
    var browser = document.getElementById("ppBrowser");
    if (!browser) {
      browser = document.createElement("browser");
      browser.setAttribute("id", "ppBrowser");
      browser.setAttribute("flex", "1");
      browser.setAttribute("disablehistory", "true");
      browser.setAttribute("disablesecurity", "true");
      browser.setAttribute("type", "content");
      document.documentElement.appendChild(browser);
    }
    return browser;
  },
  getSourceBrowser: function () {
    return document.getElementById("content");
  },
  getNavToolbox: function () {
    return document.getElementById("content");
  },
  onEnter: function () {
    setPPTitle(document.getElementById("content").contentDocument.title);
    document.getElementById("content").collapsed = true;
    printEngine.showWindow(true);
  },
  onExit: function () {
    window.close();
  }
};

function getBundle(aURI)
{
  if (!aURI)
    return null;

  var bundle = null;
  try
  {
    bundle = Services.strings.createBundle(aURI);
  }
  catch (ex)
  {
    bundle = null;
    debug("Exception getting bundle " + aURI + ": " + ex);
  }

  return bundle;
}

function setPPTitle(aTitle)
{
  var title = aTitle;
  try {
  var gBrandBundle = document.getElementById("bundle_brand");
  if (gBrandBundle) {
    var msgBundle = this.getBundle(kMsgBundle);
    if (msgBundle) {
        var brandStr = gBrandBundle.getString("brandShortName")
        var array = [title, brandStr];
        title = msgBundle.formatStringFromName("PreviewTitle", array, array.length);
      }
    }
  } catch (e) {}
  document.title = title;
}

// Pref listener constants
const gStartupPPObserver =
{
  observe: function(subject, topic, prefName)
  {
    PrintUtils.printPreview(PrintPreviewListener);
  }
};

function ReplaceWithSelection()
{
  var selection = printOpener.content.getSelection();

  if ( selection != "" ) {
    var range = selection.getRangeAt( 0 );
    var contents = range.cloneContents();

    var aBody = window.content.document.querySelector( "body" );

    /* Replace the content of <body> with the users' selection. */
    if ( aBody ) {
      aBody.innerHTML = "";
      aBody.appendChild( contents );
    }
  }
}

function InitPrintEngineWindow()
{
  /* Store the current opener for later access in ReplaceWithSelection() */
  printOpener = opener;

  /* Register the event listener to be able to replace the document
   * content with the user selection when loading is finished.
   */
  document.getElementById("content").addEventListener("load", ReplaceWithSelection, true);

  /* Tell the nsIPrintEngine object what window is rendering the email */
  printEngine.setWindow(window);

  /* hide the printEngine window.  see bug #73995 */

  /* See if we got arguments.
   * Window was opened via window.openDialog.  Copy argument
   * and perform compose initialization 
   */
  if ( window.arguments && window.arguments[0] != null ) {
    var numSelected = window.arguments[0];
    var uriArray = window.arguments[1];
    var statusFeedback = window.arguments[2];

    if (window.arguments[3]) {
      printEngine.doPrintPreview = window.arguments[3];
    } else {
      printEngine.doPrintPreview = false;
    }
    printEngine.showWindow(false);

    if (window.arguments.length > 4) {
      printEngine.setMsgType(window.arguments[4]);
    } else {
      printEngine.setMsgType(Components.interfaces.nsIMsgPrintEngine.MNAB_START);
    }

    if (window.arguments.length > 5) {
      printEngine.setParentWindow(window.arguments[5]);
    } else {
      printEngine.setParentWindow(null);
    }

    printEngine.setStatusFeedback(statusFeedback);
    printEngine.setStartupPPObserver(gStartupPPObserver);

    if (numSelected > 0) {
      printEngine.setPrintURICount(numSelected);
      for (var i = 0; i < numSelected; i++) {
        printEngine.addPrintURI(uriArray[i]);      
        //dump(uriArray[i] + "\n");
      }	    
    }
  }
}

function ClearPrintEnginePane()
{
  if (window.frames["content"].location.href != "about:blank")
      window.frames["content"].location.href = "about:blank";
}

function StopUrls()
{
  printEngine.stopUrls();
}

function PrintEnginePrint()
{
  printEngineWindow = window.openDialog("chrome://messenger/content/msgPrintEngine.xul", "", "chrome,dialog=no,all,centerscreen", false);
}

function PrintEnginePrintPreview()
{
  printEngineWindow = window.openDialog("chrome://messenger/content/msgPrintEngine.xul", "", "chrome,dialog=no,all,centerscreen", true);
}
