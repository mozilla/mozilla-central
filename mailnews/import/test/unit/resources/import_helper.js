Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

// used by checkProgress to periodically check the progress of the import
var gGenericImportHelper;
/**
 * GenericImportHelper
 * The parent class of AbImportHelper and MailImportHelper.
 *
 * @param aModuleType The type of import module. Should be addressbook or mail.
 * @param aModuleSearchString
 *                    The string to search the module names for, such as
 *                    "Text file" to find the import module for comma-separated
 *                    value, LDIF, and tab-delimited files.
 * @param aFile       An instance of nsIFile to import.
 *
 * @constructor
 * @class
 */
function GenericImportHelper(aModuleType, aModuleSearchString, aFile)
{
  gGenericImportHelper = null;
  if (["addressbook", "mail", "settings"].indexOf(aModuleType) == -1)
    do_throw("Unexpected type passed to the GenericImportHelper constructor");
  this.mModuleType = aModuleType;
  this.mModuleSearchString = aModuleSearchString;
  this.mInterface = this._findInterface();
  do_check_neq(this.mInterface, null);

  this.mFile = aFile; // checked in the beginImport method
}

GenericImportHelper.prototype =
{
  interfaceType: Ci.nsIImportGeneric,
  /**
   * GenericImportHelper.beginImport
   * Imports the given address book export or mail data and invoke 
   * checkProgress of child class to check the data,
   */
  beginImport: function() {
    do_check_true(this.mFile instanceof Ci.nsIFile && this.mFile.exists());

    if (this.mModuleType == "addressbook")
      this.mInterface.SetData("addressLocation", this.mFile);
    else if (this.mModuleType == "mail")
      this.mInterface.SetData("mailLocation", this.mFile);

    do_check_true(this.mInterface.WantsProgress());
    do_check_true(this.mInterface.BeginImport(null, null));
    do_test_pending();
    this.checkProgress();
  },
  /**
   * GenericImportHelper.getInterface
   *
   * @return An nsIImportGeneric import interface.
   */
  getInterface: function() {
    return this.mInterface;
  },

  _findInterface: function() {
    var importService = Cc["@mozilla.org/import/import-service;1"]
                        .getService(Ci.nsIImportService);
    var count = importService.GetModuleCount(this.mModuleType);

    // Iterate through each import module until the one being searched for is
    // found and then return the ImportInterface of that module
    for (var i = 0; i < count; i++) {
      // Check if the current module fits the search string gets the interface
      if (importService.GetModuleName(this.mModuleType, i).indexOf(this.mModuleSearchString) != -1) {
        return importService.GetModule(this.mModuleType, i)
                            .GetImportInterface(this.mModuleType)
                            .QueryInterface(this.interfaceType);
      }
    }
    return null; // it wasn't found
  },
  /**
   * GenericImportHelper.checkProgress
   * Checks the progress of an import every 200 milliseconds until it is
   * complete.  Checks the test results if there is an original address book,
   * otherwise evaluates the optional command, or calls do_test_finished().
   */
  checkProgress: function() {
    do_check_true(this.mInterface &&
                  this.mInterface instanceof Ci.nsIImportGeneric);
    do_check_true(this.mInterface.ContinueImport());
    // if the import isn't done, check again in 200 milliseconds.
    if (this.mInterface.GetProgress() != 100) {
      // use the helper object to check the progress of the import after 200 ms
      gGenericImportHelper = this;
      do_timeout(200, function(){gGenericImportHelper.checkProgress();});
    } else { // if it is done, check the results or finish the test.
      this.checkResults();
      do_test_finished();
    }
  },

  /**
   * GenericImportHelper.checkResults
   * Checks the results of the import.
   * Child class should implement this method.
   */
  checkResults: function() {
  }
};

function endsWith(string, suffix) {
  return string.indexOf(suffix, string.length - suffix.length) != -1;
}

/**
 * AbImportHelper
 * A helper for Address Book imports. To use, supply at least the file and type.
 * If you would like the results checked, add a new array in the addressbook
 * JSON file in the resources folder and supply aAbName and aJsonName.
 * See AB_README for more information.
 *
 * @param aFile     An instance of nsIAbFile to import.
 * @param aModuleSearchString
 *                  The string to search the module names for, such as
 *                  "Text file" to find the import module for comma-separated
 *                  value, LDIF, and tab-delimited files.
 * Optional parameters: Include if you would like the import checked.
 * @param aAbName   The name the address book will have (the filename without
 *                  the extension).
 * @param aJsonName The name of the array in addressbook.json with the cards
 *                  to compare with the imported cards.
 * @constructor
 * @class
 */
function AbImportHelper(aFile, aModuleSearchString, aAbName, aJsonName)
{
  GenericImportHelper.call(this, "addressbook", aModuleSearchString, aFile);

  this.mAbName = aAbName;
  /* Attribute notes:  The attributes listed in the declaration below are
   * supported by all three text export/import types. PreferMailFormat is only
   * supported by LDIF.
   * The following are not supported: anniversaryYear, anniversaryMonth,
   * anniversaryDay, popularityIndex, isMailList, mailListURI, lastModifiedDate,
   * and allowRemoteContent
   */
  var supportedAttributes =
    ["FirstName", "LastName", "DisplayName", "NickName", "PrimaryEmail",
     "SecondEmail", "WorkPhone", "HomePhone", "FaxNumber", "PagerNumber",
     "CellularNumber", "HomeAddress", "HomeAddress2", "HomeCity", "HomeState",
     "HomeZipCode", "HomeCountry", "WorkAddress", "WorkAddress2", "WorkCity",
     "WorkState", "WorkZipCode", "WorkCountry", "JobTitle", "Department",
     "Company", "BirthYear", "BirthMonth", "BirthDay", "WebPage1", "WebPage2",
     "Custom1", "Custom2", "Custom3", "Custom4", "Notes", "_AimScreenName"];

  // get the extra attributes supported for the given type of import
  if (endsWith(this.mFile.leafName.toLowerCase(), ".ldif")) {
    // LDIF: add PreferMailFormat
    this.mSupportedAttributes = supportedAttributes.concat(["PreferMailFormat"]);
  } else if (endsWith(this.mFile.leafName.toLowerCase(), ".csv")) {
    this.mSupportedAttributes = supportedAttributes;
    this.setFieldMap(this.getDefaultFieldMap(true));
  } else if (endsWith(this.mFile.leafName.toLowerCase(), ".vcf")) {
    this.mSupportedAttributes = supportedAttributes;
  };

  // get the "cards" from the JSON file, if necessary
  if (aJsonName)
    this.mJsonCards = this.getJsonCards(aJsonName);
}

AbImportHelper.prototype =
{
  /**
   * AbImportHelper.getDefaultFieldMap
   * Returns the default field map.
   *
   * @param aSkipFirstRecord True if the first record of the text file should
   *                         be skipped.
   * @return A default field map.
   */
  getDefaultFieldMap: function(aSkipFirstRecord) {
    var importService = Cc["@mozilla.org/import/import-service;1"]
                         .getService(Ci.nsIImportService);
    var fieldMap = importService.CreateNewFieldMap();

    fieldMap.DefaultFieldMap(fieldMap.numMozFields);
    fieldMap.skipFirstRecord = aSkipFirstRecord;

    return fieldMap;
  },

  /**
   * AbImportHelper.setFieldMap
   * Set the field map.
   *
   * @param aFieldMap The field map used for address book import.
   */
  setFieldMap: function(aFieldMap) {
    this.mInterface.SetData("fieldMap", aFieldMap);
  },

  /**
   * AbImportHelper.setAddressLocation
   * Set the the location of the address book.
   *
   * @param aLocation The location of the source address book.
   */
  setAddressBookLocation: function(aLocation) {
    this.mInterface.SetData("addressLocation", aLocation);
  },

  /**
   * AbImportHelper.setAddressDestination
   * Set the the destination of the address book.
   *
   * @param aDestination   URI of destination address book or null if
   *                       new address books will be created.
   */
  setAddressDestination: function(aDestination) {
    this.mInterface.SetData("addressDestination", aDestination);
  },

  /**
   * AbImportHelper.checkResults
   * Checks the results of the import.
   * Ensures the an address book was created, then compares the supported
   * attributes of each card with the card(s) in the JSON array.
   * Calls do_test_finished() when done
   */
  checkResults: function() {
    if (!this.mJsonCards)
      do_throw("The address book must be setup before checking results");
    // When do_test_pending() was called and there is an error the test hangs.
    // This try/catch block will catch any errors and call do_throw() with the
    // error to throw the error and avoid the hang.
    try {
      // make sure an address book was created
      var newAb = this.getAbByName(this.mAbName);
      do_check_neq(newAb, null);
      do_check_true(newAb instanceof Ci.nsIAbDirectory &&
                    newAb.childCards instanceof Ci.nsISimpleEnumerator);
      // get the imported card(s) and check each one
      var iter = newAb.childCards;
      var count = 0;
      for (; iter.hasMoreElements(); count++) {
        var importedCard = iter.getNext().QueryInterface(Ci.nsIAbCard);
        this.compareCards(this.mJsonCards[count], importedCard);
      }
      // make sure there are the same number of cards in the address book and
      // the JSON array
      do_check_eq(count, this.mJsonCards.length);
      do_test_finished();
    } catch(e) { do_throw(e); }
  },
  /**
   * AbImportHelper.getAbByName
   * Returns the Address Book (if any) with the given name.
   *
   * @param aName The name of the Address Book to find.
   * @return An nsIAbDirectory, if found.
   *         null if the requested Address Book could not be found.
   */
  getAbByName: function(aName) {
    do_check_true(aName && aName.length > 0);

    var iter = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager)
                                             .directories;
    var data = null;
    while (iter.hasMoreElements()) {
      data = iter.getNext();
      if (data instanceof Ci.nsIAbDirectory)
        if (data.dirName == aName)
          return data;
    }
    return null;
  },
  /**
   * AbImportHelper.compareCards
   * Compares a JSON "card" with an imported card and throws an error if the
   * values of a supported attribute are different.
   *
   * @param aJsonCard The object decoded from addressbook.json.
   * @param aCard     The imported card to compare with.
   */
  compareCards: function(aJsonCard, aCard) {
    for (var i in aJsonCard)
      if (this.mSupportedAttributes.indexOf(i) >= 0)
        do_check_eq(aJsonCard[i], aCard.getProperty(i, "BAD"));
  },
  /**
   * AbImportHelper.getJsonCards
   * Gets an array of "cards" from the JSON file addressbook.json located in the
   * mailnews/import/test/resources folder.  The array should contain objects
   * with the expected properties and values of the cards in the imported
   * address book.
   * See addressbook.json for an example and AB_README for more details.
   *
   * @param aName The name of the array in addressbook.json.
   * @return An array of "cards".
   */
  getJsonCards: function(aName) {
    if (!aName)
      do_throw("Error - getJSONAb requires an address book name");
    var file = do_get_file("resources/addressbook.json");
    if (!file || !file.exists() || !file.isFile())
      do_throw("Unable to get JSON file");

    var fis = Cc["@mozilla.org/network/file-input-stream;1"]
               .createInstance(Ci.nsIFileInputStream);
    fis.init(file, 0x01, 0444, 0);
    var istream = Cc["@mozilla.org/intl/converter-input-stream;1"]
                   .createInstance(Ci.nsIConverterInputStream);
    var replacementChar = Ci.nsIConverterInputStream
                            .DEFAULT_REPLACEMENT_CHARACTER;
    istream.init(fis, "UTF-8", 1024, replacementChar);
    var json = "";
    var str = {};
    // get the entire file into the json string
    while(istream.readString(4096, str) != 0)
      json += str.value;
    // close the input streams
    istream.close();
    fis.close();
    // decode the JSON and get the array of cards
    var arr = JSON.parse(json)[aName];
    do_check_true(arr && arr.length > 0);
    return arr;
  }
};
AbImportHelper.prototype.__proto__ = GenericImportHelper.prototype;

/**
 * MailImportHelper
 * A helper for mail imports.
 *
 * @param aFile      An instance of nsIFile to import.
 * @param aModuleSearchString
 *                   The string to search the module names for, such as
 *                   "Outlook Express" or "Eudora mail" etc. etc.
 * @param aExpected  An instance of nsIFile to compare with the imported
 *                   folders.
 *
 * @constructor
 * @class
 */
function MailImportHelper(aFile, aModuleSearchString, aExpected)
{
  GenericImportHelper.call(this, "mail", aModuleSearchString, aFile);
  this.mExpected = aExpected;
}

MailImportHelper.prototype =
{
  interfaceType: Ci.nsIImportGeneric,
  _checkEqualFolder: function(expectedFolder, actualFolder) {
    do_check_eq(expectedFolder.leafName, actualFolder.name);
    let expectedSubFolderCount = 0;

    let expectedEnumerator = expectedFolder.directoryEntries;
    let expectedSubFolders = [];
    while (expectedEnumerator.hasMoreElements()) {
      let entry = expectedEnumerator.getNext().QueryInterface(Ci.nsIFile);
      if (entry.isDirectory()) {
        expectedSubFolderCount++;
        expectedSubFolders.push(entry);
      }
    }
    do_check_eq(expectedSubFolderCount, actualFolder.numSubFolders);

    let actualEnumerator = actualFolder.subFolders;
    for (let i = 0; i < expectedSubFolderCount; i++) {
      let expectedSubFolder = expectedSubFolders[i];
      let actualSubFolder = actualEnumerator.getNext().QueryInterface(Ci.nsIMsgFolder);
      this._checkEqualFolder(expectedSubFolder, actualSubFolder);
    }
  },

  checkResults: function() {
    let rootFolder = MailServices.accounts.localFoldersServer.rootFolder;
    do_check_true(rootFolder.containsChildNamed(this.mFile.leafName));
    let importedFolder = rootFolder.getChildNamed(this.mFile.leafName);
    do_check_neq(importedFolder, null);

    this._checkEqualFolder(this.mExpected, importedFolder);
  }
}

MailImportHelper.prototype.__proto__ = GenericImportHelper.prototype;

/**
 * SettingsImportHelper
 * A helper for settings imports.
 *
 * @param aFile      An instance of nsIFile to import, can be null.
 * @param aModuleSearchString
 *                   The string to search the module names for, such as
 *                   "Outlook Express" or "Eudora mail" etc. etc.
 * @param aExpected  An array of object which has incomingServer, identity
 *                   and smtpSever to compare with imported nsIMsgAccount.
 *
 * @constructor
 * @class
 */
function SettingsImportHelper(aFile, aModuleSearchString, aExpected)
{
  GenericImportHelper.call(this, "settings", aModuleSearchString, aFile);
  this.mExpected = aExpected;
  this.mInterface = this._findInterface();
  do_check_neq(this.mInterface, null);

  this.mFile = aFile;
}

SettingsImportHelper.prototype =
{
  interfaceType: Ci.nsIImportSettings,
  /**
   * SettingsImportHelper.beginImport
   * Imports settings from a specific file or auto-located if the file is null,
   * and compare the import results with the expected array.
   */
  beginImport: function() {
    this._ensureNoAccounts();
    if (this.mFile)
      this.mInterface.SetLocation(this.mFile)
    else
      do_check_eq(true, this.mInterface.AutoLocate({}, {}));
    do_check_eq(true, this.mInterface.Import({}));
    this.checkResults();
  },

  _ensureNoAccounts: function() {
    let accounts = MailServices.accounts.accounts;

    for (let i = 0; i < accounts.Count(); i++) {
      let account = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
      MailServices.accounts.removeAccount(account);
    }
  },

  _checkSmtpServer: function(expected, actual) {
    do_check_eq(expected.port, actual.port);
    do_check_eq(expected.username, actual.username);
    do_check_eq(expected.authMethod, actual.authMethod);
    do_check_eq(expected.socketType, actual.socketType);
  },

  _checkIdentity: function(expected, actual) {
    do_check_eq(expected.fullName, actual.fullName);
    do_check_eq(expected.email, actual.email);
    do_check_eq(expected.replyTo, actual.replyTo);
    do_check_eq(expected.organization, actual.organization);
  },

  _checkPop3IncomingServer: function(expected, actual) {
    do_check_eq(expected.leaveMessagesOnServer, actual.leaveMessagesOnServer);
    do_check_eq(expected.deleteMailLeftOnServer, actual.deleteMailLeftOnServer);
    do_check_eq(expected.deleteByAgeFromServer, actual.deleteByAgeFromServer);
    do_check_eq(expected.numDaysToLeaveOnServer, actual.numDaysToLeaveOnServer);
  },

  _checkIncomingServer: function(expected, actual) {
    do_check_eq(expected.type, actual.type);
    do_check_eq(expected.port, actual.port);
    do_check_eq(expected.username, actual.username);
    do_check_eq(expected.isSecure, actual.isSecure);
    do_check_eq(expected.hostName, actual.hostName);
    do_check_eq(expected.prettyName, actual.prettyName);
    do_check_eq(expected.authMethod, actual.authMethod);
    do_check_eq(expected.socketType, actual.socketType);
    do_check_eq(expected.doBiff, actual.doBiff);
    do_check_eq(expected.biffMinutes, actual.biffMinutes);

    if (expected.type == "pop3")
      this._checkPop3IncomingServer(expected, actual.QueryInterface(Ci.nsIPop3IncomingServer));
  },

  _checkAccount: function(expected, actual) {
    this._checkIncomingServer(expected.incomingServer, actual.incomingServer);

    do_check_eq(1, actual.identities.length);
    let actualIdentity = actual.identities.queryElementAt(0, Ci.nsIMsgIdentity);
    this._checkIdentity(expected.identity, actualIdentity);

    if (expected.incomingServer.type != "nntp") {
      let actualSmtpServer = MailServices.smtp.getServerByKey(actualIdentity.smtpServerKey);
      this._checkSmtpServer(expected.smtpServer, actualSmtpServer);
    }
  },

  _isLocalMailAccount: function(account) {
    return (account.incomingServer.type == "none" &&
            account.incomingServer.username == "nobody" &&
            account.incomingServer.hostName == "Local Folders");
  },

  _findExpectedAccount: function(account) {
    return this.mExpected.filter(function(expectedAccount) {
      return (expectedAccount.incomingServer.type == account.incomingServer.type &&
              expectedAccount.incomingServer.username == account.incomingServer.username &&
              expectedAccount.incomingServer.hostName == account.incomingServer.hostName);
    });
  },

  checkResults: function() {
    accounts = MailServices.accounts.accounts;
    for (let i = 0; i < accounts.Count() - 1; i++) {
      let actualAccount = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
      if (this._isLocalMailAccount(actualAccount))
        continue;
      let expectedAccounts = this._findExpectedAccount(actualAccount);
      do_check_neq(null, expectedAccounts);
      do_check_eq(1, expectedAccounts.length);
      this._checkAccount(expectedAccounts[0], actualAccount);
    }
  }
}

SettingsImportHelper.prototype.__proto__ = GenericImportHelper.prototype;

do_load_manifest("resources/TestMailImporter.manifest");
