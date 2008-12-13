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
# The Original Code is Mozilla Addressbook.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corp.
# Portions created by the Initial Developer are Copyright (C) 1999-2001
# the Initial Developer. All Rights Reserved.
#
# Original Author:
#   Paul Hangas <hangas@netscape.com>
#
# Contributor(s):
#   Seth Spitzer <sspitzer@netscape.com>
#   Mark Banner <mark@standard8.demon.co.uk>
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

var dirTree = 0;
var abList = 0;
var gAbResultsTree = null;
var gAbView = null;
var gAddressBookBundle;

var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
var gPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
var gHeaderParser = Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser);

const kDefaultSortColumn = "GeneratedName";
const kDefaultAscending = "ascending";
const kDefaultDescending = "descending";
const kLdapUrlPrefix = "moz-abldapdirectory://";
const kPersonalAddressbookURI = "moz-abmdbdirectory://abook.mab";
const kCollectedAddressbookURI = "moz-abmdbdirectory://history.mab";

// Controller object for Dir Pane
var DirPaneController =
{
  supportsCommand: function(command)
  {
    switch (command) {
      case "cmd_selectAll":
      case "cmd_delete":
      case "button_delete":
      case "button_edit":
      case "cmd_printcard":
      case "cmd_printcardpreview":
      case "cmd_newlist":
        return true;
      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    var selectedDir;

    switch (command) {
      case "cmd_selectAll":
        // the dirTree pane
        // only handles single selection
        // so we forward select all to the results pane
        // but if there is no gAbView
        // don't bother sending to the results pane
        return (gAbView != null);
      case "cmd_delete":
      case "button_delete":
        var selectedDir = GetSelectedDirectory();
        if (command == "cmd_delete" && selectedDir)
          goSetMenuValue(command, GetDirectoryFromURI(selectedDir).isMailList ?
                                  "valueList" : "valueAddressBook");

        if (selectedDir &&
	    (selectedDir != kPersonalAddressbookURI) &&
	    (selectedDir != kCollectedAddressbookURI)) {
          // If the directory is a mailing list, and it is read-only, return
          // false.
          var abDir = GetDirectoryFromURI(selectedDir);
          if (abDir.isMailList && abDir.readOnly)
            return false;

          // If the selected directory is an ldap directory
          // and if the prefs for this directory are locked
          // disable the delete button.
          if (selectedDir.lastIndexOf(kLdapUrlPrefix, 0) == 0)
          {
            var disable = false;
            try {
              var prefName = selectedDir.substr(kLdapUrlPrefix.length);
              disable = gPrefs.getBoolPref(prefName + ".disable_delete");
            }
            catch(ex) {
              // if this preference is not set its ok.
            }
            if (disable)
              return false;
          }
          return true;
        }
        else
          return false;
      case "cmd_printcard":
      case "cmd_printcardpreview":
        return (GetSelectedCardIndex() != -1);
      case "button_edit":
        return (GetSelectedDirectory() != null);
      case "cmd_newlist":
        selectedDir = GetSelectedDirectory();
        if (selectedDir) {
          var abDir = GetDirectoryFromURI(selectedDir);
          if (abDir) {
            return abDir.supportsMailingLists;
          }
        }
        return false;
      default:
        return false;
    }
  },

  doCommand: function(command)
  {
    switch (command) {
      case "cmd_printcard":
      case "cmd_printcardpreview":
      case "cmd_selectAll":
        SendCommandToResultsPane(command);
        break;
      case "cmd_delete":
      case "button_delete":
        if (dirTree)
          AbDeleteSelectedDirectory();
        break;
      case "button_edit":
        AbEditSelectedDirectory();
        break;
      case "cmd_newlist":
        AbNewList();
        break;
    }
  },

  onEvent: function(event)
  {
    // on blur events set the menu item texts back to the normal values
    if (event == "blur")
      goSetMenuValue("cmd_delete", "valueDefault");
  }
};

function SendCommandToResultsPane(command)
{
  ResultsPaneController.doCommand(command);

  // if we are sending the command so the results pane
  // we should focus the results pane
  gAbResultsTree.focus();
}

function AbNewLDAPDirectory()
{
  window.openDialog("chrome://messenger/content/addressbook/pref-directory-add.xul",
                    "",
                    "chrome,modal=yes,resizable=no,centerscreen",
                    null);
}

function AbNewAddressBook()
{
  window.openDialog(
    "chrome://messenger/content/addressbook/abAddressBookNameDialog.xul",
    "", "chrome,modal=yes,resizable=no,centerscreen", null);
}

function AbEditSelectedDirectory()
{
  if (dirTree.view.selection.count == 1) {
    var selecteduri = GetSelectedDirectory();
    var directory = GetDirectoryFromURI(selecteduri);
    if (directory.isMailList) {
      var dirUri = GetParentDirectoryFromMailingListURI(selecteduri);
      goEditListDialog(null, selecteduri);
    }
    else {
      window.openDialog(directory.propertiesChromeURI,
                        "editDirectory", "chrome,modal=yes,resizable=no",
                        {selectedDirectory: directory});
    }
  }
}

function AbDeleteSelectedDirectory()
{
  var selectedABURI = GetSelectedDirectory();
  if (!selectedABURI)
    return;

  AbDeleteDirectory(selectedABURI);
}

function AbDeleteDirectory(aURI)
{
  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

  var directory = GetDirectoryFromURI(aURI);
  var confirmDeleteMessage;
  var clearPrefsRequired = false;

  if (directory.isMailList)
    confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteMailingList");
  else {
    // Check if this address book is being used for collection
    if (gPrefs.getCharPref("mail.collect_addressbook") == aURI &&
        gPrefs.getBoolPref("mail.collect_email_address_outgoing")) {
      var brandShortName = document.getElementById("bundle_brand").getString("brandShortName");

      confirmDeleteMessage = gAddressBookBundle.getFormattedString("confirmDeleteCollectionAddressbook", [brandShortName]);
      clearPrefsRequired = true;
    }
    else {
      confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteAddressbook");
    }
  }

  if (!promptService.confirm(window,
                             gAddressBookBundle.getString(
                                                directory.isMailList ?
                                                "confirmDeleteMailingListTitle" :
                                                "confirmDeleteAddressbookTitle"),
                             confirmDeleteMessage))
    return;

  // First clear/reset the prefs if required
  if (clearPrefsRequired) {
    gPrefs.setBoolPref("mail.collect_email_address_outgoing", false);

    // Also reset the displayed value so that we don't get a blank item in the
    // prefs dialog if it gets enabled.
    gPrefs.setCharPref("mail.collect_addressbook", kPersonalAddressbookURI);
  }

  Components.classes["@mozilla.org/abmanager;1"]
            .getService(Components.interfaces.nsIAbManager)
            .deleteAddressBook(aURI);
}

function GetParentRow(aTree, aRow)
{
  var row = aRow;
  var level = aTree.view.getLevel(row);
  var parentLevel = level;
  while (parentLevel >= level) {
    row--;
    if (row == -1)
      return row;
    parentLevel = aTree.view.getLevel(row);
  }
  return row;
}

function InitCommonJS()
{
  dirTree = document.getElementById("dirTree");
  abList = document.getElementById("addressbookList");
  gAddressBookBundle = document.getElementById("bundle_addressBook");
}

function AbDelete()
{
  var types = GetSelectedCardTypes();
  if (types == kNothingSelected)
    return;

  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  // If at least one mailing list is selected then prompt users for deletion.
  if (types != kCardsOnly)
  {
    var confirmDeleteMessage;
    if (types == kListsAndCards)
      confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteListsAndContacts");
    else if (types == kMultipleListsOnly)
      confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteMailingLists");
    else
      confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteMailingList");
    if (!promptService.confirm(window, null, confirmDeleteMessage))
      return;
  }

  gAbView.deleteSelectedCards();
}

function AbNewCard()
{
  goNewCardDialog(GetSelectedDirectory());
}

function AbEditCard(card)
{
  // Need a card,
  // but not allowing AOL special groups to be edited.
  if (!card)
    return;

  if (card.isMailList) {
    goEditListDialog(card, card.mailListURI);
  }
  else {
    goEditCardDialog(GetSelectedDirectory(), card);
  }
}

function AbNewMessage()
{
  var msgComposeType = Components.interfaces.nsIMsgCompType;
  var msgComposFormat = Components.interfaces.nsIMsgCompFormat;
  var msgComposeService = Components.classes["@mozilla.org/messengercompose;1"].getService();
  msgComposeService = msgComposeService.QueryInterface(Components.interfaces.nsIMsgComposeService);

  var params = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
  if (params)
  {
    params.type = msgComposeType.New;
    params.format = msgComposFormat.Default;
    var composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
    if (composeFields)
    {
      if (DirPaneHasFocus())
        composeFields.to = GetSelectedAddressesFromDirTree();
      else
        composeFields.to = GetSelectedAddresses();
      params.composeFields = composeFields;
      msgComposeService.OpenComposeWindowWithParams(null, params);
    }
  }
}

// XXX todo
// could this be moved into utilityOverlay.js?
function goToggleSplitter( id, elementID )
{
  var splitter = document.getElementById( id );
  var element = document.getElementById( elementID );
  if ( splitter )
  {
    var attribValue = splitter.getAttribute("state") ;
    if ( attribValue == "collapsed" )
    {
      splitter.setAttribute("state", "open" );
      if ( element )
        element.setAttribute("checked","true")
    }
    else
    {
      splitter.setAttribute("state", "collapsed");
      if ( element )
        element.setAttribute("checked","false")
    }
    document.persist(id, 'state');
    document.persist(elementID, 'checked');
  }
}

// Generate a list of cards from the selected mailing list
// and get a comma separated list of card addresses. If the
// item selected in the directory pane is not a mailing list,
// an empty string is returned.
function GetSelectedAddressesFromDirTree()
{
  var addresses = "";

  if (dirTree.currentIndex >= 0) {
    var selectedResource = dirTree.builderView.getResourceAtIndex(dirTree.currentIndex);
    var directory = GetDirectoryFromURI(selectedResource.Value);
    if (directory.isMailList) {
      var listCardsCount = directory.addressLists.length;
      var cards = new Array(listCardsCount);
      for (var i = 0; i < listCardsCount; ++i)
        cards[i] = directory.addressLists
                            .queryElementAt(i, Components.interfaces.nsIAbCard);
      addresses = GetAddressesForCards(cards);
    }
  }
  return addresses;
}

// Generate a comma separated list of addresses from a given
// set of cards.
function GetAddressesForCards(cards)
{
  var addresses = "";

  if (!cards)
    return addresses;

  var count = cards.length;
  if (count > 0)
    addresses += GenerateAddressFromCard(cards[0]);

  for (var i = 1; i < count; i++) {
    var generatedAddress = GenerateAddressFromCard(cards[i]);

    if (generatedAddress)
      addresses += "," + generatedAddress;
  }
  return addresses;
}

function SelectFirstAddressBook()
{
  dirTree.view.selection.select(0);

  ChangeDirectoryByURI(GetSelectedDirectory());
  gAbResultsTree.focus();
}

function DirPaneClick(event)
{
  // we only care about left button events
  if (event.button != 0)
    return;

  // if the user clicks on the header / trecol, do nothing
  if (event.originalTarget.localName == "treecol") {
    event.stopPropagation();
    return;
  }
}

function DirPaneDoubleClick(event)
{
  // we only care about left button events
  if (event.button != 0)
    return;

  var row = dirTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
  if (row == -1 || row > dirTree.view.rowCount-1) {
    // double clicking on a non valid row should not open the dir properties dialog
    return;
  }

  if (dirTree && dirTree.view.selection && dirTree.view.selection.count == 1)
    AbEditSelectedDirectory();
}

function DirPaneSelectionChange()
{
  // clear out the search box when changing folders...
  onClearSearch();
  if (dirTree && dirTree.view.selection && dirTree.view.selection.count == 1) {
    gPreviousDirTreeIndex = dirTree.currentIndex;
    ChangeDirectoryByURI(GetSelectedDirectory());
  }
  goUpdateCommand('cmd_newlist');
}

function ChangeDirectoryByURI(uri)
{
  if (!uri)
    uri = kPersonalAddressbookURI;

  SetAbView(uri);

  // only select the first card if there is a first card
  if (gAbView && gAbView.getCardFromRow(0))
    SelectFirstCard();
  else
    // the selection changes if we were switching directories.
    ResultsPaneSelectionChanged()
}

function AbNewList()
{
  goNewListDialog(GetSelectedDirectory());
}

function goNewListDialog(selectedAB)
{
  window.openDialog("chrome://messenger/content/addressbook/abMailListDialog.xul",
                    "",
                    "chrome,resizable=no,titlebar,modal,centerscreen",
                    {selectedAB:selectedAB});
}

function goEditListDialog(abCard, listURI)
{
  window.openDialog("chrome://messenger/content/addressbook/abEditListDialog.xul",
                    "",
                    "chrome,resizable=no,titlebar,modal,centerscreen",
                    {abCard:abCard, listURI:listURI});
}

function goNewCardDialog(selectedAB)
{
  window.openDialog("chrome://messenger/content/addressbook/abNewCardDialog.xul",
                    "",
                    "chrome,resizable=no,titlebar,modal,centerscreen",
                    {selectedAB:selectedAB});
}

function goEditCardDialog(abURI, card)
{
  window.openDialog("chrome://messenger/content/addressbook/abEditCardDialog.xul",
            "",
            "chrome,resizable=no,modal,titlebar,centerscreen",
            {abURI:abURI, card:card});
}


function setSortByMenuItemCheckState(id, value)
{
    var menuitem = document.getElementById(id);
    if (menuitem) {
      menuitem.setAttribute("checked", value);
    }
}

function InitViewSortByMenu()
{
    var sortColumn = kDefaultSortColumn;
    var sortDirection = kDefaultAscending;

    if (gAbView) {
      sortColumn = gAbView.sortColumn;
      sortDirection = gAbView.sortDirection;
    }

    // this approach is necessary to support generic columns that get overlayed.
    var elements = document.getElementsByAttribute("name","sortas");
    for (var i=0; i<elements.length; i++) {
        var cmd = elements[i].getAttribute("id");
        var columnForCmd = cmd.split("cmd_SortBy")[1];
        setSortByMenuItemCheckState(cmd, (sortColumn == columnForCmd));
    }

    setSortByMenuItemCheckState("sortAscending", (sortDirection == kDefaultAscending));
    setSortByMenuItemCheckState("sortDescending", (sortDirection == kDefaultDescending));
}

function GenerateAddressFromCard(card)
{
  if (!card)
    return "";

  var email;

  if (card.isMailList)
  {
    var directory = GetDirectoryFromURI(card.mailListURI);
    email = directory.description || card.displayName;
  }
  else
    email = card.primaryEmail;

  return gHeaderParser.makeFullAddress(card.displayName, email);
}

function GetDirectoryFromURI(uri)
{
  return rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
}

// returns null if abURI is not a mailing list URI
function GetParentDirectoryFromMailingListURI(abURI)
{
  var abURIArr = abURI.split("/");
  /*
   turn turn "moz-abmdbdirectory://abook.mab/MailList6"
   into ["moz-abmdbdirectory:","","abook.mab","MailList6"]
   then, turn ["moz-abmdbdirectory:","","abook.mab","MailList6"]
   into "moz-abmdbdirectory://abook.mab"
  */
  if (abURIArr.length == 4 && abURIArr[0] == "moz-abmdbdirectory:" && abURIArr[3] != "") {
    return abURIArr[0] + "/" + abURIArr[1] + "/" + abURIArr[2];
  }

  return null;
}

function DirPaneHasFocus()
{
  // returns true if diectory pane has the focus. Returns false, otherwise.
  return (top.document.commandDispatcher.focusedElement == dirTree)
}

function GetSelectedDirectory()
{
  if (abList)
    return abList.value;
  else {
    if (dirTree.currentIndex < 0)
      return null;
    var selected = dirTree.builderView.getResourceAtIndex(dirTree.currentIndex)
    return selected.Value;
  }
}

function onAbClearSearch()
{
  gSearchInput.value = "";
  onEnterInSearchBar();
}

function onSearchInputFocus(event)
{
  // search bar has focus, ...clear the showing search criteria flag
  if (gSearchInput.showingSearchCriteria)
  {
    gSearchInput.value = "";
    gSearchInput.showingSearchCriteria = false;
  }
}

// sets focus into the quick search box
function QuickSearchFocus()
{
  gSearchInput.focus();
  gSearchInput.select();
}

function onSearchInputBlur(event)
{
//  if (gQuickSearchFocusEl && gQuickSearchFocusEl.id == 'searchInput') // ignore the blur if we are in the middle of processing the clear button
//    return;

  if (!gSearchInput.value)
    gSearchInput.showingSearchCriteria = true;

  if (gSearchInput.showingSearchCriteria)
    gSearchInput.setSearchCriteriaText();
}

var gQuickSearchFocusEl = null;

function onClearSearch()
{
  if (gSearchInput && !gSearchInput.showingSearchCriteria) // ignore the text box value if it's just showing the search criteria string
  {
     onAbClearSearch();
     // this needs to be on a timer otherwise we end up messing up the focus while the Search("") is still happening
     setTimeout(restoreSearchFocusAfterClear, 0);
  }
}

function restoreSearchFocusAfterClear()
{
//  gQuickSearchFocusEl.focus();
  gSearchInput.clearButtonHidden = 'true';
  gQuickSearchFocusEl = null;
}

var gIsOffline;
var gSessionAdded;
var gCurrentAutocompleteDirectory;
var gAutocompleteSession;
var gSetupLdapAutocomplete;
var gLDAPSession;

function setupLdapAutocompleteSession()
{
    var autocompleteLdap = false;
    var autocompleteDirectory = null;
    var prevAutocompleteDirectory = gCurrentAutocompleteDirectory;
    var i;

    autocompleteLdap = gPrefs.getBoolPref("ldap_2.autoComplete.useDirectory");
    if (autocompleteLdap)
        autocompleteDirectory = gPrefs.getCharPref(
            "ldap_2.autoComplete.directoryServer");


    // use a temporary to do the setup so that we don't overwrite the
    // global, then have some problem and throw an exception, and leave the
    // global with a partially setup session.  we'll assign the temp
    // into the global after we're done setting up the session
    //
    var LDAPSession;
    if (gLDAPSession) {
        LDAPSession = gLDAPSession;
    } else {
        LDAPSession = Components.classes[
            "@mozilla.org/autocompleteSession;1?type=ldap"].createInstance()
            .QueryInterface(Components.interfaces.nsILDAPAutoCompleteSession);
    }

    if (autocompleteDirectory && !gIsOffline) {
        // the compose window code adds an observer on the directory server
        // prefs, but I don't think we need this here.
        gCurrentAutocompleteDirectory = autocompleteDirectory;

        // fill in the session params if there is a session
        //
        if (LDAPSession) {
            var serverURL = Components.classes[
                "@mozilla.org/network/ldap-url;1"].
                createInstance().QueryInterface(
                    Components.interfaces.nsILDAPURL);

            try {
                serverURL.spec = gPrefs.getComplexValue(autocompleteDirectory +".uri",
                                           Components.interfaces.nsISupportsString).data;
            } catch (ex) {
                dump("ERROR: " + ex + "\n");
            }
            LDAPSession.serverURL = serverURL;

            // get the login to authenticate as, if there is one
            //
            try {
		LDAPSession.login =gPrefs.getComplexValue(
                    autocompleteDirectory + ".auth.dn",
                    Components.interfaces.nsISupportsString).data;
            } catch (ex) {
                // if we don't have this pref, no big deal
            }

            // don't search on non-CJK strings shorter than this
            //
            try {
                LDAPSession.minStringLength = gPrefs.getIntPref(
                    autocompleteDirectory + ".autoComplete.minStringLength");
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default.
            }

            // don't search on CJK strings shorter than this
            //
            try {
                LDAPSession.cjkMinStringLength = gPrefs.getIntPref(
                  autocompleteDirectory + ".autoComplete.cjkMinStringLength");
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default.
            }

            // we don't try/catch here, because if this fails, we're outta luck
            //
            var ldapFormatter = Components.classes[
                "@mozilla.org/ldap-autocomplete-formatter;1?type=addrbook"]
                .createInstance().QueryInterface(
                    Components.interfaces.nsIAbLDAPAutoCompFormatter);

            // override autocomplete name format?
            //
            try {
                ldapFormatter.nameFormat =
                    gPrefs.getComplexValue(autocompleteDirectory +
                                      ".autoComplete.nameFormat",
                                      Components.interfaces.nsISupportsString).data;
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsAbLDAPAutoCompFormatter use its default.
            }

            // override autocomplete mail address format?
            //
            try {
                ldapFormatter.addressFormat =
                    gPrefs.getComplexValue(autocompleteDirectory +
                                      ".autoComplete.addressFormat",
                                      Components.interfaces.nsISupportsString).data;
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsAbLDAPAutoCompFormatter use its default.
            }

            try {
                // figure out what goes in the comment column, if anything
                //
                // 0 = none
                // 1 = name of addressbook this card came from
                // 2 = other per-addressbook format
                //
                var showComments = 0;
                showComments = gPrefs.getIntPref(
                    "mail.autoComplete.commentColumn");

                switch (showComments) {

                case 1:
                    // use the name of this directory
                    //
                    ldapFormatter.commentFormat = gPrefs.getComplexValue(
                                autocompleteDirectory + ".description",
                                Components.interfaces.nsISupportsString).data;
                    break;

                case 2:
                    // override ldap-specific autocomplete entry?
                    //
                    try {
                        ldapFormatter.commentFormat =
                            gPrefs.getComplexValue(autocompleteDirectory +
                                        ".autoComplete.commentFormat",
                                        Components.interfaces.nsISupportsString).data;
                    } catch (innerException) {
                        // if nothing has been specified, use the ldap
                        // organization field
                        ldapFormatter.commentFormat = "[o]";
                    }
                    break;

                case 0:
                default:
                    // do nothing
                }
            } catch (ex) {
                // if something went wrong while setting up comments, try and
                // proceed anyway
            }

            // set the session's formatter, which also happens to
            // force a call to the formatter's getAttributes() method
            // -- which is why this needs to happen after we've set the
            // various formats
            //
            LDAPSession.formatter = ldapFormatter;

            // override autocomplete entry formatting?
            //
            try {
                LDAPSession.outputFormat =
                    gPrefs.getComplexValue(autocompleteDirectory +
                                      ".autoComplete.outputFormat",
                                      Components.interfaces.nsISupportsString).data;

            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default.
            }

            // override default search filter template?
            //
            try {
                LDAPSession.filterTemplate = gPrefs.getComplexValue(
                    autocompleteDirectory + ".autoComplete.filterTemplate",
                    Components.interfaces.nsISupportsString).data;

            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default
            }

            // override default maxHits (currently 100)
            //
            try {
                // XXXdmose should really use .autocomplete.maxHits,
                // but there's no UI for that yet
                //
                LDAPSession.maxHits =
                    gPrefs.getIntPref(autocompleteDirectory + ".maxHits");
            } catch (ex) {
                // if this pref isn't there, or is out of range, no big deal.
                // just let nsLDAPAutoCompleteSession use its default.
            }

            if (!gSessionAdded) {
                // if we make it here, we know that session initialization has
                // succeeded; add the session for all recipients, and
                // remember that we've done so
                var autoCompleteWidget;
                for (i=1; i <= awGetMaxRecipients(); i++)
                {
                    autoCompleteWidget = document.getElementById("addressCol1#" + i);
                    if (autoCompleteWidget)
                    {
                      autoCompleteWidget.addSession(LDAPSession);
                      // ldap searches don't insert a default entry with the default domain appended to it
                      // so reduce the minimum results for a popup to 2 in this case.
                      autoCompleteWidget.minResultsForPopup = 2;

                    }
                 }
                gSessionAdded = true;
            }
        }
    } else {
      if (gCurrentAutocompleteDirectory) {
        gCurrentAutocompleteDirectory = null;
      }
      if (gLDAPSession && gSessionAdded) {
        for (i=1; i <= awGetMaxRecipients(); i++)
          document.getElementById("addressCol1#" + i).
              removeSession(gLDAPSession);
        gSessionAdded = false;
      }
    }

    gLDAPSession = LDAPSession;
    gSetupLdapAutocomplete = true;
}
