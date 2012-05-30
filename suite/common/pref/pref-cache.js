/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/DownloadUtils.jsm");

function Startup()
{
  updateActualCacheSize();
}

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
      file = GetSpecialDirectory(Services.dirsvc.has("ProfLD") ? "ProfLD"
                                                               : "ProfD");
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
  updateActualCacheSize();
}

function updateCacheSizeUI(cacheSizeEnabled)
{
  document.getElementById("browserCacheDiskCacheBefore").disabled = cacheSizeEnabled;
  document.getElementById("browserCacheDiskCache").disabled = cacheSizeEnabled;
  document.getElementById("browserCacheDiskCacheAfter").disabled = cacheSizeEnabled;
}

function ReadSmartSizeEnabled()
{
  var enabled = document.getElementById("browser.cache.disk.smart_size.enabled").value;
  updateCacheSizeUI(enabled);
  return enabled;
}

function updateActualCacheSize()
{
  var visitor = {
    visitDevice: function (deviceID, deviceInfo)
    {
      if (deviceID == "disk") {
        var actualSizeLabel = document.getElementById("cacheSizeInfo");
        var sizeStrings = DownloadUtils.convertByteUnits(deviceInfo.totalSize);
        var prefStrBundle = document.getElementById("bundle_prefutilities");
        var sizeStr = prefStrBundle.getFormattedString("cacheSizeInfo",
                                                        sizeStrings);
        actualSizeLabel.textContent = sizeStr;
      }
      // Do not enumerate entries
      return false;
    },

    visitEntry: function (deviceID, entryInfo)
    {
      // Do not enumerate entries.
      return false;
    }
  };

  Components.classes["@mozilla.org/network/cache-service;1"]
            .getService(Components.interfaces.nsICacheService)
            .visitEntries(visitor);
}
