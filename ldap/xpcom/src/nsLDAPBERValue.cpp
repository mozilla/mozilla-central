/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPBERValue.h"
#include "nsMemory.h"
#include "nsStringGlue.h"

NS_IMPL_ISUPPORTS1(nsLDAPBERValue, nsILDAPBERValue)

nsLDAPBERValue::nsLDAPBERValue() : mValue(0), mSize(0)
{
}

nsLDAPBERValue::~nsLDAPBERValue()
{
    if (mValue) {
        nsMemory::Free(mValue);
    }
}

// void get (out unsigned long aCount, 
//           [array, size_is (aCount), retval] out octet aRetVal); */
NS_IMETHODIMP 
nsLDAPBERValue::Get(uint32_t *aCount, uint8_t **aRetVal)
{
    // if mSize = 0, return a count of a 0 and a null pointer

    if (mSize) {
        // get a buffer to hold a copy of the data
        //
        uint8_t *array = static_cast<uint8_t *>(nsMemory::Alloc(mSize));

        if (!array) {
            return NS_ERROR_OUT_OF_MEMORY;
        }
    
        // copy and return
        //
        memcpy(array, mValue, mSize);
        *aRetVal = array;
    } else {
        *aRetVal = 0;
    }

    *aCount = mSize;
    return NS_OK;
}

// void set(in unsigned long aCount, 
//          [array, size_is(aCount)] in octet aValue);
NS_IMETHODIMP
nsLDAPBERValue::Set(uint32_t aCount, uint8_t *aValue)
{
    // get rid of any old value being held here
    //
    if (mValue) {
        nsMemory::Free(mValue);
    }

    // if this is a non-zero value, allocate a buffer and copy
    //
    if (aCount) { 
        // get a buffer to hold a copy of this data
        //
        mValue = static_cast<uint8_t *>(nsMemory::Alloc(aCount));
        if (!mValue) {
            return NS_ERROR_OUT_OF_MEMORY;
        }

        // copy the data and return
        //
        memcpy(mValue, aValue, aCount);
    } else {
        // otherwise just set it to null
        //
        mValue = 0;
    }

    mSize = aCount;
    return NS_OK;
}

// void setFromUTF8(in AUTF8String aValue);
//
NS_IMETHODIMP
nsLDAPBERValue::SetFromUTF8(const nsACString & aValue)
{
    // get rid of any old value being held here
    //
    if (mValue) {
        nsMemory::Free(mValue);
    }

    // copy the data and return
    //
    mSize = aValue.Length();
    if (mSize) {
        mValue = reinterpret_cast<uint8_t *>(ToNewCString(aValue));
    } else {
        mValue = 0;
    }
    return NS_OK;
}
