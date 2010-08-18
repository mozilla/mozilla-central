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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

// Make sure we execute this file exactly once
var gMailTestUtils_js__;
if (!gMailTestUtils_js__) {
gMailTestUtils_js__ = true;

// we would like for everyone to have fixIterator and toXPComArray
Components.utils.import("resource:///modules/iteratorUtils.jsm");
// exposes component loader's btoa impl
Components.utils.import("resource:///modules/IOUtils.js");
// JS ctypes, needed for a few native functions
Components.utils.import("resource://gre/modules/ctypes.jsm");

// Local Mail Folders. Requires prior setup of profile directory

var gLocalIncomingServer;
var gLocalInboxFolder;

function loadLocalMailAccount()
{
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  acctMgr.createLocalMailAccount();

  gLocalIncomingServer = acctMgr.localFoldersServer;

  var rootFolder = gLocalIncomingServer.rootMsgFolder;

  // Note: Inbox is not created automatically when there is no deferred server,
  // so we need to create it.
  gLocalInboxFolder = rootFolder.addSubfolder("Inbox");
  // a local inbox should have a Mail flag!
  gLocalInboxFolder.setFlag(Ci.nsMsgFolderFlags.Mail);

  // Force an initialization of the Inbox folder database.
  var folderName = gLocalInboxFolder.prettiestName;
}

/**
 * atob() = base64 decode
 * Converts a base64-encoded string to a string with the octet data.
 * @see RFC 4648
 *
 * The extra parameters are optional arguments that are used to override the
 * official base64 characters for values 62 and 63. If not specified, they
 * default to '+' and '/'.
 *
 * No unicode translation is performed during the conversion.
 *
 * @param str    A string argument representing the encoded data
 * @param c62    The (optional) character for the value 62
 * @param c63    The (optional) character for the value 63
 * @return       An string with the data
 */
function atob(str, c62, c63) {
  var result = [];
  var bits = [];
  c62 = c62 ? c62.charCodeAt(0) : 43;
  c63 = c63 ? c63.charCodeAt(0) : 47;
  for (var i=0;i<str.length;i++) {
    let c = str.charCodeAt(i);
    let val = 0;
    if (65 <= c && c <= 90) // A-Z
      val = c-65;
    else if (97 <= c && c <= 122) // a-z
      val = c-97+26;
    else if (48 <= c && c <= 57) // 0-9
      val = c-48+52;
    else if (c == c62)
      val = 62;
    else if (c == c63)
      val = 63;
    else if (c == 61) {
      for (var q=i+1;q<str.length;q++)
        if (str[q] != '=')
          throw "Character after =: "+str[q];
      break;
    } else
      throw "Illegal character in input: "+c;
    bits.push((val >> 5) & 1);
    bits.push((val >> 4) & 1);
    bits.push((val >> 3) & 1);
    bits.push((val >> 2) & 1);
    bits.push((val >> 1) & 1);
    bits.push((val >> 0) & 1);
    if (bits.length >= 8)
      result.push(bits.splice(0, 8).reduce(function (form, bit) {
        return (form << 1) | bit;
      }, 0));
  }
  return result.reduce(function (str, c) { return str + String.fromCharCode(c); }, "");
}

/*
 * We used to implement btoa here, but we don't need to as it's provided by
 * the JS loader and theirs is ridiculously faster!.  We have IOUtils expose it
 * for us so we can get at it.
 */
var btoa = IOUtils.btoa;

// Loads a file to a string
// If aCharset is specified, treats the file as being of that charset
function loadFileToString(aFile, aCharset) {
  var data = "";
  var fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                  .createInstance(Ci.nsIFileInputStream);
  fstream.init(aFile, -1, 0, 0);

  if (aCharset)
  {
    var cstream = Cc["@mozilla.org/intl/converter-input-stream;1"]
                    .createInstance(Ci.nsIConverterInputStream);
    cstream.init(fstream, aCharset, 4096, 0x0000);
    var str = {};
    while (cstream.readString(4096, str) != 0)
      data += str.value;

    cstream.close();
  }
  else
  {
    var sstream = Cc["@mozilla.org/scriptableinputstream;1"]
                    .createInstance(Ci.nsIScriptableInputStream);

    sstream.init(fstream);

    var str = sstream.read(4096);
    while (str.length > 0) {
      data += str;
      str = sstream.read(4096);
    }

    sstream.close();
  }

  fstream.close();

  return data;
}

/**
 * Return the file system a particular file is on. Currently only supported on
 * Windows.
 *
 * @param aFile The file to get the file system for.
 */
function get_file_system(aFile) {
  if (!("@mozilla.org/windows-registry-key;1" in Cc))
    throw new Error("get_file_system is only supported on Windows");

  // Win32 type and other constants.
  const BOOL = ctypes.int32_t;
  const MAX_PATH = 260;
  
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

    // Returns information about the file system for the given volume path. We just need
    // the file system name.
    let GetVolumeInformation = kernel32.declare(
      "GetVolumeInformationW",
      ctypes.winapi_abi,
      BOOL,                // return type: 1 indicates success, 0 failure
      ctypes.jschar.ptr,   // in, optional: lpRootPathName
      ctypes.jschar.ptr,   // out: lpVolumeNameBuffer
      ctypes.uint32_t,     // in: nVolumeNameSize
      ctypes.uint32_t.ptr, // out, optional: lpVolumeSerialNumber
      ctypes.uint32_t.ptr, // out, optional: lpMaximumComponentLength
      ctypes.uint32_t.ptr, // out, optional: lpFileSystemFlags
      ctypes.jschar.ptr,   // out: lpFileSystemNameBuffer
      ctypes.uint32_t      // in: nFileSystemNameSize
    );

    // We're only interested in the name of the file system.
    let fsName = new (ctypes.jschar.array(MAX_PATH + 1));

    if (!GetVolumeInformation(volumePath, null, 0, null, null, null, fsName,
                              fsName.length)) {
      throw new Error("Unable to get volume information for " +
                      volumePath.readString() + ", error " + GetLastError());
    }

    return fsName.readString();
  }
  finally {
    kernel32.close();
  }
}

/**
 * Try marking a region of a file as sparse, so that zeros don't consume
 * significant amounts of disk space.  This is a platform-dependent routine and
 * is not supported on all platforms. The current status of this function is:
 * - Windows: Supported, but only on NTFS volumes.
 * - Mac: Not supported.
 * - Linux: As long as you seek to a position before writing, happens automatically
 *   on most file systems, so this function is a no-op.
 *
 * @param aFile The file to mark as sparse.
 * @param aRegionStart The start position of the sparse region, in bytes.
 * @param aRegionBytes The number of bytes to mark as sparse.
 * @returns Whether the OS and file system supports marking files as sparse. If
 *          this is true, then the file has been marked as sparse. If this is
 *          false, then the underlying system doesn't support marking files as
 *          sparse. If an exception is thrown, then the system does support
 *          marking files as sparse, but an error occured while doing so.
 *
 */
function mark_file_region_sparse(aFile, aRegionStart, aRegionBytes) {
  if ("@mozilla.org/windows-registry-key;1" in Cc) {
    // If the file system is not NTFS, sorry, we don't support sparse files.
    if (get_file_system(aFile) != "NTFS")
      return false;

    // Win32 type and other constants.
    const BOOL = ctypes.int32_t;
    const HANDLE = ctypes.voidptr_t;
    // A BOOLEAN (= BYTE = unsigned char) is distinct from a BOOL.
    // http://blogs.msdn.com/b/oldnewthing/archive/2004/12/22/329884.aspx
    const BOOLEAN = ctypes.unsigned_char;
    const FILE_SET_SPARSE_BUFFER = new ctypes.StructType(
      "FILE_SET_SPARSE_BUFFER",
      [{"SetSparse": BOOLEAN}]
    );
    // LARGE_INTEGER is actually a type union. We'll use the int64 representation
    const LARGE_INTEGER = ctypes.int64_t;
    const FILE_ZERO_DATA_INFORMATION = new ctypes.StructType(
      "FILE_ZERO_DATA_INFORMATION",
      [{"FileOffset": LARGE_INTEGER},
       {"BeyondFinalZero": LARGE_INTEGER}]
    );

    const GENERIC_WRITE = 0x40000000;
    const OPEN_ALWAYS = 4;
    const FILE_ATTRIBUTE_NORMAL = 0x80;
    const INVALID_HANDLE_VALUE = new ctypes.Int64(-1);
    const FSCTL_SET_SPARSE = 0x900c4;
    const FSCTL_SET_ZERO_DATA = 0x980c8;
    const FILE_BEGIN = 0;

    let kernel32 = ctypes.open("kernel32.dll");

    try {
      let CreateFile = kernel32.declare(
        "CreateFileW",
        ctypes.winapi_abi,
        HANDLE,            // return type: handle to the file
        ctypes.jschar.ptr, // in: lpFileName
        ctypes.uint32_t,   // in: dwDesiredAccess
        ctypes.uint32_t,   // in: dwShareMode
        ctypes.voidptr_t,  // in, optional: lpSecurityAttributes (note that
                           // we're cheating here by not declaring a
                           // SECURITY_ATTRIBUTES structure -- that's because
                           // we're going to pass in null anyway)
        ctypes.uint32_t,   // in: dwCreationDisposition
        ctypes.uint32_t,   // in: dwFlagsAndAttributes
        HANDLE             // in, optional: hTemplateFile
      );

      // Returns the last error.
      let GetLastError = kernel32.declare(
        "GetLastError",
        ctypes.winapi_abi,
        ctypes.uint32_t // return type: the last error
      );

      let filePath = aFile.path;
      let hFile = CreateFile(filePath, GENERIC_WRITE, 0, null, OPEN_ALWAYS,
                             FILE_ATTRIBUTE_NORMAL, null);
      let hFileInt = ctypes.cast(hFile, ctypes.intptr_t);
      if (ctypes.Int64.compare(hFileInt.value, INVALID_HANDLE_VALUE) == 0) {
        throw new Error("CreateFile failed for " + filePath + ", error " +
                        GetLastError());
      }

      try {
        let DeviceIoControl = kernel32.declare(
          "DeviceIoControl",
          ctypes.winapi_abi,
          BOOL,                // return type: 1 indicates success, 0 failure
          HANDLE,              // in: hDevice
          ctypes.uint32_t,     // in: dwIoControlCode
          ctypes.voidptr_t,    // in, optional: lpInBuffer
          ctypes.uint32_t,     // in: nInBufferSize
          ctypes.voidptr_t,    // out, optional: lpOutBuffer
          ctypes.uint32_t,     // in: nOutBufferSize
          ctypes.uint32_t.ptr, // out, optional: lpBytesReturned
          ctypes.voidptr_t     // inout, optional: lpOverlapped (again, we're
                               // cheating here by not having this as an
                               // OVERLAPPED structure
        );
        // bytesReturned needs to be passed in, even though it's meaningless
        let bytesReturned = new ctypes.uint32_t();
        let sparseBuffer = new FILE_SET_SPARSE_BUFFER();
        sparseBuffer.SetSparse = 1;

        // Mark the file as sparse
        if (!DeviceIoControl(hFile, FSCTL_SET_SPARSE, sparseBuffer.address(),
                             FILE_SET_SPARSE_BUFFER.size, null, 0,
                             bytesReturned.address(), null)) {
          throw new Error("Unable to mark file as sparse, error " +
                          GetLastError());
        }
        
        let zdInfo = new FILE_ZERO_DATA_INFORMATION();
        zdInfo.FileOffset = aRegionStart;
        let regionEnd = aRegionStart + aRegionBytes;
        zdInfo.BeyondFinalZero = regionEnd;
        // Mark the region as a sparse region
        if (!DeviceIoControl(hFile, FSCTL_SET_ZERO_DATA, zdInfo.address(),
                             FILE_ZERO_DATA_INFORMATION.size, null, 0,
                             bytesReturned.address(), null)) {
          throw new Error("Unable to mark region as zero, error " +
                          GetLastError());
        }

        // Move to past the sparse region and mark it as the end of the file. The
        // above DeviceIoControl call is useless unless followed by this.
        let SetFilePointerEx = kernel32.declare(
          "SetFilePointerEx",
          ctypes.winapi_abi,
          BOOL,              // return type: 1 indicates success, 0 failure
          HANDLE,            // in: hFile
          LARGE_INTEGER,     // in: liDistanceToMove
          LARGE_INTEGER.ptr, // out, optional: lpNewFilePointer
          ctypes.uint32_t    // in: dwMoveMethod
        );
        if (!SetFilePointerEx(hFile, regionEnd, null, FILE_BEGIN)) {
          throw new Error("Unable to set file pointer to end, error " +
                          GetLastError());
        }

        let SetEndOfFile = kernel32.declare(
          "SetEndOfFile",
          ctypes.winapi_abi,
          BOOL,  // return type: 1 indicates success, 0 failure
          HANDLE // in: hFile
        );
        if (!SetEndOfFile(hFile))
          throw new Error("Unable to set end of file, error " + GetLastError());

        return true;
      }
      finally {
        let CloseHandle = kernel32.declare(
          "CloseHandle",
          ctypes.winapi_abi,
          BOOL,  // return type: 1 indicates success, 0 failure
          HANDLE // in: hObject
        );
        CloseHandle(hFile);
      }
    }
    finally {
      kernel32.close();
    }
  }
  else if ("nsILocalFileMac" in Ci) {
    // Macs don't support marking files as sparse.
    return false;
  }
  else {
    // Assuming Unix here. Unix file systems generally automatically sparsify
    // files.
    return true;
  }
}

/**
 * A variant of do_timeout that accepts an actual function instead of
 *  requiring you to pass a string to evaluate.  If the function throws an
 *  exception when invoked, we will use do_throw to ensure that the test fails.
 *
 * @param aDelayInMS The number of milliseconds to wait before firing the timer.
 * @param aFunc The function to invoke when the timer fires.
 * @param aFuncThis Optional 'this' pointer to use.
 * @param aFuncArgs Optional list of arguments to pass to the function.
 */
function do_timeout_function(aDelayInMS, aFunc, aFuncThis, aFuncArgs) {
  let timer = Components.classes["@mozilla.org/timer;1"]
                        .createInstance(Components.interfaces.nsITimer);
  let wrappedFunc = function() {
    try {
      aFunc.apply(aFuncThis, aFuncArgs);
    }
    catch (ex) {
      // we want to make sure that if the thing we call throws an exception,
      //  that this terminates the test.
      do_throw(ex);
    }
  }
  timer.initWithCallback(wrappedFunc, aDelayInMS,
    Components.interfaces.nsITimer.TYPE_ONE_SHOT);
}

/**
 * Ensure the given nsIMsgFolder's database is up-to-date, calling the provided
 *  callback once the folder has been loaded.  (This may be instantly or
 *  after a re-parse.)
 *
 * @param aFolder The nsIMsgFolder whose database you want to ensure is
 *     up-to-date.
 * @param aCallback The callback function to invoke once the folder has been
 *     loaded.
 * @param aCallbackThis The 'this' to use when calling the callback.  Pass null
 *     if your callback does not rely on 'this'.
 * @param aCallbackArgs A list of arguments to pass to the callback via apply.
 *     If you provide [1,2,3], we will effectively call:
 *     aCallbackThis.aCallback(1,2,3);
 * @param [aSomeoneElseWillTriggerTheUpdate=false] If this is true, we do not
 *     trigger the updateFolder call and it is assumed someone else is taking
 *     care of that.
 */
function updateFolderAndNotify(aFolder, aCallback, aCallbackThis,
    aCallbackArgs, aSomeoneElseWillTriggerTheUpdate) {
  // register for the folder loaded notification ahead of time... even though
  //  we may not need it...
  let mailSession = Cc["@mozilla.org/messenger/services/session;1"]
                      .getService(Ci.nsIMsgMailSession);
  let atomService = Cc["@mozilla.org/atom-service;1"]
                      .getService(Ci.nsIAtomService);
  let kFolderLoadedAtom = atomService.getAtom("FolderLoaded");

  let folderListener = {
    OnItemEvent: function (aEventFolder, aEvent) {
      if (aEvent == kFolderLoadedAtom && aFolder.URI == aEventFolder.URI) {
        mailSession.RemoveFolderListener(this);
        aCallback.apply(aCallbackThis, aCallbackArgs);
      }
    }
  };

  mailSession.AddFolderListener(folderListener, Ci.nsIFolderListener.event);

  if (!aSomeoneElseWillTriggerTheUpdate)
    aFolder.updateFolder(null);
}

} // gMailTestUtils_js__
