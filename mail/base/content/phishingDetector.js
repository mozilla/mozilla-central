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
 * The Original Code is Thunderbird Phishing Dectector
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Scott MacGregor <mscott@mozilla.org>
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
 * ***** END LICENSE BLOCK ****** */

// Dependencies:
// gPrefBranch, gBrandBundle, gMessengerBundle should already be defined
// gatherTextUnder from utilityOverlay.js

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

    this.mCheckForIPAddresses = gPrefBranch.getBoolPref("mail.phishing.detection.ipaddresses");
    this.mCheckForMismatchedHosts = gPrefBranch.getBoolPref("mail.phishing.detection.mismatched_hosts");
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
    if (!aUrl || !gPrefBranch.getBoolPref("mail.phishing.detection.enabled"))
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
    var formNodes = document.getElementById('messagepane').contentDocument.getElementsByTagName("form");
    for (index = 0; index < formNodes.length; index++)
    {
      if (formNodes[index].action)
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

    var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var hrefURL;
    // make sure relative link urls don't make us bail out
    try {
      hrefURL = ioService.newURI(aUrl, null, null);
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
          var unobscuredHostNameValue = this.hostNameIsIPAddress(hrefURL.host);
          if (unobscuredHostNameValue)
            failsStaticTests = !this.isLocalIPAddress(unobscuredHostNameValue);
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

       var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                       .getService(Components.interfaces.nsIIOService);
       var uri = ioService.newURI(reportUrl, null, null);
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
         var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
         aLinkTextURL.value = ioService.newURI(aLinkNodeText, null, null);
         // compare hosts, but ignore possible www. prefix
         return !(aHrefURL.host.replace(/^www\./, "") == aLinkTextURL.value.host.replace(/^www\./, ""));
       }
    }

    return false;
  },

  /**
   * Helper method to determine if aHostName is an IP address.
   * @return the unobscured host name (if there is one)
   */
  hostNameIsIPAddress: function(aHostName)
  {
    return this.isIPv4HostName(aHostName) || this.isIPv6HostName(aHostName);
  },

  /**
   * Check if a host name is an IPv4 host name.
   * @return Unobscured host name if aHostName is an IPv4 address.
   *         Returns false if it's not.
   */
  isIPv4HostName: function(aHostName)
  {
    // Scammers frequently obscure the IP address by encoding each component as
    // octal, hex or in some cases a mix match of each. The IP address could
    // also be represented as a DWORD.

    // Break the IP address down into individual components.
    var ipComponents = aHostName.split(".");

    if (ipComponents.length == 4)
    {
      for (var i = 0; i < ipComponents.length; i++)
      {
        // By leaving the radix parameter blank, we can handle IP addresses
        // where one component is hex, another is octal, etc.
        ipComponents[i] = parseInt(ipComponents[i]);
      }
    }
    else
    {
      // Convert to a binary to test for possible DWORD.
      var binaryDword = parseInt(aHostName).toString(2);
      if (isNaN(binaryDword))
        return false;

      // convert the dword into its component IP parts.
      ipComponents = new Array;
      ipComponents[0] = (aHostName >> 24) & 255;
      ipComponents[1] = (aHostName >> 16) & 255;
      ipComponents[2] = (aHostName >>  8) & 255;
      ipComponents[3] = (aHostName & 255);
    }

    // Make sure each part of the IP address is in fact a number, and that
    // each part isn't larger than 255.
    for (var i = 0; i < ipComponents.length; i++)
    {
      // If any part of the IP address is not a number, or longer than 255,
      // then we can safely return.
      if (isNaN(ipComponents[i]) || ipComponents[i] > 255)
        return false;
    }

    var hostName = ipComponents.join(".");
    // Treat 0.0.0.0 as an invalid IPv4 address.
    return (hostName != "0.0.0.0") ? hostName : false;
  },

  /**
   * Check if the given host name is an IPv6 address.
   * @return the full IPv6 address if aHostName is an IPv6 address.
   */
  isIPv6HostName: function(aHostName) {
    // Break the IP address down into individual components.
    var ipComponents = aHostName.split(":");

    // Make sure there are at least 3 components.
    if (ipComponents.length < 3)
      return false;

    // Take care if the last part is written in decimal using dots as separators.
    var lastPart = ipComponents[ipComponents.length - 1];
    if (lastPart)
    {
      var lastPartComponents = lastPart.split(".");
      if (lastPartComponents.length == 4)
      {
        // Make sure each part is a number and not larger then 0xff.
        for (var i = 0; i < lastPartComponents.length; i++)
        {
          lastPartComponents[i] = parseInt(lastPartComponents[i]);
          if (isNaN(lastPartComponents[i]) || lastPartComponents[i] > 0xff)
            return false;
        }

        // Convert it into standard IPv6 components.
        ipComponents[ipComponents.length - 1] =
          ((lastPartComponents[0] << 8) | lastPartComponents[1]).toString(16);
        ipComponents[ipComponents.length] =
          ((lastPartComponents[2] << 8) | lastPartComponents[3]).toString(16);
      }
    }

    // Make sure that there is only one empty component.
    var emptyIndex;
    for (var i = 1; i < ipComponents.length - 1; i++)
    {
      if (ipComponents[i] == "")
      {
        // If we already found an empty component return false.
        if (emptyIndex)
          return false;

        emptyIndex = i;
      }
    }

    // If we found an empty component, extend it.
    if (emptyIndex)
    {
      ipComponents[emptyIndex] = 0;

      // Add components so we have a total of 8.
      for (var count = ipComponents.length; count < 8; count++)
        ipComponents.splice(emptyIndex, 0, 0);
    }

    // Make sure there are 8 components.
    if (ipComponents.length != 8)
      return false;

    // Format all components to 4 character hex value.
    for (var i = 0; i < ipComponents.length; i++)
    {
      if (ipComponents[i] == "")
        ipComponents[i] = 0;
      // Make sure the component is a number and it isn't larger then 0xffff.
      ipComponents[i] = parseInt(ipComponents[i], 16);
      if (isNaN(ipComponents[i]) || ipComponents[i] > 0xffff)
        return false;

      // Pad the component with 0:s.
      ipComponents[i] = ("0000"+ ipComponents[i].toString(16)).substr(-4);
    }

    var hostName = ipComponents.join(":");
    // Treat 0000:0000:0000:0000:0000:0000:0000:0000 as an invalid IPv6 address.
    return (hostName != "0000:0000:0000:0000:0000:0000:0000:0000") ?
              hostName : false;
  },

  /**
   * Check if the given host name is a local IP address.
   * @return true if unobscuredHostName is a local IP address.
   */
  isLocalIPAddress: function(unobscuredHostNameValue)
  {
    var ipComponents = unobscuredHostNameValue.split(".");
    if (ipComponents.length == 4)
    {
       // Check if it's a local IPv4 address.
      return ipComponents[0] == 10 ||
            ipComponents[0] == 127 || // loopback address
            (ipComponents[0] == 192 && ipComponents[1] == 168) ||
            (ipComponents[0] == 169 && ipComponents[1] == 254) ||
            (ipComponents[0] == 172 && ipComponents[1] >= 16 && ipComponents[1] < 32);
    }

    // IPv6 address?
    ipComponents = unobscuredHostNameValue.split(":");
    if (ipComponents.length == 8)
    {
      // ::1/128 - localhost
      if (ipComponents[0] == "0000" && ipComponents[1] == "0000" &&
          ipComponents[2] == "0000" && ipComponents[3] == "0000" &&
          ipComponents[4] == "0000" && ipComponents[5] == "0000" &&
          ipComponents[6] == "0000" && ipComponents[7] == "0001")
        return true;

      // fe80::/10 - link local addresses
      if (ipComponents[0] == "fe80")
        return true;

      // TODO: also detect fc00::/7 - unique local addresses

      return false;
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

    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService);
    var hrefURL;
    // make sure relative link urls don't make us bail out
    try {
      hrefURL = ioService.newURI(aUrl, null, null);
    } catch(ex) { return false; }

    // only prompt for http and https urls
    if (hrefURL.schemeIs('http') || hrefURL.schemeIs('https'))
    {
      // unobscure the host name in case it's an encoded ip address..
      var unobscuredHostNameValue = this.hostNameIsIPAddress(hrefURL.host)
        || hrefURL.host;

      var brandShortName = gBrandBundle.getString("brandShortName");
      var titleMsg = gMessengerBundle.getString("confirmPhishingTitle");
      var dialogMsg = gMessengerBundle.getFormattedString("confirmPhishingUrl", 
                        [brandShortName, unobscuredHostNameValue], 2);

      const nsIPS = Components.interfaces.nsIPromptService;
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(nsIPS);
      return !promptService.confirmEx(window, titleMsg, dialogMsg, nsIPS.STD_YES_NO_BUTTONS + nsIPS.BUTTON_POS_1_DEFAULT, 
                                     "", "", "", "", {}); /* the yes button is in position 0 */
    }

    return true; // allow the link to load
  }
};
