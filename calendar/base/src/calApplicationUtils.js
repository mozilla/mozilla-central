/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

function openAboutDialog()
{
  const SUNBIRD_ID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
  var url = (Services.appinfo.ID == SUNBIRD_ID) ?
    "chrome://sunbird/content/aboutDialog.xul" :
    "chrome://messenger/content/aboutDialog.xul" ;
#ifdef XP_WIN
  var features = "chrome,centerscreen,dependent";
#elifdef XP_MACOSX
  var features = "chrome,resizable=no,minimizable=no";
#else
  var features = "chrome,centerscreen,dependent,dialog=no";
#endif
  window.openDialog(url, "About", features);
}

/**
 * Opens the release notes page for this version of the application.
 */
function openReleaseNotes()
{
  const SUNBIRD_ID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
  if (Services.appinfo.ID == SUNBIRD_ID) {
    var bundle = Services.strings.createBundle("chrome://branding/locale/brand.properties");
    var relNotesURL = bundle.formatStringFromName("releaseNotesURL",[Services.appinfo.version],1)
    launchBrowser(relNotesURL);
  } else {
    openFormattedRegionURL('app.releaseNotesURL');
  }
}

/**
 * Opens region specific web pages for the application like the release notes, the help site, etc. 
 *   aResourceName --> the string resource ID in region.properties to load. 
 */
function openRegionURL(aResourceName)
{
  try {
    var regionBundle = Services.strings.createBundle("chrome://messenger-region/locale/region.properties");
    // the release notes are special and need to be formatted with the app version
    var urlToOpen;
    if (aResourceName == "releaseNotesURL")
      urlToOpen = regionBundle.formatStringFromName(aResourceName, [Services.appinfo.version], 1);
    else
      urlToOpen = regionBundle.GetStringFromName(aResourceName);
      
    var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                      .getService(Components.interfaces.nsIExternalProtocolService);
    protocolSvc.loadUrl(Services.io.newURI(urlToOpen, null, null));
  } catch (ex) {}
}

/**
 *  Fetches the url for the passed in pref name, formats it and then loads it in the default
 *  browser.
 *
 *  @param aPrefName - name of the pref that holds the url we want to format and open
 */
function openFormattedRegionURL(aPrefName)
{
  var formattedUrl = getFormattedRegionURL(aPrefName);
  
  var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].
                               getService(Components.interfaces.nsIExternalProtocolService);
  protocolSvc.loadUrl(Services.io.newURI(formattedUrl, null, null));
}

/**
 *  Fetches the url for the passed in pref name and uses the URL formatter service to 
 *    process it.
 *
 *  @param aPrefName - name of the pref that holds the url we want to format and open
 *  @returns the formatted url string
 */
function getFormattedRegionURL(aPrefName)
{
  return Services.urlFormatter.formatURLPref(aPrefName);
}

/**
 * Launch the given url (string) in the external browser. If an event is passed,
 * then this is only done on left click and the event propagation is stopped.
 *
 * @param url       The URL to open, as a string
 * @param event     (optional) The event that caused the URL to open
 */
function launchBrowser(url, event)
{
  // Bail out if there is no url set, or an event was passed without left-click
  if (!url || (event && event.button != 0)) {
    return;
  }

  // 0. Prevent people from trying to launch URLs such as javascript:foo();
  //    by only allowing URLs starting with http or https.
  // XXX: We likely will want to do this using nsIURLs in the future to
  //      prevent sneaky nasty escaping issues, but this is fine for now.
  if (url.indexOf("http") != 0) {
    Components.utils.reportError ("launchBrowser: " +
                                  "Invalid URL provided: " + url +
                                  " Only http:// and https:// URLs are valid.");
    return;
  }

  Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
            .getService(Components.interfaces.nsIExternalProtocolService)
            .loadUrl(Services.io.newURI(url, null, null));

  // Make sure that any default click handlers don't do anything, we have taken
  // care of all processing
  if (event) {
      event.stopPropagation();
      event.preventDefault();
  }
}
