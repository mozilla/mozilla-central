/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function DSNService() {}

DSNService.prototype = {
  name: "dsn",
  chromePackageName: "messenger",
  showPanel: function(server) {
    // don't show the panel for news, rss, or local accounts
    return (server.type != "nntp" && server.type != "rss" &&
            server.type != "none");
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMsgAccountManagerExtension]),
  classID: Components.ID("{849dab91-9bc9-4508-a0ee-c2453e7c092d}"),
};

var components = [DSNService];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
