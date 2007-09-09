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

package org.mozilla.jss.tests;

import java.net.*;
import java.io.*;
import java.security.KeyStoreException;
import java.security.NoSuchProviderException;
import javax.net.ssl.*;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Iterator;

/**
 * This program connects to any SSL Server to exercise
 * all ciphers supported by JSSE for a given JDK/JRE
 * version.  The result is listing of common ciphers
 * between the server and this JSSE client.
 *
 */
public class JSSE_SSLClient {
    
    // Local members
    private String  sslRevision         = "TLS";
    private String  host                = null;
    private int     port                = -1;
    private String  cipherName          = null;
    private String  path                = null;
    private int     debug_level         = 0;
    private String  EOF                 = "test";
    private String  keystoreLoc         = "rsa.pfx";
    private SSLSocketFactory    factory  = null;
    /* ciphersuites to test */
    private ArrayList ciphersToTest      = new ArrayList();
    /* h_ciphers is for ciphersuite that were able to successfully
     * connect to the server */
    private ArrayList h_ciphers          = new ArrayList();
    /* f_ciphers is for ciphersuite that failed to connect to the server */
    private ArrayList f_ciphers          = new ArrayList();
    
    private boolean bVerbose             = false;
    private boolean bFipsMode            = false;
    
    
    /**
     * Set the protocol type and revision
     * @param String sslRevision
     */
    public void setSslRevision(String fSslRevision) {
        
        if (!(fSslRevision.equals("TLS") || fSslRevision.equals("SSLv3"))) {
            System.out.println("type must equal \'TLS\' or \'SSLv3\'\n");
            System.exit(1);
        }
        this.sslRevision = fSslRevision;
    }
    
    /**
     * Set the host name to connect to.
     * @param String hostname
     */
    public void setHost(String fHost) {
        this.host = fHost;
    }
    
    /**
     * Set the port number to connect to.
     * @param int portnumber
     */
    public void setPort(int fPort) {
        this.port = fPort;
    }
    
    /**
     * Set the cipher suite name to use.
     * @param String cipherSuiteName
     */
    public void setCipherSuite(String fCipherSuite) {
        this.cipherName = fCipherSuite;
    }
    
    /**
     * Set the location of rsa.pfx
     * @param String fKeystoreLoc
     */
    public void setKeystoreLoc(String fKeystoreLoc) {
        keystoreLoc = fKeystoreLoc + "/" + keystoreLoc;
    }
    
    /**
     * Get the location of rsa.pfx
     * @return String fKeystoreLoc
     */
    public String getKeystoreLoc() {
        return keystoreLoc;
    }
    
    /**
     * Default constructor.
     */
    public JSSE_SSLClient() {
        //Do nothing.
    }
    
    public boolean isServerAlive() {
        boolean isServerAlive = false;
        SSLSocket           socket   = null;
        if (factory == null) {
            initSocketFactory();
        }
        for (int i = 0 ; i < 20 ; i++) {
            try {
                
                Thread.currentThread().sleep(1000);
                           System.out.println("Testing Connection:" +
                    host + ":" + port);
                socket = (SSLSocket)factory.createSocket(host, port);
                socket.setEnabledCipherSuites(factory.getDefaultCipherSuites());
 
                if (socket.isBound()) {
                               System.out.println("connect isBound");
                    isServerAlive = true;
                    socket.close();
                    break;
                }
                           
            }  catch (java.net.ConnectException ex) {
                //not able to connect
            } catch (InterruptedException ex) {
                ex.printStackTrace();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
            
        }
        
        return isServerAlive;
    }
    /**
     * Test communication with SSL server S
     */
    public void testCiphersuites() {
        SSLSocket           socket   = null;
        int i = 0;
        if (factory == null) {
            initSocketFactory();
        }
        
        if (!isServerAlive()) {
            System.out.println("Unable to connect to " + host + ":" +
                    port + " exiting.");
            System.exit(1);
        }
        Iterator iter = ciphersToTest.iterator();
        while (iter.hasNext()) {
            String cs = (String)iter.next();
            String ciphers[] = {cs};
            try {
                socket = (SSLSocket)factory.createSocket(host, port);
                socket.setEnabledCipherSuites(ciphers);
                testSSLSocket(socket, cs, i++);
            } catch (Exception ex) {
                System.out.println("failed ciphersuite" + ciphers[0]);
                f_ciphers.add(ciphers[0]);
            }
        }
    }
    
    
    public void configureCipherSuites(String server, String CipherSuite) {
        
        boolean testCipher = true;
        
        if (factory == null) {
            initSocketFactory();
        }
        
        String ciphers[] = factory.getSupportedCipherSuites();
        
        for (int i = 0; i < ciphers.length;  ++i) {
            String ciphersuite = ciphers[i];
            testCipher = true;
            if (bVerbose) {
                System.out.print(ciphersuite);
            }
            if (server.equalsIgnoreCase("JSS")) {
                //For JSS SSLServer don't test
                if (ciphersuite.contains("_DHE_") ||
                        ciphersuite.contains("_DES40_") ||
                        ciphersuite.contains("_anon_") ||
                        ciphersuite.contains("_KRB5_") ) {
                    if (bVerbose) System.out.print(" -");
                    testCipher = false;
                }
            }
            if (server.equalsIgnoreCase("JSSE")) {
                //For JSSE SSLServers don't test _DHE_, _EXPORT_, _anon_, _KRB5_
                /*
                if (ciphersuite.contains("_DHE_") ||
                    ciphersuite.contains("_EXPORT_") ||
                    ciphersuite.contains("_anon_") ||
                    ciphersuite.contains("_KRB5_") ) {
                    if (bVerbose) System.out.print(" -");
                    testCipher = false;
                }
                 */
            }
            
            if (testCipher) {
                ciphersToTest.add(ciphers[i]);
                if (bVerbose) System.out.print(" - Testing");
            }
        }
        
        if (bVerbose) System.out.print("\n");
        
        if(bVerbose) System.out.println("\nTesting " + ciphersToTest.size() +
                " ciphersuites.");
        
    }
    
    private void initSocketFactory() {
        
        SSLContext          ctx      = null;
        KeyManagerFactory   kmf      = null;
        TrustManagerFactory tmf      = null;
        KeyStore            ks       = null;
        KeyStore            ksTrust  = null;
        String              provider = "SunJCE";
        
        
        
        /*
         * Set up a key manager for client authentication
         * if asked by the server.  Use the implementation's
         * default TrustStore and secureRandom routines.
         */
        char[] passphrase      = "m1oZilla".toCharArray();
        try {
            
            
            String javaVendor      = System.getProperty("java.vendor");
            if (Constants.debug_level > 3)
                System.out.println("DBEUG: JSSE_SSLClient.java java.vendor=" +
                        javaVendor);
            
            // Initialize the system
            if (javaVendor.equals("IBM Corporation")) {
                System.setProperty("java.protocol.handler.pkgs",
                        "com.ibm.net.ssl.www.protocol.Handler");
                java.security.Security.addProvider((java.security.Provider)
                Class.forName("com.ibm.jsse2.IBMJSSEProvider2").newInstance());
                provider = "IBMJCE";
            } else {
                System.setProperty("java.protocol.handler.pkgs",
                        "com.sun.net.ssl.internal.www.protocol");
                java.security.Security.addProvider((java.security.Provider)
                Class.forName("com.sun.crypto.provider.SunJCE").newInstance());
            }
            
            // Load the keystore that contains the certificate
            String certificate = new String("SunX509");
            ks  = KeyStore.getInstance("PKCS12");
            if (javaVendor.equals("IBM Corporation")) {
                certificate = new String("IbmX509");
                ks  = KeyStore.getInstance("PKCS12", provider);
            }
            
            try {
                kmf = KeyManagerFactory.getInstance(certificate);
                ks.load(new FileInputStream(getKeystoreLoc()), passphrase);
            } catch (Exception keyEx) {
                if (Constants.debug_level > 3) {
                    if(System.getProperty("java.vendor").equals("IBM Corporation")) {
                        System.out.println("Using IBM JDK: Cannot load keystore due "+
                                "to strong security encryption settings\nwith limited " +
                                "Jurisdiction policy files :\n" +
                                "http://www-1.ibm.com/support/docview.wss?uid=swg21169931");
                        System.exit(0);
                    } else {
                        System.out.println(keyEx.getMessage());
                        keyEx.printStackTrace();
                    }
                }
                throw keyEx;
            }
            kmf.init(ks, passphrase);
            
            // trust manager that trusts all cetificates
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public boolean checkClientTrusted(
                            java.security.cert.X509Certificate[] chain){
                        return true;
                    }
                    public boolean isServerTrusted(
                            java.security.cert.X509Certificate[] chain){
                        return true;
                    }
                    public boolean isClientTrusted(
                            java.security.cert.X509Certificate[] chain){
                        return true;
                    }
                    public java.security.cert.X509Certificate[]
                            getAcceptedIssuers() {
                        return null;
                    }
                    public void checkClientTrusted(
                            java.security.cert.X509Certificate[] chain,
                            String authType) {}
                    public void checkServerTrusted(
                            java.security.cert.X509Certificate[] chain,
                            String authType) {}
                }
            };
            
            ctx = SSLContext.getInstance(sslRevision);
            ctx.init(kmf.getKeyManagers(), trustAllCerts, null);
            factory = ctx.getSocketFactory();
            
            String[] JSSE_ciphers = factory.getSupportedCipherSuites();
        } catch (KeyStoreException ex) {
            ex.printStackTrace();
        } catch (NoSuchProviderException ex) {
            ex.printStackTrace();
        } catch (ClassNotFoundException ex) {
            ex.printStackTrace();
        } catch (IllegalAccessException ex) {
            ex.printStackTrace();
        } catch (InstantiationException ex) {
            ex.printStackTrace();
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        
    }
    
    /**
     * sendServerShutdownMsg
     */
    public void sendServerShutdownMsg() {
        try {
            SSLSocket           socket   = null;
            if (factory == null) {
                initSocketFactory();
            }
            
            socket = (SSLSocket)factory.createSocket(host, port);
            socket.setEnabledCipherSuites(factory.getDefaultCipherSuites());
            
            
            if (bVerbose) System.out.println("Sending shutdown message " +
                    "to server.");
            socket.startHandshake();
            OutputStream os    = socket.getOutputStream();
            PrintWriter out    = new PrintWriter(new BufferedWriter(
                    new OutputStreamWriter(os)));
            out.println("shutdown");
            out.flush();
            out.close();
            socket.close();
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        
    }
    
    private void testSSLSocket(SSLSocket socket, String ciphersuite,
            int socketID) {
            /*
             * register a callback for handshaking completion event
             */
        try {
            socket.addHandshakeCompletedListener(
                    new HandshakeCompletedListener() {
                public void handshakeCompleted(
                        HandshakeCompletedEvent event) {
                    h_ciphers.add(event.getCipherSuite());
                    System.out.println(event.getCipherSuite());
                    if ( Constants.debug_level >= 3 ) {
                        System.out.println(
                                "SessionId "+ event.getSession() +
                                " Test Status : PASS");
                        System.out.flush();
                    }
                }
            }
            );
        } catch (Exception handshakeEx) {
            System.out.println(handshakeEx.getMessage());
            handshakeEx.printStackTrace();
            System.exit(1);
        }
        
        try {
            // Set socket timeout to 10 sec
            socket.setSoTimeout(10 * 1000);
            socket.startHandshake();
            
            String outputLine  = null;
            String inputLine   = null;
            InputStream  is    = socket.getInputStream();
            OutputStream os    = socket.getOutputStream();
            BufferedReader bir = new BufferedReader(
                    new InputStreamReader(is));
            PrintWriter out;
            out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(os)));
            
            //write then read on the connection once.
            outputLine = ciphersuite + ":" + socketID + "\n";
            if (bVerbose) {
                System.out.println("Sending: " + outputLine);
            }
            out.print(outputLine);
            out.flush();
            inputLine = bir.readLine();
            if (bVerbose) {
                System.out.println("Received: " + inputLine +
                        " on Client-" + socketID);
            }
            bir.close();
            out.close();
        } catch (SSLHandshakeException ex) {
            f_ciphers.add(ciphersuite);
        } catch (IOException ex) {
            ex.printStackTrace();
            System.exit(1);
        }
        try {
            socket.close();
        } catch (IOException ex) {
            ex.printStackTrace();
        }
    }
    
    
    
    public void outputCipherResults() {
        String banner = new String
                ("\n----------------------------------------------------------\n");
        
        System.out.println(banner);
        System.out.println("JSSE has " +
                factory.getSupportedCipherSuites().length + " ciphersuites and " +
                ciphersToTest.size() + " were configured and tested.");
        
        if (ciphersToTest.size() == h_ciphers.size()) {
            System.out.println("All " + ciphersToTest.size() +
                    " configured ciphersuites tested Successfully!\n");
        }
        
        if (!h_ciphers.isEmpty()) {
            if (!f_ciphers.isEmpty()) {
                System.out.println(banner);
                System.out.println(h_ciphers.size() +
                        " ciphersuites successfully connected to the "+
                        "server\n");
            }
            Iterator iter = h_ciphers.iterator();
            while (iter.hasNext()) {
                System.out.println((String) iter.next());
                
            }
        }
        if (bFipsMode) {
            System.out.println("Note: ciphersuites that have the prefix " +
                    "\"SSL\" or \"SSL3\" were used in TLS mode.");
        }
        
        if (ciphersToTest.size()
        != (h_ciphers.size() + f_ciphers.size())) {
            System.out.println("ERROR: did not test all expected ciphersuites");
        }
        if (!f_ciphers.isEmpty()) {
            System.out.println(banner);
            System.out.println(f_ciphers.size() +
                    " ciphersuites that did not connect to the "+
                    "server\n\n");
            Iterator iter = f_ciphers.iterator();
            while (iter.hasNext()) {
                System.out.println((String) iter.next());
                
            }
            System.out.println("we should have no failed ciphersuites!");
            System.exit(1);
        }
        
        System.out.println(banner);
        
    }
    
    
    
    
    /**
     * Main method for local unit testing.
     */
    public static void main(String [] args) {
        
        String testCipher       = null;
        String testHost         = "localhost";
        String keystoreLocation = "rsa.pfx";
        int    testPort         = 29750;
        String serverType       = "JSSE";
        String usage            = "java org.mozilla.jss.tests.JSSE_SSLClient" +
                "\n<keystore location> " +
                "<test port> <test host> <server type> <test cipher>";
        
        try {
            if ( args[0].toLowerCase().equals("-h") || args.length < 1) {
                System.out.println(usage);
                System.exit(1);
            }
            
            if ( args.length >= 1 ) {
                keystoreLocation = (String)args[0];
            }
            if ( args.length >= 2) {
                testPort         = new Integer(args[1]).intValue();
                System.out.println("using port: " + testPort);
            }
            if ( args.length >= 3) {
                testHost       = (String)args[2];
            }
            if ( args.length == 4) {
                serverType         = (String)args[3];
            }
            if ( args.length == 5) {
                testCipher         = (String)args[4];
            }
        } catch (Exception e) {
            System.out.println(usage);
            System.exit(1);
        }
        
        JSSE_SSLClient sslSock = new JSSE_SSLClient();
        
        sslSock.setHost(testHost);
        sslSock.setPort(testPort);
        sslSock.setKeystoreLoc(keystoreLocation);
        
        sslSock.setCipherSuite(testCipher);
        sslSock.configureCipherSuites(serverType, testCipher);
        try {
            sslSock.testCiphersuites();
        } catch (Exception e) {
            System.out.println("Exception caught testing ciphersuites\n" +
                    e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
        sslSock.sendServerShutdownMsg();
        sslSock.outputCipherResults();
        
        
        System.exit(0);
    }
}
