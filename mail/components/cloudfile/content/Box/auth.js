/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Modeled on browserRequest used by the OAuth module */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://gre/modules/Http.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const wpl = Ci.nsIWebProgressListener;

const kApiKey = "exs8m0agj1fa5728lxvn288ymz01dnzn";
const kServerUrl = "https://www.box.com/api/1.0/rest";
const kAuthUrl = "https://www.box.com/api/1.0/auth/";

const log = Log4Moz.getConfiguredLogger("BoxAuth");

var reporterListener = {
  _isBusy: false,
  get securityButton() {
    delete this.securityButton;
    return this.securityButton = document.getElementById("security-button");
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                         Ci.nsISupportsWeakReference,
                                         Ci.nsISupports]),

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
    let level;

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
      this.securityButton.removeAttribute("loading");
      this.securityButton.hidden = false;
    } else {
      this.securityButton.hidden = true;
      this.securityButton.removeAttribute("level");
    }
    this.securityButton.setAttribute("tooltiptext",
                                     browser.securityUI.tooltipText);
  }
}

/**
 * The authorization process is:
 * - We load this window and immediately make a ticket request
 * - With the returned ticket, we make a url and load it into the browser
 * - The user logs in, and our opener listens for a redirect url
 * - The redirect url contains the ticket and the auth token
 * - The opener, when satisfied it has what it needs, closes this window
 * - If the ticket call produces an error, we try again
 */

function onLoad()
{
  document.getElementById("security-button").setAttribute("loading", "true");
  let request = window.arguments[0].wrappedJSObject;
  document.getElementById("headerMessage").textContent = request.promptText;

  nsBoxAuth.numTries = 0;
  setupTicketRequest();
}

function setupTicketRequest()
{
  let successCallback = function (aTicket) {
    let authUrl = kAuthUrl + aTicket;
    loadRequestedUrl(authUrl);
  };
  let failureCallback = function (aReq) {
    // retry
    if (nsBoxAuth.numTries < 3) {
      log.error("get_ticket failed, trying again - status = " + aReq.status);
      setupTicketRequest();
    }
    else {
      // give up after 3 tries
      log.error("get_ticket failed, giving up - status = " + aReq.status);
      cancelRequest();
    }
  };

  nsBoxAuth.getSessionTicket(successCallback, failureCallback);
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

  let browser = document.getElementById("requestFrame");
  browser.addProgressListener(reporterListener,
                              Ci.nsIWebProgress.NOTIFY_ALL);
  if (aUrl != "") {
    browser.setAttribute("src", aUrl);
    document.getElementById("headerMessage").textContent = aUrl;
  }
  request.loaded(window, browser.webProgress);
}

var nsBoxAuth = {

  numTries : 0,

  /**
   * A function for retrieving a new ticket to use in the url for logging in
   * The lifespan of a ticket is only a few minutes
   *
   * @param successCallback a callback fired if retrieving the ticket
   *                        is successful.
   * @param failureCallback a callback fired if retrieving the ticket
   *                        fails.
  */
  getSessionTicket: function(successCallback, failureCallback) {
    let args = "?action=get_ticket&api_key=" + kApiKey;
    let requestUrl = kServerUrl + args;

    let ticketSuccess = function(aResponseText, aRequest) {
      log.info("get_ticket request response = " + aResponseText);
      try {
        let doc = aRequest.responseXML;
        let docResponse = doc.documentElement;
        if (docResponse && docResponse.nodeName == "response") {
          let docStatus = doc.querySelector("status").firstChild.nodeValue;
          log.info("status = " + docStatus);
          if (docStatus != "get_ticket_ok") {
            failureCallback(aRequest);
            return;
          }
          let ticket = doc.querySelector("ticket").firstChild.nodeValue;
          log.info("Auth ticket = " + ticket);
          successCallback(ticket);
        }
        else {
          log.error("Failed to acquire a ticket: " + aResponseText);
          failureCallback(aRequest);
        }
      }
      catch(e) {
        // most likely bad XML
        log.error("Failed to parse ticket response: " + e);
        log.error("Ticket response: " + aResponseText);
        failureCallback(aRequest);
      }
    }.bind(this);
    let ticketFailure = function(aException, aResponseText, aRequest) {
      log.error("Ticket acquisition error: " + aResponseText);
      failureCallback(aRequest);
    }.bind(this)

    // Request to get the ticket
    httpRequest(requestUrl, {
                  onLoad: ticketSuccess,
                  onError: ticketFailure,
                  method: "GET"
                });
    this.numTries++;
  }

};
