/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbOSXUtils.h"
#include "nsStringGlue.h"
#include "nsAbOSXCard.h"
#include "nsMemory.h"
#include "mozilla/Util.h"
using namespace mozilla;

#include <AddressBook/AddressBook.h>
#define kABDepartmentProperty (kABDepartmentProperty ? kABDepartmentProperty : @"ABDepartment")

NSString*
WrapString(const nsString &aString)
{
    unichar* chars = reinterpret_cast<unichar*>(const_cast<PRUnichar*>(aString.get()));

    return [NSString stringWithCharacters:chars
                                   length:aString.Length()];
}

void
AppendToString(const NSString *aString, nsString &aResult)
{
    if (aString) {
        const char *chars = [aString UTF8String];
        if (chars) {
            aResult.Append(NS_ConvertUTF8toUTF16(chars));
        }
    }
}

void
AssignToString(const NSString *aString, nsString &aResult)
{
    if (aString) {
        const char *chars = [aString UTF8String];
        if (chars)
          CopyUTF8toUTF16(nsDependentCString(chars), aResult);
    }
}

void
AppendToCString(const NSString *aString, nsCString &aResult)
{
    if (aString) {
        const char *chars = [aString UTF8String];
        if (chars) {
            aResult.Append(chars);
        }
    }
}

// Some properties can't be easily mapped back and forth.
#define DONT_MAP(moz_name, osx_property, osx_label, osx_key)

#define DEFINE_PROPERTY(moz_name, osx_property, osx_label, osx_key) \
    { osx_property, osx_label, osx_key, #moz_name },

const nsAbOSXPropertyMap nsAbOSXUtils::kPropertyMap[] = {
    DEFINE_PROPERTY(FirstName, kABFirstNameProperty, nil, nil)
    DEFINE_PROPERTY(LastName, kABLastNameProperty, nil, nil)
    DONT_MAP("DisplayName", nil, nil, nil)
    DEFINE_PROPERTY(PhoneticFirstName, kABFirstNamePhoneticProperty, nil, nil)
    DEFINE_PROPERTY(PhoneticLastName, kABLastNamePhoneticProperty, nil, nil)
    DEFINE_PROPERTY(NickName, kABNicknameProperty, nil, nil)
    DONT_MAP(PrimaryEmail, kABEmailProperty, nil, nil)
    DONT_MAP(SecondEmail, kABEmailProperty, nil, nil)
    DEFINE_PROPERTY(WorkPhone, kABPhoneProperty, kABPhoneWorkLabel, nil)
    DEFINE_PROPERTY(HomePhone, kABPhoneProperty, kABPhoneHomeLabel, nil)
    DEFINE_PROPERTY(FaxNumber, kABPhoneProperty, kABPhoneWorkFAXLabel, nil)
    DEFINE_PROPERTY(PagerNumber, kABPhoneProperty, kABPhonePagerLabel, nil)
    DEFINE_PROPERTY(CellularNumber, kABPhoneProperty, kABPhoneMobileLabel, nil)
    DEFINE_PROPERTY(HomeAddress, kABAddressProperty, kABAddressHomeLabel,
                    kABAddressStreetKey)
    DEFINE_PROPERTY(HomeCity, kABAddressProperty, kABAddressHomeLabel,
                    kABAddressCityKey)
    DEFINE_PROPERTY(HomeState, kABAddressProperty, kABAddressHomeLabel,
                    kABAddressStateKey)
    DEFINE_PROPERTY(HomeZipCode, kABAddressProperty, kABAddressHomeLabel,
                    kABAddressZIPKey)
    DEFINE_PROPERTY(HomeCountry, kABAddressProperty, kABAddressHomeLabel,
                    kABAddressCountryKey)
    DEFINE_PROPERTY(WorkAddress, kABAddressProperty, kABAddressWorkLabel,
                    kABAddressStreetKey)
    DEFINE_PROPERTY(WorkCity, kABAddressProperty, kABAddressWorkLabel,
                    kABAddressCityKey)
    DEFINE_PROPERTY(WorkState, kABAddressProperty, kABAddressWorkLabel,
                    kABAddressStateKey)
    DEFINE_PROPERTY(WorkZipCode, kABAddressProperty, kABAddressWorkLabel,
                    kABAddressZIPKey)
    DEFINE_PROPERTY(WorkCountry, kABAddressProperty, kABAddressWorkLabel,
                    kABAddressCountryKey)
    DEFINE_PROPERTY(JobTitle, kABJobTitleProperty, nil, nil)
    DEFINE_PROPERTY(Department, kABDepartmentProperty, nil, nil)
    DEFINE_PROPERTY(Company, kABOrganizationProperty, nil, nil)
    DONT_MAP(_AimScreenName, kABAIMInstantProperty, nil, nil)
    DEFINE_PROPERTY(WebPage1, kABHomePageProperty, nil, nil)
    DONT_MAP(WebPage2, kABHomePageProperty, nil, nil)
    DONT_MAP(BirthYear, "birthyear", nil, nil)
    DONT_MAP(BirthMonth, "birthmonth", nil, nil)
    DONT_MAP(BirthDay, "birthday", nil, nil)
    DONT_MAP(Custom1, "custom1", nil, nil)
    DONT_MAP(Custom2, "custom2", nil, nil)
    DONT_MAP(Custom3, "custom3", nil, nil)
    DONT_MAP(Custom4, "custom4", nil, nil)
    DEFINE_PROPERTY(Note, kABNoteProperty, nil, nil)
    DONT_MAP("PreferMailFormat", nil, nil, nil)
    DONT_MAP("LastModifiedDate", modifytimestamp, nil, nil)
};

const uint32_t nsAbOSXUtils::kPropertyMapSize =
    ArrayLength(nsAbOSXUtils::kPropertyMap);
