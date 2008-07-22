var gPrefInt = null;
var gAvailDirectories = null;
var gCurrentDirectoryServer = null;
var gCurrentDirectoryServerId = null;
var gRefresh = false;
var gNewServer = null;
var gNewServerString = null;
var gUpdate = false;
var gDeletedDirectories = new Array();
var gLDAPPrefsService;

function initLDAPPrefsService()
{
  if (gLDAPPrefsService)
    return;

  const LDAP_PREF_CONTRACT="@mozilla.org/ldapprefs-service;1";
  if (LDAP_PREF_CONTRACT in Components.classes)
  {
    gLDAPPrefsService = Components.classes[LDAP_PREF_CONTRACT].getService(Components.interfaces.nsILDAPPrefsService);
  }
}

function onEditDirectories()
{
  window.openDialog("chrome://messenger/content/addressbook/pref-editdirectories.xul",
                    "editDirectories", "chrome,modal=yes,resizable=no", null);
  if (gRefresh)
  {
    var popup = document.getElementById("directoriesListPopup"); 
    if (popup) 
    { 
       while (popup.hasChildNodes())
         popup.removeChild(popup.lastChild);
    } 
    gAvailDirectories = null;
    LoadDirectories(popup);
    gRefresh = false;
  }
}

function enableAutocomplete()
{
  var autocompleteLDAP = document.getElementById("autocompleteLDAP");  
  var directoriesList =  document.getElementById("directoriesList"); 
  var directoriesListPopup = document.getElementById("directoriesListPopup");
  var editButton = document.getElementById("editButton");
//  var autocompleteSkipDirectory = document.getElementById("autocompleteSkipDirectory");

  if (autocompleteLDAP.checked) {
    // If the default directory preference is locked 
    // disable the list popup
    if (gPrefInt.prefIsLocked("ldap_2.autoComplete.directoryServer")) {
      directoriesList.setAttribute("disabled", true);
      directoriesListPopup.setAttribute("disabled", true);
    }
    else {
      directoriesList.removeAttribute("disabled");
      directoriesListPopup.removeAttribute("disabled");
    } 
    editButton.removeAttribute("disabled");
//    autocompleteSkipDirectory.removeAttribute("disabled");
  }
  else {
    directoriesList.setAttribute("disabled", true);
    directoriesListPopup.setAttribute("disabled", true);
    editButton.setAttribute("disabled", true);
//    autocompleteSkipDirectory.setAttribute("disabled", true);
  }
  // if we do not have any directories disable the dropdown list box
  if (!gAvailDirectories || (gAvailDirectories.length < 1))
    directoriesList.setAttribute("disabled", true);
  LoadDirectories(directoriesListPopup);
}

function setupDirectoriesList()
{
  var override = document.getElementById("identity.overrideGlobalPref").getAttribute("value");
  var autocomplete = document.getElementById("ldapAutocomplete");
  // useGlobalFlag is set when user changes the selectedItem on the radio button and switches
  // to a different pane and switches back in Mail/news AccountSettings
  var useGlobalFlag = document.getElementById("overrideGlobalPref").getAttribute("value");
  // directoryServerFlag is set when user changes the server to None and switches
  // to a different pane and switches back in Mail/news AccountSettings
  var directoryServerFlag = document.getElementById("directoryServer").getAttribute("value");

  if(override == "true" && !useGlobalFlag)
    autocomplete.selectedItem = document.getElementById("directories");
  else
    autocomplete.selectedItem = document.getElementById("useGlobalPref");

  var directoriesList = document.getElementById("directoriesList");
  var directoryServer = 
        document.getElementById("identity.directoryServer").getAttribute('value');
  if (directoryServerFlag) {
    document.getElementById("identity.directoryServer").setAttribute("value", "");
    directoryServer = "";
  }
  directoriesList.value = directoryServer;
}

function createDirectoriesList()
{
  var directoriesListPopup = document.getElementById("directoriesListPopup");

  if (directoriesListPopup) {
    LoadDirectories(directoriesListPopup);
  }
}

function LoadDirectories(popup)
{
  var prefCount = {value:0};
  var description = "";
  var item;
  var j=0;
  var arrayOfDirectories;
  var position;
  var dirType;
  if (!gPrefInt) { 
    try {
      gPrefInt = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch);
    }
    catch (ex) {
      gPrefInt = null;
    }
  }
  if (!gAvailDirectories) {
    try {
      initLDAPPrefsService();
      if (gLDAPPrefsService)
        arrayOfDirectories = gLDAPPrefsService.getServerList(gPrefInt, prefCount);
    }
    catch (ex) {
    }
  if (arrayOfDirectories) {
    gAvailDirectories = new Array();
    for (var i = 0; i < prefCount.value; i++)
    {
      if ((arrayOfDirectories[i] != "ldap_2.servers.pab") && 
        (arrayOfDirectories[i] != "ldap_2.servers.history")) {
        try{
          position = gPrefInt.getIntPref(arrayOfDirectories[i]+".position");
        }
        catch(ex){
          position = 1;
        }
        try{
          dirType = gPrefInt.getIntPref(arrayOfDirectories[i]+".dirType");
        }
        catch(ex){
          dirType = 1;
        }
        if ((position != 0) && (dirType == 1)) {
          try{
            description = gPrefInt.getComplexValue(arrayOfDirectories[i]+".description",
                                                   Components.interfaces.nsISupportsString).data;
          }
          catch(ex){
            description="";
          }
          if (description != "") {
            if (popup) {
              item=document.createElement("menuitem");
              item.setAttribute("label", description);
              item.setAttribute("value", arrayOfDirectories[i]);
              popup.appendChild(item);
            }
            gAvailDirectories[j++] = {value:arrayOfDirectories[i], label:description};
          }
        }
      }
    }
    if (popup)
    {
      // we are in mail/news Account settings
      item = document.createElement("menuitem");
      var addressBookBundle = document.getElementById("bundle_addressBook");
      var directoryName = addressBookBundle.getString("directoriesListItemNone");
      item.setAttribute("label", directoryName);
      item.setAttribute("value", "");
      popup.appendChild(item);

      // Now check what we are displaying is valid.
      var directoriesList = document.getElementById("directoriesList");
      var value = directoriesList.value;
      directoriesList.selectedItem = null;
      directoriesList.value = value;
      if (!directoriesList.selectedItem) {
        directoriesList.value = "";
        // If we have no other directories, also disable the popup.
        if (gAvailDirectories.length == 0)
          directoriesList.disabled = true;
      }
      // Only enable autocomplete if the pref isn't locked.
      else if (!gPrefInt.prefIsLocked("ldap_2.autoComplete.directoryServer"))
        directoriesList.disabled = false;
    }
  }
  }
}

function LoadDirectoriesList(listbox)
{
  LoadDirectories();
  if (listbox && gAvailDirectories)
  {
    for (var i=0; i<gAvailDirectories.length; i++)
    {
      var item = document.createElement('listitem');

      item.setAttribute('label', gAvailDirectories[i].label);
      item.setAttribute('string', gAvailDirectories[i].value);

      listbox.appendChild(item);
    }
  }
}
