/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource:///modules/http.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");

const wpl = Ci.nsIWebProgressListener;

const kApiKey = "exs8m0agj1fa5728lxvn288ymz01dnzn";
const kServerUrl = "https://www.box.com/api/1.0/rest";

var reporterListener = {
  _isBusy: false,
  get securityButton() {
    delete this.securityButton;
    return this.securityButton = document.getElementById("security-button");
  },

  QueryInterface: function(aIID) {
    if (aIID.equals(Components.interfaces.nsIWebProgressListener)   ||
        aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(/*in nsIWebProgress*/ aWebProgress,
                     /*in nsIRequest*/ aRequest,
                     /*in unsigned long*/ aStateFlags,
                     /*in nsresult*/ aStatus) {
  },

  onProgressChange: function(/*in nsIWebProgress*/ aWebProgress,
                        /*in nsIRequest*/ aRequest,
                        /*in long*/ aCurSelfProgress,
                        /*in long */aMaxSelfProgress,
                        /*in long */aCurTotalProgress,
                        /*in long */aMaxTotalProgress) {
  },

  onLocationChange: function(/*in nsIWebProgress*/ aWebProgress,
                        /*in nsIRequest*/ aRequest,
                        /*in nsIURI*/ aLocation) {
    document.getElementById("headerMessage").textContent = aLocation.spec;
  },

  onStatusChange: function(/*in nsIWebProgress*/ aWebProgress,
                      /*in nsIRequest*/ aRequest,
                      /*in nsresult*/ aStatus,
                      /*in wstring*/ aMessage) {
  },

  onSecurityChange: function(/*in nsIWebProgress*/ aWebProgress,
                        /*in nsIRequest*/ aRequest,
                        /*in unsigned long*/ aState) {
    const wpl_security_bits = wpl.STATE_IS_SECURE |
                              wpl.STATE_IS_BROKEN |
                              wpl.STATE_IS_INSECURE |
                              wpl.STATE_SECURE_HIGH |
                              wpl.STATE_SECURE_MED |
                              wpl.STATE_SECURE_LOW;
    let browser = document.getElementById("requestFrame");
    var level;

    switch (aState & wpl_security_bits) {
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_HIGH:
        level = "high";
        break;
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_MED:
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_LOW:
        level = "low";
        break;
      case wpl.STATE_IS_BROKEN:
        level = "broken";
        break;
    }
    if (level) {
      this.securityButton.setAttribute("level", level);
      this.securityButton.hidden = false;
    } else {
      this.securityButton.hidden = true;
      this.securityButton.removeAttribute("level");
    }
    this.securityButton.setAttribute("tooltiptext",
                                     browser.securityUI.tooltipText);
  }
}

function onLoad()
{
  let request = window.arguments[0].wrappedJSObject;
  document.getElementById("headerMessage").textContent = request.promptText;
  //let account = request.account;
  
  // headerImage does not exist in the XUL. I wonder if the original intention was security-button?
  // I wonder, should we set the url-bar-type url holder to have the service icon?
  //if (request.iconURI != "")
  //  document.getElementById("headerImage").src = request.iconURI;

  nsBoxAuth.getSessionTicket(function(aTicket) {
                               var authUrl = "https://www.box.com/api/1.0/auth/" + aTicket;
                               loadRequestedUrl(authUrl);
                             },
                             function (aReq) {
                               alert("get_ticket failed - status = " + aReq.status);
                               // XX TODO Handle this some way in the auth window
                               // Any ideas?
                               // OR
                               // Just close the window and let the opener handle the failure
                               // cancelRequest();
                             });
}

function cancelRequest()
{
  reportUserClosed();
  window.close();
}

function reportUserClosed()
{
  let request = window.arguments[0].wrappedJSObject;
  request.cancelled();
}

function loadRequestedUrl(aUrl)
{
  let request = window.arguments[0].wrappedJSObject;
  /*document.getElementById("headerMessage").textContent = request.promptText;
  let account = request.account;
  if (request.iconURI != "")
    document.getElementById("headerImage").src = request.iconURI;*/

  var browser = document.getElementById("requestFrame");
  browser.addProgressListener(reporterListener,
                              Components.interfaces.nsIWebProgress.NOTIFY_ALL);
  if (aUrl != "") {
    browser.setAttribute("src", aUrl);
    document.getElementById("headerMessage").textContent = aUrl;
  }
  request.loaded(window, browser.webProgress);
}

var nsBoxAuth = {

  log : Log4Moz.getConfiguredLogger("BoxAuth"),

  /**
   * A function for retrieving a new ticket needed for other API calls.
   * The lifespan of a ticket is only a few minutes for authentication
   *
   * @param ...
  */
  getSessionTicket: function(successCallback, failureCallback) {
      let args = "?action=get_ticket&api_key=" + kApiKey;
      let requestUrl = kServerUrl + args;

      // Request to get the ticket
      doXHRequest(requestUrl, 
                  null,
                  null,
                  function(aResponseText, aRequest) {
                    this.log.info("get_ticket request response = " + aResponseText);
                    let doc = aRequest.responseXML;
                    let docResponse = doc.documentElement;
                    if (docResponse && docResponse.nodeName == "response") {
                      let docStatus = doc.getElementsByTagName("status")[0].firstChild.nodeValue;
                      this.log.info("status = " + docStatus);
                      if (docStatus != "get_ticket_ok") {
                        failureCallback(null, aResponseText, aRequest);
                        return;
                      }
                      var ticket = doc.getElementsByTagName("ticket")[0].firstChild.nodeValue;
                      this.log.info("Auth ticket = " + ticket);
                      successCallback(ticket);
                    }
                    else {
                      failureCallback("", aResponseText, aRequest);
                    }
                }.bind(this),
                function(aException, aResponseText, aRequest) {
                  this.log.info("Failed to acquire a ticket:" + aResponseText);
                  failureCallback(aException, aResponseText, aRequest);
                }.bind(this),
                this,
                "GET");
  }

};
