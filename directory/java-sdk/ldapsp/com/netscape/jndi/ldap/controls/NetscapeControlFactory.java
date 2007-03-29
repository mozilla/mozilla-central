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
package com.netscape.jndi.ldap.controls;


/**
 * Factory for creating controls. Only controls send by the direcory server
 * are processed.
 */

import javax.naming.*;
import javax.naming.ldap.*;
import netscape.ldap.LDAPControl;
import netscape.ldap.controls.*;
import com.netscape.jndi.ldap.common.ExceptionMapper;

public class NetscapeControlFactory extends ControlFactory {

    // "1.2.840.113556.1.4.473" Sort Control (Request) 
    final static String REQ_SORT  = LDAPSortControl.SORTREQUEST;
    
    // "1.2.840.113556.1.4.474" Sort Control (Response)  
    final static String RSP_SORT = LDAPSortControl.SORTRESPONSE;

    // "2.16.840.1.113730.3.4.2" ManageDSAIT Control 
    final static String REQ_MANAGEDSAIT = LDAPControl.MANAGEDSAIT;

    // "2.16.840.1.113730.3.4.3" PersistentSearch Control 
    final static String REQ_PERSISTENTSEARCH  = LDAPPersistSearchControl.PERSISTENTSEARCH;
    
    // "2.16.840.1.113730.3.4.4" PasswordExpired Control
    final static String RSP_PWDEXPIRED = LDAPPasswordExpiredControl.EXPIRED;
    
    // "2.16.840.1.113730.3.4.5" PasswordExpiring Control 
    final static String RSP_PWDEXPIRING = LDAPPasswordExpiringControl.EXPIRING;
    
    // "2.16.840.1.113730.3.4.7" EntryChanged Controle 
    final static String RSP_ENTRYCHANGED = LDAPEntryChangeControl.ENTRYCHANGED;

    // "2.16.840.1.113730.3.4.9" Virtual List (Request) 
    final static String REQ_VIRTUALLIST = LDAPVirtualListControl.VIRTUALLIST;
    
    // "2.16.840.1.113730.3.4.10" Virtual List (Response)
    final static String RSP_VIRTUALLIST = LDAPVirtualListResponse.VIRTUALLISTRESPONSE;

    // "2.16.840.1.113730.3.4.12" Proxed Authentication
    final static String REQ_PROXIEDAUTH  = LDAPProxiedAuthControl.PROXIEDAUTHREQUEST;


    /**
     * Creates a control using this control factory
     * @param ctrl A non-null control.
     * @return A possibly null Control.
     * @exception NamingException If ctrl contains invalid data that prevents it from
     * being used to create a control.
     */
    public Control getControlInstance(Control ctrl) throws NamingException {
        if (ctrl == null) {
            return null;
        }
        LDAPControl rawCtrl = new LDAPControl(
            ctrl.getID(), ctrl.isCritical(), ctrl.getEncodedValue());
        return getControlInstance(rawCtrl);        
    }    
        
    /**
     * Create a JNDI control from a raw ldapjdk control
     * @param ctrl A non-null control.
     * @return A possibly null Control.
     * @exception NamingException If ctrl contains invalid data that prevents it from
     * being used to create a control.
     */
    public static Control getControlInstance(LDAPControl rawCtrl) throws NamingException {
        if (rawCtrl == null) {
            return null;
        }

        try { 
            String ctrlID = rawCtrl.getID();
        
             // Entry changed control is parsed by LDAPPersistSearchControl             
            if (ctrlID.equals(RSP_ENTRYCHANGED)) {
                return new LdapEntryChangeControl(
                    rawCtrl.isCritical(), rawCtrl.getValue());
            }
            
            // Password Expired control
            else if(ctrlID.equals(RSP_PWDEXPIRED)) {
                return new LdapPasswordExpiredControl(
                    rawCtrl.isCritical(), rawCtrl.getValue());
            }

            // Password Expiring control
            else if(ctrlID.equals(RSP_PWDEXPIRING)) {
                return new LdapPasswordExpiringControl(
                    rawCtrl.isCritical(), rawCtrl.getValue());
            }

            // Sort Response control
            else if(ctrlID.equals(RSP_SORT)) {
                return new LdapSortResponseControl(
                    rawCtrl.isCritical(), rawCtrl.getValue());
            }

            // Virtual List Response control
            else if(ctrlID.equals(RSP_VIRTUALLIST)) {
                return new LdapVirtualListResponseControl(
                    rawCtrl.isCritical(), rawCtrl.getValue());
            }

            // No match try another ControlFactory
            return null;
        }
        catch (Exception ex) {
            throw ExceptionMapper.getNamingException(ex);
        }
    }
}
