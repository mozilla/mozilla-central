/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbUtils_h__
#define nsAbUtils_h__

#include "nsMemory.h"

/*
 * Wrapper class to automatically free an array of
 * char* when class goes out of scope
 */
class CharPtrArrayGuard
{
public:
    CharPtrArrayGuard (bool freeElements = true) :
        mFreeElements (freeElements),
        mArray (0),
        mSize (0)
    {
    }

    ~CharPtrArrayGuard ()
    {
        Free ();
    }

    char* operator[](int i)
    {
        return mArray[i];
    }

    uint32_t* GetSizeAddr(void)
    {
        return &mSize;
    }

    uint32_t GetSize(void)
    {
        return mSize;
    }

    char*** GetArrayAddr(void)
    {
        return &mArray;
    }

    const char** GetArray(void)
    {
        return (const char** ) mArray;
    }

public:

private:
    bool mFreeElements;
    char **mArray;
    uint32_t mSize;

    void Free ()
    {
        if (!mArray)
            return;

        if (mFreeElements)
            NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(mSize, mArray);
        else
        {
          nsMemory::Free(mArray);
        }
    }
};

/*
 * Wrapper class to automatically free an array of
 * PRUnichar* when class goes out of scope
 */
class PRUnicharPtrArrayGuard
{
public:
    PRUnicharPtrArrayGuard (bool freeElements = true) :
        mFreeElements (freeElements),
        mArray (0),
        mSize (0)
    {
    }

    ~PRUnicharPtrArrayGuard ()
    {
        Free ();
    }

    PRUnichar* operator[](int i)
    {
        return mArray[i];
    }

    uint32_t* GetSizeAddr(void)
    {
        return &mSize;
    }

    uint32_t GetSize(void)
    {
        return mSize;
    }

    PRUnichar*** GetArrayAddr(void)
    {
        return &mArray;
    }

    const PRUnichar** GetArray(void)
    {
        return (const PRUnichar** ) mArray;
    }

public:

private:
    bool mFreeElements;
    PRUnichar **mArray;
    uint32_t mSize;
    void Free ()
    {
        if (!mArray)
            return;

        if (mFreeElements)
          NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(mSize, mArray);
        else
        {
          nsMemory::Free(mArray);
        }
    }
};

#endif  /* nsAbUtils_h__ */
