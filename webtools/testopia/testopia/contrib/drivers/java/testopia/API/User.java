 /*
  * The contents of this file are subject to the Mozilla Public
  * License Version 1.1 (the "License"); you may not use this file
  * except in compliance with the License. You may obtain a copy of
  * the License at http://www.mozilla.org/MPL/
  *
  * Software distributed under the License is distributed on an "AS
  * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
  * implied. See the License for the specific language governing
  * rights and limitations under the License.
  *
  * The Original Code is the Bugzilla Testopia Java API.
  *
  * The Initial Developer of the Original Code is Andrew Nelson.
  * Portions created by Andrew Nelson are Copyright (C) 2006
  * Novell. All Rights Reserved.
  *
  * Contributor(s): Andrew Nelson <anelson@novell.com>
  *
  */
package testopia.API;
import java.net.URL;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.HashMap;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import org.apache.xmlrpc.client.XmlRpcClient;
import org.apache.xmlrpc.client.XmlRpcClientConfigImpl;

import org.apache.xmlrpc.client.XmlRpcClient;

/**
 * 
 * @author anelson, bstice
 * Retrives the user ID for the inputed email
 */
public class User {
	 
	
	private String user; 
	private String userName;
	private String password;
	private URL url; 
	
	 
	 /**
	  * 
	  * @param userName - your testopia/bugzilla username
	  * @param password - the password for your account 
	  * @param login - the user you want attributes returned for
	  * @param url - the url of the testopia server
	  */
	 public User(String userName, String password, String login, URL url)
	 {
		 this.user = login;
		 this.userName = userName;
		 this.password = password; 
		 this.url = url;
	 }
	
	 
	 /**
	 * @return the user_id for the specified login. Returns 0 if there is
	 *         an error and the user ID cannot be returned
	 */
	 public int getAttributes()
		{
			try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the user
				params.add(user);
				
				//update the testRunCase
				int result = (Integer)client.execute("User.lookup_id_by_login",params);
				
				//System.out.println(result);
				
				return result;
			
				
			}			
			
			catch (Exception e)
			{
				e.printStackTrace();
				return 0;
			}
		}
	 
	 /**
		 * 
		 * @return the XML client used to connect to and modify TestCaseRun
		 */
	 private XmlRpcClient getXMLclient() throws Exception
		{
			try
			{

			    XmlRpcClientConfigImpl config = new XmlRpcClientConfigImpl();
			    config.setServerURL(url);
			    config.setBasicUserName(userName);
			    config.setBasicPassword(password);

			    XmlRpcClient client = new XmlRpcClient();
			    client.setConfig(config);
			    
			    return client;
			}
			
			catch (Exception e)
			{
				e.printStackTrace();			
			}
			
			throw new Exception("could not connect to server");
		}
	 
	 private static void TrustAllCerts()
		throws java.security.NoSuchAlgorithmException,
		       java.security.KeyManagementException  
	{
		// Create a trust manager that does not validate certificate chains

		TrustManager[] trustAllCerts = new TrustManager[] 
	    {
	        new X509TrustManager() 
	        {
	            public X509Certificate[] getAcceptedIssuers() 
	            {
	                return null;
	            }
	 
	            public void checkClientTrusted(X509Certificate[] certs, String authType) 
	            {
	                // Trust always
	            }
	 
	            public void checkServerTrusted(X509Certificate[] certs, String authType) 
	            {
	                // Trust always
	            }
	        }
	    };
	 
	    // Install the all-trusting trust manager
	    SSLContext sc = SSLContext.getInstance("SSL");
	    
	    // Create empty HostnameVerifier
	    HostnameVerifier hv = new HostnameVerifier() 
	    {
	    	public boolean verify(String arg0, SSLSession arg1) 
	    	{
	    		return true;
	        }
	    };

	    sc.init(null, trustAllCerts, new java.security.SecureRandom());
	    HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
	    HttpsURLConnection.setDefaultHostnameVerifier(hv);
	}
	 
	 
	 

}
