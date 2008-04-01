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
* The Initial Developer of the Original Code is
*   Stuart Morgan
* Portions created by the Initial Developer are Copyright (C) 2007
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
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

#import <Foundation/Foundation.h>

#import "ContentDispatchChooser.h"

#import "CHBrowserService.h"
#import "CHBrowserView.h"
#import "NSString+Gecko.h"
#include "nsIDOMWindow.h"
#include "nsIHandlerService.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIMIMEInfo.h"
#include "nsIServiceManager.h"
#include "nsIURI.h"
#include "nsString.h"

static const char* handlerServiceContractID = "@mozilla.org/uriloader/handler-service;1";

NS_IMPL_ISUPPORTS1(ContentDispatchChooser, nsIContentDispatchChooser);

ContentDispatchChooser::ContentDispatchChooser()
{
}

ContentDispatchChooser::~ContentDispatchChooser()
{
}

NS_IMETHODIMP ContentDispatchChooser::Ask(nsIHandlerInfo *aHandler,
                                          nsIInterfaceRequestor *aWindowContext,
                                          nsIURI *aURI,
                                          PRUint32 aReason)
{
  // TODO: ideally we'd like a non-modal version of nsAlertController's sheets
  // for this case (we want to use nsAlertController for visual consistency).
  nsAlertController* controller = [[[nsAlertController alloc] init] autorelease];

  NSWindow* parentWindow = nil;
  nsCOMPtr<nsIDOMWindow> domWindow(do_GetInterface(aWindowContext));
  if (domWindow) {
    CHBrowserView* browserView = [CHBrowserView browserViewFromDOMWindow:domWindow];
    parentWindow = [browserView nativeWindow];
  }

  nsCAutoString scheme;
  aURI->GetScheme(scheme);
  NSString* linkType = [NSString stringWith_nsACString:scheme];

  PRBool hasDefault = PR_FALSE;
  aHandler->GetHasDefaultHandler(&hasDefault);
  if (hasDefault) {
    nsAutoString defaultDesc;
    nsresult rv = aHandler->GetDefaultDescription(defaultDesc);
    NSString* handlerName = nil;
    if (NS_SUCCEEDED(rv))
      handlerName = [NSString stringWith_nsAString:defaultDesc];
    else
      handlerName = NSLocalizedString(@"UnknownContentHandler", nil);

    NSString* openButton = [NSString stringWithFormat:NSLocalizedString(@"OpenExternalHandlerOpenButon", nil),
                                                      handlerName];
    NSString* cancelButton = NSLocalizedString(@"OpenExternalHandlerCancelButton", nil);
    NSString* title = [NSString stringWithFormat:NSLocalizedString(@"OpenExternalHandlerTitle", nil),
                                                 handlerName];
    NSString* text = [NSString stringWithFormat:NSLocalizedString(@"OpenExternalHandlerText", nil),
                                                linkType, handlerName];
    NSString* checkboxText = [NSString stringWithFormat:NSLocalizedString(@"OpenExternalHandlerRemember", nil),
                                                        linkType];
    BOOL dontAskAgain = NO;
    int choice = [controller confirmCheckEx:parentWindow
                                      title:title
                                       text:text
                                    button1:openButton
                                    button2:cancelButton
                                    button3:nil
                                   checkMsg:checkboxText
                                 checkValue:&dontAskAgain];

    if (choice == NSAlertDefaultReturn) {
      if (dontAskAgain) {
        aHandler->SetPreferredAction(nsIHandlerInfo::useSystemDefault);
        aHandler->SetAlwaysAskBeforeHandling(PR_FALSE);
        nsCOMPtr<nsIHandlerService> handlerService(do_GetService(handlerServiceContractID));
        if (handlerService)
          handlerService->Store(aHandler);
      }

      aHandler->LaunchWithURI(aURI, aWindowContext);
    }
  }
  else {
    [controller alert:parentWindow
                title:NSLocalizedString(@"NoExternalHandlerTitle", nil)
                 text:[NSString stringWithFormat:NSLocalizedString(@"NoExternalHandlerText", nil),
                                                 linkType]];
  }
  return NS_OK;
}

