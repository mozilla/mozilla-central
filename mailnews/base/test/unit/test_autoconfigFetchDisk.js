/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests getting a configuration file from the local isp directory and
 * reading that file.
 */

// Globals

Components.utils.import("resource://gre/modules/Services.jsm");

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
  Services.scriptloader.loadSubScript(
    "chrome://messenger/content/accountcreation/util.js", xmlReader);
  Services.scriptloader.loadSubScript(
    "chrome://messenger/content/accountcreation/fetchConfig.js", xmlReader);
  Services.scriptloader.loadSubScript(
    "chrome://messenger/content/accountcreation/accountConfig.js", xmlReader);
  Services.scriptloader.loadSubScript(
    "chrome://messenger/content/accountcreation/sanitizeDatatypes.js",
    xmlReader);
  Services.scriptloader.loadSubScript(
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
  if (!xmlReader) {
    // if you see this and this is Thunderbird, then it's an error
    dump("INFO | test_autoconfigFetchDisk.js not running, because this is SeaMonkey.");
    return;
  }

  do_register_cleanup(finish_test);

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
