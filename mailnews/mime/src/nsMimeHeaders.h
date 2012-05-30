/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMimeHeaders_h_
#define nsMimeHeaders_h_

#include "msgCore.h"    // precompiled header...
#include "mimehdrs.h"
#include "nsISupports.h"
#include "nsIMimeHeaders.h"

class nsMimeHeaders : public nsIMimeHeaders
{
 public:
   nsMimeHeaders();
   virtual ~nsMimeHeaders();

   /* this macro defines QueryInterface, AddRef and Release for this class */
   NS_DECL_ISUPPORTS

   NS_DECL_NSIMIMEHEADERS

private:
  MimeHeaders  *  mHeaders;
};

#endif
