/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function MDNService() {}

MDNService.prototype = {
  name: "mdn",
  chromePackageName: "messenger",
  showPanel: function(server) {
    // don't show the panel for news, rss, im or local accounts
    return (server.type != "nntp" && server.type != "rss" &&
            server.type != "im" && server.type != "none");
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMsgAccountManagerExtension]),
  classID: Components.ID("{e007d92e-1dd1-11b2-a61e-dc962c9b8571}"),
};

var components = [MDNService];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
