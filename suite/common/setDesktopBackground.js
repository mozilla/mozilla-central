/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIShellService = Components.interfaces.nsIShellService;
var gShell = Components.classes["@mozilla.org/suite/shell-service;1"]
                       .getService(nsIShellService);

var gImage, gPosition, gPicker, gDesktop;

function onLoad()
{
  document.getElementById("itemsBox").hidden = /Mac/.test(navigator.platform);
  gImage = window.arguments[0];
  gPosition = document.getElementById("position");
  gPicker = document.getElementById("picker");
  gDesktop = document.getElementById("desktop");

  sizeToContent();
  window.innerWidth += screen.width / 2 - gDesktop.boxObject.width;
  window.innerHeight += screen.height / 2 - gDesktop.boxObject.height;

  try {
    var color = gShell.desktopBackgroundColor;
    color = (0xF000000 | color).toString(16).toUpperCase().replace("F", "#");
    gDesktop.style.backgroundColor = color;
    gPicker.color = color;
  } catch (e) {
    gPicker.parentNode.hidden = true;
  }

  gDesktop.style.backgroundImage = 'url("' + gImage.src + '")';

  updatePosition();
}

function onApply()
{
  if (!gPicker.parentNode.hidden)
    gShell.desktopBackgroundColor = parseInt(gPicker.color.substr(1), 16);

  gShell.setDesktopBackground(gImage, nsIShellService[gPosition.value]);
}

function updatePosition()
{
  gDesktop.style.backgroundPosition = "center";
  gDesktop.style.backgroundRepeat = "no-repeat";
  switch (gPosition.value) {
    case "BACKGROUND_FIT":
      gDesktop.style.backgroundSize = "contain";
      return;
    case "BACKGROUND_FILL":
      gDesktop.style.backgroundSize = "cover";
      return;
    case "BACKGROUND_STRETCH":
      gDesktop.style.backgroundPosition = "";
      gDesktop.style.backgroundSize = "100% 100%";
      return;
    case "BACKGROUND_TILE":
      gDesktop.style.backgroundPosition = "";
      gDesktop.style.backgroundRepeat = "repeat";
  }
  gDesktop.style.backgroundSize =
    (gImage.naturalWidth / 2) + "px " + (gImage.naturalHeight / 2) + "px";
}

function updateColor()
{
  gDesktop.style.backgroundColor = gPicker.color;
}
