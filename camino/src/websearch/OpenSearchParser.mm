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

#import "OpenSearchParser.h"

#define MIN_PARAMETER_LENGTH 2

// XML element names we're interested in.
static NSString *const kSearchEngineNameElement = @"ShortName";
static NSString *const kSearchEngineURLElement = @"Url";
static NSString *const kSearchEngineURLParameterElement = @"Param";

// Template URL parameters
static NSString *const kSearchTermsURLParameter = @"searchTerms";
static NSString *const kInputEncodingURLParameter = @"inputEncoding";
static NSString *const kOutputEncodingURLParameter = @"outputEncoding";
static NSString *const kStartingResultIndexURLParameter = @"startIndex";
static NSString *const kResultCountURLParameter = @"count";
static NSString *const kStartingResultPageURLParameter = @"startPage";
static NSString *const kLanguageURLParameter = @"language";

// Default values for template URL parameters.
static NSString *const kSearchTermsToken = @"\%s";
static NSString *const kDefaultEncoding = @"UTF-8";
static NSString *const kDefaultStartingResultIndex = @"1";
static NSString *const kDefaultResultCount = @"20";
static NSString *const kDefaultStartingResultPage = @"1";
static NSString *const kDefaultLanguage = @"*"; // '*' is defined in OS spec to indicate any language

@interface OpenSearchParser (Private)

- (void)insertValuesForParametersInURLTemplate:(NSMutableString *)templateURL;

@end

@implementation OpenSearchParser

- (id)init
{
  if ((self = [super init])) {
    [self setShouldParseContentsOfElements:[NSSet setWithObject:kSearchEngineNameElement]];
    [self setShouldParseAttributesOfElements:[NSSet setWithObjects:kSearchEngineURLElement,
                                                                   kSearchEngineURLParameterElement,
                                                                   nil]];

    mURLParametersAndKnownValues = [[NSDictionary alloc] initWithObjectsAndKeys:
      kSearchTermsToken, kSearchTermsURLParameter,
      kDefaultEncoding, kInputEncodingURLParameter,
      kDefaultEncoding, kOutputEncodingURLParameter,
      nil];

    mURLParametersAndGuessedDefaultValues = [[NSDictionary alloc] initWithObjectsAndKeys:
      kDefaultStartingResultIndex, kStartingResultIndexURLParameter,
      kDefaultResultCount, kResultCountURLParameter,
      kDefaultStartingResultPage, kStartingResultPageURLParameter,
      kDefaultLanguage, kLanguageURLParameter,
      nil];
  }
  return self;
}

- (void)dealloc
{
  [mURLParametersAndKnownValues release];
  [mURLParametersAndGuessedDefaultValues release];
  [super dealloc];
}

#pragma mark -

- (void)foundAttributes:(NSDictionary *)attributeDict forElement:(NSString *)elementName
{
  if ([elementName isEqualToString:kSearchEngineURLElement]) {
    // The search URL is packed into an attribute on the 'Url' element, so we can set the whole thing here.
    // Example: <Url type="text/html" method="method" template="searchURL">

    NSString *mimeType = [attributeDict objectForKey:@"type"];
    NSString *method = [attributeDict objectForKey:@"method"];
    // The OS Spec lists method as an optional attribute...
    // default to "GET" if not specified.
    if (!method || [method isEqualToString:@""])
      method = @"GET";

    // The spec alows multiple <Url> elements, so we can't just abort parsing if this one isn't supported.
    if ([self browserSupportsSearchQueryURLWithMIMEType:mimeType] &&
        [attributeDict objectForKey:@"template"])
    {
      NSMutableString *searchURLTemplate = [NSMutableString stringWithString:[attributeDict objectForKey:@"template"]];
      [self insertValuesForParametersInURLTemplate:searchURLTemplate];
      [self setSearchEngineURL:searchURLTemplate];
      [self setSearchEngineURLRequestMethod:method];
    }
  }
  else if ([elementName isEqualToString:kSearchEngineURLParameterElement]) {
    // Older drafts of the OpenSearch spec allow "<Param>" elements inside "<Url>".  When used, only
    // a base search URL template is specified, requiring us to manually append each query parameter.

    NSMutableString *searchURL = [[[self searchEngineURL] mutableCopy] autorelease];
    if (!searchURL)
      return;

    NSString *paramName = [attributeDict objectForKey:@"name"];
    NSString *paramValue = [attributeDict objectForKey:@"value"];
    // Append the query param differently depending if it's the first one or not.
    NSRange queryStartRange = [searchURL rangeOfString:@"?"];
    if (queryStartRange.location == NSNotFound)
      [searchURL appendFormat:@"?%@=%@", paramName, paramValue];
    else
      [searchURL appendFormat:@"&%@=%@", paramName, paramValue];

    [self insertValuesForParametersInURLTemplate:searchURL];
    [self setSearchEngineURL:searchURL];
  }
}

- (void)foundContents:(NSString *)stringContents forElement:(NSString *)elementName
{
  if ([elementName isEqualToString:kSearchEngineNameElement])
    [self setSearchEngineName:stringContents];
}

- (void)insertValuesForParametersInURLTemplate:(NSMutableString *)templateURL
{
  // Template URLs contain various parameters, represented in the form '{paramName}'.
  // Engines can specify that a parameter is optional by appending a '?' to the name.

  // Example: http://example.com/?q={searchTerms}&amp;pw={startPage?}

  NSScanner *urlScanner = [NSScanner scannerWithString:templateURL];

  while (![urlScanner isAtEnd]) {
    NSString *currentParameter = nil;
    [urlScanner scanUpToString:@"{" intoString:NULL];
    [urlScanner scanString:@"{" intoString:NULL];
    [urlScanner scanUpToString:@"}" intoString:&currentParameter];
    if ([currentParameter length] < MIN_PARAMETER_LENGTH)
      continue;

    // |currentParameter| now equals either 'paramName' or 'paramName?'

    // Search the end of the parameter name for an optional indicator.
    BOOL parameterIsOptional = NO;
    if ([currentParameter hasSuffix:@"?"]) {
      parameterIsOptional = YES;
      // chop off the optional indicator.
      currentParameter = [currentParameter substringToIndex:([currentParameter length] - 1)];
    }

    // If we know the correct value for a parameter, we'll fill it in regardless of whether it's optional.
    // If we don't know for sure the correct value, and it is required, insert an acceptable default.
    // Otherwise, just insert an empty string.
    NSString *valueForCurrentParameter = [mURLParametersAndKnownValues objectForKey:currentParameter];
    if (!valueForCurrentParameter && !parameterIsOptional)
      valueForCurrentParameter = [mURLParametersAndGuessedDefaultValues objectForKey:currentParameter];
    if (!valueForCurrentParameter)
      valueForCurrentParameter = @"";

    // We need to add on the extra parameter indication characters (e.g. braces, question mark)
    // to find the entire parameter needing replacement in the template.
    NSString *stringToReplace = nil;
    if (parameterIsOptional)
      stringToReplace = [NSString stringWithFormat:@"{%@?}", currentParameter];
    else
      stringToReplace = [NSString stringWithFormat:@"{%@}", currentParameter];

    [templateURL replaceOccurrencesOfString:stringToReplace
                                 withString:valueForCurrentParameter
                                    options:0
                                      range:NSMakeRange(0, [templateURL length])];
  }
}

@end
