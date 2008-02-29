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


public class TestopiaTestCase {
	
	//inputed values to get a testCase
	private String userName;
	private String password;
	private URL url; 
	private Integer caseID; 
	
	//values for updates 
	private Integer defaultTesterID = null;
	private Integer isAutomated;
	private Integer priorityID;
	private Integer categoryID;
	private Integer canview; 
	private String arguments;
	private String alias; 
	private String requirement;
	private String script; 
	private String caseStatusID;
	private String summary; 
	
	/** 
	 * @param userName your bugzilla/testopia userName
	 * @param password your password 
	 * @param url the url of the testopia server
	 * @param caseID - Integer the caseID, you may enter null here if you are creating a test case
	 */
	public TestopiaTestCase(String userName, String password, URL url, Integer caseID)
	{
		this.userName = userName;
		this.password = password;
		this.url = url; 
		this.caseID = caseID; 
	}
	/**
	 * 
	 * @param alias String - the new Alias
	 */	
	public void setAlias(String alias) {
		this.alias = alias;
	}

	/**
	 * 
	 * @param arguments String - the new arguments
 	 */
	public void setArguments(String arguments) {
		this.arguments = arguments;
	}

	/**
	 * 
	 * @param canview 
	 */
	public void setCanview(boolean canview) {
		
		//true == 1
		if(canview)
			this.canview = 1;
		
		//false ==0
		else
			this.canview = 0; 
	}
   
	/**
	 * 
	 * @param caseStatusID String - the new case Status ID
	 */
	public void setCaseStatusID(String caseStatusID) {
		this.caseStatusID = caseStatusID;
	}

	/**
	 * 
	 * @param categoryID int - the new categorID
	 */
	public void setCategoryID(int categoryID) {
		this.categoryID = categoryID;
	}

	/**
	 * 
	 * @param defaultTesterID int - the new defaultTesterID
	 */
	public void setDefaultTesterID(int defaultTesterID) {
		this.defaultTesterID = defaultTesterID;
	}

	/**
	 * 
	 * @param isAutomated boolean - true if it's to be set automated, 
	 * false otherwise
	 */
	public void setIsAutomated(boolean isAutomated) {
		//true == 1
		if(isAutomated)
			this.isAutomated = 1;
		
		//false ==0
		else
			this.isAutomated = 0;
	}
	
	/**
	 * 
	 * @param priorityID - int the new priorityID
	 */
	public void setPriorityID(int priorityID) {
		this.priorityID = priorityID;
	}
	
	/**
	 * 
	 * @param requirement String - the new requirement 
	 */
	public void setRequirement(String requirement) {
		this.requirement = requirement;
	}
	
	/**
	 * 
	 * @param script String - the new script
	 */
	public void setScript(String script) {
		this.script = script;
	}

	/**
	 * 
	 * @param summary String - the new summary
	 */
	public void setSummary(String summary) {
		this.summary = summary;
	}
	
	/**
	 * Adds a component to the testCase
	 * @param componentID the ID of the component that will be added to the
	 * testCase
	 * @throws Exception
	 */
	public void addComponent(int componentID) throws Exception
	{
		if(caseID == null)
			throw new Exception("CaseID cannot be null");
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(caseID);
			params.add(componentID);
			

			//add the component to the test case
			int result = (Integer) client.execute("TestCase.add_component",
					params);
			
			//System.out.println(result);
						
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
		}
		
	}
	
	/**
	 * Removes a component to the testCase
	 * @param componentID the ID of the component that will be removed from the
	 * testCase
	 * @throws Exception
	 */
	public void removeComponent(int componentID) throws Exception
	{
		if(caseID == null)
			throw new Exception("CaseID cannot be null");
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(caseID);
			params.add(componentID);
			

			//add the component to the test case
			int result = (Integer) client.execute("TestCase.remove_component",
					params);
			
			//System.out.println(result);
						
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
		}
		
	}
	
	/**
	 * Gets the components as an array of hashMaps or null if 
	 * an error occurs
	 * @return an array of component hashMaps or null 
	 * @throws Exception
	 */
	public Object[] getComponents() throws Exception
	{
		if(caseID == null)
			throw new Exception("CaseID cannot be null");
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(caseID);

			// get the hashmap
			Object[] result = (Object[]) client.execute(
					"TestCase.get_components", params);

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
	 * Updates are not called when the .set is used. You must call update after all your sets
	 * to push the changes over to testopia.
	 * @throws Exception if planID is null 
	 * (you made the TestCase with a null caseID and have not created a new test plan)
	 */
	public void update() throws Exception
	{
		if (caseID == null) 
		{
			throw new Exception("caseID is null.");
		}
		
		//hashmap to store attributes to be updated
		HashMap<String, Object> map = new HashMap<String, Object>();
		
		//add attributes that need to be updated to the hashmap 
		if(isAutomated != null)
			map.put("isautomated", isAutomated.intValue());
		
		if(priorityID != null)
			map.put("priority_id", priorityID.intValue());
		
		if(canview != null)
			map.put("canview", canview.intValue());
		
		if(categoryID != null)
			map.put("category_id", categoryID);
		
		if(arguments != null)
			map.put("arguments", arguments);
		
		if(alias != null)
			map.put("alias", alias);
		
		if(requirement != null)
			map.put("requirement", requirement);
		
		if(script != null)
			map.put("script", script);
		
		if(caseStatusID != null)
			map.put("case_status_id", caseStatusID);
		
		if(summary != null)
			map.put("summary", summary); 
		 		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(caseID);
			params.add(map);
			

			//update the testRunCase
			HashMap result = (HashMap) client.execute("TestCase.update",
					params);
			
			//System.out.println(result);
						
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
		}
		
		//make sure multiple updates aren't called 
		isAutomated = null;
		priorityID = null;
		categoryID = null;
		canview	= null;	
		arguments = null;
		alias = null;
		requirement	= null;	
		script = null; 
		caseStatusID = null;
		summary = null;
	}
	
	/**
	 * 
	 * @param authorID the bugzilla/testopia ID of the author 
	 * @param caseStatusID 
	 * @param categoryID
	 * @param isAutomated
	 * @param planID the ID of the plan the testCase will be added to 
	 * @param summary string - the summary of the testCase. Null allowed
	 * @param priorityID Integer - the priority of the testCase (0-5). Null allowed
	 * @return
	 */
	public int makeTestCase(int authorID, int caseStatusID, int categoryID,
			boolean isAutomated, int planID, String summary,Integer priorityID)
	{
				
		int isAutomatedInt; 
		
		//convert to integer of 1 if isAutomated is true (1 == true)
		if(isAutomated)
			isAutomatedInt = 1; 
		
		//else convert to 0 for false (0 == false)
		else 
			isAutomatedInt = 0; 

		//set the values for the test case
		HashMap<String, Object> map = new HashMap<String, Object>();
		map.put("author_id", authorID);
		map.put("case_status_id", caseStatusID);
		map.put("category_id", categoryID);
		map.put("isautomated", isAutomatedInt);
		map.put("plan_id", planID);
		
		//add the optional values if they are not null
		if(summary != null)
			map.put("summary", summary);
		
		if(priorityID != null)
			map.put("priority_id", priorityID.intValue());
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(map);
			

			//update the test case
			int result = (Integer)client.execute("TestCase.create",
					params);
			
			caseID = result; 
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
	 * Gets the attributes of the test case, caseID must not be null
	 * @return a hashMap of all the values found. Returns null if there is an error
	 * and the TestCase cannot be returned
	 * @throws Exception 
	 */
	public HashMap<String, Object> getAttributes() throws Exception
	{
		if (caseID == null) 
		{
			throw new Exception("caseID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(caseID.intValue());
			
			//get the hashmap
			HashMap result = (HashMap) client.execute("TestCase.get",
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
	 * Returns hashmap(s) of testcases that match the inputed values 
	 * @param userName your bugzilla/testopia userName
	 * @param password your password 
	 * @param url the url of the testopia server
	 * @param values a HashMap with the parameters that will be searched for
	 * if you supply the pair "case_id", 5 then case_id 5 will be returned. Any combination
	 * of testcase attributes can be entered and the result will be all the matches that fit
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
					"TestCase.list", params);

			// System.out.println(result);

			return result;		
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
			return null;
		}
	}
	
	public int getCategoryIdByName(String categoryName)
	{
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the category
			params.add(categoryName);
			
			//get the result
			int result = (Integer)client.execute("TestCase.lookup_category_id_by_name", params);
			
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
	  * @param categoryName the name of the category that the ID will be returned for. This will search within the
	  * test plans that this test case belongs to and return the first category with a matching name. 0 Will be 
	  * returned if the category can't be found
	  * @return the ID of the specified product
	  */
	 public int getBuildIDByName(String categoryName)
	 {
		 try 
			{
				TrustAllCerts();

				XmlRpcClient client = getXMLclient();

				ArrayList<Object> params = new ArrayList<Object>();
				
				//set up params, to identify the category
				params.add(categoryName);
				
				//get the result
				int result = (Integer)client.execute("TestCase.lookup_category_id_by_name", params);
				
				//System.out.println(result);
				
				return result;			
				
			}			
			
			catch (Exception e)
			{
				e.printStackTrace();
				return 0;
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
