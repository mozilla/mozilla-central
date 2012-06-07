/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kIMig = Components.interfaces.nsIMailProfileMigrator;
const kIPStartup = Components.interfaces.nsIProfileStartup;
const kProfileMigratorContractIDPrefix = "@mozilla.org/profile/migrator;1?app=mail&type=";
const nsISupportsString = Components.interfaces.nsISupportsString;

var MigrationWizard = {
  _source: "",                  // Source Profile Migrator ContractID suffix
  _itemsFlags: kIMig.ALL,       // Selected Import Data Sources (16-bit bitfield)
  _selectedProfile: null,       // Selected Profile name to import from
  _wiz: null,
  _migrator: null,
  _autoMigrate: null,

  init: function ()
  {
    var os = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    os.addObserver(this, "Migration:Started", false);
    os.addObserver(this, "Migration:ItemBeforeMigrate", false);
    os.addObserver(this, "Migration:ItemAfterMigrate", false);
    os.addObserver(this, "Migration:Ended", false);
    os.addObserver(this, "Migration:Progress", false);

    this._wiz = document.documentElement;

    if ("arguments" in window) {
      this._source = window.arguments[0];
      this._migrator = window.arguments[1] ? window.arguments[1].QueryInterface(kIMig) : null;
      this._autoMigrate = window.arguments[2].QueryInterface(kIPStartup);

      // Show the "nothing" option in the automigrate case to provide an
      // easily identifiable way to avoid migration and create a new profile.
      var nothing = document.getElementById("nothing");
      nothing.hidden = false;
    }

    this.onImportSourcePageShow();

    // Behavior alert! If we were given a migrator already, then we are going to perform migration
    // with that migrator, skip the wizard screen where we show all of the migration sources and
    // jump right into migration.
    if (this._migrator)
    {
      if (this._migrator.sourceHasMultipleProfiles)
        this._wiz.goTo("selectProfile");
      else
      {
        var sourceProfiles = this._migrator.sourceProfiles;
        this._selectedProfile = sourceProfiles
          .queryElementAt(0, nsISupportsString).data;
        this._wiz.goTo("migrating");
      }
    }
  },

  uninit: function ()
  {
    var os = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    os.removeObserver(this, "Migration:Started");
    os.removeObserver(this, "Migration:ItemBeforeMigrate");
    os.removeObserver(this, "Migration:ItemAfterMigrate");
    os.removeObserver(this, "Migration:Ended");
    os.removeObserver(this, "Migration:Progress");
  },

  // 1 - Import Source
  onImportSourcePageShow: function ()
  {
    this._wiz.canRewind = false;

    // Figure out what source apps are are available to import from:
    var group = document.getElementById("importSourceGroup");
    for (var i = 0; i < group.childNodes.length; ++i) {
      var suffix = group.childNodes[i].id;
      if (suffix != "nothing") {
        var contractID = kProfileMigratorContractIDPrefix + suffix;
        var migrator = Components.classes[contractID].createInstance(kIMig);
        if (!migrator.sourceExists) {
          group.childNodes[i].hidden = true;
          if (this._source == suffix) this._source = null;
        }
      }
    }

    var firstNonDisabled = null;
    for (var i = 0; i < group.childNodes.length; ++i) {
    if (!group.childNodes[i].hidden) {
        firstNonDisabled = group.childNodes[i];
        break;
      }
    }
    group.selectedItem = this._source == "" ? firstNonDisabled : document.getElementById(this._source);
  },

  onImportSourcePageAdvanced: function ()
  {
    var newSource = document.getElementById("importSourceGroup").selectedItem.id;

    if (newSource == "nothing") {
      document.documentElement.cancel();
      return;
    }

    if (!this._migrator || (newSource != this._source)) {
      // Create the migrator for the selected source.
      var contractID = kProfileMigratorContractIDPrefix + newSource;
      this._migrator = Components.classes[contractID].createInstance(kIMig);

      this._itemsFlags = kIMig.ALL;
      this._selectedProfile = null;
    }

      this._source = newSource;

    // check for more than one source profile
    if (this._migrator.sourceHasMultipleProfiles)
      this._wiz.currentPage.next = "selectProfile";
    else {
      this._wiz.currentPage.next = "migrating";
      var sourceProfiles = this._migrator.sourceProfiles;
      if (sourceProfiles && sourceProfiles.length == 1)
        this._selectedProfile =
          sourceProfiles.queryElementAt(0, nsISupportsString).data;
      else
        this._selectedProfile = "";
    }
  },

  // 2 - [Profile Selection]
  onSelectProfilePageShow: function ()
  {
    // Disabling this for now, since we ask about import sources in automigration
    // too and don't want to disable the back button
    // if (this._autoMigrate)
    //   document.documentElement.getButton("back").disabled = true;

    var profiles = document.getElementById("profiles");
    while (profiles.hasChildNodes())
      profiles.removeChild(profiles.firstChild);

    var sourceProfiles = this._migrator.sourceProfiles;
    var count = sourceProfiles.length;
    for (var i = 0; i < count; ++i) {
      var item = document.createElement("radio");
      item.id = sourceProfiles.queryElementAt(i, nsISupportsString).data;
      item.setAttribute("label", item.id);
      profiles.appendChild(item);
    }

    profiles.selectedItem = this._selectedProfile ? document.getElementById(this._selectedProfile) : profiles.firstChild;
  },

  onSelectProfilePageRewound: function ()
  {
    var profiles = document.getElementById("profiles");
    this._selectedProfile = profiles.selectedItem.id;
  },

  onSelectProfilePageAdvanced: function ()
  {
    var profiles = document.getElementById("profiles");
    this._selectedProfile = profiles.selectedItem.id;

    // If we're automigrating, don't show the item selection page, just grab everything.
    if (this._autoMigrate)
      this._wiz.currentPage.next = "migrating";
  },

  // 3 - ImportItems
  onImportItemsPageShow: function ()
  {
    var dataSources = document.getElementById("dataSources");
    while (dataSources.hasChildNodes())
      dataSources.removeChild(dataSources.firstChild);

    var bundle = document.getElementById("bundle");

    var items = this._migrator.getMigrateData(this._selectedProfile, this._autoMigrate);
    for (var i = 0; i < 16; ++i) {
      var itemID = (items >> i) & 0x1 ? Math.pow(2, i) : 0;
      if (itemID > 0) {
        var checkbox = document.createElement("checkbox");
        checkbox.id = itemID;
        checkbox.setAttribute("label", bundle.getString(itemID + "_" + this._source));
        dataSources.appendChild(checkbox);
        if (!this._itemsFlags || this._itemsFlags & itemID)
          checkbox.checked = true;
      }
    }
  },

  onImportItemsPageAdvanced: function ()
  {
    var dataSources = document.getElementById("dataSources");
    this._itemsFlags = 0;
    for (var i = 0; i < dataSources.childNodes.length; ++i) {
      var checkbox = dataSources.childNodes[i];
      if (checkbox.localName == "checkbox" && checkbox.checked)
        this._itemsFlags |= parseInt(checkbox.id);
    }
  },

  onImportItemCommand: function (aEvent)
  {
    var items = document.getElementById("dataSources");
    var checkboxes = items.getElementsByTagName("checkbox");

    var oneChecked = false;
    for (var i = 0; i < checkboxes.length; ++i) {
      if (checkboxes[i].checked) {
        oneChecked = true;
        break;
      }
    }

    this._wiz.canAdvance = oneChecked;
  },

  // 4 - Migrating
  onMigratingPageShow: function ()
  {
    this._wiz.getButton("cancel").disabled = true;
    this._wiz.canRewind = false;
    this._wiz.canAdvance = false;

    // When automigrating or migrating all, show all of the data that can
    // be received from this source.
    if (this._autoMigrate || this._itemsFlags == kIMig.ALL)
      this._itemsFlags = this._migrator.getMigrateData(this._selectedProfile,
                                                       this._autoMigrate);

    this._listItems("migratingItems");
    setTimeout(this.onMigratingMigrate, 0, this);
  },

  onMigratingMigrate: function (aOuter)
  {
    aOuter._migrator.migrate(aOuter._itemsFlags, aOuter._autoMigrate, aOuter._selectedProfile);
  },

  _listItems: function (aID)
  {
    var items = document.getElementById(aID);
    while (items.hasChildNodes())
      items.removeChild(items.firstChild);

    var bundle = document.getElementById("bundle");
    var itemID;
    for (var i = 0; i < 16; ++i) {
      var itemID = (this._itemsFlags >> i) & 0x1 ? Math.pow(2, i) : 0;
      if (itemID > 0) {
        var label = document.createElement("label");
        label.id = itemID + "_migrated";
        try {
          label.setAttribute("value", "- " + bundle.getString(itemID + "_" + this._source));
          items.appendChild(label);
        }
        catch (e) {
          // if the block above throws, we've enumerated all the import data types we
          // currently support and are now just wasting time, break.
          break;
        }
      }
    }
  },

  observe: function (aSubject, aTopic, aData)
  {
    switch (aTopic) {
    case "Migration:Started":
      dump("*** started\n");
      break;
    case "Migration:ItemBeforeMigrate":
      dump("*** before " + aData + "\n");
      var label = document.getElementById(aData + "_migrated");
      if (label)
        label.setAttribute("style", "font-weight: bold");
      break;
    case "Migration:ItemAfterMigrate":
      dump("*** after " + aData + "\n");
      var label = document.getElementById(aData + "_migrated");
      if (label)
        label.removeAttribute("style");
      break;
    case "Migration:Ended":
      dump("*** done\n");
      if (this._autoMigrate) {
        // We're done now.
        this._wiz.canAdvance = true;
        this._wiz.advance();
        setTimeout(window.close, 5000);
      }
      else {
        this._wiz.canAdvance = true;
        var nextButton = this._wiz.getButton("next");
        nextButton.click();
      }
      break;
    case "Migration:Progress":
      document.getElementById('progressBar').value = aData;
      break;
    }
  },

  onDonePageShow: function ()
  {
    this._wiz.getButton("cancel").disabled = true;
    this._wiz.canRewind = false;
    this._listItems("doneItems");
  }
};
