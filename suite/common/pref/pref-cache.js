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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * .
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Diego Biurrun   <diego@biurrun.de>
 *   Manuel Reimer <Manuel.Reimer@gmx.de>
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

// because the cache is in kilobytes, and the UI is in megabytes.
function ReadCacheDiskCapacity()
{
  var pref = document.getElementById("browser.cache.disk.capacity");
  return pref.value >> 10;
}

function WriteCacheDiskCapacity(aField)
{
  return aField.value << 10;
}

function ReadCacheFolder(aField)
{
  var pref = document.getElementById("browser.cache.disk.parent_directory");
  var file = pref.value;

  if (!file)
  {
    try
    {
      // no disk cache folder pref set; default to profile directory
      var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"]
                             .getService(Components.interfaces.nsIProperties);
      if (dirSvc.has("ProfLD"))
        file = dirSvc.get("ProfLD", Components.interfaces.nsILocalFile);
      else
        file = dirSvc.get("ProfD", Components.interfaces.nsILocalFile);
    }
    catch (ex) {}
  }

  if (file)
  {
    aField.file = file;
    aField.label = (/Mac/.test(navigator.platform)) ? file.leafName : file.path;
  }
}

function CacheSelectFolder()
{
  var pref = document.getElementById("browser.cache.disk.parent_directory");
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  var prefutilitiesBundle = document.getElementById("bundle_prefutilities");
  var title = prefutilitiesBundle.getString("cachefolder");

  fp.init(window, title, nsIFilePicker.modeGetFolder);
  fp.displayDirectory = pref.value;
  fp.appendFilters(nsIFilePicker.filterAll);
  if (fp.show() == nsIFilePicker.returnOK)
    pref.value = fp.file;
}

function ClearDiskAndMemCache()
{
  Components.classes["@mozilla.org/network/cache-service;1"]
            .getService(Components.interfaces.nsICacheService)
            .evictEntries(Components.interfaces.nsICache.STORE_ANYWHERE);
}
