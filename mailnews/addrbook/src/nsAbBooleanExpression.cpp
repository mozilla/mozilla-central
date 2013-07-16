/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbBooleanExpression.h"
#include "nsComponentManagerUtils.h"

NS_IMPL_ISUPPORTS1(nsAbBooleanConditionString, nsIAbBooleanConditionString)

nsAbBooleanConditionString::nsAbBooleanConditionString() :
    mCondition (nsIAbBooleanConditionTypes::Exists)
{
}

nsAbBooleanConditionString::~nsAbBooleanConditionString()
{
}

/* attribute nsAbBooleanConditionType condition; */
NS_IMETHODIMP nsAbBooleanConditionString::GetCondition(nsAbBooleanConditionType *aCondition)
{
    if (!aCondition)
        return NS_ERROR_NULL_POINTER;

    *aCondition = mCondition;

    return NS_OK;
}
NS_IMETHODIMP nsAbBooleanConditionString::SetCondition(nsAbBooleanConditionType aCondition)
{
    mCondition = aCondition;

    return NS_OK;
}

/* attribute string name; */
NS_IMETHODIMP nsAbBooleanConditionString::GetName(char** aName)
{
    if (!aName)
        return NS_ERROR_NULL_POINTER;

    *aName = mName.IsEmpty() ? 0 : ToNewCString(mName);

    return NS_OK;

}
NS_IMETHODIMP nsAbBooleanConditionString::SetName(const char* aName)
{
    if (!aName)
        return NS_ERROR_NULL_POINTER;

    mName = aName;

    return NS_OK;
}

/* attribute wstring value; */
NS_IMETHODIMP nsAbBooleanConditionString::GetValue(PRUnichar** aValue)
{
    if (!aValue)
        return NS_ERROR_NULL_POINTER;

    *aValue = ToNewUnicode(mValue);

    return NS_OK;
}
NS_IMETHODIMP nsAbBooleanConditionString::SetValue(const PRUnichar * aValue)
{
    if (!aValue)
        return NS_ERROR_NULL_POINTER;

    mValue = aValue;

    return NS_OK;
}

NS_IMPL_ISUPPORTS1(nsAbBooleanExpression, nsIAbBooleanExpression)

nsAbBooleanExpression::nsAbBooleanExpression() :
    mOperation (nsIAbBooleanOperationTypes::AND)
{
}

nsAbBooleanExpression::~nsAbBooleanExpression()
{
}

/* attribute nsAbBooleanOperationType operation; */
NS_IMETHODIMP nsAbBooleanExpression::GetOperation(nsAbBooleanOperationType *aOperation)
{
    if (!aOperation)
        return NS_ERROR_NULL_POINTER;

    *aOperation = mOperation;

    return NS_OK;
}
NS_IMETHODIMP nsAbBooleanExpression::SetOperation(nsAbBooleanOperationType aOperation)
{
    mOperation = aOperation;

    return NS_OK;
}

/* attribute nsIArray expressions; */
NS_IMETHODIMP nsAbBooleanExpression::GetExpressions(nsIArray **aExpressions)
{
  if (!aExpressions)
    return NS_ERROR_NULL_POINTER;

  if (!mExpressions)
  {
    mExpressions = do_CreateInstance(NS_ARRAY_CONTRACTID);

    if (!mExpressions)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  NS_ADDREF(*aExpressions = mExpressions);
  return NS_OK;
}

NS_IMETHODIMP nsAbBooleanExpression::SetExpressions(nsIArray *aExpressions)
{
  if (!aExpressions)
    return NS_ERROR_NULL_POINTER;

  mExpressions = aExpressions;

  return NS_OK;
}
