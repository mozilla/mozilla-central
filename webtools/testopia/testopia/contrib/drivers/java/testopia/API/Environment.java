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
  * 				Jason Sabin <jsabin@novell.com>
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

/**
 * Allows the user to get an environment from it's ID. It can also create 
 * and update an environment
 * @author anelson
 *
 */
public class Environment {
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
	 public Environment(String userName, String password, URL url)
	 {
		 this.userName = userName;
		 this.password = password; 
		 this.url = url;
	 }
	 
	 
	 /**
	  * Creates a new environment and returns the environmentID, 0 is returned 
	  * if an error occurs
	  * @param name
	  * @param productID
	  */
	 public int makeEnvironment(String name, int productID, boolean isActive)
	 {
		 int result = 0;
		 
		 //Check if the environment already exists. Will return a null if the environment does not exist
		 HashMap<String, Object> environmentTest = listEnvironments(productID, name);
		 	
		 //System.out.println("Environment Returned: "+ environmentTest.toString());
		 		 
		 if(environmentTest == null){
			 //environment does not exist so we need to create a new environment
		 
			 HashMap<String, Object> map = new HashMap<String, Object>();
			 
			 //1 for true, 0 for false
			 if(isActive)
				 map.put("isactive", 1);
			 else
				 map.put("isactive", 0);
			 
			 map.put("name", name);
			 map.put("product_id", productID);
			 
			 try 
				{
					TrustAllCerts();
	
					XmlRpcClient client = getXMLclient();
	
					ArrayList<Object> params = new ArrayList<Object>();
					
					//set up params, to identify the environment
					params.add(map);
					
					//get the result
					result = (Integer) client.execute("Environment.create",params);
					return result; 
					
					//System.out.println(result);								
					
				}			
				
				catch (Exception e)
				{
					e.printStackTrace();
					return 0;
				}
		 }
		 else{
			 //Build already exists
			 System.out.println("-->Build "+name+" already exists will not create build");
			 //Set the id correctly before returning
			 String envIDString = environmentTest.get("environment_id").toString();
			 result = Integer.parseInt(envIDString);
			 return result;
		 }
	 }
	 
	 /**
	  * Updates the environment on testopia with the specified parameters
	  * @param name string - the name of the build. Can be null
	  * @param milestone string - the milestone. Can be null
	  * @param isactive Boolean - if the build is active. Can be null
 	  * @param description String - description of the build. Can be null
	  * @param buildID int - the buildID
	  */
	 public void updateEnvironment(String name, Boolean isactive, 
			 Integer productID, int environmentID)
	 {
		 //put values into map if they are not null 
		 HashMap<String, Object> map = new HashMap<String, Object>();
		 if(name != null)
			 map.put("name", name);
		 if(productID != null)
			 map.put("product_id", productID);
		 if(isactive != null)
		 {
			 //put 1 into map if true
			 if(isactive)
				 map.put("isactive", 1);
		 	//else put false
			 else 
				 map.put("isactive", 0);
		 }
		 		 
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the build
				params.add(environmentID);
				params.add(map);
				
				//get the result
				HashMap result = (HashMap)client.execute("Environment.update",params);
				
				//System.out.println(result);								
				
			}			
			
			catch (Exception e)
			{
				e.printStackTrace();				
			}
		 
	 }
	 
	 /**
	  * Returns the environmnet as a HashMap or null if environment can't be found
	  * @param environmentName
	  * @return
	  */
	 public HashMap<String, Object> getEnvirnoment(int environmentID)
	 {
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the environment
				params.add(environmentID);
				
				//get the result
				HashMap result = (HashMap)client.execute("Environment.get", params);
				
				//System.out.println(result);
				
				return result;			
				
			}			
			
			catch (Exception e)
			{
				e.printStackTrace();
				return null;
			}
	 }
	 
	 /**
	  * 
	  * @param productName - the name of the product that the 
	  * @param environmentName
	  * @return
	  */
	 public HashMap<String, Object> listEnvironments(String productName, String environmentName)
	 {
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the environment
				if(productName != null)	
				{
					Product product = new Product(userName, password, url);
					int productId = product.getProductIDByName(productName);
					params.add(productId);
				}
				
				if(environmentName != null)
					params.add(environmentName);
				
				//get the result
				HashMap result = (HashMap)client.execute("Environment.get", params);
				
				//System.out.println(result);
				
				return result;
				
			}			
			
			catch (Exception e)
			{
				e.printStackTrace();
				return null;
			}
	 }

	 /**
	  * 
	  * @param productId - the product id 
	  * @param environmentName
	  * @return
	  */
	 public HashMap<String, Object> listEnvironments(int productId, String environmentName)
	 {
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				params.add(productId);
								
				if(environmentName != null)
					params.add(environmentName);
				
				//get the result
				HashMap result = (HashMap)client.execute("Environment.get", params);
				
				//System.out.println(result);
				
				return result;
				
			}			
			
			catch (Exception e)
			{
				e.printStackTrace();
				return null;
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
