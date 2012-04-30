/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

function onLoadProvider(provider) {
  let messenger = Components.classes["@mozilla.org/messenger;1"]
                            .createInstance(Components.interfaces.nsIMessenger);

  let fileSpaceUsed = document.getElementById("file-space-used");
  fileSpaceUsed.textContent = messenger.formatFileSize(provider.fileSpaceUsed);
  let fileSpaceUsedSwatch = document.getElementById("file-space-used-swatch");
  fileSpaceUsedSwatch.style.backgroundColor = pv.Colors.category20.values[0];

  let remainingFileSpace = document.getElementById("remaining-file-space");
  remainingFileSpace.textContent = messenger.formatFileSize(
    provider.remainingFileSpace);
  let remainingFileSpaceSwatch = document.getElementById("remaining-file-space-swatch");
  remainingFileSpaceSwatch.style.backgroundColor = pv.Colors.category20.values[1];

  let totalSpace = provider.fileSpaceUsed + provider.remainingFileSpace;
  let pieScale = 2 * Math.PI / totalSpace;

  let spaceDiv = document.getElementById("provider-space-visuals");
  let vis = new pv.Panel().canvas(spaceDiv)
    .width(150)
    .height(150);
  vis.add(pv.Wedge)
    .data([provider.fileSpaceUsed, provider.remainingFileSpace])
    .left(75)
    .top(75)
    .innerRadius(30)
    .outerRadius(65)
    .angle(function(d) d * pieScale);

  vis.add(pv.Label)
    .left(75)
    .top(75)
    .font("14px Sans-Serif")
    .textAlign("center")
    .textBaseline("middle")
    .text(messenger.formatFileSize(totalSpace));

  vis.render();
}
