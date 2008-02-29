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


public class TestRun {
	//inputed values to get a testRun
	private String userName;
	private String password;
	private URL url; 
	private Integer runID;
	
	//variables used to update the testRun
	private String notes = null;
	private Integer managerID = null;  
	private String summary = null;  
	private String startDate = null;
	private String stopDate = null; 
	private Integer buildID = null;  
	private Integer environmentID = null; 
	private Integer newPlanID = null; 
	
	/**
	 * 
	 * @param buildID int - the new builID
	 */
	public void setBuildID(int buildID) {
		this.buildID = buildID;
	}

	/**
	 * 
	 * @param environmentID int = the new environemnetID
	 */
	public void setEnvironmentID(int environmentID) {
		this.environmentID = environmentID;
	}

	/**
	 * 
	 * @param managerID int - the new managerID
	 */
	public void setManagerID(int managerID) {
		this.managerID = managerID;
	}

	/**
	 * 
	 * @param notes String - the new notes 
	 */
	public void setNotes(String notes) {
		this.notes = notes;
	}

	/**
	 * 
	 * @param startDate String - the new startDate (Format: yyyy-mm-dd hh:mm:ss)
	 */
	public void setStartDate(String startDate) {
		this.startDate = startDate;
	}

	/**
	 * 
	 * @param stopDate String - the new stopDate (Format: yyyy-mm-dd hh:mm:ss)
	 */
	public void setStopDate(String stopDate) {
		this.stopDate = stopDate;
	}
	
	/**
	 * 
	 * @param summary String - the new summary 
	 */
	public void setSummary(String summary) {
		this.summary = summary;
	}
	
	/**
	 * 
	 * @param newPlanID int - the plan that the test run now belongs to
	 */
	public void setPlanID(Integer newPlanID)
	{
		this.newPlanID = newPlanID; 
	}
	
	public void update() throws Exception
	{
		if (runID == null) 
		{
			throw new Exception("runID is null.");
		}
		
		//hashmap to store attributes to be updated
		HashMap<String, Object> map = new HashMap<String, Object>();
		
		//add attributes that need to be updated to the hashmap 
		 if(buildID != null)
			 map.put("build_id", buildID);
		 
		 if(environmentID != null)
			 map.put("environment_id", environmentID);		 
		 
		 if (managerID != null)
			 map.put("manager_id", managerID); 
		
		 if(notes != null)
			 map.put("notes", notes); 
		 
		 if(startDate != null)
			 map.put("start_date", startDate);
		 
		 if(stopDate != null)
			 map.put("stop_date", stopDate);
		 
		 if(summary != null)
			 map.put("summary", summary);
		 
		 if(newPlanID != null)
			 map.put("plan_id", newPlanID);
		 
		 
		 		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(runID);
			params.add(map);
			

			//update the testRunCase
			HashMap result = (HashMap) client.execute("TestRun.update",
					params);
			
			//System.out.println(result);
			
			 notes = null;
			 managerID = null;  
			 summary = null;  
			 startDate = null;
			 stopDate = null; 
			 buildID = null;  
			 environmentID = null; 
			 newPlanID = null; 
			
		}			
		
		catch (Exception e)
		{
			e.printStackTrace();
		}
	}
	
	/**
	 * Gets the attributes of the test run, runID must not be null
	 * @return a hashMap of all the values found. Returns null if there is an error
	 * and the TestRun cannot be returned
	 * @throws Exception 
	 */
	public HashMap<String, Object> getAttributes() throws Exception
	{
		if (runID == null) 
		{
			throw new Exception("runID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(runID.intValue());
			
			//get the hashmap
			HashMap result = (HashMap) client.execute("TestRun.get",
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
	 * Returns hashmap(s) of testplans that match the inputed values 
	 * @param userName your bugzilla/testopia userName
	 * @param password your password 
	 * @param url the url of the testopia server
	 * @param values a HashMap with the parameters that will be searched for
	 * if you supply the pair "run_id", 5 then run_id 5 will be returned. Any combination
	 * of testrun attributes can be entered and the result will be all matches that fit 
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
					"TestRun.list", params);

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
	 * @param userName your bugzilla/testopia userName
	 * @param password your password 
	 * @param url the url of the testopia server
	 * @param runID - Integer the runID, you may enter null here if you are creating a test run
	 */
	public TestRun(String userName, String password, URL url, Integer runID)
	{
		this.userName = userName; 
		this.password = password;
		this.url = url; 
		this.runID = runID; 
	}
	
	/**
	 * 
	 * @param buildID
	 * @param environmentID
	 * @param managerID
	 * @param planID int - the ID of the plan the run will be added to 
	 * @param planTextVersion
	 * @param summary String - text summary of the run
	 * @return the ID of the test run
	 */
	public int makeTestRun(int buildID, int environmentID, int managerID, int planID,
			int planTextVersion, String summary)
	{
		//set the values for the test plan
		HashMap<String, Object> map = new HashMap<String, Object>();
		map.put("build_id", buildID);
		map.put("environment_id", environmentID);
		map.put("manager_id", managerID);
		map.put("plan_id", planID);
		map.put("plan_text_version", planTextVersion);
		map.put("summary", summary);
		
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test case
			params.add(map);
			

			//update the testRunCase
			int result = (Integer)client.execute("TestRun.create",
					params);
			
			runID = result; 
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
	 * @return an array of objects (Object[]) of all the testcases found. 
	 * Returns null if there is an error and the TestRun cannot be returned
	 * @throws Exception
	 */
	public Object[] getTestCases() throws Exception
	{
		if (runID == null) 
		{
			throw new Exception("runID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(runID.intValue());
			
			
			//get the hashmap
			Object[] categories = (Object[])client.execute("TestRun.get_test_cases",
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
	 * @return an array of objects (Object[]) of all the testCaseRuns found. 
	 * Returns null if there is an error and the TestRun cannot be found
	 * @throws Exception
	 */
	public Object[] getTestCaseRuns() throws Exception
	{
		if (runID == null) 
		{
			throw new Exception("runID is null.");
		}
		
		try 
		{
			TrustAllCerts();

			XmlRpcClient client = getXMLclient();

			ArrayList<Object> params = new ArrayList<Object>();
			
			//set up params, to identify the test plan
			params.add(runID.intValue());
			
			//get the hashmap
			Object[] categories = (Object[])client.execute("TestRun.get_test_case_runs",
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
			java.security.KeyManagementException {
		// Create a trust manager that does not validate certificate chains

		TrustManager[] trustAllCerts = new TrustManager[] { new X509TrustManager() {
			public X509Certificate[] getAcceptedIssuers() {
				return null;
			}

			public void checkClientTrusted(X509Certificate[] certs,
					String authType) {
				// Trust always
			}

			public void checkServerTrusted(X509Certificate[] certs,
					String authType) {
				// Trust always
			}
		} };

		// Install the all-trusting trust manager
		SSLContext sc = SSLContext.getInstance("SSL");

		// Create empty HostnameVerifier
		HostnameVerifier hv = new HostnameVerifier() {
			public boolean verify(String arg0, SSLSession arg1) {
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

		catch (Exception e) {
			e.printStackTrace();
		}

		throw new Exception("could not connect to server");
	}
		
}
