/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/devtools/dbg-server.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * Start the devtools debugger server and open a listener to contact it.
 */
function startDebugger() {
  if (!DebuggerServer.initialized) {
    // Initialize the debugger, if non-local connections are permitted then
    // have the default prompt kick in.
    DebuggerServer.init(() => {
      return Services.prefs.getBoolPref("devtools.debugger.force-local") ||
             DebuggerServer._defaultAllowConnection();
    });

    // Load the toolkit actors first
    DebuggerServer.addBrowserActors();

    // Set up the window type and add the mail root actor
    DebuggerServer.chromeWindowType = "mail:3pane";
    DebuggerServer.addActors("chrome://messenger/content/debugger/dbg-mail-actors.js");
  }

  // Start the debugger listener unconditionally, it will check itself if it
  // really needs to be started.
  let port = Services.prefs.getIntPref('devtools.debugger.remote-port') || 6000;
  try {
    DebuggerServer.openListener(port);
  } catch (e) {
    console.exception("Unable to start debugger server", e);
  }
}

/**
 * Quit the devtools debugger server, forcing to disconnect all connections.
 */
function stopDebugger() {
  try {
    DebuggerServer.closeListener(true);
  } catch (e) {
    console.exception("Unable to stop debugger server", e);
  }
}

/**
 * Handler to call when the checked state of the menuitem is toggled. Sets the
 * remote-enabled preference of the debugger and starts the debugger if needed.
 */
function toggleDebugger() {
  let shouldEnable = document.getElementById("devtoolsDebugger").getAttribute("checked") == "true";
  Services.prefs.setBoolPref("devtools.debugger.remote-enabled", shouldEnable);

  if (shouldEnable) {
    startDebugger();
  } else {
    stopDebugger();
  }
}

/**
 * Intialize the checked state, to be used when the view menu is opened.
 */
function initDebuggerToolsMenu() {
  let debuggerEnabled = Services.prefs.getBoolPref("devtools.debugger.remote-enabled");
  document.getElementById("devtoolsDebugger")
          .setAttribute("checked", debuggerEnabled);
}

/**
 * Intialize everything needed on load in the window for the debugger, i.e
 * menuitem checked state listeners.
 */
function loadDebugger() {
  window.removeEventListener("load", loadDebugger, false);
  let viewPopup = document.getElementById("taskPopup");
  viewPopup.addEventListener("popupshowing", initDebuggerToolsMenu, false);

  // Call these functions once to start or stop the debugger on startup.
  initDebuggerToolsMenu();
  toggleDebugger();
}

/**
 * Shutdown everything needed on load in the window for the debugger, i.e
 * menuitem checked state listeners.
 */
function unloadDebugger() {
  window.removeEventListener("unload", unloadDebugger, false);
  let viewPopup = document.getElementById("taskPopup");
  viewPopup.removeEventListener("popupshowing", initDebuggerToolsMenu, false);
}

// Load and unload the debugger when the window loads/unloads.
window.addEventListener("load", loadDebugger, false);
window.addEventListener("unload", unloadDebugger, false);
