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
  */package testopia.API;
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
 * Allows the user to get a buildID from it's name, or it's name from the buildID. 
 * It can also create and update a build
 * @author anelson
 *
 */
public class Build {
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
	 public Build(String userName, String password, URL url)
	 {
		 this.userName = userName;
		 this.password = password; 
		 this.url = url;
	 }
	 
	 
	 /**
	  * Creates a new build and returns the buildID, 0 is returned if an error occurs
	  * @param name
	  * @param productID
	  */
	 public int makeBuild(String name, int productID, Boolean isactive, String milestone)
	 {
		 int result = 0;
		 
		 //Check if the build already exists. Will return a 0 if the build does not exist
		 int buildTest = getBuildIDByName(name);
		 
		 if(buildTest == 0){
			 //Build does not exist so we need to create a new build
		 
			 HashMap<String, Object> map = new HashMap<String, Object>();
			 map.put("name", name);
			 map.put("product_id", productID);
			 map.put("milestone", milestone);
			 
			 //1 for true, 0 for false
			 if(isactive)
				 map.put("isactive", 1);
			 else
				 map.put("isactive", 0);
			 
			 try 
				{
					TrustAllCerts();
	
					XmlRpcClient client = getXMLclient();
	
					ArrayList<Object> params = new ArrayList<Object>();
					
					//set up params, to identify the build
					params.add(map);
					
					//get the result
					result = (Integer)client.execute("Build.create",params);
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
			 //Make sure we don't forget to set the buildID
			 result = buildTest;
			 return result;
		 }
	 }
	 
	 /**
	  * Updates builds on testopia with the specified parameters
	  * @param name string - the name of the build. Can be null
	  * @param milestone string - the milestone. Can be null
	  * @param isactive Boolean - if the build is active. Can be null
 	  * @param description String - description of the build. Can be null
	  * @param buildID int - the buildID
	  */
	 public void updateBuild(String name, String milestone, Boolean isactive, 
			 String description, int buildID)
	 {
		 //put values into map if they are not null 
		 HashMap<String, Object> map = new HashMap<String, Object>();
		 if(name != null)
			 map.put("name", name);
		 if(milestone != null)
			 map.put("milestone", milestone);
		 if(isactive != null)
		 {
			 //put 1 into map if true
			 if(isactive)
				 map.put("isactive", 1);
		 	//else put false
			 else 
				 map.put("isactive", 0);
		 }
		 
		 if(description != null)
			 map.put("description", description);
		 
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the build
				params.add(buildID);
				params.add(map);
				
				//get the result
				HashMap result = (HashMap)client.execute("Build.update",params);
				
				//System.out.println(result);								
				
			}			
			
			catch (Exception e)
			{
				e.printStackTrace();
				
			}
		 
	 }
	 
	 /**
	  * 
	  * @param BuildName the name of the build that the ID will be returned for. 0 Will be 
	  * returned if the build can't be found
	  * @return the ID of the specified product
	  */
	 public int getBuildIDByName(String buildName)
	 {
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the build
				params.add(buildName);
				
				//get the result
				int result = (Integer)client.execute("Build.lookup_id_by_name",params);
				
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
	 * @param id the ID of the build name that will be returned. Null is returned 
	 * if the product can't be found
	 * @return the product name that corresponds the specified product ID
	 */
	 public String getBuildNameByID(int id)
	 {
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the build
				params.add(id);
				
				//get the result
				String result = (String)client.execute("Build.lookup_id_by_name", params);
				
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
