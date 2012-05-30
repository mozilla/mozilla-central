/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let EXPORTED_SYMBOLS = ["DownloadTaskbarIntegration"];

var DownloadTaskbarIntegration = {
  onBrowserWindowLoad: function(aWindow) {
    if (this.DownloadTaskbarProgress)
      this.DownloadTaskbarProgress.onBrowserWindowLoad(aWindow);
  },
  onDownloadWindowLoad: function(aWindow) {
    if (this.DownloadTaskbarProgress)
      this.DownloadTaskbarProgress.onDownloadWindowLoad(aWindow);
  }
};

const WINTASKBAR_CONTRACTID = "@mozilla.org/windows-taskbar;1";

if (WINTASKBAR_CONTRACTID in Components.classes &&
    Components.classes[WINTASKBAR_CONTRACTID]
              .getService(Components.interfaces.nsIWinTaskbar)
              .available) {
  Components.utils.import("resource://gre/modules/DownloadTaskbarProgress.jsm",
                          DownloadTaskbarIntegration);
}
