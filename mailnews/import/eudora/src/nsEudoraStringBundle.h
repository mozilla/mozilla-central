/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jeff Beckley <beckley@qualcomm.com>
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

#ifndef nsEudoraStringBundle_H__
#define nsEudoraStringBundle_H__

#include "nsString.h"

class nsIStringBundle;

class nsEudoraStringBundle {
public:
  static PRUnichar       *  GetStringByID(PRInt32 stringID, nsIStringBundle *pBundle = nsnull);
  static void               GetStringByID(PRInt32 stringID, nsString& result, nsIStringBundle *pBundle = nsnull);
  static nsString           FormatString(PRInt32 stringID, ...);
  static nsIStringBundle *  GetStringBundle( void); // don't release
  static nsIStringBundle *  GetStringBundleProxy( void); // release
  static void               FreeString( PRUnichar *pStr) { NS_Free( pStr);}
  static void               Cleanup( void);

private:
  static nsIStringBundle *  m_pBundle;
};



#define EUDORAIMPORT_NAME                               2000
#define EUDORAIMPORT_DESCRIPTION                        2001
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
