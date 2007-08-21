package org.mozilla.jss.tests;

import org.mozilla.jss.CryptoManager;
import org.mozilla.jss.crypto.*;

public class ListCACerts {
    
    public static void main(String args[]) throws Exception {
        if( args.length > 2) {
            System.out.println(
                "Usage: java org.mozilla.jss.tests.ListCACerts <dbdir> [verbose]");
            System.exit(1);
        }
        try {
            CryptoManager.initialize(args[0]);
            CryptoManager cm = CryptoManager.getInstance();
            
            X509Certificate[] certs = cm.getCACerts();
            
            //added verbose option to limited the output of the tinderbox
            // and nightly QA.
            
            System.out.println("Number of CA certs: " + certs.length);
            System.out.println("use option \"verbose\" if you want the CA " +
                "certs printed out");
            if (args.length == 2 && args[1].equalsIgnoreCase("verbose")) {
                for(int i=0; i < certs.length; ++i ) {
                    System.out.println(certs[i].getSubjectDN().toString());
                    InternalCertificate ic = (InternalCertificate) certs[i];
                    System.out.println("SSL: " + ic.getSSLTrust() + 
                        ", Email: " + ic.getEmailTrust() + 
                        ", Object Signing: " + ic.getObjectSigningTrust());
                }
            }
            
        } catch(Throwable e) {
            e.printStackTrace();
            System.exit(1);
        }
        System.exit(0);
    }
}
