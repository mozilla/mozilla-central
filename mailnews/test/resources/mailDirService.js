/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Sets up the directory service provider to create the "mailtest" sub
 * directory under the process directory and use that as the profile
 * directory for the mailnews tests to locate files during unit tests.
 *
 * For xpcshell tests, the "profile" directory will be:
 * <objdir>/dist/bin/mailtest/  (on Windows and Linux)
 * <objdir>/dist/Thunderbird{Debug}.app/Contents/MacOS/mailtest/  (on Mac OS X)
 */

// Make sure we execute this file exactly once
var gMailDirService_js__;
if (!gMailDirService_js__) {
gMailDirService_js__ = true;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Declare these globally for unit tests and be done with it.
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

var gProfileDirProvider = null;

// keep things out of global scope where possible.
function initializeDirServer() {
  const NS_APP_USER_PROFILE_50_DIR = "ProfD";

  // Various functions common to the tests.
  const MailTestDirServer = {
    /*
     * makeDirectoryService
     *
     */
    makeDirectoryService : function () {
      // Register our own provider for the profile directory.
      // It will simply return the current directory.
      const provider = {
        getFile : function(prop, persistent) {
          persistent.value = true;
          if (prop == NS_APP_USER_PROFILE_50_DIR) {
            var processDir = dirSvc.get("CurProcD", Ci.nsIFile);

            // Process dir is normally <objdir>/dist/bin, _tests is
            // <objdir>/_tests, so go up 2 directories
            processDir = processDir.parent;
            processDir = processDir.parent;

            // Then into the _tests directory
            processDir.append("_tests");

            // We need to normalize on a directory we'll always know about it
            // because otherwise Linux doesn't work properly. Therefore do it
            // here before we add mailtest.
            processDir.normalize();

            // Then this is the directory we want
            processDir.append("mailtest");

            return processDir;
          }
          if (prop == "resource:app") {
            // app should return the same as gre...
            return dirSvc.get("GreD", Ci.nsIFile);
          }
          if (prop == "TmpD") {
            throw Components.results.NS_ERROR_FAILURE;
          }

          dump("Directory request for: " + prop + " that we (mailDirService.js)" +
               " are not handling, leaving it to another handler.\n");
          throw Components.results.NS_ERROR_FAILURE;
        },

        QueryInterface:
          XPCOMUtils.generateQI([Ci.nsIDirectoryServiceProvider])
      };
      gProfileDirProvider = provider;
      dirSvc.QueryInterface(Ci.nsIDirectoryService).registerProvider(gProfileDirProvider);
    }
  };

  // If there's no location registered for the profile directory, register one
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties);
  var profileDir;
  try {
    profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, Ci.nsIFile);
  } catch (e) { }

  if (!profileDir) {
    MailTestDirServer.makeDirectoryService();
    profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, Ci.nsIFile);
  }
  return profileDir;
}

// Left as a global to make things like copying files easy.
var gProfileDir = initializeDirServer();

// Ensure we start with a clean profile directory for all tests
try {
  // XXX We have Bug 473385 - nsIFile.remove(true) intermittently fails on Mac
  // So we have to do it manually to keep the tinderboxes stable.
  function recursiveRemove(aDirectory) {
    let entries = aDirectory.directoryEntries;

    while (entries.hasMoreElements()) {
      let entry = entries.getNext();

      if (entry instanceof Ci.nsIFile) {
        if (entry.isDirectory() &&
            !entry.equals(aDirectory)) {
          recursiveRemove(entry);
        }

        entry.remove(false);
      }
    }
  }

  if (gProfileDir.exists()) {
    recursiveRemove(gProfileDir);
    gProfileDir.remove(false);
  }
}
catch (e) {
  print("Couldn't recursive remove directory: " + e);
  print("Trying automatically\n");

  if (gProfileDir.exists())
    gProfileDir.remove(true);

  // This throw is so that we know if this bug happens
  throw Cr.NS_ERROR_FAILURE;
}
// Always ensure the profile directory exists before we start the tests
gProfileDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0700);

} // gMailDirService_js__
