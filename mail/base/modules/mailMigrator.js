/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This module handles migrating mail-specific preferences, etc. Migration has
 * traditionally been a part of msgMail3PaneWindow.js, but separating the code
 * out into a module makes unit testing much easier.
 */

var EXPORTED_SYMBOLS = ["MailMigrator"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");

var MailMigrator = {
  /**
   * Switch the given fonts to the given encodings, but only if the current fonts
   * are defaults.
   */
  _switchDefaultFonts: function MailMigrator__switchDefaultFonts(aFonts,
                                                                 aEncodings) {
    for each (let [, encoding] in Iterator(aEncodings)) {
      let serifPref = "font.name.serif." + encoding;
      let sansPref = "font.name.sans-serif." + encoding;
      let variableSizePref = "font.size.variable." + encoding;
      // This is expected to be one of sans-serif or serif, and determines what
      // we'll link the variable font size to.
      let isSansDefault = Services.prefs.getCharPref("font.default." + encoding) ==
                            "sans-serif";

      if (!Services.prefs.prefHasUserValue(serifPref)) {
        Services.prefs.setCharPref(serifPref, aFonts.serif);
        if (!isSansDefault)
          Services.prefs.setIntPref(variableSizePref, aFonts.variableSize);
      }

      if (!Services.prefs.prefHasUserValue(sansPref)) {
        Services.prefs.setCharPref(sansPref, aFonts.sans);
        if (isSansDefault)
          Services.prefs.setIntPref(variableSizePref, aFonts.variableSize);
      }

      let monospacePref = "font.name.monospace." + encoding;
      let fixedSizePref = "font.size.fixed." + encoding;
      if (!Services.prefs.prefHasUserValue(monospacePref)) {
        Services.prefs.setCharPref(monospacePref, aFonts.monospace);
        Services.prefs.setIntPref(fixedSizePref, aFonts.fixedSize);
      }
    }
  },

  /**
   * Migrate to ClearType fonts (Cambria, Calibri and Consolas) on Windows Vista
   * and above.
   */
  migrateToClearTypeFonts: function MailMigrator_migrateToClearTypeFonts() {
    // Windows...
    if ("@mozilla.org/windows-registry-key;1" in Components.classes) {
      // Only migrate on Vista (Windows version 6.0) and above
      if (Services.sysinfo.getPropertyAsDouble("version") >= 6.0) {
        let fontPrefVersion =
          Services.prefs.getIntPref("mail.font.windows.version");
        if (fontPrefVersion < 2) {
          let fonts = {
            serif: "Cambria",
            sans: "Calibri",
            monospace: "Consolas",
            variableSize: 17,
            fixedSize: 14,
          };
          // Encodings to switch to the new fonts.
          let encodings = [];
          // (Thunderbird 3.1)
          if (fontPrefVersion < 1)
            encodings.push("x-unicode", "x-western");
          // (Thunderbird 3.2)
          encodings.push("x-central-euro", "x-cyrillic", "x-baltic", "el", "tr");

          this._switchDefaultFonts(fonts, encodings);

          Services.prefs.setIntPref("mail.font.windows.version", 2);
        }
      }
    }
  },

  /**
   * Determine if the UI has been upgraded in a way that requires us to reset
   * some user configuration.  If so, performs the resets.
   */
  _migrateUI: function MailMigrator__migrateUI() {
    // The code for this was ported from
    // mozilla/browser/components/nsBrowserGlue.js
    const UI_VERSION = 5;
    const MESSENGER_DOCURL = "chrome://messenger/content/messenger.xul#";
    const UI_VERSION_PREF = "mail.ui-rdf.version";
    let currentUIVersion = 0;

    try {
      currentUIVersion = Services.prefs.getIntPref(UI_VERSION_PREF);
    } catch(ex) {}

    if (currentUIVersion >= UI_VERSION)
      return;

    this._rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
    this._dataSource = this._rdf.GetDataSource("rdf:local-store");
    let dirty = false;

    try {
      // Initially, we checked if currentUIVersion < 1, and stripped the
      // persisted "collapsed" property from folderPaneBox if it wasn't.
      // However, the inital implementation of migrateUI swallowed up
      // exceptions, and bumped the value of UI_VERSION_PREF regardless.
      // Now, instead, we fail to bump the UI_VERSION_PREF if something goes
      // wrong, and we've moved the folderPaneBox operation into
      // currentUIVersion < 2 just in case the operation failed for some of
      // our users the first time.
      if (currentUIVersion < 2) {
        // We want to remove old settings that collapse the folderPaneBox
        let fpbResource = this._rdf.GetResource(MESSENGER_DOCURL
                                                + "folderPaneBox");
        let collapsedResource = this._rdf.GetResource("collapsed");
        let collapsed = this._getPersist(fpbResource, collapsedResource);

        if (collapsed !== null) {
          // We want to override this, and set it to false.  We should really
          // be ignoring this persist attribute, anyhow.
          dirty = true;
          this._unAssert(fpbResource, collapsedResource);
        }

        // We want to remove the throbber from the menubar on Linux and
        // Windows, and from the mail-toolbar on OSX.
        let currentSetResource = this._rdf.GetResource("currentset");
        let barResource = null;

        if (Services.appinfo.OS == "Darwin")
          barResource = this._rdf.GetResource(MESSENGER_DOCURL + "mail-bar3");
        else
          barResource = this._rdf.GetResource(MESSENGER_DOCURL +
                                              "mail-toolbar-menubar2");

        if (barResource !== null) {
          let currentSet = this._getPersist(barResource, currentSetResource);
          if (currentSet &&
              currentSet.indexOf("throbber-box") != -1) {
            dirty = true;
            currentSet = currentSet.replace(/(^|,)throbber-box($|,)/, "$1$2");
            this._setPersist(barResource, currentSetResource, currentSet);
          }
        }
      }

      // In UI version 3, we move the QFB button from the tabbar toolbar to
      // to the mail toolbar.
      if (currentUIVersion < 3) {
        let currentSetResource = this._rdf.GetResource("currentset");
        let tbtResource = this._rdf.GetResource(MESSENGER_DOCURL
                                                + "tabbar-toolbar");
        if (tbtResource !== null) {
          let currentSet = this._getPersist(tbtResource, currentSetResource);
          if (currentSet
              && currentSet.indexOf("qfb-show-filter-bar") != -1) {
            dirty = true;
            currentSet = currentSet.replace(/(^|,)qfb-show-filter-bar($|,)/,
                                            "$1$2");
            this._setPersist(tbtResource, currentSetResource, currentSet);
          }
        }

        let barResource = this._rdf.GetResource(MESSENGER_DOCURL + "mail-bar3");
        if (barResource !== null) {
          let currentSet = this._getPersist(barResource, currentSetResource);

          if (currentSet
              && currentSet.indexOf("qfb-show-filter-bar") == -1) {

            dirty = true;
            if (currentSet.indexOf("gloda-search") != -1) {
              // Put the QFB toggle before the gloda-search and any of
              // spring / spacer / separator.
              currentSet = currentSet.replace(/(^|,)([spring,|spacer,|separator,]*)gloda-search($|,)/,
                                              "$1qfb-show-filter-bar,$2gloda-search$3");
            } else {
              // If there's no gloda-search, just put the QFB toggle at the end
              currentSet = currentSet + ",qfb-show-filter-bar";
            }
            this._setPersist(barResource, currentSetResource, currentSet);
          }
        }
      }

      // In UI version 4, we add the chat button to the mail toolbar.
      if (currentUIVersion < 4) {
        let currentSetResource = this._rdf.GetResource("currentset");
        let barResource = this._rdf.GetResource(MESSENGER_DOCURL + "mail-bar3");
        if (barResource !== null) {
          let currentSet = this._getPersist(barResource, currentSetResource);

          if (currentSet
              && currentSet.indexOf("button-chat") == -1) {

            dirty = true;
            if (currentSet.indexOf("button-newmsg") != -1) {
              // Put the chat button after the newmsg button.
              currentSet = currentSet.replace(/(^|,)button-newmsg($|,)/,
                                              "$1button-newmsg,button-chat$2");
            } else if (currentSet.indexOf("button-address") != -1) {
              // If there's no newmsg button, put the chat button before the address book button.
              currentSet = currentSet.replace(/(^|,)button-address($|,)/,
                                              "$1button-chat,button-address$2");
            } else {
              // Otherwise, just put the chat button at the end.
              currentSet = currentSet + ",button-chat";
            }
            this._setPersist(barResource, currentSetResource, currentSet);
          }
        }
      }

      // In UI version 5, we add the AppMenu button to the mail toolbar and
      // collapse the main menu by default if the user has no accounts
      // set up (and the override pref "mail.main_menu.collapse_by_default"
      // is set to true). Checking for 0 accounts is a hack, because we can't
      // think of any better way of determining whether this profile is new
      // or not.
      if (currentUIVersion < 5) {
        /**
         * Helper function that attempts to add the AppMenu button to the
         * end of a toolbar with ID aToolbarID. Fails silently if this is
         * not possible, as is typical within our UI migration code.
         *
         * @param aToolbarID the ID of the toolbar to add the AppMenu to.
         */
        let addButtonToEnd = function(aToolbarID, aButtonID) {
          let barResource = this._rdf.GetResource(MESSENGER_DOCURL +
                                                  aToolbarID);
          if (barResource) {
            let currentSetResource = this._rdf.GetResource("currentset");
            let currentSet = this._getPersist(barResource, currentSetResource);

            if (currentSet && currentSet.indexOf(aButtonID) == -1) {
              // Put the AppMenu button at the end.
              dirty = true;
              currentSet = currentSet + "," + aButtonID;
              this._setPersist(barResource, currentSetResource, currentSet);
            }
          }
        }.bind(this);

        addButtonToEnd("mail-bar3", "button-appmenu");
        addButtonToEnd("chat-toobar", "button-chat-appmenu");

        if (Services.prefs.getBoolPref("mail.main_menu.collapse_by_default")
            && MailServices.accounts.accounts.length == 0) {
          let menuResource = this._rdf.GetResource(MESSENGER_DOCURL +
                                                   "mail-toolbar-menubar2");
          if (menuResource !== null) {
            let autohideResource = this._rdf.GetResource("autohide");
            dirty = true;
            this._setPersist(menuResource, autohideResource, "true");
          }
        }
      }

      // Update the migration version.
      Services.prefs.setIntPref(UI_VERSION_PREF, UI_VERSION);

    } catch(e) {
      Cu.reportError("Migrating from UI version " + currentUIVersion + " to "
                     + UI_VERSION + " failed. Error message was: " + e + " -- "
                     + "Will reattempt on next start.");
    } finally {
      if (dirty)
        this._dataSource.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();
      delete this._rdf;
      delete this._dataSource;
    }
  },

  /**
   * Perform any migration work that needs to occur after the Account Wizard
   * has had a chance to appear.
   */
  migratePostAccountWizard: function MailMigrator_migratePostAccountWizard() {
    this.migrateToClearTypeFonts();
  },

  /**
   * Perform any migration work that needs to occur once the user profile has
   * been loaded.
   */
  migrateAtProfileStartup: function MailMigrator_migrateAtProfileStartup() {
    this._migrateUI();
  },

  /**
   * A helper function to get the property for a resource in the
   * localstore.rdf file.  This function should only be called by _migrateUI.
   *
   * @param aSource the resource to get the property from
   * @param aProperty the property to get the value from
   */
  _getPersist: function MailMigrator__getPersist(aSource, aProperty) {
    // The code for this was ported from
    // mozilla/browser/components/nsBrowserGlue.js.

    let target = this._dataSource.GetTarget(aSource, aProperty, true);
    if (target instanceof Ci.nsIRDFLiteral)
      return target.Value;
    return null;
  },

  /**
   * A helper function to set the property for a resource in the localstore.rdf.
   * This function also automatically adds the property to the list of properties
   * being persisted for the aSource.
   *
   * @param aSource the resource that we want to set persistence on
   * @param aProperty the property that we're going to set the value of
   * @param aTarget the value that we're going to set the property to
   */
  _setPersist: function MailMigrator__setPersist(aSource, aProperty, aTarget) {
    try {
      let oldTarget = this._dataSource.GetTarget(aSource, aProperty, true);
      if (oldTarget) {
        if (aTarget)
          this._dataSource.Change(aSource, aProperty, oldTarget, this._rdf.GetLiteral(aTarget));
        else
          this._dataSource.Unassert(aSource, aProperty, oldTarget);
      }
      else {
        this._dataSource.Assert(aSource, aProperty, this._rdf.GetLiteral(aTarget), true);
      }

      // Add the entry to the persisted set for this document if it's not there.
      // This code is mostly borrowed from nsXULDocument::Persist.
      let docURL = aSource.ValueUTF8.split("#")[0];
      let docResource = this._rdf.GetResource(docURL);
      let persistResource = this._rdf.GetResource("http://home.netscape.com/NC-rdf#persist");
      if (!this._dataSource.HasAssertion(docResource, persistResource, aSource, true)) {
        this._dataSource.Assert(docResource, persistResource, aSource, true);
      }
    }
    catch(e) {
      // Something's gone horribly wrong - report it in the Error Console
      Cu.reportError(e);
      throw(e);
    }
  },

  /**
   * A helper function to unassert a property from a resource.  This function
   * should only be called by _migrateUI.
   *
   * @param aSource the resource to remove the property from
   * @param aProperty the property to be removed
   */
  _unAssert: function MailMigrator__unAssert(aSource, aProperty) {
    try {
      let oldTarget = this._dataSource.GetTarget(aSource, aProperty, true);
      if (oldTarget)
        this._dataSource.Unassert(aSource, aProperty, oldTarget);
    }
    catch(e) {
      // If something's gone wrong here, report it in the Error Console.
      Cu.reportError(e);
      throw(e);
    }
  },
};
