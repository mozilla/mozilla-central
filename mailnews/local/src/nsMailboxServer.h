/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMailboxServer_h__
#define nsMailboxServer_h__

#include "mozilla/Attributes.h"
#include "nsMsgIncomingServer.h"

class nsMailboxServer : public nsMsgIncomingServer
{
public:
  NS_IMETHOD GetLocalStoreType(nsACString& type) MOZ_OVERRIDE;
protected:
  virtual nsresult CreateRootFolderFromUri(const nsCString &serverUri,
                                           nsIMsgFolder **rootFolder) MOZ_OVERRIDE;
};

#endif
