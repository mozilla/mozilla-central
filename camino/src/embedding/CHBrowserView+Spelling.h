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
 * Mike Pinkerton
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Pinkerton
 *   Stuart Morgan <stuart.morgan@alumni.case.edu>
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

#import "CHBrowserView.h"

// Spelling methods for CHBrowserView. Note that these are all specific to the
// currently focused editor, not the whole browser view, so if there is ever a
// wrapper for nsIEditor these methods would belong there instead.
@interface CHBrowserView (SpellingMethods)

// Sets the spell checker to ignore the word under the text insertion point.
// Lasts for the duration of the active editing session only.
- (void)ignoreCurrentWord;

// Sets the spell checker to learn the word under the text insertion point.
// This permanently adds the word to the user's OS dictionary.
- (void)learnCurrentWord;

// Replaces the word under the text insertion point with |replacementText|.
- (void)replaceCurrentWordWith:(NSString*)replacementText;

// Returns an array of up to |maxSuggestions| suggested corrections for the word
// under the text insertion point, or |nil| if the word is not misspelled.
- (NSArray*)suggestionsForCurrentWordWithMax:(unsigned int)maxSuggestions;

// Returns whether or not spell check is enabled for the current editor.
- (BOOL)isSpellingEnabledForCurrentEditor;
// Enables or disables spelling for the current editor.
- (void)setSpellingEnabledForCurrentEditor:(BOOL)enabled;

// Re-runs the spell checker for the current editor.
- (void)recheckSpelling;

// Sets the current spelling language to |language| (a language/locale code).
- (void)setSpellingLanguage:(NSString*)language;

@end
