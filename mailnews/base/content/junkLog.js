/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var gLogView;
var gLogFile;

function onLoad()
{
  gLogView = document.getElementById("logView");
  gLogView.docShell.allowJavascript = false; // for security, disable JS

  gLogFile = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
  gLogFile.append("junklog.html");

  if (gLogFile.exists())
  {
    // convert the file to a URL so we can load it.
    gLogView.setAttribute("src", Services.io.newFileURI(gLogFile).spec);
  }
}

function clearLog()
{
  if (gLogFile.exists())
  {
    gLogFile.remove(false);
    gLogView.setAttribute("src", "about:blank"); // we don't have a log file to show
  }
}
