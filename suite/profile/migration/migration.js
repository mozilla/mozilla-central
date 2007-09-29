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
 * The Original Code is The Browser Profile Migrator.
 *
 * The Initial Developer of the Original Code is
 * Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.demon.co.uk>
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

const nsISuiteProfileMigrator = Components.interfaces.nsISuiteProfileMigrator;
const nsIProfileStartup       = Components.interfaces.nsIProfileStartup;
const nsISupportsString       = Components.interfaces.nsISupportsString;
const NS_PROFILE_MIGRATOR_CONTRACTID = "@mozilla.org/profile/migrator;1?app=suite&type=";

var MigrationWizard = {
  _source: "",                  // Source Profile Migrator ContractID suffix
  _itemsFlags: nsISuiteProfileMigrator.ALL, // Selected Import Data Sources
  _selectedProfile: null,       // Selected Profile name to import from
  _wiz: null,                   // Shortcut to the wizard
  _migrator: null,              // The actual profile migrator.
  _autoMigrate: null,           // Whether or not we are actually migrating.
  _singleItem: false,           // Are we choosing just to import a single
                                // item into the current profile?
  _newHomePage: null,           // Are we setting a new home page - what to?

  init: function() {
    var os = Components.classes["@mozilla.org/observer-service;1"]
                       .getService(Components.interfaces.nsIObserverService);
    os.addObserver(this, "Migration:Started", false);
    os.addObserver(this, "Migration:ItemBeforeMigrate", false);
    os.addObserver(this, "Migration:ItemAfterMigrate", false);
    os.addObserver(this, "Migration:Ended", false);
    os.addObserver(this, "Migration:Progress", false);

    this._wiz = document.documentElement;
    this._wiz.canRewind = false;

    if ("arguments" in window) {
      if ("arguments" in window && window.arguments[0] == "bookmarks") {
        this._singleItem = true;
        this._itemsFlags = nsISuiteProfileMigrator.BOOKMARKS;
        document.getElementById("fromFile").hidden = false;
        document.getElementById("importBookmarks").hidden = false;
        document.getElementById("importAll").hidden = true;
      }
      else if (window.arguments.length > 1) {
        this._source = window.arguments[0];
        this._migrator = window.arguments[1]
                               .QueryInterface(nsISuiteProfileMigrator);
        this._autoMigrate = window.arguments[2]
                                  .QueryInterface(nsIProfileStartup);
        // Show the "nothing" option in the automigrate case to provide an
        // easily identifiable way to avoid migration and create a new profile.
        document.getElementById("nothing").hidden = false;
      }
    }

    this.onImportSourcePageShow();
  },

  uninit: function() {
    var os = Components.classes["@mozilla.org/observer-service;1"]
                       .getService(Components.interfaces.nsIObserverService);
    os.removeObserver(this, "Migration:Started");
    os.removeObserver(this, "Migration:ItemBeforeMigrate");
    os.removeObserver(this, "Migration:ItemAfterMigrate");
    os.removeObserver(this, "Migration:Ended");
    os.removeObserver(this, "Migration:Progress", false);
  },

  // 1 - Import Source
  onImportSourcePageShow: function() {
    // Figure out what source apps are are available to import from:
    var group = document.getElementById("importSourceGroup");
    var firstSelectable = null;
    for (var i = 0; i < group.childNodes.length; ++i) {
      var suffix = group.childNodes[i].id;
      if (suffix != "nothing" && suffix != "fromFile") {
        var contractID = NS_PROFILE_MIGRATOR_CONTRACTID + suffix;
        var migrator = null;
        if (contractID in Components.classes) {
          migrator = Components.classes[contractID]
                               .createInstance(nsISuiteProfileMigrator);
        } else {
          dump("*** invalid contractID =" + contractID + "\n");
          // This is an invalid contract id, therefore hide this element
          // and allow things to continue - that way we should be able to
          // copy with anything happening.
          group.childNodes[i].hidden = true;
          break;
        }

        // Ensure that we only allow import selections for profile
        // migrators that support the requested action.
        if (!migrator.sourceExists ||
            !(migrator.supportedItems & this._itemsFlags)) {
          group.childNodes[i].hidden = true;
          break;
        }

        if (!firstSelectable && !group.childNodes[i].disabled &&
            !group.childNodes[i].hidden) {
          firstSelectable = group.childNodes[i];
        }
      }
    }

    if (this._source) {
      // Somehow the Profile Migrator got confused, and gave us a migrate source
      // that doesn't actually exist. This could be because of a bogus registry
      // state. Set the _source property to null so the first visible item in
      // the list is selected instead.
      if (document.getElementById(this._source).hidden)
        this._source = null;
    }
    group.selectedItem = this._source ?
      document.getElementById(this._source) : firstSelectable;
  },

  onImportSourcePageAdvanced: function() {
    var newSource = document.getElementById("importSourceGroup").value;

    if (newSource == "nothing" || newSource == "fromFile") {
      if (newSource == "fromFile") {
        window.opener.fromFile = true;
      }
      document.documentElement.cancel();
      // Don't let the wizard migrate to the next page event though we've
      // called cancel - cancel may not get processed first.
      return false;
    }

    if (!this._migrator || newSource != this._source) {
      // Create the migrator for the selected source.
      var contractID = NS_PROFILE_MIGRATOR_CONTRACTID + newSource;
      this._migrator = Components.classes[contractID]
                                 .createInstance(nsISuiteProfileMigrator);

      this._selectedProfile = null;
    }
    this._source = newSource;

    // check for more than one source profile
    if (this._migrator.sourceHasMultipleProfiles)
      this._wiz.currentPage.next = "selectProfile";
    else {
      if (this._autoMigrate)
        this._wiz.currentPage.next = "homePageImport";
      else if (this._singleItem)
        this._wiz.currentPage.next = "migrating";
      else
        this._wiz.currentPage.next = "importItems";

      var sourceProfiles = this._migrator.sourceProfiles;
      if (sourceProfiles && sourceProfiles.length == 1) {
        this._selectedProfile = sourceProfiles
            .queryElementAt(0, nsISupportsString).data;
      }
      else
        this._selectedProfile = "";
    }
    return true;
  },

  // 2 - [Profile Selection]
  onSelectProfilePageShow: function() {
    var profiles = document.getElementById("profiles");
    while (profiles.hasChildNodes())
      profiles.removeChild(profiles.lastChild);

    var sourceProfiles = this._migrator.sourceProfiles;
    var count = sourceProfiles.length;
    for (var i = 0; i < count; ++i) {
      var item = document.createElement("radio");
      item.id = sourceProfiles.queryElementAt(i, nsISupportsString).data;
      item.setAttribute("label", item.id);
      profiles.appendChild(item);
    }

    profiles.selectedItem = this._selectedProfile ?
      document.getElementById(this._selectedProfile) : profiles.firstChild;
  },

  onSelectProfilePageAdvanced: function() {
    this._selectedProfile = document.getElementById("profiles").selectedItem.id;

    // If we're automigrating or just doing bookmarks don't show the item
    // selection page
    if (this._autoMigrate)
      this._wiz.currentPage.next = "homePageImport";
    else if (this._singleItem)
      this._wiz.currentPage.next = "migrating"
  },

  // 3 - ImportItems
  onImportItemsPageShow: function() {
    var dataSources = document.getElementById("dataSources");
    while (dataSources.hasChildNodes())
      dataSources.removeChild(dataSources.lastChild);

    var bundle = document.getElementById("bundle");

    var items = this._migrator.getMigrateData(this._selectedProfile,
                                              this._autoMigrate);

    for (var i = 0; i < 16; ++i) {
      var itemID = items & (1 << i);
      if (itemID) {
        var checkbox = document.createElement("checkbox");
        checkbox.id = itemID;
        try {
          checkbox.setAttribute("label",
                                bundle.getString(itemID + "_" + this._source));
        }
        catch (ex) {
          checkbox.setAttribute("label",
                                bundle.getString(itemID + "_generic"));
        }
        dataSources.appendChild(checkbox);
        if (this._itemsFlags & itemID)
          checkbox.setAttribute("checked", true);
      }
    }
  },

  onImportItemsPageRewound: function() {
    this._wiz.canAdvance = true;
    this.onImportItemsPageAdvanced();
  },

  onImportItemsPageAdvanced: function() {
    var dataSources = document.getElementById("dataSources");
    this._itemsFlags = 0;
    for (var i = 0; i < dataSources.childNodes.length; ++i) {
      var checkbox = dataSources.childNodes[i];
      if (checkbox.checked)
        this._itemsFlags |= checkbox.id;
    }
  },

  onImportItemCommand: function(aEvent) {
    this._wiz.canAdvance = document
      .getElementById("dataSources")
      .getElementsByAttribute("checked", "true").item(0) != null;
  },

  // 4 - Home Page Selection
  onHomePageMigrationPageShow: function() {
    // only want this on the first run
    if (!this._autoMigrate) {
      this._wiz.advance();
      return;
    }

    var bundle = document.getElementById("bundle");
    var pageTitle = bundle.getString("homePageMigrationPageTitle");
    var pageDesc = bundle.getString("homePageMigrationDescription");

    document.getElementById("homePageImport").setAttribute("label", pageTitle);
    document.getElementById("homePageImportDesc")
            .setAttribute("value", pageDesc);

    this._wiz._adjustWizardHeader();

    var homePageStart = document.getElementById("homePageStart");

    // Find out if the target profile already has a homepage or not
    var mainStr = this.targetHasHomePageURL() ? 
                  bundle.getString("homePageStartCurrent") :
                  bundle.getString("homePageStartDefault");

    homePageStart.setAttribute("label", mainStr);

    var source = null;
    if (this._source != "") {
      source = "sourceName" + this._source;
    }

    var availableItems = this._migrator.getMigrateData(this._selectedProfile,
                                                       this._autoMigrate);

    if (source && (availableItems & nsISuiteProfileMigrator.HOMEPAGEDATA)) {
      var appName = document.getElementById("bundle").getString(source);
      var oldHomePageLabel = bundle.getFormattedString("homePageImport",
                                                       [appName]);
      var oldHomePage = document.getElementById("oldHomePage");
      oldHomePage.setAttribute("label", oldHomePageLabel);
      oldHomePage.setAttribute("value", "source");
      oldHomePage.removeAttribute("hidden");
      oldHomePage.focus();

      document.getElementById("homePageRadioGroup").selectedItem = oldHomePage;
    }
    else {
      // if we don't have at least two options, just advance
      this._wiz.advance();
    }
  },

  onHomePageMigrationPageAdvanced: function() {
    // we might not have a selectedItem if we're in fallback mode
    try {
      this._newHomePage = document.getElementById("homePageRadioGroup")
                                  .value;
    } catch(ex) {}
  },

  // 5 - Migrating
  onMigratingPageShow: function() {
    this._wiz.getButton("cancel").disabled = true;
    this._wiz.canRewind = false;
    this._wiz.canAdvance = false;

    // When migrating a profile on startup, show all of the data that can be
    // received from this source, but exclude home pages if the user didn't
    // want to migrate it.
    if (this._autoMigrate) {
      this._itemsFlags = this._migrator.getMigrateData(this._selectedProfile,
                                                       this._autoMigrate);
      if (!this._newHomePage)
        this._itemsFlags &= ~nsISuiteProfileMigrator.HOMEPAGEDATA;
    }

    this._listItems("migratingItems");
    setTimeout(this.onMigratingMigrate, 0, this);
  },

  onMigratingMigrate: function(aOuter) {
    aOuter._migrator.migrate(aOuter._itemsFlags,
                             aOuter._autoMigrate,
                             aOuter._selectedProfile);
  },

  _listItems: function(aID) {
    var items = document.getElementById(aID);
    while (items.hasChildNodes())
      items.removeChild(items.lastChild);

    var bundle = document.getElementById("bundle");
    var itemID;
    for (var x = 1; x < nsISuiteProfileMigrator.ALL;
         x = x << 1) {
      if (x & this._itemsFlags) {
        var label = document.createElement("label");
        label.id = x + "_migrated";
        try {
          label.setAttribute("value",
                             bundle.stringBundle
                                   .GetStringFromName(x + "_"+ this._source));
          label.setAttribute("class", "migration-pending");
          items.appendChild(label);
        }
        catch (ex) {
          try {
            label.setAttribute("value", bundle.getString(x + "_generic"));
            label.setAttribute("class", "migration-pending");
            items.appendChild(label);
          }
          catch (e) {
            // if the block above throws, we've enumerated all the import
            // data types we currently support and are now just wasting time.
            break;
          }
        }
      }
    }
  },

  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
    case "Migration:Progress":
      document.getElementById("progressBar").value = aData;
      break;
    case "Migration:Started":
      break;
    case "Migration:ItemBeforeMigrate":
      var label = document.getElementById(aData + "_migrated");
      if (label)
        label.setAttribute("class", "migration-in-progress");
      break;
    case "Migration:ItemAfterMigrate":
      var label = document.getElementById(aData + "_migrated");
      if (label)
        label.setAttribute("class", "migration-finished");
      break;
    case "Migration:Ended":
      // We're done now.
      this._wiz.canAdvance = true;
      this._wiz.advance();

      if (this._autoMigrate)
        setTimeout(function() {window.close();}, 5000);

      break;
    }
  },

  onDonePageShow: function() {
    this._wiz.getButton("cancel").disabled = true;
    this._wiz.canRewind = false;
    this._listItems("doneItems");
  },

  targetHasHomePageURL: function() {
    var targetPrefsFile = this._autoMigrate.directory;

    targetPrefsFile.append("prefs.js");

    // If the target prefs file doesn't exist, then we can't have a
    // homepage set in the target profile.
    if (!targetPrefsFile.exists())
      return false;

    var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefService);
    prefSvc.resetPrefs();

    prefSvc.readUserPrefs(targetPrefsFile);

    var prefBranch = prefSvc.getBranch(null);

    return prefBranch.prefHasUserValue("browser.startup.homepage");
  }
};
