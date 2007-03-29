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
package netscape.ldap.beans;

import java.beans.SimpleBeanInfo;
import java.beans.BeanDescriptor;
import java.beans.EventSetDescriptor;
import java.beans.MethodDescriptor;
import java.beans.PropertyDescriptor;
import java.beans.ParameterDescriptor;
import java.beans.BeanInfo;

/**
 * BeanInfo for displaying string
 *
 */

public class DisplayStringBeanInfo extends SimpleBeanInfo {

    public DisplayStringBeanInfo() throws Exception {

    beanClass = Class.forName( "netscape.ldap.beans.DisplayString" );

        // Publish descriptor ---------------------------------------------
        try {
            _beanDescriptor = new BeanDescriptor(beanClass);
			_beanDescriptor.setDisplayName( "Text Field" );
			_beanDescriptor.setShortDescription(
				"LDAP property retrieval -"
				+ " provided a host, port, base, search filter,"
				+ " and optionally a username and password,"
				+ " return an array of string values both as a"
				+ " function return and as a Property change event." );
        } catch (Exception e) {
        }
    }

    public BeanDescriptor getBeanDescriptor() {
		return _beanDescriptor;
	}

    private static Class beanClass;
	private BeanDescriptor _beanDescriptor;
    private EventSetDescriptor[] _eventSetDescriptor;
    private PropertyDescriptor[] _propertyDescriptor;
}


