/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Thunderbird Activity Manager.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

const EXPORTED_SYMBOLS = ['alertHook'];

const Cc = Components.classes;
const Ci = Components.interfaces;

const nsActWarning = Components.Constructor("@mozilla.org/activity-warning;1",
                                            "nsIActivityWarning", "init");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// This module provides a link between the send later service and the activity
// manager.
let alertHook =
{
  get activityMgr() {
    delete this.activityMgr;
    return this.activityMgr = Cc["@mozilla.org/activity-manager;1"]
                                .getService(Ci.nsIActivityManager);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgUserFeedbackListener]),

  onAlert: function (aMessage, aUrl) {
    // Create a new warning.
    let warning = new nsActWarning(aMessage, this.activityMgr, "");

    if (aUrl && aUrl.server && aUrl.server.prettyName) {
      warning.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_BYCONTEXT;
      warning.contextType = "incomingServer";
      warning.contextDisplayText = aUrl.server.prettyName;
      warning.contextObj = aUrl.server;
    }
    else
      warning.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_STANDALONE;

    this.activityMgr.addActivity(warning);

    // XXX Once activity manager is prompting the user (bug 476696), this needs
    // to be flipped to true to stop the modal alerts appearing from within
    // mailnews.
    return false;
  },

  init: function() {
    // We shouldn't need to remove the listener as we're not being held by
    // anyone except by the send later instance.
    let msgMailSession = Cc["@mozilla.org/messenger/services/session;1"]
                             .getService(Ci.nsIMsgMailSession);

    msgMailSession.addUserFeedbackListener(this);
  }
};
