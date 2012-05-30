/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["AboutSupportPlatform"];

// JS ctypes are needed to get at the data we need
Components.utils.import("resource://gre/modules/ctypes.jsm");
const GFile = ctypes.StructType("GFile");
const GFileInfo = ctypes.StructType("GFileInfo");
const GError = ctypes.StructType("GError");
const GCancellable = ctypes.StructType("GCancellable");

const G_FILE_ATTRIBUTE_FILESYSTEM_TYPE = "filesystem::type";

const kNetworkFilesystems = ["afs", "cifs", "nfs", "smb"];

// These libraries might not be available on all systems.
var gLibsExist = false;
try {
  // GC is responsible for closing these libraries if they exist.
  var glib = ctypes.open("libglib-2.0.so.0");
  var gobject = ctypes.open("libgobject-2.0.so.0");
  var gio = ctypes.open("libgio-2.0.so.0");
  gLibsExist = true;
} catch (ex) {}

if (gLibsExist) {
  var g_free = glib.declare(
    "g_free",
    ctypes.default_abi,
    ctypes.void_t,
    ctypes.voidptr_t
  );
  var g_object_unref = gobject.declare(
    "g_object_unref",
    ctypes.default_abi,
    ctypes.void_t,
    ctypes.voidptr_t
  );
}

var AboutSupportPlatform = {
  /**
   * Given an nsIFile, gets the file system type. The type is returned as a
   * string. Possible values are "network", "local", "unknown" and null.
   */
  getFileSystemType: function ASPUnix_getFileSystemType(aFile) {
    // Check if the libs exist.
    if (!gLibsExist)
      return "unknown";

    try {
      // Given a UTF-8 string, converts it to the current Glib locale.
      let g_filename_from_utf8 = glib.declare(
        "g_filename_from_utf8",
        ctypes.default_abi,
        ctypes.char.ptr,   // return type: glib locale string
        ctypes.char.ptr,   // in: utf8string
        ctypes.ssize_t,    // in: len
        ctypes.size_t.ptr, // out: bytes_read
        ctypes.size_t.ptr, // out: bytes_written
        GError.ptr         // out: error
      );
      // Yes, we want function scoping for variables we need to free in the
      // finally block. I think this is better than declaring lots of variables
      // on top.
      var filePath = g_filename_from_utf8(aFile.path, -1, null, null, null);
      if (filePath.isNull()) {
        throw new Error("Unable to convert " + aFile.path +
                        " into GLib encoding");
      }

      // Given a path, creates a new GFile for it.
      let g_file_new_for_path = gio.declare(
        "g_file_new_for_path",
        ctypes.default_abi,
        GFile.ptr,      // return type: a newly-allocated GFile
        ctypes.char.ptr // in: path
      );
      var glibFile = g_file_new_for_path(filePath);

      // Given a GFile, queries the given attributes and returns them
      // as a GFileInfo.
      let g_file_query_filesystem_info = gio.declare(
        "g_file_query_filesystem_info",
        ctypes.default_abi,
        GFileInfo.ptr,    // return type
        GFile.ptr,        // in: file
        ctypes.char.ptr,  // in: attributes
        GCancellable.ptr, // in: cancellable
        GError.ptr        // out: error
      );
      var glibFileInfo = g_file_query_filesystem_info(
        glibFile, G_FILE_ATTRIBUTE_FILESYSTEM_TYPE, null, null);
      if (glibFileInfo.isNull())
        throw new Error("Unabled to retrieve GLib file info for " + aFile.path);

      let g_file_info_get_attribute_string = gio.declare(
        "g_file_info_get_attribute_string",
        ctypes.default_abi,
        ctypes.char.ptr, // return type: file system type (do not free)
        GFileInfo.ptr,   // in: info
        ctypes.char.ptr  // in: attribute
      );
      let fsType = g_file_info_get_attribute_string(
        glibFileInfo, G_FILE_ATTRIBUTE_FILESYSTEM_TYPE);
      if (fsType.isNull())
        return "unknown";
      else if (kNetworkFilesystems.indexOf(fsType.readString()) != -1)
        return "network";
      else
        return "local";
    }
    finally {
      if (filePath)
        g_free(filePath);
      if (glibFile && !glibFile.isNull())
        g_object_unref(glibFile);
      if (glibFileInfo && !glibFileInfo.isNull())
        g_object_unref(glibFileInfo);
    }
  },
};
