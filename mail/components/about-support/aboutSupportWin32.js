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
 * The Original Code is Thunderbird about:support.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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
