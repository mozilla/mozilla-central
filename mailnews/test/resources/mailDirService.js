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

const nsIFile = Components.interfaces.nsIFile;
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
          var processDir = dirSvc.get("CurProcD", nsIFile);

          processDir.append("mailtest");

          if (!processDir.exists())
            processDir.create(nsIFile.DIRECTORY_TYPE, 0700);

          return processDir;
        } else if (prop == "TmpD") {
          throw Components.results.NS_ERROR_FAILURE;
        } else {
          dump("Wants directory: "+prop+"\n");
        }
        throw Components.results.NS_ERROR_FAILURE;
      },

      QueryInterface :
        XPCOMUtils.generateQI([Components.interfaces.nsIDirectoryServiceProvider])
    };

    dirSvc.QueryInterface(Components.interfaces.nsIDirectoryService)
          .registerProvider(provider);
  }
};

// If there's no location registered for the profile directory, register one
var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties);
try {
    var profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, nsIFile);
} catch (e) { }

if (!profileDir) {
  MailTestDirServer.makeDirectoryService();
  profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, nsIFile);
}
