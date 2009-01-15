/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 *   Peter Annema <disttsc@bart.nl>
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

const nsIDOMWindowInternal = Components.interfaces.nsIDOMWindowInternal;
const nsIWindowMediator = Components.interfaces.nsIWindowMediator;
const nsIWindowDataSource = Components.interfaces.nsIWindowDataSource;

function toNavigator()
{
  if (!CycleWindow("navigator:browser"))
    OpenBrowserWindow();
}

function toPasswordManager()
{
  toOpenWindowByType("Password:Manager",
                     "chrome://communicator/content/passwordManager.xul");
}

function ExpirePassword()
{
  // Queries the HTTP Auth Manager and clears all sessions
  Components.classes['@mozilla.org/network/http-auth-manager;1']
            .getService(Components.interfaces.nsIHttpAuthManager)
            .clearAll();

  // Expires the master password
  Components.classes["@mozilla.org/security/sdr;1"]
            .getService(Components.interfaces.nsISecretDecoderRing)
            .logoutAndTeardown();
}

function toDownloadManager()
{
  var dlmgr = Components.classes['@mozilla.org/download-manager;1'].getService();
  dlmgr = dlmgr.QueryInterface(Components.interfaces.nsIDownloadManager);

  var windowMediator = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  windowMediator = windowMediator.QueryInterface(nsIWindowMediator);

  var dlmgrWindow = windowMediator.getMostRecentWindow("Download:Manager");
  if (dlmgrWindow) {
    dlmgrWindow.focus();
  }
  else {
    dlmgr.open(window, null);
  }
}
  
function toEM( aPane )
{
  var theEM = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Components.interfaces.nsIWindowMediator)
                        .getMostRecentWindow("Extension:Manager");
  if (theEM) {
    theEM.focus();
    if (aPane)
      theEM.showView(aPane);
    return;
  }

  const EMURL = "chrome://mozapps/content/extensions/extensions.xul";
  const EMFEATURES = "all,dialog=no";
  if (aPane)
    window.openDialog(EMURL, "", EMFEATURES, aPane);
  else
    window.openDialog(EMURL, "", EMFEATURES);
}

function toBookmarksManager()
{
  toOpenWindowByType("bookmarks:manager",
                     "chrome://communicator/content/bookmarks/bookmarksManager.xul");
}

function toJavaScriptConsole()
{
    toOpenWindowByType("global:console", "chrome://global/content/console.xul");
}

function javaItemEnabling()
{
    var element = document.getElementById("java");
    if (navigator.javaEnabled())
      element.removeAttribute("disabled");
    else
      element.setAttribute("disabled", "true");
}
            
function toJavaConsole()
{
    var jvmMgr = Components.classes['@mozilla.org/oji/jvm-mgr;1']
                            .getService(Components.interfaces.nsIJVMManager)
    jvmMgr.showJavaConsole();
}

function toOpenWindow( aWindow )
{
  try {
    // Try to focus the previously focused window e.g. message compose body
    aWindow.document.commandDispatcher.focusedWindow.focus();
  } catch (e) {
    // e.g. full-page plugin or non-XUL document; just raise the top window
    aWindow.focus();
  }
}

function toOpenWindowByType( inType, uri, features )
{
  // don't do several loads in parallel
  if (uri in window)
    return;

  var topWindow = Components.classes['@mozilla.org/appshell/window-mediator;1']
                            .getService(nsIWindowMediator)
                            .getMostRecentWindow(inType);
  if ( topWindow )
    toOpenWindow( topWindow );
  else
  {
    // open the requested window, but block it until it's fully loaded
    function newWindowLoaded(event)
    {
      // make sure that this handler is called only once
      window.removeEventListener("unload", newWindowLoaded, false);
      window[uri].removeEventListener("load", newWindowLoaded, false);
      delete window[uri];
    }
    // remember the newly loading window until it's fully loaded
    // or until the current window passes away
    window[uri] = window.openDialog(uri, "", features || "all,dialog=no");
    window[uri].addEventListener("load", newWindowLoaded, false);
    window.addEventListener("unload", newWindowLoaded, false);
  }
}

function OpenBrowserWindow()
{
  if (document.documentElement.getAttribute("windowtype") ==
      "navigator:browser" && window.content && window.content.document)
  {
    // if and only if the current window is a browser window and
    // it has a document with a character set, then extract the
    // current charset menu setting from the current document
    // and use it to initialize the new browser window
    window.openDialog(getBrowserURL(), "_blank",
                      "chrome,all,dialog=no", null,
                      "charset=" + window.content.document.characterSet);
  } else if (Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator)
                       .getMostRecentWindow("navigator:browser")) {
    // if a browser window already exists then set startpage to null so
    // navigator.js can check pref for how new window should be opened
    window.openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", null);
  } else {
    // open the first browser window as if we were starting up
    var cmdLine = {
      handleFlagWithParam: function handleFlagWithParam(flag, caseSensitive) {
        return flag == "remote" ? "xfeDoCommand(openBrowser)" : null;
      },
      handleFlag: function handleFlag(flag, caseSensitive) {
        return false;
      },
      preventDefault: true
    };
    const clh_prefix = "@mozilla.org/commandlinehandler/general-startup;1";
    Components.classes[clh_prefix + "?type=browser"]
              .getService(Components.interfaces.nsICommandLineHandler)
              .handle(cmdLine);
  }
}

function CycleWindow( aType )
{
  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface(nsIWindowMediator);

  var topWindowOfType = windowManagerInterface.getMostRecentWindow( aType );
  var topWindow = windowManagerInterface.getMostRecentWindow( null );

  if ( topWindowOfType == null )
    return null;

  if ( topWindowOfType != topWindow ) {
    toOpenWindow(topWindowOfType);
    return topWindowOfType;
  }

  var enumerator = windowManagerInterface.getEnumerator( aType );
  var firstWindow = enumerator.getNext().QueryInterface(nsIDOMWindowInternal);
  var iWindow = firstWindow;
  while (iWindow != topWindow && enumerator.hasMoreElements())
    iWindow = enumerator.getNext().QueryInterface(nsIDOMWindowInternal);

  if (enumerator.hasMoreElements()) {
    iWindow = enumerator.getNext().QueryInterface(nsIDOMWindowInternal);
    toOpenWindow(iWindow);
    return iWindow;
  }

  if (firstWindow == topWindow) // Only one window
    return null;

  toOpenWindow(firstWindow);
  return firstWindow;
}

function ShowWindowFromResource( node )
{
	var windowManagerDS = Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator'].getService(nsIWindowDataSource);
    
    var desiredWindow = null;
    var url = node.getAttribute('id');
	desiredWindow = windowManagerDS.getWindowForResource( url );
	if ( desiredWindow )
	{
		toOpenWindow(desiredWindow);
	}
}

function OpenTaskURL( inURL )
{
	
	window.open( inURL );
}

function ShowUpdateFromResource( node )
{
	var url = node.getAttribute('url');
        // hack until I get a new interface on xpiflash to do a 
        // look up on the name/url pair.
	OpenTaskURL( "http://www.mozilla.org/binaries.html");
}

function checkFocusedWindow()
{
  var windowManagerDS = Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator'].getService(nsIWindowDataSource);

  var sep = document.getElementById("sep-window-list");
  // Using double parens to avoid warning
  while ((sep = sep.nextSibling)) {
    var url = sep.getAttribute('id');
    var win = windowManagerDS.getWindowForResource(url);
    if (win == window) {
      sep.setAttribute("checked", "true");
      break;
    }
  }
}

function toProfileManager()
{
  const wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator);
  var promgrWin = wm.getMostRecentWindow( "mozilla:profileSelection" );
  if (promgrWin) {
    promgrWin.focus();
  } else {
    var params = Components.classes["@mozilla.org/embedcomp/dialogparam;1"]
                 .createInstance(Components.interfaces.nsIDialogParamBlock);
  
    params.SetNumberStrings(1);
    params.SetString(0, "menu");
    window.openDialog("chrome://communicator/content/profile/profileSelection.xul",
                "",
                "centerscreen,chrome,titlebar",
                params);
  }
  // Here, we don't care about the result code
  // that was returned in the param block.
}

// This function is used by mac's platformCommunicatorOverlay
function ZoomCurrentWindow()
{
  if (window.windowState == STATE_NORMAL)
    window.maximize();
  else
    window.restore();
}
