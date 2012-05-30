/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{ 
  var urlbarHistButton = document.getElementById("ClearUrlBarHistoryButton");
  var lastUrlPref = document.getElementById("general.open_location.last_url");
  try {
    var isBtnDisabled = lastUrlPref.locked;
    if (!isBtnDisabled && !lastUrlPref.hasUserValue) {
      var file = GetUrlbarHistoryFile();
      if (!file.exists())
        isBtnDisabled = true;
      else {
        var connection = Services.storage.openDatabase(file);
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
  var file = GetUrlbarHistoryFile();
  if (file.exists())
    file.remove(false);
}
