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
package testopia.Test;

import java.util.ArrayList;

/**
 * 
 * @author anelson
 * Stores data from the optionadata xml file
 */
public class OptionalData {
	private String assignee; 
	private Integer category;
	private Integer priority;
	private ArrayList<Integer> components; 
	

	public OptionalData()
	{
		category = null;
		components = new ArrayList<Integer>();
	}
	
	public int getCategory() {
		return category;
	}

	public void setCategory(Integer category) {
		this.category = category;
	}
	
	public ArrayList<Integer> getComponents() {
		return components;
	}

	public void addComponent(Integer component) {
		this.components.add(component);
	}
	
	public void removeComponent(Integer component) {
		this.components.remove(component);
	}
	
	public String getAssignee() {
		return assignee;
	}
	public void setAssignee(String assignee) {
		this.assignee = assignee;
	}

	public Integer getPriority() {
		return priority;
	}
	public void setPriority(Integer priority) {
		this.priority = priority;
	}
 

}
