/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbDirectoryQuery.h"
#include "nsAbDirectoryQueryProxy.h"
#include "nsAbUtils.h"
#include "nsAbBooleanExpression.h"
#include "nsArrayUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsStringGlue.h"
#include "nsUnicharUtils.h"
#include "nsIAbDirSearchListener.h"
#include "nsISimpleEnumerator.h"
#include "nsMsgUtils.h"

NS_IMPL_ISUPPORTS1(nsAbDirectoryQuerySimpleBooleanExpression, nsIAbBooleanExpression)

nsAbDirectoryQuerySimpleBooleanExpression::nsAbDirectoryQuerySimpleBooleanExpression() :
    mOperation (nsIAbBooleanOperationTypes::AND)
{
}

nsAbDirectoryQuerySimpleBooleanExpression::~nsAbDirectoryQuerySimpleBooleanExpression()
{
}

/* attribute nsAbBooleanOperationType operation; */
NS_IMETHODIMP nsAbDirectoryQuerySimpleBooleanExpression::GetOperation(nsAbBooleanOperationType *aOperation)
{
    if (!aOperation)
        return NS_ERROR_NULL_POINTER;

    *aOperation = mOperation;

    return NS_OK;
}
NS_IMETHODIMP nsAbDirectoryQuerySimpleBooleanExpression::SetOperation(nsAbBooleanOperationType aOperation)
{
    if (aOperation != nsIAbBooleanOperationTypes::AND &&
        aOperation != nsIAbBooleanOperationTypes::OR)
        return NS_ERROR_FAILURE;

    mOperation = aOperation;

    return NS_OK;
}

/* attribute nsIArray expressions; */
NS_IMETHODIMP nsAbDirectoryQuerySimpleBooleanExpression::GetExpressions(nsIArray **aExpressions)
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

NS_IMETHODIMP nsAbDirectoryQuerySimpleBooleanExpression::SetExpressions(nsIArray *aExpressions)
{
  if (!aExpressions)
    return NS_ERROR_NULL_POINTER;

  // Ensure all the items are of the right type.
  nsresult rv;
  uint32_t count;
  rv = aExpressions->GetLength(&count);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbBooleanConditionString> queryExpression;

  for (uint32_t i = 0; i < count; ++i)
  {
    queryExpression = do_QueryElementAt(aExpressions, i, &rv);
    if (NS_FAILED(rv))
      return NS_ERROR_ILLEGAL_VALUE;
  }

  // Values ok, so we can just save and return.
  mExpressions = aExpressions;

  return NS_OK;
}

NS_IMPL_ISUPPORTS1(nsAbDirectoryQueryArguments, nsIAbDirectoryQueryArguments)

nsAbDirectoryQueryArguments::nsAbDirectoryQueryArguments() :
    mQuerySubDirectories(true)
{
}

nsAbDirectoryQueryArguments::~nsAbDirectoryQueryArguments()
{
}

/* attribute nsISupports matchItems; */
NS_IMETHODIMP nsAbDirectoryQueryArguments::GetExpression(nsISupports** aExpression)
{
    if (!aExpression)
        return NS_ERROR_NULL_POINTER;

    NS_IF_ADDREF(*aExpression = mExpression);
    return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryQueryArguments::SetExpression(nsISupports* aExpression)
{
    mExpression = aExpression;
    return NS_OK;
}

/* attribute boolean querySubDirectories; */
NS_IMETHODIMP nsAbDirectoryQueryArguments::GetQuerySubDirectories(bool* aQuerySubDirectories)
{
    NS_ENSURE_ARG_POINTER(aQuerySubDirectories);
    *aQuerySubDirectories = mQuerySubDirectories;
    return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryQueryArguments::SetQuerySubDirectories(bool aQuerySubDirectories)
{
    mQuerySubDirectories = aQuerySubDirectories;
    return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryQueryArguments::GetTypeSpecificArg(nsISupports** aArg)
{
    NS_ENSURE_ARG_POINTER(aArg);

    NS_IF_ADDREF(*aArg = mTypeSpecificArg);
    return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryQueryArguments::SetTypeSpecificArg(nsISupports* aArg)
{
    mTypeSpecificArg = aArg;
    return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryQueryArguments::GetFilter(nsACString & aFilter)
{
    aFilter.Assign(mFilter);
    return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryQueryArguments::SetFilter(const nsACString & aFilter)
{
    mFilter.Assign(aFilter);
    return NS_OK;
}

NS_IMPL_ISUPPORTS1(nsAbDirectoryQueryPropertyValue, nsIAbDirectoryQueryPropertyValue)

nsAbDirectoryQueryPropertyValue::nsAbDirectoryQueryPropertyValue()
{
}

nsAbDirectoryQueryPropertyValue::nsAbDirectoryQueryPropertyValue(const char* aName,
      const PRUnichar* aValue)
{
    mName = aName;
    mValue = aValue;
}

nsAbDirectoryQueryPropertyValue::nsAbDirectoryQueryPropertyValue(const char* aName,
      nsISupports* aValueISupports)
{
    mName = aName;
    mValueISupports = aValueISupports;
}

nsAbDirectoryQueryPropertyValue::~nsAbDirectoryQueryPropertyValue()
{
}

/* read only attribute string name; */
NS_IMETHODIMP nsAbDirectoryQueryPropertyValue::GetName(char*  *aName)
{
    *aName = mName.IsEmpty() ? 0 : ToNewCString(mName);

    return NS_OK;
}

/* read only attribute wstring value; */
NS_IMETHODIMP nsAbDirectoryQueryPropertyValue::GetValue(PRUnichar*  *aValue)
{
    *aValue = ToNewUnicode(mValue);
    if (!(*aValue)) 
        return NS_ERROR_OUT_OF_MEMORY;
    else
        return NS_OK;
}

/* readonly attribute nsISupports valueISupports; */
NS_IMETHODIMP nsAbDirectoryQueryPropertyValue::GetValueISupports(nsISupports*  *aValueISupports)
{
    if (!mValueISupports)
        return NS_ERROR_NULL_POINTER;

    NS_IF_ADDREF(*aValueISupports = mValueISupports);
    return NS_OK;
}

/* Implementation file */
NS_IMPL_ISUPPORTS1(nsAbDirectoryQuery, nsIAbDirectoryQuery)

nsAbDirectoryQuery::nsAbDirectoryQuery()
{
}

nsAbDirectoryQuery::~nsAbDirectoryQuery()
{
}

NS_IMETHODIMP nsAbDirectoryQuery::DoQuery(nsIAbDirectory *aDirectory,
                                          nsIAbDirectoryQueryArguments* arguments,
                                          nsIAbDirSearchListener* listener,
                                          int32_t resultLimit, int32_t timeOut,
                                          int32_t* _retval)
{
  NS_ENSURE_ARG_POINTER(aDirectory);

  nsCOMPtr<nsISupports> supportsExpression;
  nsresult rv = arguments->GetExpression(getter_AddRefs(supportsExpression));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbBooleanExpression> expression(do_QueryInterface(supportsExpression, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  bool doSubDirectories;
  rv = arguments->GetQuerySubDirectories(&doSubDirectories);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = query(aDirectory, expression, listener, doSubDirectories, &resultLimit);

  rv = NS_FAILED(rv) ? queryError(listener) : queryFinished(listener);

  *_retval = 0;
  return rv;
}

/* void stopQuery (in long contextID); */
NS_IMETHODIMP nsAbDirectoryQuery::StopQuery(int32_t contextID)
{
    return NS_OK;
}


nsresult nsAbDirectoryQuery::query(nsIAbDirectory* directory,
                                   nsIAbBooleanExpression* expression,
                                   nsIAbDirSearchListener* listener,
                                   bool doSubDirectories,
                                   int32_t* resultLimit)
{
  if (*resultLimit == 0)
    return NS_OK;

  nsresult rv = queryCards(directory, expression, listener, resultLimit);
  NS_ENSURE_SUCCESS(rv, rv);

  if (doSubDirectories && resultLimit != 0)
  {
    rv = queryChildren(directory, expression, listener, doSubDirectories,
                       resultLimit);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return rv;
}

nsresult nsAbDirectoryQuery::queryChildren(nsIAbDirectory* directory,
                                           nsIAbBooleanExpression* expression,
                                           nsIAbDirSearchListener* listener,
                                           bool doSubDirectories,
                                           int32_t* resultLimit)
{
    nsresult rv = NS_OK;

    nsCOMPtr<nsISimpleEnumerator> subDirectories;
    rv = directory->GetChildNodes(getter_AddRefs(subDirectories));
    NS_ENSURE_SUCCESS(rv, rv);

    bool hasMore;
    while (NS_SUCCEEDED(rv = subDirectories->HasMoreElements(&hasMore)) && hasMore)
    {
        nsCOMPtr<nsISupports> item;
        rv = subDirectories->GetNext (getter_AddRefs (item));
        NS_ENSURE_SUCCESS(rv, rv);

        nsCOMPtr<nsIAbDirectory> subDirectory(do_QueryInterface(item, &rv));
        NS_ENSURE_SUCCESS(rv, rv);
        
        rv = query(subDirectory, expression, listener, doSubDirectories, resultLimit);
        NS_ENSURE_SUCCESS(rv, rv);

    }
    return NS_OK;
}

nsresult nsAbDirectoryQuery::queryCards(nsIAbDirectory* directory,
                                        nsIAbBooleanExpression* expression,
                                        nsIAbDirSearchListener* listener,
                                        int32_t* resultLimit)
{
    nsresult rv = NS_OK;

    nsCOMPtr<nsISimpleEnumerator> cards;
    rv = directory->GetChildCards(getter_AddRefs(cards));
    if (NS_FAILED(rv))
    {
        if (rv != NS_ERROR_NOT_IMPLEMENTED)
            NS_ENSURE_SUCCESS(rv, rv);
        else
            return NS_OK;
    }

    if (!cards)
        return NS_OK;

    bool more;
    while (NS_SUCCEEDED(cards->HasMoreElements(&more)) && more)
    {
        nsCOMPtr<nsISupports> item;
        rv = cards->GetNext(getter_AddRefs(item));
        NS_ENSURE_SUCCESS(rv, rv);

        nsCOMPtr<nsIAbCard> card(do_QueryInterface(item, &rv));
        NS_ENSURE_SUCCESS(rv, rv);
        
        rv = matchCard (card, expression, listener, resultLimit);
        NS_ENSURE_SUCCESS(rv, rv);

        if (*resultLimit == 0)
            return NS_OK;
    }

    return NS_OK;
}

nsresult nsAbDirectoryQuery::matchCard(nsIAbCard* card,
                                       nsIAbBooleanExpression* expression,
                                       nsIAbDirSearchListener* listener,
                                       int32_t* resultLimit)
{
    bool matchFound = false;
    nsresult rv = matchCardExpression(card, expression, &matchFound);
    NS_ENSURE_SUCCESS(rv, rv);

    if (matchFound)
    {
        (*resultLimit)--;
        rv = queryMatch(card, listener);
        NS_ENSURE_SUCCESS(rv, rv);
    }

    return rv;
}

nsresult nsAbDirectoryQuery::matchCardExpression(nsIAbCard* card,
                                                 nsIAbBooleanExpression* expression,
                                                 bool* result)
{
    nsAbBooleanOperationType operation;
    nsresult rv = expression->GetOperation (&operation);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIArray> childExpressions;
    rv = expression->GetExpressions (getter_AddRefs (childExpressions));
    NS_ENSURE_SUCCESS(rv, rv);
    
    uint32_t count;
    rv = childExpressions->GetLength(&count);
    NS_ENSURE_SUCCESS(rv, rv);

    if (operation == nsIAbBooleanOperationTypes::NOT &&
        count > 1)
        return NS_ERROR_FAILURE;

    bool value = *result = false;
    nsCOMPtr<nsIAbBooleanConditionString> childCondition;
    nsCOMPtr<nsIAbBooleanExpression> childExpression;

    for (uint32_t i = 0; i < count; i++)
    {
        childCondition = do_QueryElementAt(childExpressions, i, &rv);
        if (NS_SUCCEEDED(rv))
        {
            rv = matchCardCondition (card, childCondition, &value);
            NS_ENSURE_SUCCESS(rv, rv);
        }
        else
        {
            childExpression = do_QueryElementAt(childExpressions, i, &rv);
            if (NS_SUCCEEDED(rv))
            {
                rv = matchCardExpression (card, childExpression, &value);
                NS_ENSURE_SUCCESS(rv, rv);
            }
            else
                return NS_ERROR_FAILURE;
        }
        if (operation == nsIAbBooleanOperationTypes::OR && value)
            break;
        else if (operation == nsIAbBooleanOperationTypes::AND && !value)
            break;
        else if (operation == nsIAbBooleanOperationTypes::NOT)
            value = !value;
    }
    *result = value;

    return NS_OK;
}

nsresult nsAbDirectoryQuery::matchCardCondition(nsIAbCard* card,
                                                nsIAbBooleanConditionString* condition,
                                                bool* matchFound)
{
    nsAbBooleanConditionType conditionType;
    nsresult rv = condition->GetCondition (&conditionType);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCString name;
    rv = condition->GetName (getter_Copies (name));
    NS_ENSURE_SUCCESS(rv, rv);

    if (name.Equals ("card:nsIAbCard"))
    {
      *matchFound = (conditionType == nsIAbBooleanConditionTypes::Exists);
      return NS_OK;
    }

    nsString matchValue;
    rv = condition->GetValue (getter_Copies (matchValue));
    NS_ENSURE_SUCCESS(rv, rv);

    if (name.EqualsLiteral("IsMailList"))
    {
      bool isMailList;
      rv = card->GetIsMailList(&isMailList);
      NS_ENSURE_SUCCESS(rv, rv);

      // Only equals is supported.
      if (conditionType != nsIAbBooleanConditionTypes::Is)
        return NS_ERROR_FAILURE;

      *matchFound = isMailList ? matchValue.EqualsLiteral("TRUE") :
                                 matchValue.EqualsLiteral("FALSE");
      return NS_OK;
    }

    nsString value;
    (void)card->GetPropertyAsAString(name.get(), value);

    if (value.IsEmpty())
    {
      *matchFound = (conditionType == nsIAbBooleanConditionTypes::DoesNotExist) ?
          true : false;
      return NS_OK;
    }

    /* TODO
     * What about allowing choice between case insensitive
     * and case sensitive comparisons?
     *
     */
    switch (conditionType)
    {
        case nsIAbBooleanConditionTypes::Exists:
            *matchFound = true;
            break;
        case nsIAbBooleanConditionTypes::Contains:
            *matchFound = CaseInsensitiveFindInReadable(matchValue, value);
            break;
        case nsIAbBooleanConditionTypes::DoesNotContain:
            *matchFound = !CaseInsensitiveFindInReadable(matchValue, value);
            break;
        case nsIAbBooleanConditionTypes::Is:
            *matchFound = value.Equals(matchValue, nsCaseInsensitiveStringComparator());
            break;
        case nsIAbBooleanConditionTypes::IsNot:
            *matchFound = !value.Equals(matchValue, nsCaseInsensitiveStringComparator());
            break;
        case nsIAbBooleanConditionTypes::BeginsWith:
            *matchFound = StringBeginsWith(value, matchValue, nsCaseInsensitiveStringComparator());
            break;
        case nsIAbBooleanConditionTypes::LessThan:
            *matchFound = Compare(value, matchValue, nsCaseInsensitiveStringComparator()) < 0;
            break;
        case nsIAbBooleanConditionTypes::GreaterThan:
            *matchFound = Compare(value, matchValue, nsCaseInsensitiveStringComparator()) > 0;
            break;
        case nsIAbBooleanConditionTypes::EndsWith:
            *matchFound = StringEndsWith(value, matchValue, nsCaseInsensitiveStringComparator());
            break;
        case nsIAbBooleanConditionTypes::SoundsLike:
        case nsIAbBooleanConditionTypes::RegExp:
            *matchFound = false;
            break;
        default:
            *matchFound = false;
    }

    return rv;
}

nsresult nsAbDirectoryQuery::queryMatch(nsIAbCard* card,
    nsIAbDirSearchListener* listener)
{
  return listener->OnSearchFoundCard(card);
}

nsresult nsAbDirectoryQuery::queryFinished(nsIAbDirSearchListener* listener)
{
    return listener->OnSearchFinished(nsIAbDirectoryQueryResultListener::queryResultComplete, EmptyString());
}

nsresult nsAbDirectoryQuery::queryError(nsIAbDirSearchListener* listener)
{
    return listener->OnSearchFinished(nsIAbDirectoryQueryResultListener::queryResultError, EmptyString());
}
