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

import java.io.*;
import java.net.*;
import javax.net.ssl.*;
import java.security.KeyStore;
import java.util.Vector;
import org.mozilla.jss.*;
import java.security.Provider;
import java.security.Security;
import sun.security.pkcs11.SunPKCS11;

/**
 * JSSE SSLServer class that acts as SSL Server
 *
 * @author  Sandeep.Konchady@Sun.COM
 * @version 1.0
 */

public class JSSE_SSLServer {
    
    private int DefaultServerPort   = 29753;
    private int port                = DefaultServerPort;
    private String type             = "SSLv3";
    private String configDir      = "";
    private boolean bClientAuth     = false;
    private boolean       bVerbose        = false;
    private Vector supportedCiphers = new Vector();
    private CryptoManager manager;
    private String provider = "SunJCE";  
    
    
    /**
     * Constructs a JSSE_SSLServer.
     */
    public JSSE_SSLServer() throws IOException {
    }
    
       /**
     * Set the provider to use.
     * @param String p
     */
    public void setProvider(String p) {
        provider = p;
    }
    
    /**
     * Get the configured provider.
     * @return String provider
     */
    public String getProvider() {
        return provider;
    }
    /**
     * Set the location of keystore file.
     * @param String fconfigDir
     */
    public void setKeystore(String fconfigDir) {
        configDir = fconfigDir;
    }
    
    /**
     * Get the location of keystore file.
     * @return String configDir
     */
    public String getKeystore() {
        return configDir;
    }
    
    /**
     * Main method to create the class server. This takes
     * one command line arguments, the port on which the
     * server accepts requests.
     */
    public static void main(String args[]) {
        try {
            (new JSSE_SSLServer()).startSSLServer(args);
        } catch (Exception e) {}
    }
    
    /**
     * Start SSLServer and accept connections.
     * @param args[]
     */
    public void startSSLServer(String[] args) throws Exception {
        String configDir = "";
        String pwFile = "";
        String nssConfig = "";
        JSSE_SSLServer sslServer = new JSSE_SSLServer();
        
        if ( args.length <= 1 ) {
            System.out.println(
                "USAGE: java JSSE_SSLServer [port] [TLS | SSLv3]" +
                "[ClientAuth = true | false]" + 
                "[config directory] [keystore filename]" +
                "[NSS DB passwordFile]" +
                "[JCE || Mozilla-JSS || NSSPkcs11]");
            System.out.println(
                "\nIf the second argument is TLS, it will start as a\n" +
                "TLS server, otherwise, it will be started in SSLv3 mode." +
                "\nIf the third argument is true,it will require\n" +
                "client authentication as well.");
            System.exit(1);
        }
        
        for (int i = 0; i < args.length; i++) {
            System.out.println(i + " = " + args[i]);
        }
        if (args.length >= 1) {
            port = Integer.parseInt(args[0]);
        }
        if (args.length >= 2) {
            type = args[1];
        }
        if (args.length >= 3 && args[2].equals("true")) {
            bClientAuth = true;
        }
        if (args.length >= 4 && args.length >= 5) {
            configDir = args[3];
            String keystore = configDir + "/" + args[4];
            if ( keystore != null ) {
                sslServer.setKeystore(keystore);
            }
        }
        if (args.length >= 7 && args.length >=8 ) {
            if ((args[5].equalsIgnoreCase("Mozilla-JSS"))) {
                if (args.length >= 8) {
                    pwFile = args[7];
                }
                
                System.out.println("Initializing " + args[5]);
                CryptoManager.InitializationValues vals = new
                    CryptoManager.InitializationValues(configDir);
                vals.removeSunProvider = false;
                CryptoManager.initialize(vals);
                manager = CryptoManager.getInstance();
                manager.setPasswordCallback(
                    new FilePasswordCallback(pwFile) );
                
             } else if (args[5].equalsIgnoreCase("Sunpkcs11")) {
                
                nssConfig = args[6];
                System.out.println("Initializing " +  args[5] + "-NSS");
                    Provider nss = null;
                    nss = new sun.security.pkcs11.SunPKCS11(nssConfig);
                    Security.insertProviderAt(nss, 1);
                    System.out.println("Initialized " +  args[5] + "-NSS"); 
                    
            } else {
                //use default 
            }
             
            
        }
        
            Provider[] providers = Security.getProviders();
            for ( int i=0; i < providers.length; i++ ) {
                System.out.println("Provider "+i+": "+providers[i].getName());
            }

        
        
//        System.out.println("using port: " + port);
//        System.out.println("mode type " + type + " ClientAuth " +
//            (bClientAuth ? "true" : "false"));
//        System.out.println("configDir " + configDir);
        
        try {
            System.out.println("creating SSLSockets:");
            
            SSLServerSocketFactory ssf = 
                sslServer.getServerSocketFactory(type);
            

            if ( ssf != null ) {
                SSLServerSocket ss =
                    (SSLServerSocket)ssf.createServerSocket(port);
                // Set server socket timeout to 5 minutes
                ss.setSoTimeout(300 * 1000);
                System.out.println("Enable ciphers.");
                // Enable all the JSSE ciphersuites
                ss.setEnabledCipherSuites(ss.getSupportedCipherSuites());
                
                System.out.println("Create JSSE SSLServer");
                ((SSLServerSocket)ss).setNeedClientAuth(bClientAuth);
                JSSE_SSLServer JSSEServ = new JSSE_SSLServer();
                // accept an SSL connection
                int socketCntr = 0;
                while (true) {
                    try {
                        //The client will tell the server to shutdown
                        Socket socket = ss.accept();
                        socket.setSoTimeout(300 * 1000);
                        socketCntr ++;
                        readWriteThread rwThread = new readWriteThread(socket,
                            socketCntr);
                        rwThread.start();
                    } catch (IOException ex) {
                        System.out.println("Exception caught in " +
                            "SSLServerSocket.accept():" +
                            ex.getMessage());
                        try {
                            ss.close();
                        } catch (Exception e) {}
                        break;
                    }
                }
            } else {
                
                
                if(System.getProperty("java.vendor").equals("IBM Corporation")){
                    System.out.println("Using IBM JDK: Cannot load keystore " +
                        "due to strong security encryption settings\nwith " +
                        "limited Jurisdiction policy files :\n http://" +
                        "www-1.ibm.com/support/docview.wss?uid=swg21169931");
                    System.exit(0);
                }
                System.out.println("unable to initialize JSSE_SocketFactory " +
                    "exiting!");
                System.exit(1);
                
            }
        } catch (Exception e) {
            System.out.println("Unable to start JSSE_SSLServer: " +
                e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
        System.out.println("Main JSSE_SSLServer exiting.");
        // Exit gracefully
        System.exit(0);
    }
    
    /**
     * ReadWrite thread class that takes a
     * SSLSocket as input and read then writes
     * back to client.
     */
    private class readWriteThread extends Thread {
        private Socket socket = null;
        private int socketCntr   = 0;
        
        public readWriteThread(Socket sock, int cntr) {
            this.socket     = sock;
            this.socketCntr = cntr;
        }
        
        public void run() {
            
            try {
                String inputLine   = null;
                String outputLine  = null;
                InputStream  is    = socket.getInputStream();
                OutputStream os    = socket.getOutputStream();
                BufferedReader bir = new BufferedReader(
                    new InputStreamReader(is));
                PrintWriter out    = new PrintWriter(new BufferedWriter(
                    new OutputStreamWriter(os)));
                
                while (true) {
                    
                    try {
                        if ((inputLine = bir.readLine()) != null) {
                            if (inputLine.equalsIgnoreCase("shutdown")) {
                                if (bVerbose) {
                                    System.out.println("Client told  " +
                                        "JSSE_SSLServer to Shutdown!");
                                }
                                is.close();
                                os.close();
                                socket.close();
                                System.exit(0);
                            }
                            outputLine = "ServerSSLSocket- " + socketCntr;
                            
                            if (bVerbose) {
                                System.out.println("ServerSSLSocket-" +
                                    socketCntr + ": Received " + inputLine);
                                System.out.println("Sending" + outputLine);
                            }
                            out.println(outputLine);
                            out.flush();
                        } else {
                                 /* if you read null then quit. otherwise you
                                  * will be in endless loop with the socket
                                  * stuck in CLOSED_WAIT.
                                  */
                            if (bVerbose) {
                                System.out.println("ServerSSLSocket-" +
                                    socketCntr +
                                    " read null aborting connection.");
                            }
                            break;
                        }
                        
                    } catch (SocketTimeoutException ste) {
                        System.out.println("ServerSSLSocket-" + socketCntr +
                            " timed out: " +  ste.toString());
                        break;
                    } catch (IOException ex) {
                        if (bVerbose) ex.printStackTrace();
                        break;
                    }
                }
                
                /* close streams and close socket */
                is.close();
                os.close();
                socket.close();
                if (bVerbose) {
                    System.out.println("ServerSSLSocket " + socketCntr +
                        " has been Closed.");
                }
            } catch (IOException e) {
                
                e.printStackTrace();
            }
            
        }
    }
    
    
    
    SSLServerSocketFactory getServerSocketFactory(String type) {
        
        // set up key manager to do server authentication
        SSLContext             ctx = null;
        KeyManagerFactory      kmf = null;
        KeyStore                ks = null;
        char[]          passphrase = "m1oZilla".toCharArray();
        SSLServerSocketFactory ssf = null;
        
        System.setProperty("javax.net.ssl.trustStore",
            System.getProperty("java.home") + "/jre/lib/security/cacerts");
        String certificate = "SunX509";
        String javaVendor  = System.getProperty("java.vendor");
        if (javaVendor.equals("IBM Corporation"))
            certificate = "IbmX509";
        
        System.out.println("keystore loc: " + getKeystore());
        
        if (!(type.equals("TLS") || type.equals("SSLv3"))) {
            System.out.println("type must equal \'TLS\' or \'SSLv3\'\n");
            System.exit(1);
        }
        
        try {
            ctx = SSLContext.getInstance(type);
            kmf = KeyManagerFactory.getInstance(certificate);
            ks = KeyStore.getInstance("PKCS12");
            
            ks.load(new FileInputStream(getKeystore()), passphrase);
            kmf.init(ks, passphrase);
            ctx.init(kmf.getKeyManagers(), null, null);
            
            ssf = ctx.getServerSocketFactory();
            return ssf;
        } catch (Exception e) {
            //if (Constants.debug_level > 3)
            e.printStackTrace();
        }
        
        return ssf;
    }
}
