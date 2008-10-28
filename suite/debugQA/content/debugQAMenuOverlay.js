/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Ross <blakeross@telocity.com>
 *   Peter Annema <disttsc@bart.nl>
 *   Dean Tessman <dean_tessman@hotmail.com>
 *   Mark Banner <bugzilla@standard8.demon.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var gLeakDetector = null;
var gLeakDetectorVerbose = false;

// "about:bloat" is available only when
// (the application is) compiled with |--enable-logrefcnt|.
if ("@mozilla.org/network/protocol/about;1?what=bloat" in Components.classes)
  window.addEventListener("load", onLoadBloat, false);

// The Leak Detector (class) can be undefined in a given (application) build.
if ("@mozilla.org/xpcom/leakdetector;1" in Components.classes)
  window.addEventListener("load", onLoadLeakDetector, false);

// Unhide (and enable) the Bloat menu and its associated (shared) separator.
function onLoadBloat()
{
  window.removeEventListener("load", onLoadBloat, false);

  // Enable the menu, only if its feature is currently active.
  var envSvc = Components.classes["@mozilla.org/process/environment;1"]
                         .getService(Components.interfaces.nsIEnvironment);
  // Checking the environment variables is good enough,
  // as the Bloat service doesn't report the status of its statistics feature.
  if (envSvc.exists("XPCOM_MEM_BLOAT_LOG") ||
      envSvc.exists("XPCOM_MEM_LEAK_LOG"))
    document.getElementById("bloatMenu").disabled = false;

  document.getElementById("bloatAndLeakSeparator").hidden = false;
  document.getElementById("bloatMenu").hidden = false;
}

// Initialize the Leak Detector,
// and unhide its menu and its associated (shared) separator.
function onLoadLeakDetector()
{
  window.removeEventListener("load", onLoadLeakDetector, false);

  gLeakDetector = Components.classes["@mozilla.org/xpcom/leakdetector;1"]
                            .createInstance(Components.interfaces.nsILeakDetector);

  document.getElementById("bloatAndLeakSeparator").hidden = false;
  document.getElementById("leakMenu").hidden = false;
}

// Dumps current set of memory leaks.
function dumpMemoryLeaks()
{
  gLeakDetector.dumpLeaks();
}

// Traces all objects reachable from the chrome document.
function traceChrome()
{
  gLeakDetector.traceObject(document, gLeakDetectorVerbose);
}

// Traces all objects reachable from the content document.
function traceDocument()
{
  // keep the chrome document out of the dump.
  gLeakDetector.markObject(document, true);
  gLeakDetector.traceObject(content, gLeakDetectorVerbose);
  gLeakDetector.markObject(document, false);
}

/**
 * Controls whether or not we do verbose tracing.
 * @param verbose Either |"true"| or |""|.
 */
function traceVerbose(verbose)
{
  gLeakDetectorVerbose = (verbose == "true");
}
