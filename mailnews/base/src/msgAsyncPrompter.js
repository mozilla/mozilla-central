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
 * The Original Code is Mailnews Async Prompter.
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
Components.utils.import("resource:///modules/gloda/log4moz.js");

const Ci = Components.interfaces;
const Cc = Components.classes;

function runnablePrompter(asyncPrompter, hashKey) {
  this._asyncPrompter = asyncPrompter;
  this._hashKey = hashKey;
}

runnablePrompter.prototype = {
  _asyncPrompter: null,
  _hashKey: null,

  run: function() {
    this._asyncPrompter._log.debug("Running prompt for " + this._hashKey);
    let prompter = this._asyncPrompter._pendingPrompts[this._hashKey];
    let ok = false;
    try {
      ok = prompter.first.onPromptStart();
    }
    catch (ex) {
      Components.utils.reportError("runnablePrompter:run: " + ex + "\n");
    }

    delete this._asyncPrompter._pendingPrompts[this._hashKey];

    for each (var consumer in prompter.consumers) {
      try {
        if (ok)
          consumer.onPromptAuthAvailable();
        else
          consumer.onPromptCanceled();
      }
      catch (ex) {
        // Log the error for extension devs and others to pick up.
        Components.utils.reportError("runnablePrompter:run: consumer.onPrompt* reported an exception: " + ex + "\n");
      }
    }
    this._asyncPrompter._asyncPromptInProgress--;

    this._asyncPrompter._log.debug("Finished running prompter for " + this._hashKey);
    this._asyncPrompter._doAsyncAuthPrompt();
  }
};

function msgAsyncPrompter() {
  this._pendingPrompts = {};
  this._threadManager = Cc["@mozilla.org/thread-manager;1"]
                          .getService(Ci.nsIThreadManager);
  this._log = Log4Moz.getConfiguredLogger("msgAsyncPrompter",
                                          Log4Moz.Level.Debug,
                                          Log4Moz.Level.Debug,
                                          Log4Moz.Level.Debug);
}

msgAsyncPrompter.prototype = {
  classDescription: "msgAsyncPrompter",
  contractID: "@mozilla.org/messenger/msgAsyncPrompter;1",
  classID: Components.ID("{49b04761-23dd-45d7-903d-619418a4d319}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgAsyncPrompter]),

  _pendingPrompts: null,
  _asyncPromptInProgress: 0,
  _threadManager: null,
  _log: null,

  queueAsyncAuthPrompt: function(aKey, aJumpQueue, aCaller) {
    if (aKey in this._pendingPrompts) {
      this._log.debug("Prompt bound to an existing one in the queue, key: " + aKey);
      this._pendingPrompts[aKey].consumers.push(aCaller);
      return;
    }

    this._log.debug("Adding new prompt to the queue, key: " + aKey);
    let asyncPrompt = {
      first: aCaller,
      consumers: []
    };

    this._pendingPrompts[aKey] = asyncPrompt;
    if (aJumpQueue) {
      this._asyncPromptInProgress++;

      this._log.debug("Forcing runnablePrompter for " + aKey);

      let runnable = new runnablePrompter(this, aKey);
      this._threadManager.mainThread.dispatch(runnable, Ci.nsIThread.DISPATCH_NORMAL);
    }
    else
      this._doAsyncAuthPrompt();
  },

  _doAsyncAuthPrompt: function() {
    if (this._asyncPromptInProgress > 0) {
      this._log.debug("_doAsyncAuthPrompt bypassed - prompt already in progress");
      return;
    }

    // Find the first prompt key we have in the queue.
    let hashKey = null;
    for (hashKey in this._pendingPrompts)
      break;

    if (!hashKey)
      return;

    this._asyncPromptInProgress++;

    this._log.debug("Dispatching runnablePrompter for " + hashKey);

    let runnable = new runnablePrompter(this, hashKey);
    this._threadManager.mainThread.dispatch(runnable,
                                            Ci.nsIThread.DISPATCH_NORMAL);
  }
};

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([msgAsyncPrompter]);
}
