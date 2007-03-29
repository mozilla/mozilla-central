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
package netscape.ldap.util;

import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 *  Represents an Internal LDAPFilterList object.  This is an internal object
 *  that  should never be instantiated directly by the developer.  We
 *  store all filters that have the same match pattern here.
 */

public class LDAPIntFilterList {
    private Vector m_vFilter;
    private String m_strMatchPattern;
        // a regexp pattern of m_strMatchPattern
    private Pattern m_patMatch = null;

    LDAPIntFilterList ( LDAPFilter filter ) throws
            BadFilterException {
        m_strMatchPattern = filter.getMatchPattern();

        try {
            m_patMatch = Pattern.compile( m_strMatchPattern );
        } catch ( PatternSyntaxException e ) {

            throw new BadFilterException (
            "The Regular Expression for this filter is bad. " +
            "Line number: " + filter.getLineNumber() );
        }

        m_vFilter = new Vector();
        m_vFilter.addElement ( filter );
    }

    /**
     * Add a "relative" filter to an existing filter list.  We do this
     * becuse the ldapfilter file defines that we can have multiple
     * filters per match pattern (and delimiter).  This method is
     * called by the parent LDAPIntFilterSet because the file specified
     * a "relative" filter (a filter in the ldapfilter.conf file that
     * only has 2 or 3 tokens).
     */
    void AddFilter ( LDAPFilter filter ) {
        m_vFilter.addElement ( filter );
    }


    /**
     * Return the number of Filters this InternalFilterList contains.
     */
    // Since we're storing the filters as a vector, just return
    // Vector.size().
    int numFilters () {
        return m_vFilter.size();
    }


    public String toString() {
        StringBuffer strBuf = new StringBuffer ( 100 );
        strBuf.append ( "    Match Pattern: \"" + m_strMatchPattern + "\"\n" );

        for ( int i = 0; i < m_vFilter.size(); i++ ) {
            strBuf.append ( ((LDAPFilter)m_vFilter.elementAt(i)).toString() );
            strBuf.append ( "\n" );
        }
        return strBuf.toString();
    }

    /**
     * Return the requested filter.
     */
    LDAPFilter getFilter ( int nFilter ) {
        return (LDAPFilter)m_vFilter.elementAt ( nFilter );
    }

    /**
     * Try to match the filter to the given string.  This method is called
     * when the user types in data.  We match the expression (stored in
     * m_strMatchPattern) to the value that the user typed in (the
     * parameter to this method).
     */
    boolean MatchFilter ( String matcherValue ) {
    	return m_patMatch.matcher(matcherValue).matches();
    }
}


