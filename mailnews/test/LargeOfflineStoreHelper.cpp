/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Mozilla Messaging, Inc.
 *
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
 *
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

/**
 * A helper to large offline store tests on Windows. This:
 *
 * - Detects whether the volume of the given file (provided using argv[1]) is
 *   NTFS. If it isn't, then it returns the error code 1.
 * - If the volume is NTFS, then it proceeds to mark the given file as
 *   sparse. It also marks the first 4 GB + 15 bytes of the file as zero.
 */

#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <winioctl.h>

#define SUCCESS (0)
#define UNABLE_TO_RUN (1)
#define FAIL (2)

int markFileAsSparse(HANDLE hFile)
{
  // Mark the file as sparse, and mark the first 4 GB + 15 bytes as a sparse
  // region
  DWORD bytesReturned;
  FILE_SET_SPARSE_BUFFER sparseBuffer = {0};
  sparseBuffer.SetSparse = 1;
  if (!::DeviceIoControl(hFile, FSCTL_SET_SPARSE, &sparseBuffer,
                         sizeof(sparseBuffer), NULL, 0, &bytesReturned, NULL))
  {
    fprintf(stderr, "Unable to mark file as sparse, error %d\n",
            ::GetLastError());
    return FAIL;
  }

  LARGE_INTEGER zdStart;
  zdStart.QuadPart = 0;
  LARGE_INTEGER zdEnd;
  zdEnd.QuadPart = 0x10000000fLL;
  FILE_ZERO_DATA_INFORMATION zdInfo = {0};
  zdInfo.FileOffset = zdStart;
  zdInfo.BeyondFinalZero = zdEnd;
  if (!::DeviceIoControl(hFile, FSCTL_SET_ZERO_DATA, &zdInfo, sizeof(zdInfo),
                         NULL, 0, &bytesReturned, NULL))
  {
    fprintf(stderr, "Unable to mark region as zero, error %d\n",
            ::GetLastError());
    return FAIL;
  }

  // Move to past the sparse region and mark it as the end of the file. The
  // above DeviceIoControl call is useless unless followed by this.
  if (!::SetFilePointerEx(hFile, zdEnd, NULL, FILE_BEGIN))
  {
    fprintf(stderr, "Unable to set file pointer to end, error %d\n",
            ::GetLastError());
    return FAIL;
  }
  if (!::SetEndOfFile(hFile))
  {
    fprintf(stderr, "Unable to set end of file, error %d\n", ::GetLastError());
    return FAIL;
  }

  return SUCCESS;
}

int wmain(int argc, wchar_t* argv[])
{
  if (argc != 2)
    return FAIL;

  // The volume path should be at most 1 greater than than the length of the
  // path -- add 1 for a trailing backslash if necessary, and 1 for the
  // terminating null character
  size_t volumePathLength = wcslen(argv[1]) + 2;
  wchar_t* volumePath = new wchar_t[volumePathLength];
  if (!::GetVolumePathNameW(argv[1], volumePath, volumePathLength))
  {
    fprintf(stderr, "Unable to get volume path for %s, error %d\n", argv[1],
            ::GetLastError());
    return FAIL;
  }

  wchar_t fsName[MAX_PATH + 1];
  if (!::GetVolumeInformationW(volumePath, NULL, NULL, NULL, NULL,
                               NULL, fsName, MAX_PATH + 1))
  {
    fprintf(stderr, "Unable to get volume information for %s, error %d\n",
            argv[1], ::GetLastError());
    return FAIL;
  }

  // We're only going to run the test on NTFS
  if (wcscmp(fsName, L"NTFS"))
    return UNABLE_TO_RUN;

  HANDLE hFile = ::CreateFileW(argv[1], GENERIC_WRITE, 0, NULL, OPEN_ALWAYS,
                               FILE_ATTRIBUTE_NORMAL, NULL);

  if (hFile == INVALID_HANDLE_VALUE)
  {
    fprintf(stderr, "CreateFile failed for %s, error %d\n", argv[1],
            ::GetLastError());
    return FAIL;
  }

  int rv = markFileAsSparse(hFile);
  ::CloseHandle(hFile);
  return rv;
}
