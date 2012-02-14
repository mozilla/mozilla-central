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
 * The Original Code is summary frame manager
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2009-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Ascher <dascher@mozillamessaging.com>
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

const EXPORTED_SYMBOLS = ["SummaryFrameManager"];

/**
 * The SummaryFrameManager manages the source attribute of iframes which can
 * be multi-purposed.  For example, the thread/multimessage summary and the
 * folder summary both use it.  The SummaryFrameManager takes care of
 * causing the content file to be reloaded as necessary, and manages event
 * handlers, so that the right callback is called when the specified
 * document is loaded.
 *
 * @param aFrame the iframe that we're managing
 */
function SummaryFrameManager(aFrame) {
  this.iframe = aFrame;
  this.iframe.addEventListener("DOMContentLoaded", this._onLoad.bind(this),
                               true);
  this.pendingCallback = null;
  this.pendingOrLoadedUrl = this.iframe.docShell
    ? this.iframe.contentDocument.location.href
    : "about:blank";
  this.callback = null;
  this.url = "";
}

SummaryFrameManager.prototype = {
  /**
   * Clear the summary frame.
   */
  clear: function() {
    this.loadAndCallback("about:blank");
  },

  /**
   * Load the specified URL if necessary, and cause the specified callback to be
   * called either when the document is loaded, or immediately if the document
   * is already loaded.
   *
   * @param aUrl the URL to load
   * @param aCallback the callback to run when the URL has loaded; this function
   *        is passed a single boolean indicating if the URL was changed
   */
  loadAndCallback: function(aUrl, aCallback) {
    this.url = aUrl;
    if (this.pendingOrLoadedUrl != aUrl) {
      // We're changing the document. Stash the callback that we want to call
      // when it's done loading
      this.pendingCallback = aCallback;
      this.callback = null; // clear it
      this.iframe.contentDocument.location.href = aUrl;
      this.pendingOrLoadedUrl = aUrl;
    }
    else {
      // We're being called, but the document has been set already -- either
      // we've already received the DOMContentLoaded event, in which case we can
      // just call the callback directly, or we're still loading in which case
      // we should just wait for the dom event handler, but update the callback.

      if (!this.pendingCallback) {
        this.callback = aCallback;
        if (this.callback) {
          this.callback(false);
        }
      }
      else {
        this.pendingCallback = aCallback;
      }
    }
  },

  _onLoad: function(event) {
    try {
      // Make sure we're responding to the summary frame being loaded, and not
      // some subnode.
      if (event.originalTarget != this.iframe.contentDocument)
        return;

      this.callback = this.pendingCallback;
      this.pendingCallback = null;
      if (this.pendingOrLoadedUrl != this.iframe.contentDocument.location.href)
        Components.utils.reportError(
          "Please do not load stuff in the multimessage browser directly, "+
          "use the SummaryFrameManager instead.");
      else if (this.callback)
        this.callback(true);
    }
    catch (e) {
      Components.utils.reportError(e);
    }
  }
};
