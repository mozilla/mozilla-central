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
 * The Original Code is Mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Doron Rosenberg.
 * Portions created by the Initial Developer are Copyright (C) 2001-2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Ross <blakeross@telocity.com> (Original Author)
 *   Ben Goodger <ben@bengoodger.com> (v2.0)
 *   Edward Lee <edward.lee@engineering.uiuc.edu>
 *   Shawn Wilsher <me@shawnwilsher.com> (v3.0)
 *   Robert Kaiser <kairo@kairo.at> (suite adaptation)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * DownloadProgressListener "class" is used to help update download items shown
 * in the Download Manager UI such as displaying amount transferred, transfer
 * rate, and time left for each download.
 *
 * This class implements the nsIDownloadProgressListener interface.
 */
function DownloadProgressListener() {}

DownloadProgressListener.prototype = {
  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIDownloadProgressListener]),

  //////////////////////////////////////////////////////////////////////////////
  //// nsIDownloadProgressListener

  onDownloadStateChange: function(aState, aDownload) {
    // Update window title in-case we don't get all progress notifications
    onUpdateProgress();

    switch (aDownload.state) {
      case nsIDownloadManager.DOWNLOAD_QUEUED:
        gDownloadTreeView.addDownload(aDownload);
        break;

      case nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY:
        gDownloadTreeView.addDownload(aDownload);
        // Should fall through, this is a final state but DOWNLOAD_QUEUED
        // is skipped. See nsDownloadManager::AddDownload.
      default:
        gDownloadTreeView.updateDownload(aDownload);
        break;
    }
  },

  onProgressChange: function(aWebProgress, aRequest,
                             aCurSelfProgress, aMaxSelfProgress,
                             aCurTotalProgress, aMaxTotalProgress, aDownload) {
    gDownloadTreeView.updateDownload(aDownload);

    // Update window title
    onUpdateProgress();
  },

  onStateChange: function(aWebProgress, aRequest, aState, aStatus, aDownload) {
  },

  onSecurityChange: function(aWebProgress, aRequest, aState, aDownload) {
  }
};
