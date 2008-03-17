/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgMailSession functions relating to listeners.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const nsIFile = Components.interfaces.nsIFile;
const NS_APP_USER_PROFILE_50_DIR = "ProfD";

// Various functions common to the tests.
const DirServiceTest = {

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


// If there's no location registered for the profile direcotry, register one
var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties);
try {
    var profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, nsIFile);
} catch (e) { }

if (!profileDir) {
  DirServiceTest.makeDirectoryService();
  profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, nsIFile);
}

function run_test() {
  const items = [ { key: "MailD", value: "Mail" },
                  { key: "IMapMD", value: "ImapMail" },
                  { key: "NewsD", value: "News" },
                  { key: "MFCaF", value: "panacea.dat" } ];

  items.forEach(function(item) {
    var dir = dirSvc.get(item.key, nsIFile);
    dump(profileDir.path + " " + dir.path + "\n");
    do_check_true(profileDir.equals(dir.parent));

    do_check_eq(dir.leafName, item.value);
  });
};
