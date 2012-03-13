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
 * The Original Code is oauthorizer.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Shane Caraveo <shanec@mozillamessaging.com>
 *   Florian Quèze <florian@instantbird.org>
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

const wpl = Components.interfaces.nsIWebProgressListener;

var reporterListener = {
  _isBusy: false,
  get statusMeter() {
    delete this.statusMeter;
    return this.statusMeter = document.getElementById("statusbar-icon");
  },
  get securityButton() {
    delete this.securityButton;
    return this.securityButton = document.getElementById("security-button");
  },
  get securityLabel() {
    delete this.securityLabel;
    return this.securityLabel = document.getElementById("security-status");
  },
  get securityDisplay() {
    delete this.securityDisplay;
    return this.securityDisplay = document.getElementById("security-display");
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
    if (aStateFlags & wpl.STATE_START &&
        aStateFlags & wpl.STATE_IS_NETWORK) {
      this.statusMeter.value = 0;
      this.statusMeter.parentNode.collapsed = false;
      this.securityLabel.collapsed = true;
    }
    else if (aStateFlags & wpl.STATE_STOP &&
             aStateFlags & wpl.STATE_IS_NETWORK) {
      this.statusMeter.parentNode.collapsed = true;
      this.securityLabel.collapsed = false;
    }
  },

  onProgressChange: function(/*in nsIWebProgress*/ aWebProgress,
                        /*in nsIRequest*/ aRequest,
                        /*in long*/ aCurSelfProgress,
                        /*in long */aMaxSelfProgress,
                        /*in long */aCurTotalProgress,
                        /*in long */aMaxTotalProgress) {
    if (aMaxTotalProgress > 0) {
      let percentage = (aCurTotalProgress * 100) / aMaxTotalProgress;
      this.statusMeter.value = percentage;
    }
  },

  onLocationChange: function(/*in nsIWebProgress*/ aWebProgress,
                        /*in nsIRequest*/ aRequest,
                        /*in nsIURI*/ aLocation) {
    this.securityDisplay.setAttribute('label', aLocation.host);
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
      this.securityButton.hidden = false;
      this.securityLabel.setAttribute("label", browser.securityUI.tooltipText);
    } else {
      this.securityButton.hidden = true;
      this.securityButton.removeAttribute("level");
    }
    this.securityButton.setAttribute("tooltiptext",
                                     browser.securityUI.tooltipText);
  }
}

function cancelRequest()
{
  reportUserClosed();
  window.close();
}

function reportUserClosed()
{
  let request = window.arguments[0];
  request.QueryInterface(Components.interfaces.prplIRequestBrowser);
  request.cancelled();
}

function loadRequestedUrl()
{
  let request = window.arguments[0];
  request.QueryInterface(Components.interfaces.prplIRequestBrowser);
  document.getElementById("headerMessage").textContent = request.promptText;
  let account = request.account;
  document.getElementById("headerLabel").value =
    account.protocol.name + " - " + account.name;
  document.getElementById("headerImage").src =
    account.protocol.iconBaseURI + "icon48.png";

  let browser = document.getElementById("requestFrame");
  browser.addProgressListener(reporterListener,
                              Components.interfaces.nsIWebProgress.NOTIFY_ALL);
  let url = request.url;
  if (url != "")
    browser.setAttribute("src", url);
  request.loaded(window, browser.webProgress);
}
