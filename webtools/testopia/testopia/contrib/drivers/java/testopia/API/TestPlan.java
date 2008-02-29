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

/**
 * Creates a test plan object, that allows the user to create, change and get test plan values
 * @author anelson
 *
 */
public class TestPlan {
	
	//inputed values to get a testPlan
	private String userName;
	private String password;
	private URL url; 
	private Integer planID; 
	
	//inputed values to update a testPlan 
	 private int authorID; 	
	 private String defaultProductVersion;  	
	 private String creation_date;
	 private int isactive; 	
	 private String name; 		
	 private int productID;  	
	 private int typeID;  	
	 
	 //booleans used to trigger if a value has been set
	 private boolean isSetAuthorID = false; 	
	 private boolean isSetDefaultProductVersion = false;  	
	 private boolean isSetcreation_date = false;
	 private boolean isSetIsactive = false; 	
	 private boolean isSetName = false; 		
	 private boolean isSetProductID = false;  	
	 private boolean isSetTypeID = false; 
	
	/**
	 * 
	 * @param userName your bugzilla/testopia userName
	 * @param password your password 
	 * @param url the url of the testopia server
	 * @param planID - Integer the planID, you may enter null here if you are creating a test plan
	 */
	public TestPlan(String userName, String password, URL url, Integer planID)
	{
		this.userName = userName; 
		this.password = password;
		this.url = url; 
		this.planID = planID; 
	}
	
	/**
	 * 
	 * @param authorID the bugzilla/testopia ID of the author 
	 * @param productID the bugzilla/testopia ID of the product 
	 * @param defaultProductVersion 
	 * @param typeID
	 * @param name the name of the test plan
	 * @return the ID of the test plan
	 */
	public int makeTestPlan(String authorID, String productID, String defaultProductVersion,
			String typeID, String name)
	{	
		//set the values for the test plan
		HashMap<String, Object> map = new HashMap();
		map.put("author_id", authorID);
		map.put("product_id", productID);
		map.put("default_product_version", defaultProductVersion);
		map.put("type_id", typeID);
		map.put("name", name);
		
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(map);
			

			//update the testRunCase
			int result = (Integer)client.execute("TestPlan.create",
					params);
			
			planID = result; 
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
	 * Updates are not called when the .set is used. You must call update after all your sets
	 * to push the changes over to testopia.
	 * @throws Exception if planID is null 
	 * (you made the TestPlan with a null planID and have not created a new test plan)
	 */
	public void update() throws Exception
	{
		if (planID == null) 
		{
			throw new Exception("planID is null.");
		}
		
		//hashmap to store attributes to be updated
		HashMap<String, Object> map = new HashMap<String, Object>();
		
		//add attributes that need to be updated to the hashmap 
		 if(isSetAuthorID == true)
			 map.put("author_id", authorID);
		 
		 if(isSetDefaultProductVersion == true)
			 map.put("default_product_version", defaultProductVersion);
		 
		 
		 if (isSetcreation_date == true)
			 map.put("creation_date", creation_date); 
		
		 if(isSetIsactive == true)
			 map.put("isactive", isactive); 
		 
		 if(isSetName == true)
			 map.put("name", name);
		 
		 if(isSetProductID == true)
			 map.put("product_id", productID);
		 
		 if(isSetTypeID == true)
			 map.put("type_id", typeID);
		 		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(planID);
			params.add(map);
			

			//update the testRunCase
			HashMap result = (HashMap) client.execute("TestPlan.update",
					params);
			
			//System.out.println(result);
			
			//make sure multiple updates aren't called, for one set
			 isSetAuthorID = false;  	
			 isSetDefaultProductVersion = false;	
			 isSetcreation_date = false; 
			 isSetIsactive = false;  	
			 isSetName = false;  		
			 isSetProductID = false;   	
			 isSetTypeID = false;  
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
		}
	}
	
	/**
	 * 
	 * @param authorID int - the bugzilla authorID that the TestPlan will be changed to
	 */
	public void setAuthorID(int authorID)
	{
		this.isSetAuthorID = true;
		this.authorID = authorID; 
	}
	
	/**
	 * 
	 * @param defaultProductVersion String - the default product version the test plan will be changed to
	 */
	public void setDefaultProductVersion(String defaultProductVersion)
	{
		this.isSetDefaultProductVersion = true;
		this.defaultProductVersion = defaultProductVersion; 
	}
	
	/**
	 * 
	 * @param creationDate String - the creation date the test plan will be changed to (Format: yyyy-mm-dd hh:mm:ss)
	 */
	public void setCreationDate(String creationDate)
	{
		this.isSetcreation_date = true; 
		this.creation_date = creationDate; 
	}
	
	/**
	 * 
	 * @param isActive boolean - change if the test plan is active or not
	 */
	public void setIsActive(boolean isActive)
	{
		this.isSetIsactive = true; 
		
		//convert to integer of 1 if isActive is true (1 == true)
		if(isActive)
			this.isactive = 1; 
		
		//else convert to 0 for false (0 == false)
		else 
			this.isactive = 0; 
		
	}
	
	/**
	 * 
	 * @param name String - the new name of the test plan 
	 */
	public void setName(String name)
	{
		this.isSetName = true;
		this.name = name; 		
	}
	
	/**
	 * 
	 * @param productID int - the new product ID of the test plan 
	 */
	public void setProductID(int productID)
	{
		this.isSetProductID = true; 
		this.productID = productID; 
	}
	
	/**
	 * 
	 * @param typeID int - the new type of the test plan
	 */
	public void setTypeID(int typeID)
	{
		this.isSetTypeID = true; 
		this.typeID = typeID; 
	}
	
	/**
	 * Gets the attributes of the test plan, planID must not be null
	 * @return a hashMap of all the values found. Returns null if there is an error
	 * and the TestPlan cannot be returned
	 * @throws Exception 
	 */
	public HashMap<String, Object> getAttributes() throws Exception
	{
		if (planID == null) 
		{
			throw new Exception("planID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(planID.intValue());
			
			//get the hashmap
			HashMap result = (HashMap) client.execute("TestPlan.get",
					params);
			
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
	 * @return a hashMap of all the values found. Returns null if there is an error
	 * and the TestPlan cannot be returned
	 * @throws Exception
	 */
	public HashMap<String, Object> getCategories() throws Exception
	{
		if (planID == null) 
		{
			throw new Exception("planID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(planID.intValue());
			
			//get the hashmap
			HashMap<String, Object> categories = (HashMap)client.execute("TestPlan.get",
					params);
			
			//System.out.println(result);
			
			return categories;		
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
			return null;
		}
	}
	
	/**
	 * 
	 * @return an array of objects (Object[]) of all the values found for the builds. 
	 * Returns null if there is an error and the TestPlan cannot be returned
	 * @throws Exception
	 */
	public Object[] getBuilds() throws Exception
	{
		if (planID == null) 
		{
			throw new Exception("planID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(planID.intValue());
			
			//get the hashmap
			Object[] categories = (Object[])client.execute("TestPlan.get_builds",
					params);
			
			//System.out.println(result);
			
			return categories;		
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
			return null;
		}
	}
	
	/**
	 * 
	 * @return an array of objects (Object[]) of all the components found. 
	 * Returns null if there is an error and the TestPlan cannot be returned
	 * @throws Exception
	 */
	public Object[] getComponents() throws Exception
	{
		if (planID == null) 
		{
			throw new Exception("planID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(planID.intValue());
			
			//get the hashmap
			Object[] categories = (Object[])client.execute("TestPlan.get_components",
					params);
			
			//System.out.println(result);
			
			return categories;		
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
			return null;
		}
	}
	
	/**
	 * Returns hashmap(s) of testplans that match the inputed values 
	 * @param userName your bugzilla/testopia userName
	 * @param password your password 
	 * @param url the url of the testopia server
	 * @param values a HashMap with the parameters that will be searched for
	 * if you supply the pair "plan_id", 5 then plan_id 5 will be returned. Any combination
	 * of testplan attributes can be entered and the result will be all matches that fit 
	 * the inputed values
	 * @return
	 */
	public static Object[] getList(String userName, String password,
			URL url, HashMap<String, Object> values)
	{
		try 
		{
			TrustAllCerts();

			//setup client
			XmlRpcClientConfigImpl config = new XmlRpcClientConfigImpl();
			config.setServerURL(url);
			config.setBasicUserName(userName);
			config.setBasicPassword(password);

			XmlRpcClient client = new XmlRpcClient();
			client.setConfig(config);

			ArrayList<Object> params = new ArrayList<Object>();

			// set up params, to identify the test plan
			params.add(values);

			// get the hashmap
			Object[] result = (Object[]) client.execute(
					"TestPlan.list", params);

			// System.out.println(result);

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
	 * @return an array of objects (Object[]) of all the testcases found. 
	 * Returns null if there is an error and the TestPlan cannot be returned
	 * @throws Exception
	 */
	public Object[] getTestCases() throws Exception
	{
		if (planID == null) 
		{
			throw new Exception("planID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(planID.intValue());
			
			//get the hashmap
			Object[] categories = (Object[])client.execute("TestPlan.get_test_cases",
					params);
			
			//System.out.println(result);
			
			return categories;		
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
			return null;
		}
	}
	
	/**
	 * 
	 * @return an array of objects (Object[]) of all the test runs found. 
	 * Returns null if there is an error and the TestPlan cannot be returned
	 * @throws Exception
	 */
	public Object[] getTestRuns() throws Exception
	{
		if (planID == null) 
		{
			throw new Exception("planID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(planID.intValue());
			
			//get the hashmap
			Object[] categories = (Object[])client.execute("TestPlan.get_test_runs",
					params);
			
			//System.out.println(result);
			
			return categories;		
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
			return null;
		}
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

}
