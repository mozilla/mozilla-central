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
#import "NSString+Gecko.h"

#import "KeychainAutoCompleteSession.h"
#import "KeychainItem.h"
#import "KeychainService.h"

#include "nsIDocument.h"
#include "nsIDOMDocument.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventTarget.h";
#include "nsIDOMHTMLInputElement.h";

static BOOL FindPasswordField(nsIDOMHTMLInputElement* inUsername, nsIDOMHTMLInputElement** outPassword);

static void GetFormInfoForInput(nsIDOMHTMLInputElement* aElement,
                                NSString** host,
                                NSString** asciiHost,
                                UInt16* port,
                                NSString** scheme);

NS_IMPL_ISUPPORTS1(KeychainAutoCompleteDOMListener, nsIDOMEventListener)

NS_IMETHODIMP KeychainAutoCompleteDOMListener::HandleEvent(nsIDOMEvent *aEvent)
{
  nsAutoString type;
  aEvent->GetType(type);
  if (type.EqualsLiteral("DOMAutoComplete")) {
    // Don't fill password if autofilling has been disabled.
    if(![[KeychainService instance] formPasswordFillIsEnabled])
      return NS_OK;

    nsCOMPtr<nsIDOMEventTarget> target;
    if (NS_FAILED(aEvent->GetTarget(getter_AddRefs(target))))
      return NS_OK;

    nsCOMPtr<nsIDOMHTMLInputElement> userElement = do_QueryInterface(target);
    if (userElement && userElement == mUsernameElement)
      FillPassword();
  }

  return NS_OK;
}

void KeychainAutoCompleteDOMListener::SetElements(nsIDOMHTMLInputElement* usernameElement,
                                                  nsIDOMHTMLInputElement* passwordElement)
{
  mUsernameElement = usernameElement;
  mPasswordElement = passwordElement;
}

void KeychainAutoCompleteDOMListener::FillPassword()
{
  if (!mUsernameElement || !mPasswordElement)
    return;

  // Get the entered username.
  nsAutoString nsUsername;
  mUsernameElement->GetValue(nsUsername);
  NSString* username = [NSString stringWith_nsAString:nsUsername];

  NSString* host;
  NSString* asciiHost;
  UInt16 port;
  NSString* scheme;

  GetFormInfoForInput(mUsernameElement, &host, &asciiHost, &port, &scheme);

  KeychainService* keychain = [KeychainService instance];
  KeychainItem* keychainEntry = [keychain findWebFormKeychainEntryForUsername:username
                                                                      forHost:host
                                                                         port:port
                                                                       scheme:scheme];
  if (![asciiHost isEqualToString:host]) {
    if (keychainEntry) {
      [keychainEntry setHost:asciiHost];
    }
    else {
      keychainEntry = [keychain findWebFormKeychainEntryForUsername:username
                                                            forHost:asciiHost
                                                               port:port
                                                             scheme:scheme];
    }
  }
  if (!keychainEntry)
    return;

  nsAutoString password;
  [[keychainEntry password] assignTo_nsAString:password];

  if (password.IsEmpty())
    return;

  mPasswordElement->SetValue(password);

  // Now that we have actually filled the password, cache the keychain entry.
  nsCOMPtr<nsIDOMDocument> domDoc;
  nsresult rv = mUsernameElement->GetOwnerDocument(getter_AddRefs(domDoc));
  if (NS_FAILED(rv) || !domDoc)
    return;

  nsCOMPtr<nsIDocument> doc (do_QueryInterface(domDoc));
  if (!doc)
    return;

  nsIURI* docURL = doc->GetDocumentURI();
  if (!docURL)
    return;

  nsCAutoString uriCAString;
  rv = docURL->GetSpec(uriCAString);
  if (NS_FAILED(rv))
    return;

  NSString* uri = [NSString stringWithCString:uriCAString.get()];
  if (uri)
    [keychain cacheKeychainEntry:keychainEntry forKey:uri];
}

@implementation KeychainAutoCompleteSession

- (id)init
{
  if ((self = [super init])) {
    mUsernames = [[NSMutableArray alloc] init];
    mDOMListener = new KeychainAutoCompleteDOMListener();
    NS_IF_ADDREF(mDOMListener);
  }

  return self;
}

- (void)dealloc
{
  [mUsernames release];
  [mDefaultUser release];

  NS_IF_RELEASE(mDOMListener);

  [super dealloc];
}

//
// attachToInput
//
// Sets the session to cache the usernames for a username element
// Returns NO if this element is not a valid username element and should
// be remembered by the calling function so that autocomplete requests are not sent.
- (BOOL)attachToInput:(nsIDOMHTMLInputElement*)usernameElement
{
  // Don't listen if element is empty or password fill is disabled.
  KeychainService* keychain = [KeychainService instance];
  if (!usernameElement || ![keychain formPasswordFillIsEnabled])
    return NO;

  if (mUsernameElement == usernameElement)
    return YES;

  // If there is no corresponding password, this element isn't listened to.
  nsCOMPtr<nsIDOMHTMLInputElement> passwordElement;
  if (!FindPasswordField(usernameElement, getter_AddRefs(passwordElement)))
    return NO;

  // Get the host information so we can get the keychain entries below.
  NSString* host;
  NSString* asciiHost;
  UInt16 port;
  NSString* scheme;

  GetFormInfoForInput(usernameElement, &host, &asciiHost, &port, &scheme);

  // If session is not cached, default to empty session.
  [mUsernames removeAllObjects];
  [mDefaultUser release];
  mDefaultUser = nil;
  mUsernameElement = usernameElement;

  // Cache all of the usernames in the object so that the keychain
  // doesn't have to be read again.  This should be a faster way to search and sort.
  NSMutableArray* keychainEntries =
    [NSMutableArray arrayWithArray:[keychain allWebFormKeychainItemsForHost:host port:port scheme:scheme]];

  // Fix those entries, and add the keychain items for the punycode host.
  if (![asciiHost isEqualToString:host]) {
    [keychainEntries makeObjectsPerformSelector:@selector(setHost:) withObject:asciiHost];

    [keychainEntries addObjectsFromArray:[keychain allWebFormKeychainItemsForHost:asciiHost
                                                                             port:port
                                                                           scheme:scheme]];
  }

  NSEnumerator* keychainEnumerator = [keychainEntries objectEnumerator];
  KeychainItem* item;
  while ((item = [keychainEnumerator nextObject])) {
    // Only add a username once since there may be duplicates.
    NSString* username = [item username];
    if (![mUsernames containsObject:username])
      [mUsernames addObject:username];
  }

  // Get the default keychain and cache the username.
  item = [keychain defaultFromKeychainItems:keychainEntries];
  if (item)
    mDefaultUser = [[item username] copy];

  // Sort usernames alphabetically.
  [mUsernames sortUsingSelector:@selector(caseInsensitiveCompare:)];

  // Listen for DOM form fill events so that the password can
  // be autofilled when a username is entered.
  mDOMListener->SetElements(usernameElement, passwordElement);
  nsCOMPtr<nsIDOMEventTarget> targ = do_QueryInterface(usernameElement);
  targ->AddEventListener(NS_LITERAL_STRING("DOMAutoComplete"), mDOMListener, PR_FALSE);

  return YES;
}

//
// startAutoCompleteWithSearch
//
// Function that takes a search string and returns all usernames that match it.
// Assume that if this function is called that formfilling is enabled.  If it's
// not enabled, don't create the session in the first place.
//
-(void)startAutoCompleteWithSearch:(NSString*)searchString
                   previousResults:(AutoCompleteResults*)previousSearchResults
                          listener:(id<AutoCompleteListener>)listener
{
  AutoCompleteResults* results = [[AutoCompleteResults alloc] init];
  [results setSearchString:searchString];

  // determine if we can skip searching the whole list of usernames
  // and only search through the previous search results.
  bool searchPrevious = (previousSearchResults) ? [searchString hasPrefix:[previousSearchResults searchString]] : NO;

  NSEnumerator* usernameEnumerator;
  if (searchPrevious)
    usernameEnumerator = [[previousSearchResults matches] objectEnumerator];
  else
    usernameEnumerator = [mUsernames objectEnumerator];

  NSMutableArray* resultMatches = [[NSMutableArray alloc] init];

  NSString* username;
  bool searchStringIsEmpty = (searchString && [searchString length] > 0) ? NO : YES;
  while ((username = [usernameEnumerator nextObject])) {
    if (searchStringIsEmpty || [username hasPrefix:searchString]) {
      [resultMatches addObject:username];

      // Check for the default.
      if ([username isEqualToString:mDefaultUser])
        [results setDefaultIndex:([resultMatches count]-1)];
    }
  }

  [results setMatches:resultMatches];
  [resultMatches release];

  [listener autoCompleteFoundResults:results];
  [results release];
}

@end

//
// FindPasswordField
//
// Given an HTML input element for username entry, return the corresponding password field
// or set the password input element to nsnull if there isn't one. Return YES on success.
//
BOOL FindPasswordField(nsIDOMHTMLInputElement* inUsername, nsIDOMHTMLInputElement** outPassword)
{
  if (!inUsername)
    return NO;

  // Get the form node for scanning username/password pair.
  nsCOMPtr<nsIDOMHTMLFormElement> formElement;
  nsresult rv = inUsername->GetForm(getter_AddRefs(formElement));
  if (NS_FAILED(rv) || !formElement)
    return NO;

  // Check if the input element is a username field with a password field.
  nsCOMPtr<nsIDOMHTMLInputElement> usernameElement;
  rv = FindUsernamePasswordFields(formElement,
                                  getter_AddRefs(usernameElement),
                                  outPassword,
                                  PR_TRUE);
  // Return a null password if the password was not found or if the username
  // field in the form is not the same as the input.
  if (NS_FAILED(rv) || usernameElement != inUsername)
    return NO;

  return YES;
}

static void GetFormInfoForInput(nsIDOMHTMLInputElement* aElement,
                                NSString** host,
                                NSString** asciiHost,
                                UInt16* port,
                                NSString** scheme)
{
  if (!aElement)
    return;
  *host = nil;
  *asciiHost = nil;
  *port = kAnyPort;
  *scheme = nil;

  nsCOMPtr<nsIDOMDocument> domDoc;
  nsresult rv = aElement->GetOwnerDocument(getter_AddRefs(domDoc));
  if (NS_FAILED(rv))
    return;

  nsCOMPtr<nsIDocument> doc = do_QueryInterface(domDoc);
  if (!doc)
    return;

  nsIURI* docURL = doc->GetDocumentURI();
  if (!docURL)
    return;

  nsCAutoString hostCAString;
  rv = docURL->GetHost(hostCAString);
  if (NS_FAILED(rv))
    return;

  *host = [NSString stringWithCString:hostCAString.get()];

  // Get the host in punycode for keychain use.
  nsCAutoString asciiHostCAString;
  rv = docURL->GetAsciiHost(asciiHostCAString);
  *asciiHost = NS_SUCCEEDED(rv) ? [NSString stringWithCString:asciiHostCAString.get()]
                                : *host;

  PRInt32 signedPort;
  docURL->GetPort(&signedPort);
  *port = (signedPort < 0) ? kAnyPort : (UInt16)signedPort;

  nsCAutoString schemeCAString;
  rv = docURL->GetScheme(schemeCAString);
  if (NS_FAILED(rv))
    return;

  *scheme = [NSString stringWithCString:schemeCAString.get()];
}
