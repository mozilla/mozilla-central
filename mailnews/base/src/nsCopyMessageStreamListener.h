/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef NSCOPYMESSAGESTREAMLISTENER_H
#define NSCOPYMESSAGESTREAMLISTENER_H

#include "nsICopyMsgStreamListener.h"
#include "nsIStreamListener.h"
#include "nsIMsgFolder.h"
#include "nsICopyMessageListener.h"
#include "nsCOMPtr.h"
#include "nsIURI.h"

class nsCopyMessageStreamListener : public nsIStreamListener, public nsICopyMessageStreamListener {

public:
	nsCopyMessageStreamListener();
	virtual ~nsCopyMessageStreamListener();

	NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSICOPYMESSAGESTREAMLISTENER
    NS_DECL_NSIREQUESTOBSERVER
    NS_DECL_NSISTREAMLISTENER

protected:
	nsCOMPtr<nsICopyMessageListener> mDestination;
	nsCOMPtr<nsISupports> mListenerData;
	nsCOMPtr<nsIMsgFolder> mSrcFolder;

};



#endif
