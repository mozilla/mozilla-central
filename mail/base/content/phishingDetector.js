/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Dependencies:
// gatherTextUnder from utilityOverlay.js

Components.utils.import("resource://gre/modules/Services.jsm");

const kPhishingNotSuspicious = 0;
const kPhishingWithIPAddress = 1;
const kPhishingWithMismatchedHosts = 2;

var gPhishingDetector = {
  mCheckForIPAddresses: true,
  mCheckForMismatchedHosts: true,
  mPhishingWarden: null,

  shutdown: function()
  {
    try {
      this.mPhishingWarden.shutdown();
    } catch (ex) {}
  },

  /**
   * initialize the phishing warden. 
   * initialize the black and white list url tables. 
   * update the local tables if necessary
   */
  init: function() 
  {
    Components.utils.import("resource:///modules/hostnameUtils.jsm", this);

    try {
      // set up the anti phishing service
      var appContext = Components.classes["@mozilla.org/phishingprotection/application;1"]
                         .getService().wrappedJSObject;

      this.mPhishingWarden  = new appContext.PROT_PhishingWarden();

      // Register tables
      // XXX: move table names to a pref that we originally will download
      // from the provider (need to workout protocol details)
      this.mPhishingWarden.registerWhiteTable("goog-white-exp");
      this.mPhishingWarden.registerBlackTable("goog-phish-sha128");

      // Download/update lists if we're in non-enhanced mode
      this.mPhishingWarden.maybeToggleUpdateChecking();  
    } catch (ex) { dump('unable to create the phishing warden: ' + ex + '\n');}

    this.mCheckForIPAddresses = Services.prefs.getBoolPref("mail.phishing.detection.ipaddresses");
    this.mCheckForMismatchedHosts = Services.prefs.getBoolPref("mail.phishing.detection.mismatched_hosts");
  },

  /**
   * Analyzes the urls contained in the currently loaded message in the message pane, looking for
   * phishing URLs.
   * Assumes the message has finished loading in the message pane (i.e. OnMsgParsed has fired).
   * 
   * @param aUrl nsIURI for the message being analyzed.
   *
   * @return asynchronously calls gMessageNotificationBar.setPhishingMsg if the message
   *         is identified as a scam.         
   */
  analyzeMsgForPhishingURLs: function (aUrl)
  {
    if (!aUrl || !Services.prefs.getBoolPref("mail.phishing.detection.enabled"))
      return;

    try {
      // nsIMsgMailNewsUrl.folder can throw an NS_ERROR_FAILURE, especially if
      // we are opening an .eml file.
      var folder = aUrl.folder;

      // Ignore nntp and RSS messages.
      if (folder.server.type == 'nntp' || folder.server.type == 'rss')
        return;

      // Also ignore messages in Sent/Drafts/Templates/Outbox.
      const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
      let outgoingFlags = nsMsgFolderFlags.SentMail | nsMsgFolderFlags.Drafts |
                          nsMsgFolderFlags.Templates | nsMsgFolderFlags.Queue;
      if (folder.isSpecialFolder(outgoingFlags, true))
        return;

    } catch (ex) {
        if (ex.result != Components.results.NS_ERROR_FAILURE)
          throw ex;
    }

    // extract the link nodes in the message and analyze them, looking for suspicious URLs...
    var linkNodes = document.getElementById('messagepane').contentDocument.links;
    for (var index = 0; index < linkNodes.length; index++)
      this.analyzeUrl(linkNodes[index].href, gatherTextUnder(linkNodes[index]));

    // extract the action urls associated with any form elements in the message and analyze them.
    let formNodes = document.getElementById('messagepane').contentDocument.querySelectorAll("form[action]");
    for (index = 0; index < formNodes.length; index++)
    {
      this.analyzeUrl(formNodes[index].action);
    }
  },

  /** 
   * Analyze the url contained in aLinkNode for phishing attacks. If a phishing URL is found,
   * 
   * @param aHref the url to be analyzed
   * @param aLinkText (optional) user visible link text associated with aHref in case
   *        we are dealing with a link node.
   * @return asynchronously calls gMessageNotificationBar.setPhishingMsg if the link node
   *         contains a phishing URL.
   */
  analyzeUrl: function (aUrl, aLinkText)
  {
    if (!aUrl)
      return;

    var hrefURL;
    // make sure relative link urls don't make us bail out
    try {
      hrefURL = Services.io.newURI(aUrl, null, null);
    } catch(ex) { return; }

    // only check for phishing urls if the url is an http or https link.
    // this prevents us from flagging imap and other internally handled urls
    if (hrefURL.schemeIs('http') || hrefURL.schemeIs('https'))
    {
      var linkTextURL = {};

      // The link is not suspicious if the visible text is the same as the URL,
      // even if the URL is an IP address. URLs are commonly surrounded by
      // < > or "" (RFC2396E) - so strip those from the link text before comparing.
      if (aLinkText)
        aLinkText = aLinkText.replace(/^<(.+)>$|^"(.+)"$/, "$1$2");

      var failsStaticTests = false;
      if (aLinkText != aUrl)
      {
        if (this.mCheckForIPAddresses)
        {
          let unobscuredHostNameValue = this.isLegalIPAddress(hrefURL.host, true);
          if (unobscuredHostNameValue)
            failsStaticTests = !this.isLegalLocalIPAddress(unobscuredHostNameValue);
        }

        if (!failsStaticTests && this.mCheckForMismatchedHosts)
        {
          failsStaticTests = (aLinkText &&
            this.misMatchedHostWithLinkText(hrefURL, aLinkText, linkTextURL))
        }
      }

      // Lookup the url against our local list. We want to do this even if the url fails our static
      // test checks because the url might be in the white list.
      if (this.mPhishingWarden)
        this.mPhishingWarden.isEvilURL(gFolderDisplay.selectedMessage,
                                       failsStaticTests, aUrl,
                                       this.localListCallback);
      else
        this.localListCallback(gFolderDisplay.selectedMessage,
                               failsStaticTests, aUrl, 2 /* not found */);
    }
  },

  /**
    * 
    * @param aMsgHdr the header for the loaded message when the look up was initiated.
    * @param aFailsStaticTests true if our static tests think the url is a phishing scam
    * @param aUrl the url we looked up in the phishing tables
    * @param aLocalListStatus the result of the local lookup (PROT_ListWarden.IN_BLACKLIST,
    *        PROT_ListWarden.IN_WHITELIST or PROT_ListWarden.NOT_FOUND.
    */
  localListCallback: function (aMsgHdr, aFailsStaticTests, aUrl, aLocalListStatus)
  {  
    // for urls in the blacklist, notify the phishing bar.
    // for urls in the whitelist, do nothing
    // for all other urls, fall back to the static tests
    if (aMsgHdr == gFolderDisplay.selectedMessage)
    {
      if (aLocalListStatus == 0 /* PROT_ListWarden.IN_BLACKLIST */ ||
          (aLocalListStatus == 2 /* PROT_ListWarden.PROT_ListWarden.NOT_FOUND */ && aFailsStaticTests))
        gMessageNotificationBar.setPhishingMsg();
    }
  },

  /**
   * Looks up the report phishing url for the current phishing provider, appends aPhishingURL to the url,
   * and loads it in the default browser where the user can submit the url as a phish.
   * @param aPhishingURL the url we want to report back as a phishing attack
   */
   reportPhishingURL: function(aPhishingURL)
   {
     var appContext = Components.classes["@mozilla.org/phishingprotection/application;1"]
                       .getService().wrappedJSObject;
     var reportUrl = appContext.getReportPhishingURL();
     if (reportUrl)
     {
       reportUrl += "&url=" + encodeURIComponent(aPhishingURL);
       // now send the url to the default browser

       var uri = Services.io.newURI(reportUrl, null, null);
       var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                         .getService(Components.interfaces.nsIExternalProtocolService);
       protocolSvc.loadUrl(uri);
     }
   },   

  /**
   * Private helper method to determine if the link node contains a user visible
   * url with a host name that differs from the actual href the user would get taken to.
   * i.e. <a href="http://myevilsite.com">http://mozilla.org</a>
   * 
   * @return true if aHrefURL.host matches the host of the link node text. 
   * @return aLinkTextURL the nsIURI for the link node text
   */
  misMatchedHostWithLinkText: function(aHrefURL, aLinkNodeText, aLinkTextURL)
  {
    // gatherTextUnder puts a space between each piece of text it gathers,
    // so strip the spaces out (see bug 326082 for details).
    aLinkNodeText = aLinkNodeText.replace(/ /g, "");

    // only worry about http and https urls
    if (aLinkNodeText)
    {
      // does the link text look like a http url?
       if (aLinkNodeText.search(/(^http:|^https:)/) != -1)
       {
         aLinkTextURL.value = Services.io.newURI(aLinkNodeText, null, null);
         // compare hosts, but ignore possible www. prefix
         return !(aHrefURL.host.replace(/^www\./, "") == aLinkTextURL.value.host.replace(/^www\./, ""));
       }
    }

    return false;
  },

  /**
   * If the current message has been identified as an email scam, prompts the user with a warning
   * before allowing the link click to be processed. The warning prompt includes the unobscured host name
   * of the http(s) url the user clicked on.
   *
   * @param aUrl the url 
   * @return true if the link should be allowed to load
   */
  warnOnSuspiciousLinkClick: function(aUrl)
  {
    // if the loaded message has been flagged as a phishing scam, 
    if (!gMessageNotificationBar.isFlagSet(kMsgNotificationPhishingBar))
      return true;

    var hrefURL;
    // make sure relative link urls don't make us bail out
    try {
      hrefURL = Services.io.newURI(aUrl, null, null);
    } catch(ex) { return false; }

    // only prompt for http and https urls
    if (hrefURL.schemeIs('http') || hrefURL.schemeIs('https'))
    {
      // unobscure the host name in case it's an encoded ip address..
      let unobscuredHostNameValue = this.isLegalIPAddress(hrefURL.host, true)
        || hrefURL.host;

      var brandShortName = document.getElementById("bundle_brand")
                                   .getString("brandShortName");
      var bundle = document.getElementById("bundle_messenger");
      var titleMsg = bundle.getString("confirmPhishingTitle");
      var dialogMsg = bundle.getFormattedString("confirmPhishingUrl", 
                        [brandShortName, unobscuredHostNameValue], 2);

      const nsIPS = Components.interfaces.nsIPromptService;
      return !Services.prompt.confirmEx(window, titleMsg, dialogMsg,
                                        nsIPS.STD_YES_NO_BUTTONS +
                                        nsIPS.BUTTON_POS_1_DEFAULT,
                                        "", "", "", "", {}); /* the yes button is in position 0 */
    }

    return true; // allow the link to load
  }
};
