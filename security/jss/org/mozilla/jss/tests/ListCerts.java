/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is the Netscape Security Services for Java.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-2000
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
package org.mozilla.jss.tests;

import java.io.ByteArrayInputStream;
import java.security.cert.CertificateFactory;
import java.util.Iterator;
import java.util.Set;
import org.mozilla.jss.CryptoManager;
import org.mozilla.jss.asn1.ASN1Util;
import org.mozilla.jss.asn1.OBJECT_IDENTIFIER;
import org.mozilla.jss.asn1.OCTET_STRING;
import org.mozilla.jss.asn1.SEQUENCE;
import org.mozilla.jss.crypto.*;
import org.mozilla.jss.pkix.cert.Certificate;
import org.mozilla.jss.pkix.cert.CertificateInfo;
import org.mozilla.jss.pkix.cert.Extension;
import java.security.Security;
import java.security.Provider;

public class ListCerts {
    
    public static void main(String args[]) {
        
        try {
            
            if( args.length != 2 ) {
                System.out.println("Usage: ListCerts <dbdir> <nickname>");
                return;
            }
            String dbdir = args[0];
            String nickname = args[1];
            
            CryptoManager.initialize(dbdir);
            
            CryptoManager cm = CryptoManager.getInstance();
            
            X509Certificate[] certs = cm.findCertsByNickname(nickname);
           Provider[] providers = Security.getProviders();
           for ( int i=0; i < providers.length; i++ ) {
               System.out.println("Provider "+i+": "+providers[i].getName());
           } 
            System.out.println(certs.length + " certs found with this nickname.");
            
            for(int i=0; i < certs.length; i++) {
                System.out.println("\nSubject: "+certs[i].getSubjectDN());
                Certificate cert =
                    (Certificate)ASN1Util.decode(Certificate.getTemplate(),
                    certs[i].getEncoded());
                CertificateInfo info = cert.getInfo();
                OBJECT_IDENTIFIER sigalg = info.getSignatureAlgId().getOID();
                System.out.println("Signature oid " +
                    info.getSignatureAlgId().getOID());
                
                SEQUENCE extensions = info.getExtensions();
                for (int j = 0; j < extensions.size(); j++) {
                    Extension ext = (Extension)extensions.elementAt(i);
                    OBJECT_IDENTIFIER oid = ext.getExtnId();
                    OCTET_STRING value = ext.getExtnValue();
                    System.out.println("Extension " + oid.toString());
                    if (ext.getCritical()) {
                        System.out.println("Critical extension: " 
                            + oid.toString());
                    } else {
                        System.out.println("NON Critical extension: " 
                            + oid.toString());
                    }
                }
                System.out.println("Convert to JDK cert");
                //Convert to JDK certicate
                CertificateFactory cf = CertificateFactory.getInstance("X.509");
                ByteArrayInputStream bais = new ByteArrayInputStream(
                    certs[i].getEncoded());
                java.security.cert.X509Certificate jdkCert =
                    (java.security.cert.X509Certificate)
                    cf.generateCertificate(bais);
                bais.close();
                
                System.out.println("Subject " + jdkCert.getSubjectDN());
                System.out.println("Signature oid " + jdkCert.getSigAlgName());
                /* non critical extensions */
                Set nonCritSet = jdkCert.getNonCriticalExtensionOIDs();
                if (nonCritSet != null && !nonCritSet.isEmpty()) {
                    for (Iterator j = nonCritSet.iterator(); j.hasNext();) {
                        String oid = (String)j.next();
                        System.out.println(oid);
                    }
                } else { System.out.println("no NON Critical Extensions"); }
                
                /* critical extensions */
                Set critSet = jdkCert.getCriticalExtensionOIDs();
                if (critSet != null && !critSet.isEmpty()) {
                    System.out.println("Set of critical extensions:");
                    for (Iterator j = critSet.iterator(); j.hasNext();) {
                        String oid = (String)j.next();
                        System.out.println(oid);
                    }
                } else { System.out.println("no Critical Extensions"); }
            }
            System.out.println("END");
            
        } catch( Exception e ) {
            e.printStackTrace();
            System.exit(1);
        }
        System.exit(0);
    }
}
