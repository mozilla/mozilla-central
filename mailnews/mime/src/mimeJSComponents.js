/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mimeParser.jsm");
Components.utils.import("resource:///modules/XPCOMUtils.jsm");

function MimeHeaders() {
}
MimeHeaders.prototype = {
  classDescription: "Mime headers implementation",
  classID: Components.ID("d1258011-f391-44fd-992e-c6f4b461a42f"),
  contractID: "@mozilla.org/messenger/mimeheaders;1",
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMimeHeaders]),

  initialize: function MimeHeaders_initialize(allHeaders) {
    this._headers = MimeParser.extractHeaders(allHeaders);
  },

  extractHeader: function MimeHeaders_extractHeader(header, getAll) {
    if (!this._headers)
      throw Components.results.NS_ERROR_NOT_INITIALIZED;
    // Canonicalized to lower-case form
    header = header.toLowerCase();
    if (!this._headers.has(header))
      return null;
    var values = this._headers.get(header);
    if (getAll)
      return values.join(",\r\n\t");
    else
      return values[0];
  },

  get allHeaders() {
    return this._headers.rawHeaderText;
  }
};

var components = [MimeHeaders];
var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
