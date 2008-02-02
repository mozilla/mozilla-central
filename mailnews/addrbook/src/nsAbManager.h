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

#ifndef __nsAbManager_h
#define __nsAbManager_h
 
#include "nsIAbManager.h"
#include "nsTObserverArray.h"
#include "nsCOMPtr.h"
#include "nsICommandLineHandler.h"

class nsIAbDirectory;
class nsIAbLDAPAttributeMap;

class nsAbManager : public nsIAbManager,
                    public nsICommandLineHandler
{
  
public:
	nsAbManager();
	virtual ~nsAbManager();

	NS_DECL_ISUPPORTS
 	NS_DECL_NSIABMANAGER
  NS_DECL_NSICOMMANDLINEHANDLER

private:
  nsresult ExportDirectoryToDelimitedText(nsIAbDirectory *aDirectory, const char *aDelim, PRUint32 aDelimLen, nsILocalFile *aLocalFile);
  nsresult ExportDirectoryToLDIF(nsIAbDirectory *aDirectory, nsILocalFile *aLocalFile);
  nsresult AppendLDIFForMailList(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendDNForCard(const char *aProperty, nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendBasicLDIFForCard(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendProperty(const char *aProperty, const PRUnichar *aValue, nsACString &aResult);
  PRBool IsSafeLDIFString(const PRUnichar *aStr);

  struct abListener {
    nsCOMPtr<nsIAbListener> mListener;
    PRUint32 mNotifyFlags;

    abListener(nsIAbListener *aListener, PRUint32 aNotifyFlags)
      : mListener(aListener), mNotifyFlags(aNotifyFlags) {}
    abListener(const abListener &aListener)
      : mListener(aListener.mListener), mNotifyFlags(aListener.mNotifyFlags) {}
    ~abListener() {}

    int operator==(nsIAbListener* aListener) const {
      return mListener == aListener;
    }
    int operator==(const abListener &aListener) const {
      return mListener == aListener.mListener;
    }
  };

  nsTObserverArray<abListener> mListeners;
};

#endif
