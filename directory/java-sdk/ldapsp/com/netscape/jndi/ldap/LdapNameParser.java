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
package com.netscape.jndi.ldap;

import java.util.Hashtable;
import java.util.Properties;
import javax.naming.*;

class LdapNameParser implements NameParser {

    private static LdapNameParser m_parser;
    
    // A table with compound name syntax properties
    static Properties nameSyntax;
    static {
        nameSyntax = new Properties();
        nameSyntax.put("jndi.syntax.direction", "right_to_left");
        nameSyntax.put("jndi.syntax.separator", ",");
        nameSyntax.put("jndi.syntax.ignorecase", "true");
        nameSyntax.put("jndi.syntax.escape", "\\");
        nameSyntax.put("jndi.syntax.beginquote", "\"");
        nameSyntax.put("jndi.syntax.trimblanks", "true");        
        nameSyntax.put("jndi.syntax.separator.ava", "+");
        nameSyntax.put("jndi.syntax.separator.typeval", "=");
    }

    // Can not be constructed
    private LdapNameParser() {}
    
    // Shared instance must be used
    public static LdapNameParser getParser() {
        if (m_parser == null) {
            m_parser = new LdapNameParser();
        }
        return m_parser;
    }
    
    // implements parse
    public Name parse(String name) throws NamingException {
        return new CompoundName(name, nameSyntax);
    }
    
    /**
     * A convenience method for extracting RDN
     * @return RDN for the DN
     * @param dn Ldap Distinguished name
     * @throw NamingException Name parsing failed
     */
    static String getRDN(String dn) throws NamingException {
        Name parsedName = getParser().parse(dn);
        if (parsedName.size() > 0) {
            return parsedName.get(parsedName.size()-1);
        }
        return "";
    }

    /**
     * A convenience method for extracting attribute name from name=val
     * @return attribute name or null if "=" not found
     * @param nameEqVal name=value
     */
    static String getAttrName(String nameEqVal) throws NamingException {
        int eq = nameEqVal.indexOf("=");
        return (eq >= 0) ? nameEqVal.substring(0,eq).trim() : null;
    }

    /**
     * A convenience method for extracting attribute value from name=val
     * @return attribute value or null if "=" not found
     * @param nameEqVal name=value
     */
    static String getAttrValue(String nameEqVal) throws NamingException {
        int eq = nameEqVal.indexOf("=");
        return (eq >= 0) ? nameEqVal.substring(eq+1).trim() : null;
    }

    /**
     * A convenience method for extracting relative name from the ancestor context
     * @return name relative to an ancestor context
     * @param ctx ancestor context distinguished name
     * @param entry distinguished name
     */
    static String getRelativeName(String ctx, String entry) throws NamingException{
        if (entry==null) {
            entry = "";
        }
        Name contextName = getParser().parse(ctx);
        Name entryName = getParser().parse(entry);
        if (!entryName.startsWith(contextName)) {
            throw new NamingException("Name not in context");
        }
        return entryName.getSuffix(contextName.size()).toString();
    }    

    /**
     * A convenience method for extracting relative name from the ancestor context
     * @return name relative to an ancestor context
     * @param ctx ancestor context distinguished name
     * @param entry distinguished name
     */
    static String getRelativeName(Name contextName, String entry) throws NamingException{
        if (entry==null) {
            entry = "";
        }    
        Name entryName = getParser().parse(entry);
        if (!entryName.startsWith(contextName)) {
            throw new NamingException("Name not in context");
        }
        return entryName.getSuffix(contextName.size()).toString();
    }

    /**
     * Unit test
     */
    public static void main0(String[] args) {
        if (args.length != 1) {
            System.out.println("Usage LdapNameParser <name>");
            System.exit(1);
        }
        try {
            Name name = getParser().parse(args[0]);
            System.out.println(name);
            System.out.println("rdn: " + getParser().getRDN(args[0]));
            name.add("attr=val");
            System.out.println(name);
            System.out.println(name.get(0));
            System.out.println("in name=val name:<" + getAttrName("name=val ") + 
                                "> val:<" + getAttrValue("name=val ") + ">");
        }
        catch (Exception e) {
            System.err.println(e);
        }    
    }    

    // Relative name test
    public static void main(String[] args) {
        if (args.length != 2) {
            System.out.println("Usage LdapNameParser <ctxname> <entryname>");
            System.exit(1);
        }
        try {
            System.out.println("relativeName: " + getParser().getRelativeName(args[0], args[1]));
        }
        catch (Exception e) {
            System.err.println(e);
        }    
    }    

}
