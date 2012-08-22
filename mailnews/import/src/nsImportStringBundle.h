/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsImportStringBundle_H__
#define _nsImportStringBundle_H__

#include "nsStringGlue.h"

class nsIStringBundle;

class nsImportStringBundle
{
public:
  static PRUnichar* GetStringByID(int32_t aStringID,
                                  nsIStringBundle *aBundle = nullptr);
  static void GetStringByID(int32_t aStringID,
                            nsIStringBundle *aBundle,
                            nsString &aResult);
  static PRUnichar* GetStringByName(const char *aName,
                                    nsIStringBundle *aBundle = nullptr);
  static void GetStringByName(const char *aName,
                                nsIStringBundle *aBundle,
                                nsString &aResult);
  static nsresult GetStringBundle(const char *aPropertyURL,
                                  nsIStringBundle **aBundle);
};

#define IMPORT_MSGS_URL       "chrome://messenger/locale/importMsgs.properties"


#define  IMPORT_NO_ADDRBOOKS                            2000
#define  IMPORT_ERROR_AB_NOTINITIALIZED            2001
#define IMPORT_ERROR_AB_NOTHREAD              2002
#define IMPORT_ERROR_GETABOOK                2003
#define  IMPORT_NO_MAILBOXES                            2004
#define  IMPORT_ERROR_MB_NOTINITIALIZED            2005
#define IMPORT_ERROR_MB_NOTHREAD              2006
#define IMPORT_ERROR_MB_NOPROXY                2007
#define IMPORT_ERROR_MB_FINDCHILD              2008
#define IMPORT_ERROR_MB_CREATE                2009
#define IMPORT_ERROR_MB_NODESTFOLDER            2010

#define IMPORT_FIELD_DESC_START                2100
#define IMPORT_FIELD_DESC_END                2136


#endif /* _nsImportStringBundle_H__ */
