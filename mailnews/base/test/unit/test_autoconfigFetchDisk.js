/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is autoconfig test code.
 *
 * The Initial Developer of the Original Code is
 *   Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (c) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <mbanner@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

/**
 * Tests getting a configuration file from the local isp directory and
 * reading that file.
 */

// Globals
const kXMLFile = "example.com.xml";
var fetchConfigAbortable;
var copyLocation;

var xmlReader =
{
  setTimeout : function(func, interval) {
    do_timeout(interval, func);
  }
};

try {
  let loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                 .getService(Ci.mozIJSSubScriptLoader);
  loader.loadSubScript(
    "chrome://messenger/content/accountcreation/util.js", xmlReader);
  loader.loadSubScript(
    "chrome://messenger/content/accountcreation/fetchConfig.js", xmlReader);
  loader.loadSubScript(
    "chrome://messenger/content/accountcreation/accountConfig.js", xmlReader);
  loader.loadSubScript(
    "chrome://messenger/content/accountcreation/sanitizeDatatypes.js",
    xmlReader);
  loader.loadSubScript(
    "chrome://messenger/content/accountcreation/readFromXML.js", xmlReader);
} catch (ex) {
  dump(ex);
  // The "accountcreation" files are not available in SeaMonkey (yet).
  xmlReader = null;
}

function onTestSuccess(config)
{
  // Check that we got the expected config.
  xmlReader.replaceVariables(config, 
                             "Yamato Nadeshiko",
                             "yamato.nadeshiko@example.com",
                             "abc12345");

  do_check_eq(config.incoming.username, "yamato.nadeshiko");
  do_check_eq(config.outgoing.username, "yamato.nadeshiko@example.com");
  do_check_eq(config.incoming.hostname, "pop.example.com");
  do_check_eq(config.outgoing.hostname, "smtp.example.com");
  do_check_eq(config.identity.realname, "Yamato Nadeshiko");
  do_check_eq(config.identity.emailAddress, "yamato.nadeshiko@example.com");
  do_test_finished();
}

function onTestFailure(e)
{
  do_throw(e);
}

function run_test()
{
  do_register_cleanup(finish_test);
  if (!xmlReader) {
    // if you see this and this is Thunderbird, then it's an error
    dump("INFO | test_autoconfigFetchDisk.js not running, because this is SeaMonkey.");
    return;
  }

  // Copy the xml file into place
  let file = do_get_file("data/" + kXMLFile);

  copyLocation = Services.dirsvc.get("CurProcD", Ci.nsIFile);
  copyLocation.append("isp");
  
  file.copyTo(copyLocation, kXMLFile);

  do_test_pending();

  // Now run the actual test
  // Note we keep a global copy of this so that the abortable doesn't get
  // garbage collected before the async operation has finished.
  fetchConfigAbortable = xmlReader.fetchConfigFromDisk("example.com",
                                                       onTestSuccess,
                                                       onTestFailure);
}

function finish_test()
{
  // Remove the test config file
  copyLocation.append(kXMLFile);
  copyLocation.remove(false);
}
