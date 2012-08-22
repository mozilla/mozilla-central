/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraStringBundle_H__
#define nsEudoraStringBundle_H__

#include "nsStringGlue.h"

class nsIStringBundle;

class nsEudoraStringBundle {
public:
  static PRUnichar       *  GetStringByID(int32_t stringID);
  static void               GetStringByID(int32_t stringID, nsString& result);
  static nsString           FormatString(int32_t stringID, ...);
  static nsIStringBundle *  GetStringBundle(void); // don't release
  static void               FreeString(PRUnichar *pStr) { NS_Free(pStr);}
  static void               Cleanup(void);

private:
  static nsIStringBundle *  m_pBundle;
};



#define EUDORAIMPORT_NAME                               2000
#define EUDORAIMPORT_DESCRIPTION                        2029
#define EUDORAIMPORT_MAILBOX_SUCCESS                    2002
#define EUDORAIMPORT_MAILBOX_BADPARAM                   2003
#define EUDORAIMPORT_MAILBOX_BADSOURCEFILE              2004
#define EUDORAIMPORT_MAILBOX_CONVERTERROR               2005
#define EUDORAIMPORT_ACCOUNTNAME                        2006

#define EUDORAIMPORT_NICKNAMES_NAME                     2007
#define EUDORAIMPORT_ADDRESS_SUCCESS                    2008
#define EUDORAIMPORT_ADDRESS_BADPARAM                   2009
#define EUDORAIMPORT_ADDRESS_BADSOURCEFILE              2010
#define EUDORAIMPORT_ADDRESS_CONVERTERROR               2011
#define EUDORAIMPORT_ADDRESS_LABEL_HOMEMOBILE           2012
#define EUDORAIMPORT_ADDRESS_LABEL_WORKMOBILE           2013
#define EUDORAIMPORT_ADDRESS_LABEL_HOMEFAX              2014
#define EUDORAIMPORT_ADDRESS_LABEL_WORKFAX              2015
#define EUDORAIMPORT_ADDRESS_LABEL_OTHEREMAIL           2016
#define EUDORAIMPORT_ADDRESS_LABEL_OTHERPHONE           2017
#define EUDORAIMPORT_ADDRESS_LABEL_OTHERWEB             2018

#define EUDORAIMPORT_FILTERS_WARN_OUTGOING              2019
#define EUDORAIMPORT_FILTERS_WARN_ACTION                2020
#define EUDORAIMPORT_FILTERS_WARN_VERB                  2021
#define EUDORAIMPORT_FILTERS_WARN_EMPTY_HEADER          2027
#define EUDORAIMPORT_FILTERS_WARN_NEGATE_VERB           2023
#define EUDORAIMPORT_FILTERS_WARN_META_HEADER           2028
#define EUDORAIMPORT_FILTERS_WARN_MAILBOX_MISSING       2025

#endif /* nsEudoraStringBundle_H__ */
