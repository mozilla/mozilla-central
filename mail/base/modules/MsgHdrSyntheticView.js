/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

/*
 * This object provides you a way to have a synthetic nsIMsgDBView for a single
 * message header.
 */

var EXPORTED_SYMBOLS = ["MsgHdrSyntheticView"];

const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

/**
 * Create a synthetic view suitable for passing to |FolderDisplayWidget.show|.
 * You must pass a single message header in.
 *
 * @param aMsgHdr The message header to create the synthetic view for.
 */
function MsgHdrSyntheticView(aMsgHdr) {
  this.msgHdr = aMsgHdr;

  this.customColumns = [];
}

MsgHdrSyntheticView.prototype = {
  defaultSort: [[Ci.nsMsgViewSortType.byDate, Ci.nsMsgViewSortOrder.descending]],

  /**
   * Request the search be performed and notifications provided to
   * aSearchListener. Since we already have the result with us, this is
   * synchronous.
   */
  search: function MsgHdrSyntheticView_search(aSearchListener,
                                              aCompletionCallback) {
    this.searchListener = aSearchListener;
    this.completionCallback = aCompletionCallback;
    aSearchListener.onNewSearch();
    aSearchListener.onSearchHit(this.msgHdr, this.msgHdr.folder);
    // we're not really aborting, but it closes things out nicely
    this.abortSearch();
  },

  /**
   * Aborts or completes the search -- we do not make a distinction.
   */
  abortSearch: function MsgHdrSyntheticView_abortSearch() {
    if (this.searchListener)
      this.searchListener.onSearchDone(Cr.NS_OK);
    if (this.completionCallback)
      this.completionCallback();
    this.searchListener = null;
    this.completionCallback = null;
  },

  /**
   * Helper function used by |DBViewWrapper.getMsgHdrForMessageID|.
   */
  getMsgHdrForMessageID: function MsgHdrSyntheticView_getMsgHdrForMessageID(
      aMessageId) {
    if (this.msgHdr.messageId == aMessageId)
      return this.msgHdr;

    return null;
  }
};
