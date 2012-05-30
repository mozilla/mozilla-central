/* -*- Mode: C; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */


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
