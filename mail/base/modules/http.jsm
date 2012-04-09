/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["doXHRequest"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

function doXHRequest(aUrl, aHeaders, aPOSTData, aOnLoad, aOnError, aThis, aMethod) {
  var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
              .createInstance(Ci.nsIXMLHttpRequest);
  xhr.mozBackgroundRequest = true; // no error dialogs
  xhr.open(aMethod || (aPOSTData ? "POST" : "GET"), aUrl);
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
      if (target.status < 200 || target.status >= 300) {
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

  let POSTData = aPOSTData || "";
  if (Array.isArray(POSTData)) {
    xhr.setRequestHeader("Content-Type",
                         "application/x-www-form-urlencoded; charset=utf-8");
    POSTData = aPOSTData.map(function(p) p[0] + "=" + encodeURIComponent(p[1]))
                        .join("&");
  }

  xhr.send(POSTData);
  return xhr;
}
