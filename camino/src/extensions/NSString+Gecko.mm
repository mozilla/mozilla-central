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
 * The Original Code is Chimera code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Simon Fraser <sfraser@netscape.com>
 *   David Haas   <haasd@cae.wisc.edu>
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

#import "NSString+Gecko.h"

#include "nsString.h"
#include "nsPromiseFlatString.h"
#include "nsCRT.h"


@implementation NSString (ChimeraGeckoStringUtils)

+ (id)stringWithPRUnichars:(const PRUnichar*)inString
{
  if (inString)
    return [self stringWithCharacters:inString length:nsCRT::strlen(inString)];
  else
    return [self string];
}

+ (id)stringWith_nsAString:(const nsAString&)inString
{
  nsPromiseFlatString flatString = PromiseFlatString(inString);
  return [self stringWithCharacters:flatString.get() length:flatString.Length()];
}

+ (id)stringWith_nsACString:(const nsACString&)inString
{
  nsPromiseFlatCString flatString = PromiseFlatCString(inString);
  return [self stringWithUTF8String:flatString.get()];
}

- (id)initWith_nsAString:(const nsAString&)inString
{
  nsPromiseFlatString flatString = PromiseFlatString(inString);
  return [self initWithCharacters:flatString.get() length:flatString.Length()];
}

- (id)initWith_nsACString:(const nsACString&)inString
{
  nsPromiseFlatCString flatString = PromiseFlatCString(inString);
  return [self initWithUTF8String:flatString.get()];
}

- (id)initWithPRUnichars:(const PRUnichar*)inString
{
  return [self initWithCharacters:inString length:nsCRT::strlen(inString)];
}

#define ASSIGN_STACK_BUFFER_CHARACTERS  256

- (void)assignTo_nsAString:(nsAString&)ioString
{
  PRUnichar     stackBuffer[ASSIGN_STACK_BUFFER_CHARACTERS];
  PRUnichar*    buffer = stackBuffer;

  // XXX maybe fix this to use SetLength(0), SetLength(len), and a writing iterator.
  unsigned int len = [self length];

  if (len + 1 > ASSIGN_STACK_BUFFER_CHARACTERS) {
    buffer = (PRUnichar *)malloc(sizeof(PRUnichar) * (len + 1));
    if (!buffer)
      return;
  }

  [self getCharacters:buffer];   // does not null terminate
  ioString.Assign(buffer, len);

  if (buffer != stackBuffer)
    free(buffer);
}

- (PRUnichar*)createNewUnicodeBuffer
{
  PRUint32 length = [self length];
  PRUnichar* retStr = (PRUnichar*)nsMemory::Alloc((length + 1) * sizeof(PRUnichar));
  [self getCharacters:retStr];
  retStr[length] = PRUnichar(0);
  return retStr;
}

// Windows buttons have shortcut keys specified by ampersands in the
// title string. This function removes them from such strings.
-(NSString*)stringByRemovingWindowsShortcutAmpersand
{
  NSMutableString* dirtyStringMutant = [NSMutableString stringWithString:self];
  // we loop through removing all single ampersands and reducing double ampersands to singles
  unsigned int searchLocation = 0;
  while (searchLocation < [dirtyStringMutant length]) {
    searchLocation = [dirtyStringMutant rangeOfString:@"&" options:nil
                                                range:NSMakeRange(searchLocation, [dirtyStringMutant length] - searchLocation)].location;
    if (searchLocation == NSNotFound) {
      break;
    }
    else {
      [dirtyStringMutant deleteCharactersInRange:NSMakeRange(searchLocation, 1)];
      // ampersand or not, we leave the next character alone
      searchLocation++;
    }
  }
  return [NSString stringWithString:dirtyStringMutant];
}

@end
