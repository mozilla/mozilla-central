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

#import "XMLSearchPluginParser.h"

#import "OpenSearchParser.h"
#import "NSString+Utils.h"

NSString *const kWebSearchPluginNameKey = @"SearchPluginName";
NSString *const kWebSearchPluginMIMETypeKey = @"SearchPluginMIMEType";
NSString *const kWebSearchPluginURLKey = @"SearchPluginURL";

#define PLUGIN_DOWNLOAD_TIMEOUT_INTERVAL 3.0
#define HTTP_SUCCESS_STATUS_CODE 200

NSString *const kOpenSearchMIMEType = @"application/opensearchdescription+xml";

NSString *const kXMLSearchPluginParserErrorDomain = @"XMLSearchPluginParserErrorDomain";

@interface XMLSearchPluginParser (PrivateToSuperclass)

- (BOOL)parseSearchPluginData:(NSData *)pluginData error:(NSError **)outError;
- (BOOL)searchEngineInformationWasFound;
- (NSError *)parsingErrorWithCode:(EXMLSearchPluginParserErrorCode)errorCode;

@end

#pragma mark -

//
// To create a concrete XMLSearchPluginParser subclass for parsing a new plugin format:
// 
// 1. Map your class to a plugin MIME type in |sSubclassToPluginTypeMap|, 
//    which is created in the +initialize method.
//
// 2. In your init method, set which element contents and attributes you're interested in,
//    using |setShouldParseContentsOfElements:| and |setShouldParseAttributesOfElements:|.
//
// 3. Implement the abstract methods for obtaining parsed data, 
//    |foundContents:forElement:| and |foundAttributes:forElement:|.
//
// This newly supported search plugin type will automatically be recognized by the application.
//

@implementation XMLSearchPluginParser

// The reason this dictionary exists is to avoid duplicating logic about which subclass can
// handle a certain plugin type (in |canParsePluginMIMEType:| and |searchPluginParserWithMIMEType:|).
// Each supported plugin mime type is a key mapped to the name of a concrete subclass which
// knows how to parse that type.
static NSDictionary const *sSubclassToPluginTypeMap = nil;

+ (void)initialize
{
  sSubclassToPluginTypeMap = [[NSDictionary alloc] initWithObjectsAndKeys:@"OpenSearchParser", kOpenSearchMIMEType, nil];
}

+ (BOOL)canParsePluginMIMEType:(NSString *)mimeType
{
  return ([sSubclassToPluginTypeMap objectForKey:mimeType] != nil);
}

- (id)initWithPluginMIMEType:(NSString *)mimeType
{
  // We're a class cluster;  Return a concrete subclass instead.
  [self release];

  return [[[self class] searchPluginParserWithMIMEType:mimeType] retain];
}

+ (id)searchPluginParserWithMIMEType:(NSString *)mimeType
{
  NSString *subclassForType = [sSubclassToPluginTypeMap objectForKey:mimeType];
  if (subclassForType) {
    Class concreteParserSubclass = NSClassFromString(subclassForType);
    return [[[concreteParserSubclass alloc] init] autorelease];
  }
  return nil;
}

- (void)dealloc
{
  [mElementsToParseContentsFor release];
  [mElementsToParseAttributesFor release];
  [mSearchEngineName release];
  [mSearchEngineURL release];
  [mSearchEngineURLRequestMethod release];
  [super dealloc];
}

#pragma mark -

- (BOOL)parseSearchPluginAtURL:(NSURL *)searchPluginURL error:(NSError **)outError
{
  if (outError)
    *outError = nil;

  if (!searchPluginURL) {
    if (outError)
      *outError = [self parsingErrorWithCode:eXMLSearchPluginParserPluginNotFoundError];
    return NO;
  }

  // |...WithContentsOfURL| methods throughout the Foundation will fail whenever the 
  // requested web server offers to return a gzipped data stream.  To work around 
  // this issue, we have to use NSURLConnection instead (which will automatically
  // decompress gzipped data when necessary).
  NSMutableURLRequest *urlRequest = [NSMutableURLRequest requestWithURL:searchPluginURL];
  [urlRequest setCachePolicy:NSURLRequestReloadIgnoringCacheData];
  [urlRequest setTimeoutInterval:PLUGIN_DOWNLOAD_TIMEOUT_INTERVAL];
  NSURLResponse *urlResponse;
  NSData *xmlData = [NSURLConnection sendSynchronousRequest:urlRequest returningResponse:&urlResponse error:NULL];

  // Check of the definition was found on the server.
  // If it doesn't exist, +[NSURLConnection sendSync...] is allowed to redirect and return 
  // the contents of the server's alternate (404) error page, instead of no data.
  // So, we can't just rely on [data length] because there will often be information.
  // Furthermore, the response object is not always an NSHTTPUrlResponse.  On errors though, it should
  // be: "If the response is an NSHTTPURLResponse object, and the statusCode is 4xx or 5xx, then the server
  // is attempting to redirect to an alternate error page. -ADC"
  if ([xmlData length] == 0 ||
      ([urlResponse respondsToSelector:@selector(statusCode)] &&
      ([(NSHTTPURLResponse *)urlResponse statusCode] != HTTP_SUCCESS_STATUS_CODE)))
  {
    if (outError)
      *outError = [self parsingErrorWithCode:eXMLSearchPluginParserPluginNotFoundError];
    return NO;
  }

  return [self parseSearchPluginData:xmlData error:outError];
}

- (BOOL)parseSearchPluginData:(NSData *)pluginData error:(NSError **)outError
{
  if (outError)
    *outError = nil;

  NSXMLParser *xmlParser = [[NSXMLParser alloc] initWithData:pluginData];
  [xmlParser setDelegate:self];
  BOOL parsingFinishedWithoutErrors = [xmlParser parse];
  [xmlParser release];

  // Check for parsing errors.
  if (!parsingFinishedWithoutErrors || ![self searchEngineInformationWasFound]) {
    if (outError)
      *outError = [self parsingErrorWithCode:eXMLSearchPluginParserInvalidPluginFormatError];
    return NO;
  }

  // Check if our search fields support the specified method request type.
  if (![self browserSupportsSearchQueryURLWithRequestMethod:[self searchEngineURLRequestMethod]]) { 
    if (outError)
      *outError = [self parsingErrorWithCode:eXMLSearchPluginParserUnsupportedSearchURLError];
    return NO;
  }

  // If we got this far, parsing was successful.
  return YES;
}

- (NSError *)parsingErrorWithCode:(EXMLSearchPluginParserErrorCode)errorCode
{
  NSString *localizedErrorDesc = nil;
  switch (errorCode) {
    case eXMLSearchPluginParserInvalidPluginFormatError:
      localizedErrorDesc = NSLocalizedString(@"XMLSearchPluginParserInvalidPluginFormat", nil);
      break;
    case eXMLSearchPluginParserPluginNotFoundError:
      localizedErrorDesc = NSLocalizedString(@"XMLSearchPluginParserPluginNotFound", nil);
      break;
    case eXMLSearchPluginParserUnsupportedSearchURLError:
      localizedErrorDesc = NSLocalizedString(@"XMLSearchPluginParserUnsupportedSearchURL", nil);
      break;
    default:
      localizedErrorDesc = NSLocalizedString(@"XMLSearchPluginParserUnknownError", nil);
  }

  NSDictionary *errorUserInfo = [NSDictionary dictionaryWithObject:localizedErrorDesc
                                                            forKey:NSLocalizedDescriptionKey];

  return [NSError errorWithDomain:kXMLSearchPluginParserErrorDomain
                             code:errorCode 
                         userInfo:errorUserInfo];
}

#pragma mark -
#pragma mark NSXMLParser Delegate Methods

- (void) parser:(NSXMLParser *)parser
didStartElement:(NSString *)elementName
   namespaceURI:(NSString *)namespaceURI 
  qualifiedName:(NSString *)qualifiedName
     attributes:(NSDictionary *)attributeDict
{
  // Remove any namespace prefix.
  elementName = [NSXMLNode localNameForName:elementName];

  if ([self shouldParseAttributesOfElement:elementName])
    [self foundAttributes:attributeDict forElement:elementName];

  mShouldParseContentsOfCurrentElement = [self shouldParseContentsOfElement:elementName];
}

- (void)parser:(NSXMLParser *)parser foundCharacters:(NSString *)string
{
  // Only store a buffer of elements we care about.
  if (mShouldParseContentsOfCurrentElement) {
    if (!mCurrentElementBuffer)
      mCurrentElementBuffer = [[NSMutableString alloc] initWithCapacity:25];

    [mCurrentElementBuffer appendString:string];
  }
}

- (void)parser:(NSXMLParser *)parser
 didEndElement:(NSString *)elementName
  namespaceURI:(NSString *)namespaceURI
 qualifiedName:(NSString *)qName
{
  if (mShouldParseContentsOfCurrentElement) {
    // Remove any namespace prefix.
    elementName = [NSXMLNode localNameForName:elementName];

    [self foundContents:mCurrentElementBuffer forElement:elementName];

    [mCurrentElementBuffer release];
    mCurrentElementBuffer = nil;
  }
}

#pragma mark -

- (void)setShouldParseContentsOfElements:(NSSet *)setOfElements
{
  if (mElementsToParseContentsFor != setOfElements) {
    [mElementsToParseContentsFor release];
    mElementsToParseContentsFor = [setOfElements retain];
  }
}

- (BOOL)shouldParseContentsOfElement:(NSString *)elementName
{
  return [mElementsToParseContentsFor containsObject:elementName];
}

- (void)setShouldParseAttributesOfElements:(NSSet *)setOfElements
{
  if (mElementsToParseAttributesFor != setOfElements) {
    [mElementsToParseAttributesFor release];
    mElementsToParseAttributesFor = [setOfElements retain];
  }
}

- (BOOL)shouldParseAttributesOfElement:(NSString *)elementName
{
  return [mElementsToParseAttributesFor containsObject:elementName];
}

#pragma mark -

- (NSString *)searchEngineName
{
  return [[mSearchEngineName retain] autorelease];
}

- (void)setSearchEngineName:(NSString *)newSearchEngineName
{
  if (mSearchEngineName != newSearchEngineName) {
    [mSearchEngineName release];
    mSearchEngineName = [newSearchEngineName retain];
  }
}

- (NSString *)searchEngineURL
{
  return [[mSearchEngineURL retain] autorelease];
}

- (void)setSearchEngineURL:(NSString *)newSearchEngineURL
{
  if (mSearchEngineURL != newSearchEngineURL) {
    [mSearchEngineURL release];
    mSearchEngineURL = [newSearchEngineURL retain];
  }
}

- (NSString *)searchEngineURLRequestMethod
{
  return [[mSearchEngineURLRequestMethod retain] autorelease]; 
}

- (void)setSearchEngineURLRequestMethod:(NSString *)newSearchEngineURLRequestMethod
{
  if (mSearchEngineURLRequestMethod != newSearchEngineURLRequestMethod) {
    [mSearchEngineURLRequestMethod release];
    mSearchEngineURLRequestMethod = [newSearchEngineURLRequestMethod retain];
  }
}

#pragma mark -

- (BOOL)browserSupportsSearchQueryURLWithMIMEType:(NSString *)mimeType
{
  return ([mimeType isEqualToString:@"text/html"]);
}

- (BOOL)browserSupportsSearchQueryURLWithRequestMethod:(NSString *)requestMethod
{
  return [requestMethod isEqualToStringIgnoringCase:@"GET"];
}

// NSXMLParser finishing without errors is not enough to know whether we successfully obtained enough
// information for a new search engine. This method ensures a value was set for each required property.
- (BOOL)searchEngineInformationWasFound;
{
  return ([[self searchEngineName] length] > 0 && 
          [[self searchEngineURL] length] > 0 &&
          [[self searchEngineURLRequestMethod] length] > 0);
}

@end
