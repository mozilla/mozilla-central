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

#import "FormFillController.h"
#import "CHBrowserView.h"
#import "FormFillPopup.h"
#import "KeychainAutoCompleteSession.h"
#import "PreferenceManager.h"

#import "NSString+Gecko.h"
#import "NSArray+Utils.h"

#include "GeckoUtils.h"
#include "nsString.h"
#include "nsPIDOMWindow.h"
#include "nsIDOMWindow.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIPrivateDOMEvent.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMEvent.h"
#include "nsIDOMHTMLFormElement.h"
#include "nsIDOMHTMLInputElement.h"
#include "nsIDOMNSHTMLInputElement.h"
#include "nsIDOMKeyEvent.h"

const int kFormFillMaxRows = 10;

@interface FormFillController(Private)

// Listener and autocomplete initialization and cleanup
- (void)browserResized:(NSNotification*)notification;
- (void)addResizeObserver:(NSWindow*)browserWindow;
- (void)removeResizeObserver:(NSWindow*)browserWindow;
- (void)addWindowListeners:(nsIDOMWindow*)aWindow;
- (void)removeWindowListeners:(nsIDOMWindow*)aWindow;
- (void)startControllingInputElement:(nsIDOMHTMLInputElement*)aInputElement;
- (void)stopControllingInputElement;

// Popup window management
- (BOOL)isPopupOpen;
- (void)openPopup;
- (void)closePopup;
- (void)shiftRowSelectionBy:(int)aRows;

// Autocomplete methods
- (void)startSearch:(NSString*)searchString;
- (void)dataReady;
- (void)autoCompleteFieldText;
- (void)filledAutoCompleteFieldText;

// Event handlers
- (void)focus:(nsIDOMEvent*)aEvent;
- (void)blur:(nsIDOMEvent*)aEvent;
- (void)unload:(nsIDOMEvent*)aEvent;
- (void)submit:(nsIDOMEvent*)aEvent;
- (void)input:(nsIDOMEvent*)aEvent;
- (void)keyPress:(nsIDOMEvent*)aEvent;
- (BOOL)handleKeyNavigation:(int)aKey;

// Utility methods
- (BOOL)IsCaretAtEndOfLine;

@end

NS_IMPL_ISUPPORTS1(FormFillListener, nsIDOMEventListener)

FormFillListener::FormFillListener(FormFillController* aController)
: mController(aController)
{
}

NS_IMETHODIMP FormFillListener::HandleEvent(nsIDOMEvent* aEvent)
{
  nsAutoString type;
  aEvent->GetType(type);

  if (type.Equals(NS_LITERAL_STRING("focus")))
    [mController focus:aEvent];
  else if (type.Equals(NS_LITERAL_STRING("blur")))
    [mController blur:aEvent];
  else if (type.Equals(NS_LITERAL_STRING("unload")))
    [mController unload:aEvent];
  else if (type.Equals(NS_LITERAL_STRING("submit")))
    [mController submit:aEvent];
  else if (type.Equals(NS_LITERAL_STRING("input")))
    [mController input:aEvent];
  else if (type.Equals(NS_LITERAL_STRING("keypress")))
    [mController keyPress:aEvent];
  return NS_OK; 
}

@implementation FormFillController

- (id)init
{
  if ((self = [super init])) {
    // mListener captures DOM and auto complete events.
    mListener = new FormFillListener(self);
    NS_ADDREF(mListener);

    // Initialize the password fill session.
    // History form fill session can also be added when someone writes it.
    mKeychainSession = [[KeychainAutoCompleteSession alloc] init];
  }

  return self;
}

- (void)dealloc
{
  // Remove ourselves as a focus listener from cached view.
  nsCOMPtr<nsIDOMWindow> domWindow = [mBrowserView contentWindow];
  if (domWindow)
    [self removeWindowListeners:domWindow];

  [self removeResizeObserver:[mBrowserView nativeWindow]];

  [mResults release];
  [mKeychainSession release];
  [mPopupWindow release];
  NS_IF_RELEASE(mListener);

  [super dealloc];
}

- (void)attachToBrowser:(CHBrowserView*)browser
{
  if (!browser)
    return;

  mBrowserView = browser;

  // Listen for focus events on the domWindow of the browser view.
  nsCOMPtr<nsIDOMWindow> domWindow = [mBrowserView contentWindow];
  if (domWindow)
    [self addWindowListeners:domWindow];
}

- (void)browserResized:(NSNotification*)notification
{
  [self closePopup];
}

- (void)addResizeObserver:(NSWindow*)browserWindow
{
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(browserResized:)
                                               name:NSWindowDidResizeNotification
                                             object:browserWindow];
}

- (void)removeResizeObserver:(NSWindow*)browserWindow
{
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:NSWindowDidResizeNotification
                                                object:browserWindow];
}

- (void)addWindowListeners:(nsIDOMWindow*)aWindow
{
  nsCOMPtr<nsPIDOMWindow> privateDOMWindow = do_QueryInterface(aWindow);
  if (!privateDOMWindow)
    return;

  nsPIDOMEventTarget* chromeEventHandler = privateDOMWindow->GetChromeEventHandler();

  nsCOMPtr<nsIDOMEventTarget> target = do_QueryInterface(chromeEventHandler);
  if (!target)
    return;

  target->AddEventListener(NS_LITERAL_STRING("focus"),
                           static_cast<nsIDOMEventListener*>(mListener),
                           PR_TRUE);

  target->AddEventListener(NS_LITERAL_STRING("blur"),
                           static_cast<nsIDOMEventListener*>(mListener),
                           PR_TRUE);

  target->AddEventListener(NS_LITERAL_STRING("unload"),
                           static_cast<nsIDOMEventListener*>(mListener),
                           PR_TRUE);

  target->AddEventListener(NS_LITERAL_STRING("submit"),
                           static_cast<nsIDOMEventListener*>(mListener),
                           PR_TRUE);

  target->AddEventListener(NS_LITERAL_STRING("input"),
                           static_cast<nsIDOMEventListener*>(mListener),
                           PR_TRUE);

  target->AddEventListener(NS_LITERAL_STRING("keypress"),
                           static_cast<nsIDOMEventListener*>(mListener),
                           PR_TRUE);
}

- (void)removeWindowListeners:(nsIDOMWindow*)aWindow
{
  [self stopControllingInputElement];

  nsCOMPtr<nsPIDOMWindow> privateDOMWindow = do_QueryInterface(aWindow);
  if (!privateDOMWindow)
    return;

  nsPIDOMEventTarget* chromeEventHandler = privateDOMWindow->GetChromeEventHandler();

  nsCOMPtr<nsIDOMEventTarget> target = do_QueryInterface(chromeEventHandler);
  if (!target)
    return;

  target->RemoveEventListener(NS_LITERAL_STRING("focus"),
                              static_cast<nsIDOMEventListener*>(mListener),
                              PR_TRUE);

  target->RemoveEventListener(NS_LITERAL_STRING("blur"),
                              static_cast<nsIDOMEventListener*>(mListener),
                              PR_TRUE);

  target->RemoveEventListener(NS_LITERAL_STRING("unload"),
                              static_cast<nsIDOMEventListener*>(mListener),
                              PR_TRUE);

  target->RemoveEventListener(NS_LITERAL_STRING("submit"),
                              static_cast<nsIDOMEventListener*>(mListener),
                              PR_TRUE);

  target->RemoveEventListener(NS_LITERAL_STRING("input"),
                              static_cast<nsIDOMEventListener*>(mListener),
                              PR_TRUE);

  target->RemoveEventListener(NS_LITERAL_STRING("keypress"),
                              static_cast<nsIDOMEventListener*>(mListener),
                              PR_TRUE);
}

- (void)startControllingInputElement:(nsIDOMHTMLInputElement*)aInputElement
{
  // Make sure we're not still attached to an input element.
  [self stopControllingInputElement];

  // Set the autocomplete session for this input.  Currently, only password autocomplete
  // but other sessions like form fill history can be added here.
  mUsernameFillEnabled = [mKeychainSession attachToInput:aInputElement];

  // If this is not a valid auto-complete input, we can return now.
  if (!mUsernameFillEnabled)
    return;

  // Cache the input element.
  mFocusedInputElement = aInputElement;

  // Create the popup window if it doesn't exist.
  if (!mPopupWindow) {
    mPopupWindow = [[FormFillPopup alloc] init];
    [mPopupWindow attachToController:self];
  }
}

- (void)stopControllingInputElement
{
  if (mPopupWindow) {
    [self closePopup];
    [mPopupWindow setItems:nil];
  }

  mFocusedInputElement = nsnull;

  // Stop sending search requests to auto-form fill.
  mUsernameFillEnabled = NO;

  [mResults release];
  mResults = nil;
}

-(void)autoCompleteFoundResults:(AutoCompleteResults*)results
{
  [mResults release];
  mResults = nil;

  if ([[results matches] count] > 0) {
    mResults = [results retain];
    [self dataReady];
  }
  else {
    [mPopupWindow setItems:nil];
    [self closePopup];
  }
}

- (BOOL)isPopupOpen
{
  return mPopupWindow ? [mPopupWindow isPopupOpen] : NO;
}

- (void)openPopup
{
  // Only open popup if it's not already open.
  if ([self isPopupOpen])
    return;

  // Make sure input field is visible before showing popup.
  GeckoUtils::ScrollElementIntoView(mFocusedInputElement);

  nsIntRect inputIntRect;
  if (!(GeckoUtils::GetFrameInScreenCoordinates(mFocusedInputElement, &inputIntRect)))
    return;

  NSRect inputElementFrame = NSMakeRect(inputIntRect.x, inputIntRect.y, inputIntRect.width, inputIntRect.height);

  NSScreen* mainScreen = [[NSScreen screens] firstObject];  // NSArray category method
  if (!mainScreen)
    return;

  NSPoint origin = inputElementFrame.origin;
  float width = NSWidth(inputElementFrame);

  // y-flip and subtract the control height to convert to cocoa coords
  origin.y = NSMaxY([mainScreen frame]) - inputElementFrame.origin.y - inputElementFrame.size.height;

  // To account for the text box border, shift rectangle position to the right by 2 pixels
  // and reduce the width by 3 pixels.
  // TODO: check shift here, still not aligned sometimes.
  origin.x += 2.0;
  width -= 3.0;

  [mPopupWindow openPopup:[mBrowserView nativeWindow] withOrigin:origin width:width];

  // Listen for resize events to close the popup.
  [self addResizeObserver:[mBrowserView nativeWindow]];
}

- (void)closePopup
{
  if (mPopupWindow) {
    // Deselecting the row prevents a flash when popup is opened and default is selected.
    [mPopupWindow selectRow:-1];
    [mPopupWindow closePopup];
    [self removeResizeObserver:[mBrowserView nativeWindow]];
  }
}

- (void)shiftRowSelectionBy:(int)aRows
{
  int row = [mPopupWindow selectedRow] + aRows;

  // pin result at top row
  if (row < 0)
    row = 0;

  // pin result at bottom row
  int numRows = [mPopupWindow rowCount];
  if (row >= numRows)
    row = numRows - 1;

  [mPopupWindow selectRow:row];
}

//
// popupSelected
//
// Called when a new item in the popup window is selected, either by mouse click
// or keyboard movement.  The form field is set to the value of the selected item
// and  an autocomplete event is sent for any listeners
- (void)popupSelected
{
  if (![self isPopupOpen] || !mResults)
    return;

  int row = [mPopupWindow selectedRow];
  if (row < 0)
    return;

  nsAutoString value;
  [[mPopupWindow resultForRow:row] assignTo_nsAString:value];
  mFocusedInputElement->SetValue(value);

  // Auto-fill the input so that untyped letters are selected.
  nsCOMPtr<nsIDOMNSHTMLInputElement> nsInput = do_QueryInterface(mFocusedInputElement);
  if (nsInput) {
    int searchLength = [[mResults searchString] length];
    nsInput->SetSelectionStart((PRInt32)searchLength);
  }

  // Send an autocomplete DOM event any time auto fill is done.
  [self filledAutoCompleteFieldText];
}

- (void)startSearch:(NSString*)searchString;
{  
  // Check if password autocomplete is enabled.
  // Form history autocomplete can be added here.
  if (mUsernameFillEnabled) {
    [mKeychainSession startAutoCompleteWithSearch:searchString
                                  previousResults:mResults
                                         listener:self];
  }
}

- (void)dataReady
{
  [mPopupWindow setItems:[mResults matches]];

  // Open the popup if more than one result is returned.
  // Also require mCompleteResult since it prevents a backspace from opening popup
  // even though we want to search on a backspace to get the larger result set.
  if ([mPopupWindow rowCount] > 1 && mCompleteResult)
    [self openPopup];
  else 
    [self closePopup];

  // Prevents backspace from auto-completing the result we just erased.
  if (mCompleteResult)
    [self autoCompleteFieldText];
}

//
// autoCompleteFieldText
//
// Called when FormFillController should fill the text field with the default
// autocomplete result.
- (void)autoCompleteFieldText
{
  if (!mResults)
    return;

  NSArray* matches = [mResults matches];

  // Select the default if it's available.
  // Otherwise, select the first username in the list.
  int defaultIndex = [mResults defaultIndex];

  nsAutoString value;
  [[matches objectAtIndex:defaultIndex] assignTo_nsAString:value];
  mFocusedInputElement->SetValue(value);

  // Auto-fill the input such that untyped letters are selected.
  nsCOMPtr<nsIDOMNSHTMLInputElement> nsInput = do_QueryInterface(mFocusedInputElement);
  if (nsInput) {
    int searchLength = [[mResults searchString] length];
    nsInput->SetSelectionStart((PRInt32)searchLength);
  }

  // Select the default entry in the popup.
  if ([self isPopupOpen])
    [mPopupWindow selectRow:defaultIndex];

  // Send a DOM event any time auto fill is done.
  [self filledAutoCompleteFieldText];
}

//
// filledAutoCompleteFieldText
//
// Called whenever the form element is filled.  It sends a DOM event 
// "DOMAutoComplete" that can be listened for, e.g., to fill a password
// when a username element is completed.
//
- (void)filledAutoCompleteFieldText
{
  if (!mFocusedInputElement)
    return;

  nsCOMPtr<nsIDOMDocument> domDoc;
  mFocusedInputElement->GetOwnerDocument(getter_AddRefs(domDoc));

  nsCOMPtr<nsIDOMDocumentEvent> doc = do_QueryInterface(domDoc);
  if (!doc)
    return;

  nsCOMPtr<nsIDOMEvent> event;
  doc->CreateEvent(NS_LITERAL_STRING("Events"), getter_AddRefs(event));
  nsCOMPtr<nsIPrivateDOMEvent> privateEvent = do_QueryInterface(event);
  if (!privateEvent)
    return;

  event->InitEvent(NS_LITERAL_STRING("DOMAutoComplete"), PR_TRUE, PR_TRUE);

  privateEvent->SetTrusted(PR_TRUE);

  nsCOMPtr<nsIDOMEventTarget> target = do_QueryInterface(mFocusedInputElement);

  PRBool defaultActionEnabled;
  target->DispatchEvent(event, &defaultActionEnabled);
}

//
// focus
//
// When a new element is selected, check whether we allow autocomplete.
// If autocomplete is allowed, start controlling the input to that element.
//
- (void)focus:(nsIDOMEvent*)aEvent
{
  nsCOMPtr<nsIDOMEventTarget> target;
  aEvent->GetTarget(getter_AddRefs(target));

  nsCOMPtr<nsIDOMHTMLInputElement> inputElement = do_QueryInterface(target);
  if (!inputElement)
    return;

  nsAutoString type;
  inputElement->GetType(type);
  if (!type.LowerCaseEqualsLiteral("text"))
    return;

  PRBool isReadOnly = PR_FALSE;
  if (NS_FAILED(inputElement->GetReadOnly(&isReadOnly)) || isReadOnly)
    return;

  PRBool autoCompleteOverride = [[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefIgnoreAutocompleteOff
                                                                       withSuccess:NULL];

  if (!autoCompleteOverride) {
    nsAutoString autocomplete;
    inputElement->GetAttribute(NS_LITERAL_STRING("autocomplete"), autocomplete);

    if (autocomplete.EqualsIgnoreCase("off"))
      return;

    nsCOMPtr<nsIDOMHTMLFormElement> form;
    inputElement->GetForm(getter_AddRefs(form));
    if (form) {
      form->GetAttribute(NS_LITERAL_STRING("autocomplete"), autocomplete);
      if (autocomplete.EqualsIgnoreCase("off"))
        return;
    }
  }

  [self startControllingInputElement:inputElement];
}

//
// blur
//
// Anytime focus moves from an element, stop autocompleting it until next
// input element is focused.
//
- (void)blur:(nsIDOMEvent*)aEvent
{
  if (mFocusedInputElement)
    [self stopControllingInputElement];
}

//
// unload
//
// Stop autocompleting on a page if it is unloaded.
//
- (void)unload:(nsIDOMEvent*)aEvent
{
  if (mFocusedInputElement) {
    nsCOMPtr<nsIDOMEventTarget> target;
    aEvent->GetTarget(getter_AddRefs(target));

    nsCOMPtr<nsIDOMDocument> eventDoc = do_QueryInterface(target);
    nsCOMPtr<nsIDOMDocument> inputDoc;
    mFocusedInputElement->GetOwnerDocument(getter_AddRefs(inputDoc));

    if (eventDoc == inputDoc)
      [self stopControllingInputElement];
  }
}

//
// submit
//
// If a form is submitted, stop autocompleting.
//
- (void)submit:(nsIDOMEvent*)aEvent
{
  if (mFocusedInputElement)
    [self stopControllingInputElement];
}

//
// input
//
// If an HTML input box is being controlled, do a search when input occurs.
//
- (void)input:(nsIDOMEvent*)aEvent
{
  nsCOMPtr<nsIDOMEventTarget> target;
  aEvent->GetTarget(getter_AddRefs(target));

  nsCOMPtr<nsIDOMHTMLInputElement> input = do_QueryInterface(target);

  if (input && mFocusedInputElement == input) {
    nsAutoString value;
    mFocusedInputElement->GetValue(value);
    [self startSearch:[NSString stringWith_nsAString:value]];
  }
}

//
// keyPress
//
// This is triggered when a key is pressed but before an 'input' is triggered.
// It also handles non-input keys like arrow keys.
//
- (void)keyPress:(nsIDOMEvent*)aEvent
{
  if (!mFocusedInputElement)
    return;

  nsCOMPtr<nsIDOMKeyEvent> keyEvent = do_QueryInterface(aEvent);
  if (!keyEvent)
    return;

  // By default, allow keystroke to continue to the next listener.
  BOOL cancel = NO;

  // By default, autocomplete on keystrokes that later trigger 'input' events.
  mCompleteResult = YES;

  PRUint32 k;
  keyEvent->GetKeyCode(&k);
  switch (k) {
  case nsIDOMKeyEvent::DOM_VK_UP:
  case nsIDOMKeyEvent::DOM_VK_DOWN:
  case nsIDOMKeyEvent::DOM_VK_PAGE_UP:
  case nsIDOMKeyEvent::DOM_VK_PAGE_DOWN:
    cancel = [self handleKeyNavigation:k];
    break;
  case nsIDOMKeyEvent::DOM_VK_ESCAPE:
  case nsIDOMKeyEvent::DOM_VK_RETURN:
    cancel = [self isPopupOpen];
    [self closePopup];
    break;
  case nsIDOMKeyEvent::DOM_VK_BACK_SPACE:
  case nsIDOMKeyEvent::DOM_VK_DELETE:
    // Don't allow autocomplete of 'input' event if it's due to a back space or
    // delete.
    mCompleteResult = NO;
    break;
  }

  if (cancel) {
    aEvent->StopPropagation();
    aEvent->PreventDefault();
  }
}

//
// handleKeyNavigation
//
// Handles key events that are for navigation of the popup window.
// Should return YES if the event should be cancelled and not propagated.
//
- (BOOL)handleKeyNavigation:(int)aKey
{
  switch (aKey) {
  case nsIDOMKeyEvent::DOM_VK_UP:
    if ([self isPopupOpen]) {
      [self shiftRowSelectionBy:-1];
      [self popupSelected];
      return YES;
    }
    break;
  case nsIDOMKeyEvent::DOM_VK_DOWN:
    if ([self isPopupOpen]) {
      [self shiftRowSelectionBy:1];
      [self popupSelected];
      return YES;
    }
    else if ([self IsCaretAtEndOfLine]) {
      nsAutoString value;
      mFocusedInputElement->GetValue(value);
      [self startSearch:[NSString stringWith_nsAString:value]];
      return YES;
    }
    break;
  case nsIDOMKeyEvent::DOM_VK_PAGE_UP:
    if ([self isPopupOpen]) {
      [self shiftRowSelectionBy:-kFormFillMaxRows];
      [self popupSelected];
      return YES;
    }
    break;
  case nsIDOMKeyEvent::DOM_VK_PAGE_DOWN:
    if ([self isPopupOpen]) {
      [self shiftRowSelectionBy:kFormFillMaxRows];
      [self popupSelected];
      return YES;
    }
    else {
      nsAutoString value;
      mFocusedInputElement->GetValue(value);
      [self startSearch:[NSString stringWith_nsAString:value]];
      return YES;
    }
    break;
  }

  return NO;
}

- (BOOL)IsCaretAtEndOfLine
{
  if (!mFocusedInputElement)
    return NO;

  nsCOMPtr<nsIDOMNSHTMLInputElement> nsInput = do_QueryInterface(mFocusedInputElement);
  if (!nsInput)
    return NO;

  PRInt32 selectStart;
  nsInput->GetSelectionStart(&selectStart);

  PRInt32 textLength;
  nsInput->GetTextLength(&textLength);

  return (selectStart == textLength);
}

@end
