/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef NS_LOCALUTILS_H
#define NS_LOCALUTILS_H

#include "nsStringGlue.h"
#include "nsIMsgIncomingServer.h"

static const char kMailboxRootURI[] = "mailbox:/";
static const char kMailboxMessageRootURI[] = "mailbox-message:/";

nsresult
nsLocalURI2Path(const char* rootURI, const char* uriStr, nsCString& pathResult);

nsresult
nsParseLocalMessageURI(const char* uri, nsCString& folderURI, uint32_t *key);

nsresult 
nsBuildLocalMessageURI(const char* baseURI, uint32_t key, nsCString& uri);

nsresult
nsCreateLocalBaseMessageURI(const nsACString& baseURI, nsCString &baseMessageURI);

void
nsEscapeNativePath(nsCString& nativePath);

#endif //NS_LOCALUTILS_H
