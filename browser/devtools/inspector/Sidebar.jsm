/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Cu = Components.utils;
const Ci = Components.interfaces;

this.EXPORTED_SYMBOLS = ["InspectorSidebar"];

Cu.import("resource:///modules/devtools/EventEmitter.jsm");

/**
 * InspectorSidebar provides methods to register views in the sidebar.
 * It's assumed that the sidebar contains a xul:tabbox.
 *
 * @param {Node} a <tabbox> node.
 * @param {ToolPanel} Related ToolPanel instance.
 */
this.InspectorSidebar = function InspectorSidebar(tabbox, panel) {
  this.tabbox = tabbox;
  this.panelDoc = this.tabbox.ownerDocument;
  this.panel = panel;
}

InspectorSidebar.prototype = {
  /**
   * Register a view. A view is a document.
   * The document must have a title, which will be used as the name of the tab.
   *
   * @param {string} url
   */
  addView: function InspectorSidebar_addView(url) {
    let tab = this.panelDoc.createElement("tab");
    this.tabbox.tabs.appendChild(tab);

    let iframe = this.panelDoc.createElement("iframe");
    iframe.setAttribute("flex", "1");
    iframe.setAttribute("src", url);

    let onIFrameLoaded = function() {
      tab.setAttribute("label", iframe.contentDocument.title);
      iframe.removeEventListener("DOMContentLoaded", onIFrameLoaded, true);
      iframe.contentWindow.setPanel(this.panel, iframe);
    }.bind(this);
    iframe.addEventListener("DOMContentLoaded", onIFrameLoaded, true);

    let tabpanel = this.panelDoc.createElement("tabpanel");
    tabpanel.appendChild(iframe);
    this.tabbox.tabpanels.appendChild(tabpanel);
  },

  /**
   * Toggle sidebar's visibility state.
   */
  toggle: function InspectorSidebar_toggle() {
    if (this.tabbox.hasAttribute("hidden")) {
      this.show();
    } else {
      this.hide();
    }
  },

  /**
   * Show the sidebar.
   */
  show: function InspectorSidebar_show() {
    this.tabbox.removeAttribute("hidden");
  },

  /**
   * Show the sidebar.
   */
  hide: function InspectorSidebar_hide() {
    this.tabbox.setAttribute("hidden", "true");
  },

  /**
   * Clean-up.
   */
  destroy: function() {
    this.hide();
    this.tabbox = null;
    this.panelDoc = null;
    this.panel = null;
  },
}
