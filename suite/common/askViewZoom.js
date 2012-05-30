/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-

 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var dialog;
var args;

function onLoad() {
  args = window.arguments[0];
  args.zoomOK = false;

  dialog = {};
  dialog.OKButton = document.documentElement.getButton("accept");

  dialog.input = document.getElementById("zoomValue");
  dialog.input.value = args.value;
  dialog.input.select();
  dialog.input.focus();

  doEnabling();
}

function onAccept() {
  var zoom = parseFloat(dialog.input.value);
  if (!isNaN(zoom) && zoom >= args.zoomMin && zoom <= args.zoomMax) {
    args.value = zoom;
    args.zoomOK = true;
  }
  return args.zoomOK;
}

function doEnabling() {
  var enable = false;
  if (dialog.input.value) {
    var zoom = parseFloat(dialog.input.value);
    if (!isNaN(zoom) && zoom >= args.zoomMin && zoom <= args.zoomMax)
      enable = true;
  }

  dialog.OKButton.disabled = !enable;
}
