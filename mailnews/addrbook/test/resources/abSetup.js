/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Sets up the directory service provider to return the app dir as the profile
 * directory for the address book to use for locating its files during the
 * tests.
 *
 * Note there are further configuration setup items below this.
 */

const NS_APP_USER_PROFILE_50_DIR = "ProfD";
const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

// Various functions common to the tests.
const AbTest = {

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

          processDir.append("addrbook");

          if (!processDir.exists())
            processDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0700);

          return processDir;
        }
        throw Cr.NS_ERROR_FAILURE;
      },

      QueryInterface : function(iid) {
        if (iid.equals(Ci.nsIDirectoryServiceProvider) ||
            iid.equals(Ci.nsISupports)) {
          return this;
        }
        throw Cr.NS_ERROR_NO_INTERFACE;
      }
    };

    dirSvc.QueryInterface(Ci.nsIDirectoryService).registerProvider(provider);
  }
};


// If there's no location registered for the profile direcotry, register one
var dirSvc = Cc["@mozilla.org/file/directory_service;1"].
             getService(Ci.nsIProperties);
try {
    var profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, Ci.nsIFile);
} catch (e) { }

if (!profileDir) {
  AbTest.makeDirectoryService();
  profileDir = dirSvc.get(NS_APP_USER_PROFILE_50_DIR, Ci.nsIFile);
}

/**
 * General Configuration Data that applies to the address book.
 */

// Personal Address Book configuration items.
var kPABData =
{
  URI: "moz-abmdbdirectory://abook.mab",
  fileName: "abook.mab",
  dirName: "Personal Address Book",
  dirType: 2,
  dirPrefID: "ldap_2.servers.pab",
  position: 1
};

// Collected Address Book configuration items.
var kCABData =
{
  URI: "moz-abmdbdirectory://history.mab",
  fileName: "history.mab",
  dirName: "Collected Addresses",
  dirType: 2,
  dirPrefID: "ldap_2.servers.history",
  position: 2
};

// This currently applies to all address books of local type.
const kNormalPropertiesURI =
  "chrome://messenger/content/addressbook/abAddressBookNameDialog.xul";
