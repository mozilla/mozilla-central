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
package org.ietf.ldap;

/*
 * This object represents the value of the LDAPConnection.m_responseControlTable hashtable.
 * It stores the response controls and its corresponding LDAPConnection and
 * the message ID for its corresponding LDAPMessage.
 */
class LDAPResponseControl implements java.io.Serializable {
    static final long serialVersionUID = 389472019686058593L;
    private LDAPConnection m_connection;
    private int m_messageID;
    private LDAPControl[] m_controls;

    public LDAPResponseControl(LDAPConnection conn, int msgID, 
      LDAPControl[] controls) {

        m_connection = conn;
        m_messageID = msgID;
        m_controls = new LDAPControl[controls.length];
        for (int i=0; i<controls.length; i++) 
            m_controls[i] = controls[i];
    }

    public int getMsgID() {
        return m_messageID;
    }

    public LDAPControl[] getControls() {
        return m_controls;
    }

    public LDAPConnection getConnection() {
        return m_connection;
    }
}
