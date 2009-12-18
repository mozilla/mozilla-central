// used by checkProgress to periodically check the progress of the import
var gAbImportHelper;
/**
 * AbImportHelper
 * A helper for Address Book imports. To use, supply at least the file and type.
 * If you would like the results checked, add a new array in the addressbook
 * JSON file in the resources folder and supply aAbName and aJsonName.
 * See AB_README for more information.
 * 
 * @param aFile     An instance of nsIAbFile to import.
 * @param aType     The type of import.  Should be LDIF, CSV, or TAB.
 *
 * Optional parameters: Include if you would like the import checked.
 * @param aAbName   The name the address book will have (the filename without
 *                  the extension).
 * @param aJsonName The name of the array in addressbook.json with the cards
 *                  to compare with the imported cards.
 * @constructor
 * @class
 */
function AbImportHelper(aFile, aType, aAbName, aJsonName)
{
  gAbImportHelper = null;
  this.mFile = aFile; // checked in the beginImport method
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
  if (aType == "LDIF")
  {
    // LDIF: add PreferMailFormat
    this.mSupportedAttributes = supportedAttributes.concat(["PreferMailFormat"]);
    this.mLdif = true;
  }
  else if (aType == "CSV" || aType == "TAB")
  {
    this.mSupportedAttributes = supportedAttributes;
    this.mLdif = false;
  }
  else
    do_throw("Unexpected type passed to the AbImportHelper constructor");
  // get the "cards" from the JSON file, if necessary
  if (aJsonName)
    this.mJsonCards = this.getJsonCards(aJsonName);
}
AbImportHelper.prototype =
{
  /**
   * AbImportHelper.beginImport
   * Imports the given address book export and checks the imported address book
   * with the array in addressbook.json if aAbName and aJsonName were supplied
   * to the constructor.
   */
  beginImport: function()
  {
    do_check_true(this.mFile instanceof Ci.nsIFile && this.mFile.exists() &&
                  this.mFile.isFile());

    // get the import interface used for all text imports
    this.mAbInterface = this.getInterface("addressbook", ".csv");
    this.mAbInterface.SetData("addressLocation", this.mFile);
    // skip setting the field map if this is an LDIF import
    if (!this.mLdif)
      this.mAbInterface.SetData("fieldMap", this.getDefaultFieldMap(true));

    do_check_true(this.mAbInterface.WantsProgress());
    do_check_true(this.mAbInterface.BeginImport(null, null, false));
    do_test_pending();
    this.checkProgress();
  },
  /**
   * AbImportHelper.getInterface
   * Returns an import interface based on the name of the module and a string
   * to search for.
   *
   * @param aModuleName The name of the module, such as "addressbook".
   * @param aSearchStr  The string to search the module names for, such as
   *                    ".csv" to find the import module for comma-separated
   *                    value, LDIF, and tab-delimited files.
   * @return An nsIImportGeneric import interface.
   */
  getInterface: function(aModuleName, aSearchStr)
  {
    do_check_true(aModuleName && aModuleName.length > 0);
    do_check_true(aSearchStr && aSearchStr.length > 0);

    var importService = Cc["@mozilla.org/import/import-service;1"]
                         .getService(Ci.nsIImportService);
    var module;
    var count = importService.GetModuleCount(aModuleName);

    // Iterate through each import module until the one being searched for is
    // found and then return the ImportInterface of that module
    for (var i = 0; i < count; i++)
      // Check if the current module fits the search string gets the interface
      if (importService.GetModuleName(aModuleName, i).indexOf(aSearchStr) != -1)
        return importService.GetModule(aModuleName, i)
                            .GetImportInterface(aModuleName)
                            .QueryInterface(Ci.nsIImportGeneric);
    return null; // it wasn't found
  },
  /**
   * AbImportHelper.getDefaultFieldMap
   * Returns the default field map.
   *
   * @param aSkipFirstRecord True if the first record of the text file should
   *                         be skipped.
   * @return A default field map.
   */
  getDefaultFieldMap: function(aSkipFirstRecord)
  {
    var importService = Cc["@mozilla.org/import/import-service;1"]
                         .getService(Ci.nsIImportService);
    var fieldMap = importService.CreateNewFieldMap();

    fieldMap.DefaultFieldMap(fieldMap.numMozFields);
    fieldMap.skipFirstRecord = aSkipFirstRecord;

    return fieldMap;
  },
  /**
   * AbImportHelper.checkProgress
   * Checks the progress of an import every 200 milliseconds until it is
   * complete.  Checks the test results if there is an original address book,
   * otherwise evaluates the optional command, or calls do_test_finished().
   */
  checkProgress: function()
  {
    do_check_true(this.mAbInterface && 
                  this.mAbInterface instanceof Ci.nsIImportGeneric);
    do_check_true(this.mAbInterface.ContinueImport());
    // if the import isn't done, check again in 200 milliseconds.
    if (this.mAbInterface.GetProgress() != 100) {
      // use the helper object to check the progress of the import after 200 ms
      gAbImportHelper = this;
      do_timeout(200, function(){gAbImportHelper.checkProgress();});
    }
    // if it is done, check the results or finish the test.
    else
    {
      if (this.mAbName)
        this.checkResults(this.mAbName);
      else
        do_test_finished();
    }
  },
  /**
   * AbImportHelper.checkResults
   * Checks the results of the import.
   * Ensures the an address book was created, then compares the supported
   * attributes of each card with the card(s) in the JSON array.
   * Calls do_test_finished() when done
   */
  checkResults: function()
  {
    if (!this.mJsonCards)
      do_throw("The address book must be setup before checking results");
    // When do_test_pending() was called and there is an error the test hangs.
    // This try/catch block will catch any errors and call do_throw() with the
    // error to throw the error and avoid the hang.
    try
    {
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
  getAbByName: function(aName)
  {
    do_check_true(aName && aName.length > 0);

    var iter = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager)
                                             .directories;
    var data = null;
    while (iter.hasMoreElements())
    {
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
  compareCards: function(aJsonCard, aCard)
  {
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
  getJsonCards: function(aName)
  {
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
    var nsIJSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);  
    var arr = nsIJSON.decode(json)[aName];
    do_check_true(arr && arr.length > 0);
    return arr;
  }
}
