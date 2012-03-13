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
 * The Original Code is the Instantbird messenging client, released
 * 2010.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

const EXPORTED_SYMBOLS = ["doXHRequest"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource:///modules/imXPCOMUtils.jsm");

initLogModule("xhr", this);

function doXHRequest(aUrl, aHeaders, aPOSTData, aOnLoad, aOnError, aThis) {
  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
              .createInstance(Ci.nsIXMLHttpRequest);
  xhr.mozBackgroundRequest = true; // no error dialogs
  xhr.open(aPOSTData ? "POST" : "GET", aUrl);
  xhr.channel.loadFlags = Ci.nsIChannel.LOAD_ANONYMOUS | // don't send cookies
                          Ci.nsIChannel.LOAD_BYPASS_CACHE |
                          Ci.nsIChannel.INHIBIT_CACHING;
  xhr.onerror = function(aProgressEvent) {
    if (aOnError) {
      // adapted from toolkit/mozapps/extensions/nsBlocklistService.js
      let request = aProgressEvent.target;
      let status;
      try {
        // may throw (local file or timeout)
        status = request.status;
      }
      catch (e) {
        request = request.channel.QueryInterface(Ci.nsIRequest);
        status = request.status;
      }
      // When status is 0 we don't have a valid channel.
      let statusText = status ? request.statusText : "offline";
      aOnError.call(aThis, statusText, null, this);
    }
  };
  xhr.onload = function (aRequest) {
    try {
      let target = aRequest.target;
      DEBUG("Received response: " + target.responseText);
      if (target.status != 200) {
        let errorText = target.responseText;
        if (!errorText || /<(ht|\?x)ml\b/i.test(errorText))
          errorText = target.statusText;
        throw target.status + " - " + errorText;
      }
      if (aOnLoad)
        aOnLoad.call(aThis, target.responseText, this);
    } catch (e) {
      Cu.reportError(e);
      if (aOnError)
        aOnError.call(aThis, e, aRequest.target.responseText, this);
    }
  };

  if (aHeaders) {
    aHeaders.forEach(function(header) {
      xhr.setRequestHeader(header[0], header[1]);
    });
  }

  let POSTData = "";
  if (aPOSTData) {
    xhr.setRequestHeader("Content-Type",
                         "application/x-www-form-urlencoded; charset=utf-8");
    POSTData = aPOSTData.map(function(p) p[0] + "=" + encodeURIComponent(p[1]))
                        .join("&");
  }

  LOG("sending request to " + aUrl + " (POSTData = " + POSTData + ")");
  xhr.send(POSTData);
  return xhr;
}
