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
 * Sean Murphy.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Sean Murphy <murph@seanmurph.com>
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

// Keys for describing search plugins:
extern NSString *const kWebSearchPluginNameKey;
extern NSString *const kWebSearchPluginMIMETypeKey;
extern NSString *const kWebSearchPluginURLKey;

// Supported MIME types:
extern NSString *const kOpenSearchMIMEType;

//
// XMLSearchPluginParser
//
// A class cluster which is designed to support the flexible parsing
// of xml-based web search engine definitions.  XMLSearchPluginParser is
// an abstract superclass, and all creational methods transparently return
// a private concrete subclasses capable of parsing a certain type of plugin file.
//
// Instructions for subclassing are before the @implementation.
//
@interface XMLSearchPluginParser : NSObject
{
@private
  NSSet           *mElementsToParseContentsFor;   // strong
  NSSet           *mElementsToParseAttributesFor; // strong

  BOOL            mShouldParseContentsOfCurrentElement;

  NSString        *mSearchEngineName; // strong
  NSString        *mSearchEngineURL;  // strong

  NSMutableString *mCurrentElementBuffer;
}

+ (BOOL)canParsePluginMIMEType:(NSString *)mimeType;

// Both methods return nil if the plugin type is not supported:
+ (id)searchPluginParserWithMIMEType:(NSString *)mimeType;
- (id)initWithPluginMIMEType:(NSString *)mimeType;

- (BOOL)parseSearchPluginAtURL:(NSURL *)searchPluginURL;

// Accessors to obtain parsed information:
- (NSString *)searchEngineName;
- (NSString *)searchEngineURL;

@end

#pragma mark -

@interface XMLSearchPluginParser (AbstractMethods)

// Abstract methods which should be implemented by subclasses:

- (void)foundContents:(NSString *)stringContents forElement:(NSString *)elementName;
- (void)foundAttributes:(NSDictionary *)attributeDict forElement:(NSString *)elementName;

@end

#pragma mark -

@interface XMLSearchPluginParser (SubclassUseOnly)

// Private, concrete methods which should only be used by subclasses:

// Establish which elements you're interested in:
- (void)setShouldParseContentsOfElements:(NSSet *)setOfElements;
- (void)setShouldParseAttributesOfElements:(NSSet *)setOfElements;
- (BOOL)shouldParseContentsOfElement:(NSString *)elementName;
- (BOOL)shouldParseAttributesOfElement:(NSString *)elementName;

// Set parsed properties:
- (void)setSearchEngineName:(NSString *)newSearchEngineName;
- (void)setSearchEngineURL:(NSString *)newSearchEngineURL;

- (BOOL)browserSupportsSearchQueryURLWithMIMEType:(NSString *)mimeType requestMethod:(NSString *)method;

@end
