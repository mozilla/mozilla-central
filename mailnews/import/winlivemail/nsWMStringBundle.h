/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsWMStringBundle_H__
#define _nsWMStringBundle_H__

#include "nsStringGlue.h"

class nsIStringBundle;

class nsWMStringBundle {
public:
  static PRUnichar     *    GetStringByID(int32_t stringID);
  static void          GetStringByID(int32_t stringID, nsString& result);
  static nsIStringBundle *  GetStringBundle(void); // don't release
  static void          FreeString(PRUnichar *pStr) { NS_Free(pStr);}
  static void          Cleanup(void);

private:
  static nsIStringBundle *  m_pBundle;
};



#define WMIMPORT_NAME                     2000
#define WMIMPORT_DESCRIPTION              2001
#define WMIMPORT_MAILBOX_SUCCESS          2002
#define WMIMPORT_MAILBOX_BADPARAM         2003
#define WMIMPORT_MAILBOX_BADSOURCEFILE    2004
#define WMIMPORT_MAILBOX_CONVERTERROR     2005
#define WMIMPORT_DEFAULT_NAME             2006
#define WMIMPORT_AUTOFIND                 2007
#define WMIMPORT_ADDRESS_SUCCESS          2008
#define WMIMPORT_ADDRESS_CONVERTERROR     2009
#define WMIMPORT_ADDRESS_BADPARAM         2010

#endif /* _nsWMStringBundle_H__ */
