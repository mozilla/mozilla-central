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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is
 *  Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Shaver <shaver@off.net>
 *   Michiel van Leeuwen <mvl@exedo.nl>
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
#include "nsStringStream.h"
#include "nsComponentManagerUtils.h"
#include "nsIClassInfoImpl.h"

#include "calICSService.h"
#include "calTimezone.h"
#include "calDateTime.h"
#include "calDuration.h"
#include "calIErrors.h"

extern "C" {
#include "ical.h"
}

calIcalProperty::~calIcalProperty()
{
    if (!mParent) {
        icalproperty_free(mProperty);
    }
}

NS_IMPL_ISUPPORTS1(calIcalProperty, calIIcalProperty)

NS_IMETHODIMP_(icalproperty *)
calIcalProperty::GetIcalProperty()
{
    return mProperty;
}

NS_IMETHODIMP_(icalcomponent *)
calIcalProperty::GetIcalComponent()
{
    return mParent->GetIcalComponent();
}

NS_IMETHODIMP
calIcalProperty::GetIcalString(nsACString &str)
{
    char const* icalstr = icalproperty_as_ical_string(mProperty);
    if (icalstr == 0) {
#ifdef DEBUG
        fprintf(stderr, "Error getting ical string: %d (%s)\n",
                icalerrno, icalerror_strerror(icalerrno));
#endif
        return calIErrors::ICS_ERROR_BASE + icalerrno;
    }
    str.Assign(icalstr);
    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::ToString(nsACString& aResult)
{
    return GetIcalString(aResult);
}

NS_IMETHODIMP
calIcalProperty::GetValue(nsACString &str)
{
    icalvalue_kind kind = icalproperty_kind_to_value_kind(icalproperty_isa(mProperty));

    const char *icalstr;
    if (kind == ICAL_TEXT_VALUE) {
        icalvalue *v = icalproperty_get_value(mProperty);
        icalstr = icalvalue_get_text(v);
    } else if (kind == ICAL_X_VALUE) {
        icalvalue *v = icalproperty_get_value(mProperty);
        icalstr = icalvalue_get_x(v);
    } else {
        icalstr = icalproperty_get_value_as_string(mProperty);
    }

    if (!icalstr) {
        if (icalerrno == ICAL_BADARG_ERROR) {
            str.Truncate();
            // Set string to null, because we don't have a value
            // (which is something different then an empty value)
            str.SetIsVoid(PR_TRUE);
            return NS_OK;
        }
        
#ifdef DEBUG
        fprintf(stderr, "Error getting string value: %d (%s)\n",
                icalerrno, icalerror_strerror(icalerrno));
#endif
        return NS_ERROR_FAILURE;
    }

    str.Assign(icalstr);
    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::SetValue(const nsACString &str)
{
    icalvalue_kind kind = icalproperty_kind_to_value_kind(icalproperty_isa(mProperty));
    if (kind == ICAL_TEXT_VALUE) {
        icalvalue *v = icalvalue_new_text(PromiseFlatCString(str).get());
        icalproperty_set_value(mProperty, v);
    } else if (kind == ICAL_X_VALUE) {
        icalvalue *v = icalvalue_new_x(PromiseFlatCString(str).get());
        icalproperty_set_value(mProperty, v);
    } else {
        icalproperty_set_value_from_string(mProperty,
                                           PromiseFlatCString(str).get(),
                                           icalvalue_kind_to_string(kind));
    }
    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::GetValueAsIcalString(nsACString &str)
{
    const char *icalstr = icalproperty_get_value_as_string(mProperty);
    if (!icalstr) {
        if (icalerrno == ICAL_BADARG_ERROR) {
            str.Truncate();
            // Set string to null, because we don't have a value
            // (which is something different then an empty value)
            str.SetIsVoid(PR_TRUE);
            return NS_OK;
        }
        
#ifdef DEBUG
        fprintf(stderr, "Error getting string value: %d (%s)\n",
                icalerrno, icalerror_strerror(icalerrno));
#endif
        return NS_ERROR_FAILURE;
    }

    str.Assign(icalstr);
    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::SetValueAsIcalString(const nsACString &str)
{
    const char *kindstr = 
        icalvalue_kind_to_string(icalproperty_kind_to_value_kind(icalproperty_isa(mProperty)));
    icalproperty_set_value_from_string(mProperty,
                                       PromiseFlatCString(str).get(),
                                       kindstr);
    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::GetPropertyName(nsACString &name)
{
    const char *icalstr = icalproperty_get_property_name(mProperty);
    if (!icalstr) {
#ifdef DEBUG
        fprintf(stderr, "Error getting property name: %d (%s)\n",
                icalerrno, icalerror_strerror(icalerrno));
#endif
        return NS_ERROR_FAILURE;
    }
    name.Assign(icalstr);
    return NS_OK;
}

static icalparameter*
FindXParameter(icalproperty *prop, const nsACString &param)
{
    for (icalparameter *icalparam =
             icalproperty_get_first_parameter(prop, ICAL_X_PARAMETER);
         icalparam;
         icalparam = icalproperty_get_next_parameter(prop, ICAL_X_PARAMETER)) {
        if (param.Equals(icalparameter_get_xname(icalparam)))
            return icalparam;
    }
    return nsnull;
}

NS_IMETHODIMP
calIcalProperty::GetParameter(const nsACString &param, nsACString &value)
{
    // More ridiculous parameter/X-PARAMETER handling.
    icalparameter_kind paramkind = 
        icalparameter_string_to_kind(PromiseFlatCString(param).get());

    if (paramkind == ICAL_NO_PARAMETER)
        return NS_ERROR_INVALID_ARG;

    const char *icalstr = nsnull;
    if (paramkind == ICAL_X_PARAMETER) {
        icalparameter *icalparam = FindXParameter(mProperty, param);
        if (icalparam)
            icalstr = icalparameter_get_xvalue(icalparam);
    } else {
        icalstr = icalproperty_get_parameter_as_string(mProperty,
                                                       PromiseFlatCString(param).get());
    }

    if (!icalstr) {
        value.Truncate();
        value.SetIsVoid(PR_TRUE);
    } else {
        value.Assign(icalstr);
    }
    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::SetParameter(const nsACString &param, const nsACString &value)
{
    icalparameter_kind paramkind = 
        icalparameter_string_to_kind(PromiseFlatCString(param).get());

    if (paramkind == ICAL_NO_PARAMETER)
        return NS_ERROR_INVALID_ARG;

    // Because libical's support for manipulating parameters is weak, and
    // X-PARAMETERS doubly so, we walk the list looking for an existing one of
    // that name, and reset its value if found.
    if (paramkind == ICAL_X_PARAMETER) {
        icalparameter *icalparam = FindXParameter(mProperty, param);
        if (icalparam) {
            icalparameter_set_xvalue(icalparam,
                                     PromiseFlatCString(value).get());
            return NS_OK;
        }
        // If not found, fall through to adding a new parameter below.
    } else {
        // We could try getting an existing parameter here and resetting its
        // value, but this is easier and I don't care that much about parameter
        // performance at this point.
        RemoveParameter(param);
    }

    icalparameter *icalparam = 
        icalparameter_new_from_value_string(paramkind,
                                            PromiseFlatCString(value).get());
    if (!icalparam)
        return NS_ERROR_OUT_OF_MEMORY;

    // You might ask me "why does libical not do this for us?" and I would 
    // just nod knowingly but sadly at you in return.
    //
    // You might also, if you were not too distracted by the first question,
    // ask why we have icalproperty_set_x_name but icalparameter_set_xname.
    // More nodding would ensue.
    if (paramkind == ICAL_X_PARAMETER)
        icalparameter_set_xname(icalparam, PromiseFlatCString(param).get());
    
    icalproperty_add_parameter(mProperty, icalparam);
    // XXX check ical errno
    return NS_OK;
}

static nsresult
FillParameterName(icalparameter *icalparam, nsACString &name)
{
    const char *propname = nsnull;
    if (icalparam) {
        icalparameter_kind paramkind = icalparameter_isa(icalparam);
        if (paramkind == ICAL_X_PARAMETER)
            propname = icalparameter_get_xname(icalparam);
        else if (paramkind != ICAL_NO_PARAMETER)
            propname = icalparameter_kind_to_string(paramkind);
    }

    if (propname) {
        name.Assign(propname);
    } else {
        name.Truncate();
        name.SetIsVoid(PR_TRUE);
    }

    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::GetFirstParameterName(nsACString &name)
{
    icalparameter *icalparam =
        icalproperty_get_first_parameter(mProperty,
                                         ICAL_ANY_PARAMETER);
    return FillParameterName(icalparam, name);
}

NS_IMETHODIMP
calIcalProperty::GetNextParameterName(nsACString &name)
{
    icalparameter *icalparam =
        icalproperty_get_next_parameter(mProperty,
                                        ICAL_ANY_PARAMETER);
    return FillParameterName(icalparam, name);
}

NS_IMETHODIMP
calIcalProperty::RemoveParameter(const nsACString &param)
{
    icalparameter_kind paramkind =
        icalparameter_string_to_kind(PromiseFlatCString(param).get());

    if (paramkind == ICAL_NO_PARAMETER || paramkind == ICAL_X_PARAMETER)
        return NS_ERROR_INVALID_ARG;

    icalproperty_remove_parameter(mProperty, paramkind);
    // XXX check ical errno
    return NS_OK;
}

NS_IMETHODIMP
calIcalProperty::ClearXParameters()
{
    int oldcount, paramcount = 0;
    do {
        oldcount = paramcount;
        icalproperty_remove_parameter(mProperty, ICAL_X_PARAMETER);
        paramcount = icalproperty_count_parameters(mProperty);
    } while (oldcount != paramcount);
    return NS_OK;
}


NS_IMETHODIMP
calIcalProperty::GetValueAsDatetime(calIDateTime **dtp)
{
    NS_ENSURE_ARG_POINTER(dtp);
    return getDatetime_(toIcalComponent(mParent), mProperty, dtp);
}

nsresult calIcalProperty::getDatetime_(calIcalComponent * parent,
                                       icalproperty * prop,
                                       calIDateTime ** dtp)
{
    icalvalue * const val = icalproperty_get_value(prop);
    icalvalue_kind const valkind = icalvalue_isa(val);
    if (valkind != ICAL_DATETIME_VALUE && valkind != ICAL_DATE_VALUE) {
        return NS_ERROR_UNEXPECTED;
    }
    icaltimetype itt = icalvalue_get_datetime(val);

    char const* tzid_ = nsnull;
    if (!itt.is_utc) {
        if (itt.zone) {
            tzid_ = icaltimezone_get_tzid(const_cast<icaltimezone *>(itt.zone));
        } else {
            // Need to get the tzid param. Unfortunatly, libical tends to return raw
            // ics strings, with quotes and everything. That's not what we want. Need
            // to work around.
            icalparameter * const tzparam = icalproperty_get_first_parameter(prop, ICAL_TZID_PARAMETER);
            if (tzparam) {
                tzid_ = icalparameter_get_xvalue(tzparam);
            }
        }
    }

    nsCOMPtr<calITimezone> tz;
    if (tzid_) {
        nsDependentCString const tzid(tzid_);
        calIcalComponent * comp = nsnull;
        if (parent) {
            comp = parent->getParentVCalendarOrThis();
        }
        // look up parent if timezone is already referenced:
        if (comp) {
            comp->mReferencedTimezones.Get(tzid, getter_AddRefs(tz));
        }
        if (!tz) {
            if (parent) {
                // passed tz provider has precedence over timezone service:
                calITimezoneProvider * const tzProvider = parent->getTzProvider();
                if (tzProvider) {
                    tzProvider->GetTimezone(tzid, getter_AddRefs(tz));
                    NS_ASSERTION(tz, tzid_);
                }
            }
            if (!tz) {
                // look up tz in tz service.
                // this hides errors from incorrect ics files, which could state
                // a TZID that is not present in the ics file.
                // The other way round, it makes this product more error tolerant.
                cal::getTimezoneService()->GetTimezone(tzid, getter_AddRefs(tz));

                if (!tz) {
                    icaltimezone const* zone = itt.zone;
                    if (!zone && comp) {
                        // look up parent VCALENDAR for VTIMEZONE:
                        zone = icalcomponent_get_timezone(comp->mComponent, tzid_);
                        NS_ASSERTION(zone, tzid_);
                    }
                    if (zone) {
                        // We need to decouple this (inner) VTIMEZONE from the parent VCALENDAR to avoid
                        // running into circular references (referenced timezones):
                        icaltimezone * const clonedZone = icaltimezone_new();
                        CAL_ENSURE_MEMORY(clonedZone);
                        icalcomponent * const clonedZoneComp =
                            icalcomponent_new_clone(icaltimezone_get_component(const_cast<icaltimezone *>(zone)));
                        if (!clonedZoneComp) {
                            icaltimezone_free(clonedZone, 1 /* free struct */);
                            CAL_ENSURE_MEMORY(clonedZoneComp);
                        }
                        if (!icaltimezone_set_component(clonedZone, clonedZoneComp)) {
                            icaltimezone_free(clonedZone, 1 /* free struct */);
                            return NS_ERROR_INVALID_ARG;
                        }
                        nsCOMPtr<calIIcalComponent> const tzComp(new calIcalComponent(clonedZone, clonedZoneComp));
                        CAL_ENSURE_MEMORY(tzComp);
                        tz = new calTimezone(tzid, tzComp);
                        CAL_ENSURE_MEMORY(tz);
                    } else { // install phantom timezone, so the data could be repaired:
                        tz = new calTimezone(tzid, nsnull);
                        CAL_ENSURE_MEMORY(tz);
                    }
                }
            }
            if (comp && tz) {
                // assure timezone is known:
                comp->AddTimezoneReference(tz);
            }
        }
        if (tz) {
            // correct itt which would else appear floating:
            itt.zone = cal::getIcalTimezone(tz);
            itt.is_utc = 0;
        } else {
            cal::logMissingTimezone(tzid_);
        }
    }
    *dtp = new calDateTime(&itt, tz);
    CAL_ENSURE_MEMORY(*dtp);
    NS_ADDREF(*dtp);
    return NS_OK;
}


calIcalComponent::~calIcalComponent()
{
    if (!mParent) {
        // We free either a plain icalcomponent or a icaltimezone.
        // In the latter case icaltimezone_free frees the VTIMEZONE component.
        if (mTimezone) {
            icaltimezone_free(mTimezone, 1 /* free struct */);
        } else {
            icalcomponent_free(mComponent);
        }
    }
}

NS_IMETHODIMP
calIcalComponent::AddTimezoneReference(calITimezone *aTimezone)
{
    NS_ENSURE_ARG_POINTER(aTimezone);
    nsCAutoString tzid;
    nsresult rv = aTimezone->GetTzid(tzid);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!mReferencedTimezones.Put(tzid, aTimezone)) {
        return NS_ERROR_OUT_OF_MEMORY;
    }
    return NS_OK;
}

static PLDHashOperator
TimezoneHashToTimezoneArray(nsACString const& /*tzid*/, calITimezone * tz, void * arg)
{
    calITimezone *** const arrayPtr = static_cast<calITimezone ***>(arg);
    NS_ADDREF(**arrayPtr = tz);
    ++(*arrayPtr);
    return PL_DHASH_NEXT;
}

NS_IMETHODIMP
calIcalComponent::GetReferencedTimezones(PRUint32 * aCount, calITimezone *** aTimezones)
{
    NS_ENSURE_ARG_POINTER(aCount);
    NS_ENSURE_ARG_POINTER(aTimezones);

    PRUint32 const count = mReferencedTimezones.Count();
    if (count == 0) {
        *aCount = 0;
        *aTimezones = nsnull;
        return NS_OK;
    }

    calITimezone ** const timezones = static_cast<calITimezone **>(
        nsMemory::Alloc(sizeof(calITimezone *) * count));
    CAL_ENSURE_MEMORY(timezones);
    // tzptr will get used as an iterator by the enumerator function
    calITimezone ** tzptr = timezones;
    mReferencedTimezones.EnumerateRead(TimezoneHashToTimezoneArray, &tzptr);

    *aTimezones = timezones;
    *aCount = count;
    return NS_OK;
}

nsresult
calIcalComponent::SetPropertyValue(icalproperty_kind kind, icalvalue *val)
{
    ClearAllProperties(kind);
    if (!val)
        return NS_OK;

    icalproperty *prop = icalproperty_new(kind);
    if (!prop) {
        icalvalue_free(val);
        return NS_ERROR_OUT_OF_MEMORY;
    }

    icalproperty_set_value(prop, val);
    icalcomponent_add_property(mComponent, prop);
    return NS_OK;
}

nsresult
calIcalComponent::SetProperty(icalproperty_kind kind, icalproperty *prop)
{
    ClearAllProperties(kind);
    if (!prop)
        return NS_OK;
    icalcomponent_add_property(mComponent, prop);
    return NS_OK;
}

#define COMP_STRING_TO_GENERAL_ENUM_ATTRIBUTE(Attrname, ICALNAME, lcname) \
NS_IMETHODIMP                                                           \
calIcalComponent::Get##Attrname(nsACString &str)                        \
{                                                                       \
    PRInt32 val;                                                        \
    nsresult rv = GetIntProperty(ICAL_##ICALNAME##_PROPERTY, &val);     \
    if (NS_FAILED(rv))                                                  \
        return rv;                                                      \
    if (val == -1) {                                                    \
        str.Truncate();                                                 \
        str.SetIsVoid(PR_TRUE);                                         \
    } else {                                                            \
        str.Assign(icalproperty_enum_to_string(val));                   \
    }                                                                   \
    return NS_OK;                                                       \
}                                                                       \
                                                                        \
NS_IMETHODIMP                                                           \
calIcalComponent::Set##Attrname(const nsACString &str)                  \
{                                                                       \
    int val = icalproperty_string_to_enum(PromiseFlatCString(str).get()); \
    icalvalue *ival = icalvalue_new_##lcname((icalproperty_##lcname)val); \
    return SetPropertyValue(ICAL_##ICALNAME##_PROPERTY, ival);          \
}                                                                       \

#define COMP_STRING_TO_ENUM_ATTRIBUTE(Attrname, ICALNAME, lcname)       \
NS_IMETHODIMP                                                           \
calIcalComponent::Get##Attrname(nsACString &str)                        \
{                                                                       \
    PRInt32 val;                                                        \
    nsresult rv = GetIntProperty(ICAL_##ICALNAME##_PROPERTY, &val);     \
    if (NS_FAILED(rv))                                                  \
        return rv;                                                      \
    if (val == -1) {                                                    \
        str.Truncate();                                                 \
        str.SetIsVoid(PR_TRUE);                                         \
    } else {                                                            \
        str.Assign(icalproperty_##lcname##_to_string((icalproperty_##lcname)val)); \
    }                                                                   \
    return NS_OK;                                                       \
}                                                                       \
                                                                        \
NS_IMETHODIMP                                                           \
calIcalComponent::Set##Attrname(const nsACString &str)                  \
{                                                                       \
    icalproperty *prop = nsnull;                                        \
    if (!str.IsVoid()) {                                                \
        icalproperty_##lcname val =                                     \
            icalproperty_string_to_##lcname(PromiseFlatCString(str).get()); \
        prop = icalproperty_new_##lcname(val);                          \
        if (!prop)                                                      \
            return NS_ERROR_OUT_OF_MEMORY; /* XXX map errno */          \
    }                                                                   \
    return SetProperty(ICAL_##ICALNAME##_PROPERTY, prop);               \
}                                                                       \

#define COMP_GENERAL_STRING_ATTRIBUTE(Attrname, ICALNAME)       \
NS_IMETHODIMP                                                   \
calIcalComponent::Get##Attrname(nsACString &str)                \
{                                                               \
    return GetStringProperty(ICAL_##ICALNAME##_PROPERTY, str);  \
}                                                               \
                                                                \
NS_IMETHODIMP                                                   \
calIcalComponent::Set##Attrname(const nsACString &str)          \
{                                                               \
    return SetStringProperty(ICAL_##ICALNAME##_PROPERTY, str);  \
}

#define COMP_STRING_ATTRIBUTE(Attrname, ICALNAME, lcname)       \
NS_IMETHODIMP                                                   \
calIcalComponent::Get##Attrname(nsACString &str)                \
{                                                               \
    return GetStringProperty(ICAL_##ICALNAME##_PROPERTY, str);  \
}                                                               \
                                                                \
NS_IMETHODIMP                                                   \
calIcalComponent::Set##Attrname(const nsACString &str)          \
{                                                               \
    icalproperty *prop =                                        \
        icalproperty_new_##lcname(PromiseFlatCString(str).get()); \
    return SetProperty(ICAL_##ICALNAME##_PROPERTY, prop);       \
}

#define COMP_GENERAL_INT_ATTRIBUTE(Attrname, ICALNAME)          \
NS_IMETHODIMP                                                   \
calIcalComponent::Get##Attrname(PRInt32 *valp)                  \
{                                                               \
    return GetIntProperty(ICAL_##ICALNAME##_PROPERTY, valp);    \
}                                                               \
                                                                \
NS_IMETHODIMP                                                   \
calIcalComponent::Set##Attrname(PRInt32 val)                    \
{                                                               \
    return SetIntProperty(ICAL_##ICALNAME##_PROPERTY, val);     \
}                                                               \

#define COMP_ENUM_ATTRIBUTE(Attrname, ICALNAME, lcname)         \
NS_IMETHODIMP                                                   \
calIcalComponent::Get##Attrname(PRInt32 *valp)                  \
{                                                               \
    return GetIntProperty(ICAL_##ICALNAME##_PROPERTY, valp);    \
}                                                               \
                                                                \
NS_IMETHODIMP                                                   \
calIcalComponent::Set##Attrname(PRInt32 val)                    \
{                                                               \
    icalproperty *prop =                                        \
      icalproperty_new_##lcname((icalproperty_##lcname)val);    \
    return SetProperty(ICAL_##ICALNAME##_PROPERTY, prop);       \
}                                                               \

#define COMP_INT_ATTRIBUTE(Attrname, ICALNAME, lcname)          \
NS_IMETHODIMP                                                   \
calIcalComponent::Get##Attrname(PRInt32 *valp)                  \
{                                                               \
    return GetIntProperty(ICAL_##ICALNAME##_PROPERTY, valp);    \
}                                                               \
                                                                \
NS_IMETHODIMP                                                   \
calIcalComponent::Set##Attrname(PRInt32 val)                    \
{                                                               \
    icalproperty *prop = icalproperty_new_##lcname(val);        \
    return SetProperty(ICAL_##ICALNAME##_PROPERTY, prop);       \
}                                                               \

nsresult calIcalComponent::GetStringProperty(icalproperty_kind kind, nsACString &str)
{
    icalproperty *prop = icalcomponent_get_first_property(mComponent, kind);
    if (!prop) {
        str.Truncate();
        str.SetIsVoid(PR_TRUE);
    } else {
        str.Assign(icalvalue_get_string(icalproperty_get_value(prop)));
    }
    return NS_OK;
}

nsresult calIcalComponent::SetStringProperty(icalproperty_kind kind,
                                             const nsACString &str)
{
    icalvalue *val = nsnull;
    if (!str.IsVoid()) {
        val = icalvalue_new_string(PromiseFlatCString(str).get());
        if (!val)
            return NS_ERROR_OUT_OF_MEMORY;
    }
    return SetPropertyValue(kind, val);
}

nsresult calIcalComponent::GetIntProperty(icalproperty_kind kind, PRInt32 *valp)
{
    icalproperty *prop = icalcomponent_get_first_property(mComponent, kind);
    if (!prop)
        *valp = calIIcalComponent::INVALID_VALUE;
    else
        *valp = (PRInt32)icalvalue_get_integer(icalproperty_get_value(prop));
    return NS_OK;
}

nsresult calIcalComponent::SetIntProperty(icalproperty_kind kind, PRInt32 i)
{
    icalvalue *val = icalvalue_new_integer(i);
    if (!val)
        return NS_ERROR_OUT_OF_MEMORY;
    return SetPropertyValue(kind, val);
}

nsresult calIcalComponent::GetDateTimeAttribute(icalproperty_kind kind,
                                                calIDateTime ** dtp)
{
    NS_ENSURE_ARG_POINTER(dtp);
    icalproperty *prop = icalcomponent_get_first_property(mComponent, kind);
    if (!prop) {
        *dtp = nsnull;  /* invalid date */
        return NS_OK;
    }
    return calIcalProperty::getDatetime_(this, prop, dtp);
}

nsresult calIcalComponent::SetDateTimeAttribute(icalproperty_kind kind,
                                                calIDateTime * dt)
{
    ClearAllProperties(kind);
    PRBool isValid;
    if (!dt || NS_FAILED(dt->GetIsValid(&isValid)) || !isValid) {
        return NS_OK;
    }
    icalproperty *prop = icalproperty_new(kind);
    CAL_ENSURE_MEMORY(prop);
    nsresult rc = calIcalProperty::setDatetime_(this, prop, dt);
    if (NS_SUCCEEDED(rc))
        icalcomponent_add_property(mComponent, prop);
    else
        icalproperty_free(prop);
    return rc;
}

NS_IMETHODIMP
calIcalProperty::SetValueAsDatetime(calIDateTime *dt)
{
    NS_ENSURE_ARG_POINTER(dt);
    return setDatetime_(toIcalComponent(mParent), mProperty, dt);
}

nsresult calIcalProperty::setDatetime_(calIcalComponent * parent,
                                       icalproperty * prop,
                                       calIDateTime * dt)
{
    NS_ENSURE_ARG_POINTER(prop);
    NS_ENSURE_ARG_POINTER(dt);

    icaltimetype itt;
    dt->ToIcalTime(&itt);

    if (parent) {
        if (!itt.is_utc) {
            nsCOMPtr<calITimezone> tz;
            nsresult rv = dt->GetTimezone(getter_AddRefs(tz));
            NS_ENSURE_SUCCESS(rv, rv);
            if (itt.zone) {
                rv = parent->getParentVCalendarOrThis()->AddTimezoneReference(tz);
                NS_ENSURE_SUCCESS(rv, rv);
                icalparameter * const param = icalparameter_new_from_value_string(
                    ICAL_TZID_PARAMETER, icaltimezone_get_tzid(const_cast<icaltimezone *>(itt.zone)));
                icalproperty_set_parameter(prop, param);
            } else { // either floating or phantom:
                PRBool b = PR_FALSE;
                if (NS_FAILED(tz->GetIsFloating(&b)) || !b) {
                    // restore the same phantom TZID:
                    nsCAutoString tzid;
                    rv = tz->GetTzid(tzid);
                    NS_ENSURE_SUCCESS(rv, rv);
                    icalparameter * const param = icalparameter_new_from_value_string(ICAL_TZID_PARAMETER,
                                                                                      tzid.get());
                    icalproperty_set_parameter(prop, param);
                }
            }
        }
    } else if (!itt.is_date && !itt.is_utc && itt.zone) {
        // no parent to add the CTIMEZONE to: coerce DATETIMEs to UTC, DATEs to floating
        icaltimezone_convert_time(&itt,
                                  const_cast<icaltimezone *>(itt.zone),
                                  icaltimezone_get_utc_timezone());
        itt.zone = icaltimezone_get_utc_timezone();
        itt.is_utc = 1;
    }

    icalvalue * const val = icalvalue_new_datetime(itt);
    CAL_ENSURE_MEMORY(val);
    icalproperty_set_value(prop, val);
    return NS_OK;
}

#define RO_COMP_DATE_ATTRIBUTE(Attrname, ICALNAME)                      \
NS_IMETHODIMP                                                           \
calIcalComponent::Get##Attrname(calIDateTime **dtp)                     \
{                                                                       \
    return GetDateTimeAttribute(ICAL_##ICALNAME##_PROPERTY, dtp);       \
}

#define COMP_DATE_ATTRIBUTE(Attrname, ICALNAME)                         \
RO_COMP_DATE_ATTRIBUTE(Attrname, ICALNAME)                              \
                                                                        \
NS_IMETHODIMP                                                           \
calIcalComponent::Set##Attrname(calIDateTime *dt)                       \
{                                                                       \
    return SetDateTimeAttribute(ICAL_##ICALNAME##_PROPERTY, dt);        \
}

#define RO_COMP_DURATION_ATTRIBUTE(Attrname, ICALNAME)                  \
NS_IMETHODIMP                                                           \
calIcalComponent::Get##Attrname(calIDuration **dtp)                     \
{                                                                       \
    icalproperty *prop =                                                \
        icalcomponent_get_first_property(mComponent,                    \
                                         ICAL_##ICALNAME##_PROPERTY);   \
    if (!prop) {                                                        \
        *dtp = nsnull;  /* invalid duration */                          \
        return NS_OK;                                                   \
    }                                                                   \
    struct icaldurationtype idt =                                       \
        icalvalue_get_duration(icalproperty_get_value(prop));           \
    *dtp = new calDuration(&idt);                                       \
    CAL_ENSURE_MEMORY(*dtp);                                            \
    NS_ADDREF(*dtp);                                                    \
    return NS_OK;                                                       \
}

NS_IMPL_ISUPPORTS1(calIcalComponent, calIIcalComponent)

NS_IMETHODIMP_(icalcomponent *)
calIcalComponent::GetIcalComponent()
{
    return mComponent;
}

NS_IMETHODIMP_(icaltimezone *)
calIcalComponent::GetIcalTimezone()
{
    NS_ASSERTION(icalcomponent_isa(mComponent) == ICAL_VTIMEZONE_COMPONENT, "no VTIMEZONE -- unexpected!");
    if (!mTimezone && (icalcomponent_isa(mComponent) == ICAL_VTIMEZONE_COMPONENT)) {
        // xxx todo: libical needs a parent VCALENDAR to retrieve a icaltimezone
        NS_ASSERTION(mParent, "VTIMEZONE has no parent!");
        if (mParent) {
            icalproperty * const tzidProp = icalcomponent_get_first_property(mComponent, ICAL_TZID_PROPERTY);
            NS_ASSERTION(tzidProp, "no TZID property in VTIMEZONE!?");
            if (tzidProp) {
                mTimezone = icalcomponent_get_timezone(mParent->GetIcalComponent(),
                                                       icalvalue_get_string(icalproperty_get_value(tzidProp)));
            }
        }
    }
    return mTimezone;
}

NS_IMETHODIMP
calIcalComponent::GetFirstSubcomponent(const nsACString& kind,
                                       calIIcalComponent **subcomp)
{
    NS_ENSURE_ARG_POINTER(subcomp);

    icalcomponent_kind compkind =
        icalcomponent_string_to_kind(PromiseFlatCString(kind).get());

    // Maybe someday I'll support X-COMPONENTs
    if (compkind == ICAL_NO_COMPONENT || compkind == ICAL_X_COMPONENT)
        return NS_ERROR_INVALID_ARG;

    icalcomponent *ical =
        icalcomponent_get_first_component(mComponent, compkind);
    if (!ical) {
        *subcomp = nsnull;
        return NS_OK;
    }

    *subcomp = new calIcalComponent(ical, this);
    CAL_ENSURE_MEMORY(*subcomp);
    NS_ADDREF(*subcomp);
    return NS_OK;
}

NS_IMETHODIMP
calIcalComponent::GetNextSubcomponent(const nsACString& kind,
                                      calIIcalComponent **subcomp)
{
    NS_ENSURE_ARG_POINTER(subcomp);

    icalcomponent_kind compkind =
        icalcomponent_string_to_kind(PromiseFlatCString(kind).get());

    // Maybe someday I'll support X-COMPONENTs
    if (compkind == ICAL_NO_COMPONENT || compkind == ICAL_X_COMPONENT)
        return NS_ERROR_INVALID_ARG;

    icalcomponent *ical =
        icalcomponent_get_next_component(mComponent, compkind);
    if (!ical) {
        *subcomp = nsnull;
        return NS_OK;
    }

    *subcomp = new calIcalComponent(ical, this);
    CAL_ENSURE_MEMORY(*subcomp);
    NS_ADDREF(*subcomp);
    return NS_OK;
}

NS_IMETHODIMP
calIcalComponent::GetComponentType(nsACString &componentType)
{
    componentType.Assign(icalcomponent_kind_to_string(icalcomponent_isa(mComponent)));
    return NS_OK;
}


COMP_STRING_ATTRIBUTE(Uid, UID, uid)
COMP_STRING_ATTRIBUTE(Prodid, PRODID, prodid)
COMP_STRING_ATTRIBUTE(Version, VERSION, version)
COMP_STRING_TO_ENUM_ATTRIBUTE(Method, METHOD, method)
COMP_STRING_TO_ENUM_ATTRIBUTE(Status, STATUS, status)
COMP_STRING_TO_GENERAL_ENUM_ATTRIBUTE(Transp, TRANSP, transp)
COMP_STRING_ATTRIBUTE(Summary, SUMMARY, summary)
COMP_STRING_ATTRIBUTE(Description, DESCRIPTION, description)
COMP_STRING_ATTRIBUTE(Location, LOCATION, location)
COMP_STRING_ATTRIBUTE(Categories, CATEGORIES, categories)
COMP_STRING_ATTRIBUTE(URL, URL, url)
COMP_INT_ATTRIBUTE(Priority, PRIORITY, priority)
COMP_STRING_TO_GENERAL_ENUM_ATTRIBUTE(IcalClass, CLASS, class)
RO_COMP_DURATION_ATTRIBUTE(Duration, DURATION)
COMP_DATE_ATTRIBUTE(StartTime, DTSTART)
COMP_DATE_ATTRIBUTE(EndTime, DTEND)
COMP_DATE_ATTRIBUTE(DueTime, DUE)
COMP_DATE_ATTRIBUTE(StampTime, DTSTAMP)
COMP_DATE_ATTRIBUTE(LastModified, LASTMODIFIED)
COMP_DATE_ATTRIBUTE(CreatedTime, CREATED)
COMP_DATE_ATTRIBUTE(CompletedTime, COMPLETED)
COMP_DATE_ATTRIBUTE(RecurrenceId, RECURRENCEID)

void calIcalComponent::ClearAllProperties(icalproperty_kind kind)
{
    for (icalproperty *prop = icalcomponent_get_first_property(mComponent, kind), *next;
         prop; prop = next)
    {
        next = icalcomponent_get_next_property(mComponent, kind);
        icalcomponent_remove_property(mComponent, prop);
        icalproperty_free(prop);
    }
}

static PLDHashOperator
AddTimezoneComponentToIcal(nsACString const& /*tzid*/, calITimezone * tz, void * arg)
{
    icalcomponent * const comp = static_cast<icalcomponent *>(arg);
    icaltimezone * icaltz = cal::getIcalTimezone(tz);
    if (icaltz) {
        icalcomponent * const tzcomp = icalcomponent_new_clone(icaltimezone_get_component(icaltz));
        icalcomponent_add_component(comp, tzcomp);
    }
    return PL_DHASH_NEXT;
}

NS_IMETHODIMP
calIcalComponent::SerializeToICS(nsACString &serialized)
{
    char *icalstr;

    nsresult rv = Serialize(&icalstr);
    if (NS_FAILED(rv)) {
        return rv;
    }

    serialized.Assign(icalstr);
    return NS_OK;
}

NS_IMETHODIMP
calIcalComponent::ToString(nsACString& aResult)
{
    return SerializeToICS(aResult);
}

NS_IMETHODIMP
calIcalComponent::SerializeToICSStream(nsIInputStream **aStreamResult)
{
    NS_ENSURE_ARG_POINTER(aStreamResult);

    char *icalstr;
    nsresult rv = Serialize(&icalstr);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIStringInputStream> const aStringStream(
        do_CreateInstance(NS_STRINGINPUTSTREAM_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    // copies the string into the input stream that's handed back.
    // This copy is necessary because we don't really own icalstr;
    // it's one of libical's ring buffers
    rv = aStringStream->SetData(icalstr, -1);
    NS_ENSURE_SUCCESS(rv, rv);
    NS_ADDREF(*aStreamResult = aStringStream);
    return rv;
}

nsresult
calIcalComponent::Serialize(char **icalstr)
{
    NS_ENSURE_ARG_POINTER(icalstr);

    // add the timezone bits
    if (icalcomponent_isa(mComponent) == ICAL_VCALENDAR_COMPONENT && mReferencedTimezones.Count() > 0) {
        mReferencedTimezones.EnumerateRead(AddTimezoneComponentToIcal, mComponent);
    }

    *icalstr = icalcomponent_as_ical_string(mComponent);
    if (!*icalstr) {
        // xxx todo: what about NS_ERROR_OUT_OF_MEMORY?
#ifdef DEBUG
        fprintf(stderr, "Error serializing: %d (%s)\n",
                icalerrno, icalerror_strerror(icalerrno));
#endif
        // The return values in calIError match with libical errnos,
        // so no need for a conversion table or anything.
        return calIErrors::ICS_ERROR_BASE + icalerrno;
    }

    return NS_OK;
}

NS_IMETHODIMP
calIcalComponent::Clone(calIIcalComponent **_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);
    icalcomponent * cloned = icalcomponent_new_clone(mComponent);
    if (cloned == nsnull)
        return NS_ERROR_OUT_OF_MEMORY;
    calIcalComponent * const comp = new calIcalComponent(cloned, nsnull, getTzProvider());
    if (comp == nsnull) {
        icalcomponent_free(cloned);
        return NS_ERROR_OUT_OF_MEMORY;
    }
    NS_ADDREF(*_retval = comp);
    return NS_OK;
}

NS_IMETHODIMP
calIcalComponent::AddSubcomponent(calIIcalComponent *comp)
{
    NS_ENSURE_ARG_POINTER(comp);

    /* XXX mildly unsafe assumption here.
     * To fix it, I will:
     * - check the object's classinfo to find out if I have one of my
     *   own objects, and if not
     * - use comp->serializeToICS and reparse to create a copy.
     *
     * I should probably also return the new/reused component so that the
     * caller has something it can poke at all live-like.
     */
    calIcalComponent * const ical = toIcalComponent(comp);

    PRUint32 tzCount = 0;
    calITimezone ** timezones = nsnull;
    nsresult rv = ical->GetReferencedTimezones(&tzCount, &timezones);
    NS_ENSURE_SUCCESS(rv, rv);

    calIcalComponent * const vcal = getParentVCalendarOrThis();
    PRBool failed = PR_FALSE;
    for (PRUint32 i = 0; i < tzCount; i++) {
        if (!failed) {
            rv = vcal->AddTimezoneReference(timezones[i]);
            if (NS_FAILED(rv))
                failed = PR_TRUE;
        }

        NS_RELEASE(timezones[i]);
    }

    nsMemory::Free(timezones);

    if (failed)
        return rv;

    if (ical->mParent) {
        ical->mComponent = icalcomponent_new_clone(ical->mComponent);
    }
    ical->mParent = this;
    icalcomponent_add_component(mComponent, ical->mComponent);
    return NS_OK;
}

// NS_IMETHODIMP
// IcalComponent::RemoveSubcomponent(calIIcalComponent *comp)
// {
//     NS_ENSURE_ARG_POINTER(comp);
//     calIcalComponent *ical = static_cast<calIcalComponent *>(comp);
//     icalcomponent_remove_component(mComponent, ical->mComponent);
//     ical->mParent = nsnull;
//     return NS_OK;
// }

NS_IMETHODIMP
calIcalComponent::GetFirstProperty(const nsACString &kind,
                                   calIIcalProperty **prop)
{
    NS_ENSURE_ARG_POINTER(prop);

    icalproperty_kind propkind =
        icalproperty_string_to_kind(PromiseFlatCString(kind).get());

    if (propkind == ICAL_NO_PROPERTY)
        return NS_ERROR_INVALID_ARG;

    icalproperty *icalprop = nsnull;
    if (propkind == ICAL_X_PROPERTY) {
        for (icalprop = 
                 icalcomponent_get_first_property(mComponent, ICAL_X_PROPERTY);
             icalprop;
             icalprop = icalcomponent_get_next_property(mComponent,
                                                        ICAL_X_PROPERTY)) {
            
            if (kind.Equals(icalproperty_get_x_name(icalprop)))
                break;
        }
    } else {
        icalprop = icalcomponent_get_first_property(mComponent, propkind);
    }

    if (!icalprop) {
        *prop = nsnull;
        return NS_OK;
    }

    *prop = new calIcalProperty(icalprop, this);
    CAL_ENSURE_MEMORY(*prop);
    NS_ADDREF(*prop);
    return NS_OK;
}

NS_IMETHODIMP
calIcalComponent::GetNextProperty(const nsACString &kind, calIIcalProperty **prop)
{
    NS_ENSURE_ARG_POINTER(prop);

    icalproperty_kind propkind =
        icalproperty_string_to_kind(PromiseFlatCString(kind).get());

    if (propkind == ICAL_NO_PROPERTY)
        return NS_ERROR_INVALID_ARG;
    icalproperty *icalprop = nsnull;
    if (propkind == ICAL_X_PROPERTY) {
        for (icalprop = 
                 icalcomponent_get_next_property(mComponent, ICAL_X_PROPERTY);
             icalprop;
             icalprop = icalcomponent_get_next_property(mComponent,
                                                        ICAL_X_PROPERTY)) {
            
            if (kind.Equals(icalproperty_get_x_name(icalprop)))
                break;
        }
    } else {
        icalprop = icalcomponent_get_next_property(mComponent, propkind);
    }

    if (!icalprop) {
        *prop = nsnull;
        return NS_OK;
    }

    *prop = new calIcalProperty(icalprop, this);
    CAL_ENSURE_MEMORY(*prop);
    NS_ADDREF(*prop);
    return NS_OK;
}

NS_IMETHODIMP
calIcalComponent::AddProperty(calIIcalProperty * prop)
{
    NS_ENSURE_ARG_POINTER(prop);
    // We assume a calIcalProperty is passed in (else the cast wouldn't run and
    // we are about to crash), so we assume that this ICS service code has created
    // the property.
    calIcalProperty * const ical = toIcalProperty(prop);
    if (ical->mParent) {
        ical->mProperty = icalproperty_new_clone(ical->mProperty);
    }
    ical->mParent = this;
    icalcomponent_add_property(mComponent, ical->mProperty);

    nsCOMPtr<calIDateTime> dt;
    if (NS_SUCCEEDED(prop->GetValueAsDatetime(getter_AddRefs(dt))) && dt) {
        // make sure timezone definition will be included:
        nsCOMPtr<calITimezone> tz;
        if (NS_SUCCEEDED(dt->GetTimezone(getter_AddRefs(tz))) && tz) {
            getParentVCalendarOrThis()->AddTimezoneReference(tz);
        }
    }
    return NS_OK;
}

// If you add then remove a property/component, the referenced
// timezones won't get purged out. There's currently no client code.

// NS_IMETHODIMP
// calIcalComponent::RemoveProperty(calIIcalProperty *prop)
// {
//     NS_ENSURE_ARG_POINTER(prop);
//     // XXX like AddSubcomponent, this is questionable
//     calIcalProperty *ical = static_cast<calIcalProperty *>(prop);
//     icalcomponent_remove_property(mComponent, ical->mProperty);
//     ical->mParent = nsnull;
//     return NS_OK;
// }

NS_IMPL_ISUPPORTS1_CI(calICSService, calIICSService)

calICSService::calICSService()
{
}

NS_IMETHODIMP
calICSService::ParseICS(const nsACString& serialized,
                        calITimezoneProvider *tzProvider,
                        calIIcalComponent **component)
{
    NS_ENSURE_ARG_POINTER(component);
    icalcomponent *ical =
        icalparser_parse_string(PromiseFlatCString(serialized).get());
    if (!ical) {
#ifdef DEBUG
        fprintf(stderr, "Error parsing: '%20s': %d (%s)\n",
                PromiseFlatCString(serialized).get(), icalerrno,
                icalerror_strerror(icalerrno));
#endif
        // The return values is calIError match with ical errors,
        // so no need for a conversion table or anything.
        return calIErrors::ICS_ERROR_BASE + icalerrno;
    }
    calIcalComponent *comp = new calIcalComponent(ical, nsnull, tzProvider);
    if (!comp) {
        icalcomponent_free(ical);
        return NS_ERROR_OUT_OF_MEMORY;
    }
    NS_ADDREF(*component = comp);
    return NS_OK;
}

NS_IMETHODIMP
calICSService::CreateIcalComponent(const nsACString &kind, calIIcalComponent **comp)
{
    NS_ENSURE_ARG_POINTER(comp);
    icalcomponent_kind compkind = 
        icalcomponent_string_to_kind(PromiseFlatCString(kind).get());

    // Maybe someday I'll support X-COMPONENTs
    if (compkind == ICAL_NO_COMPONENT || compkind == ICAL_X_COMPONENT)
        return NS_ERROR_INVALID_ARG;

    icalcomponent *ical = icalcomponent_new(compkind);
    if (!ical)
        return NS_ERROR_OUT_OF_MEMORY; // XXX translate

    *comp = new calIcalComponent(ical, nsnull);
    if (!*comp) {
        icalcomponent_free(ical);
        return NS_ERROR_OUT_OF_MEMORY;
    }

    NS_ADDREF(*comp);
    return NS_OK;
}

NS_IMETHODIMP
calICSService::CreateIcalProperty(const nsACString &kind, calIIcalProperty **prop)
{
    NS_ENSURE_ARG_POINTER(prop);
    icalproperty_kind propkind = 
        icalproperty_string_to_kind(PromiseFlatCString(kind).get());

    if (propkind == ICAL_NO_PROPERTY)
        return NS_ERROR_INVALID_ARG;

    icalproperty *icalprop = icalproperty_new(propkind);
    if (!icalprop)
        return NS_ERROR_OUT_OF_MEMORY; // XXX translate

    if (propkind == ICAL_X_PROPERTY)
        icalproperty_set_x_name(icalprop, PromiseFlatCString(kind).get());

    *prop = new calIcalProperty(icalprop, nsnull);
    CAL_ENSURE_MEMORY(*prop);
    NS_ADDREF(*prop);
    return NS_OK;
}
