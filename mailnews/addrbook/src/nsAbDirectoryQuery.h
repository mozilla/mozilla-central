/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbDirectoryQuery_h__
#define nsAbDirectoryQuery_h__

#include "nsIAbDirectoryQuery.h"
#include "nsIAbDirectory.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsIArray.h"
#include "nsIAbBooleanExpression.h"

class nsAbDirectoryQuerySimpleBooleanExpression : public nsIAbBooleanExpression
{
public:
    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSIABBOOLEANEXPRESSION

    nsAbDirectoryQuerySimpleBooleanExpression();
    virtual ~nsAbDirectoryQuerySimpleBooleanExpression();

public:
    nsCOMPtr<nsIArray> mExpressions;
    nsAbBooleanOperationType mOperation;
};


class nsAbDirectoryQueryArguments : public nsIAbDirectoryQueryArguments
{
public:
    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSIABDIRECTORYQUERYARGUMENTS

    nsAbDirectoryQueryArguments();
    virtual ~nsAbDirectoryQueryArguments();

protected:
    nsCOMPtr<nsISupports> mExpression;
    nsCOMPtr<nsISupports> mTypeSpecificArg;
    bool mQuerySubDirectories;
    nsCString mFilter;
};


class nsAbDirectoryQueryPropertyValue : public nsIAbDirectoryQueryPropertyValue
{
public:
    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSIABDIRECTORYQUERYPROPERTYVALUE

    nsAbDirectoryQueryPropertyValue();
    nsAbDirectoryQueryPropertyValue(const char* aName,
          const PRUnichar* aValue);
    nsAbDirectoryQueryPropertyValue(const char* aName,
          nsISupports* aValueISupports);
    virtual ~nsAbDirectoryQueryPropertyValue();

protected:
    nsCString mName;
    nsString mValue;
    nsCOMPtr<nsISupports> mValueISupports;
};


class nsAbDirectoryQuery : public nsIAbDirectoryQuery
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIABDIRECTORYQUERY

    nsAbDirectoryQuery();
    virtual ~nsAbDirectoryQuery();

protected:
    nsresult query(nsIAbDirectory* directory,
                   nsIAbBooleanExpression* expression,
                   nsIAbDirSearchListener* listener,
                   bool doSubDirectories,
                   int32_t* resultLimit);
    nsresult queryChildren(nsIAbDirectory* directory,
                           nsIAbBooleanExpression* expression,
                           nsIAbDirSearchListener* listener,
                           bool doSubDirectories,
                           int32_t* resultLimit);
    nsresult queryCards(nsIAbDirectory* directory,
                        nsIAbBooleanExpression* expression,
                        nsIAbDirSearchListener* listener,
                        int32_t* resultLimit);
    nsresult matchCard(nsIAbCard* card,
                       nsIAbBooleanExpression* expression,
                       nsIAbDirSearchListener* listener,
                       int32_t* resultLimit);
    nsresult matchCardExpression(nsIAbCard* card,
                                 nsIAbBooleanExpression* expression,
                                 bool* result);
    nsresult matchCardCondition(nsIAbCard* card,
                                nsIAbBooleanConditionString* condition,
                                bool* matchFound);

    nsresult queryMatch (nsIAbCard* card,
        nsIAbDirSearchListener* listener);
    nsresult queryFinished(nsIAbDirSearchListener* listener);
    nsresult queryError(nsIAbDirSearchListener* listener);
};

#endif
