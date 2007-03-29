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
package netscape.ldap.client;

import java.util.*;
import netscape.ldap.ber.stream.*;
import java.io.*;

/**
 * This class implements the filter.
 * <pre>
 *   Filter ::= CHOICE {
 *     and [0] SET OF Filter,
 *     or [1] SET OF Filter,
 *     not [2] Filter,
 *     equalityMatch [3] AttributeValueAssertion,
 *     substrings [4] SubstringFilter,
 *     greaterOrEqual [5] AttributeValueAssertion,
 *     lessOrEqual [6] AttributeValueAssertion,
 *     present [7] AttributeType,
 *     approxMatch [8] AttributeValueAssertion
 *   }
 * </pre>
 *
 * @version 1.0
 */
public abstract class JDAPFilter {
    /**
     * Constructs a empty filter.
     */
    public JDAPFilter() {
    }

    /**
     * Constructs filter from filter string specified in RFC1558.
     * <pre>
     * <filter> ::= '(' <filtercomp> ')'
     * <filtercomp> ::= <and> | <or> | <not> | <item>
     * <and> ::= '&' <filterlist>
     * <or> ::= '|' <filterlist>
     * <not> ::= '!' <filter>
     * <filterlist> ::= <filter> | <filter> <filterlist>
     * <item> ::= <simple> | <present> | <substring>
     * <simple> ::= <attr> <filtertype> <value>
     * <filtertype> ::= <equal> | <approx> | <greater> | <less>
     * <equal> ::= '='
     * <approx> ::= '~='
     * <greater> ::= '>='
     * <less> ::= '<='
     * <present> ::= <attr> '=*'
     * <substring> ::= <attr> '=' <initial> <any> <final>
     * <initial> ::= NULL | <value>
     * <any> ::= '*' <starval>
     * <starval> ::= NULL | <value> '*' <starval>
     * <final> ::= NULL | <value>
     * </pre>
     * @param dn distinguished name of adding entry
     * @param attrs list of attribute associated with entry
     * @return filter
     */
    public static JDAPFilter getFilter(String filter) {
        String f = new String(filter);
        f.trim();
        if (f.startsWith("(") && f.endsWith(")")) {
            return getFilterComp(f.substring(1,f.length()-1));
        }
        return getFilterComp(filter);
    }

    /**
     * Constructs the filter computation.
     * @param f filter string within brackets
     * @return filter
     */
    public static JDAPFilter getFilterComp(String f) {
        f.trim();
        if (f.startsWith("&")) {         /* and */
            JDAPFilter filters[] = getFilterList(f.substring(1, f.length()));
            if (filters == null) {
                throw new IllegalArgumentException("Bad search filter");
            }
            JDAPFilterAnd and = new JDAPFilterAnd();
            for (int i = 0; i < filters.length; i++) {
                and.addElement(filters[i]);
            }
            return and;
        } else if (f.startsWith("|")) {  /* or  */
            JDAPFilter filters[] = getFilterList(f.substring(1, f.length()));
            if (filters == null) {
                throw new IllegalArgumentException("Bad search filter");
            }
            JDAPFilterOr or = new JDAPFilterOr();
            for (int i = 0; i < filters.length; i++) {
                or.addElement(filters[i]);
            }
            return or;
        } else if (f.startsWith("!")) {  /* not */
            JDAPFilter filter = getFilter(f.substring(1, f.length()));
            if (filter == null) {
                throw new IllegalArgumentException("Bad search filter");
            }
            return new JDAPFilterNot(filter);
        } else {                         /* item */
            return getFilterItem(f.substring(0, f.length()));
        }
    }

    /**
     * Parses a list of filters
     * @param list filter list (i.e. (filter)(filter)...)
     * @return list of filters
     */
    public static JDAPFilter[] getFilterList(String list) {
        list.trim();

        int level = 0;
        int start = 0;
        int end = 0;
        Vector v = new Vector();

        for (int i = 0; i < list.length(); i++) {
            if (list.charAt(i) == '(') {
                if (level == 0) {
                    start = i;
                }
                level++;
            }
            if (list.charAt(i) == ')') {
                level--;
                if (level == 0) {
                    end = i;
                    v.addElement(JDAPFilter.getFilter(list.substring(start, end+1)));
                }
            }
        }

        if (v.size() == 0)
            return null;

        JDAPFilter f[] = new JDAPFilter[v.size()];
        for (int i = 0; i < v.size(); i++) {
            f[i] = (JDAPFilter)v.elementAt(i);
        }

        return f;
    }

    /**
     * Gets filter item.
     * @param item filter item string
     * @return filter
     */
    public static JDAPFilter getFilterItem(String item) {
        item.trim();
        int idx = item.indexOf('=');
        if (idx == -1)
            return null;

        String type = item.substring(0, idx).trim();
        String value = item.substring(idx+1).trim(); /* skip = */

        // Only values can contain escape sequences
        if (type.indexOf('\\') >= 0) {
            throw new IllegalArgumentException("Bad search filter");
        }

        /* make decision by looking at the type */
        type.trim();
        if (type.endsWith("~")) {
            JDAPAVA ava = new
              JDAPAVA(type.substring(0, type.length()-1), value);
            return new JDAPFilterApproxMatch(ava);
        } else if (type.endsWith(">")) {
            JDAPAVA ava = new
              JDAPAVA(type.substring(0, type.length()-1), value);
            return new JDAPFilterGreaterOrEqual(ava);
        } else if (type.endsWith("<")) {
            JDAPAVA ava = new
              JDAPAVA(type.substring(0, type.length()-1), value);
            return new JDAPFilterLessOrEqual(ava);
        } else if (type.endsWith(":")) {
            return new JDAPFilterExtensible(type.substring(0, type.length()-1), value);
        }

        /* for those that are not simple */
        if (value.startsWith("*") && value.length() == 1) {
            return new JDAPFilterPresent(type);
        }

        /* if value contains no '*', then it is equality */
        if (value.indexOf('*') == -1) {
            JDAPAVA ava = new JDAPAVA(type, value);
            return new JDAPFilterEqualityMatch(ava);
        }

        /* must be substring at this point */
        StringTokenizer st = new StringTokenizer(value, "*");
        JDAPFilterSubString sub = new JDAPFilterSubString(type);

        String initial = null;
        if (!value.startsWith("*")) {
            initial = st.nextToken();
            initial.trim();
        }
        sub.addInitial(initial);

        while (st.hasMoreTokens()) {
            String any = st.nextToken();
            any.trim();
            if (st.hasMoreTokens()) {
                sub.addAny(any);
            } else {
                if (value.endsWith("*")) {
                    sub.addAny(any);
                    sub.addFinal(null);
                } else {
                    sub.addFinal(any);
                }
            }
        }

        return sub;
    }

    /**
     * Gets the ber representation of filter.
     * @return ber representation of filter
     */
    public abstract BERElement getBERElement();

    /**
     * Retrieves the string representation of filter.
     * @return string representation of filter
     */
    public abstract String toString();
}
