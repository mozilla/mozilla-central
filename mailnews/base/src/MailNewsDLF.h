/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MailNewsDLF_h__
#define MailNewsDLF_h__

#include "nsIDocumentLoaderFactory.h"
#include "nsMimeTypes.h"
#include "nsMsgBaseCID.h"

namespace mozilla {
namespace mailnews {

/*
 * This factory is a thin wrapper around the text/html loader factory. All it
 * does is convert message/rfc822 to text/html and delegate the rest of the
 * work to the text/html factory.
 */
class MailNewsDLF : public nsIDocumentLoaderFactory
{
public:
  MailNewsDLF();
  virtual ~MailNewsDLF();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIDOCUMENTLOADERFACTORY
};
}
}

#define MAILNEWSDLF_CATEGORIES \
  { "Gecko-Content-Viewers", MESSAGE_RFC822, NS_MAILNEWSDLF_CONTRACTID }, \

#endif
