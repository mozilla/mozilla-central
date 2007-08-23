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

import java.io.IOException;
import org.mozilla.jss.ssl.*;
import org.mozilla.jss.CryptoManager;
import org.mozilla.jss.crypto.*;
import org.mozilla.jss.util.PasswordCallback;
import java.util.Vector;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import org.mozilla.jss.util.Debug;

/**************
 * Note on how to use JSS_SelfServServer and JSS_SelfServerClient
 *
 * For debugging purposes you should modify Constant.java debug_level to 4.
 *
 * First create db's and certificates
 * java -cp jss4.jar org.mozilla.jss.tests.SetupDBs . ./passwords
 * java -cp jss4.jar org.mozilla.jss.tests.GenerateTestCert . /passwords
 *                             localhost SHA-256/RSA CA_RSA Client_RSA Server_RSA
 *
 * Start the server:
 *
 *  java -cp ./jss4.jar org.mozilla.jss.tests.JSS_SelfServServer . passwords localhost 
 *             false 2921 bypassoff verboseoff
 *
 * Start the client with 4 threads using ciphersuite 0x33.
 * Look at the file Constant.java for the ciphersuites values.
 *
 * java -cp jss4.jar org.mozilla.jss.tests.JSS_SelfServClient 2 0x33 
 * . localhost 2921 bypassoff verboseoff JSS Client_RSA     
 *
 * If you envoke the client with a ciphersuite value -1
 * then all current JSS ciphersuites will be tested fox X number of
 * threads, and once all ciphersuites have been tested the client
 * will closed all client SSLSockets and then tell the server to
 * shutdown. This case is for the nightly automated tests.
 *
 * java -cp jss4.jar org.mozilla.jss.tests.JSS_SelfServClient 4 -1 
 * . passwords localhost 2921 bypassoff verboseoff JSS
 */

public class JSS_SelfServServer  {
    
    private static Vector jssSupportedCiphers = new Vector();
    private static SSLServerSocket serverSock = null;
    private static SSLSocket sock             = null;
    
    public static void main(String[] args) throws Exception {
        try {
            (new JSS_SelfServServer()).doIt(args);
        } catch (Exception e) {
            System.out.println("Exception " + e.getMessage());
            System.exit(1);
        }
        System.exit(0);
    }
    
    private String        fServerCertNick = null;
    private String        fServerHost     = "localhost";
    private String        fPasswordFile   = "passwords";
    private String        fCertDbPath     = ".";
    private boolean       TestInetAddress = false;
    private boolean       success         = true;
    private boolean       bVerbose        = false;
    private boolean       bBypass         = false;
    public  int    port            = 29754;
    public  static String usage           = "\nUSAGE:\njava JSS_SelfServServer"+
        " [certdb path] [password file]\n"+
        "[server_host_name] [testInetAddress: true|false]" +
        "<port> <bypass> <verbose> <cert nickname> ";
    
    public void JSS_SelfServServer() {
        if (Constants.debug_level > 3) {
            bVerbose = true;
        }
    }
    
    public void doIt(String[] args) throws Exception {
        
        if ( args.length < 5  || args[0].toLowerCase().equals("-h")) {
            System.out.println(usage);
            System.exit(1);
        }
        try {
            if (!args[0].equals("."))
                fCertDbPath = args[0];
            if (!args[1].equals("passwords"))
                fPasswordFile = args[1];
            if (!args[2].equals("localhost"))
                fServerHost = args[2];
            if (args[3].equalsIgnoreCase("true") == true)
                TestInetAddress = true;
            if (args.length >= 5)
                port = new Integer(args[4]).intValue();
            if (args.length >=6 && args[5].equalsIgnoreCase("bypass")) {
                bBypass = true;
            }
            if (args.length >=7 && args[6].equalsIgnoreCase("verbose")) {
                bVerbose = true;
            }
            if (args.length >=8 && !args[7].equalsIgnoreCase("default")) {
                fServerCertNick = args[7];
            }
        } catch (Exception e) {
            System.out.println("Error parsing command line " + e.getMessage());
            System.out.println(usage);
            System.exit(1);
        }
        
        if (bVerbose) System.out.println("initializing JSS");
        CryptoManager.initialize(fCertDbPath);
        CryptoManager    cm = CryptoManager.getInstance();
        CryptoToken     tok = cm.getInternalKeyStorageToken();
        PasswordCallback cb = new FilePasswordCallback(fPasswordFile);
        tok.login(cb);
        if (bVerbose) {
            Debug.setLevel(Debug.OBNOXIOUS);
        }
        // We have to configure the server session ID cache before
        // creating any server sockets.
        SSLServerSocket.configServerSessionIDCache(10, 100, 100, null);
        
        if (cm.FIPSEnabled()) {
            if (bBypass) {
                System.out.println("Bypass mode cannot be set in FIPS mode.");
                System.out.println(usage);
                System.exit(1);
            }
            /* turn on only FIPS ciphersuites */
            /* Disable SSL2 and SSL3 ciphers */
            SSLSocket.enableSSL2Default(false);
            SSLSocket.enableSSL3Default(false);
            //Enable ony FIPS ciphersuites.
            int ciphers[] =
                org.mozilla.jss.ssl.SSLSocket.getImplementedCipherSuites();
            for (int i = 0; i < ciphers.length;  ++i) {
                if (SSLSocket.isFipsCipherSuite(ciphers[i])) {
                    /* enable the FIPS ciphersuite */
                    SSLSocket.setCipherPreferenceDefault(ciphers[i], true);
                } else if (SSLSocket.getCipherPreferenceDefault(
                    ciphers[i])) {
                    /* disable the non fips ciphersuite */
                    SSLSocket.setCipherPreferenceDefault(ciphers[i], false);
                }
            }
        } else {
            /* turn on all implemented ciphersuites the server ceriticate
            * will determine if the ciphersuites can be used.
            */
            int ciphers[] =
                org.mozilla.jss.ssl.SSLSocket.getImplementedCipherSuites();
            for (int i = 0; i < ciphers.length;  ++i) {
                try {
                    SSLSocket.setCipherPreferenceDefault(ciphers[i], true);
                    if (bVerbose) {
                        System.out.println(Constants.cipher.cipherToString(
                            ciphers[i])  + " " +  
                            Integer.toHexString(ciphers[i]));
                    }
                } catch (Exception ex) {
                    ex.printStackTrace();
                    System.exit(1);
                }
            }
            //disable SSL2 ciphersuites
            SSLSocket.enableSSL2Default(false);
            SSLSocket.bypassPKCS11Default(bBypass);
        }
        
        if (bVerbose) {
            if (bBypass)
                System.out.println("SSLSockets in Bypass Mode");
            else
                System.out.println("SSLSockets in Non Bypass Mode");
        }
        
        // open the server socket and bind to the port
        if (bVerbose)
            System.out.println("Server about .... to create socket");
        
        if (TestInetAddress) {
            if (bVerbose)
                System.out.println("the HostName " + fServerHost +
                    " the Inet Address " +
                    InetAddress.getByName(fServerHost));
            serverSock = new SSLServerSocket(port, 5,
                InetAddress.getByName(fServerHost), null , true);
        } else {
            if (bVerbose)
                System.out.println("Inet set to Null");
            serverSock = new SSLServerSocket(port, 5, null , null , true);
        }
        
        if (bVerbose)
            System.out.println("Server created socket");
        
        serverSock.setSoTimeout(300*1000);  // Set timeout for 5 minutes
        serverSock.requireClientAuth(SSLSocket.SSL_REQUIRE_NO_ERROR);
        
        serverSock.setServerCertNickname("Server_ECDSA");
        serverSock.setServerCertNickname("Server_RSA");
        serverSock.setServerCertNickname("Server_DSS");
        
        if (bVerbose)
            System.out.println("Server specified cert by nickname");
        
        System.out.println("Server " + fServerHost +
            " ready to accept connections on " + port);
        int socketCntr = 0;
        while ( true ) {
            // accept the connection
            sock = (SSLSocket) serverSock.accept();
            sock.addHandshakeCompletedListener(
                new HandshakeListener("server", this));
            socketCntr++;
            sock.setSoTimeout(300*1000);
            if (bVerbose) {
                System.out.println("Timeout value for sockets: " +
                    sock.getSoTimeout());
            }
            readWriteThread rwThread = new readWriteThread(sock, socketCntr);
            rwThread.start();
        }
    }
    
    /**
     * ReadWrite thread class that takes a
     * SSLSocket as input and read then writes
     * back to client.
     */
    private class readWriteThread extends Thread {
        private SSLSocket socket = null;
        private int socketCntr   = 0;
        
        public readWriteThread(SSLSocket sock, int cntr) {
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
                                    System.out.println("Client told " +
                                        " JSS_SelfServServer to Shutdown!");
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
    
    public static class HandshakeListener
        implements SSLHandshakeCompletedListener {
        private String who;
        private JSS_SelfServServer boss;
        public HandshakeListener(String who, JSS_SelfServServer boss) {
            this.who = who;
            this.boss = boss;
        }
        public void handshakeCompleted(SSLHandshakeCompletedEvent event) {
            try {
                String mesg = who + " got a completed handshake ";
                SSLSecurityStatus status = event.getStatus();
                if( status.isSecurityOn() ) {
                    mesg += "(security is ON)";
                } else {
                    mesg += "(security is OFF)";
                }
                if (Constants.debug_level > 3) System.out.println(mesg);
            } catch(Exception e) {
                e.printStackTrace();
                boss.setFailure();
            }
        }
    }
    
    public synchronized void setFailure() {
        success = false;
    }
    
    public synchronized boolean getSuccess() {
        return success;
    }
}
