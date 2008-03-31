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

#import "CHBrowserView+Spelling.h"

#import "NSString+Gecko.h"

#include "nsCOMPtr.h"
#include "nsCRT.h"
#include "nsIDocShell.h"
#include "nsIDOMElement.h"
#include "nsIDOMNSEditableElement.h"
#include "nsIDOMNSHTMLDocument.h"
#include "nsIDOMRange.h"
#include "nsIDOMWindow.h"
#include "nsIEditingSession.h"
#include "nsIEditor.h"
#include "nsIEditorSpellCheck.h"
#include "nsIFocusController.h"
#include "nsIInlineSpellChecker.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsISelection.h"
#include "nsPIDOMWindow.h"
#include "nsString.h"

#if MAC_OS_X_VERSION_MAX_ALLOWED <= MAC_OS_X_VERSION_10_4
// Declare private NSSpellChecker method (public as of 10.5).
@interface NSSpellChecker (PreLeopardWordLearning)
- (void)learnWord:(NSString *)word;
@end
#endif

@interface CHBrowserView (PrivateSpellingAdditions)

- (already_AddRefed<nsIEditor>)currentEditor;
- (void)getMisspelledWordRange:(nsIDOMRange**)outRange
            inlineSpellChecker:(nsIInlineSpellChecker**)outInlineChecker;

@end

@interface CHBrowserView (PrivateCHBrowserViewMethodsUsedForSpelling)

- (already_AddRefed<nsIDOMElement>)focusedDOMElement;
- (already_AddRefed<nsIFocusController>)focusController;

@end

@implementation CHBrowserView (SpellingMethods)

- (void)ignoreCurrentWord
{
  nsCOMPtr<nsIDOMRange> misspelledRange;
  nsCOMPtr<nsIInlineSpellChecker> inlineChecker;
  [self getMisspelledWordRange:getter_AddRefs(misspelledRange)
            inlineSpellChecker:getter_AddRefs(inlineChecker)];
  if (!(misspelledRange && inlineChecker))
    return;

  nsString misspelledWord;
  misspelledRange->ToString(misspelledWord);
  inlineChecker->IgnoreWord(misspelledWord);
}

- (void)learnCurrentWord
{
  nsCOMPtr<nsIDOMRange> misspelledRange;
  nsCOMPtr<nsIInlineSpellChecker> inlineChecker;
  [self getMisspelledWordRange:getter_AddRefs(misspelledRange)
            inlineSpellChecker:getter_AddRefs(inlineChecker)];
  if (!(misspelledRange && inlineChecker))
    return;

  nsString misspelledWord;
  misspelledRange->ToString(misspelledWord);
  // nsIInlineSpellChecker's AddWordToDictionary does not insert the learned
  // word into the shared system dictionary, and instead remembers it using its
  // own personal dictionary, so we use NSSpellChecker directly.
  // NSSpellChecker method |learnWord:| to achieve this functionality.
  [[NSSpellChecker sharedSpellChecker] learnWord:[NSString stringWith_nsAString:misspelledWord]];

  // check the range again to remove the misspelled word indication
  inlineChecker->SpellCheckRange(misspelledRange);
}

- (void)replaceCurrentWordWith:(NSString*)replacementText
{
  nsCOMPtr<nsIDOMRange> misspelledRange;
  nsCOMPtr<nsIInlineSpellChecker> inlineChecker;
  [self getMisspelledWordRange:getter_AddRefs(misspelledRange)
            inlineSpellChecker:getter_AddRefs(inlineChecker)];
  if (!(misspelledRange && inlineChecker))
    return;

  // Get the node and offset of the word to replace.
  nsCOMPtr<nsIDOMNode> endNode;
  PRInt32 endOffset = 0;
  misspelledRange->GetEndContainer(getter_AddRefs(endNode));
  misspelledRange->GetEndOffset(&endOffset);
  nsString newWord;
  [replacementText assignTo_nsAString:newWord];
  inlineChecker->ReplaceWord(endNode, endOffset, newWord);
}

- (NSArray*)suggestionsForCurrentWordWithMax:(unsigned int)maxSuggestions
{
  nsCOMPtr<nsIDOMRange> misspelledRange;
  nsCOMPtr<nsIInlineSpellChecker> inlineChecker;
  [self getMisspelledWordRange:getter_AddRefs(misspelledRange)
            inlineSpellChecker:getter_AddRefs(inlineChecker)];
  if (!(misspelledRange && inlineChecker))
    return nil;

  nsCOMPtr<nsIEditorSpellCheck> spellCheck;
  inlineChecker->GetSpellChecker(getter_AddRefs(spellCheck));
  if (!spellCheck)
    return nil;

  // ask the spellchecker to check the misspelled word, which seems redundant
  // but is necessary to generate the suggestions list.
  nsString currentWord;
  misspelledRange->ToString(currentWord);
  PRBool isIncorrect = NO;
  spellCheck->CheckCurrentWord(currentWord.get(), &isIncorrect);
  if (!isIncorrect)
    return nil;

  // Loop over the suggestions. The spellchecker will return an empty string
  // (*not* NULL) when it's done, so keep going until we get that or our max.
  NSMutableArray* suggestions = [NSMutableArray array];
  for (unsigned int i = 0; i < maxSuggestions; ++i) {
    PRUnichar* suggestion = nil;
    spellCheck->GetSuggestedWord(&suggestion);
    if (!nsCRT::strlen(suggestion))
      break;

    [suggestions addObject:[NSString stringWithPRUnichars:suggestion]];
    nsCRT::free(suggestion);
  }
  return suggestions;
}

- (BOOL)isSpellingEnabledForCurrentEditor
{
  nsCOMPtr<nsIEditor> editor = [self currentEditor];
  if (!editor)
    return NO;
  nsCOMPtr<nsIInlineSpellChecker> inlineChecker;
  editor->GetInlineSpellChecker(PR_TRUE, getter_AddRefs(inlineChecker));
  if (!inlineChecker)
    return NO;

  PRBool checkingIsEnabled = NO;
  inlineChecker->GetEnableRealTimeSpell(&checkingIsEnabled);
  return checkingIsEnabled ? YES : NO;
}

- (void)setSpellingEnabledForCurrentEditor:(BOOL)enabled
{
  PRBool enableSpelling = enabled ? PR_TRUE : PR_FALSE;
  nsCOMPtr<nsIEditor> editor = [self currentEditor];
  if (editor)
    editor->SetSpellcheckUserOverride(enableSpelling);
}

- (void)recheckSpelling
{
  nsCOMPtr<nsIEditor> editor = [self currentEditor];
  if (editor)
    editor->SyncRealTimeSpell();
}

- (void)setSpellingLanguage:(NSString*)language
{
  // The underlying spellcheck system is built on NSSpellChecker, but doesn't
  // yet understand the dictionary selection system, so just set it directly.
  [[NSSpellChecker sharedSpellChecker] setLanguage:language];

  // re-sync the spell checker to pick up the new language
  [self recheckSpelling];
}

# pragma mark -

// Returns the nsIEditor of the currently focused text area, input, or
// midas editor. The return value is addref'd.
- (already_AddRefed<nsIEditor>)currentEditor
{
  nsIEditor *editor = NULL;
  nsCOMPtr<nsIDOMElement> focusedElement = [self focusedDOMElement];
  nsCOMPtr<nsIDOMNSEditableElement> editElement = do_QueryInterface(focusedElement);

  if (editElement) {
    editElement->GetEditor(&editor); // addrefs
  }
  else {
    // if there's no element focused, we're probably in a Midas editor
    nsCOMPtr<nsIFocusController> controller = [self focusController];
    if (!controller)
      return NULL;

    nsCOMPtr<nsIDOMWindowInternal> winInternal;
    controller->GetFocusedWindow(getter_AddRefs(winInternal));
    nsCOMPtr<nsIDOMWindow> focusedWindow(do_QueryInterface(winInternal));
    if (!focusedWindow)
      return NULL;

    nsCOMPtr<nsIDOMDocument> domDoc;
    focusedWindow->GetDocument(getter_AddRefs(domDoc));
    nsCOMPtr<nsIDOMNSHTMLDocument> htmlDoc(do_QueryInterface(domDoc));
    if (!htmlDoc)
      return NULL;

    nsAutoString designMode;
    htmlDoc->GetDesignMode(designMode);
    if (designMode.EqualsLiteral("on")) {
      // we are in a Midas editor, so find its editor
      nsCOMPtr<nsPIDOMWindow> privateWindow = do_QueryInterface(focusedWindow);
      if (!privateWindow)
        return NULL;

      nsIDocShell *docshell = privateWindow->GetDocShell();
      nsCOMPtr<nsIEditingSession> editSession = do_GetInterface(docshell);
      if (!editSession)
        return NULL;

      editSession->GetEditorForWindow(focusedWindow, &editor); // addrefs
    }
  }
  return editor;
}

// Upon return, |outRange| contains the range of the currently misspelled word
// and |outInlineChecker| contains the inline spell checker to allow for further
// action. This method AddRef's both out parameters.
- (void)getMisspelledWordRange:(nsIDOMRange**)outRange
            inlineSpellChecker:(nsIInlineSpellChecker**)outInlineChecker
{
  if (!(outRange && outInlineChecker))
    return;
  *outRange = nsnull;
  *outInlineChecker = nsnull;

  nsCOMPtr<nsIEditor> editor = [self currentEditor];
  if (!editor)
    return;

  editor->GetInlineSpellChecker(PR_TRUE, outInlineChecker); // addrefs
  if (!*outInlineChecker)
    return;

  PRBool checkingIsEnabled = NO;
  (*outInlineChecker)->GetEnableRealTimeSpell(&checkingIsEnabled);
  if (!checkingIsEnabled)
    return;

  nsCOMPtr<nsISelection> selection;
  editor->GetSelection(getter_AddRefs(selection));
  if (!selection)
    return;

  nsCOMPtr<nsIDOMNode> selectionEndNode;
  PRInt32 selectionEndOffset = 0;
  selection->GetFocusNode(getter_AddRefs(selectionEndNode));
  selection->GetFocusOffset(&selectionEndOffset);

  // The misspelling "mispelled" is (sadly) deliberate; see bug 357465.
  (*outInlineChecker)->GetMispelledWord(selectionEndNode,
                                        (long)selectionEndOffset,
                                        outRange); // addrefs
}

@end
