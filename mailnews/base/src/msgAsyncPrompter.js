/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
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
  // By default, only log warnings to the error console and errors to dump().
  // You can use the preferences:
  //   msgAsyncPrompter.logging.console
  //   msgAsyncPrompter.logging.dump
  // To change this up.  Values should be one of:
  //   Fatal/Error/Warn/Info/Config/Debug/Trace/All
  this._log = Log4Moz.getConfiguredLogger("msgAsyncPrompter",
                                          Log4Moz.Level.Warn,
                                          Log4Moz.Level.Warn);
}

msgAsyncPrompter.prototype = {
  classID: Components.ID("{49b04761-23dd-45d7-903d-619418a4d319}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgAsyncPrompter]),

  _pendingPrompts: null,
  _asyncPromptInProgress: 0,
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
      Services.tm.mainThread.dispatch(runnable, Ci.nsIThread.DISPATCH_NORMAL);
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
    Services.tm.mainThread.dispatch(runnable, Ci.nsIThread.DISPATCH_NORMAL);
  }
};

var components = [msgAsyncPrompter];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
