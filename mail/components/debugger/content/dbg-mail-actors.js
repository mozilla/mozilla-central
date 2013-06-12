/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * Create the root actor for Thunderbird's debugger implementation.
 *
 * @param aConnection       The debugger connection to create the actor for.
 * @return                  The mail actor for the connection.
 */
function createRootActor(aConnection) {
  let parameters = {
    tabList: new MailTabList(aConnection),
    globalActorFactories: DebuggerServer.globalActorFactories,
    onShutdown: sendShutdownEvent,
  };

  let mailActor = new RootActor(aConnection, parameters);
  mailActor.applicationType = "mail";
  return mailActor;
}

/**
 * Send a debugger shutdown event to all mail windows.
 */
function sendShutdownEvent() {
  for (let win in fixIterator(Services.wm.getEnumerator("mail:3pane"))) {
    let evt = win.document.createEvent("Event");
    evt.initEvent("Debugger:Shutdown", true, false);
    win.document.documentElement.dispatchEvent(evt);
  }
}

/**
 * The live list of tabs for Thunderbird. The term tab is taken from Firefox
 * tabs, where each browser tab shows up as a tab in the debugger. As in
 * Thunderbird all tabs are chrome tabs, we will be iterating the content
 * windows and presenting them as tabs instead.
 *
 * @param aConnection       The connection to create the tab list for
 */
function MailTabList(aConnection) {
  BrowserTabList.call(this, aConnection);
}

MailTabList.prototype = {
  __proto__: BrowserTabList.prototype,

  iterator: function() {
    // For now we just need to make sure this function is a generator. Actually
    // returning a list of tabs will be done in a future bug.
    for (let dummy in []) {
      yield dummy;
    }
  }
};
