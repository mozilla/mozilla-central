/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Mark Banner <mark@standard8.demon.co.uk>
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
#include "nsAbOutlookCard.h"
#include "prlog.h"

#ifdef PR_LOGGING
static PRLogModuleInfo* gAbOutlookCardLog
    = PR_NewLogModule("nsAbOutlookCardLog");
#endif

#define PRINTF(args) PR_LOG(gAbOutlookCardLog, PR_LOG_DEBUG, args)

extern const char *kOutlookDirectoryScheme ;
extern const char *kOutlookCardScheme ;

nsAbOutlookCard::nsAbOutlookCard(void)
: nsRDFResource(), nsAbCardProperty(), mAbWinType(nsAbWinType_Unknown), mMapiData(nsnull)
{
    mMapiData = new nsMapiEntry ;
}

nsAbOutlookCard::~nsAbOutlookCard(void)
{
    if (mMapiData) { delete mMapiData ; }
}

NS_IMPL_ISUPPORTS_INHERITED1(nsAbOutlookCard, nsRDFResource, nsIAbCard)

static void splitString(nsString& aSource, nsString& aTarget)
{
    aTarget.Truncate() ;
    PRInt32 offset = aSource.FindChar('\n') ;
    
    if (offset >= 0) { 
        const PRUnichar *source = aSource.get() + offset + 1 ;
        
        while (*source) {
            if (*source == '\n' || *source == '\r') { aTarget.Append(PRUnichar(' ')) ; }
            else { aTarget.Append(*source) ; }
            ++ source ;
        }
        aSource.SetLength(offset); 
    }
}

static void wordToUnicode(WORD aWord, nsString& aUnicode)
{
    aUnicode.Truncate() ;
    aUnicode.AppendInt((PRInt32) aWord) ;
}

nsresult nsAbOutlookCard::Init(const char *aUri)
{
    nsresult retCode = nsRDFResource::Init(aUri) ;
    
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    nsCAutoString entry ;
    nsCAutoString stub ;

    mAbWinType = getAbWinType(kOutlookCardScheme, mURI.get(), stub, entry) ;
    if (mAbWinType == nsAbWinType_Unknown) {
        PRINTF(("Huge problem URI=%s.\n", mURI.get())) ;
        return NS_ERROR_INVALID_ARG ;
    }
    nsAbWinHelperGuard mapiAddBook (mAbWinType) ;

    if (!mapiAddBook->IsOK()) { return NS_ERROR_FAILURE ; }
    mMapiData->Assign(entry) ;
    nsStringArray unichars ;
    ULONG i = 0 ;

    if (mapiAddBook->GetPropertiesUString(*mMapiData, OutlookCardMAPIProps, index_LastProp, unichars)) {
        SetFirstName(*unichars[index_FirstName]);
        SetLastName(*unichars[index_LastName]);
        SetDisplayName(*unichars[index_DisplayName]);
        SetPrimaryEmail(*unichars[index_EmailAddress]);
        SetPropertyAsAString(kNicknameProperty, *unichars[index_NickName]);
        SetPropertyAsAString(kWorkPhoneProperty, *unichars[index_WorkPhoneNumber]);
        SetPropertyAsAString(kHomePhoneProperty, *unichars[index_HomePhoneNumber]);
        SetPropertyAsAString(kFaxProperty, *unichars[index_WorkFaxNumber]);
        SetPropertyAsAString(kPagerProperty, *unichars[index_PagerNumber]);
        SetPropertyAsAString(kCellularProperty, *unichars[index_MobileNumber]);
        SetPropertyAsAString(kHomeCityProperty, *unichars[index_HomeCity]);
        SetPropertyAsAString(kHomeStateProperty, *unichars[index_HomeState]);
        SetPropertyAsAString(kHomeZipCodeProperty, *unichars[index_HomeZip]);
        SetPropertyAsAString(kHomeCountryProperty, *unichars[index_HomeCountry]);
        SetPropertyAsAString(kWorkCityProperty, *unichars[index_WorkCity]);
        SetPropertyAsAString(kWorkStateProperty, *unichars[index_WorkState]);
        SetPropertyAsAString(kWorkZipCodeProperty, *unichars[index_WorkZip]);
        SetPropertyAsAString(kWorkCountryProperty, *unichars[index_WorkCountry]);
        SetPropertyAsAString(kJobTitleProperty, *unichars[index_JobTitle]);
        SetPropertyAsAString(kDepartmentProperty, *unichars[index_Department]);
        SetPropertyAsAString(kCompanyProperty, *unichars[index_Company]);
        SetPropertyAsAString(kWorkWebPageProperty, *unichars[index_WorkWebPage]);
        SetPropertyAsAString(kHomeWebPageProperty, *unichars[index_HomeWebPage]);
        SetPropertyAsAString(kNotesProperty, *unichars[index_Comments]);
    }
    ULONG cardType = 0 ;
    nsCAutoString normalChars ;
    
    if (mapiAddBook->GetPropertyLong(*mMapiData, PR_OBJECT_TYPE, cardType)) {
        SetIsMailList(cardType == MAPI_DISTLIST) ;
        if (cardType == MAPI_DISTLIST) {
            buildAbWinUri(kOutlookDirectoryScheme, mAbWinType, normalChars) ;
            normalChars.Append(entry) ;
            SetMailListURI(normalChars.get()) ;
        }
    }
    nsAutoString unichar ;
    nsAutoString unicharBis ;

    if (mapiAddBook->GetPropertyUString(*mMapiData, PR_HOME_ADDRESS_STREET_W, unichar)) {
        splitString(unichar, unicharBis);
        SetPropertyAsAString(kHomeAddressProperty, unichar);
        SetPropertyAsAString(kHomeAddress2Property, unicharBis);
    }
    if (mapiAddBook->GetPropertyUString(*mMapiData, PR_BUSINESS_ADDRESS_STREET_W, unichar)) {
        splitString(unichar, unicharBis);
        SetPropertyAsAString(kWorkAddressProperty, unichar);
        SetPropertyAsAString(kWorkAddress2Property, unicharBis);
    }
    WORD year = 0 ;
    WORD month = 0 ;
    WORD day = 0 ;

    if (mapiAddBook->GetPropertyDate(*mMapiData, PR_BIRTHDAY, year, month, day)) {
        wordToUnicode(year, unichar);
        SetPropertyAsAString(kBirthYearProperty, unichar);
        wordToUnicode(month, unichar);
        SetPropertyAsAString(kBirthMonthProperty, unichar);
        wordToUnicode(day, unichar);
        SetPropertyAsAString(kBirthDayProperty, unichar);
    }
    return retCode ;
}
