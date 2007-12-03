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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
#if !defined(INCLUDED_CAL_TIMEZONESERVIC_H)
#define INCLUDED_CAL_TIMEZONESERVIC_H

#include "nsCOMPtr.h"
#include "calITimezoneProvider.h"
#include "nsInterfaceHashtable.h"
#include "calUtils.h"

extern "C" {
#include "ical.h"
}

class calTimezone : public calITimezone,
                    public cal::XpcomBase
{
public:
    calTimezone(calIIcalComponent * component,
                nsCString const& tzid,
                PRBool isUTC = PR_FALSE,
                PRBool isFloating = PR_FALSE,
                nsCString const& latitude = nsCString(),
                nsCString const& longitude = nsCString())
        : mComponent(component),
          mTzid(tzid),
          mLatitude(latitude),
          mLongitude(longitude),
          mIsFloating(isFloating),
          mIsUTC(isUTC) {}

    NS_DECL_ISUPPORTS
    NS_DECL_CALITIMEZONE

private:
    nsCOMPtr<calIIcalComponent> const mComponent;
    nsCString const                   mTzid;
    nsCString const                   mLatitude;
    nsCString const                   mLongitude;
    PRBool const                      mIsFloating;
    PRBool const                      mIsUTC;
};

class calTimezoneService : public calITimezoneService,
                           public cal::XpcomBase
{
public:
    calTimezoneService();

    NS_DECL_ISUPPORTS
    NS_DECL_CALITIMEZONEPROVIDER
    NS_DECL_CALITIMEZONESERVICE

private:
    nsresult LatestTzId(const nsACString& tzid, nsACString& _retval);

    nsInterfaceHashtable<nsCStringHashKey, calITimezone> mTzHash;
    nsCOMPtr<calITimezone> const mUTC;
    nsCOMPtr<calITimezone> const mFloating;
};

#endif // INCLUDED_CAL_TIMEZONESERVIC_H
