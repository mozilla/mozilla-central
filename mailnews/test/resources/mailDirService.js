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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Declare these globally for unit tests and be done with it.
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

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
          } else if (prop == "TmpD") {
            throw Components.results.NS_ERROR_FAILURE;
          } else {
            dump("Wants directory: "+prop+"\n");
          }
          throw Components.results.NS_ERROR_FAILURE;
        },

        QueryInterface:
          XPCOMUtils.generateQI([Ci.nsIDirectoryServiceProvider])
      };

      dirSvc.QueryInterface(Ci.nsIDirectoryService).registerProvider(provider);
    }
  };

  // If there's no location registered for the profile directory, register one
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties);
  try {
    var profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, Ci.nsIFile);
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
if (gProfileDir.exists())
  gProfileDir.remove(true);

// Always ensure the profile directory exists before we start the tests
gProfileDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0700);
