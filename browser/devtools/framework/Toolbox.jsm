/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/EventEmitter.jsm");
Cu.import("resource:///modules/devtools/ToolboxHosts.jsm");
Cu.import("resource:///modules/devtools/gcli.jsm");
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyModuleGetter(this, "gDevTools",
                                  "resource:///modules/devtools/gDevTools.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "CommandUtils",
                                  "resource:///modules/devtools/DeveloperToolbar.jsm");

Components.utils.import("resource://gre/modules/devtools/Require.jsm");

let Requisition = require('gcli/cli').Requisition;
let CommandOutputManager = require('gcli/canon').CommandOutputManager;

this.EXPORTED_SYMBOLS = [ "Toolbox" ];

/**
 * A "Toolbox" is the component that holds all the tools for one specific
 * target. Visually, it's a document that includes the tools tabs and all
 * the iframes where the tool panels will be living in.
 *
 * @param {object} target
 *        The object the toolbox is debugging.
 * @param {DevTools.HostType} hostType
 *        Type of host that will host the toolbox (e.g. sidebar, window)
 * @param {string} selectedTool
 *        Tool to select initially
 */
this.Toolbox = function Toolbox(target, hostType, selectedTool) {
  this._target = target;
  this._toolPanels = new Map();

  this._onLoad = this._onLoad.bind(this);
  this._toolRegistered = this._toolRegistered.bind(this);
  this._toolUnregistered = this._toolUnregistered.bind(this);
  this.destroy = this.destroy.bind(this);

  if (!hostType) {
    hostType = Services.prefs.getCharPref(this._prefs.LAST_HOST);
  }
  if (!selectedTool) {
    selectedTool = Services.prefs.getCharPref(this._prefs.LAST_TOOL);
  }
  let definitions = gDevTools.getToolDefinitions();
  if (!definitions.get(selectedTool)) {
    selectedTool = "webconsole";
  }
  this._defaultToolId = selectedTool;

  this._host = this._createHost(hostType);

  new EventEmitter(this);

  gDevTools.on("tool-registered", this._toolRegistered);
  gDevTools.on("tool-unregistered", this._toolUnregistered);
}

Toolbox.prototype = {
  _URL: "chrome://browser/content/devtools/framework/toolbox.xul",

  _prefs: {
    LAST_HOST: "devtools.toolbox.host",
    LAST_TOOL: "devtools.toolbox.selectedTool"
  },

  /**
   * Returns a *copy* of the _toolPanels collection.
   *
   * @return {Map} panels
   *         All the running panels in the toolbox
   */
  getToolPanels: function TB_getToolPanels() {
    let panels = new Map();

    for (let [key, value] of this._toolPanels) {
      panels.set(key, value);
    }
    return panels;
  },

  /**
   * Get/alter the target of a Toolbox so we're debugging something different.
   * See Target.jsm for more details.
   * TODO: Do we allow |toolbox.target = null;| ?
   */
  get target() {
    return this._target;
  },

  set target(value) {
    this._target = value;
  },

  /**
   * Get/alter the host of a Toolbox, i.e. is it in browser or in a separate
   * tab. See HostType for more details.
   */
  get hostType() {
    return this._host.type;
  },

  set hostType(value) {
    this._switchToHost(value);
  },

  /**
   * Get/alter the currently displayed tool.
   */
  get currentToolId() {
    return this._currentToolId;
  },

  set currentToolId(value) {
    this._currentToolId = value;
  },

  /**
   * Get the iframe containing the toolbox UI.
   */
  get frame() {
    return this._host.frame;
  },

  /**
   * Shortcut to the document containing the toolbox UI
   */
  get doc() {
    return this.frame.contentDocument;
  },

  /**
   * Open the toolbox
   */
  open: function TBOX_open() {
    this._host.once("ready", function(event, iframe) {
      iframe.addEventListener("DOMContentLoaded", this._onLoad, true);
      iframe.setAttribute("src", this._URL);
    }.bind(this));

    this._host.open();
  },

  /**
   * Onload handler for the toolbox's iframe
   */
  _onLoad: function TBOX_onLoad() {
    this.frame.removeEventListener("DOMContentLoaded", this._onLoad, true);
    this.isReady = true;

    let buttons = this.doc.getElementsByClassName("toolbox-dock-button");

    for (let i = 0; i < buttons.length; i++) {
      let button = buttons[i];
      button.addEventListener("command", function() {
        let position = button.getAttribute("data-position");
        this._switchToHost(position);
      }
      .bind(this), true);
    }

    let closeButton = this.doc.getElementById("toolbox-close");
    closeButton.addEventListener("command", this.destroy, true);

    this._buildTabs();
    this._buildButtons(this.frame);

    this.selectTool(this._defaultToolId);

    this.emit("ready");
  },

  /**
   * Add tabs to the toolbox UI for registered tools
   */
  _buildTabs: function TBOX_buildTabs() {
    for (let [id, definition] of gDevTools.getToolDefinitions()) {
      this._buildTabForTool(definition);
    }
  },

  /**
   * Add buttons to the UI as specified in the devtools.window.toolbarspec pref
   *
   * @param {iframe} frame
   *        The iframe to contain the buttons
   */
  _buildButtons: function TBOX_buildButtons(frame) {
    let toolbarSpec = CommandUtils.getCommandbarSpec("devtools.toolbox.toolbarspec");
    let environment = { chromeDocument: frame.ownerDocument };
    let requisition = new Requisition(environment);
    requisition.commandOutputManager = new CommandOutputManager();

    let buttons = CommandUtils.createButtons(toolbarSpec, this.doc, requisition);

    let container = this.doc.getElementById("toolbox-buttons");
    buttons.forEach(function(button) {
      container.appendChild(button);
    }.bind(this));
  },

  /**
   * Build a tab for one tool definition and add to the toolbox
   *
   * @param {string} toolDefinition
   *        Tool definition of the tool to build a tab for.
   */
  _buildTabForTool: function TBOX_buildTabForTool(toolDefinition) {
    let tabs = this.doc.getElementById("toolbox-tabs");
    let deck = this.doc.getElementById("toolbox-deck");

    let id = toolDefinition.id;

    let radio = this.doc.createElement("radio");
    radio.setAttribute("label", toolDefinition.label);
    radio.className = "toolbox-tab devtools-tab";
    radio.id = "toolbox-tab-" + id;
    radio.setAttribute("toolid", id);

    let ordinal = (typeof toolDefinition.ordinal == "number") ?
                  toolDefinition.ordinal : 99;
    radio.setAttribute("ordinal", ordinal);

    radio.addEventListener("command", function(id) {
      this.selectTool(id);
    }.bind(this, id));

    let vbox = this.doc.createElement("vbox");
    vbox.className = "toolbox-panel";
    vbox.id = "toolbox-panel-" + id;

    let iframe = this.doc.createElement("iframe");
    iframe.className = "toolbox-panel-iframe";
    iframe.id = "toolbox-panel-iframe-" + id;
    iframe.setAttribute("toolid", id);
    iframe.setAttribute("flex", 1);

    tabs.appendChild(radio);
    vbox.appendChild(iframe);
    deck.appendChild(vbox);
  },

  /**
   * Switch to the tool with the given id
   *
   * @param {string} id
   *        The id of the tool to switch to
   */
  selectTool: function TBOX_selectTool(id) {
    if (!this.isReady) {
      throw new Error("Can't select tool, wait for toolbox 'ready' event");
    }
    let tab = this.doc.getElementById("toolbox-tab-" + id);
    let tabstrip = this.doc.getElementById("toolbox-tabs");

    // select the right tab
    let index = -1;
    let tabs = tabstrip.childNodes;
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i] === tab) {
        index = i;
        break;
      }
    }
    tabstrip.selectedIndex = index;

    // and select the right iframe
    let deck = this.doc.getElementById("toolbox-deck");
    deck.selectedIndex = index;

    let iframe = this.doc.getElementById("toolbox-panel-iframe-" + id);

    let definition = gDevTools.getToolDefinitions().get(id);

    // only build the tab's content if we haven't already
    if (iframe.src != definition.url) {
      let boundLoad = function() {
        iframe.removeEventListener("DOMContentLoaded", boundLoad, true);
        let panel = definition.build(iframe.contentWindow, this);
        this._toolPanels.set(id, panel);
        if (panel.isReady) {
          this.emit(id + "-ready", panel);
        } else {
          panel.once("ready", function(event) {
            this.emit(id + "-ready", panel);
          }.bind(this));
        }
      }.bind(this);

      iframe.addEventListener("DOMContentLoaded", boundLoad, true);
      iframe.setAttribute("src", definition.url);
    }

    Services.prefs.setCharPref(this._prefs.LAST_TOOL, id);

    this._currentToolId = id;
  },

  /**
   * Create a host object based on the given host type.
   *
   * @param {string} hostType
   *        The host type of the new host object
   *
   * @return {Host} host
   *        The created host object
   */
  _createHost: function TBOX_createHost(hostType) {
    let hostTab = this._getHostTab();
    if (!Hosts[hostType]) {
      throw new Error('Unknown hostType: '+ hostType);
    }
    let newHost = new Hosts[hostType](hostTab);

    // clean up the toolbox if its window is closed
    newHost.on("window-closed", this.destroy);

    return newHost;
  },

  /**
   * Switch to a new host for the toolbox UI. E.g.
   * bottom, sidebar, separate window.
   *
   * @param {string} hostType
   *        The host type of the new host object
   */
  _switchToHost: function TBOX_switchToHost(hostType) {
    if (hostType == this._host.type) {
      return;
    }

    let newHost = this._createHost(hostType);

    newHost.once("ready", function(event, iframe) {
      // change toolbox document's parent to the new host
      iframe.QueryInterface(Components.interfaces.nsIFrameLoaderOwner);
      iframe.swapFrameLoaders(this.frame);

      this._host.off("window-closed", this.destroy);
      this._host.destroy();

      this._host = newHost;

      Services.prefs.setCharPref(this._prefs.LAST_HOST, this._host.type);

      this._setDockButtons();

      this.emit("host-changed");
    }.bind(this));

    newHost.open();
  },

  /**
   * Get the most appropriate host tab, either the target or the current tab
   */
  _getHostTab: function TBOX_getHostTab() {
    if (!this._target.isRemote && !this._target.isChrome) {
      return this._target.tab;
    } else {
      let win = Services.wm.getMostRecentWindow("navigator:browser");
      return win.gBrowser.selectedTab;
    }
  },

  /**
   * Set the docking buttons to reflect the current host
   */
  _setDockButtons: function TBOX_setDockButtons() {
    let buttons = this.doc.querySelectorAll(".toolbox-dock-button");
    for (let button of buttons) {
      if (button.id == "toolbox-dock-" + this._host.type) {
        button.checked = true;
      }
      else {
        button.checked = false;
      }
    }
  },

  /**
   * Handler for the tool-registered event.
   * @param  {string} event
   *         Name of the event ("tool-registered")
   * @param  {string} toolId
   *         Id of the tool that was registered
   */
  _toolRegistered: function TBOX_toolRegistered(event, toolId) {
    let defs = gDevTools.getToolDefinitions();
    let tool = defs.get(toolId);

    this._buildTabForTool(tool);
  },

  /**
   * Handler for the tool-unregistered event.
   * @param  {string} event
   *         Name of the event ("tool-unregistered")
   * @param  {string} toolId
   *         Id of the tool that was unregistered
   */
  _toolUnregistered: function TBOX_toolUnregistered(event, toolId) {
    let radio = this.doc.getElementById("toolbox-tab-" + toolId);
    let panel = this.doc.getElementById("toolbox-panel-" + toolId);

    if (this._currentToolId == toolId) {
      let nextToolName = null;
      if (radio.nextSibling) {
        nextToolName = radio.nextSibling.getAttribute("toolid");
      }
      if (radio.previousSibling) {
        nextToolName = radio.previousSibling.getAttribute("toolid");
      }
      if (nextToolName) {
        this.selectTool(nextToolName);
      }
    }

    if (radio) {
      radio.parentNode.removeChild(radio);
    }

    if (panel) {
      panel.parentNode.removeChild(panel);
    }

    if (this._toolPanels.has(toolId)) {
      let instance = this._toolPanels.get(toolId);
      instance.destroy();
      this._toolPanels.delete(toolId);
    }
  },


  /**
   * Get the toolbox's notification box
   *
   * @return The notification box element.
   */
  getNotificationBox: function TBOX_getNotificationBox() {
    return this.doc.getElementById("toolbox-notificationbox");
  },

  /**
   * Remove all UI elements, detach from target and clear up
   */
  destroy: function TBOX_destroy() {
    for (let [id, panel] of this._toolPanels) {
      panel.destroy();
    }

    this._host.destroy();

    gDevTools.off("tool-registered", this._toolRegistered);
    gDevTools.off("tool-unregistered", this._toolUnregistered);

    this.emit("destroyed");
  }
};
