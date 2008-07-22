/* -*- Mode: C; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
* Netscape Communications Corporation.
* Portions created by the Initial Developer are Copyright (C) 2007
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   David Bienvenu <bienvenu@nventure.com>
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


#include <CoreFoundation/CoreFoundation.h>
#include <CoreServices/CoreServices.h> 


/* -----------------------------------------------------------------------------
    Get metadata attributes from file
   
   This function's job is to extract useful information from the .mozeml file
   and return it as a dictionary
   ----------------------------------------------------------------------------- */

Boolean GetMetadataForFile(void* thisInterface, 
			   CFMutableDictionaryRef attributes, 
			   CFStringRef contentTypeUTI,
			   CFStringRef pathToFile)
{
    /* Pull any available metadata from the file at the specified path */
    /* Return the attribute keys and attribute values in the dict */
    /* Return TRUE if successful, FALSE if there was no data provided */
  Boolean success;
  CFURLRef fileURL = CFURLCreateWithFileSystemPath(kCFAllocatorDefault, pathToFile, kCFURLPOSIXPathStyle, false);
  CFReadStreamRef stream = CFReadStreamCreateWithFile(kCFAllocatorDefault, fileURL);
  CFReadStreamOpen(stream);

  CFPropertyListFormat format;
  CFStringRef errorString = NULL;
  CFPropertyListRef ticket = CFPropertyListCreateFromStream(kCFAllocatorDefault,
                             stream,
                             /*streamLength*/ 0,
                             kCFPropertyListImmutable,
                              &format,
                             &errorString
                             );
  if (errorString)
  {
    printf("failed creating property list from stream\n");
    printf("error = %s\n", (const char*) errorString);
    success = FALSE;
  } 
  else
  {
    CFTypeRef value;
    value = CFDictionaryGetValue(ticket, kMDItemTitle);
     if (value)
     {
       CFDictionarySetValue(attributes, kMDItemTitle, value);
     }
     value = CFDictionaryGetValue(ticket, kMDItemTextContent);
     if (value)
     {
       CFDictionarySetValue(attributes, kMDItemTextContent, value);
       
     }
     value = CFDictionaryGetValue(ticket, kMDItemDisplayName);
     if (value)
       CFDictionarySetValue(attributes, kMDItemDisplayName, value);
        
     CFDateFormatterRef dateFormatter = CFDateFormatterCreate(NULL, NULL, kCFDateFormatterLongStyle, kCFDateFormatterLongStyle);
                                              
     value = CFDictionaryGetValue(ticket, kMDItemLastUsedDate);

     if (value && dateFormatter)
     {
       printf("trying to parse date \n");
       CFDateRef curDate = CFDateFormatterCreateDateFromString(NULL, dateFormatter, value, NULL);
       printf("got cur date\n");
       if (curDate)
         CFDictionarySetValue(attributes, kMDItemLastUsedDate, curDate);
     }
                                                   
     success = TRUE;
  }
  // contents are kMDItemTextContent
  
  CFReadStreamClose(stream);
  CFRelease(stream);
  CFRelease(fileURL);
  return success;    
}
