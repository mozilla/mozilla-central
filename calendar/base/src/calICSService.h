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
 *   Mike Shaver <mike.x.shaver@oracle.com>
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
#if !defined(INCLUDED_CALICSSERVICE_H)
#define INCLUDED_CALICSSERVICE_H

#include "nsCOMPtr.h"
#include "calIICSService.h"
#include "calITimezoneProvider.h"
#include "nsInterfaceHashtable.h"
#include "calUtils.h"

extern "C" {
#include "ical.h"
}

class calICSService : public calIICSService,
                      public cal::XpcomBase
{
public:
    calICSService();

    NS_DECL_ISUPPORTS
    NS_DECL_CALIICSSERVICE
};

class calIcalComponent;

class calIcalProperty : public calIIcalProperty,
                        public cal::XpcomBase
{
    friend class calIcalComponent;
public:
    calIcalProperty(icalproperty * prop, calIIcalComponent * parent)
        : mProperty(prop), mParent(parent) {}

    NS_DECL_ISUPPORTS
    NS_DECL_CALIICALPROPERTY

protected:
    virtual ~calIcalProperty();

    static nsresult getDatetime_(calIcalComponent *parent,
                                 icalproperty *prop,
                                 calIDateTime **dtp);
    static nsresult setDatetime_(calIcalComponent *parent,
                                 icalproperty *prop,
                                 calIDateTime *dt);

    icalproperty *              mProperty;
    nsCOMPtr<calIIcalComponent> mParent;
};

class calIcalComponent : public calIIcalComponent,
                         public cal::XpcomBase
{
    friend class calIcalProperty;
public:
    calIcalComponent(icalcomponent *ical, calIIcalComponent *parent,
                     calITimezoneProvider *tzProvider = nsnull)
        : mComponent(ical), mTimezone(nsnull), mTzProvider(tzProvider), mParent(parent)
    {
        mReferencedTimezones.Init();
    }

    // VTIMEZONE ctor
    calIcalComponent(icaltimezone * icaltz, icalcomponent * ical) : mComponent(ical), mTimezone(icaltz) {
        mReferencedTimezones.Init();
    }
    
    NS_DECL_ISUPPORTS
    NS_DECL_CALIICALCOMPONENT

protected:
    virtual ~calIcalComponent();

    calITimezoneProvider * getTzProvider() const {
        // walk up the parents to find a tz provider:
        calIcalComponent const * that = this;
        while (that) {
            calITimezoneProvider * const ret = that->mTzProvider;
            if (ret) {
                return ret;
            }
            calIIcalComponent * const p = that->mParent;
            that = static_cast<calIcalComponent const *>(p);
        }
        return nsnull;
    }

    calIcalComponent * getParentVCalendarOrThis() {
        // walk up the parents to find a VCALENDAR:
        calIcalComponent * that = this;
        while (that && icalcomponent_isa(that->mComponent) != ICAL_VCALENDAR_COMPONENT) {
            calIIcalComponent * const p = that->mParent;
            that = static_cast<calIcalComponent *>(p);
        }
        if (!that)
            that = this;
        return that;
    }

    nsresult GetDateTimeAttribute(icalproperty_kind kind, calIDateTime ** dtp);
    nsresult SetDateTimeAttribute(icalproperty_kind kind, calIDateTime * dt);

    nsresult SetPropertyValue(icalproperty_kind kind, icalvalue *val);
    nsresult SetProperty(icalproperty_kind kind, icalproperty *prop);

    nsresult GetStringProperty(icalproperty_kind kind, nsACString &str);
    nsresult SetStringProperty(icalproperty_kind kind, const nsACString &str);

    nsresult GetIntProperty(icalproperty_kind kind, PRInt32 *valp);
    nsresult SetIntProperty(icalproperty_kind kind, PRInt32 i);

    void ClearAllProperties(icalproperty_kind kind);

    nsresult Serialize(char ** icalstr);

    nsInterfaceHashtable<nsCStringHashKey, calITimezone> mReferencedTimezones;
    icalcomponent *                                      mComponent;
    icaltimezone *                                       mTimezone; // set iff VTIMEZONE
    nsCOMPtr<calITimezoneProvider> const                 mTzProvider;
    nsCOMPtr<calIIcalComponent>                          mParent;
};

inline calIcalProperty * toIcalProperty(calIIcalProperty * p) {
    return static_cast<calIcalProperty *>(p);
}
inline calIcalComponent * toIcalComponent(calIIcalComponent * p) {
    return static_cast<calIcalComponent *>(p);
}

#endif // INCLUDED_CALICSSERVICE_H
