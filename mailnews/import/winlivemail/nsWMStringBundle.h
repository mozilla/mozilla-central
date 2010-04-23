/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef _nsWMStringBundle_H__
#define _nsWMStringBundle_H__

#include "nsString.h"

class nsIStringBundle;

class nsWMStringBundle {
public:
  static PRUnichar     *    GetStringByID(PRInt32 stringID, nsIStringBundle *pBundle = nsnull);
  static void          GetStringByID(PRInt32 stringID, nsString& result, nsIStringBundle *pBundle = nsnull);
  static nsIStringBundle *  GetStringBundle( void); // don't release
  static void          FreeString( PRUnichar *pStr) { NS_Free( pStr);}
  static void          Cleanup( void);
  static nsIStringBundle *  GetStringBundleProxy( void); // release

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
