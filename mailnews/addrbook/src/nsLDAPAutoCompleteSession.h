/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Attributes.h"
#include "nsCOMPtr.h"
#include "nsIAutoCompleteSession.h"
#include "nsILDAPConnection.h"
#include "nsILDAPOperation.h"
#include "nsILDAPAutoCompleteSession.h"
#include "nsILDAPAutoCompFormatter.h"
#include "nsILDAPURL.h"
#include "nsStringGlue.h"
#include "nsISupportsArray.h"
#include "nsIConsoleService.h"
#include "nsIMutableArray.h"
#include "nsAbLDAPListenerBase.h"

// 964665d0-1dd1-11b2-aeae-897834fb00b9
//
#define NS_LDAPAUTOCOMPLETESESSION_CID \
{ 0x964665d0, 0x1dd1, 0x11b2, \
 { 0xae, 0xae, 0x89, 0x78, 0x34, 0xfb, 0x00, 0xb9 }}

class nsLDAPAutoCompleteSession : public nsAbLDAPListenerBase,
                                  public nsILDAPAutoCompleteSession
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIAUTOCOMPLETESESSION
  NS_DECL_NSILDAPAUTOCOMPLETESESSION

  nsLDAPAutoCompleteSession();
  virtual ~nsLDAPAutoCompleteSession();

  NS_IMETHOD OnLDAPMessage(nsILDAPMessage *aMessage) MOZ_OVERRIDE;
  NS_IMETHOD OnLDAPInit(nsILDAPConnection *aConn, nsresult aStatus) MOZ_OVERRIDE;

protected:
  // Called if an LDAP initialization fails.
  virtual void InitFailed(bool aCancelled = false) MOZ_OVERRIDE;

  // Called to start off the required task after a bind.
  virtual nsresult DoTask() MOZ_OVERRIDE;

    enum SessionState { 
        UNBOUND = nsILDAPAutoCompFormatter::STATE_UNBOUND,
        INITIALIZING = nsILDAPAutoCompFormatter::STATE_INITIALIZING, 
        BINDING = nsILDAPAutoCompFormatter::STATE_BINDING, 
        BOUND = nsILDAPAutoCompFormatter::STATE_BOUND, 
        SEARCHING = nsILDAPAutoCompFormatter::STATE_SEARCHING 
    } mState;
    uint32_t mEntriesReturned;                    // # of entries returned?
    nsCOMPtr<nsIAutoCompleteListener> mListener;  // callback 
    nsCOMPtr<nsIAutoCompleteResults> mResults;    // being built up
    nsCOMPtr<nsISupportsArray> mResultsArray;     // cached, to avoid re-gets
    nsString mSearchString;                       // autocomplete this string
    nsCString mFilterTemplate;                    // search filter template
    int32_t mMaxHits;                       // return at most this many entries
    uint32_t mMinStringLength;              // strings < this size are ignored
    uint32_t mCjkMinStringLength;           // ignore CJK strings < this size
    nsCString mSearchAttrs;     // outputFormat search attrs for SearchExt call
    uint32_t mVersion;                      // version of LDAP to use

    // used to format the ldap message into an nsIAutoCompleteItem
    //
    nsCOMPtr<nsILDAPAutoCompFormatter> mFormatter;

    // stopgap until nsLDAPService works
    nsresult InitConnection();             

    // check that we bound ok and start then call StartLDAPSearch
    nsresult OnLDAPBind(nsILDAPMessage *aMessage); 

    // add to the results set
    nsresult OnLDAPSearchEntry(nsILDAPMessage *aMessage); 

    // all done; call OnAutoComplete
    nsresult OnLDAPSearchResult(nsILDAPMessage *aMessage); 

    // check if the LDAP message received is current
    nsresult IsMessageCurrent(nsILDAPMessage *aMessage, bool *aIsCurrent);

    // finish a search by calling mListener->OnAutoComplete, resetting state,
    // and freeing resources.  if aACStatus == 
    // nsIAutoCompleteStatus::failureItems, then the formatter is called with
    // aResult and aEndState to create an autocomplete item with the error
    // info in it.  See nsILDAPAutoCompFormatter.idl for more info on this.
    void FinishAutoCompleteLookup(AutoCompleteStatus aACStatus, 
                                  const nsresult aResult,
                                  enum SessionState aEndState);

    // create and initialize the results array
    nsresult CreateResultsArray(void);

    nsCOMPtr<nsIMutableArray> mSearchServerControls;
    nsCOMPtr<nsIMutableArray> mSearchClientControls;
};

