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
 * The Original Code is Netscape Security Services for Java.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
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

/**
 * GenerateTestCert is a class for generating test certificate,
 * both private and public pairs. This certificate is generated
 * with 512 bit RSA using Mozilla-JSS provider. The cert name
 * is "JSSCATestCert".
 *
 * @author      Sandeep Konchady
 * @version     1.0
 */

package org.mozilla.jss.tests;

import org.mozilla.jss.CryptoManager;
import org.mozilla.jss.ssl.*;
import org.mozilla.jss.crypto.*;
import org.mozilla.jss.asn1.*;
import org.mozilla.jss.pkix.primitive.*;
import org.mozilla.jss.pkix.cert.*;
import org.mozilla.jss.pkix.cert.Certificate;
import org.mozilla.jss.util.PasswordCallback;
import java.util.Calendar;
import java.util.Date;
import java.security.*;
import java.security.PrivateKey;
import java.net.InetAddress;
import java.io.InputStream;
import java.io.EOFException;

public class GenerateTestCert {
    
    private final SignatureAlgorithm sigAlg =
            SignatureAlgorithm.RSASignatureWithSHA1Digest;
    private X509Certificate nssServerCert, nssClientCert;
    static final private String CACERT_NICKNAME = "JSSCATestCert";
    static final private String SERVERCERT_NICKNAME = "JSSTestServerCert";
    static final private String CLIENTCERT_NICKNAME = "JSSTestClientCert";

    /**
     * Main method for testing and generating cert pairs.
     */
    public static void main(String[] args) throws Exception {
       GenerateTestCert gtc = new GenerateTestCert();
        if ( args.length > 0 ) {
            gtc.doIt(args);
        } else {
            gtc.usage();
        }
    }

    public void usage() {
        System.out.println("USAGE: " + 
                    "java org.mozilla.jss.tests.GenerateTestCert " + 
                    "<test dir> <password file> [hostname] [CAcertNickname] " +
                    "[ServerCertNickname] [ClientCertNickName]");
        System.out.println("This program creates self signed Certificates." +
                    "They are only meant for testing and should never be " +
                    "used in production. " +
                    "\nThe default nicknames:" +
                    "\n\tCA certificate: " + CACERT_NICKNAME +
                    "\n\tServer certificate: " + SERVERCERT_NICKNAME +
                    "\n\tClient certificate: " + CLIENTCERT_NICKNAME);
        System.exit(1);
    }
 
    /**
     * Based on the input parameters, generate a cert
     * pair.
     */
    private void doIt(String[] args) throws Exception {
        String caCertNick = CACERT_NICKNAME;
        String serverCertNick = SERVERCERT_NICKNAME;
        String clientCertNick = CLIENTCERT_NICKNAME;

        if ( args.length < 2 ) {
            usage();
        }

        try {
            CryptoManager.initialize(args[0]);
            CryptoManager cm = CryptoManager.getInstance();

            CryptoToken tok = cm.getInternalKeyStorageToken();

            PasswordCallback cb = new FilePasswordCallback(args[1]);
            tok.login(cb);

            SecureRandom rng= SecureRandom.getInstance("pkcs11prng",
                "Mozilla-JSS");
            int rand = nextRandInt (rng);

            String hostname = "localhost";
            if (args.length > 3) {
                hostname = args[2];
            }

            X509Certificate[] certs;
            if (args.length > 4) {
                caCertNick = args[3];
            }

            /* ensure certificate does not already exists */
            certs = cm.findCertsByNickname(caCertNick);
            if (certs.length > 0) {
                System.out.println(caCertNick + " already exists!");
                System.exit (1);
            };

            if (args.length > 5) {
                serverCertNick = args[4];
            }
            certs = cm.findCertsByNickname(serverCertNick);
            if (certs.length > 0) {
                System.out.println(serverCertNick + " already exists!");
                System.exit (1);
            };

            if (args.length == 6) {
                clientCertNick = args[5];
            }
            certs = cm.findCertsByNickname(clientCertNick);
            if (certs.length > 0) {
                System.out.println(clientCertNick + " already exists!");
                System.exit (1);
            };

            int keyLength = 512;
            // generate CA cert
            java.security.KeyPairGenerator kpg =
            java.security.KeyPairGenerator.getInstance("RSA", "Mozilla-JSS");
            kpg.initialize(keyLength);
            KeyPair caPair = kpg.genKeyPair();

            SEQUENCE extensions = new SEQUENCE();
            extensions.addElement(makeBasicConstraintsExtension());

            Certificate caCert = makeCert("CACert", "CACert", rand+1,
                caPair.getPrivate(), caPair.getPublic(), rand, extensions);
            X509Certificate nssCaCert = cm.importUserCACertPackage (
                ASN1Util.encode (caCert), caCertNick);
            InternalCertificate intern = (InternalCertificate)nssCaCert;
            intern.setSSLTrust(
                InternalCertificate.TRUSTED_CA |
                InternalCertificate.TRUSTED_CLIENT_CA |
                InternalCertificate.VALID_CA);

            // generate server cert
            kpg.initialize(keyLength);
            KeyPair serverPair = kpg.genKeyPair();
            Certificate serverCert = makeCert("CACert", hostname, rand+2,
                caPair.getPrivate(), serverPair.getPublic(), rand, null);
            nssServerCert = cm.importCertPackage(
                ASN1Util.encode(serverCert), serverCertNick);

            // generate client auth cert
            kpg.initialize(keyLength);
            KeyPair clientPair = kpg.genKeyPair();
            Certificate clientCert = makeCert("CACert", "ClientCert", rand+3,
                caPair.getPrivate(), clientPair.getPublic(), rand, null);
            nssClientCert = cm.importCertPackage(
                ASN1Util.encode(clientCert), clientCertNick);

            System.out.println("\nThis program created certificates with \n" +
                               "following cert nicknames:" +
                               "\n\t" + caCertNick +
                               "\n\t" + serverCertNick +
                               "\n\t" + clientCertNick);
            System.out.println("Exiting main()");

        } catch(Exception e) {
              e.printStackTrace();
              System.exit(1);
        }
        System.exit(0);
    }

    static int nextRandInt(SecureRandom rand) throws Exception {
        byte[] bytes = new byte[4];
        rand.nextBytes(bytes);
        return  ((int)bytes[0])<<24 | ((int)bytes[1])<<16 |
                ((int)bytes[2])<<8 | ((int)bytes[3]);
    }

    /**
     * Make basic extension.
     */
    private Extension makeBasicConstraintsExtension() throws Exception {
        SEQUENCE bc = new SEQUENCE();
        bc.addElement( new BOOLEAN(true) ); // cA
        OBJECT_IDENTIFIER bcOID = new OBJECT_IDENTIFIER(
                new long[] {2, 5, 29, 19}); // from RFC 2459
                OCTET_STRING enc = new OCTET_STRING(ASN1Util.encode(bc));
                return new Extension(bcOID, true, enc);
    }

    /**
     * Method that generates a certificate for given credential
     * 
     * @param issuerName 
     * @param subjectName 
     * @param serialNumber 
     * @param privKey 
     * @param pubKey 
     * @param rand 
     * @param extensions 
     * @throws java.lang.Exception 
     * @return 
     */
    private Certificate makeCert(String issuerName,
            String subjectName,
            int serialNumber,
            PrivateKey privKey,
            PublicKey pubKey,
            int rand,
            SEQUENCE extensions) throws Exception {
        AlgorithmIdentifier sigAlgID = new AlgorithmIdentifier( sigAlg.toOID());

        Name issuer = new Name();
        issuer.addCommonName(issuerName);
        issuer.addCountryName("US");
        issuer.addOrganizationName("Mozilla"+rand);
        issuer.addOrganizationalUnitName("JSS Testing");

        Name subject = new Name();
        subject.addCommonName(subjectName);
        subject.addCountryName("US");
        subject.addOrganizationName("Mozilla"+rand);
        subject.addOrganizationalUnitName("JSS Testing");

        Calendar cal = Calendar.getInstance();
        Date notBefore = cal.getTime();
        cal.add(Calendar.YEAR, 1);
        Date notAfter = cal.getTime();

        SubjectPublicKeyInfo.Template spkiTemp =
                new SubjectPublicKeyInfo.Template();
        SubjectPublicKeyInfo spki =
                (SubjectPublicKeyInfo) ASN1Util.decode(spkiTemp,
                pubKey.getEncoded());

        CertificateInfo info = new CertificateInfo(
                CertificateInfo.v3, new INTEGER(serialNumber), sigAlgID,
                issuer, notBefore, notAfter, subject, spki);
        if( extensions != null ) {
            info.setExtensions(extensions);
        }

        return new Certificate(info, privKey, sigAlg);
    }

}
