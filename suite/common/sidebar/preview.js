/* -*- Mode: Java -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Init()
{
  var panel_name = window.arguments[0];
  var panel_URL = window.arguments[1];

  var panel_title = document.getElementById('paneltitle');
  var preview_frame = document.getElementById('previewframe');
  panel_title.setAttribute('label', panel_name);
  preview_frame.setAttribute('src', panel_URL);
}
