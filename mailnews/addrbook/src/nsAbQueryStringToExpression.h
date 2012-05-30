/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbQueryStringToExpression_h__
#define nsAbQueryStringToExpression_h__

#include "nsIAbBooleanExpression.h"

class nsAbQueryStringToExpression
{
public:
    static nsresult Convert (
        const nsACString &aQueryString,
        nsIAbBooleanExpression** expression);

protected:
    static nsresult ParseExpression (
        const char** index,
        nsISupports** expression);
    static nsresult ParseExpressions (
        const char** index,
        nsIAbBooleanExpression* expression);
    static nsresult ParseCondition (
        const char** index,
        const char* indexBracketClose,
        nsIAbBooleanConditionString** conditionString);

    static nsresult ParseConditionEntry (
        const char** index,
        const char* indexBracketClose,
        char** entry);
    static nsresult ParseOperationEntry (
        const char* indexBracketOpen1,
        const char* indexBracketOpen2,
        char** operation);

    static nsresult CreateBooleanExpression(
        const char* operation,
        nsIAbBooleanExpression** expression);
    static nsresult CreateBooleanConditionString (
        const char* attribute,
        const char* condition,
        const char* value,
        nsIAbBooleanConditionString** conditionString);
};

#endif
