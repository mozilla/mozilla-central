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
 * The Original Code is Camino code.
 *
 * The Initial Developer of the Original Code is
 * Bryan Atwood
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bryan Atwood <bryan.h.atwood@gmail.com>
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

#import <Cocoa/Cocoa.h>

// AutoCompleteResults
//
// Container object for generic auto complete.
// Holds the search string, array of matched objects and the default item.
//
@interface AutoCompleteResults : NSObject
{
  NSString*  mSearchString;     // strong
  NSArray*   mMatches;          // strong
  int        mDefaultIndex;
}
- (NSString*)searchString;
- (void)setSearchString:(NSString*)string;

- (NSArray*)matches;
- (void)setMatches:(NSArray*)matches;

- (int)defaultIndex;
- (void)setDefaultIndex:(int)defaultIndex;

@end

// AutoCompleteListener
//
// This defines the protocol methods for the object that listens for auto complete
// results.  |onAutoComplete| is called by the object that searches the data and
// the results are returned to the originating caller as AutoCompleteResults.
//
@protocol AutoCompleteListener
- (void)autoCompleteFoundResults:(AutoCompleteResults*)results;
@end

// AutoCompleteSession
//
// An AutoCompleteSession object listens for search requests and searches a set of data 
// |startAutoCompleteWithSearch| initiates the process.  Previous results are passed in 
// as well as the listener object for when the search is complete.
//
@protocol AutoCompleteSession
- (void)startAutoCompleteWithSearch:(NSString*)searchString 
                    previousResults:(AutoCompleteResults*)previousSearchResults
                           listener:(id<AutoCompleteListener>)listener;
@end
