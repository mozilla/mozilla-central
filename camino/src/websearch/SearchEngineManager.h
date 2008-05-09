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

// The following notification is sent whenever a search engine has been
// added, renamed, moved, etc. in the |installedSearchEngines| collection.
// Also sent when the preferred search engine is modified.
extern NSString *const kInstalledSearchEnginesDidChangeNotification;

// Search engine description keys.
extern NSString *const kWebSearchEngineNameKey;
extern NSString *const kWebSearchEngineURLKey;
// Optional key so we can identify engines installed from a plugin without relying on their name:
extern NSString *const kWebSearchEngineWhereFromKey;

//
// SearchEngineManager
//
// A shared object that coordinates all interaction with our collection
// of built-in web search engines. 
//
@interface SearchEngineManager : NSObject
{
@private
  NSMutableArray *mInstalledSearchEngines;      // strong
  NSString       *mPreferredSearchEngine;       // strong
  NSString       *mPathToSavedSearchEngineInfo; // strong
}

+ (SearchEngineManager *)sharedSearchEngineManager;

// Returns an array of dictionaries, using the keys above, to describe the
// installed search engines. There will always be at least one engine installed.
- (NSArray *)installedSearchEngines;

// Convienence method; returns an array of strings, consisting of only the names of the
// installed search engines. Ordered identically to |installedSearchEngines|.
- (NSArray *)installedSearchEngineNames;

- (NSString *)preferredSearchEngine;
- (void)setPreferredSearchEngine:(NSString *)newPreferredSearchEngine;

// Adds the plugin to the end of |installedSearchEngines|.
// Return value indicates whether the plugin was successfully parsed and a new engine added.
// If NO is returned, |outError| is populated with an NSError object containing a localized
// description of the problem. Pass NULL if you do not want error information.
- (BOOL)addSearchEngineFromPlugin:(NSDictionary *)searchPluginInfoDict error:(NSError**)error;

- (BOOL)hasSearchEngineFromPluginURL:(NSString *)pluginURL;
- (NSDictionary *)searchEngineFromPluginURL:(NSString *)pluginURL;

- (void)addSearchEngineWithName:(NSString *)engineName searchURL:(NSString *)engineURL pluginURL:(NSString *)pluginURL;

- (void)renameSearchEngineAtIndex:(unsigned)index to:(NSString *)newEngineName;
- (void)moveSearchEnginesAtIndexes:(NSIndexSet *)indexes toIndex:(unsigned)destinationIndex;

- (void)removeSearchEngineAtIndex:(unsigned)index;
- (void)removeSearchEnginesAtIndexes:(NSIndexSet *)indexes;

// Removes all existing engine info and reverts back to the initial default engine list 
// and preferred engine selection from the application bundle.
- (void)revertToDefaultSearchEngines;

@end
