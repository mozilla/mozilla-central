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
import netscape.ldap.controls.*;
import com.netscape.jndi.ldap.common.DirContextAdapter;

import java.util.*;

public class SchemaDirContext extends DirContextAdapter {

    public static final String CLASSDEF = "ClassDefinition";
    public static final String ATTRDEF = "AttributeDefinition";
    public static final String MRULEDEF = "MatchingRule";
    

    String m_path;

    public void close() throws NamingException {
        ; //NOP
    }

    /**
     * Name operations
     */

    public String composeName(String name, String prefix) throws NamingException {
        return name + "," + prefix;
    }

    public Name composeName(Name name, Name prefix) throws NamingException {
        String compoundName = composeName(name.toString(), prefix.toString());
        return SchemaNameParser.getParser().parse(compoundName);
    }

    public String getNameInNamespace() throws NamingException {
        return new String(m_path);
    }

    public NameParser getNameParser(String name) throws NamingException {
        return SchemaNameParser.getParser();
    }

    public NameParser getNameParser(Name name) throws NamingException {
        return SchemaNameParser.getParser();
    }

     
    /**
     * Naming Bind operations
     */

    public void bind(String name, Object obj) throws NamingException {
        if (obj instanceof DirContext) {
            createSubcontext(name, ((DirContext)obj).getAttributes(""));
        }
        else {
            throw new IllegalArgumentException("Can not bind this type of object");
        }    
    }

    public void bind(Name name, Object obj) throws NamingException {
        bind(name.toString(), obj);
    }

    public void rebind(String name, Object obj) throws NamingException {
        try {
            bind(name, obj);
        }
        catch (NameAlreadyBoundException ex) {
            unbind(name);
            bind(name, obj);
        }
    }

    public void rebind(Name name, Object obj) throws NamingException {
        rebind(name.toString(), obj);
    }

    public void rename(String oldName, String newName) throws NamingException {
        throw new OperationNotSupportedException();
    }

    public void rename(Name oldName, Name newName) throws NamingException {
        rename(oldName.toString(), newName.toString());
    }

    public void unbind(String name) throws NamingException {
        // In ldap every entry is naming context
        destroySubcontext(name);
    }

    public void unbind(Name name) throws NamingException {
        // In ldap every entry is naming context
        destroySubcontext(name);
    }

    /**
     * Empty enumeration for list operations
     */
    class EmptyNamingEnumeration implements NamingEnumeration {

        public Object next() throws NamingException{
            throw new NoSuchElementException("EmptyNamingEnumeration");                
        }

        public Object nextElement() {
            throw new NoSuchElementException("EmptyNamingEnumeration");                
        }

        public boolean hasMore() throws NamingException{
            return false;
        }

        public boolean hasMoreElements() {
            return false;
        }

        public void close() {}
    }
    
    static class SchemaObjectSubordinateNamePair {
        SchemaDirContext schemaObj;
        String subordinateName;
        
        public SchemaObjectSubordinateNamePair(SchemaDirContext object, String subordinateName) {
            this.schemaObj = object;
            this.subordinateName = subordinateName;
        }
        
        public String toString() {
            StringBuffer str = new StringBuffer("SchemaObjectSubordinateNamePair{obj:");
            str.append(((schemaObj == null) ? "null" : schemaObj.toString()));
            str.append(" name:");
            str.append(subordinateName);
            str.append("}");
            return str.toString();
        }
    }    
}
