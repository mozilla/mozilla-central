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
* The Original Code is Mozilla Communicator client code, released
* March 31, 1998.
*
* The Initial Developer of the Original Code is
* Netscape Communications Corporation.
* Portions created by the Initial Developer are Copyright (C) 1998-1999
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Jason Eager <jce2@po.cwru.edu>

* Alternatively, the contents of this file may be used under the terms of
* either of the GNU General Public License Version 2 or later (the "GPL"),
* or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

function Startup()
{ 
  var urlbarHistButton = document.getElementById("ClearUrlBarHistoryButton");
  var lastUrlPref = document.getElementById("general.open_location.last_url");
  try {
    var isBtnDisabled = lastUrlPref.locked;
    if (!isBtnDisabled && !lastUrlPref.hasUserValue) {
      var file = Components.classes["@mozilla.org/file/directory_service;1"]
                           .getService(Components.interfaces.nsIProperties)
                           .get("ProfD", Components.interfaces.nsIFile);
      file.append("urlbarhistory.sqlite");
      if (!file.exists())
        isBtnDisabled = true;
      else {
        var connection = Components.classes["@mozilla.org/storage/service;1"]
                                   .getService(Components.interfaces.mozIStorageService)
                                   .openDatabase(file);
        isBtnDisabled = !connection.tableExists("urlbarhistory");
        connection.close();
      }
    }
    urlbarHistButton.disabled = isBtnDisabled;
  }
  catch(ex) {
  }
    
  var globalHistButton = document.getElementById("browserClearHistory");
  var globalHistory = Components.classes["@mozilla.org/browser/global-history;2"]
                                .getService(Components.interfaces.nsIBrowserHistory);
  if (globalHistory.count == 0)
    globalHistButton.disabled = true;
}

function prefClearGlobalHistory()
{
  var globalHistory = Components.classes["@mozilla.org/browser/global-history;2"]
                                .getService(Components.interfaces.nsIBrowserHistory);
  globalHistory.removeAllPages();
}

function prefClearUrlbarHistory()
{
  document.getElementById("general.open_location.last_url").valueFromPreferences = "";
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties)
                       .get("ProfD", Components.interfaces.nsIFile);
  file.append("urlbarhistory.sqlite");
  if (file.exists())
    file.remove(false);
}
