/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var requests = [];

const TERMINATE_EVENTS = ["load", "error", "abort"];

const READ_ONLY_PROPS = ["readyState", "responseText", "responseXML",
                         "status", "statusText"];

const DELEGATED_METHODS = ["abort", "getAllResponseHeaders",
                           "getResponseHeader", "overrideMimeType",
                           "send", "sendAsBinary", "setRequestHeader",
                           "open"];

var getRequestCount = exports.getRequestCount = function getRequestCount() {
  return requests.length;
};

var XMLHttpRequest = exports.XMLHttpRequest = function XMLHttpRequest() {
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
            .createInstance(Ci.nsIXMLHttpRequest);
  req.mozBackgroundRequest = true;

  this._req = req;
  this._orsc = null;

  requests.push(this);

  var self = this;

  this._boundCleanup = function _boundCleanup() {
    self._cleanup();
  };

  TERMINATE_EVENTS.forEach(
    function(name) {
      self._req.addEventListener(name, self._boundCleanup, false);
    });
};

XMLHttpRequest.prototype = {
  _cleanup: function _cleanup() {
    this.onreadystatechange = null;
    var index = requests.indexOf(this);
    if (index != -1) {
      var self = this;
      TERMINATE_EVENTS.forEach(
        function(name) {
          self._req.removeEventListener(name, self._boundCleanup, false);
        });
      requests.splice(index, 1);
    }
  },
  _unload: function _unload() {
    this._req.abort();
    this._cleanup();
  },
  addEventListener: function addEventListener() {
    throw new Error("not implemented");
  },
  removeEventListener: function removeEventListener() {
    throw new Error("not implemented");
  },
  set upload(ignored) {
    throw new Error("not implemented");
  },
  get onreadystatechange() {
    return this._orsc;
  },
  set onreadystatechange(cb) {
    this._orsc = cb;
    if (cb) {
      var self = this;
      this._req.onreadystatechange = function() {
        try {
          self._orsc.apply(self, arguments);
        } catch (e) {
          console.exception(e);
        }
      };
    } else
      this._req.onreadystatechange = null;
  }
};

READ_ONLY_PROPS.forEach(
   function(name) {
     XMLHttpRequest.prototype.__defineGetter__(
       name,
       function() {
         return this._req[name];
       });
   });

DELEGATED_METHODS.forEach(
  function(name) {
    XMLHttpRequest.prototype[name] = function() {
      this._req[name].apply(this._req, arguments);
    };
  });

require("unload").when(
  function() {
    requests.slice().forEach(function(request) { request._unload(); });
  });
