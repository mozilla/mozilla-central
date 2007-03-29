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
 * Portions created by the Initial Developer are Copyright (C) 2001
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
package org.ietf.ldap.controls;

import java.io.*;
import org.ietf.ldap.client.JDAPBERTagDecoder;
import org.ietf.ldap.LDAPControl;
import org.ietf.ldap.ber.stream.*;
import org.ietf.ldap.LDAPException;

/**
 * Represents control data for returning paged results from a search.
 *
 * @version 1.0
 *
 *<PRE>
 *   VirtualListViewResponse ::= SEQUENCE {
 *       targetPosition   INTEGER (0 .. maxInt),
 *       contentCount     INTEGER (0 .. maxInt),
 *       virtualListViewResult ENUMERATED {
 *           success                  (0),
 *           operatonsError           (1),
 *           timeLimitExceeded        (3),
 *           adminLimitExceeded       (11),
 *           insufficientAccessRights (50),
 *           busy                     (51),
 *           unwillingToPerform       (53),
 *           sortControlMissing       (60),
 *           offsetRangeError         (61),
 *           other                    (80)
 *       },
 *       contextID     OCTET STRING OPTIONAL 
 *  }
 *</PRE>
 */

public class LDAPVirtualListResponse extends LDAPControl {
    public final static String VIRTUALLISTRESPONSE = "2.16.840.1.113730.3.4.10";

    /**
     * Blank constructor for internal use in <CODE>LDAPVirtualListResponse</CODE>.
     * @see org.ietf.ldap.LDAPControl
     */
    LDAPVirtualListResponse() {
        super( VIRTUALLISTRESPONSE, true, null );
    }

   /**
     * Contructs an <CODE>LDAPVirtualListResponse</CODE> object.
     * @param oid this parameter must be equal to
     * <CODE>LDAPVirtualListResponse.VIRTUALLISTRESPONSE</CODE> or an 
     * <CODE>LDAPException</CODE>is thrown
     * @param critical <code>true</code> if this control is critical
     * @param value the value associated with this control
     * @exception org.ietf.ldap.LDAPException If oid is not 
     * <CODE>LDAPVirtualListResponse.VIRTUALLISTRESPONSE</CODE>.
     * @see org.ietf.ldap.LDAPControl#register
     */ 
    public LDAPVirtualListResponse( String oid, boolean critical, 
                                    byte[] value ) throws LDAPException {
        super( VIRTUALLISTRESPONSE, critical, value );
        if ( !oid.equals( VIRTUALLISTRESPONSE ) ) {
             throw new LDAPException( "oid must be LDAPVirtualListResponse." +
                                      "VIRTUALLISTRESPONSE", 
                                      LDAPException.PARAM_ERROR);
        }
        
	parseResponse();
    }

    /**
     * Constructs a new <CODE>LDAPVirtualListResponse</CODE> object.
     * @param value a BER encoded byte array
     * @see org.ietf.ldap.LDAPControl
     */
    public LDAPVirtualListResponse( byte[] value ) {
        super( VIRTUALLISTRESPONSE, true, null );
        _value = value;
        parseResponse();
    }

    /**
     * Gets the size of the virtual result set.
     * @return the size of the virtual result set, or -1 if not known.
     */
    public int getContentCount() {
        return _contentCount;
    }

    /**
     * Gets the index of the first entry returned.
     * @return the index of the first entry returned.
     */
    public int getFirstPosition() {
        return _firstPosition;
    }

    /**
     * Gets the result code.
     * @return the result code.
     */
    public int getResultCode() {
        return _resultCode;
    }

    /**
     * Gets the context cookie, if any.
     * @return the result context cookie.
     */
    public String getContext() {
        return _context;
    }

    /**
     * Returns a control useful for subsequent paged results searches.
     * "this" should be a control returned on a previous paged results
     * search, so it contains information on the virtual result set
     * size.
     * @return a control useful for subsequent paged results searches.
     */
    private void parseResponse() {
        /* Suck out the data and parse it */
        ByteArrayInputStream inStream =
            new ByteArrayInputStream( getValue() );
        BERSequence ber = new BERSequence();
        JDAPBERTagDecoder decoder = new JDAPBERTagDecoder();
        int[] nRead = new int[1];
        nRead[0] = 0;
        try  {
            /* A sequence */
            BERSequence seq = (BERSequence)BERElement.getElement(
                                                      decoder, inStream,
                                                      nRead );
            /* First is firstPosition */
            _firstPosition = ((BERInteger)seq.elementAt( 0 )).getValue();
            _contentCount = ((BERInteger)seq.elementAt( 1 )).getValue();
            _resultCode = ((BEREnumerated)seq.elementAt( 2 )).getValue();
            if( seq.size() > 3 ) {
                BEROctetString str = (BEROctetString)seq.elementAt( 3 );
                _context = new String(str.getValue(), "UTF8");
            }
        } catch(Exception x) {
            _firstPosition = _contentCount = _resultCode = -1;
            _context = null;        }
    }

    /**
     * Returns a control returned on a VLV search.
     * @param controls an array of controls that may include a VLV
     * results control
     * @return the control, if any; otherwise null.
     * @deprecated LDAPVirtualListResponse controls are now automatically 
     * instantiated.
     */
    public static LDAPVirtualListResponse parseResponse(
        LDAPControl[] controls ) {
        LDAPVirtualListResponse con = null;
        /* See if there is a VLV response control in the array */
        for( int i = 0; (controls != null) && (i < controls.length); i++ ) {
            if ( controls[i].getID().equals( VIRTUALLISTRESPONSE ) ) {
                con = new LDAPVirtualListResponse( controls[i].getValue() );
                con.parseResponse();
                break;
            }
        }
        if ( con != null ) {
            con.parseResponse();
        }
        return con;
    }

    public String toString() {
         StringBuffer sb = new StringBuffer("{VirtListResponseCtrl:");
        
        sb.append(" isCritical=");
        sb.append(isCritical());
        
        sb.append(" firstPosition=");
        sb.append(_firstPosition);
        
        sb.append(" contentCount=");
        sb.append(_contentCount);

        sb.append(" resultCode=");
        sb.append(_resultCode);
        
        if (_context != null) {
            sb.append(" conext=");
            sb.append(_context);
        }

        sb.append("}");

        return sb.toString();
    }

    
    private int _firstPosition = 0;
    private int _contentCount = 0;
    private int _resultCode = -1;
    private String _context = null;

}
