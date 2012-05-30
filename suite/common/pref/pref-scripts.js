/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function setDisableState(id, state) {
  var component = document.getElementById(id);
  var preference = component.getAttribute("preference");
  var isLocked = document.getElementById(preference).locked;
  component.disabled = isLocked || state;
}

function changeDisabledState(state) {
  //Set the states of the groupbox children state based on the "javascript enabled" checkbox value
  setDisableState("allowWindowMoveResize", state);
  setDisableState("allowImageSrcChange", state);
  setDisableState("allowWindowStatusChange", state);
  setDisableState("allowWindowFlip", state);
  setDisableState("allowHideStatusBar", state);
  setDisableState("allowContextmenuDisable", state);
}

function javascriptEnabledChange() {
  var javascriptDisabled = !document.getElementById('javascript.enabled').value;
  changeDisabledState(javascriptDisabled);
}

function Startup() {
  javascriptEnabledChange();
}
