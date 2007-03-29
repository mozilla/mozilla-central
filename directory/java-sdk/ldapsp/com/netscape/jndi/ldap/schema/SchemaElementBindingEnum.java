/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
package com.netscape.jndi.ldap.schema;

import javax.naming.*;
import javax.naming.directory.*;
import javax.naming.ldap.*;

import netscape.ldap.*;

import java.util.*;

class SchemaElementBindingEnum implements NamingEnumeration {

    /**
     * Enumeration of schema name-object bindings packaged into Binding object.
     */
    Enumeration m_schemaElementEnum;
    
    SchemaManager m_schemaMgr;

    static final String _className = "javax.naming.directory.DirContext"; // for class name is bindings

    public SchemaElementBindingEnum(Enumeration schemaElementEnum, SchemaManager schemaMgr) {
        m_schemaElementEnum = schemaElementEnum;
        m_schemaMgr = schemaMgr;
    }

    public Object next() throws NamingException{
        return nextElement();
    }

    public Object nextElement() {
        DirContext obj = null;
        LDAPSchemaElement schemaElement = (LDAPSchemaElement) m_schemaElementEnum.nextElement();
        if (schemaElement instanceof LDAPObjectClassSchema) {
            obj = new SchemaObjectClass((LDAPObjectClassSchema) schemaElement, m_schemaMgr);
        }
        else if (schemaElement instanceof LDAPAttributeSchema) {
            obj = new SchemaAttribute((LDAPAttributeSchema) schemaElement, m_schemaMgr);
        }
        else if (schemaElement instanceof LDAPMatchingRuleSchema) {
            obj = new SchemaMatchingRule((LDAPMatchingRuleSchema) schemaElement, m_schemaMgr);
        }
        return new Binding(schemaElement.getName(), _className, obj, /*isRelative=*/true);
    }

    public boolean hasMore() throws NamingException{
        return m_schemaElementEnum.hasMoreElements();
    }

    public boolean hasMoreElements() {
        return m_schemaElementEnum.hasMoreElements();
    }

    public void close() {}
}

