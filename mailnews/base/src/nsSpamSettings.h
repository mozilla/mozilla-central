/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsSpamSettings_h__
#define nsSpamSettings_h__

#include "nsCOMPtr.h"
#include "nsISpamSettings.h"
#include "nsStringGlue.h"
#include "nsIOutputStream.h"
#include "nsIMsgIncomingServer.h"
#include "nsIUrlListener.h"
#include "nsIDateTimeFormat.h"
#include "nsCOMArray.h"
#include "nsIAbDirectory.h"
#include "nsTArray.h"

class nsSpamSettings : public nsISpamSettings, public nsIUrlListener
{
public:
  nsSpamSettings();
  virtual ~nsSpamSettings();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISPAMSETTINGS
  NS_DECL_NSIURLLISTENER

private:
  nsCOMPtr <nsIOutputStream> mLogStream;
  nsCOMPtr<nsIFile> mLogFile;

  int32_t mLevel; 
  int32_t mPurgeInterval;
  int32_t mMoveTargetMode;

  bool mPurge;
  bool mUseWhiteList;
  bool mMoveOnSpam;
  bool mUseServerFilter;
  
  nsCString mActionTargetAccount;
  nsCString mActionTargetFolder;
  nsCString mWhiteListAbURI;
  nsCString mCurrentJunkFolderURI; // used to detect changes to the spam folder in ::initialize

  nsCString mServerFilterName;
  nsCOMPtr<nsIFile> mServerFilterFile;
  int32_t  mServerFilterTrustFlags;

  nsCOMPtr<nsIDateTimeFormat> mDateFormatter;

  // array of address directories to use in junk whitelisting
  nsCOMArray<nsIAbDirectory> mWhiteListDirArray;
  // mail domains to use in junk whitelisting
  nsCString mTrustedMailDomains;
  // should we inhibit whitelisting address of identity?
  bool mInhibitWhiteListingIdentityUser;
  // should we inhibit whitelisting domain of identity?
  bool mInhibitWhiteListingIdentityDomain;
  // email addresses associated with this server
  nsTArray<nsCString> mEmails;

  // helper routine used by Initialize which unsets the junk flag on the previous junk folder
  // for this account, and sets it on the new junk folder.
  nsresult UpdateJunkFolderState();
};

#endif /* nsSpamSettings_h__ */
