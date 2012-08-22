/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsCOMPtr.h"
#include "prmem.h"
#include "plstr.h"
#include "nsMailHeaders.h"
#include "nsIMimeEmitter.h"
#include "nsIStringBundle.h"
#include "nsIServiceManager.h"
#include "nsIIOService.h"
#include "nsIURI.h"
#include "prprf.h"


extern "C" bool
EmitThisHeaderForPrefSetting(int32_t dispType, const char *header)
{
  if (nsMimeHeaderDisplayTypes::AllHeaders == dispType)
    return true;

  if ((!header) || (!*header))
    return false;

  if (nsMimeHeaderDisplayTypes::MicroHeaders == dispType)
  {
    if (
          (!strcmp(header, HEADER_SUBJECT)) ||
          (!strcmp(header, HEADER_FROM)) ||
          (!strcmp(header, HEADER_DATE))
       )
      return true;
    else
      return false;
  }

  if (nsMimeHeaderDisplayTypes::NormalHeaders == dispType)
  {
    if (
        (!strcmp(header, HEADER_DATE)) ||
        (!strcmp(header, HEADER_TO)) ||
        (!strcmp(header, HEADER_SUBJECT)) ||
        (!strcmp(header, HEADER_SENDER)) ||
        (!strcmp(header, HEADER_RESENT_TO)) ||
        (!strcmp(header, HEADER_RESENT_SENDER)) ||
        (!strcmp(header, HEADER_RESENT_FROM)) ||
        (!strcmp(header, HEADER_RESENT_CC)) ||
        (!strcmp(header, HEADER_REPLY_TO)) ||
        (!strcmp(header, HEADER_REFERENCES)) ||
        (!strcmp(header, HEADER_NEWSGROUPS)) ||
        (!strcmp(header, HEADER_MESSAGE_ID)) ||
        (!strcmp(header, HEADER_FROM)) ||
        (!strcmp(header, HEADER_FOLLOWUP_TO)) ||
        (!strcmp(header, HEADER_CC)) ||
        (!strcmp(header, HEADER_ORGANIZATION)) ||
        (!strcmp(header, HEADER_REPLY_TO)) ||
        (!strcmp(header, HEADER_BCC))
       )
       return true;
    else
      return false;
  }

  return true;
}

