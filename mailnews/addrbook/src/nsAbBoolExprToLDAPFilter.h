/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsBooleanExpressionToLDAPFilter_h__
#define nsBooleanExpressionToLDAPFilter_h__

#include "nsIAbBooleanExpression.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"

class nsIAbLDAPAttributeMap;

class nsAbBoolExprToLDAPFilter
{
public:
    static const int TRANSLATE_CARD_PROPERTY ;
    static const int ALLOW_NON_CONVERTABLE_CARD_PROPERTY ;

    static nsresult Convert (
            nsIAbLDAPAttributeMap* map,
            nsIAbBooleanExpression* expression,
            nsCString& filter,
            int flags = TRANSLATE_CARD_PROPERTY);

protected:
    static nsresult FilterExpression (
        nsIAbLDAPAttributeMap* map,
        nsIAbBooleanExpression* expression,
        nsCString& filter,
        int flags);
    static nsresult FilterExpressions (
        nsIAbLDAPAttributeMap* map,
        nsIArray* expressions,
        nsCString& filter,
        int flags);
    static nsresult FilterCondition (
        nsIAbLDAPAttributeMap* map,
        nsIAbBooleanConditionString* condition,
        nsCString& filter,
        int flags);
};

#endif
