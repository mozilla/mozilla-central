/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef CALATTRIBUTEHELPERS_H_
#define CALATTRIBUTEHELPERS_H_

#ifndef CAL_ATTR_SET_PRE
#define CAL_ATTR_SET_PRE /**/
#endif

#ifndef CAL_ATTR_SET_POST
#define CAL_ATTR_SET_POST /**/
#endif

/**
 ** A few helpers for declaring simple attribute getters and setters in
 ** calItemBase derivatives
 **/

// helpers for string types
#define CAL_STRINGTYPE_ATTR_GETTER(cname,mtype,name) \
NS_IMETHODIMP \
cname::Get##name (mtype &_retval) { \
    _retval.Assign(m##name); \
    return NS_OK; \
}

#define CAL_STRINGTYPE_ATTR_SETTER(cname,mtype,name) \
NS_IMETHODIMP \
cname::Set##name (const mtype &aValue) { \
    CAL_ATTR_SET_PRE; \
    m##name.Assign(aValue); \
    CAL_ATTR_SET_POST; \
    return NS_OK; \
}

#define CAL_STRINGTYPE_ATTR(cname,mtype,name) \
    CAL_STRINGTYPE_ATTR_GETTER(cname,mtype,name) \
    CAL_STRINGTYPE_ATTR_SETTER(cname,mtype,name)

// helpers for value types
#define CAL_VALUETYPE_ATTR_GETTER(cname,mtype,name) \
NS_IMETHODIMP \
cname::Get##name (mtype *_retval) { \
    NS_ENSURE_ARG_POINTER(_retval); \
    *_retval = m##name; \
    return NS_OK; \
}

#define CAL_VALUETYPE_ATTR_SETTER(cname,mtype,name) \
NS_IMETHODIMP \
cname::Set##name (mtype aValue) { \
    CAL_ATTR_SET_PRE; \
    if (m##name != aValue) { \
        m##name = aValue; \
        CAL_ATTR_SET_POST; \
    } \
    return NS_OK; \
}

#define CAL_VALUETYPE_ATTR(cname,mtype,name) \
    CAL_VALUETYPE_ATTR_GETTER(cname,mtype,name) \
    CAL_VALUETYPE_ATTR_SETTER(cname,mtype,name)

// helpers for interface types
#define CAL_ISUPPORTS_ATTR_GETTER(cname,mtype,name) \
NS_IMETHODIMP \
cname::Get##name (mtype **_retval) { \
    NS_ENSURE_ARG_POINTER(_retval); \
    NS_IF_ADDREF (*_retval = m##name); \
    return NS_OK; \
}

#define CAL_ISUPPORTS_ATTR_SETTER(cname,mtype,name) \
NS_IMETHODIMP \
cname::Set##name (mtype *aValue) { \
    CAL_ATTR_SET_PRE; \
    if (m##name != aValue) { \
        m##name = aValue; \
        CAL_ATTR_SET_POST; \
    } \
    return NS_OK; \
}

#define CAL_ISUPPORTS_ATTR(cname,mtype,name) \
    CAL_ISUPPORTS_ATTR_GETTER(cname,mtype,name) \
    CAL_ISUPPORTS_ATTR_SETTER(cname,mtype,name)


#endif
