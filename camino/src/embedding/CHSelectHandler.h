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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Hyatt <hyatt@mozilla.org> (Original Author)
 *   Ian Leue <froodian@gmail.com>
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

#ifndef CHSelectHandler_h_
#define CHSelectHandler_h_

#include <Cocoa/Cocoa.h>

#include "nsIDOMMouseListener.h"
#include "nsIDOMKeyListener.h"

// This class is a hack.  It listens to user mouse and key events so we know
// when to build and show our native menus for <select> items
class CHSelectHandler :  public nsIDOMMouseListener,
                         public nsIDOMKeyListener
{
public:
  CHSelectHandler();
  virtual ~CHSelectHandler();

  NS_DECL_ISUPPORTS

  // DOM event listener interface.
  NS_IMETHOD HandleEvent(nsIDOMEvent* aEvent) { return NS_OK; };

  // DOM mouse listener interface
  NS_IMETHOD MouseDown(nsIDOMEvent* aMouseEvent);
  NS_IMETHOD MouseUp(nsIDOMEvent* aMouseEvent) { return NS_OK; };
  NS_IMETHOD MouseClick(nsIDOMEvent* aMouseEvent) { return NS_OK; };
  NS_IMETHOD MouseDblClick(nsIDOMEvent* aMouseEvent) { return NS_OK; };
  NS_IMETHOD MouseOver(nsIDOMEvent* aMouseEvent) { return NS_OK; };
  NS_IMETHOD MouseOut(nsIDOMEvent* aMouseEvent) { return NS_OK; };

  // DOM key listener interface
  NS_IMETHOD KeyDown(nsIDOMEvent* aKeyEvent);
  NS_IMETHOD KeyUp(nsIDOMEvent* aKeyEvent) { return NS_OK; };
  NS_IMETHOD KeyPress(nsIDOMEvent* aKeyEvent) { return NS_OK; };
};


#endif
