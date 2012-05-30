/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["AboutSupportPlatform"];

// JS ctypes are needed to get at the data we need
Components.utils.import("resource://gre/modules/ctypes.jsm");

const BOOL = ctypes.int32_t;
const DRIVE_UNKNOWN = 0;
const DRIVE_NETWORK = 4;

var AboutSupportPlatform = {
  /**
   * Given an nsIFile, gets the file system type. The type is returned as a
   * string. Possible values are "network", "local", "unknown" and null.
   */
  getFileSystemType: function ASPWin32_getFileSystemType(aFile) {
    let kernel32 = ctypes.open("kernel32.dll");

    try {
      // Returns the path of the volume a file is on.
      let GetVolumePathName = kernel32.declare(
        "GetVolumePathNameW",
        ctypes.winapi_abi,
        BOOL,              // return type: 1 indicates success, 0 failure
        ctypes.jschar.ptr, // in: lpszFileName
        ctypes.jschar.ptr, // out: lpszVolumePathName
        ctypes.uint32_t    // in: cchBufferLength
      );

      // Returns the last error.
      let GetLastError = kernel32.declare(
        "GetLastError",
        ctypes.winapi_abi,
        ctypes.uint32_t // return type: the last error
      );

      let filePath = aFile.path;
      // The volume path should be at most 1 greater than than the length of the
      // path -- add 1 for a trailing backslash if necessary, and 1 for the
      // terminating null character. Note that the parentheses around the type are
      // necessary for new to apply correctly.
      let volumePath = new (ctypes.jschar.array(filePath.length + 2));

      if (!GetVolumePathName(filePath, volumePath, volumePath.length)) {
        throw new Error("Unable to get volume path for " + filePath + ", error " +
                        GetLastError());
      }

      // Returns the type of the drive.
      let GetDriveType = kernel32.declare(
        "GetDriveTypeW",
        ctypes.winapi_abi,
        ctypes.uint32_t,  // return type: the drive type
        ctypes.jschar.ptr // in: lpRootPathName
      );
      let type = GetDriveType(volumePath);
      // http://msdn.microsoft.com/en-us/library/aa364939
      if (type == DRIVE_UNKNOWN)
        return "unknown";
      else if (type == DRIVE_NETWORK)
        return "network";
      else
        return "local";
    }
    finally {
      kernel32.close();
    }
  },
};
