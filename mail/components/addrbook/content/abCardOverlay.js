# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Seth Spitzer <sspitzer@netscape.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

const kNonVcardFields =
        ["nickNameContainer", "secondaryEmailContainer", "screenNameContainer",
         "customFields", "allowRemoteContent", "abPhotoTab"];

const kPhoneticFields =
        ["PhoneticLastName", "PhoneticLabel1", "PhoneticSpacer1",
         "PhoneticFirstName", "PhoneticLabel2", "PhoneticSpacer2"];

// Item is |[dialogField, cardProperty]|.
const kVcardFields =
        [ // Contact > Name
         ["FirstName", "FirstName"],
         ["LastName", "LastName"],
         ["DisplayName", "DisplayName"],
         ["NickName", "NickName"],
          // Contact > Internet
         ["PrimaryEmail", "PrimaryEmail"],
         ["SecondEmail", "SecondEmail"],
         ["ScreenName", "_AimScreenName"], // NB: AIM.
          // Contact > Phones
         ["WorkPhone", "WorkPhone"],
         ["HomePhone", "HomePhone"],
         ["FaxNumber", "FaxNumber"],
         ["PagerNumber", "PagerNumber"],
         ["CellularNumber", "CellularNumber"],
          // Address > Home
         ["HomeAddress", "HomeAddress"],
         ["HomeAddress2", "HomeAddress2"],
         ["HomeCity", "HomeCity"],
         ["HomeState", "HomeState"],
         ["HomeZipCode", "HomeZipCode"],
         ["HomeCountry", "HomeCountry"],
         ["WebPage2", "WebPage2"],
          // Address > Work
         ["JobTitle", "JobTitle"],
         ["Department", "Department"],
         ["Company", "Company"],
         ["WorkAddress", "WorkAddress"],
         ["WorkAddress2", "WorkAddress2"],
         ["WorkCity", "WorkCity"],
         ["WorkState", "WorkState"],
         ["WorkZipCode", "WorkZipCode"],
         ["WorkCountry", "WorkCountry"],
         ["WebPage1", "WebPage1"],
          // Other > (custom)
         ["Custom1", "Custom1"],
         ["Custom2", "Custom2"],
         ["Custom3", "Custom3"],
         ["Custom4", "Custom4"],
          // Other > Notes
         ["Notes", "Notes"]];

const kDefaultYear = 2000;
var gEditCard;
var gOnSaveListeners = new Array();
var gOkCallback = null;
var gHideABPicker = false;
var originalPhotoURI = "";

function OnLoadNewCard()
{
  InitEditCard();

  gEditCard.card =
    (("arguments" in window) && (window.arguments.length > 0) &&
     (window.arguments[0] instanceof Components.interfaces.nsIAbCard))
    ? window.arguments[0]
    : Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                .createInstance(Components.interfaces.nsIAbCard);
  gEditCard.titleProperty = "newContactTitle";
  gEditCard.selectedAB = "";

  if ("arguments" in window && window.arguments[0])
  {
    gEditCard.selectedAB = kPersonalAddressbookURI;

    if ("selectedAB" in window.arguments[0]) {
      // check if selected ab is a mailing list
      var abURI = window.arguments[0].selectedAB;
      
      var directory = GetDirectoryFromURI(abURI);
      if (directory.isMailList) {
        var parentURI = GetParentDirectoryFromMailingListURI(abURI);
        if (parentURI)
          gEditCard.selectedAB = parentURI;
      }
      else if (!directory.readOnly)
        gEditCard.selectedAB = window.arguments[0].selectedAB;
    }

    // we may have been given properties to pre-initialize the window with....
    // we'll fill these in here...
    if ("primaryEmail" in window.arguments[0])
      gEditCard.card.primaryEmail = window.arguments[0].primaryEmail;
    if ("displayName" in window.arguments[0]) {
      gEditCard.card.displayName = window.arguments[0].displayName;
      // if we've got a display name, don't generate
      // a display name (and stomp on the existing display name)
      // when the user types a first or last name
      if (gEditCard.card.displayName.length)
        gEditCard.generateDisplayName = false;
    }
    if ("aimScreenName" in window.arguments[0])
      gEditCard.card.setProperty("_AimScreenName",
                                 window.arguments[0].aimScreenName);
    if ("allowRemoteContent" in window.arguments[0])
      gEditCard.card.setProperty("AllowRemoteContent",
                                 window.arguments[0].allowRemoteContent);

    if ("okCallback" in window.arguments[0])
      gOkCallback = window.arguments[0].okCallback;

    if ("escapedVCardStr" in window.arguments[0]) {
      // hide non vcard values
      HideNonVcardFields();
      gEditCard.card =
        Components.classes["@mozilla.org/abmanager;1"]
                  .getService(Components.interfaces.nsIAbManager)
                  .escapedVCardToAbCard(window.arguments[0].escapedVCardStr);
    }

    if ("titleProperty" in window.arguments[0])
      gEditCard.titleProperty = window.arguments[0].titleProperty;
    
    if ("hideABPicker" in window.arguments[0])
      gHideABPicker = window.arguments[0].hideABPicker;
  }

  // set popup with address book names
  var abPopup = document.getElementById('abPopup');
  abPopup.value = gEditCard.selectedAB || kPersonalAddressbookURI;

  if (gHideABPicker && abPopup) {
    abPopup.hidden = true;
    document.getElementById("abPopupLabel").hidden = true;
  }

  SetCardDialogTitle(gEditCard.card.displayName);
    
  GetCardValues(gEditCard.card, document);

  // FIX ME - looks like we need to focus on both the text field and the tab widget
  // probably need to do the same in the addressing widget

  // focus on first or last name based on the pref
  var focus = document.getElementById(gEditCard.displayLastNameFirst
                                      ? "LastName" : "FirstName");
  if ( focus ) {
    // XXX Using the setTimeout hack until bug 103197 is fixed
    setTimeout( function(firstTextBox) { firstTextBox.focus(); }, 0, focus );
  }
  moveToAlertPosition();
}

function EditCardOKButton()
{
  if (!CheckCardRequiredDataPresence(document))
    return false;  // don't close window

  // See if this card is in any mailing list
  // if so then we need to update the addresslists of those mailing lists
  var directory = GetDirectoryFromURI(gEditCard.abURI);

  // if the directory is a mailing list we need to search all the mailing lists
  // in the parent directory if the card exists.
  if (directory.isMailList) {
    var parentURI = GetParentDirectoryFromMailingListURI(gEditCard.abURI);
    directory = GetDirectoryFromURI(parentURI);
  }

  var listDirectoriesCount = directory.addressLists.length;
  var foundDirectories = new Array();
  var foundDirectoriesCount = 0;
  var i;
  // create a list of mailing lists and the index where the card is at.
  for ( i=0;  i < listDirectoriesCount; i++ ) {
    var subdirectory = directory.addressLists.queryElementAt(i, Components.interfaces.nsIAbDirectory);
    try {
      var index = subdirectory.indexOf(gEditCard);
      foundDirectories[foundDirectoriesCount] = {directory:subdirectory, index:index};
      foundDirectoriesCount++;
    } catch (ex) {}
  }
  
  CheckAndSetCardValues(gEditCard.card, document, false);

  directory.modifyCard(gEditCard.card);
  
  for (i=0; i < foundDirectoriesCount; i++) {
    // Update the addressLists item for this card
    foundDirectories[i].directory.addressLists
                       .replaceElementAt(gEditCard.card, foundDirectories[i].index, false);
  }
                                        
  NotifySaveListeners(directory);

  // callback to allow caller to update
  if (gOkCallback)
    gOkCallback();

  return true;  // close the window
}

function OnLoadEditCard()
{
  InitEditCard();

  gEditCard.titleProperty = "editContactTitle";

  if (window.arguments && window.arguments[0])
  {
    if ( window.arguments[0].card )
      gEditCard.card = window.arguments[0].card;
    if ( window.arguments[0].okCallback )
      gOkCallback = window.arguments[0].okCallback;
    if ( window.arguments[0].abURI )
      gEditCard.abURI = window.arguments[0].abURI;
  }

  // set global state variables
  // if first or last name entered, disable generateDisplayName
  if (gEditCard.generateDisplayName &&
      (gEditCard.card.firstName.length +
       gEditCard.card.lastName.length +
       gEditCard.card.displayName.length > 0))
  {
    gEditCard.generateDisplayName = false;
  }

  GetCardValues(gEditCard.card, document);

  SetCardDialogTitle(gEditCard.card.displayName);

  // check if selectedAB is a writeable
  // if not disable all the fields
  if ("arguments" in window && window.arguments[0])
  {
    if ("abURI" in window.arguments[0]) {
      var abURI = window.arguments[0].abURI;
      var directory = GetDirectoryFromURI(abURI);

      if (directory.readOnly) 
      {
        // Disable the photo field and buttons
        document.getElementById("generic").disabled          = true;
        document.getElementById("GenericPhotoList").disabled = true;
        document.getElementById("file").disabled             = true;
        document.getElementById("web").disabled              = true;
        document.getElementById("PhotoURI").readOnly         = true;
        document.getElementById("PhotoURI").emptyText        = "";
        document.getElementById("BrowsePhoto").disabled      = true;
        document.getElementById("UpdatePhoto").disabled      = true;
        // Set all the editable vcard fields to read only
        for (var i = kVcardFields.length; i-- > 0; )
          document.getElementById(kVcardFields[i][0]).readOnly = true;

        // the birthday fields
        document.getElementById("Birthday").readOnly = true;
        document.getElementById("BirthYear").readOnly = true;
        document.getElementById("Age").readOnly = true;

        // And the phonetic fields
        document.getElementById(kPhoneticFields[0]).readOnly = true;
        document.getElementById(kPhoneticFields[3]).readOnly = true;

        // Also disable the mail format popup and allow remote content items.
        document.getElementById("PreferMailFormatPopup").disabled = true;
        document.getElementById("allowRemoteContent").disabled = true;

        document.documentElement.buttons = "accept";
        document.documentElement.removeAttribute("ondialogaccept");
      }
      
      // hide  remote content in HTML field for remote directories
      if (directory.isRemote)
        document.getElementById('allowRemoteContent').hidden = true;
    }
  }
}

// this is used by people who extend the ab card dialog
// like Netscape does for screenname
function RegisterSaveListener(func)
{
  gOnSaveListeners[gOnSaveListeners.length] = func;
}

// this is used by people who extend the ab card dialog
// like Netscape does for screenname
function NotifySaveListeners(directory)
{
  if (!gOnSaveListeners.length)
    return;

  for ( var i = 0; i < gOnSaveListeners.length; i++ )
    gOnSaveListeners[i]();

  // the save listeners might have tweaked the card
  // in which case we need to commit it.
  directory.modifyCard(gEditCard.card);
}

function InitPhoneticFields()
{
  var showPhoneticFields =
        gPrefs.getComplexValue("mail.addr_book.show_phonetic_fields", 
                               Components.interfaces.nsIPrefLocalizedString).data;

  // hide phonetic fields if indicated by the pref
  if (showPhoneticFields == "true")
  {
    for (var i = kPhoneticFields.length; i-- > 0; )
      document.getElementById(kPhoneticFields[i]).hidden = false;
  }
}

function InitEditCard()
{
  InitPhoneticFields();

  InitCommonJS();

  // Create gEditCard object that contains global variables for the current js
  //   file.
  gEditCard = new Object();

  gEditCard.prefs = gPrefs;

  // get specific prefs that gEditCard will need
  try {
    var displayLastNameFirst =
        gPrefs.getComplexValue("mail.addr_book.displayName.lastnamefirst", 
                               Components.interfaces.nsIPrefLocalizedString).data;
    gEditCard.displayLastNameFirst = (displayLastNameFirst == "true");
    gEditCard.generateDisplayName =
      gPrefs.getBoolPref("mail.addr_book.displayName.autoGeneration");
  }
  catch (ex) {
    dump("ex: failed to get pref" + ex + "\n");
  }
}

function NewCardOKButton()
{
  if (gOkCallback)
  {
    if (!CheckAndSetCardValues(gEditCard.card, document, true))
      return false;  // don't close window

    gOkCallback(gEditCard.card.translateTo("vcard"));
    return true;  // close the window
  }

  var popup = document.getElementById('abPopup');
  if ( popup )
  {
    var uri = popup.value;

    // FIX ME - hack to avoid crashing if no ab selected because of blank option bug from template
    // should be able to just remove this if we are not seeing blank lines in the ab popup
    if ( !uri )
      return false;  // don't close window
    // -----

    if (gEditCard.card)
    {
      if (!CheckAndSetCardValues(gEditCard.card, document, true))
        return false;  // don't close window

      // replace gEditCard.card with the card we added
      // so that save listeners can get / set attributes on
      // the card that got created.
      gEditCard.card = GetDirectoryFromURI(uri).addCard(gEditCard.card);
      NotifySaveListeners();
      if ("arguments" in window && window.arguments[0] &&
          "allowRemoteContent" in window.arguments[0]) {
        // getProperty may return a "1" or "0" string, we want a boolean
        window.arguments[0].allowRemoteContent =
          gEditCard.card.getProperty("AllowRemoteContent", false) != false;
      }
    }
  }

  return true;  // close the window
}

// Move the data from the cardproperty to the dialog
function GetCardValues(cardproperty, doc)
{
  if (!cardproperty)
    return;

  for (var i = kVcardFields.length; i-- > 0; ) {
    doc.getElementById(kVcardFields[i][0]).value =
      cardproperty.getProperty(kVcardFields[i][1], "");
  }

  var birthday = doc.getElementById("Birthday");
  modifyDatepicker(birthday);

  // get the month of the year (1 - 12)
  var month = cardproperty.getProperty("BirthMonth", null);
  if (month > 0 && month < 13)
    birthday.month = month - 1;
  else
    birthday.monthField.value = null;

  // get the date of the month (1 - 31)
  var date = cardproperty.getProperty("BirthDay", null);
  if (date > 0 && date < 32)
    birthday.date = date;
  else
    birthday.dateField.value = null;

  // get the year
  var year = cardproperty.getProperty("BirthYear", null);
  var birthYear = doc.getElementById("BirthYear");
  // set the year in the datepicker to the stored year
  // if the year isn't present, default to 2000 (a leap year)
  birthday.year = year && year < 10000 && year > 0 ? year : kDefaultYear;
  birthYear.value = year;

  // get the current age
  calculateAge(null, birthYear);

  // when the birth year changes, update the datepicker's year to the new value
  // or to kDefaultYear if the value is null
  birthYear.onchange = calculateAge;
  birthday.onchange = calculateAge;
  var age = doc.getElementById("Age");
  age.onchange = calculateYear;

  var popup = document.getElementById("PreferMailFormatPopup");
  if (popup)
    popup.value = cardproperty.getProperty("PreferMailFormat", "");

  var allowRemoteContentEl = document.getElementById("allowRemoteContent");
  if (allowRemoteContentEl)
    // getProperty may return a "1" or "0" string, we want a boolean
    allowRemoteContentEl.checked = cardproperty.getProperty("AllowRemoteContent", false) != false;

  // get phonetic fields if exist
  try {
    doc.getElementById("PhoneticFirstName").value = cardproperty.getProperty("PhoneticFirstName", "");
    doc.getElementById("PhoneticLastName").value = cardproperty.getProperty("PhoneticLastName", "");
  }
  catch (ex) {}

  // Store the original photo URI and update the photo
  // Select the type if there is a valid value stored for that type, otherwise
  // select the generic photo
  var type = cardproperty.getProperty("PhotoType", "");
  document.getElementById("PhotoType").selectedItem =
    document.getElementById(type ? type : "generic");
  if (type == "file") {
    originalPhotoURI = getPhotoURI(cardproperty.getProperty("PhotoName", ""));
    var file = Components.classes["@mozilla.org/network/io-service;1"]
                         .getService(Components.interfaces.nsIIOService)
                         .newURI(originalPhotoURI, null, null)
                         .QueryInterface(Components.interfaces.nsIFileURL)
                         .file;
    if (file) {
      document.getElementById("PhotoFile").file = file;
      updatePhoto("file");
    }
    else
      updatePhoto("generic");
  }
  else if (type == "web") {
    originalPhotoURI = getPhotoURI(cardproperty.getProperty("PhotoName", ""));
    document.getElementById("PhotoURI").value = originalPhotoURI;
    updatePhoto("web");
  }
  else {
    originalPhotoURI = cardproperty.getProperty("PhotoURI", "");
    if (originalPhotoURI)
      document.getElementById("GenericPhotoList").value = originalPhotoURI;
    updatePhoto("generic");
  }
}

// when the ab card dialog is being loaded to show a vCard,
// hide the fields which aren't supported
// by vCard so the user does not try to edit them.
function HideNonVcardFields()
{
  document.getElementById("homeTabButton").hidden = true;
  var i;
  for (i = kNonVcardFields.length; i-- > 0; )
    document.getElementById(kNonVcardFields[i]).collapsed = true;
  for (i = kPhoneticFields.length; i-- > 0; )
    document.getElementById(kPhoneticFields[i]).collapsed = true;
}

// Move the data from the dialog to the cardproperty to be stored in the database
// @Returns false - Some required data are missing (card values were not set);
//          true - Card values were set, or there is no card to set values on.
function CheckAndSetCardValues(cardproperty, doc, check)
{
  // If requested, check the required data presence.
  if (check && !CheckCardRequiredDataPresence(document))
    return false;

  if (!cardproperty)
    return true;

  for (var i = kVcardFields.length; i-- > 0; )
    cardproperty.setProperty(kVcardFields[i][1],
      doc.getElementById(kVcardFields[i][0]).value);

  // get the birthday information from the dialog
  var birthdayElem = doc.getElementById("Birthday");
  var birthMonth = birthdayElem.monthField.value;
  var birthDay = birthdayElem.dateField.value;
  var birthYear = doc.getElementById("BirthYear").value;

  // set the birth day, month, and year properties
  cardproperty.setProperty("BirthDay", birthDay);
  cardproperty.setProperty("BirthMonth", birthMonth);
  cardproperty.setProperty("BirthYear", birthYear);

  var popup = document.getElementById("PreferMailFormatPopup");
  if (popup)
    cardproperty.setProperty("PreferMailFormat", popup.value);
    
  var allowRemoteContentEl = document.getElementById("allowRemoteContent");
  if (allowRemoteContentEl)
    cardproperty.setProperty("AllowRemoteContent", allowRemoteContentEl.checked);

  // set phonetic fields if exist
  try {
    cardproperty.setProperty("PhoneticFirstName", doc.getElementById("PhoneticFirstName").value);
    cardproperty.setProperty("PhoneticLastName", doc.getElementById("PhoneticLastName").value);
  }
  catch (ex) {}

  var type = document.getElementById("PhotoType").selectedItem.id;
  var photoURI = originalPhotoURI;
  if (type == "file" && document.getElementById("PhotoFile").file)
    photoURI = "file://" + document.getElementById("PhotoFile").file.path;
  else if (type == "web" && document.getElementById("PhotoURI").value)
    photoURI = document.getElementById("PhotoURI").value;
  else {
    type = "generic";
    photoURI = document.getElementById("GenericPhotoList").value;
  }
  if (photoURI != originalPhotoURI) {
    // Store the original URI
    cardproperty.setProperty("PhotoURI", photoURI);
    // Remove the original, if any
    removePhoto(cardproperty.getProperty("PhotoName", null));
    // Save the photo if it isn't one of the generic photos
    if (type != "generic") {
      cardproperty.setProperty("PhotoType", "file");
      // Save the new file and store its URI as PhotoName 
      var file = savePhoto(photoURI);
      if (file)
        cardproperty.setProperty("PhotoName", file.leafName);
    }
    else
      cardproperty.setProperty("PhotoType", "generic");
  }
  return true;
}

function CleanUpWebPage(webPage)
{
  // no :// yet so we should add something
  if ( webPage.length && webPage.search("://") == -1 )
  {
    // check for missing / on http://
    if ( webPage.substr(0, 6) == "http:/" )
      return( "http://" + webPage.substr(6) );
    else
      return( "http://" + webPage );
  }
  else
    return(webPage);
}

// @Returns false - Some required data are missing;
//          true - All required data are present.
function CheckCardRequiredDataPresence(doc)
{
  // Bug 314995 We require at least one of the following fields to be
  // filled in: email address, first name, last name, display name,
  //            organization (company name).
  var primaryEmail = doc.getElementById("PrimaryEmail");
  if (primaryEmail.textLength == 0 &&
      doc.getElementById("FirstName").textLength == 0 &&
      doc.getElementById("LastName").textLength == 0 &&
      doc.getElementById("DisplayName").textLength == 0 &&
      doc.getElementById("Company").textLength == 0)
  {
    Components
      .classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService)
      .alert(
        window,
        gAddressBookBundle.getString("cardRequiredDataMissingTitle"),
        gAddressBookBundle.getString("cardRequiredDataMissingMessage"));

    return false;
  }

  // Simple checks that the primary email should be of the form |user@host|.
  // Note: if the length of the primary email is 0 then we skip the check
  // as some other field must have something as per the check above.
  if (primaryEmail.textLength != 0 && !/.@./.test(primaryEmail.value))
  {
    Components
      .classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService)
      .alert(
        window,
        gAddressBookBundle.getString("incorrectEmailAddressFormatTitle"),
        gAddressBookBundle.getString("incorrectEmailAddressFormatMessage"));

    // Focus the dialog field, to help the user.
    document.getElementById("abTabs").selectedIndex = 0;
    primaryEmail.focus();

    return false;
  }

  return true;
}

function GenerateDisplayName()
{
  if (!gEditCard.generateDisplayName)
    return;

  var displayName;

  var firstNameValue = document.getElementById("FirstName").value;
  var lastNameValue = document.getElementById("LastName").value;
  if (lastNameValue && firstNameValue) {
    displayName = (gEditCard.displayLastNameFirst)
      ? gAddressBookBundle.getFormattedString("lastFirstFormat", [lastNameValue, firstNameValue])
      : gAddressBookBundle.getFormattedString("firstLastFormat", [firstNameValue, lastNameValue]);
  }
  else {
    // one (or both) of these is empty, so this works.
    displayName = firstNameValue + lastNameValue;
  }

  document.getElementById("DisplayName").value = displayName;

  SetCardDialogTitle(displayName);
}

function DisplayNameChanged()
{
  // turn off generateDisplayName if the user changes the display name
  gEditCard.generateDisplayName = false;

  SetCardDialogTitle(document.getElementById("DisplayName").value);
}

function SetCardDialogTitle(displayName)
{
  document.title = displayName
    ? gAddressBookBundle.getFormattedString(gEditCard.titleProperty + "WithDisplayName", [displayName])
    : gAddressBookBundle.getString(gEditCard.titleProperty);
}

/**
 * Calculates the duration of time between an event and now and updates the year
 * of whichever element did not call this function.
 * @param aEvent   The event calling this method.
 * @param aElement Optional, but required if this function is not called from an
 *                 element's event listener. The element that would call this.
 */
function calculateAge(aEvent, aElement) {
  var datepicker, yearElem, ageElem;
  if (aEvent)
    aElement = this;
  if (aElement.id == "BirthYear" || aElement.id == "Birthday") {
    datepicker = document.getElementById("Birthday");
    yearElem = document.getElementById("BirthYear");
    ageElem = document.getElementById("Age");
  }
  if (!datepicker || !yearElem || !ageElem)
    return;

  // if the datepicker was updated, update the year element
  if (aElement == datepicker && !(datepicker.year == kDefaultYear && !yearElem.value))
    yearElem.value = datepicker.year;
  var year = yearElem.value;
  // if the year element's value is invalid set the year and age elements to null
  if (isNaN(year) || year < 1 || year > 9999) {
    yearElem.value = null;
    ageElem.value = null;
    datepicker.year = kDefaultYear;
    return;
  }
  else if (aElement == yearElem)
    datepicker.year = year;
  // calculate the length of time between the event and now
  try {
    var event = new Date(datepicker.year, datepicker.month, datepicker.date);
    // if the year is only 2 digits, then the year won't be set correctly
    // using setFullYear fixes this issue
    event.setFullYear(datepicker.year);
    // get the difference between today and the event
    var age = new Date(new Date() - event);
    // get the number of years of the difference and subtract 1970 (epoch)
    ageElem.value = age.getFullYear() - 1970;
  }
  catch(e) {
    datepicker.year = kDefaultYear;
    // if there was an error (like invalid year) set the year and age to null
    yearElem.value = null;
    ageElem.value = null;
  }
}

/**
 * Calculates the year an event ocurred based on the number of years, months,
 * and days since the event and updates the relevant element.
 * @param aEvent   The event calling this method.
 * @param aElement Optional, but required if this function is not called from an
 *                 element's event listener. The element that would call this.
 */
function calculateYear(aEvent, aElement) {
  var yearElem, datepicker;
  if (aEvent)
    aElement = this;
  if (aElement.id == "Age") {
    yearElem = document.getElementById("BirthYear");
    datepicker = document.getElementById("Birthday");
  }
  if (!yearElem || !datepicker)
    return;

  // if the age is null, remove the year from the year element, and set the
  // datepicker to the default year
  if (!aElement.value) {
    datepicker.year = kDefaultYear;
    yearElem.value = null;
    return;
  }
  var today = new Date();
  try {
    var date = new Date(aElement.value, datepicker.month, datepicker.date);
    date.setFullYear(aElement.value);
    // get the difference between today and the age (the year is offset by 1970)
    var difference = new Date(today - date);
    datepicker.year = yearElem.value = difference.getFullYear() - 1970;
  }
  // the above code may throw an invalid year exception.  If that happens, set
  // the year to kDefaultYear and set the year element's value to 0
  catch (e) {
    datepicker.year = kDefaultYear;
    // if there was an error (like invalid year) set the year and age to null
    yearElem.value = null;
    ageElem.value = null;
  }
}

/**
 * Modifies a datepicker in the following ways:
 *  - Removes the scroll arrows
 *  - Hides the year
 *  - Allows the day and month to be blank
 * NOTE:
 * The datepicker's date, month, year, and dateValue properties are not always
 * what appear physically to the user in the datepicker fields.
 * If any field is blank, the corresponding property is either the previous
 * value if there was one since the card was opened or the relevant portion of
 * the current date.
 * 
 * To get the displayed values, get the value of the individual field, such as
 * datepicker.yyyyField.value where yyyy is "year", "month", or "date" for the
 * year, month, and day, respectively.
 * If the value is null, then the field is blank and vice versa.
 * @param aDatepicker The datepicker to modify.
 */
function modifyDatepicker(aDatepicker) {
  // collapse the year field and separator
  aDatepicker.yearField.parentNode.collapsed = true;
  if (aDatepicker.yearField == aDatepicker._fieldThree ||
      aDatepicker.yearField == aDatepicker._fieldTwo)
    aDatepicker._separatorSecond.collapsed = true;
  else
    aDatepicker._separatorFirst.collapsed = true;
  // collapse the spinner element
  document.getAnonymousElementByAttribute(aDatepicker, "anonid", "buttons")
          .collapsed = true;
  // this modified constrain value function ignores values less than the minimum
  // to let the value be blank (null)
  // from: mozilla/toolkit/content/widgets/datetimepicker.xml#759
  aDatepicker._constrainValue = function newConstrainValue(aField, aValue, aNoWrap) {
    // if the value is less than one, make the field's value null
    if (aValue < 1) {
      aField.value = null;
      return null;
    }
    if (aNoWrap && aField == this.monthField)
      aValue--;
    // make sure the date is valid for the given month
    if (aField == this.dateField) {
      var currentMonth = this.month;
      var dt = new Date(this.year, currentMonth, aValue);
      return dt.getMonth() != currentMonth ? 1 : aValue;
    }
    var max = (aField == this.monthField) ? 11 : 9999;
    // make sure the value isn't too high
    if (aValue > max)
      return aNoWrap ? max : min;
    return aValue;
  }
  // sets the specified field to the given value, but allows blank fields
  // from: mozilla/toolkit/content/widgets/datetimepicker.xml#698
  aDatepicker._setFieldValue = function setValue(aField, aValue) {
    if (aField == this.yearField && aValue > 0 && aValue < 10000) {
      var oldDate = this._dateValue;
      this._dateValue.setFullYear(aValue);
      if (oldDate != this._dateValue) {
        this._dateValue.setDate(0);
        this._updateUI(this.dateField, this.date);
      }
    }
    // update the month if the value isn't null
    else if (aField == this.monthField && aValue != null) {
      var oldDate = this.date;
      this._dateValue.setMonth(aValue);
      if (oldDate != this.date)
        this._dateValue.setDate(0);
      this._updateUI(this.dateField, this.date);
      var date = this._dateValue.getDate();
      this.dateField.value = date < 10 && this.dateLeadingZero ? "0" + date : date;
      var month = this._dateValue.getMonth() + 1;
      this.monthField.value = month < 10 && this.monthLeadingZero ? "0" + month : month;
    }
    // update the date if the value isn't null
    else if (aField == this.dateField && aValue != null) {
      this._dateValue.setDate(aValue);
      this._updateUI(this.dateField, this.date);
      var date = this._dateValue.getDate();
      this.dateField.value = date < 10 && this.dateLeadingZero ? "0" + date : date;
      var month = this._dateValue.getMonth() + 1;
      this.monthField.value = month < 10 && this.monthLeadingZero ? "0" + month : month;
    }
    this.setAttribute("value", this.value);

    if (this.attachedControl)
      this.attachedControl._setValueNoSync(this._dateValue);
    // if the aField's value is null or 0, set both field's values to null
    if (!aField.value && aField != this.yearField) {
      this.dateField.value = null;
      this.monthField.value = null;
    }
    // make the field's value null if aValue is null and the field's value isn't
    if (aValue == null && aField.value != null)
      aField.value = null;
  }
}

/**
 * Updates the photo by setting the src attribute of the photo element.
 *
 * @param aType Optional. The type of photo (web, file, or generic).
 *              If supplied the corresponding radio button will be selected.
 *              If not supplied the type will be determined by the currently
 *              selected type.
 */
function updatePhoto(aType) {
  if (aType) {
    // Select the type's radio button
    document.getElementById("PhotoType").selectedItem =
      document.getElementById(aType);
  }
  else
    aType = document.getElementById("PhotoType").selectedItem.id;

  var value;
  if (aType == "file") {
    var file = document.getElementById("PhotoFile").file;
    value = file ? "file://" + file.path : "";
  }
  else if (aType == "web")
    value = document.getElementById("PhotoURI").value;
  else
    value = document.getElementById("GenericPhotoList").value;
  document.getElementById("photo").setAttribute("src", value ? value
                                                             : defaultPhotoURI);
}

/**
 * Removes the photo file at the given path, if present.
 *
 * @param aName The name of the photo to remove from the Photos directory.
 *
 * @return true if the file was deleted.
 */
function removePhoto(aName) {
  if (!aName)
    return false;
  // Get the directory with all the photos
  var file = getPhotosDir();
  // Get the photo (throws an exception for invalid names)
  try {
    file.append(aName);
  }
  catch (e) {
    return false;
  }
  if (file.exists()) {
    try {
      file.remove(false);
      return true;
    }
    catch (e) {}
  }
  return false;
}

/**
 * Opens a file picker with image filters to look for a contact photo.
 * If the user selects a file and clicks OK then the PhotoURI textbox is set
 * with a file URI pointing to that file and updatePhoto is called.
 *
 * @return true if the OK button was clicked and a photo was chosen
 */
function browsePhoto() {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  fp.init(window, gAddressBookBundle.getString("browsePhoto"), nsIFilePicker.modeOpen);
  
  // Add All Files & Image Files filters and select the latter
  fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterImages);
  fp.filterIndex = 1;

  if (fp.show() == nsIFilePicker.returnOK) {
    document.getElementById("PhotoFile").file = fp.file;
    updatePhoto("file");
    return true;
  }
  return false;
}
