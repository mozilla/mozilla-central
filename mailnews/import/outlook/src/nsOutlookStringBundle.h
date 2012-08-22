/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsOutlookStringBundle_H__
#define _nsOutlookStringBundle_H__

#include "nsCRTGlue.h"
#include "nsStringGlue.h"

class nsIStringBundle;

class nsOutlookStringBundle {
public:
  static PRUnichar     * GetStringByID(int32_t stringID);
  static void GetStringByID(int32_t stringID, nsString& result);
  static nsIStringBundle * GetStringBundle(void); // don't release
  static void FreeString(PRUnichar *pStr) { NS_Free(pStr);}
  static void Cleanup(void);
private:
  static nsIStringBundle * m_pBundle;
};



#define OUTLOOKIMPORT_NAME                     2000
#define OUTLOOKIMPORT_DESCRIPTION              2010
#define OUTLOOKIMPORT_MAILBOX_SUCCESS          2002
#define OUTLOOKIMPORT_MAILBOX_BADPARAM         2003
#define OUTLOOKIMPORT_MAILBOX_CONVERTERROR     2004
#define OUTLOOKIMPORT_ADDRNAME                 2005
#define OUTLOOKIMPORT_ADDRESS_SUCCESS          2006
#define OUTLOOKIMPORT_ADDRESS_BADPARAM         2007
#define OUTLOOKIMPORT_ADDRESS_BADSOURCEFILE    2008
#define OUTLOOKIMPORT_ADDRESS_CONVERTERROR     2009


#endif /* _nsOutlookStringBundle_H__ */
