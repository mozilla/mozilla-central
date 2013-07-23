/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Sets up the directory service provider to create the "mailtest" sub
 * directory under the process directory and use that as the profile
 * directory for the mailnews tests to locate files during unit tests.
 *
 * For xpcshell tests, the "profile" directory will be <profile_dir>/mailtest/
 */

const EXPORTED_SYMBOLS = ["ProfileDir"];

// Services
Components.utils.import("resource://gre/modules/Services.jsm");
// MailServices
Components.utils.import("resource:///modules/mailServices.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Declare these globally for unit tests and be done with it.
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

let ProfileDir = {
  // keep things out of global scope where possible.
  initialize: function initializeDirServer(aProfileDir) {
    const NS_APP_USER_PROFILE_50_DIR = "ProfD";

    // Various functions common to the tests.
    const MailTestDirServer = {
      /*
       * makeDirectoryService
       */
      makeDirectoryService : function () {
        // Register our own provider for the profile directory.
        // It will simply return the current directory.
        const provider = {
           getFile : function(prop, persistent) {
           persistent.value = true;
           if (prop == NS_APP_USER_PROFILE_50_DIR) {
              // Then this is the directory we want
              aProfileDir.append("mailtest");

              return aProfileDir;
            }
            if (prop == "resource:app") {
              // app should return the same as gre...
              return Services.dirsvc.get("GreD", Ci.nsIFile);
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
        Services.dirsvc.QueryInterface(Ci.nsIDirectoryService)
                       .registerProvider(gProfileDirProvider);
      }
    };

    // If there's no location registered for the profile directory, register one
    var dir;
    try {
      dir = Services.dirsvc.get(NS_APP_USER_PROFILE_50_DIR, Ci.nsIFile);
    } catch (e) { }

    if (!dir) {
      MailTestDirServer.makeDirectoryService();
      dir = Services.dirsvc.get(NS_APP_USER_PROFILE_50_DIR, Ci.nsIFile);
    }

    // Ensure we start with a clean profile directory for all tests
    try {
      if (dir.exists()) {
        this._recursiveRemove(dir);
        dir.remove(false);
      }
    }
    catch (e) {
      dump("Couldn't recursive remove directory: " + e);
      dump("Trying automatically\n");

      if (dir.exists())
        dir.remove(true);

      // This throw is so that we know if this bug happens
      throw Cr.NS_ERROR_FAILURE;
    }

    // Always ensure the profile directory exists before we start the tests
    dir.create(Ci.nsIFile.DIRECTORY_TYPE, parseInt("0700", 8));

    return dir;
  },

  // XXX We have Bug 473385 - nsIFile.remove(true) intermittently fails on Mac
  // So we have to do it manually to keep the tinderboxes stable.
  _recursiveRemove: function(aDirectory) {
    let entries = aDirectory.directoryEntries;

    while (entries.hasMoreElements()) {
      let entry = entries.getNext();

      if (entry instanceof Ci.nsIFile) {
        if (entry.isDirectory() &&
            !entry.equals(aDirectory)) {
          this._recursiveRemove(entry);
        }

        entry.remove(false);
      }
    }
  }
};

