/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * The contents of this file are subject to the Netscape Public License
 * Version 1.0 (the "NPL"); you may not use this file except in
 * compliance with the NPL.  You may obtain a copy of the NPL at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the NPL is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the NPL
 * for the specific language governing rights and limitations under the
 * NPL.
 *
 * The Initial Developer of this code under the NPL is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation.  All Rights
 * Reserved.
 */

#include "prmem.h"
#include "prmon.h"
#include "prlog.h"
#include "prefapi.h"
#include "prprf.h"
#include "nsVersionInfo.h"
#include "nsString.h"

PR_BEGIN_EXTERN_C

/* Public Methods */

nsVersionInfo::nsVersionInfo(PRInt32 maj, PRInt32 min, PRInt32 rel, PRInt32 bld, PRInt32 checksum)
{
  major   = maj;
  minor   = min;
  release = rel;
  build   = bld;
  check   = checksum;
}

nsVersionInfo::nsVersionInfo(char* versionArg)
{
  PRInt32 errorCode;
  nsString version(versionArg);
  int dot = version.Find('.', 0);
  
  if ( dot == -1 ) {
    major = version.ToInteger(&errorCode);
  }
  else  {
    nsString majorStr;
    version.Mid(majorStr, 0, dot);
    major = majorStr.ToInteger(&errorCode);
    
    int prev = dot+1;
    dot = version.Find('.',prev);
    if ( dot == -1 ) {
      nsString minorStr;
      version.Mid(minorStr, prev, version.Length() - prev);
      minor = minorStr.ToInteger(&errorCode);
    }
    else {
      nsString minorStr;
      version.Mid(minorStr, prev, dot - prev);
      minor = minorStr.ToInteger(&errorCode);
      
      prev = dot+1;
      dot = version.Find('.',prev);
      if ( dot == -1 ) {
        nsString releaseStr;
        version.Mid(releaseStr, prev, version.Length() - prev);
        release = releaseStr.ToInteger(&errorCode);
      }
      else {
        nsString releaseStr;
        version.Mid(releaseStr, prev, dot - prev);
        release = releaseStr.ToInteger(&errorCode);
        
        prev = dot+1;
        if ( version.Length() > dot ) {
          nsString buildStr;
          version.Mid(buildStr, prev, version.Length() - prev);
          build = buildStr.ToInteger(&errorCode);
        }
      }
    }
  }
}

nsVersionInfo::~nsVersionInfo()
{
}

/* Text representation of the version info */
char* nsVersionInfo::toString()
{
  char *result=NULL;
  result = PR_sprintf_append(result, "%d.%d.%d.%d", major, minor, release, build);
  return result;
}

/*
 * compareTo() -- Compares version info.
 * Returns -n, 0, n, where n = {1-4}
 */
nsVersionEnum nsVersionInfo::compareTo(nsVersionInfo* vi)
{
  nsVersionEnum diff;

  if ( vi == NULL ) {
    diff = nsVersionEnum_MAJOR_DIFF;
  }
  else if ( major == vi->major ) {
    if ( minor == vi->minor ) {
      if ( release == vi->release ) {
        if ( build == vi->build )
          diff = nsVersionEnum_EQUAL;
        else if ( build > vi->build )
          diff = nsVersionEnum_BLD_DIFF;
        else
          diff = -nsVersionEnum_BLD_DIFF;
      }
      else if ( release > vi->release )
        diff = nsVersionEnum_REL_DIFF;
      else
        diff = -nsVersionEnum_REL_DIFF;
    }
    else if (  minor > vi->minor )
      diff = nsVersionEnum_MINOR_DIFF;
    else
      diff = -nsVersionEnum_MINOR_DIFF;
  }
  else if ( major > vi->major )
    diff = nsVersionEnum_MAJOR_DIFF;
  else
    diff = -nsVersionEnum_MAJOR_DIFF;
  
  return diff;
}

nsVersionEnum nsVersionInfo::compareTo(char* version)
{
  return compareTo(new nsVersionInfo(version));
}

nsVersionEnum nsVersionInfo::compareTo(PRInt32 maj, PRInt32 min, PRInt32 rel, PRInt32 bld)
{
  return compareTo(new nsVersionInfo(maj, min, rel, bld, 0));
}

PR_END_EXTERN_C
