/*
 * libjingle
 * Copyright 2004--2005, Google Inc.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  1. Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "talk/base/win32.h"
#include <algorithm>

#include "talk/base/basictypes.h"
#include "talk/base/common.h"

namespace talk_base {

//
// Unix time is in seconds relative to 1/1/1970.  So we compute the windows
// FILETIME of that time/date, then we add/subtract in appropriate units to
// convert to/from unix time.
// The units of FILETIME are 100ns intervals, so by multiplying by or dividing
// by 10000000, we can convert to/from seconds.
//
// FileTime = UnixTime*10000000 + FileTime(1970)
// UnixTime = (FileTime-FileTime(1970))/10000000
//

void FileTimeToUnixTime(const FILETIME& ft, time_t* ut) {
  ASSERT(NULL != ut);

  // FILETIME has an earlier date base than time_t (1/1/1970), so subtract off
  // the difference.
  SYSTEMTIME base_st;
  memset(&base_st, 0, sizeof(base_st));
  base_st.wDay = 1;
  base_st.wMonth = 1;
  base_st.wYear = 1970;

  FILETIME base_ft;
  SystemTimeToFileTime(&base_st, &base_ft);

  ULARGE_INTEGER base_ul, current_ul;
  memcpy(&base_ul, &base_ft, sizeof(FILETIME));
  memcpy(&current_ul, &ft, sizeof(FILETIME));

  // Divide by big number to convert to seconds, then subtract out the 1970
  // base date value.
  const ULONGLONG RATIO = 10000000;
  *ut = static_cast<time_t>((current_ul.QuadPart - base_ul.QuadPart) / RATIO);
}

void UnixTimeToFileTime(const time_t& ut, FILETIME* ft) {
  ASSERT(NULL != ft);

  // FILETIME has an earlier date base than time_t (1/1/1970), so add in
  // the difference.
  SYSTEMTIME base_st;
  memset(&base_st, 0, sizeof(base_st));
  base_st.wDay = 1;
  base_st.wMonth = 1;
  base_st.wYear = 1970;

  FILETIME base_ft;
  SystemTimeToFileTime(&base_st, &base_ft);

  ULARGE_INTEGER base_ul;
  memcpy(&base_ul, &base_ft, sizeof(FILETIME));

  // Multiply by big number to convert to 100ns units, then add in the 1970
  // base date value.
  const ULONGLONG RATIO = 10000000;
  ULARGE_INTEGER current_ul;
  current_ul.QuadPart = base_ul.QuadPart + static_cast<int64>(ut) * RATIO;
  memcpy(ft, &current_ul, sizeof(FILETIME));
}

bool Utf8ToWindowsFilename(const std::string& utf8, std::wstring* filename) {
  // TODO: Integrate into fileutils.h
  // TODO: Handle wide and non-wide cases via TCHAR?
  // TODO: Skip \\?\ processing if the length is not > MAX_PATH?
  // TODO: Write unittests

  // Convert to Utf16
  int wlen = ::MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), utf8.length() + 1,
                                   NULL, 0);
  if (0 == wlen) {
    return false;
  }
  wchar_t* wfilename = STACK_ARRAY(wchar_t, wlen);
  if (0 == ::MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), utf8.length() + 1,
                                 wfilename, wlen)) {
    return false;
  }
  // Replace forward slashes with backslashes
  std::replace(wfilename, wfilename + wlen, L'/', L'\\');
  // Convert to complete filename
  DWORD full_len = ::GetFullPathName(wfilename, 0, NULL, NULL);
  if (0 == full_len) {
    return false;
  }
  wchar_t* filepart = NULL;
  wchar_t* full_filename = STACK_ARRAY(wchar_t, full_len + 6);
  wchar_t* start = full_filename + 6;
  if (0 == ::GetFullPathName(wfilename, full_len, start, &filepart)) {
    return false;
  }
  // Add long-path prefix
  const wchar_t kLongPathPrefix[] = L"\\\\?\\UNC";
  if ((start[0] != L'\\') || (start[1] != L'\\')) {
    // Non-unc path:     <pathname>
    //      Becomes: \\?\<pathname>
    start -= 4;
    ASSERT(start >= full_filename);
    memcpy(start, kLongPathPrefix, 4 * sizeof(wchar_t));
  } else if (start[2] != L'?') {
    // Unc path:       \\<server>\<pathname>
    //  Becomes: \\?\UNC\<server>\<pathname>
    start -= 6;
    ASSERT(start >= full_filename);
    memcpy(start, kLongPathPrefix, 7 * sizeof(wchar_t));
  } else {
    // Already in long-path form.
  }
  filename->assign(start);
  return true;
}

bool GetOsVersion(int* major, int* minor, int* build) {
  OSVERSIONINFO info = {0};
  info.dwOSVersionInfoSize = sizeof(info);
  if (GetVersionEx(&info)) {
    if (major) *major = info.dwMajorVersion;
    if (minor) *minor = info.dwMinorVersion;
    if (build) *build = info.dwBuildNumber;
    return true;
  }
  return false;
}

bool GetCurrentProcessIntegrityLevel(int* level) {
  bool ret = false;
  HANDLE process = ::GetCurrentProcess(), token;
  if (OpenProcessToken(process, TOKEN_QUERY | TOKEN_QUERY_SOURCE, &token)) {
    DWORD size;
    if (!GetTokenInformation(token, TokenIntegrityLevel, NULL, 0, &size) &&
        GetLastError() == ERROR_INSUFFICIENT_BUFFER) {

      char* buf = STACK_ARRAY(char, size);
      TOKEN_MANDATORY_LABEL* til =
          reinterpret_cast<TOKEN_MANDATORY_LABEL*>(buf);
      if (GetTokenInformation(token, TokenIntegrityLevel, til, size, &size)) {

        DWORD count = *GetSidSubAuthorityCount(til->Label.Sid);
        *level = *GetSidSubAuthority(til->Label.Sid, count - 1);
        ret = true;
      }
    }
    CloseHandle(token);
  }
  return ret;
}

}  // namespace talk_base

