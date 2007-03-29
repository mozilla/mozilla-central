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
 * Portions created by the Initial Developer are Copyright (C) 2000
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
package netscape.ldap;

import java.util.*;

/**
 * The definition of a syntax type in the schema.
 * <A HREF="http://www.ietf.org/rfc/rfc2252.txt"
 * TARGET="_blank">RFC 2252, Lightweight Directory Access Protocol (v3):
 * LDAP Subschema Attribute</A> covers the types of information
 * to specify when defining a syntax.
 * The description of a syntax can include the following:
 * <P>
 *
 * <UL>
 * <LI>an OID identifying the syntax
 * <LI>a description of the attribute type
 * </UL>
 * <P>
 *
 * When you construct an <CODE>LDAPSyntaxSchema</CODE> object, you can
 * specify these types of information as arguments to the constructor or
 * in the ldapSyntaxes format specified in RFC 2252.
 * When an LDAP client searches an LDAP server for the schema, the server
 * returns schema information as an object with attribute values in this
 * format.
 * <P>
 * RFC 2252 defines SyntaxDescription as follows:
 * <P>
 * <PRE>
 *     SyntaxDescription = "(" whsp
 *        numericoid whsp
 *        [ "DESC" qdstring ]
 *        whsp ")"
 * </PRE>
 *<P>
 * Syntax definitions do not have a name, so the <CODE>getName</CODE>
 * method inherited from <CODE>LDAPSchemaElement</CODE> returns "".
 * To get the OID and description of this syntax type
 * definition, use the <CODE>getOID</CODE> and
 * <CODE>getDescription</CODE> methods inherited from the abstract class
 * <CODE>LDAPSchemaElement</CODE>.
 * <P>
 *
 * To add or remove this syntax type definition from the
 * schema, use the <CODE>add</CODE> and <CODE>remove</CODE>
 * methods, which this class inherits from the <CODE>LDAPSchemaElement</CODE>
 * abstract class.
 *
 * @version 1.0
 * @see netscape.ldap.LDAPSchemaElement
 **/

public class LDAPSyntaxSchema extends LDAPSchemaElement {

    static final long serialVersionUID = 3590667117475688132L;

    /**
     * Constructs a blank element.
     */
    protected LDAPSyntaxSchema() {
        super();
    }

    /**
     * Constructs a syntax type definition, using the specified
     * information.
     * @param oid object identifier (OID) of the syntax type
     * in dotted-string format (for example, "1.2.3.4")
     * @param description description of syntax type
     */
    public LDAPSyntaxSchema( String oid, String description ) {
        super( "", oid, description );
        attrName = "ldapSyntaxes";
        syntaxElement.syntax = syntaxElement.syntaxCheck( oid );
        syntaxElement.syntaxString = oid;
    }

    /**
     * Constructs a syntax type definition based on a description in
     * the ldapSyntaxes format. For information on this format,
     * (see <A HREF="http://www.ietf.org/rfc/rfc2252.txt"
     * TARGET="_blank">RFC 2252, Lightweight Directory Access Protocol (v3):
     * LDAP Subschema Attribute</A>.  This is the format that LDAP servers
     * and clients use to exchange schema information.  (For example, when
     * you search an LDAP server for its schema, the server returns an entry
     * with the syntaxs "objectclasses" and "ldapSyntaxes".  The
     * values of "ldapSyntaxes" are syntax type descriptions
     * in this format.)
     * <P>
     *
     * @param raw definition of the syntax type in the
     * ldapSyntaxes format
     */
    public LDAPSyntaxSchema( String raw ) {
        attrName = "ldapSyntaxes";
        parseValue( raw );
    }

    /**
     * Gets the syntax of the schema element
     * @return one of the following values:
     * <UL>
     * <LI><CODE>cis</CODE> (case-insensitive string)
     * <LI><CODE>ces</CODE> (case-exact string)
     * <LI><CODE>binary</CODE> (binary data)
     * <LI><CODE>int</CODE> (integer)
     * <LI><CODE>telephone</CODE> (telephone number -- identical to cis,
     * but blanks and dashes are ignored during comparisons)
     * <LI><CODE>dn</CODE> (distinguished name)
     * <LI><CODE>unknown</CODE> (not a known syntax)
     * </UL>
     */
    public int getSyntax() {
        return syntaxElement.syntax;
    }

    /**
     * Gets the syntax of the syntax type in dotted-decimal format,
     * for example "1.2.3.4.5"
     * @return The syntax syntax in dotted-decimal format.
     */
    public String getSyntaxString() {
        return syntaxElement.syntaxString;
    }

    /**
     * Prepares a value in RFC 2252 format for submission to a server
     *
     * @return a String ready for submission to an LDAP server.
     */
    public String getValue() {
        String s = getValuePrefix();
        String val = getCustomValues();
        if ( val.length() > 0 ) {
            s += val + ' ';
        }
        s += ')';
        return s;
    }

    /**
     * Gets the definition of the syntax type in a user friendly format.
     * This is the format that the syntax type definition uses when
     * printing the syntax type or the schema.
     * @return definition of the syntax type in a user friendly format.
     */
    public String toString() {
        String s = "OID: " + oid;
        s += "; Description: " + description;
        s += getQualifierString( null );
        return s;
    }

    protected LDAPSyntaxSchemaElement syntaxElement =
        new LDAPSyntaxSchemaElement();
}
