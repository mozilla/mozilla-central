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
#import "AutoCompleteUtils.h"

#include "nsIDOMEventListener.h"

extern const int kFormFillMaxRows;

@class KeychainAutoCompleteSession;
@class CHBrowserView;
@class FormFillPopup;
@class FormFillController;

class nsIDOMHTMLInputElement;

// FormFillListener
//
// The FormFillListener object listens for DOM events and the corresponding
// methods in the FormFillController are called for handling.
//
class FormFillListener : public nsIDOMEventListener
{ 
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIDOMEVENTLISTENER

  FormFillListener(FormFillController* aController);

protected:
  FormFillController*  mController;     // weak
};

// FormFillController
//
// Manages the FormFillPopup windows that contain search results
// as well as sending search requests to the KeychainAutoCompleteSession
// and listening for search results.  This can be extended to send
// search requests to a form history session as well.
@interface FormFillController : NSObject <AutoCompleteListener>
{
  KeychainAutoCompleteSession*  mKeychainSession;     // strong
  AutoCompleteResults*          mResults;             // strong
  FormFillListener*             mListener;            // strong
  FormFillPopup*                mPopupWindow;         // strong

  CHBrowserView*                mBrowserView;         // weak
  nsIDOMHTMLInputElement*       mFocusedInputElement; // weak

  // mCompleteResult determines if the current search should complete the default
  // result when ready. This prevents backspace/delete from autocompleting.
  BOOL mCompleteResult;

  // mUsernameFillEnabled determines whether we send searches to the Keychain
  // Service.  Form fill history value can be added here as well.
  BOOL mUsernameFillEnabled;
}

- (void)attachToBrowser:(CHBrowserView*)browser;

// Callback function for when a row in the focused popup window is clicked.
- (void)popupSelected;

@end
